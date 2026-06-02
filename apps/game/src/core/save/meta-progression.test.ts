import { describe, it, expect } from 'vitest';
import { newMetaState } from './meta-save';
import { recordRunOutcome, shouldShowTutorial, markTutorialComplete } from './meta-progression';

describe('recordRunOutcome — T-111 meta-progression', () => {
  it('increments runs and (on a win) wins', () => {
    const after = recordRunOutcome(newMetaState(), {
      won: true, floorReached: 2, enemiesKilled: 5, playtimeMs: 60000,
    });
    expect(after.lifetime.runs).toBe(1);
    expect(after.lifetime.wins).toBe(1);
  });

  it('does not count a loss as a win', () => {
    const after = recordRunOutcome(newMetaState(), {
      won: false, floorReached: 1, enemiesKilled: 2, playtimeMs: 1000,
    });
    expect(after.lifetime.runs).toBe(1);
    expect(after.lifetime.wins).toBe(0);
  });

  it('tracks the deepest floor as a max, not the latest', () => {
    let m = recordRunOutcome(newMetaState(), { won: false, floorReached: 3, enemiesKilled: 0, playtimeMs: 0 });
    m = recordRunOutcome(m, { won: false, floorReached: 1, enemiesKilled: 0, playtimeMs: 0 });
    expect(m.lifetime.deepestFloor).toBe(3);
  });

  it('accumulates kills and playtime across runs', () => {
    let m = recordRunOutcome(newMetaState(), { won: false, floorReached: 1, enemiesKilled: 4, playtimeMs: 1000 });
    m = recordRunOutcome(m, { won: true, floorReached: 2, enemiesKilled: 6, playtimeMs: 2000 });
    expect(m.lifetime.enemiesKilled).toBe(10);
    expect(m.lifetime.totalPlaytimeMs).toBe(3000);
  });

  it('unions codex + achievement ids without duplicates', () => {
    let m = recordRunOutcome(newMetaState(), {
      won: false, floorReached: 1, enemiesKilled: 0, playtimeMs: 0,
      codexFound: ['codex_01'], achievementsEarned: ['first_blood'],
    });
    m = recordRunOutcome(m, {
      won: false, floorReached: 1, enemiesKilled: 0, playtimeMs: 0,
      codexFound: ['codex_01', 'codex_02'],
    });
    expect([...m.codexEntryIds].sort()).toEqual(['codex_01', 'codex_02']);
    expect(m.achievementIds).toEqual(['first_blood']);
  });

  it('clamps negative kills/playtime to zero (defensive)', () => {
    const after = recordRunOutcome(newMetaState(), {
      won: false, floorReached: 1, enemiesKilled: -5, playtimeMs: -100,
    });
    expect(after.lifetime.enemiesKilled).toBe(0);
    expect(after.lifetime.totalPlaytimeMs).toBe(0);
  });

  it('is pure — does not mutate the input', () => {
    const before = newMetaState();
    recordRunOutcome(before, { won: true, floorReached: 5, enemiesKilled: 9, playtimeMs: 5 });
    expect(before.lifetime.runs).toBe(0);
  });

  it("persists this run's LACE mood, drifted one step toward neutral (T-100)", () => {
    const after = recordRunOutcome(newMetaState(), {
      won: false, floorReached: 1, enemiesKilled: 0, playtimeMs: 0,
      laceMoodPressure: { curious: 0, clinical: 0, amused: 0, contemptuous: 0, reverent: 4 },
    });
    expect(after.laceMood.reverent).toBe(2); // floor(4 × 0.5)
  });

  it('drifts the carried-over mood even when the run reports none', () => {
    const seeded = {
      ...newMetaState(),
      laceMood: { curious: 0, clinical: 0, amused: 0, contemptuous: 0, reverent: 3 },
    };
    const after = recordRunOutcome(seeded, { won: false, floorReached: 1, enemiesKilled: 0, playtimeMs: 0 });
    expect(after.laceMood.reverent).toBe(1); // floor(3 × 0.5) — fades on a quiet run too
  });
});

describe('tutorial skip flag — T-143', () => {
  it('a fresh profile should see the tutorial', () => {
    expect(shouldShowTutorial(newMetaState())).toBe(true);
  });

  it('markTutorialComplete flips the flag so returning players skip it', () => {
    const done = markTutorialComplete(newMetaState());
    expect(done.tutorialComplete).toBe(true);
    expect(shouldShowTutorial(done)).toBe(false);
  });

  it('is pure and idempotent', () => {
    const fresh = newMetaState();
    markTutorialComplete(fresh);
    expect(fresh.tutorialComplete).toBe(false); // input untouched
    const done = markTutorialComplete(fresh);
    expect(markTutorialComplete(done)).toBe(done); // already complete → same object
  });
});
