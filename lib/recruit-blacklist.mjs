import {recruitmentConfig} from './recruitment-store.mjs';
export const pilotKey=name=>String(name??'').trim().replace(/\s+/g,' ').toLowerCase();
export function parseCsv(text){
 const rows=[];let row=[],field='',quoted=false;
 for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){field+='"';i++;}else quoted=!quoted;}else if(c===','&&!quoted){row.push(field.trim());field='';}else if(/[\r\n]/.test(c)&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(field.trim());if(row.some(Boolean))rows.push(row);row=[];field='';}else field+=c;}
 if(quoted)throw Error('Unterminated CSV field.');row.push(field.trim());if(row.some(Boolean))rows.push(row);return rows;
}
export function blacklistEntries(text){
 if(text.length>8_000_000||/^\s*</.test(text))throw Error('The spreadsheet did not return a valid CSV export.');
 const rows=parseCsv(text.replace(/^\uFEFF/,'')),entries=new Map();
 for(const row of rows.slice(1))for(const column of [0,5,6,7])for(const cell of (row[column]||'').split(/[\r\n,;|]+/)){
  const name=cell.trim().replace(/^~+\s*/,'').replace(/\s*\((?:corp|alliance)\)\s*/gi,' ').replace(/\s+/g,' ').trim();if(!name)continue;
  const key=pilotKey(name),entry=entries.get(key)||{name,key,reasons:new Set(),columns:new Set()};if(row[3])entry.reasons.add(row[3]);entry.columns.add(['A','B','C','D','E','F','G','H'][column]);entries.set(key,entry);
 }
 if(!entries.size)throw Error('No pilot names were found in columns A, F, G or H. Previous blacklist retained.');
 return [...entries.values()].map(e=>({...e,reason:[...e.reasons].join('; '),columns:[...e.columns]}));
}
export function blacklistService(db,{network=fetch,contact='Tools'}={}){
 let busy=false;
 async function sync(force=false){
  const previous=db.prepare('SELECT * FROM recruitment_blacklist_sync WHERE id=1').get(),now=Date.now();
  if(busy||(!force&&(previous.updated>now-7*86400000||previous.attempted>now-3600000)))return;
  busy=true;db.prepare('UPDATE recruitment_blacklist_sync SET attempted=? WHERE id=1').run(now);
  try{
   const config=recruitmentConfig(db),url=`https://docs.google.com/spreadsheets/d/${config.sheet}/export?format=csv&gid=${config.gid}`;
   const response=await network(url,{headers:{'User-Agent':'Tools recruitment ('+contact+')'},signal:AbortSignal.timeout(30000)});if(!response.ok)throw Error('Google Sheet returned HTTP '+response.status+'.');
   const entries=blacklistEntries(await response.text()),ids=new Map();
   // Resolve IDs when available; full unresolved names remain valid blacklist entries.
   for(let i=0;i<entries.length;i+=100){
    const r=await network('https://esi.evetech.net/latest/universe/ids/',{method:'POST',headers:{'Content-Type':'application/json','User-Agent':'Tools recruitment ('+contact+')'},body:JSON.stringify(entries.slice(i,i+100).map(e=>e.name)),signal:AbortSignal.timeout(30000)});
    if(!r.ok)throw Error('Blacklist ID lookup returned HTTP '+r.status+'. Previous blacklist retained.');
    const body=await r.json();for(const p of body.characters||[])if(Number.isSafeInteger(p.id))ids.set(pilotKey(p.name),p.id);
   }
   db.exec('BEGIN IMMEDIATE');try{db.prepare('DELETE FROM recruitment_blacklist').run();const put=db.prepare('INSERT INTO recruitment_blacklist VALUES(?,?,?,?,?)');for(const e of entries)put.run(e.key,e.name,ids.get(e.key)||null,e.reason,JSON.stringify(e.columns));db.prepare('UPDATE recruitment_blacklist_sync SET updated=?,error=NULL WHERE id=1').run(Date.now());db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}
  }catch(e){db.prepare('UPDATE recruitment_blacklist_sync SET error=? WHERE id=1').run(String(e.message).slice(0,300));}finally{busy=false;}
 }
 return {sync,status:()=>({...db.prepare('SELECT * FROM recruitment_blacklist_sync WHERE id=1').get(),count:db.prepare('SELECT count(*) n FROM recruitment_blacklist').get().n,busy})};
}
