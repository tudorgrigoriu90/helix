# Strand Descent — Task Plan

| Field            | Value                                                |
| ---------------- | ---------------------------------------------------- |
| Project codename | HELIX                                                |
| Working title    | Strand Descent (locked 2026-05-27)                           |
| Owner            | Tudor Grigoriu / Empathy Software                    |
| Version          | 1.0                                                  |
| Status           | Pre-Production Lock — task source of truth           |
| Created          | 2026-05-27                                           |
| Target tracker   | Atlassian Jira (workspace TBD) — see Open Assumptions |

This is the canonical task list for delivering Strand Descent to soft launch and global launch per the 18-month Path A schedule (GDD §21). It uses the Jira hierarchy **Epic → Story → Task → Sub-task** so it can be imported into Jira (or Azure DevOps with `Story → Feature → Story → Task` re-mapping) when the tracker is provisioned.

When `ai-factory/sa/core/issues-list.md` is the canonical location per the `sa-toolkit:task-plan` skill, this project doesn't use that folder structure (it's a personal indie game, not a Mindit corporate SA engagement). The task list lives at the repo root.

---

## How to Read This Document

- **Epics (E-N):** long-lived themes that span months. ~13 total.
- **Stories (S-N.M):** functional chunks within an epic. ~75 total.
- **Tasks (T-N):** units of implementation work, sized at 1–5 days of solo+AI work. ~250 total.
- **Sub-tasks (U-N):** added only where a task genuinely benefits from sub-decomposition; not every task has them.

References columns:
- **GDD / TDD / UFD** = section number or screen ID from the consolidated docs
- **NFR** = non-functional requirement, traced to TDD §1 Engineering Principles (P1–P9), §15 Performance Budgets, §17 Security & Privacy

---

## Priority Legend (mapped to schedule gates)

| Priority | Meaning                                       | Schedule anchor                     |
| -------- | --------------------------------------------- | ----------------------------------- |
| **P0**   | Required for **Gate 1** prototype             | Month 5 — Floor 1 vertical slice    |
| **P1**   | Required for **Gate 2** closed alpha          | Month 11 — Floors 1–10              |
| **P2**   | Required for **Gate 3** soft launch (PH + CA) | Month 15                            |
| **P3**   | Required for **global launch**                | Month 16–18                         |
| **P4**   | Post-launch / Season 1+                       | Month 18+                           |

---

## Role Legend

For a solo+AI team most roles collapse onto the Director plus Claude Code. Roles are kept on tasks so the plan transfers cleanly to a multi-person team if hired:

| Role               | Realised by (this project)                         |
| ------------------ | -------------------------------------------------- |
| Director           | Tudor Grigoriu (design, content, business decisions) |
| Architect          | Tudor Grigoriu                                     |
| Backend Developer  | Claude Code (TS Cloud Functions, Firestore)        |
| Frontend Developer | Claude Code (Phaser scenes, UI)                    |
| Game Engineer      | Claude Code (turn engine, RNG, sim)                |
| DevOps Engineer    | Claude Code (CI, build, deploy)                    |
| QA Engineer        | Tudor (manual playtest) + Claude Code (automated tests) |
| Writer             | External contractor (Month 4–6 hire, DR-004) — fallback to Director templated assembly |
| BA / Product       | Tudor Grigoriu                                     |

---

## Epic Index

| Epic   | Title                              | Span                   | Notes                                                       |
| ------ | ---------------------------------- | ---------------------- | ----------------------------------------------------------- |
| E-1    | Pre-Production Closeout            | Weeks 1–4              | Trademark, age-rating dry-run, Economy review, legal templates |
| E-2    | Project Foundation & DevOps        | Weeks 1–4              | Repo, CI, Firebase, developer accounts, Phaser scaffold     |
| E-3    | Core Simulation Engine             | Months 2–6             | Pure-TS deterministic foundation (P1, P2 NFRs)              |
| E-4    | Phaser Scene Layer                 | Months 2–14            | All UFD screens                                             |
| E-5    | Platform Adapters                  | Months 2–7             | Storage, cloud-sync, ads, IAP, analytics, share             |
| E-6    | Backend (Firebase)                 | Months 4–8             | Auth, Firestore, Cloud Functions, kill switches             |
| E-7    | Content Pipeline                   | Months 2–16            | JSON schemas, validators, mutation/enemy/item/floor data    |
| E-8    | LACE Narrative System              | Months 3–16            | Engine + templated fragments + writer onboarding            |
| E-9    | Monetization                       | Months 8–14            | Store screens, AdMob, IAP catalogue, Pass content           |
| E-10   | Share Loop                         | Months 6–14            | Organism portrait gen, share screens, attribution, landing  |
| E-11   | Web Demo                           | Months 12–15           | DEMO_MODE bundle                                            |
| E-12   | QA & Performance                   | Months 3–18            | Test infra, perf budgets, manual checklists                 |
| E-13   | Launch Operations                  | Months 12–18           | Apple Indie / Google Indie submission, UA, press, listings  |

---

## E-1 — Pre-Production Closeout

**Scope:** Final pre-production items still open as of 2026-05-27. All P0 (gate Phase 2 start).

### S-1.1 — Trademark clearance

| ID    | Title                                              | Role     | Priority | Refs        | Notes |
| ----- | -------------------------------------------------- | -------- | -------- | ----------- | ----- |
| T-1   | ~~USPTO TESS search~~ — **DONE 2026-05-27.** Reconnaissance pass for STRAND + 5 backup names. See Trademark Clearance Report §2. | Director | P0 | One-Pager §1 | DONE |
| T-2   | ~~EUIPO TMview search~~ — **DONE 2026-05-27.** Same name set. | Director | P0 | One-Pager §1 | DONE |
| T-3   | ~~UK IPO search~~ — **DONE 2026-05-27.** Same name set. | Director | P0 | One-Pager §1 | DONE |
| T-4   | ~~iOS App Store + Google Play store-listing search~~ — **DONE 2026-05-27.** | Director | P0 | One-Pager §1 | DONE |
| T-5   | ~~Steam + itch.io search~~ — **DONE 2026-05-27.** | Director | P0 | One-Pager §1 | DONE |
| T-6   | ~~Decide: in-house clearance OR engage attorney~~ — **SKIPPED 2026-05-27.** Director opted to skip attorney consult; risk owned. See Trademark Clearance Report §7. | Director | P0 | — | SKIPPED |
| T-7   | ~~Lock final working title~~ — **DONE 2026-05-27.** Title locked: **"Strand Descent"**. | Director | P0 | — | DONE |

**Story dependencies:** S-1.1 complete. S-2.4 (developer accounts) unblocked — T-41/T-42/T-45 can proceed pending bundle-ID and domain availability checks.

### S-1.2 — App Store age-rating dry-run

| ID    | Title                                                          | Role     | Priority | Refs            | Notes |
| ----- | -------------------------------------------------------------- | -------- | -------- | --------------- | ----- |
| T-8   | Apple Age Rating questionnaire dry-run with current mutation visuals | Director | P0   | GDD §1.5, R5    | If returns 17+, GDD §1.5 and §1.6 audience needs revisiting |
| T-9   | Google Play Data Safety + Content Rating dry-run               | Director | P0       | GDD §1.5        | Mirror Apple result; flag inconsistencies |
| T-10  | If rating >12+: scope review of body-horror visual elements    | Director | P0       | GDD §13         | Conditional task — only if T-8 or T-9 fail |

### S-1.3 — Economy v1.0 review

| ID    | Title                                                | Role     | Priority | Refs                          | Notes |
| ----- | ---------------------------------------------------- | -------- | -------- | ----------------------------- | ----- |
| T-11  | Director read-through of `Strand Descent — Economy.xlsx` tabs | Director | P0      | GDD Appendix E                | All 6 tabs |
| T-12  | Sanity-check VC drop rates vs GDD §9.4 expectations   | Director | P0      | GDD §9.4                      | Drop chance × enemy count × floor count should give expected per-run VC |
| T-13  | Sanity-check Pass conversion sensitivity model        | Director | P0      | GDD §15.6, One-Pager §10      | Pessimistic 1.5% conversion is the planning floor |
| T-14  | Lock Economy v1.0; mark as pre-prod-binding           | Director | P0      | —                             | Numbers can still tune in playtest, but baseline is fixed |

### S-1.4 — Legal templates

| ID    | Title                                                   | Role     | Priority | Refs              | Notes |
| ----- | ------------------------------------------------------- | -------- | -------- | ----------------- | ----- |
| T-15  | ~~Select Privacy Policy template~~ — **DONE 2026-05-28.** Draft at `docs/Strand Descent — Privacy Policy.md`. Covers TDD §17.1/17.2 disclosures, GDPR/CCPA consent, data retention, deletion rights, third-party services. Needs attorney review + placeholder fields filled before submission. | Director | P0 | TDD §17.4 | DONE |
| T-16  | ~~Select Terms of Service template~~ — **DONE 2026-05-28.** Draft at `docs/Strand Descent — Terms of Service.md`. Covers licence grant, virtual currency, IAP, subscriptions, user conduct, limitation of liability. Needs attorney review before submission. | Director | P0 | TDD §17.4 | DONE |
| T-17  | ~~Confirm Apple Privacy Manifest fields~~ — **DONE 2026-05-28.** `apps/game/ios/App/App/PrivacyInfo.xcprivacy` created. Declares: NSPrivacyTracking=false, 5 collected data types (Device ID, Crash, Performance, Usage, Purchase History), 2 Required Reason APIs (NSUserDefaults CA92.1, FileTimestamp C617.1). Needs adding to Xcode target before submission. | Director | P0 | TDD §17.4 | DONE |
| T-18  | ~~Confirm Google Play Data Safety form fields~~ — **DONE 2026-05-28.** Answers documented in `docs/Strand Descent — Legal Compliance Notes.md` §T-18. Covers all 4 form sections with per-data-type declarations. Fill in Play Console before first review submission. | Director | P0 | TDD §17.4 | DONE |
| T-19  | ~~Confirm COPPA flag handling in AdMob requests~~ — **DONE 2026-05-28.** Policy and implementation pattern documented in `docs/Strand Descent — Legal Compliance Notes.md` §T-19. tagForChildDirectedTreatment=false, tagForUnderAgeOfConsent=false, set globally in AdMob.initialize() in T-237. | Director | P0 | TDD §17.4 | DONE |

---

## E-2 — Project Foundation & DevOps

**Scope:** Greenfield repo, CI, Firebase provisioning, developer accounts, first hello-world Phaser scene. All P0.

### S-2.1 — Repo & monorepo bootstrap

| ID    | Title                                                                 | Role             | Priority | Refs           | Notes |
| ----- | --------------------------------------------------------------------- | ---------------- | -------- | -------------- | ----- |
| T-20  | ~~Initialize Git repo~~ — **DONE.** `.git` present; default branch `main`. | DevOps | P0 | TDD §3 | DONE |
| T-21  | ~~Configure `pnpm-workspace.yaml`~~ — **DONE 2026-05-27.** Workspace glob `apps/*` + `packages/*`. | DevOps | P0 | TDD §3 | DONE |
| T-22  | ~~Create directory tree per TDD §3~~ — **DONE 2026-05-27.** Full tree (`apps/game/src/{core/*,scenes,ui,platform,data,assets}`, `apps/functions/src`, `packages/{shared-types/src,balance,content/{mutations,enemies,items,floors,organism-names,lace-lines}}`, `tools/`, `docs/{qa,licenses}`, `.github/workflows`) with `.gitkeep` markers. | DevOps | P0 | TDD §3 | DONE |
| T-23  | ~~Root `.editorconfig`, `.prettierrc`, `.eslintrc.json`~~ — **DONE 2026-05-27.** Plus `.prettierignore` and `.gitignore`. ESLint extends `@typescript-eslint/recommended` + `prettier`. | DevOps | P0 | TDD §2.1 | DONE |
| T-24  | ~~Root `tsconfig.base.json`~~ — **DONE 2026-05-27.** Strict mode (all flags), ES2022 target, `Bundler` module resolution, path aliases (`@core/*`, `@scenes/*`, etc.). Per-package `tsconfig.json` extends base in `apps/game`, `apps/functions`, `packages/shared-types`. | DevOps | P0 | TDD §2.1 | DONE |
| T-25  | ~~Custom lint rule: forbid Phaser/Capacitor imports in `core/`~~ — **DONE 2026-05-28.** `no-restricted-imports` override in `.eslintrc.json` for `apps/game/src/core/**/*.ts`. Blocks `phaser`, `phaser/*`, and `@capacitor/*` with descriptive error messages referencing TDD §4.1. Verified: lint error fires on any Phaser import in core/. | DevOps           | P0       | TDD §4.1       | DONE |
| T-26  | Custom lint rule: every Firestore read goes via `cache.ts`            | DevOps           | P0       | TDD §12        | NFR P3 — needs `pnpm install` + `cache.ts` to exist first |
| T-27  | ~~Add `README.md` pointing to `docs/` consolidated set~~ — **DONE 2026-05-27.** Repo-root README links to all 13 docs + Task Plan + Trademark Report + describes stack/principles/layout. | DevOps | P0 | — | DONE |

### S-2.2 — CI pipeline

| ID    | Title                                                          | Role     | Priority | Refs           | Notes |
| ----- | -------------------------------------------------------------- | -------- | -------- | -------------- | ----- |
| T-28  | ~~GitHub Actions workflow: lint + typecheck + Vitest on push to main~~ — **DONE 2026-05-28.** `.github/workflows/ci.yml` created. Triggers on push to main + PRs. Steps: pnpm install (frozen-lockfile) → lint → typecheck → test → validate → build:web → build:demo. Fixed blockers: `apps/functions/src/index.ts` placeholder (tsc no-inputs), `@types/node` added to functions, `vitest.config.ts` added to both game + functions (`passWithNoTests: true`). Full sequence verified green locally. | DevOps | P0 | TDD §14.3 | DONE |
| T-29  | ~~Add web build step + Firebase Hosting preview channel per PR~~ — **DONE 2026-05-28.** `deploy` job added to `ci.yml` (`needs: ci`). On PR: `FirebaseExtended/action-hosting-deploy` creates preview channel + posts URL as PR comment. On push to main: deploys to live channel. Project ID: `strand-descent`. Requires `FIREBASE_SERVICE_ACCOUNT` secret (set). | DevOps | P0 | TDD §14.3 | DONE |
| T-30  | ~~Add determinism replay test job (100 fixed seeds; assert stable output)~~ — **DONE 2026-05-28.** `src/core/rng/determinism-replay.test.ts` created. Two tests: (1) every seed produces identical output on repeated runs; (2) output independent of evaluation order (cross-seed state leak). Dedicated `test:determinism` script + separate `"Determinism replay (100 fixed seeds)"` step in `ci.yml`. Runs 2,000 calls × 5 sub-generators per seed. Fingerprint function scaffolded for expansion to full run simulation in T-391. Both tests pass. | QA | P0 | TDD §16.2, T4 | DONE |
| T-31  | Add Lighthouse CI gate (>= 85) on web build                    | DevOps   | P1       | TDD §15        | |
| T-32  | Add smoke test: production bundle asserts `DEMO_MODE === false`| DevOps   | P2       | TDD §14.2      | |
| T-33  | Tag-driven workflow: build `.ipa` (macOS runner) + `.aab` (Ubuntu) | DevOps | P2     | TDD §14.3      | fastlane match for iOS certs |
| T-34  | Tag-driven: upload to TestFlight + Play Internal track         | DevOps   | P2       | TDD §14.3      | |

### S-2.3 — Firebase project setup

| ID    | Title                                                                 | Role     | Priority | Refs       | Notes |
| ----- | --------------------------------------------------------------------- | -------- | -------- | ---------- | ----- |
| T-35  | ~~Create Firebase project (Spark free tier)~~ — **DONE 2026-05-28.** Project ID: `strand-descent`. `firebase.json` + `.firebaserc` committed to main. | DevOps | P0 | TDD §2.2 | DONE |
| T-36  | Enable: Auth (anonymous only), Firestore, Functions (Node 20), Hosting, Analytics, Crashlytics, FCM, Remote Config — **PARTIAL 2026-05-28.** Hosting enabled and wired to CI (T-29). Remaining services (Auth, Firestore, Functions, Analytics, Crashlytics, FCM, Remote Config) to be enabled before E-6 backend work begins. | DevOps | P0 | TDD §2.2 | PARTIAL |
| T-37  | Configure budget alerts at $5 / $20 / $50 thresholds                  | DevOps   | P0       | TDD §11.7  | NFR P3 |
| T-38  | Set hard billing cap at $50/month via Cloud Billing API               | DevOps   | P0       | TDD §11.7  | NFR P3 |
| T-39  | Apply Firestore Security Rules per TDD §17.6                          | Backend  | P1       | TDD §17.6  | |
| T-40  | Configure Remote Config defaults (all `feature.*` = false in binary)  | Backend  | P1       | TDD §11.6  | |

### S-2.4 — Developer accounts & signing

| ID    | Title                                              | Role     | Priority | Refs       | Notes |
| ----- | -------------------------------------------------- | -------- | -------- | ---------- | ----- |
| T-41  | Apple Developer Program enrollment ($99/yr)        | Director | P0       | TDD §19.1  | Account name = HELIX until T-7 done |
| T-42  | Google Play Console setup ($25 one-time)           | Director | P0       | TDD §19.1  | |
| T-43  | Apple App ID + provisioning profile via fastlane match | DevOps | P0     | TDD §14.4  | Private GitHub repo for certs |
| T-44  | Android self-signed upload key + Play App Signing enrollment | DevOps | P1 | TDD §14.4  | |
| T-45  | Domain registration `strand.empathy.software` (or final name post-T-7) | Director | P1 | TDD §14.5 | $15/yr × 2 |

### S-2.5 — Phaser + Capacitor scaffolding

| ID    | Title                                                                       | Role     | Priority | Refs              | Notes |
| ----- | --------------------------------------------------------------------------- | -------- | -------- | ----------------- | ----- |
| T-46  | ~~Install Phaser 3.80+ in `apps/game`~~ — **DONE 2026-05-27.** Phaser **3.90.0** resolved + installed (485 total packages via `pnpm install`, lockfile committed). pnpm@9.15.9 installed globally first. | Frontend | P0 | TDD §2.1 | DONE |
| T-47  | ~~Install + configure Capacitor 6.x (iOS + Android)~~ — **DONE 2026-05-28.** All packages installed (T-46). `npx cap init` generated `apps/game/capacitor.config.ts` (appId `software.empathy.strand`, webDir `dist`). `npx cap add ios` scaffolded `apps/game/ios/` (Xcode workspace + Podfile). `npx cap add android` scaffolded `apps/game/android/` (Gradle project). | Frontend | P0 | TDD §2.1 | DONE |
| T-48  | ~~Configure Vite 5.x dev server + production build for both `game` and `demo` entries~~ — **DONE 2026-05-28.** `apps/game/vite.config.ts` created. Mode-switched on `--mode demo`: `outDir` → `dist-demo`, `__DEMO_MODE__` → `true`, sourcemaps disabled. Production build: `outDir` → `dist`, `__DEMO_MODE__` → `false`, sourcemaps on. Path aliases wired for all `@core/*`, `@scenes/*`, `@platform/*`, `@ui/*`, `@shared-types/*`, `@balance/*`, `@content/*`. Phaser in own chunk for cache reuse. `index.html` and `src/main.ts` stub created. `pnpm build:web` and `pnpm build:demo` both pass. | DevOps | P0 | TDD §14.2 | DONE |
| T-49  | ~~First `BootScene` renders on `pnpm dev` localhost:5173~~ — **DONE 2026-05-28.** `src/scenes/BootScene.ts` created (title + studio name + pulsing dot). Registered in `main.ts` via `@scenes/BootScene`. `tsconfig.json` fixed (vite.config.ts moved to `tsconfig.node.json`; `noImplicitOverride` compliance on Scene lifecycle methods). `pnpm typecheck` clean. `pnpm build:web` + `pnpm build:demo` both pass. Dev server starts in 206ms on localhost:5173. | Frontend | P0 | UFD S001 | DONE |
| T-50  | First Phaser scene renders on iOS device via Capacitor                      | Frontend | P0       | TDD §10           | TestFlight-less device test via Xcode |
| T-51  | First Phaser scene renders on Android device                                | Frontend | P0       | TDD §10           | |

---

## E-3 — Core Simulation Engine

**Scope:** The deterministic, engine-agnostic TypeScript core. Zero Phaser imports. NFRs P1, P2, P4, P7, P8 all live here.

### S-3.1 — RNG (Mulberry32)

| ID    | Title                                                                 | Role          | Priority | Refs            | Notes |
| ----- | --------------------------------------------------------------------- | ------------- | -------- | --------------- | ----- |
| T-52  | ~~Implement `Mulberry32` in `core/rng/mulberry32.ts` (~10 lines)~~ — **DONE 2026-05-28.** `Mulberry32` class with `next(): float`, `nextInt(n): int`, serialisable `state` field. Implemented as prerequisite for T-30. | Game Engineer | P0 | TDD §6.1 | DONE |
| T-53  | ~~Sub-generator factory keyed by label (`combat`, `loot`, `floorgen`, `mutationdraw`, `events`)~~ — **DONE 2026-05-28.** `makeRng(rootSeed, label)` in `mulberry32.ts`. djb2-variant `hashLabel()` XORs root seed with label hash — adding new labels never shifts existing sub-generators. | Game Engineer | P0 | TDD §6.1 | DONE |
| T-54  | Daily seed: `hash(date_UTC + global_salt)` → 32 bits                  | Game Engineer | P1       | TDD §6.2        | |
| T-55  | Weekly seed: `hash(ISO_week + global_salt)` → 32 bits                 | Game Engineer | P1       | TDD §6.2        | |
| T-56  | ~~Vitest: distribution test (Chi-squared on 1M samples per sub-gen)~~ — **DONE 2026-05-28.** `mulberry32.test.ts`. χ²(100 bins, 1M samples) < 148.23 (critical value df=99, α=0.001) for all 5 sub-generators + direct Mulberry32. All pass in ~305ms. Post-commit CI typecheck fix 2026-05-28: added `!` non-null assertion on `counts[idx]!++` to satisfy `noUncheckedIndexedAccess: true` in tsconfig.base.json. | QA | P0 | TDD §16.1 | DONE |
| T-57  | ~~Vitest: seed isolation test (changing one sub-gen seed doesn't shift others)~~ — **DONE 2026-05-28.** `mulberry32.test.ts`. Three isolation tests: (1) advancing combat 50K steps doesn't shift loot sequence; (2) different labels produce distinct sequences from same root seed; (3) same label + different seeds produce distinct sequences. Plus nextInt bounds check (10K calls). | QA | P0 | TDD §16.1 | DONE |

### S-3.2 — Turn Engine

| ID    | Title                                                                 | Role          | Priority | Refs              | Notes |
| ----- | --------------------------------------------------------------------- | ------------- | -------- | ----------------- | ----- |
| T-58  | ~~`Action` discriminated union in `packages/shared-types`~~ — **DONE 2026-05-28.** `packages/shared-types/src/action.ts` created. Union covers 7 action types: `move` (targetPos), `attack` (targetId), `useAbility` (abilityId + optional targetId/targetPos), `useItem` (itemId + optional targetId), `wait`, `endTurn`, `surrender`. Supporting types: `Position`, `ActionType`. Exported from `index.ts`. All types `readonly`. Typecheck passes. | Game Engineer | P0       | TDD §5.2          | DONE |
| T-59  | ~~`TurnEngine.apply(state, action, rng) → { state, effects, errors }`~~ — **DONE 2026-05-28.** `apps/game/src/core/turn-engine/` created. `RunState` + `PlayerState` + `EnemyState` + `TurnPhase` + `EntityStats` + `StatusEffect` + `ActiveStatus` in `packages/shared-types/src/run-state.ts`. `Effect` (14-variant union) in `effect.ts`. `TurnError` / `TurnErrorCode` in `turn-error.ts`. `TurnEngine.apply` dispatch in `turn-engine.ts`: exhaustive switch over all 7 Action types, each stub validates phase and returns `{ state, effects: [], errors: [] }`. `ok()`/`err()` helpers. Barrel `index.ts`. Also removed `rootDir: "src"` from `apps/game/tsconfig.json` (cross-package path alias imports require it). | Game Engineer | P0       | TDD §5.1          | DONE — NFR P2/P4 |
| T-60  | ~~Move validation + execution~~ — **DONE 2026-05-28.** `applyMove` in `turn-engine.ts` fully implemented per GDD §6.3 (1 AP/tile, 1 tile/action, diagonals allowed). Validates: player phase, in-bounds, Chebyshev distance == 1, target not a wall, target not occupied by a living enemy, sufficient AP. On success: moves player, deducts `MOVE_AP_COST` (1), emits `entityMoved` + `apSpent` effects. Added `GridState`/`TileType` to `RunState` (`packages/shared-types/src/run-state.ts`) — movement needs grid bounds + walls. New `grid.ts` helpers: `inBounds`, `tileAt`, `chebyshev` (reused by attack/floor-gen later). 14 Vitest cases in `turn-engine.move.test.ts` (valid/diagonal/effects/purity/all rejection paths/determinism). Typecheck + lint + build green. | Game Engineer | P0       | TDD §5.3          | DONE |
| T-61  | ~~Attack validation + damage calc (STR/RES, crit, damage type)~~ — **DONE 2026-05-28.** `applyAttack` in `turn-engine.ts` (basic melee attack). Validates: player phase, target exists (`TARGET_NOT_FOUND`), target alive, target not `phased` (untargetable), within melee range (Chebyshev ≤ 1), sufficient AP. Damage = `floor(STR × 1.0)`, ×1.5 on crit (applied before mitigation), then flat RES subtraction, clamped `max(0, …)`. Crit roll consumes one `rng.next()` — chance = 5% base + 0.5%/AGI over base (tunable, pending Economy.xlsx). Emits `damageDealt` (`damageType: 'physical'`) + `entityDied` (if HP→0) + `apSpent`. Status application (Stagger) deferred to T-65; accuracy/dodge and ranged-equipment (STR×0.8) deferred. 16 Vitest cases (damage, crit-before-mitigation, no-negative-damage, death, single-target, purity, all rejection paths, determinism). Typecheck + lint + 42 tests green. | Game Engineer | P0       | GDD §6.3-§6.6     | DONE |
| T-62  | ~~Ability targeting + cooldown tracking~~ — **DONE 2026-05-28.** `applyUseAbility` in `turn-engine.ts`. New `AbilityDef`/`AbilitySlot`/`AbilityTargetType` in `packages/shared-types/src/ability.ts` (apCost, cooldown, range, targetType, baseDamage, damageType, intScaling, aoeRadius, appliesStatus, statusDuration). `PlayerState.abilities` now `readonly AbilitySlot[]` (per-ability `cooldownRemaining` lives in RunState → survives save/resume). Targeting modes: `enemy` (single + Chebyshev-radius splash), `tile` (in-bounds, range-checked, AoE), `self` (status to player). Damage = `baseDamage + floor(INT × intScaling)`, mitigated by RES (True ignores it); abilities do **not** crit (crit is a basic-attack mechanic, GDD §6.6) so resolution consumes no RNG. Cooldown set to `def.cooldown` on use; per-turn decrement deferred to turn-flow (T-64/T-66). Suppressed status blocks use. Also added `DamageType` union (GDD §6.4) + tightened `effect.ts` `damageDealt.damageType`/`statusApplied.status` to real unions, and extracted shared `combat.ts` (`mitigate`/`rollCrit`/`applyCrit`), refactoring T-61's attack onto it. New error codes: `ABILITY_NOT_FOUND`, `ABILITY_SUPPRESSED`. 20 Vitest cases (INT scaling, true damage, cooldown set+block, status apply, no-status-on-kill, self-buff, tile + enemy AoE, all rejection paths, purity, determinism). Typecheck + lint + 62 tests + build green. | Game Engineer | P0       | GDD §6.3          | DONE |
| T-63  | ~~Item use resolution~~ — **DONE 2026-05-28.** `applyUseItem` in `turn-engine.ts` resolves consumables (single-use, 1 AP, no cooldown — GDD §9.2). New `ItemDef`/`ItemCategory`/`ItemEffect` in `packages/shared-types/src/item.ts`; `PlayerState.items` now `readonly ItemDef[]`. `ItemEffect` union: `heal` (self, clamped to maxHp, reports actual healed), `damage` (tile-targeted Chebyshev AoE, RES-mitigated, True ignores RES), `applyStatus` (tile-targeted AoE). Validates phase, item in inventory (`ITEM_NOT_FOUND`), is consumable (`ITEM_NOT_CONSUMABLE`), AP, and tile target in-bounds for grenades. Consumes exactly one instance on success; emits `itemUsed` → effect-specific → `apSpent`. RNG-free (items don't crit). Added `targetPos?` to `UseItemAction` (matches TDD §5.2 `target?: Tile`). AoE shapes (2×2/line) approximated by radius — content tuning later; SIG buff (Sigma Catalyst) + mutation reroll (Adaptation Fluid) deferred to mutation/meta systems. 17 Vitest cases (heal + clamp, single-instance consume, AoE true/physical damage, status AoE, all rejection paths, no-consume-on-failure, purity, determinism). Typecheck + lint + 79 tests + build green. | Game Engineer | P0       | GDD §9.2          | DONE |
| T-64  | ~~Enemy phase resolution (initiative order, telegraphed actions)~~ — **DONE 2026-05-28.** `resolveEnemyPhase(state, rng)` in new `enemy-phase.ts`: living enemies act once each in descending AGI order (id tie-break, deterministic), resolving the `telegraph` set last turn. `melee` (Chebyshev ≤ 1, STR dmg), `ranged` (≤ 5 tiles, floor(STR×0.8)), both RES-mitigated; out-of-range attacks fizzle. `move` steps one tile toward player (blocked by bounds/walls/player/other enemies). `defense`/`special`/`idle`/`null` are no-ops (enemy specials + defense-stance deferred). Typed `Telegraph` union added to `EnemyState.telegraph`. Wired `endTurn` + `wait` → `endPlayerTurn`: phase→enemy, resolve, then AP refresh, ability-cooldown decrement, turn++, phase→player, with `phaseChanged` effects both ways. Seams left for status tick (T-65), win/loss (T-66), telegraph regen (T-67). 19 Vitest cases (each telegraph type, fizzle, move-blocking, initiative + tie-break, no-ops, dead enemies skip, purity) + turn-flow tests. Typecheck + lint + 98 tests + build green. | Game Engineer | P0       | TDD §5.3, GDD §6.2 | DONE |
| T-65  | Status effect tick (Burn, Infected, Stagger, Suppressed, Fractured, Crushed, Rooted, Phased, Regenerating, Overheated) | Game Engineer | P0 | GDD §6.5 | |
| T-66  | Win/loss/floor-complete detection                                     | Game Engineer | P0       | TDD §5.3          | |
| T-67  | Telegraph generation for next enemy turn                              | Game Engineer | P0       | GDD §6.2          | |
| T-68  | Vitest: every Action type, every edge case                            | QA            | P0       | TDD §16.1         | Coverage target 80% on `/core/turn-engine/` |
| T-69  | Performance harness: per-turn resolution <16ms on iPhone X            | QA            | P1       | TDD §5.7, §15     | NFR perf |

### S-3.3 — Floor Generation

| ID    | Title                                                                 | Role          | Priority | Refs            | Notes |
| ----- | --------------------------------------------------------------------- | ------------- | -------- | --------------- | ----- |
| T-70  | Floor template loader (JSON → in-memory template)                     | Game Engineer | P0       | TDD §7.1        | |
| T-71  | Room placement algorithm (graph layout)                               | Game Engineer | P0       | TDD §7.1        | |
| T-72  | BFS connectivity validator (start → boss path exists)                 | Game Engineer | P0       | TDD §7.1        | |
| T-73  | Room-type filler (combat/loot/safe/merchant/trap/LACE-event)          | Game Engineer | P0       | GDD §7.2-§7.3   | Weighted, with min-guarantees |
| T-74  | Enemy placement per room type                                         | Game Engineer | P0       | TDD §7.1        | |
| T-75  | Hazard placement (1–3 per combat room)                                | Game Engineer | P0       | GDD §6.1, §7.2  | |
| T-76  | Codex fragment placement (0–4 per floor, non-boss rooms)              | Game Engineer | P1       | GDD §7.2        | |
| T-77  | Boss-room handling (10×10 grid, locked door)                          | Game Engineer | P0       | GDD §7.4        | |
| T-78  | Difficulty scaling formula (HP × (1 + floor × 0.15) etc.)             | Game Engineer | P1       | GDD §7.5        | |
| T-79  | Fallback: fixed template after 5 failed gen attempts                  | Game Engineer | P0       | TDD §7.1        | |
| T-80  | Vitest: connectivity + room-count + min-guarantee tests               | QA            | P0       | TDD §16.1       | |
| T-81  | Performance: gen <100ms on iPhone X                                   | QA            | P1       | TDD §7.3        | NFR perf |

### S-3.4 — Mutation Engine

| ID    | Title                                                                 | Role          | Priority | Refs              | Notes |
| ----- | --------------------------------------------------------------------- | ------------- | -------- | ----------------- | ----- |
| T-82  | JSON schema for mutations (matches TDD §8.1 example)                  | Game Engineer | P0       | TDD §8.1          | |
| T-83  | Mutation loader + schema validator                                    | Game Engineer | P0       | TDD §8.2          | NFR P7 |
| T-84  | `pnpm validate:content` aggregates all schema validators              | DevOps        | P0       | TDD §14.1         | |
| T-85  | Card draw: 1 dominant family + 1 adjacent + 1 wild (deterministic)    | Game Engineer | P0       | GDD §5.4          | Uses `rng.mutationdraw` |
| T-86  | Family-weighting rule (40/20/20/10/10 etc.)                           | Game Engineer | P0       | GDD §5.4          | |
| T-87  | No-duplicates filter                                                  | Game Engineer | P0       | GDD §5.4          | |
| T-88  | Tier progression (Floor 5: 3M; F10: 2M+1Maj; F15: 1M+1Maj+1Dom)       | Game Engineer | P0       | GDD §5.4          | |
| T-89  | Reroll: rerolls **1 player-selected card** via same RNG sub-stream    | Game Engineer | P0       | GDD §5.4 Rule 5   | DR-006 / Patch 04 |
| T-90  | Modifier application on mutation selection                            | Game Engineer | P0       | GDD §5.3          | |
| T-91  | Dominant Trait unlock detection (3+ same family)                      | Game Engineer | P0       | GDD §5.5          | |
| T-92  | Hybrid Synergy detection (10 cross-family combinations)               | Game Engineer | P1       | GDD §5.6          | |
| T-93  | VEIN Intermission trigger (4 mutations max → +100 VC instead)         | Game Engineer | P1       | GDD §3.5, §4.2    | |
| T-94  | SIG cap 40 enforcement; LACE event mutation grants only +5 SIG        | Game Engineer | P1       | GDD §4.2          | Patch 11 fix |
| T-95  | Vitest: every modifier type, every family weighting, no-repeat        | QA            | P0       | TDD §16.1         | |

### S-3.5 — LACE Narrative Engine (core)

| ID    | Title                                                                 | Role          | Priority | Refs              | Notes |
| ----- | --------------------------------------------------------------------- | ------------- | -------- | ----------------- | ----- |
| T-96  | LACE line JSON schema (text + context + mood + weight)                | Game Engineer | P0       | TDD §9.2          | |
| T-97  | Line loader + schema validator                                        | Game Engineer | P0       | TDD §9.2          | |
| T-98  | Selection algorithm (filter by context, exclude already-spoken, weight-sample) | Game Engineer | P0 | TDD §9.3          | |
| T-99  | Mood state machine (5 moods, transitions per TDD §9.4)                | Game Engineer | P0       | TDD §9.4          | |
| T-100 | Mood persistence across runs with drift toward neutral                | Game Engineer | P1       | TDD §9.4          | |
| T-101 | Templated grammar assembly (DR-004 default plan)                      | Game Engineer | P0       | TDD §9.5          | Fragments tagged by [event_type, family, mood, state] |
| T-102 | Fallback to generic line pool when no candidates                      | Game Engineer | P0       | TDD §9.3          | |
| T-103 | "Spoken-this-run" tracker, cleared on death                           | Game Engineer | P0       | TDD §9.3          | |
| T-104 | Vitest: filter/weight/no-repeat invariants                            | QA            | P0       | TDD §16.1         | |

### S-3.6 — Economy

| ID    | Title                                                  | Role          | Priority | Refs             | Notes |
| ----- | ------------------------------------------------------ | ------------- | -------- | ---------------- | ----- |
| T-105 | XP curve per level (1–20) from Economy.xlsx tab        | Game Engineer | P0       | GDD §4.3, Econ E | |
| T-106 | VC drop tables per enemy tier per floor                | Game Engineer | P0       | GDD §9.4, Econ E | |
| T-107 | SC earn rates (daily, achievement, run completion)     | Game Engineer | P1       | GDD §15.5, Econ E | |
| T-108 | Item pricing function per zone (Dispenser costs)       | Game Engineer | P1       | GDD §9, Econ E   | |
| T-109 | Vitest: drop-rate distribution test (chi-squared on 100K samples) | QA  | P1       | TDD §16.1        | |

### S-3.7 — Save Layer (RunState + MetaState)

| ID    | Title                                                                       | Role          | Priority | Refs             | Notes |
| ----- | --------------------------------------------------------------------------- | ------------- | -------- | ---------------- | ----- |
| T-110 | `RunState` interface + `schemaVersion: number` field                        | Game Engineer | P0       | TDD §5.6         | NFR P8 |
| T-111 | `MetaState` interface (codex, Sigma Strains, achievements, lifetime stats, cosmetics) | Game Engineer | P0 | TDD §4.2 | NFR P8 |
| T-112 | Atomic write pattern: write to temp → rename                                | Game Engineer | P0       | TDD §5.5, T5     | NFR P8 |
| T-113 | Keep last 3 save generations (rotation)                                     | Game Engineer | P0       | TDD §5.5, T5     | NFR P8 |
| T-114 | Save-on-action hook in turn engine                                          | Game Engineer | P0       | TDD §5.5         | |
| T-115 | Migration framework (`core/turn-engine/migrations/`)                        | Game Engineer | P1       | TDD §5.6         | Tested against fixture saves from each prior version |
| T-116 | Vitest: fixture-save migration tests for every prior schemaVersion          | QA            | P1       | TDD §5.6         | |
| T-117 | Resume Run? modal trigger logic (S100)                                      | Game Engineer | P0       | UFD S100, E011   | |

### S-3.8 — Organism Name Generator

| ID    | Title                                                                 | Role          | Priority | Refs           | Notes |
| ----- | --------------------------------------------------------------------- | ------------- | -------- | -------------- | ----- |
| T-118 | `prefix_table` JSON (~20 entries)                                     | Director      | P1       | UFD §3         | Director-authored content |
| T-119 | `trait_table` JSON per family (~20 × 5 families)                      | Director      | P1       | UFD §3         | |
| T-120 | `suffix_table` JSON (~10 entries)                                     | Director      | P1       | UFD §3         | |
| T-121 | Special-condition suffixes: "of the Third Descent", "Untouched", "Bloodless" | Game Engineer | P1 | UFD §3 | |
| T-122 | `nameHash = hash(run_seed + final_build_signature)` deterministic     | Game Engineer | P1       | UFD §3         | NFR P2 |
| T-123 | Vitest: 1000 random seeds produce 1000 names; no collisions in a family pool of 4,000 | QA | P1 | TDD §16.1   | |

---

## E-4 — Phaser Scene Layer

**Scope:** Implements every UFD screen. Heavy in the Alpha and Beta phases. Tasks below are grouped per UFD scope.

### S-4.1 — First-Launch & Boot (UFD Scope 1)

| ID    | Title                                                  | Role     | Priority | Refs                 | Notes |
| ----- | ------------------------------------------------------ | -------- | -------- | -------------------- | ----- |
| T-124 | S001 Cold launch splash                                | Frontend | P0       | UFD 01               | |
| T-125 | S002 Studio splash (Empathy Software)                  | Frontend | P0       | UFD 01               | |
| T-126 | S003 VEIN intro cinematic (15s skippable)              | Frontend | P1       | UFD 01               | |
| T-127 | S004 Anonymous auth (silent)                           | Frontend | P0       | UFD 01, TDD §11.1    | |
| T-128 | S005 Cloud sync check                                  | Frontend | P1       | UFD 01, TDD §10.1    | |
| T-129 | S006 Offline mode notice                               | Frontend | P0       | UFD 01, E001         | |
| T-130 | S007 Region detection (for consent gate)               | Frontend | P0       | UFD 01               | |
| T-131 | S008 Restore progress silently                         | Frontend | P1       | UFD 01               | |
| T-132 | S009 GDPR / CCPA consent modal (EU/CA gate)            | Frontend | P0       | UFD 01, TDD §13.4    | NFR P6 |
| T-133 | S010 Push notification prompt (first Floor 5 trigger)  | Frontend | P1       | UFD 01               | |
| T-134 | S010A Analytics-off state on consent decline           | Frontend | P0       | UFD 01               | NFR P6 |
| T-135 | S011 Tutorial intro (LACE first voice)                 | Frontend | P0       | UFD 01               | |
| T-136 | S100 Resume Run? modal                                 | Frontend | P0       | UFD 01, E011         | |

### S-4.2 — Floor 0 Tutorial (TDD §21 Q4)

| ID    | Title                                                  | Role          | Priority | Refs           | Notes |
| ----- | ------------------------------------------------------ | ------------- | -------- | -------------- | ----- |
| T-137 | Floor 0 hardcoded template (4 rooms)                   | Game Engineer | P0       | TDD §21 Q4     | Deterministic, not procedural |
| T-138 | S012 Room 1 — movement only                            | Frontend      | P0       | TDD §21 Q4     | |
| T-139 | S013 Room 2 — first combat                             | Frontend      | P0       | TDD §21 Q4     | |
| T-140 | S014 Room 3 — micro Strand Event (2 safe cards)        | Frontend      | P0       | TDD §21 Q4     | analytics `is_tutorial: true` |
| T-141 | S015 Room 4 — Floor 0 boss (teaches item use)          | Frontend      | P0       | TDD §21 Q4     | |
| T-142 | S016 First Convergence achievement granted             | Frontend      | P0       | TDD §21 Q4     | |
| T-143 | Tutorial skip flag in MetaState (returning player Hub skip) | Game Engineer | P0  | TDD §21 Q4     | |

### S-4.3 — Hub & Run Preview (UFD Scope 2 entry)

| ID    | Title                                                  | Role     | Priority | Refs       | Notes |
| ----- | ------------------------------------------------------ | -------- | -------- | ---------- | ----- |
| T-144 | S017 HubScene with menu shelf                          | Frontend | P0       | UFD 02     | |
| T-145 | S018 Origin Select (swipe left/right)                  | Frontend | P0       | UFD 02     | |
| T-146 | S019 Daily Sigma intro                                 | Frontend | P1       | UFD 02     | |
| T-147 | S020 Weekly Challenge intro                            | Frontend | P1       | UFD 02     | |
| T-148 | S021 Run preview (seed + modifiers + Strains)          | Frontend | P0       | UFD 02     | |
| T-149 | S022 Floor transition (1s async-gen mask)              | Frontend | P0       | UFD 02     | |

### S-4.4 — FloorScene (S023)

| ID    | Title                                                  | Role     | Priority | Refs       | Notes |
| ----- | ------------------------------------------------------ | -------- | -------- | ---------- | ----- |
| T-150 | S023 FloorScene shell (tile-based exploration)         | Frontend | P0       | UFD 02     | |
| T-151 | Tile renderer via Phaser Graphics primitives           | Frontend | P0       | TDD §21 Q2 | NFR perf |
| T-152 | Player entity (runtime-generated geometry)             | Frontend | P0       | TDD §13.5  | |
| T-153 | Enemy entities (shape encodes behavior)                | Frontend | P0       | GDD §13.3  | |
| T-154 | Fog of war                                             | Frontend | P0       | GDD §7.2   | |
| T-155 | Minimap (compact + tap-to-expand)                      | Frontend | P0       | GDD §12.6  | |
| T-156 | Color-blind friendly minimap (shape glyphs)            | Frontend | P1       | GDD §17    | NFR a11y |
| T-157 | Player movement input handling                         | Frontend | P0       | UFD 02     | |
| T-158 | Camera tracking                                        | Frontend | P0       | —          | |
| T-159 | Enemy telegraph icons rendered above heads             | Frontend | P0       | GDD §6.2   | |
| T-160 | Particle effects (ambient per family)                  | Frontend | P1       | GDD §13.3  | |

### S-4.5 — Combat scenes (UFD Scope 3)

| ID    | Title                                                                 | Role     | Priority | Refs           | Notes |
| ----- | --------------------------------------------------------------------- | -------- | -------- | -------------- | ----- |
| T-161 | S040 Combat init (reveal enemies + first telegraphs)                  | Frontend | P0       | UFD 03         | |
| T-162 | S041 Player turn start (AP refresh, save RunState on entry)           | Frontend | P0       | UFD 03         | |
| T-163 | S042 Move preview (path + AP cost; two-tap confirm for first 5 runs)  | Frontend | P0       | UFD 03         | |
| T-164 | S043 Attack preview (damage range + accuracy)                         | Frontend | P0       | UFD 03         | |
| T-165 | S044 Ability targeting (range overlay, AoE preview)                   | Frontend | P0       | UFD 03         | |
| T-166 | S045 Item use prompt                                                  | Frontend | P0       | UFD 03         | |
| T-167 | S046 Enemy phase trigger                                              | Frontend | P0       | UFD 03         | |
| T-168 | S047 Combat menu (Resume / Surrender / Settings; double-confirm Surrender) | Frontend | P0 | UFD 03 | NO FLEE in v1 |
| T-169 | S048 Action resolution animation                                      | Frontend | P0       | UFD 03         | |
| T-170 | S049 Enemy actions resolve sequentially (tap-to-fast-forward 2× cap)  | Frontend | P0       | UFD 03         | |
| T-171 | Auto-fast after 20 runs of player history                             | Frontend | P1       | UFD 03         | |
| T-172 | S050 Status tick visualization                                        | Frontend | P0       | UFD 03         | |
| T-173 | S051 Combat victory (flash + XP, 1.5s dismiss)                        | Frontend | P0       | UFD 03         | |
| T-174 | S052 Combat loss → triggers S030                                      | Frontend | P0       | UFD 03         | |
| T-175 | Ability bar UI (6 slots, swipeable, manual assignment)                | Frontend | P0       | GDD §12.3      | |

### S-4.6 — Room screens

| ID    | Title                                                                 | Role     | Priority | Refs       | Notes |
| ----- | --------------------------------------------------------------------- | -------- | -------- | ---------- | ----- |
| T-176 | S024 Event Room (LACE narrative choice, 3 options)                    | Frontend | P0       | UFD 02     | |
| T-177 | S025 Merchant Room (VC-priced shop, 1 ad refresh per merchant)        | Frontend | P1       | UFD 02     | |
| T-178 | S026 Safe Room (heal 25% max HP + inventory + save + LACE moment)     | Frontend | P0       | UFD 02     | |
| T-179 | S026 Sigma Echo replay (3–5s ghost run; 3/run cap)                    | Frontend | P1       | GDD §10.4  | NFR P3 (cache) |
| T-180 | S027 Loot reveal animation                                            | Frontend | P0       | UFD 02     | |

### S-4.7 — Strand Event scenes (UFD Scope 4)

| ID    | Title                                                                 | Role     | Priority | Refs       | Notes |
| ----- | --------------------------------------------------------------------- | -------- | -------- | ---------- | ----- |
| T-181 | S060 Strand Event intro (LACE narrates; not-skippable first-per-run)  | Frontend | P0       | UFD 04     | |
| T-182 | S061 Card reveal animation (~1.5s, deterministic per seed)            | Frontend | P0       | UFD 04     | NFR P2 |
| T-183 | S062 Card selection UI (no timer, tap-and-hold to mark reroll)        | Frontend | P0       | UFD 04     | |
| T-184 | S063 Card detail modal (effect text + family lore + synergy hints)    | Frontend | P0       | UFD 04     | |
| T-185 | S064 Choice confirm (skipped after first 3 confirms in player history) | Frontend | P0      | UFD 04     | |
| T-186 | S065 Reroll prompt (player-picked card, 1 reroll per Strand Event)    | Frontend | P0       | UFD 04     | |
| T-187 | S066 Token confirm (shows token balance)                              | Frontend | P1       | UFD 04     | |
| T-188 | S067 New card drawn (animate replacement)                             | Frontend | P0       | UFD 04     | |
| T-189 | S068 Mutation applied (visual transform of player geometry)           | Frontend | P0       | UFD 04     | |
| T-190 | S069 LACE reaction (mood-aware)                                       | Frontend | P0       | UFD 04     | |
| T-191 | S070 Dominant Trait reveal (big celebration; first-time achievement)  | Frontend | P0       | UFD 04     | |
| T-192 | S071 VEIN Intermission (replaces Strand Event when 4 mutations cap)   | Frontend | P1       | UFD 04     | |

### S-4.8 — Run-end & Share-bridge scenes

| ID    | Title                                                                       | Role     | Priority | Refs       | Notes |
| ----- | --------------------------------------------------------------------------- | -------- | -------- | ---------- | ----- |
| T-193 | S028 Victory sequence (Floor 20 boss)                                       | Frontend | P2       | UFD 02     | |
| T-194 | S029 Floor descent (post-Strand narration)                                  | Frontend | P0       | UFD 02     | |
| T-195 | S030 Death sequence (3s animation; `death_cause` enum)                      | Frontend | P0       | UFD 02     | |
| T-196 | S031 "What You Became" screen (portrait + name + share CTA)                 | Frontend | P0       | UFD 02, GDD §12.8 | |
| T-197 | S032 Meta rewards (SC granted, achievements popped)                         | Frontend | P0       | UFD 02     | |
| T-198 | S033 Revive offer (after share to protect emotional moment)                 | Frontend | P0       | UFD 02     | |

### S-4.9 — Meta-progression scenes (UFD Scope 5)

| ID    | Title                                                                          | Role     | Priority | Refs       | Notes |
| ----- | ------------------------------------------------------------------------------ | -------- | -------- | ---------- | ----- |
| T-199 | S080 Codex Home (Codex + Pass Archive tabs)                                    | Frontend | P1       | UFD 05, DR-006b | |
| T-200 | S081 Origins Menu (locked + unlocked)                                          | Frontend | P1       | UFD 05     | |
| T-201 | S082 Achievements list (sortable; "Complete the Codex" refs base codex only)   | Frontend | P1       | UFD 05     | |
| T-202 | S083 Settings root                                                             | Frontend | P0       | UFD 05     | |
| T-203 | S084 Profile (lifetime stats; gallery cap ~50KB/user)                          | Frontend | P2       | UFD 05     | |
| T-204 | S085 Codex category (locked entries BLURRED, not hidden)                       | Frontend | P1       | UFD 05     | |
| T-205 | S085P Pass Archive category (subscribe CTA; never counts toward base 100%)     | Frontend | P2       | UFD 05, DR-006b | |
| T-206 | S086 Codex entry detail                                                        | Frontend | P1       | UFD 05     | |
| T-207 | S087 Origin detail                                                             | Frontend | P1       | UFD 05     | |
| T-208 | S088 Origin skin selector (Preview state for not-yet-unlocked Origins)         | Frontend | P2       | UFD 05, DR-006a | |
| T-209 | S089 Achievement detail                                                        | Frontend | P1       | UFD 05     | |
| T-210 | S090 Audio settings (Music/SFX/Ambient sliders, live preview)                  | Frontend | P0       | UFD 05     | |
| T-211 | S091 Display settings (brightness, color blindness, motion)                    | Frontend | P0       | UFD 05     | NFR a11y |
| T-212 | S092 Accessibility (cognitive load mode, dyslexia font, font size, motion)     | Frontend | P0       | UFD 05, GDD §17 | NFR a11y |
| T-213 | S093 Controls (confirm-tap toggle, animation speed)                            | Frontend | P0       | UFD 05     | |
| T-214 | S094 Cloud Sync status                                                         | Frontend | P2       | UFD 05     | |
| T-215 | S095 Privacy (GDPR/CCPA mandatory entry point)                                 | Frontend | P0       | UFD 05     | NFR P6 |
| T-216 | S096 About + licenses                                                          | Frontend | P0       | UFD 05     | |
| T-217 | S097 Support / contact                                                         | Frontend | P0       | UFD 05     | |
| T-218 | S098 Sync OK                                                                   | Frontend | P2       | UFD 05     | |
| T-219 | S099 Sync conflict modal (contradictory only)                                  | Frontend | P2       | UFD 05     | |
| T-220 | S110 Data export confirm (hashed UID via Cloud Function)                       | Frontend | P2       | UFD 05     | NFR P6 |
| T-221 | S111 Delete account (7-day soft delete + hard delete CF)                       | Frontend | P2       | UFD 05     | NFR P6 |

---

## E-5 — Platform Adapters

### S-5.1 — Storage adapter

| ID    | Title                                                  | Role     | Priority | Refs       | Notes |
| ----- | ------------------------------------------------------ | -------- | -------- | ---------- | ----- |
| T-222 | `StorageAdapter` interface in `core/platform`          | Game Engineer | P0  | TDD §10.1  | |
| T-223 | Web impl: IndexedDB via `idb-keyval`                   | Frontend | P0       | TDD §10.1  | |
| T-224 | Capacitor impl: `@capacitor/preferences` (small) + Filesystem (large) | Frontend | P0 | TDD §10.1 | |
| T-225 | Vitest mocks for tests                                 | QA       | P0       | TDD §10.1  | |

### S-5.2 — Cloud storage adapter (TDD §21 Q6)

| ID    | Title                                                                 | Role     | Priority | Refs       | Notes |
| ----- | --------------------------------------------------------------------- | -------- | -------- | ---------- | ----- |
| T-226 | `CloudStorageAdapter` interface                                       | Game Engineer | P2 | TDD §10.1  | |
| T-227 | iOS impl: iCloud KV via Capacitor community plugin                    | Frontend | P2       | TDD §10.1  | |
| T-228 | Android impl: Google Play Games Saved Games                           | Frontend | P2       | TDD §10.1  | |
| T-229 | Web stub                                                              | Frontend | P2       | TDD §10.1  | |
| T-230 | Conflict-resolution policy ("highest value wins", union for sets)     | Game Engineer | P2 | TDD §10.1 | |
| T-231 | Sync debouncing (60s window, flush on background)                     | Frontend | P2       | TDD §10.1  | |
| T-232 | 1MB iCloud KV size estimate + runtime budget enforcement              | Game Engineer | P2 | TDD §15   | NFR perf |
| T-233 | First-launch silent restore behavior                                  | Frontend | P2       | TDD §10.1  | |
| T-234 | S094 status surface + S099 conflict modal wiring                      | Frontend | P2       | UFD 05     | |

### S-5.3 — Ads adapter

| ID    | Title                                                  | Role     | Priority | Refs       | Notes |
| ----- | ------------------------------------------------------ | -------- | -------- | ---------- | ----- |
| T-235 | `AdsAdapter` interface                                 | Game Engineer | P1 | TDD §10.2  | |
| T-236 | Web stub (returns "completed" with no actual ad)       | Frontend | P1       | TDD §10.2  | |
| T-237 | Capacitor impl: AdMob Community plugin                 | Frontend | P1       | TDD §10.2  | |
| T-238 | 3-ads-per-run hard cap                                 | Game Engineer | P1 | GDD §15.2  | |
| T-239 | 60s cooldown between ads                               | Game Engineer | P1 | GDD §15.2  | |
| T-240 | 10s timeout with graceful degradation (no retry, no goodwill grant) | Game Engineer | P1 | UFD 06 (E030/S135) | |
| T-241 | E030 ad load timeout → null reward + S135                              | Game Engineer | P1 | UFD 07 | |
| T-242 | E031 ad cancelled mid-watch → null reward                              | Game Engineer | P1 | UFD 07 | |
| T-243 | E032 ad cap reached → hide ad buttons, show SC alternative             | Frontend | P1 | UFD 07 | |

### S-5.4 — IAP adapter

| ID    | Title                                                  | Role     | Priority | Refs       | Notes |
| ----- | ------------------------------------------------------ | -------- | -------- | ---------- | ----- |
| T-244 | `IAPAdapter` interface                                 | Game Engineer | P2 | TDD §10.3  | |
| T-245 | Web stub                                               | Frontend | P2       | TDD §10.3  | |
| T-246 | Capacitor Community IAP plugin (StoreKit + Play Billing) | Frontend | P2     | TDD §10.3  | |
| T-247 | Edge cases E040-E043 (region mismatch, receipt fail, pending, refund) | Game Engineer | P2 | UFD 07 | |

### S-5.5 — Analytics adapter

| ID    | Title                                                                 | Role     | Priority | Refs       | Notes |
| ----- | --------------------------------------------------------------------- | -------- | -------- | ---------- | ----- |
| T-248 | `AnalyticsAdapter` interface                                          | Game Engineer | P0 | TDD §10.4  | |
| T-249 | Type-safe `EventSchema` (typo = compile error)                        | Game Engineer | P0 | TDD §13.2  | |
| T-250 | Web impl: Firebase Analytics web SDK                                  | Frontend | P0       | TDD §10.4  | |
| T-251 | Capacitor impl: Firebase Analytics native SDK via plugin              | Frontend | P0       | TDD §10.4  | |
| T-252 | Dev-mode console logging                                              | Frontend | P0       | TDD §10.4  | |
| T-253 | Local debug log (last 200 events)                                     | Game Engineer | P0 | TDD §13.3  | |
| T-254 | GDPR/CCPA: Analytics off-by-default in EU/CA until consent (UFD S009) | Frontend | P0       | TDD §13.4  | NFR P6 |
| T-255 | Wire all 50+ events from GDD §19 to fire at correct points            | Frontend | P0/P1    | GDD §19    | One sub-task per event domain |

### S-5.6 — Share adapter

| ID    | Title                                                  | Role     | Priority | Refs       | Notes |
| ----- | ------------------------------------------------------ | -------- | -------- | ---------- | ----- |
| T-256 | `ShareAdapter` interface                               | Game Engineer | P1 | TDD §10.5  | |
| T-257 | Web impl: Web Share API + copy-link fallback           | Frontend | P1       | TDD §10.5  | |
| T-258 | Capacitor impl: `@capacitor/share`                     | Frontend | P1       | TDD §10.5  | |

---

## E-6 — Backend (Firebase)

### S-6.1 — Firestore schema & rules

| ID    | Title                                                                 | Role     | Priority | Refs       | Notes |
| ----- | --------------------------------------------------------------------- | -------- | -------- | ---------- | ----- |
| T-259 | `users/{uid}` collection schema                                       | Backend  | P1       | TDD §11.2  | |
| T-260 | `users/{uid}/meta/state` mirror                                       | Backend  | P1       | TDD §11.2  | |
| T-261 | `runs_anon/{runId}` collection (Sigma Echo)                           | Backend  | P1       | TDD §11.2  | No uid linkage stored |
| T-262 | `daily_signals/{date}` collection                                     | Backend  | P1       | TDD §11.2  | |
| T-263 | `weekly_challenges/{isoWeek}` collection                              | Backend  | P1       | TDD §11.2  | |
| T-264 | `leaderboards/{boardId}/entries/{entryId}` collections                | Backend  | P1       | TDD §11.2  | |
| T-265 | Security Rules: per-uid read/write isolation                          | Backend  | P1       | TDD §17.6  | NFR P6 |
| T-266 | Security Rules: leaderboards read-only client; write via CF only      | Backend  | P1       | TDD §17.6  | |

### S-6.2 — Cache layer

| ID    | Title                                                  | Role     | Priority | Refs       | Notes |
| ----- | ------------------------------------------------------ | -------- | -------- | ---------- | ----- |
| T-267 | `cache.ts` `fetchCached<T>(key, ttl, fetcher)`         | Game Engineer | P1 | TDD §12  | NFR P3 |
| T-268 | Stale-while-revalidate behavior                        | Game Engineer | P1 | TDD §12  | |
| T-269 | Cache TTLs per resource (R3-R6 rules)                  | Game Engineer | P1 | TDD §11.4 | |

### S-6.3 — Cloud Functions

| ID    | Title                                                  | Role     | Priority | Refs       | Notes |
| ----- | ------------------------------------------------------ | -------- | -------- | ---------- | ----- |
| T-270 | `generateDailySignal` scheduled function (00:00 UTC)   | Backend  | P1       | TDD §11.3  | |
| T-271 | `generateWeeklyChallenge` scheduled function (Mon 00:00 UTC) | Backend | P1 | TDD §11.3  | |
| T-272 | `validatePurchase` triggered function (Apple/Google receipt verification) | Backend | P2 | TDD §11.3, §17.5 | NFR P6 |
| T-273 | `pruneOldRuns` scheduled weekly (>30d cleanup)         | Backend  | P2       | TDD §11.3  | |
| T-274 | Data export Cloud Function (hashed UID return)         | Backend  | P2       | TDD §17.4  | NFR P6 |
| T-275 | Account-delete Cloud Function (7-day soft + hard delete) | Backend | P2 | TDD §17.4 | NFR P6 |

### S-6.4 — Sigma Echo system

| ID    | Title                                                                 | Role     | Priority | Refs           | Notes |
| ----- | --------------------------------------------------------------------- | -------- | -------- | -------------- | ----- |
| T-276 | Anonymized run upload on run completion (build, floors, name, death cause) | Backend | P1 | TDD §11.2, GDD §10.4 | NFR P6 |
| T-277 | Echo fetch query (capped 3/session client-side)                       | Backend  | P1       | TDD §11.4, R2  | NFR P3 |
| T-278 | 24h client-side cache                                                 | Game Engineer | P1 | TDD §11.4 | |

### S-6.5 — Remote Config kill switches

| ID    | Title                                                  | Role     | Priority | Refs       | Notes |
| ----- | ------------------------------------------------------ | -------- | -------- | ---------- | ----- |
| T-279 | All `feature.*` flags default OFF in binary            | Backend  | P1       | TDD §11.6  | NFR P3 |
| T-280 | Flag fetch + cache integration                         | Game Engineer | P1 | TDD §11.6 | |
| T-281 | Runtime kill-switch hooks per backend feature          | Game Engineer | P1 | TDD §11.6 | |

---

## E-7 — Content Pipeline

**Scope:** JSON schemas + validators + actual content authoring at three build orders (Prototype / Alpha / Soft launch).

### S-7.1 — Schemas & validators

| ID    | Title                                                  | Role     | Priority | Refs       | Notes |
| ----- | ------------------------------------------------------ | -------- | -------- | ---------- | ----- |
| T-282 | Mutation schema                                        | Game Engineer | P0 | TDD §8.1   | |
| T-283 | Enemy schema                                           | Game Engineer | P0 | GDD §8     | |
| T-284 | Item schema                                            | Game Engineer | P0 | GDD §9     | |
| T-285 | Floor template schema                                  | Game Engineer | P0 | TDD §7.1   | |
| T-286 | LACE line schema                                       | Game Engineer | P0 | TDD §9.2   | |
| T-287 | Organism name table schemas (prefix/trait/suffix)      | Game Engineer | P1 | UFD §3     | |
| T-288 | Cross-reference validator (mutation IDs in floors exist, etc.) | DevOps | P0 | TDD §14.1 | |

### S-7.2 — Prototype subset content (Gate 1)

| ID    | Title                                                  | Role     | Priority | Refs       | Notes |
| ----- | ------------------------------------------------------ | -------- | -------- | ---------- | ----- |
| T-289 | 5 Minor mutations per family × 5 families = 25 mutations | Director | P0 | GDD App A  | First Strand Event candidates |
| T-290 | Zone 1 enemies (5 + 1 boss)                            | Director | P0       | GDD §8.3   | |
| T-291 | Zone 1 floor templates (Floors 1–5)                    | Director | P0       | GDD §7.1   | |
| T-292 | ~15 Common-tier items                                  | Director | P0       | GDD §9.2   | |
| T-293 | Floor 0 tutorial template (4 rooms)                    | Director | P0       | TDD §21 Q4 | |
| T-294 | 4 Codex entries for Floor 0                            | Director | P0       | GDD §2.7   | |

### S-7.3 — Alpha content (Gate 2)

| ID    | Title                                                  | Role     | Priority | Refs       | Notes |
| ----- | ------------------------------------------------------ | -------- | -------- | ---------- | ----- |
| T-295 | Mutations: full Zones 1–2 (~40)                        | Director | P1       | GDD App A  | |
| T-296 | Enemies: Zones 1–2 with bosses                         | Director | P1       | GDD §8.3   | |
| T-297 | Items: Common + Uncommon full set                      | Director | P1       | GDD §9.2   | |
| T-298 | Floor templates: Zones 1–2 (Floors 1–10)               | Director | P1       | GDD §7.1   | |
| T-299 | 15 Sigma Strains implemented                           | Director | P1       | GDD §11.2  | |
| T-300 | 20 Codex entries for Zones 1–2                         | Director | P1       | GDD §2.7   | |
| T-301 | 5 Origins (default + 2 alpha-unlock)                   | Director | P1       | GDD §4.1   | |

### S-7.4 — Soft-launch content (Gate 3)

| ID    | Title                                                  | Role     | Priority | Refs       | Notes |
| ----- | ------------------------------------------------------ | -------- | -------- | ---------- | ----- |
| T-302 | All 66 mutations with full stat blocks                 | Director | P2       | GDD App A  | |
| T-303 | All 4 zones of enemies + bosses + Apex                 | Director | P2       | GDD §8.3   | |
| T-304 | All item tiers (Common + Uncommon + Rare + Legendary)  | Director | P2       | GDD §9     | |
| T-305 | All 20 floor templates                                 | Director | P2       | GDD §7.1   | |
| T-306 | All 30 Sigma Strains                                   | Director | P2       | GDD §11.2  | |
| T-307 | All 10 Origins                                         | Director | P2       | GDD §4.1   | |
| T-308 | All 10 Hybrid Synergies                                | Director | P2       | GDD §5.6   | |
| T-309 | All 5 Endings (Floor 20 Convergence)                   | Director | P2       | GDD §2.8   | |
| T-310 | All 80 base Codex entries (~6,400 words)               | Director | P2       | GDD §2.7   | |

### S-7.5 — Cursed items

| ID    | Title                                                  | Role     | Priority | Refs       | Notes |
| ----- | ------------------------------------------------------ | -------- | -------- | ---------- | ----- |
| T-311 | Cursed item schema + flagging                          | Game Engineer | P2 | GDD §9.3   | |
| T-312 | Hungry Blade, Void Eye, Fever Root (3 cursed at launch) | Director | P2     | GDD §9.3   | |

---

## E-8 — LACE Narrative System

**Scope:** Content production for LACE (engine itself lives in E-3 / S-3.5). Templated-default plan with writer hire as upgrade.

### S-8.1 — Templated fragment library (Director-authored — DR-004 default)

| ID    | Title                                                                 | Role     | Priority | Refs           | Notes |
| ----- | --------------------------------------------------------------------- | -------- | -------- | -------------- | ----- |
| T-313 | ~50 fragments for Prototype (Floor 0 + Floor 1 events)                | Director | P0       | TDD §9.5       | |
| T-314 | ~150 fragments for Alpha (Zones 1–2 coverage)                         | Director | P1       | TDD §9.5       | |
| T-315 | 400–500 fragments for Soft launch (full coverage)                     | Director | P2       | TDD §9.5       | Fallback if no writer signed |
| T-316 | LACE Critical hit pool (20 lines on player crit; 20 on player crit-hit) | Director | P1     | GDD §10.1      | |
| T-317 | LACE Death narrations (100 lines: 20 floors × 5 death_causes)         | Director | P1       | GDD §10.2      | |
| T-318 | LACE Boss pre/post-fight lines (48: 8 bosses × 6)                     | Director | P1       | GDD §10.2      | |
| T-319 | LACE Hub idle quips (50)                                              | Director | P1       | GDD §10.2      | |
| T-320 | LACE Floor-entry lines (100: 20 floors × 5 moods)                     | Director | P1       | GDD §10.2      | |

### S-8.2 — Writer engagement (DR-004 quality upgrade)

| ID    | Title                                                                 | Role     | Priority | Refs       | Notes |
| ----- | --------------------------------------------------------------------- | -------- | -------- | ---------- | ----- |
| T-321 | Source 2–3 candidate writers (Reddit r/gamewriting, indie network)    | Director | P1       | TDD §9.5   | |
| T-322 | Send writer brief (GDD Appendix D + voice principles + sample fragments) | Director | P1   | GDD App D  | |
| T-323 | Contract drafted + signed (1,000–1,500 lines, $5K–$10K)               | Director | P1       | TDD §9.5   | Month 4–6 window |
| T-324 | First 250 lines reviewed for voice alignment                          | Director | P1       | TDD §9.5   | Go/no-go gate |
| T-325 | Replace templated fragments with hand-crafted lines, file-by-file     | Director | P2       | TDD §9.5   | No engine change |

### S-8.3 — Codex content (Director-authored)

See T-294, T-300, T-310 in E-7. Codex stays in-house (Director's voice).

### S-8.4 — Voice acting (Season 2, deferred)

| ID    | Title                                                  | Role     | Priority | Refs           | Notes |
| ----- | ------------------------------------------------------ | -------- | -------- | -------------- | ----- |
| T-326 | Voice actor casting (Season 2)                         | Director | P4       | GDD §14.3      | Deferred — post-launch |
| T-327 | Recording session + line delivery                      | Director | P4       | GDD §14.3      | Deferred |

---

## E-9 — Monetization

### S-9.1 — Store screens (UFD Scope 6)

| ID    | Title                                                  | Role     | Priority | Refs       | Notes |
| ----- | ------------------------------------------------------ | -------- | -------- | ---------- | ----- |
| T-328 | S120 Store home (tabs: Pass / Cosmetics / Supporter)   | Frontend | P2       | UFD 06     | |
| T-329 | S121 Pass tab ("Manage" if subscriber)                 | Frontend | P2       | UFD 06     | |
| T-330 | S122 Cosmetics tab (Pass subs see "Included" badge)    | Frontend | P2       | UFD 06     | |
| T-331 | S123 Supporter pack tab                                | Frontend | P2       | UFD 06     | |
| T-332 | S124 Pass monthly confirm ($4.99/mo)                   | Frontend | P2       | UFD 06     | |
| T-333 | S125 Pass yearly confirm ($39.99/yr)                   | Frontend | P2       | UFD 06     | |
| T-334 | S126 Cosmetic pack detail (carousel)                   | Frontend | P2       | UFD 06     | |
| T-335 | S127 Purchase success (post server-side validation)    | Frontend | P2       | UFD 06     | |
| T-336 | S128 Purchase failed (3 retries within 10 min)         | Frontend | P2       | UFD 06     | |
| T-337 | S129 Restore purchases (always visible button)         | Frontend | P2       | UFD 06     | |
| T-338 | S130 Restored toast (auto-dismiss 3s)                  | Frontend | P2       | UFD 06     | |
| T-339 | S131 Nothing-to-restore toast                          | Frontend | P2       | UFD 06     | |
| T-340 | S135 Ad failed modal (no retry button)                 | Frontend | P1       | UFD 06     | |

### S-9.2 — AdMob integration

| ID    | Title                                                  | Role     | Priority | Refs       | Notes |
| ----- | ------------------------------------------------------ | -------- | -------- | ---------- | ----- |
| T-341 | AdMob account + ad units (rewarded only)               | Director | P1       | TDD §2.3   | |
| T-342 | Rewarded placement: revive                             | Frontend | P1       | GDD §15.2  | |
| T-343 | Rewarded placement: Strand reroll (1 card)             | Frontend | P1       | GDD §15.2  | |
| T-344 | Rewarded placement: merchant refresh                   | Frontend | P1       | GDD §15.2  | |

### S-9.3 — IAP catalogue

| ID    | Title                                                  | Role     | Priority | Refs       | Notes |
| ----- | ------------------------------------------------------ | -------- | -------- | ---------- | ----- |
| T-345 | App Store Connect SKU registration (Pass m/y + cosmetics + Shards) | Director | P2 | TDD §2.3 | |
| T-346 | Google Play Console SKU registration (same set)        | Director | P2       | TDD §2.3   | |
| T-347 | Server-side receipt validation in Cloud Function (T-272 above) | Backend | P2 | TDD §17.5 | NFR P6 |
| T-348 | Restore purchases flow                                 | Frontend | P2       | TDD §10.3  | |

### S-9.4 — Pass cosmetic content

| ID    | Title                                                  | Role     | Priority | Refs       | Notes |
| ----- | ------------------------------------------------------ | -------- | -------- | ---------- | ----- |
| T-349 | Pass LACE tone packs (3 variants)                      | Director | P2       | GDD §15.3  | |
| T-350 | Pass share-screen frames (5)                           | Director | P2       | GDD §15.3  | |
| T-351 | Pass run-end title cards (~10)                         | Director | P2       | GDD §15.3  | |
| T-352 | Pass Origin skins (1 per Origin)                       | Director | P2       | GDD §15.3, DR-006a | |
| T-353 | Pass Codex Archive entries (10 per season)             | Director | P2       | GDD §15.3, DR-006b | |

### S-9.5 — Cosmetic IAP content

| ID    | Title                                                  | Role     | Priority | Refs       | Notes |
| ----- | ------------------------------------------------------ | -------- | -------- | ---------- | ----- |
| T-354 | Sigma Archive Pack (3 cosmetic Origin skins, $1.99)    | Director | P2       | GDD §15.4  | |
| T-355 | LACE Tone Pack (2 variants, $2.99)                     | Director | P2       | GDD §15.4  | |
| T-356 | Organism Frame Pack (5 frames, $0.99)                  | Director | P2       | GDD §15.4  | |

---

## E-10 — Share Loop

### S-10.1 — Organism portrait generator

| ID    | Title                                                                 | Role     | Priority | Refs            | Notes |
| ----- | --------------------------------------------------------------------- | -------- | -------- | --------------- | ----- |
| T-357 | Compose final evolved character (player geometry + family overlays)   | Frontend | P1       | GDD §4.5, §12.8 | |
| T-358 | Render 1080×1920 vertical PNG (client-side)                           | Frontend | P1       | GDD §12.8       | |
| T-359 | Render 1080×1080 square PNG (client-side)                             | Frontend | P1       | GDD §12.8       | |
| T-360 | Performance: <2s generation; skeleton state if slower                 | Frontend | P2       | GDD §12.8       | NFR perf |
| T-361 | Frame composition per Pass status (free + Pass)                       | Frontend | P2       | GDD §12.8       | |

### S-10.2 — Share screens (UFD Scope 8)

| ID    | Title                                                  | Role     | Priority | Refs       | Notes |
| ----- | ------------------------------------------------------ | -------- | -------- | ---------- | ----- |
| T-362 | S140 Standard share                                    | Frontend | P1       | UFD 08     | |
| T-363 | S141 Daily share (shows global rank if leaderboard cached) | Frontend | P2  | UFD 08     | |
| T-364 | S142 Weekly share (top-100 badge if applicable)        | Frontend | P2       | UFD 08     | |
| T-365 | S143 Portrait gen surface                              | Frontend | P1       | UFD 08     | |
| T-366 | S144 Share screen UI (format toggle, frame, save, share, done) | Frontend | P1 | UFD 08  | |
| T-367 | S145 Frame selector (Pass frames blurred for non-subs) | Frontend | P2       | UFD 08     | |
| T-368 | S146 Save to camera roll (iOS Photo Add permission)    | Frontend | P1       | UFD 08     | |
| T-369 | S147 Saved toast (2s auto-dismiss)                     | Frontend | P1       | UFD 08     | |
| T-370 | S148 Permission denied (deep-link to OS Settings)      | Frontend | P1       | UFD 08     | |
| T-371 | S149 Native share sheet (OS-handled)                   | Frontend | P1       | UFD 08     | |
| T-372 | S150 Link copied toast                                 | Frontend | P1       | UFD 08     | |

### S-10.3 — Attribution & analytics

| ID    | Title                                                                 | Role     | Priority | Refs           | Notes |
| ----- | --------------------------------------------------------------------- | -------- | -------- | -------------- | ----- |
| T-373 | Branch.io free-tier account setup                                     | DevOps   | P2       | TDD §2.3, T3   | |
| T-374 | Per-share unique URL generation (deep-link)                           | Backend  | P2       | UFD 08         | |
| T-375 | UTM params on landing redirect                                        | Backend  | P2       | UFD 08         | |
| T-376 | `organism_share_tapped` → install attribution KPI                     | Backend  | P2       | GDD §19, §20.5 | Target >3% |
| T-377 | E040 region mismatch + E041 receipt validation logging                | Backend  | P2       | UFD 07         | |

### S-10.4 — Landing page

| ID    | Title                                                                 | Role     | Priority | Refs       | Notes |
| ----- | --------------------------------------------------------------------- | -------- | -------- | ---------- | ----- |
| T-378 | Static site at chosen domain (e.g. `strand.empathy.software`)         | Frontend | P2       | TDD §14.5  | |
| T-379 | Smart redirect by UA: mobile → store; desktop → demo                  | Backend  | P2       | UFD 08     | |
| T-380 | Email capture form (build Day-1 install spike list, Month 12 onward)  | Frontend | P2       | GDD §20.2  | |

---

## E-11 — Web Demo (TDD §21 Q5)

| ID    | Title                                                                 | Role     | Priority | Refs       | Notes |
| ----- | --------------------------------------------------------------------- | -------- | -------- | ---------- | ----- |
| T-381 | `DEMO_MODE` feature flag baked at build time per Vite entry           | DevOps   | P2       | TDD §21 Q5 | |
| T-382 | Gate floors > 2 in DEMO_MODE                                          | Game Engineer | P2 | TDD §21 Q5 | |
| T-383 | Disable IAP + ads in DEMO_MODE                                        | Game Engineer | P2 | TDD §21 Q5 | |
| T-384 | Disable save (fresh per session)                                      | Game Engineer | P2 | TDD §21 Q5 | |
| T-385 | "Get the app to descend further" CTA at demo end                      | Frontend | P2       | TDD §21 Q5 | |
| T-386 | "What I Became (Demo)" share with deep-link to mobile app             | Frontend | P2       | TDD §21 Q5 | |
| T-387 | Host at `strand.empathy.software/play` (or final domain post-T-7)     | DevOps   | P2       | TDD §21 Q5 | |
| T-388 | CI smoke test: production bundle asserts DEMO_MODE === false (T-32)   | DevOps   | P2       | TDD §14.2  | |

---

## E-12 — QA & Performance

### S-12.1 — Test infrastructure

| ID    | Title                                                  | Role     | Priority | Refs       | Notes |
| ----- | ------------------------------------------------------ | -------- | -------- | ---------- | ----- |
| T-389 | Vitest config + global fixtures                        | QA       | P0       | TDD §16.1  | |
| T-390 | 80% line coverage gate on `/core/`                     | QA       | P0       | TDD §16.1  | |
| T-391 | Run simulator (headless full-run replay with scripted inputs) | QA | P1     | TDD §16.2  | |
| T-392 | Mutation combination stress test (random N-mutation builds) | QA  | P1       | TDD §16.2  | |
| T-393 | Save-migration fixture suite (every prior schemaVersion → current) | QA | P1 | TDD §5.6   | |

### S-12.2 — Performance budgets

| ID    | Title                                                  | Role     | Priority | Refs       | Notes |
| ----- | ------------------------------------------------------ | -------- | -------- | ---------- | ----- |
| T-394 | Lighthouse CI gate (>=85) on web build                 | DevOps   | P1       | TDD §15    | |
| T-395 | Real-device test: iPhone X (60fps, 30fps min)          | QA       | P1       | TDD §15    | |
| T-396 | Real-device test: Android 10 mid-tier device           | QA       | P1       | TDD §15    | |
| T-397 | Memory profile: <300MB RAM under gameplay              | QA       | P1       | TDD §15    | |
| T-398 | Battery measurement: <8% per 30min                     | QA       | P2       | TDD §15    | |
| T-399 | Binary size budget: <80MB iOS, <80MB Android           | QA       | P2       | TDD §15    | |
| T-400 | Cold start <3s on target devices                       | QA       | P2       | TDD §15    | |

### S-12.3 — Manual playtest checklists (`/docs/qa/`)

| ID    | Title                                                  | Role     | Priority | Refs       | Notes |
| ----- | ------------------------------------------------------ | -------- | -------- | ---------- | ----- |
| T-401 | Checklist: 10 happy-path runs across 5 origins         | QA       | P1       | TDD §16.3  | |
| T-402 | Checklist: 5 deliberate-death runs (verify analytics)  | QA       | P1       | TDD §16.3  | |
| T-403 | Checklist: 3 background/foreground tests (mid-turn suspend) | QA  | P1       | TDD §16.3  | E010, E013 |
| T-404 | Checklist: airplane-mode session (offline)             | QA       | P1       | TDD §16.3  | E001-E003 |
| T-405 | Checklist: 30-min memory-leak session                  | QA       | P1       | TDD §16.3  | |

### S-12.4 — Early TestFlight (Month 6, R5 mitigation)

| ID    | Title                                                                 | Role     | Priority | Refs       | Notes |
| ----- | --------------------------------------------------------------------- | -------- | -------- | ---------- | ----- |
| T-406 | Build TestFlight package with full mutation visuals visible           | DevOps   | P1       | GDD §21.4 R5 | |
| T-407 | Submit to App Store rating review (surface body-horror rating early)  | Director | P1       | GDD §21.4 R5 | |

### S-12.5 — Beta testing

| ID    | Title                                                  | Role     | Priority | Refs       | Notes |
| ----- | ------------------------------------------------------ | -------- | -------- | ---------- | ----- |
| T-408 | Recruit 10–20 internal testers for Gate 1              | Director | P0       | GDD §21.2  | Gate 1 success measurement |
| T-409 | Recruit 50–100 closed-alpha testers for Gate 2         | Director | P1       | GDD §21.2  | |
| T-410 | TestFlight external + Play closed-beta channels        | DevOps   | P2       | TDD §14.5  | |

---

## E-13 — Launch Operations

### S-13.1 — Pre-launch community (Month 12–14)

| ID    | Title                                                  | Role     | Priority | Refs       | Notes |
| ----- | ------------------------------------------------------ | -------- | -------- | ---------- | ----- |
| T-411 | Open Reddit identity; first devlog post                | Director | P2       | GDD §20.2  | r/roguelites, r/SlayTheSpire, r/LitRPG, r/mobilegaming |
| T-412 | TouchArcade dev diary thread opened                    | Director | P2       | GDD §20.2  | |
| T-413 | Discord server opened (Month 13, target 500 members by launch) | Director | P2 | GDD §20.2 | |
| T-414 | TikTok creator outreach: 5–10 mid-tier creators (~50K–500K) | Director | P2 | GDD §20.2 | game access in exchange for one organic post |
| T-415 | Email-capture landing page live                        | DevOps   | P2       | GDD §20.2  | |

### S-13.2 — Store submissions

| ID    | Title                                                  | Role     | Priority | Refs       | Notes |
| ----- | ------------------------------------------------------ | -------- | -------- | ---------- | ----- |
| T-416 | Apple Indie Highlight submission package               | Director | P3       | GDD §20.2  | |
| T-417 | Google Play Indie Corner submission                    | Director | P3       | GDD §20.2  | |
| T-418 | App Store listing: screenshots per device class        | Director | P2       | —          | |
| T-419 | App Store listing: app previews (video)                | Director | P2       | —          | |
| T-420 | App Store listing: description + keywords + ASO        | Director | P2       | —          | |
| T-421 | App Store listing: privacy disclosures                 | Director | P2       | TDD §17.4  | |
| T-422 | Google Play listing: graphics, description, ASO        | Director | P2       | —          | |
| T-423 | Google Play Data Safety form submission                | Director | P2       | TDD §17.4  | |

### S-13.3 — Soft-launch UA test (Month 15, PH + CA)

| ID    | Title                                                  | Role     | Priority | Refs           | Notes |
| ----- | ------------------------------------------------------ | -------- | -------- | -------------- | ----- |
| T-424 | Apple Search Ads campaign — competitor keywords ($1,500) | Director | P2     | GDD §20.3      | "slay the spire", "pixel dungeon", "roguelite" |
| T-425 | TikTok promoted posts ($1,000)                         | Director | P2       | GDD §20.3      | |
| T-426 | Hold $500 reserve for surprise opportunity             | Director | P2       | GDD §20.3      | |
| T-427 | Measure organic CPI vs paid CPI                        | Director | P2       | GDD §21.2 Gate 3 | |
| T-428 | Validate share-rate (target >3% of share_tapped → install) | Director | P2   | GDD §20.5      | |

### S-13.4 — Press kit

| ID    | Title                                                  | Role     | Priority | Refs       | Notes |
| ----- | ------------------------------------------------------ | -------- | -------- | ---------- | ----- |
| T-429 | Logo + key art                                         | Director | P3       | —          | Geometric, on-brand |
| T-430 | Screenshots + GIFs                                     | Director | P3       | —          | |
| T-431 | Press release                                          | Director | P3       | —          | |
| T-432 | Press contacts: TouchArcade, Eurogamer mobile, RPS, Pocket Tactics | Director | P3 | GDD §20.4 | 3 weeks pre-launch outreach |

### S-13.5 — Global launch (Month 16+)

| ID    | Title                                                                 | Role     | Priority | Refs       | Notes |
| ----- | --------------------------------------------------------------------- | -------- | -------- | ---------- | ----- |
| T-433 | Channel mix re-baseline on soft-launch data                           | Director | P3       | GDD §20.4  | |
| T-434 | Editorial submission to App Store + Google Play (4 weeks pre-launch)  | Director | P3       | GDD §20.4  | |
| T-435 | Global release tag (vX.Y.Z) → CI builds .ipa + .aab → store upload    | DevOps   | P3       | TDD §14.3  | |
| T-436 | Day-1 monitoring dashboard (DAU, D1 retention, share rate, ARPDAU, crash rate) | Backend | P3 | GDD §19   | |

### S-13.6 — Season 1 content drop (Month 18+)

| ID    | Title                                                  | Role     | Priority | Refs       | Notes |
| ----- | ------------------------------------------------------ | -------- | -------- | ---------- | ----- |
| T-437 | Season 1 content plan + scope                          | Director | P4       | GDD §16    | |
| T-438 | Season 1 mutations / cosmetics / Codex bonus           | Director | P4       | GDD §15.3  | |
| T-439 | Season 1 weekly-challenge seeds for first 8 weeks      | Director | P4       | GDD §16.3  | |
| T-440 | Writer pass on templated LACE fragments (if writer didn't sign before launch) | Director | P4 | TDD §9.5 | |

---

## Cross-Epic Dependency Highlights

| Dependency                                          | Implication                                                                                  |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| T-7 (lock title) blocks T-41, T-42, T-45            | App Store account names + domain can't be finalized until trademark is clear                 |
| T-8/T-9 (age rating dry-run) blocks T-407           | TestFlight rating submission needs the questionnaire pre-flighted                            |
| E-3 (core) blocks E-4 (scenes)                      | Scenes can't be wired until the simulation produces stable RunState shapes                   |
| T-30 (determinism CI) blocks every E-3 merge        | Determinism gate must exist before turn-engine work goes through PR review                   |
| T-282–T-288 (schemas) block all content authoring   | Content authors need stable schemas before writing JSON                                      |
| T-289–T-294 (Prototype content) blocks Gate 1       | Without 25 mutations + 1 zone of enemies + Floor 0, the vertical slice can't be tested       |
| E-7 / E-8 content tasks block Gate-N transitions    | Each gate has its own content build order — see GDD §21 and Patch 12                         |
| T-407 (TestFlight rating submission) blocks E-13    | If rating returns >12+, GDD §1.5 and §1.6 need revisiting before launch ops scale up         |
| T-323 (writer contract) is parallel to T-313–T-315  | Director templated fragments ship regardless; writer is upgrade path (DR-004)                |

---

## Items Explicitly NOT in This Plan (Deferred Per Docs)

Per UFD §11 and GDD scope discipline — these are intentionally **not** broken into tasks at this stage:

- Web demo-specific UI screens beyond what TDD §21 Q5 specifies (Floors 1–2 only)
- Leaderboard detail screens (minimal in v1; expanded in Season 1)
- Friend system (not in v1)
- In-app event teasers (LiveOps content; Phase 5 work)
- Recovery phrase UX (deferred per TDD §11.1 / §10.1 to Season 2+)
- Season pass progression UI (no Season 1 at launch)
- Voice acting (Season 2 target — T-326/T-327 placeholders only)
- Localization beyond English (i18n architecture present; only `en` populated)

---

## Open Assumptions

| # | Assumption                                                                                       | How to confirm                                       |
| - | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------- |
| 1 | Atlassian Jira will be the issue tracker (workspace TBD — not the corporate `minditsoftware.atlassian.net`) | Director confirms personal workspace or alternate; this plan transfers to ADO with hierarchy re-mapping |
| 2 | Hierarchy = Epic → Story → Task → Sub-task (Jira default)                                        | Confirmed when tracker provisioned                   |
| 3 | All P0 tasks are Phase-1/Phase-2 work; P1 = Alpha; P2 = Soft launch; P3 = Global; P4 = Post-launch | Confirmed by GDD §21.1 schedule                      |
| 4 | Sub-tasks added later during sprint planning when individual tasks need decomposition            | Sprint-planning convention; this plan is the backbone |
| 5 | Story-point estimates added in a follow-up pass via `sa-toolkit:task-estimate`                   | Run that skill next if estimates are wanted          |
| 6 | Writer contract closes in Month 4–6; templated assembly is the default ship path                 | DR-004                                               |
| 7 | All Capacitor community plugins remain maintained through 18-month dev window                    | Monitor; alternate plugins identified as fallback if a plugin is abandoned |
| 8 | Branch.io free tier (≤10K MAU) covers attribution through soft launch                            | TDD §2.3; revisit if MAU approaches 10K              |

---

## Recommended Next Actions

1. **Provision an issue tracker** (Jira personal workspace or ADO) and confirm hierarchy mapping.
2. **Import this list** — task names and descriptions are intentionally written to round-trip cleanly to CSV/JSON.
3. **Run `/task-estimate`** from `sa-toolkit` for story-point estimates if useful for sprint planning.
4. **Execute the trademark search (T-1..T-7) in week 1** so that T-7 unblocks T-41 / T-42 / T-45 before Phase 2 begins.
5. **Kick off Phase 2 prototype work** once E-1 closeout items are done — the Phase 2 backlog starts at T-20 (repo bootstrap) and runs through ~T-300 (Alpha content) over Months 2–11.

---

## Document Footer

| Field      | Value                                                  |
| ---------- | ------------------------------------------------------ |
| Document   | Strand Descent — Task Plan                                     |
| Version    | 1.0                                                    |
| Owner      | Tudor Grigoriu / Empathy Software                      |
| Created    | 2026-05-27                                             |
| Status     | Pre-Production Lock — task source of truth             |
| Companions | docs/Strand Descent — Concept One-Pager.md, docs/Strand Descent — Game Design Document.md, docs/Strand Descent — Technical Design Document.md, docs/Strand Descent — User Flow — *.md, docs/Strand Descent — Economy.xlsx |
| Next       | Provision tracker + import; run `sa-toolkit:task-estimate` for story points |
