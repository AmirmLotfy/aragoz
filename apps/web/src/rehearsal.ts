import { makeModule, makeRecipe } from '@aragoz/contracts';
import type { BossRecipe, ProfileId } from '@aragoz/contracts';
export const REHEARSALS: { id: string; title: string; profiles:[ProfileId,ProfileId]; body:'teapot'|'mirror'; description:string }[] = [
  { id:'kettle',title:'The Teapot Tyrant',profiles:['charge-deliberate','steam-wide'],body:'teapot',description:'Bait the axle into a stage block. Wait for the kettle to overheat.' },
  { id:'echo',title:'The Copycat’s Comeback',profiles:['charge-snappy','echo-long'],body:'mirror',description:'Write a bad route for the mirror. Make its own imitation betray it.' },
  { id:'steam-echo',title:'A Very Bad Reflection',profiles:['steam-narrow','echo-short'],body:'mirror',description:'A kettle that runs hot. A mirror that cannot improvise.' },
];
export async function rehearsalRecipe(presetIndex:number,actIndex=1):Promise<BossRecipe>{
  const p=REHEARSALS[((presetIndex%REHEARSALS.length)+REHEARSALS.length)%REHEARSALS.length];
  return makeRecipe({roomId:'rehearsal',actId:'rehearsal-act-'+actIndex,seed:2901+actIndex*17+presetIndex,bodyId:p.body,difficultyPreset:'rehearsal',modules:[makeModule(p.profiles[0],'left'),makeModule(p.profiles[1],'right')]});
}
