import systems from './system-names.json' with {type:'json'};
export const MINING_SCOPE='esi-industry.read_character_mining.v1';
export async function collectMining(c,eve,cat,previous,now=Date.now()){
 if(!JSON.parse(c.scopes).includes(MINING_SCOPE))throw Object.assign(Error('Connect mining access for this pilot to import the ledger.'),{status:403});
 const incoming=new Map();let pages=1;
 for(let page=1;page<=pages;page++){
  const result=await eve.request('/characters/'+c.id+'/mining?page='+page,c);
  if(page===1)pages=result.pages;
  if(!Number.isInteger(pages)||pages<1||pages>10000||result.pages!==pages||!Array.isArray(result.data))throw Error('Mining pages changed during sync');
  for(const row of result.data){
   if(!/^\d{4}-\d{2}-\d{2}$/.test(row.date)||!Number.isFinite(Date.parse(row.date))||new Date(row.date).toISOString().slice(0,10)!==row.date||row.date>new Date(now).toISOString().slice(0,10)||![row.type_id,row.solar_system_id].every(n=>Number.isSafeInteger(n)&&n>0)||!Number.isSafeInteger(row.quantity)||row.quantity<0)throw Error('Invalid mining record');
   const key=[row.date,row.solar_system_id,row.type_id].join(':');
   if(incoming.has(key))throw Error('Mining ledger changed during sync');
   const type=cat.type(row.type_id),volume=Number.isFinite(type?.volume)&&type.volume>0?type.volume:null;
   incoming.set(key,{date:row.date,type_id:row.type_id,solar_system_id:row.solar_system_id,quantity:row.quantity,name:type?.name||'Type '+row.type_id,system:systems[row.solar_system_id]||'System '+row.solar_system_id,volume_m3:volume===null?null:row.quantity*volume});
  }
 }
 // Daily quantities are cumulative: replace matching rows, never add them again.
 // Keep older observations after they leave ESI's rolling history window.
 const retained=new Map((previous?.rows||[]).map(r=>[[r.date,r.solar_system_id,r.type_id].join(':'),r]));
 for(const [key,row] of incoming)retained.set(key,row);
 return {rows:[...retained.values()].sort((a,b)=>b.date.localeCompare(a.date)||a.name.localeCompare(b.name)||a.solar_system_id-b.solar_system_id),started_at:previous?.started_at||now};
}
