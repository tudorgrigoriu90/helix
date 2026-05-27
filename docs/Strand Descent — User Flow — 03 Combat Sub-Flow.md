# Strand Descent — User Flow — Scope 3: Combat Sub-Flow

**Screens:** S040-S052
**Orchestration:** [Strand Descent — User Flow — 00 Orchestration.md](Strand%20Descent%20—%20User%20Flow%20—%2000%20Orchestration.md)

---

## Flow Diagram

```mermaid
flowchart TD
    ENTER[Combat room entered] --> S040[S040: Combat init]
    S040 --> S041[S041: Player turn start]
    S041 --> CHK_INPUT{Player action}
    CHK_INPUT -->|Tap tile| S042[S042: Move preview]
    CHK_INPUT -->|Tap enemy| S043[S043: Attack preview]
    CHK_INPUT -->|Tap ability| S044[S044: Ability targeting]
    CHK_INPUT -->|Tap item| S045[S045: Item use prompt]
    CHK_INPUT -->|End turn| S046[S046: Enemy phase]
    CHK_INPUT -->|Menu| S047[S047: Combat menu]

    S042 -->|Confirm| S048[S048: Action resolution]
    S043 -->|Confirm| S048
    S044 -->|Confirm| S048
    S045 -->|Confirm| S048
    S042 -->|Cancel| S041
    S043 -->|Cancel| S041
    S044 -->|Cancel| S041
    S045 -->|Cancel| S041

    S048 --> CHK_AP{AP remaining?}
    CHK_AP -->|Yes| S041
    CHK_AP -->|No| S046
    S046 --> S049[S049: Enemy actions resolve]
    S049 --> S050[S050: Status tick]
    S050 --> CHK_STATE{Combat state}
    CHK_STATE -->|Continue| S041
    CHK_STATE -->|Win| S051[S051: Combat victory]
    CHK_STATE -->|Player dead| S052[S052: Combat loss]

    S047 -->|Resume| S041
    S047 -->|Surrender| S052
    S047 -->|Settings| QSET[S083: Settings]
    QSET -->|Close| S047

    S051 --> S027
    S052 --> S030
```

---

## Screen Inventory

| ID   | Screen                  | Notes                                                                                                                                                  |
| ---- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| S040 | Combat init             | Reveal enemies, telegraph first moves                                                                                                                  |
| S041 | Player turn start       | AP refresh, saves `RunState` on entry                                                                                                                  |
| S042 | Move preview            | Path + AP cost. **Two-tap confirm for first 5 runs** (MetaState flag); single-tap thereafter. Toggleable in S093.                                      |
| S043 | Attack preview          | Damage range + accuracy                                                                                                                                |
| S044 | Ability targeting       | Range overlay, AoE preview                                                                                                                             |
| S045 | Item use prompt         | Confirm consumable use                                                                                                                                 |
| S046 | Enemy phase trigger     |                                                                                                                                                        |
| S047 | Combat menu             | Resume / Surrender / Settings. **NO FLEE in v1.** Surrender requires double-confirm.                                                                   |
| S048 | Action resolution       | **Determinism rule:** same input = same result                                                                                                         |
| S049 | Enemy actions resolve   | Sequentially with delays. Tap-to-fast-forward (**2x cap**). Auto-fast after 20 runs of player history.                                                 |
| S050 | Status tick             | Burn / poison / regen. Can kill → `death_cause: status_tick`                                                                                           |
| S051 | Combat victory          | Flash + XP gain, dismisses 1.5s                                                                                                                        |
| S052 | Combat loss             | Triggers S030 Death sequence                                                                                                                           |
