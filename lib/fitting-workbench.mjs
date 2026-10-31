import slots from './fitting-slots.json' with {type:'json'};
import {parseFitting} from './plans.mjs';

export const FIT_SECTIONS=['Low slots','Mid slots','High slots','Rigs','Subsystems','Drones','Cargo','Implants'];
const fail=message=>{throw Object.assign(Error(message),{status:400});};
export function fittingSection(type){return type.category_id===18||type.category_id===87?'Drones':type.category_id===20?'Implants':slots[type.id]||'Cargo';}
export function workbenchItem(id,cat){
 const t=cat.type(Number(id));if(!t||![6,7,8,18,20,32,87].includes(t.category_id))fail('Select a fitting item from the catalogue.');
 return {id:t.id,name:t.name,category:t.category_id,group:t.group_id,volume:t.volume||0,section:fittingSection(t),attributes:t.attributes||{}};
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
  if(section==='Rigs'||(!item.attributes[6]&&!item.attributes[51]&&!item.attributes[73]&&state!=='offline'))state='online';
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

// Raw SDE values only. These deliberately do not claim to be a Dogma simulation.
export function workbenchStats(fit){
 const a=fit.ship.attributes,modules=fit.items.filter(r=>!['Cargo','Drones','Implants'].includes(r.section)&&r.state!=='offline');
 const sum=id=>modules.reduce((n,r)=>n+Number(r.attributes[id]||0),0);
 const resource=(used,total)=>({used,total:total||0,over:used>(total||0)});
 const capacities={'High slots':a[14]||0,'Mid slots':a[13]||0,'Low slots':a[12]||0,Rigs:a[1137]||0,Subsystems:a[1367]||0};
 const warnings=Object.entries(capacities).filter(([k,n])=>fit.items.filter(r=>r.section===k).length>n).map(([k,n])=>`${k}: too many modules for the base hull (${n}).`);
 const drones=fit.items.filter(r=>r.section==='Drones');
 const bandwidth=drones.reduce((n,r)=>n+(r.attributes[1272]||0)*r.launched,0),launched=drones.reduce((n,r)=>n+r.launched,0);
 if(launched>5)warnings.push('More than five drones selected for launch.');
 const resources={cpu:resource(sum(50),a[48]),powergrid:resource(sum(30),a[11]),calibration:resource(sum(1153),a[1132]),drones:resource(drones.reduce((n,r)=>n+r.volume*r.quantity,0),a[283]),bandwidth:resource(bandwidth,a[1271])};
 const layers=[['Shield',263,[271,274,273,272]],['Armor',265,[267,270,269,268]],['Hull',9,[113,110,109,111]]].map(([name,hp,ids])=>({name,hp:Number(a[hp]||0),resists:ids.map(id=>100*(1-Number(a[id]??1)))}));
 const peak=a[55]>0?2.5*(a[482]||0)/(a[55]/1000):0;
 const drain=modules.filter(r=>['active','overheated'].includes(r.state)).reduce((n,r)=>{const cycle=r.attributes[73]||r.attributes[51];return n+(cycle>0?(r.attributes[6]||0)/(cycle/1000):0);},0);
 return {capacities,resources,layers,warnings,capacitor:{capacity:a[482]||0,recharge:(a[55]||0)/1000,peak,drain},navigation:{speed:a[37]||0,signature:a[552]||0,targeting:(a[76]||0)/1000,scan:a[564]||0,targets:a[192]||0,warp:a[600]||0}};
}
