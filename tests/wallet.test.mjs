import test from 'node:test';
import assert from 'node:assert/strict';
import {collectWalletHistory} from '../lib/wallet-history.mjs';
import {walletRows,walletView} from '../public/wallet-view.mjs';
const c={id:1,scopes:'["esi-wallet.read_character_wallet.v1"]'},cat={type:()=>({name:'Ore'})};
const trade={transaction_id:5,date:'2026-10-29T12:00:00Z',quantity:10,unit_price:3,is_buy:true,type_id:34,client_id:99};
test('wallet follows journal pages and transaction cursors, retains history and deduplicates',async()=>{
 const eve={request:async path=>path.includes('journal')?{pages:2,data:[{id:path.endsWith('=1')?1:2,date:trade.date,amount:20}]}:path.includes('from_id')?{data:[]}:path.includes('transactions')?{data:[trade]}:{data:[{id:99,name:'Trader'}]}};
 const previous={journal:[{id:1,date:trade.date,amount:1},{id:3,date:'2026-01-01',amount:2}],transactions:[trade],names:{},started_at:1};
 const result=await collectWalletHistory(c,eve,cat,previous);assert.equal(result.journal.length,3);assert.equal(result.journal.find(r=>r.id===1).amount,20);assert.equal(result.transactions.length,1);assert.equal(result.names[99],'Trader');assert.equal(result.started_at,1);
});
test('wallet rejects incomplete pages and a repeating transaction cursor',async()=>{
 await assert.rejects(collectWalletHistory(c,{request:async()=>({pages:0,data:[]})},cat),/journal/);
 await assert.rejects(collectWalletHistory(c,{request:async p=>p.includes('journal')?{pages:1,data:[]}:{data:[trade]}},cat),/transaction/);
 await assert.rejects(collectWalletHistory({...c,scopes:'[]'}, {},cat),/Reconnect/);
});
test('wallet views keep journal and market totals separate, filter and escape text',()=>{
 const pilots=[{id:1,name:'<Pilot>',data:{names:{99:'<Trader>'},journal:[{id:1,date:trade.date,amount:20,description:'Gift'}],transactions:[{...trade,name:'<Ore>'}]}}];
 const filters={mode:'transactions',days:'all',q:'',direction:''};assert.equal(walletRows(pilots,filters)[0].amount,-30);assert.equal(walletRows(pilots,{...filters,mode:'journal'})[0].amount,20);assert.equal(walletRows(pilots,{...filters,direction:'in'}).length,0);
 const html=walletView(pilots,filters);assert(html.includes('&lt;Ore&gt;'));assert(!html.includes('<Trader>'));assert(html.includes('-30.00'));
});
