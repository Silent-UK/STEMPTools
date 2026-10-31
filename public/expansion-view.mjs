import {eveTitle,plainEveText} from './detail-models.mjs';
import {stackAssetRows} from './asset-tree.mjs';
import {walletView} from './wallet-view.mjs';
export function expansionUI({api,esc,intro,table,num,date,empty,context,refresh,toast}){
 let market={pilot:'',side:'',history:false,state:'',q:''},marketOffset=0;
 let pilots={q:'',title:'',role:'',roleKind:'assigned',hangar:'',wallet:'',details:false,access:true},pilotOffset=0;
 let assets={q:'',location:''},assetOffset=0;
 let wallet={mode:'journal',days:'30',direction:'',q:'',type:''},division='',walletOffset=0;
 let fitPilot=null,fitSearch='';
 const face=(id,name)=>`<span class="pilot-face"><img class="pilot-avatar" src="https://images.evetech.net/characters/${Number(id)}/portrait?size=64" alt="" loading="lazy"><strong>${esc(name)}</strong></span>`;
 const money=n=>n==null?'Unavailable':Number(n).toLocaleString('en-GB',{minimumFractionDigits:2,maximumFractionDigits:2});
 const fullDate=v=>v?new Date(v).toLocaleString('en-GB',{timeZone:'UTC',year:'numeric',month:'short',day:'2-digit',hour:'2-digit',minute:'2-digit'})+' UTC':'Unavailable';
 const label=s=>String(s||'').replaceAll('_',' ');
 const select=(name,options,value)=>`<select name="${name}">${options.map(([id,text])=>`<option value="${esc(id)}" ${String(value)===String(id)?'selected':''}>${esc(text)}</option>`).join('')}</select>`;
 const fresh=d=>`<div class="compact-data-status"><small>${d.updated?'Snapshot '+date(d.updated):'Awaiting data'}</small>${d.error?`<p class="notice error">${esc(d.error)} · Previous data retained where available.</p>`:''}${(d.warnings||[]).map(w=>`<small class="corp-warning">${esc(w)}</small>`).join('')}</div>`;
 const pagination=(offset,total,size,key)=>`<div class="actions"><button data-${key}="${Math.max(0,offset-size)}" ${offset===0?'disabled':''}>Previous</button><small>${total?offset+1:0}–${Math.min(offset+size,total)} of ${total}</small><button data-${key}="${offset+size}" ${offset+size>=total?'disabled':''}>Next</button></div>`;
 function roleDetails(p){
  if(!p.rights)return '<small>Role data unavailable</small>';
  const scopes=[['roles','All Locations'],['roles_at_hq','HQ'],['roles_at_base','Base'],['roles_at_other','Other']];
  const render=(r,grant=false)=>scopes.map(([key,name])=>{if(grant)key=key.replace('roles','grantable_roles');return `<div class="production"><strong>${name}</strong><span>${(r[key]||[]).map(x=>esc(label(x))).join(' · ')||'None Reported'}</span></div>`;}).join('');
  return `<details><summary>Roles${p.rights.all?' · CEO / Director':''}</summary><h3>Direct Assignments</h3>${render(p.direct_roles||{})}<h3>From Assigned Titles</h3>${render(Object.fromEntries(scopes.map(([key])=>[key,p.rights.assigned[key].filter(r=>!p.direct_roles?.[key]?.includes(r))])))}<h3>Grantable Roles · Ability To Assign, Not Personal Access</h3>${render(p.rights.grantable,true)}</details>`;
 }
 function accessDetails(p){
  if(!p.rights)return '<small>Access data unavailable</small>';
  if(p.rights.all)return '<span class="access-chip">CEO / Director · All 7 Hangars / All 7 Wallets</span>';
  return `<div class="access-lines">${p.rights.access.map(a=>`<span class="access-chip"><strong>${esc(a.name)}</strong> · ${esc(a.where)} · ${esc(a.rights.join(' / '))}</span>`).join('')}</div>`+(p.rights.financial_roles.length?`<span class="access-chip">Financial: ${p.rights.financial_roles.map(x=>esc(label(x))).join(', ')}</span>`:'');
 }
 async function render(page){
  const {me,chars}=context();
  if(page==='market'){
   const all=await api('/operations/market'),rows=all.flatMap(p=>[...(p.data?.active||[]),...(market.history?p.data?.history||[]:[])].map(o=>({...o,pilot:p.name,pilot_id:p.id,location:p.data.locations?.[o.location_id]||'Location '+o.location_id}))).filter(o=>(!market.pilot||String(o.pilot_id)===market.pilot)&&(!market.side||(market.side==='buy')===o.is_buy_order)&&(!market.state||o.status===market.state)&&(!market.q||[o.name,o.pilot,o.location].join(' ').toLowerCase().includes(market.q.toLowerCase()))).sort((a,b)=>String(b.issued).localeCompare(String(a.issued))||b.order_id-a.order_id);
   marketOffset=Math.min(marketOffset,Math.max(0,Math.floor((rows.length-1)/100)*100));
   const active=rows.filter(o=>o.status==='active');
   return (all.some(p=>!p.data||p.error)?'<p class="notice">Some pilots have missing or failed Market syncs. Totals cover the available orders. Reconnect pilots missing Market permission, then sync.</p>':'')+intro('Market','Your linked pilots’ buy and sell orders. Include history to see fulfilled, cancelled and expired orders.')+`<form id="personal-market-filter" class="toolbar"><label>Pilot${select('pilot',[['','All Characters'],...chars.map(c=>[c.id,c.name])],market.pilot)}</label><label>Orders${select('side',[['','Buy & Sell'],['buy','Buy'],['sell','Sell']],market.side)}</label><label class="inline"><input type="checkbox" name="history" ${market.history?'checked':''}> Include Completed / Closed Orders</label><label>Status${select('state',[['','All'],['active','Active'],['fulfilled','Fulfilled'],['cancelled','Cancelled'],['expired','Expired'],['closed','Other Closed']],market.state)}</label><input name="q" value="${esc(market.q)}" placeholder="Search item, pilot or location…" aria-label="Search market orders"><button>Apply</button></form><section class="panel compact"><div class="corp-totals"><span>${rows.length} orders</span><span>Active Buy Value: ${money(active.filter(o=>o.is_buy_order).reduce((n,o)=>n+o.price*o.volume_remain,0))} ISK</span><span>Active Sell Value: ${money(active.filter(o=>!o.is_buy_order).reduce((n,o)=>n+o.price*o.volume_remain,0))} ISK</span></div><div class="data-table-scroll">${table(['Pilot','Item','Side','Status','Remaining / Total','Unit Price · ISK','Remaining Value · ISK','Location','Issued'],rows.slice(marketOffset,marketOffset+100).map(o=>`<tr><td>${esc(o.pilot)}${o.is_corporation?'<small>On Behalf Of Corporation</small>':''}</td><td>${esc(o.name)}</td><td>${o.is_buy_order?'Buy':'Sell'}</td><td>${esc(label(o.status))}</td><td>${num(o.volume_remain)} / ${num(o.volume_total)}</td><td class="numeric">${money(o.price)}</td><td class="numeric">${money(o.price*o.volume_remain)}</td><td>${esc(o.location)}</td><td>${fullDate(o.issued)}</td></tr>`))}</div>${!rows.length?empty('No orders match these filters'):''}${pagination(marketOffset,rows.length,100,'market-offset')}</section><details><summary>Market Sync Status</summary>${all.map(p=>`<div class="production"><strong>${esc(p.name)}</strong><span>${p.updated?date(p.updated):'Awaiting First Sync'}${p.error?' · '+esc(p.error):''}</span></div>`).join('')}</details><small>History covers what ESI supplies and Tools retains. Disappearing orders are not assumed fulfilled. Order values exclude fees.</small>`;
  }
  if(page==='corp-pilots'){
   const d=await api('/corporation/pilots'),source=d.rows||[],roles=[...new Set(source.flatMap(p=>Object.values(p.rights?.[pilots.roleKind]||{}).flat()))].sort(),titles=[...new Set(source.flatMap(p=>p.titles.map(t=>t.name)))].sort();
   const options=kind=>[['','All '+(kind==='hangar'?'Hangars':'Wallets')],...Array.from({length:7},(_,i)=>[String(i+1),(d.divisions?.[kind]||[]).find(x=>x.division===i+1)?.name||`${kind==='hangar'?'Hangar':'Wallet'} ${i+1}`])];
   const matches=source.filter(p=>{
    const own=Object.values(p.rights?.[pilots.roleKind]||{}).flat(),access=p.rights?.access||[];
    return (!pilots.q||[p.name,p.ship,p.location,...p.titles.map(t=>plainEveText(t.name)),...own.map(label),...access.map(a=>a.name+' '+a.rights.join(' '))].join(' ').toLowerCase().includes(pilots.q.toLowerCase()))&&(!pilots.title||p.titles.some(t=>t.name===pilots.title))&&(!pilots.role||own.includes(pilots.role)||(pilots.roleKind==='assigned'&&p.rights?.all))&&(!pilots.hangar||access.some(a=>a.kind==='hangar'&&String(a.division)===pilots.hangar))&&(!pilots.wallet||access.some(a=>a.kind==='wallet'&&String(a.division)===pilots.wallet)||Boolean(pilots.wallet&&p.rights?.financial_roles.some(r=>['Accountant','Junior_Accountant'].includes(r))));
   });
   pilotOffset=Math.min(pilotOffset,Math.max(0,Math.floor((matches.length-1)/100)*100));
   return intro('Roles and Access','Titles, assigned roles and reported hangar/wallet division access.')+fresh(d)+`<form id="corp-pilot-filter" class="toolbar"><input name="q" value="${esc(pilots.q)}" placeholder="Search pilots, roles or divisions…" aria-label="Search corporation pilots"><label>Title${select('title',[['','All Titles'],...titles.map(t=>[t,plainEveText(t)])],pilots.title)}</label><label>Role Type${select('roleKind',[['assigned','Assigned'],['grantable','Grantable']],pilots.roleKind)}</label><label>Role${select('role',[['','All Roles'],...roles.map(r=>[r,label(r)])],pilots.role)}</label><label>Hangar${select('hangar',options('hangar'),pilots.hangar)}</label><label>Wallet${select('wallet',options('wallet'),pilots.wallet)}</label><label class="inline"><input type="checkbox" name="details" ${pilots.details?'checked':''}> Show Roles</label><label class="inline"><input type="checkbox" name="access" ${pilots.access?'checked':''}> Show Hangar & Wallet Access</label><button>Apply</button></form><section class="panel compact roles-access"><strong>${matches.length} Pilots</strong><div class="data-table-scroll">${table(['Pilot','Titles','Site',...(pilots.details?['Roles']:[]),...(pilots.access?['Hangar / Wallet Access']:[])],matches.slice(pilotOffset,pilotOffset+100).map(p=>`<tr><td>${face(p.id,p.name)}</td><td class="pilot-titles">${p.titles_available===false?'Unavailable':p.titles.map(t=>`<span>${eveTitle(t.name)}</span>`).join(' · ')||'None Reported'}</td><td>${p.signed_up?'✓':'—'}</td>${pilots.details?`<td>${roleDetails(p)}</td>`:''}${pilots.access?`<td class="division-access">${accessDetails(p)}</td>`:''}</tr>`))}</div>${pagination(pilotOffset,matches.length,100,'pilot-offset')}</section><small>Role and title data describe reported assignments. Location scopes, base assignments, container locks and structure ACLs can affect actual access. Grantable roles indicate permission to assign roles, not personal access. Wallet filters also include Accountant / Junior Accountant financial read roles.</small>`;
  }
  if(page==='corp-assets'){
   const d=await api('/corporation/assets?'+new URLSearchParams({...assets,offset:assetOffset}));
   return intro('Corp Assets','Search corporation stock by item or location. Expand locations to see ships, containers and their contents.')+fresh(d)+`<form id="corp-asset-filter" class="toolbar"><input name="q" value="${esc(assets.q)}" placeholder="Search item or named ship…" aria-label="Search corporation assets"><input name="location" value="${esc(assets.location)}" placeholder="Filter location…" aria-label="Corporation asset location"><button>Search</button></form><section class="panel compact"><div class="panelhead"><strong>${num(d.total)} Matching Stacks</strong><small>${d.locationCount} Locations</small></div>${d.locations.map(l=>`<details class="asset-location compact"><summary>${l.type_id?`<img class="station-picture" src="https://images.evetech.net/types/${Number(l.type_id)}/icon?size=64" alt="" loading="lazy">`:""}<strong>${esc(l.name)}</strong><span> · ${l.items.filter(a=>!a.context).length} Matching Stacks</span></summary>${table(['Item','Quantity','Container / Flag'],stackAssetRows(l.items).map(a=>`<tr><td><span class="icon-label" data-asset-indent="${Math.min(a.depth,12)*16}">${a.depth?'↳ ':''}<img class="eve-icon" src="https://images.evetech.net/types/${Number(a.type_id)}/icon?size=32" alt="" loading="lazy">${esc(a.name)}${a.context?'<small>Context</small>':''}</span></td><td>${num(a.quantity)}</td><td>${a.location_id!==a.root_location_id?'Container '+a.location_id+' · ':''}${esc(a.location_flag)}</td></tr>`))}</details>`).join('')||empty('No matching corporation assets')}${pagination(assetOffset,d.locationCount,20,'corp-asset-offset')}</section>`;
  }
  if(page==='corp-wallet'){
   const d=await api('/corporation/wallet'),rows=d.rows||[],chosen=division?rows.filter(r=>String(r.division)===division):rows;
   const view=walletView(chosen.map(r=>({id:r.division,name:r.name,data:{journal:r.journal,transactions:r.transactions,names:d.names||{}}})),wallet,walletOffset).replace('id="wallet-filter"','id="corp-wallet-filter"').replaceAll('data-wallet-offset','data-corp-wallet-offset').replace('<th>Pilot</th>','<th>Division</th>').replace('Search pilot, description or party','Search division, description or party').replace('includes transfers between your own pilots','includes transfers between corporation divisions');
   return intro('Corporation Wallet','Seven wallet divisions, balances, journal and market transactions. Journal and transactions are shown separately.')+fresh(d)+`<section class="panel compact"><div class="corp-totals"><strong>${rows.length?money(rows.reduce((n,r)=>n+r.balance,0))+' ISK':'Balance Unavailable'}</strong><label>Division${select('division',[['','All Divisions'],...rows.map(r=>[r.division,r.name])],division).replace('<select','<select id="corp-wallet-division"')}</label></div>${table(['Division','Balance · ISK'],rows.map(r=>`<tr><td>${esc(r.name)}</td><td class="numeric">${money(r.balance)}</td></tr>`))}</section>${view}`;
  }
  if(page==='fitting-import'){
   if(!chars.some(c=>c.id===fitPilot))fitPilot=chars[0]?.id;
   const head=intro('Import Saved Fittings','Copy your in-game saved fittings into Tools. Imported fittings are private; EVE fittings are unchanged.','<button data-nav="fittings">← Fittings</button>')+`<form id="saved-fitting-filter" class="toolbar"><label>Pilot${select('pilot',chars.map(c=>[c.id,c.name]),fitPilot)}</label><input name="q" value="${esc(fitSearch)}" placeholder="Search ship or fitting…" aria-label="Search saved fittings"><button>Apply</button></form>`;
   if(!fitPilot)return head+empty('Link a pilot first');
   let rows;try{rows=await api('/characters/'+fitPilot+'/saved-fittings');}catch(e){return head+`<p class="notice error">${esc(e.message)}</p><a href="/auth/login?link=1">Reconnect Pilot</a>`;}
   rows=rows.filter(f=>[f.name,f.ship].join(' ').toLowerCase().includes(fitSearch.toLowerCase()));
   return head+`<section class="panel compact">${table(['Saved Fitting','Ship','Description',''],rows.map(f=>`<tr><td><strong>${esc(f.name)}</strong></td><td>${esc(f.ship)}</td><td>${esc(f.description)}</td><td>${f.document_id?`<button data-document="${esc(f.document_id)}">View Imported</button>`:`<button data-import-saved-fit="${f.id}" ${me.inspect?'disabled':''}>Import</button>`}</td></tr>`))}${!rows.length?empty('No saved fittings match'):''}</section>`;
  }
  return null;
 }
 document.addEventListener('submit',async e=>{
  if(!['personal-market-filter','corp-pilot-filter','corp-asset-filter','corp-wallet-filter','saved-fitting-filter'].includes(e.target.id))return;e.preventDefault();const f=new FormData(e.target);
  if(e.target.id==='personal-market-filter'){market={...Object.fromEntries(f),history:f.has('history')};marketOffset=0;}
  if(e.target.id==='corp-pilot-filter'){pilots={...Object.fromEntries(f),details:f.has('details'),access:f.has('access')};pilotOffset=0;}
  if(e.target.id==='corp-asset-filter'){assets=Object.fromEntries(f);assetOffset=0;}
  if(e.target.id==='corp-wallet-filter'){const next=Object.fromEntries(f);if(next.mode!==wallet.mode)next.type='';wallet=next;walletOffset=0;}
  if(e.target.id==='saved-fitting-filter'){fitPilot=Number(f.get('pilot'));fitSearch=String(f.get('q')||'');}
  try{await refresh();}catch(e){toast(e.message);}
 });
 document.addEventListener('change',async e=>{
  if(e.target.id==='corp-wallet-division'){division=e.target.value;walletOffset=0;await refresh();}
  if(e.target.name==='roleKind'&&e.target.closest('#corp-pilot-filter')){pilots={...Object.fromEntries(new FormData(e.target.form)),details:e.target.form.elements.details.checked,access:e.target.form.elements.access.checked,role:''};await refresh();}
 });
 document.addEventListener('click',async e=>{
  const b=e.target.closest('button');if(!b)return;
  try{
   if(b.dataset.importSavedFit){b.disabled=true;await api('/characters/'+fitPilot+'/saved-fittings/'+b.dataset.importSavedFit+'/import',{});toast('Fitting imported privately into Tools.');await refresh();}
   for(const [key,set] of Object.entries({marketOffset:n=>marketOffset=n,pilotOffset:n=>pilotOffset=n,corpAssetOffset:n=>assetOffset=n,corpWalletOffset:n=>walletOffset=n}))if(b.dataset[key]!==undefined){set(Number(b.dataset[key]));await refresh();}
  }catch(e){b.disabled=false;toast(e.message);}
 });
 return {render};
}
