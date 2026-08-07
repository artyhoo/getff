<!-- scope:meta-orchestrator-stage-5-dogfood -->
# Stage 5 dogfood — first `/meta-orchestrator` invocation on real backlog (2026-05-26)

> **Authoritative for:** Stage 5 dogfood findings — §1 substrate invocation trace, §2 routing decision walk, §3 N=1 coherence call, §4 T19 cold-review of own §1-§3, §5 substrate bugs / UX gaps surfaced during the run (severity + repro + 1-line proposed fix scope, NO fixes applied), §6 §1.7 Forward-check applied, §7 §1.7 Backward-check applied.
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists). Substrate spec — see [`.claude/skills/meta-orchestrator/SKILL.md`](../../../.claude/skills/pipeline/SKILL.md). Bug fixes — surfaced in §5 only, follow-up PRs out of scope per [feedback_no_drive_by_prs](../../../CLAUDE.md).

> **Origin:** kickoff `.claude/orchestrator-prompts/meta-orchestrator-mode-triage-and-planner/stage-5-dogfood-kickoff.md` (Option A canonical: 1-liner emitted by dispatching orchestrator, fresh CC tab Worker session executed the protocol). Dogfood validates substrate built by PRs #239/#240/#241/#242/#243 (Stages 2A/2B/2C/3) + PR #244 (Stage 4 — override flags).

---

## §1 Substrate invocation trace

All command outputs captured verbatim in `/tmp/stage-5-dogfood-outputs/` during the run; key excerpts inline below.

### §1.1 — Step 1: `plan-currency-check.sh` (no-arg autonomous-discovery mode)

```bash
bash .claude/skills/meta-orchestrator/helpers/plan-currency-check.sh 2>&1
```

Exit 0. Notable output:

```text
=== plan-currency-check: umbrella='' ===
--- git status (short) ---
--- branch + ahead/behind ---
feat/meta-orch-stage-5-dogfood
0	0
--- fetch + cross-check vs origin/staging (fresh-PR detector — Gap-2 round-2 follow-up) ---
commits on origin/staging not in HEAD: 0
--- open PRs (json) ---
[]
--- reverse-currency (L2 extension — reality → plan): UNTRACKED entries ---
UNTRACKED-244: merged PR #244 "feat(meta-orchestrator-stage-4): CLI override flags --mode-*" not referenced in wave-sequencing-plan.md
UNTRACKED-243: merged PR #243 ...
[... 22 more UNTRACKED entries ...]
```

24 UNTRACKED merged PRs surfaced (real signal: `wave-sequencing-plan.md` has not been updated for PRs #214 through #244, spanning the entire `meta-orchestrator-mode-triage-and-planner` umbrella). The no-arg path's L1+L2 work as designed.

### §1.2 — Step 2: `priority-score.sh`

```bash
bash .claude/skills/meta-orchestrator/helpers/priority-score.sh 2>&1
```

Exit 0. Observed output schema:

```text
=== priority-score: candidate umbrellas ===
* kickoff=missing
=== priority-score: synthetic candidates (L1 extension) ===
memory-codify-feedback_harness_merge_block_and_500line_gate type=memory-followup kickoff=synthetic source=memory
memory-codify-feedback_ai_doc_research_priority_pool type=memory-followup kickoff=synthetic source=memory
wave-plan-N2 type=plan-followup kickoff=synthetic source=wave-plan
[... 31 more synthetic candidate rows ...]
todo-packages/core/eslint-rules/require-otel-span.ts-60 type=code-todo kickoff=synthetic source=code-todo
```

**Real-kickoff surface returned exactly one phantom row `* kickoff=missing`** — root cause traced to bash glob expansion at `helpers/priority-score.sh:62` (`for dir in "${PROMPTS_DIR}"/*/`). When `.claude/orchestrator-prompts/` has no umbrella subdirectories (true in any fresh worktree because the dir is `.gitignore`d save for `README.md`), `nullglob` is not set → the `*/` pattern expands to the literal `*/` → loop runs once with `name=*`, `kickoff=*/kickoff.md` (not present) → emits `* kickoff=missing`. Synthetic L1-extension surface emitted 33 valid candidate rows.

### §1.3 — Step 2a: candidate-id extraction

The kickoff §3 Step 2a awk recipe:

```bash
mapfile -t CANDIDATE_IDS < <(awk 'NF && $1 !~ /^#/ { print $1 }' /tmp/stage-5-priority-score.out | sort -u)
```

**Failed twice during this run.** Observed schema includes lines starting with `===` (section headers) and `*` (the phantom from §1.2) — neither filtered by the kickoff's awk recipe. Worker adjusted to:

```bash
awk 'NF && $1 !~ /^#/ && $1 !~ /^===/ && $1 != "*" { print $1 }' | sort -u
```

Second issue: `mapfile` is bash 4+; macOS ships bash 3.2 — `command not found: mapfile`. Worker fell back to `CANDIDATE_IDS=( $(awk … | sort -u) )` (POSIX-array assignment, bash 3.2-compatible).

After the two fixes, extraction produced 34 candidate ids:

```text
memory-codify-feedback_ai_doc_research_priority_pool
memory-codify-feedback_harness_merge_block_and_500line_gate
openq-§13-10
[... 31 more ...]
wave-plan-N8
```

### §1.4 — Step 3: `delta-diff.sh`

```bash
DELTA=.claude/orchestrator-prompts/_master-backlog-delta.json
bash .claude/skills/meta-orchestrator/helpers/delta-diff.sh "$DELTA" "${CANDIDATE_IDS[@]}" 2>&1
```

Exit 0. JSON file did not exist (`ls -la "$DELTA"` → `No such file or directory`). Per `delta-diff.sh:23+:53-:68` first-run semantics (B3 fix clarification in kickoff §3 Step 3): missing JSON + ids present → all ids emit as `NEW-SINCE-LAST`. Observed: 34 lines, one `NEW-SINCE-LAST: <id>` per candidate. Contract honoured.

### §1.5 — Step 3a: `launch-table-generator.sh`

```bash
bash .claude/skills/meta-orchestrator/helpers/launch-table-generator.sh "meta-orchestrator-mode-triage-and-planner" 2>&1
```

Exit 0. Single-line output:

```text
MISSING kickoff: .claude/orchestrator-prompts/meta-orchestrator-mode-triage-and-planner/kickoff.md
```

Same root cause as §1.2 phantom-row: the worktree's `.claude/orchestrator-prompts/` is gitignored, so the umbrella dir does not exist on disk in the worktree even though it exists in the dispatching session's main repo. Per kickoff §9 line 481 caveat («§3a is a hard gate step BUT may not auto-parse every kickoff»), Worker did NOT treat this as HARD FAIL.

### §1.6 — Step 4: L1→L5 routing walk on `TOP_UMBRELLA`

Per kickoff §3 Step 4 literal: `TOP_UMBRELLA="${CANDIDATE_IDS[0]:-}"` → `memory-codify-feedback_ai_doc_research_priority_pool` (alphabetical-first of sorted-unique 34-element array). **Note:** this is NOT a SKILL.md §2 priority-scored winner — see §5 finding M1.

```bash
# L2 — dup-detect
bash .claude/skills/meta-orchestrator/helpers/dup-detect.sh "$TOP_UMBRELLA" 2>&1
```

Output: `MISSING: memory-codify-feedback_ai_doc_research_priority_pool no kickoff.md found`. Exit 0. Per SKILL.md §2.5 Step 2 («`MISSING:` → drift item») this is correct semantics — synthetic ids ARE drift items.

```bash
# L3 — classify-work
bash .claude/skills/meta-orchestrator/helpers/classify-work.sh \
  ".claude/orchestrator-prompts/$TOP_UMBRELLA/kickoff.md" 2>&1
```

Output:

```text
TYPE: fix
DISPATCH: direct-Edit
LOC: 1
SURFACES: 1
RATIONALE: LOC=1≤5, SURFACES=1≤1 → small/mechanical tier (SDD fix)
```

Exit 0. **Silent false-positive** — see §5 finding J1.  Source of the fabricated numbers traced to [`classify-work.sh:25-44`](../../../.claude/skills/pipeline/helpers/classify-work.sh#L25-L44): the helper has a file-vs-string fallback that treats a non-existent path as a literal description string. For the input `.claude/orchestrator-prompts/memory-codify-feedback_ai_doc_research_priority_pool/kickoff.md` (1 whitespace-free token), word-count = 1 → `LOC = 1/6 = 0` → clamped to `1`. SURFACES = 1 (the `.md` extension matches the `[a-zA-Z0-9._/-]+\.(ts|tsx|js|sh|md|yml|yaml|json)` regex on the same path-string). Routing then runs `LOC=1 ≤5 AND SURFACES=1 ≤1` → `fix`.

```bash
# L5 — assign-skill (advisory)
bash .claude/skills/meta-orchestrator/helpers/assign-skill.sh "fix" \
  "memory codify feedback ai doc research priority pool" 2>&1
```

Output: `recommended_agent: agents/memory-codification-auditor.md`. Exit 0. Reasonable keyword match («memory» → memory-codification-auditor); independent of the L3 false-positive.

### §1.7 — Step 4b: `parse-override-flags.sh` (Stage 4 deliverable)

```bash
bash .claude/skills/meta-orchestrator/helpers/parse-override-flags.sh \
  "$TOP_UMBRELLA --mode-solo --reason=dogfood-exercise-of-stage-4-flag-parsing" 2>&1
```

Output:

```text
OVERRIDE_MODE=SOLO
OVERRIDE_REASON=dogfood-exercise-of-stage-4-flag-parsing
```

Exit 0. Stage 4's `--mode-solo` flag parsed correctly; `OVERRIDE_REASON` captured the `--reason=` value. Schema matches `packages/core/hooks/parse-override-flags.test.ts:97-109` expectation. **Stage 4 deliverable works on this 1-flag invocation** (single-flag, no paired-negative test exercised here).

### §1.8 — Step 5: meta-kickoff + state.md writes

Files produced via Write tool:

- `.claude/orchestrator-prompts/memory-codify-feedback_ai_doc_research_priority_pool-meta-launch/kickoff.md` — 157 lines, all 12 substituted placeholders honoured per [`.claude/skills/meta-orchestrator/references/placeholders.md`](../../../.claude/skills/pipeline/references/placeholders.md). `{{T_TRAP_ENUMERATION}}` enumerated 5 canonical traps (T3/T14/T15/T16/T20); `{{DOMAIN_TRAPS}}` defined `T-MEMORY-CODIFY-A` per principle 12 §5 obligation.
- `.claude/orchestrator-prompts/memory-codify-feedback_ai_doc_research_priority_pool-meta-launch/state.md` — 64 lines, all 21+ substituted placeholders per template.

Both paths gitignored (`git status --short` empty after write; `git check-ignore` confirms). Substrate `_plan-cache.md` + `_master-backlog-delta.json` also gitignored — T-MMT-5-C cleanup verified clean.

### §1.9 — Step 6: plan-cache + delta-JSON write-back

```bash
bash .claude/skills/meta-orchestrator/helpers/update-cache.sh "no-arg" "Stage 5 dogfood: ..." 2>&1
# Output: update-cache.sh: fresh cache written at .../.claude/orchestrator-prompts/_plan-cache.md
# Exit 0.

# jq-rewrite of _master-backlog-delta.json (per kickoff §3 Step 6b)
# Then metadata-only helper:
bash .claude/skills/meta-orchestrator/helpers/update-delta.sh "no-arg" "Stage 5 dogfood: 34 ids tracked, RESOLVED=0 (first invocation)" 2>&1
# Output: update-delta.sh: updated .../.claude/orchestrator-prompts/_master-backlog-delta.json (umbrella=no-arg, head=fbe1bf0)
# Exit 0.
```

Post-rewrite JSON: 34 `untracked_seen` entries (each `{id, first_seen: 2026-05-26T15:46:02Z}`), 0 `closed_since_last` entries (first invocation). Schema honoured per [`references/master-backlog-delta.md`](../../../.claude/skills/pipeline/references/master-backlog-delta.md).

---

## §2 Routing decision

Following SKILL.md §2.5 + §5 mechanically for `TOP_UMBRELLA = memory-codify-feedback_ai_doc_research_priority_pool`:

| Step | Predicate | Observed value | Source |
|---|---|---|---|
| L1 | candidate surfaced by priority-score | yes — alphabetical-first of 34 synthetic candidates (per kickoff §3 Step 4 literal `${CANDIDATE_IDS[0]:-}`) | §1.6 / [`priority-score.sh:135-188`](../../../.claude/skills/pipeline/helpers/priority-score.sh) (synthetic emitter for memory-codify type) |
| L2 | dup-detect | `MISSING:` (= drift item per SKILL.md §2.5 Step 2 [line 175](../../../.claude/skills/pipeline/SKILL.md#L175)) | §1.6 / [`dup-detect.sh`](../../../.claude/skills/pipeline/helpers/dup-detect.sh) |
| L3 | classify-work TYPE | `fix` (**false-positive from string-mode fallback** — see §5 J1; cited [`classify-work.sh:25-44`](../../../.claude/skills/pipeline/helpers/classify-work.sh)) | §1.6 helper output |
| L4 | I-phase vs R-phase | N/A — classified as `fix` (per SKILL.md §2.5 Step 5 routing tree [line 197-209](../../../.claude/skills/pipeline/SKILL.md#L197)) | derived from L3 |
| L5 | assign-skill | `recommended_agent: agents/memory-codification-auditor.md` (advisory) | §1.6 helper output |
| L5 routing tree (SKILL.md §2.5 Step 5) | `TYPE == "fix"`; `sibling_count >= 3 AND bundle_opt_in` ? | `sibling_count = 1` (zero other `fix`-classified active candidates this invocation); `bundle_opt_in = false` (no `--mode-bundle`) → **Mode = DIRECT** | SKILL.md §2.5 Step 5 [line 199-201](../../../.claude/skills/pipeline/SKILL.md#L199) |
| Step 6 ALIAS | DIRECT → `direct-Edit` (TYPE=fix AND sibling_count<3) | confirmed | SKILL.md §2.5 Step 6 [line 215](../../../.claude/skills/pipeline/SKILL.md#L215) |
| Stage 4 override | `--mode-solo --reason=...` parsed → `OVERRIDE_MODE=SOLO, OVERRIDE_REASON=...` (this would re-route to SOLO/Mode-A per Step 6 ALIAS [line 217](../../../.claude/skills/pipeline/SKILL.md#L217) IF applied) | §1.7 helper output |

**Chosen Mode (substrate-determined, no override applied to final dispatch): DIRECT (`direct-Edit` per Step 6 ALIAS)**. With Stage-4 override `--mode-solo` (exercised in §1.7), the verdict would become SOLO/Mode-A — but the override path was exercised in §1.7 as a helper-test, not as a real dispatch flag.

---

## §3 Coherence call

**Scope of this call:** does substrate behaviour on THIS dogfood invocation match SKILL.md §5 routing tree? **Single observation; N=1; no generalisation per T-MMT-5-B.**

**Mechanical coherence:** YES — the helpers each exited 0 with output matching their published schemas, the routing-tree predicate evaluation followed SKILL.md §2.5 Step 5 line-by-line, and the Step 6 ALIAS table mapped the predicate result (TYPE=fix + sibling_count<3 + !bundle_opt_in) to DIRECT/`direct-Edit` exactly as [SKILL.md §2.5 Step 6 line 215](../../../.claude/skills/pipeline/SKILL.md#L215) prescribes. Stage 4's `parse-override-flags.sh` parsed the test flag correctly.

**Semantic coherence:** **NO**. The Mode-DIRECT verdict is mechanically consistent but semantically wrong because:

1. The L3 TYPE=fix classification (`LOC=1, SURFACES=1`) is a **string-mode-fallback false-positive** (see §1.6 + §5 J1). The umbrella's actual scope is undefined (synthetic id, no kickoff on disk) — it cannot be a 1-LOC mechanical fix.
2. The cascade L3→L5→ALIAS produced a coherent-looking output BECAUSE the helpers each handle missing inputs by silently falling back to defaults that compose into a plausible routing — not because the substrate examined real evidence.
3. The Stage 4 override `--mode-solo` rescues the routing semantically only if applied; the bare no-arg `/meta-orchestrator` invocation would emit Mode=DIRECT here.

**Verdict for THIS invocation only:** substrate behaved coherently in the mechanical sense (every helper followed its contract) but the cascade produced a misleading routing because the input was a synthetic L1-extension candidate without an on-disk kickoff. Substrate works on THIS top-item-from-this-invocation in the narrow sense; substrate **does NOT generalise** to «works on synthetic discovery items» per T-MMT-5-B.

---

## §4 T19 cold-review findings (Worker re-reads own §1-§3 cold)

Re-read §1-§3 as if produced by an unknown third-party tool. Anomalies surfaced:

- **A1 (no-finding):** §1.1-§1.9 each have a verbatim command + observed output + exit code + file:line citations to helper source where claims are made. T3 plausible-finding-without-verification: nothing prose-only spotted.
- **A2 (no-finding):** §2 routing-table cites SKILL.md §2.5 step line numbers for each predicate transition. T20 inline-verdict-without-evidence: every routing cell has an evidence column or a §1.x backref.
- **A3 (caveat, properly disclosed):** §3 coherence call distinguishes mechanical vs semantic coherence; explicitly states «N=1 not generalised» per T-MMT-5-B. Coverage caveat per T14 (clean dogfood + N=1 → finding is «coverage insufficient to conclude substrate works in general», NOT «substrate works»). Properly framed.
- **A4 (mild concern):** §2 routing table cell «sibling_count = 1 (zero other `fix`-classified active candidates this invocation)» is asserted but NOT mechanically verified by running classify-work over all 34 candidates. This is a Worker-judgment call from looking at the candidate-id list (memory-codify items semantically distinct from openq / todo / wave-plan synthetic types); a stricter substrate would compute sibling_count deterministically. Noting as a substrate-gap candidate (see §5 N2) rather than amending §2 — Worker is doing what the substrate's L5 step does NOT.
- **A5 (mild concern):** §1.6 RATIONALE quote («LOC=1≤5, SURFACES=1≤1 → small/mechanical tier (SDD fix)») copies the helper's output verbatim. Re-checked against `classify-work.sh:74-77` — text matches. Self-quote integrity verified.
- **A6 (T16 check):** §2's «sibling_count = 1» judgment was almost a pattern-match-on-name (one memory-codify-* among many synthetic-type candidates → «only 1 fix»). Re-verified function-class: openq/todo/wave-plan synthetics would ALSO classify TYPE=fix if pushed through the same broken string-mode fallback (LOC≈0-1, SURFACES≈1 for any path-string input). True sibling_count under the broken fallback is closer to 34, not 1. **Amended in §5 as additional severity datum on J1.**

**T19 verdict:** §1-§3 hold up. One concrete amendment (A6) is folded into §5 J1's reproduction notes. No fabricated citations detected; no «would detect» prose found. Verdict: **GO** with §5 J1 expanded.

---

## §5 Bugs / UX gaps surfaced (severity + repro + 1-line proposed fix scope; NO fixes applied)

Each item: **severity** (BLOCKER/MAJOR/MINOR) + reproduction command + proposed fix scope. Per [feedback_no_drive_by_prs](../../../CLAUDE.md): observations only, follow-up PRs out of scope for this dogfood PR.

### J1 — MAJOR — `classify-work.sh` silent false-positive on non-existent kickoff path

**Severity:** MAJOR (substrate-cascade-poisoning — false routing produced silently for any synthetic L1 candidate that has no on-disk kickoff; affects ≥4 synthetic types).

**Repro:**

```bash
bash .claude/skills/meta-orchestrator/helpers/classify-work.sh \
  ".claude/orchestrator-prompts/this-path-does-not-exist/kickoff.md"
# Returns TYPE=fix, DISPATCH=direct-Edit, LOC=1, SURFACES=1 — silently, exit 0
```

**Root cause:** [`classify-work.sh:25-44`](../../../.claude/skills/pipeline/helpers/classify-work.sh#L25-L44) file-vs-string detection treats a non-existent path as a literal description string. Word-count of the bare path-string = 1 → LOC clamped to 1; `.md` suffix matches SURFACES regex → SURFACES=1; tier-1 boundary `LOC≤5 AND SURFACES≤1` matches → false `fix`. **Under this fallback, ALL ~30 synthetic candidate ids of this run would also classify as `fix`** (per §4 A6) — the broken sibling_count semantics under this fallback compounds the bug.

**Proposed fix scope (1-line):** when INPUT contains `/` AND ends in `.md`/`.ts`/`.tsx`/etc. AND `[[ ! -f INPUT ]]` → emit `MISSING-FILE: <path>` to stderr + exit non-zero; reserve string-mode fallback for inputs that don't look like file paths.

### J2 — MAJOR — `priority-score.sh` phantom `* kickoff=missing` row when prompts dir is empty

**Severity:** MAJOR (pollutes candidate list with non-id row that fails the kickoff's `awk` extraction; Worker had to add 2 filter clauses).

**Repro:**

```bash
mkdir -p /tmp/empty-prompts && touch /tmp/empty-prompts/README.md  # mimic gitignored worktree state
REPO_ROOT=/tmp PROMPTS_DIR=/tmp/empty-prompts \
  bash .claude/skills/meta-orchestrator/helpers/priority-score.sh
# Section "candidate umbrellas" emits a single line: "* kickoff=missing"
```

**Root cause:** [`priority-score.sh:62`](../../../.claude/skills/pipeline/helpers/priority-score.sh#L62) `for dir in "${PROMPTS_DIR}"/*/`. Without `shopt -s nullglob`, an unmatched `*/` glob expands to the literal `*/` → loop body runs once with `name=*`.

**Proposed fix scope (1-line):** `shopt -s nullglob` at top of helper (bash-specific; helper already uses `#!/usr/bin/env bash` so safe), OR guard the loop with `compgen -G "${PROMPTS_DIR}/*/" > /dev/null || { … return; }`.

### J3 — MINOR — kickoff §3 Step 2a `mapfile` not portable to macOS bash 3.2

**Severity:** MINOR (cosmetic — Worker easily fell back to array assignment; doesn't affect substrate itself).

**Repro:**

```bash
bash --version  # 3.2 on macOS
bash -c 'mapfile -t FOO < <(echo "a"; echo "b"); echo "${#FOO[@]}"'
# bash: line 1: mapfile: command not found
```

**Root cause:** kickoff prescribed `mapfile -t` (bash 4+). macOS ships bash 3.2 by default.

**Proposed fix scope (1-line):** update kickoff §3 Step 2a recipe to use POSIX array assignment `CANDIDATE_IDS=( $(awk … | sort -u) )` (Worker's actual workaround). Substrate code is unaffected.

### J4 — MINOR — kickoff §3 Step 4 `${CANDIDATE_IDS[0]:-}` bash-vs-zsh array indexing

**Severity:** MINOR (cosmetic — Worker easily wrapped in `bash -c`; doesn't affect substrate itself).

**Repro:**

```bash
zsh -c 'CANDIDATE_IDS=(a b c); echo "[0]=${CANDIDATE_IDS[0]} [1]=${CANDIDATE_IDS[1]}"'
# [0]= [1]=a   (zsh is 1-indexed; index 0 is empty)
bash -c 'CANDIDATE_IDS=(a b c); echo "[0]=${CANDIDATE_IDS[0]} [1]=${CANDIDATE_IDS[1]}"'
# [0]=a [1]=b
```

**Root cause:** Worker session shell is `zsh` (macOS default); kickoff assumed bash array semantics.

**Proposed fix scope (1-line):** wrap the §3 Step 4 block in `bash -c '...'` OR use `${CANDIDATE_IDS[@]:0:1}` slice form (portable to both shells).

### J5 — MAJOR — `launch-table-generator.sh` produces no rows in fresh worktrees (same root as J2 family)

**Severity:** MAJOR (gates the whole §3 Launch-table path in SKILL.md; in fresh worktrees / clones, no umbrella is dispatchable through the substrate-as-shipped).

**Repro:**

```bash
git worktree add ../tmp-wt origin/staging
cd ../tmp-wt
bash .claude/skills/meta-orchestrator/helpers/launch-table-generator.sh "any-umbrella-name"
# MISSING kickoff: .claude/orchestrator-prompts/any-umbrella-name/kickoff.md  (exit 0)
```

**Root cause:** worktrees do NOT inherit gitignored files from the dispatching workdir. `.claude/orchestrator-prompts/` is gitignored except for `README.md`; therefore every umbrella subdirectory is absent in a fresh worktree.

**Proposed fix scope (1-line, two options):** (a) document in SKILL.md §0 that Worker sessions in fresh worktrees must `cp -r <main>/.claude/orchestrator-prompts/<umbrella> .claude/orchestrator-prompts/` before invoking helpers (workaround at procedure-level); OR (b) un-gitignore the `<umbrella>/kickoff.md` files only (keep `_plan-cache.md` / `_master-backlog-delta.json` / `<umbrella>-meta-launch/` gitignored) so worktrees inherit them.

### N1 — MINOR — kickoff §3 Step 4 `TOP_UMBRELLA="${CANDIDATE_IDS[0]:-}"` ≠ SKILL.md §2 priority-scored winner

**Severity:** MINOR (kickoff-design gap, not substrate bug). The kickoff falls back to alphabetical-first instead of applying SKILL.md §2's multi-criteria scoring (axes: blocks-other-waves×3, give-back-value×2, size-fit×1, maintainer-prefs×2). The dogfood therefore validates the L3-L5 cascade on an arbitrary alphabetical-first candidate, not on a real priority winner. This is a property of the kickoff, not the substrate.

**Proposed fix scope (1-line):** kickoff should either inline a §2 judgment-scoring stub OR explicitly mark the literal-array-index path as «dogfood shortcut; not equivalent to SKILL.md §2 in production».

### N2 — MINOR — SKILL.md §2.5 Step 5 `sibling_count` lacks deterministic helper

**Severity:** MINOR (UX/design gap, not a bug). The routing-tree predicate `sibling_count >= 3` is left to judgment; no helper enumerates same-TYPE candidates from the same priority-score output for mechanical counting. Worker had to apply judgment in §2 («sibling_count = 1 — memory-codify items semantically distinct from openq / todo / wave-plan synthetic types»). A stricter substrate would compute this mechanically. Surfaced for design consideration only.

**Proposed fix scope (1-line):** new helper `bash .../helpers/sibling-count.sh <type> <priority-score-output-path>` that counts same-TYPE candidates from priority-score output; or amend SKILL.md §2.5 Step 5 to explicitly mark `sibling_count` as Worker-judgment with examples.

---

## §6 §1.7 Forward-check applied

This findings doc and its accompanying PR comply with these existing disciplines (checked against current `.claude/rules/*.md` content):

- `phase-research-coverage.md §1.11` (file:line: `.claude/rules/phase-research-coverage.md:73`) — every substrate-behaviour claim in §1 has a command + verbatim output excerpt + exit code; §2 routing cells cite SKILL.md line numbers; §5 each item has a verbatim repro command. No prose-only claims.
- `ai-laziness-traps.md §3` (file:line: `.claude/rules/ai-laziness-traps.md:154`) — kickoff §5 enumerated T1/T3/T7/T13/T14/T15/T16/T17/T19/T20 + domain-specific T-MMT-5-A/B/C; this findings doc honours them inline (§3 explicit N=1 framing per T-MMT-5-B; §4 T19 cold-review; §5 J1 includes the §4 A6 amendment per T16).
- `doc-authority-hierarchy.md §3` (file:line: `.claude/rules/doc-authority-hierarchy.md:54`) — this doc carries Authoritative-for + NOT-authoritative-for header at the top.
- `recommendation-laziness-discipline.md §3` (file:line: `.claude/rules/recommendation-laziness-discipline.md:22`) + parent `phase-research-coverage.md §1.12` (file:line: `.claude/rules/phase-research-coverage.md:86`) — every Mode-verdict in §2 cites SKILL.md §5 row + helper output evidence in the same turn (§2 table «Source» column).
- `parallel-subwave-isolation.md §1` (file:line: `.claude/rules/parallel-subwave-isolation.md:9`) — Worker ran in dedicated `git worktree add` at `../rules-as-tests-aif-stage-5-dogfood` per kickoff §1.
- `CLAUDE.md` PR strategy / `feedback_no_drive_by_prs` (file:line: `CLAUDE.md:87` + `CLAUDE.md:93`) — §5 surfaces bugs as observations; zero substrate fixes applied; no follow-up PRs opened in this Worker session.

## §7 §1.7 Backward-check applied

This patch validates substrate produced by these merged PRs (sweep of artefacts under scope):

- PR #239 (research/meta-orchestrator-mode-triage-prior-art, merged 2026-05-26T08:21:54Z) — prior-art survey informing Stages 2A/2B. §2 routing exercised the surfaces this prior-art justified.
- PR #240 (feat/meta-orchestrator-stage-2b-delta-persistence, merged 2026-05-26T09:35:08Z) — JSON sidecar persistence. §1.4 (`delta-diff.sh`) + §1.9 (`update-delta.sh` + manual `jq` rewrite) exercised the sidecar persistence on a first-run JSON-absent scenario.
- PR #241 (feat/meta-orch-stage-2a-discovery-surfaces, merged 2026-05-26T09:34:46Z) — 3 new L1 discovery surfaces (openq / code-todo / patch-residual). §1.2 priority-score emitted 25 openq-§13-* + 3 todo-* + 0 patch-residual entries — confirming the new surfaces fire on real repo state.
- PR #242 (feat/meta-orchestrator-stage-2c-skill-wiring, merged 2026-05-26T10:37:14Z) — wires SKILL.md §2.5 L3/L4/L5 + routing + ALIAS + principle 19. §1.6 exercised L2 + L3 + L5 + ALIAS step-by-step against SKILL.md §2.5 line citations.
- PR #243 (feat/meta-orch-stage-3-delta-read, merged 2026-05-26T13:18:07Z) — delta-diff helper + reconciliation. §1.4 confirmed first-run semantics (missing JSON → all NEW) per kickoff §3 Step 3 B3 clarification.
- PR #244 (feat/meta-orchestrator-stage-4-cli-overrides, merged 2026-05-26T14:54:28Z) — Stage 4 CLI override flags. §1.7 (Step 4b) exercised `parse-override-flags.sh "--mode-solo --reason=…"` per `parse-override-flags.test.ts:97-109` contract.
- Inter-stage Phase -1 cold-review of Stage 4 (SKILL.md §6 step 3, line 376-378): executed 2026-05-26 by dispatching orchestrator before this Worker session opened; verdict GO per kickoff §0 line 13.
- Umbrella sequence: this is the **LAST step** of `meta-orchestrator-mode-triage-and-planner`. Post-merge: orchestrator surfaces «umbrella DONE» closure summary per kickoff §6 Backward-check.
- Bundle umbrella (`meta-orchestrator-bundle-autonomous`) is independent — Stage 5 does NOT block on Bundle Stage 2 verdict.
- `.claude/rules/*.md` — none modified by this dogfood. Verified: `git diff --stat origin/staging...HEAD -- .claude/rules/` empty.
- `packages/core/principles/*.test.ts` — none modified by this dogfood. Verified: `git diff --stat origin/staging...HEAD -- packages/core/principles/` empty.
- `SKILL.md` / `.claude/skills/meta-orchestrator/helpers/*` / `.claude/skills/meta-orchestrator/templates/*` / `.claude/skills/meta-orchestrator/references/*` — none modified. Verified: `git diff --stat origin/staging...HEAD -- .claude/skills/meta-orchestrator/` empty.
