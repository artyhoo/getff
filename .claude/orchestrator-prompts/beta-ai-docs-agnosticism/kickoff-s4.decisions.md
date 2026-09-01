# beta-ai-docs-agnosticism S4 — decisions log (night run 2026-09-01/02)

Per `.claude/skills/night-mode/SKILL.md` delta items 1 + 8: a parked question whose decision
OBJECT sits inside a kickoff-authorized stage scope may be decided by a live top-tier night seat
on an advisor consult, with the entry recorded **before** application. Genuine owner forks and
floor-category objects stay parked. Entry shape: session-bus v2 §4.

## Decision 1 — which branch Context7 indexes (`context7.json` `branch` + workflow trigger)

**Object cut.** The object is the `branch` field of `context7.json` and the matching
`on: push: branches:` list of the refresh workflow — both files are inside S4's `## §5 Permitted
files`, so the object is in-envelope. No floor category claims it: no spend, no permissions, no
maintainer-owned artifact, no goal movement; the externally-visible act (the Context7 _submission_)
stays maintainer-gated regardless of this decision (kickoff §2 D4). The operator's night
instruction («decide yourself or ask the advisor», 2026-09-02) explicitly lifted the
author-time park in kickoff §6.

**Decision package (evidence measured 2026-09-02).**

- `origin/main` is **631 commits** behind `origin/staging`; last promote `#936` on 2026-07-10
  (`git rev-list --count origin/main..origin/staging`; `git log -1 origin/main`). Promotes ran
  ~10× between 2026-06-23 and 2026-07-10, then none for 8 weeks.
- Default branch is `staging` (`gh repo view --json defaultBranchRef`); `README.md:4-6` badges
  point at `?branch=main`.
- Spec §7 Phase 2 (`docs/superpowers/specs/2026-07-23-beta-program-design.md:395-398`):
  publication = maintainer promotes staging→main + `npm publish`. Until then (Phase 1) nobody
  external installs anything — there is no published artifact for an index to match.
- Spec §6 C4 (`:369-375`): Context7 is the _consumer's_ discovery channel.
- `context7.json` `branch` defaults to the repo default branch when omitted; `branchVersions[]`
  can index further branches as versions (upstash/context7 `docs/library-owners.mdx`).

**Options.**

- A — `staging`: freshest, CI-green trunk; agents may read docs for capabilities not yet
  promoted/published.
- B — `main`: matches the published artifact _at beta_; today an 8-week-stale snapshot with
  nothing installable to match.
- C — `main` primary + `branchVersions: [{branch: "staging"}]`: both indexed; splits authority for
  a bare library-id query with zero consumers today.
- D — park for the operator.

**Decision: A — `staging` now; flip to `main` at Phase-2 publication.**

**Rationale.** The consumer-noticeable failure is _stale_ docs, not _early_ docs: indexing `main`
today would have an agent cite conventions retired weeks ago, with no installable artifact the
snapshot corresponds to. `staging` is where the rules actually fail at the earliest channel
(README goal) — it is the truth the index should carry. Option C pays a split-authority cost for
no consumer. The flip is trivially reversible, so it is recorded as a Phase-2 obligation rather
than pre-paid.

**Falsifier («wrong if …»).** Context7's re-index latency makes `staging` churn visibly unstable
to agents (stale-vs-live mismatch within one query session); OR the Phase-2 promote happens
before the flip is wired into the spec §8 integration checklist.

**Reversibility.** Trivial — one JSON field + one workflow-trigger line; undo = flip
`"branch": "staging"` → `"main"` and `branches: [staging]` → `[main]` in the same commit. A
pointed-at revert on `staging`, visible to morning review.

**Follow-through owed by S4.** The Phase-2 flip is surfaced in the S4 PR body as a **proposal**
for the spec §8 integration checklist («flip Context7 index branch staging→main at promote») —
the spec is a separate owner artefact, so the line lands as a spec-owner commit, never inside the
stage PR (/pipeline §5 park-record contract).

decided-by: night seat (Fable) on advisor consult (fresh-context Fable, read-only, ≤120 words,
2026-09-02) · status: applied (kickoff-s4.md §2 D1/D2, §6, §9 updated in the same PR).

## Owner forks (logged, NOT decided)

_(none)_
