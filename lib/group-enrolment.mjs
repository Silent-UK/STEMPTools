import {eligible,groupList} from './management.mjs';
export function groupEnrolmentService(db,whitelist){
 const pending=new Map(),due=new Map(),retry=new Map();let busy=false;
 async function check(user){
  if(pending.has(user))return pending.get(user);
  const work=(async()=>{
   const groups=groupList(db,user).filter(g=>g.mode==='auto-enrol'||g.mode==='restricted'&&g.rules.some(r=>r.kind==='corporation'));if(!groups.length)return;
   if(groups.some(g=>g.rules.some(r=>r.kind==='corporation'))){
    for(const c of db.prepare('SELECT id FROM characters WHERE user_id=?').all(user)){
     const old=db.prepare('SELECT expires FROM group_affiliations WHERE character_id=?').get(c.id);if(old?.expires>Date.now()||(retry.get(c.id)||0)>Date.now())continue;
     try{const a=await whitelist.membership(c.id);if(db.prepare('SELECT 1 FROM characters WHERE id=? AND user_id=?').get(c.id,user))db.prepare('INSERT OR REPLACE INTO group_affiliations VALUES(?,?,?)').run(c.id,a.id,a.expires);}
     catch{retry.set(c.id,Date.now()+60000);db.prepare('DELETE FROM group_affiliations WHERE character_id=?').run(c.id);}
    }
   }
   if(!db.prepare('SELECT 1 FROM users WHERE id=?').get(user))return;
   // Re-read configuration and decisions after external lookups; a manual rejection is a veto.
   for(const g of groupList(db,user).filter(g=>g.mode==='auto-enrol')){
    if(g.status==='rejected')continue;
    const status=eligible(db,user,g.rules)?'approved':'ineligible';
    if(g.status!==status&&(status==='approved'||g.status))db.prepare("INSERT INTO group_members VALUES(?,?,?) ON CONFLICT(group_id,user_id) DO UPDATE SET status=excluded.status WHERE group_members.status<>'rejected'").run(g.id,user,status);
   }
  })();pending.set(user,work);try{await work;}finally{pending.delete(user);due.set(user,Date.now()+300000);}
 }
 async function tick(){if(busy||!db.prepare("SELECT 1 FROM access_groups WHERE mode='auto-enrol'").get())return;busy=true;try{const now=Date.now();await Promise.all(db.prepare('SELECT id FROM users ORDER BY id').all().filter(u=>(due.get(u.id)||0)<=now).sort((a,b)=>(due.get(a.id)||0)-(due.get(b.id)||0)).slice(0,4).map(u=>check(u.id)));}finally{busy=false;}}
 return {check,tick,invalidate(){due.clear();}};
}
