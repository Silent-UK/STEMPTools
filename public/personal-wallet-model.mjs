import {walletRows} from './wallet-view.mjs';
export function walletDateValid(value){return typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;}
const amountValue=v=>typeof v==='string'&&v.trim()!==''&&Number.isFinite(Number(v))&&Number(v)>=0?v.trim():'';
export function walletPreferences(raw){const p=raw&&typeof raw==='object'?raw:{};return {mode:p.mode==='transactions'?'transactions':'journal',days:['7','30','90','all','custom'].includes(p.days)?p.days:'30',direction:['in','out'].includes(p.direction)?p.direction:'',q:typeof p.q==='string'?p.q.slice(0,200):'',type:typeof p.type==='string'?p.type.slice(0,100):'',from:walletDateValid(p.from)?p.from:'',to:walletDateValid(p.to)?p.to:'',min:amountValue(p.min),max:amountValue(p.max),exclude_own:p.exclude_own!==false,personal_only:p.personal_only!==false,pilot:typeof p.pilot==='string'&&/^\d*$/.test(p.pilot)?p.pilot:'',alts:p.alts===true,lp:p.lp===true};}
export function validateWalletFilters(p){if(p.days==='custom'&&(!walletDateValid(p.from)||!walletDateValid(p.to)))throw Error('Choose both dates for a custom period.');if(p.days==='custom'&&p.from>p.to)throw Error('The start date must be before the end date.');for(const key of ['min','max'])if(p[key]!==''&&p[key]!=null&&(!Number.isFinite(Number(p[key]))||Number(p[key])<0))throw Error('Amount limits must be zero or greater.');if(p.min!==''&&p.max!==''&&Number(p.min)>Number(p.max))throw Error('Minimum amount must not exceed maximum amount.');}
export function walletBounds(filters,now=Date.now()){return filters.days==='custom'?{start:walletDateValid(filters.from)?Date.parse(filters.from):null,end:walletDateValid(filters.to)?Date.parse(filters.to)+86400000:null}:filters.days==='all'?{start:null,end:null}:{start:now-Number(filters.days||30)*86400000,end:null};}
export function personalWalletRows(pilots,characters,filters,now=Date.now()){
 const owned=new Set(characters.map(c=>Number(c.id))),names=new Map(characters.map(c=>[Number(c.id),c.name])),pmap=new Map(pilots.map(p=>[p.id,p])),bounds=walletBounds(filters,now),q=filters.q.trim().toLocaleLowerCase(),seen=new Set();
 return walletRows(pilots,{mode:filters.mode,days:'all'},now).flatMap(row=>{
  const key=row.pilot_id+':'+(row.id??row.transaction_id);if(seen.has(key))return [];seen.add(key);
  const transaction=filters.mode==='transactions',pilot=pmap.get(row.pilot_id),name=id=>names.get(Number(id))||pilot?.data?.names?.[id]||(id?'ID '+id:'Not reported');
  const fromId=transaction?(row.is_buy?row.pilot_id:row.client_id):row.first_party_id,toId=transaction?(row.is_buy?row.client_id:row.pilot_id):row.second_party_id;
  const own=!transaction&&row.ref_type==='player_donation'&&Number(fromId)!==Number(toId)&&owned.has(Number(fromId))&&owned.has(Number(toId));
  const enriched={...row,amount:Number.isFinite(row.amount)?row.amount:null,from_id:fromId,to_id:toId,from:name(fromId),to:name(toId),own_transfer:own,snapshot_updated:pilot?.updated||null};
  const time=Date.parse(row.date),amount=Number.isFinite(row.amount)?Math.abs(row.amount):null;
  if(!Number.isFinite(time)||(bounds.start!==null&&time<bounds.start)||(bounds.end!==null&&time>=bounds.end))return [];
  if(filters.type&&row.transaction_type!==filters.type||filters.direction==='in'&&!(row.amount>0)||filters.direction==='out'&&!(row.amount<0))return [];
  if(filters.min!==''&&(amount===null||amount<Number(filters.min))||filters.max!==''&&(amount===null||amount>Number(filters.max)))return [];
  if(transaction&&filters.personal_only&&row.is_personal===false)return [];
  if(q&&![row.pilot,row.detail,row.description,row.reason,row.ref_type,enriched.from,enriched.to,fromId,toId].filter(v=>v!=null).join(' ').toLocaleLowerCase().includes(q))return [];
  return [enriched];
 }).sort((a,b)=>b.date.localeCompare(a.date)||(Number(b.id??b.transaction_id)-Number(a.id??a.transaction_id)));
}
export function walletFlow(rows){let income=0,expense=0,unknown=0;for(const r of rows){if(!Number.isFinite(r.amount)){unknown++;continue;}if(r.amount>0)income+=r.amount;else expense-=r.amount;}return {income,expense,net:income-expense,unknown};}
export function walletAnalysis(pilots,characters,filters,now=Date.now()){
 const matching=personalWalletRows(pilots,characters,filters,now),transfers=matching.filter(r=>r.own_transfer),rows=filters.exclude_own?matching.filter(r=>!r.own_transfer):matching,daily=new Map();
 for(const r of rows){const day=r.date.slice(0,10),entry=daily.get(day)||{day,income:0,expense:0};if(Number.isFinite(r.amount)){entry.income+=Math.max(0,r.amount);entry.expense-=Math.min(0,r.amount);}daily.set(day,entry);}
 return {matching,rows,transfers,flow:walletFlow(rows),transferFlow:walletFlow(transfers),daily:[...daily.values()].sort((a,b)=>a.day.localeCompare(b.day))};
}
export function walletCoverage(pilots,filters,now=Date.now()){
 const mode=filters.mode==='transactions'?'transactions':'journal';return pilots.map(p=>{const dates=(p.data?.[mode]||[]).map(r=>r.date).filter(v=>Number.isFinite(Date.parse(v))).sort();return {id:p.id,name:p.name,missing:!p.data,failed:!!p.error,stale:!p.updated||now-p.updated>7200000,updated:p.updated||null,first:dates[0]||null,last:dates.at(-1)||null,tracking:p.data?.started_at||null,error:p.error||null};});
}
export function walletCSV(rows,filters){
 const period=filters.days==='custom'?filters.from+' to '+filters.to:filters.days==='all'?'All retained history':filters.days+' days';
 const cells=[['View','Period','Pilot','Pilot ID','Entry ID','Date UTC','Type','From ID','From','To ID','To','Amount ISK','Balance after ISK','Quantity','Unit price ISK','Item','Description','Own transfer','Snapshot UTC'],...rows.map(r=>[filters.mode,period,r.pilot,r.pilot_id,r.id??r.transaction_id,r.date,r.transaction_type,r.from_id,r.from,r.to_id,r.to,Number.isFinite(r.amount)?r.amount:'',Number.isFinite(r.balance)?r.balance:'',r.quantity??'',Number.isFinite(r.unit_price)?r.unit_price:'',filters.mode==='transactions'?r.name:'',r.description||r.reason||'',r.own_transfer?'Yes':'No',r.snapshot_updated?new Date(r.snapshot_updated).toISOString():''])];
 return '\uFEFF'+cells.map(row=>row.map(value=>{let text=String(value??'');if(typeof value==='string'&&(/^\s*[=+@\-]/.test(text)||/^[\t\r\n]/.test(text)))text="'"+text;return '"'+text.replaceAll('"','""')+'"';}).join(',')).join('\r\n');
}
