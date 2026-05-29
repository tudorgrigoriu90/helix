import type { StorageAdapter } from '../platform/storage-adapter';
import type { SaveError } from './run-save';

/**
 * Save manager — atomic writes + 3-generation rotation (T-112/T-113, TDD §5.5).
 *
 * Generic over the saved payload via a {@link SaveCodec}, so the same durable
 * write/rotate/recover logic backs run saves, meta saves, etc.
 *
 * Key/value storage can't truly "rename", so we emulate write-temp→rename with a
 * commit pointer: write the new state to the next generation slot, *then* update
 * the head pointer. A crash between the two leaves head on the previous, intact
 * generation. Three generations are kept round-robin so a corrupt newest save
 * falls back to the one before it (NFR P8 durability).
 */

export type LoadResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: SaveError };

export interface SaveCodec<T> {
  serialize(value: T): string;
  deserialize(json: string): LoadResult<T>;
}

const GEN_COUNT = 3;

interface Head {
  readonly gen: number;
  readonly seq: number;
}

export class SaveManager<T> {
  private readonly slots: readonly string[];
  private readonly headKey: string;

  constructor(
    private readonly adapter: StorageAdapter,
    private readonly codec: SaveCodec<T>,
    namespace = 'helix.run',
  ) {
    this.slots = [0, 1, 2].map((i) => `${namespace}.gen${i}`);
    this.headKey = `${namespace}.head`;
  }

  /** Writes a new generation, then commits the head pointer to it. */
  async save(value: T): Promise<void> {
    const head = await this.readHead();
    const nextGen = head === null ? 0 : (head.gen + 1) % GEN_COUNT;
    const nextSeq = head === null ? 1 : head.seq + 1;
    await this.adapter.set(this.slots[nextGen]!, this.codec.serialize(value)); // 1. write generation
    await this.adapter.set(this.headKey, JSON.stringify({ gen: nextGen, seq: nextSeq })); // 2. commit
  }

  /**
   * Loads the newest payload, falling back to older generations if the newest is
   * corrupt. null = no save at all; `{ ok: false }` = every generation failed.
   */
  async load(): Promise<LoadResult<T> | null> {
    const head = await this.readHead();
    if (head === null) return null;

    const order = [head.gen, (head.gen - 1 + GEN_COUNT) % GEN_COUNT, (head.gen - 2 + GEN_COUNT) % GEN_COUNT];
    let lastError: LoadResult<T> | null = null;
    for (const gen of order) {
      const raw = await this.adapter.get(this.slots[gen]!);
      if (raw === null) continue;
      const res = this.codec.deserialize(raw);
      if (res.ok) return res;
      lastError = res;
    }
    return lastError;
  }

  /** True when a loadable (non-corrupt) save exists. */
  async has(): Promise<boolean> {
    const res = await this.load();
    return res !== null && res.ok;
  }

  /** Wipes all generations + the head pointer. */
  async clear(): Promise<void> {
    await Promise.all([...this.slots.map((s) => this.adapter.remove(s)), this.adapter.remove(this.headKey)]);
  }

  private async readHead(): Promise<Head | null> {
    const raw = await this.adapter.get(this.headKey);
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
