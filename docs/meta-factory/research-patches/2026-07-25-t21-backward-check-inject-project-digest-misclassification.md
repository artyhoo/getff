<!-- scope:t21-inject-project-digest-misclassification -->

# T21 backward-check misclassification — `inject-project-digest.sh` wrongly dismissed as framework-internal

> **Class:** research patch — incident record feeding the [`ai-laziness-traps.md §2 T21`](../../rules/ai-laziness-traps.md) → Class A principle-test promotion criterion (counter now 2/3).
> **Origin:** 2026-07-25, auto-review gate on the S6 `inject-matching-rule` PR (commit `dd7764bd`). Blocking finding `[5d6f11cde01b]`: the T21 backward-check note dismissed `inject-project-digest.sh` as framework-internal; the dismissal is factually wrong.
> **Scope:** this patch records the corrected sweep and the durable lesson. It does NOT touch any code or rule — T21 is already canonical ([ai-laziness-traps.md §2 T21](../../rules/ai-laziness-traps.md)); this patch is the incident evidence.

## §1 The wrong T21 note (in commit `dd7764bd`)

```text
Backward-check (T21 sweep): deps-hash-check.sh:82 is the same defect class
but explicitly OUT OF SCOPE per kickoff §8 anti-scope; inject-project-digest.sh
and inject-subagent-digest.sh are framework-internal (not consumer-shipped).
```

Two errors in three lines:

1. **`inject-project-digest.sh` is NOT framework-internal.** Verified live (T3 — enumerated, did not trust memory): `install.sh:652-660` delivers it into the consumer's `.claude/hooks/`, `setup.d/10-skills.sh:260-271` registers it as UserPromptSubmit+SubagentStart, and `plugin/hooks/inject-project-digest` is the plugin twin. It IS a sibling consumer-shipped hook with the same silent-no-op-when-input-corpus-is-absent defect class (`.claude/hooks/inject-project-digest.sh:30,38` — silent `exit 0` when `.claude/session-bootstrap.md` is absent or has empty digest block). The dismissal is `#backward-check-restates-not-sweeps`.

2. **`deps-hash-check.sh:82` is NOT covered by kickoff §8 anti-scope.** §8 lists "other stage's surface (mutation runner logic, lylye/pre-push, datetime rules, CI templates, refresh)" — i.e. other stages of the **getff-honest-signals** umbrella (S1-S5). `deps-hash-check.sh` is owned by a *different* umbrella (DH-S1..S4, commits #1016/#1058/#1070/#1092 etc.). The §8 cover was a misread.

## §2 Corrected T21 backward-check sweep

Class of this change = consumer-shipped hook that silently no-ops forever when its input corpus is absent.

| Surface | Consumer-shipped? | Same defect class? | Verdict |
|---|---|---|---|
| `.claude/hooks/inject-project-digest.sh:30,38` | YES — `install.sh:652-660` + `setup.d/10-skills.sh:260-271` + `plugin/hooks/inject-project-digest` twin | YES — silent `exit 0` when `.claude/session-bootstrap.md` absent or digest block empty | **GAP-FOUND.** Not addressed by this PR — candidate follow-up under a separate umbrella. |
| `.claude/hooks/deps-hash-check.sh:82` | YES (separate umbrella) | YES — silent `exit 0` when `$DECISIONS` file missing | **GAP-FOUND.** Owned by the deps-hash umbrella; cross-umbrella, out of scope here. |
| `.claude/hooks/inject-subagent-digest.sh` | NO — `@cc-only-rationale: internal orchestrator hook, maintainer-env only`; no install/setup delivery line, no plugin twin | n/a | **SWEPT-CLEAN.** Framework-internal. |
| `.claude/hooks/inject-session-bootstrap.sh` | NO — internal per [zcode-parity census row 14](2026-07-18-zcode-full-parity-census.md) | n/a | **SWEPT-CLEAN.** Framework-internal. |

This PR's scope (`inject-matching-rule`) was a strict subset of the consumer-shipped silent-no-op population.

## §3 Why the trap fired under elevated-context review

The T21 trap text ([`ai-laziness-traps.md §2 T21`](../../rules/ai-laziness-traps.md)) predicts exactly this: a backward-check authored *in the same session that just shipped the diff* pattern-matches to "recap the PR" because the diff-narrative is fresh in working context. The dismissal (`framework-internal (not consumer-shipped)`) was asserted from memory, not from the live grep `git ls-files | grep inject-project-digest` — which would have surfaced the `install.sh:652-660` delivery line in 1 command. The reviewer's cold-agent sweep (immune by construction — never saw the diff) is what caught it.

The kickoff §7 explicitly elevated T21 to load-bearing for S6 (umbrella thesis IS honest signals about silent no-ops), which is why this is a Blocker, not advisory.

## §4 Promotion criterion status

[`ai-laziness-traps.md §5`](../../rules/ai-laziness-traps.md) states: "T21 → Class A principle test when 3+ documented `#backward-check-restates-not-sweeps` incidents (each: a backward-check whose surface list equalled the diff, and a sibling gap that reached the PR) are recorded with commit-SHA evidence."

- Incident 1/3: PR #857, commit `ec643bac7` — already in T21 trap text. Single-label-host gap on the Tier-1 surface sibling.
- **Incident 2/3: PR (this S6 PR), commit `dd7764bd`** — recorded here. Sibling gap on `inject-project-digest.sh` consumer-shipped surface.
- 1 more incident → promotion fires. Per T21 §5, any future test MUST be semantic (curated restatement-vs-sweep corpus + MANUAL classification), never a syntactic proxy — the S6 incident proves again that "cites ≥1 non-diff file" false-negatives (the S6 backward-check DID cite `deps-hash-check.sh:82` as a non-diff sibling; the gap was the *classification* of that sibling + the missed `inject-project-digest.sh`, not the absence of citations).

## §5 Anti-scope

This patch does not:
- Touch any rule file (T21 trap text already canonical).
- Touch the S6 hook code (kickoff §8 anti-scope; rework finding is about the NOTE, not the code).
- Touch `done.md` (blocked in-container by the `.claude/**` sensitive-path classifier — host-side harvesting session applies the corresponding summary correction before `gh pr create`).

## §6 See also

- [`ai-laziness-traps.md §2 T21`](../../rules/ai-laziness-traps.md) — the canonical trap text + counter (now 2/3).
- [`research-patches/2026-07-03-pr857-t21-backward-check-restates-not-sweeps.md`](2026-07-03-pr857-t21-backward-check-restates-not-sweeps.md) — incident 1/3 (if tracked; otherwise reference in T21 trap text).
- `agents/backward-sweep-auditor.md` — the cold-agent that catches this class; the reviewer's sweep here is a live instance.
- Kickoff `.claude/orchestrator-prompts/getff-honest-signals-meta-launch/kickoff.md` §7 — the elevation of T21 to load-bearing for S6.

## §1.7 Self-application note

Self-application: a patch about a T21 backward-check miss must not itself skip the sweep (T15) — the corrected enumeration in §3-§5 above IS the sweep, re-run with per-surface verdicts; the misclassified surface (`inject-project-digest.sh`) is re-classified with delivery-map evidence rather than intuition, the exact counter the S1 incident taught. Forward: consistent with `ai-laziness-traps.md §2 T21` and its incident counter. Backward: no other patch in this series claims the old classification (checked both S6 patches). Added at harvest time by the accepting session.
