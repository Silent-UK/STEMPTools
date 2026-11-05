import {refinedSurvey} from './moon-surveys.mjs';

// Names are used only when they identify one surveyed moon in the reported system.
export function moonIncome(structures,dataset,recipes,prices,cat){
 const ids=new Map(dataset.rows.filter(m=>m.moon_id).map(m=>[m.moon_id,m])),systems=new Map();
 for(const m of dataset.rows){const system=m.key.split('|')[0];if(!systems.has(system))systems.set(system,[]);systems.get(system).push(m);}
 const regions=new Map();
 for(const s of structures.filter(s=>s.kind==='Moon Drill')){
  const candidates=systems.get(s.system)||[],pair=String(s.name||'').match(/(?:^|\s|[-–])\s*(\d+)\s*[-–]\s*(\d+)\s*$/),named=candidates.filter(m=>m.drill_observation?.structure_name===s.name||s.moon===m.name||String(s.name||'').toLowerCase().includes(m.name.toLowerCase())||pair&&m.key===`${s.system}|${Number(pair[1])}|${Number(pair[2])}`);
  const survey=ids.get(s.moon_id)||(named.length===1?named[0]:null),estimate=survey?refinedSurvey(survey,recipes,prices,cat,{daily_m3:dataset.daily_m3,mode:'metenox'}):null;
  const value=estimate&&!estimate.invalid&&Number.isFinite(estimate.value)?estimate.value:null,partial=!!estimate&&!estimate.recorded_production&&estimate.coverage<.999;
  const drill={id:s.id,name:s.name,moon:survey?.name||null,state:s.mining||'unknown',monthly:value,partial,source:estimate?.recorded_production?'Recorded hourly output':'Moon survey',reason:!survey?'Moon not matched':value===null?'Production or prices unavailable':partial?'Partial survey · known output only':null};
  const region=s.region||survey?.region||'Unknown region';if(!regions.has(region))regions.set(region,{name:region,drills:[],monthly:0,known:0,online:0,unknown:0,partial:0});
  const r=regions.get(region);r.drills.push(drill);if(drill.state==='online'){r.online++;if(value===null)r.unknown++;else{r.known++;r.monthly+=value;if(partial)r.partial++;}}else if(drill.state!=='offline')r.unknown++;
 }
 return [...regions.values()].map(r=>({...r,monthly:r.known?r.monthly:r.online||r.unknown?null:0})).sort((a,b)=>(b.monthly??-1)-(a.monthly??-1)||a.name.localeCompare(b.name));
}
