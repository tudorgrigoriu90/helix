# Strand Descent — User Flow Diagrams — Orchestration

| Field             | Value                                       |
| ----------------- | ------------------------------------------- |
| Project codename  | HELIX                                       |
| Working title     | Strand Descent                                      |
| Studio            | Empathy Software                            |
| Director          | Tudor Grigoriu                              |
| Document owner    | Tudor Grigoriu / Empathy Software           |
| Version           | 1.0 (consolidated)                          |
| Status            | Pre-Production Lock — UX source of truth    |
| Last updated      | 2026-05-27                                  |

---

## 0. Purpose & Scope

This document is the binding UX specification for Strand Descent. It maps every screen the player can reach and every transition between them. It is the final required deliverable of Phase 1 Pre-Production per the studio framework.

**Conflict resolution rules:**

- When the TDD and the UFD conflict on screen behavior, **the UFD wins**.
- When the GDD and the UFD conflict on creative intent, **the GDD wins**.
- Conflicts that touch both require **Director decision**.

**Audience:**

- The Director — to validate the screen inventory before prototyping
- Claude Code — as reference when implementing each scene
- Future collaborators (writers, testers, designers)

**Companion documents:**

- [Strand Descent — Game Design Document.md](Strand%20Descent%20—%20Game%20Design%20Document.md) — creative source of truth
- [Strand Descent — Technical Design Document.md](Strand%20Descent%20—%20Technical%20Design%20Document.md) — engineering source of truth
- [Strand Descent — Concept One-Pager.md](Strand%20Descent%20—%20Concept%20One-Pager.md) — pitch source of truth
- `Strand Descent — Economy.xlsx` — numeric source of truth

---

## 1. Screen ID Convention

Every screen has a stable ID used across the codebase:

| Range       | Purpose                                  |
| ----------- | ---------------------------------------- |
| S001-S099   | First-launch and Hub                     |
| S100-S199   | Resume + early modals                    |
| S023        | Special: FloorScene (the gameplay scene) |
| S040-S059   | Combat                                   |
| S060-S079   | Strand Event                             |
| S080-S119   | Meta-progression (codex, settings, etc.) |
| S120-S139   | Monetization (store, IAP, ads)           |
| S140-S159   | Share flow                               |
| E001-E099   | Edge cases (specified behaviors)         |

When implementing a scene in Phaser, the file name includes the ID:

```
scenes/S023_FloorScene.ts
scenes/S062_StrandCardSelect.ts
```

This makes cross-reference from this doc to the codebase mechanical.

---

## 2. User Flow Diagram Index

Each diagram lives in its own file in this folder.

| # | Scope                      | File                                                                             | Screen Range                |
| - | -------------------------- | -------------------------------------------------------------------------------- | --------------------------- |
| 1 | First-Launch Flow          | [Strand Descent — User Flow — 01 First-Launch.md](Strand%20Descent%20—%20User%20Flow%20—%2001%20First-Launch.md)                       | S001-S016, S100             |
| 2 | Core Run Loop              | [Strand Descent — User Flow — 02 Core Run Loop.md](Strand%20Descent%20—%20User%20Flow%20—%2002%20Core%20Run%20Loop.md)                 | S017-S033                   |
| 3 | Combat Sub-Flow            | [Strand Descent — User Flow — 03 Combat Sub-Flow.md](Strand%20Descent%20—%20User%20Flow%20—%2003%20Combat%20Sub-Flow.md)               | S040-S052                   |
| 4 | Strand Event Sub-Flow      | [Strand Descent — User Flow — 04 Strand Event Sub-Flow.md](Strand%20Descent%20—%20User%20Flow%20—%2004%20Strand%20Event%20Sub-Flow.md) | S060-S071                   |
| 5 | Meta-Progression Screens   | [Strand Descent — User Flow — 05 Meta-Progression.md](Strand%20Descent%20—%20User%20Flow%20—%2005%20Meta-Progression.md)               | S080-S111                   |
| 6 | Monetization Flows         | [Strand Descent — User Flow — 06 Monetization.md](Strand%20Descent%20—%20User%20Flow%20—%2006%20Monetization.md)                       | S120-S135                   |
| 7 | Edge Cases                 | [Strand Descent — User Flow — 07 Edge Cases.md](Strand%20Descent%20—%20User%20Flow%20—%2007%20Edge%20Cases.md)                         | E001-E052                   |
| 8 | Share Flow                 | [Strand Descent — User Flow — 08 Share Flow.md](Strand%20Descent%20—%20User%20Flow%20—%2008%20Share%20Flow.md)                         | S140-S150 + ATTR + LANDING  |

---

## 3. Organism Name Generator (Locked Spec)

**Algorithm: deterministic table-based.**

1. `name_hash = hash(run_seed + final_build_signature)`
2. Index into 3 tables:
   - `prefix_table` (~20 entries)
   - `trait_table` (~20 entries × 5 families)
   - `suffix_table` (~10 entries)
3. Optional special-condition suffix:
   - `"of the Third Descent"` — Floor 15+
   - `"Untouched"` — zero damage on a floor
   - `"Bloodless"` — killed no enemies in a room

**Storage:** `packages/content/organism-names/*.json`

**Combinatorial space:** 20 × 20 × 10 = 4,000 base names per family, × 5 families = 20,000+ names, × special conditions = effectively unbounded but still deterministic per seed.

**Examples:**

- "The Mycelial Sovereign"
- "Voidborn Heretic"
- "Pressure Saint of the Third Descent"
- "Pale Crystal Warden, Untouched"
- "First Thermal Mourner, Bloodless"

---

## 4. Screens Not Yet Designed (Deferred)

Explicitly deferred to post-launch:

- Web demo specific screens (per TDD §21 Q5 — Floors 1-2 only)
- Leaderboard detail screens (minimal in v1, expanded in Season 1)
- Friend system (not in v1 per scope discipline)
- In-app event teasers (LiveOps content; Phase 5 work)
- Recovery phrase UX (deferred per TDD §11.1 to Season 2+)
- Season pass progression UI (no Season 1 at launch)

---

## 5. Analytics Event Coverage Check

New events introduced in this UFD that were **NOT** in GDD Patch 06 taxonomy:

- `resume_offered` / `resume_accepted` / `resume_declined`
- `intro_completed` (with `skipped: bool`)
- `cloud_check_started` / `cloud_restore_success`
- `offline_mode_entered`
- `consent_shown` / `consent_accepted` / `consent_declined`
- `push_prompt_shown` / `push_granted` / `push_declined`
- `tutorial_step_completed` (with room id)
- `run_preview_shown`
- `safe_room_entered`
- `vein_intermission_shown`
- `reroll_offered` / `reroll_confirmed` / `reroll_completed`
- `mutation_confirm_shown`
- `dominant_trait_unlocked`
- All meta-screen open events (`codex_opened`, `origins_opened`, etc.)
- All settings change events (`setting_changed: *`)
- Sync events (`cloud_sync_viewed`, `sync_conflict_resolved`)
- All IAP-flow events (`store_opened`, `pass_tab_viewed`, etc.)
- All ad-flow events (`ad_started`, `ad_completed`, `ad_failed`)
- All edge case events (E001-E052 logged via `system_warning` topics)
- All share-flow events (`share_screen_shown: *`, `frame_selected`, etc.)
- `landing_visited` / `device_detected` (web-side analytics)

**ACTION:** Update GDD v1.1 Addendum Patch 06 event taxonomy with the above **before** TDD §13 Analytics Implementation work begins.

---

## 6. UFD ↔ TDD ↔ GDD Cross-Reference

This UFD references:

**TDD sections:**

- TDD §5 Turn Engine (Scope 3 combat resolution flow)
- TDD §6 RNG (Scope 4 card selection determinism)
- TDD §7 Floor Generation (Scope 2 S022 transition timing)
- TDD §10 Platform Adapters (Scopes 6, 7, 8)
- TDD §11 Backend (Scope 5 cloud sync; Scope 7 edge cases)
- TDD §13 Analytics Implementation (entire UFD)
- TDD §17 Security & Privacy (Scope 5 S095 GDPR/CCPA)
- TDD §20 Risk Register (Scope 7 edge cases E021, E041, T6)
- TDD §21 Q1-Q6 Decisions Locked (engine, sync, web demo, etc.)

**GDD sections:**

- GDD §6 Combat System (Scope 3)
- GDD §5 Strand Events (Scope 4)
- GDD §15 Monetization (Scope 6)
- GDD §17 Accessibility (Scope 5 S092)
- GDD v1.1 Addendum Patch 06 Analytics (entire UFD)
- GDD v1.1 Addendum Patch 09 Accessibility additions

**Other:**

- Economy v1.0 spreadsheet (Scope 2 S026 heal %, S033 revive cost)

---

## 7. Next Steps

**Phase 1 Pre-Production is now COMPLETE.**

**Immediate next steps (per TDD §22 Week 1):**

- [ ] Update GDD v1.1 Addendum Patch 06 with new events from §5 above
- [ ] Repo bootstrap (pnpm workspaces, Phaser, Capacitor scaffolding)
- [ ] CI pipeline (lint + typecheck + tests)
- [ ] Firebase project created
- [ ] Apple Developer account opened
- [ ] iOS provisioning profile generated

**By end of Week 4 (per TDD §22):**

- [ ] Floor 1 vertical slice playable on web + iOS device
- [ ] Save/resume working
- [ ] First combat resolution end-to-end

**Phase 2 (Prototype) GATE 1 success criteria (per GDD v1.1 Patch 07):**

- [ ] 7+/10 testers complete 3+ runs voluntarily
- [ ] Average session length >5 minutes
- [ ] Verbatim feedback mentions LACE positively in 5+/10 cases

---

## Document Metadata

| Field                       | Value                                                |
| --------------------------- | ---------------------------------------------------- |
| Document                    | Strand Descent — User Flow Diagram v1.0                      |
| Version                     | 1.0                                                  |
| Author                      | Tudor Grigoriu / Empathy Software                    |
| Status                      | Pre-Production Lock — UX source of truth             |
| Total screens specified     | 89                                                   |
| Total edge cases specified  | 22                                                   |
| Total Mermaid diagrams      | 8                                                    |
| Companions                  | GDD, GDD Addendum, TDD, TDD Decisions, Economy, One-Pager |
| Date                        | May 2026                                             |
