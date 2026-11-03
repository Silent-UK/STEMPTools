import test from 'node:test';
import assert from 'node:assert/strict';
import {queuedDuration} from '../public/view-models.mjs';
test('queue time uses the final finish including current training, without summing end dates',()=>{
 const now=Date.parse('2026-11-03T12:00:00Z'),minutes=83*1440+9*60+23,end=new Date(now+minutes*60000).toISOString();
 assert.equal(queuedDuration([{finish_date:end},{finish_date:new Date(now+60000).toISOString()}],now),'83d 9h 23m Queued');
 assert.equal(queuedDuration([],now),'0d 0h 0m Queued');assert.equal(queuedDuration([{finish_date:new Date(now-1000).toISOString()}],now),'0d 0h 0m Queued');
 assert.equal(queuedDuration([{finish_date:null}],now),'Queue duration unavailable');
});
