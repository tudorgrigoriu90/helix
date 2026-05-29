import { describe, it, expect } from 'vitest';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  SPRITE_BY_KEY,
  SPRITE_MANIFEST,
  roomSpriteKey,
  tileSpriteKey,
} from './sprite-manifest';

const CONTENT = fileURLToPath(new URL('../../../../../packages/content/', import.meta.url));
const enemyIds = readdirSync(`${CONTENT}enemies/`).filter((f) => f.endsWith('.json')).map((f) => f.replace('.json', ''));
const itemIds = readdirSync(`${CONTENT}items/`).filter((f) => f.endsWith('.json')).map((f) => f.replace('.json', ''));

const TILE_TYPES = ['open', 'wall', 'hazard', 'cover', 'elevated', 'corruption'];
const ROOM_TYPES = ['combat', 'loot', 'safe', 'merchant', 'trap', 'lace_event', 'boss'];

describe('sprite manifest', () => {
  it('has unique keys', () => {
    const keys = SPRITE_MANIFEST.map((s) => s.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('every entry has a description and a finite fallback colour', () => {
    for (const s of SPRITE_MANIFEST) {
      expect(s.description.length, s.key).toBeGreaterThan(10);
      expect(Number.isInteger(s.fallbackColor), s.key).toBe(true);
      expect(s.fallbackColor).toBeGreaterThanOrEqual(0);
      expect(s.fallbackColor).toBeLessThanOrEqual(0xffffff);
    }
  });

  it('covers the player and every shipped enemy', () => {
    expect(SPRITE_BY_KEY.has('player')).toBe(true);
    for (const id of enemyIds) {
      expect(SPRITE_BY_KEY.has(id), `enemy "${id}" needs a sprite spec`).toBe(true);
    }
  });

  it('covers every tile type', () => {
    for (const t of TILE_TYPES) {
      expect(SPRITE_BY_KEY.has(tileSpriteKey(t)), `tile "${t}"`).toBe(true);
    }
  });

  it('covers every room type', () => {
    for (const r of ROOM_TYPES) {
      expect(SPRITE_BY_KEY.has(roomSpriteKey(r)), `room "${r}"`).toBe(true);
    }
  });

  it('covers every shipped item', () => {
    for (const id of itemIds) {
      expect(SPRITE_BY_KEY.has(id), `item "${id}" needs a sprite spec`).toBe(true);
    }
  });

  it('key helpers map types to the manifest convention', () => {
    expect(tileSpriteKey('hazard')).toBe('tile_hazard');
    expect(roomSpriteKey('boss')).toBe('room_boss');
  });
});
