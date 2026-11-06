// Notifications identify transfers, not individual asset wraps. Keep them separate.
export const SAFETY_SCOPE='esi-characters.read_notifications.v1';
const DAY=86400000;
function scalar(text,key){return String(text||'').match(new RegExp('^'+key+':\\s*([0-9]+|true|false)\\s*$','m'))?.[1];}
function eveTime(value){
 try{const ticks=BigInt(value);const ms=Number(ticks/10000n-11644473600000n);return ms>=Date.UTC(2003,0,1)&&ms<Date.UTC(2200,0,1)?ms:null;}catch{return null;}
}
export function safetyTransfer(n){
 if(n.type!=='StructureItemsMovedToSafety'||scalar(n.text,'isCorpOwned')!=='false')return null;
 const started=Date.parse(n.timestamp),id=Number(n.notification_id);
 if(!Number.isFinite(started)||!Number.isSafeInteger(id))return null;
 const minimum=eveTime(scalar(n.text,'assetSafetyMinimumTimestamp'))||started+5*DAY;
 const full=eveTime(scalar(n.text,'assetSafetyFullTimestamp'))||started+20*DAY;
 if(minimum<started||full<minimum)return null;
 return {id,started,minimum,full,structure_id:Number(scalar(n.text,'structureID'))||null,system_id:Number(scalar(n.text,'solarsystemID'))||null,destination_id:Number(scalar(n.text,'newStationID'))||null};
}
export async function collectAssetSafety(c,eve,previous,now=Date.now()){
 const saved=previous?.asset_safety||{transfers:[],updated:null};
 if(!JSON.parse(c.scopes||'[]').includes(SAFETY_SCOPE))return {...saved,status:'scope_required'};
 try{
  const notifications=await eve.get('/characters/'+c.id+'/notifications',c);
  if(!Array.isArray(notifications))throw Error('Invalid notifications');
  const transfers=new Map((saved.transfers||[]).map(n=>[n.id,n]));
  for(const n of notifications){const transfer=safetyTransfer(n);if(transfer)transfers.set(transfer.id,transfer);}
  return {transfers:[...transfers.values()].sort((a,b)=>b.started-a.started).slice(0,500),updated:now,status:'current'};
 }catch{return {...saved,status:'unavailable'};}
}
export function safetyInventory(items){
 const byId=new Map(items.map(a=>[String(a.item_id),a])),safe=new Set(items.filter(a=>a.root_location_id===2004||a.location_id===2004||a.location_flag==='AssetSafety').map(a=>String(a.item_id)));
 for(const item of items){let parent=byId.get(String(item.location_id));const seen=new Set();while(parent&&!seen.has(String(parent.item_id))){const id=String(parent.item_id);seen.add(id);if(safe.has(id)){safe.add(String(item.item_id));break;}parent=byId.get(String(parent.location_id));}}
 return items.filter(a=>safe.has(String(a.item_id)));
}
