#!/usr/bin/env node
// Authoring this script is not OBS evidence. Run only under the coordinator's
// browser/OBS ownership; this creates a fresh task-only headed Chrome context.
// Usage: node scripts/obs-gameplay-session.mjs --run-id=obs-1080p --label=1080p --quality=high --fps=30
// Read ready.json, select ONLY its titled window in OBS, start recording, then
// create the reported start marker. After the paused receipt, stop OBS first,
// then create the stop marker. SIGTERM/SIGINT pause/checkpoint and preserve this
// window until that explicit stop marker; they never close another Chrome.
import { chromium } from '@playwright/test';
import { createHash } from 'node:crypto';
import { existsSync, watch } from 'node:fs';
import { mkdir, rename, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';

const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const SESSION_MS=30*60*1000,SEGMENT_MS=10*60*1000,START_WAIT_MS=20*60*1000;
const PRESETS=['The Teapot Tyrant','The Copycat’s Comeback','A Very Bad Reflection'];
const CHROME='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const options=Object.fromEntries(process.argv.slice(2).map(argument=>{
  const match=argument.match(/^--(run-id|label|url|quality|fps)=(.*)$/);if(!match)throw new Error('Use only --run-id=, --label=, --url=, --quality= or --fps= options');return [match[1],match[2]];
}));
const runId=options['run-id']??new Date().toISOString().replace(/[:.]/g,'-')+'-'+process.pid;
if(!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,95}$/.test(runId))throw new Error('run-id must be a short filesystem-safe identifier');
if(options.label&&!/^[a-zA-Z0-9 _.-]{1,64}$/.test(options.label))throw new Error('label must be a short operator label');
if(options.quality&&!['high','low'].includes(options.quality))throw new Error('quality must be high or low');
if(options.fps&&!['30','60'].includes(options.fps))throw new Error('fps must be30 or60');
const target=new URL(options.url??'http://127.0.0.1:3000/rehearse');
if(target.protocol!=='http:'||target.hostname!=='127.0.0.1'||target.pathname!=='/rehearse'||target.username||target.password||target.search||target.hash)throw new Error('Use an uncredentialed http://127.0.0.1:PORT/rehearse URL without query or fragment');
const directory=join(ROOT,'.runtime/evidence/obs',runId);
const startMarker=join(directory,'start'),stopMarker=join(directory,'stop');
await mkdir(dirname(directory),{recursive:true});await mkdir(directory);
const paths={directory,startMarker,stopMarker,progress:join(directory,'progress.json'),receipt:join(directory,'receipt.json'),ready:join(directory,'ready.json')};
const evidence={schemaVersion:1,evidenceKind:'AI-led headed local keyboard gameplay during an operator-controlled OBS session',
  limits:'Not human, genuine Twitch, hosted, or independently verified OBS/encoder acceptance. Operator output labels do not establish game or recording resolution.',
  runId,operatorLabel:options.label??null,requestedQuality:options.quality??'high',requestedPresentationFps:Number(options.fps??60),target:target.toString(),pid:process.pid,createdAt:new Date().toISOString(),
  audioPolicy:{browserOutputMuted:true,gameMuteVerifiedBeforePlay:false},
  requestedDurationMs:SESSION_MS,requestedPresetSegmentMs:SEGMENT_MS,status:'preparing',paths,
  processOwnership:'Only the fresh Chrome context/profile created by this script; never an existing user profile or unrelated browser.',
  profilePath:join(directory,'chrome-profile'),chromeExecutable:CHROME,headless:false,
  browser:null,startMarkerObservedAt:null,startedAt:null,scheduledEndAt:null,endedAt:null,observedDurationMs:null,
  completedScheduledDuration:false,pausedAfterRun:null,stopMarkerObservedAt:null,contextClosedAt:null,
  presets:[],attempts:[],samples:[],exports:[],errors:[],pageErrors:[],unexpectedDownloads:0,inputOperations:0,rafTiming:null};
let context=null,page=null,held=new Set(),interrupted=null,rootStopRequested=false,durationReached=false;
let startClock=null,lastProgress=0,lastSample=0,lastDodge=0,currentPreset=0,currentAttempt=null;
let pausePromise=null,deadlineTimer=null;
const interruptController=new AbortController();
const stopController=new AbortController();
function errorRecord(error,kind='script'){
  return {at:new Date().toISOString(),kind,name:error instanceof Error?error.name:'Error',message:String(error instanceof Error?error.message:error).replace(/https?:\/\/\S+/g,'[local URL]').slice(0,400)};
}
async function atomicJson(path,value){const temporary=path+'.tmp-'+process.pid;await writeFile(temporary,JSON.stringify(value,null,2)+'\n');await rename(temporary,path);}
async function checkpoint(status=evidence.status){evidence.status=status;await atomicJson(paths.progress,{...evidence,lastCheckpointAt:new Date().toISOString()});}
function running(){return startClock!==null&&!durationReached&&!interrupted&&!rootStopRequested&&performance.now()-startClock<SESSION_MS;}
function waitForMarker(path,{timeoutMs=null,signal=null}={}){
  return new Promise((resolveMarker,reject)=>{
    let settled=false,timer=null,watcher=null;
    const finish=error=>{if(settled)return;settled=true;if(timer)clearTimeout(timer);watcher?.close();signal?.removeEventListener('abort',abort);error?reject(error):resolveMarker(new Date().toISOString());};
    const check=()=>{if(existsSync(path))finish();};
    const abort=()=>finish(new Error('Marker wait interrupted'));
    watcher=watch(dirname(path),(_event,name)=>{if(name?.toString()===path.slice(dirname(path).length+1))check();});
    watcher.on('error',finish);if(signal){if(signal.aborted)return abort();signal.addEventListener('abort',abort,{once:true});}
    if(timeoutMs!==null)timer=setTimeout(()=>finish(new Error('Start marker was not supplied within '+timeoutMs+' milliseconds')),timeoutMs);
    check();
  });
}
const stopPromise=waitForMarker(stopMarker,{signal:stopController.signal}).then(at=>{rootStopRequested=true;evidence.stopMarkerObservedAt=at;interruptController.abort();}).catch(error=>{if(!stopController.signal.aborted){evidence.errors.push(errorRecord(error,'stop-marker-watch'));throw error;}});
async function releaseKeys(){
  if(!page||page.isClosed()){held.clear();return;}
  const previous=[...held];held.clear();for(const key of previous)await page.keyboard.up(key).catch(()=>{});
  await page.keyboard.up('Space').catch(()=>{});
}
async function setKeys(next){
  if(!running())return releaseKeys();
  for(const key of [...held])if(!next.includes(key)){await page.keyboard.up(key);held.delete(key);evidence.inputOperations++;}
  for(const key of next)if(!held.has(key)&&running()){await page.keyboard.down(key);held.add(key);evidence.inputOperations++;}
}
async function readState(){
  return page.getByTestId('game-canvas').evaluate(canvas=>{
    const value=name=>{try{return JSON.parse(canvas.dataset[name]??'null');}catch{return null;}};
    const rectangle=canvas.getBoundingClientRect(),fpsText=document.querySelector('.stage-footnote span:last-child')?.textContent??'';
    const gameFps=fpsText.match(/([0-9.]+)\s*fps/);
    return {at:new Date().toISOString(),attemptId:canvas.dataset.attemptId??null,recipeHash:canvas.dataset.recipeHash??null,
      simTick:Number(canvas.dataset.simTick??0),paused:canvas.dataset.paused==='true',outcome:canvas.dataset.outcome||null,
      stage:canvas.dataset.bossStage??null,activeSlot:canvas.dataset.activeSlot||null,hero:value('heroPosition'),boss:value('bossPosition'),facing:value('bossFacing'),modules:value('modules'),
      families:(canvas.dataset.families??'').split(','),geometry:canvas.dataset.geometry??null,stageError:canvas.dataset.stageError==='true',
      displayedGameFps:gameFps?Number(gameFps[1]):null,triangles:Number(canvas.dataset.triangles??0),drawCalls:Number(canvas.dataset.drawCalls??0),
      viewport:{width:innerWidth,height:innerHeight,devicePixelRatio},canvasCss:{x:rectangle.x,y:rectangle.y,width:rectangle.width,height:rectangle.height,fullyWithinViewport:rectangle.x>=-1&&rectangle.y>=-1&&rectangle.right<=innerWidth+1&&rectangle.bottom<=innerHeight+1},canvasBuffer:{width:canvas.width,height:canvas.height}};
  },undefined,{timeout:3000});
}
async function pauseSafely(reason){
  if(pausePromise)return pausePromise;
  pausePromise=(async()=>{
    await releaseKeys();if(!page||page.isClosed())return false;
    let state=await readState().catch(()=>null);
    if(state&&!state.paused&&!state.outcome&&!state.stageError){
      await page.getByTestId('game-canvas').focus({timeout:2000}).catch(()=>{});
      await page.keyboard.press('Escape').catch(()=>{});
      await page.waitForFunction(()=>document.querySelector('[data-testid="game-canvas"]')?.getAttribute('data-paused')==='true',null,{timeout:3000}).catch(()=>{});
    }
    state=await readState().catch(()=>null);evidence.pauseReason=reason;evidence.pausedAfterRun=Boolean(state?.paused||state?.outcome||state?.stageError);
    if(state)evidence.finalState=state;
    return evidence.pausedAfterRun;
  })();return pausePromise;
}
async function exportPerformance(reason){
  if(!page||page.isClosed())return;
  const index=evidence.exports.length+1,record={index,reason,attemptId:currentAttempt?.attemptId??null,preset:currentPreset,requestedAt:new Date().toISOString(),path:null,report:null,error:null};
  evidence.exports.push(record);
  try{
    const report=await page.evaluate(()=>new Promise((resolveReport,rejectReport)=>{
      const receive=event=>{clearTimeout(timer);resolveReport(event.detail);};
      const timer=setTimeout(()=>{window.removeEventListener('aragoz:performance-report',receive);rejectReport(new Error('Performance snapshot did not respond'));},2000);
      window.addEventListener('aragoz:performance-report',receive,{once:true});
      window.dispatchEvent(new Event('aragoz:request-performance'));
    }));
    // Preserve only the documented app presentation telemetry, never arbitrary
    // downloaded payloads or profile/session contents.
    const allowed=['schemaVersion','evidence','createdAt','observationSpanMs','activeFrameSamples','pausedFrames','meanFrameMs','p95FrameMs','longestFrameMs','peakVisibleTriangles','peakObservedDrawCalls','userAgent','resolution','profiles','mechanicLibraryVersion','artKitVersion','presentationFps','quality'];
    record.report=Object.fromEntries(allowed.filter(key=>key in report).map(key=>[key,report[key]]));
    record.path=join(directory,'presentation-'+String(index).padStart(3,'0')+'.json');
    await atomicJson(record.path,{evidenceKind:'actual application presentation telemetry for one local attempt; separate from rAF and OBS encoder timing',reason,attemptId:record.attemptId,preset:record.preset,report:record.report});
  }catch(error){record.error=errorRecord(error,'performance-export');}
}
async function observe(force=false){
  const state=await readState();if(state.stageError)throw new Error('The actual playable canvas reports a graphics failure');
  if(evidence.unexpectedDownloads)throw new Error('An unexpected browser download can obscure the captured stage');
  if(!state.canvasCss.fullyWithinViewport)throw new Error('The captured stage is not fully inside the actual viewport');
  if(!state.attemptId||!state.hero||!state.boss||!state.facing||!Array.isArray(state.modules))throw new Error('Playable diagnostics are unavailable');
  if(!currentAttempt||currentAttempt.attemptId!==state.attemptId){
    currentAttempt={attemptId:state.attemptId,recipeHash:state.recipeHash,preset:currentPreset,firstObservedAt:state.at,lastObservedAt:state.at,lastSimTick:state.simTick,outcome:null};evidence.attempts.push(currentAttempt);force=true;
  }
  currentAttempt.lastObservedAt=state.at;currentAttempt.lastSimTick=state.simTick;currentAttempt.outcome=state.outcome;
  if(force||performance.now()-lastSample>=5000){evidence.samples.push({preset:currentPreset,...state});lastSample=performance.now();}
  return state;
}
async function raiseCurtain(){
  const button=page.getByRole('button',{name:'Raise the curtain',exact:true});
  await button.waitFor({state:'visible',timeout:12000});
  await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(button=>button.textContent==='Raise the curtain'&&!button.disabled),null,{timeout:12000});
  // Keyboard activation remains usable when the instruction card scrolls inside
  // a short capture window, and avoids timing a native pointer round trip.
  if(!running())return;await button.focus({timeout:3000});await page.keyboard.press('Enter');
  await button.waitFor({state:'hidden',timeout:3000});
  if(running())await page.getByTestId('game-canvas').focus({timeout:2000});
  // The parent removes the curtain before the next rAF publishes the unpaused
  // simulation snapshot. Do not mistake that valid transition for a lost cue.
  if(running())await page.waitForFunction(()=>{
    const canvas=document.querySelector('[data-testid="game-canvas"]');
    return canvas?.getAttribute('data-paused')==='false'&&Number(canvas.getAttribute('data-sim-tick'))>0;
  },null,{timeout:4000});
  if(running())await page.locator('.stage-frame').scrollIntoViewIfNeeded({timeout:3000});
}
async function selectPreset(index){
  await releaseKeys();if(currentAttempt)await exportPerformance('preset-segment-ended');
  if(!running())return;
  await page.getByRole('button',{name:PRESETS[index],exact:true}).focus({timeout:3000});await page.keyboard.press('Enter');
  currentPreset=index;currentAttempt=null;
  evidence.presets.push({index,title:PRESETS[index],selectedAt:new Date().toISOString(),sessionElapsedMs:performance.now()-startClock});
  await raiseCurtain();if(running())await observe(true);
}
async function restartAfterOutcome(){
  await releaseKeys();await exportPerformance('actual-outcome-'+currentAttempt.outcome);
  if(!running())return;
  await page.getByRole('button',{name:'Encore · same recipe',exact:true}).focus({timeout:3000});await page.keyboard.press('Enter');
  currentAttempt=null;await raiseCurtain();if(running())await observe(true);
}
function inputsFor(state,elapsed){
  const intact=state.modules.filter(module=>!module.broken),exposed=intact.find(module=>module.exposed);
  const waypoints=[{x:-5.4,z:2.6},{x:-5.3,z:-2.7},{x:5.3,z:-2.7},{x:5.4,z:2.6}];
  let targetPoint;
  if(!intact.length)targetPoint=state.boss;
  else if(exposed||elapsed%12000>=6000){
    const module=exposed??intact[Math.floor(elapsed/6000)%intact.length],offset=module.slotId==='left'?-1.05:1.05;
    targetPoint={x:state.boss.x+offset*state.facing.z+0.2*state.facing.x,z:state.boss.z-offset*state.facing.x+0.2*state.facing.z};
  }else targetPoint=waypoints[Math.floor(elapsed/4000)%waypoints.length];
  const dx=targetPoint.x-state.hero.x,dz=targetPoint.z-state.hero.z,keys=['KeyJ'];
  if(Math.hypot(dx,dz)>1.15){if(Math.abs(dx)>0.24)keys.push(dx<0?'KeyA':'KeyD');if(Math.abs(dz)>0.24)keys.push(dz<0?'KeyW':'KeyS');}
  return keys;
}
async function installRafObserver(){
  await page.evaluate(duration=>{
    const started=performance.now(),histogram=new Uint32Array(2001);let previous=null,samples=0,total=0,longest=0,finished=false;
    const frame=now=>{if(previous!==null){const interval=now-previous;samples++;total+=interval;longest=Math.max(longest,interval);histogram[Math.min(2000,Math.round(interval))]++;}previous=now;if(!finished&&now-started<duration)requestAnimationFrame(frame);};
    // This observer measures browser rAF callbacks, NOT the game render loop,
    // fixed simulation, canvas presentation, OBS output or encoder timing.
    window.__aragozObsRaf={finish:()=>{finished=true;let accumulated=0,p95=null;for(let index=0;index<histogram.length;index++){accumulated+=histogram[index];if(accumulated>=samples*.95){p95=samples?index:null;break;}}return {source:'browser requestAnimationFrame callbacks; not game presentation or OBS timing',spanMs:performance.now()-started,samples,meanMs:samples?total/samples:null,p95Ms:p95,longestMs:samples?longest:null};}};
    requestAnimationFrame(frame);
  },SESSION_MS);
}
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>{
  if(interrupted)return;interrupted=signal;interruptController.abort();evidence.interruptedBy=signal;
  void pauseSafely(signal).then(()=>checkpoint('interrupted-window-preserved')).catch(error=>{evidence.errors.push(errorRecord(error,'signal-checkpoint'));});
});

try{
  if(!existsSync(CHROME))throw new Error('The installed Google Chrome executable is absent; no browser download will be attempted');
  context=await chromium.launchPersistentContext(evidence.profilePath,{headless:false,chromiumSandbox:true,executablePath:CHROME,viewport:null,acceptDownloads:true,downloadsPath:join(directory,'downloads'),handleSIGINT:false,handleSIGTERM:false,handleSIGHUP:false,
    args:['--app='+target.toString(),'--new-window','--window-size=1280,720','--use-angle=metal','--mute-audio','--no-first-run','--no-default-browser-check','--disable-background-networking','--disable-component-update']});
  await context.route('**/*',route=>{
    const request=route.request(),url=new URL(request.url());
    if(url.protocol==='data:'||url.protocol==='blob:')return route.continue();
    return url.origin===target.origin&&request.method()==='GET'&&!url.pathname.startsWith('/api/auth/')?route.continue():route.abort();
  });
  const pages=context.pages();page=pages.find(candidate=>candidate.url().startsWith(target.origin+'/rehearse'))??pages[0]??await context.newPage();
  for(const candidate of pages)if(candidate!==page)await candidate.close();
  page.on('pageerror',error=>evidence.pageErrors.push({at:new Date().toISOString(),messageSha256:createHash('sha256').update(error.message).digest('hex')}));
  page.on('download',()=>{evidence.unexpectedDownloads++;});
  context.on('page',newPage=>{if(newPage!==page)void newPage.close().catch(()=>{});});
  page.setDefaultTimeout(3000);
  if(!page.url().startsWith(target.origin+'/rehearse'))await page.goto(target.toString(),{waitUntil:'domcontentloaded',timeout:20000});
  await page.getByRole('button',{name:'Raise the curtain',exact:true}).waitFor({state:'visible',timeout:15000});
  await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(button=>button.textContent==='Raise the curtain'&&!button.disabled),null,{timeout:15000});
  {
    await page.getByRole('button',{name:'Sound & controls',exact:true}).focus();await page.keyboard.press('Enter');
    const mute=page.getByRole('checkbox',{name:'Mute all game audio',exact:true});await mute.check();
    evidence.audioPolicy.gameMuteVerifiedBeforePlay=await mute.isChecked();
    if(!evidence.audioPolicy.gameMuteVerifiedBeforePlay)throw new Error('Silent test policy could not mute the game before play');
    await page.getByRole('combobox',{name:'Quality',exact:true}).selectOption(options.quality??'high');
    await page.getByRole('combobox',{name:'Presentation frame rate',exact:true}).selectOption(options.fps??'60');
    await page.getByRole('button',{name:'Back to the show',exact:true}).focus();await page.keyboard.press('Enter');
    if(options.quality==='low')await page.waitForFunction(()=>{const canvas=document.querySelector('[data-testid="game-canvas"]');return canvas&&canvas.width/canvas.getBoundingClientRect().width<1.1;},null,{timeout:5000});
  }
  const windowTitle='ARAGOZ · OBS AI-led · '+runId;
  await page.evaluate(title=>{document.title=title;},windowTitle);
  evidence.browser=await page.getByTestId('game-canvas').evaluate(canvas=>{
    const gl=canvas.getContext('webgl2')??canvas.getContext('webgl'),extension=gl?.getExtension('WEBGL_debug_renderer_info');
    const rectangle=canvas.getBoundingClientRect();
    return {userAgent:navigator.userAgent,platform:navigator.platform,viewport:{width:innerWidth,height:innerHeight,devicePixelRatio},outerWindow:{width:outerWidth,height:outerHeight},screen:{width:screen.width,height:screen.height,availableWidth:screen.availWidth,availableHeight:screen.availHeight},canvasCss:{width:rectangle.width,height:rectangle.height},canvasBuffer:{width:canvas.width,height:canvas.height},gpu:{renderer:extension?gl.getParameter(extension.UNMASKED_RENDERER_WEBGL):null,vendor:extension?gl.getParameter(extension.UNMASKED_VENDOR_WEBGL):null,version:gl?.getParameter(gl.VERSION)??null},visibility:document.visibilityState,windowTitle:document.title};
  });
  evidence.browser.chromeVersion=context.browser()?.version()??null;
  const renderer=evidence.browser.gpu.renderer??'';
  evidence.browser.hardwareMetalConfirmed=/metal/i.test(renderer)&&!/(swiftshader|llvmpipe|software)/i.test(renderer);
  if(!evidence.browser.hardwareMetalConfirmed)throw new Error('Actual WebGL renderer did not confirm hardware Metal; inspect the receipt instead of claiming a hardware session');
  await atomicJson(paths.ready,{status:'ready-awaiting-explicit-start-marker',evidenceKind:evidence.evidenceKind,runId,windowTitle,target:target.toString(),browser:evidence.browser,paths,instructions:'Select only this dedicated window in OBS and begin recording, then create the start marker. App-mode launch is requested; verify the actual OBS window selection. Stop OBS before creating the stop marker.'});
  await checkpoint('ready-awaiting-explicit-start-marker');
  process.stdout.write(JSON.stringify({status:evidence.status,windowTitle,ready:paths.ready,startMarker,stopMarker})+'\n');
  evidence.startMarkerObservedAt=await waitForMarker(startMarker,{timeoutMs:START_WAIT_MS,signal:interruptController.signal});
  if(interrupted||rootStopRequested)throw new Error('Session cancelled before gameplay');
  await page.bringToFront();
  evidence.calibrationAtStart=await readState();
  startClock=performance.now();evidence.startedAt=new Date().toISOString();evidence.scheduledEndAt=new Date(Date.now()+SESSION_MS).toISOString();
  evidence.presets.push({index:0,title:PRESETS[0],selectedAt:evidence.startedAt,sessionElapsedMs:0});
  await installRafObserver();
  deadlineTimer=setTimeout(()=>{durationReached=true;void pauseSafely('scheduled-30-minute-end').catch(error=>evidence.errors.push(errorRecord(error,'deadline-pause')));},SESSION_MS);
  await raiseCurtain();await checkpoint('running-AI-led-gameplay');
  while(running()){
    const elapsed=performance.now()-startClock,segment=Math.min(2,Math.floor(elapsed/SEGMENT_MS));
    if(segment!==currentPreset){await selectPreset(segment);continue;}
    const state=await observe();if(!running())break;
    if(state.outcome){await restartAfterOutcome();continue;}
    if(state.paused){
      await releaseKeys();const resume=page.getByRole('button',{name:'Back onstage',exact:true});
      if(await resume.isVisible()&&running()){await resume.focus({timeout:3000});await page.keyboard.press('Enter');if(running())await page.getByTestId('game-canvas').focus({timeout:2000});}
      else throw new Error('The rehearsal paused without a visible safe resume control');
    }else{
      await setKeys(inputsFor(state,elapsed));
      if(running()&&elapsed-lastDodge>=1100&&['windup','active','recording'].includes(state.stage)){await page.keyboard.press('Space',{delay:30});evidence.inputOperations++;lastDodge=elapsed;}
    }
    if(performance.now()-lastProgress>=15000){await checkpoint();lastProgress=performance.now();}
    if(running())await page.waitForTimeout(Math.min(140,Math.max(1,SESSION_MS-(performance.now()-startClock))));
  }
  evidence.observedDurationMs=performance.now()-startClock;evidence.completedScheduledDuration=evidence.observedDurationMs>=SESSION_MS&&!interrupted&&!rootStopRequested;
  if(deadlineTimer)clearTimeout(deadlineTimer);
  await pauseSafely(evidence.completedScheduledDuration?'scheduled-30-minute-end':interrupted??'operator-stop');
  await exportPerformance('session-ended-paused');
  if(page&&!page.isClosed())evidence.rafTiming=await page.evaluate(()=>window.__aragozObsRaf?.finish()??null).catch(()=>null);
  evidence.endedAt=new Date().toISOString();
  await checkpoint(evidence.completedScheduledDuration?'duration-complete-paused-window-preserved':'stopped-early-paused-window-preserved');
}catch(error){
  evidence.errors.push(errorRecord(error));if(deadlineTimer)clearTimeout(deadlineTimer);
  if(startClock!==null)evidence.observedDurationMs=performance.now()-startClock;
  await pauseSafely(interrupted??'script-error').catch(pauseError=>evidence.errors.push(errorRecord(pauseError,'pause')));
  if(page&&!page.isClosed()){
    await exportPerformance('interrupted-or-failed-session');
    evidence.rafTiming=await page.evaluate(()=>window.__aragozObsRaf?.finish()??null).catch(()=>null);
  }
  evidence.endedAt=new Date().toISOString();await checkpoint('attention-required-window-preserved');process.exitCode=1;
}finally{
  if(deadlineTimer)clearTimeout(deadlineTimer);await releaseKeys();
  await atomicJson(paths.receipt,{...evidence,receiptAt:new Date().toISOString()});
  process.stdout.write(JSON.stringify({status:evidence.status,receipt:paths.receipt,paused:evidence.pausedAfterRun,stopMarker,notice:'The task window is preserved. Stop OBS before creating the stop marker.'})+'\n');
  // An event-driven hold has no further gameplay/retry loop. The dedicated window
  // stays available to OBS until its owner explicitly releases it with this file.
  if(context&&page&&!page.isClosed()&&!rootStopRequested)await stopPromise;
  if(context){await context.close();evidence.contextClosedAt=new Date().toISOString();}
  if(!rootStopRequested){stopController.abort();await stopPromise;}
  await atomicJson(paths.receipt,{...evidence,status:evidence.status+'-context-closed',receiptAt:new Date().toISOString()});
}
