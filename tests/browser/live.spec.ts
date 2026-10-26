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
