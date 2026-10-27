import type { ProfileId } from '@aragoz/contracts';

// Hand-authored short display copy for the shipped contracts. Full immutable
// rules remain in the recipe, backstage review, opening card and showbill.
export const STREAM_COPY: Record<ProfileId,{power:string;flaw:string;tradeoff:string}>={
  'charge-deliberate':{power:'Charges fast',flaw:'Cannot turn. Blocks jam its axle',tradeoff:'Fast roll · longer warning'},
  'charge-snappy':{power:'Charges sooner',flaw:'Cannot turn. Blocks jam its axle',tradeoff:'Slower roll · shorter warning'},
  'steam-narrow':{power:'3 narrow bursts',flaw:'Overheats. Strike the lifted valve',tradeoff:'Narrow cone · longer bursts'},
  'steam-wide':{power:'2 wide bursts',flaw:'Overheats. Strike the lifted valve',tradeoff:'Wide cone · shorter bursts'},
  'echo-short':{power:'Copies 1 second',flaw:'Copies your route. Blocks expose it',tradeoff:'Short recording · short warning'},
  'echo-long':{power:'Copies 2 seconds',flaw:'Copies your route. Blocks expose it',tradeoff:'Long recording · longer warning'},
};
