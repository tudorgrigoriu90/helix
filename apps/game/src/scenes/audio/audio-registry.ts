import Phaser from 'phaser';
import { AUDIO_BY_KEY, AUDIO_EXTENSIONS, AUDIO_MANIFEST, type AudioKind } from './audio-manifest';

/**
 * Audio registry — the Phaser glue around the pure {@link AUDIO_MANIFEST}.
 *
 * Audio is optional, mirroring the sprite pipeline: files live in
 * `public/audio/<key>.<ext>` and are loaded if present, but a missing file is
 * never an error — {@link playSfx} / {@link playMusic} simply play nothing for
 * that key, so the game runs silently until audio is dropped in, then it plays
 * with zero code changes.
 *
 * Per-kind master volumes ({@link setCategoryVolume}) are the hook for the audio
 * settings sliders (T-210); each sound's final volume is its manifest volume ×
 * its kind's master.
 */

const AUDIO_DIR = 'audio/';

/** Keys that finished loading as a real sound this session. */
const loaded = new Set<string>();
/** Keys we attempted (so a second scene doesn't re-queue them). */
const attempted = new Set<string>();

/** Per-kind master volume in [0, 1]; multiplied onto each sound's own volume. */
const categoryVolume: Record<AudioKind, number> = { music: 1, sfx: 1, ui: 1 };

/** The single active music track (only one loops at a time). */
let currentMusic: Phaser.Sound.BaseSound | null = null;
let currentMusicKey: string | null = null;

/**
 * Queues every manifest sound for loading in a scene `preload()`. Safe to call
 * from multiple scenes; each key is attempted once. Files that 404 are recorded
 * as unavailable rather than throwing. Each key offers several extensions and
 * Phaser loads the first the browser can decode.
 */
export function queueAudioLoads(scene: Phaser.Scene): void {
  scene.load.on(Phaser.Loader.Events.FILE_COMPLETE, (key: string) => {
    if (AUDIO_BY_KEY.has(key)) loaded.add(key);
  });
  // A missing file fires FILE_LOAD_ERROR — swallow it; playback no-ops instead.
  scene.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, () => {
    /* intentionally ignored — audio is optional */
  });

  for (const spec of AUDIO_MANIFEST) {
    if (attempted.has(spec.key)) continue;
    attempted.add(spec.key);
    scene.load.audio(spec.key, AUDIO_EXTENSIONS.map((ext) => `${AUDIO_DIR}${spec.key}.${ext}`));
  }
}

/** True when a real sound for `key` decoded this session. */
export function hasAudio(scene: Phaser.Scene, key: string): boolean {
  return loaded.has(key) || scene.cache.audio.exists(key);
}

/** Final volume for a key = its manifest volume × its kind's master volume. */
function resolveVolume(key: string): number {
  const spec = AUDIO_BY_KEY.get(key);
  if (spec === undefined) return 0;
  return spec.volume * categoryVolume[spec.kind];
}

/**
 * Plays a one-shot sound (sfx/ui). Returns the sound instance, or null when the
 * file isn't present. The instance self-destroys on completion.
 */
export function playSfx(scene: Phaser.Scene, key: string): Phaser.Sound.BaseSound | null {
  if (!hasAudio(scene, key)) return null;
  const sound = scene.sound.add(key, { volume: resolveVolume(key) });
  sound.once(Phaser.Sound.Events.COMPLETE, () => sound.destroy());
  sound.play();
  return sound;
}

/**
 * Plays `key` as the looping background track, replacing any current one. A
 * no-op (keeps playing) if `key` is already the active track. Returns null when
 * the file isn't present.
 */
export function playMusic(scene: Phaser.Scene, key: string): Phaser.Sound.BaseSound | null {
  if (currentMusicKey === key && currentMusic?.isPlaying === true) return currentMusic;
  stopMusic();
  if (!hasAudio(scene, key)) return null;
  currentMusic = scene.sound.add(key, { volume: resolveVolume(key), loop: true });
  currentMusicKey = key;
  currentMusic.play();
  return currentMusic;
}

/** Stops and releases the current music track, if any. */
export function stopMusic(): void {
  if (currentMusic !== null) {
    currentMusic.stop();
    currentMusic.destroy();
    currentMusic = null;
    currentMusicKey = null;
  }
}

/**
 * Sets a per-kind master volume in [0, 1] (the T-210 sliders hook). Updates the
 * live music track immediately so a music-slider change is heard at once.
 */
export function setCategoryVolume(kind: AudioKind, volume: number): void {
  categoryVolume[kind] = Math.max(0, Math.min(1, volume));
  if (kind === 'music' && currentMusic !== null && currentMusicKey !== null) {
    (currentMusic as Phaser.Sound.BaseSound & { volume: number }).volume = resolveVolume(currentMusicKey);
  }
}

/** Current per-kind master volume. */
export function getCategoryVolume(kind: AudioKind): number {
  return categoryVolume[kind];
}
