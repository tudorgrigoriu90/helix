import { describe, it, expect } from 'vitest';
import type { MutationLoaderResult } from './mutation-loader';
import { parseMutationDef } from './mutation-loader';
// Real Zone-1 fixtures — round-trip the shipped JSON through the loader.
import pressureMembrane from '../../../../../packages/content/mutations/abyssal_pressure_membrane.json';
import sporeCloud from '../../../../../packages/content/mutations/mycelial_spore_cloud.json';
import deepLung from '../../../../../packages/content/mutations/abyssal_deep_lung.json';

function valid(): Record<string, unknown> {
  return {
    schemaVersion: 1,
    id: 'abyssal_test',
    family: 'abyssal',
    tier: 'minor',
    name: 'Test Mutation',
    sigBonus: 10,
    modifiers: [{ kind: 'stat', stat: 'res', delta: 5 }],
    grantsAbility: null,
    lace: 'A test line.',
    tags: ['defense'],
  };
}

function ability(): Record<string, unknown> {
  return {
    id: 'pressurize',
    apCost: 2,
    cooldown: 3,
    range: 1,
    targetType: 'enemy',
    baseDamage: 15,
    damageType: 'pressure',
    intScaling: 0,
    aoeRadius: 1,
    appliesStatus: 'crushed',
    statusDuration: 2,
  };
}

function expectErr(r: MutationLoaderResult, code: string, field?: string): void {
  expect(r.ok).toBe(false);
  if (r.ok === false) {
    expect(r.error.code).toBe(code);
    if (field !== undefined) expect(r.error.field).toBe(field);
  }
}

describe('parseMutationDef — T-83 (GDD §5 / TDD §8.1)', () => {
  // ── Happy path ──────────────────────────────────────────────────────────

  it('parses a minimal valid mutation (passive-only)', () => {
    const r = parseMutationDef(valid());
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.mutation.id).toBe('abyssal_test');
      expect(r.mutation.family).toBe('abyssal');
      expect(r.mutation.tier).toBe('minor');
      expect(r.mutation.grantsAbility).toBeNull();
      expect(r.mutation.modifiers).toEqual([{ kind: 'stat', stat: 'res', delta: 5 }]);
    }
  });

  it('parses a mutation that grants an ability', () => {
    const r = parseMutationDef({ ...valid(), grantsAbility: ability() });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.mutation.grantsAbility?.id).toBe('pressurize');
      expect(r.mutation.grantsAbility?.appliesStatus).toBe('crushed');
    }
  });

  it('parses a JSON string payload', () => {
    expect(parseMutationDef(JSON.stringify(valid())).ok).toBe(true);
  });

  it('accepts all three modifier kinds', () => {
    const r = parseMutationDef({
      ...valid(),
      modifiers: [
        { kind: 'stat', stat: 'str', delta: -2 }, // negative delta allowed (downside)
        { kind: 'maxHp', delta: 15 },
        { kind: 'maxAp', delta: 1 },
      ],
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.mutation.modifiers).toHaveLength(3);
  });

  it('accepts an empty modifiers array', () => {
    const r = parseMutationDef({ ...valid(), modifiers: [] });
    expect(r.ok).toBe(true);
  });

  it('accepts appliesStatus: null on a granted ability', () => {
    const r = parseMutationDef({ ...valid(), grantsAbility: { ...ability(), appliesStatus: null } });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.mutation.grantsAbility?.appliesStatus).toBeNull();
  });

  // ── Shipped fixtures round-trip ───────────────────────────────────────────

  it('parses the shipped abyssal_pressure_membrane fixture', () => {
    const r = parseMutationDef(pressureMembrane);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.mutation.id).toBe('abyssal_pressure_membrane');
      expect(r.mutation.grantsAbility?.id).toBe('pressurize');
    }
  });

  it('parses the shipped mycelial_spore_cloud fixture (tile AoE ability)', () => {
    const r = parseMutationDef(sporeCloud);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.mutation.grantsAbility?.targetType).toBe('tile');
  });

  it('parses the shipped abyssal_deep_lung fixture (passive maxHp)', () => {
    const r = parseMutationDef(deepLung);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.mutation.modifiers).toEqual([{ kind: 'maxHp', delta: 15 }]);
  });

  // ── Top-level shape ────────────────────────────────────────────────────────

  it('rejects malformed JSON', () => { expectErr(parseMutationDef('{bad'), 'INVALID_JSON'); });
  it('rejects a non-object payload', () => { expectErr(parseMutationDef(7), 'NOT_AN_OBJECT'); });

  it('rejects a missing / wrong / unsupported schemaVersion', () => {
    const noVer = valid();
    delete noVer['schemaVersion'];
    expectErr(parseMutationDef(noVer), 'MISSING_FIELD', 'schemaVersion');
    expectErr(parseMutationDef({ ...valid(), schemaVersion: 'x' }), 'WRONG_TYPE', 'schemaVersion');
    expectErr(parseMutationDef({ ...valid(), schemaVersion: 2 }), 'UNSUPPORTED_SCHEMA_VERSION', 'schemaVersion');
  });

  it('rejects a missing id', () => {
    const t = valid();
    delete t['id'];
    expectErr(parseMutationDef(t), 'MISSING_FIELD', 'id');
  });

  it('rejects an unknown family', () => {
    expectErr(parseMutationDef({ ...valid(), family: 'crystal' }), 'INVALID_VALUE', 'family');
  });

  it('rejects an unknown tier', () => {
    expectErr(parseMutationDef({ ...valid(), tier: 'legendary' }), 'INVALID_VALUE', 'tier');
  });

  it('rejects a missing name', () => {
    const t = valid();
    delete t['name'];
    expectErr(parseMutationDef(t), 'MISSING_FIELD', 'name');
  });

  it('rejects a negative sigBonus', () => {
    expectErr(parseMutationDef({ ...valid(), sigBonus: -1 }), 'INVALID_VALUE', 'sigBonus');
  });

  it('rejects a missing lace line', () => {
    const t = valid();
    delete t['lace'];
    expectErr(parseMutationDef(t), 'MISSING_FIELD', 'lace');
  });

  // ── Modifiers ──────────────────────────────────────────────────────────────

  it('rejects a missing modifiers field', () => {
    const t = valid();
    delete t['modifiers'];
    expectErr(parseMutationDef(t), 'MISSING_FIELD', 'modifiers');
  });

  it('rejects a non-array modifiers', () => {
    expectErr(parseMutationDef({ ...valid(), modifiers: {} }), 'WRONG_TYPE', 'modifiers');
  });

  it('rejects a non-object modifier entry', () => {
    expectErr(parseMutationDef({ ...valid(), modifiers: [3] }), 'WRONG_TYPE', 'modifiers[0]');
  });

  it('rejects an unknown modifier kind', () => {
    expectErr(parseMutationDef({ ...valid(), modifiers: [{ kind: 'resistance', delta: 1 }] }), 'INVALID_VALUE', 'modifiers[0].kind');
  });

  it('rejects a stat modifier with an unknown stat', () => {
    expectErr(parseMutationDef({ ...valid(), modifiers: [{ kind: 'stat', stat: 'luck', delta: 1 }] }), 'INVALID_VALUE', 'modifiers[0].stat');
  });

  it('rejects a stat modifier with a non-integer delta', () => {
    expectErr(parseMutationDef({ ...valid(), modifiers: [{ kind: 'stat', stat: 'str', delta: 1.5 }] }), 'INVALID_VALUE', 'modifiers[0].delta');
  });

  it('rejects a maxHp modifier with a non-integer delta', () => {
    expectErr(parseMutationDef({ ...valid(), modifiers: [{ kind: 'maxHp', delta: 'lots' }] }), 'INVALID_VALUE', 'modifiers[0].delta');
  });

  // ── grantsAbility ────────────────────────────────────────────────────────

  it('rejects a missing grantsAbility field', () => {
    const t = valid();
    delete t['grantsAbility'];
    expectErr(parseMutationDef(t), 'MISSING_FIELD', 'grantsAbility');
  });

  it('rejects a non-object, non-null grantsAbility', () => {
    expectErr(parseMutationDef({ ...valid(), grantsAbility: 5 }), 'WRONG_TYPE', 'grantsAbility');
  });

  it('rejects a granted ability with a missing id', () => {
    const ab = ability();
    delete ab['id'];
    expectErr(parseMutationDef({ ...valid(), grantsAbility: ab }), 'MISSING_FIELD', 'grantsAbility.id');
  });

  it('rejects a granted ability with apCost out of [1,3]', () => {
    expectErr(parseMutationDef({ ...valid(), grantsAbility: { ...ability(), apCost: 4 } }), 'INVALID_VALUE', 'grantsAbility.apCost');
  });

  it('rejects a granted ability with cooldown out of [0,5]', () => {
    expectErr(parseMutationDef({ ...valid(), grantsAbility: { ...ability(), cooldown: 9 } }), 'INVALID_VALUE', 'grantsAbility.cooldown');
  });

  it('rejects a granted ability with a negative range', () => {
    expectErr(parseMutationDef({ ...valid(), grantsAbility: { ...ability(), range: -1 } }), 'INVALID_VALUE', 'grantsAbility.range');
  });

  it('rejects a granted ability with an unknown targetType', () => {
    expectErr(parseMutationDef({ ...valid(), grantsAbility: { ...ability(), targetType: 'ally' } }), 'INVALID_VALUE', 'grantsAbility.targetType');
  });

  it('rejects a granted ability with an unknown damageType', () => {
    expectErr(parseMutationDef({ ...valid(), grantsAbility: { ...ability(), damageType: 'holy' } }), 'INVALID_VALUE', 'grantsAbility.damageType');
  });

  it('rejects a granted ability with a negative intScaling', () => {
    expectErr(parseMutationDef({ ...valid(), grantsAbility: { ...ability(), intScaling: -0.5 } }), 'INVALID_VALUE', 'grantsAbility.intScaling');
  });

  it('rejects a granted ability with a bad appliesStatus', () => {
    expectErr(parseMutationDef({ ...valid(), grantsAbility: { ...ability(), appliesStatus: 'cursed' } }), 'INVALID_VALUE', 'grantsAbility.appliesStatus');
  });

  // ── tags ─────────────────────────────────────────────────────────────────

  it('rejects a missing tags field', () => {
    const t = valid();
    delete t['tags'];
    expectErr(parseMutationDef(t), 'MISSING_FIELD', 'tags');
  });

  it('rejects tags containing non-strings', () => {
    expectErr(parseMutationDef({ ...valid(), tags: ['ok', 5] }), 'WRONG_TYPE', 'tags');
  });

  // ── Retired SIG-as-cost aliases (T-525, DR-007) ──────────────────────────

  it('rejects the retired sigCost / sigGrant aliases outright', () => {
    expectErr(parseMutationDef({ ...valid(), sigCost: 10 }), 'INVALID_VALUE', 'sigCost');
    expectErr(parseMutationDef({ ...valid(), sigGrant: 5 }), 'INVALID_VALUE', 'sigGrant');
    // …even alongside a perfectly valid sigBonus — the alias itself is the defect.
    expectErr(parseMutationDef({ ...valid(), sigBonus: 10, sigCost: 25 }), 'INVALID_VALUE', 'sigCost');
  });

  // ── Purity ───────────────────────────────────────────────────────────────

  it('does not mutate the input', () => {
    const t = valid();
    const snap = structuredClone(t);
    parseMutationDef(t);
    expect(t).toEqual(snap);
  });
});
