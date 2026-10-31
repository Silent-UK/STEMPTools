import {simulatedChargeQuantity} from './fitting-simulation.mjs';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {validateWorkbench,importWorkbench,workbenchEFT,workbenchStats,workbenchItem,compactWorkbench} from './fitting-workbench.mjs';
import {parseFitting} from './plans.mjs';
import {visibleDocument,ownedCharacter,transaction} from './store.mjs';
import {random} from './security.mjs';

export function fittingWorkbenchRoutes(app,{db,cat,eve,simulate=workbenchStats}){
 db.exec('CREATE TABLE IF NOT EXISTS fitting_workspaces(document_id TEXT PRIMARY KEY REFERENCES documents(id) ON DELETE CASCADE,data TEXT NOT NULL)');
 app.get('/api/fitting-workbench/source',(req,res)=>res.download(fileURLToPath(new URL('./fitting-source.zip',import.meta.url)),'tools-fitting-source.zip'));
 app.get('/api/fitting-workbench/license',(req,res)=>res.type('text/plain').send(readFileSync(new URL('../vendor/vyraj/LICENSE',import.meta.url),'utf8')));
 const fitFrom=body=>body.eft!==undefined?importWorkbench(body.eft,cat):validateWorkbench(body.fit,cat);
 function readiness(fit,user,pilot){
  const required=parseFitting(workbenchEFT(fit),cat).requirements;
  let chars=db.prepare('SELECT id,name FROM characters WHERE user_id=? ORDER BY name').all(user);
  if(pilot){ownedCharacter(db,user,Number(pilot));chars=chars.filter(c=>c.id===Number(pilot));}
  return chars.map(c=>{
   const row=db.prepare("SELECT data,updated FROM snapshots WHERE character_id=? AND kind='skills'").get(c.id),saved=row?JSON.parse(row.data):null;
   if(!saved?.skills?.skills)return {...c,ready:null,missing:[],updated:row?.updated||null};
   const levels=new Map(saved.skills.skills.map(s=>[s.skill_id,s.active_skill_level]));
   const missing=required.filter(r=>(levels.get(r.id)||0)<r.level).map(r=>({...r,name:cat.type(r.id)?.name||'Skill '+r.id,active:levels.get(r.id)||0}));
   return {...c,ready:!missing.length,missing,updated:row.updated};
  });
 }
 function result(fit,user,pilot){
  let profile=null;
  if(pilot){const c=ownedCharacter(db,user,Number(pilot)),row=db.prepare("SELECT data,updated FROM snapshots WHERE character_id=? AND kind='skills'").get(c.id),saved=row?JSON.parse(row.data):null;const clones=db.prepare("SELECT data FROM snapshots WHERE character_id=? AND kind='clones'").get(c.id);profile={id:c.id,name:c.name,skills:saved?.skills?.skills||null,updated:row?.updated||null,implants:clones?(JSON.parse(clones.data).active_implants||[]).map(i=>i.id):[]};}
  return {fit,eft:workbenchEFT(fit),stats:simulate(fit,profile),readiness:readiness(fit,user,pilot)};
 }
 app.get('/api/fitting-workbench/items',(req,res)=>{
  const q=String(req.query.q||'').slice(0,100),category=String(req.query.category||'equipment');
  const rows=cat.fittingSearch?cat.fittingSearch(q,category):cat.search(q,false);
  res.json(rows.map(t=>{const item=workbenchItem(t.id,cat);return {id:item.id,name:item.name,section:item.section,category:item.category};}));
 });
 app.get('/api/fitting-workbench/items/:id',(req,res)=>res.json(workbenchItem(req.params.id,cat)));
 app.get('/api/fitting-workbench/documents/:id',(req,res)=>{
  const doc=visibleDocument(db,req.session.user_id,req.params.id);if(doc.kind!=='fitting')return res.sendStatus(400);
  const saved=db.prepare('SELECT data FROM fitting_workspaces WHERE document_id=?').get(doc.id);
  const fit=saved?validateWorkbench(JSON.parse(saved.data),cat):importWorkbench(JSON.parse(doc.body),cat);
  res.json({...result(fit,req.session.user_id),id:doc.id,mine:doc.owner===req.session.user_id});
 });
 app.post('/api/fitting-workbench/preview',(req,res)=>res.json(result(fitFrom(req.body),req.session.user_id,req.body.pilot)));
 app.post('/api/fitting-workbench/save',(req,res)=>{
  const fit=fitFrom(req.body),eft=workbenchEFT(fit);parseFitting(eft,cat);simulate(fit);
  const id=transaction(db,()=>{
   let id=req.body.id;
   if(id){const old=visibleDocument(db,req.session.user_id,id);if(old.owner!==req.session.user_id||old.kind!=='fitting')throw Object.assign(Error('You can only update your own fittings.'),{status:403});
    db.prepare('UPDATE documents SET name=?,body=?,updated=? WHERE id=?').run(fit.name,JSON.stringify(eft),Date.now(),id);
   }else{id=random();db.prepare('INSERT INTO documents VALUES(?,?,?,?,?,?,?)').run(id,req.session.user_id,'fitting',fit.name,JSON.stringify(eft),0,Date.now());db.prepare('INSERT INTO document_tags VALUES(?,?)').run(id,'Personal');}
   db.prepare('INSERT INTO fitting_workspaces VALUES(?,?) ON CONFLICT(document_id) DO UPDATE SET data=excluded.data').run(id,JSON.stringify(compactWorkbench(fit)));return id;
  });res.json({id});
 });
 app.post('/api/fitting-workbench/prices',async(req,res)=>{
  const fit=fitFrom(req.body),quantities=new Map([[fit.ship_id,1]]);
  for(const item of fit.items){quantities.set(item.id,(quantities.get(item.id)||0)+item.quantity);if(item.charge_id)quantities.set(item.charge_id,(quantities.get(item.charge_id)||0)+simulatedChargeQuantity(item.id,item.charge_id));}
  let prices=[];try{prices=await eve.publicGet('/markets/prices');if(!Array.isArray(prices))prices=[];}catch{}
  const rows=[...quantities].map(([id,quantity])=>{const price=prices.find(p=>p.type_id===id)?.average_price;return {id,name:cat.type(id)?.name||'Type '+id,quantity,price:Number.isFinite(price)&&price>0?price:null};});
  res.json({rows,total:rows.reduce((n,r)=>n+(r.price||0)*r.quantity,0),missing:rows.filter(r=>r.price===null).length,source:'EVE market average; loaded ammo includes a full magazine per fitted weapon.'});
 });
}
