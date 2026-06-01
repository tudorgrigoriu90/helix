import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { LaceLine } from '@shared-types/lace-line';
import { Mulberry32, makeRng } from '../rng/mulberry32';
import { parseLaceLines } from './lace-loader';
import { selectLine } from './lace-select';
import { LaceMoodMachine, MOOD_THRESHOLD, driftPressure } from './lace-mood';
import { assembleLine, type LaceGrammar } from './lace-grammar';
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
    { id: 'c_amu', text: '', context: 'combat_start', mood: 'amused', weight: 1 },
    { id: 'g1', text: '', context: 'generic', mood: 'neutral', weight: 1 },
  ] as const satisfies readonly LaceLine[];

  it('filters by context', () => {
    const line = selectLine(lines, { context: 'combat_start', mood: 'neutral', spoken: new Set(), rng: new Mulberry32(1) });
    expect(line?.context).toBe('combat_start');
  });

  it('prefers the current mood when a match exists', () => {
    const line = selectLine(lines, { context: 'combat_start', mood: 'amused', spoken: new Set(), rng: new Mulberry32(1) });
    expect(line?.id).toBe('c_amu');
  });

  it('excludes already-spoken lines', () => {
    const line = selectLine(lines, {
      context: 'combat_start', mood: 'neutral', spoken: new Set(['c_neu']), rng: new Mulberry32(1),
    });
    // Only c_amu remains in the combat pool (mood preference yields nothing → whole pool).
    expect(line?.id).toBe('c_amu');
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

describe('LaceMoodMachine — T-99 mood state machine', () => {
  it('rests at neutral until a mood clears the threshold', () => {
    const m = new LaceMoodMachine();
    expect(m.mood).toBe('neutral');
    // new_floor pushes curious by 1 — below MOOD_THRESHOLD (3), so still neutral.
    m.signal('new_floor');
    m.signal('new_floor');
    expect(m.mood).toBe('neutral');
    expect(m.signal('new_floor')).toBe('curious'); // 3rd → reaches threshold
  });

  it('lands strong, rare signals (Floor 16+, Hybrid Synergy) in a single hit', () => {
    expect(new LaceMoodMachine().signal('deep_floor')).toBe('reverent');
    expect(new LaceMoodMachine().signal('hybrid_synergy')).toBe('reverent');
  });

  it('requires a sustained pattern for the "many"/"loops" triggers', () => {
    const defensive = new LaceMoodMachine();
    defensive.signal('defensive_play');
    defensive.signal('defensive_play');
    expect(defensive.mood).toBe('neutral'); // two isn't "many"
    expect(defensive.signal('defensive_play')).toBe('clinical');

    const deaths = new LaceMoodMachine();
    expect(deaths.signal('death_loop')).toBe('neutral'); // one death isn't a loop (weight 2)
    expect(deaths.signal('death_loop')).toBe('contemptuous');
  });

  it('maps each GDD §10.1 trigger to its mood', () => {
    // Drive each mood past the threshold from a fresh machine.
    const drive = (...signals: Parameters<LaceMoodMachine['signal']>[0][]) => {
      const m = new LaceMoodMachine();
      let mood = m.mood;
      for (const s of signals) mood = m.signal(s);
      return mood;
    };
    expect(drive('unexpected_build', 'new_floor')).toBe('curious'); // 2 + 1 = 3
    expect(drive('risky_play', 'risky_play', 'risky_play')).toBe('amused');
    expect(drive('defensive_play', 'defensive_play', 'defensive_play')).toBe('clinical');
    expect(drive('death_loop', 'death_loop')).toBe('contemptuous');
    expect(drive('deep_floor')).toBe('reverent');
  });

  it('breaks ties toward the more intense mood', () => {
    const m = new LaceMoodMachine({ curious: MOOD_THRESHOLD, reverent: MOOD_THRESHOLD });
    expect(m.mood).toBe('reverent');
  });

  it('is deterministic given the same signal history (no RNG)', () => {
    const history: Parameters<LaceMoodMachine['signal']>[0][] = ['risky_play', 'deep_floor', 'defensive_play'];
    const a = new LaceMoodMachine();
    const b = new LaceMoodMachine();
    for (const s of history) {
      a.signal(s);
      b.signal(s);
    }
    expect(a.mood).toBe(b.mood);
    expect(a.pressures).toEqual(b.pressures);
  });

  it('seeds from a persisted pressure snapshot (the T-100 seam)', () => {
    const seeded = new LaceMoodMachine({ reverent: MOOD_THRESHOLD });
    expect(seeded.mood).toBe('reverent');
    expect(new LaceMoodMachine(seeded.pressures).mood).toBe('reverent');
  });
});

describe('driftPressure — T-100 drift toward neutral', () => {
  it('halves each mood toward zero, flooring (deterministic, pure)', () => {
    const before = { curious: 5, clinical: 0, amused: 2, contemptuous: 1, reverent: 9 };
    expect(driftPressure(before)).toEqual({ curious: 2, clinical: 0, amused: 1, contemptuous: 0, reverent: 4 });
    expect(before.reverent).toBe(9); // input untouched
  });

  it('drifts a sustained mood back to neutral over successive quiet runs', () => {
    let p = { curious: 0, clinical: 0, amused: 0, contemptuous: 0, reverent: MOOD_THRESHOLD };
    expect(new LaceMoodMachine(p).mood).toBe('reverent');
    p = driftPressure(p); // 3 → 1, now below threshold
    expect(new LaceMoodMachine(p).mood).toBe('neutral');
    p = driftPressure(p); // 1 → 0
    expect(p.reverent).toBe(0);
  });

  it('applies multiple steps at once', () => {
    const p = { curious: 8, clinical: 0, amused: 0, contemptuous: 0, reverent: 0 };
    expect(driftPressure(p, 3).curious).toBe(1); // 8 → 4 → 2 → 1
  });
});

describe('LaceNarrator — T-99 mood integration', () => {
  const lines = [
    { id: 'n', text: '', context: 'combat_start', mood: 'neutral', weight: 1 },
    { id: 'r', text: '', context: 'combat_start', mood: 'reverent', weight: 1 },
  ] as const satisfies readonly LaceLine[];

  it('narrates in the mood driven by player-behaviour signals', () => {
    const n = new LaceNarrator(lines, makeRng(1, 'events'));
    expect(n.mood).toBe('neutral');
    expect(n.narrate('combat_start')?.id).toBe('n'); // neutral preferred
    n.signalMood('hybrid_synergy'); // → reverent in one hit
    expect(n.mood).toBe('reverent');
    expect(n.narrate('combat_start')?.id).toBe('r'); // now the reverent line
  });

  it('keeps mood across reset() — only the spoken tracker clears', () => {
    const n = new LaceNarrator(lines, makeRng(1, 'events'));
    n.signalMood('deep_floor');
    expect(n.mood).toBe('reverent');
    n.reset();
    expect(n.mood).toBe('reverent'); // mood persists; drift toward neutral is T-100
  });
});

describe('assembleLine — T-101 templated grammar assembly', () => {
  const grammar = {
    templates: [
      { id: 't_combat', pattern: '{opener} {observation}', context: 'combat_start', weight: 1 },
    ],
    fragments: [
      { id: 'op_n', slot: 'opener', text: 'They approach.', context: 'combat_start', mood: 'neutral', weight: 1 },
      { id: 'op_a', slot: 'opener', text: 'Oh, this should be fun.', context: 'combat_start', mood: 'amused', weight: 1 },
      { id: 'ob_myc', slot: 'observation', text: 'Your roots remember.', family: 'mycelial', weight: 1 },
      { id: 'ob_any', slot: 'observation', text: 'The data accrues.', weight: 1 },
    ],
  } as const satisfies LaceGrammar;

  it('fills every template slot from matching fragments', () => {
    const line = assembleLine(grammar, { context: 'combat_start', mood: 'neutral', rng: new Mulberry32(1) });
    expect(line).not.toBeNull();
    expect(line).not.toContain('{'); // no unfilled slots
    expect(line!.split(' ').length).toBeGreaterThanOrEqual(3);
  });

  it('prefers exact-mood fragments, else the whole matching pool', () => {
    // amused mood → the amused opener is the only mood-match, so it must be chosen.
    const line = assembleLine(grammar, { context: 'combat_start', mood: 'amused', rng: new Mulberry32(7) });
    expect(line?.startsWith('Oh, this should be fun.')).toBe(true);
  });

  it('respects family tags: the mycelial fragment only applies to that family', () => {
    // No family in the request → the family-tagged fragment is excluded; only the
    // wildcard observation can fill the slot, so it always wins.
    for (let seed = 0; seed < 20; seed++) {
      const line = assembleLine(grammar, { context: 'combat_start', mood: 'neutral', rng: new Mulberry32(seed) });
      expect(line?.endsWith('The data accrues.')).toBe(true);
    }
    // With the family present, the family-flavoured fragment becomes eligible.
    const seen = new Set<string>();
    for (let seed = 0; seed < 40; seed++) {
      const line = assembleLine(grammar, { context: 'combat_start', mood: 'neutral', family: 'mycelial', rng: new Mulberry32(seed) });
      if (line?.endsWith('Your roots remember.')) seen.add('myc');
    }
    expect(seen.has('myc')).toBe(true);
  });

  it('returns null when no template matches or a slot cannot be filled', () => {
    expect(assembleLine(grammar, { context: 'player_death', mood: 'neutral', rng: new Mulberry32(1) })).toBeNull();
    const noFill: LaceGrammar = {
      templates: [{ id: 't', pattern: '{missing}', context: 'combat_start', weight: 1 }],
      fragments: [],
    };
    expect(assembleLine(noFill, { context: 'combat_start', mood: 'neutral', rng: new Mulberry32(1) })).toBeNull();
  });

  it('is deterministic for a given RNG state', () => {
    const a = assembleLine(grammar, { context: 'combat_start', mood: 'neutral', rng: new Mulberry32(99) });
    const b = assembleLine(grammar, { context: 'combat_start', mood: 'neutral', rng: new Mulberry32(99) });
    expect(b).toBe(a);
  });

  it('reuses one fill when a slot token repeats', () => {
    const echo: LaceGrammar = {
      templates: [{ id: 't', pattern: '{x}... {x}.', context: 'generic', weight: 1 }],
      fragments: [{ id: 'f', slot: 'x', text: 'listen', context: 'generic', weight: 1 }],
    };
    expect(assembleLine(echo, { context: 'generic', mood: 'neutral', rng: new Mulberry32(1) })).toBe('listen... listen.');
  });
});

describe('LaceNarrator — T-101 grammar fallback', () => {
  const lines = [{ id: 'a', text: 'authored', context: 'combat_start', mood: 'neutral', weight: 1 }] as const satisfies readonly LaceLine[];
  const grammar: LaceGrammar = {
    templates: [{ id: 't', pattern: '{f}', context: 'combat_start', weight: 1 }],
    fragments: [{ id: 'f', slot: 'f', text: 'assembled', context: 'combat_start', weight: 1 }],
  };

  it('prefers authored lines, then assembles from grammar when they run dry', () => {
    const n = new LaceNarrator(lines, makeRng(1, 'events'), new LaceMoodMachine(), grammar);
    expect(n.narrate('combat_start')?.text).toBe('authored'); // authored first
    const fallback = n.narrate('combat_start'); // authored pool now exhausted
    expect(fallback?.text).toBe('assembled');
    expect(fallback?.id).toBe('grammar:combat_start');
  });

  it('returns null when neither an authored line nor grammar can produce one', () => {
    const n = new LaceNarrator(lines, makeRng(1, 'events'), new LaceMoodMachine(), grammar);
    n.narrate('combat_start'); // consume authored
    n.narrate('combat_start'); // grammar still produces
    // A context with no authored line and no template → null.
    expect(n.narrate('boss_killed')).toBeNull();
  });

  it('without a grammar corpus, behaves exactly as before (authored-only)', () => {
    const n = new LaceNarrator(lines, makeRng(1, 'events'));
    expect(n.narrate('combat_start')?.text).toBe('authored');
    expect(n.narrate('combat_start')).toBeNull(); // no grammar fallback
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
