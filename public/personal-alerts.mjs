import {subscriptionStatus} from './subscription.mjs';
export function personalAlerts(pilots,preferences={},now=Date.now()){
 const alerts=[];
 for(const pilot of pilots){
  const read=kind=>pilot.snapshots?.[kind],fresh=kind=>read(kind)&&now-read(kind).updated<=7200000&&!read(kind).error;
  const add=(kind,page,message,extra={})=>alerts.push({character_id:pilot.id,pilot:pilot.name,location:({skills:'Skills & Queues',industry:'Industry',market:'Market',pi:'Planetary Industry'})[page]||page,page,kind,severity:'warning',message,updated:read(page)?.updated||null,stale:false,...extra});
  if(fresh('skills')&&subscriptionStatus(pilot.subscription_end,now).days>0){const queue=read('skills').data?.queue;
   if(Array.isArray(queue)&&!queue.some(item=>Number.isFinite(Date.parse(item.finish_date))&&Date.parse(item.finish_date)>now))add('empty-training','skills','No skills are training. Saved game-time expiry indicates an active subscription.');}
  if(preferences.industry!==false&&fresh('industry')){const jobs=(read('industry').data?.jobs||[]).filter(job=>job.status==='ready'||job.status==='active'&&Date.parse(job.end_date)<=now);if(jobs.length)add('industry-ready','industry',jobs.length+' industry job'+(jobs.length===1?' is':'s are')+' ready to deliver (estimated from ESI timers).');}
  if(preferences.market!==false&&fresh('market')){const recent=(read('market').data?.history||[]).filter(order=>order.state==='expired'&&!order.is_corporation&&Number.isFinite(Date.parse(order.issued))&&Date.parse(order.issued)+order.duration*86400000<=now&&Date.parse(order.issued)+order.duration*86400000>now-86400000);if(recent.length)add('market-ended','market',recent.length+' market order'+(recent.length===1?' has':'s have')+' ended within the last day.');}
  if(preferences.pi!==false&&fresh('pi')){let ended=0;for(const planet of read('pi').data||[])for(const pin of planet.pins||[])if(pin.extractor_details&&pin.expiry_time&&Date.parse(pin.expiry_time)<=now)ended++;if(ended)add('pi-extractor','pi',ended+' planetary extractor programme'+(ended===1?' has':'s have')+' finished.');}
 }
 return alerts;
}
