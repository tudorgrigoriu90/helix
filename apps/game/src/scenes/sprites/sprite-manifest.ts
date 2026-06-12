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

// ── Entities — Zone 3 (Lithic), Floors 11–15 (T-303) ─────────────────────────
const ENTITIES_LITHIC: readonly SpriteSpec[] = [
  { key: 'shale_skitter', category: 'entity', fallbackColor: 0xff5533, fallbackShape: 'circle',
    description: 'Zone-3 grunt. Shale Skitter — shale, skittering; physical damage.' },
  { key: 'flint_biter', category: 'entity', fallbackColor: 0xff5533, fallbackShape: 'circle',
    description: 'Zone-3 grunt. Flint Biter — flint, gnashing; physical damage.' },
  { key: 'granite_warden', category: 'entity', fallbackColor: 0xbb8844, fallbackShape: 'circle',
    description: 'Zone-3 elite. Granite Warden — granite, immovable; seismic damage.' },
  { key: 'the_quarrylord', category: 'entity', fallbackColor: 0xbb8844, fallbackShape: 'circle',
    description: 'Zone-3 BOSS. The Quarrylord — quarry, crushing; seismic damage.' },
  { key: 'quartz_lurker', category: 'entity', fallbackColor: 0xff5533, fallbackShape: 'circle',
    description: 'Zone-3 grunt. Quartz Lurker — quartz, faceted; physical damage.' },
  { key: 'magma_tick', category: 'entity', fallbackColor: 0xff7733, fallbackShape: 'circle',
    description: 'Zone-3 grunt. Magma Tick — magma, molten; thermal damage.' },
  { key: 'crystal_colossus', category: 'entity', fallbackColor: 0xbb8844, fallbackShape: 'circle',
    description: 'Zone-3 elite. Crystal Colossus — colossus, prismatic; seismic damage.' },
  { key: 'the_faultbreaker', category: 'entity', fallbackColor: 0xbb8844, fallbackShape: 'circle',
    description: 'Zone-3 BOSS. The Faultbreaker — fault, quaking; seismic damage.' },
  { key: 'scree_hound', category: 'entity', fallbackColor: 0xff5533, fallbackShape: 'circle',
    description: 'Zone-3 grunt. Scree Hound — scree, loping; physical damage.' },
  { key: 'ore_grub', category: 'entity', fallbackColor: 0xff5533, fallbackShape: 'circle',
    description: 'Zone-3 grunt. Ore Grub — ore, burrowing; physical damage.' },
  { key: 'obsidian_warden', category: 'entity', fallbackColor: 0xbb8844, fallbackShape: 'circle',
    description: 'Zone-3 elite. Obsidian Warden — obsidian, glassy; seismic damage.' },
  { key: 'the_deep_furnace', category: 'entity', fallbackColor: 0xff7733, fallbackShape: 'circle',
    description: 'Zone-3 BOSS. The Deep Furnace — furnace, molten; thermal damage.' },
  { key: 'gravel_wraith', category: 'entity', fallbackColor: 0xff5533, fallbackShape: 'circle',
    description: 'Zone-3 grunt. Gravel Wraith — gravel, whirling; physical damage.' },
  { key: 'sulfur_spitter', category: 'entity', fallbackColor: 0xff7733, fallbackShape: 'circle',
    description: 'Zone-3 grunt. Sulfur Spitter — sulfur, corrosive; thermal damage.' },
  { key: 'tremor_titan', category: 'entity', fallbackColor: 0xbb8844, fallbackShape: 'circle',
    description: 'Zone-3 elite. Tremor Titan — titan, thunderous; seismic damage.' },
  { key: 'the_pillarsaint', category: 'entity', fallbackColor: 0x44aaff, fallbackShape: 'circle',
    description: 'Zone-3 BOSS. The Pillarsaint — pillar, resonant; pressure damage.' },
  { key: 'geode_swarm', category: 'entity', fallbackColor: 0xff5533, fallbackShape: 'circle',
    description: 'Zone-3 grunt. Geode Swarm — geode, swarming; physical damage.' },
  { key: 'cinder_golem', category: 'entity', fallbackColor: 0xff7733, fallbackShape: 'circle',
    description: 'Zone-3 grunt. Cinder Golem — cinder, glowing; thermal damage.' },
  { key: 'bastion_warden', category: 'entity', fallbackColor: 0xbb8844, fallbackShape: 'circle',
    description: 'Zone-3 elite. Bastion Warden — bastion, fortified; seismic damage.' },
  { key: 'the_mountains_heart', category: 'entity', fallbackColor: 0xbb8844, fallbackShape: 'circle',
    description: 'Zone-3 BOSS. The Mountain\'s Heart — leviathan, tectonic; seismic damage.' },
];

// ── Entities — Zone 4 (Convergence), Floors 16–20 (T-303) ────────────────────
const ENTITIES_CONVERGENCE: readonly SpriteSpec[] = [
  { key: 'void_mote', category: 'entity', fallbackColor: 0xaa66ff, fallbackShape: 'circle',
    description: 'Zone-4 grunt. Void Mote — mote, flickering; void damage.' },
  { key: 'entropy_wisp', category: 'entity', fallbackColor: 0xaa66ff, fallbackShape: 'circle',
    description: 'Zone-4 grunt. Entropy Wisp — entropy, unraveling; void damage.' },
  { key: 'null_warden', category: 'entity', fallbackColor: 0xaa66ff, fallbackShape: 'circle',
    description: 'Zone-4 elite. Null Warden — null, silent; void damage.' },
  { key: 'the_threshold', category: 'entity', fallbackColor: 0xaa66ff, fallbackShape: 'circle',
    description: 'Zone-4 BOSS. The Threshold — gate, threshold; void damage.' },
  { key: 'star_eater', category: 'entity', fallbackColor: 0xff7733, fallbackShape: 'circle',
    description: 'Zone-4 grunt. Star Eater — stellar, devouring; thermal damage.' },
  { key: 'rift_stalker', category: 'entity', fallbackColor: 0xaa66ff, fallbackShape: 'circle',
    description: 'Zone-4 grunt. Rift Stalker — rift, stalking; void damage.' },
  { key: 'collapse_caster', category: 'entity', fallbackColor: 0xaa66ff, fallbackShape: 'circle',
    description: 'Zone-4 elite. Collapse Caster — collapse, gravitic; void damage.' },
  { key: 'the_hollow_choir', category: 'entity', fallbackColor: 0xddccff, fallbackShape: 'circle',
    description: 'Zone-4 BOSS. The Hollow Choir — choir, hollow; true damage.' },
  { key: 'paradox_shade', category: 'entity', fallbackColor: 0xaa66ff, fallbackShape: 'circle',
    description: 'Zone-4 grunt. Paradox Shade — paradox, shifting; void damage.' },
  { key: 'ash_seraph', category: 'entity', fallbackColor: 0xff7733, fallbackShape: 'circle',
    description: 'Zone-4 grunt. Ash Seraph — seraph, burning; thermal damage.' },
  { key: 'singularity_titan', category: 'entity', fallbackColor: 0x44aaff, fallbackShape: 'circle',
    description: 'Zone-4 elite. Singularity Titan — singularity, crushing; pressure damage.' },
  { key: 'the_unmaker', category: 'entity', fallbackColor: 0xddccff, fallbackShape: 'circle',
    description: 'Zone-4 BOSS. The Unmaker — unmaking, entropy; true damage.' },
  { key: 'echo_phantom', category: 'entity', fallbackColor: 0xaa66ff, fallbackShape: 'circle',
    description: 'Zone-4 grunt. Echo Phantom — echo, phantasmal; void damage.' },
  { key: 'dread_acolyte', category: 'entity', fallbackColor: 0xaa66ff, fallbackShape: 'circle',
    description: 'Zone-4 grunt. Dread Acolyte — acolyte, devout; void damage.' },
  { key: 'eclipse_warden', category: 'entity', fallbackColor: 0xaa66ff, fallbackShape: 'circle',
    description: 'Zone-4 elite. Eclipse Warden — eclipse, shrouded; void damage.' },
  { key: 'the_devouring_dark', category: 'entity', fallbackColor: 0xddccff, fallbackShape: 'circle',
    description: 'Zone-4 BOSS. The Devouring Dark — devourer, abyssal; true damage.' },
  { key: 'omen_spawn', category: 'entity', fallbackColor: 0xaa66ff, fallbackShape: 'circle',
    description: 'Zone-4 grunt. Omen Spawn — omen, portentous; void damage.' },
  { key: 'final_husk', category: 'entity', fallbackColor: 0xddccff, fallbackShape: 'circle',
    description: 'Zone-4 grunt. Final Husk — husk, terminal; true damage.' },
  { key: 'herald_of_the_end', category: 'entity', fallbackColor: 0xddccff, fallbackShape: 'circle',
    description: 'Zone-4 elite. Herald of the End — herald, apocalyptic; true damage.' },
  { key: 'the_convergence', category: 'entity', fallbackColor: 0xddccff, fallbackShape: 'circle',
    description: 'Zone-4 BOSS. The Convergence — leviathan, apex; the final boss; true damage.' },
];

// ── Tiles (combat grid) ──────────────────────────────────────────────────────
const TILES: readonly SpriteSpec[] = [
  { key: 'tile_open', category: 'tile', fallbackColor: 0x0d1220, fallbackShape: 'rect',
    description: 'Walkable floor tile — col 1 row 0 of the Kenney sheet (plain cave floor).' },
  { key: 'tile_wall', category: 'tile', fallbackColor: 0x1e2a40, fallbackShape: 'rect',
    description: 'Impassable wall/rock — col 16 row 0.' },
  { key: 'tile_hazard', category: 'tile', fallbackColor: 0x4a2030, fallbackShape: 'rect',
    description: 'Damaging hazard tile — warning cones, col 22 row 0.' },
  { key: 'tile_cover', category: 'tile', fallbackColor: 0x223044, fallbackShape: 'rect',
    description: 'Partial cover tile — staircase, col 21 row 0.' },
  { key: 'tile_elevated', category: 'tile', fallbackColor: 0x2a3a52, fallbackShape: 'rect',
    description: 'Elevated ground tile — grass, col 5 row 0.' },
  { key: 'tile_corruption', category: 'tile', fallbackColor: 0x3a2050, fallbackShape: 'rect',
    description: 'Corrupted/VEIN-tainted floor — grass variant, col 7 row 0.' },
];

// ── Named row-0 sprites from sprite-map.json (for direct coordinate verification) ──
// Keys match the sprite-map.json names exactly (col/row in name = spritesheet coord).
const TILES_NAMED: readonly SpriteSpec[] = [
  { key: 'tile_c01r00', category: 'tile', fallbackColor: 0x0d1220, fallbackShape: 'rect', description: 'Floor tile col 1 row 0.' },
  { key: 'tile_c02r00', category: 'tile', fallbackColor: 0x0d1220, fallbackShape: 'rect', description: 'Floor tile col 2 row 0.' },
  { key: 'tile_c03r00', category: 'tile', fallbackColor: 0x0d1220, fallbackShape: 'rect', description: 'Floor tile col 3 row 0.' },
  { key: 'tile_c04r00', category: 'tile', fallbackColor: 0x0d1220, fallbackShape: 'rect', description: 'Floor tile col 4 row 0.' },
  { key: 'grass_c05r00', category: 'tile', fallbackColor: 0x1a3a20, fallbackShape: 'rect', description: 'Grass tile col 5 row 0.' },
  { key: 'grass_c06r00', category: 'tile', fallbackColor: 0x1a3a20, fallbackShape: 'rect', description: 'Grass tile col 6 row 0.' },
  { key: 'grass_c07r00', category: 'tile', fallbackColor: 0x1a3a20, fallbackShape: 'rect', description: 'Grass tile col 7 row 0.' },
  { key: 'straight_row_c08r00', category: 'tile', fallbackColor: 0x2a2a2a, fallbackShape: 'rect', description: 'Straight road tile col 8 row 0.' },
  { key: 'road_corer_right_c09r00', category: 'tile', fallbackColor: 0x2a2a2a, fallbackShape: 'rect', description: 'Road corner right col 9 row 0.' },
  { key: 'road_intersection_no_left_c10r00', category: 'tile', fallbackColor: 0x2a2a2a, fallbackShape: 'rect', description: 'Road intersection (no left) col 10 row 0.' },
  { key: 'road_intersection_c11r00', category: 'tile', fallbackColor: 0x2a2a2a, fallbackShape: 'rect', description: 'Road intersection col 11 row 0.' },
  { key: 'road_full_end_c12r00', category: 'tile', fallbackColor: 0x2a2a2a, fallbackShape: 'rect', description: 'Road full end col 12 row 0.' },
  { key: 'tile_margin_right_c13r00', category: 'tile', fallbackColor: 0x1e2a40, fallbackShape: 'rect', description: 'Tile margin right col 13 row 0.' },
  { key: 'tile_margin_door_right_c14r00', category: 'tile', fallbackColor: 0x1e2a40, fallbackShape: 'rect', description: 'Tile margin door right col 14 row 0.' },
  { key: 'tile_map_margin_corner_bottom_right_c15r00', category: 'tile', fallbackColor: 0x1e2a40, fallbackShape: 'rect', description: 'Tile map margin corner bottom-right col 15 row 0.' },
  { key: 'tile_c16r00', category: 'tile', fallbackColor: 0x1e2a40, fallbackShape: 'rect', description: 'Wall tile col 16 row 0.' },
  { key: 'tile_c17r00', category: 'tile', fallbackColor: 0x1e2a40, fallbackShape: 'rect', description: 'Wall/floor tile col 17 row 0.' },
  { key: 'structure_c18r00', category: 'tile', fallbackColor: 0x0d1220, fallbackShape: 'rect', description: 'Structure tile col 18 row 0.' },
  { key: 'structure_c19r00', category: 'tile', fallbackColor: 0x0d1220, fallbackShape: 'rect', description: 'Structure tile col 19 row 0.' },
  { key: 'structure_c20r00', category: 'tile', fallbackColor: 0x0d1220, fallbackShape: 'rect', description: 'Structure tile col 20 row 0.' },
  { key: 'staircase_c21r00', category: 'tile', fallbackColor: 0x223044, fallbackShape: 'rect', description: 'Staircase tile col 21 row 0.' },
  { key: 'warning_cones_c22r00', category: 'tile', fallbackColor: 0x4a2030, fallbackShape: 'rect', description: 'Warning cones tile col 22 row 0.' },
  { key: 'light_bulb_c23r00', category: 'tile', fallbackColor: 0xffcc44, fallbackShape: 'rect', description: 'Light bulb tile col 23 row 0.' },
  { key: 'player_c24r00', category: 'entity', fallbackColor: 0xa0ffdc, fallbackShape: 'circle', description: 'Player sprite col 24 row 0.' },
  { key: 'player_c25r00', category: 'entity', fallbackColor: 0xa0ffdc, fallbackShape: 'circle', description: 'Player sprite col 25 row 0.' },
  { key: 'player_c26r00', category: 'entity', fallbackColor: 0xa0ffdc, fallbackShape: 'circle', description: 'Player sprite col 26 row 0.' },
  { key: 'player_c27r00', category: 'entity', fallbackColor: 0xa0ffdc, fallbackShape: 'circle', description: 'Player sprite col 27 row 0.' },
  { key: 'player_c28r00', category: 'entity', fallbackColor: 0xa0ffdc, fallbackShape: 'circle', description: 'Player sprite col 28 row 0.' },
  { key: 'player_c29r00', category: 'entity', fallbackColor: 0xa0ffdc, fallbackShape: 'circle', description: 'Player sprite col 29 row 0.' },
  { key: 'player_c30r00', category: 'entity', fallbackColor: 0xa0ffdc, fallbackShape: 'circle', description: 'Player sprite col 30 row 0.' },
  { key: 'player_c31r00', category: 'entity', fallbackColor: 0xa0ffdc, fallbackShape: 'circle', description: 'Player sprite col 31 row 0.' },
  { key: 'creature_c32r00', category: 'entity', fallbackColor: 0xff5533, fallbackShape: 'circle', description: 'Creature sprite col 32 row 0.' },
  { key: 'armor_c33r00', category: 'item', fallbackColor: 0x9a7a4a, fallbackShape: 'rect', description: 'Armour/gear sprite col 33 row 0.' },
  { key: 'armor_c34r00', category: 'item', fallbackColor: 0x9a7a4a, fallbackShape: 'rect', description: 'Armour/gear sprite col 34 row 0.' },
  { key: 'armor_c35r00', category: 'item', fallbackColor: 0x9a7a4a, fallbackShape: 'rect', description: 'Armour/gear sprite col 35 row 0.' },
  { key: 'armor_c36r00', category: 'item', fallbackColor: 0x9a7a4a, fallbackShape: 'rect', description: 'Armour/gear sprite col 36 row 0.' },
  { key: 'armor_c37r00', category: 'item', fallbackColor: 0x9a7a4a, fallbackShape: 'rect', description: 'Armour/gear sprite col 37 row 0.' },
  { key: 'armor_c38r00', category: 'item', fallbackColor: 0x9a7a4a, fallbackShape: 'rect', description: 'Armour/gear sprite col 38 row 0.' },
  { key: 'armor_c39r00', category: 'item', fallbackColor: 0x9a7a4a, fallbackShape: 'rect', description: 'Armour/gear sprite col 39 row 0.' },
  { key: 'armor_c40r00', category: 'item', fallbackColor: 0x9a7a4a, fallbackShape: 'rect', description: 'Armour/gear sprite col 40 row 0.' },
  { key: 'armor_c41r00', category: 'item', fallbackColor: 0x9a7a4a, fallbackShape: 'rect', description: 'Armour/gear sprite col 41 row 0.' },
  { key: 'armor_c42r00', category: 'item', fallbackColor: 0x9a7a4a, fallbackShape: 'rect', description: 'Armour/gear sprite col 42 row 0.' },
  { key: 'armor_c43r00', category: 'item', fallbackColor: 0x9a7a4a, fallbackShape: 'rect', description: 'Armour/gear sprite col 43 row 0.' },
  { key: 'armor_c44r00', category: 'item', fallbackColor: 0x9a7a4a, fallbackShape: 'rect', description: 'Armour/gear sprite col 44 row 0.' },
  { key: 'armor_c45r00', category: 'item', fallbackColor: 0x9a7a4a, fallbackShape: 'rect', description: 'Armour/gear sprite col 45 row 0.' },
  { key: 'armor_c46r00', category: 'item', fallbackColor: 0x9a7a4a, fallbackShape: 'rect', description: 'Armour/gear sprite col 46 row 0.' },
  { key: 'armor_c47r00', category: 'item', fallbackColor: 0x9a7a4a, fallbackShape: 'rect', description: 'Armour/gear sprite col 47 row 0.' },
  { key: 'armor_c48r00', category: 'item', fallbackColor: 0x9a7a4a, fallbackShape: 'rect', description: 'Armour/gear sprite col 48 row 0.' },
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
  // ── T-304 full-tier catalog ──
  { key: 'greater_tonic', category: 'item', fallbackColor: 0x44ffcc, fallbackShape: 'rect', description: 'Item icon: uncommon healing tonic, double flask.' },
  { key: 'storm_cell', category: 'item', fallbackColor: 0xffcc44, fallbackShape: 'rect', description: 'Item icon: crackling thermal storm cell.' },
  { key: 'null_grenade', category: 'item', fallbackColor: 0x8866ff, fallbackShape: 'rect', description: 'Item icon: void null grenade.' },
  { key: 'shock_lattice', category: 'item', fallbackColor: 0x66ddff, fallbackShape: 'rect', description: 'Item icon: stunning shock lattice (applies Stagger).' },
  { key: 'pressure_valve', category: 'item', fallbackColor: 0x6688aa, fallbackShape: 'rect', description: 'Item icon: passive pressure valve (+RES).' },
  { key: 'ganglion_graft', category: 'item', fallbackColor: 0xcc88ff, fallbackShape: 'rect', description: 'Item icon: passive neural ganglion graft (+INT).' },
  { key: 'sprint_tendons', category: 'item', fallbackColor: 0x88ffcc, fallbackShape: 'rect', description: 'Item icon: passive sprint tendons (+AGI).' },
  { key: 'keelplate', category: 'item', fallbackColor: 0x99aabb, fallbackShape: 'rect', description: 'Item icon: equipment keelplate hull section (+max HP).' },
  { key: 'serrated_husk', category: 'item', fallbackColor: 0xcc8855, fallbackShape: 'rect', description: 'Item icon: equipment serrated husk blade (+STR).' },
  { key: 'filter_membrane', category: 'item', fallbackColor: 0x77ccaa, fallbackShape: 'rect', description: 'Item icon: passive filter membrane (+HP/+RES).' },
  { key: 'vein_elixir', category: 'item', fallbackColor: 0x33ffaa, fallbackShape: 'rect', description: 'Item icon: rare VEIN elixir, crystalline fluid.' },
  { key: 'singularity_charge', category: 'item', fallbackColor: 0x7744ff, fallbackShape: 'rect', description: 'Item icon: rare void singularity charge, wide blast.' },
  { key: 'seismic_core', category: 'item', fallbackColor: 0xddaa33, fallbackShape: 'rect', description: 'Item icon: rare seismic core, ground-shatter charge.' },
  { key: 'wardstone', category: 'item', fallbackColor: 0xaabb88, fallbackShape: 'rect', description: 'Item icon: rare passive wardstone (+RES/+HP).' },
  { key: 'apex_sinew', category: 'item', fallbackColor: 0xff8866, fallbackShape: 'rect', description: 'Item icon: rare equipment apex sinew (+STR/+AGI).' },
  { key: 'mindlattice', category: 'item', fallbackColor: 0xbb99ff, fallbackShape: 'rect', description: 'Item icon: rare passive mindlattice (+INT).' },
  { key: 'bulwark_plating', category: 'item', fallbackColor: 0x8899aa, fallbackShape: 'rect', description: 'Item icon: rare equipment bulwark plating (+RES/+HP).' },
  { key: 'leviathan_scale', category: 'item', fallbackColor: 0x4466cc, fallbackShape: 'rect', description: 'Item icon: legendary leviathan scale (+RES/+HP).' },
  { key: 'convergence_lens', category: 'item', fallbackColor: 0xeeccff, fallbackShape: 'rect', description: 'Item icon: legendary convergence lens (+INT/+AP).' },
  { key: 'sunheart_core', category: 'item', fallbackColor: 0xffaa33, fallbackShape: 'rect', description: 'Item icon: legendary sunheart core (+STR/+AGI).' },
  { key: 'omega_serum', category: 'item', fallbackColor: 0x33ffdd, fallbackShape: 'rect', description: 'Item icon: legendary omega serum, full restore.' },
  { key: 'worldroot_bomb', category: 'item', fallbackColor: 0x55cc44, fallbackShape: 'rect', description: 'Item icon: legendary worldroot spore bomb, wide blast.' },
  { key: 'void_eye', category: 'item', fallbackColor: 0xaa44ff, fallbackShape: 'rect', description: 'Item icon: cursed Void Eye — an unblinking violet eye; insight bought with exposure (+INT, −RES).' },
  { key: 'fever_root', category: 'item', fallbackColor: 0xff6655, fallbackShape: 'rect', description: 'Item icon: cursed Fever Root — a pulsing red root; feverish vitality at the cost of tempo (+max HP, −AP).' },
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
  ...ENTITIES_LITHIC,
  ...ENTITIES_CONVERGENCE,
  ...TILES,
  ...TILES_NAMED,
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
