import test from 'node:test';
import assert from 'node:assert/strict';
import {accessChanged,managementNavigation} from '../public/access-state.mjs';
test('promotion exposes Groups to normal members without granting admin access',()=>{
 const recruit={main_id:100,recruit:true,admin:false},member={...recruit,recruit:false};
 assert.equal(managementNavigation(recruit).some(([id])=>id==='groups'),false);assert.equal(accessChanged(recruit,member),true);assert.equal(managementNavigation(member).some(([id])=>id==='groups'),true);assert.equal(member.admin,false);
 assert.equal(managementNavigation({...member,inspect:{recruitment_only:true}}).some(([id])=>id==='groups'),false);
});
test('ordinary snapshot/preferences updates do not replace the workspace, but access and inspection changes do',()=>{
 const member={main_id:100,recruit:false,admin:false,corporate_pages:['wallet','assets'],pages:[]};
 assert.equal(accessChanged(member,{...member,preferences:{theme:'oled'},corporate_pages:['assets','wallet']}),false);
 assert.equal(accessChanged(member,{...member,recruit:true}),true);assert.equal(accessChanged(member,{...member,admin:true}),true);assert.equal(accessChanged(member,{...member,inspect:{name:'Other pilot',recruitment_only:true}}),true);
});
