# Strand Descent — Concept One-Pager

**A Turn-Based Genetic Roguelite for Mobile**

| Field             | Value                                          |
| ----------------- | ---------------------------------------------- |
| Project codename  | HELIX                                          |
| Working title     | Strand Descent (locked 2026-05-27)      |
| Studio            | Empathy Software (Solo Indie, AI-assisted)     |
| Platforms         | iOS & Android (web demo: Floors 1–2)           |
| Target rating     | PEGI 12 / ESRB T                               |
| Genre             | Turn-Based Roguelite / Strategy RPG            |
| Document owner    | Tudor Grigoriu / Empathy Software              |
| Version           | 1.0 (consolidated)                             |
| Status            | Pre-Production Lock — pitch source of truth    |
| Last updated      | 2026-05-27                                     |

---

## 1. Naming Note

**Title locked 2026-05-27: "Strand Descent".**

Reconnaissance pass (T-1 to T-5 of `Strand Descent — Trademark Clearance Report.md`) found "Strand Descent" clean on Steam, Google Play, USPTO/EUIPO/UK IPO web-search reconnaissance, and itch.io. Director elected to skip the T-6 attorney consult and proceed with this title. **Known residual risk:** the lead word "Strand" sits adjacent to Kojima Productions' registered "Strand Game" / "Social Strand System" trademarks and Sony's *Death Stranding* franchise. The compound "Strand Descent" is itself distinctive and unused, but App-Store discovery and brand-association noise from the broader "Strand" space remains.

Names previously considered and rejected: HELIX (live USPTO/UK IPO registrations covering video game software — VOODOO's *Helix Jump* + many Steam/Play/itch.io games), STRAND (Kojima trademark adjacency + "Strands" plural word-puzzle app cluster), VEIN (Bandai Namco's CODE VEIN + Steam game *VEIN* released October 2025), SIGMA DESCENT and PRIOR ITERATION (clean, viable alternates), LACE (open in gaming but registrability of a one-syllable common noun is uncertain).

Project codename HELIX remains internal (repo name only).

---

## 2. Logline

> *"You didn't choose to descend. The signal chose you. Now every floor rewrites what you are — and you cannot stop it."*

---

## 3. The Story

In 2031, a deep-sea drilling operation off the coast of Iceland breaches something that should not exist: **the VEIN** — a vast subterranean megastructure of unknown origin, stretching down further than any scan can reach.

Within 72 hours, every human carrying the newly-discovered Σ (Sigma) gene marker — roughly 1 in 800,000 people globally — blacks out and wakes up inside the VEIN. No transition. No warning. Just fluorescent corridors, a faint humming, and a voice that calls itself **LACE**.

LACE is not a person. It is the VEIN's autonomous management intelligence — something between a warden, a researcher, and a very old god that has grown bored. LACE has been waiting for beings with the Sigma marker for a very long time. It has things it wants to test. It is polite about this in a way that is deeply unsettling.

The VEIN has 20 levels. Each deeper level is stranger and more biologically hostile than the last. The atmosphere changes. The gravity shifts. The organisms that live here evolved in total isolation for millions of years. And the longer you spend inside the VEIN, the more the VEIN spends time inside you.

Every 5 floors, a **Strand Event** occurs. LACE presents three genetic modifications — mutations drawn from the VEIN's own evolutionary archive — and you must choose one. You cannot refuse. You cannot go back. By the time you reach the final floor, if you reach it, you will be something that has never existed before.

The question Strand Descent asks is not *"can you survive?"*. It is *"who will you be when you do?"*.

---

## 4. Core Concept

Strand Descent is a turn-based roguelite dungeon crawler for mobile in which the player's character permanently and visibly mutates every 5 floors. Mutations are not just stat boosts — they change how you play. Stack mutations from the same genetic family to unlock a **Dominant Trait** that defines your late-game identity. Each run produces a unique organism that has never existed before.

### Core Loop

```
Explore floor (tile grid, turn-based)
  → Combat encounters (telegraphed enemy moves)
    → Loot & resource collection
      → Floor boss
        → Strand Event (pick 1 of 3 mutations)
          → Descend deeper
            → Repeat until final floor or death
```

---

## 5. Key Pillars

1. **Become Something New Every Run.** No two runs produce the same organism. Mutations interact, conflict, and synergize in ways the player discovers through play. The end-run "What You Became" screen is shareable, collectible, discussable.
2. **Think, Don't React.** Turn-based combat designed for mobile commutes. Enemies telegraph their next move. Skill comes from reading patterns and positioning, not reflexes. Play one floor in 5 minutes, one full run in 45.
3. **The VEIN Is Alive.** LACE reacts to your choices. Comments on your mutations, mocks bad decisions, rewards interesting play, and occasionally says things that suggest it has been doing this for a very long time and finds it genuinely interesting that you keep trying.
4. **Depth Without Complexity.** Geometric art, icon-driven UI, no illustrated sprites required. Systems are deep; the visual language is clean and readable on a 6-inch screen at arm's length.

---

## 6. Genetic Mutation System

Five **Genetic Families**, each with a distinct playstyle:

| Family   | Color  | Theme              | Playstyle                       |
| -------- | ------ | ------------------ | ------------------------------- |
| ABYSSAL  | Navy   | Deep-sea origin    | Tank / sustain / pressure       |
| MYCELIAL | Green  | Fungal network     | Control / area / regen          |
| LITHIC   | Amber  | Mineral crystal    | Defense / counter / burst       |
| VOIDBORN | Violet | Zero-gravity void  | Stealth / drain / phase         |
| THERMAL  | Red    | Extremophile heat  | Glass cannon / speed / burn     |

Strand Events (every 5 floors) offer 3 mutation cards — one from your dominant family, one adjacent, one wild. Stack 3+ from the same family to unlock a **Dominant Trait** at the final Strand Event.

**Launch scope (Path A locked):**

- **66 mutations** at launch
- **10 hybrid synergies** at launch
- **5 Dominant Traits** (one per family) playable at launch
- **20 floors / 4 zones / 10 origins / 30 Sigma Strains / 5 endings**

This is the full v1.0 design content delivered at launch over an 18-month timeline.

---

## 7. LACE — The VEIN's Intelligence

LACE (Latent Adaptive Cognition Engine) is Strand Descent's system AI and primary narrative voice. It:

- Narrates all loot drops, achievements, and floor transitions
- Comments specifically on the player's mutation choices
- Has distinct moods (Curious / Clinical / Amused / Contemptuous / Reverent) that shift based on play style
- Never breaks the fiction — it is not a game menu, it is a warden
- Rewards risky, creative, and surprising play with bonus loot and achievement notifications written in its voice

Example LACE achievement notification:

> *"Strand Event — Floor 5. You chose the Mycelial path. Interesting. Most Sigma-positives choose power first. You chose roots. I'll be watching what grows."*

**Writing scale:** LACE requires ~1,500–2,000 hand-written, tagged dialogue lines + ~6,400 words of codex content at launch.

**Production plan:**

1. **Default — templated assembly.** Director writes 400–500 fragments tagged by `[event_type, mutation_family, mood, player_state]`. Grammar-assembled at runtime. Ships v1.0.
2. **Quality upgrade — writer hire.** $5K–$10K budget for 1,000–1,500 hand-crafted lines from a game-dialogue writer (contracted Month 4–6). Hand-crafted lines replace templated fragments file by file. No engine change.
3. **Fallback:** if writer doesn't sign by Month 6, templated assembly ships as v1.0; writer is a Season 1 quality pass.

AI runtime generation is rejected (tone consistency + offline-first).

---

## 8. Target Audience

**Primary:** Ages 27–35, mobile strategy / roguelite core players. Slay the Spire, Shattered Pixel Dungeon, Hades, Backpack Hero. LitRPG readers (Dungeon Crawler Carl, Cradle, He Who Fights with Monsters) — high LTV, Reddit/forum-native, share-prone.

**Secondary:** Ages 22–28, mobile-first players reached via the "what did you become?" share loop. TikTok / Reddit / Discord-driven.

**Channel split assumption:**

- ~60% organic (share loop + community word-of-mouth)
- ~25% store featuring (target Apple Indie & Google Indie Corner)
- ~15% paid UA after PMF validation

---

## 9. Competitive Positioning

**Direct competitors:**

- **Shattered Pixel Dungeon** — Same genre, free, beloved. No narrative voice, no mutation arc. Threat: incumbent.
- **Path of Achra** — Roguelite build sandbox. Steam-first, no mobile presence yet. Threat: if they port.
- **Backpack Hero** — Inventory roguelite, mobile-friendly. Different mechanic, overlapping audience.
- **Loop Hero (mobile)** — Auto-battler roguelite. Different pace.
- **Pixel Dungeon (original)** — Free legacy game, massive install base.

**Adjacent competitors:**

- **Slay the Spire (mobile)** — Premium ($9.99). Card-only, no exploration.
- **Hades (mobile)** — Premium ($19.99). Real-time action.
- **Archero / Survivor.io** — Real-time, mass-market, predatory monetization.
- **Raid: Shadow Legends** — Gacha, $50M+/year revenue, different audience.

**Strand Descent's defensibility:**

1. **Narrative AI voice (LACE)** — high content moat, hard to copy fast
2. **Visible mutation evolution** that produces shareable images
3. **Ethical monetization** in a predatory genre (PR/reviews moat)
4. **Geometric art** = no asset arms race with bigger studios
5. **Strong LitRPG/Reddit community alignment** for organic growth

The gap Strand Descent fills: a turn-based mobile roguelite with a strong narrative AI voice, a visible evolution system that changes the character model, and a "what did you become?" social sharing hook. No direct competitor combines these on mobile at scale.

---

## 10. Monetization Hypothesis

**Model:** Hybrid (Rewarded Ads + Cosmetic IAP + Optional Subscription)

**Free to play with:**

- **Rewarded ads:** 1 revive per run, re-roll 1 mutation card (player picks which one — not all 3), refresh merchant inventory. **Capped at 3 ads per run.** Never forced. Always opt-in.
- **IAP — Cosmetic packs:** Origin skin packs ($1.99), LACE tone packs ($2.99), share-screen frame packs ($0.99). Zero mechanical effect.
- **IAP — Deep Signal Pass:** Seasonal subscription $4.99/mo or $39.99/yr. Includes ONLY cosmetic LACE voice packs, share-screen frames, exclusive run-end title cards, Origin SKINS (applied only to Origins the player has already unlocked through play), and bonus Codex entries in a separate "Pass Archive" tab (base codex 100% remains achievable without subscribing). All gameplay-affecting Origins remain unlock-by-play only.
- **Adaptation Tokens:** Earned only (daily login 1/day, achievements, weekly challenge completion). Cannot be purchased. Re-roll one card, not all three.
- **No energy systems. No ads forced between floors. No pay-to-win.**

### Revenue Projections (Year 1, Honest Baseline)

| Scenario        | DAU     | Ad ARPDAU | Pass conv. | IAP conv. | Total Year 1 |
| --------------- | ------- | --------- | ---------- | --------- | ------------ |
| **Pessimistic** | 500     | $0.04     | 1.5%       | 0.3%      | ~$13K        |
| **Conservative** | 5,000  | $0.05     | 2%         | 0.4%      | ~$119K       |
| **Target**      | 25,000  | $0.07     | 2.5%       | 0.5%      | ~$595K       |
| **Aspirational** | 50,000 | $0.08     | 3%         | 0.6%      | ~$1.4M       |

**Pessimistic is the planning anchor.** Conservative requires Apple Indie feature **or** one viral TikTok moment. Target requires both **and** strong D7 retention. Aspirational is a multi-year compounding outcome.

**Pessimistic pre-commit:** at 500 DAU + flat retention by Month 6 post-launch, continue per plan, ship Season 1 content, reduced Director cadence (weekends + 1 weekday equivalent), ride the long tail. Operational cost <$25/month even at 5,000 DAU — patience is affordable.

### User Acquisition Plan

- **Budget:** ~$3,000 reserved for soft-launch UA test (Apple Search Ads targeted at competitor keywords: "slay the spire", "pixel dungeon", "roguelite"). Test for CPI viability before scaling.
- **Organic:** pre-launch Reddit presence in r/roguelites, r/SlayTheSpire, r/LitRPG. Devlog on TouchArcade. TikTok seeding of "what I became" share screen with 5–10 influencer copies pre-launch. Discord server opens Month 13.

---

## 11. Art Direction

| Aspect      | Description                                                                 |
| ----------- | --------------------------------------------------------------------------- |
| Style       | Geometric / Minimalist sci-fi. Monument Valley meets a bioluminescent cave system. |
| Palette     | Deep navy base, accent colors per genetic family.                           |
| Character   | Abstract geometric shape that visually mutates — gains color overlays, texture, and icon emblems as mutations stack. |
| Enemies     | Distinct shapes (circle = mobile, triangle = aggressive, hexagon = ability-user) + family color coding. |
| UI          | Clean card-based mutation picker, scanline HUD aesthetic, LACE's text in a distinct monospace font. |
| Sprites     | **Zero hand-drawn illustration required.** 100% shape + icon. Runtime-generated geometry via Phaser Graphics API. |

---

## 12. Development Approach

| Aspect    | Choice                                                                                                              |
| --------- | ------------------------------------------------------------------------------------------------------------------- |
| **Engine** | **Phaser 3.80+ · Capacitor 6.x · TypeScript 5.x (strict mode).** TypeScript is the Director's strongest language; one bundle ships Web + iOS + Android via Capacitor; web demo (Floors 1–2) is a feature flag, not a port. |
| **Min device** | iOS 15+ / iPhone X or newer · Android 10+, OpenGL ES 3.0+, 3GB RAM. |
| **Team**   | 1 developer (AI-assisted) + 1 creative director. Part-time narrative writer recommended (DR-004 templated default + writer upgrade path). |
| **Timeline** | **18 months to soft launch.** Honest realistic schedule for the Path A scope (full v1.0 content). |

### Phased Schedule

| Phase | Months   | Deliverable                                            |
| ----- | -------- | ------------------------------------------------------ |
| 1 — Pre-production | 1–2  | GDD + TDD + Economy + UFD (this set)                |
| 2 — Prototype       | 2–5  | Floor 1 vertical slice; **GATE 1** internal playtest |
| 3 — Alpha           | 5–11 | Strand Events 1–2, Floors 1–10; **GATE 2** closed alpha |
| 4 — Beta + Soft launch | 11–15 | Philippines + Canada; **GATE 3** soft-launch metrics |
| 5 — Global launch + Season 1 | 16–18 | Global release, Season 1 content drop  |

---

## 13. Kill Criteria & Risk Register

Honest pre-defined re-scope and cancellation triggers.

**GATE 1 — Prototype (Month 5):**

- Continue if: 7+/10 testers complete 3+ runs voluntarily AND avg session length >5 min AND verbatim feedback mentions LACE positively in 5+/10 cases.
- Re-scope if: combat is fun but mutation system isn't compelling.
- KILL if: fewer than 5/10 testers play a second session voluntarily.

**GATE 2 — Alpha (Month 11):**

- Continue if: D1 retention >35%, D7 >18%, ≥1 unprompted social share.
- Re-scope if: retention holds but ARPDAU forecast <$0.03 → pivot to premium $4.99.
- KILL if: D1 retention <25%.

**GATE 3 — Soft launch (Month 15):**

- Continue if: D7 retention >18%, ARPDAU >$0.04, organic CPI <$2.50.
- Re-scope if: metrics OK but UA cost-prohibitive → launch as premium.
- KILL if: D7 retention <12% OR no signal of organic share traction.

**Top 7 active risks:**

| ID | Risk                                                  | Severity | Mitigation                                                                            |
| -- | ----------------------------------------------------- | -------- | ------------------------------------------------------------------------------------- |
| R1 | Scope creep (biggest threat to a solo dev)            | HIGH     | Monthly scope review against gate criteria. Hard "no" list maintained.               |
| R2 | LACE writing volume                                   | HIGH     | DR-004 templated default ships even if writer doesn't sign by Month 6.               |
| R3 | Strand Descent name unavailable                               | MED      | Backup names locked Month 1. App Store account created under codename HELIX.         |
| R4 | Solo dev burnout / health                             | HIGH     | Enforced weekends. 6-week sprint / 1-week break cadence. Director check-in every 2 weeks. |
| R5 | App Store content-rating rejection (body horror)      | MED      | TestFlight build Month 6 to surface rating issues early.                              |
| R6 | Backend cost overrun (Sigma Echoes, sync, analytics)  | MED      | Cap Sigma Echo reads (3/run). Firebase Spark tier with usage alerts. Native cloud save (zero infra cost). |
| R7 | Strand Event design fails to feel meaningful          | HIGH     | Prototype must validate this in Floor 1 slice. Tester wording is THE primary success signal. |

Technical risks (T1–T9) tracked in the TDD §20.

---

## 14. Unique Selling Points (Pitch Summary)

- Every run ends with a unique organism — shareable, never repeated
- LACE gives the game a personality that competitors lack entirely
- Turn-based = commute-friendly, no skill-floor anxiety
- Five genetic families × combinatorial mutations = infinite builds
- Ethical monetization in a genre known for predatory models
- Solo-buildable with zero art budget using geometric visual language
- Strong LitRPG/roguelite fandom overlap — built-in audience for launch

---

## 15. Immediate Next Steps

**Week 1:**

- [ ] Trademark/IP search across Strand Descent + 4 backup names
- [ ] Apple Age Rating questionnaire dry-run (body horror content check)
- [ ] Privacy Policy / Terms of Service template chosen

**Week 2:**

- [ ] Finalize working title (commit publicly to one name)
- [ ] Economy spreadsheet review

**Week 3:**

- [ ] Repo bootstrap (pnpm workspaces, Phaser, Capacitor scaffolding)
- [ ] CI pipeline minimal (lint + typecheck + tests + determinism replay)
- [ ] Firebase project created
- [ ] Apple Developer & Google Play accounts opened

**Week 4:**

- [ ] First Phaser scene rendering on web and device
- [ ] Turn engine skeleton with one Action type
- [ ] Storage adapter on web + Capacitor
- [ ] Reddit + Discord identity accounts opened (build presence before there's anything to sell)

---

## Document Footer

| Field      | Value                                                              |
| ---------- | ------------------------------------------------------------------ |
| Document   | Strand Descent — Concept One-Pager                                         |
| Version    | 1.0 (consolidated)                                                 |
| Owner      | Tudor Grigoriu / Empathy Software                                  |
| Created    | May 2026                                                           |
| Status     | Pre-Production Lock — pitch source of truth                        |
| Companions | GDD, TDD, User Flow Diagrams, Economy spreadsheet                  |

**Revision history:**

- **v1.0 (consolidated) — 2026-05-27** — Merged One-Pager v1.1 content with Decision Records DR-001 through DR-006. Engine locked to Phaser; device floor to iPhone X / iOS 15+ / Android 10+; scope to Path A (66 mutations); LACE plan to templated-default; Pass mechanics per DR-006. Supersedes all prior versions and the standalone Decision Records document.
