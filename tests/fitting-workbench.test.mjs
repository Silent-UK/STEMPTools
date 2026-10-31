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
