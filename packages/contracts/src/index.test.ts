import { describe,expect,it } from 'vitest';
import { BossRecipeSchema,canonicalJson,creditLabel,makeModule,makeRecipe,moduleWorldPosition,recipeHash,sanitizeText,validateRecipe } from './index';

describe('executable recipe admission',()=>{
  it('accepts shipped pairs and verifies a canonical SHA256 digest',async()=>{
    const recipe=await makeRecipe({roomId:'room',actId:'act',seed:10,modules:[makeModule('charge-deliberate','left'),makeModule('steam-wide','right')]});
    expect(await validateRecipe(recipe)).toEqual(recipe);expect(await recipeHash(recipe)).toBe(recipe.hash);
    expect(canonicalJson({b:2,a:1})).toBe(canonicalJson({a:1,b:2}));
  });
  it('rejects an altered parameter even if someone recomputes its hash',async()=>{
    const recipe=await makeRecipe({roomId:'room',actId:'act',seed:10,modules:[makeModule('charge-snappy','left'),makeModule('echo-long','right')]});
    recipe.modules[0].approvedParameters.speed=999;
    recipe.hash=await recipeHash(recipe);expect(()=>BossRecipeSchema.parse(recipe)).toThrow();
  });
  it('rejects duplicate families, missing flaws and damaged digests',async()=>{
    await expect(makeRecipe({roomId:'room',actId:'act',seed:10,modules:[makeModule('charge-snappy','left'),makeModule('charge-deliberate','right')]})).rejects.toThrow();
    const recipe=await makeRecipe({roomId:'room',actId:'act',seed:10,modules:[makeModule('steam-narrow','left'),makeModule('echo-short','right')]});
    recipe.hash='0'.repeat(64);await expect(validateRecipe(recipe)).rejects.toThrow('hash');
    expect(()=>BossRecipeSchema.parse({...recipe,modules:[{...recipe.modules[0],exposureRuleId:''},recipe.modules[1]]})).toThrow();
  });
  it('keeps House identity honest and requires viewer lineage',()=>{
    expect(()=>makeModule('charge-snappy','left',null,{authorId:'fake',displayName:'Pretend Viewer',source:'house',hidden:false})).toThrow();
    expect(()=>makeModule('charge-snappy','left',null,{authorId:'123',displayName:'A viewer',source:'viewer',hidden:false})).toThrow();
    expect(creditLabel({authorId:null,displayName:'unused',source:'house',hidden:true})).toBe('House Suggestion');
  });
  it('admits only shipped art versions and matching shell identities',async()=>{
    const recipe=await makeRecipe({roomId:'room',actId:'act',seed:10,modules:[makeModule('charge-deliberate','left'),makeModule('steam-wide','right')]});
    expect(()=>BossRecipeSchema.parse({...recipe,artKitVersion:'unshipped-kit'})).toThrow();
    expect(()=>BossRecipeSchema.parse({...recipe,approvedName:'Mirror Braggart'})).toThrow();
    const legacy={...recipe,artKitVersion:'greybox-1' as const};legacy.hash=await recipeHash(legacy);
    expect(await validateRecipe(legacy)).toEqual(legacy);
  });
  it('uses the same rotated sockets as the rendered anatomy',()=>{
    expect(moduleWorldPosition({x:0,z:0},{x:0,z:1},'left')).toEqual({x:-1.05,z:0.2});
    const turned=moduleWorldPosition({x:3,z:2},{x:1,z:0},'left');expect(turned.x).toBeCloseTo(3.2);expect(turned.z).toBeCloseTo(3.05);
  });
  it('removes control and bidi-spoofing characters while preserving Arabic letters',()=>{
    expect(sanitizeText('  أراجوز\u202e <stage>  ')).toBe('أراجوز stage');expect(sanitizeText('a'.repeat(500))).toHaveLength(280);
  });
});
