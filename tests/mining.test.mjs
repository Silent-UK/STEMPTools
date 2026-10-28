import test from 'node:test';
import assert from 'node:assert/strict';
import {collectMining,MINING_SCOPE} from '../lib/mining.mjs';
import {miningSummary,miningView} from '../public/mining-view.mjs';
const c={id:1,scopes:JSON.stringify([MINING_SCOPE])},now=Date.parse('2026-10-28T12:00:00Z'),cat={type:id=>id===1?{name:'Veldspar',volume:.1}:null};
const row={date:'2026-10-28',type_id:1,solar_system_id:30000142,quantity:100};
test('mining paginates, replaces cumulative quantities and retains historical records',async()=>{
 const calls=[];const eve={request:async path=>{calls.push(path);return {pages:2,data:path.endsWith('=1')?[row]:[{...row,date:'2026-10-27',quantity:50}]}}};
 const first=await collectMining(c,eve,cat,{rows:[{...row,date:'2026-01-01',name:'Veldspar',system:'Jita',volume_m3:10}],started_at:1},now);
 assert.equal(first.rows.length,3);assert.equal(first.rows[0].volume_m3,10);assert.equal(first.rows[0].system,'Jita');assert.equal(calls.length,2);
 const next=await collectMining(c,{request:async()=>({pages:1,data:[{...row,quantity:200}]})},cat,first,now);
 assert.equal(next.rows.length,3);assert.equal(next.rows[0].quantity,200);assert.equal(next.rows[0].volume_m3,20);assert.equal(first.rows[0].quantity,100);assert.equal(next.started_at,1);
});
test('mining rejects missing permission, inconsistent pages and duplicate records',async()=>{
 await assert.rejects(collectMining({...c,scopes:'[]'},{request:()=>{throw Error('Must not call ESI')}},cat,null,now),/Connect mining/);
 await assert.rejects(collectMining(c,{request:async p=>({pages:p.endsWith('=1')?2:1,data:[row]})},cat,null,now),/pages changed/);
 await assert.rejects(collectMining(c,{request:async()=>({pages:2,data:[row]})},cat,null,now),/ledger changed/);
 for(const change of [{quantity:-1},{quantity:1.5},{date:'2026-02-30'},{solar_system_id:0}])await assert.rejects(collectMining(c,{request:async()=>({pages:1,data:[{...row,...change}]})},cat,null,now),/Invalid mining/);
});
test('daily chart aggregates systems, respects UTC filters and flags unknown volume',()=>{
 const rows=[{...row,name:'<ore>',system:'Jita',volume_m3:10},{...row,type_id:2,name:'Ice',system:'Amarr',volume_m3:null},{...row,date:'2026-09-01',name:'Old ore',system:'Jita',volume_m3:20}];
 const result=miningSummary(rows,{days:'7'},now);assert.equal(result.series.length,7);assert.equal(result.volume,10);assert.equal(result.units,200);assert.equal(result.unknown,1);assert.equal(result.active,1);
 assert.equal(miningSummary(rows,{days:'all',q:'Jita'},now).rows.length,2);
 const html=miningView({rows,started_at:now},{days:'7'},0,now);assert(!html.includes('<ore>'));assert(html.includes('&lt;ore&gt;'));assert(html.includes('unknown item volume excluded'));assert(!html.includes('NaN'));
});
