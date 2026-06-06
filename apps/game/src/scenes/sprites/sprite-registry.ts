import Phaser from 'phaser';
import { SPRITE_BY_KEY, SPRITE_MANIFEST, type SpriteSpec } from './sprite-manifest';

/**
 * Sprite registry — the Phaser glue around the pure {@link SPRITE_MANIFEST}.
 *
 * Sprites are optional: PNGs live in `public/sprites/<key>.png` and are loaded
 * if present, but a missing file is not an error — {@link drawSprite} falls back
 * to the manifest's primitive (coloured circle/rect), so the game looks exactly
 * like it does today until art is dropped in, then upgrades automatically.
 *
 * Loading uses Phaser's loader with a per-file error handler that simply marks
 * the key as unavailable, so one missing PNG never blocks the scene.
 */

const SPRITE_DIR = 'sprites/';

/** Keys that finished loading as a real texture this session. */
const loaded = new Set<string>();

/**
 * Queues every manifest sprite for loading in a scene `preload()`. Safe to call
 * from multiple scenes; Phaser's own loader deduplicates keys within a single
 * load cycle, and we skip keys that are already in the texture cache or in
 * `loaded`, so repeated calls are cheap. PNGs that 404 are silently skipped
 * and retried on the next scene boot — drawSprite falls back to a primitive
 * in the meantime.
 */
export function queueSpriteLoads(scene: Phaser.Scene): void {
  scene.load.on(Phaser.Loader.Events.FILE_COMPLETE, (key: string) => {
    if (SPRITE_BY_KEY.has(key)) loaded.add(key);
  });

  for (const spec of SPRITE_MANIFEST) {
    // Skip keys already confirmed loaded this session.
    if (loaded.has(spec.key)) continue;
    // Skip keys already in Phaser's texture cache (loaded by a prior scene).
    if (scene.textures.exists(spec.key)) {
      loaded.add(spec.key);
      continue;
    }
    // Queue the load — Phaser deduplicates within the same load cycle.
    scene.load.image(spec.key, `${SPRITE_DIR}${spec.key}.png`);
  }
}

/** True when a real texture for `key` loaded this session. */
export function hasSprite(scene: Phaser.Scene, key: string): boolean {
  return loaded.has(key) || scene.textures.exists(key);
}

/**
 * Draws sprite `key` centred at (`x`,`y`) sized to `size` (px, longest edge).
 * Returns the created Image, or null when it fell back to a primitive (drawn
 * into `fallbackGfx`). `tint` optionally recolours the sprite (e.g. dead = grey).
 */
export interface DrawSpriteOptions {
  readonly tint?: number;
  /**
   * When false, no fallback primitive is drawn if the sprite is missing (the
   * caller has already drawn its own base, e.g. a coloured map-node disc).
   * Defaults to true.
   */
  readonly fallback?: boolean;
}

export function drawSprite(
  scene: Phaser.Scene,
  fallbackGfx: Phaser.GameObjects.Graphics,
  key: string,
  x: number,
  y: number,
  size: number,
  options: DrawSpriteOptions = {},
): Phaser.GameObjects.Image | null {
  const spec = SPRITE_BY_KEY.get(key);

  if (hasSprite(scene, key)) {
    const img = scene.add.image(x, y, key).setDisplaySize(size, size);
    if (options.tint !== undefined) img.setTint(options.tint);
    return img;
  }

  // Fallback primitive from the manifest (or a neutral grey if key is unknown),
  // unless the caller opted out (it drew its own base).
  if (options.fallback !== false) drawFallback(fallbackGfx, spec, x, y, size, options.tint);
  return null;
}

function drawFallback(
  gfx: Phaser.GameObjects.Graphics,
  spec: SpriteSpec | undefined,
  x: number,
  y: number,
  size: number,
  tint?: number,
): void {
  const color = tint ?? spec?.fallbackColor ?? 0x888888;
  gfx.fillStyle(color, 1);
  if (spec?.fallbackShape === 'rect') {
    gfx.fillRect(x - size / 2, y - size / 2, size, size);
  } else {
    gfx.fillCircle(x, y, size * 0.34);
  }
}
