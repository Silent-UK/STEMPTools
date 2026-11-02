import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openStore} from '../lib/store.mjs';
import {recruitmentStore,recruitmentConfig,validateRecruitmentConfig} from '../lib/recruitment-store.mjs';
import {blacklistEntries,blacklistService} from '../lib/recruit-blacklist.mjs';
import {alignment,pilotFindings,pilotCapabilities,pilotCheckService} from '../lib/pilot-check.mjs';
import {combatSummary,pilotCombatService} from '../lib/pilot-combat.mjs';
import {recruitmentUI} from '../public/recruitment-view.mjs';
async function store(fn){const dir=mkdtempSync(join(tmpdir(),'tools-recruit-')),db=openStore(dir);recruitmentStore(db);db.prepare("INSERT INTO users VALUES(1,100,'Pilot',0)").run();db.prepare("INSERT INTO characters VALUES(100,1,'Pilot','owner','tokens','[]',0,0)").run();try{return await fn(db);}finally{db.close();rmSync(dir,{recursive:true,force:true});}}
const config={sheet:'valid_sheet',gid:'0',friendly:{pilot:[],corporation:[10],alliance:[]},hostile:{pilot:[],corporation:[],alliance:[99]}};
test('alignment references validate, hostile overrides friendly affiliation, and failed lookups stay unknown',()=>{
 assert.deepEqual(validateRecruitmentConfig(config),config);
 assert.throws(()=>validateRecruitmentConfig({...config,hostile:{...config.hostile,corporation:[10]}}));
 assert.equal(alignment({kind:'pilot',id:200},config,{200:{corporation_id:10,alliance_id:99,verified:true}}),'hostile');
 assert.equal(alignment({kind:'pilot',id:200},config,{200:{corporation_id:20,verified:true}}),'neutral');
 assert.equal(alignment({kind:'pilot',id:200},config,{200:{verified:false}}),'unknown');
 assert.equal(alignment({kind:'alliance',id:300},config,{}),'unknown');
});
test('pilot findings exclude public contracts, incoming mail, stale events and own linked ISK transfers',()=>{
 const now=Date.parse('2026-11-02T12:00:00Z'),date='2026-11-01T00:00:00Z',owned=[{id:100,name:'Pilot'},{id:101,name:'Alt'}],resolved={200:{isPilot:true,corporation_id:20,alliance_id:99,verified:true},201:{isPilot:false},300:{isPilot:true}};
 const findings=pilotFindings({character:owned[0],owned,config,resolved,now,blacklist:[{name_key:'alt',name:'Alt',reason:'Reason'}],mail:[{mail_id:1,from:100,timestamp:date,recipients:[{recipient_type:'character',recipient_id:200}]},{mail_id:2,from:200,timestamp:date,recipients:[{recipient_type:'character',recipient_id:100}]}],contracts:[{contract_id:1,availability:'public',issuer_id:100,assignee_id:0,acceptor_id:300,date_issued:date},{contract_id:2,availability:'private',issuer_id:100,assignee_id:200,date_issued:date},{contract_id:3,availability:'private',issuer_id:300,assignee_id:100,date_issued:date},{contract_id:4,availability:'private',issuer_id:100,assignee_id:201,date_issued:date}],wallet:[{id:1,date,ref_type:'player_donation',first_party_id:100,second_party_id:101,amount:-1},{id:2,date,ref_type:'player_donation',first_party_id:200,second_party_id:100,amount:20},{id:3,date:'2026-01-01',ref_type:'player_donation',first_party_id:100,second_party_id:200,amount:-10}],contacts:[{contact_id:200,contact_type:'character',standing:5},{contact_id:300,contact_type:'character',standing:5},{contact_id:200,contact_type:'character',standing:-5}]});
 assert.equal(findings.blacklisted[0].pilot,'Alt');assert.equal(findings.mail.length,1);assert.equal(findings.mail[0].alignment,'hostile');assert.deepEqual(findings.contracts.map(c=>c.id),[2,3]);assert.equal(findings.wallet.length,1);assert.equal(findings.wallet[0].direction,'Received');assert.equal(findings.standings.length,1);
});
test('ship capabilities require recursive active skills and do not claim missing SDE evidence',()=>{
 const types={10:{category_id:16,attributes:{182:11,277:4}},11:{category_id:16,attributes:{}},12:{category_id:16,attributes:{}},20:{name:'Ship',attributes:{182:10,277:5}},21:{name:'Prospect',attributes:{182:10,277:5}},22:{name:'Covert Cyno',attributes:{182:12,277:5,1299:830}}};
 const cat={type:id=>types[id],ships:group=>[541,830].includes(group)?[{id:20,name:'Ship'}]:[],named:name=>name==='Prospect'?21:22};
 const skills={skills:{skills:[{skill_id:10,active_skill_level:5},{skill_id:11,active_skill_level:4},{skill_id:12,active_skill_level:5}]}};
 assert.equal(pilotCapabilities(skills,cat).capabilities.find(c=>c.name==='Covert Cyno').available,true);
 skills.skills.skills[1].active_skill_level=3;assert.equal(pilotCapabilities(skills,cat).capabilities[0].available,false);assert.equal(pilotCapabilities(null,cat).available,false);
});
test('blacklist parser skips headers and matches complete names in A/F/G/H with reasons',()=>{
 const entries=blacklistEntries('Pilot,B,C,Reason,E,Alt,F,G\n"Main With Spaces",,,Reason,,"Alt One; Alt Two",~,\n');
 assert.deepEqual(entries.map(e=>e.name),['Main With Spaces','Alt One','Alt Two']);assert.equal(entries[1].reason,'Reason');assert.deepEqual(entries[1].columns,['F']);assert.throws(()=>blacklistEntries('<html>Access denied</html>'));
});
test('weekly blacklist sync is independent, throttled and atomic on upstream failure',()=>store(async db=>{
 let fail=false,calls=0;const service=blacklistService(db,{network:async url=>{calls++;return fail?new Response('down',{status:503}):url.includes('docs.google.com')?new Response('Pilot,B,C,Reason,E,F,G,H\nPilot,,,Reason,,,,'):Response.json({characters:[{id:100,name:'Pilot'}]});}});
 await service.sync();assert.equal(service.status().count,1);assert.equal(db.prepare('SELECT character_id FROM recruitment_blacklist').get().character_id,100);
 const before=calls;await service.sync();assert.equal(calls,before);
 fail=true;await service.sync(true);assert.equal(service.status().count,1);assert.ok(service.status().error);assert.ok(recruitmentConfig(db).sheet);
}));
test('pilot-check jobs complete with explicit missing scopes and preserve isolation',()=>store(async db=>{
 const service=pilotCheckService(db,{request:async()=>{throw Error('Must not fetch without a scope');}},{});
 const c={id:100,user_id:1,name:'Pilot'};service.view(c);
 for(let i=0;i<4;i++){db.prepare('UPDATE recruitment_check_jobs SET next_due=0').run();await service.tick();}
 const result=service.view(c);assert.equal(result.job,null);assert.equal(result.data.capabilities.available,false);assert.equal(result.data.blacklist.updated,0);assert.ok(result.data.coverage.some(c=>c.section==='Mail'&&c.status==='Missing scope'));
}));
test('combat summary counts participation, losses and UTC windows without duplicate killmails',()=>{
 const kill={killmail_id:1,killmail_time:'2026-11-01T00:00:00Z',solar_system_id:300,victim:{character_id:200,ship_type_id:20,corporation_id:500,alliance_id:600},attackers:[{character_id:100,ship_type_id:30}]},loss={...kill,killmail_id:2,victim:{character_id:100,ship_type_id:40}};
 const result=combatSummary(100,[kill,kill,loss],{300:'System',500:'Corp',600:'Alliance'},null,Date.parse('2026-11-02T00:00:00Z'));
 assert.deepEqual(result.windows.year,{kills:1,losses:1});assert.equal(result.windows.days7.kills,1);assert.equal(result.targets.length,2);assert.equal(result.areas[0].name,'System');assert.equal(result.ships.find(s=>s.id===40).losses,1);
});
test('rolling combat windows include December without counting it as a new-year kill',()=>{
 const row={killmail_id:1,killmail_time:'2026-12-31T00:00:00Z',solar_system_id:300,victim:{character_id:200},attackers:[{character_id:100}]};
 const result=combatSummary(100,[row],{},null,Date.parse('2027-01-02T00:00:00Z'));assert.equal(result.windows.year.kills,0);assert.equal(result.windows.days30.kills,1);assert.equal(result.windows.days7.kills,1);
});
test('recruitment review renders escaped findings and makes missing coverage explicit',async()=>{
 const previous=globalThis.document;globalThis.document={addEventListener(){}};
 const esc=value=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
 try{
  const data={coverage:[],blacklisted:[],alignment_configured:false,capabilities:{available:false,reason:'Not synced'},names:{},mail:[{date:1,id:200,alignment:'unknown',subject:'<script>bad</script>'}],contracts:[],wallet:[],standings:[]};
  const view=recruitmentUI({api:async()=>({data,updated:1}),esc,intro:title=>title,table:(head,rows)=>rows.join(''),num:String,date:String,context:()=>({me:{main_id:100,inspect:{name:'Pilot'}},chars:[{id:100,name:'Pilot'}]}),refresh(){},toast(){}});
  const html=await view.render('inspect-pilot-check');assert.match(html,/Blacklist has not synced/);assert.match(html,/friendly references are not configured/);assert.match(html,/&lt;script&gt;/);assert.doesNotMatch(html,/<script>/);
 }finally{if(previous===undefined)delete globalThis.document;else globalThis.document=previous;}
});
test('combat worker resumes pages and ESI references, publishing only a complete year',()=>store(async db=>{
 const now=new Date(),date=now.toISOString(),month=now.getUTCMonth()+1;let detailCalls=0;
 const kill={killmail_id:1,killmail_time:date,solar_system_id:300,victim:{character_id:200,ship_type_id:20,corporation_id:500},attackers:[{character_id:100,ship_type_id:30}]};
 const network=async url=>{if(url.includes('/killmails/')){detailCalls++;return Response.json({...kill,killmail_id:2});}return Response.json(url.includes('/month/'+month+'/')?[kill,{killmail_id:2,zkb:{hash:'abcdef'}}]:[]);};
 const eve={request:async()=>({data:[{id:300,name:'System'},{id:500,name:'Corp'}]})},cat={type:id=>({name:'Type '+id})};let service=pilotCombatService(db,eve,cat,{network});service.view({id:100});
 for(let i=0;i<100&&db.prepare('SELECT 1 FROM recruitment_combat_jobs').get();i++){db.prepare('UPDATE recruitment_combat_jobs SET next_due=0').run();if(i===3)service=pilotCombatService(db,eve,cat,{network});await service.tick();}
 const result=service.view({id:100});assert.equal(result.job,null);assert.equal(detailCalls,1);assert.equal(result.data.windows.year.kills,2);assert.equal(db.prepare('SELECT count(*) n FROM recruitment_combat_stage').get().n,0);
 const bad=pilotCombatService(db,eve,cat,{network:async()=>new Response('down',{status:503})});bad.view({id:100},true);await bad.tick();const retained=bad.view({id:100});assert.equal(retained.data.windows.year.kills,2);assert.equal(retained.job.status,'retrying');
}));
