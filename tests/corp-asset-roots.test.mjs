import test from 'node:test';
import assert from 'node:assert/strict';
import {corporationAssetRoots} from '../lib/corp-asset-roots.mjs';

test('owned structures in the same system keep separate contents and fittings',()=>{
 const cat={type:id=>({name:'Type '+id,category_id:id===1?65:6})};
 const rows=[{item_id:101,type_id:1,location_id:30000001},{item_id:102,type_id:1,location_id:30000001},{item_id:201,type_id:2,location_id:101},{item_id:202,type_id:2,location_id:102},{item_id:301,type_id:2,location_id:201}];
 const result=corporationAssetRoots(rows,cat);
 assert.deepEqual(result.map(a=>a.root_location_id),[101,102,101,102,101]);
 assert.equal(rows[0].root_location_id,undefined);
});

test('external stations, POS towers, loose space assets and cycles retain valid roots',()=>{
 const cat={type:id=>({name:'Type '+id,category_id:23,group_id:id===1?365:0})};
 const rows=[{item_id:101,type_id:1,location_id:30000001},{item_id:102,type_id:2,location_id:101},{item_id:103,type_id:2,location_id:30000001},{item_id:104,type_id:2,location_id:60000001},{item_id:105,type_id:2,location_id:106},{item_id:106,type_id:2,location_id:105}];
 const result=corporationAssetRoots(rows,cat);
 assert.deepEqual(result.slice(0,4).map(a=>a.root_location_id),[101,101,30000001,60000001]);
 assert.equal(result.length,rows.length);
});

test('corporation structure snapshot identifies anchors without catalogue metadata',()=>{
 const result=corporationAssetRoots([{item_id:101,type_id:1,location_id:30000001},{item_id:102,type_id:2,location_id:101}],{type:()=>null},[{id:101}]);
 assert.deepEqual(result.map(a=>a.root_location_id),[101,101]);
});
