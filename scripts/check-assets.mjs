import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { inspectGlb } from './lib/glb.mjs';
const root=resolve(import.meta.dirname,'..');const entries=JSON.parse(await readFile(resolve(root,'assets/manifest.json'),'utf8'));
let compressed=0,declaredTriangles=0;const pending=[],inspections=[];
async function evidenceFile(relative,label){
  if(typeof relative!=='string'||relative.startsWith('/')||relative.split('/').includes('..')||relative.includes('://'))throw new Error('Invalid '+label+' path');
  await stat(resolve(root,relative));
}
for(const e of entries){
  if(e.schemaVersion!==1)throw new Error('Unsupported asset contract version: '+e.id);
  if(!e.id||!e.revision||!e.source||!e.rights||!Array.isArray(e.sockets))throw new Error('Incomplete asset provenance');
  if(e.acceptance!=='approved'){pending.push(e.id);continue;}
  if(!e.approvedConcept||!e.engineEvidence||!/^\/assets\/runtime\/[a-z0-9][a-z0-9-]*\.glb$/.test(e.glbPath??''))throw new Error('Approved asset lacks required admission evidence: '+e.id);
  await evidenceFile(e.approvedConcept,'approved concept');await evidenceFile(e.engineEvidence,'engine capture');
  if(!/\.(png|jpe?g)$/i.test(e.engineEvidence))throw new Error('Engine evidence must reference an actual image capture: '+e.id);
  const source=resolve(root,'assets',e.glbPath.slice('/assets/'.length));await stat(source);const bytes=await readFile(source);
  const inspection=inspectGlb(bytes,{maxTriangles:120000,maxTextureDimension:1024,expectedDimensions:e.dimensions,dimensionTolerance:0.15});
  if(e.triangles!==inspection.sceneTriangles)throw new Error('Declared triangles do not match the actual selected scene: '+e.id);
  for(const socket of e.sockets)if(!inspection.nodeNames.includes(socket))throw new Error('Missing required socket '+socket+' in '+e.id);
  for(const animation of e.animations)if(!inspection.animationNames.includes(animation))throw new Error('Missing required animation '+animation+' in '+e.id);
  inspections.push({id:e.id,...inspection});
  compressed+=gzipSync(bytes).length;declaredTriangles+=e.triangles;
}
console.log(JSON.stringify({acceptedAssets:entries.length-pending.length,pending,compressedBytes:compressed,declaredTriangles,allRuntimeAssetsAdmitted:pending.length===0,engineAcceptanceEstablishedByThisCheck:false,inspections,limits:{compressedBytes:25*1024*1024,visibleTriangles:120000},note:'Static inspection checks recorded admission, not GPU rendering, animated bounds, draw calls, gameplay, OBS or human acceptance.'},null,2));
if(compressed>25*1024*1024)throw new Error('Compressed art payload exceeds target');
if(process.argv.includes('--require-final')&&pending.length)process.exitCode=1;
