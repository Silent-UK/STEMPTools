import {transaction} from './store.mjs';
export function wipeAccount(db,userId){
 return transaction(db,()=>{
  const pilots=db.prepare('SELECT id,owner_hash FROM characters WHERE user_id=?').all(userId);
  const grant=db.prepare('SELECT character_id id,owner_hash FROM corp_authorizations WHERE user_id=?').get(userId);
  for(const c of [...pilots,...(grant?[grant]:[])]){
   db.prepare('DELETE FROM corporation_connections WHERE character_id=? AND owner_hash=?').run(c.id,c.owner_hash);
   db.prepare('DELETE FROM corp_http_cache WHERE character_id=?').run(c.id);
  }
  db.prepare('DELETE FROM inspections WHERE target_id=? OR session_id IN (SELECT id FROM sessions WHERE user_id=?)').run(userId,userId);
  db.prepare('DELETE FROM sessions WHERE user_id=?').run(userId);
  db.prepare('DELETE FROM oauth WHERE user_id=?').run(userId);
  db.prepare('DELETE FROM fitting_plans WHERE user_id=?').run(userId);
  db.prepare('DELETE FROM documents WHERE owner=?').run(userId);
  db.prepare('DELETE FROM user_activity WHERE user_id=?').run(userId);
  db.prepare('DELETE FROM user_logins WHERE user_id=?').run(userId);
  db.prepare('DELETE FROM characters WHERE user_id=?').run(userId);
  const legacyColumns=db.prepare("PRAGMA table_info(invites)").all().map(c=>c.name);
  if(legacyColumns.includes('created_by')&&legacyColumns.includes('used_by'))db.prepare('DELETE FROM invites WHERE created_by=? OR used_by=?').run(userId,userId);
  db.prepare('DELETE FROM users WHERE id=?').run(userId);
  // This cache embeds registration/account associations; the corporation data itself is shared.
  db.prepare("DELETE FROM public_cache WHERE path='/tools/corp-data/pilots'").run();
  return {deleted:true,characters:pilots.length};
 });
}
