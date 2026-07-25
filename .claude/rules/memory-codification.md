# Memory codification — discipline rule

<!-- channel: hook .claude/hooks/inject-memory-codification.sh -->

> **Class:** B — compensating mechanism without CI test (AI-agnostic auditor agent + local-audit grep). Class A (CI principle test) is **structurally unreachable**: the corpus is user-scope agent memory, which lives outside the repo and outside CI by construction (see §1 hard constraint). Promotion ceiling = B; retirement criterion in §6.
> **Fires:** writing a durable behavioural convention to agent memory.
> **Authoritative for:** memory-codification discipline rule — §2 what counts as a *durable convention* (trigger + non-triggers), §3 the write-time codify-then-pointer discipline, §4 compensating mechanisms (local-audit grep + auditor agent; no CI by constraint), §5 anti-patterns, §6 promotion / retirement.
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../README.md#why-this-exists). Memory *file format / index* — that is the harness/global memory-instructions block. Doc-authority header spec — see [doc-authority-hierarchy.md](doc-authority-hierarchy.md).

> **Origin:** 2026-05-22 memory coverage audit ([docs/meta-factory/research-patches/2026-05-22-memory-coverage-audit.md §6](../../docs/meta-factory/research-patches/2026-05-22-memory-coverage-audit.md)). The audit swept all 51 memory files and found **15 stage-0** entries (durable conventions living *only* in user-scope memory, never codified into the repo). Successor to the 2026-05-13 memory-to-docs codification audit ([docs/meta-factory/research-patches/2026-05-13-memory-to-docs-codification-audit.md §6-§8](../../docs/meta-factory/research-patches/2026-05-13-memory-to-docs-codification-audit.md)), which named the candidate principle but left the standing discipline open. This rule operationalises it.
>
> **Companion mechanism:** [agents/memory-codification-auditor.md](../../agents/memory-codification-auditor.md) — AI-agnostic sub-agent read by an active session (no paid LLM per [no-paid-llm-in-ci.md §1](no-paid-llm-in-ci.md)).

## §1 Problem this solves

The project's thesis is «documents lie; tests don't» — every codified convention should be an executable artifact failing at the earliest reachable channel ([README.md#why-this-exists](../../README.md#why-this-exists)). But a convention recorded **only in user-scope agent memory** (`~/.claude/projects/<slug>/memory/*.md`) is invisible to that machinery: it is not in the repo, not in git history, not reachable by any CI gate, and not visible to a teammate or a fresh session without the same memory store. It is **stage-0** — the worst case, enforced by nothing but the recall of whichever session happens to load it.

**Hard constraint (load-bearing):** user-scope memory lives *outside the repo and outside CI by construction*. Therefore a memory-resident convention can be enforced **only** at write-time (the session writing it), via local audit (a session with memory access), or via periodic re-audit — **never** by a repo test or CI gate. This is why this rule's ceiling is Class B, not A. Any proposal to «add a CI test for memory» is a category error — the fix is to *move the convention out of memory into the repo*, not to test memory in place.

## §2 Trigger — what is a «durable convention»

**This rule fires when** a session is about to write to memory a **behavioural rule applicable to any future session** — i.e. guidance of the form «always/never do X», «when Y, do Z», «the project's policy is W». Memory entries of `type: feedback` or `type: project` that carry a **«How to apply:»** line are the high-signal shape.

**Durable convention (codify) vs. memory-appropriate (leave):**

| Leave in memory (NOT a durable convention) | Codify into repo (durable convention) |
|---|---|
| Ephemeral state — «PR #131 open, BEHIND, needs sync» | Behavioural rule — «always branch from main; auto-merge into staging» |
| Identity — «maintainer is Art; prefers Russian» | Policy — «no paid LLM in CI, ever» |
| Reference fact / pointer — «SSOT is at docs/.../prior-art-evaluations.md» | Discipline — «before any recommendation, cite SSOT + give file:line» |
| Project status / progress — «Wave 10 shipped» | Convention — «every SKILL.md needs a paired-negative block» |

When in doubt: *would a fresh session on a different machine (no access to this memory store) need this to behave correctly?* If yes → it is a durable convention → codify.

## §3 The write-time discipline

When a session writes a durable convention to memory, **in the same step**:

1. **Codify it in the repo** at its natural home — [CLAUDE.md](../../CLAUDE.md) for AI-tooling conventions, a new or existing `.claude/rules/*.md` for discipline rules (with Class + Authoritative-for header per [doc-authority-hierarchy.md §2-§3](doc-authority-hierarchy.md)), or the relevant doc under `docs/meta-factory/`.
2. **Reduce the memory entry to a one-line pointer**: `See <repo-path> — codified at <SHA>` (2026-05-13 §6 option 2/3). The memory note becomes a recall-time index entry, not the source of truth.
3. The repo artifact is now the SSOT; memory points to it. The convention is reachable by whatever channel the repo home affords (rule → review-time; CLAUDE.md → session bootstrap; principle test → CI, if mechanizable).

**Sequencing exception:** if the convention is discovered mid-task and codifying it now would expand PR scope (drive-by, per [CLAUDE.md «PR strategy»](../../CLAUDE.md)), record it in memory **with an explicit `TODO-codify:` marker** and a one-line rationale, then codify in a dedicated follow-up. The marker is what the §4 audit looks for — an un-marked durable convention in memory is the violation; a marked one is a tracked debt.

## §4 Compensating mechanisms (no CI by constraint)

Per §1, no CI test is possible. Two session/local mechanisms compensate; a third, write-time mechanism (CTX Stage 1) is shipped and activated:

**(0) Write-time hook (CTX Stage 1, WIRED).** [`.claude/hooks/inject-memory-codification.sh`](../hooks/inject-memory-codification.sh) — a PostToolUse hook that fires the instant a `Write` targets a path with a `/memory/` segment, injecting this rule's §3 codify-then-pointer one-liner as additionalContext. The hook file is shipped and self-tested ([`inject-memory-codification.test.ts`](../../packages/core/hooks/inject-memory-codification.test.ts)), and its `.claude/settings.json` PostToolUse:Write registration is **live** (`.claude/settings.json:168`, verified by `jq '.hooks.PostToolUse' .claude/settings.json` → 8 entries, index 7 = `matcher:"Write" → inject-memory-codification.sh`). This channel is **live** alongside (a)/(b) below: a session that `Write`s to a `/memory/` path receives the §3 codify-then-pointer one-liner as `additionalContext` at the moment of the write. (`.claude/settings.json` remains agent-deny-listed for edits — see [CLAUDE.md `Artifact Ownership Contract`](../../CLAUDE.md) — so any future re-registration requires a maintainer-applied patch.)



**(a) Local-audit grep** — deterministic, run in a session with memory access (never CI):

```bash
# Flags convention-shaped feedback_* entries lacking a codification pointer.
# Heuristic: "How to apply" shape + no pointer line = candidate gap. Judgment confirms each hit.
MEM=~/.claude/projects/-Users-art-code-rules-as-tests-aif/memory
for f in "$MEM"/feedback_*.md "$MEM"/project_*.md; do
  grep -qiE 'codified at|See \.claude/rules|See CLAUDE\.md|TODO-codify' "$f" && continue
  grep -qiE 'how to apply' "$f" && echo "UNCODIFIED: $(basename "$f")"
done
```

False-positives expected — the grep surfaces candidates; a human/AI judgment call confirms each. It is a *push* sweep, not a gate.

**(b) AI-agnostic auditor sub-agent** — [agents/memory-codification-auditor.md](../../agents/memory-codification-auditor.md), read by an active session (Claude Code / Cursor / Aider / Codex) on its own subscription. No API-billed call (per [no-paid-llm-in-ci.md §1](no-paid-llm-in-ci.md)). The agent does the semantic «is this a durable convention?» triage the grep cannot.

**(c) Periodic re-audit** — re-run the [2026-05-22 coverage audit](../../docs/meta-factory/research-patches/2026-05-22-memory-coverage-audit.md) sweep every ~N waves, parallel to the push-based trigger-sweep in [phase-research-coverage.md §1.6](phase-research-coverage.md). Memory-codification gaps sit indefinitely without a push sweep — exactly the «armed-but-not-fired» shape.

## §5 Anti-patterns

- **`#convention-stranded-in-memory`** — a durable behavioural rule written to memory with no repo codification and no `TODO-codify:` marker. The stage-0 worst case. Falsification: §4(a) grep flags it. Counter: codify-then-pointer per §3.
- **`#test-the-memory`** — proposing a CI gate / principle test over the memory store. Category error (§1 hard constraint): memory is outside CI. Counter: move the convention into the repo; test it *there* if mechanizable.
- **`#pointer-without-codification`** — memory entry reduced to a pointer, but the pointed-to repo artifact was never actually written (dangling pointer). Counter: codify first, point second; the SHA in the pointer must reference a real commit.
- **`#codify-everything`** — over-applying: codifying ephemeral state, identity, or reference facts that legitimately belong in memory (§2 left column). Bloats the repo with non-conventions. Counter: the §2 «fresh session on a different machine» test.
- **`#stale-pointer-drift`** — convention codified + memory pointer added, but the repo home later changes (file renamed/moved) and the pointer rots. Counter: pointers cite stable paths; the §4(c) re-audit re-checks pointer validity.

## §6 Promotion / retirement

- **Promotion ceiling = Class B.** Class A (CI principle test) is structurally unreachable (§1). The strongest reachable mechanism is the auditor agent + local grep already specified. There is no further promotion target; «promote to A» would require memory to live in the repo, which is a different decision (out of scope here).
- **Strengthening trigger:** if the §4(c) re-audit finds the stage-0 count *growing* across 2 consecutive sweeps despite this rule, escalate the auditor agent from «run on request» to a mandatory session-start read (parallel to the Step-0 bootstrap pattern).
- **Retirement:** if 3 consecutive re-audits report zero un-marked stage-0 conventions AND no `#convention-stranded-in-memory` incident fires for 12 months, archive to prose in [CLAUDE.md](../../CLAUDE.md) `## Memory codification` and delete this file. Matches peer-rule retirement criteria ([reviewer-discipline.md §4](reviewer-discipline.md), [parallel-subwave-isolation.md §4](parallel-subwave-isolation.md)).

## §7 §1.7 self-reflexive note

- **Forward-check:** this rule complies with [no-paid-llm-in-ci.md](no-paid-llm-in-ci.md) (mechanisms are write-time + local grep + session-read agent — zero API-billed calls), [build-first-reuse-default.md §3](build-first-reuse-default.md) (REUSE: «codify conventions in repo, not memory» is externally validated — Claude Code project-scope hierarchy + Cline Memory Bank committed-markdown; the only BUILD is the project-specific local-audit grep, justified by confirmed absence of an upstream *user-memory* auditor), and [doc-authority-hierarchy.md §2-§3](doc-authority-hierarchy.md) (this file carries Class + Authoritative-for header).
- **Backward-check:** this rule is the codification of the convention stated in `project_memory_coverage_audit_kickoff` memory + the 2026-05-22 audit §6. Per its own §3, that memory entry should now be reduced to a pointer to this rule + the audit patch (recursive self-application, T15). No other existing rule is superseded; this rule *extends* the 2026-05-13 audit's open standing-discipline rather than duplicating it.

## See also

- [docs/meta-factory/research-patches/2026-05-22-memory-coverage-audit.md](../../docs/meta-factory/research-patches/2026-05-22-memory-coverage-audit.md) — origin; the full 51-file coverage matrix + §6 proposal this rule implements.
- [docs/meta-factory/research-patches/2026-05-13-memory-to-docs-codification-audit.md](../../docs/meta-factory/research-patches/2026-05-13-memory-to-docs-codification-audit.md) — predecessor audit (memory → docs for 6 entries; named the principle, left discipline open).
- [agents/memory-codification-auditor.md](../../agents/memory-codification-auditor.md) — companion AI-agnostic auditor agent.
- [.claude/rules/phase-research-coverage.md §1.6](phase-research-coverage.md) — push-based sweep pattern this rule's §4(c) mirrors.
- [CLAUDE.md](../../CLAUDE.md) — natural codification home for AI-tooling conventions.
