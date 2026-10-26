import { readFile, realpath } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';
import { inspectGlb } from '../../scripts/lib/glb.mjs';

/** Local Vite middleware only. Candidate files are never copied to the production public directory. */
export function assetReviewPlugin(candidateDirectory?:string):Plugin {
  const candidateRoot=candidateDirectory??fileURLToPath(new URL('../../assets/candidates/',import.meta.url));
  return {
    name:'aragoz-local-asset-review',apply:'serve',
    configureServer(server){
      server.middlewares.use(async(req,res,next)=>{
        const raw=req.url??'/';
        if(!raw.startsWith('/__asset-review/'))return next();
        const pathname=new URL(raw, 'http://localhost').pathname;
        if(!pathname.startsWith('/__asset-review/')){res.statusCode=404;res.end('Candidate not found');return;}
        if(!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress??'')){res.statusCode=403;res.end('Local asset review only');return;}
        const relative=pathname.slice('/__asset-review/'.length);
        if(relative!=='manifest.json'&&!/^runtime\/[a-z0-9-]+\.glb$/.test(relative)){res.statusCode=404;res.end('Candidate not found');return;}
        try{
          const root=await realpath(candidateRoot),file=await realpath(resolve(candidateRoot,relative));
          if(!file.startsWith(root+sep))throw new Error('Candidate path escaped its directory');
          const bytes=await readFile(file);
          if(relative.endsWith('.glb'))inspectGlb(bytes,{maxTriangles:120000,maxTextureDimension:1024});
          else{
            const entries=JSON.parse(bytes.toString('utf8'));
            if(!Array.isArray(entries)||entries.some(e=>e.acceptance!=='pending-approval'||typeof e.glbPath!=='string'||!/^\/__asset-review\/runtime\/[a-z0-9-]+\.glb$/.test(e.glbPath)))throw new Error('Invalid candidate manifest');
          }
          res.setHeader('Content-Type',relative.endsWith('.glb')?'model/gltf-binary':'application/json');res.setHeader('Cache-Control','no-store');res.setHeader('X-Aragoz-Asset-Review','candidate-only');res.end(bytes);
        }catch{res.statusCode=422;res.end('Candidate unavailable or failed static admission');}
      });
    },
  };
}
