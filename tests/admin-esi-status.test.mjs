import test from 'node:test';
import assert from 'node:assert/strict';
import {accountEsiStatus} from '../public/admin-esi-status.mjs';
const pilot=(id,extra={})=>({id,name:'Pilot '+id,updated:123,reconnect:0,errors:[],...extra});
test('account ESI summary flags invalid alts before other sync states',()=>{
 const status=accountEsiStatus([pilot(1),pilot(2,{reconnect:1}),pilot(3,{errors:[{kind:'wallet'}]})]);
 assert.equal(status.level,'invalid');assert.equal(status.label,'1 Reconnect Required');assert.match(status.detail,/Pilot 2/);
});
test('endpoint sync failures do not imply invalid authentication',()=>{
 const status=accountEsiStatus([pilot(1,{errors:[{kind:'wallet-history'}]})]);assert.equal(status.level,'warning');assert.match(status.label,/Sync Issues/);
});
test('account ESI summary distinguishes no characters, first sync, queued work and connected',()=>{
 assert.equal(accountEsiStatus([]).level,'unknown');assert.equal(accountEsiStatus([pilot(1,{updated:null})]).label,'Awaiting Sync');
 assert.equal(accountEsiStatus([pilot(1,{job:'queued'})]).level,'syncing');assert.equal(accountEsiStatus([pilot(1)]).level,'connected');
});
