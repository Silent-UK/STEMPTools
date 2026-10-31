// Station/citadel IDs are not solar-system IDs. Resolve their system before region.
export function corporateLocations({db,eve,request,snapshot}){
 return async function resolveLocation(id,row){
  const known=snapshot().structures.find(s=>s.id===id);
  if(known?.type_id&&known.system&&known.region)return {name:known.name,type_id:known.type_id,system:known.system,region:known.region};
  const key='/tools/corp-location-v3/'+id,old=db.prepare('SELECT * FROM public_cache WHERE path=?').get(key);
  if(old?.expires>Date.now())return JSON.parse(old.data);
  let place={},system=null,region=known?.region||null,systemName=known?.system||null;
  try{
   if(id>=30000000&&id<34000000){system=await eve.publicGet('/universe/systems/'+id);place={name:system.name};}
   else place=id>=1000000000000?(await request('/universe/structures/'+id,row)).data:await eve.publicGet('/universe/stations/'+id);
  }catch{}
  const systemId=place?.solar_system_id||place?.system_id;
  try{
   if(!system&&systemId)system=await eve.publicGet('/universe/systems/'+systemId);
   if(system?.name)systemName=system.name;
   if(system?.constellation_id){const constellation=await eve.publicGet('/universe/constellations/'+system.constellation_id);if(constellation?.region_id)region=(await eve.publicGet('/universe/regions/'+constellation.region_id)).name||region;}
  }catch{}
  const result={name:place?.name||known?.name||null,type_id:place?.type_id||known?.type_id||null,system:systemName,region};
  db.prepare('INSERT INTO public_cache VALUES(?,?,?) ON CONFLICT(path) DO UPDATE SET data=excluded.data,expires=excluded.expires').run(key,JSON.stringify(result),Date.now()+(region&&systemName?3600000:60000));
  return result;
 };
}
