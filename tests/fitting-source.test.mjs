import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {inflateRawSync} from 'node:zlib';
test('corresponding source contains simulator/build code and excludes private data/configuration',()=>{
 const zip=readFileSync(new URL('../lib/fitting-source.zip',import.meta.url)),entries=new Map();let offset=0;
 while(zip.readUInt32LE(offset)===0x04034b50){
  const length=zip.readUInt32LE(offset+18),nameLength=zip.readUInt16LE(offset+26),extraLength=zip.readUInt16LE(offset+28),start=offset+30+nameLength+extraLength;
  const name=zip.subarray(offset+30,offset+30+nameLength).toString();entries.set(name,zip.subarray(start,start+length));offset=start+length;
 }
 assert.ok(entries.has('tools-source/vendor/vyraj/src/engine/dogma.ts'));
 assert.ok(entries.has('tools-source/lib/fitting-simulation.mjs'));
 assert.ok(entries.has('tools-source/scripts/build-fitting-engine.mjs'));
 assert.ok(entries.has('tools-source/LICENSE'));
 assert.ok(entries.has('tools-source/docs/HEALTHCHECK.md'));
 for(const name of entries.keys())assert.ok(!name.startsWith('tools-source/data/')&&!name.includes('/node_modules/')&&!name.includes('/.reference-')&&!name.includes('/narvi-tools/')&&!name.endsWith('/.env')&&!/\.sqlite(?:-|$)/.test(name),name);
 const source=inflateRawSync(entries.get('tools-source/lib/fitting-simulation.mjs')).toString();
 assert.equal(source,readFileSync(new URL('../lib/fitting-simulation.mjs',import.meta.url),'utf8').replace(/\r\n/g,'\n'));
});
