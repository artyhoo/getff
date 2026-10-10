# pipeline — artifacts

> **Authoritative for:** the selected pipeline procedure sections below; read when routed by [the skill card](../SKILL.md).
> **NOT authoritative for:** project goal or unrelated skill modes. Commands execute from the project root unless stated otherwise.

## §9 Dogfood test

The FIRST live invocation MUST run on the BUILD umbrella that produced the skill — the recursive-self-application gate (T15 from `ai-laziness-traps.md §2`, cannot be skipped). **HARD GATE:** if the helpers produce no sub-waves (empty table), STOP and report «Dogfood gate: HARD FAIL — launch-table-generator found no sub-waves in kickoff.md»; do NOT commit; surface the trace. Full invocation steps + expected launch-table shape + coherence note: [`references/dogfood.md`](dogfood.md).

---

## §10 Output artifacts

> Specifies exactly what files this skill writes per invocation — paths, format, and cleanup policy.

**Per invocation, this skill writes:**

1. **Meta-kickoff:** `<orch-home>/<umbrella>-meta-launch/kickoff.md`
   - Template: `.agents/procedures/pipeline/templates/meta-kickoff.template.md`
   - Required sections: `## §5 AI-traps active` with explicit T-numbers; stage-gate commands; recursive-self-application clause; stop conditions per stage.
   - Validated by: `packages/core/principles/12-ai-laziness-traps.test.ts` (checks `## §5 AI-traps` presence and T-enumeration syntax).

2. **State companion:** `<orch-home>/<umbrella>-meta-launch/state.md`
   - Template: `.agents/procedures/pipeline/templates/state.md.template`
   - Filled sections: §1 Inputs (from plan-currency-check output) · §2 Decisions · §3 Phase -1 verdict (updated per stage).
   - Lifecycle: updated in-place via **Edit (section-by-section), NOT Write (full-rewrite)**. Section history preserved unless explicitly stale — replacing the whole file loses §1.1 / §1.2 prior-snapshot context that downstream sessions read. «Not append-only» means «can mutate in place», which is Edit semantics, not Write-clobber semantics. Falsifier: if the next invocation must rebuild §1 Inputs from scratch because the previous snapshot was wiped → §10 was violated.

3. **Inline session report** (not a file — written to the conversation) — emitted as a **3-layer structure**: `## Dependency graph` (Argo-style `├── / └──` ASCII tree, prospective; inter-stage edge `↓`), `## Action queue` (5-column markdown table: `Paste into a new CC tab` / `When` / `Waiting on` / `Can parallel with`), and one `### Stage N` heading per stage carrying the 1-liner `/orchestrator <umbrella> §<section> — <NL: Mode/role/autonomous?>, rest in kickoff`.
   **Named-dispatch compact (pipeline-ux Stage 2):** for `/pipeline <umbrella>` (string arg), emit the 3-layer structure bounded to ≤~15 visible lines. Drop per-step §2.5 narration and the 3-line `What it does / Deliverable / Why now` description block — report result, not process. Full compact grammar: [`references/output-format.md §1B`](output-format.md).
   **Output language (i18n):** before rendering the report, run `!bash .agents/procedures/pipeline/helpers/emit-output-strings.sh` and use the emitted `AIF_PIPELINE_*` values for the launch-table column headers, the `What it does` / `Why now` block labels, the `## Action queue` sub-caption, the wave-`NOW` marker, the plan-currency status word, and the `AIF_RECAP_MARKER` recap heading. The helper also emits `AIF_OUTPUT_LANG`: write the ENTIRE session-report PROSE in that language — descriptions, `Why now`, the plain-words recap body, and all narration — not only the table headers. Default is English; the operator's `AIF_HOOK_LANG=ru` yields `AIF_OUTPUT_LANG=ru` → write the prose in Russian. The example tables show the English (default) tokens.
   Full grammar + 4 worked examples (Mode A / SDD / Mode B × N / Queue mode) + ASCII templates live in [`references/output-format.md`](output-format.md); principle 18 (`packages/core/principles/18-meta-orchestrator-output-format.test.ts`) enforces those substrings literally in `references/output-format.md`, with SKILL.md §10 required to point at it. **Autonomous-offer (the `autonomous?` slot in the 1-liner grammar):** when the runtime-bridge is configured + aif reachable (probe per `#tabs-by-default-when-bridge-up`), each Stage block MUST present autonomous dispatch (`tsx packages/runtime-bridge/src/cli/dispatch.ts <kickoff>` in the framework repo, `tsx .claude/vendor/runtime-bridge/src/cli/dispatch.ts <kickoff>` on a consumer install — see the §5 dispatch table; contingent on the kickoff's §4c park-don't-guess block) alongside — not instead of — the maintainer-paste tab 1-liner, so the human chooses. Omitting it while the bridge is up = `#tabs-by-default-when-bridge-up`. **Dispatch chips (ADR D1/D2, stage S1 — full contract in [`references/output-format.md §9`](output-format.md)):** when `spawn_task` is invocable (runtime roster probe — never a version-sniff, never an `allowed-tools` entry), emit one chip per Stage 1-liner ALONGSIDE the paste tab and the autonomous offer, never instead of them; every chip prompt carries `Isolation first` → `In-flight probe` → `Stage-gate at click time` → cwd + kickoff path, and is rendered in full next to the chip — English verbatim, plus a short gloss in `AIF_OUTPUT_LANG` when that is not `en` — so the operator can actually inspect what a click authorizes. Probe fails → paste tabs alone, verbatim. **Launch card at the exit (plain-words-recap-v2 D7 — contract owned by [`references/output-format.md §9A`](output-format.md), never restated here):** alongside the chips, this report emits the launch card — recommended channel + arguments + plain-words explanation + ready artefacts per channel, routed by the two card questions; the operator picks (tenets 5-6, [`../rules/parallel-subwave-isolation.md §6`](../../../rules/parallel-subwave-isolation.md)).
   **§10.3a Plain-language checkpoint tail** <!-- @dual-pair: plain-language-tail --> <!-- spec: references/plain-language-tail.md + .claude/hooks/end-of-turn-reminder.sh --> — mandatory `## 🟢 In plain words` block at 3 orchestrator-checkpoint moments (sub-wave boundary / mid-session quota / final umbrella); content names orchestration artefacts (sub-wave, AC item, REPORT-trace), not per-turn personal reasoning. Full table + anti-patterns: [`references/plain-language-tail.md`](plain-language-tail.md). Falsifier: verbatim-copyable from `end-of-turn-reminder.sh` → `#two-prompts-drift`.
4. **Dogfood evidence** (first invocation only): `<orch-home>/<umbrella>/dogfood-run-output.md`
   - Contains: 4-step helper invocation outputs + coherence-call paragraph.
   - This path is gitignored in the framework repo (`.claude/orchestrator-prompts/` in `.gitignore`); a consumer's `<orch-home>` follows that project's own ignore rules — evidence for session tracing only, not repo-committed.

5. **Plan-cache + delta update:** at end of invocation, run TWO writes in this order:

   a. **Cache (existing):** `bash .agents/procedures/pipeline/helpers/update-cache.sh "<umbrella-or-no-arg>" "<outcome-one-liner>"` — helper writes `## Last invocation` only; non-«Last invocation» sections populated by direct `Edit` before invocation. Detail + helper-scope contract + anti-patterns: [`references/plan-cache.md §3`](plan-cache.md). <!-- @dual-pair: meta-orchestrator-plan-cache -->

   b. **Delta arrays (sibling-helper pattern, DN-2 B verdict 2026-05-27):** invoke `update-delta.sh` first (bootstraps schema on first run), THEN invoke `delta-write-from-state.sh` for the arrays-only rewrite. Concrete shape (`<current_ids_json_array>` and `<resolved_ids_json_array>` are angle-bracket placeholders that the rendering AI substitutes with real JSON-array literals derived from §2.5 Step 8/9; the syntax is correct only after substitution):

   ```bash
   bash .agents/procedures/pipeline/helpers/update-delta.sh "${umbrella:-no-arg}" "<outcome-one-liner>"
   bash .agents/procedures/pipeline/helpers/delta-write-from-state.sh "${umbrella:-no-arg}" '<current_ids_json_array>' '<resolved_ids_json_array>'
   ```

   The TWO sibling helpers are deliberately split: `update-delta.sh` owns metadata + fresh-template bootstrap (idempotent paired-negative test at `packages/core/hooks/update-delta.test.ts`, UNCHANGED post-F.3); `delta-write-from-state.sh` owns arrays-only rewrite (paired-negative test at `packages/core/hooks/delta-write-from-state.test.ts`, F.3 helper-collapse 2026-05-28 — sibling pattern preserves the existing update-delta.sh test contract per DN-2 B verdict). The inline `!shell` `jq` block that previously did the arrays rewrite was removed 2026-05-28 (F.3 PR #261); its function is now owned by `delta-write-from-state.sh`. **`first_seen` semantics are «most recent sighting», NOT «first-ever sighting»** — the overwrite-shape inside the helper is the bound choice (matches §2.5 Step 9 prose; simpler atomic write; trades historical-first-seen for shape simplicity). DO NOT introduce a preserve-shape variant. <!-- @dual-pair: meta-orchestrator-master-backlog-delta -->

**File cleanup policy:**

- **Lifecycle split (committed durable doc vs gitignored runtime) — SSOT #116:** `kickoff.md` is a **committed durable design doc** — git-tracked at its existing path (joins `done.md` as a `.gitignore` tracked exception), portable across machines/containers, NOT symlink-managed. `state.md` + `_plan-cache.md` + `_master-backlog-delta.json` are **gitignored regenerable runtime** — per-machine, symlink-managed by [`scripts/link-coordination.sh`](../../../../scripts/link-coordination.sh). Commit `kickoff.md` at authoring (and deliberate revisions); keep in-flight churn in `state.md`.
- `<umbrella>-meta-launch/` directory is NOT auto-deleted. It persists as the dispatch record for that umbrella's lifecycle.
- If a second invocation occurs on the same umbrella, state.md is updated; kickoff.md is preserved (not overwritten) unless `--force` arg is passed.

**Failure path:** if Write tool fails on any output artifact, skill emits a diagnostic and halts before dispatch. No partial state left unrecorded.

---

## §11 Failures

> Class C prose enforcement — `!shell` data is surfaced so AI has no excuse for ignorance; per-code trigger + required-response table lives at [`references/failures.md`](failures.md). Read once before invoking; halt + surface (never assume) on any F-code. Re-promotion trigger: ≥2 stage-gate-ignored incidents within 6 months → add pre-push hook verifying stage dependency merged before sub-wave commit.

---

## See also

- [R-phase patch (binding spec)](../../../../docs/meta-factory/research-patches/2026-05-23-meta-orchestrator-prior-art.md)
- R-phase kickoff §7 (functional spec — 14 sub-sections) — `.claude/orchestrator-prompts/meta-orchestrator-prior-art/kickoff.md` (gitignored executor reference)
- `.claude/skills/orchestrator/SKILL.md` — the queue/dispatch primitive this skill wraps. Vendored into this repo by #1420; a separate skill, wrapped and never forked. (backticked path, not a repo link — the skill ships at env depth and the link would dangle wherever it does not)
- [parallel-subwave-isolation.md §1](../../../rules/parallel-subwave-isolation.md) — worktree isolation (§5 Mode B) · [reviewer-discipline.md §2](../../../rules/reviewer-discipline.md) — reviewer role (§7)
- [no-paid-llm-in-ci.md §1](../../../rules/no-paid-llm-in-ci.md) — hard constraint on all dispatch · [ai-laziness-traps.md §3](../../../rules/ai-laziness-traps.md) — T-enumeration + [principle 12 test](../../../../packages/core/principles/12-ai-laziness-traps.test.ts)
- [SSOT rows #66-#70](../../../../docs/meta-factory/prior-art-evaluations.md) — R-phase survey evidence; [references/bundle-composition.md](bundle-composition.md) — §5.5 full spec (B1/B2/B3a)
- [references/plan-cache.md](plan-cache.md) + [references/master-backlog-delta.md](master-backlog-delta.md) — §2.5 Step 1/8 + §10 item 5
