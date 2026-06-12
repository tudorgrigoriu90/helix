import type { EnemyState, StatusEffect } from '@shared-types/run-state';
import { ZONE_WARDEN_IDS } from '@shared-types/enemy';

/**
 * Boss phase system — T-503 (DR-008, GDD §8.2/§8.4/§8.4a).
 *
 * Phase is *derived from HP*, never stored: deterministic, save-proof, and
 * impossible to desync. Two treatments:
 *
 *   - **Floor Bosses** (16, template-composed): the generic 2-phase pattern —
 *     below 50% HP they enrage (+25% STR). One implementation, no per-boss code.
 *   - **Zone Wardens** (4, bespoke): 3 phases at 66% / 33% HP with hand-tuned
 *     patterns per Warden, each readable as a mechanical escalation of its
 *     zone's identity:
 *       · Leviathan Hatchling (Shallows) — pressure builds: +20% STR, then
 *         strikes also Suppress (the crush-depth tell).
 *       · The Great Mycelium (Mycosphere) — strikes Infect, then the network
 *         regrows: 5% max-HP self-heal each action.
 *       · The Mountain's Heart (Lithic) — stoneplate (+4 effective RES), then
 *         sheds the plate to swing at +40% STR.
 *       · The Convergence (Apex) — +15% STR, then a base-STR double strike.
 *
 * Phase tells ride the existing telegraph channel ('defense' for the plate,
 * 'special' for every phase-3 pattern) so the scene's boss telegraph icon
 * (T-159) shows the escalation with no new UI plumbing.
 */

export type BossPhase = 1 | 2 | 3;

/** Floor Bosses enrage below half HP (GDD §8.2 — generic 2-phase template). */
export const FLOOR_BOSS_PHASE2_AT = 0.5;
/** Wardens escalate at two-thirds and one-third HP (GDD §8.2 — 66% / 33%). */
export const WARDEN_PHASE2_AT = 2 / 3;
export const WARDEN_PHASE3_AT = 1 / 3;

const WARDEN_ID_SET: ReadonlySet<string> = new Set(ZONE_WARDEN_IDS);

/** True for the four bespoke Zone Wardens (by tier when present, id as fallback
 *  for pre-tier combat saves). */
export function isWarden(enemy: Pick<EnemyState, 'enemyDefId' | 'tier'>): boolean {
  return enemy.tier === 'zone_warden' || WARDEN_ID_SET.has(enemy.enemyDefId);
}

/** True for any boss-tier enemy (warden or floor boss). */
function isFloorBoss(enemy: Pick<EnemyState, 'tier'>): boolean {
  return enemy.tier === 'floor_boss';
}

/** The current phase, derived from the enemy's HP fraction. Non-bosses are 1. */
export function bossPhaseOf(enemy: Pick<EnemyState, 'hp' | 'maxHp' | 'enemyDefId' | 'tier'>): BossPhase {
  const frac = enemy.maxHp > 0 ? enemy.hp / enemy.maxHp : 0;
  if (isWarden(enemy)) {
    if (frac > WARDEN_PHASE2_AT) return 1;
    return frac > WARDEN_PHASE3_AT ? 2 : 3;
  }
  if (isFloorBoss(enemy)) return frac > FLOOR_BOSS_PHASE2_AT ? 1 : 2;
  return 1;
}

/** What a boss's attack action does in its current phase. */
export interface BossAttackProfile {
  /** Multiplier on STR for the strike (floored). */
  readonly strMult: number;
  /** Strikes per action (The Convergence phase 3 hits twice). */
  readonly strikes: number;
  /** Status inflicted on the player by a connecting strike, if any. */
  readonly inflicts?: { readonly status: StatusEffect; readonly turns: number };
  /** Fraction of max HP self-healed at the start of its action. */
  readonly selfHealFraction?: number;
  /** Extra effective RES while this phase holds (the stoneplate). */
  readonly resBonus?: number;
  /** Telegraph tell for the phase ('null' clears it). */
  readonly telegraph: EnemyState['telegraph'];
}

const BASELINE: BossAttackProfile = { strMult: 1, strikes: 1, telegraph: null };

/** The per-phase attack profile. Non-bosses always get the baseline. */
export function bossAttackProfile(
  enemy: Pick<EnemyState, 'hp' | 'maxHp' | 'enemyDefId' | 'tier'>,
): BossAttackProfile {
  const phase = bossPhaseOf(enemy);
  if (phase === 1) return BASELINE;

  if (!isWarden(enemy)) {
    // Floor Boss enrage — the one generic template (GDD §8.4a).
    return { strMult: 1.25, strikes: 1, telegraph: 'special' };
  }

  switch (enemy.enemyDefId) {
    case 'leviathan_hatchling':
      return phase === 2
        ? { strMult: 1.2, strikes: 1, telegraph: 'special' }
        : { strMult: 1.2, strikes: 1, inflicts: { status: 'suppressed', turns: 1 }, telegraph: 'special' };
    case 'the_great_mycelium':
      return phase === 2
        ? { strMult: 1, strikes: 1, inflicts: { status: 'infected', turns: 2 }, telegraph: 'special' }
        : {
            strMult: 1, strikes: 1,
            inflicts: { status: 'infected', turns: 2 },
            selfHealFraction: 0.05,
            telegraph: 'special',
          };
    case 'the_mountains_heart':
      return phase === 2
        ? { strMult: 1, strikes: 1, resBonus: 4, telegraph: 'defense' }
        : { strMult: 1.4, strikes: 1, telegraph: 'special' };
    case 'the_convergence':
      // The double strike IS the phase-3 identity — it stays at base STR so
      // the Apex is punishing without re-walling the endings (T-524 band).
      return phase === 2
        ? { strMult: 1.15, strikes: 1, telegraph: 'special' }
        : { strMult: 1, strikes: 2, telegraph: 'special' };
    default:
      // A fifth warden would be a content/contract change — fail soft to the
      // generic escalation rather than throwing mid-combat.
      return { strMult: 1.25, strikes: 1, telegraph: 'special' };
  }
}

/** Defender wrapped with the phase RES bonus (the Mountain's Heart stoneplate),
 *  for the player→enemy damage paths. Identity for everything else. */
export function withBossPhaseRes<T extends EnemyState>(enemy: T): T {
  const bonus = bossAttackProfile(enemy).resBonus ?? 0;
  if (bonus === 0) return enemy;
  return { ...enemy, stats: { ...enemy.stats, res: enemy.stats.res + bonus } };
}
