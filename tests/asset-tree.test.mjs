import {test} from 'node:test';
import assert from 'node:assert/strict';
import {assetTree,assetMatches,stackAssetRows} from '../public/asset-tree.mjs';
const items=[{item_id:1,name:'Bestower',location_id:99,location:'Station',location_flag:'Hangar'},{item_id:2,name:'Expanded Cargohold',location_id:1,location:'Station',location_flag:'LoSlot0'},{item_id:3,name:'Liquid Ozone',location_id:99,location:'Station',location_flag:'Hangar'},{item_id:4,name:'Medium Cargohold Optimization',location_id:1,location:'Station',location_flag:'RigSlot0'}];
test('fittings nest under the exact ship before loose items',()=>{assert.deepEqual(assetTree(items).map(a=>[a.item_id,a.depth]),[[1,0],[2,1],[4,1],[3,0]]);});
test('module searches retain ship context without inflating matching counts',()=>{const rows=assetMatches(items,'expanded','');assert.deepEqual(rows.map(a=>[a.item_id,a.context]),[[1,true],[2,false]]);});
test('ship searches show fitted modules and location filtering remains strict',()=>{assert.equal(assetMatches(items,'bestower','station').length,3);assert.equal(assetMatches(items,'bestower','elsewhere').length,0);});
test('malformed parent cycles do not lose rows or loop',()=>{assert.equal(assetTree([{...items[0],location_id:2},items[1]]).length,2);});

test('identical fitted modules stack across slots on the same ship',()=>{
 const ship={item_id:10,type_id:100,name:'Ship',location_id:99,root_location_id:99,character_id:1,quantity:1,location_flag:'Hangar'};
 const modules=Array.from({length:6},(_,i)=>({item_id:20+i,type_id:200,name:'Heavy Missile Launcher II',location_id:10,root_location_id:99,character_id:1,quantity:1,location_flag:'HiSlot'+i}));
 const rows=stackAssetRows([ship,...modules]);assert.equal(rows.length,2);assert.equal(rows[1].quantity,6);assert.equal(rows[1].depth,1);assert.equal(rows[1].location_flag,'Hi slots');assert.equal(modules[0].quantity,1);
});
test('loose stacks sum quantities while pilots containers and blueprint variants stay separate',()=>{
 const a={item_id:1,type_id:200,name:'Item',location_id:99,root_location_id:99,character_id:1,quantity:20,location_flag:'Hangar'};
 const rows=stackAssetRows([a,{...a,item_id:2,quantity:30},{...a,item_id:3,character_id:2},{...a,item_id:4,location_id:88},{...a,item_id:5,is_blueprint_copy:true}]);assert.equal(rows.length,4);assert.equal(rows.find(x=>x.item_id===1).quantity,50);
});
test('same-type ships with fittings remain distinct and keep their modules',()=>{
 const ship={item_id:1,type_id:100,name:'Ship',location_id:99,root_location_id:99,character_id:1,quantity:1,location_flag:'Hangar'};
 const module={item_id:3,type_id:200,name:'Module',location_id:1,root_location_id:99,character_id:1,quantity:1,location_flag:'HiSlot0'};
 const rows=stackAssetRows([ship,{...ship,item_id:2},module,{...module,item_id:4,location_id:2}]);assert.deepEqual(rows.map(x=>[x.item_id,x.depth]),[[1,0],[3,1],[2,0],[4,1]]);
});
