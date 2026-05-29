import type { RunState } from '@shared-types/run-state';
import type { StorageAdapter } from '../platform/storage-adapter';
import { deserializeRunState, serializeRunState, type RunLoadResult } from './run-save';

/**
 * Save manager — atomic writes + 3-generation rotation (T-112/T-113, TDD §5.5).
 *
 * Key/value storage can't truly "rename", so we emulate the write-temp→rename
 * pattern with a commit pointer: write the new state to the next generation
 * slot, *then* update the head pointer. A crash between the two leaves the head
 * pointing at the previous, intact generation — the half-written slot is simply
 * never referenced.
 *
 * Three generations are kept round-robin, so a corrupt newest save can fall back
 * to the one before it (NFR P8 "save every turn" durability).
 */

const GEN_COUNT = 3;
const RUN_SLOTS: readonly string[] = ['helix.run.gen0', 'helix.run.gen1', 'helix.run.gen2'];
const RUN_HEAD = 'helix.run.head';

interface Head {
  readonly gen: number;
  readonly seq: number;
}

export class SaveManager {
  constructor(private readonly adapter: StorageAdapter) {}

  /** Writes a new generation, then commits the head pointer to it. */
  async saveRun(state: RunState): Promise<void> {
    const head = await this.readHead();
    const nextGen = head === null ? 0 : (head.gen + 1) % GEN_COUNT;
    const nextSeq = head === null ? 1 : head.seq + 1;
    await this.adapter.set(RUN_SLOTS[nextGen]!, serializeRunState(state)); // 1. write generation
    await this.adapter.set(RUN_HEAD, JSON.stringify({ gen: nextGen, seq: nextSeq })); // 2. commit
  }

  /**
   * Loads the newest run, falling back to older generations if the newest is
   * corrupt. Returns null when there is no save at all; a `{ ok: false }` result
   * means every present generation failed to parse.
   */
  async loadRun(): Promise<RunLoadResult | null> {
    const head = await this.readHead();
    if (head === null) return null;

    const order = [head.gen, (head.gen - 1 + GEN_COUNT) % GEN_COUNT, (head.gen - 2 + GEN_COUNT) % GEN_COUNT];
    let lastError: RunLoadResult | null = null;
    for (const gen of order) {
      const raw = await this.adapter.get(RUN_SLOTS[gen]!);
      if (raw === null) continue;
      const res = deserializeRunState(raw);
      if (res.ok) return res;
      lastError = res;
    }
    return lastError;
  }

  /** True when a loadable (non-corrupt) run save exists. */
  async hasRun(): Promise<boolean> {
    const res = await this.loadRun();
    return res !== null && res.ok;
  }

  /** Wipes all run generations + the head pointer (e.g. on death / abandon). */
  async clearRun(): Promise<void> {
    await Promise.all([...RUN_SLOTS.map((s) => this.adapter.remove(s)), this.adapter.remove(RUN_HEAD)]);
  }

  private async readHead(): Promise<Head | null> {
    const raw = await this.adapter.get(RUN_HEAD);
    if (raw === null) return null;
    try {
      const parsed: unknown = JSON.parse(raw);
      if (
        typeof parsed === 'object' && parsed !== null &&
        typeof (parsed as Record<string, unknown>)['gen'] === 'number' &&
        typeof (parsed as Record<string, unknown>)['seq'] === 'number'
      ) {
        return parsed as Head;
      }
    } catch {
      // fall through
    }
    return null;
  }
}
