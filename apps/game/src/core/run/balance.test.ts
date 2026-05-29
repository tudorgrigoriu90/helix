import { describe, it, expect } from 'vitest';
import type { EnemyDef } from '@shared-types/enemy';
import type { FloorTemplate } from '@shared-types/floor-template';
import type { Action, Position } from '@shared-types/action';
import type { EnemyState, RunState } from '@shared-types/run-state';
import { makeRng } from '../rng/mulberry32';
import { TurnEngine, chebyshev } from '../turn-engine';
import { bfsDistances } from '../floor-gen';
import { RunSession } from './run-session';
import { buildEnemyRegistry } from './encounter';

/**
 * T-78 balance guard (Sprint 4.5). Auto-plays full runs with the *real*
 * starting loadout (abilities + items) and per-floor scaling, across many
 * seeds, with a competent policy (heal when low, AoE clusters, nuke, melee).
 * Locks in the intended difficulty curve: Floor 1 is winnable for most seeds;
 * a 3-floor descent is meaningfully harder. Re-run prints the rates.
 */

const FLOOR1_CLEAR_MIN = 0.9; // Floor 1 (the Gate-1 slice) is reliably winnable with good play
const DEMO_CLEAR_MIN = 0.5; // the 2-floor demo is winnable for a competent player
// Note: this demo reuses the Floor-1 template, so EVERY floor ends in a boss and
// consumables don't restock — a 3-floor descent is intentionally punishing. The
// curve we lock in: Floor 1 reliable, 2-floor demo winnable, depth eventually walls.

function enemy(id: string, tier: EnemyDef['tier'], maxHp: number, stats: EnemyDef['stats']): EnemyDef {
  return { schemaVersion: 1, id, name: id, tier, zone: 'shallows', maxHp, stats, damageType: 'physical', aestheticTags: ['caves'] };
}

// Mirrors the shipped Zone-1 content (packages/content/enemies/).
const registry = buildEnemyRegistry([
  enemy('filterer', 'grunt', 16, { str: 6, res: 3, agi: 5, int: 2 }),
  enemy('cave_crawler', 'grunt', 18, { str: 7, res: 4, agi: 8, int: 2 }),
  enemy('acid_spitter', 'grunt', 14, { str: 8, res: 2, agi: 6, int: 4 }),
  enemy('scavenger', 'grunt', 20, { str: 6, res: 5, agi: 7, int: 3 }),
  enemy('pressure_warden', 'boss', 90, { str: 14, res: 8, agi: 6, int: 6 }),
]);

function template(): FloorTemplate {
  return {
    schemaVersion: 1, floor: 1, zone: 'shallows',
    roomCount: { min: 8, max: 12 },
    roomWeights: { combat: 0.5, loot: 0.15, safe: 0.15, merchant: 0.1, trap: 0.05, lace_event: 0.05 },
    roomMinima: { safe: 1 },
    connectivity: 'branching',
    enemyPool: ['filterer', 'cave_crawler', 'acid_spitter', 'scavenger'],
    bossId: 'pressure_warden',
    aestheticTags: ['caves'],
  };
}

const byId = (a: EnemyState, b: EnemyState): number => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
const step = (from: Position, to: Position): Position => ({
  x: from.x + Math.sign(to.x - from.x), y: from.y + Math.sign(to.y - from.y),
});

/** Best AoE center within `range` of the player by living-enemies-hit. */
function bestAoe(state: RunState, range: number, radius: number, living: readonly EnemyState[]): { pos: Position; count: number } | null {
  let best: { pos: Position; count: number } | null = null;
  for (const center of living) {
    if (chebyshev(state.player.pos, center.pos) > range) continue;
    const count = living.filter((e) => chebyshev(e.pos, center.pos) <= radius).length;
    if (best === null || count > best.count) best = { pos: center.pos, count };
  }
  return best;
}

function chooseCombat(state: RunState): Action {
  const p = state.player;
  const living = state.enemies.filter((e) => e.hp > 0).slice().sort(byId);
  if (living.length === 0 || p.ap <= 0) return { type: 'endTurn' };

  if (p.hp / p.maxHp < 0.4) {
    const heal = p.items.find((i) => i.effect?.kind === 'heal');
    if (heal) return { type: 'useItem', itemId: heal.id };
  }

  const rupture = p.abilities.find((s) => s.def.aoeRadius > 0 && s.def.targetType === 'tile');
  if (rupture && rupture.cooldownRemaining === 0 && p.ap >= rupture.def.apCost) {
    const aoe = bestAoe(state, rupture.def.range, rupture.def.aoeRadius, living);
    if (aoe && aoe.count >= 2) return { type: 'useAbility', abilityId: rupture.def.id, targetPos: aoe.pos };
  }

  const lance = p.abilities.find((s) => s.def.targetType === 'enemy' && s.def.baseDamage > 0);
  if (lance && lance.cooldownRemaining === 0 && p.ap >= lance.def.apCost) {
    const t = living.find((e) => chebyshev(p.pos, e.pos) <= lance.def.range);
    if (t) return { type: 'useAbility', abilityId: lance.def.id, targetId: t.id };
  }

  const frag = p.items.find((i) => i.effect?.kind === 'damage');
  if (frag) {
    const aoe = bestAoe(state, 99, 1, living);
    if (aoe && aoe.count >= 3) return { type: 'useItem', itemId: frag.id, targetPos: aoe.pos };
  }

  const adj = living.find((e) => chebyshev(p.pos, e.pos) <= 1);
  if (adj) return { type: 'attack', targetId: adj.id };

  const target = living[0]!;
  return { type: 'move', targetPos: step(p.pos, target.pos) };
}

function resolveCombat(initial: RunState): RunState {
  let state = initial;
  const rng = makeRng(initial.seed, 'combat');
  for (let i = 0; i < 4000 && state.phase === 'player'; i++) {
    let result = TurnEngine.apply(state, chooseCombat(state), rng);
    if (result.errors.length > 0) result = TurnEngine.apply(state, { type: 'endTurn' }, rng);
    state = result.state;
  }
  return state;
}

function stepTowardBoss(s: RunSession): string | undefined {
  const dist = bfsDistances(s.floor.bossRoomId, s.floor.rooms, s.floor.edges);
  let best: string | undefined;
  let bestD = Infinity;
  for (const id of s.adjacentRooms()) {
    const d = dist.get(id) ?? Infinity;
    if (d < bestD) { bestD = d; best = id; }
  }
  return best;
}

/** Plays a full run to victory/defeat; returns the final run status. */
function playRun(seed: number, finalFloor: number): string {
  const s = new RunSession({ seed, template: template(), registry, finalFloor });
  for (let i = 0; i < 2000; i++) {
    const status = s.snapshot.status;
    if (status === 'victory' || status === 'defeat') return status;
    if (status === 'floor_complete') { s.descend(); continue; }
    if (s.needsCombat()) {
      const rs = s.beginEncounter();
      if (rs !== null) s.endEncounter(resolveCombat(rs));
    } else {
      const next = stepTowardBoss(s);
      if (next === undefined) break;
      s.moveTo(next);
    }
  }
  return s.snapshot.status;
}

function clearRate(finalFloor: number, seeds = 60): number {
  let wins = 0;
  for (let seed = 1; seed <= seeds; seed++) if (playRun(seed, finalFloor) === 'victory') wins++;
  return wins / seeds;
}

describe('combat balance — Sprint 4.5 (T-78 curve)', () => {
  it('Floor 1 is reliably winnable, the 2-floor demo is winnable, and depth bites', () => {
    const f1 = clearRate(1);
    const f2 = clearRate(2);
    const f3 = clearRate(3);
    // eslint-disable-next-line no-console
    console.log(`  clear rates — 1F: ${(f1 * 100).toFixed(0)}%   2F: ${(f2 * 100).toFixed(0)}%   3F: ${(f3 * 100).toFixed(0)}%`);
    expect(f1).toBeGreaterThanOrEqual(FLOOR1_CLEAR_MIN); // Floor 1 = the Gate-1 slice
    expect(f2).toBeGreaterThanOrEqual(DEMO_CLEAR_MIN); // the shipped 2-floor demo is beatable
    expect(f3).toBeLessThan(f2); // scaling + attrition eventually overwhelm
  });
});
