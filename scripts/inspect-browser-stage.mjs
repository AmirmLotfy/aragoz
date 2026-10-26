import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
const origin=process.env.ARAGOZ_REVIEW_ORIGIN??'http://127.0.0.1:5173';
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_PATH??'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--disable-dev-shm-usage','--mute-audio']});
const failures=[],records=[];await mkdir('evidence/browser',{recursive:true});
try{
  const page=await browser.newPage({viewport:{width:1440,height:1100}});
  page.on('pageerror',e=>failures.push(e.message));
  for(let preset=0;preset<3;preset++){
    await page.addInitScript(()=>localStorage.setItem('aragoz.preferences.v1',JSON.stringify({muted:true})));await page.goto(`${origin}/rehearse?reviewAssets=1&preset=${preset}`);
    await page.getByRole('button',{name:'Raise the curtain',exact:true}).waitFor();
    await page.waitForFunction(()=>document.querySelector('[data-testid="game-canvas"]')?.getAttribute('data-geometry')?.includes('5 candidate assets'),{timeout:30000});
    await page.getByRole('button',{name:'Raise the curtain',exact:true}).click();
    await page.waitForFunction(()=>Number(document.querySelector('[data-testid="game-canvas"]')?.getAttribute('data-sim-tick'))>=30);
    const metrics=await page.getByTestId('game-canvas').evaluate(c=>{const gl=c.getContext('webgl2')??c.getContext('webgl'),ext=gl?.getExtension('WEBGL_debug_renderer_info');return{...c.dataset,renderWidth:c.width,renderHeight:c.height,renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):null};});
    const file=`evidence/browser/candidate-pair-${preset}.png`;await page.screenshot({path:file,fullPage:true});records.push({preset,capture:file,...metrics});
  }
  await page.goto(origin+'/?reviewAssets=1');await page.waitForFunction(()=>document.querySelector('[data-testid="game-canvas"]')?.getAttribute('data-geometry')?.includes('5 candidate assets'));
  await page.screenshot({path:'evidence/browser/candidate-home.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:'evidence/browser/candidate-home-mobile.png',fullPage:true});
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);if(overflow)failures.push('Mobile home overflows horizontally');
  const result={evidence:'Local automated browser and actual Babylon import; no OBS or human acceptance',at:new Date().toISOString(),origin,records,failures};await writeFile('evidence/browser/candidate-inspection.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));if(failures.length)process.exitCode=1;
}finally{await browser.close();}
