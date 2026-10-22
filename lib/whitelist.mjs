export function whitelistService(db, lookup) {
  const cache=new Map(),pending=new Map();
  async function corporation(character,force=false) {
    const hit=cache.get(character);
    if(!force&&hit&&hit.expires>Date.now())return hit.id;
    if(pending.has(character))return pending.get(character);
    const task=(async()=>{
      try {
        const data=await lookup(character),id=data?.corporation_id;
        if(!Number.isSafeInteger(id)||id<=0)throw Error('Invalid corporation');
        cache.set(character,{id,expires:Date.now()+300000});
        return id;
      } catch {throw Object.assign(Error('Unable to verify corporation membership with ESI. Please try again shortly.'),{status:503});}
      finally {pending.delete(character);}
    })();
    pending.set(character,task);return task;
  }
  async function check(character,force=false) {
    const id=await corporation(character,force);
    if(!db.prepare('SELECT 1 FROM login_whitelist WHERE corporation_id=?').get(id))
      throw Object.assign(Error('Your login main must belong to a whitelisted corporation.'),{status:403});
    return id;
  }
  return {check,corporation};
}
