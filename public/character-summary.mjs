import {splitQueue,skillGroups} from './view-models.mjs';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=v=>v==null?'—':Number(v).toLocaleString('en-GB',{maximumFractionDigits:0});
const when=v=>v?new Date(v).toLocaleString('en-GB',{timeZone:'UTC'})+' UTC':'Not scheduled';
const time=ms=>{if(ms<=0)return 'Now';const m=Math.ceil(ms/60000);return `${Math.floor(m/1440)}d ${Math.floor(m%1440/60)}h ${m%60}m`;};
const colors=['#8794b0','#69d8ce','#6cda9a','#b3a0f5','#ffbd59','#81c9ff'];
export function queueSummary(queue,now=Date.now()) {
 const {current,waiting}=splitQueue(queue||[],now),remaining=[...(current?[current]:[]),...waiting];
 const finishes=remaining.map(q=>Date.parse(q.finish_date)).filter(Number.isFinite);
 return {current,waiting,count:remaining.length,unscheduled:remaining.length-finishes.length,end:finishes.length?Math.max(...finishes):null};
}
export function characterTraining(data,now=Date.now()) {
 if(!data)return '<p class="muted">Skills and queue await a successful sync.</p>';
 const q=queueSummary(data.queue,now);
 const current=q.current;
 const start=current?Date.parse(current.start_date):0,end=current?Date.parse(current.finish_date):0;
 const progress=current?Math.max(0,Math.min(100,(now-start)/(end-start)*100)):0;
 return `<div class="my-training-head"><span class="eyebrow">CURRENTLY TRAINING</span><strong>${current?esc(current.name)+' · Level '+current.finished_level:'No active training'}</strong><span>${current?time(end-now)+' remaining · '+when(current.finish_date):'Queue follows the last reported EVE schedule'}</span></div>${current?`<div class="my-progress" role="progressbar" aria-label="Current skill time elapsed" aria-valuenow="${Math.round(progress)}" aria-valuemin="0" aria-valuemax="100"><i data-viz-width="${progress}"></i></div>`:''}<div class="my-queue-stats"><span><strong>${q.count}</strong> queue entries · including current</span><span><strong>${q.end?time(q.end-now):'—'}</strong> until ${q.unscheduled?'last scheduled finish':'queue finishes'}</span></div>${q.unscheduled?`<small>${q.unscheduled} entries have no scheduled finish; full queue duration is unavailable.</small>`:''}<small>${q.end?'Scheduled finish: '+when(q.end):'No scheduled finish'}</small><div class="my-queue-list">${q.waiting.slice(0,12).map(row=>`<div class="production"><span class="my-queue-skill"><img src="https://images.evetech.net/types/${Number(row.skill_id)}/icon?size=32" width="18" height="18" alt="" loading="lazy">${esc(row.name)}</span><strong>${row.finished_level}</strong><small>${row.finish_date?time(Date.parse(row.finish_date)-now):'Unscheduled'}</small></div>`).join('')}</div>${q.waiting.length>12?`<small>+ ${q.waiting.length-12} more entries · open Skills & queue for the full list</small>`:''}`;
}
export function characterCharts(data) {
 if(!data)return '';
 const skills=data.skills.skills,levels=Array.from({length:6},(_,level)=>skills.filter(s=>s.trained_skill_level===level).length),total=levels.reduce((a,b)=>a+b,0);
 let offset=0;const segments=levels.map((n,i)=>{const start=offset;offset+=total?n/total*100:0;return `${colors[i]} ${start}% ${offset}%`;});
 const groups=skillGroups(skills).map(g=>({...g,sp:g.skills.reduce((n,s)=>n+(s.skillpoints_in_skill||0),0)})).sort((a,b)=>b.sp-a.sp),max=Math.max(1,...groups.map(g=>g.sp));
 return `<section class="panel compact"><div class="panelhead"><h2>Skills by level</h2><small>Trained levels · last snapshot</small></div><div class="my-skill-chart"><div class="my-donut" role="img" aria-label="${esc(levels.map((n,i)=>'Level '+i+': '+n).join(', '))}" data-viz-gradient="${total?segments.join(','):'var(--line) 0% 100%'}"><span><strong>${num(total)}</strong><small>injected skills</small></span></div><div class="my-levels">${levels.map((n,i)=>`<div><span class="skill-level-color-${i}">● Level ${i}</span><strong>${num(n)}</strong></div>`).join('')}</div></div></section><section class="panel compact"><div class="panelhead"><h2>Skillpoint distribution</h2><small>SP by group</small></div><div class="my-group-chart">${groups.map(g=>`<div class="my-bar-row"><span>${esc(g.name)}</span><div class="my-progress"><i data-viz-width="${g.sp/max*100}"></i></div><strong>${num(g.sp)}</strong></div>`).join('')}</div></section>`;
}
