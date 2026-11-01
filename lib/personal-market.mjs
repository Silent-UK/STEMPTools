export const MARKET_SCOPE='esi-markets.read_character_orders.v1';
export async function collectMarket(c,eve,cat,previous,{corporation=false}={}){
 if(!JSON.parse(c.scopes).includes(corporation?'esi-markets.read_corporation_orders.v1':MARKET_SCOPE))throw Object.assign(Error('Reconnect this pilot to enable Market orders.'),{status:403});
 async function read(history){
  let expected=1;const found=new Map();
  for(let page=1;page<=expected;page++){
   const r=await eve.request((corporation?'/corporations/':'/characters/')+c.id+'/orders'+(history?'/history?page='+page:corporation?'?page='+page:''),c);
   if(!Array.isArray(r.data)||!Number.isSafeInteger(r.pages)||r.pages<1||r.pages>1000||(page>1&&r.pages!==expected))throw Error('Incomplete market order pages');
   expected=r.pages;
   for(const o of r.data){if(!Number.isSafeInteger(o.order_id)||found.has(o.order_id)||!Number.isFinite(o.price)||o.price<0||!Number.isSafeInteger(o.volume_remain)||o.volume_remain<0||!Number.isSafeInteger(o.volume_total)||o.volume_total<o.volume_remain)throw Error('Invalid market orders');found.set(o.order_id,{...o,is_buy_order:o.is_buy_order===true,name:cat.type(o.type_id)?.name||'Type '+o.type_id,status:history?(o.volume_remain===0?'fulfilled':o.state||'closed'):'active'});}
  }
  return [...found.values()];
 }
 const active=await read(false),history=await read(true),activeIds=new Set(active.map(o=>o.order_id));
 const retained=new Map([...(previous?.history||[]),...history].map(o=>[o.order_id,o]));
 for(const id of activeIds)retained.delete(id);
 // A missing active order is not proof of fulfillment: retain only reported history.
 const locations={...(previous?.locations||{})};
 for(const id of new Set([...active,...history].map(o=>o.location_id))){if(locations[id])continue;try{const r=id>=1e12?await eve.get('/universe/structures/'+id,c):await eve.publicGet('/universe/stations/'+id);locations[id]=r.name;}catch{}}
 return {active,history:[...retained.values()],locations,started_at:previous?.started_at||Date.now()};
}
