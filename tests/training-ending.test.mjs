import test from 'node:test';
import assert from 'node:assert/strict';
import {personalAlerts} from '../public/personal-alerts.mjs';
const now=Date.parse('2026-11-03T12:00:00Z'),hour=3600000;
const skill=(hours,id=1)=>({skill_id:id,finished_level:5,finish_date:new Date(now+hours*hour).toISOString()});
function pilot(queue,extra={}){return {id:1,parent_id:1,name:'Pilot',subscription_end:'2027-01-01',snapshots:{skills:{updated:now,data:{queue}}},...extra};}
test('warns only when the final remaining skill has under 48 hours',()=>{
 const alerts=personalAlerts([pilot([skill(-1),skill(47)])],{},now);assert.equal(alerts.length,1);assert.equal(alerts[0].kind,'training-ending');assert.equal(alerts[0].page,'skills');assert.ok(alerts[0].event_key);
 for(const queue of [[skill(48)],[skill(49)],[skill(1),skill(20)]])assert.deepEqual(personalAlerts([pilot(queue)],{},now),[]);
 assert.equal(personalAlerts([pilot([])],{},now)[0].kind,'empty-training');
});
test('suppresses alts, Alpha pilots, stale and failed skill snapshots',()=>{
 for(const extra of [{parent_id:2},{subscription_end:'2026-01-01'},{snapshots:{skills:{updated:now-3*hour,data:{queue:[skill(1)]}}}},{snapshots:{skills:{updated:now,error:'failed',data:{queue:[skill(1)]}}}}])assert.deepEqual(personalAlerts([pilot([skill(1)],extra)],{},now),[]);
 const first=personalAlerts([pilot([skill(1)])],{},now)[0],next=personalAlerts([pilot([skill(2)])],{},now)[0];assert.notEqual(first.event_key,next.event_key);
});
