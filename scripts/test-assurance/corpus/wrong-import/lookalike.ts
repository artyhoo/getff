// Wrong-import fixture — a LOOK-ALIKE module: same exported name, different
// behavior. It is NOT the delivered implementation.
export function formatStamp(_ms: number): string {
  return '1970-01-01T00:00:00.000Z';
}
