/**
 * Codex Entry — one collectible lore record in the player's Codex (GDD §2.7).
 *
 * Entries are pure narrative: an organism dossier, a phenomenon note, a place,
 * or a fragment of LACE's own log. Collecting a Codex Fragment in a run
 * (T-76 placement) unlocks an entry id into {@link MetaState.codexEntryIds};
 * the Codex screens (T-204/T-206) render the matching entry's `title` + `body`.
 *
 * Authored as a per-zone JSON bundle (`{ schemaVersion, entries }`) under
 * `packages/content/codex/` — the same bundle shape as the LACE library, since
 * both are bodies of authored text rather than per-row mechanical defs.
 */

/**
 * Codex categories (GDD §2.7). The Codex Home screen (T-199) groups entries by
 * these tabs; locked entries render blurred, not hidden (T-204).
 *
 *   - `organism`   — a creature dossier (the bestiary)
 *   - `phenomenon` — a force or process of the descent (the VEIN, mutation)
 *   - `location`   — a floor, zone, or landmark
 *   - `lore`       — LACE log fragments and world backstory
 */
export type CodexCategory = 'organism' | 'phenomenon' | 'location' | 'lore';

export interface CodexEntry {
  readonly id: string;
  readonly title: string;
  readonly category: CodexCategory;
  /** The floor on which the entry's fragment can first be found (0 = tutorial). */
  readonly floor: number;
  /** The entry body — the lore prose shown on the detail screen (GDD §2.7). */
  readonly body: string;
}

/** On-disk bundle shape (one file per zone/floor batch). */
export interface CodexEntryBundle {
  readonly schemaVersion: number;
  readonly entries: readonly CodexEntry[];
}

export const CURRENT_CODEX_SCHEMA_VERSION = 1;
