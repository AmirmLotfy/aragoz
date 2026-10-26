import { useEffect, useRef, useState } from 'react';
import { makeModule, MECHANICS } from '@aragoz/contracts';
import type { Candidate, EncounterEvent, SlotId } from '@aragoz/contracts';
import type { CombatSnapshot } from '@aragoz/combat';
import { GameCanvas } from './GameCanvas';
import { CombatHud, ControlLegend, Placards, QuickMute, RuleList, ShowbillHistory } from './components';
import type { Preferences } from './settings';
import type { StageMetrics } from './theatre';
import { applyHouseEvents, beginHouseAttempt, beginHouseRemix, cancelHouseRemix, chooseHouseProfile, createHouseShow, endHouseShow, houseChoices, houseRecipe, nextHouseAct, noteHouseProgress, parseHouseShow, recoverHouseShow, restartHouseEncounter, restartHouseSelection, skipHouseAct } from './house-show';
import type { HouseShow } from './house-show';

export const HOUSE_STORAGE_KEY='aragoz.house-show.v1';
interface SaveEnvelope { version:1; writerId:string; show:HouseShow; }
function envelope(raw:string):SaveEnvelope {
  const value:unknown=JSON.parse(raw);
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('The saved House show could not be read.');
  const v=value as Partial<SaveEnvelope>;
  if(v.version!==1||typeof v.writerId!=='string'||!v.writerId||!v.show)throw new Error('This saved House show is not supported.');
  return v as SaveEnvelope;
}
const ACTS=['I','II','III'];

export function HouseShowView({preferences,navigate,onSettings}:{preferences:Preferences;navigate:(path:string)=>void;onSettings:()=>void}){
  const [show,setShow]=useState<HouseShow|null>(null),[owned,setOwned]=useState(false),[paused,setPaused]=useState(true),[ready,setReady]=useState(false);
  const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[saveWarning,setSaveWarning]=useState<string|null>(null),[error,setError]=useState<string|null>(null);
  const [snapshot,setSnapshot]=useState<CombatSnapshot|null>(null),[metrics,setMetrics]=useState<StageMetrics|null>(null),[caption,setCaption]=useState<string|null>(null);
  const [confirm,setConfirm]=useState<'end'|'new'|null>(null);
  const writerId=useRef(crypto.randomUUID()),state=useRef<HouseShow|null>(null),controller=useRef(false),storageAvailable=useRef(true),mounted=useRef(false),loadGeneration=useRef(0),lastProgressTick=useRef(0);
  const captionTimer=useRef<ReturnType<typeof setTimeout>|null>(null);

  function loseControl(){controller.current=false;setOwned(false);setPaused(true);setReady(false);setBusy(false);}
  function publish(next:HouseShow,force=false):boolean {
    if(!mounted.current)return false;
    if(storageAvailable.current){
      try{
        const raw=localStorage.getItem(HOUSE_STORAGE_KEY);
        if(!force&&raw&&envelope(raw).writerId!==writerId.current){loseControl();return false;}
        localStorage.setItem(HOUSE_STORAGE_KEY,JSON.stringify({version:1,writerId:writerId.current,show:next} satisfies SaveEnvelope));
      }catch{storageAvailable.current=false;setSaveWarning('Saving is unavailable in this browser. You can play here; refreshing will start a new show.');}
    }
    state.current=next;setShow(next);return true;
  }
  useEffect(()=>{
    mounted.current=true;let active=true;
    const load=async()=>{
      try{
        let raw:string|null;
        try{raw=localStorage.getItem(HOUSE_STORAGE_KEY);}catch{storageAvailable.current=false;setSaveWarning('Saving is unavailable in this browser. You can play here; refreshing will start a new show.');raw=null;}
        if(raw){const saved=envelope(raw);const parsed=await parseHouseShow(JSON.stringify(saved.show));if(!active)return;state.current=parsed;setShow(parsed);}
        else if(active){controller.current=true;setOwned(true);publish(createHouseShow(),true);}
      }catch{if(active)setError('The saved House show is damaged or belongs to a newer version. Start a fresh show to continue.');}
      finally{if(active)setLoading(false);}
    };
    const external=(event:StorageEvent)=>{
      if(event.key!==HOUSE_STORAGE_KEY)return;
      ++loadGeneration.current;loseControl();setError(null);
      if(!event.newValue){state.current=null;setShow(null);return;}
      try{const saved=envelope(event.newValue);const generation=loadGeneration.current;void parseHouseShow(JSON.stringify(saved.show)).then(parsed=>{if(active&&generation===loadGeneration.current){state.current=parsed;setShow(parsed);}}).catch(()=>{if(active)setError('The saved House show could not be read. Start a fresh show to continue.');});}
      catch{setError('The saved House show could not be read. Start a fresh show to continue.');}
    };
    window.addEventListener('storage',external);void load();
    return()=>{active=false;mounted.current=false;++loadGeneration.current;controller.current=false;window.removeEventListener('storage',external);if(captionTimer.current)clearTimeout(captionTimer.current);};
  },[]);

  useEffect(()=>{if(owned)window.scrollTo({top:0,behavior:'instant'});},[owned,show?.phase,show?.actIndex,show?.selection?.slot]);

  async function takeControl(){
    setBusy(true);setError(null);const generation=++loadGeneration.current;
    try{
      let next=state.current,raw:string|null=null;
      if(storageAvailable.current){try{raw=localStorage.getItem(HOUSE_STORAGE_KEY);}catch{storageAvailable.current=false;setSaveWarning('Saving is unavailable in this browser. You can play here; refreshing will start a new show.');}}
      if(raw){const saved=envelope(raw);next=await parseHouseShow(JSON.stringify(saved.show));if(localStorage.getItem(HOUSE_STORAGE_KEY)!==raw)throw new Error('The saved show just changed. Choose Continue again to use its latest state.');}
      if(!mounted.current||generation!==loadGeneration.current)return;
      const resumed=next?recoverHouseShow(next):createHouseShow();controller.current=true;setOwned(true);setPaused(true);setReady(false);setSnapshot(null);setMetrics(null);lastProgressTick.current=0;publish(resumed,true);
    }catch(e){setError(e instanceof Error?e.message:'The show could not reopen.');}
    finally{if(mounted.current)setBusy(false);}
  }
  function freshShow(){++loadGeneration.current;controller.current=true;setOwned(true);setError(null);setConfirm(null);setPaused(true);setReady(false);setSnapshot(null);setMetrics(null);setCaption(null);lastProgressTick.current=0;publish(createHouseShow(),true);}
  async function action(change:(current:HouseShow)=>HouseShow|Promise<HouseShow>){
    const current=state.current;if(!current||!controller.current||busy)return;
    const revision=current.revision,generation=loadGeneration.current;setBusy(true);setError(null);
    try{const next=await change(current);if(!mounted.current||!controller.current||generation!==loadGeneration.current||state.current?.revision!==revision)return;if(next!==current){setPaused(true);setConfirm(null);setSnapshot(null);setMetrics(null);setCaption(null);if(next.attempt?.id!==current.attempt?.id||next.currentRecipeId!==current.currentRecipeId){setReady(false);lastProgressTick.current=0;}publish(next);}}
    catch(e){if(mounted.current)setError(e instanceof Error?e.message:'That cue could not be prepared.');}
    finally{if(mounted.current)setBusy(false);}
  }
  const recipe=show?houseRecipe(show):null,attemptId=show?.attempt?.id??'';
  function events(batch:EncounterEvent[]){
    const current=state.current;if(!current||!controller.current)return;const next=applyHouseEvents(current,batch);if(next===current)return;
    if(publish(next)&&next.phase==='result')setPaused(true);
    for(const event of batch){
      if(event.attemptId!==current.attempt?.id||event.recipeHash!==houseRecipe(current)?.hash||!['module-activated','module-broken'].includes(event.kind))continue;
      const family=houseRecipe(current)?.modules.find(module=>module.slotId===event.moduleSlot)?.mechanicId;
      setCaption(`${family??'Rule'} ${event.kind==='module-broken'?'broken — ability removed':'takes the stage'} · House Suggestion`);
      if(captionTimer.current)clearTimeout(captionTimer.current);captionTimer.current=setTimeout(()=>setCaption(null),3000);
    }
  }
  function progress(next:CombatSnapshot){
    const current=state.current;if(!current||!controller.current||current.attempt?.id!==attemptId||houseRecipe(current)?.hash!==recipe?.hash)return;setSnapshot(next);if(next.tick-lastProgressTick.current<60)return;
    lastProgressTick.current=next.tick;const updated=noteHouseProgress(current,{attemptId,recipeHash:recipe?.hash??'',tick:next.tick});if(updated!==current)publish(updated);
  }
  function raise(){const current=state.current;if(!current||!ready||!controller.current)return;const next=beginHouseAttempt(current);if(next!==current&&publish(next))setPaused(false);}
  function download(){if(!show)return;const url=URL.createObjectURL(new Blob([JSON.stringify(show,null,2)+'\n'],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='aragoz-'+show.id+'-showbill.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  const result=show?.results.find(entry=>entry.attemptId===show.attempt?.id);
  const selected=show?.selection?Object.entries(show.selection.profiles).map(([slot,profile])=>makeModule(profile,slot as SlotId)):[];
  const candidates:Candidate[]=show?houseChoices(show).map(profile=>({id:profile,profileId:profile,sourceProposalId:null,credit:{source:'house',authorId:null,displayName:'House Suggestion',hidden:false},approved:true,adaptation:null})):[];

  if(loading)return <main className="page narrow"><h1>Opening the House.</h1><p role="status">Checking your saved show…</p></main>;
  if(!owned)return <main className="page narrow house-recovery"><span className="eyebrow">YOUR THREE-ACT HOUSE SHOW</span><h1>{error?'The curtain needs resetting.':'Your show is saved here.'}</h1><p>Choose Continue to control this show in this window. Any other window playing it will pause.</p>{show&&<p>Act {ACTS[show.actIndex-1]} · {show.results.length} recorded attempts · {show.phase==='combat'?'unfinished fight':show.phase}</p>}{show?.phase==='combat'&&<p>An unfinished fight is recorded as abandoned. Its same recipe reopens at a paused restart screen.</p>}{error&&<p className="notice error" role="alert">{error}</p>}{saveWarning&&<p className="notice" role="status">{saveWarning}</p>}<div className="button-row">{show&&<button className="button primary" disabled={busy} onClick={()=>void takeControl()}>Continue in this window</button>}<button className="button" onClick={()=>setConfirm('new')}>Start a fresh House show</button><button className="text-button" onClick={()=>navigate('/')}>Return home</button></div>{confirm==='new'&&<section className="notice"><h2>Start a fresh show?</h2><p>This replaces this browser’s current save.</p><button className="button primary" onClick={freshShow}>Start new House show</button><button className="text-button" onClick={()=>setConfirm(null)}>Keep the saved show</button></section>}</main>;
  if(!show)return null;
  return <main className="performance-page house-show-page" data-testid="house-show" data-house-phase={show.phase} data-show-id={show.id}>
    <div className="performance-topline"><div><span className="eyebrow">SOLO HOUSE SHOW · NO ACCOUNT REQUIRED</span><h1>{show.phase==='showbill'?'The evening’s showbill':`Act ${ACTS[show.actIndex-1]} · ${recipe?.approvedName??'Choose a boast worth breaking.'}`}</h1></div><div className="quick-controls"><QuickMute muted={preferences.muted}/>{show.phase==='combat'&&<button className="button small" onPointerDown={event=>event.preventDefault()} onClick={()=>setPaused(p=>!p)}>{paused?'Resume':'Pause'}</button>}<button className="button small" onClick={()=>{setPaused(true);onSettings();}}>Sound & controls</button>{show.phase!=='showbill'&&<button className="text-button" onClick={()=>{setPaused(true);setConfirm('end');}}>End show</button>}<button className="text-button" onClick={()=>navigate('/')}>Leave show</button></div></div>
    <ol className="house-act-progress" aria-label="Three-act show">{ACTS.map((act,i)=><li key={act} aria-current={show.phase!=='showbill'&&i===show.actIndex-1?'step':undefined}><span>Act {act}</span><small>{i<show.actIndex-1?'Recorded':i===show.actIndex-1?show.phase==='showbill'?'Recorded':'Onstage':'Coming next'}</small></li>)}</ol>
    {saveWarning&&<p className="notice" role="status">{saveWarning}</p>}{error&&<p className="notice error" role="alert">{error}</p>}
    {confirm&&<section className="notice house-confirm"><h2>{confirm==='end'?'Close this House show?':'Start another show?'}</h2><p>{confirm==='end'?'An unfinished committed encounter is recorded as abandoned. Your contracts and results stay in the showbill.':'A new show replaces this browser’s current save. Download this showbill first to keep a copy.'}</p><button className="button primary" disabled={busy} onClick={()=>confirm==='new'?freshShow():void action(endHouseShow)}>{confirm==='new'?'Start new House show':'Close the show'}</button><button className="text-button" onClick={()=>setConfirm(null)}>Keep this show open</button></section>}
    {show.phase==='choose'&&show.selection&&<section className="house-contract-choice" aria-labelledby="house-choice-title"><div className="house-choice-heading"><span className="eyebrow">{show.selection.remixOf?'REMIX ONE ATTACHMENT':show.selection.slot==='left'?'CONTRACT 1 OF 2':'CONTRACT 2 OF 2'}</span><h2 id="house-choice-title">{show.selection.remixOf?`Replace the ${show.selection.slot} attachment.`:show.selection.slot==='left'?'Choose the first boast.':'Choose its partner.'}</h2><p>Each power comes with a flaw you can exploit. Every choice is authored by the House.</p></div>{selected.length>0&&<aside className="house-kept-contract"><span className="eyebrow">{show.selection.remixOf?'THIS ATTACHMENT STAYS':'ALREADY CHOSEN'}</span><RuleList modules={selected}/></aside>}<Placards candidates={candidates} privateControls={candidate=><button className="button primary" disabled={busy||Boolean(confirm)} onClick={()=>void action(current=>chooseHouseProfile(current,candidate.profileId))}>Choose {MECHANICS[candidate.profileId].title}</button>}/><div className="button-row">{show.selection.remixOf?<button className="text-button" disabled={busy} onClick={()=>void action(cancelHouseRemix)}>Keep the current recipe</button>:show.selection.slot==='right'?<button className="text-button" disabled={busy} onClick={()=>void action(restartHouseSelection)}>Choose the first contract again</button>:null}</div><p className="house-save-note">Three acts. Two different attachments each act. Your show saves in this browser.</p></section>}
    {recipe&&show.attempt&&['ready','combat'].includes(show.phase)&&<><div className="stage-frame"><GameCanvas key={attemptId} recipe={recipe} attemptId={attemptId} assemble paused={!owned||show.phase!=='combat'||paused||Boolean(confirm)} preferences={preferences} onReadyChange={setReady} onSnapshot={progress} onEvents={events} onAutoPause={()=>setPaused(true)} onMetrics={setMetrics}/><CombatHud recipe={recipe} snapshot={snapshot} act={show.actIndex} preferences={preferences} mode="HOUSE SHOW"/>
      {show.phase==='ready'&&<div className="stage-overlay"><section className="instruction-card"><span className="eyebrow">THE HOUSE HAS BUILT A VILLAIN</span><h2>Two boasts. Two loopholes.</h2><RuleList modules={recipe.modules}/><ControlLegend keys={preferences.keys}/><button className="button primary" disabled={!ready||busy||Boolean(confirm)} onClick={raise}>{ready?'Raise the curtain':'Assembling the villain…'}</button><small>All contracts: House Suggestion. No live audience is connected.</small></section></div>}
      {show.phase==='combat'&&paused&&<div className="stage-overlay"><section className="pause-card"><span className="eyebrow">INTERMISSION</span><h2>Take your time.</h2><p>The fight is paused.</p><button className="button primary" disabled={Boolean(confirm)} onClick={()=>setPaused(false)}>Back onstage</button><button className="text-button" disabled={busy} onClick={()=>void action(restartHouseEncounter)}>Restart this encounter</button><button className="text-button" disabled={busy} onClick={()=>void action(skipHouseAct)}>Skip this act</button></section></div>}
      {caption&&show.phase==='combat'&&!paused&&<div className="author-caption" role="status">{caption}</div>}
    </div><div className="stage-footnote"><span>{metrics?.geometry??'Preparing stage geometry…'}</span><span>{metrics?.fps??'—'} fps · {metrics?Math.round(metrics.triangles).toLocaleString():'—'} triangles</span></div></>}
    {show.phase==='result'&&result&&recipe&&<section className="showbill house-result"><span className="eyebrow">ACT {ACTS[show.actIndex-1]} · {result.outcome.toUpperCase()}</span><h2>{result.outcome==='won'?'A boast beautifully broken.':'The villain gets the last word.'}</h2><p>{result.brokenSlots.length} modules broken · {result.exploits} openings · {Math.round(result.durationTicks/60)} seconds</p><RuleList modules={recipe.modules}/><div className="button-row"><button className="button primary" disabled={busy} onClick={()=>void action(nextHouseAct)}>{show.actIndex===3?'Close the three-act show':'Next act'}</button><button className="button" disabled={busy} onClick={()=>void action(restartHouseEncounter)}>Encore · same recipe</button></div><div className="house-remix-controls"><span>Remix one attachment:</span>{(['left','right'] as const).map(slot=><button key={slot} className="text-button" disabled={busy} onClick={()=>void action(current=>beginHouseRemix(current,slot))}>Remix {slot} attachment</button>)}</div></section>}
    {show.phase==='showbill'&&<section className="house-finale"><span className="eyebrow">THE HOUSE TAKES A BOW</span><h2>Your rules. Your loopholes.</h2><p>{show.results.filter(r=>r.outcome==='won').length} wins · {show.results.filter(r=>r.outcome==='lost').length} defeats · {show.results.filter(r=>r.outcome==='skipped').length} skipped · {show.results.filter(r=>r.outcome==='abandoned').length} abandoned</p><p>Every contract below was authored by the House. This is your local show record.</p><div className="button-row"><button className="button primary" onClick={()=>setConfirm('new')}>Start another show</button><button className="button" onClick={download}>Download this showbill</button><button className="text-button" onClick={()=>navigate('/')}>Return home</button></div></section>}
    {show.results.length>0&&show.phase!=='combat'&&<section className="showbill-history-section"><span className="eyebrow">THE RECORD OF THE EVENING</span><h2>{show.phase==='showbill'?'Every contract. Every attempt.':'Earlier in this show'}</h2><ShowbillHistory roomId={show.id} recipes={show.recipes} results={show.results} hideAuthors={false}/></section>}
  </main>;
}
