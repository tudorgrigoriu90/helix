import { describe, it, expect } from 'vitest';
import { AUDIO_BY_KEY, AUDIO_MANIFEST, AUDIO_EXTENSIONS, type AudioKind } from './audio-manifest';

/** Keys the scene layer fires — kept in sync so a typo here fails CI, not silently at runtime. */
const KEYS_USED_BY_SCENES = [
  'music_menu', 'music_run', 'music_boss',
  'sfx_attack', 'sfx_ability', 'sfx_item', 'sfx_enemy_hit', 'sfx_enemy_death',
  'sfx_player_hurt', 'sfx_mutation', 'sfx_descend', 'sfx_victory', 'sfx_defeat',
  'ui_click', 'ui_confirm', 'ui_back',
];

const VALID_KINDS: readonly AudioKind[] = ['music', 'sfx', 'ui'];

describe('audio manifest', () => {
  it('has unique keys', () => {
    const keys = AUDIO_MANIFEST.map((a) => a.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('every entry has a description, a valid kind, and an in-range volume', () => {
    for (const a of AUDIO_MANIFEST) {
      expect(a.description.length, a.key).toBeGreaterThan(10);
      expect(VALID_KINDS, a.key).toContain(a.kind);
      expect(a.volume, a.key).toBeGreaterThanOrEqual(0);
      expect(a.volume, a.key).toBeLessThanOrEqual(1);
    }
  });

  it('only music loops', () => {
    for (const a of AUDIO_MANIFEST) {
      if (a.kind === 'music') expect(a.loop, a.key).toBe(true);
      else expect(a.loop, a.key).toBe(false);
    }
  });

  it('covers every key the scene layer plays', () => {
    for (const key of KEYS_USED_BY_SCENES) {
      expect(AUDIO_BY_KEY.has(key), `scene plays "${key}" — needs a manifest entry`).toBe(true);
    }
  });

  it('offers ogg + an iOS-friendly fallback extension', () => {
    expect(AUDIO_EXTENSIONS).toContain('ogg');
    expect(AUDIO_EXTENSIONS.some((e) => e === 'm4a' || e === 'mp3')).toBe(true);
  });
});
