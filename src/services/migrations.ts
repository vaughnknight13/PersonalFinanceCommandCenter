// One function per format change. Each takes data saved by one version and
// returns data in the next version's shape. See docs/data-format.md.

// Version 2 added `categoryRules` (the user's own keyword rules).
// Data saved by version 1 simply has none.
export function migrateV1ToV2(data: unknown): unknown {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    throw new Error('Version 1 data must be an object.');
  }
  return { ...data, categoryRules: [] };
}