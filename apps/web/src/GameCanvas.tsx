import { useEffect, useRef, useState } from 'react';
import { CombatSimulation } from '@aragoz/combat';
import type { CombatSnapshot, PlayerInput } from '@aragoz/combat';
import { validateRecipe } from '@aragoz/contracts';
import type { BossRecipe, EncounterEvent } from '@aragoz/contracts';
import { Theatre } from './theatre';
import type { StageMetrics } from './theatre';
import type { Preferences } from './settings';
import { StageAudio } from './audio';
import { PerformanceRecorder } from './telemetry';
import { controlDescription, ownsGameKeyboard } from './controls';
import { hardwareScalingLevel } from './rendering';
import { assemblyProgress } from './assembly';
import { PresentationClock } from './presentation';
import { resolveStrikeAim } from './aim-assist';

interface Props {
  recipe: BossRecipe; attemptId: string; paused: boolean; preferences: Preferences; previewChannel?: string; assemble?: boolean;
  onSnapshot?: (snapshot: CombatSnapshot) => void; onEvents?: (events: EncounterEvent[]) => void;
  onReadyChange?: (ready: boolean) => void; onAutoPause?: () => void; onMetrics?: (metrics: StageMetrics) => void;
}
export function GameCanvas(props: Props) {
  const canvas=useRef<HTMLCanvasElement>(null), latest=useRef(props), stageRef=useRef<Theatre|null>(null), audioRef=useRef<StageAudio|null>(null);
  const [error,setError]=useState<string|null>(null); latest.current=props;
  useEffect(()=>{stageRef.current?.engine.setHardwareScalingLevel(hardwareScalingLevel(props.preferences.quality,window.devicePixelRatio));stageRef.current?.resize();audioRef.current?.setPreferences(props.preferences);},[props.preferences]);
  useEffect(()=>{
    let cancelled=false,failed=false,released=false,stage:Theatre|null=null,audio:StageAudio|null=null,simulation:CombatSimulation|null=null,channel:BroadcastChannel|null=null;
    const element=canvas.current;
    const keys=new Set<string>();let pointerDown=false,dodge=false,aim:{x:number;z:number}|null=null,previewRequested=false;
    const telemetry=new PerformanceRecorder();let lastMetrics:StageMetrics|null=null;
    let last=performance.now(),accumulator=0,lastRender=0,lastReport=0,lastPreview=0,previousSnapshot:CombatSnapshot|null=null;
    let assemblyStarted=0,assembly=props.assemble?0:1,presentationReady=false,wasPaused=true;
    const updatePresentationDiagnostics=()=>{if(element){element.dataset.assemblyProgress=String(assembly);element.dataset.presentationReady=String(presentationReady);}};
    const updateDiagnostics=(snapshot:CombatSnapshot)=>{if(!canvas.current)return;updatePresentationDiagnostics();Object.assign(canvas.current.dataset,{simTick:String(snapshot.tick),paused:String(snapshot.paused),heroPosition:JSON.stringify(snapshot.hero.position),bossPosition:JSON.stringify(snapshot.boss.position),bossFacing:JSON.stringify(snapshot.boss.facing),bossStage:snapshot.boss.stage,activeSlot:snapshot.boss.activeSlot??'',modules:JSON.stringify(snapshot.modules),families:props.recipe.modules.map(m=>m.mechanicId).join(','),outcome:snapshot.outcome??'',recipeHash:props.recipe.hash,attemptId:props.attemptId});};
    setError(null);
    updatePresentationDiagnostics();
    latest.current.onReadyChange?.(false);
    const keydown=(e:KeyboardEvent)=>{if(!ownsGameKeyboard({paused:latest.current.paused||!presentationReady,focused:document.activeElement===element,defaultPrevented:e.defaultPrevented,altKey:e.altKey,ctrlKey:e.ctrlKey,metaKey:e.metaKey}))return;if(e.code==='Escape'){e.preventDefault();latest.current.onAutoPause?.();return;}
      const bindings=latest.current.preferences.keys;
      if(Object.values(bindings).includes(e.code)||e.code.startsWith('Arrow')){e.preventDefault();keys.add(e.code);if(e.code===bindings.dodge&&!e.repeat)dodge=true;}
    };
    const keyup=(e:KeyboardEvent)=>keys.delete(e.code);
    const pointer=(e:PointerEvent)=>{aim=stage?.pointerToWorld(e.clientX,e.clientY)??null;};
    const down=(e:PointerEvent)=>{if(e.button===0&&!latest.current.paused&&presentationReady){pointerDown=true;pointer(e);void audio?.unlock();canvas.current?.focus({preventScroll:true});}};
    const up=()=>{pointerDown=false;};
    const blur=()=>{keys.clear();pointerDown=false;dodge=false;if(!latest.current.paused)latest.current.onAutoPause?.();};
    const visibility=()=>{if(document.hidden)blur();};
    const unlock=()=>{void audio?.unlock();};
    const resize=()=>stage?.resize();
    const performanceMetadata=()=>({resolution:canvas.current?{width:canvas.current.width,height:canvas.current.height}:null,profiles:props.recipe.modules.map(m=>m.profileId),mechanicLibraryVersion:props.recipe.mechanicLibraryVersion,artKitVersion:props.recipe.artKitVersion,presentationFps:latest.current.preferences.presentationFps,quality:latest.current.preferences.quality});
    const exportPerformance=()=>telemetry.download(performanceMetadata());
    const reportPerformance=()=>window.dispatchEvent(new CustomEvent('aragoz:performance-report',{detail:telemetry.report(performanceMetadata())}));
    let observer:ResizeObserver|null=null;
    const release=()=>{
      if(released)return;released=true;
      observer?.disconnect();channel?.close();window.removeEventListener('keydown',keydown);window.removeEventListener('keyup',keyup);window.removeEventListener('pointerup',up);window.removeEventListener('blur',blur);window.removeEventListener('aragoz:request-pause',blur);window.removeEventListener('aragoz:export-performance',exportPerformance);window.removeEventListener('aragoz:request-performance',reportPerformance);window.removeEventListener('pointerdown',unlock);window.removeEventListener('keydown',unlock);document.removeEventListener('visibilitychange',visibility);element?.removeEventListener('pointerdown',down);element?.removeEventListener('pointermove',pointer);element?.removeEventListener('blur',blur);audio?.dispose();stage?.dispose();
      if(stageRef.current===stage)stageRef.current=null;if(audioRef.current===audio)audioRef.current=null;
    };
    const fail=(message:string)=>{
      if(cancelled||failed)return;failed=true;presentationReady=false;updatePresentationDiagnostics();keys.clear();pointerDown=false;dodge=false;accumulator=0;simulation?.setPaused(true);
      if(simulation){const pausedSnapshot=simulation.snapshot();updateDiagnostics(pausedSnapshot);latest.current.onSnapshot?.(pausedSnapshot);}
      latest.current.onReadyChange?.(false);latest.current.onAutoPause?.();setError(message);release();
    };
    void(async()=>{
      try{
        await validateRecipe(props.recipe);if(cancelled||!element)return;
        simulation=new CombatSimulation(props.recipe,props.attemptId);stage=new Theatre(element,props.recipe,latest.current.preferences);stageRef.current=stage;
        stage.engine.onContextLostObservable.add(()=>fail('Graphics were interrupted. Reload to reopen the stage safely.'));
        audio=new StageAudio(latest.current.preferences);audioRef.current=audio;
        if(props.previewChannel&&typeof BroadcastChannel!=='undefined'){
          channel=new BroadcastChannel(props.previewChannel);channel.onmessage=e=>{if(e.data?.type==='request-preview')previewRequested=true;};
        }
        window.addEventListener('keydown',keydown);window.addEventListener('keyup',keyup);window.addEventListener('pointerup',up);window.addEventListener('blur',blur);window.addEventListener('aragoz:request-pause',blur);window.addEventListener('aragoz:export-performance',exportPerformance);window.addEventListener('aragoz:request-performance',reportPerformance);document.addEventListener('visibilitychange',visibility);
        element.addEventListener('pointerdown',down);element.addEventListener('pointermove',pointer);element.addEventListener('blur',blur);window.addEventListener('pointerdown',unlock,{once:true});window.addEventListener('keydown',unlock,{once:true});
        observer=new ResizeObserver(resize);observer.observe(element);await stage.loadApprovedAssets();if(cancelled||failed)return;
        presentationReady=!props.assemble;simulation.setPaused(latest.current.paused||!presentationReady);wasPaused=latest.current.paused||!presentationReady;previousSnapshot=simulation.snapshot();last=performance.now();assemblyStarted=last;
        stage.render(previousSnapshot,last/1000,latest.current.preferences,assembly);lastRender=last;
        const presentationClock=new PresentationClock(last,presentationReady&&previousSnapshot.paused&&!previousSnapshot.outcome?15:latest.current.preferences.presentationFps);
        let lastPresentedPaused=previousSnapshot.paused;
        if(!latest.current.paused&&presentationReady)element.focus({preventScroll:true});
        updateDiagnostics(previousSnapshot);if(presentationReady)latest.current.onReadyChange?.(true);latest.current.onSnapshot?.(previousSnapshot);
        stage.engine.runRenderLoop(()=>{
          if(cancelled||failed||!stage||!simulation)return;
          try{
          const now=performance.now(),rawMs=now-last,dt=Math.min(0.25,rawMs/1000);last=now;
          const p=latest.current,previous=previousSnapshot!;
          if(!presentationReady)assembly=Math.max(assembly,assemblyProgress(now-assemblyStarted,p.preferences.reducedMotion));
          const paused=p.paused||!presentationReady,pauseChanged=paused!==wasPaused;wasPaused=paused;simulation.setPaused(paused);accumulator=paused?0:accumulator+dt;
          if(pauseChanged){keys.clear();pointerDown=false;dodge=false;if(!paused)element.focus({preventScroll:true});}
          while(accumulator>=1/60){
            const k=p.preferences.keys;
            const moveX=Number(keys.has(k.right)||keys.has('ArrowRight'))-Number(keys.has(k.left)||keys.has('ArrowLeft'));
            const moveZ=Number(keys.has(k.down)||keys.has('ArrowDown'))-Number(keys.has(k.up)||keys.has('ArrowUp'));
            const {x:ax,z:az}=resolveStrikeAim(previous,aim,p.preferences.aimAssist);
            const input:PlayerInput={moveX,moveZ,aimX:ax,aimZ:az,strike:pointerDown||keys.has(k.strike),dodge};dodge=false;
            simulation.step(input);accumulator-=1/60;
          }
          const events=simulation.drainEvents();if(events.length){events.forEach(e=>audio?.event(e));p.onEvents?.(events);}
          const snapshot=simulation.snapshot();previousSnapshot=snapshot;
          const presentationFps=presentationReady&&paused&&!snapshot.outcome?Math.min(15,p.preferences.presentationFps):p.preferences.presentationFps;
          if(presentationClock.due(now,presentationFps,!presentationReady&&assembly===1)){const interval=lastRender?now-lastRender:null;stage.render(snapshot,now/1000,p.preferences,assembly);lastRender=now;if(interval!==null)telemetry.frame(interval,paused||lastPresentedPaused,lastMetrics);lastPresentedPaused=paused;
            if(!presentationReady){
              // Readiness follows the actual seated frame, never the server's short assembly phase.
              if(assembly===1){presentationReady=true;keys.clear();pointerDown=false;dodge=false;p.onReadyChange?.(true);}
              updatePresentationDiagnostics();
            }
            if(channel&&previewRequested&&now-lastPreview>=1000){const frame=stage.capturePreview();if(frame)channel.postMessage({type:'preview-frame',frame});lastPreview=now;previewRequested=false;}
          }
          if(pauseChanged||now-lastReport>=(paused&&presentationReady?500:120)){
            updateDiagnostics(snapshot);
            lastMetrics=stage.metrics();
            if(canvas.current){canvas.current.dataset.geometry=lastMetrics.geometry;canvas.current.dataset.triangles=String(lastMetrics.triangles);canvas.current.dataset.drawCalls=String(lastMetrics.drawCalls);}
            p.onSnapshot?.(snapshot);p.onMetrics?.(lastMetrics);lastReport=now;
          }
          }catch(e){fail(e instanceof Error?e.message:'The stage was interrupted. Reload to reopen it safely.');}
        });
      }catch(e){fail(e instanceof Error?e.message:'The stage could not open in this browser.');}
    })();
    return()=>{cancelled=true;release();};
  },[props.recipe.hash,props.attemptId,props.previewChannel,props.assemble]);
  return <div className="canvas-wrap"><canvas ref={canvas} className="game-canvas" tabIndex={0} aria-label={'ARAGOZ playable theatre. '+controlDescription(props.preferences.keys)} data-testid="game-canvas" data-stage-error={Boolean(error)} data-assembly-progress={props.assemble?0:1} data-presentation-ready="false"/>{error&&<div className="stage-error" role="alert"><h2>The stage needs to reopen.</h2><p>{error}</p><p>Use a desktop browser with WebGL hardware acceleration enabled. Live shows return to a safe restart screen with the same accepted recipe.</p><button className="button" onClick={()=>window.location.reload()}>Reload the stage</button></div>}</div>;
}
