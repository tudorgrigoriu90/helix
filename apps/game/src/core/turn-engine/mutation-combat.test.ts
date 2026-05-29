import { describe, it, expect } from 'vitest';
import type { AbilityDef } from '@shared-types/ability';
import type { RunState } from '@shared-types/run-state';
import { makeRng } from '../rng/mulberry32';
import { applyMutation } from '../mutation';
import { newRunPlayer } from '../run/start-player';
import { TurnEngine } from './turn-engine';

/**
 * Mutation → combat integration. Proves the things that make mutations actually
 * matter in a fight: a mutation-granted ability resolves through the engine, and
 * the Combustion Engine (Thermal dominant) ignites targets on hit.
 */

const FIREBOLT: AbilityDef = {
  id: 'firebolt', apCost: 2, cooldown: 2, range: 3, targetType: 'enemy',
  baseDamage: 12, damageType: 'thermal', intScaling: 0.5, aoeRadius: 0,
  appliesStatus: null, statusDuration: 0,
};

function combatWith(over: Partial<RunState['player']> = {}): RunState {
  return {
    schemaVersion: 1, seed: 1, floorNumber: 1, phase: 'player', turn: 1,
    grid: { width: 7, height: 7, tiles: new Array(49).fill('open') },
    player: { ...newRunPlayer(), pos: { x: 3, y: 3 }, ...over },
    enemies: [
      { id: 'e1', enemyDefId: 'grunt', pos: { x: 3, y: 2 }, hp: 50, maxHp: 50, stats: { str: 12, res: 4, agi: 4, int: 2 }, statuses: [], telegraph: null },
    ],
  };
}

describe('mutation → combat integration', () => {
  it('a mutation-granted ability is usable and resolves in combat', () => {
    const player = applyMutation(newRunPlayer(), {
      id: 'thermal_firebolt', family: 'thermal', tier: 'minor', name: 'Firebolt',
      sigBonus: 10, modifiers: [], grantsAbility: FIREBOLT, lace: 'x', tags: [],
    });
    expect(player.abilities.some((s) => s.def.id === 'firebolt')).toBe(true);

    const state = combatWith({ pos: { x: 3, y: 3 }, abilities: player.abilities });
    const res = TurnEngine.apply(state, { type: 'useAbility', abilityId: 'firebolt', targetId: 'e1' }, makeRng(1, 'combat'));
    expect(res.errors).toHaveLength(0);
    expect(res.effects.some((e) => e.type === 'abilityUsed' && e.abilityId === 'firebolt')).toBe(true);
    const dmg = res.effects.find((e) => e.type === 'damageDealt');
    expect(dmg).toBeDefined();
    expect(res.state.enemies[0]!.hp).toBeLessThan(50); // it actually hurt the enemy
  });

  it('Combustion Engine ignites a surviving target on a basic attack', () => {
    const noTrait = combatWith({ pos: { x: 3, y: 3 } });
    const withTrait = combatWith({ pos: { x: 3, y: 3 }, dominantTraits: ['thermal'] });

    const attack = { type: 'attack', targetId: 'e1' } as const;
    const plain = TurnEngine.apply(noTrait, attack, makeRng(2, 'combat'));
    const burned = TurnEngine.apply(withTrait, attack, makeRng(2, 'combat'));

    expect(plain.state.enemies[0]!.statuses.some((s) => s.effect === 'burn')).toBe(false);
    expect(burned.state.enemies[0]!.statuses.some((s) => s.effect === 'burn')).toBe(true);
    expect(burned.effects.some((e) => e.type === 'statusApplied' && e.status === 'burn')).toBe(true);
  });

  it('Combustion Engine ignites on a damaging ability too', () => {
    const player = applyMutation(newRunPlayer(), {
      id: 'thermal_firebolt', family: 'thermal', tier: 'minor', name: 'Firebolt',
      sigBonus: 10, modifiers: [], grantsAbility: FIREBOLT, lace: 'x', tags: [],
    });
    const state = combatWith({ pos: { x: 3, y: 3 }, abilities: player.abilities, dominantTraits: ['thermal'] });
    const res = TurnEngine.apply(state, { type: 'useAbility', abilityId: 'firebolt', targetId: 'e1' }, makeRng(3, 'combat'));
    expect(res.state.enemies[0]!.statuses.some((s) => s.effect === 'burn')).toBe(true);
  });
});
