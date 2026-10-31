import {assetMatches,markEmptyOffices} from '../public/asset-tree.mjs';
export function pilotAccess(role={},titles=[],divisions={},ceo=false){
 const scopes=['roles','roles_at_hq','roles_at_base','roles_at_other'];
 const assigned=Object.fromEntries(scopes.map(k=>[k,[...new Set([...(role[k]||[]),...titles.flatMap(t=>t[k]||[])])]]));
 const all=ceo||Object.values(assigned).some(r=>r.includes('Director'));
 const named=(kind,n)=>(divisions[kind]||[]).find(d=>d.division===n)?.name||`${kind==='hangar'?'Hangar':'Wallet'} ${n}`;
 const access=[];
 for(const scope of scopes){
  const roles=assigned[scope],where=({roles:'All Locations',roles_at_hq:'HQ',roles_at_base:'Base',roles_at_other:'Other'})[scope];
  for(let n=1;n<=7;n++){
   if((all&&scope==='roles')||roles.some(r=>['Hangar_Query_'+n,'Hangar_Take_'+n,'Container_Take_'+n].includes(r)))access.push({kind:'hangar',division:n,name:named('hangar',n),where,rights:all&&scope==='roles'?['Query','Take','Container Take']:['Query','Take','Container Take'].filter((_,i)=>roles.includes(['Hangar_Query_','Hangar_Take_','Container_Take_'][i]+n))});
   if((all&&scope==='roles')||roles.includes('Account_Take_'+n))access.push({kind:'wallet',division:n,name:named('wallet',n),where,rights:['Take']});
  }
 }
 const grantable=Object.fromEntries(scopes.map(k=>{const g=k.replace('roles','grantable_roles');return [g,[...new Set([...(role[g]||[]),...titles.flatMap(t=>t[g]||[])])]];}));
 return {assigned,grantable,access,all,financial_roles:[...new Set(Object.values(assigned).flat().filter(r=>['Accountant','Junior_Accountant','Trader'].includes(r)))]};
}
export function corpDataService({db,cat,eve,request,pages,access,members,snapshot,id}){
 const pending=new Map();
 async function source(scope){
  for(const row of db.prepare('SELECT * FROM corp_authorizations WHERE corporation_id=? ORDER BY verified DESC').all(id))if(JSON.parse(row.scopes).includes(scope)&&await access(row.user_id))return row;
  throw Object.assign(Error('Reconnect Corp ESI to grant '+scope+'.'),{status:403});
 }
 async function namedDivisions(){const row=await source('esi-corporations.read_divisions.v1');const r=(await request('/corporations/'+id+'/divisions',row)).data;if(!r||typeof r!=='object'||Array.isArray(r))throw Error('Invalid divisions');return r;}
 async function cached(key,scope,collect){
  const row=await source(scope),path='/tools/corp-data/'+key,old=db.prepare('SELECT * FROM public_cache WHERE path=?').get(path);
  if(old?.expires>Date.now())return JSON.parse(old.data);
  if(pending.has(key))return pending.get(key);
  const job=(async()=>{let result;try{result={...await collect(row,old?JSON.parse(old.data):null),updated:Date.now(),error:null};}catch(e){result={...(old?JSON.parse(old.data):{rows:[],updated:null}),error:e.message};}
   db.prepare('INSERT INTO public_cache VALUES(?,?,?) ON CONFLICT(path) DO UPDATE SET data=excluded.data,expires=excluded.expires').run(path,JSON.stringify(result),Date.now()+(result.error?60000:3600000));return result;
  })();pending.set(key,job);try{return await job;}finally{pending.delete(key);}
 }
 async function pilots(){
  return cached('pilots','esi-corporations.read_corporation_membership.v1',async row=>{
   const roster=await members();if(!roster.updated)throw Error(roster.error||'Member list unavailable');
   const warnings=roster.error?[roster.error]:[];let titles=[],assignments=[],divisions={},titlesAvailable=true;
   try{const r=await source('esi-corporations.read_titles.v1');titles=(await request('/corporations/'+id+'/titles',r)).data;assignments=(await request('/corporations/'+id+'/members/titles',r)).data;if(!Array.isArray(titles)||!Array.isArray(assignments))throw Error('Invalid titles');}catch(e){titlesAvailable=false;titles=[];assignments=[];warnings.push('Titles unavailable: '+e.message);}
   try{divisions=await namedDivisions();}catch(e){warnings.push('Division names unavailable: '+e.message);}
   const roles=(await request('/corporations/'+id+'/roles',row)).data;if(!Array.isArray(roles)||roles.some(r=>!Number.isSafeInteger(r.character_id))||new Set(roles.map(r=>r.character_id)).size!==roles.length)throw Error('Invalid corporation role assignments');
   const trackerRow=await source('esi-corporations.track_members.v1');
   const tracking=(await request('/corporations/'+id+'/membertracking',trackerRow)).data;if(!Array.isArray(tracking))throw Error('Invalid member tracking');
   let ceo=null;try{ceo=(await eve.publicGet('/corporations/'+id)).ceo_id;}catch{warnings.push('CEO identity unavailable; CEO access is not inferred.');}
   return {warnings,divisions,titles:titles.map(t=>({id:t.title_id,name:t.name})),rows:roster.rows.map(p=>{const t=tracking.find(t=>t.character_id===p.id)||{},r=roles.find(r=>r.character_id===p.id),ownTitles=(assignments.find(x=>x.character_id===p.id)?.titles||[]).map(id=>titles.find(t=>t.title_id===id)||{title_id:id,name:'Title '+id});return {...p,titles_available:titlesAvailable,joined:t.start_date||null,last_login:t.logon_date||null,base_id:t.base_id||null,titles:ownTitles.map(t=>({id:t.title_id,name:t.name||'Title '+t.title_id})),direct_roles:r||null,rights:r?pilotAccess(r,ownTitles,divisions,p.id===ceo):null};})};
  });
 }
 async function assetLocation(loc,row){
  const known=snapshot().structures.find(s=>s.id===loc);
  if(known?.type_id)return {name:known.name,type_id:known.type_id};
  const path='/tools/corp-asset-location/'+loc,old=db.prepare('SELECT * FROM public_cache WHERE path=?').get(path);
  if(old?.expires>Date.now())return JSON.parse(old.data);
  let place={};
  try{place=loc>=1000000000000?(await request('/universe/structures/'+loc,row)).data:await eve.publicGet('/universe/stations/'+loc);}catch{}
  const result={name:place?.name||known?.name||null,type_id:Number.isSafeInteger(place?.type_id)&&place.type_id>0?place.type_id:null};
  db.prepare('INSERT INTO public_cache VALUES(?,?,?) ON CONFLICT(path) DO UPDATE SET data=excluded.data,expires=excluded.expires').run(path,JSON.stringify(result),Date.now()+(result.type_id?3600000:60000));
  return result;
 }
 async function assets(query={}){
  const data=await cached('assets','esi-assets.read_corporation_assets.v1',async row=>{
   const items=(await pages('/corporations/'+id+'/assets',row,'item_id')).data,byId=new Map(items.map(a=>[a.item_id,a])),locations={},locationTypes={};
   for(const a of items){let p=a,seen=new Set([a.item_id]);while(byId.has(p.location_id)&&!seen.has(p.location_id)){seen.add(p.location_id);p=byId.get(p.location_id);}a.root_location_id=p.location_id;a.name=cat.type(a.type_id)?.name||'Type '+a.type_id;}
   for(const loc of new Set(items.map(a=>a.root_location_id))){const place=await assetLocation(loc,row);locations[loc]=place.name||'Location '+loc;if(place.type_id)locationTypes[loc]=place.type_id;}
   // Asset names can identify named ships/containers; failure leaves catalogue names.
   const named=items.filter(a=>a.is_singleton&&[2,6].includes(cat.type(a.type_id)?.category_id));
   for(let i=0;i<named.length;i+=1000)try{const ids=named.slice(i,i+1000).map(a=>a.item_id);const r=await request('/corporations/'+id+'/assets/names',row,'POST',ids);for(const n of r.data){const a=byId.get(n.item_id);if(a&&n.name&&n.name!=='None')a.custom_name=n.name;}}catch{}
   return {rows:items.map(a=>({...a,location:locations[a.root_location_id]||'Location '+a.root_location_id})),locations,locationTypes};
  });
  // Older asset snapshots may have names but no type metadata for their pictures.
  const missing=[...new Set(data.rows.map(a=>a.root_location_id))].filter(loc=>!data.locationTypes?.[loc]);
  if(missing.length){
   const row=await source('esi-assets.read_corporation_assets.v1');
   data.locationTypes={...data.locationTypes};
   for(const loc of missing){const place=await assetLocation(loc,row);if(place.type_id)data.locationTypes[loc]=place.type_id;if(place.name)for(const a of data.rows)if(a.root_location_id===loc)a.location=place.name;}
  }
  const fullRows=markEmptyOffices(data.rows),emptyLocations=new Set(fullRows.filter(a=>a.type_id===27).map(a=>a.root_location_id));
  for(const a of fullRows)if(a.type_id!==27&&a.quantity!==0)emptyLocations.delete(a.root_location_id);
  const q=String(query.q||'').toLowerCase().slice(0,100),location=String(query.location||'').toLowerCase().slice(0,100),filtered=assetMatches(fullRows.map(a=>({...a,name:a.empty_office?'Empty Office':a.custom_name?`${a.name} · ${a.custom_name}`:a.name})),q,location),groups=new Map();
  for(const a of filtered){if(!groups.has(a.root_location_id))groups.set(a.root_location_id,{id:a.root_location_id,name:a.location,empty_office:emptyLocations.has(a.root_location_id),type_id:data.locationTypes?.[a.root_location_id]||snapshot().structures.find(s=>s.id===a.root_location_id)?.type_id||null,items:[]});groups.get(a.root_location_id).items.push(a);}
  const list=[...groups.values()].sort((a,b)=>Number(a.empty_office)-Number(b.empty_office)||a.name.localeCompare(b.name)),offset=Math.max(0,Math.floor(Number(query.offset)||0));
  return {updated:data.updated,error:data.error,total:filtered.filter(a=>!a.context&&!a.empty_office).length,locationCount:list.length,locations:list.slice(offset,offset+20)};
 }
 async function wallets(){
  return cached('wallet','esi-wallet.read_corporation_wallets.v1',async(row,previous)=>{
   const balances=(await request('/corporations/'+id+'/wallets',row)).data;
   if(!Array.isArray(balances)||balances.length!==7||new Set(balances.map(b=>b.division)).size!==7||balances.some(b=>!Number.isFinite(b.balance)||b.division<1||b.division>7))throw Error('Incomplete corporation wallet balances');
   let divisions={},warnings=[];try{divisions=await namedDivisions();}catch(e){warnings.push('Division names unavailable: '+e.message);}
   const rows=[];
   for(const b of balances){
    const prefix='/corporations/'+id+'/wallets/'+b.division,old=previous?.rows?.find(d=>d.division===b.division),journal=(await pages(prefix+'/journal',row,'id')).data,transactions=[];let cursor=null;const seen=new Set();
    for(let page=0;page<1000;page++){
     const r=(await request(prefix+'/transactions'+(cursor===null?'':'?from_id='+cursor),row)).data;if(!Array.isArray(r))throw Error('Invalid corporation wallet transactions');if(!r.length)break;
     const fresh=r.filter(t=>t.transaction_id!==cursor);if(!fresh.length)break;
     for(const t of fresh){if(!Number.isSafeInteger(t.transaction_id)||seen.has(t.transaction_id)||(cursor!==null&&t.transaction_id>=cursor)||!Number.isFinite(t.unit_price)||t.unit_price<0||typeof t.is_buy!=='boolean'||!Number.isSafeInteger(t.quantity)||t.quantity<0||!Number.isFinite(Date.parse(t.date)))throw Error('Incomplete corporation wallet transactions');seen.add(t.transaction_id);transactions.push({...t,name:cat.type(t.type_id)?.name||'Type '+t.type_id});}
     cursor=Math.min(...fresh.map(t=>t.transaction_id));if(page===999)throw Error('Corporation wallet history exceeds safe page limit');
    }
    if(journal.some(j=>!Number.isFinite(Date.parse(j.date))||(j.amount!=null&&!Number.isFinite(j.amount))))throw Error('Invalid corporation wallet journal');
    const merge=(a,b,key)=>[...new Map([...(a||[]),...b].map(r=>[r[key],r])).values()].sort((a,b)=>String(b.date).localeCompare(String(a.date)));
    rows.push({...b,name:divisions.wallet?.find(d=>d.division===b.division)?.name||'Wallet '+b.division,journal:merge(old?.journal,journal,'id'),transactions:merge(old?.transactions,transactions,'transaction_id')});
   }
   const ids=[...new Set(rows.flatMap(d=>[...d.journal.flatMap(j=>[j.first_party_id,j.second_party_id]),...d.transactions.map(t=>t.client_id)]).filter(n=>Number.isSafeInteger(n)&&n>0))],names={...(previous?.names||{})};
   const missing=ids.filter(id=>!names[id]);for(let i=0;i<missing.length;i+=1000)try{const r=await eve.request('/universe/names',null,'POST',missing.slice(i,i+1000));for(const n of r.data)names[n.id]=n.name;}catch{}
   return {rows,names,warnings,started_at:previous?.started_at||Date.now()};
  });
 }
 return {pilots,assets,wallets};
}
