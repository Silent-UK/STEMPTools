// Copyright (C) 2026 Vyraj. AGPL-3.0-only. Corresponding source: ../src/
import { Category } from '../data/sde.mjs';
import { applyOverrides } from './overrides.mjs';
import { applyProjected } from './projected.mjs';
import { fleetBuffs } from './fleet.mjs';
export const Op = {
    PreAssign: -1,
    PreMul: 0,
    PreDiv: 1,
    ModAdd: 2,
    ModSub: 3,
    PostMul: 4,
    PostDiv: 5,
    PostPercent: 6,
    PostAssign: 7
};
const OP_ORDER = [
    Op.PreAssign,
    Op.PreMul,
    Op.PreDiv,
    Op.ModAdd,
    Op.ModSub,
    Op.PostMul,
    Op.PostDiv,
    Op.PostPercent,
    Op.PostAssign
];
const PENALTY_EXEMPT = new Set([
    Category.Ship,
    Category.Charge,
    Category.Skill,
    Category.Implant,
    Category.Subsystem
]);
export const EffectCategory = {
    Passive: 0,
    Active: 1,
    Target: 2,
    Area: 3,
    Online: 4,
    Overload: 5
};
const STATE_LEVEL = {
    offline: 0,
    online: 1,
    active: 2,
    overheated: 3
};
const PENALTY_DENOM = 2.67 ** 2;
export function stackingFactor(index) {
    return Math.exp(-(index * index) / PENALTY_DENOM);
}
export function penalizedProduct(multipliers) {
    const up = multipliers.filter((m)=>m > 1).sort((a, b)=>b - a);
    const down = multipliers.filter((m)=>m < 1).sort((a, b)=>a - b);
    let result = 1;
    for (const list of [
        up,
        down
    ]){
        list.forEach((m, i)=>{
            result *= 1 + (m - 1) * stackingFactor(i);
        });
    }
    return result;
}
export class DogmaItem {
    dogma;
    typeId;
    kind;
    state;
    slotKey;
    modifiers = new Map();
    cache = new Map();
    computing = new Set();
    baseOverrides = new Map();
    other;
    label;
    constructor(dogma, typeId, kind, state = 'online', slotKey){
        this.dogma = dogma;
        this.typeId = typeId;
        this.kind = kind;
        this.state = state;
        this.slotKey = slotKey;
    }
    get type() {
        return this.dogma.sde.type(this.typeId);
    }
    get categoryId() {
        return this.dogma.sde.types.get(this.typeId)?.categoryId ?? 0;
    }
    get groupId() {
        return this.dogma.sde.types.get(this.typeId)?.groupId ?? 0;
    }
    base(attrId) {
        return this.baseOverrides.get(attrId) ?? this.dogma.sde.baseAttr(this.typeId, attrId);
    }
    addModifier(attrId, mod) {
        const list = this.modifiers.get(attrId);
        if (list) list.push(mod);
        else this.modifiers.set(attrId, [
            mod
        ]);
    }
    attr(attrId) {
        const cached = this.cache.get(attrId);
        if (cached != null) return cached;
        if (this.computing.has(attrId)) return this.base(attrId);
        this.computing.add(attrId);
        try {
            const value = this.compute(attrId);
            this.cache.set(attrId, value);
            return value;
        } finally{
            this.computing.delete(attrId);
        }
    }
    get(name) {
        return this.attr(this.dogma.sde.attrId(name));
    }
    trace(attrId) {
        const steps = [];
        const base = this.base(attrId);
        const value = this.compute(attrId, steps);
        return {
            base,
            steps,
            value
        };
    }
    compute(attrId, steps) {
        let value = this.base(attrId);
        const step = (source, next, mult = false)=>{
            steps?.push({
                source,
                before: value,
                after: next,
                mult
            });
            value = next;
        };
        const mods = this.modifiers.get(attrId);
        if (mods?.length) {
            const stackable = this.dogma.sde.attributes.get(attrId)?.stackable ?? true;
            for (const op of OP_ORDER){
                const ofOp = mods.filter((m)=>m.op === op);
                if (!ofOp.length) continue;
                const values = ofOp.map((m)=>m.value ? m.value() : m.source.attr(m.fromAttr));
                switch(op){
                    case Op.PreAssign:
                    case Op.PostAssign:
                        step(ofOp[ofOp.length - 1].source, values[values.length - 1]);
                        break;
                    case Op.ModAdd:
                        ofOp.forEach((m, i)=>step(m.source, value + values[i]));
                        break;
                    case Op.ModSub:
                        ofOp.forEach((m, i)=>step(m.source, value - values[i]));
                        break;
                    default:
                        {
                            const toMult = (v)=>op === Op.PostPercent ? 1 + v / 100 : op === Op.PreDiv || op === Op.PostDiv ? v === 0 ? 1 : 1 / v : v;
                            const penalized = [];
                            ofOp.forEach((m, i)=>{
                                const mult = toMult(values[i]);
                                if (m.penalized && !stackable) penalized.push({
                                    source: m.source,
                                    mult
                                });
                                else step(m.source, value * mult, true);
                            });
                            const up = penalized.filter((x)=>x.mult > 1).sort((a, b)=>b.mult - a.mult);
                            const down = penalized.filter((x)=>x.mult < 1).sort((a, b)=>a.mult - b.mult);
                            for (const list of [
                                up,
                                down
                            ]){
                                list.forEach((x, i)=>step(x.source, value * (1 + (x.mult - 1) * stackingFactor(i)), true));
                            }
                        }
                }
            }
        }
        const maxId = this.dogma.sde.attributes.get(attrId)?.maxAttributeId;
        if (maxId != null && maxId !== attrId && this.has(maxId)) value = Math.min(value, this.attr(maxId));
        return value;
    }
    has(attrId) {
        return this.baseOverrides.has(attrId) || (this.dogma.sde.types.get(this.typeId)?.attrs.has(attrId) ?? false);
    }
    requiresSkill(skillId) {
        return this.dogma.requiredSkillIds(this.typeId).includes(skillId);
    }
    invalidate() {
        this.cache.clear();
    }
}
const UNPENALIZED_BUFFS = new Set([
    11,
    12,
    14,
    15,
    19,
    42,
    48
]);
export function isBoosterSideEffect(name) {
    return /^booster.*Penalty/.test(name);
}
const REQ_SKILL_ATTRS = [
    'requiredSkill1',
    'requiredSkill2',
    'requiredSkill3',
    'requiredSkill4',
    'requiredSkill5',
    'requiredSkill6'
];
export class Dogma {
    sde;
    ship;
    character;
    skills = [];
    implants = [];
    modules = [];
    charges = [];
    drones = [];
    mode;
    buffSources = [];
    projected = [];
    reqSkillCache = new Map();
    boosterSides;
    constructor(sde, input){
        this.sde = sde;
        this.boosterSides = input.boosterSides ?? {};
        this.ship = new DogmaItem(this, input.shipId, 'ship');
        this.character = new DogmaItem(this, 0, 'character');
        this.character.baseOverrides.set(sde.attrId('maxLockedTargets'), 2);
        for (const [skillId, level] of input.skills){
            if (!sde.types.has(skillId)) continue;
            const skill = new DogmaItem(this, skillId, 'skill');
            skill.baseOverrides.set(sde.attrId('skillLevel'), level);
            this.skills.push(skill);
        }
        for (const id of input.implants ?? [])if (sde.types.has(id)) this.implants.push(new DogmaItem(this, id, 'implant'));
        for (const m of input.modules){
            if (!sde.types.has(m.typeId)) continue;
            const mod = new DogmaItem(this, m.typeId, 'module', m.state, m.slotKey);
            for (const [attr, v] of Object.entries(m.overrides ?? {}))mod.baseOverrides.set(Number(attr), v);
            this.modules.push(mod);
            if (m.chargeId && sde.types.has(m.chargeId)) {
                const charge = new DogmaItem(this, m.chargeId, 'charge', m.state, m.slotKey);
                charge.other = mod;
                mod.other = charge;
                this.charges.push(charge);
            }
        }
        for (const d of input.drones ?? []){
            if (!sde.types.has(d.typeId) || d.count <= 0) continue;
            this.drones.push({
                item: new DogmaItem(this, d.typeId, 'drone', 'active'),
                count: d.count
            });
        }
        if (input.mode && sde.types.has(input.mode)) this.mode = new DogmaItem(this, input.mode, 'mode');
        this.applyAll();
        this.applyBuffs([
            ...input.buffs ?? [],
            ...fleetBuffs(sde, input.fleet),
            ...this.ownBuffs()
        ]);
        for (const item of this.allItems)item.invalidate();
        if (input.projected?.length) applyProjected(this, input.projected);
    }
    ownBuffs() {
        const out = [];
        for (const m of this.modules){
            if (m.state !== 'active' && m.state !== 'overheated' || !m.other) continue;
            for(let n = 1; n <= 4; n++){
                const idName = `warfareBuff${n}ID`, valueName = `warfareBuff${n}Value`;
                if (!this.sde.hasAttr(idName) || !this.sde.hasAttr(valueName)) continue;
                const id = m.get(idName);
                if (id > 0) out.push({
                    id,
                    value: m.get(valueName),
                    label: m.type.name
                });
            }
        }
        return out;
    }
    applyBuffs(buffs) {
        const best = new Map();
        for (const b of buffs){
            const def = this.sde.buffs.get(b.id);
            if (!def) continue;
            const prev = best.get(b.id);
            const better = prev == null || (def.agg === 'Minimum' ? b.value < prev.value : b.value > prev.value);
            if (better) best.set(b.id, {
                value: b.value,
                label: b.label
            });
        }
        for (const [id, { value, label }] of best){
            const def = this.sde.buffs.get(id);
            const op = {
                PostPercent: Op.PostPercent,
                PostMul: Op.PostMul,
                PostAssignment: Op.PostAssign,
                ModAdd: Op.ModAdd,
                PreAssignment: Op.PreAssign
            }[def.op];
            if (op == null) continue;
            const source = new DogmaItem(this, 0, 'buff');
            source.label = label;
            this.buffSources.push(source);
            const mod = {
                source,
                op,
                value: ()=>value,
                penalized: !UNPENALIZED_BUFFS.has(id)
            };
            const located = this.shipLocated;
            for (const attr of def.item)this.ship.addModifier(attr, mod);
            for (const attr of def.loc)for (const x of located)x.addModifier(attr, mod);
            for (const [attr, group] of def.locGroup)for (const x of located)if (x.groupId === group) x.addModifier(attr, mod);
            for (const [attr, skill] of def.locSkill)for (const x of located)if (x.requiresSkill(skill)) x.addModifier(attr, mod);
        }
    }
    requiredSkillIds(typeId) {
        let list = this.reqSkillCache.get(typeId);
        if (!list) {
            list = REQ_SKILL_ATTRS.map((n)=>this.sde.types.get(typeId)?.attrs.get(this.sde.attrId(n)) ?? 0).filter((x)=>x > 0);
            this.reqSkillCache.set(typeId, list);
        }
        return list;
    }
    get allItems() {
        return [
            this.ship,
            this.character,
            ...this.skills,
            ...this.implants,
            ...this.modules,
            ...this.charges,
            ...this.drones.map((d)=>d.item),
            ...this.mode ? [
                this.mode
            ] : []
        ];
    }
    get shipLocated() {
        return [
            ...this.modules,
            ...this.charges
        ];
    }
    get owned() {
        return [
            ...this.charges,
            ...this.drones.map((d)=>d.item)
        ];
    }
    isEffectActive(item, effect) {
        if (effect.name === 'skillEffect' || effect.name === 'online') return false;
        const level = STATE_LEVEL[item.state];
        switch(item.kind){
            case 'module':
                {
                    const always = item.categoryId === Category.Subsystem || item.slotKey?.startsWith('rig');
                    const lvl = always ? Math.max(level, 1) : level;
                    if (effect.category === EffectCategory.Passive || effect.category === EffectCategory.Online) return lvl >= 1;
                    if (effect.category === EffectCategory.Active) return lvl >= 2;
                    if (effect.category === EffectCategory.Overload) return lvl >= 3;
                    return false;
                }
            case 'charge':
                return effect.category === EffectCategory.Passive && level >= 1;
            default:
                return effect.category === EffectCategory.Passive;
        }
    }
    targets(source, m) {
        const bySkill = (list)=>{
            const skill = m.s === -1 ? source.typeId : m.s;
            return skill ? list.filter((x)=>x.requiresSkill(skill)) : [];
        };
        const located = m.d === 'shipID' ? this.shipLocated : m.d === 'charID' ? this.implants : [];
        switch(m.f){
            case 'ItemModifier':
                switch(m.d){
                    case 'itemID':
                        return [
                            source
                        ];
                    case 'shipID':
                        return [
                            this.ship
                        ];
                    case 'charID':
                        return [
                            this.character
                        ];
                    case 'otherID':
                        return source.other ? [
                            source.other
                        ] : [];
                    default:
                        return [];
                }
            case 'LocationModifier':
                return located;
            case 'LocationGroupModifier':
                return located.filter((x)=>x.groupId === m.g);
            case 'LocationRequiredSkillModifier':
                return bySkill(located);
            case 'OwnerRequiredSkillModifier':
                return m.d === 'charID' ? bySkill(this.owned) : [];
            default:
                return [];
        }
    }
    applyAll() {
        for (const item of this.allItems){
            if (!item.typeId) continue;
            const penalized = !PENALTY_EXEMPT.has(item.categoryId);
            for (const effectId of item.type.effects){
                const effect = this.sde.effects.get(effectId);
                if (!effect || !this.isEffectActive(item, effect)) continue;
                if (item.kind === 'implant' && isBoosterSideEffect(effect.name) && !this.boosterSides[item.typeId]?.includes(effect.name)) continue;
                for (const m of effect.modifiers){
                    if (m.op == null || m.to == null || m.from == null) continue;
                    for (const target of this.targets(item, m)){
                        target.addModifier(m.to, {
                            source: item,
                            op: m.op,
                            fromAttr: m.from,
                            penalized
                        });
                    }
                }
                applyOverrides(this, item, effect, penalized);
            }
        }
    }
}
