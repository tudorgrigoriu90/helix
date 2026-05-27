# Strand Descent — Technical Design Document

| Field            | Value                                              |
| ---------------- | -------------------------------------------------- |
| Project codename | HELIX                                              |
| Working title    | Strand Descent (locked 2026-05-27)               |
| Studio           | Empathy Software                                   |
| Director         | Tudor Grigoriu                                     |
| Document owner   | Tudor Grigoriu / Empathy Software                  |
| Version          | 1.0 (consolidated)                                 |
| Status           | Pre-Production Lock — engineering source of truth  |
| Last updated     | 2026-05-27                                         |

This is the consolidated TDD. It merges the original v1.0 base, the §21 Decisions Locked companion (Q1–Q6), and the Decision Records dated 2026-05-27. There is no "Open Questions" section — every prior open question is resolved inline.

When this document and the GDD conflict on technical matters, this document wins. When this document and the UFD conflict on screen behavior, the UFD wins.

---

## Table of Contents

0. [Purpose & Scope](#0--purpose--scope)
1. [Engineering Principles (Non-Negotiables)](#1--engineering-principles-non-negotiables)
2. [Technology Stack](#2--technology-stack)
3. [Repository Structure](#3--repository-structure)
4. [Core Architecture](#4--core-architecture)
5. [Turn Engine](#5--turn-engine)
6. [Random Number Generation](#6--random-number-generation-rng)
7. [Floor Generation](#7--floor-generation)
8. [Mutation System](#8--mutation-system)
9. [LACE Narrative Engine](#9--lace-narrative-engine)
10. [Platform Adapters](#10--platform-adapters)
11. [Backend Architecture (Firebase)](#11--backend-architecture-firebase)
12. [Caching Layer](#12--caching-layer)
13. [Analytics Implementation](#13--analytics-implementation)
14. [Build & Deploy Pipeline](#14--build--deploy-pipeline)
15. [Performance Budgets](#15--performance-budgets)
16. [Testing Strategy](#16--testing-strategy)
17. [Security & Privacy](#17--security--privacy)
18. [Working with Claude Code (Conventions)](#18--working-with-claude-code-conventions)
19. [Cost Projections](#19--cost-projections)
20. [Risk Register (Technical)](#20--risk-register-technical)
21. [Locked Technical Decisions](#21--locked-technical-decisions)
22. [Next Steps](#22--next-steps)

---

## 0 — Purpose & Scope

This document translates the GDD into architecture, data models, build pipelines, infrastructure, and conventions.

**Conflict resolution:** GDD vs TDD — TDD wins on technical matters; GDD wins on creative and gameplay matters. UFD wins on screen behavior. Conflicts that touch multiple domains require Director decision.

**Audience:**

- The Director (Tudor) — to validate technical direction
- Claude Code — as the primary engineering executor
- Future collaborators (writers, contractors, testers)

**Non-goals of this document:**

- Not a sprint plan. Sprints come after Gate 1.
- Not a UI spec. Wireframes live in the User Flow Diagrams.
- Not an economy tuning sheet. Numbers live in the Economy spreadsheet.

---

## 1 — Engineering Principles (Non-Negotiables)

These rules govern every technical decision. If a future choice violates one, the choice is wrong.

**P1. Offline-first.**
The game is 100% playable with no network connection. Backend is enrichment, never a dependency for core gameplay. No "loading..." spinners that block a run.

**P2. Determinism.**
Given a seed and an input sequence, the game produces identical output every time. Required for daily/weekly challenges, Sigma Echoes, replay debugging, and fair leaderboards.

**P3. Cost guardrails.**
No backend call without a cache layer. No unbounded query. No feature without a kill switch. Free tier first, paid services only with proven need and configured alerts.

**P4. Readability over cleverness.**
The Director must be able to read and reason about every file. Claude Code writes most of it; the Director debugs it. No metaprogramming, no excessive abstraction, no clever tricks. Plain TypeScript over fancy patterns.

**P5. One codebase, three platforms.**
iOS, Android, and Web ship from the same source. Platform-specific code is isolated behind small adapters.

**P6. No PII.**
The game collects no personal data at launch. Anonymous auth only. No email, no name, no analytics that can identify a person.

**P7. Everything is data, not code.**
Mutations, enemies, items, floor templates, LACE lines, and tuning numbers live in JSON files. Adding a mutation must not require touching code logic.

**P8. Save every turn.**
Crash mid-run, kill the app mid-turn, lose battery mid-floor — the player resumes exactly where they left off. Save-on-action, not save-on-quit.

**P9. Scope is the primary risk.**
Every architecture choice is evaluated for solo-dev tractability first, technical elegance second. We optimize for shippability.

---

## 2 — Technology Stack

### 2.1 Primary Stack (Locked — DR-001)

| Concern         | Choice                                         |
| --------------- | ---------------------------------------------- |
| Language        | **TypeScript 5.x (strict mode)**               |
| Game engine     | **Phaser 3.80+**                               |
| Native wrapper  | **Capacitor 6.x** (iOS + Android)              |
| Build tool      | Vite 5.x                                       |
| Package manager | pnpm 9.x                                       |
| Test runner     | Vitest 1.x                                     |
| Linter          | ESLint + @typescript-eslint                    |
| Formatter       | Prettier                                       |
| Source control  | Git + GitHub                                   |
| CI              | GitHub Actions (free tier: 2,000 min/month)    |

**Rationale:**

- **TypeScript:** Director already knows JS; Claude Code is strongest in TS. Type safety catches mutation-tag mismatches that would ship in dynamic languages.
- **Phaser 3:** Mature, well-documented, purpose-built for 2D games. Tilemap, animation, particle, scene management out of the box. Active community of mobile-game shippers.
- **Capacitor:** Ships web code to native iOS/Android with a small WebView. Apple/Google review approves these regularly. Allows web demo to share 100% of code with mobile builds.
- **Vite:** Fast dev server, fast builds, modern.
- **Vitest:** Same config as Vite, near-zero setup.

### 2.2 Backend Stack (Locked)

| Concern             | Service                                                |
| ------------------- | ------------------------------------------------------ |
| Auth                | Firebase Authentication (anonymous only)               |
| Database            | Firebase Firestore                                     |
| Functions           | Firebase Cloud Functions (Node 20)                     |
| Hosting             | Firebase Hosting (web build + landing page)            |
| Analytics           | Firebase Analytics                                     |
| Crash reporting    | Firebase Crashlytics                                   |
| Push notifications  | Firebase Cloud Messaging                               |
| Remote config       | Firebase Remote Config (kill switches)                 |
| Edge cache          | Cloudflare Workers + KV (added at Phase 1 scale)       |
| Cloud save          | iCloud Key-Value Store + Google Play Games Saved Games (native, zero infra cost — see §10.1) |

### 2.3 Third-Party SDKs (Limited List)

| SDK           | Purpose                                                                                            |
| ------------- | -------------------------------------------------------------------------------------------------- |
| AdMob         | Only ad SDK approved for Strand Descent. Rewarded video only. No banners, no interstitials.                |
| Capacitor IAP | Capacitor Community IAP plugin wrapping StoreKit + Play Billing.                                   |
| Branch.io     | Per-share attribution URLs (free tier ≤ 10K MAU). Replacement for deprecated Firebase Dynamic Links. |
| ASA Attribution | Apple Search Ads Attribution API (free). No third-party MMP (Adjust/AppsFlyer cost $1000+/mo).   |

### 2.4 Rejected Alternatives (Decision Records)

| Considered             | Disposition                                                                       |
| ---------------------- | --------------------------------------------------------------------------------- |
| Unity                  | Rejected. Heavy, learning curve, royalty risk.                                    |
| Godot 4                | Rejected. Director cannot debug GDScript fluently; violates P4.                   |
| React Native           | Rejected. Wrong tool for tilemap-based animated game.                             |
| Cocos Creator          | Rejected. Smaller community than Phaser.                                          |
| Native Swift / Kotlin  | Rejected. Doubles solo-dev workload (two codebases).                              |
| AWS / GCP raw          | Rejected. Firebase abstracts at zero cost penalty.                                |

---

## 3 — Repository Structure

```
helix/                                # Project codename = repo name
├── apps/
│   ├── game/                         # Phaser game (the main app)
│   │   ├── src/
│   │   │   ├── core/                 # Engine-agnostic logic
│   │   │   │   ├── turn-engine/      # Deterministic combat sim
│   │   │   │   ├── floor-gen/        # Procedural generation
│   │   │   │   ├── mutation/         # Mutation system
│   │   │   │   ├── lace/             # Narrative engine
│   │   │   │   ├── economy/          # XP, currency, drops
│   │   │   │   └── rng/              # Seeded random
│   │   │   ├── scenes/               # Phaser Scene classes
│   │   │   │   ├── BootScene.ts
│   │   │   │   ├── HubScene.ts
│   │   │   │   ├── FloorScene.ts
│   │   │   │   ├── StrandEventScene.ts
│   │   │   │   ├── ShareScene.ts
│   │   │   │   └── ...
│   │   │   ├── ui/                   # Reusable UI components
│   │   │   ├── platform/             # Platform adapters
│   │   │   │   ├── storage.ts        # SaveAPI abstraction
│   │   │   │   ├── cloud-storage.ts  # iCloud / Play Games abstraction
│   │   │   │   ├── ads.ts            # Ad abstraction
│   │   │   │   ├── iap.ts            # IAP abstraction
│   │   │   │   ├── analytics.ts      # Event firing abstraction
│   │   │   │   └── share.ts          # Share-sheet abstraction
│   │   │   ├── data/                 # Static game data (JSON)
│   │   │   ├── assets/               # Audio, fonts (no sprites)
│   │   │   └── main.ts               # Entry point
│   │   ├── public/
│   │   ├── index.html
│   │   ├── vite.config.ts            # Two entries: game + web demo
│   │   └── package.json
│   └── functions/                    # Firebase Cloud Functions
│       ├── src/
│       │   ├── dailySignal.ts
│       │   ├── weeklyChallenge.ts
│       │   ├── sigmaEcho.ts
│       │   └── index.ts
│       └── package.json
├── packages/
│   ├── shared-types/                 # Types shared client+server
│   ├── balance/                      # Tuning constants
│   │   └── palettes.json             # Per-family color palettes (§13.5 GDD)
│   └── content/                      # JSON content files
│       ├── mutations/
│       ├── enemies/
│       ├── items/
│       ├── floors/
│       ├── organism-names/           # Prefix/trait/suffix tables for naming
│       └── lace-lines/
├── ios/                              # Capacitor iOS project
├── android/                          # Capacitor Android project
├── tools/                            # Dev scripts
│   ├── validate-content.ts           # JSON schema validators
│   ├── generate-mutation-cards.ts
│   └── build-share-image.ts
├── .github/workflows/                # CI definitions
├── docs/                             # Architecture notes
│   ├── qa/                           # Manual playtest checklists
│   └── licenses/                     # Royalty-free audio/SFX licenses
├── pnpm-workspace.yaml
└── README.md
```

Monorepo with pnpm workspaces. Shared types between client and Cloud Functions prevent API drift. Content is its own package because writers and the Director touch it directly — we don't want them rebuilding the game to add a mutation.

---

## 4 — Core Architecture

### 4.1 Layer Diagram

```
┌───────────────────────────────────────────────────────────┐
│  PHASER SCENES (rendering, input)                         │
│  HubScene, FloorScene, StrandEventScene, ShareScene...    │
│  - Render game state. Capture input. Fire actions.        │
│  - Zero game logic lives here.                            │
├───────────────────────────────────────────────────────────┤
│  CORE SIMULATION (engine-agnostic TypeScript)             │
│  turn-engine, floor-gen, mutation, lace, economy, rng     │
│  - Pure functions where possible.                         │
│  - Deterministic, testable, no Phaser imports.            │
│  - This is what Vitest covers.                            │
├───────────────────────────────────────────────────────────┤
│  PLATFORM ADAPTERS                                        │
│  storage, cloud-storage, ads, iap, analytics, share       │
│  - Single interface per concern.                          │
│  - Web implementation + Capacitor implementation.         │
│  - Mockable for tests.                                    │
├───────────────────────────────────────────────────────────┤
│  PLATFORM RUNTIME                                         │
│  Web (browser) | Capacitor (iOS WebView) | Capacitor      │
│                  (Android WebView)                         │
└───────────────────────────────────────────────────────────┘
```

**The hard rule:** nothing in `core/` imports from Phaser, Capacitor, or any browser API. This makes core logic testable in Node and portable if we ever change the renderer. A lint rule enforces this.

### 4.2 State Management

State is divided into four buckets, each with different persistence:

**GameState** (in-memory, current session) — Active scene, current modal, transient UI state. Not persisted.

**RunState** (persisted every action) — Current floor, room, player position, player stats, mutations, inventory, AP, enemy positions and states, RNG state (next seed). Saved to local storage after every player action. On crash: resumable to the exact pre-action state. **Includes `schemaVersion` field for migration safety across releases.**

**MetaState** (persisted on change) — Total runs, deaths, unlocked Origins, Codex entries, Sigma Strains, lifetime currency, achievements, owned cosmetics. Saved to local storage on every change. Synced to **iCloud KV / Play Games Saved Games** opportunistically when online.

**Settings** (persisted on change) — Audio levels, accessibility toggles, language. Local storage only; optionally synced (per-device preferences may be desirable).

**Implementation:** a single `Store` with namespaced sub-stores. Zustand or a custom 100-line equivalent. No Redux, no MobX.

### 4.3 Event Flow

The game uses a strict action → reducer → render cycle for combat:

1. Player input → produces an Action object — e.g. `{ type: 'MOVE', from: [3,4], to: [4,4] }`
2. Action is dispatched to TurnEngine
3. TurnEngine validates, applies, returns new RunState + `Effects[]`. Effects describe what should be animated/sounded.
4. RunState is persisted (offline-first)
5. Scene reads new RunState and applies Effects to the renderer
6. After player action completes, TurnEngine resolves enemy turn
7. Cycle repeats until player input required again

Intentionally Redux-shaped without using Redux. Keeps mental model simple and Claude Code can extend it without surprises.

---

## 5 — Turn Engine

### 5.1 Responsibilities

Given a RunState and an Action, returns:

- `NewRunState` (state after action resolved)
- `Effects[]` (list of things to animate, in order)
- `Errors[]` (if action was invalid)

It must:

- Never read time, randomness, or platform APIs directly. All RNG comes from a seeded generator passed in.
- Be 100% pure: same input always produces same output.
- Run in <16ms on a 2018-era Android mid-tier phone (perf budget §15).

### 5.2 Action Schema (simplified — full schema in `shared-types`)

```ts
type Action =
  | { type: 'MOVE';            from: Tile; to: Tile }
  | { type: 'ATTACK';          target: EntityId; ability: AbilityId }
  | { type: 'USE_ITEM';        itemId: ItemId; target?: Tile }
  | { type: 'END_TURN' }
  | { type: 'CHOOSE_MUTATION'; mutationId: MutationId }
  | { type: 'INTERACT';        targetTile: Tile }
  // ...
```

### 5.3 Turn Resolution Pipeline

```
Player action received
  → Validate (legal move? enough AP?)
    → Apply movement/effects to RunState
      → Generate Effects[] for animation layer
        → If AP exhausted or END_TURN, transition to enemy phase
          → For each enemy (by initiative order):
              resolve telegraphed action
              update RunState
              append Effects[]
            → Tick statuses, decrement timers
              → Check win/loss/floor-complete conditions
                → Generate next enemy telegraphs
                  → Return control to player
```

### 5.4 Determinism Requirements

- Iteration order is always deterministic (use sorted IDs, not Map/Set iteration where order matters).
- RNG is always passed explicitly: `rng.next()` not `Math.random()`.
- Floating point avoided in core combat math; use integer fixed-point where possible (HP, damage, etc.).
- Time-based effects use turn counters, never wall-clock.

### 5.5 Save-Every-Turn Implementation

After every Action resolves:

- Serialize RunState to JSON (~5–20 KB)
- Write to platform storage (Capacitor Preferences / IndexedDB) — **atomic pattern: write to temp, rename on success**
- Write is asynchronous; UI does not block
- Failure to write is logged but does not block gameplay
- On app launch, if a RunState exists, present "Resume Run?" modal (UFD S100)
- **Keep last 3 save generations** for corruption recovery (E021)

### 5.6 RunState Schema Versioning

`RunState.schemaVersion: number` is part of every saved state. On load:

```
if (saved.schemaVersion === CURRENT_VERSION) → load directly
if (saved.schemaVersion < CURRENT_VERSION)   → run migrations in order
if (saved.schemaVersion > CURRENT_VERSION)   → show "update the app" message
```

Migration functions live in `core/turn-engine/migrations/` and are unit-tested against fixture saves from each prior shipped version.

### 5.7 Performance Budget

- Per-turn resolution: target <8ms, hard cap 16ms (one frame at 60fps)
- Memory: RunState <100 KB serialized
- Save write: <50ms async on storage backend

---

## 6 — Random Number Generation (RNG)

### 6.1 Strategy

**Mulberry32** seedable PRNG (32-bit, simple, fast, well-distributed). Implementation ~10 lines of TypeScript. No external dependency.

Each run has a single root seed. Sub-generators are derived for different concerns to prevent cross-contamination:

- `rng.combat` — damage rolls, crit checks
- `rng.loot` — drop tables
- `rng.floorgen` — floor layout
- `rng.mutationdraw` — Strand Event card selection
- `rng.events` — random encounters, ambient

Sub-generators are derived from the root seed + a string label hash, so adding a new sub-generator doesn't shift existing behavior.

### 6.2 Seed Sources

| Run type         | Seed                                                 |
| ---------------- | ---------------------------------------------------- |
| Normal run       | `crypto.randomUUID()` hashed to 32 bits              |
| Daily Sigma      | Hash of (current_date_UTC + global_salt). Same seed for all players worldwide that day. |
| Weekly Challenge | Hash of (ISO_week + global_salt)                     |
| Sigma Echo       | Replay seed from another player's run                |
| Replay / debug   | Manual seed input from dev menu                      |

### 6.3 Serialization

The RNG state (a single 32-bit integer per generator) is part of RunState and persists with every save. Resuming a run resumes the RNG exactly.

---

## 7 — Floor Generation

### 7.1 Strategy

Procedural but **template-driven**. Floors are NOT pure random — that produces boring layouts. Each floor uses a "floor template" that defines:

- Room count range (e.g., 6–10)
- Room type distribution (combat, merchant, event, safe, boss)
- Connectivity rules (linear, branching, loop, etc.)
- Enemy pool for the zone
- Aesthetic tags

Generation pipeline:

1. Load template for `(floor_number, zone)`
2. Choose room count from range using `rng.floorgen`
3. Place rooms on a graph using a constraint-based layout
4. Fill each room: pick type, place tiles, place enemies, place loot
5. Validate connectivity (BFS from start to boss)
6. If invalid: regenerate (max 5 attempts; fall back to fixed template)

### 7.2 Tile-Based Representation

Floors are 2D grids, max 32×32 tiles per room. Each tile has:

- `terrain`: walkable, wall, hazard, water, etc.
- `entity` (optional): enemy, item, door, interactive
- `effects[]`: ongoing tile effects (fire, spore cloud)

### 7.3 Performance

Generation runs once when floor is entered. **Target <100ms per floor** on mid-tier mobile. Heavy work happens during the floor-transition animation (~1s mask), so player perceives no wait.

Slow seeds (gen >1s) are logged via `system_warning` topic per UFD E051.

---

## 8 — Mutation System

### 8.1 Data Model

Every mutation is a JSON file under `packages/content/mutations/`:

```json
{
  "id": "abyssal_pressure_skin",
  "family": "abyssal",
  "tier": "minor",
  "sigCost": 10,
  "name": {
    "en": "Pressure Skin",
    "fr": "Peau de Pression"
  },
  "description": { "en": "...", "fr": "..." },
  "icon": "abyssal_skin",
  "modifiers": [
    { "type": "stat", "stat": "armor", "delta": 2 },
    { "type": "resistance", "damageType": "crush", "delta": 0.25 }
  ],
  "passives": ["passive_pressure_aura"],
  "tags": ["defense", "abyssal_core"]
}
```

### 8.2 Mutation Engine

The MutationEngine:

- Loads all mutation JSONs at startup, validates against schema
- On Strand Event: queries 3 candidates (1 dominant family, 1 adjacent, 1 wild) using deterministic `rng.mutationdraw`
- On selection: applies modifiers to player stats, registers passives in the turn engine, raises SIG by mutation cost
- On unlock of Dominant Trait (3+ same family): applies trait effect
- On VEIN Intermission trigger (4 mutations already): grants +100 VC instead, fires `vein_intermission_shown` analytics event

### 8.3 Adding a New Mutation

1. Create JSON file in `packages/content/mutations/`
2. If new passive logic needed: add handler in `core/mutation/passives/`
3. Run `pnpm validate:content` to check schema
4. Mutation is now live; no code recompile of game logic required

This is what "everything is data, not code" looks like in practice.

---

## 9 — LACE Narrative Engine

### 9.1 Responsibilities

LACE lines are selected dynamically based on context. The engine must:

- Pick a contextually-appropriate line
- Never repeat a line within a single run
- Adapt mood based on player behavior
- Be 100% offline (no AI inference at runtime)

### 9.2 Data Model

Each LACE line is tagged:

```json
{
  "id": "lace_floor5_mycelial_first",
  "text": { "en": "Mycelial. Interesting. Roots survive what teeth cannot." },
  "context": {
    "trigger": "strand_event_chosen",
    "floor": 5,
    "mutation_family": "mycelial",
    "first_pick_of_family": true
  },
  "mood": "curious",
  "weight": 1.0
}
```

### 9.3 Selection Algorithm

1. On event trigger, collect all lines whose context tags match
2. Filter out lines already spoken this run
3. Filter out lines incompatible with current LACE mood
4. Weight-sample remaining lines using `rng.events`
5. If no candidates: fall back to a generic line pool
6. Mark selected line as "spoken this run" (cleared on death)

### 9.4 Mood State Machine

LACE has 5 moods (per GDD §10.1): Curious, Clinical, Amused, Contemptuous, Reverent. Transitions are triggered by player behavior:

- Many risky choices → Amused
- Many defensive choices → Clinical
- Death loops → Contemptuous
- First reaching new floor → Curious
- Hybrid synergy unlocked → Reverent

Mood persists across runs but drifts toward neutral over time. Mood transitions are deterministic given player behavior history.

### 9.5 Templated Assembly (DR-004 default plan)

The line corpus is built in two layers:

**Layer 1 — Templated fragments.** Director-authored short fragments tagged by `[event_type, mutation_family, mood, player_state]`. Grammar templates assemble them at runtime. Quality penalty acknowledged. Ships v1.0 by default.

**Layer 2 — Writer-authored lines.** Hand-crafted lines from a game-dialogue writer (contracted Month 4–6). Replace templated outputs per category. Same JSON schema; the engine doesn't care which layer produced the line.

If the writer isn't contracted by Month 6, Layer 1 ships as v1.0. Layer 2 then becomes a Season 1 quality pass.

---

## 10 — Platform Adapters

### 10.1 Storage Adapters

Two interfaces: **local storage** (always available) and **cloud storage** (opportunistic).

```ts
interface StorageAdapter {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<void>;
  keys(prefix?: string): Promise<string[]>;
}

interface CloudStorageAdapter {
  isAvailable(): Promise<boolean>;
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  resolveConflict(local: string, remote: string): Promise<string>;
}
```

**Local implementations:**

- Web: IndexedDB via `idb-keyval`
- Capacitor: `@capacitor/preferences` (small data), Filesystem plugin (large data)

**Cloud implementations (DR / Q6):**

- **iOS:** Capacitor community plugin for iCloud Key-Value Store (`NSUbiquitousKeyValueStore`). Limit ~1 MB total per app — plenty for MetaState.
- **Android:** Google Play Games Services Saved Games. Limit 3 MB per save slot.
- **Web:** stub (no cloud sync on web; intentional).

**What syncs:** MetaState only (codex unlocks, lifetime stats, owned cosmetics). **RunState is local-only** (too volatile for sync, would conflict-resolve badly). Settings sync optional.

**Sync timing:**

- On app launch: read cloud, merge with local, write back.
- On MetaState change: debounced write (60s window).
- On app background: flush pending writes.

**Conflict-resolution policy:** Apple and Google's native APIs handle most conflicts. For the rare cases we must arbitrate, "highest value wins" per field:

- `lifetime_runs`: max(local, cloud)
- `codex_unlocked`: union(local, cloud)
- `achievements`: union(local, cloud)
- `owned_cosmetics`: union(local, cloud)
- `currency_balance`: max(local, cloud)

(Generous to the player; intentional.)

**Ongoing cost:** $0/month. No Firebase reads/writes for cloud save. Apple and Google host the data at no cost to us.

**Not building:** 12-word recovery phrase system, Firebase-based MetaState sync, account creation / email / passwords. All deferred indefinitely or only revisited if a future Steam port creates a cross-platform sync need.

### 10.2 Ads Adapter

```ts
interface AdsAdapter {
  isAvailable(): Promise<boolean>;
  showRewarded(placement: AdPlacement): Promise<AdResult>;
}
```

- Web: stub (returns "completed" with no actual ad — web demo has no ads)
- Capacitor: AdMob via Capacitor Community plugin

**Strict rules enforced in adapter:**

- Max 3 ads per run (hard cap)
- 60-second cooldown between ads
- Never blocks gameplay (10s timeout, falls back gracefully)
- No retry button on failure, no goodwill grant (E030/E031/E135)

### 10.3 IAP Adapter

```ts
interface IAPAdapter {
  listProducts(): Promise<Product[]>;
  purchase(productId: string): Promise<Receipt>;
  restorePurchases(): Promise<Receipt[]>;
}
```

- Web: stub (web demo has no IAP)
- Capacitor: Capacitor Community IAP plugin

**Receipt validation: done in Cloud Function, not client-side** (§17.5).

### 10.4 Analytics Adapter

```ts
interface AnalyticsAdapter {
  logEvent(name: string, params?: Record<string, any>): void;
  setUserProperty(key: string, value: string): void;
}
```

- Web: Firebase Analytics web SDK
- Capacitor: Firebase Analytics native SDK via plugin
- Dev mode: console logging only

### 10.5 Share Adapter

```ts
interface ShareAdapter {
  canShare(): boolean;
  share(content: ShareContent): Promise<ShareResult>;
}
```

- Web: Web Share API (with copy-link fallback)
- Capacitor: `@capacitor/share`

---

## 11 — Backend Architecture (Firebase)

### 11.1 Auth

**Anonymous Auth only at launch.** Every install gets an anonymous UID on first launch. UID is the only identifier. No email, no name.

Recovery-phrase cross-device sync is **explicitly deferred** (per §10.1; cloud save is handled by native iCloud / Play Games instead).

### 11.2 Firestore Collections

```
users/{uid}
  - createdAt
  - lastSeen
  - countryCode (IP-derived, region-rough)
  - clientVersion

users/{uid}/meta/state
  - Mirror of local MetaState (codex unlocks, achievements,
    lifetime stats). Synced opportunistically. NOTE: with native
    cloud save in §10.1, this mirror is for cross-Firebase analytics
    only — not the primary sync channel.

runs_anon/{runId}
  - Anonymized completed runs for Sigma Echo feature
  - Contains: build path, floors reached, organism name, death cause.
    No uid linkage stored.

daily_signals/{date}
  - Pre-generated by Cloud Function at 00:00 UTC
  - Contains seed, special modifier, leaderboard reference

weekly_challenges/{isoWeek}
  - Pre-generated by Cloud Function on Monday 00:00 UTC

leaderboards/{boardId}/entries/{entryId}
  - Anonymous run hashes for daily/weekly leaderboards
```

### 11.3 Cloud Functions

Triggered functions only — no HTTP endpoints (saves auth overhead):

| Function                  | Trigger                                            |
| ------------------------- | -------------------------------------------------- |
| `generateDailySignal`     | Scheduled, 00:00 UTC daily                         |
| `generateWeeklyChallenge` | Scheduled, Monday 00:00 UTC                        |
| `validatePurchase`        | Triggered by client write to `purchases/`          |
| `pruneOldRuns`            | Scheduled weekly, deletes `runs_anon > 30d`        |

All functions in TypeScript, Node 20 runtime, 256MB memory.

### 11.4 Read Budget — Critical Cost Control

Every Firestore read costs $0.06 per 100,000 (after free tier of 50K reads/day). Naive implementations burn this fast. The rules:

- **R1.** Every read goes through `cache.ts`, which TTL-checks before hitting Firestore.
- **R2.** Sigma Echo fetches capped at **3 per session**.
- **R3.** Codex content cached locally for 24h.
- **R4.** Daily Signal cached locally for 24h after first fetch.
- **R5.** Weekly Challenge cached locally for 7d after first fetch.
- **R6.** Leaderboard reads cached for 5 minutes.
- **R7.** No "subscribe" / real-time listeners except for active-run sync (which doesn't exist in v1).
- **R8.** Pagination is mandatory on any query that could return >20 docs.

### 11.5 Write Budget

Writes are cheaper but accumulate:

- MetaState sync: debounced 60s. Max 1 write per minute per user.
- Run completion upload: 1 write per completed run, max.
- No client-side write retries with exponential-backoff bugs.

### 11.6 Kill Switches

Every backend-dependent feature has a Remote Config flag, **defaulting to OFF in the shipped binary** so a Remote Config outage cannot make the game un-playable:

- `feature.sigma_echoes`
- `feature.daily_signal`
- `feature.weekly_challenge`
- `feature.cloud_sync`
- `feature.leaderboards`

Remote Config can flip any to ON in 60 seconds at launch, and back to OFF in 60 seconds if a feature is causing runaway costs.

### 11.7 Usage Alerts

Firebase budget alerts configured:

- $5/month: warning email
- $20/month: warning email + Director SMS
- $50/month: hard cap — Cloud Billing API auto-disables billing

These prevent the "$3000 surprise bill from a viral TikTok moment" that has killed indie devs.

---

## 12 — Caching Layer

A single `cache.ts` module mediates **all** backend reads.

```ts
async function fetchCached<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>
): Promise<T>
```

**Behavior:**

1. Check local cache for key
2. If found and fresh (within TTL): return immediately
3. If found and stale: return stale, refetch in background
4. If not found: fetch, cache, return
5. If fetch fails: return stale if available, else throw

Cache backed by IndexedDB (web) or Preferences (mobile).

Every Firestore call in the codebase **MUST** go through this layer. A lint rule enforces this.

---

## 13 — Analytics Implementation

Event taxonomy is defined in GDD §19. This section defines how it's wired.

### 13.1 Event Firing

```ts
import { analytics } from '@/platform/analytics';
analytics.logEvent('strand_event_shown', {
  floor_n: 5,
  cards_offered: ['abyssal_pressure_skin', 'mycelial_spore_cloud', 'thermal_ignition'],
  is_tutorial: false,
});
```

### 13.2 Event Validation

A TypeScript type guards all event names and shapes:

```ts
type EventSchema = {
  run_started: { origin: string; run_number: number; sigma_strains_active: string[] };
  floor_entered: { floor_n: number; zone: string; build_so_far: string[] };
  // ...
};

function logEvent<K extends keyof EventSchema>(
  name: K,
  params: EventSchema[K]
): void;
```

A typo in event name is a compile error, not a silent bug.

### 13.3 Batching & Throttling

Firebase Analytics natively batches. We add:

- Local event log persists last 200 events for debugging.
- High-frequency events (mouse moves, tile hovers) are NEVER fired.
- Combat events fire on resolution, not on intent.

### 13.4 Privacy

- No user-identifying parameter values
- No free-text fields from users
- Country derived to region buckets, not exact location
- GDPR/CCPA: Analytics OFF by default in EU / California regions until consent dialog accepted (UFD S009)

---

## 14 — Build & Deploy Pipeline

### 14.1 Local Dev

```
pnpm dev          → Vite dev server, localhost:5173, hot reload
pnpm test         → Vitest, watch mode
pnpm lint         → ESLint
pnpm typecheck    → tsc --noEmit
pnpm validate     → Run all content JSON validators
```

### 14.2 Production Build

```
pnpm build:web      → static files in /dist
pnpm build:demo     → static files in /dist-demo (DEMO_MODE bundle)
pnpm build:ios      → Capacitor sync + Xcode build
pnpm build:android  → Capacitor sync + Gradle build
```

The **web demo bundle is a separate Vite entry point** with `DEMO_MODE=true` baked in at build time, hosted at `strand.empathy.software/play`. The production mobile/web bundles have `DEMO_MODE=false` baked in. CI includes a smoke test that boots the production bundle and asserts `DEMO_MODE === false`.

### 14.3 CI (GitHub Actions)

**On every push to main:**

- Install (pnpm)
- Lint
- Typecheck
- Unit tests (Vitest)
- Determinism replay tests (100 fixed seeds, assert identical outcomes — see §20 T4)
- Build web (production + demo)
- Deploy web to Firebase Hosting (preview channel for PRs)

**On tag (vX.Y.Z):**

- All of the above
- Build iOS `.ipa` (requires Apple cert; runs on macOS runner)
- Build Android `.aab` (Ubuntu runner)
- Upload to App Store Connect TestFlight (via fastlane)
- Upload to Google Play Internal track (via fastlane)
- Deploy web to production Firebase Hosting

**Free tier budget:** 2,000 min/month. Estimated usage at 2 builds/day: ~800 min/month. Well within free.

### 14.4 Code Signing

- **iOS:** Apple Developer Program ($99/yr, unavoidable). Certs managed via fastlane match in a private GitHub repo.
- **Android:** Self-signed upload key. Google Play App Signing handles store signing.

### 14.5 Release Channels

- **Web:** `strand.empathy.software` (production), `preview.strand.empathy.software` (PRs), `strand.empathy.software/play` (demo)
- **iOS:** Internal TestFlight (every CI build), External TestFlight (every release candidate), App Store (every release tag)
- **Android:** Internal track (every CI build), Closed beta (release candidates), Production (release tags)

---

## 15 — Performance Budgets

Target device floor: **iPhone X (2017, A11 SoC) / iOS 15+ and Android 10+ on equivalent hardware** (DR-002).

| Budget          | Target / Limit                                    |
| --------------- | ------------------------------------------------- |
| Frame rate      | 60fps target, 30fps minimum acceptable            |
| Memory          | <300 MB RAM in use during gameplay                |
| Binary size     | <80 MB iOS install, <80 MB Android install        |
| Cold start      | <3s to interactive on target device               |
| Battery         | <8% per 30 min of active play                     |
| Network         | <500 KB per session (excluding ads)               |
| Storage         | <100 MB save data even after 1000 runs            |
| Cloud save size | <1 MB (iCloud KV cap; estimate at 5,000 lifetime runs needed) |

**Measurement plan:**

- Profiling with Chrome DevTools (web) and Safari Web Inspector (iOS)
- Real-device testing with the actual target floor devices
- Lighthouse audits on web build (CI fails on score <85)
- Crashlytics tracks ANRs and crashes

---

## 16 — Testing Strategy

### 16.1 Unit Tests (Vitest)

Coverage focus, not coverage percentage. Things that MUST have tests:

- `turn-engine` (every action type, every edge case)
- `rng` (determinism, distribution, seed isolation)
- `mutation engine` (every modifier type)
- `floor generation` (output validation, connectivity)
- `economy calculations` (drop rates, currency math)
- `LACE selection` (filters, weights, no-repeat rule)
- `save migrations` (every prior schema version → current)

Target: 80% line coverage of `/core/`. No requirement on `/scenes/`.

### 16.2 Integration Tests

A "run simulator" that can play a full run headlessly with scripted inputs. Used to:

- Validate that no run path crashes the engine
- Compute average run duration for tuning
- Stress-test mutation combinations
- Replay 100 fixed seeds in CI as a determinism gate (T4 mitigation)

### 16.3 Manual Playtest Checklists

Every release candidate runs through a fixed manual test plan:

- 10 happy-path runs across all 5 origins
- 5 deliberate-death runs (verify death analytics)
- 3 background/foreground tests (mid-turn app suspend)
- 1 airplane-mode session (verify offline)
- 1 30-minute play session (verify no memory leaks)

Checklists stored in `/docs/qa/`.

---

## 17 — Security & Privacy

### 17.1 Data Collected

- Anonymous UID (Firebase-generated)
- Country/region (IP-derived, bucket-level)
- Client version, device model, OS
- Anonymized run telemetry (build paths, deaths, floor times)
- Crash reports (Firebase Crashlytics)
- In-app purchase receipts (server-side, hashed)

### 17.2 Data Not Collected

- Email, name, age, phone
- Precise location
- Photos, contacts, microphone, calendar
- Anything requiring iOS / Android permission grants beyond what's below

### 17.3 Permissions Requested

- Internet (required, granted automatically)
- Push notifications (optional, prompted in-app on first Floor 5 Strand Event)
- iOS Photo Add (optional, prompted only when player chooses "Save to camera roll")

That's it.

### 17.4 Compliance

- **GDPR:** minimal-collection design, consent dialog in EU regions
- **CCPA:** data export endpoint available on request (UID hash only)
- **COPPA:** 12+ rating, no targeted ads to under-13 users (AdMob handles via per-request flag)
- **Apple Privacy Manifest:** declared
- **Google Play Data Safety:** declared

### 17.5 Receipt Validation

All IAP receipts validated server-side in Cloud Functions against Apple/Google receipt-validation endpoints. Never trust client-side receipt parsing.

### 17.6 Security Rules

Firestore Security Rules locked to:

- `users/{uid}` readable only by that uid
- `users/{uid}/meta/state` writable only by that uid
- `runs_anon` writable by any authenticated user, read by all
- `leaderboards` readable by all, writable only by Cloud Functions

---

## 18 — Working with Claude Code (Conventions)

The most important section for solo-dev productivity. Claude Code writes most of the code. These conventions make its output reliable, reviewable, and consistent.

### 18.1 File-Level Conventions

- One main concept per file. If a file exceeds 300 lines, split.
- Filename matches the primary exported type: `Mutation.ts` exports `Mutation` and `MutationEngine`.
- Index files only at package boundaries.
- No barrel exports inside a package — explicit imports.

### 18.2 Function Conventions

- Pure functions preferred. Mark impure with a comment: `// IMPURE`
- Functions take an options object after the second parameter
- Return type is always annotated explicitly
- No default exports; named exports only

### 18.3 Naming

- Types: `PascalCase`
- Functions/variables: `camelCase`
- Constants: `SCREAMING_SNAKE_CASE`
- Files: `kebab-case.ts` unless exporting a single `PascalCase` type
- Test files: `[name].test.ts` adjacent to source

### 18.4 Comments

- JSDoc on every exported function with non-obvious behavior
- Inline comments explain WHY, not WHAT
- TODOs include initials and ticket: `// TODO(TG): #42 — fix this`

### 18.5 Claude Code Workflow

Director's standard prompt pattern when asking Claude Code to build:

1. State the goal in one sentence
2. Link to the relevant section of TDD or GDD
3. State which files should be touched (or "you decide")
4. State which files MUST NOT be touched (e.g., `core/turn-engine` once stable)
5. Ask Claude Code to write tests alongside the change
6. Review the diff before committing

Anti-patterns to avoid:

- "Build the whole combat system" → too big
- "Fix the bug" without a repro → invites guessing
- Letting Claude Code touch the turn engine without explicit test coverage of the change

### 18.6 Review Checklist for Every Claude Code Commit

- [ ] Does it compile?
- [ ] Do existing tests still pass?
- [ ] Are new tests added if logic changed?
- [ ] Does the change respect layer boundaries (no Phaser in `core/`)?
- [ ] Are any new Firestore reads going through `cache.ts`?
- [ ] Are any new strings going to need translation?
- [ ] Did it add any new permissions, SDKs, or large dependencies?

---

## 19 — Cost Projections

### 19.1 Dev-Time Costs (18 months)

| Item                          | Cost                              |
| ----------------------------- | --------------------------------- |
| Apple Developer Program       | $99/yr × 2 = $198                 |
| Google Play Developer         | $25 one-time                      |
| Domain (`strand.empathy.software`) | $15/yr × 2 = $30             |
| GitHub                        | Free (or $4/mo Pro if desired)    |
| Firebase                      | Free (Spark tier sufficient pre-launch) |
| Figma                         | Free tier (3 files)               |
| Claude (this collaboration)   | Subscription, separate budget     |
| **HARD INFRA COST (18mo)**    | **~$253 + Claude subscription**   |

**Optional but recommended:**

- Branch.io free tier: $0 (under 10K MAU)
- TestFlight builds: included in Apple Developer
- Beta tester pool: free via TestFlight
- LACE writer contract: $5,000–10,000 (DR-004 quality upgrade)
- Royalty-free music subscription: ~$15–30/mo × 12 = $180–360
- Custom audio stings: $500–1,000 one-time

### 19.2 Live-Ops Costs by Scale

Year 1 projections at four DAU scenarios:

**Pessimistic — 500 DAU**

- Firebase reads/day: ~5,000 → $0/mo
- Firebase writes/day: ~250 → $0/mo
- Hosting bandwidth: ~5 GB/mo → $0/mo
- **TOTAL: $0/month, $0/year**

**Conservative — 5,000 DAU**

- Firebase reads/day: ~50,000 → $0/mo (edge of free)
- Firebase writes/day: ~2,500 → $0/mo
- Hosting bandwidth: ~50 GB/mo → $0/mo
- **TOTAL: $0/month, ~$50/year buffer**

**Target — 25,000 DAU**

- Firebase reads/day: ~250,000 → ~$5/mo
- Firebase writes/day: ~12,500 → ~$3/mo
- Hosting bandwidth: ~250 GB/mo → ~$15/mo
- Cloud Functions invocations: → ~$2/mo
- **TOTAL: ~$25/month, ~$300/year**

**Aspirational — 100,000 DAU**

- Without optimization: ~$300–600/mo
- With Cloudflare KV edge cache: ~$100–200/mo
- **TOTAL: ~$1,200–2,400/year**

At every scale, infra cost stays <0.5% of projected revenue. The cost discipline pays off most at 100K+ DAU — that's where naïve implementations bleed.

---

## 20 — Risk Register (Technical)

Beyond the business risks in GDD §21:

| ID | Risk                                                  | Severity | Likelihood | Mitigation                                                                                                                  |
| -- | ----------------------------------------------------- | -------- | ---------- | --------------------------------------------------------------------------------------------------------------------------- |
| T1 | Phaser performance ceiling on low-end Android         | MED      | LOW        | Performance budgets enforced in CI. Real-device testing from Month 3. Fallback: "Reduce Motion" mode (accessibility).         |
| T2 | Capacitor App Store review pushback (WebView app)     | MED      | LOW        | Submit early TestFlight build Month 6 to surface rejection reasons. Apple approves Capacitor games regularly.                |
| T3 | Firebase Dynamic Links deprecation (Aug 2025)         | MED      | CERTAIN    | Branch.io free tier as primary replacement. Decision by Month 2.                                                            |
| T4 | Determinism violations (rare but devastating)         | HIGH     | MED        | CI replays 100 fixed seeds and asserts identical outcomes. Any PR that breaks determinism is blocked.                       |
| T5 | Save corruption (mid-write crash)                     | HIGH     | LOW        | Atomic write pattern (write to temp, rename on success). Keep last 3 save generations. Auto-restore on corruption detection. |
| T6 | Runaway Firebase bill from a viral moment             | HIGH     | LOW        | Hard billing cap at $50/month. Kill switches on every backend feature. Alerts at 50/80/100% free tier.                       |
| T7 | AdMob policy violation or account suspension          | HIGH     | LOW        | Strict ad placement rules in code (3/run cap, cooldown, rewarded only). Document compliance for review.                    |
| T8 | iOS WebView behavior change in a future iOS release   | MED      | LOW        | Test on each iOS beta. Subscribe to Apple developer release notes.                                                         |
| T9 | Claude Code introduces subtle regressions over time   | MED      | MED        | Tight test coverage on `core/`. Mandatory review of every diff. Lint rules enforcing layer boundaries.                       |

---

## 21 — Locked Technical Decisions

All prior open questions are resolved. Recorded here for traceability.

### Q1 — Localization at Launch

**Decision:** English-only.

- Solo-dev scope discipline. LACE writing (1,500–2,000 EN lines) is the bottleneck.
- Reddit/LitRPG core audience is English-native.
- i18n architecture stays in place (mutation/item JSONs have `name`/`description` as objects keyed by locale). Only `en` populated at launch.
- Settings menu hides the language selector.
- **Reopen criteria:** add EU-5 (FR, DE, ES, IT, PT) in Season 1 if D7 retention >18% in those markets without localization.

### Q2 — Asset Pipeline for Geometric Art

**Decision:** Runtime-generated geometry via Phaser Graphics API.

- All enemies, players, projectiles rendered via Phaser Graphics primitives (circles, polygons, lines).
- Each entity has a "shape descriptor" in its data JSON.
- SVG used ONLY for static UI icons (mutation cards, menu icons, codex entries). Stored as inline SVG strings in JSON.
- Color palettes per genetic family centralized in `packages/balance/palettes.json`.
- Mutation effects compose visually: a player who picks Mycelial mutations gains green ornaments overlaid on their base geometry.
- Graphics objects pooled, not recreated per frame. Particle effects via Phaser's particle system.

### Q3 — Sound Design

**Decision:** Royalty-free music library + small custom-stinger budget.

- Royalty-free library subscription ~$15–30/month during development (~$300 over 18 months).
- 3–5 custom signature stings ($500–$1,000 from a contractor): Strand Event reveal, boss fight, final-floor descent.
- SFX: free libraries (Freesound, Sonniss bundles).
- License files maintained in `/docs/licenses/` for every track and SFX used.

### Q4 — Tutorial Implementation

**Decision:** Scripted Floor 0 (3–4 rooms), no modal popups.

- Floor 0 is a hardcoded floor template (deterministic, not procedural).
- Each room introduces one mechanic in a safe context — see GDD §18.6 for room contents.
- Returning players skip from the Hub. Achievement "First Convergence" granted on Floor 0 boss kill.
- Skip flag stored in MetaState.

### Q5 — Web Demo Scope

**Decision:** Floors 1–2, ending at the first Strand Event.

- Floors 1–2 only. After the first Strand Event, demo ends with a "Get the app to descend further" screen.
- No IAP, no ads, no save: each demo session starts fresh.
- Web Share API: demo's end screen has a "What I Became (Demo)" share with deep-link to the mobile app.
- Demo deep-links from social shares: friend's share opens the demo in browser → demo plays → conversion prompt.
- Demo build is a **separate Vite entry point** sharing 100% of `core/` code. Feature flag `DEMO_MODE` gates floors > 2, IAP, ads, save.
- Hosted at `strand.empathy.software/play`.
- Cross-platform attribution: demo end screen captures install-intent click and passes UTM parameters to App Store / Play Store via Branch.io free tier.

### Q6 — Save System

**Decision:** Native platform sync — iCloud + Google Play Games.

- Solves "lost progress on new phone" for ~85% of players (the ones logged into iCloud / Play Games) at zero ongoing infra cost.
- Apple and Google handle conflict resolution, identity, and storage. We just write to their APIs.
- Avoids the recovery-phrase complexity, the Firebase write cost, and the 3–4 weeks of dev time that full Firebase sync would require.
- Players not logged into iCloud / Play Games still get reliable local save; they accept loss-on-new-phone as the explicit tradeoff (~15% of users).
- Implementation, sync timing, conflict policy, and what syncs all detailed in §10.1.
- Dev-time budget: 1–2 weeks at Month 6–7. Not required for Gate 1 prototype. Required for Gate 3 soft launch.
- Ongoing cost: $0/month.

### Decision Records 1–6 (2026-05-27 — consolidated)

| DR     | Topic                          | Decision                                                                       |
| ------ | ------------------------------ | ------------------------------------------------------------------------------ |
| DR-001 | Engine                         | Phaser 3 + Capacitor + TypeScript                                              |
| DR-002 | Device floor                   | iOS 15+ / iPhone X+ / Android 10+                                              |
| DR-003 | Launch scope                   | Path A — 18 months, full v1.0 scope                                            |
| DR-004 | LACE writing plan              | Templated default; writer hire as quality upgrade                              |
| DR-005 | 500-DAU pre-commit             | Continue per plan; ship Season 1; reduced cadence                              |
| DR-006a | Pass Origin skins             | Apply only to Origins unlocked through play; "preview" state for locked        |
| DR-006b | Pass codex completion         | Separate "Pass Archive" section; base codex 100% achievable without Pass       |

---

## 22 — Next Steps

After TDD acceptance:

**Week 1**

- [ ] Repo bootstrap (pnpm workspaces, Phaser, Capacitor scaffolding)
- [ ] CI pipeline minimal (lint + typecheck + tests + determinism replay)
- [ ] Firebase project created
- [ ] Apple Developer account opened
- [ ] iOS provisioning profile generated

**Week 2**

- [ ] Turn engine skeleton with one Action type
- [ ] First Vitest tests passing
- [ ] Storage adapter implemented for web + Capacitor
- [ ] First "hello world" Phaser scene renders on web and device

**Week 3**

- [ ] Floor generation v0 (single template, fixed seed)
- [ ] Basic tile rendering
- [ ] Player entity with move action

**Week 4**

- [ ] First enemy with telegraphed action
- [ ] Combat resolution end-to-end
- [ ] Save/resume working (atomic write + schemaVersion + 3-generation backup)

**Month 2–5: Prototype Floor 1 vertical slice toward Gate 1.**

---

## Document Footer

| Field      | Value                                                              |
| ---------- | ------------------------------------------------------------------ |
| Document   | Strand Descent — Technical Design Document                                 |
| Version    | 1.0 (consolidated)                                                 |
| Owner      | Tudor Grigoriu / Empathy Software                                  |
| Created    | May 2026                                                           |
| Status     | Pre-Production Lock — engineering source of truth                  |
| Companions | Concept One-Pager, GDD, User Flow Diagrams, Economy spreadsheet    |
| Next       | Economy spreadsheet review; task breakdown / sprint plan           |

**Revision history:**

- **v1.0 (consolidated) — 2026-05-27** — Merged TDD v1.0 base content, §21 Decisions Locked (Q1–Q6), and Decision Records DR-001 through DR-006. The "Open Questions" section is removed (all resolved inline in §21). Supersedes all prior versions and the standalone §21 Decisions Locked document.
