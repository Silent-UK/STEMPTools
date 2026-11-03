import {isSiteAdmin} from './admin.mjs';
const text=value=>String(value||'').trim().toLowerCase().slice(0,150);
export function pilotAssetSearch(db,cat,actor,config,query={}){
 const q=text(query.q),location=text(query.location),type=text(query.type),name=text(query.name),category=text(query.category),pilot=Number(query.character)||0,terms=q.split(/\s+/).filter(Boolean).slice(0,12),cache=new Map(),rows=[],sources=[];let protectedPilots=0;
 const lookup=id=>{if(!cache.has(id))cache.set(id,cat.type(id)||{name:'Type '+id});return cache.get(id);};
 const searching=Boolean(q||location||type||name||category||pilot);
 for(const c of db.prepare("SELECT c.id,c.name,c.user_id,u.admin,u.main_id,s.data,s.updated,e.message error FROM characters c JOIN users u ON u.id=c.user_id LEFT JOIN snapshots s ON s.character_id=c.id AND s.kind='assets' LEFT JOIN sync_errors e ON e.character_id=c.id AND e.kind='assets' ORDER BY c.name COLLATE NOCASE,c.id").all()){
  if(isSiteAdmin(c,config.owner)&&c.user_id!==actor.user_id){protectedPilots++;continue;}if(pilot&&pilot!==c.id)continue;
  const data=c.data?JSON.parse(c.data):null;sources.push({id:c.id,name:c.name,updated:c.updated||null,error:c.error||null,names_status:data?.names_status||'not-collected',names_checked:data?.names_checked||null});if(!data||!searching)continue;
  const items=data.items||[],byId=new Map(items.map(a=>[String(a.item_id),a]));
  for(const a of items){if(!(a.quantity>0))continue;const t=lookup(a.type_id),typeName=t.name,custom=a.custom_name||'',root=a.root_location_id??a.location_id,place=data.locations?.[root]||'Location '+root,trail=[],seen=new Set([String(a.item_id)]);let parent=byId.get(String(a.location_id));
   while(parent&&!seen.has(String(parent.item_id))){seen.add(String(parent.item_id));trail.unshift(parent.custom_name||lookup(parent.type_id).name);parent=byId.get(String(parent.location_id));}
   const fullLocation=[place,...trail].join(' / '),search=[c.name,custom,typeName,fullLocation].join(' ').toLowerCase();
   if((terms.length&&!terms.every(word=>search.includes(word)))||(location&&!fullLocation.toLowerCase().includes(location))||(type&&!typeName.toLowerCase().includes(type))||(name&&(query.exact==='1'?custom.toLowerCase()!==name:!custom.toLowerCase().includes(name)))||(category==='ships'&&t.category_id!==6)||(category==='modules'&&t.category_id!==7))continue;
   rows.push({character_id:c.id,character:c.name,item_id:a.item_id,location:place,container:trail.join(' / '),name:custom||'—',type:typeName,type_id:a.type_id,quantity:a.quantity,updated:c.updated,names_status:data.names_status||'not-collected',error:c.error||null});
  }
 }
 rows.sort((a,b)=>a.character.localeCompare(b.character)||a.location.localeCompare(b.location)||a.type.localeCompare(b.type)||a.name.localeCompare(b.name)||a.item_id-b.item_id);
 const total=rows.length,offset=Math.min(Math.max(0,Math.floor(Number(query.offset)||0)),Math.max(0,Math.floor((total-1)/100)*100));return {rows:rows.slice(offset,offset+100),total,offset,searching,protected_pilots:protectedPilots,sources};
}
