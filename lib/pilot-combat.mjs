const DAY=86400000;
export function combatSummary(character,rows,names={},cat,now=Date.now()){
 const account=new Set(Array.isArray(character)?character:[character]);
 const year=new Date(now).getUTCFullYear(),start=Date.UTC(year,0,1),unique=new Map(rows.map(r=>[r.killmail_id,r])),ships=new Map(),areas=new Map(),targets=new Map();
 const windows={year:{kills:0,losses:0},days30:{kills:0,losses:0},days7:{kills:0,losses:0}};
 const bump=(map,id,key)=>{if(!id)return;const row=map.get(id)||{id,kills:0,losses:0};row[key]++;map.set(id,row);};
 for(const row of unique.values()){
  const at=Date.parse(row.killmail_time);if(!Number.isFinite(at)||at<Math.min(start,now-30*DAY)||at>now)continue;
  const loss=account.has(row.victim?.character_id),attackers=(row.attackers||[]).filter(a=>account.has(a.character_id)&&a.character_id!==row.victim?.character_id),attacker=attackers[0];if(!loss&&!attacker)continue;
  for(const key of [...(loss?['losses']:[]),...(attacker?['kills']:[])]){if(at>=start)windows.year[key]++;if(at>=now-30*DAY)windows.days30[key]++;if(at>=now-7*DAY)windows.days7[key]++;
  if(at<start)continue;
  for(const ship of new Set(key==='losses'?[row.victim.ship_type_id]:attackers.map(a=>a.ship_type_id)))bump(ships,ship,key);bump(areas,row.solar_system_id,key);
  if(key==='kills'){for(const kind of ['corporation','alliance']){const id=row.victim[kind+'_id'];if(id){const k=kind+':'+id,v=targets.get(k)||{id,kind,kills:0};v.kills++;targets.set(k,v);}}}
 }
 }
 const ranked=map=>[...map.values()].sort((a,b)=>(b.kills+b.losses)-(a.kills+a.losses));
 return {year,windows,ships:ranked(ships).map(s=>({...s,name:cat?.type(s.id)?.name||names[s.id]||'Type '+s.id})),areas:ranked(areas).map(s=>({...s,name:names[s.id]||'System '+s.id})),targets:[...targets.values()].sort((a,b)=>b.kills-a.kills).map(t=>({...t,name:names[t.id]||t.kind+' '+t.id})),records:unique.size,note:'Public zKillboard records for this calendar year, with previous December included when needed for rolling windows. Private or unreported killmails are not included; kills show participation, not necessarily the final blow.'};
}
export function pilotCombatService(db,eve,cat,{network=fetch,contact='Tools'}={}){
 let busy=false;const ua={'User-Agent':'Tools recruitment ('+contact+')'};
 function view(c,refresh=false){
  const saved=db.prepare('SELECT * FROM recruitment_combat WHERE character_id=?').get(c.id),parsed=saved?JSON.parse(saved.data):null;
  if((refresh||!saved||saved.updated<Date.now()-6*3600000||parsed?.year!==new Date().getUTCFullYear())&&!db.prepare('SELECT 1 FROM recruitment_combat_jobs WHERE character_id=?').get(c.id)){
   db.prepare('INSERT INTO recruitment_combat_jobs VALUES(?,?,?,?,?,NULL,0)').run(c.id,JSON.stringify({phase:'pages',year:new Date().getUTCFullYear(),month:new Date().getUTCMonth()+1,page:1}), 'queued',0,Date.now());
   db.prepare('DELETE FROM recruitment_combat_stage WHERE character_id=?').run(c.id);
  }
  const summary=parsed?combatSummary(c.id,parsed.rows,parsed.names,cat):null;if(summary&&parsed.namesIncomplete)summary.note+=' Some entity names could not be resolved; IDs are shown instead.';
  return {data:summary,updated:saved?.updated||null,job:db.prepare('SELECT status,updated,error,json_extract(state,\'$.phase\') phase,json_extract(state,\'$.month\') month,json_extract(state,\'$.page\') page FROM recruitment_combat_jobs WHERE character_id=?').get(c.id)||null};
 }
 async function get(url){const r=await network(url,{headers:ua,signal:AbortSignal.timeout(30000)});if(!r.ok){const e=Error('Combat service returned HTTP '+r.status+'. Saved results retained.');e.retryAfter=Math.max(60,Number(r.headers.get('retry-after'))||60)*1000;throw e;}return r.json();}
 async function tick(){
  if(busy)return;const job=db.prepare('SELECT * FROM recruitment_combat_jobs WHERE next_due<=? ORDER BY updated LIMIT 1').get(Date.now());if(!job)return;
  busy=true;const s=JSON.parse(job.state),id=job.character_id;
  function exists(){return db.prepare('SELECT 1 FROM characters WHERE id=?').get(id);}
  function save(){if(!exists())return;db.prepare("UPDATE recruitment_combat_jobs SET state=?,status='queued',next_due=?,updated=?,error=NULL,failures=0 WHERE character_id=?").run(JSON.stringify(s),Date.now()+2000,Date.now(),id);}
  function put(mail){if(!Number.isSafeInteger(mail.killmail_id)||!mail.victim||!Array.isArray(mail.attackers)||!Number.isFinite(Date.parse(mail.killmail_time)))throw Error('Incomplete killmail; previous totals retained.');if(!exists())return;const trim=e=>({character_id:e.character_id,corporation_id:e.corporation_id,alliance_id:e.alliance_id,ship_type_id:e.ship_type_id});db.prepare('INSERT OR REPLACE INTO recruitment_combat_stage VALUES(?,?,?)').run(id,mail.killmail_id,JSON.stringify({killmail_id:mail.killmail_id,killmail_time:mail.killmail_time,solar_system_id:mail.solar_system_id,victim:trim(mail.victim),attackers:mail.attackers.map(trim)}));}
  try{
   if(s.phase==='pages'){
    const rows=await get(`https://zkillboard.com/api/characterID/${id}/year/${s.crawlYear||s.year}/month/${s.month}/page/${s.page}/`);if(!Array.isArray(rows)||rows.length>200)throw Error('Invalid zKillboard page.');
    if(s.page>=100&&rows.length===200)throw Error('zKillboard page limit reached. Coverage is incomplete; previous results retained.');
    s.pending=rows;s.cursor=0;s.phase='details';save();return;
   }
   if(s.phase==='details'){
    while(s.cursor<s.pending.length&&s.pending[s.cursor].killmail_time&&s.pending[s.cursor].victim&&Array.isArray(s.pending[s.cursor].attackers)){put(s.pending[s.cursor]);s.cursor++;}
    if(s.cursor<s.pending.length){let row=s.pending[s.cursor];if(!row.killmail_time||!row.victim||!Array.isArray(row.attackers)){if(!Number.isSafeInteger(row.killmail_id)||!/^[-a-zA-Z0-9]+$/.test(row.zkb?.hash||''))throw Error('Killmail reference is incomplete.');row={...await get('https://esi.evetech.net/latest/killmails/'+row.killmail_id+'/'+row.zkb.hash+'/'),killmail_id:row.killmail_id};}put(row);s.cursor++;save();return;}
    const full=s.pending.length===200;delete s.pending;delete s.cursor;if(full)s.page++;else{if(s.previous)s.month=0;else{s.month--;if(s.month===0&&new Date(Date.now()-30*DAY).getUTCFullYear()<s.year){s.previous=true;s.crawlYear=s.year-1;s.month=12;}}s.page=1;}s.phase=s.month>0?'pages':'names';s.offset=0;s.names={};save();return;
   }
   const rows=db.prepare('SELECT data FROM recruitment_combat_stage WHERE character_id=? ORDER BY killmail_id').all(id).map(r=>JSON.parse(r.data));
   const ids=[...new Set(rows.flatMap(r=>[r.solar_system_id,r.victim.corporation_id,r.victim.alliance_id]).filter(v=>Number.isSafeInteger(v)&&v>0))].sort((a,b)=>a-b);
   if(s.offset<ids.length){const batch=ids.slice(s.offset,s.offset+100);try{const r=await eve.request('/universe/names',null,'POST',batch);if(!Array.isArray(r.data))throw Error('Invalid entity names response.');for(const n of r.data)s.names[n.id]=n.name;}catch{s.namesIncomplete=true;}s.offset+=batch.length;save();return;}
   if(!exists())return;db.prepare('INSERT INTO recruitment_combat VALUES(?,?,?) ON CONFLICT(character_id) DO UPDATE SET data=excluded.data,updated=excluded.updated').run(id,JSON.stringify({year:s.year,rows,names:s.names,namesIncomplete:s.namesIncomplete||false}),Date.now());db.prepare('DELETE FROM recruitment_combat_jobs WHERE character_id=?').run(id);db.prepare('DELETE FROM recruitment_combat_stage WHERE character_id=?').run(id);
  }catch(e){db.prepare("UPDATE recruitment_combat_jobs SET status='retrying',error=?,failures=failures+1,next_due=?,updated=? WHERE character_id=?").run(String(e.message).slice(0,300),Date.now()+Math.max(e.retryAfter||60000,Math.min(3600000,30000*2**Math.min(job.failures,7))),Date.now(),id);}finally{busy=false;}
 }
 return {view,tick};
}
