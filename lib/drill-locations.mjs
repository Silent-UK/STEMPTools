import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
let positions;
export function nearestDrillMoon(structure,rows){
 if(!Number.isSafeInteger(structure?.solar_system_id)||!['x','y','z'].every(k=>Number.isFinite(structure.position?.[k])))return null;
 if(!rows){if(!positions){positions=new Map();for(const r of JSON.parse(gunzipSync(readFileSync(new URL('./moon-positions.json.gz',import.meta.url))))){if(!positions.has(r[1]))positions.set(r[1],[]);positions.get(r[1]).push(r);}}rows=positions.get(structure.solar_system_id)||[];}
 const p=structure.position,near=rows.filter(r=>r[1]===structure.solar_system_id).map(r=>({id:r[0],distance:Math.hypot(p.x-r[2],p.y-r[3],p.z-r[4])})).sort((a,b)=>a.distance-b.distance);
 return near[0]?.distance<=1e8&&(!near[1]||near[1].distance>Math.max(1e6,near[0].distance*2))?near[0].id:null;
}

// Resolve only the corporation's own drills, using an existing authorised pilot.
// Run outside page requests and retain prior snapshots if ESI is unavailable.
export function drillLocationService({db,eve,snapshot,corporation}){
 let running=null,next=0;
 async function collect(){
  const users=db.prepare('SELECT user_id FROM corp_authorizations WHERE corporation_id=?').all(corporation),pilots=users.flatMap(u=>db.prepare('SELECT * FROM characters WHERE user_id=? ORDER BY CASE WHEN id=(SELECT character_id FROM corp_authorizations WHERE user_id=?) THEN 0 ELSE 1 END,id').all(u.user_id,u.user_id)).filter(c=>JSON.parse(c.scopes).includes('esi-universe.read_structures.v1'));
  if(!pilots.length)return;
  for(const drill of snapshot().structures.filter(s=>s.kind==='Moon Drill'&&!s.moon_id)){
   let location;
   for(const pilot of pilots.slice(0,2)){try{location=await eve.get('/universe/structures/'+drill.id,pilot);break;}catch(e){if(e.status>=500||[420,429].includes(e.status)||['TimeoutError','AbortError'].includes(e.name))return;}}
   if(location?.owner_id!==corporation||location?.type_id!==81826)continue;
   const moon=nearestDrillMoon(location);if(!moon)continue;
   const current=db.prepare('SELECT data FROM corp_snapshots WHERE corporation_id=?').get(corporation);if(!current)return;
   const rows=JSON.parse(current.data),row=rows.find(s=>s.id===drill.id&&s.kind==='Moon Drill');if(!row||row.moon_id)continue;
   row.moon_id=moon;row.moon_location_source='ESI structure coordinates';db.prepare('UPDATE corp_snapshots SET data=? WHERE corporation_id=?').run(JSON.stringify(rows),corporation);
  }
 }
 function schedule(){if(running||next>Date.now())return;next=Date.now()+30*60000;running=collect().catch(()=>{}).finally(()=>{running=null;});}
 return {schedule,collect};
}
