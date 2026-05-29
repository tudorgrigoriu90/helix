import { describe, it, expect } from 'vitest';
import type { RunState } from '@shared-types/run-state';
import {
  CURRENT_RUN_SCHEMA_VERSION,
  deserializeRunState,
  migrate,
  serializeRunState,
  type Migration,
} from './run-save';

function runState(): RunState {
  return {
    schemaVersion: CURRENT_RUN_SCHEMA_VERSION,
    seed: 123,
    floorNumber: 2,
    phase: 'player',
    turn: 5,
    grid: { width: 3, height: 2, tiles: ['open', 'wall', 'open', 'open', 'hazard', 'open'] },
    player: {
      id: 'player', pos: { x: 1, y: 1 }, hp: 40, maxHp: 80, ap: 2, maxAp: 3,
      stats: { str: 10, res: 6, agi: 8, int: 8 }, statuses: [], abilities: [], items: [], mutations: [],
    },
    enemies: [],
  };
}

describe('RunState save round-trip — T-110', () => {
  it('serialise → deserialise reproduces the state exactly', () => {
    const state = runState();
    const res = deserializeRunState(serializeRunState(state));
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.state).toEqual(state);
  });

  it('rejects invalid JSON / non-objects / missing version', () => {
    expect(deserializeRunState('{ bad').ok).toBe(false);
    expect(deserializeRunState('42').ok).toBe(false);
    expect(deserializeRunState('{}').ok).toBe(false);
  });

  it('rejects a save from a newer (unknown) schema version', () => {
    const res = deserializeRunState(JSON.stringify({ ...runState(), schemaVersion: 99 }));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('UNMIGRATABLE');
  });

  it('rejects a corrupt/truncated save (grid tiles length mismatch)', () => {
    const bad = { ...runState(), grid: { width: 3, height: 2, tiles: ['open'] } };
    const res = deserializeRunState(JSON.stringify(bad));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('CORRUPT');
  });
});

describe('migration framework — T-115', () => {
  it('is a no-op when already at the target version', () => {
    const data = { schemaVersion: 1, x: 1 };
    const res = migrate(data, 1, 1, {});
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data).toEqual(data);
  });

  it('applies a chain of migrations in order', () => {
    const migrations: Record<number, Migration> = {
      0: (d) => ({ ...d, schemaVersion: 1, step0: true }),
      1: (d) => ({ ...d, schemaVersion: 2, step1: true }),
    };
    const res = migrate({ schemaVersion: 0 }, 0, 2, migrations);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data).toEqual({ schemaVersion: 2, step0: true, step1: true });
  });

  it('fails when a step in the chain is missing', () => {
    const res = migrate({ schemaVersion: 0 }, 0, 2, { 0: (d) => ({ ...d, schemaVersion: 1 }) });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('UNMIGRATABLE');
  });
});
