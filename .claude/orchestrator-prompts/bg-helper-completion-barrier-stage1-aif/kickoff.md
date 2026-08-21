# KICKOFF — bg-helper-completion-barrier · Stage 1 (autonomous aif dispatch, SELF-CONTAINED)

> **Type:** I-phase-small (build + TDD), single stage. Autonomous aif-handoff dispatch.
> **Base branch:** staging (NOT main). Branch off `origin/staging` (refresh first).
> **Branch name:** `feat/run-helper-wrapper`.
> **Why self-contained:** the umbrella's binding kickoff lives in gitignored `.claude/orchestrator-prompts/` and is NOT in your checkout. Everything you need is inlined below. You MAY read tracked files referenced here (`.claude/skills/...`, `.claude/rules/...`, `packages/...`).

---

## §1 Goal (one line)

Build `.claude/skills/meta-orchestrator/helpers/run-helper.sh` — a trivial bash wrapper that runs a target helper as a child and **always** appends a terminal completion trailer, so a session reading the helper's output can tell «finished (and with what exit code)» from «still running / crashed». Ship it TDD with a paired-negative test.

**Context (the bug this fixes):** the meta-orchestrator runs slow helpers (`priority-score.sh`: ~120 umbrellas × `gh`/`git`) in the background and sometimes reads their stdout file *before the child finishes*, treating a header-only partial file as «zero results». A guaranteed end-trailer makes incompleteness/crash structurally detectable.

---

## §2 What to build (binding design — do NOT deviate)

Create `.claude/skills/meta-orchestrator/helpers/run-helper.sh`. It runs its arguments as a child command and appends ONE terminal trailer line to stdout, in this exact shape:

```
=== <helper-name>: END rc=<exit-code> (lines=<stdout-line-count>) ===
```

- `<helper-name>` = basename of the first argument (the helper being run), without directory.
- `<exit-code>` = the child's actual exit status.
- `<stdout-line-count>` = number of stdout lines the child emitted (count what the wrapper forwarded).

**Reference shape (~10–15 LOC):**

```bash
#!/usr/bin/env bash
# run-helper.sh — run a helper as a child, always append an END-trailer so a
# background reader can distinguish "finished (rc=N)" from "still running".
set -uo pipefail   # NOTE: deliberately NOT `set -e` — we must reach the trailer even on child failure.

name="$(basename "${1:-helper}")"
out="$("$@")"; rc=$?            # capture child stdout + exit BEFORE anything else
lines="$(printf '%s' "$out" | grep -c '' || true)"
printf '%s\n' "$out"
printf '=== %s: END rc=%s (lines=%s) ===\n' "$name" "$rc" "$lines"
exit "$rc"
```

You may refine the line-counting / streaming approach, but you MUST satisfy every HARD CONSTRAINT below. (If you choose to stream the child's stdout live instead of capturing into a variable, that is acceptable as long as the trailer still always prints and the exit code still propagates — capturing is simpler and fine.)

### HARD CONSTRAINTS (each maps to a test or a downstream breakage)

1. **The wrapper's own output (the trailer `echo`) MUST NOT alter the child's exit status.** Capture `rc=$?` first; `exit $rc` last. Downstream tests assert `r.status).toBe(0)` for clean helpers — break exit-propagation and they fail.
2. **The trailer MUST be appended even when the child crashes / exits non-zero / dies mid-output.** This is the whole point: a per-script `echo END` at end-of-script does NOT fire on `set -e` abort / kill / timeout — the *wrapper* appends from the parent, so it fires regardless. (Do NOT instead add an `echo END` inside the child scripts — that's the dropped-as-subsumed "Layer 2".)
3. **The child's stdout MUST pass through verbatim** (before the trailer line). No reordering, no swallowing.
4. **The trailer line MUST stay `=== `-prefixed** so the existing parser filter strips it. Verify: `.claude/skills/meta-orchestrator/helpers/classify-each-candidate.sh` line ~52 is `awk 'NF>=2 && /kickoff=/ && !/^=== /'` — the `!/^=== /` clause drops any `=== … ===` line, exactly like the existing dividers at `priority-score.sh:83` and `:207`. So the trailer can never become a spurious candidate. Confirm this by reading those lines, don't assume.

---

## §3 TDD — write the test FIRST (project principle 02 / Class B paired-negative)

Put the test next to the other helper tests. Find where they live first: the existing helper tests are under `packages/core/` (e.g. `packages/core/hooks/*.test.ts` or `packages/core/principles/`). Match the existing pattern — read one neighbouring helper test (e.g. the test that runs `classify-each-candidate.sh`) to copy its `execFileSync`/spawn harness style and its assertion idiom (`r.status`, stdout matching).

**Required cases (paired positive + negative):**

- **Positive:** wrapper runs a clean child that prints known stdout and exits 0 → asserts (a) the child's stdout appears verbatim, (b) a trailing line matches `=== <name>: END rc=0 (lines=<n>) ===`, (c) the wrapper's own exit status is 0.
- **Paired-negative:** wrapper runs a child that prints partial output then exits non-zero (e.g. `exit 1`, or crashes mid-output) → asserts (a) the trailer is STILL present, (b) the trailer shows `rc=1` (the real non-zero code), (c) the wrapper propagates the non-zero exit (`r.status` ≠ 0). This is the load-bearing case: trailer-on-crash + exit-propagation.

Use small inline fixture scripts (write a temp `.sh` that the wrapper invokes, or invoke `bash -c '...'`) — don't depend on the real slow helpers for the unit test.

Run your test and PASTE the actual output (T3 — no «test passes» claim without command output):

```bash
npm --prefix packages/core test -- <your-test-file-basename> 2>&1 | tail -15
```

---

## §4 Prior-art / BFR (capability commit — MANDATORY trailer)

`run-helper.sh` is a new code module → a capability commit. Before committing:

1. Consult `docs/meta-factory/prior-art-evaluations.md` for any matching capability area (search «wrapper», «exec», «runner», «completion»).
2. Run the negative-existence check (`.claude/rules/phase-research-coverage.md §1` 6-item checklist) on the claim «no upstream run-child-and-append-exit-trailer tool is worth a dependency».
3. The BFR verdict is pre-reasoned **BUILD** — trivial bash exec-wrapper, no upstream analog worth a dep. Carry a commit trailer:

```
Prior-art: prior-art-evaluations.md — escape hatch: trivial bash exec-wrapper, no upstream analog worth a dependency (BFR BUILD, pre-reasoned).
```

(If you DO find a genuine matching SSOT entry, cite it by ID instead.)

---

## §4b §1.7 PR-body mandate (target touches `.claude/skills/**` + `helpers/` → REQUIRED)

The PR **body** (not just commit message) MUST contain, verbatim shape:

```markdown
### §1.7 Forward-check applied

<≥40 non-whitespace chars: which existing disciplines you checked>

- `build-first-reuse-default.md` — BUILD verdict; trivial bash, no upstream dep. file:line evidence: `.claude/skills/meta-orchestrator/helpers/run-helper.sh:1`
- `no-paid-llm-in-ci.md` — pure bash, zero API calls. Verdict: compliant.

### §1.7 Backward-check applied

<≥40 non-whitespace chars: sweep of existing artefacts under scope>

- `classify-each-candidate.sh` — trailer is `=== `-prefixed, already stripped by the `!/^=== /` filter; orthogonal, no regression. file:line evidence: `.claude/skills/meta-orchestrator/helpers/classify-each-candidate.sh:52`
```

**Hard rules (each has historically failed CI):**
1. Heading depth = **H3 (`###`)**, NOT H2. CI awk matches `^### §1\.7 ...`.
2. The word **«applied»** is required in each heading.
3. **≥40 non-whitespace chars** in each section body.
4. **≥1 `file:line` citation** per section, matching `[^[:space:]]+\.[a-z]+:[0-9]+`.

**Pre-flight grep BEFORE `gh pr create`:**

```bash
echo "$PR_BODY" | grep -cE '^### §1\.7 (Forward|Backward)-check applied'   # must be 2
echo "$PR_BODY" | grep -cE '[^[:space:]]+\.[a-z]+:[0-9]+'                   # must be ≥2
```

---

## §4c FORK DISCIPLINE — park-don't-guess (NON-NEGOTIABLE)

**aif agent — read this carefully.** You have no mid-implementation "pause and ask" reflex; you are tempted to *guess* on any ambiguity and proceed. For THIS task:

> On ANY genuine fork or ambiguity — two defensible implementations, an undecided design choice, a missing detail that changes behaviour (e.g. «should the trailer count stderr lines too?», «stream vs capture changes observable ordering?», «which directory do the helper tests actually live in and what's the assertion idiom?») — **do NOT pick silently** — park it as a question: set the task to `manualReviewRequired` / `blocked_external` with the fork stated as «Option A → consequence X / Option B → consequence Y», and **stop that task.** Proceed only on the unambiguous parts.

The design in §2 is binding and unambiguous on the trailer shape, exit-propagation, and parse-safety — those are NOT forks, implement them. Genuine forks are the *test-harness location/idiom* and any *streaming-vs-capture* observable-behaviour choice. When unsure whether something is a fork: it is. Park it.

Guessing a fork "to keep moving" is the exact failure this whole task exists to prevent. (This carries the project's `ask-question-reminder` fork-challenge discipline.)

---

## §5 AI-traps active (per `.claude/rules/ai-laziness-traps.md §2`)

- **T3** — no «test passes» / «parse-safe» claim without pasted command output.
- **T11** — run the §4 prior-art check before the wrapper lands, even though BUILD is pre-reasoned.
- **T15** — self-application: this wrapper exists to fix the orchestrator reading its OWN helpers. Verify the trailer shape against the REAL `classify-each-candidate.sh:52` filter, not a toy.
- **T-BGB-A (domain-specific)** — «trailer present ⇒ output complete» misread: the `END rc=0` trailer proves the child *finished + its exit code*, NOT that its work was *semantically complete* (e.g. `gh` rate-limited, exited 0, partial set). Keep that distinction in the test names / comments; do not claim the barrier guarantees content-completeness.

> Blanket «see ai-laziness-traps.md» without the enumeration above = T7 violation.

---

## §6 Done criteria (this stage)

- `run-helper.sh` exists, executable, satisfies all §2 HARD CONSTRAINTS.
- Paired-negative test exists and is GREEN (output pasted).
- The 5 existing helper tests still pass (no regression from the new file):
  ```bash
  npm --prefix packages/core test -- priority-score-branch-matcher done-md-completion-filter classify-each-candidate planner-discovery delta-diff 2>&1 | tail -15
  ```
- Capability commit carries the `Prior-art:` trailer (§4).
- PR opened against `staging` from `feat/run-helper-wrapper` with the §4b §1.7 body sections.

**OUT OF SCOPE for this stage (do NOT do):** rerouting the SKILL.md call-sites through the wrapper, adding the Layer-1 read-rule prose, foregrounding the helpers, rewriting `priority-score.sh` internals. Those are Stage 2 — a separate dispatch after a human Phase -1 review of this PR. If you find yourself editing `SKILL.md`, STOP — that's Stage 2.

---

## §7 Stop conditions

- Wrapper changes the child's exit code (breaks `toBe(0)` tests) → STOP, fix exit propagation.
- Any of the 5 regression tests fail → STOP, do not open PR.
- A genuine fork surfaces → PARK per §4c, do not guess.
- You're tempted to touch `SKILL.md` or foreground helpers → STOP (Stage 2 / out of scope).

<!-- host-verify: none — legacy closed umbrella (done.md): work already accepted; no live host acceptance to declare — retro-marked 2026-08-21 -->
