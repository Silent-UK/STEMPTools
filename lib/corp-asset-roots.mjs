// Structures are locations themselves, even when the asset list also places them in space.
export function corporationAssetRoots(items,cat,structures=[]){
 const byId=new Map(items.map(a=>[a.item_id,a])),known=new Set(structures.map(s=>s.id));
 const anchors=new Set(items.filter(a=>{const type=cat.type(a.type_id);return known.has(a.item_id)||type?.category_id===65||type?.group_id===15||type?.group_id===365;}).map(a=>a.item_id));
 return items.map(a=>{
  let p=a;const seen=new Set([a.item_id]);
  while(!anchors.has(p.item_id)&&byId.has(p.location_id)&&!seen.has(p.location_id)){
   seen.add(p.location_id);p=byId.get(p.location_id);
  }
  return {...a,root_location_id:anchors.has(p.item_id)?p.item_id:p.location_id,name:cat.type(a.type_id)?.name||'Type '+a.type_id};
 });
}
