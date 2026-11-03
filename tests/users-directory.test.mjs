import test from 'node:test';
import assert from 'node:assert/strict';
import {filterUsers,userRole} from '../public/users-model.mjs';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {openStore} from '../lib/store.mjs';
import {recruitmentStore} from '../lib/recruitment-store.mjs';
import {usersReviewService} from '../lib/users-review.mjs';
const rows=[{id:1,name:'Zulu',main_id:10,owner:true,characters:[{id:10,name:'Zulu'},{id:11,name:'Hidden Alt'}],last_online:100,groups:[]},{id:2,name:'alpha',main_id:20,admin:true,characters:[{id:20,name:'alpha'}],last_online:200,groups:[]},{id:3,name:'Beta',main_id:30,recruit:true,characters:[],last_online:null,groups:[{id:5,name:'Dreads',status:'pending'}]},{id:4,name:'gamma',main_id:40,characters:[{id:40,name:'gamma'}],last_online:150,groups:[{id:5,name:'Dreads',status:'approved'}],whitelist:{status:'denied'}}];
test('user search finds linked alts, corporations and IDs; roles include approved Groups',()=>{
 assert.deepEqual(filterUsers(rows,{q:'hidden alt'}).map(r=>r.id),[1]);assert.deepEqual(filterUsers(rows,{q:'Some Corp'},{20:{corporation_name:'Some Corp'}}).map(r=>r.id),[2]);assert.deepEqual(filterUsers(rows,{q:'40'}).map(r=>r.id),[4]);
 assert.deepEqual(filterUsers(rows,{role:'group:5'}).map(r=>r.id),[4]);assert.deepEqual(filterUsers(rows,{role:'admin'}).map(r=>r.id),[2]);assert.deepEqual(filterUsers(rows,{whitelist:'denied'}).map(r=>r.id),[4]);assert.equal(userRole(rows[0]),'owner');
});
test('user sorting handles names, last online, unknown dates and character counts without mutating source',()=>{
 assert.deepEqual(filterUsers(rows,{sort:'name-asc'}).map(r=>r.id),[2,3,4,1]);assert.deepEqual(filterUsers(rows,{sort:'online-desc'}).map(r=>r.id),[2,4,1,3]);assert.deepEqual(filterUsers(rows,{sort:'online-asc'}).map(r=>r.id),[1,4,2,3]);assert.deepEqual(filterUsers(rows,{sort:'chars-desc'}).map(r=>r.id),[1,2,4,3]);assert.deepEqual(rows.map(r=>r.id),[1,2,3,4]);
});
async function fixture(fn){const dir=mkdtempSync(join(tmpdir(),'users-review-')),db=openStore(dir);recruitmentStore(db);db.exec('CREATE TABLE IF NOT EXISTS inspections(session_id TEXT PRIMARY KEY,target_id INTEGER)');for(const [id,admin] of [[1,0],[2,0],[3,1],[4,0]])db.prepare('INSERT INTO users VALUES(?,?,?,?)').run(id,id*100,'User '+id,admin);const conditions=new Map([[200,'denied']]),calls=[];
 const service=usersReviewService(db,{check:async(id,force)=>{calls.push([id,force]);const status=conditions.get(id);if(status==='denied')throw Object.assign(Error('Denied'),{status:403});if(status==='error')throw Object.assign(Error('Unavailable'),{status:503});}},{owner:100});
 try{await fn({db,service,conditions,calls,actor:{main_id:100,user_id:1}});}finally{db.close();rmSync(dir,{recursive:true,force:true});}
}
test('whitelist review protects admins and active recruits and treats outages as unknown',()=>fixture(async({db,service,conditions,calls})=>{
 db.prepare('INSERT INTO recruitment_applications(user_id,created,consented) VALUES(4,1,1)').run();service.start();await service.tick();const status=id=>db.prepare('SELECT status FROM user_whitelist_reviews WHERE user_id=?').get(id).status;assert.equal(status(1),'protected');assert.equal(status(3),'protected');assert.equal(status(4),'protected');assert.equal(status(2),'denied');
 conditions.set(200,'error');service.start();await service.tick();assert.equal(status(2),'unknown');assert.ok(calls.every(([,force])=>force===true));assert.equal(db.prepare('SELECT count(*) n FROM users').get().n,4);
}));
test('cleanup rechecks current membership and refuses outages, protected accounts and wrong confirmations',()=>fixture(async({db,service,conditions,actor})=>{
 await assert.rejects(service.remove(actor,2,999));await assert.rejects(service.remove({main_id:300,user_id:3},2,200));await assert.rejects(service.remove(actor,3,300));
 conditions.set(200,'error');await assert.rejects(service.remove(actor,2,200));conditions.set(200,'allowed');await assert.rejects(service.remove(actor,2,200));assert.ok(db.prepare('SELECT 1 FROM users WHERE id=2').get());
 conditions.set(200,'denied');await service.remove(actor,2,200);assert.equal(db.prepare('SELECT 1 FROM users WHERE id=2').get(),undefined);
}));
