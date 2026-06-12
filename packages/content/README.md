# @helix/content

Game content as JSON. See **TDD §8 (Mutation System)**, **§9 (LACE Narrative Engine)**, **§3 (Repository Structure)**, and **GDD Appendices A/B/C/D** for the schemas and authoring guidelines.

## Folders

| Folder              | Holds                                          | Schema source |
| ------------------- | ---------------------------------------------- | ------------- |
| `mutations/`        | One JSON file per mutation (66 at Path A launch) | TDD §8.1 |
| `enemies/`          | Enemy stat blocks (20 + bosses + Apex)         | GDD §8, App B |
| `items/`            | Item stat blocks (Common → Legendary)          | GDD §9, App C |
| `floors/`           | Floor templates per (floor_number, zone)       | TDD §7.1 |
| `organism-names/`   | prefix / trait / suffix tables + special suffixes | UFD §3 |
| `lace-lines/`       | LACE line fragments (tagged JSON)              | TDD §9.2 |
| `codex/`            | Codex lore entries, one bundle per zone/floor batch | GDD §2.7 |
| `origins/`          | One JSON file per Origin (10 at Path A launch) | GDD §4.1 |
| `sigma-strains/`    | One JSON file per Sigma Strain (30 at launch)  | GDD §11.2 |

## Build order (per GDD Patch 12)

| Phase    | Required content |
| -------- | ---------------- |
| Prototype (Gate 1) | 25 Minor mutations (5/family) · Zone 1 enemies (5+boss) · 5 Floors · ~15 Common items · Floor 0 tutorial template · 4 Codex entries |
| Alpha (Gate 2)     | Zones 1–2 mutations (~40) · Zones 1–2 enemies+bosses · Floors 1–10 · Common+Uncommon items · 15 Sigma Strains · 20 Codex entries · 5 Origins |
| Soft launch (Gate 3) | All 66 mutations · All 4 zones · All item tiers · All 20 floors · 30 Sigma Strains · 10 Origins · 10 Hybrid Synergies · 5 Endings · 80 base Codex entries |

## Validation

`pnpm validate` (from repo root) loads every content file through its schema loader and then runs the cross-reference validator over the whole bundle (a floor's `enemyPool`/`bossId` must resolve to real enemies; the boss must be boss-tier; ids must be unique). The gate lives in `@helix/game` (`src/core/content/content-bundle.test.ts`) because it reuses the runtime loaders. It also runs as part of `pnpm test`.

**Implemented:** enemy + item + mutation + LACE + organism-name + Codex + Origin + Sigma Strain schemas (T-283/T-284/T-282/T-286/T-287/T-294/T-301/T-306), cross-reference validator (T-288). The bundle gate also asserts the floor↔zone design (`floors.content.test.ts`) and the bestiary shape (`enemies.content.test.ts`): every floor's zone matches its GDD §7.1 band, every pooled/boss enemy belongs to that zone, and no boss is reused across floors.
