// A new unique id for a record. randomUUID is only available on secure
// pages (https or localhost), so there is a fallback for anything else.
// These ids label local records and are not used for security.
export function createId(
  source: { randomUUID?: () => string } | null | undefined = globalThis.crypto,
): string {
  if (source !== null && source !== undefined && typeof source.randomUUID === 'function') {
    return source.randomUUID();
  }
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}