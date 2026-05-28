import type { PlayerState } from '@shared-types/run-state';

/**
 * The default Origin loadout used to seed a new run (prototype default until
 * the Origins content lands, T-301). Position/AP are set per-room by the
 * encounter builder; this is the persistent baseline that carries between
 * rooms — hp, stats, abilities, and starting items.
 */
export function newRunPlayer(): PlayerState {
  return {
    id: 'player',
    pos: { x: 0, y: 0 },
    hp: 80,
    maxHp: 80,
    ap: 3,
    maxAp: 3,
    stats: { str: 10, res: 6, agi: 8, int: 8 },
    statuses: [],
    abilities: [],
    items: [],
    mutations: [],
  };
}
