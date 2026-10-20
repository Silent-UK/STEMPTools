import systemNames from "./system-names.json" with { type: "json" };
import { transaction } from "./store.mjs";
export function syncService(db, eve, cat) {
  let busy = false;
  async function planet(id) {
    try {
      return await eve.publicGet("/universe/planets/" + id);
    } catch {
      return { name: "Planet " + id };
    }
  }
  async function collect(c, kind) {
    const prefix = "/characters/" + c.id;
    if(kind === "wallet") {
      if(!JSON.parse(c.scopes).includes("esi-wallet.read_character_wallet.v1")) throw Object.assign(Error("Reconnect this character to enable ISK balances."),{status:403});
      const balance=await eve.get(prefix+"/wallet",c);
      if(typeof balance!=="number" || !Number.isFinite(balance)) throw Error("Invalid wallet balance");
      return {balance};
    }
    if(kind === "clones") {
      if(!["esi-clones.read_clones.v1","esi-clones.read_implants.v1"].every(s=>JSON.parse(c.scopes).includes(s))) throw Object.assign(Error("Reconnect this character to enable Clones."),{status:403});
      const data=await eve.get(prefix+"/clones",c), active=await eve.get(prefix+"/implants",c);
      const skills=await eve.get(prefix+"/skills",c);
      const level=skills.skills.find(s=>s.skill_id===33399)?.active_skill_level||0;
      const implant=id=>({id,name:cat.type(id)?.name||String(id)});
      const clones=[]; const locations=new Map();
      for(const clone of data.jump_clones) {
        if(!locations.has(clone.location_id)) {
          try {locations.set(clone.location_id,(clone.location_type==="station"?await eve.publicGet("/universe/stations/"+clone.location_id):await eve.get("/universe/structures/"+clone.location_id,c)).name);}
          catch {locations.set(clone.location_id,"Location "+clone.location_id+" (unavailable)");}
        }
        clones.push({...clone,location:locations.get(clone.location_id),implants:clone.implants.map(implant)});
      }
      return {capacity:skills.skills.reduce((sum,s)=>sum+([24242,33407,73910].includes(s.skill_id)?s.active_skill_level:0),0),clones:clones.sort((a,b)=>a.location.localeCompare(b.location)||(a.name||"").localeCompare(b.name||"")),active_implants:active.map(implant),ready_at:data.last_clone_jump_date?new Date(Date.parse(data.last_clone_jump_date)+(24-level)*3600000).toISOString():null};
    }
    if (kind === "industry") {
      const scopes = JSON.parse(c.scopes);
      if (
        ![
          "esi-industry.read_character_jobs.v1",
          "esi-characters.read_blueprints.v1",
        ].every((s) => scopes.includes(s))
      )
        throw Object.assign(
          Error(
            "Reconnect this character to enable Industry jobs and blueprints.",
          ),
          { status: 403 },
        );
      const jobs = await eve.get(
        prefix + "/industry/jobs?include_completed=false",
        c,
      );
      const blueprints = [];
      let pages = 1;
      for (let page = 1; page <= pages; page++) {
        const result = await eve.request(
          prefix + "/blueprints?page=" + page,
          c,
        );
        if (page === 1) pages = result.pages;
        if (
          !Number.isInteger(pages) ||
          pages < 1 ||
          pages > 10000 ||
          result.pages !== pages
        )
          throw Error("Blueprint pages changed during sync");
        blueprints.push(...result.data);
      }
      if (new Set(blueprints.map((b) => b.item_id)).size !== blueprints.length)
        throw Error("Blueprint inventory changed during sync");
      const names = {};
      const assets = db
        .prepare(
          "SELECT data FROM snapshots WHERE character_id=? AND kind='assets'",
        )
        .get(c.id);
      const saved = assets
        ? JSON.parse(assets.data)
        : { items: [], locations: {} };
      const roots = new Map(
        saved.items.map((a) => [a.item_id, a.root_location_id]),
      );
      for (const id of new Set([
        ...jobs.map((j) => j.station_id),
        ...blueprints.map((b) => roots.get(b.item_id) || b.location_id),
      ])) {
        if (saved.locations[id]) {
          names[id] = saved.locations[id];
          continue;
        }
        try {
          names[id] = (
            id >= 1000000000000
              ? await eve.get("/universe/structures/" + id, c)
              : await eve.publicGet("/universe/stations/" + id)
          ).name;
        } catch {
          names[id] = "Location " + id;
        }
      }
      return {
        jobs: jobs.map((j) => ({
          ...j,
          name:
            cat.type(j.product_type_id || j.blueprint_type_id)?.name ||
            String(j.blueprint_type_id),
          location: names[j.station_id],
        })),
        blueprints: blueprints.map((b) => ({
          ...b,
          name: cat.type(b.type_id)?.name || String(b.type_id),
          root_location_id: roots.get(b.item_id) || b.location_id,
          location: names[roots.get(b.item_id) || b.location_id],
        })),
      };
    }
    if (kind === "skills") {
      const skills = await eve.get(prefix + "/skills", c),
        queue = await eve.get(prefix + "/skillqueue", c),
        attributes = await eve.get(prefix + "/attributes", c);
      return { skills, queue, attributes };
    }
    if (kind === "pi") {
      const list = await eve.get(prefix + "/planets", c),
        rows = [];
      for (const p of list) {
        const detail = await eve.get(prefix + "/planets/" + p.planet_id, c);
        rows.push({ ...p, ...detail, info: await planet(p.planet_id) });
      }
      return rows;
    }
    if (kind === "dens") {
      const list = await eve.get(prefix + "/structures/mercenary-dens", c), operations = [];
      let operationsError = null;
      try {
        const ops=await eve.get(prefix + "/mercenary-tactical-operations", c);
        for(const o of ops.operations) operations.push(await eve.get(prefix + "/mercenary-tactical-operations/" + o.id,c));
      } catch {operationsError="MTO sync incomplete. Sync again to refresh operations.";}

      const rows = [];
      for (const d of list.mercenary_dens) {
        const detail = await eve.get(
          prefix + "/structures/mercenary-dens/" + d.id,
          c,
        );
        rows.push({
          ...detail,
          planet: await planet(d.planet_id),
          operations_error: operationsError,
          operations: operations
            .filter((o) => o.mercenary_den_id === d.id)
            .map((o) => ({
              ...o,
              definition: cat.operation(o.dungeon_type_id),
            })),
        });
      }
      return rows;
    }
    if (kind === "assets") {
      let items = [],
        pages = 1;
      for (let page = 1; page <= pages; page++) {
        const r = await eve.request(prefix + "/assets?page=" + page, c);
        if (page === 1) pages = r.pages;
        else if (r.pages !== pages)
          throw Error("Asset pages changed during sync; retrying next cycle");
        if (!Number.isInteger(pages) || pages < 1 || pages > 10000)
          throw Error("Invalid ESI asset page count");
        items.push(...r.data);
      }
      if (new Set(items.map((a) => a.item_id)).size !== items.length)
        throw Error("Asset list changed during sync");
      const byId = new Map(items.map((a) => [a.item_id, a])),
        locations = {},
        locationTypes = {};
      for (const item of items) {
        let parent = item,
          visited = new Set();
        while (
          byId.has(parent.location_id) &&
          !visited.has(parent.location_id)
        ) {
          visited.add(parent.location_id);
          parent = byId.get(parent.location_id);
        }
        item.root_location_id = parent.location_id;
      }
      for (const id of new Set(items.map((a) => a.root_location_id))) {
        try {
          const path =
            id >= 1000000000000
              ? "/universe/structures/" + id
              : "/universe/stations/" + id;
          const place =
            id >= 1000000000000
              ? await eve.get(path, c)
              : await eve.publicGet(path);
          locations[id] = place.name;
          if (place.type_id) locationTypes[id] = place.type_id;
        } catch {
          locations[id] = "Location " + id + " (name unavailable)";
        }
      }
      return { items, locations, locationTypes };
    }
    throw Error("Unknown sync category");
  }
  async function runCharacter(c) {
    db.prepare(
      "INSERT INTO sync_attempts VALUES(?,?) ON CONFLICT(character_id) DO UPDATE SET attempted=excluded.attempted",
    ).run(c.id, Date.now());
    for (const kind of ["skills", "dens", "pi", "assets", "industry", "clones", "wallet"]) {
      const previous = db
        .prepare(
          "SELECT expires FROM snapshots WHERE character_id=? AND kind=?",
        )
        .get(c.id, kind);
      if (previous?.expires > Date.now()) continue;
      try {
        const data = await collect(c, kind);
        transaction(db, () => {
          db.prepare(
            "INSERT INTO snapshots VALUES(?,?,?,?,?,NULL) ON CONFLICT(character_id,kind) DO UPDATE SET data=excluded.data,updated=excluded.updated,expires=excluded.expires,error=NULL",
          ).run(
            c.id,
            kind,
            JSON.stringify(data),
            Date.now(),
            Date.now() + 3600000,
          );
          db.prepare(
            "DELETE FROM sync_errors WHERE character_id=? AND kind=?",
          ).run(c.id, kind);
        });
      } catch (e) {
        db.prepare(
          "INSERT INTO sync_errors VALUES(?,?,?) ON CONFLICT(character_id,kind) DO UPDATE SET message=excluded.message",
        ).run(
          c.id,
          kind,
          e.status === 401 || e.status === 403
            ? e.message
            : "Refresh failed; previous data retained. Next sync will retry.",
        );
      }
    }
  }
  async function tick() {
    if (busy) return;
    busy = true;
    try {
      const job = db
        .prepare(
          "SELECT c.* FROM jobs j JOIN characters c ON c.id=j.character_id WHERE j.status='queued' LIMIT 1",
        )
        .get();
      if (job) {
        db.prepare("UPDATE jobs SET status='running' WHERE character_id=?").run(
          job.id,
        );
        await runCharacter(job);
        db.prepare("DELETE FROM jobs WHERE character_id=?").run(job.id);
      }
    } finally {
      busy = false;
    }
  }
  function queue(user, character = null, manual = false, scheduled = false) {
    const chars = db
      .prepare("SELECT id FROM characters WHERE user_id=?")
      .all(user);
    for (const c of chars) {
      if (character !== null && c.id !== character) continue;
      if (
        scheduled &&
        (db
          .prepare("SELECT attempted FROM sync_attempts WHERE character_id=?")
          .get(c.id)?.attempted || 0) >
          Date.now() - 3600000
      )
        continue;
      if (
        manual &&
        !db.prepare("SELECT 1 FROM jobs WHERE character_id=?").get(c.id)
      )
        db.prepare("UPDATE snapshots SET expires=0 WHERE character_id=?").run(
          c.id,
        );
      db.prepare("INSERT OR IGNORE INTO jobs(character_id) VALUES(?)").run(
        c.id,
      );
    }
  }
  function schedule() {
    for (const u of db.prepare("SELECT id FROM users").all())
      queue(u.id, null, false, true);
  }
  db.prepare("UPDATE jobs SET status='queued' WHERE status='running'").run();
  return { tick, queue, schedule };
}
export function piSummary(rows, cat, now = Date.now()) {
  return rows.map((p) => {
    const consumed = new Set();
    const production = (p.pins || []).flatMap((pin) => {
      const ex = pin.extractor_details;
      if (ex?.product_type_id) {
        const active = Date.parse(pin.expiry_time) > now;
        return [
          {
            type_id: ex.product_type_id,
            status: active
              ? "Running"
              : pin.expiry_time
                ? "Stopped"
                : "Unknown",
            name:
              cat.type(ex.product_type_id)?.name || String(ex.product_type_id),
            kind: "Extractor",
            perHour:
              active && ex.cycle_time > 0
                ? (ex.qty_per_cycle * 3600) / ex.cycle_time
                : 0,
            expires: pin.expiry_time,
            estimate: true,
          },
        ];
      }
      const s = cat.schematic(
        pin.schematic_id || pin.factory_details?.schematic_id || 0,
      );
      for (const input of s?.types || [])
        if (input.isInput) consumed.add(input._key);
      return s
        ? (s.types || [])
            .filter((t) => !t.isInput)
            .map((t) => ({
              type_id: t._key,
              status:
                Date.parse(pin.last_cycle_start) + s.cycleTime * 1000 > now
                  ? "Running"
                  : "Unknown",
              name: cat.type(t._key)?.name || String(t._key),
              kind: "Factory capacity",
              perHour: (t.quantity * 3600) / s.cycleTime,
              estimate: true,
            }))
        : [];
    });
    const launchpads = (p.pins || [])
      .filter((pin) => cat.type(pin.type_id)?.group_id === 1030)
      .map((pin) => ({
        id: pin.pin_id,
        contents: (pin.contents || []).map((c) => ({
          ...c,
          name: cat.type(c.type_id)?.name || String(c.type_id),
        })),
      }));
    const finals = new Map();
    for (const product of production.filter((r) => !consumed.has(r.type_id))) {
      if (!finals.has(product.type_id))
        finals.set(product.type_id, {
          type_id: product.type_id,
          name: product.name,
          perHour: 0,
          stored: 0,
        });
      finals.get(product.type_id).perHour += product.perHour;
    }
    for (const pad of launchpads)
      for (const item of pad.contents)
        if (finals.has(item.type_id))
          finals.get(item.type_id).stored += item.amount;
    const extractors = production.filter((r) => r.kind === "Extractor");
    const expiry = extractors
      .map((r) => r.expires)
      .filter(Boolean)
      .sort((a, b) => Date.parse(a) - Date.parse(b))[0];
    const running = production.some((r) => r.status === "Running");
    const stopped = production.some((r) => r.status === "Stopped");
    return {
      ...p,
      systemName:
        systemNames[p.solar_system_id || p.info?.system_id] || "Unknown system",
      finalProducts: [...finals.values()],
      resetAt: expiry || null,
      status: running
        ? stopped
          ? "Partially running"
          : "Running (estimated)"
        : stopped
          ? "Extractors stopped"
          : "Production status unknown",
      pins: undefined,
      links: undefined,
      routes: undefined,
      production,
      launchpads,
    };
  });
}
