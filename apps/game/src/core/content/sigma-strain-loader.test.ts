import { describe, it, expect } from 'vitest';
import { parseSigmaStrainDef } from './sigma-strain-loader';

/** T-306 — Sigma Strain loader validation. */

function valid(): Record<string, unknown> {
  return {
    schemaVersion: 1,
    id: 'resilient_baseline',
    name: 'Resilient Baseline',
    tagline: '+5% max HP',
    blurb: 'The tissue remembers what the mind forgets.',
    unlock: { kind: 'runsCompleted', count: 5 },
    effect: { kind: 'maxHpPercent', percent: 5 },
  };
}

describe('parseSigmaStrainDef — T-306', () => {
  it('parses a valid strain', () => {
    const res = parseSigmaStrainDef(valid());
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.strain.id).toBe('resilient_baseline');
      expect(res.strain.unlock).toEqual({ kind: 'runsCompleted', count: 5 });
      expect(res.strain.effect).toEqual({ kind: 'maxHpPercent', percent: 5 });
    }
  });

  it('parses every unlock kind', () => {
    const unlocks = [
      { kind: 'runsCompleted', count: 5 },
      { kind: 'wins', count: 1 },
      { kind: 'reachFloor', floor: 10 },
      { kind: 'enemiesKilled', count: 500 },
      { kind: 'killsOfType', damageType: 'thermal', count: 100 },
      { kind: 'runsWithFamily', family: 'abyssal', count: 10 },
      { kind: 'deathsToType', damageType: 'void', count: 5 },
    ];
    for (const unlock of unlocks) {
      const res = parseSigmaStrainDef({ ...valid(), unlock });
      expect(res.ok, JSON.stringify(unlock)).toBe(true);
    }
  });

  it('parses every effect kind', () => {
    const effects = [
      { kind: 'maxHpPercent', percent: 5 },
      { kind: 'damageResistPercent', damageType: 'thermal', percent: 10 },
      { kind: 'veinBonusPercent', percent: 5 },
      { kind: 'shardBonusPercent', percent: 10 },
      { kind: 'startingVein', amount: 25 },
      { kind: 'extraWildCard' },
      { kind: 'firstCardMatchesLastFamily' },
      { kind: 'carryMutation' },
      { kind: 'minimapRoomTypes' },
      { kind: 'laceBiomeHint' },
      { kind: 'enemyIntentReveal', damageType: 'void' },
      { kind: 'shopFamilyBias', family: 'mycelial' },
    ];
    for (const effect of effects) {
      const res = parseSigmaStrainDef({ ...valid(), effect });
      expect(res.ok, JSON.stringify(effect)).toBe(true);
    }
  });

  it("rejects a 'true'-damage resist (the T-301 contract holds for strains)", () => {
    const res = parseSigmaStrainDef({
      ...valid(),
      effect: { kind: 'damageResistPercent', damageType: 'true', percent: 10 },
    });
    expect(res.ok).toBe(false);
  });

  it('rejects percents above the §11.2 nudge cap', () => {
    expect(parseSigmaStrainDef({ ...valid(), effect: { kind: 'maxHpPercent', percent: 30 } }).ok).toBe(false);
    expect(parseSigmaStrainDef({ ...valid(), effect: { kind: 'veinBonusPercent', percent: 26 } }).ok).toBe(false);
  });

  it('rejects unknown kinds, zero counts, and missing fields', () => {
    expect(parseSigmaStrainDef({ ...valid(), unlock: { kind: 'playtime', count: 5 } }).ok).toBe(false);
    expect(parseSigmaStrainDef({ ...valid(), effect: { kind: 'instantWin' } }).ok).toBe(false);
    expect(parseSigmaStrainDef({ ...valid(), unlock: { kind: 'runsCompleted', count: 0 } }).ok).toBe(false);
    expect(parseSigmaStrainDef({ ...valid(), blurb: '' }).ok).toBe(false);
    const noTagline = valid();
    delete noTagline['tagline'];
    expect(parseSigmaStrainDef(noTagline).ok).toBe(false);
  });

  it('rejects an unsupported schema version', () => {
    expect(parseSigmaStrainDef({ ...valid(), schemaVersion: 2 }).ok).toBe(false);
  });
});
