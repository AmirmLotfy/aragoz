import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { creditLabel, MECHANICS, ruleCaption } from '@aragoz/contracts';
import type { BossRecipe, Candidate, EncounterResult, FamilyId, RecipeModule } from '@aragoz/contracts';
import type { CombatSnapshot } from '@aragoz/combat';
import type { Preferences } from './settings';
import { keyLabel } from './settings';
import { canBindKey, movementKeyLabel } from './controls';
import { showbillEntries } from './showbill';

export function Glyph({family,broken=false}:{family:FamilyId;broken?:boolean}){
  return <svg viewBox="0 0 48 48" className={'glyph '+(broken?'is-broken':'')} fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
    {family==='charge'?<><circle cx="24" cy="26" r="14"/><circle cx="24" cy="26" r="4"/><path d="M24 12v10m0 8v10M10 26h10m8 0h10M5 7h20m-10 5H3"/></>:family==='steam'?<><path d="M12 25h25v12H12zM16 21h17M16 15c-7-6 6-7 0-12m10 12c-7-6 6-7 0-12M37 28c10-3 10 9 0 7M11 29 4 22m16 15v5m10-5v5"/></>:<><path d="M11 7h26v34H11zM16 12h16v24H16zM20 17l7 5-7 6m2-15 5 22M4 13v19m-3-7 3 7 4-7"/></>}
    {broken&&<path d="m6 43 36-36" strokeWidth="4"/>}
  </svg>;
}
export function Mark({small=false}:{small?:boolean}){
  return <span className={'wordmark '+(small?'wordmark-small':'')}><span>ARAGOZ</span><span className="arabic-mark" lang="ar" dir="rtl">أراجوز</span></span>;
}
export function QuickMute({muted}:{muted:boolean}){
  return <button className="button small" aria-pressed={muted} aria-label={muted?'Unmute game audio':'Mute game audio'} onClick={()=>window.dispatchEvent(new Event('aragoz:toggle-mute'))}>{muted?'Unmute':'Mute'}</button>;
}
export function Header({navigate,onSettings,privateView=false}:{navigate:(path:string)=>void;onSettings:()=>void;privateView?:boolean}){
  return <header className="site-header"><a href="/" className="brand" onClick={e=>{e.preventDefault();navigate('/');}} aria-label="ARAGOZ home"><Mark small/></a><span className="header-note">{privateView?'PRIVATE BACKSTAGE':'A LIVE PUPPET BOSS THEATRE'}</span><nav aria-label="Main"><button className="text-button" onClick={()=>navigate('/setup')}>Twitch setup</button><button className="text-button" onClick={onSettings}>Settings</button></nav></header>;
}
export function Timer({deadline,opensAt,delayed=false}:{deadline:number|null;opensAt?:number|null;delayed?:boolean}){
  const [now,setNow]=useState(Date.now());useEffect(()=>{const t=setInterval(()=>setNow(Date.now()),250);return()=>clearInterval(t);},[]);
  const target=delayed?opensAt:deadline;const remaining=target?Math.max(0,Math.ceil((target-now)/1000)):0;
  return <span className="timer" aria-label={(delayed?'Opens in ':'Closes in ')+remaining+' seconds'}>{delayed?'OPENS IN':'CLOSES IN'} <strong>{remaining}s</strong></span>;
}
export function Placards({candidates,hideAuthors,votes,privateControls}:{candidates:Candidate[];hideAuthors?:boolean;votes?:[number,number,number];privateControls?:(candidate:Candidate)=>ReactNode}){
  return <div className="placards">{candidates.map((c,i)=>{const p=MECHANICS[c.profileId];return <article className="placard" key={c.id}>
    <div className="placard-heading"><span className="choice-letter">{'ABC'[i]}</span><Glyph family={p.family}/><span className="family-label">{p.family}{candidates.filter(other=>MECHANICS[other.profileId].family===p.family).length>1?' · alternate tuning':''}</span></div>
    <h3>{p.power}</h3><p className="flaw"><span>BUT</span> {p.flaw.toLowerCase()}.</p><p className="tradeoff">{p.tradeoff}</p>
    <div className="placard-credit">{creditLabel(c.credit,hideAuthors)}</div>
    {votes&&<div className="vote-count">{votes[i]} {votes[i]===1?'vote':'votes'}</div>}
    {c.adaptation&&privateControls&&<p className="adaptation">Adaptation: {c.adaptation}</p>}{privateControls?.(c)}
  </article>;})}</div>;
}
export function RuleList({modules,hideAuthors}:{modules:RecipeModule[];hideAuthors?:boolean}){
  return <ul className="rule-list">{modules.map(m=><li key={m.slotId}><Glyph family={m.mechanicId}/><div><strong>{MECHANICS[m.profileId].title}</strong><p>{ruleCaption(m)}</p><small>{creditLabel(m.credit,hideAuthors)}</small></div></li>)}</ul>;
}
export function ControlLegend({keys}:{keys:Preferences['keys']}){
  return <div className="control-legend"><span><kbd>{movementKeyLabel(keys)}</kbd> / <kbd>↑↓←→</kbd> Move</span><span><kbd>Mouse</kbd> / <kbd>{keyLabel(keys.strike)}</kbd> Strike</span><span><kbd>{keyLabel(keys.dodge)}</kbd> Dodge</span></div>;
}
export function ShowbillHistory({roomId,recipes,results,hideAuthors}:{roomId:string;recipes:BossRecipe[];results:EncounterResult[];hideAuthors:boolean}){
  const entries=showbillEntries(roomId,recipes,results);
  const unmatched=results.filter(result=>!entries.some(entry=>entry.recipe.id===result.recipeId&&entry.recipe.hash===result.recipeHash));
  return <div className="showbill-history">{entries.map(({recipe,results:attempts})=>{
    const acts=[...new Set(attempts.map(result=>result.actIndex))];
    return <article key={recipe.id+':'+recipe.hash}><h3>{acts.length===1?'Act '+acts[0]+' · ':''}{recipe.approvedName}</h3><RuleList modules={recipe.modules} hideAuthors={hideAuthors}/>
      {attempts.length?<div className="result-ledger">{attempts.map((result,index)=><div key={result.attemptId}><span>Attempt {index+1} · Act {result.actIndex}</span><strong>{result.outcome}</strong><span>{result.brokenSlots.length} modules broken{result.brokenSlots.length?' ('+result.brokenSlots.map(slot=>recipe.modules.find(module=>module.slotId===slot)!.mechanicId).join(', ')+')':''} · {result.exploits} openings · {Math.round(result.durationTicks/60)} seconds</span></div>)}</div>:<p>No completed attempt recorded for this recipe.</p>}
      <details><summary>Committed recipe identity</summary><p>Recipe <code>{recipe.id}</code></p><p>SHA256 <code>{recipe.hash}</code></p></details>
    </article>;
  })}{unmatched.length>0&&<p role="status">The contracts for {unmatched.length} recorded {unmatched.length===1?'attempt are':'attempts are'} temporarily unavailable. The results remain saved.</p>}</div>;
}
export function CombatHud({snapshot,recipe,act,preferences,mode,notice}:{snapshot:CombatSnapshot|null;recipe:BossRecipe;act:number;preferences:Preferences;mode:string;notice?:string|null}){
  const active=snapshot?.boss.activeSlot?recipe.modules.find(m=>m.slotId===snapshot.boss.activeSlot):null;
  const exposed=snapshot?.modules.find(m=>m.exposed&&!m.broken);
  const removed=snapshot?.modules.find(m=>m.broken&&m.slotId===snapshot.boss.activeSlot);
  return <div className="game-hud" data-webcam={preferences.webcamCorner}>
    <div className="health-panel"><span className="hud-eyebrow">THE PERFORMER</span><div className="health-stitches" role="img" aria-label={(snapshot?.hero.health??5)+' of 5 health stitches'}>{Array.from({length:5},(_,i)=><svg key={i} className={i<(snapshot?.hero.health??5)?'stitch full':'stitch'} viewBox="0 0 22 32" aria-hidden="true"><path d="M5 3h12v26H5z"/><path d="m3 7 16 5M3 17l16 5M6 1l10 30"/></svg>)}</div></div>
    <div className="act-label"><span>{mode}</span><strong>ACT {['I','II','III'][Math.min(2,act-1)]}</strong></div>
    <div className="module-status"><span className="hud-eyebrow">{recipe.approvedName.toUpperCase()}</span>{recipe.modules.map(m=>{const state=snapshot?.modules.find(s=>s.slotId===m.slotId);return <div className={'module-meter '+(state?.broken?'broken':'')} key={m.slotId}><Glyph family={m.mechanicId} broken={state?.broken}/><div><span>{state?.broken?'BROKEN':m.mechanicId.toUpperCase()}</span><progress max={100} value={state?.breakMeter??0} aria-label={m.mechanicId+' break progress'}/></div></div>;})}</div>
    <div className={'rule-caption '+(exposed?'counter-open':'')} aria-live="polite">
      {snapshot?.canFinish?<><strong>THE BOAST IS BROKEN.</strong><span>Step close. One final strike.</span></>:exposed?<><strong>{exposed.mechanicId==='charge'?'AXLE JAMMED':exposed.mechanicId==='steam'?'VALVE EXPOSED':'MIRROR EXPOSED'}</strong><span>Strike the attachment while the opening lasts.</span></>:removed?<><strong>{removed.mechanicId.toUpperCase()} REMOVED.</strong><span>That attachment cannot attack again.</span></>:active?<><strong>{MECHANICS[active.profileId].power}</strong><span>BUT {MECHANICS[active.profileId].flaw.toLowerCase()}.</span></>:<><strong>THE HOUSE IS WATCHING.</strong><span>Every boast has a loophole.</span></>}
    </div>{notice&&<p className="connection-ribbon" role="status">{notice}</p>}
  </div>;
}
export function SettingsDialog({open,onClose,preferences,onChange}:{open:boolean;onClose:()=>void;preferences:Preferences;onChange:(p:Preferences)=>void}){
  const ref=useRef<HTMLDialogElement>(null);const [binding,setBinding]=useState<keyof Preferences['keys']|null>(null),[bindingError,setBindingError]=useState<string|null>(null);
  useEffect(()=>{if(open&&!ref.current?.open)ref.current?.showModal();if(!open&&ref.current?.open)ref.current.close();},[open]);
  useEffect(()=>{if(!open){setBinding(null);setBindingError(null);}},[open]);
  const update=(patch:Partial<Preferences>)=>onChange({...preferences,...patch});
  return <dialog ref={ref} className="settings-dialog" onCancel={e=>{e.preventDefault();onClose();}} onClose={onClose} aria-labelledby="settings-title"><div className="dialog-heading"><div><span className="eyebrow">YOUR PERFORMANCE</span><h2 id="settings-title">Make yourself comfortable.</h2></div><button className="close-button" onClick={onClose} aria-label="Close settings">×</button></div>
    <fieldset><legend>Sound</legend><label className="check-row"><input type="checkbox" checked={preferences.muted} onChange={e=>update({muted:e.target.checked})}/> Mute all game audio</label><label>Music <output>{Math.round(preferences.music*100)}%</output><input aria-label="Music volume" type="range" min={0} max={1} step={0.05} value={preferences.music} onChange={e=>update({music:Number(e.target.value)})}/></label><label>Effects <output>{Math.round(preferences.sfx*100)}%</output><input aria-label="Effects volume" type="range" min={0} max={1} step={0.05} value={preferences.sfx} onChange={e=>update({sfx:Number(e.target.value)})}/></label></fieldset>
    <fieldset><legend>Comfort & clarity</legend><label className="check-row"><input type="checkbox" checked={preferences.reducedMotion} onChange={e=>update({reducedMotion:e.target.checked})}/> Reduce decorative motion</label><label className="check-row"><input type="checkbox" checked={preferences.reducedFlashes} onChange={e=>update({reducedFlashes:e.target.checked})}/> Reduce flashes</label><label className="check-row"><input type="checkbox" checked={preferences.aimAssist} onChange={e=>update({aimAssist:e.target.checked})}/> Assist strikes toward nearby attachments</label><label>Camera shake <output>{Math.round(preferences.shake*100)}%</output><input aria-label="Camera shake" type="range" min={0} max={0.3} step={0.05} value={preferences.shake} onChange={e=>update({shake:Number(e.target.value)})}/></label><label>Camera-safe corner<select value={preferences.webcamCorner} onChange={e=>update({webcamCorner:e.target.value as Preferences['webcamCorner']})}><option value="bottom-right">Bottom right</option><option value="bottom-left">Bottom left</option><option value="top-right">Top right</option><option value="none">No reserved corner</option></select></label></fieldset>
    <fieldset><legend>Keys</legend><p className="muted">Select an action, then press its new key. Arrow keys remain reserved for their movement directions. Mouse also strikes. Escape cancels rebinding; Tab moves on.</p><div className="key-bindings">{(Object.keys(preferences.keys) as (keyof Preferences['keys'])[]).map(action=><label key={action}>{action}<button className={binding===action?'binding-active':''} onClick={()=>{setBinding(action);setBindingError(null);}} onBlur={()=>{if(binding===action){setBinding(null);setBindingError(null);}}} onKeyDown={e=>{if(binding!==action)return;if(e.code==='Tab'){setBinding(null);setBindingError(null);return;}e.preventDefault();e.stopPropagation();if(e.code==='Escape'){setBinding(null);setBindingError(null);return;}if(!e.altKey&&!e.ctrlKey&&!e.metaKey&&canBindKey(action,e.code,preferences.keys)){update({keys:{...preferences.keys,[action]:e.code}});setBinding(null);setBindingError(null);}else setBindingError('Choose an unused key. Arrow keys are reserved for their movement direction.');}}>{binding===action?'Press a key…':keyLabel(preferences.keys[action])}</button></label>)}</div>{bindingError&&<p role="status">{bindingError}</p>}</fieldset>
    <fieldset><legend>Presentation</legend><label>Quality<select value={preferences.quality} onChange={e=>update({quality:e.target.value as Preferences['quality']})}><option value="high">Standard</option><option value="low">Low resolution</option></select></label><label>Presentation frame rate<select value={preferences.presentationFps} onChange={e=>update({presentationFps:Number(e.target.value) as 30|60})}><option value={60}>60 fps target</option><option value={30}>30 fps fallback</option></select></label><p className="muted">Both modes use the same 60 Hz game rules. Performance targets are awaiting measurement.</p></fieldset>
    <p><button className="text-button" disabled={!document.querySelector('canvas')} onClick={()=>window.dispatchEvent(new Event('aragoz:export-performance'))}>Export local performance report</button></p>
    <button className="button primary" onClick={onClose}>Back to the show</button>
  </dialog>;
}
