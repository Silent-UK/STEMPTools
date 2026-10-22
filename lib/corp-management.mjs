import {moonSurveyData,estimateExtraction} from './moon-surveys.mjs';
import {valueHarvest} from "./harvest.mjs";
import {CORE_CORP_SCOPES,MINING_SCOPE,STEMP_ID,verifyCorporation} from './corp.mjs';
import {exchange,verifyToken} from './eve.mjs';
import {transaction} from './store.mjs';
import {FUEL_BLOCKS,miningState,structureRate,moonHistory} from './corp-fuel.mjs';
const HOUR=3600000;
const denied=()=>Object.assign(Error('Sacred Templars CEO or Director access is required. Connect your corporation character again.'),{status:403});
export function corporationService(db,box,config,cat,eve) {
 const network=config.corpNetwork||fetch,locks=new Map(),checks=new Map();let busy=false,cooldown=0;
 async function token(row) {
  if(locks.has(row.user_id))return locks.get(row.user_id);
  const work=(async()=>{
   const current=db.prepare('SELECT * FROM corp_authorizations WHERE user_id=?').get(row.user_id);
   if(!current)throw denied();
   const saved=box.open(current.tokens);
   if(current.expires>Date.now()+60000)return saved.access_token;
   const next=await (config.exchange||exchange)(config,{grant_type:'refresh_token',refresh_token:saved.refresh_token});
   const id=await (config.verifyToken||verifyToken)(next.access_token,config.client,JSON.parse(current.scopes));
   if(id.id!==current.character_id||id.owner!==current.owner_hash)throw denied();
   if(!db.prepare('UPDATE corp_authorizations SET tokens=?,expires=? WHERE user_id=? AND tokens=?').run(box.seal({...next,refresh_token:next.refresh_token||saved.refresh_token}),id.expires,row.user_id,current.tokens).changes)throw denied();
   return next.access_token;
  })();locks.set(row.user_id,work);try{return await work;}finally{locks.delete(row.user_id);}
 }
 async function access(user,force=false) {
  const row=db.prepare('SELECT * FROM corp_authorizations WHERE user_id=?').get(user);
  if(!row||row.corporation_id!==STEMP_ID)return false;
  const saved=checks.get(user);
  if(!force&&saved?.until>Date.now()&&saved.character===row.character_id&&saved.verified===row.verified)return saved.ok;
  try {
   const corp=await (config.verifyCorporation||verifyCorporation)(await token(row),row.character_id,network);
   const current=db.prepare('SELECT * FROM corp_authorizations WHERE user_id=?').get(user);
   if(!current||current.character_id!==row.character_id||current.owner_hash!==row.owner_hash||current.corporation_id!==STEMP_ID)return false;
   const ok=corp.id===STEMP_ID&&['CEO','Director'].includes(corp.role);
   const at=Date.now();
   db.prepare('UPDATE corp_authorizations SET role=?,verified=? WHERE user_id=?').run(ok?corp.role:'Revoked',at,user);
   checks.set(user,{ok,until:at+300000,character:row.character_id,verified:at});return ok;
  }catch {
   checks.set(user,{ok:false,until:Date.now()+30000,character:row.character_id,verified:row.verified});return false;
  }
 }
 function connected(user) {checks.delete(user);queue();}
 async function request(path,row) {
  const hit=db.prepare('SELECT * FROM corp_http_cache WHERE character_id=? AND path=? AND expires>?').get(row.character_id,path,Date.now());
  if(hit)return JSON.parse(hit.data);
  if(Date.now()<cooldown)throw Error('ESI cooling down. Previous corporation data retained.');
  const r=await network('https://esi.evetech.net'+path,{headers:{Authorization:'Bearer '+await token(row),'X-Compatibility-Date':'2026-10-17','User-Agent':'STEMPTools ('+config.contact+')'},signal:AbortSignal.timeout(30000)});
  if(r.status===420||r.status===429||Number(r.headers.get('x-esi-error-limit-remain')??100)<10)cooldown=Date.now()+Math.max(60,Number(r.headers.get('retry-after')||r.headers.get('x-esi-error-limit-reset')||60))*1000;
  if(!r.ok)throw Error('Corporation ESI returned HTTP '+r.status+'. Previous data retained.');
  const maxAge=Number(/max-age=(\d+)/.exec(r.headers.get('cache-control')||'')?.[1]||0);
  const expires=Date.parse(r.headers.get('expires')||'')||Date.now()+maxAge*1000;
  const result={data:await r.json(),pages:Number(r.headers.get('x-pages')||1),observed:Date.parse(r.headers.get('last-modified')||'')||Date.now()};
  db.prepare('INSERT INTO corp_http_cache VALUES(?,?,?,?) ON CONFLICT(character_id,path) DO UPDATE SET data=excluded.data,expires=excluded.expires').run(row.character_id,path,JSON.stringify(result),expires);
  return result;
 }
 async function pages(path,row,key) {
  let expected=1,observed=null;const found=new Map();
  for(let page=1;page<=expected;page++){
   const r=await request(path+'?page='+page,row);
   if(!Number.isSafeInteger(r.pages)||r.pages<1||r.pages>10000||(page>1&&r.pages!==expected)||!Array.isArray(r.data))throw Error('Corporation inventory pagination changed; previous snapshot retained.');
   expected=r.pages;
   if(page<expected&&!r.data.length)throw Error('Corporation inventory page incomplete.');
   observed=observed===null?r.observed:Math.min(observed,r.observed);
   for(const item of r.data){if(!Number.isSafeInteger(item[key])||found.has(item[key]))throw Error('Duplicate or invalid corporation inventory record.');found.set(item[key],item);}
  }
  return {data:[...found.values()],observed};
 }
 function extractionSnapshot(){
  const saved=db.prepare('SELECT data FROM public_cache WHERE path=?').get('/tools/moon-extractions');
  return saved?JSON.parse(saved.data):{rows:[],updated:null,error:'Extraction data not collected yet. Sync corporation.'};
 }
 async function collectExtractions(row){
  let result=extractionSnapshot();
  try{
   if(!JSON.parse(row.scopes).includes(MINING_SCOPE))throw Error('Reconnect Corp ESI to authorise moon extraction timers.');
   const found=await pages('/corporation/'+STEMP_ID+'/mining/extractions',row,'structure_id');
   if(found.data.some(e=>![e.chunk_arrival_time,e.natural_decay_time,e.extraction_start_time].every(v=>Number.isFinite(Date.parse(v)))))throw Error('Invalid extraction timers returned by ESI.');
   result={rows:found.data,updated:found.observed,error:null};
  }catch(e){result={...result,error:e.message};}
  db.prepare('INSERT INTO public_cache VALUES(?,?,?) ON CONFLICT(path) DO UPDATE SET data=excluded.data,expires=excluded.expires').run('/tools/moon-extractions',JSON.stringify(result),0);
 }
 async function collect(row) {
  if(!CORE_CORP_SCOPES.every(s=>JSON.parse(row.scopes).includes(s)))throw Error('Reconnect Corp ESI to authorise structures, assets and starbases.');
  const prefix='/corporations/'+STEMP_ID;
  const structures=await pages(prefix+'/structures',row,'structure_id');
  const assets=await pages(prefix+'/assets',row,'item_id');
  const towers=await pages(prefix+'/starbases',row,'starbase_id');
  const previous=db.prepare('SELECT data FROM corp_snapshots WHERE corporation_id=?').get(STEMP_ID);
  const old=new Map((previous?JSON.parse(previous.data):[]).map(s=>[s.id,s]));
  let sov=null,alliance=0;
  try {const corp=await eve.publicGet('/corporations/'+STEMP_ID);alliance=corp.alliance_id||0;sov=await eve.publicGet('/sovereignty/systems');if(!Array.isArray(sov.solar_systems))sov=null;}catch{}
  const systems=new Map(),regions=new Map();const rows=[];
  for(const item of [...structures.data,...towers.data]){
   if(item.corporation_id&&item.corporation_id!==STEMP_ID)throw Error('Unexpected corporation in structure response.');
   const pos=!!item.starbase_id,id=item.starbase_id||item.structure_id,type=cat.type(item.type_id);
   const kind=pos?'POS':/Metenox/i.test(type?.name||'')?'Moon Drill':'Structure';
   if(!systems.has(item.system_id)){
    try {
     const system=await eve.publicGet('/universe/systems/'+item.system_id);systems.set(item.system_id,system.name);
     const constellation=await eve.publicGet('/universe/constellations/'+system.constellation_id);
     const region=await eve.publicGet('/universe/regions/'+constellation.region_id);regions.set(item.system_id,region.name);
    }catch{if(!systems.has(item.system_id))systems.set(item.system_id,'System '+item.system_id);}
   }
   const holds=sov?!!alliance&&sov.solar_systems.some(s=>s.solar_system_id===item.system_id&&s.claim?.alliance?.alliance_id===alliance):null;
   const relevant=assets.data.filter(a=>a.location_id===id);
   let fuelItems,inventoryAt=assets.observed,moon=null;
   if(pos){
    const detail=await request(prefix+'/starbases/'+id+'?system_id='+item.system_id,row);
    fuelItems=detail.data.fuels??null;inventoryAt=detail.observed;
    if(item.moon_id){try{moon=(await eve.publicGet('/universe/moons/'+item.moon_id)).name;}catch{moon='Moon '+item.moon_id;}}
   }else fuelItems=relevant.filter(a=>a.location_flag==='StructureFuel');
   const fuel=fuelItems===null?null:fuelItems.reduce((sum,a)=>sum+(FUEL_BLOCKS.has(a.type_id)?a.quantity:0),0);
   const gas=kind==='Moon Drill'?fuelItems.filter(a=>a.type_id===81143).reduce((n,a)=>n+a.quantity,0):null;
   const materialsMap=new Map();
   for(const a of relevant.filter(a=>a.location_flag==='MoonMaterialBay'))materialsMap.set(a.type_id,(materialsMap.get(a.type_id)||0)+a.quantity);
   const materials=[...materialsMap].filter(([,q])=>q>0).map(([type_id,quantity])=>({type_id,quantity,name:cat.type(type_id)?.name||'Type '+type_id}));
   const result={id,type_id:item.type_id,type_name:type?.name||'Type '+item.type_id,kind,name:item.name||moon||type?.name||'POS '+id,system:systems.get(item.system_id),region:regions.get(item.system_id)||null,moon,state:item.state||'unknown',timer:item.state_timer_end||item.reinforced_until||null,unanchors_at:item.unanchors_at||null,reinforce_hour:item.reinforce_hour??null,services:item.services??null,fuel_expires:item.fuel_expires||null,fuel,gas,inventory_at:inventoryAt,fuels:fuelItems?.map(a=>({type_id:a.type_id,quantity:a.quantity,name:cat.type(a.type_id)?.name||'Type '+a.type_id}))??null,materials,mining:kind==='Moon Drill'?miningState(item.services):null};
   result.rate=structureRate(result,assets.data,id=>cat.type(id),holds);
   result.gas_rate=kind==='Moon Drill'?(result.mining==='online'?200:result.mining==='offline'?0:null):null;
   const prior=old.get(id);
   // Cached or older inventory must never move the collection baseline backwards.
   if(prior&&inventoryAt<=prior.inventory_at){result.fuel=prior.fuel;result.gas=prior.gas;result.materials=prior.materials;result.inventory_at=prior.inventory_at;}
   result.history=kind==='Moon Drill'?moonHistory(prior,result.materials,result.inventory_at):[];
   rows.push(result);
  }
  return rows.sort((a,b)=>a.system.localeCompare(b.system)||a.name.localeCompare(b.name));
 }
 function queue() {
  const j=db.prepare('SELECT * FROM corp_jobs WHERE corporation_id=?').get(STEMP_ID);
  if(j&&['queued','running'].includes(j.status))return;
  // Manual refresh respects the same cached ESI results; prevent accidental repeated large runs.
  if(j?.attempted>Date.now()-60000)return;
  db.prepare("INSERT INTO corp_jobs(corporation_id,status,next_due) VALUES(?,'queued',?) ON CONFLICT(corporation_id) DO UPDATE SET status='queued'").run(STEMP_ID,Date.now()+HOUR);
 }
 function schedule(now=Date.now()) {
  if(!db.prepare('SELECT 1 FROM corp_authorizations WHERE corporation_id=?').get(STEMP_ID))return;
  const job=db.prepare('SELECT * FROM corp_jobs WHERE corporation_id=?').get(STEMP_ID);
  if(!job||job.next_due<=now)queue();
 }
 async function tick() {
  if(busy)return;const job=db.prepare("SELECT * FROM corp_jobs WHERE status='queued'").get();if(!job)return;
  busy=true;db.prepare("UPDATE corp_jobs SET status='running',attempted=?,next_due=? WHERE corporation_id=?").run(Date.now(),Date.now()+HOUR,STEMP_ID);
  try{
   let row;
   for(const candidate of db.prepare('SELECT * FROM corp_authorizations WHERE corporation_id=? ORDER BY verified DESC').all(STEMP_ID).sort((a,b)=>Number(JSON.parse(b.scopes).includes(MINING_SCOPE))-Number(JSON.parse(a.scopes).includes(MINING_SCOPE)))){
    if(CORE_CORP_SCOPES.every(s=>JSON.parse(candidate.scopes).includes(s))&&await access(candidate.user_id,true)){row=candidate;break;}
   }
   if(!row)throw Error('Connect a current Sacred Templars CEO or Director with all corporation scopes.');
   const rows=await collect(row);
   await collectExtractions(row);
   transaction(db,()=>{
    db.prepare('INSERT INTO corp_snapshots VALUES(?,?,?) ON CONFLICT(corporation_id) DO UPDATE SET data=excluded.data,updated=excluded.updated').run(STEMP_ID,JSON.stringify(rows),Date.now());
    db.prepare("UPDATE corp_jobs SET status='idle',error=NULL WHERE corporation_id=?").run(STEMP_ID);
   });
  }catch(e){db.prepare("UPDATE corp_jobs SET status='failed',error=? WHERE corporation_id=?").run(e.message,STEMP_ID);}finally{busy=false;}
 }
 function snapshot(){const s=db.prepare('SELECT * FROM corp_snapshots WHERE corporation_id=?').get(STEMP_ID);return {structures:s?JSON.parse(s.data):[],updated:s?.updated||null,job:db.prepare('SELECT status,attempted,error,next_due FROM corp_jobs WHERE corporation_id=?').get(STEMP_ID)||null};}
    let priceRequest=null;
 async function marketPrices() {
  const key='/tools/corp-harvest-prices';
  const saved=db.prepare('SELECT * FROM public_cache WHERE path=?').get(key);
  if(saved?.expires>Date.now())return JSON.parse(saved.data);
  if(priceRequest)return priceRequest;
  priceRequest=(async()=>{
   try {
    const prices=await eve.publicGet('/markets/prices');
    if(!Array.isArray(prices))throw Error('Invalid prices');
    const result={prices,checked:Date.now(),error:null};
    db.prepare('INSERT INTO public_cache VALUES(?,?,?) ON CONFLICT(path) DO UPDATE SET data=excluded.data,expires=excluded.expires').run(key,JSON.stringify(result),Date.now()+3600000);
    return result;
   }catch {
    const result={...(saved?JSON.parse(saved.data):{prices:[],checked:null}),error:'Price refresh failed; last available prices retained.'};
    db.prepare('INSERT INTO public_cache VALUES(?,?,?) ON CONFLICT(path) DO UPDATE SET data=excluded.data,expires=excluded.expires').run(key,JSON.stringify(result),Date.now()+60000);
    return result;
   }
  })();try{return await priceRequest;}finally{priceRequest=null;}
 }
 async function harvest(){
  const state=snapshot(),market=await marketPrices();
  const surveys=moonSurveyData(),byId=new Map(surveys.rows.filter(s=>s.moon_id).map(s=>[s.moon_id,s]));
  const extractions=extractionSnapshot();
  extractions.rows=extractions.rows.map(e=>({...e,estimate:estimateExtraction(e,byId.get(e.moon_id),market.prices,id=>cat.type(id),name=>cat.named?.(name),surveys.daily_m3)}));
  return {...state,refineries:state.structures.filter(s=>s.kind!=='Moon Drill'),extractions,structures:valueHarvest(state.structures,market.prices,id=>cat.type(id)),prices:{checked:market.checked,error:market.error}};
 }
 db.prepare("UPDATE corp_jobs SET status='queued' WHERE status='running'").run();
 return {access,connected,queue,schedule,tick,snapshot,collect,harvest};
}
