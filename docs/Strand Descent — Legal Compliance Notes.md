# Strand Descent — Legal Compliance Notes

| Field       | Value                             |
| ----------- | --------------------------------- |
| Covers      | T-18 (Google Play Data Safety) and T-19 (COPPA / AdMob flag) |
| Author      | Claude Code, 2026-05-28           |
| Refs        | TDD §17.1–17.4, GDD §1.5         |

---

## T-18 — Google Play Data Safety Form (answers)

Complete this in Play Console → App content → Data safety before submitting the first review build. The form maps to TDD §17.1–17.3.

### Section 1: Data collection and security

| Question | Answer |
| -------- | ------ |
| Does your app collect or share any of the required user data types? | **Yes** |
| Is all of the user data collected by your app encrypted in transit? | **Yes** (all Firebase traffic is TLS; AdMob uses TLS) |
| Do you provide a way for users to request that their data is deleted? | **Yes** (in-app Settings → Privacy → Delete My Account) |

### Section 2: Data types — what to declare

| Data type (Play Console label) | Collected | Shared | Ephemeral | Required | Purposes |
| ------------------------------ | --------- | ------ | --------- | -------- | -------- |
| **Device or other IDs** (Firebase anonymous UID) | Yes | No | No | Yes | App functionality |
| **App interactions** (gameplay telemetry: mutations chosen, floors, deaths) | Yes | No | No | No | Analytics |
| **App info and performance → Crash logs** (Crashlytics) | Yes | Yes (to Google/Firebase) | No | Yes | App functionality |
| **App info and performance → Diagnostics** (performance timing) | Yes | Yes (to Google/Firebase) | No | No | App functionality |
| **Financial info → Purchase history** (hashed IAP receipt) | Yes | Yes (to Apple/Google for validation) | No | Yes | App functionality |
| **Location → Approximate location** | No | — | — | — | — |
| **Personal info** (name, email, etc.) | No | — | — | — | — |

> Note: "Shared with third parties" means sent off-device to a party other than the developer. Firebase services (Google) count as third-party under Play's definition.

### Section 3: Data sharing

| Recipient | Data shared | Purpose |
| --------- | ----------- | ------- |
| Google / Firebase | Device ID, crash logs, performance data, gameplay telemetry | App functionality, analytics, crash reporting |
| Google / AdMob | Device ID (for ad serving), impression data | Advertising (rewarded ads only) |
| Apple / Google (Play) | Hashed IAP receipt | Purchase verification |

### Section 4: Security practices

| Practice | Answer |
| -------- | ------ |
| Data encrypted in transit | Yes |
| Data encrypted at rest | Relies on platform (iOS Data Protection, Android Keystore) |
| Follows Families Policy | Yes — 12+ rating, COPPA-compliant ad configuration |
| Committed to not selling data | Yes |

---

## T-19 — COPPA Flag Handling in AdMob Requests

### Policy context

Per TDD §17.4: *"COPPA: 12+ rating, no targeted ads to under-13 users (AdMob handles via per-request flag)."*

The App is rated 12+ and targets ages 22–35. We cannot verify individual user age without collecting PII (which we explicitly do not do per TDD §17.2). The correct COPPA posture for a 12+ app with no age-verification mechanism is:

- Set `tagForChildDirectedTreatment = false` — we are not intentionally directing content at children under 13, consistent with our 12+ rating.
- Set `tagForUnderAgeOfConsent = false` — we do not have a mechanism to determine this per user; the 12+ rating is our gate.
- Rely on AdMob's own compliance mechanisms (e.g. restricted data processing for EU users when no consent is given).

### Where the flag is set

The flag is set once during AdMob SDK initialization in the Ads adapter (`apps/game/src/platform/ads-adapter.ts`, to be created in T-237). It applies globally to all subsequent ad requests in the session.

**Implementation pattern (for T-237):**

```typescript
// apps/game/src/platform/ads-adapter.ts
import { AdMob } from '@capacitor-community/admob';

export async function initAds(): Promise<void> {
  await AdMob.initialize({
    // 12+ rating; we do not direct content at under-13s
    tagForChildDirectedTreatment: false,
    // Cannot determine per-user age without PII collection; 12+ gate is our compliance mechanism
    tagForUnderAgeOfConsent: false,
    // Non-personalised ads until AdMob receives consent signal (wired in T-254 GDPR flow)
    requestTrackingAuthorization: true,
  });
}
```

> The `requestTrackingAuthorization: true` flag triggers Apple's ATT prompt on iOS 14.5+ before any personalised ad is requested. If the user declines, AdMob automatically falls back to contextual / non-personalised ads — no additional code is needed.

### Per-request confirmation

Each rewarded ad request (revive, reroll, merchant refresh) should also carry the flag explicitly as a belt-and-suspenders measure if using `AdMob.requestRewardVideoAd()` with options. Check the `@capacitor-community/admob` API at implementation time — the global init flag may be sufficient and per-request duplication unnecessary.

### EU/CCPA additional requirement

In EU/CA regions, if the user declined the consent dialog (T-132 / S009), analytics AND ads must be suppressed for the session. The consent flag (`consentGranted: boolean`) stored in MetaState drives this. See UFD S009 / S010A and T-254. This is distinct from COPPA — it's a separate compliance path.

---

*Update this document whenever the Ads adapter implementation (T-237) or the consent flow (T-254) changes AdMob initialization parameters.*
