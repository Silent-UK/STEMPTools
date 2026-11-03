import test from 'node:test';
import assert from 'node:assert/strict';
import {dashboardActivity} from '../lib/character-dashboard.mjs';
import {characterCharts,characterTraining} from '../public/character-summary.mjs';
import {myCharacterPreferences} from '../public/my-character-view.mjs';
const now=Date.parse('2026-11-03T12:00:00Z');
test('dashboard distinguishes ready running paused jobs and empty from missing data',()=>{
 const snap={industry:{data:{jobs:[{status:'active',end_date:new Date(now+1).toISOString()},{status:'active',end_date:new Date(now-1).toISOString()},{status:'ready'},{status:'paused'},{status:'delivered'}],blueprints:[]}},market:{data:{active:[{is_buy_order:true},{is_buy_order:false}]}},assets:{data:{items:[{root_location_id:1},{root_location_id:1},{location_id:2}]}}};
 const result=dashboardActivity(snap,1,now);
 assert.deepEqual(result.industry,{active:1,ready:2,pending:1});assert.deepEqual(result.blueprints,{count:0});
 assert.deepEqual(result.market,{active:2,buy:1,sell:1});assert.deepEqual(result.assets,{stacks:3,locations:2});
 assert.equal(result.pi,null);assert.equal(dashboardActivity({},1,now).industry,null);
 assert.deepEqual(dashboardActivity({pi:{data:[]}},1,now).pi,{count:0,attention:0});
});
test('dashboard counts affected PI colonies once and den alerts once per den',()=>{
 const expiry=new Date(now-1000).toISOString(),pin={extractor_details:{},expiry_time:expiry};
 const result=dashboardActivity({pi:{data:[{pins:[pin,pin]},{pins:[]}]},dens:{updated:now,data:[{id:5,evolution:{anarchy:{level:2}},operations:[{id:10,state:'Started',expires:new Date(now+60000).toISOString()}]}]}},1,now);
 assert.deepEqual(result.pi,{count:2,attention:1});assert.deepEqual(result.dens,{count:1,attention:1});
});
test('percentage skill charts escape names and handle empty SP without NaN',()=>{
 const html=characterCharts({skills:{skills:[{name:'Skill',group:'<unsafe>',trained_skill_level:5,skillpoints_in_skill:30},{name:'Other',group:'Other',trained_skill_level:4,skillpoints_in_skill:70}]}},'percent');
 assert.match(html,/30\.0%/);assert.match(html,/70\.0%/);assert.match(html,/&lt;unsafe&gt;/);
 assert.doesNotMatch(characterCharts({skills:{skills:[]}},'percent'),/NaN|Infinity/);
});
test('training preview and remembered preferences retain usable defaults',()=>{
 const q=Array.from({length:5},(_,i)=>({skill_id:i+1,queue_position:i,name:'<skill>',start_date:new Date(now+i*60000).toISOString(),finish_date:new Date(now+(i+1)*60000).toISOString(),finished_level:5}));
 assert.match(characterTraining({queue:q},now,true),/data-my-section="queue" open/);
 assert.doesNotMatch(characterTraining({queue:q},now),/<skill>/);
 assert.deepEqual(myCharacterPreferences(null),{selected:null,alts:false,chart:'sp',sections:[]});
 assert.deepEqual(myCharacterPreferences({selected:5,chart:'percent',sections:['clones','evil']}),{selected:5,alts:false,chart:'percent',sections:['clones']});
});

test('additional activity cards use outstanding contracts and the current thirty calendar days',()=>{
 const result=dashboardActivity({contracts:{data:{contracts:[{status:'outstanding'},{status:'finished'}]}},mining:{data:{rows:[{date:'2026-11-03',quantity:10},{date:'2026-10-05',quantity:20},{date:'2026-10-04',quantity:100}]}},clones:{data:{clones:[{}],ready_at:new Date(now-1).toISOString()}}},1,now);
 assert.deepEqual(result.contracts,{outstanding:1});assert.deepEqual(result.mining,{quantity:30,records:2});assert.deepEqual(result.clones,{count:1,ready:true});
});
