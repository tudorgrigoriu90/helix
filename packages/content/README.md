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

## Build order (per GDD Patch 12)

| Phase    | Required content |
| -------- | ---------------- |
| Prototype (Gate 1) | 25 Minor mutations (5/family) · Zone 1 enemies (5+boss) · 5 Floors · ~15 Common items · Floor 0 tutorial template · 4 Codex entries |
| Alpha (Gate 2)     | Zones 1–2 mutations (~40) · Zones 1–2 enemies+bosses · Floors 1–10 · Common+Uncommon items · 15 Sigma Strains · 20 Codex entries · 5 Origins |
| Soft launch (Gate 3) | All 66 mutations · All 4 zones · All item tiers · All 20 floors · 30 Sigma Strains · 10 Origins · 10 Hybrid Synergies · 5 Endings · 80 base Codex entries |

## Validation

`pnpm validate` (from repo root) runs all content schema validators. Cross-reference checks ensure (e.g.) that mutation IDs referenced in floor templates actually exist. **Implementation lands in T-282..T-288 (E-7 Content Pipeline).** Until then, this is a placeholder.
