import { describe, expect, it } from 'vitest';
import { PresentationClock } from './presentation';

describe('presentation deadlines',()=>{
  it('does not skip a healthy frame following one slightly late callback',()=>{
    const clock=new PresentationClock(0,60);
    expect(clock.due(18,60)).toBe(true);
    expect(clock.due(100/3,60)).toBe(true);
    expect(clock.due(50,60)).toBe(true);
  });
  it('presents60frames on a120Hz display without drawing on every callback',()=>{
    const clock=new PresentationClock(0,60),presented:number[]=[];
    for(let frame=1;frame<=120;frame++)if(clock.due(frame*1000/120,60))presented.push(frame);
    expect(presented).toHaveLength(60);expect(presented.slice(0,4)).toEqual([2,4,6,8]);
  });
  it('keeps the explicit30fps and paused15fps presentation cadences',()=>{
    for(const fps of [15,30]){const clock=new PresentationClock(0,fps);let frames=0;
      for(let frame=1;frame<=60;frame++)if(clock.due(frame*1000/60,fps))frames++;
      expect(frames).toBe(fps);
    }
  });
  it('skips missed slots after a stall without drawing a catch-up burst',()=>{
    const clock=new PresentationClock(0,60);
    expect(clock.due(200,60)).toBe(true);expect(clock.due(200.1,60)).toBe(false);
    expect(clock.due(650/3,60)).toBe(true);
  });
  it('presents immediately when switching pause or fallback cadence',()=>{
    const clock=new PresentationClock(0,15);
    expect(clock.due(10,15)).toBe(false);expect(clock.due(10,60)).toBe(true);
    expect(clock.due(16,60)).toBe(false);expect(clock.due(80/3,60)).toBe(true);
    expect(clock.due(27,30)).toBe(true);expect(clock.due(43,30)).toBe(false);
    expect(clock.due(181/3,30)).toBe(true);expect(clock.due(62,15)).toBe(true);
  });
  it('allows one final assembly frame without moving the combat clock',()=>{
    const clock=new PresentationClock(0,60);
    expect(clock.due(5,60,true)).toBe(true);expect(clock.due(7,60)).toBe(false);
    expect(clock.due(65/3,60)).toBe(true);
  });
});
