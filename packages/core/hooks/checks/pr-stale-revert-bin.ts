/**
 * CI entrypoint for the stale-base rebuild gate
 * (.github/workflows/pr-stale-revert.yml). Env: PR_BODY, BASE_REF, BASE_SHA, HEAD_SHA.
 * Sibling of pr-body-fidelity-bin.ts / pr-body-prior-art-bin.ts.
 *
 * Fails CLOSED on its own misconfiguration — a false PASS is the dangerous direction
 * here, because the gate's whole subject is content that vanished silently:
 *   - an unset/renamed env var must never degrade the gate into a permanently-green
 *     no-op (BASE_REF arm copied from pr-body-fidelity-bin.ts:9-14);
 *   - an unresolvable BASE_SHA/HEAD_SHA, or an unresolvable merge-base, means the
 *     checkout is shallow or landed on the synthetic `refs/pull/N/merge` commit. Both
 *     produce an EMPTY file set, which is indistinguishable from "clean" — so they
 *     are reported as errors instead. See the workflow's checkout comment.
 */
import {
  checkStaleRevert,
  collectArchaeology,
  formatFindings,
  parseStaleRevertToken,
  realStaleRevertGit,
} from './pr-stale-revert.ts';

const baseRef = process.env['BASE_REF'] ?? '';
const baseSha = process.env['BASE_SHA'] ?? '';
const headSha = process.env['HEAD_SHA'] ?? '';
const prBody = process.env['PR_BODY'] ?? '';

if (!baseRef) {
  console.error(
    '::error::BASE_REF env var is required (workflow misconfiguration — the gate must not pass blind)',
  );
  process.exit(1);
}
if (baseRef !== 'staging') {
  // Defense-in-depth: the workflow-level `if:` already scopes to staging.
  console.log(`pr-stale-revert: base '${baseRef}' out of scope (staging only) — pass`);
  process.exit(0);
}
if (!baseSha || !headSha) {
  console.error(
    '::error::BASE_SHA and HEAD_SHA env vars are required (the blob archaeology cannot run without them)',
  );
  process.exit(1);
}
for (const [name, rev] of [
  ['BASE_SHA', baseSha],
  ['HEAD_SHA', headSha],
] as const) {
  if (!realStaleRevertGit.revExists(rev)) {
    console.error(
      `::error::${name} (${rev}) does not resolve to a commit in this checkout — ` +
        'the workflow needs `fetch-depth: 0` AND `ref: ${{ github.event.pull_request.head.sha }}`',
    );
    process.exit(1);
  }
}

const { mergeBase, files } = collectArchaeology(realStaleRevertGit, baseSha, headSha);
if (mergeBase === null) {
  console.error(
    `::error::git merge-base ${baseSha} ${headSha} could not be resolved — the checkout is ` +
      'shallow. An empty file set would read as "clean", so this fails instead of passing blind.',
  );
  process.exit(1);
}

const findings = checkStaleRevert(files);
if (findings.length === 0) {
  console.log(
    `pr-stale-revert: OK — ${files.length} modified file(s) inspected, none reverts to an outdated base version.`,
  );
  process.exit(0);
}

const token = parseStaleRevertToken(prBody);
if (token.valid) {
  console.log(
    `pr-stale-revert: ${findings.length} stale-revert finding(s) ACKNOWLEDGED via STALE-REVERT token — ${token.rationale}`,
  );
  for (const f of findings) console.log(`  acknowledged: ${f.path} (reverts to ${f.matchedCommit})`);
  process.exit(0);
}

console.error(
  `::error::pr-stale-revert: ${findings.length} file(s) revert to an outdated base-branch version`,
);
for (const line of formatFindings(findings)) console.error(line);
if (token.present) console.error(`::error::  - ${token.reason}`);
process.exit(1);
