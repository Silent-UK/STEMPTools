import test from 'node:test';
import assert from 'node:assert/strict';
import {moonIncome} from '../lib/moon-income.mjs';
import {moonIncomeView} from '../public/moon-income-view.mjs';
const moon={key:'EXAMPLE|6|1',moon_id:123,name:'EXAMPLE VI - Moon 1',region:'Region A',ores:[{name:'Chromite',fraction:null}],issues:[],drill_observation:{cycle_seconds:3600,efficiency:.4,products:[{name:'Chromium',units_per_cycle:10}]}},data={rows:[moon]},prices=[{type_id:1,average_price:2}],cat={named:()=>1},recipes={metenox:{Chromite:{materials:[{name:'Chromium',quantity:40}]}},athanor:{Chromite:{materials:[{name:'Chromium',quantity:40}]}}};
const drill=(id,state='online',name='EXAMPLE - 6-1')=>({id,name,system:'EXAMPLE',region:'Region A',kind:'Moon Drill',mining:state});
test('regional income counts online production once, excludes offline potential and identifies missing drill data',()=>{
 const [r]=moonIncome([drill(1),drill(2,'offline'),drill(3,'unknown'),drill(4,'online','Unmatched'),{kind:'Structure'}],data,recipes,prices,cat);
 assert.equal(r.monthly,14400);assert.equal(r.online,2);assert.equal(r.known,1);assert.equal(r.unknown,2);assert.equal(r.drills[1].monthly,14400);assert.equal(r.drills[3].monthly,null);
 assert.equal(moonIncome([drill(1)],data,recipes,[],cat)[0].monthly,null);
 assert.equal(moonIncome([drill(1,'offline')],data,recipes,prices,cat)[0].monthly,0);
});
test('moon matching accepts explicit IDs and rejects ambiguous survey matches',()=>{
 assert.equal(moonIncome([{...drill(1,'online','Custom'),moon_id:123}],data,recipes,prices,cat)[0].monthly,14400);
 assert.equal(moonIncome([drill(1)],{rows:[moon,{...moon,moon_id:124}]},recipes,prices,cat)[0].monthly,null);
});
test('regional income view escapes names and explains gross value and missing data',()=>{
 const rows=moonIncome([drill(1,'online','<unsafe>')],data,recipes,prices,cat),esc=s=>String(s).replaceAll('<','&lt;').replaceAll('>','&gt;');
 const html=moonIncomeView(rows,{esc,num:n=>String(n)});assert.ok(html.includes('&lt;unsafe&gt;'));assert.ok(!html.includes('<unsafe>'));assert.ok(html.includes('before fuel, gas, fees and tax'));assert.ok(html.includes('Unavailable'));assert.ok(html.includes('Moon not matched'));
});

test('screenshot structure names match without guessing numbered drill labels',()=>{const linked={rows:[{...moon,drill_observation:{...moon.drill_observation,structure_name:'EXAMPLE - Goo 7'}}]};assert.equal(moonIncome([drill(1,'online','EXAMPLE - Goo 7')],linked,recipes,prices,cat)[0].monthly,14400);assert.equal(moonIncome([drill(1,'online','EXAMPLE - Goo 8')],linked,recipes,prices,cat)[0].monthly,null);});
