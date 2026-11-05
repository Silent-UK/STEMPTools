import {random,hash} from './security.mjs';
import {isSiteAdmin} from './admin.mjs';
import {eligible} from './management.mjs';
const snowflake=value=>typeof value==='string'&&/^[1-9]\d{5,19}$/.test(value);
const bad=message=>Object.assign(Error(message),{status:400});
export function discordStore(db){
 db.exec(`CREATE TABLE IF NOT EXISTS discord_config(id INTEGER PRIMARY KEY CHECK(id=1),data TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS discord_accounts(user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,discord_id TEXT NOT NULL UNIQUE,name TEXT NOT NULL,checked INTEGER NOT NULL DEFAULT 0,error TEXT);
 CREATE TABLE IF NOT EXISTS discord_oauth(state TEXT PRIMARY KEY,session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,expires INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS discord_roles(discord_id TEXT NOT NULL,role_id TEXT NOT NULL,PRIMARY KEY(discord_id,role_id));`);
 if(!db.prepare('PRAGMA table_info(access_groups)').all().some(c=>c.name==='discord_role_id'))db.exec("ALTER TABLE access_groups ADD COLUMN discord_role_id TEXT NOT NULL DEFAULT ''");
}
export function discordService(db,box,config,whitelist){
 discordStore(db);const network=config.discordNetwork||fetch,callback=config.base+'/auth/discord/callback';let busy=false,blockedUntil=0,nextScan=0;
 const read=()=>{const saved=db.prepare('SELECT data FROM discord_config WHERE id=1').get();return saved?box.open(saved.data):{enabled:false,client_id:'',guild_id:'',bot_token:'',client_secret:'',connected:0,guide_hidden:false};};
 const write=c=>db.prepare('INSERT INTO discord_config VALUES(1,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data').run(box.seal(c));
 async function request(path,{method='GET',body,authorization}={}){
  if(Date.now()<blockedUntil)throw Object.assign(Error('Discord rate limit; retry is scheduled.'),{status:503});
  const c=read(),r=await network('https://discord.com/api/v10'+path,{method,headers:{Authorization:authorization||'Bot '+c.bot_token,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(15000)});
  if(r.status===429){let delay=60;try{delay=Number((await r.json()).retry_after)||60;}catch{}blockedUntil=Date.now()+Math.max(1,delay)*1000;}
  if(!r.ok)throw Object.assign(Error(r.status===404?'Discord member or role not found. Join the configured server before syncing.':r.status===403?'Discord denied access. Check Manage Roles and role hierarchy.':'Discord request failed (HTTP '+r.status+').'),{status:503,discordStatus:r.status});
  return r.status===204?null:r.json();
 }
 function adminView(){const c=read();return {enabled:c.enabled,client_id:c.client_id,guild_id:c.guild_id,connected:c.connected,guide_hidden:c.guide_hidden,has_bot_token:Boolean(c.bot_token),has_client_secret:Boolean(c.client_secret),callback,bot_name:c.bot_name||'',error:c.error||null,accounts:db.prepare('SELECT a.user_id,a.name,a.checked,a.error,u.name pilot FROM discord_accounts a JOIN users u ON u.id=a.user_id ORDER BY u.name').all(),invite:c.client_id?'https://discord.com/oauth2/authorize?'+new URLSearchParams({client_id:c.client_id,scope:'bot',permissions:'268435456',guild_id:c.guild_id,disable_guild_select:'true'}):null};}
 function save(input){
  if(typeof input.enabled!=='boolean'||!snowflake(input.client_id)||!snowflake(input.guild_id))throw bad('Enter valid Discord Application and Server IDs.');
  const old=read(),next={...old,enabled:input.enabled,client_id:input.client_id,guild_id:input.guild_id};
  for(const key of ['bot_token','client_secret']){if(input[key]!=null&&typeof input[key]!=='string')throw bad('Invalid Discord credential.');if(input[key]?.trim())next[key]=input[key].trim();}
  if(next.bot_token.length>500||next.client_secret.length>500)throw bad('Invalid Discord credential.');
  if((old.guild_id&&old.guild_id!==next.guild_id||old.client_id&&old.client_id!==next.client_id)&&(db.prepare('SELECT 1 FROM discord_accounts LIMIT 1').get()||db.prepare('SELECT 1 FROM discord_roles LIMIT 1').get()))throw bad('Unlink existing Discord accounts and allow role cleanup before changing the Application or Server ID.');
  if(!next.bot_token||!next.client_secret)throw bad('Enter both the Bot Token and OAuth2 Client Secret.');
  if(['client_id','guild_id','bot_token','client_secret'].some(k=>old[k]!==next[k])){next.connected=0;next.guide_hidden=false;}
  write(next);nextScan=0;return adminView();
 }
 async function test(){const c=read();try{const app=await request('/oauth2/applications/@me'),bot=await request('/users/@me');if(String(app.id)!==c.client_id||!bot.bot)throw bad('Bot Token must belong to the configured Application ID.');const roles=await request('/guilds/'+c.guild_id+'/roles'),member=await request('/guilds/'+c.guild_id+'/members/'+bot.id);const permission=roles.filter(r=>member.roles.includes(r.id)||r.id===c.guild_id).reduce((n,r)=>n|BigInt(r.permissions),0n);if(!(permission&(8n|268435456n)))throw bad('The bot needs Manage Roles in the selected server.');write({...c,connected:Date.now(),bot_name:bot.username,error:null});return adminView();}catch(e){write({...c,connected:0,guide_hidden:false,error:e.message});throw e;}}
 const self=user=>{const c=read(),a=db.prepare('SELECT name,checked,error FROM discord_accounts WHERE user_id=?').get(user);return {enabled:Boolean(c.enabled&&c.connected),account:a||null};};
 async function syncOne(discordId){
  const c=read();if(!c.enabled||!c.connected)return;
  const account=db.prepare('SELECT a.*,u.main_id FROM discord_accounts a JOIN users u ON u.id=a.user_id WHERE discord_id=?').get(discordId);
  let allowed=Boolean(account);if(account)try{await whitelist.check(account.main_id);}catch(e){if(e.status!==403)throw e;allowed=false;}
  const desired=new Set(allowed?db.prepare("SELECT g.* FROM access_groups g JOIN group_members m ON m.group_id=g.id WHERE m.user_id=? AND m.status='approved' AND g.discord_role_id<>''").all(account.user_id).filter(g=>!['restricted','auto-enrol'].includes(g.mode)||eligible(db,account.user_id,JSON.parse(g.rules))).map(g=>g.discord_role_id):[]);
  const tracked=db.prepare('SELECT role_id FROM discord_roles WHERE discord_id=?').all(discordId).map(r=>r.role_id);
  // Cleanup still works when an account is deleted or a group/mapping is removed.
  const member=await request('/guilds/'+c.guild_id+'/members/'+discordId).catch(e=>{if(e.discordStatus===404){db.prepare('DELETE FROM discord_roles WHERE discord_id=?').run(discordId);if(desired.size)throw e;return null;}throw e;});
  if(member){
   for(const id of tracked)if(!desired.has(id)){if(member.roles.includes(id))await request('/guilds/'+c.guild_id+'/members/'+discordId+'/roles/'+id,{method:'DELETE'});db.prepare('DELETE FROM discord_roles WHERE discord_id=? AND role_id=?').run(discordId,id);}
   if(desired.size){const roles=await request('/guilds/'+c.guild_id+'/roles'),bot=await request('/users/@me'),botMember=await request('/guilds/'+c.guild_id+'/members/'+bot.id),top=Math.max(0,...roles.filter(r=>botMember.roles.includes(r.id)).map(r=>r.position));
    for(const id of desired){const role=roles.find(r=>r.id===id);if(!role||role.managed||id===c.guild_id||role.position>=top||(BigInt(role.permissions)&(8n|32n|268435456n)))throw bad('Mapped roles must be below the bot, unmanaged, and cannot grant Administrator, Manage Server or Manage Roles.');
     if(!member.roles.includes(id))await request('/guilds/'+c.guild_id+'/members/'+discordId+'/roles/'+id,{method:'PUT'});
     db.prepare('INSERT OR IGNORE INTO discord_roles VALUES(?,?)').run(discordId,id);
    }
   }
  }
  if(account)db.prepare('UPDATE discord_accounts SET checked=?,error=NULL WHERE user_id=?').run(Date.now(),account.user_id);
 }
 async function tick(){if(busy||Date.now()<blockedUntil||Date.now()<nextScan)return;const c=read();if(!c.enabled||!c.connected)return;busy=true;try{const a=db.prepare('SELECT discord_id FROM discord_accounts WHERE checked<? ORDER BY checked LIMIT 1').get(Date.now()-300000)||db.prepare('SELECT discord_id FROM discord_roles WHERE discord_id NOT IN (SELECT discord_id FROM discord_accounts) LIMIT 1').get();if(!a){nextScan=Date.now()+15000;return;}try{await syncOne(a.discord_id);}catch(e){db.prepare('UPDATE discord_accounts SET checked=?,error=? WHERE discord_id=?').run(Date.now(),e.message,a.discord_id);nextScan=Date.now()+15000;}}finally{busy=false;}}
 return {adminView,save,test,self,tick,request,read,write,syncOne,callback,snowflake,
  async unlink(user){const a=db.prepare('SELECT discord_id FROM discord_accounts WHERE user_id=?').get(user);if(!a)return;const c=read();if(db.prepare('SELECT 1 FROM discord_roles WHERE discord_id=?').get(a.discord_id)&&(!c.enabled||!c.connected))throw bad('Enable and connect Discord before unlinking so managed roles can be removed.');const tracked=db.prepare('SELECT role_id FROM discord_roles WHERE discord_id=?').all(a.discord_id);for(const r of tracked)try{await request('/guilds/'+c.guild_id+'/members/'+a.discord_id+'/roles/'+r.role_id,{method:'DELETE'});}catch(e){if(e.discordStatus!==404)throw e;}db.prepare('DELETE FROM discord_roles WHERE discord_id=?').run(a.discord_id);db.prepare('DELETE FROM discord_accounts WHERE user_id=?').run(user);},
  begin(session){const c=read();if(!c.enabled||!c.connected)throw bad('Discord integration is not connected.');const state=random();db.prepare('DELETE FROM discord_oauth WHERE expires<?').run(Date.now());db.prepare('INSERT INTO discord_oauth VALUES(?,?,?)').run(hash(state),session.id,Date.now()+600000);return 'https://discord.com/oauth2/authorize?'+new URLSearchParams({client_id:c.client_id,response_type:'code',scope:'identify',redirect_uri:callback,state});},
  async complete(session,query){const state=db.prepare('DELETE FROM discord_oauth WHERE state=? AND session_id=? AND expires>? RETURNING state').get(hash(String(query.state||'')),session.id,Date.now());if(!state||typeof query.code!=='string')throw bad('Discord sign-in expired or was cancelled. Try again.');const c=read();if(!c.enabled||!c.connected)throw bad('Discord integration is disabled.');const r=await network('https://discord.com/api/v10/oauth2/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:c.client_id,client_secret:c.client_secret,grant_type:'authorization_code',code:query.code,redirect_uri:callback}),signal:AbortSignal.timeout(15000)});if(!r.ok)throw bad('Discord sign-in failed. Check the OAuth2 callback and Client Secret.');const token=await r.json(),user=await request('/users/@me',{authorization:'Bearer '+token.access_token});if(!snowflake(user.id)||typeof user.username!=='string')throw bad('Invalid Discord identity.');const used=db.prepare('SELECT user_id FROM discord_accounts WHERE discord_id=?').get(user.id),existing=db.prepare('SELECT discord_id FROM discord_accounts WHERE user_id=?').get(session.user_id);if(used&&used.user_id!==session.user_id)throw bad('This Discord account is already linked.');if(existing&&existing.discord_id!==user.id)throw bad('Unlink your existing Discord account first.');db.prepare('INSERT INTO discord_accounts(user_id,discord_id,name) VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET name=excluded.name,checked=0').run(session.user_id,user.id,user.username);return user;}
 };
}
export function discordRoutes(app,{discord,config}){
 const admin=(req,res,next)=>!req.inspect&&isSiteAdmin(req.session,config.owner)?next():res.sendStatus(403);
 app.get('/api/admin/discord',admin,(_req,res)=>res.json(discord.adminView()));
 app.post('/api/admin/discord',admin,(req,res)=>res.json(discord.save(req.body)));
 app.post('/api/admin/discord/test',admin,async(_req,res)=>res.json(await discord.test()));
 app.post('/api/admin/discord/hide-guide',admin,(_req,res)=>{const c=discord.read();if(!c.connected)throw bad('Connect the bot before hiding setup instructions.');discord.write({...c,guide_hidden:true});res.json({ok:true});});
 app.get('/api/discord',(req,res)=>{if(req.inspect)return res.sendStatus(403);res.json(discord.self(req.session.user_id));});
 app.post('/api/discord/connect',(req,res)=>{if(req.inspect)return res.sendStatus(403);res.json({url:discord.begin(req.session)});});
 app.post('/api/discord/unlink',async(req,res)=>{if(req.inspect)return res.sendStatus(403);await discord.unlink(req.session.user_id);res.json({ok:true});});
 app.get('/auth/discord/callback',async(req,res)=>{if(!req.session||req.inspect)return res.sendStatus(403);await discord.complete(req.session,req.query);res.redirect('/#settings');});
}
