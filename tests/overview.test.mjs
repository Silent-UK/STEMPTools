import test from 'node:test';
import assert from 'node:assert/strict';
import {overviewPreferences,overviewIssues,overviewRefresh,overviewMatches,overviewTotals,overviewGroups} from '../public/overview-model.mjs';
const now=Date.parse('2026-11-03T12:00:00Z');
const main={id:1,parent_id:1,name:'Zulu',total_sp:100,isk:20,subscription_end:'2026-11-05',snapshots:[{updated:now-1000,expires:now+1000}],errors:[]};
const alt={...main,id:2,parent_id:1,name:'Alpha',total_sp:null,isk:10,subscription_end:null,reconnect:1};
const other={...main,id:3,parent_id:3,name:'Beta',total_sp:50,isk:80,subscription_end:null};
const chars=[main,alt,other],groups=[{id:1,main,alts:[alt]},{id:3,main:other,alts:[]}];
test('overview search and filters keep related characters together without changing the original order',()=>{
 const result=overviewGroups(groups,chars,overviewPreferences({q:'alpha',filter:'reconnect'}),now);
 assert.equal(result.length,1);assert.equal(result[0].main.id,1);assert.equal(result[0].alts[0].id,2);
 assert.equal(overviewMatches(main,chars,overviewPreferences({q:'alpha'}),now),false);
 assert.equal(overviewGroups(groups,chars,overviewPreferences({q:'nobody'}),now).length,0);
 assert.equal(groups[0].main.id,1);
});
test('overview sorting uses group totals when enabled and leaves missing values last',()=>{
 assert.deepEqual(overviewGroups(groups,chars,overviewPreferences({sort:'name'}),now).map(g=>g.id),[3,1]);
 assert.deepEqual(overviewGroups(groups,chars,overviewPreferences({sort:'isk',totals:true}),now).map(g=>g.id),[3,1]);
 assert.deepEqual(overviewGroups(groups,chars,overviewPreferences({sort:'manual'}),now).map(g=>g.id),[1,3]);
 assert.deepEqual(overviewTotals([main,alt],'total_sp'),{value:100,partial:true});
 assert.deepEqual(overviewTotals([alt],'total_sp'),{value:null,partial:true});
 assert.deepEqual(overviewTotals([{isk:0}],'isk'),{value:0,partial:false});
});
test('overview attention includes scopes, saved queue warnings and inherited subscription only once',()=>{
 assert.equal(overviewIssues(main,chars,now).filter(i=>i.kind==='subscription').length,1);
 assert.equal(overviewIssues(alt,chars,now).filter(i=>i.kind==='subscription').length,0);
 assert.equal(overviewMatches(alt,chars,overviewPreferences({filter:'subscription'}),now),true);
 assert.equal(overviewIssues({...other,missing_scopes:['scope'],training_warning:'Queue ending'},chars,now).length,2);
 assert.equal(overviewIssues({...other,subscription_end:'2026-10-01'},[],now)[0].kind,'subscription');
});
test('refresh status distinguishes the latest success from older cached data and temporary failures',()=>{
 const c={snapshots:[{updated:now-20000,expires:now-1},{updated:now-1000,expires:now+1000}],errors:[{message:'External service temporarily unavailable (HTTP 503)'}]};
 assert.deepEqual(overviewRefresh(c,now),{latest:now-1000,oldest:now-20000,older:true,temporary:true});
 assert.equal(overviewRefresh({snapshots:[],errors:[]},now).latest,null);
});
test('saved overview preferences are bounded and tolerate corrupt values',()=>{
 assert.equal(overviewPreferences(null).sort,'manual');
 assert.equal(overviewPreferences({q:'x'.repeat(200),filter:'bad',sort:'bad',groups:[1,'bad'],totals:'yes'}).q.length,120);
 assert.deepEqual(overviewPreferences({groups:[1,'bad']}).groups,[1]);
});
