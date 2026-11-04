import {expandPlan,parseFitting,comparePlan} from './plans.mjs';
import {ownedCharacter,visibleDocument,transaction} from './store.mjs';
import {random} from './security.mjs';
export function skillEvidence(entries,snapshot,cat,{error=null,now=Date.now()}={}){
 const saved=snapshot?.data?(typeof snapshot.data==='string'?JSON.parse(snapshot.data):snapshot.data):null;
 if(!saved?.skills?.skills)return {ready:null,state:'unknown',missing:[],rows:[],seconds:null,remaining:null,completed:0,total:entries.length,updated:snapshot?.updated??null,stale:true,error};
 const result=comparePlan(entries,saved.skills,saved.queue,saved.attributes,cat,false,now),queue=new Map();
 for(const row of saved.queue||[])queue.set(row.skill_id,Math.max(queue.get(row.skill_id)||0,row.finished_level||0));
 const rows=result.rows.map(r=>({...r,required:r.level,trained:r.current,queued_level:queue.get(r.id)||0,queued:(queue.get(r.id)||0)>=r.level,source:r.source}));
 const missing=rows.filter(r=>r.active<r.level),inactive=missing.some(r=>r.current>=r.level);
 return {...result,rows,missing,state:result.ready?'ready':inactive?'inactive':'training',completed:rows.filter(r=>r.active>=r.level).length,total:rows.length,remaining:rows.some(r=>r.remaining===null)?null:rows.reduce((n,r)=>n+r.remaining,0),updated:snapshot.updated,stale:!!error||!snapshot.updated||now-Number(snapshot.updated)>7200000,error};
}
const summaryEvidence=({rows,missing,...summary})=>summary;
export function documentLibraryRoutes(app,{db,cat}){
 app.get('/api/document-library',(req,res)=>{
  const user=req.session.user_id,documents=db.prepare("SELECT d.*,COALESCE(t.tag,'Personal') tag,u.name author FROM documents d JOIN users u ON u.id=d.owner LEFT JOIN document_tags t ON t.document_id=d.id WHERE d.owner=? OR d.shared=1 ORDER BY d.updated DESC").all(user),visible=new Map(documents.map(d=>[d.id,d])),links=db.prepare('SELECT fitting_id,plan_id FROM fitting_plans WHERE user_id=?').all(user),linkMap=new Map(links.map(l=>[l.fitting_id,l.plan_id]));
  let snapshot=null,error=null;if(req.query.pilot){const c=ownedCharacter(db,user,Number(req.query.pilot));snapshot=db.prepare("SELECT data,updated FROM snapshots WHERE character_id=? AND kind='skills'").get(c.id);error=db.prepare("SELECT message FROM sync_errors WHERE character_id=? AND kind='skills'").get(c.id)?.message||null;}
  const plans=new Map(),required=d=>{if(plans.has(d.id))return plans.get(d.id);const rows=d.kind==='plan'?expandPlan(JSON.parse(d.body),cat):parseFitting(JSON.parse(d.body),cat).requirements;plans.set(d.id,rows);return rows;};
  res.json(documents.map(d=>{try{let ship=null;const minimum=required(d),linked=d.kind==='fitting'?visible.get(linkMap.get(d.id)):null,requirements=linked?expandPlan([...minimum,...required(linked)],cat):minimum;if(d.kind==='fitting'){const parsed=parseFitting(JSON.parse(d.body),cat);ship={id:parsed.ship,name:cat.type(parsed.ship)?.name||'Unknown hull'};}
   return {id:d.id,kind:d.kind,name:d.name,tag:d.tag,author:d.author,mine:d.owner===user,shared:!!d.shared,updated:d.updated,ship,skill_count:requirements.length,linkedPlan:linked?{id:linked.id,name:linked.name}:null,linkedFittings:d.kind==='plan'?links.filter(l=>l.plan_id===d.id&&visible.has(l.fitting_id)).map(l=>({id:l.fitting_id,name:visible.get(l.fitting_id).name})):[],...(req.query.pilot?{readiness:summaryEvidence(skillEvidence(requirements,snapshot,cat,{error}))}:{})};
  }catch{return {id:d.id,kind:d.kind,name:d.name,tag:d.tag,author:d.author,mine:d.owner===user,shared:!!d.shared,updated:d.updated,error:'Requirements could not be read. Open and review this document.',skill_count:null};}}));
 });
 app.post('/api/documents/:id/create-plan',(req,res)=>{
  const doc=visibleDocument(db,req.session.user_id,req.params.id);if(doc.kind!=='fitting')return res.status(400).json({error:'Choose a fitting.'});const entries=parseFitting(JSON.parse(doc.body),cat).requirements;if(!entries.length)return res.status(400).json({error:'This fitting has no skill requirements.'});
  const id=transaction(db,()=>{const id=random();db.prepare('INSERT INTO documents VALUES(?,?,?,?,?,?,?)').run(id,req.session.user_id,'plan',(doc.name+' · Required Skills').slice(0,150),JSON.stringify(entries),0,Date.now());db.prepare('INSERT INTO document_tags VALUES(?,?)').run(id,doc.tag||'Personal');db.prepare('INSERT INTO fitting_plans VALUES(?,?,?) ON CONFLICT(user_id,fitting_id) DO UPDATE SET plan_id=excluded.plan_id').run(req.session.user_id,doc.id,id);return id;});res.json({id});
 });
}
