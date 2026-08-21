# KICKOFF — I-phase: BUILD `/meta-orchestrator` skill

> **Type:** I-phase execution (skill code). Output = `.claude/skills/meta-orchestrator/` directory + helpers + templates + integration into `install.sh`. **NOT** R-phase, **NOT** review, **NOT** strategy decision.
> **Origin:** R-phase verdict 2026-05-23 — [`docs/meta-factory/research-patches/2026-05-23-meta-orchestrator-prior-art.md`](../../../docs/meta-factory/research-patches/2026-05-23-meta-orchestrator-prior-art.md). Verdict: **BUILD on CC primitives, REFERENCE 9 upstream sources, ADOPT-VOCABULARY 3**. Two cold-reviewers GO independently (Reviewer #1 in `meta-orchestrator-prior-art/state.md`; Reviewer #2 in `meta-orchestrator-cold-review-2/` — chain-composition test ≈8-10% vs 40% threshold confirmed BUILD).
> **Deliverable:** ONE capability commit + working `.claude/skills/meta-orchestrator/` + dogfood evidence. Patch §5 skeleton is the binding plan.
> **Authoritative for:** the I-phase BUILD wave acceptance criteria + sub-wave decomposition + traps + Class-C declaration. **NOT authoritative for:** the SKILL.md content itself (you write that) · project goal (see [`README.md#why-this-exists`](../../../README.md)) · the existing `~/.claude/skills/orchestrator/` (agent-uncommittable; do NOT touch).

---

## §0 Cold-start context

You did NOT see the R-phase session. Cold start. Read in this order before any edit:

1. [`docs/meta-factory/research-patches/2026-05-23-meta-orchestrator-prior-art.md`](../../../docs/meta-factory/research-patches/2026-05-23-meta-orchestrator-prior-art.md) — 284 lines. §1 verdict table, §2 composite, §3 leapfrog, **§4 integration sketch (binding for §4.1 filesystem + §4.2 frontmatter + §4.3 body section map)**, **§9 SSOT block (paste-ready)**.
2. [`.claude/orchestrator-prompts/meta-orchestrator-prior-art/kickoff.md`](../meta-orchestrator-prior-art/kickoff.md) — **§7 (lines 73-end) is the BINDING contract** with 14 sub-sections. **All 14 must be addressed in the shipped SKILL.md.**
3. [`docs/meta-factory/prior-art-evaluations.md`](../../../docs/meta-factory/prior-art-evaluations.md) — SSOT register; rows #64/#65 already settled (SP `subagent-driven-development`, SP `using-git-worktrees`); #66+ to be claimed by this commit (subject to §2 collision-resolution below).
4. [`.claude/rules/build-first-reuse-default.md`](../../rules/build-first-reuse-default.md) §3-§5 — per-commit recording-layer for capability commits.
5. [`.claude/rules/no-paid-llm-in-ci.md`](../../rules/no-paid-llm-in-ci.md) §1-§2 — hard constraint: zero API-billed calls. `!shell` injections are deterministic bash, OK. The skill itself runs in-session.
6. [`.claude/rules/ai-laziness-traps.md`](../../rules/ai-laziness-traps.md) §2 (T1, T3, T7, T11, T15, T16, T19) — load-bearing for §5 below.
7. [`.claude/rules/doc-authority-hierarchy.md`](../../rules/doc-authority-hierarchy.md) §2-§3 — SKILL.md will need an Authoritative-for header + Class declaration.
8. [`.claude/rules/dual-implementation-discipline.md`](../../rules/dual-implementation-discipline.md) §3 — consumer-facing default is dual-channel; deviation requires explicit rationale.
9. Reviewer #2's verdict findings (relayed here, see §6.5 below) — 1 MAJOR + 5 MINOR that this kickoff bakes in.

The existing global `~/.claude/skills/orchestrator/SKILL.md` covers ≈70% of meta-orchestration via Queue mode. It is **agent-uncommittable, owner=maintainer**. Do NOT modify it. This wave ships a NEW project-scope skill at `.claude/skills/meta-orchestrator/` that closes the four §7.14 named gaps (plan-actuality / cross-umbrella priority / launch-table / stage-gate vs flat-queue) via a single-invocation slash-command entry point that calls into the existing orchestrator workflow.

---

## §1 Discovery (already done — values for substitution)

You are working in `/Users/art/code/rules-as-tests-aif`. Discovery cache from orchestrator session:

| Var | Value |
|---|---|
| `WORKDIR` | `/Users/art/code/rules-as-tests-aif` |
| `BASE_BRANCH` | **`staging`** (default branch since 2026-05-22 trunk migration; auto-merge enabled, `ci-success` aggregate required check) |
| `REMOTE` | `origin` (`github.com/lee-to/rules-as-tests-aif`) |
| `GH_REPO` | infer from `git remote get-url origin` |
| `COMMIT_FORMAT` | `<type>(<scope>): описание` — Conventional Commits with optional Russian description. Examples: `feat(meta-orchestrator): add ...`, `feat(n8-c1): SSOT-existence arm ...` |
| `COMMIT_LANG` | EN subject; RU/EN description acceptable per recent history |
| `PKG_MANAGER` | `pnpm` (workspaces) |
| `CHECK_ALL` | **`make self-audit`** (verified via `Makefile` — runs pre-commit + pre-push + principles-meta-tests). `pnpm run check:all` does NOT exist in this repo — do not invoke. Sub-aggregates: `npm --prefix packages/core run test:principles` for principle-level checks |
| `PR_BASE_FOR_THIS_WAVE` | **`staging`** (NOT `main` — `main` is prod, manual promote only) |

**Worktree (mandatory):** create one before any edit. Skill at `~/.claude/skills/orchestrator/SKILL.md` mandates this for any new wave; SP `using-git-worktrees` is the upstream-of-record (SSOT #65) — its Step-0 detection makes it compatible with CC `isolation:"worktree"`.

```bash
git fetch origin
git worktree add ../rules-as-tests-aif-meta-orchestrator-iphase staging
cd ../rules-as-tests-aif-meta-orchestrator-iphase
git checkout -b feat/meta-orchestrator-build
```

---

## §2 SSOT pre-flight — resolve #66+ collision (MAJOR fix from Reviewer #2)

**MAJOR finding from cold-review #2 (independent + verified):** both this wave's #66–#70 block AND the N8 A-phase findings file claim "rows #66+". Landing order is not fixed. The kickoff resolves this **mechanically** — you check the SSOT tail at commit-authoring time and renumber if needed. Do NOT skip this step; do NOT defer to "maintainer coordination".

**Required pre-flight sequence (before any file edit in `.claude/skills/`):**

```bash
# Step 1: read current SSOT tail
LAST_ROW=$(grep -nE "^\| [0-9]+ \|" docs/meta-factory/prior-art-evaluations.md \
  | tail -1 | sed -E 's/^[0-9]+:\| ([0-9]+) .*/\1/')
echo "Current SSOT tail: #${LAST_ROW}"
NEXT_ROW=$((LAST_ROW + 1))
echo "First free row: #${NEXT_ROW}"
```

**Step 2: decision tree:**

- If `LAST_ROW = 65` (no N8 wave landed since R-phase) → paste R-phase patch §9 block verbatim at #66–#70.
- If `LAST_ROW > 65` AND N8 A-phase rows already landed at #66+ → **renumber the entire R-phase patch §9 block** to start at `NEXT_ROW`. Renumber sequentially: e.g. if `NEXT_ROW=68`, block becomes #68–#72. **Edit the leading IDs in `| 66 |` → `| ${NEXT_ROW} |` etc. before paste.** Verify zero collisions: `grep -nE "^\| ${NEXT_ROW} \|" docs/meta-factory/prior-art-evaluations.md` must return empty before paste.
- If `LAST_ROW > 65` AND N8 rows are at unrelated IDs (gap exists) → paste at first contiguous free 5-row block ≥ `NEXT_ROW`.

**Step 3:** when authoring the capability commit (§7 below), the `Prior-art:` trailer references the ACTUAL row IDs landed (#66–#70 or renumbered range). Do NOT hard-code "#66–#70" into the trailer until §2 resolves.

---

## §3 Sub-wave decomposition (Mode B × N worktrees if parallel)

Per R-phase patch §5 skeleton, the BUILD decomposes into **4 sub-waves**. Strongly prefer sequential single-worktree execution unless explicit parallel signal — these sub-waves share `SKILL.md` and helper scripts; concurrent edits create merge work that outweighs throughput.

| Sub-wave | Scope | Files produced | Estimated LOC |
|---|---|---|---|
| **A** | SKILL.md frontmatter (§4.2) + `### §0 Invocation` + `### §1 Plan-currency check` + `### §2 Priority` | `.claude/skills/meta-orchestrator/SKILL.md` (partial), `helpers/plan-currency-check.sh`, `helpers/priority-score.sh` | ~200-300 |
| **B** | SKILL.md `### §3 Launch-table` + `### §4 Meta-kickoff write` + `templates/meta-kickoff.template.md` + `templates/state.md.template` + `helpers/launch-table-generator.sh` | SKILL.md (extended), 3 new files | ~250-350 |
| **C** | SKILL.md `### §5 Dispatch tree` + `### §6 Stage gates` + `### §7 Reviewer dispatch` | SKILL.md (extended) | ~200-300 |
| **D** | SKILL.md `### §8 Anti-scope` + `### §9 Dogfood test` + `### §10 Output` + `### §11 Failures` + integration into `install.sh` payload + **dogfood-test evidence file** at `.claude/orchestrator-prompts/meta-orchestrator-iphase/dogfood-run-output.md` | SKILL.md (final), **`skills/meta-orchestrator/` (mirror at repo root — see note below)**, `install.sh` (~5 lines), evidence file | ~150-250 |

**install.sh integration — CRITICAL non-obvious path detail (verified via `install.sh:138-152` source read):** `install.sh` copies skill payloads FROM `$PKG_ROOT/skills/<name>/` (repo-root `skills/` directory) TO consumer `.claude/skills/<name>/`. Existing precedents: `skills/rules-as-tests/`, `skills/tool-bootstrapping/`. The skill is authored at **`.claude/skills/meta-orchestrator/`** (project-use path inside this repo). For consumer installation to work, **mirror the skill at repo-root `skills/meta-orchestrator/`** (use a symlink OR a synced copy — match how existing skills are arranged; verify via `ls -la skills/`). Add a ~5-line block to `install.sh` following the `tool-bootstrapping` pattern (NOT a 1-line addition — verify by reading the existing block). Validate the install path in Sub-wave D by running `bash install.sh --dry-run` (or equivalent) and confirming the meta-orchestrator skill appears in the planned copy targets.

**Capability commit pattern:** **ONE atomic capability commit** at end of Sub-wave D, after all four sub-waves' work integrated. Per [`CLAUDE.md` Capability commit definition](../../../CLAUDE.md): ≥80 LOC anywhere under packages/ is a capability commit, but this wave is under `.claude/skills/` — still a capability by spirit (new subdirectory + ≥50 LOC under `packages/core` not applicable here, but the spirit applies: trailer required). The trailer references the SSOT rows landed in §2 pre-flight.

**Sequencing:** A → B → C → D in single worktree. If parallel needed (only on explicit maintainer instruction), split worktrees A+C (independent SKILL.md sections + independent helpers) from B+D (B depends on §3/§4 written; D depends on all prior).

---

## §4 §7 spec binding — what to produce, section-by-section

Per R-phase patch §4.3 (the binding mapping table). Each §7 sub-section → a SKILL.md section. Read R-phase patch §4.3 verbatim before authoring each section — it specifies CC primitive + new logic per row.

**Key non-obvious points** (do NOT regenerate these from scratch — they're decisions made by R-phase):

- **§4.2 frontmatter** — copy verbatim from R-phase patch §4.2 yaml block. Includes `name: meta-orchestrator`, `arguments: [umbrella]`, `argument-hint: "[umbrella-name]"`, `disable-model-invocation: true`, `model: opus`, `allowed-tools` list. **MINOR-5 from Reviewer #2:** `disable-model-invocation: true` ALSO prevents preload into subagents per current `skills.md` — this is desired (subagents shouldn't self-invoke meta-orchestrator). Verify still true at live skills.md WebFetch (see §6 below) before shipping.
- **MINOR-1 from Reviewer #2:** current `skills.md` documents a `shell:` frontmatter field (accepts `bash`/`powershell`, default `bash`). NOT in R-phase patch §4.2 sketch. Since you use `bash` throughout, default applies — do NOT add `shell:` to frontmatter unless you discover a `!shell` block needs explicit shell declaration. Document the decision in commit body.
- **§7.2 plan-currency check** — `!shell` injects `git status` + `gh pr list --search "is:open"` + `cat docs/meta-factory/wave-sequencing-plan.md` + `ls .claude/orchestrator-prompts/<umbrella>/`. The skill BODY then performs drift detection: compare wave-sequencing-plan claims vs live PR state. Emit «План актуален» OR drift list with file:line pointers to stale claims.
- **§7.3 priority resolution** — multi-criteria scorer in `helpers/priority-score.sh`. Inputs: candidate umbrellas (from `ls .claude/orchestrator-prompts/`). Scoring axes per [`phase-research-coverage.md §1.12`](../../rules/phase-research-coverage.md): blocks-other-waves × give-back-value × size-fit × maintainer-prefs. Output: ranked list with one-line rationale per candidate.
- **§7.4 launch-table** — Mode A/B/SDD/Queue decision rules in `helpers/launch-table-generator.sh`. Columns: sub-wave name · mode · stage · parallel-sibling · volume (NOT time). Inputs: sub-wave count + sub-wave types (R-phase / execution-build / wiring / manual-liveness).
- **§7.5 meta-kickoff authoring** — `Write` tool from `${CLAUDE_SKILL_DIR}/templates/meta-kickoff.template.md`. **Mandatory sections:** §5 AI-traps (principle 12 requires explicit T-enumeration, not blanket-reference — see §5 below for the traps the skill itself enforces in generated kickoffs), stage-gate rules as ACTUAL `gh pr list --search 'is:merged head:<branch>'` commands, recursive-self-application clause, stop-conditions per stage.
- **§7.7 stage-gate semantics** — `!shell` injection for `gh pr list --search 'is:merged head:<branch>'`. The skill body asserts: «if Stage N's PR is not merged → halt; do NOT dispatch Stage N+1». **Class-C compromise acknowledged** (§9 below) — this is prose enforcement; the `!shell` surfaces the data but does not block the AI from ignoring it. Same pattern as [`parallel-subwave-isolation.md §4`](../../rules/parallel-subwave-isolation.md) acceptable Class C.
- **§7.8 reviewer hand-off** — `Agent` tool dispatch with SP `requesting-code-review` template + project [`reviewer-discipline.md §2`](../../rules/reviewer-discipline.md) discipline (surfaces decisions, doesn't pick strategy).
- **§7.11 recursive self-application (dogfood test)** — the FIRST live invocation of this skill MUST run on **this very BUILD umbrella** and produce a valid launch-table for the BUILD wave itself. Capture the output to `.claude/orchestrator-prompts/meta-orchestrator-iphase/dogfood-run-output.md`. Failure to produce coherent launch-table = principle 12 violation = blocks the capability commit.

---

## §5 AI-laziness traps active (T-enumeration, NOT blanket-reference)

Per [`ai-laziness-traps.md §3`](../../rules/ai-laziness-traps.md): kickoff must **enumerate** T-numbers and add ≥1 domain-specific trap.

### Active canonical traps

- **T1 «3 examples, all clean, category done»** — when verifying §4.3 binding table is satisfied, do NOT sample 3 SKILL.md sections and declare done. ALL 14 sub-sections need explicit verify trace.
- **T3 «plausible finding without verification»** — every claim in REPORT (file:line, exit code, grep output) must be backed by actual command output. No prose-only «I added §X».
- **T4 «closing prematurely»** — sub-wave is done when ALL acceptance criteria in §6 below are checked, not when «felt complete». Specifically: dogfood test (§7.11) is the hard gate.
- **T7 «follow-prompt-literally»** — when this kickoff instructs `Step 1: read R-phase patch §4.2`, do that literally; do not paraphrase §4.2 from memory. R-phase decisions are binding.
- **T11 «design without prior-art check»** — R-phase already did the prior-art sweep. Do NOT re-litigate. If you notice a missed candidate mid-build, ADD it as `research-patches/2026-MM-DD-meta-orchestrator-followup-<gap>.md` and surface to maintainer; do NOT silently incorporate.
- **T15 «self-application skipped»** — §7.11 dogfood is the recursive self-application proof. Skipping it = §13 anti-pattern. Hard gate.
- **T16 «pattern-matching on name»** — when integrating an SP skill (e.g. `requesting-code-review` for §7.8), explicitly verify upstream-problem-class vs ours. R-phase patch §3 leapfrog table did this for design verdicts; you re-verify at integration code-write time.
- **T19 «handoff without own cold-QA»** — before declaring sub-wave D complete and inviting capability commit, run your OWN adversarial cold-review of the diff against §6 acceptance criteria. CI green ≠ design substance verified.

### Domain-specific traps (this BUILD specifically)

- **T-MOB-A «`!shell` injection blind ADOPT»** — assuming `!shell` syntax works identically across `arguments:`-bearing skills as it does in slash-commands. Counter: WebFetch live `code.claude.com/docs/en/skills.md` (see §6) and verify `!shell` is documented in **skills frontmatter context**, not only in slash-commands context. R-phase Surface 5 cited skills.md — confirm at build-time.
- **T-MOB-B «`gh pr list --search` semantic gotcha»** — `--search "is:merged head:<branch>"` returns ALL merged PRs ever with that head; if branch is reused, count is wrong. Counter: include `base:<expected-base>` and limit by `created:>=<R-phase-commit-date>`.
- **T-MOB-C «orchestrator skill collision»** — global `~/.claude/skills/orchestrator/` IS NOT this wave's target. Editing it = scope violation + agent-uncommittable file. Counter: every Write/Edit path must START with `.claude/skills/meta-orchestrator/` or sibling repo paths. NEVER `~/.claude/`.
- **T-MOB-D «Class-A claim drift»** — tempting to claim the skill is Class A («it's an executable artifact!») when actually most §7 sub-sections are Class C prose enforcement (per Reviewer #2 §5b). Counter: declare Class explicitly per `doc-authority-hierarchy.md §3` Class field convention. See §9 below.

---

## §6 Pre-flight falsifier check (Reviewer #2 MINOR-1 + R-phase falsifier)

**Before authoring SKILL.md frontmatter,** run live falsifier check:

```bash
# Falsifier 1: skills.md contract drift between 2026-05-23 and now
# (R-phase patch §2 falsifier: "wrong if Anthropic ships a bundled equivalent")
```

1. **WebFetch** `https://code.claude.com/docs/en/skills.md` — verify these 5 fields/mechanisms still present and semantics intact:
   - `arguments:` frontmatter field
   - `argument-hint:` field
   - `disable-model-invocation:` field (incl. subagent-preload implication)
   - `${CLAUDE_SKILL_DIR}` env var
   - `!shell` injection syntax (`` !`<command>` `` and ` ```! ` fenced block)
2. **WebSearch ≥3 phrasings** for bundled CC equivalent:
   - «claude code marketplace meta-orchestrator skill 2026»
   - «claude code bundled wave-sequencing orchestrator slash command»
   - «anthropic claude code skill meta orchestrator plan preflight 2026»
3. If contract changed OR bundled equivalent appeared → **STOP**, write `research-patches/2026-MM-DD-meta-orchestrator-falsifier-fired.md`, surface to maintainer, do NOT proceed to BUILD.

### §6.5 Reviewer #2 findings baked into this kickoff

For traceability — the 1 MAJOR + 5 MINOR from cold-review #2 are addressed at these points:

| Finding | Severity | Addressed in |
|---|---|---|
| SSOT ID #66+ collision with N8 A-phase | MAJOR | §2 above — mechanical check-and-renumber |
| New `shell:` frontmatter field not in patch §4.2 | MINOR-1 | §4 key-points + §6 falsifier check |
| /tmp/ REJECT evidence ephemeral | MINOR-2 | §10 below — promote to research-patch at commit-authoring time |
| Class-C profile not declared in I-phase skeleton | MINOR-3 | §9 below — explicit Class declaration + ast-test-drop precedent cite |
| `addyosmani/agent-skills /ship` deferred SSOT row may never land | MINOR-4 | §7 below — decision rule at commit-authoring |
| `disable-model-invocation: true` subagent-preload implication | MINOR-5 | §4 key-points — desired behavior, confirm at falsifier check |

---

## §7 Capability commit acceptance criteria

ONE atomic capability commit at end of Sub-wave D. The commit MUST satisfy:

1. **Trailer required:** `Prior-art:` trailer referencing the actual landed SSOT row IDs from §2 pre-flight (e.g. `Prior-art: prior-art-evaluations.md#66 (AI Factory REFERENCE — vocab match, structural mismatch on §7.14 gaps), #67 (aif-handoff REJECT — structural T16 mismatch), #68 (OhMyOpencode REFERENCE+ADOPT-VOCABULARY), #69 (Bernstein REFERENCE — DAG model), #70 (ComposioHQ REFERENCE — PR-readiness signal vocab)`).
2. **Subject:** `feat(meta-orchestrator): build /meta-orchestrator skill on CC primitives` or similar (single concern; Conventional Commits).
3. **Body** includes: §1.7 forward-check (compliance with no-paid-llm-in-ci, BFR, doc-authority, ai-laziness-traps, reviewer-discipline, dual-implementation, channel-selection — name each rule and cite section); §1.7 backward-check (supersedes nothing; extends existing global orchestrator skill workflow).
4. **`addyosmani/agent-skills /ship` SSOT row (MINOR-4 decision rule):** IF the actual SKILL.md §6/§7 ships with explicit GO/NO-GO synthesis shape adopted from `/ship` THEN add a 6th SSOT row at the next free ID; ELSE document the non-adoption in commit body and DO NOT add a row.
5. **REJECT-evidence promotion (MINOR-2 from Reviewer #2):** before commit, copy `/tmp/meta-orch-survey-6-state-of-art.md` REJECT section into `docs/meta-factory/research-patches/2026-MM-DD-meta-orchestrator-prior-art-reject-log.md` (append-only audit trail). Cite in commit body footnote. **Fallback if `/tmp` is gone (likely — `/tmp` is ephemeral across sessions; I-phase runs in a fresh session):** create the reject-log file with a header noting the scratchpad was lost during session boundary, then manually reconstruct the REJECT list from R-phase patch §1 row 6 evidence column + §9 footer (APM `sdi2200262/agentic-project-management`, GitHub Agentic Workflows, LangGraph / CrewAI / AutoGen, cross-domain CI orchestrators / PM tools). **Do NOT pre-check `[x]` in the PR body for this item if the reconstruction came from the patch rather than the scratchpad** — mark it as «reconstructed from patch» in the file header and use `[x] verified: reconstruction from R-phase patch §1+§9` to make the provenance honest.
6. **§7.14 named-gaps closure declaration:** explicitly state in commit body which of the 4 named gaps each landed §-section closes.

---

## §8 Verify (run all, attach output to REPORT)

After Sub-wave D, before commit:

```bash
# 1. Structural
ls .claude/skills/meta-orchestrator/                              # SKILL.md + helpers/ + templates/ present
wc -l .claude/skills/meta-orchestrator/SKILL.md                   # ~600-1000 LOC expected
head -30 .claude/skills/meta-orchestrator/SKILL.md                # frontmatter + Authoritative-for + Class lines visible

# 2. Frontmatter sanity (parse yaml)
sed -n '/^---$/,/^---$/p' .claude/skills/meta-orchestrator/SKILL.md | head -25

# 3. SKILL.md body sections (per R-phase patch §4.3 body section map)
grep -c "^### §[0-9]" .claude/skills/meta-orchestrator/SKILL.md     # ≥12 named sections (§0 Invocation through §11 Failures)
# Additional sanity: cross-references TO R-phase kickoff §7 spec acknowledged
grep -c "§7\." .claude/skills/meta-orchestrator/SKILL.md             # ≥4 cross-refs to binding spec (not a hard gate; style signal)

# 4. SSOT row block landed
grep -nE "^\| (66|6[7-9]|70) \|" docs/meta-factory/prior-art-evaluations.md  # all 5 rows present
# OR (if renumbered per §2)
grep -nE "^\| ${NEXT_ROW} \|" docs/meta-factory/prior-art-evaluations.md     # first row of block

# 5. Helpers executable
test -x .claude/skills/meta-orchestrator/helpers/plan-currency-check.sh     # exit 0
test -x .claude/skills/meta-orchestrator/helpers/priority-score.sh
test -x .claude/skills/meta-orchestrator/helpers/launch-table-generator.sh

# 6. Helpers shellcheck-clean
shellcheck .claude/skills/meta-orchestrator/helpers/*.sh                    # 0 errors

# 7. Dogfood test evidence
ls .claude/orchestrator-prompts/meta-orchestrator-iphase/dogfood-run-output.md  # exists, non-empty

# 8. Project checks
make self-audit                                                   # all green; runs pre-commit + pre-push + principles-meta-tests (per Makefile). If a check fails, fix root cause — no skip flags. `pnpm run check:all` does NOT exist; do not invoke

# 9. Commit trailer — AUTHOR DISCIPLINE GATE (not mechanically enforced for .claude/skills/ — see step #10 note)
git log -1 --format="%B" | grep "^Prior-art:"                     # trailer present; this is the ACTUAL gate for trailer presence (manual grep, not pre-push)

# 10. Pre-push hook (no false guarantee)
git push --dry-run                                                # IMPORTANT: pre-push detectCapabilityReason() in packages/core/hooks/checks/prior-art.ts triggers on (a) new dep in package.json, (b) new file ≥50 LOC under NEW packages/core/<dir>/, (c) new file ≥80 LOC under packages/. A .claude/skills/ addition triggers NONE of these. The dry-run will pass even WITHOUT a Prior-art: trailer. Step #9 is the actual trailer check, by author discipline. Use dry-run only to verify non-trailer hook checks (commitlint, schema gates) pass
```

**Acceptance:** all 10 must pass. ANY failure → fix; do not declare done.

---

## §9 Class declaration (Reviewer #2 MINOR-3 — recursive-self-application gap fix)

This SKILL.md is a **discipline-bearing artefact**. Per [`doc-authority-hierarchy.md §3`](../../rules/doc-authority-hierarchy.md) and the precedent at [`research-patches/2026-05-23-ast-test-drop-honest-accounting.md`](../../../docs/meta-factory/research-patches/2026-05-23-ast-test-drop-honest-accounting.md): SKILL.md MUST declare Class per sub-section profile.

**Format note (no prior SKILL.md precedent in this repo):** [`doc-authority-hierarchy.md §3`](../../rules/doc-authority-hierarchy.md) explicitly scopes the `> **Class:**` field to `.claude/rules/*.md` files; existing shipped SKILL.md files (`skills/rules-as-tests/SKILL.md`, `skills/tool-bootstrapping/SKILL.md`) carry NO Class field. This declaration **extends** the Class-field convention to SKILL.md by analogy — the substance is honest enforcement-profile disclosure; the format is a new application of an existing rule-file convention. Precedent for the *substance* of the Class-C-compromise reasoning: [`parallel-subwave-isolation.md §4`](../../rules/parallel-subwave-isolation.md) (acceptable Class C with documented compensating mechanism) + [`research-patches/2026-05-23-ast-test-drop-honest-accounting.md §4`](../../../docs/meta-factory/research-patches/2026-05-23-ast-test-drop-honest-accounting.md) (the honest-accounting pattern this declaration mirrors). Document this format-extension decision in the I-phase commit body so future SKILL.md authors can decide whether to adopt.

**Declared profile (write into SKILL.md `> **Class:**` line, first line of blockquote header):**

> **Class:** B (mixed): §0/§7.1 + §7.10 + §7.12 = Class A (CC primitive enforces structurally — slash-command exists or not, file written or not, frontmatter parses or not). §7.5 = partial Class A via principle 12 test enforcing §5 AI-traps section presence in generated kickoffs. §7.2/§7.3/§7.4/§7.6/§7.7/§7.8/§7.9/§7.11/§7.13 = **Class C** (prose-only enforcement; AI can ignore `!shell` injected data and proceed; acceptable per [`parallel-subwave-isolation.md §4`](../../rules/parallel-subwave-isolation.md) precedent and [`research-patches/2026-05-16-readme-absolutism-vs-class-c-practice.md`](../../../docs/meta-factory/research-patches/2026-05-16-readme-absolutism-vs-class-c-practice.md) maintainer-owned tension). **Re-promotion triggers per Class C:** ≥2 stage-gate-ignored incidents within 6 months → consider mechanical post-hoc check (commit-on-branch-B-only-if-PR-on-branch-A-merged via pre-push hook).

This declaration is **mandatory** — it's the SKILL.md's honest enforcement profile, not theatre.

---

## §10 §1.7 forward+backward note (self-check, mandatory)

Per [`phase-research-coverage.md §1.7`](../../rules/phase-research-coverage.md) — every discipline-bearing artefact ships with this section in the commit body (NOT in SKILL.md prose).

**Forward-check (this BUILD complies with):**
- `no-paid-llm-in-ci.md §1` — skill runs in-session; `!shell` is deterministic bash; zero API-billed calls in CI.
- `build-first-reuse-default.md §3-§5` — R-phase patch executed BFR §3 mechanism (6-surface sweep); this commit lands the per-commit recording-layer (SSOT block + trailer).
- `doc-authority-hierarchy.md §2-§3` — SKILL.md has Authoritative-for header + Class field per §9 above.
- `ai-laziness-traps.md §3` — kickoff §5 enumerates T1/T3/T4/T7/T11/T15/T16/T19 + 4 domain T-MOB-A...D; principle 12 test will validate the kickoff format.
- `reviewer-discipline.md §2` — skill's §7.8 reviewer hand-off respects strategy-fork-surface discipline.
- `dual-implementation-discipline.md §3` — single-channel (CC slash-command) is acceptable since CC-only consumer pattern dominates today; deferred decision marker per §3 deviation-accountability if portable agent fallback added later.
- `rule-enforcement-channel-selection.md §3-§4` — slash-command is deterministic trigger; not memory/semantic.
- `phase-research-coverage.md §1.11` — verify against source-of-truth (live `gh pr list`, not session memory) is the skill's §7.7 core.

**Backward-check (sweep of existing artefacts under new rule's scope):**
- `grep -n "meta-orchestrator" docs/meta-factory/prior-art-evaluations.md` — before this commit: 0 hits; after: 5 hits (or renumbered range).
- `grep -n "meta-orchestrator" .claude/rules/*.md` — before/after: 0 hits; no rule supersedes.
- `grep -n "meta-orchestrator" packages/core/principles/*.test.ts` — before/after: 0 hits; no principle test affected (principle 12 validates kickoff format, generic; not skill-specific).
- `grep -n "meta-orchestrator" agents/*.md` — before/after: 0 hits; no AI-agnostic agent supersedes.
- Existing `~/.claude/skills/orchestrator/SKILL.md` — UNTOUCHED (agent-uncommittable; this skill calls it, doesn't replace).

---

## §11 PR pattern (Phase 4 of orchestrator skill)

After commit + verify all 10 (§8):

```bash
git push -u origin feat/meta-orchestrator-build
gh pr create --base staging --head feat/meta-orchestrator-build \
  --title "feat(meta-orchestrator): build /meta-orchestrator skill on CC primitives" \
  --body "$(cat <<'EOF'
## Что сделано
- `.claude/skills/meta-orchestrator/SKILL.md` + helpers (plan-currency-check / priority-score / launch-table-generator) + templates (meta-kickoff / state.md)
- SSOT rows #<actual range> in `docs/meta-factory/prior-art-evaluations.md` per R-phase patch §9
- Dogfood evidence: `.claude/orchestrator-prompts/meta-orchestrator-iphase/dogfood-run-output.md`
- /tmp REJECT evidence promoted to `docs/meta-factory/research-patches/2026-MM-DD-meta-orchestrator-prior-art-reject-log.md`

## Как проверить
- [x] `make self-audit` green (pre-commit + pre-push + principles-meta-tests) — **verified: CI**
- [x] SSOT rows landed at #<range>, no collision — **verified: grep**
- [x] §7.14 four named gaps closed (plan-actuality / cross-umbrella priority / launch-table / stage-gate) — **verified: SKILL.md §1/§2/§3/§6 sections**
- [x] Dogfood test ran + `dogfood-run-output.md` non-empty (file-existence, executor-verifiable) — **verified: `ls` + `wc -l`**
- [ ] Dogfood output coherent on this BUILD umbrella itself (§7.11) — **owner: maintainer, post-PR review of launch-table substance**
- [x] Class B (mixed) declared honestly per §9 — **verified: SKILL.md header line**
- [x] Live falsifier check at WebFetch skills.md — contract unchanged — **verified: §6 pre-flight output**
- [ ] First real-world invocation (`/meta-orchestrator <some-real-umbrella>`) produces useful output — **owner: maintainer, post-merge runtime verification**

## Scope-out (separate work)
- `/ship`-style GO/NO-GO synthesis adoption decision (MINOR-4) — deferred to first real invocation
- Portable agent fallback (`agents/meta-orchestrator-portable.md` per dual-implementation §3) — deferred; CC-only acceptable today
EOF
)"
```

**Base = `staging`** per discovery (NOT `main`). Auto-merge eligible via `ci-success` aggregate.

---

## §12 Anti-scope (what this wave does NOT do)

- ❌ Do NOT modify `~/.claude/skills/orchestrator/SKILL.md` (agent-uncommittable, owner=maintainer).
- ❌ Do NOT add npm dependencies. Substrate stays bash + markdown + CC primitives + existing `gh` CLI. (BFR §1 + dual-implementation §1 substrate-purity.)
- ❌ Do NOT write paid-LLM CI calls (`no-paid-llm-in-ci §2`). `!shell` is deterministic bash — that's the line.
- ❌ Do NOT open additional PRs mid-wave. If you notice an adjacent systemic issue (e.g. «principle 12 test could be sharper»), surface as observation in REPORT — do NOT autonomously branch off. (`CLAUDE.md` PR strategy.)
- ❌ Do NOT re-litigate R-phase verdicts. If a candidate looks missed, write `research-patches/2026-MM-DD-meta-orchestrator-followup-<gap>.md` for maintainer review.
- ❌ Do NOT skip §7.11 dogfood. It's the principle-12 hard gate.
- ❌ Do NOT skip §2 SSOT pre-flight. Renumber mechanically; do not "ask maintainer".
- ❌ Do NOT use `git reset --hard` (banned project-wide per memory + project convention).

---

## §13 Stop conditions

- §6 falsifier check fires (contract drift OR bundled equivalent) → STOP, write findings, surface to maintainer.
- Any §8 verify step fails after 2 fix attempts → STOP, surface specific failure with command output.
- Dogfood test (§7.11) produces incoherent launch-table → STOP, debug; this is a hard gate.
- §2 SSOT pre-flight reveals >5-row gap or non-contiguous free range — STOP, ask maintainer for ID allocation strategy.
- Any temptation to edit `~/.claude/skills/orchestrator/` → STOP (T-MOB-C); the path is agent-uncommittable.

---

## §14 Output format (REPORT)

When all sub-waves done, verify passed, commit landed, PR opened:

```text
## I-phase REPORT — /meta-orchestrator BUILD

### Files
- .claude/skills/meta-orchestrator/SKILL.md (<LOC>)
- .claude/skills/meta-orchestrator/helpers/{plan-currency-check,priority-score,launch-table-generator}.sh
- .claude/skills/meta-orchestrator/templates/{meta-kickoff,state.md}.template
- install.sh (~5-line block per `tool-bootstrapping` precedent — see §3)
- skills/meta-orchestrator/ (mirror at repo root for install.sh `$PKG_ROOT/skills/` payload path)
- docs/meta-factory/prior-art-evaluations.md (5 new rows at #<range>)
- docs/meta-factory/research-patches/2026-MM-DD-meta-orchestrator-prior-art-reject-log.md
- .claude/orchestrator-prompts/meta-orchestrator-iphase/dogfood-run-output.md

### SSOT block landed at
#<actual range> (resolved per §2 pre-flight: <was at LAST_ROW=N, renumbered to ...>)

### §8 Verify trace
1. ls — [output]
2. wc -l SKILL.md — [N] lines
3. frontmatter parse — [OK]
... (all 10)

### §7.14 named gaps closure
- plan-actuality: SKILL.md §1 (helpers/plan-currency-check.sh)
- cross-umbrella priority: SKILL.md §2 (helpers/priority-score.sh)
- launch-table: SKILL.md §3 (helpers/launch-table-generator.sh)
- stage-gate vs flat-queue: SKILL.md §6 (`!shell` `gh pr list --search`)

### §7.11 dogfood evidence
- Output captured at .claude/orchestrator-prompts/meta-orchestrator-iphase/dogfood-run-output.md
- Self-consistency: launch-table for THIS wave produced [coherent / incoherent because <X>]

### Class declaration
- SKILL.md Class: B (mixed) — see §9 of kickoff

### Commit
- SHA: <git rev-parse HEAD>
- Subject: feat(meta-orchestrator): build /meta-orchestrator skill on CC primitives
- Prior-art trailer: [verbatim]

### PR
- URL: <gh pr view --json url -q .url>
- Base: staging
- Auto-merge: <enabled / not>

### DECISIONS LOG
- §2 SSOT collision resolved as <verbatim>
- T-MOB-A `!shell`-in-skills verified at WebFetch — <pass / drift / which delta>
- `/ship` SSOT row decision (MINOR-4): <added / not added; rationale>
- `shell:` frontmatter field decision (MINOR-1): <default bash / explicit>
- <any other call I made>

### ATTN (decisions for maintainer)
- [list, or "нет"]

### Confidence
- high / medium / low — with reason
```

---

## §15 See also

- [R-phase patch (binding spec)](../../../docs/meta-factory/research-patches/2026-05-23-meta-orchestrator-prior-art.md)
- [R-phase kickoff §7 (functional spec source-of-truth)](../meta-orchestrator-prior-art/kickoff.md)
- [Cold-Reviewer #2 kickoff (informs §6.5 baked-in findings)](../meta-orchestrator-cold-review-2/kickoff.md)
- [BFR rule](../../rules/build-first-reuse-default.md) · [no-paid-LLM-in-CI](../../rules/no-paid-llm-in-ci.md) · [AI-laziness traps](../../rules/ai-laziness-traps.md) · [doc-authority](../../rules/doc-authority-hierarchy.md) · [reviewer-discipline](../../rules/reviewer-discipline.md) · [dual-implementation](../../rules/dual-implementation-discipline.md) · [channel-selection](../../rules/rule-enforcement-channel-selection.md) · [phase-research-coverage](../../rules/phase-research-coverage.md) · [parallel-subwave-isolation](../../rules/parallel-subwave-isolation.md) (Class C precedent)
- [Principle 12 (AI-laziness-traps test)](../../../packages/core/principles/12-ai-laziness-traps.test.ts) — validates §5 T-enumeration format in kickoffs

<!-- host-verify: none — legacy closed umbrella (done.md): work already accepted; no live host acceptance to declare — retro-marked 2026-08-21 -->
