import {test} from 'node:test';
import assert from 'node:assert/strict';
import {assetTree,assetMatches} from '../public/asset-tree.mjs';
const items=[{item_id:1,name:'Bestower',location_id:99,location:'Station',location_flag:'Hangar'},{item_id:2,name:'Expanded Cargohold',location_id:1,location:'Station',location_flag:'LoSlot0'},{item_id:3,name:'Liquid Ozone',location_id:99,location:'Station',location_flag:'Hangar'},{item_id:4,name:'Medium Cargohold Optimization',location_id:1,location:'Station',location_flag:'RigSlot0'}];
test('fittings nest under the exact ship before loose items',()=>{assert.deepEqual(assetTree(items).map(a=>[a.item_id,a.depth]),[[1,0],[2,1],[4,1],[3,0]]);});
test('module searches retain ship context without inflating matching counts',()=>{const rows=assetMatches(items,'expanded','');assert.deepEqual(rows.map(a=>[a.item_id,a.context]),[[1,true],[2,false]]);});
test('ship searches show fitted modules and location filtering remains strict',()=>{assert.equal(assetMatches(items,'bestower','station').length,3);assert.equal(assetMatches(items,'bestower','elsewhere').length,0);});
test('malformed parent cycles do not lose rows or loop',()=>{assert.equal(assetTree([{...items[0],location_id:2},items[1]]).length,2);});
