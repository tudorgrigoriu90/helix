import Phaser from 'phaser';
import type { MetaState } from '@shared-types/meta-state';
import type { RunSessionSave } from '../core/run/run-session';
import type { ResumeDecision, ResumeSummary } from '../core/run/resume-decision';
import type { LoadResult } from '../core/save/save-manager';
import { SaveManager } from '../core/save/save-manager';
import { metaCodec, newMetaState } from '../core/save';
import { runSessionCodec } from '../core/run/run-session-save';
import { decideResume } from '../core/run/resume-decision';
import { initStorageAdapter } from '../platform/storage';
import { logEvent } from '../core/platform/analytics-adapter';
import { installAnalytics } from '../platform/analytics-bootstrap';
import { installCrashlytics } from '../platform/crashlytics';
import { ensureAnonymousAuth } from '../platform/firebase/auth';
import { initRemoteConfig } from '../platform/firebase/remote-config';

/**
 * Boot manager — T-129/T-130/T-132/T-134/T-136.
 *
 * Runs immediately after the studio splash. Chains:
 *  1. T-129 Offline mode notice (if navigator.onLine === false).
 *  2. T-130/T-132 GDPR/CCPA consent modal (EU/CA region, once per device).
 *  3. T-134 Analytics-off acknowledgement (if consent declined).
 *  4. Async load + T-136 Resume Run? modal.
 *
 * Route map:
 *  ┌─ resumable run found → S100 modal → RESUME → GameScene / NEW RUN → HubScene
 *  └─ no in-progress run → HubScene (T-144)
 */

/** localStorage key that stores the player's consent decision. */
const CONSENT_KEY = 'helix.consent';
type ConsentDecision = 'granted' | 'declined';

/** BCP-47 language prefixes whose users are in the EU or EEA. */
const EU_LANGUAGES = new Set([
  'de', 'fr', 'it', 'es', 'pt', 'nl', 'pl', 'sv', 'da', 'fi', 'nb', 'no',
  'el', 'cs', 'sk', 'hu', 'ro', 'bg', 'hr', 'sl', 'et', 'lv', 'lt', 'mt',
  'ga', 'lb', 'ca', 'eu', 'gl',
]);

function detectRegionNeedsConsent(): boolean {
  try {
    const lang = (navigator.language ?? '').toLowerCase().split('-')[0] ?? '';
    const region = (navigator.language ?? '').toLowerCase().split('-')[1] ?? '';
    if (EU_LANGUAGES.has(lang)) return true;
    // Canadian French / English-Canada
    if (region === 'ca') return true;
  } catch {
    // SSR or unusual environment — skip consent gate
  }
  return false;
}

function storedConsent(): ConsentDecision | null {
  try {
    const v = localStorage.getItem(CONSENT_KEY);
    if (v === 'granted' || v === 'declined') return v;
  } catch { /* ignore */ }
  return null;
}

function storeConsent(decision: ConsentDecision): void {
  try { localStorage.setItem(CONSENT_KEY, decision); } catch { /* ignore */ }
}

// ── Colours (consistent with the rest of the game) ────────────────────────
const C = { bg: 0x070b14, surface: 0x0e1626, border: 0x1e2a40, accent: '#a0ffdc', dim: '#7a8fad', text: '#e8edf5', gold: '#ffdd44', danger: '#ff4444' };
const W = 390;
const H = 844;
const CX = W / 2;
const CY = H / 2;

export class GameBootScene extends Phaser.Scene {
  private meta: MetaState = newMetaState();
  private runSave: LoadResult<RunSessionSave> | null = null;

  constructor() {
    super({ key: 'GameBootScene' });
  }

  create(): void {
    this.add.graphics().fillStyle(C.bg).fillRect(0, 0, W, H);

    // T-129: offline mode notice — shown above whatever comes next.
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      this.showOfflineNotice(() => this.checkConsent());
    } else {
      this.checkConsent();
    }
  }

  /** T-130/T-132: gate on consent for EU/CA players (once per device). */
  private checkConsent(): void {
    const stored = storedConsent();
    if (stored !== null) {
      // Already decided on this device — install adapter if granted, then boot.
      if (stored === 'granted') { installAnalytics(); installCrashlytics(); }
      this.startBoot();
      return;
    }
    if (detectRegionNeedsConsent()) {
      this.showConsentModal();
    } else {
      // Outside EU/CA — implied consent; install adapter and proceed.
      installAnalytics();
      this.startBoot();
    }
  }

  private startBoot(): void {
    // T-127: establish the anonymous UID in the background. Best-effort and
    // non-blocking — the save/resume load and routing never wait on the network,
    // and the game runs fully offline if sign-in fails.
    void ensureAnonymousAuth();

    // T-40: refresh the Remote Config kill-switches in the background. Flags
    // stay at their in-binary OFF defaults until (and unless) this completes.
    void initRemoteConfig();

    // Show a spinner if the load takes more than 400 ms so the screen isn't
    // just black. Most loads complete in <50 ms on-device.
    const spinnerHandle = this.time.delayedCall(400, () => this.showSpinner());
    void this.bootAsync().then((decision) => {
      spinnerHandle.remove(false);
      this.route(decision);
    });
  }

  private async bootAsync(): Promise<ResumeDecision> {
    const adapter = await initStorageAdapter();
    const metaSaves = new SaveManager(adapter, metaCodec, 'helix.meta');
    const runSaves = new SaveManager(adapter, runSessionCodec);

    const [metaResult, runResult] = await Promise.all([metaSaves.load(), runSaves.load()]);
    if (metaResult !== null && metaResult.ok) this.meta = metaResult.value;
    this.runSave = runResult;

    return decideResume(runResult);
  }

  private route(decision: ResumeDecision): void {
    logEvent('session_start', {
      hasActiveRun: decision.kind === 'prompt' || decision.kind === 'checkpoint',
      lifetimeRuns: this.meta.lifetime.runs,
      consentGranted: storedConsent() === 'granted',
    });
    if (decision.kind === 'prompt') {
      this.showResumeModal(decision.summary);
    } else {
      // 'fresh' — nothing to resume; 'checkpoint' (DR-009, T-510) — the Hub
      // itself shows the "Continue Descent" card in place of the S100 modal.
      this.scene.start('HubScene', { meta: this.meta });
    }
  }

  // ── Spinner ─────────────────────────────────────────────────────────────

  private spinnerText: Phaser.GameObjects.Text | null = null;
  private spinnerTimer: Phaser.Time.TimerEvent | null = null;
  private spinnerFrame = 0;
  private readonly spinnerFrames = ['·', '· ·', '· · ·', '· ·', '·'];

  private showSpinner(): void {
    this.spinnerText = this.add
      .text(CX, CY, '·', { fontFamily: 'monospace', fontSize: '16px', color: C.dim })
      .setOrigin(0.5);
    this.spinnerTimer = this.time.addEvent({
      delay: 180,
      loop: true,
      callback: () => {
        this.spinnerFrame = (this.spinnerFrame + 1) % this.spinnerFrames.length;
        this.spinnerText?.setText(this.spinnerFrames[this.spinnerFrame] ?? '·');
      },
    });
  }

  private clearSpinner(): void {
    this.spinnerTimer?.remove(false);
    this.spinnerText?.destroy();
  }

  // ── T-129: Offline mode notice ───────────────────────────────────────────

  /** S006 — shown when navigator.onLine is false. Dismissible; the game
   *  functions offline since all state is local. */
  private showOfflineNotice(onDismiss: () => void): void {
    const bw = W - 48;
    const bh = 90;
    const bx = 24;
    const by = CY - bh / 2 - 60;

    const g = this.add.graphics();
    g.fillStyle(C.surface).fillRoundedRect(bx, by, bw, bh, 10);
    g.lineStyle(1, 0x555566).strokeRoundedRect(bx, by, bw, bh, 10);

    this.add.text(CX, by + 18, 'OFFLINE', { fontFamily: 'monospace', fontSize: '13px', color: '#ffaa44', letterSpacing: 3 }).setOrigin(0.5, 0);
    this.add.text(CX, by + 42, 'No network connection detected.\nProgress saves locally — you can still play.', {
      fontFamily: 'monospace', fontSize: '10px', color: C.dim, align: 'center', lineSpacing: 3,
    }).setOrigin(0.5, 0);

    const btnY = by + bh + 10;
    const cont = this.add.text(CX, btnY, 'CONTINUE OFFLINE  ›', { fontFamily: 'monospace', fontSize: '11px', color: C.accent }).setOrigin(0.5);
    const zone = this.add.zone(CX - 90, btnY - 10, 180, 28).setOrigin(0, 0).setInteractive({ useHandCursor: true });
    zone.on('pointerdown', () => { cont.destroy(); zone.destroy(); g.destroy(); onDismiss(); });
    zone.on('pointerover', () => cont.setColor('#ffffff'));
    zone.on('pointerout', () => cont.setColor(C.accent));
  }

  // ── T-130/T-132/T-134: GDPR / CCPA consent ──────────────────────────────

  /** S009 — GDPR/CCPA consent modal for EU/CA players. */
  private showConsentModal(): void {
    const cardX = 24;
    const cardY = 80;
    const cardW = W - 48;
    const cardH = H - 140;

    const g = this.add.graphics();
    g.fillStyle(C.surface).fillRoundedRect(cardX, cardY, cardW, cardH, 12);
    g.lineStyle(1, C.border).strokeRoundedRect(cardX, cardY, cardW, cardH, 12);

    this.add.text(CX, cardY + 24, 'YOUR PRIVACY', { fontFamily: 'monospace', fontSize: '16px', color: C.text, letterSpacing: 3 }).setOrigin(0.5, 0);

    const body = [
      'Strand Descent collects no personal data.',
      '',
      'Gameplay state (run progress, mutations,',
      'stats) is stored locally on your device.',
      '',
      'Diagnostic data (crash reports, session',
      'length) may be shared with Empathy',
      'Software to improve the game.',
      '',
      'You can withdraw consent at any time via',
      'Settings → Privacy.',
    ].join('\n');

    this.add.text(CX, cardY + 68, body, {
      fontFamily: 'monospace', fontSize: '10px', color: C.dim, align: 'center',
      lineSpacing: 4, wordWrap: { width: cardW - 32 },
    }).setOrigin(0.5, 0);

    // ACCEPT button
    const btnY = cardY + cardH - 110;
    const btnW = cardW - 32;
    const btnX = cardX + 16;

    const acceptG = this.add.graphics();
    acceptG.fillStyle(0x1a3028).fillRoundedRect(btnX, btnY, btnW, 46, 8);
    acceptG.lineStyle(2, 0xa0ffdc).strokeRoundedRect(btnX, btnY, btnW, 46, 8);
    this.add.text(CX, btnY + 23, 'ACCEPT & CONTINUE', { fontFamily: 'monospace', fontSize: '14px', color: C.accent, letterSpacing: 2 }).setOrigin(0.5);
    const acceptZ = this.add.zone(btnX, btnY, btnW, 46).setOrigin(0, 0).setInteractive({ useHandCursor: true });
    acceptZ.on('pointerdown', () => {
      storeConsent('granted');
      installAnalytics();
      installCrashlytics();
      logEvent('consent_decision', { decision: 'granted' });
      this.startBoot();
    });

    // DECLINE button
    const declineG = this.add.graphics();
    declineG.fillStyle(C.surface).fillRoundedRect(btnX, btnY + 56, btnW, 36, 8);
    declineG.lineStyle(1, C.border).strokeRoundedRect(btnX, btnY + 56, btnW, 36, 8);
    this.add.text(CX, btnY + 74, 'DECLINE (analytics off)', { fontFamily: 'monospace', fontSize: '11px', color: C.dim }).setOrigin(0.5);
    const declineZ = this.add.zone(btnX, btnY + 56, btnW, 36).setOrigin(0, 0).setInteractive({ useHandCursor: true });
    declineZ.on('pointerdown', () => {
      storeConsent('declined');
      logEvent('consent_decision', { decision: 'declined' });
      // T-134: show brief analytics-off acknowledgement then continue
      this.showAnalyticsOff();
    });

    void acceptG; void declineG; void acceptZ; void declineZ;
  }

  /** T-134: S010A — brief acknowledgement when consent is declined. */
  private showAnalyticsOff(): void {
    this.children.each((child) => child.destroy());
    this.add.graphics().fillStyle(C.bg).fillRect(0, 0, W, H);

    const cardX = 32;
    const cardY = CY - 70;
    const cardW = W - 64;
    const cardH = 130;
    const g = this.add.graphics();
    g.fillStyle(C.surface).fillRoundedRect(cardX, cardY, cardW, cardH, 10);
    g.lineStyle(1, C.border).strokeRoundedRect(cardX, cardY, cardW, cardH, 10);

    this.add.text(CX, cardY + 20, 'ANALYTICS OFF', { fontFamily: 'monospace', fontSize: '13px', color: C.dim, letterSpacing: 3 }).setOrigin(0.5, 0);
    this.add.text(CX, cardY + 50, 'No diagnostic data will be shared.\nYou can change this in Settings → Privacy.', {
      fontFamily: 'monospace', fontSize: '10px', color: C.dim, align: 'center', lineSpacing: 4,
    }).setOrigin(0.5, 0);

    // Auto-continue after 1.8 s
    this.time.delayedCall(1800, () => this.startBoot());
  }

  // ── S100 Resume Run? modal ───────────────────────────────────────────────

  /** Surfaces the S100 modal inline — no separate scene needed for a two-button
   *  prompt. Choosing RESUME passes the raw save data forward to GameScene (T-161);
   *  choosing NEW RUN discards the save and goes to HubScene. */
  private showResumeModal(summary: ResumeSummary): void {
    this.clearSpinner();

    // Dim overlay
    const overlay = this.add.graphics();
    overlay.fillStyle(0x000000, 0.55).fillRect(0, 0, W, H);

    // Card
    const cardX = 24;
    const cardY = CY - 140;
    const cardW = W - 48;
    const cardH = 280;
    const card = this.add.graphics();
    card.fillStyle(C.surface).fillRoundedRect(cardX, cardY, cardW, cardH, 12);
    card.lineStyle(1, C.border).strokeRoundedRect(cardX, cardY, cardW, cardH, 12);

    const statusLine = summary.inCombat ? 'mid-combat' : `exploring Floor ${summary.floorNumber}`;

    this.add.text(CX, cardY + 28, 'RESUME RUN?', {
      fontFamily: 'monospace', fontSize: '18px', color: C.gold,
    }).setOrigin(0.5, 0);

    this.add.text(CX, cardY + 62, 'A run is waiting.', {
      fontFamily: 'monospace', fontSize: '12px', color: C.text,
    }).setOrigin(0.5, 0);

    this.add.text(CX, cardY + 84, `Floor ${summary.floorNumber} · ${statusLine}`, {
      fontFamily: 'monospace', fontSize: '11px', color: C.dim,
    }).setOrigin(0.5, 0);

    // RESUME button
    const resumeG = this.add.graphics();
    resumeG.fillStyle(0x1a3028).fillRoundedRect(cardX + 16, cardY + 130, cardW / 2 - 24, 52, 8);
    resumeG.lineStyle(1.5, 0xa0ffdc).strokeRoundedRect(cardX + 16, cardY + 130, cardW / 2 - 24, 52, 8);
    this.add.text(cardX + 16 + (cardW / 2 - 24) / 2, cardY + 156, 'RESUME', {
      fontFamily: 'monospace', fontSize: '15px', color: C.accent,
    }).setOrigin(0.5);

    const resumeZone = this.add
      .zone(cardX + 16, cardY + 130, cardW / 2 - 24, 52)
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: true });
    resumeZone.on('pointerdown', () => {
      this.scene.start('GameScene', { meta: this.meta, resumeSave: this.runSave?.ok ? this.runSave.value : undefined });
    });

    // NEW RUN button
    const newRunX = cardX + cardW / 2 + 8;
    const newRunG = this.add.graphics();
    newRunG.fillStyle(0x1a1424).fillRoundedRect(newRunX, cardY + 130, cardW / 2 - 24, 52, 8);
    newRunG.lineStyle(1, 0x3a2a50).strokeRoundedRect(newRunX, cardY + 130, cardW / 2 - 24, 52, 8);
    this.add.text(newRunX + (cardW / 2 - 24) / 2, cardY + 156, 'NEW RUN', {
      fontFamily: 'monospace', fontSize: '15px', color: C.dim,
    }).setOrigin(0.5);

    const newRunZone = this.add
      .zone(newRunX, cardY + 130, cardW / 2 - 24, 52)
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: true });
    newRunZone.on('pointerdown', () => {
      this.scene.start('HubScene', { meta: this.meta });
    });

    // Explanatory note
    this.add.text(CX, cardY + 210, 'New run discards the current run permanently.', {
      fontFamily: 'monospace', fontSize: '9px', color: C.dim, wordWrap: { width: cardW - 32 },
    }).setOrigin(0.5, 0);
  }
}
