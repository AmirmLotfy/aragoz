import type { CombatSnapshot } from '@aragoz/combat';
import { moduleWorldPosition } from '@aragoz/contracts';

/** Resolve a world-space target into the strike direction expected by combat. */
export function resolveStrikeAim(
  snapshot: CombatSnapshot,
  pointer: { x: number; z: number } | null,
  enabled: boolean,
): { x: number; z: number } {
  const hero = snapshot.hero.position;
  let target = pointer ?? snapshot.boss.position;
  if (enabled) {
    const intact = snapshot.modules.filter(module => !module.broken);
    const targets = intact.map(module => ({
      module,
      position: moduleWorldPosition(snapshot.boss.position, snapshot.boss.facing, module.slotId),
    })).map(target => ({ ...target, distance: Math.hypot(target.position.x - hero.x, target.position.z - hero.z) }))
      .filter(target => target.distance < 2.1)
      .sort((a, b) => Number(b.module.exposed) - Number(a.module.exposed) || a.distance - b.distance);
    if (targets[0]) target = targets[0].position;
    else if (intact.length === 0 && Math.hypot(snapshot.boss.position.x - hero.x, snapshot.boss.position.z - hero.z) < 2.1)
      target = snapshot.boss.position;
  }
  return { x: target.x - hero.x, z: target.z - hero.z };
}
