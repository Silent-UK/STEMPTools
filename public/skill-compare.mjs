const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function compareSkills(pilots){
 const maps=pilots.map(p=>p.data?.skills?.skills?new Map(p.data.skills.skills.map(s=>[s.skill_id,s])):null),skills=new Map();
 for(const map of maps)for(const [id,s] of map||[])skills.set(id,s);
 return [...skills.values()].map(s=>{const cells=maps.map(map=>!map?{unknown:true}:map.has(s.skill_id)?{level:map.get(s.skill_id).trained_skill_level}:{missing:true});const first=cells[0];return {id:s.skill_id,name:s.name,group:s.group||'Other',cells,matching:cells.every(c=>!c.unknown&&!first.unknown&&c.level===first.level&&!!c.missing===!!first.missing)};}).sort((a,b)=>a.group.localeCompare(b.group)||a.name.localeCompare(b.name));
}
export function comparisonTable(pilots,showMatches=false){
 const all=compareSkills(pilots),rows=all.filter(r=>showMatches||!r.matching);
 return `<p class="muted">${rows.length} of ${all.length} skills shown · Trained levels from saved snapshots. Not injected differs from injected Level 0.</p><div class="skill-compare-table"><table><thead><tr><th>Skill</th>${pilots.map((p,i)=>`<th>${esc(p.name)}${i===0?'<small>Baseline</small>':''}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr><td><strong>${esc(r.name)}</strong><small>${esc(r.group)}</small></td>${r.cells.map((c,i)=>{const base=r.cells[0],delta=!c.unknown&&!base.unknown?(c.level||0)-(base.level||0):null;return `<td class="${i&&!c.unknown&&!base.unknown&&(c.level!==base.level||!!c.missing!==!!base.missing)?'skill-different':''}">${c.unknown?'Unavailable':c.missing?'Not injected':'Level '+c.level}${i&&delta?`<small>${delta>0?'+':''}${delta} vs baseline</small>`:''}</td>`}).join('')}</tr>`).join('')}</tbody></table></div>${!rows.length?'<p>No skill differences found in the available snapshots.</p>':''}`;
}
