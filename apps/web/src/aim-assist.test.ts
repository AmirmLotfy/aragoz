import { describe, expect, it } from 'vitest';
import { CombatSimulation, COMBAT_TUNING } from '@aragoz/combat';
import type { CombatSnapshot, PlayerInput } from '@aragoz/combat';
import { makeModule, makeRecipe, moduleWorldPosition } from '@aragoz/contracts';
import type { SlotId, Vec2 } from '@aragoz/contracts';
import { resolveStrikeAim } from './aim-assist';

const REST: PlayerInput = { moveX: 0, moveZ: 0, aimX: 0, aimZ: -1, strike: false, dodge: false };
const distance = (a: Vec2, b: Vec2): number => Math.hypot(a.x - b.x, a.z - b.z);

function snapshot(): CombatSnapshot {
  return {
    tick: 0, elapsed: 0, paused: false, outcome: null, canFinish: false,
    hero: { position: { x: 0, z: 0 }, health: 5, invulnerable: false, dodging: false, facing: { x: 0, z: 1 }, striking: false },
    boss: { position: { x: 0, z: 0 }, facing: { x: 0, z: 1 }, stage: 'idle', activeSlot: null,
      damageActive: false, phaseTime: 0, telegraph: null },
    modules: [
      { slotId: 'left', mechanicId: 'charge', breakMeter: 0, broken: false, exposed: false },
      { slotId: 'right', mechanicId: 'steam', breakMeter: 0, broken: false, exposed: false },
    ],
  };
}

function until(sim: CombatSimulation, predicate: (state: CombatSnapshot) => boolean, maximum: number,
  input: (state: CombatSnapshot) => PlayerInput = () => REST): CombatSnapshot {
  for (let tick = 0; tick <= maximum; tick++) {
    const state = sim.snapshot();
    if (predicate(state)) return state;
    if (state.outcome !== null) throw new Error(`Encounter ended (${state.outcome}) before the expected state`);
    if (tick < maximum) sim.step(input(state));
  }
  throw new Error(`Expected state not reached after ${maximum} fixed steps`);
}

function moveTo(sim: CombatSimulation, target: Vec2, maximum = 180): void {
  until(sim, state => distance(state.hero.position, target) < 0.1, maximum, state => {
    const offset = { x: target.x - state.hero.position.x, z: target.z - state.hero.position.z };
    const size = Math.hypot(offset.x, offset.z);
    return { ...REST, moveX: offset.x / size, moveZ: offset.z / size };
  });
}

function breakSocket(sim: CombatSimulation, slot: SlotId): void {
  until(sim, state => state.modules.find(module => module.slotId === slot)!.broken, 150, state => {
    const socket = moduleWorldPosition(state.boss.position, state.boss.facing, slot);
    const aim = { x: socket.x - state.hero.position.x, z: socket.z - state.hero.position.z };
    const size = Math.hypot(aim.x, aim.z), moving = size > 1.45;
    return { ...REST, aimX: aim.x, aimZ: aim.z, strike: true,
      moveX: moving ? aim.x / size : 0, moveZ: moving ? aim.z / size : 0 };
  });
}

describe('strike aim assistance', () => {
  it('preserves manual pointer offsets and the no-pointer boss fallback', () => {
    const state = snapshot();
    state.hero.position = { x: -2, z: 3 };
    state.boss.position = { x: 4, z: -3 };
    expect(resolveStrikeAim(state, { x: 1, z: 5 }, false)).toEqual({ x: 3, z: 2 });
    for (const enabled of [false, true])
      expect(resolveStrikeAim(state, null, enabled)).toEqual({ x: 6, z: -6 });
  });

  it('prefers an exposed socket over a closer intact socket', () => {
    const state = snapshot();
    state.hero.position.x = -0.5;
    state.modules[1].exposed = true;
    expect(resolveStrikeAim(state, { x: -9, z: -9 }, true)).toEqual({ x: 1.55, z: 0.2 });
  });

  it('uses rotated physical sockets and chooses the closest when neither is exposed', () => {
    const state = snapshot();
    state.boss.position = { x: 3, z: 2 };
    state.boss.facing = { x: 1, z: 0 };
    state.hero.position = { x: 3.1, z: 2.5 };
    const aim = resolveStrikeAim(state, null, true);
    expect(aim.x).toBeCloseTo(0.1);
    expect(aim.z).toBeCloseTo(0.55);
  });

  it('ignores broken sockets and exposed sockets outside the assist range', () => {
    const state = snapshot();
    state.hero.position.x = -0.5;
    state.modules[0].broken = true;
    state.modules[0].exposed = true;
    expect(resolveStrikeAim(state, null, true)).toEqual({ x: 1.55, z: 0.2 });
    state.modules[0].broken = false;
    state.modules[0].exposed = false;
    state.modules[1].exposed = true;
    state.hero.position.x = -1.2;
    const aim = resolveStrikeAim(state, null, true);
    expect(aim.x).toBeCloseTo(0.15);
    expect(aim.z).toBeCloseTo(0.2);
  });

  it('retains the pointer when intact sockets are out of range even if the body is nearby', () => {
    const state = snapshot();
    state.boss.position.z = 2;
    expect(resolveStrikeAim(state, { x: -5, z: 0 }, true)).toEqual({ x: -5, z: 0 });
  });

  it('centres the final strike only with assistance enabled and the body inside 2.1m', () => {
    const state = snapshot(), pointer = { x: -5, z: 0 };
    state.modules.forEach(module => { module.broken = true; module.breakMeter = 100; });
    state.canFinish = true;
    state.boss.position.x = 0.92;
    expect(resolveStrikeAim(state, pointer, true)).toEqual({ x: 0.92, z: 0 });
    expect(resolveStrikeAim(state, pointer, false)).toEqual(pointer);
    state.boss.position.x = 2.099;
    expect(resolveStrikeAim(state, pointer, true)).toEqual({ x: 2.099, z: 0 });
    for (const x of [2.1, 3]) {
      state.boss.position.x = x;
      expect(resolveStrikeAim(state, pointer, true)).toEqual(pointer);
    }
  });

  it('turns held strikes with a stale pointer into a real final-strike win after legitimate module breaks', async () => {
    const recipe = await makeRecipe({ roomId: 'aim-test', actId: 'act-1', id: 'aim-regression', seed: 0,
      bodyId: 'teapot', now: '2026-10-25T12:00:00.000Z',
      modules: [makeModule('charge-deliberate', 'left'), makeModule('steam-narrow', 'right')] });
    const sim = new CombatSimulation(recipe, 'stale-pointer-attempt');
    // Existing combat-test route: bait the west block, then reach the exposed axle.
    moveTo(sim, { x: -5.3, z: 1 });
    until(sim, state => state.boss.stage === 'exposed' && state.boss.activeSlot === 'left', 240);
    moveTo(sim, { x: -1.3, z: 1.3 });
    breakSocket(sim, 'left');
    // Ordinary strikes from the safe valve position retain their real chip progress.
    const ready = until(sim, state => state.canFinish, 1800, state => {
      const socket = moduleWorldPosition(state.boss.position, state.boss.facing, 'right');
      return { ...REST, aimX: socket.x - state.hero.position.x, aimZ: socket.z - state.hero.position.z,
        strike: state.boss.activeSlot === 'right' && state.boss.stage !== 'exposed' };
    });
    expect(ready.modules.every(module => module.broken)).toBe(true);
    expect(distance(ready.hero.position, ready.boss.position)).toBeLessThan(COMBAT_TUNING.strikeReach);
    const stalePointer = { x: ready.hero.position.x + 10 * (ready.hero.position.x - ready.boss.position.x),
      z: ready.hero.position.z + 10 * (ready.hero.position.z - ready.boss.position.z) };
    for (let tick = 0; tick < 120; tick++) {
      const aim = resolveStrikeAim(sim.snapshot(), stalePointer, false);
      sim.step({ ...REST, aimX: aim.x, aimZ: aim.z, strike: true });
    }
    expect(sim.snapshot()).toMatchObject({ outcome: null, canFinish: true });
    const missedUntil = sim.snapshot().tick;
    const finished = until(sim, state => state.outcome === 'won', 18, state => {
      const aim = resolveStrikeAim(state, stalePointer, true);
      return { ...REST, aimX: aim.x, aimZ: aim.z, strike: true };
    });
    expect(finished.tick).toBeGreaterThan(missedUntil);
    const events = sim.drainEvents();
    expect(events.filter(event => event.kind === 'module-broken')).toHaveLength(2);
    expect(events.filter(event => event.kind === 'outcome')).toEqual([
      expect.objectContaining({ outcome: 'won', simTick: finished.tick }),
    ]);
  });
});
