import test from 'node:test';
import assert from 'node:assert/strict';
import {eveTitle,plainEveText,rattingDisplayRows,memberGroups} from '../public/detail-models.mjs';
import {denAlerts} from '../public/den-model.mjs';
import {rattingSummary} from '../lib/management.mjs';
test('EVE title colours are parsed as bounded data, never arbitrary HTML or CSS',()=>{
 const title='<color=0xff00ff00>STEMP & Member<color=0xff808080>';
 assert.equal(plainEveText(title),'STEMP & Member');assert.equal(eveTitle(title),'<span data-eve-color="#00ff00ff">STEMP &amp; Member</span>');
 const unsafe=eveTitle('<color=red;position:absolute><img src=x onerror=alert(1)>A & B</color><script>bad</script>');assert(!unsafe.includes('<img'));assert(!unsafe.includes('<script'));assert(!unsafe.includes('position'));assert(unsafe.includes('A &amp; B'));
 assert.equal(eveTitle('<color=0x80ff0000>R</color>B'),'<span data-eve-color="#ff000080">R</span>B');
});
test('ratting hides alt rows by aggregating into mains without changing income totals',()=>{
 const chars=[{id:1,name:'Main',parent_id:1},{id:2,name:'Alt',parent_id:1},{id:3,name:'Other',parent_id:3}],rows=[{id:2,name:'Alt',total:50},{id:3,name:'Other',total:10}];
 const mains=rattingDisplayRows(rows,chars,false);assert.equal(mains.length,2);assert.equal(mains[0].id,1);assert.equal(mains[0].total,50);assert.equal(mains[0].alts,1);
 const all=rattingDisplayRows(rows,chars,true);assert.equal(all.find(r=>r.id===2).alt,true);assert.equal(all.reduce((n,r)=>n+r.total,0),mains.reduce((n,r)=>n+r.total,0));
});
test('member grouping uses registered person identity and leaves unknown pilots separate',()=>{
 const rows=[{id:2,name:'Alt',account_main_id:1,account_main_name:'Owner',last_active:'2026-10-31'},{id:3,name:'Unknown A',last_active:null},{id:4,name:'Unknown B',last_active:'2026-10-01'},{id:1,name:'Main',account_main_id:1,account_main_name:'Owner',last_active:'2026-10-20'}];
 const grouped=memberGroups(rows,'last_active',true);assert.equal(grouped.length,3);assert.equal(grouped[0].name,'Owner');assert.equal(grouped[0].rows.length,2);assert.equal(grouped[0].rows[0].id,1);assert.equal(grouped[2].rows[0].name,'Unknown A');
 assert.equal(memberGroups(rows,'last_active',false)[0].rows[0].id,2);assert.equal(memberGroups(rows,'name',false)[0].rows[0].name,'Alt');
});
test('den alerts honor twelve-hour and anarchy thresholds, expiration, missing operation data and staleness',()=>{
 const now=Date.parse('2026-10-31T12:00:00Z'),den=(level,amount,hours)=>({id:1,evolution:{anarchy:{level:'Level'+level,amount}},operations:[{state:'Available',expires:new Date(now+hours*3600000).toISOString()}]});
 const rows=data=>[{id:1,name:'Owner',updated:now,data}];
 assert.equal(denAlerts(rows([den(1,34,13)]),now).length,0);
 const alerts=denAlerts(rows([den(1,35,12)]),now);assert.equal(alerts.length,2);assert(alerts.every(a=>!a.stale));
 assert.equal(denAlerts(rows([den(2,40,-1)]),now).length,1);
 assert.equal(denAlerts(rows([{...den(0,0,1),operations_error:'Unavailable'}]),now).length,0);
 assert(denAlerts([{id:1,name:'Owner',updated:now-7200001,data:[den(2,40,13)]}],now)[0].stale);
});
test('ratting daily averages use calendar-day and rolling-period denominators',()=>{
 const now=Date.parse('2026-10-31T12:00:00Z'),pilots=[{id:1,data:{journal:[{ref_type:'bounty_prizes',date:'2026-10-31',amount:310}]}}];
 assert.equal(rattingSummary(pilots,'day',now).average_per_day,310);assert.equal(rattingSummary(pilots,'month',now).days,31);assert.equal(rattingSummary(pilots,'month',now).average_per_day,10);assert.equal(rattingSummary(pilots,'30',now).days,30);assert.equal(rattingSummary([],'all',now).days,1);
});
