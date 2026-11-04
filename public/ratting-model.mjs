const day=86400000;
export const RATTING_TYPES={bounty_prizes:'NPC bounties',ess_escrow_transfer:'ESS payments'};
const dateValid=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
export function rattingPreferences(raw={}){const p=raw&&typeof raw==='object'?raw:{};return {period:['day','week','month','7','30','60','90','all','custom'].includes(p.period)?p.period:'30',pilot:typeof p.pilot==='string'&&/^\d*$/.test(p.pilot)?p.pilot:'',type:Object.hasOwn(RATTING_TYPES,p.type)?p.type:'',q:typeof p.q==='string'?p.q.slice(0,200):'',from:dateValid(p.from)?p.from:'',to:dateValid(p.to)?p.to:'',alts:p.alts===true};}
export function rattingBounds(f,now=Date.now()){
 const d=new Date(now),today=Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate());let start=0,end=now+1,days=null;
 if(f.period==='custom'){if(!dateValid(f.from)||!dateValid(f.to)||f.from>f.to||Date.parse(f.from)>now)throw Error('Choose a valid date range starting today or earlier.');start=Date.parse(f.from);end=Math.min(Date.parse(f.to)+day,now+1);}
 else if(f.period==='day')start=today;
 else if(f.period==='week')start=today-((d.getUTCDay()+6)%7)*day;
 else if(f.period==='month')start=Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),1);
 else if(['7','30','60','90'].includes(f.period)){days=Number(f.period);start=now-days*day;}
 else if(f.period!=='all')throw Error('Invalid ratting period.');
 return {start,end,days};
}
export function parseBountyReason(reason){
 const text=String(reason||'').trim(),parts=text.split(','),rats=new Map();let complete=!!text;
 for(const part of parts){const match=/^\s*(\d+)\s*:\s*(\d+)\s*$/.exec(part);if(!match){complete=false;continue;}const id=Number(match[1]),count=Number(match[2]);if(!Number.isSafeInteger(id)||id<=0||!Number.isSafeInteger(count)||count<=0){complete=false;continue;}rats.set(id,(rats.get(id)||0)+count);}
 return {rats:[...rats].map(([id,count])=>({id,count})),complete};
}
export function npcHighlight(name=''){if(/\btitan\b/i.test(name))return 'Titan';if(/\bdreadnought\b/i.test(name))return 'Dreadnought';if(/\b(Dread Guristas|True Sansha|Dark Blood|Domination|Shadow Serpentis|Sentient)\b/i.test(name))return 'Faction / special';return '';}
export function rattingRows(pilots,filters,now=Date.now()){
 const bounds=rattingBounds(filters,now),q=filters.q.trim().toLocaleLowerCase(),seen=new Set();
 return pilots.flatMap(p=>(p.data?.journal||[]).flatMap(r=>{const time=Date.parse(r.date),key=p.id+':'+r.id;if(seen.has(key)||!Object.hasOwn(RATTING_TYPES,r.ref_type)||!Number.isFinite(r.amount)||r.amount<=0||!Number.isFinite(time)||time<bounds.start||time>=bounds.end||filters.pilot&&String(p.id)!==filters.pilot||filters.type&&r.ref_type!==filters.type)return [];seen.add(key);
 const parsed=r.ref_type==='bounty_prizes'?parseBountyReason(r.reason):{rats:[],complete:false},rats=parsed.rats.map(n=>({...n,name:p.data.npc_types?.[n.id]?.name||'Type '+n.id}));
 if(q&&![p.name,r.id,r.description,r.reason,...rats.map(n=>n.name)].join(' ').toLocaleLowerCase().includes(q))return [];
 return [{...r,pilot_id:p.id,pilot:p.name,names:p.data.names||{},snapshot_updated:p.updated,rats,rat_detail_complete:parsed.complete}];
 })).sort((a,b)=>b.date.localeCompare(a.date)||b.id-a.id);
}
export function rattingAnalysis(pilots,chars,filters,now=Date.now()){
 const rows=rattingRows(pilots,filters,now),daily=new Map(),groups=new Map(),npc=new Map();let bounty=0,ess=0,partial=0,credited=0;
 for(const r of rows){const date=r.date.slice(0,10),d=daily.get(date)||{date,bounty:0,ess:0,total:0};const kind=r.ref_type==='bounty_prizes'?'bounty':'ess';d[kind]+=r.amount;d.total+=r.amount;daily.set(date,d);if(kind==='bounty'){bounty+=r.amount;if(!r.rat_detail_complete)partial++;}else ess+=r.amount;
 const char=chars.find(c=>Number(c.id)===Number(r.pilot_id)),id=filters.alts?r.pilot_id:char?.parent_id||r.pilot_id,main=chars.find(c=>Number(c.id)===Number(id)),g=groups.get(id)||{id,name:filters.alts?r.pilot:main?.name||r.pilot,total:0,bounty:0,ess:0,latest:r.date,pilots:new Set(),alt:!!char&&Number(char.parent_id)!==Number(char.id)};g[kind]+=r.amount;g.total+=r.amount;g.pilots.add(r.pilot);if(r.date>g.latest)g.latest=r.date;groups.set(id,g);
 for(const rat of r.rats){credited+=rat.count;const n=npc.get(rat.id)||{...rat,count:0,pilots:new Set(),highlight:npcHighlight(rat.name),latest:r.date};if(r.date>n.latest)n.latest=r.date;n.count+=rat.count;n.pilots.add(r.pilot);npc.set(rat.id,n);}
 }
 const days=[...daily.values()].sort((a,b)=>a.date.localeCompare(b.date)),total=bounty+ess,best=[...days].sort((a,b)=>b.total-a.total)[0]||null,bounds=rattingBounds(filters,now),start=filters.period==='all'?(rows.length?Date.parse(rows.at(-1).date):now):bounds.start,calendarDays=bounds.days||Math.max(1,Math.floor((Date.parse(new Date(bounds.end-1).toISOString().slice(0,10))-Date.parse(new Date(start).toISOString().slice(0,10)))/day)+1);
 return {rows,daily:days,bounty,ess,total,best,credited,partial,days:calendarDays,average:total/calendarDays,pilots:[...groups.values()].sort((a,b)=>b.total-a.total),npcs:[...npc.values()].sort((a,b)=>Number(!!b.highlight)-Number(!!a.highlight)||b.count-a.count)};
}
export function rattingCSV(rows){const cells=[['Pilot','Pilot ID','Journal ID','Date UTC','Income type','Amount ISK','Description','Reason','NPC details complete','Credited rats','Snapshot UTC'],...rows.map(r=>[r.pilot,r.pilot_id,r.id,r.date,RATTING_TYPES[r.ref_type],r.amount,r.description,r.reason,r.ref_type==='bounty_prizes'?(r.rat_detail_complete?'Yes':'No'):'Not applicable',r.rats.map(n=>n.name+' × '+n.count).join('; '),r.snapshot_updated?new Date(r.snapshot_updated).toISOString():''])];return '\uFEFF'+cells.map(row=>row.map(v=>{let s=String(v??'');if(typeof v==='string'&&/^\s*[=+@-]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';}).join(',')).join('\r\n');}
