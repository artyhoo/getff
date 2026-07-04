---
description: Kickoff staging-placement — dispatch-input merge-timing discipline
paths:
  - ".claude/orchestrator-prompts/**"
---

# Kickoff staging-placement — dispatch-input discipline

<!-- globs: .claude/orchestrator-prompts/** -->
<!-- inject: Kickoffs are read from `staging` by /pipeline + aif. Author → MERGE the kickoff to staging → only THEN hand out `/pipeline <umbrella>` or an aif dispatch. A worktree-branch-only kickoff is invisible to dispatch sessions (coordination CANON syncs only gitignored files, not tracked kickoffs). -->

> **Class:** B — compensating mechanism without CI test: an edit-time reminder injected by [`inject-matching-rule.sh`](../hooks/inject-matching-rule.sh) via the `globs:` marker above. No CI gate — the convention is about *merge timing* (author-on-branch → merge-to-staging → dispatch), which a branch-scoped CI run cannot assert. Promotion criterion in §4.
> **Fires:** editing/creating any file under `.claude/orchestrator-prompts/<umbrella>/`.
> **Authoritative for:** where dispatch-input kickoffs must live before a `/pipeline` or aif dispatch is initiated, and why; the edit-time reminder mechanism.
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../README.md#why-this-exists). Kickoff §3 authoring obligations (T-enumeration) — see [ai-laziness-traps.md §3](ai-laziness-traps.md). Coordination symlink sync — see [`scripts/link-coordination.sh`](../../scripts/link-coordination.sh).

> **Origin:** 2026-06-16, recurring incident (2×). Kickoffs were authored + committed on a feature worktree branch, then `/pipeline <umbrella>` / aif dispatch sessions — which run on `staging` — could not see them. The first time, a `/pipeline pipeline-i18n-fix` run on staging resolved to a stale same-named plan and fixed the wrong thing (PR #578 ≠ the intended output-directive). Codified at maintainer request: «нужен тест или хук на тригер — когда пишем кикоф, чтобы напоминал куда сохранять».

## §1 The rule

Kickoffs under `.claude/orchestrator-prompts/<umbrella>/kickoff.md` are **tracked** files, read from the **`staging`** branch by every dispatch consumer:

- `/pipeline <umbrella>` scans `.claude/orchestrator-prompts/*/kickoff.md` on the branch its session runs on (normally `staging`).
- aif-handoff autonomous workers run against a `staging`-synced container base.

A kickoff that exists **only on a feature worktree branch is invisible** to them. The coordination CANON (`~/.claude-coordination/`) does **not** rescue this: [`link-coordination.sh`](../../scripts/link-coordination.sh) symlinks only *gitignored* content files; tracked kickoffs travel via git, i.e. via `staging`.

**Sequence (binding):** author the kickoff → **merge it to `staging`** (PR, squash) → **only then** hand out `/pipeline <umbrella>` or initiate an aif dispatch. Telling anyone to dispatch before the kickoff is on `staging` is the violation.

## §2 Trigger

Editing or creating any file under `.claude/orchestrator-prompts/<umbrella>/` (kickoff.md, done.md, dispatch inputs) — the `globs:` marker above scopes the edit-time reminder to exactly this surface.

## §3 Mechanism (edit-time reminder — earliest reachable channel)

The `<!-- globs: -->` + `<!-- inject: -->` markers at the top wire the convention into [`inject-matching-rule.sh`](../hooks/inject-matching-rule.sh): on any Edit/Write under `.claude/orchestrator-prompts/**`, the injector delivers the one-line reminder as PostToolUse `additionalContext`, once per session. This is the earliest reachable channel — there is no pre-push/CI gate for «is this kickoff on staging yet?», because at author time the answer is legitimately «not yet»; the discipline is about not *dispatching* until it is.

## §4 Promotion / retirement

- **Promotion to a `/pipeline` preflight gate:** if a further «kickoff-not-on-staging caused a misdispatch» incident fires after this rule lands, add a check in the `/pipeline` skill §1 preflight that, for the named umbrella, asserts `git ls-tree origin/staging` contains the kickoff before dispatching — fail loudly otherwise. (Class B → A.)
- **Retirement:** 12 consecutive months with zero misdispatch-from-missing-kickoff incidents → archive to prose in [CLAUDE.md](../../CLAUDE.md). Matches peer-rule retirement criteria ([reviewer-discipline.md §4](reviewer-discipline.md)).

## §5 Anti-pattern

- **`#dispatch-before-staging`** — instructing `/pipeline <umbrella>` or an aif dispatch while the kickoff lives only on a feature branch. The dispatch session (on `staging`) silently can't find it and either no-ops or resolves to a stale same-named artifact. Counter: §1 sequence — merge first, dispatch second.

## §6 §1.7 self-reflexive note

- **Forward-check:** complies with [no-paid-llm-in-ci.md](no-paid-llm-in-ci.md) (mechanism is an edit-time bash injector, zero API calls), [doc-authority-hierarchy.md §2-§3](doc-authority-hierarchy.md) (carries Class + Authoritative-for header), and [build-first-reuse-default.md](build-first-reuse-default.md) (REUSE — no new hook; the existing `inject-matching-rule.sh` globs mechanism delivers it, zero new code).
- **Backward-check:** codifies the 2026-06-16 recurring incident; supersedes nothing. Self-applies — this very rule is delivered through the mechanism it documents.

## See also

- [`inject-matching-rule.sh`](../hooks/inject-matching-rule.sh) — the injector that delivers this rule's reminder at edit-time.
- [ai-laziness-traps.md §3](ai-laziness-traps.md) — the sibling kickoff-authoring obligation (T-enumeration), enforced at edit-time by `check-kickoff-traps.sh`.
- [CLAUDE.md `Operational conventions`](../../CLAUDE.md) — sibling dispatch conventions (pre-dispatch in-flight probe, parallel-session dispatch).
- [`scripts/link-coordination.sh`](../../scripts/link-coordination.sh) — coordination symlink sync (gitignored-only; why CANON does not cover tracked kickoffs).
