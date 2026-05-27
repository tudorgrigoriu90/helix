# Strand Descent

> Codename: **HELIX** · Studio: **Empathy Software** · Working title locked 2026-05-27

A turn-based genetic roguelite for mobile (iOS + Android) with a Floors 1–2 web demo. Players descend through a 20-floor alien megastructure called the VEIN. Every 5 floors, a **Strand Event** rewrites who they are. By the final floor, they will be something that has never existed before.

> *"You didn't choose to descend. The signal chose you. Now every floor rewrites what you are — and you cannot stop it."*

---

## Documentation

The canonical design and engineering set lives in [`docs/`](docs/):

| Document | Purpose |
| --- | --- |
| [Concept One-Pager](docs/Strand%20Descent%20—%20Concept%20One-Pager.md) | Pitch source of truth |
| [Game Design Document](docs/Strand%20Descent%20—%20Game%20Design%20Document.md) | Creative source of truth |
| [Technical Design Document](docs/Strand%20Descent%20—%20Technical%20Design%20Document.md) | Engineering source of truth |
| [User Flow — 00 Orchestration](docs/Strand%20Descent%20—%20User%20Flow%20—%2000%20Orchestration.md) | UX index + screen ID conventions + analytics events |
| User Flow — 01..08 | Per-scope mermaid diagrams + screen inventories |
| `Strand Descent — Economy.xlsx` | Numeric source of truth (XP, drops, prices, LTV model) |

Project-level artifacts at the repo root:

- [`Strand Descent — Task Plan.md`](Strand%20Descent%20—%20Task%20Plan.md) — 13 epics, ~440 tasks across the 18-month schedule (Path A scope)
- [`Strand Descent — Trademark Clearance Report.md`](Strand%20Descent%20—%20Trademark%20Clearance%20Report.md) — reconnaissance + final naming decision (audit trail)

## Stack

| Layer       | Choice                                       |
| ----------- | -------------------------------------------- |
| Language    | TypeScript 5.x (strict)                      |
| Game engine | Phaser 3.80+                                 |
| Native wrap | Capacitor 6.x (iOS + Android)                |
| Build       | Vite 5.x                                     |
| Pkg manager | pnpm 9.x                                     |
| Tests       | Vitest 1.x                                   |
| Backend     | Firebase (Auth anon, Firestore, Functions, Hosting, Analytics, Crashlytics, FCM, Remote Config) |
| Cloud save  | iCloud KV (iOS) + Google Play Games Saved Games (Android) — zero infra cost |

See [TDD §2](docs/Strand%20Descent%20—%20Technical%20Design%20Document.md) for the full rationale + rejected alternatives.

## Engineering Principles (Non-Negotiables)

1. **Offline-first** — game is 100% playable without network. Backend is enrichment.
2. **Determinism** — same seed + same inputs = identical output. CI gate.
3. **Cost guardrails** — every backend read goes through `cache.ts`. Hard $50/mo Firebase cap.
4. **Readability over cleverness** — plain TypeScript. The Director debugs everything.
5. **One codebase, three platforms** — iOS, Android, Web from the same source.
6. **No PII** — anonymous UID only. No email, no name.
7. **Everything is data, not code** — mutations, enemies, items, LACE lines in JSON.
8. **Save every turn** — atomic write, 3-generation rotation, exact mid-turn resume.
9. **Scope is the primary risk** — every architecture choice optimizes for solo+AI tractability and shippability.

## Repository Layout

```
helix/
├── apps/
│   ├── game/             # Phaser game (main app)
│   └── functions/        # Firebase Cloud Functions (Node 20)
├── packages/
│   ├── shared-types/     # Types shared client + server
│   ├── balance/          # Tuning constants (palettes.json, curves)
│   └── content/          # JSON content (mutations, enemies, items, floors, lace-lines, organism-names)
├── docs/                 # Design + engineering docs (this folder)
├── tools/                # Dev scripts (content validators, mutation card gen, share-image builder)
├── ios/                  # Capacitor iOS project (generated)
└── android/              # Capacitor Android project (generated)
```

## Status

**Pre-Production Lock — Phase 2 (Prototype) ready to begin.**

Phase 1 deliverables complete: GDD + TDD + One-Pager + UFD (orchestration + 8 sub-flows) + Economy + Task Plan + Trademark Clearance Report.

Next milestone: **Gate 1 — Floor 1 vertical slice** (Month 5). Success criteria: 7+/10 testers complete 3+ runs voluntarily; avg session length >5 min; LACE mentioned positively in 5+/10 verbatims.

## License

See [LICENSE](LICENSE).
