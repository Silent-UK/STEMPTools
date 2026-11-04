import test from 'node:test';
import assert from 'node:assert/strict';
import {piPlanetStatuses} from '../public/pi-view.mjs';
const now=Date.parse('2026-10-24T12:00:00Z'),settings={perfect:18000,critical:16000};
const ex=(rate,expires='2026-10-25T12:00:00Z')=>({kind:'Extractor',averagePerHour:rate,expires});
test('PI status thresholds use the configured extraction settings',()=>{
 assert.deepEqual(piPlanetStatuses({production:[ex(18000)]},settings,now),[]);
 assert.deepEqual(piPlanetStatuses({production:[ex(16000)]},settings,now),['attention']);
 assert.deepEqual(piPlanetStatuses({production:[ex(15999)]},settings,now),['critical']);
 assert.deepEqual(piPlanetStatuses({production:[ex(19000)]},{perfect:20000,critical:18000},now),['attention']);
});
test('stopped extractors override rate and mixed planets can match multiple toggles',()=>{
 assert.deepEqual(piPlanetStatuses({production:[ex(100,'2026-10-24T11:00:00Z'),ex(17000),ex(15000)]},settings,now),['stopped','attention','critical']);
});
test('factory and unknown extraction data are not falsely labelled stopped or critical',()=>{
 assert.deepEqual(piPlanetStatuses({production:[{kind:'Factory capacity',status:'Unknown'},ex(null),ex(0,null)]},settings,now),[]);
});
import {piStorageAttention,piViewPreferences,piSearchText,piMatches,piSnapshotNotice,piSettingsView} from '../public/pi-view.mjs';
test('Storage Attention includes any known launchpad at 75 percent, without assuming unknown storage is empty or full',()=>{
 const pad=used=>({kind:'Launchpad',usage:{used,capacity:10000}});
 assert.equal(piStorageAttention({launchpads:[pad(7499)]}),false);assert.equal(piStorageAttention({launchpads:[pad(7500)]}),true);assert.equal(piStorageAttention({storage:[pad(0),pad(10000)]}),true);
 assert.equal(piStorageAttention({launchpads:[pad(null),{usage:{used:9999,capacity:null}}]}),false);
 assert.deepEqual(piPlanetStatuses({production:[],launchpads:[pad(8000)]},settings,now),['storage']);
});
test('PI search covers pilots, systems, planets and products and combines with selected status union',()=>{
 const text=piSearchText({systemName:'Jita',info:{name:'Jita IV'},production:[{name:'Noble Metals'}],finalProducts:[{name:'Mechanical Parts'}],storage:[{contents:[{name:'Robotics'}]}]},'Pilot One');
 for(const q of ['pilot one','JITA','jita iv','mechanical','robotics','noble'])assert.equal(piMatches(text,['storage'],piViewPreferences({q,statuses:['critical','storage']})),true);
 assert.equal(piMatches(text,[],piViewPreferences({q:'jita',statuses:['storage']})),false);assert.equal(piMatches(text,['storage'],piViewPreferences({q:'amarr'})),false);
 assert.deepEqual(piViewPreferences({q:3,statuses:['storage','invalid','storage'],alts:true}),{q:'',statuses:['storage'],alts:true});
});
test('PI snapshot warnings distinguish missing, old and failed refreshes, escaping labels and keeping fresh data clearly saved',()=>{
 assert.match(piSnapshotNotice({updated:now-7200001},now),/over 2 hours old/);assert.match(piSnapshotNotice({updated:now,error:'Failed'},now),/refresh failed/);assert.match(piSnapshotNotice({},now),/not yet synced/);assert.doesNotMatch(piSnapshotNotice({updated:now},now),/pi-snapshot-warning/);
 const html=piSettingsView({settings:{perfect:18000,critical:16000,targets:[],show_goals:false},products:[]});assert.match(html,/name="show_goals"/);assert.doesNotMatch(html,/name="show_goals" checked/);assert.match(html,/keeps your selected products/);
});
