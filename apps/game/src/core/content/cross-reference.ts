import type { EnemyDef } from '@shared-types/enemy';
import type { ItemDef } from '@shared-types/item';
import type { FloorTemplate } from '@shared-types/floor-template';
import type { MutationDef } from '@shared-types/mutation';
import type { ContentError } from './validation';
import { contentError } from './validation';

/**
 * Cross-reference validator — T-288 (TDD §14.1).
 *
 * Per-file loaders (T-70/T-283/T-284) validate each content file in isolation.
 * This checks the relationships *between* files — the bugs a schema can't catch:
 *
 *   - a floor's `enemyPool` / `bossId` point at enemies that actually exist
 *   - a floor's `bossId` resolves to a `boss`-tier enemy
 *   - no two enemy (or item) files share an id
 *
 * Pure and total: returns every problem found (empty array = clean) so the
 * bundle gate can report them all at once rather than failing on the first.
 */

export interface ContentBundle {
  readonly enemies: readonly EnemyDef[];
  readonly items: readonly ItemDef[];
  readonly floors: readonly FloorTemplate[];
  readonly mutations: readonly MutationDef[];
}

export function crossReferenceContent(bundle: ContentBundle): ContentError[] {
  const errors: ContentError[] = [];

  errors.push(...duplicateIds(bundle.enemies.map((e) => e.id), 'enemy'));
  errors.push(...duplicateIds(bundle.items.map((i) => i.id), 'item'));
  errors.push(...duplicateIds(bundle.mutations.map((m) => m.id), 'mutation'));

  const enemyById = new Map(bundle.enemies.map((e) => [e.id, e]));

  for (const floor of bundle.floors) {
    for (const id of floor.enemyPool) {
      if (!enemyById.has(id)) {
        errors.push(
          contentError('INVALID_VALUE', `floor ${floor.floor} enemyPool references unknown enemy "${id}"`, 'enemyPool'),
        );
      }
    }

    const boss = enemyById.get(floor.bossId);
    if (boss === undefined) {
      errors.push(
        contentError('INVALID_VALUE', `floor ${floor.floor} bossId references unknown enemy "${floor.bossId}"`, 'bossId'),
      );
    } else if (boss.tier !== 'boss') {
      errors.push(
        contentError(
          'INVALID_VALUE',
          `floor ${floor.floor} bossId "${floor.bossId}" is tier "${boss.tier}", expected a boss-tier enemy`,
          'bossId',
        ),
      );
    }
  }

  return errors;
}

function duplicateIds(ids: readonly string[], kind: string): ContentError[] {
  const seen = new Set<string>();
  const dups = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) dups.add(id);
    seen.add(id);
  }
  return [...dups].map((id) => contentError('INVALID_VALUE', `duplicate ${kind} id "${id}"`, 'id'));
}
