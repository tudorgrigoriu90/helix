import Phaser from 'phaser';
import type { MetaState } from '@shared-types/meta-state';
import type { MutationFamily } from '@shared-types/mutation';
import { newMetaState } from '../core/save';
import { SaveManager } from '../core/save/save-manager';
import { getStorageAdapter } from '../platform/storage';
import { runSessionCodec } from '../core/run/run-session-save';
import { decideResume, type CheckpointSummary } from '../core/run/resume-decision';
import type { RunSessionSave } from '../core/run/run-session';
import { FAMILY_LOOK } from './strand-event';

/**
 * S017 Hub — T-144.
 *
 * The player's home between runs. Shows the lifetime stats from MetaState,
 * provides the entry point for starting a new run, and surfaces secondary
 * navigation (Codex, Settings).
 *
 * Receives: { meta: MetaState } from GameBootScene (or any upstream scene).
 * Transitions: START DESCENT → OriginSelectScene (T-145); a run suspended at a
 * DR-009 act-end checkpoint surfaces the "Continue Descent" card (T-510,
 * UFD 02 S017 amendment) which resumes it via GameScene at the next floor's
 * entrance. The card replaces the generic resume prompt for checkpointed runs;
 * mid-floor suspends keep the boot S100 modal.
 */

const W = 390;
const H = 844;
const CX = W / 2;

const C = {
  bg: 0x070b14,
  surface: 0x0e1626,
  surfaceHi: 0x1a2840,
  border: 0x1e2a40,
  borderHi: 0x2a3a55,
  accent: '#a0ffdc',
  accentN: 0xa0ffdc,
  dim: '#7a8fad',
  text: '#e8edf5',
  gold: '#ffdd44',
  danger: '#ff4444',
};

export class HubScene extends Phaser.Scene {
  private meta: MetaState = newMetaState();

  constructor() {
    super({ key: 'HubScene' });
  }

  init(data: Record<string, unknown>): void {
    if (data['meta'] !== undefined) this.meta = data['meta'] as MetaState;
  }

  create(): void {
    this.add.graphics().fillStyle(C.bg).fillRect(0, 0, W, H);
    this.buildHeader();
    this.buildStats();
    this.buildMenu();
    this.buildFooter();
    // Async: surface the "Continue Descent" card if a checkpointed run exists
    // (T-510). Drawn on top of the menu, which shifts down to make room.
    void this.loadCheckpointCard();
  }

  /** Loads the run save and, when it's paused at a DR-009 checkpoint, redraws
   *  the menu with the Continue Descent card on top (UFD 02 S017). */
  private async loadCheckpointCard(): Promise<void> {
    try {
      const saves = new SaveManager(getStorageAdapter(), runSessionCodec);
      const decision = decideResume(await saves.load());
      if (decision.kind !== 'checkpoint' || !this.scene.isActive()) return;
      this.buildContinueDescentCard(decision.summary, decision.save);
    } catch {
      // No storage / corrupt save → the Hub simply shows no card (E011 spirit).
    }
  }

  /** The S017 "Continue Descent" card: organism-so-far, mutation icons,
   *  "Act N — Zone". Tapping resumes at the next floor entrance (T-510). */
  private buildContinueDescentCard(summary: CheckpointSummary, save: RunSessionSave): void {
    const x = 24;
    const y = 226;
    const cardW = W - 48;
    const cardH = 70;

    // The card takes the reserved first menu slot — for a suspended run,
    // continuing is the primary action; New Run stays available right below.
    this.add.graphics()
      .fillStyle(0x102418).fillRoundedRect(x, y, cardW, cardH, 10)
      .lineStyle(2, 0xffdd44, 0.8).strokeRoundedRect(x, y, cardW, cardH, 10);

    this.add.text(x + 18, y + 14, 'CONTINUE DESCENT', {
      fontFamily: 'monospace', fontSize: '16px', color: C.gold,
    });
    const zoneName = summary.nextZone.toUpperCase();
    this.add.text(x + 18, y + 40, `Act ${summary.nextAct} — ${zoneName} · Floor ${summary.nextFloor}`, {
      fontFamily: 'monospace', fontSize: '10px', color: C.dim,
    });

    // Mutation icons: one family-coloured chip per carried mutation (organism-so-far).
    const chipY = y + 54;
    summary.mutationIds.slice(0, 8).forEach((id, i) => {
      const family = id.split('_')[0] as MutationFamily;
      const look = FAMILY_LOOK[family];
      const accent = look !== undefined ? look.accentHex : 0x7a8fad;
      this.add.graphics().fillStyle(accent, 0.9).fillRoundedRect(x + 18 + i * 16, chipY, 12, 6, 2);
    });

    this.add.text(x + cardW - 18, y + cardH / 2, '›', {
      fontFamily: 'monospace', fontSize: '20px', color: C.gold,
    }).setOrigin(1, 0.5);

    const zone = this.add
      .zone(x, y, cardW, cardH)
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: true });
    zone.on('pointerdown', () => {
      this.scene.start('GameScene', { meta: this.meta, resumeSave: save });
    });
  }

  // ── Header ───────────────────────────────────────────────────────────────

  private buildHeader(): void {
    // Thin teal top accent stripe
    this.add.graphics().fillStyle(C.accentN, 0.12).fillRect(0, 0, W, 3);

    this.add.text(CX, 60, 'STRAND DESCENT', {
      fontFamily: 'monospace',
      fontSize: '24px',
      color: C.text,
      letterSpacing: 6,
    }).setOrigin(0.5);

    this.add.text(CX, 92, 'EMPATHY SOFTWARE', {
      fontFamily: 'monospace',
      fontSize: '10px',
      color: C.dim,
      letterSpacing: 4,
    }).setOrigin(0.5);

    // Separator line
    this.add.graphics()
      .lineStyle(1, C.border)
      .lineBetween(24, 116, W - 24, 116);
  }

  // ── Lifetime stats strip ──────────────────────────────────────────────────

  private buildStats(): void {
    const stats = this.meta.lifetime;
    const y = 134;

    const items: Array<{ label: string; value: string | number }> = [
      { label: 'RUNS', value: stats.runs },
      { label: 'WINS', value: stats.wins },
      { label: 'DEPTH', value: stats.deepestFloor === 0 ? '—' : `F${stats.deepestFloor}` },
      { label: 'SC', value: Math.floor(this.meta.shardCrystals) },
    ];

    const colW = W / items.length;
    items.forEach((item, i) => {
      const cx = i * colW + colW / 2;
      this.add.text(cx, y, String(item.value), {
        fontFamily: 'monospace', fontSize: '18px', color: C.accent,
      }).setOrigin(0.5, 0);
      this.add.text(cx, y + 26, item.label, {
        fontFamily: 'monospace', fontSize: '9px', color: C.dim,
      }).setOrigin(0.5, 0);
    });

    this.add.graphics()
      .lineStyle(1, C.border)
      .lineBetween(24, y + 56, W - 24, y + 56);
  }

  // ── Main menu ────────────────────────────────────────────────────────────

  private buildMenu(): void {
    // Slot 0 (226) is reserved for the Continue Descent card when a
    // checkpointed run exists (T-510) — the regular menu starts one row down.
    const menuTop = 314;

    this.menuButton(menuTop, 'ENTER THE VEIN', C.accent, 'Begin a real descent.', () => {
      this.scene.start('OriginSelectScene', { meta: this.meta });
    });

    this.menuButton(menuTop + 88, 'ENTER TUTORIAL', C.accent, 'Learn to move, fight, and mutate.', () => {
      this.scene.start('TutorialIntroScene', { meta: this.meta });
    });

    this.menuButton(menuTop + 176, 'SETTINGS', C.accent, 'Audio, display, accessibility.', () => {
      this.scene.start('SettingsScene', { meta: this.meta });
    });
  }

  /** A full-width tappable menu row with a hover highlight. */
  private menuButton(
    y: number,
    label: string,
    labelColor: string,
    subtitle: string,
    onTap: () => void,
  ): void {
    const x = 24;
    const btnW = W - 48;
    const btnH = 70;

    const g = this.add.graphics();
    g.fillStyle(C.surfaceHi).fillRoundedRect(x, y, btnW, btnH, 10);
    g.lineStyle(1, C.borderHi).strokeRoundedRect(x, y, btnW, btnH, 10);
    g.fillStyle(C.accentN, 0.08).fillRoundedRect(x, y, btnW, btnH, 10);
    g.lineStyle(2, C.accentN, 0.5).strokeRoundedRect(x, y, btnW, btnH, 10);

    this.add.text(x + 18, y + 18, label, {
      fontFamily: 'monospace', fontSize: '16px', color: labelColor,
    });
    this.add.text(x + 18, y + 42, subtitle, {
      fontFamily: 'monospace', fontSize: '10px', color: C.dim,
    });
    // Chevron arrow
    this.add.text(x + btnW - 18, y + btnH / 2, '›', {
      fontFamily: 'monospace', fontSize: '20px', color: C.accent,
    }).setOrigin(1, 0.5);

    const zone = this.add
      .zone(x, y, btnW, btnH)
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: true });
    zone.on('pointerdown', onTap);
    zone.on('pointerover', () => {
      g.clear();
      g.fillStyle(0x1e3048).fillRoundedRect(x, y, btnW, btnH, 10);
      g.lineStyle(2, C.accentN, 0.8).strokeRoundedRect(x, y, btnW, btnH, 10);
    });
    zone.on('pointerout', () => {
      g.clear();
      g.fillStyle(C.surfaceHi).fillRoundedRect(x, y, btnW, btnH, 10);
      g.lineStyle(2, C.accentN, 0.5).strokeRoundedRect(x, y, btnW, btnH, 10);
    });
  }

  // ── Footer ───────────────────────────────────────────────────────────────

  private buildFooter(): void {
    this.add.graphics()
      .lineStyle(1, C.border)
      .lineBetween(24, H - 52, W - 24, H - 52);

    this.add.text(CX, H - 36, 'v0.1.0-alpha  ·  strand.empathy.software', {
      fontFamily: 'monospace', fontSize: '9px', color: C.dim,
    }).setOrigin(0.5);
  }
}
