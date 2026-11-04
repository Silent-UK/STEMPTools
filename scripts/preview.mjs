import {CORP_SCOPES} from '../lib/corp.mjs';
import {SCOPES} from '../lib/eve.mjs';
import {pilotAccess} from '../lib/corp-data.mjs';
// Local UI review only. Uses an isolated temporary database with fictional data.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import http from "node:http";
import { openStore } from "../lib/store.mjs";
import { catalog } from "../lib/catalog.mjs";
import { hash,cryptoBox } from "../lib/security.mjs";
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
        anarchy: { level: "Level1", amount: 36 },
        development: { level: "Level3", amount: 74 },
      },
      operations: id === 1000002 ? [] : [
        {
          state: "Available",
          expires: new Date(Date.now() + 8*3600000).toISOString(),
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
  const industry={jobs:[{job_id:id*10,name:"Rifter",product_type_id:587,blueprint_type_id:688,activity_id:1,runs:3,cost:120000,status:"active",start_date:new Date(Date.now()-7200000).toISOString(),end_date:new Date(Date.now()+3600000).toISOString(),location:"Example trade hub"},{job_id:id*10+1,name:"Rifter Blueprint",blueprint_type_id:688,activity_id:5,runs:10,status:id===1000003?'paused':'active',start_date:new Date(Date.now()-86400000).toISOString(),end_date:new Date(Date.now()-3600000).toISOString(),location:"Example Citadel"}],blueprints:[]};
  const mining={started_at:Date.now()-29*86400000,rows:Array.from({length:24},(_,i)=>({date:new Date(Date.now()-i*86400000).toISOString().slice(0,10),type_id:1230,name:'Veldspar',solar_system_id:30000142,system:i%3?'Jita':'Amarr',quantity:Math.round((Math.sin(i*1.6)+1.4)*120000),volume_m3:Math.round((Math.sin(i*1.6)+1.4)*12000)}))};
  for (const [kind, data] of Object.entries({ skills, pi, dens, assets, wallet, clones, industry, mining }))
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
db.prepare("INSERT INTO corp_authorizations VALUES(1,1000001,'Example Main','preview',668298004,?,?,?,'Director',?)").run(cryptoBox("ab".repeat(32)).seal({access_token:"preview"}),JSON.stringify(["esi-characters.read_corporation_roles.v1"]),Date.now()+3600000,Date.now());
const corpExample={id:123,type_id:81826,type_name:"Metenox Moon Drill",kind:"Moon Drill",name:"Example Moon Drill",system:"U54-1L",region:"Tribute",state:"shield_vulnerable",timer:null,reinforce_hour:19,services:[{name:"Metenox Moon Drill",state:"online"}],fuel_expires:null,fuel:720,gas:28000,rate:5,gas_rate:200,mining:"online",inventory_at:Date.now(),materials:[{type_id:16634,name:"Titanium",quantity:85000},{type_id:16640,name:"Cadmium",quantity:28000}],history:[{from:Date.now()-90000000,to:Date.now()-86400000,emptied:true,items:[{type_id:16634,name:"Titanium",quantity:170000}]}]};
db.prepare("INSERT INTO corp_snapshots VALUES(668298004,?,?)").run(JSON.stringify([corpExample,{...corpExample,id:124,type_id:35833,type_name:"Fortizar",kind:"Structure",name:"Example Citadel",gas:null,gas_rate:null,rate:18,fuel:12960,fuel_expires:new Date(Date.now()+720*3600000).toISOString(),materials:[],history:[],services:[{name:"Cloning",state:"online"}],timer:new Date(Date.now()+86400000).toISOString(),state:"armor_reinforce"},{...corpExample,id:125,type_id:16213,type_name:"Caldari Control Tower",kind:"POS",name:"Example POS · Moon IV",rate:40,fuel:9600,gas:null,gas_rate:null,services:null,state:"online",materials:[],history:[],fuels:[{type_id:4051,name:"Nitrogen Fuel Block",quantity:9600},{type_id:16275,name:"Strontium Clathrates",quantity:3000}]}]),Date.now());
const extractionExample={structure_id:126,moon_id:40018857,extraction_start_time:new Date(Date.now()-5*86400000).toISOString(),chunk_arrival_time:new Date(Date.now()+2*86400000+3*3600000).toISOString(),natural_decay_time:new Date(Date.now()+4*86400000).toISOString()};
db.prepare('INSERT INTO public_cache VALUES(?,?,?)').run('/tools/moon-extractions',JSON.stringify({rows:[extractionExample],updated:Date.now(),error:null}),0);
const savedCorp=JSON.parse(db.prepare('SELECT data FROM corp_snapshots WHERE corporation_id=668298004').get().data);
savedCorp.push({...corpExample,id:126,type_id:35835,type_name:'Athanor',kind:'Structure',name:'Example Athanor',system:'LS9B-9',materials:[]});
db.prepare('UPDATE corp_snapshots SET data=? WHERE corporation_id=668298004').run(JSON.stringify(savedCorp));
db.prepare('INSERT INTO public_cache VALUES(?,?,?)').run('/tools/corp-industry',JSON.stringify({updated:Date.now(),error:null,rows:[{job_id:1,product_type_id:587,blueprint_type_id:688,name:'Rifter',activity_id:1,runs:20,installer:'Example Main',location:'Example Citadel',status:'active',end_date:new Date(Date.now()+9000000).toISOString()},{job_id:2,blueprint_type_id:688,name:'Rifter Blueprint',activity_id:5,runs:10,installer:'Example Industrial',location:'Example Citadel',status:'ready',end_date:new Date(Date.now()-900000).toISOString()},{job_id:3,product_type_id:587,blueprint_type_id:688,name:'Rifter',activity_id:1,runs:5,installer:'Example Main',location:'Example Citadel',status:'paused',end_date:new Date(Date.now()-900000).toISOString()}]}),0);
db.prepare('UPDATE character_groups SET parent_id=1000001 WHERE character_id=1000003').run();
db.prepare('INSERT INTO documents VALUES(?,?,?,?,?,?,?)').run('preview-fitting',1,'fitting','Preview Rifter',JSON.stringify('[Rifter, Preview Rifter]'),0,Date.now());
// Sample data for management and market UI checks; never used by production.
db.prepare('UPDATE corp_authorizations SET scopes=?').run(JSON.stringify(CORP_SCOPES));
db.prepare('UPDATE characters SET scopes=?').run(JSON.stringify(SCOPES));
const now=Date.now(),divisions={hangar:[{division:1,name:'Fleet Ships'},{division:2,name:'Industry Stock'}],wallet:Array.from({length:7},(_,i)=>({division:i+1,name:i===0?'Master Wallet':'Division '+(i+1)}))};
const sampleRoles={roles:['Accountant'],roles_at_hq:['Hangar_Query_1','Hangar_Take_1'],grantable_roles:['Account_Take_2']};
const samplePilots=[{id:1000001,name:'Example Main',joined:'2020-05-01T12:00:00Z',last_login:new Date(now-7200000).toISOString(),ship:'Rifter',location:'Example Citadel',signed_up:true,titles:[{id:1,name:'<color=0xff00ff00>STEMP Member<color=0xff808080>'}],direct_roles:sampleRoles,rights:pilotAccess(sampleRoles,[{roles:['Account_Take_2']}],divisions)},{id:1000010,name:'Example Director',joined:'2018-01-01T12:00:00Z',last_login:new Date(now-86400000).toISOString(),ship:'Avatar',location:'Example Citadel',signed_up:false,titles:[{id:2,name:'Director'}],direct_roles:{roles:['Director']},rights:pilotAccess({roles:['Director']},[],divisions)}];
const cache=(name,data)=>db.prepare('INSERT OR REPLACE INTO public_cache VALUES(?,?,?)').run('/tools/corp-data/'+name,JSON.stringify({...data,updated:now,error:null}),now+3600000);
cache('pilots',{rows:samplePilots,divisions,warnings:[]});
cache('assets',{rows:[{item_id:9001,type_id:587,name:'Rifter',location_id:124,root_location_id:124,location:'Example Citadel',location_flag:'CorpSAG1',quantity:1,is_singleton:true},{item_id:9002,type_id:2048,name:'Damage Control II',location_id:9001,root_location_id:124,location:'Example Citadel',location_flag:'LoSlot0',quantity:1},{item_id:9003,type_id:34,name:'Tritanium',location_id:124,root_location_id:124,location:'Example Citadel',location_flag:'CorpSAG2',quantity:1000000}],locations:{124:'Example Citadel'}});
cache('wallet',{rows:divisions.wallet.map(d=>({...d,balance:d.division*123456789,journal:[{id:d.division,date:new Date(now-3600000).toISOString(),amount:1000000,balance:d.division*123456789,ref_type:'bounty_prize_corporation_tax',first_party_id:1000001,second_party_id:668298004}],transactions:[{transaction_id:d.division,date:new Date(now-7200000).toISOString(),quantity:10,unit_price:800000,is_buy:true,type_id:587,name:'Rifter',client_id:1000001}]})),names:{1000001:'Example Main',668298004:'Sacred Templars'},warnings:[],started_at:now});
const marketOrder={order_id:1,type_id:587,name:'Rifter',price:800000,volume_remain:10,volume_total:20,is_buy_order:true,issued:new Date(now-86400000).toISOString(),location_id:60003760,status:'active'};
db.prepare('INSERT OR REPLACE INTO snapshots VALUES(?,?,?,?,?,NULL)').run(1000001,'market',JSON.stringify({active:[marketOrder,{...marketOrder,order_id:2,is_buy_order:false,price:950000}],history:[{...marketOrder,order_id:3,volume_remain:0,status:'fulfilled'},{...marketOrder,order_id:4,volume_remain:3,status:'cancelled'}],locations:{60003760:'Jita IV - Moon 4'},started_at:now}),now,now+3600000);
for(const [uid,id,name] of [[2,1000011,'Example Logistics Pilot'],[3,1000012,'Example Recruit'],[4,1000013,'Example Industry Manager']]){
 db.prepare('INSERT INTO users VALUES(?,?,?,0)').run(uid,id,name);
 db.prepare("INSERT INTO characters VALUES(?,?,?,?,?,?,?,0)").run(id,uid,name,'preview','unused',JSON.stringify(SCOPES),now+3600000);
 db.prepare('INSERT INTO user_logins VALUES(?,?)').run(uid,now-uid*3600000);
}
db.prepare('INSERT INTO characters VALUES(?,?,?,?,?,?,?,0)').run(1000014,2,'Example Logistics Alt','preview','unused',JSON.stringify(SCOPES),now+3600000);
db.prepare("INSERT INTO sync_errors VALUES(1000014,'skills','Sample refresh issue — previous data retained.')").run();
db.prepare('UPDATE characters SET reconnect=1 WHERE id=1000014').run();
db.prepare('UPDATE characters SET scopes=? WHERE id=1000003').run(JSON.stringify(SCOPES.filter(s=>s!=='esi-characters.read_titles.v1')));
for(const [id,amount] of [[1000001,1000000],[1000002,2000000],[1000003,3000000]])db.prepare('INSERT OR REPLACE INTO snapshots VALUES(?,?,?,?,?,NULL)').run(id,'wallet-history',JSON.stringify({journal:[{id,date:new Date().toISOString(),ref_type:'bounty_prizes',amount}],transactions:[],names:{},started_at:Date.now()}),Date.now(),Date.now()+3600000);
// Fictional examples for the held corporation, LP, standings and materials features.
const blueprint={item_id:900001,type_id:691,name:cat.type(691).name,quantity:-2,runs:100,material_efficiency:10,time_efficiency:20,location_id:60003760};
for(const character of [1000001,1000002,1000003]){
 const snap=(kind,data)=>db.prepare('INSERT OR REPLACE INTO snapshots VALUES(?,?,?,?,?,NULL)').run(character,kind,JSON.stringify(data),now,now+3600000);
 snap('standings',{rows:[{from_id:1000035,name:'Caldari Navy',from_type:'npc_corp',standing:7.2},{from_id:500004,name:'Gallente Federation',from_type:'faction',standing:-1.5}]});
 snap('fatigue',{jump_fatigue_expire_date:new Date(now+3600000).toISOString(),last_jump_date:new Date(now-3600000).toISOString(),last_update_date:new Date(now-1000).toISOString()});
 snap('loyalty',{balances:[{corporation_id:1000035,corporation:'Caldari Navy',loyalty_points:120000}]});
 const row=db.prepare("SELECT data FROM snapshots WHERE character_id=? AND kind='industry'").get(character),industry=row?JSON.parse(row.data):{jobs:[]};industry.blueprints=[{...blueprint,item_id:900001+character}];snap('industry',industry);
 snap('assets',{items:[{item_id:character+9000000,type_id:38,quantity:1000,location_id:60003760}],locations:{60003760:'Example Station'}});
}
const miningDemoTypes=['Veldspar','Scordite','Plagioclase'].map((name,i)=>{const id=cat.named(name)||[1230,1228,18][i],type=cat.type(id);db.prepare('INSERT OR REPLACE INTO public_cache VALUES(?,?,?)').run('/tools/jita-sell/'+id,JSON.stringify({id,price:[15,30,85][i],updated:now}),now+3600000);return {id,name:type?.name||name,volume:type?.volume||.1};});
for(const [index,id] of [1000001,1000002,1000003].entries()){
 const rows=Array.from({length:12},(_,i)=>{const ore=miningDemoTypes[(i+index)%3],quantity=10000*(index+1)+i*500;return {date:new Date(now-i*86400000).toISOString().slice(0,10),type_id:ore.id,name:ore.name,quantity,volume_m3:quantity*ore.volume,solar_system_id:i%2?30000142:30002187,system:i%2?'Example Trade System':'Example Mining System'};});
 db.prepare('INSERT OR REPLACE INTO snapshots VALUES(?,?,?,?,?,NULL)').run(id,'mining',JSON.stringify({rows,started_at:now-30*86400000}),now,now+3600000);
}
const npcDemo=cat.named('Dread Guristas Killer')||13575;
for(const [index,id] of [1000001,1000002,1000003].entries()){
 const journal=Array.from({length:12},(_,i)=>({id:70000+index*100+i,date:new Date(now-i*86400000-index*3600000).toISOString(),ref_type:i%4===0?'ess_escrow_transfer':'bounty_prizes',amount:(index+1)*15000000+i*1750000,description:i%4===0?'ESS payment':'Bounty prizes for pirates in Example System',reason:i%4===0?'':npcDemo+': '+(i+1)+(i===5?',truncated...':''),context_id_type:'system_id',context_id:30000142}));
 db.prepare('INSERT OR REPLACE INTO snapshots VALUES(?,?,?,?,?,NULL)').run(id,'wallet-history',JSON.stringify({journal,transactions:[],names:{},started_at:now-30*86400000}),now,now+3600000);
}
const demoContracts={contracts:[
 {contract_id:101,title:'Doctrine ship delivery',type:'courier',status:'in_progress',availability:'personal',issuer_id:1000001,assignee_id:1000002,acceptor_id:1000002,reward:15000000,collateral:250000000,volume:60000,date_issued:new Date(now-4*86400000).toISOString(),date_accepted:new Date(now-3*86400000).toISOString(),days_to_complete:2,date_expired:new Date(now+86400000).toISOString(),start_location_id:60003760,end_location_id:60000001,observed:now},
 {contract_id:102,title:'Replacement ships',type:'item_exchange',status:'outstanding',availability:'personal',issuer_id:1000002,assignee_id:1000001,price:45000000,date_issued:new Date(now-86400000).toISOString(),date_expired:new Date(now+12*3600000).toISOString(),start_location_id:60003760,items:[{type_id:587,name:'Rifter',quantity:3,is_included:true}],observed:now},
 {contract_id:103,title:'Completed equipment transfer',type:'item_exchange',status:'finished',availability:'public',issuer_id:1000001,assignee_id:0,acceptor_id:1000003,price:1000000,date_issued:new Date(now-7*86400000).toISOString(),date_completed:new Date(now-6*86400000).toISOString(),observed:now}
],names:{1000001:'Example Main',1000002:'Example Industrial',1000003:'Example Scout'},locations:{60003760:'Example Trade Station',60000001:'Example Industry Station'}};
for(const id of [1000001,1000002])db.prepare('INSERT OR REPLACE INTO snapshots VALUES(?,?,?,?,?,NULL)').run(id,'contracts',JSON.stringify(demoContracts),now,now+3600000);
const seedCorp=(key,data)=>db.prepare('INSERT OR REPLACE INTO public_cache VALUES(?,?,?)').run('/tools/corp-data/'+key,JSON.stringify({...data,updated:now,error:null}),now+3600000);
seedCorp('blueprints-v2',{rows:[{...blueprint,location:'Example Trade Station',root_location_id:60003760},{...blueprint,item_id:900002,quantity:-1,runs:-1,location:'Example Trade Station',root_location_id:60003760},{...blueprint,item_id:900003,location_id:60000001,root_location_id:60000001,location:'Example Industry Station',name:'Production Copy Blueprint'}]});
seedCorp('standings',{rows:[{from_id:1000035,name:'Caldari Navy',from_type:'npc_corp',standing:4.8},{from_id:500004,name:'Gallente Federation',from_type:'faction',standing:-2}]});
seedCorp('contracts',{contracts:[{contract_id:1,title:'Doctrine ship delivery',type:'courier',status:'outstanding',issuer_id:1000001,assignee_id:1000002,reward:10000000,collateral:100000000,date_issued:new Date(now-86400000).toISOString(),date_expired:new Date(now+3*86400000).toISOString(),start_location_id:60003760,end_location_id:60003760,observed:now}],names:{1000001:'Example Main',1000002:'Example Industrial'},locations:{60003760:'Example Station'}});
seedCorp('market',{active:[{order_id:1,type_id:34,name:'Tritanium',is_buy_order:true,volume_remain:500000,volume_total:1000000,price:4.5,location_id:60003760,issued:new Date(now-86400000).toISOString(),status:'active'}],history:[{order_id:2,type_id:587,name:'Rifter',is_buy_order:false,volume_remain:0,volume_total:10,price:500000,location_id:60003760,issued:new Date(now-7*86400000).toISOString(),status:'fulfilled',state:'expired'}],locations:{60003760:'Example Station'}});
const { app } = createApp({
 corpNetwork:async url=>{const p=new URL(url).pathname;return new Response(JSON.stringify(p.endsWith('/members')?[1000001,1000002,1000003,1000011,1000014,1000099]:p.endsWith('/membertracking')?[1000001,1000002,1000003,1000011,1000014,1000099].map((id,i)=>({character_id:id,logon_date:new Date(Date.now()-i*3600000).toISOString(),location_id:124,ship_type_id:587})):[]),{headers:{'content-type':'application/json','cache-control':'max-age=3600'}});},
 membershipLookup:async()=>({corporation_id:668298004}),
  verifyCorporation:async()=>({id:668298004,role:"Director"}),
  db,
  cat,
  data: dir,
  base: "http://127.0.0.1:3014",
  key: "ab".repeat(32),
  owner: 1000001,
  eve: {get:async path=>path.endsWith('/fittings')?[{fitting_id:1,name:'Preview Saved Rifter',description:'Example saved in-game fitting',ship_type_id:587,items:[{type_id:2048,flag:'LoSlot0',quantity:1}]}]:[],publicGet:async path=>path==="/markets/prices"?[{type_id:16634,average_price:1200},{type_id:16640,average_price:8000}]:{},request:async(path,character,method,body)=>{if(path==='/characters/affiliation')return {pages:1,data:body.map(id=>({character_id:id,corporation_id:668298004}))};if(path==='/universe/names')return {data:body.map(id=>({id,name:id===668298004?'Sacred Templars':'Example '+id}))};const type=Number(new URL('https://esi.evetech.net'+path).searchParams.get('type_id'));return {pages:1,expires:Date.now()+3600000,data:[{type_id:type,location_id:60003760,is_buy_order:false,volume_remain:10000,price:type===9848?85000:1500000}]};}},
});
{
 db.prepare('INSERT INTO users VALUES(900,2000001,?,0)').run('Example Recruit');
 db.prepare("INSERT INTO characters VALUES(2000001,900,?,'preview','unused','[]',0,0)").run('Example Recruit');
 db.prepare('INSERT INTO recruitment_applications(user_id,created,consented) VALUES(900,?,?)').run(now,now);
 if(process.env.PREVIEW_INSPECT==='1')db.prepare('INSERT INTO inspections VALUES(?,900)').run(hash('local-preview'));
}
const server = http.createServer((req, res) => {
  if(process.env.PREVIEW_RECRUIT==='1'){
    delete req.headers.cookie;
    if(req.url.startsWith('/auth/login?')){const url=new URL(req.url,'http://127.0.0.1:3014');res.writeHead(url.searchParams.get('recruit')==='1'&&url.searchParams.get('consent')==='1'?200:400,{'content-type':'text/html'});res.end('<h1>Test EVE sign-in reached</h1><p>Local preview only. No EVE account was contacted or created.</p>');return;}
  }else req.headers.cookie = "tools_session=local-preview";
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
