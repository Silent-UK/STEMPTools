import test from 'node:test';
import assert from 'node:assert/strict';
import {featureUI} from '../public/feature-view.mjs';

test('corporation blueprints render populated and empty locations without standings state',async()=>{
 const previous=globalThis.document;
 globalThis.document={addEventListener(){}};
 try {
  for(const rows of [[],[{item_id:1,type_id:1,name:'Example Blueprint',location_id:42,location_name:'Example Station',quantity:-1,material_efficiency:10,time_efficiency:20}]]){
   const ui=featureUI({api:async path=>{if(path==='/material-planner/corporation')return {blueprints:[]};assert.equal(path,'/corporation/blueprints');return {rows};},intro:title=>title,context:()=>({chars:[],me:{}}),refresh(){},toast(){}});
   const html=await ui.render('corp-blueprints');
   assert.match(html,/Corporation Blueprints/);
   assert.match(html,/name="bpo"/);
   assert.match(html,/name="bpc"/);
   assert.doesNotMatch(html,/data-standing-pilot/);
   assert.match(html,rows.length?/Example Blueprint/:/No matching blueprints/);
  }
 } finally {if(previous===undefined)delete globalThis.document;else globalThis.document=previous;}
});

test('personal blueprint library exposes owner, filters and a planner calculation for each manufacturing blueprint',async()=>{
 const previous=globalThis.document;globalThis.document={addEventListener(){}};
 try{
  const bp={item_id:1,type_id:681,name:'Manufacturing Blueprint',location_id:42,location:'Station',quantity:-2,runs:5};
  const ui=featureUI({api:async path=>path==='/operations/industry'?[{id:100,name:'Pilot',updated:1,data:{jobs:[],blueprints:[bp]}}]:{blueprints:[{...bp,selection:'100:1'}]},intro:title=>title,context:()=>({chars:[{id:100,name:'Pilot'}],me:{}}),refresh(){},toast(){}});
  const html=await ui.render('blueprints');
  assert.match(html,/Manufacturing Blueprint/);assert.match(html,/name="pilot"/);assert.match(html,/name="bpc"/);assert.match(html,/data-blueprint-calculate="100:1"/);assert.match(html,/data-material-area="personal"/);assert.match(html,/Pilot/);
 }finally{if(previous===undefined)delete globalThis.document;else globalThis.document=previous;}
});
