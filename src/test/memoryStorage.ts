import type { StorageLike } from '../services/storage';

// A fake localStorage for tests. It can also be told to fail, so we can
// test what happens when storage is full or blocked.
export interface MemoryStorage extends StorageLike {
  readonly values: Map<string, string>;
  failWrites: boolean;
  failReads: boolean;
}

export function createMemoryStorage(): MemoryStorage {
  const values = new Map<string, string>();
  const storage: MemoryStorage = {
    values,
    failWrites: false,
    failReads: false,
    getItem(key) {
      if (storage.failReads) {
        throw new Error('Reading storage is blocked.');
      }
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      if (storage.failWrites) {
        throw new Error('QuotaExceededError: storage is full.');
      }
      values.set(key, value);
    },
    removeItem(key) {
      values.delete(key);
    },
  };
  return storage;
}