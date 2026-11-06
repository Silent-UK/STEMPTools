// A denied structure can be accessible to another pilot. Never share its failure globally.
export function esiLocationBackoff(db){
 db.exec('CREATE TABLE IF NOT EXISTS esi_location_failures(actor TEXT NOT NULL,path TEXT NOT NULL,status INTEGER NOT NULL,expires INTEGER NOT NULL,PRIMARY KEY(actor,path))');
 db.prepare('DELETE FROM esi_location_failures WHERE expires<=?').run(Date.now());
 const pathKey=path=>/^\/universe\/(structures|stations)\/\d+\/?$/.test(path)?path.replace(/\/$/,''):null;
 function get(path,actor){const key=pathKey(path);return key?db.prepare('SELECT status,expires FROM esi_location_failures WHERE actor=? AND path=? AND expires>?').get(actor,key,Date.now()):null;}
 function record(path,actor,status){const key=pathKey(path);if(!key)return;
  if(status>=200&&status<300){db.prepare('DELETE FROM esi_location_failures WHERE actor=? AND path=?').run(actor,key);return;}
  if(status!==404&&!(status===403&&key.startsWith('/universe/structures/')))return;
  db.prepare('INSERT INTO esi_location_failures VALUES(?,?,?,?) ON CONFLICT(actor,path) DO UPDATE SET status=excluded.status,expires=excluded.expires').run(actor,key,status,Date.now()+86400000);
 }
 const error=saved=>Object.assign(Error('Location lookup paused after ESI HTTP '+saved.status+'; recheck after '+new Date(saved.expires).toISOString()),{status:saved.status,cached_location_error:true,retry_at:saved.expires});
 return {get,record,error};
}

// CCP location reference: 2004 is Asset Safety; NPC station IDs are 60000000–63999999.
export function localStationLookup(path){
 const match=/^\/universe\/stations\/(\d+)\/?$/.exec(path);if(!match)return null;
 const id=Number(match[1]);if(id===2004)return {name:'Asset Safety'};
 if(!Number.isSafeInteger(id)||id<60000000||id>=64000000)throw Object.assign(Error('Location is not a station ID; no ESI station request made'),{status:404,invalid_location:true});
 return null;
}
