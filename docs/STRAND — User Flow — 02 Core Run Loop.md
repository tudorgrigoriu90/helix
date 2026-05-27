# STRAND — User Flow — Scope 2: Core Run Loop

**Screens:** S017-S033
**Orchestration:** [STRAND — User Flow — 00 Orchestration.md](STRAND%20—%20User%20Flow%20—%2000%20Orchestration.md)

> Players spend 95% of time inside this loop.

---

## Flow Diagram

```mermaid
flowchart TD
    HUB[S017: Hub Scene] --> CHK_HUB{Player choice}
    CHK_HUB -->|Start Run| S018[S018: Origin Select]
    CHK_HUB -->|Daily Sigma| S019[S019: Daily intro]
    CHK_HUB -->|Weekly Challenge| S020[S020: Weekly intro]
    CHK_HUB -->|Meta menus| META[See Scope 5]
    CHK_HUB -->|Store| STORE[See Scope 6]

    S018 --> S021[S021: Run preview]
    S019 --> S021
    S020 --> S021
    S021 --> S022[S022: Floor transition]
    S022 --> S023[S023: FloorScene]

    S023 --> CHK_ROOM{Room type}
    CHK_ROOM -->|Combat| COMBAT[See Scope 3]
    CHK_ROOM -->|Event| S024[S024: Event Room]
    CHK_ROOM -->|Merchant| S025[S025: Merchant Room]
    CHK_ROOM -->|Safe| S026[S026: Safe Room]
    CHK_ROOM -->|Boss| BOSS[Boss combat]

    COMBAT -->|Win| S027[S027: Loot reveal] --> S023
    COMBAT -->|Death| S030[S030: Death sequence]
    BOSS -->|F5 F10 F15| STRAND[See Scope 4]
    BOSS -->|F20| S028[S028: Victory]
    BOSS -->|Death| S030
    STRAND --> S029[S029: Floor descent] --> S022

    S030 --> S031[S031: What You Became]
    S028 --> S031
    S031 -->|Share| SHARE[See Scope 8]
    S031 --> S032[S032: Meta rewards]
    S032 -->|Death first revive| S033[S033: Revive offer]
    S032 -->|Victory or revive used| HUB
    S033 -->|Accept| S023
    S033 -->|Decline| HUB
```

---

## Screen Inventory

| ID    | Screen                      | Notes                                                                                                                                                                |
| ----- | --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S017  | Hub Scene                   | Main menu between runs                                                                                                                                              |
| S018  | Origin Select               | Choose starting Origin                                                                                                                                              |
| S019  | Daily Sigma intro           | Today's seed and modifier                                                                                                                                           |
| S020  | Weekly Challenge intro      | Week's challenge brief                                                                                                                                              |
| S021  | Run preview                 | Confirm seed, modifiers, Strains                                                                                                                                    |
| S022  | Floor transition            | 1s mask while floor generates async                                                                                                                                 |
| S023  | FloorScene                  | Tile-based exploration (**THE game**)                                                                                                                               |
| S024  | Event Room                  | Story choice modal (3 options)                                                                                                                                      |
| S025  | Merchant Room               | VC-priced item shop, 1 ad refresh per merchant                                                                                                                      |
| S026  | Safe Room                   | Heal 25% max HP + save + LACE moment                                                                                                                                |
| S027  | Loot reveal                 | Drop animation after combat                                                                                                                                         |
| S028  | Victory sequence            | Floor 20 final boss celebration                                                                                                                                     |
| S029  | Floor descent               | Post-Strand Event narration, LACE mood may shift                                                                                                                    |
| S030  | Death sequence              | 3-sec death animation. `death_cause` enum (**locked**): `enemy_kill`, `boss_kill`, `hazard`, `status_tick`, `surrender`, `mutation_backfire`                        |
| S031  | Run summary "What You Became" | Portrait + name + share CTA                                                                                                                                       |
| S032  | Meta rewards                | SC granted, achievements popped                                                                                                                                     |
| S033  | Revive offer                | Watch ad or 75 SC; shown **AFTER share** to protect emotional moment                                                                                                |
