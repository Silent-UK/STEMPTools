import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openStore} from '../lib/store.mjs';
import {whitelistService} from '../lib/whitelist.mjs';
import {eveClock} from '../public/eve-clock.mjs';

test('pilot and alliance grants use the login main and revoke when no grant matches',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'tools-whitelist-')),db=openStore(dir);
 try{
  db.prepare('DELETE FROM login_whitelist').run();
  let alliance=900,calls=0;
  const service=whitelistService(db,async()=>{calls++;return {corporation_id:400};},async()=>({alliance_id:alliance}));
  db.prepare('INSERT INTO login_whitelist_entities VALUES(?,?,?)').run('pilot',100,'Pilot');
  await service.check(100);assert.equal(calls,0);
  await assert.rejects(service.check(101),error=>error.status===403);
  db.prepare('INSERT INTO login_whitelist_entities VALUES(?,?,?)').run('alliance',900,'Alliance');service.invalidate();
  assert.equal(await service.check(101),400);
  alliance=901;await assert.rejects(service.check(101,true),error=>error.status===403);
  db.prepare("DELETE FROM login_whitelist_entities WHERE kind='pilot'").run();service.invalidate();
  await assert.rejects(service.check(100),error=>error.status===403);
 }finally{db.close();rmSync(dir,{recursive:true,force:true});}
});
test('EVE clock uses UTC even for a date supplied in another time zone',()=>{
 assert.equal(eveClock(new Date('2026-07-01T12:34:56+02:00')),'EVE 10:34:56');
 assert.equal(eveClock(new Date('2026-11-02T00:00:00Z')),'EVE 00:00:00');
});
