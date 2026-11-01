const names={faction:'Factions',npc_corp:'NPC Corporations',agent:'Agents'};
export const standingTypeName=type=>names[type]||String(type||'Other').replaceAll('_',' ');
export function standingGroups(rows){
 const groups=new Map(),order=['faction','npc_corp','agent'];
 for(const row of rows){const type=row.from_type||'other';if(!groups.has(type))groups.set(type,{type,name:standingTypeName(type),rows:[]});groups.get(type).rows.push(row);}
 for(const group of groups.values())group.rows.sort((a,b)=>a.name.localeCompare(b.name)||String(a.pilot||'').localeCompare(String(b.pilot||''))||Number(a.from_id)-Number(b.from_id));
 return [...groups.values()].sort((a,b)=>(order.includes(a.type)?order.indexOf(a.type):3)-(order.includes(b.type)?order.indexOf(b.type):3)||a.name.localeCompare(b.name));
}
