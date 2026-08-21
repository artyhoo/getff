# KICKOFF — bg-helper-completion-barrier · Stage 2 (autonomous aif dispatch, SELF-CONTAINED)

> **Type:** I-phase wiring, single stage. Autonomous aif-handoff dispatch.
> **Base branch:** staging. Branch off `origin/staging` (refresh first).
> The file `.claude/skills/meta-orchestrator/helpers/run-helper.sh` exists in your checkout; read it first.
> **Why self-contained:** the umbrella's binding kickoff is gitignored and not in your checkout. Everything you need is inlined. You MAY read tracked files referenced here (`.claude/skills/...`).

---

| Stage | Scope (one line) | Depends on |
|---|---|---|
| Stage 2 | route background-helper call-sites through `run-helper.sh` + Layer-1 read-rule (§1) | Stage 1 (`run-helper.sh` + test) merged to staging (PR 344) |

## §1 Goal (one line)

Route the meta-orchestrator's **background-helper call-sites** in `.claude/skills/meta-orchestrator/SKILL.md` through the now-merged `run-helper.sh` wrapper, and add the **Layer-1 read-rule** prose, so a session reading a slow helper's output waits for the `END rc=` completion trailer instead of treating a partial/header-only read as "zero results".

---

## §2 Exact edits (binding — these are NOT forks, do them as specified)

`run-helper.sh` is executable (mode 100755) and the target helpers have shebangs. Wrap form: **`bash <run-helper.sh> <helper.sh> [args]`** — the helper is passed as `$1` so the trailer name is correct. Do NOT use `run-helper.sh bash <helper>` (that yields trailer name "bash").

### Edit A — `SKILL.md` §2 Step 1 (the `priority-score.sh` `!`-fence, ~line 107)

Change:
```text
bash "${CLAUDE_SKILL_DIR}/helpers/priority-score.sh" 2>/dev/null
```
to:
```text
bash "${CLAUDE_SKILL_DIR}/helpers/run-helper.sh" "${CLAUDE_SKILL_DIR}/helpers/priority-score.sh" 2>/dev/null
```

### Edit B — `SKILL.md` §2.5 Step 2 (the `dup-detect.sh` + `inflight-check.sh` `!`-fence, ~line 178)

Change:
```text
bash "${CLAUDE_SKILL_DIR}/helpers/dup-detect.sh" "${umbrella:-}" 2>/dev/null; bash "${CLAUDE_SKILL_DIR}/helpers/inflight-check.sh" "${umbrella:-}" 2>/dev/null
```
to:
```text
bash "${CLAUDE_SKILL_DIR}/helpers/run-helper.sh" "${CLAUDE_SKILL_DIR}/helpers/dup-detect.sh" "${umbrella:-}" 2>/dev/null; bash "${CLAUDE_SKILL_DIR}/helpers/run-helper.sh" "${CLAUDE_SKILL_DIR}/helpers/inflight-check.sh" "${umbrella:-}" 2>/dev/null
```

(The §9 dogfood example invocation of `priority-score.sh` — leave it; it is illustrative, not a live call-site.)

### Edit C — Layer-1 read-rule prose

Add a short paragraph immediately after BOTH the Edit-A `!`-fence (§2 Step 1) and the Edit-B `!`-fence (§2.5 Step 2), worded:

> **Read-rule (completion barrier):** parse this helper's output ONLY after its own `task-notification` (matched by task-id) OR the presence of its `=== <helper>: END rc=<n> ===` trailer (appended by `run-helper.sh`). A header-only / trailer-absent file means "still running", NOT "zero results" — never conflate one background task's completion notification with another's. (Origin: incident 2026-06-01, `priority-score.sh` read at header-only state → false "zero candidates".)

---

## §3 Regression-verify (mandatory, paste actual output)

SKILL.md edits do not touch the helper code, so the 5 helper tests must stay green:

```bash
npm --prefix packages/core test -- priority-score-branch-matcher done-md-completion-filter classify-each-candidate planner-discovery delta-diff 2>&1 | tail -15
```

Also confirm the wrapped `!`-fence is still valid bash (no syntax error) and the `classify-each-candidate.sh:52` `!/^=== /` filter still strips the trailer (it does — trailer is `=== `-prefixed; unchanged from Stage 1).

---

## §4 Done criteria

- Both `!`-fences (§2 Step 1, §2.5 Step 2) route through `run-helper.sh` exactly as in §2.
- The Layer-1 read-rule paragraph is present after both fences.
- 5 helper tests green (output pasted).
- Commit to `staging`-based branch. (You cannot open a PR — the runtime-bridge harvest leg does that; just commit cleanly.)

**OUT OF SCOPE:** changing `run-helper.sh` itself; rewriting helper internals; foregrounding the helpers; touching the §9 dogfood example. If you find yourself editing a `.sh` helper file, STOP — Stage 2 only edits `SKILL.md`.

---

## §4c FORK DISCIPLINE — park-don't-guess (NON-NEGOTIABLE)

**aif agent:** the edits in §2 are fully specified — they are NOT forks; implement them verbatim. A genuine fork would be e.g. "SKILL.md has drifted and the exact line shown in §2 no longer matches" — if the `before` text in §2 is not found verbatim, do NOT guess a replacement: **park it as a question** (set the task to `manualReviewRequired` / `blocked_external` stating "Edit-A/B anchor text not found; SKILL.md may have drifted — Option A: <closest match> / Option B: abort") and stop. Proceed only on the edits whose anchor text matches exactly.

---

## §5 AI-traps active (per `.claude/rules/ai-laziness-traps.md §2`)

- **T3** — no "tests pass" / "fence still valid" claim without pasted command output.
- **T15** — self-application: this wires the orchestrator to read its OWN helpers correctly; verify against the real SKILL.md call-sites, not a toy.
- **T-BGB-A** — the `END rc=` trailer proves completion + exit code, NOT semantic completeness; keep that distinction in the read-rule wording (do not over-claim).

> Blanket "see ai-laziness-traps.md" without the enumeration above = T7 violation.

<!-- host-verify: none — legacy closed umbrella (done.md): work already accepted; no live host acceptance to declare — retro-marked 2026-08-21 -->
