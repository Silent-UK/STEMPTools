// Copyright (C) 2026 Vyraj. AGPL-3.0-only. Corresponding source: ../src/
import { Category } from '../data/sde.mjs';
import { simulateCapacitor } from './capacitor.mjs';
import { slotCounts, SLOT_KINDS } from './fit.mjs';
import { tx } from '../i18n.mjs';
import { projectedCapCycles, projectedFlow } from './projected.mjs';
export const DAMAGE_TYPES = [
    'em',
    'thermal',
    'kinetic',
    'explosive'
];
const DAMAGE_ATTR = {
    em: 'emDamage',
    thermal: 'thermalDamage',
    kinetic: 'kineticDamage',
    explosive: 'explosiveDamage'
};
const zero = ()=>({
        em: 0,
        thermal: 0,
        kinetic: 0,
        explosive: 0
    });
const sum = (d)=>d.em + d.thermal + d.kinetic + d.explosive;
const scale = (d, k)=>({
        em: d.em * k,
        thermal: d.thermal * k,
        kinetic: d.kinetic * k,
        explosive: d.explosive * k
    });
const add = (a, b)=>({
        em: a.em + b.em,
        thermal: a.thermal + b.thermal,
        kinetic: a.kinetic + b.kinetic,
        explosive: a.explosive + b.explosive
    });
const isOnline = (m)=>m.state !== 'offline';
const isFighter = (sde, typeId)=>sde.types.get(typeId)?.categoryId === Category.Fighter;
export function resources(sde, fit, d) {
    const ship = d.ship;
    const counts = slotCounts(sde, fit, d);
    const mods = d.modules;
    const turrets = mods.filter((m)=>sde.hasEffect(m.typeId, 'turretFitted')).length;
    const launchers = mods.filter((m)=>sde.hasEffect(m.typeId, 'launcherFitted')).length;
    const activeDrones = d.drones.filter((x)=>!isFighter(sde, x.item.typeId)).reduce((a, x)=>a + x.item.get('droneBandwidthUsed') * x.count, 0);
    const volume = (typeId)=>sde.baseAttr(typeId, sde.attrId('volume'));
    const bayVolume = fit.drones.filter((x)=>!isFighter(sde, x.typeId)).reduce((a, x)=>a + volume(x.typeId) * x.count, 0);
    const squads = fit.drones.filter((x)=>isFighter(sde, x.typeId));
    const squadSize = (typeId)=>sde.baseAttr(typeId, sde.attrId('fighterSquadronMaxSize')) || 1;
    const fighterVolume = squads.reduce((a, x)=>a + volume(x.typeId) * squadSize(x.typeId) * x.count, 0);
    const launchedSquads = squads.filter((x)=>x.active > 0);
    const squadsOf = (attr)=>launchedSquads.filter((x)=>sde.baseAttr(x.typeId, sde.attrId(attr)) > 0).reduce((a, x)=>a + x.active, 0);
    const slots = Object.fromEntries(SLOT_KINDS.map((k)=>[
            k,
            {
                used: fit.slots[k].filter(Boolean).length,
                total: counts[k]
            }
        ]));
    return {
        cpu: {
            used: mods.filter(isOnline).reduce((a, m)=>a + m.get('cpu'), 0),
            total: ship.get('cpuOutput')
        },
        power: {
            used: mods.filter(isOnline).reduce((a, m)=>a + m.get('power'), 0),
            total: ship.get('powerOutput')
        },
        calibration: {
            used: mods.reduce((a, m)=>a + m.get('upgradeCost'), 0),
            total: ship.get('upgradeCapacity')
        },
        droneBandwidth: {
            used: activeDrones,
            total: ship.get('droneBandwidth')
        },
        droneBay: {
            used: bayVolume,
            total: ship.get('droneCapacity')
        },
        fighterBay: {
            used: fighterVolume,
            total: ship.get('fighterCapacity')
        },
        cargo: {
            used: fit.cargo.reduce((a, x)=>a + volume(x.typeId) * x.count, 0),
            total: ship.get('capacity')
        },
        fighterTubes: {
            used: launchedSquads.reduce((a, x)=>a + x.active, 0),
            total: Math.round(ship.get('fighterTubes'))
        },
        fighterLight: {
            used: squadsOf('fighterSquadronIsLight'),
            total: Math.round(ship.get('fighterLightSlots'))
        },
        fighterSupport: {
            used: squadsOf('fighterSquadronIsSupport'),
            total: Math.round(ship.get('fighterSupportSlots'))
        },
        fighterHeavy: {
            used: squadsOf('fighterSquadronIsHeavy'),
            total: Math.round(ship.get('fighterHeavySlots'))
        },
        turrets: {
            used: turrets,
            total: Math.round(ship.get('turretSlotsLeft'))
        },
        launchers: {
            used: launchers,
            total: Math.round(ship.get('launcherSlotsLeft'))
        },
        slots
    };
}
export function validate(sde, fit, d, r) {
    const out = [];
    const over = (res, label)=>{
        if (res.used > res.total + 1e-6) out.push(tx('{label} depășit: {used} / {total}', {
            label,
            used: round(res.used),
            total: round(res.total)
        }));
    };
    over(r.cpu, 'CPU');
    over(r.power, 'Powergrid');
    over(r.calibration, tx('Calibrare'));
    over(r.droneBandwidth, tx('Lățime de bandă drone'));
    over(r.droneBay, tx('Hangar drone'));
    over(r.fighterBay, tx('Hangar fighteri'));
    over(r.fighterTubes, tx('Tuburi fighteri'));
    over(r.fighterLight, tx('Fighteri ușori'));
    over(r.fighterSupport, tx('Fighteri de suport'));
    over(r.fighterHeavy, tx('Fighteri grei'));
    over(r.turrets, tx('Puncte de montaj turele'));
    over(r.launchers, tx('Puncte de montaj lansatoare'));
    const slotLabel = {
        high: tx('Sloturi high'),
        mid: tx('Sloturi medii'),
        low: tx('Sloturi low'),
        rig: tx('Sloturi rig'),
        subsystem: tx('Subsisteme')
    };
    for (const k of SLOT_KINDS)over(r.slots[k], slotLabel[k] ?? k);
    const maxDrones = d.character.get('maxActiveDrones');
    const launched = fit.drones.filter((x)=>!isFighter(sde, x.typeId)).reduce((a, x)=>a + x.active, 0);
    if (launched > maxDrones) out.push(tx('Prea multe drone lansate: {n} / {max} (skill-ul Drones)', {
        n: launched,
        max: maxDrones
    }));
    const byGroup = new Map();
    for (const m of d.modules)byGroup.set(m.groupId, (byGroup.get(m.groupId) ?? 0) + 1);
    for (const m of d.modules){
        const max = sde.baseAttr(m.typeId, sde.attrId('maxGroupFitted'));
        if (max > 0 && (byGroup.get(m.groupId) ?? 0) > max) {
            out.push(tx('Maxim {max} × {group} pe navă', {
                max,
                group: sde.groups.get(m.groupId)?.name ?? tx('grup')
            }));
            byGroup.set(m.groupId, 0);
        }
    }
    const activeByGroup = new Map();
    for (const m of d.modules.filter((x)=>x.state === 'active' || x.state === 'overheated'))activeByGroup.set(m.groupId, (activeByGroup.get(m.groupId) ?? 0) + 1);
    for (const [g, n] of activeByGroup){
        const sample = d.modules.find((m)=>m.groupId === g);
        const max = sde.baseAttr(sample.typeId, sde.attrId('maxGroupActive'));
        if (max > 0 && n > max) out.push(tx('Maxim {max} × {group} activ', {
            max,
            group: sde.groups.get(g)?.name ?? tx('grup')
        }));
    }
    return out;
}
const FIGHTER_ABILITIES = [
    {
        effect: 'fighterAbilityAttackM',
        prefix: 'fighterAbilityAttackMissileDamage',
        multiplier: 'fighterAbilityAttackMissileDamageMultiplier',
        duration: 'fighterAbilityAttackMissileDuration',
        range: 'fighterAbilityAttackMissileRangeOptimal'
    },
    {
        effect: 'fighterAbilityMissiles',
        prefix: 'fighterAbilityMissilesDamage',
        multiplier: 'fighterAbilityMissilesDamageMultiplier',
        duration: 'fighterAbilityMissilesDuration',
        range: 'fighterAbilityMissilesRange'
    }
];
const TURRET_EFFECTS = [
    'targetAttack',
    'projectileFired',
    'targetDisintegratorAttack',
    'ChainLightning'
];
function ownDamage(m) {
    const out = zero();
    for (const t of DAMAGE_TYPES)out[t] = m.get(DAMAGE_ATTR[t]);
    return out;
}
const even = (total)=>({
        em: total / 4,
        thermal: total / 4,
        kinetic: total / 4,
        explosive: total / 4
    });
function chargeDamage(charge) {
    const out = zero();
    if (!charge) return out;
    for (const t of DAMAGE_TYPES)out[t] = charge.get(DAMAGE_ATTR[t]);
    return out;
}
export function offense(sde, d) {
    const weapons = [];
    const push = (w)=>{
        const same = weapons.find((x)=>x.name === w.name && x.kind === w.kind);
        if (same) {
            same.count += w.count;
            same.volley = add(same.volley, w.volley);
            same.dps = add(same.dps, w.dps);
            if (w.startDps) same.startDps = add(same.startDps ?? zero(), w.startDps);
        } else weapons.push(w);
    };
    for (const m of d.modules){
        if (m.state !== 'active' && m.state !== 'overheated') continue;
        const label = m.other ? `${m.type.name} · ${m.other.type.name}` : m.type.name;
        const speed = m.get('speed') / 1000;
        const spool = m.has(sde.attrId('damageMultiplierBonusMax')) ? 1 + m.get('damageMultiplierBonusMax') : 1;
        if (speed > 0 && TURRET_EFFECTS.some((e)=>sde.hasEffect(m.typeId, e)) && m.other) {
            const volley = scale(chargeDamage(m.other), m.get('damageMultiplier'));
            const dps = scale(volley, 1 / speed);
            push({
                name: label,
                count: 1,
                kind: 'turret',
                volley,
                dps: scale(dps, spool),
                startDps: spool > 1 ? dps : undefined,
                range: m.get('maxRange'),
                falloff: m.get('falloff')
            });
        } else if (speed > 0 && sde.hasEffect(m.typeId, 'useMissiles') && m.other) {
            const dot = m.other.get('dotMaxDamagePerTick');
            if (dot > 0) {
                push({
                    name: label,
                    count: 1,
                    kind: 'missile',
                    volley: even(dot),
                    dps: even(dot)
                });
                continue;
            }
            const volley = scale(chargeDamage(m.other), d.character.get('missileDamageMultiplier'));
            const range = m.other.get('maxVelocity') * (m.other.get('explosionDelay') / 1000);
            push({
                name: label,
                count: 1,
                kind: 'missile',
                volley,
                dps: scale(volley, 1 / speed),
                range
            });
        } else if (!m.other) {
            const volley = scale(ownDamage(m), m.get('damageMultiplier') || 1);
            const cycle = speed || m.get('duration') / 1000;
            if (sum(volley) > 0 && cycle > 0) push({
                name: label,
                count: 1,
                kind: 'module',
                volley,
                dps: scale(volley, 1 / cycle)
            });
        }
    }
    for (const { item, count } of d.drones){
        if (isFighter(sde, item.typeId)) {
            const size = item.get('fighterSquadronMaxSize') || 1;
            let volley = zero();
            let dps = zero();
            let range = 0;
            for (const ab of FIGHTER_ABILITIES){
                if (!sde.hasEffect(item.typeId, ab.effect)) continue;
                const seconds = item.get(ab.duration) / 1000;
                if (seconds <= 0) continue;
                const v = scale({
                    em: item.get(ab.prefix + 'EM'),
                    thermal: item.get(ab.prefix + 'Therm'),
                    kinetic: item.get(ab.prefix + 'Kin'),
                    explosive: item.get(ab.prefix + 'Exp')
                }, (item.get(ab.multiplier) || 1) * size * count);
                volley = add(volley, v);
                dps = add(dps, scale(v, 1 / seconds));
                range = Math.max(range, ab.range ? item.get(ab.range) : 0);
            }
            if (sum(dps) > 0) push({
                name: item.type.name,
                count,
                kind: 'fighter',
                volley,
                dps,
                range: range || undefined
            });
            continue;
        }
        if (!sde.hasEffect(item.typeId, 'targetAttack') && !sde.hasEffect(item.typeId, 'projectileFired')) continue;
        const cycle = item.get('speed') / 1000;
        if (cycle <= 0) continue;
        const volley = scale(chargeDamage(item), item.get('damageMultiplier') * count);
        push({
            name: item.type.name,
            count,
            kind: 'drone',
            volley,
            dps: scale(volley, 1 / cycle),
            range: item.get('maxRange')
        });
    }
    const weaponDps = weapons.filter((w)=>w.kind !== 'drone' && w.kind !== 'fighter').reduce((a, w)=>a + sum(w.dps), 0);
    const droneDps = weapons.filter((w)=>w.kind === 'drone' || w.kind === 'fighter').reduce((a, w)=>a + sum(w.dps), 0);
    return {
        weapons,
        weaponDps,
        droneDps,
        totalDps: weaponDps + droneDps,
        startDps: weapons.reduce((a, w)=>a + sum(w.startDps ?? w.dps), 0),
        totalVolley: weapons.reduce((a, w)=>a + sum(w.volley), 0),
        dps: weapons.reduce((a, w)=>add(a, w.dps), zero())
    };
}
export const LAYERS = [
    'shield',
    'armor',
    'hull'
];
export const RESONANCE = {
    shield: {
        em: 'shieldEmDamageResonance',
        thermal: 'shieldThermalDamageResonance',
        kinetic: 'shieldKineticDamageResonance',
        explosive: 'shieldExplosiveDamageResonance'
    },
    armor: {
        em: 'armorEmDamageResonance',
        thermal: 'armorThermalDamageResonance',
        kinetic: 'armorKineticDamageResonance',
        explosive: 'armorExplosiveDamageResonance'
    },
    hull: {
        em: 'emDamageResonance',
        thermal: 'thermalDamageResonance',
        kinetic: 'kineticDamageResonance',
        explosive: 'explosiveDamageResonance'
    }
};
export const HP_ATTR = {
    shield: 'shieldCapacity',
    armor: 'armorHP',
    hull: 'hp'
};
export function profileWeights(p) {
    const total = p.em + p.thermal + p.kinetic + p.explosive || 1;
    return {
        em: p.em / total,
        thermal: p.thermal / total,
        kinetic: p.kinetic / total,
        explosive: p.explosive / total
    };
}
export function defense(sde, d, profile) {
    const ship = d.ship;
    const w = profileWeights(profile);
    const layers = {};
    const factor = {};
    for (const l of LAYERS){
        const res = zero();
        let f = 0;
        for (const t of DAMAGE_TYPES){
            const resonance = ship.get(RESONANCE[l][t]);
            res[t] = 1 - resonance;
            f += w[t] * resonance;
        }
        factor[l] = f || 1;
        const hp = ship.get(HP_ATTR[l]);
        layers[l] = {
            hp,
            resists: res,
            ehp: hp / factor[l]
        };
    }
    const repairs = {
        shield: {
            raw: 0,
            effective: 0
        },
        armor: {
            raw: 0,
            effective: 0
        },
        hull: {
            raw: 0,
            effective: 0
        }
    };
    for (const m of d.modules){
        if (m.state !== 'active' && m.state !== 'overheated') continue;
        const cycle = m.get('duration') / 1000;
        if (cycle <= 0) continue;
        if (sde.hasEffect(m.typeId, 'shieldBoosting') || sde.hasEffect(m.typeId, 'fueledShieldBoosting')) {
            repairs.shield.raw += m.get('shieldBonus') / cycle;
        } else if (sde.hasEffect(m.typeId, 'armorRepair')) {
            repairs.armor.raw += m.get('armorDamageAmount') / cycle;
        } else if (sde.hasEffect(m.typeId, 'fueledArmorRepair')) {
            const paste = m.other ? m.get('chargedArmorDamageMultiplier') || 1 : 1;
            repairs.armor.raw += m.get('armorDamageAmount') * paste / cycle;
        } else if (sde.hasEffect(m.typeId, 'structureRepair')) {
            repairs.hull.raw += m.get('structureDamageAmount') / cycle;
        }
    }
    const flow = projectedFlow(d);
    repairs.shield.raw += flow.shield;
    repairs.armor.raw += flow.armor;
    repairs.hull.raw += flow.hull;
    for (const l of LAYERS)repairs[l].effective = repairs[l].raw / factor[l];
    const rechargeSec = ship.get('shieldRechargeRate') / 1000;
    const passiveRaw = rechargeSec > 0 ? 2.5 * layers.shield.hp / rechargeSec : 0;
    const passiveShield = {
        raw: passiveRaw,
        effective: passiveRaw / factor.shield
    };
    return {
        layers,
        hp: LAYERS.reduce((a, l)=>a + layers[l].hp, 0),
        ehp: LAYERS.reduce((a, l)=>a + layers[l].ehp, 0),
        repairs,
        passiveShield,
        activeTank: LAYERS.reduce((a, l)=>a + repairs[l].effective, 0)
    };
}
export function capacitor(sde, d) {
    const ship = d.ship;
    const drains = [];
    const cycles = [];
    for (const m of d.modules){
        if (m.state !== 'active' && m.state !== 'overheated') continue;
        const effect = activeEffect(sde, m);
        if (!effect) continue;
        const duration = effect.durationAttributeId ? m.attr(effect.durationAttributeId) / 1000 : 0;
        if (duration <= 0) continue;
        const need = effect.dischargeAttributeId ? m.attr(effect.dischargeAttributeId) : 0;
        if (need !== 0) {
            drains.push({
                name: m.type.name,
                perSecond: need / duration
            });
            cycles.push({
                need,
                duration
            });
        }
        if (effect.name === 'powerBooster' && m.other) {
            drains.push({
                name: `${m.type.name} · ${m.other.type.name}`,
                perSecond: -m.other.get('capacitorBonus') / duration
            });
            cycles.push({
                need: -m.other.get('capacitorBonus'),
                duration
            });
        }
    }
    for (const p of projectedCapCycles(d)){
        drains.push({
            name: p.name,
            perSecond: p.need / p.duration
        });
        cycles.push({
            need: p.need,
            duration: p.duration
        });
    }
    const usage = drains.reduce((a, x)=>a + x.perSecond, 0);
    const grossUsage = drains.reduce((a, x)=>a + Math.max(0, x.perSecond), 0);
    const result = simulateCapacitor(ship.get('capacitorCapacity'), ship.get('rechargeRate') / 1000, usage, cycles);
    return {
        ...result,
        drains,
        grossUsage
    };
}
function activeEffect(sde, m) {
    return m.type.effects.map((id)=>sde.effects.get(id)).find((e)=>e && (e.category === 1 || e.category === 2) && e.durationAttributeId);
}
export function navigation(d) {
    const ship = d.ship;
    const mass = ship.get('mass');
    const agility = ship.get('agility');
    return {
        maxVelocity: ship.get('maxVelocity'),
        mass,
        agility,
        alignTime: -Math.log(0.25) * agility * mass / 1e6,
        warpSpeed: ship.get('warpSpeedMultiplier') * ship.get('baseWarpSpeed'),
        signatureRadius: ship.get('signatureRadius')
    };
}
export function targeting(d) {
    const ship = d.ship;
    const sensors = [
        [
            'Radar',
            ship.get('scanRadarStrength')
        ],
        [
            'Ladar',
            ship.get('scanLadarStrength')
        ],
        [
            'Magnetometric',
            ship.get('scanMagnetometricStrength')
        ],
        [
            'Gravimetric',
            ship.get('scanGravimetricStrength')
        ]
    ];
    const [sensorType, sensorStrength] = sensors.reduce((a, b)=>b[1] > a[1] ? b : a);
    return {
        maxRange: Math.min(ship.get('maxTargetRange'), ship.get('maximumRangeCap') || Infinity),
        scanResolution: ship.get('scanResolution'),
        maxLocked: Math.min(ship.get('maxLockedTargets'), d.character.get('maxLockedTargets') || Infinity),
        sensorStrength,
        sensorType
    };
}
export function lockTime(scanResolution, targetSignature) {
    if (!scanResolution || !targetSignature) return 0;
    return Math.min(40000 / scanResolution / Math.asinh(targetSignature) ** 2, 1800);
}
export function heat(d) {
    return d.modules.filter((m)=>m.state === 'overheated').map((m)=>{
        const damage = m.get('heatDamage');
        const hp = m.get('hp');
        const cycle = (m.get('speed') || m.get('duration')) / 1000;
        return {
            name: m.type.name,
            slotKey: m.slotKey ?? '',
            damage,
            hp,
            cycle,
            cycles: damage > 0 ? Math.ceil(hp / damage) : Infinity
        };
    });
}
export function computeStats(sde, fit, d, profile) {
    const res = resources(sde, fit, d);
    return {
        resources: res,
        warnings: validate(sde, fit, d, res),
        offense: offense(sde, d),
        defense: defense(sde, d, profile),
        capacitor: capacitor(sde, d),
        navigation: navigation(d),
        targeting: targeting(d),
        heat: heat(d)
    };
}
export function isWeaponOrDroneCategory(categoryId) {
    return categoryId === Category.Drone || categoryId === Category.Fighter;
}
function round(n) {
    return Math.round(n * 100) / 100;
}
