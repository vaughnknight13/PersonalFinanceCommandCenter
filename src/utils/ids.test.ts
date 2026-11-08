import { describe, expect, it } from 'vitest';
import { createId } from './ids';

describe('createId', () => {
  it('creates a unique, non-empty id each time', () => {
    const ids = new Set(Array.from({ length: 1000 }, () => createId()));
    expect(ids.size).toBe(1000);
    for (const id of ids) {
      expect(id.length).toBeGreaterThan(0);
    }
  });

  it('uses randomUUID when it is available', () => {
    expect(createId({ randomUUID: () => 'fixed-id' })).toBe('fixed-id');
  });

  it.each([null, {}])('still works where randomUUID is unavailable (%j)', (source) => {
    const first = createId(source);
    const second = createId(source);
    expect(first).toMatch(/^id-/);
    expect(first).not.toBe(second);
  });
});