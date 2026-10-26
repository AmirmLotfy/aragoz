import Fastify from 'fastify';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import cookie from '@fastify/cookie';
import websocket from '@fastify/websocket';
import rateLimit from '@fastify/rate-limit';
import staticFiles from '@fastify/static';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { existsSync } from 'node:fs';
import { ActionRequestSchema, EventsRequestSchema, sanitizeText } from '../../../packages/contracts/src/index.ts';
import type { RoomState, SessionInfo } from '../../../packages/contracts/src/index.ts';
import { configFromEnv, hostingConfigured, isInvited } from './config.ts';
import type { Config } from './config.ts';
import { Store } from './store.ts';
import type { Session } from './store.ts';
import { Compiler } from './compiler.ts';
import type { Fetcher } from './compiler.ts';
import { Engine, HttpError } from './engine.ts';
import { Twitch } from './twitch.ts';
import type { SocketFactory } from './twitch.ts';
import { ConnectionTests } from './connection.ts';
import { webBuildReady } from './readiness.ts';

export interface Dependencies { now?:()=>number; fetch?:Fetcher; socketFactory?:SocketFactory; store?:Store; background?:boolean; }
export interface Services { store:Store;engine:Engine;compiler:Compiler;twitch:Twitch;config:Config; }
export type AragozApp=FastifyInstance&{services:Services};
const COOKIE='aragoz_session';
function same(a:string,b:string){const aa=Buffer.from(a),bb=Buffer.from(b);return aa.length===bb.length&&timingSafeEqual(aa,bb);}
export async function createApp(overrides:Partial<Config>={},deps:Dependencies={}):Promise<AragozApp>{
  const config={...configFromEnv(),...overrides};const now=deps.now??Date.now,fetcher=deps.fetch??fetch;
  const store=deps.store??new Store(config.databasePath,config.tokenEncryptionKey);const app=Fastify({logger:false,bodyLimit:128*1024,trustProxy:config.trustLoopbackProxy?['127.0.0.1','::1']:false}) as unknown as AragozApp;
  await app.register(cookie);await app.register(rateLimit,{max:180,timeWindow:'1 minute',
    allowList:req=>!req.url.startsWith('/api/'),
    keyGenerator:req=>{const s=req.cookies[COOKIE]?store.session(req.cookies[COOKIE]!,now()):null;return s?.channelId?`channel:${s.channelId}`:`ip:${req.ip}`;},
  });await app.register(websocket,{options:{maxPayload:1024}});
  const peers=new Map<string,Set<{socket:{send:(data:string)=>void;close:(code?:number)=>void;readyState:number};sessionId:string}>>();
  const compiler=new Compiler(config,store,fetcher,now);
  const engine=new Engine(store,compiler,now,room=>{for(const p of peers.get(room.roomId)??[]){const session=store.session(p.sessionId,now());if(!session||session.channelId!==room.channel.id){p.socket.close(1008);continue;}if(p.socket.readyState===1)p.socket.send(JSON.stringify({schemaVersion:1,type:'snapshot',room}));}});
  let connectionTests:ConnectionTests;
  const twitch=new Twitch({config,store,fetcher,now,socketFactory:deps.socketFactory??(url=>new WebSocket(url)),onChat:async m=>{if(!connectionTests.receive(m))await engine.chat(m);},onConnection:(id,connected,reason)=>engine.connection(id,connected,reason)});
  connectionTests=new ConnectionTests(store,twitch,now);engine.connectionStatus=id=>twitch.connected.has(id);
  app.decorate('services',{store,engine,compiler,twitch,config});engine.recover();
  function session(req:FastifyRequest,reply?:FastifyReply,create=false):Session{
    const previous=req.cookies[COOKIE]?store.session(req.cookies[COOKIE]!,now()):null;if(previous)return previous;
    if(!create||!reply)throw new HttpError(401,'Connect Twitch to host a show');
    const s={id:randomBytes(32).toString('hex'),csrf:randomBytes(32).toString('hex'),channelId:null,expiresAt:now()+7*86400000};store.putSession(s);reply.setCookie(COOKIE,s.id,{httpOnly:true,secure:config.secureCookies,sameSite:'lax',path:'/',maxAge:7*86400});return s;
  }
  function owner(req:FastifyRequest){const s=session(req);const channel=s.channelId?store.channel(s.channelId):null;if(!channel||!store.credential(channel.id))throw new HttpError(401,'Connect Twitch to host a show');if(!isInvited(config,channel))throw new HttpError(403,'This channel is not on the invitation list');return {session:s,channel};}
  function ownedRoom(req:FastifyRequest,id:string){const host=owner(req);const room=store.room(id);if(!room||room.channel.id!==host.channel.id)throw new HttpError(404,'Show not found');return room;}
  app.addHook('onRequest',async(req,reply)=>{
    reply.header('X-Content-Type-Options','nosniff');reply.header('Referrer-Policy','no-referrer');reply.header('Cache-Control',req.url.startsWith('/api/')?'no-store':'no-cache');
    reply.header('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self' ws: wss:; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; frame-ancestors 'self'");
    if(['POST','PUT','PATCH','DELETE'].includes(req.method)&&req.url.startsWith('/api/')){const s=session(req);const token=req.headers['x-csrf-token'];if(typeof token!=='string'||!same(token,s.csrf))throw new HttpError(403,'Refresh the page before trying this action');if(req.headers.origin&&req.headers.origin!==config.origin)throw new HttpError(403,'Origin is not allowed');}
  });
  app.setErrorHandler((error,_req,reply)=>{const suppliedStatus=typeof error==='object'&&error!==null&&'statusCode' in error&&typeof error.statusCode==='number'?error.statusCode:500;const status=error instanceof HttpError?error.statusCode:suppliedStatus>=400&&suppliedStatus<500?suppliedStatus:500;reply.code(status).send({error:status===500?'The show could not complete this request':error instanceof HttpError?error.message:status===429?'Too many requests. Please wait.':'Invalid request'});});
  app.get('/api/health',async()=>({ok:true}));
  app.get('/api/readiness',async(_req,reply)=>{try{store.db.prepare('SELECT 1').get();const frontendReady=webBuildReady(config.staticRoot);if(!frontendReady)reply.code(503);return {ready:frontendReady,frontendReady,hostingConfigured:hostingConfigured(config),modelEnabled:compiler.enabled()};}catch{reply.code(503);return {ready:false};}});
  app.get('/api/session',async(req,reply):Promise<SessionInfo>=>{const s=session(req,reply,true);const channel=s.channelId?store.channel(s.channelId):null;const authenticated=Boolean(channel&&store.credential(channel.id));return {authenticated,csrfToken:s.csrf,channel:authenticated?channel:null,invited:Boolean(channel&&isInvited(config,channel)),hostingConfigured:hostingConfigured(config),modelEnabled:compiler.enabled()};});
  app.get('/api/auth/twitch/start',{config:{rateLimit:{max:10,timeWindow:'1 minute'}}},async(req,reply)=>{
    if(!hostingConfigured(config))throw new HttpError(503,'Twitch hosting is not configured');const s=session(req,reply,true);const query=req.query as {chatHelp?:string};if(query.chatHelp!==undefined&&!['true','false'].includes(query.chatHelp))throw new HttpError(400,'Invalid chat help preference');
    s.csrf=randomBytes(32).toString('hex');store.transaction(()=>{store.putSession(s);store.db.prepare('DELETE FROM oauth_states WHERE session_id=?').run(s.id);});const state=randomBytes(32).toString('hex'),chatHelp=query.chatHelp==='true';store.oauth(state,s.id,chatHelp,now()+10*60000);const url=new URL('https://id.twitch.tv/oauth2/authorize');url.search=new URLSearchParams({client_id:config.twitchClientId,redirect_uri:config.twitchRedirectUri,response_type:'code',scope:chatHelp?'user:read:chat user:write:chat':'user:read:chat',state}).toString();return reply.redirect(url.toString());
  });
  app.get('/api/auth/twitch/callback',{config:{rateLimit:{max:15,timeWindow:'1 minute'}}},async(req,reply)=>{
    const s=session(req);const query=req.query as {state?:string;code?:string;error?:string};if(!query.state)throw new HttpError(400,'Authorization state is missing');const help=store.consumeOAuth(query.state,s.id,now());if(help===null||query.error||!query.code)throw new HttpError(400,'Twitch authorization expired or was declined');
    const generations=new Map(twitch.generations);let auth;try{auth=await twitch.authenticate(query.code,help);}catch{throw new HttpError(401,'Twitch could not verify this connection. Please reconnect.');}
    const current=store.session(s.id,now());if(!current||current.csrf!==s.csrf||current.channelId!==s.channelId||twitch.generation(auth.channel.id)!==(generations.get(auth.channel.id)??0))throw new HttpError(409,'This authorization was superseded. Connect Twitch again.');
    auth.channel.displayName=sanitizeText(auth.channel.displayName,40)||auth.channel.login;
    if(!isInvited(config,auth.channel))throw new HttpError(403,'This channel is not on the invitation list');
    connectionTests.clear(auth.channel.id);twitch.disconnect(auth.channel.id);const interrupted=engine.connection(auth.channel.id,false,'Twitch authorization was renewed. This ballot was discarded; begin a new ballot.');store.putChannel(auth.channel,auth.credential);const fresh={id:randomBytes(32).toString('hex'),csrf:randomBytes(32).toString('hex'),channelId:auth.channel.id,expiresAt:now()+7*86400000};store.transaction(()=>{store.putSession(fresh);store.db.prepare('DELETE FROM sessions WHERE id=?').run(s.id);});reply.setCookie(COOKIE,fresh.id,{httpOnly:true,secure:config.secureCookies,sameSite:'lax',path:'/',maxAge:7*86400});twitch.connect(auth.channel.id);await interrupted;return reply.redirect('/setup?connected=twitch');
  });
  app.post('/api/auth/twitch/disconnect',async(req)=>{const host=owner(req);connectionTests.clear(host.channel.id);await twitch.revoke(host.channel.id);for(const room of store.shows(host.channel.id))for(const p of peers.get(room.roomId)??[])p.socket.close(1008);return {ok:true};});
  app.get('/api/connection',async(req)=>connectionTests.state(owner(req).channel.id));
  app.post('/api/connection/test',async(req)=>connectionTests.mint(owner(req).channel.id));
  app.get('/api/shows',async(req)=>store.shows(owner(req).channel.id));
  app.post('/api/shows',async(req)=>{const host=owner(req);return engine.create(host.channel,twitch.connected.has(host.channel.id));});
  app.get<{Params:{id:string}}>('/api/shows/:id',async(req)=>ownedRoom(req,req.params.id));
  app.get<{Params:{id:string}}>('/api/shows/:id/backstage',async(req)=>{const room=ownedRoom(req,req.params.id);return {room,proposals:store.proposals(room)};});
  app.post<{Params:{id:string}}>('/api/shows/:id/actions',async(req)=>{ownedRoom(req,req.params.id);const body=ActionRequestSchema.safeParse(req.body);if(!body.success)throw new HttpError(400,'Invalid show action');return engine.action(req.params.id,body.data.expectedRevision,body.data.action);});
  app.post<{Params:{id:string}}>('/api/shows/:id/events',async(req)=>{ownedRoom(req,req.params.id);const body=EventsRequestSchema.safeParse(req.body);if(!body.success)throw new HttpError(400,'Invalid encounter events');return engine.events(req.params.id,body.data.expectedRevision,body.data.clientId,body.data.events);});
  app.delete<{Params:{id:string}}>('/api/shows/:id',async(req)=>{ownedRoom(req,req.params.id);await engine.serial(req.params.id,()=>{store.deleteShow(req.params.id);for(const peer of peers.get(req.params.id)??[])peer.socket.close(1000);peers.delete(req.params.id);});return {ok:true};});
  app.get<{Params:{id:string}}>('/api/recipes/:id',async(req)=>{const r=store.recipe(req.params.id);if(!r)throw new HttpError(404,'Recipe not found');ownedRoom(req,r.roomId);return r;});
  app.get<{Params:{id:string}}>('/api/shows/:id/showbill',async(req)=>{const room=ownedRoom(req,req.params.id);return {room,recipes:store.recipes(room.roomId)};});
  app.get<{Params:{id:string}}>('/api/rooms/:id/ws',{websocket:true,preValidation:async(req)=>{if(req.headers.origin!==config.origin)throw new HttpError(403,'Origin is not allowed');ownedRoom(req,(req.params as {id:string}).id);}},(socket,req)=>{
    const id=req.params.id;const s=session(req);const room=ownedRoom(req,id);const peer={socket,sessionId:s.id};const roomPeers=peers.get(id)??new Set();roomPeers.add(peer);peers.set(id,roomPeers);socket.send(JSON.stringify({schemaVersion:1,type:'snapshot',room}));socket.on('message',()=>{socket.send(JSON.stringify({schemaVersion:1,type:'error',message:'Use authenticated HTTP actions to control the show'}));});socket.on('close',()=>{roomPeers.delete(peer);if(!roomPeers.size)peers.delete(id);});
  });
  if(existsSync(config.staticRoot)){await app.register(staticFiles,{root:config.staticRoot,prefix:'/',preCompressed:true});app.setNotFoundHandler((req,reply)=>{if(req.method==='GET'&&!req.url.startsWith('/api/'))return reply.sendFile('index.html');return reply.code(404).send({error:'Not found'});});}
  let tick:ReturnType<typeof setInterval>|undefined,hourly:ReturnType<typeof setInterval>|undefined,prune:ReturnType<typeof setInterval>|undefined;
  app.addHook('onReady',async()=>{if(deps.background===false)return;store.prune(now());await twitch.start();tick=setInterval(()=>{void engine.tick().catch(()=>{});},250);tick.unref();hourly=setInterval(()=>{void twitch.hourly().catch(()=>{});},60000);hourly.unref();prune=setInterval(()=>store.prune(now()),3600000);prune.unref();});
  app.addHook('onClose',async()=>{if(tick)clearInterval(tick);if(hourly)clearInterval(hourly);if(prune)clearInterval(prune);twitch.close();for(const set of peers.values())for(const p of set)p.socket.close(1001);await Promise.allSettled([...engine.queues.values()]);store.close();});
  return app;
}
