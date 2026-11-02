import {requirements,expandPlan} from './plans.mjs';
import {pilotKey} from './recruit-blacklist.mjs';
import {recruitmentConfig} from './recruitment-store.mjs';
const DAY=86400000;
const contractDate=c=>c.date_completed||c.date_accepted||c.date_issued;
export function alignment(entity,config,resolved={}){
 const refs=[[entity.kind,entity.id]],p=entity.kind==='pilot'?resolved[entity.id]:null;
 if(p?.corporation_id)refs.push(['corporation',p.corporation_id]);if(p?.alliance_id)refs.push(['alliance',p.alliance_id]);
 if(entity.kind==='corporation'&&resolved['corp:'+entity.id]?.alliance_id)refs.push(['alliance',resolved['corp:'+entity.id].alliance_id]);
 for(const side of ['hostile','friendly'])if(refs.some(([kind,id])=>config[side]?.[kind]?.includes(id)))return side;
 const configured=Object.values(config.friendly||{}).some(ids=>ids.length);
 return configured&&((entity.kind==='alliance'&&resolved['alliance:'+entity.id]?.verified)||p?.verified||resolved['corp:'+entity.id]?.verified)?'neutral':'unknown';
}
export function pilotCapabilities(skillData,cat){
 if(!skillData?.skills?.skills)return {available:false,reason:'Skills have not synced.'};
 const levels=new Map(skillData.skills.skills.map(s=>[s.skill_id,s.active_skill_level??s.trained_skill_level??0]));
 function qualified(id){try{const needed=expandPlan(requirements(id,cat),cat);return needed.length>0&&needed.every(r=>(levels.get(r.id)||0)>=r.level);}catch{return null;}}
 const groups=[['Interdictors',541],['Heavy Interdictors',894],['Covert Ops',830]];
 const capabilities=groups.map(([name,group])=>{const ships=(cat.ships?.(group)||[]).map(ship=>({...ship,qualified:qualified(ship.id)}));return {name,available:ships.some(s=>s.qualified===true)?true:ships.length&&ships.every(s=>s.qualified===false)?false:null,ships:ships.filter(s=>s.qualified).map(s=>s.name)};});
 const prospect=cat.named?.('Prospect');capabilities.push({name:'Prospect',available:prospect?qualified(prospect):null,ships:[]});
 const cyno=cat.named?.('Covert Cynosural Field Generator I'),attrs=cyno?cat.type(cyno)?.attributes:null;
 const eligibleHulls=new Map();
 if(attrs){for(const a of [1298,1299,1300,1301,1872,1879])if(attrs[a]&&Number(attrs[a])!==963)for(const ship of cat.ships?.(Number(attrs[a]))||[])eligibleHulls.set(ship.id,ship);for(const a of [1302,1303,1304])if(attrs[a]){const ship=cat.type(Number(attrs[a]));if(ship)eligibleHulls.set(Number(attrs[a]),{id:Number(attrs[a]),name:ship.name});}}
 const cynoHulls=[...eligibleHulls.values()].filter(ship=>qualified(ship.id)===true);
 const cynoQualified=cyno?qualified(cyno):null;capabilities.push({name:'Covert Cyno',available:cynoQualified!==true?cynoQualified:cynoHulls.length?true:null,ships:cynoHulls.map(ship=>ship.name)});
 return {available:true,capabilities,note:'Based on active skill levels and recursive SDE prerequisites. Covert cyno qualification checks module skills and known SDE-compatible hull skills, excluding unverified strategic-cruiser subsystem configurations. Actual fitting, fuel and hull ownership are not checked.'};
}
export function pilotFindings({character,owned,mail=[],contacts=[],contracts=[],wallet=[],blacklist=[],config,resolved={},now=Date.now()}){
 const ids=new Set(owned.map(c=>c.id)),since=now-30*DAY,recent=v=>Number.isFinite(Date.parse(v))&&Date.parse(v)>=since&&Date.parse(v)<=now;
 const blacklisted=owned.flatMap(c=>blacklist.filter(b=>b.character_id===c.id||b.name_key===pilotKey(c.name)).map(b=>({pilot:c.name,id:c.id,name:b.name,reason:b.reason})));
 const mails=mail.filter(m=>ids.has(m.from)&&recent(m.timestamp)).flatMap(m=>(m.recipients||[]).filter(r=>r.recipient_type!=='mailing_list'&&!ids.has(r.recipient_id)).map(r=>{const entity={id:r.recipient_id,kind:r.recipient_type==='character'?'pilot':r.recipient_type};return {mail_id:m.mail_id,subject:m.subject,date:m.timestamp,...entity,alignment:alignment(entity,config,resolved)};})).filter(m=>m.alignment!=='friendly');
 const direct=contracts.filter(c=>c.availability==='private'&&!c.for_corporation&&!c.issuer_corporation&&c.issuer_id&&c.assignee_id>0&&recent(contractDate(c))).flatMap(c=>{
  let other,direction;if(ids.has(c.issuer_id)&&!c.issuer_is_corporation){other=c.assignee_id;direction='Sent';}else if(ids.has(c.assignee_id)){other=c.issuer_id;direction='Received';}else return [];
  if(ids.has(other)||resolved[other]?.isPilot!==true)return [];
  return [{id:c.contract_id,other,direction,date:contractDate(c),status:c.status,title:c.title||c.type}];
 });
 const transfers=wallet.filter(w=>w.ref_type==='player_donation'&&recent(w.date)).flatMap(w=>{
  const first=ids.has(w.first_party_id),second=ids.has(w.second_party_id);if(first===second)return [];
  return [{id:w.id,date:w.date,other:first?w.second_party_id:w.first_party_id,direction:first?'Sent':'Received',amount:Math.abs(Number(w.amount)||0),description:w.description}];
 });
 const standings=contacts.filter(c=>c.standing>0).map(c=>({...c,alignment:alignment({kind:c.contact_type==='character'?'pilot':c.contact_type,id:c.contact_id},config,resolved)})).filter(c=>c.alignment==='hostile');
 return {character:{id:character.id,name:character.name},since,blacklisted,mail:mails,contracts:direct,wallet:transfers,standings,unknown_standings:contacts.filter(c=>c.standing>0&&alignment({kind:c.contact_type==='character'?'pilot':c.contact_type,id:c.contact_id},config,resolved)==='unknown').length,unknown_contract_parties:contracts.filter(c=>c.availability==='private'&&recent(contractDate(c))&&!resolved[ids.has(c.issuer_id)?c.assignee_id:c.issuer_id]?.isPilot).length};
}
export function pilotCheckService(db,eve,cat){
 db.exec(`CREATE TABLE IF NOT EXISTS recruitment_check_jobs(character_id INTEGER PRIMARY KEY REFERENCES characters(id) ON DELETE CASCADE,state TEXT NOT NULL,next_due INTEGER NOT NULL,updated INTEGER NOT NULL,error TEXT);CREATE TABLE IF NOT EXISTS recruitment_checks(character_id INTEGER PRIMARY KEY REFERENCES characters(id) ON DELETE CASCADE,data TEXT NOT NULL,updated INTEGER NOT NULL);`);
 let busy=false;
 function view(c,refresh=false){
  const saved=db.prepare('SELECT * FROM recruitment_checks WHERE character_id=?').get(c.id);
  if((refresh||!saved||saved.updated<Date.now()-6*3600000)&&!db.prepare('SELECT 1 FROM recruitment_check_jobs WHERE character_id=?').get(c.id))db.prepare('INSERT INTO recruitment_check_jobs VALUES(?,?,0,?,NULL)').run(c.id,JSON.stringify({phase:'mail',mail:[],contacts:[],coverage:[],page:1}),Date.now());
  return {data:saved?JSON.parse(saved.data):null,updated:saved?.updated||null,job:db.prepare("SELECT updated,error,json_extract(state,'$.phase') phase,json_extract(state,'$.index') progress,json_array_length(state,'$.entities') total FROM recruitment_check_jobs WHERE character_id=?").get(c.id)||null};
 }
 async function tick(){
  if(busy)return;const job=db.prepare('SELECT j.*,c.user_id,c.name,c.scopes,c.tokens,c.owner_hash,c.expires,c.reconnect FROM recruitment_check_jobs j JOIN characters c ON c.id=j.character_id WHERE j.next_due<=? ORDER BY j.updated LIMIT 1').get(Date.now());if(!job)return;
  busy=true;const s=JSON.parse(job.state),c={...job,id:job.character_id};
  function save(){if(!db.prepare('SELECT 1 FROM characters WHERE id=? AND user_id=? AND owner_hash=?').get(c.id,c.user_id,c.owner_hash))throw Error('Account changed during check.');db.prepare('UPDATE recruitment_check_jobs SET state=?,next_due=?,updated=?,error=NULL WHERE character_id=?').run(JSON.stringify(s),Date.now()+1500,Date.now(),c.id);}
  try{
   if(s.phase==='mail'){
    if(!JSON.parse(c.scopes).includes('esi-mail.read_mail.v1'))s.coverage.push({section:'Mail',status:'Missing scope'});
    else{const r=await eve.request('/characters/'+c.id+'/mail/'+(s.before?'?last_mail_id='+s.before:''),c);if(!Array.isArray(r.data)||r.data.some(m=>!Number.isSafeInteger(m.mail_id)||!Number.isSafeInteger(m.from)||!Number.isFinite(Date.parse(m.timestamp))||!Array.isArray(m.recipients)))throw Error('Invalid mail response.');s.mail.push(...r.data);const oldest=r.data.at(-1);if(r.data.length>=50&&oldest&&Date.parse(oldest.timestamp)>Date.now()-30*DAY&&s.page<10){s.before=oldest.mail_id;s.page++;save();return;}s.coverage.push({section:'Mail',status:r.data.length>=50&&s.page>=10?'Limited to 500 recent headers':'Recent headers collected'});}
    s.phase='contacts';s.page=1;save();return;
   }
   if(s.phase==='contacts'){
    if(!JSON.parse(c.scopes).includes('esi-characters.read_contacts.v1'))s.coverage.push({section:'Contact standings',status:'Missing scope'});
    else{const r=await eve.request('/characters/'+c.id+'/contacts/?page='+s.page,c);if(!Array.isArray(r.data)||r.data.some(c=>!Number.isSafeInteger(c.contact_id)||!Number.isFinite(c.standing))||!Number.isInteger(r.pages)||r.pages<1)throw Error('Invalid contacts response.');s.contacts.push(...r.data);if(s.page<r.pages&&s.page<10){s.page++;save();return;}s.coverage.push({section:'Contact standings',status:r.pages>10?'Limited to 10 pages':'Collected'});}
    const rows=db.prepare('SELECT kind,data,updated FROM snapshots WHERE character_id=? AND kind IN (\'skills\',\'contracts\',\'wallet-history\')').all(c.id);s.snapshots=Object.fromEntries(rows.map(r=>[r.kind,{data:JSON.parse(r.data),updated:r.updated}]));
    for(const kind of ['skills','contracts','wallet-history']){const snap=s.snapshots[kind],error=db.prepare('SELECT message FROM sync_errors WHERE character_id=? AND kind=?').get(c.id,kind);s.coverage.push({section:kind,status:!snap?'Not synced':error?'Latest sync failed; saved data shown':snap.updated<Date.now()-DAY?'Stale snapshot':'Saved snapshot',updated:snap?.updated||null});}
    const references=new Map();const add=(kind,id)=>{if(Number.isSafeInteger(id)&&id>0)references.set(kind+':'+id,{kind,id});};
    for(const m of s.mail)if(m.from===c.id&&Date.parse(m.timestamp)>=Date.now()-30*DAY)for(const r of m.recipients||[])if(r.recipient_type!=='mailing_list')add(r.recipient_type==='character'?'pilot':r.recipient_type,r.recipient_id);
    for(const contact of s.contacts)if(contact.standing>0)add(contact.contact_type==='character'?'pilot':contact.contact_type,contact.contact_id);
    for(const contract of s.snapshots.contracts?.data.contracts||[])if(contract.availability==='private'&&Date.parse(contractDate(contract))>=Date.now()-30*DAY){add('pilot',contract.issuer_id);add('pilot',contract.assignee_id);}
    for(const w of s.snapshots['wallet-history']?.data.journal||[])if(w.ref_type==='player_donation'&&Date.parse(w.date)>=Date.now()-30*DAY){add('pilot',w.first_party_id);add('pilot',w.second_party_id);}
    s.entities=[...references.values()];s.resolved={};s.index=0;s.phase='entities';save();return;
   }
   if(s.phase==='entities'&&s.index<s.entities.length){
    const e=s.entities[s.index];
    try{if(e.kind==='pilot'){const pilot=await eve.publicGet('/characters/'+e.id);const corp=await eve.publicGet('/corporations/'+pilot.corporation_id);s.resolved[e.id]={name:pilot.name,corporation_id:pilot.corporation_id,alliance_id:corp.alliance_id||null,isPilot:true,verified:true};}else if(e.kind==='corporation'){const corp=await eve.publicGet('/corporations/'+e.id);s.resolved['corp:'+e.id]={name:corp.name,alliance_id:corp.alliance_id||null,verified:true};}else if(e.kind==='alliance'){const alliance=await eve.publicGet('/alliances/'+e.id);s.resolved['alliance:'+e.id]={name:alliance.name,verified:true};}}
    catch{s.resolved[e.kind==='pilot'?e.id:e.kind+':'+e.id]={verified:false};}
    s.index++;save();return;
   }
   const owned=db.prepare('SELECT id,name FROM characters WHERE user_id=?').all(c.user_id),findings=pilotFindings({character:c,owned,mail:s.mail,contacts:s.contacts,contracts:s.snapshots.contracts?.data.contracts||[],wallet:s.snapshots['wallet-history']?.data.journal||[],blacklist:db.prepare('SELECT * FROM recruitment_blacklist').all(),config:recruitmentConfig(db),resolved:s.resolved});
   const data={...findings,capabilities:pilotCapabilities(s.snapshots.skills?.data,cat),coverage:s.coverage,names:s.resolved,alignment_configured:Object.values(recruitmentConfig(db).friendly).some(ids=>ids.length),blacklist:db.prepare('SELECT updated,error FROM recruitment_blacklist_sync WHERE id=1').get()};
   if(!db.prepare('SELECT 1 FROM characters WHERE id=? AND user_id=? AND owner_hash=?').get(c.id,c.user_id,c.owner_hash))throw Error('Account changed during check.');
   db.prepare('INSERT INTO recruitment_checks VALUES(?,?,?) ON CONFLICT(character_id) DO UPDATE SET data=excluded.data,updated=excluded.updated').run(c.id,JSON.stringify(data),Date.now());db.prepare('DELETE FROM recruitment_check_jobs WHERE character_id=?').run(c.id);
  }catch(e){db.prepare('UPDATE recruitment_check_jobs SET error=?,next_due=?,updated=? WHERE character_id=?').run(String(e.message).slice(0,250),Date.now()+60000,Date.now(),c.id);}finally{busy=false;}
 }
 return {view,tick};
}
