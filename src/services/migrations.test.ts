import { describe, expect, it } from 'vitest';
import { createMemoryStorage } from '../test/memoryStorage';
import { makeValidData } from '../test/fixtures';
import { migrateV1ToV2 } from './migrations';
import { CURRENT_SCHEMA_VERSION, STORAGE_KEY, loadAppData, saveAppData } from './storage';

// What version 1 of the app saved: everything except the keyword rules.
function makeVersionOneData(): Record<string, unknown> {
  const { categoryRules: _added, ...versionOne } = makeValidData();
  return versionOne;
}

describe('migrateV1ToV2', () => {
  it('adds an empty list of keyword rules and keeps everything else', () => {
    const upgraded = migrateV1ToV2(makeVersionOneData());
    expect(upgraded).toEqual(makeValidData());
  });

  it('does not change the data it is given', () => {
    const original = makeVersionOneData();
    migrateV1ToV2(original);
    expect(original).not.toHaveProperty('categoryRules');
  });

  it.each([null, 'text', 42, [], undefined])('refuses data that is not an object (%j)', (input) => {
    expect(() => migrateV1ToV2(input)).toThrow('Version 1 data must be an object.');
  });
});

describe('upgrading saved data on load', () => {
  it('is on version 2', () => {
    expect(CURRENT_SCHEMA_VERSION).toBe(2);
  });

  it('loads data saved by version 1 of the app, using the real migrations', () => {
    const storage = createMemoryStorage();
    const savedByVersionOne = JSON.stringify({ schemaVersion: 1, savedAt: 'x', data: makeVersionOneData() });
    storage.values.set(STORAGE_KEY, savedByVersionOne);

    const result = loadAppData(storage);

    expect(result).toEqual({ status: 'loaded', data: makeValidData() });
    // Loading never writes, so the stored copy is still version 1.
    expect(storage.values.get(STORAGE_KEY)).toBe(savedByVersionOne);
  });

  it('saves in version 2 after an upgrade', () => {
    const storage = createMemoryStorage();
    storage.values.set(STORAGE_KEY, JSON.stringify({ schemaVersion: 1, savedAt: 'x', data: makeVersionOneData() }));

    const loaded = loadAppData(storage);
    if (loaded.status !== 'loaded') {
      throw new Error('Expected the version 1 data to load');
    }
    expect(saveAppData(loaded.data, storage).ok).toBe(true);

    const saved = JSON.parse(storage.values.get(STORAGE_KEY) ?? '{}');
    expect(saved.schemaVersion).toBe(2);
    expect(saved.data.categoryRules).toEqual([]);
  });

  it('treats a version 1 envelope with damaged contents as corrupt', () => {
    const storage = createMemoryStorage();
    storage.values.set(STORAGE_KEY, JSON.stringify({ schemaVersion: 1, savedAt: 'x', data: 'not an object' }));
    expect(loadAppData(storage).status).toBe('corrupt');
  });
});