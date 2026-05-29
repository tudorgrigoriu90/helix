# Strand Descent — Sprite Requirements

This is the artist-facing checklist for the game's sprites. It is generated from
the single source of truth: `apps/game/src/scenes/sprites/sprite-manifest.ts`
(kept in sync — a CI test asserts every enemy / item / tile / room id has a
manifest entry).

## How sprites are used (read first)

- **Drop PNGs into `apps/game/public/sprites/`.** The filename must match the
  **key** in the tables below (e.g. `filterer.png`).
- **Sprites are optional and incremental.** A missing sprite is *not* an error —
  the game falls back to a coloured geometric primitive (the current look). Add
  one PNG at a time; each appears automatically with no code change. You never
  have to deliver them all at once.
- **The colour in each row is the current fallback** — a useful hint for the
  palette/intent, but you are not bound to it.

## File + size conventions

| Variant | Filename | Size | Used for |
| --- | --- | --- | --- |
| **Primary** (required) | `<key>.png` | **128×128** | Everything — the scene loads this and scales it to fit (tiles ~50px, entities ~46px, map icons ~22px). |
| **Small** (optional) | `<key>.64.png` | **64×64** | Crisp small-size rendering for UI bars + minimap nodes. Not yet auto-loaded; provide it and we'll wire selection by size. Skip if the 128px scales down cleanly. |

Both variants:
- **PNG, transparent background** (RGBA).
- **Square canvas**, subject **centred** with a few px of padding (so circular
  framing / scaling doesn't clip it).
- **Mobile-portrait, top-down/front-facing** reading — these are seen small on a
  390px-wide screen, so silhouette and a single dominant colour matter more than
  fine detail.
- Art direction: a bioluminescent deep-sea / alien-megastructure ("the VEIN")
  vibe; dark backgrounds, glowing accents. Teal = the player; reds/oranges =
  threats.

---

## 1. Entities — player + Zone-1 enemy roster (HIGHEST priority)

These have the biggest visual payoff. Author at 128×128; rendered ~46px in
combat.

| Key (filename stem) | Hint colour | Description |
| --- | --- | --- |
| `player` | teal `#A0FFDC` | The descending organism (player avatar). Bioluminescent teal, humanoid-but-alien silhouette; reads clearly as "you" at a glance. Faces up/neutral. |
| `filterer` | red `#FF4444` | Zone-1 grunt. Translucent jellyfish-like filter-feeder drifting in cave water; soft red/pink membrane. |
| `cave_crawler` | crimson `#FF5533` | Zone-1 grunt. Fast skittering chitinous arthropod, many legs; aggressive crimson carapace. |
| `acid_spitter` | green `#88CC44` | Zone-1 grunt. Bulbous gland-creature with a corrosive green sac; spore/acid theme. |
| `scavenger` | orange `#FF8844` | Zone-1 grunt. Hunched opportunist scuttler picking at remains; mottled orange-brown. |
| `shell_brute` | bronze `#CC7733` | Zone-1 elite. Heavily armoured, slow calcified bruiser; thick plated shell, small head. |
| `pressure_warden` | bright red `#FF2222` | Zone-1 **BOSS**. Imposing fluorescent pressure-warden; larger, menacing, glowing deep-sea bioluminescence. Should feel like a fight. |

---

## 2. Combat-grid tiles (HIGH priority)

Author at 128×128; rendered ~50px square. **Edges should tile seamlessly** (a
grid of them sits edge-to-edge). Keep them low-contrast so entities on top stay
readable.

| Key (filename stem) | Hint colour | Description |
| --- | --- | --- |
| `tile_open` | `#0D1220` | Walkable floor tile. Dark cave-rock, subtle texture; must not distract from entities on top. Tileable edges. |
| `tile_wall` | `#1E2A40` | Impassable wall/rock. Visibly solid and darker/raised vs floor. Tileable. |
| `tile_hazard` | `#4A2030` | Damaging hazard tile (acid pool / vent). Glowing menacing red-magenta; clearly "do not stand here". |
| `tile_cover` | `#223044` | Partial cover tile (rocks/debris). Reads as a low obstacle you can stand near. Tileable. |
| `tile_elevated` | `#2A3A52` | Elevated ground tile. Lighter/raised plateau look. Tileable. |
| `tile_corruption` | `#3A2050` | Corrupted/VEIN-tainted floor. Sickly violet organic spread creeping over rock. Tileable. |

---

## 3. Floor-map room icons (MEDIUM priority)

Author at 128×128; rendered ~22px, sitting on top of a coloured node disc. So
these should be **simple, single-subject glyphs** that read at tiny size; the
disc behind them already conveys state (cleared / current / boss).

| Key (filename stem) | Hint colour | Description |
| --- | --- | --- |
| `room_combat` | `#1A2840` | Combat room glyph. Crossed-claws / threat mark. Simple, legible at ~22px. |
| `room_loot` | `#1A2840` | Loot room glyph. Container / cache. |
| `room_safe` | `#12331F` | Safe/rest room glyph. Calm campfire/heart; greenish. |
| `room_merchant` | `#1A2840` | Merchant/dispenser room glyph. Currency / vending. |
| `room_trap` | `#1A2840` | Trap room glyph. Spike / warning. |
| `room_lace_event` | `#1A2840` | LACE narrative-event room glyph. Speech/signal; companion-AI motif. |
| `room_boss` | `#FF4444` | Boss room glyph. Skull / crown; red, ominous. |

---

## 4. Ability icons (MEDIUM priority)

Author at 128×128 (a 64×64 variant is ideal here — they render small on the
ability bar). Square icon, bold and readable.

| Key (filename stem) | Hint colour | Description |
| --- | --- | --- |
| `pressure_lance` | `#44CCFF` | Single-target pressure lance — a focused bolt/spear of deep-sea pressure. |
| `rupture` | `#FFAA44` | AoE seismic rupture — a ground-shatter burst (applies Crushed). |

---

## 5. Item icons (LOWER priority — text labels work fine until art lands)

Author at 128×128 (64×64 ideal — these render small in the consumable bar).
Inventory-style icons.

| Key (filename stem) | Hint colour | Description |
| --- | --- | --- |
| `vein_serum` | `#44FF88` | Healing vial, green fluid. |
| `minor_patch` | `#44FF88` | Small medical patch. |
| `deep_tonic` | `#44FFAA` | Large potent healing flask. |
| `frag_grenade` | `#FFAA44` | Fragmentation grenade. |
| `thermal_charge` | `#FF7733` | Thermal / incendiary charge. |
| `acid_flask` | `#88CC44` | Corrosive acid flask. |
| `concussion_round` | `#CCAA55` | Single-target concussion shell. |
| `void_shard` | `#9966FF` | Void-energy shard. |
| `spore_bomb` | `#88DD66` | Spore cluster bomb (applies Infected). |
| `flare` | `#FF9933` | Burning flare (applies Burn). |
| `snare_net` | `#AABBCC` | Snare net (applies Rooted). |
| `emp_pulse` | `#66CCFF` | EMP pulse device (applies Suppressed). |
| `depth_gauge` | `#7A8FAD` | Passive depth-gauge instrument. |
| `chitin_plate` | `#9A7A4A` | Passive armour plate. |
| `reflex_booster` | `#44CCFF` | Passive reflex stim. |

---

## Suggested delivery order

1. **`player` + the 6 enemies** — instantly makes combat look like a game.
2. **The 6 tiles** — turns the grid from flat colours into a real arena.
3. **Room icons + ability icons** — polish the map and combat bar.
4. **Item icons** — lowest priority; text labels are fine meanwhile.

Drop them into `apps/game/public/sprites/`, run `pnpm dev`, open the **RUN**
tab — each sprite you add replaces its placeholder live.
