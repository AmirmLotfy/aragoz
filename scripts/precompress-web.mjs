import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { extname, resolve } from 'node:path';
import { brotliCompressSync, constants, gzipSync } from 'node:zlib';

const root=resolve(import.meta.dirname,'../apps/web/dist');
const extensions=new Set(['.html','.js','.css','.json','.glb','.ttf','.txt']);
const totals={files:0,originalBytes:0,gzipBytes:0,brotliBytes:0};
function compress(directory){
  for(const entry of readdirSync(directory,{withFileTypes:true})){
    const path=resolve(directory,entry.name);
    if(entry.isDirectory()){compress(path);continue;}
    if(!entry.isFile()||!extensions.has(extname(path)))continue;
    const original=readFileSync(path);if(original.length<512)continue;
    const gzip=gzipSync(original,{level:9}),brotli=brotliCompressSync(original,{params:{[constants.BROTLI_PARAM_QUALITY]:5}});
    if(gzip.length<original.length*0.95)writeFileSync(path+'.gz',gzip);
    if(brotli.length<original.length*0.95)writeFileSync(path+'.br',brotli);
    totals.files++;totals.originalBytes+=original.length;totals.gzipBytes+=Math.min(original.length,gzip.length);totals.brotliBytes+=Math.min(original.length,brotli.length);
  }
}
compress(root);console.log('Precompressed public assets: '+JSON.stringify(totals));
