// Reproducible AGPL corresponding-source archive. No private configuration/data.
import {readdirSync,readFileSync,writeFileSync,existsSync} from 'node:fs';
import {join,relative,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {deflateRawSync,crc32} from 'node:zlib';
const root=fileURLToPath(new URL('../',import.meta.url)),files=[];
const extensions=new Set(['.mjs','.js','.ts','.json','.py','.css','.html','.md','.sh','.service','.timer','.conf']);
function walk(dir){if(!existsSync(dir))return;for(const item of readdirSync(dir,{withFileTypes:true})){const path=join(dir,item.name);if(item.isDirectory()){if(item.name!=='__pycache__')walk(path);}else if(item.isFile()&&(extensions.has(extname(path))||item.name==='LICENSE'))files.push(path);}}
for(const dir of ['lib','public','scripts','vendor','tests','deploy'])walk(join(root,dir));
for(const name of ['server.mjs','package.json','package-lock.json','README.md','RECRUITMENT.md','AGENTS.md','FITTING_WORKSPACE_REVIEW.md','PATCH_NOTES.md','LICENSE','.env.example','.gitignore','.gitattributes'])if(existsSync(join(root,name)))files.push(join(root,name));
const locals=[],central=[];let offset=0;
for(const path of [...new Set(files)].sort()){
 const name=Buffer.from('tools-source/'+relative(root,path).replaceAll('\\','/')),data=Buffer.from(readFileSync(path,'utf8').replace(/\r\n/g,'\n')),compressed=deflateRawSync(data,{level:9}),crc=crc32(data);
 const local=Buffer.alloc(30);local.writeUInt32LE(0x04034b50);local.writeUInt16LE(20,4);local.writeUInt16LE(0x800,6);local.writeUInt16LE(8,8);local.writeUInt16LE(0x21,12);local.writeUInt32LE(crc,14);local.writeUInt32LE(compressed.length,18);local.writeUInt32LE(data.length,22);local.writeUInt16LE(name.length,26);
 const entry=Buffer.alloc(46);entry.writeUInt32LE(0x02014b50);entry.writeUInt16LE(0x314,4);entry.writeUInt16LE(20,6);entry.writeUInt16LE(0x800,8);entry.writeUInt16LE(8,10);entry.writeUInt16LE(0x21,14);entry.writeUInt32LE(crc,16);entry.writeUInt32LE(compressed.length,20);entry.writeUInt32LE(data.length,24);entry.writeUInt16LE(name.length,28);entry.writeUInt32LE((0o100644<<16)>>>0,38);entry.writeUInt32LE(offset,42);
 locals.push(local,name,compressed);central.push(entry,name);offset+=local.length+name.length+compressed.length;
}
const directory=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(files.length,8);end.writeUInt16LE(files.length,10);end.writeUInt32LE(directory.length,12);end.writeUInt32LE(offset,16);
writeFileSync(join(root,'lib/fitting-source.zip'),Buffer.concat([...locals,directory,end]));
console.log('Packaged '+files.length+' corresponding-source files; private data/configuration excluded.');
