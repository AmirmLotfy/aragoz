import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test('public rehearsal survives unavailable hosting and opens an actual stage',async({page})=>{
  await page.route('**/api/**',route=>route.abort());
  await page.goto('/');await expect(page.getByRole('heading',{name:/Chat makes/})).toBeVisible();
  await page.getByRole('button',{name:/Rehearse the show/}).click();
  const curtain=page.getByRole('button',{name:'Raise the curtain'});await expect(curtain).toBeEnabled();await curtain.click();
  await expect(page.getByTestId('game-canvas')).toBeVisible();await expect(page.getByRole('img',{name:'5 of 5 health stitches'})).toBeVisible();
  await expect(page.getByText('SOLO REHEARSAL · HOUSE SUGGESTIONS',{exact:true})).toBeVisible();
});

test('actual movement, pause and resume use the same fixed-step encounter',async({page})=>{
  await page.goto('/rehearse');await page.getByRole('button',{name:'Raise the curtain'}).click();
  const canvas=page.getByTestId('game-canvas');await canvas.focus();
  await expect.poll(async()=>Number(await canvas.getAttribute('data-sim-tick'))).toBeGreaterThan(0);
  const before=JSON.parse((await canvas.getAttribute('data-hero-position'))!);
  await page.keyboard.down('KeyD');
  try{await expect.poll(async()=>JSON.parse((await canvas.getAttribute('data-hero-position'))!).x,{timeout:8000}).toBeGreaterThan(before.x+0.2);}finally{await page.keyboard.up('KeyD');}
  const after=JSON.parse((await canvas.getAttribute('data-hero-position'))!);expect(after.x).toBeGreaterThan(before.x+0.2);
  await page.keyboard.press('Escape');await expect(page.getByRole('heading',{name:'Take your time.'})).toBeVisible();
  await expect(canvas).toHaveAttribute('data-paused','true');
  const pausedTick=await canvas.getAttribute('data-sim-tick');await page.waitForTimeout(350);expect(await canvas.getAttribute('data-sim-tick')).toBe(pausedTick);
  await page.getByRole('button',{name:'Back onstage'}).click();await expect.poll(async()=>Number(await canvas.getAttribute('data-sim-tick'))).toBeGreaterThan(Number(pausedTick));
});

test('capture telemetry snapshots do not open a browser download or interrupt combat',async({page})=>{
  const downloads:string[]=[];page.on('download',d=>downloads.push(d.suggestedFilename()));
  await page.goto('/rehearse');await page.getByRole('button',{name:'Raise the curtain'}).click();
  const canvas=page.getByTestId('game-canvas');
  await expect.poll(async()=>Number(await canvas.getAttribute('data-sim-tick'))).toBeGreaterThan(5);
  const tick=Number(await canvas.getAttribute('data-sim-tick'));
  const report=await page.evaluate(()=>new Promise<{activeFrameSamples:number;quality:string;presentationFps:number;schemaVersion:number}>(resolve=>{
    window.addEventListener('aragoz:performance-report',event=>resolve((event as CustomEvent).detail),{once:true});
    window.dispatchEvent(new Event('aragoz:request-performance'));
  }));
  expect(report).toMatchObject({schemaVersion:1,quality:'high',presentationFps:60});
  // A slow software-rendered first callback can advance several simulation
  // ticks before a complete unpaused-to-unpaused render interval exists.
  await expect.poll(()=>page.evaluate(()=>new Promise<number>(resolve=>{
    window.addEventListener('aragoz:performance-report',event=>resolve((event as CustomEvent).detail.activeFrameSamples),{once:true});
    window.dispatchEvent(new Event('aragoz:request-performance'));
  }))).toBeGreaterThan(0);
  await expect.poll(async()=>Number(await canvas.getAttribute('data-sim-tick'))).toBeGreaterThan(tick);
  expect(downloads).toEqual([]);await expect(canvas).toHaveAttribute('data-paused','false');
});

test('30fps presentation keeps combat advancing independently at60Hz',async({page})=>{
  await page.goto('/rehearse');await page.getByRole('button',{name:'Sound & controls',exact:true}).click();
  await page.getByRole('combobox',{name:'Presentation frame rate',exact:true}).selectOption('30');
  await page.getByRole('button',{name:'Back to the show',exact:true}).click();
  await page.getByRole('button',{name:'Raise the curtain',exact:true}).click();
  const canvas=page.getByTestId('game-canvas');
  await expect.poll(async()=>Number(await canvas.getAttribute('data-sim-tick'))).toBeGreaterThan(5);
  const sample=()=>page.evaluate(()=>new Promise<{tick:number;frames:number;fps:number}>(resolve=>{
    window.addEventListener('aragoz:performance-report',event=>{
      const report=(event as CustomEvent).detail;
      resolve({tick:Number(document.querySelector('[data-testid="game-canvas"]')?.getAttribute('data-sim-tick')),frames:report.activeFrameSamples,fps:report.presentationFps});
    },{once:true});
    window.dispatchEvent(new Event('aragoz:request-performance'));
  }));
  const before=await sample();
  // Observe actual presentation progress rather than benchmarking SwiftShader
  // against a hardware cadence. Device fps acceptance is recorded separately.
  await expect.poll(async()=>(await sample()).frames-before.frames,{timeout:8000}).toBeGreaterThan(10);
  const after=await sample();expect(after.fps).toBe(30);
  expect(after.tick-before.tick).toBeGreaterThan((after.frames-before.frames)*1.6);
  await expect(canvas).toHaveAttribute('data-paused','false');
});

test('configuration switch changes actual mechanic families and preserves House attribution',async({page})=>{
  await page.goto('/rehearse');await expect(page.getByRole('button',{name:'Raise the curtain'})).toBeEnabled();
  await expect(page.getByTestId('game-canvas')).toHaveAttribute('data-families','charge,steam');
  await page.getByRole('button',{name:'The Copycat’s Comeback',exact:true}).click();
  await expect(page.getByRole('button',{name:'Raise the curtain'})).toBeEnabled();
  await expect(page.getByTestId('game-canvas')).toHaveAttribute('data-families','charge,echo');
  await expect(page.getByText('House Suggestion',{exact:true}).first()).toBeVisible();
});

test('settings pause the action and expose keyboard and comfort controls',async({page})=>{
  await page.goto('/rehearse');await page.getByRole('button',{name:'Raise the curtain'}).click();
  await page.getByRole('button',{name:'Sound & controls'}).click();
  await expect(page.getByRole('dialog')).toBeVisible();await expect(page.getByLabel('Reduce decorative motion')).toBeVisible();
  await page.getByLabel('Mute all game audio').check();await page.getByRole('button',{name:'Back to the show'}).click();
  await expect(page.getByRole('heading',{name:'Take your time.'})).toBeVisible();
});

test('the entire arena fits a 720p desktop play window',async({page})=>{
  await page.setViewportSize({width:1280,height:720});
  await page.goto('/rehearse');await page.getByRole('button',{name:'Raise the curtain'}).click();
  const canvas=page.getByTestId('game-canvas'),bounds=await canvas.boundingBox();
  expect(bounds).not.toBeNull();expect(bounds!.y).toBeGreaterThanOrEqual(0);
  expect(bounds!.y+bounds!.height).toBeLessThanOrEqual(720);
  expect(bounds!.x).toBeGreaterThanOrEqual(0);expect(bounds!.x+bounds!.width).toBeLessThanOrEqual(1280);
  await expect(page.getByRole('img',{name:'5 of 5 health stitches'})).toBeVisible();
});

test.describe('Retina presentation',()=>{
  test.use({deviceScaleFactor:2});
  test('standard quality preserves crisp pixels and low quality reduces resolution',async({page})=>{
    await page.goto('/rehearse');await expect(page.getByRole('button',{name:'Raise the curtain'})).toBeEnabled();
    const canvas=page.getByTestId('game-canvas');
    const standard=await canvas.evaluate(element=>({buffer:(element as HTMLCanvasElement).width,css:element.getBoundingClientRect().width}));
    expect(standard.buffer/standard.css).toBeGreaterThan(1.4);expect(standard.buffer/standard.css).toBeLessThan(1.6);
    await page.getByRole('button',{name:'Sound & controls'}).click();
    await page.getByRole('combobox',{name:'Quality',exact:true}).selectOption('low');
    await page.getByRole('button',{name:'Back to the show'}).click();
    await expect.poll(async()=>canvas.evaluate(element=>(element as HTMLCanvasElement).width/element.getBoundingClientRect().width)).toBeLessThan(1.1);
    const reduced=await canvas.evaluate(element=>({buffer:(element as HTMLCanvasElement).width,css:element.getBoundingClientRect().width}));
    expect(reduced.buffer).toBeLessThan(standard.buffer);expect(reduced.buffer/reduced.css).toBeGreaterThan(.9);
  });
});

test('missing approved asset uses the shipped development geometry without changing mechanics',async({page})=>{
  const entries=JSON.parse(await readFile('assets/manifest.json','utf8'));
  const hero={...entries.find((entry:{id:string})=>entry.id==='hero'),glbPath:'/assets/runtime/missing.glb'};
  await page.route('**/assets/manifest.json',route=>route.fulfill({json:[hero]}));
  await page.route('**/assets/runtime/missing.glb',route=>route.fulfill({status:404,body:'Fixture missing asset'}));
  const missingRequest=page.waitForRequest('**/assets/runtime/missing.glb');
  await page.goto('/rehearse');await expect(page.getByRole('button',{name:'Raise the curtain'})).toBeEnabled();
  await missingRequest;
  await page.getByRole('button',{name:'Raise the curtain'}).click();await expect(page.getByTestId('game-canvas')).toHaveAttribute('data-families','charge,steam');
  await page.getByTestId('game-canvas').screenshot({path:'evidence/browser/fallback-stage.png'});
});

test('a stalled manifest reaches the playable shipped fallback',async({page})=>{
  let release!:()=>void;
  const held=new Promise<void>(resolve=>{release=resolve;});
  await page.route('**/assets/manifest.json',async route=>{await held;await route.fulfill({json:[]}).catch(()=>{});});
  try{
    await page.goto('/rehearse');
    const curtain=page.getByRole('button',{name:'Raise the curtain'});
    await expect(curtain).toBeEnabled({timeout:12000});
    await expect(page.getByTestId('game-canvas')).toHaveAttribute('data-geometry','Shipped fallback geometry · asset recovery');
    await curtain.click();
    await expect.poll(async()=>Number(await page.getByTestId('game-canvas').getAttribute('data-sim-tick'))).toBeGreaterThan(0);
  }finally{release();}
});

test('an asset arriving after the deadline cannot replace geometry during the fight',async({page})=>{
  const entries=JSON.parse(await readFile('assets/manifest.json','utf8'));
  const hero=entries.find((entry:{id:string})=>entry.id==='hero');
  const bytes=await readFile('assets/runtime/hero.glb');
  let release!:()=>void;
  const held=new Promise<void>(resolve=>{release=resolve;});
  await page.route('**/assets/manifest.json',route=>route.fulfill({json:[hero]}));
  await page.route('**/assets/runtime/hero.glb',async route=>{await held;await route.fulfill({body:bytes,contentType:'model/gltf-binary'}).catch(()=>{});});
  try{
    await page.goto('/rehearse');
    const canvas=page.getByTestId('game-canvas');
    await expect(page.getByRole('button',{name:'Raise the curtain'})).toBeEnabled({timeout:12000});
    await expect(canvas).toHaveAttribute('data-geometry','Shipped fallback geometry · asset recovery');
    const triangles=await canvas.getAttribute('data-triangles');
    const lateResponse=page.waitForResponse('**/assets/runtime/hero.glb');release();await lateResponse;
    // Allow the genuine loader to decode its late container before checking admission.
    await page.waitForTimeout(1200);
    await expect(canvas).toHaveAttribute('data-geometry','Shipped fallback geometry · asset recovery');
    await expect(canvas).toHaveAttribute('data-triangles',triangles!);
    await page.getByRole('button',{name:'Raise the curtain'}).click();
    await expect.poll(async()=>Number(await canvas.getAttribute('data-sim-tick'))).toBeGreaterThan(0);
  }finally{release();}
});

test('unavailable WebGL exposes a clickable recovery screen above the opening card',async({page})=>{
  await page.addInitScript(()=>{
    const original=HTMLCanvasElement.prototype.getContext;
    Object.defineProperty(HTMLCanvasElement.prototype,'getContext',{value:function(this:HTMLCanvasElement,kind:string,...args:unknown[]){
      return kind.includes('webgl')?null:Reflect.apply(original,this,[kind,...args]);
    }});
  });
  await page.goto('/rehearse');
  await expect(page.getByRole('heading',{name:'The stage needs to reopen.'})).toBeVisible();
  await expect(page.getByRole('button',{name:'Preparing the stage…'})).toBeDisabled();
  await page.getByRole('button',{name:'Reload the stage'}).click({trial:true});
  await expect(page.getByTestId('game-canvas')).toHaveAttribute('data-stage-error','true');
});

test('context loss permanently pauses this canvas until a safe reload',async({page})=>{
  await page.goto('/rehearse');await page.getByRole('button',{name:'Raise the curtain'}).click();
  const canvas=page.getByTestId('game-canvas');
  await expect.poll(async()=>Number(await canvas.getAttribute('data-sim-tick'))).toBeGreaterThan(0);
  // Exercise the engine's context-loss event path; this does not claim device GPU failure evidence.
  await canvas.dispatchEvent('webglcontextlost',{cancelable:true});
  await expect(canvas).toHaveAttribute('data-paused','true');
  await expect(canvas).toHaveAttribute('data-stage-error','true');
  const frozenTick=await canvas.getAttribute('data-sim-tick');
  await canvas.dispatchEvent('webglcontextrestored');
  await page.keyboard.press('KeyD');await page.waitForTimeout(350);
  await expect(canvas).toHaveAttribute('data-sim-tick',frozenTick!);
  await page.getByRole('button',{name:'Reload the stage'}).click({trial:true});
});
