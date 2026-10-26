import {chromium} from 'playwright';import {writeFile}from'node:fs/promises';
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const evidence={evidence:'AI-led local browser play using keyboard inputs; not human or Twitch acceptance',at:new Date().toISOString(),states:[],captures:[]};
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),held=new Set();
 const keys=async next=>{for(const k of held)if(!next.includes(k)){await page.keyboard.up(k);held.delete(k);}for(const k of next)if(!held.has(k)){await page.keyboard.down(k);held.add(k);}};
 const state=()=>page.getByTestId('game-canvas').evaluate(c=>({tick:Number(c.dataset.simTick),hero:JSON.parse(c.dataset.heroPosition),boss:JSON.parse(c.dataset.bossPosition),facing:JSON.parse(c.dataset.bossFacing),stage:c.dataset.bossStage,active:c.dataset.activeSlot,modules:JSON.parse(c.dataset.modules),outcome:c.dataset.outcome}));
 const move=async(target,timeout=2500,strike=false)=>{const end=Date.now()+timeout;while(Date.now()<end){const s=await state();if(s.outcome)throw Error('Encounter ended before counter');const dx=target.x-s.hero.x,dz=target.z-s.hero.z;if(Math.hypot(dx,dz)<.45){await keys(strike?['KeyJ']:[]);return;}const next=[];if(Math.abs(dx)>.17)next.push(dx<0?'KeyA':'KeyD');if(Math.abs(dz)>.17)next.push(dz<0?'KeyW':'KeyS');if(strike)next.push('KeyJ');await keys(next);await page.waitForTimeout(35);}throw Error('Waypoint not reached '+JSON.stringify({target,state:await state()}));};
 await page.goto('http://127.0.0.1:5173/rehearse?reviewAssets=1');await page.waitForFunction(()=>document.querySelector('canvas')?.dataset.geometry?.includes('5 candidate'));
 await page.getByRole('button',{name:'Raise the curtain',exact:true}).click();await move({x:-5.3,z:1});await keys([]);
 await page.waitForFunction(()=>{const c=document.querySelector('canvas');return c?.dataset.bossStage==='exposed'&&c.dataset.activeSlot==='left';},{},{timeout:18000});
 evidence.states.push({point:'charge counter exposed',...await state()});await page.screenshot({path:'evidence/browser/charge-exposed.png'});evidence.captures.push('evidence/browser/charge-exposed.png');
 await move({x:-1.3,z:1.3},2200);const end=Date.now()+4000;await keys(['KeyJ']);
 while(Date.now()<end){const s=await state();if(s.modules[0].broken)break;const f=s.facing,p=s.boss;const socket={x:p.x-1.05*f.z+.2*f.x,z:p.z+1.05*f.x+.2*f.z};const dx=socket.x-s.hero.x,dz=socket.z-s.hero.z;const next=['KeyJ'];if(Math.hypot(dx,dz)>1.35){if(Math.abs(dx)>.18)next.push(dx<0?'KeyA':'KeyD');if(Math.abs(dz)>.18)next.push(dz<0?'KeyW':'KeyS');}await keys(next);await page.waitForTimeout(35);}
 await keys([]);const broken=await state();evidence.states.push({point:'after real strikes',...broken});if(!broken.modules[0].broken)throw Error('Charge module did not break through browser controls');
 await page.screenshot({path:'evidence/browser/charge-broken.png'});evidence.captures.push('evidence/browser/charge-broken.png');
 const stop=Date.now()+6000;while(Date.now()<stop){const s=await state();if(s.active==='left'&&['windup','active'].includes(s.stage))throw Error('Broken charge activated again');await page.waitForTimeout(100);}evidence.states.push({point:'six seconds after break',...await state()});
 await page.screenshot({path:'evidence/browser/charge-removed.png'});evidence.captures.push('evidence/browser/charge-removed.png');
 await keys(['KeyJ']);const finishBy=Date.now()+8000;
 while(Date.now()<finishBy){const s=await state();if(s.outcome)break;const f=s.facing,p=s.boss;const target=s.modules[1].broken?p:{x:p.x+1.05*f.z+.2*f.x,z:p.z-1.05*f.x+.2*f.z};const dx=target.x-s.hero.x,dz=target.z-s.hero.z;const next=['KeyJ'];if(Math.hypot(dx,dz)>1.3){if(Math.abs(dx)>.18)next.push(dx<0?'KeyA':'KeyD');if(Math.abs(dz)>.18)next.push(dz<0?'KeyW':'KeyS');}await keys(next);await page.waitForTimeout(35);}
 await keys([]);const won=await state();evidence.states.push({point:'actual final strike and result',...won});if(won.outcome!=='won')throw Error('The real final strike did not resolve the encounter');
 await page.getByRole('heading',{name:'A boast beautifully broken.'}).waitFor();await page.screenshot({path:'evidence/browser/rehearsal-won.png'});evidence.captures.push('evidence/browser/rehearsal-won.png');
 await page.getByRole('button',{name:'Encore · same recipe',exact:true}).click();await page.getByRole('button',{name:'Raise the curtain',exact:true}).waitFor();
 const replay=await state();if(replay.modules.some(m=>m.broken))throw Error('Encore did not reset physical modules');evidence.states.push({point:'Encore resets both modules',...replay});evidence.passed=true;
}catch(e){evidence.passed=false;evidence.failure=e.message;process.exitCode=1;}finally{await browser.close();await writeFile('evidence/browser/causal-counter.json',JSON.stringify(evidence,null,2)+'\n');console.log(JSON.stringify(evidence,null,2));}
