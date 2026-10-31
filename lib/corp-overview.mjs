const plain=s=>String(s||'').replace(/<[^>]*>/g,' ').replace(/&amp;/g,'&').replace(/&#39;/g,"'").replace(/&quot;/g,'"').replace(/&nbsp;/g,' ').replace(/\s+/g,' ').trim();
export function dotlanStats(html){
 const cells=[...html.matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(m=>plain(m[1]));
 const value=label=>{const i=cells.findIndex(x=>x.toLowerCase()===label.toLowerCase());return i>=0?cells[i+1]:null;};
 const members=Number((value('Members')||'').replaceAll(',',''));
 if(!members)throw Error('Dotlan member statistics unavailable');
 return {members,alliance:value('Alliance'),ceo:value('Ceo'),ticker:value('Ticker'),tax:value('Tax Rate')};
}
export function evewhoChanges(data,kind){
 if(!Array.isArray(data.characters)||data.characters.some(r=>!Number.isSafeInteger(r.id)))throw Error('Invalid Eve Who history');
 return data.characters.slice(0,10).map(r=>({id:r.id,name:'Pilot '+r.id,detail:String(kind==='joiners'?r.start_date:r.end_date)+' UTC'}));
}
export function overviewService(db,eve,config,id){
 const pending=new Map();
 async function source(key,url,parse){
  const path='/tools/source/'+key,hit=db.prepare('SELECT * FROM public_cache WHERE path=?').get(path);
  if(hit?.expires>Date.now())return JSON.parse(hit.data);
  if(pending.has(key))return pending.get(key);
  const work=(async()=>{
   let result;
   try{const r=await (config.overviewNetwork||fetch)(url,{headers:{'User-Agent':'STEMPTools ('+(config.contact||config.base)+')',Accept:'application/json,text/html'},signal:AbortSignal.timeout(12000)});if(!r.ok)throw Error('Source returned HTTP '+r.status);result={data:await parse(r),checked:Date.now(),error:null};}
   catch{result={data:hit?JSON.parse(hit.data).data:null,checked:hit?JSON.parse(hit.data).checked:null,error:'Source unavailable; showing saved data where available.'};}
   db.prepare('INSERT INTO public_cache VALUES(?,?,?) ON CONFLICT(path) DO UPDATE SET data=excluded.data,expires=excluded.expires').run(path,JSON.stringify(result),Date.now()+(result.error?300000:3600000));return result;
  })();pending.set(key,work);try{return await work;}finally{pending.delete(key);}
 }
 return async()=>{
  const [esi,dotlan,zkill,joined,departed]=await Promise.allSettled([
   eve.publicGet('/corporations/'+id),
   source('dotlan','https://evemaps.dotlan.net/corp/Sacred_Templars',async r=>dotlanStats(await r.text())),
   source('zkill','https://zkillboard.com/api/stats/corporationID/'+id+'/kills/',async r=>{const d=await r.json();if(!Number.isFinite(d.shipsDestroyed)||!Number.isFinite(d.shipsLost))throw Error('Invalid statistics');return {shipsDestroyed:d.shipsDestroyed,shipsLost:d.shipsLost,iskDestroyed:d.iskDestroyed,iskLost:d.iskLost};}),
   source('evewho-joined','https://evewho.com/api/corpjoined/'+id,async r=>evewhoChanges(await r.json(),'joiners')),
   source('evewho-departed','https://evewho.com/api/corpdeparted/'+id,async r=>evewhoChanges(await r.json(),'leavers'))
  ]);
  const read=r=>r.status==='fulfilled'?r.value:{data:null,checked:null,error:'Source unavailable'};
  const j=read(joined),l=read(departed),history={joiners:j.data||[],leavers:l.data||[]};
  const ids=[...new Set([...history.joiners,...history.leavers].map(r=>r.id))];
  if(ids.length)try{const n=await eve.request('/universe/names',null,'POST',ids),names=Object.fromEntries(n.data.map(x=>[x.id,x.name]));for(const r of [...history.joiners,...history.leavers])r.name=names[r.id]||r.name;}catch{}
  return {corporation:esi.status==='fulfilled'?esi.value:null,dotlan:read(dotlan),zkill:read(zkill),evewho:{data:history,checked:Math.min(j.checked||0,l.checked||0)||null,error:j.error||l.error}};
 };
}
