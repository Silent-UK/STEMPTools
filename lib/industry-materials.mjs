import recipes from './manufacturing-recipes.json' with {type:'json'};
export function manufacturingBlueprints(rows,cat){return rows.filter(bp=>recipes.blueprints[bp.type_id]).map(bp=>({...bp,name:bp.name||cat.type(bp.type_id)?.name||'Blueprint '+bp.type_id}));}
export function materialPlan(blueprint,stock,{runs=1,facility=0,rig=0}={},cat){
 const recipe=recipes.blueprints[blueprint.type_id];if(!recipe)throw Object.assign(Error('This blueprint has no manufacturing recipe.'),{status:400});
 if(!Number.isSafeInteger(runs)||runs<1||runs>100000||!Number.isFinite(facility)||facility<0||facility>50||!Number.isFinite(rig)||rig<0||rig>50)throw Object.assign(Error('Choose 1–100,000 runs and material reductions from 0–50%.'),{status:400});
 if(blueprint.quantity===-2&&runs>blueprint.runs)throw Object.assign(Error('Runs exceed this blueprint copy’s remaining runs.'),{status:400});
 const me=blueprint.material_efficiency||0;if(!Number.isFinite(me)||me<0||me>10)throw Error('Invalid blueprint material efficiency');
 const quantities=new Map();for(const item of stock||[])if(Number.isFinite(item.quantity)&&item.quantity>0&&!item.is_blueprint_copy)quantities.set(item.type_id,(quantities.get(item.type_id)||0)+item.quantity);
 const materials=recipe.materials.map(item=>{const required=Math.max(runs,Math.ceil(Math.round(item.quantity*runs*(1-me/100)*(1-facility/100)*(1-rig/100)*100)/100)),available=quantities.get(item.typeID)||0;return {id:item.typeID,name:cat.type(item.typeID)?.name||'Type '+item.typeID,required,available,missing:Math.max(0,required-available)};});
 return {blueprint:blueprint.name||cat.type(blueprint.type_id)?.name,runs,me,facility,rig,materials,products:recipe.products.map(p=>({id:p.typeID,name:cat.type(p.typeID)?.name||'Type '+p.typeID,quantity:p.quantity*runs})),note:'Manufacturing only. Stock is a saved inventory snapshot, including stored items in containers and ships; nothing is reserved. Facility and rig reductions are entered manually. Job fees, invention and reactions are excluded.'};
}
