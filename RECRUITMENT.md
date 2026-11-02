# Recruitment review

Available from v0.32.0. Configure recruitment references in Admin > Recruitment Settings after updating.

- Share `/Recruit` for EVE SSO signup. The consent notice covers inspection of connected pilots. Existing OAuth scopes are used; public combat killmail references do not require an additional private killmail scope.
- Non-member applicants start on Overview, where they can connect additional mains, link alts to each main, change those links and sync their own pilots. My Characters and Application remain available. Recruitment signup does not grant ordinary member access, group applications or corporation access.
- Management > Recruitment is available to site admins or approved groups granted the Recruitment management permission in Admin > Groups.
- Delegated recruiters can inspect applicants, read applicant-owned character data, mail and contacts, and use Pilot Check / Pilot Combat. They cannot inspect ordinary member accounts, inherit an applicant's corporation permissions, read global shared libraries, or modify data while inspecting. Admin inspection keeps its existing wider permissions.
- When the login pilot joins a whitelisted corporation (or otherwise meets normal membership rules), signing in again refreshes membership and opens the main site using the same account, connected pilots, snapshots and main/alt links. No migration or duplicate signup is needed. Corporation management still requires its normal permissions.
- Application decisions and staff notes are private to authorised reviewers. Acceptance records a decision; it does not bypass the normal login whitelist.

## Admin > Recruitment Settings

The WC blacklist is fetched directly from the same Google spreadsheet used by WCFAT; no WCFAT connection or credentials are required. Each installation keeps its own local copy. Names are read from A/F/G/H, reasons from D, with the header skipped. Successful imports are atomic; failed imports retain the previous copy. The scheduler checks hourly and imports when the previous successful import is at least seven days old, with hourly retry after a failure. Use Sync Blacklist Now and Update View to check progress.

The ten supplied WinterCo alliances are seeded as editable friendly defaults (FRT-alt excluded). Existing nonempty friendly alliance lists are preserved; an empty list is seeded once, excluding any explicitly hostile IDs. Subsequent administrator changes, including clearing the list, persist. Configure friendly and hostile pilot/corporation/alliance IDs for WinterCo checks. Hostile references take priority. Names are resolved through ESI. Unknown affiliations remain unknown. Without friendly references, unmatched recipients are not assumed neutral. Refresh a Pilot Check after changing references.

## Inspect Only > Pilot Check

All Characters is selected by default and collects results for every linked main and alt, grouped by pilot. Select an individual pilot to narrow the review. Collection runs in the background and keeps its last saved result. Skills, wallet and contracts use saved character snapshots; mail headers and contact standings are fetched using that pilot's scopes. Missing scopes, stale snapshots and sync errors are shown separately from findings.

- Blacklist comparisons include all linked pilots, by resolved ID or complete normalised name.
- Ship qualification checks active skill levels and recursive SDE prerequisites for Interdictors, Heavy Interdictors, Covert Ops and Prospect.
- Covert Cyno checks module prerequisites and known SDE-compatible hull prerequisites. It does not prove ownership, fitting, fuel or a strategic-cruiser covert subsystem configuration.
- The recent window is 30 days. Mail checks outgoing headers (maximum 500), with recipient affiliation classification. Contact standings are limited to ten pages and flag positive standings towards configured hostiles. Unknown standings are identified as unclassified.
- Contracts must be private and directly addressed to a verified pilot. Public, alliance and corporation contracts are excluded. Issued, accepted or completed dates determine recency; status remains visible.
- Wallet findings use player-donation journal entries and exclude transfers between every pilot linked to this account. History is limited by the saved ESI snapshot; findings are not a full historical audit.

## Inspect Only > Pilot Combat

A separate resumable queue collects public zKillboard records month by month for the current calendar year, adding previous December when rolling 30-day statistics need it. ESI supplies full killmails when only an ID/hash reference is available. Incomplete collection does not replace the last completed result.

The page defaults to All Characters, with deduplicated account kill/loss totals and individual pilot breakdowns. Selecting one pilot narrows the view. The page shows year/30-day/7-day kill and loss totals, ships used and lost, operating systems, and victim corporation/alliance targets. Kills mean participation, not necessarily final blows. Public/unreported coverage limitations are displayed. Existing results refresh after six hours or when an authorised inspector requests refresh. Publication requires a complete crawl; page-limit and upstream failures retain saved totals and show an error.

The application creates the new SQLite tables on startup. Keep the existing application data/encryption-key backup procedure. No separate systemd worker or new npm dependency is needed.
