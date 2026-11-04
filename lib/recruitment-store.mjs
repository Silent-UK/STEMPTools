// WinterCo defaults verified against ESI universe/ids; FRT-alt deliberately excluded.
export const DEFAULT_FRIENDLY_ALLIANCES=[{"name": "Pandemic Legion", "id": 386292982}, {"name": "Banderlogs Alliance", "id": 99001317}, {"name": "Blades of Grass", "id": 99005393}, {"name": "Fraternity Auxiliary", "id": 99013541}, {"name": "Fraternity.", "id": 99003581}, {"name": "Memento Moriendo", "id": 99005830}, {"name": "Northern Coalition.", "id": 1727758877}, {"name": "Solyaris Chtonium", "id": 1042504553}, {"name": "Synergy of Steel", "id": 99002685}, {"name": "Test Alliance Please Ignore", "id": 498125261}];
export function recruitmentStore(db){
 db.exec(`
 CREATE TABLE IF NOT EXISTS recruitment_applications(user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,status TEXT NOT NULL DEFAULT 'applied',created INTEGER NOT NULL,consented INTEGER NOT NULL,reviewed INTEGER,reviewer INTEGER REFERENCES users(id) ON DELETE SET NULL,notes TEXT NOT NULL DEFAULT '');
 CREATE TABLE IF NOT EXISTS recruitment_config(id INTEGER PRIMARY KEY CHECK(id=1),data TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS recruitment_blacklist(name_key TEXT PRIMARY KEY,name TEXT NOT NULL,character_id INTEGER,reason TEXT NOT NULL,source_columns TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS recruitment_blacklist_sync(id INTEGER PRIMARY KEY CHECK(id=1),updated INTEGER NOT NULL DEFAULT 0,attempted INTEGER NOT NULL DEFAULT 0,error TEXT);
 INSERT OR IGNORE INTO recruitment_blacklist_sync(id) VALUES(1);
 CREATE TABLE IF NOT EXISTS recruitment_combat_jobs(character_id INTEGER PRIMARY KEY REFERENCES characters(id) ON DELETE CASCADE,state TEXT NOT NULL,status TEXT NOT NULL,next_due INTEGER NOT NULL,updated INTEGER NOT NULL,error TEXT,failures INTEGER NOT NULL DEFAULT 0);
 CREATE TABLE IF NOT EXISTS recruitment_combat_stage(character_id INTEGER REFERENCES characters(id) ON DELETE CASCADE,killmail_id INTEGER NOT NULL,data TEXT NOT NULL,PRIMARY KEY(character_id,killmail_id));
 CREATE TABLE IF NOT EXISTS recruitment_combat(character_id INTEGER PRIMARY KEY REFERENCES characters(id) ON DELETE CASCADE,data TEXT NOT NULL,updated INTEGER NOT NULL);
 `);
 const saved=JSON.parse(db.prepare('SELECT data FROM recruitment_config WHERE id=1').get()?.data||'{}');
 if(!saved.friendly_defaults_version){
  const current=saved.friendly||{pilot:[],corporation:[],alliance:[]};
  if(!current.alliance?.length)current.alliance=DEFAULT_FRIENDLY_ALLIANCES.map(a=>a.id).filter(id=>!saved.hostile?.alliance?.includes(id));
  saved.friendly=current;saved.friendly_defaults_version=1;
  db.prepare('INSERT INTO recruitment_config VALUES(1,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data').run(JSON.stringify(saved));
 }
}
export const DEFAULT_BLACKLIST_SHEET='1nKtgFowqPEI7I1qzuXnKIFtNZurpKw7K5mZmCY4AHFg';
export function recruitmentConfig(db){return {sheet:DEFAULT_BLACKLIST_SHEET,gid:'0',friendly:{pilot:[],corporation:[],alliance:DEFAULT_FRIENDLY_ALLIANCES.map(a=>a.id)},hostile:{pilot:[],corporation:[],alliance:[]},...JSON.parse(db.prepare('SELECT data FROM recruitment_config WHERE id=1').get()?.data||'{}')};}
export function validateRecruitmentConfig(value){
 if(!value||typeof value.sheet!=='string'||!/^[-\w]{5,120}$/.test(value.sheet)||!/^\d{1,20}$/.test(String(value.gid)))throw Error('Enter a Google Sheet ID and numeric tab ID.');
 const result={sheet:value.sheet,gid:String(value.gid)};
 for(const side of ['friendly','hostile']){
  result[side]={};for(const kind of ['pilot','corporation','alliance']){
   const ids=value[side]?.[kind];if(!Array.isArray(ids)||ids.length>5000||ids.some(id=>!Number.isSafeInteger(id)||id<=0))throw Error('Alignment lists must contain valid EVE IDs.');
   result[side][kind]=[...new Set(ids)];
  }
 }
 for(const kind of ['pilot','corporation','alliance'])if(result.friendly[kind].some(id=>result.hostile[kind].includes(id)))throw Error('An entity cannot be both friendly and hostile.');
 return result;
}
export const recruitAccount=(db,user)=>db.prepare("SELECT * FROM recruitment_applications WHERE user_id=? AND status NOT IN ('rejected','withdrawn')").get(user);
export function restrictedRecruitPath(path){return /^\/auth\/(login|callback)$/.test(path)||path==='/api/me'||path==='/api/logout'||path==='/api/sync'||path==='/api/notifications'||path==='/api/recruit/application'||/^\/api\/pages\/\d+$/.test(path)||path==='/api/assets'||/^\/api\/operations\//.test(path)||path==='/api/fitting-workbench/source'||/^\/api\/characters(?:\/|$)/.test(path);}

// Delegated recruiters inspect applicant-owned data, never global member/corporation libraries.
export function recruitInspectPath(path){return ['/api/me','/api/notifications','/api/ratting','/api/assets','/api/catalog','/api/affiliations','/api/skills/overview','/api/mining/refining','/api/material-planner/personal','/api/fitting-workbench/source'].includes(path)||/^\/api\/(characters|operations|inspect)(?:\/|$)/.test(path);}
export function recruitLinksHidden(db,req){return Boolean(req.recruit||req.inspect?.recruitment_only||req.inspect&&recruitAccount(db,req.session.user_id));}
