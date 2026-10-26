import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { createWriteStream, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createServer } from 'node:net';
import { parseEnv } from 'node:util';

// This preview uses the owner's existing computer and an account-free tunnel.
// Paid providers and game model requests are deliberately never enabled here.
const root=resolve(import.meta.dirname,'..');
const operatorEnv=()=>existsSync(resolve(root,'.env'))?parseEnv(readFileSync(resolve(root,'.env'),'utf8')):{};
const port=Number(process.env.ARAGOZ_PREVIEW_PORT??3010);
if(!Number.isSafeInteger(port)||port<1024||port>65535)throw new Error('Choose a preview port from 1024 to 65535.');
await new Promise((resolve,reject)=>{const probe=createServer();probe.once('error',()=>reject(new Error('The public-preview loopback port is occupied. Choose ARAGOZ_PREVIEW_PORT.')));probe.listen(port,'127.0.0.1',()=>probe.close(resolve));});
const binary=process.env.ARAGOZ_CLOUDFLARED_PATH??resolve(root,'.runtime/bin/cloudflared');
if(!existsSync(binary))throw new Error('Install the official cloudflared binary at .runtime/bin/cloudflared, or set ARAGOZ_CLOUDFLARED_PATH. See ops/NO_COST_HOSTING.md.');
mkdirSync(resolve(root,'.runtime'),{recursive:true});
const data=resolve(root,'data/public-preview');mkdirSync(data,{recursive:true,mode:0o700});
const keyPath=resolve(data,'credentials.key');
const suppliedKey=operatorEnv().CREDENTIAL_ENCRYPTION_KEY||process.env.CREDENTIAL_ENCRYPTION_KEY;
if(!suppliedKey&&!existsSync(keyPath))writeFileSync(keyPath,randomBytes(32).toString('base64'),{mode:0o600,flag:'wx'});
const encryptionKey=suppliedKey??readFileSync(keyPath,'utf8').trim();
if(Buffer.from(encryptionKey,'base64').length!==32)throw new Error('The credential encryption key must contain 32 bytes.');
const statePath=resolve(root,'.runtime/public-preview.json');
const children=new Set(),expectedStops=new Set();let stopping=false,reloading=false,origin=null,server=null,serverStarted=false;
const log=createWriteStream(resolve(root,'.runtime/public-tunnel.log'),{flags:'w',mode:0o600});
const save=status=>writeFileSync(statePath,JSON.stringify({status,origin,port,database:resolve(data,'aragoz.sqlite'),supervisorPid:process.pid,serverPid:server?.pid??null,tunnelPid:tunnel.pid,modelEnabled:false},null,2)+'\n',{mode:0o600});
const shutdown=(code=0)=>{
  if(stopping)return;stopping=true;clearTimeout(deadline);process.exitCode=code;
  for(const child of children)if(child.exitCode===null)child.kill('SIGTERM');
  save('stopped');log.end();
  const force=setTimeout(()=>{for(const child of children)if(child.exitCode===null)child.kill('SIGKILL');},3000);force.unref();
};
const observe=(child,label)=>{
  children.add(child);
  child.on('error',()=>{console.error(`${label} could not start. See the local preview runbook.`);shutdown(1);});
  child.on('exit',()=>{children.delete(child);if(expectedStops.delete(child))return;if(!stopping){console.error(`${label} stopped; the public preview is closed safely.`);shutdown(1);}});
};
const deadline=setTimeout(()=>{console.error('The free tunnel did not become ready within two minutes.');shutdown(1);},120000);
const tunnel=spawn(binary,['--no-autoupdate','tunnel','--protocol','http2','--url',`http://127.0.0.1:${port}`],{cwd:root,stdio:['ignore','pipe','pipe']});
observe(tunnel,'Tunnel');
const openServer=async()=>{
  if(stopping||serverStarted)return;serverStarted=true;
  server=spawn(process.execPath,['apps/server/src/index.ts'],{cwd:root,stdio:['ignore','pipe','pipe'],env:{...process.env,...operatorEnv(),HOST:'127.0.0.1',PORT:String(port),PUBLIC_ORIGIN:origin,DATABASE_PATH:resolve(data,'aragoz.sqlite'),CREDENTIAL_ENCRYPTION_KEY:encryptionKey,TWITCH_REDIRECT_URI:origin+'/api/auth/twitch/callback',OPENAI_API_KEY:'',MODEL_DAILY_REQUEST_LIMIT:'0'}});
  observe(server,'Game server');
  // Server request logging is disabled; do not forward process environment or secrets.
  server.stdout.on('data',chunk=>process.stdout.write(chunk));
  server.stderr.on('data',()=>console.error('The game server reported an error. Its private data remains on this computer.'));
  save('starting');
  for(let attempt=0;attempt<40&&!stopping;attempt++){
    try{
      const response=await fetch(`http://127.0.0.1:${port}/api/readiness`,{signal:AbortSignal.timeout(1000)});
      if(response.ok){clearTimeout(deadline);save('ready');console.log(`Public technical preview: ${origin}/rehearse`);console.log(`Twitch callback for this session: ${origin}/api/auth/twitch/callback`);console.log('No paid services or game model calls are enabled. Keep this process and the Mac running.');return;}
    }catch{/* Wait only for this process-owned server to boot. */}
    await new Promise(resolve=>setTimeout(resolve,250));
  }
  if(!stopping){console.error('The local public-preview server did not become ready.');shutdown(1);}
};
let tail='';
const tunnelOutput=chunk=>{
  log.write(chunk);tail=(tail+chunk.toString()).slice(-8192);
  const match=tail.match(/https:\/\/[a-z0-9]+(?:-[a-z0-9]+)*\.trycloudflare\.com\b/);
  if(match&&!origin){origin=match[0];void openServer().catch(()=>shutdown(1));}
};
tunnel.stdout.on('data',tunnelOutput);tunnel.stderr.on('data',tunnelOutput);
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>shutdown());
process.on('SIGHUP',()=>{
  if(stopping||reloading||!server)return;reloading=true;
  void(async()=>{
    const previous=server;expectedStops.add(previous);
    const closed=new Promise(resolve=>previous.once('exit',resolve));previous.kill('SIGTERM');
    const force=setTimeout(()=>previous.kill('SIGKILL'),3000);await closed;clearTimeout(force);
    if(stopping)return;serverStarted=false;await openServer();reloading=false;
  })().catch(()=>{console.error('The game server could not reload its private configuration.');shutdown(1);});
});
