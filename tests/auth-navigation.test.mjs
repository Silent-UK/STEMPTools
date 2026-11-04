import test from 'node:test';
import assert from 'node:assert/strict';
import {recruitSignup} from '../public/auth-navigation.mjs';
test('Recruit Apply cancels native submission and navigates to consented EVE signup',()=>{
 let prevented=0,target=null;const event={preventDefault(){prevented++;},target:{id:'recruit-signup-form',reportValidity:()=>true,elements:{namedItem:()=>({checked:true})}}};
 assert.equal(recruitSignup(event,url=>target=url),true);assert.equal(prevented,1);assert.equal(target,'/auth/login?recruit=1&consent=1');
});
test('Recruit Apply never starts SSO without valid explicit consent',()=>{
 for(const [valid,checked] of [[true,false],[false,true],[false,false],[true,undefined]]){
 let navigated=false,prevented=false;recruitSignup({preventDefault(){prevented=true;},target:{id:'recruit-signup-form',reportValidity:()=>valid,elements:{namedItem:()=>({checked})}}},()=>navigated=true);assert.equal(navigated,false);assert.equal(prevented,true);
 }
});
test('Recruit navigation leaves unrelated forms alone',()=>{assert.equal(recruitSignup({target:{id:'other'},preventDefault(){throw Error('Unexpected interception');}},()=>{throw Error('Unexpected navigation');}),false);});
