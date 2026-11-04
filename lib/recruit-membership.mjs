import {recruitAccount} from './recruitment-store.mjs';
export function recruitMembershipService(db,whitelist,{onJoined=()=>{}}={}){
 const due=new Map(),pending=new Map();let busy=false;
 function verified(userId,mainId,now=Date.now()){
  if(!recruitAccount(db,userId))return false;
  const user=db.prepare('SELECT main_id FROM users WHERE id=?').get(userId);if(!user||user.main_id!==mainId)return false;
  const changed=db.prepare("UPDATE recruitment_applications SET status='joined',joined_at=COALESCE(joined_at,?) WHERE user_id=? AND status IN ('applied','reviewing','accepted')").run(now,userId).changes>0;if(changed)onJoined(userId,now);return changed;
 }
 async function check(userId){
  if(pending.has(userId))return pending.get(userId);
  const user=db.prepare('SELECT main_id FROM users WHERE id=?').get(userId);if(!user||!recruitAccount(db,userId))return false;
  due.set(userId,Date.now()+300000);
  const work=(async()=>{try{await whitelist.check(user.main_id,true);return verified(userId,user.main_id);}catch{return false;}finally{pending.delete(userId);}})();pending.set(userId,work);return work;
 }
 async function tick(){if(busy)return;busy=true;try{const now=Date.now(),rows=db.prepare("SELECT user_id FROM recruitment_applications WHERE status IN ('applied','reviewing','accepted') ORDER BY created,user_id").all(),active=new Set(rows.map(r=>r.user_id));for(const id of due.keys())if(!active.has(id))due.delete(id);await Promise.all(rows.filter(r=>(due.get(r.user_id)||0)<=now).sort((a,b)=>(due.get(a.user_id)||0)-(due.get(b.user_id)||0)).slice(0,4).map(r=>check(r.user_id)));}finally{busy=false;}}
 return {verified,tick};
}
