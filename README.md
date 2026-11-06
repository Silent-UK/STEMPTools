# STEMP Tools

Self-hosted EVE Online character and corporation tools for Sacred Templars and Sacred Templar Knights.

## Stack

- Backend: Node.js 24+ and Express.
- Database: SQLite, with encrypted EVE tokens and saved ESI snapshots.
- Frontend: vanilla JavaScript modules, HTML and CSS.
- Login and game data: EVE SSO and ESI, with background synchronisation.
- Hosting: Linux, Nginx and systemd. Deployment files are in `deploy/`.

## Features

Character dashboards, skills and training queues, clones, wallets, contracts, standings, ratting, mining, industry, blueprints, skill plans, fittings, Mercenary Dens, PI and assets. Corporation tools include structures, moon mining, regional drill income and moon surveys. Recruitment, groups, access controls, custom pages and Discord integration are included.

Displayed values use saved snapshots. Missing data stays labelled; ESI outages retain previous data and previously verified sessions. Estimated income is gross and subject to the assumptions shown on the page.

## Development

```sh
npm ci
# Download the official CCP JSONL SDE ZIP to data/sde.zip, then:
python scripts/import-sde.py data/sde.zip data
npm test
npm run check
node scripts/preview.mjs
```

The preview uses fictional data and a temporary database on `127.0.0.1:3014`. Production starts with `node --env-file=.env server.mjs`; see [deployment setup](deploy/SETUP.md). Keep private configuration, tokens and databases out of Git. Back up the database and its encryption key separately using the deployment guide.

## Documentation

- [Recruitment and access](docs/RECRUITMENT.md)
- [Discord setup](docs/DISCORD.md)
- [Custom pages](docs/PAGES.md)
- [Fitting engine and rebuilding](docs/FITTING_WORKSPACE_REVIEW.md)
- [Page healthcheck](docs/HEALTHCHECK.md)
- [Server-only ESI diagnostics](docs/ESI_DIAGNOSTICS.md)
- [Patch notes](docs/PATCH_NOTES.md)
- [Earlier release documentation](docs/RELEASE_HISTORY.md) — historical behaviour, not current setup instructions.

## Licence and data

Tools integrates the VYRAJ fitting engine under AGPL-3.0-only. Preserve [LICENSE](LICENSE) and [upstream attribution](vendor/vyraj/NOTICE.md). Signed-in users can download corresponding source from the fitting workspace. `npm test` rebuilds that archive before validation; regenerate it after final source or documentation changes.

Checked-in recipes, fitting runtime/data and moon datasets are required by the running application. Import and build scripts are retained so these assets can be reproduced or updated. Local databases, downloaded SDE archives, dependency folders and reference checkouts are excluded.

Official references: [EVE SSO](https://developers.eveonline.com/docs/services/sso/), [ESI](https://esi.evetech.net/), [CCP static data](https://developers.eveonline.com/docs/services/static-data/).
