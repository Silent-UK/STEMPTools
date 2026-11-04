# STEMP Tools v0.41.2

- Hide Links when viewing recruits in Inspect, as well as normal recruit sessions. Add an explicit recruit guard to the sidebar.
- Apply the recruit restriction to the link list API and signed-in short-link requests, preserving normal member access and existing public short links.

# STEMP Tools v0.41.1

- Skill Plans and Fittings: restore the shared themed panel border around the library, with compact spacing matching other pages.

# STEMP Tools v0.41.0

- PI: Storage Attention finds launchpads at least 75% full. Add character, system, planet and product search alongside existing status filters.
- Remember search, filters and alt visibility per account, inspection and personal/shared view.
- Show clear saved-snapshot dates and warnings for PI data older than two hours or with failed refreshes, including shared PI.
- Add Show Production Goals to PI Settings. Preserve selected targets when hidden and skip their background price lookup. Existing accounts keep goals visible by default.

# STEMP Tools v0.40.1

- Mercenary Dens: Needs Attention filters reinforcement, MTOs expiring within 12 hours, workforce reductions, anarchy near level 2 and incomplete MTO snapshots.
- Priority sorting keeps character groups together and ranks reinforced dens, urgent operations and workforce impact first. Remember filter and sort preferences per account.
- Keep summary totals over the full inventory, show filtered counts and reveal matching alts when attention filtering is active.

# STEMP Tools v0.40.0

- Skill Plans and Fittings: searchable libraries with saved visibility, tag, hull, pilot readiness and sort preferences; compact summaries and paginated themed rows.
- Show pilot progress, remaining SP, training estimates, inactive skills, saved queue coverage and snapshot warnings. Export full plans or copy missing skills.
- Create a private prerequisite-complete skill plan from a fitting, link it for your account and navigate between plans, fittings and the Workbench. Distinguish fitting minimums from extra plan goals.
- Protect unsaved document and Workbench edits, show fitting loading/retry states, and keep revoked private plan links from breaking visible fittings.
- Verify private-document isolation, pilot ownership and read-only inspection protections.

# STEMP Tools v0.39.0

- Blueprint library: accurate packaged original totals, copy runs, unique types and locations.
- Saved filters for research, duplicate originals, pilot, location, efficiency and outstanding jobs; group by location, type or character.
- Match saved jobs by blueprint item ID; expose snapshots, output per run and compact expandable details.
- Export all filtered rows to CSV; paginate large inventories and clarify pooled material stock coverage.

# STEMP Tools v0.38.4

- Moon Scans: select multiple highest ore tiers alongside the existing search. No tier selection shows all moons. Colour-code R4, R8, R16, R32 and R64 in filters, moon entries and ore composition.
- Import two additional batches (782 rows): 194 new moons, six precision improvements and no new conflicts. Total collection: 21,768 unique moons.
- Preserve previous rounded compositions in source history. Accept spreadsheet decimal fractions without inventing missing percentages.

# STEMP Tools v0.38.3

- Moon Scans: show each listed moon’s highest ore tier and compact monthly Athanor / Drill values together. Athanor follows the selected refine percentage; Drill remains at 40%.
- Reuse cached prices for the selected system. Mark partial coverage and keep invalid or unpriced estimates unavailable.

# STEMP Tools v0.38.2

- Moon Scans: start with all regions collapsed. Expand the relevant region after explicitly selecting a system or moon.

# STEMP Tools v0.38.1

- Moon Scans: import three additional scan batches (973 rows), adding 668 moons across Geminate, Metropolis and The Forge. Collection now contains 21,574 unique moons.
- Resolve every added moon to its CCP SDE moon ID, region and constellation. Preserve existing compositions, higher precision and incomplete percentages.
- Retain source provenance and conflicting alternatives. Flag missing percentages and show import corrections in source details; unsafe estimates remain unavailable.

# STEMP Tools v0.38.0

- Industry: combined outstanding jobs across mains and alts, character summaries, clickable ready/running/24-hour/paused totals, next completion and progress bars.
- Search and filter activity, status and location; sort jobs, optionally group by pilot, and remember the view per account and inspection context.
- Expand jobs for installation costs and dates; export every filtered job to CSV. Show snapshot coverage and retained sync errors.
- Keep character stripes, compact rows, and Show alts below the picker. Ready timers are estimates until confirmed by ESI.

# STEMP Tools v0.30.1

- **Fitting Workbench:** Ammo opens a weapon-specific browser using the fitting engine’s charge compatibility rules. Search remains restricted to compatible ammunition, and the filter stays active after loading a charge until cancelled or another weapon is chosen.

# STEMP Tools v0.30.0

- **Fitting Workbench:** Replace limited base/core-skill estimates with VYRAJ's licensed Dogma fitting engine. Ship/role bonuses, active pilot skills and implants, module effects, fitting reductions, stacking and overheated bonuses now apply.
- CPU/powergrid account for fitting skills. Shield extenders and armor plates add HP before percentage bonuses; hardeners and damage controls affect resistances according to state and stacking rules.
- Add DPS/volley, EHP/active/passive tank and capacitor stability or lifetime. No pilot selected uses labelled All Skills V; synced pilot selections use their active skills. Launched drones determine drone DPS.
- Heat damage is labelled as an estimate; rack heat and module placement affect live burnout. EHP/tank use uniform incoming damage.
- Preserve mains-only defaults, Show Alts, saved fitting permissions and module state controls. Cost estimates include loaded magazines.
- Include VYRAJ attribution, AGPL licence and a complete corresponding-source download without private configuration or player data.

# STEMP Tools v0.29.1

- **Fitting Workbench:** Select a pilot to apply synced active core skills to CPU, powergrid, capacitor, hull hitpoints, speed, targeting and drone launch limits. Panels distinguish core-skill-adjusted estimates from base hull values. Full ship bonuses and module effects are still not simulated.
- **Fitting Workbench:** Show mains by default in the pilot selector and requirements panel. Show Alts reveals linked alts; hiding alts clears an alt selection back to All Mains.

# STEMP Tools v0.29.0

- **Fittings:** Native fitting workbench with ship/item browser, slot editing, compatible ammo, module states, drones/cargo, EFT import/export, private saves and existing fitting loading. Updating an existing fit preserves sharing; other members can save a private copy. Pilot requirements use synced active skills.
- Resource, defense, capacitor and navigation panels show labelled base catalogue figures. Full ship/skill/module effects, DPS, EHP and capacitor lifetime are not simulated. Optional cost breakdown uses EVE market averages.
- **Admin Users:** ESI Status appears after Corporation, summarising all linked pilots. Reconnect requirements are red; sync issues remain distinct from invalid authentication. Expand a user for details.
- Admin/Inspect controls stay on one line. Delete is in a separate reserved column with a divider and extra space; existing named confirmation and owner protection remain.

# STEMP Tools v0.28.1

- **Corp Assets:** Keep each owned citadel, engineering complex, refinery, Metenox and POS tower in its own location group, with contents and fittings beneath it. Loose in-space assets remain under their solar system.

# STEMP Tools v0.28.0

- **Notifications:** Red warning button and panel across all themes.
- Clones show station/citadel names and solar systems; temporary access failures retain names from that pilot’s previous clones or assets.

- **Corp Assets:** Region filter alongside item/location search, with an Unknown Region option when ESI cannot resolve a location. Empty offices remain last within the results.
- **Memberlist:** Last Location now shows the solar system for docked station/citadel and in-space locations. Unresolvable sites show System unavailable rather than a raw structure ID. Locations remain the last reported tracking snapshot.

# STEMP Tools v0.27.0

- **Admin Users:** owner-only red bin icon permanently deletes an account after a named confirmation. Removes linked pilots, private snapshots/caches, tokens, jobs, sessions, documents, preferences, sharing and memberships. The site owner is protected.
- Account deletion does not delete shared corporation records or other users’ documents. It is not a login ban: an eligible pilot can register again with a fresh account.

# STEMP Tools v0.26.0

- **Settings:** Theme and Side Panel Font Size now use the same compact row layout as page switches.
- New themes: Cyberpunk, Chrome, Dracula, Nord, Solarized and OLED Midnight, alongside the five existing palettes.
- Theme choices are saved per account and shared between Settings and the quick theme picker.

# STEMP Tools v0.25.1

- **Corp Assets:** empty offices are labelled Empty Office and sorted after stocked locations, including across pagination. Emptiness is checked before applying search filters. Empty office entries within a stocked location sort after its other assets.

# STEMP Tools v0.25.0

- Links are visible to every signed-in account without corporation roles or page grants. Admin access is still required to manage them.
- The Links section remembers its expanded/collapsed state after navigation and reloads.
- Settings now includes Side Panel Font Size, from 10px to 20px, saved per account.

# STEMP Tools v0.24.3

- **Sidebar:** external links now have their own collapsible Links section directly below My Characters. The section remembers its open state and appears when links are available.

# STEMP Tools v0.24.2

- **Admin Links:** fix Save Link reloading the page without saving because the hidden ID field shadowed the form ID. Successful saves now show confirmation and refresh the corporation sidebar links.

# STEMP Tools v0.24.1

- **Wallet history:** deduplicate repeated transactions within ESI responses instead of failing the entire history sync. Invalid entries and pagination loops remain rejected; saved history is retained.

# STEMP Tools v0.24.0

- **Wallet history:** tolerate overlapping journal pages by deduplicating entry IDs. Sync errors now distinguish ESI HTTP failures, timeouts, cooldowns and wallet validation failures while retaining saved data.
- **Admin Users:** the site owner can grant or remove admin access from each registered user row.
- Granted admins can use site Admin tools and read-only account inspection, including scoped Mail and Contacts. Only the owner can manage admin grants; the owner cannot be demoted or inspected by another admin.
- Admin permission changes apply on the next request, including existing sessions. Revoking an admin also clears their active inspections. Corporation ESI permissions remain separately checked.

# STEMP Tools v0.23.3

- **Mercenary Dens:** separate Operations and Expires columns, aligned across pilots. Expires shows a dash when no active operation is reported.

# STEMP Tools v0.23.2

- **Corp Assets:** resolve station and third-party citadel types for location pictures, including older cached asset results. Inaccessible locations remain unnamed rather than showing an incorrect structure.

# STEMP Tools v0.23.1

- **ESI Status:** admin Rebalance button evenly distributes characters across the six hourly buckets with as few moves as possible. Existing queued/running jobs continue; moved characters use the next future UTC slot.
- **Admin menu:** Users now appears first.

# STEMP Tools v0.23.0
## Portraits, Permissions & Pilot Views · 31 October 2026

- **Overview:** reconnect notice when linked pilots are missing current ESI scopes, with affected pilots listed.
- **Ratting:** pilot portraits, mains by default, an alt toggle, and period, total earned and daily average stats. Alt income stays included in main totals.
- **Industry:** All Characters view includes linked mains and alts.
- **Mercenary Dens:** tighter rows, removed numeric den IDs and combined keys / estimated ISK.
- **Notifications:** a warning menu appears for operations expiring within 12 hours and anarchy at level 2 or higher, or approaching level 2 at 35/40. Warnings use cached ESI data and flag stale snapshots.
- **Memberlist:** portraits, sorting, account grouping and counts for pilots, registered people and unregistered pilots.
- **Roles and Access:** renamed Pilots, added portraits and in-game title colours, removed activity columns and expanded compact hangar/wallet access details.
- **Corp Assets:** station and structure pictures where the location type is known.
- **Admin Groups:** restricted membership can require an assigned corporation role or title, alongside ship and skill conditions. Every condition must match one pilot using fresh data.
- **Admin Users:** slightly larger text.

Existing pilots should reconnect to grant `esi-characters.read_titles.v1`. Daily averages use UTC calendar days for the current day/week/month, the selected number of days for rolling periods, and retained wallet history for All Time.

# STEMP Tools v0.22.1
## The Management Update · 31 October 2026

### Your Characters
- **Ratting:** combined NPC bounty and ESS income, with a breakdown for pilots who earned ISK. Filter by Day, Week, Current Month, 30, 60, 90 Days or All Time.
- **Market:** buy and sell orders across linked pilots, with pilot, item, location and status filters. Include order history to see fulfilled, cancelled and expired orders separately.
- **Saved Fitting Imports:** copy a pilot's saved in-game fittings into Tools from the Fittings page. Imports are private by default and leave the EVE originals unchanged.
- **Make Main:** promote an incorrectly grouped alt to a main character in your character list. Your account's sign-in main stays the same.

### Settings & Navigation
- New **My Characters** and **Management** sidebar headings, with consistent capitalisation throughout the menu.
- Compact sidebar rows, icons and branding. Sections can stay open independently and remember their state across navigation and reloads, with slightly larger menu text (v0.22.2).
- New **Settings** switches for Ratting, Market, Mining, Industry, Mercenary Dens and Planetary Industry.
- Hidden features pause their dedicated syncing. Data needed elsewhere continues syncing, including Wallet history and PI shared with other players.
- Turning a feature back on resumes its collection on the next sync and keeps its previously saved data.

### Groups
- Browse groups with an icon, name, description and application option.
- Support for **Auto Accept**, **Admin Approval** and **Restricted** membership.
- Restricted groups can require ship ownership and active skill levels on the same pilot, including Titan and Dreadnought presets and specific ship/skill searches.
- Admins can create and edit groups, approve applications, revoke membership and grant access to individual Corporation Management pages.
- Restricted access is checked against fresh character snapshots when used.

### Corporation Management
- **Overview:** corporation details, Dotlan member statistics, zKillboard combat totals and the latest ten Eve Who joiners and leavers, where available.
- **Memberlist:** corporation members, last reported activity, ship and location, with confirmation of Tools registration.
- **Pilots:** titles, join dates and last login, plus searchable assigned and grantable roles. Optional details show hangar and wallet division access, including location scopes and title-derived roles.
- **Corp Assets:** corporation inventory grouped by location, with item and location searches and expandable ship/container contents.
- **Wallet:** seven division balances, retained journal entries and market transactions, with division and transaction filters.
- **External Links:** admins can add names, descriptions and URLs for links displayed under Corporation Management.
- Each new corporation page has its own group permission.

### Administration & Connections
- **Inspect Only:** Mail and Contacts pages appear only during an administrator's read-only inspection of an account. Both support pilot selection; mail supports message viewing and older messages, and contacts are paginated.
- **Users:** tighter aligned rows, corporation names, smaller portraits and compact expandable character health. Schedule and error details stay tucked away until needed.
- Normal character connections now request personal and corporation scopes together. Eligible Sacred Templars CEOs/Directors are detected automatically.
- Removed the separate CEO/Director connection option from Add Character.
- Ordinary members can still connect normally. Corporation access continues to require valid roles or an explicit Tools group grant.

### Before You Dive In
- **Reconnect your characters once** to grant the updated permissions.
- Ratting's All Time means retained wallet history, not lifetime earnings. Day, Week and Month use UTC; weeks start Monday. Ratting excludes loot, LP, mission rewards and corporation tax.
- Market history depends on what ESI supplies and Tools has retained. A disappearing order is never assumed to be fulfilled.
- Corporation activity, ships, locations and access information are reported snapshots. Structure ACLs and container locks can affect actual in-game access.
- External sources may be delayed or unavailable. Failed refreshes retain previous complete data where available and show a warning.

Validated with **119 automated tests**, syntax checks and browser checks using isolated sample data.
