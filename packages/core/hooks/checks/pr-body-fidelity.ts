/**
 * PR-body arm of the acceptance-contour fidelity gate (spec:
 * docs/superpowers/specs/2026-07-23-acceptance-contour-design.md D3).
 * Deterministic form check — the semantic verdict is produced in-session by
 * agents/fidelity-auditor.md (no-paid-llm-in-ci). Sibling of prior-art.ts /
 * pr-body-prior-art-bin.ts.
 *
 * Fail-closed invariants (a false PASS is the dangerous direction):
 *   - exactly ONE `## Fidelity verdict` section, carrying exactly ONE `FIDELITY:`
 *     line — a rework round REPLACES the prior block, never appends to it (an
 *     appended `skipped` must not neutralise a recorded REVISE, and an appended GO
 *     must not be shadowed by the round-1 REVISE above it);
 *   - HTML comments are stripped before parsing: a section that renders empty on
 *     GitHub must not pass on the strength of commented-out template text;
 *   - the file:line evidence must come from a line other than `Basis:` (a
 *     `Basis: spec.md:12` path would otherwise satisfy the evidence requirement
 *     vacuously).
 */
export interface FidelityCheckInput { body: string; headSha: string; }
export interface FidelityCheckResult { ok: boolean; errors: string[]; }

const HEADING_RE = /^##[ \t]+Fidelity verdict[ \t]*$/;
/** Any heading level 1-2 terminates the section (`# H1` closes it too). */
const SECTION_END_RE = /^#{1,2}[ \t]/;
/** ASCII hyphen, en/em/figure/horizontal dashes — all accepted as the `skipped —` separator. */
const SKIPPED_RE = /^FIDELITY:[ \t]*skipped[ \t]*[-–—‒―]+[ \t]*(.+)$/m;
const GO_RE = /^FIDELITY:[ \t]*GO[ \t]*$/m;
const NON_GO_RE = /^FIDELITY:[ \t]*(REVISE|STOP)\b/m;
const ANY_VERDICT_RE = /^FIDELITY:/gm;
const BASIS_RE = /^Basis:[ \t]*\S+/m;
const ROUND_RE = /^Round:[ \t]*\d+[ \t]*$/m;
const SHA_RE = /^Audited-SHA:[ \t]*([0-9a-fA-F]{12,40})[ \t]*$/m;
const FILE_LINE_RE = /[\w./-]+\.[A-Za-z]{1,6}:\d+/;

/** Strip HTML comments so commented-out template text never satisfies the gate. */
function stripComments(text: string): string {
  return text.replace(/<!--[\s\S]*?-->/g, '');
}

interface SectionResult { section: string | null; error?: string; }

function extractSection(body: string): SectionResult {
  const lines = stripComments(body).split(/\r?\n/);
  const starts = lines.reduce<number[]>((acc, l, i) => (HEADING_RE.test(l) ? [...acc, i] : acc), []);
  if (starts.length === 0) {
    return { section: null, error: 'missing `## Fidelity verdict` section (see spec D3; agents/fidelity-auditor.md)' };
  }
  if (starts.length > 1) {
    return { section: null, error: `found ${starts.length} \`## Fidelity verdict\` sections — exactly one is allowed (replace the prior round's block, do not append)` };
  }
  const start = starts[0];
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (SECTION_END_RE.test(lines[i])) { end = i; break; }
  }
  return { section: lines.slice(start + 1, end).join('\n') };
}

/** Evidence must not be satisfied by the `Basis:` path alone. */
function hasEvidence(section: string): boolean {
  return section
    .split('\n')
    .filter((l) => !/^Basis:/.test(l.trim()))
    .some((l) => FILE_LINE_RE.test(l));
}

export function checkPrBodyFidelity({ body, headSha }: FidelityCheckInput): FidelityCheckResult {
  const errors: string[] = [];
  const { section, error } = extractSection(body);
  if (section === null) return { ok: false, errors: [error as string] };

  const verdictLines = section.match(ANY_VERDICT_RE) ?? [];
  if (verdictLines.length === 0) {
    return { ok: false, errors: ['no `FIDELITY: GO` or `FIDELITY: skipped — <rationale>` line found (the token is case-sensitive)'] };
  }
  if (verdictLines.length > 1) {
    return { ok: false, errors: [`found ${verdictLines.length} \`FIDELITY:\` lines in the section — exactly one is allowed (a rework round replaces the block, it does not append)`] };
  }

  // Order matters: a recorded non-GO verdict is terminal and must not be
  // reachable-past by any later branch.
  if (NON_GO_RE.test(section)) {
    return { ok: false, errors: ['non-GO FIDELITY verdict recorded — resolve the rework loop before merge'] };
  }
  const skipped = section.match(SKIPPED_RE);
  if (skipped) {
    if (skipped[1].trim().length < 20) errors.push('skipped rationale must be >=20 chars');
    return { ok: errors.length === 0, errors };
  }
  if (!GO_RE.test(section)) {
    return { ok: false, errors: ['malformed FIDELITY line — expected `FIDELITY: GO` or `FIDELITY: skipped — <rationale>` (case-sensitive; the skipped separator must be a dash)'] };
  }
  if (!BASIS_RE.test(section)) errors.push('GO requires `Basis: <kickoff/spec path>`');
  if (!ROUND_RE.test(section)) errors.push('GO requires `Round: <n>`');
  const sha = section.match(SHA_RE);
  if (!sha) {
    errors.push('GO requires `Audited-SHA: <12-40 hex>`');
  } else if (!headSha.toLowerCase().startsWith(sha[1].toLowerCase())) {
    errors.push(`Audited-SHA ${sha[1]} does not match PR head ${headSha || '(empty)'} — re-run the fidelity audit on the current head`);
  }
  if (!hasEvidence(section)) errors.push('GO requires >=1 file:line evidence reference on a line other than `Basis:`');
  return { ok: errors.length === 0, errors };
}
