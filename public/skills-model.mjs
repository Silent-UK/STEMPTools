import {splitQueue} from './view-models.mjs';
export const QUEUE_FILTERS={all:'All queues',training:'Training',short:'Queue under 2 days',empty:'Empty queue',unavailable:'Data unavailable / stale'};
export const QUEUE_SORTS={manual:'Manual order',queue:'Queue · shortest first',sp:'Total SP · highest',name:'Name · A–Z'};
export function skillsPreferences(raw){const v=raw&&typeof raw==='object'?raw:{};return {selected:Number.isSafeInteger(v.selected)?v.selected:null,alts:v.alts===true,pilotQuery:typeof v.pilotQuery==='string'?v.pilotQuery.slice(0,120):'',status:Object.hasOwn(QUEUE_FILTERS,v.status)?v.status:'all',sort:Object.hasOwn(QUEUE_SORTS,v.sort)?v.sort:'manual',q:typeof v.q==='string'?v.q.slice(0,120):'',group:typeof v.group==='string'?v.group.slice(0,120):'',level:/^[0-5]$/.test(String(v.level))?String(v.level):'',queued:v.queued===true,below:v.below===true,groups:Array.isArray(v.groups)?v.groups.filter(x=>typeof x==='string').slice(0,100):[]};}
export function skillProgress(row,now=Date.now()){const start=Date.parse(row?.start_date),end=Date.parse(row?.finish_date);return Number.isFinite(start)&&Number.isFinite(end)&&end>start?Math.max(0,Math.min(100,(now-start)/(end-start)*100)):null;}
export function queueState(pilot,now=Date.now()){
 const {current,waiting}=splitQueue(pilot.queue||[],now),remaining=[...(current?[current]:[]),...waiting],ends=remaining.map(q=>Date.parse(q.finish_date)),unknown=!Array.isArray(pilot.queue)||ends.some(end=>!Number.isFinite(end))||(pilot.queue||[]).some(q=>q.finish_date&&!Number.isFinite(Date.parse(q.finish_date))),end=ends.length&&!unknown?Math.max(...ends):null,stale=!!pilot.updated&&now-pilot.updated>7200000;
 if(!pilot.updated||pilot.error||stale)return {kind:'unavailable',label:pilot.error?'Refresh failed · saved queue':stale?'Stale snapshot':'Awaiting skill sync',current,end,progress:skillProgress(current,now)};
 if(unknown)return {kind:'unavailable',label:'Schedule incomplete',current,end:null,progress:skillProgress(current,now)};
 if(!remaining.length)return {kind:'empty',label:'Empty queue',current:null,end:null,progress:null};
 return {kind:end-now<172800000?'short':'training',label:end-now<172800000?'Queue under 2 days':current?'Training':'Training scheduled',current,end,progress:skillProgress(current,now)};
}
export function filterTrainingPilots(rows,chars,prefs,now=Date.now()){
 const parents=new Map(chars.map(c=>[c.id,c.parent_id]));
 return rows.filter(c=>(prefs.alts||parents.get(c.id)===c.id||parents.get(c.id)==null)&&c.name.toLocaleLowerCase().includes(prefs.pilotQuery.trim().toLocaleLowerCase())).filter(c=>{const state=queueState(c,now);return prefs.status==='all'||prefs.status==='training'&&!!state.current&&state.kind!=='unavailable'||prefs.status===state.kind;}).sort((a,b)=>{if(prefs.sort==='name')return a.name.localeCompare(b.name);if(prefs.sort==='sp')return a.total_sp==null?(b.total_sp==null?0:1):b.total_sp==null?-1:b.total_sp-a.total_sp;if(prefs.sort==='queue'){const av=queueState(a,now),bv=queueState(b,now),value=s=>s.kind==='unavailable'?Infinity:s.kind==='empty'?0:s.end-now;return value(av)-value(bv)||a.name.localeCompare(b.name);}return 0;});
}
export function filterTrainedSkills(data,prefs,now=Date.now()){
 const queued=new Set([...splitQueue(data?.queue||[],now).waiting,...(splitQueue(data?.queue||[],now).current?[splitQueue(data.queue,now).current]:[])].map(q=>q.skill_id));
 return (data?.skills?.skills||[]).filter(s=>s.name.toLocaleLowerCase().includes(prefs.q.trim().toLocaleLowerCase())&&(!prefs.group||s.group===prefs.group)&&(prefs.level===''||s.trained_skill_level===Number(prefs.level))&&(!prefs.queued||queued.has(s.skill_id))&&(!prefs.below||s.active_skill_level<s.trained_skill_level));
}
export function skillFiltersActive(p){return !!(p.q.trim()||p.group||p.level!==''||p.queued||p.below);}
export function trainingDuration(row){const start=Date.parse(row?.start_date),end=Date.parse(row?.finish_date);return Number.isFinite(start)&&Number.isFinite(end)&&end>=start?end-start:null;}
export function skillDuration(ms){if(ms==null||!Number.isFinite(ms))return 'Not scheduled';const minutes=Math.max(0,Math.ceil(ms/60000));return `${Math.floor(minutes/1440)}d ${Math.floor(minutes%1440/60)}h ${minutes%60}m`;}
export function skillsCSV(data,kind,now=Date.now()){
 const queue=splitQueue(data?.queue||[],now),rows=kind==='queue'?[['Position','Skill ID','Skill','Target level','Start UTC','Finish UTC','Training duration','Time until completion','Status'],[...(queue.current?[queue.current]:[]),...queue.waiting].map(q=>[q.queue_position,q.skill_id,q.name,q.finished_level,q.start_date||'',q.finish_date||'',skillDuration(trainingDuration(q)),q.finish_date?skillDuration(Date.parse(q.finish_date)-now):'Not scheduled',q===queue.current?'Currently training':!q.finish_date?'Not scheduled':'Queued'])]:[['Skill ID','Skill','Group','Trained level','Active level','Skillpoints'],(data?.skills?.skills||[]).map(s=>[s.skill_id,s.name,s.group,s.trained_skill_level,s.active_skill_level,s.skillpoints_in_skill])];
 return '\uFEFF'+[rows[0],...rows[1]].map(row=>row.map(value=>{let v=String(value??'');if(/^\s*[=+@\-]/.test(v)||/^[\t\r\n]/.test(v))v="'"+v;return '"'+v.replaceAll('"','""')+'"';}).join(',')).join('\r\n');
}

export function skillsDate(value){const d=new Date(value);return value&&Number.isFinite(d.getTime())?d.toLocaleString('en-GB',{timeZone:'UTC',year:'numeric',month:'short',day:'2-digit',hour:'2-digit',minute:'2-digit'})+' UTC':'Not scheduled';}
