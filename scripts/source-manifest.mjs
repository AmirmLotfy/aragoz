import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync,mkdirSync,writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const root=resolve(import.meta.dirname,'..'),excluded=new Set(['evidence/source-manifest.json']);
const files=execFileSync('git',['ls-files','--cached','--others','--exclude-standard','-z'],{cwd:root,encoding:'utf8'}).split('\0').filter(Boolean).filter(f=>!excluded.has(f)).sort();
const entries=files.map(path=>{const content=readFileSync(resolve(root,path));return{path,bytes:content.length,sha256:createHash('sha256').update(content).digest('hex')};});
const result={kind:'source-file-identity-only',excluded:[...excluded],entries,note:'Ignored configuration/dependencies/data are excluded. Hashes establish file identity, not implementation, provider, browser, hosted or release acceptance.'};
mkdirSync(resolve(root,'evidence'),{recursive:true});writeFileSync(resolve(root,'evidence/source-manifest.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({files:entries.length,bytes:entries.reduce((n,e)=>n+e.bytes,0),manifest:'evidence/source-manifest.json',kind:result.kind}));
