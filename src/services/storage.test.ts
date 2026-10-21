import { describe, expect, it } from 'vitest';
import { createMemoryStorage } from '../test/memoryStorage';
import { makeValidData } from '../test/fixtures';
import {
  BACKUP_KEY,
  CURRENT_SCHEMA_VERSION,
  STORAGE_KEY,
  clearAllData,
  loadAppData,
  migrateToVersion,
  quarantineStoredData,
  readQuarantinedData,
  saveAppData,
} from './storage';

const FIXED_NOW = new Date('2026-10-20T12:00:00.000Z');

function store(storage: ReturnType<typeof createMemoryStorage>, envelope: unknown): void {
  storage.values.set(STORAGE_KEY, JSON.stringify(envelope));
}

describe('loadAppData and saveAppData', () => {
  it('reports "empty" when nothing is saved', () => {
    expect(loadAppData(createMemoryStorage())).toEqual({ status: 'empty' });
  });

  it('round-trips data through storage', () => {
    const storage = createMemoryStorage();
    expect(saveAppData(makeValidData(), storage, FIXED_NOW)).toEqual({ ok: true });
    expect(loadAppData(storage)).toEqual({ status: 'loaded', data: makeValidData() });
  });

  it('saves a versioned, time-stamped envelope', () => {
    const storage = createMemoryStorage();
    saveAppData(makeValidData(), storage, FIXED_NOW);
    const saved = JSON.parse(storage.values.get(STORAGE_KEY) ?? '{}');
    expect(saved.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(saved.savedAt).toBe('2026-10-20T12:00:00.000Z');
  });

  it('refuses to save invalid data and keeps what was already saved', () => {
    const storage = createMemoryStorage();
    saveAppData(makeValidData(), storage, FIXED_NOW);
    const before = storage.values.get(STORAGE_KEY);

    const invalid = { ...makeValidData(), accounts: [] };
    const result = saveAppData(invalid, storage, FIXED_NOW);

    expect(result.ok).toBe(false);
    expect(storage.values.get(STORAGE_KEY)).toBe(before);
  });

  it('reports a full storage and keeps the previous data', () => {
    const storage = createMemoryStorage();
    saveAppData(makeValidData(), storage, FIXED_NOW);
    const before = storage.values.get(STORAGE_KEY);

    storage.failWrites = true;
    const result = saveAppData({ ...makeValidData(), isDemo: true }, storage, FIXED_NOW);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('Could not save');
    }
    expect(storage.values.get(STORAGE_KEY)).toBe(before);
  });

  it('reports unavailable storage', () => {
    expect(loadAppData(null).status).toBe('unavailable');
    expect(saveAppData(makeValidData(), null).ok).toBe(false);

    const blocked = createMemoryStorage();
    blocked.failReads = true;
    expect(loadAppData(blocked).status).toBe('unavailable');
  });
});

describe('damaged and unexpected stored data', () => {
  it.each([
    ['text that is not JSON', '{oops'],
    ['JSON that is not an object', '[1, 2, 3]'],
    ['an envelope without a version', JSON.stringify({ savedAt: 'x', data: {} })],
    ['an envelope without contents', JSON.stringify({ schemaVersion: 1, savedAt: 'x' })],
    ['a fractional version', JSON.stringify({ schemaVersion: 1.5, savedAt: 'x', data: {} })],
  ])('reports %s as corrupt without changing it', (_label, raw) => {
    const storage = createMemoryStorage();
    storage.values.set(STORAGE_KEY, raw);

    expect(loadAppData(storage).status).toBe('corrupt');
    expect(storage.values.get(STORAGE_KEY)).toBe(raw);
  });

  it('reports data that fails validation as corrupt, with a reason', () => {
    const storage = createMemoryStorage();
    store(storage, { schemaVersion: 1, savedAt: 'x', data: { ...makeValidData(), accounts: 'nope' } });

    const result = loadAppData(storage);
    expect(result.status).toBe('corrupt');
    if (result.status === 'corrupt') {
      expect(result.reason).toContain('accounts');
    }
  });

  it('reports data saved by a newer version of the app', () => {
    const storage = createMemoryStorage();
    store(storage, { schemaVersion: 99, savedAt: 'x', data: makeValidData() });
    expect(loadAppData(storage)).toEqual({ status: 'too-new', foundVersion: 99 });
  });
});

describe('migrations', () => {
  it('runs each step in order', () => {
    const result = migrateToVersion(
      2,
      1,
      3,
      {
        1: (value) => (value as number) * 10,
        2: (value) => (value as number) + 5,
      },
    );
    expect(result).toEqual({ ok: true, data: 25 }); // (2 * 10) + 5; the reverse order would give 70
  });

  it('upgrades old stored data when loading', () => {
    const storage = createMemoryStorage();
    const { isDemo: _removed, ...versionOneData } = makeValidData();
    store(storage, { schemaVersion: 1, savedAt: 'x', data: versionOneData });

    const addIsDemo = { 1: (data: unknown) => ({ ...(data as object), isDemo: false }) };
    const result = loadAppData(storage, addIsDemo, 2);

    expect(result).toEqual({ status: 'loaded', data: makeValidData() });
  });

  it('reports a missing migration step as corrupt', () => {
    const storage = createMemoryStorage();
    store(storage, { schemaVersion: 1, savedAt: 'x', data: makeValidData() });

    const result = loadAppData(storage, {}, 2);
    expect(result.status).toBe('corrupt');
    if (result.status === 'corrupt') {
      expect(result.reason).toContain('No migration');
    }
  });

  it('reports a migration that throws as corrupt', () => {
    const storage = createMemoryStorage();
    store(storage, { schemaVersion: 1, savedAt: 'x', data: makeValidData() });

    const failing = {
      1: () => {
        throw new Error('boom');
      },
    };
    const result = loadAppData(storage, failing, 2);
    expect(result.status).toBe('corrupt');
    if (result.status === 'corrupt') {
      expect(result.reason).toContain('boom');
    }
  });
});

describe('quarantineStoredData and clearAllData', () => {
  it('moves damaged data to the backup key', () => {
    const storage = createMemoryStorage();
    storage.values.set(STORAGE_KEY, '{oops');

    expect(quarantineStoredData(storage)).toEqual({ ok: true });
    expect(storage.values.has(STORAGE_KEY)).toBe(false);
    expect(readQuarantinedData(storage)).toBe('{oops');
    expect(loadAppData(storage)).toEqual({ status: 'empty' });
  });

  it('leaves the original in place if the backup cannot be written', () => {
    const storage = createMemoryStorage();
    storage.values.set(STORAGE_KEY, '{oops');
    storage.failWrites = true;

    expect(quarantineStoredData(storage).ok).toBe(false);
    expect(storage.values.get(STORAGE_KEY)).toBe('{oops');
  });

  it('clears the data and any backup', () => {
    const storage = createMemoryStorage();
    storage.values.set(STORAGE_KEY, 'a');
    storage.values.set(BACKUP_KEY, 'b');

    expect(clearAllData(storage)).toEqual({ ok: true });
    expect(storage.values.size).toBe(0);
  });
});