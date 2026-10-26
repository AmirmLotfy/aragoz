import { describe, expect, it } from 'vitest';
import { ARENA, EncounterEventSchema, makeModule, makeRecipe, moduleWorldPosition } from '@aragoz/contracts';
import type { BossRecipe, EncounterEvent, ProfileId, SlotId, Vec2 } from '@aragoz/contracts';
import { CombatSimulation, COMBAT_TUNING } from './index.ts';
import type { CombatSnapshot, PlayerInput } from './index.ts';

const REST: PlayerInput = { moveX: 0, moveZ: 0, aimX: 0, aimZ: -1, strike: false, dodge: false };
const distance = (a: Vec2, b: Vec2): number => Math.hypot(a.x - b.x, a.z - b.z);
const direction = (from: Vec2, to: Vec2): Vec2 => {
  const size = distance(from, to);
  return size ? { x: (to.x - from.x) / size, z: (to.z - from.z) / size } : { x: 0, z: -1 };
};

async function recipe(left: ProfileId = 'charge-deliberate', right: ProfileId = 'steam-narrow',
  bodyId: 'teapot' | 'mirror' = 'teapot', seed = 0): Promise<BossRecipe> {
  return makeRecipe({ roomId: 'combat-test', actId: 'act-1', id: 'test-recipe', seed, bodyId,
    now: '2026-10-25T12:00:00.000Z', modules: [makeModule(left, 'left'), makeModule(right, 'right')] });
}

function advance(sim: CombatSimulation, ticks: number, input: PlayerInput = REST): void {
  for (let i = 0; i < ticks; i++) sim.step(input);
}
function until(sim: CombatSimulation, predicate: (snapshot: CombatSnapshot) => boolean,
  maximum = 900, input: PlayerInput = REST): CombatSnapshot {
  for (let i = 0; i <= maximum; i++) {
    const snapshot = sim.snapshot();
    if (predicate(snapshot)) return snapshot;
    if (snapshot.outcome !== null) throw new Error(`Encounter ended (${snapshot.outcome}) before the expected state`);
    sim.step(input);
  }
  throw new Error(`Expected state not reached after ${maximum} fixed steps: ${JSON.stringify(sim.snapshot())}`);
}
function moveTo(sim: CombatSimulation, target: Vec2, maximum = 180): void {
  for (let i = 0; i < maximum; i++) {
    const snapshot = sim.snapshot();
    if (distance(snapshot.hero.position, target) < 0.1) return;
    const move = direction(snapshot.hero.position, target);
    const aim = direction(snapshot.hero.position, snapshot.boss.position);
    sim.step({ ...REST, moveX: move.x, moveZ: move.z, aimX: aim.x, aimZ: aim.z });
  }
  throw new Error(`Could not reach waypoint ${JSON.stringify(target)}`);
}
function approachAndStrike(sim: CombatSimulation, slot: SlotId, maximum = 150): void {
  for (let i = 0; i < maximum; i++) {
    const snapshot = sim.snapshot();
    if (snapshot.modules.find(module => module.slotId === slot)?.broken) return;
    const socket = moduleWorldPosition(snapshot.boss.position, snapshot.boss.facing, slot);
    const aim = direction(snapshot.hero.position, socket);
    const moving = distance(snapshot.hero.position, socket) > 1.45;
    sim.step({ ...REST, moveX: moving ? aim.x : 0, moveZ: moving ? aim.z : 0, aimX: aim.x, aimZ: aim.z, strike: true });
  }
  throw new Error(`Could not break ${slot} through its counter window`);
}
function assertLegalCircle(position: Vec2, radius: number): void {
  expect(Math.abs(position.x)).toBeLessThanOrEqual(ARENA.halfWidth - radius + 1e-6);
  expect(Math.abs(position.z)).toBeLessThanOrEqual(ARENA.halfDepth - radius + 1e-6);
  for (const block of ARENA.blocks) {
    const closest = { x: Math.max(block.x - block.halfWidth, Math.min(block.x + block.halfWidth, position.x)),
      z: Math.max(block.z - block.halfDepth, Math.min(block.z + block.halfDepth, position.z)) };
    expect(distance(position, closest)).toBeGreaterThanOrEqual(radius - 1e-6);
  }
}
function baitCharge(sim: CombatSimulation): void {
  // This real route puts a block between the boss and the hero, without crossing it.
  moveTo(sim, { x: -5.3, z: 1 });
  until(sim, state => state.boss.stage === 'exposed' && state.boss.activeSlot === 'left', 240);
}
function breakCharge(sim: CombatSimulation): void {
  baitCharge(sim);
  moveTo(sim, { x: -1.3, z: 1.3 });
  approachAndStrike(sim, 'left');
}

describe('fixed combat contract', () => {
  it('validates shipped modules and isolates recipe, snapshots and drained event objects', async () => {
    const accepted = await recipe();
    const invalid = structuredClone(accepted);
    invalid.modules[0].approvedParameters.speed = 500;
    expect(() => new CombatSimulation(invalid)).toThrow();
    const sim = new CombatSimulation(accepted, 'immutable-attempt');
    accepted.modules[0].mechanicId = 'echo';
    accepted.modules[0].approvedParameters.speed = 1000;
    const view = sim.snapshot();
    view.hero.position.x = 999;
    view.boss.facing.x = 999;
    view.modules[0].broken = true;
    expect(sim.snapshot().hero.position).toEqual(ARENA.heroSpawn);
    expect(sim.snapshot().modules[0]).toMatchObject({ mechanicId: 'charge', broken: false });
    until(sim, state => state.boss.stage === 'windup');
    const tell = sim.snapshot().boss.telegraph!;
    tell.points[0].x = 999;
    expect(sim.snapshot().boss.telegraph!.points[0].x).not.toBe(999);
    const events = sim.drainEvents();
    events[0].kind = 'outcome';
    expect(sim.drainEvents()).toEqual([]);
  });

  it('advances only fixed unpaused steps and is deterministic for the accepted seed', async () => {
    const accepted = await recipe('charge-snappy', 'echo-long');
    const a = new CombatSimulation(accepted, 'deterministic'), b = new CombatSimulation(accepted, 'deterministic');
    a.setPaused(true);
    advance(a, 180, { ...REST, moveX: 1, dodge: true });
    expect(a.snapshot()).toMatchObject({ tick: 0, elapsed: 0, paused: true });
    expect(a.drainEvents()).toEqual([]);
    a.setPaused(false);
    for (let i = 0; i < 1200; i++) {
      const input = { ...REST, moveX: Math.sin(i / 37), moveZ: Math.cos(i / 43),
        aimX: -Math.sin(i / 37), strike: i % 3 === 0, dodge: i % 80 === 0 };
      a.step(input); b.step(input);
    }
    expect(a.snapshot()).toEqual(b.snapshot());
    const events = a.drainEvents();
    expect(events).toEqual(b.drainEvents());
    events.forEach((event, index) => {
      expect(EncounterEventSchema.safeParse(event).success).toBe(true);
      expect(event.sequence).toBe(index + 1);
      expect(event.attemptId).toBe('deterministic');
      expect(event.recipeHash).toBe(accepted.hash);
      if (index) expect(event.simTick).toBeGreaterThanOrEqual(events[index - 1].simTick);
    });
    expect(a.snapshot().elapsed).toBeCloseTo(a.snapshot().tick / 60, 12);
    const other = new CombatSimulation(await recipe('charge-snappy', 'echo-long', 'teapot', 1));
    until(other, state => state.boss.activeSlot !== null);
    expect(other.snapshot().boss.activeSlot).not.toBe(events.find(event => event.kind === 'module-activated')!.moduleSlot);
  });

  it('normalizes diagonal movement, rejects non-finite axes and bounds dodges without repeat-on-hold', async () => {
    const accepted = await recipe();
    const cardinal = new CombatSimulation(accepted), diagonal = new CombatSimulation(accepted);
    advance(cardinal, 20, { ...REST, moveX: 1 });
    advance(diagonal, 20, { ...REST, moveX: 1, moveZ: -1 });
    expect(distance(cardinal.snapshot().hero.position, ARENA.heroSpawn)).toBeCloseTo(distance(diagonal.snapshot().hero.position, ARENA.heroSpawn), 8);
    diagonal.step({ ...REST, moveX: Number.NaN, moveZ: Infinity, aimX: Infinity, aimZ: Number.NaN });
    expect(Number.isFinite(diagonal.snapshot().hero.position.x)).toBe(true);
    expect(Math.hypot(diagonal.snapshot().hero.facing.x, diagonal.snapshot().hero.facing.z)).toBeCloseTo(1);
    const dodge = new CombatSimulation(accepted);
    advance(dodge, 60, { ...REST, moveX: 1, dodge: true });
    expect(dodge.snapshot().hero.dodging).toBe(false);
    expect(distance(dodge.snapshot().hero.position, ARENA.heroSpawn)).toBeLessThan(5.5);
    // Traverse the block and arena edges using input rather than replacing transforms.
    for (const target of [{ x: -6.68, z: 3.93 }, { x: -6.68, z: -3.93 }, { x: 6.68, z: -3.93 }, { x: 6.68, z: 3.93 }]) {
      for (let i = 0; i < 180; i++) {
        const state = dodge.snapshot(), move = direction(state.hero.position, target);
        dodge.step({ ...REST, moveX: move.x, moveZ: move.z, dodge: i % 50 === 0 });
        assertLegalCircle(dodge.snapshot().hero.position, ARENA.heroRadius);
        assertLegalCircle(dodge.snapshot().boss.position, ARENA.bossRadius);
      }
    }
  });

  it('emits a stable single outcome and accepts no input after a host interruption', async () => {
    const sim = new CombatSimulation(await recipe(), 'terminal');
    expect(() => sim.finish('won')).toThrow(/modules/);
    advance(sim, 70);
    sim.finish('skipped');
    const terminal = sim.snapshot();
    sim.finish('lost');
    advance(sim, 600, { ...REST, strike: true, dodge: true, moveX: 1 });
    expect(sim.snapshot()).toEqual(terminal);
    const events = sim.drainEvents();
    expect(events.filter(event => event.kind === 'outcome')).toHaveLength(1);
    expect(events.at(-1)).toMatchObject({ kind: 'outcome', outcome: 'skipped', moduleSlot: null });
  });
});

describe('actual power and flaw behavior', () => {
  it('locks the charge lane at commitment and physically moves along it', async () => {
    const sim = new CombatSimulation(await recipe());
    const committed = until(sim, state => state.boss.stage === 'active');
    expect(committed.boss.telegraph?.kind).toBe('lane');
    const facing = committed.boss.facing;
    advance(sim, 20, { ...REST, moveX: 1 });
    expect(sim.snapshot().boss.facing).toEqual(facing);
    expect(sim.snapshot().boss.position.z).toBeGreaterThan(committed.boss.position.z + 2);
    expect(sim.snapshot().boss.position.x).toBeCloseTo(committed.boss.position.x);
  });

  it.each([
    ['teapot', 'charge-deliberate'], ['mirror', 'charge-deliberate'], ['teapot', 'charge-snappy'], ['mirror', 'charge-snappy'],
  ] as const)('lets %s %s bait, reach and break a charge counter with real inputs', async (body, profile) => {
    const sim = new CombatSimulation(await recipe(profile, 'steam-narrow', body));
    baitCharge(sim);
    const exposed = sim.snapshot();
    expect(exposed.modules[0].exposed).toBe(true);
    expect(exposed.boss.position.x).toBeLessThan(-1);
    assertLegalCircle(exposed.boss.position, ARENA.bossRadius);
    const bossAtContact = exposed.boss.position;
    advance(sim, 5);
    expect(sim.snapshot().boss.position).toEqual(bossAtContact);
    moveTo(sim, { x: -1.3, z: 1.3 });
    approachAndStrike(sim, 'left');
    expect(sim.snapshot().modules[0]).toMatchObject({ broken: true, breakMeter: 100, exposed: false });
    const events = sim.drainEvents();
    expect(events.filter(event => event.kind === 'flaw-exposed' && event.moduleSlot === 'left')).toHaveLength(1);
    expect(events.filter(event => event.kind === 'module-broken' && event.moduleSlot === 'left')).toHaveLength(1);
  });

  it.each(['steam-narrow', 'steam-wide'] as const)('%s uses its real bursts, bounded damage immunity and a protected overheat counter', async profile => {
    const sim = new CombatSimulation(await recipe('charge-deliberate', profile, 'teapot', 1));
    moveTo(sim, { x: 0, z: 1.5 });
    const active = until(sim, state => state.boss.stage === 'active');
    expect(active.boss.activeSlot).toBe('right');
    expect(active.boss.telegraph?.kind).toBe('cone');
    const stillPosition = active.boss.position;
    const observed: EncounterEvent[] = sim.drainEvents();
    const exposed = until(sim, state => state.boss.stage === 'exposed');
    observed.push(...sim.drainEvents());
    expect(exposed.boss.position).toEqual(stillPosition);
    const damage = observed.filter(event => event.kind === 'hero-damaged');
    expect(damage.length).toBe(profile === 'steam-narrow' ? 3 : 2);
    for (let i = 1; i < damage.length; i++) expect(damage[i].simTick - damage[i - 1].simTick).toBeGreaterThanOrEqual(48);
    const burstTicks = profile === 'steam-narrow' ? 39 : 27, gapTicks = profile === 'steam-narrow' ? 33 : 39;
    for (const event of damage) expect((event.simTick - active.tick - 1) % (burstTicks + gapTicks)).toBeLessThan(burstTicks);
    expect(exposed.hero.health).toBe(COMBAT_TUNING.health - damage.length);
    expect(exposed.boss.telegraph).toBeNull();
    const health = exposed.hero.health;
    advance(sim, 179);
    expect(sim.snapshot().boss).toMatchObject({ stage: 'exposed', activeSlot: 'right' });
    expect(sim.snapshot().hero.health).toBe(health);
    expect(sim.drainEvents().filter(event => event.kind === 'attack-started')).toEqual([]);
    advance(sim, 1);
    expect(sim.snapshot().boss).toMatchObject({ stage: 'recovery', activeSlot: 'right' });
    advance(sim, profile === 'steam-narrow' ? 47 : 53);
    expect(sim.snapshot().boss).toMatchObject({ stage: 'recovery', activeSlot: 'right' });
    expect(sim.drainEvents().filter(event => event.kind === 'module-activated')).toEqual([]);
  });

  it.each([
    ['teapot', 'steam-narrow'], ['mirror', 'steam-narrow'], ['teapot', 'steam-wide'], ['mirror', 'steam-wide'],
  ] as const)('lets %s %s reach and strike the steam counter', async (body, profile) => {
    const sim = new CombatSimulation(await recipe('charge-snappy', profile, body, 1));
    until(sim, state => state.boss.stage === 'exposed' && state.boss.activeSlot === 'right');
    approachAndStrike(sim, 'right');
    expect(sim.snapshot().modules[1]).toMatchObject({ broken: true, breakMeter: 100 });
  });

  it.each(['teapot', 'mirror'] as const)('requires reaching the exposed physical socket on the %s shell', async body => {
    const sim = new CombatSimulation(await recipe('steam-wide', 'charge-deliberate', body));
    until(sim, state => state.boss.stage === 'exposed' && state.boss.activeSlot === 'left');
    // The body is within melee distance, but the opposite-side exposed socket is not.
    moveTo(sim, { x: 1.6, z: -1 });
    const opposite = sim.snapshot();
    const socket = moduleWorldPosition(opposite.boss.position, opposite.boss.facing, 'left');
    expect(distance(opposite.hero.position, opposite.boss.position)).toBeLessThan(COMBAT_TUNING.strikeReach);
    expect(distance(opposite.hero.position, socket)).toBeGreaterThan(COMBAT_TUNING.strikeReach);
    const aim = direction(opposite.hero.position, socket);
    sim.step({ ...REST, aimX: aim.x, aimZ: aim.z, strike: true });
    expect(sim.snapshot().modules[0]).toMatchObject({ exposed: true, breakMeter: 0, broken: false });
    // The same real input route now closes the distance to that socket and exploits it.
    approachAndStrike(sim, 'left');
    expect(sim.snapshot().modules[0]).toMatchObject({ breakMeter: 100, broken: true });
  });

  it('hits a reachable exposed attachment even when the boss centre is outside melee range', async () => {
    const sim = new CombatSimulation(await recipe('steam-wide', 'charge-deliberate'));
    until(sim, state => state.boss.stage === 'exposed' && state.boss.activeSlot === 'left');
    moveTo(sim, { x: -2.4, z: -1.6 });
    const state = sim.snapshot();
    const socket = moduleWorldPosition(state.boss.position, state.boss.facing, 'left');
    expect(distance(state.hero.position, state.boss.position)).toBeGreaterThan(COMBAT_TUNING.strikeReach);
    expect(distance(state.hero.position, socket)).toBeLessThan(COMBAT_TUNING.strikeReach);
    const aim = direction(state.hero.position, socket);
    sim.step({ ...REST, aimX: aim.x, aimZ: aim.z, strike: true });
    expect(sim.snapshot().modules[0].breakMeter).toBe(COMBAT_TUNING.exposedProgress);
    approachAndStrike(sim, 'left');
    expect(sim.snapshot().modules[0].broken).toBe(true);
  });

  it.each(['steam-narrow', 'steam-wide'] as const)('%s reports actual burst damage and safe gaps within the same active stage', async profile => {
    const sim = new CombatSimulation(await recipe('charge-deliberate', profile, 'teapot', 1));
    const tell = until(sim, state => state.boss.stage === 'windup');
    expect(tell.boss.damageActive).toBe(false);
    const committed = until(sim, state => state.boss.stage === 'active');
    expect(committed.boss.damageActive).toBe(false);
    sim.step(REST);
    expect(sim.snapshot().boss).toMatchObject({ stage: 'active', activeSlot: 'right', damageActive: true });
    const burstTicks = profile === 'steam-narrow' ? 39 : 27, gapTicks = profile === 'steam-narrow' ? 33 : 39;
    advance(sim, burstTicks - 1);
    expect(sim.snapshot().boss.damageActive).toBe(true);
    sim.step(REST);
    expect(sim.snapshot().boss).toMatchObject({ stage: 'active', activeSlot: 'right', damageActive: false });
    advance(sim, gapTicks - 1);
    expect(sim.snapshot().boss).toMatchObject({ stage: 'active', damageActive: false });
    sim.step(REST);
    expect(sim.snapshot().boss).toMatchObject({ stage: 'active', damageActive: true });
    sim.setPaused(true);
    expect(sim.snapshot().boss.damageActive).toBe(false);
    sim.setPaused(false);
    expect(sim.snapshot().boss.damageActive).toBe(true);
    const exposed = until(sim, state => state.boss.stage === 'exposed');
    expect(exposed.boss.damageActive).toBe(false);
    until(sim, state => state.boss.stage === 'recovery');
    expect(sim.snapshot().boss.damageActive).toBe(false);
    sim.finish('abandoned');
    expect(sim.snapshot().boss.damageActive).toBe(false);
  });

  it('makes the actual dodge immune to overlapping steam, then permits later damage', async () => {
    const sim = new CombatSimulation(await recipe('charge-snappy', 'steam-narrow', 'teapot', 1));
    moveTo(sim, { x: 0, z: 1.5 });
    until(sim, state => state.boss.stage === 'active');
    advance(sim, 13, { ...REST, moveX: 1, dodge: true });
    expect(sim.snapshot().hero.health).toBe(5);
    moveTo(sim, { x: 0, z: 1.5 });
    until(sim, state => state.boss.stage === 'exposed');
    expect(sim.snapshot().hero.health).toBeLessThan(5);
    expect(sim.snapshot().hero.health).toBeGreaterThan(0);
  });

  it.each([
    ['teapot', 'echo-short'], ['mirror', 'echo-short'], ['teapot', 'echo-long'], ['mirror', 'echo-long'],
  ] as const)('%s %s copies a relative path into a block and allows a reachable mirror break', async (body, profile) => {
    const sim = new CombatSimulation(await recipe(profile, 'steam-wide', body));
    const start = until(sim, state => state.boss.stage === 'recording');
    const ticks = profile === 'echo-short' ? 60 : 120;
    advance(sim, ticks, { ...REST, moveX: -1, moveZ: 0.55 });
    const tell = sim.snapshot();
    expect(tell.boss.stage).toBe('windup');
    expect(tell.boss.telegraph?.kind).toBe('trail');
    expect(tell.boss.telegraph!.points[0]).toEqual(start.boss.position);
    expect(tell.boss.telegraph!.points[0]).not.toEqual(start.hero.position);
    expect(tell.boss.telegraph!.range).toBeGreaterThan(2);
    expect(tell.boss.telegraph!.points.at(-1)!.x).toBeLessThan(start.boss.position.x - 1);
    until(sim, state => state.boss.stage === 'exposed', 240);
    expect(sim.snapshot().boss.position.x).toBeLessThan(-1);
    assertLegalCircle(sim.snapshot().boss.position, ARENA.bossRadius);
    moveTo(sim, { x: -1.3, z: 1.3 });
    approachAndStrike(sim, 'left');
    expect(sim.snapshot().modules[0].broken).toBe(true);
    expect(sim.drainEvents().some(event => event.kind === 'flaw-exposed' && event.moduleSlot === 'left')).toBe(true);
  });

  it.each(['echo-short', 'echo-long'] as const)('%s preserves an actually stationary recording without free exposure or teleporting', async profile => {
    const sim = new CombatSimulation(await recipe(profile, 'steam-narrow'));
    until(sim, state => state.boss.stage === 'recording');
    const original = sim.snapshot().boss.position;
    until(sim, state => state.boss.stage === 'windup');
    const trail = sim.snapshot().boss.telegraph!;
    expect(trail.range).toBe(0);
    expect(trail.points.every(point => distance(point, original) === 0)).toBe(true);
    until(sim, state => state.boss.stage === 'recovery');
    expect(sim.snapshot().boss.position).toEqual(original);
    expect(sim.drainEvents().some(event => event.kind === 'flaw-exposed')).toBe(false);
  });

  it('reuses clipped echo geometry within a tick while detaching snapshots and invalidating state changes', async () => {
    const sim = new CombatSimulation(await recipe('echo-long', 'steam-narrow'));
    // Narrow inspection verifies reuse without exposing a cache or test hook in the API.
    const internal = sim as unknown as { echoTelegraphCache: CombatSnapshot['boss']['telegraph'] };
    const recordingInput = { ...REST, moveX: -1, moveZ: 0.55 };
    until(sim, state => state.boss.stage === 'recording');
    advance(sim, 20, recordingInput);
    const first = sim.snapshot().boss.telegraph!;
    const cached = internal.echoTelegraphCache;
    const faithful = structuredClone(first);
    expect(sim.snapshot().boss.telegraph).toEqual(faithful);
    expect(internal.echoTelegraphCache).toBe(cached);
    expect(first).not.toBe(cached);
    expect(first.points).not.toBe(cached!.points);
    expect(first.points[0]).not.toBe(cached!.points[0]);
    expect(first.direction).not.toBe(cached!.direction);
    first.direction.x = 999;
    first.points[0].z = 999;
    first.points.push({ x: 999, z: 999 });
    first.range = 999;
    expect(sim.snapshot().boss.telegraph).toEqual(faithful);
    expect(internal.echoTelegraphCache).toBe(cached);

    sim.step(recordingInput);
    expect(internal.echoTelegraphCache).toBeNull();
    const extended = sim.snapshot().boss.telegraph!;
    expect(extended.range).toBeGreaterThan(faithful.range);
    expect(internal.echoTelegraphCache).not.toBe(cached);
    const pausedCache = internal.echoTelegraphCache;
    sim.setPaused(true);
    advance(sim, 10, recordingInput);
    expect(sim.snapshot().boss.telegraph).toEqual(extended);
    expect(internal.echoTelegraphCache).toBe(pausedCache);
    sim.setPaused(false);

    until(sim, state => state.boss.stage === 'windup', 120, recordingInput);
    const clipped = sim.snapshot().boss.telegraph!;
    expect(internal.echoTelegraphCache).not.toBe(pausedCache);
    const windupCache = internal.echoTelegraphCache;
    const endpoint = { ...clipped.points.at(-1)! };
    expect(clipped.range).toBeGreaterThan(2);
    expect(clipped.points.length).toBeLessThan(121);
    assertLegalCircle(endpoint, ARENA.bossRadius);
    until(sim, state => state.boss.stage === 'active');
    expect(internal.echoTelegraphCache).not.toBe(windupCache);
    expect(sim.snapshot().boss.telegraph).toEqual(clipped);
    const exposed = until(sim, state => state.boss.stage === 'exposed');
    expect(distance(exposed.boss.position, endpoint)).toBeLessThan(1e-6);
    expect(exposed.boss.telegraph).toBeNull();
    expect(internal.echoTelegraphCache).toBeNull();

    const interrupted = new CombatSimulation(await recipe('echo-short', 'steam-narrow'));
    const interruptedInternal = interrupted as unknown as { echoTelegraphCache: CombatSnapshot['boss']['telegraph'] };
    until(interrupted, state => state.boss.stage === 'recording');
    advance(interrupted, 5, recordingInput);
    interrupted.snapshot();
    expect(interruptedInternal.echoTelegraphCache).not.toBeNull();
    interrupted.finish('abandoned');
    expect(interruptedInternal.echoTelegraphCache).toBeNull();
    expect(interrupted.snapshot().boss).toMatchObject({ stage: 'finished', telegraph: null });
  });

  it('retains ordinary chip progress, cancels an active attack at break and requires a separate final strike', async () => {
    const sim = new CombatSimulation(await recipe(), 'complete-fight');
    breakCharge(sim);
    const allEvents: EncounterEvent[] = sim.drainEvents();
    // Spend the overheat safely, then chip the surviving valve across actual tells,
    // active bursts and recovery. Do not take the much larger exposed progress.
    for (let i = 0; i < 1800; i++) {
      const state = sim.snapshot();
      if (state.modules[1].breakMeter === 95) break;
      expect(state.outcome).toBeNull();
      const socket = moduleWorldPosition(state.boss.position, state.boss.facing, 'right');
      const aim = direction(state.hero.position, socket);
      const strike = state.boss.activeSlot === 'right' && state.boss.stage !== 'exposed';
      sim.step({ ...REST, aimX: aim.x, aimZ: aim.z, strike });
    }
    expect(sim.snapshot().modules[1]).toMatchObject({ breakMeter: 95, broken: false });
    const beforeBreak = until(sim, state => state.boss.activeSlot === 'right' && state.boss.stage === 'active');
    allEvents.push(...sim.drainEvents());
    const socket = moduleWorldPosition(beforeBreak.boss.position, beforeBreak.boss.facing, 'right');
    const aim = direction(beforeBreak.hero.position, socket);
    sim.step({ ...REST, aimX: aim.x, aimZ: aim.z, strike: true });
    const afterBreak = sim.snapshot();
    expect(afterBreak.modules.every(module => module.broken)).toBe(true);
    expect(afterBreak.hero.health).toBe(beforeBreak.hero.health);
    expect(afterBreak).toMatchObject({ canFinish: true, outcome: null });
    expect(afterBreak.boss.telegraph).toBeNull();
    const breakEvents = sim.drainEvents();
    expect(breakEvents.map(event => event.kind)).toEqual(['attack-ended', 'module-broken']);
    expect(breakEvents.every(event => event.simTick === afterBreak.tick)).toBe(true);
    allEvents.push(...breakEvents);
    expect(() => sim.finish('won')).toThrow(/final strike/);
    advance(sim, 18);
    expect(sim.snapshot().outcome).toBeNull();
    expect(sim.drainEvents()).toEqual([]);
    const finishingState = sim.snapshot();
    const finishingAim = direction(finishingState.hero.position, finishingState.boss.position);
    sim.step({ ...REST, aimX: finishingAim.x, aimZ: finishingAim.z, strike: true });
    expect(sim.snapshot()).toMatchObject({ outcome: 'won', canFinish: false });
    allEvents.push(...sim.drainEvents());
    sim.finish('abandoned');
    advance(sim, 120, { ...REST, strike: true });
    expect(sim.drainEvents()).toEqual([]);
    expect(allEvents.filter(event => event.kind === 'outcome')).toHaveLength(1);
    const chargeBreak = allEvents.findIndex(event => event.kind === 'module-broken' && event.moduleSlot === 'left');
    expect(allEvents.slice(chargeBreak + 1).some(event => event.kind === 'module-activated' && event.moduleSlot === 'left')).toBe(false);
    allEvents.forEach((event, i) => expect(event.sequence).toBe(i + 1));
  });
});
