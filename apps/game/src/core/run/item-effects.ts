import type { ItemDef, ItemModifier } from '@shared-types/item';
import type { PlayerState } from '@shared-types/run-state';

/**
 * Passive / equipment effect application — T-444 (GDD §9.2).
 *
 * An item's `modifiers` are *always-on* stat effects that apply while it's
 * carried and reverse when it's dropped — the same modifier shape and folding
 * rule as a mutation (`apply.ts`), but reversible because gear comes and goes:
 *
 *   - **stat**  — additive delta to str/res/agi/int (floored at 0)
 *   - **maxHp** — raises max HP *and* current HP by the delta (max floored at 1)
 *   - **maxAp** — raises max AP and current AP by the delta (floored at 0)
 *
 * Pure: returns a fresh {@link PlayerState}. {@link RunSession} calls
 * {@link equipItem} when an item is added and {@link unequipItem} when it's
 * dropped/swapped, so a dropped +10 HP gauge takes its 10 HP back with it.
 *
 * Equipment *active / on-hit* effects (status-on-hit, pull, reflect) are a
 * separate combat-hook concern (T-444b) — this module is the stat layer only.
 */

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function applyModifiers(player: PlayerState, mods: readonly ItemModifier[]): PlayerState {
  let stats = { ...player.stats };
  let maxHp = player.maxHp;
  let hp = player.hp;
  let maxAp = player.maxAp;
  let ap = player.ap;

  for (const mod of mods) {
    if (mod.kind === 'stat') {
      stats = { ...stats, [mod.stat]: Math.max(0, stats[mod.stat] + mod.delta) };
    } else if (mod.kind === 'maxHp') {
      maxHp = Math.max(1, maxHp + mod.delta);
      hp = clamp(hp + mod.delta, 0, maxHp);
    } else {
      maxAp = Math.max(0, maxAp + mod.delta);
      ap = clamp(ap + mod.delta, 0, maxAp);
    }
  }

  return { ...player, stats, maxHp, hp, maxAp, ap };
}

const negate = (mods: readonly ItemModifier[]): readonly ItemModifier[] =>
  mods.map((m) => ({ ...m, delta: -m.delta }));

/** Folds an item's always-on modifiers into the player (on add / equip). */
export function equipItem(player: PlayerState, item: ItemDef): PlayerState {
  return applyModifiers(player, item.modifiers ?? []);
}

/** Reverses an item's modifiers (on drop / swap-out). */
export function unequipItem(player: PlayerState, item: ItemDef): PlayerState {
  return applyModifiers(player, negate(item.modifiers ?? []));
}
