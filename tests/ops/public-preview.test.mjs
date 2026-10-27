import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,copyFile,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawn} from 'node:child_process';

for(const split of [false,true])test(`expired tunnel exits instead of reporting ready; split=${split}`,async()=>{
  const root=await mkdtemp(join(tmpdir(),'aragoz-preview-expiry-'));
  let child,timeout;
  try{
    for(const dir of ['scripts','apps/server/src','apps/web/dist/assets','.runtime/bin'])await mkdir(join(root,dir),{recursive:true});
    for(const path of ['scripts/start-public-preview.mjs','apps/server/src/readiness.ts'])await copyFile(resolve(path),join(root,path));
    await writeFile(join(root,'apps/web/dist/index.html'),'<script type="module" src="/assets/entry.js"></script>');
    await writeFile(join(root,'apps/web/dist/assets/entry.js'),'/* fixture */');
    const fake=join(root,'.runtime/bin/cloudflared');
    await writeFile(fake,`#!${process.execPath}\nprocess.stderr.write('Unauthorized: ${split?'':'Tunnel not found'}');\n${split?"setTimeout(()=>process.stderr.write('Tunnel not found'),10);":''}\nsetInterval(()=>{},1000);\n`,{mode:0o700});
    const {createServer}=await import('node:net');const probe=createServer();await new Promise(resolve=>probe.listen(0,'127.0.0.1',resolve));const port=probe.address().port;await new Promise(resolve=>probe.close(resolve));
    child=spawn(process.execPath,[join(root,'scripts/start-public-preview.mjs')],{cwd:root,env:{PATH:process.env.PATH,HOME:root,ARAGOZ_PREVIEW_PORT:String(port)},stdio:['ignore','pipe','pipe']});
    let output='';for(const stream of [child.stdout,child.stderr])stream.on('data',chunk=>{output+=chunk;});
    const code=await Promise.race([new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',resolve);}),new Promise((_,reject)=>{timeout=setTimeout(()=>reject(Error('Expired tunnel did not terminate')),5000);})]);
    assert.equal(code,1);assert.match(output,/free tunnel expired/);assert.doesNotMatch(output,/Public technical preview:/);
    const state=JSON.parse(await readFile(join(root,'.runtime/public-preview.json'),'utf8'));assert.equal(state.status,'stopped');assert.equal(state.serverPid,null);
    assert.throws(()=>process.kill(state.tunnelPid,0),{code:'ESRCH'});
  }finally{clearTimeout(timeout);if(child&&child.exitCode===null)child.kill('SIGTERM');await rm(root,{recursive:true,force:true});}
});
