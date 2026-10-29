import test from 'node:test';
import assert from 'node:assert/strict';
import {compareSkills,comparisonTable} from '../public/skill-compare.mjs';
const skill=(id,level)=>({skill_id:id,name:'Skill '+id,group:'Spaceship Command',trained_skill_level:level});
const pilot=(name,skills)=>({name,data:{skills:{skills}}});
test('comparison uses union of skills, hides only all-pilot matches, and distinguishes injected zero',()=>{
 const pilots=[pilot('Base',[skill(1,5),skill(2,3),skill(4,0)]),pilot('Alt',[skill(1,5),skill(2,4),skill(3,2)]),pilot('Other',[skill(1,5),skill(2,3)])];
 const rows=compareSkills(pilots);assert.equal(rows.length,4);assert.deepEqual(rows.filter(r=>r.matching).map(r=>r.id),[1]);assert.equal(rows.find(r=>r.id===3).cells[0].missing,true);
 const html=comparisonTable(pilots);assert(!html.includes('<strong>Skill 1</strong>'));assert(html.includes('+1 levels'));assert(html.includes('Not injected'));assert(html.includes('Level 0'));assert(html.includes('skill-matching'));assert(!html.includes('Baseline'));assert(comparisonTable(pilots,true).includes('<strong>Skill 1</strong>'));
});
test('unavailable snapshots never count as matching or missing skills, and names are escaped',()=>{
 const pilots=[pilot('<Base>',[skill(1,5)]),{name:'Unavailable',data:null}];
 assert.equal(compareSkills(pilots)[0].matching,false);const html=comparisonTable(pilots);assert(html.includes('Unavailable'));assert(!html.includes('>Not injected</td>'));assert(html.includes('&lt;Base&gt;'));assert(!html.includes('<Base>'));
});
