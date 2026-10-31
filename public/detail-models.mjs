const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const plainEveText=s=>String(s||'').replace(/<[^>]*>/g,'');
export function eveTitle(text){
 let color=null,result='';
 for(const part of String(text||'').split(/(<[^>]*>)/g)){
  if(!part)continue;
  if(part.startsWith('<')){const match=/^<color=0x([a-f0-9]{8})>$/i.exec(part);if(match)color='#'+match[1].slice(2)+match[1].slice(0,2);else if(/^<\/color>$/i.test(part))color=null;continue;}
  result+=color?`<span data-eve-color="${color}">${escape(part)}</span>`:escape(part);
 }
 return result;
}
export function rattingDisplayRows(rows,chars,showAlts){
 const parent=id=>{const c=chars.find(c=>c.id===id);return c?.parent_id||id;};
 if(showAlts)return rows.map(r=>({...r,alt:parent(r.id)!==r.id})).sort((a,b)=>parent(a.id)-parent(b.id)||Number(a.alt)-Number(b.alt)||b.total-a.total);
 const groups=new Map();for(const r of rows){const id=parent(r.id),main=chars.find(c=>c.id===id);if(!groups.has(id))groups.set(id,{id,name:main?.name||r.name,total:0,alts:0});const g=groups.get(id);g.total+=r.total;if(r.id!==id)g.alts++;}
 return [...groups.values()].sort((a,b)=>b.total-a.total);
}
export function memberGroups(rows,sort='name',grouped=false){
 const compare=(a,b)=>{
  if(sort==='last_active'){const av=Date.parse(a.last_active),bv=Date.parse(b.last_active);return (Number.isFinite(bv)?bv:0)-(Number.isFinite(av)?av:0)||a.name.localeCompare(b.name);}
  if(sort==='registered')return Number(b.signed_up)-Number(a.signed_up)||a.name.localeCompare(b.name);
  return String(a[sort]||'').localeCompare(String(b[sort]||''))||a.name.localeCompare(b.name);
 };
 if(!grouped)return [...rows].sort(compare).map(r=>({key:r.id,rows:[r]}));
 const groups=new Map();for(const row of rows){const key=row.account_main_id?'account:'+row.account_main_id:'pilot:'+row.id;if(!groups.has(key))groups.set(key,{key,main_id:row.account_main_id||row.id,name:row.account_main_name||row.name,rows:[]});groups.get(key).rows.push(row);}
 return [...groups.values()].map(g=>({...g,rows:g.rows.sort((a,b)=>Number(b.id===g.main_id)-Number(a.id===g.main_id)||compare(a,b))})).sort((a,b)=>compare(sort==='last_active'?a.rows.reduce((x,y)=>compare(x,y)<=0?x:y):{...a.rows[0],name:a.name},sort==='last_active'?b.rows.reduce((x,y)=>compare(x,y)<=0?x:y):{...b.rows[0],name:b.name}));
}
