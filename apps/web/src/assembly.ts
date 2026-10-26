import { MODULE_SOCKET_OFFSETS } from '@aragoz/contracts';
import type { SlotId } from '@aragoz/contracts';

export const ASSEMBLY_DURATION_MS = 1600;
export const REDUCED_ASSEMBLY_DURATION_MS = 120;

/** Presentation time begins after asset admission, independently of combat/server ticks. */
export function assemblyProgress(elapsedMs:number,reducedMotion:boolean):number {
  const duration=reducedMotion?REDUCED_ASSEMBLY_DURATION_MS:ASSEMBLY_DURATION_MS;
  return Math.max(0,Math.min(1,elapsedMs/duration));
}

/** Socket-local travel: the left attachment seats before the right leaves its wing. */
export function moduleAssemblyTransform(slot:SlotId,progress:number,reducedMotion:boolean):{x:number;y:number;z:number;rotationZ:number} {
  const socket=MODULE_SOCKET_OFFSETS[slot];
  if(reducedMotion||progress>=1)return{x:socket.x,y:0,z:socket.z,rotationZ:0};
  const seated=Math.max(0,Math.min(1,progress*2-(slot==='right'?1:0)));
  if(seated===1)return{x:socket.x,y:0,z:socket.z,rotationZ:0};
  const remaining=(1-seated)**3,side=slot==='left'?-1:1;
  return{x:socket.x+(side*6.3-socket.x)*remaining,y:Math.sin(seated*Math.PI)*0.35,z:socket.z,rotationZ:-side*0.18*remaining};
}
