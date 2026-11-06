import test from 'node:test';
import assert from 'node:assert/strict';
import {createEsiTrace} from '../lib/esi-trace.mjs';
test('ESI tracing records trigger headers and prior endpoint failures without secrets or payloads',async()=>{
 let at=100000;const events=[],trace=createEsiTrace({now:()=>at,write:e=>events.push(e)}),options={method:'POST',headers:{Authorization:'Bearer TOKEN_SECRET'},body:'BODY_SECRET'};
 const first=await trace.request(async()=>{at+=50;return new Response('RESPONSE_SECRET',{status:403});},'https://esi.evetech.net/universe/structures/123?token=QUERY_SECRET',options,{source:'character',character_id:42});
 assert.equal(await first.text(),'RESPONSE_SECRET');assert.equal(events[0].location_id,123);
 await trace.request(async()=>new Response('{}',{headers:{'x-esi-error-limit-remain':'9','x-esi-error-limit-reset':'60','x-esi-request-id':'abc-123'}}),'https://esi.evetech.net/characters/42/skills',{}, {source:'character',character_id:42});
 const trigger=events.find(e=>e.event==='cooldown_trigger'),summary=events.find(e=>e.event==='summary');assert.equal(trigger.status,200);assert.equal(trigger.headers['x-esi-error-limit-remain'],'9');assert.equal(trigger.request_id,'abc-123');assert.equal(summary.endpoints[0].statuses[403],1);assert.equal(summary.endpoints[0].endpoint,'/universe/structures/:id');assert.equal(summary.endpoints[0].total_ms,50);
 const text=JSON.stringify(events);for(const secret of ['TOKEN_SECRET','BODY_SECRET','RESPONSE_SECRET','QUERY_SECRET'])assert.ok(!text.includes(secret));
});
test('timeouts preserve original errors, local skips are summarised and tracing can be disabled',async()=>{
 const events=[],trace=createEsiTrace({write:e=>events.push(e)}),error=Object.assign(Error('SECRET_EXCEPTION'),{name:'TimeoutError'});
 await assert.rejects(trace.request(async()=>{throw error;},'https://esi.evetech.net/markets/prices'),e=>e===error);assert.equal(events[0].error,'TimeoutError');assert.ok(!JSON.stringify(events).includes('SECRET_EXCEPTION'));
 trace.cooldown('character','/skills/1',Date.now()+60000);trace.cooldown('character','/skills/1',Date.now()+60000);assert.equal(events.filter(e=>e.event==='cooldown_skip').length,1);
 const disabled=createEsiTrace({enabled:false,write:()=>{throw Error('must not log');}});assert.equal((await disabled.request(async()=>new Response('ok'),'https://esi.evetech.net/status')).status,200);
});
test('activity summaries include cache hits and bounded detailed error events',async()=>{
 let at=100000;const events=[],trace=createEsiTrace({write:e=>events.push(e),now:()=>at});trace.cache('public','/markets/prices?token=SECRET');
 for(let i=0;i<205;i++)await trace.request(async()=>new Response('',{status:404}),'https://esi.evetech.net/universe/structures/'+i);
 assert.equal(events.filter(e=>e.event==='request_failure').length,200);at+=60001;trace.cache('public','/status');const summary=events.find(e=>e.event==='summary');assert.equal(summary.endpoints.find(e=>e.endpoint==='/markets/prices').cache_hits,1);assert.equal(summary.endpoints.find(e=>e.endpoint==='/universe/structures/:id').requests,205);
});
test('a diagnostic logger failure cannot break ESI requests',async()=>{
 const trace=createEsiTrace({write:()=>{throw Error('journal failed');}});const response=await trace.request(async()=>new Response('',{status:429}),'https://esi.evetech.net/status');assert.equal(response.status,429);
});
