import { describe, expect, it } from 'vitest';
import { MODULE_SOCKET_OFFSETS } from '@aragoz/contracts';
import type { SlotId } from '@aragoz/contracts';
import { ASSEMBLY_DURATION_MS, REDUCED_ASSEMBLY_DURATION_MS, assemblyProgress, moduleAssemblyTransform } from './assembly';

describe('physical module assembly',()=>{
  it('moves the left attachment from the wing before moving the right attachment',()=>{
    const leftStart=moduleAssemblyTransform('left',0,false),rightStart=moduleAssemblyTransform('right',0,false);
    expect(leftStart.x).toBeLessThan(-6);expect(rightStart.x).toBeGreaterThan(6);
    expect(moduleAssemblyTransform('left',0.25,false).x).toBeGreaterThan(leftStart.x);
    expect(moduleAssemblyTransform('right',0.25,false)).toEqual(rightStart);
    expect(moduleAssemblyTransform('left',0.5,false)).toEqual({...MODULE_SOCKET_OFFSETS.left,y:0,rotationZ:0});
    expect(moduleAssemblyTransform('right',0.75,false).x).toBeLessThan(rightStart.x);
  });

  it('finishes at the exact combat sockets without a residual lift or rotation',()=>{
    for(const slot of ['left','right'] as SlotId[]){
      const socket={...MODULE_SOCKET_OFFSETS[slot],y:0,rotationZ:0};
      expect(moduleAssemblyTransform(slot,1,false)).toEqual(socket);
      expect(moduleAssemblyTransform(slot,2,false)).toEqual(socket);
    }
    expect(assemblyProgress(0,false)).toBe(0);
    expect(assemblyProgress(ASSEMBLY_DURATION_MS/2,false)).toBe(0.5);
    expect(assemblyProgress(ASSEMBLY_DURATION_MS,false)).toBe(1);
    expect(assemblyProgress(-10,false)).toBe(0);
    expect(assemblyProgress(ASSEMBLY_DURATION_MS+500,false)).toBe(1);
  });

  it('seats both reduced-motion attachments without travel within 150ms',()=>{
    expect(REDUCED_ASSEMBLY_DURATION_MS).toBeLessThanOrEqual(150);
    for(const slot of ['left','right'] as SlotId[]){
      for(const progress of [0,0.25,0.75,1])expect(moduleAssemblyTransform(slot,progress,true)).toEqual({...MODULE_SOCKET_OFFSETS[slot],y:0,rotationZ:0});
    }
    expect(assemblyProgress(REDUCED_ASSEMBLY_DURATION_MS,true)).toBe(1);
    expect(assemblyProgress(REDUCED_ASSEMBLY_DURATION_MS,false)).toBeLessThan(1);
  });
});
