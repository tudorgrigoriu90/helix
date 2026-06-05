import { describe, it, expect } from 'vitest';
import type { EntityStats } from '@shared-types/run-state';
import {
  showMoveConfirmHint, MOVE_CONFIRM_GRACE_RUNS,
  reachableMoves, attackPreview, BASE_CRIT_CHANCE,
} from './combat-preview';

// ── showMoveConfirmHint ────────────────────────────────────────────────────────

describe('showMoveConfirmHint — T-163', () => {
  it('shows the hint for new players (0 runs)', () => {
    expect(showMoveConfirmHint(0)).toBe(true);
  });

  it('shows the hint below the grace threshold', () => {
    expect(showMoveConfirmHint(MOVE_CONFIRM_GRACE_RUNS - 1)).toBe(true);
  });

  it('hides the hint once the threshold is reached', () => {
    expect(showMoveConfirmHint(MOVE_CONFIRM_GRACE_RUNS)).toBe(false);
    expect(showMoveConfirmHint(100)).toBe(false);
  });
});

// ── reachableMoves ─────────────────────────────────────────────────────────────

describe('reachableMoves — T-163', () => {
  const grid = { width: 5, height: 5 };

  it('returns 8 neighbours from the centre of an open grid', () => {
    const moves = reachableMoves({ x: 2, y: 2 }, grid, new Set());
    expect(moves.length).toBe(8);
  });

  it('clips to the grid boundary from a corner', () => {
    const moves = reachableMoves({ x: 0, y: 0 }, grid, new Set());
    expect(moves.length).toBe(3); // (1,0), (0,1), (1,1)
  });

  it('excludes blocked tiles (walls and enemy positions)', () => {
    const blocked = new Set(['3,2', '2,3']);
    const moves = reachableMoves({ x: 2, y: 2 }, grid, blocked);
    expect(moves.length).toBe(6);
    expect(moves.find((p) => p.x === 3 && p.y === 2)).toBeUndefined();
    expect(moves.find((p) => p.x === 2 && p.y === 3)).toBeUndefined();
  });
});

// ── attackPreview ──────────────────────────────────────────────────────────────

describe('attackPreview — T-164', () => {
  const attacker: EntityStats = { str: 10, res: 10, agi: 10, int: 5 };
  const target = { stats: { str: 5, res: 4, agi: 5, int: 3 }, statuses: [] as never[] };

  it('computes normal and crit damage above zero', () => {
    const p = attackPreview(attacker, target);
    expect(p.normalDmg).toBeGreaterThan(0);
    expect(p.critDmg).toBeGreaterThanOrEqual(p.normalDmg);
  });

  it('reports a crit chance between 0 and 1', () => {
    const { critChance } = attackPreview(attacker, target);
    expect(critChance).toBeGreaterThan(0);
    expect(critChance).toBeLessThanOrEqual(1);
  });

  it('label includes damage and crit percentage', () => {
    const { label } = attackPreview(attacker, target);
    expect(label).toMatch(/dmg/);
    expect(label).toMatch(/crit/);
    expect(label).toMatch(/AP/);
  });

  it('base crit chance at neutral stats equals BASE_CRIT_CHANCE', () => {
    const neutral: EntityStats = { str: 10, res: 10, agi: 10, int: 10 };
    const p = attackPreview(neutral, target);
    const expectedChance = BASE_CRIT_CHANCE + Math.max(0, 10 - 10) * 0.01;
    expect(p.critChance).toBeCloseTo(expectedChance);
  });
});
