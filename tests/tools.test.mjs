import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "../server.mjs";
import { openStore, transaction } from "../lib/store.mjs";
import { cryptoBox, hash } from "../lib/security.mjs";
import { catalog } from "../lib/catalog.mjs";
import {
  comparePlan,
  expandPlan,
  parseFitting,
  skillpoints,
} from "../lib/plans.mjs";
import { syncService, piSummary } from "../lib/sync.mjs";
const key = "ab".repeat(32);
const fakeCat = {
  type(id) {
    return {
      id,
      name: "Skill " + id,
      category_id: 16,
      attributes: {
        275: 1,
        180: 165,
        181: 166,
        ...(id === 2 ? { 182: 1, 277: 3 } : {}),
      },
    };
  },
  close() {},
  search() {
    return [];
  },
  schematic() {
    return null;
  },
};
async function fixture(fn) {
  const dir = mkdtempSync(join(tmpdir(), "tools-test-")),
    db = openStore(dir);
  let identity = {
    id: 100,
    name: "Pilot A",
    owner: "owner-a",
    expires: Date.now() + 3600000,
    scopes: [],
  };
  const { app } = createApp({
    base: "http://127.0.0.1",
    data: dir,
    key,
    db,
    cat: fakeCat,
    owner: 100,
    client: "test",
    secret: "test",
    eve: {},
    exchange: async () => ({ access_token: "fake", refresh_token: "fake" }),
    verifyToken: async () => identity,
  });
  const server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  const base = "http://127.0.0.1:" + server.address().port;
  const request = (
    path,
    { session, body, method = "GET", origin = "http://127.0.0.1", cookie } = {},
  ) =>
    fetch(base + path, {
      method,
      redirect: "manual",
      headers: {
        ...(session ? { cookie: "tools_session=" + session } : {}),
        ...(cookie ? { cookie } : {}),
        ...(body !== undefined
          ? { "content-type": "application/json", origin }
          : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  const user = (id, name) => {
    const uid = Number(
      db.prepare("INSERT INTO users(main_id,name) VALUES(?,?)").run(id, name)
        .lastInsertRowid,
    );
    db.prepare("INSERT INTO characters VALUES(?,?,?,?,?,?,?,0)").run(
      id,
      uid,
      name,
      "owner-" + id,
      cryptoBox(key).seal({ refresh_token: "secret" }),
      "[]",
      Date.now() + 10000,
    );
    const session = "session-" + id;
    db.prepare("INSERT INTO sessions VALUES(?,?,?)").run(
      hash(session),
      uid,
      Date.now() + 100000,
    );
    return { uid, session };
  };
  try {
    await fn({ db, request, user, identity: (v) => (identity = v) });
  } finally {
    await new Promise((r) => server.close(r));
    db.close();
    rmSync(dir, { recursive: true, force: true });
  }
}
test("encrypted credentials authenticate ciphertext and reject wrong keys", () => {
  const box = cryptoBox(key),
    sealed = box.seal({ token: "private" });
  assert.ok(!sealed.includes("private"));
  assert.deepEqual(box.open(sealed), { token: "private" });
  assert.throws(() => cryptoBox("cd".repeat(32)).open(sealed));
});
test("training plan expands and deduplicates prerequisites in order", () => {
  assert.deepEqual(
    expandPlan(
      [
        { id: 2, level: 4 },
        { id: 1, level: 2 },
      ],
      fakeCat,
    ),
    [
      { id: 1, level: 3 },
      { id: 2, level: 4 },
    ],
  );
  assert.throws(() => expandPlan([{ id: 1, level: 6 }], fakeCat));
  assert.equal(skillpoints(1, 5), 256000);
});
test("plan estimate uses partial SP, selected speed and active skill levels", () => {
  const skills = {
    skills: [
      {
        skill_id: 1,
        trained_skill_level: 1,
        active_skill_level: 0,
        skillpoints_in_skill: 250,
      },
    ],
  };
  const r = comparePlan(
    [{ id: 1, level: 1 }],
    skills,
    [],
    { intelligence: 20, memory: 20 },
    fakeCat,
  );
  assert.equal(r.seconds, 0);
  assert.equal(r.ready, false);
  const omega = comparePlan(
      [{ id: 1, level: 2 }],
      skills,
      [],
      { intelligence: 20, memory: 20 },
      fakeCat,
    ),
    alpha = comparePlan(
      [{ id: 1, level: 2 }],
      skills,
      [],
      { intelligence: 20, memory: 20 },
      fakeCat,
      true,
    );
  assert.ok(Math.abs(alpha.seconds - omega.seconds * 2) <= 1);
});
test("anonymous users cannot read data or shared documents", () =>
  fixture(async ({ request }) => {
    for (const path of [
      "/api/me",
      "/api/characters",
      "/api/assets",
      "/api/documents",
      "/api/operations/pi",
      "/api/admin/invites",
    ])
      assert.equal((await request(path)).status, 401);
  }));
test("owner isolation, CSRF and shared document permissions", () =>
  fixture(async ({ request, user, db }) => {
    const a = user(1, "A"),
      b = user(2, "B");
    assert.equal(
      (await request("/api/characters/2/skills", { session: a.session }))
        .status,
      404,
    );
    assert.equal(
      (
        await request("/api/sync", {
          session: a.session,
          method: "POST",
          body: {},
          origin: "https://evil.invalid",
        })
      ).status,
      403,
    );
    const saved = await request("/api/documents", {
      session: a.session,
      method: "POST",
      body: {
        kind: "plan",
        name: "Private",
        body: [{ id: 1, level: 3 }],
        shared: false,
      },
    });
    const { id } = await saved.json();
    assert.equal(
      (await request("/api/documents/" + id, { session: b.session })).status,
      404,
    );
    await request("/api/documents/" + id, {
      session: a.session,
      method: "PATCH",
      body: { shared: true },
    });
    assert.equal(
      (await request("/api/documents/" + id, { session: b.session })).status,
      200,
    );
    assert.equal(
      (
        await request("/api/documents/" + id, {
          session: b.session,
          method: "DELETE",
          body: {},
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await request("/api/documents/" + id, {
          session: b.session,
          method: "PUT",
          body: {
            name: "Stolen edit",
            body: [{ id: 1, level: 5 }],
            shared: true,
          },
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await request("/api/documents/" + id, {
          session: a.session,
          method: "PUT",
          body: {
            name: "Updated plan",
            body: [{ id: 1, level: 4 }],
            shared: true,
          },
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await request("/api/admin/invites", {
          session: a.session,
          method: "POST",
          body: {},
        })
      ).status,
      403,
    );
    db.prepare("INSERT INTO snapshots VALUES(?,?,?,?,?,NULL)").run(
      2,
      "assets",
      JSON.stringify({
        items: [{ item_id: 42, type_id: 1, quantity: 2, root_location_id: 9 }],
        locations: { 9: "Secret base" },
      }),
      Date.now(),
      Date.now() + 1000,
    );
    const result = await (
      await request("/api/assets", { session: a.session })
    ).json();
    assert.equal(result.total, 0);
  }));
test("main cannot be removed and alt data is removed on unlink", () =>
  fixture(async ({ request, user, db }) => {
    const a = user(1, "A");
    assert.equal(
      (
        await request("/api/characters/1", {
          session: a.session,
          method: "DELETE",
          body: {},
        })
      ).status,
      400,
    );
    db.prepare("INSERT INTO characters VALUES(?,?,?,?,?,?,?,0)").run(
      3,
      a.uid,
      "Alt",
      "owner",
      "sealed",
      "[]",
      0,
    );
    db.prepare("INSERT INTO snapshots VALUES(?,?,?,?,?,NULL)").run(
      3,
      "skills",
      "{}",
      0,
      0,
    );
    assert.equal(
      (
        await request("/api/characters/3", {
          session: a.session,
          method: "DELETE",
          body: {},
        })
      ).status,
      200,
    );
    assert.equal(db.prepare("SELECT count(*) n FROM snapshots").get().n, 0);
  }));
test("invite-only registration, owner bootstrap and state replay prevention", () =>
  fixture(async ({ request, db, identity }) => {
    function flow(code, invite = null) {
      db.prepare("INSERT INTO oauth VALUES(?,?,?,?,?,?)").run(
        hash(code),
        hash("browser"),
        null,
        invite,
        "verifier",
        Date.now() + 10000,
      );
    }
    identity({
      id: 200,
      name: "New",
      owner: "hash",
      expires: Date.now() + 100000,
      scopes: [],
    });
    flow("notinvited");
    assert.equal(
      (
        await request("/auth/callback?state=notinvited&code=x", {
          cookie: "tools_oauth=browser",
        })
      ).status,
      403,
    );
    db.prepare("INSERT INTO invites VALUES(?,?,?,NULL)").run(
      hash("invite"),
      null,
      Date.now() + 10000,
    );
    flow("invited", hash("invite"));
    assert.equal(
      (
        await request("/auth/callback?state=invited&code=x", {
          cookie: "tools_oauth=browser",
        })
      ).status,
      302,
    );
    assert.ok(db.prepare("SELECT used_by FROM invites").get().used_by);
    assert.equal(
      (
        await request("/auth/callback?state=invited&code=x", {
          cookie: "tools_oauth=browser",
        })
      ).status,
      400,
    );
    identity({
      id: 100,
      name: "Owner",
      owner: "hash-owner",
      expires: Date.now() + 100000,
      scopes: [],
    });
    flow("owner");
    assert.equal(
      (
        await request("/auth/callback?state=owner&code=x", {
          cookie: "tools_oauth=browser",
        })
      ).status,
      302,
    );
    assert.equal(
      db.prepare("SELECT admin FROM users WHERE main_id=100").get().admin,
      1,
    );
  }));
test("alt cannot be attached to another account and linking session must match", () =>
  fixture(async ({ request, user, db, identity }) => {
    const a = user(1, "A"),
      b = user(2, "B");
    identity({
      id: 2,
      name: "B",
      owner: "owner-2",
      expires: Date.now() + 10000,
      scopes: [],
    });
    db.prepare("INSERT INTO oauth VALUES(?,?,?,?,?,?)").run(
      hash("link"),
      hash("browser"),
      a.uid,
      null,
      "v",
      Date.now() + 10000,
    );
    const r = await request("/auth/callback?state=link&code=x", {
      cookie: "tools_oauth=browser; tools_session=" + a.session,
    });
    assert.equal(r.status, 409);
    assert.equal(
      db.prepare("SELECT user_id FROM characters WHERE id=2").get().user_id,
      b.uid,
    );
  }));
test("sync keeps previous complete data when a source fails", () =>
  fixture(async ({ db, user }) => {
    const a = user(1, "A");
    db.prepare("INSERT INTO snapshots VALUES(?,?,?,?,?,NULL)").run(
      1,
      "assets",
      JSON.stringify({ items: [{ item_id: 1 }], locations: {} }),
      1,
      1,
    );
    const svc = syncService(
      db,
      {
        get: async () => {
          throw Error("outage");
        },
        request: async () => {
          throw Error("outage");
        },
      },
      fakeCat,
    );
    svc.queue(a.uid);
    await svc.tick();
    assert.equal(
      JSON.parse(
        db.prepare("SELECT data FROM snapshots WHERE kind='assets'").get().data,
      ).items.length,
      1,
    );
    assert.equal(db.prepare("SELECT count(*) n FROM sync_errors").get().n, 6);
  }));
test("PI identifies launchpads and flags factory capacity as estimates", () => {
  const cat = {
    type: (id) => ({ name: "Item " + id, group_id: id === 5 ? 1030 : 0 }),
    schematic: () => null,
  };
  const result = piSummary(
    [
      {
        pins: [
          { pin_id: 7, type_id: 5, contents: [{ type_id: 8, amount: 100 }] },
          {
            pin_id: 9,
            type_id: 6,
            expiry_time: "2000-01-01",
            extractor_details: {
              product_type_id: 8,
              qty_per_cycle: 10,
              cycle_time: 60,
            },
          },
        ],
      },
    ],
    cat,
  );
  assert.equal(result[0].launchpads[0].contents[0].amount, 100);
  assert.equal(result[0].production[0].perHour, 0);
});
test("official catalogue resolves an Avatar plan and rejects unknown fitting items", () => {
  const cat = catalog("data");
  try {
    const fit = parseFitting("[Avatar, Test]\nDamage Control II", cat);
    assert.ok(fit.requirements.length > 5);
    assert.ok(fit.requirements.every((r) => cat.type(r.id).category_id === 16));
    assert.throws(() => parseFitting("[Avatar, Bad]\nImaginary Module", cat));
  } finally {
    cat.close();
  }
});

test("paginated assets publish only after every page succeeds", () =>
  fixture(async ({ db, user }) => {
    const a = user(1, "A");
    let failing = true;
    const eve = {
      get: async (path) => {
        throw Error("unavailable");
      },
      publicGet: async () => ({ name: "Station" }),
      request: async (path) => {
        if (path.includes("page=2") && failing) throw Error("outage");
        return {
          pages: 2,
          data: [
            {
              item_id: path.includes("page=2") ? 2 : 1,
              type_id: 1,
              location_id: 60000001,
              quantity: 1,
            },
          ],
        };
      },
    };
    const svc = syncService(db, eve, fakeCat);
    svc.queue(a.uid);
    await svc.tick();
    assert.equal(
      db.prepare("SELECT count(*) n FROM snapshots WHERE kind='assets'").get()
        .n,
      0,
    );
    failing = false;
    svc.queue(a.uid);
    await svc.tick();
    const data = JSON.parse(
      db.prepare("SELECT data FROM snapshots WHERE kind='assets'").get().data,
    );
    assert.equal(data.items.length, 2);
    assert.equal(data.locations[60000001], "Station");
  }));

test("queue separates active training and ignores completed entries", async () => {
  const { splitQueue, skillGroups } = await import("../public/view-models.mjs");
  const q = [
    { queue_position: 0, start_date: "2026-01-01", finish_date: "2026-01-02" },
    { queue_position: 1, start_date: "2026-01-02", finish_date: "2026-01-04" },
    { queue_position: 2, start_date: "2026-01-04", finish_date: "2026-01-05" },
  ];
  const result = splitQueue(q, Date.parse("2026-01-03"));
  assert.equal(result.current, q[1]);
  assert.deepEqual(result.waiting, [q[2]]);
  assert.equal(splitQueue([{ queue_position: 0 }]).current, undefined);
  assert.deepEqual(
    skillGroups([
      { name: "B", group: "Shield" },
      { name: "A", group: "Armor" },
    ]).map((g) => g.name),
    ["Armor", "Shield"],
  );
});
test("PI combines final output and launchpad stock without intermediate products", () => {
  const cat = {
    type: (id) => ({ name: String(id), group_id: id === 99 ? 1030 : 0 }),
    schematic: (id) =>
      id === 1
        ? {
            cycleTime: 3600,
            types: [
              { _key: 10, isInput: true, quantity: 40 },
              { _key: 20, isInput: false, quantity: 5 },
            ],
          }
        : null,
  };
  const [p] = piSummary(
    [
      {
        pins: [
          {
            extractor_details: {
              product_type_id: 10,
              cycle_time: 1800,
              qty_per_cycle: 100,
            },
            expiry_time: "2026-01-01",
          },
          { schematic_id: 1 },
          { schematic_id: 1 },
          { type_id: 99, contents: [{ type_id: 20, amount: 300 }] },
        ],
      },
    ],
    cat,
    Date.parse("2026-01-02"),
  );
  assert.deepEqual(p.finalProducts, [
    { type_id: 20, name: "20", perHour: 10, stored: 300 },
  ]);
  assert.equal(p.status, "Extractors stopped");
  assert.equal(p.resetAt, "2026-01-01");
  const [factory] = piSummary([{ pins: [{ schematic_id: 1 }] }], cat);
  assert.equal(factory.resetAt, null);
  assert.equal(factory.status, "Production status unknown");
});

test("asset grouping keeps a station together and respects character ownership", () =>
  fixture(async ({ db, user, request }) => {
    const owner = user(100, "Owner"),
      other = user(200, "Other");
    for (const id of [100, 200])
      db.prepare("INSERT INTO snapshots VALUES(?,?,?,?,?,NULL)").run(
        id,
        "assets",
        JSON.stringify({
          items: Array.from({ length: 125 }, (_, i) => ({
            item_id: i,
            type_id: 1,
            quantity: 1,
            location_id: 6001,
            root_location_id: 6001,
            location_flag: "Hangar",
          })),
          locations: { 6001: "Station" },
        }),
        Date.now(),
        Date.now() + 60000,
      );
    const result = await (
      await request("/api/assets", { session: owner.session })
    ).json();
    assert.equal(result.total, 125);
    assert.equal(result.locationCount, 1);
    assert.equal(result.locations[0].items.length, 125);
    assert.ok(result.locations[0].items.every((i) => i.character_id === 100));
    const filtered = await (
      await request("/api/assets?location=missing", { session: owner.session })
    ).json();
    assert.equal(filtered.locations.length, 0);
  }));

test("character order is main-first, persistent and shared with operations", () =>
  fixture(async ({ db, user, request }) => {
    const owner = user(500, "Z Main"),
      outsider = user(900, "Other");
    const add = (id, name) =>
      db
        .prepare("INSERT INTO characters VALUES(?,?,?,?,?,?,?,0)")
        .run(id, owner.uid, name, "owner", "unused", "[]", 0);
    add(700, "Z Alt");
    add(600, "A Alt");
    const list = async (path) =>
      (await (await request(path, { session: owner.session })).json()).map(
        (c) => c.id,
      );
    assert.deepEqual(await list("/api/characters"), [500, 700, 600]);
    assert.equal(
      (
        await request("/api/characters/order", {
          session: owner.session,
          method: "POST",
          body: { ids: [500, 600, 700] },
        })
      ).status,
      200,
    );
    assert.deepEqual(await list("/api/operations/pi"), [500, 600, 700]);
    assert.deepEqual(await list("/api/operations/dens"), [500, 600, 700]);
    assert.equal(
      (
        await request("/api/characters/order", {
          session: owner.session,
          method: "POST",
          body: { ids: [600, 500, 700] },
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await request("/api/characters/order", {
          session: owner.session,
          method: "POST",
          body: { ids: [500, 900, 700] },
        })
      ).status,
      400,
    );
    add(800, "New Alt");
    assert.deepEqual(await list("/api/characters"), [500, 600, 700, 800]);
  }));
test("manual sync targets owned character and refreshes fresh snapshots", () =>
  fixture(async ({ db, user, request }) => {
    const a = user(100, "A"),
      b = user(200, "B");
    for (const id of [100, 200])
      db.prepare("INSERT INTO snapshots VALUES(?,?,?,?,?,NULL)").run(
        id,
        "skills",
        "{}",
        Date.now(),
        Date.now() + 3600000,
      );
    assert.notEqual(
      (
        await request("/api/characters/200/sync", {
          session: a.session,
          method: "POST",
          body: {},
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await request("/api/characters/100/sync", {
          session: a.session,
          method: "POST",
          body: {},
        })
      ).status,
      200,
    );
    assert.equal(
      db.prepare("SELECT expires FROM snapshots WHERE character_id=100").get()
        .expires,
      0,
    );
    assert.ok(
      db.prepare("SELECT expires FROM snapshots WHERE character_id=200").get()
        .expires > Date.now(),
    );
    assert.deepEqual(
      db
        .prepare("SELECT character_id FROM jobs")
        .all()
        .map((r) => r.character_id),
      [100],
    );
  }));

test("industry sync requires permission and publishes all blueprint pages atomically", () =>
  fixture(async ({ db, user, request }) => {
    const a = user(100, "Industrialist"),
      b = user(200, "Other");
    let failing = true,
      industryCalls = 0;
    const eve = {
      get: async (path) => {
        if (path.includes("industry/jobs")) {
          industryCalls++;
          return [
            {
              job_id: 1,
              blueprint_type_id: 1,
              station_id: 60000001,
              status: "active",
              runs: 10,
            },
          ];
        }
        throw Error("unused");
      },
      publicGet: async () => ({ name: "Factory" }),
      request: async (path) => {
        if (!path.includes("blueprints")) throw Error("unused");
        if (path.endsWith("page=2") && failing) throw Error("page failure");
        return {
          pages: 2,
          data: [
            {
              item_id: path.endsWith("page=2") ? 2 : 1,
              type_id: 1,
              location_id: 60000001,
              quantity: -2,
              runs: 5,
              material_efficiency: 10,
              time_efficiency: 20,
            },
          ],
        };
      },
    };
    const svc = syncService(db, eve, fakeCat);
    svc.queue(a.uid);
    await svc.tick();
    assert.equal(industryCalls, 0);
    assert.match(
      db.prepare("SELECT message FROM sync_errors WHERE kind='industry'").get()
        .message,
      /Reconnect/,
    );
    db.prepare("UPDATE characters SET scopes=? WHERE id=100").run(
      JSON.stringify([
        "esi-industry.read_character_jobs.v1",
        "esi-characters.read_blueprints.v1",
      ]),
    );
    svc.queue(a.uid);
    await svc.tick();
    assert.equal(
      db.prepare("SELECT count(*) n FROM snapshots WHERE kind='industry'").get()
        .n,
      0,
    );
    failing = false;
    svc.queue(a.uid);
    await svc.tick();
    const data = JSON.parse(
      db.prepare("SELECT data FROM snapshots WHERE kind='industry'").get().data,
    );
    assert.equal(data.blueprints.length, 2);
    assert.equal(data.jobs.length, 1);
    assert.equal(data.blueprints[0].location, "Factory");
    const own = await (
      await request("/api/operations/industry", { session: a.session })
    ).json();
    assert.equal(own[0].data.jobs.length, 1);
    const other = await (
      await request("/api/operations/industry", { session: b.session })
    ).json();
    assert.equal(other[0].data, null);
  }));

test("fitting view groups modules, loaded charges, drones and cargo",async()=>{
 const {fittingView}=await import("../lib/fitting-view.mjs");
 const cat=catalog("data");
 try {
 const fit=fittingView("[Rifter, Test]\nDamage Control II\n[Empty Low slot]\n1MN Afterburner II\n200mm AutoCannon II, EMP S\nSmall Projectile Burst Aerator I\n\nWarrior II x2\nEMP S x1000",cat);
 assert.equal(fit.ship.name,"Rifter");
 assert.equal(fit.groups.find(g=>g.name==="Low slots").items.length,2);
 assert.equal(fit.groups.find(g=>g.name==="High slots").items[0].charges[0].name,"EMP S");
 assert.equal(fit.groups.find(g=>g.name==="Drones").items[0].quantity,2);
 assert.equal(fit.groups.find(g=>g.name==="Cargo").items[0].quantity,1000);
 }finally{cat.close();}
});

test("training overview exposes only owned characters and compact skill data",()=>fixture(async({db,user,request})=>{
 const a=user(100,"Main"),b=user(200,"Other");
 db.prepare("INSERT INTO snapshots VALUES(?,?,?,?,?,NULL)").run(100,"skills",JSON.stringify({skills:{total_sp:12345,skills:[{skill_id:1}]},queue:[{skill_id:1,queue_position:0}]}),Date.now(),Date.now()+3600000);
 const result=await(await request("/api/skills/overview",{session:a.session})).json();
 assert.equal(result.length,1);assert.equal(result[0].id,100);assert.equal(result[0].total_sp,12345);assert.equal(result[0].queue.length,1);assert.equal(result[0].skills,undefined);
 const other=await(await request("/api/skills/overview",{session:b.session})).json();assert.equal(other[0].total_sp,null);
}));

test("clones calculate cooldown, sort locations and preserve implants",()=>fixture(async({db,user})=>{
 const a=user(100,"Main");db.prepare("UPDATE characters SET scopes=? WHERE id=100").run(JSON.stringify(["esi-clones.read_clones.v1","esi-clones.read_implants.v1"]));
 const eve={get:async path=>{
 if(path.endsWith("/clones"))return {last_clone_jump_date:"2026-10-18T00:00:00Z",jump_clones:[{jump_clone_id:1,name:"Combat",location_id:2,location_type:"station",implants:[1]},{jump_clone_id:2,name:"Training",location_id:1,location_type:"station",implants:[]}]};
 if(path.endsWith("/implants"))return [1];
 if(path.endsWith("/skills"))return {skills:[{skill_id:33399,active_skill_level:5}]};
 throw Error("unused");},publicGet:async path=>({name:path.endsWith("/1")?"Alpha":"Zulu"}),request:async()=>{throw Error("unused");}};
 const svc=syncService(db,eve,fakeCat);svc.queue(a.uid);await svc.tick();
 const result=JSON.parse(db.prepare("SELECT data FROM snapshots WHERE kind='clones'").get().data);
 assert.equal(result.ready_at,"2026-10-18T19:00:00.000Z");assert.deepEqual(result.clones.map(c=>c.location),["Alpha","Zulu"]);assert.equal(result.active_implants.length,1);assert.equal(result.clones[1].implants.length,1);
}));
