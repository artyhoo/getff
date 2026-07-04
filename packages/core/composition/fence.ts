// Fenced-region inject/check — composition plane (MT umbrella S4, Surface 3).
// Spec: docs/superpowers/specs/2026-07-03-multi-toolchain-convention-compiler-design.md §5.1.
//
// A composed region lives inside a marker pair keyed by section id:
//   <!-- getff:begin section=<id> plan=<path> --> … <!-- getff:end section=<id> -->
// The mechanic MIRRORS render/render-rules.ts:88-119 (indexOf begin/end, splice the middle) —
// replicated here (NOT imported, NOT edited): render-rules is a single-region generic-marker
// tool; this is a multi-region, section-keyed, attribute-carrying fence.
//
// Attribute parsing: `key=value` split on whitespace after the `getff:begin` token. UNKNOWN
// attributes are IGNORED (a marker with `hash=sha256:x` parses fine — a forward-compat / WI-1
// seam). This module NEVER EMITS `hash=` (T-END-B: zero hash bytes in any output) — it only
// tolerates one on input.

/** A begin/end marker pair located in a host document, with its parsed attributes. */
export interface FenceRegion {
  sectionId: string;
  /** All parsed begin-marker attributes (e.g. { section, plan, hash? }). Unknown keys kept. */
  attributes: Record<string, string>;
  /** Index of the first char of the begin marker line. */
  beginIndex: number;
  /** Index one past the last char of the end marker. */
  endIndex: number;
  /** The current body between the markers (exclusive of the markers themselves). */
  body: string;
}

/** Build a `getff:begin` marker for a section, carrying the given attributes (never `hash=`). */
export function beginMarker(sectionId: string, planPath: string): string {
  return `<!-- getff:begin section=${sectionId} plan=${planPath} -->`;
}

/** Build the matching `getff:end` marker for a section. */
export function endMarker(sectionId: string): string {
  return `<!-- getff:end section=${sectionId} -->`;
}

const BEGIN_RE = /<!--\s*getff:begin\s+([^>]*?)\s*-->/g;

/** Parse a whitespace-separated `key=value` attribute string; unknown keys are kept as-is. */
function parseAttributes(attrString: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  for (const token of attrString.trim().split(/\s+/)) {
    if (token.length === 0) continue;
    const eq = token.indexOf('=');
    if (eq === -1) continue; // a bare token with no `=` is ignored, not a crash
    const key = token.slice(0, eq);
    const value = token.slice(eq + 1);
    if (key.length === 0) continue;
    attrs[key] = value;
  }
  return attrs;
}

/**
 * Locate every fenced region in `source`. Multi-region: two regions in one file do not
 * overlap (each begin is matched to its own `getff:end section=<id>`). A begin whose id has
 * no matching end is skipped (treated as not-a-region — the injector re-creates it cleanly).
 */
export function findRegions(source: string): FenceRegion[] {
  const regions: FenceRegion[] = [];
  BEGIN_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = BEGIN_RE.exec(source)) !== null) {
    const attrString = m[1] ?? '';
    const attributes = parseAttributes(attrString);
    const sectionId = attributes['section'];
    if (sectionId === undefined) continue;
    const beginIndex = m.index;
    const beginEnd = m.index + m[0].length;
    const endTok = endMarker(sectionId);
    const endIdx = source.indexOf(endTok, beginEnd);
    if (endIdx === -1) continue; // unterminated begin — not a well-formed region
    regions.push({
      sectionId,
      attributes,
      beginIndex,
      endIndex: endIdx + endTok.length,
      body: source.slice(beginEnd, endIdx),
    });
  }
  return regions;
}

/**
 * Inject (or idempotently re-inject) a single region's rendered content into `source`.
 * If a region for `sectionId` already exists, its body is REPLACED in place (indexOf splice,
 * mirroring render-rules.ts) — the surrounding document and the begin-marker attributes are
 * preserved. If none exists, a fresh `begin\n<content>\nend` block is APPENDED. Idempotent:
 * injecting the same content twice yields byte-identical output.
 */
export function injectRegion(
  source: string,
  sectionId: string,
  planPath: string,
  content: string,
): string {
  const begin = beginMarker(sectionId, planPath);
  const end = endMarker(sectionId);
  const desiredBody = `\n${content}\n`;

  const existing = findRegions(source).find((r) => r.sectionId === sectionId);
  if (existing) {
    // Replace only the body between the existing markers; keep the existing begin marker
    // verbatim (preserving any forward-compat attributes already present on it).
    const beforeBody = source.slice(0, existing.beginIndex);
    const beginMarkerText = source.slice(existing.beginIndex, source.indexOf('-->', existing.beginIndex) + 3);
    const afterEnd = source.slice(existing.endIndex);
    return `${beforeBody}${beginMarkerText}${desiredBody}${end}${afterEnd}`;
  }

  const sep = source.length === 0 || source.endsWith('\n') ? '' : '\n';
  return `${source}${sep}${begin}${desiredBody}${end}\n`;
}

/**
 * Idempotency check: return true iff every provided (sectionId → content) region is already
 * present in `source` with byte-identical body. Used by the gate/CI re-render path — a doc
 * that has drifted from its plan renders a byte-diff, which the caller reports.
 */
export function regionsMatch(source: string, expected: Map<string, string>): boolean {
  const regions = new Map(findRegions(source).map((r) => [r.sectionId, r.body]));
  for (const [sectionId, content] of expected) {
    const body = regions.get(sectionId);
    if (body === undefined) return false;
    if (body !== `\n${content}\n`) return false;
  }
  return true;
}
