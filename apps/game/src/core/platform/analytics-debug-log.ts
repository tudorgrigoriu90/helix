/**
 * T-253: In-memory circular buffer of the last 200 analytics events.
 *
 * Always records regardless of whether an adapter is installed, so dev tools
 * (and tests) can inspect the event stream without setting up Firebase.
 *
 * Pure — no Phaser, no Firebase.
 */

import type { EventSchema } from './analytics-adapter';

export interface DebugLogEntry {
  readonly ts: number;
  readonly name: keyof EventSchema;
  readonly params: EventSchema[keyof EventSchema];
}

const MAX_ENTRIES = 200;
const _log: DebugLogEntry[] = [];

/** Record an event in the circular buffer (called automatically by logEvent). */
export function recordDebugEvent<K extends keyof EventSchema>(name: K, params: EventSchema[K]): void {
  _log.push({ ts: Date.now(), name, params });
  if (_log.length > MAX_ENTRIES) _log.splice(0, _log.length - MAX_ENTRIES);
}

/** Return a read-only snapshot of the last ≤200 events (oldest → newest). */
export function getEventLog(): readonly DebugLogEntry[] {
  return _log;
}

/** Clear the log (useful in tests). */
export function clearEventLog(): void {
  _log.splice(0, _log.length);
}
