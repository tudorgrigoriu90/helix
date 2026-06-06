/**
 * Deterministic seed sources — T-54 / T-55 (TDD §6.2).
 *
 * Daily Sigma and the Weekly Challenge must hand *every player worldwide the
 * same run* for a given UTC day / ISO week. The seed is therefore a pure
 * function of a calendar key plus a fixed global salt — no randomness, no
 * per-device state — so two installs computing it on the same day land on the
 * identical 32-bit root seed and thus the identical floor layout, enemies, and
 * loot once fed into the run generator.
 *
 * The 32-bit output matches {@link Mulberry32}'s seed width (TDD §6.1).
 */

/**
 * Domain-separating salt mixed into every date-derived seed. Not a secret — it
 * ships in the client — but it (a) stops the bare date string from trivially
 * revealing the seed and (b) lets a future season bump the salt to rotate the
 * whole daily/weekly rotation without changing the date maths.
 */
export const GLOBAL_SEED_SALT = 'strand-descent:sigma:v1';

/**
 * djb2 string hash → unsigned 32-bit int. Same algorithm the run generator uses
 * internally, so seed derivation is consistent across the engine.
 */
export function hashStringToSeed(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(h, 33) ^ s.charCodeAt(i)) >>> 0;
  }
  return h >>> 0;
}

/** UTC calendar date as `YYYY-MM-DD` (zero-padded). The daily rotation key. */
export function utcDateKey(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * ISO-8601 week key as `YYYY-Www` using the ISO week-numbering year. ISO weeks
 * start Monday and week 1 is the week containing the year's first Thursday, so
 * the week-year can differ from the calendar year at the boundaries (e.g.
 * 2023-01-01 falls in 2022-W52). The weekly rotation key.
 */
export function isoWeekKey(date: Date): string {
  // Work on a UTC copy pinned to midnight to avoid DST/tz drift.
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  // Shift to the Thursday of the current ISO week (Mon=0 … Sun=6).
  const dayNr = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNr + 3);
  // The ISO week-year is the year of that Thursday.
  const isoYear = target.getUTCFullYear();
  // Week 1 is the week of the first Thursday; January 4th is always in week 1.
  const firstThursday = new Date(Date.UTC(isoYear, 0, 4));
  const firstDayNr = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNr + 3);
  const week = 1 + Math.round((target.getTime() - firstThursday.getTime()) / (7 * 24 * 60 * 60 * 1000));
  return `${isoYear}-W${String(week).padStart(2, '0')}`;
}

/**
 * Daily Sigma seed: `hash(utcDate + globalSalt)` (T-54). Defaults to "now", but
 * accepts an explicit date so it's pure and testable.
 */
export function dailySeed(date: Date = new Date()): number {
  return hashStringToSeed(`${utcDateKey(date)}|${GLOBAL_SEED_SALT}`);
}

/**
 * Weekly Challenge seed: `hash(isoWeek + globalSalt)` (T-55). Defaults to "now",
 * but accepts an explicit date so it's pure and testable.
 */
export function weeklySeed(date: Date = new Date()): number {
  return hashStringToSeed(`${isoWeekKey(date)}|${GLOBAL_SEED_SALT}`);
}
