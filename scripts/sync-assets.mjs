import { mkdir, readFile, writeFile, copyFile, stat } from 'node:fs/promises';
import { resolve, dirname, sep } from 'node:path';
const root=resolve(import.meta.dirname,'..'),assets=resolve(root,'assets'),destination=resolve(root,'apps/web/public/assets');
const manifest=JSON.parse(await readFile(resolve(assets,'manifest.json'),'utf8'));
await mkdir(destination,{recursive:true});
for(const entry of manifest){
  if(entry.acceptance!=='approved'||!entry.glbPath)continue;
  if(!entry.glbPath.startsWith('/assets/runtime/')||entry.glbPath.includes('..'))throw new Error('Asset path is outside the runtime kit');
  const relative=entry.glbPath.slice('/assets/'.length),source=resolve(assets,relative),target=resolve(destination,relative);
  if(!source.startsWith(assets+sep))throw new Error('Unsafe asset path');
  if((await stat(source)).size>25*1024*1024)throw new Error('One asset exceeds the entire art payload target');
  await mkdir(dirname(target),{recursive:true});await copyFile(source,target);
}
await writeFile(resolve(destination,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log('Synced asset manifest and approved local runtime assets; concepts remain private source files.');
