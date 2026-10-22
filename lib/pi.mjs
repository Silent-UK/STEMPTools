// Programme-average extraction, following the EVE developer PI formula.
// Current ESI schema reports extractor_details.cycle_time in SECONDS.
export function extractionProgramme(pin, attributes={}) {
  const e=pin.extractor_details || {}, seconds=(Date.parse(pin.expiry_time)-Date.parse(pin.install_time))/1000;
  const cycle=e.cycle_time, base=e.qty_per_cycle, count=Math.floor(seconds/cycle);
  if(!Number.isFinite(seconds)||seconds<=0||!Number.isFinite(cycle)||cycle<=0||!Number.isFinite(base)||base<0||count<1||count>100000)return null;
  const decay=attributes[1683]??0.012,noise=attributes[1687]??0.8,width=cycle/900,phase=base**0.7;
  let total=0;
  for(let i=0;i<count;i++){
    const t=(i+.5)*width;
    const variation=Math.max((Math.cos(phase+t/12)+Math.cos(phase/2+t*.2)+Math.cos(t*.5))/3,0);
    total+=Math.max(0,Math.floor(width*(base/(1+t*decay))*(1+noise*variation)));
  }
  return {total,perHour:total/(seconds/3600),hours:seconds/3600,cycles:count};
}
export const defaultPISettings=()=>({perfect:18000,critical:16000,targets:[]});
export function validatePISettings(value,recipes){
  if(!value || !Number.isFinite(value.perfect)||!Number.isFinite(value.critical)||value.critical<0||value.perfect<=value.critical||value.perfect>100000000)throw Error('Perfect must be greater than Critical; thresholds must be positive units/hour.');
  if(!Array.isArray(value.targets)||value.targets.length>8||new Set(value.targets).size!==value.targets.length||value.targets.some(id=>!Number.isInteger(id)||!recipes.some(r=>r.id===id&&[3,4].includes(r.tier))))throw Error('Choose up to eight different P3 or P4 products.');
  return {perfect:value.perfect,critical:value.critical,targets:value.targets};
}
export function combinedProduction(stock,targets,recipes){
  const available=new Map(stock.map(s=>[s.type_id,s.amount])),byId=new Map(recipes.map(r=>[r.id,r]));
  // Reserve selected finished products; they are valued once, not recycled into another target.
  const existing=new Map(targets.map(id=>[id,available.get(id)||0]));
  for(const id of targets)available.set(id,0);
  function take(pool,id,amount,path=new Set()){
    const held=pool.get(id)||0,used=Math.min(held,amount);
    pool.set(id,held-used);amount-=used;
    if(amount===0)return true;
    const r=byId.get(id);
    if(!r||path.has(id)||path.size>5)return false;
    const batches=Math.ceil(amount/r.quantity),next=new Set([...path,id]);
    for(const input of r.inputs)if(!take(pool,input.id,input.quantity*batches,next))return false;
    pool.set(id,(pool.get(id)||0)+batches*r.quantity-amount);
    return true;
  }
  return targets.map(id=>{
    const recipe=byId.get(id);
    if(!recipe)return {id,existing:existing.get(id),additional:0,ingredients:[]};
    const ingredients=recipe.inputs.map(i=>({...i,available:available.get(i.id)||0,stored:stock.find(s=>s.type_id===i.id)?.amount||0}));
    const attempt=batches=>{const pool=new Map(available);for(const i of recipe.inputs)if(!take(pool,i.id,i.quantity*batches))return null;return pool;};
    // Every recipe consumes units; 20 is the largest output batch in the PI catalogue.
    let low=0,high=Math.floor([...available.values()].reduce((n,q)=>n+q,0)*20/recipe.quantity)+1;
    while(low+1<high){const mid=Math.floor((low+high)/2);if(attempt(mid))low=mid;else high=mid;}
    const remaining=attempt(low);
    available.clear();for(const [k,v] of remaining)available.set(k,v);
    return {id,name:recipe.name,tier:recipe.tier,existing:existing.get(id)||0,additional:low*recipe.quantity,ingredients};
  });
}

export function jitaPricing(db,eve){
  const inFlight=new Map();
  async function price(id){
    const key='/tools/jita-sell/'+id,row=db.prepare('SELECT * FROM public_cache WHERE path=?').get(key);
    if(row&&row.expires>Date.now())return JSON.parse(row.data);
    if(inFlight.has(id))return inFlight.get(id);
    const promise=(async()=>{
      let best=null,expires=Infinity;
      for(let page=1,pages=1;page<=pages;page++){
        const result=await eve.request(`/markets/10000002/orders?order_type=sell&type_id=${id}&page=${page}`);
        pages=result.pages;
        if(!Number.isInteger(pages)||pages<1||pages>100||!Array.isArray(result.data))throw Error('Incomplete Jita order data');
        expires=Math.min(expires,result.expires);
        for(const order of result.data)if(order.location_id===60003760 && order.type_id===id && order.is_buy_order===false && order.volume_remain>0 && Number.isFinite(order.price)&&order.price>0)best=best===null?order.price:Math.min(best,order.price);
      }
      const value={id,price:best,updated:Date.now()};
      db.prepare('INSERT INTO public_cache VALUES(?,?,?) ON CONFLICT(path) DO UPDATE SET data=excluded.data,expires=excluded.expires').run(key,JSON.stringify(value),Number.isFinite(expires)?expires:Date.now()+60000);
      return value;
    })().catch(()=>({id,price:null,updated:null,error:'Jita prices unavailable'})).finally(()=>inFlight.delete(id));
    inFlight.set(id,promise);return promise;
  }
  return async ids=>Promise.all(ids.map(price));
}

// Spaceport (launchpad) capacity is 10,000 m³. Sum every stored commodity.
export function launchpadUsage(contents,type) {
 let used=0;
 for(const item of contents){const volume=type(item.type_id)?.volume;if(!Number.isFinite(volume)||volume<=0||!Number.isFinite(item.amount)||item.amount<0)return {used:null,capacity:10000,freePercent:null,level:'unknown'};used+=volume*item.amount;}
 const freePercent=Math.max(0,100-used/10000*100);
 return {used,capacity:10000,freePercent,level:freePercent>50?'good':freePercent>25?'warning':'danger'};
}

export function combinedVolumes(targets,type){
 const rows=targets.map(t=>{const unit=type(t.id)?.volume,known=Number.isFinite(unit)&&unit>0;return {...t,combined_m3:known?(t.existing+t.additional)*unit:null,additional_m3:known?t.additional*unit:null};});
 return {targets:rows,total_m3:rows.every(t=>t.combined_m3!=null)?rows.reduce((n,t)=>n+t.combined_m3,0):null};
}
