import {groupEnrolmentService} from '../lib/group-enrolment.mjs';
import {matchingMemberships,groupMembershipView} from '../public/group-management-view.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openStore} from '../lib/store.mjs';
import {eligible,grants,syncEnabled,rattingSummary} from '../lib/management.mjs';
import {dotlanStats,evewhoChanges,overviewService} from '../lib/corp-overview.mjs';
function store(fn){const dir=mkdtempSync(join(tmpdir(),'tools-management-')),db=openStore(dir);try{db.prepare("INSERT INTO users VALUES(1,101,'Pilot',0)").run();for(const id of [101,102])db.prepare("INSERT INTO characters VALUES(?,1,'Pilot','owner','encrypted','[]',0,0)").run(id);return fn(db);}finally{db.close();rmSync(dir,{recursive:true,force:true});}}
test('restricted groups require ship and active skill on one pilot, fresh complete evidence and membership',()=>store(db=>{
 const now=Date.now(),rules=[{kind:'ship-group',id:30},{kind:'skill',id:3347,level:5}];
 const snapshot=(id,kind,data,updated=now)=>db.prepare('INSERT OR REPLACE INTO snapshots VALUES(?,?,?,?,?,NULL)').run(id,kind,JSON.stringify(data),updated,now+3600000);
 snapshot(101,'assets',{items:[{type_id:1,group_id:30,quantity:1}]});snapshot(102,'skills',{skills:{skills:[{skill_id:3347,active_skill_level:5}]}});
 assert.equal(eligible(db,1,rules,now),false);
 snapshot(101,'skills',{skills:{skills:[{skill_id:3347,active_skill_level:4,trained_skill_level:5}]}});assert.equal(eligible(db,1,rules,now),false);
 snapshot(101,'skills',{skills:{skills:[{skill_id:3347,active_skill_level:5}]}});assert.equal(eligible(db,1,rules,now),true);
 db.prepare("INSERT INTO access_groups(id,name,icon,description,mode,rules,pages) VALUES(1,'Titan','T','','restricted',?,'[\"corp-moons\"]')").run(JSON.stringify(rules));
 assert.deepEqual(grants(db,1),[]);db.prepare("INSERT INTO group_members VALUES(1,1,'approved')").run();assert.deepEqual(grants(db,1),['corp-moons']);
 snapshot(101,'assets',{items:[{group_id:30,quantity:1}]},now-86400001);assert.equal(eligible(db,1,rules,now),false);assert.deepEqual(grants(db,1),[]);
 snapshot(101,'assets',{items:[{group_id:30,quantity:1}]});db.prepare("INSERT INTO sync_errors VALUES(101,'assets','Failed')").run();assert.equal(eligible(db,1,rules,now),false);
}));
test('page preferences pause only dedicated jobs and preserve shared PI and wallet dependencies',()=>store(db=>{
 db.prepare('INSERT INTO page_preferences VALUES(1,?)').run(JSON.stringify({pi:false,dens:false,mining:false,industry:false,blueprints:false,ratting:false}));
 for(const kind of ['pi','dens','mining','industry'])assert.equal(syncEnabled(db,1,kind),false);
 for(const kind of ['wallet','wallet-history','skills','assets','clones'])assert.equal(syncEnabled(db,1,kind),true);
 db.prepare("INSERT INTO users VALUES(2,201,'Recipient',0)").run();db.prepare('INSERT INTO pi_shares VALUES(1,2,101)').run();assert.equal(syncEnabled(db,1,'pi'),true);
}));
test('ratting uses UTC boundaries, retained history, positive bounty and ESS entries only',()=>{
 const now=Date.parse('2026-10-31T12:00:00Z'),row=(date,amount,ref_type='bounty_prizes')=>({date,amount,ref_type});
 const pilots=[{id:1,name:'Earner',data:{journal:[row('2026-10-31T00:00:00Z',10),row('2026-10-30T23:59:59Z',20),row('2026-10-01T00:00:00Z',30,'ess_escrow_transfer'),row('2026-09-30T23:59:59Z',40),row('2026-10-31',500,'player_donation'),row('2026-10-31',-10),row('2026-11-01',100)]}},{id:2,data:{journal:[]}}];
 assert.equal(rattingSummary(pilots,'day',now).total,10);assert.equal(rattingSummary(pilots,'week',now).total,30);assert.equal(rattingSummary(pilots,'month',now).total,60);assert.equal(rattingSummary(pilots,'all',now).total,100);assert.equal(rattingSummary(pilots,'all',now).rows.length,1);assert.throws(()=>rattingSummary(pilots,'bad',now),/period/);
});
test('external source adapters reject changed schemas and cap Eve Who history to ten',()=>{
 assert.equal(dotlanStats('<table><tr><td>Members</td><td>1,234</td></tr><tr><td>Ceo</td><td><a>A Pilot</a></td></tr></table>').members,1234);
 assert.throws(()=>dotlanStats('<html>Unavailable</html>'),/unavailable/);
 const rows=Array.from({length:20},(_,i)=>({id:i+1,start_date:'2026/10/31 12:00',end_date:'2026/11/01 12:00'}));
 assert.equal(evewhoChanges({characters:rows},'joiners').length,10);assert.equal(evewhoChanges({characters:rows},'leavers')[0].detail,'2026/11/01 12:00 UTC');assert.throws(()=>evewhoChanges({},'joiners'),/Invalid/);
});


test('role/title conditions require matching corporation and the same fresh pilot',()=>store(db=>{
 const now=Date.now(),rules=[{kind:'role',id:'Director',corporation_id:668298004},{kind:'title',id:5,corporation_id:668298004}];
 const save=(id,kind,data,updated=now)=>db.prepare('INSERT OR REPLACE INTO snapshots VALUES(?,?,?,?,?,NULL)').run(id,kind,JSON.stringify(data),updated,now+3600000);
 save(101,'roles',{corporation_id:668298004,roles:['Director']});save(102,'titles',{corporation_id:668298004,titles:[{title_id:5}]});assert.equal(eligible(db,1,rules,now),false);
 save(101,'titles',{corporation_id:999,titles:[{title_id:5}]});assert.equal(eligible(db,1,rules,now),false);
 save(101,'titles',{corporation_id:668298004,titles:[{title_id:5}]});assert.equal(eligible(db,1,rules,now),true);
 save(101,'roles',{corporation_id:668298004,roles:['Director']},now-86400001);assert.equal(eligible(db,1,rules,now),false);
}));

async function enrolStore(fn){const dir=mkdtempSync(join(tmpdir(),'tools-enrol-')),db=openStore(dir);try{db.prepare("INSERT INTO users VALUES(1,101,'Main Pilot',0)").run();for(const id of [101,102])db.prepare("INSERT INTO characters VALUES(?,1,'Pilot','owner','encrypted','[]',0,0)").run(id);await fn(db);}finally{db.close();rmSync(dir,{recursive:true,force:true});}}
test('auto enrolment verifies corporation, removes lost access, restores eligibility and preserves an admin veto',()=>enrolStore(async db=>{
 let corporation=668298004,failed=false,calls=0;
 const service=groupEnrolmentService(db,{async membership(){calls++;if(failed)throw Error('ESI unavailable');return {id:corporation,expires:Date.now()+300000};}});
 db.prepare("INSERT INTO access_groups(id,name,icon,description,mode,rules,pages) VALUES(1,'Corp Members','◇','','auto-enrol',?,'[\"corp-moons\"]')").run(JSON.stringify([{kind:'corporation',id:668298004}]));
 assert.deepEqual(grants(db,1),[]);await Promise.all([service.check(1),service.check(1)]);assert.deepEqual(grants(db,1),['corp-moons']);assert.equal(calls,2);
 await service.check(1);assert.equal(calls,2);
 corporation=123;db.prepare('UPDATE group_affiliations SET expires=0').run();assert.deepEqual(grants(db,1),[]);await service.check(1);assert.equal(db.prepare('SELECT status FROM group_members').get().status,'ineligible');assert.deepEqual(grants(db,1),[]);
 corporation=668298004;db.prepare('UPDATE group_affiliations SET expires=0').run();await service.check(1);assert.deepEqual(grants(db,1),['corp-moons']);
 db.prepare("UPDATE group_members SET status='rejected'").run();await service.check(1);assert.equal(db.prepare('SELECT status FROM group_members').get().status,'rejected');assert.deepEqual(grants(db,1),[]);
 db.prepare("UPDATE group_members SET status='approved'").run();db.prepare('UPDATE group_affiliations SET expires=0').run();failed=true;await service.check(1);assert.deepEqual(grants(db,1),[]);const prior=calls;await service.check(1);assert.equal(calls,prior);
}));
test('corporation and skill auto-enrol requirements must be met by the same pilot',()=>enrolStore(async db=>{
 const rules=[{kind:'corporation',id:668298004},{kind:'skill',id:3347,level:5}],now=Date.now();
 db.prepare('INSERT INTO group_affiliations VALUES(101,668298004,?)').run(now+300000);db.prepare('INSERT INTO group_affiliations VALUES(102,999,?)').run(now+300000);
 db.prepare('INSERT INTO snapshots VALUES(?,?,?,?,?,NULL)').run(102,'skills',JSON.stringify({skills:{skills:[{skill_id:3347,active_skill_level:5}]}}),now,now+3600000);assert.equal(eligible(db,1,rules),false);
 db.prepare('UPDATE group_affiliations SET corporation_id=668298004 WHERE character_id=102').run();assert.equal(eligible(db,1,rules),true);
}));
test('membership search finds a pilot by their main or alt across groups and keeps ordinary categories collapsed',()=>{
 const d={groups:[{id:1,name:'Corp Members',icon:'◇',mode:'auto-enrol'},{id:2,name:'Capital Pilots',icon:'◇',mode:'approval'}],requests:[{group_id:1,user_id:1,name:'Silent Uk',pilot_names:'["Silent Uk","Monna Sei"]',group_name:'Corp Members',status:'approved'},{group_id:2,user_id:1,name:'Silent Uk',pilot_names:'["Monna Sei"]',group_name:'Capital Pilots',status:'approved'},{group_id:1,user_id:2,name:'Other Pilot',group_name:'Corp Members',status:'pending'}]};
 assert.equal(matchingMemberships(d,'SILENT UK').length,2);assert.equal(matchingMemberships(d,'monna').length,2);assert.equal(matchingMemberships(d,'no match').length,0);
 const esc=s=>String(s??'').replaceAll('<','&lt;');assert.ok(!groupMembershipView(d,'',esc).includes('class="group-membership" open'));const html=groupMembershipView(d,'silent',esc);assert.ok(html.includes('Corp Members'));assert.ok(html.includes('Capital Pilots'));assert.ok(!html.includes('Other Pilot'));assert.ok(html.includes('class="group-membership" open'));
});
