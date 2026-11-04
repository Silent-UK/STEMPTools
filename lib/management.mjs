export const MANAGEMENT_PAGES={recruitment:'Recruitment'};
export const OPTIONAL_PAGES={standings:'Standings',ratting:'Ratting',market:'Market',mining:'Mining',industry:'Industry',blueprints:'Blueprints',dens:'Mercenary Dens',pi:'Planetary Industry'};
export const CORPORATE_PAGES={'corp-overview':'Overview','corp-members':'Memberlist','corp-pilots':'Roles and Access','corp-wallet':'Wallet','corp-contracts':'Contracts','corp-assets':'Corp Assets','corp-search-pilots':'Search Pilots','corp-standings':'Standings','corp-market':'Market','corp-industry':'Industry','corp-blueprints':'Blueprints','corp-structures':'Structures','corp-moons':'Moon Mining','corp-surveys':'Moon Surveys'};
export const CORPORATE_VISIBILITY_PAGES=Object.fromEntries(Object.entries(CORPORATE_PAGES).filter(([id])=>!['corp-overview','corp-members','corp-pilots'].includes(id)));
export function managementStore(db){
 db.exec(`CREATE TABLE IF NOT EXISTS page_preferences(user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,data TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS access_groups(id INTEGER PRIMARY KEY,name TEXT NOT NULL,icon TEXT NOT NULL,description TEXT NOT NULL,mode TEXT NOT NULL,rules TEXT NOT NULL,pages TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS group_members(group_id INTEGER REFERENCES access_groups(id) ON DELETE CASCADE,user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,status TEXT NOT NULL,PRIMARY KEY(group_id,user_id));
 CREATE TABLE IF NOT EXISTS fitting_imports(user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,character_id INTEGER REFERENCES characters(id) ON DELETE CASCADE,fitting_id INTEGER,document_id TEXT REFERENCES documents(id) ON DELETE CASCADE,description TEXT NOT NULL,PRIMARY KEY(user_id,character_id,fitting_id));
 CREATE TABLE IF NOT EXISTS notification_dismissals(user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,event_key TEXT NOT NULL,dismissed INTEGER NOT NULL,PRIMARY KEY(user_id,event_key));
 CREATE TABLE IF NOT EXISTS external_links(id INTEGER PRIMARY KEY,name TEXT NOT NULL,description TEXT NOT NULL,url TEXT NOT NULL);`);
 if(!db.prepare('PRAGMA table_info(access_groups)').all().some(c=>c.name==='recruit_visible'))db.exec("ALTER TABLE access_groups ADD COLUMN recruit_visible INTEGER NOT NULL DEFAULT 0");
 if(!db.prepare('PRAGMA table_info(external_links)').all().some(c=>c.name==='slug'))db.exec("ALTER TABLE external_links ADD COLUMN slug TEXT NOT NULL DEFAULT ''");
 db.exec("CREATE UNIQUE INDEX IF NOT EXISTS external_link_slug ON external_links(slug COLLATE NOCASE) WHERE slug<>''");
}
export function preferences(db,user){return JSON.parse(db.prepare('SELECT data FROM page_preferences WHERE user_id=?').get(user)?.data||'{}');}
export function syncEnabled(db,user,kind){
 const p=preferences(db,user);
 if(kind==='industry')return p.industry!==false||p.blueprints!==false;
 const page=({standings:'standings',market:'market',pi:'pi',dens:'dens',industry:'industry',mining:'mining'})[kind];
 if(!page||p[page]!==false)return true;
 // Restricted membership depends on fresh skills and inventory, both always synced.
 // PI shares remain a dependency even when the owner's page is hidden.
 return kind==='pi'&&!!db.prepare('SELECT 1 FROM pi_shares WHERE owner_id=? LIMIT 1').get(user);
}
export function eligible(db,user,rules,now=Date.now()){
 if(!rules.length)return false;
 return db.prepare('SELECT id FROM characters WHERE user_id=?').all(user).some(c=>{
  const read=kind=>{const s=db.prepare('SELECT * FROM snapshots WHERE character_id=? AND kind=?').get(c.id,kind);return s&&now-s.updated<=86400000&&!db.prepare('SELECT 1 FROM sync_errors WHERE character_id=? AND kind=?').get(c.id,kind)?JSON.parse(s.data):null;};
  return rules.every(r=>{
   if(r.kind==='role'||r.kind==='title'){const evidence=read(r.kind==='role'?'roles':'titles');return evidence?.corporation_id===r.corporation_id&&(r.kind==='role'?(evidence.roles||[]).includes(r.id):(evidence.titles||[]).some(t=>t.title_id===r.id));}
   if(r.kind==='skill')return (read('skills')?.skills?.skills||[]).some(s=>s.skill_id===r.id&&s.active_skill_level>=r.level);
   return (read('assets')?.items||[]).some(a=>a.quantity>0&&(r.kind==='ship-type'?a.type_id===r.id:a.group_id===r.id));
  });
 });
}
export function groupList(db,user){return db.prepare('SELECT * FROM access_groups ORDER BY name').all().map(g=>({...g,recruit_visible:Boolean(g.recruit_visible),rules:JSON.parse(g.rules),pages:JSON.parse(g.pages),status:db.prepare('SELECT status FROM group_members WHERE group_id=? AND user_id=?').get(g.id,user)?.status||null}));}
export function grants(db,user){return [...new Set(groupList(db,user).filter(g=>g.status==='approved'&&(g.mode!=='restricted'||eligible(db,user,g.rules))).flatMap(g=>g.pages))];}
export function rattingSummary(pilots,period='30',now=Date.now()){
 const d=new Date(now);let start=0;
 if(period==='day')start=Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate());
 else if(period==='week'){start=Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate());start-=((d.getUTCDay()+6)%7)*86400000;}
 else if(period==='month')start=Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),1);
 else if(['30','60','90'].includes(period))start=now-Number(period)*86400000;
 else if(period!=='all')throw Object.assign(Error('Invalid ratting period'),{status:400});
 const types=new Set(['bounty_prizes','ess_escrow_transfer','bounty_prize_corporation_tax']);
 // Corporate tax entries are excluded: this view counts personal NPC payouts only.
 types.delete('bounty_prize_corporation_tax');
 const rows=pilots.map(p=>({...p,total:(p.data?.journal||[]).filter(r=>types.has(r.ref_type)&&r.amount>0&&Date.parse(r.date)>=start&&Date.parse(r.date)<=now).reduce((n,r)=>n+r.amount,0)})).filter(p=>p.total>0).sort((a,b)=>b.total-a.total);
 const dateStart=Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate());
 const earliest=pilots.reduce((first,p)=>(p.data?.journal||[]).reduce((old,r)=>{const value=Date.parse(r.date);return Number.isFinite(value)?Math.min(old,value):old;},first),now);
 const windowStart=period==='all'?earliest:start;
 const days=['30','60','90'].includes(period)?Number(period):Math.max(1,Math.floor((dateStart-Date.UTC(new Date(windowStart).getUTCFullYear(),new Date(windowStart).getUTCMonth(),new Date(windowStart).getUTCDate()))/86400000)+1);
 const total=rows.reduce((n,p)=>n+p.total,0);
 return {days,average_per_day:total/days,period_start:windowStart,total:rows.reduce((n,p)=>n+p.total,0),rows:rows.map(({data,...p})=>p),start};
}
