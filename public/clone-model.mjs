export const CLONE_FILTERS={all:'All clones',ready:'Ready to jump',cooldown:'On cooldown',implants:'With implants',empty:'No implants',unavailable:'Location unavailable'};
export function clonePreferences(raw){const p=raw&&typeof raw==='object'?raw:{};return {q:typeof p.q==='string'?p.q.slice(0,150):'',filter:Object.hasOwn(CLONE_FILTERS,p.filter)?p.filter:'all',view:p.view==='location'?'location':'character',open:Array.isArray(p.open)?p.open.filter(k=>typeof k==='string').slice(0,2000):[],closed:Array.isArray(p.closed)?p.closed.filter(k=>typeof k==='string').slice(0,2000):[]};}
export function cloneReadiness(pilot,now=Date.now()){
 const date=pilot.data?.ready_at,end=date?Date.parse(date):null,stale=!!pilot.data&&(!pilot.updated||now-pilot.updated>7200000||!!pilot.error||!!pilot.reconnect),invalid=!!date&&!Number.isFinite(end),ready=!!pilot.data&&!invalid&&(!date||end<=now);
 const minutes=end>now?Math.ceil((end-now)/60000):0,timer=end>now?`${Math.floor(minutes/1440)}d ${Math.floor(minutes%1440/60)}h ${minutes%60}m`:'Ready now';
 return {kind:!pilot.data||invalid?'unavailable':stale?'stale':ready?'ready':'cooldown',ready,end:Number.isFinite(end)?end:null,stale,label:!pilot.data?'Awaiting clone sync':invalid?'Readiness unavailable':stale?'Saved timer: '+timer:timer};
}
const includes=(values,q)=>values.filter(Boolean).join(' ').toLocaleLowerCase().includes(q);
export function filterClonePilots(rows,prefs,now=Date.now()){
 const q=prefs.q.trim().toLocaleLowerCase();
 return rows.flatMap(pilot=>{const state=cloneReadiness(pilot,now),data=pilot.data;if(prefs.filter==='ready'&&state.kind!=='ready'||prefs.filter==='cooldown'&&state.kind!=='cooldown')return [];
 const pilotMatch=!!q&&includes([pilot.name,data?.home_location?.name],q),activeMatch=!!data&&includes([pilot.name,...(data.active_implants||[]).map(i=>i.name)],q);
 const clones=(data?.clones||[]).filter(clone=>(!q||pilotMatch||includes([clone.name||'Unnamed clone',clone.location||'Location unavailable',String(clone.location_id??''),clone.system,clone.region,...(clone.implants||[]).map(i=>i.name)],q))&&(prefs.filter!=='implants'||clone.implants?.length>0)&&(prefs.filter!=='empty'||!clone.implants?.length)&&(prefs.filter!=='unavailable'||clone.location_unavailable||!clone.location||/^Location \d+/.test(clone.location)));
 const storedFilter=['implants','empty','unavailable'].includes(prefs.filter);if(storedFilter&&!clones.length)return [];
 if(q&&!pilotMatch&&!activeMatch&&!clones.length)return [];
 return [{...pilot,visibleClones:clones,showActive:!storedFilter&&(!q||pilotMatch||activeMatch),readiness:state}];});
}
export function cloneLocationGroups(pilots){
 const groups=new Map();
 for(const pilot of pilots)for(const clone of pilot.visibleClones||[]){const key=clone.location_id!=null?String(clone.location_id):'unknown:'+pilot.id+':'+clone.jump_clone_id;
 if(!groups.has(key))groups.set(key,{id:key,name:clone.location||'Location unavailable',system:clone.system,region:clone.region,entries:[]});
 const group=groups.get(key);if(!clone.location_unavailable&&clone.location){group.name=clone.location;group.system=clone.system;group.region=clone.region;}group.entries.push({pilot,clone});}
 return [...groups.values()].sort((a,b)=>a.name.localeCompare(b.name)).map(g=>({...g,entries:g.entries.sort((a,b)=>a.pilot.name.localeCompare(b.pilot.name)||(a.clone.name||'').localeCompare(b.clone.name||''))}));
}
