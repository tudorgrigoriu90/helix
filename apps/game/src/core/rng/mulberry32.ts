/** Mulberry32 — 32-bit seedable PRNG. ~10 lines, no external deps. TDD §6.1. */
export class Mulberry32 {
  /** Single 32-bit state word; serialised into RunState on every action. */
  state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  /** Returns a float in [0, 1). */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let z = this.state;
    z = Math.imul(z ^ (z >>> 15), z | 1) >>> 0;
    z = (z + Math.imul(z ^ (z >>> 7), z | 61)) >>> 0;
    return ((z ^ (z >>> 14)) >>> 0) / 4294967296;
  }

  /** Returns an integer in [0, n). */
  nextInt(n: number): number {
    return Math.floor(this.next() * n);
  }
}

// ── Sub-generator factory ────────────────────────────────────────────────────
// Each concern gets its own Mulberry32 derived from rootSeed + hash(label).
// Adding a new label never shifts existing sub-generators. TDD §6.1.

export type RngLabel = 'combat' | 'loot' | 'floorgen' | 'mutationdraw' | 'events' | 'straincarry' | 'codexgrant';

/** djb2-variant: hashes a label string to a u32 offset. */
function hashLabel(label: string): number {
  let h = 5381;
  for (let i = 0; i < label.length; i++) {
    h = (Math.imul(h, 33) ^ label.charCodeAt(i)) >>> 0;
  }
  return h >>> 0;
}

/** Create a sub-generator for the given concern. */
export function makeRng(rootSeed: number, label: RngLabel): Mulberry32 {
  return new Mulberry32((rootSeed ^ hashLabel(label)) >>> 0);
}
