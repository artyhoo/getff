/**
 * CI entrypoint for the PR-body Prior-art gate
 * (.github/workflows/pr-body-prior-art.yml). Env: PR_BODY, BASE_SHA, HEAD_SHA.
 *
 * Exits 1 when the PR range is a capability change and the PR body carries no
 * valid `Prior-art:` line — the squash message is built from the PR body, so
 * trailers survive the squash only if they live there (2026-07-22 incident,
 * PR #1094 → #1097). Logic lives in checks/prior-art.ts (checkPrBodyPriorArt).
 */
import { rangeGit } from '../utils/git.ts';
import { stripHtmlComments } from '../utils/markdown-comments.ts';
import { checkPrBodyPriorArt, loadSsotIds } from './prior-art.ts';

const base = process.env['BASE_SHA'] ?? '';
const head = process.env['HEAD_SHA'] ?? '';
const body = process.env['PR_BODY'] ?? '';
if (!base || !head) {
  console.error('::error::BASE_SHA / HEAD_SHA env vars are required');
  process.exit(1);
}
const g = rangeGit(base, head);
const ssot = g.fileContent(head, 'docs/meta-factory/prior-art-evaluations.md');
const res = checkPrBodyPriorArt(
  body,
  g,
  stripHtmlComments,
  ssot === null ? undefined : loadSsotIds(ssot),
);
if (res.ok) {
  console.log(
    res.reason === null
      ? '✅ Not a capability PR — no Prior-art line required in the PR body.'
      : `✅ Capability PR (${res.reason}) — valid Prior-art line present in the PR body.`,
  );
  process.exit(0);
}
console.error(
  `::error::Capability PR (${res.reason}) but the PR body has no valid Prior-art line: ${res.message}`,
);
console.error(
  'A squash merge takes its commit message from the PR body — branch-commit\n' +
    '`Prior-art:` trailers are DROPPED at squash (incident PR #1094 → #1097:\n' +
    'principle 11 F1 went red on the next unrelated PR). Add to the PR body:\n' +
    '  Prior-art: prior-art-evaluations.md#N (verdict X — rationale)\n' +
    '(the escape hatch `Prior-art: skipped — …` is rejected on capability PRs,\n' +
    'same as the pre-push §7 arm — cite an SSOT entry instead).\n' +
    'This check re-runs on PR body edit. See CLAUDE.md §`Prior-art:` trailer syntax.',
);
process.exit(1);
