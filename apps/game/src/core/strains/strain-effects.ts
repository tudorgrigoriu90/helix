import type { MutationFamily } from '@shared-types/mutation';
import type { DamageType, PlayerState } from '@shared-types/run-state';
import type { SigmaStrainDef } from '@shared-types/sigma-strain';

/**
 * Sigma Strain effect aggregation — T-306 (GDD §11.2).
 *
 * Turns the profile's unlocked strain set into one flat {@link StrainFx}
 * modifier block the run start consumes: numeric effects of the same kind sum
 * (they are single-digit nudges by the loader's cap), binary effects OR
 * together. Player-level effects apply via {@link applyStrainFxToPlayer};
 * session-level ones travel on `RunSessionOptions.strainFx`; the marker
 * effects (minimap / LACE hint / intent reveal / shop bias) are aggregated
 * here for the scene layer, whose wiring is tracked under E-4.
 */

export interface StrainFx {
  readonly maxHpPercent: number;
  readonly resists: readonly { readonly damageType: DamageType; readonly percent: number }[];
  readonly startingVein: number;
  readonly veinBonusPercent: number;
  readonly shardBonusPercent: number;
  readonly extraWildCard: boolean;
  readonly firstCardMatchesLastFamily: boolean;
  readonly carryMutation: boolean;
  readonly minimapRoomTypes: boolean;
  readonly laceBiomeHint: boolean;
  readonly intentRevealTypes: readonly DamageType[];
  readonly shopBiasFamilies: readonly MutationFamily[];
}

/** The no-strains baseline — every run without meta-progression uses this. */
export const ZERO_STRAIN_FX: StrainFx = {
  maxHpPercent: 0,
  resists: [],
  startingVein: 0,
  veinBonusPercent: 0,
  shardBonusPercent: 0,
  extraWildCard: false,
  firstCardMatchesLastFamily: false,
  carryMutation: false,
  minimapRoomTypes: false,
  laceBiomeHint: false,
  intentRevealTypes: [],
  shopBiasFamilies: [],
};

/** Folds the unlocked strains' effects into one modifier block. */
export function aggregateStrainFx(
  pool: readonly SigmaStrainDef[],
  unlockedIds: readonly string[],
): StrainFx {
  const owned = new Set(unlockedIds);
  const fx = {
    ...ZERO_STRAIN_FX,
    resists: [] as { damageType: DamageType; percent: number }[],
    intentRevealTypes: [] as DamageType[],
    shopBiasFamilies: [] as MutationFamily[],
  };
  for (const strain of pool) {
    if (!owned.has(strain.id)) continue;
    const e = strain.effect;
    switch (e.kind) {
      case 'maxHpPercent':
        fx.maxHpPercent += e.percent;
        break;
      case 'damageResistPercent':
        fx.resists.push({ damageType: e.damageType, percent: e.percent });
        break;
      case 'veinBonusPercent':
        fx.veinBonusPercent += e.percent;
        break;
      case 'shardBonusPercent':
        fx.shardBonusPercent += e.percent;
        break;
      case 'startingVein':
        fx.startingVein += e.amount;
        break;
      case 'extraWildCard':
        fx.extraWildCard = true;
        break;
      case 'firstCardMatchesLastFamily':
        fx.firstCardMatchesLastFamily = true;
        break;
      case 'carryMutation':
        fx.carryMutation = true;
        break;
      case 'minimapRoomTypes':
        fx.minimapRoomTypes = true;
        break;
      case 'laceBiomeHint':
        fx.laceBiomeHint = true;
        break;
      case 'enemyIntentReveal':
        if (!fx.intentRevealTypes.includes(e.damageType)) fx.intentRevealTypes.push(e.damageType);
        break;
      case 'shopFamilyBias':
        if (!fx.shopBiasFamilies.includes(e.family)) fx.shopBiasFamilies.push(e.family);
        break;
    }
  }
  return fx;
}

/**
 * Applies the player-level strain effects onto the starting player: the max-HP
 * nudge (current HP rises by the same amount — a run starts full) and the
 * typed resists, which stack additively with an Origin's in `damageTo`.
 * Base stats stay untouched — strains are meta nudges, not stat sources.
 */
export function applyStrainFxToPlayer(player: PlayerState, fx: StrainFx): PlayerState {
  let next = player;
  if (fx.maxHpPercent > 0) {
    const bonus = Math.floor((player.maxHp * fx.maxHpPercent) / 100);
    next = { ...next, maxHp: next.maxHp + bonus, hp: next.hp + bonus };
  }
  if (fx.resists.length > 0) {
    next = { ...next, resists: [...(next.resists ?? []), ...fx.resists] };
  }
  return next;
}
