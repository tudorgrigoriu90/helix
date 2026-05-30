# Sprite source art

`tilesheet-source.png` — Kenney **Roguelike/RPG pack** (coloured, transparent),
CC0 (public domain, commercial use OK, attribution appreciated not required).
Source: https://kenney.nl/assets/roguelike-rpg-pack

Geometry: 16×16 tiles, 1px spacing, no margin → 49×22 tiles (832×373).

`sprite-map.json` maps each game sprite key → `[col, row]` in the sheet.
Regenerate the PNGs in `public/sprites/` with:

```
node tools/tilesheet.cjs map apps/game/art/sprite-map.json 4
```

Other subcommands (see `tools/tilesheet.cjs`):
- `region <c0> <r0> <c1> <r1> <scale> <out.png>` — zoom a tile range to identify tiles.
- `montage <map.json> <scale> <out.png>` — preview the mapped tiles in a grid.
