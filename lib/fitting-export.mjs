import {simulatedChargeQuantity} from './fitting-simulation.mjs';
export function eveFittingPayload(fit){
 if(fit.name.length>50)throw Object.assign(Error('EVE fitting names can contain at most 50 characters. Shorten the fitting name before saving to EVE.'),{status:400});
 const bases={'Low slots':'LoSlot','Mid slots':'MedSlot','High slots':'HiSlot',Rigs:'RigSlot',Subsystems:'SubSystemSlot'},limits={Rigs:3,Subsystems:4},next={},items=[],cargo=new Map();
 const carry=(id,quantity)=>cargo.set(id,(cargo.get(id)||0)+quantity);
 for(const item of fit.items){
  if(item.section==='Implants')continue;
  if(item.section==='Cargo'){carry(item.id,item.quantity);continue;}
  if(item.section==='Drones'){items.push({type_id:item.id,quantity:item.quantity,flag:item.category===87?'FighterBay':'DroneBay'});continue;}
  if(!(item.section in bases)||(next[item.section]||0)>=(limits[item.section]||8))throw Object.assign(Error('Too many modules in '+item.section+' for an EVE saved fit.'),{status:400});
  const index=next[item.section]||0;next[item.section]=index+1;items.push({type_id:item.id,quantity:1,flag:bases[item.section]+index});
  if(item.charge_id)carry(item.charge_id,simulatedChargeQuantity(item.id,item.charge_id));
 }
 for(const [type_id,quantity]of cargo)items.push({type_id,quantity,flag:'Cargo'});
 if(items.length<1||items.length>512)throw Object.assign(Error('EVE fittings require 1–512 item rows. Add at least one fitted item or cargo.'),{status:400});
 return {name:fit.name,description:'Saved from Tools. Ammunition is carried in cargo; implants, module heat and activation states are not part of an EVE saved fitting.',ship_type_id:fit.ship_id,items};
}
