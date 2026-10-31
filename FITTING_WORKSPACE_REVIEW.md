# Fitting workspace — local review

Approved for release as v0.29.0. STEMP automatically deploys main; NARVI remains Git-only until its separate live setup is ready.

The new entry is Fittings → Open Fitting Workbench. Saved fittings and in-game imports remain available. The workspace uses the site's themes, private/shared fitting permissions and account ownership checks. New saves are private; updating a fitting preserves its existing sharing setting. Shared fits can be opened and saved as private copies.

Included: hull/item search, slot groups, loaded ammunition validation, module states, drone/cargo quantities, launched drones, EFT import/export, existing saved fit loading, private saving, base CPU/powergrid/calibration/drone limits, base hull defense/capacitor/navigation, active skill requirements and optional EVE market average cost breakdown.

Calculation limits: this is a loadout editor with raw SDE figures, not a full Dogma simulator. Skills, ship bonuses, module modifiers, stacking penalties and overheat effects are not applied to performance. No DPS, EHP, active tank, applied-damage chart or capacitor depletion time is claimed. Pilot checks assess required active skills, not fitting legality. Costs use EVE-wide averages, not Jita sell minima. Loaded ammo contributes one charge per launcher to this estimate, explicitly labelled in the interface.

Inspiration: https://github.com/madalinmiclea/vyraj at 7ded46c522f9aebd45c3cda2d1eacf35b873f261. That repository declares AGPL-3.0-only. No upstream source, styling or assets were copied into this implementation. The clone in .reference-vyraj is ignored and is only a local reference. EVE item images come from CCP's existing image service.

Review: run `node scripts/preview.mjs` in STEMP Tools, then open http://127.0.0.1:3014, choose Fittings and open the workbench. The preview uses a disposable database with fictional pilots. Saving there does not change production data.
