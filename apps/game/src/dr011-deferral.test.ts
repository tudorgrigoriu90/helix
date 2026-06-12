import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { FEATURE_DEFAULTS } from './platform/firebase/remote-config';

/**
 * DR-011 deferral guard — T-533.
 *
 * Live-ops (Daily Signal, Weekly Challenge, leaderboards incl. the replay
 * anti-cheat submission path, Prestige) are deferred until **post-Gate-2** by
 * decision, with two mechanical consequences this suite enforces:
 *
 *   1. Every backend feature flag stays hard-coded OFF in the shipped binary
 *      (the T-40 kill-switch defaults).
 *   2. No player-facing surface references the deferred features — no Hub
 *      entry point, no scene wiring, no Cloud Function endpoints. The pure
 *      deterministic seed helpers (T-54/T-55, `core/rng/seed.ts`) are
 *      explicitly allowed: they are math, not surface.
 *
 * If you are reading this because the test failed: building a deferred
 * feature is a *decision change*, not a code change. Re-scope it against
 * DR-011 (docs/Strand Descent — Product Review & Task Plan.md, Part 3) first,
 * then gate the new surface behind its Remote Config flag and update this
 * guard deliberately.
 */

const SCENES_DIR = fileURLToPath(new URL('./scenes/', import.meta.url));
const FUNCTIONS_SRC = fileURLToPath(new URL('../../functions/src/', import.meta.url));

/** Source patterns that would indicate a deferred feature grew a surface. */
const DEFERRED_SURFACE = [
  /dailySignal/i,
  /daily[_-]signal/i,
  /weeklyChallenge/i,
  /weekly[_-]challenge/i,
  /leaderboard/i,
  /prestige/i,
] as const;

function sourceFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { recursive: true })
    .map(String)
    .filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'))
    .map((f) => `${dir}${f}`);
}

describe('DR-011 deferral enforcement — T-533', () => {
  it('every backend feature flag defaults OFF in the binary (T-40)', () => {
    for (const [flag, value] of Object.entries(FEATURE_DEFAULTS)) {
      expect(value, `${flag} must default OFF until post-Gate-2 (DR-011)`).toBe(false);
    }
  });

  it('no scene exposes a deferred live-ops surface (Hub entries stay hidden)', () => {
    const offenders: string[] = [];
    for (const file of sourceFiles(SCENES_DIR)) {
      const src = readFileSync(file, 'utf-8');
      for (const pattern of DEFERRED_SURFACE) {
        if (pattern.test(src)) offenders.push(`${file.replace(SCENES_DIR, 'scenes/')} matches ${String(pattern)}`);
      }
    }
    expect(offenders, offenders.join('\n')).toEqual([]);
  });

  it('no Cloud Function implements a deferred feature (Blaze stays unprovoked)', () => {
    const offenders: string[] = [];
    for (const file of sourceFiles(FUNCTIONS_SRC)) {
      const src = readFileSync(file, 'utf-8');
      for (const pattern of DEFERRED_SURFACE) {
        if (pattern.test(src)) offenders.push(`${file.replace(FUNCTIONS_SRC, 'functions/src/')} matches ${String(pattern)}`);
      }
    }
    expect(offenders, offenders.join('\n')).toEqual([]);
  });

  it('the deterministic seed helpers stay pure math, free of feature wiring', () => {
    const seedSrc = readFileSync(
      fileURLToPath(new URL('./core/rng/seed.ts', import.meta.url)),
      'utf-8',
    );
    // The allowed module must not import platform/scene code (no surface creep).
    expect(seedSrc).not.toMatch(/from '.*(platform|scenes)/);
    expect(seedSrc).not.toMatch(/featureEnabled/);
  });
});
