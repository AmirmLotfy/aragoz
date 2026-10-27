// Actual current public DB backup and isolated restore, without injecting hosts.
// This verifies anonymous persistence only while Twitch is unconfigured.
import {DatabaseSync,backup} from 'node:sqlite';
import {mkdirSync,readFileSync,writeFileSync,chmodSync,copyFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createApp} from '../apps/server/src/app.ts';
const root=resolve(import.meta.dirname,'..'),runtime=JSON.parse(readFileSync(resolve(root,'.runtime/public-preview.json'),'utf8'));
const probe=JSON.parse(readFileSync(resolve(root,'.runtime/hosted-probe-session.json'),'utf8'));
if(probe.origin!==runtime.origin)throw Error('Anonymous probe belongs to another origin');
const dir=resolve(root,'data/public-preview/checkpoint-20261027-b03'),online=resolve(dir,'online-before-reload.sqlite'),restore=resolve(dir,'isolated-restore.sqlite');mkdirSync(dir,{recursive:true,mode:0o700});
const counts=db=>Object.fromEntries(['channels','shows','recipes','results','encounter_events','sessions'].map(table=>[table,db.prepare('SELECT COUNT(*) AS n FROM '+table).get().n]));
const receipt={kind:'Actual public SQLite online backup and isolated localhost restore; anonymous session only; no genuine token/channel restore claim',at:new Date().toISOString(),origin:runtime.origin,checks:[],providerCalls:0};
const check=(name,pass,detail={})=>{receipt.checks.push({name,pass,detail});if(!pass)throw Error(name+' failed');};
let db,restored,app;
try{
  db=new DatabaseSync(runtime.database,{readOnly:true});
  check('actual source database matches owned runtime',runtime.database===resolve(root,'data/public-preview/aragoz.sqlite'));
  const credentials=db.prepare('SELECT COUNT(*) AS n FROM channels WHERE credential IS NOT NULL').get().n;
  check('scope is genuinely unconfigured',credentials===0&&db.prepare('SELECT COUNT(*) AS n FROM shows').get().n===0,{credentialRows:credentials});
  const sourceCounts=counts(db),schema=db.prepare('PRAGMA user_version').get().user_version;await backup(db,online);db.close();db=null;chmodSync(online,0o600);copyFileSync(online,restore);chmodSync(restore,0o600);
  restored=new DatabaseSync(restore,{readOnly:true});check('isolated backup integrity',restored.prepare('PRAGMA integrity_check').get().integrity_check==='ok');
  check('schema and all existing row counts preserved',restored.prepare('PRAGMA user_version').get().user_version===schema&&JSON.stringify(counts(restored))===JSON.stringify(sourceCounts),{schema,counts:sourceCounts});restored.close();restored=null;
  app=await createApp({databasePath:restore,tokenEncryptionKey:readFileSync(resolve(root,'data/public-preview/credentials.key'),'utf8').trim(),origin:'http://127.0.0.1',secureCookies:false,openaiApiKey:'',modelDailyRequestLimit:0,twitchClientId:'',twitchClientSecret:''},{fetch:async()=>{receipt.providerCalls++;throw Error('Restore must not contact providers');}});
  const address=await app.listen({port:0,host:'127.0.0.1'});
  const readiness=await fetch(address+'/api/readiness').then(r=>r.json());check('restored server actually starts with packaged frontend',readiness.ready&&readiness.frontendReady&&readiness.modelEnabled===false);
  const session=await fetch(address+'/api/session',{headers:{cookie:probe.cookie}}).then(r=>r.json());check('existing public anonymous session survives isolated restore',session.authenticated===false&&session.csrfToken===probe.csrf);
  check('no provider requests',receipt.providerCalls===0);await app.close();app=null;receipt.complete=true;
}catch(error){receipt.complete=false;receipt.failure=error.message;process.exitCode=1;}
finally{if(app)await app.close();db?.close();restored?.close();}
writeFileSync(resolve(root,'evidence/hosted-backup-restore-20261027.json'),JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify({complete:receipt.complete,checks:receipt.checks.length,failure:receipt.failure??null}));
