import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApp} from '../server.mjs';
import * as corporation from '../lib/corp.mjs';
import {openStore} from '../lib/store.mjs';
import {hash,cryptoBox} from '../lib/security.mjs';
const base='http://127.0.0.1',key='ab'.repeat(32);
const personal=['/me','/characters','/skills/overview','/characters/100/skills','/operations/clones','/operations/wallet-history','/operations/contracts','/operations/standings','/ratting','/operations/market','/operations/mining','/operations/industry','/operations/dens','/operations/pi','/assets','/documents','/groups','/settings','/notifications','/pi/dashboard','/pi/shares','/pi/shared','/material-planner/personal','/recruit/application','/discord'];
const corporate=['overview','members','pilots','wallet','contracts','assets','pilot-assets','standings','market','industry','blueprints','structures','harvest','surveys','surveys/browser'].map(s=>'/corporation/'+s);
const admin=['users','groups','links','pages','esi','corporations','whitelist','recruitment','discord','affiliations','group-conditions'].map(s=>'/admin/'+s);
async function fixture(fn){
 const dir=mkdtempSync(join(tmpdir(),'tools-page-health-')),db=openStore(dir);
 let typeReads=0;const cat={type:()=>{typeReads++;return null},search:()=>[],schematic:()=>null,close(){}};
 const {app}=createApp({base,data:dir,key,db,cat,owner:100,client:'test',secret:'test',fittingSimulator:()=>({}),membershipLookup:async()=>({corporation_id:corporation.STEMP_ID??corporation.NARVI_ID}),eve:{get:async()=>[],publicGet:async()=>[],request:async()=>({data:[],pages:1})}});
 for(const [uid,id,owner] of [[1,100,1],[2,200,0]]){db.prepare('INSERT INTO users VALUES(?,?,?,?)').run(uid,id,'Pilot '+id,owner);db.prepare('INSERT INTO characters VALUES(?,?,?,?,?,?,?,0)').run(id,uid,'Pilot '+id,'owner',cryptoBox(key).seal({refresh_token:'private-test-token'}),'[]',Date.now()+100000);db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(hash('session-'+id),uid,Date.now()+100000);}
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 const request=(path,{actor,method='GET',body,origin=base}={})=>fetch(base+':'+server.address().port+'/api'+path,{method,redirect:'manual',headers:{...(actor?{cookie:'tools_session=session-'+actor}:{}),...(body!==undefined?{'content-type':'application/json',origin}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{})});
 try{await fn({db,request,typeReads:()=>typeReads});}finally{await new Promise(r=>server.close(r));db.close();rmSync(dir,{recursive:true,force:true});}
}
test('all page APIs reject anonymous reads, with private no-store responses',()=>fixture(async({request})=>{
 for(const path of [...personal,...corporate,...admin,'/recruitment','/inspect/mail?character=100','/inspect/pilot-check','/inspect/pilot-combat','/pages/1','/fitting-workbench/items']){const r=await request(path);assert.equal(r.status,401,path);assert.match(r.headers.get('cache-control'),/no-store/,path);}
}));
test('ordinary member cannot enter any admin, corporate or inspect page API',()=>fixture(async({request})=>{
 for(const path of [...corporate,...admin,'/recruitment','/inspect/mail?character=100','/inspect/contacts?character=100','/inspect/pilot-check','/inspect/pilot-combat','/material-planner/corporation'])assert.equal((await request(path,{actor:200})).status,403,path);
}));
test('empty personal pages load without exposing credentials or other accounts',()=>fixture(async({request})=>{
 for(const path of personal.filter(p=>p!=='/characters/100/skills')){const r=await request(path,{actor:200});assert.equal(r.status,200,path);assert.match(r.headers.get('cache-control'),/no-store/);const text=await r.text();assert.ok(!text.includes('private-test-token'),path);if(path!=='/pi/shares')assert.ok(!text.includes('Pilot 100'),path); /* Sharing lists registered recipient names, never their private snapshots. */}
 for(const path of ['/characters/100/skills','/characters/100/saved-fittings'])assert.equal((await request(path,{actor:200})).status,404,path);
}));
test('CSRF, malformed writes and unknown API paths fail safely',()=>fixture(async({request})=>{
 for(const path of ['/settings','/sync','/notifications/dismiss','/groups/1/apply'])assert.equal((await request(path,{actor:200,method:'POST',body:{},origin:'https://foreign.example'})).status,403,path);
 assert.equal((await request('/settings',{actor:200,method:'POST',body:[]})).status,400);
 const missing=await request('/unknown-healthcheck-route',{actor:200});assert.equal(missing.status,404);assert.match(missing.headers.get('content-type'),/json/);
 const uppercase=await request('/CHARACTERS',{actor:200});assert.equal(uppercase.status,200);assert.match(uppercase.headers.get('cache-control'),/no-store/);
}));
test('inspection denies every write and keeps admin accounts protected',()=>fixture(async({request})=>{
 assert.equal((await request('/inspect',{actor:100,method:'POST',body:{user_id:2}})).status,200);
 for(const [path,body] of [['/settings',{theme:'oled'}],['/characters/200/sync',{}],['/sync',{}],['/notifications/dismiss',{keys:[]}]])assert.equal((await request(path,{actor:100,method:'POST',body})).status,403,path);
 assert.equal((await request('/inspect',{actor:200,method:'POST',body:{user_id:1}})).status,403);
}));

test('administrators receive corporation visibility settings without a Director connection',()=>fixture(async({request})=>{
 const r=await request('/settings',{actor:100});assert.equal(r.status,200);const data=await r.json();
 for(const id of ['corp-assets','corp-wallet','corp-industry','corp-blueprints','corp-surveys'])assert.ok(data.corporate_pages[id],id);
 const member=await (await request('/settings',{actor:200})).json();assert.deepEqual(member.corporate_pages,{});
}));

test('asset search reuses catalogue lookups for repeated item types',()=>fixture(async({db,request,typeReads})=>{
 const items=Array.from({length:1000},(_,i)=>({item_id:10000+i,type_id:34,quantity:1,location_id:60003760,root_location_id:60003760}));
 db.prepare('INSERT INTO snapshots VALUES(?,?,?,?,?,NULL)').run(200,'assets',JSON.stringify({items,locations:{60003760:'Example Station'}}),Date.now(),Date.now()+100000);
 const before=typeReads(),r=await request('/assets',{actor:200});assert.equal(r.status,200);assert.equal((await r.json()).total,1000);assert.equal(typeReads()-before,1);
}));
