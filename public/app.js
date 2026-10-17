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
const duration = (s) =>
  s == null
    ? "Unavailable"
    : s <= 0
      ? "Complete"
      : Math.floor(s / 86400) +
        "d " +
        Math.floor((s % 86400) / 3600) +
        "h " +
        Math.ceil((s % 3600) / 60) +
        "m";
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
];
function shell() {
  root.innerHTML = `<div class="shell"><aside><div class="brand"><img src="/logo.svg" alt="">Tools<small>CAPSULEER COMMAND</small></div><div><div class="navlabel">Your command centre</div><nav>${nav.map(([id, icon, name]) => `<button data-nav="${id}" class="${page === id ? "active" : ""}"><span>${icon}</span>${name}</button>`).join("")}${me.admin ? '<button data-nav="admin"><span>⚙</span>Invitations</button>' : ""}</nav></div><div class="account">SIGNED IN AS<strong>${esc(me.name)}</strong><button data-action="logout">Sign out</button><p>Tools · v0.1.0</p></div></aside><main><header class="topbar"><span class="eyebrow">● PRIVATE CHARACTER WORKSPACE</span><div class="actions"><button data-action="sync">↻ Refresh data</button><a class="button primary" href="/auth/login?link=1">+ Add character</a></div></header><div id="content"></div><footer class="footer">EVE Online data provided by CCP Games. Not affiliated with CCP. Cached snapshots · all times UTC.</footer></main></div>`;
}
function intro(title, description, actions = "") {
  return `<div class="intro"><div><h1>${title}</h1><p>${description}</p></div>${actions}</div>`;
}
function login() {
  const invite = new URLSearchParams(location.search).get("invite");
  root.innerHTML = `<div class="login"><section class="login-art"><div class="brand"><img src="/logo.svg" alt="">Tools</div><div class="eyebrow">YOUR CHARACTERS. ONE WORKSPACE.</div><h1>A clearer view<br>of your <em>New Eden.</em></h1><p>Train with a purpose. Keep your colonies moving. Bring every character into one private command centre.</p><div class="orbital" aria-hidden="true"></div></section><section class="loginbox"><div>${tag("INVITE-ONLY", "purple")}<h2>Your next move starts here.</h2><p class="muted">Sign in with your main character, then securely connect your alts.</p><a class="button primary" href="/auth/login${invite ? "?invite=" + encodeURIComponent(invite) : ""}">Sign in with EVE Online →</a><small>${invite ? "Your invitation will be redeemed after EVE login." : "Already a member? Sign in above. New pilots need an invitation."}</small><div class="features"><span>◇ Shared skill plans</span><span>△ Fitting skill checks</span><span>◎ All-character PI</span><span>⬡ Mercenary dens</span><span>▦ Asset search</span><span>▤ Skills & queue</span></div><p class="notice">Your character information is private. Only the plans and fittings you choose to share are visible to other members.</p></div></section></div>`;
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
    if (page === "admin") html = await admin();
    if (run === renderId) content.innerHTML = html;
  } catch (e) {
    if (run === renderId)
      content.innerHTML = `<div class="notice error">${esc(e.message)}</div>`;
  }
}
function overview() {
  const synced = chars.filter((c) => c.snapshots.length === 4).length,
    working = chars.filter((c) => c.job).length,
    issues = chars.filter((c) => c.reconnect || c.errors.length).length;
  return (
    intro(
      "Your capsuleer command",
      "One place for every character, training plan and operation.",
    ) +
    `<div class="cards"><div class="card"><div class="label">Linked characters</div><div class="stat">${chars.length}</div><small>One main. Your alts together.</small></div><div class="card"><div class="label">Complete snapshots</div><div class="stat">${synced}<span class="muted"> / ${chars.length}</span></div><small>${working ? working + " character refreshes queued" : "Background refresh every 15 minutes"}</small></div><div class="card"><div class="label">Needs attention</div><div class="stat">${issues}</div><small>Connection or data refresh issues</small></div></div><section class="panel"><div class="panelhead"><h2>Your characters</h2>${tag("PRIVATE", "purple")}</div>${
      chars.length
        ? table(
            ["Character", "Data status", "Last refreshed", ""],
            chars.map(
              (c) =>
                `<tr><td>${portrait(c)}</td><td>${c.reconnect ? tag("Reconnect required", "warn") : c.job ? tag(c.job, "purple") : c.errors.length ? tag("Refresh issue", "warn") : tag(c.snapshots.length ? "Connected" : "Awaiting first sync", "dim")}${c.errors.map((e) => `<small>${esc(e.kind)}: ${esc(e.message)}</small>`).join("")}</td><td>${date(c.snapshots.length ? Math.min(...c.snapshots.map((s) => s.updated)) : null)}</td><td><div class="actions"><a class="button" href="/auth/login?link=1">Reconnect</a>${c.main ? "" : `<button class="danger" data-unlink="${c.id}">Unlink</button>`}</div></td></tr>`,
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
  return (
    intro(
      "Skills & training queue",
      "Current skills and EVE’s reported training schedule.",
      `<select id="character-select" aria-label="Character">${charOptions()}</select>`,
    ) +
    (data
      ? `<div class="cards"><div class="card"><div class="label">Total skill points</div><div class="stat">${num(data.skills.total_sp)}</div></div><div class="card"><div class="label">Queued skills</div><div class="stat">${data.queue.length}</div></div><div class="card"><div class="label">Queue finishes</div><div class="stat" style="font-size:20px">${date(data.queue.at(-1)?.finish_date)}</div><small>Snapshot ${date(s.updated)}</small></div></div><section class="panel"><h2>Training queue</h2>${
          data.queue.length
            ? table(
                [
                  "Skill",
                  "Target level",
                  "Starts",
                  "Finishes",
                  "Time to finish",
                ],
                data.queue
                  .sort((a, b) => a.queue_position - b.queue_position)
                  .map(
                    (q) =>
                      `<tr><td>${esc(q.name)}</td><td>${q.finished_level}</td><td>${date(q.start_date)}</td><td>${date(q.finish_date)}</td><td>${q.finish_date ? eta(q.finish_date) : "Paused / not scheduled"}</td></tr>`,
                  ),
              )
            : empty("Queue is empty")
        }</section><section class="panel"><div class="panelhead"><h2>Trained skills</h2><input id="skill-filter" placeholder="Filter skills…" aria-label="Filter skills"></div>${table(
          ["Skill", "Trained", "Active", "Skill points"],
          data.skills.skills
            .sort((a, b) => a.name.localeCompare(b.name))
            .map(
              (s) =>
                `<tr data-skill="${esc(s.name.toLowerCase())}"><td>${esc(s.name)}</td><td>${s.trained_skill_level}</td><td>${s.active_skill_level}</td><td>${num(s.skillpoints_in_skill)}</td></tr>`,
            ),
        )}</section>`
      : empty(
          "Skills have not synced yet",
          "Refresh data, then return here once the background job completes.",
        ))
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
                `<tr><td><strong>${esc(d.name)}</strong><small>${date(d.updated)}</small></td><td>${esc(d.author)} ${d.mine ? tag("YOURS", "dim") : ""}</td><td>${tag(d.shared ? "Members" : "Private", d.shared ? "purple" : "dim")}</td><td><button data-document="${esc(d.id)}">Open & compare →</button></td></tr>`,
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
          `<section class="panel"><div class="panelhead">${portrait(c)}<small>${date(c.updated)}</small></div>${c.error ? `<div class="notice error">${esc(c.error)}</div>` : ""}${!c.data ? empty("Awaiting first sync") : kind === "pi" ? planets(c.data) : dens(c.data)}</section>`,
      )
      .join("")
  );
}
function planets(rows) {
  if (!rows.length) return empty("No colonies reported");
  return (
    `<small>${rows.length} of up to 6 planets occupied</small><div class="planetgrid">` +
    rows
      .map(
        (p) =>
          `<article class="planet"><h3>${esc(p.info?.name || p.planet_id)}</h3><small>${esc(p.planet_type)} · Upgrade level ${p.upgrade_level} · ${p.num_pins} pins</small><h3 style="margin-top:20px">Production</h3>${p.production.length ? p.production.map((r) => `<div class="production"><span>${esc(r.name)}<small>${esc(r.kind)}${r.expires ? " · " + eta(r.expires) + " remaining" : ""}</small></span><strong>${num(r.perHour)}/h</strong></div>`).join("") : "<small>No extraction or factory programme</small>"}<details><summary>Launchpads · ${p.launchpads.length}</summary>${p.launchpads.map((l) => `<div class="listrow"><strong>Pad ${l.id}</strong></div>${l.contents.length ? l.contents.map((i) => `<div class="production"><span>${esc(i.name)}</span><strong>${num(i.amount)}</strong></div>`).join("") : "<small>Empty</small>"}`).join("")}</details></article>`,
      )
      .join("") +
    "</div>"
  );
}
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
async function assets() {
  const qs = new URLSearchParams({ ...assetFilters, offset: assetOffset });
  const data = await api("/assets?" + qs);
  return (
    intro("Asset search", "Find items across all of your linked characters.") +
    `<form id="asset-search" class="toolbar"><input name="q" aria-label="Item name" placeholder="Search item name…" value="${esc(assetFilters.q)}"><select name="character" aria-label="Character"><option value="">All characters</option>${chars.map((c) => `<option value="${c.id}" ${String(c.id) === assetFilters.character ? "selected" : ""}>${esc(c.name)}</option>`).join("")}</select><input name="location" aria-label="Location" placeholder="Filter location…" value="${esc(assetFilters.location)}"><button class="primary">Search</button></form><section class="panel"><div class="panelhead"><h2>${num(data.total)} matching stacks</h2><small>${assetOffset + 1}–${Math.min(assetOffset + 100, data.total)}</small></div>${
      data.items.length
        ? table(
            ["Item", "Quantity", "Character", "Location", "Container / flag"],
            data.items.map(
              (a) =>
                `<tr><td>${esc(a.name)}</td><td>${num(a.quantity)}</td><td>${esc(a.character)}</td><td>${esc(a.location)}</td><td>${a.location_id !== a.root_location_id ? "Container " + a.location_id + " · " : ""}${esc(a.location_flag)}</td></tr>`,
            ),
          )
        : empty(
            "No matching assets",
            "An empty result may mean the first asset sync has not completed.",
          )
    }<div class="actions"><button data-page-assets="-1" ${assetOffset === 0 ? "disabled" : ""}>Previous</button><button data-page-assets="1" ${assetOffset + 100 >= data.total ? "disabled" : ""}>Next</button></div></section><section class="panel"><h2>Snapshot freshness</h2>${data.sources.map((c) => `<div class="production"><span>${esc(c.name)}</span><small>${date(c.updated)}</small></div>`).join("")}</section>`
  );
}
async function admin() {
  const list = await api("/admin/invites");
  return (
    intro(
      "Invitations",
      "Only invited pilots can create a Tools account.",
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
async function showDocument(id) {
  const d = await api("/documents/" + id);
  openDialog(
    `<h2>${esc(d.name)}</h2><div class="actions">${tag(d.shared ? "Shared with members" : "Private", "purple")}${d.mine ? `<button data-share="${id}" data-value="${!d.shared}">${d.shared ? "Make private" : "Share with members"}</button><button data-edit-doc="${id}">Edit</button><button class="danger" data-delete-doc="${id}">Delete</button>` : ""}<button data-copy-doc="${id}">Duplicate</button></div>${d.kind === "fitting" ? `<details><summary>EFT fitting · copy or export</summary><textarea readonly id="eft-export">${esc(d.body)}</textarea><button data-export="${id}">Download EFT</button></details>` : `<details><summary>${d.body.length} skills including prerequisites</summary><div id="plan-view">${d.body.map((r) => `<div class="production"><span>${esc(r.name || r.id)}</span><strong>Level ${r.level}</strong></div>`).join("")}</div></details>`}<hr><h3>Check a character</h3><form id="compare" data-document="${id}"><div class="formrow"><select name="character" aria-label="Character">${charOptions()}</select><select name="speed" aria-label="Training speed"><option value="omega">Omega speed</option><option value="alpha">Alpha speed estimate</option></select><button class="primary">Compare</button></div></form><div id="comparison"></div>`,
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
        assetOffset + 100 * Number(b.dataset.pageAssets),
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
  if (e.target.id === "skill-filter") {
    const value = e.target.value.toLowerCase();
    document
      .querySelectorAll("[data-skill]")
      .forEach((row) => (row.hidden = !row.dataset.skill.includes(value)));
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
