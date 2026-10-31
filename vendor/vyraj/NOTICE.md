# VYRAJ fitting calculation engine

Copyright (C) 2026 Vyraj. Licensed under AGPL-3.0-only; see LICENSE.

Source: https://github.com/madalinmiclea/vyraj
Upstream revision: 7ded46c522f9aebd45c3cda2d1eacf35b873f261

This distribution includes only fitting calculation dependencies. Modifications by Tools: browser SDE fetch removed (the server provides local CCP data); English translation bridge reduced to fitting messages; module activation detection adapted for CCP's generic online effect (excluding it while including targeted activation); imports rewritten with explicit extensions and TypeScript transformed to JavaScript by scripts/build-fitting-engine.mjs. Original/adapted TypeScript is in src/ and generated runtime code in runtime/. Tools adapters and fitting UI are in lib/ and public/.

The corresponding source for this combined application, including modifications, is provided by the source link displayed in the fitting workspace. No ESI tokens, private databases or configuration secrets are part of the source distribution.
