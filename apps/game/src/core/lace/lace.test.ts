import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { LaceLine } from '@shared-types/lace-line';
import { Mulberry32, makeRng } from '../rng/mulberry32';
import { parseLaceLines } from './lace-loader';
import { selectLine } from './lace-select';
import { LaceNarrator } from './narrator';

function bundle(lines: Partial<LaceLine>[], schemaVersion = 1): unknown {
  return {
    schemaVersion,
    lines: lines.map((l, i) => ({
      id: `l${i}`, text: 'x', context: 'combat_start', mood: 'neutral', weight: 1, ...l,
    })),
  };
}

describe('parseLaceLines — T-97', () => {
  it('parses a well-formed bundle', () => {
    const res = parseLaceLines(bundle([{ id: 'a', text: 'hi' }, { id: 'b', text: 'yo' }]));
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.lines).toHaveLength(2);
  });

  it('rejects a bad schema version, non-array lines, and bad fields', () => {
    expect(parseLaceLines(bundle([], 2)).ok).toBe(false);
    expect(parseLaceLines({ schemaVersion: 1, lines: 'nope' }).ok).toBe(false);
    expect(parseLaceLines(bundle([{ context: 'nope' as LaceLine['context'] }])).ok).toBe(false);
    expect(parseLaceLines(bundle([{ mood: 'grumpy' as LaceLine['mood'] }])).ok).toBe(false);
    expect(parseLaceLines(bundle([{ weight: 0 }])).ok).toBe(false);
    expect(parseLaceLines(bundle([{ text: '' }])).ok).toBe(false);
  });

  it('rejects duplicate line ids', () => {
    const res = parseLaceLines(bundle([{ id: 'dup' }, { id: 'dup' }]));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.message).toContain('duplicate');
  });
});

describe('selectLine — T-98 / T-102', () => {
  const lines = [
    { id: 'c_neu', text: '', context: 'combat_start', mood: 'neutral', weight: 1 },
    { id: 'c_hos', text: '', context: 'combat_start', mood: 'hostile', weight: 1 },
    { id: 'g1', text: '', context: 'generic', mood: 'neutral', weight: 1 },
  ] as const satisfies readonly LaceLine[];

  it('filters by context', () => {
    const line = selectLine(lines, { context: 'combat_start', mood: 'neutral', spoken: new Set(), rng: new Mulberry32(1) });
    expect(line?.context).toBe('combat_start');
  });

  it('prefers the current mood when a match exists', () => {
    const line = selectLine(lines, { context: 'combat_start', mood: 'hostile', spoken: new Set(), rng: new Mulberry32(1) });
    expect(line?.id).toBe('c_hos');
  });

  it('excludes already-spoken lines', () => {
    const line = selectLine(lines, {
      context: 'combat_start', mood: 'neutral', spoken: new Set(['c_neu']), rng: new Mulberry32(1),
    });
    // Only c_hos remains in the combat pool (mood preference yields nothing → whole pool).
    expect(line?.id).toBe('c_hos');
  });

  it('falls back to the generic pool when no context line is available', () => {
    const line = selectLine(lines, {
      context: 'player_death', mood: 'neutral', spoken: new Set(), rng: new Mulberry32(1),
    });
    expect(line?.context).toBe('generic');
  });

  it('returns null when every candidate pool is exhausted', () => {
    const line = selectLine(lines, {
      context: 'player_death', mood: 'neutral', spoken: new Set(['g1']), rng: new Mulberry32(1),
    });
    expect(line).toBeNull();
  });
});

describe('LaceNarrator — T-103 spoken tracker', () => {
  const lines = [
    { id: 'a', text: '', context: 'combat_start', mood: 'neutral', weight: 1 },
    { id: 'b', text: '', context: 'combat_start', mood: 'neutral', weight: 1 },
  ] as const satisfies readonly LaceLine[];

  it('never repeats a line within a run, then dries up', () => {
    const n = new LaceNarrator(lines, makeRng(1, 'events'));
    const first = n.narrate('combat_start');
    const second = n.narrate('combat_start');
    const third = n.narrate('combat_start');
    expect(first?.id).not.toBe(second?.id);
    expect(new Set([first?.id, second?.id])).toEqual(new Set(['a', 'b']));
    expect(third).toBeNull(); // both spoken, no generic fallback
  });

  it('reset() clears the spoken tracker (death / new run)', () => {
    const n = new LaceNarrator(lines, makeRng(1, 'events'));
    n.narrate('combat_start');
    n.narrate('combat_start');
    expect(n.narrate('combat_start')).toBeNull();
    n.reset();
    expect(n.narrate('combat_start')).not.toBeNull();
  });
});

describe('shipped LACE content', () => {
  it('packages/content/lace-lines/core.json loads cleanly', () => {
    const path = fileURLToPath(new URL('../../../../../packages/content/lace-lines/core.json', import.meta.url));
    const res = parseLaceLines(JSON.parse(readFileSync(path, 'utf-8')));
    expect(res.ok, res.ok ? '' : res.error.message).toBe(true);
    if (res.ok) {
      // Sanity: a generic fallback pool exists so selection rarely returns null.
      expect(res.lines.some((l) => l.context === 'generic')).toBe(true);
    }
  });
});
