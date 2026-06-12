import type { FloorTemplate } from '@shared-types/floor-template';
import type { PlayerState } from '@shared-types/run-state';
import type { MutationDef } from '@shared-types/mutation';
import type { ItemDef } from '@shared-types/item';
import type { SaveCodec, LoadResult } from '../save/save-manager';
import type { EnemyRegistry } from './encounter';
import {
  CURRENT_RUN_SESSION_SAVE_VERSION,
  RunSession,
  type RunSessionSave,
  type RunStatus,
} from './run-session';

/**
 * Persistence for {@link RunSession} — a {@link SaveCodec} the SaveManager can
 * use, plus a restore helper that rebuilds a live session from a save (T-114).
 * Never throws on load; a malformed save reports a structured error.
 */

const VALID_STATUSES = new Set<RunStatus>([
  'exploring', 'in_combat', 'strand_event', 'floor_complete', 'victory', 'defeat',
]);

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isPlayerShape(v: unknown): v is PlayerState {
  return isObject(v) && typeof v['hp'] === 'number' && typeof v['maxHp'] === 'number' && isObject(v['pos']);
}

export const runSessionCodec: SaveCodec<RunSessionSave> = {
  serialize: (save) => JSON.stringify(save),
  deserialize: (json): LoadResult<RunSessionSave> => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch (e) {
      return { ok: false, error: { code: 'INVALID_JSON', message: `run save is not valid JSON: ${(e as Error).message}` } };
    }
    if (!isObject(parsed)) return { ok: false, error: { code: 'NOT_AN_OBJECT', message: 'run save must be an object' } };

    const version = parsed['schemaVersion'];
    if (typeof version !== 'number' || !Number.isInteger(version)) {
      return { ok: false, error: { code: 'MISSING_VERSION', message: 'run save is missing an integer schemaVersion' } };
    }
    if (version > CURRENT_RUN_SESSION_SAVE_VERSION) {
      return { ok: false, error: { code: 'UNMIGRATABLE', message: `run save v${version} is newer than this build` } };
    }
    if (
      typeof parsed['seed'] !== 'number' ||
      typeof parsed['floorNumber'] !== 'number' ||
      typeof parsed['currentRoomId'] !== 'string' ||
      !Array.isArray(parsed['clearedRoomIds']) ||
      !VALID_STATUSES.has(parsed['status'] as RunStatus) ||
      !isPlayerShape(parsed['player'])
    ) {
      return { ok: false, error: { code: 'CORRUPT', message: 'run save failed the structural check' } };
    }
    // Mid-combat saves (v5+) carry the live encounter; if present it must be a
    // RunState-shaped object with a player. (applySave still degrades gracefully
    // to exploring when it's absent.)
    const combat = parsed['combat'];
    if (combat !== undefined && (!isObject(combat) || !isPlayerShape(combat['player']) || !isObject(combat['grid']))) {
      return { ok: false, error: { code: 'CORRUPT', message: 'run save has a malformed combat state' } };
    }
    if (parsed['pendingLoot'] !== undefined && !Array.isArray(parsed['pendingLoot'])) {
      return { ok: false, error: { code: 'CORRUPT', message: 'run save has malformed pendingLoot' } };
    }
    // v7 (T-510, DR-009): an optional act-end checkpoint must be {floor, act}.
    const checkpoint = parsed['checkpoint'];
    if (
      checkpoint !== undefined &&
      (!isObject(checkpoint) ||
        typeof checkpoint['floor'] !== 'number' ||
        typeof checkpoint['act'] !== 'number')
    ) {
      return { ok: false, error: { code: 'CORRUPT', message: 'run save has a malformed checkpoint' } };
    }
    // v8 (T-511, DR-009b): the optional bonus-slot flag must be a boolean.
    if (parsed['bonusMutationTaken'] !== undefined && typeof parsed['bonusMutationTaken'] !== 'boolean') {
      return { ok: false, error: { code: 'CORRUPT', message: 'run save has a malformed bonusMutationTaken' } };
    }
    // v9 (T-513): the optional scene-written suspend timestamp must be a number.
    if (parsed['suspendedAtMs'] !== undefined && typeof parsed['suspendedAtMs'] !== 'number') {
      return { ok: false, error: { code: 'CORRUPT', message: 'run save has a malformed suspendedAtMs' } };
    }
    // v10 (T-301): the optional Origin id must be a string.
    if (parsed['originId'] !== undefined && typeof parsed['originId'] !== 'string') {
      return { ok: false, error: { code: 'CORRUPT', message: 'run save has a malformed originId' } };
    }

    return { ok: true, value: parsed as unknown as RunSessionSave };
  },
};

export interface RestoreOptions {
  readonly template: FloorTemplate;
  readonly registry: EnemyRegistry;
  readonly finalFloor?: number;
  readonly mutations?: readonly MutationDef[];
  readonly strandEventEveryNFloors?: number;
  readonly itemPool?: readonly ItemDef[];
}

/** Rebuilds a live RunSession from a save (floor regenerates from the seed). */
export function restoreRunSession(save: RunSessionSave, options: RestoreOptions): RunSession {
  const session = new RunSession({
    seed: save.seed,
    template: options.template,
    registry: options.registry,
    finalFloor: options.finalFloor,
    mutations: options.mutations,
    strandEventEveryNFloors: options.strandEventEveryNFloors,
    itemPool: options.itemPool,
    player: save.player,
  });
  session.applySave(save);
  return session;
}
