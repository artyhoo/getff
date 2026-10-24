<!-- scope:dot-gate-s0-platform-evidence -->
# Dot gate S0 — refreshed platform evidence (read-only)

> **Date:** 2026-10-05 (implementation session, worktree `wonderful-bhabha-d40603`, base 9d43937189d).
> **Scope:** S0 read-only evidence per [kickoff §S0](../../superpowers/plans/2026-10-05-dot-staging-review-gate-kickoff.md) — refresh live GitHub state, retest inventory routes, verify official-docs claims. No live objects created, no settings mutated.
> **Authoritative for:** the observed platform state recorded below, with command/output receipts.
> **NOT authoritative for:** design decisions — [spec](../../superpowers/specs/2026-10-05-dot-staging-review-gate-design.md). Dot/OpenAI account facts — those stay UNVERIFIED until operator-supervised live proof ([handoff](../dot-review-handoff.md)).
> **T3 discipline:** every item below is (a) command + output or (b) fetched-docs quote or (c) explicit UNVERIFIED/BLOCKED with the blocking error. No prose-only findings.

## 1. Repository identity and merge settings — VERIFIED

`gh api repos/artyhoo/getff --jq '{id, owner_type: .owner.type, private, default_branch, allow_auto_merge, allow_squash_merge, squash_merge_commit_title, squash_merge_commit_message}'` →

```json
{"allow_auto_merge":true,"allow_squash_merge":true,"default_branch":"staging","id":1231007068,"owner_type":"User","private":false,"squash_merge_commit_message":"PR_BODY","squash_merge_commit_title":"PR_TITLE"}
```

Matches spec §2 (repository ID `1231007068`, owner type `User`, squash PR_TITLE/PR_BODY). Implication unchanged: merge queue unavailable under personal ownership; alias risk (SHA-scoped checks) unresolved pending live matrix.

## 2. Staging protection — VERIFIED (matches design-time observation)

`gh api repos/artyhoo/getff/branches/staging/protection` →

- `required_status_checks`: `strict:false`; contexts `["ci-success","fidelity-verdict-in-pr-body","stale-revert-in-pr-diff"]`; `checks` entries carry `app_id: 15368` each.
- `enforce_admins.enabled: false`; `allow_force_pushes.enabled: false`; `allow_deletions.enabled: false`; `required_linear_history.enabled: false`; `block_creations.enabled: false`.

Implications: (i) the three-versus-six declaration discrepancy stands (see §6); (ii) admin bypass currently possible; (iii) `strict:false` confirms the throughput assumption the design replaces at S5.

## 3. Rulesets and staging head — VERIFIED

- `gh api repos/artyhoo/getff/rulesets` → `[]` (also `?per_page=100` → length 0). No active rulesets.
- `gh api repos/artyhoo/getff/git/ref/heads/staging --jq '.object.sha'` → `ecdb9189a9ad198ca634f6e955b7ee165b9a98de` (advanced from the design-time `e5a795754ed` — live state moved during design, as the kickoff warned; all baselines must be re-pinned at execution time, never reused).
- `gh api repos/artyhoo/getff --jq '.merge_queue // "ABSENT"'` → `ABSENT` (no merge_queue field on a personal-owner repo).

## 4. Check-run publisher inventory — VERIFIED (observed publishers only)

`gh api repos/artyhoo/getff/commits/ecdb9189a9ad198ca634f6e955b7ee165b9a98de/check-runs?per_page=100 --paginate --jq '[.check_runs[] | .app.id] | unique'` →

```json
[15368, 156372]
```

- `15368` = GitHub Actions (all workflow checks).
- `156372` = `socket-security` ("Socket Security: Project Report").

This is the publisher set on the current head — NOT a complete installation inventory (that needs an authorized route, §5).

## 5. App installation inventory — UNVERIFIED (retested, same walls)

- `gh api repos/artyhoo/getff/installation` → HTTP 401 `A JSON web token could not be decoded` (PAT is not an App JWT — expected shape).
- `gh api user/installations` → HTTP 403 `You must authenticate with an access token authorized to a GitHub App in order to list installations`.

Both match the design session's observation exactly. A permission error is UNVERIFIED, not absence (per the working-method contract). The authorized read route for the full inventory remains: operator opens Settings → Integrations → GitHub Apps (UI), or an App-authorized token — recorded as a setup action in the [handoff](../dot-review-handoff.md), not solved here.

## 6. Mechanical required-context discrepancy — VERIFIED as standing

Live required set (§2): 3 contexts. Declared-required set (workflow-integrity.yml `required_contexts=`, run-local-ci-sweep.sh `# REQUIRED_CONTEXTS`, principle 37 — all three agree in-repo): 6 contexts, the extra three being `Template render probes — P1/P4/P6 (deterministic)`, `capability PR carries Prior-art line in PR body (squash-survival)`, `§1.7 forward+backward sections present in PR description` (each marked `# required-context: yes` at its own job; registrable — no `paths:` filter).

Reconciliation owner: operator (S5 settings change). In-repo declarations are consistent with each other; live registration is behind. The Dot gate's trusted manifest must enumerate the 6 (not the 3) as mandatory mechanical contexts at promotion time, or explicitly reconcile to a different operator-approved set — a missing required check cannot be allowed to sit between declaration and enforcement.

## 7. Official-docs verification — VERIFIED for GitHub primitives

| Claim (spec §) | Source | Result |
| --- | --- | --- |
| Merge-commit checks take priority over head checks; head fallback only when merge ref has no status (§6 freshness) | [Troubleshooting required status checks](https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/troubleshooting-required-status-checks), fetched 2026-10-05 | Confirmed by quote: "The test merge commit" must pass / "Showing checks for the merge commit"; otherwise "The head commit" must pass. |
| Only GitHub Apps can create check runs; PATs/OAuth users cannot (§4 publisher) | [REST checks/runs](https://docs.github.com/en/rest/checks/runs), fetched 2026-10-05 | Confirmed by quote: write access "is only available to GitHub Apps. OAuth apps and authenticated users can view check runs and check suites, but they are not able to create them." App identity inferred from the authenticated App (cannot be asserted by the caller). |
| Required checks carry expected `app_id` per context | Live protection payload §2: `checks:[{context, app_id:15368}, …]` | Observed on this repo — expected-source binding is a real, addressable setting. |
| Merge queue eligibility: organization-owned repos | [Merge queue how-to](https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/merging-a-pull-request-with-a-merge-queue), fetched 2026-10-05 | Page states mechanics only, no eligibility matrix; `about-merge-queue` concept page returned HTTP 404 on this date. Eligibility therefore rests on the design-time citation + the observed personal-owner topology (`.owner.type=User`, no `merge_queue` field, §1/§3). Re-verify the docs URL at enforcement time. |

## 8. OpenAI/Dot primary sources — BLOCKED from this environment

- `https://openai.com/index/introducing-dots/` → HTTP 403 (bot-blocked) on 2026-10-05 fetch attempt.
- `https://help.openai.com/en/articles/20001530-getting-started-with-your-dot` → HTTP 403 on fetch attempt; web search surfaced no independent primary source confirming a distinct "Dot" scheduling/cloud-browser product page.

The spec's Dot capability citations (§3) stand as design-time research; this session could not independently re-verify them from here (bot-blocked, and out-of-account). Consequence recorded in the [handoff](../dot-review-handoff.md): P2/P5 (actual Dot account eligibility; unattended authenticated browser submission on the actual Dot) remain UNVERIFIED and gate S0 exit exactly as the kickoff requires — no weakened premise substituted.

## 9. Required live S0 proofs — BLOCKED pending authorization (unchanged)

The following kickoff-required proofs involve creating objects or using accounts, and are NOT executed by this session: disposable branch/ruleset/PR expected-App + strict native matrix (P6), Dot cloud-browser claim/submit under enrolled identity (P5), credential-isolation enumeration on the actual account (P3), narrow observer/armer identity provisioning (P8), reporter cannot merge / publisher no contents-write live probes (P3). Exact commands and acceptance per row live in the [handoff runbook](../dot-review-handoff.md) so the operator-supervised session can execute them directly.

## 10. Rate-limit housekeeping

`gh api rate_limit` after the probe batch: core remaining 4906, graphql remaining 4986 — paginated reads are cheap; the enforcement-time observer must still paginate and cache rather than poll.

## §1.7 self-review

- **Forward-check:** [build-first-reuse-default.md](../../../.claude/rules/build-first-reuse-default.md) — this patch proposes no capability; it records read-only observations with command receipts, so no BUILD verdict or new dependency is introduced by the patch itself (the dot-gate implementation's own BUILD/ADOPT verdicts live in [prior-art-evaluations.md](../prior-art-evaluations.md) rows #194/#314). [no-paid-llm-in-ci.md](../../../.claude/rules/no-paid-llm-in-ci.md) — every receipt above is a deterministic `gh api` call or a fetched docs page; zero LLM invocations. [doc-authority-hierarchy.md](../../../.claude/rules/doc-authority-hierarchy.md) — research-patch folder-level authority; the live-settings authority stays with GitHub's API state read at enforcement time, and this patch explicitly marks UNVERIFIED items rather than inferring absence from permission errors.
- **Backward-check** — class of this change = «read-only platform evidence for an enforcement design». Surfaces where the class occurs: (1) [dot-review-handoff.md](../dot-review-handoff.md) §2 scoreboard — consumes these receipts (updated in the same write set, statuses match §1-§8 above); (2) the [design spec §2](../../superpowers/specs/2026-10-05-dot-staging-review-gate-design.md) observation table — historical design-time numbers (e5a795754ed staging head) now superseded by §3 (`ecdb9189a9a`); the spec is a frozen design record, so the refresh lives HERE, not in a spec edit; (3) [workflow-integrity.yml](../../../.github/workflows/workflow-integrity.yml) REQUIRED_CONTEXTS — six declared vs three live (§6) — a known standing gap the S5 rollout owns, unchanged by this patch; (4) App inventory routes (`/installation`, `/installations`) — retested with identical 401/403 walls (§5), so no observation in the handoff's provisioning runbook changed shape. GAP-FOUND: none — every number this patch supersedes is either re-recorded here or explicitly marked historical.
