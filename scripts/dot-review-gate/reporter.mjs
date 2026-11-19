// Reporter — feedback surface on open PRs and deduplicated issues for verified staging
// defects. Protocol §7: exactly one identified summary comment per open PR (upserted by
// stored comment id, read back before claiming success); inline findings deduplicated by
// stable finding-id markers; open-PR defects NEVER become issues; issues require a
// current-staging verification and dedupe by cause fingerprint.

const SUMMARY_MARKER = '<!-- dot-review-reporter:v1 -->';
const FINDING_MARKER_PREFIX = '<!-- dot-review:finding:';
const ISSUE_FINGERPRINT_PREFIX = 'dot-review:fingerprint:';

export async function upsertSummaryComment({ repo, prNumber, transport, reportText, previousCommentId }) {
  const report = JSON.parse(reportText);
  const body = renderSummary(report);
  let commentId = previousCommentId;
  if (commentId) {
    // verify the stored comment is still ours before updating it
    const existing = await transport(`${api(repo)}/issues/comments/${commentId}`, {
      headers: { accept: 'application/vnd.github+json' },
    }).catch((e) => {
      if (e.status === 404) return null; // deleted — fall back to creating a new one
      throw e;
    });
    if (existing && !existing.body?.includes(SUMMARY_MARKER)) {
      const e = new Error(`stored comment ${commentId} is not a dot-review summary`);
      e.code = 'E_COMMENT_IDENTITY';
      throw e;
    }
    if (!existing) commentId = undefined;
  }
  let written;
  if (commentId) {
    written = await transport(`${api(repo)}/issues/comments/${commentId}`, {
      method: 'PATCH',
      headers: { accept: 'application/vnd.github+json', 'content-type': 'application/json' },
      body: JSON.stringify({ body }),
    });
  } else {
    written = await transport(`${api(repo)}/issues/${prNumber}/comments`, {
      method: 'POST',
      headers: { accept: 'application/vnd.github+json', 'content-type': 'application/json' },
      body: JSON.stringify({ body }),
    });
  }
  // readback: never claim published until the remote id AND content are verified
  const readback = await transport(`${api(repo)}/issues/comments/${written.id}`, {
    headers: { accept: 'application/vnd.github+json' },
  });
  if (!readback?.body?.includes(SUMMARY_MARKER)) {
    const e = new Error(`comment ${written.id} readback missing summary marker`);
    e.code = 'E_READBACK';
    throw e;
  }
  return { comment_id: readback.id, updated: Boolean(commentId), verified: true };
}

export async function postInlineFindings({ repo, prNumber, transport, findings, existingComments = [] }) {
  const posted = [];
  const skipped = [];
  const seenMarkers = new Set(
    (existingComments ?? [])
      .map((c) => c.body ?? '')
      .flatMap((body) => [...body.matchAll(/dot-review:finding:([^\s>]+)>/g)].map((m) => m[1])),
  );
  for (const finding of findings ?? []) {
    const markerId = String(finding.id);
    if (seenMarkers.has(markerId)) {
      skipped.push({ id: finding.id, reason: 'already-posted' });
      continue;
    }
    if (!finding.location || typeof finding.location.path !== 'string' || !Number.isInteger(finding.location.line)) {
      // do not fabricate inline positions — protocol §5
      skipped.push({ id: finding.id, reason: 'no-valid-location' });
      continue;
    }
    const body = [
      `${FINDING_MARKER_PREFIX}${markerId}>`,
      `**[${finding.severity}${finding.blocking ? '/blocking' : ''}] ${finding.title}**`,
      finding.description,
      '',
      `_fix expectation:_ ${finding.fix_expectation}`,
    ].join('\n');
    const written = await transport(`${api(repo)}/pulls/${prNumber}/comments`, {
      method: 'POST',
      headers: { accept: 'application/vnd.github+json', 'content-type': 'application/json' },
      body: JSON.stringify({
        body,
        commit_id: finding.location.commit_sha,
        path: finding.location.path,
        line: finding.location.line,
        side: finding.location.side,
      }),
    });
    posted.push({ id: finding.id, comment_id: written.id });
    seenMarkers.add(markerId);
  }
  return { posted, skipped };
}

// Issues are for verified staging defects only. An open PR number in the context is a
// hard refusal — open-PR defects stay on the PR (protocol §7).
export async function fileVerifiedIssue({ repo, transport, fingerprint, title, bodyText, currentStagingProof, openPrNumber }) {
  if (Number.isInteger(openPrNumber)) {
    const e = new Error(`defect belongs to open PR #${openPrNumber} — issues are not for open-PR findings`);
    e.code = 'E_NO_ISSUE_FOR_OPEN_PR';
    throw e;
  }
  if (!currentStagingProof?.sha || currentStagingProof.present !== true) {
    const e = new Error('issue requires verified current-staging reproduction');
    e.code = 'E_UNVERIFIED';
    throw e;
  }
  const marker = `${ISSUE_FINGERPRINT_PREFIX}${fingerprint}`;
  // paginated search handled by the transport; request the canonical query
  const search = await transport(
    `/search/issues?q=${encodeURIComponent(`repo:${repo} "${marker}" in:body`)}`,
    { headers: { accept: 'application/vnd.github+json' } },
  );
  if ((search.total_count ?? 0) > 0 && search.items?.length) {
    const match = search.items[0];
    const comment = await transport(`${api(repo)}/issues/${match.number}/comments`, {
      method: 'POST',
      headers: { accept: 'application/vnd.github+json', 'content-type': 'application/json' },
      body: JSON.stringify({ body: `Re-verified on staging ${currentStagingProof.sha}.\n\n${bodyText}` }),
    });
    return { commented_on: match.number, comment_id: comment.id, created: false };
  }
  const issue = await transport(`${api(repo)}/issues`, {
    method: 'POST',
    headers: { accept: 'application/vnd.github+json', 'content-type': 'application/json' },
    body: JSON.stringify({
      title,
      body: `${marker}\n\nVerified on staging ${currentStagingProof.sha}.\n\n${bodyText}`,
      labels: ['dot-review'],
    }),
  });
  return { issue_number: issue.number, created: true };
}

function renderSummary(report) {
  const blockers = (report.findings ?? []).filter((f) => f.blocking);
  const lines = [
    SUMMARY_MARKER,
    `## Dot staging review — ${report.kind} · ${report.completion} · ${report.verdict}`,
    '',
    `- **tuple:** base \`${(report.revision?.base_sha ?? '').slice(0, 7)}\` → head \`${(report.revision?.head_sha ?? '').slice(0, 7)}\`, tested merge \`${(report.revision?.tested_merge_sha ?? 'n/a').slice(0, 7)}\``,
    `- **generation:** ${report.generation} · review \`${report.review_id}\` · protocol \`${report.protocol_version}\``,
    `- **coverage:** ${report.coverage?.reviewed_count ?? 0}/${report.coverage?.changed_count ?? 0} files, ${report.coverage?.dimensions?.length ?? 0} dimensions${report.coverage?.truncated ? ' · **TRUNCATED**' : ''}`,
    `- **blockers:** ${blockers.length === 0 ? 'none' : blockers.map((b) => b.id).join(', ')}`,
    '',
    `**Summary:** ${report.report?.summary ?? ''}`,
  ];
  if ((report.report?.limitations ?? []).length > 0) {
    lines.push('', '**Limitations:**', ...report.report.limitations.map((l) => `- ${l}`));
  }
  if ((report.coverage?.omissions ?? []).length > 0) {
    lines.push('', '**Omissions:**', ...report.coverage.omissions.map((o) => `- ${o}`));
  }
  return lines.join('\n');
}

function api(repo) {
  return `/repos/${repo}`;
}
