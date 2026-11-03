import {denAlerts} from '../public/den-model.mjs';
export function dashboardActivity(snapshots,id,now=Date.now()){
 const data=kind=>snapshots[kind]?.data;
 const jobs=data('industry')?.jobs,market=data('market'),pi=data('pi'),dens=data('dens'),assets=data('assets');
 const ready=j=>j.status==='ready'||j.status==='active'&&Number.isFinite(Date.parse(j.end_date))&&Date.parse(j.end_date)<=now;
 const mining=data('mining')?.rows?.filter(r=>r.date>=new Date(now-29*86400000).toISOString().slice(0,10)&&r.date<=new Date(now).toISOString().slice(0,10));
 return {contracts:data('contracts')?{outstanding:(data('contracts').contracts||[]).filter(c=>c.status==='outstanding').length}:null,mining:mining?{quantity:mining.reduce((n,r)=>n+(r.quantity||0),0),records:mining.length}:null,clones:data('clones')?{count:data('clones').clones?.length??0,ready:!data('clones').ready_at||Date.parse(data('clones').ready_at)<=now}:null,industry:jobs?{active:jobs.filter(j=>j.status==='active'&&!ready(j)).length,ready:jobs.filter(ready).length,pending:jobs.filter(j=>['paused','pending'].includes(j.status)).length}:null,
 blueprints:data('industry')?{count:data('industry').blueprints?.length??0}:null,
 market:market?{active:market.active?.length??0,buy:market.active?.filter(o=>o.is_buy_order).length??0,sell:market.active?.filter(o=>!o.is_buy_order).length??0}:null,
 pi:Array.isArray(pi)?{count:pi.length,attention:pi.filter(p=>(p.pins||[]).some(pin=>pin.extractor_details&&pin.expiry_time&&Date.parse(pin.expiry_time)<=now)).length}:null,
 dens:Array.isArray(dens)?{count:dens.length,attention:new Set(denAlerts([{id,data:dens,updated:snapshots.dens.updated}],now).map(a=>a.den_id)).size}:null,
 assets:assets?{stacks:assets.items?.length??0,locations:new Set((assets.items||[]).map(a=>a.root_location_id??a.location_id)).size}:null};
}
export function characterDashboard(db,id){
 const snapshots=Object.fromEntries(db.prepare("SELECT kind,data,updated FROM snapshots WHERE character_id=? AND kind IN ('roles','industry','market','pi','dens','assets','clones','fatigue','contracts','mining')").all(id).map(s=>[s.kind,{updated:s.updated,data:JSON.parse(s.data)}]));
 const cached=path=>{const row=db.prepare('SELECT data FROM public_cache WHERE path=?').get(path);return row?JSON.parse(row.data):null;};
 const pilot=cached('/characters/'+id),roles=snapshots.roles?.data,corpId=roles?.corporation_id??pilot?.corporation_id,corp=corpId?cached('/corporations/'+corpId):null,allianceId=roles?.alliance_id??corp?.alliance_id??pilot?.alliance_id;
 // Only return a location if this character already has a saved location response.
 const loc=db.prepare('SELECT data,expires FROM esi_cache WHERE character_id=? AND path=?').get(id,'/characters/'+id+'/location');
 const place=loc?JSON.parse(loc.data):null;
 return {identity:{corporation_id:corpId??null,corporation:roles?.corporation_name||corp?.name||null,alliance_id:allianceId??roles?.alliance_id??null,alliance:roles?.alliance_name||(allianceId?cached('/alliances/'+allianceId)?.name:null)||null},
 location:place?{system_id:place.solar_system_id,system:cached('/universe/systems/'+place.solar_system_id)?.name||null,stale:loc.expires<=Date.now()}:null,
 activity:dashboardActivity(snapshots,id),clones:snapshots.clones||null,fatigue:snapshots.fatigue||null};
}
