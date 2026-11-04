import test from 'node:test';
import assert from 'node:assert/strict';
import {denAttention,filterDens,sortDenGroups} from '../public/den-model.mjs';
const now=Date.parse('2026-11-04T12:00Z'),base={state:'Running',evolution:{anarchy:{level:'Level1',amount:34}},planet:{name:'Planet'},operations:[]};
const den=(id,extra={})=>({...base,id,...extra});
const op=hours=>({state:'Available',expires:new Date(now+hours*3600000).toISOString()});
test('attention matches existing alert thresholds, reinforces and incomplete MTO data without resurrecting expired operations',()=>{
 assert.equal(denAttention(base,now).needed,false);
 assert.equal(denAttention(den(1,{evolution:{anarchy:{level:'Level1',amount:35}}}),now).needed,true);
 assert.equal(denAttention(den(1,{evolution:{anarchy:{level:'Level2',amount:40}}}),now).impact,10);
 assert.equal(denAttention(den(1,{operations:[op(12)]}),now).needed,true);
 assert.equal(denAttention(den(1,{operations:[op(12.01),op(-1)]}),now).needed,false);
 assert.equal(denAttention(den(1,{state:'Reinforced'}),now).needed,true);
 assert.equal(denAttention(den(1,{operations_error:'Failed',operations:[op(1)]}),now).priority,4);
});
test('priority is reinforced, earliest urgent MTO, largest workforce impact then warning; original inventory stays unchanged',()=>{
 const rows=[den(1),den(2,{evolution:{anarchy:{level:'Level2',amount:40}}}),den(3,{operations:[op(2)]}),den(4,{state:'Reinforced'}),den(5,{operations:[op(1)]}),den(6,{evolution:{anarchy:{level:'Level4',amount:100}}})];
 assert.deepEqual(filterDens(rows,false,'priority',now).map(d=>d.id),[4,5,3,6,2,1]);
 assert.deepEqual(filterDens(rows,true,'manual',now).map(d=>d.id),[2,3,4,5,6]);assert.equal(rows[0].id,1);
});
test('groups rank by their most urgent main or alt and preserve membership, normal order and empty groups',()=>{
 const main={id:1,data:[den(1)]},alt={id:2,data:[den(2,{operations:[op(1)]})]},groups=[{id:3,main:{id:3,data:[den(3,{evolution:{anarchy:{level:'Level4',amount:100}}})]},alts:[]},{id:1,main,alts:[alt]}];
 const sorted=sortDenGroups(groups,'priority',now);assert.deepEqual(sorted.map(g=>g.id),[1,3]);assert.equal(sorted[0].main,main);assert.equal(sorted[0].alts[0],alt);assert.equal(sortDenGroups(groups,'manual',now),groups);
});
