import { fittingView } from "./lib/fitting-view.mjs";
import skillGroups from "./lib/skill-groups.json" with { type: "json" };
import express from "express";
import helmet from "helmet";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { realpathSync } from "node:fs";
import {
  openStore,
  transaction,
  ownedCharacter,
  visibleDocument,
} from "./lib/store.mjs";
import {
  random,
  hash,
  cryptoBox,
  cookies,
  assertOrigin,
} from "./lib/security.mjs";
import { catalog } from "./lib/catalog.mjs";
import { SCOPES, exchange, verifyToken, eveClient } from "./lib/eve.mjs";
import { syncService, piSummary } from "./lib/sync.mjs";
import {
  expandPlan,
  comparePlan,
  parseFitting,
  requirements,
} from "./lib/plans.mjs";
export function createApp(config) {
  const db = config.db || openStore(config.data),
    cat = config.cat || catalog(config.data),
    box = cryptoBox(config.key),
    eve = config.eve || eveClient(db, box, config),
    sync = syncService(db, eve, cat);
  const app = express();
  app.disable("x-powered-by");
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          imgSrc: ["'self'", "https://images.evetech.net"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'"],
          connectSrc: ["'self'"],
          frameAncestors: ["'none'"],
        },
      },
    }),
  );
  app.use(express.json({ limit: "64kb" }));
  const cookieOptions = {
    httpOnly: true,
    secure: config.base.startsWith("https:"),
    sameSite: "lax",
    path: "/",
  };
  const rate = new Map();
  app.use("/auth", (req, res, next) => {
    const ip = req.socket.remoteAddress,
      now = Date.now(),
      r = rate.get(ip);
    if (r && r.until > now) {
      if (++r.count > 100)
        return res
          .status(429)
          .send("Too many login attempts; try again shortly");
    } else rate.set(ip, { until: now + 60000, count: 1 });
    if (rate.size > 10000) rate.clear();
    next();
  });
  app.use((req, res, next) => {
    const session = cookies(req).tools_session;
    req.session = session
      ? db
          .prepare(
            "SELECT s.*,u.name,u.main_id,u.admin FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.id=? AND s.expires>?",
          )
          .get(hash(session), Date.now())
      : null;
    if (req.path.startsWith("/api") || req.path.startsWith("/auth"))
      res.set("Cache-Control", "no-store");
    next();
  });
  app.get("/health", (_req, res) => res.json({ ok: true, version: "0.5.0" }));
  app.get("/auth/login", (req, res) => {
    if (!config.client || !config.secret)
      return res.status(503).send("EVE login is not configured yet.");
    const linking = req.query.link === "1";
    if (linking && !req.session)
      return res
        .status(401)
        .send("Sign in with your main before linking an alt.");
    const invite =
      typeof req.query.invite === "string" ? hash(req.query.invite) : null;
    const state = random(),
      browser = random(),
      verifier = random();
    db.prepare("DELETE FROM oauth WHERE expires<?").run(Date.now());
    db.prepare("INSERT INTO oauth VALUES(?,?,?,?,?,?)").run(
      hash(state),
      hash(browser),
      linking ? req.session.user_id : null,
      invite,
      verifier,
      Date.now() + 600000,
    );
    res.cookie("tools_oauth", browser, { ...cookieOptions, maxAge: 600000 });
    const url = new URL("https://login.eveonline.com/v2/oauth/authorize");
    for (const [k, v] of Object.entries({
      response_type: "code",
      client_id: config.client,
      redirect_uri: config.base + "/auth/callback",
      scope: SCOPES.join(" "),
      state,
      code_challenge: Buffer.from(hash(verifier), "hex").toString("base64url"),
      code_challenge_method: "S256",
    }))
      url.searchParams.set(k, v);
    res.redirect(url.href);
  });
  app.get("/auth/callback", async (req, res) => {
    const state = typeof req.query.state === "string" ? req.query.state : "",
      browser = cookies(req).tools_oauth || "";
    const flow = db
      .prepare("SELECT * FROM oauth WHERE state=? AND browser=? AND expires>?")
      .get(hash(state), hash(browser), Date.now());
    if (!flow)
      return res.status(400).send("Login expired or invalid. Start again.");
    db.prepare("DELETE FROM oauth WHERE state=?").run(hash(state));
    res.clearCookie("tools_oauth", cookieOptions);
    if (flow.user_id && req.session?.user_id !== flow.user_id)
      return res
        .status(403)
        .send("The account linking session changed. Sign in again.");
    if (typeof req.query.code !== "string")
      return res.status(400).send("EVE login was cancelled.");
    const token = await (config.exchange || exchange)(config, {
        grant_type: "authorization_code",
        code: req.query.code,
        code_verifier: flow.verifier,
        redirect_uri: config.base + "/auth/callback",
      }),
      id = await (config.verifyToken || verifyToken)(
        token.access_token,
        config.client,
      );
    const user = transaction(db, () => {
      const existing = db
        .prepare("SELECT * FROM characters WHERE id=?")
        .get(id.id);
      if (existing && existing.owner_hash !== id.owner)
        throw Object.assign(
          Error(
            "Character ownership changed. Contact the administrator before linking.",
          ),
          { status: 403 },
        );
      if (flow.user_id && existing && existing.user_id !== flow.user_id)
        throw Object.assign(
          Error("Character is already linked to another Tools account."),
          { status: 409 },
        );
      let uid = flow.user_id;
      if (!uid && existing) {
        const u = db
          .prepare("SELECT * FROM users WHERE id=?")
          .get(existing.user_id);
        if (u.main_id !== id.id)
          throw Object.assign(Error("Sign in with your main character."), {
            status: 403,
          });
        uid = u.id;
      }
      if (!uid) {
        let invite = null;
        if (id.id !== config.owner) {
          invite = db
            .prepare(
              "SELECT * FROM invites WHERE hash=? AND expires>? AND used_by IS NULL",
            )
            .get(flow.invite || "", Date.now());
          if (!invite)
            throw Object.assign(
              Error(
                "Tools is invite-only. Ask for an invitation, then sign in with your main.",
              ),
              { status: 403 },
            );
        }
        uid = Number(
          db
            .prepare("INSERT INTO users(main_id,name,admin) VALUES(?,?,?)")
            .run(id.id, id.name, id.id === config.owner ? 1 : 0)
            .lastInsertRowid,
        );
        if (invite)
          db.prepare("UPDATE invites SET used_by=? WHERE hash=?").run(
            uid,
            flow.invite,
          );
      }
      db.prepare(
        "INSERT INTO characters VALUES(?,?,?,?,?,?,?,0) ON CONFLICT(id) DO UPDATE SET name=excluded.name,tokens=excluded.tokens,scopes=excluded.scopes,expires=excluded.expires,reconnect=0",
      ).run(
        id.id,
        uid,
        id.name,
        id.owner,
        box.seal(token),
        JSON.stringify(id.scopes),
        id.expires,
      );
      return uid;
    });
    const session = random();
    if (req.session)
      db.prepare("DELETE FROM sessions WHERE id=?").run(req.session.id);
    db.prepare("INSERT INTO sessions VALUES(?,?,?)").run(
      hash(session),
      user,
      Date.now() + 7 * 86400000,
    );
    res.cookie("tools_session", session, {
      ...cookieOptions,
      maxAge: 7 * 86400000,
    });
    sync.queue(user);
    res.redirect("/");
  });
  app.use("/api", (req, res, next) => {
    if (!req.session)
      return res
        .status(401)
        .json({ error: "Sign in with your main character" });
    if (!["GET", "HEAD"].includes(req.method)) {
      try {
        assertOrigin(req, config.base);
      } catch (e) {
        return res.status(403).json({ error: e.message });
      }
      if (!req.is("application/json"))
        return res.status(415).json({ error: "Use JSON" });
    }
    next();
  });
  app.get("/api/me", (req, res) =>
    res.json({
      name: req.session.name,
      main_id: req.session.main_id,
      admin: !!req.session.admin,
    }),
  );
  app.post("/api/logout", (req, res) => {
    db.prepare("DELETE FROM sessions WHERE id=?").run(req.session.id);
    res.clearCookie("tools_session", cookieOptions);
    res.json({ ok: true });
  });
  app.get("/api/characters", (req, res) => {
    const rows = db
      .prepare(
        "SELECT id,name,reconnect FROM characters WHERE user_id=? ORDER BY (id=(SELECT main_id FROM users WHERE id=characters.user_id)) DESC, (SELECT position FROM character_order WHERE character_id=characters.id), id",
      )
      .all(req.session.user_id);
    res.json(
      rows.map((c) => ({
        ...c,
        main: c.id === req.session.main_id,
        job:
          db.prepare("SELECT status FROM jobs WHERE character_id=?").get(c.id)
            ?.status || null,
        snapshots: db
          .prepare(
            "SELECT kind,updated,expires FROM snapshots WHERE character_id=?",
          )
          .all(c.id),
        errors: db
          .prepare("SELECT kind,message FROM sync_errors WHERE character_id=?")
          .all(c.id),
      })),
    );
  });
  app.delete("/api/characters/:id", (req, res) => {
    const c = ownedCharacter(db, req.session.user_id, req.params.id);
    if (c.id === req.session.main_id)
      return res.status(400).json({ error: "The main cannot be unlinked" });
    db.prepare("DELETE FROM characters WHERE id=?").run(c.id);
    res.json({ ok: true });
  });
  app.post("/api/characters/:id/sync", (req, res) => {
    const c = ownedCharacter(db, req.session.user_id, req.params.id);
    sync.queue(req.session.user_id, c.id, true);
    res.json({ ok: true });
  });
  app.post("/api/characters/order", (req, res) => {
    const ids = req.body.ids;
    const own = db
      .prepare("SELECT id FROM characters WHERE user_id=?")
      .all(req.session.user_id)
      .map((c) => c.id);
    if (
      !Array.isArray(ids) ||
      ids.length !== own.length ||
      new Set(ids).size !== own.length ||
      ids[0] !== req.session.main_id ||
      ids.some((id) => !own.includes(id))
    )
      return res.status(400).json({
        error: "Provide your complete character order with the main first",
      });
    transaction(db, () =>
      ids.forEach((id, index) =>
        db
          .prepare("UPDATE character_order SET position=? WHERE character_id=?")
          .run(index, id),
      ),
    );
    res.json({ ok: true });
  });
  app.post("/api/sync", (req, res) => {
    sync.queue(req.session.user_id, null, true);
    res.json({ ok: true });
  });
  function snapshot(req, kind) {
    ownedCharacter(db, req.session.user_id, req.params.id);
    const r = db
      .prepare("SELECT * FROM snapshots WHERE character_id=? AND kind=?")
      .get(Number(req.params.id), kind);
    return r
      ? { updated: r.updated, data: JSON.parse(r.data) }
      : { updated: null, data: null };
  }
  app.get("/api/characters/:id/skills", (req, res) => {
    const s = snapshot(req, "skills");
    if (s.data) {
      s.data.skills.skills = s.data.skills.skills.map((r) => ({
        ...r,
        name: cat.type(r.skill_id)?.name || String(r.skill_id),
        group: skillGroups[cat.type(r.skill_id)?.group_id] || "Other",
      }));
      s.data.queue = s.data.queue.map((r) => ({
        ...r,
        name: cat.type(r.skill_id)?.name || String(r.skill_id),
        group: skillGroups[cat.type(r.skill_id)?.group_id] || "Other",
      }));
    }
    res.json(s);
  });
  app.get("/api/operations/:kind", (req, res) => {
    if (!["pi", "dens", "industry"].includes(req.params.kind))
      return res.sendStatus(404);
    const chars = db
      .prepare(
        "SELECT id,name FROM characters WHERE user_id=? ORDER BY (id=(SELECT main_id FROM users WHERE id=characters.user_id)) DESC, (SELECT position FROM character_order WHERE character_id=characters.id), id",
      )
      .all(req.session.user_id);
    res.json(
      chars.map((c) => {
        const r = db
          .prepare(
            "SELECT data,updated FROM snapshots WHERE character_id=? AND kind=?",
          )
          .get(c.id, req.params.kind);
        return {
          ...c,
          main: c.id === req.session.main_id,
          updated: r?.updated || null,
          error:
            db
              .prepare(
                "SELECT message FROM sync_errors WHERE character_id=? AND kind=?",
              )
              .get(c.id, req.params.kind)?.message || null,
          data: r
            ? req.params.kind === "pi"
              ? piSummary(JSON.parse(r.data), cat)
              : JSON.parse(r.data)
            : null,
        };
      }),
    );
  });
  app.get("/api/assets", (req, res) => {
    const q = String(req.query.q || "").toLowerCase(),
      char = Number(req.query.character || 0),
      location = String(req.query.location || "").toLowerCase(),
      offset = Math.max(0, Number(req.query.offset) || 0);
    const rows = [];
    const sources = [];
    for (const c of db
      .prepare("SELECT id,name FROM characters WHERE user_id=?")
      .all(req.session.user_id)) {
      if (char && char !== c.id) continue;
      const s = db
        .prepare(
          "SELECT data,updated FROM snapshots WHERE character_id=? AND kind='assets'",
        )
        .get(c.id);
      sources.push({ id: c.id, name: c.name, updated: s?.updated || null });
      if (!s) continue;
      const data = JSON.parse(s.data);
      for (const item of data.items) {
        const name = cat.type(item.type_id)?.name || String(item.type_id),
          place =
            data.locations[item.root_location_id] ||
            String(item.root_location_id);
        if (
          !name.toLowerCase().includes(q) ||
          !place.toLowerCase().includes(location)
        )
          continue;
        rows.push({
          ...item,
          name,
          location: place,
          location_type_id: data.locationTypes?.[item.root_location_id] || null,
          character: c.name,
          character_id: c.id,
        });
      }
    }
    const grouped = new Map();
    for (const row of rows) {
      const key = String(row.root_location_id);
      if (!grouped.has(key))
        grouped.set(key, {
          id: key,
          name: row.location,
          type_id: row.location_type_id,
          type_name: row.location_type_id
            ? cat.type(row.location_type_id)?.name || null
            : null,
          items: [],
        });
      const group = grouped.get(key);
      if (!group.type_id && row.location_type_id) {
        group.type_id = row.location_type_id;
        group.type_name = cat.type(row.location_type_id)?.name || null;
      }
      group.items.push(row);
    }
    const locations = [...grouped.values()].sort((a, b) =>
      a.name.localeCompare(b.name),
    );
    res.json({
      total: rows.length,
      locationCount: locations.length,
      locations: locations.slice(offset, offset + 20),
      items: rows.slice(offset, offset + 100),
      sources,
    });
  });
  app.get("/api/catalog", (req, res) =>
    res.json(
      cat.search(
        String(req.query.q || "").slice(0, 100),
        req.query.skills === "1",
      ),
    ),
  );
  app.get("/api/documents", (req, res) =>
    res.json(
      db
        .prepare(
          "SELECT d.id,d.owner,d.kind,d.name,d.shared,d.updated,u.name author FROM documents d JOIN users u ON u.id=d.owner WHERE d.owner=? OR d.shared=1 ORDER BY d.updated DESC",
        )
        .all(req.session.user_id)
        .map((r) => ({ ...r, mine: r.owner === req.session.user_id })),
    ),
  );
  app.get("/api/documents/:id", (req, res) => {
    const row = visibleDocument(db, req.session.user_id, req.params.id);
    res.json({
      ...row,
      body:
        row.kind === "plan"
          ? JSON.parse(row.body).map((r) => ({
              ...r,
              name: cat.type(r.id)?.name || String(r.id),
            }))
          : JSON.parse(row.body),
      fitting: row.kind === "fitting" ? fittingView(JSON.parse(row.body),cat) : null,
      mine: row.owner === req.session.user_id,
    });
  });
  app.post("/api/documents", (req, res) => {
    const { kind, name, body, shared } = req.body;
    if (
      !["plan", "fitting"].includes(kind) ||
      typeof name !== "string" ||
      !name.trim() ||
      name.length > 150
    )
      return res
        .status(400)
        .json({ error: "Enter a name up to 150 characters" });
    let valid;
    if (kind === "plan") {
      if (!Array.isArray(body) || !body.length || body.length > 500)
        throw Error("Plan must contain up to 500 skills");
      valid = expandPlan(body, cat);
    } else {
      parseFitting(body, cat);
      valid = body;
    }
    const id = random();
    db.prepare("INSERT INTO documents VALUES(?,?,?,?,?,?,?)").run(
      id,
      req.session.user_id,
      kind,
      name.trim(),
      JSON.stringify(valid),
      shared === true ? 1 : 0,
      Date.now(),
    );
    res.json({ id });
  });
  app.put("/api/documents/:id", (req, res) => {
    const row = visibleDocument(db, req.session.user_id, req.params.id);
    if (row.owner !== req.session.user_id) return res.sendStatus(403);
    const { name, body, shared } = req.body;
    if (typeof name !== "string" || !name.trim() || name.length > 150)
      throw Error("Enter a name up to 150 characters");
    let valid;
    if (row.kind === "plan") {
      if (!Array.isArray(body) || !body.length || body.length > 500)
        throw Error("Plan needs 1–500 skills");
      valid = expandPlan(body, cat);
    } else {
      parseFitting(body, cat);
      valid = body;
    }
    db.prepare(
      "UPDATE documents SET name=?,body=?,shared=?,updated=? WHERE id=?",
    ).run(
      name.trim(),
      JSON.stringify(valid),
      shared === true ? 1 : 0,
      Date.now(),
      row.id,
    );
    res.json({ id: row.id });
  });
  app.patch("/api/documents/:id", (req, res) => {
    const row = visibleDocument(db, req.session.user_id, req.params.id);
    if (row.owner !== req.session.user_id) return res.sendStatus(403);
    db.prepare("UPDATE documents SET shared=?,updated=? WHERE id=?").run(
      req.body.shared === true ? 1 : 0,
      Date.now(),
      row.id,
    );
    res.json({ ok: true });
  });
  app.delete("/api/documents/:id", (req, res) => {
    const row = visibleDocument(db, req.session.user_id, req.params.id);
    if (row.owner !== req.session.user_id) return res.sendStatus(403);
    db.prepare("DELETE FROM documents WHERE id=?").run(row.id);
    res.json({ ok: true });
  });
  app.post("/api/compare", (req, res) => {
    const c = ownedCharacter(db, req.session.user_id, req.body.character),
      row = visibleDocument(db, req.session.user_id, req.body.document);
    const snap = db
      .prepare(
        "SELECT data,updated FROM snapshots WHERE character_id=? AND kind='skills'",
      )
      .get(c.id);
    if (!snap)
      return res
        .status(409)
        .json({ error: "Sync this character’s skills first" });
    const data = JSON.parse(snap.data),
      body = JSON.parse(row.body),
      entries =
        row.kind === "plan" ? body : parseFitting(body, cat).requirements;
    res.json({
      ...comparePlan(
        entries,
        data.skills,
        data.queue,
        data.attributes,
        cat,
        req.body.alpha === true,
      ),
      updated: snap.updated,
    });
  });
  app.post("/api/ship-plan", (req, res) => {
    const ship = cat.type(req.body.ship);
    if (ship?.category_id !== 6) throw Error("Choose a ship");
    res.json(
      expandPlan(requirements(ship.id, cat), cat).map((r) => ({
        ...r,
        name: cat.type(r.id)?.name || String(r.id),
      })),
    );
  });
  app.get("/api/admin/invites", (req, res) => {
    if (!req.session.admin) return res.sendStatus(403);
    res.json(
      db
        .prepare(
          "SELECT expires,used_by FROM invites ORDER BY expires DESC LIMIT 100",
        )
        .all(),
    );
  });
  app.post("/api/admin/invites", (req, res) => {
    if (!req.session.admin) return res.sendStatus(403);
    const code = random();
    db.prepare("INSERT INTO invites VALUES(?,?,?,NULL)").run(
      hash(code),
      req.session.user_id,
      Date.now() + 7 * 86400000,
    );
    res.json({ url: config.base + "/?invite=" + code });
  });
  app.use(
    express.static(
      new URL("./public", import.meta.url).pathname.replace(
        /^\/([A-Za-z]:)/,
        "$1",
      ),
      { index: "index.html" },
    ),
  );
  app.use((err, req, res, _next) => {
    const status =
      Number.isInteger(err.status) && err.status >= 400 && err.status < 500
        ? err.status
        : 400;
    const message = String(err.message || "Request failed");
    if (req.path.startsWith("/auth"))
      return res
        .status(status)
        .type("text")
        .send(
          status === 403 || status === 409
            ? message
            : "EVE login could not be completed. Please try again.",
        );
    res.status(status).json({
      error: message.startsWith("SQLITE")
        ? "Request could not be saved"
        : message,
    });
  });
  return { app, db, cat, sync };
}
if (
  process.argv[1] &&
  realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const config = {
    base: process.env.BASE_URL || "http://127.0.0.1:3014",
    data: process.env.DATA_DIR || join(process.cwd(), "data"),
    key: process.env.ENCRYPTION_KEY,
    client: process.env.EVE_CLIENT_ID,
    secret: process.env.EVE_CLIENT_SECRET,
    owner: Number(process.env.OWNER_CHARACTER_ID || 122543287),
    contact: process.env.ESI_CONTACT || "tools.areyouaspy.co.uk",
  };
  const { app, sync } = createApp(config);
  app.listen(Number(process.env.PORT || 3014), "127.0.0.1", () =>
    console.log("Tools listening on " + (process.env.PORT || 3014)),
  );
  sync.schedule();
  setInterval(() => sync.schedule(), 60000).unref();
  setInterval(
    () =>
      sync
        .tick()
        .catch(() =>
          console.error("Background sync failed; queued work will retry"),
        ),
    3000,
  ).unref();
}
