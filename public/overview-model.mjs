export const temporaryRefreshError=e=>/HTTP (?:5\d\d|420|429)|temporar|unavailable|timeout|timed out|downtime|fetch failed|cooling down|rate.limit/i.test(e.message||'');
import {subscriptionStatus} from './subscription.mjs';
export const OVERVIEW_FILTERS={all:'All characters',attention:'Needs attention',reconnect:'Reconnect required',subscription:'Subscription expiring'};
export const OVERVIEW_SORTS={manual:'Manual order',name:'Name · A–Z',sp:'Skillpoints · highest',isk:'ISK · highest',subscription:'Subscription · soonest',refreshed:'Last refresh · oldest'};
export function overviewPreferences(value={}){
 if(!value||typeof value!=='object')value={};
 return {q:typeof value.q==='string'?value.q.slice(0,120):'',filter:Object.hasOwn(OVERVIEW_FILTERS,value.filter)?value.filter:'all',sort:Object.hasOwn(OVERVIEW_SORTS,value.sort)?value.sort:'manual',totals:value.totals===true,expanded:value.expanded===true,groups:Array.isArray(value.groups)?value.groups.filter(Number.isSafeInteger):[]};
}
export function overviewRefresh(c,now=Date.now()){
 const rows=(c.snapshots||[]).filter(s=>Number.isFinite(s.updated)&&s.updated>0);
 return {latest:rows.length?Math.max(...rows.map(s=>s.updated)):null,oldest:rows.length?Math.min(...rows.map(s=>s.updated)):null,older:rows.some(s=>Number.isFinite(s.expires)&&s.expires<=now),temporary:(c.errors||[]).some(temporaryRefreshError)};
}
export function overviewIssues(c,chars,now=Date.now()){
 const issues=[],owner=chars.find(p=>p.id===c.parent_id)||c,days=subscriptionStatus(owner.subscription_end,now).days;
 if(c.reconnect||c.missing_scopes?.length)issues.push({kind:'reconnect',page:'overview',message:c.missing_scopes?.length?'Additional ESI permissions required':'Reconnect required'});
 if(c.errors?.length)issues.push({kind:'refresh',page:'overview',message:c.errors.every(temporaryRefreshError)?'Temporary refresh failure · saved data retained':'Some data could not refresh · saved data retained'});
 // Subscription is shared by the linked group; report it once on the main.
 if(c.id===owner.id&&days!==null&&days<=7)issues.push({kind:'subscription',page:'overview',message:days<0?'Recorded subscription has expired':`Recorded subscription expires in ${days} day${days===1?'':'s'}`});
 if(c.training_warning)issues.push({kind:'skills',page:'skills',message:c.training_warning});
 return issues;
}
export function overviewMatches(c,chars,prefs,now=Date.now()){
 const issues=overviewIssues(c,chars,now),owner=chars.find(p=>p.id===c.parent_id)||c,days=subscriptionStatus(owner.subscription_end,now).days;
 return c.name.toLocaleLowerCase().includes(prefs.q.trim().toLocaleLowerCase())&&(prefs.filter==='all'||prefs.filter==='attention'&&issues.length>0||prefs.filter==='reconnect'&&issues.some(i=>i.kind==='reconnect')||prefs.filter==='subscription'&&days!==null&&days<=7);
}
export function overviewTotals(rows,key){const known=rows.map(c=>c[key]).filter(v=>typeof v==='number'&&Number.isFinite(v));return {value:known.length?known.reduce((a,b)=>a+b,0):null,partial:known.length<rows.length};}
export function overviewGroups(groups,chars,prefs,now=Date.now()){
 const compare=(a,b)=>{if(prefs.sort==='name')return a.name.localeCompare(b.name);const value=c=>prefs.sort==='subscription'?subscriptionStatus((chars.find(p=>p.id===c.parent_id)||c).subscription_end,now).days:prefs.sort==='refreshed'?overviewRefresh(c,now).latest:c[prefs.sort==='sp'?'total_sp':'isk'];const av=value(a),bv=value(b);return av==null?(bv==null?0:1):bv==null?-1:['sp','isk'].includes(prefs.sort)?bv-av:av-bv;};
 return groups.filter(g=>[g.main,...g.alts].filter(Boolean).some(c=>overviewMatches(c,chars,prefs,now))).map(g=>({...g,alts:prefs.sort==='manual'?g.alts:[...g.alts].sort(compare)})).sort((a,b)=>{if(prefs.sort==='manual')return 0;const entry=g=>{const c=g.main||g.alts[0];return prefs.totals?{...c,total_sp:overviewTotals([g.main,...g.alts].filter(Boolean),'total_sp').value,isk:overviewTotals([g.main,...g.alts].filter(Boolean),'isk').value}:c;};return compare(entry(a),entry(b));});
}

export function overviewAttention(chars,now=Date.now()){
 const temporary=chars.filter(c=>(c.errors||[]).some(temporaryRefreshError)).map(c=>({id:c.id,pilot:c.name}));
 const issues=chars.flatMap(c=>overviewIssues(c,chars,now).filter(i=>i.kind!=='refresh'||!c.errors.every(temporaryRefreshError)).map(i=>({...i,id:c.id,pilot:c.name})));
 return {issues,temporary,affected:new Set([...issues,...temporary].map(i=>i.id)).size,checks:issues.length+(temporary.length?1:0)};
}
