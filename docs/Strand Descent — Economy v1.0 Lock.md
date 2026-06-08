# Strand Descent — Economy v1.0 Lock (T-14)

| Field        | Value                                                         |
| ------------ | ------------------------------------------------------------- |
| Status       | **LOCKED — pre-prod-binding**                                 |
| Lock date    | 2026-06-08                                                    |
| Owner        | Tudor Grigoriu / Empathy Software (Director sign-off)         |
| Artifact     | `docs/Strand Descent — Economy.xlsx` (workbook **v1.1**)      |
| Covers       | T-11, T-12, T-13, T-14 (Story S-1.3 — Economy v1.0 review)    |
| Verdict      | 19 PASS / 1 WARN / 0 FAIL → **REVIEW**, WARN consciously accepted (see §5) |

This note is the binding record of the Economy v1.0 review and lock. It supersedes
the workbook README's self-reported "v1.0 FINAL / READY" status, which was
computed against a **superseded 30-floor campaign** (see §2). Numbers may still
tune during playtest, but the **structure and the baseline curves below are
fixed** and all gameplay code must reconcile to them.

---

## 1. What was reviewed

The workbook is a 14-sheet model (README → Assumptions → Player Stats / XP / Drop
Rates → Enemy Stats / Currencies / Run Pacing → Mutation Costs / IAP Catalog →
DAU & Revenue / Cost Projection → Pass Sensitivity → Validation Checks), ~2,200
formulas, driven entirely by the blue input cells on **Assumptions**.

- **T-11 (read-through of all tabs).** Done. The formula graph is internally
  consistent and the dependency chain (Assumptions → curves → currencies → IAP →
  revenue → validation) holds. No `#REF!`/`#DIV0!` errors.
- **T-12 (VC drop-rate sanity vs GDD §9.4).** Done — see §4.
- **T-13 (Pass conversion-sensitivity sanity).** Done — see §4.
- **T-14 (lock).** Done — this document.

---

## 2. Blocking defect found & corrected — campaign structure (30 → 20 floors)

The workbook as inherited modelled a **30-floor / 5-zone / 6-floors-per-zone /
boss-every-6** campaign (Assumption #1 cited "GDD v1.1 §3.2"). **The shipped game
is 20 floors / 4 zones / 5-floors-per-zone / boss-every-5**, per the current
authoritative sources:

- **GDD §6:** "The VEIN has 20 floors across **4 Zones of 5 floors each**."
- **Concept One-Pager:** "20 floors / 4 zones / 10 origins / 30 Sigma Strains."
- **Shipped content:** `packages/content/floors/floor_01..20.json`, zone-banded
  Shallows 1–5 / Mycosphere 6–10 / Lithic 11–15 / Convergence 16–20.
- **Autoplay balance harness** (`balance.test.ts`): 20 floors, bosses at zone ends.

Locking a "binding numeric source of truth" whose campaign length contradicts the
shipped game is not acceptable — every downstream total (VEIN/run, SIG/run, run
time, runs-to-kit, IAP value ratings, the revenue retention proxy) was computed
over the wrong number of floors.

**Correction (workbook v1.1, this commit):** `max_floor 30→20`, `zones_count
5→4`, `floors_per_zone 6→5`, `boss_every_n_floors 6→5`. Per-floor tables (Player
Stats, Drop Rates, Enemy Stats, Currencies, Run Pacing) truncated to 20 floors;
Enemy Stats bosses re-tiered to floors **5 / 10 / 15 / 20**; all SUM/AVERAGE/MAX
ranges and full-run totals repointed; README bumped to v1.1 with a version-history
entry; `fullCalcOnLoad` set so Excel/LibreOffice recomputes on open. **No
balance-curve, pricing, IAP, or business assumption was changed** — this is a pure
structure correction.

### 2a. Same defect found in shipped code — fixed

`apps/game/src/core/economy/pricing.ts` had propagated the stale assumption:
`FLOORS_PER_ZONE = 6`, so `zoneForFloor()` mis-mapped every floor past 5 (e.g.
floor 6 → zone 1 instead of zone 2; floor 11 → zone 2 instead of zone 3),
**under-charging the VEIN Dispenser by up to a full zone-tier deep in a run** — a
real economy leak. Every other module (floor content, `floors.content.test.ts`,
`xp.ts`) already used the correct 5-floor/4-zone bands; pricing was the lone
straggler. Fixed to `FLOORS_PER_ZONE = 5` with tests updated to assert the
canonical bands; `shards.ts` doc-comment corrected from the 30-floor VEIN total.

---

## 3. Locked baseline — headline numbers (20-floor model)

| Metric                              | v1.1 (20f) | prior v1.0 (30f) | Source |
| ----------------------------------- | ---------: | ---------------: | ------ |
| Total VEIN / full clear             | **3,232**  | 4,797.5          | Currencies E50 |
| Total SIG / full clear              | **115.6**  | 167.125          | Currencies F51 |
| Total Shards / full clear           | **16.16**  | 23.99            | Currencies I52 |
| Full-clear time (min)               | **99.9**   | 143.65           | Run Pacing I45 |
| Avg minutes / floor (target 5.0)    | **5.00**   | 4.79             | Run Pacing I47 |
| Avg turns-to-kill                   | **8.10**   | 7.5              | Enemy Stats F80 |
| Max turns-to-kill (deepest boss)    | **26**     | 26               | Enemy Stats F81 |
| Zone bosses (floor, TtK)            | 5·26, 10·25, 15·24, 20·23 | — | Enemy Stats |
| Full mutation kit (one of each → Mk III) | **1,479 SIG** | 1,479 | Mutation Costs |
| Runs to full kit                    | **13**     | 9                | Mutation Costs F23 |

The shorter campaign is *healthier* for the grind economy: SIG/run drops, pushing
runs-to-full-kit from 9 → **13** (still inside the 5–20 design band, better IAP
motivation), while average floor time lands dead on the 5.0-minute target.

---

## 4. T-12 / T-13 sanity checks

**T-12 — VC drop rates (GDD §9.4).** Per-kill VEIN (grunt 8 / elite 25 / boss 120)
× expected kills/floor (8 commons + 1.5 elites, boss floors halve commons) + the
50-VEIN floor-clear constant reproduces the Currencies PER-FLOOR INCOME column and
matches `core/economy/drops.ts` (`VEIN_PER_KILL`, `FLOOR_VEIN_CONSTANT`,
`expectedFloorVein`) exactly. One full clear (3,232 VEIN) buys **6.5× a $0.99 VEIN
pack** — free play earns meaningfully, drops are not stingy. ✔

**T-13 — Pass conversion sensitivity.** The Deep Signal Pass ($9.99) is the best
minutes-saved-per-dollar SKU in the catalogue (**37.1** vs the next-best 23.2) and
sits in the $5–$15 battle-pass band. Pass Sensitivity tab: at the conservative M6
cohort (322 payers), monthly Pass revenue spans $450 (20% attach @ $9.99) to
$4,506 (80% @ $24.99); planning baseline is 40% attach @ $9.99. Pessimistic 1.5%
conversion remains the planning floor (Assumptions conversion_pct_pess = 2% is the
modelled low case). ✔

---

## 5. Validation result & the one accepted WARN

Re-running the workbook's own 20 validation checks against the corrected model:
**19 PASS / 1 WARN / 0 FAIL → REVIEW.**

The single WARN is **Check #5 — average turns-to-kill = 8.10**, marginally over the
3–8 "tactical sweet spot" ceiling (the check FAILs only above 12). It is
**consciously accepted, not blocking**, for two reasons:

1. **It is a coarse proxy.** The sheet's TtK = `enemy_HP / player_base_damage`
   with **no RES mitigation, no mutations, and no equipment** — all of which
   shorten real fights. It overstates in-game TtK by construction.
2. **The authoritative difficulty gate is elsewhere.** Shipped combat difficulty
   is governed by the **autoplay balance harness** (`balance.test.ts`), which was
   tuned and validated this development cycle (clear-rate curve F1 98% → F5 68% →
   F10 18% → F20 0%). That is the binding difficulty signal; the economy lock
   binds the **economy** (currencies, costs, IAP, revenue), all of which PASS.

The threshold itself was **not** altered to force a green light (the workbook
README explicitly forbids editing a formula to make the answer prettier). 8.10 vs
8.00 is a 1.25% margin and is owned here rather than papered over.

---

## 6. Code ↔ sheet reconciliation (binding)

| Domain        | Sheet driver(s)                                   | Code (`core/economy/…`)                | Status |
| ------------- | ------------------------------------------------- | -------------------------------------- | ------ |
| Campaign      | max_floor 20, zones 4, floors_per_zone 5, boss/5  | `pricing.ts` FLOORS_PER_ZONE = 5; floor content; `xp.ts` cap 20 | ✔ aligned (was the defect) |
| VEIN drops    | grunt 8 / elite 25 / boss 120; floor const 50     | `drops.ts` VEIN_PER_KILL, FLOOR_VEIN_CONSTANT | ✔ |
| Drop rates    | grunt/elite/boss SIG/mod/rare/epic probabilities  | `drops.ts` DROP_RATES                  | ✔ |
| Shards        | shard_per_vein_conversion 0.005                   | `shards.ts` SHARD_PER_VEIN             | ✔ |
| Dispenser     | rarity scale 1 / 2.5 / 6 / 15; zone growth        | `pricing.ts` RARITY_VEIN_MULT, ZONE_PRICE_GROWTH | ✔ |
| Mutation cost | base 10, ×1.8/level, rarity 1/2.5/6/15            | mutation cost system (S-3.4)           | ✔ |
| XP curve      | xp_base 100, growth 0.15                           | `xp.ts` XP_BASE, XP_GROWTH             | ✔ |

Daily-run (+5) and achievement (+10) shard bonuses and the Dispenser base price
(40 VEIN) / zone growth (0.5) are **authored in code, not enumerated in the
sheet** (no item-price tab); they are flagged as such in the source and carried
forward into the lock.

---

## 7. Open items carried past the lock (non-blocking)

- **Conditional-format heat maps / comments** in the workbook are preserved by the
  edit. The Director should open the v1.1 workbook once in Excel to let it
  recompute (fullCalcOnLoad is set) and re-save to Drive, bumping the Drive copy.
- **Check #5 WARN** (avg TtK 8.10) — revisit only if playtest shows mid-run fights
  dragging; the balance harness, not this proxy, is the trigger.
- The yellow `shard_per_vein_conversion = 0.005` cell remains a director-tunable
  assumption; locked at 0.005 for v1.0.

**Economy v1.0 is locked as pre-prod-binding on the corrected 20-floor / 4-zone
structure.**
