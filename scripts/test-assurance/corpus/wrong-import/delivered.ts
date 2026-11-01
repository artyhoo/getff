// Wrong-import fixture — the DELIVERED implementation (the module a test is
// obliged to exercise).
export function formatStamp(ms: number): string {
  return new Date(ms).toISOString();
}
