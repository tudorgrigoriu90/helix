import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseLaceLines } from './lace-loader';
import { lintLaceText, lintLaceCorpus, hasContraction, MAX_CONTRACTION_RATE } from './voice-lint';
import { WARDEN_LINES } from './warden-lines';

/**
 * T-530 — the LACE voice gate (`pnpm validate`).
 *
 * Every shipped line must pass the App D voice bible; the rules themselves are
 * unit-tested below so a loosened linter can't pass silently.
 */

const LINES_DIR = fileURLToPath(new URL('../../../../../packages/content/lace-lines/', import.meta.url));

function shippedLines(): { id: string; text: string }[] {
  return readdirSync(LINES_DIR)
    .filter((f) => f.endsWith('.json'))
    .flatMap((f) => {
      const res = parseLaceLines(JSON.parse(readFileSync(`${LINES_DIR}${f}`, 'utf-8')));
      if (!res.ok) throw new Error(`${f}: ${res.error.message}`);
      return [...res.lines];
    });
}

describe('LACE voice linter rules — T-530 (GDD App D)', () => {
  it('flags exclamation marks', () => {
    expect(lintLaceText('x', 'Impressive!')).toContainEqual(
      expect.objectContaining({ rule: 'exclamation' }),
    );
  });

  it('flags command-mood sentence openings, including mid-line sentences', () => {
    expect(lintLaceText('x', 'Walk to the door.')).toContainEqual(
      expect.objectContaining({ rule: 'command_opening' }),
    );
    expect(lintLaceText('x', 'Pressure. Choose. Quickly.')).toContainEqual(
      expect.objectContaining({ rule: 'command_opening' }),
    );
    // Statements that merely contain a verb are fine.
    expect(lintLaceText('x', 'The door is the only direction that matters.')).toEqual([]);
  });

  it('flags the "what LACE never says" list and meta-UI words', () => {
    for (const bad of ['Good job.', 'Well done.', 'You died.', 'Perhaps try again.', 'You win.', 'The button glows.', 'A new screen opens.']) {
      expect(lintLaceText('x', bad).some((i) => i.rule === 'banned_phrase'), bad).toBe(true);
    }
    // "the strand severed" is the sanctioned alternative.
    expect(lintLaceText('x', 'The strand severed. The VEIN keeps what it learned.')).toEqual([]);
  });

  it('detects contractions but not possessives', () => {
    expect(hasContraction("You're awake.")).toBe(true);
    expect(hasContraction("It doesn't bend.")).toBe(true);
    expect(hasContraction("The VEIN's patience is structural.")).toBe(false);
  });
});

describe('hand-written Warden lines pass the voice gate — T-503', () => {
  it('every Warden pre/post line and family reaction is voice-bible clean', () => {
    const lines = Object.entries(WARDEN_LINES).flatMap(([id, w]) => [
      { id: `${id}.pre`, text: w.pre },
      { id: `${id}.post`, text: w.post },
      ...Object.entries(w.preByFamily).map(([family, text]) => ({ id: `${id}.pre.${family}`, text })),
    ]);
    expect(lines.length).toBeGreaterThanOrEqual(8); // 4 wardens × pre+post minimum
    const { issues } = lintLaceCorpus(lines);
    expect(issues, issues.map((i) => `${i.id}: ${i.detail}`).join('\n')).toEqual([]);
  });
});

describe('mutation LACE commentary passes the voice gate — T-302', () => {
  it('all 66 mutation lace lines are voice-bible clean', () => {
    const dir = fileURLToPath(new URL('../../../../../packages/content/mutations/', import.meta.url));
    const lines = readdirSync(dir)
      .filter((file) => file.endsWith('.json'))
      .map((file) => {
        const raw = JSON.parse(readFileSync(`${dir}${file}`, 'utf-8')) as { id: string; lace: string };
        return { id: raw.id, text: raw.lace };
      });
    expect(lines.length).toBeGreaterThanOrEqual(66);
    const { issues } = lintLaceCorpus(lines);
    expect(issues, issues.map((i) => `${i.id}: ${i.detail}`).join('\n')).toEqual([]);
  });
});

describe('Codex bodies pass the voice gate — T-300 (the Codex is LACE\'s journal, GDD §2.7)', () => {
  it('every shipped codex entry body is voice-bible clean', () => {
    const dir = fileURLToPath(new URL('../../../../../packages/content/codex/', import.meta.url));
    const lines = readdirSync(dir)
      .filter((file) => file.endsWith('.json'))
      .flatMap((file) => {
        const raw = JSON.parse(readFileSync(`${dir}${file}`, 'utf-8')) as {
          entries: readonly { id: string; body: string }[];
        };
        return raw.entries.map((e) => ({ id: e.id, text: e.body }));
      });
    expect(lines.length).toBeGreaterThanOrEqual(24); // 4 tutorial + 20 zones 1–2
    const { issues } = lintLaceCorpus(lines);
    expect(issues, issues.map((i) => `${i.id}: ${i.detail}`).join('\n')).toEqual([]);
  });
});

describe('shipped LACE corpus passes the voice gate — T-530', () => {
  it('every shipped line is voice-bible clean', () => {
    const { issues } = lintLaceCorpus(shippedLines());
    expect(
      issues,
      issues.map((i) => `${i.id}: ${i.detail}`).join('\n'),
    ).toEqual([]);
  });

  it(`corpus contraction rate stays rare (≤ ${MAX_CONTRACTION_RATE})`, () => {
    const { contractionRate } = lintLaceCorpus(shippedLines());
    expect(contractionRate).toBeLessThanOrEqual(MAX_CONTRACTION_RATE);
  });
});
