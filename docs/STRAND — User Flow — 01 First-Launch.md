# STRAND — User Flow — Scope 1: First-Launch Flow

**Screens:** S001-S016, S100
**Orchestration:** [STRAND — User Flow — 00 Orchestration.md](STRAND%20—%20User%20Flow%20—%2000%20Orchestration.md)

> The player's first 5 minutes. Every decision here either creates a Day-2 returning player or loses them forever.

---

## Flow Diagram

```mermaid
flowchart TD
    A[App install complete] --> S001[S001: Cold launch splash]
    S001 --> CHK1{Existing save?}

    CHK1 -->|No| S002[S002: Studio splash - Empathy Software]
    CHK1 -->|Yes| S100[S100: Resume Run? modal]

    S100 -->|Resume| FLOOR[Jump to FloorScene]
    S100 -->|New run| HUB[Jump to Hub]

    S002 --> S003[S003: VEIN intro cinematic - 15s skippable]
    S003 --> S004[S004: Anonymous auth - silent]
    S004 --> CHK2{Auth ok?}

    CHK2 -->|Yes| S005[S005: Cloud sync check]
    CHK2 -->|No| S006[S006: Offline mode notice]
    S006 --> S007

    S005 --> CHK3{Found cloud save?}
    CHK3 -->|No| S007[S007: Region detection]
    CHK3 -->|Yes| S008[S008: Restore progress silently]
    S008 --> S007

    S007 --> CHK4{EU or CA region?}
    CHK4 -->|Yes| S009[S009: GDPR CCPA consent]
    CHK4 -->|No| S011
    S009 -->|Accept| S011
    S009 -->|Decline| S010A[S010A: Analytics off]
    S010A --> S011

    S011[S011: Tutorial intro - LACE first voice]
    S011 --> CHK_SKIP{Skip available?}
    CHK_SKIP -->|No| S012
    CHK_SKIP -->|Yes skipped| HUB2

    S012[S012: Floor 0 Room 1 - movement]
    S012 --> S013[S013: Floor 0 Room 2 - combat]
    S013 --> S014[S014: Floor 0 Room 3 - first Strand Event]
    S014 --> S015[S015: Floor 0 Room 4 - tutorial boss]
    S015 --> S016[S016: First Convergence achievement]
    S016 --> HUB2[Hub Scene]

    HUB2 -.->|First real Strand Event on Floor 5| S010[S010: Push notif prompt]
    S010 -.->|Continue| GAMEPLAY[Resume gameplay]
```

---

## Screen Inventory

Each screen specified with: **Purpose, Entry, Exit, Analytics, Edge cases.**
See the full inventory in the source document body — this scope covers screens **S001–S016** plus **S100** (Resume Run modal).
