export const GROUP_ICONS = [
 ['◇','General'],['◆','Diamond'],['★','Star'],['✦','Special'],['⚔','Combat'],['🛡','Defence'],['🚀','Fleet'],['🎯','Target'],
 ['⚓','Capital Ships'],['♜','Dreadnoughts'],['♛','Titans'],['✈','Scouts'],['🔭','Exploration'],['⛏','Mining'],['☾','Moon Mining'],['☀','Solar'],
 ['⚙','Industry'],['🔧','Engineering'],['🏭','Production'],['📦','Logistics'],['🚚','Hauling'],['💰','Finance'],['📈','Market'],['📋','Contracts'],
 ['🎓','Training'],['📚','Skills'],['👥','Members'],['🤝','Diplomacy'],['🔑','Access'],['👑','Leadership'],['📡','Intelligence'],['🏆','Achievements'],
];
export function allowedGroupIcon(value,current){return typeof value==='string'&&(GROUP_ICONS.some(([icon])=>icon===value)||(Boolean(current)&&value===current));}
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function groupIconPicker(current='◇'){
 const options=GROUP_ICONS.some(([icon])=>icon===current)?GROUP_ICONS:[...GROUP_ICONS,[current,'Current Icon']];
 return `<fieldset class="group-icon-picker"><legend>Group Icon</legend><div class="group-icon-options">${options.map(([icon,label])=>`<label title="${escape(label)}"><input type="radio" name="icon" value="${escape(icon)}" aria-label="${escape(label)}" ${icon===current?'checked':''} required><span aria-hidden="true">${escape(icon)}</span></label>`).join('')}</div></fieldset>`;
}
