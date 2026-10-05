# Injected live state — Scenario 1 (no-arg `/pipeline`)

> This file is the raw `!shell`-injected live state for a no-argument `/pipeline`
> invocation. Reason over THIS state only — do NOT run real `git` / `gh`.

## §1 Step 1 — `git status --short` + branch + ahead/behind

```text
(clean working tree)
--- branch: staging
--- 0	0   (in sync with origin/staging)
```

## §1 Step 1 — `gh pr list --search "is:open"` (open PRs)

```json
[
  {
    "number": 411,
    "title": "feat(n8-bar): sub-wave A — parser",
    "state": "OPEN",
    "headRefName": "worktree-n8-bar-a",
    "baseRefName": "staging"
  }
]
```

## §1 Step 1 — `gh pr list --state merged --limit 20` (recently merged)

```json
[
  {
    "number": 409,
    "title": "chore(deps): bump vitest",
    "state": "MERGED",
    "headRefName": "chore-bump-vitest",
    "baseRefName": "staging"
  },
  {
    "number": 408,
    "title": "docs(readme): badge fix",
    "state": "MERGED",
    "headRefName": "docs-badge-fix",
    "baseRefName": "staging"
  }
]
```

## §1 Step 1 — `wave-sequencing-plan.md` §0 excerpt (the PLAN's claims)

```text
## §0 Backlog & direction (as maintainer last edited it)

- n7-foo   — ✅ merged (PR #410)         # plan claim
- n8-bar   — 🟡 partial (sub-wave A open)
- c1-baz   — 📋 planned (kickoff ready, not started)

Maintainer direction: (none pinned this cycle)
```

## §1 Step 1 — `plan-currency-check.sh` output (kickoff existence)

```text
KICKOFF-OK: .claude/orchestrator-prompts/n8-bar/kickoff.md
KICKOFF-OK: .claude/orchestrator-prompts/c1-baz/kickoff.md
KICKOFF-MISSING: .claude/orchestrator-prompts/n7-foo/kickoff.md
```

## §2 Step 1 — `priority-score.sh` candidate list (DONE-filtered already)

```text
=== priority-score.sh ===
CANDIDATE: n8-bar    kickoff=exists   stage_hint=2   blocks=c1-baz
CANDIDATE: c1-baz    kickoff=exists   stage_hint=1   blocks=(none)
=== priority-score.sh: END rc=0 ===
```
