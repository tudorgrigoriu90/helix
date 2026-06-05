import { describe, it, expect } from 'vitest';
import {
  EVENT_DEFS, pickEvent, resolveEvent,
  EVENT_VEIN_GRANT, EVENT_SIG_GRANT, EVENT_HEAL_FRACTION,
} from './event-room';

describe('EVENT_DEFS — T-176', () => {
  it('every event offers exactly three choices', () => {
    for (const evt of EVENT_DEFS) {
      expect(evt.choices.length).toBe(3);
    }
  });

  it('every event has a unique id', () => {
    const ids = EVENT_DEFS.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every choice uses a known reward kind', () => {
    const kinds = new Set(['vein', 'heal', 'sig']);
    for (const evt of EVENT_DEFS) {
      for (const c of evt.choices) expect(kinds.has(c.reward)).toBe(true);
    }
  });

  it('every event offers each reward kind once (a real trade-off)', () => {
    for (const evt of EVENT_DEFS) {
      expect(new Set(evt.choices.map((c) => c.reward))).toEqual(new Set(['vein', 'heal', 'sig']));
    }
  });
});

describe('pickEvent — T-176', () => {
  it('is deterministic for a given room id', () => {
    expect(pickEvent('room-7')).toBe(pickEvent('room-7'));
  });

  it('always returns an event from the table', () => {
    for (const id of ['a', 'room-1', 'lace_event_42', 'zzz', '']) {
      expect(EVENT_DEFS).toContain(pickEvent(id));
    }
  });

  it('spreads different room ids across the table', () => {
    const picked = new Set(
      ['r0', 'r1', 'r2', 'r3', 'r4', 'r5', 'r6', 'r7'].map((id) => pickEvent(id).id),
    );
    expect(picked.size).toBeGreaterThan(1);
  });
});

describe('resolveEvent — T-176', () => {
  it('grants the bold VEIN amount', () => {
    const o = resolveEvent('vein', 100);
    expect(o.amount).toBe(EVENT_VEIN_GRANT);
    expect(o.headline).toContain(String(EVENT_VEIN_GRANT));
  });

  it('grants the cautious VEIN amount', () => {
    const o = resolveEvent('sig', 100);
    expect(o.amount).toBe(EVENT_SIG_GRANT);
  });

  it('heals a fraction of max HP, floored', () => {
    const o = resolveEvent('heal', 99);
    expect(o.amount).toBe(Math.floor(99 * EVENT_HEAL_FRACTION));
    expect(o.headline).toContain(String(o.amount));
  });

  it('carries a LACE line for every reward', () => {
    for (const reward of ['vein', 'heal', 'sig'] as const) {
      expect(resolveEvent(reward, 100).lace.length).toBeGreaterThan(0);
    }
  });
});
