const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const date=v=>new Date(v).toLocaleString('en-GB',{timeZone:'UTC'})+' UTC';
const num=v=>Number(v).toLocaleString('en-GB',{maximumFractionDigits:0});
export function fractureCountdown(time,now=Date.now()){
 const m=Math.max(0,Math.ceil((Date.parse(time)-now)/60000));
 return m?`${Math.floor(m/1440)}d ${Math.floor(m%1440/60)}h ${m%60}m`:'Ready to fracture';
}
function estimateView(e){
 if(!e)return '';
 if(e.error)return `<div class="moon-extraction-estimate muted">Yield estimate unavailable · ${esc(e.error)}</div>`;
 return `<details class="moon-extraction-estimate"><summary>Estimated ${num(e.known_m3)} m³ · ${e.value==null?'Value unavailable':num(e.value)+' ISK'}${e.partial?' · known-ore subtotal':''}</summary><small>${esc(e.moon)} · assumes ${num(e.daily_m3)} m³/day from source sheet MoonPricing!F6. Base ores, ESI average prices; excludes jackpot variants, mining losses, fuel and tax. Not a Jita quote.</small>${e.partial?`<small class="corp-warning">Only ${(e.fraction*100).toFixed(2)}% of the chunk is covered by this survey. Unknown ore is excluded.</small>`:''}${e.ores.map(o=>`<div class="production"><span>${esc(o.name)}</span><span>${o.units==null?'Units unavailable':num(o.units)+' units'} · ${num(o.m3)} m³</span><strong>${o.value==null?'Price unavailable':num(o.value)+' ISK'}</strong></div>`).join('')}</details>`;
}
export function moonExtractions(state,structures=[],now=Date.now()){
 const rows=(state?.rows||[]).filter(e=>Date.parse(e.natural_decay_time)>now).sort((a,b)=>Date.parse(a.chunk_arrival_time)-Date.parse(b.chunk_arrival_time));
 const warning=state?.error||(!state?.updated?'Extraction data not collected yet. Sync corporation.':null);
 return `<section class="panel moon-extractions"><h2>Moon Extractions</h2>${warning?`<p class="corp-warning">${esc(warning)}${state?.updated?' Showing last available snapshot.':''}</p>`:''}${state?.updated?`<small>Snapshot: ${date(state.updated)}</small>`:''}${rows.map(e=>{
  const s=structures.find(s=>s.id===e.structure_id),minutes=Math.max(0,Math.ceil((Date.parse(e.chunk_arrival_time)-now)/60000));
  const remaining=minutes?`${Math.floor(minutes/1440)}d ${Math.floor(minutes%1440/60)}h ${minutes%60}m`:'Ready to fracture';
  return `<article class="moon-extraction"><div class="moon-refinery"><img src="https://images.evetech.net/types/${Number(s?.type_id)||35835}/icon?size=64" alt="${esc(s?.type_name||'Refinery')}"><span><strong>${esc(s?.name||'Structure '+e.structure_id)}</strong><small>${esc(s?.system||'Moon '+e.moon_id)}</small></span></div><div><small>Time to Fracture</small><strong data-moon-fracture="${esc(e.chunk_arrival_time)}">${remaining}</strong></div><div><small>Fracture Time · ready from</small><strong>${date(e.chunk_arrival_time)}</strong><small>Automatic fracture: ${date(e.natural_decay_time)}</small></div>${estimateView(e.estimate)}</article>`;
 }).join('')}${!rows.length&&!warning?'<strong>No Extractions</strong>':''}</section>`;
}
