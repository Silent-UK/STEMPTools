import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {corporateLocations} from '../lib/corp-locations.mjs';

test('locations resolve station, citadel and space IDs to their solar system and region',async()=>{
 const db=new DatabaseSync(':memory:');db.exec('CREATE TABLE public_cache(path TEXT PRIMARY KEY,data TEXT,expires INTEGER)');
 const eve={publicGet:async path=>{
  if(path.includes('/stations/'))return {name:'Station',system_id:30000001,type_id:1531};
  if(path.includes('/systems/'))return {name:'System',constellation_id:20000001};
  if(path.includes('/constellations/'))return {region_id:10000001};
  if(path.includes('/regions/'))return {name:'Region'};
  throw Error('unexpected');
 }};
 let requested=0;
 const resolve=corporateLocations({db,eve,request:async()=>{requested++;return {data:{name:'Citadel',solar_system_id:30000001,type_id:35832}};},snapshot:()=>({structures:[]})});
 try{
  assert.equal((await resolve(60000001,{})).system,'System');
  assert.deepEqual(await resolve(1000000000001,{}),{name:'Citadel',type_id:35832,system:'System',region:'Region'});
  await resolve(1000000000001,{});assert.equal(requested,1);
  assert.equal((await resolve(30000001,{})).region,'Region');
 }finally{db.close();}
});

test('unavailable citadels do not invent a solar system',async()=>{
 const db=new DatabaseSync(':memory:');db.exec('CREATE TABLE public_cache(path TEXT PRIMARY KEY,data TEXT,expires INTEGER)');
 try{
  const resolve=corporateLocations({db,eve:{},request:async()=>{throw Error('Forbidden');},snapshot:()=>({structures:[]})});
  assert.equal((await resolve(1000000000001,{})).system,null);
 }finally{db.close();}
});
