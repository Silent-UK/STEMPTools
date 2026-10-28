import { createRemoteJWKSet, jwtVerify } from "jose";
export const SCOPES = [
  "esi-wallet.read_character_wallet.v1",
  "esi-clones.read_clones.v1",
  "esi-clones.read_implants.v1",
  "esi-industry.read_character_jobs.v1",
  "esi-industry.read_character_mining.v1",
  "esi-characters.read_blueprints.v1",
  "esi-skills.read_skills.v1",
  "esi-skills.read_skillqueue.v1",
  "esi-planets.manage_planets.v1",
  "esi-assets.read_assets.v1",
  "esi-structures.read_character.v1",
  "esi-activities.read_character.v1",
  "esi-universe.read_structures.v1",
];
const issuer = "https://login.eveonline.com",
  jwks = createRemoteJWKSet(new URL(issuer + "/oauth/jwks"));
export async function verifyToken(token, client, requiredScopes = SCOPES) {
  const { payload: p } = await jwtVerify(token, jwks, {
    issuer: [issuer, "login.eveonline.com"],
    audience: "EVE Online",
    algorithms: ["RS256"],
  });
  if (p.azp !== client || !/^CHARACTER:EVE:\d+$/.test(p.sub) || !p.owner)
    throw Error("EVE identity validation failed");
  const scopes = Array.isArray(p.scp) ? p.scp : [p.scp];
  if (requiredScopes.some((s) => !scopes.includes(s)))
    throw Error("Authorise all requested scopes");
  return {
    id: Number(p.sub.split(":")[2]),
    name: p.name,
    owner: p.owner,
    expires: p.exp * 1000,
    scopes,
  };
}
export async function exchange(config, body) {
  const r = await fetch(issuer + "/v2/oauth/token", {
    method: "POST",
    headers: {
      authorization:
        "Basic " +
        Buffer.from(config.client + ":" + config.secret).toString("base64"),
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(body),
    signal: AbortSignal.timeout(30000),
  });
  if (!r.ok)
    throw Object.assign(
      Error("EVE authorisation failed; reconnect the character"),
      { status: 401 },
    );
  return r.json();
}
export function eveClient(db, box, config) {
  const locks = new Map();
  let cooldown = 0;
  async function token(character) {
    if (locks.has(character.id)) return locks.get(character.id);
    const task = (async () => {
      const row = db
        .prepare("SELECT * FROM characters WHERE id=?")
        .get(character.id);
      if (!row) throw Error("Character unlinked");
      const stored = box.open(row.tokens);
      if (row.expires > Date.now() + 60000) return stored.access_token;
      try {
        const next = await exchange(config, {
          grant_type: "refresh_token",
          refresh_token: stored.refresh_token,
        });
        const identity = await verifyToken(
          next.access_token,
          config.client,
          JSON.parse(row.scopes),
        );
        if (identity.id !== row.id || identity.owner !== row.owner_hash)
          throw Error("Character ownership changed");
        db.prepare(
          "UPDATE characters SET tokens=?,expires=?,reconnect=0 WHERE id=?",
        ).run(
          box.seal({
            ...next,
            refresh_token: next.refresh_token || stored.refresh_token,
          }),
          identity.expires,
          row.id,
        );
        return next.access_token;
      } catch (e) {
        db.prepare("UPDATE characters SET reconnect=1 WHERE id=?").run(row.id);
        throw e;
      }
    })();
    locks.set(character.id, task);
    try {
      return await task;
    } finally {
      locks.delete(character.id);
    }
  }
  async function request(path, character = null, method = "GET", body = null) {
    if (character && method === "GET") {
      const hit = db
        .prepare(
          "SELECT * FROM esi_cache WHERE character_id=? AND path=? AND expires>?",
        )
        .get(character.id, path, Date.now());
      if (hit) return JSON.parse(hit.data);
    }
    if (Date.now() < cooldown)
      throw Error("ESI is cooling down; the next scheduled sync will retry");
    const headers = {
      "X-Compatibility-Date": "2026-10-17",
      "User-Agent": "STEMPTools/0.1 (" + config.contact + ")",
      Accept: "application/json",
    };
    if (character) headers.authorization = "Bearer " + (await token(character));
    if (body) headers["Content-Type"] = "application/json";
    const r = await fetch("https://esi.evetech.net" + path, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(30000),
    });
    const remaining = Number(r.headers.get("x-esi-error-limit-remain") ?? 100);
    if (r.status === 420 || r.status === 429 || remaining < 10)
      cooldown =
        Date.now() +
        Math.max(
          60,
          Number(
            r.headers.get("retry-after") ||
              r.headers.get("x-esi-error-limit-reset") ||
              60,
          ),
        ) *
          1000;
    if (!r.ok)
      throw Object.assign(
        Error(
          r.status === 403
            ? "Access denied by EVE; check character permissions"
            : r.status === 401
              ? "EVE session expired; reconnect character"
              : "ESI unavailable (HTTP " + r.status + ")",
        ),
        { status: r.status },
      );
    const data = await r.json(),
      result = {
        data,
        pages: Number(r.headers.get("x-pages") || 1),
        expires: Math.max(
          Date.now() + 60000,
          Date.parse(r.headers.get("expires")) || Date.now() + 300000,
        ),
      };
    if (character && method === "GET")
      db.prepare(
        "INSERT INTO esi_cache VALUES(?,?,?,?) ON CONFLICT(character_id,path) DO UPDATE SET data=excluded.data,expires=excluded.expires",
      ).run(character.id, path, JSON.stringify(result), result.expires);
    return result;
  }
  async function get(path, character) {
    return (await request(path, character)).data;
  }
  async function publicGet(path) {
    const row = db.prepare("SELECT * FROM public_cache WHERE path=?").get(path);
    if (row && row.expires > Date.now()) return JSON.parse(row.data);
    const r = await request(path);
    db.prepare(
      "INSERT INTO public_cache VALUES(?,?,?) ON CONFLICT(path) DO UPDATE SET data=excluded.data,expires=excluded.expires",
    ).run(path, JSON.stringify(r.data), r.expires);
    return r.data;
  }
  return { request, get, publicGet };
}
