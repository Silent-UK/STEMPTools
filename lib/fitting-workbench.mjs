import {simulatorItem} from './fitting-simulation.mjs';
import slots from './fitting-slots.json' with {type:'json'};
import {parseFitting} from './plans.mjs';

export const FIT_SECTIONS=['Low slots','Mid slots','High slots','Rigs','Subsystems','Drones','Cargo','Implants'];
const fail=message=>{throw Object.assign(Error(message),{status:400});};
export function fittingSection(type){return type.category_id===18||type.category_id===87?'Drones':type.category_id===20?'Implants':slots[type.id]||'Cargo';}
export function workbenchItem(id,cat){
 const t=cat.type(Number(id));if(!t||![6,7,8,18,20,32,87].includes(t.category_id))fail('Select a fitting item from the catalogue.');
 return {id:t.id,name:t.name,category:t.category_id,group:t.group_id,volume:t.volume||0,section:fittingSection(t),attributes:t.attributes||{},...(simulatorItem(t.id)||{})};
}
export function importWorkbench(text,cat){
 const parsed=parseFitting(text,cat),items=[];
 for(const line of text.trim().split(/\r?\n/).slice(1)){
  if(!line.trim()||/^\[Empty .* slot\]$/i.test(line.trim()))continue;
  const [raw,charge,...extra]=line.trim().split(/,\s*/);if(extra.length)fail('Only one charge type can be loaded in a module.');
  const match=raw.match(/^(.*?)(?:\s+x(\d+))?$/),item=workbenchItem(cat.named(match[1].trim()),cat);
  const quantity=Number(match[2]||1),section=match[2]&&item.section!=='Drones'?'Cargo':item.section;
  items.push({id:item.id,section,quantity,charge_id:charge?cat.named(charge.replace(/\s+x\d+$/,'').trim()):null,state:'active',launched:0});
 }
 return validateWorkbench({ship_id:parsed.ship,name:parsed.name,items},cat);
}
export function validateWorkbench(input,cat){
 if(!input||typeof input!=='object'||Array.isArray(input))fail('Choose a ship first.');
 const ship=workbenchItem(input.ship_id,cat);if(ship.category!==6)fail('Select a ship hull.');
 if(typeof input.name!=='string'||!input.name.trim()||input.name.length>150||/[\[\]\r\n]/.test(input.name))fail('Enter a fitting name up to 150 characters, without brackets.');
 if(!Array.isArray(input.items)||input.items.length>500)fail('A fitting can contain up to 500 item rows.');
 const items=input.items.map(row=>{
  if(!row||typeof row!=='object')fail('Invalid fitting item.');
  const item=workbenchItem(row.id,cat),section=row.section||item.section;
  if(item.category===6||!FIT_SECTIONS.includes(section)||(section!=='Cargo'&&section!==item.section))fail('This item cannot go in that slot.');
  const quantity=Number(row.quantity??1);if(!Number.isSafeInteger(quantity)||quantity<1||quantity>100000)fail('Item quantities must be whole numbers from 1 to 100,000.');
  if(!['Cargo','Drones'].includes(section)&&quantity!==1)fail('Add fitted modules as individual slots.');
  let state=row.state||'active';if(!['offline','online','active','overheated'].includes(state))fail('Invalid module state.');
  if(section==='Rigs'||(item.canActivate===false&&state!=='offline'))state='online';
  if(state==='overheated'&&!item.canOverheat)fail('This module cannot be overheated.');
  let charge=null;if(row.charge_id){charge=workbenchItem(row.charge_id,cat);if(charge.category!==8||['Cargo','Drones','Implants'].includes(section))fail('Select ammunition for a fitted module.');
   const groups=[604,605,606,609,610].map(id=>item.attributes[id]).filter(Boolean);
   if(!groups.includes(charge.group)||(item.attributes[128]&&charge.attributes[128]!==item.attributes[128]))fail('This ammunition does not fit that module.');
  }
  const launched=Number(row.launched||0);if(!Number.isInteger(launched)||launched<0||launched>quantity||launched>5||(section!=='Drones'&&launched))fail('Choose 0–5 launched drones, within the quantity carried.');
  return {...item,section,quantity,state,charge:charge?{id:charge.id,name:charge.name,attributes:charge.attributes}:null,charge_id:charge?.id||null,launched};
 });
 return {ship_id:ship.id,name:input.name.trim(),ship,items};
}
export function workbenchEFT(fit){
 const lines=[`[${fit.ship.name}, ${fit.name}]`];
 for(const section of FIT_SECTIONS){lines.push('');for(const row of fit.items.filter(r=>r.section===section))lines.push(row.name+(['Cargo','Drones'].includes(section)?' x'+row.quantity:'')+(row.charge?', '+row.charge.name:''));}
 return lines.join('\n');
}
export function compactWorkbench(fit){return {ship_id:fit.ship_id,name:fit.name,items:fit.items.map(r=>({id:r.id,section:r.section,quantity:r.quantity,state:r.state,charge_id:r.charge_id,launched:r.launched}))};}

export {simulateWorkbench as workbenchStats} from './fitting-simulation.mjs';
