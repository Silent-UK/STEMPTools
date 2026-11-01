import test from 'node:test';
import assert from 'node:assert/strict';
import {materialPlan} from '../lib/industry-materials.mjs';
import {eveFittingPayload} from '../lib/fitting-export.mjs';
import {personalAlerts} from '../public/personal-alerts.mjs';
import {walletBreakdown} from '../public/wallet-view.mjs';
import {collectMarket} from '../lib/personal-market.mjs';
const cat={type:id=>({name:'Type '+id})};
test('manufacturing uses per-job rounding, ME, entered reductions and copy run limits',()=>{
 const blueprint={type_id:681,material_efficiency:10,quantity:-2,runs:10};
 const plan=materialPlan(blueprint,[{type_id:38,quantity:100}],{runs:2},cat);assert.equal(plan.materials[0].required,155);assert.equal(plan.materials[0].missing,55);
 assert.equal(materialPlan(blueprint,[],{runs:2,facility:1,rig:2},cat).materials[0].required,151);
 for(const options of [{runs:11},{runs:0},{runs:1.2},{runs:1,rig:-1},{runs:1,facility:51}])assert.throws(()=>materialPlan(blueprint,[],options,cat));
 assert.throws(()=>materialPlan({...blueprint,type_id:0},[],{},cat));
});
test('EVE fitting payload uses API flag names, aggregates cargo and excludes implants',()=>{
 const fit={ship_id:587,name:'Test',items:[{id:1,section:'High slots',quantity:1},{id:2,section:'High slots',quantity:1},{id:3,section:'Rigs',quantity:1},{id:4,section:'Drones',quantity:5,category:18},{id:5,section:'Cargo',quantity:10},{id:5,section:'Cargo',quantity:20},{id:6,section:'Implants',quantity:1}]};
 const payload=eveFittingPayload(fit);assert.deepEqual(payload.items.map(item=>item.flag),['HiSlot0','HiSlot1','RigSlot0','DroneBay','Cargo']);assert.equal(payload.items.at(-1).quantity,30);assert(!payload.items.some(item=>item.type_id===6));
 assert.throws(()=>eveFittingPayload({...fit,name:'x'.repeat(51)}));assert.throws(()=>eveFittingPayload({...fit,items:[]}));assert.throws(()=>eveFittingPayload({...fit,items:Array.from({length:4},()=>({id:1,section:'Rigs'}))}));
});
test('training warnings require fresh evidence and positively recorded remaining game time',()=>{
 const now=Date.parse('2026-11-01T12:00:00Z'),pilot={id:1,name:'Pilot',subscription_end:'2026-12-01',snapshots:{skills:{updated:now,data:{queue:[]}}}};
 assert.equal(personalAlerts([pilot],{},now)[0].kind,'empty-training');
 for(const subscription_end of [null,'2026-10-01','2026-11-01'])assert.deepEqual(personalAlerts([{...pilot,subscription_end}],{},now),[]);
 assert.deepEqual(personalAlerts([{...pilot,snapshots:{skills:{updated:now-86400000,data:{queue:[]}}}}],{},now),[]);
 assert.deepEqual(personalAlerts([{...pilot,snapshots:{skills:{updated:now,data:{queue:[{finish_date:'2026-12-01'}]}}}}],{},now),[]);
});
test('personal alerts skip disabled pages, stale or failed snapshots and flag completed work',()=>{
 const now=Date.now(),snapshot={updated:now,data:{jobs:[{status:'active',end_date:new Date(now-1000).toISOString()}]}},pilot={id:1,name:'Pilot',snapshots:{industry:snapshot}};
 assert.equal(personalAlerts([pilot],{},now)[0].page,'industry');assert.deepEqual(personalAlerts([pilot],{industry:false},now),[]);
 assert.deepEqual(personalAlerts([{...pilot,snapshots:{industry:{...snapshot,error:'failed'}}}],{},now),[]);
 const pi={...pilot,snapshots:{pi:{updated:now,data:[{pins:[{extractor_details:{},expiry_time:new Date(now-1000).toISOString()}]}]}}};assert.equal(personalAlerts([pi],{},now)[0].kind,'pi-extractor');
});
test('wallet breakdown reconciles cash flows without merging separate ledgers',()=>{
 const result=walletBreakdown([{transaction_type:'bounty_prizes',amount:100},{transaction_type:'player_donation',amount:-30},{transaction_type:'bounty_prizes',amount:20}]);
 assert.equal(result[0].income,120);assert.equal(result[1].expense,30);assert.equal(result.reduce((sum,row)=>sum+row.income-row.expense,0),90);
});
test('corporation market paginates open orders using distinct page URLs',async()=>{
 const calls=[],character={id:99,scopes:'["esi-markets.read_corporation_orders.v1"]'};
 const result=await collectMarket(character,{request:async path=>{calls.push(path);if(path.includes('/history'))return {data:[],pages:1};const id=path.endsWith('page=2')?2:1;return {pages:2,data:[{order_id:id,type_id:34,location_id:60003760,price:1,volume_remain:2,volume_total:2}]};},publicGet:async()=>({name:'Station'})},cat,null,{corporation:true});
 assert.equal(result.active.length,2);assert(calls.includes('/corporations/99/orders?page=2'));
});

test('alts suppress empty-training alerts while retaining actionable industry notifications',()=>{
 const now=Date.parse('2026-11-01T12:00:00Z'),pilot={id:2,parent_id:1,name:'Alt',subscription_end:'2026-12-01',snapshots:{skills:{updated:now,data:{queue:[]}},industry:{updated:now,data:{jobs:[{status:'ready'}]}}}};
 const alerts=personalAlerts([pilot],{},now);assert.deepEqual(alerts.map(alert=>alert.kind),['industry-ready']);
 assert(personalAlerts([{...pilot,parent_id:2}],{},now).some(alert=>alert.kind==='empty-training'));
});
