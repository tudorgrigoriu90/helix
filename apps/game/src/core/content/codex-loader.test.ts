import { describe, it, expect } from 'vitest';
import type { CodexEntry } from '@shared-types/codex-entry';
import { parseCodexEntries } from './codex-loader';

function bundle(entries: Partial<CodexEntry>[], schemaVersion = 1): unknown {
  return {
    schemaVersion,
    entries: entries.map((e, i) => ({
      id: `e${i}`, title: 'T', category: 'organism', floor: 0, body: 'lore', ...e,
    })),
  };
}

describe('parseCodexEntries — T-294', () => {
  it('parses a well-formed bundle', () => {
    const res = parseCodexEntries(bundle([{ id: 'a' }, { id: 'b' }]));
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.entries).toHaveLength(2);
  });

  it('accepts every valid category', () => {
    const res = parseCodexEntries(
      bundle([
        { id: 'a', category: 'organism' },
        { id: 'b', category: 'phenomenon' },
        { id: 'c', category: 'location' },
        { id: 'd', category: 'lore' },
      ]),
    );
    expect(res.ok).toBe(true);
  });

  it('rejects a bad schema version, non-array entries, and bad fields', () => {
    expect(parseCodexEntries(bundle([], 2)).ok).toBe(false);
    expect(parseCodexEntries({ schemaVersion: 1, entries: 'nope' }).ok).toBe(false);
    expect(parseCodexEntries(bundle([{ category: 'nope' as CodexEntry['category'] }])).ok).toBe(false);
    expect(parseCodexEntries(bundle([{ floor: -1 }])).ok).toBe(false);
    expect(parseCodexEntries(bundle([{ floor: 1.5 }])).ok).toBe(false);
    expect(parseCodexEntries(bundle([{ title: '' }])).ok).toBe(false);
    expect(parseCodexEntries(bundle([{ body: '' }])).ok).toBe(false);
    expect(parseCodexEntries(bundle([{ id: '' }])).ok).toBe(false);
  });

  it('rejects duplicate entry ids', () => {
    const res = parseCodexEntries(bundle([{ id: 'dup' }, { id: 'dup' }]));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.message).toContain('duplicate');
  });
});
