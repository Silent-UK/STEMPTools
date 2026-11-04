// Public profiles can retain the previous corporation after a transfer. Use ESI's
// dedicated affiliation response for membership decisions, and verify its identity.
export async function characterAffiliation(eve,character){
 const result=await eve.request('/characters/affiliation',null,'POST',[character]);
 const affiliation=Array.isArray(result?.data)?result.data.find(row=>row.character_id===character):null;
 if(!affiliation||!Number.isSafeInteger(affiliation.corporation_id)||affiliation.corporation_id<=0)throw Error('ESI did not return this pilot’s affiliation');
 return affiliation;
}
export function whitelistService(db, lookup, corporationLookup) {
  const cache=new Map(),pending=new Map();
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
  async function check(character,force=false) {
    if(db.prepare("SELECT 1 FROM login_whitelist_entities WHERE kind='pilot' AND entity_id=?").get(character))return null;
    const {id,alliance}=await membership(character,force);
    if(!db.prepare('SELECT 1 FROM login_whitelist WHERE corporation_id=?').get(id)&&!(alliance&&db.prepare("SELECT 1 FROM login_whitelist_entities WHERE kind='alliance' AND entity_id=?").get(alliance)))
      throw Object.assign(Error('Your login main must be a whitelisted pilot or belong to a whitelisted corporation or alliance.'),{status:403});
    return id;
  }
  return {check,corporation,membership,invalidate:()=>cache.clear()};
}
