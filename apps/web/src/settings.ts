import { DEFAULT_KEYS, normalizeKeyBindings } from './controls';
import type { KeyBindings } from './controls';
export { keyLabel } from './controls';

export interface Preferences {
  music: number; sfx: number; muted: boolean; reducedMotion: boolean; reducedFlashes: boolean; shake: number;
  quality: 'high' | 'low'; presentationFps: 60 | 30; aimAssist: boolean; webcamCorner: 'bottom-right' | 'bottom-left' | 'top-right' | 'none';
  keys: KeyBindings;
}
export function defaultPreferences(): Preferences {
  return { music: 0.16, sfx: 0.5, muted: false, reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    reducedFlashes: true, shake: 0.1, quality: 'high', presentationFps: 60, aimAssist: true, webcamCorner: 'bottom-right',
    keys: { ...DEFAULT_KEYS } };
}
export function loadPreferences(): Preferences {
  const defaults = defaultPreferences();
  try { const saved = JSON.parse(localStorage.getItem('aragoz.preferences.v1') ?? 'null');
    if (!saved || typeof saved !== 'object') return defaults;
    return { ...defaults, music: clamp(saved.music, defaults.music), sfx: clamp(saved.sfx, defaults.sfx), muted: saved.muted === true,
      reducedMotion: typeof saved.reducedMotion==='boolean'?saved.reducedMotion:defaults.reducedMotion, reducedFlashes: saved.reducedFlashes !== false, shake: Math.min(0.3,clamp(saved.shake, 0.1)),
      quality: saved.quality === 'low' ? 'low' : 'high', presentationFps: saved.presentationFps === 30 ? 30 : 60,
      aimAssist: saved.aimAssist !== false, webcamCorner: ['bottom-left', 'top-right', 'none'].includes(saved.webcamCorner) ? saved.webcamCorner : 'bottom-right',
      keys: normalizeKeyBindings(saved.keys) };
  } catch { return defaults; }
}
function clamp(value: unknown, fallback: number): number { return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : fallback; }
export function savePreferences(p: Preferences): void { try { localStorage.setItem('aragoz.preferences.v1', JSON.stringify(p)); } catch { /* Preference persistence is optional. */ } }
