import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {esiLocationBackoff,localStationLookup} from '../lib/esi-location-backoff.mjs';
import {eveClient} from '../lib/eve.mjs';
test('location backoff survives restart, separates pilots/auth contexts and expires after 24 hours',t=>{
 let now=1000000;t.mock.method(Date,'now',()=>now);const db=new DatabaseSync(':memory:');try{
  let cache=esiLocationBackoff(db);cache.record('/universe/structures/100/','character:1',403);cache=esiLocationBackoff(db);
  assert.equal(cache.get('/universe/structures/100','character:1').status,403);assert.equal(cache.get('/universe/structures/100','character:2'),undefined);assert.equal(cache.get('/universe/structures/100','corporation:1'),undefined);
  now+=86400000;assert.equal(cache.get('/universe/structures/100','character:1'),undefined);cache.record('/universe/structures/100','character:1',404);cache.record('/universe/structures/100','character:1',200);assert.equal(cache.get('/universe/structures/100','character:1'),undefined);
  for(const status of [401,420,429,500,503]){cache.record('/universe/structures/200','character:1',status);assert.equal(cache.get('/universe/structures/200','character:1'),undefined);}
  cache.record('/characters/1/skills','character:1',403);assert.equal(cache.get('/characters/1/skills','character:1'),null);
 }finally{db.close();}
});
test('asset safety resolves locally and non-station item IDs never become station lookups',()=>{
 assert.deepEqual(localStationLookup('/universe/stations/2004'),{name:'Asset Safety'});assert.equal(localStationLookup('/universe/stations/60000001'),null);assert.equal(localStationLookup('/universe/structures/1000000000001'),null);
 for(const id of [1989162316,30000001,1254927972])assert.throws(()=>localStationLookup('/universe/stations/'+id),e=>e.invalid_location&&e.status===404);
});
test('actual ESI client suppresses repeated denied/missing requests but retries after expiry',async t=>{
 let now=1000000,calls=0;t.mock.method(Date,'now',()=>now);t.mock.method(globalThis,'fetch',async()=>{calls++;return new Response('{}',{status:404});});
 const db=new DatabaseSync(':memory:');db.exec('CREATE TABLE public_cache(path TEXT PRIMARY KEY,data TEXT,expires INTEGER);CREATE TABLE esi_cache(character_id INTEGER,path TEXT,data TEXT,expires INTEGER,PRIMARY KEY(character_id,path))');
 try{const client=eveClient(db,{}, {esiTrace:false}),path='/universe/stations/60000001';await assert.rejects(client.publicGet(path),e=>e.status===404);await assert.rejects(client.publicGet(path),e=>e.cached_location_error);assert.equal(calls,1);now+=86400001;await assert.rejects(client.publicGet(path),e=>e.status===404);assert.equal(calls,2);assert.equal((await client.publicGet('/universe/stations/2004')).name,'Asset Safety');await assert.rejects(client.publicGet('/universe/stations/1989162316'),e=>e.invalid_location);assert.equal(calls,2);}finally{db.close();}
});
