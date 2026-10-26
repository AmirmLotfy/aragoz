import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { inspectGlb } from '../lib/glb.mjs';
const root=resolve(import.meta.dirname,'../..');
const spec=JSON.parse(readFileSync(resolve(root,'assets/production/kit-spec.json')));
const checks=[],manifest=[];
for(const role of spec.assets){
  const file=resolve(root,'assets/candidates/runtime',role.id+'.glb');const bytes=readFileSync(file);
  const result=inspectGlb(bytes,{maxTriangles:role.triangleTarget,maxTextureDimension:role.textureMaxDimension,expectedDimensions:role.dimensions,dimensionTolerance:.015});
  for(const name of role.requiredNodes)if(!result.nodeNames.includes(name))throw new Error(role.id+' missing node '+name);
  for(const name of role.animations)if(!result.animationNames.includes(name))throw new Error(role.id+' missing animation '+name);
  if(result.materialCount>role.materialTarget)throw new Error(role.id+' material target exceeded: '+result.materialCount);
  checks.push({id:role.id,...result,gzipBytes:gzipSync(bytes).length,requiredNodesPassed:true,requiredAnimationsPassed:true,materialBudgetPassed:true});
  manifest.push({schemaVersion:1,id:role.id,revision:'local-kit-v1',source:'Original Blender/Python authored geometry and256px color tiles; assets/source/local-kit-v1/'+role.id+'.blend',rights:'Original project-authored source. No provider generation, stock geometry or third-party textures.',approvedConcept:'assets/concepts/target-sheet-v1.png',glbPath:'/__asset-review/runtime/'+role.id+'.glb',materials:[],dimensions:role.dimensions,sockets:role.requiredNodes,animations:role.animations,collider:role.id==='stage'?'ARENA boundaries and two immutable AABBs':role.id==='hero'?'analytic circle r0.32 on XZ plane':role.id.startsWith('shell-')?'analytic circle r0.68':'simulation module logic; visual geometry does not change game rules',triangles:result.sceneTriangles,textureBytes:result.textures.reduce((n,t)=>n+t.bytes,0),engineEvidence:null,acceptance:'pending-approval'});
}
const receipt={status:'static-candidates-pass',measuredAt:new Date().toISOString(),provenance:'Original Blender authored geometry and deterministic authored color tiles',checks,totalSceneTriangles:checks.reduce((n,x)=>n+x.sceneTriangles,0),totalGzipBytes:checks.reduce((n,x)=>n+x.gzipBytes,0),engineAcceptanceEstablished:false,note:'Static rest-pose structure/bounds/embedded-image inspection only. Actual Babylon import, animated envelope, gameplay camera, draw calls, OBS and human review remain separate.'};
writeFileSync(resolve(root,'assets/candidates/manifest.json'),JSON.stringify(manifest,null,2)+'\n');
writeFileSync(resolve(root,'assets/production/local-kit-static-inspection.json'),JSON.stringify(receipt,null,2)+'\n');
console.log(JSON.stringify({status:receipt.status,totalSceneTriangles:receipt.totalSceneTriangles,totalGzipBytes:receipt.totalGzipBytes,assets:checks.map(x=>({id:x.id,triangles:x.sceneTriangles,materials:x.materialCount,primitives:x.primitiveCount,dimensions:x.dimensions,animations:x.animationNames}))},null,2));
