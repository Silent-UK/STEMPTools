// AGPL-3.0-only. Tools integration of VYRAJ's licensed fitting engine.
import raw from './fitting-dogma.json' with {type:'json'};
import {Sde,Category} from '../vendor/vyraj/runtime/data/sde.mjs';
import {buildDogma,canActivate,canOverheat,canLoadCharge,chargesPerModule} from '../vendor/vyraj/runtime/engine/fit.mjs';
import {computeStats} from '../vendor/vyraj/runtime/engine/stats.mjs';
import {UNIFORM} from '../vendor/vyraj/runtime/engine/profiles.mjs';
const sde=new Sde(raw);
const sections={'High slots':'high','Mid slots':'mid','Low slots':'low',Rigs:'rig',Subsystems:'subsystem'};
const directions=['em','thermal','kinetic','explosive'];
const fail=message=>{throw Object.assign(Error(message),{status:400});};
export function simulatorItem(id){
 const type=sde.types.get(Number(id));if(!type)return null;
 return {canActivate:canActivate(sde,type.id),canOverheat:canOverheat(sde,type.id),canLoadCharge:type.effects.some(id=>sde.effects.get(id)?.name==='launcherFitted')||[604,605,606,609,610].some(id=>type.attrs.get(id)),...(()=>{const section=Object.entries(sections).find(([,slot])=>sde.hasEffect(type.id,({high:'hiPower',mid:'medPower',low:'loPower',rig:'rigSlot',subsystem:'subSystem'})[slot]))?.[0];return section?{section}:{};})()};
}
export function compatibleSimulationCharge(module,charge){return canLoadCharge(sde,module,charge);}
export function simulatedChargeQuantity(module,charge){return chargesPerModule(sde,module,charge);}
export function simulateWorkbench(fit,profile=null){
 if(!sde.types.has(fit.ship_id))fail('This hull is missing from the fitting engine data.');
 const engineFit={id:'tools',name:fit.name,shipId:fit.ship_id,slots:{high:[],mid:[],low:[],rig:[],subsystem:[]},drones:[],cargo:[],implants:[]};
 for(const row of fit.items){
  if(!sde.types.has(row.id))fail(row.name+' is missing from the fitting engine data.');
  const slot=sections[row.section];
  if(slot){const properties=simulatorItem(row.id);if(properties.section!==row.section)fail(row.name+' cannot be fitted in '+row.section+'.');
   if(row.state==='overheated'&&!properties.canOverheat)fail(row.name+' cannot be overheated.');
   if(row.charge_id&&!canLoadCharge(sde,row.id,row.charge_id))fail('Incompatible ammunition for '+row.name+'.');
   engineFit.slots[slot].push({typeId:row.id,state:row.state,chargeId:row.charge_id||undefined});
  }else if(row.section==='Drones')engineFit.drones.push({typeId:row.id,count:row.quantity,active:row.launched});
  else if(row.section==='Implants')engineFit.implants.push(row.id);
  else engineFit.cargo.push({typeId:row.id,count:row.quantity});
 }
 const skills=profile?new Map((profile.skills||[]).map(s=>[s.skill_id,s.active_skill_level])):new Map([...sde.types.values()].filter(t=>t.categoryId===Category.Skill).map(t=>[t.id,5]));
 const pilotName=profile?.name||'All Skills V';
 const dogma=buildDogma(sde,engineFit,{name:pilotName,skills,implants:profile?.implants||[]});
 const result=computeStats(sde,engineFit,dogma,UNIFORM);
 const r=result.resources,c=result.capacitor,v=result.navigation,t=result.targeting;
 const resource=r=>({...r,over:r.used>r.total+1e-6});
 const warnings=[...result.warnings];if(profile&&!profile.skills)warnings.unshift('Pilot skills are not synced: calculations currently use level 0. Sync this pilot before relying on these results.');
 const unsupported=[...dogma.modules,...dogma.skills,dogma.ship,...dogma.implants].flatMap(item=>item.type.effects.filter(id=>!sde.effects.has(id)));
 if(unsupported.length)warnings.push('Some effects are missing from the static data; verify this fit in EVE.');
 return {
  engine:'VYRAJ Dogma',profile:{id:profile?.id||null,name:pilotName,available:Boolean(profile?.skills),updated:profile?.updated||null,core:(profile?.skills||[]).filter(s=>s.active_skill_level>0&&sde.types.has(s.skill_id)).map(s=>({id:s.skill_id,name:sde.types.get(s.skill_id).name,level:s.active_skill_level}))},
  capacities:Object.fromEntries(Object.entries(sections).map(([section,slot])=>[section,r.slots[slot].total])),
  resources:{cpu:resource(r.cpu),powergrid:resource(r.power),calibration:resource(r.calibration),drones:resource(r.droneBay),bandwidth:resource(r.droneBandwidth),cargo:resource(r.cargo),turrets:resource(r.turrets),launchers:resource(r.launchers)},
  layers:['shield','armor','hull'].map(layer=>({name:layer[0].toUpperCase()+layer.slice(1),hp:result.defense.layers[layer].hp,ehp:result.defense.layers[layer].ehp,resists:directions.map(type=>100*result.defense.layers[layer].resists[type])})),
  warnings,offense:result.offense,defense:result.defense,heat:result.heat,
  capacitor:{...c,recharge:c.rechargeTime,peak:c.peakRecharge,drain:c.usage},
  navigation:{speed:v.maxVelocity,signature:v.signatureRadius,targeting:t.maxRange/1000,scan:t.scanResolution,targets:t.maxLocked,warp:v.warpSpeed,align:v.alignTime,mass:v.mass},
 };
}
