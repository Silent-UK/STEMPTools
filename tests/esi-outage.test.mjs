import test from 'node:test';
import assert from 'node:assert/strict';
import {exchange} from '../lib/eve.mjs';
import {verifyCorporation} from '../lib/corp.mjs';

test('SSO outages and rate limits are distinct from invalid refresh credentials',async()=>{
 const previous=globalThis.fetch;
 try {
  for(const status of [500,503,420,429,400,401]){
   globalThis.fetch=async()=>({ok:false,status});
   await assert.rejects(exchange({client:'id',secret:'secret'},{}),error=>error.status===([400,401].includes(status)?401:503)&&error.transient===![400,401].includes(status));
  }
 } finally {globalThis.fetch=previous;}
});
test('incomplete ESI membership does not become confirmed role loss',async()=>{
 await assert.rejects(verifyCorporation('token',100,async()=>({ok:true,json:async()=>[]})),error=>error.status===502&&!error.corporationRoleDenied);
 for(const status of [401,403,503,429]){
  await assert.rejects(verifyCorporation('token',100,async url=>url.includes('/affiliation')?{ok:true,json:async()=>[{character_id:100,corporation_id:300}]}:{ok:false,status}),error=>error.status===([401,403].includes(status)?401:503));
 }
});
