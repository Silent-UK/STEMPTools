export function whitelistRoutes(app,{db,eve,whitelist}) {
 const kinds={corporation:'corporations',pilot:'characters',alliance:'alliances'};
 app.get('/api/admin/whitelist',(req,res)=>res.json([
  ...db.prepare('SELECT * FROM login_whitelist').all().map(row=>({...row,kind:'corporation',entity_id:row.corporation_id})),
  ...db.prepare('SELECT * FROM login_whitelist_entities').all(),
 ].sort((a,b)=>a.name.localeCompare(b.name))));
 app.post('/api/admin/whitelist',async(req,res)=>{
  const kind=req.body.kind??'corporation',id=Number(req.body.entity_id??req.body.corporation_id);
  if(typeof kind!=='string'||!Object.hasOwn(kinds,kind)||!Number.isSafeInteger(id)||id<=0)return res.status(400).json({error:'Choose a valid whitelist type and EVE ID.'});
  let data;
  try{data=await eve.publicGet('/'+kinds[kind]+'/'+id);}catch{return res.status(400).json({error:'Entry could not be verified with ESI. Check the type and ID.'});}
  if(typeof data?.name!=='string'||!data.name.trim())return res.status(400).json({error:'ESI did not return a name.'});
  if(kind==='corporation')db.prepare('INSERT INTO login_whitelist VALUES(?,?) ON CONFLICT(corporation_id) DO UPDATE SET name=excluded.name').run(id,data.name);
  else db.prepare('INSERT INTO login_whitelist_entities VALUES(?,?,?) ON CONFLICT(kind,entity_id) DO UPDATE SET name=excluded.name').run(kind,id,data.name);
  whitelist.invalidate();res.json({ok:true});
 });
 async function remove(req,res){
  const kind=req.params.kind??'corporation',id=Number(req.params.id);
  if(typeof kind!=='string'||!Object.hasOwn(kinds,kind)||!Number.isSafeInteger(id)||id<=0)return res.status(400).json({error:'Invalid whitelist entry.'});
  if(kind==='pilot'&&id===req.session.main_id)return res.status(400).json({error:'Your own pilot must stay whitelisted so you can manage access.'});
  if(kind==='corporation'&&id===await whitelist.corporation(req.session.main_id,true))return res.status(400).json({error:'Your own corporation must stay whitelisted so you can manage access.'});
  if(kind==='alliance'&&id===(await whitelist.membership(req.session.main_id,true)).alliance)return res.status(400).json({error:'Your own alliance must stay whitelisted so you can manage access.'});
  if(kind==='corporation')db.prepare('DELETE FROM login_whitelist WHERE corporation_id=?').run(id);
  else db.prepare('DELETE FROM login_whitelist_entities WHERE kind=? AND entity_id=?').run(kind,id);
  whitelist.invalidate();res.json({ok:true});
 }
 app.delete('/api/admin/whitelist/:kind/:id',remove);
 app.delete('/api/admin/whitelist/:id',remove);
}
