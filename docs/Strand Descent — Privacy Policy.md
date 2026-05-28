# Strand Descent — Privacy Policy

| Field       | Value                                 |
| ----------- | ------------------------------------- |
| App         | Strand Descent                        |
| Developer   | Empathy Software (Tudor Grigoriu)     |
| Effective   | TBD — update before App Store submission |
| Last revised | 2026-05-28                           |
| Contact     | privacy@empathy.software (placeholder — set up before submission) |

---

## 1. What This Policy Covers

This Privacy Policy describes how Empathy Software ("we", "our", "us") collects, uses, and protects information when you play Strand Descent ("the App") on iOS or Android.

---

## 2. Data We Collect

We collect the minimum necessary to operate and improve the App.

| Data type | Detail | Purpose |
| --------- | ------ | ------- |
| **Anonymous device ID** | Firebase-generated UID, not linked to any identity | App functionality, cloud save sync |
| **Country / region** | Derived from IP at session start; stored as a bucket (e.g. "EU", "US"), not precise location | Consent gate routing (GDPR / CCPA), ad policy compliance |
| **Device model, OS version, client version** | e.g. "iPhone 15 Pro, iOS 17.4, v1.0.2" | Crash triage, performance monitoring |
| **Anonymized gameplay telemetry** | Mutation build paths, floors reached, death causes, run duration, share events | Balance tuning, analytics |
| **Crash reports** | Stack traces via Firebase Crashlytics | Bug fixing |
| **IAP receipts** | Hashed receipt tokens, validated server-side | Purchase verification; never stored in raw form |

---

## 3. Data We Do Not Collect

- Name, email address, phone number, or age
- Precise GPS location
- Photos, contacts, microphone, or calendar data
- Any data requiring OS permission grants beyond those listed in §5

---

## 4. How We Use Your Data

- **App functionality:** Cloud save sync, resume-run state, daily/weekly challenge seeds
- **Analytics:** Aggregate gameplay statistics to balance difficulty and content
- **Crash reporting:** Diagnosing and fixing bugs
- **Purchase verification:** Confirming valid IAP transactions via Apple / Google servers
- **Advertising:** A single rewarded ad placement per context (revive, reroll, merchant refresh). Ads are served by Google AdMob. See §7 for COPPA / age-gate details.

We do not sell your data. We do not use your data for behavioural profiling outside the App.

---

## 5. Permissions Requested

| Permission | Platform | When prompted | Required? |
| ---------- | -------- | ------------- | --------- |
| Internet access | Both | On launch (automatic) | Yes — cloud sync, analytics |
| Push notifications | Both | First time a Floor 5 Strand Event triggers | No — optional |
| Photo Library (Add only) | iOS | When player taps "Save to camera roll" on the share screen | No — optional |

We request no other permissions.

---

## 6. Third-Party Services

| Service | Provider | Purpose | Their Privacy Policy |
| ------- | -------- | ------- | -------------------- |
| Firebase Analytics | Google | Gameplay telemetry | https://policies.google.com/privacy |
| Firebase Crashlytics | Google | Crash reporting | https://policies.google.com/privacy |
| Firebase Authentication | Google | Anonymous UID generation | https://policies.google.com/privacy |
| Firebase Firestore | Google | Cloud save data | https://policies.google.com/privacy |
| Google AdMob | Google | Rewarded ads | https://policies.google.com/privacy |

Data processed by Google is subject to Google's privacy policies. All data transfers occur over TLS.

---

## 7. Children's Privacy (COPPA)

The App is rated 12+ (Apple App Store) / PEGI 12 (Google Play). We do not knowingly collect personal information from children under 13.

All AdMob ad requests are sent with `tag_for_child_directed_treatment = false` and `tag_for_under_age_of_consent = false`, consistent with our 12+ rating and adult-skewed audience. AdMob is configured to serve non-personalised ads to all users unless consent is granted (see §8).

If you are a parent or guardian and believe your child has provided personal information to us, contact us at the address in §11 and we will delete it.

---

## 8. GDPR (European Users) and CCPA (California Users)

### GDPR

If you are in the European Economic Area, United Kingdom, or Switzerland:

- We display a consent dialog on first launch before any analytics or advertising data is transmitted.
- If you decline, analytics and advertising SDKs remain inactive for your session.
- Legal basis for processing (where consent is given): **consent** (Art. 6(1)(a) GDPR).
- Legal basis for crash reporting: **legitimate interest** (Art. 6(1)(f) GDPR) — diagnosing crashes is necessary to operate the App.
- You may withdraw consent at any time via **Settings → Privacy** inside the App.

### CCPA

If you are a California resident, you have the right to:

- Know what personal information we collect (see §2)
- Request deletion of your data (see §9)
- Opt out of "sale" of personal information — **we do not sell personal information**

To exercise CCPA rights, use the data export or account delete options in the App (Settings → Privacy) or contact us directly.

---

## 9. Your Rights and Data Deletion

You can request export or deletion of your data at any time:

- **In-App:** Settings → Privacy → Export My Data / Delete My Account
- **By email:** privacy@empathy.software

Deletion is processed within 7 days (soft delete) and permanently within 30 days (hard delete via Cloud Function). The only data retained after hard delete is aggregate anonymized telemetry that cannot be attributed to any individual.

---

## 10. Data Retention

| Data type | Retention |
| --------- | --------- |
| Anonymous gameplay runs | 30 days after last activity, then pruned |
| Crash reports | 90 days |
| IAP receipt records | 7 years (legal / financial compliance) |
| Cloud save (MetaState) | Until account deletion |

---

## 11. Contact

**Empathy Software**
Tudor Grigoriu
privacy@empathy.software

For App Store / Play Store submissions, the in-app privacy URL will point to the hosted version of this document.

---

## 12. Changes to This Policy

We will post any material changes to this policy inside the App (Settings → Privacy) and update the "Last revised" date above. Continued use of the App after changes constitutes acceptance.

---

*This document was drafted against TDD §17.1–17.4 as the source of truth for data practices. Before App Store submission, have this reviewed by a qualified attorney and update placeholder fields (effective date, contact email).*
