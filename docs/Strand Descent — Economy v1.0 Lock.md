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

> **AMENDMENT — DR-007 (2026-06-09).** The meta-progression model is locked to the
> **GDD draft-only model**: mutations are free in-run draft picks; **SIG is an
> in-run resonance stat (cap 40), granted only by acquired mutations, and resets
> on death**. SIG is **not** a persistent currency, is **not** dropped by enemies,
> and is **not** spent to unlock or upgrade mutations. All SIG-as-currency and
> mutation-cost modelling in this lock and in workbook v1.1 (Mutation Costs tab,
> SIG drop columns, "runs-to-full-kit") is **superseded** — see strikethrough
> markers in §3/§6 below. Workbook v1.2 must remove the Mutation Costs tab and
> SIG income columns; until then, those tabs are non-binding. Permanent
> progression is Sigma Strains + cosmetics + Codex only (GDD §11.2).

> **AMENDMENT — DR-008 (2026-06-09).** Boss cadence is locked to **boss-per-floor
> via a two-tier system**: 16 template-composed Floor Bosses + 4 Zone Wardens at
> floors 5/10/15/20. The Currencies model in workbook v1.1 assumed bosses only at
> zone ends ("boss floors halve commons", boss kill = 120 VEIN). Under DR-008 a
> **Floor Boss drop tier is added (provisional 45 VEIN; Wardens stay at 120)**,
> **Repo-review note (2026-06-09):** shipped content already has a boss on every
> floor (20 `bossId`s, 20 boss enemy JSONs) and `drops.ts` pays them ALL the flat
> `boss: 120` rate — i.e. the live code over-pays 16 Floor Bosses relative to the
> workbook's zone-end-only model, and the v1.1 T-12 reconciliation matched
> per-kill *values* but not the kill mix. DR-008 fixes both sides: tier split
> `floor_boss: 45` / `zone_warden: 120` in `drops.ts`, and workbook v1.2 models a
> boss kill on every floor. **The §3 headline VEIN figures are stale pending the
> v1.2 recompute**; all other locked curves are unchanged. Loot guarantees
> re-tier per GDD §9.4 (Floor Boss 1× Uncommon+; Warden 2× incl. 1 Rare+).

> **AMENDMENT — DR-009 (2026-06-09).** Act-based descent (session = one ~25-min
> act; checkpoints after Strand Events) changes **session packaging only** — no
> per-floor income, pricing, or curve changes. The Proto-Strand (+5 SIG, Floor 2)
> fits within the existing cap-40 math (max in-run SIG = 35). One modelling note
> for workbook v1.2: any DAU/retention assumption expressed as "runs per day"
> should be restated as **acts per day** (a full run now spans multiple sessions
> by design); the run-pacing 5.0 min/floor target is unchanged and remains the
> binding number.

> **AMENDMENT — DR-010 (2026-06-09). Monetization integrity batch.** (1) Deep
> Signal Pass locked at **$4.99/mo / $39.99/yr** — the workbook's $9.99 model and
> 40%-attach baseline are superseded (see §4 T-13). (2) The **$0.99 VEIN pack SKU
> is deleted** — VEIN Crystals are never purchasable (GDD §15.5 pledge holds).
> (3) **Revive is rewarded-ad only** — the 75-Shard revive is removed; Shard
> Crystals are a cosmetics-only currency. IAP catalogue tab and revenue scenarios
> to re-run in workbook v1.2 (expect a small mix shift from IAP to ad revenue on
> the revive moment; scenario totals were never materially driven by the deleted
> SKUs).

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

> **Clear-rate curve (T-504, published 2026-06-11).** The CI balance harness
> now publishes the measured clear-rate curve as a build artifact
> (`clear-rate-curve.json`, uploaded per run from `balance.test.ts`). Current
> measured curve at the locked tuning (post T-502 boss-economy split, T-511
> Proto-Strand, T-524 scaling retune): **F1 98% · F5 98% · F10 73% · F15 33% ·
> F20 20%** — Floor 20 inside the enforced [2%, 30%] band, so the five endings
> are reachable. The **VEIN headline totals below remain stale pending the
> workbook v1.2 recompute (T-521)**; per-kill VEIN drivers are already
> machine-pinned to code via `economy-lock.json` (T-522).

| Metric                              | v1.1 (20f) | prior v1.0 (30f) | Source |
| ----------------------------------- | ---------: | ---------------: | ------ |
| Total VEIN / full clear             | **3,232**  | 4,797.5          | Currencies E50 |
| ~~Total SIG / full clear~~          | ~~115.6~~  | ~~167.125~~      | **SUPERSEDED by DR-007** — SIG is in-run only, max 40 (GDD §4.2) |
| Total Shards / full clear           | **16.16**  | 23.99            | Currencies I52 |
| Full-clear time (min)               | **99.9**   | 143.65           | Run Pacing I45 |
| Avg minutes / floor (target 5.0)    | **5.00**   | 4.79             | Run Pacing I47 |
| Avg turns-to-kill                   | **8.10**   | 7.5              | Enemy Stats F80 |
| Max turns-to-kill (deepest boss)    | **26**     | 26               | Enemy Stats F81 |
| Zone bosses (floor, TtK)            | 5·26, 10·25, 15·24, 20·23 | — | Enemy Stats |
| ~~Full mutation kit (one of each → Mk III)~~ | ~~1,479 SIG~~ | ~~1,479~~ | **SUPERSEDED by DR-007** — no mutation purchase/upgrade system |
| ~~Runs to full kit~~                | ~~13~~     | ~~9~~            | **SUPERSEDED by DR-007** |

~~The shorter campaign is *healthier* for the grind economy: SIG/run drops, pushing
runs-to-full-kit from 9 → **13** (still inside the 5–20 design band, better IAP
motivation), while average floor time lands dead on the 5.0-minute target.~~

**(Superseded by DR-007.)** Under the draft-only model there is no runs-to-kit
grind metric. The surviving claim is: average floor time lands dead on the
5.0-minute target. Long-horizon pull is carried by Sigma Strains, Origin
unlocks, and the Codex — pacing for those unlocks replaces the kit grind as the
retention model in workbook v1.2.

---

## 4. T-12 / T-13 sanity checks

**T-12 — VC drop rates (GDD §9.4).** Per-kill VEIN (grunt 8 / elite 25 / boss 120)
× expected kills/floor (8 commons + 1.5 elites, boss floors halve commons) + the
50-VEIN floor-clear constant reproduces the Currencies PER-FLOOR INCOME column and
matches `core/economy/drops.ts` (`VEIN_PER_KILL`, `FLOOR_VEIN_CONSTANT`,
`expectedFloorVein`) exactly. ~~One full clear (3,232 VEIN) buys **6.5× a $0.99 VEIN
pack**~~ **(VEIN pack SKU deleted per DR-010 — VEIN Crystals are not purchasable,
GDD §15.5).** Free-play earn rates remain generous: a full clear funds roughly
6–7 full Dispenser kits at Zone-1 prices — drops are not stingy. ✔ *(per-kill
mix updated by DR-008 — see amendment above)*

**T-13 — Pass conversion sensitivity.** ~~The Deep Signal Pass ($9.99) is the best
minutes-saved-per-dollar SKU in the catalogue (**37.1** vs the next-best 23.2) and
sits in the $5–$15 battle-pass band. Pass Sensitivity tab: at the conservative M6
cohort (322 payers), monthly Pass revenue spans $450 (20% attach @ $9.99) to
$4,506 (80% @ $24.99); planning baseline is 40% attach @ $9.99.~~ **SUPERSEDED by
DR-010:** the Pass is locked at **$4.99/mo / $39.99/yr** (GDD §15.3 / UFD
S124-S125). The "minutes-saved-per-dollar" SKU metric is retired (the Pass sells
cosmetics and lore, never time or power — DR-007/GDD §15.3); workbook v1.2
replaces it with a cosmetic-attach model (drivers: share frequency / frame
visibility, codex completion, LACE tone identity) and re-runs Pass Sensitivity at
$4.99 with attach derived from the GDD §15.6 conversion band (1.5–2.5% of DAU).
Pessimistic 1.5% conversion remains the planning floor. ✔ (structure), ⚠ (numbers
pending v1.2)

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

> **Machine-checked since 2026-06-11 (T-522).** The driver cells in this table
> are exported to `packages/content/economy-lock.json`, and
> `core/economy/economy-lock.test.ts` (wired into `pnpm validate` + CI) asserts
> the shipped code constants equal it. The table below stays as the human
> rationale; the JSON is the binding artifact — re-export it whenever the
> workbook re-locks.

| Domain        | Sheet driver(s)                                   | Code (`core/economy/…`)                | Status |
| ------------- | ------------------------------------------------- | -------------------------------------- | ------ |
| Campaign      | max_floor 20, zones 4, floors_per_zone 5, boss/5  | `pricing.ts` FLOORS_PER_ZONE = 5; floor content; `xp.ts` cap 20 | ✔ aligned (was the defect) |
| VEIN drops    | grunt 8 / elite 25 / floor_boss 45 / zone_warden 120; floor const 50 | `drops.ts` VEIN_PER_KILL, FLOOR_VEIN_CONSTANT | ✔ aligned in code (T-502, 2026-06-11); sheet row pending v1.2 (T-521) |
| Drop rates    | grunt/elite/boss mod/rare/epic probabilities (**SIG drop columns removed per DR-007**) | `drops.ts` DROP_RATES | ✔ SIG entries deleted in code (T-500, 2026-06-11); sheet columns pending v1.2 (T-521) |
| Shards        | shard_per_vein_conversion 0.005                   | `shards.ts` SHARD_PER_VEIN             | ✔ |
| Dispenser     | rarity scale 1 / 2.5 / 6 / 15; zone growth        | `pricing.ts` RARITY_VEIN_MULT, ZONE_PRICE_GROWTH | ✔ |
| ~~Mutation cost~~ | ~~base 10, ×1.8/level, rarity 1/2.5/6/15~~    | ~~mutation cost system (S-3.4)~~       | **SUPERSEDED by DR-007 — system removed; mutations grant +10 SIG flat in-run (GDD §4.2)** |
| XP curve      | xp_base 100, growth 0.15                           | `xp.ts` XP_BASE, XP_GROWTH             | ✔ |

Daily-run (+5) and achievement (+10) shard bonuses and the Dispenser base price
(40 VEIN) / zone growth (0.5) are **authored in code, not enumerated in the
sheet** (no item-price tab); they are flagged as such in the source and carried
forward into the lock.

---

## 7. Open items carried past the lock (non-blocking)

- **DR-007 follow-up (workbook v1.2):** delete the Mutation Costs tab; remove SIG
  income columns from Currencies/Drop Rates; replace the runs-to-full-kit
  retention proxy with a Sigma-Strain / Origin / Codex unlock-pacing model.
- **DR-007 follow-up (code), scoped after repo review 2026-06-09:** the grant
  model is already shipped (`core/mutation/sig.ts`, `sigBonus` in content,
  SIG_CAP=40 at run scope) — **no rename needed**. ~~Remaining change: delete the
  SIG bonus-drop from `drops.ts` DROP_RATES~~ **done 2026-06-11 (T-500)**; the
  workbook columns still go with v1.2 (T-521). No S-3.4 purchase system exists in code.
- **DR-008 follow-up (workbook v1.2):** add Floor Boss row to Enemy Stats / drop
  model (provisional 45 VEIN); update Currencies kill-mix (Floor Boss replaces
  one elite-equivalent on non-Warden floors; "halve commons" applies to Warden
  floors only); recompute §3 headline totals.
- **DR-008 follow-up (code):** ~~add `FLOOR_BOSS` tier to `drops.ts` VEIN_PER_KILL
  and loot guarantees~~ **done 2026-06-11 (T-501/T-502: `floor_boss: 45` /
  `zone_warden: 120`; loot floor_boss 1× Uncommon+, zone_warden 2× incl. 1
  Rare+)**; still open: the Floor Boss descriptor schema + the one-time 2-phase
  template behavior in the turn engine (T-503); re-run the balance harness with
  per-floor bosses and re-publish the clear-rate curve (T-504).
- **DR-010 follow-up (workbook v1.2):** delete the VEIN pack SKU row; re-price
  Pass tabs at $4.99/$39.99; replace minutes-saved SKU ratings with the
  cosmetic-attach model; re-run revenue scenarios.
- **DR-010 follow-up (code):** remove the Shard-revive branch (UFD S033 → ad-only
  with hidden-offer fallback); remove the VEIN pack from the IAP catalogue /
  store config; verify `shards.ts` sinks are cosmetics-only.
- **Conditional-format heat maps / comments** in the workbook are preserved by the
  edit. The Director should open the v1.1 workbook once in Excel to let it
  recompute (fullCalcOnLoad is set) and re-save to Drive, bumping the Drive copy.
- **Check #5 WARN** (avg TtK 8.10) — revisit only if playtest shows mid-run fights
  dragging; the balance harness, not this proxy, is the trigger.
- The yellow `shard_per_vein_conversion = 0.005` cell remains a director-tunable
  assumption; locked at 0.005 for v1.0.

**Economy v1.0 is locked as pre-prod-binding on the corrected 20-floor / 4-zone
structure.**
