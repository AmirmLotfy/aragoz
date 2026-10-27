// Isolated real-data recovery rehearsal. Never acts on the live HTTP service,
// changes source DB rows, mints an authenticated session, or contacts providers.
// Reuses a still-valid persisted ARAGOZ session only in the private restored copy.
import { DatabaseSync, backup } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createApp } from '../apps/server/src/app.ts';
import { CombatSimulation } from '../packages/combat/src/index.ts';

const root=resolve(import.meta.dirname,'..');
const receiptDay=new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Cairo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const receiptPath=resolve(root,process.env.ARAGOZ_RECOVERY_RECEIPT??`evidence/restored-controller-recovery-${receiptDay.replaceAll('-','')}.json`);
if(existsSync(receiptPath))throw Error('Receipt destination already exists; choose a fresh ARAGOZ_RECOVERY_RECEIPT path.');
const runtime=JSON.parse(readFileSync(resolve(root,'.runtime/public-preview.json'),'utf8'));
const sourcePath=resolve(root,'data/public-preview/aragoz.sqlite');
if(runtime.database!==sourcePath)throw Error('Owned source database does not match runtime');
const runId=String(Date.now()),dir=resolve(root,'data/public-preview','controller-recovery-'+runId);
mkdirSync(dir,{mode:0o700});const restoredPath=resolve(dir,'isolated.sqlite');
const receipt={kind:'Isolated localhost HTTP recovery using genuine persisted channel/session/recipe/result; deterministic simulation event probes; not live-provider/browser/human acceptance',at:new Date().toISOString(),checks:[],providerCalls:0,providerSockets:0,liveHttpMutations:0,newAuthenticatedSessions:0,complete:false};
function check(name,pass,detail={}){receipt.checks.push({name,pass,detail});if(!pass)throw Error('Check failed: '+name);}
function fingerprint(db){const rows={};for(const table of ['shows','recipes','results','encounter_events'])rows[table]=db.prepare('SELECT * FROM '+table+' ORDER BY 1,2').all();return{counts:Object.fromEntries(Object.entries(rows).map(([k,v])=>[k,v.length])),hash:createHash('sha256').update(JSON.stringify(rows)).digest('hex')};}
function simulationEvents(recipe,attemptId){const sim=new CombatSimulation(recipe,attemptId),events=[];for(let i=0;i<900&&events.length<3;i++){sim.step({moveX:0,moveZ:0,aimX:0,aimZ:-1,strike:false,dodge:false});events.push(...sim.drainEvents());}if(events.length<3)throw Error('Simulation did not produce enough ordinary events');return events.slice(0,3);}
let source,app,baseline;
try{
  source=new DatabaseSync(sourcePath,{readOnly:true});baseline=fingerprint(source);
  const rooms=source.prepare('SELECT state FROM shows').all().map(row=>JSON.parse(row.state));
  check('source has no active show',rooms.every(room=>['ended','showbill'].includes(room.phase)));
  const actual=rooms.find(room=>room.recipe&&room.results.some(result=>result.outcome==='won'));
  check('genuine committed encounter and accepted win exist',Boolean(actual));
  await backup(source,restoredPath);source.close();source=null;chmodSync(restoredPath,0o600);
  app=await createApp({databasePath:restoredPath,tokenEncryptionKey:readFileSync(resolve(root,'data/public-preview/credentials.key'),'utf8').trim(),origin:'http://127.0.0.1',secureCookies:false,host:'127.0.0.1',port:0,invitedChannels:[actual.channel.id],openaiApiKey:'',modelDailyRequestLimit:0},{background:false,fetch:async()=>{receipt.providerCalls++;throw Error('Provider requests are prohibited in this rehearsal');},socketFactory:()=>{receipt.providerSockets++;throw Error('Provider sockets are prohibited in this rehearsal');}});
  const address=await app.listen({host:'127.0.0.1',port:0});app.services.config.origin=address;
  const session=app.services.store.db.prepare('SELECT id,csrf FROM sessions WHERE channel_id=? AND expires_at>? ORDER BY expires_at DESC LIMIT 1').get(actual.channel.id,Date.now());
  check('existing unexpired OAuth-linked ARAGOZ session restored',Boolean(session));
  const sessionRows=()=>app.services.store.db.prepare('SELECT id,channel_id,expires_at FROM sessions ORDER BY id').all();
  const sessionsBefore=sessionRows(),sessionHash=createHash('sha256').update(JSON.stringify(sessionsBefore)).digest('hex');
  const headers={cookie:'aragoz_session='+session.id,origin:address,'x-csrf-token':session.csrf,'content-type':'application/json'};
  async function request(path,body,extra){const response=await fetch(address+path,{method:body===undefined?'GET':'POST',headers:extra??headers,body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(5000)});return{status:response.status,body:await response.json()};}
  const info=await request('/api/session');check('restored real session authorizes its invited channel',info.status===200&&info.body.authenticated&&info.body.invited&&info.body.channel.id===actual.channel.id);
  const roomPath='/api/shows/'+actual.roomId;let room=(await request(roomPath)).body;
  const originalResults=JSON.stringify(room.results),recipeHash=room.recipe.hash;
  const originalEvent=app.services.store.events(room.attempt.id)[0];check('real original ledger event retained',Boolean(originalEvent));
  async function rejected(name,body,status=409,path=roomPath+'/actions',customHeaders){const before=fingerprint(app.services.store.db);const r=await request(path,body,customHeaders);check(name,r.status===status&&fingerprint(app.services.store.db).hash===before.hash,{status:r.status});return r;}
  async function action(value){const r=await request(roomPath+'/actions',{expectedRevision:room.revision,action:value});check('action accepted: '+value.type,r.status===200,{status:r.status});room=r.body;return room;}
  async function upload(clientId,events,revision=room.revision){return request(roomPath+'/events',{expectedRevision:revision,clientId,events});}
  await rejected('ended show rejects even an old exact duplicate',{expectedRevision:room.revision,clientId:'recovery-A',events:[originalEvent]},409,roomPath+'/events');
  await rejected('ended show cannot claim control',{expectedRevision:room.revision,action:{type:'claim-control',clientId:'recovery-A',takeover:true}});
  await rejected('stale room revision cannot start Encore',{expectedRevision:Math.max(0,room.revision-1),action:{type:'encore'}});
  await action({type:'encore'});check('Encore retains immutable recipe and genuine result',room.phase==='ready'&&room.recipe.hash===recipeHash&&JSON.stringify(room.results)===originalResults);
  await action({type:'claim-control',clientId:'recovery-A',takeover:false});
  await rejected('second client needs explicit takeover',{expectedRevision:room.revision,action:{type:'claim-control',clientId:'recovery-B',takeover:false}});
  await rejected('non-controller cannot start combat',{expectedRevision:room.revision,action:{type:'start-combat',clientId:'recovery-B'}});
  await action({type:'start-combat',clientId:'recovery-A'});
  const attemptA=room.attempt.id,eventsA=simulationEvents(room.recipe,attemptA),revisionA=room.revision;
  let response=await upload('recovery-A',[eventsA[0]]);check('controller simulation event accepted over real localhost HTTP',response.status===200,{status:response.status});room=response.body;
  const acceptedRevision=room.revision;response=await upload('recovery-A',[eventsA[0]],revisionA);check('exact retry is idempotent despite prior revision',response.status===200&&response.body.revision===acceptedRevision&&response.body.attempt.lastSequence===1);
  await rejected('conflicting retry cannot rewrite original event',{expectedRevision:room.revision,clientId:'recovery-A',events:[{...eventsA[0],simTick:eventsA[0].simTick+1}]},409,roomPath+'/events');
  await action({type:'claim-control',clientId:'recovery-B',takeover:true});
  check('takeover abandons old attempt and creates fresh paused attempt',room.attempt.id!==attemptA&&room.attempt.ownerClientId==='recovery-B'&&room.phase==='paused'&&room.attempt.status==='paused'&&room.results.some(r=>r.attemptId===attemptA&&r.outcome==='abandoned')&&room.recipe.hash===recipeHash);
  const attemptB=room.attempt.id;await action({type:'resume'});
  const beforeDuplicate=fingerprint(app.services.store.db),revisionB=room.revision;
  response=await upload('recovery-A',[eventsA[0]]);check('prior exact duplicate acknowledges without advancing current attempt',response.status===200&&response.body.revision===revisionB&&response.body.attempt.id===attemptB&&fingerprint(app.services.store.db).hash===beforeDuplicate.hash);
  await rejected('old controller cannot flush queued damage',{expectedRevision:room.revision,clientId:'recovery-A',events:[eventsA[1]]},409,roomPath+'/events');
  await rejected('old attempt rejected even with new controller ID',{expectedRevision:room.revision,clientId:'recovery-B',events:[eventsA[1]]},409,roomPath+'/events');
  const eventsB=simulationEvents(room.recipe,attemptB);
  await rejected('new attempt rejects wrong controlling client',{expectedRevision:room.revision,clientId:'recovery-A',events:[eventsB[0]]},409,roomPath+'/events');
  response=await upload('recovery-B',[eventsB[0]]);check('new controller owns fresh event sequence',response.status===200&&response.body.attempt.lastSequence===1);room=response.body;
  await rejected('current attempt rejects stale upload revision',{expectedRevision:room.revision-1,clientId:'recovery-B',events:[eventsB[1]]},409,roomPath+'/events');
  await action({type:'pause'});
  await rejected('paused attempt rejects queued damage',{expectedRevision:room.revision,clientId:'recovery-B',events:[eventsB[1]]},409,roomPath+'/events');
  await action({type:'resume'});response=await upload('recovery-B',[eventsB[1]]);check('resumed owner can continue exact sequence',response.status===200&&response.body.attempt.lastSequence===2);room=response.body;
  const playedBeforeRestart=room.attempt.id,resultsBeforeRestart=room.results.length;
  app.services.engine.recover();room=(await request(roomPath)).body;
  const prepared=room.attempt.id;
  check('recovery retires the actual interrupted attempt once',room.results.length===resultsBeforeRestart+1&&room.results.at(-1).attemptId===playedBeforeRestart&&room.results.at(-1).outcome==='abandoned'&&room.attempt.ownerClientId===null&&room.attempt.lastSequence===0);
  app.services.engine.recover();room=(await request(roomPath)).body;
  check('another recovery preserves the never-played replacement',room.attempt.id===prepared&&room.results.length===resultsBeforeRestart+1);
  await action({type:'claim-control',clientId:'recovery-C',takeover:true});
  check('first explicit recovery claim reuses that replacement without phantom result',room.attempt.id===prepared&&room.attempt.ownerClientId==='recovery-C'&&room.phase==='paused'&&room.results.length===resultsBeforeRestart+1);
  await action({type:'resume'});
  await rejected('pre-restart controller cannot upload into resumed replacement',{expectedRevision:room.revision,clientId:'recovery-B',events:[eventsB[2]]},409,roomPath+'/events');
  const eventsC=simulationEvents(room.recipe,prepared);
  response=await upload('recovery-C',[eventsC[0]]);check('recovered controller starts the same fresh sequence over HTTP',response.status===200&&response.body.attempt.id===prepared&&response.body.attempt.lastSequence===1);room=response.body;
  await action({type:'end-show'});
  await rejected('ended new attempt rejects late offline upload',{expectedRevision:room.revision,clientId:'recovery-B',events:[eventsB[2]]},409,roomPath+'/events');
  await rejected('anonymous upload cannot access restored encounter',{expectedRevision:room.revision,clientId:'recovery-B',events:[eventsB[2]]},401,roomPath+'/events',{'content-type':'application/json'});
  check('original actual win remains byte-identical',room.results.slice(0,actual.results.length).length===actual.results.length&&JSON.stringify(room.results.slice(0,actual.results.length))===originalResults);
  const sessionsAfter=sessionRows();receipt.newAuthenticatedSessions=sessionsAfter.filter(s=>s.channel_id).length-sessionsBefore.filter(s=>s.channel_id).length;
  check('no provider calls, sockets or new authenticated sessions',receipt.providerCalls===0&&receipt.providerSockets===0&&receipt.newAuthenticatedSessions===0&&createHash('sha256').update(JSON.stringify(sessionsAfter)).digest('hex')===sessionHash);
  await app.close();app=null;
  source=new DatabaseSync(sourcePath,{readOnly:true});const after=fingerprint(source);check('live committed show/recipe/result/event rows unchanged',after.hash===baseline.hash,{counts:after.counts});source.close();source=null;
  receipt.complete=true;receipt.limits=['Persisted session and data are genuine; all mutations target an isolated localhost restore.','Event probes come from pure TypeScript simulation, not browser gameplay.','No new OAuth/chat/provider lifecycle, public-hosted controller-window, multichannel or human acceptance is established.','No Devpost/browser restriction was bypassed; original production state and credentials remain private.'];
}catch(error){receipt.failure=error instanceof Error?error.message:'Recovery rehearsal failed';process.exitCode=1;}
finally{if(app)await app.close();source?.close();writeFileSync(receiptPath,JSON.stringify(receipt,null,2)+'\n');}
console.log(JSON.stringify({complete:receipt.complete,checks:receipt.checks.length,providerCalls:receipt.providerCalls,providerSockets:receipt.providerSockets,liveHttpMutations:receipt.liveHttpMutations,failure:receipt.failure??null}));
