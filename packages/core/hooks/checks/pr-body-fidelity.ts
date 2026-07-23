/**
 * PR-body arm of the acceptance-contour fidelity gate (spec:
 * docs/superpowers/specs/2026-07-23-acceptance-contour-design.md D3).
 * Deterministic form check — the semantic verdict is produced in-session by
 * agents/fidelity-auditor.md (no-paid-llm-in-ci). Sibling of prior-art.ts /
 * pr-body-prior-art-bin.ts.
 */
export interface FidelityCheckInput { body: string; headSha: string; }
export interface FidelityCheckResult { ok: boolean; errors: string[]; }

const SKIPPED_RE = /^FIDELITY:\s*skipped\s*[—-]+\s*(.+)$/m;
const GO_RE = /^FIDELITY:\s*GO\s*$/m;
const NON_GO_RE = /^FIDELITY:\s*(REVISE|STOP)\b/m;
const BASIS_RE = /^Basis:\s*\S+/m;
const ROUND_RE = /^Round:\s*\d+\s*$/m;
const SHA_RE = /^Audited-SHA:\s*([0-9a-fA-F]{12,40})\s*$/m;
const EVIDENCE_RE = /[\w./-]+\.[A-Za-z]{1,6}:\d+/;

function extractSection(body: string): string | null {
  const lines = body.split(/\r?\n/);
  const start = lines.findIndex((l) => /^##\s+Fidelity verdict\s*$/.test(l));
  if (start === -1) return null;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^##\s/.test(lines[i])) { end = i; break; }
  }
  return lines.slice(start + 1, end).join('\n');
}

export function checkPrBodyFidelity({ body, headSha }: FidelityCheckInput): FidelityCheckResult {
  const errors: string[] = [];
  const section = extractSection(body);
  if (section === null) {
    return { ok: false, errors: ['missing `## Fidelity verdict` section (see spec D3; agents/fidelity-auditor.md)'] };
  }
  const skipped = section.match(SKIPPED_RE);
  if (skipped) {
    if (skipped[1].trim().length < 20) errors.push('skipped rationale must be >=20 chars');
    return { ok: errors.length === 0, errors };
  }
  if (NON_GO_RE.test(section)) {
    return { ok: false, errors: ['non-GO FIDELITY verdict recorded — resolve the rework loop before merge'] };
  }
  if (!GO_RE.test(section)) {
    return { ok: false, errors: ['no `FIDELITY: GO` or `FIDELITY: skipped — <rationale>` line found'] };
  }
  if (!BASIS_RE.test(section)) errors.push('GO requires `Basis: <kickoff/spec path>`');
  if (!ROUND_RE.test(section)) errors.push('GO requires `Round: <n>`');
  const sha = section.match(SHA_RE);
  if (!sha) {
    errors.push('GO requires `Audited-SHA: <12-40 hex>`');
  } else if (!headSha.toLowerCase().startsWith(sha[1].toLowerCase())) {
    errors.push(`Audited-SHA ${sha[1]} does not match PR head ${headSha} — re-run the fidelity audit on the current head`);
  }
  if (!EVIDENCE_RE.test(section)) errors.push('GO requires >=1 file:line evidence reference');
  return { ok: errors.length === 0, errors };
}
