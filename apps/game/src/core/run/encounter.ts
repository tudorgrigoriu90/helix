import type { EnemyDef } from '@shared-types/enemy';
import type { PopulatedRoom } from '@shared-types/floor-plan';
import type { EnemyState, PlayerState, RunState } from '@shared-types/run-state';
import { scaledMaxHp, scaledStats } from './scaling';

/**
 * Encounter builder — the bridge from floor generation to the turn engine.
 *
 * Floor-gen produces a {@link PopulatedRoom} (grid + enemy *spawns* referencing
 * enemy def ids); the turn engine operates on a {@link RunState} (grid + live
 * {@link EnemyState}s). This instantiates the latter from the former: it looks
 * each spawn's def up in the registry, stamps a fresh full-HP enemy at its
 * spawn tile, and drops the carried player at the room's entry tile with AP
 * refreshed.
 *
 * Per-floor stat scaling (T-78) is deliberately not applied here — enemies
 * spawn at their base def stats; scaling layers on when that task lands.
 */

export type EnemyRegistry = ReadonlyMap<string, EnemyDef>;

/** Index a list of enemy defs by id for O(1) lookup during instantiation. */
export function buildEnemyRegistry(defs: readonly EnemyDef[]): EnemyRegistry {
  return new Map(defs.map((d) => [d.id, d]));
}

export interface EncounterParams {
  readonly room: PopulatedRoom;
  readonly registry: EnemyRegistry;
  /** The persistent player carried between rooms (hp/items/abilities survive). */
  readonly player: PlayerState;
  readonly floorNumber: number;
  readonly seed: number;
}

export function buildEncounterState(params: EncounterParams): RunState {
  const { room, registry, player, floorNumber, seed } = params;

  const enemies: EnemyState[] = room.enemies.map((spawn, i) => {
    const def = registry.get(spawn.enemyDefId);
    if (def === undefined) {
      // Unreachable for validated content (the cross-reference gate, T-288,
      // guarantees every pooled/boss id resolves) — guard anyway.
      throw new Error(`buildEncounterState: no enemy def for "${spawn.enemyDefId}"`);
    }
    // Per-floor difficulty scaling (T-78): defs are authored at the Floor 1
    // baseline and scaled up for deeper floors.
    const maxHp = scaledMaxHp(def.maxHp, floorNumber);
    return {
      id: `${spawn.enemyDefId}#${i}`,
      enemyDefId: def.id,
      pos: spawn.pos,
      hp: maxHp,
      maxHp,
      stats: scaledStats(def.stats, floorNumber),
      statuses: [],
      telegraph: null,
    };
  });

  return {
    schemaVersion: 1,
    seed,
    floorNumber,
    phase: 'player',
    turn: 1,
    grid: room.grid,
    player: {
      ...player,
      pos: room.playerSpawn,
      ap: player.maxAp,
      statuses: [],
      // Each encounter starts with abilities off cooldown.
      abilities: player.abilities.map((s) => ({ ...s, cooldownRemaining: 0 })),
    },
    enemies,
  };
}
