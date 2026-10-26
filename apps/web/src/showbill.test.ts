import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { creditLabel, makeModule, makeRecipe, validateRecipe } from '@aragoz/contracts';
import type { BossRecipe, EncounterResult } from '@aragoz/contracts';
import { showbillEntries } from './showbill';
import { ShowbillHistory } from './components';

async function recipe(act:number):Promise<BossRecipe>{
  return makeRecipe({roomId:'show-one',actId:'act-'+act,seed:act,bodyId:act===2?'mirror':'teapot',modules:[makeModule('charge-deliberate','left','proposal-'+act,{source:'viewer',authorId:'author-'+act,displayName:'Viewer '+act,hidden:false}),makeModule('steam-narrow','right')]});
}
function result(r:BossRecipe,act:number,attempt:string):EncounterResult{return {attemptId:attempt,recipeId:r.id,recipeHash:r.hash,actIndex:act,outcome:'won',durationTicks:600,brokenSlots:['left','right'],exploits:3,finishedAt:'2026-10-26T00:00:00.000Z'};}

describe('complete showbill attribution',()=>{
  it('links every act and Encore only by both immutable recipe identifiers',async()=>{
    const recipes=await Promise.all([recipe(1),recipe(2),recipe(3)]);
    const outcomes=[...recipes.map((r,i)=>result(r,i+1,'attempt-'+i)),result(recipes[0],1,'encore')];
    outcomes.push({...result(recipes[0],2,'wrong-hash'),recipeHash:recipes[1].hash});
    outcomes.push({...result(recipes[1],2,'wrong-id'),recipeId:recipes[0].id});
    const entries=showbillEntries('show-one',[...recipes,recipes[0],{...recipes[1],roomId:'other-show'}],outcomes);
    expect(entries).toHaveLength(3);expect(entries.map(e=>e.results.length)).toEqual([2,1,1]);
    expect(entries[0].results.map(r=>r.attemptId)).toEqual(['attempt-0','encore']);
  });
  it('renders all historical authors and outcomes, then hides every viewer name without changing recipes',async()=>{
    const recipes=await Promise.all([recipe(1),recipe(2),recipe(3)]),outcomes=recipes.map((r,i)=>result(r,i+1,'attempt-'+i));
    const before=recipes.map(r=>r.hash);
    const props={roomId:'show-one',recipes,results:outcomes,hideAuthors:false};
    const visible=renderToStaticMarkup(createElement(ShowbillHistory,props));
    for(const name of ['Viewer 1','Viewer 2','Viewer 3'])expect(visible).toContain(name);
    expect(visible.match(/modules broken/g)).toHaveLength(3);
    const hidden=renderToStaticMarkup(createElement(ShowbillHistory,{...props,hideAuthors:true}));
    for(const name of ['Viewer 1','Viewer 2','Viewer 3'])expect(hidden).not.toContain(name);
    expect(hidden).toContain('Audience author');expect(hidden).toContain('House Suggestion');expect(recipes.map(r=>r.hash)).toEqual(before);
  });
  it('restores a name hidden at commit time using the current preference without changing the contract',async()=>{
    const committed=await makeRecipe({roomId:'show-one',actId:'act-hidden',seed:4,modules:[makeModule('charge-deliberate','left','proposal-hidden',{source:'viewer',authorId:'author-hidden',displayName:'Original viewer',hidden:true}),makeModule('steam-narrow','right')]});
    const original=JSON.stringify(committed),props={roomId:'show-one',recipes:[committed],results:[],hideAuthors:false};
    expect(creditLabel(committed.modules[0].credit)).toBe('Audience author');
    expect(renderToStaticMarkup(createElement(ShowbillHistory,props))).toContain('Original viewer');
    expect(renderToStaticMarkup(createElement(ShowbillHistory,{...props,hideAuthors:true}))).not.toContain('Original viewer');
    expect(JSON.stringify(committed)).toBe(original);await expect(validateRecipe(committed)).resolves.toEqual(committed);
  });
});
