import {manufacturingBlueprints,materialPlan} from './industry-materials.mjs';
export function materialRoutes(app,{db,cat,corp,grants,admin=()=>false}){
 const bad=message=>Object.assign(Error(message),{status:400});
 async function evidence(req,corporation){
  if(corporation){if(!admin(req)&&!await corp.access(req.session.user_id)&&!['corp-industry','corp-blueprints'].some(page=>grants(db,req.session.user_id).includes(page)))throw Object.assign(Error('Corporation industry or blueprint access required.'),{status:403});
   const blueprints=await corp.blueprints(),stock=await corp.materialStock();return {blueprints:blueprints.rows||[],stock:stock.rows||[],updated:stock.updated,error:blueprints.error||stock.error||null};}
  const rows=db.prepare("SELECT c.id,c.name,s.kind,s.data,s.updated FROM characters c LEFT JOIN snapshots s ON s.character_id=c.id AND s.kind IN ('industry','assets') WHERE c.user_id=?").all(req.session.user_id),blueprints=[],stock=[],coverage=[],inventory=new Map();
  for(const row of rows){if(!inventory.has(row.id))inventory.set(row.id,{id:row.id,name:row.name,updated:null});if(row.kind==='assets')inventory.get(row.id).updated=row.updated;const data=row.data?JSON.parse(row.data):null;if(row.kind==='industry')for(const bp of data?.blueprints||[])blueprints.push({...bp,pilot:row.name,character_id:row.id,selection:row.id+':'+bp.item_id});if(row.kind==='assets'){stock.push(...(data?.items||[]));coverage.push(row.updated);}}
  const chars=db.prepare('SELECT COUNT(*) n FROM characters WHERE user_id=?').get(req.session.user_id).n,failed=db.prepare("SELECT 1 FROM sync_errors e JOIN characters c ON c.id=e.character_id WHERE c.user_id=? AND e.kind IN ('industry','assets') LIMIT 1").get(req.session.user_id);
  return {blueprints,stock,inventory_coverage:[...inventory.values()],updated:coverage.length?Math.min(...coverage):null,error:failed||coverage.length<chars||rows.filter(row=>row.kind==='industry').length<chars?'Some inventory or blueprint data is missing or its latest sync failed; quantities may be incomplete.':null};
 }
 for(const area of ['personal','corporation']){
  app.get('/api/material-planner/'+area,async(req,res)=>{const data=await evidence(req,area==='corporation');const blueprints=manufacturingBlueprints(data.blueprints,cat).map(bp=>({...bp,selection:bp.selection||String(bp.item_id)}));
   if(!req.query.blueprint)return res.json({blueprints,updated:data.updated,error:data.error,inventory_coverage:data.inventory_coverage||[],stock_scope:area==='personal'?'Stock pools all saved personal asset locations across your pilots; library location filters do not limit stock.':'Stock pools all saved corporation asset locations; library location filters do not limit stock.'});
   const bp=blueprints.find(bp=>bp.selection===String(req.query.blueprint));if(!bp)throw bad('Choose a blueprint in this inventory.');
   res.json({...materialPlan(bp,data.stock,{runs:Number(req.query.runs||1),facility:Number(req.query.facility||0),rig:Number(req.query.rig||0)},cat),updated:data.updated,error:data.error});
  });
 }
}
