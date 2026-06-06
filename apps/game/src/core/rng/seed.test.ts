import { describe, it, expect } from 'vitest';
import {
  GLOBAL_SEED_SALT,
  hashStringToSeed,
  utcDateKey,
  isoWeekKey,
  dailySeed,
  weeklySeed,
} from './seed';

describe('hashStringToSeed', () => {
  it('returns an unsigned 32-bit integer', () => {
    const h = hashStringToSeed('hello');
    expect(Number.isInteger(h)).toBe(true);
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThanOrEqual(0xffffffff);
  });

  it('is deterministic', () => {
    expect(hashStringToSeed('strand')).toBe(hashStringToSeed('strand'));
  });

  it('differs for different inputs', () => {
    expect(hashStringToSeed('a')).not.toBe(hashStringToSeed('b'));
  });
});

describe('utcDateKey', () => {
  it('formats as zero-padded YYYY-MM-DD in UTC', () => {
    expect(utcDateKey(new Date(Date.UTC(2026, 0, 5)))).toBe('2026-01-05');
    expect(utcDateKey(new Date(Date.UTC(2026, 11, 31)))).toBe('2026-12-31');
  });

  it('uses UTC, not local time', () => {
    // 2026-06-06T23:30Z is still the 6th in UTC regardless of the runner's tz.
    expect(utcDateKey(new Date('2026-06-06T23:30:00Z'))).toBe('2026-06-06');
  });
});

describe('isoWeekKey', () => {
  // Reference values from the ISO-8601 standard.
  it('2026-01-01 (Thursday) is 2026-W01', () => {
    expect(isoWeekKey(new Date(Date.UTC(2026, 0, 1)))).toBe('2026-W01');
  });

  it('2021-01-04 (Monday) is 2021-W01', () => {
    expect(isoWeekKey(new Date(Date.UTC(2021, 0, 4)))).toBe('2021-W01');
  });

  it('2023-01-01 (Sunday) belongs to the previous week-year 2022-W52', () => {
    expect(isoWeekKey(new Date(Date.UTC(2023, 0, 1)))).toBe('2022-W52');
  });

  it('2020-12-31 (Thursday) is 2020-W53 (a 53-week year)', () => {
    expect(isoWeekKey(new Date(Date.UTC(2020, 11, 31)))).toBe('2020-W53');
  });

  it('2024-12-30 (Monday) rolls into 2025-W01', () => {
    expect(isoWeekKey(new Date(Date.UTC(2024, 11, 30)))).toBe('2025-W01');
  });

  it('is stable across every day of a single ISO week', () => {
    // Mon 2026-06-01 … Sun 2026-06-07 are all the same ISO week.
    const keys = new Set<string>();
    for (let day = 1; day <= 7; day++) {
      keys.add(isoWeekKey(new Date(Date.UTC(2026, 5, day))));
    }
    expect(keys.size).toBe(1);
  });
});

describe('dailySeed — T-54', () => {
  it('is identical for two instants on the same UTC day', () => {
    const morning = new Date('2026-06-06T00:01:00Z');
    const night = new Date('2026-06-06T23:59:00Z');
    expect(dailySeed(morning)).toBe(dailySeed(night));
  });

  it('differs across consecutive days', () => {
    const d1 = new Date(Date.UTC(2026, 5, 6));
    const d2 = new Date(Date.UTC(2026, 5, 7));
    expect(dailySeed(d1)).not.toBe(dailySeed(d2));
  });

  it('returns an unsigned 32-bit seed', () => {
    const s = dailySeed(new Date(Date.UTC(2026, 5, 6)));
    expect(s).toBeGreaterThanOrEqual(0);
    expect(s).toBeLessThanOrEqual(0xffffffff);
  });

  it('folds in the global salt', () => {
    const date = new Date(Date.UTC(2026, 5, 6));
    expect(dailySeed(date)).toBe(hashStringToSeed(`2026-06-06|${GLOBAL_SEED_SALT}`));
  });
});

describe('weeklySeed — T-55', () => {
  it('is identical for every day within one ISO week', () => {
    const mon = new Date(Date.UTC(2026, 5, 1));
    const sun = new Date(Date.UTC(2026, 5, 7));
    expect(weeklySeed(mon)).toBe(weeklySeed(sun));
  });

  it('differs across consecutive weeks', () => {
    const w1 = new Date(Date.UTC(2026, 5, 1));
    const w2 = new Date(Date.UTC(2026, 5, 8));
    expect(weeklySeed(w1)).not.toBe(weeklySeed(w2));
  });

  it('differs from the daily seed for the same date', () => {
    const date = new Date(Date.UTC(2026, 5, 6));
    expect(weeklySeed(date)).not.toBe(dailySeed(date));
  });
});
