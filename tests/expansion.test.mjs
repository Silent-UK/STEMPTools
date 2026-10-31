import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {collectMarket} from '../lib/personal-market.mjs';
import {fittingToEFT} from '../lib/saved-fittings.mjs';
import {pilotAccess,corpDataService} from '../lib/corp-data.mjs';
import {openStore} from '../lib/store.mjs';
const c={id:1,scopes:'["esi-markets.read_character_orders.v1"]'};
const order=(id,rest=3)=>({order_id:id,type_id:1,price:12,volume_remain:rest,volume_total:10,location_id:60003760,issued:'2026-10-31T12:00:00Z'});
test('market collection paginates history, retains reported closures and never assumes missing active orders completed',async()=>{
 const calls=[],eve={request:async p=>{calls.push(p);return p.includes('/history')?{pages:2,data:[{...order(p.endsWith('=1')?2:3,p.endsWith('=1')?0:2),state:'expired'}]}:{pages:1,data:[{...order(1),is_buy_order:true}]}},publicGet:async()=>({name:'Jita'})};
 const d=await collectMarket(c,eve,{type:()=>({name:'Ship'})},{active:[order(99)],history:[{...order(4),status:'cancelled'}],locations:{}});
 assert.equal(d.active[0].is_buy_order,true);assert.equal(d.history.find(o=>o.order_id===2).status,'fulfilled');assert.equal(d.history.find(o=>o.order_id===3).status,'expired');assert(d.history.some(o=>o.order_id===4));assert(!d.history.some(o=>o.order_id===99));assert.equal(d.locations[60003760],'Jita');assert.equal(calls.length,3);
 await assert.rejects(()=>collectMarket({...c,scopes:'[]'},eve,{}),/Reconnect/);
 await assert.rejects(()=>collectMarket(c,{request:async p=>p.includes('history')?{pages:0,data:[]}:{pages:1,data:[order(1)]}},{type:()=>null}),/Incomplete/);
});
test('saved fitting conversion preserves module and cargo quantities and fails before importing unsupported items',()=>{
 const types={1:{id:1,name:'Rifter',category_id:6,attributes:{}},2:{id:2,name:'Damage Control II',category_id:7,attributes:{}},3:{id:3,name:'EMP S',category_id:8,attributes:{}}},cat={type:id=>types[id],named:name=>Number(Object.keys(types).find(id=>types[id].name===name))};
 const fit={ship_type_id:1,name:'Saved [Fit]\nTest',items:[{type_id:2,flag:'LoSlot0',quantity:1},{type_id:3,flag:'Cargo',quantity:500}]},eft=fittingToEFT(fit,cat);
 assert(eft.startsWith('[Rifter, Saved  Fit  Test]'));assert(eft.includes('Damage Control II'));assert(eft.includes('EMP S x500'));
 assert.throws(()=>fittingToEFT({...fit,items:[{type_id:999,flag:'LoSlot0',quantity:1}]},cat),/unsupported/);
 assert.throws(()=>fittingToEFT({...fit,items:[{type_id:2,flag:'LoSlot99',quantity:1}]},cat),/unsupported/);
 assert.throws(()=>fittingToEFT({...fit,items:[{type_id:2,flag:'LoSlot0',quantity:9}]},cat),/quantity/);
});
test('pilot access combines title roles by location, keeps grantable roles distinct and expands CEO/director division access',()=>{
 const r=pilotAccess({roles_at_base:['Hangar_Query_2'],grantable_roles:['Account_Take_7']},[{roles_at_hq:['Hangar_Take_2'],roles:['Account_Take_3']}],{hangar:[{division:2,name:'Fleet Ships'}],wallet:[{division:3,name:'Industry'}]});
 assert(r.access.some(a=>a.name==='Fleet Ships'&&a.where==='Base'&&a.rights.includes('Query')));assert(r.access.some(a=>a.where==='HQ'&&a.rights.includes('Take')));assert(r.access.some(a=>a.name==='Industry'&&a.kind==='wallet'));assert(!r.access.some(a=>a.kind==='wallet'&&a.division===7));assert(r.grantable.grantable_roles.includes('Account_Take_7'));
 assert.equal(pilotAccess({roles:['Director']}).access.filter(a=>a.kind==='wallet').length,7);assert.equal(pilotAccess({},[],{},true).access.filter(a=>a.kind==='hangar').length,7);
});
async function corpFixture(fn){
 const dir=mkdtempSync(join(tmpdir(),'tools-expansion-')),db=openStore(dir);
 db.prepare("INSERT INTO users VALUES(1,1,'Director',0)").run();
 db.prepare("INSERT INTO corp_authorizations VALUES(1,1,'Director','owner',668298004,'encrypted',?,9999999999999,'Director',0)").run(JSON.stringify(['esi-wallet.read_corporation_wallets.v1','esi-corporations.read_divisions.v1','esi-assets.read_corporation_assets.v1']));
 try{await fn(db);}finally{db.close();rmSync(dir,{recursive:true,force:true});}
}
test('corporation wallet keeps complete division history on a later partial failure and refuses revoked credentials',()=>corpFixture(async db=>{
 let fail=false,allowed=true;
 const request=async p=>{
  if(p.endsWith('/wallets'))return {data:Array.from({length:7},(_,i)=>({division:i+1,balance:i*100}))};
  if(p.endsWith('/divisions'))return {data:{wallet:[{division:1,name:'Main'}]}};
  if(p.includes('/transactions?'))return {data:[]};
  if(p.endsWith('/transactions'))return {data:[{transaction_id:5,quantity:2,unit_price:10,is_buy:true,date:'2026-10-31',type_id:1,client_id:99}]};throw Error('Unexpected path');
 };
 const service=corpDataService({db,id:668298004,cat:{type:()=>({name:'Ship'})},eve:{request:async()=>({data:[{id:99,name:'Trader'}]})},access:async()=>allowed,request,pages:async p=>{if(fail&&p.includes('/3/'))throw Error('Partial failure');return {data:[{id:1,date:'2026-10-31',amount:100}]};}});
 const first=await service.wallets();assert.equal(first.rows.length,7);assert.equal(first.rows[0].name,'Main');assert.equal(first.rows[0].transactions.length,1);assert.equal(first.names[99],'Trader');
 fail=true;db.prepare("UPDATE public_cache SET expires=0 WHERE path='/tools/corp-data/wallet'").run();
 const next=await service.wallets();assert.equal(next.updated,first.updated);assert.equal(next.error,'Partial failure');assert.deepEqual(next.rows,first.rows);
 allowed=false;await assert.rejects(()=>service.wallets(),/Reconnect/);
}));
test('corporation asset search preserves parent ship context and location grouping',()=>corpFixture(async db=>{
 const service=corpDataService({db,id:668298004,cat:{type:id=>({name:id===1?'Rifter':'Autocannon',category_id:id===1?6:7})},eve:{},access:async()=>true,request:async()=>({data:[]}),snapshot:()=>({structures:[{id:123,name:'Home Citadel'}]}),pages:async()=>({data:[{item_id:1,type_id:1,location_id:123,location_flag:'CorpSAG1',quantity:1,is_singleton:true},{item_id:2,type_id:2,location_id:1,location_flag:'HiSlot0',quantity:1}]})});
 const d=await service.assets({q:'Autocannon'});assert.equal(d.total,1);assert.equal(d.locationCount,1);assert.equal(d.locations[0].name,'Home Citadel');assert.equal(d.locations[0].items.find(a=>a.item_id===1).context,true);
 assert.equal((await service.assets({location:'Elsewhere'})).total,0);
}));
test('pilot roster combines tracking, titles and direct roles without treating grantable roles as access',()=>corpFixture(async db=>{
 db.prepare('UPDATE corp_authorizations SET scopes=?').run(JSON.stringify(['esi-corporations.read_corporation_membership.v1','esi-corporations.track_members.v1','esi-corporations.read_titles.v1','esi-corporations.read_divisions.v1']));
 const request=async path=>({data:path.endsWith('/members/titles')?[{character_id:10,titles:[1]}]:path.endsWith('/titles')?[{title_id:1,name:'Industry',roles:['Account_Take_2']}]:path.endsWith('/roles')?[{character_id:10,roles_at_hq:['Hangar_Take_1'],grantable_roles:['Account_Take_7']}]:path.endsWith('/membertracking')?[{character_id:10,start_date:'2020-01-01',logon_date:'2026-10-31',base_id:60003760}]:{wallet:[{division:2,name:'Production'}]}});
 const service=corpDataService({db,id:668298004,cat:{},eve:{publicGet:async()=>({ceo_id:99})},request,access:async()=>true,members:async()=>({updated:1,rows:[{id:10,name:'Pilot',signed_up:true}]})});
 const d=await service.pilots();assert.equal(d.rows[0].joined,'2020-01-01');assert.equal(d.rows[0].last_login,'2026-10-31');assert.equal(d.rows[0].titles[0].name,'Industry');assert(d.rows[0].rights.access.some(a=>a.name==='Production'));assert(!d.rows[0].rights.access.some(a=>a.kind==='wallet'&&a.division===7));
}));
