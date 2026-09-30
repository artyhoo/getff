/**
 * CI entrypoint for the `## Removal consumers` PR-body gate — a step of the
 * `stale-revert-in-pr-diff` job (.github/workflows/pr-stale-revert.yml).
 * Env: PR_BODY, BASE_SHA, HEAD_SHA. Logic: checks/pr-body-removal-consumers.ts.
 *
 * Fails CLOSED on an unresolvable merge-base: an empty diff is indistinguishable
 * from «no shipped file deleted», and a false pass is the dangerous direction.
 */
import { parseNameStatus } from '../utils/git.ts';
import { stripHtmlComments } from '../utils/markdown-comments.ts';
import { runCheck } from '../utils/run-check.ts';
import { checkRemovalConsumers } from './pr-body-removal-consumers.ts';

const base = process.env['BASE_SHA'] ?? '';
const head = process.env['HEAD_SHA'] ?? '';
const body = process.env['PR_BODY'] ?? '';
if (!base || !head) {
  console.error('::error::BASE_SHA / HEAD_SHA env vars are required');
  process.exit(1);
}
const mb = runCheck('git', ['merge-base', base, head]);
if (mb.exitCode !== 0 || !mb.stdout.trim()) {
  console.error(
    `::error::no merge-base for ${base}..${head} — the checkout needs \`fetch-depth: 0\``,
  );
  process.exit(1);
}
// --no-renames: a rename is a removal of the old name, and consumers find files by name.
// core.quotePath=false: a quoted non-ASCII path ("packages/…) would miss the root prefix
// and pass open.
const diff = runCheck('git', [
  '-c',
  'core.quotePath=false',
  'diff',
  '--name-status',
  '--no-renames',
  mb.stdout.trim(),
  head,
]);
if (diff.exitCode !== 0) {
  console.error(`::error::git diff failed: ${diff.stderr}`);
  process.exit(1);
}
const res = checkRemovalConsumers(body, parseNameStatus(diff.stdout), stripHtmlComments);
if (res.ok) {
  console.log(`✅ Removal consumers: ${res.message}.`);
  process.exit(0);
}
console.error(`::error::${res.message}`);
console.error(
  'This PR deletes (or renames away) a shipped file under packages/core/templates/ or\n' +
    '.ai-factory/. Before a shipped file goes, map who reads or DETECTS it — grep the\n' +
    'file NAME across the repo and upstream skills, including presence checks such as\n' +
    '`[ -f … ]` (incident 2026-09-28: install.sh detected the stack from the presence of\n' +
    'ARCHITECTURE.react-*.md). Add to the PR body, one row per deleted path:\n' +
    '  ## Removal consumers\n' +
    '  | path | consumer (file:line) | drop vs slim consequence |\n' +
    '  | packages/core/templates/x.md | `install.sh:210` presence check | drop: … ; slim: … |\n' +
    'or, when the grep is empty:  - x.md: no consumers — <what you grepped, ≥20 chars>\n' +
    'This check re-runs on PR body edit. See .claude/rules/build-first-reuse-default.md §3.1.',
);
process.exit(1);
