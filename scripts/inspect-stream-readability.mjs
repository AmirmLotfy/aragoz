// Actual Chromium captures at full/phone-stream scales. All audience data is a
// labelled local fixture, never a genuine viewer/provider or comprehension pass.
import {chromium} from '@playwright/test';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createLiveHarness} from '../tests/support/live-harness.ts';
const label=process.env.ARAGOZ_READABILITY_LABEL??'baseline';if(!/^[a-z0-9-]+$/.test(label))throw Error('Use a filesystem-safe label');
const directory='evidence/browser/readability-'+label;await mkdir(directory,{recursive:true});
const harness=await createLiveHarness(),browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--mute-audio','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
const context=await browser.newContext({viewport:{width:1280,height:720}});await context.addCookies([harness.sessionCookie]);
await context.addInitScript(()=>localStorage.setItem('aragoz.preferences.v1',JSON.stringify({muted:true,reducedMotion:true,presentationFps:30})));
const page=await context.newPage(),cdp=await context.newCDPSession(page);
const receipt={kind:'Local actual browser layout/contrast and native scaled captures; audience phases use labelled mock-input fixture; no human/Twitch/OBS acceptance',label,at:new Date().toISOString(),sourceViewport:{width:1280,height:720},muted:true,views:[],errors:[]};
page.on('pageerror',error=>receipt.errors.push(error.message.slice(0,160)));
const action=async command=>{const session=await context.request.get(harness.origin+'/api/session'),csrf=(await session.json()).csrfToken;const r=await context.request.post(harness.origin+'/api/shows/'+harness.roomId+'/actions',{headers:{origin:harness.origin,'x-csrf-token':csrf},data:{expectedRevision:harness.state().revision,action:command}});if(!r.ok())throw Error('Fixture action failed '+command.type+' '+r.status());};
async function record(name,selectors,anchor=null){
 await page.evaluate(anchor=>anchor?document.querySelector(anchor).scrollIntoView({block:"start"}):window.scrollTo(0,0),anchor);
 const scrollY=await page.evaluate(()=>window.scrollY);
 const text=await page.evaluate(selectors=>{
  const visible=e=>{const b=e.getBoundingClientRect(),s=getComputedStyle(e);return b.width>0&&b.height>0&&s.visibility!=='hidden'&&s.display!=='none';};
  const rgb=color=>(color.match(/[\d.]+/g)||[]).map(Number),lum=a=>a.slice(0,3).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
  const result=[];for(const selector of selectors)for(const element of document.querySelectorAll(selector)){
   if(!visible(element))continue;const s=getComputedStyle(element),b=element.getBoundingClientRect();let p=element,bg=null,imageBacked=false;
   while(p){const color=getComputedStyle(p).backgroundColor,a=rgb(color);if(a.length===3||a[3]>=.99){bg=color;break;}p=p.parentElement;}
   imageBacked=!!element.closest('.game-hud')&&!element.closest('.rule-caption,.health-panel,.act-label,.module-status');
   const a=rgb(s.color),c=bg?rgb(bg):null,ratio=c?(Math.max(lum(a),lum(c))+.05)/(Math.min(lum(a),lum(c))+.05):null;
   result.push({selector,text:element.textContent.trim().slice(0,150),fontPx:parseFloat(s.fontSize),weight:s.fontWeight,color:s.color,solidBackground:bg,contrast:imageBacked?null:ratio,imageBacked,insideCapture:b.left>=0&&b.top>=0&&b.right<=1280&&b.bottom<=720,bounds:{x:b.x,y:b.y,width:b.width,height:b.height},phone390FontPx:parseFloat(s.fontSize)*390/1280});
  }return result;
 },selectors);
 const captures=[];for(const width of [1280,844,390]){const capture=await cdp.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false,clip:{x:0,y:scrollY,width:1280,height:720,scale:width/1280}});const path=directory+'/'+name+'-'+width+'.png';await writeFile(path,Buffer.from(capture.data,'base64'));captures.push({width,path,method:'Chromium native capture scale; layout remains1280x720, no generated retouching'});}
 receipt.views.push({name,scrollY,text,captures});await writeFile(directory+'/receipt.json',JSON.stringify(receipt,null,2)+'\n');
}
try{
 await page.goto(harness.origin+'/play/'+harness.roomId);await page.getByRole('button',{name:'Open audience proposals',exact:true}).click();await harness.advance(1);
 await page.getByRole('heading',{name:'Give this villain a power… BUT give it a flaw.'}).waitFor();
 await record('proposal',['.audience-cue h2','.chat-command code','.timer strong','.chat-command>span']);
 await harness.chat({authorId:'fixture-readable-author',displayName:'FIXTURE AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',text:`!make ${harness.state().roundCode} charges at you BUT cannot turn once it starts`});
 await action({type:'close-proposals'});await action({type:'approve-candidates',candidateIds:harness.state().candidates.map(c=>c.id)});await action({type:'open-vote'});await harness.advance(1);
 await page.getByRole('heading',{name:'Which boast belongs onstage?'}).waitFor();
 await record('ballot',['.audience-cue h2','.chat-command code','.timer strong','.placard h3','.placard .flaw','.placard-credit','.choice-letter']);
 const creditedIndex=harness.state().candidates.findIndex(c=>c.credit.authorId==='fixture-readable-author');
 await harness.chat({authorId:'fixture-readable-voter',displayName:'FIXTURE Voter',text:`!vote ${harness.state().roundCode} ${'ABC'[creditedIndex]}`});
 await action({type:'close-vote'});await action({type:'use-house'});await action({type:'approve-candidates',candidateIds:harness.state().candidates.map(c=>c.id)});await action({type:'open-vote'});await harness.advance(1);
 await record('second-ballot',['.audience-cue h2','.chat-command code','.timer strong','.placard h3','.placard .flaw','.placard-credit','.stream-kept']);
 await page.goto('http://127.0.0.1:3000/rehearse');await page.getByRole('button',{name:'Raise the curtain',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('[data-testid="game-canvas"]')?.getAttribute('data-boss-stage')==='windup',null,{timeout:15000});
 await record('combat',['.rule-caption strong','.rule-caption span','.hud-eyebrow','.module-meter span','.act-label strong']);
 // Preserve actual UI settings/safe-corner positions; pausing is a normal menu action.
 await page.evaluate(()=>document.querySelector('.stage-frame').style.filter='grayscale(1)');
 await record('combat-no-colour',['.rule-caption strong','.rule-caption span','.module-meter span']);
 await page.evaluate(()=>document.querySelector('.stage-frame').style.filter='');
 await page.getByRole('button',{name:'Sound & controls',exact:true}).click();
 await record('settings',['.settings-dialog label','.settings-dialog legend','.settings-dialog button']);
 await page.getByRole('button',{name:'Back to the show',exact:true}).click();
 const historical=JSON.parse(await readFile('evidence/browser/autonomous-house/receipt.json','utf8'));
 await page.evaluate(show=>localStorage.setItem('aragoz.house-show.v1',JSON.stringify({version:1,writerId:'readability-fixture',show})),historical.show);
 await page.goto('http://127.0.0.1:3000/house-show');await page.getByRole('button',{name:'Continue in this window',exact:true}).click();
 await page.getByRole('heading',{name:'Your rules. Your loopholes.',exact:true}).waitFor();
 await record('showbill',['.house-finale h2','.house-finale>p','.house-finale button','.showbill-history-section h2']);
 await record('showbill-history',['.showbill-history article:first-child h3','.showbill-history article:first-child .rule-list strong','.showbill-history article:first-child .rule-list p','.showbill-history article:first-child .rule-list small','.showbill-history article:first-child .result-ledger'],'.showbill-history article');
 receipt.showbillFixture='Existing recorded House show restored only for layout inspection; no new gameplay/result acceptance';
 receipt.providerRequests=harness.providerRequests();receipt.captureComplete=receipt.errors.length===0&&receipt.providerRequests===0;
}catch(error){receipt.failure=error.message;process.exitCode=1;}
finally{await browser.close();await harness.close();await writeFile(directory+'/receipt.json',JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify({directory,complete:receipt.captureComplete??false,failure:receipt.failure??null,views:receipt.views.map(v=>({name:v.name,outside:v.text.filter(t=>!t.insideCapture).map(t=>t.selector),minimum390px:v.text.length?Math.min(...v.text.map(t=>t.phone390FontPx)):null,contrastFailures:v.text.filter(t=>t.contrast!==null&&t.contrast<4.5).map(t=>({selector:t.selector,ratio:t.contrast}))}))}));}
