# Tools page healthcheck — 3 November 2026

Scope: current STEMP Tools and NARVI Tools source. This is a source, regression, permissions and synthetic-browser audit of the existing editions, not a certification for an unrestricted public launch. Production account data was not used for browser tests.

## Coverage

| Area | Pages checked in browser | Result |
| --- | --- | --- |
| Personal | Overview; My Characters; Skills & Queues; Clones; Wallet; Contracts; Standings; Ratting; Market; Mining; Industry; Blueprints; Skill Plans; Fittings; Mercenary Dens; Planetary Industry; Asset Search | Loaded with fictional data; no page errors |
| Management | Groups; Settings; Recruitment | Loaded with fictional data; no page errors |
| Corporation | Overview; Memberlist; Roles and Access; Wallet; Contracts; Corp Assets; Search Pilots; Standings; Market; Industry; Blueprints; Structures; Moon Mining; Moon Surveys | Loaded with fictional data; no page errors |
| Admin | Users; Groups; Links; Pages; ESI Status; Corp ESI; Whitelist; Recruitment Settings; Discord | Loaded with fictional data; no page errors |

The 43 navigation pages were exercised again after the shared loading fixes. Additional browser checks covered Pilot Check, Pilot Combat, Mail, Contacts, the fitting workbench, Skill Comparison and PI Market: 50 page views in total. Inspection tests use fictional accounts; mail/contact response content is stubbed, so this does not validate live ESI payload correctness. No browser console warnings/errors were captured during the synthetic pass.

Recruitment signup/ownership, custom-page publication and group permissions, Markdown escaping, fitting imports and exports, fitting simulation, wallet pagination, failed-sync retention, corporation access and Discord state/role validation are additionally covered by existing automated tests and source review. These are not claims of live Discord/EVE integration testing.

## Improvements made

- Shared browser API client: 45-second read deadlines, 90-second write deadlines, safe timeout messages, explicit invalid-JSON handling and preserved HTTP status codes. Writes are never automatically retried.
- Identical reads are coalesced only while in flight. There is no persistent client cache of private API responses; mutations invalidate pending-read reuse.
- A failed notification refresh no longer makes an otherwise healthy page fail. Existing notifications remain available until a successful refresh.
- Page-load failures provide an accessible error and Retry action; temporary startup failures no longer masquerade as an unauthenticated login. Expired sessions still return to sign-in.
- Page content exposes loading state through aria-busy; obsolete renders stop before updating navigation and page content.
- Missing API endpoints return JSON 404 responses rather than an HTML error. Private API/auth responses retain no-store headers even with differently cased URLs.
- Mutating API requests require a JSON object, in addition to the existing session/origin checks. SQLite error codes receive a generic message rather than database details.
- Inspect mode visibly disables common character mutations and reconnect links. Server-side read-only enforcement remains authoritative.
- Closed blueprint locations defer their tables in inert templates. Opening a location activates the rows; both individual and Expand locations behavior were checked in the browser.
- Personal asset search reuses catalogue reads by type and avoids pushing an arbitrarily large array through spread arguments. A 1,000-stack test verifies one lookup for a repeated type.
- Direct links to Skill Comparison and PI Market are registered correctly.
- Admins receive corporation visibility settings without requiring their own Director connection; ordinary members retain their existing restrictions.

## Security checks

The additional HTTP matrix exercises anonymous rejection, member/admin boundaries, corporation-page grants, cross-account character reads, encrypted-token non-disclosure, CSRF rejection, malformed writes, API errors, private caching and read-only inspection. Existing tests cover protected administrators, applicant inspection restrictions, destructive-account confirmation, OAuth replay/identity ownership, Markdown escaping and failed ESI refresh retention.

The npm production dependency audits reported zero known advisories for both installed dependency trees on this date. Advisory absence is not proof that application code is vulnerability-free.

## Verification and limits

Run `npm run check` and `npm test` in each edition. New regression coverage is in tests/api-client.test.mjs and tests/page-health.test.mjs. Final results: 242 tests passed for STEMP and 243 for NARVI; both syntax checks passed.

Browser checks used the in-app Chromium browser against scripts/preview.mjs on an isolated temporary database. Firefox and Safari were not directly exercised in this pass. The preview avoids real EVE/Discord sign-ins and never posts fittings to a live EVE account. Actual SSO, director reconnection, external-service outages, Discord bot permissions and corporation-specific live data still require their respective integration checks.

This was not a destructive penetration test, a large concurrent-user benchmark or a backup restore drill. Large cross-account asset inventories can still require substantial response data; the catalogue optimization does not make that endpoint fully paginated within each location. The existing per-process login limit uses the direct socket address; its behavior behind reverse proxies should be redesigned as part of a general public/self-hosted release.

## Before distributing Nexus

The existing editions intentionally retain STEMP/NARVI configuration. Corporation IDs, owner defaults, branding and deployment paths must become installation configuration before general distribution. Nexus also needs a protected first-run setup process, documented backup/restore and upgrade recovery, and a real-browser/device matrix. These are distribution requirements, not features silently added by this audit.

## Deployment

STEMP publishes through its existing deployment timer and is verified by the active release path plus /health. NARVI changes are pushed to its repository; its external server has repeatedly remained on an older build. Without access to Streken's server, this audit cannot certify NARVI's activation. Streken can inspect/retry with:

```bash
sudo systemctl start narvi-tools-deploy.service
sudo journalctl -u narvi-tools-deploy.service -n 80 --no-pager
```

No ESI scope changes or production data migrations are needed for these healthcheck improvements.
