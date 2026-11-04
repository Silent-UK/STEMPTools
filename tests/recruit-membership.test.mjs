import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openStore} from '../lib/store.mjs';
import {recruitmentStore,recruitAccount} from '../lib/recruitment-store.mjs';
import {recruitMembershipService} from '../lib/recruit-membership.mjs';
async function fixture(fn){const dir=mkdtempSync(join(tmpdir(),'recruit-membership-')),db=openStore(dir);recruitmentStore(db);for(let i=1;i<=6;i++){db.prepare('INSERT INTO users VALUES(?,?,?,0)').run(i,i*100,'Pilot '+i);db.prepare("INSERT INTO recruitment_applications(user_id,status,created,consented,notes) VALUES(?,'applied',1,2,'Preserve staff notes')").run(i);}try{await fn(db);}finally{db.close();rmSync(dir,{recursive:true,force:true});}}
test('background verification promotes only confirmed eligible login mains and preserves application history and identity',()=>fixture(async db=>{
 const calls=[],service=recruitMembershipService(db,{check:async(main,force)=>{calls.push([main,force]);if(main!==100)throw Object.assign(Error('Denied'),{status:403});}});await service.tick();
 const joined=db.prepare('SELECT * FROM recruitment_applications WHERE user_id=1').get();assert.equal(joined.status,'joined');assert(joined.joined_at>0);assert.equal(joined.notes,'Preserve staff notes');assert.equal(joined.consented,2);assert.equal(recruitAccount(db,1),undefined);assert.equal(db.prepare('SELECT admin FROM users WHERE id=1').get().admin,0);assert.equal(recruitAccount(db,2).status,'applied');assert.equal(calls.length,4);assert(calls.every(([,force])=>force));
 const first=joined.joined_at;assert.equal(service.verified(1,100),false);assert.equal(db.prepare('SELECT joined_at FROM recruitment_applications WHERE user_id=1').get().joined_at,first);
 await service.tick();assert.equal(calls.length,6,'next batch progresses without immediately retrying denied applications');await service.tick();assert.equal(calls.length,6);
}));
test('ESI outages, rejected or withdrawn applications and changed account identity never promote',()=>fixture(async db=>{
 db.prepare("UPDATE recruitment_applications SET status='rejected' WHERE user_id=1").run();db.prepare("UPDATE recruitment_applications SET status='withdrawn' WHERE user_id=2").run();
 const service=recruitMembershipService(db,{check:async main=>{if(main===300){db.prepare('UPDATE users SET main_id=301 WHERE id=3').run();return;}throw Object.assign(Error('ESI unavailable'),{status:503});}});await service.tick();
 assert.equal(db.prepare('SELECT COUNT(*) n FROM recruitment_applications WHERE joined_at IS NOT NULL').get().n,0);assert.equal(service.verified(1,100),false);assert.equal(service.verified(2,200),false);assert.equal(service.verified(3,300),false);
}));
test('existing recruitment tables migrate without losing records and migration is repeatable',()=>fixture(async db=>{recruitmentStore(db);assert.equal(db.prepare('SELECT COUNT(*) n FROM recruitment_applications').get().n,6);assert(db.prepare('PRAGMA table_info(recruitment_applications)').all().some(c=>c.name==='joined_at'));}));
test('legacy application rows receive joined_at without altering their staff history',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'recruit-legacy-')),db=openStore(dir);
 try{db.exec("CREATE TABLE recruitment_applications(user_id INTEGER PRIMARY KEY REFERENCES users(id),status TEXT NOT NULL DEFAULT 'applied',created INTEGER NOT NULL,consented INTEGER NOT NULL,reviewed INTEGER,reviewer INTEGER,notes TEXT NOT NULL DEFAULT '')");db.prepare('INSERT INTO users VALUES(1,100,?,0)').run('Pilot');db.prepare("INSERT INTO recruitment_applications VALUES(1,'reviewing',11,12,13,NULL,'Old notes')").run();recruitmentStore(db);const row=db.prepare('SELECT * FROM recruitment_applications').get();assert.equal(row.status,'reviewing');assert.equal(row.notes,'Old notes');assert.equal(row.reviewed,13);assert.equal(row.joined_at,null);recruitmentStore(db);assert.equal(db.prepare('SELECT COUNT(*) n FROM recruitment_applications').get().n,1);}finally{db.close();rmSync(dir,{recursive:true,force:true});}
});
test('unchecked applicants are not starved by retries of older denied applications',async t=>fixture(async db=>{
 const calls=[],service=recruitMembershipService(db,{check:async main=>{calls.push(main);throw Object.assign(Error('Denied'),{status:403});}});await service.tick();assert.deepEqual(calls,[100,200,300,400]);const future=Date.now()+300001;t.mock.method(Date,'now',()=>future);await service.tick();assert.deepEqual(calls.slice(4,6),[500,600]);
}));
