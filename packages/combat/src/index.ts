import { ARENA, BossRecipeSchema, MECHANICS, OUTCOMES, moduleWorldPosition } from '@aragoz/contracts';
import type { BossRecipe, EncounterEvent, FamilyId, Outcome, RecipeModule, SlotId, Vec2 } from '@aragoz/contracts';

export interface PlayerInput {
  moveX: number; moveZ: number; aimX: number; aimZ: number; strike: boolean; dodge: boolean;
}

export interface CombatSnapshot {
  tick: number; elapsed: number; paused: boolean; outcome: Outcome | null; canFinish: boolean;
  hero: { position: Vec2; health: number; invulnerable: boolean; dodging: boolean; facing: Vec2; striking: boolean };
  boss: {
    position: Vec2; facing: Vec2;
    stage: 'idle' | 'windup' | 'active' | 'exposed' | 'recovery' | 'recording' | 'finished';
    activeSlot: SlotId | null;
    /** Whether the current unpaused frame has an emitting offensive hazard. */
    damageActive: boolean;
    /** Elapsed seconds in this stage, advanced only by unpaused fixed steps. */
    phaseTime: number;
    telegraph: { kind: 'lane' | 'cone' | 'trail'; direction: Vec2; points: Vec2[]; range: number; angle: number } | null;
  };
  modules: Array<{ slotId: SlotId; mechanicId: FamilyId; breakMeter: number; broken: boolean; exposed: boolean }>;
}

export const COMBAT_TUNING = Object.freeze({
  stepSeconds: 1 / 60,
  health: 5,
  moveSpeed: 4.2,
  dodgeSpeed: 9,
  dodgeSeconds: 0.22,
  dodgeCooldown: 0.75,
  damageImmunity: 0.8,
  strikeCooldown: 0.3,
  strikeSeconds: 0.13,
  strikeReach: 1.9,
  ordinaryProgress: 5,
  exposedProgress: 40,
});

type Stage = CombatSnapshot['boss']['stage'];
type Telegraph = NonNullable<CombatSnapshot['boss']['telegraph']>;
type LiveModule = { recipe: RecipeModule; breakMeter: number; broken: boolean };
type Hit = { t: number; normal: Vec2; block: boolean };
type Move = { position: Vec2; block: boolean; boundary: boolean };
const DT = COMBAT_TUNING.stepSeconds;
const EPSILON = 1e-7;
const copy = (v: Vec2): Vec2 => ({ x: v.x, z: v.z });
const add = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x + b.x, z: a.z + b.z });
const subtract = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, z: a.z - b.z });
const scale = (v: Vec2, n: number): Vec2 => ({ x: v.x * n, z: v.z * n });
const dot = (a: Vec2, b: Vec2): number => a.x * b.x + a.z * b.z;
const length = (v: Vec2): number => Math.hypot(v.x, v.z);
const distance = (a: Vec2, b: Vec2): number => length(subtract(a, b));
const clamp = (n: number, low: number, high: number): number => Math.max(low, Math.min(high, n));
const finiteAxis = (n: number): number => Number.isFinite(n) ? n : 0;
function normalized(v: Vec2, fallback: Vec2 = { x: 0, z: 1 }): Vec2 {
  const magnitude = length(v);
  return magnitude > EPSILON ? scale(v, 1 / magnitude) : copy(fallback);
}
function normalizedInput(x: number, z: number): Vec2 {
  const v = { x: finiteAxis(x), z: finiteAxis(z) };
  const largest = Math.max(Math.abs(v.x), Math.abs(v.z));
  // Preserve direction even for callers supplying a world-space aim vector, and
  // scale before hypot so very large finite inputs cannot overflow normalization.
  if (largest > 1) return normalized({ x: v.x / largest, z: v.z / largest });
  return length(v) > 1 ? normalized(v) : v;
}
function clampToArena(v: Vec2, radius: number): Vec2 {
  return { x: clamp(v.x, -ARENA.halfWidth + radius, ARENA.halfWidth - radius), z: clamp(v.z, -ARENA.halfDepth + radius, ARENA.halfDepth - radius) };
}

/** Analytic swept circle/rectangle contact, including the rounded corners. */
function sweepBlock(start: Vec2, delta: Vec2, radius: number, block: typeof ARENA.blocks[number]): Hit | null {
  const minX = block.x - block.halfWidth, maxX = block.x + block.halfWidth;
  const minZ = block.z - block.halfDepth, maxZ = block.z + block.halfDepth;
  let first: Hit | null = null;
  const consider = (t: number, normal: Vec2): void => {
    if (t < -EPSILON || t > 1 + EPSILON || dot(delta, normal) >= -EPSILON) return;
    if (!first || t < first.t) first = { t: clamp(t, 0, 1), normal, block: true };
  };
  if (Math.abs(delta.x) > EPSILON) {
    for (const [x, normal] of [[minX - radius, { x: -1, z: 0 }], [maxX + radius, { x: 1, z: 0 }]] as const) {
      const t = (x - start.x) / delta.x, z = start.z + delta.z * t;
      if (z >= minZ - EPSILON && z <= maxZ + EPSILON) consider(t, normal);
    }
  }
  if (Math.abs(delta.z) > EPSILON) {
    for (const [z, normal] of [[minZ - radius, { x: 0, z: -1 }], [maxZ + radius, { x: 0, z: 1 }]] as const) {
      const t = (z - start.z) / delta.z, x = start.x + delta.x * t;
      if (x >= minX - EPSILON && x <= maxX + EPSILON) consider(t, normal);
    }
  }
  const a = dot(delta, delta);
  if (a > EPSILON * EPSILON) {
    for (const x of [minX, maxX]) for (const z of [minZ, maxZ]) {
      const offset = subtract(start, { x, z });
      const b = 2 * dot(offset, delta), c = dot(offset, offset) - radius * radius;
      const discriminant = b * b - 4 * a * c;
      if (discriminant < 0) continue;
      const t = (-b - Math.sqrt(discriminant)) / (2 * a);
      const at = add(start, scale(delta, t));
      if ((x === minX ? at.x <= minX + EPSILON : at.x >= maxX - EPSILON) &&
          (z === minZ ? at.z <= minZ + EPSILON : at.z >= maxZ - EPSILON)) {
        consider(t, normalized(subtract(at, { x, z })));
      }
    }
  }
  return first;
}

function firstContact(start: Vec2, delta: Vec2, radius: number): Hit | null {
  let first: Hit | null = null;
  for (const block of ARENA.blocks) {
    const hit = sweepBlock(start, delta, radius, block);
    if (hit && (!first || hit.t < first.t)) first = hit;
  }
  const boundary = (t: number, normal: Vec2): void => {
    if (t >= -EPSILON && t <= 1 + EPSILON && dot(delta, normal) < -EPSILON && (!first || t < first.t))
      first = { t: clamp(t, 0, 1), normal, block: false };
  };
  if (delta.x < -EPSILON) boundary((-ARENA.halfWidth + radius - start.x) / delta.x, { x: 1, z: 0 });
  if (delta.x > EPSILON) boundary((ARENA.halfWidth - radius - start.x) / delta.x, { x: -1, z: 0 });
  if (delta.z < -EPSILON) boundary((-ARENA.halfDepth + radius - start.z) / delta.z, { x: 0, z: 1 });
  if (delta.z > EPSILON) boundary((ARENA.halfDepth - radius - start.z) / delta.z, { x: 0, z: -1 });
  return first;
}

function moveCircle(start: Vec2, delta: Vec2, radius: number, slide: boolean): Move {
  let position = copy(start), remaining = copy(delta), block = false, boundary = false;
  for (let contact = 0; contact < (slide ? 4 : 1); contact++) {
    if (length(remaining) < EPSILON) break;
    const hit = firstContact(position, remaining, radius);
    if (!hit) { position = add(position, remaining); break; }
    position = add(position, scale(remaining, Math.max(0, hit.t - EPSILON)));
    block ||= hit.block;
    boundary ||= !hit.block;
    if (!slide) break;
    remaining = scale(remaining, 1 - hit.t);
    remaining = subtract(remaining, scale(hit.normal, Math.min(0, dot(remaining, hit.normal))));
  }
  return { position: clampToArena(position, radius), block, boundary };
}

function segmentDistance(point: Vec2, start: Vec2, end: Vec2): number {
  const delta = subtract(end, start), squared = dot(delta, delta);
  const t = squared > EPSILON ? clamp(dot(subtract(point, start), delta) / squared, 0, 1) : 0;
  return distance(point, add(start, scale(delta, t)));
}

/** A pure, local, fixed 60 Hz simulation. The caller owns its render clock and event transport. */
export class CombatSimulation {
  private recipe: BossRecipe;
  private attemptId: string;
  private tick = 0;
  private paused = false;
  private outcome: Outcome | null = null;
  private heroPosition: Vec2 = copy(ARENA.heroSpawn);
  private heroFacing: Vec2 = { x: 0, z: -1 };
  private heroHealth: number = COMBAT_TUNING.health;
  private invulnerableUntil = 0;
  private dodgeUntil = 0;
  private nextDodge = 0;
  private dodgeDirection: Vec2 = { x: 0, z: -1 };
  private dodgeHeld = false;
  private nextStrike = 0;
  private strikeUntil = 0;
  private bossPosition: Vec2 = copy(ARENA.bossSpawn);
  private bossFacing: Vec2 = { x: 0, z: 1 };
  private modules: LiveModule[];
  private active: LiveModule | null = null;
  private stage: Stage = 'idle';
  private stageTicks = 0;
  private idleTicks: number;
  private randomState: number;
  private nextSlot: SlotId;
  private attackOpen = false;
  private recording: Vec2[] = [];
  private echoPath: Vec2[] = [];
  private echoOrigin: Vec2 = copy(ARENA.bossSpawn);
  private echoTelegraphCache: Telegraph | null = null;
  private sequence = 0;
  private events: EncounterEvent[] = [];

  constructor(recipe: BossRecipe, attemptId?: string) {
    // Zod clones the accepted shape; later caller mutations cannot change this encounter.
    this.recipe = BossRecipeSchema.parse(recipe);
    this.attemptId = attemptId ?? `${this.recipe.id}:attempt`;
    if (typeof this.attemptId !== 'string' || !this.attemptId.length) throw new Error('An attempt ID is required');
    this.modules = this.recipe.modules.map(module => ({ recipe: module, breakMeter: 0, broken: false }));
    this.randomState = this.recipe.seed >>> 0;
    this.nextSlot = this.random() < 0.5 ? 'left' : 'right';
    this.idleTicks = Math.round((0.8 + this.random() * 0.25) / DT);
  }

  /** Each call advances exactly one fixed step; no wall clock, random source or I/O is read. */
  step(input: PlayerInput): void {
    if (this.paused || this.outcome !== null) return;
    this.echoTelegraphCache = null;
    this.tick++;
    const previousHero = copy(this.heroPosition);
    const move = normalizedInput(input.moveX, input.moveZ);
    const aim = normalizedInput(input.aimX, input.aimZ);
    if (length(aim) > EPSILON) this.heroFacing = normalized(aim);
    else if (length(move) > EPSILON) this.heroFacing = normalized(move);
    if (input.dodge && !this.dodgeHeld && this.tick >= this.nextDodge) {
      this.dodgeDirection = length(move) > EPSILON ? normalized(move) : copy(this.heroFacing);
      this.dodgeUntil = this.tick + this.ticks(COMBAT_TUNING.dodgeSeconds);
      this.nextDodge = this.tick + this.ticks(COMBAT_TUNING.dodgeCooldown);
    }
    this.dodgeHeld = Boolean(input.dodge);
    const dodging = this.tick < this.dodgeUntil;
    this.heroPosition = moveCircle(this.heroPosition,
      scale(dodging ? this.dodgeDirection : move, (dodging ? COMBAT_TUNING.dodgeSpeed : COMBAT_TUNING.moveSpeed) * DT),
      ARENA.heroRadius, true).position;

    // Player counters resolve before hazards: a break cancels this tick's damage immediately.
    if (input.strike && !dodging && this.tick >= this.nextStrike) {
      this.nextStrike = this.tick + this.ticks(COMBAT_TUNING.strikeCooldown);
      this.strikeUntil = this.tick + this.ticks(COMBAT_TUNING.strikeSeconds);
      this.strike();
    }
    if (this.outcome !== null) return;
    this.updateBoss(previousHero);
  }

  setPaused(paused: boolean): void { this.paused = Boolean(paused); }

  /** Host interruptions use this method; winning remains gated by the real final strike. */
  finish(outcome: Outcome): void {
    if (!OUTCOMES.includes(outcome)) throw new Error('Unknown encounter outcome');
    if (this.outcome !== null) return;
    if (outcome === 'won' && !this.canFinish()) throw new Error('Both modules must break before the final strike');
    if (outcome === 'won') throw new Error('Winning requires a final strike');
    this.resolve(outcome);
  }

  snapshot(): CombatSnapshot {
    return {
      tick: this.tick, elapsed: this.tick * DT, paused: this.paused, outcome: this.outcome, canFinish: this.canFinish() && this.outcome === null,
      hero: { position: copy(this.heroPosition), health: this.heroHealth, invulnerable: this.tick < this.invulnerableUntil || this.tick < this.dodgeUntil,
        dodging: this.tick < this.dodgeUntil, facing: copy(this.heroFacing), striking: this.tick < this.strikeUntil },
      boss: { position: copy(this.bossPosition), facing: copy(this.bossFacing), stage: this.stage,
        activeSlot: this.active?.recipe.slotId ?? null, damageActive: this.damageActive(),
        phaseTime: this.stageTicks * DT, telegraph: this.telegraph() },
      modules: this.modules.map(module => ({ slotId: module.recipe.slotId, mechanicId: module.recipe.mechanicId,
        breakMeter: module.breakMeter, broken: module.broken, exposed: this.active === module && this.stage === 'exposed' && !module.broken })),
    };
  }

  drainEvents(): EncounterEvent[] {
    const events = this.events;
    this.events = [];
    return events.map(event => ({ ...event }));
  }

  private random(): number {
    this.randomState = (this.randomState + 0x6d2b79f5) >>> 0;
    let n = this.randomState;
    n = Math.imul(n ^ (n >>> 15), n | 1);
    n ^= n + Math.imul(n ^ (n >>> 7), n | 61);
    return ((n ^ (n >>> 14)) >>> 0) / 4294967296;
  }

  private ticks(seconds: number): number { return Math.max(1, Math.round(seconds / DT)); }
  private canFinish(): boolean { return this.modules.every(module => module.broken); }
  private parameters(): Readonly<Record<string, number>> {
    return this.active ? MECHANICS[this.active.recipe.profileId].parameters : {};
  }
  private enter(stage: Stage): void {
    this.echoTelegraphCache = null;
    this.stage = stage;
    this.stageTicks = 0;
  }
  private emit(kind: EncounterEvent['kind'], moduleSlot: SlotId | null = this.active?.recipe.slotId ?? null,
    value: number | null = null, outcome: Outcome | null = null): void {
    this.events.push({ schemaVersion: 1, attemptId: this.attemptId, sequence: ++this.sequence, simTick: this.tick,
      recipeHash: this.recipe.hash, kind, moduleSlot, value, outcome });
  }

  private strikeCanReach(point: Vec2): boolean {
    const offset = subtract(point, this.heroPosition), reach = length(offset);
    if (reach > COMBAT_TUNING.strikeReach || (reach > EPSILON && dot(this.heroFacing, normalized(offset)) < 0.25)) return false;
    const obstruction = firstContact(this.heroPosition, offset, 0);
    return !(obstruction?.block && obstruction.t < 1 - EPSILON);
  }

  private strike(): void {
    if (this.canFinish()) {
      if (this.strikeCanReach(this.bossPosition)) this.resolve('won');
      return;
    }
    // An exposed rule is preferred only when its actual attachment is reachable.
    // Other valid swings chip the closest intact physical socket, never the body.
    let target: LiveModule | null = null, closest = Infinity;
    for (const module of this.modules) {
      if (module.broken) continue;
      const socket = moduleWorldPosition(this.bossPosition, this.bossFacing, module.recipe.slotId);
      if (!this.strikeCanReach(socket)) continue;
      const exposed = this.stage === 'exposed' && this.active === module;
      const reach = distance(this.heroPosition, socket);
      if (exposed) { target = module; break; }
      if (reach < closest) { target = module; closest = reach; }
    }
    if (!target) return;
    const exposed = this.stage === 'exposed' && this.active === target;
    target.breakMeter = Math.min(100, target.breakMeter + (exposed ? COMBAT_TUNING.exposedProgress : COMBAT_TUNING.ordinaryProgress));
    if (target.breakMeter < 100) return;
    target.broken = true;
    if (this.active === target) this.endAttack();
    this.emit('module-broken', target.recipe.slotId, 100);
    // A broken attachment cannot emit another damaging frame, and its counter aftermath
    // remains exclusive before the other module may begin its next tell.
    if (this.active === target) this.enter('recovery');
    if (this.canFinish()) { this.active = null; this.enter('idle'); }
  }

  private updateBoss(previousHero: Vec2): void {
    if (this.canFinish()) return;
    if (this.stage === 'idle') {
      this.stageTicks++;
      if (this.stageTicks < this.idleTicks) return;
      this.active = this.modules.find(module => !module.broken && module.recipe.slotId === this.nextSlot)
        ?? this.modules.find(module => !module.broken) ?? null;
      if (!this.active) return;
      this.nextSlot = this.active.recipe.slotId === 'left' ? 'right' : 'left';
      this.bossFacing = normalized(subtract(this.heroPosition, this.bossPosition), this.bossFacing);
      this.recording = [copy(this.heroPosition)];
      this.echoPath = [];
      this.echoOrigin = copy(this.bossPosition);
      this.emit('module-activated');
      this.enter(this.active.recipe.mechanicId === 'echo' ? 'recording' : 'windup');
      return;
    }
    if (!this.active) return;
    const parameters = this.parameters(), family = this.active.recipe.mechanicId;
    this.stageTicks++;
    if (this.stage === 'recording') {
      this.recording.push(copy(this.heroPosition));
      if (this.stageTicks >= this.ticks(parameters.recordDuration)) {
        this.buildEchoPath();
        this.enter('windup');
      }
      return;
    }
    if (this.stage === 'windup') {
      if (family !== 'echo') this.bossFacing = normalized(subtract(this.heroPosition, this.bossPosition), this.bossFacing);
      if (this.stageTicks >= this.ticks(parameters.windup)) {
        this.enter('active'); this.attackOpen = true; this.emit('attack-started');
      }
      return;
    }
    if (this.stage === 'active') {
      if (this.active.broken) { this.endAttack(); this.enter('recovery'); return; }
      if (family === 'charge') {
        const before = copy(this.bossPosition);
        const moved = moveCircle(before, scale(this.bossFacing, parameters.speed * DT), ARENA.bossRadius, false);
        this.bossPosition = moved.position;
        // Relative swept motion detects both a fast boss and a hero crossing its lane.
        this.damageFromSweep(before, this.bossPosition, previousHero);
        if (this.outcome !== null) return;
        if (moved.block) this.expose();
        else if (moved.boundary || this.stageTicks >= this.ticks(parameters.duration)) this.recover();
      } else if (family === 'steam') {
        const burstTicks = this.ticks(parameters.burstDuration), gapTicks = this.ticks(parameters.burstGap);
        if (this.steamBurstActive(parameters) && this.inSteam(parameters)) this.damageHero();
        if (this.outcome !== null) return;
        const totalTicks = parameters.bursts * burstTicks + (parameters.bursts - 1) * gapTicks;
        if (this.stageTicks >= totalTicks) this.expose();
      } else {
        const before = copy(this.bossPosition);
        const frame = Math.min(this.recording.length - 1, this.stageTicks * parameters.playbackSpeed);
        const lower = Math.floor(frame), upper = Math.min(lower + 1, this.echoPath.length - 1);
        const target = add(this.echoPath[lower], scale(subtract(this.echoPath[upper], this.echoPath[lower]), frame - lower));
        // A future point can lie beyond scenery; collision stops playback at the actual contact.
        const moved = moveCircle(before, subtract(target, before), ARENA.bossRadius, false);
        this.bossPosition = moved.position;
        const direction = subtract(this.bossPosition, before);
        if (length(direction) > EPSILON) this.bossFacing = normalized(direction);
        this.damageFromSweep(before, this.bossPosition, previousHero);
        if (this.outcome !== null) return;
        if (moved.block) this.expose();
        else if (moved.boundary || frame >= this.recording.length - 1) this.recover();
      }
      return;
    }
    if (this.stage === 'exposed') {
      if (this.stageTicks >= this.ticks(parameters.exposure)) this.enter('recovery');
      return;
    }
    if (this.stage === 'recovery' && this.stageTicks >= this.ticks(parameters.recovery)) {
      this.active = null;
      this.idleTicks = this.ticks(0.6 + this.random() * 0.2);
      this.enter('idle');
    }
  }

  private buildEchoPath(): void {
    const origin = this.recording[0];
    // The copied path is relative displacement, never an absolute teleport to the hero.
    this.echoPath = this.recording.map(point => add(this.echoOrigin, subtract(point, origin)));
    const firstMotion = this.echoPath.find(point => distance(point, this.echoOrigin) > EPSILON);
    if (firstMotion) this.bossFacing = normalized(subtract(firstMotion, this.echoOrigin));
  }

  private inSteam(parameters: Readonly<Record<string, number>>): boolean {
    const offset = subtract(this.heroPosition, this.bossPosition), radius = length(offset);
    if (radius > parameters.range + ARENA.heroRadius) return false;
    if (radius < ARENA.heroRadius) return true;
    const halfAngle = parameters.angle / 2 + Math.asin(Math.min(1, ARENA.heroRadius / radius));
    if (dot(this.bossFacing, normalized(offset)) < Math.cos(halfAngle)) return false;
    const hit = firstContact(this.bossPosition, offset, 0);
    return !(hit?.block && hit.t < 1 - EPSILON);
  }

  private steamBurstActive(parameters: Readonly<Record<string, number>>): boolean {
    if (this.stageTicks < 1) return false;
    const burstTicks = this.ticks(parameters.burstDuration), gapTicks = this.ticks(parameters.burstGap);
    const elapsed = this.stageTicks - 1;
    return Math.floor(elapsed / (burstTicks + gapTicks)) < parameters.bursts
      && elapsed % (burstTicks + gapTicks) < burstTicks;
  }

  private damageActive(): boolean {
    if (this.paused || this.outcome !== null || this.stage !== 'active' || this.stageTicks < 1 || !this.active || this.active.broken)
      return false;
    return this.active.recipe.mechanicId !== 'steam' || this.steamBurstActive(this.parameters());
  }

  private damageFromSweep(before: Vec2, after: Vec2, previousHero: Vec2): void {
    if (segmentDistance({ x: 0, z: 0 }, subtract(before, previousHero), subtract(after, this.heroPosition)) <= ARENA.heroRadius + ARENA.bossRadius)
      this.damageHero();
  }
  private damageHero(): void {
    if (this.tick < this.invulnerableUntil || this.tick < this.dodgeUntil || this.outcome !== null) return;
    this.heroHealth = Math.max(0, this.heroHealth - 1);
    this.invulnerableUntil = this.tick + this.ticks(COMBAT_TUNING.damageImmunity);
    this.emit('hero-damaged', this.active?.recipe.slotId ?? null, this.heroHealth);
    if (this.heroHealth === 0) this.resolve('lost');
  }
  private endAttack(): void {
    if (!this.attackOpen) return;
    this.attackOpen = false;
    this.emit('attack-ended');
  }
  private expose(): void { this.endAttack(); this.enter('exposed'); this.emit('flaw-exposed'); }
  private recover(): void { this.endAttack(); this.enter('recovery'); }
  private resolve(outcome: Outcome): void {
    this.endAttack();
    this.outcome = outcome;
    this.active = null;
    this.enter('finished');
    this.dodgeUntil = this.tick;
    this.strikeUntil = this.tick;
    this.emit('outcome', null, null, outcome);
  }

  private telegraph(): CombatSnapshot['boss']['telegraph'] {
    if (!this.active || !['recording', 'windup', 'active'].includes(this.stage) || this.active.broken) return null;
    const parameters = this.parameters(), family = this.active.recipe.mechanicId;
    if (family === 'charge') {
      const endpoint = moveCircle(this.bossPosition, scale(this.bossFacing, parameters.speed * parameters.duration), ARENA.bossRadius, false).position;
      return { kind: 'lane', direction: copy(this.bossFacing), points: [copy(this.bossPosition), endpoint], range: parameters.speed * parameters.duration, angle: 0 };
    }
    if (family === 'steam') return { kind: 'cone', direction: copy(this.bossFacing), points: [copy(this.bossPosition)], range: parameters.range, angle: parameters.angle };
    if (!this.echoTelegraphCache) {
      const source = this.stage === 'recording'
        ? this.recording.map(point => add(this.echoOrigin, subtract(point, this.recording[0]))) : this.echoPath;
      // Preview follows the same swept clipping as execution, stopping at its first collision.
      const points = [copy(this.echoOrigin)];
      for (let i = 1; i < source.length; i++) {
        const moved = moveCircle(points[points.length - 1], subtract(source[i], points[points.length - 1]), ARENA.bossRadius, false);
        points.push(moved.position);
        if (moved.block || moved.boundary) break;
      }
      this.echoTelegraphCache = { kind: 'trail', direction: copy(this.bossFacing), points,
        range: points.reduce((total, point, i) => i ? total + distance(point, points[i - 1]) : total, 0), angle: 0 };
    }
    // Only collision clipping is cached. Every public snapshot still owns its vectors
    // and point array, so consumer edits cannot corrupt this or a later snapshot.
    const cached = this.echoTelegraphCache;
    return { ...cached, direction: copy(cached.direction), points: cached.points.map(copy) };
  }
}
