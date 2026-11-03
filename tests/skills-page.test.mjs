import test from 'node:test';import assert from 'node:assert/strict';
import {skillsPreferences,queueState,filterTrainingPilots,filterTrainedSkills,skillProgress,trainingDuration,skillDuration,skillsCSV} from '../public/skills-model.mjs';
const now=Date.parse('2026-11-03T12:00:00Z'),hour=3600000;
const skill=(id,hours)=>({skill_id:id,name:'Skill '+id,queue_position:id,start_date:new Date(now-hour).toISOString(),finish_date:new Date(now+hours*hour).toISOString(),finished_level:5});
const pilot=(queue,extra={})=>({id:1,name:'Main',updated:now,total_sp:100,queue,...extra});
test('queue statuses separate stale errors and incomplete schedules from empty or short queues',()=>{
 assert.equal(queueState(pilot([]),now).kind,'empty');
 assert.equal(queueState(pilot([skill(1,1)]),now).kind,'short');
 assert.equal(queueState(pilot([skill(1,50)]),now).kind,'training');
 for(const p of [pilot([],{updated:null}),pilot([],{updated:now-3*hour}),pilot([],{error:'HTTP 503'}),pilot([{skill_id:1}]),pilot([{finish_date:'invalid'}])])assert.equal(queueState(p,now).kind,'unavailable');
 assert.equal(queueState(pilot([skill(1,-1)]),now).kind,'empty');
});
test('character filters and sorting do not expose hidden alts or mutate manual ordering',()=>{
 const rows=[pilot([skill(1,60)]),pilot([skill(1,1)],{id:2,name:'Alt',total_sp:200}),pilot([],{id:3,name:'Other'})],chars=[{id:1,parent_id:1},{id:2,parent_id:1},{id:3,parent_id:3}];
 assert.deepEqual(filterTrainingPilots(rows,chars,skillsPreferences(),now).map(p=>p.id),[1,3]);
 assert.deepEqual(filterTrainingPilots(rows,chars,skillsPreferences({alts:true,status:'short'}),now).map(p=>p.id),[2]);
 assert.deepEqual(filterTrainingPilots(rows,chars,skillsPreferences({alts:true,sort:'queue'}),now).map(p=>p.id),[3,2,1]);
 assert.deepEqual(rows.map(p=>p.id),[1,2,3]);
});
test('trained skill filters combine name group level queued and lower active levels',()=>{
 const data={skills:{skills:[{skill_id:1,name:'Gunnery',group:'Guns',trained_skill_level:5,active_skill_level:4},{skill_id:2,name:'Missiles',group:'Missiles',trained_skill_level:5,active_skill_level:5}]},queue:[skill(1,10)]};
 assert.equal(filterTrainedSkills(data,skillsPreferences({q:'gun',group:'Guns',level:'5',queued:true,below:true}),now).length,1);
 assert.equal(filterTrainedSkills(data,skillsPreferences({group:'Missiles',below:true}),now).length,0);
});
test('duration excludes earlier queue entries and progress is bounded',()=>{
 const row=skill(1,5);assert.equal(trainingDuration(row),6*hour);assert.equal(skillDuration(trainingDuration(row)),'0d 6h 0m');
 assert.ok(Math.abs(skillProgress(row,now)-100/6)<0.000001);assert.equal(skillProgress(row,now+10*hour),100);assert.equal(skillProgress({},now),null);
 assert.equal(trainingDuration({}),null);
});
test('CSV contains a BOM real newlines quotes and formula neutralization',()=>{
 const data={skills:{skills:[{skill_id:1,name:'=unsafe,"quoted"',group:'Group',trained_skill_level:5,active_skill_level:4,skillpoints_in_skill:10}]},queue:[skill(1,5)]};
 const csv=skillsCSV(data,'skills',now);assert.equal(csv.charCodeAt(0),0xfeff);assert.ok(csv.includes('\r\n'));assert.ok(csv.includes("'"+'=unsafe,""quoted""'));assert.ok(!csv.includes('\\r\\n'));
 const queue=skillsCSV(data,'queue',now);assert.match(queue,/Training duration/);assert.match(queue,/Time until completion/);assert.match(queue,/Currently training/);
});
test('saved preferences validate enums and bounded expanded groups',()=>{
 assert.equal(skillsPreferences(null).status,'all');assert.equal(skillsPreferences({status:'fake',sort:'fake',level:'8'}).level,'');
 assert.deepEqual(skillsPreferences({groups:['Guns',7],alts:true,selected:1}).groups,['Guns']);
});
