import {recruitAccount} from './recruitment-store.mjs';
import {recruitLinksHidden} from './recruitment-store.mjs';
import {parseBountyReason,RATTING_TYPES} from '../public/ratting-model.mjs';
import {adminNav,FONT_SIZES} from '../public/settings-options.mjs';
import {allowedGroupIcon} from '../public/group-icons.mjs';
import {notificationIdentity} from './notification-identity.mjs';
import {personalAlerts} from '../public/personal-alerts.mjs';
import {THEMES} from '../public/themes.mjs';
import {isSiteAdmin} from './admin.mjs';
import {denAlerts} from '../public/den-model.mjs';
import {STEMP_ID} from './corp.mjs';
import {OPTIONAL_PAGES,CORPORATE_PAGES,MANAGEMENT_PAGES,CORPORATE_VISIBILITY_PAGES,preferences,groupList,grants,eligible,rattingSummary} from './management.mjs';
const bad=message=>Object.assign(Error(message),{status:400});
export function managementRoutes(app,{db,eve,corp,cat,config,whitelist,discord,groupEnrolment}){
 const admin=(req,res,next)=>isSiteAdmin(req.session,config.owner)?next():res.sendStatus(403);
 const text=(v,max)=>String(v||'').trim().slice(0,max);
 app.get('/api/settings',async(req,res)=>{const available=isSiteAdmin(req.session,config.owner)||await corp.access(req.session.user_id)?Object.keys(CORPORATE_PAGES):grants(db,req.session.user_id);res.json({pages:OPTIONAL_PAGES,admin_pages:isSiteAdmin(req.session,config.owner)?Object.fromEntries(adminNav.slice(2).map(([id,,name])=>[id,name])):{},corporate_pages:Object.fromEntries(Object.entries(CORPORATE_VISIBILITY_PAGES).filter(([id])=>available.includes(id))),preferences:preferences(db,req.session.user_id)});});
 app.post('/api/settings',(req,res)=>{
  const p=req.body;
  if(!p||Array.isArray(p)||typeof p!=='object'||Object.keys(p).some(k=>k==='theme'?(typeof p[k]!=='string'||!Object.hasOwn(THEMES,p[k])):k==='font_size'?(typeof p[k]!=='string'||!Object.hasOwn(FONT_SIZES,p[k])):k==='sidebar_font_size'?(!Number.isInteger(p[k])||p[k]<10||p[k]>20):((k!=='overview_guide_dismissed'&&!Object.hasOwn(OPTIONAL_PAGES,k)&&!Object.hasOwn(CORPORATE_VISIBILITY_PAGES,k)&&!adminNav.slice(2).some(([id])=>id===k))||typeof p[k]!=='boolean')))throw bad('Invalid page preference');
  const next={...preferences(db,req.session.user_id),...p};
  db.prepare('INSERT INTO page_preferences VALUES(?,?) ON CONFLICT(user_id) DO UPDATE SET data=excluded.data').run(req.session.user_id,JSON.stringify(next));res.json(next);
 });
 function notifications(user,includeDismissed=false){
  const prefs=preferences(db,user);
  const rows=db.prepare("SELECT c.id,c.name,s.data,s.updated FROM characters c JOIN snapshots s ON s.character_id=c.id AND s.kind='dens' WHERE c.user_id=?").all(user).map(c=>({...c,data:JSON.parse(c.data),error:db.prepare("SELECT message FROM sync_errors WHERE character_id=? AND kind='dens'").get(c.id)?.message}));
  const pilots=db.prepare("SELECT c.id,c.name,COALESCE((SELECT parent_id FROM character_groups WHERE character_id=c.id),(SELECT main_id FROM users WHERE id=c.user_id),c.id) parent_id,COALESCE((SELECT expires_on FROM character_subscriptions WHERE character_id=COALESCE((SELECT parent_id FROM character_groups WHERE character_id=c.id),(SELECT main_id FROM users WHERE id=c.user_id),c.id)),(SELECT expires_on FROM character_subscriptions WHERE character_id=c.id)) subscription_end FROM characters c WHERE c.user_id=?").all(user).map(pilot=>({...pilot,snapshots:Object.fromEntries(db.prepare("SELECT s.kind,s.data,s.updated,e.message error FROM snapshots s LEFT JOIN sync_errors e ON e.character_id=s.character_id AND e.kind=s.kind WHERE s.character_id=? AND s.kind IN ('skills','industry','market','pi')").all(pilot.id).map(row=>[row.kind,{...row,data:JSON.parse(row.data)}]))}));
  const alerts=[...(prefs.dens===false?[]:denAlerts(rows).map(alert=>({...alert,page:'dens'}))),...personalAlerts(pilots,prefs),...(()=>{const u=db.prepare('SELECT main_id,admin FROM users WHERE id=?').get(user),d=discord?.read();return isSiteAdmin(u,config.owner)&&d?.enabled&&!d.guide_hidden?[{character_id:u.main_id,kind:'discord-setup',pilot:'Discord',location:'Setup',event_key:'discord-setup',page:'admin-discord',message:d.connected?'Discord connected. Setup instructions can now be hidden in Admin → Discord.':'Discord setup required. Open Admin → Discord for step-by-step bot setup instructions.'}]:[];})()].map(alert=>({...alert,id:notificationIdentity(alert)}));
  const dismissed=includeDismissed?new Set():new Set(db.prepare('SELECT event_key FROM notification_dismissals WHERE user_id=?').all(user).map(row=>row.event_key));
  return alerts.filter(alert=>!dismissed.has(alert.id));
 }
 app.get('/api/notifications',(req,res)=>res.json(notifications(req.session.user_id)));
 app.post('/api/notifications/dismiss',(req,res)=>{
  const keys=req.body?.keys;if(!Array.isArray(keys)||keys.length>5000||keys.some(key=>typeof key!=='string'||!/^[a-f0-9]{64}$/.test(key)))throw bad('Choose notifications to clear.');
  const available=new Set(notifications(req.session.user_id,true).map(alert=>alert.id)),dismissed=[...new Set(keys)].filter(key=>available.has(key));
  const save=db.prepare('INSERT OR IGNORE INTO notification_dismissals VALUES(?,?,?)');for(const key of dismissed)save.run(req.session.user_id,key,Date.now());
  res.json({dismissed});
 });
 app.get('/api/admin/group-conditions',admin,async(req,res)=>{
  try{const d=await corp.pilots();res.json({corporation_id:STEMP_ID,titles:d.titles||[...new Map((d.rows||[]).flatMap(p=>p.titles||[]).map(t=>[t.id,t])).values()],roles:[...new Set(['Director','Accountant','Junior_Accountant','Personnel_Manager','Factory_Manager','Trader',...(d.rows||[]).flatMap(p=>Object.values(p.rights?.assigned||{}).flat())])].sort(),error:d.error||null});}
  catch(e){res.json({corporation_id:STEMP_ID,titles:[],roles:['Director','Accountant','Junior_Accountant','Personnel_Manager','Factory_Manager','Trader'],error:'Title choices are unavailable. Connect an eligible director and refresh corporation data.'});}
 });
 app.get('/api/ratting',(req,res)=>{
  const pilots=db.prepare("SELECT c.id,c.name,s.data,s.updated FROM characters c LEFT JOIN snapshots s ON s.character_id=c.id AND s.kind='wallet-history' WHERE c.user_id=?").all(req.session.user_id).map(c=>({...c,data:c.data?JSON.parse(c.data):null,error:db.prepare("SELECT message FROM sync_errors WHERE character_id=? AND kind='wallet-history'").get(c.id)?.message||null}));
  if(req.query.detail==='1'){
   const types=new Map();return res.json(pilots.map(p=>{const journal=(p.data?.journal||[]).filter(r=>Object.hasOwn(RATTING_TYPES,r.ref_type)&&Number.isFinite(r.amount)&&r.amount>0),npc_types={};for(const row of journal)if(row.ref_type==='bounty_prizes')for(const {id} of parseBountyReason(row.reason).rats){if(!types.has(id)){let type=null;try{type=cat.type(id);}catch{}types.set(id,type?{name:type.name}:null);}if(types.get(id))npc_types[id]=types.get(id);}
    return {...p,data:p.data?{journal,npc_types,names:p.data.names||{},started_at:p.data.started_at}:null};}));
  }
  res.json({...rattingSummary(pilots,req.query.period||'30'),coverage:pilots.map(({data,...c})=>({...c,started_at:data?.started_at||null}))});
 });
 const recruitGroups=req=>Boolean(req.recruit||req.inspect?.recruitment_only||req.inspect&&recruitAccount(db,req.session.user_id));
 const visibleGroups=req=>groupList(db,req.session.user_id).filter(g=>!recruitGroups(req)||g.recruit_visible);
 app.get('/api/groups',(req,res)=>res.json(visibleGroups(req).map(g=>({...g,eligible:['restricted','auto-enrol'].includes(g.mode)?eligible(db,req.session.user_id,g.rules):null}))));
 app.post('/api/groups/:id/apply',(req,res)=>{
  const g=visibleGroups(req).find(g=>g.id===Number(req.params.id));if(!g)return res.sendStatus(404);
  if(g.mode==='auto-enrol')return res.status(403).json({error:'This group is managed by automatic enrolment. Ask an admin to review a manual rejection.'});
  if(['restricted','auto-enrol'].includes(g.mode)&&!eligible(db,req.session.user_id,g.rules))throw bad('No single pilot meets every requirement with fresh skills/assets. Sync your characters and try again.');
  const status=g.mode==='approval'?'pending':'approved';
  db.prepare("INSERT INTO group_members VALUES(?,?,?) ON CONFLICT(group_id,user_id) DO UPDATE SET status=CASE WHEN group_members.status='approved' THEN 'approved' ELSE excluded.status END").run(g.id,req.session.user_id,status);res.json({ok:true});
 });
 app.get('/api/admin/groups',admin,(req,res)=>res.json({groups:groupList(db,req.session.user_id),pages:CORPORATE_PAGES,management_pages:MANAGEMENT_PAGES,requests:db.prepare("SELECT m.*,u.name,u.main_id,(SELECT json_group_array(c.name) FROM characters c WHERE c.user_id=u.id) pilot_names,g.name group_name FROM group_members m JOIN users u ON u.id=m.user_id JOIN access_groups g ON g.id=m.group_id ORDER BY g.name,u.name").all()}));
 app.post('/api/admin/groups',admin,(req,res)=>{
  const b=req.body,name=text(b.name,80),mode=b.mode,rules=b.rules||[],pages=b.pages||[];
  if(b.recruit_visible!==undefined&&typeof b.recruit_visible!=='boolean')throw bad('Recruit visibility must be a checkbox value.');
  const validRule=r=>r&&['ship-type','ship-group','skill','role','title','corporation'].includes(r.kind)&&(r.kind==='role'?typeof r.id==='string'&&/^[A-Za-z][A-Za-z0-9_]{0,80}$/.test(r.id):Number.isSafeInteger(r.id)&&r.id>0)&&(r.kind!=='skill'||(Number.isInteger(r.level)&&r.level>=1&&r.level<=5));
  if(!name||!['auto','approval','restricted','auto-enrol'].includes(mode)||!Array.isArray(pages)||pages.some(p=>!Object.hasOwn(CORPORATE_PAGES,p)&&!Object.hasOwn(MANAGEMENT_PAGES,p))||!Array.isArray(rules)||rules.length>20||rules.some(r=>!validRule(r))||(['restricted','auto-enrol'].includes(mode)&&!rules.length))throw bad('Check group name, mode, requirements and pages');
  for(const r of rules){
   if(r.kind==='corporation'){r.id=STEMP_ID;r.name='Member of STEMP';}
   else if(r.kind==='role'||r.kind==='title'){r.corporation_id=STEMP_ID;r.name=text(r.name,150)||(r.kind==='role'?r.id.replaceAll('_',' '):'Corporation Title '+r.id);}
   else if(r.kind!=='ship-group'){const t=cat.type(r.id);if(!t||t.category_id!==(r.kind==='skill'?16:6))throw bad('Choose a valid '+(r.kind==='skill'?'skill':'ship')+' from the search results');r.name=t.name;}
  }
  const icon=text(b.icon,12)||'◇',current=b.id?db.prepare('SELECT icon FROM access_groups WHERE id=?').get(Number(b.id))?.icon:null;
  if(!allowedGroupIcon(icon,current))throw bad('Choose an icon from the group icon picker.');
  const role=String(b.discord_role_id||'').trim();if(role&&!/^[1-9]\d{5,19}$/.test(role))throw bad('Enter a valid Discord Role ID, or leave it blank.');
  const values=[name,icon,text(b.description,2000),mode,JSON.stringify(rules),JSON.stringify(pages),role,Number(b.recruit_visible===true)];
  if(b.id){if(!db.prepare('UPDATE access_groups SET name=?,icon=?,description=?,mode=?,rules=?,pages=?,discord_role_id=?,recruit_visible=? WHERE id=?').run(...values,Number(b.id)).changes)return res.sendStatus(404);}
  else db.prepare('INSERT INTO access_groups(name,icon,description,mode,rules,pages,discord_role_id,recruit_visible) VALUES(?,?,?,?,?,?,?,?)').run(...values);
  groupEnrolment?.invalidate();res.json({ok:true});
 });
 app.delete('/api/admin/groups/:id',admin,(req,res)=>{db.prepare('DELETE FROM access_groups WHERE id=?').run(Number(req.params.id));res.json({ok:true});});
 app.post('/api/admin/groups/:id/member',admin,(req,res)=>{
  if(!['approved','rejected'].includes(req.body.status))throw bad('Invalid decision');
  const g=db.prepare('SELECT * FROM access_groups WHERE id=?').get(Number(req.params.id));if(!g)return res.sendStatus(404);
  if(['restricted','auto-enrol'].includes(g.mode)&&req.body.status==='approved'&&!eligible(db,Number(req.body.user_id),JSON.parse(g.rules)))throw bad('Requirements are not met');
  if(!db.prepare('UPDATE group_members SET status=? WHERE group_id=? AND user_id=?').run(req.body.status,g.id,Number(req.body.user_id)).changes)return res.sendStatus(404);res.json({ok:true});
 });
 app.get('/api/links',(req,res)=>recruitLinksHidden(db,req)?res.status(403).json({error:'Links are available to members only.'}):res.json(db.prepare('SELECT * FROM external_links ORDER BY name').all()));
 app.get('/api/admin/links',admin,(req,res)=>res.json(db.prepare('SELECT * FROM external_links ORDER BY name').all()));
 app.post('/api/admin/links',admin,(req,res)=>{
  const name=text(req.body.name,80),description=text(req.body.description,1000);let url;
  try{const target=String(req.body.url||'').trim();url=new URL(/^[a-z][a-z0-9+.-]*:/i.test(target)?target:'https://'+target);}catch{throw bad('Enter a valid URL');}
  if(!name||!['https:','http:'].includes(url.protocol)||url.username||url.password)throw bad('Use a name and an HTTP(S) URL without credentials');
  const slug=String(req.body.slug||'').trim().replace(/^\//,'');
  if(slug&&(!/^[A-Za-z][A-Za-z0-9_-]{0,59}$/.test(slug)||['api','auth','recruit','health','public','assets','favicon','robots','index','source','discord'].includes(slug.toLowerCase())))throw bad('Choose a unique short path using letters, numbers, underscores or hyphens. This path is reserved or invalid.');
  if(slug&&db.prepare('SELECT 1 FROM external_links WHERE slug=? COLLATE NOCASE AND id<>?').get(slug,Number(req.body.id)||0))throw bad('This short path is already used.');
  if(req.body.id){if(!db.prepare('UPDATE external_links SET name=?,description=?,url=?,slug=? WHERE id=?').run(name,description,url.href,slug,Number(req.body.id)).changes)return res.sendStatus(404);}
  else db.prepare('INSERT INTO external_links(name,description,url,slug) VALUES(?,?,?,?)').run(name,description,url.href,slug);res.json({ok:true});
 });
 app.delete('/api/admin/links/:id',admin,(req,res)=>{db.prepare('DELETE FROM external_links WHERE id=?').run(Number(req.params.id));res.json({ok:true});});
 async function mailNames(rows,c){
  const ids=[...new Set(rows.flatMap(row=>[row.from,...(row.recipients||[]).filter(r=>r.recipient_type!=='mailing_list').map(r=>r.recipient_id)]).filter(id=>Number.isSafeInteger(id)&&id>0))],names={};
  for(let i=0;i<ids.length;i+=1000)try{const result=await eve.request('/universe/names',null,'POST',ids.slice(i,i+1000));for(const entry of result.data)names[entry.id]=entry.name;}catch{}
  if(rows.some(row=>(row.recipients||[]).some(r=>r.recipient_type==='mailing_list')))try{for(const list of await eve.get('/characters/'+c.id+'/mail/lists/',c))names['mailing_list:'+list.mailing_list_id]=list.name;}catch{}
  return names;
 }
 app.get('/api/inspect/:kind',async(req,res)=>{
  if(!req.inspect)return res.sendStatus(403);
  const kind=req.params.kind;if(!['mail','contacts'].includes(kind))return res.sendStatus(404);
  const c=db.prepare('SELECT * FROM characters WHERE id=? AND user_id=?').get(Number(req.query.character),req.session.user_id);if(!c)return res.sendStatus(404);
  const scope=kind==='mail'?'esi-mail.read_mail.v1':'esi-characters.read_contacts.v1';
  if(!JSON.parse(c.scopes).includes(scope))return res.status(403).json({error:'This pilot must reconnect to grant '+scope});
  if(kind==='mail'&&req.query.mail){const id=Number(req.query.mail);if(!Number.isSafeInteger(id)||id<1)throw bad('Invalid mail');const mail=await eve.get('/characters/'+c.id+'/mail/'+id,c);return res.json({...mail,names:await mailNames([mail],c)});}
  const result=await eve.request('/characters/'+c.id+'/'+kind+(kind==='contacts'?'/?page='+(Math.max(1,Math.min(10000,Number(req.query.page)||1))):'/'+(req.query.before?'?last_mail_id='+Number(req.query.before):'')),c);
  if(kind==='mail')return res.json({rows:result.data,pages:result.pages,names:await mailNames(result.data,c)});
  const ids=[...new Set(result.data.flatMap(r=>kind==='contacts'?[r.contact_id]:[r.from,...(r.recipients||[]).map(x=>x.recipient_id)]))];let names={};
  if(ids.length)try{const n=await eve.request('/universe/names',null,'POST',ids);names=Object.fromEntries(n.data.map(x=>[x.id,x.name]));}catch{}
  res.json({rows:result.data,pages:result.pages,names});
 });
 app.get('/api/admin/affiliations',admin,async(req,res)=>{
  const chars=db.prepare('SELECT id FROM characters').all(),out={};
  // Public affiliation batches avoid a separate lookup for every listed character.
  for(let i=0;i<chars.length;i+=1000)try{const r=await eve.request('/characters/affiliation',null,'POST',chars.slice(i,i+1000).map(c=>c.id));for(const x of r.data)out[x.character_id]={corporation_id:x.corporation_id};}catch{}
  const ids=[...new Set(Object.values(out).map(x=>x.corporation_id))];let names={};
  if(ids.length)try{const r=await eve.request('/universe/names',null,'POST',ids);names=Object.fromEntries(r.data.map(x=>[x.id,x.name]));}catch{}
  res.json(Object.fromEntries(Object.entries(out).map(([id,v])=>[id,{...v,corporation_name:names[v.corporation_id]||'Corporation '+v.corporation_id}])));
 });
}
