import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
let dataset;
export function moonSurveyData(){return dataset??=JSON.parse(gunzipSync(readFileSync(new URL('./moon-surveys.json.gz',import.meta.url))));}
export function surveyList(query={},data=moonSurveyData()){
 const q=String(query.q||'').trim().toLowerCase().slice(0,150),region=String(query.region||''),tier=String(query.tier||'');
 const rows=data.rows.filter(r=>(!region||r.region===region)&&(!tier||r.ores.some(o=>o.tier===tier))&&(!q||[r.name,r.constellation,...r.ores.map(o=>o.name)].join(' ').toLowerCase().includes(q)));
 const offset=Math.min(Math.max(0,Math.floor(Number(query.offset)||0)),Math.max(0,Math.floor((rows.length-1)/100)*100));
 return {source:data.source,imported:data.imported,total:rows.length,all:data.rows.length,offset,rows:rows.slice(offset,offset+100),regions:[...new Set(data.rows.map(r=>r.region))].sort(),invalid:data.invalid.length,conflicts:data.rows.filter(r=>r.conflict).length,tabs:Object.keys(data.tabs)};
}
export function estimateExtraction(extraction,survey,prices,type,named,dailyM3){
 if(!survey)return {error:'No matching moon survey'};
 if(survey.issues?.length)return {error:'Survey contains source errors'};
 if(survey.conflict)return {error:'Conflicting surveys: review source before estimating'};
 if(!survey.ores.length||survey.ores.some(o=>!Number.isFinite(o.fraction)))return {error:'Survey quantities are missing'};
 const hours=(Date.parse(extraction.chunk_arrival_time)-Date.parse(extraction.extraction_start_time))/3600000;
 const fraction=survey.ores.reduce((n,o)=>n+o.fraction,0);
 if(!(hours>0)||!(dailyM3>0)||fraction>1.001||fraction<=0)return {error:'Invalid duration, extraction rate or survey total'};
 const totalVolume=hours*dailyM3/24,priceMap=new Map(prices.filter(p=>Number.isFinite(p.average_price)&&p.average_price>=0).map(p=>[p.type_id,p.average_price]));
 const ores=survey.ores.map(o=>{
  const id=named(o.name),volume=type(id)?.volume,unitPrice=priceMap.get(id)??null,m3=totalVolume*o.fraction;
  const units=Number.isFinite(volume)&&volume>0?Math.floor(m3/volume):null;
  return {...o,type_id:id??null,m3,units,value:units!=null&&unitPrice!=null?units*unitPrice:null};
 });
 return {moon:survey.name,hours,daily_m3:dailyM3,total_m3:totalVolume,known_m3:ores.reduce((n,o)=>n+o.m3,0),fraction,ores,value:ores.every(o=>o.value!=null)?ores.reduce((n,o)=>n+o.value,0):null,partial:fraction<0.999,source:survey.sources};
}

export function surveyBrowser(query={},data=moonSurveyData()){
 const q=String(query.q||'').trim().toLowerCase().slice(0,150),tier=String(query.tier||'');
 const filtered=data.rows.filter(r=>(!tier||r.ores.some(o=>o.tier===tier))&&(!q||[r.region,r.constellation,r.name,...r.ores.map(o=>o.name)].join(' ').toLowerCase().includes(q)));
 const regions=[];
 for(const row of filtered){let region=regions.find(r=>r.name===row.region);if(!region){region={name:row.region,count:0,systems:[]};regions.push(region);}region.count++;let system=region.systems.find(s=>s.name===row.system);if(!system){system={name:row.system,count:0};region.systems.push(system);}system.count++;}
 const selected=filtered.find(r=>r.key===query.moon),system=selected?.system||(filtered.some(r=>r.system===query.system)?query.system:filtered[0]?.system),moons=filtered.filter(r=>r.system===system);
 return {regions,system,moons,selected:selected||moons[0]||null,total:filtered.length,all:data.rows.length,systems:regions.reduce((n,r)=>n+r.systems.length,0),source:data.source,imported:data.imported,daily_m3:data.daily_m3};
}
export function refinedSurvey(survey,recipes,prices,cat,{daily_m3=720000,refine=90,mode='athanor'}={}){
 if(!survey)return null;
 mode=mode==='metenox'?'metenox':'athanor';
 refine=Number.isFinite(Number(refine))?Math.min(100,Math.max(0,Number(refine))):90;
 const efficiency=mode==='metenox'?.4:refine/100,priceMap=new Map(prices.filter(p=>Number.isFinite(p.average_price)&&p.average_price>=0).map(p=>[p.type_id,p.average_price]));
 const invalid=survey.conflict||survey.issues?.length||!survey.ores.length||survey.ores.reduce((n,o)=>n+(o.fraction||0),0)>1.001;
 const ores=survey.ores.map(o=>{
  const recipe=recipes[mode][o.name],m3=!invalid&&Number.isFinite(o.fraction)?daily_m3*30*o.fraction:null;
  const materials=(recipe?.materials||[]).map(m=>{const id=cat.named?.(m.name),price=priceMap.get(id)??null,quantity=m3==null?null:Math.floor(m3/recipe.batch_m3*m.quantity*efficiency);return {...m,id,quantity,price,value:quantity==null||price==null?null:quantity*price};});
  return {...o,id:cat.named?.(o.name),m3,materials,value:materials.length&&materials.every(m=>m.value!=null)?materials.reduce((n,m)=>n+m.value,0):null};
 });
 return {...survey,ores,refine,mode,daily_m3,coverage:survey.ores.reduce((n,o)=>n+(o.fraction||0),0),value:ores.length&&ores.every(o=>o.value!=null)?ores.reduce((n,o)=>n+o.value,0):null,invalid:!!invalid};
}
