import {expect,test} from '@playwright/test';
import {createLiveHarness} from '../support/live-harness';
import type {LiveHarness} from '../support/live-harness';

test.beforeEach(async({page})=>{await page.addInitScript(()=>localStorage.setItem('aragoz.preferences.v1',JSON.stringify({muted:true,reducedMotion:true,presentationFps:30})));});
test('stream ballot keeps command, timer, long credit and both contract choices within a720p capture',async({page,context})=>{
  await page.setViewportSize({width:1280,height:720});let harness:LiveHarness|undefined;
  try{
    harness=await createLiveHarness();await context.addCookies([harness.sessionCookie]);
    const action=async(action:Record<string,unknown>)=>{const session=await context.request.get(harness!.origin+'/api/session'),csrf=(await session.json()).csrfToken;const response=await context.request.post(harness!.origin+'/api/shows/'+harness!.roomId+'/actions',{headers:{origin:harness!.origin,'x-csrf-token':csrf},data:{expectedRevision:harness!.state().revision,action}});expect(response.status()).toBe(200);};
    await page.goto(harness.origin+'/play/'+harness.roomId);await page.getByRole('button',{name:'Open audience proposals',exact:true}).click();await harness.advance(1);
    await harness.chat({authorId:'fixture-stream-author',displayName:'FIXTURE AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',text:`!make ${harness.state().roundCode} charge BUT cannot turn`});
    await action({type:'close-proposals'});
    for(let slot=0;slot<2;slot++){
      if(slot){await action({type:'use-house'});}
      await action({type:'approve-candidates',candidateIds:harness.state().candidates.map(c=>c.id)});await action({type:'open-vote'});await harness.advance(1);
      await expect(page.locator('.stream-placards .placard')).toHaveCount(3);
      if(slot){await expect(page.locator('.stream-kept').getByText('FIXTURE AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',{exact:true})).toBeVisible();}
      await expect(page.locator('.chat-command code')).toContainText('!vote '+harness.state().roundCode);
      for(const element of await page.locator('.chat-command code,.timer strong,.stream-placards .flaw,.stream-placards .placard-credit').all()){
        const b=await element.boundingBox();expect(b).not.toBeNull();expect(b!.y).toBeGreaterThanOrEqual(0);expect(b!.x).toBeGreaterThanOrEqual(0);expect(b!.y+b!.height).toBeLessThanOrEqual(720);expect(b!.x+b!.width).toBeLessThanOrEqual(1280);
      }
      expect(await page.locator('.chat-command code').evaluate(e=>parseFloat(getComputedStyle(e).fontSize)*390/1280)).toBeGreaterThanOrEqual(12);
      if(slot===0){const i=harness.state().candidates.findIndex(c=>c.credit.authorId==='fixture-stream-author');expect(i).toBeGreaterThanOrEqual(0);await harness.chat({authorId:'fixture-stream-voter',displayName:'FIXTURE Voter',text:`!vote ${harness.state().roundCode} ${'ABC'[i]}`});}
      await action({type:'close-vote'});
    }
    expect(harness.providerRequests()).toBe(0);
  }finally{await page.close();await harness?.close();}
});

test('readable rule strip stays outside the arena and clear of each bottom webcam corner',async({page})=>{
  await page.setViewportSize({width:1280,height:720});await page.goto('/rehearse');await page.getByRole('button',{name:'Raise the curtain',exact:true}).click();
  const canvas=page.getByTestId('game-canvas'),caption=page.locator('.rule-caption');
  await expect.poll(async()=>Number(await canvas.getAttribute('data-sim-tick'))).toBeGreaterThan(0);
  const arena=await canvas.boundingBox(),strip=await caption.boundingBox();expect(strip!.y).toBeGreaterThanOrEqual(arena!.y+arena!.height);expect(strip!.y+strip!.height).toBeLessThanOrEqual(720);expect(strip!.x+strip!.width).toBeLessThanOrEqual(960);
  expect(await caption.locator('strong').evaluate(e=>parseFloat(getComputedStyle(e).fontSize))).toBeGreaterThanOrEqual(30);
  expect(await caption.locator('span').evaluate(e=>parseFloat(getComputedStyle(e).fontSize))).toBeGreaterThanOrEqual(28);
  await page.getByRole('button',{name:'Sound & controls',exact:true}).click();await page.getByLabel('Camera-safe corner').selectOption('bottom-left');await page.getByRole('button',{name:'Back to the show',exact:true}).click();
  await expect.poll(async()=>(await caption.boundingBox())!.x).toBeGreaterThanOrEqual(320);
  for(const corner of ['top-right','none']){
    await page.getByRole('button',{name:'Sound & controls',exact:true}).click();await page.getByLabel('Camera-safe corner').selectOption(corner);await page.getByRole('button',{name:'Back to the show',exact:true}).click();
    const box=await caption.boundingBox();expect(box!.y).toBeGreaterThanOrEqual(arena!.y+arena!.height);expect(box!.y+box!.height).toBeLessThanOrEqual(720);
    if(corner==='top-right'){const modules=await page.locator('.module-status').boundingBox();expect(modules!.y).toBeGreaterThan(arena!.y+arena!.height/2);}
  }
  await expect(page.getByRole('button',{name:'Unmute game audio'})).toBeVisible();
});

test('settings retain keyboard focus and usable horizontal layout with doubled text',async({page})=>{
  await page.goto('/rehearse');await page.getByRole('button',{name:'Sound & controls',exact:true}).click();
  await page.evaluate(()=>{document.documentElement.style.fontSize='200%';});
  const dialog=page.getByRole('dialog');await expect(dialog).toBeVisible();
  expect(await dialog.evaluate(e=>e.scrollWidth<=e.clientWidth+1)).toBe(true);
  await page.getByRole('button',{name:'Close settings',exact:true}).focus();
  for(let i=0;i<18;i++){await page.keyboard.press('Tab');expect(await dialog.evaluate(e=>e.contains(document.activeElement))).toBe(true);}
  await page.keyboard.press('Escape');await expect(dialog).not.toBeVisible();
});
