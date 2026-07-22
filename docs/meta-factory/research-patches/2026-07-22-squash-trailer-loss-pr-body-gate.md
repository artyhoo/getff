<!-- scope:squash-trailer-loss-pr-body-gate -->

# Squash-merge drops `Prior-art:` trailers — PR-body gate (2026-07-22)

> Scope: squash-trailer-loss incident (PR #1094 → #1097) + the shipped counter-gate.
> Inherits folder authority (research-patches README).

## §1 Incident

- PR #1094 (adapter-jig J2) squash-merged to `staging` as `df8011cfe`. The branch
  commits carried valid `Prior-art:` trailers; the squash commit body is the **PR
  body verbatim** (verified: `git log -1 --format=%B df8011cfe` == PR #1094 body),
  which contained §1.7 sections but **no `Prior-art:` lines** → trailers lost.
- Principle 11 F1 (`packages/core/principles/11-build-first-reuse-default.test.ts`)
  resolves a capability file's evidence via its *introducing commit's* trailer.
  Post-squash the introducing commit is the trailer-less squash → F1 red.
- The red surfaced as: `audit-self` **failure on the next staging push**
  (`132c73d97`, unwatched — `#warning-nobody-reads`) and then on the next
  unrelated PR (#1097), which had to be unblocked by SSOT bookkeeping
  (`d65b8ea3c`, entry #226 path append).
- Repo squash setting is `squash_merge_commit_message: COMMIT_MESSAGES`, but the
  observed squash body equals the PR body — the agent merge path supplies the PR
  body as the squash message. Either way, **the PR body is the only surface that
  deterministically survives the squash**, so that is where the trailer must live.

## §2 Channel selection (per rule-enforcement-channel-selection.md §3)

Violation is mechanically detectable (capability diff + PR body without a valid
`Prior-art:` line) → **gate**. Earliest reachable channels considered:

- `gh pr create/edit` interception (`~/.claude/hooks/git-safety.sh`) — earliest,
  but operator-global and outside the repo (agent-uncommittable). Left as an
  optional operator-side mirror, same as the existing §1.7 local mirror.
- **PR-time CI on the PR body — SHIPPED** (`.github/workflows/pr-body-prior-art.yml`,
  types incl. `edited` so fixing the body re-fires the gate). Mirrors the
  `discipline-self-check.yml` §1.7 PR-body pattern — same class, no
  parallel-evolution; consistent with the promote-mechanics §7 trailer backstop
  in `audit-self.yml` (the staging→main instance of the same trailer-loss class).
- Staging-push F1 (direction (c) of the kickoff) — **already exists**:
  `audit-self.yml` `principles-meta-tests` runs on `push: [staging]` and DID go
  red on `132c73d97`. It is a post-merge tripwire, not a fix — too late by
  construction.

## §3 Mechanism shipped

- `packages/core/hooks/checks/prior-art.ts` → `checkPrBodyPriorArt()` — reuses
  `detectCapabilityReason` + `checkTrailerBody` (incl. escape-hatch rejection and
  the C1 SSOT-existence arm) over the **whole PR range** (the squash preview).
- `packages/core/hooks/utils/git.ts` → `rangeGit(base, head)` — a `GitProvider`
  viewing `merge-base(base, head)..head` as one synthetic commit.
- `packages/core/hooks/checks/pr-body-prior-art-bin.ts` — CI entrypoint.
- Paired positive/negative tests: `pr-body-prior-art.test.ts` (9 cases; gated by
  the audit-self hooks-suite job). Live replay: the bin run against PR #1094's
  real body + range exits 1 with `no Prior-art: trailer` — the gate catches the
  motivating incident.

## §1.7 Self-review

- **Forward-check:** gate is deterministic tsx/CI, zero LLM
  (`no-paid-llm-in-ci.md`); channel chosen per
  `rule-enforcement-channel-selection.md §3` (detectable → gate, earliest
  reachable in-repo = PR-time CI, `.github/workflows/pr-body-prior-art.yml:22`);
  actions SHA-pinned + `npm ci --prefix` (`ci-tool-pinning.md §1`); reuses the
  existing §7 mechanism (`packages/core/hooks/checks/prior-art.ts:283`
  `checkPrBodyPriorArt`), no parallel evolution (`build-first-reuse-default.md`).
- **Backward-check:** sibling surfaces of the trailer-loss class swept —
  staging→main promote (`audit-self.yml` §7 real-commit backstop, CLAUDE.md
  Harness gates — untouched, consistent); pre-push §7 commit-level arm
  (`packages/core/hooks/pre-push.ts:296` — unchanged, still owns branch
  commits); `discipline-self-check.yml` §1.7 PR-body gate (pattern mirrored,
  not modified); staging-push `principles-meta-tests` (already runs F1
  post-merge, `audit-self.yml:198` — left as tripwire). No surface superseded.

## §4 Residuals

- The new workflow's job is not yet in branch protection required checks —
  maintainer decision (`workflow-integrity.yml` asserts only `ci-success`).
  Until required, a red gate is visible-but-bypassable on the PR.
- `COMMIT_MESSAGES` repo setting vs observed PR-body squash message: unresolved
  which merge path overrides it; the gate is correct under both (branch commits
  already carry trailers via pre-push §7; the PR body now must too).
