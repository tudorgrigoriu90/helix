import { describe, it, expect } from 'vitest';
import { deserializeMetaState, newMetaState, serializeMetaState } from './meta-save';

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
