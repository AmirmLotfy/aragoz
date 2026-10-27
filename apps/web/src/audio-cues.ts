import type { CombatSnapshot } from '@aragoz/combat';
import type { SlotId } from '@aragoz/contracts';

export type AudioTell = 'charge-windup' | 'steam-windup' | 'echo-recording' | 'echo-warning';
export interface AudioCue { kind: AudioTell; slot: SlotId; }
export interface AudioCueFrame { active: AudioCue | null; trigger: AudioCue | null; }
const PULSE_TICKS: Record<AudioTell, number> = {
  'charge-windup': 18, 'steam-windup': 24, 'echo-recording': 30, 'echo-warning': 12,
};

/** Reads fixed simulation stages. It never schedules a future attack or advances combat. */
export class AudioCuePlanner {
  private key: string | null = null;
  private pulse = -1;
  update(snapshot: CombatSnapshot): AudioCueFrame {
    const module = snapshot.modules.find(item => item.slotId === snapshot.boss.activeSlot && !item.broken);
    let kind: AudioTell | null = null;
    if (module && !snapshot.outcome) {
      if (snapshot.boss.stage === 'recording' && module.mechanicId === 'echo') kind = 'echo-recording';
      if (snapshot.boss.stage === 'windup') kind = module.mechanicId === 'echo' ? 'echo-warning' : `${module.mechanicId}-windup`;
    }
    const active = kind && module ? { kind, slot: module.slotId } : null;
    const key = active ? `${active.slot}:${active.kind}` : null;
    const pulse = kind ? Math.floor((snapshot.boss.phaseTime * 60 + 0.000001) / PULSE_TICKS[kind]) : -1;
    const changed = key !== this.key || pulse !== this.pulse;
    this.key = key; this.pulse = pulse;
    // Pausing, muting and missed callbacks never create a catch-up queue. A resumed
    // phase continues at its next fixed-tick pulse, rather than replaying its onset.
    if (snapshot.paused) return { active: null, trigger: null };
    return { active, trigger: changed ? active : null };
  }
}
