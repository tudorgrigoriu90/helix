import type { MutationDef } from '@shared-types/mutation';

/**
 * No-duplicates filter — T-87 (GDD §5.4 Rule 4).
 *
 * Returns the mutations from `pool` whose id is not in `excludeIds`, preserving
 * pool order. The draw uses one growing exclude set for both jobs Rule 4 needs:
 *   - mutations the player already **owns** (never offered again this run), and
 *   - mutations already **drawn into the current offer** (the three cards are
 *     distinct from each other).
 *
 * The pool is assumed id-unique (guaranteed by the content cross-reference gate,
 * T-84); we defensively de-duplicate by id anyway so a stray double-entry can
 * never surface the same card twice.
 */
export function availableMutations(
  pool: readonly MutationDef[],
  excludeIds: ReadonlySet<string>,
): readonly MutationDef[] {
  const seen = new Set<string>(excludeIds);
  const out: MutationDef[] = [];
  for (const m of pool) {
    if (seen.has(m.id)) continue;
    seen.add(m.id);
    out.push(m);
  }
  return out;
}
