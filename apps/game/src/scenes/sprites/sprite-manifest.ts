/**
 * Sprite manifest — the single source of truth for every drawable sprite.
 *
 * Each entry maps a logical `key` (also the PNG filename stem) to its category,
 * a human description (mirrored into docs/SPRITES.md for the artist), and a
 * fallback primitive (colour + shape) used by the renderer until a real PNG
 * ships. This lets art drop in **incrementally**: a missing sprite renders as
 * today's coloured circle/rect; dropping `public/sprites/<key>.png` makes it
 * appear with zero code changes.
 *
 * Pure data, no Phaser import — so it's unit-testable (sprite-manifest.test.ts
 * asserts it covers every enemy/tile/room content id).
 *
 * Sizing convention (see docs/SPRITES.md): author each sprite at **128×128**
 * (primary, `<key>.png`, what the scene loads and scales) plus a **64×64**
 * variant for small UI (`<key>.64.png`, ability/item bars + minimap nodes).
 * Transparent background; centred subject.
 */

export type SpriteCategory = 'entity' | 'tile' | 'room' | 'item' | 'ability';
export type FallbackShape = 'circle' | 'rect';

export interface SpriteSpec {
  /** Logical id + PNG filename stem (`public/sprites/<key>.png`). */
  readonly key: string;
  readonly category: SpriteCategory;
  /** Artist-facing description — what the sprite should depict. */
  readonly description: string;
  /** Colour drawn (as a circle/rect) when no PNG exists yet. */
  readonly fallbackColor: number;
  readonly fallbackShape: FallbackShape;
}

// ── Entities (player + Zone-1 roster) ────────────────────────────────────────
const ENTITIES: readonly SpriteSpec[] = [
  { key: 'player', category: 'entity', fallbackColor: 0xa0ffdc, fallbackShape: 'circle',
    description: 'The descending organism (player avatar). Bioluminescent teal, humanoid-but-alien silhouette; reads clearly as "you" at a glance. Faces up/neutral.' },
  { key: 'filterer', category: 'entity', fallbackColor: 0xff4444, fallbackShape: 'circle',
    description: 'Zone-1 grunt. Translucent jellyfish-like filter-feeder drifting in cave water; soft red/pink membrane.' },
  { key: 'cave_crawler', category: 'entity', fallbackColor: 0xff5533, fallbackShape: 'circle',
    description: 'Zone-1 grunt. Fast skittering chitinous arthropod, many legs; aggressive crimson carapace.' },
  { key: 'acid_spitter', category: 'entity', fallbackColor: 0x88cc44, fallbackShape: 'circle',
    description: 'Zone-1 grunt. Bulbous gland-creature with a corrosive green sac; spore/acid theme.' },
  { key: 'scavenger', category: 'entity', fallbackColor: 0xff8844, fallbackShape: 'circle',
    description: 'Zone-1 grunt. Hunched opportunist scuttler picking at remains; mottled orange-brown.' },
  { key: 'shell_brute', category: 'entity', fallbackColor: 0xcc7733, fallbackShape: 'circle',
    description: 'Zone-1 elite. Heavily armoured, slow calcified bruiser; thick plated shell, small head.' },
  { key: 'pressure_warden', category: 'entity', fallbackColor: 0xff2222, fallbackShape: 'circle',
    description: 'Zone-1 BOSS. Imposing fluorescent pressure-warden; larger, menacing, glowing deep-sea bioluminescence. Should feel like a fight.' },
];

// ── Entities — Zone 1 (Shallows), Floors 2–5 (T-291) ─────────────────────────
const ENTITIES_SHALLOWS: readonly SpriteSpec[] = [
  { key: 'glass_eel', category: 'entity', fallbackColor: 0xff5533, fallbackShape: 'circle',
    description: 'Zone-1 grunt. Glass Eel — translucent, darting; physical damage.' },
  { key: 'barb_louse', category: 'entity', fallbackColor: 0xff5533, fallbackShape: 'circle',
    description: 'Zone-1 grunt. Barb Louse — chitinous, parasitic; physical damage.' },
  { key: 'brine_lurker', category: 'entity', fallbackColor: 0x44aaff, fallbackShape: 'circle',
    description: 'Zone-1 elite. Brine Lurker — brine, ambush; pressure damage.' },
  { key: 'tide_revenant', category: 'entity', fallbackColor: 0x44aaff, fallbackShape: 'circle',
    description: 'Zone-1 BOSS. Tide Revenant — brine, drowned; pressure damage.' },
  { key: 'hook_crab', category: 'entity', fallbackColor: 0xff5533, fallbackShape: 'circle',
    description: 'Zone-1 grunt. Hook Crab — chitinous, pincered; physical damage.' },
  { key: 'silt_skate', category: 'entity', fallbackColor: 0xff5533, fallbackShape: 'circle',
    description: 'Zone-1 grunt. Silt Skate — silt, gliding; physical damage.' },
  { key: 'anglerhound', category: 'entity', fallbackColor: 0xff5533, fallbackShape: 'circle',
    description: 'Zone-1 elite. Anglerhound — lure, predatory; physical damage.' },
  { key: 'choir_of_teeth', category: 'entity', fallbackColor: 0x44aaff, fallbackShape: 'circle',
    description: 'Zone-1 BOSS. Choir of Teeth — swarm, maw; pressure damage.' },
  { key: 'spine_drifter', category: 'entity', fallbackColor: 0x88cc44, fallbackShape: 'circle',
    description: 'Zone-1 grunt. Spine Drifter — floating, venomous; spore damage.' },
  { key: 'gulf_leech', category: 'entity', fallbackColor: 0x88cc44, fallbackShape: 'circle',
    description: 'Zone-1 grunt. Gulf Leech — draining, parasitic; spore damage.' },
  { key: 'carapace_warden', category: 'entity', fallbackColor: 0xbb8844, fallbackShape: 'circle',
    description: 'Zone-1 elite. Carapace Warden — armored, calcified; seismic damage.' },
  { key: 'maw_of_the_shallows', category: 'entity', fallbackColor: 0x44aaff, fallbackShape: 'circle',
    description: 'Zone-1 BOSS. Maw of the Shallows — leviathan, maw; pressure damage.' },
  { key: 'razor_polyp', category: 'entity', fallbackColor: 0xff5533, fallbackShape: 'circle',
    description: 'Zone-1 grunt. Razor Polyp — colonial, bladed; physical damage.' },
  { key: 'murk_stalker', category: 'entity', fallbackColor: 0xff5533, fallbackShape: 'circle',
    description: 'Zone-1 grunt. Murk Stalker — shadow, stalking; physical damage.' },
  { key: 'pressure_herald', category: 'entity', fallbackColor: 0x44aaff, fallbackShape: 'circle',
    description: 'Zone-1 elite. Pressure Herald — pressure, heraldic; pressure damage.' },
  { key: 'leviathan_hatchling', category: 'entity', fallbackColor: 0x44aaff, fallbackShape: 'circle',
    description: 'Zone-1 BOSS. Leviathan Hatchling — leviathan, brine; pressure damage.' },
];

// ── Entities — Zone 2 (Mycosphere), Floors 6–10 (T-296) ──────────────────────
const ENTITIES_MYCOSPHERE: readonly SpriteSpec[] = [
  { key: 'spore_tick', category: 'entity', fallbackColor: 0x88cc44, fallbackShape: 'circle',
    description: 'Zone-2 grunt. Spore Tick — spore, skittering; spore damage.' },
  { key: 'cap_lurcher', category: 'entity', fallbackColor: 0xff5533, fallbackShape: 'circle',
    description: 'Zone-2 grunt. Cap Lurcher — cap, lumbering; physical damage.' },
  { key: 'mycelial_warden', category: 'entity', fallbackColor: 0x88cc44, fallbackShape: 'circle',
    description: 'Zone-2 elite. Mycelial Warden — mycelial, rooted; spore damage.' },
  { key: 'the_bloomheart', category: 'entity', fallbackColor: 0x88cc44, fallbackShape: 'circle',
    description: 'Zone-2 BOSS. The Bloomheart — bloom, spore; spore damage.' },
  { key: 'rot_gnat', category: 'entity', fallbackColor: 0x88cc44, fallbackShape: 'circle',
    description: 'Zone-2 grunt. Rot Gnat — rot, swarming; spore damage.' },
  { key: 'blight_crawler', category: 'entity', fallbackColor: 0x88cc44, fallbackShape: 'circle',
    description: 'Zone-2 grunt. Blight Crawler — blight, crawling; spore damage.' },
  { key: 'fungal_brute', category: 'entity', fallbackColor: 0xff5533, fallbackShape: 'circle',
    description: 'Zone-2 elite. Fungal Brute — engorged, slow; physical damage.' },
  { key: 'mother_of_spores', category: 'entity', fallbackColor: 0x88cc44, fallbackShape: 'circle',
    description: 'Zone-2 BOSS. Mother of Spores — matron, spore; spore damage.' },
  { key: 'ember_cap', category: 'entity', fallbackColor: 0xff7733, fallbackShape: 'circle',
    description: 'Zone-2 grunt. Ember Cap — ember, smoldering; thermal damage.' },
  { key: 'mire_hopper', category: 'entity', fallbackColor: 0xff5533, fallbackShape: 'circle',
    description: 'Zone-2 grunt. Mire Hopper — mire, leaping; physical damage.' },
  { key: 'spore_caster', category: 'entity', fallbackColor: 0x88cc44, fallbackShape: 'circle',
    description: 'Zone-2 elite. Spore Caster — caster, sporing; spore damage.' },
  { key: 'the_rotpriest', category: 'entity', fallbackColor: 0x88cc44, fallbackShape: 'circle',
    description: 'Zone-2 BOSS. The Rotpriest — priest, decay; spore damage.' },
  { key: 'husk_walker', category: 'entity', fallbackColor: 0xff5533, fallbackShape: 'circle',
    description: 'Zone-2 grunt. Husk Walker — husk, shambling; physical damage.' },
  { key: 'gas_bladder', category: 'entity', fallbackColor: 0x88cc44, fallbackShape: 'circle',
    description: 'Zone-2 grunt. Gas Bladder — gas, bloated; spore damage.' },
  { key: 'myconid_titan', category: 'entity', fallbackColor: 0xff5533, fallbackShape: 'circle',
    description: 'Zone-2 elite. Myconid Titan — titan, towering; physical damage.' },
  { key: 'veil_of_decay', category: 'entity', fallbackColor: 0x88cc44, fallbackShape: 'circle',
    description: 'Zone-2 BOSS. Veil of Decay — veil, decay; spore damage.' },
  { key: 'pollen_wraith', category: 'entity', fallbackColor: 0x88cc44, fallbackShape: 'circle',
    description: 'Zone-2 grunt. Pollen Wraith — pollen, drifting; spore damage.' },
  { key: 'cinder_spore', category: 'entity', fallbackColor: 0xff7733, fallbackShape: 'circle',
    description: 'Zone-2 grunt. Cinder Spore — cinder, burning; thermal damage.' },
  { key: 'grove_warden', category: 'entity', fallbackColor: 0x88cc44, fallbackShape: 'circle',
    description: 'Zone-2 elite. Grove Warden — grove, ancient; spore damage.' },
  { key: 'the_great_mycelium', category: 'entity', fallbackColor: 0x88cc44, fallbackShape: 'circle',
    description: 'Zone-2 BOSS. The Great Mycelium — leviathan, mycelial; spore damage.' },
];

// ── Tiles (combat grid) ──────────────────────────────────────────────────────
const TILES: readonly SpriteSpec[] = [
  { key: 'tile_open', category: 'tile', fallbackColor: 0x0d1220, fallbackShape: 'rect',
    description: 'Walkable floor tile. Dark cave-rock, subtle texture; must not distract from entities on top. Tileable edges.' },
  { key: 'tile_wall', category: 'tile', fallbackColor: 0x1e2a40, fallbackShape: 'rect',
    description: 'Impassable wall/rock. Visibly solid and darker/raised vs floor. Tileable.' },
  { key: 'tile_hazard', category: 'tile', fallbackColor: 0x4a2030, fallbackShape: 'rect',
    description: 'Damaging hazard tile (acid pool / vent). Glowing menacing red-magenta; clearly "do not stand here".' },
  { key: 'tile_cover', category: 'tile', fallbackColor: 0x223044, fallbackShape: 'rect',
    description: 'Partial cover tile (rocks/debris). Reads as low obstacle you can stand near. Tileable.' },
  { key: 'tile_elevated', category: 'tile', fallbackColor: 0x2a3a52, fallbackShape: 'rect',
    description: 'Elevated ground tile. Lighter/raised plateau look. Tileable.' },
  { key: 'tile_corruption', category: 'tile', fallbackColor: 0x3a2050, fallbackShape: 'rect',
    description: 'Corrupted/VEIN-tainted floor. Sickly violet organic spread creeping over rock. Tileable.' },
];

// ── Room-node icons (floor map) ──────────────────────────────────────────────
const ROOMS: readonly SpriteSpec[] = [
  { key: 'room_combat', category: 'room', fallbackColor: 0x1a2840, fallbackShape: 'circle',
    description: 'Map icon: combat room. Crossed-claws / threat glyph. Simple, legible at ~28px.' },
  { key: 'room_loot', category: 'room', fallbackColor: 0x1a2840, fallbackShape: 'circle',
    description: 'Map icon: loot room. Container/cache glyph.' },
  { key: 'room_safe', category: 'room', fallbackColor: 0x12331f, fallbackShape: 'circle',
    description: 'Map icon: safe/rest room. Calm campfire/heart glyph; greenish.' },
  { key: 'room_merchant', category: 'room', fallbackColor: 0x1a2840, fallbackShape: 'circle',
    description: 'Map icon: merchant/dispenser room. Currency/vending glyph.' },
  { key: 'room_trap', category: 'room', fallbackColor: 0x1a2840, fallbackShape: 'circle',
    description: 'Map icon: trap room. Spike/warning glyph.' },
  { key: 'room_lace_event', category: 'room', fallbackColor: 0x1a2840, fallbackShape: 'circle',
    description: 'Map icon: LACE narrative event room. Speech/signal glyph; companion-AI motif.' },
  { key: 'room_boss', category: 'room', fallbackColor: 0xff4444, fallbackShape: 'circle',
    description: 'Map icon: boss room. Skull/crown threat glyph; red, ominous.' },
];

// ── Item icons (inventory bar) — lower priority; text labels until art ships ──
const ITEMS: readonly SpriteSpec[] = [
  { key: 'vein_serum', category: 'item', fallbackColor: 0x44ff88, fallbackShape: 'rect', description: 'Item icon: healing vial, green fluid.' },
  { key: 'minor_patch', category: 'item', fallbackColor: 0x44ff88, fallbackShape: 'rect', description: 'Item icon: small medical patch.' },
  { key: 'deep_tonic', category: 'item', fallbackColor: 0x44ffaa, fallbackShape: 'rect', description: 'Item icon: large potent healing flask.' },
  { key: 'frag_grenade', category: 'item', fallbackColor: 0xffaa44, fallbackShape: 'rect', description: 'Item icon: fragmentation grenade.' },
  { key: 'thermal_charge', category: 'item', fallbackColor: 0xff7733, fallbackShape: 'rect', description: 'Item icon: thermal/incendiary charge.' },
  { key: 'acid_flask', category: 'item', fallbackColor: 0x88cc44, fallbackShape: 'rect', description: 'Item icon: corrosive acid flask.' },
  { key: 'concussion_round', category: 'item', fallbackColor: 0xccaa55, fallbackShape: 'rect', description: 'Item icon: single-target concussion shell.' },
  { key: 'void_shard', category: 'item', fallbackColor: 0x9966ff, fallbackShape: 'rect', description: 'Item icon: void-energy shard.' },
  { key: 'spore_bomb', category: 'item', fallbackColor: 0x88dd66, fallbackShape: 'rect', description: 'Item icon: spore cluster bomb (applies Infected).' },
  { key: 'flare', category: 'item', fallbackColor: 0xff9933, fallbackShape: 'rect', description: 'Item icon: burning flare (applies Burn).' },
  { key: 'snare_net', category: 'item', fallbackColor: 0xaabbcc, fallbackShape: 'rect', description: 'Item icon: snare net (applies Rooted).' },
  { key: 'emp_pulse', category: 'item', fallbackColor: 0x66ccff, fallbackShape: 'rect', description: 'Item icon: EMP pulse device (applies Suppressed).' },
  { key: 'depth_gauge', category: 'item', fallbackColor: 0x7a8fad, fallbackShape: 'rect', description: 'Item icon: passive depth-gauge instrument.' },
  { key: 'chitin_plate', category: 'item', fallbackColor: 0x9a7a4a, fallbackShape: 'rect', description: 'Item icon: passive armour plate.' },
  { key: 'reflex_booster', category: 'item', fallbackColor: 0x44ccff, fallbackShape: 'rect', description: 'Item icon: passive reflex stim.' },
  { key: 'hungry_blade', category: 'item', fallbackColor: 0xff4444, fallbackShape: 'rect', description: 'Item icon: cursed Hungry Blade — a jagged red blade that feeds on its wielder (+STR, drains max HP).' },
];

// ── Ability icons (ability bar) — lower priority ─────────────────────────────
const ABILITIES: readonly SpriteSpec[] = [
  { key: 'pressure_lance', category: 'ability', fallbackColor: 0x44ccff, fallbackShape: 'rect',
    description: 'Ability icon: single-target pressure lance — a focused bolt/spear of deep-sea pressure.' },
  { key: 'rupture', category: 'ability', fallbackColor: 0xffaa44, fallbackShape: 'rect',
    description: 'Ability icon: AoE seismic rupture — ground-shatter burst (applies Crushed).' },
];

export const SPRITE_MANIFEST: readonly SpriteSpec[] = [
  ...ENTITIES,
  ...ENTITIES_SHALLOWS,
  ...ENTITIES_MYCOSPHERE,
  ...TILES,
  ...ROOMS,
  ...ITEMS,
  ...ABILITIES,
];

/** Index by key for O(1) lookup at draw time. */
export const SPRITE_BY_KEY: ReadonlyMap<string, SpriteSpec> = new Map(
  SPRITE_MANIFEST.map((s) => [s.key, s]),
);

/** Sprite key for a tile type (`open` → `tile_open`). */
export function tileSpriteKey(tileType: string): string {
  return `tile_${tileType}`;
}

/** Sprite key for a room type (`boss` → `room_boss`). */
export function roomSpriteKey(roomType: string): string {
  return `room_${roomType}`;
}
