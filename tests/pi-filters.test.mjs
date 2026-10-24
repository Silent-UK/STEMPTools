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
