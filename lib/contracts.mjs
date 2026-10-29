export async function collectContracts(c,eve,cat,previous){
 if(!JSON.parse(c.scopes).includes('esi-contracts.read_character_contracts.v1'))throw Object.assign(Error('Reconnect this pilot to enable Contracts.'),{status:403});
 const base='/characters/'+c.id+'/contracts',contracts=[],seen=new Set();let pages=1;
 for(let page=1;page<=pages;page++){
  const r=await eve.request(base+'?page='+page,c);
  if(!Array.isArray(r.data)||!Number.isInteger(r.pages)||r.pages<1||r.pages>1000||(page>1&&r.pages!==pages))throw Error('Incomplete contracts');pages=r.pages;
  for(const row of r.data){if(!Number.isSafeInteger(row.contract_id)||seen.has(row.contract_id))throw Error('Invalid contracts');seen.add(row.contract_id);contracts.push({...row,observed:Date.now()});}
 }
 const old=new Map((previous?.contracts||[]).map(r=>[r.contract_id,r]));
 for(const row of contracts){
  if(row.type==='courier')continue;
  try{const result=await eve.request(base+'/'+row.contract_id+'/items',c);if(!Array.isArray(result.data))throw Error('Invalid items');row.items=result.data.map(i=>({...i,name:cat.type(i.type_id)?.name||'Type '+i.type_id}));}
  catch{row.items=old.get(row.contract_id)?.items;row.items_error='Items unavailable; any retained items are from an earlier sync.';}
 }
 const names={...(previous?.names||{})},ids=[...new Set(contracts.flatMap(r=>[r.issuer_id,r.issuer_corporation_id,r.assignee_id,r.acceptor_id]).filter(id=>id>0&&!names[id]))];
 for(let i=0;i<ids.length;i+=1000){try{const r=await eve.request('/universe/names',null,'POST',ids.slice(i,i+1000));for(const n of r.data)names[n.id]=n.name;}catch{}}
 const locations={...(previous?.locations||{})};
 for(const id of [...new Set(contracts.flatMap(r=>[r.start_location_id,r.end_location_id]).filter(Boolean))]){try{const place=id>=1000000000000?await eve.get('/universe/structures/'+id,c):await eve.publicGet('/universe/stations/'+id);locations[id]=place.name;}catch{}}
 return {locations,contracts:[...new Map([...(previous?.contracts||[]).map(r=>({...r,retained:true})),...contracts].map(r=>[r.contract_id,r])).values()],names};
}
