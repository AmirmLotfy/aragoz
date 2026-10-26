import { EncounterEventSchema, EncounterResultSchema, FAMILY_IDS, MECHANICS, PROFILE_IDS, makeModule, makeRecipe, validateRecipe } from '@aragoz/contracts';
import type { BossRecipe, EncounterEvent, EncounterResult, ProfileId, SlotId } from '@aragoz/contracts';

export interface HouseShow {
  schemaVersion: 1;
  revision: number;
  id: string;
  actIndex: 1 | 2 | 3;
  phase: 'choose' | 'ready' | 'combat' | 'result' | 'showbill';
  selection: { slot: SlotId; profiles: Partial<Record<SlotId, ProfileId>>; remixOf: string | null } | null;
  recipes: BossRecipe[];
  currentRecipeId: string | null;
  attempt: { id: string; started: boolean; lastSequence: number; durationTicks: number; brokenSlots: SlotId[]; exploits: number } | null;
  results: EncounterResult[];
}

const newAttempt = (): NonNullable<HouseShow['attempt']> => ({ id: crypto.randomUUID(), started: false, lastSequence: 0, durationTicks: 0, brokenSlots: [], exploits: 0 });
const changed = (show: HouseShow, patch: Partial<HouseShow>): HouseShow => ({ ...show, ...patch, revision: show.revision + 1 });
const opposite = (slot: SlotId): SlotId => slot === 'left' ? 'right' : 'left';
const actId = (show: HouseShow, act = show.actIndex): string => `${show.id}.act.${act}`;

export function createHouseShow(): HouseShow {
  return { schemaVersion: 1, revision: 0, id: 'house-' + crypto.randomUUID(), actIndex: 1, phase: 'choose', selection: { slot: 'left', profiles: {}, remixOf: null }, recipes: [], currentRecipeId: null, attempt: null, results: [] };
}

export function houseRecipe(show: HouseShow): BossRecipe | null {
  return show.recipes.find(recipe => recipe.id === show.currentRecipeId) ?? null;
}

/** Curated shipped contracts, without synthetic ballots or audience attribution. */
export function houseChoices(show: HouseShow): ProfileId[] {
  const selection = show.selection;
  if (show.phase !== 'choose' || !selection) return [];
  const retained = selection.profiles[opposite(selection.slot)];
  if (!retained) return FAMILY_IDS.map((family, index) => PROFILE_IDS.filter(profile => MECHANICS[profile].family === family)[(show.actIndex - 1 + index) % 2]);
  const current = selection.remixOf ? houseRecipe(show)?.modules.find(module => module.slotId === selection.slot)?.profileId : undefined;
  const compatible = PROFILE_IDS.filter(profile => MECHANICS[profile].family !== MECHANICS[retained].family && profile !== current);
  // Rotate the omitted tuning between acts; a Remix already has exactly three options.
  if (compatible.length === 3) return compatible;
  const offset = (show.actIndex - 1) % compatible.length;
  return [...compatible.slice(offset), ...compatible.slice(0, offset)].slice(0, 3);
}

export async function chooseHouseProfile(show: HouseShow, profile: ProfileId): Promise<HouseShow> {
  if (!show.selection || !houseChoices(show).includes(profile)) return show;
  const selection = show.selection, profiles = { ...selection.profiles, [selection.slot]: profile };
  if (!profiles.left || !profiles.right) return changed(show, { selection: { slot: 'right', profiles, remixOf: null } });
  const previous = selection.remixOf ? houseRecipe(show) : null;
  const modules = (['left', 'right'] as const).map(slot => previous && slot !== selection.slot ? previous.modules.find(module => module.slotId === slot)! : makeModule(profiles[slot]!, slot)) as BossRecipe['modules'];
  const recipe = await makeRecipe({ roomId: show.id, actId: actId(show), seed: 2901 + show.actIndex * 17 + show.recipes.length, bodyId: show.actIndex === 1 ? 'teapot' : 'mirror', difficultyPreset: 'rehearsal', modules });
  return changed(show, { phase: 'ready', selection: null, recipes: [...show.recipes, recipe], currentRecipeId: recipe.id, attempt: newAttempt() });
}

export function beginHouseAttempt(show: HouseShow): HouseShow {
  return show.phase === 'ready' && show.attempt && houseRecipe(show) ? changed(show, { phase: 'combat', attempt: { ...show.attempt, started: true } }) : show;
}

function finish(show: HouseShow, outcome: EncounterResult['outcome'], now?: string): HouseShow {
  const recipe = houseRecipe(show), attempt = show.attempt;
  if (!recipe || !attempt || show.results.some(result => result.attemptId === attempt.id)) return show;
  const result = EncounterResultSchema.parse({ attemptId: attempt.id, recipeId: recipe.id, recipeHash: recipe.hash, actIndex: show.actIndex, outcome, durationTicks: attempt.durationTicks, brokenSlots: [...attempt.brokenSlots], exploits: attempt.exploits, finishedAt: now ?? new Date().toISOString() });
  return { ...show, phase: 'result', results: [...show.results, result] };
}

export function applyHouseEvents(show: HouseShow, events: EncounterEvent[], now?: string): HouseShow {
  if (show.phase !== 'combat' || !show.attempt || !houseRecipe(show)) return show;
  let next = show;
  const batch = events.map(event => EncounterEventSchema.safeParse(event)).filter(parsed => parsed.success).map(parsed => parsed.data!).sort((a, b) => a.sequence - b.sequence);
  for (const event of batch) {
    const attempt = next.attempt!, recipe = houseRecipe(next)!;
    if (next.phase !== 'combat' || event.attemptId !== attempt.id || event.recipeHash !== recipe.hash || event.sequence <= attempt.lastSequence || event.simTick < attempt.durationTicks) continue;
    const moduleEvent = ['module-activated', 'attack-started', 'attack-ended', 'flaw-exposed', 'module-broken'].includes(event.kind);
    if (moduleEvent && !event.moduleSlot || event.kind !== 'outcome' && event.outcome !== null || event.kind === 'outcome' && (!event.outcome || event.moduleSlot !== null)) continue;
    if (event.kind === 'outcome' && event.outcome === 'won' && attempt.brokenSlots.length !== 2) continue;
    next = { ...next, attempt: { ...attempt, lastSequence: event.sequence, durationTicks: event.simTick, exploits: attempt.exploits + Number(event.kind === 'flaw-exposed'), brokenSlots: event.kind === 'module-broken' && !attempt.brokenSlots.includes(event.moduleSlot!) ? [...attempt.brokenSlots, event.moduleSlot!] : attempt.brokenSlots } };
    if (event.kind === 'outcome') next = finish(next, event.outcome!, now);
  }
  return next === show ? show : changed(show, next);
}

export function noteHouseProgress(show: HouseShow, progress: { attemptId: string; recipeHash: string; tick: number }): HouseShow {
  if (show.phase !== 'combat' || !show.attempt || progress.attemptId !== show.attempt.id || progress.recipeHash !== houseRecipe(show)?.hash || !Number.isSafeInteger(progress.tick) || progress.tick <= show.attempt.durationTicks) return show;
  return changed(show, { attempt: { ...show.attempt, durationTicks: progress.tick } });
}

export function restartHouseEncounter(show: HouseShow, now?: string): HouseShow {
  if (!['ready', 'combat', 'result'].includes(show.phase) || !houseRecipe(show)) return show;
  const next = show.phase === 'combat' ? finish(show, 'abandoned', now) : show;
  return changed(show, { ...next, phase: 'ready', selection: null, attempt: newAttempt() });
}

function advance(show: HouseShow): HouseShow {
  return show.actIndex === 3 ? { ...show, phase: 'showbill', selection: null } : { ...show, actIndex: (show.actIndex + 1) as 2 | 3, phase: 'choose', selection: { slot: 'left', profiles: {}, remixOf: null }, currentRecipeId: null, attempt: null };
}

export function nextHouseAct(show: HouseShow): HouseShow {
  return show.phase === 'result' ? changed(show, advance(show)) : show;
}

export function beginHouseRemix(show: HouseShow, slot: SlotId): HouseShow {
  const recipe = houseRecipe(show);
  if (show.phase !== 'result' || !recipe || !['left', 'right'].includes(slot)) return show;
  const retained = opposite(slot);
  return changed(show, { phase: 'choose', selection: { slot, profiles: { [retained]: recipe.modules.find(module => module.slotId === retained)!.profileId }, remixOf: recipe.id } });
}

export function cancelHouseRemix(show: HouseShow): HouseShow {
  return show.phase === 'choose' && show.selection?.remixOf
    ? changed(show, { phase: 'result', selection: null }) : show;
}

export function restartHouseSelection(show: HouseShow): HouseShow {
  return show.phase === 'choose' && show.selection?.slot === 'right' && !show.selection.remixOf
    ? changed(show, { selection: { slot: 'left', profiles: {}, remixOf: null } }) : show;
}

export function endHouseShow(show: HouseShow, now?: string): HouseShow {
  if (show.phase === 'showbill') return show;
  const next = show.phase === 'combat' || show.phase === 'ready' ? finish(show, 'abandoned', now) : show;
  return changed(show, { ...next, phase: 'showbill', selection: null });
}

export function skipHouseAct(show: HouseShow, now?: string): HouseShow {
  if (show.phase === 'showbill') return show;
  const next = show.phase === 'combat' || show.phase === 'ready' ? finish(show, 'skipped', now) : show;
  return changed(show, advance(next));
}

export function recoverHouseShow(show: HouseShow, now?: string): HouseShow {
  return show.phase === 'combat' ? restartHouseEncounter(show, now) : show;
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid House show record');
  return value as Record<string, unknown>;
}
function assert(condition: unknown): asserts condition { if (!condition) throw new Error('Invalid saved House show'); }
function keys(value: Record<string, unknown>, allowed: string[]): void { assert(Object.keys(value).every(key => allowed.includes(key))); }
function count(value: unknown): boolean { return Number.isSafeInteger(value) && Number(value) >= 0; }
function slots(value: unknown): value is SlotId[] { return Array.isArray(value) && value.every(slot => slot === 'left' || slot === 'right') && new Set(value).size === value.length; }

/** Browser saves contain only House recipes and local results, never live identity. */
export async function parseHouseShow(raw: string): Promise<HouseShow> {
  const data = object(JSON.parse(raw));
  keys(data, ['schemaVersion', 'revision', 'id', 'actIndex', 'phase', 'selection', 'recipes', 'currentRecipeId', 'attempt', 'results']);
  assert(data.schemaVersion === 1 && count(data.revision) && typeof data.id === 'string' && /^house-[a-zA-Z0-9-]+$/.test(data.id));
  assert([1, 2, 3].includes(Number(data.actIndex)) && typeof data.actIndex === 'number' && ['choose', 'ready', 'combat', 'result', 'showbill'].includes(String(data.phase)));
  assert(Array.isArray(data.recipes) && Array.isArray(data.results));
  const recipes = await Promise.all(data.recipes.map(recipe => validateRecipe(recipe)));
  assert(new Set(recipes.map(recipe => recipe.id)).size === recipes.length);
  for (const recipe of recipes) {
    const index = [1, 2, 3].find(act => recipe.actId === `${data.id}.act.${act}`);
    assert(index && index <= Number(data.actIndex) && recipe.roomId === data.id && recipe.bodyId === (index === 1 ? 'teapot' : 'mirror') && recipe.difficultyPreset === 'rehearsal');
    assert(recipe.modules.every(module => module.credit.source === 'house' && module.credit.authorId === null && module.sourceProposalId === null && module.credit.displayName === 'House Suggestion' && !module.credit.hidden));
  }
  const results = data.results.map(result => EncounterResultSchema.parse(result));
  assert(new Set(results.map(result => result.attemptId)).size === results.length);
  for (const result of results) {
    const recipe = recipes.find(candidate => candidate.id === result.recipeId && candidate.hash === result.recipeHash);
    assert(recipe && recipe.actId === `${data.id}.act.${result.actIndex}` && slots(result.brokenSlots));
    assert(result.outcome !== 'won' || result.brokenSlots.length === 2);
  }
  assert(data.currentRecipeId === null || typeof data.currentRecipeId === 'string');
  const current = recipes.find(recipe => recipe.id === data.currentRecipeId);
  assert(data.currentRecipeId === null || current && current.actId === `${data.id}.act.${data.actIndex}`);
  assert(!current || current === recipes.at(-1));
  // Moving to another recipe/act always closes the previous committed attempt.
  // A save must not silently discard encounters from the final showbill.
  assert(recipes.every(recipe => recipe === current || results.some(result => result.recipeId === recipe.id)));
  if (data.attempt !== null) {
    const attempt = object(data.attempt);
    keys(attempt, ['id', 'started', 'lastSequence', 'durationTicks', 'brokenSlots', 'exploits']);
    assert(current && typeof attempt.id === 'string' && attempt.id.length > 0 && typeof attempt.started === 'boolean' && count(attempt.lastSequence) && count(attempt.durationTicks) && slots(attempt.brokenSlots) && count(attempt.exploits));
    if (!attempt.started) assert(attempt.lastSequence === 0 && attempt.durationTicks === 0 && attempt.brokenSlots.length === 0 && attempt.exploits === 0);
    const result = results.find(result => result.attemptId === attempt.id);
    if (result) assert(result.recipeId === current.id && result.recipeHash === current.hash && result.durationTicks === attempt.durationTicks && result.exploits === attempt.exploits && JSON.stringify(result.brokenSlots) === JSON.stringify(attempt.brokenSlots));
    if (result && !attempt.started) assert(result.outcome === 'skipped' || result.outcome === 'abandoned');
    if (data.phase === 'ready' || data.phase === 'combat') assert(!result);
    if (data.phase === 'ready') assert(!attempt.started);
    if (data.phase === 'combat') assert(attempt.started);
    if (data.phase === 'result' || data.phase === 'showbill' || data.phase === 'choose') assert(result);
  } else assert(data.currentRecipeId === null);
  if (data.phase === 'choose') {
    const selection = object(data.selection), profiles = object(selection.profiles);
    keys(selection, ['slot', 'profiles', 'remixOf']); keys(profiles, ['left', 'right']);
    assert(selection.slot === 'left' || selection.slot === 'right');
    assert(Object.values(profiles).every(profile => PROFILE_IDS.includes(profile as ProfileId)) && profiles[selection.slot] === undefined);
    if (selection.remixOf === null) {
      assert(data.currentRecipeId === null && data.attempt === null);
      assert(selection.slot === 'left' ? Object.keys(profiles).length === 0 : Object.keys(profiles).length === 1 && typeof profiles.left === 'string');
    } else {
      assert(current && selection.remixOf === current.id && data.attempt !== null);
      const retained = opposite(selection.slot);
      assert(Object.keys(profiles).length === 1 && profiles[retained] === current.modules.find(module => module.slotId === retained)!.profileId);
    }
  } else assert(data.selection === null);
  if (['ready', 'combat', 'result'].includes(String(data.phase))) assert(current && data.attempt !== null);
  return { ...data, recipes, results } as unknown as HouseShow;
}
