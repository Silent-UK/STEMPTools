import test from 'node:test';
import assert from 'node:assert/strict';
import {industryWithJobs} from '../public/industry-model.mjs';
test('all-character industry hides zero-job pilots without hiding pending and ready work',()=>{
 const rows=[{id:1,data:{jobs:[],blueprints:[{}]}},{id:2,data:null},{id:3,data:{jobs:[{status:'active'}]}},{id:4,data:{jobs:[{status:'ready'}]}},{id:5,data:{jobs:[{status:'paused'}]}}];
 assert.deepEqual(industryWithJobs(rows).map(row=>row.id),[3,4,5]);
});
