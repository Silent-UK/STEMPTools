import {test} from 'node:test';
import assert from 'node:assert/strict';
import {safetyTransfer,collectAssetSafety,safetyInventory,SAFETY_SCOPE} from '../lib/asset-safety.mjs';
import {assetSafetyView} from '../public/asset-safety-view.mjs';
const started=Date.UTC(2026,10,1),DAY=86400000;
const ticks=ms=>String((BigInt(ms)+11644473600000n)*10000n);
const notice={notification_id:1,type:'StructureItemsMovedToSafety',timestamp:new Date(started).toISOString(),text:`isCorpOwned: false\nstructureID: 1000000000001\nsolarsystemID: 30000001\nnewStationID: 60000001\nassetSafetyMinimumTimestamp: ${ticks(started+5*DAY)}\nassetSafetyFullTimestamp: ${ticks(started+20*DAY)}`};
test('safety transfer reads exact EVE FILETIME milestones and excludes corporation notices',()=>{
 const t=safetyTransfer(notice);assert.equal(t.minimum,started+5*DAY);assert.equal(t.full,started+20*DAY);assert.equal(t.structure_id,1000000000001);
 assert.equal(safetyTransfer({...notice,text:notice.text.replace('false','true')}),null);
 assert.equal(safetyTransfer({...notice,type:'StructureDestroyed'}),null);
 assert.equal(safetyTransfer({...notice,timestamp:'bad'}),null);
});
test('missing milestone fields use the notification date, never first observed date',()=>{
 const t=safetyTransfer({...notice,text:'isCorpOwned: false'});assert.equal(t.minimum,started+5*DAY);assert.equal(t.full,started+20*DAY);
});
test('notification collection merges history and retains dates during ESI errors',async()=>{
 const c={id:123,scopes:JSON.stringify([SAFETY_SCOPE])};let calls=0;
 const first=await collectAssetSafety(c,{get:async path=>{calls++;assert.equal(path,'/characters/123/notifications');return [notice,{...notice,notification_id:2,type:'Other'}];}},null,started);
 assert.equal(first.transfers.length,1);assert.equal(JSON.stringify(first).includes('text'),false);
 const second=await collectAssetSafety(c,{get:async()=>[]},{asset_safety:first},started+1000);assert.equal(second.transfers.length,1);
 const failed=await collectAssetSafety(c,{get:async()=>{throw Error('ESI unavailable');}},{asset_safety:first});assert.equal(failed.status,'unavailable');assert.deepEqual(failed.transfers,first.transfers);assert.equal(failed.updated,first.updated);
 const missing=await collectAssetSafety({...c,scopes:'[]'},{get:()=>{calls++;}},{asset_safety:first});assert.equal(missing.status,'scope_required');assert.equal(calls,1);
});
test('safety inventory follows wrappers without treating inaccessible structures as safety',()=>{
 const items=[{item_id:1,location_id:2004,location_flag:'AssetSafety'},{item_id:2,location_id:1},{item_id:3,location_id:2},{item_id:4,location_id:1000000000001},{item_id:5,location_id:6},{item_id:6,location_id:5}];
 assert.deepEqual(safetyInventory(items).map(a=>a.item_id),[1,2,3]);
});
test('safety view shows unknown dates honestly and does not claim delivery after deadline',()=>{
 const helpers={esc:s=>String(s).replaceAll('<','&lt;'),date:n=>new Date(n).toISOString(),num:String};
 const html=assetSafetyView([{name:'<pilot>',items:[],transfers:[{...safetyTransfer(notice),source:'Structure 1'}],status:'unavailable',updated:started}],helpers,started+30*DAY);
 assert.match(html,/&lt;pilot>/);assert.match(html,/Scheduled relocation date passed/);assert.match(html,/saved dates retained/);assert.doesNotMatch(html,/delivered successfully/);
});
