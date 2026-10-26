import { describe, expect, it } from 'vitest';
import { MECHANICS, validateRecipe } from '@aragoz/contracts';
import type { EncounterEvent, ProfileId } from '@aragoz/contracts';
import { applyHouseEvents, beginHouseAttempt, beginHouseRemix, cancelHouseRemix, chooseHouseProfile, createHouseShow, endHouseShow, houseChoices, houseRecipe, nextHouseAct, noteHouseProgress, parseHouseShow, recoverHouseShow, restartHouseEncounter, restartHouseSelection, skipHouseAct } from './house-show';
import type { HouseShow } from './house-show';

const NOW = '2026-10-27T12:00:00.000Z';
async function ready(show = createHouseShow()): Promise<HouseShow> {
  const left = await chooseHouseProfile(show, houseChoices(show)[0]);
  return chooseHouseProfile(left, houseChoices(left)[0]);
}
function event(show: HouseShow, sequence: number, simTick: number, patch: Partial<EncounterEvent> = {}): EncounterEvent {
  return { schemaVersion: 1, attemptId: show.attempt!.id, recipeHash: houseRecipe(show)!.hash, sequence, simTick, kind: 'flaw-exposed', moduleSlot: 'left', value: null, outcome: null, ...patch };
}
function win(show: HouseShow): HouseShow {
  return applyHouseEvents(show, [event(show, 1, 10), event(show, 2, 20, { kind: 'module-broken' }), event(show, 3, 30, { kind: 'module-broken', moduleSlot: 'right' }), event(show, 4, 40, { kind: 'outcome', moduleSlot: null, outcome: 'won' })], NOW);
}

describe('account-free House show contracts', () => {
  it('offers three honest choices at each step and covers every compatible catalogue pair across three acts', async () => {
    const pairs = new Set<string>();
    let base = createHouseShow();
    for (let act = 1; act <= 3; act++) {
      const first = houseChoices(base);
      expect(first).toHaveLength(3);
      expect(new Set(first.map(profile => MECHANICS[profile].family)).size).toBe(3);
      for (const left of first) {
        const selected = await chooseHouseProfile(base, left), before = JSON.stringify(selected);
        expect(selected.phase).toBe('choose'); expect(selected.selection?.slot).toBe('right');
        const second = houseChoices(selected);
        expect(second).toHaveLength(3); expect(new Set(second).size).toBe(3);
        for (const right of second) {
          expect(MECHANICS[right].family).not.toBe(MECHANICS[left].family);
          const committed = await chooseHouseProfile(selected, right), recipe = houseRecipe(committed)!;
          await expect(validateRecipe(recipe)).resolves.toEqual(recipe);
          expect(committed.phase).toBe('ready'); expect(committed.attempt?.started).toBe(false);
          expect(recipe.modules.map(module => module.profileId)).toEqual([left, right]);
          expect(recipe.bodyId).toBe(act === 1 ? 'teapot' : 'mirror');
          expect(recipe.difficultyPreset).toBe('rehearsal');
          expect(recipe.actId).toBe(`${base.id}.act.${act}`);
          for (const module of recipe.modules) {
            expect(module.credit).toEqual({ source: 'house', authorId: null, displayName: 'House Suggestion', hidden: false });
            expect(module.sourceProposalId).toBeNull();
          }
          expect(JSON.stringify(selected)).toBe(before);
          pairs.add([left, right].sort().join('/'));
        }
      }
      base = skipHouseAct(base, NOW);
    }
    expect(pairs.size).toBe(12);
    expect(base.phase).toBe('showbill'); expect(base.recipes).toEqual([]); expect(base.results).toEqual([]);
  });

  it('rejects profiles outside the current choices and guards phase transitions', async () => {
    const show = createHouseShow();
    const unavailable = (['charge-deliberate', 'charge-snappy'] as ProfileId[]).find(profile => !houseChoices(show).includes(profile))!;
    expect(await chooseHouseProfile(show, unavailable)).toBe(show);
    expect(beginHouseAttempt(show)).toBe(show); expect(nextHouseAct(show)).toBe(show);
    const staged = await ready(show), active = beginHouseAttempt(staged);
    expect(houseChoices(staged)).toEqual([]); expect(await chooseHouseProfile(staged, 'echo-long')).toBe(staged);
    expect(beginHouseAttempt(active)).toBe(active); expect(nextHouseAct(active)).toBe(active);
    expect(beginHouseRemix(active, 'left')).toBe(active);
    expect(active.revision).toBe(staged.revision + 1);
  });

  it('restarts an unfinished selection without committing a recipe or advancing the act', async () => {
    const initial = skipHouseAct(createHouseShow(), NOW);
    expect(restartHouseSelection(initial)).toBe(initial);
    const selected = await chooseHouseProfile(initial, houseChoices(initial)[0]);
    const reset = restartHouseSelection(selected);
    expect(reset).toEqual({ ...initial, revision: selected.revision + 1 });
    expect(restartHouseSelection(reset)).toBe(reset);
    expect(cancelHouseRemix(selected)).toBe(selected);
    const replacement = houseChoices(reset)[1];
    const replacementSelected = await chooseHouseProfile(reset, replacement);
    const staged = await chooseHouseProfile(replacementSelected, houseChoices(replacementSelected)[0]);
    expect(houseRecipe(staged)!.modules[0].profileId).toBe(replacement);
    expect(staged.actIndex).toBe(2); expect(staged.recipes).toHaveLength(1);
    expect(restartHouseSelection(staged)).toBe(staged);
    await expect(parseHouseShow(JSON.stringify(reset))).resolves.toEqual(reset);
    await expect(parseHouseShow(JSON.stringify(staged))).resolves.toEqual(staged);
  });
});

describe('real local attempt ledger', () => {
  it('orders a batch, counts actual exposures/breaks, and finishes once at the outcome event tick', async () => {
    const active = beginHouseAttempt(await ready());
    const opening = event(active, 1, 10), brokenLeft = event(active, 3, 40, { kind: 'module-broken' });
    const finished = applyHouseEvents(active, [event(active, 5, 60, { kind: 'outcome', moduleSlot: null, outcome: 'won' }), event(active, 4, 50, { kind: 'module-broken', moduleSlot: 'right' }), brokenLeft, event(active, 2, 30), opening, opening], NOW);
    expect(finished.phase).toBe('result'); expect(finished.revision).toBe(active.revision + 1);
    expect(finished.results).toEqual([{ attemptId: active.attempt!.id, recipeId: houseRecipe(active)!.id, recipeHash: houseRecipe(active)!.hash, actIndex: 1, outcome: 'won', durationTicks: 60, brokenSlots: ['left', 'right'], exploits: 2, finishedAt: NOW }]);
    expect(applyHouseEvents(finished, [opening, brokenLeft], NOW)).toBe(finished);
    await expect(parseHouseShow(JSON.stringify(finished))).resolves.toEqual(finished);
  });

  it('ignores malformed, stale, duplicate and backwards events without inventing wins', async () => {
    const active = beginHouseAttempt(await ready());
    expect(applyHouseEvents(active, [event(active, 1, 1, { kind: 'outcome', moduleSlot: null, outcome: 'won' })], NOW)).toBe(active);
    const exposed = applyHouseEvents(active, [event(active, 2, 20)]);
    const ignored = [event(active, 1, 10), event(active, 3, 19), event(active, 3, 30, { attemptId: 'other-attempt' }), event(active, 3, 30, { recipeHash: 'a'.repeat(64) }), event(active, 3, 30, { moduleSlot: null }), event(active, 3, 30, { sequence: -1 }), event(active, 3, 30, { outcome: 'won' })];
    expect(applyHouseEvents(exposed, ignored, NOW)).toBe(exposed);
    expect(exposed.attempt?.exploits).toBe(1); expect(exposed.results).toEqual([]);
    const progress = noteHouseProgress(exposed, { attemptId: exposed.attempt!.id, recipeHash: houseRecipe(exposed)!.hash, tick: 100 });
    expect(progress.attempt?.durationTicks).toBe(100);
    expect(noteHouseProgress(progress, { attemptId: 'stale', recipeHash: houseRecipe(progress)!.hash, tick: 101 })).toBe(progress);
    expect(noteHouseProgress(progress, { attemptId: progress.attempt!.id, recipeHash: houseRecipe(progress)!.hash, tick: 99 })).toBe(progress);
    expect(applyHouseEvents(progress, [event(progress, 3, 99)], NOW)).toBe(progress);
    const lost = applyHouseEvents(progress, [event(progress, 3, 120, { kind: 'outcome', moduleSlot: null, outcome: 'lost' })], NOW);
    expect(lost.results[0]).toMatchObject({ outcome: 'lost', durationTicks: 120, exploits: 1, brokenSlots: [] });
  });

  it('records combat restarts as abandonment, Encore preserves the stored recipe and new attempts reject old events', async () => {
    const staged = await ready(), recipe = houseRecipe(staged)!;
    const active = beginHouseAttempt(staged), result = win(active);
    const encore = restartHouseEncounter(result, NOW);
    expect(houseRecipe(encore)).toBe(recipe); expect(encore.recipes).toHaveLength(1);
    expect(encore.attempt!.id).not.toBe(active.attempt!.id); expect(encore.results).toEqual(result.results);
    expect(encore.phase).toBe('ready'); expect(encore.attempt?.durationTicks).toBe(0);
    const running = beginHouseAttempt(encore), progressed = noteHouseProgress(running, { attemptId: running.attempt!.id, recipeHash: recipe.hash, tick: 88 });
    expect(applyHouseEvents(running, [event(active, 5, 100)], NOW)).toBe(running);
    const restarted = restartHouseEncounter(progressed, NOW);
    expect(restarted.results).toHaveLength(2); expect(restarted.results[1]).toMatchObject({ outcome: 'abandoned', durationTicks: 88 });
    expect(houseRecipe(restarted)).toBe(recipe); expect(restarted.attempt?.started).toBe(false);
  });

  it('remixes exactly one socket, keeps its opposite byte-for-byte and preserves every recipe/result', async () => {
    for (const slot of ['left', 'right'] as const) {
      const result = win(beginHouseAttempt(await ready())), original = houseRecipe(result)!;
      const choosing = beginHouseRemix(result, slot), choices = houseChoices(choosing);
      expect(choices).toHaveLength(3); expect(new Set(choices).size).toBe(3);
      const retained = slot === 'left' ? 'right' : 'left';
      for (const profile of choices) {
        expect(profile).not.toBe(original.modules.find(module => module.slotId === slot)!.profileId);
        expect(MECHANICS[profile].family).not.toBe(original.modules.find(module => module.slotId === retained)!.mechanicId);
        const remixed = await chooseHouseProfile(choosing, profile), recipe = houseRecipe(remixed)!;
        expect(recipe.id).not.toBe(original.id); expect(recipe.hash).not.toBe(original.hash); expect(recipe.actId).toBe(original.actId);
        expect(recipe.modules.find(module => module.slotId === retained)).toStrictEqual(original.modules.find(module => module.slotId === retained));
        expect(recipe.modules.find(module => module.slotId === slot)!.profileId).toBe(profile);
        expect(remixed.recipes).toEqual([original, recipe]); expect(remixed.results).toEqual(result.results);
        await expect(parseHouseShow(JSON.stringify(remixed))).resolves.toEqual(remixed);
      }
    }
  });

  it('cancels Remix idempotently and allows changing the selected socket before Encore or another Remix', async () => {
    const result = win(beginHouseAttempt(await ready())), recipe = houseRecipe(result)!;
    expect(cancelHouseRemix(result)).toBe(result);
    for (const slot of ['left', 'right'] as const) {
      const choosing = beginHouseRemix(result, slot), cancelled = cancelHouseRemix(choosing);
      expect(restartHouseSelection(choosing)).toBe(choosing);
      expect(cancelled).toEqual({ ...result, revision: choosing.revision + 1 });
      expect(cancelled.recipes).toBe(result.recipes); expect(cancelled.results).toBe(result.results);
      expect(cancelled.attempt).toBe(result.attempt); expect(houseRecipe(cancelled)).toBe(recipe);
      expect(cancelHouseRemix(cancelled)).toBe(cancelled);
      const other = slot === 'left' ? 'right' : 'left';
      const reselected = beginHouseRemix(cancelled, other);
      expect(reselected.selection?.slot).toBe(other);
      expect(houseChoices(reselected)).toHaveLength(3);
      const remixed = await chooseHouseProfile(reselected, houseChoices(reselected)[0]);
      expect(houseRecipe(remixed)!.modules.find(module => module.slotId === slot)).toStrictEqual(recipe.modules.find(module => module.slotId === slot));
      const encore = restartHouseEncounter(cancelled, NOW);
      expect(encore.phase).toBe('ready'); expect(houseRecipe(encore)).toBe(recipe);
      expect(encore.results).toBe(result.results);
      for (const show of [cancelled, reselected, remixed, encore]) await expect(parseHouseShow(JSON.stringify(show))).resolves.toEqual(show);
    }
  });

  it('retains only the first terminal outcome in a batch and does not duplicate repeated breaks', async () => {
    const active = beginHouseAttempt(await ready());
    const result = applyHouseEvents(active, [
      event(active, 1, 10, { kind: 'module-broken' }),
      event(active, 2, 20, { kind: 'module-broken' }),
      event(active, 3, 30, { kind: 'outcome', moduleSlot: null, outcome: 'lost' }),
      event(active, 4, 40, { kind: 'module-broken', moduleSlot: 'right' }),
      event(active, 5, 50, { kind: 'outcome', moduleSlot: null, outcome: 'won' }),
    ], NOW);
    expect(result.results).toHaveLength(1);
    expect(result.results[0]).toMatchObject({ outcome: 'lost', durationTicks: 30, brokenSlots: ['left'] });
    expect(result.attempt?.lastSequence).toBe(3);
    expect(applyHouseEvents(result, [event(active, 3, 30, { kind: 'outcome', moduleSlot: null, outcome: 'lost' })], NOW)).toBe(result);
    expect(endHouseShow(result, NOW).results).toBe(result.results);
    await expect(parseHouseShow(JSON.stringify(result))).resolves.toEqual(result);
  });
});

describe('finite shows and refresh recovery', () => {
  it('closes after three actual acts and retains Encore/Remix history in the final showbill', async () => {
    let show = createHouseShow();
    for (let act = 1; act <= 3; act++) {
      show = win(beginHouseAttempt(await ready(show)));
      if (act === 1) show = win(beginHouseAttempt(restartHouseEncounter(show, NOW)));
      if (act === 2) {
        show = beginHouseRemix(show, 'right');
        show = await chooseHouseProfile(show, houseChoices(show)[0]);
        show = win(beginHouseAttempt(show));
      }
      show = nextHouseAct(show);
      expect(show.actIndex).toBe(Math.min(act + 1, 3));
      expect(show.phase).toBe(act === 3 ? 'showbill' : 'choose');
    }
    expect(show.recipes).toHaveLength(4); expect(show.results).toHaveLength(5);
    expect(nextHouseAct(show)).toBe(show); expect(skipHouseAct(show)).toBe(show); expect(endHouseShow(show)).toBe(show);
    await expect(parseHouseShow(JSON.stringify(show))).resolves.toEqual(show);
  });

  it('recovers unfinished combat to one abandoned result and the same paused-ready recipe', async () => {
    const active = beginHouseAttempt(await ready());
    const exposed = applyHouseEvents(active, [event(active, 1, 20)]);
    const progress = noteHouseProgress(exposed, { attemptId: exposed.attempt!.id, recipeHash: houseRecipe(exposed)!.hash, tick: 125 });
    const restored = await parseHouseShow(JSON.stringify(progress)), recovered = recoverHouseShow(restored, NOW);
    expect(recovered.phase).toBe('ready'); expect(recovered.attempt?.started).toBe(false); expect(recovered.attempt?.durationTicks).toBe(0);
    expect(recovered.results).toHaveLength(1); expect(recovered.results[0]).toMatchObject({ outcome: 'abandoned', durationTicks: 125, exploits: 1 });
    expect(houseRecipe(recovered)).toBe(houseRecipe(restored));
    expect(recoverHouseShow(recovered, NOW)).toBe(recovered);
    await expect(parseHouseShow(JSON.stringify(recovered))).resolves.toEqual(recovered);
  });

  it('preserves unfinished choices, ready attempts, results, Remix choices and completed showbills on recovery', async () => {
    const choosing = await chooseHouseProfile(createHouseShow(), 'charge-deliberate');
    const staged = await ready(), result = win(beginHouseAttempt(staged)), remix = beginHouseRemix(result, 'left'), final = endHouseShow(result, NOW);
    for (const show of [createHouseShow(), choosing, staged, result, remix, final]) {
      const parsed = await parseHouseShow(JSON.stringify(show));
      expect(parsed).toEqual(show); expect(recoverHouseShow(parsed, NOW)).toBe(parsed);
    }
  });

  it('skips only real committed encounters and closes unfinished ready/combat attempts honestly', async () => {
    const staged = await ready();
    const skipped = skipHouseAct(staged, NOW);
    expect(skipped.phase).toBe('choose'); expect(skipped.actIndex).toBe(2);
    expect(skipped.results[0]).toMatchObject({ outcome: 'skipped', durationTicks: 0, brokenSlots: [] });
    const ended = endHouseShow(staged, NOW);
    expect(ended.phase).toBe('showbill'); expect(ended.results[0]).toMatchObject({ outcome: 'abandoned', durationTicks: 0 });
    const empty = endHouseShow(createHouseShow(), NOW);
    expect(empty.recipes).toEqual([]); expect(empty.results).toEqual([]);
    const combatSkip = skipHouseAct(beginHouseAttempt(staged), NOW);
    expect(combatSkip.results[0].outcome).toBe('skipped');
    for (const show of [skipped, ended, empty, combatSkip]) await expect(parseHouseShow(JSON.stringify(show))).resolves.toEqual(show);
  });

  it('rejects corrupt versions, hashes, identity, viewer credits, duplicate IDs, result relations and impossible phases', async () => {
    const result = win(beginHouseAttempt(await ready()));
    const clone = (): HouseShow => JSON.parse(JSON.stringify(result));
    const cases: unknown[] = [{ ...clone(), schemaVersion: 2 }, { ...clone(), revision: -1 }, { ...clone(), phase: 'ready' }, { ...clone(), selection: {} }, { ...clone(), currentRecipeId: 'missing' }];
    const badHash = clone(); badHash.recipes[0].hash = 'a'.repeat(64); cases.push(badHash);
    const otherRoom = clone(); otherRoom.recipes[0].roomId = 'other'; cases.push(otherRoom);
    const viewer = clone(); viewer.recipes[0].modules[0].credit = { source: 'viewer', authorId: 'fake', displayName: 'Fake viewer', hidden: false }; cases.push(viewer);
    const duplicateRecipe = clone(); duplicateRecipe.recipes.push(duplicateRecipe.recipes[0]); cases.push(duplicateRecipe);
    const duplicateResult = clone(); duplicateResult.results.push(duplicateResult.results[0]); cases.push(duplicateResult);
    const orphan = clone(); orphan.results[0].recipeId = 'missing'; cases.push(orphan);
    const wrongAct = clone(); wrongAct.results[0].actIndex = 2; cases.push(wrongAct);
    const impossibleWin = clone(); impossibleWin.results[0].brokenSlots = []; cases.push(impossibleWin);
    const backwardsProgress = clone(); backwardsProgress.attempt!.durationTicks--; cases.push(backwardsProgress);
    cases.push({ ...clone(), unknown: 'field' });
    for (const value of cases) await expect(parseHouseShow(JSON.stringify(value))).rejects.toThrow();
    await expect(parseHouseShow('{broken')).rejects.toThrow();
  });

  it('rejects saves that discard committed encounters, resume an older recipe or invent an unplayed loss', async () => {
    const staged = await ready();
    const orphaned = { ...staged, phase: 'showbill', currentRecipeId: null, attempt: null };
    await expect(parseHouseShow(JSON.stringify(orphaned))).rejects.toThrow();
    const unplayedLoss = endHouseShow(staged, NOW);
    unplayedLoss.results = unplayedLoss.results.map(result => ({ ...result, outcome: 'lost' }));
    await expect(parseHouseShow(JSON.stringify(unplayedLoss))).rejects.toThrow();
    const original = win(beginHouseAttempt(staged)), choosing = beginHouseRemix(original, 'right');
    const remixed = win(beginHouseAttempt(await chooseHouseProfile(choosing, houseChoices(choosing)[0])));
    const oldCurrent = { ...remixed, currentRecipeId: original.currentRecipeId, attempt: original.attempt };
    await expect(parseHouseShow(JSON.stringify(oldCurrent))).rejects.toThrow();
    const erasedHistory = { ...remixed, results: remixed.results.slice(1) };
    await expect(parseHouseShow(JSON.stringify(erasedHistory))).rejects.toThrow();
  });
});
