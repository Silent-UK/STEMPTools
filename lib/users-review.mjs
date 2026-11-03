import {isSiteAdmin} from './admin.mjs';
import {recruitAccount} from './recruitment-store.mjs';
import {wipeAccount} from './accounts.mjs';
export function usersReviewService(db,whitelist,config){
 db.exec(`CREATE TABLE IF NOT EXISTS user_whitelist_reviews(user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,status TEXT NOT NULL,checked INTEGER NOT NULL DEFAULT 0,message TEXT NOT NULL DEFAULT '');`);
 let busy=false;
 const exemption=user=>isSiteAdmin(user,config.owner)?'Protected admin':recruitAccount(db,user.id)?'Active recruitment application':null;
 function start(){for(const user of db.prepare('SELECT * FROM users').all()){const reason=exemption(user);db.prepare('INSERT INTO user_whitelist_reviews VALUES(?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET status=excluded.status,checked=excluded.checked,message=excluded.message').run(user.id,reason?'protected':'pending',reason?Date.now():0,reason||'Queued');}return {queued:db.prepare("SELECT COUNT(*) n FROM user_whitelist_reviews WHERE status='pending'").get().n};}
 async function tick(){if(busy)return;busy=true;try{const users=db.prepare("SELECT u.* FROM users u JOIN user_whitelist_reviews r ON r.user_id=u.id WHERE r.status='pending' ORDER BY u.id LIMIT 4").all();await Promise.all(users.map(async user=>{let status='allowed',message='Login main meets the whitelist';const reason=exemption(user);if(reason){status='protected';message=reason;}else try{await whitelist.check(user.main_id,true);}catch(e){status=e.status===403?'denied':'unknown';message=status==='denied'?'Login main no longer meets the whitelist':'ESI verification unavailable; no deletion is permitted.';}db.prepare('UPDATE user_whitelist_reviews SET status=?,checked=?,message=? WHERE user_id=?').run(status,Date.now(),message,user.id);}));}finally{busy=false;}}
 async function remove(actor,id,confirm){if(actor.main_id!==config.owner)throw Object.assign(Error('Only the site owner can delete accounts.'),{status:403});const user=db.prepare('SELECT * FROM users WHERE id=?').get(id);if(!user)throw Object.assign(Error('Account not found.'),{status:404});if(user.id===actor.user_id||exemption(user))throw Object.assign(Error('Admins, your own account and active recruits are protected from whitelist cleanup.'),{status:400});if(confirm!==user.main_id)throw Object.assign(Error('Confirm the exact account before deleting it.'),{status:400});try{await whitelist.check(user.main_id,true);throw Object.assign(Error('This account still meets the whitelist.'),{status:400});}catch(e){if(e.status!==403)throw e;}
  // The remote check may take time: re-read identity and protection before deleting.
  const current=db.prepare('SELECT * FROM users WHERE id=?').get(id);if(!current||current.main_id!==confirm||exemption(current))throw Object.assign(Error('Account changed during verification. Refresh and review again.'),{status:409});return wipeAccount(db,id);
 }
 return {start,tick,remove};
}
