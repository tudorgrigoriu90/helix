import Phaser from 'phaser';
import type { MetaState } from '@shared-types/meta-state';
import type { RunSessionSave } from '../core/run/run-session';
import type { ResumeDecision, ResumeSummary } from '../core/run/resume-decision';
import type { LoadResult } from '../core/save/save-manager';
import { SaveManager } from '../core/save/save-manager';
import { metaCodec, newMetaState, shouldShowTutorial } from '../core/save';
import { runSessionCodec } from '../core/run/run-session-save';
import { decideResume } from '../core/run/resume-decision';
import { createWebStorageAdapter } from '../platform/storage-web';

/**
 * Boot manager — T-136 (S100 Resume Run? modal, UFD E011).
 *
 * Runs immediately after the studio splash. Not visible during the async
 * load; shows a brief spinner if loading takes more than 400 ms, then
 * either routes silently or surfaces the S100 Resume Run? modal.
 *
 * Route map:
 *  ┌─ first-time player   → TutorialIntroScene (T-135)
 *  ├─ resumable run found → S100 modal → RESUME → GameScene / NEW RUN → HubScene
 *  └─ returning, no run  → HubScene (T-144)
 *
 * The MetaState and run save are loaded here once and forwarded as scene
 * data to downstream scenes so they don't reload storage.
 */

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

    // Show a spinner if the load takes more than 400 ms so the screen isn't
    // just black. Most loads complete in <50 ms on-device.
    const spinnerHandle = this.time.delayedCall(400, () => this.showSpinner());

    void this.bootAsync().then((decision) => {
      spinnerHandle.remove(false);
      this.route(decision);
    });
  }

  private async bootAsync(): Promise<ResumeDecision> {
    const adapter = createWebStorageAdapter();
    const metaSaves = new SaveManager(adapter, metaCodec, 'helix.meta');
    const runSaves = new SaveManager(adapter, runSessionCodec);

    const [metaResult, runResult] = await Promise.all([metaSaves.load(), runSaves.load()]);
    if (metaResult !== null && metaResult.ok) this.meta = metaResult.value;
    this.runSave = runResult;

    return decideResume(runResult);
  }

  private route(decision: ResumeDecision): void {
    // First-time players go straight to the tutorial (T-135).
    if (shouldShowTutorial(this.meta)) {
      this.scene.start('TutorialIntroScene', { meta: this.meta });
      return;
    }

    if (decision.kind === 'prompt') {
      this.showResumeModal(decision.summary);
    } else {
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
