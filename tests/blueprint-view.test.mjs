import test from 'node:test';
import assert from 'node:assert/strict';
import {featureUI} from '../public/feature-view.mjs';

test('corporation blueprints render populated and empty locations without standings state',async()=>{
 const previous=globalThis.document;
 globalThis.document={addEventListener(){}};
 try {
  for(const rows of [[],[{item_id:1,type_id:1,name:'Example Blueprint',location_id:42,location_name:'Example Station',quantity:-1,material_efficiency:10,time_efficiency:20}]]){
   const ui=featureUI({api:async path=>{assert.equal(path,'/corporation/blueprints');return {rows};},intro:title=>title,context:()=>({chars:[],me:{}}),refresh(){},toast(){}});
   const html=await ui.render('corp-blueprints');
   assert.match(html,/Corporation Blueprints/);
   assert.match(html,/name="bpo"/);
   assert.match(html,/name="bpc"/);
   assert.doesNotMatch(html,/data-standing-pilot/);
   assert.match(html,rows.length?/Example Blueprint/:/No matching blueprints/);
  }
 } finally {if(previous===undefined)delete globalThis.document;else globalThis.document=previous;}
});
