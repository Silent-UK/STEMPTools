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
  const start=new Date(Date.now()-86400000).toISOString(),end=new Date(Date.now()+86400000).toISOString();
  const ex=(pin,id,qty)=>({pin_id:pin,type_id:2848,install_time:start,expiry_time:end,extractor_details:{product_type_id:id,qty_per_cycle:qty,cycle_time:1800}});
  const pad=(contents)=>({pin_id:90,type_id:2544,contents:contents.map(([type_id,amount])=>({type_id,amount}))});
  let factoryId=40;
  const factory=(schematic)=>({pin_id:factoryId++,type_id:2470,schematic_id:schematic,last_cycle_start:new Date().toISOString()});
  const pi=[
   {planet_id:40000001,solar_system_id:30000142,info:{name:'Example system I'},planet_type:'barren',pins:[ex(1,2267,9500),ex(2,2270,7200),factory(126),factory(127),factory(73),pad([[3689,805]])]},
   {planet_id:40000002,solar_system_id:30000142,info:{name:'Example system II'},planet_type:'lava',pins:[ex(1,2272,8000),ex(2,2306,6000),factory(128),factory(129),factory(76),pad([[9836,750]])]},
   {planet_id:40000003,solar_system_id:30000142,info:{name:'Example system III'},planet_type:'barren',pins:[ex(1,2267,7500),factory(126),pad([[2398,800]])]},
   {planet_id:40000004,solar_system_id:30000142,info:{name:'Example system IV'},planet_type:'gas',pins:[ex(1,2267,6800),pad([[2267,100000]])]},
   {planet_id:40000005,solar_system_id:30000142,info:{name:'Example system V'},planet_type:'temperate',pins:[factory(97),pad([[9848,24],[3689,100],[9836,90]])]},
   {planet_id:40000006,solar_system_id:30000142,info:{name:'Example system VI'},planet_type:'temperate',pins:[factory(119),pad([[2876,10],[2349,60],[2358,54],[2367,72]])]}
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
  db.prepare("INSERT INTO character_groups VALUES(?,?) ON CONFLICT(character_id) DO UPDATE SET parent_id=excluded.parent_id").run(id,id);
  const wallet={balance:1234567890.12};
  const clones={capacity:10,ready_at:null,active_implants:[{id:9899,name:"Memory Augmentation - Standard"}],clones:[{name:"Combat",location_id:60003760,location:"Example trade hub",implants:[{id:9899,name:"Memory Augmentation - Standard"}]}]};
  const industry={jobs:[{name:"Rifter",product_type_id:587,blueprint_type_id:688,activity_id:1,runs:3,status:"active",end_date:new Date(Date.now()+3600000).toISOString(),location:"Example trade hub"}],blueprints:[]};
  for (const [kind, data] of Object.entries({ skills, pi, dens, assets, wallet, clones, industry }))
    db.prepare("INSERT INTO snapshots VALUES(?,?,?,?,?,NULL)").run(
      id,
      kind,
      JSON.stringify(data),
      Date.now(),
      Date.now() + 3600000,
    );
}
db.prepare("INSERT INTO pi_settings VALUES(1,?)").run(JSON.stringify({perfect:18000,critical:16000,targets:[9848,2876]}));
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
  eve: {request:async path=>{const type=Number(new URL('https://esi.evetech.net'+path).searchParams.get('type_id'));return {pages:1,expires:Date.now()+3600000,data:[{type_id:type,location_id:60003760,is_buy_order:false,volume_remain:10000,price:type===9848?85000:1500000}]};}},
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
