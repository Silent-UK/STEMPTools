// Copyright (C) 2026 Vyraj. AGPL-3.0-only. Corresponding source: ../src/
import { fold } from '../ui/fold.mjs';
import { tx } from '../i18n.mjs';
export const Category = {
    Ship: 6,
    Module: 7,
    Charge: 8,
    Skill: 16,
    Drone: 18,
    Implant: 20,
    Subsystem: 32,
    Fighter: 87
};
export const MODE_GROUP = 1306;
export class Sde {
    build;
    types = new Map();
    attributes = new Map();
    effects = new Map();
    groups = new Map();
    units;
    cloneGrades;
    mutaplasmids = new Map();
    buffs = new Map();
    weathers;
    mutaplasmidsByBase = new Map();
    abyssalBase = new Map();
    attrByName = new Map();
    effectByName = new Map();
    typeByName = new Map();
    constructor(raw){
        this.build = raw.version.build;
        for (const g of raw.groups)this.groups.set(g.i, {
            id: g.i,
            name: g.n,
            categoryId: g.c
        });
        for (const a of raw.attributes){
            this.attributes.set(a.i, {
                id: a.i,
                name: a.n,
                displayName: a.dn,
                defaultValue: a.def,
                stackable: a.st === 1,
                highIsGood: a.hi === 1,
                maxAttributeId: a.max,
                unitId: a.u,
                published: a.pub === 1,
                showWhenZero: a.z === 1,
                categoryId: a.cat
            });
            this.attrByName.set(a.n, a.i);
        }
        for (const e of raw.effects){
            this.effects.set(e.i, {
                id: e.i,
                name: e.n,
                category: e.cat,
                modifiers: e.mods,
                durationAttributeId: e.dur,
                dischargeAttributeId: e.dis,
                rangeAttributeId: e.rng,
                falloffAttributeId: e.fal,
                resistanceAttributeId: e.res
            });
            this.effectByName.set(e.n, e.i);
        }
        for (const t of raw.types){
            const group = this.groups.get(t.g);
            const attrs = new Map();
            for (const [k, v] of Object.entries(t.a))attrs.set(Number(k), v);
            this.types.set(t.i, {
                id: t.i,
                name: t.n,
                groupId: t.g,
                groupName: group?.name ?? '',
                categoryId: group?.categoryId ?? 0,
                marketGroupId: t.mg,
                metaGroupId: t.mt,
                metaLevel: t.ml,
                variationParentId: t.vp,
                raceId: t.r,
                factionId: t.f,
                attrs,
                effects: t.e
            });
            this.typeByName.set(fold(t.n), t.i);
        }
        this.units = new Map(Object.entries(raw.units ?? {}).map(([k, v])=>[
                Number(k),
                v
            ]));
        this.cloneGrades = raw.cloneGrades.map((c)=>({
                id: c.i,
                name: c.n,
                skills: new Map(Object.entries(c.skills).map(([k, v])=>[
                        Number(k),
                        v
                    ]))
            }));
        for (const b of raw.buffs ?? [])this.buffs.set(b.i, b);
        this.weathers = raw.weathers ?? [];
        for (const m of raw.mutaplasmids ?? []){
            const mp = {
                id: m.i,
                name: m.n,
                ranges: new Map(Object.entries(m.a).map(([k, v])=>[
                        Number(k),
                        v
                    ])),
                resultFor: new Map(m.m.flatMap((x)=>x.from.map((f)=>[
                            f,
                            x.to
                        ])))
            };
            this.mutaplasmids.set(mp.id, mp);
            for (const x of m.m){
                for (const f of x.from){
                    const list = this.mutaplasmidsByBase.get(f);
                    if (list) list.push(mp);
                    else this.mutaplasmidsByBase.set(f, [
                        mp
                    ]);
                    const bases = this.abyssalBase.get(x.to);
                    if (bases) {
                        if (!bases.includes(f)) bases.push(f);
                    } else this.abyssalBase.set(x.to, [
                        f
                    ]);
                }
            }
        }
    }
    attrId(name) {
        const id = this.attrByName.get(name);
        if (id == null) throw new Error(tx('Atribut necunoscut: {name}', {
            name
        }));
        return id;
    }
    hasAttr(name) {
        return this.attrByName.has(name);
    }
    effectId(name) {
        return this.effectByName.get(name);
    }
    type(id) {
        const t = this.types.get(id);
        if (!t) throw new Error(tx('Item necunoscut în datele de fitting: {id}', {
            id
        }));
        return t;
    }
    findType(name) {
        const id = this.typeByName.get(fold(name.trim()));
        return id == null ? undefined : this.types.get(id);
    }
    baseAttr(typeId, attrId) {
        const v = this.types.get(typeId)?.attrs.get(attrId);
        return v ?? this.attributes.get(attrId)?.defaultValue ?? 0;
    }
    hasEffect(typeId, effectName) {
        const id = this.effectByName.get(effectName);
        return id != null && (this.types.get(typeId)?.effects.includes(id) ?? false);
    }
    variations(typeId) {
        const t = this.types.get(typeId);
        if (!t) return [];
        const parent = t.variationParentId ?? t.id;
        if (!this.variationIndex) {
            this.variationIndex = new Map();
            for (const x of this.types.values()){
                const p = x.variationParentId ?? x.id;
                const list = this.variationIndex.get(p);
                if (list) list.push(x);
                else this.variationIndex.set(p, [
                    x
                ]);
            }
        }
        const list = this.variationIndex.get(parent) ?? [
            t
        ];
        return [
            ...list
        ].sort((a, b)=>(a.metaLevel ?? 0) - (b.metaLevel ?? 0) || a.name.localeCompare(b.name));
    }
    variationIndex;
    mutaplasmidsFor(baseTypeId) {
        return this.mutaplasmidsByBase.get(baseTypeId) ?? [];
    }
    isAbyssal(typeId) {
        return this.abyssalBase.has(typeId);
    }
    abyssalBases(abyssalTypeId) {
        return this.abyssalBase.get(abyssalTypeId) ?? [];
    }
    modesFor(shipId) {
        const ship = this.types.get(shipId);
        if (!ship) return [];
        return [
            ...this.types.values()
        ].filter((t)=>t.groupId === MODE_GROUP && t.name.startsWith(`${ship.name} `)).sort((a, b)=>a.name.localeCompare(b.name));
    }
    typesInCategory(categoryId) {
        return [
            ...this.types.values()
        ].filter((t)=>t.categoryId === categoryId);
    }
}
