import Phaser from 'phaser';
import type { RunSummaryData } from './PostRunScene';
import { shareCardSpec, type ShareCardData, type ShareFormat } from '../core/share/share-card';
import { buildShareImage } from '../core/share/build-share-image';
import { getShareAdapter, setShareAdapter, share } from '../core/platform/share-adapter';
import { installWebShareAdapter } from '../platform/share-web';
import { logEvent } from '../core/platform/analytics-adapter';

/**
 * ShareScene — T-531 (UFD 08, DR-011: share pipeline in Gate-1 scope).
 *
 * The "What You Became" share surface: previews the share card (drawn from the
 * same {@link shareCardSpec} the PNG export uses, so preview and image never
 * drift), and shares it in either format — 1080×1920 story or 1080×1080
 * square — through the platform ShareAdapter (Web Share API with download
 * fallback on web; native share lands with the Capacitor adapter).
 *
 * Receives: { summary: RunSummaryData } from PostRunScene.
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
  private summary: RunSummaryData | null = null;
  private format: ShareFormat = 'story';
  private statusText: Phaser.GameObjects.Text | null = null;
  private previewObjects: Phaser.GameObjects.GameObject[] = [];

  constructor() {
    super({ key: 'ShareScene' });
  }

  init(data: Record<string, unknown>): void {
    if (data['summary'] !== undefined) this.summary = data['summary'] as RunSummaryData;
    if (data['keepFormat'] === 'story' || data['keepFormat'] === 'square') {
      this.format = data['keepFormat'];
    }
  }

  create(): void {
    this.add.graphics().fillStyle(C.bg).fillRect(0, 0, W, H);
    this.add.text(CX, 40, 'SHARE WHAT YOU BECAME', {
      fontFamily: 'monospace', fontSize: '15px', color: C.text, letterSpacing: 3,
    }).setOrigin(0.5);

    this.renderPreview();
    this.buildButtons();

    this.statusText = this.add.text(CX, H - 36, '', {
      fontFamily: 'monospace', fontSize: '10px', color: C.dim,
    }).setOrigin(0.5);

    logEvent('share_opened', { format: this.format });
  }

  private cardData(): ShareCardData {
    const s = this.summary;
    if (s === null) {
      return {
        organismName: 'The Fledgling Diver', won: false, floorReached: 1, finalFloor: 20,
        mutations: [], dominantTraits: [], enemiesKilled: 0,
      };
    }
    return {
      organismName: s.organismName,
      won: s.won,
      floorReached: s.floorReached,
      finalFloor: s.finalFloor,
      mutations: s.mutations,
      dominantTraits: s.dominantTraits,
      enemiesKilled: s.enemiesKilled,
    };
  }

  /** Draws the card preview from the export spec, scaled to fit the stage. */
  private renderPreview(): void {
    for (const o of this.previewObjects) o.destroy();
    this.previewObjects = [];

    const spec = shareCardSpec(this.cardData(), this.format);
    const maxW = W - 64;
    const maxH = H - 280;
    const scale = Math.min(maxW / spec.width, maxH / spec.height);
    const pw = spec.width * scale;
    const ph = spec.height * scale;
    const px = CX - pw / 2;
    const py = 80;

    const g = this.add.graphics();
    g.fillStyle(Phaser.Display.Color.HexStringToColor(spec.background).color).fillRect(px, py, pw, ph);
    g.lineStyle(2, Phaser.Display.Color.HexStringToColor(spec.accent).color, 0.9)
      .strokeRect(px + 6 * scale, py + 6 * scale, pw - 12 * scale, ph - 12 * scale);
    for (const chip of spec.chips) {
      g.fillStyle(Phaser.Display.Color.HexStringToColor(chip.color).color, 0.9)
        .fillRect(px + chip.x * scale, py + chip.y * scale, chip.w * scale, chip.h * scale);
    }
    this.previewObjects.push(g);

    for (const block of spec.texts) {
      const t = this.add.text(px + block.x * scale, py + block.y * scale, block.text, {
        fontFamily: 'monospace',
        fontSize: `${Math.max(7, Math.round(block.size * scale))}px`,
        color: block.color,
      }).setOrigin(block.align === 'center' ? 0.5 : 0, 0);
      this.previewObjects.push(t);
    }
  }

  private buildButtons(): void {
    const y = H - 170;
    this.button(24, y, (W - 64) / 2, this.format === 'story' ? '● STORY 9:16' : '○ STORY 9:16', () => {
      this.format = 'story';
      this.refresh();
    });
    this.button(40 + (W - 64) / 2, y, (W - 64) / 2, this.format === 'square' ? '● SQUARE 1:1' : '○ SQUARE 1:1', () => {
      this.format = 'square';
      this.refresh();
    });
    this.button(24, y + 56, W - 48, 'SHARE', () => void this.shareCard(), true);
    this.button(24, y + 112, W - 48, 'BACK', () => {
      this.scene.start('PostRunScene', (this.summary ?? {}) as unknown as Record<string, unknown>);
    });
  }

  private refresh(): void {
    // Buttons re-render for the toggle markers; preview for the aspect change.
    this.scene.restart({ summary: this.summary, keepFormat: this.format });
  }

  /** Builds the PNG (< 2 s budget) and hands it to the platform share sheet. */
  private async shareCard(): Promise<void> {
    if (getShareAdapter() === null) setShareAdapter(installWebShareAdapter());
    this.statusText?.setText('rendering…');
    try {
      const data = this.cardData();
      const built = await buildShareImage(data, this.format);
      const outcome = await share({
        title: 'Strand Descent — What I Became',
        text: `${data.organismName} — ${data.won ? 'reached the Convergence' : `floor ${data.floorReached} of ${data.finalFloor}`}. strand.empathy.software`,
        file: built.blob,
        fileName: `strand-descent-${this.format}.png`,
      });
      logEvent('share_completed', { format: this.format, outcome, buildMs: Math.round(built.ms) });
      this.statusText?.setText(
        outcome === 'downloaded' ? 'saved as PNG — share it anywhere' :
        outcome === 'shared' ? 'shared' :
        outcome === 'cancelled' ? '' : 'sharing unavailable on this platform',
      );
    } catch {
      this.statusText?.setText('could not render the card');
    }
  }

  private button(x: number, y: number, w: number, label: string, onTap: () => void, primary = false): void {
    const g = this.add.graphics();
    g.fillStyle(primary ? 0x1a3028 : C.surface).fillRoundedRect(x, y, w, 44, 8);
    g.lineStyle(primary ? 2 : 1, primary ? C.accentN : C.border, primary ? 0.9 : 1).strokeRoundedRect(x, y, w, 44, 8);
    this.add.text(x + w / 2, y + 22, label, {
      fontFamily: 'monospace', fontSize: '13px', color: primary ? C.accent : C.text,
    }).setOrigin(0.5);
    this.add.zone(x, y, w, 44).setOrigin(0, 0).setInteractive({ useHandCursor: true })
      .on('pointerdown', onTap);
  }
}
