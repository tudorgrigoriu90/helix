/**
 * T-248/T-249: AnalyticsAdapter interface + type-safe EventSchema.
 *
 * EventSchema maps every event name to its required parameters, so a
 * mis-typed event name or wrong parameter shape is a compile-time error —
 * not a silent runtime failure.
 *
 * Pure TypeScript — no Phaser, no Firebase, testable in isolation.
 */

// ── T-249: Type-safe event schema ────────────────────────────────────────────

export interface EventSchema {
  // ── Run lifecycle ──────────────────────────────────────────────────────────
  /** A run begins (first floor loaded). */
  readonly run_start: {
    readonly seed: number;
    readonly originId: string;
    readonly floorCount: number;
    readonly isTutorial: boolean;
  };
  /** A run ends (victory, death, or surrender). */
  readonly run_end: {
    readonly outcome: 'win' | 'loss' | 'surrender';
    readonly floorReached: number;
    readonly mutationCount: number;
    readonly durationMs: number;
    readonly deathCause?: string;
  };

  // ── Combat ────────────────────────────────────────────────────────────────
  /** A combat encounter begins. `bossTier` present on boss rooms (DR-008, T-513). */
  readonly combat_start: {
    readonly roomType: 'combat' | 'boss';
    readonly floorNumber: number;
    readonly enemyCount: number;
    readonly bossTier?: 'floor_boss' | 'zone_warden';
  };
  /** A combat encounter ends. `bossTier` present on boss rooms (DR-008, T-513). */
  readonly combat_end: {
    readonly outcome: 'victory' | 'defeat';
    readonly turnsElapsed: number;
    readonly bossTier?: 'floor_boss' | 'zone_warden';
  };
  /** Player uses an ability. */
  readonly ability_used: {
    readonly abilityId: string;
    readonly floorNumber: number;
  };
  /** Player uses an item. */
  readonly item_used: {
    readonly itemId: string;
    readonly category: string;
  };

  // ── Strand / mutations ────────────────────────────────────────────────────
  /** A Strand Event opens. */
  readonly strand_event_open: {
    readonly floorNumber: number;
    readonly mutationCount: number;
  };
  /** Player picks a mutation. */
  readonly mutation_chosen: {
    readonly mutationId: string;
    readonly family: string;
    readonly tier: string;
    readonly slot: string;
  };
  /** Player rerolls the Strand offer. */
  readonly strand_reroll: {
    readonly floorNumber: number;
  };
  /** A Dominant Trait unlocks. */
  readonly dominant_trait_unlocked: {
    readonly family: string;
    readonly traitId: string;
  };
  /** VEIN Intermission accepted. */
  readonly vein_intermission: {
    readonly floorNumber: number;
    readonly vcGained: number;
  };

  // ── DR-009/DR-009b descent structure (T-513) ──────────────────────────────
  /** The Floor 2 Proto-Strand offer appears (DR-009b). */
  readonly proto_strand_shown: {
    readonly floorNumber: number;
  };
  /** A Proto-Strand card is taken (fills the bonus slot at +5 SIG). */
  readonly proto_strand_selected: {
    readonly mutationId: string;
    readonly family: string;
  };
  /** The S072 Descend/Rest choice appears after a Strand Event (DR-009). */
  readonly descent_checkpoint_offered: {
    readonly floorNumber: number;
    readonly act: number;
  };
  /** The player rests — run suspended at the act-end checkpoint. */
  readonly descent_checkpoint_rested: {
    readonly floorNumber: number;
    readonly act: number;
  };
  /** A checkpointed run resumes from the Hub's Continue Descent card.
   *  (UFD 02 names these `act_n` / `hours_since_suspend`.) */
  readonly descent_resumed: {
    readonly actN: number;
    readonly hoursSinceSuspend: number;
  };

  // ── Room navigation ───────────────────────────────────────────────────────
  /** Player enters a room. */
  readonly room_enter: {
    readonly roomType: string;
    readonly floorNumber: number;
  };
  /** Floor completed (all rooms cleared, boss dead). */
  readonly floor_complete: {
    readonly floorNumber: number;
    readonly durationMs: number;
  };

  // ── Meta / session ────────────────────────────────────────────────────────
  /** App session starts (after splashes). */
  readonly session_start: {
    readonly hasActiveRun: boolean;
    readonly lifetimeRuns: number;
    readonly consentGranted: boolean;
  };
  /** Consent decision recorded. */
  readonly consent_decision: {
    readonly decision: 'granted' | 'declined';
  };
  /** Tutorial completed. */
  readonly tutorial_complete: Record<string, never>;
  /** Revive offer accepted — rewarded ad only (DR-010; the Shard path is removed). */
  readonly revive_accepted: {
    readonly method: 'ad';
  };

  // ── Share loop (T-531, DR-011) ────────────────────────────────────────────
  /** The ShareScene opens (from the post-run share CTA). */
  readonly share_opened: {
    readonly format: 'story' | 'square';
  };
  /** A share attempt finished — however it left the device. */
  readonly share_completed: {
    readonly format: 'story' | 'square';
    readonly outcome: 'shared' | 'downloaded' | 'copied' | 'cancelled' | 'unavailable';
    readonly buildMs: number;
  };
}

// ── T-248: AnalyticsAdapter interface ────────────────────────────────────────

/** Adapter interface — implemented by web (Firebase), Capacitor (native), and console (dev). */
export interface AnalyticsAdapter {
  /**
   * Fire a typed analytics event. The key must be in EventSchema (compile-time
   * checked) and the params type is inferred from it (typo = error, T-249).
   */
  logEvent<K extends keyof EventSchema>(name: K, params: EventSchema[K]): void;
  /** Optional: set a user property that persists across events. */
  setUserProperty?(key: string, value: string): void;
}

// ── Module-level registry ────────────────────────────────────────────────────

import { recordDebugEvent } from './analytics-debug-log';

let _adapter: AnalyticsAdapter | null = null;

/** Install the active analytics adapter (called once at boot after consent check). */
export function setAnalyticsAdapter(adapter: AnalyticsAdapter): void {
  _adapter = adapter;
}

/** Fire a typed analytics event.
 *  Always recorded in the in-memory debug log (T-253).
 *  Forwarded to the installed adapter if one is present; no-op otherwise. */
export function logEvent<K extends keyof EventSchema>(name: K, params: EventSchema[K]): void {
  recordDebugEvent(name, params);
  _adapter?.logEvent(name, params);
}
