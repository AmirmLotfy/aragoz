import { describe, expect, it } from 'vitest';
import { canBindKey, controlDescription, DEFAULT_KEYS, normalizeKeyBindings, ownsGameKeyboard } from './controls';

describe('game control ownership and saved mappings',()=>{
  const active={paused:false,focused:true,defaultPrevented:false,altKey:false,ctrlKey:false,metaKey:false};
  it('leaves paused previews, unfocused menus and browser shortcuts to the browser',()=>{
    expect(ownsGameKeyboard(active)).toBe(true);
    for(const patch of [{paused:true},{focused:false},{defaultPrevented:true},{altKey:true},{ctrlKey:true},{metaKey:true}])expect(ownsGameKeyboard({...active,...patch})).toBe(false);
  });
  it('keeps hardwired arrow directions out of conflicting remaps',()=>{
    expect(canBindKey('strike','ArrowLeft',DEFAULT_KEYS)).toBe(false);
    expect(canBindKey('dodge','ArrowUp',DEFAULT_KEYS)).toBe(false);
    expect(canBindKey('left','ArrowRight',DEFAULT_KEYS)).toBe(false);
    expect(canBindKey('left','ArrowLeft',DEFAULT_KEYS)).toBe(true);
    expect(canBindKey('strike','KeyW',DEFAULT_KEYS)).toBe(false);
    expect(canBindKey('strike','Escape',DEFAULT_KEYS)).toBe(false);
    expect(canBindKey('strike','KeyK',DEFAULT_KEYS)).toBe(true);
  });
  it('repairs old collisions, including chains created by restoring a default',()=>{
    const keys=normalizeKeyBindings({up:'KeyS',down:'ArrowUp',left:'KeyW',right:'KeyW',strike:'ArrowLeft',dodge:'Escape'});
    expect(new Set(Object.values(keys)).size).toBe(6);
    expect(keys).toEqual(DEFAULT_KEYS);
    expect(normalizeKeyBindings({up:'KeyJ',strike:'KeyW'})).toMatchObject({up:'KeyJ',strike:'KeyW'});
  });
  it('describes the actual remapped keys for visible and spoken instructions',()=>{
    const text=controlDescription({...DEFAULT_KEYS,up:'KeyI',left:'KeyL',strike:'KeyK',dodge:'ShiftLeft'});
    expect(text).toContain('I / L / S / D');expect(text).toContain('mouse or K');expect(text).toContain('Dodge with ShiftLeft');expect(text).not.toContain('mouse or J');
  });
});
