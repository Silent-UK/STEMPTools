// Local UI review only. Uses an isolated temporary database with fictional data.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import http from "node:http";
import { openStore } from "../lib/store.mjs";
import { catalog } from "../lib/catalog.mjs";
import { hash } from "../lib/security.mjs";
import { createApp } from "../server.mjs";
const dir = mkdtempSync(join(tmpdir(), "tools-preview-")),
  db = openStore(dir),
  cat = catalog("data");
db.prepare("INSERT INTO users VALUES(1,1000001,?,1)").run(
  "Preview workspace · sample data",
);
for (const [id, name] of [
  [1000001, "Example Main"],
  [1000002, "Example Industrial"],
  [1000003, "Example Scout"],
]) {
  db.prepare("INSERT INTO characters VALUES(?,1,?,?,?, ?,?,0)").run(
    id,
    name,
    "preview",
    "unused",
    "[]",
    0,
  );
  const skills = {
    skills: {
      total_sp: 42670450,
      skills: [
        {
          skill_id: 3300,
          trained_skill_level: 5,
          active_skill_level: 5,
          skillpoints_in_skill: 256000,
        },
        {
          skill_id: 3327,
          trained_skill_level: 4,
          active_skill_level: 4,
          skillpoints_in_skill: 90510,
        },
      ],
    },
    queue: [
      {
        skill_id: 3327,
        queue_position: 0,
        finished_level: 5,
        start_date: new Date().toISOString(),
        finish_date: new Date(Date.now() + 86400000).toISOString(),
      },
    ],
    attributes: {
      intelligence: 24,
      memory: 24,
      perception: 27,
      willpower: 21,
      charisma: 17,
    },
  };
  const pi = [
    {
      planet_id: 40000001,
      info: { name: "Example system IV" },
      planet_type: "temperate",
      upgrade_level: 5,
      num_pins: 18,
      pins: [
        {
          pin_id: 1,
          type_id: 2256,
          extractor_details: {
            product_type_id: 2268,
            qty_per_cycle: 4500,
            cycle_time: 1800,
          },
          expiry_time: new Date(Date.now() + 86400000).toISOString(),
        },
        { pin_id: 2, type_id: 2257, schematic_id: 65 },
      ],
    },
  ];
  const dens = [
    {
      id: 1000000000001,
      state: "Running",
      planet: { name: "Example system VI" },
      skyhook: { planet_id: 40000001 },
      infomorphs: { amount: 18200 },
      evolution: {
        anarchy: { level: "Level1", amount: 22 },
        development: { level: "Level3", amount: 74 },
      },
      operations: [
        {
          state: "Available",
          expires: new Date(Date.now() + 86400000).toISOString(),
          definition: { anarchyImpact: -20, developmentImpact: 10 },
        },
      ],
    },
  ];
  const assets = {
    items: [
      {
        item_id: id * 100,
        type_id: 587,
        quantity: 1,
        location_id: 60003760,
        root_location_id: 60003760,
        location_flag: "Hangar",
      },
      {
        item_id: id * 100 + 1,
        type_id: 34,
        quantity: 150000,
        location_id: 60003760,
        root_location_id: 60003760,
        location_flag: "Hangar",
      },
    ],
    locations: { 60003760: "Example trade hub" },
  };
  for (const [kind, data] of Object.entries({ skills, pi, dens, assets }))
    db.prepare("INSERT INTO snapshots VALUES(?,?,?,?,?,NULL)").run(
      id,
      kind,
      JSON.stringify(data),
      Date.now(),
      Date.now() + 3600000,
    );
}
db.prepare("INSERT INTO sessions VALUES(?,1,?)").run(
  hash("local-preview"),
  Date.now() + 3600000,
);
const { app } = createApp({
  db,
  cat,
  data: dir,
  base: "http://127.0.0.1:3014",
  key: "ab".repeat(32),
  owner: 1000001,
  eve: {},
});
const server = http.createServer((req, res) => {
  req.headers.cookie = "tools_session=local-preview";
  app(req, res);
});
server.listen(3014, "127.0.0.1", () =>
  console.log("Preview sample data: http://127.0.0.1:3014"),
);
function stop() {
  server.close(() => {
    db.close();
    cat.close();
    rmSync(dir, { recursive: true, force: true });
    process.exit();
  });
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
