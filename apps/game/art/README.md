# Sprite source art

`tilesheet-source.png` — Kenney **Roguelike/RPG pack** (coloured, transparent),
CC0 (public domain, commercial use OK, attribution appreciated not required).
Source: https://kenney.nl/assets/roguelike-rpg-pack

> **Master sprite collection: [`docs/colored.png`](../../../docs/colored.png)** —
> the full Kenney coloured sheet that *all* game sprites are sliced from. It has
> the **same geometry** as `tilesheet-source.png` here (832×373, 49×22 tiles,
> 16px, stride 17), so the `[col, row]` coordinates in `sprite-map.json` apply to
> it directly. When a future task needs a new sprite (room/road icons, items,
> abilities, animated frames, etc.): find its tile in `docs/colored.png`, add a
> `"<key>": [col, row]` entry to `sprite-map.json`, and run the `map` command
> below — it writes `public/sprites/<key>.png`. Use `region` / `montage` to
> locate tiles visually.

Geometry: 16×16 tiles, 1px spacing, no margin → 49×22 tiles (832×373).

`sprite-map.json` maps each game sprite key → `[col, row]` in the sheet.
Regenerate the PNGs in `public/sprites/` with:

```
node tools/tilesheet.cjs map apps/game/art/sprite-map.json 4
```

Other subcommands (see `tools/tilesheet.cjs`):
- `region <c0> <r0> <c1> <r1> <scale> <out.png>` — zoom a tile range to identify tiles.
- `montage <map.json> <scale> <out.png>` — preview the mapped tiles in a grid.
