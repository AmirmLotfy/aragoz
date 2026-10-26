import { readFileSync, statSync } from 'node:fs';
import { resolve, sep } from 'node:path';

/** Check the entry assets as well as HTML: a database alone is not a playable show. */
export function webBuildReady(directory:string):boolean {
  try {
    const root=resolve(directory),html=readFileSync(resolve(root,'index.html'),'utf8');
    const assets=[...html.matchAll(/(?:src|href)=["'](\/assets\/[^"']+)["']/g)].map(match=>match[1]);
    return assets.some(path=>path.endsWith('.js'))&&assets.every(path=>{
      const file=resolve(root,'.'+path);
      return file.startsWith(root+sep)&&statSync(file).isFile();
    });
  } catch { return false; }
}
