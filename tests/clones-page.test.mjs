import test from 'node:test';import assert from 'node:assert/strict';
import {clonePreferences,cloneReadiness,filterClonePilots,cloneLocationGroups} from '../public/clone-model.mjs';
import {cloneResults} from '../public/clone-view.mjs';
const now=Date.parse('2026-11-03T12:00:00Z');
const pilot=(id,name,clones,extra={})=>({id,name,updated:now,data:{ready_at:null,clones,active_implants:[],home_location:{name:'Home Station'}},...extra});
const combat={jump_clone_id:1,name:'Combat',location_id:5,location:'Fortizar',system:'Jita',region:'The Forge',implants:[{id:1,name:'Crystal Alpha'}]},empty={jump_clone_id:2,name:'Travel',location_id:6,location:'Other Station',implants:[]};
test('clone readiness excludes stale failed and invalid snapshots from confirmed ready status',()=>{
 assert.equal(cloneReadiness(pilot(1,'Main',[]),now).kind,'ready');
 assert.equal(cloneReadiness(pilot(1,'Main',[],{data:{ready_at:new Date(now+3600000).toISOString()}}),now).kind,'cooldown');
 for(const p of [pilot(1,'Main',[],{updated:now-3*3600000}),pilot(1,'Main',[],{error:'HTTP 503'}),pilot(1,'Main',[],{reconnect:true})])assert.equal(cloneReadiness(p,now).kind,'stale');
 assert.equal(cloneReadiness({id:1,data:null},now).kind,'unavailable');assert.equal(cloneReadiness(pilot(1,'Main',[],{data:{ready_at:'bad'}}),now).kind,'unavailable');
});
test('clone search matches implants names regions and home clone without losing character identity',()=>{
 const rows=[pilot(1,'Main',[combat,empty])];
 for(const q of ['Crystal','Combat','Jita','The Forge']){const result=filterClonePilots(rows,clonePreferences({q}),now);assert.equal(result.length,1);assert.equal(result[0].visibleClones.length,1);assert.equal(result[0].id,1);}
 assert.equal(filterClonePilots(rows,clonePreferences({q:'Home Station'}),now)[0].visibleClones.length,2);
 assert.equal(filterClonePilots(rows,clonePreferences({q:'nobody'}),now).length,0);
});
test('implant and location filters affect stored clones and never turn missing snapshots into empty clones',()=>{
 const rows=[pilot(1,'Main',[combat,empty,{...empty,jump_clone_id:3,location_unavailable:true,location:'Location 77 (unavailable)'}]),{id:2,name:'Missing',updated:null,data:null}];
 assert.equal(filterClonePilots(rows,clonePreferences({filter:'implants'}),now)[0].visibleClones.length,1);
 assert.equal(filterClonePilots(rows,clonePreferences({filter:'empty'}),now)[0].visibleClones.length,2);
 assert.equal(filterClonePilots(rows,clonePreferences({filter:'empty'}),now).length,1);
 assert.equal(filterClonePilots(rows,clonePreferences({filter:'unavailable'}),now)[0].visibleClones.length,1);
 assert.equal(filterClonePilots([pilot(1,'Stale',[combat],{error:'failed'})],clonePreferences({filter:'ready'}),now).length,0);
});
test('location-first grouping combines station IDs across pilots while retaining each owner and clone',()=>{
 const pilots=filterClonePilots([pilot(1,'Main',[combat]),pilot(2,'Alt',[{...combat,name:'Training'}])],clonePreferences(),now),groups=cloneLocationGroups(pilots);
 assert.equal(groups.length,1);assert.equal(groups[0].entries.length,2);assert.deepEqual(groups[0].entries.map(e=>e.pilot.id),[2,1]);
 assert.equal(pilots[0].visibleClones[0].name,'Combat');
});
test('clones UI escapes names and preserves manual closed state while search expands matches',()=>{
 const escape=v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
 const helpers={esc:escape,portrait:p=>escape(p.name),implantList:items=>items.map(i=>escape(i.name)).join('')},rows=[pilot(1,'<pilot>',[{...combat,name:'<clone>'}])],chars=[{id:1,parent_id:1,name:'<pilot>'}];
 const html=cloneResults(rows,chars,clonePreferences({closed:['active:1']}),helpers,now);assert.match(html,/&lt;clone&gt;/);assert.doesNotMatch(html,/<clone>|<pilot>/);assert.match(html,/data-clone-open="active:1" >/);
 assert.match(cloneResults(rows,chars,clonePreferences({q:'Crystal'}),helpers,now),/data-clone-open="pilot:1:location:5" open/);
 assert.equal(clonePreferences(null).view,'character');assert.equal(clonePreferences({filter:'bad'}).filter,'all');
});
