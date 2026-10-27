import type { CombatSnapshot } from '@aragoz/combat';
import type { EncounterEvent } from '@aragoz/contracts';
import type { Preferences } from './settings';
import { AudioCuePlanner } from './audio-cues';
import type { AudioCue, AudioTell } from './audio-cues';

type Channel = 'music' | 'sfx' | 'tell';
interface Voice { source: AudioScheduledSourceNode; gain: GainNode; channel: Channel; }

// Original procedural Foley and a sparse authored percussion pattern. No samples or borrowed songs.
export class StageAudio {
  private context: AudioContext | null = null;
  private musicBus: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private musicTimer: ReturnType<typeof setInterval> | null = null;
  private voices = new Set<Voice>();
  private planner = new AudioCuePlanner();
  private activeTell: AudioCue | null = null;
  private paused = true;
  private ended = false;
  private disposed = false;
  private beat = 0;
  constructor(private preferences: Preferences) {}
  setPreferences(p: Preferences): void {
    this.preferences = p;
    this.updateVolumes();
    if (p.muted || p.sfx === 0) this.stopVoices(voice => voice.channel !== 'music');
    if (p.muted || p.music === 0) this.stopVoices(voice => voice.channel === 'music');
  }
  /** Keep gestures available after muted starts, unmute, or browser suspension. */
  listenForGestures(target: EventTarget): () => void {
    const unlock = () => { void this.unlock(); };
    target.addEventListener('pointerdown', unlock);
    target.addEventListener('keydown', unlock);
    return () => { target.removeEventListener('pointerdown', unlock); target.removeEventListener('keydown', unlock); };
  }
  async unlock(): Promise<void> {
    if (this.disposed) return;
    // Muted automation does not even create an audio device/context.
    if (this.preferences.muted || (this.preferences.music === 0 && this.preferences.sfx === 0)) return;
    if (this.context?.state === 'running' && this.musicTimer) return;
    try {
      if (!this.context) {
        this.context = new AudioContext();
        this.musicBus = this.context.createGain(); this.musicBus.connect(this.context.destination);
        this.sfxBus = this.context.createGain(); this.sfxBus.connect(this.context.destination);
        this.updateVolumes();
      }
      if (this.context.state !== 'running') await this.context.resume();
      if (this.disposed || this.musicTimer) return;
      this.musicTimer = setInterval(() => {
        if (!this.canPlay('music')) return;
        const pattern = [85, 0, 160, 0, 110, 0, 160, 0, 85, 0, 0, 160, 110, 0, 0, 0];
        const frequency = pattern[this.beat++ % pattern.length];
        if (frequency) this.tone(frequency, 0.09, 0.12, 'sine', 'music');
      }, 260);
    } catch { /* Audio device/autoplay failure must never interrupt the simulation. */ }
  }
  /** Call after each fixed step, and on paused frames. No wall-clock tell timers. */
  sync(snapshot: CombatSnapshot): void {
    const wasPaused = this.paused, wasEnded = this.ended;
    this.paused = snapshot.paused; this.ended = snapshot.outcome !== null;
    const frame = this.planner.update(snapshot);
    if ((this.paused && !wasPaused) || (this.ended && !wasEnded)) this.stopVoices(() => true);
    else if (frame.active?.kind !== this.activeTell?.kind || frame.active?.slot !== this.activeTell?.slot)
      this.stopVoices(voice => voice.channel === 'tell');
    this.activeTell = frame.active;
    if (frame.trigger && this.canPlay('tell')) this.tell(frame.trigger.kind);
  }
  event(e: EncounterEvent): void {
    if (e.kind === 'module-broken') this.stopVoices(voice => voice.channel === 'tell');
    if (e.kind === 'outcome') { this.ended = true; this.stopVoices(() => true); }
    if (!this.context || this.preferences.muted || this.preferences.sfx === 0 || this.paused) return;
    // Activation/windup sounds come from sync(), before attack-started. The latter
    // is deliberately silent: it marks the end of the warning, not its beginning.
    if (e.kind === 'flaw-exposed') { this.tone(510, 0.15, 0.2, 'sine'); this.tone(760, 0.15, 0.12, 'triangle'); }
    if (e.kind === 'module-broken') { this.noise(0.22, 0.2); this.tone(95, 0.22, 0.2, 'triangle'); }
    if (e.kind === 'hero-damaged') this.tone(70, 0.12, 0.2, 'sawtooth');
    if (e.kind === 'outcome') this.tone(e.outcome === 'won' ? 660 : 120, 0.4, 0.2, 'triangle', 'sfx', true);
  }
  private tell(kind: AudioTell): void {
    // Charge: dry low ratchet. Steam: filtered pressure hiss and kettle rattle.
    // Echo records with a hollow high ping, then warns with a brisk dissonant pair.
    if (kind === 'charge-windup') { this.tone(115, 0.11, 0.18, 'triangle', 'tell', false, 210); this.noise(0.035, 0.08, 'tell', 650); }
    if (kind === 'steam-windup') { this.noise(0.18, 0.14, 'tell', 2200); this.tone(330, 0.07, 0.08, 'square', 'tell'); }
    if (kind === 'echo-recording') { this.tone(880, 0.14, 0.10, 'sine', 'tell'); this.tone(1320, 0.09, 0.05, 'sine', 'tell'); }
    if (kind === 'echo-warning') { this.tone(620, 0.08, 0.13, 'triangle', 'tell'); this.tone(930, 0.08, 0.08, 'square', 'tell'); }
  }
  private canPlay(channel: Channel, allowOutcome = false): boolean {
    return !this.disposed && !this.paused && (!this.ended || allowOutcome) && !this.preferences.muted
      && (channel === 'music' ? this.preferences.music : this.preferences.sfx) > 0 && this.context?.state === 'running';
  }
  private updateVolumes(): void {
    if (!this.context) return;
    this.musicBus?.gain.setValueAtTime(this.preferences.muted ? 0 : this.preferences.music, this.context.currentTime);
    this.sfxBus?.gain.setValueAtTime(this.preferences.muted ? 0 : this.preferences.sfx, this.context.currentTime);
  }
  private play(source: AudioScheduledSourceNode, gain: GainNode, channel: Channel, seconds: number): void {
    const context = this.context, bus = channel === 'music' ? this.musicBus : this.sfxBus;
    if (!context || !bus) return;
    const voice: Voice = { source, gain, channel }; this.voices.add(voice);
    source.connect(gain).connect(bus);
    source.onended = () => { source.disconnect(); gain.disconnect(); this.voices.delete(voice); };
    source.start(context.currentTime); source.stop(context.currentTime + seconds);
  }
  private tone(frequency: number, seconds: number, volume: number, type: OscillatorType,
    channel: Channel = 'sfx', allowOutcome = false, endFrequency = frequency * 0.72): void {
    const context = this.context; if (!context || !this.canPlay(channel, allowOutcome)) return;
    const oscillator = context.createOscillator(), gain = context.createGain(), start = context.currentTime;
    oscillator.type = type; oscillator.frequency.setValueAtTime(frequency, start);
    oscillator.frequency.exponentialRampToValueAtTime(endFrequency, start + seconds);
    gain.gain.setValueAtTime(volume, start); gain.gain.exponentialRampToValueAtTime(0.0001, start + seconds);
    this.play(oscillator, gain, channel, seconds);
  }
  private noise(seconds: number, volume: number, channel: Channel = 'sfx', lowpass?: number): void {
    const context = this.context; if (!context || !this.canPlay(channel)) return;
    const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * seconds), context.sampleRate), data = buffer.getChannelData(0);
    let seed = 71;
    for (let i = 0; i < data.length; i++) { seed = (seed * 1664525 + 1013904223) >>> 0; data[i] = (seed / 0xffffffff * 2 - 1) * (1 - i / data.length) ** 3; }
    const source = context.createBufferSource(), gain = context.createGain(); source.buffer = buffer; gain.gain.value = volume;
    // The buffer is filtered before playback; no extra live node survives cancellation.
    if (lowpass) {
      const alpha = 1 - Math.exp(-2 * Math.PI * lowpass / context.sampleRate);
      let previous = 0; for (let i = 0; i < data.length; i++) { previous += alpha * (data[i] - previous); data[i] = previous; }
    }
    this.play(source, gain, channel, seconds);
  }
  private stopVoices(predicate: (voice: Voice) => boolean): void {
    for (const voice of this.voices) if (predicate(voice)) {
      try { voice.source.stop(); } catch { /* Already ended. */ }
      voice.source.disconnect(); voice.gain.disconnect(); this.voices.delete(voice);
    }
  }
  dispose(): void {
    this.disposed = true;
    if (this.musicTimer) clearInterval(this.musicTimer); this.musicTimer = null;
    this.stopVoices(() => true); void this.context?.close(); this.context = null;
    this.musicBus = null; this.sfxBus = null;
  }
}
