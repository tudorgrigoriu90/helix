import Phaser from 'phaser';
import {
  buildShareImage,
  buildShareUrl,
  getShareAdapter,
  type ShareCardInput,
  type ShareFormat,
  type ShareImage,
} from '../core/share';
import { logEvent } from '../core/platform/analytics-adapter';
import type { RunSummaryData } from './PostRunScene';

/**
 * S143/S144 Share screen — T-331 (UFD Scope 8).
 *
 * Generates the "What You Became" card in both locked formats (1080×1920
 * vertical / 1080×1080 square — S143, client-side, well under the 2 s
 * budget), previews the active format, and hands it to the OS share sheet via
 * the share adapter (S149). The format tab toggles the preview (S144). DONE
 * returns to the run summary. Frame selection (S145) and save-to-roll (S146)
 * land with the cosmetics pass.
 */

const W = 390;
const H = 844;
const CX = W / 2;

const C = {
  bg: 0x070b14,
  surface: 0x0e1626,
  border: 0x1e2a40,
  accent: '#a0ffdc',
  accentN: 0xa0ffdc,
  dim: '#7a8fad',
  text: '#e8edf5',
};

export class ShareScene extends Phaser.Scene {
  private summary!: RunSummaryData;
  private images!: Record<ShareFormat, ShareImage>;
  private format: ShareFormat = 'vertical';
  private shareUrl = '';
  private preview: Phaser.GameObjects.Image | null = null;
  private tabTexts: Partial<Record<ShareFormat, Phaser.GameObjects.Text>> = {};

  constructor() {
    super({ key: 'ShareScene' });
  }

  init(data: Record<string, unknown>): void {
    this.summary = data['summary'] as RunSummaryData;
    this.format = 'vertical';
    this.preview = null;
    this.tabTexts = {};
  }

  create(): void {
    this.add.graphics().fillStyle(C.bg).fillRect(0, 0, W, H);
    this.add.text(CX, 48, 'SHARE WHAT YOU BECAME', {
      fontFamily: 'monospace', fontSize: '15px', color: C.text, letterSpacing: 3,
    }).setOrigin(0.5);

    this.shareUrl = buildShareUrl({ source: 'post_run', organismName: this.summary.organismName });
    const input: ShareCardInput = {
      organismName: this.summary.organismName,
      won: this.summary.won,
      floorReached: this.summary.floorReached,
      finalFloor: this.summary.finalFloor,
      mutations: this.summary.mutations,
      dominantTraits: this.summary.dominantTraits,
      enemiesKilled: this.summary.enemiesKilled,
      playtimeMs: this.summary.playtimeMs,
      shareUrl: this.shareUrl,
    };
    // S143: both formats generate up front (pure canvas fills — instant).
    this.images = {
      vertical: buildShareImage(input, 'vertical'),
      square: buildShareImage(input, 'square'),
    };

    this.buildFormatTabs();
    this.buildButtons();
    this.showPreview();
  }

  // ── S144 format toggle ────────────────────────────────────────────────────

  private buildFormatTabs(): void {
    const tabs: { format: ShareFormat; label: string; x: number }[] = [
      { format: 'vertical', label: 'VERTICAL', x: CX - 80 },
      { format: 'square', label: 'SQUARE', x: CX + 80 },
    ];
    for (const tab of tabs) {
      const t = this.add.text(tab.x, 92, tab.label, {
        fontFamily: 'monospace', fontSize: '12px', color: C.dim,
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });
      t.on('pointerdown', () => {
        this.format = tab.format;
        this.showPreview();
      });
      this.tabTexts[tab.format] = t;
    }
  }

  private showPreview(): void {
    for (const [fmt, t] of Object.entries(this.tabTexts)) {
      t.setColor(fmt === this.format ? C.accent : C.dim);
    }
    const image = this.images[this.format];
    const key = `share-card-${this.format}`;

    const place = (): void => {
      this.preview?.destroy();
      const maxW = W - 64;
      const maxH = H - 320;
      const scale = Math.min(maxW / image.width, maxH / image.height);
      this.preview = this.add.image(CX, 120 + (H - 320) / 2, key).setScale(scale);
    };

    if (this.textures.exists(key)) {
      place();
    } else {
      this.textures.once(`addtexture-${key}`, place);
      this.textures.addBase64(key, image.dataUrl);
    }
  }

  // ── S149 share + done ─────────────────────────────────────────────────────

  private buildButtons(): void {
    const btY = H - 124;
    const halfW = 150;

    this.button(CX - halfW - 8, btY, halfW, 'SHARE', C.accent, () => void this.doShare());
    this.button(CX + 8, btY, halfW, 'DONE', C.dim, () => {
      this.scene.start('PostRunScene', this.summary as unknown as Record<string, unknown>);
    });

    this.add.text(CX, H - 52, this.shareUrl, {
      fontFamily: 'monospace', fontSize: '9px', color: C.dim,
    }).setOrigin(0.5);
  }

  private async doShare(): Promise<void> {
    const image = this.images[this.format];
    const outcome = await getShareAdapter().share({
      title: 'Strand Descent',
      text: `I became ${this.summary.organismName}. ${this.shareUrl}`,
      url: this.shareUrl,
      imageDataUrl: image.dataUrl,
    });
    logEvent('organism_share_completed', { format: this.format, outcome });
  }

  private button(x: number, y: number, w: number, label: string, color: string, onTap: () => void): void {
    const g = this.add.graphics();
    g.fillStyle(C.surface).fillRoundedRect(x, y, w, 50, 10);
    g.lineStyle(1.5, C.accentN, label === 'SHARE' ? 0.9 : 0.3).strokeRoundedRect(x, y, w, 50, 10);
    this.add.text(x + w / 2, y + 25, label, {
      fontFamily: 'monospace', fontSize: '14px', color,
    }).setOrigin(0.5);
    const zone = this.add.zone(x, y, w, 50).setOrigin(0, 0).setInteractive({ useHandCursor: true });
    zone.on('pointerdown', onTap);
  }
}
