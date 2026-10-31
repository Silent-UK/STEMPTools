// Rebuild the licensed VYRAJ runtime from the corresponding TypeScript sources.
import {stripTypeScriptTypes} from 'node:module';
import {readdirSync,readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=new URL('../vendor/vyraj/',import.meta.url);
function build(relative=''){
 for(const entry of readdirSync(new URL('src/'+relative,root),{withFileTypes:true})){
  const file=relative+entry.name;if(entry.isDirectory()){build(file+'/');continue;}
  if(!file.endsWith('.ts'))continue;
  const source=readFileSync(new URL('src/'+file,root),'utf8');
  const js=stripTypeScriptTypes(source,{mode:'transform'}).replace(/(from\s+['"])(\.[^'"]+)(['"])/g,(_,a,b,c)=>a+b+'.mjs'+c);
  const target=new URL('runtime/'+file.replace(/\.ts$/,'.mjs'),root);mkdirSync(dirname(fileURLToPath(target)),{recursive:true});
  writeFileSync(target,'// Copyright (C) 2026 Vyraj. AGPL-3.0-only. Corresponding source: ../src/\n'+js);
 }
}
build();console.log('Built VYRAJ fitting calculation runtime.');
