# Strand Descent — User Flow — Scope 8: Share Flow

**Screens:** S140-S150 + ATTR + LANDING
**Orchestration:** [Strand Descent — User Flow — 00 Orchestration.md](Strand%20Descent%20—%20User%20Flow%20—%2000%20Orchestration.md)

---

## Flow Diagram

```mermaid
flowchart TD
    SUMMARY[S031: Run summary] --> CHK_TYPE{Run type}
    CHK_TYPE -->|Standard| S140[S140: Standard share]
    CHK_TYPE -->|Daily| S141[S141: Daily share - with seed]
    CHK_TYPE -->|Weekly| S142[S142: Weekly share - with rank]

    S140 --> S143[S143: Portrait gen - vertical + square]
    S141 --> S143
    S142 --> S143
    S143 --> S144[S144: Share screen]

    S144 -->|Format toggle| S144
    S144 -->|Frame| S145[S145: Frame selector] --> S144
    S144 -->|Save| S146[S146: Save to roll]
    S144 -->|Share button| S149[S149: Native share sheet]
    S144 -->|Done| HUB[S017]

    S146 -->|OK| S147[S147: Saved toast] --> S144
    S146 -->|Need perm| PERM[Permission prompt]
    PERM -->|Granted| S147
    PERM -->|Denied| S148[S148: Denied toast] --> S144

    S149 -->|External| ATTR[Per-share attribution URL]
    S149 -->|Copy link| S150[S150: Copied toast] --> S144
    S149 -->|Cancel| S144

    ATTR -.->|Click| LANDING[play.empathy.software]
    LANDING -.->|Mobile UA| STORE_LINK[Store redirect]
    LANDING -.->|Desktop UA| DEMO[Floor 1-2 web demo]
```

---

## Screen Inventory

| ID       | Screen                       | Notes                                                                                                                |
| -------- | ---------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| S140     | Standard share screen        |                                                                                                                      |
| S141     | Daily Sigma share            | Shows global rank if leaderboard cached                                                                              |
| S142     | Weekly Challenge share       | Top-100 status badge if applicable                                                                                   |
| S143     | Portrait generation          | **1080×1920 vertical AND 1080×1080 square** client-side; skeleton if >2s                                             |
| S144     | Share screen                 | Format tab (Vertical / Square); subtle "More frames →" link for non-Pass holders                                     |
| S145     | Frame selector               | Pass frames blurred for non-subs + CTA                                                                               |
| S146     | Save to camera roll          | iOS requires Photo Add permission                                                                                    |
| S147     | Saved toast                  | Auto-dismiss 2s                                                                                                      |
| S148     | Permission denied            | Deep-links to OS Settings app                                                                                        |
| S149     | Native share sheet           | OS-handled app list, we don't curate                                                                                 |
| S150     | Link copied toast            | Auto-dismiss 2s                                                                                                      |
| ATTR     | Attribution URL              | Per-share unique URL via **Branch.io free tier** (up to 10K MAU); above that, evaluate paid Branch or custom         |
| LANDING  | Web landing page             | Smart redirect by user-agent — mobile UA → store redirect; desktop UA → Floor 1-2 web demo                           |
