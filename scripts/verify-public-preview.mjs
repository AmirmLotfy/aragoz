// Actual public HTTP/WSS boundary checks. No fixture hosts, OAuth bypass or chat.
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import WebSocket from 'ws';
const root=resolve(import.meta.dirname,'..'),runtime=JSON.parse(readFileSync(resolve(root,'.runtime/public-preview.json'),'utf8'));
const origin=runtime.origin;if(!/^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/.test(origin))throw Error('Use the current owned HTTPS preview.');
const resume=process.argv.includes('--resume-session'),statePath=resolve(root,'.runtime/hosted-probe-session.json');
const receipt={kind:'Actual public HTTPS/WSS anonymous boundary checks; not browser gameplay, genuine OAuth/channel isolation or human acceptance',at:new Date().toISOString(),origin,resumed:resume,checks:[],providerCalls:0};
const check=(name,pass,detail)=>{receipt.checks.push({name,pass,detail});if(!pass)throw Error(name+' failed');};
const request=(path,options={})=>fetch(origin+path,{...options,signal:AbortSignal.timeout(15000)});
let cookie,csrf;
try{
  const health=await request('/api/readiness'),ready=await health.json();check('frontend/database ready',health.ok&&ready.ready&&ready.frontendReady,{status:health.status});check('model calls disabled',ready.modelEnabled===false,{});
  const index=await request('/house-show'),html=await index.text(),localHtml=readFileSync(resolve(root,'apps/web/dist/index.html'),'utf8');check('public frontend equals packaged build',index.ok&&html===localHtml,{status:index.status});
  check('content security policy',index.headers.get('content-security-policy')?.includes("frame-ancestors 'self'")&&index.headers.get('x-content-type-options')==='nosniff',{});
  const entry=html.match(/src="(\/assets\/[^"\s]+\.js)"/);check('entry asset referenced',!!entry,{});
  const asset=await request(entry[1],{headers:{'accept-encoding':'gzip'}}),bytes=Buffer.from(await asset.arrayBuffer()),packaged=readFileSync(resolve(root,'apps/web/dist','.'+entry[1]));
  check('entry asset matches packaged bytes',asset.ok&&bytes.equals(packaged),{status:asset.status,encoding:asset.headers.get('content-encoding'),sha256:createHash('sha256').update(bytes).digest('hex')});
  for(const path of ['/.env','/data/public-preview/credentials.key','/.runtime/public-preview.json']){
    const response=await request(path),body=await response.text();check('private file unavailable: '+path,response.status===404||(response.ok&&body===localHtml),{status:response.status,servedPublicShellOnly:body===localHtml});
  }
  let prior=null;if(resume){prior=JSON.parse(readFileSync(statePath,'utf8'));if(prior.origin!==origin)throw Error('Saved anonymous session belongs to another origin');cookie=prior.cookie;csrf=prior.csrf;}
  const session=await request('/api/session',{headers:cookie?{cookie}:{}}),data=await session.json();
  check('anonymous session cannot become a host',session.ok&&data.authenticated===false&&data.channel===null,{status:session.status,hostingConfigured:data.hostingConfigured});
  if(resume)check('same anonymous session survived service reload',data.csrfToken===csrf,{});
  else{
    const set=session.headers.get('set-cookie')??'';check('session cookie protected',/HttpOnly/i.test(set)&&/Secure/i.test(set)&&/SameSite=Lax/i.test(set),{});
    cookie=set.split(';')[0];csrf=data.csrfToken;writeFileSync(statePath,JSON.stringify({origin,cookie,csrf},null,2)+'\n',{mode:0o600});
  }
  for(const path of ['/api/shows','/api/shows/unknown/backstage','/api/connection']){const response=await request(path,{headers:{cookie}});check('anonymous host API denied: '+path,response.status===401,{status:response.status});}
  let response=await request('/api/shows',{method:'POST',headers:{cookie,origin,'content-type':'application/json'},body:'{}'});check('mutation without CSRF denied',response.status===403,{status:response.status});
  response=await request('/api/shows',{method:'POST',headers:{cookie,origin:'https://invalid.example','x-csrf-token':csrf,'content-type':'application/json'},body:'{}'});check('foreign-origin mutation denied',response.status===403,{status:response.status});
  response=await request('/api/shows',{method:'POST',headers:{cookie,origin,'x-csrf-token':csrf,'content-type':'application/json'},body:'{}'});check('valid anonymous CSRF cannot create show',response.status===401,{status:response.status});
  for(const [label,webOrigin,expected] of [['foreign origin','https://invalid.example',403],['anonymous same origin',origin,401]]){
    const status=await new Promise((resolve,reject)=>{let settled=false;const socket=new WebSocket(origin.replace('https:','wss:')+'/api/rooms/unknown/ws',{headers:{origin:webOrigin,cookie},handshakeTimeout:15000});socket.once('unexpected-response',(_request,response)=>{settled=true;response.resume();socket.terminate();resolve(response.statusCode);});socket.once('open',()=>{settled=true;socket.close();reject(Error('Unauthorized socket opened'));});socket.on('error',error=>{if(!settled){settled=true;reject(error);}});});
    check('WebSocket '+label+' denied',status===expected,{status});
  }
  receipt.complete=true;
}catch(error){receipt.complete=false;receipt.failure=error.message;process.exitCode=1;}
const output=resolve(root,'evidence/hosted-boundary-'+(resume?'after':'before')+'-reload-20261027.json');writeFileSync(output,JSON.stringify(receipt,null,2)+'\n');
console.log(JSON.stringify({origin,complete:receipt.complete,checks:receipt.checks.length,failure:receipt.failure??null,receipt:output}));
