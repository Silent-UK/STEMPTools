import {extractionRows,piDashboardView,piSettingsView,piTargetList} from "./pi-view.mjs";
import {subscriptionStatus} from "./subscription.mjs";
import {missingSkillText} from "./skill-export.mjs";
import {anarchyProgress,denLevel,workforceImpact,activeOperations,denTotals} from "./den-model.mjs";
const themes = {nebula:"Nebula", caldari:"Caldari blue", amarr:"Amarr gold", gallente:"Gallente green", minmatar:"Minmatar rust"};
function applyTheme(name) {
 document.documentElement.dataset.theme = Object.hasOwn(themes,name) ? name : "nebula";
 try {localStorage.setItem("stemp-theme",document.documentElement.dataset.theme);}catch{}
}
try {applyTheme(localStorage.getItem("stemp-theme")||"nebula");}catch{applyTheme("nebula");}
const accountIcon = (type) => `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">${type==="theme" ? '<path d="M12 3a9 9 0 1 0 0 18h1a2 2 0 0 0 1-3.7 1.5 1.5 0 0 1 .8-2.8H17a4 4 0 0 0 4-4C21 6.4 17 3 12 3Z"/><circle cx="7.5" cy="10" r="1"/><circle cx="11" cy="7" r="1"/><circle cx="16" cy="8.5" r="1"/>' : '<path d="M10 4H4v16h6M14 8l4 4-4 4M8 12h11"/>'}</svg>`;
const eveIcon = (id) =>
  Number(id) > 0
    ? `<img class="eve-icon" loading="lazy" src="https://images.evetech.net/types/${Number(id)}/icon?size=64" alt="">`
    : "";
import { splitQueue, skillGroups } from "./view-models.mjs";
const root = document.querySelector("#app"),
  dialog = document.querySelector("#dialog");
const esc = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const num = (v) =>
  v == null
    ? "—"
    : Number(v).toLocaleString(undefined, { maximumFractionDigits: 1 });
const date = (v) =>
  v
    ? new Date(v).toLocaleString("en-GB", {
        timeZone: "UTC",
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      }) + " UTC"
    : "Not synced";
const duration = (s) => {
  if (s == null) return "Unavailable";
  if (s <= 0) return "Complete";
  const minutes = Math.ceil(s / 60);
  return `${Math.floor(minutes / 1440)}d ${Math.floor((minutes % 1440) / 60)}h ${minutes % 60}m`;
};
const eta = (v) =>
  v
    ? duration(Math.max(0, (Date.parse(v) - Date.now()) / 1000))
    : "Not provided";
let me,
  chars = [],
  page = location.hash==="#corp-structures"?"corp-structures":location.hash==="#corp"?"admin-corp":"overview",
  selected,
  docs = [],
  assetOffset = 0,
  assetFilters = { q: "", character: "", location: "" },
  renderId = 0,
  toastTimer;
function toast(message) {
  const box = document.querySelector("#toast");
  box.textContent = message;
  box.style.display = "block";
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (box.style.display = "none"), 6500);
}
async function api(path, body, method = "POST") {
  const r = await fetch("/api" + path, {
    cache: "no-store",
    ...(body !== undefined
      ? {
          method,
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        }
      : {}),
  });
  let data;
  try {
    data = await r.json();
  } catch {
    data = { error: "Request failed" };
  }
  if (!r.ok) throw Error(data.error || "Request failed");
  return data;
}
const tag = (text, style = "") =>
  `<span class="tag ${style}">${esc(text)}</span>`;
const portrait = (c) =>
  `<div class="pilot"><img class="portrait" alt="" src="https://images.evetech.net/characters/${Number(c.id)}/portrait?size=64"><div><strong>${esc(c.name)}</strong><small>${(chars.find(x=>x.id===c.id)?.parent_id||c.parent_id)===c.id ? "Main character" : "Alt"}</small></div></div>`;
const empty = (title, text = "") =>
  `<div class="empty"><strong>${esc(title)}</strong>${esc(text)}</div>`;
const table = (heads, rows) =>
  `<div class="tablewrap"><table><thead><tr>${heads.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${rows.join("")}</tbody></table></div>`;
const expandedAltGroups = new Set();
function characterGroups(rows) {
 const byId=new Map(rows.map(c=>[c.id,c]));
 return chars.filter(c=>c.parent_id===c.id).map(main=>({main:byId.get(main.id),name:main.name,id:main.id,alts:chars.filter(c=>c.id!==main.id&&c.parent_id===main.id).map(c=>byId.get(c.id)).filter(Boolean)})).filter(g=>g.main||g.alts.length);
}
function groupedCharacters(rows,renderCharacter) {
 return characterGroups(rows).map(g=>`<div class="character-group">${g.main?renderCharacter(g.main):`<strong>${esc(g.name)}</strong>`}${g.alts.length?`<details class="alt-group" data-alt-group="${g.id}" ${expandedAltGroups.has(g.id)?'open':''}><summary>Alts · ${g.alts.length} · ${esc(g.name)}</summary><div class="alt-members">${g.alts.map(renderCharacter).join('')}</div></details>`:''}</div>`).join('');
}
document.addEventListener('toggle',e=>{if(e.target.isConnected && e.target.matches?.('[data-alt-group]')){const id=Number(e.target.dataset.altGroup);e.target.open?expandedAltGroups.add(id):expandedAltGroups.delete(id);}},true);
function characterOptions(value=selected) {return characterGroups(chars).map(g=>`<optgroup label="${esc(g.name)}"><option value="${g.id}" ${Number(value)===g.id?'selected':''}>${esc(g.name)} · Main</option>${g.alts.map(c=>`<option value="${c.id}" ${Number(value)===c.id?'selected':''}>${esc(c.name)} · Alt</option>`).join('')}</optgroup>`).join('');}
const charOptions=()=>characterOptions();
function canMoveCharacter(c,direction) {
 const siblings=chars.filter(x=>c.parent_id===c.id?x.parent_id===x.id:x.id!==x.parent_id&&x.parent_id===c.parent_id);
 const target=siblings[siblings.indexOf(c)+direction];return !!target&&!target.main;
}
function groupControl(c) {return `<select data-group-char="${c.id}" aria-label="Main or alt group for ${esc(c.name)}" ${c.main?'disabled':''}><option value="${c.id}" ${c.parent_id===c.id?'selected':''}>Main</option>${chars.filter(m=>m.parent_id===m.id&&m.id!==c.id).map(m=>`<option value="${m.id}" ${c.parent_id===m.id?'selected':''}>Alt of ${esc(m.name)}</option>`).join('')}</select>`;}
const nav = [
  ["overview", "◈", "Overview"],
  ["skills", "▤", "Skills & queue"],
  ["clones", "◉", "Clones"],
  ["industry", "⚒", "Industry"],
  ["plans", "◇", "Skill plans"],
  ["fittings", "△", "Fittings"],
  ["dens", "⬡", "Mercenary dens"],
  ["pi", "◎", "Planetary industry"],
  ["assets", "▦", "Asset search"],
];
function shell() {
  root.innerHTML = `<div class="shell"><aside><div class="brand"><img src="https://images.evetech.net/corporations/668298004/logo?size=128" alt="STEMP">STEMP Tools</div><div><nav>${nav.map(([id, icon, name]) => `<button data-nav="${id}" class="${page === id ? "active" : ""}"><span>${icon}</span>${name}</button>`).join("")}</nav>${me.corporation?`<details class="corp-nav" ${page.startsWith("corp-")?"open":""}><summary>Corporation Management</summary><nav><button data-nav="corp-structures" class="${page==="corp-structures"?"active":""}"><span>▥</span>Structures</button><button data-nav="corp-moons" class="${page==="corp-moons"?"active":""}"><span>☾</span>Moon Drills</button></nav></details>`:""}</div>${me.admin ? `<section class="admin-nav"><div class="navlabel">Admin</div><nav>${[["admin-users","♙","Users"],["admin-esi","↻","ESI Status"],["admin-corp","▣","Corp ESI"],["admin","⚙","Invitations"]].map(([id,icon,name])=>`<button data-nav="${id}" class="${page===id?"active":""}"><span>${icon}</span>${name}</button>`).join("")}</nav></section>`:""}<div class="account"><div class="account-person"><img class="portrait" src="https://images.evetech.net/characters/${Number(me.main_id)}/portrait?size=64" alt="${esc(me.name)}"><strong>${esc(me.name)}</strong></div><div class="account-controls"><details class="theme-picker"><summary aria-label="Choose theme" title="Choose theme">${accountIcon("theme")}</summary><div class="theme-options">${Object.entries(themes).map(([id,label])=>`<button data-theme="${id}" aria-pressed="${document.documentElement.dataset.theme===id}"><span class="theme-swatch swatch-${id}"></span>${label}</button>`).join("")}</div></details><button class="account-icon" data-action="logout" aria-label="Sign out" title="Sign out">${accountIcon("logout")}</button></div><p>STEMP Tools · v0.18.0</p></div></aside><main><header class="topbar"><span class="eyebrow">● PRIVATE CHARACTER WORKSPACE</span><div class="actions"><button data-action="update-view" hidden>New data available · Update view</button>${(page === "overview" || page === "pi") ? '<button data-action="sync">↻ Refresh all characters</button>' : ""}<button class="primary" data-action="add-character">+ Add character</button></div></header><div id="content"></div><footer class="footer">EVE Online data provided by CCP Games. Not affiliated with CCP. Cached snapshots · all times UTC.</footer></main></div>`;
}
function intro(title, description, actions = "") {
  return `<div class="intro"><div><h1>${title}</h1><p>${description}</p></div>${actions}</div>`;
}
function login() {
  const invite = new URLSearchParams(location.search).get("invite");
  root.innerHTML = `<div class="login"><section class="login-art"><div class="brand"><img src="https://images.evetech.net/corporations/668298004/logo?size=128" alt="STEMP">STEMP Tools</div><div class="eyebrow">YOUR CHARACTERS. ONE WORKSPACE.</div><h1>A clearer view<br>of your <em>New Eden.</em></h1><p>Train with a purpose. Keep your colonies moving. Bring every character into one private command centre.</p><div class="orbital" aria-hidden="true"></div></section><section class="loginbox"><div>${tag("INVITE-ONLY", "purple")}<h2>Your next move starts here.</h2><p class="muted">Sign in with your main character, then securely connect your alts.</p><a class="button primary" href="/auth/login${invite ? "?invite=" + encodeURIComponent(invite) : ""}">Sign in with EVE Online →</a><small>${invite ? "Your invitation will be redeemed after EVE login." : "Already a member? Sign in above. New pilots need an invitation."}</small><div class="features"><span>◇ Shared skill plans</span><span>△ Fitting skill checks</span><span>◎ All-character PI</span><span>⬡ Mercenary dens</span><span>▦ Asset search</span><span>▤ Skills & queue</span></div><p class="notice">Your character information is private. Only the plans and fittings you choose to share are visible to other members.</p></div></section></div>`;
}
let renderedPage=null, snapshotSignature="", checkingSnapshots=false;
const snapshotKey=rows=>JSON.stringify(rows.map(c=>[c.id,c.job,c.reconnect,c.snapshots,c.errors]));
async function render() {
  const samePage=renderedPage===page, scrollY=window.scrollY;
  const run = ++renderId;
  if(!samePage) shell();
  const content = document.querySelector("#content");
  if(!samePage) content.innerHTML = empty("Loading your workspace…");
  try {
    chars = await api("/characters");
    snapshotSignature=snapshotKey(chars);
    document.querySelector("[data-action=update-view]")?.setAttribute("hidden","");
    selected =
      selected && chars.some((c) => c.id === Number(selected))
        ? selected
        : chars[0]?.id;
    let html = "";
    if (page === "overview") html = overview();
    if (page === "skills") html = await skills();
    if (page === "plans" || page === "fittings") html = await documents();
    if (page === "dens" || page === "pi") html = await operations();
    if (page === "assets") html = await assets();
    if (page === "industry") html = await industry();
    if (page === "clones") html = await clonesPage();
    if (page === "admin") html = await admin();
    if(page.startsWith("admin-"))html=await adminPage();
    if(page.startsWith("corp-"))html=await corporationPage();
    if (run === renderId) {
      content.innerHTML = html;
      renderedPage=page;
      if(page==="pi"&&piDashboard?.targets.length)refreshPIPrices(run);
      if(samePage) window.scrollTo({top:scrollY,behavior:"instant"});
    }
  } catch (e) {
    if (run === renderId)
      content.innerHTML = `<div class="notice error">${esc(e.message)}</div>`;
  }
}
function subscriptionColorClass(state) {
 return state.days===null?'':`subscription-days-${Math.max(0,Math.min(30,state.days))}`;
}
function subscriptionCell(c) {
 const state=subscriptionStatus(c.subscription_end);
 return `<div class="subscription-cell"><input type="date" data-subscription-char="${c.id}" value="${esc(c.subscription_end||'')}" aria-label="Subscription expiry for ${esc(c.name)}" title="Manually recorded expiry date · EVE / UTC"><strong class="subscription-status ${subscriptionColorClass(state)}">${state.label}</strong><small class="subscription-save" role="status"></small></div>`;
}
let overviewExpanded=false;
try {overviewExpanded=localStorage.getItem('stemp-overview-expanded')==='true';}catch{}
function overviewPortrait(c,alts=[]) {
 const toggle=!overviewExpanded&&alts.length?` <span class="muted">—</span> <button class="overview-alt-toggle" data-overview-alts="${c.id}" aria-expanded="${expandedAltGroups.has(c.id)}" aria-controls="overview-alts-${c.id}">Alts (${alts.length}) ${expandedAltGroups.has(c.id)?'▾':'▸'}</button>`:'';
 return portrait(c).replace('</strong>','</strong>'+toggle);
}
function overviewCharacters() {
 const renderCharacter=(c,alts=[])=>`<div class="overview-character-row"><div class="overview-character-identity">${groupControl(c)}${overviewPortrait(c,alts)}</div><div class="numeric">${num(c.total_sp)}</div><div class="numeric">${c.isk==null?"—":c.isk.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</div>${subscriptionCell(c)}<div>${c.reconnect ? tag("Reconnect required", "warn") : c.job ? tag(c.job, "purple") : c.errors.length ? tag("Refresh issue", "warn") : tag(c.snapshots.length ? "Connected" : "Awaiting first sync", "dim")}${c.errors.map((e) => `<small>${esc(e.kind)}: ${esc(e.message)}</small>`).join("")}</div><div>${date(c.snapshots.length ? Math.min(...c.snapshots.map((s) => s.updated)) : null)}</div><div><div class="actions"><button data-sync-char="${c.id}">↻ Sync</button>${c.main ? "" : `<button data-move="${c.id}" data-direction="-1" aria-label="Move ${esc(c.name)} up" ${!canMoveCharacter(c,-1) ? "disabled" : ""}>↑</button><button data-move="${c.id}" data-direction="1" aria-label="Move ${esc(c.name)} down" ${!canMoveCharacter(c,1) ? "disabled" : ""}>↓</button>`}<a class="button" href="/auth/login?link=1">Reconnect</a>${c.main ? "" : `<button class="danger" data-unlink="${c.id}">Unlink</button>`}</div></div></div>`;
 return `<div class="overview-character-scroll"><div class="overview-character-list"><div class="overview-character-row overview-character-head"><span>Character</span><span>Skillpoints</span><span>ISK</span><span>Subscription</span><span>Data status</span><span>Last refreshed</span><span>Actions</span></div>${characterGroups(chars).map(g=>`<div class="overview-character-group">${g.main?renderCharacter(g.main,g.alts):''}${g.alts.length?`<div id="overview-alts-${g.id}" class="overview-alt-rows" ${overviewExpanded||expandedAltGroups.has(g.id)?'':'hidden'}>${g.alts.map(c=>renderCharacter(c)).join('')}</div>`:''}</div>`).join('')}</div></div>`;
}
function overview() {
  const synced = chars.filter((c) => c.snapshots.length === 7).length,
    working = chars.filter((c) => c.job).length,
    issues = chars.filter((c) => c.reconnect || c.errors.length).length;
  return (
    intro(
      "Your capsuleer command",
      "One place for every character, training plan and operation.",
    ) +
    `<div class="cards overview-totals"><div class="card"><div class="label">Total Skillpoints</div><div class="stat">${num(chars.some(c=>c.total_sp!==null)?chars.reduce((n,c)=>n+(c.total_sp||0),0):null)}</div><small>${chars.filter(c=>c.total_sp!==null).length} / ${chars.length} characters synced</small></div><div class="card"><div class="label">Total ISK</div><div class="stat">${num(chars.some(c=>c.isk!==null)?chars.reduce((n,c)=>n+(c.isk||0),0):null)}</div><small>${chars.filter(c=>c.isk!==null).length} / ${chars.length} wallets synced${chars.some(c=>c.isk===null)?' · Reconnect to enable missing wallet access, then sync.':''}</small></div></div><section class="panel"><div class="panelhead"><h2>Your characters</h2><div class="actions overview-view-toggle" aria-label="Character display"><button data-overview-mode="combined" aria-pressed="${!overviewExpanded}">Combine alts</button><button data-overview-mode="expanded" aria-pressed="${overviewExpanded}">Expand</button></div></div>${
      chars.length
        ? overviewCharacters()
        : empty("Add your first character")
    }</section><div class="cards overview-health"><div class="card"><div class="label">Linked characters</div><div class="stat">${chars.length}</div><small>Your mains and their alts.</small></div><div class="card"><div class="label">Complete snapshots</div><div class="stat">${synced}<span class="muted"> / ${chars.length}</span></div><small>${working ? working + " character refreshes queued" : "Background refresh every hour"}</small></div><div class="card"><div class="label">Needs attention</div><div class="stat">${issues}</div><small>Connection or data refresh issues</small></div></div>`
  );
}
let trainingOverview=[], selectedTrainingKey="", showTrainingAlts=false, selectedSkillsSnapshot=null;
function trainingKey(row) {const q=splitQueue(row?.queue||[]).current;return q ? `${q.queue_position}:${q.skill_id}:${q.finish_date}` : "none";}
function trainingCards() {
 const visible=characterGroups(trainingOverview).flatMap(g=>[...(g.main?[g.main]:[]),...(showTrainingAlts?g.alts:[])]);
 return visible.map(c=>{const current=splitQueue(c.queue).current;return `<button class="training-card" data-select-char="${c.id}" aria-pressed="${Number(selected)===c.id}"><img class="portrait" src="https://images.evetech.net/characters/${c.id}/portrait?size=64" alt=""><span><strong>${esc(c.name)}</strong><small>${c.total_sp==null ? "Awaiting sync" : num(c.total_sp)+" SP"}</small><span class="training-skill">${current ? `${esc(current.name)} · ${current.finished_level}` : c.updated ? "No scheduled training" : "Queue unavailable"}</span><small>${current ? eta(current.finish_date)+" remaining" : ""}</small></span></button>`;}).join('');
}
setInterval(()=>{
 if(page!=="skills" || !document.querySelector("#training-overview"))return;
 document.querySelectorAll(".training-card[data-select-char]").forEach(tile=>{
 const c=trainingOverview.find(c=>c.id===Number(tile.dataset.selectChar));
 if(!c)return;
 const current=splitQueue(c.queue).current;
 tile.querySelector(".training-skill").textContent=current?`${current.name} · ${current.finished_level}`:c.updated?"No scheduled training":"Queue unavailable";
 tile.querySelector("span>small:last-child").textContent=current?eta(current.finish_date)+" remaining":"";
 });
 document.querySelectorAll("[data-training-until]").forEach(el=>el.textContent=eta(el.dataset.trainingUntil));
 const key=trainingKey(trainingOverview.find(c=>c.id===Number(selected)));
 if(key!==selectedTrainingKey && !dialog.open && !document.activeElement?.matches("input,select,textarea")){
 selectedTrainingKey=key;
 // Only replace the training panel at a queue boundary, leaving the page and open skills alone.
 const s=selectedSkillsSnapshot?.id===Number(selected)?selectedSkillsSnapshot.snapshot:null;
 if(s?.data){const template=document.createElement("template");template.innerHTML=trainingPanel(s);const old=document.querySelector(".current-training");if(old){const y=window.scrollY,queueScroll=old.querySelector(".training-queue-scroll")?.scrollTop||0;old.replaceWith(template.content.firstElementChild);const queue=document.querySelector(".training-queue-scroll");if(queue)queue.scrollTop=queueScroll;window.scrollTo({top:y,behavior:"instant"});}}

 }
},10000);
function trainingPanel(s) {
 const data=s.data;const {current,waiting}=splitQueue(data.queue);
 return `<section class="panel compact current-training"><div class="panelhead"><h2>Currently training</h2><small>${num(data.skills.total_sp)} SP · Snapshot ${date(s.updated)}</small></div>${current ? `<div class="production"><strong>${esc(current.name)} · Level ${current.finished_level}</strong><span><span data-training-until="${esc(current.finish_date)}">${eta(current.finish_date)}</span> remaining · ${date(current.finish_date)}</span></div>` : "<small>No active training reported</small>"}<h3>Training queue · ${waiting.length}</h3>${
      waiting.length
        ? `<div class="training-queue-scroll" role="region" aria-label="Training queue" tabindex="0">` + table(
            ["Skill", "Level", "Finishes", "Remaining"],
            waiting.map(
              (q) =>
                `<tr><td><span class="icon-label">${eveIcon(q.skill_id)}${esc(q.name)}</span></td><td>${q.finished_level}</td><td>${date(q.finish_date)}</td><td>${q.finish_date ? `<span data-training-until="${esc(q.finish_date)}">${eta(q.finish_date)}</span>` : "Not scheduled"}</td></tr>`,
            ),
          ) + "</div>"
        : "<small>No further skills queued</small>"
    }</section>`;
}
async function skills() {
  trainingOverview = await api("/skills/overview");
  selectedTrainingKey=trainingKey(trainingOverview.find(c=>c.id===Number(selected)));
  const s = selected
    ? await api("/characters/" + selected + "/skills")
    : { data: null };
  const data = s.data;
  selectedSkillsSnapshot={id:Number(selected),snapshot:s};
  const heading = intro(
    "Skills & training queue",
    "Current skills and EVE’s reported training schedule.",
    `<div class="actions">${selected ? `<button data-sync-char="${selected}">↻ Sync character</button>` : ""}</div>`,
  ) + `<div class="training-visibility"><button data-action="training-alts" aria-pressed="${showTrainingAlts}">${showTrainingAlts?"Hide alts":"Show alts"}</button></div><div id="training-overview" class="training-overview">${trainingCards()}</div><small class="training-note">Training follows the saved EVE schedule between syncs. SP totals are from the last snapshot.</small>`;
  if (!data) return heading + empty("Skills have not synced yet");
  return (
    heading +
    trainingPanel(s) + `<div class="skill-level-tiles">${Array.from({length:6},(_,level)=>`<div class="card"><small title="Injected skills at trained level ${level}, from the last sync">Skills at ${level}</small><strong>${data.skills.skills.filter(s=>s.trained_skill_level===level).length}</strong></div>`).join('')}</div><section class="panel compact"><div class="panelhead"><h2>Trained skills</h2><input id="skill-filter" placeholder="Filter skills…" aria-label="Filter skills"></div>${skillGroups(
      data.skills.skills,
    )
      .map(
        (g) =>
          `<details class="skill-group"><summary><svg class="skillbook" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M12 5v15M3 4c4-1 6 0 9 1 3-1 5-2 9-1v15c-4-1-6 0-9 1-3-1-5-2-9-1Z"/></svg>${esc(g.name)} <span class="muted">· ${g.skills.length} skills · ${num(g.skills.reduce((n, s) => n + s.skillpoints_in_skill, 0))} SP</span></summary>${table(
            ["Skill", "Trained", "Active", "SP"],
            g.skills.map(
              (s) =>
                `<tr data-skill="${esc(s.name.toLowerCase())}"><td><span class="icon-label">${eveIcon(s.skill_id)}${esc(s.name)}</span></td><td>${s.trained_skill_level}</td><td>${s.active_skill_level}</td><td>${num(s.skillpoints_in_skill)}</td></tr>`,
            ),
          )}</details>`,
      )
      .join("")}</section>`
  );
}
async function documents() {
  docs = await api("/documents");
  const kind = page === "plans" ? "plan" : "fitting",
    rows = docs.filter((d) => d.kind === kind);
  return (
    intro(
      kind === "plan" ? "Skill plans" : "Fitting hangar",
      kind === "plan"
        ? "Create a training goal. See exactly what each character still needs."
        : "Save EFT setups, share with members and check pilot skill requirements.",
      `<button class="primary" data-create="${kind}">+ New ${kind}</button>`,
    ) +
    (kind === "fitting"
      ? '<div class="notice">Skill readiness checks the hull and fitted items. It does not simulate CPU, powergrid, damage, tank or fitting legality.</div>'
      : `<div class="cards plan-totals"><div class="card"><small>Personal plans</small><strong>${rows.filter(d=>d.mine&&!d.shared).length}</strong></div><div class="card"><small>Corp plans</small><strong>${rows.filter(d=>d.shared).length}</strong><small>Shared with signed-in Tools members</small></div></div>`) +
    `<section class="panel">${
      rows.length
        ? table(
            ["Name", "Created by", "Visibility", ""],
            rows.map(
              (d) =>
                `<tr><td><button class="fitting-name" data-document="${esc(d.id)}">${d.kind === "fitting" && d.ship ? `<img class="fitting-list-ship" src="https://images.evetech.net/types/${Number(d.ship.id)}/render?size=64" alt="${esc(d.ship.name)}" loading="lazy">` : ""}${esc(d.name)}</button><small>${date(d.updated)}</small></td><td>${esc(d.author)} ${d.mine ? tag("YOURS", "dim") : ""}</td><td>${tag(d.shared ? "Members" : "Private", d.shared ? "purple" : "dim")}</td><td><button data-document="${esc(d.id)}" aria-expanded="false">${d.kind === "fitting" ? "View" : "Open & compare →"}</button></td></tr>${d.kind === "fitting" ? `<tr class="fitting-expansion" data-fitting-row="${esc(d.id)}" hidden><td colspan="4"><div class="inline-fitting" data-fitting-content="${esc(d.id)}"></div></td></tr>` : ""}`,
            ),
          )
        : empty(
            "No " + (kind === "plan" ? "skill plans" : "fittings") + " yet",
            "Create your first one or ask another member to share theirs.",
          )
    }</section>`
  );
}
let piDashboard=null,piDraftTargets=[];
async function refreshPIPrices(run){
 const prices=await api("/pi/prices").catch(()=>[]);
 if(page!=="pi"||renderId!==run)return;
 let total=0,missing=false;
 for(const t of piDashboard.targets){
  const quote=prices.find(p=>p.id===t.id),amount=t.existing+t.additional;
  const value=amount===0?0:quote?.price!=null?amount*quote.price:null;
  if(value===null)missing=true;else total+=value;
  const cell=document.querySelector(`[data-pi-value="${t.id}"]`),note=document.querySelector(`[data-pi-price="${t.id}"]`);
  if(cell)cell.textContent=value===null?"Unavailable":num(value)+" ISK";
  if(note)note.textContent=quote?.price!=null?`${num(quote.price)} ISK / unit · Jita IV–4 · ${date(quote.updated)}`:"Jita sell price unavailable";
 }
 const grand=document.querySelector('#pi-combined-value');
 if(grand)grand.textContent=missing?"Incomplete pricing":num(total)+" ISK";
}
async function operations() {
  const kind = page === "pi" ? "pi" : "dens",
    rows = await api("/operations/" + kind);
  const populated = rows.filter(c => Array.isArray(c.data) && c.data.length > 0);
  const pending = rows.filter(c => !Array.isArray(c.data) || c.error).length;
  if(kind==="pi")piDashboard=await api("/pi/dashboard");
  if(kind==="dens") denPrice=await api("/market/keys").catch(()=>({price:null}));
  return (
    intro(
      kind === "pi" ? "Planetary industry" : "Mercenary dens",
      kind === "pi"
        ? "Your colonies, production programmes and launchpad inventory."
        : "Every linked character’s dens and available tactical operations.",
      kind==="pi"?'<button data-action="pi-settings">⚙ Settings</button>':"",
    ) +
    (kind==="dens" ? denOverview(rows) : piDashboardView(piDashboard)) +
    `<div class="notice">${kind === "pi" ? "Extraction shows programme-average units/hour. Factory rates are configured capacity, not guaranteed output. Stock is from the last EVE snapshot." : "Stored keys and anarchy reflect the last sync. ISK values use EVE’s market average, before fees. Upcoming spawn times are not included in the available ESI data."}</div>` +
    (pending ? `<div class="notice">${pending} character${pending === 1 ? '' : 's'} awaiting a successful sync. Use Refresh all characters to retry.</div>` : '') +
    (populated.length ? groupedCharacters(populated,
        (c) =>
          `<section class="panel"><div class="panelhead">${portrait(c)}<div class="actions"><small>${date(c.updated)}</small><button data-sync-char="${c.id}">↻ Sync character</button></div></div>${c.error ? `<div class="notice error">${esc(c.error)}</div>` : ""}${!c.data ? empty("Awaiting first sync") : kind === "pi" ? planets(c.data) : dens(c.data)}</section>`,
      ) : empty(kind === "pi" ? "No planetary colonies reported" : "No Mercenary Dens reported", pending ? "Some characters still need a successful sync." : "None of your synced characters have any."))
  );
}
function planets(rows) {
  if (!rows.length) return empty("No colonies reported");
  const types = {
    temperate: 11,
    ice: 12,
    gas: 13,
    oceanic: 2014,
    lava: 2015,
    barren: 2016,
    storm: 2017,
    plasma: 2063,
    shattered: 30889,
  };
  return `<small>${rows.length} of up to 6 planets occupied</small><div class="planetgrid">${rows.map((p) => `<article class="planet"><div class="planet-heading"><img src="https://images.evetech.net/types/${p.info?.type_id || types[p.planet_type] || 11}/icon?size=64" alt="${esc(p.planet_type)} planet"><div><strong>${esc(p.systemName)}</strong><small>${esc(p.info?.name || p.planet_id)} · ${esc(p.planet_type)}</small></div></div><div class="planet-mode">${esc(p.mode)}${p.production.some(r=>r.kind==="Extractor")?"":` · ${tag(p.status,"dim")}`}</div><small>${p.resetAt ? `Extractor reset: <span data-reset="${esc(p.resetAt)}">${Date.parse(p.resetAt) <= Date.now() ? "Reset needed" : eta(p.resetAt)}</span>` : "No extraction programme"}</small>${extractionRows(p,piDashboard.settings)}${p.finalProducts.length ? p.finalProducts.map((r) => `<div class="planet-product"><div class="planet-product-line"><strong class="icon-label">${eveIcon(r.type_id)}${esc(r.name)}</strong>${p.production.some(r=>r.kind==="Extractor")?"":`<span title="Configured factory capacity; input supply may reduce output">- ${num(r.perHour)}/hr capacity</span>`}</div><small>${num(r.stored)} in launchpads</small></div>`).join("") : "<small>No final product configured</small>"}<details><summary>All production & storage</summary>${p.production.map((r) => `<div class="production"><span>${esc(r.name)}<small>${esc(r.kind)} · ${esc(r.status)}</small></span><strong>${num(r.perHour)}/h</strong></div>`).join("")}<h3>Storage</h3>${p.storage.map((l) => `<small>${esc(l.kind)} ${l.id}</small>${l.contents.length ? l.contents.map((i) => `<div class="production"><span>${esc(i.name)}</span><strong>${num(i.amount)}</strong></div>`).join("") : "<small>Empty</small>"}`).join("")}</details></article>`).join("")}</div>`;
}
setInterval(
  () =>
    document.querySelectorAll("[data-reset]").forEach((el) => {
      el.textContent =
        Date.parse(el.dataset.reset) <= Date.now()
          ? "Reset needed"
          : eta(el.dataset.reset);
    }),
  10000,
);
let denPrice={price:null};
function denOverview(rows) {
 const t=denTotals(rows), complete=rows.every(c=>c.data && !c.error), mtoComplete=rows.every(c=>(c.data||[]).every(d=>!d.operations_error));
 const cards=[["Dens",num(t.count),`${t.active} running`],["Stored keys",num(t.keys),"Infomorph Decryption Keys"],["Estimated value",denPrice.price==null?"Unavailable":num(t.keys*denPrice.price)+" ISK",denPrice.price==null?"Market price unavailable":num(denPrice.price)+" ISK / key"],["MTOs ready",num(t.ready),t.next?"Next expiry: "+eta(t.next):"No active expiry"],["Workforce impact",num(t.impacting),"Dens reducing workforce"]];
 return `<div class="den-toolbar"><small>${complete&&mtoComplete?'All linked characters':'Partial totals · some data is missing or needs a sync'}</small><button data-action="sync">↻ Sync all characters</button></div><div class="den-stats">${cards.map(([label,value,detail])=>`<article><small>${label}</small><strong>${value}</strong><small>${detail}</small></article>`).join('')}</div>`;
}
function denMeter(stat,anarchy=false) {
 const level=denLevel(stat?.level), progress=anarchy?anarchyProgress(stat):null;
 return `<div class="den-level ${anarchy?'anarchy':''}" aria-label="Level ${level??'unknown'}${progress?`, ${Math.round(progress.percent)}% towards level ${progress.next}`:''}">${[1,2,3,4].map(n=>progress?.next===n?`<span class="progress-ring progress-${Math.round(progress.percent)}" title="${Math.round(progress.percent)}% towards level ${n}" aria-label="${Math.round(progress.percent)}% towards level ${n}"><i>${n}</i></span>`:`<span class="${level!==null&&n<=level?'filled':''}">${n}</span>`).join('')}</div><small>${level===null?'Unknown':`Level ${level} · ${num(stat?.amount)} / 100`}</small>`;
}
function dens(rows) {
 if(!rows.length)return empty("No Mercenary Dens reported");
 return `<div class="den-table">${table(["Den / planet","State","Keys / estimated ISK","Development","Anarchy","Workforce","Operations"],rows.map(d=>{
 const impact=workforceImpact(d), ops=activeOperations(d);
 return `<tr><td><strong class="icon-label">${eveIcon(d.type_id)}${esc(d.planet?.name||d.skyhook?.planet_id)}</strong><small>Den ${esc(d.id)}</small>${d.reinforcement_timer?`<small class="pilot-missing">Reinforced · ${date(d.reinforcement_timer.end)}</small>`:''}</td><td>${tag(d.state,d.state==='Running'?'':'warn')}</td><td><strong>${num(d.infomorphs?.amount)}</strong><small>${denPrice.price==null?'Value unavailable':num((d.infomorphs?.amount||0)*denPrice.price)+' ISK'}</small></td><td>${denMeter(d.evolution?.development)}</td><td>${denMeter(d.evolution?.anarchy,true)}</td><td>${tag(impact==null?'Unknown':impact===0?'No impact':'−'+impact+'%',impact>0?'warn':'')}<small>${impact>0?'Workforce reduction':''}</small></td><td>${d.operations_error?`<small class="pilot-missing">${esc(d.operations_error)}</small>`:''}${ops.length?ops.map(o=>`<details class="den-operation"><summary>${esc(o.definition?.name?.en||'Tactical operation')} · ${esc(o.state)}<small><span data-den-expiry="${esc(o.expires)}">Expires in ${eta(o.expires)}</span></small></summary><small>${date(o.expires)} UTC</small>${o.definition?`<p>${esc(o.definition.description?.en||'')}</p><small>Anarchy ${num(o.definition.anarchyImpact)} · Development +${num(o.definition.developmentImpact)}</small>`:''}</details>`).join(''):d.operations_error?'':'<small>No active MTOs reported</small>'}</td></tr>`;
 }))}</div>`;
}
function blueprintStations(blueprints) {
 const stations=new Map();
 for(const b of blueprints) {
   const key=String(b.root_location_id || b.location || b.location_id);
   if(!stations.has(key)) stations.set(key,{name:b.location || "Location "+b.location_id,items:[]});
   stations.get(key).items.push(b);
 }
 return [...stations.values()].sort((a,b)=>a.name.localeCompare(b.name)).map(station=>{
 const items=station.items.sort((a,b)=>Number(a.quantity===-2)-Number(b.quantity===-2)||a.name.localeCompare(b.name));
 const originals=items.filter(b=>b.quantity!==-2).reduce((n,b)=>n+(b.quantity>0?b.quantity:1),0);
 const copies=items.filter(b=>b.quantity===-2).length;
 return `<details class="blueprint-station asset-location compact"><summary><strong>${esc(station.name)}</strong><span class="muted"> · ${num(originals)} originals · ${num(copies)} copies</span></summary>${table(["Blueprint","Type","Quantity","ME","TE","Runs left"],items.map(b=>`<tr data-blueprint="${esc((b.name+" "+station.name).toLowerCase())}"><td><span class="icon-label">${eveIcon(b.type_id)}${esc(b.name)}</span></td><td>${b.quantity===-2?"Copy":"Original"}</td><td>${num(b.quantity>0?b.quantity:1)}</td><td>${num(b.material_efficiency)}%</td><td>${num(b.time_efficiency)}%</td><td>${b.quantity===-2?num(b.runs):"Unlimited"}</td></tr>`))}</details>`;
 }).join("");
}
function implantList(items) {return items.length ? items.map(i=>`<span class="clone-implant">${eveIcon(i.id)}${esc(i.name)}</span>`).join("") : '<small>No implants</small>';}
function cloneTimer(v) {return !v || Date.parse(v)<=Date.now() ? "Now" : eta(v);}
function cloneLocations(clones) {
 const locations=new Map();
 for(const clone of clones) {
  const key=String(clone.location_id);
  if(!locations.has(key))locations.set(key,{name:clone.location,clones:[]});
  locations.get(key).clones.push(clone);
 }
 return [...locations.values()].sort((a,b)=>a.name.localeCompare(b.name)).map(location=>`<details class="asset-location compact"><summary><strong>${esc(location.name)}</strong><span class="muted"> · ${location.clones.length} ${location.clones.length===1?'clone':'clones'}</span></summary>${location.clones.sort((a,b)=>(a.name||'').localeCompare(b.name||'')).map(clone=>`<div class="clone-location-entry"><strong>${esc(clone.name||'Unnamed clone')}</strong><div class="clone-implants">${implantList(clone.implants)}</div></div>`).join('')}</details>`).join('') || '<small>No stored jump clones</small>';
}
async function clonesPage() {
 const chars=await api("/operations/clones");
 return intro("Clones","Jump clones sorted by location. Readiness is estimated from the last EVE snapshot.")+'<small>Switching clones within the same Upwell structure can bypass the jump cooldown. Destination access and other in-game restrictions still apply.</small><div class="clone-grid">'+groupedCharacters(chars,c=>`<section class="panel compact"><div class="panelhead">${portrait(c)}<div class="actions"><small>${date(c.updated)}</small><button data-sync-char="${c.id}">↻ Sync character</button></div></div>${c.error?`<div class="notice error">${esc(c.error)} <a href="/auth/login?link=1">Reconnect character</a></div>`:""}${!c.data?empty("Awaiting clone sync"):`<div class="clone-readiness"><strong>Next Clone Jump</strong> - <span data-clone-ready="${esc(c.data.ready_at||"")}">${cloneTimer(c.data.ready_at)}</span></div><div class="clone-capacity" title="Stored jump clones / capacity from active Infomorph Psychology skills; excludes your active body">Total Clones <strong>${c.data.clones.length}/${c.data.capacity??'—'}</strong></div><details class="clone-active asset-location" open><summary>Active clone · ${c.data.active_implants.length} implants</summary><div class="clone-implants">${implantList(c.data.active_implants)}</div></details>${cloneLocations(c.data.clones)}`}</section>`)+'</div>';
}
setInterval(()=>document.querySelectorAll("[data-clone-ready]").forEach(el=>el.textContent=cloneTimer(el.dataset.cloneReady)),10000);
function characterTiles(rows,label) {
 return `<div class="training-overview character-picker">${characterGroups(rows).flatMap(g=>[...(g.main?[g.main]:[]),...g.alts]).map(c=>`<button class="training-card" data-select-char="${c.id}" aria-pressed="${Number(selected)===c.id}"><img class="portrait" src="https://images.evetech.net/characters/${c.id}/portrait?size=64" alt=""><span><strong>${esc(c.name)}</strong><small>${label(c)}</small></span></button>`).join('')}</div>`;
}
async function industry() {
  const rows = await api("/operations/industry");
  const activities = {
    1: "Manufacturing",
    3: "TE research",
    4: "ME research",
    5: "Copying",
    7: "Reverse engineering",
    8: "Invention",
    9: "Reaction",
    11: "Reaction",
  };
  return (
    intro(
      "Industry",
      "Jobs and blueprints across your characters. Updated hourly.",
    ) +
    characterTiles(rows,c=>c.data?`Jobs - ${c.data.jobs.filter(j=>j.status==="active"&&Date.parse(j.end_date)>Date.now()).length}`:"Awaiting sync") +
    `<div class="toolbar"><input class="blueprint-filter" aria-label="Search blueprints across all characters" placeholder="Search blueprints across all characters…"><small id="blueprint-results" role="status"></small></div>` +
    rows.map(
        (c) =>
          `<section class="panel compact industry-character" data-industry-char="${c.id}" ${c.id===Number(selected)?'':'hidden'}><div class="panelhead">${portrait(c)}<div class="actions"><small>${date(c.updated)}</small><button data-sync-char="${c.id}">↻ Sync character</button></div></div>${c.error ? `<div class="notice error">${esc(c.error)} <a href="/auth/login?link=1">Reconnect character</a></div>` : ""}${
            !c.data
              ? empty("Awaiting Industry sync")
              : `<h3>Jobs · ${c.data.jobs.length}</h3>${
                  c.data.jobs.length
                    ? table(
                        [
                          "Product / blueprint",
                          "Activity",
                          "Runs",
                          "Status",
                          "Finishes",
                          "Location",
                        ],
                        c.data.jobs
                          .sort(
                            (a, b) =>
                              Date.parse(a.end_date) - Date.parse(b.end_date),
                          )
                          .map(
                            (j) =>
                              `<tr><td><span class="icon-label">${eveIcon(j.product_type_id || j.blueprint_type_id)}${esc(j.name)}</span></td><td>${esc(activities[j.activity_id] || "Activity " + j.activity_id)}</td><td>${num(j.runs)}</td><td>${esc(j.status === "active" && Date.parse(j.end_date) <= Date.now() ? "Ready (estimated)" : j.status)}</td><td>${date(j.end_date)}<small>${j.status === "active" ? eta(j.end_date) : ""}</small></td><td>${esc(j.location)}</td></tr>`,
                          ),
                      )
                    : "<small>No current jobs</small>"
                }<details class="blueprint-inventory"><summary>Blueprints · ${num(c.data.blueprints.length)}</summary>${
                  c.data.blueprints.length
                    ? blueprintStations(c.data.blueprints)
                    : "<small>No blueprints reported</small>"
                }</details>`
          }</section>`,
      ).join('')
  );
}
function assetCharacterGroups(items) {
 const owners=chars.filter(c=>items.some(a=>a.character_id===c.id));
 return owners.map(c=>`<strong>${esc(c.name)}</strong>${table(["Item","Quantity","Container / flag"],items.filter(a=>a.character_id===c.id).sort((a,b)=>a.name.localeCompare(b.name)).map(a=>`<tr><td><span class="icon-label">${eveIcon(a.type_id)}${esc(a.name)}</span></td><td>${num(a.quantity)}</td><td>${a.location_id!==a.root_location_id?'Container '+a.location_id+' · ':''}${esc(a.location_flag)}</td></tr>`))}`).join('');
}
async function assets() {
  assetFilters.character=String(selected||"");
  const qs = new URLSearchParams({ ...assetFilters, offset: assetOffset });
  const data = await api("/assets?" + qs);
  return (
    intro("Asset search", "Select a character to search their assets.") + characterTiles(chars,c=>c.snapshots.some(s=>s.kind==="assets")?"Assets synced":"Awaiting sync") +
    `<form id="asset-search" class="toolbar"><input name="q" aria-label="Item name" placeholder="Search item name…" value="${esc(assetFilters.q)}"><input type="hidden" name="character" value="${Number(selected)||''}"><input name="location" aria-label="Location" placeholder="Filter location…" value="${esc(assetFilters.location)}"><button class="primary">Search</button></form><section class="panel"><div class="panelhead"><h2>${num(data.total)} matching stacks</h2><small>${data.locationCount ? assetOffset + 1 : 0}–${Math.min(assetOffset + 20, data.locationCount)} of ${num(data.locationCount)} locations</small></div>${
      data.locations.length
        ? data.locations
            .map(
              (l) =>
                `<details class="asset-location compact"><summary>${eveIcon(l.type_id)}<strong>${esc(l.name)}</strong>${l.type_name ? `<span class="location-type"> · ${esc(l.type_name)}</span>` : ""}<span class="muted"> · ${num(l.items.length)} stacks · ${num(l.items.reduce((n, a) => n + a.quantity, 0))} items</span></summary>${assetCharacterGroups(l.items)}</details>`,
            )
            .join("")
        : empty(
            "No matching assets",
            "An empty result may mean the first asset sync has not completed.",
          )
    }<div class="actions"><button data-page-assets="-1" ${assetOffset === 0 ? "disabled" : ""}>Previous</button><button data-page-assets="1" ${assetOffset + 20 >= data.locationCount ? "disabled" : ""}>Next</button></div></section><section class="panel"><h2>Snapshot freshness</h2>${groupedCharacters(data.sources.filter(c=>c.id===Number(selected)),(c) => `<div class="production"><span>${esc(c.name)}</span><div class="actions"><small>${date(c.updated)}</small><button data-sync-char="${c.id}">↻ Sync</button></div></div>`)}</section>`
  );
}
const corpFuel = (s,rate,stock) => rate==null||stock==null?null:rate===0?stock:Math.max(0,stock-rate*Math.max(0,Date.now()-s.inventory_at)/3600000);
function corpRunway(s){
 const deadlines=[];
 if(s.fuel_expires)deadlines.push({at:Date.parse(s.fuel_expires),label:"Blocks · ESI"});
 if(s.rate>0&&s.fuel!=null)deadlines.push({at:s.inventory_at+s.fuel/s.rate*3600000,label:"Blocks · estimated"});
 if(s.gas_rate>0&&s.gas!=null)deadlines.push({at:s.inventory_at+s.gas/s.gas_rate*3600000,label:"Gas · estimated"});
 const first=deadlines.filter(d=>Number.isFinite(d.at)).sort((a,b)=>a.at-b.at)[0];
 return first?`<span class="${first.at<Date.now()+3*86400000?"corp-danger":first.at<Date.now()+7*86400000?"corp-warning":"corp-good"}">${first.at<=Date.now()?"Fuel due":eta(new Date(first.at).toISOString())}</span><small>${esc(first.label)} · ${date(first.at)}</small>`:s.rate===0?"Services offline":"Unknown";
}
function corpStock(s){return `<strong>${num(s.fuel)} blocks</strong><small>${s.rate==null?"Rate unknown":num(s.rate)+" / hour"}</small>${s.gas!=null?`<small>${num(s.gas)} Magmatic Gas · ${s.gas_rate==null?"rate unknown":num(s.gas_rate)+" / hour"}</small>`:""}`;}
function corpTopup(s,days){
 const block=corpFuel(s,s.rate,s.fuel),gas=corpFuel(s,s.gas_rate,s.gas);
 return `${block==null?"Unknown blocks":num(Math.max(0,Math.ceil(s.rate*24*days-block)))+" blocks"}${s.kind==="Moon Drill"?`<small>${gas==null?"Unknown gas":num(Math.max(0,Math.ceil(s.gas_rate*24*days-gas)))+" gas"}</small>`:""}`;
}
async function corporationPage(){
 const data=await api("/corporation/structures"),moon=page==="corp-moons",rows=data.structures.filter(s=>!moon||s.kind==="Moon Drill");
 const header=intro(moon?"Moon Drills":"Structures","Sacred Templars · corporation operations",'<button data-action="corp-sync">↻ Sync corporation</button><button data-action="update-view">Update view</button><a href="/auth/login?corporation=1">Reconnect Corp ESI</a>');
 const status=`<p class="muted corp-status">${data.updated?"Snapshot: "+date(data.updated):"Awaiting first sync"} · ${esc(data.job?.status||"Not queued")}${data.job?.error?`<br><span class="corp-warning">${esc(data.job.error)}</span>`:""}</p>`;
 if(!data.updated)return header+status+empty("Corporation data is being collected","Use Update view after the sync completes.");
 const totals=`<div class="corp-totals"><span><strong>${rows.length}</strong> ${moon?"Moon drills":"Structures"}</span><span><strong>${rows.filter(s=>s.timer).length}</strong> State timers</span>${moon?`<span><strong>${num(rows.reduce((n,s)=>n+s.materials.reduce((a,i)=>a+i.quantity,0),0))}</strong> Stored material units</span>`:""}</div>`;
 return header+status+totals+`<p class="muted">${moon?"Stored materials are the current harvest bay. Collections are minimum observed decreases between snapshots; exact collection times and lifetime production are not supplied by ESI.":"Fuel is reported bay stock. Top-ups project 7 or 30 days from now at current service rates; unknown rates stay unknown. Timers and estimates use UTC."}</p><section class="panel corp-rows">${rows.length?rows.map(s=>`<details><summary><span class="corp-name">${eveIcon(s.type_id)}<span><strong>${esc(s.name)}</strong><small>${esc(s.system)} · ${esc(s.type_name)}</small></span></span><span>${esc(moon?s.mining:s.state.replaceAll("_"," "))}${s.timer?`<small>State ends ${date(s.timer)} · ${eta(s.timer)}</small>`:""}</span><span>${corpStock(s)}</span><span>${corpRunway(s)}</span>${moon?`<span>${num(s.materials.reduce((n,i)=>n+i.quantity,0))} units<small>Empty detected: ${s.history.find(h=>h.emptied)?date(s.history.find(h=>h.emptied).to):"Not observed"}</small></span>`:""}</summary><div class="corp-expanded">${moon?`<h3>Harvest bay</h3>${table(["Material","Units"],s.materials.map(i=>`<tr><td>${eveIcon(i.type_id)} ${esc(i.name)}</td><td>${num(i.quantity)}</td></tr>`))}<h3>Observed collections</h3>${s.history.length?s.history.map(h=>`<details><summary>${h.emptied?"Emptied":"Collection observed"} · ${date(h.from)} – ${date(h.to)}</summary>${table(["Material","Minimum removed"],h.items.map(i=>`<tr><td>${esc(i.name)}</td><td>${num(i.quantity)}</td></tr>`))}</details>`).join(""):"No collections observed yet."}`:`<h3>Timers & services</h3><p>${s.timer?"State timer: "+date(s.timer):"No active state timer reported"}${s.reinforce_hour!=null?" · Reinforcement window centred on "+String(s.reinforce_hour).padStart(2,"0")+":00 UTC (±2 hours)":""}${s.unanchors_at?" · Unanchors: "+date(s.unanchors_at):""}</p>${s.services?.map(v=>`<span class="tag">${esc(v.name)} · ${esc(v.state)}</span>`).join(" ")||"Service data not reported"}`}
 <h3>Fuel planning</h3>${table(["Bay snapshot","7-day top-up","30-day top-up"],[`<tr><td>${date(s.inventory_at)}</td><td>${corpTopup(s,7)}</td><td>${corpTopup(s,30)}</td></tr>`])}${s.kind==="POS"?`<small>POS fuel estimates cover recognised standard towers. Faction/unknown rates are not assumed. Strontium and other supplies:</small>${table(["Resource","In bay"],(s.fuels||[]).map(i=>`<tr><td>${esc(i.name)}</td><td>${num(i.quantity)}</td></tr>`))}`:""}</div></details>`).join(""):empty(moon?"No moon drills reported":"No structures reported")}</section>`;
}
function adminCharacterRows(list) {
 return table(["Character","ESI status","Bucket","Next slot","Last attempt","Last data"],list.map(c=>`<tr><td>${esc(c.name)}</td><td>${esc(c.reconnect?"Reconnect required":c.job|| (c.errors.length?"Needs attention":c.updated?"Synced":"Awaiting first sync"))}${c.errors.length?`<details><summary>${c.errors.length} issues</summary>${c.errors.map(e=>`<small>${esc(e.kind)}: ${esc(e.message)}</small>`).join("<br>")}</details>`:""}</td><td>:${String(c.minute).padStart(2,"0")}</td><td>${date(c.next_due)}</td><td>${c.attempted?date(c.attempted):"—"}</td><td>${c.updated?date(c.updated):"—"}</td></tr>`));
}
async function adminPage() {
 if(!me.admin)return "";
 const refresh='<button data-action="update-view">↻ Refresh status</button>';
 if(page==="admin-users") {
  const users=await api("/admin/users");
  return intro("Users","Account and character connection health.",refresh)+`<section class="panel admin-compact">${users.map(u=>`<details class="admin-user"><summary><strong>${esc(u.name)}</strong><span>${u.characters.length} characters</span><small>Last login: ${u.last_login?date(u.last_login):"Not recorded yet"}</small></summary>${adminCharacterRows(u.characters)}</details>`).join("")}</section>`;
 }
 if(page==="admin-esi") {
  const data=await api("/admin/esi");
  return intro("ESI Status","Hourly syncs in six UTC buckets. Manual refresh stays available; characters sync one at a time.",refresh)+`<div class="bucket-grid">${data.buckets.map(m=>{const list=data.characters.filter(c=>c.minute===m);return `<section class="panel"><h2>:${String(m).padStart(2,"0")}</h2><strong>${list.length} characters</strong><small>${list.filter(c=>c.job).length} queued / running</small></section>`}).join("")}</div><section class="panel admin-compact">${adminCharacterRows(data.characters)}</section>`;
 }
 const corps=await api("/admin/corporations");
 return intro("Corp ESI","Connect your Sacred Templars CEO or Director for Corporation Management.",'<a class="button primary" href="/auth/login?corporation=1">+ Connect corporation</a>')+`<section class="panel admin-compact"><p>Read-only access to structures, corporation assets and POS fuel. Membership and CEO/Director status are rechecked before access, with a short ESI verification cache.</p>${corps.length?table(["Corporation","Character","Role","Last verified"],corps.map(c=>`<tr><td>${esc(c.name)}</td><td>${esc(c.character_name)}</td><td>${esc(c.role)}</td><td>${date(c.verified)}</td></tr>`)):empty("No corporation connected")}</section>`;
}
async function admin() {
  const list = await api("/admin/invites");
  return (
    intro(
      "Invitations",
      "Only invited pilots can create a STEMP Tools account.",
      `<button class="primary" data-action="invite">+ Create invitation</button>`,
    ) +
    `<div id="invite-link"></div><section class="panel"><h2>Recent invitations</h2>${
      list.length
        ? table(
            ["Expires", "Status"],
            list.map(
              (i) =>
                `<tr><td>${date(i.expires)}</td><td>${tag(i.used_by ? "Redeemed" : i.expires < Date.now() ? "Expired" : "Available", i.used_by ? "" : "dim")}</td></tr>`,
            ),
          )
        : empty("No invitations created")
    }</section>`
  );
}
function openDialog(html) {
  dialog.classList.remove("fitting-dialog");
  dialog.innerHTML =
    `<div class="panelhead"><h2 id="dialog-title">Workspace</h2><button data-action="close" aria-label="Close dialog">✕</button></div>` +
    html;
  dialog.setAttribute("aria-labelledby", "dialog-title");
  dialog.showModal();
}
let planEntries = [],
  searchResults = [];
function createDocument(kind, body) {
  planEntries = [];
  openDialog(
    `<h2>${kind === "plan" ? "New skill plan" : "New fitting"}</h2><form id="document-form" data-kind="${kind}"><label>Name<input name="name" required maxlength="150" placeholder="${kind === "plan" ? "Avatar pilot" : "Fleet setup"}"></label>${kind === "plan" ? `<div class="formrow"><input id="catalog-query" aria-label="Search catalogue" placeholder="Search a skill or ship…"><select id="catalog-mode" aria-label="Search category"><option value="skills">Skills</option><option value="ships">Ships</option></select><button type="button" data-action="catalog">Find</button></div><div id="catalog-results"></div><details class="skill-import"><summary>Import from clipboard / text</summary><label>Skill list<textarea id="skill-import-text" rows="6" maxlength="100000" placeholder="Motion Prediction III&#10;Motion Prediction V&#10;Gunnery V"></textarea></label><div class="actions"><button type="button" data-action="paste-skills">Paste clipboard</button><button type="button" data-action="import-skills">Import skills</button><small id="skill-import-status" role="status">Repeated skills use the highest level. Existing skills are kept.</small></div></details><div id="plan-entries"></div>` : `<label>EFT fitting<textarea name="eft" required placeholder="[Avatar, Fleet setup]&#10;Damage Control II&#10;&#10;">${esc(body || "")}</textarea></label><small>Paste an EFT export from EVE or Pyfa. Unknown items are reported before saving.</small>`}<label><input type="checkbox" name="shared"> Share with signed-in Tools members</label><button class="primary">Save ${kind}</button></form>`,
  );
}
function showEntries() {
  document.querySelector("#plan-entries").innerHTML = planEntries
    .map(
      (r, i) =>
        `<div class="listrow"><span>${esc(r.name || "Skill " + r.id)} · Level ${r.level}</span><button type="button" data-remove-skill="${i}">Remove</button></div>`,
    )
    .join("");
}
function renderFitting(fit) {
 if(!fit)return "";
 return `<div class="fit-layout"><div class="fit-ship"><img src="https://images.evetech.net/types/${fit.ship.id}/render?size=512" alt="${esc(fit.ship.name)}"><h2>${esc(fit.ship.name)}</h2><small>Saved loadout · skill checks below</small></div><div class="fit-slots">${fit.groups.filter(g=>g.items.length || ["High slots","Mid slots","Low slots","Rigs"].includes(g.name)).map(g=>`<section><h3>${esc(g.name)} <small>· ${g.items.length}</small></h3>${g.items.length ? g.items.map(i=>`<div class="fit-module ${i.empty?'muted':''}">${i.empty ? '<span class="empty-slot">○</span>' : eveIcon(i.id)}<div>${esc(i.name)}${i.quantity>1?` × ${num(i.quantity)}`:""}${(i.charges||[]).map(c=>`<small class="fit-charge">${eveIcon(c.id)}${esc(c.name)}</small>`).join("")}</div></div>`).join("") : '<small>No modules listed</small>'}</section>`).join("")}</div></div><p class="muted">Loadout view only; damage, tank, capacitor and fitting capacity are not simulated.</p>`;
}
function copyMissingControl(rows) {
 const text=missingSkillText(rows);
 return text ? `<div class="missing-copy"><button type="button" data-copy-missing="${esc(encodeURIComponent(text))}">Copy missing skills to clipboard</button><small class="copy-status" role="status"></small><textarea class="copy-fallback" aria-label="Missing skills for EVE" readonly hidden>${esc(text)}</textarea></div>` : '<small>No untrained levels to copy.</small>';
}
function fittingPilots(rows) {
 return `<section class="fitting-pilots"><h3>Connected characters</h3>${groupedCharacters(rows,c=>`<article class="fitting-pilot">${c.ready===false ? `<details><summary class="pilot-status-line"><img class="portrait" src="https://images.evetech.net/characters/${c.id}/portrait?size=64" alt=""><strong>${esc(c.name)}</strong><span>-</span><span class="pilot-missing">Missing Skills</span></summary>${c.missing.map(r=>`<div class="missing-skill"><strong>${esc(r.name)}</strong><small>Level ${r.active} → ${r.required}${r.trained>=r.required?' · Trained but inactive':''}</small></div>`).join('')}${copyMissingControl(c.missing)}</details>` : `<div class="pilot-status-line"><img class="portrait" src="https://images.evetech.net/characters/${c.id}/portrait?size=64" alt=""><strong>${esc(c.name)}</strong><span>-</span><span class="${c.ready?'pilot-ready':'muted'}">${c.ready?'Ready':'Skills not synced'}</span></div>`}</article>`)}</section>`;
}
async function showDocument(id) {
  const d = await api("/documents/" + id);
  const plans=d.kind === "fitting" ? (await api("/documents")).filter(p=>p.kind === "plan") : [];
  const html = (
    `<h2>${esc(d.name)}</h2><div class="actions">${tag(d.shared ? "Shared with members" : "Private", "purple")}${d.mine ? `<button data-share="${id}" data-value="${!d.shared}">${d.shared ? "Make private" : "Share with members"}</button><button data-edit-doc="${id}">Edit</button><button class="danger" data-delete-doc="${id}">Delete</button>` : ""}<button data-copy-doc="${id}">Duplicate</button></div>${d.kind === "fitting" ? `<form id="link-fitting-plan" data-document="${id}" class="toolbar"><label>Required skill plan<select name="plan"><option value="">Fitting requirements only</option>${plans.map(p=>`<option value="${esc(p.id)}" ${p.id===d.linkedPlan?"selected":""}>${esc(p.name)}</option>`).join("")}</select></label><button class="primary">Apply plan</button><small>Saved for your account. Readiness checks fitting + selected plan.</small></form><div class="fitting-workspace"><div>${renderFitting(d.fitting)}</div>${fittingPilots(d.readiness||[])}</div><details><summary>EFT fitting · copy or export</summary><textarea readonly id="eft-export">${esc(d.body)}</textarea><button data-export="${id}">Download EFT</button></details>` : `<details><summary>${d.body.length} skills including prerequisites</summary><div id="plan-view">${d.body.map((r) => `<div class="production"><span>${esc(r.name || r.id)}</span><strong>Level ${r.level}</strong></div>`).join("")}</div></details>${fittingPilots(d.readiness||[])}`}<hr><h3>Check a character</h3><form id="compare" data-document="${id}"><div class="formrow"><select name="character" aria-label="Character">${charOptions()}</select><select name="speed" aria-label="Training speed"><option value="omega">Omega speed</option><option value="alpha">Alpha speed estimate</option></select><button class="primary">Compare</button></div></form><div id="comparison"></div>`
  );
  const holder=[...document.querySelectorAll("[data-fitting-content]")].find(el=>el.dataset.fittingContent===id);
  if(d.kind === "fitting" && holder) {
    document.querySelectorAll("[data-fitting-row]").forEach(row=>{row.hidden=row.dataset.fittingRow!==id;if(row.hidden)row.querySelector(".inline-fitting").innerHTML="";});
    document.querySelectorAll("button[data-document]").forEach(button=>{if(button.textContent==="View"||button.textContent==="Hide"){button.textContent=button.dataset.document===id?"Hide":"View";button.setAttribute("aria-expanded",String(button.dataset.document===id));}});
    holder.innerHTML=html;
  } else {openDialog(html);dialog.classList.toggle("fitting-dialog",d.kind === "fitting");}
}
root.addEventListener("click", async (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  try {
    if(b.dataset.action==='pi-settings') {
      piDraftTargets=[...piDashboard.settings.targets];openDialog(piSettingsView(piDashboard));
    } else if(b.dataset.action==='update-view') {
      await render();
    } else if(b.dataset.action==='training-alts') {
      showTrainingAlts=!showTrainingAlts;
      b.textContent=showTrainingAlts?'Hide alts':'Show alts';b.setAttribute('aria-pressed',String(showTrainingAlts));
      document.querySelector('#training-overview').innerHTML=trainingCards();
    } else if(b.dataset.overviewMode) {
      overviewExpanded=b.dataset.overviewMode==='expanded';
      try{localStorage.setItem('stemp-overview-expanded',String(overviewExpanded));}catch{}
      document.querySelector('#content').innerHTML=overview();
    } else if(b.dataset.overviewAlts) {
      const id=Number(b.dataset.overviewAlts),open=!expandedAltGroups.has(id);
      open?expandedAltGroups.add(id):expandedAltGroups.delete(id);
      document.getElementById('overview-alts-'+id).hidden=!open;
      b.setAttribute('aria-expanded',String(open));b.textContent=b.textContent.replace(/[▾▸]$/,open?'▾':'▸');
    } else if (b.dataset.action === "corp-sync") {
      b.disabled=true;await api("/corporation/sync",{});toast("Corporation refresh queued. EVE cache times are respected.");await render();
    } else if (b.dataset.action === "add-character") {
      openDialog(`<h2>Add character</h2><form id="add-character-form" action="/auth/login" method="get"><input type="hidden" name="link" value="1"><label>Add as<select name="group" id="add-character-group"><option value="main">Main</option><option value="alt">Alt</option></select></label><label id="add-character-parent" hidden>Connected to<select name="parent" disabled>${chars.filter(c=>c.parent_id===c.id).map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select></label><p class="muted">Choose the character on EVE’s login screen. An already-linked character keeps its current group.</p><button class="primary">Continue to EVE login</button></form><hr><a href="/auth/login?corporation=1">Connect Sacred Templars CEO / Director access</a>`);
    } else if (b.dataset.selectChar) {
      selected=Number(b.dataset.selectChar);
      assetOffset=0;
      await render();
    } else if (b.dataset.theme) {
      applyTheme(b.dataset.theme);
      document.querySelectorAll("[data-theme]").forEach(button=>button.setAttribute("aria-pressed",String(button.dataset.theme===b.dataset.theme)));
      b.closest("details").open=false;
    } else if (b.dataset.nav) {
      page = b.dataset.nav;
      assetOffset = 0;
      await render();
    } else if (b.dataset.syncChar) {
      b.disabled = true;
      await api("/characters/" + b.dataset.syncChar + "/sync", {});
      toast("Character refresh queued. EVE cache times are respected.");
      await render();
    } else if (b.dataset.move) {
      const c=chars.find(c=>c.id===Number(b.dataset.move));
      const siblings=chars.filter(x=>c.parent_id===c.id ? x.parent_id===x.id : x.id!==x.parent_id && x.parent_id===c.parent_id);
      const index=siblings.indexOf(c),target=index+Number(b.dataset.direction);
      if(target<0 || target>=siblings.length || siblings[target].main)return;
      const ids=chars.map(c=>c.id),left=ids.indexOf(c.id),right=ids.indexOf(siblings[target].id);
      [ids[left],ids[right]]=[ids[right],ids[left]];
      await api("/characters/order", { ids });
      await render();
    } else if (b.dataset.action === "sync") {
      await api("/sync", {});
      toast("Refresh queued. EVE cache times are respected.");
      await render();
    } else if (b.dataset.action === "logout") {
      await api("/logout", {});
      location.href = "/";
    } else if (b.dataset.unlink) {
      if (confirm("Unlink this alt and remove its saved character data?")) {
        await api("/characters/" + b.dataset.unlink, {}, "DELETE");
        await render();
      }
    } else if (b.dataset.create) createDocument(b.dataset.create);
    else if (b.dataset.document) {
      const row=[...document.querySelectorAll("[data-fitting-row]")].find(el=>el.dataset.fittingRow===b.dataset.document);
      if(row && !row.hidden){row.hidden=true;row.querySelector(".inline-fitting").innerHTML="";document.querySelectorAll("button[data-document]").forEach(button=>{if(button.dataset.document===b.dataset.document&&button.textContent==="Hide"){button.textContent="View";button.setAttribute("aria-expanded","false");}});}
      else await showDocument(b.dataset.document);
    }
    else if (b.dataset.pageAssets) {
      assetOffset = Math.max(
        0,
        assetOffset + 20 * Number(b.dataset.pageAssets),
      );
      await render();
    } else if (b.dataset.action === "invite") {
      const i = await api("/admin/invites", {});
      document.querySelector("#invite-link").innerHTML =
        `<div class="notice">Single-use invitation, valid for 7 days:<input aria-label="Invitation link" readonly value="${esc(i.url)}" class="invite-link-field"></div>`;
    }
  } catch (e) {
    toast(e.message);
  }
});
root.addEventListener("change",async e=>{
 const input=e.target;
 if(!input.dataset.subscriptionChar)return;
 const character=chars.find(c=>c.id===Number(input.dataset.subscriptionChar)), cell=input.closest('.subscription-cell'), feedback=cell.querySelector('.subscription-save');
 input.disabled=true;feedback.textContent='Saving…';
 try {
  const saved=await api('/characters/'+input.dataset.subscriptionChar+'/subscription',{expires_on:input.value||null});
  if(character)character.subscription_end=saved.expires_on;
  const status=subscriptionStatus(saved.expires_on), label=cell.querySelector('.subscription-status');
  label.textContent=status.label;label.className='subscription-status '+subscriptionColorClass(status);feedback.textContent='Saved';
 }catch(error){input.value=character?.subscription_end||'';feedback.textContent='Not saved';toast(error.message);}
 finally{input.disabled=false;}
});
root.addEventListener("change",async e=>{
 if(!e.target.dataset.groupChar)return;
 try{await api("/characters/"+e.target.dataset.groupChar+"/group",{parent_id:Number(e.target.value)});await render();}catch(err){toast(err.message);await render();}
});
root.addEventListener("change", (e) => {
  if (e.target.id === "character-select") {
    selected = e.target.value;
    render();
  }
});
root.addEventListener("input", (e) => {
  if (e.target.classList.contains("blueprint-filter")) {
    const value=e.target.value.trim().toLowerCase();
    const container=document.querySelector("#content");
    container.querySelectorAll("[data-blueprint]").forEach(row=>row.hidden=!row.dataset.blueprint.includes(value));
    container.querySelectorAll(".blueprint-station, .blueprint-inventory, .alt-group").forEach(station=>{
      if(value && !station.dataset.searching){station.dataset.wasOpen=String(station.open);station.dataset.searching="1";}
      station.hidden=![...station.querySelectorAll("[data-blueprint]")].some(row=>!row.hidden);
      if(value)station.open=!station.hidden;
      else if(station.dataset.searching){station.open=station.dataset.wasOpen==="true";delete station.dataset.searching;}
    });
  }
  if (e.target.classList.contains("blueprint-filter")) {
    const searching=!!e.target.value.trim();
    document.querySelectorAll(".industry-character").forEach(section=>section.hidden=searching ? ![...section.querySelectorAll("[data-blueprint]")].some(row=>!row.hidden) : Number(section.dataset.industryChar)!==Number(selected));
    const count=[...document.querySelectorAll("[data-blueprint]")].filter(row=>!row.hidden).length;
    document.querySelector("#blueprint-results").textContent=searching ? `${count} matching blueprint entries across your characters` : "";
  }
  if (e.target.id === "skill-filter") {
    const value = e.target.value.toLowerCase();
    document
      .querySelectorAll("[data-skill]")
      .forEach((row) => (row.hidden = !row.dataset.skill.includes(value)));
    document.querySelectorAll(".skill-group").forEach((group) => {
      if (value && group.dataset.searching !== "1") {
        group.dataset.wasOpen = String(group.open);
        group.dataset.searching = "1";
      }
      group.hidden = ![...group.querySelectorAll("[data-skill]")].some(
        (row) => !row.hidden,
      );
      if (value) group.open = !group.hidden;
      else if (group.dataset.searching === "1") {
        group.open = group.dataset.wasOpen === "true";
        delete group.dataset.searching;
      }
    });
  }
});
root.addEventListener("submit", (e) => {
  if (e.target.id === "asset-search") {
    e.preventDefault();
    assetFilters = Object.fromEntries(new FormData(e.target));
    assetOffset = 0;
    render();
  }
});
async function documentClick(e) {
  const b = e.target.closest("button");
  if (!b) return;
  try {
    if(b.dataset.piAdd || b.dataset.piRemove || b.dataset.piMove!==undefined){
      if(b.dataset.piAdd){const id=Number(document.querySelector('#pi-product-select').value);if(!piDraftTargets.includes(id)&&piDraftTargets.length<8)piDraftTargets.push(id);}
      if(b.dataset.piRemove)piDraftTargets=piDraftTargets.filter(id=>id!==Number(b.dataset.piRemove));
      if(b.dataset.piMove!==undefined){const i=Number(b.dataset.piMove),j=i+Number(b.dataset.direction);if(j>=0&&j<piDraftTargets.length)[piDraftTargets[i],piDraftTargets[j]]=[piDraftTargets[j],piDraftTargets[i]];}
      document.querySelector('#pi-target-list').innerHTML=piTargetList(piDraftTargets,piDashboard.products);
    } else if (b.dataset.copyMissing !== undefined) {
      const holder=b.closest('.missing-copy'), status=holder.querySelector('.copy-status');
      try {await navigator.clipboard.writeText(decodeURIComponent(b.dataset.copyMissing));status.textContent='Copied — ready to import into EVE.';}
      catch {const area=holder.querySelector('.copy-fallback');area.hidden=false;area.focus();area.select();status.textContent='Select and copy the text below (Ctrl+C).';}
    } else if (b.dataset.action === "close") dialog.close();
    else if (b.dataset.action === "paste-skills") {
      try {document.querySelector("#skill-import-text").value = await navigator.clipboard.readText();}
      catch {document.querySelector("#skill-import-status").textContent="Clipboard access unavailable. Paste into the box with Ctrl+V.";}
    } else if (b.dataset.action === "import-skills") {
      const status=document.querySelector("#skill-import-status");
      try {
        const imported=await api("/skill-plan/import",{text:document.querySelector("#skill-import-text").value});
        const merged=new Map(planEntries.map(r=>[r.id,r]));
        for(const r of imported) {const old=merged.get(r.id);merged.set(r.id,{...r,level:Math.max(r.level,old?.level||0)});}
        planEntries=[...merged.values()];showEntries();
        status.textContent=`Imported ${imported.length} skills. Review below, then save the plan.`;
      } catch(error) {status.textContent=error.message;}
    } else if (b.dataset.action === "catalog") {
      const q = document.querySelector("#catalog-query").value,
        mode = document.querySelector("#catalog-mode").value;
      searchResults = await api(
        "/catalog?q=" +
          encodeURIComponent(q) +
          (mode === "skills" ? "&skills=1" : ""),
      );
      if (mode === "ships")
        searchResults = searchResults.filter((r) => r.category_id === 6);
      document.querySelector("#catalog-results").innerHTML =
        searchResults
          .map(
            (r, i) =>
              `<div class="listrow"><span>${esc(r.name)}</span>${r.category_id === 16 ? `<select aria-label="Target level" id="level-${i}">${[1, 2, 3, 4, 5].map((l) => `<option>${l}</option>`).join("")}</select>` : ""}<button type="button" data-add-skill="${i}">${r.category_id === 6 ? "Use ship prerequisites" : "Add"}</button></div>`,
          )
          .join("") || empty("No matches");
    } else if (b.dataset.addSkill !== undefined) {
      const r = searchResults[Number(b.dataset.addSkill)];
      if (r.category_id === 6) {
        planEntries.push(...(await api("/ship-plan", { ship: r.id })));
      } else
        planEntries.push({
          id: r.id,
          level: Number(
            document.querySelector("#level-" + b.dataset.addSkill).value,
          ),
          name: r.name,
        });
      showEntries();
    } else if (b.dataset.removeSkill !== undefined) {
      planEntries.splice(Number(b.dataset.removeSkill), 1);
      showEntries();
    } else if (b.dataset.share) {
      await api(
        "/documents/" + b.dataset.share,
        { shared: b.dataset.value === "true" },
        "PATCH",
      );
      dialog.close();
      await render();
    } else if (b.dataset.deleteDoc) {
      if (confirm("Delete this saved document?")) {
        await api("/documents/" + b.dataset.deleteDoc, {}, "DELETE");
        dialog.close();
        await render();
      }
    } else if (b.dataset.copyDoc || b.dataset.editDoc) {
      const d = await api(
        "/documents/" + (b.dataset.copyDoc || b.dataset.editDoc),
      );
      dialog.close();
      createDocument(d.kind, d.kind === "fitting" ? d.body : undefined);
      document.querySelector("[name=name]").value =
        d.name + (b.dataset.copyDoc ? " (copy)" : "");
      if (b.dataset.editDoc) {
        document.querySelector("#document-form").dataset.id = d.id;
        document.querySelector("[name=shared]").checked = !!d.shared;
      }
      if (d.kind === "plan") {
        planEntries = d.body;
        showEntries();
      }
    } else if (b.dataset.export) {
      const d = await api("/documents/" + b.dataset.export);
      const url = URL.createObjectURL(
        new Blob([d.body], { type: "text/plain" }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = "fitting.txt";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  } catch (e) {
    toast(e.message);
  }
}
dialog.addEventListener("click",documentClick);
root.addEventListener("click",e=>{if(e.target.closest(".inline-fitting"))documentClick(e);});

dialog.addEventListener("change",e=>{
 if(e.target.id!=="add-character-group")return;
 const label=dialog.querySelector('#add-character-parent'),alt=e.target.value==='alt';
 label.hidden=!alt;label.querySelector('select').disabled=!alt;
});
async function documentSubmit(e) {
  if(e.target.id==="pi-settings"){
    e.preventDefault();const values=new FormData(e.target),button=e.target.querySelector('[type=submit]');button.disabled=true;
    try{await api('/pi/settings',{perfect:Number(values.get('perfect')),critical:Number(values.get('critical')),targets:piDraftTargets},'POST');dialog.close();await render();}catch(error){document.querySelector('#pi-settings-error').textContent=error.message;}finally{button.disabled=false;}
    return;
  }
  if(e.target.id === "add-character-form") {
    e.preventDefault();
    const values=new FormData(e.target), query=new URLSearchParams({link:'1',group:String(values.get('group'))});
    if(values.get('group')==='alt')query.set('parent',String(values.get('parent')));
    // Navigate like the existing login links: form-action CSP blocks external
    // redirects when EVE SSO is reached through a native form submission.
    window.location.assign('/auth/login?'+query.toString());
    return;
  }
  if(e.target.id === "link-fitting-plan") {
    e.preventDefault();
    try {await api("/documents/"+e.target.dataset.document+"/plan",{plan:new FormData(e.target).get("plan")});await showDocument(e.target.dataset.document);}catch(err){toast(err.message);}
    return;
  }

  e.preventDefault();
  const form = e.target,
    button = form.querySelector("button.primary");
  if (button) button.disabled = true;
  try {
    const data = Object.fromEntries(new FormData(form));
    if (form.id === "document-form") {
      await api(
        "/documents" + (form.dataset.id ? "/" + form.dataset.id : ""),
        {
          kind: form.dataset.kind,
          name: data.name,
          body: form.dataset.kind === "plan" ? planEntries : data.eft,
          shared: data.shared === "on",
        },
        form.dataset.id ? "PUT" : "POST",
      );
      dialog.close();
      toast("Saved");
      await render();
    }
    if (form.id === "compare") {
      const result = await api("/compare", {
        document: form.dataset.document,
        character: Number(data.character),
        alpha: data.speed === "alpha",
      });
      form.nextElementSibling.innerHTML =
        `<div class="notice">${result.ready ? "All required skills are active." : "Some required skills are missing or inactive."}<br>Estimated remaining training: <strong>${duration(result.seconds)}</strong><br>${esc(result.estimate)}${data.speed === "alpha" ? "<br>Alpha skill restrictions are not evaluated; some skills may require Omega." : ""}</div>${copyMissingControl(result.rows)}${table(
          ["Skill", "Trained / active", "Required", "Remaining"],
          result.rows.map(
            (r) =>
              `<tr><td>${esc(r.name)}</td><td>${r.current} / ${r.active}</td><td>${r.level}</td><td>${r.active >= r.level ? tag("Ready") : r.current >= r.level ? tag("Inactive", "warn") : duration(r.seconds)}</td></tr>`,
          ),
        )}<small>Skills snapshot: ${date(result.updated)}</small>`;
    }
  } catch (e) {
    toast(e.message);
  } finally {
    if (button) button.disabled = false;
  }
}
dialog.addEventListener("submit",documentSubmit);
root.addEventListener("submit",e=>{if(e.target.closest(".inline-fitting"))documentSubmit(e);});

try {
  me = await api("/me");
  await render();
  // Poll for completion without replacing any visible page content or moving focus.
  setInterval(async()=>{
    if(checkingSnapshots || document.hidden)return;
    checkingSnapshots=true;
    try{const latest=await api("/characters");if(snapshotKey(latest)!==snapshotSignature)document.querySelector("[data-action=update-view]")?.removeAttribute("hidden");}catch{}finally{checkingSnapshots=false;}
  },30000);
} catch {
  login();
}

setInterval(()=>document.querySelectorAll("[data-den-expiry]").forEach(el=>{
 el.textContent=Date.parse(el.dataset.denExpiry)<=Date.now()?"Expired · sync to refresh":"Expires in "+eta(el.dataset.denExpiry);
}),10000);

setInterval(()=>document.querySelectorAll('[data-extractor-expiry]').forEach(el=>{
 if(el.dataset.extractorExpiry&&Date.parse(el.dataset.extractorExpiry)<=Date.now()){
  el.classList.remove('perfect','attention','critical','unknown');el.classList.add('stopped');el.querySelector('.pi-extractor-state').textContent='Reset needed · last programme';
 }
}),10000);
