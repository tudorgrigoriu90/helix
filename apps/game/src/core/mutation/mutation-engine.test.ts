import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { MutationDef, MutationFamily } from '@shared-types/mutation';
import { FAMILY_RING } from '@shared-types/mutation';
import { parseMutationDef } from '../content/mutation-loader';
import { makeRng } from '../rng/mulberry32';
import { newRunPlayer } from '../run/start-player';
import {
  drawMutationCards,
  rerollCard,
  applyMutation,
  familyWeights,
  unlockedDominantTraits,
  unlockedSynergies,
  resolveStrandEvent,
  gainMutationSig,
  SIG_CAP,
  MUTATION_CAP,
  type DrawnCard,
} from './index';

/**
 * T-95 — the cross-cutting QA sweep for the whole Mutation Engine (S-3.4),
 * exercised against the *real shipped content* (the full 66-mutation roster under
 * packages/content/mutations), not just hand-built fixtures. The per-module
 * suites prove each piece; this proves they hold together end-to-end:
 * every modifier type applies, every family weighting is reachable, draws
 * never repeat, and a full Strand-Event lifecycle stays within the SIG cap.
 */

const DIR = fileURLToPath(new URL('../../../../../packages/content/mutations/', import.meta.url));
const REAL: MutationDef[] = readdirSync(DIR)
  .filter((f) => f.endsWith('.json'))
  .map((f) => {
    const res = parseMutationDef(JSON.parse(readFileSync(DIR + f, 'utf8')));
    if (!res.ok) throw new Error(`content ${f} failed to load: ${res.error.message}`);
    return res.mutation;
  });

const ids = (cards: readonly DrawnCard[]): string[] => cards.map((c) => c.mutation.id);

describe('mutation engine — T-95 integration sweep (real content)', () => {
  it('ships the full 66-mutation roster with every family represented (T-302)', () => {
    expect(REAL).toHaveLength(66); // exact family/tier mix pinned by the bundle gate
    for (const f of FAMILY_RING) {
      expect(REAL.filter((m) => m.family === f).length).toBeGreaterThanOrEqual(12);
      // Minors remain the bulk so early-floor draws (Minor-only) never starve.
      expect(REAL.filter((m) => m.family === f && m.tier === 'minor').length).toBeGreaterThanOrEqual(5);
    }
  });

  it('the real content exercises every modifier type', () => {
    const kinds = new Set(REAL.flatMap((m) => m.modifiers.map((mod) => mod.kind)));
    expect(kinds).toEqual(new Set(['stat', 'maxHp', 'maxAp']));
    // both passive-only and ability-granting cards exist
    expect(REAL.some((m) => m.grantsAbility === null)).toBe(true);
    expect(REAL.some((m) => m.grantsAbility !== null)).toBe(true);
  });

  it('applies every real mutation to a valid PlayerState', () => {
    for (const m of REAL) {
      const after = applyMutation(newRunPlayer(), m);
      expect(after.maxHp).toBeGreaterThan(0);
      expect(after.hp).toBeGreaterThanOrEqual(0);
      expect(after.hp).toBeLessThanOrEqual(after.maxHp);
      expect(after.maxAp).toBeGreaterThanOrEqual(0);
      expect(after.ap).toBeLessThanOrEqual(after.maxAp);
      for (const s of ['str', 'res', 'agi', 'int'] as const) {
        expect(after.stats[s]).toBeGreaterThanOrEqual(0);
      }
      expect(after.mutations).toContain(m.id);
      expect(after.abilities.length).toBe(
        newRunPlayer().abilities.length + (m.grantsAbility ? 1 : 0),
      );
    }
  });

  it('every family weighting bucket is reachable from the real pool', () => {
    // With nothing owned, every family should be drawable.
    const seen = new Set<MutationFamily>();
    for (let seed = 0; seed < 500; seed++) {
      for (const c of drawMutationCards({ pool: REAL, owned: [], rng: makeRng(seed, 'mutationdraw') })) {
        seen.add(c.mutation.family);
      }
    }
    expect(seen.size).toBe(5);
    // The weighting helper sums to 100 for representative ownerships.
    for (const owned of [[], [REAL[0]!], [REAL[0]!, REAL[1]!]]) {
      const total = [...familyWeights(owned).values()].reduce((a, b) => a + b, 0);
      expect(total).toBeCloseTo(100, 6);
    }
  });

  it('draws never repeat: no owned card, no within-offer dup, over many seeds', () => {
    const owned = REAL.filter((m) => m.family === 'abyssal').slice(0, 2);
    const ownedIds = new Set(owned.map((m) => m.id));
    for (let seed = 0; seed < 500; seed++) {
      const offer = drawMutationCards({ pool: REAL, owned, rng: makeRng(seed, 'mutationdraw') });
      expect(new Set(ids(offer)).size).toBe(offer.length); // distinct within offer
      for (const id of ids(offer)) expect(ownedIds.has(id)).toBe(false); // never owned
    }
  });

  it('a full draw → reroll → draw lifecycle is deterministic and dup-free', () => {
    const run = (): string[] => {
      const rng = makeRng(2024, 'mutationdraw');
      const owned: MutationDef[] = [];
      const picked: string[] = [];

      // First Strand Event: draw, reroll card 0, take the first card.
      let offer = drawMutationCards({ pool: REAL, owned, rng });
      offer = rerollCard({ offer, index: 0, pool: REAL, owned, rng });
      const first = offer[0]!.mutation;
      owned.push(first);
      picked.push(first.id);

      // Second Strand Event with the first mutation now owned.
      const offer2 = drawMutationCards({ pool: REAL, owned, rng });
      for (const c of offer2) expect(c.mutation.id).not.toBe(first.id); // owned excluded
      owned.push(offer2[0]!.mutation);
      picked.push(offer2[0]!.mutation.id);

      expect(new Set(picked).size).toBe(picked.length); // unique across the run
      return picked;
    };
    expect(run()).toEqual(run()); // identical on replay
  });

  it('a capped run: Strand Events convert to VEIN Intermissions at 4 mutations', () => {
    const rng = makeRng(77, 'mutationdraw');
    const owned: MutationDef[] = [];
    let sig = 0;
    let events = 0;
    let intermissions = 0;

    // Keep holding Strand Events until well past the cap.
    for (let i = 0; i < 6; i++) {
      const outcome = resolveStrandEvent(owned.length);
      if (outcome.kind === 'intermission') {
        intermissions++;
        expect(outcome.veinCrystals).toBe(100);
        continue;
      }
      events++;
      const offer = drawMutationCards({ pool: REAL, owned, floor: 5 + i * 5, rng });
      const pick = offer[0]!.mutation;
      owned.push(pick);
      sig = gainMutationSig(sig, pick, 'strand');
    }

    expect(owned.length).toBe(MUTATION_CAP); // never exceeded the cap
    expect(events).toBe(MUTATION_CAP); // 4 real draws
    expect(intermissions).toBeGreaterThan(0); // the rest converted
    expect(sig).toBeLessThanOrEqual(SIG_CAP);
  });

  it('dominant + synergy detection stay consistent with ownership', () => {
    // Three abyssal → Leviathan Core; with a thermal too → the abyssal+thermal synergy.
    const owned = [
      ...REAL.filter((m) => m.family === 'abyssal').slice(0, 3),
      REAL.find((m) => m.family === 'thermal')!,
    ];
    const traits = unlockedDominantTraits(owned);
    expect(traits.map((t) => t.id)).toContain('leviathan_core');
    const synergies = unlockedSynergies(owned);
    expect(synergies.map((s) => s.id)).toContain('hydrothermal_vent'); // abyssal+thermal
  });
});
