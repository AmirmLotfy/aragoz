import { expect, test } from '@playwright/test';
import type { BrowserContext, Page } from '@playwright/test';
import { createLiveHarness, LIVE_FIXTURE_LABEL } from '../support/live-harness.ts';
import type { LiveHarness } from '../support/live-harness.ts';

let harness: LiveHarness;

test.beforeEach(async ({ context }) => {
  test.info().annotations.push({ type: 'evidence', description: LIVE_FIXTURE_LABEL });
  harness = await createLiveHarness();
  await context.addCookies([harness.sessionCookie]);
});
test.afterEach(async ({ context }) => {
  // Close actual browser transports before stopping this test-owned ephemeral server.
  for (const page of context.pages()) await page.close();
  if (harness) {
    const requests = harness.providerRequests();
    await harness.close();
    expect(requests, 'Fixture gameplay must never contact Twitch/OpenAI').toBe(0);
  }
});

async function openWindows(context: BrowserContext) {
  const play = await context.newPage(), backstage = await context.newPage();
  let snapshots = 0;
  for (const page of [play, backstage]) page.on('websocket', socket => {
    if (!socket.url().includes(`/api/rooms/${harness.roomId}/ws`)) return;
    socket.on('framereceived', event => { try { if (JSON.parse(String(event.payload)).type === 'snapshot') snapshots++; } catch { /* Other wire data is not a snapshot. */ } });
  });
  await play.goto(`${harness.origin}/play/${harness.roomId}`);
  await backstage.goto(`${harness.origin}/backstage/${harness.roomId}`);
  await expect(play.getByText('FIXTURE Mock Broadcaster’S THEATRE · INVITED PILOT', { exact: true })).toBeVisible();
  await expect(backstage.getByRole('heading', { name: 'FIXTURE Mock Broadcaster’s backstage' })).toBeVisible();
  await expect(backstage.getByText('Room connected', { exact: true })).toBeVisible();
  await expect(backstage.locator('canvas')).toHaveCount(0);
  await expect.poll(() => snapshots, { message: 'Both real room WebSockets deliver snapshots' }).toBeGreaterThanOrEqual(2);
  return { play, backstage };
}

interface BallotFixture { authorId: string; displayName: string; raw: string; }
async function audienceBallot(play: Page, backstage: Page, fixture: BallotFixture) {
  await backstage.getByRole('button', { name: 'Open proposals', exact: true }).click();
  await expect.poll(() => harness.state().phase).toBe('proposal-delay');
  await harness.advance(1);
  await expect(play.getByRole('heading', { name: 'Give this villain a power… BUT give it a flaw.' })).toBeVisible();
  const round = harness.state().roundCode!;
  if(harness.state().selectedModules.some(module=>module.mechanicId==='charge'))await expect(play.locator('.chat-command code')).not.toContainText('charges');
  await harness.chat({ authorId: fixture.authorId, displayName: fixture.displayName, text: `!make ${round} ${fixture.raw}` });
  await expect(backstage.locator('.proposal-queue').getByText(fixture.raw, { exact: true })).toBeVisible();
  await expect(backstage.locator('.proposal-queue').getByText(fixture.displayName, { exact: true })).toBeVisible();
  await expect(play.getByText(fixture.raw, { exact: true })).toHaveCount(0);
  await expect(play.getByText(fixture.displayName, { exact: true })).toHaveCount(0);
  await backstage.getByRole('button', { name: 'Close submissions & prepare choices', exact: true }).click();
  await expect(backstage.getByRole('heading', { name: 'Three stage-ready contracts' })).toBeVisible();
  await expect(backstage.getByText(/Catalogue fallback matched audience proposals/)).toBeVisible();
  await expect(backstage.getByRole('button', { name: 'Open audience vote', exact: true })).toBeDisabled();
  await expect(play.getByText(fixture.displayName, { exact: true })).toHaveCount(0);
  const candidates = harness.state().candidates;
  const index = candidates.findIndex(candidate => candidate.credit.authorId === fixture.authorId);
  expect(index, 'The fixed catalogue retains this genuine fixture proposal lineage').toBeGreaterThanOrEqual(0);
  const chosen = candidates[index]!;
  expect(chosen.approved).toBe(false); expect(chosen.adaptation).toBe(null);
  await backstage.getByRole('button', { name: 'Approve these three contracts', exact: true }).click();
  await expect(backstage.getByRole('button', { name: 'All three approved', exact: true })).toBeVisible();
  await backstage.getByRole('button', { name: 'Open audience vote', exact: true }).click();
  await expect.poll(() => harness.state().phase).toBe('vote-delay');
  await harness.advance(1);
  await expect(play.getByRole('heading', { name: 'Which boast belongs onstage?' })).toBeVisible();
  await expect(play.locator('.placard-credit').filter({ hasText: fixture.displayName })).toBeVisible();
  await expect(play.getByText(fixture.raw, { exact: true })).toHaveCount(0);
  await harness.chat({ authorId: 'fixture-voter', displayName: 'FIXTURE Mock Voter', text: `!vote ${round} ${'ABC'[index]}` });
  await expect(play.locator('.placard').filter({ hasText: fixture.displayName }).getByText('1 vote', { exact: true })).toBeVisible();
  await backstage.getByRole('button', { name: 'Close vote & commit', exact: true }).click();
  await expect.poll(() => harness.state().selectedModules.some(module => module.sourceProposalId === chosen.sourceProposalId && module.credit.authorId === fixture.authorId)).toBe(true);
  return { round, chosen };
}

test('[FIXTURE] real live UI commits both audience contracts, hides private raw text and safely takes over after reload', async ({ context }) => {
  const { play, backstage } = await openWindows(context);
  const first = { authorId: 'fixture-charge-author', displayName: 'FIXTURE Charge Author', raw: 'charges at you BUT cannot turn once it starts' };
  const second = { authorId: 'fixture-steam-author', displayName: 'FIXTURE Steam Author', raw: 'steam burst BUT overheats after three bursts' };
  const left = await audienceBallot(play, backstage, first);
  await expect(play.locator('.selected-contracts').getByText(first.displayName, { exact: true })).toBeVisible();
  await backstage.getByLabel('Hide author display names').check();
  await expect(play.locator('.selected-contracts').getByText('Audience author', { exact: true })).toBeVisible();
  await expect(play.getByText(first.displayName, { exact: true })).toHaveCount(0);
  await backstage.getByLabel('Hide author display names').uncheck();
  await expect(play.locator('.selected-contracts').getByText(first.displayName, { exact: true })).toBeVisible();
  await play.evaluate(()=>{
    const observed=window as Window & {assemblyFrames?:Array<{progress:number;tick:number;paused:string|null}>};observed.assemblyFrames=[];
    const observer=new MutationObserver(records=>{for(const record of records){const canvas=record.target as HTMLElement;
      if(canvas.getAttribute('data-testid')!=='game-canvas'||!canvas.hasAttribute('data-assembly-progress'))continue;
      observed.assemblyFrames!.push({progress:Number(canvas.getAttribute('data-assembly-progress')),tick:Number(canvas.getAttribute('data-sim-tick')??0),paused:canvas.getAttribute('data-paused')});
      if(canvas.getAttribute('data-presentation-ready')==='true')observer.disconnect();
    }});
    observer.observe(document.body,{subtree:true,attributes:true,attributeFilter:['data-assembly-progress','data-presentation-ready']});
  });
  const right = await audienceBallot(play, backstage, second);
  expect(right.round).not.toBe(left.round);
  const committed = harness.state();
  expect(committed.phase).toBe('assembling');
  expect(committed.recipe!.modules.map(module => module.mechanicId)).toEqual(['charge', 'steam']);
  expect(committed.recipe!.modules.map(module => module.credit.authorId)).toEqual([first.authorId, second.authorId]);
  await expect(play.getByText('THE BOAST BECOMES A BODY.', { exact: true })).toBeVisible();
  await harness.advance(701);
  await expect(play.getByRole('button', { name: 'Take the stage', exact: true })).toBeEnabled();
  await expect(play.getByTestId('game-canvas')).toBeVisible();
  await expect(play.getByTestId('game-canvas')).toHaveAttribute('data-presentation-ready','true');
  const assemblyFrames=await play.evaluate(()=>(window as Window & {assemblyFrames?:Array<{progress:number;tick:number;paused:string|null}>}).assemblyFrames??[]);
  expect(assemblyFrames.some(frame=>frame.progress>0&&frame.progress<1),'The actual stage renders intermediate attachment positions').toBe(true);
  expect(assemblyFrames.every(frame=>frame.tick===0),'Assembly never advances combat').toBe(true);
  await expect(play.getByTestId('game-canvas')).toHaveAttribute('data-assembly-progress','1');
  await expect(play.locator('.instruction-card').getByText(first.displayName, { exact: true })).toBeVisible();
  await expect(play.locator('.instruction-card').getByText(second.displayName, { exact: true })).toBeVisible();
  await expect(play.getByText(first.raw, { exact: true })).toHaveCount(0);
  await expect(play.getByText(second.raw, { exact: true })).toHaveCount(0);
  await play.bringToFront();
  await play.getByRole('button', { name: 'Take the stage', exact: true }).click();
  await expect.poll(() => harness.state().phase).toBe('combat');
  await expect.poll(async () => Number(await play.getByTestId('game-canvas').getAttribute('data-sim-tick'))).toBeGreaterThan(0);
  const prior = harness.state(), oldAttempt = prior.attempt!.id, recipeHash = prior.recipe!.hash;
  await play.reload();
  await expect(play.getByRole('heading', { name: 'Start a fresh attempt.' })).toBeVisible();
  expect(harness.state().attempt!.id).toBe(oldAttempt);
  await expect(play.getByRole('button', { name: 'Take control & restart safely', exact: true })).toBeEnabled();
  await play.getByRole('button', { name: 'Take control & restart safely', exact: true }).click();
  await expect.poll(() => harness.state().attempt!.id).not.toBe(oldAttempt);
  await expect.poll(() => harness.state().phase).toBe('combat');
  expect(harness.state().recipe!.hash).toBe(recipeHash);
  expect(harness.state().results.find(result => result.attemptId === oldAttempt)?.outcome).toBe('abandoned');
  await expect.poll(async()=>play.getByTestId('game-canvas').evaluate(canvas=>({attempt:canvas.getAttribute('data-attempt-id'),ready:canvas.getAttribute('data-presentation-ready')})),{timeout:12000,message:'The replacement attempt finishes its eight-second asset budget and assembly before combat'}).toEqual({attempt:harness.state().attempt!.id,ready:'true'});
  await expect.poll(async () => Number(await play.getByTestId('game-canvas').getAttribute('data-sim-tick'))).toBeGreaterThan(0);
});

test('[FIXTURE] interrupted mock input discards the ballot and old round commands cannot enter its restarted private queue', async ({ context }) => {
  const { play, backstage } = await openWindows(context);
  await backstage.getByRole('button', { name: 'Open proposals', exact: true }).click();
  await expect.poll(() => harness.state().phase).toBe('proposal-delay');
  await harness.advance(1);
  const oldRound = harness.state().roundCode!;
  const oldRaw = 'charge BUT cannot turn';
  await harness.chat({ authorId: 'fixture-old-author', displayName: 'FIXTURE Old Author', text: `!make ${oldRound} ${oldRaw}` });
  await expect(backstage.locator('.proposal-queue').getByText(oldRaw, { exact: true })).toBeVisible();
  await harness.connection(false);
  await expect(play.getByText('FIXTURE mock input disconnected. Restart this discarded ballot.', { exact: true })).toBeVisible();
  await expect(play.getByRole('button', { name: 'Restart with a fresh code', exact: true })).toBeDisabled();
  expect(harness.state().phase).toBe('interrupted'); expect(harness.state().roundCode).toBe(null);
  expect(harness.state().candidates).toEqual([]); expect(harness.state().votes).toEqual([0, 0, 0]);
  await harness.connection(true);
  await play.getByRole('button', { name: 'Restart with a fresh code', exact: true }).click();
  await expect(play.getByRole('button', { name: 'Open audience proposals', exact: true })).toBeEnabled();
  await play.getByRole('button', { name: 'Open audience proposals', exact: true }).click();
  await expect.poll(() => harness.state().phase).toBe('proposal-delay');
  await harness.advance(1);
  expect(harness.state().roundCode).not.toBe(oldRound);
  await harness.chat({ authorId: 'fixture-stale-author', displayName: 'FIXTURE Stale Author', text: `!make ${oldRound} steam BUT overheats` });
  await expect(backstage.locator('.proposal-queue').getByText('No viewer proposals in this window yet. House Suggestions are always available.', { exact: true })).toBeVisible();
  const freshRaw = 'echo BUT blocked';
  await harness.chat({ authorId: 'fixture-fresh-author', displayName: 'FIXTURE Fresh Author', text: `!make ${harness.state().roundCode} ${freshRaw}` });
  await expect(backstage.locator('.proposal-queue').getByText(freshRaw, { exact: true })).toBeVisible();
  await expect(backstage.getByText('FIXTURE Stale Author', { exact: true })).toHaveCount(0);
  await expect(play.getByText(freshRaw, { exact: true })).toHaveCount(0);
});

test('[FIXTURE] Pause waits for an in-flight encounter upload and resumes the same ledger', async ({ context }) => {
  await context.addInitScript(() => localStorage.setItem('aragoz.preferences.v1', JSON.stringify({ muted: true, quality: 'low', presentationFps: 30, reducedMotion: true })));
  const play = await context.newPage();
  await play.goto(`${harness.origin}/play/${harness.roomId}`);
  await expect(play.getByRole('button', { name: 'Unmute game audio', exact: true })).toHaveAttribute('aria-pressed', 'true');
  // House contracts keep this regression focused on real browser transport ordering.
  for (let slot = 0; slot < 2; slot++) {
    await play.getByRole('button', { name: 'Use labelled House Suggestions', exact: true }).click();
    const session = await context.request.get(`${harness.origin}/api/session`);
    const { csrfToken } = await session.json();
    const response = await context.request.post(`${harness.origin}/api/shows/${harness.roomId}/actions`, {
      headers: { origin: harness.origin, 'x-csrf-token': csrfToken },
      data: { expectedRevision: harness.state().revision, action: { type: 'close-vote' } },
    });
    expect(response.status(), await response.text()).toBe(200);
    await expect.poll(() => harness.state().selectedModules.length).toBe(slot + 1);
  }
  await harness.advance(701);
  await expect(play.getByRole('button', { name: 'Take the stage', exact: true })).toBeEnabled();
  const canvas = play.getByTestId('game-canvas');
  let releaseUpload!: () => void, captureUpload!: () => void, holdFirst = true;
  const held = new Promise<void>(resolve => { releaseUpload = resolve; });
  const captured = new Promise<void>(resolve => { captureUpload = resolve; });
  const pauseRequests: number[] = [], uploadStatuses: number[] = [];
  play.on('request', request => {
    if (request.url().endsWith(`/api/shows/${harness.roomId}/actions`) && request.postDataJSON()?.action?.type === 'pause') {
      pauseRequests.push(request.postDataJSON().expectedRevision);
    }
  });
  play.on('response', response => {
    if (response.url().endsWith(`/api/shows/${harness.roomId}/events`)) uploadStatuses.push(response.status());
  });
  await play.route(`**/api/shows/${harness.roomId}/events`, async route => {
    if (holdFirst) { holdFirst = false; captureUpload(); await held; }
    await route.continue();
  });
  try {
    await play.getByRole('button', { name: 'Take the stage', exact: true }).click();
    await captured;
    const attempt = harness.state().attempt!.id, revision = harness.state().revision;
    await play.getByRole('button', { name: 'Pause', exact: true }).click();
    await expect(canvas).toHaveAttribute('data-paused', 'true');
    const tick = await canvas.getAttribute('data-sim-tick');
    await play.waitForTimeout(800);
    expect(await canvas.getAttribute('data-sim-tick')).toBe(tick);
    expect(pauseRequests).toEqual([]);
    expect(harness.state().phase).toBe('combat');
    releaseUpload();
    await expect.poll(() => harness.state().phase).toBe('paused');
    await expect(play.getByRole('heading', { name: 'The fight is paused.', exact: true })).toBeVisible();
    expect(pauseRequests).toEqual([revision + 1]);
    expect(uploadStatuses).toEqual([200]);
    const acknowledged = harness.state().attempt!.lastSequence;
    expect(acknowledged).toBeGreaterThan(0);
    await play.getByRole('button', { name: 'Back onstage', exact: true }).click();
    await expect(canvas).toHaveAttribute('data-paused', 'false');
    await expect.poll(() => harness.state().attempt!.lastSequence).toBeGreaterThan(acknowledged);
    expect(harness.state().attempt!.id).toBe(attempt);
    expect(uploadStatuses.every(status => status === 200)).toBe(true);
    await expect(play.getByRole('alert')).toHaveCount(0);
    await expect(play.getByText('Show changed. Reload before uploading events', { exact: true })).toHaveCount(0);
  } finally { releaseUpload(); }
});
