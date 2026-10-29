#!/usr/bin/env bash
# Paired-negative for scripts/dot-review-gate/reporter.mjs.
#
# Reporter rules under test (protocol §7): exactly ONE identified summary comment per
# open PR, updated by stored comment id; inline findings deduplicated by stable finding
# id markers; a comment is not claimed published until its remote id AND content are
# read back; open-PR defects never become issues; issues require current-staging proof
# and dedupe by fingerprint.
set -uo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
TMP="$(mktemp -d "${TMPDIR:-/tmp}/dot-reporter-test.XXXXXX")"
trap 'rm -rf "$TMP"' EXIT

SCRIPT="$TMP/run-reporter-arms.mjs"
cat > "$SCRIPT" <<'NODE'
const [reporterPath, fixPath] = process.argv.slice(2);
const { makeAdmission } = await import(fixPath);
const { upsertSummaryComment, postInlineFindings, fileVerifiedIssue } = await import(reporterPath);

const log = (...a) => console.log(...a);
const fail = (m) => { console.log('FAIL ' + m); process.exitCode = 1; };
const MARKER = '<!-- dot-review-reporter:v1 -->';

function makeTransport({ existingComments = [], existingIssues = [] } = {}) {
  const t = {
    comments: [...existingComments],
    issues: existingIssues.map((x, i) => ({ number: 900 + i, ...x })),
    issueComments: [],
    createdIssues: [],
  };
  t.fetchJson = async (url, opts = {}) => {
    if (url === '/repos/x/issues/2042/comments' && opts.method === 'POST') {
      const body = JSON.parse(opts.body);
      const c = { id: 1000 + t.comments.length, body: body.body, in_reply_to_id: 2042 };
      t.comments.push(c);
      return c;
    }
    if (url === '/repos/x/pulls/2042/comments' && opts.method === 'POST') {
      const body = JSON.parse(opts.body);
      const c = { id: 3000 + t.comments.length, body: body.body };
      t.comments.push(c);
      return c;
    }
    if (url.startsWith('/repos/x/issues/comments/') && opts.method === 'PATCH') {
      const id = Number(url.split('/').pop());
      const c = t.comments.find((x) => x.id === id);
      if (!c) throw Object.assign(new Error('no comment'), { status: 404 });
      c.body = JSON.parse(opts.body).body;
      return c;
    }
    if (url.startsWith('/repos/x/issues/comments/')) {
      const id = Number(url.split('/').pop());
      const c = t.comments.find((x) => x.id === id);
      if (!c) throw Object.assign(new Error('no comment'), { status: 404 });
      return c;
    }
    if (url === '/repos/x/issues/2042/comments') return t.comments;
    if (url.startsWith('/repos/x/issues/') && url.endsWith('/comments') && opts.method === 'POST') {
      const num = Number(url.split('/')[4]);
      if (num >= 900) {
        const body = JSON.parse(opts.body);
        const c = { id: 2000 + t.issueComments.length, body: body.body };
        t.issueComments.push(c);
        return c;
      }
    }
    if (url === '/repos/x/issues' && opts.method === 'POST') {
      const body = JSON.parse(opts.body);
      const issue = { number: 950 + t.createdIssues.length, ...body };
      t.createdIssues.push(issue);
      t.issues.push(issue);
      return issue;
    }
    if (url.startsWith('/search/issues')) {
      const q = decodeURIComponent(url.split('q=')[1] ?? '');
      const fingerprint = (q.match(/"([^"]+)"/) ?? [])[1] ?? '';
      const hits = t.issues.filter((i) => (i.body ?? '').includes(fingerprint));
      return { total_count: hits.length, items: hits };
    }
    if (url === '/repos/x/pulls/2042') return { state: 'open', draft: false };
    throw new Error(`unexpected transport call ${url} ${opts.method ?? 'GET'}`);
  };
  return t;
}

const app = { repo: 'x', prNumber: 2042 };

try {
  // GREEN: summary created once, marker present
  const t1 = makeTransport();
  const s1 = await upsertSummaryComment({ ...app, transport: t1.fetchJson, reportText: JSON.stringify(makeAdmission()) });
  if (!s1.comment_id || !t1.comments[0].body.includes(MARKER)) fail('summary comment missing marker/id');
  else log('ok summary-created');

  // GREEN: second upsert PATCHes the same comment (readback verified) — no duplicate
  const s2 = await upsertSummaryComment({ ...app, transport: t1.fetchJson, reportText: JSON.stringify(makeAdmission({ verdict: 'REVISE' })), previousCommentId: s1.comment_id });
  if (s2.comment_id !== s1.comment_id || t1.comments.length !== 1) fail(`upsert duplicated: ${t1.comments.length} comments`);
  else if (!t1.comments[0].body.includes('REVISE')) fail('upsert did not update content');
  else log('ok summary-upsert-idempotent');

  // GREEN: inline findings posted once; replay skipped by stable-id marker
  const findings = [
    { id: 'F-1', blocking: false, severity: 'minor', category: 'style', title: 'naming', description: 'x', location: { commit_sha: 'c'.repeat(40), path: 'a.ts', line: 3, side: 'RIGHT' }, evidence: [], fix_expectation: 'rename' },
  ];
  const f1 = await postInlineFindings({ ...app, transport: t1.fetchJson, findings, existingComments: t1.comments });
  if (f1.posted.length !== 1) fail(`inline posted ${f1.posted.length}`);
  const f2 = await postInlineFindings({ ...app, transport: t1.fetchJson, findings, existingComments: t1.comments });
  if (f2.posted.length !== 0 || f2.skipped.length !== 1) fail(`inline replay: posted=${f2.posted.length} skipped=${f2.skipped.length}`);
  else log('ok inline-dedup-by-stable-id');

  // RED: inline finding without a location → skipped, never fabricated
  const f3 = await postInlineFindings({
    ...app, transport: t1.fetchJson,
    findings: [{ id: 'F-2', blocking: false, severity: 'note', category: 'x', title: 't', description: 'd', location: null, evidence: [], fix_expectation: '' }],
    existingComments: t1.comments,
  });
  if (f3.posted.length !== 0 || f3.skipped.length !== 1) fail('locationless finding posted');
  else log('ok locationless-skipped');

  // RED: issue creation for an OPEN PR defect → refused
  const t2 = makeTransport();
  try {
    await fileVerifiedIssue({
      repo: 'x', transport: t2.fetchJson, fingerprint: 'fp-1',
      title: 'defect', bodyText: 'still present', currentStagingProof: { sha: 'b'.repeat(40), present: true },
      openPrNumber: 2042,
    });
    fail('open-PR issue creation not refused');
  } catch (e) {
    if (e.code !== 'E_NO_ISSUE_FOR_OPEN_PR') fail(`wrong refusal code ${e.code}`);
    else if (t2.createdIssues.length !== 0) fail('issue created despite refusal');
    else log('ok open-pr-issue-refused');
  }

  // GREEN: verified staging defect with no existing issue → created; fingerprint embedded
  const t3 = makeTransport();
  const i1 = await fileVerifiedIssue({
    repo: 'x', transport: t3.fetchJson, fingerprint: 'fingerprint-abc',
    title: 'staging defect', bodyText: 'reproduced on current staging', currentStagingProof: { sha: 'b'.repeat(40), present: true },
  });
  if (!t3.createdIssues[0].body.includes('fingerprint-abc')) fail('fingerprint missing from issue');
  else log('ok issue-created-with-fingerprint');

  // GREEN: same fingerprint again → comment on existing, no duplicate issue
  const before = t3.createdIssues.length;
  const i2 = await fileVerifiedIssue({
    repo: 'x', transport: t3.fetchJson, fingerprint: 'fingerprint-abc',
    title: 'staging defect', bodyText: 'reproduced again', currentStagingProof: { sha: 'b'.repeat(40), present: true },
  });
  if (t3.createdIssues.length !== before) fail('duplicate issue created');
  else if (!i2.commented_on) fail('dedup did not comment on existing issue');
  else log('ok issue-dedup-by-fingerprint');

  // RED: unverified defect (no current-staging proof) → refused
  try {
    await fileVerifiedIssue({
      repo: 'x', transport: t3.fetchJson, fingerprint: 'fp-2',
      title: 'x', bodyText: 'y', currentStagingProof: null,
    });
    fail('unverified issue accepted');
  } catch (e) {
    if (e.code !== 'E_UNVERIFIED') fail(`wrong unverified code ${e.code}`);
    else log('ok unverified-issue-refused');
  }
} catch (e) {
  fail(`unexpected: ${e.stack?.split('\n').slice(0, 2).join(' | ')}`);
}
NODE

# shellcheck disable=SC1091
source "$DIR/suite-harness.sh"
out="$(node "$SCRIPT" "$DIR/reporter.mjs" \
  "$(cd "$DIR/../.." && pwd)/tests/dot-review-gate/fixtures/make-admission.mjs" 2>&1)"; status=$?
assert_suite_arms "reporter.test.sh" "$status" "$out" \
  summary-created summary-upsert-idempotent inline-dedup-by-stable-id \
  locationless-skipped open-pr-issue-refused issue-created-with-fingerprint \
  issue-dedup-by-fingerprint unverified-issue-refused || exit 1
echo "reporter.test.sh: all green"
