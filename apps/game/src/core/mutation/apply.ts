import type { MutationDef } from '@shared-types/mutation';
import type { PlayerState } from '@shared-types/run-state';

/**
 * Mutation application — T-90 (GDD §5.3).
 *
 * Folds a selected mutation into the player: applies its passive modifiers,
 * grants its active ability (if any), and records ownership. Pure and immutable
 * — returns a fresh {@link PlayerState}, leaving the input untouched — so it
 * slots straight into the reducer-style run loop.
 *
 *   - **stat**  — additive delta to str/res/agi/int (floored at 0).
 *   - **maxHp** — raises max HP *and* current HP by the delta (GDD: "current HP
 *     rises by the same amount"); max HP floored at 1, current HP clamped to it.
 *   - **maxAp** — raises max AP and current AP by the delta (floored at 0).
 *
 * The granted ability is appended ready (cooldown 0). Applying the same mutation
 * twice is a no-op for ownership and the ability list (idempotent on identity),
 * though its modifiers would stack — callers gate on ownership via the draw's
 * Rule 4, so a mutation is only ever applied once per run.
 *
 * SIG accrual is *not* handled here — SIG lives at run scope, not on
 * PlayerState; see {@link accumulateSig} (T-94).
 */

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

export function applyMutation(player: PlayerState, mutation: MutationDef): PlayerState {
  let stats = { ...player.stats };
  let maxHp = player.maxHp;
  let hp = player.hp;
  let maxAp = player.maxAp;
  let ap = player.ap;

  for (const mod of mutation.modifiers) {
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

  const mutations = player.mutations.includes(mutation.id)
    ? player.mutations
    : [...player.mutations, mutation.id];

  let abilities = player.abilities;
  const granted = mutation.grantsAbility;
  if (granted !== null && !abilities.some((slot) => slot.def.id === granted.id)) {
    abilities = [...abilities, { def: granted, cooldownRemaining: 0 }];
  }

  return { ...player, stats, maxHp, hp, maxAp, ap, abilities, mutations };
}
