// Public profiles can retain the previous corporation after a transfer. Use ESI's
// dedicated affiliation response for membership decisions, and verify its identity.
export async function characterAffiliation(eve,character){
 const result=await eve.request('/characters/affiliation',null,'POST',[character]);
 const affiliation=Array.isArray(result?.data)?result.data.find(row=>row.character_id===character):null;
 if(!affiliation||!Number.isSafeInteger(affiliation.corporation_id)||affiliation.corporation_id<=0)throw Error('ESI did not return this pilot’s affiliation');
 return affiliation;
}
export function whitelistService(db, lookup, corporationLookup) {
  const cache=new Map(),pending=new Map(),retryMs=20*60*1000,graceMaxAge=30*60*1000;
  db.exec('CREATE TABLE IF NOT EXISTS login_membership_checks(character_id INTEGER PRIMARY KEY,corporation_id INTEGER,alliance_id INTEGER,checked INTEGER NOT NULL,failures INTEGER NOT NULL DEFAULT 0,retry_at INTEGER NOT NULL DEFAULT 0)');
  const unavailable=()=>Object.assign(Error('Unable to verify corporation or alliance membership with ESI. Please try again shortly.'),{status:503});
  const allowed=(id,alliance)=>Boolean(db.prepare('SELECT 1 FROM login_whitelist WHERE corporation_id=?').get(id)||alliance&&db.prepare("SELECT 1 FROM login_whitelist_entities WHERE kind='alliance' AND entity_id=?").get(alliance));
  // Grace is only for an already signed-in account, and never proves new membership.
  function grace(character){const r=db.prepare('SELECT * FROM login_membership_checks WHERE character_id=?').get(character);if(r?.failures===1&&r.retry_at>Date.now()&&Date.now()-r.checked<=graceMaxAge&&r.corporation_id&&allowed(r.corporation_id,r.alliance_id))return null;throw unavailable();}
  async function membership(character,force=false) {
    const hit=cache.get(character);
    if(!force&&hit&&hit.expires>Date.now())return hit;
    if(pending.has(character))return pending.get(character);
    const task=(async()=>{
      try {
        const data=await lookup(character),id=data?.corporation_id;
        if(!Number.isSafeInteger(id)||id<=0)throw Error('Invalid corporation');
        let alliance=data.alliance_id??null;
        if(alliance===null&&corporationLookup&&db.prepare("SELECT 1 FROM login_whitelist_entities WHERE kind='alliance' LIMIT 1").get())alliance=(await corporationLookup(id))?.alliance_id??null;
        if(alliance!==null&&(!Number.isSafeInteger(alliance)||alliance<=0))throw Error('Invalid alliance');
        const result={id,alliance,expires:Date.now()+300000};cache.set(character,result);return result;
      } catch {throw Object.assign(Error('Unable to verify corporation or alliance membership with ESI. Please try again shortly.'),{status:503});}
      finally {pending.delete(character);}
    })();pending.set(character,task);return task;
  }
  async function corporation(character,force=false){return (await membership(character,force)).id;}
  // A pilot exception permits login, but must not stand in for verified corp/alliance membership.
  async function check(character,force=false,{membershipOnly=false,allowGrace=false}={}) {
    if(!membershipOnly&&db.prepare("SELECT 1 FROM login_whitelist_entities WHERE kind='pilot' AND entity_id=?").get(character))return null;
    const previous=db.prepare('SELECT * FROM login_membership_checks WHERE character_id=?').get(character),fresh=cache.get(character);
    if(allowGrace&&!membershipOnly&&previous?.corporation_id&&previous.failures&&previous.retry_at>Date.now()&&!(fresh&&fresh.expires>Date.now()&&fresh.expires-300000>previous.checked))return grace(character);
    let result;
    try{result=await membership(character,force);}
    catch(error){
      if(allowGrace&&!membershipOnly&&error.status===503){
        const latest=db.prepare('SELECT * FROM login_membership_checks WHERE character_id=?').get(character),now=Date.now();
        // Concurrent API calls share one failed attempt; retry at the twenty-minute outage cadence.
        if(!latest||latest.retry_at<=now)db.prepare('INSERT INTO login_membership_checks(character_id,checked,failures,retry_at) VALUES(?,0,1,?) ON CONFLICT(character_id) DO UPDATE SET failures=login_membership_checks.failures+1,retry_at=excluded.retry_at').run(character,now+(latest?.failures>=1?60000:retryMs));
        return grace(character);
      }
      throw error;
    }
    const {id,alliance}=result;
    db.prepare('INSERT OR REPLACE INTO login_membership_checks VALUES(?,?,?,?,0,0)').run(character,id,alliance,result.expires-300000);
    if(!allowed(id,alliance))
      throw Object.assign(Error('Your login main must be a whitelisted pilot or belong to a whitelisted corporation or alliance.'),{status:403});
    return id;
  }
  return {check,corporation,membership,invalidate:()=>cache.clear()};
}
