import { describe, it, expect } from 'vitest';
import { lintLaceText, lintLaceCorpus, hasContraction, CONTRACTION_RATE_MAX } from './voice-lint';

describe('LACE voice linter — T-330', () => {
  it('passes a clean, measured line', () => {
    expect(lintLaceText('x', 'The walls are listening. They always are.')).toEqual([]);
  });

  it('flags exclamation marks', () => {
    const v = lintLaceText('x', 'Well fought!');
    expect(v.some((e) => e.rule === 'exclamation')).toBe(true);
  });

  it('flags every banned phrase, case-insensitively', () => {
    for (const text of [
      'Good job down there.',
      'Well done.',
      'You died on the first floor.',
      'You may try again.',
      'You win nothing.',
      'Tap the door.',
      'The button is lit.',
      'Look away from the screen.',
    ]) {
      expect(lintLaceText('x', text).some((e) => e.rule === 'banned_phrase'), text).toBe(true);
    }
  });

  it('flags command-mood openings, including mid-line sentences', () => {
    expect(lintLaceText('x', 'Walk to the door.').some((e) => e.rule === 'command_opening')).toBe(true);
    expect(lintLaceText('x', 'Pressure. Choose. Quickly.').some((e) => e.rule === 'command_opening')).toBe(true);
    expect(lintLaceText('x', "Don't let it go to your head.").some((e) => e.rule === 'command_opening')).toBe(true);
  });

  it('does not flag declarative sentences that merely contain a verb', () => {
    expect(lintLaceText('x', 'The choice was always going to be yours.')).toEqual([]);
    expect(lintLaceText('x', 'A run is waiting.')).toEqual([]);
  });

  it('detects contractions but not possessives', () => {
    expect(hasContraction("I'm just along for the descent.")).toBe(true);
    expect(hasContraction("It's been a long time.")).toBe(true);
    expect(hasContraction("The floor's guardian, dismantled.")).toBe(false);
  });

  it('computes the corpus contraction rate', () => {
    const r = lintLaceCorpus([
      { id: 'a', text: "I'm here." },
      { id: 'b', text: 'I am here.' },
    ]);
    expect(r.contractionRate).toBe(0.5);
    expect(CONTRACTION_RATE_MAX).toBeLessThan(0.5);
  });
});
