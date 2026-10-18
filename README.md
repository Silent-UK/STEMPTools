# Tools — tools.areyouaspy.co.uk

Invite-only EVE character management for Silent Uk and invited pilots. Node 24+, SQLite, EVE SSO. Self-hosted on the existing VPS; no dependency on the Fuel/WCFAT databases.

## Features
- Main-only login; individually authorised linked alts. Silent Uk (122543287) bootstraps as administrator.
- Skills, queue, recursive prerequisite plans, character-specific remaining SP/time estimates, Alpha/Omega speed selector.
- Member-shared skill plans and EFT fittings, duplicate/private/share/export controls. Ship-prerequisite plan generator.
- Fitting skill eligibility for hull/modules/charges/drones. **Not a CPU/PG/combat simulator**; no writes to EVE fittings or training queues.
- All-character Merc Den infomorphs, anarchy/development, reinforcement and available MTOs with expiry and SDE impacts.
- All-character PI, up to six occupied planets, extraction estimates, factory nominal output, launchpad contents.
- All-character asset search, character/location filters, full ESI pagination, nested-container root locations.
- Background sync every 15 minutes, assets hourly; ESI response expiry respected. Failed categories retain previous complete snapshots and show an error.

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
Tokens are AES-256-GCM encrypted using ENCRYPTION_KEY, which must be backed up with the database. Sessions and invitations are hashed server-side. OAuth uses expiring single-use browser-bound state and PKCE; JWT issuer/audience/client/character-owner validation. Every private lookup is scoped to account ownership. Linking a character already held by another account is rejected. No automatic migration of transferred characters. Site admin can create invites but has no API to read other pilots' private data.

Data files live outside releases in /var/lib/stemp-tools. Back up tools.sqlite using SQLite online backup (or stop the service before copying it and its WAL), catalog.sqlite and the separately protected .env. Never commit them. Deleting an alt removes tokens and snapshots; EVE access can also be revoked in CCP's authorised applications page.

## Verification
Tests cover account isolation, CSRF, invites, OAuth replay, alt ownership, main deletion guard, encryption, partial sync retention, real SDE Avatar prerequisites, partial-SP estimates and PI output. Browser review uses fictional data. Actual EVE login/sync and VPS TLS deployment require the newly registered EVE application's credentials.

## Sources
- https://developers.eveonline.com/docs/services/sso/
- https://esi.evetech.net/meta/openapi.json?compatibility_date=2026-10-17
- https://developers.eveonline.com/docs/services/static-data/
- https://developers.eveonline.com/docs/guides/staticdata/


### Skill list import and Mercenary Dens (0.13.0)
New and edited skill plans support clipboard/text import: one English skill name and Roman numeral I–V (or number 1–5) per line. Repeated skills merge at the highest requested level; existing entries are preserved. Invalid lines reject the import without changing the editor. Saving still expands prerequisites.

Dens show totals across all linked characters, stored Infomorph Decryption Keys, EVE market-average estimated values (before fees), anarchy/development levels, workforce reduction and named MTOs with expiry timers. Prices are cached using ESI expiry headers; unavailable prices remain unknown rather than zero. MTO service failures no longer prevent den inventory syncing and are labelled incomplete. These are last-sync snapshots, not live inventory. Future spawn timestamps are not exposed by the currently supported ESI schema; no guessed spawn timer is presented as fact.

Workforce mapping: levels 0/1 = 0%, 2 = 10%, 3 = 20%, 4 = 40%, per [official Mercenary Den patch notes](https://www.eveonline.com/news/view/patch-notes-version-22-02). MTO names and effects come from the [official SDE](https://developers.eveonline.com/docs/guides/staticdata/).
