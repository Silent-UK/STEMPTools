// Workforce reductions from EVE's Mercenary Den rules (Version 22.02 patch notes).
export function denLevel(value) {
  const match=String(value ?? "").match(/^(?:Level)?([0-4])$/);
  return match ? Number(match[1]) : null;
}
export function workforceImpact(den) {
  const level=denLevel(den.evolution?.anarchy?.level);
  return level===null ? null : [0,0,10,20,40][level];
}
export function activeOperations(den, now=Date.now()) {
  return (den.operations||[]).filter(o=>["Available","Started"].includes(o.state) && Date.parse(o.expires)>now);
}
export function denTotals(rows,now=Date.now()) {
  const dens=rows.flatMap(c=>c.data||[]), ops=dens.flatMap(d=>activeOperations(d,now));
  return {count:dens.length,active:dens.filter(d=>d.state==="Running").length,
    keys:dens.reduce((n,d)=>n+(Number(d.infomorphs?.amount)||0),0),
    impacting:dens.filter(d=>workforceImpact(d)>0).length,
    ready:ops.filter(o=>o.state==="Available").length,
    next:ops.sort((a,b)=>Date.parse(a.expires)-Date.parse(b.expires))[0]?.expires || null};
}

export function anarchyProgress(stat) {
  const level=denLevel(stat?.level), amount=stat?.amount;
  if(level===null || level===4 || typeof amount!=="number" || !Number.isFinite(amount)) return null;
  const thresholds=[0,20,40,70,100];
  return {next:level+1,percent:Math.max(0,Math.min(100,(amount-thresholds[level])/(thresholds[level+1]-thresholds[level])*100))};
}
export function denAlerts(pilots,now=Date.now()){
 const alerts=[];
 for(const pilot of pilots)for(const den of pilot.data||[]){
  const base={character_id:pilot.id,pilot:pilot.name,den_id:den.id,location:den.planet?.name||'Mercenary Den',updated:pilot.updated,stale:!pilot.updated||now-pilot.updated>7200000||Boolean(pilot.error)};
  const level=denLevel(den.evolution?.anarchy?.level),amount=den.evolution?.anarchy?.amount;
  if(level!==null&&(level>=2||(level===1&&Number.isFinite(amount)&&amount>=35)))alerts.push({...base,kind:'anarchy',severity:level>=2?'danger':'warning',message:level>=2?`Anarchy is level ${level} and affects workforce.`:'Anarchy is close to level 2 (35 / 40 or above).'});
  if(!den.operations_error)for(const operation of activeOperations(den,now))if(Date.parse(operation.expires)-now<=43200000)alerts.push({...base,kind:'operation',severity:'warning',expires:operation.expires,message:'An active operation expires within 12 hours.'});
 }
 return alerts;
}
