import { describe, it, expect } from 'vitest';
import type { PlayerState } from '@shared-types/run-state';
import type { LoadResult } from '../save/save-manager';
import { decideResume } from './resume-decision';
import { CURRENT_RUN_SESSION_SAVE_VERSION, type RunSessionSave, type RunStatus } from './run-session';

const player = { id: 'player', hp: 10, maxHp: 10 } as unknown as PlayerState;

function save(status: RunStatus, extra: Partial<RunSessionSave> = {}): LoadResult<RunSessionSave> {
  return {
    ok: true,
    value: {
      schemaVersion: CURRENT_RUN_SESSION_SAVE_VERSION,
      seed: 1, floorNumber: 3, currentRoomId: 'r0', clearedRoomIds: [], status, player,
      ...extra,
    },
  };
}

describe('decideResume — T-117 (S100 trigger logic)', () => {
  it('prompts S100 for a live run, summarising floor + status', () => {
    const d = decideResume(save('exploring'));
    expect(d.kind).toBe('prompt');
    if (d.kind === 'prompt') {
      expect(d.summary.floorNumber).toBe(3);
      expect(d.summary.status).toBe('exploring');
      expect(d.summary.inCombat).toBe(false);
    }
  });

  it('flags a mid-combat resume when the save carries a live encounter', () => {
    const withCombat = save('in_combat', { combat: { player } as unknown as RunSessionSave['combat'] });
    const d = decideResume(withCombat);
    expect(d.kind).toBe('prompt');
    if (d.kind === 'prompt') expect(d.summary.inCombat).toBe(true);
  });

  it('does not flag in-combat when the status is in_combat but no encounter was persisted', () => {
    const d = decideResume(save('in_combat')); // degraded / unsynced save
    if (d.kind === 'prompt') expect(d.summary.inCombat).toBe(false);
  });

  it('starts fresh when there is no save on disk', () => {
    expect(decideResume(null).kind).toBe('fresh');
  });

  it('starts fresh when the save failed to load or migrate (E011 robustness)', () => {
    const failed: LoadResult<RunSessionSave> = { ok: false, error: { code: 'CORRUPT', message: 'x' } };
    expect(decideResume(failed).kind).toBe('fresh');
  });

  it('does not offer to resume a finished run', () => {
    expect(decideResume(save('victory')).kind).toBe('fresh');
    expect(decideResume(save('defeat')).kind).toBe('fresh');
  });

  it('offers resume from a Strand Event or floor-complete pause', () => {
    expect(decideResume(save('strand_event')).kind).toBe('prompt');
    expect(decideResume(save('floor_complete')).kind).toBe('prompt');
  });
});

describe('decideResume — descent checkpoints (T-510, DR-009)', () => {
  it('a checkpointed save yields the Continue Descent card, not the S100 modal', () => {
    const d = decideResume(save('floor_complete', {
      floorNumber: 5,
      checkpoint: { floor: 5, act: 1 },
    }));
    expect(d.kind).toBe('checkpoint');
    if (d.kind === 'checkpoint') {
      expect(d.summary.nextFloor).toBe(6);
      expect(d.summary.nextAct).toBe(2);
      expect(d.summary.nextZone).toBe('mycosphere');
      expect(d.save.checkpoint).toEqual({ floor: 5, act: 1 });
    }
  });

  it('a floor_complete save without a checkpoint keeps the S100 prompt', () => {
    expect(decideResume(save('floor_complete')).kind).toBe('prompt');
  });

  it('a mid-floor save with a stale checkpoint field still prompts (status gate)', () => {
    expect(decideResume(save('exploring', { checkpoint: { floor: 5, act: 1 } })).kind).toBe('prompt');
  });
});
