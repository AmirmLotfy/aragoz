// Bounded AI-led keyboard play of the real public House show. No combat/state
// injection, no provider commands, no fake results, no OBS/human acceptance.
import {chromium} from '@playwright/test';
import {createHash} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
const target=new URL(process.env.ARAGOZ_HOUSE_REVIEW_URL??'http://127.0.0.1:3000/house-show');
if(target.pathname!=='/house-show'||target.username||target.password||target.search||target.hash||!['http:','https:'].includes(target.protocol))throw Error('Use an uncredentialed House-show URL.');
const output='evidence/browser/autonomous-house';await mkdir(output,{recursive:true});
const receipt={kind:'AI-led actual browser keyboard play; not human, Twitch or OBS acceptance',url:target.href,at:new Date().toISOString(),muted:true,attempts:[],observations:[],pageErrorHashes:[],passed:false};
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--mute-audio','--use-angle=metal','--disable-dev-shm-usage']});
const page=await browser.newPage({viewport:{width:1280,height:720}}),held=new Set();
const blocks=[{x:-3.1,z:-.2},{x:3.1,z:.9}].map(b=>({minX:b.x-.99,maxX:b.x+.99,minZ:b.z-.99,maxZ:b.z+.99}));
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
function inside(p,b){return p.x>b.minX&&p.x<b.maxX&&p.z>b.minZ&&p.z<b.maxZ;}
function clearPoint(p){for(const b of blocks)if(inside(p,b)){const options=[{x:b.minX-.04,z:p.z},{x:b.maxX+.04,z:p.z},{x:p.x,z:b.minZ-.04},{x:p.x,z:b.maxZ+.04}];return options.sort((a,c)=>distance(a,p)-distance(c,p))[0];}return p;}
function obstructed(a,b){return blocks.some(r=>{let lo=0,hi=1;for(const [axis,min,max] of [['x','minX','maxX'],['z','minZ','maxZ']]){const delta=b[axis]-a[axis];if(Math.abs(delta)<1e-7){if(a[axis]<=r[min]||a[axis]>=r[max])return false;}else{const one=(r[min]-a[axis])/delta,two=(r[max]-a[axis])/delta;lo=Math.max(lo,Math.min(one,two));hi=Math.min(hi,Math.max(one,two));if(lo>=hi)return false;}}return hi>0&&lo<1;});}
function waypoint(start,destination){
 const escaped=clearPoint(start);if(distance(start,escaped)>.001)return escaped;
 const goal=clearPoint(destination),nodes=[start,goal,...blocks.flatMap(b=>[b.minX-.04,b.maxX+.04].flatMap(x=>[b.minZ-.04,b.maxZ+.04].map(z=>({x,z}))))],cost=nodes.map(()=>Infinity),previous=[],done=new Set();cost[0]=0;
 for(let count=0;count<nodes.length;count++){let best=-1;for(let i=0;i<nodes.length;i++)if(!done.has(i)&&(best<0||cost[i]<cost[best]))best=i;if(best<0||!Number.isFinite(cost[best]))break;if(best===1)break;done.add(best);for(let j=0;j<nodes.length;j++)if(j!==best&&!obstructed(nodes[best],nodes[j])){const c=cost[best]+distance(nodes[best],nodes[j]);if(c<cost[j]){cost[j]=c;previous[j]=best;}}}
 if(previous[1]===undefined)return goal;let next=1;while(previous[next]!==0&&previous[next]!==undefined)next=previous[next];return nodes[next];
}
async function keys(next){for(const key of [...held])if(!next.includes(key)){await page.keyboard.up(key);held.delete(key);}for(const key of next)if(!held.has(key)){await page.keyboard.down(key);held.add(key);}}
const save=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('aragoz.house-show.v1')).show);
const state=()=>page.evaluate(()=>{const c=document.querySelector('[data-testid="game-canvas"]');if(!c)return null;return ({tick:Number(c.dataset.simTick),paused:c.dataset.paused==='true',stage:c.dataset.bossStage,active:c.dataset.activeSlot,hero:JSON.parse(c.dataset.heroPosition),boss:JSON.parse(c.dataset.bossPosition),facing:JSON.parse(c.dataset.bossFacing),modules:JSON.parse(c.dataset.modules),attemptId:c.dataset.attemptId,hash:c.dataset.recipeHash});});
async function choose(family){const card=page.locator('.placard').filter({has:page.locator('.family-label').filter({hasText:new RegExp('^'+family)})}).first();await card.getByRole('button').click();}
async function raise(){const button=page.getByRole('button',{name:'Raise the curtain',exact:true});await button.click({timeout:20000});await page.waitForFunction(()=>Number(document.querySelector('[data-testid="game-canvas"]')?.getAttribute('data-sim-tick'))>0,null,{timeout:10000});await page.getByTestId('game-canvas').focus();}
try{
 await page.addInitScript(()=>localStorage.setItem('aragoz.preferences.v1',JSON.stringify({muted:true,presentationFps:30,reducedMotion:true,shake:0})));
 await page.route('**/*',route=>{const u=new URL(route.request().url());return u.origin===target.origin&&!u.pathname.startsWith('/api/')&&route.request().method()==='GET'?route.continue():route.abort();});
 page.on('pageerror',error=>receipt.pageErrorHashes.push(createHash('sha256').update(error.message).digest('hex')));
 await page.goto(target.href);await page.getByRole('button',{name:'Unmute game audio'}).waitFor();
 const pairs=[['charge','steam'],['charge','echo'],['steam','echo']],deadline=Date.now()+6*60*1000;
 for(let act=1;act<=3;act++){
  await choose(pairs[act-1][0]);await choose(pairs[act-1][1]);let won=false;
  for(let retry=0;retry<2&&!won;retry++){
   if(Date.now()>deadline)throw Error('Six-minute review budget exceeded');await raise();const initial=await state(),started=Date.now();let lastDodge=0,lastSample=0;
   while(await page.getByTestId('game-canvas').count()){
    if(Date.now()>deadline||Date.now()-started>85000)throw Error('Actual encounter did not finish within the bounded review');
    const s=await state();if(!s)break;const intact=s.modules.filter(m=>!m.broken),exposed=intact.find(m=>m.exposed);let destination=s.boss;
    if(intact.length){const module=exposed??intact[0],offset=module.slotId==='left'?-1.05:1.05;destination={x:s.boss.x+offset*s.facing.z+.2*s.facing.x,z:s.boss.z-offset*s.facing.x+.2*s.facing.z};
     // Bait the first charge behind the west marked block, then follow exposed sockets.
     if(!exposed&&module.mechanicId==='charge'&&s.tick<480)destination={x:-5.3,z:1};
    }
    const point=waypoint(s.hero,destination),dx=point.x-s.hero.x,dz=point.z-s.hero.z,next=['KeyJ'];
    if(distance(s.hero,destination)>1.12||distance(point,destination)>.01){if(Math.abs(dx)>.15)next.push(dx<0?'KeyA':'KeyD');if(Math.abs(dz)>.15)next.push(dz<0?'KeyW':'KeyS');}
    await keys(next);
    if(s.stage==='active'&&Date.now()-lastDodge>850){await page.keyboard.press('Space');lastDodge=Date.now();}
    if(Date.now()-lastSample>700){receipt.observations.push({act,...s});lastSample=Date.now();}
    await page.waitForTimeout(55);
   }
   await keys([]);const current=await save(),result=current.results.at(-1);receipt.attempts.push({act,recipeHash:initial.hash,attemptId:initial.attemptId,...result});
   if(result?.outcome==='won')won=true;else if(retry===0)await page.getByRole('button',{name:'Encore · same recipe',exact:true}).click();
  }
  if(!won)throw Error('Act '+act+' did not win in two actual attempts');
  await page.screenshot({path:output+'/act-'+act+'-won.png'});
  await page.getByRole('button',{name:act===3?'Close the three-act show':'Next act',exact:true}).click();
 }
 await page.getByRole('heading',{name:'Your rules. Your loopholes.'}).waitFor();receipt.show=await save();await page.screenshot({path:output+'/showbill.png',fullPage:true});receipt.passed=receipt.show.phase==='showbill'&&receipt.attempts.filter(a=>a.outcome==='won').length===3&&receipt.pageErrorHashes.length===0;
 if(!receipt.passed)throw Error('Final showbill failed validation');
}catch(error){receipt.failure=String(error.message);process.exitCode=1;await page.screenshot({path:output+'/review-stopped.png',fullPage:true}).catch(()=>{});}
finally{await keys([]).catch(()=>{});await browser.close();await writeFile(output+'/receipt.json',JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify({passed:receipt.passed,attempts:receipt.attempts,failure:receipt.failure??null,receipt:output+'/receipt.json'}));}
