import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { applyHouseEvents, beginHouseAttempt, chooseHouseProfile, createHouseShow, houseChoices, houseRecipe } from '../../apps/web/src/house-show';

const SAVE='aragoz.house-show.v1';
const saved=(page:Page)=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)!).show,SAVE);
async function selectContracts(page:Page){
  await expect(page.getByRole('button',{name:/^Choose /})).toHaveCount(3);
  await page.getByRole('button',{name:/^Choose /}).first().click();
  await expect(page.getByText('ALREADY CHOSEN',{exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:/^Choose /}).filter({hasText:/^Choose (?!the first)/})).toHaveCount(3);
  await page.locator('.placards button').first().click();
  await expect(page.getByRole('button',{name:'Raise the curtain',exact:true})).toBeEnabled({timeout:20000});
}

test.beforeEach(async({page})=>{
  // Both browser launch and in-game audio are muted before any simulation starts.
  await page.addInitScript(()=>localStorage.setItem('aragoz.preferences.v1',JSON.stringify({muted:true,reducedMotion:true,presentationFps:30})));
  await page.route('**/api/**',route=>route.abort());
});

test('account-free House choices assemble at tick zero, move, and recover after refresh',async({page})=>{
  await page.setViewportSize({width:1280,height:720});
  await page.goto('/');await page.getByRole('button',{name:/Start a House show/}).click();
  await expect(page.getByRole('button',{name:'Unmute game audio'})).toBeVisible();
  await selectContracts(page);
  const canvas=page.getByTestId('game-canvas');
  await expect.poll(()=>page.evaluate(()=>window.scrollY)).toBe(0);
  await expect(canvas).toHaveAttribute('data-sim-tick','0');await expect(canvas).toHaveAttribute('data-assembly-progress','1');
  const curtainBounds=await page.getByRole('button',{name:'Raise the curtain',exact:true}).boundingBox();const cardBounds=await page.locator('.instruction-card').boundingBox();expect(curtainBounds!.y+curtainBounds!.height).toBeLessThanOrEqual(cardBounds!.y+cardBounds!.height);
  const first=await saved(page);expect(first.recipes[0].modules.every((m:{credit:{source:string}})=>m.credit.source==='house')).toBe(true);
  const bounds=await canvas.boundingBox();expect(bounds!.y+bounds!.height).toBeLessThanOrEqual(720);
  await page.screenshot({path:'evidence/browser/house-ready-720p.png'});
  await page.getByRole('button',{name:'Raise the curtain',exact:true}).click();await canvas.focus();
  await expect.poll(async()=>Number(await canvas.getAttribute('data-sim-tick'))).toBeGreaterThan(0);
  const start=JSON.parse((await canvas.getAttribute('data-hero-position'))!);
  await page.keyboard.down('KeyD');
  try{await expect.poll(async()=>JSON.parse((await canvas.getAttribute('data-hero-position'))!).x).toBeGreaterThan(start.x+.2);}finally{await page.keyboard.up('KeyD');}
  await page.getByRole('button',{name:'Pause',exact:true}).click();
  await page.reload();await expect(page.getByText(/unfinished fight is recorded as abandoned/)).toBeVisible();
  await page.getByRole('button',{name:'Continue in this window'}).click();
  await expect(page.getByRole('button',{name:'Raise the curtain',exact:true})).toBeEnabled({timeout:20000});
  const recovered=await saved(page);expect(recovered.recipes).toEqual(first.recipes);expect(recovered.attempt.id).not.toBe(first.attempt.id);
  expect(recovered.results).toHaveLength(1);expect(recovered.results[0].outcome).toBe('abandoned');
  await expect(canvas).toHaveAttribute('data-sim-tick','0');await expect(canvas).toHaveAttribute('data-paused','true');
});

test('three skipped encounters produce a finite cumulative showbill and downloadable local record',async({page})=>{
  await page.goto('/house-show');
  for(let act=1;act<=3;act++){
    await selectContracts(page);await page.getByRole('button',{name:'Raise the curtain',exact:true}).click();
    await page.getByRole('button',{name:'Pause',exact:true}).click();await page.getByRole('button',{name:'Skip this act',exact:true}).click();
  }
  await expect(page.getByTestId('house-show')).toHaveAttribute('data-house-phase','showbill');
  await expect(page.getByText('0 wins · 0 defeats · 3 skipped · 0 abandoned',{exact:true})).toBeVisible();
  expect((await saved(page)).recipes).toHaveLength(3);expect((await saved(page)).results).toHaveLength(3);
  await expect(page.getByTestId('game-canvas')).toHaveCount(0);
  await page.screenshot({path:'evidence/browser/house-showbill.png'});
  const download=page.waitForEvent('download');await page.getByRole('button',{name:'Download this showbill'}).click();expect((await download).suggestedFilename()).toMatch(/^aragoz-house-.*showbill.json$/);
  await page.reload();await page.getByRole('button',{name:'Continue in this window'}).click();
  await expect(page.getByTestId('house-show')).toHaveAttribute('data-house-phase','showbill');
});

test('a second window requires explicit takeover and the previous controller cannot write',async({page,context})=>{
  await page.goto('/house-show');await selectContracts(page);
  await page.getByRole('button',{name:'Raise the curtain',exact:true}).click();
  const before=await saved(page),other=await context.newPage();
  await other.goto('/house-show');await expect(other.getByRole('button',{name:'Continue in this window'})).toBeVisible();
  await expect(other.getByTestId('game-canvas')).toHaveCount(0);
  await other.getByRole('button',{name:'Continue in this window'}).click();
  await expect(page.getByRole('button',{name:'Continue in this window'})).toBeVisible();await expect(page.getByTestId('game-canvas')).toHaveCount(0);
  await expect(other.getByRole('button',{name:'Raise the curtain',exact:true})).toBeEnabled({timeout:20000});
  const after=await saved(other);expect(after.attempt.id).not.toBe(before.attempt.id);expect(after.results).toHaveLength(1);expect(after.results[0].outcome).toBe('abandoned');
  await other.close();
});

test('labelled local result fixture exercises immutable Encore and one-slot Remix',async({page})=>{
  // A state-machine fixture, not a claimed gameplay win or viewer acceptance.
  let show=createHouseShow();show=await chooseHouseProfile(show,houseChoices(show)[0]);show=await chooseHouseProfile(show,houseChoices(show)[0]);show=beginHouseAttempt(show);
  const recipe=houseRecipe(show)!;
  show=applyHouseEvents(show,[{schemaVersion:1,attemptId:show.attempt!.id,recipeHash:recipe.hash,sequence:1,simTick:400,kind:'outcome',moduleSlot:null,value:null,outcome:'lost'}]);
  await page.addInitScript(({key,show})=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify({version:1,writerId:'browser-fixture',show}));},{key:SAVE,show});
  await page.goto('/house-show');await page.getByRole('button',{name:'Continue in this window'}).click();
  await expect(page.getByTestId('game-canvas')).toHaveCount(0);
  await page.getByRole('button',{name:'Remix left attachment',exact:true}).click();
  await expect(page.getByText('THIS ATTACHMENT STAYS',{exact:true})).toBeVisible();await expect(page.locator('.placards button')).toHaveCount(3);
  await page.getByRole('button',{name:'Keep the current recipe'}).click();
  await page.getByRole('button',{name:'Encore · same recipe'}).click();
  await expect(page.getByRole('button',{name:'Raise the curtain',exact:true})).toBeEnabled({timeout:20000});
  let current=await saved(page);expect(current.recipes).toEqual(show.recipes);expect(current.attempt.id).not.toBe(show.attempt!.id);
  // Return to the same explicit result fixture to test a committed replacement.
  await page.evaluate(({key,show})=>localStorage.setItem(key,JSON.stringify({version:1,writerId:'browser-fixture',show})),{key:SAVE,show});
  await page.reload();await page.getByRole('button',{name:'Continue in this window'}).click();
  await page.getByRole('button',{name:'Remix left attachment',exact:true}).click();await page.locator('.placards button').first().click();
  await expect(page.getByRole('button',{name:'Raise the curtain',exact:true})).toBeEnabled({timeout:20000});
  current=await saved(page);expect(current.recipes).toHaveLength(2);const remixed=current.recipes[1];expect(remixed.hash).not.toBe(recipe.hash);expect(remixed.modules[1]).toEqual(recipe.modules[1]);expect(current.results).toEqual(show.results);
});

test('corrupt saves require explicit replacement and storage failure remains playable',async({page})=>{
  await page.addInitScript(()=>localStorage.setItem('aragoz.house-show.v1','{broken'));
  await page.goto('/house-show');await expect(page.getByRole('alert')).toContainText('damaged');
  await page.getByRole('button',{name:'Start a fresh House show'}).click();await page.getByRole('button',{name:'Start new House show'}).click();
  await expect(page.locator('.placards button')).toHaveCount(3);
  await page.screenshot({path:'evidence/browser/house-choices.png'});
  // Simulated browser quota failure, not a real disk-full claim.
  await page.addInitScript(()=>{const set=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='aragoz.house-show.v1')throw new DOMException('Fixture quota','QuotaExceededError');return set.call(this,key,value);};});
  await page.reload();await page.getByRole('button',{name:'Start a fresh House show'}).click();await page.getByRole('button',{name:'Start new House show'}).click();
  await expect(page.getByRole('status')).toContainText('Saving is unavailable');await selectContracts(page);
});

test('a failed write warns about lost progress and refresh restores the older readable save',async({page})=>{
  await page.goto('/house-show');
  await page.locator('.placards button').first().click();
  await expect(page.getByText('ALREADY CHOSEN',{exact:true})).toBeVisible();
  const previous=await saved(page);
  // A write-only quota fixture leaves the existing save readable and unchanged.
  // It applies to this document only, so reloading restores ordinary storage access.
  await page.evaluate(()=>{const set=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='aragoz.house-show.v1')throw new DOMException('Fixture quota','QuotaExceededError');return set.call(this,key,value);};});
  await page.locator('.placards button').first().click();
  await expect(page.getByRole('button',{name:'Raise the curtain',exact:true})).toBeEnabled({timeout:20000});
  await expect(page.getByRole('status')).toContainText('your latest progress will not be saved');
  await expect(page.getByRole('status')).toContainText('Refreshing may restore an older show');
  expect(await saved(page)).toEqual(previous);
  await page.reload();await page.getByRole('button',{name:'Continue in this window'}).click();
  await expect(page.getByText('ALREADY CHOSEN',{exact:true})).toBeVisible();
  await expect(page.getByTestId('house-show')).toHaveAttribute('data-house-phase','choose');
  await expect(page.getByTestId('game-canvas')).toHaveCount(0);
  expect(await saved(page)).toEqual(previous);
});

test('external storage clearing removes the playing window and cannot resurrect its show',async({page,context})=>{
  await page.goto('/house-show');await selectContracts(page);
  await page.getByRole('button',{name:'Raise the curtain',exact:true}).click();
  await expect.poll(async()=>Number(await page.getByTestId('game-canvas').getAttribute('data-sim-tick'))).toBeGreaterThan(0);
  const other=await context.newPage();
  try{
    await other.goto('/house-show');
    await expect(other.getByRole('button',{name:'Continue in this window'})).toBeVisible();
    await other.evaluate(()=>localStorage.clear());
    await expect(page.getByRole('alert')).toContainText('saved House show was removed');
    await expect(page.getByTestId('game-canvas')).toHaveCount(0);
    await expect(page.getByRole('button',{name:'Continue in this window'})).toHaveCount(0);
    expect(await page.evaluate(key=>localStorage.getItem(key),SAVE)).toBeNull();
  }finally{await other.close();}
});

test('a missing save is detected before publishing even without a storage event',async({page})=>{
  await page.goto('/house-show');
  await expect(page.locator('.placards button')).toHaveCount(3);
  // Storage changes in this document produce no storage event in this window.
  // This exercises the publish guard before an external-clear event could arrive.
  await page.evaluate(key=>localStorage.removeItem(key),SAVE);
  await page.locator('.placards button').first().click();
  await expect(page.getByRole('alert')).toContainText('saved House show was removed');
  await expect(page.locator('.placards button')).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Continue in this window'})).toHaveCount(0);
  expect(await page.evaluate(key=>localStorage.getItem(key),SAVE)).toBeNull();
});

test('narrow layout keeps choices and keyboard focus within the page',async({page})=>{
  await page.setViewportSize({width:390,height:844});await page.goto('/house-show');
  await expect(page.locator('.placards button')).toHaveCount(3);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.locator('.placards button').first().focus();await page.keyboard.press('Enter');
  await expect(page.getByText('ALREADY CHOSEN',{exact:true})).toBeVisible();
  await page.screenshot({path:'evidence/browser/house-choice-narrow.png',fullPage:true});
});

test('an actual House encounter records defeat and Encore returns the same recipe to a paused curtain',async({page})=>{
  test.setTimeout(120000);
  await page.goto('/house-show');await selectContracts(page);
  const original=await saved(page);await page.getByRole('button',{name:'Raise the curtain',exact:true}).click();
  await expect(page.getByRole('button',{name:'Encore · same recipe'})).toBeVisible({timeout:100000});
  const result=await saved(page);await writeFile('evidence/browser/house-actual-result.json',JSON.stringify({kind:'AI-led actual browser encounter; no viewer or provider acceptance',show:result},null,2)+'\n');expect(result.results).toHaveLength(1);expect(result.results[0].outcome).toBe('lost');expect(result.results[0].durationTicks).toBeGreaterThan(0);
  await expect(page.getByTestId('game-canvas')).toHaveCount(0);
  await page.screenshot({path:'evidence/browser/house-actual-result.png'});
  await page.getByRole('button',{name:'Encore · same recipe'}).click();
  await expect(page.getByRole('button',{name:'Raise the curtain',exact:true})).toBeEnabled({timeout:20000});
  const encore=await saved(page);expect(encore.recipes).toEqual(original.recipes);expect(encore.results).toEqual(result.results);expect(encore.attempt.id).not.toBe(original.attempt.id);
  await expect(page.getByTestId('game-canvas')).toHaveAttribute('data-sim-tick','0');
});
