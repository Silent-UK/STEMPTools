import test from 'node:test';
import assert from 'node:assert/strict';
import {importWorkbench,validateWorkbench,workbenchEFT,compactWorkbench,workbenchStats} from '../lib/fitting-workbench.mjs';
const types={1:{id:1,name:'Test Ship',category_id:6,attributes:{14:2,13:1,12:2,48:100,11:50,1132:400,283:25,1271:25,263:100,271:1,274:.8,273:.6,272:.5,482:100,55:100000}},2048:{id:2048,name:'Test Module',category_id:7,attributes:{50:20,30:10,604:83,6:10,73:5000}},2:{id:2,name:'Test Ammo',category_id:8,group_id:83,volume:.01,attributes:{}},3:{id:3,name:'Wrong Ammo',category_id:8,group_id:99,attributes:{}},4:{id:4,name:'Test Drone',category_id:18,volume:5,attributes:{1272:5}}};
const cat={type:id=>types[id],named:name=>Object.values(types).find(t=>t.name===name)?.id};
const source={ship_id:1,name:'Review fit',items:[{id:2048,quantity:1,state:'active',charge_id:2},{id:4,quantity:5,launched:5}]};
test('workbench keeps modules, loaded ammunition, drones and cargo through EFT import/export',()=>{
 const fit=validateWorkbench(source,cat),eft=workbenchEFT(fit),restored=importWorkbench(eft,cat);
 assert.equal(restored.ship_id,1);assert.equal(restored.items[0].charge_id,2);assert.equal(restored.items[1].quantity,5);
 assert.equal(compactWorkbench(fit).items[1].launched,5);
 const cargo=importWorkbench('[Test Ship, Cargo]\nTest Module x2',cat);assert.equal(cargo.items[0].section,'Cargo');assert.equal(cargo.items[0].quantity,2);
});
test('workbench rejects incompatible charges, forged slots, invalid quantities and excess launched drones',()=>{
 for(const row of [{id:2048,charge_id:3},{id:2048,section:'High slots'},{id:2048,quantity:2},{id:4,quantity:1,launched:2},{id:4,quantity:5,launched:6},{id:4,quantity:Infinity}])assert.throws(()=>validateWorkbench({...source,items:[row]},cat));
 assert.throws(()=>validateWorkbench({...source,name:'Invalid\nName'},cat));assert.throws(()=>validateWorkbench({...source,ship_id:2048},cat));
});
test('base resources exclude offline modules and drone bandwidth uses launched count',()=>{
 const fit=validateWorkbench(source,cat),stats=workbenchStats(fit);
 assert.equal(stats.resources.cpu.used,20);assert.equal(stats.resources.bandwidth.used,25);assert.equal(stats.resources.drones.used,25);assert.equal(stats.capacitor.drain,2);assert.equal(stats.capacitor.peak,2.5);
 fit.items[0].state='offline';assert.equal(workbenchStats(fit).resources.cpu.used,0);assert.equal(workbenchStats(fit).capacitor.drain,0);
 assert.deepEqual(stats.layers[0].resists,[0,19.999999999999996,40,50]);
});


test('pilot stats apply active core skill levels without changing the saved hull',()=>{
 const fit=validateWorkbench(source,cat),base=workbenchStats(fit),profile={id:100,name:'Skilled Pilot',updated:123,skills:[{skill_id:3426,active_skill_level:5,trained_skill_level:5},{skill_id:3413,active_skill_level:4},{skill_id:3418,active_skill_level:5},{skill_id:3417,active_skill_level:4},{skill_id:3419,active_skill_level:3},{skill_id:3436,active_skill_level:4}]};
 const stats=workbenchStats(fit,profile);
 assert.equal(stats.resources.cpu.total,125);assert.equal(stats.resources.powergrid.total,60);assert.equal(stats.capacitor.capacity,125);assert.equal(stats.capacitor.recharge,80);assert.equal(stats.layers[0].hp,114.99999999999999);
 assert.equal(stats.profile.name,'Skilled Pilot');assert.equal(stats.profile.available,true);assert.match(stats.warnings.join(' '),/Drones skill limit/);
 assert.equal(base.resources.cpu.total,100);assert.equal(fit.ship.attributes[48],100);
 const inactive=workbenchStats(fit,{skills:[{skill_id:3426,active_skill_level:0,trained_skill_level:5}]});assert.equal(inactive.resources.cpu.total,100);
});
test('a pilot with no skill snapshot is explicitly shown as base values',()=>{
 const stats=workbenchStats(validateWorkbench(source,cat),{id:100,name:'Unsynced',skills:null});assert.equal(stats.profile.available,false);assert.equal(stats.resources.cpu.total,100);assert.match(stats.warnings.join(' '),/Sync this pilot/);
});
