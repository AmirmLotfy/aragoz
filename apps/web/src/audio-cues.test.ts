import { afterEach, describe, expect, it, vi } from 'vitest';
import { CombatSimulation } from '@aragoz/combat';
import type { CombatSnapshot, PlayerInput } from '@aragoz/combat';
import { makeModule, makeRecipe, PROFILE_IDS } from '@aragoz/contracts';
import type { EncounterEvent, ProfileId } from '@aragoz/contracts';
import { AudioCuePlanner } from './audio-cues';
import type { AudioTell } from './audio-cues';
import { StageAudio } from './audio';
import type { Preferences } from './settings';
import { DEFAULT_KEYS } from './controls';

const REST: PlayerInput = { moveX: 0, moveZ: 0, aimX: 0, aimZ: -1, strike: false, dodge: false };
async function simulation(profile: ProfileId = 'charge-deliberate'): Promise<CombatSimulation> {
  const opposite = profile.startsWith('steam') ? 'charge-deliberate' : 'steam-narrow';
  const recipe = await makeRecipe({ roomId: 'audio-test', actId: 'act-1', id: 'audio-recipe', seed: 0,
    bodyId: 'teapot', now: '2026-10-27T12:00:00.000Z', modules: [makeModule(profile, 'left'), makeModule(opposite, 'right')] });
  return new CombatSimulation(recipe, 'audio-attempt');
}
async function tellSnapshot(): Promise<CombatSnapshot> {
  const sim = await simulation();
  for (let i = 0; i < 100; i++) { sim.step(REST); const snapshot = sim.snapshot(); if (snapshot.boss.stage === 'windup') return snapshot; }
  throw new Error('No windup');
}
const preferences: Preferences = { music: 0.2, sfx: 0.5, muted: false, reducedMotion: true, reducedFlashes: true,
  shake: 0, quality: 'low', presentationFps: 60, aimAssist: false, webcamCorner: 'none', keys: { ...DEFAULT_KEYS } };

describe('fixed-step advance audio cues', () => {
  it.each(PROFILE_IDS)('%s has a distinct tell before its real attack transition', async profile => {
    const sim = await simulation(profile), planner = new AudioCuePlanner();
    const cues: Array<{ kind: AudioTell; tick: number }> = [];
    let activationTick = -1, attackTick = -1;
    for (let i = 0; i < 400; i++) {
      sim.step(REST); const snapshot = sim.snapshot(), frame = planner.update(snapshot);
      if (frame.trigger) {
        expect(snapshot.boss.damageActive).toBe(false);
        cues.push({ kind: frame.trigger.kind, tick: snapshot.tick });
      }
      const events = sim.drainEvents();
      if (events.some(e => e.kind === 'module-activated')) activationTick = snapshot.tick;
      if (events.some(e => e.kind === 'attack-started')) { attackTick = snapshot.tick; expect(frame.active).toBeNull(); break; }
    }
    expect(activationTick).toBeGreaterThan(0); expect(attackTick).toBeGreaterThan(activationTick);
    expect(cues[0].tick).toBe(activationTick);
    expect(cues.every(cue => cue.tick < attackTick)).toBe(true);
    if (profile.startsWith('echo')) {
      expect(cues[0].kind).toBe('echo-recording');
      const warning = cues.find(cue => cue.kind === 'echo-warning');
      expect(warning).toBeDefined(); expect(warning!.tick).toBeGreaterThan(activationTick); expect(warning!.tick).toBeLessThan(attackTick);
    } else expect(new Set(cues.map(cue => cue.kind))).toEqual(new Set([profile.startsWith('steam') ? 'steam-windup' : 'charge-windup']));
  });
  it('deduplicates render reads, freezes with pause and skips missed pulses without replay', async () => {
    const snapshot = await tellSnapshot(), planner = new AudioCuePlanner();
    expect(planner.update(snapshot).trigger?.kind).toBe('charge-windup');
    expect(planner.update(snapshot).trigger).toBeNull();
    expect(planner.update({ ...snapshot, paused: true }).active).toBeNull();
    expect(planner.update({ ...snapshot, paused: true }).trigger).toBeNull();
    expect(planner.update(snapshot).trigger).toBeNull();
    const later = { ...snapshot, tick: snapshot.tick + 72, boss: { ...snapshot.boss, phaseTime: 1.2 } };
    expect(planner.update(later).trigger?.kind).toBe('charge-windup');
    expect(planner.update(later).trigger).toBeNull();
  });
  it('cancels a broken attachment even if an obsolete snapshot still calls its stage windup', async () => {
    const snapshot = await tellSnapshot(), planner = new AudioCuePlanner(); planner.update(snapshot);
    const broken = { ...snapshot, modules: snapshot.modules.map(module => ({ ...module, broken: module.slotId === snapshot.boss.activeSlot })) };
    expect(planner.update(broken)).toEqual({ active: null, trigger: null });
    expect(planner.update({ ...snapshot, outcome: 'abandoned' })).toEqual({ active: null, trigger: null });
  });
});

// In-memory Web Audio stand-ins: these tests cannot reach a speaker/audio device.
class FakeParam { value = 0; setValueAtTime = vi.fn((value: number) => { this.value = value; }); exponentialRampToValueAtTime = vi.fn(); }
class FakeNode { gain = new FakeParam(); connect = vi.fn(() => this); disconnect = vi.fn(); }
class FakeSource extends FakeNode { frequency = new FakeParam(); type = ''; buffer: unknown; onended: (() => void) | null = null; start = vi.fn(); stop = vi.fn(); }
class FakeContext {
  static instances: FakeContext[] = [];
  state = 'running'; currentTime = 20; sampleRate = 1000; destination = new FakeNode();
  sources: FakeSource[] = []; gains: FakeNode[] = [];
  constructor() { FakeContext.instances.push(this); }
  createGain() { const gain = new FakeNode(); this.gains.push(gain); return gain; }
  createOscillator() { const source = new FakeSource(); this.sources.push(source); return source; }
  createBufferSource() { return this.createOscillator(); }
  createBuffer(_channels: number, frames: number) { return { getChannelData: () => new Float32Array(frames) }; }
  resume = vi.fn(async () => {}); close = vi.fn(async () => {});
}
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); FakeContext.instances = []; });
function mockAudio(): void { vi.useFakeTimers(); vi.stubGlobal('AudioContext', FakeContext); }

describe('silent Web Audio lifecycle and independent controls', () => {
  it('retains muted-first gesture listeners, unlocks after unmute and cleans them up', async () => {
    mockAudio(); const snapshot = await tellSnapshot(), target = new EventTarget();
    const audio = new StageAudio({ ...preferences, muted: true }), release = audio.listenForGestures(target);
    audio.sync(snapshot);
    target.dispatchEvent(new Event('pointerdown')); target.dispatchEvent(new Event('keydown'));
    await Promise.resolve(); expect(FakeContext.instances).toHaveLength(0);
    audio.setPreferences(preferences); target.dispatchEvent(new Event('keydown'));
    await Promise.resolve(); expect(FakeContext.instances).toHaveLength(1);
    const context = FakeContext.instances[0];
    for (let i = 0; i < 10; i++) target.dispatchEvent(new Event('keydown'));
    await Promise.resolve(); expect(context.resume).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(1);
    audio.sync({ ...snapshot, boss: { ...snapshot.boss, phaseTime: 0.3 } });
    expect(context.sources.length).toBeGreaterThan(0);
    context.state = 'suspended'; target.dispatchEvent(new Event('pointerdown'));
    await Promise.resolve(); expect(context.resume).toHaveBeenCalledOnce();
    release(); target.dispatchEvent(new Event('keydown')); target.dispatchEvent(new Event('pointerdown'));
    await Promise.resolve(); expect(context.resume).toHaveBeenCalledOnce(); audio.dispose();
  });
  it('does not create an audio device when muted; old tells do not replay on unmute', async () => {
    mockAudio(); const snapshot = await tellSnapshot(), audio = new StageAudio({ ...preferences, muted: true });
    audio.sync(snapshot); await audio.unlock(); expect(FakeContext.instances).toHaveLength(0);
    audio.setPreferences(preferences); await audio.unlock(); audio.sync(snapshot);
    expect(FakeContext.instances[0].sources).toHaveLength(0);
    audio.sync({ ...snapshot, boss: { ...snapshot.boss, phaseTime: 0.3 } });
    expect(FakeContext.instances[0].sources.length).toBeGreaterThan(0); audio.dispose();
  });
  it('cancels tell nodes on pause/break, and schedules no delayed warnings', async () => {
    mockAudio(); const snapshot = await tellSnapshot(), audio = new StageAudio(preferences); await audio.unlock(); audio.sync(snapshot);
    const context = FakeContext.instances[0], sources = [...context.sources]; expect(sources.length).toBeGreaterThan(0);
    for (const source of sources) expect(source.start).toHaveBeenCalledWith(context.currentTime);
    audio.sync({ ...snapshot, paused: true });
    for (const source of sources) { expect(source.stop).toHaveBeenLastCalledWith(); expect(source.disconnect).toHaveBeenCalled(); }
    const count = context.sources.length; vi.advanceTimersByTime(5000); audio.sync(snapshot); expect(context.sources).toHaveLength(count);
    audio.sync({ ...snapshot, boss: { ...snapshot.boss, phaseTime: 0.3 } });
    const next = context.sources.slice(count); expect(next.length).toBeGreaterThan(0);
    audio.sync({ ...snapshot, modules: snapshot.modules.map(module => ({ ...module, broken: module.slotId === snapshot.boss.activeSlot })) });
    for (const source of next) expect(source.stop).toHaveBeenLastCalledWith(); audio.dispose();
  });
  it('changes independent volume buses immediately and mute cancels all current sources', async () => {
    mockAudio(); const snapshot = await tellSnapshot(), audio = new StageAudio(preferences); await audio.unlock(); audio.sync(snapshot);
    const context = FakeContext.instances[0]; vi.advanceTimersByTime(260);
    const [music, sfx] = context.gains;
    audio.setPreferences({ ...preferences, music: 0.7, sfx: 0.1 });
    expect(music.gain.value).toBe(0.7); expect(sfx.gain.value).toBe(0.1);
    audio.setPreferences({ ...preferences, muted: true });
    expect(music.gain.value).toBe(0); expect(sfx.gain.value).toBe(0);
    for (const source of context.sources) expect(source.disconnect).toHaveBeenCalled();
    const count = context.sources.length; vi.advanceTimersByTime(2000); expect(context.sources).toHaveLength(count);
    audio.dispose(); expect(context.close).toHaveBeenCalledOnce();
  });
  it('keeps attack-started silent and allows one outcome cue without replay after it ends', async () => {
    mockAudio(); const snapshot = await tellSnapshot(), audio = new StageAudio(preferences); await audio.unlock();
    audio.sync({ ...snapshot, boss: { ...snapshot.boss, stage: 'active' } });
    const event: EncounterEvent = { schemaVersion: 1, attemptId: 'audio-attempt', sequence: 1, simTick: snapshot.tick,
      recipeHash: '0'.repeat(64), kind: 'attack-started', moduleSlot: 'left', value: null, outcome: null };
    audio.event(event); const context = FakeContext.instances[0]; expect(context.sources).toHaveLength(0);
    const ended = { ...snapshot, outcome: 'won' as const }; audio.sync(ended); audio.event({ ...event, kind: 'outcome', outcome: 'won' });
    expect(context.sources).toHaveLength(1); const resultSource = context.sources[0];
    audio.sync(ended); expect(resultSource.disconnect).not.toHaveBeenCalled();
    vi.advanceTimersByTime(3000); expect(context.sources).toHaveLength(1); audio.dispose();
  });
});
