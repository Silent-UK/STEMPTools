// Copyright (C) 2026 Vyraj. AGPL-3.0-only. Corresponding source: ../src/
import { Category } from '../data/sde.mjs';
import { Dogma, Op } from './dogma.mjs';
const allFiveCache = new WeakMap();
function allFive(sde) {
    let skills = allFiveCache.get(sde);
    if (!skills) {
        skills = new Map(sde.typesInCategory(Category.Skill).map((t)=>[
                t.id,
                5
            ]));
        allFiveCache.set(sde, skills);
    }
    return skills;
}
export function projectedSource(sde, list) {
    return new Dogma(sde, {
        shipId: 0,
        skills: allFive(sde),
        modules: list.map((p, i)=>({
                typeId: p.typeId,
                state: 'active',
                chargeId: p.chargeId,
                slotKey: `proj${i}`
            }))
    });
}
function resistance(target, source, effect) {
    const sde = target.sde;
    const id = effect.resistanceAttributeId ?? (sde.hasAttr('remoteResistanceID') ? source.get('remoteResistanceID') : 0);
    return id > 0 && sde.attributes.has(id) ? target.ship.attr(id) : 1;
}
function boost(item, attr, value, source) {
    const sde = item.dogma.sde;
    if (!sde.hasAttr(attr) || !value) return;
    item.addModifier(sde.attrId(attr), {
        source,
        op: Op.PostPercent,
        value: ()=>value,
        penalized: true
    });
}
const shipBoost = (pairs, offensive)=>(target, source, effect, count)=>{
        const res = offensive ? resistance(target, source, effect) : 1;
        for(let i = 0; i < count; i++)for (const [src, tgt] of pairs)boost(target.ship, tgt, source.get(src) * res, source);
    };
const turretBoost = (offensive)=>(target, source, effect, count)=>{
        const res = offensive ? resistance(target, source, effect) : 1;
        const gunnery = target.sde.findType('Gunnery')?.id ?? 0;
        for (const m of target.modules){
            if (!m.requiresSkill(gunnery)) continue;
            for(let i = 0; i < count; i++){
                for (const [src, tgt] of [
                    [
                        'trackingSpeedBonus',
                        'trackingSpeed'
                    ],
                    [
                        'maxRangeBonus',
                        'maxRange'
                    ],
                    [
                        'falloffBonus',
                        'falloff'
                    ]
                ])boost(m, tgt, source.get(src) * res, source);
            }
        }
    };
const HANDLERS = {
    remoteWebifierFalloff: shipBoost([
        [
            'speedFactor',
            'maxVelocity'
        ]
    ], true),
    remoteTargetPaintFalloff: shipBoost([
        [
            'signatureRadiusBonus',
            'signatureRadius'
        ]
    ], true),
    remoteSensorDampFalloff: shipBoost([
        [
            'maxTargetRangeBonus',
            'maxTargetRange'
        ],
        [
            'scanResolutionBonus',
            'scanResolution'
        ]
    ], true),
    remoteSensorBoostFalloff: shipBoost([
        [
            'maxTargetRangeBonus',
            'maxTargetRange'
        ],
        [
            'scanResolutionBonus',
            'scanResolution'
        ],
        [
            'scanGravimetricStrengthPercent',
            'scanGravimetricStrength'
        ],
        [
            'scanMagnetometricStrengthPercent',
            'scanMagnetometricStrength'
        ],
        [
            'scanRadarStrengthPercent',
            'scanRadarStrength'
        ],
        [
            'scanLadarStrengthPercent',
            'scanLadarStrength'
        ]
    ], false),
    shipModuleTrackingDisruptor: turretBoost(true),
    shipModuleRemoteTrackingComputer: turretBoost(false),
    shipModuleGuidanceDisruptor: (target, source, effect, count)=>{
        const res = resistance(target, source, effect);
        const mlo = target.sde.findType('Missile Launcher Operation')?.id ?? 0;
        for (const c of target.charges){
            if (!c.requiresSkill(mlo)) continue;
            for(let i = 0; i < count; i++){
                for (const [src, tgt] of [
                    [
                        'aoeCloudSizeBonus',
                        'aoeCloudSize'
                    ],
                    [
                        'aoeVelocityBonus',
                        'aoeVelocity'
                    ],
                    [
                        'missileVelocityBonus',
                        'maxVelocity'
                    ],
                    [
                        'explosionDelayBonus',
                        'explosionDelay'
                    ]
                ])boost(c, tgt, source.get(src) * res, source);
            }
        }
    }
};
export function applyProjected(target, list) {
    const source = projectedSource(target.sde, list);
    list.forEach((p, i)=>{
        const item = source.modules.find((m)=>m.slotKey === `proj${i}`);
        if (!item || p.count <= 0) return;
        target.projected.push({
            item,
            count: p.count
        });
    });
    for (const { item, count } of target.projected){
        for (const effectId of item.type.effects){
            const effect = target.sde.effects.get(effectId);
            if (effect) HANDLERS[effect.name]?.(target, item, effect, count);
        }
    }
}
export function projectedFlow(d) {
    const out = {
        shield: 0,
        armor: 0,
        hull: 0,
        capIn: 0,
        capOut: 0
    };
    const has = (item, name)=>item.dogma.sde.hasEffect(item.typeId, name);
    for (const { item, count } of d.projected){
        const seconds = item.get('duration') / 1000;
        if (seconds <= 0) continue;
        const per = (attr)=>item.get(attr) * count / seconds;
        if (has(item, 'shipModuleRemoteShieldBooster') || has(item, 'shipModuleAncillaryRemoteShieldBooster')) out.shield += per('shieldBonus');
        if (has(item, 'shipModuleRemoteArmorRepairer') || has(item, 'shipModuleAncillaryRemoteArmorRepairer') || has(item, 'ShipModuleRemoteArmorMutadaptiveRepairer')) out.armor += per('armorDamageAmount');
        if (has(item, 'shipModuleRemoteHullRepairer')) out.hull += per('structureDamageAmount');
        if (has(item, 'shipModuleRemoteCapacitorTransmitter')) out.capIn += per('powerTransferAmount');
        if (has(item, 'energyNeutralizerFalloff')) {
            const e = d.sde.effects.get(d.sde.effectId('energyNeutralizerFalloff'));
            out.capOut += per('energyNeutralizerAmount') * resistance(d, item, e);
        }
        if (has(item, 'energyNosferatuFalloff')) out.capOut += per('powerTransferAmount');
    }
    return out;
}
export function projectedCapCycles(d) {
    const out = [];
    const has = (item, name)=>d.sde.hasEffect(item.typeId, name);
    for (const { item, count } of d.projected){
        const duration = item.get('duration') / 1000;
        if (duration <= 0) continue;
        const name = count > 1 ? `${item.type.name} ×${count}` : item.type.name;
        if (has(item, 'shipModuleRemoteCapacitorTransmitter')) out.push({
            name,
            need: -item.get('powerTransferAmount') * count,
            duration
        });
        if (has(item, 'energyNeutralizerFalloff')) {
            const e = d.sde.effects.get(d.sde.effectId('energyNeutralizerFalloff'));
            out.push({
                name,
                need: item.get('energyNeutralizerAmount') * resistance(d, item, e) * count,
                duration
            });
        }
        if (has(item, 'energyNosferatuFalloff')) out.push({
            name,
            need: item.get('powerTransferAmount') * count,
            duration
        });
    }
    return out;
}
export function isProjectable(sde, typeId) {
    const t = sde.types.get(typeId);
    if (!t || t.categoryId !== Category.Module) return false;
    return t.effects.some((id)=>{
        const n = sde.effects.get(id)?.name ?? '';
        return n in HANDLERS || /RemoteShieldBooster|RemoteArmor|RemoteHullRepairer|RemoteCapacitorTransmitter|energyNeutralizerFalloff|energyNosferatuFalloff/i.test(n);
    });
}
