import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';

const context=process.env.ARAGOZ_DOCKER_CONTEXT??'colima-aragoz-release';
const image=process.env.ARAGOZ_TEST_IMAGE??'aragoz-release:local';
const suffix=randomUUID().replaceAll('-','').slice(0,12);
const container='aragoz-smoke-'+suffix,volume=container+'-data';
const receipt={kind:'local-linux-container-smoke',recordedAt:new Date().toISOString(),image,context,passed:false,platform:null,checks:[],cleanupErrors:[],limits:['Synthetic SQL sentinel only; no genuine Twitch, audience, hosted or OBS acceptance.']};
let volumeCreated=false,containerCreated=false;
const docker=(...args)=>execFileSync('docker',['--context',context,...args],{encoding:'utf8',timeout:120000,stdio:['ignore','pipe','pipe']}).trim();
const check=(name,fn)=>{fn();receipt.checks.push(name);};
const node=code=>docker('exec',container,'node','--input-type=module','-e',code);
const sentinel="import{DatabaseSync}from'node:sqlite';const db=new DatabaseSync(process.env.DATABASE_PATH);db.exec(\"CREATE TABLE container_smoke_fixture(value TEXT NOT NULL); INSERT INTO container_smoke_fixture VALUES ('synthetic-persistence-sentinel');\");db.close();";
const verify="import{DatabaseSync}from'node:sqlite';import assert from'node:assert/strict';const db=new DatabaseSync(process.env.DATABASE_PATH);assert.equal(db.prepare('SELECT value FROM container_smoke_fixture').get().value,'synthetic-persistence-sentinel');assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check,'ok');db.close();console.log('integrity-and-sentinel-ok');";
async function boot(database='/var/data/aragoz.sqlite'){
  docker('run','--detach','--name',container,'--mount',`type=volume,source=${volume},target=/var/data`,'--publish','127.0.0.1::3000','--env','PUBLIC_ORIGIN=http://127.0.0.1:3000','--env',`DATABASE_PATH=${database}`,'--env','MODEL_DAILY_REQUEST_LIMIT=0',image);containerCreated=true;
  const address=docker('port',container,'3000/tcp');assert.match(address,/^127\.0\.0\.1:\d+$/);const origin='http://'+address;
  for(let attempt=0;attempt<40;attempt++){
    try{const r=await fetch(origin+'/api/readiness',{signal:AbortSignal.timeout(1000)});if(r.ok){const state=await r.json();assert.equal(state.modelEnabled,false);assert.equal(state.hostingConfigured,false);return origin;}}catch{}
    await new Promise(resolve=>setTimeout(resolve,250));
  }
  throw new Error('Test container did not become ready within its startup budget.');
}
function removeContainer(){if(containerCreated){docker('rm','--force',container);containerCreated=false;}}
try{
  check('Linux image and non-root runtime',()=>{receipt.platform=docker('image','inspect',image,'--format','{{.Os}}/{{.Architecture}}');assert.match(receipt.platform,/^linux\//);assert.equal(docker('image','inspect',image,'--format','{{.Config.User}}'),'node');});
  docker('volume','create',volume);volumeCreated=true;
  const origin=await boot();
  for(const path of ['/api/health','/api/readiness','/rehearse','/house-show','/assets/manifest.json','/fonts/NotoSans-OFL.txt']){
    const response=await fetch(origin+path,{signal:AbortSignal.timeout(5000)});check('HTTP 200 '+path,()=>assert.equal(response.status,200));await response.body?.cancel();
  }
  const denied=await fetch(origin+'/api/shows',{signal:AbortSignal.timeout(5000)});check('Unauthenticated private API denied',()=>assert.equal(denied.status,401));await denied.body?.cancel();
  const compressed=await fetch(origin+'/assets/runtime/hero.glb',{headers:{'accept-encoding':'br'},signal:AbortSignal.timeout(5000)});
  const hero=Buffer.from(await compressed.arrayBuffer());check('Packaged Brotli GLB decodes to original format',()=>{assert.equal(compressed.status,200);assert.equal(compressed.headers.get('content-encoding'),'br');assert.equal(hero.subarray(0,4).toString(),'glTF');});
  check('Volume writable by node runtime user',()=>assert.equal(node("console.log(process.getuid())"),'1000'));
  node(sentinel);
  check('Online SQLite backup',()=>assert.match(docker('exec',container,'node','apps/server/src/backup.ts','/var/data/backup.sqlite'),/backup completed/));
  removeContainer();await boot();
  check('Persistence after container replacement',()=>assert.equal(node(verify),'integrity-and-sentinel-ok'));
  removeContainer();
  docker('run','--rm','--network','none','--mount',`type=volume,source=${volume},target=/var/data`,image,'node','--input-type=module','-e',"import{copyFileSync}from'node:fs';copyFileSync('/var/data/backup.sqlite','/var/data/restored.sqlite');");
  await boot('/var/data/restored.sqlite');
  check('Backup restoration and integrity in separate database',()=>assert.equal(node(verify),'integrity-and-sentinel-ok'));
  receipt.passed=true;
}catch(error){receipt.error=error instanceof Error?error.message:'Container check failed';process.exitCode=1;}
finally{
  try{removeContainer();}catch{receipt.cleanupErrors.push(container);}
  if(volumeCreated)try{docker('volume','rm',volume);}catch{receipt.cleanupErrors.push(volume);}
  if(receipt.cleanupErrors.length){receipt.passed=false;process.exitCode=1;}
  mkdirSync('evidence',{recursive:true});writeFileSync('evidence/linux-container-smoke.json',JSON.stringify(receipt,null,2)+'\n');
  console.log(JSON.stringify(receipt,null,2));
}
