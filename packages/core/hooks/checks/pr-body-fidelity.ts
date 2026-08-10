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
 *     vacuously), and from inside the section: ANY heading closes it, so evidence
 *     cannot be borrowed from a neighbouring `### §1.7 …` block;
 *   - `skipped` is NOT available to a stage PR. A PR whose `## Provenance` section
 *     declares a substrate must carry a real verdict. The detector is self-declared
 *     (weaker than the sibling prior-art gate, whose detector reads the diff — see
 *     pr-body-prior-art-bin.ts) because "is this a stage PR" is a property of the
 *     process, not of the diff. It still removes the silent default: every Provenance
 *     section is inspected, so a decoy placeholder cannot absorb the check, and bypassing
 *     requires either denying the substrate or altering the shipped `## Provenance`
 *     heading (`## Provenance (in-session)` / `### Provenance` evade the exact-match
 *     regex) — both are visible deviations from the template. Note the asymmetry:
 *     renaming the verdict heading fails CLOSED (missing-section error), renaming
 *     Provenance fails OPEN. That is inherent to a self-declared, heading-matched
 *     detector; the guard raises the cost of bypass, it does not make it impossible.
 */
export interface FidelityCheckInput { body: string; headSha: string; }
export interface FidelityCheckResult { ok: boolean; errors: string[]; }

const HEADING_RE = /^##[ \t]+Fidelity verdict[ \t]*$/;
/**
 * ANY heading terminates the section. The verdict grammar produces no sub-headings,
 * so a `### …` inside the region can only belong to a neighbouring block (`### §1.7
 * Forward-check applied` is the common case) — and letting the region run into it
 * would satisfy the file:line evidence requirement with someone else's citation.
 */
const SECTION_END_RE = /^#{1,6}[ \t]/;
/** A stage PR declares its substrate here; `skipped` is not available to it. */
const PROVENANCE_HEADING_RE = /^##[ \t]+Provenance[ \t]*$/;
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

/** True for a line that closes a section — a heading NOT inside a fenced code block. */
function sectionEndAt(lines: string[], from: number): number {
  let fenced = false;
  for (let i = from; i < lines.length; i++) {
    if (/^[ \t]*(```|~~~)/.test(lines[i])) { fenced = !fenced; continue; }
    if (!fenced && SECTION_END_RE.test(lines[i])) return i;
  }
  return lines.length;
}

/** Bodies of EVERY section with this heading — not just the first (a decoy would hide the rest). */
function sectionBodies(lines: string[], headingRe: RegExp): string[] {
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (!headingRe.test(lines[i])) continue;
    out.push(lines.slice(i + 1, sectionEndAt(lines, i + 1)).join('\n'));
  }
  return out;
}

/**
 * A stage PR = one whose `## Provenance` section actually declares something.
 * The shipped template ships that section with a placeholder + `n/a` guidance, so an
 * unfilled or explicitly-n/a Provenance does NOT make a PR a stage PR.
 */
function declaresProvenance(lines: string[]): boolean {
  // EVERY Provenance section is inspected: a decoy placeholder heading placed above the
  // real one would otherwise absorb the check while the true substrate stays visible —
  // a bypass that deletes nothing and so is invisible to the threat model this guard
  // documents (verified as a real false pass before this was fixed).
  return sectionBodies(lines, PROVENANCE_HEADING_RE).some((body) =>
    body
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0)
      .filter((l) => !/^</.test(l))          // template placeholder `<stage PRs: …>`
      .filter((l) => !/^n\/a\b/i.test(l))    // explicit "not applicable"
      .length > 0,
  );
}

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
  return { section: lines.slice(start + 1, sectionEndAt(lines, start + 1)).join('\n') };
}

/**
 * Evidence must not be satisfied by the `Basis:` path alone. The exclusion is
 * case-INSENSITIVE on purpose: the verdict tokens are case-sensitive grammar, but this
 * is a guard, and `basis:` in lowercase must not smuggle the Basis path in as evidence.
 */
function hasEvidence(section: string): boolean {
  return section
    .split('\n')
    .filter((l) => !/^basis:/i.test(l.trim()))
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
    if (declaresProvenance(stripComments(body).split(/\r?\n/))) {
      return {
        ok: false,
        errors: ['`FIDELITY: skipped` is not available to a stage PR — this PR\'s `## Provenance` section declares a substrate, so it must carry a real verdict from agents/fidelity-auditor.md'],
      };
    }
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
    // Name the cheap remediation FIRST. The expensive one (a fresh cold seat) used to be the
    // only branch this message offered, so a head moved by a merge-forward commit — which
    // changes nothing the seat judges — read as "burn ~85-185k tokens on a re-audit".
    // Decision procedure: .claude/rules/git-conflict-merge-forward.md §9.
    errors.push(`Audited-SHA ${sha[1]} does not match PR head ${headSha || '(empty)'} — if the head moved only by a merge-forward/rebuild commit, push the audited commit as the head instead (.claude/rules/git-conflict-merge-forward.md §9); otherwise re-run the fidelity audit on the current head`);
  }
  if (!hasEvidence(section)) errors.push('GO requires >=1 file:line evidence reference on a line other than `Basis:`');
  return { ok: errors.length === 0, errors };
}
