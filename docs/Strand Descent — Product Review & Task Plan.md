# Strand Descent — Product & Code Review with Task Plan

| Field | Value |
| --- | --- |
| Reviewer role | Solution Architect / Mobile Game Entrepreneur (external review) |
| Review date | 2026-06-09 |
| Inputs | Full doc set (GDD/TDD/Economy Lock/UFD 00–08) + repository `tudorgrigoriu90/helix` @ `76cbea1` |
| Companion | Decision Records **DR-007 → DR-011** (locked 2026-06-09, applied to the docs in this PR) |
| Status of this document | Living — issues close as tasks complete; new findings append |

This document consolidates (1) the product-direction review, (2) the repository code review, and (3) a comprehensive task plan per issue. Decisions DR-007–DR-011 were made in review session on 2026-06-09 and are **already applied** to the GDD, TDD, Economy Lock, and UFDs 02/04/06 in this same change set — tasks below reference them as locked.

---

## Part 1 — Executive Assessment

### 1.1 Product direction: right bet, corrected shape

Strand Descent's core is genuinely differentiated: a deterministic, planning-first tactical roguelite where identity transformation ("What You Became") is simultaneously the product, the share unit, and the UA engine, narrated by LACE — a reactive personality no mobile competitor has. The documentation discipline (decision records, gate criteria with kill thresholds, cost guardrails, determinism as a first-class requirement, honest pessimistic-anchor revenue modeling) is top-5% of solo-dev projects.

Three structural problems were found and **resolved by decision** on 2026-06-09:

1. **Run length vs. session promise** — docs claimed 20–45-minute runs; the locked economy proved ~100 minutes, with the first Strand Event ~25 minutes in. → **DR-009**: act-based descent (each Zone is a ~25-min session-complete act with checkpoints after Strand Events) + **DR-009b** Floor 2 Proto-Strand so the first build choice lands inside 10 minutes.
2. **Meta-progression schism** — the Economy workbook modeled SIG-as-currency with mutation purchase/upgrade; the GDD modeled free in-run drafts. → **DR-007**: draft-only locked. (Repo review confirmed the *code already implements draft-only* — see §2.2 — making this the cheapest possible resolution.)
3. **Boss cadence undefined** — docs simultaneously implied 20, 8, and 4 bosses. → **DR-008**: boss-per-floor via two tiers — 16 Floor Bosses + 4 Zone Wardens (5/10/15/20). (Repo review confirmed all 20 bosses *already exist as authored content* — DR-008 reclassifies rather than commissions.)

Monetization integrity (**DR-010**: $4.99 pass, no purchasable VEIN, ad-only revive, Shards cosmetics-only) and build-order discipline (**DR-011**: live-ops deferred post-Gate-2; share pipeline pulled into Gate-1 scope; Supporter Pack defined at $9.99) complete the set.

### 1.2 Code review verdict

**The codebase is in better shape than the documents were.** 143 source files / 106 test files, a clean `core/` with no Phaser/browser imports detected, no `Math.random`/wall-clock in deterministic paths (the two `Date.now` uses are a debug log and an injected-clock ad service — both correct patterns), seeded RNG threaded explicitly, save schema versioning present, and a CI pipeline that already enforces lint, typecheck, tests, an **80% core coverage gate**, a **100-seed determinism replay**, and content-schema validation. That CI determinism gate is the single most valuable asset in the repo.

Material findings (each is a task in Part 2):

- **F1 — Dead SIG-drop code** (`core/economy/drops.ts`): `DROP_RATES` rolls a SIG bonus drop per kill (`grunt 0.2 / elite 0.65 / boss 1.0`) whose result is **never consumed anywhere** in the codebase. The runtime already implements the DR-007 draft-only model (`core/mutation/sig.ts`: `sigBonus` grants, `SIG_CAP = 40`, run-scoped); the drop roll is a vestige of the abandoned currency model. It also silently advances the loot RNG stream, so removing it is a determinism-affecting change that must go through the replay gate.
- **F2 — Boss economy over-pay** (`drops.ts`): `VEIN_PER_KILL.boss = 120` applies to **all 20** per-floor bosses, while the locked workbook modeled boss income at zone ends only. The v1.1 T-12 "matches code exactly" reconciliation matched per-kill values but not the kill mix. DR-008's tier split (`floor_boss: 45` / `zone_warden: 120`) fixes the code side; workbook v1.2 fixes the model side.
- **F3 — Doc/code field-name drift**: TDD §8.1 documented `sigCost`; shipped code and all 25 mutation JSONs use `sigBonus`. Docs are aligned to `sigBonus` in this PR; the content validator should reject `sigCost`/`sigGrant` aliases to prevent regression.
- **F4 — Single `boss` tier in types**: `shared-types/enemy.ts` has one boss tier; DR-008 requires `floor_boss` / `zone_warden`, which fans out into `drops.ts`, loot guarantees, the LACE treatment switch, `boss_engaged`/`boss_defeated` analytics params, and the balance harness.
- **F5 — Harness thresholds are inequalities, not bands**: `balance.test.ts` asserts `F1 ≥ 0.9`, `F5 ≥ 0.2`, `F20 ≤ 0.3` — there is **no lower bound on Floor-20 clears**, so "endings unreachable" (clear rate ~0) passes CI. Five endings, Convergence, and Prestige content are gated behind F20.
- **F6 — DR-009 surface absent (expected)**: no checkpoint state, Proto-Strand trigger, or Continue-Descent surface exists yet (`run-session.ts` has neither) — net-new work, sized small by design.
- **F7 — Monetization not yet in code (good timing)**: no IAP catalog, pass price, or shard-revive branch exists in the codebase, so DR-010 lands as *requirements on unbuilt code* rather than rework. `run-session.ts` `revive()` already implements the 50%-HP/enemy-reset mechanics with no payment coupling — exactly the right seam.
- **F8 — `run-session.ts` at 881 lines** exceeds the TDD §18.1 300-line convention; it is the god-object risk in an otherwise well-factored core.

---

## Part 2 — Task Plan per Issue

Priorities: **P0** decide/fix now · **P1** before Gate 1 · **P2** before Gate 2/alpha · **P3** before soft launch. Tasks are numbered **T-500–T-544** (renumbered 2026-06-11: this series originally started at T-300, but the root plan already uses T-300–T-449, so the original numbering collided; the last two digits are preserved for traceability, e.g. old T-300 → T-500). The series is reconciled into `Strand Descent — Task Plan.md` **Epic E-14**, which is the single tracking source — status updates happen there, not here.

### Workstream A — Decision propagation into code (DR-007/008)

**T-500 [P1] Remove the dead SIG bonus-drop (F1, DR-007).**
Delete `sig` from `DROP_RATES` and the `BonusDrops` result in `core/economy/drops.ts`; delete the corresponding workbook columns (with T-521). Because the roll consumes `rng.loot`, this **shifts the loot RNG stream** — run the 100-seed determinism replay and re-baseline the fixture expectations in the same PR; never land it silently. AC: no `sig` in drops module; determinism suite green on re-baselined fixtures; grep for consumers returns none (already true).

**T-501 [P1] Tier split `boss` → `floor_boss` / `zone_warden` (F4, DR-008).**
Update `shared-types/enemy.ts`; migrate the 20 boss JSONs (`schemaVersion` bump + loader migration): floors 5/10/15/20 (`leviathan_hatchling`, `the_great_mycelium`, `the_mountains_heart`, `the_convergence`) → `zone_warden`, the other 16 → `floor_boss`. Content validator asserts exactly 4 wardens, on exactly those floors. AC: `pnpm validate` enforces the invariant; typecheck clean across the fan-out.

**T-502 [P1] Economy split per tier (F2, DR-008).**
`VEIN_PER_KILL`: `floor_boss: 45`, `zone_warden: 120`. Loot guarantees: floor_boss 1× Uncommon+; zone_warden 2× incl. 1 Rare+. AC: `expectedFloorVein` reflects a boss kill on every floor; unit tests assert both tiers; reconciliation test (T-522) pins values to the lock file.

**T-503 [P2] Warden treatment pass.**
3-phase bespoke patterns for the 4 Wardens (66/33% thresholds), 14×14 arena, hand-written LACE pre/post lines, dominant-family reaction hook. Floor Bosses keep the generic 2-phase template (50% threshold) + templated LACE fragments. AC: phase behavior unit-tested per Warden; LACE lines pass the voice linter (T-530).

**T-504 [P1] Re-run the balance harness post-T-500/302 and re-publish the clear-rate curve.**
Boss-per-floor at corrected drops changes both difficulty and income. AC: curve published as a CI artifact; §3 of the Economy Lock annotated with the new provisional totals.

### Workstream B — DR-009 implementation (run structure + early hook)

**T-510 [P1] Descent checkpoints.**
`RunState.checkpoint: {floor, act} | null`; S072 Descend/Rest choice after Strand Events (and after S071 Intermission; not after the F20 Warden); Hub "Continue Descent" card (organism render, mutations, "Act N — Zone"); save `schemaVersion` bump + migration + fixture test. Rules: pause-only, one suspended run, never expires. AC: UFD 02/04 amendments implemented verbatim; resume lands at a fresh floor entrance.

**T-511 [P1] Proto-Strand (DR-009b).**
Deterministic trigger after the Floor 2 boss room: 2 Minor cards via `rng.mutationdraw`, uniform family draw, no reroll, fills the bonus mutation slot (shared with the LACE event-room mutation — `sigBonusFor` source handling already supports the +5 path). LACE event-room "early adaptation" option swaps to +40 VC when the slot is taken. AC: run simulator shows time-to-first-mutation-choice < 10 min; cap math test: max SIG 35.

**T-512 [P1] LACE `resume_recap` trigger context** — one-line situational recap on any resume (checkpoint or mid-floor). AC: trigger fires exactly once per resume; lines pass voice linter.

**T-513 [P2] New analytics events** — `proto_strand_*`, `descent_checkpoint_*`, `descent_resumed {act_n, hours_since_suspend}`, `boss_tier` param on boss events; add to the typed `EventSchema` so misuse is a compile error (pattern already in place).

### Workstream C — Code quality & guardrails

**T-520 [P2] Decompose `run-session.ts` (F8)** along its existing seams (checkpoint/save, economy hooks, combat orchestration) to honor the 300-line convention before T-510 makes it bigger. AC: no behavior change (determinism replay green); each extracted module < 300 lines.

**T-521 [P1] Workbook v1.2** — delete Mutation Costs tab and SIG columns (DR-007); model boss-per-floor kill mix at split rates (DR-008); re-price Pass tabs at $4.99 with a cosmetic-attach model replacing minutes-saved (DR-010); delete the VEIN-pack SKU row; restate runs/day as acts/day (DR-009); recompute §3 headline totals and re-lock.

**T-522 [P1] Economy↔lock reconciliation test** — export workbook driver cells to a checked-in `economy-lock.json`; Vitest asserts code constants equal it. Closes the F2 class of silent drift permanently.

**T-523 [P2] Canonical `campaign.ts`** — single source for MAX_FLOOR / ZONES / FLOORS_PER_ZONE / WARDEN_FLOORS / `zoneForFloor()`; content validator asserts floor JSONs agree. (The historical FLOORS_PER_ZONE=6 defect class.)

**T-524 [P1] Harness band thresholds (F5)** — replace `APEX_CLEAR_MAX`-only with a band: F20 clear rate within [0.02, 0.30] for the competent policy (tune the floor of the band as the policy improves; intent: endings must be *reachable*, not just not-trivial). AC: CI fails on 0% F20.

**T-525 [P3] Validator rejects `sigCost`/`sigGrant` aliases (F3)** and any future re-introduction of SIG-as-cost fields.

### Workstream D — DR-010/011 requirements on upcoming code

**T-530 [P1] LACE voice linter** (`tools/validate-lace.ts`): bans exclamation marks, command-mood openings, "Good job/You died/try again/tap/button/screen", contraction-frequency threshold; wired into `pnpm validate`. Fix the GDD §18.6 tutorial lines that violate the bible ("Walk to the door", "Choose. Quickly.").

**T-531 [P1] Share pipeline in prototype scope (DR-011)**: `build-share-image.ts`, name generator (tables already in `packages/content/organism-names/`), ShareScene, share adapter; 1080×1920 + 1080×1080 client-side < 2 s. Gate-1 testers must be able to share.

**T-532 [P3] Store/IAP implementation per DR-010**: pass at $4.99/$39.99; catalog = 3 cosmetic packs + $9.99 "First Descent" Supporter Pack; **no VEIN SKU**; revive flow ad-only with hidden-offer fallback (E030/E031); receipt validation server-side. Validate the Capacitor IAP *subscription* path in sandbox by Month 6 (community-plugin risk).

**T-533 [P2] Deferral enforcement (DR-011)**: `dailySignal.ts` / `weeklyChallenge.ts` functions, leaderboards (incl. the replay-validation anti-cheat submission path — design doc due before build), and Prestige stay unbuilt until post-Gate-2; Hub entry points hidden behind their Remote Config flags.

### Workstream E — Carried product/growth issues (unchanged from review, unresolved)

**T-540 [P2] Branch.io scale cliff** — free tier ends at 10K MAU vs 25K-DAU target; budget the paid tier or spec the store-native-attribution fallback; build share URLs behind a swappable adapter.
**T-541 [P2] `runs_anon` write validation** — staged writes + Cloud Function validation + server-derived organism names + per-UID caps (Sigma Echo poisoning + write-cost surface; current `firestore.rules` to be audited in the same task).
**T-542 [P2] Leaderboard submission path + replay anti-cheat** — `(seed, input_log)` submissions re-simulated with shared `core/` (the determinism dividend); scheduled with the DR-011 deferral window.
**T-543 [P2] LACE corpus re-budget** — 66 mutations (commentary 132 / reactions ~198) + DR-008 boss treatment counts; update the writer-contract SOW.
**T-544 [P3] Compliance pass** — Privacy Manifest, Play Data Safety, EU consent gating AdMob init, ATT decision with eCPM impact modeled, PEGI/ESRB body-horror visuals via the Month-6 TestFlight.

---

## Part 3 — Decision Register (applied in this change set)

| DR | Decision | Doc edits in this PR | Code tasks |
| --- | --- | --- | --- |
| DR-007 | Draft-only meta-progression; `sigBonus` canonical; SIG run-scoped, cap 40 | GDD §4.2/§5/App-A/history · TDD §8 · Economy Lock §1/§3/§6/§7 | T-500, T-521, T-522, T-525 |
| DR-008 | Two-tier boss-per-floor: 16 Floor Bosses + 4 Zone Wardens | GDD §3.2/§7.4/§8.2–8.4a/§9.4/§10.2/§19 · TDD DR table · Economy Lock amendments | T-501–T-504 |
| DR-009/b | Act-based descent + checkpoints + Floor 2 Proto-Strand | GDD §1.7/§1.9/§3/§4.2/§5.4/§7.3/§19 · UFD 02/04 amendments · TDD DR table | T-510–T-513, T-520 |
| DR-010 | $4.99 pass; no VEIN SKU; ad-only revive; Shards cosmetics-only | GDD §6.7/§15.4/§15.5 · UFD 02 (S033) / UFD 06 · Economy Lock §4/amendments | T-521, T-532 |
| DR-011 | Live-ops deferred post-Gate-2; share pipeline → Gate-1; $9.99 Supporter Pack | GDD §15.4/§16 note · TDD §21/§22 · UFD 02/06 amendments | T-531, T-533 |

## Part 4 — What was NOT changed (and why)

- **No code is modified in this PR.** T-500/T-501 alter the RNG stream and the type system respectively; they belong in their own PRs gated by the determinism replay, not bundled with a documentation change set.
- **`Strand Descent — Task Plan.md` (root)** is untouched; T-500–T-544 should be reconciled into it (or Jira) as the next planning action so T-numbering stays single-sourced. *(Done 2026-06-11 — the series was renumbered from T-3xx to T-5xx to clear the collision with the root plan's existing T-300–T-449 and imported as Epic E-14; the root plan tracks status from here on.)*
- **The Economy workbook (`.xlsx`)** is not in the repo; v1.2 (T-521) happens at its home and re-locks against this doc set.
