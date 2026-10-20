function serviceKey(name) {
  return name.toLowerCase().replace(/\bcloning\b/g, "clone").replace(/\bmanufacturing\b/g, "manufactur")
    .replace(/\b(standup|standard|service|module|facility|center|centre|plant|array|i|ii|iii)\b/g, "")
    .replace(/[^a-z0-9]/g, "");
}
function serviceFamily(name) {
  const value = name.toLowerCase();
  if (/moon.*drill|automatic.*moon/.test(value)) return "moon-drill";
  if (/reprocess|compression/.test(value)) return "reprocessing";
  if (/reaction|reactor/.test(value)) return "reaction";
  if (/manufactur|assembly|shipyard/.test(value)) return "manufacturing";
  // A Research Lab provides material research, time research and blueprint
  // copying. ESI can expose those as separate service labels, but they are one
  // fitted module and must only be charged once.
  if (/research|laboratory|\blab\b|copy/.test(value)) return "research";
  if (/invent/.test(value)) return "invention";
  if (/clon/.test(value)) return "cloning";
  if (/market/.test(value)) return "market";
  if (/advertis|nexus/.test(value)) return "advertisement";
  return null;
}
function structureFuelMultiplier(hull, group, moduleName, holdsSov) {
  const label = `${group} ${moduleName}`;
  const category = /manufactur|research|invention|engineering|assembly/i.test(label) ? "engineering" :
    /resource processing|reprocessing|reaction|refinery|moon drill/i.test(label) ? "resource" :
    /citadel|structure service|clon|market/i.test(label) ? "citadel" : null;
  if (!category) return null;
  const name = hull.toLowerCase();
  let base = null;
  if (/moreau fortizar/.test(name)) base = 0.65;
  else if (/prometheus fortizar/.test(name) && category === "resource") base = 0.75;
  else if (/draccous fortizar/.test(name) && category === "engineering") base = 0.75;
  else if (/^(astrahus|fortizar|keepstar|upwell palatine keepstar)$/.test(name) && category === "citadel") base = 0.75;
  else if (/^(raitaru|azbel|sotiyo)$/.test(name) && category === "engineering") base = 0.75;
  else if (/^(athanor|tatara)$/.test(name) && category === "resource") base = 0.75;
  else if (/^(astrahus|fortizar|keepstar|upwell palatine keepstar|raitaru|azbel|sotiyo|athanor|tatara)$/.test(name)) base = 1;
  if (base === null) return null; // Faction hulls and special structures need verified modifiers.
  // Structures owned by the alliance holding sovereignty in this exact system
  // receive the additional five-point fuel reduction. Do not infer this from
  // region: NPC Venal, for example, must retain the normal hull modifier.
  return Math.max(0, Math.round((base - (holdsSov ? 0.05 : 0)) * 10000) / 10000);
}

export const FUEL_BLOCKS=new Set([4051,4246,4247,4312]);
export function miningState(services) {
 const entries=(services||[]).filter(s=>/metenox|moon.*(min|drill)|auto.*moon/i.test(s.name));
 return entries.length&&entries.every(s=>s.state==="online")?"online":entries.length&&entries.every(s=>s.state==="offline")?"offline":"unknown";
}
export function structureRate(row,assets,type,holdsSov,now=Date.now()) {
 if(row.kind==="POS") {
  if(row.state!=="online")return null;
  // Only verified standard tower hulls use this fallback; unknown/faction hulls remain unknown.
  if(!/^(Amarr|Caldari|Gallente|Minmatar) Control Tower( Small| Medium)?$/.test(row.type_name)||holdsSov==null)return null;
  return Math.ceil((/Small$/.test(row.type_name)?10:/Medium$/.test(row.type_name)?20:40)*(holdsSov?0.75:1));
 }
 if(!Array.isArray(row.services))return null;
 const online=row.services.filter(s=>s.state==="online");
 if(!online.length && Date.parse(row.fuel_expires)>now)return null;
 if(row.kind==="Moon Drill")return miningState(row.services)==="online"?Number(type(82941)?.attributes?.[2109])||5:miningState(row.services)==="offline"?0:null;
 if(holdsSov==null)return null;
 const unique=new Map();for(const s of online)unique.set(serviceFamily(s.name)==="research"?"research":s.name,s);
 const installed=assets.filter(a=>a.location_id===row.id&&/^ServiceSlot/.test(a.location_flag));
 const used=new Set();let sum=0;
 for(const s of unique.values()) {
  const key=serviceKey(s.name),family=serviceFamily(s.name);
  const available=installed.filter(a=>!used.has(a.item_id));
  const matched=available.find(a=>{const k=serviceKey(type(a.type_id)?.name||"");return k&&key&&(k.includes(key)||key.includes(k));})||available.find(a=>family&&serviceFamily(type(a.type_id)?.name||"")===family);
  if(!matched)return null;
  const t=type(matched.type_id),base=Number(t?.attributes?.[2109]);
  const factor=structureFuelMultiplier(row.type_name,serviceFamily(t?.name||"")==="reaction"?"Resource Processing":"",t?.name||"",holdsSov);
  if(!Number.isFinite(base)||base<=0||factor==null)return null;
  used.add(matched.item_id);sum+=Math.floor(Math.round(base*factor*10000)/10000);
 }
 return sum;
}
export function moonHistory(previous,items,now) {
 const history=previous?.history||[];
 if(!previous||previous.inventory_at>=now)return history;
 const next=new Map(items.map(i=>[i.type_id,i.quantity]));
 const removed=previous.materials.flatMap(i=>i.quantity>(next.get(i.type_id)||0)?[{...i,quantity:i.quantity-(next.get(i.type_id)||0)}]:[]);
 return removed.length?[{from:previous.inventory_at,to:now,emptied:items.every(i=>i.quantity===0),items:removed},...history].slice(0,50):history;
}
