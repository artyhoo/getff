# pipeline — planning

> **Authoritative for:** the selected pipeline procedure sections below; read when routed by [the skill card](../SKILL.md).
> **NOT authoritative for:** project goal or unrelated skill modes. Commands execute from the project root unless stated otherwise.

## §1 Plan-currency check

> Runs before ANY other action. Skipping this section = T4 anti-pattern (premature closure without plan verification).

**Step 1 — inject live state:**

```!
head -200 "$(bash "${CLAUDE_SKILL_DIR}/helpers/print-orch-home.sh" 2>/dev/null)/_plan-cache.md" 2>/dev/null || echo "(no cache — fresh session; will be created by helpers/update-cache.sh on this invocation's exit)"; for f in $(ls -t "$(bash "${CLAUDE_SKILL_DIR}/helpers/print-orch-home.sh" 2>/dev/null)"/_residue-*.md 2>/dev/null | head -3); do echo "--- PreCompact residue (S2b/D8): a session compacted here. POINTER only — re-verify before acting on it: $f"; head -40 "$f"; done; for f in $(ls -t "$(bash "${CLAUDE_SKILL_DIR}/helpers/print-orch-home.sh" 2>/dev/null)"/_handoff-*.md 2>/dev/null | head -3); do echo "--- Model handoff (D15/D28): the model-authored CURRENT-STATE file of a compacted session — the SessionStart injector's payload. POINTER only — re-verify before acting on it: $f"; head -40 "$f"; done
```

```!
git status --short && echo "---" && git branch --show-current && echo "---" && git rev-list --count --left-right origin/staging...HEAD 2>/dev/null || echo "(no upstream)"
```

```!
gh pr list --search "is:open" --json number,title,state,headRefName,baseRefName --limit 20 2>/dev/null || echo "gh unavailable"
```

```!
head -400 "$(bash "${CLAUDE_SKILL_DIR}/helpers/print-plan-path.sh" 2>/dev/null)" 2>/dev/null || echo "MISSING: plan (will be created on first run — see §1 Step 3)"
```

```!
bash "${CLAUDE_SKILL_DIR}/helpers/plan-currency-check.sh" "${umbrella:-}" 2>/dev/null
```

**Step 2 — drift detection (judgment call on injected data):**

Compare the `wave-sequencing-plan.md` claims against the live `gh pr list` output:

1. For every wave marked «✅ merged» — verify a merged PR with that head branch exists in `gh pr list --state merged`. If not found → **DRIFT**.
2. For every wave marked «🟡 partial» — verify at least one open PR matches. If none → **DRIFT**.
3. For every kickoff path referenced — verify `<orch-home>/<path>/kickoff.md` exists (the `plan-currency-check.sh` output provides this; to `ls` it yourself, resolve the home first — `ls "$(bash "${CLAUDE_SKILL_DIR}/helpers/print-orch-home.sh" 2>/dev/null)/<path>/kickoff.md"`). Missing file → **STALE REF**. Never `ls` the framework literal: in a consumer install it names a directory that cannot exist, so every present kickoff reports STALE REF.
4. For every research-patch cited — verify the cited file exists under the project's research/patches dir (framework: `docs/meta-factory/research-patches/`). If the project has no such dir, skip this check. Missing (where the dir exists) → **STALE REF**.
5. **REPORT reconciliation:** if a maintainer-passed REPORT contradicts the `gh pr list` injection (e.g. REPORT says «Stage 1 merged» but `gh pr list` shows nothing), emit «REPORT says X; mechanical state shows Y; trusting `gh pr list`; possible causes: stale REPORT / pending GitHub-API sync (<60s) / different branch. Proceeding on mechanical state.» REPORT is welcome **supplementary** input, not load-bearing — mechanical state always wins (3-layer responsibility model; memory `feedback_no_human_verification_ai_self_verifies`).
6. **Cache reconciliation:** if cache (Step 1 first `!shell` block) «Last invocation» Git HEAD diverges from current `git rev-parse HEAD` AND `wave-sequencing-plan.md` was touched in the SHA diff → emit «CACHE STALE …»; cache stays supplementary, never load-bearing (T-mem-A counter — re-verify «PR merged» / «umbrella DONE» claims via `gh pr list`). Full rule + anti-patterns: [`references/plan-cache.md §2`](plan-cache.md).

**Step 3 — reconcile factual drift and emit verdict:**

- «**Plan is current**» if zero drift or stale-ref items found.
- For each mismatch, emit `DRIFT-N: <wave-name> — plan says <claim>, live evidence shows <reality>. Correction: <exact target and replacement>; evidence: <command result or file:line>.`
- **Verified factual drift → reconcile automatically, without operator acknowledgement.** This includes PR state, explicitly evidenced umbrella closure, and dated open-queue counts. A dated snapshot is historical evidence, not itself an error; refresh its current-frontier claims with a new observation date. A merged provenance/kickoff PR alone never proves umbrella completion. Apply this procedure:
  1. Verify the repository, PR base/head and affected umbrella; use live evidence rather than cache. Closure needs an explicit completion record plus verified required merges. Never infer deployment, publication or acceptance from a merged kickoff.
  2. Limit the edit to factual status/evidence and directly dependent current-frontier wording. Preserve scope, priority, admission, dependency definitions and historical decision records. Removing a proven completed item from the open list does not reorder remaining work.
  3. Read the target file immediately before editing. Require one uniquely identified row or section and an exact expected pre-image. If the pre-image changes before writing, re-read and reconcile; never overwrite concurrent work or unrelated local changes. If attribution remains ambiguous, leave that item unresolved.
  4. Apply the smallest section/row edit, inspect the diff, and re-run the affected live checks. Record corrected items and any unresolved items in the cache. Report the old/new fact and evidence to the operator as FYI; no confirmation card for verified facts.
  5. If every mismatch is corrected and re-verified, emit `Plan is current` (the existing success token) after the reconciliation FYI and continue this invocation. All dispatch, stage-merge and external-action gates still apply.
- **Unresolved drift → F1 HALT.** Missing/conflicting evidence, ambiguous attribution or a failed write/check blocks dependent priority/launch decisions. Investigate recoverable technical uncertainty first. When correction requires choosing scope, priority, admission or dependency changes, surface that specific fork through the existing advisor/maintainer route. Operator acknowledgement alone cannot make an unverified fact true; independent read-only work may continue.

**Regression scenarios (baseline: the 2026-10-07 invocation halted on verified facts):** a plan says an umbrella is open, but its explicit closure record and required merged PRs agree → update status and continue without asking; a merged kickoff exists but acceptance is unverified → keep closure unresolved; changing a dependency or choosing between tied priorities → route the decision; target content changes during reconciliation → re-read before editing.

**If the backlog plan is MISSING entirely:** skill writes a stub at the resolved plan path (`.ai-factory/orchestrator-prompts/plan.md` in a consumer) from `README.md` + `.ai-factory/DESCRIPTION.md` (if present) + the kickoff listing under the resolved orch-home, presents to the maintainer for OK, then halts until confirmed. (`EXECUTION-PLAN.md` is framework-only — do not require it.)

---

## §2 Priority

> Runs only in no-argument mode after §1 confirms plan is current (or after verified factual drift is reconciled and re-checked). Skip to §3 if `<umbrella>` was provided.

**Step 1 — inject candidate list** — _read-rule (completion barrier):_ parse a background helper's output ONLY after its `=== <helper>: END rc=<n> ===` trailer (appended by `run-helper.sh`) or its task-notification; a header-only / trailer-absent read = "still running", NOT "zero results" — never conflate one task's notification with another's. _(Origin: incident 2026-06-01, `priority-score.sh` read at header-only state → false "zero candidates".)_ This rule applies to every background-helper `!`-fence below. <!-- @dual-pair: bg-helper-completion-barrier -->

```!
bash "${CLAUDE_SKILL_DIR}/helpers/run-helper.sh" "${CLAUDE_SKILL_DIR}/helpers/priority-score.sh" "${umbrella:-}" 2>/dev/null
```

**Step 2 — score each candidate (multi-criteria, judgment):**

For each candidate umbrella from `priority-score.sh` output, assign scores on four axes:

| Axis               | Weight | Signal                                                                                         |
| ------------------ | ------ | ---------------------------------------------------------------------------------------------- |
| blocks-other-waves | 3×     | Does this umbrella's output unblock ≥1 other candidate? (check kickoff §0 for cross-wave deps) |
| give-back-value    | 2×     | Does this close a N5 give-back gap or ship a consumer-facing artifact?                         |
| size-fit           | 1×     | Smaller is preferred when score is tied (S < M < L volume signal from launch-table §3)         |
| maintainer-prefs   | 2×     | Explicit preference signals in wave-sequencing-plan §0 (e.g. «do next», «urgent», «after C-1») |

**Step 3 — emit ranked list:**

```text
Priority ranking (as of <date> <git-HEAD-short>):
1. <umbrella-A> — score <N> — rationale: <one line>
2. <umbrella-B> — score <N> — rationale: <one line>
...
```

**Step 4 — clear winner or true fork:**

- If winner score ≥ 1.5× runner-up AND no explicit maintainer override → commit: «Recommend **<umbrella-A>**, proceeding to §3 launch-table + state.md update; Stage 1 dispatch awaits maintainer confirmation per §0.» (per phase-research-coverage.md §1.12: lead with reasoned recommendation). The «confirmation gate» from §0 sits between «launch-table + state.md ready» and «actually dispatch Stage 1 worker» — not between «recommendation» and «launch-table». Updating state.md before maintainer GO is on-path; dispatching a Worker session before maintainer GO is the §8 anti-scope violation.
- If genuine tie OR strategy fork (e.g. «should we do N8 or C-1?») → **route it, do NOT pick strategy.** A priority fork changes WHAT gets built next, so it is the `intent / goal / design` class of the [`/dispatcher` §3 routing-seats table](../../dispatcher/SKILL.md) and takes that class's first move — **file an ask + `ASK` when the advisor is reachable** (`bash scripts/check-ask-files.sh --print-template consult pipeline` emits it; the same script with no arguments is the pre-push `ask-file-schema` gate). No advisor reachable = that table's `else` branch, unchanged from today: by day «DECISION-NEEDED: <A> and <B> are tied on all axes — which is the project priority?» (reviewer-discipline.md §2 pattern), at night **stay parked, never guess**. Filing an ask is not a licence to dispatch. Register target, consumer degradation and the advisor-branch asymmetries: [`references/anti-rationalization.md`](anti-rationalization.md).

**Step 4.1 — DECISION-NEEDED anti-rationalization:** a genuine maintainer answer is a _content-based tiebreaker about the umbrellas_ («pick n7 because it unblocks n8's R3»). «выбирай сам / оба норм / я устал / it's technical not strategy» = _deferred_, NOT answered → re-surface with sharper framing or propose a coin-flip; do NOT silently pick («maintainer said pick → I pick» is `#strategy-decided-by-reviewer` in disguise, reviewer-discipline.md §3). **The same test governs an advisor verdict** returned in the ask file's `## Answer`: «выбирай сам» from the advisor is a deferred ask, not an answer — re-surface there, or fall through to the maintainer branch above. Full not-an-answer list + re-surface script: [`references/anti-rationalization.md`](anti-rationalization.md).

**Step 5 — emit per arg shape (V3/V4 binding per [research-patch §3](../../../../docs/meta-factory/research-patches/2026-05-29-meta-orch-no-arg-overview-s0-remainder.md)):** fires only on no-arg/integer-arg (string-arg skips §2); Step 4 BYPASSED on V3, preserved on V4 N=1. Completion-filter = [`priority-score.sh`](../helpers/priority-score.sh) tri-layer C1/C2/C3 (branch / dup-detect **gated on frontier agreement** / done.md, [#274](https://github.com/Yhooi2/rules-as-tests-aif/pull/274)) drops DONE BEFORE filter, never after. C2 passes the dup-detect line's true `basis=xref|jaccard` through and vetoes it when [`frontier.sh`](../helpers/frontier.sh) still emits a non-empty `FRONTIER:` — a merged PR cited as provenance is not completion (#1517), unless the kickoff states the closure outright on a completion-bearing line (`Final PR:` / `Closed by:` / `Completed by:` citing the same `#<PR>`).
**V3** (no-arg / N=0) emits overview per [output-format.md §1A](output-format.md) in Wave-style grouping (ADAPT SSOT #68 OhMyOpencode `Wave N`) with `PARALLEL-OK ↔` / `↓` markers from kickoff §2 `Parallel-with`; STOP. **V4** (N ≥ 1) emits top-N after completion-filter — each = 3-line block per [output-format.md §4.1](output-format.md) + 1-liner, markers from kickoff §2 `Parallel-with`; `N=1` = old winner-recommend; `N > K` emits K + warning `Only K candidates available; you requested N.`

---

## §2.5 Dedup + classify + assign + route

> **Integration layer (no separate §7.x binding).** Runs after §2 priority winner selected (no-arg mode) OR after §1 (arg mode). Wires §7.3 (priority) → §7.4 (launch-table) via L3/L4/L5 helpers + design §5 routing tree. Skipping = T7 anti-pattern (premature dispatch without routing).

**Step 1 — read prior delta state** (context-priming; deterministic diff in Step 8; reconciliation + T-mem-A counter — [`references/master-backlog-delta.md §2`](master-backlog-delta.md)): <!-- @dual-pair: meta-orchestrator-master-backlog-delta -->

```!
_MO_DELTA="$(bash "${CLAUDE_SKILL_DIR}/helpers/print-orch-home.sh" 2>/dev/null)/_master-backlog-delta.json"
if [[ -f "${_MO_DELTA}" ]]; then
  jq -r '.untracked_seen[]?.id' "${_MO_DELTA}" 2>/dev/null || echo "(delta file present but unreadable; treat as empty)"
else
  echo "(no delta file — first invocation; will be created at end via update-delta.sh)"
fi
```

**Step 2 — L3 dup-detect + in-flight ledger** (dup-detect catches _merged_ dupes; inflight-check catches _live_ work — open PR / un-merged branch carrying the slug, e.g. a parallel session dispatching the same sub-wave before it merges). `MO_SKIP_CLOSED=1` is set on the dup-detect call so the no-arg overview `--all` scan skips the already-closed (done.md) umbrellas — otherwise the full-population glob over 250+ umbrellas overruns the 120s `!`-fence (in named mode the flag is a no-op; dup-detect stays closure-agnostic without it):

```!
MO_SKIP_CLOSED=1 bash "${CLAUDE_SKILL_DIR}/helpers/run-helper.sh" "${CLAUDE_SKILL_DIR}/helpers/dup-detect.sh" "${umbrella:-}" 2>/dev/null; bash "${CLAUDE_SKILL_DIR}/helpers/run-helper.sh" "${CLAUDE_SKILL_DIR}/helpers/inflight-check.sh" "${umbrella:-}" 2>/dev/null
```

`POTENTIAL_DUPE:`/`MISSING:` (dup-detect) → surface per [reviewer-discipline.md §2](../../../rules/reviewer-discipline.md). `INFLIGHT:` → **confirmation-needed before dispatch** (possible parallel-session collision); `CLEAR:` → proceed.

**Step 3 — L4 classify each surviving candidate from Step 2:** <!-- @dual-pair: meta-orchestrator-classify-each-candidate -->

```!
bash "${CLAUDE_SKILL_DIR}/helpers/classify-each-candidate.sh" 2>/dev/null
```

Helper iterates `priority-score.sh` candidate set; per candidate routes to classify-work.sh (file-mode for `kickoff=exists`, string-mode for `kickoff=synthetic`, skip for `kickoff=missing`). DN-3 preserved — classify-work.sh UNCHANGED. Per-candidate stdout: `--- candidate: <name> ---` + TYPE/DISPATCH/LOC/SURFACES/RATIONALE. **stderr NOT suppressed** (J1 from Stage 5): if a candidate exits 3 with `MISSING-FILE:` that is **F8 for that candidate** — recorded inline, iteration continues; collect all F8s for the §10 report per [`references/failures.md`](failures.md). Steps 5–9 below require N classifications (`sibling_count`, multi-Stage rendering, multi-id delta-diff); single-shot would break them.

**Step 4 — L5 assign-skill (OPTIONAL advisory — NOT consumed by Step 5):** emits a human-facing skill/agent hint only; the Step 5 routing tree decides Mode from the 6 predicates, **not** from this output (verified dead-output 2026-06-03, DN-8 — simplify-not-delete). Skipping has zero effect on routing.

```bash
bash "${CLAUDE_SKILL_DIR}/helpers/assign-skill.sh" "<TYPE-from-Step-3>" "<one-line description from kickoff title>" 2>/dev/null
```

Advisory output: `recommended_skill: <slug>` / `recommended_agent: <path>` / `recommended: none`.
**Step 5 — routing decision tree (judgment on injected data):**

<!-- preset short-circuit: when PRESET_MODE is set (from §0 preamble --preset or AIF_PIPELINE_PRESET), the 3 routing predicates bundle_opt_in / review_required / parallel_safe come from the preset data file, short-circuiting the routing tree. The other 3 predicates (load_bearing, sibling_count, scope_decided) still derive from the existing logic below. -->

**Preset short-circuit (A4):** if `PRESET_MODE` is present in the §0 preamble output, skip the routing tree for the 3 preset-controlled predicates (`bundle_opt_in`, `review_required`, `parallel_safe`) — they are already resolved from the preset JSON. The remaining 3 predicates (`load_bearing`, `sibling_count`, `scope_decided`) still derive from existing logic. Proceed to Step 6 with the preset-driven ALIAS (mapped from `PRESET_MODE`). For `economy` (`PRESET_MODE=whole-line-executor`), the dispatch payload carries `PRESET_AIF_MAX_REVIEW_ITERATIONS=1` per §8a Park-3 (aif auto-review capped at 1 iteration; external cold fidelity round stays mandatory).

6 predicates: `load_bearing` (paths ∩ principle-09 REQUIRED_HEADER_DOCS), `sibling_count` (same-TYPE disjoint candidates), `scope_decided` (kickoff §binding non-empty OR non-DEFER research-patch; else FALSE → RESEARCH), `parallel_safe` (explicit decl OR disjoint scopes; default=FALSE → PAIR), `bundle_opt_in` (`--mode-bundle` OR silent TRUE for fix), `review_required` (`--mode-pair` OR kickoff hint OR `load_bearing`).

```text
if TYPE == "R-phase":
    Mode = RESEARCH
elif TYPE == "fix":
    if sibling_count >= 3 AND bundle_opt_in: Mode = BUNDLE
    else: Mode = DIRECT
elif TYPE == "I-phase-small":
    if review_required: Mode = PAIR
    else: Mode = SOLO
elif TYPE == "I-phase-large":
    if not scope_decided: Mode = RESEARCH
    elif SURFACES >= 2 AND parallel_safe: Mode = DECOMPOSE
    else: Mode = PAIR
```

**Step 6 — ALIAS mapping (single source — computed AFTER routing tree; `classify-work.sh` UNCHANGED per DN-3):**

| ALIAS     | DISPATCH (internal)                                   | Fires when Step 5 resolves to                                                                                            |
| --------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| DIRECT    | direct-Edit                                           | TYPE=fix AND (sibling_count<3 OR NOT bundle_opt_in)                                                                      |
| BUNDLE    | Mode-A-bundle                                         | TYPE=fix AND sibling_count≥3 AND bundle_opt_in                                                                           |
| SOLO      | Mode-A                                                | TYPE=I-phase-small AND NOT review_required                                                                               |
| PAIR      | Mode-SDD                                              | (TYPE=I-phase-small AND review_required) OR (TYPE=I-phase-large AND scope_decided AND (SURFACES<2 OR NOT parallel_safe)) |
| DECOMPOSE | Mode-B                                                | TYPE=I-phase-large AND scope_decided AND SURFACES≥2 AND parallel_safe                                                    |
| RESEARCH  | R-phase-session (single) / Queue-mode (≥2 sequential) | TYPE=R-phase OR (TYPE=I-phase-large AND NOT scope_decided)                                                               |

1:1 with Step 5 routing tree. Principle 19 (`packages/core/principles/19-meta-orchestrator-alias-routing-consistency.test.ts`) enforces mechanically. `Mode-A-bundle` sub-dispatch defined in bundle-autonomous umbrella.

**Step 7 — emit ALIAS in §10 rendered output:** Stage heading: `### Stage N — <name> (<ALIAS> / <Mode>, ~<cost>)`. Dep-graph bullet: `├── <name>   (<ALIAS> / <Mode>, ~<cost>, <role>)`. Template update deferred to follow-up PR per `feedback_no_drive_by_prs`.
**Step 8 — delta diff:** invoke `bash ${CLAUDE_SKILL_DIR}/helpers/delta-diff.sh "$(bash ${CLAUDE_SKILL_DIR}/helpers/print-orch-home.sh 2>/dev/null)/_master-backlog-delta.json" "<id-1>" "<id-2>" "<...>"` (post-dedup ids from Steps 2-3 as positional args) → emits `NEW-SINCE-LAST: <id>` (current ∖ seen) + `RESOLVED-SINCE-LAST: <id>` (seen ∖ current), sorted; missing delta → all current = NEW; lines feed §10; factual plan corrections follow §1 Step 3 without operator acknowledgement; backlog admission and strategy changes retain their existing decision route (the historical Direction A rejection does not require acknowledgement of verified facts); semantics + contract: [`references/master-backlog-delta.md`](master-backlog-delta.md) + [`packages/core/hooks/delta-diff.test.ts`](../../../../packages/core/hooks/delta-diff.test.ts). <!-- @dual-pair: meta-orchestrator-delta-diff -->
**Step 9 — write-back to `_master-backlog-delta.json`:** `untracked_seen` ← current candidate set (overwrite-shape; `first_seen` = current ts). `closed_since_last` ← prior ids that no longer surface. Concrete `jq` shape in §10 step 5 — do NOT re-specify here.
