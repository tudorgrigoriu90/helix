import type { AbilitySlot } from '@shared-types/ability';
import type { ItemDef } from '@shared-types/item';
import type { PlayerState } from '@shared-types/run-state';

/**
 * The default Origin loadout used to seed a new run — a hardcoded precursor to
 * the Origins content (T-301). Position/AP are set per-room by the encounter
 * builder; everything here is the persistent baseline that carries between
 * rooms: stats, two abilities, and three starting consumables.
 *
 * Abilities are inline {@link AbilitySlot}s (there is no ability content
 * pipeline yet — they ship via Origins/mutations later). The items mirror the
 * Common-tier catalog in `packages/content/items/`.
 */

const STARTER_ABILITIES: readonly AbilitySlot[] = [
  {
    // Single-target ranged nuke — the bread-and-butter INT-scaling poke.
    def: {
      id: 'pressure_lance',
      apCost: 2,
      cooldown: 2,
      range: 3,
      targetType: 'enemy',
      baseDamage: 11,
      damageType: 'pressure',
      intScaling: 0.7,
      aoeRadius: 0,
      appliesStatus: null,
      statusDuration: 0,
    },
    cooldownRemaining: 0,
  },
  {
    // Tile-targeted AoE that also crushes — rewards grouping enemies up.
    def: {
      id: 'rupture',
      apCost: 2,
      cooldown: 3,
      range: 2,
      targetType: 'tile',
      baseDamage: 6,
      damageType: 'seismic',
      intScaling: 0.4,
      aoeRadius: 1,
      appliesStatus: 'crushed',
      statusDuration: 2,
    },
    cooldownRemaining: 0,
  },
];

const STARTER_ITEMS: readonly ItemDef[] = [
  { id: 'vein_serum', name: 'Vein Serum', rarity: 'common', category: 'consumable', effect: { kind: 'heal', amount: 25 } },
  { id: 'frag_grenade', name: 'Frag Grenade', rarity: 'common', category: 'consumable', effect: { kind: 'damage', amount: 30, damageType: 'physical', aoeRadius: 1 } },
  { id: 'spore_bomb', name: 'Spore Bomb', rarity: 'common', category: 'consumable', effect: { kind: 'applyStatus', status: 'infected', duration: 4, aoeRadius: 1 } },
];

export function newRunPlayer(): PlayerState {
  return {
    id: 'player',
    pos: { x: 0, y: 0 },
    hp: 80,
    maxHp: 80,
    ap: 3,
    maxAp: 3,
    stats: { str: 11, res: 6, agi: 8, int: 10 },
    statuses: [],
    abilities: STARTER_ABILITIES.map((s) => ({ ...s })),
    items: STARTER_ITEMS.map((i) => ({ ...i })),
    mutations: [],
  };
}
