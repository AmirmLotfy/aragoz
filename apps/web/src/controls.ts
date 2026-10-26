export const DEFAULT_KEYS = { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', strike: 'KeyJ', dodge: 'Space' };
export type KeyBindings = typeof DEFAULT_KEYS;
export type KeyAction = keyof KeyBindings;
const ACTIONS = Object.keys(DEFAULT_KEYS) as KeyAction[];
const ARROW_ACTIONS: Record<string, KeyAction> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
const RESERVED = new Set(['Tab', 'Escape', 'MetaLeft', 'MetaRight', 'ControlLeft', 'ControlRight', 'AltLeft', 'AltRight']);

function validKey(action: KeyAction, code: unknown): code is string {
  return typeof code === 'string' && /^[A-Za-z0-9]{1,20}$/.test(code) && !RESERVED.has(code)
    && (!(code in ARROW_ACTIONS) || ARROW_ACTIONS[code] === action);
}
export function canBindKey(action: KeyAction, code: string, keys: KeyBindings): boolean {
  return validKey(action, code) && !ACTIONS.some(other => other !== action && keys[other] === code);
}
/** Older saved preferences may contain collisions that the current editor prevents. */
export function normalizeKeyBindings(value: unknown): KeyBindings {
  const source = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const keys = { ...DEFAULT_KEYS };
  for (const action of ACTIONS) { const candidate=source[action];if (validKey(action, candidate)) keys[action] = candidate; }
  // Reset every member of a collision together. Repeating also resolves a custom key
  // which used a default that has just been restored; six actions bound this pass.
  for (let pass = 0; pass < ACTIONS.length; pass++) {
    const collisions = ACTIONS.filter(action => ACTIONS.some(other => other !== action && keys[other] === keys[action]));
    if (!collisions.length) break;
    for (const action of collisions) keys[action] = DEFAULT_KEYS[action];
  }
  return keys;
}
export function keyLabel(key: string): string { return key.replace(/^Key/, '').replace(/^Digit/, '').replace(/^Arrow/, ''); }
export function movementKeyLabel(keys: KeyBindings): string { return [keys.up, keys.left, keys.down, keys.right].map(keyLabel).join(' / '); }
export function controlDescription(keys: KeyBindings): string {
  return `Move with ${movementKeyLabel(keys)} or arrow keys. Strike with mouse or ${keyLabel(keys.strike)}. Dodge with ${keyLabel(keys.dodge)}. Escape pauses.`;
}
export function ownsGameKeyboard(input: { paused: boolean; focused: boolean; defaultPrevented: boolean; altKey: boolean; ctrlKey: boolean; metaKey: boolean }): boolean {
  return !input.paused && input.focused && !input.defaultPrevented && !input.altKey && !input.ctrlKey && !input.metaKey;
}
