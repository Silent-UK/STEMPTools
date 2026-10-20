export function valueHarvest(structures,prices,type) {
 const values=new Map((prices||[]).filter(p=>Number.isFinite(p.average_price)&&p.average_price>=0).map(p=>[p.type_id,p.average_price]));
 return structures.filter(s=>s.kind==="Moon Drill").map(s=>{
  const materials=(s.materials||[]).map(i=>{
   const price=values.get(i.type_id)??null,volume=type(i.type_id)?.volume;
   return {...i,unit_price:price,value:price==null?null:price*i.quantity,volume:Number.isFinite(volume)&&volume>=0?volume*i.quantity:null};
  }).sort((a,b)=>(b.value??-1)-(a.value??-1)||a.name.localeCompare(b.name));
  const sum=key=>!materials.length?0:materials.every(i=>i[key]==null)?null:materials.reduce((n,i)=>n+(i[key]??0),0);
  return {...s,materials,total_value:sum("value"),total_volume:sum("volume"),missing_prices:materials.filter(i=>i.value==null).length,missing_volumes:materials.filter(i=>i.volume==null).length};
 }).sort((a,b)=>(b.total_value??-1)-(a.total_value??-1)||a.name.localeCompare(b.name));
}
