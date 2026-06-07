import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { FloorTemplate } from '@shared-types/floor-template';
import type { Action, Position } from '@shared-types/action';
import type { EnemyState, RunState } from '@shared-types/run-state';
import { makeRng } from '../rng/mulberry32';
import { TurnEngine, chebyshev } from '../turn-engine';
import { bfsDistances } from '../floor-gen';
import { RunSession } from './run-session';
import { buildEnemyRegistry } from './encounter';
import { parseEnemyDef } from '../content/enemy-loader';
import { parseFloorTemplate } from '../floor-gen/floor-template-loader';
import { parseItemDef } from '../content/item-loader';
import { parseMutationDef } from '../content/mutation-loader';

/**
 * T-78 balance guard — extended to all 20 milestone floors.
 *
 * Auto-plays full runs with the real shipped content (enemies, items,
 * floor templates, mutations), a competent policy (heal when low, AoE on
 * clusters, lance/nuke on singles, melee fallback), and stat-point allocation.
 * Checks that the difficulty curve is shaped correctly: Floor 1 is reliably
 * winnable, and the mid-game + late game become progressively harder.
 */

const FLOOR1_CLEAR_MIN = 0.9; // F1 is the tutorial slice — must be reliable
const ZONE1_END_MIN = 0.2; // F5 (Zone 1 finale) still beatable for a competent player
const APEX_CLEAR_MAX = 0.3; // F20 is punishing — clear rate must stay below 30%

const CONTENT = fileURLToPath(new URL('../../../../../packages/content/', import.meta.url));

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf-8'));
}

const registry = (() => {
  const defs = readdirSync(`${CONTENT}enemies/`)
    .filter((f) => f.endsWith('.json'))
    .flatMap((f) => {
      const res = parseEnemyDef(readJson(`${CONTENT}enemies/${f}`));
      return res.ok ? [res.enemy] : [];
    });
  return buildEnemyRegistry(defs);
})();

const allFloorTemplates: ReadonlyMap<number, FloorTemplate> = (() => {
  const map = new Map<number, FloorTemplate>();
  for (const f of readdirSync(`${CONTENT}floors/`).filter((file) => file.endsWith('.json'))) {
    const res = parseFloorTemplate(readJson(`${CONTENT}floors/${f}`));
    if (res.ok) map.set(res.template.floor, res.template);
  }
  return map;
})();

const itemPool = readdirSync(`${CONTENT}items/`)
  .filter((f) => f.endsWith('.json'))
  .flatMap((f) => {
    const res = parseItemDef(readJson(`${CONTENT}items/${f}`));
    return res.ok ? [res.item] : [];
  });

const mutations = readdirSync(`${CONTENT}mutations/`)
  .filter((f) => f.endsWith('.json'))
  .flatMap((f) => {
    const res = parseMutationDef(readJson(`${CONTENT}mutations/${f}`));
    return res.ok ? [res.mutation] : [];
  });

const baseTemplate = allFloorTemplates.get(1)!;

// ── Combat policy ──────────────────────────────────────────────────────────

const byId = (a: EnemyState, b: EnemyState): number => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

const step = (from: Position, to: Position): Position => ({
  x: from.x + Math.sign(to.x - from.x),
  y: from.y + Math.sign(to.y - from.y),
});

function bestAoe(
  state: RunState,
  range: number,
  radius: number,
  living: readonly EnemyState[],
): { pos: Position; count: number } | null {
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

  // Heal when below 35% HP or below 25 absolute HP — prefer highest heal
  if (p.hp / p.maxHp < 0.35 || p.hp < 25) {
    const heals = p.items.filter((i) => i.effect?.kind === 'heal');
    const best = heals.sort((a, b) => (b.effect?.amount ?? 0) - (a.effect?.amount ?? 0))[0];
    if (best) return { type: 'useItem', itemId: best.id };
  }

  // AoE ability (rupture / seismic) on ≥2 enemies
  const aoeAbility = p.abilities.find((s) => s.def.aoeRadius > 0 && s.def.targetType === 'tile');
  if (aoeAbility && aoeAbility.cooldownRemaining === 0 && p.ap >= aoeAbility.def.apCost) {
    const aoe = bestAoe(state, aoeAbility.def.range, aoeAbility.def.aoeRadius, living);
    if (aoe && aoe.count >= 2) {
      return { type: 'useAbility', abilityId: aoeAbility.def.id, targetPos: aoe.pos };
    }
  }

  // Single-target nuke ability (lance / void beam)
  const lance = p.abilities.find((s) => s.def.targetType === 'enemy' && s.def.baseDamage > 0);
  if (lance && lance.cooldownRemaining === 0 && p.ap >= lance.def.apCost) {
    const t = living.find((e) => chebyshev(p.pos, e.pos) <= lance.def.range);
    if (t) return { type: 'useAbility', abilityId: lance.def.id, targetId: t.id };
  }

  // AoE damage consumable on ≥2 enemies
  const aoeItem = p.items.find((i) => i.effect?.kind === 'damage' && (i.effect.aoeRadius ?? 0) > 0);
  if (aoeItem) {
    const aoe = bestAoe(state, 99, aoeItem.effect!.aoeRadius ?? 1, living);
    if (aoe && aoe.count >= 2) return { type: 'useItem', itemId: aoeItem.id, targetPos: aoe.pos };
  }

  // Single-target damage consumable on lone enemy
  const stItem = p.items.find((i) => i.effect?.kind === 'damage' && (i.effect.aoeRadius ?? 0) === 0);
  if (stItem && living.length <= 2) {
    const t = living.find((e) => chebyshev(p.pos, e.pos) <= 99);
    if (t) return { type: 'useItem', itemId: stItem.id, targetPos: t.pos };
  }

  // Melee if adjacent
  const adj = living.find((e) => chebyshev(p.pos, e.pos) <= 1);
  if (adj) return { type: 'attack', targetId: adj.id };

  // Step toward nearest enemy
  return { type: 'move', targetPos: step(p.pos, living[0]!.pos) };
}

// ── Loot claiming ──────────────────────────────────────────────────────────

function claimPendingLoot(s: RunSession): void {
  for (const item of s.lootPending()) {
    if (item.category === 'equipment') continue; // skip equipment — no swap logic
    const result = s.takeLoot(item.id);
    if (result.needsSwap) {
      // inventory full: swap out a duplicate consumable if any, otherwise skip
      const snap = s.snapshot;
      const dup = snap.player.items.find((held) => held.id === item.id);
      if (dup) s.takeLoot(item.id, dup.id);
      else s.discardLoot(item.id);
    }
  }
}

// ── Navigation ────────────────────────────────────────────────────────────

function nextRoom(s: RunSession): string | undefined {
  const snap = s.snapshot;
  const adj = s.adjacentRooms();
  const dist = bfsDistances(s.floor.bossRoomId, s.floor.rooms, s.floor.edges);

  // Prefer safe rooms when hurt
  if (snap.player.hp / snap.player.maxHp < 0.6) {
    const safeAdj = adj.find((id) => s.floor.rooms.find((r) => r.id === id)?.type === 'safe');
    if (safeAdj) return safeAdj;
  }

  // BFS toward boss
  let best: string | undefined;
  let bestD = Infinity;
  for (const id of adj) {
    const d = dist.get(id) ?? Infinity;
    if (d < bestD) { bestD = d; best = id; }
  }
  return best;
}

// ── Run simulator ─────────────────────────────────────────────────────────

function playRun(seed: number, finalFloor: number): string {
  const s = new RunSession({
    seed,
    template: baseTemplate,
    registry,
    finalFloor,
    floorTemplates: allFloorTemplates,
    itemPool,
    mutations,
  });

  for (let i = 0; i < 4000; i++) {
    const status = s.snapshot.status;
    if (status === 'victory' || status === 'defeat') return status;

    if (status === 'floor_complete') {
      s.descend();
      continue;
    }

    if (status === 'strand_event') {
      const outcome = s.beginStrandEvent();
      if (outcome.kind === 'draw' && s.strandOffer.length > 0) {
        s.chooseStrandMutation(s.strandOffer[0]!.mutation.id);
      } else {
        s.acceptIntermission();
      }
      continue;
    }

    // Allocate any pending stat points to STR
    while (s.snapshot.pendingStatPoints > 0) s.allocateStatPoint('str');

    if (s.needsCombat()) {
      const rs = s.beginEncounter();
      if (rs === null) continue;
      const rng = makeRng(rs.seed, 'combat');
      let state = rs;
      for (let t = 0; t < 4000 && state.phase === 'player'; t++) {
        let result = TurnEngine.apply(state, chooseCombat(state), rng);
        if (result.errors.length > 0) result = TurnEngine.apply(state, { type: 'endTurn' }, rng);
        state = result.state;
      }
      s.endEncounter(state);
      claimPendingLoot(s);
    } else {
      const next = nextRoom(s);
      if (next === undefined) break;
      s.moveTo(next);
      claimPendingLoot(s);
    }
  }

  return s.snapshot.status;
}

function clearRate(finalFloor: number, seeds = 40): number {
  let wins = 0;
  for (let seed = 1; seed <= seeds; seed++) {
    if (playRun(seed, finalFloor) === 'victory') wins++;
  }
  return wins / seeds;
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('combat balance — all 20 floors (T-78 difficulty curve)', () => {
  it('floor 1 is reliably winnable', () => {
    const f1 = clearRate(1, 60);
    // eslint-disable-next-line no-console
    console.log(`  F1 clear rate: ${(f1 * 100).toFixed(0)}%`);
    expect(f1).toBeGreaterThanOrEqual(FLOOR1_CLEAR_MIN);
  });

  it('difficulty curve descends across zone milestones', () => {
    const depths = [5, 10, 15, 20];
    const rates = depths.map((d) => clearRate(d, 40));
    // eslint-disable-next-line no-console
    console.log(
      depths
        .map((d, i) => `  F${d}: ${(rates[i]! * 100).toFixed(0)}%`)
        .join('   '),
    );

    // Zone 1 finale (F5) is still beatable for a competent player
    expect(rates[0]).toBeGreaterThanOrEqual(ZONE1_END_MIN);

    // Curve is monotone descending (each zone harder than the last)
    for (let i = 1; i < rates.length; i++) {
      expect(rates[i]).toBeLessThanOrEqual(rates[i - 1]!);
    }

    // Apex (F20) is punishing — low clear rate confirms intended difficulty
    expect(rates[rates.length - 1]).toBeLessThan(APEX_CLEAR_MAX);
  });
});
