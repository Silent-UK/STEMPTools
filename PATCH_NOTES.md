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
