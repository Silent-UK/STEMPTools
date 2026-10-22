import {test} from 'node:test';
import assert from 'node:assert/strict';
import {launchpadUsage} from '../lib/pi.mjs';
import {launchpadRows} from '../public/pi-view.mjs';
test('launchpad thresholds use free space including exact boundaries',()=>{for(const [used,level] of [[0,'good'],[2000,'good'],[4999,'good'],[5000,'warning'],[7499,'warning'],[7500,'danger'],[10000,'danger'],[11000,'danger']]){const u=launchpadUsage([{type_id:1,amount:used}],()=>({volume:1}));assert.equal(u.used,used);assert.equal(u.level,level);}});
test('all commodities count and unknown volume cannot report an empty green pad',()=>{assert.equal(launchpadUsage([{type_id:1,amount:100},{type_id:2,amount:20}],id=>({volume:id===1?1.5:6})).used,270);assert.equal(launchpadUsage([{type_id:99,amount:1}],()=>null).used,null);assert.equal(launchpadUsage([],()=>null).used,0);});
test('each launchpad has its own bold volume and colour',()=>{const html=launchpadRows({launchpads:[{usage:launchpadUsage([{type_id:1,amount:2000}],()=>({volume:1}))},{usage:launchpadUsage([{type_id:1,amount:9000}],()=>({volume:1}))}]});assert.match(html,/Launchpad 1/);assert.match(html,/Launchpad 2/);assert.match(html,/<strong class="corp-good"[^>]*>2,000 m³ \/ 10,000 m³/);assert.match(html,/<strong class="corp-danger"/);});
