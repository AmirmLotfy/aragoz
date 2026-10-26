import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { assetReviewPlugin } from '../../apps/web/asset-review-plugin.ts';

function triangle(){
  const binary=Buffer.alloc(36);[0,0,0,1,0,0,0,1,0].forEach((v,i)=>binary.writeFloatLE(v,i*4));
  const document={asset:{version:'2.0'},buffers:[{byteLength:36}],bufferViews:[{buffer:0,byteLength:36}],accessors:[{bufferView:0,componentType:5126,count:3,type:'VEC3',min:[0,0,0],max:[1,1,0]}],meshes:[{primitives:[{attributes:{POSITION:0},mode:4}]}],nodes:[{mesh:0}],scenes:[{nodes:[0]}],scene:0};
  const json=Buffer.from(JSON.stringify(document));const padded=Buffer.alloc(Math.ceil(json.length/4)*4,0x20);json.copy(padded);
  const output=Buffer.alloc(12+8+padded.length+8+binary.length);output.write('glTF');output.writeUInt32LE(2,4);output.writeUInt32LE(output.length,8);output.writeUInt32LE(padded.length,12);output.writeUInt32LE(0x4e4f534a,16);padded.copy(output,20);const start=20+padded.length;output.writeUInt32LE(binary.length,start);output.writeUInt32LE(0x004e4942,start+4);binary.copy(output,start+8);return output;
}
function handler(directory){let callback;const plugin=assetReviewPlugin(directory);assert.equal(plugin.apply,'serve');plugin.configureServer({middlewares:{use(fn){callback=fn;}}});return callback;}
async function request(handle,url,address='127.0.0.1'){
  const response={statusCode:200,headers:{},body:null,setHeader(k,v){this.headers[k]=v;},end(body){this.body=body;}};let forwarded=false;
  await handle({url,socket:{remoteAddress:address}},response,()=>{forwarded=true;});return{...response,forwarded};
}
test('candidate middleware exists only for dev serving and forwards ordinary app routes',async()=>{
  const result=await request(handler('/not-used'),'/api/session');assert.equal(result.forwarded,true);assert.equal(result.body,null);
});
test('remote requests and traversal never receive candidate source bytes',async()=>{
  const handle=handler('/not-used');assert.equal((await request(handle,'/__asset-review/manifest.json','203.0.113.1')).statusCode,403);
  for(const url of ['/__asset-review/../../.env','/__asset-review/%2e%2e/%2e%2e/.env','/__asset-review/runtime/hero%2fsecret.glb','/__asset-review/runtime/hero.glb/extra']){
    const result=await request(handle,url);assert.equal(result.statusCode,404,url);assert.equal(result.forwarded,false,url);
  }
});
test('only a pending-candidate manifest is served and is never cached',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'aragoz-review-'));try{
    const handle=handler(directory),entry={id:'hero',acceptance:'pending-approval',glbPath:'/__asset-review/runtime/hero.glb'};await writeFile(join(directory,'manifest.json'),JSON.stringify([entry]));
    const accepted=await request(handle,'/__asset-review/manifest.json');assert.equal(accepted.statusCode,200);assert.equal(accepted.headers['Cache-Control'],'no-store');assert.deepEqual(JSON.parse(accepted.body.toString()),[entry]);
    await writeFile(join(directory,'manifest.json'),JSON.stringify([{...entry,acceptance:'approved'}]));assert.equal((await request(handle,'/__asset-review/manifest.json')).statusCode,422);
    await writeFile(join(directory,'manifest.json'),JSON.stringify([{...entry,glbPath:'https://example.invalid/asset.glb'}]));assert.equal((await request(handle,'/__asset-review/manifest.json')).statusCode,422);
  }finally{await rm(directory,{recursive:true,force:true});}
});
test('candidate GLB is inspected before bytes are served; malformed bytes are rejected',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'aragoz-review-'));try{
    await mkdir(join(directory,'runtime'));await writeFile(join(directory,'runtime/hero.glb'),triangle());const handle=handler(directory);
    const accepted=await request(handle,'/__asset-review/runtime/hero.glb');assert.equal(accepted.statusCode,200);assert.equal(accepted.headers['Content-Type'],'model/gltf-binary');assert.equal(accepted.headers['X-Aragoz-Asset-Review'],'candidate-only');
    await writeFile(join(directory,'runtime/hero.glb'),Buffer.from('not a GLB'));assert.equal((await request(handle,'/__asset-review/runtime/hero.glb')).statusCode,422);
  }finally{await rm(directory,{recursive:true,force:true});}
});
test('a symlink cannot escape the candidate directory',async()=>{
  const parent=await mkdtemp(join(tmpdir(),'aragoz-review-'));try{
    const directory=join(parent,'candidates');await mkdir(join(directory,'runtime'),{recursive:true});await writeFile(join(parent,'outside.glb'),triangle());await symlink(join(parent,'outside.glb'),join(directory,'runtime/hero.glb'));
    assert.equal((await request(handler(directory),'/__asset-review/runtime/hero.glb')).statusCode,422);
  }finally{await rm(parent,{recursive:true,force:true});}
});
