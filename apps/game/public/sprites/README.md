# Sprites

Drop PNG sprites here. Filenames must match the sprite keys in
`apps/game/src/scenes/sprites/sprite-manifest.ts` (and `docs/SPRITES.md`).

A missing sprite is NOT an error — the renderer falls back to a geometry
primitive (coloured circle/rect), so the game runs identically with zero,
some, or all sprites present. Drop `<key>.png` and it appears automatically.

Primary size 128×128 (`<key>.png`); optional small variant 64×64
(`<key>.64.png`) for UI bars/minimap. Transparent background.
