import test from 'node:test';
import assert from 'node:assert/strict';
import {collectAssetNames} from '../lib/asset-names.mjs';
test('asset name enrichment batches singletons, preserves old names on failure and clears confirmed unnamed items',async()=>{
 const items=[{item_id:1,is_singleton:true},{item_id:2,is_singleton:true},{item_id:3,is_singleton:false}],old={items:[{item_id:1,custom_name:'AIR'},{item_id:2,custom_name:'Old'}],names_checked:10};
 let called=0;const result=await collectAssetNames(items,old,{request:async(path,c,method,ids)=>{called++;assert.equal(path,'/characters/100/assets/names/');assert.equal(method,'POST');assert.deepEqual(ids,[1,2]);throw Error('ESI unavailable');}},{id:100});
 assert.equal(called,1);assert.equal(result.names_status,'partial');assert.equal(result.names_checked,10);assert.equal(items[0].custom_name,'AIR');
 const refreshed=await collectAssetNames(items,old,{request:async()=>({data:[{item_id:1,name:'AIR II'},{item_id:2,name:'None'}]})},{id:100});assert.equal(refreshed.names_status,'complete');assert.equal(items[0].custom_name,'AIR II');assert.equal(items[1].custom_name,undefined);
});
test('partial or invalid name responses cannot overwrite unrelated inventory; batches stay within 1000 IDs',async()=>{
 const items=Array.from({length:1001},(_,i)=>({item_id:i+1,is_singleton:true})),sizes=[];
 const result=await collectAssetNames(items,null,{request:async(_path,_c,_method,ids)=>{sizes.push(ids.length);return {data:ids.map(item_id=>({item_id,name:'AIR'}))};}},{id:100});assert.deepEqual(sizes,[1000,1]);assert.equal(result.names_status,'complete');
 const invalid=await collectAssetNames([{item_id:1,is_singleton:true}],{items:[{item_id:1,custom_name:'Keep'}]},{request:async()=>({data:[{item_id:999,name:'Wrong'}]})},{id:100});assert.equal(invalid.names_status,'partial');
});
