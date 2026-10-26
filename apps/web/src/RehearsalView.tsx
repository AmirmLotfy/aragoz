import { useEffect, useRef, useState } from 'react';
import { makeModule, makeRecipe, MECHANICS, PROFILE_IDS } from '@aragoz/contracts';
import type { BossRecipe, EncounterEvent } from '@aragoz/contracts';
import type { CombatSnapshot } from '@aragoz/combat';
import { GameCanvas } from './GameCanvas';
import { CombatHud, ControlLegend, QuickMute, RuleList } from './components';
import { rehearsalRecipe, REHEARSALS } from './rehearsal';
import type { Preferences } from './settings';
import type { StageMetrics } from './theatre';

export function RehearsalView({preferences,navigate,onSettings}:{preferences:Preferences;navigate:(p:string)=>void;onSettings:()=>void}){
  const initial=Number(new URLSearchParams(location.search).get('preset')??0)||0;
  const [preset,setPreset]=useState(initial),[act,setAct]=useState(1),[recipe,setRecipe]=useState<BossRecipe|null>(null),[attempt,setAttempt]=useState(()=>crypto.randomUUID());
  const [paused,setPaused]=useState(true),[started,setStarted]=useState(false),[ready,setReady]=useState(false),[snapshot,setSnapshot]=useState<CombatSnapshot|null>(null),[metrics,setMetrics]=useState<StageMetrics|null>(null);
  const [ledger,setLedger]=useState<EncounterEvent[]>([]),[caption,setCaption]=useState<string|null>(null),[loadError,setLoadError]=useState<string|null>(null);
  const hideCaption=useRef<ReturnType<typeof setTimeout>|null>(null);
  useEffect(()=>{let active=true;setRecipe(null);setLoadError(null);setReady(false);setPaused(true);setStarted(false);setSnapshot(null);setMetrics(null);setCaption(null);setLedger([]);setAttempt(crypto.randomUUID());void rehearsalRecipe(preset,act).then(r=>{if(active)setRecipe(r);}).catch(()=>{if(active)setLoadError('This rehearsal recipe could not be prepared.');});return()=>{active=false;};},[preset,act]);
  useEffect(()=>()=>{if(hideCaption.current)clearTimeout(hideCaption.current);},[]);
  const events=(batch:EncounterEvent[])=>{
    setLedger(previous=>[...previous,...batch]);
    for(const e of batch)if(e.kind==='module-activated'||e.kind==='module-broken'){
      const family=recipe?.modules.find(m=>m.slotId===e.moduleSlot)?.mechanicId;setCaption(`${family??'Rule'} ${e.kind==='module-broken'?'broken — ability removed':'takes the stage'} · House Suggestion`);
      if(hideCaption.current)clearTimeout(hideCaption.current);hideCaption.current=setTimeout(()=>setCaption(null),3000);
    }
  };
  const restart=()=>{setReady(false);setAttempt(crypto.randomUUID());setSnapshot(null);setLedger([]);setPaused(true);setStarted(false);};
  const remix=async()=>{if(!recipe)return;setReady(false);const next=PROFILE_IDS.find(p=>MECHANICS[p].family!==recipe.modules[0].mechanicId&&MECHANICS[p].family!==recipe.modules[1].mechanicId)!;const updated=await makeRecipe({roomId:recipe.roomId,actId:recipe.actId,seed:(recipe.seed+1)>>>0,bodyId:recipe.bodyId,difficultyPreset:'rehearsal',modules:[recipe.modules[0],makeModule(next,'right')]});setRecipe(updated);restart();};
  const outcome=snapshot?.outcome;
  if(loadError)return <main className="page narrow"><h1>The rehearsal needs a moment.</h1><p role="alert">{loadError}</p><button className="button" onClick={()=>navigate('/')}>Return home</button></main>;
  return <main className="performance-page"><div className="performance-topline"><div><span className="eyebrow">SOLO REHEARSAL · HOUSE SUGGESTIONS</span><h1>{recipe?.approvedName??'Setting the stage…'}</h1></div><div className="quick-controls"><QuickMute muted={preferences.muted}/><button className="button small" disabled={!started||Boolean(outcome)} onPointerDown={event=>event.preventDefault()} onClick={()=>setPaused(p=>!p)}>{paused?'Resume':'Pause'}</button><button className="button small" onClick={()=>{setPaused(true);onSettings();}}>Sound & controls</button><button className="text-button" onClick={()=>navigate('/')}>Leave rehearsal</button></div></div>
    <div className="stage-frame">{recipe&&<><GameCanvas recipe={recipe} attemptId={attempt} paused={paused||!started||Boolean(outcome)} preferences={preferences} onReadyChange={setReady} onSnapshot={setSnapshot} onEvents={events} onAutoPause={()=>setPaused(true)} onMetrics={setMetrics}/><CombatHud recipe={recipe} snapshot={snapshot} act={act} preferences={preferences} mode="HOUSE REHEARSAL"/>
      {!started&&<div className="stage-overlay"><section className="instruction-card"><span className="eyebrow">THE CURTAIN IS YOURS</span><h2>Every boast has a loophole.</h2><p>Move. Read the tell. Make the villain’s own rule backfire.</p><RuleList modules={recipe.modules}/><ControlLegend keys={preferences.keys}/><button className="button primary" disabled={!ready} onClick={()=>{setStarted(true);setPaused(false);}}>{ready?'Raise the curtain':'Preparing the stage…'}</button><small>Preset opponents. All suggestions are authored by the House.</small></section></div>}
      {started&&paused&&!outcome&&<div className="stage-overlay"><section className="pause-card"><span className="eyebrow">INTERMISSION</span><h2>Take your time.</h2><p>The fight is paused.</p><button className="button primary" onClick={()=>setPaused(false)}>Back onstage</button><button className="text-button" onClick={restart}>Restart this encounter</button></section></div>}
      {outcome&&<div className="stage-overlay"><section className="showbill"><span className="eyebrow">{outcome==='won'?'THE EVENING’S SHOWBILL':'THE CURTAIN FALLS'}</span><h2>{outcome==='won'?'A boast beautifully broken.':'The villain gets the last word.'}</h2><p>{outcome==='won'?'Both attachments broke. Both abilities stopped.':'A fresh attempt keeps the same recipe and its loopholes.'}</p><RuleList modules={recipe.modules}/><p className="showbill-stat">{ledger.filter(e=>e.kind==='flaw-exposed').length} openings · {snapshot?.modules.filter(m=>m.broken).length??0} modules broken · {Math.round(snapshot?.elapsed??0)} seconds</p><div className="button-row"><button className="button primary" onClick={restart}>Encore · same recipe</button><button className="button" onClick={()=>{setPreset((preset+1)%REHEARSALS.length);setAct(act===3?1:act+1);}}>Next act · new configuration</button></div><button className="text-button" onClick={()=>void remix()}>Remix the right-hand contract</button></section></div>}
      {caption&&started&&!paused&&!outcome&&<div className="author-caption" role="status">{caption}</div>}
    </>}</div>
    <div className="stage-footnote"><span>{metrics?.geometry??'Preparing stage geometry…'}</span><span>{metrics?.fps??'—'} fps · {metrics?Math.round(metrics.triangles).toLocaleString():'—'} triangles</span></div>
    <section className="below-stage"><p><strong>The useful trick:</strong> the striped blocks are part of the act. A committed charge cannot steer around them. Steam stops when its valve breaks. Echo repeats a real movement trail, even when it leads somewhere foolish.</p><div className="rehearsal-selector" aria-label="Rehearsal configurations">{REHEARSALS.map((p,i)=><button key={p.id} className={'button small '+(i===preset%REHEARSALS.length?'selected':'')} onClick={()=>{setPreset(i);setAct(1);}}>{p.title}</button>)}</div></section>
  </main>;
}
