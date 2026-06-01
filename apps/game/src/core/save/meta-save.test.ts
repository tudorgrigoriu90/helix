import { describe, it, expect } from 'vitest';
import { CURRENT_META_SCHEMA_VERSION } from '@shared-types/meta-state';
import { deserializeMetaState, newMetaState, serializeMetaState } from './meta-save';

const ZERO_MOOD = { curious: 0, clinical: 0, amused: 0, contemptuous: 0, reverent: 0 };

describe('MetaState save — T-111', () => {
  it('a fresh profile is empty with zeroed lifetime stats', () => {
    const m = newMetaState();
    expect(m.codexEntryIds).toEqual([]);
    expect(m.sigmaStrainIds).toEqual([]);
    expect(m.lifetime).toEqual({ runs: 0, wins: 0, deepestFloor: 0, enemiesKilled: 0, totalPlaytimeMs: 0 });
  });

  it('round-trips serialise → deserialise', () => {
    const m = {
      ...newMetaState(),
      codexEntryIds: ['codex_01'],
      achievementIds: ['first_blood'],
      lifetime: { runs: 4, wins: 1, deepestFloor: 3, enemiesKilled: 42, totalPlaytimeMs: 90000 },
    };
    const res = deserializeMetaState(serializeMetaState(m));
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.meta).toEqual(m);
  });

  it('rejects invalid / corrupt / newer-version meta saves', () => {
    expect(deserializeMetaState('{ bad').ok).toBe(false);
    expect(deserializeMetaState('{}').ok).toBe(false);
    const corrupt = deserializeMetaState(JSON.stringify({ ...newMetaState(), lifetime: 5 }));
    expect(corrupt.ok).toBe(false);
    if (!corrupt.ok) expect(corrupt.error.code).toBe('CORRUPT');
    const newer = deserializeMetaState(JSON.stringify({ ...newMetaState(), schemaVersion: 99 }));
    expect(newer.ok).toBe(false);
    if (!newer.ok) expect(newer.error.code).toBe('UNMIGRATABLE');
  });
});

describe('MetaState migration — T-100 (laceMood) / T-113 (shardCrystals)', () => {
  const baseFields = {
    codexEntryIds: [], sigmaStrainIds: [], achievementIds: [], cosmeticIds: [],
    lifetime: { runs: 2, wins: 1, deepestFloor: 3, enemiesKilled: 5, totalPlaytimeMs: 10 },
  };

  it('migrates a v1 save forward (back-fills shardCrystals then laceMood)', () => {
    const res = deserializeMetaState(JSON.stringify({ schemaVersion: 1, ...baseFields }));
    expect(res.ok, res.ok ? '' : res.error.message).toBe(true);
    if (res.ok) {
      expect(res.meta.schemaVersion).toBe(CURRENT_META_SCHEMA_VERSION);
      expect(res.meta.shardCrystals).toBe(0);
      expect(res.meta.laceMood).toEqual(ZERO_MOOD);
      expect(res.meta.lifetime.runs).toBe(2); // pre-existing data preserved
    }
  });

  it('migrates a v2 save forward (keeps shardCrystals, back-fills laceMood)', () => {
    const res = deserializeMetaState(JSON.stringify({ schemaVersion: 2, shardCrystals: 12.5, ...baseFields }));
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.meta.schemaVersion).toBe(CURRENT_META_SCHEMA_VERSION);
      expect(res.meta.shardCrystals).toBe(12.5); // not clobbered
      expect(res.meta.laceMood).toEqual(ZERO_MOOD);
    }
  });
});
