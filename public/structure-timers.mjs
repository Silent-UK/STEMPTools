export function fuelDeadlines(s) {
 const deadlines=[];
 if(s.fuel_expires)deadlines.push({at:Date.parse(s.fuel_expires),label:"Blocks · ESI"});
 if(Number.isFinite(s.inventory_at)) {
  if(s.rate>0&&Number.isFinite(s.fuel))deadlines.push({at:s.inventory_at+s.fuel/s.rate*3600000,label:"Blocks · estimated"});
  if(s.gas_rate>0&&Number.isFinite(s.gas))deadlines.push({at:s.inventory_at+s.gas/s.gas_rate*3600000,label:"Gas · estimated"});
 }
 return deadlines.filter(d=>Number.isFinite(d.at)).sort((a,b)=>a.at-b.at);
}
export function nextStructureTimer(s) {
 const times=[...fuelDeadlines(s).map(d=>d.at),Date.parse(s.timer),Date.parse(s.unanchors_at)].filter(Number.isFinite);
 return times.length?Math.min(...times):Infinity;
}
export function compareStructureTimers(a,b) {
 return (nextStructureTimer(a)-nextStructureTimer(b))||String(a.name||"").localeCompare(String(b.name||""))||a.id-b.id;
}
