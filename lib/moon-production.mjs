// Recorded drill cycles are direct production evidence, independent of missing ore percentages.
export function recordedMoonProduction(survey,recipes,prices,cat,{refine=90,mode='athanor'}={}){
 const observation=survey?.drill_observation,seconds=observation?.cycle_seconds;
 if(!observation||!Number.isFinite(seconds)||seconds<=0||!observation.products?.length||observation.products.some(p=>!p.name||!Number.isFinite(p.units_per_cycle)||p.units_per_cycle<0)||survey.conflict||survey.issues?.length)return null;
 const efficiency=observation.efficiency??.4;if(efficiency!==.4)return null;
 const cycles=30*86400/seconds,factor=mode==='metenox'?1:refine/100/efficiency,priceMap=new Map(prices.filter(p=>Number.isFinite(p.average_price)&&p.average_price>=0).map(p=>[p.type_id,p.average_price]));
 const priceRow=(name,perCycle)=>{const id=cat.named?.(name),price=priceMap.get(id)??null,quantity=Math.floor(perCycle*cycles+1e-7);return {name,id,per_cycle:perCycle,quantity,price,value:price==null?null:quantity*price};};
 const products=observation.products.map(p=>({...priceRow(p.name,p.units_per_cycle*factor),observed_per_cycle:p.units_per_cycle}));
 const moonMaterials=new Set(Object.values(recipes.metenox).flatMap(r=>r.materials.map(m=>m.name))),remaining=new Map(observation.products.map(p=>[p.name,p.units_per_cycle])),oreBatches=[],tiers={Bitumens:4,Coesite:4,Sylvite:4,Zeolites:4,Cobaltite:8,Euxenite:8,Scheelite:8,Titanite:8,Chromite:16,Otavite:16,Sperrylite:16,Vanadinite:16,Carnotite:32,Cinnabar:32,Pollucite:32,Zircon:32,Loparite:64,Monazite:64,Xenotime:64,Ytterbite:64};
 let inferred=true;
 for(const [name,recipe] of Object.entries(recipes.metenox).sort((a,b)=>(tiers[b[0]]||0)-(tiers[a[0]]||0))){
  const primary=recipe.materials.reduce((a,b)=>a.quantity>b.quantity?a:b),amount=remaining.get(primary.name)||0;
  // Co-products are shown as whole units in-game; tiny residuals cannot prove another ore.
  if(amount < -2){inferred=false;continue;}if(amount<=0||tiers[name]===4&&amount<=1)continue;
  const batches=amount/primary.quantity/efficiency;oreBatches.push({name,batches});
  for(const m of recipe.materials)remaining.set(m.name,(remaining.get(m.name)||0)-batches*m.quantity*efficiency);
 }
 const mineralAmounts=new Map();
 if(inferred)for(const ore of oreBatches)for(const m of recipes.athanor[ore.name]?.materials||[])if(!moonMaterials.has(m.name))mineralAmounts.set(m.name,(mineralAmounts.get(m.name)||0)+ore.batches*m.quantity);
 const minerals=mode==='athanor'&&inferred?[...mineralAmounts].map(([name,amount])=>({...priceRow(name,amount*refine/100),full_per_cycle:amount})):[],outputs=[...products,...minerals],value=outputs.every(p=>p.value!=null)?outputs.reduce((n,p)=>n+p.value,0):null;
 return {...survey,refine,mode,coverage:survey.ores.reduce((n,o)=>n+(o.fraction||0),0),daily_m3:null,invalid:false,value,ores:survey.ores.map(o=>({...o,id:cat.named?.(o.name),m3:null,materials:[]})),recorded_production:{cycle_seconds:seconds,efficiency,cycles,products,minerals,mineral_estimate_available:inferred,unknown_other_minerals:true}};
}
