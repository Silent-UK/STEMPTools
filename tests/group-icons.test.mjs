import test from 'node:test';
import assert from 'node:assert/strict';
import {GROUP_ICONS,allowedGroupIcon,groupIconPicker} from '../public/group-icons.mjs';
test('group icons offer named unique presets and retain existing custom icons only when unchanged',()=>{
 assert.equal(GROUP_ICONS.length,32);assert.equal(new Set(GROUP_ICONS.map(([icon])=>icon)).size,32);
 for(const [icon,label] of GROUP_ICONS){assert.ok(label);assert.equal(allowedGroupIcon(icon),true);}
 assert.equal(allowedGroupIcon('custom'),false);assert.equal(allowedGroupIcon('old','old'),true);assert.equal(allowedGroupIcon('new','old'),false);
});
test('icon picker uses accessible radios, preserves selection and escapes legacy values',()=>{
 const html=groupIconPicker('☾');assert.match(html,/aria-label="Moon Mining" checked/);assert.equal((html.match(/type="radio"/g)||[]).length,32);
 const legacy=groupIconPicker('<old>');assert.match(legacy,/value="&lt;old&gt;"/);assert.match(legacy,/aria-label="Current Icon" checked/);assert.doesNotMatch(legacy,/<old>/);
});
