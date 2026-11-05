import {accessChanged,managementNavigation} from './access-state.mjs';
import {documentLibraryUI,documentPilotView} from './document-library.mjs';
import {recruitSignup} from './auth-navigation.mjs';
import {clonePreferences,cloneReadiness} from './clone-model.mjs';
import {cloneToolbar,cloneResults} from './clone-view.mjs';
import {skillsPreferences,filterTrainingPilots,skillFiltersActive,skillsCSV,skillsDate,queueState} from './skills-model.mjs';
import {skillsPilotToolbar,skillsPilotCards,skillsTrainingPanel,skillsLevelCards,skillsTrainedToolbar,skillsTrainedResults} from './skills-view.mjs';
import {myCharacterPreferences,myCharacterDetail} from './my-character-view.mjs';
import {overviewPreferences,overviewRefresh,overviewIssues,overviewMatches,overviewTotals,overviewGroups,OVERVIEW_FILTERS,OVERVIEW_SORTS} from './overview-model.mjs';
import {adminNav,FONT_SIZES} from './settings-options.mjs';
import {createApiClient} from './api-client.mjs';
import {pilotAssetSearchUI} from './pilot-asset-search-view.mjs';
import {sitePagesUI} from './site-pages-view.mjs';
import {pageNavigation} from './site-pages-model.mjs';
import {filterUsers,userRole} from './users-model.mjs';
import {discordUI} from './discord-view.mjs';
import {recruitmentUI} from './recruitment-view.mjs';
import {industryPreferences,industryRows,industrySummary,industryCSV} from './industry-dashboard-model.mjs';
import {industryDashboardView} from './industry-dashboard-view.mjs';
import {eveClock} from './eve-clock.mjs';
import {accountEsiStatus} from './admin-esi-status.mjs';
import {fittingWorkbenchUI} from './fitting-workbench.mjs';
import {expansionUI} from './expansion-view.mjs';
import {managementUI} from './management-view.mjs';
import {contractsView,contractRows} from './contracts-view.mjs';
import {contractPreferences,contractsCSV} from './contracts-model.mjs';
import {personalWalletView} from './personal-wallet-view.mjs';
import {walletPreferences,validateWalletFilters,walletAnalysis,walletCSV} from './personal-wallet-model.mjs';
import {loyaltyView} from './loyalty-view.mjs';
import {featureUI,materialPlanner,fatigueView} from './feature-view.mjs';
import {comparisonTable} from './skill-compare.mjs';
import {combinedMining} from './mining-view.mjs';
import {miningPreferences,miningBounds,miningAnalysis,miningCSV} from './mining-dashboard-model.mjs';
import {miningDashboardView} from './mining-dashboard-view.mjs';
import {corpIndustryView,jobTime,industryJobIcon} from "./corp-industry-view.mjs";
import {moonBrowserView} from "./moon-browser-view.mjs";
import {moonExtractions,fractureCountdown} from "./moon-extractions.mjs";
import {characterTraining,characterCharts} from "./character-summary.mjs";
import {stackAssetRows} from "./asset-tree.mjs";
import {fuelDeadlines,compareStructureTimers} from "./structure-timers.mjs";
import {piPlanetStatuses,launchpadRows,extractionRows,piDashboardView,piSettingsView,piTargetList,piViewPreferences,piSearchText,piMatches,piSnapshotNotice} from "./pi-view.mjs";
import {subscriptionStatus} from "./subscription.mjs";
import {missingSkillText} from "./skill-export.mjs";
import {anarchyProgress,denLevel,workforceImpact,activeOperations,denTotals,denAttention,filterDens,sortDenGroups} from "./den-model.mjs";
import {THEMES as themes} from './themes.mjs';
function applyTheme(name) {
 document.documentElement.dataset.theme = Object.hasOwn(themes,name) ? name : "nebula";
 try {localStorage.setItem("stemp-theme",document.documentElement.dataset.theme);}catch{}
}
try {applyTheme(localStorage.getItem("stemp-theme")||"nebula");}catch{applyTheme("nebula");}
async function saveTheme(name){
 if(!Object.hasOwn(themes,name))return;
 await api('/settings',{theme:name});me.preferences.theme=name;applyTheme(name);
 document.querySelectorAll('button[data-theme]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.theme===name)));
 const selector=document.getElementById('settings-theme');if(selector)selector.value=name;
}
const accountIcon = (type) => `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">${type==="theme" ? '<path d="M12 3a9 9 0 1 0 0 18h1a2 2 0 0 0 1-3.7 1.5 1.5 0 0 1 .8-2.8H17a4 4 0 0 0 4-4C21 6.4 17 3 12 3Z"/><circle cx="7.5" cy="10" r="1"/><circle cx="11" cy="7" r="1"/><circle cx="16" cy="8.5" r="1"/>' : '<path d="M10 4H4v16h6M14 8l4 4-4 4M8 12h11"/>'}</svg>`;
const eveIcon = (id) =>
  Number(id) > 0
    ? `<img class="eve-icon" loading="lazy" src="https://images.evetech.net/types/${Number(id)}/icon?size=64" alt="">`
    : "";
import { splitQueue, skillGroups, queuedDuration } from "./view-models.mjs";
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
  page = location.hash==="#admin-users"?"admin-users":location.hash==="#mining"?"mining":location.hash==="#corp-structures"?"corp-structures":location.hash==="#corp"?"admin-corp":"overview",
  selected,
  docs = [],
  assetOffset = 0,
  assetFilters = { q: "", character: "", location: "" },
  assetSearchAll = false,
  renderId = 0,
  toastTimer;
function toast(message) {
  const box = document.querySelector("#toast");
  box.textContent = message;
  box.style.display = "block";
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (box.style.display = "none"), 6500);
}
const api=createApiClient();
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
const discord=discordUI({api,esc,intro,date,toast,context:()=>({me,chars}),refresh:()=>render()});
const management=managementUI({setTheme:saveTheme,api,esc,intro,table,num,date,empty,context:()=>({me,chars}),toast,refresh:async reload=>{if(reload){me=await api('/me');renderedPage=null;}await render();}});
const features=featureUI({api,intro,context:()=>({me,chars}),refresh:()=>render(),toast});
const fittingWorkbench=fittingWorkbenchUI({api,esc,intro,context:()=>({me,chars}),toast});
const expansion=expansionUI({api,esc,intro,table,num,date,empty,context:()=>({me,chars}),toast,refresh:()=>render()});
const corpNav=[['corp-overview','◈','Overview'],['corp-members','♙','Memberlist'],['corp-pilots','♙','Roles and Access'],['corp-wallet','◈','Wallet'],['corp-contracts','▧','Contracts'],['corp-assets','▦','Corp Assets'],['corp-search-pilots','⌕','Search Pilots'],['corp-standings','◇','Standings'],['corp-market','◈','Market'],['corp-industry','⚒','Industry'],['corp-blueprints','▤','Blueprints'],['corp-structures','▥','Structures'],['corp-moons','☾','Moon Mining'],['corp-surveys','☷','Moon Surveys']];
function navigationButton([id,icon,name]){return `<button data-nav="${id}" class="${page===id?'active':''}"><span>${icon}</span>${name}</button>`;}
const nav = [
  ["overview", "◈", "Overview"],
  ["characters", "♙", "My Characters"],
  ["skills", "▤", "Skills & Queues"],
  ["clones", "◉", "Clones"],
  ["wallet", "◈", "Wallet"],
  ["contracts", "▧", "Contracts"],
  ["standings", "◇", "Standings"],
  ["ratting", "◈", "Ratting"],
  ["market", "◈", "Market"],
  ["mining", "⛏", "Mining"],
  ["industry", "⚒", "Industry"],
  ["blueprints", "▤", "Blueprints"],
  ["plans", "◇", "Skill Plans"],
  ["fittings", "△", "Fittings"],
  ["dens", "⬡", "Mercenary Dens"],
  ["pi", "◎", "Planetary Industry"],
  ["assets", "▦", "Asset Search"],
];
const recruitment=recruitmentUI({api,esc,intro,table,num,date,context:()=>({me,chars}),refresh:render,toast});
const pilotAssetSearch=pilotAssetSearchUI({api,esc,intro,num,date,toast,refresh:render});
const sitePages=sitePagesUI({api,esc,intro,date,toast,context:()=>({me,chars}),refresh:async reload=>{if(reload){me=await api('/me');renderedPage=null;}await render();}});
const customNavigation=(section,base=[])=>pageNavigation(section,base,(me.pages||[]).filter(p=>me.preferences?.['page-'+p.id]!==false)).map(navigationButton).join('');
const isKnownPage=id=>knownPages.includes(id)||(me?.pages||[]).some(p=>'page-'+p.id===id);
const knownPages=["compare","pi-market",...nav.map(n=>n[0]),...corpNav.map(n=>n[0]),"settings","groups","fitting-workbench","fitting-import","admin-groups","admin-group-management","admin-links","admin-pages","inspect-mail","inspect-contacts","admin-users","admin-esi","admin-corp","admin-whitelist","recruitment","recruit-application","admin-recruitment","admin-discord","inspect-pilot-check","inspect-pilot-combat"];
window.addEventListener("hashchange",()=>{const requested=location.hash.slice(1);if(me&&isKnownPage(requested)){if(page==='fitting-workbench'&&requested!==page&&!fittingWorkbench.canLeave()){history.replaceState(null,'','#'+page);return;}page=requested;render();}});
function sidebarSection(){
 const custom=(me?.pages||[]).find(p=>'page-'+p.id===page);if(custom)return custom.section;
 if(page.startsWith('admin-'))return 'admin';
 if(page.startsWith('corp-'))return 'corporation';
 if(page.startsWith('inspect-'))return 'inspect';
 if(['groups','settings','recruitment','recruit-application'].includes(page))return 'management';
 return 'personal';
}
const sidebarStates=new Map();
function sidebarPreferences(){
 const key=String(me.main_id);
 if(!sidebarStates.has(key)){
  let saved={};try{const value=JSON.parse(localStorage.getItem('stemp-sidebar-'+key)||'{}');if(value&&typeof value==='object'&&!Array.isArray(value))saved=Object.fromEntries(Object.entries(value).filter(([id,open])=>['personal','links','pages','management','inspect','corporation','admin'].includes(id)&&typeof open==='boolean'));}catch{}
  sidebarStates.set(key,saved);
 }
 return sidebarStates.get(key);
}
function rememberSidebar(){
 if(!me)return;
 const state=sidebarPreferences();
 root.querySelectorAll('.sidebar-section[data-sidebar]').forEach(el=>{state[el.dataset.sidebar]=el.open;});
 try{localStorage.setItem('stemp-sidebar-'+me.main_id,JSON.stringify(state));}catch{}
}
function sidebarOpen(section){return sidebarPreferences()[section]??(sidebarSection()===section);}
document.addEventListener('toggle',e=>{if(e.target.isConnected&&e.target.matches?.('.sidebar-section[data-sidebar]'))rememberSidebar();},true);
let siteNotifications=[];
function notificationMenu(){return siteNotifications.length?`<details class="notification-menu"><summary>⚠ ${siteNotifications.length} Notification${siteNotifications.length===1?'':'s'}</summary><div role="list"><div class="notification-actions"><strong>Notifications</strong><button type="button" title="Hide all current notifications" data-clear-notifications ${me.inspect?'disabled':''}>Clear all</button></div>${siteNotifications.map(n=>`<div role="listitem" class="notification-entry"><button data-nav="${esc(n.page||'dens')}"><strong>${esc(n.pilot)} · ${esc(n.location)}</strong><span>${esc(n.message)}${n.expires?' '+eta(n.expires)+' remaining.':''}</span>${n.stale?'<small>Snapshot is stale or its latest sync failed.</small>':''}</button><button class="notification-clear" ${me.inspect?'disabled':''} data-dismiss-notification="${esc(n.id)}" aria-label="Clear notification for ${esc(n.pilot)}" title="Clear this notification">×</button></div>`).join('')}</div></details>`:'';}
root.addEventListener('click',async event=>{const button=event.target.closest('[data-dismiss-notification],[data-clear-notifications]');if(!button)return;event.preventDefault();event.stopPropagation();const keys=button.hasAttribute('data-clear-notifications')?siteNotifications.map(alert=>alert.id):[button.dataset.dismissNotification];button.disabled=true;try{await api('/notifications/dismiss',{keys});siteNotifications=await api('/notifications');refreshNotificationMenu();}catch(error){button.disabled=false;toast(error.message);}});
function refreshNotificationMenu(){const slot=document.querySelector('#notification-slot');if(!slot)return;const open=slot.querySelector('details')?.open;slot.innerHTML=notificationMenu();if(open&&slot.querySelector('details'))slot.querySelector('details').open=true;}
function shell() {
  rememberSidebar();
  root.innerHTML = `<div class="shell"><aside><div class="brand"><img src="https://images.evetech.net/corporations/668298004/logo?size=128" alt="STEMP"><div>STEMP Tools<small class="brand-version">v0.44.2</small></div></div><div><details class="personal-nav sidebar-section" data-sidebar="personal" ${sidebarOpen('personal')?'open':''}><summary>My Characters</summary><nav>${customNavigation('personal',nav.filter(([id])=>me.recruit?['overview','characters'].includes(id):me.preferences?.[id]!==false&&(!me.inspect?.recruitment_only||!['plans','fittings','pi'].includes(id))))}</nav></details>${!me.recruit&&!me.inspect?.recruitment_only&&me.preferences?.['links-section']!==false&&me.links?.length?`<details class="links-nav sidebar-section" data-sidebar="links" ${sidebarOpen('links')?'open':''}><summary>Links</summary><nav>${(me.links||[]).map(l=>`<a class="external-nav" href="${esc(l.slug?'/'+l.slug:l.url)}" title="${esc(l.description)}" target="_blank" rel="noopener noreferrer"><span>↗</span>${esc(l.name)}</a>`).join('')}</nav></details>`:''}${(me.pages||[]).some(p=>p.section==='pages'&&me.preferences?.['page-'+p.id]!==false)?`<details class="pages-nav sidebar-section" data-sidebar="pages" ${sidebarOpen('pages')?'open':''}><summary>Pages</summary><nav>${customNavigation('pages')}</nav></details>`:''}<details class="management-nav sidebar-section" data-sidebar="management" ${sidebarOpen('management')?'open':''}><summary>Management</summary><nav>${customNavigation('management',managementNavigation(me))}</nav></details>${me.inspect?`<details class="inspect-nav sidebar-section" data-sidebar="inspect" ${sidebarOpen('inspect')?'open':''}><summary>Inspect Only</summary><nav>${[['inspect-pilot-check','✓','Pilot Check'],['inspect-pilot-combat','⚔','Pilot Combat'],['inspect-mail','✉','Mail'],['inspect-contacts','♙','Contacts']].map(navigationButton).join('')}</nav></details>`:''}${(me.corporation||(me.pages||[]).some(p=>p.section==='corporation'))?`<details class="corp-nav sidebar-section" data-sidebar="corporation" ${sidebarOpen('corporation')?'open':''}><summary>Corporation Management</summary><nav>${customNavigation('corporation',corpNav.filter(([id])=>me.corporate_pages?.includes(id)&&me.preferences?.[id]!==false))}</nav></details>`:''}</div>${me.admin ? `<details class="admin-nav sidebar-section" data-sidebar="admin" ${sidebarOpen('admin')?'open':''}><summary>Admin</summary><nav>${adminNav.filter(([id])=>me.preferences?.[id]!==false).map(([id,icon,name])=>`<button data-nav="${id}" class="${page===id?"active":""}"><span>${icon}</span>${name}</button>`).join("")}</nav></details>`:""}<div class="account"><div class="account-person"><img class="portrait" src="https://images.evetech.net/characters/${Number(me.main_id)}/portrait?size=64" alt="${esc(me.name)}"><strong>${esc(me.name)}</strong></div><div class="account-controls"><time class="eve-clock" data-eve-clock title="EVE Time · UTC">${eveClock()}</time></div></div></aside><main>${me.inspect?`<div class="inspect-banner"><strong>Inspecting ${esc(me.inspect.name)} · Read-only</strong><button data-action="exit-inspect">Exit Inspect</button></div>`:''}<header class="topbar"><div class="page-heading"></div><div class="actions"><button data-action="update-view" hidden>New data available · Update view</button>${(page === "overview" || page === "pi") ? '<button data-action="sync">↻ Refresh all characters</button>' : ""}<span id="notification-slot">${notificationMenu()}</span><span id="page-sync-slot"></span>${page==="overview"?'<button class="primary" data-action="add-character">+ Add character</button>':""}</div></header><div id="content"></div><footer class="footer">EVE Online data provided by CCP Games. Not affiliated with CCP. Cached snapshots · all times UTC.</footer></main></div>`;
  document.documentElement.style.setProperty('--font-scale',FONT_SIZES[me.preferences?.font_size]||1);
  const fontSize=Number(me.preferences?.sidebar_font_size)||12;root.querySelector('.shell>aside')?.style.setProperty('--sidebar-font-size',Math.max(10,Math.min(20,fontSize))*(FONT_SIZES[me.preferences?.font_size]||1)+'px');
}
function intro(title, description, actions = "") {
  return `<div class="intro"><div><h1>${title}</h1><p>${description}</p></div>${actions}</div>`;
}
root.addEventListener('submit',event=>recruitSignup(event,url=>window.location.assign(url)));
function login() {
  if(location.pathname.toLowerCase().replace(/\/$/,'')==='/recruit'){
   root.innerHTML=`<main class="stemp-login"><section class="stemp-login-content recruit-landing"><small>${esc(document.title)}</small><h1>Recruitment</h1><p>Apply with your main pilot, then link your other pilots.</p><form id="recruit-signup-form" action="/auth/login" method="get"><input name="recruit" type="hidden" value="1"><label class="recruit-consent"><input name="consent" value="1" type="checkbox" required><span>I agree that authorised recruitment staff may inspect my connected pilots’ skills, assets, wallet history, contracts, mail, contacts and public combat activity for recruitment review.</span></label><p>Signing up does not grant corporation or member access. EVE will display the requested permissions before you authorise them.</p><button type="submit" class="primary">Apply with EVE Online</button></form><a href="/">Existing member sign-in</a></section></main>`;return;
  }
  root.innerHTML = `<main class="stemp-login"><img class="stemp-login-logo" src="https://images.evetech.net/corporations/668298004/logo?size=512" alt=""><section class="stemp-login-content" aria-labelledby="stemp-login-title"><h1 id="stemp-login-title">STEMP Tools</h1><a class="button primary" href="/auth/login">Sign in with EVE Online →</a></section></main>`;
}
let renderedPage=null, snapshotSignature="", checkingSnapshots=false;
const snapshotKey=rows=>JSON.stringify(rows.map(c=>[c.id,c.job,c.reconnect,c.snapshots,c.errors]));
async function render() {
  if(me.preferences?.theme)applyTheme(me.preferences.theme);
  if(me.preferences?.[page]===false)page="overview";
  if(me.recruit&&!['overview','characters','groups','recruit-application'].includes(page)&&!(me.pages||[]).some(p=>'page-'+p.id===page))page='overview';
  const samePage=renderedPage===page, scrollY=window.scrollY;
  const run = ++renderId;
  if(!samePage) shell();
  const content = document.querySelector("#content");
  content.setAttribute("aria-busy","true");
  if(!samePage) content.innerHTML = empty("Loading your workspace…");
  try {
    [chars,siteNotifications]=await Promise.all([api("/characters"),api("/notifications").catch(()=>siteNotifications)]);
    if(run!==renderId)return;
    refreshNotificationMenu();
    snapshotSignature=snapshotKey(chars);
    document.querySelector("[data-action=update-view]")?.setAttribute("hidden","");
    selected =
      selected && chars.some((c) => c.id === Number(selected))
        ? selected
        : chars[0]?.id;
    let html = "";
    if (page === "overview") html = overview();
    if (page === "skills") html = await skills();
    if (page === "characters") html = await myCharacters();
    if (page === "compare") html = await skillComparison();
    if (page === "plans" || page === "fittings") html = await documents();
    if (page === "dens" || page === "pi") {html = await operations();if(page==="dens")html=`<div class="dens-page">${html}</div>`;}
    if (page === "pi-market") html = `<div class="pi-market-page">${await piMarket()}</div>`;
    if (page === "assets") html = await assets();
    if (page === "mining") html = await mining();
    if (page === "wallet") html = await walletPage();
    if (page === "contracts") html = await contractsPage();
    if (page === "industry") html = await industry();
    if (page === "clones") html = await clonesPage();
    if(page.startsWith("admin-")&&!["admin-groups","admin-group-management","admin-links"].includes(page))html=await adminPage();
    if(page.startsWith("corp-")&&!["corp-overview","corp-members","corp-pilots","corp-assets","corp-search-pilots","corp-wallet","corp-standings","corp-contracts","corp-market","corp-blueprints"].includes(page)){html=await corporationPage();if(page==="corp-structures")html=`<div class="structures-page">${html}</div>`;}
    const newFeature=await features.render(page);if(newFeature!==null)html=`<div class="management-page">${newFeature}</div>`;
    const expanded=await expansion.render(page);if(expanded!==null)html=`<div class="management-page">${expanded}</div>`;
    const recruitmentPage=await recruitment.render(page);if(recruitmentPage!==null)html=`<div class="management-page">${recruitmentPage}</div>`;
    const pilotAssets=await pilotAssetSearch.render(page);if(pilotAssets!==null)html=`<div class="management-page">${pilotAssets}</div>`;
    const customPage=await sitePages.render(page);if(customPage!==null)html=`<div class="management-page">${customPage}</div>`;
    const fittingEditor=await fittingWorkbench.render(page);if(fittingEditor!==null)html=fittingEditor;
    const extra=await management.render(page),discordExtra=await discord.render(page);if(extra!==null||discordExtra!==null)html=`<div class="management-page">${extra||''}${discordExtra||''}</div>`;
    if (run === renderId) {
      content.innerHTML = html;
      if(page.startsWith('corp-')&&!me.director)content.querySelectorAll('[data-action="corp-sync"],a[href="/auth/login?link=1"]').forEach(el=>el.remove());
      const heading=document.querySelector('.page-heading'),pageIntro=content.querySelector('.intro');
      if(pageIntro?.querySelector('h1')){
        heading.replaceChildren(pageIntro.firstElementChild);
        const syncSlot=document.querySelector('#page-sync-slot');
        syncSlot?.replaceChildren(...pageIntro.querySelectorAll('button[data-sync-char]'));
        pageIntro.querySelectorAll('.actions').forEach(actions=>{if(!actions.children.length)actions.remove();});
        if(!pageIntro.children.length)pageIntro.remove();
        else pageIntro.classList.add('page-actions');
      }else heading.innerHTML='<h1>'+esc(nav.find(([id])=>id===page)?.[2]||'Overview')+'</h1>';

      if(myPilotFocus?.page===page&&['pi','dens','clones'].includes(page))content.insertAdjacentHTML('afterbegin',`<div class="notice compact">Showing ${esc(chars.find(c=>c.id===myPilotFocus.id)?.name||'selected character')} <button data-action="my-focus-clear">Show all characters</button></div>`);
      applyPIStatusFilters();
      applyVisualStyles();
      renderedPage=page;
      if(page==="pi"&&!piShared&&piDashboard?.settings.show_goals!==false&&piDashboard?.targets.length)refreshPIPrices(run);
      if(samePage) window.scrollTo({top:scrollY,behavior:"instant"});
    }
  } catch (e) {
    if(run===renderId&&e.status===401){me=null;login();return;}
    if (run === renderId)
      content.innerHTML = `<div class="notice error" role="alert">${esc(e.message)} <button type="button" data-action="retry-page">Retry</button></div>`;
  } finally {if(run===renderId)content.setAttribute('aria-busy','false');}
}
function subscriptionColorClass(state) {
 return state.days===null?'':`subscription-days-${Math.max(0,Math.min(30,state.days))}`;
}
function subscriptionCell(c) {
 const owner=chars.find(main=>main.id===c.parent_id)||c,inherited=owner.id!==c.id;
 const state=subscriptionStatus(owner.subscription_end);
 return `<div class="subscription-cell" ${inherited?`data-subscription-inherits="${owner.id}"`:""}><strong class="subscription-status ${subscriptionColorClass(state)}">${state.label}</strong><input type="date" ${inherited?'disabled':`data-subscription-char="${c.id}"`} value="${esc(owner.subscription_end||'')}" aria-label="Subscription expiry for ${esc(c.name)}" title="Manually recorded expiry date · EVE / UTC">${inherited?`<small>From ${esc(owner.name)}</small>`:""}<small class="subscription-save" role="status"></small></div>`;
}
let overviewExpanded=false,overviewPrefs=overviewPreferences(),overviewScope='';
const overviewOpenGroups=new Set();
function loadOverviewView(){
 const scope='tools-overview:'+me.main_id+':'+(me.inspect?.name||'self');
 if(overviewScope===scope)return;
 overviewScope=scope;
 try{overviewPrefs=overviewPreferences(JSON.parse(localStorage.getItem(scope)||'{}'));}catch{overviewPrefs=overviewPreferences();}
 overviewExpanded=overviewPrefs.expanded;overviewOpenGroups.clear();overviewPrefs.groups.forEach(id=>overviewOpenGroups.add(id));
}
function saveOverviewView(){overviewPrefs.expanded=overviewExpanded;overviewPrefs.groups=[...overviewOpenGroups];try{localStorage.setItem(overviewScope,JSON.stringify(overviewPrefs));}catch{}}
function overviewIsOpen(id){return overviewExpanded||overviewOpenGroups.has(id)||!!overviewPrefs.q.trim()||overviewPrefs.filter!=='all';}
function overviewPortrait(c,alts=[]) {
 const toggle=!overviewExpanded&&alts.length?` <button class="overview-alt-toggle" data-overview-alts="${c.id}" aria-expanded="${overviewIsOpen(c.id)}" aria-controls="overview-alts-${c.id}">Alts (${alts.length}) ${overviewIsOpen(c.id)?'▾':'▸'}</button>`:'';
 return portrait(c).replace('</strong>','</strong>'+toggle);
}
function stripeOverviewRows(){let index=0;document.querySelectorAll(".overview-character-list .overview-character-row:not(.overview-character-head)").forEach(row=>{if(!row.closest("[hidden]"))row.dataset.overviewShade=String(index++%2);});}
function overviewCharacters() {
 let visibleRowIndex=0;
 const groups=overviewGroups(characterGroups(chars),chars,overviewPrefs),searching=!!overviewPrefs.q.trim()||overviewPrefs.filter!=='all';
 const renderCharacter=(c,alts=[],visible=true)=>{
 const grouped=alts.length&&overviewPrefs.totals&&!overviewIsOpen(c.id),members=[c,...alts],sp=overviewTotals(grouped?members:[c],'total_sp'),isk=overviewTotals(grouped?members:[c],'isk'),refresh=overviewRefresh(c),issues=overviewIssues(c,chars);
 return `<div id="overview-character-${c.id}" class="overview-character-row" tabindex="-1" data-overview-shade="${visible?visibleRowIndex++%2:0}"><div class="overview-character-identity">${groupControl(c)}${overviewPortrait(c,alts)}${searching&&!overviewMatches(c,chars,overviewPrefs)?'<small class="overview-context">Group context</small>':''}</div><div class="numeric">${num(sp.value)}${grouped?`<small>Group total · ${members.length} chars${sp.partial?' · partial':''}</small>`:''}</div><div class="numeric">${isk.value==null?'—':isk.value.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}${grouped?`<small>Group total${isk.partial?' · partial':''}</small>`:''}</div>${subscriptionCell(c)}<div>${issues.some(i=>i.kind==='reconnect')?tag('Reconnect required','warn'):c.job?tag(c.job,'purple'):c.errors.length?tag(refresh.temporary?'Temporary ESI issue':'Refresh issue','warn'):tag(c.snapshots.length?'Connected':'Awaiting first sync','dim')}${c.errors.length?`<details><summary>Refresh details (${c.errors.length})</summary>${c.errors.map(e=>`<small>${esc(e.kind)}: ${esc(e.message)}</small>`).join('')}<small>Saved data is retained.</small></details>`:''}</div><div><small>Latest success</small>${date(refresh.latest)}${refresh.older?`<small class="overview-stale">Some data is due for refresh</small>`:''}${refresh.oldest&&refresh.oldest!==refresh.latest?`<details><summary>Data age</summary><small>Oldest saved data: ${date(refresh.oldest)}</small></details>`:''}</div><div><div class="actions"><button data-sync-char="${c.id}">↻ Sync</button>${issues.some(i=>i.kind==='reconnect')?'<a class="button" href="/auth/login?link=1">Reconnect</a>':''}<details class="overview-actions"><summary aria-label="More actions for ${esc(c.name)}">•••</summary><div>${issues.some(i=>i.kind==='reconnect')?'':'<a class="button" href="/auth/login?link=1">Reconnect</a>'}${c.main?'':`<button data-move="${c.id}" data-direction="-1" ${!canMoveCharacter(c,-1)?'disabled':''}>↑ Move up</button><button data-move="${c.id}" data-direction="1" ${!canMoveCharacter(c,1)?'disabled':''}>↓ Move down</button><button class="danger" data-unlink="${c.id}">Unlink</button>`}</div></details></div></div></div>`;
 };
 return `<small id="overview-result-count" role="status">${groups.length} of ${characterGroups(chars).length} groups shown${searching?' · matching groups expanded; related characters kept together':''}</small><div class="overview-character-scroll"><div class="overview-character-list"><div class="overview-character-row overview-character-head"><span>Character</span><span>Skillpoints</span><span>ISK</span><span>Subscription</span><span>Data status</span><span>Last successful refresh</span><span>Actions</span></div>${groups.map(g=>`<div class="overview-character-group">${g.main?renderCharacter(g.main,g.alts):''}${g.alts.length?`<div id="overview-alts-${g.id}" class="overview-alt-rows" ${overviewIsOpen(g.id)?'':'hidden'}>${g.alts.map(c=>renderCharacter(c,[],overviewIsOpen(g.id))).join('')}</div>`:''}</div>`).join('')}</div></div>${groups.length?'':empty('No characters match','Try another name or clear the filters.')}`;
}
function updateOverviewList(){const target=document.querySelector('#overview-list');if(target){target.innerHTML=overviewCharacters();applyVisualStyles();}}
function overview() {
 loadOverviewView();
 const issues=chars.flatMap(c=>overviewIssues(c,chars).map(issue=>({...issue,pilot:c.name,id:c.id}))),affected=new Set(issues.map(i=>i.id)).size,sp=overviewTotals(chars,'total_sp'),isk=overviewTotals(chars,'isk'),working=chars.filter(c=>c.job).length;
 const stat=(label,value,note='')=>`<div class="card"><div class="label">${label}</div><div class="stat">${value}</div>${note?`<small>${note}</small>`:''}</div>`;
 return `${!me.preferences?.overview_guide_dismissed?`<section class="notice overview-guide" aria-label="Getting started"><div class="panelhead"><strong>Getting started</strong><button data-action="dismiss-overview-guide" ${me.inspect?'disabled':''} aria-label="Dismiss getting started guide permanently" title="Hide this guide permanently">×</button></div><p><strong>Mains:</strong> use <strong>Add character</strong>, sign in with EVE, then choose <strong>Main</strong> in the character dropdown. <strong>Alts:</strong> add each character, then choose <strong>Alt of…</strong> and its main in that dropdown. <strong>Subscription:</strong> set the main’s expiry date in the Subscription column; linked alts inherit it. Dates are recorded manually and do not change your EVE subscription.</p></section>`:''}<div class="cards overview-totals overview-summary">${stat('Total Skillpoints',num(sp.value),sp.partial?'Partial · some characters await data':'All linked characters')}${stat('Total ISK',num(isk.value),isk.partial?'Partial · some wallets await data':'All linked characters')}${stat('Characters',chars.length,characterGroups(chars).length+' main groups')}${stat('Needs Attention',affected,issues.length+' checks flagged')}</div>${me.recruit?`<section class="notice"><strong>Recruit Overview</strong><p>Your characters and main/alt links carry over when corporation membership is confirmed.</p><button data-nav="recruit-application">View Application</button></section>`:''}<details class="panel compact overview-attention" ${issues.length?'open':''}><summary>Needs Attention · ${affected} character${affected===1?'':'s'}</summary>${issues.length?issues.map(i=>`<div class="overview-issue"><strong>${esc(i.pilot)}</strong><span>${esc(i.message)}</span><button data-overview-issue="${i.id}" data-issue-page="${i.page}">${i.kind==='skills'?'View queue':i.kind==='subscription'?'Set subscription':'View character'}</button></div>`).join(''):'<small>No connection, refresh, subscription or skill queue warnings in the available data.</small>'}</details>${chars.some(c=>overviewRefresh(c).temporary)?'<div class="notice">Some ESI refreshes are temporarily failing. Your saved information is still shown; access and roles are not changed by this warning.</div>':''}<section class="panel"><div class="panelhead"><h2>Your characters</h2><div class="actions overview-view-toggle" aria-label="Character display"><button data-overview-mode="combined" aria-pressed="${!overviewExpanded}">Combine alts</button><button data-overview-mode="expanded" aria-pressed="${overviewExpanded}">Expand</button></div></div><div class="overview-toolbar"><label>Search<input id="overview-search" type="search" maxlength="120" placeholder="Character name…" value="${esc(overviewPrefs.q)}"></label><label>Show<select id="overview-filter">${Object.entries(OVERVIEW_FILTERS).map(([id,label])=>`<option value="${id}" ${overviewPrefs.filter===id?'selected':''}>${label}</option>`).join('')}</select></label><label>Sort<select id="overview-sort">${Object.entries(OVERVIEW_SORTS).map(([id,label])=>`<option value="${id}" ${overviewPrefs.sort===id?'selected':''}>${label}</option>`).join('')}</select></label><label class="overview-total-toggle"><input id="overview-group-totals" type="checkbox" ${overviewPrefs.totals?'checked':''}> Group totals when collapsed</label><button data-action="overview-clear">Clear filters</button></div><div id="overview-list">${chars.length?overviewCharacters():empty('Add your first character')}</div><small>${working?working+' character refreshes queued · ':''}Background refreshes respect EVE cache times. Subscription expiry is manually recorded. View preferences are remembered on this browser.</small></section>`;
}
let trainingOverview=[],selectedTrainingKey='',showTrainingAlts=false,selectedSkillsSnapshot=null,skillsView=skillsPreferences(),skillsScope='',skillsExplicitSelected=null;
const skillsHelpers={esc,num,date:skillsDate,eta,table,eveIcon};
function saveSkillsView(){skillsView.alts=showTrainingAlts;try{localStorage.setItem(skillsScope,JSON.stringify(skillsView));}catch{}}
function loadSkillsView(){
 const scope='tools-skills:'+me.main_id+':'+(me.inspect?.name||'self');
 if(scope!==skillsScope){skillsScope=scope;try{skillsView=skillsPreferences(JSON.parse(localStorage.getItem(scope)||'{}'));}catch{skillsView=skillsPreferences();}showTrainingAlts=skillsView.alts;}
 if(skillsExplicitSelected&&chars.some(c=>c.id===skillsExplicitSelected)){selected=skillsExplicitSelected;if(chars.find(c=>c.id===selected)?.parent_id!==selected)showTrainingAlts=true;skillsExplicitSelected=null;}
 else if(renderedPage!=='skills'&&chars.some(c=>c.id===skillsView.selected))selected=skillsView.selected;
}
function trainingKey(row){const q=splitQueue(row?.queue||[]);return JSON.stringify([queueState(row||{}).kind,q.current?.skill_id,q.current?.finish_date,q.waiting.map(s=>[s.skill_id,s.finish_date])]);}
function trainingCards(){skillsView.alts=showTrainingAlts;return skillsPilotCards(trainingOverview,chars,skillsView,selected,skillsHelpers);}
function refreshTrainingCards(){const target=document.querySelector('#training-overview');if(target){target.innerHTML=trainingCards();const count=document.querySelector('#skills-pilot-count');if(count)count.textContent=filterTrainingPilots(trainingOverview,chars,skillsView).length+' of '+trainingOverview.length+' characters shown';const note=document.querySelector('#skills-selection-note');if(note)note.textContent=filterTrainingPilots(trainingOverview,chars,skillsView).some(c=>c.id===Number(selected))?'':'The selected character is outside the current tile filters.';applyVisualStyles();}}
function trainingPanel(s){return skillsTrainingPanel(s,trainingOverview.find(c=>c.id===Number(selected)),skillsHelpers);}
function refreshTrainedSkills(){const data=selectedSkillsSnapshot?.snapshot?.data;if(!data)return;const results=document.querySelector('#trained-results');if(results)results.innerHTML=skillsTrainedResults(data,skillsView,skillsHelpers);const cards=document.querySelector('#skills-levels');if(cards)cards.innerHTML=skillsLevelCards(data,skillsView,skillsHelpers);const select=document.querySelector('[data-skills-filter="level"]');if(select)select.value=skillsView.level;applyVisualStyles();}
setInterval(()=>{
 if(page!=='skills'||!document.querySelector('#training-overview'))return;
 if(!document.activeElement?.closest('#training-overview'))refreshTrainingCards();
 const s=selectedSkillsSnapshot?.id===Number(selected)?selectedSkillsSnapshot.snapshot:null,old=document.querySelector('.training-detail'),key=trainingKey(trainingOverview.find(c=>c.id===Number(selected)));
 document.querySelectorAll('[data-training-until]').forEach(el=>el.textContent=eta(el.dataset.trainingUntil));
 document.querySelectorAll('[data-training-queued]').forEach(el=>el.textContent=queuedDuration(s?.data?.queue));
 const state=queueState(trainingOverview.find(c=>c.id===Number(selected))||{}),bar=document.querySelector('.skills-current-progress');if(bar&&state.progress!==null){bar.setAttribute('aria-valuenow',String(Math.round(state.progress)));bar.querySelector('i').style.width=state.progress+'%';}
 if(key!==selectedTrainingKey&&s?.data&&old&&!old.contains(document.activeElement)&&!dialog.open&&!document.activeElement?.matches('input,select,textarea')){
  const y=window.scrollY,scroll=old.querySelector('.training-queue-scroll')?.scrollTop||0,template=document.createElement('template');template.innerHTML=trainingPanel(s);old.replaceWith(template.content.firstElementChild);const queue=document.querySelector('.training-queue-scroll');if(queue)queue.scrollTop=scroll;applyVisualStyles();window.scrollTo({top:y,behavior:'instant'});
 }
 if(key!==selectedTrainingKey&&!old?.contains(document.activeElement)&&!dialog.open&&!document.activeElement?.matches('input,select,textarea')){selectedTrainingKey=key;refreshTrainedSkills();}
},10000);
async function skills(){
 loadSkillsView();const id=Number(selected)||null;
 const [overview,s]=await Promise.all([api('/skills/overview'),selected?api('/characters/'+id+'/skills'):Promise.resolve({data:null})]);
 if(page!=='skills'||(Number(selected)||null)!==id)return '';
 trainingOverview=overview;selectedTrainingKey=trainingKey(overview.find(c=>c.id===id));selectedSkillsSnapshot={id,snapshot:s};skillsView.selected=id;saveSkillsView();
 const c=chars.find(c=>c.id===id),data=s.data;
 const heading=intro('Skills & Training Queues','Current skills and EVE’s reported training schedule.',selected?`<button data-sync-char="${id}">↻ Sync character</button>`:'')+`<div class="skills-top-controls">${skillsPilotToolbar(skillsView,skillsHelpers)}<div class="actions skills-top-actions">${selected?`<button data-compare="${id}">Compare Skills</button><button data-nav="plans">Skill Plans</button>`:''}${data?'<button data-skills-export="skills">Export All Skills CSV</button><button data-skills-export="queue">Export Current Queue CSV</button>':''}</div></div><div id="training-overview" class="training-overview">${trainingCards()}</div><div class="training-visibility training-visibility-footer"><small id="skills-pilot-count">${filterTrainingPilots(trainingOverview,chars,skillsView).length} of ${trainingOverview.length} characters shown</small><button data-action="training-alts" aria-pressed="${showTrainingAlts}">${showTrainingAlts?'Hide alts':'Show alts'}</button></div><small id="skills-selection-note" role="status">${filterTrainingPilots(trainingOverview,chars,skillsView).some(p=>p.id===id)?'':'The selected character is outside the current tile filters.'}</small>`;
 const trainingNote='<small class="training-note">Training follows saved EVE dates between syncs. Queue status is unconfirmed when the snapshot is over two hours old or its latest refresh failed.</small>';
 if(!data)return heading+empty('Skills have not synced yet')+trainingNote;
 return heading+trainingPanel(s)+`<div id="skills-levels">${skillsLevelCards(data,skillsView,skillsHelpers)}</div><section class="panel compact skills-trained"><div class="panelhead"><h2>${esc(c?.name||'Selected character')} · Trained Skills</h2><small>Click a level card to filter; click again to clear.</small></div>${skillsTrainedToolbar(data,skillsView,skillsHelpers)}<div id="trained-results">${skillsTrainedResults(data,skillsView,skillsHelpers)}</div></section>`+trainingNote;
}
root.addEventListener('input',event=>{if(page!=='skills')return;if(event.target.id==='skills-pilot-search'){skillsView.pilotQuery=event.target.value;saveSkillsView();refreshTrainingCards();}if(event.target.id==='skill-filter'){skillsView.q=event.target.value;saveSkillsView();refreshTrainedSkills();}});
root.addEventListener('change',event=>{if(page!=='skills')return;const pilot=event.target.dataset.skillsPilot,filter=event.target.dataset.skillsFilter;if(pilot){skillsView[pilot]=event.target.value;saveSkillsView();refreshTrainingCards();}if(filter){skillsView[filter]=event.target.type==='checkbox'?event.target.checked:event.target.value;saveSkillsView();refreshTrainedSkills();}});
document.addEventListener('toggle',event=>{const group=event.target;if(page!=='skills'||!group.isConnected||!group.matches?.('[data-skill-group]')||skillFiltersActive(skillsView))return;const name=group.dataset.skillGroup;skillsView.groups=skillsView.groups.filter(g=>g!==name);if(group.open)skillsView.groups.push(name);saveSkillsView();},true);
root.addEventListener('click',event=>{
 const button=event.target.closest('[data-skill-level],[data-skills-action],[data-skills-export]');if(!button||page!=='skills')return;
 if(button.dataset.skillLevel!==undefined){skillsView.level=skillsView.level===button.dataset.skillLevel?'':button.dataset.skillLevel;saveSkillsView();refreshTrainedSkills();}
 if(button.dataset.skillsAction==='clear-pilots'){skillsView.pilotQuery='';skillsView.status='all';skillsView.sort='manual';saveSkillsView();document.querySelector('#skills-pilot-search').value='';document.querySelector('[data-skills-pilot="status"]').value='all';document.querySelector('[data-skills-pilot="sort"]').value='manual';refreshTrainingCards();}
 if(button.dataset.skillsAction==='clear-skills'){Object.assign(skillsView,{q:'',group:'',level:'',queued:false,below:false});saveSkillsView();const data=selectedSkillsSnapshot?.snapshot?.data;if(data){document.querySelector('.skills-trained .skills-toolbar').outerHTML=skillsTrainedToolbar(data,skillsView,skillsHelpers);refreshTrainedSkills();}}
 if(button.dataset.skillsExport){const snapshot=selectedSkillsSnapshot?.snapshot;if(!snapshot?.data)return;const url=URL.createObjectURL(new Blob([skillsCSV(snapshot.data,button.dataset.skillsExport)],{type:'text/csv;charset=utf-8'})),link=document.createElement('a');link.href=url;link.download='tools-'+Number(selected)+'-'+button.dataset.skillsExport+'.csv';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
});
const documentFilters={plan:'',fitting:''};
const documentLibrary=documentLibraryUI({api,context:()=>({me,chars}),refresh:()=>render(),onDocuments:all=>{docs=all;}});
const documentEvidence=new Map();let currentDocument=null;
function documentTags(){return ['Personal','Corp','Alliance',...[...new Set(docs.map(d=>d.tag||'Personal'))].filter(t=>!['Personal','Corp','Alliance'].includes(t)).sort((a,b)=>a.localeCompare(b))];}
async function documents() {
 const kind=page==='plans'?'plan':'fitting';
 return intro(kind==='plan'?'Skill Plans':'Fitting Hangar',kind==='plan'?'Training goals, pilot progress and linked fittings.':'Saved loadouts, pilot readiness and linked skill plans.',`<div class="actions">${kind==='fitting'?'<button class="primary" data-nav="fitting-workbench">Open Fitting Workbench</button><button data-nav="fitting-import">Import In-Game Fittings</button>':''}${!me.inspect?'<button data-create="'+kind+'">+ New '+kind+'</button>':''}</div>`)+await documentLibrary.render(kind);
}

let piDashboard=null,piDraftTargets=[],piShared=false,piShares=null;
const piStatusFilters=new Set();let piSearch='',piViewScope='';
function loadPIView(){const key='tools-pi-view:'+me.main_id+':'+(me.inspect?.name||'self')+':'+(piShared?'shared':'personal');if(piViewScope===key)return;piViewScope=key;let view=piViewPreferences();try{view=piViewPreferences(JSON.parse(localStorage.getItem(key)||'{}'));}catch{}piSearch=view.q;piStatusFilters.clear();view.statuses.forEach(s=>piStatusFilters.add(s));pageAlts.pi=view.alts;}
function savePIView(){try{localStorage.setItem(piViewScope,JSON.stringify(piViewPreferences({q:piSearch,statuses:[...piStatusFilters],alts:pageAlts.pi})));}catch{}}
root.addEventListener('input',e=>{if(page==='pi'&&e.target.id==='pi-search'){piSearch=e.target.value.slice(0,150);savePIView();applyPIStatusFilters();}});
root.addEventListener('click',e=>{if(page!=='pi'||!e.target.closest('[data-pi-clear]'))return;piSearch='';piStatusFilters.clear();document.querySelector('#pi-search').value='';savePIView();applyPIStatusFilters();});
function piFilterBar(){return `<div class="pi-status-filters" role="group" aria-label="Filter planets"><label class="pi-search-label">Search<input id="pi-search" type="search" maxlength="150" placeholder="Character, system, planet or product…" value="${esc(piSearch)}"></label>${[['stopped','Not Running'],['attention','Needs Attention'],['critical','Critical'],['storage','Storage Attention']].map(([key,label])=>`<button data-pi-filter="${key}" aria-pressed="${piStatusFilters.has(key)}">${label}</button>`).join('')}<button type="button" data-pi-clear>Clear</button><small>Any selected status · Storage Attention: launchpads ≥75% full · Search applies to visible characters</small><small id="pi-filter-count" role="status"></small><button class="pi-filter-alts" data-action="page-alts" aria-pressed="${pageAlts.pi}" ${piShared?"disabled":""}>${pageAlts.pi?"Hide alts":"Show alts"}</button></div><p id="pi-filter-empty" hidden>No planets match the selected filters.</p>`;}
function applyPIStatusFilters(){
 if(page!=='pi')return;
 const cards=[...document.querySelectorAll('[data-pi-status]')];let shown=0;
 for(const card of cards){card.hidden=!piMatches(card.dataset.piSearch||'',card.dataset.piStatus.split(' '),{q:piSearch,statuses:[...piStatusFilters]});if(!card.hidden)shown++;}
 document.querySelectorAll('[data-pi-character]').forEach(section=>{section.hidden=![...section.querySelectorAll('[data-pi-status]')].some(c=>!c.hidden);});
 document.querySelectorAll('[data-pi-filter]').forEach(b=>b.setAttribute('aria-pressed',String(piStatusFilters.has(b.dataset.piFilter))));
 const count=document.querySelector('#pi-filter-count');if(count)count.textContent=`${shown} of ${cards.length} planets`;
 const empty=document.querySelector('#pi-filter-empty');if(empty)empty.hidden=!cards.length||shown>0;
}

async function refreshPIPrices(run){
 const prices=await api("/pi/prices").catch(()=>[]);
 if(page!=="pi"||renderId!==run)return;
 for(const t of piDashboard.targets){
  const quote=prices.find(p=>p.id===t.id),amount=t.existing+t.additional;
  const value=amount===0?0:quote?.price!=null?amount*quote.price:null;
  const cell=document.querySelector(`[data-pi-value="${t.id}"]`),note=document.querySelector(`[data-pi-price="${t.id}"]`);
  if(cell)cell.textContent=value===null?"Unavailable":num(value)+" ISK";
  if(note)note.textContent=quote?.price!=null?`${num(quote.price)} ISK / unit · Jita IV–4 · ${date(quote.updated)}`:"Jita sell price unavailable";
 }
}
async function piMarket(){
 const data=await api('/pi/market');
 const money=value=>Number.isFinite(value)?value.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2}):'—';
 return intro('PI Market','Jita IV–4 · ISK per unit, before fees.', '<div class="actions"><button data-nav="pi">← Planetary industry</button><button data-action="update-view">Refresh prices</button></div>')+
 '<p class="muted">Buy: highest buy order · Sell: lowest sell order · Average: midpoint of buy and sell, not historical trading average. Prices follow the EVE cache.</p>'+data.groups.map(g=>`<section class="panel compact pi-market-section"><h2>${esc(g.name)}</h2>${g.description?`<small>${esc(g.description)}</small>`:''}${table(['Material','Jita Buy','Jita Sell','Jita Average','Updated'],g.items.map(r=>`<tr><td><span class="icon-label">${eveIcon(r.id)}${esc(r.name)}</span></td><td>${money(r.buy)}</td><td>${money(r.sell)}</td><td>${money(r.average)}</td><td>${r.error?'Unavailable':r.updated?date(r.updated):'Unavailable'}</td></tr>`))}</section>`).join('');
}
function piSharingSummary(){
 const shares=piShares.recipients.map(recipient=>({recipient,pilots:piShares.pilots.filter(p=>piShares.grants.some(g=>g.recipient_id===recipient.id&&g.character_id===p.id))})).filter(s=>s.pilots.length);
 if(!shares.length)return '';
 return `<section class="pi-sharing-summary" aria-label="Sharing with"><strong>Sharing with</strong><div class="pi-sharing-recipients">${shares.map(({recipient:r,pilots})=>`<details class="pi-sharing-recipient"><summary><img src="https://images.evetech.net/characters/${Number(r.main_id)}/portrait?size=32" alt=""><span>${esc(r.name)}</span><small>${pilots.length} pilot${pilots.length===1?'':'s'}</small></summary><div class="pi-sharing-detail"><span>${pilots.map(p=>esc(p.name)).join(' · ')}</span><button data-pi-edit-share="${r.id}">Edit / unshare</button></div></details>`).join('')}</div></section>`;
}
function piShareView(){
 return `<h2>Share planetary industry</h2><p>Share selected pilots’ planets, production and storage. Recipients can view only. Untick pilots to remove access, or use Unshare all.</p><form id="pi-share-form"><label>Share to<select name="recipient" id="pi-share-recipient" required><option value="">Choose a member</option>${piShares.recipients.map(r=>`<option value="${r.id}">${esc(r.name)} · ${r.main_id}</option>`).join('')}</select></label><label class="pi-share-check"><input type="checkbox" id="pi-share-all">Select all pilots</label><div class="pi-share-pilots">${piShares.pilots.map(c=>`<label class="pi-share-check"><input type="checkbox" name="pilot" value="${c.id}">${esc(c.name)}</label>`).join('')}</div><p id="pi-share-error" role="alert"></p><div class="actions"><button type="submit" class="primary">Save sharing</button><button type="button" id="pi-unshare">Unshare all</button></div></form>`;
}
function updatePIShareSelection(){
 const recipient=Number(dialog.querySelector('#pi-share-recipient').value);
 dialog.querySelectorAll('[name=pilot]').forEach(el=>el.checked=piShares.grants.some(g=>g.recipient_id===recipient&&g.character_id===Number(el.value)));
 updatePIShareAll();
}
function updatePIShareAll(){
 const boxes=[...dialog.querySelectorAll('[name=pilot]')],all=dialog.querySelector('#pi-share-all'),count=boxes.filter(b=>b.checked).length;
 all.checked=boxes.length>0&&count===boxes.length;all.indeterminate=count>0&&count<boxes.length;
}
async function operations() {
  if(page==='pi'){loadPIView();if(myPilotFocus?.page==='pi')pageAlts.pi=true;}
  const kind = page === "pi" ? "pi" : "dens",
    rows = (await api(kind==="pi"&&piShared?"/pi/shared":"/operations/" + kind)).filter(c=>myPilotFocus?.page===page?c.id===myPilotFocus.id:true);
  let populated = (kind==="pi"&&!piShared?visibleCharacters(rows):rows).filter(c => Array.isArray(c.data) && c.data.length > 0);
  const pending = rows.filter(c => !Array.isArray(c.data) || c.error).length;
  if(kind==="pi"){[piDashboard,piShares]=await Promise.all([api("/pi/dashboard"),api("/pi/shares")]);}
  if(kind==="dens"){loadDenView();denPrice=await api("/market/keys").catch(()=>({price:null}));populated=populated.map(c=>({...c,data:filterDens(c.data,denView.attention,denView.sort)})).filter(c=>c.data.length);}
  return (
    intro(
      kind === "pi" ? "Planetary Industry" : "Mercenary Dens",
      kind === "pi"
        ? "Your colonies, production programmes and launchpad inventory."
        : "Every linked character’s dens and available tactical operations.",
      kind==="pi"?`<div class="actions pi-toolbar"><button data-action="pi-settings">⚙ Settings</button><button data-nav="pi-market">Market</button><button data-action="pi-share">Share</button><button data-action="pi-shared" aria-pressed="${piShared}">Shared with me</button></div>`:"",
    ) +
    (kind==="pi"?piSharingSummary():"") +
    (kind==="dens" ? denOverview(rows)+denToolbar(rows,populated) : (piShared?'<p class="muted">Read-only PI shared with you. All shared pilots are shown.</p>':myPilotFocus?.page==='pi'||piDashboard.settings.show_goals===false?'':piDashboardView(piDashboard))+piFilterBar()) +
    (kind === "pi" ? "" : `<div class="den-snapshot-note">Stored keys and anarchy reflect the last sync. ISK values use EVE’s market average, before fees. Upcoming spawn times are not included in the available ESI data.</div>`) +
    (pending ? `<div class="notice">${pending} character${pending === 1 ? '' : 's'} awaiting a successful sync. ${kind==='pi'&&piShared?'The owner needs to sync these pilots.':'Use Refresh all characters to retry.'}</div>` : '') +
    (populated.length ? (kind==="pi" ? (items,render)=>items.map(render).join('') : denCharacters)(populated,
        (c,index) =>
          `<section class="panel" ${kind==="pi"?`data-pi-character data-pi-shade="${index%2}"`:""}><div class="panelhead">${kind==="pi"&&piShared?`<div class="pilot"><img class="portrait" alt="" src="https://images.evetech.net/characters/${c.id}/portrait?size=64"><div><strong>${esc(c.name)}</strong><small>Shared by ${esc(c.owner_name)}</small></div></div>`:portrait(c)}<div class="actions">${kind==="pi"?`<small class="pi-planet-count">${c.data.length} of up to 6 planets occupied</small>`:""}${kind==="pi"?"":`<small>${date(c.updated)}</small>`}${kind==="pi"&&piShared?"":`<button data-sync-char="${c.id}">↻ Sync character</button>`}</div></div>${c.error ? `<div class="notice error">${esc(c.error)}</div>` : ""}${kind==="pi"?piSnapshotNotice(c):""}${!c.data ? empty("Awaiting first sync") : kind === "pi" ? planets(c.data,c.settings||piDashboard.settings,c.name) : dens(c.data)}</section>`,
      ) : empty(kind === "pi" ? (piShared?"No planets shared with you":"No planetary colonies reported for visible characters") : denView.attention?"No matching dens":"No Mercenary Dens reported", pending ? "Some characters still need a successful sync." : kind==="pi"&&piShared?"Ask a member to share their PI with you.":kind==="dens"&&denView.attention?"No saved dens match Needs Attention. Clear the filter to show all dens.":"None of your synced characters have any."))
  );
}
function planets(rows,settings=piDashboard.settings,pilot='') {
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
  return `<div class="planetgrid">${rows.map((p) => `<article class="planet" data-pi-search="${esc(piSearchText(p,pilot))}" data-pi-status="${piPlanetStatuses(p,settings).join(' ')}"><div class="planet-heading"><img src="https://images.evetech.net/types/${p.info?.type_id || types[p.planet_type] || 11}/icon?size=64" alt="${esc(p.planet_type)} planet"><div><strong>${esc(p.systemName)}</strong><small>${esc(p.info?.name || p.planet_id)} · ${esc(p.planet_type)}</small></div></div><small>${p.resetAt ? `Extractor reset: <span data-reset="${esc(p.resetAt)}">${Date.parse(p.resetAt) <= Date.now() ? "Reset needed" : eta(p.resetAt)}</span>` : "No extraction programme"}</small>${extractionRows(p,settings)}${p.finalProducts.length ? p.finalProducts.map((r) => `<div class="planet-product"><div class="planet-product-line"><strong class="icon-label">${eveIcon(r.type_id)}${esc(r.name)}</strong>${p.production.some(r=>r.kind==="Extractor")?"":`<span title="Configured factory capacity; input supply may reduce output">- ${num(r.perHour)}/hr capacity</span>`}</div><small>${num(r.stored)} in launchpads</small></div>`).join("") : "<small>No final product configured</small>"}${launchpadRows(p)}<details><summary>All production & storage</summary>${p.production.map((r) => `<div class="production"><span>${esc(r.name)}<small>${esc(r.kind)} · ${esc(r.status)}</small></span><strong>${num(r.perHour)}/h</strong></div>`).join("")}<h3>Storage</h3>${p.storage.map((l) => `<small>${esc(l.kind)} ${l.id}</small>${l.contents.length ? l.contents.map((i) => `<div class="production"><span>${esc(i.name)}</span><strong>${num(i.amount)}</strong></div>`).join("") : "<small>Empty</small>"}`).join("")}</details></article>`).join("")}</div>`;
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
let denPrice={price:null},denView={attention:false,sort:'priority'},denViewScope='';
function loadDenView(){const key='tools-dens-view:'+me.main_id+':'+(me.inspect?.name||'self');if(key===denViewScope)return;denViewScope=key;try{const value=JSON.parse(localStorage.getItem(key)||'{}');denView={attention:value.attention===true,sort:value.sort==='manual'?'manual':'priority'};}catch{denView={attention:false,sort:'priority'};}}
function denToolbar(rows,visible){const all=rows.flatMap(c=>c.data||[]),shown=visible.reduce((n,c)=>n+c.data.length,0);return `<div class="den-view-controls"><button data-den-attention aria-pressed="${denView.attention}">Needs Attention · ${all.filter(d=>denAttention(d).needed).length}</button><label>Sort <select data-den-sort><option value="priority" ${denView.sort==='priority'?'selected':''}>Priority</option><option value="manual" ${denView.sort==='manual'?'selected':''}>Character order</option></select></label><small>${shown} of ${all.length} dens shown · Priority: reinforced, expiring MTOs, workforce impact, rising anarchy, incomplete MTO data. Character groups stay together.</small></div>`;}
function denCharacters(rows,renderCharacter){return sortDenGroups(characterGroups(rows),denView.sort).map(g=>`<div class="character-group">${g.main?renderCharacter(g.main):`<strong>${esc(g.name)}</strong>`}${g.alts.length?`<details class="alt-group" data-alt-group="${g.id}" ${expandedAltGroups.has(g.id)||denView.attention?'open':''}><summary>Alts · ${g.alts.length} · ${esc(g.name)}</summary><div class="alt-members">${g.alts.map(renderCharacter).join('')}</div></details>`:''}</div>`).join('');}
async function saveDenView(){try{localStorage.setItem(denViewScope,JSON.stringify(denView));}catch{}await render();}
root.addEventListener('click',async e=>{if(page!=='dens'||!e.target.closest('[data-den-attention]'))return;denView.attention=!denView.attention;await saveDenView();});
root.addEventListener('change',async e=>{if(page!=='dens'||!e.target.matches('[data-den-sort]'))return;denView.sort=e.target.value;await saveDenView();});
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
 return `<div class="den-table">${table(["Den / planet","State","Keys / estimated ISK","Development","Anarchy","Workforce","Operations","Expires"],rows.map(d=>{
 const impact=workforceImpact(d), ops=activeOperations(d).sort((a,b)=>Date.parse(a.expires)-Date.parse(b.expires)),attention=denAttention(d);
 const cells=`<td><strong class="icon-label">${eveIcon(d.type_id)}${esc(d.planet?.name||d.skyhook?.planet_id)}</strong>${attention.needed?`<small class="den-attention-reasons">${esc(attention.reasons.join(' · '))}</small>`:''}${d.reinforcement_timer?`<small class="pilot-missing">Reinforced · ${date(d.reinforcement_timer.end)}</small>`:''}</td><td>${tag(d.state,d.state==='Running'?'':'warn')}</td><td><span class="den-key-value"><strong>${num(d.infomorphs?.amount)}</strong> / ${denPrice.price==null?'Value unavailable':num((d.infomorphs?.amount||0)*denPrice.price)+' ISK'}</span></td><td>${denMeter(d.evolution?.development)}</td><td>${denMeter(d.evolution?.anarchy,true)}</td><td>${tag(impact==null?'Unknown':impact===0?'No impact':'−'+impact+'%',impact>0?'warn':'')}<small>${impact>0?'Workforce reduction':''}</small></td>`;
 const operations=ops.length?ops:[null];
 return operations.map((o,i)=>`<tr>${i===0?cells.replaceAll('<td>',`<td rowspan="${operations.length}">`):''}<td>${i===0&&d.operations_error?`<small class="pilot-missing">${esc(d.operations_error)}</small>`:''}${o?`<details class="den-operation"><summary>${esc(o.definition?.name?.en||'Tactical operation')} · ${esc(o.state)}</summary>${o.definition?`<p>${esc(o.definition.description?.en||'')}</p><small>Anarchy ${num(o.definition.anarchyImpact)} · Development +${num(o.definition.developmentImpact)}</small>`:''}</details>`:d.operations_error?'':'<small>No active MTOs reported</small>'}</td><td class="den-expiry">${o?`<span data-den-expiry="${esc(o.expires)}" title="${esc(date(o.expires))}">${eta(o.expires)}</span>`:'-'}</td></tr>`).join('');
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
let cloneRows=[],cloneView=clonePreferences(),cloneScope='',cloneStatusKey='';
function saveCloneView(){try{localStorage.setItem(cloneScope,JSON.stringify(cloneView));}catch{}}
function loadCloneView(){const scope='tools-clones:'+me.main_id+':'+(me.inspect?.name||'self');if(scope===cloneScope)return;cloneScope=scope;try{cloneView=clonePreferences(JSON.parse(localStorage.getItem(scope)||'{}'));}catch{cloneView=clonePreferences();}}
function cloneHelpers(){return {esc,portrait,implantList};}
function stripeClonePanels(){let index=0;document.querySelectorAll('#clone-results .clone-character').forEach(panel=>{const alts=panel.closest('details.alt-group');if(!alts||alts.open)panel.dataset.cloneShade=String(index++%2);});}
function refreshCloneResults(){const target=document.querySelector('#clone-results');if(target){target.innerHTML=cloneResults(cloneRows,chars,cloneView,cloneHelpers());applyVisualStyles();}}
async function clonesPage(){
 loadCloneView();const rows=await api('/operations/clones');
 if(page!=='clones')return '';
 cloneRows=rows.filter(c=>myPilotFocus?.page===page?c.id===myPilotFocus.id:true).map(c=>({...c,reconnect:chars.find(p=>p.id===c.id)?.reconnect||false}));
 cloneStatusKey=JSON.stringify(cloneRows.map(c=>[c.id,cloneReadiness(c).kind]));
 return intro('Clones','Your active implants, home clone and stored jump clones.')+cloneToolbar(cloneView,cloneHelpers())+`<div id="clone-results">${cloneResults(cloneRows,chars,cloneView,cloneHelpers())}</div><small class="clones-help">Readiness is estimated from the last EVE snapshot. Home-clone information appears after a successful clone sync. View preferences are saved on this browser.</small>`;
}
root.addEventListener('input',event=>{if(event.target.id!=='clone-search')return;cloneView.q=event.target.value;saveCloneView();refreshCloneResults();});
root.addEventListener('change',event=>{if(!['clone-filter','clone-view'].includes(event.target.id))return;cloneView[event.target.id==='clone-filter'?'filter':'view']=event.target.value;saveCloneView();refreshCloneResults();});
root.addEventListener('click',event=>{
 const action=event.target.closest('[data-clones-action]')?.dataset.clonesAction;if(!action||page!=='clones')return;
 if(action==='clear'){cloneView.q='';cloneView.filter='all';saveCloneView();document.querySelector('#clone-search').value='';document.querySelector('#clone-filter').value='all';refreshCloneResults();return;}
 if(['expand','collapse'].includes(action)){const opened=action==='expand';document.querySelectorAll('#clone-results [data-clone-open]').forEach(el=>{const key=el.dataset.cloneOpen;cloneView.open=cloneView.open.filter(k=>k!==key);cloneView.closed=cloneView.closed.filter(k=>k!==key);cloneView[opened?'open':'closed'].push(key);el.open=opened;});stripeClonePanels();saveCloneView();}
});
document.addEventListener('toggle',event=>{const el=event.target;if(page!=='clones'||!el.isConnected||!el.matches?.('[data-clone-open]'))return;stripeClonePanels();if(cloneView.q.trim()||cloneView.filter!=='all')return;const key=el.dataset.cloneOpen;cloneView.open=cloneView.open.filter(k=>k!==key);cloneView.closed=cloneView.closed.filter(k=>k!==key);cloneView[el.open?'open':'closed'].push(key);saveCloneView();},true);
setInterval(()=>{
 if(page!=='clones')return;
 document.querySelectorAll('[data-clone-readiness]').forEach(el=>{const pilot=cloneRows.find(c=>c.id===Number(el.dataset.cloneReadiness));if(pilot){const state=cloneReadiness(pilot);el.textContent=state.label;el.dataset.cloneState=state.kind;}});
 const key=JSON.stringify(cloneRows.map(c=>[c.id,cloneReadiness(c).kind]));if(key!==cloneStatusKey&&!document.activeElement?.closest('#clone-results')&&!document.activeElement?.matches('input,select,textarea')){cloneStatusKey=key;refreshCloneResults();}
},10000);
setInterval(()=>document.querySelectorAll("[data-clone-ready]").forEach(el=>el.textContent=cloneTimer(el.dataset.cloneReady)),10000);
const pageAlts={contracts:false,wallet:false,mining:false,industry:false,pi:false,assets:false,characters:false};
function altFilter() {return `<div class="training-visibility"><button data-action="page-alts" aria-pressed="${pageAlts[page]}">${pageAlts[page]?"Hide alts":"Show alts"}</button></div>`;}
function visibleCharacters(rows) {return characterGroups(rows).flatMap(g=>[...(g.main?[g.main]:[]),...(pageAlts[page]?g.alts:[])]);}
function selectVisibleCharacter(rows) {if(!rows.some(c=>c.id===Number(selected))) {selected=rows[0]?.id;assetOffset=0;}}
function characterTiles(rows,label) {
 return `<div class="training-overview character-picker">${characterGroups(rows).flatMap(g=>[...(g.main?[g.main]:[]),...g.alts]).map(c=>`<button class="training-card" data-select-char="${c.id}" aria-pressed="${Number(selected)===c.id}"><img class="portrait" src="https://images.evetech.net/characters/${c.id}/portrait?size=64" alt=""><span><strong>${esc(c.name)}</strong><small>${label(c)}</small></span></button>`).join('')}</div>`;
}
let miningFilters=miningPreferences(),miningOffset=0,miningPilot=null,miningScope='',miningSource=[],miningPricing=null;
function saveMiningView(){try{localStorage.setItem(miningScope,JSON.stringify({...miningFilters,pilot:miningPilot,pickerAlts:pageAlts.mining}));}catch{}}
function loadMiningView(){const scope='tools-mining:'+me.main_id+':'+(me.inspect?.name||'self');if(scope===miningScope)return;miningScope=scope;try{const raw=JSON.parse(localStorage.getItem(scope)||'{}');miningFilters=miningPreferences(raw);miningBounds(miningFilters);miningPilot=Number.isSafeInteger(raw.pilot)&&raw.pilot>0?raw.pilot:null;pageAlts.mining=raw.pickerAlts===true;}catch{miningFilters=miningPreferences();miningPilot=null;}}
root.addEventListener('change',e=>{if(e.target.name==='days'&&e.target.closest('#mining-filter'))for(const input of e.target.form.querySelectorAll('input[type=date]'))input.disabled=e.target.value!=='custom';});
root.addEventListener('click',async e=>{const action=e.target.closest('[data-mining-action]')?.dataset.miningAction;if(!action)return;if(action==='clear'){miningFilters=miningPreferences();miningOffset=0;saveMiningView();await render();}if(action==='alts'){miningFilters.alts=!miningFilters.alts;saveMiningView();await render();}if(action==='refine'){const target=document.getElementById('mining-refining');if(target){target.open=true;target.scrollIntoView({block:'start',behavior:'smooth'});}}if(action==='export'){const rows=miningAnalysis(miningSource,chars,miningFilters,miningPricing?.ore_prices||[]).rows,url=URL.createObjectURL(new Blob([miningCSV(rows)],{type:'text/csv;charset=utf-8'})),link=document.createElement('a');link.href=url;link.download='tools-mining.csv';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}});

async function mining(){
 loadMiningView();
 const [rows,refining]=await Promise.all([api('/operations/mining'),api('/mining/refining?ores=1').catch(()=>null)]),combined=combinedMining(rows),visible=visibleCharacters(rows);
 if(miningPilot!==null&&!visible.some(c=>c.id===miningPilot))miningPilot=null;
 const c=rows.find(c=>c.id===miningPilot),isAll=miningPilot===null;miningSource=isAll?rows:c?[c]:[];miningPricing=refining;saveMiningView();
 const picker=`<div class="training-overview character-picker mining-picker"><button class="training-card" data-mining-all="1" aria-pressed="${isAll}"><span><strong>All characters</strong><small>${rows.length} pilots · including all alts</small></span></button>${visible.map(p=>{const stats=p.data?miningAnalysis([p],chars,miningFilters,refining?.ore_prices||[]):null;return `<button class="training-card" data-mining-pilot="${p.id}" aria-pressed="${p.id===miningPilot}"><img class="portrait" src="https://images.evetech.net/characters/${p.id}/portrait?size=64" alt=""><span><strong>${esc(p.name)}</strong><small>${stats?num(stats.volume)+' m³'+(stats.unknown?' known volume':''):'Connect mining access'}${p.error?' · needs sync':''}</small></span></button>`}).join('')}</div>`;
 const heading=isAll?`<div class="panelhead mining-heading"><div><strong>Combined mining · all characters and alts</strong><small>${combined.connected} / ${combined.total} pilots have imported ledgers · oldest snapshot ${date(combined.updated)}</small></div><button data-action="sync">↻ Refresh all characters</button></div>${combined.missing.length?`<p class="notice">Not yet included: ${esc(combined.missing.join(', '))}. Select each pilot to connect mining access.</p>`:''}${combined.failed.length?`<p class="notice error">Latest sync failed for ${esc(combined.failed.join(', '))}. Available previous ledgers are included.</p>`:''}`:c?`<div class="panelhead mining-heading">${portrait(c)}<div class="actions"><small>${date(c.updated)}</small><a class="button" href="/auth/login?link=1&mining=1&character=${c.id}">Connect mining access</a><button data-sync-char="${c.id}">↻ Sync character</button></div></div>${c.error?`<p class="notice error">${esc(c.error)}${c.data?' Last successful ledger retained.':''}</p>`:''}`:'';
 return intro('Mining','Combined mining across all mains and alts. Select a pilot for their breakdown. All characters always includes alts.')+picker+altFilter()+heading+miningDashboardView(miningSource,chars,miningFilters,miningOffset,refining);
}
let industryPilot=null,industryFilters=industryPreferences(),industryScope='',industrySource=[],industryOffset=0;
function saveIndustryView(){try{localStorage.setItem(industryScope,JSON.stringify({...industryFilters,pilot:industryPilot,pickerAlts:pageAlts.industry}));}catch{}}
function loadIndustryView(){const scope='tools-industry:'+me.main_id+':'+(me.inspect?.name||'self');if(scope===industryScope)return;industryScope=scope;industryFilters=industryPreferences();industryPilot=null;industryOffset=0;try{const raw=JSON.parse(localStorage.getItem(scope)||'{}');industryFilters=industryPreferences(raw);industryPilot=Number.isSafeInteger(raw.pilot)&&raw.pilot>0?raw.pilot:null;pageAlts.industry=raw.pickerAlts===true;}catch{}}
root.addEventListener('click',async e=>{const b=e.target.closest('button');if(!b)return;const action=b.dataset.industryAction;if(b.dataset.industryStatus!==undefined){industryFilters.status=industryFilters.status===b.dataset.industryStatus?'':b.dataset.industryStatus;industryOffset=0;saveIndustryView();await render();}if(b.dataset.industryOffset!==undefined){industryOffset=Number(b.dataset.industryOffset);await render();}if(action==='clear'){industryFilters=industryPreferences();industryOffset=0;saveIndustryView();await render();}if(action==='export'){if(document.querySelector('#content')?.getAttribute('aria-busy')==='true')return;const url=URL.createObjectURL(new Blob([industryCSV(industryRows(industrySource,industryFilters))],{type:'text/csv;charset=utf-8'})),link=document.createElement('a');link.href=url;link.download='tools-industry.csv';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}});
async function industry(){
 loadIndustryView();const source=await api('/operations/industry');
 if(myPilotFocus?.page==='industry'){industryPilot=myPilotFocus.id;pageAlts.industry=true;myPilotFocus=null;}
 const visible=visibleCharacters(source);if(industryPilot!==null&&!visible.some(c=>c.id===industryPilot))industryPilot=null;
 industrySource=industryPilot===null?source:source.filter(c=>c.id===industryPilot);saveIndustryView();
 const picker=`<div class="training-overview character-picker industry-picker"><button class="training-card" data-industry-all="1" aria-pressed="${industryPilot===null}"><span><strong>All Characters</strong><small>${source.length} pilots · including all alts</small></span></button>${visible.map(c=>{const stats=industrySummary(industryRows([c]));return `<button class="training-card" data-industry-pilot="${c.id}" aria-pressed="${industryPilot===c.id}"><img class="portrait" src="https://images.evetech.net/characters/${c.id}/portrait?size=64" alt="" loading="lazy"><span><strong>${esc(c.name)}</strong><small>${c.data?stats.running+' running · '+stats.ready+' ready'+(stats.paused?' · '+stats.paused+' paused':''):'Awaiting sync'}</small><small>${stats.next?'Next: '+jobTime(stats.next.end_date):''}${c.error?' · Refresh issue':''}</small></span></button>`;}).join('')}</div>`;
 return intro('Industry','Outstanding manufacturing, research, copying, invention and reaction jobs. All Characters includes alts.',industryPilot?`<button data-sync-char="${industryPilot}">↻ Sync character</button>`:'<div class="actions"><button data-action="sync">↻ Refresh all characters</button></div>')+picker+altFilter()+industryDashboardView(industrySource,industryFilters,industryOffset);
}
function assetCharacterGroups(items) {
 const owners=chars.filter(c=>items.some(a=>a.character_id===c.id));
 return owners.map(c=>`<strong>${esc(c.name)}</strong>${table(["Item","Quantity","Container / flag"],stackAssetRows(items.filter(a=>a.character_id===c.id)).map(a=>`<tr><td><span class="icon-label" data-asset-indent="${Math.min(a.depth,12)*16}">${a.depth?'<span aria-hidden="true">↳</span>':''}${eveIcon(a.type_id)}${esc(a.name)}${a.context?'<small class="muted"> · context</small>':''}</span></td><td>${num(a.quantity)}</td><td>${a.location_id!==a.root_location_id?'Container '+a.location_id+' · ':''}${esc(a.location_flag)}</td></tr>`))}`).join('');
}
async function assets() {
  const visible=visibleCharacters(chars);
  selectVisibleCharacter(visible);
  if(!visible.length)return intro("Asset Search", "Search the selected character, or tick Search All to include every main and alt.")+altFilter()+empty("No visible characters");
  assetFilters.character=assetSearchAll?"":String(selected||"");
  const qs = new URLSearchParams({ ...assetFilters, offset: assetOffset });
  const data = await api("/assets?" + qs);
  return (
    intro("Asset Search", "Search the selected character, or tick Search All to include every main and alt.") + altFilter() + characterTiles(visible,c=>c.snapshots.some(s=>s.kind==="assets")?"Assets synced":"Awaiting sync").replace('character-picker','character-picker asset-pilot-picker') +
    `<form id="asset-search" class="toolbar"><label class="asset-search-all"><input type="checkbox" name="all" ${assetSearchAll?'checked':''}> Search All</label><input name="q" aria-label="Item name" placeholder="Search item name…" value="${esc(assetFilters.q)}"><input type="hidden" name="character" value="${Number(selected)||''}"><input name="location" aria-label="Location" placeholder="Filter location…" value="${esc(assetFilters.location)}"><button class="primary">Search</button></form><section class="panel"><div class="panelhead"><h2>${num(data.total)} matching stacks</h2><small>${data.locationCount ? assetOffset + 1 : 0}–${Math.min(assetOffset + 20, data.locationCount)} of ${num(data.locationCount)} locations</small></div>${
      data.locations.length
        ? data.locations
            .map(
              (l) =>
                `<details class="asset-location compact"><summary>${eveIcon(l.type_id)}<strong>${esc(l.name)}</strong>${l.type_name ? `<span class="location-type"> · ${esc(l.type_name)}</span>` : ""}<span class="muted"> · ${num(l.items.filter(a=>!a.context).length)} matching stacks · ${num(l.items.filter(a=>!a.context).reduce((n, a) => n + a.quantity, 0))} items</span></summary>${assetCharacterGroups(l.items)}</details>`,
            )
            .join("")
        : empty(
            "No matching assets",
            "An empty result may mean the first asset sync has not completed.",
          )
    }<div class="actions"><button data-page-assets="-1" ${assetOffset === 0 ? "disabled" : ""}>Previous</button><button data-page-assets="1" ${assetOffset + 20 >= data.locationCount ? "disabled" : ""}>Next</button></div></section><section class="panel"><h2>Snapshot freshness</h2>${groupedCharacters(data.sources.filter(c=>assetSearchAll||c.id===Number(selected)),(c) => `<div class="production"><span>${esc(c.name)}</span><div class="actions"><small>${date(c.updated)}</small><button data-sync-char="${c.id}">↻ Sync</button></div></div>`)}</section>`
  );
}
const corpFuel = (s,rate,stock) => rate==null||stock==null?null:rate===0?stock:Math.max(0,stock-rate*Math.max(0,Date.now()-s.inventory_at)/3600000);
function corpRunway(s){
 const first=fuelDeadlines(s)[0];
 return first?`<span class="${first.at<Date.now()+3*86400000?"corp-danger":first.at<Date.now()+7*86400000?"corp-warning":"corp-good"}">${first.at<=Date.now()?"Fuel due":eta(new Date(first.at).toISOString())}</span><small>${esc(first.label)} · ${date(first.at)}</small>`:s.rate===0?"Services offline":"Unknown";
}
function corpStock(s){return `<strong>${num(s.fuel)} blocks</strong><small>${s.rate==null?"Rate unknown":num(s.rate)+" / hour"}</small>${s.gas!=null?`<small>${num(s.gas)} Magmatic Gas · ${s.gas_rate==null?"rate unknown":num(s.gas_rate)+" / hour"}</small>`:""}`;}
function corpTopup(s,days){
 const block=corpFuel(s,s.rate,s.fuel),gas=corpFuel(s,s.gas_rate,s.gas);
 return `${block==null?"Unknown blocks":num(Math.max(0,Math.ceil(s.rate*24*days-block)))+" blocks"}${s.kind==="Moon Drill"?`<small>${gas==null?"Unknown gas":num(Math.max(0,Math.ceil(s.gas_rate*24*days-gas)))+" gas"}</small>`:""}`;
}
let harvestData=null,harvestSearch="",harvestRegion="";
const isk=value=>value==null?"Unavailable":num(value)+" ISK";
function matchingHarvest(){return (harvestData?.structures||[]).filter(s=>(!harvestRegion||(s.region||"Unknown region")===harvestRegion)&&(!harvestSearch||`${s.name} ${s.system}`.toLowerCase().includes(harvestSearch.toLowerCase())));}
function filterHarvest(){
 document.querySelectorAll("[data-harvest-row]").forEach(row=>{row.hidden=(!row.dataset.search.includes(harvestSearch.toLowerCase()))||!!harvestRegion&&row.dataset.region!==harvestRegion;});
 const count=matchingHarvest().length;const label=document.getElementById("harvest-count");if(label)label.textContent=count+" shown";
 const empty=document.getElementById("harvest-no-match");if(empty)empty.hidden=count>0;
}
function harvestTable(data){
 harvestData=data;const rows=data.structures,known=rows.filter(s=>s.total_value!=null),missing=rows.filter(s=>s.total_value==null||s.missing_prices>0).length;
 const total=rows.length&&!known.length?null:known.reduce((sum,s)=>sum+s.total_value,0),due=rows.filter(s=>s.fuel===0||s.gas===0||(fuelDeadlines(s)[0]?.at??Infinity)<=Date.now()+7*86400000).length;
 const matches=new Set(matchingHarvest().map(s=>s.id));
 return `<div class="harvest-stats"><section class="panel"><small>Total Moondrills</small><strong>${rows.length}</strong><small>All Sacred Templars moondrills</small></section><section class="panel"><small>Total Value in Moondrills</small><strong>${isk(total)}</strong><small>${missing?`Known subtotal · ${missing} drills have incomplete prices`:"Estimated value · all moondrills"}</small></section><section class="panel"><small>Fuel required in the next 7 days</small><strong class="corp-warning">${due}</strong><small>Fuel blocks or gas, including empty bays</small></section></div>
 <p class="harvest-note">Highest estimated value first · Filters apply to the list; totals cover all moondrills.</p><p class="harvest-note">ESI average prices · ${data.prices.checked?"Last checked "+date(data.prices.checked):"Prices unavailable"}${data.prices.error?` · ${esc(data.prices.error)}`:""} · Estimates before fees.</p>
 <div class="harvest-filters"><label>System or structure<input id="harvest-search" placeholder="Search the roster…" value="${esc(harvestSearch)}"></label><label>Region<select id="harvest-region"><option value="">All regions</option>${[...new Set(rows.map(s=>s.region||"Unknown region"))].sort().map(r=>`<option ${r===harvestRegion?"selected":""}>${esc(r)}</option>`).join("")}</select></label><button data-action="harvest-clear">Clear filters</button><button data-action="harvest-export">Export CSV</button><small id="harvest-count">${matches.size} shown</small></div>
 <div class="harvest-table"><table><thead><tr><th>Structure</th><th>System / Region</th><th>Moon materials</th><th>Volume (m³)</th><th>Inventory / Collections</th></tr></thead><tbody>${rows.map(s=>`<tr data-harvest-row="${s.id}" data-search="${esc(`${s.name} ${s.system}`.toLowerCase())}" data-region="${esc(s.region||"Unknown region")}" ${matches.has(s.id)?"":"hidden"}><td><div class="harvest-entity">${eveIcon(s.type_id)}<span><strong>${esc(s.name)}</strong><small>${esc(s.type_name)} · ${esc(s.mining)}</small></span></div><details class="harvest-supply"><summary>Fuel & gas</summary>${corpStock(s)}${corpRunway(s)}<small>7-day top-up: ${corpTopup(s,7)}</small><small>30-day top-up: ${corpTopup(s,30)}</small></details></td><td><strong>${esc(s.system)}</strong><small>${esc(s.region||"Unknown region")}</small></td><td>${!s.materials.length?'<span class="muted">Bay empty · 0 ISK</span>':`<details class="harvest-materials"><summary><strong>${isk(s.total_value)}</strong><span>${s.materials.length} materials · ${s.missing_prices?"Priced subtotal":"Estimated total"} · Details</span></summary>${s.missing_prices?`<small class="corp-warning">${s.missing_prices} material prices unavailable; excluded from subtotal.</small>`:""}<div class="harvest-breakdown">${s.materials.map(i=>`<div class="harvest-material">${eveIcon(i.type_id)}<span><strong>${esc(i.name)}</strong><small>${num(i.quantity)} units · ${i.unit_price==null?"Unit price unavailable":isk(i.unit_price)+" each"}</small></span><strong>${isk(i.value)}</strong></div>`).join("")}</div></details>`}</td><td><strong>${s.total_volume==null?"Unavailable":num(s.total_volume)+" m³"}</strong>${s.missing_volumes?'<small class="corp-warning">Known subtotal · volume data missing</small>':""}</td><td>${date(s.inventory_at)}${Date.now()-s.inventory_at>3*3600000?'<small class="corp-warning">Stale inventory</small>':""}<small>Empty detected: ${s.history.find(h=>h.emptied)?date(s.history.find(h=>h.emptied).to):"Not observed"}</small><details class="harvest-history"><summary>Collections · ${s.history.length}</summary><small>Minimum observed removals between snapshots.</small>${s.history.map(h=>`<details><summary>${h.emptied?"Emptied":"Collection"} · ${date(h.to)}</summary><small>Between ${date(h.from)} and ${date(h.to)}</small>${h.items.map(i=>`<small>${esc(i.name)} · ${num(i.quantity)} units</small>`).join("")}</details>`).join("")||'<small>No collections observed yet.</small>'}</details></td></tr>`).join("")}</tbody></table><p id="harvest-no-match" ${matches.size?"hidden":""}>${rows.length?"No matching moondrills. Try changing the filters.":"No moon drills reported."}</p></div>`;
}
function exportHarvest(){
 const cells=[['Structure','System','Region','Material','Quantity','Unit price ISK (ESI average)','Estimated value ISK','Volume m3','Inventory UTC'],...matchingHarvest().flatMap(s=>(s.materials.length?s.materials:[null]).map(i=>[s.name,s.system,s.region||'',i?.name||'Empty',i?.quantity??0,i?.unit_price??'',i?.value??(i?'':0),i?.volume??(i?'':0),new Date(s.inventory_at).toISOString()]))];
 const csv=cells.map(row=>row.map(v=>{let text=String(v);if(/^[=+@\-\t\r]/.test(text))text="'"+text;return '"'+text.replaceAll('"','""')+'"';}).join(',')).join('\r\n');
 const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})),link=document.createElement('a');link.href=url;link.download='stemp-moon-harvest.csv';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
let corpIndustryFilters={q:'',status:''};
let surveyFilters={q:'',tiers:'',system:'',moon:'',refine:90,mode:'athanor'};
async function corporationPage(){
 if(page==='corp-industry')return intro('Corporation Industry','Sacred Templars · running and undelivered jobs','<button data-action="corp-sync">↻ Sync corporation</button><button data-action="update-view">Update view</button><a href="/auth/login?link=1">Reconnect Character</a>')+corpIndustryView(await api('/corporation/industry'),corpIndustryFilters);
 if(page==='corp-surveys')return intro('Moon Surveys','Sacred Templars · moon composition directory')+moonBrowserView(await api('/corporation/surveys/browser?'+new URLSearchParams(surveyFilters)),surveyFilters);
 const moon=page==="corp-moons",data=await api(moon?"/corporation/harvest":"/corporation/structures"),rows=data.structures.filter(s=>!moon||s.kind==="Moon Drill");
 if(!moon)rows.sort(compareStructureTimers);
 const header=intro(moon?"Moon Mining":"Structures",moon?"Sacred Templars · corporation operations":"Sacred Templars · next timer first · overdue first, unknown last",'<button data-action="corp-sync">↻ Sync corporation</button><button data-action="update-view">Update view</button><a href="/auth/login?link=1">Reconnect Character</a>');
 const status=`<p class="muted corp-status">${data.updated?"Snapshot: "+date(data.updated):"Awaiting first sync"} · ${esc(data.job?.status||"Not queued")}${data.job?.error?`<br><span class="corp-warning">${esc(data.job.error)}</span>`:""}</p>`;
 if(!data.updated)return header+status+empty("Corporation data is being collected","Use Update view after the sync completes.");
 if(moon)return header+status+moonExtractions(data.extractions,data.refineries||[])+harvestTable(data);
 const totals=`<div class="corp-totals"><span><strong>${rows.length}</strong> ${moon?"Moon drills":"Structures"}</span><span><strong>${rows.filter(s=>s.timer).length}</strong> State timers</span>${moon?`<span><strong>${num(rows.reduce((n,s)=>n+s.materials.reduce((a,i)=>a+i.quantity,0),0))}</strong> Stored material units</span>`:""}</div>`;
 return header+status+totals+`<p class="muted">${moon?"Stored materials are the current harvest bay. Collections are minimum observed decreases between snapshots; exact collection times and lifetime production are not supplied by ESI.":"Fuel is reported bay stock. Top-ups project 7 or 30 days from now at current service rates; unknown rates stay unknown. Timers and estimates use UTC."}</p><section class="panel corp-rows">${rows.length?rows.map(s=>`<details><summary><span class="corp-name">${eveIcon(s.type_id)}<span><strong>${esc(s.name)}</strong><small>${esc(s.system)} · ${esc(s.type_name)}</small></span></span><span>${esc(moon?s.mining:s.state.replaceAll("_"," "))}${s.timer?`<small>State ends ${date(s.timer)} · ${eta(s.timer)}</small>`:""}</span><span>${corpStock(s)}</span><span>${corpRunway(s)}</span>${moon?`<span>${num(s.materials.reduce((n,i)=>n+i.quantity,0))} units<small>Empty detected: ${s.history.find(h=>h.emptied)?date(s.history.find(h=>h.emptied).to):"Not observed"}</small></span>`:""}</summary><div class="corp-expanded">${moon?`<h3>Harvest bay</h3>${table(["Material","Units"],s.materials.map(i=>`<tr><td>${eveIcon(i.type_id)} ${esc(i.name)}</td><td>${num(i.quantity)}</td></tr>`))}<h3>Observed collections</h3>${s.history.length?s.history.map(h=>`<details><summary>${h.emptied?"Emptied":"Collection observed"} · ${date(h.from)} – ${date(h.to)}</summary>${table(["Material","Minimum removed"],h.items.map(i=>`<tr><td>${esc(i.name)}</td><td>${num(i.quantity)}</td></tr>`))}</details>`).join(""):"No collections observed yet."}`:`<h3>Timers & services</h3><p>${s.timer?"State timer: "+date(s.timer):"No active state timer reported"}${s.reinforce_hour!=null?" · Reinforcement window centred on "+String(s.reinforce_hour).padStart(2,"0")+":00 UTC (±2 hours)":""}${s.unanchors_at?" · Unanchors: "+date(s.unanchors_at):""}</p>${s.services?.map(v=>`<span class="tag">${esc(v.name)} · ${esc(v.state)}</span>`).join(" ")||"Service data not reported"}`}
 <h3>Fuel planning</h3>${table(["Bay snapshot","7-day top-up","30-day top-up"],[`<tr><td>${date(s.inventory_at)}</td><td>${corpTopup(s,7)}</td><td>${corpTopup(s,30)}</td></tr>`])}${s.kind==="POS"?`<small>POS fuel estimates cover recognised standard towers. Faction/unknown rates are not assumed. Strontium and other supplies:</small>${table(["Resource","In bay"],(s.fuels||[]).map(i=>`<tr><td>${esc(i.name)}</td><td>${num(i.quantity)}</td></tr>`))}`:""}</div></details>`).join(""):empty(moon?"No moon drills reported":"No structures reported")}</section>`;
}
let usersFilters={q:'',role:'',sort:'online-desc',whitelist:''};
function adminCharacterRows(list,affiliations=null) {
 if(affiliations)return table(['Character','Corporation','ESI Status','Last Data','Sync Details'],list.map(c=>`<tr><td>${esc(c.name)}</td><td>${esc(affiliations[c.id]?.corporation_name||'Unavailable')}</td><td>${esc(c.reconnect?'Reconnect Required':c.job||(c.errors.length?'Needs Attention':c.updated?'Synced':'Awaiting First Sync'))}</td><td>${c.updated?date(c.updated):'—'}</td><td><details class="character-sync-detail"><summary>${c.errors.length?c.errors.length+' Issues':'Details'}</summary><small>Bucket :${String(c.minute).padStart(2,'0')} · Next ${date(c.next_due)}</small><small>Last Attempt ${c.attempted?date(c.attempted):'—'}</small>${c.errors.map(e=>`<small>${esc(e.kind)}: ${esc(e.message)}</small>`).join('')}</details></td></tr>`));
 return table(["Character",...(affiliations?["Corporation"]:[]),"ESI status","Bucket","Next slot","Last attempt","Last data"],list.map(c=>`<tr><td>${esc(c.name)}</td>${affiliations?`<td>${esc(affiliations[c.id]?.corporation_name||"Unavailable")}</td>`:""}<td>${esc(c.reconnect?"Reconnect required":c.job|| (c.errors.length?"Needs attention":c.updated?"Synced":"Awaiting first sync"))}${c.errors.length?`<details><summary>${c.errors.length} issues</summary>${c.errors.map(e=>`<small>${esc(e.kind)}: ${esc(e.message)}</small>`).join("<br>")}</details>`:""}</td><td>:${String(c.minute).padStart(2,"0")}</td><td>${date(c.next_due)}</td><td>${c.attempted?date(c.attempted):"—"}</td><td>${c.updated?date(c.updated):"—"}</td></tr>`));
}
async function adminPage() {
 if(page==='admin-whitelist') {
  const list=await api('/admin/whitelist');
  return intro('Whitelist','Login mains may match an allowed pilot, corporation or alliance. Linked alts may belong elsewhere.')+`<section class="panel admin-compact"><form id="whitelist-add" class="actions"><label>Type <select name="kind"><option value="corporation">Corporation</option><option value="pilot">Pilot</option><option value="alliance">Alliance</option></select></label><label>EVE ID <input name="entity_id" type="number" min="1" required placeholder="Pilot, corporation or alliance ID"></label><button class="primary">Add entry</button></form>${table(['Type','Name','ID',''],list.map(c=>`<tr><td>${esc(c.kind)}</td><td><div class="pilot"><img class="eve-icon" src="https://images.evetech.net/${c.kind==='pilot'?'characters':c.kind==='alliance'?'alliances':'corporations'}/${Number(c.entity_id)}/${c.kind==='pilot'?'portrait':'logo'}?size=64" alt=""><strong>${esc(c.name)}</strong></div></td><td>${c.entity_id}</td><td><button data-whitelist-remove="${c.entity_id}" data-whitelist-kind="${c.kind}">Remove</button></td></tr>`))}<small>Corporation and alliance membership is rechecked during login and use, subject to ESI caching. Removing an entry blocks a pilot unless another whitelist entry permits them.</small></section>`;
 }

 if(!me.admin)return "";
 const refresh='<button data-action="update-view">↻ Refresh status</button>';
 if(page==="admin-users") {
  const [allUsers,affiliations]=await Promise.all([api("/admin/users"),api("/admin/affiliations")]),users=filterUsers(allUsers,usersFilters,affiliations),discordEnabled=allUsers.some(u=>u.discord?.enabled),groupOptions=[...new Map(allUsers.flatMap(u=>u.groups||[]).map(g=>[g.id,g.name])).entries()].sort((a,b)=>a[1].localeCompare(b[1]));
  const filters=`<form id="users-filters" class="toolbar users-filters"><label>Search<input name="q" value="${esc(usersFilters.q)}" placeholder="Pilot, alt, corporation or ID…"></label><label>Role<select name="role">${[['','All Roles'],['owner','Owner'],['admin','Admin'],['member','Member'],['recruit','Recruit'],...groupOptions.map(([id,name])=>['group:'+id,name])].map(([id,name])=>`<option value="${esc(id)}" ${id===usersFilters.role?'selected':''}>${esc(name)}</option>`).join('')}</select></label><label>Sort<select name="sort">${[['online-desc','Last Online · Newest First'],['online-asc','Last Online · Oldest First'],['name-asc','Name · A–Z'],['name-desc','Name · Z–A'],['chars-desc','Characters · Most First'],['chars-asc','Characters · Fewest First']].map(([id,name])=>`<option value="${id}" ${id===usersFilters.sort?'selected':''}>${name}</option>`).join('')}</select></label><label>Whitelist<select name="whitelist">${[['','All Accounts'],['denied','Outside Whitelist'],['allowed','Allowed'],['unknown','Unknown · ESI Unavailable'],['pending','Checking'],['protected','Protected']].map(([id,name])=>`<option value="${id}" ${id===usersFilters.whitelist?'selected':''}>${name}</option>`).join('')}</select></label><button>Apply</button><button type="button" data-action="users-clear">Reset</button></form>`;
  const userRow=u=>`<details class="admin-user"><summary><span class="users-pilot"><img src="https://images.evetech.net/characters/${Number(u.main_id)}/portrait?size=64" alt="" loading="lazy"><span><strong>${esc(u.name)}</strong><small>${esc(({owner:'Owner',admin:'Admin',member:'Member',recruit:'Recruit'})[userRole(u)])}</small></span></span><span class="users-corporation">${esc(affiliations[u.main_id]?.corporation_name||"Unavailable")}${discordEnabled?`<small class="${u.discord?.connected?'users-discord-connected':'muted'}">Discord ${u.discord?.connected?'Connected':'Not Connected'}</small>`:''}</span><span class="users-esi-status esi-${accountEsiStatus(u.characters).level}" title="${esc(accountEsiStatus(u.characters).detail)}">● ${esc(accountEsiStatus(u.characters).label)}${u.whitelist?`<small title="${esc(u.whitelist.message)}">Whitelist: ${esc(({denied:'Outside',allowed:'Allowed',unknown:'Unknown',pending:'Checking',protected:'Protected'})[u.whitelist.status]||'Not Checked')}</small>`:''}</span><span class="users-count" aria-label="${u.characters.length} linked characters">${u.characters.length}</span><span class="users-online" title="${u.last_online?date(u.last_online):'Not Recorded'}">${u.last_seen&&Date.now()-u.last_seen<300000?'<span class="users-recent">● Active</span>':u.last_online?date(u.last_online):'Not Recorded'}</span><span class="users-admin-actions">${me.owner&&!u.owner?`<button data-user-admin="${u.id}" data-admin-main="${u.main_id}" data-user-name="${esc(u.name)}" data-admin-enabled="${u.admin?'0':'1'}" aria-pressed="${Boolean(u.admin)}" title="${u.admin?'Remove':'Grant'} site admin access">${u.admin?'Remove Admin':'Make Admin'}</button>`:`<small>${u.owner?'Owner':u.admin?'Admin':''}</small>`}${Number(u.main_id)!==Number(me.main_id)&&!u.owner&&!u.admin?`<button data-inspect-user="${u.id}">Inspect</button>`:''}</span><span class="users-delete-actions">${me.owner&&!u.owner?`<button class="account-delete" data-user-delete="${u.id}" data-user-main="${u.main_id}" data-user-name="${esc(u.name)}" data-user-count="${u.characters.length}" title="Permanently delete ${esc(u.name)}" aria-label="Delete account for ${esc(u.name)}"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/></svg></button>`:''}</span></summary><div class="user-character-table">${me.owner&&!u.owner&&!u.admin&&u.whitelist?.status==='denied'?`<div class="toolbar"><strong>Login main is outside the whitelist.</strong><button class="danger" data-whitelist-delete="${u.id}" data-user-main="${u.main_id}" data-user-name="${esc(u.name)}" data-user-count="${u.characters.length}">Delete Whole Account</button><small>Rechecks ESI before deleting this account and every linked pilot.</small></div>`:''}${adminCharacterRows(u.characters,affiliations)}</div></details>`;
  const userSection=(title,list,total,tools='')=>`<section class="panel admin-compact users-directory"><div class="users-heading"><div><h2>${title}</h2><small>${list.length} / ${total} accounts</small></div><div class="actions">${refresh}<details class="users-help"><summary>Access & Activity</summary><small>Admins can manage site tools and inspect non-admin accounts, including Mail and Contacts where scopes allow. Admin accounts cannot be inspected. Only the site owner can grant or remove admin access.</small><small>Last Online uses site activity, with login time as a fallback. Active means seen within five minutes.</small><small>ESI Status covers every linked pilot and reflects the latest recorded sync. Expand a user for individual issues.</small></details></div></div>${tools}<div class="users-column-head" aria-hidden="true"><span>Pilot</span><span>Corporation</span><span>ESI Status</span><span>Chars</span><span>Last Online</span><span>Actions</span><span></span></div>${list.map(userRow).join("")}${!list.length?'<p class="muted">No accounts match these filters.</p>':''}</section>`;
  const recruits=users.filter(u=>userRole(u)==='recruit'),members=users.filter(u=>userRole(u)!=='recruit'),recruitTotal=allUsers.filter(u=>userRole(u)==='recruit').length;
  return intro("Users","Recruits first, followed by other users. Search, filters and sorting apply to both lists.")+filters+userSection('Recruits List',recruits,recruitTotal)+userSection('Users',members,allUsers.length-recruitTotal,`<div class="toolbar"><button data-action="users-whitelist-review">Check Whitelist</button><small>${allUsers.filter(u=>u.whitelist?.status==='pending').length} pending · ${allUsers.filter(u=>u.whitelist?.status==='denied').length} outside whitelist. Use Refresh status for results. Cleanup removes whole accounts only; ESI errors, admins and active recruits are protected.</small></div>`);
 }
 if(page==="admin-esi") {
  const data=await api("/admin/esi");
  return intro("ESI Status","Hourly syncs in six UTC buckets. Manual refresh stays available; characters sync one at a time.",`<div class="actions"><button data-action="rebalance-buckets" title="Spread characters evenly across the six sync buckets">Rebalance</button>${refresh}</div>`)+`<div class="bucket-grid">${data.buckets.map(m=>{const list=data.characters.filter(c=>c.minute===m);return `<section class="panel"><h2>:${String(m).padStart(2,"0")}</h2><strong>${list.length} characters</strong><small>${list.filter(c=>c.job).length} queued / running</small></section>`}).join("")}</div><section class="panel admin-compact">${adminCharacterRows(data.characters)}</section>`;
 }
 const corps=await api("/admin/corporations");
 return intro("Corp ESI","Corporation access is checked automatically when characters connect or reconnect.",'<a class="button primary" href="/auth/login?link=1">Reconnect Character</a>')+`<section class="panel admin-compact"><p>Read-only access to structures, corporation assets and POS fuel. Membership and CEO/Director status are rechecked before access, with a short ESI verification cache.</p>${corps.length?table(["Corporation","Character","Role","Last verified"],corps.map(c=>`<tr><td>${esc(c.name)}</td><td>${esc(c.character_name)}</td><td>${esc(c.role)}</td><td>${date(c.verified)}</td></tr>`)):empty("No corporation connected")}</section>`;
}
function openDialog(html) {
  dialog.classList.remove("fitting-dialog");
  dialog.innerHTML =
    `<div class="panelhead"><h2 id="dialog-title">Workspace</h2><button data-action="close" aria-label="Close dialog">✕</button></div>` +
    html;
  dialog.setAttribute("aria-labelledby", "dialog-title");
  dialog.showModal();
}
let documentDraftBaseline='';
function documentDraftSignature(){const f=document.querySelector('#document-form');return f?JSON.stringify([Object.fromEntries(new FormData(f)),planEntries]):'';}
function canCloseDocument(){return !documentDraftBaseline||documentDraftBaseline===documentDraftSignature()||confirm('Discard your unsaved document changes?');}
let planEntries = [],
  searchResults = [];
function createDocument(kind, body) {
  planEntries = [];
  openDialog(
    `<h2>${kind === "plan" ? "New skill plan" : "New fitting"}</h2><form id="document-form" data-kind="${kind}"><label>Name<input name="name" required maxlength="150" placeholder="${kind === "plan" ? "Avatar pilot" : "Fleet setup"}"></label>${kind === "plan" ? `<div class="formrow"><input id="catalog-query" aria-label="Search catalogue" placeholder="Search a skill or ship…"><select id="catalog-mode" aria-label="Search category"><option value="skills">Skills</option><option value="ships">Ships</option></select><button type="button" data-action="catalog">Find</button></div><div id="catalog-results"></div><details class="skill-import"><summary>Import from clipboard / text</summary><label>Skill list<textarea id="skill-import-text" rows="6" maxlength="100000" placeholder="Motion Prediction III&#10;Motion Prediction V&#10;Gunnery V"></textarea></label><div class="actions"><button type="button" data-action="paste-skills">Paste clipboard</button><button type="button" data-action="import-skills">Import skills</button><small id="skill-import-status" role="status">Repeated skills use the highest level. Existing skills are kept.</small></div></details><div id="plan-entries"></div>` : `<label>EFT fitting<textarea name="eft" required placeholder="[Avatar, Fleet setup]&#10;Damage Control II&#10;&#10;">${esc(body || "")}</textarea></label><small>Paste an EFT export from EVE or Pyfa. Unknown items are reported before saving.</small>`}<label>Tag<input name="tag" list="document-tag-options" maxlength="40" required value="Personal"><datalist id="document-tag-options">${documentTags().map(t=>`<option value="${esc(t)}"></option>`).join('')}</datalist></label><small>Choose a tag or enter your own. Tags do not change sharing permissions.</small><label><input type="checkbox" name="shared"> Share with signed-in Tools members</label><button class="primary">Save ${kind}</button></form>`,
  );
 documentDraftBaseline=documentDraftSignature();
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
 return `<div class="fit-layout"><div class="fit-ship"><img src="https://images.evetech.net/types/${fit.ship.id}/render?size=512" alt="${esc(fit.ship.name)}"><h2>${esc(fit.ship.name)}</h2><small>Saved loadout · skill checks below</small></div><div class="fit-slots">${fit.groups.filter(g=>g.items.length || ["High slots","Mid slots","Low slots","Rigs"].includes(g.name)).map(g=>`<section><h3>${esc(g.name)} - ${g.items.length}</h3>${g.items.length ? g.items.map(i=>`<div class="fit-module ${i.empty?'muted':''}">${i.empty ? '<span class="empty-slot">○</span>' : eveIcon(i.id)}<div>${esc(i.name)}${i.quantity>1?` × ${num(i.quantity)}`:""}${(i.charges||[]).map(c=>`<small class="fit-charge">${eveIcon(c.id)}${esc(c.name)}</small>`).join("")}</div></div>`).join("") : '<small>No modules listed</small>'}</section>`).join("")}</div></div><p class="muted">Loadout view only; damage, tank, capacitor and fitting capacity are not simulated.</p>`;
}
function copyMissingControl(rows) {
 const text=missingSkillText(rows);
 return text ? `<div class="missing-copy"><button type="button" data-copy-missing="${esc(encodeURIComponent(text))}">Copy missing skills to clipboard</button><small class="copy-status" role="status"></small><textarea class="copy-fallback" aria-label="Missing skills for EVE" readonly hidden>${esc(text)}</textarea></div>` : '<small>No untrained levels to copy.</small>';
}
function fittingPilots(rows) {rows=rows.map(c=>({...c,alt:chars.some(p=>p.id===c.id&&p.parent_id!==p.id)}));for(const row of rows)documentEvidence.set(currentDocument.id+':'+row.id,row);return `<div data-dl-evidence="${esc(currentDocument.id)}">${documentPilotView(rows)}</div>`;}

let documentRequestId=0;
async function showDocument(id) {
 const request=++documentRequestId,loading=[...document.querySelectorAll("[data-fitting-content]")].find(el=>el.dataset.fittingContent===id);if(loading){loading.closest("[data-fitting-row]").hidden=false;loading.innerHTML='<p role="status">Loading fitting and pilot requirements…</p>';}
 try{
  const d = await api("/documents/" + encodeURIComponent(id));currentDocument=d;
  const plans=d.kind === "fitting" ? (await api("/documents")).filter(p=>p.kind === "plan") : [];
  if(request!==documentRequestId)return;
  const html = (
    `<h2>${esc(d.name)}</h2><div class="document-action-row"><div class="actions">${tag(d.shared ? "Shared with members" : "Private", "purple")}${d.mine&&!me.inspect ? `<button data-share="${id}" data-value="${!d.shared}">${d.shared ? "Make private" : "Share with members"}</button><button data-edit-doc="${id}">Edit</button><button class="danger" data-delete-doc="${id}">Delete</button>` : ""}${!me.inspect?`<button data-copy-doc="${id}">Duplicate</button>`:""}${d.kind==='fitting'?`<button data-dl-workbench="${esc(id)}">Open in Workbench</button><button data-dl-create-plan="${esc(id)}" ${me.inspect?"disabled":""}>Create Skill Plan from Fitting</button><button data-eve-fitting="${esc(id)}" ${me.inspect?'disabled':''}>Save to EVE</button>`:''}</div>${d.kind === "fitting" ? `<form id="link-fitting-plan" data-document="${id}" class="fitting-plan-controls"><label>Required skill plan<select name="plan"><option value="">Fitting requirements only</option>${plans.map(p=>`<option value="${esc(p.id)}" ${p.id===d.linkedPlan?"selected":""}>${esc(p.name)}</option>`).join("")}</select></label><button class="primary" ${me.inspect?"disabled":""}>Apply plan</button>${d.linkedPlan?`<button type="button" data-dl-open="${esc(d.linkedPlan)}">Open Linked Plan</button>`:""}<small>Linked plans add requirements to the fitting minimums for your account.</small></form></div><div class="fitting-workspace"><div>${renderFitting(d.fitting)}</div>${fittingPilots(d.readiness||[])}</div><details><summary>EFT fitting · copy or export</summary><textarea readonly id="eft-export">${esc(d.body)}</textarea><button data-export="${id}">Download EFT</button></details>` : `</div><div class="actions"><button data-dl-export-plan="${esc(id)}">Export Full Plan</button>${(d.linkedFittings||[]).map(f=>`<button data-dl-open="${esc(f.id)}">Fitting: ${esc(f.name)}</button>`).join("")}</div><details><summary>${d.body.length} skills including prerequisites</summary><div id="plan-view">${d.body.map((r) => `<div class="production"><span>📖 ${esc(r.name || r.id)}</span><strong>Level ${r.level}</strong></div>`).join("")}</div></details>${fittingPilots(d.readiness||[])}`}<hr><h3>Check a character</h3><form id="compare" data-document="${id}"><div class="formrow"><select name="character" aria-label="Character">${charOptions()}</select><select name="speed" aria-label="Training speed"><option value="omega">Omega speed</option><option value="alpha">Alpha speed estimate</option></select><button class="primary" ${me.inspect?"disabled":""}>Compare</button></div></form><div id="comparison"></div>`
  );
  const holder=[...document.querySelectorAll("[data-fitting-content]")].find(el=>el.dataset.fittingContent===id);
  if(d.kind === "fitting" && holder) {
    document.querySelectorAll("[data-fitting-row]").forEach(row=>{row.hidden=row.dataset.fittingRow!==id;if(row.hidden)row.querySelector(".inline-fitting").innerHTML="";});
    document.querySelectorAll("button[data-document]").forEach(button=>{if(button.textContent==="View"||button.textContent==="Hide"){button.textContent=button.dataset.document===id?"Hide":"View";button.setAttribute("aria-expanded",String(button.dataset.document===id));}});
    holder.innerHTML=html;
  } else {openDialog(html);dialog.classList.toggle("fitting-dialog",d.kind === "fitting");}
 }catch(error){if(request!==documentRequestId)return;if(loading)loading.innerHTML=`<p role="alert" class="notice error">${esc(error.message)}</p><button data-dl-open="${esc(id)}">Retry</button>`;else throw error;}
}
root.addEventListener("click", async (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  try {
    if(b.dataset.action==='my-focus-clear'){myPilotFocus=null;await render();
    } else if(b.dataset.myTarget){
      selected=Number(b.dataset.myPilot);if(b.dataset.myTarget==='skills')skillsExplicitSelected=selected;myPilotFocus={id:selected,page:b.dataset.myTarget};
      if(Object.hasOwn(pageAlts,b.dataset.myTarget))pageAlts[b.dataset.myTarget]=true;
      if(b.dataset.myTarget==='industry'){loadIndustryView();industryPilot=selected;industryFilters=industryPreferences();industryOffset=0;saveIndustryView();}
      if(b.dataset.myTarget==='contracts'){contractsOffset=0;loadContractsView();contractsPilot=String(selected);contractsFilters=contractPreferences({status:'outstanding'});saveContractsView();}
      if(b.dataset.myTarget==='mining'){loadMiningView();miningPilot=selected;miningOffset=0;miningFilters=miningPreferences();saveMiningView();}
      if(b.dataset.myTarget==='assets'){assetFilters={q:'',character:String(selected),location:''};assetSearchAll=false;assetOffset=0;}
      if(b.dataset.myTarget==='market')expansion.focusPilot(selected);
      if(b.dataset.myTarget==='blueprints')features.focusPilot(selected,'blueprints');
      page=b.dataset.myTarget;history.replaceState(null,'','#'+page);await render();
    } else if(b.dataset.action==='dismiss-overview-guide'){
      b.disabled=true;await api('/settings',{overview_guide_dismissed:true});me.preferences.overview_guide_dismissed=true;b.closest('.overview-guide').remove();
    } else if(b.dataset.action==='overview-clear'){
      overviewPrefs.q='';overviewPrefs.filter='all';saveOverviewView();document.querySelector('#overview-search').value='';document.querySelector('#overview-filter').value='all';updateOverviewList();
    } else if(b.dataset.overviewIssue){
      const id=Number(b.dataset.overviewIssue);
      if(b.dataset.issuePage==='skills'){selected=id;skillsExplicitSelected=id;page='skills';history.replaceState(null,'','#skills');await render();}
      else {overviewPrefs.q='';overviewPrefs.filter='all';const c=chars.find(c=>c.id===id);overviewOpenGroups.add(c?.parent_id||id);saveOverviewView();document.querySelector('#content').innerHTML=overview();applyVisualStyles();const row=document.getElementById('overview-character-'+id);row?.scrollIntoView({block:'center'});row?.focus();}
    } else if (b.dataset.piFilter) {
      const key=b.dataset.piFilter;piStatusFilters.has(key)?piStatusFilters.delete(key):piStatusFilters.add(key);savePIView();applyPIStatusFilters();
    } else if (b.dataset.action === "page-alts" && Object.hasOwn(pageAlts,page)) {
      pageAlts[page]=!pageAlts[page];if(page==='wallet')saveWalletView();if(page==='mining')saveMiningView();if(page==='industry')saveIndustryView();if(page==='pi')savePIView();assetOffset=0;await render();
    } else if(b.dataset.action==='pi-shared') {
      myPilotFocus=null;piShared=!piShared;await render();
    } else if(b.dataset.piEditShare) {
      piShares=await api('/pi/shares');openDialog(piShareView());dialog.querySelector('#pi-share-recipient').value=b.dataset.piEditShare;updatePIShareSelection();
    } else if(b.dataset.action==='pi-share') {
      piShares=await api('/pi/shares');openDialog(piShareView());
    } else if(b.dataset.action==='pi-settings') {
      piDraftTargets=[...piDashboard.settings.targets];openDialog(piSettingsView(piDashboard));
    } else if(b.dataset.action==='update-view') {
      await render();
    } else if(b.dataset.action==='training-alts') {
      showTrainingAlts=!showTrainingAlts;saveSkillsView();
      b.textContent=showTrainingAlts?'Hide alts':'Show alts';b.setAttribute('aria-pressed',String(showTrainingAlts));refreshTrainingCards();
    } else if(b.dataset.overviewMode) {
      overviewExpanded=b.dataset.overviewMode==='expanded';
      saveOverviewView();
      document.querySelector('#content').innerHTML=overview();applyVisualStyles();
    } else if(b.dataset.overviewAlts) {
      const id=Number(b.dataset.overviewAlts);
      if(overviewPrefs.q.trim()||overviewPrefs.filter!=='all'){toast('Clear filters to collapse matching groups.');return;}
      overviewOpenGroups.has(id)?overviewOpenGroups.delete(id):overviewOpenGroups.add(id);saveOverviewView();updateOverviewList();
    } else if(b.dataset.surveySystem || b.dataset.surveyMoon || b.dataset.surveyMode) {
      if(b.dataset.surveySystem){surveyFilters.system=b.dataset.surveySystem;surveyFilters.moon='';}
      if(b.dataset.surveyMoon)surveyFilters.moon=b.dataset.surveyMoon;
      if(b.dataset.surveyMode)surveyFilters.mode=b.dataset.surveyMode;
      await render();
    } else if (b.dataset.action === "harvest-clear") {
      harvestSearch="";harvestRegion="";document.getElementById("harvest-search").value="";document.getElementById("harvest-region").value="";filterHarvest();
    } else if (b.dataset.action === "harvest-export") {exportHarvest();
    } else if (b.dataset.action==='users-clear') {usersFilters={q:'',role:'',sort:'online-desc',whitelist:''};await render();
    } else if (b.dataset.action==='users-whitelist-review') {b.disabled=true;try{const result=await api('/admin/users/whitelist-review',{});toast(`Whitelist review queued for ${result.queued} accounts. Refresh status to see results.`);await render();}finally{b.disabled=false;}
    } else if (b.dataset.whitelistDelete) {e.preventDefault();if(!confirm(`Delete the entire account for ${b.dataset.userName}, including all ${b.dataset.userCount} linked pilots, ESI tokens, fittings and saved data? This cannot be undone. The login main will be rechecked against the whitelist first.`))return;b.disabled=true;try{await api('/admin/users/'+b.dataset.whitelistDelete+'/whitelist-remove',{confirm_main_id:Number(b.dataset.userMain)},'DELETE');toast('Account removed after whitelist verification.');await render();}finally{b.disabled=false;}
    } else if (b.dataset.userDelete) {
      e.preventDefault();
      if(!confirm(`Permanently delete ${b.dataset.userName} and all ${b.dataset.userCount} linked pilots from this site?

This wipes their saved data, fittings, plans, settings, group memberships, ESI tokens and sessions. This cannot be undone. They can sign in again as a new account if still permitted.`))return;
      b.disabled=true;try{await api('/admin/users/'+b.dataset.userDelete,{confirm_main_id:Number(b.dataset.userMain)},'DELETE');toast('Account and its saved data deleted.');await render();}finally{b.disabled=false;}
    } else if (b.dataset.userAdmin) {
      e.preventDefault();const enabled=b.dataset.adminEnabled==='1';if(!confirm(`${enabled?'Grant':'Remove'} site admin access ${enabled?'to':'for'} ${b.dataset.userName}?${enabled?'\n\nThis grants access to administration and saved corporation data.':''}`))return;b.disabled=true;try{await api('/admin/users/'+b.dataset.userAdmin+'/admin',{admin:enabled,confirm_main_id:Number(b.dataset.adminMain)});toast(enabled?'Admin access granted.':'Admin access removed.');await render();}finally{b.disabled=false;}
    } else if (b.dataset.action === "rebalance-buckets") {
      b.disabled=true;const result=await api('/admin/esi/rebalance',{});toast(result.moved?`Rebalanced ${result.total} characters · ${result.moved} moved. Queued syncs continue.`:'Buckets are already balanced.');await render();
    } else if (b.dataset.action === "corp-sync") {
      b.disabled=true;await api("/corporation/sync",{});toast("Corporation refresh queued. EVE cache times are respected.");await render();
    } else if (b.dataset.action === "add-character") {
      openDialog(`<h2>Add character</h2><form id="add-character-form" action="/auth/login" method="get"><input type="hidden" name="link" value="1"><label>Add as<select name="group" id="add-character-group"><option value="main">Main</option><option value="alt">Alt</option></select></label><label id="add-character-parent" hidden>Connected to<select name="parent" disabled>${chars.filter(c=>c.parent_id===c.id).map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select></label><p class="muted">Choose the character on EVE’s login screen. An already-linked character keeps its current group.</p><button class="primary">Continue to EVE login</button></form>`);
    } else if (b.dataset.makeMain) {
      await api('/characters/'+b.dataset.makeMain+'/group',{parent_id:Number(b.dataset.makeMain)});await render();
    } else if (b.dataset.inspectUser) {
      e.preventDefault();await api('/inspect',{user_id:Number(b.dataset.inspectUser)});location.hash=me.admin?'overview':'inspect-pilot-check';location.reload();
    } else if (b.dataset.action==='exit-inspect') {
      await api('/inspect',{exit:true});const own=await api('/me');location.hash=own.admin?'admin-users':own.recruiter?'recruitment':'overview';location.reload();
    } else if (b.dataset.contractsOffset!==undefined) {
      contractsOffset=Number(b.dataset.contractsOffset);await render();
    } else if (b.dataset.walletOffset!==undefined) {
      walletOffset=Number(b.dataset.walletOffset);await render();
    } else if (b.dataset.compare) {
      compareBase=Number(b.dataset.compare);compareIds=[];compareMatches=false;compareShowAlts=false;page="compare";await render();
    } else if (b.dataset.miningAll || b.dataset.miningPilot) {
      miningPilot=b.dataset.miningAll?null:Number(b.dataset.miningPilot);if(miningPilot!==null&&chars.find(c=>c.id===miningPilot)?.parent_id!==miningPilot)pageAlts.mining=true;miningOffset=0;saveMiningView();await render();
    } else if (b.dataset.miningOffset!==undefined) {
      miningOffset=Math.max(0,Number(b.dataset.miningOffset));await render();
    } else if (b.dataset.industryAll||b.dataset.industryPilot) {
      industryPilot=b.dataset.industryAll?null:Number(b.dataset.industryPilot);if(industryPilot!==null&&chars.find(c=>c.id===industryPilot)?.parent_id!==industryPilot)pageAlts.industry=true;selected=industryPilot||selected;industryOffset=0;saveIndustryView();await render();
    } else if (b.dataset.selectChar) {
      selected=Number(b.dataset.selectChar);if(page==='skills'){skillsView.selected=selected;saveSkillsView();}if(page==='characters'){myCharacterView.selected=selected;myCharacterView.alts=chars.find(c=>c.id===selected)?.parent_id!==selected||pageAlts.characters;saveMyCharacterView();}miningOffset=0;
      if(page==='characters'&&chars.find(c=>c.id===selected)?.parent_id!==selected)pageAlts.characters=true;
      assetOffset=0;
      await render();
    } else if (b.dataset.theme) {
      await saveTheme(b.dataset.theme);
      document.querySelectorAll("button[data-theme]").forEach(button=>button.setAttribute("aria-pressed",String(button.dataset.theme===b.dataset.theme)));
      b.closest("details").open=false;
    } else if (b.dataset.nav) {
      if(page==='fitting-workbench'&&b.dataset.nav!==page&&!fittingWorkbench.canLeave())return;
      myPilotFocus=null;
      if(page==='characters'&&Object.hasOwn(pageAlts,b.dataset.nav)&&chars.find(c=>c.id===Number(selected))?.parent_id!==Number(selected))pageAlts[b.dataset.nav]=true;
      page = b.dataset.nav;
      history.replaceState(null,"","#"+page);
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
      if(row && !row.hidden){documentRequestId++;row.hidden=true;row.querySelector(".inline-fitting").innerHTML="";document.querySelectorAll("button[data-document]").forEach(button=>{if(button.dataset.document===b.dataset.document&&button.textContent==="Hide"){button.textContent="View";button.setAttribute("aria-expanded","false");}});}
      else await showDocument(b.dataset.document);
    }
    else if (b.dataset.pageAssets) {
      assetOffset = Math.max(
        0,
        assetOffset + 20 * Number(b.dataset.pageAssets),
      );
      await render();
    } else if (b.dataset.whitelistRemove) {
      await api('/admin/whitelist/'+b.dataset.whitelistKind+'/'+b.dataset.whitelistRemove,{},'DELETE');await render();
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
  document.querySelectorAll('[data-subscription-inherits]').forEach(el=>{if(Number(el.dataset.subscriptionInherits)===character?.id){el.querySelector('input').value=saved.expires_on||'';const label=el.querySelector('.subscription-status');label.textContent=status.label;label.className='subscription-status '+subscriptionColorClass(status);}});
 }catch(error){input.value=character?.subscription_end||'';feedback.textContent='Not saved';toast(error.message);}
 finally{input.disabled=false;}
});
root.addEventListener("change",async e=>{
 if(!e.target.dataset.groupChar)return;
 try{await api("/characters/"+e.target.dataset.groupChar+"/group",{parent_id:Number(e.target.value)});await render();}catch(err){toast(err.message);await render();}
});
root.addEventListener("change", (e) => {
  if(e.target.id==="harvest-region"){harvestRegion=e.target.value;filterHarvest();}
  if (e.target.id === "character-select") {
    selected = e.target.value;
    render();
  }
});
root.addEventListener("input", (e) => {
  if(e.target.id==="harvest-search"){harvestSearch=e.target.value;filterHarvest();}
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
    document.querySelectorAll(".industry-character").forEach(section=>section.hidden=searching ? ![...section.querySelectorAll("[data-blueprint]")].some(row=>!row.hidden) : !(industryPilot===null||Number(section.dataset.industryChar)===industryPilot));
    const count=[...document.querySelectorAll("[data-blueprint]")].filter(row=>!row.hidden).length;
    document.querySelector("#blueprint-results").textContent=searching ? `${count} matching blueprint entries across your characters` : "";
  }

});
root.addEventListener("submit", async (e) => {
  if(e.target.id==='contracts-filter'){e.preventDefault();const next=contractPreferences(Object.fromEntries(new FormData(e.target)));if(next.from&&next.to&&next.from>next.to){toast('The start date must be before the end date.');return;}contractsFilters=next;contractsOffset=0;saveContractsView();await render();return;}
  if(e.target.id==='wallet-filter'){e.preventDefault();try{const form=new FormData(e.target),next={...walletFilters,...Object.fromEntries(form)},changed=next.mode!==walletFilters.mode;if(changed)next.type='';next.exclude_own=!changed&&next.mode==='journal'?form.has('exclude_own'):walletFilters.exclude_own;next.personal_only=!changed&&next.mode==='transactions'?form.has('personal_only'):walletFilters.personal_only;validateWalletFilters(next);walletFilters=walletPreferences(next);walletOffset=0;saveWalletView();await render();}catch(error){toast(error.message);}return;}
  if(e.target.id==='skill-compare-form'){e.preventDefault();const f=new FormData(e.target);compareIds=f.getAll('pilot').map(Number);await render();return;}
  if(e.target.id==='industry-filter'){e.preventDefault();industryFilters=industryPreferences({...Object.fromEntries(new FormData(e.target)),grouped:e.target.elements.grouped.checked});industryOffset=0;saveIndustryView();await render();return;}
  if(e.target.id==='mining-filter'){e.preventDefault();try{const next=miningPreferences({...miningFilters,...Object.fromEntries(new FormData(e.target))});miningBounds(next);miningFilters=next;miningOffset=0;saveMiningView();await render();}catch(error){toast(error.message);}return;}
  if(e.target.id==='whitelist-add'){e.preventDefault();const f=new FormData(e.target);try{await api('/admin/whitelist',{kind:f.get('kind'),entity_id:Number(f.get('entity_id'))});await render();}catch(error){toast(error.message);}return;}
  if(e.target.id==='corp-industry-filter'){e.preventDefault();const f=new FormData(e.target);corpIndustryFilters={q:String(f.get('q')||''),status:String(f.get('status')||'')};render();}
  if(e.target.id==='moon-survey-search'){
    e.preventDefault();const values=new FormData(e.target);surveyFilters={...surveyFilters,q:String(values.get('q')||''),tiers:values.getAll('tiers').join(','),refine:Number(values.get('refine')),system:'',moon:''};render();
  }
  if (e.target.id === "asset-search") {
    e.preventDefault();
    const values=new FormData(e.target);
    assetSearchAll=values.has("all");
    assetFilters={q:String(values.get("q")||""),location:String(values.get("location")||""),character:assetSearchAll?"":String(selected||"")};
    assetOffset = 0;
    render();
  }
});
async function documentClick(e) {
  const b = e.target.closest("button");
  if (!b) return;
  try {
    if(b.hasAttribute('data-fitting-alts')){
      const list=b.closest('.fitting-pilots'),show=list.classList.contains('mains-only');
      list.classList.toggle('mains-only',!show);b.setAttribute('aria-pressed',String(show));b.textContent=show?'Hide alts':'Show alts';
    } else if(b.dataset.piAdd || b.dataset.piRemove || b.dataset.piMove!==undefined){
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
      document.querySelector("#document-form [name=tag]").value=d.tag||"Personal";
      if (b.dataset.editDoc) {
        document.querySelector("#document-form").dataset.id = d.id;
        document.querySelector("[name=shared]").checked = !!d.shared;
      }
      if (d.kind === "plan") {
        planEntries = d.body;
        showEntries();
      }
      documentDraftBaseline=documentDraftSignature();
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
 if(e.target.id==='pi-share-recipient'){updatePIShareSelection();return;}
 if(e.target.id==='pi-share-all'){dialog.querySelectorAll('[name=pilot]').forEach(el=>el.checked=e.target.checked);updatePIShareAll();return;}
 if(e.target.name==='pilot'){updatePIShareAll();return;}

 if(e.target.id!=="add-character-group")return;
 const label=dialog.querySelector('#add-character-parent'),alt=e.target.value==='alt';
 label.hidden=!alt;label.querySelector('select').disabled=!alt;
});
dialog.addEventListener('click',async e=>{
 if(e.target.id!=='pi-unshare')return;
 const form=dialog.querySelector('#pi-share-form');if(!form.reportValidity())return;
 form.querySelectorAll('[name=pilot]').forEach(el=>el.checked=false);updatePIShareAll();form.requestSubmit();
});
async function documentSubmit(e) {
  if(e.target.id==='pi-share-form'){
    e.preventDefault();const form=e.target,values=new FormData(form),buttons=form.querySelectorAll('button');buttons.forEach(b=>b.disabled=true);
    try{await api('/pi/shares',{recipient_id:Number(values.get('recipient')),character_ids:values.getAll('pilot').map(Number)});dialog.close();await render();toast('PI sharing updated');}catch(error){dialog.querySelector('#pi-share-error').textContent=error.message;}finally{buttons.forEach(b=>b.disabled=false);}return;
  }

  if(e.target.id==="pi-settings"){
    e.preventDefault();const values=new FormData(e.target),button=e.target.querySelector('[type=submit]');button.disabled=true;
    try{await api('/pi/settings',{perfect:Number(values.get('perfect')),critical:Number(values.get('critical')),targets:piDraftTargets,show_goals:values.has('show_goals')},'POST');dialog.close();await render();}catch(error){document.querySelector('#pi-settings-error').textContent=error.message;}finally{button.disabled=false;}
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
    try {await api("/documents/"+e.target.dataset.document+"/plan",{plan:new FormData(e.target).get("plan")});await render();await showDocument(e.target.dataset.document);}catch(err){toast(err.message);}
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
          tag: data.tag,
          body: form.dataset.kind === "plan" ? planEntries : data.eft,
          shared: data.shared === "on",
        },
        form.dataset.id ? "PUT" : "POST",
      );
      documentDraftBaseline="";
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


setInterval(()=>document.querySelectorAll("[data-den-expiry]").forEach(el=>{
 el.textContent=Date.parse(el.dataset.denExpiry)<=Date.now()?"Expired · sync to refresh":eta(el.dataset.denExpiry);
}),10000);

setInterval(()=>document.querySelectorAll('[data-extractor-expiry]').forEach(el=>{
 if(el.dataset.extractorExpiry&&Date.parse(el.dataset.extractorExpiry)<=Date.now()){
  el.classList.remove('perfect','attention','critical','unknown');el.classList.add('stopped');const state=el.querySelector('.pi-extractor-state');state.hidden=false;state.textContent='Reset needed · last programme';
 }
}),10000);

root.addEventListener("change",e=>{if(e.target.matches('#asset-search input[name="all"]'))e.target.form.requestSubmit();});

let myCharacterSnapshot=null,myCharacterView=myCharacterPreferences(),myCharacterScope='',myPilotFocus=null;
function saveMyCharacterView(){try{localStorage.setItem(myCharacterScope,JSON.stringify(myCharacterView));}catch{}}
function loadMyCharacterView(){
 const scope='tools-my-characters:'+me.main_id+':'+(me.inspect?.name||'self');
 if(scope===myCharacterScope)return;
 myCharacterScope=scope;try{myCharacterView=myCharacterPreferences(JSON.parse(localStorage.getItem(scope)||'{}'));}catch{myCharacterView=myCharacterPreferences();}
 if(chars.some(c=>c.id===myCharacterView.selected)){selected=myCharacterView.selected;pageAlts.characters=myCharacterView.alts||chars.find(c=>c.id===selected)?.parent_id!==selected;}
}
async function myCharacters(){
 loadMyCharacterView();if(renderedPage!=='characters'&&chars.some(c=>c.id===myCharacterView.selected))selected=myCharacterView.selected;const visible=visibleCharacters(chars);selectVisibleCharacter(visible);
 if(!selected)return intro('My Characters','Your pilot at a glance.')+empty('Add a character to get started');
 const id=Number(selected),c=chars.find(c=>c.id===id),requests=await Promise.allSettled([api('/characters/'+id+'/skills'),api('/characters/'+id+'/dashboard')]);
 if(page!=='characters'||Number(selected)!==id)return '';
 const skill=requests[0].status==='fulfilled'?requests[0].value:null,dashboard=requests[1].status==='fulfilled'?requests[1].value:null;
 myCharacterSnapshot={id,data:skill?.data};myCharacterView.selected=id;myCharacterView.alts=pageAlts.characters;saveMyCharacterView();
 return intro('My Characters','Training, skills and activity for your selected pilot.')+`<div class="my-character-picker">${characterTiles(visible,p=>p.parent_id===p.id?'Main character':'Alt')}${altFilter()}</div>`+myCharacterDetail({c,chars,skill,dashboard,view:myCharacterView,failures:requests.flatMap((r,i)=>r.status==='rejected'?[(i?'Activity and clone details':'Training data')+' could not load.']:[])},{esc,num,date,cloneTimer,implantList,fatigueView});
}
setInterval(()=>{const target=document.querySelector('#my-character-training');if(page==='characters'&&target&&myCharacterSnapshot?.id===Number(selected)){target.innerHTML=characterTraining(myCharacterSnapshot.data,Date.now(),myCharacterView.sections.includes('queue'));const duration=document.querySelector('[data-my-queue-duration]');if(duration&&myCharacterSnapshot.data)duration.textContent=queuedDuration(myCharacterSnapshot.data.queue);const currentLabel=document.querySelector('[data-my-current-training]');if(currentLabel){const current=splitQueue(myCharacterSnapshot?.data?.queue||[]).current;currentLabel.textContent=current?current.name+' · '+current.finished_level:myCharacterSnapshot?.data?'No active training':'Unavailable';}applyVisualStyles();}},10000);
root.addEventListener('change',event=>{if(event.target.id!=='my-chart-mode')return;myCharacterView.chart=event.target.value==='percent'?'percent':'sp';saveMyCharacterView();document.querySelector('#my-character-charts').innerHTML=characterCharts(myCharacterSnapshot?.data,myCharacterView.chart);applyVisualStyles();});
document.addEventListener('toggle',event=>{if(!event.target.isConnected||page!=='characters'||!event.target.matches?.('[data-my-section]'))return;const key=event.target.dataset.mySection;myCharacterView.sections=myCharacterView.sections.filter(s=>s!==key);if(event.target.open)myCharacterView.sections.push(key);saveMyCharacterView();},true);

function applyVisualStyles(){
 if(page==='clones')stripeClonePanels();
 if(me?.inspect){
  root.querySelectorAll('[data-sync-char],[data-move],[data-unlink],[data-group-char],[data-subscription-char],[data-action="sync"],[data-action="add-character"]').forEach(el=>{el.disabled=true;el.title='Inspect is read-only. Exit Inspect to make changes.';});
  root.querySelectorAll('a[href^="/auth/login"]').forEach(el=>{el.removeAttribute('href');el.setAttribute('aria-disabled','true');el.title='Exit Inspect before connecting characters.';});
 }

 document.querySelectorAll('[data-eve-color]').forEach(el=>{if(/^#[a-f0-9]{8}$/i.test(el.dataset.eveColor))el.style.color=el.dataset.eveColor;});
 document.querySelectorAll('[data-wallet-height]').forEach(el=>el.style.height=Math.max(0,Math.min(100,Number(el.dataset.walletHeight)||0))+'%');
 document.querySelectorAll('[data-viz-width]').forEach(el=>el.style.width=Math.max(0,Math.min(100,Number(el.dataset.vizWidth)||0))+'%');
 document.querySelectorAll('[data-viz-gradient]').forEach(el=>el.style.background='conic-gradient('+el.dataset.vizGradient+')');
 document.querySelectorAll('[data-asset-indent]').forEach(el=>el.style.paddingLeft=Math.max(0,Math.min(192,Number(el.dataset.assetIndent)||0))+'px');
}

setInterval(()=>document.querySelectorAll('[data-moon-fracture]').forEach(el=>el.textContent=fractureCountdown(el.dataset.moonFracture)),10000);

setInterval(()=>document.querySelectorAll('[data-corp-job-end]').forEach(el=>el.textContent=jobTime(el.dataset.corpJobEnd)),10000);

let compareBase=null,compareIds=[],compareMatches=false,comparePilots=[],compareShowAlts=false;
async function skillComparison(){
 const base=chars.find(c=>c.id===compareBase)||chars.find(c=>c.id===Number(selected))||chars[0];if(base)compareBase=base.id;if(!base)return intro('Compare skills','Select a character first.',`<button data-nav="characters">← My Characters</button>`);
 compareIds=compareIds.filter(id=>id!==base.id&&chars.some(c=>c.id===id&&(compareShowAlts||c.parent_id===c.id)));
 const chosen=[base,...compareIds.map(id=>chars.find(c=>c.id===id))];
 const results=await Promise.allSettled(chosen.map(c=>api('/characters/'+c.id+'/skills')));
 comparePilots=chosen.map((c,i)=>({...c,...(results[i].status==='fulfilled'?results[i].value:{data:null,error:'Could not load skill snapshot'})}));
 return '<div class="compare-page">'+intro('Compare skills','Compare trained skill levels against '+base.name+'.',`<button data-nav="characters">← My Characters</button>`)+`<section class="panel compact"><div class="panelhead"><label class="compare-toggle">Compare against <select id="compare-base" aria-label="Character to compare against">${chars.filter(c=>compareShowAlts||c.parent_id===c.id||c.id===base.id).map(c=>`<option value="${c.id}" ${c.id===base.id?'selected':''}>${esc(c.name)}${c.parent_id!==c.id?' · Alt':''}</option>`).join('')}</select></label><label class="compare-toggle"><input id="compare-show-alts" type="checkbox" ${compareShowAlts?'checked':''}> Show alts</label></div><form id="skill-compare-form"><div class="compare-picker">${chars.filter(c=>c.id!==base.id&&(compareShowAlts||c.parent_id===c.id)).map(c=>`<label data-compare-alt="${c.parent_id!==c.id}" ${c.parent_id!==c.id&&!compareShowAlts?'hidden':''}><input type="checkbox" name="pilot" value="${c.id}" ${compareIds.includes(c.id)?'checked':''}><img src="https://images.evetech.net/characters/${c.id}/portrait?size=32" alt="">${esc(c.name)}${c.parent_id!==c.id?' <small>Alt</small>':''}</label>`).join('')}</div><button class="primary">Compare selected</button></form></section>${compareIds.length?`<section class="panel compact"><div class="panelhead"><h2>Skill differences</h2><label class="compare-toggle"><input id="compare-matches" type="checkbox" ${compareMatches?'checked':''}> Show matching skills</label></div><div class="compare-snapshots">${comparePilots.map(p=>`<small>${esc(p.name)} · ${p.data?'Snapshot '+date(p.updated):'Skills unavailable'}${p.error?' · '+esc(p.error):''}</small>`).join('')}</div><div id="compare-results">${comparisonTable(comparePilots,compareMatches)}</div></section>`:empty('Select one or more owned characters, including alts, to compare.')}</div>`;
}
root.addEventListener('change',e=>{if(e.target.id==='compare-matches'){compareMatches=e.target.checked;document.getElementById('compare-results').innerHTML=comparisonTable(comparePilots,compareMatches);}});

root.addEventListener('change',async e=>{if(['compare-show-alts','compare-base'].includes(e.target.id)){compareIds=new FormData(document.getElementById('skill-compare-form')).getAll('pilot').map(Number);if(e.target.id==='compare-base')compareBase=Number(e.target.value);else compareShowAlts=e.target.checked;await render();}});

root.addEventListener('change',async e=>{if(e.target.id==='document-tag-filter'){documentFilters[e.target.dataset.kind]=e.target.value;await render();}});

let walletLP=false,walletPilot='',walletOffset=0,walletFilters=walletPreferences(),walletScope='',walletLedgerPilots=[];
function saveWalletView(){try{localStorage.setItem(walletScope,JSON.stringify({...walletFilters,pilot:walletPilot,lp:walletLP,alts:pageAlts.wallet}));}catch{}}
function loadWalletView(){const scope='tools-wallet:'+me.main_id+':'+(me.inspect?.name||'self');if(scope===walletScope)return;walletScope=scope;try{walletFilters=walletPreferences(JSON.parse(localStorage.getItem(scope)||'{}'));validateWalletFilters(walletFilters);}catch{walletFilters=walletPreferences();}walletLP=walletFilters.lp;walletPilot=walletFilters.pilot;pageAlts.wallet=walletFilters.alts;}
async function walletPage(){
 loadWalletView();if(walletPilot&&!chars.some(c=>String(c.id)===walletPilot))walletPilot='';
 const lp=walletLP,pilotId=walletPilot;
 const rows=lp?await api('/operations/loyalty'):pilotId?[{id:Number(pilotId),name:chars.find(c=>String(c.id)===pilotId)?.name,...await api('/characters/'+pilotId+'/wallet-history')}]:await api('/operations/wallet-history');
 if(page!=='wallet'||lp!==walletLP||pilotId!==walletPilot)return '';
 const visible=visibleCharacters(chars);if(pilotId&&!visible.some(c=>String(c.id)===pilotId))visible.push(chars.find(c=>String(c.id)===pilotId));
 const pilots=pilotId?rows.filter(c=>String(c.id)===pilotId):rows,balanceChars=pilotId?chars.filter(c=>String(c.id)===pilotId):chars;
 walletLedgerPilots=pilots;saveWalletView();
 return intro('Wallet',lp?'Loyalty point balances by pilot and corporation.':'Balances and recorded ISK movements for your linked characters.',`<label class="unassigned-toggle"><input id="wallet-lp-toggle" type="checkbox" role="switch" ${lp?'checked':''}> LP Wallet</label><button data-action="sync">↻ Sync wallets</button>`)+`<section class="panel compact wallet-summary"><strong class="wallet-selection-label">${pilotId?esc(chars.find(c=>String(c.id)===pilotId)?.name):'All linked characters'}</strong><label>Pilot<select id="wallet-pilot"><option value="">All characters · including alts</option>${visible.map(c=>`<option value="${c.id}" ${String(c.id)===pilotId?'selected':''}>${esc(c.name)}</option>`).join('')}</select></label>${altFilter()}</section>`+(lp?loyaltyView(pilots):personalWalletView(pilots,chars,walletFilters,walletOffset,balanceChars));
}
root.addEventListener('change',async event=>{
 if(event.target.id==='wallet-lp-toggle'){walletLP=event.target.checked;walletOffset=0;saveWalletView();await render();return;}
 if(event.target.id==='wallet-pilot'){walletPilot=event.target.value;walletOffset=0;saveWalletView();await render();return;}
 if(event.target.form?.id==='wallet-filter'&&event.target.name==='days'){const custom=event.target.value==='custom';event.target.form.querySelectorAll('[data-wallet-custom]').forEach(label=>{label.hidden=!custom;label.querySelector('input').disabled=!custom;label.querySelector('input').required=custom;});}
});
root.addEventListener('click',async event=>{
 const action=event.target.closest('[data-wallet-action]')?.dataset.walletAction;if(!action||page!=='wallet')return;
 if(action==='clear'){walletFilters=walletPreferences({mode:walletFilters.mode});walletOffset=0;saveWalletView();await render();}
 if(action==='export'){if(document.querySelector('#content')?.getAttribute('aria-busy')==='true')return;const rows=walletAnalysis(walletLedgerPilots,chars,walletFilters).rows,url=URL.createObjectURL(new Blob([walletCSV(rows,walletFilters)],{type:'text/csv;charset=utf-8'})),link=document.createElement('a');link.href=url;link.download='tools-wallet-'+(walletPilot||'all')+'-'+walletFilters.mode+'.csv';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
});

let contractsPilot='',contractsOffset=0,contractsFilters=contractPreferences(),contractsScope='',contractsPilots=[];
function saveContractsView(){try{localStorage.setItem(contractsScope,JSON.stringify({...contractsFilters,pilot:contractsPilot}));}catch{}}
function loadContractsView(){const scope='tools-contracts:'+me.main_id+':'+(me.inspect?.name||'self');if(scope===contractsScope)return;contractsScope=scope;try{contractsFilters=contractPreferences(JSON.parse(localStorage.getItem(scope)||'{}'));}catch{contractsFilters=contractPreferences();}contractsPilot=contractsFilters.pilot;}
root.addEventListener('click',async e=>{const action=e.target.closest('[data-contract-action]')?.dataset.contractAction;if(!action)return;if(action==='clear'){contractsFilters=contractPreferences();contractsOffset=0;saveContractsView();await render();}if(action==='export'){const url=URL.createObjectURL(new Blob([contractsCSV(contractRows(contractsPilots,contractsFilters))],{type:'text/csv;charset=utf-8'})),link=document.createElement('a');link.href=url;link.download='tools-contracts.csv';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}});

async function contractsPage(){
 loadContractsView();
 const rows=await api('/operations/contracts'),visible=chars;
 if(contractsPilot&&!visible.some(c=>String(c.id)===contractsPilot))contractsPilot='';
 const pilots=contractsPilot?rows.filter(c=>String(c.id)===contractsPilot):rows;contractsPilots=pilots;saveContractsView();
 return intro('Contracts','Your pilots’ exchanges, courier jobs and auctions.',`<div class="actions"><a class="button" href="/auth/login?link=1">Reconnect pilot</a><button data-action="sync">↻ Sync contracts</button></div>`)+`<section class="panel compact"><div class="toolbar"><label>Pilot<select id="contracts-pilot"><option value="">All characters · including alts</option>${visible.map(c=>`<option value="${c.id}" ${String(c.id)===contractsPilot?'selected':''}>${esc(c.name)}</option>`).join('')}</select></label></div><details><summary>Access & sync status</summary>${pilots.map(c=>`<div><strong>${esc(c.name)}</strong> · ${c.updated?date(c.updated):'Awaiting sync · reconnect to grant Contracts access'}${!c.updated||Date.now()-c.updated>7200000?' · Saved data is over two hours old or unavailable':''}${c.error?' · '+esc(c.error):''}</div>`).join('')}</details></section>`+contractsView(pilots,contractsFilters,contractsOffset,true);
}
root.addEventListener('change',async e=>{if(e.target.id==='contracts-pilot'){contractsPilot=e.target.value;contractsOffset=0;saveContractsView();await render();}});

// Initialise only after all page state and listeners are ready (including direct links).
try {
  me = await api("/me");
  if(me.recruit)page="overview";
  const requested=location.hash.slice(1);if(isKnownPage(requested))page=requested;
  await render();
  // Reconcile access on every background check, including a return to this tab.
  const checkWorkspaceUpdates=async()=>{
    if(checkingSnapshots || document.hidden)return;
    checkingSnapshots=true;
    try{
      const current=await api('/me'),promoted=me.recruit&&!current.recruit&&!current.inspect,changed=accessChanged(me,current);
      me=current;
      if(changed){
        if(promoted){if(page==='recruit-application')page='overview';sidebarPreferences().management=true;}
        renderedPage=null;await render();
        if(promoted)toast('Membership confirmed · Groups and normal member pages are now available.');
        return;
      }
      siteNotifications=await api('/notifications');refreshNotificationMenu();
      const latest=await api('/characters');if(snapshotKey(latest)!==snapshotSignature)document.querySelector('[data-action=update-view]')?.removeAttribute('hidden');
    }catch{}finally{checkingSnapshots=false;}
  };
  setInterval(checkWorkspaceUpdates,30000);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)void checkWorkspaceUpdates();});
  window.addEventListener('focus',()=>void checkWorkspaceUpdates());

} catch(error) {
  if(error.status===401)login();
  else root.innerHTML=`<main class="startup-error"><section class="panel"><h1>Unable to load Tools</h1><p role="alert">${esc(error.message)}</p><button type="button" data-action="reload-app">Try again</button></section></main>`;
}

setInterval(()=>document.querySelectorAll('[data-eve-clock]').forEach(clock=>{clock.textContent=eveClock();}),1000);

root.addEventListener('submit',async event=>{if(event.target.id!=='users-filters')return;event.preventDefault();usersFilters={...usersFilters,...Object.fromEntries(new FormData(event.target))};await render();});

root.addEventListener('click',event=>{const action=event.target.closest('[data-action]')?.dataset.action;if(action==='retry-page')void render();if(action==='reload-app')location.reload();});


root.addEventListener('input',event=>{if(event.target.id!=='overview-search')return;overviewPrefs.q=event.target.value;saveOverviewView();updateOverviewList();});
root.addEventListener('change',event=>{const id=event.target.id;if(!['overview-filter','overview-sort','overview-group-totals'].includes(id))return;if(id==='overview-group-totals')overviewPrefs.totals=event.target.checked;else overviewPrefs[id==='overview-filter'?'filter':'sort']=event.target.value;saveOverviewView();updateOverviewList();});

function downloadSkillPlan(text,name='skill-plan.txt'){const url=URL.createObjectURL(new Blob([text],{type:'text/plain;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
document.addEventListener('click',async e=>{
 const b=e.target.closest('[data-dl-workbench],[data-dl-check],[data-dl-open],[data-dl-create-plan],[data-dl-export-plan],[data-dl-export-pilot],[data-dl-copy-pilot],[data-dl-missing-toggle],[data-dl-alts]');if(!b)return;e.preventDefault();b.disabled=true;const status=b.closest('.dl-pilot')?.querySelector('[role=status]');
 try{
  if(b.hasAttribute('data-dl-workbench')){if(page==='fitting-workbench'&&!fittingWorkbench.canLeave())return;dialog.close();fittingWorkbench.selectDocument(b.dataset.dlWorkbench);page='fitting-workbench';history.replaceState(null,'','#'+page);await render();}
  else if(b.hasAttribute('data-dl-check')||b.hasAttribute('data-dl-open')){await showDocument(b.dataset.dlCheck||b.dataset.dlOpen);const selectedPilot=documentLibrary.pilot();if(selectedPilot){const form=document.querySelector('#compare');if(form)form.elements.character.value=selectedPilot;const card=[...document.querySelectorAll('[data-dl-pilot]')].find(el=>el.dataset.dlPilot===selectedPilot);if(card){if(card.dataset.dlAlt==='true'){const list=card.closest('.document-pilots');list.classList.add('show-alts');const toggle=list.querySelector('[data-dl-alts]');toggle.textContent='Hide alts';toggle.setAttribute('aria-pressed','true');}card.open=true;card.scrollIntoView({block:'nearest'});}}}
  else if(b.hasAttribute('data-dl-create-plan')){const result=await api('/documents/'+encodeURIComponent(b.dataset.dlCreatePlan)+'/create-plan',{});toast('Private skill plan created and linked for your account.');await render();await showDocument(result.id);}
  else if(b.hasAttribute('data-dl-export-plan')){const doc=await api('/documents/'+encodeURIComponent(b.dataset.dlExportPlan));downloadSkillPlan(doc.body.map(r=>r.name+' '+r.level).join('\n'));}
  else if(b.hasAttribute('data-dl-alts')){const list=b.closest('.document-pilots'),show=list.classList.toggle('show-alts');b.textContent=show?'Hide alts':'Show alts';b.setAttribute('aria-pressed',String(show));}
  else if(b.hasAttribute('data-dl-missing-toggle')){const list=b.closest('.dl-pilot');const show=b.textContent==='Show all required skills';list.querySelectorAll('[data-dl-complete="true"]').forEach(row=>row.hidden=!show);b.textContent=show?'Show missing skills only':'Show all required skills';}
  else {const id=b.dataset.dlExportPilot||b.dataset.dlCopyPilot,doc=b.closest('[data-dl-evidence]')?.dataset.dlEvidence,row=documentEvidence.get(doc+':'+id);if(!row||row.ready===null)throw Error('Sync this pilot’s skills before exporting or copying.');const full=b.hasAttribute('data-dl-export-pilot'),text=row.rows.filter(r=>full||r.current<r.required).map(r=>r.name+' '+r.required).join('\n');if(full)downloadSkillPlan(text);else if(text){try{await navigator.clipboard.writeText(text);status.textContent='Missing skills copied.';}catch{status.innerHTML='<textarea readonly aria-label="Missing skills to copy"></textarea>';status.querySelector('textarea').value=text;status.querySelector('textarea').select();}}else status.textContent='No untrained levels to copy. Trained but inactive skills need activation, not more training.';}
 }catch(error){if(status)status.textContent=error.message;else {b.insertAdjacentHTML('afterend',`<span role="alert" class="notice error">${esc(error.message)}</span>`);}}finally{b.disabled=false;}
});
dialog.addEventListener('cancel',e=>{if(!canCloseDocument())e.preventDefault();else documentDraftBaseline='';});
dialog.addEventListener('click',e=>{if(e.target.closest('[data-action=close]')){if(!canCloseDocument()){e.preventDefault();e.stopImmediatePropagation();}else documentDraftBaseline='';}},true);
window.addEventListener('beforeunload',e=>{if(documentDraftBaseline&&documentDraftSignature()!==documentDraftBaseline){e.preventDefault();e.returnValue='';}});
