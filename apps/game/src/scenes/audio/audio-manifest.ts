/**
 * Audio manifest — the single source of truth for every sound the game plays.
 *
 * Each entry maps a logical `key` (also the audio filename stem) to its kind
 * (music / sfx / ui), a default volume, a loop flag, and a human description
 * (mirrored into docs/AUDIO.md for whoever sources the audio).
 *
 * Audio is **optional and incremental**, exactly like sprites: a missing file is
 * not an error — the registry just plays nothing for that key. Drop
 * `public/audio/<key>.<ext>` and it starts playing with zero code changes.
 *
 * Pure data, no Phaser import — so it's unit-testable (audio-manifest.test.ts
 * asserts integrity + that the keys the scene fires actually exist here).
 */

export type AudioKind = 'music' | 'sfx' | 'ui';

export interface AudioSpec {
  /** Logical id + filename stem (`public/audio/<key>.ogg` / `.m4a` / `.mp3`). */
  readonly key: string;
  readonly kind: AudioKind;
  /** Default playback volume in [0, 1] before the per-kind master volume. */
  readonly volume: number;
  /** Music loops; sfx/ui are one-shots. */
  readonly loop: boolean;
  /** What the sound is — guidance for sourcing it. */
  readonly description: string;
}

// ── Music (looping background tracks) ────────────────────────────────────────
const MUSIC: readonly AudioSpec[] = [
  { key: 'music_menu', kind: 'music', volume: 0.5, loop: true,
    description: 'Menu / hub background loop. Calm, ambient, bioluminescent deep-sea; sets the mood without fatigue on repeat.' },
  { key: 'music_run', kind: 'music', volume: 0.45, loop: true,
    description: 'In-run exploration/combat loop. Tense, atmospheric, low-key percussion; the descent through the VEIN. (Fallback; rooms now use the music_room_* variants.)' },
  { key: 'music_room_1', kind: 'music', volume: 0.45, loop: true,
    description: 'In-room ambient loop, variant 1. One of two room tracks picked per room (by room id) for variety while in a non-boss room.' },
  { key: 'music_room_2', kind: 'music', volume: 0.45, loop: true,
    description: 'In-room ambient loop, variant 2. The alternate room track to music_room_1.' },
  { key: 'music_boss', kind: 'music', volume: 0.55, loop: true,
    description: 'Boss-fight loop. Heavier, urgent, higher stakes than the run track.' },
];

// ── Gameplay SFX (one-shot effects) ──────────────────────────────────────────
const SFX: readonly AudioSpec[] = [
  { key: 'sfx_attack', kind: 'sfx', volume: 0.6, loop: false, description: 'Player basic attack — a wet, percussive strike.' },
  { key: 'sfx_ability', kind: 'sfx', volume: 0.65, loop: false, description: 'Player ability cast — energetic whoosh/charge release.' },
  { key: 'sfx_item', kind: 'sfx', volume: 0.6, loop: false, description: 'Consumable used — a glass/fluid pop or device click.' },
  { key: 'sfx_enemy_hit', kind: 'sfx', volume: 0.5, loop: false, description: 'An enemy takes damage — soft impact/squelch.' },
  { key: 'sfx_enemy_death', kind: 'sfx', volume: 0.6, loop: false, description: 'An enemy dies — a dissolving/deflating burst.' },
  { key: 'sfx_player_hurt', kind: 'sfx', volume: 0.6, loop: false, description: 'The player takes damage — a low, alarming thud.' },
  { key: 'sfx_mutation', kind: 'sfx', volume: 0.7, loop: false, description: 'A mutation is taken at a Strand Event — an organic, transformative shimmer.' },
  { key: 'sfx_descend', kind: 'sfx', volume: 0.6, loop: false, description: 'Descending to the next floor — a deep, sinking drone.' },
  { key: 'sfx_victory', kind: 'sfx', volume: 0.7, loop: false, description: 'Run won — a bright, resonant sting.' },
  { key: 'sfx_defeat', kind: 'sfx', volume: 0.7, loop: false, description: 'Run lost / death — a hollow, final tone.' },
];

// ── UI (menu / button feedback) ──────────────────────────────────────────────
const UI: readonly AudioSpec[] = [
  { key: 'ui_click', kind: 'ui', volume: 0.5, loop: false, description: 'Primary button / menu tap — a short, crisp click.' },
  { key: 'ui_confirm', kind: 'ui', volume: 0.55, loop: false, description: 'Confirm / accept (e.g. TAKE a mutation, DESCEND) — a positive two-note click.' },
  { key: 'ui_back', kind: 'ui', volume: 0.45, loop: false, description: 'Cancel / back / toggle-off — a softer, lower click.' },
];

export const AUDIO_MANIFEST: readonly AudioSpec[] = [...MUSIC, ...SFX, ...UI];

/** Index by key for O(1) lookup at play time. */
export const AUDIO_BY_KEY: ReadonlyMap<string, AudioSpec> = new Map(
  AUDIO_MANIFEST.map((a) => [a.key, a]),
);

/** Extensions tried per key, in browser-codec preference order. Phaser picks the
 *  first the browser can play; provide at least `.ogg` (web/Android) + an
 *  `.m4a`/`.mp3` (iOS/Safari) so every platform has a source. */
export const AUDIO_EXTENSIONS: readonly string[] = ['ogg', 'm4a', 'mp3'];
