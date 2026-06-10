import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseLaceLines } from './lace-loader';
import { lintLaceCorpus, CONTRACTION_RATE_MAX } from './voice-lint';

/**
 * LACE voice content gate — T-330.
 *
 * Runs the voice linter over every shipped line bundle so a line that breaks
 * the dialogue bible (GDD Appendix D) fails `pnpm validate` instead of
 * shipping. The contraction budget is corpus-wide: LACE *rarely* uses
 * contractions, and "rarely" is enforced as a rate, not a ban.
 */

const LACE_DIR = fileURLToPath(new URL('../../../../../packages/content/lace-lines/', import.meta.url));

function allLines(): { id: string; text: string }[] {
  return readdirSync(LACE_DIR)
    .filter((f) => f.endsWith('.json'))
    .flatMap((f) => {
      const res = parseLaceLines(JSON.parse(readFileSync(`${LACE_DIR}${f}`, 'utf-8')));
      if (!res.ok) throw new Error(`${f}: ${res.error.message}`);
      return res.lines.map((l) => ({ id: `${f}#${l.id}`, text: l.text }));
    });
}

describe('LACE voice gate — T-330 (GDD App D)', () => {
  it('every shipped line passes the voice linter', () => {
    const { violations } = lintLaceCorpus(allLines());
    const report = violations.map((v) => `  ${v.id}: [${v.rule}] ${v.detail}`).join('\n');
    expect(violations, `voice-bible violations:\n${report}`).toEqual([]);
  });

  it(`the corpus contraction rate stays under ${CONTRACTION_RATE_MAX}`, () => {
    const { contractionRate } = lintLaceCorpus(allLines());
    expect(contractionRate).toBeLessThanOrEqual(CONTRACTION_RATE_MAX);
  });
});
