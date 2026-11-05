import test from 'node:test';
import assert from 'node:assert/strict';
import recipes from '../lib/moon-recipes.json' with {type:'json'};
import {refinedSurvey,moonListValues} from '../lib/moon-surveys.mjs';
import {moonBrowserView} from '../public/moon-browser-view.mjs';
const names=['Chromium','Hydrocarbons','Pyerite','Mexallon','Chromite','Bitumens'],cat={named:name=>names.indexOf(name)+1},prices=names.map((_,i)=>({type_id:i+1,average_price:1})),moon={key:'Example|1|1',name:'Example I - Moon 1',ores:[{name:'Chromite',tier:'R16',fraction:null},{name:'Bitumens',tier:'R4',fraction:null}],issues:[],sources:[],drill_observation:{date:'2026-11-05',cycle_seconds:3600,efficiency:.4,products:[{name:'Chromium',units_per_cycle:16},{name:'Hydrocarbons',units_per_cycle:30}]}};
const calculate=(mode,refine=100,p=prices)=>refinedSurvey(moon,recipes.recipes,p,cat,{mode,refine});
test('hourly recorded drill output gives 720 cycles and Athanor scales from 40 percent without invented ore fractions',()=>{
 const drill=calculate('metenox'),ath=calculate('athanor');assert.equal(drill.recorded_production.cycles,720);assert.equal(drill.recorded_production.products[0].quantity,11520);assert.equal(ath.recorded_production.products[0].quantity,28800);assert.equal(ath.recorded_production.products[1].quantity,54000);assert.equal(drill.value,33120);assert.ok(ath.ores.every(o=>o.fraction===null&&o.m3===null));
 const list=moonListValues([moon],recipes.recipes,prices,cat,{refine:100})[0];assert.equal(list.monthly_values.metenox,33120);assert.equal(list.monthly_values.athanor,ath.value);assert.equal(list.monthly_values.partial,true);
});
test('mineral inference subtracts Chromite hydrocarbons before estimating Bitumens minerals and respects refine',()=>{
 const ath=calculate('athanor'),m=ath.recorded_production.minerals;assert.equal(m.find(m=>m.name==='Pyerite').quantity,4320000);assert.equal(m.find(m=>m.name==='Mexallon').quantity,288000);assert.equal(ath.value,4690800);assert.equal(calculate('athanor',90).recorded_production.minerals.find(m=>m.name==='Pyerite').quantity,3888000);assert.equal(calculate('athanor',0).value,0);
 assert.equal(calculate('metenox').recorded_production.minerals.length,0);assert.equal(calculate('athanor',100,prices.filter(p=>p.type_id!==3)).value,null);
});
test('rounded co-products do not invent tiny extra ores, and incompatible outputs leave mineral estimates unavailable',()=>{
 const r=refinedSurvey({...moon,drill_observation:{...moon.drill_observation,products:[{name:'Chromium',units_per_cycle:16},{name:'Hydrocarbons',units_per_cycle:4}]}},recipes.recipes,prices,cat,{refine:100});assert.deepEqual(r.recorded_production.minerals,[]);
 const bad=refinedSurvey({...moon,drill_observation:{...moon.drill_observation,products:[{name:'Chromium',units_per_cycle:16}]}},recipes.recipes,prices,cat,{refine:100});assert.equal(bad.recorded_production.mineral_estimate_available,false);assert.deepEqual(bad.recorded_production.minerals,[]);
});
test('recorded production view shows calculated quantities, known-output value and remaining mineral uncertainty',()=>{
 const detail=calculate('athanor'),html=moonBrowserView({detail,total:1,systems:1,regions:[],moons:[],prices:{}},{});assert.ok(html.includes('720 cycles'));assert.ok(html.includes('2.5×'));assert.ok(html.includes('4,320,000'));assert.ok(html.includes('Estimated Monthly Value · Known Outputs'));assert.ok(html.includes('Minerals from any unrecorded ores remain unknown'));assert.ok(!html.includes('monthly estimates need a composition scan'));
});
