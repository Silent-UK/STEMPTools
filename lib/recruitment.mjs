import {removePilotWhitelist} from './accounts.mjs';
import {isSiteAdmin} from './admin.mjs';
import {grants} from './management.mjs';
import {recruitmentStore,recruitmentConfig,validateRecruitmentConfig} from './recruitment-store.mjs';
import {blacklistService} from './recruit-blacklist.mjs';
import {pilotCheckService} from './pilot-check.mjs';
import {combatSummary,pilotCombatService} from './pilot-combat.mjs';
export function recruitmentService(db,eve,cat,config){
 recruitmentStore(db);
 const blacklist=blacklistService(db,{network:config.recruitNetwork||fetch,contact:config.contact}),checks=pilotCheckService(db,eve,cat),combat=pilotCombatService(db,eve,cat,{network:config.recruitNetwork||fetch,contact:config.contact});
 const canReview=session=>isSiteAdmin(session,config.owner)||Boolean(session&&grants(db,session.user_id).includes('recruitment'));
 const canInspect=(session,target)=>{const user=db.prepare('SELECT main_id,admin FROM users WHERE id=?').get(target);return Boolean(user&&!isSiteAdmin(user,config.owner)&&(isSiteAdmin(session,config.owner)||(canReview(session)&&db.prepare("SELECT 1 FROM recruitment_applications WHERE user_id=? AND status<>'joined'").get(target))));};
 return {blacklist,checks,combat,canReview,canInspect,async tick(){await checks.tick();await combat.tick();},schedule:()=>blacklist.sync().catch(()=>{}),config:()=>recruitmentConfig(db)};
}
export function recruitmentRoutes(app,{db,recruitment,config}){
 const staff=(req,res,next)=>recruitment.canReview(req.session)&&!req.inspect?next():res.sendStatus(403);
 const admin=(req,res,next)=>isSiteAdmin(req.session,config.owner)&&!req.inspect?next():res.sendStatus(403);
 app.get('/api/recruit/application',(req,res)=>{const row=db.prepare('SELECT status,created,consented,joined_at FROM recruitment_applications WHERE user_id=?').get(req.session.user_id);res.json(row||null);});
 app.get('/api/recruitment',staff,(req,res)=>res.json(db.prepare(`SELECT a.*,u.main_id,u.name,u.admin,(SELECT COUNT(*) FROM characters c WHERE c.user_id=u.id) characters,(SELECT MAX(s.updated) FROM snapshots s JOIN characters c ON c.id=s.character_id WHERE c.user_id=u.id) synced FROM recruitment_applications a JOIN users u ON u.id=a.user_id ORDER BY a.created DESC`).all().map(row=>({...row,inspectable:recruitment.canInspect(req.session,row.user_id)}))));
 app.post('/api/recruitment/:id',staff,(req,res)=>{
  const id=Number(req.params.id),status=req.body.status,notes=req.body.notes;
  if(!Number.isSafeInteger(id)||!['applied','reviewing','accepted','rejected'].includes(status)||typeof notes!=='string'||notes.length>4000)return res.status(400).json({error:'Choose a valid application status and notes.'});
  if(db.prepare("SELECT 1 FROM recruitment_applications WHERE user_id=? AND status='joined'").get(id))return res.status(409).json({error:'This applicant is now a member. Their application is retained as history.'});
  if(!db.prepare('UPDATE recruitment_applications SET status=?,notes=?,reviewed=?,reviewer=? WHERE user_id=?').run(status,notes,Date.now(),req.session.user_id,id).changes)return res.sendStatus(404);
  if(status==='rejected')removePilotWhitelist(db,[db.prepare('SELECT main_id FROM users WHERE id=?').get(id)?.main_id]);
  res.json({ok:true});
 });
 app.get('/api/admin/recruitment',admin,(req,res)=>res.json({config:recruitment.config(),blacklist:recruitment.blacklist.status(),entries:db.prepare('SELECT name,character_id,reason,source_columns FROM recruitment_blacklist ORDER BY name LIMIT 500').all()}));
 app.post('/api/admin/recruitment',admin,(req,res)=>{try{const value=validateRecruitmentConfig(req.body);db.prepare('INSERT INTO recruitment_config VALUES(1,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data').run(JSON.stringify({...value,friendly_defaults_version:1}));res.json({ok:true});}catch(e){res.status(400).json({error:e.message});}});
 app.post('/api/admin/recruitment/blacklist-sync',admin,async(req,res)=>{recruitment.blacklist.sync(true).catch(()=>{});res.status(202).json(recruitment.blacklist.status());});
 for(const kind of ['pilot-check','pilot-combat'])app.get('/api/inspect/'+kind,(req,res)=>{
  if(!req.inspect)return res.sendStatus(403);
  if(!req.query.character||req.query.character==='all'){
   const characters=db.prepare('SELECT id,user_id,name FROM characters WHERE user_id=? ORDER BY name').all(req.session.user_id),service=kind==='pilot-check'?recruitment.checks:recruitment.combat;
   const pilots=characters.map(c=>({...c,...service.view(c,req.query.refresh==='1')}));
   let summary=null;
   if(kind==='pilot-combat'){
    const saved=characters.map(c=>db.prepare('SELECT data FROM recruitment_combat WHERE character_id=?').get(c.id)).filter(Boolean).map(r=>JSON.parse(r.data));
    if(saved.length)summary=combatSummary(characters.map(c=>c.id),saved.flatMap(s=>s.rows),Object.assign({},...saved.map(s=>s.names)),null);
   }
   return res.json({pilots,summary});
  }
  const c=db.prepare('SELECT id,user_id,name FROM characters WHERE id=? AND user_id=?').get(Number(req.query.character),req.session.user_id);if(!c)return res.sendStatus(404);
  res.json((kind==='pilot-check'?recruitment.checks:recruitment.combat).view(c,req.query.refresh==='1'));
 });
}
