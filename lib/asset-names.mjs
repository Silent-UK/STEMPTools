// Name lookups are optional enrichment: a temporary failure must not discard inventory.
export async function collectAssetNames(items,previous,eve,character){
 const old=new Map((previous?.items||[]).map(a=>[a.item_id,a.custom_name])),named=items.filter(a=>a.is_singleton);let complete=true;
 for(const item of named)if(old.get(item.item_id))item.custom_name=old.get(item.item_id);
 for(let i=0;i<named.length;i+=1000){const batch=named.slice(i,i+1000),ids=batch.map(a=>a.item_id),wanted=new Set(ids);
  try{const result=await eve.request('/characters/'+character.id+'/assets/names/',character,'POST',ids),rows=result.data;
   if(!Array.isArray(rows)||rows.some(r=>!Number.isSafeInteger(r.item_id)||!wanted.has(r.item_id)||typeof r.name!=='string')||new Set(rows.map(r=>r.item_id)).size!==rows.length)throw Error('Invalid names');
   const names=new Map(rows.map(r=>[r.item_id,r.name]));for(const item of batch){if(!names.has(item.item_id)){complete=false;continue;}const name=names.get(item.item_id);if(name&&name!=='None')item.custom_name=name.slice(0,1000);else delete item.custom_name;}
  }catch{complete=false;}
 }
 return {names_status:complete?'complete':'partial',names_checked:complete?Date.now():previous?.names_checked||null};
}
