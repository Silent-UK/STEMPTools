// Copyright (C) 2026 Vyraj. AGPL-3.0-only. Corresponding source: ../src/
import { Op } from './dogma.mjs';
const perLevel = (skill, attr)=>skill.base(skill.dogma.sde.attrId(attr)) * skill.get('skillLevel');
const MISSILE_DAMAGE = {
    missileEMDmgBonus: 'emDamage',
    missileExplosiveDmgBonus: 'explosiveDamage',
    missileThermalDmgBonus: 'thermalDamage',
    missileKineticDmgBonus2: 'kineticDamage'
};
function propulsion(withSignature) {
    return (dogma, mod, penalized)=>{
        const sde = dogma.sde;
        const ship = dogma.ship;
        ship.addModifier(sde.attrId('mass'), {
            source: mod,
            op: Op.ModAdd,
            fromAttr: sde.attrId('massAddition'),
            penalized: false
        });
        ship.addModifier(sde.attrId('maxVelocity'), {
            source: mod,
            op: Op.PostMul,
            penalized: false,
            value: ()=>1 + mod.get('speedFactor') * mod.get('speedBoostFactor') / ship.get('mass') / 100
        });
        if (withSignature) {
            ship.addModifier(sde.attrId('signatureRadius'), {
                source: mod,
                op: Op.PostPercent,
                fromAttr: sde.attrId('signatureRadiusBonus'),
                penalized
            });
        }
    };
}
const HANDLERS = {
    moduleBonusMicrowarpdrive: propulsion(true),
    moduleBonusAfterburner: propulsion(false),
    microJumpDrive: (dogma, mod, penalized)=>{
        dogma.ship.addModifier(dogma.sde.attrId('signatureRadius'), {
            source: mod,
            op: Op.PostPercent,
            fromAttr: dogma.sde.attrId('signatureRadiusBonusPercent'),
            penalized
        });
    },
    adaptiveArmorHardener: (dogma, mod, penalized)=>{
        for (const attr of [
            'armorEmDamageResonance',
            'armorThermalDamageResonance',
            'armorKineticDamageResonance',
            'armorExplosiveDamageResonance'
        ]){
            const id = dogma.sde.attrId(attr);
            dogma.ship.addModifier(id, {
                source: mod,
                op: Op.PreMul,
                fromAttr: id,
                penalized
            });
        }
    },
    ...Object.fromEntries(Object.entries(MISSILE_DAMAGE).map(([effect, attr])=>[
            effect,
            (dogma, skill)=>{
                const id = dogma.sde.attrId(attr);
                for (const charge of dogma.charges){
                    if (!charge.requiresSkill(skill.typeId)) continue;
                    charge.addModifier(id, {
                        source: skill,
                        op: Op.PostPercent,
                        penalized: false,
                        value: ()=>perLevel(skill, 'damageMultiplierBonus')
                    });
                }
            }
        ])),
    droneDmgBonus: (dogma, skill)=>{
        const id = dogma.sde.attrId('damageMultiplier');
        for (const { item } of dogma.drones){
            if (!item.requiresSkill(skill.typeId)) continue;
            item.addModifier(id, {
                source: skill,
                op: Op.PostPercent,
                penalized: false,
                value: ()=>perLevel(skill, 'damageMultiplierBonus')
            });
        }
    },
    selfRof: (dogma, skill)=>{
        const id = dogma.sde.attrId('speed');
        for (const mod of dogma.modules){
            if (!mod.requiresSkill(skill.typeId)) continue;
            mod.addModifier(id, {
                source: skill,
                op: Op.PostPercent,
                penalized: false,
                value: ()=>perLevel(skill, 'rofBonus')
            });
        }
    },
    slotModifier: (dogma, sub)=>{
        for (const [slot, from] of [
            [
                'hiSlots',
                'hiSlotModifier'
            ],
            [
                'medSlots',
                'medSlotModifier'
            ],
            [
                'lowSlots',
                'lowSlotModifier'
            ]
        ]){
            dogma.ship.addModifier(dogma.sde.attrId(slot), {
                source: sub,
                op: Op.ModAdd,
                fromAttr: dogma.sde.attrId(from),
                penalized: false
            });
        }
    },
    hardPointModifierEffect: (dogma, sub)=>{
        for (const [slot, from] of [
            [
                'turretSlotsLeft',
                'turretHardPointModifier'
            ],
            [
                'launcherSlotsLeft',
                'launcherHardPointModifier'
            ]
        ]){
            dogma.ship.addModifier(dogma.sde.attrId(slot), {
                source: sub,
                op: Op.ModAdd,
                fromAttr: dogma.sde.attrId(from),
                penalized: false
            });
        }
    }
};
export const OVERRIDDEN_EFFECTS = Object.keys(HANDLERS);
export function applyOverrides(dogma, item, effect, penalized) {
    HANDLERS[effect.name]?.(dogma, item, penalized);
}
