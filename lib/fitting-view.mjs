import slots from "./fitting-slots.json" with {type:"json"};
import {parseFitting} from "./plans.mjs";
export function fittingView(text,cat) {
 const parsed=parseFitting(text,cat),ship=cat.type(parsed.ship);
 const groups=new Map(["High slots","Mid slots","Low slots","Rigs","Subsystems","Drones","Cargo"].map(s=>[s,[]]));
 for(const line of text.trim().split(/\r?\n/).slice(1)) {
  const raw=line.trim();if(!raw)continue;
  const empty=raw.match(/^\[Empty (High|Med|Mid|Low|Rig|Subsystem) slot\]$/i);
  if(empty){const names={high:"High slots",med:"Mid slots",mid:"Mid slots",low:"Low slots",rig:"Rigs",subsystem:"Subsystems"};groups.get(names[empty[1].toLowerCase()]).push({empty:true,name:"Empty slot"});continue;}
  const parts=raw.split(/,\s*/);
  const match=parts[0].match(/^(.*?)(?:\s+x(\d+))?$/),id=cat.named(match[1].trim()),type=cat.type(id);
  const group=type.category_id===18?"Drones":match[2]?"Cargo":slots[id]||"Cargo";
  groups.get(group).push({id,name:type.name,quantity:Number(match[2]||1),charges:parts.slice(1).map(name=>{const id=cat.named(name.replace(/\s+x\d+$/,"").trim());return {id,name};})});
 }
 return {ship:{id:ship.id,name:ship.name},groups:[...groups].map(([name,items])=>({name,items}))};
}
