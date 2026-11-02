export function blueprintLocations(rows,{q='',bpo=true,bpc=true}={}){
 const groups=new Map(),query=q.toLowerCase().trim();
 for(const row of rows){const copy=row.quantity===-2;if(copy?!bpc:!bpo)continue;
  if(query&&![row.name,row.pilot,row.location,row.location_id].join(' ').toLowerCase().includes(query))continue;
  const id=String(row.root_location_id??row.location_id??'unknown');
  if(!groups.has(id))groups.set(id,{id,name:row.location||'Location '+id,rows:[],originals:0,copies:0});
  const group=groups.get(id);group.rows.push(row);if(copy)group.copies++;else group.originals++;
 }
 for(const group of groups.values())group.rows.sort((a,b)=>Number(a.quantity===-2)-Number(b.quantity===-2)||a.name.localeCompare(b.name)||a.item_id-b.item_id);
 return [...groups.values()].sort((a,b)=>a.name.localeCompare(b.name)||a.id.localeCompare(b.id));
}
