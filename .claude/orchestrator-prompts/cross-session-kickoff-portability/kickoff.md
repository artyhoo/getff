# cross-session-kickoff-portability — I-phase kickoff

> **Type:** I-phase (execution)
> **Binding scope:** [`docs/meta-factory/research-patches/2026-06-14-cross-session-kickoff-portability.md`](../../../docs/meta-factory/research-patches/2026-06-14-cross-session-kickoff-portability.md) — the R-phase verdict (ADAPT → option 1), maintainer-authorized 2026-06-14. This kickoff implements §7 D1–D6.
> **Authoritative for:** the I-phase implementation plan for committing `/pipeline` kickoffs to the repo. NOT authoritative for project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists).
> **R-phase PR:** #518.

## §0 One-sentence goal

Make a `/pipeline` kickoff authored on any machine/container **discoverable everywhere** by committing
`kickoff.md` to the repo (joining `done.md` as a tracked exception), so discovery is a property of the
**committed tree**, not of a per-machine coordination store — and make the missing-commit case **fail loud**.

## §0.1 Dogfood note (read first)

This very kickoff is, right now, a gitignored non-portable file — the exact bug. **Deliverable D1 makes it
trackable; the I-phase should then commit this kickoff as the first instance of the new convention.** If you
are reading this from a checkout where it does not exist, the bug is still live; that is expected pre-merge.

## §1 Deliverables — each ships with an executable acceptance

> Split into two atomic PRs to keep them reviewable (see §2). Mechanism = small + fully testable on one
> synthetic umbrella; back-catalog migration = the bulk mass-commit, gated on the secret-scan.

### PR-1 — mechanism (D1, D3, D4, D5, D6)

- **D1 — gitignore negate + helper skip.**
  - `.gitignore`: add `!.claude/orchestrator-prompts/*/kickoff.md` (alongside the existing `!*/done.md`).
  - `scripts/link-coordination.sh`: add `kickoff.md` to the tracked-file skip-list (the `done.md`/`README.md`
    guards at lines ~116 and ~185) so the symlink mechanism stops managing it (git owns it now).
  - **Acceptance (executable, reuse the R-phase harness):** author + commit a kickoff for a *new* umbrella in
    checkout A; in a fresh `git archive HEAD | tar -x` checkout B with an **empty** `CLAUDE_COORDINATION_DIR`,
    `priority-score.sh` reports `kickoff=exists` for it. *Today = 0; assert ≥ 1.*
    ```bash
    # test body sketch
    git archive HEAD | tar -x -C "$B"
    CLAUDE_COORDINATION_DIR=/tmp/empty REPO_ROOT="$B" bash .claude/skills/pipeline/helpers/priority-score.sh \
      | grep -q "^<umbrella> .*kickoff=exists"
    ```

- **D3 — 600-line-gate exemption for kickoffs.** `.husky/pre-commit` (the `*.md` case, ~lines 49–68): accept a
  `transient artifact` first-20-lines marker for `.claude/orchestrator-prompts/*/kickoff.md`, mirroring the
  EXECUTION-PLAN.md exemption — OR split the 3 oversized kickoffs (`queue-mode-bootstrap` 726,
  `strategic-clarity-dialogue` 660, `aif-handoff-runtime-bridge-iphase` 649).
  - **Acceptance (paired):** a >600-line kickoff *with* the marker commits; an identical one *without* it fails
    the gate. Ship both as a positive+negative test (no `#discipline-theatre`).

- **D4 — lifecycle split, documented.** One line each in `.claude/skills/pipeline/SKILL.md` and the
  `link-coordination.sh` header: **`kickoff.md` = committed durable design doc; `state.md` + `_plan-cache` +
  `_master-backlog-delta` = gitignored regenerable runtime.**
  - **Acceptance:** `git check-ignore .claude/orchestrator-prompts/<u>/state.md` returns it (still ignored);
    `git check-ignore .../<u>/kickoff.md` returns nothing (tracked).

- **D5 — fail-loud enforcement (the part bare-commit misses).** Add a `.husky/pre-push` step: for each
  `.claude/orchestrator-prompts/*/` whose `kickoff.md` exists on disk, is NOT listed by `git ls-files`, and the
  umbrella has no `done.md` (i.e. in-flight) → **warn-then-fail** with `kickoff not portable — git add it`.
  Channel rationale: [`rule-enforcement-channel-selection.md`](../../../.claude/rules/rule-enforcement-channel-selection.md);
  ship **warn-only** for a calibration window first (peer to the §1.7 trailer rollout), then flip to fail.
  - **Acceptance (paired):** an in-flight umbrella with an untracked `kickoff.md` trips the check; the same
    umbrella once `git add`-ed passes; a closed (`done.md`-only) umbrella never trips.

- **D6 — legacy reconstruct fallback (optional safety net).** For an umbrella with `kickoff=missing` but a
  committed plan row, `/pipeline` emits a `RECONSTRUCT-STUB:` notice. **Does NOT auto-write the plan**
  (Direction A stays REJECTED, [`SKILL.md:216`](../../../.claude/skills/pipeline/SKILL.md)).
  - **Acceptance:** missing-kickoff umbrella *with* a plan row → notice emitted; *without* → silent.

### PR-2 — back-catalog migration (D2 + D2.5)

- **D2.5 — secret scan FIRST (mandatory, public repo, irreversible).** Before any `git add` of the back-catalog,
  scan the staged kickoffs for secrets / private data (`gitleaks detect --no-git --source <staged>` or a
  token/key/PII grep). **Acceptance:** zero findings (or each triaged + redacted); commit blocked otherwise.

- **D2 — dereference host symlinks → real files.** Idempotent migration script: for each
  `.claude/orchestrator-prompts/*/kickoff.md` that is a symlink, replace it with its dereferenced **content**
  (`tmp=$(cat "$k"); printf '%s' "$tmp" > "$k.real" && mv "$k.real" "$k"`), so `git add` stages content, never
  an absolute-path symlink. Run on the **authoring host** (where CANON is populated); other machines have no
  back-catalog to migrate.
  - **Acceptance:** `git ls-files -s .claude/orchestrator-prompts/ | awk '$1==120000'` is **empty** for
    kickoffs (no symlink staged), and `git ls-files '.claude/orchestrator-prompts/*/kickoff.md' | wc -l` > 0.

## §2 Sequencing + Mode

- **Mode:** PAIR (Mode-SDD) or two solo I-phase commits — review_required (overturns a deliberate convention).
- **Order:** PR-1 (mechanism, validated on ONE synthetic umbrella — do not migrate the 140 yet) → merge →
  PR-2 (back-catalog: D2.5 scan, then D2 migration + mass-commit). Keeping them separate keeps PR-1 reviewable
  and isolates the mass-commit behind the secret-scan gate.
- **SSOT:** add the proposed **#116** entry (research-patch §5) to `docs/meta-factory/prior-art-evaluations.md`
  in the PR-1 enabling commit, with a `Prior-art: prior-art-evaluations.md#116 (…)` trailer.

## §3 AI-laziness traps (mandatory — [.claude/rules/ai-laziness-traps.md §2](../../../.claude/rules/ai-laziness-traps.md))

Active traps for this I-phase: **T2/T15** (run the acceptance, don't claim it — every D ends in a runnable
test); **T3** (file:line evidence for every "done" — paste the test output); **T5** (this is I-phase: edits to
source are in-scope here, unlike the R-phase); **T16** (don't pattern-match `link-coordination.sh` as "already
solving this" — it is per-machine; verify the skip-edit actually removes kickoff from its scope); **T19** (run
your own cold-QA of the diff before handoff — CI checks form, not that D5's warn→fail flip is wired);
**T20** (no "it works" without a tool-call in the same turn).

**Domain trap T-PORT-B — "negated-but-still-symlinked":** after D1 negates `kickoff.md` in `.gitignore`, the
host's existing kickoffs are still **absolute-path symlinks**. Committing them as-is stages a broken symlink
that resolves to nothing on machine B. **Counter:** D2 (dereference) MUST run before any back-catalog `git add`;
the D2 acceptance (`awk '$1==120000'` empty) is the falsifier. Do not commit a kickoff that `test -L` reports.

## §4 Constraints / invariants (binding)

- **`done.md` semantics preserved** — `priority-score.sh` Layer C3 reads `done.md`; D1 only *adds* a tracked
  exception, never touches `done.md`. Re-run a completion-detection smoke after D1.
- **No-paid-LLM-in-CI** ([rule](../../../.claude/rules/no-paid-llm-in-ci.md)) — every gate here is git + bash.
- **Consumers out of scope** — `install.sh` ships no `orchestrator-prompts` and no `.gitignore` fragment;
  do NOT add either. A consumer-side shipped-convention is separate L3 work.
- **Build-vs-reuse** — reuse the `done.md` tracked-exception + `transient artifact` gate-exemption patterns;
  zero new dependency. Capability-commit gate: this is doc/config/bash, not a `packages/` capability.

## §5 Definition of done

All of: D1 + D3 + D4 + D5 + D6 acceptances green (PR-1); D2.5 scan clean + D2 acceptance green (PR-2); SSOT #116
landed with trailer; this kickoff itself committed as the first instance of the convention; the §0 D1 end-to-end
test (author in A → discovered in fresh checkout B) passes in CI or a documented manual run.

## §6 See also
- [research-patch 2026-06-14](../../../docs/meta-factory/research-patches/2026-06-14-cross-session-kickoff-portability.md) — binding R-phase scope + verdict.
- [2026-05-31-j5-orchestrator-prompts-hydration.md §3.1](../../../docs/meta-factory/research-patches/2026-05-31-j5-orchestrator-prompts-hydration.md) — the maintainer-owned deferral this resolves.
- [scripts/link-coordination.sh](../../../scripts/link-coordination.sh) — the per-machine symlink helper to amend (D1).

<!-- host-verify: none — legacy closed umbrella (done.md): work already accepted; no live host acceptance to declare — retro-marked 2026-08-21 -->
