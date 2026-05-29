# Strand Descent — Audio Requirements

The checklist for the game's audio, generated from the single source of truth:
`apps/game/src/scenes/audio/audio-manifest.ts` (a CI test asserts every key the
game plays has a manifest entry).

## How audio is used (read first)

- **Drop files into `apps/game/public/audio/`.** The filename must match the
  **key** in the tables below (e.g. `ui_click.ogg`).
- **Audio is optional and incremental.** A missing file is *not* an error — the
  game just plays nothing for that key (same philosophy as the sprites). Add one
  sound at a time; each starts playing automatically with no code change.
- **Music vs one-shots:** `music_*` tracks loop; `sfx_*` and `ui_*` are
  one-shots.

## File + format conventions

The renderer tries several extensions per key, in this order, and the browser
plays the first it can decode: **`.ogg` → `.m4a` → `.mp3`**.

| Platform | Best format |
| --- | --- |
| Web (Chrome/Firefox) + Android | `.ogg` (small, loops seamlessly) |
| iOS / Safari | `.m4a` (AAC) or `.mp3` |

> ✅ Provide **both** `<key>.ogg` **and** `<key>.m4a` (or `.mp3`) for full
> platform coverage. At minimum ship `.ogg` for web/Android.

Keep files small — they ship inside the app bundle. Music loops should be a few
hundred KB at most; one-shot SFX a few KB. Trim silence; make music loop
seamlessly (no click at the loop point).

**License:** prefer **CC0** (no attribution) for a clean commercial release.
Anything CC-BY must be credited in `docs/licenses/` and the in-app
*About → Licenses* screen. Good CC0/royalty-free sources: **Kenney** (UI/interface
packs — ideal for the `ui_*` clicks), **Sonniss GDC bundle** and **Freesound
(CC0 filter)** for SFX, **Pixabay / OpenGameArt / Incompetech** for music.

---

## 1. Music — looping background tracks (HIGH priority)

| Key (filename stem) | Description |
| --- | --- |
| `music_menu` | Menu / hub loop. Calm, ambient, bioluminescent deep-sea; easy on repeat. |
| `music_run`  | In-run exploration/combat loop. Tense, atmospheric, low-key percussion. |
| `music_boss` | Boss-fight loop. Heavier, urgent, higher stakes than the run track. |

## 2. UI — menu / button feedback (HIGH priority — you asked for these)

| Key (filename stem) | Description |
| --- | --- |
| `ui_click`   | Primary button / menu tap — short, crisp click. |
| `ui_confirm` | Confirm / accept (TAKE a mutation, DESCEND) — positive two-note click. |
| `ui_back`    | Cancel / back / toggle-off — softer, lower click. |

## 3. Gameplay SFX — one-shots (MEDIUM priority)

| Key (filename stem) | Description |
| --- | --- |
| `sfx_attack`      | Player basic attack — wet, percussive strike. |
| `sfx_ability`     | Player ability cast — energetic whoosh/charge release. |
| `sfx_item`        | Consumable used — glass/fluid pop or device click. |
| `sfx_enemy_hit`   | An enemy takes damage — soft impact/squelch. |
| `sfx_enemy_death` | An enemy dies — dissolving/deflating burst. |
| `sfx_player_hurt` | The player takes damage — low, alarming thud. |
| `sfx_mutation`    | A mutation is taken at a Strand Event — organic, transformative shimmer. |
| `sfx_descend`     | Descending to the next floor — deep, sinking drone. |
| `sfx_victory`     | Run won — bright, resonant sting. |
| `sfx_defeat`      | Run lost / death — hollow, final tone. |

---

## Suggested delivery order

1. **`ui_click`** — instantly makes the menu feel responsive.
2. **`music_run` + `music_menu`** — sets the mood of the whole game.
3. **Core combat SFX** (`sfx_attack`, `sfx_ability`, `sfx_enemy_death`, `sfx_player_hurt`).
4. **The rest** — boss music, descend/victory/defeat stings, remaining SFX.

Drop them into `apps/game/public/audio/`, run `pnpm dev`, open the **RUN** tab —
each sound you add plays automatically.
