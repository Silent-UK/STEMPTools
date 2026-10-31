import {parseFitting} from './plans.mjs';
const clean=s=>String(s||'').replace(/[\r\n\[\]]/g,' ').trim();
export function fittingToEFT(fit,cat){
 const ship=cat.type(fit.ship_type_id);if(!ship||ship.category_id!==6)throw Error('This saved fitting has an unknown ship. Refresh the catalogue.');
 const order=['LoSlot','MedSlot','HiSlot','RigSlot','SubSystemSlot','ServiceSlot','DroneBay','FighterBay','Cargo'];
 const groups=new Map(order.map(k=>[k,[]]));
 if(!Array.isArray(fit.items)||fit.items.length>1000)throw Error('Invalid saved fitting items');
 for(const item of fit.items){
  const type=cat.type(item.type_id),flag=String(item.flag||''),group=order.find(k=>k.endsWith('Slot')?new RegExp('^'+k+'[0-7]$').test(flag):flag===k);
  if(!type||!group||!Number.isSafeInteger(item.quantity)||item.quantity<1||item.quantity>100000)throw Error('Saved fitting contains an unsupported item or slot. Nothing imported.');
  const name=clean(type.name);if(name.includes(','))throw Error('This item name cannot be represented safely in EFT.');
  if(group.endsWith('Slot')&&item.quantity>8)throw Error('Invalid fitted module quantity');
  groups.get(group).push({...item,name});
 }
 const lines=['['+clean(ship.name)+', '+clean(fit.name||'Imported Fitting')+']'];
 for(const [group,items] of groups){
  lines.push('');
  for(const item of items.sort((a,b)=>a.flag.localeCompare(b.flag)||a.name.localeCompare(b.name))){
   if(group.endsWith('Slot'))for(let i=0;i<item.quantity;i++)lines.push(item.name);
   else lines.push(item.name+' x'+item.quantity);
  }
 }
 const eft=lines.join('\n');parseFitting(eft,cat);return eft;
}
