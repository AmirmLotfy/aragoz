import { useCallback, useEffect, useRef, useState } from 'react';
import { creditLabel, MECHANICS, ServerMessageSchema } from '@aragoz/contracts';
import type { BossRecipe, EncounterEvent, PrivateRoomState, RoomState, ShowAction, ServerMessage, SlotId } from '@aragoz/contracts';
import type { CombatSnapshot } from '@aragoz/combat';
import { api, ApiError } from './api';
import { GameCanvas } from './GameCanvas';
import { CombatHud, ControlLegend, Placards, QuickMute, RuleList, ShowbillHistory, Timer } from './components';
import { EventOutbox, clientIdentity } from './offline';
import type { Preferences } from './settings';

function useRoom(id:string){
  const [room,setRoom]=useState<RoomState|null>(null),[error,setError]=useState<string|null>(null),[transport,setTransport]=useState(false),[busy,setBusy]=useState(false);
  const current=useRef(room);current.current=room;
  const accept=useCallback((next:RoomState)=>{if(!current.current||next.revision>=current.current.revision){current.current=next;setRoom(next);}},[]);
  const refresh=useCallback(async()=>{const r=await api.room(id);accept(r);return r;},[id,accept]);
  useEffect(()=>{
    let closed=false,socket:WebSocket|null=null,timer:ReturnType<typeof setTimeout>|null=null,backoff=500;
    const connect=()=>{if(closed)return;socket=new WebSocket((location.protocol==='https:'?'wss:':'ws:')+'//'+location.host+'/api/rooms/'+encodeURIComponent(id)+'/ws');
      socket.onopen=()=>{backoff=500;setTransport(true);setError(null);};
      socket.onmessage=e=>{try{const message=ServerMessageSchema.parse(JSON.parse(e.data));if(message.type==='snapshot')accept(message.room);else if(message.type==='error')setError(message.message);}catch{setError('An unreadable room update was ignored.');}};
      socket.onerror=()=>setTransport(false);
      socket.onclose=e=>{setTransport(false);if(closed||e.code===1008)return;timer=setTimeout(connect,backoff);backoff=Math.min(10000,backoff*2);};
    };
    void refresh().then(()=>{if(!closed)connect();}).catch(e=>setError(e instanceof Error?e.message:'This show could not be opened.'));
    return()=>{closed=true;if(timer)clearTimeout(timer);socket?.close();};
  },[id,accept,refresh]);
  const action=useCallback(async(a:ShowAction)=>{
    if(!current.current)return null;setBusy(true);setError(null);
    try{const next=await api.action(current.current,a);accept(next);return next;}
    catch(e){if(e instanceof ApiError&&e.status===409)await refresh().catch(()=>{});setError(e instanceof Error?e.message:'The cue could not be applied.');return null;}
    finally{setBusy(false);}
  },[accept,refresh]);
  return{room,current,accept,refresh,action,error,setError,transport,busy};
}

function AudienceCue({room}:{room:RoomState}){
  const delayed=room.phase==='proposal-delay'||room.phase==='vote-delay';
  const proposals=room.phase==='proposals'||room.phase==='proposal-delay';
  const voting=room.phase==='voting'||room.phase==='vote-delay';
  const proposalExample=room.selectedModules.some(m=>m.mechanicId==='charge')?'steam burst but overheats after three bursts':'charges but cannot turn';
  return <section className="audience-cue"><span className="eyebrow">ACT {room.actIndex} · CONTRACT {room.ballotSlot+1} OF 2</span>
    <h2>{proposals?'Give this villain a power… BUT give it a flaw.':voting?'Which boast belongs onstage?':room.phase==='compiling'?'Turning your boasts into stage-ready choices.':room.phase==='review'?'The stage manager is checking the next three boasts.':'The curtain is being set.'}</h2>
    {proposals&&<p className="chat-command"><span>IN TWITCH CHAT</span><code>!make {room.roundCode} {proposalExample}</code></p>}
    {voting&&<><Placards candidates={room.candidates} hideAuthors={room.settings.hideAuthors} votes={room.votes}/><p className="chat-command"><span>ONE VOTE PER VIEWER · YOUR LATEST VOTE COUNTS</span><code>!vote {room.roundCode} A</code><small>or B or C</small></p></>}
    {(proposals||voting)&&<Timer deadline={room.deadline} opensAt={room.opensAt} delayed={delayed}/>}
    {room.phase==='review'&&<p>Only approved contracts appear on this public stage.</p>}
    {room.selectedModules.length>0&&<div className="selected-contracts"><span>ALREADY IN THE ACT</span><RuleList modules={room.selectedModules} hideAuthors={room.settings.hideAuthors}/></div>}
  </section>;
}

export function LivePlay({id,preferences,navigate,onSettings}:{id:string;preferences:Preferences;navigate:(p:string)=>void;onSettings:()=>void}){
  const live=useRoom(id),{room,current,accept,action,refresh,transport,busy}=live;
  const [client]=useState(clientIdentity),[outbox]=useState(()=>new EventOutbox('aragoz.outbox.'+id)),uploading=useRef(false);
  const [armed,setArmed]=useState<string|null>(null),[localPause,setLocalPause]=useState(true),[stageReady,setStageReady]=useState(false),[snapshot,setSnapshot]=useState<CombatSnapshot|null>(null),[pending,setPending]=useState(0),[caption,setCaption]=useState<{slot:SlotId;broken:boolean}|null>(null),[syncError,setSyncError]=useState<string|null>(null),[history,setHistory]=useState<BossRecipe[]>([]),[historyStatus,setHistoryStatus]=useState<'idle'|'loading'|'ready'|'error'>('idle');
  const captionTimer=useRef<ReturnType<typeof setTimeout>|null>(null),pauseRequest=useRef(false);
  useEffect(()=>{const previous=window.name;window.name='aragoz-play-'+id;return()=>{if(window.name==='aragoz-play-'+id)window.name=previous;};},[id]);
  useEffect(()=>{setSnapshot(null);setStageReady(false);setLocalPause(true);setCaption(null);},[room?.attempt?.id,room?.recipe?.hash]);
  useEffect(()=>{if(room?.phase==='combat'&&room.attempt?.id===armed)setLocalPause(false);else setLocalPause(true);},[room?.phase,room?.attempt?.id,armed]);
  useEffect(()=>{if(!room||!['result','showbill','ended'].includes(room.phase))return;let active=true;setHistoryStatus('loading');void api.showbill(id).then(b=>{if(active){setHistory(b.recipes);setHistoryStatus('ready');}}).catch(()=>{if(active)setHistoryStatus('error');});return()=>{active=false;};},[id,room?.phase,room?.results.length]);
  useEffect(()=>()=>{if(captionTimer.current)clearTimeout(captionTimer.current);},[]);
  const flush=useCallback(async()=>{
    const r=current.current;if(uploading.current||!r?.attempt||r.phase!=='combat')return;
    const batch=outbox.pending(r.attempt.id);setPending(outbox.count(r.attempt.id));if(!batch.length)return;
    uploading.current=true;
    try{const next=await api.events(r,client,batch);outbox.acknowledge(batch);accept(next);setSyncError(null);}
    catch(e){if(e instanceof ApiError&&e.status===409)await refresh().catch(()=>{});setSyncError(e instanceof Error?e.message:'Results are saved locally until the connection returns.');}
    finally{uploading.current=false;setPending(outbox.count(r.attempt.id));}
  },[accept,current,refresh]);
  useEffect(()=>{const timer=setInterval(()=>void flush(),700);return()=>clearInterval(timer);},[flush]);
  const receiveEvents=(batch:EncounterEvent[])=>{
    outbox.append(batch);if(current.current?.attempt)setPending(outbox.count(current.current.attempt.id));
    for(const e of batch)if(e.kind==='module-activated'||e.kind==='module-broken'){
      const m=current.current?.recipe?.modules.find(m=>m.slotId===e.moduleSlot);if(!m)continue;
      setCaption({slot:m.slotId,broken:e.kind==='module-broken'});
      if(captionTimer.current)clearTimeout(captionTimer.current);captionTimer.current=setTimeout(()=>setCaption(null),3500);
    }
    if(!outbox.persistenceAvailable)setSyncError('Browser storage is full. Keep this window open while results synchronize.');
  };
  const start=async(takeover=false)=>{
    const claimed=await action({type:'claim-control',clientId:client,takeover});if(!claimed?.attempt)return;
    setArmed(claimed.attempt.id);setLocalPause(true);
    if(claimed.phase==='ready')await action({type:'start-combat',clientId:client});
    else if(claimed.phase==='paused')await action({type:'resume'});
  };
  const pause=()=>{setLocalPause(true);if(current.current?.phase==='combat'&&!pauseRequest.current){pauseRequest.current=true;void action({type:'pause'}).finally(()=>{pauseRequest.current=false;});}};
  if(!room)return <main className="page narrow"><span className="eyebrow">LIVE THEATRE</span><h1>{live.error?'This show could not open.':'Finding your stage…'}</h1>{live.error&&<p role="alert">{live.error}</p>}<button className="button" onClick={()=>navigate('/setup')}>Twitch setup</button></main>;
  const displayPhase=room.phase==='paused'?room.phaseBeforePause:room.phase;
  const combatPage=Boolean(room.recipe&&room.attempt&&['ready','combat','paused','assembling','result','showbill','ended'].includes(room.phase));
  const showingResults=['result','showbill','ended'].includes(room.phase);
  const controlled=armed===room.attempt?.id;
  const localFinished=Boolean(snapshot?.outcome&&room.phase==='combat');
  const canRecover=(room.phase==='combat'||room.phase==='paused'&&displayPhase==='combat')&&!controlled;
  const captionModule=caption?room.recipe?.modules.find(m=>m.slotId===caption.slot):null;
  const captionText=caption&&captionModule?`${MECHANICS[captionModule.profileId].title} · ${creditLabel(captionModule.credit,room.settings.hideAuthors)} · ${caption.broken?'attachment broken, ability removed':'ability activated'}`:null;
  return <main className="performance-page"><div className="performance-topline"><div><span className="eyebrow">{room.channel.displayName}’S THEATRE · INVITED PILOT</span><h1>{room.recipe?.approvedName??'Tonight’s villain is yours to write.'}</h1></div><div className="quick-controls"><QuickMute muted={preferences.muted}/><button className="button small" onClick={()=>window.open('/backstage/'+encodeURIComponent(id),'aragoz-backstage-'+id)}>Open backstage</button><button className="button small" disabled={busy||!controlled||!['combat','paused'].includes(room.phase)} onClick={()=>room.phase==='paused'?void action({type:'resume'}):pause()}>{room.phase==='paused'?'Resume':'Pause'}</button><button className="text-button" onClick={()=>{pause();onSettings();}}>Sound & controls</button></div></div>
    {live.error&&<p className="notice error" role="alert">{live.error}</p>}
    {showingResults&&!combatPage?<section className="public-cue-stage"><span className="eyebrow">THE EVENING’S SHOWBILL</span><h2>{room.phase==='ended'?'The show has ended.':'The three-act show is complete.'}</h2><p>The recorded contracts and results appear below. Unassembled acts have no encounter recipe.</p></section>:!combatPage?<section className="public-cue-stage"><div className="curtain-top"/><AudienceCue room={room}/>{room.phase==='setup'&&<div className="button-row"><button className="button primary" onClick={()=>void action({type:'start-proposals'})} disabled={busy||!transport||!room.connected}>Open audience proposals</button><button className="button" onClick={()=>void action({type:'use-house'})} disabled={busy||!transport}>Use labelled House Suggestions</button></div>}{room.phase==='interrupted'&&<div className="button-row"><button className="button" onClick={()=>void action({type:'restart-ballot'})} disabled={busy||!transport||!room.connected}>Restart with a fresh code</button><button className="button" onClick={()=>void action({type:'use-house'})} disabled={busy||!transport}>Use House Suggestions</button></div>}{room.phase==='paused'&&<button className="button primary" onClick={()=>void action({type:'resume'})}>Resume this cue</button>}<p className="muted">{room.notice}</p></section>:<div className="stage-frame">
      <GameCanvas recipe={room.recipe!} attemptId={room.attempt!.id} assemble paused={localPause||!controlled||room.phase!=='combat'||localFinished} preferences={preferences} onReadyChange={setStageReady} onSnapshot={setSnapshot} onEvents={receiveEvents} onAutoPause={pause} previewChannel={'aragoz.preview.'+id}/>
      <CombatHud recipe={room.recipe!} snapshot={snapshot} act={room.actIndex} preferences={preferences} mode="LIVE AUDIENCE ACT" notice={!transport?'Backstage connection interrupted · this committed fight can finish locally':!room.connected?'Twitch input interrupted · no new audience changes':syncError}/>
      {room.phase==='ready'&&stageReady&&<div className="stage-overlay"><section className="instruction-card"><span className="eyebrow">THE AUDIENCE HAS SPOKEN</span><h2>Now find the loopholes.</h2><RuleList modules={room.recipe!.modules} hideAuthors={room.settings.hideAuthors}/><ControlLegend keys={preferences.keys}/><button className="button primary" disabled={!stageReady||busy||!transport} onClick={()=>void start(false)}>Take the stage</button></section></div>}
      {canRecover&&<div className="stage-overlay"><section className="instruction-card"><span className="eyebrow">SAFE RETURN</span><h2>Start a fresh attempt.</h2><p>This encounter was already running. Taking control records the previous attempt as abandoned and restarts the same accepted recipe safely.</p><button className="button primary" disabled={!stageReady||busy||!transport} onClick={()=>void start(true)}>Take control & restart safely</button></section></div>}
      {room.phase==='paused'&&controlled&&<div className="stage-overlay"><section className="pause-card"><span className="eyebrow">INTERMISSION</span><h2>The fight is paused.</h2><button className="button primary" disabled={busy||!transport} onClick={()=>void action({type:'resume'})}>Back onstage</button></section></div>}
      {room.phase==='combat'&&localPause&&controlled&&!localFinished&&<div className="stage-overlay"><section className="pause-card"><span className="eyebrow">LOCAL INTERMISSION</span><h2>The fight is paused here.</h2><p>{transport?'The accepted encounter is ready when you are.':'The accepted fight can continue offline. Results will synchronize when backstage returns.'}</p><button className="button primary" disabled={busy} onClick={()=>setLocalPause(false)}>{transport?'Back onstage':'Continue the accepted fight offline'}</button></section></div>}
      {(room.phase==='assembling'||room.phase==='ready'&&!stageReady)&&<div className="assembly-caption" role="status"><span>THE BOAST BECOMES A BODY.</span></div>}
      {localFinished&&<div className="stage-overlay"><section className="pause-card"><span className="eyebrow">FIGHT FINISHED LOCALLY</span><h2>{snapshot?.outcome==='won'?'The boast is broken.':'The curtain falls.'}</h2><p>Synchronizing the encounter ledger before opening the showbill.</p><p>{pending} events awaiting acknowledgement.</p><button className="button" onClick={()=>void flush()}>Retry synchronization</button></section></div>}
      {['result','showbill','ended'].includes(room.phase)&&<div className="stage-overlay"><section className="showbill"><span className="eyebrow">{room.phase==='showbill'?'THE COMPLETE SHOWBILL':'THIS ACT’S SHOWBILL'}</span><h2>{room.phase==='ended'?'The show has ended.':room.results.at(-1)?.outcome==='won'?'A boast beautifully broken.':'The curtain falls.'}</h2><RuleList modules={room.recipe!.modules} hideAuthors={room.settings.hideAuthors}/><p>All committed contracts, author credits and recorded attempts appear below the stage.</p><div className="result-ledger">{room.results.map(r=><div key={r.attemptId}><span>ACT {r.actIndex}</span><strong>{r.outcome}</strong><span>{r.brokenSlots.length} modules · {r.exploits} openings</span></div>)}</div>{room.phase!=='ended'&&<div className="button-row"><button className="button primary" disabled={busy} onClick={()=>{setArmed(null);void action({type:room.results.at(-1)?.outcome==='won'?'encore':'retry'});}}>Encore · same recipe</button><button className="button" disabled={busy||room.phase==='showbill'} onClick={()=>{setArmed(null);void action({type:'advance-act'});}}>{room.actIndex<3?'Next act':'Close the three-act show'}</button></div>}{room.phase!=='ended'&&<div className="button-row"><button className="text-button" onClick={()=>{setArmed(null);void action({type:'remix',slotId:'left'});}}>Remix left contract</button><button className="text-button" onClick={()=>{setArmed(null);void action({type:'remix',slotId:'right'});}}>Remix right contract</button></div>}</section></div>}
      {captionText&&room.phase==='combat'&&!localPause&&!snapshot?.outcome&&<div className="author-caption" role="status">{captionText}</div>}
    </div>}
    <div className="stage-footnote"><span>Technical preview · ARAGOZ theatre</span><span>{transport?'Backstage connected':'Backstage reconnecting'} · {room.connected?'Twitch input connected':'Twitch input unavailable'}</span></div>
    {showingResults&&<section className="showbill-history-section" aria-labelledby="showbill-history-title"><span className="eyebrow">THE EVENING’S CONTRACTS</span><h2 id="showbill-history-title">Every boast, its author, and its result.</h2>{historyStatus==='loading'&&<p role="status">Loading the committed show history…</p>}{historyStatus==='error'&&<p role="status">Earlier recipe history could not be loaded. Available records remain below; reload to try again.</p>}<ShowbillHistory roomId={room.roomId} recipes={room.recipe?[...history,room.recipe]:history} results={room.results} hideAuthors={room.settings.hideAuthors}/>{historyStatus==='ready'&&!history.length&&!room.recipe&&<p>No encounter recipe was committed in this show.</p>}<p>Encore attempts keep the same recipe. A Remix creates a separate committed contract.</p></section>}
  </main>;
}

export function Backstage({id,navigate,preferences}:{id:string;navigate:(p:string)=>void;preferences:Preferences}){
  const live=useRoom(id),{room,accept,action,busy}=live;
  const [privateState,setPrivateState]=useState<PrivateRoomState|null>(null),[frame,setFrame]=useState<string|null>(null),[confirmEnd,setConfirmEnd]=useState(false);
  const [pendingSettings,setPendingSettings]=useState<RoomState['settings']|null>(null);
  useEffect(()=>{let stop=false;const poll=()=>void api.backstage(id).then(next=>{if(!stop){setPrivateState(next);accept(next.room);}}).catch(()=>{});poll();const t=setInterval(poll,1800);return()=>{stop=true;clearInterval(t);};},[id,accept]);
  useEffect(()=>{if(typeof BroadcastChannel==='undefined')return;const c=new BroadcastChannel('aragoz.preview.'+id);c.onmessage=e=>{if(e.data?.type==='preview-frame'&&typeof e.data.frame==='string'&&e.data.frame.startsWith('data:image/jpeg;base64,'))setFrame(e.data.frame);};const t=setInterval(()=>c.postMessage({type:'request-preview'}),1200);c.postMessage({type:'request-preview'});return()=>{clearInterval(t);c.close();};},[id]);
  if(!room)return <main className="page narrow"><h1>{live.error??'Opening backstage…'}</h1><button className="button" onClick={()=>navigate('/setup')}>Twitch setup</button></main>;
  const authoring=['setup','interrupted','proposals','proposal-delay','compiling','review','voting','vote-delay'].includes(room.phase);
  const settings=pendingSettings??room.settings;
  const changeSettings=(next:RoomState['settings'])=>{setPendingSettings(next);void action({type:'settings',settings:next}).finally(()=>setPendingSettings(null));};
  return <main className="backstage-page"><div className="performance-topline"><div><span className="eyebrow">PRIVATE CONTROL WINDOW · EXCLUDE FROM CAPTURE</span><h1>{room.channel.displayName}’s backstage</h1></div><button className="button" onClick={()=>window.open('/play/'+encodeURIComponent(id),'aragoz-play-'+id)}>Open play window</button></div>
    {live.error&&<p className="notice error" role="alert">{live.error}</p>}
    <div className="backstage-layout"><div className="backstage-main"><div className="preview-frame">{frame?<img src={frame} alt="Low-rate preview of the actual play-window stage"/>:<div><strong>The play window owns the stage.</strong><p>Open it to receive its preview here. This control window runs no second simulation.</p></div>}</div>
      <div className="cue-strip"><span>ACT {room.actIndex} / 3</span><strong>{room.phase.replaceAll('-',' ').toUpperCase()}</strong><span>CONTRACT {room.ballotSlot+1} / 2</span>{room.deadline&&<Timer deadline={room.deadline} opensAt={room.opensAt} delayed={room.phase.endsWith('-delay')}/>}</div>
      {room.notice&&<p className="notice" role="status">{room.notice}</p>}
      {room.phase==='review'&&<section className="review-section"><h2>Three stage-ready contracts</h2><p>Review every adaptation and its credit before opening the audience ballot.</p><Placards candidates={room.candidates} hideAuthors={room.settings.hideAuthors} privateControls={c=><button className="text-button danger" disabled={busy} onClick={()=>void action({type:'reject-candidate',candidateId:c.id})}>Reject this proposal</button>}/><div className="button-row"><button className="button primary" disabled={busy||!live.transport} onClick={()=>void action({type:'approve-candidates',candidateIds:room.candidates.map(c=>c.id)})}>{room.candidates.every(c=>c.approved)?'All three approved':'Approve these three contracts'}</button><button className="button" disabled={busy||!room.candidates.every(c=>c.approved)||!live.transport} onClick={()=>void action({type:'open-vote'})}>Open audience vote</button>{room.candidates.every(c=>c.credit.source==='house')&&<button className="button" disabled={busy} onClick={()=>void action({type:'close-vote'})}>Choose a House contract</button>}</div></section>}
      {['proposals','proposal-delay'].includes(room.phase)&&<p className="chat-command"><code>!make {room.roundCode} power but flaw</code></p>}
      {['voting','vote-delay'].includes(room.phase)&&<><Placards candidates={room.candidates} hideAuthors={room.settings.hideAuthors} votes={room.votes}/><p className="chat-command"><code>!vote {room.roundCode} A</code></p></>}
      <section className="proposal-queue"><div className="section-heading"><h2>Incoming proposals</h2><span>{privateState?.proposals.length??0} eligible entries</span></div><p className="muted">Unapproved text stays in this private window.</p>{!privateState?.proposals.length?<p className="empty-state">No viewer proposals in this window yet. House Suggestions are always available.</p>:<ol>{privateState.proposals.map(p=><li key={p.id}><strong>{room.settings.hideAuthors?'Audience author':p.displayName}</strong><p>{p.raw}</p>{p.rejected&&<small>Rejected by moderation or host</small>}</li>)}</ol>}</section>
    </div><aside className="backstage-controls"><span className="eyebrow">STAGE MANAGER’S CUES</span><h2>Keep the show moving.</h2><div className="status-list"><span className={live.transport?'status-good':'status-bad'}>{live.transport?'Room connected':'Room reconnecting'}</span><span className={room.connected?'status-good':'status-bad'}>{room.connected?'Twitch input connected':'Twitch input interrupted'}</span></div>
      {['setup','interrupted'].includes(room.phase)&&<button className="button primary" disabled={busy||!room.connected} onClick={()=>void action({type:'start-proposals'})}>Open proposals</button>}
      {['proposals','proposal-delay'].includes(room.phase)&&<button className="button" disabled={busy} onClick={()=>void action({type:'close-proposals'})}>Close submissions & prepare choices</button>}
      {['voting','vote-delay'].includes(room.phase)&&<button className="button" disabled={busy} onClick={()=>void action({type:'close-vote'})}>Close vote & commit</button>}
      {authoring&&<button className="button" disabled={busy} onClick={()=>void action({type:'use-house'})}>Replace with House Suggestions</button>}
      {authoring&&<button className="text-button" disabled={busy||!room.connected} onClick={()=>void action({type:'restart-ballot'})}>Restart ballot · fresh code</button>}
      {!['result','showbill','ended','compiling'].includes(room.phase)&&<button className="button" disabled={busy} onClick={()=>void action({type:room.phase==='paused'?'resume':'pause'})}>{room.phase==='paused'?'Resume cue':'Pause show'}</button>}
      {!['ended','showbill'].includes(room.phase)&&<button className="text-button" disabled={busy} onClick={()=>void action({type:room.phase==='result'?'advance-act':'skip-act'})}>{room.phase==='result'?'Next act':room.attempt&&room.recipe?'Skip this encounter · record as skipped':'Skip this unassembled act'}</button>}
      <button className="button" aria-pressed={preferences.muted} onClick={()=>window.dispatchEvent(new Event('aragoz:toggle-mute'))}>{preferences.muted?'Unmute game audio':'Mute game audio'}</button>
      <fieldset><legend>Audience presentation</legend><label>Broadcast delay allowance <output>{Math.round(settings.broadcastDelayMs/1000)}s</output><input aria-label="Broadcast delay allowance" type="range" min={0} max={30} step={1} value={settings.broadcastDelayMs/1000} disabled={busy||!['setup','result','interrupted','showbill'].includes(room.phase)} onChange={e=>changeSettings({...settings,broadcastDelayMs:Number(e.target.value)*1000})}/></label><label className="check-row"><input type="checkbox" checked={settings.hideAuthors} disabled={busy} onChange={e=>changeSettings({...settings,hideAuthors:e.target.checked})}/> Hide author display names</label><label className="check-row"><input type="checkbox" checked={settings.chatHelp} disabled={busy} onChange={e=>changeSettings({...settings,chatHelp:e.target.checked})}/> Chat help replies <small>Requires optional write permission.</small></label></fieldset>
      {room.phase!=='ended'&&(confirmEnd?<div className="end-confirm"><p>End this show and close audience decisions?</p><button className="button danger" onClick={()=>void action({type:'end-show'})}>End this show</button><button className="text-button" onClick={()=>setConfirmEnd(false)}>Keep it open</button></div>:<button className="text-button danger" onClick={()=>setConfirmEnd(true)}>End show…</button>)}
    </aside></div>
  </main>;
}
