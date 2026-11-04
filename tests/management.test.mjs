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
