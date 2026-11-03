export function userRole(user){return user.owner?'owner':user.admin?'admin':user.recruit?'recruit':'member';}
export function filterUsers(users,{q='',role='',sort='online-desc',whitelist=''}={},affiliations={}){
 const search=q.trim().toLocaleLowerCase();
 const matchesRole=u=>!role||(role.startsWith('group:')?u.groups?.some(g=>g.status==='approved'&&String(g.id)===role.slice(6)):userRole(u)===role);
 const rows=users.filter(u=>matchesRole(u)&&(!whitelist||u.whitelist?.status===whitelist)&&(!search||[u.name,String(u.main_id),...u.characters.flatMap(c=>[c.name,String(c.id),affiliations[c.id]?.corporation_name||'']),...(u.groups||[]).map(g=>g.name)].join(' ').toLocaleLowerCase().includes(search)));
 const name=(a,b)=>a.name.localeCompare(b.name,undefined,{sensitivity:'base'})||a.id-b.id;
 return rows.sort((a,b)=>{if(sort==='name-asc')return name(a,b);if(sort==='name-desc')return name(b,a);if(sort==='chars-desc')return b.characters.length-a.characters.length||name(a,b);if(sort==='chars-asc')return a.characters.length-b.characters.length||name(a,b);const x=a.last_online||0,y=b.last_online||0;if(!x||!y)return (x?0:1)-(y?0:1)||name(a,b);return (sort==='online-asc'?x-y:y-x)||name(a,b);});
}
