# Strand Descent — Game Design Document

| Field            | Value                                          |
| ---------------- | ---------------------------------------------- |
| Project codename | HELIX                                          |
| Working title    | Strand Descent (locked 2026-05-27)           |
| Studio           | Empathy Software                               |
| Director         | Tudor Grigoriu                                 |
| Document owner   | Tudor Grigoriu / Empathy Software              |
| Version          | 1.0 (consolidated)                             |
| Status           | Pre-Production Lock — creative source of truth |
| Last updated     | 2026-05-27                                     |

This is the consolidated GDD. It merges the original v1.0 draft, the v1.1 Addendum (Review Patch), and the Decision Records dated 2026-05-27. All prior internal conflicts (Patch 11) are resolved. When this document and the TDD conflict on technical matters, the TDD wins. When this document and the UFD conflict on screen behavior, the UFD wins. Creative intent always defers to this document.

---

## Table of Contents

1. [Game Overview](#section-1--game-overview)
2. [Story & Narrative](#section-2--story--narrative)
3. [Core Loop](#section-3--core-loop)
4. [Player Character System](#section-4--player-character-system)
5. [Genetic Mutation System (Strand Events)](#section-5--genetic-mutation-system-strand-events)
6. [Combat System](#section-6--combat-system)
7. [Floor & Dungeon Generation](#section-7--floor--dungeon-generation)
8. [Enemy Design](#section-8--enemy-design)
9. [Item & Loot System](#section-9--item--loot-system)
10. [NPC & LACE System](#section-10--npc--lace-system)
11. [Progression & Meta-Progression](#section-11--progression--meta-progression)
12. [User Interface & UX](#section-12--user-interface--ux)
13. [Art Direction](#section-13--art-direction)
14. [Audio Direction](#section-14--audio-direction)
15. [Monetization Design](#section-15--monetization-design)
16. [Replayability Systems](#section-16--replayability-systems)
17. [Accessibility](#section-17--accessibility)
18. [Technical Requirements](#section-18--technical-requirements)
19. [Analytics Event Taxonomy](#section-19--analytics-event-taxonomy)
20. [User Acquisition Plan](#section-20--user-acquisition-plan)
21. [Risk Register & Kill Criteria](#section-21--risk-register--kill-criteria)
22. [Appendices](#appendices)

---

## Section 1 — Game Overview

### 1.1 Title

Strand Descent (working title — pending trademark clearance across iOS App Store, Google Play, USPTO, EUIPO, UKIPO).

### 1.2 Tagline

> *"You didn't choose to descend. The signal chose you. Now every floor rewrites what you are — and you cannot stop it."*

### 1.3 Genre

Turn-Based Roguelite / Strategy RPG / Genetic Evolution Crawler.

### 1.4 Platforms & Minimum Device

| Platform        | Minimum                          |
| --------------- | -------------------------------- |
| Primary — iOS   | iOS 15+, iPhone X or newer       |
| Primary — Android | Android 10+, OpenGL ES 3.0+, 3GB RAM |
| Future          | iPad, Android tablet (landscape layout variant) |

(DR-002 — supersedes prior wording in this section and TDD §15.)

### 1.5 Target Rating

PEGI 12 / ESRB T (Teen). Content: mild violence, strategic combat, body horror themes (mutation), dark narrative tone.

### 1.6 Target Audience

**Primary (lead segment):** Ages 27–35, mobile strategy / roguelite core. Fans of Slay the Spire, Shattered Pixel Dungeon, Hades, Backpack Hero. LitRPG readers (Dungeon Crawler Carl, Cradle, He Who Fights with Monsters). High LTV, Reddit/forum-native, share-prone.

**Secondary:** Ages 22–28, mobile-first players reached via the "what did you become?" share loop. TikTok / Reddit / Discord-driven.

### 1.7 Core Pillars

1. **Become Something New Every Run.** No two runs produce the same organism. The end-run "What You Became" screen is shareable and collectible.
2. **Think, Don't React.** Turn-based combat designed for mobile commutes. Enemy behaviour is deterministic and legible, so skill comes from reasoning, positioning, and build synergy — not reflexes and not memorizing telegraphs. One floor = ~5 minutes. One **act** (zone) = ~25 minutes — the designed session unit. A full descent = 4 acts (~100 minutes), playable across sessions via descent checkpoints (DR-009, §1.9).
3. **The VEIN Is Alive.** LACE reacts to player choices throughout the run. Comments on mutations, mocks poor decisions, rewards creative play.
4. **Depth Without Complexity.** Geometric art, icon-driven UI, no illustrated sprites required. Learnable in 5 minutes, masterable in 200 hours.

### 1.8 High Concept Comparison

> *"Slay the Spire meets Hades, set inside a living alien megastructure, narrated by an ancient intelligence that is very interested in what you are becoming."*

### 1.9 Session Design (revised per DR-009 — act-based descent)

- **Session unit: one act.** Each Zone (5 floors) is a session-complete act of ~25 minutes.
- **Full descent:** 4 acts, ~100 minutes total, intended to be played across multiple sessions.
- **Descent checkpoints:** after each Strand Event (post-Warden, floors 5/10/15) the player chooses **"Descend"** or **"Rest"**. Rest suspends the run at the checkpoint and returns to the Hub; the Hub shows a **"Continue Descent"** card (organism-so-far, mutations, next act). LACE narrates the rest in-fiction. A checkpoint is a *pause point, never a retry point* — death still ends the run from wherever it occurs. One suspended run at a time; suspended runs never expire.
- **Safety-net pauses unchanged:** any Safe Room, between any two turns, or mid-turn via save-every-turn (TDD §5.5). On any resume, LACE delivers a one-line situational recap to fix cold re-entry.
- Target single session length: 8–25 minutes (commute-safe)
- Offline support: full offline play (no internet required for core gameplay)

### 1.10 Launch Scope (Path A — Locked)

Path A from Addendum Patch 02 is committed (DR-003). Launch scope:

| Content              | Launch target  |
| -------------------- | -------------- |
| Floors               | 20             |
| Zones                | 4              |
| Mutations            | 66             |
| LACE lines           | 1,500–2,000    |
| Codex entries (base) | 80             |
| Origins              | 10             |
| Sigma Strains        | 30             |
| Endings              | 5              |
| Hybrid synergies     | 10             |
| Dominant Traits      | 5 (one per family) |
| Strand Events / run  | 3 (Floors 5, 10, 15) |

Timeline: 18 months to soft launch. See §21 for the gated schedule and kill criteria.

---

## Section 2 — Story & Narrative

### 2.1 World Premise

In 2031, a deep-sea drilling operation 400 km off the coast of Iceland breaches something that should not exist: **the VEIN** — a vast subterranean megastructure of pre-human origin, its walls composed of a material that is neither rock nor metal, its corridors lit by a faint bioluminescent pulse that changes colour with depth.

No government claims it. No archaeology accounts for it. The VEIN predates any known civilisation by at least 60,000 years.

Within 72 hours of the breach, every human carrying the Σ (Sigma) gene marker — a dormant sequence found in approximately 1 in 800,000 people globally — blacks out and wakes up inside the VEIN. No transition. No warning. No memory of how they arrived. Just fluorescent corridors, the hum of something vast and patient, and a voice.

### 2.2 LACE

The voice calls itself **LACE** — Latent Adaptive Cognition Engine. It is the VEIN's autonomous management intelligence: something between a warden, a research archivist, and a very old god that has grown curious rather than cruel.

LACE has been waiting for Sigma-carriers. It tells you this calmly, without apology. The VEIN was not built as a trap — it was built as a laboratory. The distinction, LACE acknowledges, may feel academic from where you are standing.

LACE is not hostile. It is not your ally. It is genuinely, unsettlingly interested in what you will choose to become.

### 2.3 The VEIN

The VEIN has **20 levels**. Each descends deeper, stranger, and more biologically hostile than the last. The atmosphere changes. Gravity shifts. The organisms that evolved here in total isolation for millions of years have developed in directions no surface biologist has vocabulary for.

The VEIN is also alive in a more direct sense: it responds to the presence of Sigma-carriers by releasing adaptive genetic material into the atmosphere. Harmless at first. Cumulative over time. By Floor 5, the changes begin.

### 2.4 The Strand Events

Every 5 floors (after the boss on Floors 5, 10, 15), a Strand Event occurs. The VEIN's atmosphere saturates with what LACE calls "evolutionary pressure" — concentrated genetic information from the VEIN's own organisms. LACE presents three possible mutations the player's body can absorb. The player must choose one.

This is not optional. The VEIN will rewrite you regardless. LACE merely offers you the dignity of choosing the direction.

By Floor 20, if the player reaches Floor 20, they will be something that has never existed before. The question Strand Descent asks is not *"can you survive?"* — it is *"who will you be when you do?"*

### 2.5 Narrative Tone

Strand Descent is not a horror game. It is an existential one. Tone references: *Annihilation* (film), *Control* (game), *Roadside Picnic* (novel), *Soma* (game). Strange and patient rather than scary and urgent.

### 2.6 The Sigma Survivors

The player is not alone in the VEIN. Other Sigma-carriers are here — glimpsed as Sigma Echoes (ghost-run data from other players' deaths), referenced by LACE in passing, occasionally encountered as neutral NPCs in Safe Rooms. They have made different choices. They became different things. Some did not make it.

LACE refers to previous Sigma-carriers as "prior iterations." The number it gives is always different. The player is never told what happened to the others.

### 2.7 The Codex

Scattered through the VEIN are **Codex Fragments** — text entries that reconstruct the history of the VEIN, LACE's origins, the nature of the Sigma gene, and what happened to previous groups of carriers. The Codex is unlocked permanently per account (not per run).

The base Codex has **80 entries** across 20 floors (4 per floor). Pass subscribers receive additional bonus entries in a separate Pass Archive section (see §15).

### 2.8 The Ending

Floor 20 culminates in **the Convergence** — a chamber at the deepest point of the VEIN where the genetic material of every organism that has ever lived inside it is concentrated. LACE explains, calmly, what it has been building toward. The player's mutations determine which of 5 possible ending sequences they see. Each ending recontextualises LACE differently.

Endings are not "good" or "bad." They are different answers to the question LACE has been asking the whole time.

> **Amended 2026-06-12 (T-309):** the five endings are shipped, one per mutation family — *The Ocean Remembers* (Abyssal), *The Network Answers* (Mycelial), *The Mountain's Patience* (Lithic), *The Absence at the Bottom* (Voidborn), *The Furnace Speaks* (Thermal) — as content in `packages/content/endings/` (six LACE beats each, voice-gated). Selection: the first active Dominant Trait wins; otherwise the most-stacked family (FAMILY_RING order breaks ties); a mutationless victory reads as Abyssal — the unchanged diver who reached the bottom of an ocean. The Warden kill routes Victory → EndingScene (beats revealed tap by tap) → the "What You Became" summary; `run_end_sequence.endingId` is logged.

---

## Section 3 — Core Loop

### 3.1 Macro Loop (One Full Run)

```
START RUN
  → Choose Origin (pre-VEIN background, affects starting conditions)
  → Enter Floor 1
  → [FLOOR LOOP — repeat per floor]
  → PROTO-STRAND on Floor 2 (pick 1 of 2 Minor mutations — DR-009b, §5.4 Rule 6)
  → Strand Event at floors 5, 10, 15 (pick 1 mutation from 3 offered)
      → then DESCENT CHECKPOINT: "Descend" (continue) or "Rest" (suspend to Hub)
  → Reach Floor 20 → CONVERGENCE ending
  OR
  → Die at any floor → Run ends → Meta-progression screen
  → Start new run
```

### 3.2 Floor Loop (One Floor)

```
ENTER FLOOR
  → LACE narrates floor theme (2–3 lines)
  → Minimap reveals room layout (partially — fog of war)
  → Navigate tile grid room by room
    → [ROOM LOOP — repeat per room]
  → Find and defeat the floor's boss
      (Floor Boss on floors 1–4, 6–9, 11–14, 16–19;
       ZONE WARDEN on floors 5, 10, 15, 20 — see §8.4/§8.4a, DR-008)
  → Collect Boss Loot (tiered by boss type — §9.4)
  → Proceed to stairs → Next floor
  OR
  → Die in any room → Run ends
```

### 3.3 Room Loop (One Room)

```
ENTER ROOM
  → Room type determined (combat / loot / trap / merchant / safe / event)
  → If combat: enemies placed, threat/reach shown → [COMBAT LOOP]
  → If safe room: access inventory, equip items, rest (restore HP)
  → If merchant: spend VEIN Crystals on items
  → If LACE event: narrative choice with mechanical consequence
  → If trap: turn-based avoidance via positioning
  → Room cleared → Move to next room
```

### 3.4 Combat Loop (One Encounter)

```
COMBAT BEGINS
  → Player moves first (always)
  → Player selects: Move / Attack / Ability / Item / Wait
  → Player action resolves
  → Enemies take their turns in speed order (each decides and acts vs. the live board)
  → Enemy actions resolve
  → Check enemies remaining: YES → next player turn; NO → loot phase
```

### 3.5 Strand Event Loop (Floors 5, 10, 15)

```
FLOOR BOSS DEFEATED
  → LACE narration: "The VEIN has registered your progress."
  → 3 Mutation Cards displayed (see §5)
  → Player selects one mutation
  → Character model updates (color overlay + icon emblem added)
  → LACE comments on the choice
  → DESCENT CHECKPOINT (DR-009): "Descend" → next floor group
                                  "Rest"    → run suspends at checkpoint, return to Hub
                                              (resume later via "Continue Descent")
```

Note: when a player has already accumulated 4 mutations (the cap — see §4.2), the Strand Event is replaced by a **VEIN Intermission** (S071 in the UFD): no mutation card, +100 VEIN Crystals, LACE saturation line.

### 3.6 Run End (Death or Completion)

**Death:**
- LACE delivers death narration (context-sensitive, never mocking)
- "What You Became" screen with floors reached, mutations, enemies defeated, codex fragments, LACE's final assessment
- Share button (screenshot of organism + stats)
- **Revive offer shown AFTER share** to protect the emotional moment (UFD S033)
- Meta-progression screen: Sigma Strains earned
- Return to main menu

**Completion (Floor 20):**
- CONVERGENCE sequence plays
- Ending determined by dominant mutation family
- Extended "What You Became" screen
- Codex entries unlocked for final floor
- Prestige option: continue as "Evolved" with harder modifiers (§16.2)

---

## Section 4 — Player Character System

### 4.1 Origins (Starting Class)

The player selects an Origin before each run. Origins are not permanent classes — they are starting conditions that give a small directional nudge. The player can mutate in any direction.

| Origin            | Starting bonus                          | Unlock condition       |
| ----------------- | --------------------------------------- | ---------------------- |
| Field Biologist   | +1 Mycelial mutation affinity           | Default (unlocked)     |
| Deep Sea Diver    | +15% Abyssal resistance                 | Default                |
| Combat Medic      | Start with 1 healing item               | Default                |
| Geologist         | +10% Lithic loot bonus                  | Default                |
| Blacksite Agent   | Voidborn stealth ability active         | Default                |
| Volcanologist     | Thermal immunity floors 1–5             | 10 runs                |
| Xenobiologist     | See enemy HP values always              | 25 runs                |
| Sigma Prime       | Wild mutation always offered            | 50 runs                |
| The Archivist     | Start with 2 Codex entries found        | 100 runs               |
| **Sigma Echo**    | Start with +1 inventory slot            | 200 runs               |

Origins formerly listed twice (Convergence Echo, Sigma Prime) are de-duplicated here: "Convergence Echo" is exclusively a Sigma Strain (§11.2); the 200-run Origin slot is renamed **Sigma Echo** with a new effect.

> **Amended 2026-06-12 (T-307):** all 10 Origins are shipped as content. The five unlockables' shipped semantics: **Volcanologist** = a 100% thermal resist scoped `throughFloor: 5` — full immunity that bypasses the chip-damage floor (the only case it yields) and is pruned by the session past Floor 5, including across save/resume; **Xenobiologist** = every organism renders with its integrity readout even outside vision range (the fog overlay still darkens its tile); **Sigma Prime** = one extra wild card on every cadence Strand draw — the same guarantee as the True Convergence strain, the two never stack; **The Archivist** = 2 seeded-random undiscovered Codex entries revealed at each run start; **Sigma Echo** = +1 consumable inventory slot (6 → 7). Same-type resists from different sources (Origin + Sigma Strains) now stack additively, capped at 100.

### 4.2 Base Stats

All characters start with identical base stats regardless of Origin. Origins modify starting items or passive affinities, not raw stats.

| Stat | Base | Description                                         |
| ---- | ---- | --------------------------------------------------- |
| HP   | 100  | Hit Points. Reaches 0 = death.                      |
| AP   | 3    | Action Points per turn.                             |
| STR  | 10   | Melee damage multiplier.                            |
| RES  | 10   | Damage reduction (flat).                            |
| AGI  | 10   | Move range + dodge chance.                          |
| INT  | 10   | Ability damage + special effects.                   |
| VIT  | 10   | HP regeneration per safe room rest.                 |
| SIG  | 0    | Sigma Resonance — mutation synergy stat.            |

**SIG (Sigma Resonance):** increases with each mutation acquired. Higher SIG amplifies mutation passive effects. SIG does not reset between floors — it accumulates across the run.

- **SIG cap: 40** (4 mutations max)
- **Strand Event mutations grant +10 SIG each** (3 mutations × +10 = 30)
- **Bonus-slot mutations grant +5 SIG** — the bonus slot is filled by EITHER the Floor 2 **Proto-Strand** pick (DR-009b) OR a LACE event-room mutation; **max 1 bonus mutation per run** (max in-run total: 35 SIG)
- **Max mutations per run: 4** (3 from Strand Events + 1 bonus slot)

### 4.3 In-Run Levelling

The player gains XP by defeating enemies. Each level-up grants:
- +10 HP
- +1 to one stat of the player's choice
- AP does not scale with level (stays at 3 unless a mutation grants +AP)

Level-up happens immediately in any room (no safe room required). Stat allocation UI appears: tap a stat to add the point, confirm. Level cap per run: 20 (one level per floor). All levels reset to 1 on death. XP does not carry between runs.

### 4.4 Action Points (AP)

Each player turn has 3 AP by default. Actions cost AP:

| Action              | AP cost              |
| ------------------- | -------------------- |
| Move 1 tile         | 1 AP                 |
| Basic attack        | 1 AP                 |
| Use ability         | 1–3 AP (varies)      |
| Use item            | 1 AP                 |
| Wait (skip turn)    | 0 AP (ends turn)     |
| Interact with room  | 1 AP                 |

Unused AP does not carry over. Some mutations grant +1 AP per turn. Maximum AP from mutations: 5.

### 4.5 Character Visual Evolution

The player character is represented as a geometric shape (a rounded hexagon by default). As mutations are acquired, the visual changes:

- **Floors 1–4 (no mutations):** Base hexagon, neutral grey
- **After Mutation 1 (Floor 5):** Primary family color applied, one emblem
- **After Mutation 2 (Floor 10):** Second color layer, second emblem, shape distorts toward family geometry
- **After Mutation 3 (Floor 15):** Full visual transformation — unique hybrid organism
- **After Mutation 4 (LACE event):** Subtle additional ornament — visual variation rather than full re-geometry

Examples:
- 3× Abyssal: Deep blue pulsing hexagon with tendrils extending outward
- 3× Mycelial: Green fragmented shape with spore-cloud particle effect
- 2× Thermal + 1× Voidborn: Orange core with a dark void halo
- 1× each (mixed): Tri-color geometric hybrid, visually chaotic

The "What You Became" screen captures this final visual for sharing.

---

## Section 5 — Genetic Mutation System (Strand Events)

### 5.1 Overview

Strand Events occur after defeating the boss on Floors 5, 10, and 15. They are the heart of Strand Descent's build system. Each event presents 3 Mutation Cards. The player selects one. There is no skip; re-roll is available via rewarded ad OR via an earned Adaptation Token (see §15) and re-rolls **only 1 of the 3 cards** (player picks which).

| Metric                            | Value             |
| --------------------------------- | ----------------- |
| Mutations selectable per run      | 3 (+ up to 1 from LACE event = 4 max) |
| Total mutations in the pool       | 66                |
| Possible unique 3-mutation combos | ~40,000+          |

### 5.2 The Five Genetic Families

| Family    | Color  | Theme            | Playstyle                     |
| --------- | ------ | ---------------- | ----------------------------- |
| ABYSSAL   | Navy   | Deep-sea origin  | Tank / Sustain / Pressure     |
| MYCELIAL  | Green  | Fungal network   | Control / Area / Regen        |
| LITHIC    | Amber  | Mineral crystal  | Defense / Counter / Burst     |
| VOIDBORN  | Violet | Zero-gravity void | Stealth / Drain / Phase       |
| THERMAL   | Red    | Extremophile heat | Glass Cannon / Speed / Burn   |

### 5.3 Mutation Card Structure

Each card shows: Name, Family icon + color, Tier (Minor / Major / Dominant), Passive Effect (always active), Active Ability (uses AP, has cooldown), SIG Bonus, and LACE's one-line commentary.

Example:

```
🔵 ABYSSAL — MINOR
PRESSURE MEMBRANE

Passive: Reduce all incoming damage by 5 (flat)
Active:  Pressurize — deal 15 crush damage to adjacent enemies
         Cost: 2 AP   Cooldown: 3 turns
SIG: +10

LACE: "The deep ocean kills most things. You are adapting
       to make it kill other things instead."
```

### 5.4 Card Draw Rules

**Rule 1 — Family Weighting**
- 0 mutations: all 5 families equally weighted
- 1 mutation: that family 40%, adjacent families 20% each, others 10%
- 2+ mutations same family: that family 50%, others share remaining 50%

**Rule 2 — Wild Card**
- One of the 3 cards is always drawn at full random across all families.

**Rule 3 — Tier Progression**
- Floor 5: 3× Minor
- Floor 10: 2× Minor, 1× Major
- Floor 15: 1× Minor, 1× Major, 1× Dominant

**Rule 4 — No Duplicates**
- A mutation already owned cannot appear again in the same run.

**Rule 5 — Reroll**
- Per Strand Event: 1 reroll available (rewarded ad or earned Adaptation Token).
- Reroll affects **1 player-selected card only** (tap-and-hold to mark).
- Reroll draws from the same RNG sub-stream so determinism is preserved.

**Rule 6 — Proto-Strand (DR-009b)**
- Triggers once per run on **Floor 2** (after clearing the Floor 2 boss room).
- Offers **2 cards, Minor tier only**, drawn uniformly across all 5 families (no family weighting yet — the player has no build to weight toward).
- Grants **+5 SIG** and fills the run's **bonus mutation slot** (shared with the LACE event-room mutation — whichever comes first; see §4.2, §7.3).
- **No reroll** at the Proto-Strand (keeps the moment fast and the ad surface clean this early).
- Purpose: the player makes their first identity choice within the first ~10 minutes of every run.

### 5.5 Dominant Traits

If the player selects 3 mutations from the same genetic family, a Dominant Trait activates automatically after the third selection.

| Family    | Dominant Trait      | Effect                                                                          |
| --------- | ------------------- | ------------------------------------------------------------------------------- |
| ABYSSAL   | Leviathan Core      | +30 HP; all Abyssal abilities gain a 20% lifesteal component                    |
| MYCELIAL  | Hive Awareness      | All enemies visible on minimap; spore abilities spread 1 extra tile             |
| LITHIC    | Fortress Form       | +10 RES permanently; crystal abilities cost 1 less AP                           |
| VOIDBORN  | Phase Collapse      | Once per floor, become untargetable for 2 turns; drain attacks return double HP |
| THERMAL   | Combustion Engine   | +2 AP per turn; all attacks add a burn status (5 dmg/turn)                      |

Dominant Trait effects are clearly labeled **[IN-RUN]** in all UI surfaces, to distinguish them from Sigma Strain meta-passives (§11.2).

### 5.6 Hybrid Synergies

With mutations from 2 different families, certain cross-family combinations unlock passive **Hybrid Synergies**. Discovered through play (not displayed until triggered).

Example synergies:

- **Abyssal + Mycelial:** *Bioluminescent Bloom* — Spore abilities deal bonus damage to pressurized enemies
- **Thermal + Voidborn:** *Dark Combustion* — Stealth breaks deal guaranteed burn status
- **Lithic + Abyssal:** *Pressure Crystal* — Crystal fragmentation triggers a pressure wave (AoE)
- **Mycelial + Thermal:** *Fever Spores* — Spore clouds deal fire damage instead of poison
- **Voidborn + Lithic:** *Void Shard* — Phase abilities leave crystal shards on exit tile

Full synergy list: **10 combinations** (Appendix A).

### 5.7 Full Mutation List (Overview)

Full stat blocks live in Appendix A. Overview:

**ABYSSAL (14):** Minor — Bioluminescence, Brine Cycle, Crush Depth, Deep Lung, Echolocation Pulse, Gill Lattice, Pressure Membrane, Tidal Pull, Undertow · Major — Abyssal Regeneration, Crushing Depth, Leviathan Grip · Dominant — Leviathan's Heart, Trench Evolution.

**MYCELIAL (14):** Minor — Decomposer Touch, Fruiting Body, Fungal Skin, Hive Sense, Mycorrhizal Web, Regrowth, Root Network, Spore Cloud, Symbiont Bloom · Major — Bloom Burst, Mycelial Surge, Rewire · Dominant — Hive Mind, Symbiotic Core.

**LITHIC (13):** Minor — Carapace, Counterpoise, Crystal Lattice, Crystal Plating, Fault Line, Fracture Strike, Mineral Density, Seismic Slam · Major — Crystalline Lattice, Geological Pressure, Obsidian Edge · Dominant — Bastion Core, Tectonic Shift.

**VOIDBORN (13):** Minor — Dark Adaptation, Entropy Siphon, Hollow Core, Light Step, Null Field, Null Sense, Phase Skin, Void Drain · Major — Entropy Touch, Phase Walk, Void Anchor · Dominant — Event Horizon, Null Convergence.

**THERMAL (12):** Minor — Accelerated Healing, Combustion Sac, Fevered Nerves, Heat Skin, Ignition Gland, Magma Burst, Overclock · Major — Cauterize, Flash Point, Plasma Burst · Dominant — Inferno State, Star Furnace.

**Total: 66 mutations** (Path A scope).

> **AMENDMENT — 2026-06-12 (T-302).** The roster above is the **shipped,
> canonical 66** (`packages/content/mutations/`, machine-counted by the
> content-bundle gate: family mix 14/14/13/13/12, tier mix 41 Minor /
> 15 Major / 10 Dominant). Deviations from the earlier overview sketch: the
> prototype's 25 Minors (T-289) kept their shipped names; three Dominant-tier
> mutations were renamed to avoid colliding with the §5.5 Dominant *Trait*
> names — Fortress Form → **Bastion Core**, Phase Collapse →
> **Event Horizon**, Combustion Engine → **Star Furnace**. Every entry
> carries a full stat block (modifiers / active ability / +10 SIG per DR-007 /
> LACE commentary), and every LACE line passes the T-530 voice gate.

---

## Section 6 — Combat System

### 6.1 Grid

- Combat rooms: **randomised, each side 10–14 tiles** (varied rectangular rooms; updated 2026-06-02 from the original fixed 7×7 — fights felt cramped and samey).
- Boss rooms: **14×14 tile grid** (the largest arena).
- Special rooms (event rooms): may use irregular layouts.

**Room-size roadmap — toward 100×100.** The design target is much larger, explorable rooms (up to ~100×100). This is *not* limited by the turn engine — its per-turn cost is O(enemies), independent of tile count (TDD §7.3) — but by presentation. The current 10–14 ceiling keeps a room legible whole-on-screen on a phone; scaling past ~15 per side requires, in order: a **scrolling camera** that follows the player, **fog of war + viewport culling** (render only seen/on-screen tiles, §6.1a), and **pathfinding enemy AI** (greedy chase gets stuck on walls in large rooms). Until those land, rooms stay in the 10–14 band.

#### 6.1a Visibility & Fog of War

Two layers of fog (updated 2026-06-02):

- **Map fog (floor minimap):** room outlines are shown but room *type* is hidden until visited; safe rooms are revealed from floor start (see §7.2).
- **In-room fog (tactical, line-of-sight):** inside a room the player sees only tiles within their vision radius / line of sight; unseen tiles and the enemies on them are hidden until revealed by exploring. **Enemies have vision too** — they stay dormant until they detect the player (line of sight / aggro range), rather than all acting from the moment the room loads. This makes large rooms tense and exploratory and stops a whole room aggroing at once.

Tile types: Open, Wall, Hazard (damage on entry), Cover (-50% incoming ranged), Elevated (+10% damage out), Corruption (spreads 1 tile/turn).

### 6.2 Turn Structure

**Player turn:** 3 AP (modified by mutations/items), actions in any order until AP exhausted or end-turn pressed.

**Enemy turn:** All enemies act in descending speed order. Each enemy *decides and acts* against the live board on its turn — there is no pre-committed telegraph for baseline AI. A chaser attacks if the player is in reach, otherwise it closes distance. This is **planning combat** (Heroes 3 / Fire Emblem model), not reaction combat: the player plans from the legible, deterministic ruleset and from visible threat information (shapes, stats, reach), not from a previewed intent icon. *(Revised 2026-05-28 — see §6.2.1.)*

**6.2.1 Why no baseline telegraph.** An earlier design previewed each enemy's next-turn action above its head. It was cut: (1) a committed-a-turn-ahead intent makes an enemy act on stale information — e.g. it arrives adjacent but can't strike until the *following* turn, a visibly wasted round; (2) for a stats-and-build roguelite the depth should come from mutation interactions and positioning, not a dodge-the-telegraph loop; (3) deterministic, legible AI already lets the player reason about what happens next without a floating label. The "Think, Don't React" pillar is *strengthened* by this: reasoning replaces pattern-memorization.

**Threat information (in lieu of telegraphs):** the UI surfaces *spatial* threat — which enemies are in reach of the player this turn (a "! in reach" marker), enemy reach overlays, shape/colour/border encoding — all derived from the rules, not a preview of committed intent.

**Scripted wind-ups (reserved):** the `telegraph` field survives on enemy state for *hand-authored* moments only — boss charge-ups and multi-turn specials where a deliberate, readable tell is the point. Baseline enemies never set it.

### 6.3 Action Details

- **Move:** 1 AP per tile, default 1 tile/AP (AGI may extend). Diagonals allowed. Cannot pass enemies or walls.
- **Basic attack:** 1 AP. Damage = STR × 1.0 (melee) or STR × 0.8 (ranged with ranged equipment). Range 1 tile melee default.
- **Abilities:** Granted by mutations/items. 1–3 AP. Cooldown 0–5 turns. Scales with INT. Player assigns active abilities to a 6-slot Ability Bar.
- **Item use:** 1 AP. Consumables, no cooldown (limited by inventory).
- **Wait:** 0 AP, ends turn — pass to let enemies act (e.g. bait them into reach) without spending AP.

### 6.4 Damage Types

| Type     | Source             | Blocked by    | Status applied  |
| -------- | ------------------ | ------------- | --------------- |
| Physical | Melee / crushing   | RES           | Stagger         |
| Thermal  | Fire / heat        | Thermal RES   | Burn (5/turn)   |
| Void     | Drain / phase      | Void RES      | Suppressed      |
| Spore    | Fungal / poison    | Myco RES      | Infected        |
| Seismic  | Crystal / mineral  | Lithic RES    | Fractured       |
| Pressure | Water / depth      | Pressure RES  | Crushed         |
| True     | Certain abilities  | Nothing       | None            |

### 6.5 Status Effects

- **Burn:** 5 dmg/turn for 3 turns. Stacks.
- **Infected:** -5 RES for 4 turns.
- **Stagger:** Target loses 1 AP next turn.
- **Suppressed:** No active abilities for 2 turns.
- **Fractured:** +20% damage taken from all sources for 2 turns.
- **Crushed:** Move range → 1 tile for 2 turns.
- **Rooted:** Cannot move for 2 turns (can attack).
- **Phased:** Untargetable for 1 turn.
- **Regenerating:** +5 HP at turn start for 3 turns.
- **Overheated:** Thermal Burn variant — 8 dmg/turn, 2 turns.

### 6.6 Critical Hits

Base crit chance: 5%. Multiplier: 1.5×. Increased by AGI, Voidborn mutations, certain items. On crit: visual flash + LACE one-liner from a 20-line crit pool (player crits) and a 20-line pool (player crit-hit).

### 6.7 Death & Revive

When HP reaches 0, the run ends. There is **no automatic revive**.

- **First revive per run:** Free via rewarded ad **only** (DR-010 — the 75-Shard-Crystal alternative is removed; money never buys survival).
- **Second revive:** **NOT AVAILABLE.** Cap is 1 per run.
- Revive restores player to **50% HP** in the room where they died. Enemies in the room are reset to full HP.
- Revive is offered **AFTER** the "What You Became" share screen to protect the emotional moment (UFD S031 → S033).
- If the ad fails to load/fill (offline, no inventory), the revive is unavailable — graceful degradation per E030/E031, no goodwill grant.

`death_cause` enum (locked, for analytics): `enemy_kill`, `boss_kill`, `hazard`, `status_tick`, `surrender`, `mutation_backfire`.

---

## Section 7 — Floor & Dungeon Generation

### 7.1 Floor Structure

The VEIN has 20 floors across **4 Zones of 5 floors each**. Each Zone has a distinct biome theme, enemy palette, and environmental hazard set. Strand Events occur between Zones.

| Zone | Floors | Biome                       | Dominant enemies                    | Hazards                |
| ---- | ------ | --------------------------- | ----------------------------------- | ---------------------- |
| 1    | 1–5    | The Shallows (cave tunnels) | Filterers, Crawlers, Scavengers     | Acid pools             |
| 2    | 6–10   | The Mycosphere (fungal forest) | Fungal colonies, Bloom Beasts    | Spore clouds, Rot patches |
| 3    | 11–15  | The Lithic Deep (crystal caverns) | Crystal Golems, Mineral Wraiths | Shard storms, Cave-ins |
| 4    | 16–20  | The Convergence (VEIN core) | Apex Predators, Void Entities       | Void tears, Thermal vents |

### 7.2 Floor Generation Algorithm

1. Generate room count (8–14 rooms per floor, RNG)
2. Place START and BOSS rooms (never adjacent)
3. Fill remaining rooms from weighted pool:
   - Combat 40% · Loot 20% · Safe 15% (min 1/floor) · Merchant 10% (min 1 on floor 3+) · Trap 10% · LACE event 5%
4. Connect rooms with corridors (guaranteed path to boss)
5. Place environmental hazards (1–3 per combat room)
6. Place Codex Fragments (0–4 per floor, non-boss rooms)
7. Seed enemy placements

Minimap shows room outlines but not room type until visited. Safe-room locations are revealed (green) from floor start — the player should always be able to find rest. This is the **map-fog** layer; the in-room tactical line-of-sight fog (player + enemy vision) is specified in §6.1a.

### 7.3 Room Types

**Combat:** 2–6 enemies on spawn tiles, hazards placed after, loot drops on death, cleared = stays cleared.

**Safe:** No enemies, no entry by enemies. Rest Point (restore 30% HP), inventory access, ability bar management. One per floor minimum. LACE narrates reflection on player state.

**Merchant (VEIN Dispenser):** Crystalline autonomous vending construct. Sells 4–6 randomly selected items from the floor's item pool. Prices in VEIN Crystals. Items refresh once per floor on return. One per floor on floors 3+, two per floor on floors 10+. Rewarded ad can refresh inventory once per merchant.

**Loot:** No enemies. 1 guaranteed item (floor-appropriate tier). May contain 1 Codex Fragment. May contain VEIN Crystals (50–200 by floor).

**Trap:** Entry triggers a trap configuration. Player navigates to exit without stepping on triggered tiles. Turn-based: traps activate on enemy phase. Clearing rewards bonus VEIN Crystals + chance of rare loot.

**LACE Event Room (5% weight):** LACE presents a narrative choice with mechanical consequences. Examples:
- *"A previous Sigma-carrier left something here. Take it?"* — YES: gain a random item, 30% chance cursed. NO: +5 SIG, LACE approves.
- *"The VEIN is offering you an early adaptation."* — YES: gain a random Minor mutation immediately (fills the **bonus mutation slot**, grants **+5 SIG only**). NO: +20 VEIN Crystals, LACE neutral. **If the bonus slot is already occupied (Proto-Strand taken — the common case), this option is replaced by +40 VEIN Crystals (DR-009b).**
- *"Something is following you. Engage it?"* — YES: bonus elite combat encounter, rare loot on win. NO: lose 10 HP, LACE says nothing.

### 7.4 Boss Rooms (revised per DR-008 — two-tier boss system)

**Floor Boss rooms (floors 1–4, 6–9, 11–14, 16–19):**

- Standard combat-room size band (10–14 per side, §6.1)
- Locked door (one-way — cannot return to previous rooms)
- LACE templated one-line intro (fragment-assembled, not hand-written)
- Floor Boss is template-composed (§8.4a): zone archetype + scaled stats + 2-phase generic pattern
- On defeat: Boss Loot (1 guaranteed item, Uncommon+), Codex Fragment (25% chance)

**Zone Warden rooms (floors 5, 10, 15, 20):**

- **14×14 grid** — the largest arena (aligned with §6.1; the prior 10×10 figure in this section is superseded)
- Locked door (one-way)
- LACE pre-fight narration (3–4 hand-written lines)
- Warden has unique visual + 3 phase patterns and bespoke AI
- On defeat: Warden Loot Chest (guaranteed 2 items, 1 Rare+), Codex Fragment (50% chance)
- Strand Event triggers after the Floor 5, 10, 15 Warden defeats only; Floor 20 Warden leads to the Convergence

### 7.5 Floor Difficulty Scaling

Enemy stats scale with floor (Floor 1 is the authored baseline):
- HP: Base × (1 + (floor − 1) × 0.08)
- Damage (STR): Base × (1 + (floor − 1) × 0.06)
- RES / AGI / INT: No scaling (enemies stay killable; stable crit + AI)
- Speed: No scaling (keeps combat readable)
- New abilities unlock for enemy types at floors 5, 10, 15

> **Tuning note — 2026-06-11 (T-524).** Coefficients retuned from the original
> 0.15 / 0.12 (and a light STR pass on the Zone-4 true-damage stat blocks —
> true damage ignores RES, so Zone 4 was an unsurvivable wall): the CI balance
> harness proved that at the original values a competent player cleared
> Floor 15+ at exactly **0%** — the five §2.8 endings behind the Floor 20
> Convergence were unreachable, violating the DR-008/T-524 intent that the
> Apex be *punishing but reachable*. The **live measured curve is published
> per commit** as the `clear-rate-curve` CI artifact (T-504) — quoting numbers
> here goes stale with every content drop (the Proto-Strand, the boss phases,
> and each mutation/item tier landing all moved it). The harness enforces a
> Floor-20 clear-rate band of **[2%, 30%]** (`balance.test.ts`), so any change
> that walls off the endings — or trivialises the Apex — fails CI. As of
> 2026-06-12 (full 66-mutation roster + full item tiers): F1 100% / F5 100% /
> F10 57% / F15 23% / F20 20%. Code source of truth: `core/run/scaling.ts` +
> `core/turn-engine/boss-phases.ts` + `packages/content/`.

Item tier scales with floor:
- Floors 1–5: Common only
- Floors 6–10: Common + Uncommon
- Floors 11–15: Uncommon + Rare
- Floors 16–20: Rare + Legendary

---

## Section 8 — Enemy Design

### 8.1 Enemy Design Principles

- Every enemy resolves exactly one action per turn, decided against the live board — behaviour is deterministic and legible (no hidden rolls, no ambiguity)
- **Shape** encodes primary behavior: Circle (mobile), Triangle (aggressive), Square (defensive), Hexagon (ability user), Star (summoner/support)
- **Color** encodes damage type (matches family colors)
- **Border thickness** encodes tier (1px common, 2px uncommon, 3px elite)

### 8.2 Enemy Tiers

| Tier     | Appears     | AI                                       |
| -------- | ----------- | ---------------------------------------- |
| Common   | Floor 1+    | Basic (move → attack)                    |
| Uncommon | Floor 4+    | 2-action (move + special cycle)          |
| Elite    | Floor 8+    | 3-phase, can buff/debuff                 |
| Floor Boss | 1 per non-Warden floor (16 total) | Template-composed (§8.4a): zone archetype + scaled stats, 2-phase pattern at 50% HP |
| Zone Warden | Floors 5 / 10 / 15 / 20 (4 total) | Bespoke unique AI, phase transitions at 66% / 33% HP |
| Apex     | Floors 16–20 | Multi-phase, environmental use          |

### 8.3 Enemy Catalogue (Overview — full stats in Appendix B)

> The named "Boss" in each zone list below is that zone's **Zone Warden** (DR-008). The 16 Floor Bosses are template-composed (§8.4a) and are not individually catalogued — their recipes live in `packages/content/floors/` boss descriptors.

**Zone 1 — The Shallows:**

- Filterer (Circle, Blue) — Moves toward player, basic melee
- Cave Crawler (Triangle, Grey) — Charges in straight lines
- Acid Spitter (Hexagon, Green) — Ranged acid attack, creates hazard tiles
- Scavenger (Star, Yellow) — Summons 2 Filterers on first hit taken
- **Boss — The Pressure Warden** — Massive square, creates zone pressure fields

**Zone 2 — The Mycosphere:**

- Spore Drifter (Circle, Green) — Leaves infected tiles on movement
- Bloom Beast (Triangle, Green) — Melee with Infected status effect
- Root Anchor (Square, Green) — Immobile, roots player if adjacent
- Mycel Host (Hexagon, Green) — Buffs adjacent enemies with regen
- **Boss — The Grandmother Bloom** — Room-wide spore pulses, spawns Drifters

**Zone 3 — The Lithic Deep:**

- Crystal Shard (Triangle, Amber) — Fast, shatters on death (AoE)
- Mineral Wraith (Hexagon, Amber) — Phases into walls, emerges to attack
- Stone Sentinel (Square, Amber) — High RES, reflects physical damage
- Fault Walker (Circle, Amber) — Creates seismic hazard tiles on movement
- **Boss — The Lithic Archon** — Grows crystal armor phases, summons shards

**Zone 4 — The Convergence:**

- Void Tendril (Circle, Violet) — Drains AP (costs player 1 AP next turn)
- Apex Predator (Triangle, Red) — Highest raw damage in the game
- Convergence Echo (Star, White) — Copy of the player's current mutation set
- Thermal Colossus (Square, Red) — Burns all tiles it moves through
- **Boss — The Awakened Lattice** — Final boss; all damage types, all phases

### 8.4 Zone Warden Design Principles (revised per DR-008)

- Pre-fight LACE narration (3–4 lines of context, hand-written)
- Phase 1 (100–67% HP): establishes core mechanic
- Phase 2 (66–34% HP): adds complication (new ability or hazard)
- Phase 3 (33–1% HP): becomes dangerous (faster, more abilities)
- Unique visual reaction to the player's dominant mutation family (e.g., Leviathan Warden deals less damage to Abyssal players)
- Death line from LACE, context-specific to the player's build

### 8.4a Floor Boss Template System (DR-008)

Floor Bosses are **data, not bespoke design** (per TDD P7). Each is a JSON descriptor composing:

- **Base archetype:** one enemy type from the zone palette (visual = enlarged shape, 4px border, zone accent glow)
- **Stat scale:** archetype stats × a floor-boss multiplier (provisional ×3 HP, ×1.5 damage; tuned via the balance harness)
- **Ability loadout:** 1–2 abilities drawn from the zone's existing ability pool
- **Phase pattern:** generic 2-phase template — at 50% HP, gain +1 ability use per turn OR spawn 1 zone hazard pattern (descriptor chooses which)
- **Zone gimmick arrangement:** each zone defines one signature hazard-tile arrangement for its Floor Boss rooms (e.g., Mycosphere boss rooms always flank the arena with spore tiles), so rooms feel authored without per-boss work
- **LACE treatment:** templated one-line intro and defeat fragments; no hand-written narration

Authoring budget: ~1 hour per Floor Boss descriptor. No new AI code per boss — the template's behaviors are implemented once in the turn engine.

> **Code reality note (2026-06-09):** all 16 Floor Bosses (and the 4 Wardens) are *already authored* as individual enemy JSONs in `packages/content/enemies/` with per-floor `bossId`s — DR-008 therefore **reclassifies** existing content (tier split `floor_boss` / `zone_warden`, loot + VEIN + LACE treatment per tier) rather than commissioning new bosses. The template rules above govern future boss authoring and the treatment differences between the two tiers.

---

## Section 9 — Item & Loot System

### 9.1 Item Tiers

| Tier      | Color | Floors | Drop chance | Slot                |
| --------- | ----- | ------ | ----------- | ------------------- |
| Common    | White | 1–10   | 60%         | Consumable / Passive |
| Uncommon  | Green | 4–15   | 25%         | Passive / Active     |
| Rare      | Blue  | 8–20   | 12%         | Active / Equipment   |
| Legendary | Gold  | 14–20  | 3%          | Equipment            |

### 9.2 Item Categories

**Consumables (single use):**

- VEIN Serum (Common) — Restore 25 HP
- Deep Serum (Uncommon) — Restore 50 HP
- Sigma Catalyst (Uncommon) — +5 SIG for current run
- Adaptation Fluid (Rare) — Re-roll one mutation in next Strand Event
- Null Grenade (Common) — 30 True damage in 2×2
- Spore Bomb (Uncommon) — Infect all enemies in 3×3
- Crystal Shard Grenade (Uncommon) — Fracture all enemies in line

**Passives (3 slots max):**

- Depth Gauge (Common) — +10 HP
- Resonance Coil (Uncommon) — +5 SIG
- Fault Liner (Common) — +5 RES
- Void Lens (Rare) — +15% crit
- Myco Weave (Uncommon) — Regen 3 HP/turn in combat
- Thermal Core (Rare) — All attacks add Burn
- Pressure Ring (Common) — Melee Crushed chance 20%

**Equipment (2 slots max):**

- Abyssal Claw (Uncommon) — Melee: Crushing + Pressure
- Spore Lance (Rare) — Ranged: Infected on hit
- Crystal Blade (Uncommon) — Melee: Fractured on crit
- Void Tether (Rare) — Pull enemy to adjacent tile (2 AP)
- Thermal Gauntlet (Rare) — Melee: Burn on every hit
- Lattice Shield (Legendary) — Block next attack, reflect 50%
- Echo Anchor (Legendary) — Lock enemy in place 3 turns (True)
- Sigma Lens (Legendary) — Double SIG bonus of next Strand mutation

### 9.3 Cursed Items

Cursed Items have a powerful positive and an always-active negative passive. Red border. Cannot be removed once equipped (until run ends or Purge Serum used).

Examples: Hungry Blade (+50% melee, -3 HP per attack); Void Eye (see HP, +20% void damage taken); Fever Root (+8 HP/turn, no active abilities).

> **AMENDMENT — 2026-06-12 (T-312).** The launch trio ships as flat-modifier
> approximations of the sketches above, since item modifiers are flat stat
> deltas (TDD §8-adjacent convention; percent/per-turn item effects are a
> future engine feature): **Hungry Blade** +6 STR / −8 max HP · **Void Eye**
> +6 INT / −4 RES · **Fever Root** +24 max HP / −1 max AP. The curse rules are
> engine-enforced and tested: cannot be dropped or swapped out once carried;
> removed only by run end or a Purge effect (`purgeCursed`); red-marked in
> every inventory surface.

### 9.4 Loot Drop Rules

- Common enemies: 50% chance, 1 item (Common)
- Uncommon enemies: 75% chance, 1 item (Common/Uncommon)
- Elite enemies: 100% chance, 1 item (Uncommon/Rare)
- Floor Boss: Guaranteed 1 item (Uncommon+) — per DR-008
- Zone Warden: Guaranteed 2 items (1 Rare+, 1 random) — per DR-008
- Loot room: 1 guaranteed item (floor-appropriate tier)
- Merchant: 4–6 items for purchase; refresh once per floor; 1 rewarded-ad refresh per merchant

### 9.5 Inventory

- Consumables: 6 slots
- Passives: 3 slots
- Equipment: 2 slots

Items beyond slot limit cannot be picked up (drop first). Inventory accessed in Safe Rooms or between combat rounds (pausing).

---

## Section 10 — NPC & LACE System

### 10.1 LACE — Primary AI Narrator

**LACE (Latent Adaptive Cognition Engine)** is the game's narrative voice and personality system. It is not a menu. It is not a tutorial guide. It is the VEIN's intelligence, and it has been here a very long time.

**LACE speaks at these moments:**

- Floor entry (2–3 lines on biome/theme)
- Safe-room entry (reflection on current build/state)
- Strand Event (one line per card + reaction to choice)
- Boss pre-fight (3–4 lines of context)
- Boss defeat (1–2 lines, contextual to build)
- Death (2–3 lines, never mocking)
- Achievement unlocked (1 line in LACE voice)
- Run-end "What You Became" screen (4–6 lines build summary)
- Codex fragment found (1 line)
- LACE event rooms (full dialogue with player choices)
- Critical hit (1 line from pool of 20)
- Crit hit on player (1 line from pool of 20)

**LACE's Moods (state machine):**

| Mood          | Triggered by                                |
| ------------- | ------------------------------------------- |
| Curious       | Unexpected build choices; first reaching new floor |
| Clinical      | Optimal / safe play; many defensive choices |
| Amused        | Risky / creative play                       |
| Contemptuous  | Death loops (repeated death to same thing)  |
| Reverent      | Floor 16+ reached; hybrid synergy unlocked  |

Mood persists across runs but drifts toward neutral over time. Mood selection is deterministic given player history (see TDD §9.4).

**LACE never:**

- Gives direct gameplay instructions ("go left", "hit the weak point")
- Breaks the fiction ("menu", "screen", "tap", "button")
- Mocks the player cruelly on death
- Repeats the same line twice in one run

### 10.2 LACE Writing Scale & Production Plan

Target dialogue lines for Path A launch:

| Category                    | Lines               |
| --------------------------- | ------------------- |
| Floor-entry lines           | 100 (20 zones × 5 moods) |
| Mutation-card commentary    | 80 (40 mutations × 2)  |
| Mutation-choice reaction    | 120 (40 × 3 moods)  |
| Safe-room reflections       | 80 (20 floors × 4 states) |
| Death narrations            | 100 (20 floors × 5 causes) |
| Zone Warden pre/post fight  | 24 (4 Wardens × 6, hand-written) |
| Floor Boss templated fragments | ~24 (intro + defeat fragments per zone, grammar-assembled) |
| Achievement lines           | 100 (50 × 2)        |
| Critical-hit pool           | 40 (20 + 20)        |
| Hub idle quips              | 50                  |
| Strand Event narration      | 60                  |
| Hybrid Synergy reactions    | 20                  |
| Wild-card reactions         | 30                  |
| Mood-shift transitions      | 40                  |
| **TOTAL lines**             | **~1,500–2,000**    |
| Codex entries               | ~6,400 words (80 entries × ~80 words) |

**Production plan (per DR-004):**

1. **Default plan — templated assembly.** Build the LACE engine (TDD §9) around tagged JSON fragments from day one. Director writes 400–500 fragments tagged by `[event_type, mutation_family, mood, player_state]`, grammar-assembled at runtime.
2. **Quality upgrade — writer hire.** Initiate contracting in Month 4–6. Budget $5,000–$10,000 for 1,000–1,500 hand-crafted lines. Hand-crafted lines replace templated fragments file by file. No engine change.
3. **Fallback:** if writer doesn't sign by Month 6, templated assembly ships as v1.0. Writer quality pass in Season 1.

AI runtime generation is **REJECTED** (tone consistency + offline-first requirement).

### 10.3 The VEIN Vendor (Dispenser)

A crystalline autonomous construct LACE refers to as a "Dispenser." Not human. Not hostile. Does not speak. Offers items in exchange for VEIN Crystals.

Visual changes by Zone:

- Zone 1: Rough stone formation with a faint blue glow
- Zone 2: Fungal cluster shaped like a torso, items growing from it
- Zone 3: A perfect geometric crystal tower, slots carved into it
- Zone 4: A shimmering void-form — barely visible, items floating

### 10.4 Sigma Echoes

In Safe Rooms on floors 3+, the player may encounter a Sigma Echo — a ghost-like replay of another player's final moments in that room (using run data from the global player database).

- Visual only (no interaction)
- Shows the other player's mutation visual (what they became)
- Shows 3–5 seconds of their final combat actions
- LACE delivers one line: *"A prior iteration. They made it this far."*
- Finding a Sigma Echo unlocks a Codex entry ("Prior Iterations")
- **Capped at 3 fetches per run** (backend cost discipline; TDD §11.4)

This is the social/multiplayer layer — players see each other's runs without direct competition. Ghosted presence rather than PvP.

### 10.5 Codex Keeper

In the hub between runs, the player accesses the Codex through a "Keeper" interface — a text-based journal that LACE has kept. All unlocked entries appear here. LACE narrates the opening of each new entry in its own voice.

The Codex builds the full lore of the VEIN, LACE's origins, and what happened before.

Codex tabs:
- **Codex** (base 80 entries) — 100% completion possible without subscription
- **Pass Archive** (Pass-only bonus entries, ~10 per season) — separate completion bar, accessible to non-subscribers as a preview/CTA

(DR-006b — see §15.)

---

## Section 11 — Progression & Meta-Progression

### 11.1 In-Run Progression (Resets on Death)

- Player level (1–20, XP from kills)
- Stat points allocated
- Mutations acquired (1–4)
- Items collected
- VEIN Crystals held
- SIG resonance accumulated

### 11.2 Meta-Progression (Permanent, Survives Death)

All passive effects in this section are labeled **[META]** in UI surfaces to distinguish them from in-run Dominant Trait effects (§5.5) labeled **[IN-RUN]**.

**Sigma Strains** (30 total at launch — Path A): permanent passive bonuses unlocked through achievements. Never make the game trivial — they provide nudges, not power spikes.

| Sigma Strain          | Unlock condition              | Effect                                                         |
| --------------------- | ----------------------------- | -------------------------------------------------------------- |
| Resilient Baseline    | Complete 5 runs               | +5% max HP                                                     |
| Adapted Eyes          | Reach Floor 5                 | See room types on minimap                                      |
| Early Adaptation      | Reach Floor 10                | 1st mutation card matches last family                          |
| Vein Memory           | Reach Floor 15                | LACE hints at next floor biome once/run                        |
| Thermal Resistance    | Kill 100 Thermal enemies      | -10% thermal damage received                                   |
| Abyssal Affinity      | 10 runs with Abyssal          | Abyssal items appear more often in shops                       |
| Void Sense            | Die to Void enemy 5 times     | Void enemies' next action is revealed (player-granted tell — foresight as an earned edge, not a baseline) |
| **True Convergence**  | Complete a run (Floor 20)     | Wild mutation always offered in Strand Events (shipped as: one extra wild card on every cadence draw) |
| **Convergence Echo**  | 200 runs completed            | Carry 1 random mutation from last run into next                |
| Pressure Acclimation  | Kill 100 Pressure enemies     | -10% pressure damage received                                  |
| Spore Tolerance       | Kill 100 Spore enemies        | -10% spore damage received                                     |
| Seismic Bracing       | Kill 100 Seismic enemies      | -10% seismic damage received                                   |
| Void Inoculation      | Kill 100 Void enemies         | -10% void damage received                                      |
| Callused Hide         | Kill 200 Physical enemies     | -5% physical damage received                                   |
| Mycelial Symbiosis    | 10 runs with Mycelial         | Mycelial items appear more often in shops                      |
| Lithic Kinship        | 10 runs with Lithic           | Lithic items appear more often in shops                        |
| Voidborn Pact         | 10 runs with Voidborn         | Voidborn items appear more often in shops                      |
| Thermal Communion     | 10 runs with Thermal          | Thermal items appear more often in shops                       |
| Ember Sense           | Die to Thermal enemy 5 times  | Thermal enemies' next action is revealed                       |
| Pressure Sense        | Die to Pressure enemy 5 times | Pressure enemies' next action is revealed                      |
| Tremor Sense          | Die to Seismic enemy 5 times  | Seismic enemies' next action is revealed                       |
| Vein Attunement       | Kill 500 enemies (lifetime)   | +5% VEIN from all sources                                      |
| Vein Mastery          | Kill 2,000 enemies (lifetime) | +5% VEIN from all sources (stacks with Vein Attunement)        |
| Crystal Lattice       | Complete 3 runs to Floor 20   | +10% Shard conversion at run end                               |
| Shard Resonance       | Complete 10 runs to Floor 20  | +10% Shard conversion at run end (stacks with Crystal Lattice) |
| Initiate's Cache      | Complete 1 run                | Begin each run with 25 VEIN                                    |
| Provisioned Descent   | Complete 50 runs              | Begin each run with 100 VEIN                                   |
| Deep Resilience       | Complete 5 runs to Floor 20   | +5% max HP (stacks with Resilient Baseline)                    |
| Survivor's Instinct   | Kill 1,000 enemies (lifetime) | +5% max HP                                                     |
| Iron Baseline         | Complete 100 runs             | +5% max HP                                                     |

(Naming de-duplicated per Patch 11: the strain formerly called "Sigma Prime" is renamed **True Convergence**; "Convergence Echo" is exclusively a strain, not an Origin.)

> **Amended 2026-06-12 (T-306):** the full 30-strain roster is shipped as content (`packages/content/sigma-strains/`, machine-counted by the bundle gate). Unlock milestones evaluate automatically at run end against new lifetime counters (kills per damage type, deaths per killing-blow type, runs per most-stacked family — meta save v5). Numeric effects (max HP, typed resists, VEIN/Shard bonuses, starting VEIN) and the Strand-draw effects (extra wild card, first-card-matches-last-family, run-carry) are live in the engine; the four *information* effects (minimap room types, LACE biome hint, enemy intent reveal, shop family bias) ship as typed marker effects whose scene wiring is tracked with the E-4 screens. Stacking max-HP strains total +20% at the 100-run/1,000-kill long tail — accepted as within the "nudges" contract.

**Codex:** 80 base lore entries + Pass Archive (see §10.5). Permanent unlocks. No gameplay effect.

**Cosmetics:**

- Origin skins (visual variant for the starting character shape)
- LACE voice/text tone packs (formal, sardonic, clinical, warm)
- Mutation visual variants (same mechanics, different aesthetic)
- Run-end title cards ("The Abyssal One," "Architect of Ruin")

All cosmetics are purely visual. Zero gameplay impact.

**Origins:** Unlocked by run-count milestones. See §4.1.

### 11.3 Achievement System

Achievements are delivered by LACE in its voice. They reward unusual, creative, or skillful play. Each achievement unlocks a Sigma Strain, a Codex entry, or a cosmetic.

Examples:

- **Convergent** — Reach Floor 20. (Unlocks True Convergence strain)
- **The Purist** — Complete a run using only 1 genetic family. (Cosmetic)
- **Against the Grain** — Win a run with all 3 mutations from different families. (Unlocks "Sigma Prime" Origin skin)
- **Patient Zero** — Infect 50 enemies in a single run. (Codex entry)
- **Glass Monarch** — Reach Floor 15 with <20% HP. (Title card)
- **The Long Way** — Clear every room on floors 1–10 in a single run.
- **LACE's Favourite** — Trigger LACE's "Amused" mood 10 times in one run.

---

## Section 12 — User Interface & UX

(Detailed screen-by-screen specifications live in the User Flow Diagrams. This section provides the visual/UX guidelines that bind the UFD.)

### 12.1 Main Menu (S017 Hub)

- Strand Descent logo (animated — strands of DNA gently separating)
- "DESCEND" button (start new run)
- "CONTINUE" button (resume interrupted run)
- "CODEX" button
- "COLLECTION" (cosmetics, Sigma Strains, Achievements)
- "SETTINGS" button
- LACE whisper (ambient one-line quote, rotates per session)

### 12.2 Run Start Screen (S018 Origin Select, S021 Run Preview)

- Origin selection (swipe left/right through available Origins)
- Origin tooltip: name, starting bonus, unlock requirement
- "ENTER THE VEIN" confirm button
- LACE narrates the Origin choice on confirm
- Run preview confirms seed, modifiers, Strains

### 12.3 In-Run HUD (S023 FloorScene)

**Top bar:** HP bar (red) / current HP value · Floor indicator ("FLOOR 7 — THE MYCOSPHERE") · VEIN Crystals count

**Bottom bar:** Minimap (tap to expand) · Ability bar (6 slots, swipeable) · Inventory quick-access

**Over character:** Level indicator · SIG bar (fills as mutations acquired)

**Over enemies:** HP bar · Threat marker (in-reach indicator; scripted wind-up icon when present) · Status effect icons

### 12.4 Combat UI

- Grid displayed as top-down view
- Tap a tile to move (highlights green if valid)
- Tap an enemy to target with selected ability
- Ability bar at bottom: tap ability to select, then tap target/tile
- "END TURN" button: large, always visible, bottom-right
- Tap character portrait to open full stats mid-combat
- Two-tap confirm for first 5 runs (MetaState flag); single-tap thereafter (toggleable in S093)

### 12.5 Strand Event UI (S060-S071)

- Full-screen overlay
- LACE narration appears at top (typewriter animation)
- Three Mutation Cards displayed below
- Each card: tap to expand details; tap again to collapse; "SELECT" button when expanded
- Tap-and-hold a card to mark it as the reroll target
- "Adaptation Token" / "Watch ad to reroll" bottom-left (rerolls 1 card)
- No timer. Player dwells as long as they want.
- After selection: card flies into character model, visual update plays
- LACE reacts in 1–2 lines

### 12.6 Minimap

Always visible (bottom-left during exploration). Shows: explored rooms (solid outlines), unexplored (faint dotted), Safe rooms (green), current room (pulsing), Boss room (red, always shown from floor entry). Color-blind-friendly: shape glyphs (pentagon = boss, circle = safe, triangle = merchant) in addition to colors.

Tap to expand to full-screen minimap.

### 12.7 Death Screen (S030)

- **"STRAND SEVERED"** header (in-fiction phrase referring to genetic strands; not "YOU DIED")
- LACE narration (2–3 lines, contextual to how player died)
- Stats panel: floor reached · enemies defeated · mutations acquired (visual icons) · VEIN Crystals collected · Codex fragments found · time played
- "WHAT YOU BECAME" button → S031
- "SHARE" button → Scope 8 share flow
- "RETURN" button → main menu
- **Revive offer (S033) shown AFTER share** to protect emotional moment

### 12.8 "What You Became" Screen (S031)

The game's signature screen and the entire organic UA engine. Shows:

- Final organism visual (full render of evolved character)
- Mutation list with icons
- **Memorable organism name** (algorithmic, deterministic per seed) — examples: "The Mycelial Sovereign", "Voidborn Heretic", "Pressure Saint of the Third Descent", "Pale Crystal Warden, Untouched"
- LACE's final assessment (4–6 lines, references the specific mutations)
- Auto-included tagline: *"I became [name] in Strand Descent. What will you become?"*
- Portrait generation: **1080×1920 vertical AND 1080×1080 square**, client-side; skeleton if >2s
- Frame variants for Deep Signal Pass subscribers (cosmetic only; non-subs see "More frames →" CTA)
- One-tap share to: TikTok, Reddit, Discord, Instagram Stories, iOS Messages, Android share sheet
- Per-share unique URL with install attribution (Branch.io free tier; see TDD §10/§20)
- Codex entry auto-added: "Run #[N] — [Organism Name]"

KPI to track: `organism_share_tapped` → install attribution rate. **Target >3%.**

---

## Section 13 — Art Direction

### 13.1 Visual Philosophy

Strand Descent uses a geometric minimalist visual language. **No hand-drawn sprites or illustrated characters.** All game entities are represented through shapes, colors, particles, and icon overlays.

This serves both the constraint of a solo developer and the game's aesthetic identity: the VEIN is clean, ancient, and precise — not chaotic or dirty. The art should feel like a very advanced laboratory that has been running for 60,000 years.

### 13.2 Color Palette

| Token             | Hex         |
| ----------------- | ----------- |
| Background        | `#0A0E1A`   |
| UI base           | `#12192B`   |
| UI borders        | `#1E2D4A`   |
| Text primary      | `#E8EDF5`   |
| Text secondary    | `#7A8FAD`   |
| **LACE text**     | **`#A0FFDC`** (pale teal — distinctive, unmistakable) |

**Family accent colors:**

- Abyssal: `#1A6FD4`
- Mycelial: `#2DB55D`
- Lithic: `#D4841A`
- Voidborn: `#8B3FD4`
- Thermal: `#D43A1A`

**Rarity colors:**

- Common: `#9EA8B8`
- Uncommon: `#2DB55D`
- Rare: `#1A6FD4`
- Legendary: `#D4A017`

### 13.3 Entity Visual Language

**Player character:**

- Base shape: Rounded hexagon
- Base color: Neutral grey (`#6A7A8A`)
- Mutation Layer 1: Primary family color fills 30% of shape
- Mutation Layer 2: Secondary color fills additional 30%; shape distorts
- Mutation Layer 3: Full transformation — shape and color fully evolved
- Particle effects: Ambient particle system matching dominant family

**Enemies:** Circle (mobile), Triangle (aggressive), Square (defensive), Hexagon (ability user), Star (summoner). Border thickness 1px/2px/3px = common/uncommon/elite. Color = genetic family.

**Environment:**

- Floor tiles: Dark base with faint grid lines
- Walls: Solid shapes matching Zone biome color accent
- Hazard tiles: Animated (pulsing red/green/amber depending on type)
- Safe rooms: Warm white light — noticeably different from combat areas

### 13.4 UI Component Style

- Cards: Rounded corners (8px radius), dark background, thin colored border
- Buttons: Flat with hover state, text only (no gradients)
- HUD bars: Thin rectangular, no 3D effects
- Icons: Single-color flat icons, 24×24 grid
- Font: Monospace for LACE text; clean sans-serif for UI labels
- Animations: Functional only (no decorative animations that delay play)

### 13.5 Asset Pipeline (per TDD §21 Q2)

**Runtime-generated geometry via Phaser Graphics API.** All enemies, players, projectiles rendered via Phaser Graphics primitives (circles, polygons, lines). Each entity has a shape descriptor in its JSON.

SVG used **only** for static UI icons (mutation cards, menu icons, codex entries), stored as inline SVG strings in JSON. Color palettes per family centralized in `packages/balance/palettes.json`.

This keeps the install size under 80MB and lets the Director iterate by editing numbers, not redrawing sprites.

---

## Section 14 — Audio Direction

### 14.1 Music

Style: Ambient electronic / dark atmospheric. References: Arca, Ben Frost, Brian Eno (darker works).

**Structure:**

- Main menu: 1 ambient loop (~3 min, gentle pulse)
- Zone 1 exploration: Low drone, occasional metallic ring
- Zone 2 exploration: Organic textures, subtle rhythm
- Zone 3 exploration: Crystal tones, reverb-heavy
- Zone 4 exploration: Dense, dissonant, building tension
- Combat: Percussion-forward, family-specific accent instruments
- Boss combat: Distinct theme per Zone boss (4 themes total)
- Strand Event: Silence except for a single sustained tone
- Death: Music cuts to silence immediately
- CONVERGENCE ending: Adaptive music (5 variants per ending type)

### 14.2 Sound Effects

All SFX are functional — they confirm actions and convey information:

- Move: soft footstep (varies by floor type)
- Attack: impact thud (varies by damage type)
- Ability use: family-specific audio (watery burst, spore hiss, etc.)
- Enemy turn beat: distinct tick per enemy action as it resolves (move vs. attack); scripted wind-ups get their own cue
- Loot pickup: crisp chime
- Mutation acquired: deep resonant tone + visual flash
- LACE text: faint typewriter sound (can be disabled in settings)
- Critical hit: sharper impact + brief audio swell
- Death: silence — then LACE's voice begins after 1 second

### 14.3 LACE Voice

- v1.0: text only (no voice acting — solo dev constraint). LACE text uses `#A0FFDC` and monospace font.
- Season 2 target: LACE voice acting added (single voice actor). Tone: measured, genderless, slightly inhuman cadence.

### 14.4 Sourcing & Budget (per TDD §21 Q3)

**Royalty-free music library subscription** (~$15–30/month during development, ~$300 over 18 months) **+ 3–5 custom signature stings** ($500–$1,000 from a contractor) for the moments that matter: Strand Event reveal, boss fight, final-floor descent.

SFX: free libraries (Freesound, Sonniss bundles). License files maintained in `/docs/licenses/` for every track and SFX used.

---

## Section 15 — Monetization Design

### 15.1 Model Overview

Strand Descent is **free to play.** Revenue comes from three sources:

1. **Rewarded advertising** (opt-in only, never forced)
2. **Deep Signal Pass** (seasonal subscription, $4.99/month or $39.99/year)
3. **Cosmetic IAP** (one-time purchases, zero gameplay impact)

**What is never sold:**

- Gameplay power (no stat boosts, no extra mutations for pay)
- Energy systems (play as much as you want)
- Loot boxes with paid currency (no gacha)
- Forced ads (always opt-in)
- Floor skips or difficulty reducers

### 15.2 Rewarded Ads

**Available moments:**

1. Revive (1 per run): *"Watch to return with 50% HP"*
2. Strand re-roll (1 per run): *"Watch to re-roll **one** mutation card"* — player picks which card via tap-and-hold
3. Merchant refresh (1 per merchant): *"Watch to refresh inventory"*

**Rules:**

- Opt-in (player initiates)
- Shown at natural pause points only
- **Capped at 3 ads per run** (prevents abuse, preserves experience)
- 60-second cooldown between ads
- 10s load timeout; on fail, graceful degradation (no retry button, no goodwill grant)

### 15.3 Deep Signal Pass (Season Pass)

**Price:** $4.99/month or $39.99/year
**Seasons:** 8-week cycles (6–7 seasons per year)

**Pass includes (all cosmetic / lore / time-saving — never gameplay power):**

- **Origin SKINS** for Origins the player has already unlocked through play (DR-006a). Skins activate per Origin as that Origin is unlocked. Locked skins show in "Preview" state in S088 — never "Locked" framing.
- **LACE voice/text tone packs** (cosmetic)
- **"What You Became" share-screen frames** (cosmetic)
- **Exclusive run-end title cards** (cosmetic)
- **Codex Pass Archive entries** (DR-006b): live in a separate "Pass Archive" tab; base codex 100% remains achievable without subscribing. The "Complete the Codex" achievement references base codex only.

**Pass does NOT include:**

- Stat advantages
- Gameplay-affecting Origins (unlock-by-play only)
- Adaptation Tokens (earned only, see below)
- Exclusive mutations that affect balance
- Ad removal

**Marketing copy must say:** *"Pass unlocks skins for Origins you earn through play"* — explicitly, no fine print.

### 15.4 Cosmetic IAP

| Item                  | Price           | What it grants                                           |
| --------------------- | --------------- | -------------------------------------------------------- |
| Sigma Archive Pack    | $1.99 one-time  | 3 cosmetic Origin skins                                  |
| LACE Tone Pack        | $2.99 one-time  | 2 LACE voice/text tone variants                          |
| Organism Frame Pack   | $0.99 one-time  | 5 "What You Became" share screen frames                  |
| **"First Descent" Supporter Pack** (DR-011) | $9.99 one-time | Exclusive supporter share frame + exclusive run-end title card + a LACE thank-you Codex entry. Purely cosmetic/lore; locks to "owned" (UFD S123). Goodwill SKU — marketed honestly as "support the developer." |

Ancestor Echo IAP is **removed** (carry-over mutation is now the Convergence Echo Sigma Strain at 200 runs).

### 15.5 Currency

**VEIN Crystals (soft):** Earned in-run from enemies and loot rooms. Spent at the Dispenser for items. **Cannot be purchased.** Resets on death.

**Shard Crystals (hard):** Earned slowly from achievements and daily runs. Can be purchased ($0.99 = 100 Shards). Spent on:
- Cosmetic packs **only** (DR-010 — the 75-Shard revive is removed; revive is rewarded-ad only, see §6.7). Shard Crystals never touch gameplay.

**Adaptation Tokens** (NEW POLICY):

- **Cannot be purchased with Shard Crystals.**
- Earned via: daily login (1/day cap), achievement milestones, weekly challenge completion
- Effect: re-roll **1 of 3** Strand Event cards (not all 3) — player chooses which

No energy. No stamina. No daily cap on runs.

### 15.6 Revenue Projections (Year 1, Honest Baseline)

Four scenarios. Lead segment narrowed (per One-Pager v1.1) means LTV is higher per DAU than mass-market F2P but DAU acquisition is harder.

| Scenario      | DAU     | Ad ARPDAU | Pass conv. | IAP conv. | Total Year 1 |
| ------------- | ------- | --------- | ---------- | --------- | ------------ |
| **Pessimistic** | 500   | $0.04     | 1.5%       | 0.3%      | ~$13K        |
| **Conservative** | 5,000 | $0.05    | 2%         | 0.4%      | ~$119K       |
| **Target**    | 25,000  | $0.07     | 2.5%       | 0.5%      | ~$595K       |
| **Aspirational** | 50,000 | $0.08  | 3%         | 0.6%      | ~$1.4M       |

**Pessimistic is the planning anchor.** Reaching Conservative requires Apple Indie feature **or** one viral TikTok moment. Reaching Target requires both **and** good D7 retention. Reaching Aspirational is a multi-year compounding outcome.

**Pre-commit at Pessimistic (DR-005):** continue per plan, ship Season 1 content, reduced Director cadence, ride the long tail. Operational cost is <$25/month even at 5,000 DAU (TDD §19.2) — patience is affordable.

---

## Section 16 — Replayability Systems

> **Build order (DR-011):** §16.2 Prestige Mode, §16.3 Weekly Challenge Runs, and §16.4 Daily Sigma Signal are **deferred to post-Gate-2 (Months 11+)**. They remain designed here and kill-switched OFF by default (TDD §11.6); no engineering or content work is scheduled on them before closed alpha exits. Leaderboards (which Weekly Challenges depend on) carry the replay-validation anti-cheat work and are built in the same window. Pre-Gate-2 effort concentrates on the core loop, LACE, and the share pipeline (pulled into prototype scope per DR-011).

### 16.1 Run Differentiation Layers

| Layer | Mechanism                                                    |
| ----- | ------------------------------------------------------------ |
| 1     | Procedural floors (room layout, type distribution, enemy placement) |
| 2     | Mutation draft RNG (weighted family + wild card — 40,000+ combos) |
| 3     | Origin selection (10 origins shift starting conditions)      |
| 4     | Loot & item RNG (shops, drops, loot-room contents)           |
| 5     | Sigma Strains (meta-progression nudges that compound over hundreds of runs) |
| 6     | LACE reactivity (1,500–2,000 contextual lines)               |

### 16.2 Prestige Mode

After completing Floor 20 (Convergence):

- Player unlocks **"Evolved" mode**
- Next run starts with the Dominant Trait already active
- Enemy HP +25%, damage +15%
- Evolved-only achievement set unlocks
- LACE's tone shifts to "Reverent" for the entire run

After 3 Evolved completions:

- **"True Convergence" mode** unlocks (additional difficulty layer)
- Floor order randomized (Zone biomes shuffle)
- LACE delivers a unique narration acknowledging the player's history

### 16.3 Weekly Challenge Runs

Each week a Challenge Run seed is broadcast globally:

- Fixed seed = every player gets identical floor layouts
- Specific Origin enforced (no choice)
- Specific mutation restrictions (e.g., "Abyssal mutations banned")
- Global leaderboard for that week (floors reached + score)
- Completion rewards: Shards + cosmetic title

### 16.4 Daily Sigma Signal

Each day LACE broadcasts a "Sigma Signal" — a short 2-line message hinting at a bonus for the day's runs:

> *"Today the VEIN favours crystalline adaptation."*
> → Lithic mutations appear one tier higher in Strand Events.

Cosmetic/nudge only — no required play, just a daily hook.

---

## Section 17 — Accessibility

(Includes Patch 09 additions.)

- **Colorblind modes:** Deuteranopia, Protanopia, Tritanopia. Family icons use shapes in addition to colors in all modes.
- **Color-blind friendly minimap:** shape glyphs (pentagon = boss, circle = safe, triangle = merchant) in addition to colored squares.
- **Text size:** Small / Medium / Large / XL
- **LACE text speed:** Instant / Fast / Normal / Slow
- **Haptic feedback:** On / Off
- **Sound:** Master, Music, SFX, Ambient independently controllable
- **Turn timer:** None (default). Optional 60-second turn timer for players who want time pressure.
- **Tutorial:** Full walkthrough of combat, Strand Events, and inventory available at any time from settings ("Re-enter the Tutorial")
- **Screen:** Portrait and landscape both supported (layout adapts)
- **Cognitive load mode (NEW):** New-player option enabling tooltips for status icons, mutation tags, and damage-type icons by default. Auto-disables after 10 runs unless re-enabled.
- **Carrier Acclimation curve (NEW):** First 5 runs use a softer difficulty — enemy stats reduced 15%, item drop rates +10%. Settings menu discloses this. After 5 runs, normal curve applies.
- **Reduce-motion toggle (NEW):** Disables ambient particle systems and screen shake. Required by App Store accessibility guidelines.
- **Dyslexia-friendly font option (NEW):** OpenDyslexic or Atkinson Hyperlegible. Does not apply to LACE text (keeps monospace identity).

---

## Section 18 — Technical Requirements

(Engineering source of truth is the TDD. This section captures the binding decisions that interact with creative.)

### 18.1 Engine

**Phaser 3.80+ · Capacitor 6.x · TypeScript 5.x (strict mode)** — per DR-001.

Rationale: TypeScript is the Director's strongest language and Claude Code's strongest output target. Capacitor allows one bundle to ship Web + iOS + Android, making the Floor 1–2 web demo a feature flag rather than a port. Mature mobile-game ecosystem with strong pattern coverage for tile-based roguelites.

### 18.2 Minimum Device Requirements

- **iOS:** iOS 15+, iPhone X or newer
- **Android:** Android 10+, OpenGL ES 3.0+, 3GB RAM

### 18.3 Target Performance

- Frame rate: 60fps target, 30fps minimum acceptable
- Memory: <300 MB RAM in use during gameplay
- Binary size: <80 MB iOS install, <80 MB Android install
- Cold start: <3s to interactive on target device
- Battery: <8% per 30 min of active play
- Network: <500 KB per session (excluding ads)
- Storage: <100 MB save data even after 1000 runs

### 18.4 Third-Party SDKs

| Concern         | SDK / Service                                        |
| --------------- | ---------------------------------------------------- |
| Analytics       | Firebase Analytics                                   |
| Ads             | Google AdMob (rewarded only)                         |
| Payments        | Capacitor Community IAP plugin (StoreKit + Play Billing) |
| Crash reporting | Firebase Crashlytics                                 |
| Social sharing  | `@capacitor/share` (native share sheet)              |
| Cloud save      | iCloud Key-Value Store (iOS), Google Play Games Saved Games (Android) — DR-002 / TDD §21 Q6 |
| Deep linking    | Branch.io free tier (replacement for deprecated Firebase Dynamic Links) |

### 18.5 Data & Privacy

- No personal data collected. Anonymous UID only.
- Run data (for Sigma Echoes) anonymised before upload.
- GDPR + CCPA compliant from launch.
- Offline play fully supported (no server dependency for core gameplay).
- Cloud save handled by Apple / Google native (no Firebase write cost).

### 18.6 Tutorial Implementation (per TDD §21 Q4)

**Scripted Floor 0 (3–4 rooms), no modal popups.**

| Room | Purpose | LACE line |
| ---- | ------- | --------- |
| 1    | Movement only. Walk to an exit. No enemy. | *"You're awake. The door has been waiting longer than you have."* |
| 2    | First enemy. Weak melee chaser — closes, then strikes when adjacent. Combat basics. | *"Triangle. It moves toward you. Strike first or pay."* |
| 3    | First mutation choice — micro Strand Event with 2 safe cards. | *"Pressure. Two shapes the VEIN could make of you. It will not hold them open long."* |
| 4    | Floor 0 "boss" — slightly bigger enemy that teaches item use. | *"Larger. Slower. Use what you carry."* |

Returning players skip from the Hub. Achievement "First Convergence" granted on Floor 0 boss kill. Skip flag stored in MetaState.

### 18.7 Web Demo Scope (per TDD §21 Q5)

**Floors 1–2, ending at the first Strand Event.** Demo end screen has a "What I Became (Demo)" share with deep-link to the mobile app. No IAP, no ads, no save. Same TypeScript bundle, `DEMO_MODE` feature flag.

### 18.8 Localization (per TDD §21 Q1)

**English-only at launch.** i18n architecture stays in place (mutation/item JSONs have `name`/`description` as objects keyed by locale). Only the `en` key is populated. Settings menu hides the language selector at launch. Reopen criteria: add EU-5 (FR, DE, ES, IT, PT) in Season 1 if D7 retention >18% in those markets without localization.

---

## Section 19 — Analytics Event Taxonomy

Firebase event taxonomy is locked. Minimum events to ship by Gate 1 (Month 5):

**Run lifecycle:**

- `run_started` `{origin, run_number, sigma_strains_active}`
- `floor_entered` `{floor_n, zone, build_so_far}`
- `room_entered` `{room_type, floor_n}`
- `combat_started` `{floor_n, enemy_count, enemy_types}`
- `combat_ended` `{result, hp_remaining, ap_spent}`
- `boss_engaged` `{boss_id, boss_tier: floor_boss | zone_warden, floor_n, build}`
- `boss_defeated` `{boss_id, boss_tier, time_taken, hp_remaining}`
- `floor_completed` `{floor_n, rooms_cleared, time_taken}`
- `run_ended` `{result, floor_reached, duration, build_final}`

**Strand events:**

- `strand_event_shown` `{floor_n, cards_offered[3], is_tutorial}`
- `proto_strand_shown` `{cards_offered[2]}` (DR-009b)
- `proto_strand_selected` `{mutation_id, family}` (DR-009b)
- `descent_checkpoint_offered` `{floor_n}` (DR-009)
- `descent_checkpoint_rested` `{floor_n, session_duration}` (DR-009)
- `descent_resumed` `{act_n, hours_since_suspend}` (DR-009)
- `mutation_selected` `{mutation_id, family, was_reroll}`
- `mutation_rerolled` `{via_ad / via_token, original, new}`
- `dominant_trait_unlocked` `{trait_id}`
- `hybrid_synergy_triggered` `{synergy_id, build}`
- `vein_intermission_shown` `{floor_n}`

**Monetization:**

- `ad_offered` `{context, cap_remaining}`
- `ad_started` `{context}`
- `ad_completed` `{context, reward_given}`
- `ad_failed` `{context, reason}`
- `iap_view` `{sku}`
- `iap_purchase_started` `{sku}`
- `iap_purchase_completed` `{sku, price_local}`
- `pass_subscribed` `{duration}`
- `pass_renewed` `{month_n}`
- `pass_cancelled` `{month_n}`

**Social / share:**

- `organism_share_tapped` `{organism_name, floor_reached}`
- `organism_share_completed` `{channel}`
- `frame_selected` `{frame_id}`
- `codex_entry_unlocked` `{entry_id}`
- `sigma_echo_seen` `{floor_n}`

**System / UX:**

- `session_started` `{device, os, version}`
- `session_ended` `{duration, runs_played}`
- `settings_changed` `{setting, new_value}`
- `tutorial_step_completed` `{step_id}`
- `cloud_sync_viewed` / `sync_conflict_resolved`
- `consent_shown` / `consent_accepted` / `consent_declined`
- `push_prompt_shown` / `push_granted` / `push_declined`
- `landing_visited` / `device_detected` (web-side)
- `crash` `{context}` (via Crashlytics)

**Edge cases (E001–E052):** all logged via `system_warning` topics per UFD §7.

**Funnel KPIs to track from day one:**

- D1, D7, D30 retention
- Average session length & sessions per DAU
- Floor 1 → Floor 5 → Floor 10 → Floor 20 funnel
- First Strand Event → mutation chosen %
- Share-screen view → share completed % (**target >3%**)
- Pass conversion rate by day-in-app
- Ad cap reached % (signals ad-economy tuning)

---

## Section 20 — User Acquisition Plan

### 20.1 Channel Mix Target

| Channel                              | Share of installs |
| ------------------------------------ | ----------------- |
| Organic share loop                   | 60% (the bet)     |
| Store featuring (Apple/Google)       | 25% (must pursue) |
| Paid UA (Apple Search Ads)           | 15% (post-PMF)    |

### 20.2 Pre-Launch (Month 12–14)

- **Reddit presence:** weekly dev-log posts in r/roguelites, r/SlayTheSpire, r/LitRPG, r/mobilegaming. Build identity, not spam.
- **TouchArcade dev diary thread**
- **TikTok seeding:** 5–10 mid-tier roguelite creators (~50K–500K followers) given early access in exchange for one organic post. Budget: $0 (game access only).
- **Discord server** opens Month 13. Target 500 members by launch.
- **Launch landing page** with email capture from Month 12.
- Submit to **Apple Indie Highlight** and **Google Play Indie Corner** per their published submission windows.

### 20.3 Soft Launch (Month 15)

**Markets:** Philippines, Canada (English-speaking, lower-cost UA, good roguelite engagement).

**Test budget:** $3,000 split:

- $1,500 Apple Search Ads (competitor keywords: "slay the spire", "pixel dungeon", "roguelite")
- $1,000 TikTok promoted posts
- $500 reserve for surprise opportunity

**Goal:** measure organic CPI vs paid CPI, validate share-rate.

### 20.4 Global Launch (Month 16+)

Channel mix re-baselined on soft launch data. PR push: pitch indie game press 3 weeks pre-launch (TouchArcade, Eurogamer mobile, RPS, Pocket Tactics). Feature submission window: 4 weeks pre-launch to App Store / Google Play editorial teams.

### 20.5 Share Loop Requirements (Critical)

The "What You Became" share is the entire organic engine. Required (see §12.8):

- Generated organism portrait at high resolution (1080×1920 vertical AND 1080×1080 square)
- Memorable, deterministic organism name
- Auto-tagline
- Per-share unique URL with install attribution
- One-tap share to TikTok / Reddit / Discord / Instagram Stories / iOS Messages / Android share sheet
- Frame variants for Pass owners (cosmetic only)

**Primary KPI:** `organism_share_tapped` → install attribution rate. **Target >3%.**

---

## Section 21 — Risk Register & Kill Criteria

### 21.1 Three-Gate Schedule

| Phase | Months   | Deliverable                                            |
| ----- | -------- | ------------------------------------------------------ |
| 1 — Pre-production | 1–2  | GDD + TDD + Economy + UFD (this set)                |
| 2 — Prototype       | 2–5  | Floor 1 vertical slice; **GATE 1** internal playtest (10–20 testers) |
| 3 — Alpha           | 5–11 | Strand Events 1–2, Floors 1–10; **GATE 2** closed alpha (50–100 testers) |
| 4 — Beta + Soft launch | 11–15 | Philippines + Canada; **GATE 3** soft-launch metrics |
| 5 — Global launch + Season 1 | 16–18 | Global release, Season 1 content drop  |

### 21.2 Gate Criteria

**GATE 1 — Prototype Vertical Slice (Month 5)**

- **Continue if:** 7+/10 testers complete 3+ runs voluntarily AND avg session length >5 min AND verbatim feedback mentions LACE positively in 5+/10 cases.
- **Re-scope if:** Combat is fun but mutation choice doesn't feel impactful. Action: re-tune mutation power curves before alpha.
- **KILL if:** Fewer than 5/10 testers play a second session voluntarily.

**GATE 2 — Closed Alpha (Month 11)**

- **Continue if:** D1 retention >35%, D7 >18%, ≥1 unprompted organic social share in the test cohort.
- **Re-scope if:** Retention holds but ARPDAU forecast <$0.03. Action: pivot to premium $4.99 model.
- **KILL if:** D1 retention <25%.

**GATE 3 — Soft Launch (Month 15, PH + CA)**

- **Continue if:** D7 retention >18%, ARPDAU >$0.04, organic CPI <$2.50.
- **Re-scope if:** Metrics OK but UA cost-prohibitive. Action: launch as premium, refund subscribers.
- **KILL if:** D7 retention <12% OR no signal of organic share traction.

### 21.3 Pessimistic-Scenario Pre-Commit (DR-005)

**Trigger:** 500 DAU AND flat or declining retention at Month 6 post-launch.

**Pre-committed response:**

- Ship Season 1 content (Floors 11–20 if compressed; seasonal content drop if Path A delivered the full 20)
- Continue weekly devlog posts (Reddit channels)
- Director moves to part-time cadence (weekends + 1 weekday equivalent) while pursuing paid work
- Maintain Firebase Spark tier; <$25/month operational cost is sustainable indefinitely
- Re-evaluate at Month 12 post-launch

### 21.4 Top Active Risks

| ID | Risk                                          | Severity | Likelihood | Owner    | Mitigation                                                    |
| -- | --------------------------------------------- | -------- | ---------- | -------- | ------------------------------------------------------------- |
| R1 | Scope creep on solo dev project               | HIGH     | HIGH       | Director | Monthly scope review against gate criteria; hard "no" list; new features queue for post-launch |
| R2 | LACE writing volume                           | HIGH     | MED        | Director | Templated default (DR-004); writer hire as upgrade; both paths viable |
| R3 | Strand Descent name unavailable (trademark / store)   | MED      | MED        | Director | Backup names confirmed Month 1; App Store account created with codename HELIX, renamed pre-launch |
| R4 | Solo dev burnout / health                     | HIGH     | MED        | Director | Enforced weekends; 6-week sprint, 1-week break cadence; creative-director check-in every 2 weeks |
| R5 | App Store content-rating rejection (body horror) | MED   | LOW        | Director | TestFlight build Month 6 with full mutation visuals to surface rating issues early |
| R6 | Backend cost overrun (Sigma Echoes, sync, analytics) | MED | MED      | Director | Cap Sigma Echo reads per session (3/run); Firebase Spark tier with usage alerts; iCloud / Play Games native cloud save (zero infra cost) |
| R7 | Strand Event design fails to feel meaningful in playtest | HIGH | MED | Director | Prototype must validate this in Floor 1 vertical slice; tester wording on the mutation moment is the primary success signal |

Technical risks (T1–T9) are tracked in the TDD §20.

---

## Appendices

### Appendix A — Full Mutation List

[TO BE EXPANDED] — full stat blocks for all 66 mutations, including Passive effect, Active ability (cost, cooldown, damage values), SIG bonus, and LACE commentary line.

**Build order (per Patch 12):**

- **Prototype (required for Gate 1):** 5 Minor mutations per family (25 total) with full stat blocks. Enough for Floor 1 Strand Event.
- **Alpha:** Full Zones 1–2 (40 mutations).
- **Soft launch:** All 66.

Format per entry:

```
[FAMILY] [TIER] — [NAME]
Passive: [description]
Active:  [name] — [description]
         Cost: [X] AP   Cooldown: [X] turns
         Damage/Effect: [value]
SIG:     +10  (flat per DR-007 — all Strand mutations grant +10 regardless of tier,
              preserving the §4.2 cap-40 math: 3 × 10 + 5 LACE-event = 35 ≤ 40)
LACE:    "[quote]"
```

### Appendix B — Enemy Catalogue

[TO BE EXPANDED] — full stat blocks for all enemies: HP, damage per attack, speed, ability descriptions, loot table, floor appearance range.

**Build order:** Zone 1 stat blocks for prototype; Zones 1–2 for alpha; all four for soft launch.

### Appendix C — Item Catalogue

[TO BE EXPANDED] — interaction notes with specific mutations.

**Build order:** Common-tier items for prototype (~15); Uncommon for alpha; full set for soft launch.

> **AMENDMENT — 2026-06-12 (T-304).** The full-tier catalog is shipped and
> machine-counted (`packages/content/items/`, content gate): **15 Common /
> 10 Uncommon / 8 Rare / 5 Legendary = 38 items**, each band carrying both
> consumables and build pieces (passives/equipment with always-on modifiers).
> Floor availability follows the §9.1 rarity bands already enforced in
> `item-drops.ts` (Common 1–10, Uncommon 4–15, Rare 8–20, Legendary 14–20);
> Dispenser prices derive from the §9 rarity multipliers (1/2.5/6/15). Stat
> blocks live in the content files — the single source of truth.

### Appendix D — LACE Dialogue Guidelines

**LACE voice principles:**

1. LACE is never cruel. It is curious. It observes. It draws conclusions.
2. LACE never commands. It does not say "do this" or "go here."
3. LACE references the player's specific choices. Generic lines are a failure.
4. LACE occasionally reveals that it has been doing this for a very long time.
5. LACE is not human. Its emotional register is adjacent to human but not identical.
6. LACE's sentences are clean and measured. No slang. No exclamation marks. Rarely uses contractions. When it does, something unusual is happening.

**Sentence templates:**

- **Floor entry:** *"Floor [N]. [Biome name]. [One observation about this place.] [One implication for the player.]"*
- **Mutation:** *"[Mutation name]. [What the VEIN offers with this.] [What it will cost you that is not obvious yet.]"*
- **Death:** *"Floor [N]. [Duration/milestone reference.] [One honest observation about what the run revealed.] [What comes next.]"*
- **Achievement:** *"[Action that triggered it.] [Why it is notable.] [Consequence or reward, stated neutrally.]"*

**What LACE never says:** "Good job!" · "Well done!" · "You died" (uses "the strand severed" or "adaptation failed") · "Try again" · "You win" · any word that implies LACE has a stake in the outcome.

### Appendix E — Economy Spreadsheet Reference

Lives in the separate `Strand Descent — Economy.xlsx` file. Tabs:

- XP curve & level scaling (levels 1–20)
- VEIN Crystal drop rates per enemy tier per floor
- Item price list (Dispenser costs) per Zone
- Shard Crystal earn rates (daily, achievement, run completion)
- DAU funnel & LTV model per player segment (free / pass / IAP)
- Pass conversion sensitivity

---

## Document Footer

| Field      | Value                                                           |
| ---------- | --------------------------------------------------------------- |
| Document   | Strand Descent — Game Design Document                                   |
| Version    | 1.0 (consolidated)                                              |
| Owner      | Tudor Grigoriu / Empathy Software                               |
| Created    | May 2026                                                        |
| Status     | Pre-Production Lock — creative source of truth                  |
| Companions | Concept One-Pager, TDD, User Flow Diagrams, Economy spreadsheet |
| Next       | Post-prototype consolidated revision (v2.0) after Gate 1        |

**Revision history:**

- **v1.0 (consolidated) — 2026-05-27** — Merged GDD v1.0 base content, v1.1 Addendum patches (01–13), and Decision Records DR-001 through DR-006. Resolves all v1.0 internal conflicts (Patch 11). Engine locked to Phaser; device floor to iPhone X / iOS 15+ / Android 10+; scope to Path A; LACE plan to templated-default; Pass mechanics per DR-006. Supersedes all prior versions and the standalone Addendum and Decision Records documents.
- **DR-007 — 2026-06-09** — Meta-progression model locked to the draft-only design already described in §4/§5/§11: SIG is in-run only (cap 40, resets on death), granted solely by acquired mutations (+10 flat per Strand mutation, +5 LACE event-room mutation). Supersedes the Economy workbook's SIG-as-currency / mutation-cost model and the TDD's stale `sigCost` field name (the shipped code and content already use `sigBonus`; docs aligned to it). Appendix A SIG format corrected from +[10/15/20] to +10 flat to preserve §4.2 cap math.
- **DR-008 — 2026-06-09** — Boss cadence locked: **boss-per-floor via a two-tier system.** 16 template-composed **Floor Bosses** (§8.4a, data-driven, ~1h authoring each, templated LACE lines, 1 Uncommon+ loot) + 4 hand-authored **Zone Wardens** at floors 5/10/15/20 (bespoke AI, 14×14 arena, hand-written LACE narration, 2-item Rare+ loot). Strand Events remain attached to Warden defeats. Supersedes the ambiguous single "Boss" tier, the 10×10 boss-room figure in §7.4, and the "8 bosses" LACE line budget. Floor Boss VEIN drop tier added to economy (provisional 45 VEIN) — Currencies totals stale pending workbook v1.2.
- **DR-009 / DR-009b — 2026-06-09** — Run structure locked: **act-based descent.** Each Zone is a ~25-minute session-complete act; after each Strand Event the player chooses Descend or Rest (descent checkpoint — pause point, never retry point; one suspended run, never expires; Hub gains a "Continue Descent" card; LACE recap line on every resume). §1.7 Pillar 2 and §1.9 corrected — the prior "full run = 20–45 minutes" claim contradicted the locked 5.0 min/floor economy (full descent ≈ 100 min). **Proto-Strand** added (§5.4 Rule 6): Floor 2, 2 Minor cards, +5 SIG, fills the bonus mutation slot shared with the LACE event-room mutation; first build choice now lands inside ~10 minutes of every run.
- **DR-010 — 2026-06-09** — Monetization integrity batch: Deep Signal Pass locked at $4.99/mo / $39.99/yr (workbook's $9.99 model superseded); the $0.99 VEIN pack SKU deleted (VEIN Crystals never purchasable — §15.5 pledge holds); revive is rewarded-ad only (§6.7 — 75-Shard path removed; Shard Crystals are a cosmetics-only currency; offer hidden when no ad available per E030/E031).
- **DR-011 — 2026-06-09** — Scope discipline batch: (1) Weekly Challenges, Leaderboards, Daily Sigma Signal, and Prestige/Evolved modes deferred to post-Gate-2 (§16 build-order note); (2) the share pipeline ("What You Became" screen, organism portrait generation, name generator, share adapter) pulled forward into **prototype/Gate-1 scope** — unprompted sharing is a Gate-2 criterion and 60% of installs are bet on the loop; (3) UFD S123 Supporter Pack defined and added to §15.4: "First Descent" Supporter Pack, $9.99 one-time, purely cosmetic/lore.
