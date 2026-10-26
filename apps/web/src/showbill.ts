import type { BossRecipe, EncounterResult } from '@aragoz/contracts';

export interface ShowbillEntry { recipe: BossRecipe; results: EncounterResult[]; }
/** Recipe identity is a compound relation, never inferred from act number or array order. */
export function showbillEntries(roomId: string, recipes: BossRecipe[], results: EncounterResult[]): ShowbillEntry[] {
  const seen = new Set<string>();
  return recipes.filter(recipe => {
    const identity = recipe.id + ':' + recipe.hash;
    if (recipe.roomId !== roomId || seen.has(identity)) return false;
    seen.add(identity);return true;
  }).map(recipe => ({ recipe, results: results.filter(result => result.recipeId === recipe.id && result.recipeHash === recipe.hash) }));
}
