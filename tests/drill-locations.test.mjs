import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {nearestDrillMoon,drillLocationService} from '../lib/drill-locations.mjs';
test('moon coordinate matching rejects missing, distant, ambiguous and wrong-system positions',()=>{
 const location={solar_system_id:1,position:{x:100,y:200,z:300}},rows=[[10,1,101,200,300],[20,1,1e10,0,0]];
 assert.equal(nearestDrillMoon(location,rows),10);assert.equal(nearestDrillMoon({},rows),null);
 assert.equal(nearestDrillMoon(location,[[10,2,101,200,300]]),null);
 assert.equal(nearestDrillMoon(location,[[10,1,1e10,0,0]]),null);
 assert.equal(nearestDrillMoon(location,[rows[0],[20,1,102,200,300]]),null);
});
test('authorised ESI lookup persists the moon while preserving inventory and retains saved data on outage',async()=>{
 const db=new DatabaseSync(':memory:'),m=JSON.parse(gunzipSync(readFileSync(new URL('../lib/moon-positions.json.gz',import.meta.url))))[0];
 db.exec('CREATE TABLE corp_authorizations(user_id INTEGER,corporation_id INTEGER,character_id INTEGER);CREATE TABLE characters(id INTEGER,user_id INTEGER,scopes TEXT);CREATE TABLE corp_snapshots(corporation_id INTEGER,data TEXT);INSERT INTO corp_authorizations VALUES(1,99,1)');
 db.prepare('INSERT INTO characters VALUES(1,1,?)').run(JSON.stringify(['esi-universe.read_structures.v1']));
 const rows=[{id:1,kind:'Moon Drill',name:'Goo Maker 7',fuel:123}],snapshot=()=>({structures:JSON.parse(db.prepare('SELECT data FROM corp_snapshots').get().data)});
 db.prepare('INSERT INTO corp_snapshots VALUES(99,?)').run(JSON.stringify(rows));let failed=false,calls=0;
 const service=drillLocationService({db,corporation:99,snapshot,eve:{async get(path,pilot){calls++;assert.equal(path,'/universe/structures/1');assert.equal(pilot.id,1);if(failed)throw Object.assign(Error('Unavailable'),{status:503});return {owner_id:99,type_id:81826,solar_system_id:m[1],position:{x:m[2]+1000,y:m[3],z:m[4]}};}}});
 try{failed=true;await service.collect();assert.equal(snapshot().structures[0].moon_id,undefined);failed=false;await service.collect();assert.equal(snapshot().structures[0].moon_id,m[0]);assert.equal(snapshot().structures[0].fuel,123);await service.collect();assert.equal(calls,2);}finally{db.close();}
});
