import { randomBytes, randomUUID } from 'node:crypto';
import { SCHEMA_VERSION, canonicalJson, makeModule, makeRecipe, sanitizeText } from '../../../packages/contracts/src/index.ts';
import type { Candidate, EncounterEvent, EncounterResult, Outcome, ProfileId, RoomPhase, RoomState, ShowAction, SlotId } from '../../../packages/contracts/src/index.ts';
import type { Channel, Store } from './store.ts';
import { Compiler, houseCandidates, rank, selectBatch } from './compiler.ts';

export class HttpError extends Error { statusCode: number; constructor(statusCode: number, message: string) { super(message); this.statusCode=statusCode; } }
function requireState(condition: unknown, message='This action is unavailable in the current phase'): asserts condition { if (!condition) throw new HttpError(409,message); }
const AUTHORING: RoomPhase[]=['proposal-delay','proposals','compiling','review','vote-delay','voting'];
const closed=(r:RoomState)=>r.phase==='ended';
export interface ChatMessage { deliveryId:string; messageId:string; channelId:string; authorId:string; displayName:string; text:string; sentAt:number; }
export class Engine {
  store: Store; compiler: Compiler; now:()=>number; changed:(room:RoomState)=>void; connectionStatus?: (channelId:string)=>boolean;
  queues=new Map<string,Promise<unknown>>(); pauseRemaining=new Map<string,{opens:number|null;deadline:number|null}>();
  commandLimits=new Map<string,{count:number;at:number}>();
  constructor(store:Store,compiler:Compiler,now:()=>number,changed:(r:RoomState)=>void) { this.store=store;this.compiler=compiler;this.now=now;this.changed=changed; }
  async serial<T>(id:string, fn:()=>Promise<T>|T):Promise<T> { const previous=this.queues.get(id)??Promise.resolve(); const next=previous.catch(()=>{}).then(fn); this.queues.set(id,next); try{return await next;}finally{if(this.queues.get(id)===next)this.queues.delete(id);} }
  get(id:string) { const r=this.store.room(id);if(!r)throw new HttpError(404,'Show not found');return r; }
  persist(r:RoomState) { r.revision++;this.store.save(r);this.changed(r);return r; }
  admit(channelId:string,exceptId?:string) {
    const active=this.store.shows().filter(r=>r.roomId!==exceptId&&!['ended','showbill'].includes(r.phase));
    requireState(!active.some(r=>r.channel.id===channelId),'This channel already has an active show');
    requireState(active.length<Math.min(3,Math.max(0,this.compiler.config.maxActiveShows)),'The deployment has reached its active show limit');
  }
  create(channel:Channel,connected:boolean):RoomState {
    this.admit(channel.id);
    const id=randomUUID();const r:RoomState={schemaVersion:SCHEMA_VERSION,roomId:id,showId:id,channel,actId:randomUUID(),actIndex:1,ballotSlot:0,ballotGeneration:0,roundCode:null,phase:'setup',phaseBeforePause:null,opensAt:null,deadline:null,revision:0,connected,candidates:[],selectedModules:[],recipe:null,attempt:null,settings:{broadcastDelayMs:0,hideAuthors:false,chatHelp:false},votes:[0,0,0],notice:null,results:[]};this.store.save(r);return r;
  }
  private unclaimedRestart(r:RoomState):boolean {
    return r.phase==='paused'&&r.phaseBeforePause==='combat'&&r.attempt?.status==='paused'
      &&r.attempt.ownerClientId===null&&r.attempt.lastSequence===0;
  }
  recover() {
    for(const r of this.store.shows()) {
      r.connected=false;
      if(AUTHORING.includes(r.phase)||r.phase==='paused'&&r.phaseBeforePause&&AUTHORING.includes(r.phaseBeforePause)) {
        this.invalidate(r,'The server restarted. Start a fresh audience ballot.');
      } else if(r.phase==='combat'||r.phase==='paused'&&r.phaseBeforePause==='combat') {
        // Recovery has already retired the old fight. A replacement nobody has
        // claimed or played must survive another restart without a phantom result.
        if(!this.unclaimedRestart(r)) {
          this.finish(r,'abandoned',this.store.events(r.attempt?.id??'').at(-1)?.simTick??0);
          r.attempt=this.attempt('paused',null);
        }
        r.phase='paused';r.phaseBeforePause='combat';
        r.notice='The previous attempt was abandoned after restart. Claim control, then resume a fresh attempt.';
      } else if(r.phase==='assembling')r.phase='ready';
      if(r.attempt)r.attempt.ownerClientId=null;
      this.persist(r);
    }
  }
  attempt(status:'ready'|'running'|'paused'='ready',ownerClientId:string|null=null) { return {id:randomUUID(),ownerClientId,status,lastSequence:0}; }
  invalidate(r:RoomState,notice:string) { r.ballotGeneration++;r.roundCode=null;r.phase='interrupted';r.phaseBeforePause=null;r.opensAt=null;r.deadline=null;r.candidates=[];r.votes=[0,0,0];r.notice=notice; }
  async connection(channelId:string,connected:boolean,reason='Twitch input was interrupted. This ballot was discarded; begin a new ballot.') { for(const item of this.store.shows(channelId))await this.serial(item.roomId,()=>{const r=this.store.room(item.roomId);if(!r||closed(r))return;r.connected=connected;if(!connected&&(AUTHORING.includes(r.phase)||r.phase==='paused'&&r.phaseBeforePause&&AUTHORING.includes(r.phaseBeforePause)))this.invalidate(r,reason);else if(!connected)r.notice='Twitch input disconnected. The committed fight can continue locally.';this.persist(r);}); }
  newBallot(r:RoomState,delay:boolean) { r.ballotGeneration++;r.roundCode=randomBytes(3).toString('hex').toUpperCase();r.candidates=[];r.votes=[0,0,0];r.recipe=null;r.attempt=null;r.phase=delay?'proposal-delay':'setup';r.opensAt=delay?this.now()+r.settings.broadcastDelayMs:null;r.deadline=delay?r.opensAt!+25000:null;r.notice=null; }
  async compile(r:RoomState) { r.phase='compiling';r.opensAt=null;r.deadline=null;this.persist(r);const generation=r.ballotGeneration;const recent=new Set(this.store.recipes(r.roomId).slice(-4).flatMap(x=>x.modules.map(m=>m.credit.authorId).filter((id):id is string=>Boolean(id))));const candidates=await this.compiler.compile(selectBatch(this.store.proposals(r),`${r.actId}:${generation}`,recent),r.selectedModules,r.settings.hideAuthors);const fresh=this.get(r.roomId);if(fresh.phase!=='compiling'||fresh.ballotGeneration!==generation)return fresh;fresh.candidates=candidates;fresh.phase='review';const mode=this.compiler.mode(candidates);fresh.notice=mode==='house'?'House Suggestions are ready. No audience authors were invented.':mode==='catalogue'?'Catalogue fallback matched audience proposals to shipped rules. Review the fixed power and flaw before voting.':null;return this.persist(fresh); }
  async commitSelection(r:RoomState) {
    requireState(r.candidates.length===3&&r.candidates.every(c=>c.approved),'Approve all three choices before selection');
    const max=Math.max(...r.votes);let chosen:Candidate;
    if(max===0){const h=r.candidates.find(c=>c.credit.source==='house');chosen=h??{...houseCandidates(r.selectedModules)[0]!,profileId:r.candidates[0]!.profileId};r.notice='No votes were received. House selection was used.';}
    else{const ties=r.candidates.filter((_c,i)=>r.votes[i]===max);chosen=ties.sort((a,b)=>rank(r.roundCode!,a.id).localeCompare(rank(r.roundCode!,b.id)))[0]!;r.notice=null;}
    const slot:SlotId=r.ballotSlot===0?'left':'right';r.selectedModules=r.selectedModules.filter(m=>m.slotId!==slot);r.selectedModules.push(makeModule(chosen.profileId,slot,chosen.sourceProposalId,chosen.credit));r.candidates=[];r.roundCode=null;r.opensAt=null;r.deadline=null;
    if(r.selectedModules.length===1){r.ballotSlot=r.selectedModules[0]!.slotId==='left'?1:0;r.phase='setup';}
    else{const left=r.selectedModules.find(m=>m.slotId==='left')!,right=r.selectedModules.find(m=>m.slotId==='right')!;r.recipe=await makeRecipe({roomId:r.roomId,actId:r.actId,seed:randomBytes(4).readUInt32LE(),modules:[left,right],bodyId:r.actIndex%2?'teapot':'mirror',now:new Date(this.now()).toISOString()});this.store.putRecipe(r.recipe);r.attempt=this.attempt();r.phase='assembling';r.deadline=this.now()+700;}
    return this.persist(r);
  }
  finish(r:RoomState,outcome:Outcome,durationTicks:number) { if(!r.attempt||!r.recipe||['won','lost','skipped','abandoned'].includes(r.attempt.status))return;const events=this.store.events(r.attempt.id);const brokenSlots=[...new Set(events.filter(e=>e.kind==='module-broken'&&e.moduleSlot).map(e=>e.moduleSlot!))];const result:EncounterResult={attemptId:r.attempt.id,recipeId:r.recipe.id,recipeHash:r.recipe.hash,actIndex:r.actIndex,outcome,durationTicks,brokenSlots,exploits:events.filter(e=>e.kind==='flaw-exposed').length,finishedAt:new Date(this.now()).toISOString()};this.store.putResult(r.roomId,result);r.results.push(result);r.attempt.status=outcome;r.phase='result';r.phaseBeforePause=null;r.deadline=null;r.opensAt=null; }
  nextAct(r:RoomState) { if(r.actIndex>=3){r.phase='showbill';r.roundCode=null;return;}r.actIndex++;r.actId=randomUUID();r.selectedModules=[];r.ballotSlot=0;this.newBallot(r,false); }
  async action(id:string,expectedRevision:number,action:ShowAction):Promise<RoomState>{return this.serial(id,async()=>{
    let r=this.get(id);requireState(r.revision===expectedRevision,'Show changed. Reload the latest snapshot.');const reactivating=['ended','showbill'].includes(r.phase)&&['encore','remix','retry'].includes(action.type);requireState(!closed(r)||reactivating,'This show has ended');if(reactivating){this.admit(r.channel.id,id);r.connected=this.connectionStatus?.(r.channel.id)??r.connected;}
    switch(action.type){
      case 'start-proposals':requireState(['setup','interrupted'].includes(r.phase));requireState(r.connected,'Connect Twitch before accepting audience proposals');this.newBallot(r,true);break;
      case 'close-proposals':requireState(['proposals','proposal-delay'].includes(r.phase));return this.compile(r);
      case 'approve-candidates':requireState(r.phase==='review');requireState(new Set(action.candidateIds).size===3&&r.candidates.length===3&&r.candidates.every(c=>action.candidateIds.includes(c.id)),'Approve the current three candidates');r.candidates.forEach(c=>c.approved=true);break;
      case 'reject-candidate':{requireState(r.phase==='review');const index=r.candidates.findIndex(c=>c.id===action.candidateId);requireState(index>=0,'Candidate not found');const rejected=r.candidates[index]!;if(rejected.sourceProposalId)this.store.rejectProposal(rejected.sourceProposalId,'Rejected by host');const used=r.candidates.filter((_c,i)=>i!==index).map(c=>c.profileId);const replacement=houseCandidates(r.selectedModules).find(c=>!used.includes(c.profileId));requireState(replacement,'No compatible replacement');r.candidates[index]=replacement;break;}
      case 'use-house':requireState(['setup','interrupted',...AUTHORING].includes(r.phase));r.ballotGeneration++;r.roundCode=randomBytes(3).toString('hex').toUpperCase();r.candidates=houseCandidates(r.selectedModules);r.phase='review';r.votes=[0,0,0];r.deadline=null;r.opensAt=null;r.notice='House Suggestions are credited to the House.';break;
      case 'open-vote':requireState(r.phase==='review'&&r.candidates.length===3&&r.candidates.every(c=>c.approved),'Approve all three choices first');requireState(r.connected||r.candidates.every(c=>c.credit.source==='house'),'Audience input is disconnected');r.phase='vote-delay';r.opensAt=this.now()+r.settings.broadcastDelayMs;r.deadline=r.opensAt+20000;r.votes=[0,0,0];break;
      case 'close-vote':requireState(r.phase==='voting'||r.phase==='vote-delay'||r.phase==='review'&&r.candidates.every(c=>c.credit.source==='house'));return this.commitSelection(r);
      case 'restart-ballot':requireState(['setup','interrupted',...AUTHORING].includes(r.phase));this.newBallot(r,false);break;
      case 'claim-control':{requireState(r.recipe&&r.attempt,'There is no committed encounter');const existing=r.attempt.ownerClientId;requireState(!existing||existing===action.clientId||action.takeover,'Another browser controls this attempt. Choose explicit takeover.');if(r.attempt.status==='running'||r.attempt.status==='paused'&&r.phase==='paused'&&r.phaseBeforePause==='combat'&&action.takeover&&!this.unclaimedRestart(r)){requireState(action.takeover,'A running attempt requires explicit takeover after refresh');this.finish(r,'abandoned',this.store.events(r.attempt.id).at(-1)?.simTick??0);r.attempt=this.attempt('paused',action.clientId);this.pauseRemaining.delete(id);r.phase='paused';r.phaseBeforePause='combat';r.notice='A fresh paused attempt is ready. Resume when the stage is visible.';}else r.attempt.ownerClientId=action.clientId;break;}
      case 'start-combat':requireState(r.phase==='ready'&&r.recipe&&r.attempt?.status==='ready');requireState(r.attempt.ownerClientId===action.clientId,'Claim control of this attempt first');r.attempt.status='running';r.phase='combat';break;
      case 'pause':requireState(!['paused','result','showbill','ended','compiling'].includes(r.phase));r.phaseBeforePause=r.phase;this.pauseRemaining.set(id,{opens:r.opensAt===null?null:Math.max(0,r.opensAt-this.now()),deadline:r.deadline===null?null:Math.max(0,r.deadline-this.now())});r.phase='paused';r.opensAt=null;r.deadline=null;if(r.attempt?.status==='running')r.attempt.status='paused';break;
      case 'resume':{requireState(r.phase==='paused'&&r.phaseBeforePause);if(r.phaseBeforePause==='combat')requireState(r.attempt?.ownerClientId,'Claim control before resuming');const remaining=this.pauseRemaining.get(id);r.phase=r.phaseBeforePause;r.phaseBeforePause=null;r.opensAt=remaining?.opens===null||remaining?.opens===undefined?null:this.now()+remaining.opens;r.deadline=remaining?.deadline===null||remaining?.deadline===undefined?null:this.now()+remaining.deadline;this.pauseRemaining.delete(id);if(r.attempt?.status==='paused')r.attempt.status='running';break;}
      case 'retry':case 'encore':requireState(['result','showbill','ended'].includes(r.phase)&&r.recipe);r.attempt=this.attempt();r.phase='ready';r.notice=null;break;
      case 'remix':requireState(['result','showbill','ended','ready'].includes(r.phase)&&r.recipe);r.selectedModules=r.recipe.modules.filter(m=>m.slotId!==action.slotId);r.ballotSlot=action.slotId==='left'?0:1;this.newBallot(r,false);break;
      case 'advance-act':requireState(['result','showbill'].includes(r.phase));this.nextAct(r);break;
      case 'skip-act':this.finish(r,'skipped',this.store.events(r.attempt?.id??'').at(-1)?.simTick??0);this.nextAct(r);break;
      case 'end-show':this.finish(r,'abandoned',this.store.events(r.attempt?.id??'').at(-1)?.simTick??0);r.phase='ended';r.roundCode=null;r.deadline=null;r.opensAt=null;break;
      case 'settings':r.settings=action.settings;r.candidates.forEach(c=>c.credit.hidden=action.settings.hideAuthors);r.selectedModules.forEach(m=>m.credit.hidden=action.settings.hideAuthors);break;
    }
    return this.persist(r);
  });}
  async events(id:string,expectedRevision:number,clientId:string,events:EncounterEvent[]):Promise<RoomState>{return this.serial(id,()=>{
    const r=this.get(id);requireState(!closed(r),'This show has ended');
    // Exact duplicate delivery is acknowledged even if the successful batch advanced the revision.
    const duplicates=events.every(e=>{const saved=this.store.event(e.attemptId,e.sequence);return saved&&canonicalJson(saved)===canonicalJson(e);});if(duplicates)return r;
    requireState(r.revision===expectedRevision,'Show changed. Reload before uploading events');requireState(r.phase==='combat'&&r.recipe&&r.attempt?.status==='running','The current attempt is not running');requireState(r.attempt.ownerClientId===clientId,'This browser does not control the encounter');
    let last=r.attempt.lastSequence;let tick=this.store.events(r.attempt.id).at(-1)?.simTick??0;let ended=false;
    for(const e of events){const saved=this.store.event(e.attemptId,e.sequence);if(saved){requireState(canonicalJson(saved)===canonicalJson(e),'Event sequence conflicts with the ledger');continue;}requireState(!ended&&e.attemptId===r.attempt.id&&e.recipeHash===r.recipe.hash&&e.sequence===last+1&&e.simTick>=tick,'Stale, unordered or mismatched encounter events');requireState((e.kind==='outcome')===(e.outcome!==null),'Outcome must accompany an outcome event');if(['module-activated','attack-started','attack-ended','flaw-exposed','module-broken'].includes(e.kind))requireState(e.moduleSlot!==null,'Module event needs a slot');last=e.sequence;tick=e.simTick;ended=e.kind==='outcome';}
    const broken=new Set(this.store.events(r.attempt.id).filter(e=>e.kind==='module-broken').map(e=>e.moduleSlot));
    for(const e of events){if(this.store.event(e.attemptId,e.sequence))continue;if(e.kind==='module-broken'){requireState(e.value===100&&!broken.has(e.moduleSlot),'A module break must be complete and unique');broken.add(e.moduleSlot);}if(e.kind==='outcome'&&e.outcome==='won')requireState(broken.has('left')&&broken.has('right'),'A winning result requires both module breaks in the ledger');}
    this.store.transaction(()=>{for(const e of events){if(this.store.event(e.attemptId,e.sequence))continue;this.store.putEvent(id,e);r.attempt!.lastSequence=e.sequence;if(e.kind==='outcome')this.finish(r,e.outcome!,e.simTick);}r.revision++;this.store.save(r);});this.changed(r);return r;
  });}
  async chat(message:ChatMessage) {
    if(!this.store.dedupe(message.deliveryId,this.now()))return;
    for(const item of this.store.shows(message.channelId))await this.serial(item.roomId,()=>{const r=this.store.room(item.roomId);if(!r||!r.connected||closed(r)||!r.roundCode||r.opensAt===null||r.deadline===null||message.sentAt<r.opensAt||message.sentAt>r.deadline||this.now()>r.deadline)return;const text=sanitizeText(message.text,400);const make=text.match(/^!make\s+([A-F0-9]{6})\s+(.+)$/i);const vote=text.match(/^!vote\s+([A-F0-9]{6})\s+([ABC])$/i);
      if(r.phase==='proposals'&&make&&make[1]!.toUpperCase()===r.roundCode){const key=`${r.roomId}:${r.ballotGeneration}:${message.authorId}`;const limit=this.commandLimits.get(key)??{count:0,at:this.now()};if(limit.count>=4)return;limit.count++;this.commandLimits.set(key,limit);const raw=sanitizeText(make[2]!,280);if(raw.length<8||!message.authorId||!message.messageId)return;const all=this.store.proposals(r);const old=all.find(p=>p.authorId===message.authorId);if(!old&&all.length>=128){const worst=all.sort((a,b)=>rank(r.roundCode!,b.authorId).localeCompare(rank(r.roundCode!,a.authorId)))[0]!;if(rank(r.roundCode!,message.authorId)>=rank(r.roundCode!,worst.authorId))return;this.store.db.prepare('DELETE FROM proposals WHERE id=?').run(worst.id);}this.store.putProposal({id:old?.id??randomUUID(),roomId:r.roomId,actId:r.actId,ballotGeneration:r.ballotGeneration,authorId:message.authorId,displayName:sanitizeText(message.displayName,40)||'Audience author',raw,receivedAt:this.now(),sentAt:message.sentAt,messageId:message.messageId,rejected:false,rejectionReason:null});this.persist(r);}
      if(r.phase==='voting'&&vote&&vote[1]!.toUpperCase()===r.roundCode){this.store.putVote(r,{authorId:message.authorId,choice:vote[2]!.toUpperCase().charCodeAt(0)-65,sentAt:message.sentAt,messageId:message.messageId});r.votes=[0,0,0];for(const v of this.store.votes(r))r.votes[v.choice]++;this.persist(r);}
    });
  }
  async tick() {
    // Busy rooms retain their own queue; a long compiler never queues ticks or blocks another room.
    const transitions=this.store.shows().filter(r=>!['ended','showbill'].includes(r.phase)&&!this.queues.has(r.roomId)).map(item=>this.serial(item.roomId,async()=>{
      const r=this.store.room(item.roomId);if(!r)return;
      if(r.phase==='proposal-delay'&&this.now()>=r.opensAt!){r.phase='proposals';this.persist(r);}
      else if(r.phase==='vote-delay'&&this.now()>=r.opensAt!){r.phase='voting';this.persist(r);}
      else if(r.phase==='proposals'&&this.now()>=r.deadline!)await this.compile(r);
      else if(r.phase==='voting'&&this.now()>=r.deadline!)await this.commitSelection(r);
      else if(r.phase==='assembling'&&this.now()>=r.deadline!){r.phase='ready';r.deadline=null;this.persist(r);}
    }));
    for(const [key,limit]of this.commandLimits)if(this.now()-limit.at>120000)this.commandLimits.delete(key);
    await Promise.all(transitions);
  }
}
