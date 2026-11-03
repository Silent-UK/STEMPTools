import test from 'node:test';import assert from 'node:assert/strict';
import {walletPreferences,validateWalletFilters,personalWalletRows,walletAnalysis,walletCoverage,walletCSV} from '../public/personal-wallet-model.mjs';
import {personalWalletView} from '../public/personal-wallet-view.mjs';
const now=Date.parse('2026-11-03T12:00:00Z'),date='2026-11-03T10:00:00Z',chars=[{id:1,name:'Main',isk:1000},{id:2,name:'Alt',isk:200}];
const entry=(id,amount,extra={})=>({id,amount,date,ref_type:'player_donation',first_party_id:9,second_party_id:1,...extra});
const pilots=[{id:1,name:'Main',updated:now,data:{started_at:now,journal:[entry(1,-100,{first_party_id:1,second_party_id:2}),entry(2,300,{ref_type:'bounty_prizes'}),entry(3,-30,{ref_type:'market_transaction',first_party_id:1,second_party_id:2})],transactions:[],names:{9:'NPC'}}},{id:2,name:'Alt',updated:now,data:{journal:[entry(1,100,{first_party_id:1,second_party_id:2})],transactions:[]}}];
test('own-character donations are separate without hiding trades or counting transfers as income',()=>{
 const result=walletAnalysis(pilots,chars,walletPreferences(),now);assert.equal(result.transfers.length,2);assert.equal(result.rows.length,2);assert.deepEqual(result.flow,{income:300,expense:30,net:270,unknown:0});assert.deepEqual(result.transferFlow,{income:100,expense:100,net:0,unknown:0});
 const gross=walletAnalysis(pilots,chars,walletPreferences({exclude_own:false}),now);assert.equal(gross.flow.income,400);assert.equal(gross.flow.expense,130);assert.equal(gross.flow.net,270);
 const single=walletAnalysis([pilots[0]],chars,walletPreferences(),now);assert.equal(single.transfers.length,1);assert.equal(single.flow.expense,30);
});
test('custom dates include the entire end date and absolute amount filters work for expenses',()=>{
 const rows=[{id:1,name:'Main',data:{journal:[entry(1,-50,{date:'2026-11-03T23:59:59Z'}),entry(2,50,{date:'2026-11-04T00:00:00Z'})]}}];
 const f=walletPreferences({days:'custom',from:'2026-11-03',to:'2026-11-03',min:'40',max:'60'});validateWalletFilters(f);
 assert.deepEqual(personalWalletRows(rows,chars,f,now).map(r=>r.id),[1]);assert.equal(personalWalletRows(rows,chars,{...f,min:'51'},now).length,0);
 assert.throws(()=>validateWalletFilters({...f,from:'2026-11-05'}),/start date/);assert.throws(()=>validateWalletFilters({...f,min:'90'}),/Minimum/);
 assert.throws(()=>validateWalletFilters({...f,from:''}),/both dates/);
});
test('party names and IDs are searchable, duplicate own ledger rows are retained once per character',()=>{
 const duplicate=[{...pilots[0],data:{...pilots[0].data,journal:[...pilots[0].data.journal,pilots[0].data.journal[0]]}},pilots[1]];
 const rows=personalWalletRows(duplicate,chars,walletPreferences({q:'Alt',exclude_own:false}),now);assert.equal(rows.length,3);assert.equal(rows.filter(r=>r.own_transfer).length,2);
 assert.equal(personalWalletRows(pilots,chars,walletPreferences({q:'NPC'}),now).length,1);
});
test('market trades stay separate from journal cash flow and corporation trades are optional',()=>{
 const p=[{id:1,name:'Main',data:{journal:[entry(1,100)],transactions:[{transaction_id:1,date,is_buy:true,quantity:2,unit_price:5,client_id:9,name:'Ore',is_personal:true},{transaction_id:2,date,is_buy:false,quantity:1,unit_price:50,client_id:9,name:'Ore',is_personal:false}]}}];
 const f=walletPreferences({mode:'transactions'});assert.equal(walletAnalysis(p,chars,f,now).flow.net,-10);assert.equal(walletAnalysis(p,chars,{...f,personal_only:false},now).flow.net,40);
 assert.equal(walletAnalysis(p,chars,f,now).transfers.length,0);
});
test('history coverage distinguishes empty snapshots from missing or failed history',()=>{
 const result=walletCoverage([{id:1,name:'Empty',updated:now,data:{journal:[],started_at:now}},{id:2,name:'Missing',updated:null,data:null},{id:3,name:'Failed',updated:now,error:'503',data:{journal:[]}}],walletPreferences(),now);
 assert.equal(result[0].missing,false);assert.equal(result[0].first,null);assert.equal(result[1].missing,true);assert.equal(result[2].failed,true);
});
test('CSV quotes text neutralizes formulas and keeps negative amounts numeric',()=>{
 const rows=[{pilot:'=unsafe',pilot_id:1,id:1,date,transaction_type:'gift',from:'A,"B"',to:'Alt',amount:-50,balance:100,description:'two\nlines',snapshot_updated:now}];
 const csv=walletCSV(rows,walletPreferences());assert.equal(csv.charCodeAt(0),0xfeff);assert.ok(csv.includes('\r\n'));assert.ok(csv.includes("'"+'=unsafe'));assert.ok(csv.includes('"A,""B"""'));assert.ok(csv.includes('"-50"'));assert.ok(!csv.includes("'"+'-50'));
});
test('wallet rendering escapes party and description text and does not show missing cash flow as zero',()=>{
 const p=[{id:1,name:'<Pilot>',updated:now,data:{journal:[entry(1,-50,{description:'<script>bad</script>'})],names:{9:'<Party>'}}}];
 const html=personalWalletView(p,[],walletPreferences(),0,[],now);assert.match(html,/&lt;script&gt;/);assert.doesNotMatch(html,/<script>|<Party>|<Pilot>/);
 assert.match(personalWalletView([{id:1,name:'Missing',data:null}],chars,walletPreferences(),0,chars,now),/Unavailable/);
});
