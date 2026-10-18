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
  page = "overview",
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
  `<div class="pilot"><img class="portrait" alt="" src="https://images.evetech.net/characters/${Number(c.id)}/portrait?size=64"><div><strong>${esc(c.name)}</strong><small>${c.main ? "Main character" : "Linked alt"}</small></div></div>`;
const empty = (title, text = "") =>
  `<div class="empty"><strong>${esc(title)}</strong>${esc(text)}</div>`;
const table = (heads, rows) =>
  `<div class="tablewrap"><table><thead><tr>${heads.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${rows.join("")}</tbody></table></div>`;
const charOptions = () =>
  chars
    .map(
      (c) =>
        `<option value="${c.id}" ${Number(selected) === c.id ? "selected" : ""}>${esc(c.name)}</option>`,
    )
    .join("");
const nav = [
  ["overview", "◈", "Overview"],
  ["skills", "▤", "Skills & queue"],
  ["plans", "◇", "Skill plans"],
  ["fittings", "△", "Fittings"],
  ["dens", "⬡", "Mercenary dens"],
  ["pi", "◎", "Planetary industry"],
  ["assets", "▦", "Asset search"],
  ["industry", "⚒", "Industry"],
];
function shell() {
  root.innerHTML = `<div class="shell"><aside><div class="brand"><img src="https://images.evetech.net/corporations/668298004/logo?size=128" alt="STEMP">STEMP Tools</div><div><div class="navlabel">Your command centre</div><nav>${nav.map(([id, icon, name]) => `<button data-nav="${id}" class="${page === id ? "active" : ""}"><span>${icon}</span>${name}</button>`).join("")}${me.admin ? '<button data-nav="admin"><span>⚙</span>Invitations</button>' : ""}</nav></div><div class="account">SIGNED IN AS<strong>${esc(me.name)}</strong><button data-action="logout">Sign out</button><p>STEMP Tools · v0.5.1</p></div></aside><main><header class="topbar"><span class="eyebrow">● PRIVATE CHARACTER WORKSPACE</span><div class="actions">${(page === "overview" || page === "pi") ? '<button data-action="sync">↻ Refresh all characters</button>' : ""}<a class="button primary" href="/auth/login?link=1">+ Add character</a></div></header><div id="content"></div><footer class="footer">EVE Online data provided by CCP Games. Not affiliated with CCP. Cached snapshots · all times UTC.</footer></main></div>`;
}
function intro(title, description, actions = "") {
  return `<div class="intro"><div><h1>${title}</h1><p>${description}</p></div>${actions}</div>`;
}
function login() {
  const invite = new URLSearchParams(location.search).get("invite");
  root.innerHTML = `<div class="login"><section class="login-art"><div class="brand"><img src="https://images.evetech.net/corporations/668298004/logo?size=128" alt="STEMP">STEMP Tools</div><div class="eyebrow">YOUR CHARACTERS. ONE WORKSPACE.</div><h1>A clearer view<br>of your <em>New Eden.</em></h1><p>Train with a purpose. Keep your colonies moving. Bring every character into one private command centre.</p><div class="orbital" aria-hidden="true"></div></section><section class="loginbox"><div>${tag("INVITE-ONLY", "purple")}<h2>Your next move starts here.</h2><p class="muted">Sign in with your main character, then securely connect your alts.</p><a class="button primary" href="/auth/login${invite ? "?invite=" + encodeURIComponent(invite) : ""}">Sign in with EVE Online →</a><small>${invite ? "Your invitation will be redeemed after EVE login." : "Already a member? Sign in above. New pilots need an invitation."}</small><div class="features"><span>◇ Shared skill plans</span><span>△ Fitting skill checks</span><span>◎ All-character PI</span><span>⬡ Mercenary dens</span><span>▦ Asset search</span><span>▤ Skills & queue</span></div><p class="notice">Your character information is private. Only the plans and fittings you choose to share are visible to other members.</p></div></section></div>`;
}
async function render() {
  const run = ++renderId;
  shell();
  const content = document.querySelector("#content");
  content.innerHTML = empty("Loading your workspace…");
  try {
    chars = await api("/characters");
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
    if (page === "admin") html = await admin();
    if (run === renderId) content.innerHTML = html;
  } catch (e) {
    if (run === renderId)
      content.innerHTML = `<div class="notice error">${esc(e.message)}</div>`;
  }
}
function overview() {
  const synced = chars.filter((c) => c.snapshots.length === 5).length,
    working = chars.filter((c) => c.job).length,
    issues = chars.filter((c) => c.reconnect || c.errors.length).length;
  return (
    intro(
      "Your capsuleer command",
      "One place for every character, training plan and operation.",
    ) +
    `<div class="cards"><div class="card"><div class="label">Linked characters</div><div class="stat">${chars.length}</div><small>One main. Your alts together.</small></div><div class="card"><div class="label">Complete snapshots</div><div class="stat">${synced}<span class="muted"> / ${chars.length}</span></div><small>${working ? working + " character refreshes queued" : "Background refresh every hour"}</small></div><div class="card"><div class="label">Needs attention</div><div class="stat">${issues}</div><small>Connection or data refresh issues</small></div></div><section class="panel"><div class="panelhead"><h2>Your characters</h2>${tag("PRIVATE", "purple")}</div>${
      chars.length
        ? table(
            ["Character", "Data status", "Last refreshed", ""],
            chars.map(
              (c, index) =>
                `<tr><td>${portrait(c)}</td><td>${c.reconnect ? tag("Reconnect required", "warn") : c.job ? tag(c.job, "purple") : c.errors.length ? tag("Refresh issue", "warn") : tag(c.snapshots.length ? "Connected" : "Awaiting first sync", "dim")}${c.errors.map((e) => `<small>${esc(e.kind)}: ${esc(e.message)}</small>`).join("")}</td><td>${date(c.snapshots.length ? Math.min(...c.snapshots.map((s) => s.updated)) : null)}</td><td><div class="actions"><button data-sync-char="${c.id}">↻ Sync</button>${c.main ? "" : `<button data-move="${c.id}" data-direction="-1" aria-label="Move ${esc(c.name)} up" ${index <= 1 ? "disabled" : ""}>↑</button><button data-move="${c.id}" data-direction="1" aria-label="Move ${esc(c.name)} down" ${index === chars.length - 1 ? "disabled" : ""}>↓</button>`}<a class="button" href="/auth/login?link=1">Reconnect</a>${c.main ? "" : `<button class="danger" data-unlink="${c.id}">Unlink</button>`}</div></td></tr>`,
            ),
          )
        : empty("Add your first character")
    }</section><div class="split"><section class="panel"><h2>Build your next pilot</h2><p class="muted">Create a skill plan, share it with your group, and compare it against any of your characters.</p><button data-nav="plans">Open skill plans →</button></section><section class="panel"><h2>Keep the operation moving</h2><p class="muted">Check available MTOs, extractor programmes and stored materials across all your alts.</p><button data-nav="pi">Open planetary industry →</button></section></div>`
  );
}
async function skills() {
  const s = selected
    ? await api("/characters/" + selected + "/skills")
    : { data: null };
  const data = s.data;
  const heading = intro(
    "Skills & training queue",
    "Current skills and EVE’s reported training schedule.",
    `<div class="actions"><select id="character-select" aria-label="Character">${charOptions()}</select>${selected ? `<button data-sync-char="${selected}">↻ Sync character</button>` : ""}</div>`,
  );
  if (!data) return heading + empty("Skills have not synced yet");
  const { current, waiting } = splitQueue(data.queue);
  return (
    heading +
    `<section class="panel compact"><div class="panelhead"><h2>Currently training</h2><small>${num(data.skills.total_sp)} SP · Snapshot ${date(s.updated)}</small></div>${current ? `<div class="production"><strong>${esc(current.name)} · Level ${current.finished_level}</strong><span>${eta(current.finish_date)} remaining · ${date(current.finish_date)}</span></div>` : "<small>No active training reported</small>"}<h3>Training queue · ${waiting.length}</h3>${
      waiting.length
        ? table(
            ["Skill", "Level", "Finishes", "Remaining"],
            waiting.map(
              (q) =>
                `<tr><td><span class="icon-label">${eveIcon(q.skill_id)}${esc(q.name)}</span></td><td>${q.finished_level}</td><td>${date(q.finish_date)}</td><td>${q.finish_date ? eta(q.finish_date) : "Not scheduled"}</td></tr>`,
            ),
          )
        : "<small>No further skills queued</small>"
    }</section><section class="panel compact"><div class="panelhead"><h2>Trained skills</h2><input id="skill-filter" placeholder="Filter skills…" aria-label="Filter skills"></div>${skillGroups(
      data.skills.skills,
    )
      .map(
        (g) =>
          `<details class="skill-group"><summary>${esc(g.name)} <span class="muted">· ${g.skills.length} skills · ${num(g.skills.reduce((n, s) => n + s.skillpoints_in_skill, 0))} SP</span></summary>${table(
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
      : "") +
    `<section class="panel">${
      rows.length
        ? table(
            ["Name", "Created by", "Visibility", ""],
            rows.map(
              (d) =>
                `<tr><td><button class="fitting-name" data-document="${esc(d.id)}">${esc(d.name)}</button><small>${date(d.updated)}</small></td><td>${esc(d.author)} ${d.mine ? tag("YOURS", "dim") : ""}</td><td>${tag(d.shared ? "Members" : "Private", d.shared ? "purple" : "dim")}</td><td><button data-document="${esc(d.id)}">Open & compare →</button></td></tr>`,
            ),
          )
        : empty(
            "No " + (kind === "plan" ? "skill plans" : "fittings") + " yet",
            "Create your first one or ask another member to share theirs.",
          )
    }</section>`
  );
}
async function operations() {
  const kind = page === "pi" ? "pi" : "dens",
    rows = await api("/operations/" + kind);
  return (
    intro(
      kind === "pi" ? "Planetary industry" : "Mercenary dens",
      kind === "pi"
        ? "Your colonies, production programmes and launchpad inventory."
        : "Every linked character’s dens and available tactical operations.",
    ) +
    `<div class="notice">${kind === "pi" ? "Rates are estimates from extractor programmes or factory capacity, not guaranteed actual output. Launchpads show the last EVE snapshot; idle factories and routing shortages can reduce production." : "EVE provides available MTOs and expiry times, but no next-spawn countdown. Anarchy is shown as EVE’s reported level and score."}</div>` +
    rows
      .map(
        (c) =>
          `<section class="panel"><div class="panelhead">${portrait(c)}<div class="actions"><small>${date(c.updated)}</small><button data-sync-char="${c.id}">↻ Sync character</button></div></div>${c.error ? `<div class="notice error">${esc(c.error)}</div>` : ""}${!c.data ? empty("Awaiting first sync") : kind === "pi" ? planets(c.data) : dens(c.data)}</section>`,
      )
      .join("")
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
  return `<small>${rows.length} of up to 6 planets occupied</small><div class="planetgrid">${rows.map((p) => `<article class="planet"><div class="planet-heading"><img src="https://images.evetech.net/types/${p.info?.type_id || types[p.planet_type] || 11}/icon?size=64" alt="${esc(p.planet_type)} planet"><div><strong>${esc(p.systemName)}</strong><small>${esc(p.info?.name || p.planet_id)} · ${esc(p.planet_type)}</small></div></div><div>${tag(p.status, p.status.includes("stopped") ? "warn" : "dim")}</div><small>${p.resetAt ? `Extractor reset: <span data-reset="${esc(p.resetAt)}">${Date.parse(p.resetAt) <= Date.now() ? "Reset needed" : eta(p.resetAt)}</span>` : "No extractor reset timer"}</small>${p.finalProducts.length ? p.finalProducts.map((r) => `<div class="planet-product"><div class="planet-product-line"><strong class="icon-label">${eveIcon(r.type_id)}${esc(r.name)}</strong><span title="Estimated hourly capacity">- ${num(r.perHour)}/h</span></div><small>${num(r.stored)} in launchpads</small></div>`).join("") : "<small>No final product configured</small>"}<details><summary>All production & storage</summary>${p.production.map((r) => `<div class="production"><span>${esc(r.name)}<small>${esc(r.kind)} · ${esc(r.status)}</small></span><strong>${num(r.perHour)}/h</strong></div>`).join("")}<h3>Launchpads</h3>${p.launchpads.map((l) => `<small>Pad ${l.id}</small>${l.contents.length ? l.contents.map((i) => `<div class="production"><span>${esc(i.name)}</span><strong>${num(i.amount)}</strong></div>`).join("") : "<small>Empty</small>"}`).join("")}</details></article>`).join("")}</div>`;
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
function dens(rows) {
  if (!rows.length) return empty("No Mercenary Dens reported");
  return table(
    [
      "Den / planet",
      "State",
      "Stored infomorphs",
      "Anarchy",
      "Development",
      "MTO",
    ],
    rows.map(
      (d) =>
        `<tr><td><strong>${esc(d.planet?.name || d.skyhook.planet_id)}</strong><small>Den ${d.id}</small>${d.reinforcement_timer ? `<small>Reinforced until ${date(d.reinforcement_timer.end)}</small>` : ""}</td><td>${tag(d.state, d.state === "Running" ? "" : "warn")}</td><td>${num(d.infomorphs?.amount)}</td><td>${esc(d.evolution?.anarchy?.level)}<small>${num(d.evolution?.anarchy?.amount)} / 100</small></td><td>${esc(d.evolution?.development?.level)}<small>${num(d.evolution?.development?.amount)} / 100</small></td><td>${d.operations.length ? d.operations.map((o) => `${tag(o.state, "purple")}<small>Expires ${date(o.expires)} · ${eta(o.expires)}</small>${o.definition ? `<small>Anarchy ${num(o.definition.anarchyImpact)} · Development ${num(o.definition.developmentImpact)}</small>` : ""}`).join("<br>") : "<small>No available operation.<br>Next spawn not provided by EVE.</small>"}</td></tr>`,
    ),
  );
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
    rows
      .map(
        (c) =>
          `<section class="panel compact"><div class="panelhead">${portrait(c)}<div class="actions"><small>${date(c.updated)}</small><button data-sync-char="${c.id}">↻ Sync character</button></div></div>${c.error ? `<div class="notice error">${esc(c.error)} <a href="/auth/login?link=1">Reconnect character</a></div>` : ""}${
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
                }<details><summary>Blueprints · ${num(c.data.blueprints.length)}</summary><input class="blueprint-filter" aria-label="Search blueprints for ${esc(c.name)}" placeholder="Search blueprints…">${
                  c.data.blueprints.length
                    ? blueprintStations(c.data.blueprints)
                    : "<small>No blueprints reported</small>"
                }</details>`
          }</section>`,
      )
      .join("")
  );
}
async function assets() {
  const qs = new URLSearchParams({ ...assetFilters, offset: assetOffset });
  const data = await api("/assets?" + qs);
  return (
    intro("Asset search", "Find items across all of your linked characters.") +
    `<form id="asset-search" class="toolbar"><input name="q" aria-label="Item name" placeholder="Search item name…" value="${esc(assetFilters.q)}"><select name="character" aria-label="Character"><option value="">All characters</option>${chars.map((c) => `<option value="${c.id}" ${String(c.id) === assetFilters.character ? "selected" : ""}>${esc(c.name)}</option>`).join("")}</select><input name="location" aria-label="Location" placeholder="Filter location…" value="${esc(assetFilters.location)}"><button class="primary">Search</button></form><section class="panel"><div class="panelhead"><h2>${num(data.total)} matching stacks</h2><small>${data.locationCount ? assetOffset + 1 : 0}–${Math.min(assetOffset + 20, data.locationCount)} of ${num(data.locationCount)} locations</small></div>${
      data.locations.length
        ? data.locations
            .map(
              (l) =>
                `<details class="asset-location compact"><summary>${eveIcon(l.type_id)}<strong>${esc(l.name)}</strong>${l.type_name ? `<span class="location-type"> · ${esc(l.type_name)}</span>` : ""}<span class="muted"> · ${num(l.items.length)} stacks · ${num(l.items.reduce((n, a) => n + a.quantity, 0))} items</span></summary>${table(
                  ["Item", "Quantity", "Character", "Container / flag"],
                  l.items
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map(
                      (a) =>
                        `<tr><td><span class="icon-label">${eveIcon(a.type_id)}${esc(a.name)}</span></td><td>${num(a.quantity)}</td><td>${esc(a.character)}</td><td>${a.location_id !== a.root_location_id ? "Container " + a.location_id + " · " : ""}${esc(a.location_flag)}</td></tr>`,
                    ),
                )}</details>`,
            )
            .join("")
        : empty(
            "No matching assets",
            "An empty result may mean the first asset sync has not completed.",
          )
    }<div class="actions"><button data-page-assets="-1" ${assetOffset === 0 ? "disabled" : ""}>Previous</button><button data-page-assets="1" ${assetOffset + 20 >= data.locationCount ? "disabled" : ""}>Next</button></div></section><section class="panel"><h2>Snapshot freshness</h2>${data.sources.map((c) => `<div class="production"><span>${esc(c.name)}</span><div class="actions"><small>${date(c.updated)}</small><button data-sync-char="${c.id}">↻ Sync</button></div></div>`).join("")}</section>`
  );
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
    `<h2>${kind === "plan" ? "New skill plan" : "New fitting"}</h2><form id="document-form" data-kind="${kind}"><label>Name<input name="name" required maxlength="150" placeholder="${kind === "plan" ? "Avatar pilot" : "Fleet setup"}"></label>${kind === "plan" ? `<div class="formrow"><input id="catalog-query" aria-label="Search catalogue" placeholder="Search a skill or ship…"><select id="catalog-mode" aria-label="Search category"><option value="skills">Skills</option><option value="ships">Ships</option></select><button type="button" data-action="catalog">Find</button></div><div id="catalog-results"></div><div id="plan-entries"></div>` : `<label>EFT fitting<textarea name="eft" required placeholder="[Avatar, Fleet setup]&#10;Damage Control II&#10;&#10;">${esc(body || "")}</textarea></label><small>Paste an EFT export from EVE or Pyfa. Unknown items are reported before saving.</small>`}<label><input type="checkbox" name="shared"> Share with signed-in Tools members</label><button class="primary">Save ${kind}</button></form>`,
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
async function showDocument(id) {
  const d = await api("/documents/" + id);
  openDialog(
    `<h2>${esc(d.name)}</h2><div class="actions">${tag(d.shared ? "Shared with members" : "Private", "purple")}${d.mine ? `<button data-share="${id}" data-value="${!d.shared}">${d.shared ? "Make private" : "Share with members"}</button><button data-edit-doc="${id}">Edit</button><button class="danger" data-delete-doc="${id}">Delete</button>` : ""}<button data-copy-doc="${id}">Duplicate</button></div>${d.kind === "fitting" ? `${renderFitting(d.fitting)}<details><summary>EFT fitting · copy or export</summary><textarea readonly id="eft-export">${esc(d.body)}</textarea><button data-export="${id}">Download EFT</button></details>` : `<details><summary>${d.body.length} skills including prerequisites</summary><div id="plan-view">${d.body.map((r) => `<div class="production"><span>${esc(r.name || r.id)}</span><strong>Level ${r.level}</strong></div>`).join("")}</div></details>`}<hr><h3>Check a character</h3><form id="compare" data-document="${id}"><div class="formrow"><select name="character" aria-label="Character">${charOptions()}</select><select name="speed" aria-label="Training speed"><option value="omega">Omega speed</option><option value="alpha">Alpha speed estimate</option></select><button class="primary">Compare</button></div></form><div id="comparison"></div>`,
  );
}
root.addEventListener("click", async (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  try {
    if (b.dataset.nav) {
      page = b.dataset.nav;
      assetOffset = 0;
      await render();
    } else if (b.dataset.syncChar) {
      b.disabled = true;
      await api("/characters/" + b.dataset.syncChar + "/sync", {});
      toast("Character refresh queued. EVE cache times are respected.");
      await render();
    } else if (b.dataset.move) {
      const ids = chars.map((c) => c.id),
        index = ids.indexOf(Number(b.dataset.move)),
        target = index + Number(b.dataset.direction);
      if (index < 1 || target < 1 || target >= ids.length) return;
      [ids[index], ids[target]] = [ids[target], ids[index]];
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
    else if (b.dataset.document) await showDocument(b.dataset.document);
    else if (b.dataset.pageAssets) {
      assetOffset = Math.max(
        0,
        assetOffset + 20 * Number(b.dataset.pageAssets),
      );
      await render();
    } else if (b.dataset.action === "invite") {
      const i = await api("/admin/invites", {});
      document.querySelector("#invite-link").innerHTML =
        `<div class="notice">Single-use invitation, valid for 7 days:<input aria-label="Invitation link" readonly value="${esc(i.url)}" style="width:100%;margin-top:10px"></div>`;
    }
  } catch (e) {
    toast(e.message);
  }
});
root.addEventListener("change", (e) => {
  if (e.target.id === "character-select") {
    selected = e.target.value;
    render();
  }
});
root.addEventListener("input", (e) => {
  if (e.target.classList.contains("blueprint-filter")) {
    const value=e.target.value.toLowerCase();
    const container=e.target.closest("details");
    container.querySelectorAll("[data-blueprint]").forEach(row=>row.hidden=!row.dataset.blueprint.includes(value));
    container.querySelectorAll(".blueprint-station").forEach(station=>{
      if(value && !station.dataset.searching){station.dataset.wasOpen=String(station.open);station.dataset.searching="1";}
      station.hidden=![...station.querySelectorAll("[data-blueprint]")].some(row=>!row.hidden);
      if(value)station.open=!station.hidden;
      else if(station.dataset.searching){station.open=station.dataset.wasOpen==="true";delete station.dataset.searching;}
    });
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
dialog.addEventListener("click", async (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  try {
    if (b.dataset.action === "close") dialog.close();
    else if (b.dataset.action === "catalog") {
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
});
dialog.addEventListener("submit", async (e) => {
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
      document.querySelector("#comparison").innerHTML =
        `<div class="notice">${result.ready ? "All required skills are active." : "Some required skills are missing or inactive."}<br>Estimated remaining training: <strong>${duration(result.seconds)}</strong><br>${esc(result.estimate)}${data.speed === "alpha" ? "<br>Alpha skill restrictions are not evaluated; some skills may require Omega." : ""}</div>${table(
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
});
try {
  me = await api("/me");
  await render();
  setInterval(() => {
    if (page === "overview" && !dialog.open) render();
  }, 30000);
} catch {
  login();
}
