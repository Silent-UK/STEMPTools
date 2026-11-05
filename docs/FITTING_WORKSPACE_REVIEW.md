# Fitting calculation engine

Release v0.30.0 integrates VYRAJ's AGPL-3.0-only Dogma engine, with user approval. See vendor/vyraj/NOTICE.md for the upstream revision and integration changes; LICENSE contains the licence. The complete corresponding application source is downloadable by any signed-in user from Fitting Workbench → Corresponding Source. It contains code and build instructions, never private tokens, configuration or player data.

Supported calculations include ship/role bonuses, active skill levels, active implants, module states and effects, stacking, overheated bonuses, CPU/powergrid, shield/armor/hull HP and resistances, DPS/volley, uniform-profile EHP/tank, capacitor stability or lifetime, navigation and targeting. No selected pilot means All Skills V, labelled in the selector and panels. An unsynced selected pilot uses level zero with an explicit warning. Drone DPS counts launched drones only. Cost estimates use EVE-wide market averages and loaded magazine quantities.

Heat damage is an estimate: rack heat, adjacent module placement and live timing change burnout. Capacitor and damage are fitting projections, not guarantees of live combat outcomes. EHP/tank use uniform incoming damage. Use module state controls and loaded ammunition to reflect the intended fit.

## Rebuilding

- Node.js 24 or later: `npm run build:fitting-engine` transforms the included TypeScript sources to the checked-in runtime. No additional compiler package is needed.
- Python 3: `python scripts/build-fitting-data.py path/to/ccp-sde-jsonl.zip` rebuilds lib/fitting-dogma.json from CCP's public JSONL SDE. The checked-in data is sufficient to run the simulator without this refresh step.
- `npm test` rebuilds the corresponding-source ZIP using Node built-ins and runs checks. Run it after final code/docs changes so the source offer matches the deployed release.
- Existing application setup is documented in README.md and deploy/SETUP.md. Private .env and database files are not part of the source offer.

Only fitting engine dependencies were integrated; no other VYRAJ app modules were added. The Tools interface, saved fittings, private/shared permissions, mains/alt toggle, ESI imports and active-pilot selection remain native to this site.
