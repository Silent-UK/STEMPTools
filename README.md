# Tools — tools.areyouaspy.co.uk

Corporation-whitelisted EVE character management for Sacred Templars and Sacred Templar Knights. Node 24+, SQLite, EVE SSO. Self-hosted on the existing VPS; no dependency on the Fuel/WCFAT databases.

## Features
- Main-only login; individually authorised linked alts. Silent Uk (122543287) bootstraps as administrator.
- Skills, queue, recursive prerequisite plans, character-specific remaining SP/time estimates, Alpha/Omega speed selector.
- Member-shared skill plans and EFT fittings, duplicate/private/share/export controls. Ship-prerequisite plan generator.
- Fitting skill eligibility for hull/modules/charges/drones. **Not a CPU/PG/combat simulator**; no writes to EVE fittings or training queues.
- All-character Merc Den infomorphs, anarchy/development, reinforcement and available MTOs with expiry and SDE impacts.
- All-character PI, up to six occupied planets, extraction estimates, factory nominal output, launchpad contents.
- All-character asset search, character/location filters, full ESI pagination, nested-container root locations.
- Background sync every hour; ESI response expiry respected. Failed categories retain previous complete snapshots and show an error.

## EVE limitations
ESI does not return a next-MTO spawn time: the UI shows available operation expiry instead. Den anarchy is the reported score/level plus each MTO's static impact; this is not a measurement of a corporation's lost workforce. PI factory rates are nominal capacity, not actual input-supply simulation. Extractor output is the reported cycle estimate. Assets are cached inventory, with unavailable structure names explicitly labelled. Alpha training restrictions, boosters, remaps and future queue pauses are not simulated. Training time uses current attributes/partial skill points and the chosen speed; a trained but inactive skill is not marked ready. Shared plans/fittings never expose another user's private character snapshots.

## Development
```
npm ci
# Download official CCP JSONL ZIP:
# https://developers.eveonline.com/static-data/eve-online-static-data-latest-jsonl.zip
python scripts/import-sde.py data/sde.zip data
npm test
npm run check
node scripts/preview.mjs
```
Preview binds to 127.0.0.1:3014 with fictional data in a temporary database; it is never the production entry point. Production is `node --env-file=.env server.mjs`. See [deployment instructions](deploy/SETUP.md).

## Security and data
Tokens are AES-256-GCM encrypted using ENCRYPTION_KEY, which must be backed up with the database. Sessions are hashed server-side. OAuth uses expiring single-use browser-bound state and PKCE; JWT issuer/audience/client/character-owner validation. Every private lookup is scoped to account ownership. Linking a character already held by another account is rejected. No automatic migration of transferred characters. Site admins manage the corporation login whitelist and can use explicit, session-bound read-only inspection of other accounts. Only the configured owner can grant or revoke admin access. Login mains must be whitelisted; linked alts may be in other corporations.

Data files live outside releases in /var/lib/stemp-tools. Back up tools.sqlite using SQLite online backup (or stop the service before copying it and its WAL), catalog.sqlite and the separately protected .env. Never commit them. Deleting an alt removes tokens and snapshots; EVE access can also be revoked in CCP's authorised applications page.

## Verification
Tests cover account isolation, CSRF, corporation whitelisting, OAuth replay, alt ownership, main deletion guard, encryption, partial sync retention, real SDE Avatar prerequisites, partial-SP estimates and PI output. Browser review uses fictional data. Actual EVE login/sync and VPS TLS deployment require the newly registered EVE application's credentials.

## Sources
- https://developers.eveonline.com/docs/services/sso/
- https://esi.evetech.net/meta/openapi.json?compatibility_date=2026-10-17
- https://developers.eveonline.com/docs/services/static-data/
- https://developers.eveonline.com/docs/guides/staticdata/


### Skill list import and Mercenary Dens (0.13.0)
New and edited skill plans support clipboard/text import: one English skill name and Roman numeral I–V (or number 1–5) per line. Repeated skills merge at the highest requested level; existing entries are preserved. Invalid lines reject the import without changing the editor. Saving still expands prerequisites.

Dens show totals across all linked characters, stored Infomorph Decryption Keys, EVE market-average estimated values (before fees), anarchy/development levels, workforce reduction and named MTOs with expiry timers. Prices are cached using ESI expiry headers; unavailable prices remain unknown rather than zero. MTO service failures no longer prevent den inventory syncing and are labelled incomplete. These are last-sync snapshots, not live inventory. Future spawn timestamps are not exposed by the currently supported ESI schema; no guessed spawn timer is presented as fact.

Workforce mapping: levels 0/1 = 0%, 2 = 10%, 3 = 20%, 4 = 40%, per [official Mercenary Den patch notes](https://www.eveonline.com/news/view/patch-notes-version-22-02). MTO names and effects come from the [official SDE](https://developers.eveonline.com/docs/guides/staticdata/).


## v0.15.0 workspace update

Overview includes account-owned SP and wallet totals. Wallet sync requests `esi-wallet.read_character_wallet.v1`; reconnect existing characters once, then sync. Unknown balances remain unavailable, and failed syncs retain the previous value. No manual database migration is needed.

Background sync completion offers an Update view button instead of rebuilding the page. Training countdowns update in place and advance through the cached EVE schedule. Clone capacity counts stored jump-clone slots from active Infomorph Psychology, Advanced Infomorph Psychology and Elite Infomorph Psychology levels; the active body is excluded. Older clone snapshots gain capacity after the next sync.

Industry and Assets use character selectors; Industry's blueprint search still covers all linked characters. Corp plans is the display label for plans shared with signed-in Tools members; it does not introduce corporation-based access restrictions. Skills-at-level counts include injected skills reported by ESI, with level 0 meaning injected but untrained.


## v0.16.0 Planetary Industry

PI Settings stores per-account extraction thresholds (18,000 perfect / 16,000 critical by default) and up to eight ordered P3/P4 targets. Schema creation is automatic; no new ESI scope or manual migration is required. The trained-skill group rows are also tighter.

Extractor averages sum each cycle using the [EVE developer PI formula](https://developers.eveonline.com/docs/guides/pi/) and divide by the complete programme duration. Use the **current ESI schema's seconds** for `extractor_details.cycle_time` (the guide's old C# API conversion comment describes minutes). Missing programme fields remain unknown; expired programmes retain their last average but show Reset needed. Factory rates remain nominal configured capacity, not guaranteed live output.

Goals sum launchpad, storage and command-centre contents across owned characters. They exclude factory input buffers and future extraction. SDE recipes expand lower-tier ingredients as needed, obey whole batches and limiting ingredients, reserve existing selected finished products, then allocate remaining stock in configured priority order. Finished targets and shared stock are never double-counted. Target order is an allocation choice, not an optimisation for maximum profit.

Valuation uses the lowest sell order at Jita IV–4 station 60003760, across all pages for the target type in The Forge. Quotes obey ESI expiry and incomplete fetches are not cached. Values include existing selected end products plus additional producible output, before fees, hauling or market-depth effects. Missing prices are shown explicitly; a partial stock warning appears if any linked character is missing a PI snapshot or has a sync error. EVE can require viewing a colony in-game before its reported contents are recalculated.


### v0.17.0 — owner administration

- Owner-only Admin navigation and API access use the configured owner character ID. Users lists account counts, expandable character ESI health and last login (recorded from this release onward).
- Characters receive a persistent random UTC sync bucket: :00, :10, :20, :30, :40 or :50. Existing characters are assigned automatically. Each slot queues characters once per hour; the worker processes them sequentially. Manual refresh does not change their slot. Missed windows after downtime roll forward, avoiding a catch-up burst. Characters needing reconnection wait for reconnection or manual refresh.
- Corp ESI connects a CEO/Director through a separate OAuth flow requesting `esi-characters.read_corporation_roles.v1`. Tokens are encrypted separately from personal character tokens. Role verification is at connection time; future corporate data features must refresh credentials and recheck roles before use, and request their necessary scopes. No corporate data collection is enabled yet. Use Connect corporation again to renew verification.
- Database additions are automatic at startup. No manual database migration is required.


### v0.18.0 — Sacred Templars corporation management

- Removes the command-centre navigation label and adds an expandable Corporation Management section beneath Asset Search. Admin remains owner-only. Corporation pages require a separately verified CEO/Director in corporation 668298004 (Sacred Templars), including for the owner. Signed-in directors connect via Add character → Connect Sacred Templars CEO / Director access. The owner can also use Admin → Corp ESI.
- Reconnect existing Corp ESI authorizations to grant `esi-corporations.read_structures.v1`, `esi-assets.read_corporation_assets.v1` and `esi-corporations.read_starbases.v1`, alongside corporation role access. The OAuth application must allow these read scopes. Personal character tokens are unchanged; no writes to EVE are requested. Tokens remain encrypted and account-bound. Permission checks fail closed, use character affiliation plus corporation roles/CEO identity, and cache successful verification for at most five minutes in Tools (ESI source caches also apply).
- Corporation data syncs hourly with an optional manual sync. One shared STEMP snapshot serves authorized directors. Collection requires complete structure, starbase and asset pagination; partial errors retain the previous snapshot. Credential refresh checks character identity and ownership. ESI cache and throttling headers are respected.
- Structures includes Upwell structures, Metenox drills and POS, their states, ESI state/reinforcement timers and fuel inventory. Service-based rates reuse Fuel's matching, research-module deduplication and sovereignty-aware hull modifiers. Unknown/inconsistent service data is not assumed to consume zero. Standard POS towers use 40/20/10 blocks per hour before sovereignty adjustment; faction/unknown tower rates remain unavailable. POS reinforcement resources are listed separately. Seven- and thirty-day top-ups are estimates from snapshot stock, current online service rates and elapsed time, excluding service startup costs. Reinforcement hours are a preferred window, not an active attack timer.
- Moon Drills shows harvest-bay material quantities, mining state, fuel blocks and Magmatic Gas, fuel runway and collection history. Only MoonMaterialBay contributes harvest stock; only StructureFuel contributes drill block/gas stock. Per-material decreases yield minimum observed removals and a detection interval. An empty bay after previously stored material is marked emptied; initial empty snapshots are not events. Growth can mask removals, so this is not exact lifetime production or an exact collection timestamp. History starts with Tools' first complete sync and retains the latest 50 observations. Stale/cached inventories cannot move the history baseline backwards.
- Schema updates are automatic. No Fuel database or production data is copied.

References: [ESI API specification](https://esi.evetech.net/meta/openapi.json), [CCP starbase fuel changes](https://www.eveonline.com/news/view/starbase-tweaks-an-update), [CCP structure management](https://support.eveonline.com/hc/en-us/articles/208289605-Structure-Management).


### v0.18.1 — harvest layout and navigation

- Structures sort by their earliest finite fuel, gas, state or unanchor deadline, including overdue entries first; unknown timers sort last. The displayed fuel deadline and the sorting calculation share the same inputs.
- Moon Drills adopts Sliders' harvest layout: three summary tiles, system/structure search, region filtering, highest-value-first roster, expandable material prices and quantities, volume and CSV export. Totals cover all drills; filtering affects the roster and export. Collection history and fuel planning remain available within each row.
- Values use cached ESI average prices, not Jita sell orders. Missing prices/volumes are explicitly marked; known subtotals exclude unknown entries. Last known prices survive outages and are labelled accordingly. Region metadata populates at the next successful corporation sync. No additional scopes are needed for this update.
- Corporation Management remembers its open/closed state in this browser, separately for each signed-in account, across navigation and reloads.

## v0.20.0 Mining
Mining sits before Industry with a character picker, Show alts, a daily volume/quantity chart, period and material/system filters, and a paginated ledger. Enable `esi-industry.read_character_mining.v1` in the EVE application, then reconnect each pilot. Normal login, reconnect and Mining access all request this scope. ESI exposes 30 days; Tools retains imported rows as daily cumulative quantities keyed by date/system/type, replacing repeat observations rather than adding them. History is private to the owning account and removed when the character is unlinked. Full pagination must succeed before a snapshot is published; failures preserve the previous ledger. Quantities use ESI and volumes use SDE unit volume; missing volume is marked unknown. Ledger data is delayed, synced hourly, and is not a lifetime total.

Mining opens with combined stats for every linked main and alt, irrespective of other pages’ alt filters. Pilot tiles switch to individual ledgers; All characters restores the combined view. Combined rows retain pilot attribution, and missing or failed snapshots are identified.


## v0.21.0 — character settings and management

- Sidebar: My Characters, Management (Groups and Settings), Inspect Only (only during owner inspection), and Corporation Management. Menu labels use title case. Overview includes Make Main for incorrectly grouped alts; this changes the character group, not the account's login identity.
- Ratting totals positive personal bounty_prizes and ess_escrow_transfer wallet entries. UTC Day, Monday-start Week, current Month, rolling 30/60/90 days and retained All Time are supported. Loot, LP, mission rewards and corporation taxes are excluded. History remains bounded by what ESI supplied and Tools retained; unlinking removes that pilot's history.
- Per-account sliding switches hide Ratting, Mining, Industry, Mercenary Dens and Planetary Industry. The worker checks settings before each feature. Wallet history, skills, assets and clones remain shared dependencies. PI shared with another account continues syncing even if its owner's PI page is hidden. Re-enabling resumes the next scheduled or manual sync without deleting saved data.
- Admin Groups supports symbol/emoji icons, names, descriptions, auto accept, approval and restricted membership, editing/deletion and application decisions/revocation. Restricted requirements use one pilot's ship assets and active skill levels, all within 24 hours and without sync errors. Titan and dreadnought presets and specific ship/skill name search are available. Restricted access is re-evaluated on every page request. Grants allow selected corporation GET pages only; corporation sync and credentials remain director-only.
- Admin Links manages HTTP(S) external links; they appear in Corporation Management for users with corporation page access. Links cannot contain credentials or executable URL schemes.
- Corporation Overview combines public ESI details, cached Dotlan member stats, zKillboard recorded combat totals and the latest ten Eve Who join/leave events. Each source can fail independently, retaining previous data and marking unavailable/stale results. Source pages are linked. Third-party coverage and availability vary.
- Memberlist uses corporation membership and tracking, marks site signup based on linked character IDs, and shows last reported login/logoff, ship and location (not live telemetry). Admin Users shows public corporation affiliation for mains and expanded alts.
- Inspect Mail and Contacts are read-only, require the existing session-bound owner inspection and target-owned character, and check the selected pilot's scopes. Mail bodies are rendered as escaped plain text. Contacts paginate and mail supports older-message browsing. No mail/contact snapshots or background collection are added.

Enable these additional scopes on the EVE developer application **before deploying**, then reconnect the affected pilots/director:

```
# Personal — Mail and Contacts in Inspect Only
esi-mail.read_mail.v1
esi-characters.read_contacts.v1
# Corporation — Memberlist
esi-corporations.read_corporation_membership.v1
esi-corporations.track_members.v1
```

Existing authorizations keep their current permissions until reconnecting. Missing scopes produce an explicit unavailable/reconnect message. Database tables are created automatically. No production deployment is performed by this change.

Sources: [ESI API Explorer](https://developers.eveonline.com/api-explorer), [Eve Who public API](https://github.com/zKillboard/evewho#api), [zKillboard API](https://zkillboard.com/api/docs/), [Dotlan](https://evemaps.dotlan.net/corp/Sacred_Templars).


## v0.22.0 — pilots, corporation assets/finances and personal market

- Corporation Management adds **Pilots**, **Corp Assets** and **Wallet**, each with a separate group page grant. A grant to one page does not authorize any other page or corporation sync. Current CEO/director credentials are checked before reading collected corporation data.
- Pilots combines member tracking (join date, last login, last reported ship/location), title assignments and direct roles. Search and filters cover titles, assigned versus grantable roles, hangar divisions and wallet divisions. Show Roles and Show Hangar & Wallet Access reveal compact details. Title roles retain HQ/base/other location scopes; grantable roles never imply personal access. CEO/director division access is expanded. Financial read roles are labelled separately from Account Take. Structure ACLs and container locks cannot be inferred from these assignments. Missing titles/division names are marked explicitly.
- Corp Assets fetches every inventory page before publishing, preserves ship/container parent context, supports item/custom-name and location searches, and pages by location. It uses known corporation structure names and public station names; unknown locations retain their IDs. Named ship/container lookups are optional. Complete previous inventory survives failed refreshes.
- Corporation Wallet imports all seven balances, paginated journals and transaction cursors before publishing a complete snapshot. History is retained and deduplicated per division, and division names are resolved when permitted. Journal and market trades are separate to avoid double counting. Any partial refresh retains the previous complete snapshot and shows an error. New corporation datasets refresh on page access when their one-hour cache expires; no live telemetry is implied.
- Personal **Market**, before Mining, combines linked pilots' buy/sell orders and offers pilot, side, text and status filters. Include Completed / Closed Orders reveals retained historical orders. Zero remaining volume is labelled Fulfilled; cancelled/expired orders with remaining quantity stay distinct. Disappearing active orders are not assumed fulfilled. Personal Market data is account-owned. The Settings switch hides Market and pauses its dedicated hourly sync; public pricing and Wallet continue as separate dependencies.
- Fittings → **Import In-Game Fittings** lists a selected linked pilot's saved EVE fittings. Import validates the ship/items, converts to EFT and creates a private Tools fitting. Repeating an import returns the existing copy; deleting that copy permits importing again. This is a copy, not a live link or an upload to EVE. Original descriptions remain recorded with the import source. Unknown/unsupported items fail before saving. Inspection remains read-only.

Additional EVE application scopes for this release (enable before deployment, then reconnect personal pilots and Corp ESI as applicable):

```
# Personal
esi-markets.read_character_orders.v1
esi-fittings.read_fittings.v1
# Corporation
esi-corporations.read_titles.v1
esi-corporations.read_divisions.v1
esi-wallet.read_corporation_wallets.v1
```

Corporation roles use the existing `esi-corporations.read_corporation_membership.v1`; corporation inventory uses the existing `esi-assets.read_corporation_assets.v1`. No EVE write permissions are requested. Database additions are automatic. `scripts/preview.mjs` contains isolated fictional samples for browser checks; these never enter production.


## v0.22.1 — unified account connection and compact Users

Normal sign-in, Add Character, reconnect and Mining access now request the union of personal and corporation scopes. The Add Character dialog no longer offers a separate CEO/Director connection. A successful normal character connection automatically verifies corporation membership and CEO/Director status and registers eligible Sacred Templars pilots for Corporation Management. Ordinary members and pilots outside STEMP can still link normally; extra scopes alone do not grant corporation access. Temporary corporation verification failure does not fail personal login.

Automatically registered corporation credentials contain an encrypted reference to the account-owned linked character. Corporation requests use that character's existing token provider and refresh lock, avoiding duplicate refresh-token rotation. Losing eligibility on reconnect removes only that pilot's corporation grant; connecting an ordinary alt preserves another linked director's grant. Unlinking the source removes its corporation authorization immediately. Existing legacy separate authorizations remain compatible, and the old URL remains available for pending/older flows, but no current UI links to it.

Users now uses compact aligned columns for Pilot, Corporation, character count and Last Online, with 22px portraits and tighter rows. Expanded character health keeps schedule/error details collapsed. Narrow layouts wrap corporation/activity into a second compact line.

Existing pilots must reconnect once to authorize the combined scope set. No extra scopes beyond v0.22.0 are introduced; all existing personal and corporation scopes must be enabled on the EVE application.

The sidebar is compacted further in v0.22.1: smaller rows/icons and branding, collapsible Admin, and a native single-open-section accordion across My Characters, Management, Inspect Only, Corporation Management and Admin. Navigation opens the section containing the current page. Shorter desktop windows use an additional compact spacing rule; overflow remains available when needed.


## v0.22.2 — remembered sidebar sections
Sidebar sections now open independently and retain their open/closed state across navigation and reloads in the same browser, separately for each account. This replaces the single-open-section accordion. Menu and section heading text increases from 11px to 12px while retaining compact spacing.


## v0.22.3 — consistent sidebar alignment
Removed old corporation-only link indentation. Corporation Management now uses the same icon and text alignment as every other sidebar section.

## v0.23.0 — portraits, notifications and membership rules

See PATCH_NOTES.md for user-facing changes. Personal title collection adds `esi-characters.read_titles.v1`; reconnect existing pilots. Role/title requirements are STEMP-scoped, require fresh snapshots and combine with other requirements on the same pilot. Den notifications use owned cached snapshots, stop when Dens is disabled and flag stale data.

## v0.24.0 — delegated site administrators

Owner-only Make Admin / Remove Admin controls are on Admin Users. Admin flags are read from the database on each authenticated request; revocation takes effect without signing out and clears active inspections. Site admins can use Admin endpoints and inspect non-owner accounts. Inspection remains read-only and does not carry the target account’s admin privileges. The owner retains access independently of their database flag. Corporation data still requires its own ESI role/page authorization. No manual migration is needed; existing users.admin stores grants.

## Fitting engine and licence

This application integrates the VYRAJ fitting engine under AGPL-3.0-only. See LICENSE, vendor/vyraj/NOTICE.md and FITTING_WORKSPACE_REVIEW.md. The fitting workspace provides attribution and a corresponding-source download to all signed-in users. `npm test` regenerates the source archive before validation; rebuild it after final source/documentation changes before release.

## v0.31.0: corporation tools and personal improvements

Includes the LP Wallet toggle. New corporation pages: Contracts, Market, Blueprints and Standings; these use the existing group page permissions. Personal Standings can be hidden in Settings, which also pauses its sync. Jump fatigue appears above Linked Characters. Save to EVE creates a new saved fitting for an owned pilot, carrying loaded charges in cargo and excluding implants and module activation/heat state. EVE names are limited to 50 characters.

Manufacturing material planners are available under personal and corporation Industry. Requirements use CCP SDE recipes, blueprint ME, per-job rounding and manually entered facility/rig material reductions. Blueprint-copy run limits are checked. Available stock is from saved inventory; stock is not reserved. Job fees, invention and reaction planning are excluded. Wallet category breakdowns operate on the selected journal or market ledger without combining the two.

The existing notification menu includes finished industry jobs, recent expired market orders and completed PI extractor programmes, respecting disabled pages and ignoring stale/failed snapshots. Empty-training warnings require a saved subscription date with positively remaining game time; expired and unknown dates do not generate these alerts. Subscription dates remain manually recorded because ESI has no account subscription endpoint.

Additional scopes before eventual deployment: esi-contracts.read_corporation_contracts.v1, esi-markets.read_corporation_orders.v1, esi-corporations.read_blueprints.v1, esi-fittings.write_fittings.v1, esi-characters.read_standings.v1, esi-corporations.read_standings.v1 and esi-characters.read_fatigue.v1. Both EVE developer applications have been enabled; pilots/directors will still need to reconnect after deployment.

### v0.31.2 corporation display preferences

Settings offers ten corporation page visibility switches, limited to the pages the account can access. These account preferences hide sidebar entries only: corporation syncs and permission grants are unaffected. Corporation navigation places Corp Assets after Contracts, followed by Standings. Corporation Blueprints defaults to expandable physical-location groups, with independent BPO/BPC switches and originals sorted before copies.

## Recruitment review (pending local release)

See [RECRUITMENT.md](RECRUITMENT.md) for applicant signup, reviewer permissions, independent weekly WC blacklist imports, alignment references, and Pilot Check / Pilot Combat coverage.

Discord integration and link aliases: see [setup and role behaviour](DISCORD.md).

Custom Pages: see [editing, formatting and access settings](PAGES.md).
