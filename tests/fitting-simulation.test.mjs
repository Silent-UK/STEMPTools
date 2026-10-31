import test from 'node:test';
import assert from 'node:assert/strict';
import raw from '../lib/fitting-dogma.json' with {type:'json'};
import {importWorkbench,compactWorkbench,validateWorkbench} from '../lib/fitting-workbench.mjs';
import {simulateWorkbench,simulatorItem} from '../lib/fitting-simulation.mjs';
const types=new Map(raw.types.map(t=>[t.i,t])),names=new Map(raw.types.map(t=>[t.n,t.i])),groups=new Map(raw.groups.map(g=>[g.i,g]));
const cat={type:id=>{const t=types.get(Number(id));return t?{id:t.i,name:t.n,category_id:groups.get(t.g).c,group_id:t.g,attributes:t.a,volume:t.a[161]||0}:null;},named:name=>names.get(name)};
const make=text=>importWorkbench(text,cat),base=()=>make('[Vexor Navy Issue, Regression]');
const close=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-6,`${actual} != ${expected}`);
test('weapon fitting skill reduces CPU and advanced weapon upgrades reduces powergrid',()=>{
 const fit=make('[Vexor Navy Issue, CPU]\nHeavy Electron Blaster II, Antimatter Charge M');
 const unskilled=simulateWorkbench(fit,{name:'Untrained',skills:[]});
 const skilled=simulateWorkbench(fit,{name:'Pilot',skills:[{skill_id:3426,active_skill_level:5},{skill_id:3318,active_skill_level:5},{skill_id:11207,active_skill_level:5}]});
 close(skilled.resources.cpu.used,unskilled.resources.cpu.used*.75);close(skilled.resources.powergrid.used,unskilled.resources.powergrid.used*.9);
 close(skilled.resources.cpu.total,unskilled.resources.cpu.total*1.25);
});
test('shield extenders and armor plates receive HP skill bonuses after adding flat HP',()=>{
 const skill={name:'Pilot',skills:[{skill_id:3419,active_skill_level:5},{skill_id:3394,active_skill_level:5}]};
 const empty=simulateWorkbench(base(),{skills:[]}),fit=make('[Vexor Navy Issue, Buffer]\nLarge Shield Extender II\n1600mm Steel Plates II');
 const stats=simulateWorkbench(fit,skill);
 close(stats.layers[0].hp,(empty.layers[0].hp+cat.type(cat.named('Large Shield Extender II')).attributes[72])*1.25);
 close(stats.layers[1].hp,(empty.layers[1].hp+cat.type(cat.named('1600mm Steel Plates II')).attributes[1159])*1.25);
 fit.items[0].state='offline';close(simulateWorkbench(fit,skill).layers[0].hp,empty.layers[0].hp*1.25);
});
test('active hardeners affect all resists; online/offline hardeners do not; overheat increases strength',()=>{
 const fit=make('[Vexor Navy Issue, Resists]\nMultispectrum Shield Hardener II');
 const active=simulateWorkbench(fit);close(active.layers[0].resists[0],32.5);
 fit.items[0].state='online';close(simulateWorkbench(fit).layers[0].resists[0],0);
 fit.items[0].state='overheated';const hot=simulateWorkbench(fit);close(hot.layers[0].resists[0],39);assert.ok(hot.heat[0].damage>0);
 assert.ok(hot.defense.ehp>active.defense.ehp);
});
test('hardener stacking is penalized while damage control applies separately and order is irrelevant',()=>{
 const fit=make('[Vexor Navy Issue, Stacking]\nMultispectrum Shield Hardener II\nMultispectrum Shield Hardener II\nDamage Control II');
 const stats=simulateWorkbench(fit);
 assert.ok(stats.layers[0].resists[0]>50&&stats.layers[0].resists[0]<60);
 // Verify the non-penalized damage control against the same two-hardeners fit.
 const two=simulateWorkbench(make('[Vexor Navy Issue, Two]\nMultispectrum Shield Hardener II\nMultispectrum Shield Hardener II'));
 close(1-stats.layers[0].resists[0]/100,(1-two.layers[0].resists[0]/100)*.875);
 fit.items.reverse();close(simulateWorkbench(fit).layers[0].resists[0],stats.layers[0].resists[0]);
});
test('DPS includes loaded ammunition, active weapon state, drones, ship bonuses and heat',()=>{
 const fit=make('[Vexor Navy Issue, Damage]\nHeavy Electron Blaster II, Antimatter Charge M\nHobgoblin II x5');fit.items[1].launched=5;
 const stats=simulateWorkbench(fit);assert.ok(stats.offense.weaponDps>0);assert.ok(stats.offense.droneDps>0);
 fit.items[0].state='overheated';assert.ok(simulateWorkbench(fit).offense.weaponDps>stats.offense.weaponDps);
 fit.items[0].state='offline';close(simulateWorkbench(fit).offense.weaponDps,0);
 const zero=simulateWorkbench(fit,{skills:[]});assert.ok(stats.offense.droneDps>zero.offense.droneDps);
 const plain=make('[Thorax, Plain]\nHobgoblin II x5');plain.items[0].launched=5;
 assert.ok(stats.offense.droneDps>simulateWorkbench(plain).offense.droneDps);
});
test('capacitor calculates finite lifetime under active load and stability after modules are switched off',()=>{
 const fit=make('[Vexor Navy Issue, Capacitor]\nX-Large Shield Booster II');
 const active=simulateWorkbench(fit);assert.equal(active.capacitor.stable,false);assert.ok(active.capacitor.lastsSeconds>0&&active.capacitor.lastsSeconds<86400);
 fit.items[0].state='online';const idle=simulateWorkbench(fit);assert.equal(idle.capacitor.stable,true);close(idle.capacitor.drain,0);
});
test('pilot snapshots apply active skills rather than trained inactive levels and do not mutate fits',()=>{
 const fit=base(),before=compactWorkbench(fit),zero=simulateWorkbench(fit,{skills:[]}),inactive=simulateWorkbench(fit,{skills:[{skill_id:3426,active_skill_level:0,trained_skill_level:5}]});
 close(inactive.resources.cpu.total,zero.resources.cpu.total);assert.deepEqual(compactWorkbench(fit),before);
 const unsynced=simulateWorkbench(fit,{name:'Unsynced',skills:null});assert.match(unsynced.warnings.join(' '),/not synced/);
});


test('battleship role bonuses affect extenders and shield upgrade skills reduce their fitting cost',()=>{
 const empty=simulateWorkbench(make('[Raven, Role]')),fit=make('[Raven, Extender]\nLarge Shield Extender II'),extended=simulateWorkbench(fit);
 close(extended.layers[0].hp-empty.layers[0].hp,2600*2*1.25);
 close(extended.resources.powergrid.used,160*.75);
});


test('CCP online effects do not turn passive plates or damage controls into active modules',()=>{
 assert.equal(simulatorItem(cat.named('Damage Control II')).canActivate,false);
 assert.equal(simulatorItem(cat.named('1600mm Steel Plates II')).canActivate,false);
 assert.equal(simulatorItem(cat.named('Multispectrum Shield Hardener II')).canActivate,true);
 const fit=make('[Vexor Navy Issue, Passive]\nDamage Control II\n1600mm Steel Plates II');assert.equal(fit.items[0].state,'online');assert.equal(fit.items[1].state,'online');assert.ok(simulateWorkbench(fit).layers[0].resists[0]>0);
});
