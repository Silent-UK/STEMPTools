const validDate=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
export function contractPreferences(raw={}){const p=raw&&typeof raw==='object'?raw:{};return {type:['item_exchange','courier','auction'].includes(p.type)?p.type:'',status:typeof p.status==='string'?p.status.slice(0,40):'',direction:['issued','received'].includes(p.direction)?p.direction:'',availability:['public','personal','corporation','alliance'].includes(p.availability)?p.availability:'',attention:['expiring','overdue','failed'].includes(p.attention)?p.attention:'',q:typeof p.q==='string'?p.q.slice(0,200):'',from:validDate(p.from)?p.from:'',to:validDate(p.to)?p.to:'',pilot:typeof p.pilot==='string'&&/^\d*$/.test(p.pilot)?p.pilot:''};}
export function mergeContracts(pilots){
 const map=new Map(),owned=new Set(pilots.map(p=>Number(p.id)));
 for(const p of pilots)for(const r of p.data?.contracts||[]){
  const old=map.get(r.contract_id),newer=!old||Number(r.observed||0)>Number(old.observed||0)||(Number(r.observed||0)===Number(old.observed||0)&&old.retained&&!r.retained);
  const names={...(old?.names||{}),...(p.data.names||{})},locations={...(old?.locations||{}),...(p.data.locations||{})},seen=[...new Set([...(old?.pilots||[]),p.name])];
  const chosen=newer?{...r,snapshot_updated:p.updated,snapshot_error:p.error}:old;
  const accepted=Date.parse(chosen.date_accepted),days=Number(chosen.days_to_complete),delivery=Number.isFinite(accepted)&&Number.isFinite(days)&&days>0?new Date(accepted+days*86400000).toISOString():null;
  map.set(r.contract_id,{...chosen,pilots:seen,names,locations,delivery_due:delivery,issued:!chosen.for_corporation&&owned.has(Number(chosen.issuer_id)),received:chosen.availability==='personal'&&owned.has(Number(chosen.assignee_id))||owned.has(Number(chosen.acceptor_id))});
 }
 return [...map.values()].sort((a,b)=>Number(b.status==='outstanding')-Number(a.status==='outstanding')||String(b.date_issued||'').localeCompare(String(a.date_issued||'')));
}
export function contractWarning(r,now=Date.now()){
 const stale=r.retained||r.snapshot_error||!r.snapshot_updated||now-Number(r.snapshot_updated)>7200000;
 if(['failed','rejected','reversed'].includes(r.status))return 'Failed / rejected · saved status';
 const due=r.type==='courier'&&r.status==='in_progress'?Date.parse(r.delivery_due):r.status==='outstanding'?Date.parse(r.date_expired):NaN;
 if(!Number.isFinite(due))return '';
 const message=due<now?(r.status==='in_progress'?'Courier overdue':'Offer expired'):due-now<=86400000?'Expires within 24 hours':'';
 return message?(stale?'Saved deadline · '+message.toLowerCase()+' · sync to confirm':message):'';
}
export function filterContracts(rows,filters={},now=Date.now()){
 const q=String(filters.q||'').trim().toLocaleLowerCase();
 return rows.filter(r=>{
 if(filters.type&&r.type!==filters.type||filters.status&&r.status!==filters.status||filters.availability&&r.availability!==filters.availability||filters.direction&&!r[filters.direction])return false;
 const issued=Date.parse(r.date_issued);if(filters.from&&(!Number.isFinite(issued)||issued<Date.parse(filters.from))||filters.to&&(!Number.isFinite(issued)||issued>=Date.parse(filters.to)+86400000))return false;
 if(filters.attention){const warning=contractWarning(r,now).toLowerCase();if(filters.attention==='expiring'&&!warning.includes('within 24')||filters.attention==='overdue'&&!warning.includes('overdue')||filters.attention==='failed'&&!['failed','rejected','reversed','deleted'].includes(r.status))return false;}
 return !q||[r.title,r.contract_id,...r.pilots,...Object.values(r.names),r.issuer_id,r.assignee_id,r.acceptor_id,...Object.values(r.locations),...(r.items||[]).map(i=>i.name)].join(' ').toLocaleLowerCase().includes(q);
 });
}
export function contractsCSV(rows){
 const values=[['Contract ID','Title','Pilots','Type','Status','Availability','Issuer ID','Issuer','Assignee ID','Assignee','Acceptor ID','Acceptor','Issued UTC','Offer expires UTC','Delivery due UTC','Price ISK','Reward ISK','Collateral ISK','Volume m3','Start','Destination','Retained','Last observed UTC'],...rows.map(r=>[r.contract_id,r.title,r.pilots.join('; '),r.type,r.status,r.availability,r.issuer_id,r.names[r.issuer_id],r.assignee_id,r.names[r.assignee_id],r.acceptor_id,r.names[r.acceptor_id],r.date_issued,r.date_expired,r.delivery_due,r.price,r.reward,r.collateral,r.volume,r.locations[r.start_location_id]||r.start_location_id,r.locations[r.end_location_id]||r.end_location_id,r.retained?'Yes':'No',Number.isFinite(r.observed)?new Date(r.observed).toISOString():''])];
 return '\uFEFF'+values.map(row=>row.map(v=>{let text=String(v??'');if(typeof v==='string'&&/^[\s]*[=+@-]/.test(text))text="'"+text;return '"'+text.replaceAll('"','""')+'"';}).join(',')).join('\r\n');
}
