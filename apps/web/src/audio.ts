import type { EncounterEvent } from '@aragoz/contracts';
import type { Preferences } from './settings';
// Original procedural Foley and a sparse authored percussion pattern. No samples or borrowed songs.
export class StageAudio {
  private context: AudioContext | null = null;
  private musicTimer: ReturnType<typeof setInterval> | null = null;
  private beat = 0;
  constructor(private preferences: Preferences) {}
  setPreferences(p: Preferences): void { this.preferences = p; }
  async unlock(): Promise<void> {
    this.context ??= new AudioContext();
    await this.context.resume();
    if (!this.musicTimer) this.musicTimer = setInterval(() => {
      if (this.preferences.muted || this.preferences.music === 0 || this.context?.state !== 'running') return;
      const pattern = [85, 0, 160, 0, 110, 0, 160, 0, 85, 0, 0, 160, 110, 0, 0, 0];
      const f = pattern[this.beat++ % pattern.length]; if (f) this.tone(f, 0.09, this.preferences.music * 0.12, 'sine');
    }, 260);
  }
  event(e: EncounterEvent): void {
    if (!this.context || this.preferences.muted) return;
    const gain = this.preferences.sfx * 0.2;
    if (e.kind === 'attack-started') this.tone(140, 0.13, gain, 'triangle');
    if (e.kind === 'flaw-exposed') { this.tone(510, 0.15, gain, 'sine'); this.tone(760, 0.15, gain * 0.6, 'triangle', 0.08); }
    if (e.kind === 'module-broken') { this.noise(0.22, gain); this.tone(95, 0.22, gain, 'triangle'); }
    if (e.kind === 'hero-damaged') this.tone(70, 0.12, gain, 'sawtooth');
    if (e.kind === 'outcome') this.tone(e.outcome === 'won' ? 660 : 120, 0.4, gain, 'triangle');
  }
  private tone(frequency: number, seconds: number, volume: number, type: OscillatorType, delay = 0): void {
    const c = this.context; if (!c) return;
    const oscillator = c.createOscillator(), gain = c.createGain(), start = c.currentTime + delay;
    oscillator.type = type; oscillator.frequency.setValueAtTime(frequency, start); oscillator.frequency.exponentialRampToValueAtTime(frequency * 0.72, start + seconds);
    gain.gain.setValueAtTime(Math.max(0.0001, volume), start); gain.gain.exponentialRampToValueAtTime(0.0001, start + seconds);
    oscillator.connect(gain).connect(c.destination); oscillator.start(start); oscillator.stop(start + seconds + 0.01);
  }
  private noise(seconds: number, volume: number): void {
    const c = this.context; if (!c) return;
    const buffer = c.createBuffer(1, Math.ceil(c.sampleRate * seconds), c.sampleRate), data = buffer.getChannelData(0);
    let seed = 71; for (let i=0; i<data.length; i++) { seed = (seed * 1664525 + 1013904223) >>> 0; data[i] = (seed / 0xffffffff * 2 - 1) * (1 - i/data.length) ** 3; }
    const source = c.createBufferSource(), gain = c.createGain(); source.buffer = buffer; gain.gain.value = volume;
    source.connect(gain).connect(c.destination); source.start();
  }
  dispose(): void { if (this.musicTimer) clearInterval(this.musicTimer); this.musicTimer = null; void this.context?.close(); this.context = null; }
}
