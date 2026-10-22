// Parent identity is per pilot, never a ship name or type ID.
export function assetTree(items) {
 const byId=new Map(items.map(a=>[String(a.item_id),a])),children=new Map();
 const roots=[];
 for(const a of items){const parent=byId.get(String(a.location_id));if(parent&&parent!==a){const key=String(parent.item_id);if(!children.has(key))children.set(key,[]);children.get(key).push(a);}else roots.push(a);}
 const result=[],seen=new Set();
 const walk=(rows,depth)=>{for(const a of [...rows].sort((a,b)=>a.name.localeCompare(b.name)||String(a.item_id).localeCompare(String(b.item_id)))){const key=String(a.item_id);if(seen.has(key))continue;seen.add(key);result.push({...a,depth});walk(children.get(key)||[],depth+1);}};
 walk(roots,0);walk(items.filter(a=>!seen.has(String(a.item_id))),0);return result;
}
export function assetMatches(items,q,location) {
 const byId=new Map(items.map(a=>[String(a.item_id),a]));
 const matches=items.filter(a=>a.name.toLowerCase().includes(q)&&a.location.toLowerCase().includes(location));
 const direct=new Set(matches.map(a=>String(a.item_id))),included=new Set(direct);
 for(const item of matches){let parent=byId.get(String(item.location_id));const seen=new Set([String(item.item_id)]);while(parent&&!seen.has(String(parent.item_id))){seen.add(String(parent.item_id));included.add(String(parent.item_id));parent=byId.get(String(parent.location_id));}}
 // When a ship matches, show its fitted modules too; cargo still obeys the search.
 for(const item of items)if(direct.has(String(item.location_id))&&/^(Hi|Med|Lo|Rig|SubSystem|Service)Slot\d+$/.test(item.location_flag))included.add(String(item.item_id));
 return items.filter(a=>included.has(String(a.item_id))).map(a=>({...a,context:!direct.has(String(a.item_id))}));
}
