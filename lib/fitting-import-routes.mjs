import {ownedCharacter,transaction} from './store.mjs';
import {random} from './security.mjs';
import {fittingToEFT} from './saved-fittings.mjs';
export function fittingImportRoutes(app,{db,eve,cat}){
 async function saved(req){
  const c=ownedCharacter(db,req.session.user_id,req.params.id);
  if(!JSON.parse(c.scopes).includes('esi-fittings.read_fittings.v1'))throw Object.assign(Error('Reconnect this pilot to grant saved fitting access.'),{status:403});
  const rows=await eve.get('/characters/'+c.id+'/fittings',c);
  if(!Array.isArray(rows)||rows.length>10000||rows.some(f=>!Number.isSafeInteger(f.fitting_id)))throw Error('Invalid saved fittings response');
  return {c,rows};
 }
 app.get('/api/characters/:id/saved-fittings',async(req,res)=>{
  const {c,rows}=await saved(req);res.json(rows.map(f=>({id:f.fitting_id,name:f.name,description:f.description,ship:cat.type(f.ship_type_id)?.name||'Type '+f.ship_type_id,ship_type_id:f.ship_type_id,document_id:db.prepare('SELECT document_id FROM fitting_imports WHERE user_id=? AND character_id=? AND fitting_id=?').get(req.session.user_id,c.id,f.fitting_id)?.document_id||null})));
 });
 app.post('/api/characters/:id/saved-fittings/:fitting/import',async(req,res)=>{
  const {c,rows}=await saved(req),fit=rows.find(f=>f.fitting_id===Number(req.params.fitting));if(!fit)return res.sendStatus(404);
  const body=fittingToEFT(fit,cat);
  const document=transaction(db,()=>{
   const old=db.prepare('SELECT document_id FROM fitting_imports WHERE user_id=? AND character_id=? AND fitting_id=?').get(req.session.user_id,c.id,fit.fitting_id);if(old)return old.document_id;
   const id=random();db.prepare('INSERT INTO documents VALUES(?,?,?,?,?,?,?)').run(id,req.session.user_id,'fitting',String(fit.name||'Imported Fitting').slice(0,150),JSON.stringify(body),0,Date.now());
   db.prepare('INSERT INTO document_tags VALUES(?,?)').run(id,'Personal');
   db.prepare('INSERT INTO fitting_imports VALUES(?,?,?,?,?)').run(req.session.user_id,c.id,fit.fitting_id,id,String(fit.description||''));return id;
  });res.json({id:document});
 });
}
