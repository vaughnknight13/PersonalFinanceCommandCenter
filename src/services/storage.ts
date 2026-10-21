import type { AppData } from '../types/finance';
import { validateAppData } from './appDataValidation';

export const STORAGE_KEY = 'pfcc:data';
export const BACKUP_KEY = 'pfcc:corrupt-backup';
export const CURRENT_SCHEMA_VERSION = 1;

// The part of the browser's Storage object we use. Tests pass a fake one.
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

// migrations[n] converts data saved by schema version n into version n + 1.
// There are none yet because version 1 is the first format. When the data
// format changes, bump CURRENT_SCHEMA_VERSION and add a step here.
export type Migration = (data: unknown) => unknown;
export type MigrationMap = Readonly<Record<number, Migration>>;
const migrations: MigrationMap = {};

interface Envelope {
  schemaVersion: number;
  savedAt: string;
  data: unknown;
}

export type LoadResult =
  | { status: 'empty' } // nothing saved yet (first visit)
  | { status: 'loaded'; data: AppData }
  | { status: 'corrupt'; reason: string } // saved data failed validation; left untouched
  | { status: 'too-new'; foundVersion: number } // saved by a newer version of the app
  | { status: 'unavailable'; reason: string }; // localStorage blocked or missing

export type StorageActionResult = { ok: true } | { ok: false; error: string };

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

// Reading window.localStorage can itself throw (for example, when a browser
// blocks site data), so it is wrapped.
function browserStorage(): StorageLike | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

type EnvelopeResult = { ok: true; envelope: Envelope } | { ok: false; reason: string };

function parseEnvelope(raw: string): EnvelopeResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, reason: 'The saved data is not valid JSON.' };
  }

  if (typeof parsed !== 'object' || parsed === null) {
    return { ok: false, reason: 'The saved data is not an object.' };
  }

  const { schemaVersion, savedAt, data } = parsed as Record<string, unknown>;
  if (typeof schemaVersion !== 'number' || !Number.isInteger(schemaVersion) || schemaVersion < 1) {
    return { ok: false, reason: 'The saved data has no valid schema version.' };
  }
  if (typeof savedAt !== 'string') {
    return { ok: false, reason: 'The saved data has no save timestamp.' };
  }
  if (data === undefined) {
    return { ok: false, reason: 'The saved data has no contents.' };
  }
  return { ok: true, envelope: { schemaVersion, savedAt, data } };
}

export type MigrationResult = { ok: true; data: unknown } | { ok: false; reason: string };

// Applies migrations one version at a time: 1 -> 2, then 2 -> 3, and so on.
export function migrateToVersion(
  data: unknown,
  fromVersion: number,
  toVersion: number,
  steps: MigrationMap,
): MigrationResult {
  let current = data;
  for (let version = fromVersion; version < toVersion; version++) {
    const step = steps[version];
    if (step === undefined) {
      return { ok: false, reason: `No migration exists from version ${version} to ${version + 1}.` };
    }
    try {
      current = step(current);
    } catch (error) {
      return { ok: false, reason: `Migration from version ${version} failed: ${describeError(error)}` };
    }
  }
  return { ok: true, data: current };
}

// Loading never writes. Damaged data is reported, not overwritten, so the
// user can still recover it.
export function loadAppData(
  storage: StorageLike | null = browserStorage(),
  steps: MigrationMap = migrations,
  currentVersion: number = CURRENT_SCHEMA_VERSION,
): LoadResult {
  if (storage === null) {
    return { status: 'unavailable', reason: 'Browser storage is not available.' };
  }

  let raw: string | null;
  try {
    raw = storage.getItem(STORAGE_KEY);
  } catch (error) {
    return { status: 'unavailable', reason: describeError(error) };
  }
  if (raw === null) {
    return { status: 'empty' };
  }

  const parsed = parseEnvelope(raw);
  if (!parsed.ok) {
    return { status: 'corrupt', reason: parsed.reason };
  }
  const { envelope } = parsed;

  if (envelope.schemaVersion > currentVersion) {
    return { status: 'too-new', foundVersion: envelope.schemaVersion };
  }

  const migrated = migrateToVersion(envelope.data, envelope.schemaVersion, currentVersion, steps);
  if (!migrated.ok) {
    return { status: 'corrupt', reason: migrated.reason };
  }

  const validated = validateAppData(migrated.data);
  if (!validated.ok) {
    return { status: 'corrupt', reason: validated.errors.join(' ') };
  }
  return { status: 'loaded', data: validated.data };
}

// Validates first, then writes everything with ONE setItem call. A single
// call either completes or throws (for example, when storage is full), and
// when it throws the previously saved value is left as it was. That makes a
// save, and later a CSV import commit, all-or-nothing.
export function saveAppData(
  data: AppData,
  storage: StorageLike | null = browserStorage(),
  now: Date = new Date(),
): StorageActionResult {
  if (storage === null) {
    return { ok: false, error: 'Browser storage is not available.' };
  }

  const validated = validateAppData(data);
  if (!validated.ok) {
    return { ok: false, error: `Refusing to save invalid data: ${validated.errors[0] ?? 'unknown problem'}` };
  }

  const envelope: Envelope = {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    savedAt: now.toISOString(),
    data: validated.data,
  };

  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(envelope));
    return { ok: true };
  } catch (error) {
    return { ok: false, error: `Could not save: ${describeError(error)}` };
  }
}

// Moves damaged data to a backup key and clears the main key, so the app can
// start fresh without destroying what the user had. If the backup can't be
// written, the original is left in place.
export function quarantineStoredData(storage: StorageLike | null = browserStorage()): StorageActionResult {
  if (storage === null) {
    return { ok: false, error: 'Browser storage is not available.' };
  }
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (raw !== null) {
      storage.setItem(BACKUP_KEY, raw);
    }
    storage.removeItem(STORAGE_KEY);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: `Could not move the damaged data aside: ${describeError(error)}` };
  }
}

export function readQuarantinedData(storage: StorageLike | null = browserStorage()): string | null {
  if (storage === null) {
    return null;
  }
  try {
    return storage.getItem(BACKUP_KEY);
  } catch {
    return null;
  }
}

// Deletes all of this app's data from the browser, including any backup.
// Callers must ask the user to confirm first.
export function clearAllData(storage: StorageLike | null = browserStorage()): StorageActionResult {
  if (storage === null) {
    return { ok: false, error: 'Browser storage is not available.' };
  }
  try {
    storage.removeItem(STORAGE_KEY);
    storage.removeItem(BACKUP_KEY);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: `Could not clear the data: ${describeError(error)}` };
  }
}