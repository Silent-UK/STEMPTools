import test from 'node:test';
import assert from 'node:assert/strict';
import {collectContracts} from '../lib/contracts.mjs';
import {contractRows,contractsView} from '../public/contracts-view.mjs';
test('contracts paginate, retain older entries and keep item failures visible',async()=>{
 const c={id:1,scopes:'["esi-contracts.read_character_contracts.v1"]'};
 const eve={request:async path=>path.includes('?page=')?{pages:2,data:[{contract_id:path.endsWith('1')?1:2,type:'item_exchange'}]}:Promise.reject(Error('unavailable'))};
 const result=await collectContracts(c,eve,{}, {contracts:[{contract_id:3,status:'outstanding'}]});assert.equal(result.contracts.length,3);assert(result.contracts.find(r=>r.contract_id===3).retained);assert(result.contracts[1].items_error);
 await assert.rejects(collectContracts(c,{request:async()=>({pages:0,data:[]})},{}),/Incomplete/);
});
test('contracts deduplicate pilots, filter and escape contract titles',()=>{
 const row={contract_id:1,type:'courier',status:'outstanding',title:'<Test>',observed:1};
 const pilots=['A','B'].map(name=>({name,data:{contracts:[row]}}));assert.equal(contractRows(pilots).length,1);assert.equal(contractRows(pilots)[0].pilots.length,2);assert.equal(contractRows(pilots,{status:'finished'}).length,0);assert(contractsView(pilots).includes('&lt;Test&gt;'));
});
