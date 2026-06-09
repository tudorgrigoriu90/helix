# Strand Descent — User Flow — Scope 4: Strand Event Sub-Flow

**Screens:** S060-S071
**Orchestration:** [Strand Descent — User Flow — 00 Orchestration.md](Strand%20Descent%20—%20User%20Flow%20—%2000%20Orchestration.md)

---

## Flow Diagram

```mermaid
flowchart TD
    TRIGGER[Floor 5 10 15 boss defeated] --> CHK_MUT{Has 4 mutations?}
    CHK_MUT -->|No| S060[S060: Strand Event intro]
    CHK_MUT -->|Yes| S071[S071: VEIN Intermission - 100 VC]
    S071 --> EXIT[Continue to S029]

    S060 --> S061[S061: Card reveal animation]
    S061 --> S062[S062: Card selection]

    S062 -->|Inspect| S063[S063: Card detail modal]
    S063 -->|Back| S062
    S063 -->|Choose this| S064
    S062 -->|Direct choose| S064
    S062 -->|Tap-hold then reroll| S065[S065: Reroll prompt]

    S065 -->|Watch ad| AD[See Scope 6]
    S065 -->|Use Adaptation Token| S066[S066: Token confirm]
    S065 -->|Cancel| S062
    AD -->|Success| S067[S067: New card drawn]
    AD -->|Fail| S062
    S066 -->|Confirm| S067
    S067 --> S062

    S064[S064: Choice confirm - are you sure?]
    S064 -->|Confirm| S068[S068: Mutation applied]
    S064 -->|Back| S062

    S068 --> S069[S069: LACE reaction]
    S069 --> CHK_DOM{Dominant trait unlocked?}
    CHK_DOM -->|No| EXIT
    CHK_DOM -->|Yes| S070[S070: Dominant Trait reveal] --> EXIT
```

---

## Screen Inventory

| ID   | Screen                       | Notes                                                                                                                                                                  |
| ---- | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S060 | Strand Event intro           | LACE narrates, **not skippable on first per run**                                                                                                                      |
| S061 | Card reveal animation        | Cards flip in (~1.5s), **deterministic per seed**                                                                                                                      |
| S062 | Card selection               | Main interaction, **no timer**, dwell as long as wanted                                                                                                                |
| S063 | Card detail modal            | Full effect text + family lore + synergy hints                                                                                                                         |
| S064 | Choice confirm               | Skipped after first 3 confirms in player history                                                                                                                       |
| S065 | Reroll prompt                | **PLAYER PICKS which card to reroll** (tap-and-hold first). **Only 1 reroll per Strand Event.**                                                                        |
| S066 | Token confirm                | Shows token balance                                                                                                                                                    |
| S067 | New card drawn               | Animate replacement, **same RNG sub-stream**                                                                                                                           |
| S068 | Mutation applied             | Visual transform, player geometry updates                                                                                                                              |
| S069 | LACE reaction                | Mood-aware comment; LACE mood may shift here                                                                                                                           |
| S070 | Dominant Trait reveal        | Big celebration; **first time grants achievement**                                                                                                                     |
| S071 | VEIN Intermission (NEW)      | Replaces Strand Event when player has **4 mutations (max)**. Grants 100 VC + LACE saturation line.                                                                     |

---

## AMENDMENT — DR-009 / DR-009b (2026-06-09)

**New screen S072 — Descent Checkpoint (after S069/S070, before EXIT):**

| ID | Screen | Notes |
| --- | --- | --- |
| S072 | Descent Checkpoint | Two options: **"DESCEND"** (continue to S029) / **"REST"** (suspend run at checkpoint, return to Hub S017). LACE rest line (e.g. *"Rest. The VEIN is patient. Your new strand will settle."*). No timer. Not shown after the Floor 20 Warden (Convergence follows directly). Also follows S071 (VEIN Intermission). |

**Flow delta:** `S069 --> CHK_DOM`; `CHK_DOM -->|No| S072`; `S070 --> S072`; `S071 --> S072`; `S072 -->|Descend| EXIT[S029]`; `S072 -->|Rest| HUB[S017, run suspended]`.

**Proto-Strand (Floor 2) — reuses this scope as a reduced variant:**

- Trigger: Floor 2 boss-room clear. Flow: S060 (proto intro line) → S061 → S062 → S064 → S068 → S069 → exit to S023. 
- **2 cards, Minor tier only**, uniform family draw, **no S065 reroll branch**, no S072 checkpoint.
- Grants +5 SIG; fills the bonus mutation slot (shared with the LACE event-room mutation, GDD §4.2/§7.3).
- `strand_event_shown.is_proto: true` variant or dedicated `proto_strand_shown` event (taxonomy locked in GDD §19).
