/**
 * CI entrypoint — env in, exit code out (sibling of pr-body-prior-art-bin.ts).
 *
 * Fails CLOSED on its own misconfiguration: an unset/renamed env var must never
 * degrade the gate into a permanently-green no-op. Only an explicitly-different,
 * non-empty base ref is "out of scope".
 */
import { checkPrBodyFidelity } from './pr-body-fidelity.ts';

const baseRef = process.env.BASE_REF ?? '';
const prBody = process.env.PR_BODY ?? '';
const headSha = process.env.HEAD_SHA ?? '';

if (!baseRef) {
  console.error('::error::BASE_REF env var is required (workflow misconfiguration — the gate must not pass blind)');
  process.exit(1);
}
if (baseRef !== 'staging') {
  // Defense-in-depth: the workflow-level `if:` already scopes to staging (spec D3/m3).
  console.log(`pr-body-fidelity: base '${baseRef}' out of scope (staging only) — pass`);
  process.exit(0);
}
if (!headSha) {
  console.error('::error::HEAD_SHA env var is required (workflow misconfiguration — the staleness guard cannot run without it)');
  process.exit(1);
}

const result = checkPrBodyFidelity({ body: prBody, headSha });
if (result.ok) {
  console.log('pr-body-fidelity: OK');
  process.exit(0);
}
console.error('::error::pr-body-fidelity: PR body fails the acceptance-contour fidelity gate (spec D3)');
for (const e of result.errors) console.error(`::error::  - ${e}`);
process.exit(1);
