import test from 'node:test';
import assert from 'node:assert/strict';
import {collectLoyalty,LOYALTY_SCOPE} from '../lib/loyalty.mjs';
import {loyaltyView} from '../public/loyalty-view.mjs';
const pilot={id:42,scopes:JSON.stringify([LOYALTY_SCOPE])};
test('LP requires scope and validates balances before saving',async()=>{
 await assert.rejects(collectLoyalty({...pilot,scopes:'[]'},{}),/Reconnect/);
 for(const data of [{},[{corporation_id:1,loyalty_points:-1}],[{corporation_id:1,loyalty_points:'10'}]])await assert.rejects(collectLoyalty(pilot,{get:async()=>data}),/Invalid/);
});
test('LP collection keeps corporation identity when name lookup fails and propagates balance errors',async()=>{
 const data=await collectLoyalty(pilot,{get:async path=>{assert.equal(path,'/characters/42/loyalty/points');return [{corporation_id:10,loyalty_points:123}]},publicGet:async()=>{throw Error('unavailable')}});
 assert.deepEqual(data.balances,[{corporation_id:10,loyalty_points:123,corporation:'Corporation 10'}]);
 await assert.rejects(collectLoyalty(pilot,{get:async()=>{throw Error('ESI failed')}}),/ESI failed/);
});
test('LP view escapes labels, omits zero balances, distinguishes missing and saved data',()=>{
 const html=loyaltyView([{id:42,name:'<Pilot>',error:'failed',data:{balances:[{corporation_id:1,corporation:'<Corp>',loyalty_points:1234},{corporation_id:2,corporation:'Zero',loyalty_points:0}]}},{id:43,name:'Missing',data:null}]);
 assert(html.includes('1,234 LP'));assert(html.includes('&lt;Pilot&gt;'));assert(html.includes('&lt;Corp&gt;'));assert(!html.includes('>Zero<'));assert(html.includes('Reconnect'));assert(html.includes('Saved balances retained'));
});
