# Umbrella: `meta-orch-no-arg-overview` — `/meta-orchestrator` no-arg UX overhaul + completion-blindspot fix + plan refresh

> **Type:** Mixed — Stage 0 = R-phase (design); Stage 1 = I-phase one-off data refresh; Stage 2 = I-phase bug fix; Stage 3 = I-phase substantive UX redesign (gated on Stage 0 verdict).
> **Authoritative for:** R-phase scope + I-phase scope for three problems surfaced 2026-05-28 user session — (a) `wave-sequencing-plan.md §0` snapshot last reconciled 2026-05-25, drift surfaced; (b) `priority-score.sh` + `dup-detect.sh` cannot detect umbrella-completion → already-shipped umbrella gets recommended; (c) no-arg path emits only a winner-recommendation, never a full-plan overview UI.
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists). The 3-layer Argo-style output format itself — see [`.claude/skills/meta-orchestrator/references/output-format.md`](../../../.claude/skills/pipeline/references/output-format.md) (extended, not redefined, by this umbrella's Stage 3). `wave-sequencing-plan.md` content authority — maintainer.

---

## §0 Problem statement

Three distinct symptoms surfaced in a single user session on 2026-05-28:

**P1 — `wave-sequencing-plan.md §0` snapshot stale.** Last reconciled 2026-05-25 ([wave-sequencing-plan.md:11](../../../docs/meta-factory/wave-sequencing-plan.md#L11)). Multiple PRs merged since (#236 meta-orchestrator-skill-memory; this branch's F.3 helper-collapse work; others). The §0 table is the SSOT for «what is the state of every wave right now» — once stale, every `/meta-orchestrator` no-arg invocation emits a DRIFT list against a stale baseline.

**P2 — `priority-score.sh` + `dup-detect.sh` cannot detect umbrella-completion.** Diagnosed by maintainer 2026-05-28:

> Хелперы `priority-score.sh` и `dup-detect.sh` не умеют проверять «а эта umbrella уже сделана?». Они смотрят только на открытые PR'ы и пересечение слов в названиях.
>
> - `open_prs=0` они трактуют как «работы нет» — но это значит «нет ОТКРЫТЫХ PR», а не «umbrella закрыта». Любая завершённая работа тоже имеет 0 открытых PR.
> - `dup-detect` ищет ссылки `#236` внутри kickoff'а — но kickoff написан РАНЬШЕ PR'а, физически не может на него ссылаться.
> - Сравнение по словам в заголовках тоже не сработало — заголовки kickoff'а это «§-1 RE-VERIFY», «§0 BFR», а название PR'а — «cache + injection + writer». Слова не пересекаются.

**Concrete incident:** session invoked `/meta-orchestrator` no-arg → 108 candidate dirs ([priority-score.sh output 2026-05-28](../../../.claude/skills/pipeline/helpers/priority-score.sh)) all surfaced with `open_prs=0` → high score assigned to already-shipped `meta-orchestrator-skill-memory` (closed by [PR #236](https://github.com/Yhooi2/rules-as-tests-aif/pull/236)) → recommended as winner.

**Maintainer-proposed mechanism (binding for Stage 2 candidate set):**

> Чего не хватает: простой матчер «branch PR'а `feat/X` ≡ umbrella `X`» — 5 строк bash, и баг бы не случился.

Reads `gh pr list --state merged --json headRefName` → strips `feat/` / `fix/` / `chore/` prefix → exact-matches against umbrella dir basename. If match found, the umbrella is excluded from candidate set (or surfaced with `status=DONE` tag).

**P3 — no-arg path lacks a «show me the whole plan» UI.** [`output-format.md`](../../../.claude/skills/pipeline/references/output-format.md) ships a 3-layer Argo-style rich format (dependency graph + action queue + 1-liner blocks) — but it fires only on `/meta-orchestrator <umbrella>` path that proceeds to dispatch ([output-format.md:24](../../../.claude/skills/pipeline/references/output-format.md#L24)). No-arg path emits only [SKILL.md §2 step 3](../../../.claude/skills/pipeline/SKILL.md) ranking table + winner recommendation.

**User-requested redesign (binding for Stage 3 design):**

> спец режим я хочу как базовый — просто при вызове без аргумента пусть лучше /meta-orchestrator 1 укажет — он мне даст 1 лишь победителя; если два — то два, и т. д.; и пусть указывает какие из них можно запустить вместе параллельно а какие нет.

Semantics to design:
- **`/meta-orchestrator`** (no arg) — emit full plan overview (rich format, all candidates surfaced with status/priority/parallelism markers).
- **`/meta-orchestrator <N>`** (integer arg) — emit top-N winners with parallel-vs-sequential annotation.
- **`/meta-orchestrator <umbrella-name>`** (string arg) — existing behavior preserved (§7.4 launch-table + meta-kickoff).

Arg-parser disambiguation: integer-shaped → top-N; otherwise → umbrella name. Probably needs explicit check that no umbrella is literally named `1`, `2`, etc. (currently true; verify).

**P4 — `!`-fence helper invocations fail CC permission check.** Surfaced 2026-05-28 same session as the kickoff itself was invoked: `/meta-orchestrator <kickoff-path>` → CC dispatched `[SKILL.md §2.5 Step 2](../../../.claude/skills/pipeline/SKILL.md)` body which is a `` ```! `` fenced block calling `${CLAUDE_SKILL_DIR}/helpers/dup-detect.sh "${umbrella:-}" 2>/dev/null || ${CLAUDE_SKILL_DIR}/helpers/dup-detect.sh --all 2>/dev/null` → `Shell command permission check failed for pattern …`. Hits **all 14 inline-shell blocks** in [SKILL.md](../../../.claude/skills/pipeline/SKILL.md) (lines 56, 60, 64, 68, 72, 104, 162, 172, 180, 188, 239, 243, 285, 360), not just dup-detect — dup-detect was just the first unknown pattern in this session.

**Root-cause split (binding for Stage 4 candidate set):**

- **P4-a (form-mismatch).** [`.claude/settings.json:6-9`](../../../.claude/settings.json#L6-L9) allow-list has 2 narrow entries, both keyed on the literal prefix `bash "$CLAUDE_PROJECT_DIR/.claude/hooks/<file>.sh"` (e.g. `Bash(bash "$CLAUDE_PROJECT_DIR/.claude/hooks/end-of-turn-reminder.sh")`). SKILL.md helper invocations use **direct-path form** without `bash` prefix: `${CLAUDE_SKILL_DIR}/helpers/foo.sh "$arg"`. No allow-rule covers the direct-path form; global `~/.claude/settings.json` lacks one too (verified via `jq -r '.permissions.allow[]?' | grep helper` → empty). **Falsifier**: wrong if any allow-rule of shape `Bash(* helpers/*.sh *)` exists in either settings — grep against both settings files at Stage 4 start must reproduce empty.
- **P4-b (compound `||`).** Step 2 chains two helper invocations with `||`. Even after P4-a is fixed, a single allow-rule for `Bash(bash * helpers/dup-detect.sh *)` matches each invocation **separately**, not the compound. CC matcher behavior on compound commands needs verification (§1 item 5d) — best-case it matches each clause; worst-case the compound is one pattern that no allow-rule covers. Independent of matcher behavior: [`dup-detect.sh:74`](../../../.claude/skills/pipeline/helpers/dup-detect.sh#L74) already exits 1 with `Usage:` on empty arg → the `||` exists to compensate for the helper rejecting `""`. Cleaner: helper treats empty arg as `--all`; SKILL.md calls one path.

**Maintainer-applied vs agent-applied carveout (recursive [[feedback_settings_json_agent_uncommittable]]):** `.claude/settings.json` is denied to agent Edit/Write per [`.claude/settings.json:56-57`](../../../.claude/settings.json#L56-L57) self-protection. **P4-a fix is maintainer-applied** (Stage 4 produces a recipe + diff sketch; maintainer lands it). **P4-b fix is agent-applied** — SKILL.md + `dup-detect.sh` are not self-protected.

## §0.5 Falsifier on scope-merge

Bundling P1+P2+P3 in one umbrella is **wrong if** any of:

- **P4 turns out to be a CC harness bug, not a SKILL.md/settings.json bug** — e.g. CC's `!`-fence content extraction incorrectly includes the opening fence in the command sent for permission check (verified by Stage 0 §1 item 5d via direct probe). In that case the fix is upstream-CC (file issue, wait, work around); no agent-applied SKILL.md change resolves it. **Counter**: §1 item 5d's first sub-probe — write a trivial `` ```! \necho ok\n``` `` block in a throwaway skill and observe the permission-check pattern emitted. If pattern is `echo ok` → CC harness clean → P4-a/P4-b is the real cause. If pattern includes literal `` ```! `` → CC harness bug → escalate to maintainer + skip P4-a/b implementation.
- **P3 R-phase verdict requires a different parallelism signal than what P2's branch-matcher can derive** — e.g. R-phase concludes parallelism must be declared in `wave-sequencing-plan.md §2 dependency edges` rather than inferred from file-scope or kickoff frontmatter. In that case Stage 1 (P1 refresh) and Stage 3 (P3) couple through the §0 table format, requiring Stage 1 redo after Stage 3 design lands. **Counter**: Stage 1 is a one-off data refresh against the CURRENT §0 schema, not the future one — it ships before Stage 3 design and is independently valuable. If §0 schema changes in Stage 3, the schema migration is a separate edit, not a redo of the data refresh.
- **P2's branch-matcher turns out to be insufficient as the sole completion signal** — e.g. some umbrellas ship via squash-merge that rewrites the branch name, or via direct commit to staging without a PR. In that case Stage 2 ships an incomplete fix and P3 still recommends stale items. **Counter**: §1 below mandates probing the merged-PR sample for branch-naming compliance before committing to the matcher.

If any falsifier fires after §1 search, split into separate umbrellas.

---

## §1 Required searches (phase-research-coverage.md §1 — 6-item checklist on negative-existence claims)

Stage 0 R-phase MUST run all 6 with file:line evidence + fetched excerpts (T3 mandate). I-phase Stages 1-3 inherit these results and do not re-run.

1. **SSOT consult** — [docs/meta-factory/prior-art-evaluations.md](../../../docs/meta-factory/prior-art-evaluations.md) for entries on: «full plan rendering», «top-N selection», «parallel-vs-sequential indication», «completion detection», «branch→umbrella mapping», «overview UI». Cite by ID. Known starting points: SSOT #65 (`using-git-worktrees` — parallelism precedent at git-level); SSOT #77 (Cline Memory Bank — committed-markdown state precedent); SSOT row TBA (Argo `├──/└──` ADOPT-VOCAB from F.1). T16 problem-class check each.
2. **DeepWiki `ask_question`** (≥3 phrasings) on:
   - `obra/superpowers` — «how does Superpowers indicate parallel-vs-sequential between sub-tasks in its plan output?»; «does Superpowers have a top-N selection mode?»
   - `cline/cline` — «how does Cline Memory Bank decide which task is complete vs in-progress?»; «branch→task mapping discipline?»
   - `code-yeongyu/oh-my-openagent` — «alias routing for integer-shaped slash-command args»; «completion-detection mechanism for backlog items»
3. **WebSearch** (≥3 phrasings, per [T12](../../../.claude/rules/ai-laziness-traps.md)): «slash command integer arg semantics», «task plan overview UI chat agent», «detect completed task git branch matching», «parallelism indication action queue».
4. **Build-vs-reuse SSOT full sweep** — not just keyword match. For each candidate matcher in §0 P2, T16 problem-class check.
5. **CC primitive verification** — direct WebFetch + probe:
   - **5a — slash-command integer-arg parsing**: how does CC tokenize `/cmd 1` vs `/cmd one`? Does the arg arrive as string «1» in both cases, or is there type-coercion? Probe via existing skill that accepts arg, log raw arg, verify shape.
   - **5b — `output-format.md` extension feasibility**: principle 18 enforces literal substrings of the F.3 format ([packages/core/principles/18-meta-orchestrator-output-format.test.ts](../../../packages/core/principles/18-meta-orchestrator-output-format.test.ts)). Can the no-arg overview format coexist as a separate template (no principle-18 contention), or does extending §1 of `output-format.md` require updating the principle test? Verdict criterion: zero churn on existing dispatch-path test.
   - **5d — CC permission-check pattern emission probe** (settles P4 falsifier §0.5): write a throwaway skill containing a single `` ```! \necho probe-ok\n``` `` block, invoke it, capture the **exact** pattern shown in `Shell command permission check failed` message (if denied) or accepted-pattern (if allowed). Verdict criteria:
     - Pattern is literal `echo probe-ok` → CC fence-parsing clean; P4 root cause is **P4-a (form-mismatch in settings allow-list)** + possibly **P4-b (compound `||`)** — proceed to Stage 4 fix.
     - Pattern is `` ```! \necho probe-ok\n``` `` (fence included) → CC harness bug; escalate as upstream-CC issue. **STOP Stage 4 agent-applied work** — switch to `bash ${CLAUDE_SKILL_DIR}/...` workaround in SKILL.md only if it is empirically confirmed to bypass the fence-leak (probe again with the workaround form).
     - Companion sub-probe — compound `||` matcher behavior: write `` ```! \ntrue || true\n``` `` block, observe whether each clause matches a hypothetical `Bash(true)` allow-rule independently or the compound `Bash(true || true)` is treated as one pattern. Documents whether single-helper allow-rule is sufficient or compound-aware rules are required.
   - **5c — merged-PR branch-naming compliance audit** (settles P2 falsifier): sample last 100 merged PRs via `gh pr list --state merged --limit 100 --json number,title,headRefName` → for each, parse headRefName prefix (`feat/` `fix/` `chore/` `docs/`) and strip → exact-match against `.claude/orchestrator-prompts/*/` basenames. Output:
     - **% exact match** (branch ≡ umbrella)
     - **% prefix-only match** (umbrella name appears as PR-title substring but not as branch)
     - **% no match** (PR closed work in some other way — squash-rename, direct staging commit, etc.)
     If exact-match ≥ 85%, branch-matcher is sole-signal sufficient. If 50-85%, branch-matcher + PR-title-substring fallback. If <50%, problem-class is different, split umbrellas per §0.5.
6. **DeepWiki on this repo** — `Yhooi2/rules-as-tests-aif` — search «completion detection», «umbrella DONE marker», «priority-score filter», «no-arg overview», «branch matcher».

---

## §2 Stage table (parallelism markers explicit)

| Stage | Type | Scope | Mode | Parallel-with | Depends-on | Volume |
|---|---|---|---|---|---|---|
| **0** | R-phase | Design Stage 3 UX + parallelism-signal source + completion-signal matrix (single-source vs branch+fallback); produce research-patch | Mode A inline | none (R-phase singleton) | — | M (~300 LOC patch) |
| **1** | I-phase | One-off refresh of `wave-sequencing-plan.md §0` snapshot against live git+gh state; commit as atomic «reconciled 2026-MM-DD» edit | Mode A inline | **Stage 2** (different files: `docs/meta-factory/*` vs `.claude/skills/meta-orchestrator/helpers/*`; zero overlap) | — | S (~50 LOC table delta) |
| **2** | I-phase | Implement P2 fix — branch-matcher in `priority-score.sh` per §1 item 5c verdict + paired-negative test under `packages/core/hooks/` | Mode A inline | **Stage 1** (independent files) | — | S (~30 LOC bash + ~80 LOC test) |
| **3** | I-phase | Implement P3 UX — no-arg overview UI + integer-arg top-N + parallel-vs-sequential markers per Stage 0 verdict | Mode A inline (single SKILL.md + helpers; SDD if Stage 0 verdict surfaces ≥3 independent sub-tasks) | none | **Stage 0** verdict | M-L (~150-300 LOC across SKILL.md + new helper + output-format.md extension + principle 18 if needed) |
| **4** | I-phase | Fix P4 — UNBLOCKS the skill itself: (a) rewrite all 14 SKILL.md `!`-blocks to `bash "${CLAUDE_SKILL_DIR}/helpers/<file>.sh" "$arg"` form (P4-a agent-side); (b) collapse Step 2 `|| --all` chain by teaching `dup-detect.sh` to treat empty arg as `--all` (P4-b); (c) produce maintainer-applied diff for `.claude/settings.json` adding `Bash(bash * helpers/*.sh *)` allow-rule (P4-a maintainer-side, agent-uncommittable per [[feedback_settings_json_agent_uncommittable]]); (d) paired-negative test under `packages/core/hooks/` asserting `dup-detect.sh ""` returns the `--all` output (not `Usage:`+exit 1) | Mode A inline | **Stage 1** + **Stage 2** + **Stage 3** (different files: `SKILL.md` + `helpers/dup-detect.sh` vs others) | **Stage 0 §1 item 5d verdict** (if CC harness bug confirmed → STOP Stage 4 agent-side, only ship maintainer recipe) | S (~30 LOC SKILL.md rewrite + ~10 LOC dup-detect.sh + ~50 LOC paired-negative test + ~5 LOC settings.json diff) |

**Parallel-launch instruction (per maintainer request «пусть указывает какие из них можно запустить вместе»):**

Stage 1 + Stage 2 + Stage 4 → **launch in parallel** (separate worktrees per [parallel-subwave-isolation.md §1](../../../.claude/rules/parallel-subwave-isolation.md): `git worktree add ../<repo>-overview-s1 staging`, `../<repo>-overview-s2 staging`, `../<repo>-overview-s4 staging`; one branch each). They touch zero shared files — Stage 1 edits `docs/meta-factory/wave-sequencing-plan.md`, Stage 2 edits `.claude/skills/meta-orchestrator/helpers/priority-score.sh` + creates `packages/core/hooks/priority-score-branch-matcher.test.ts`, Stage 4 edits `.claude/skills/meta-orchestrator/SKILL.md` + `helpers/dup-detect.sh` + creates `packages/core/hooks/dup-detect-empty-arg.test.ts` + emits maintainer-recipe diff for `.claude/settings.json` (not committed).

Stage 0 → **sequential before Stage 3 and Stage 4**. Stage 3 cannot dispatch until Stage 0's research-patch lands and Phase -1 reviewer confirms verdict is implementable. Stage 4 cannot dispatch until Stage 0 §1 item 5d verdict confirms P4 is form-mismatch (not CC harness bug).

Stage 3 → **sequential after Stage 0**. May overlap with Stage 1 + Stage 2 + Stage 4 in wall-clock (no file conflict; SKILL.md sections touched by Stage 3 vs Stage 4 are disjoint — Stage 3 touches §1/§2 + new no-arg overview helper, Stage 4 touches the 14 `!`-block invocation forms across §2/§2.5/§3/§7) but is logically gated on Stage 0 verdict so should not start before then. **Merge-order constraint**: Stage 4 SHOULD land first if Stage 3 also rewrites `!`-blocks — otherwise Stage 4's rewrite collides with Stage 3's new blocks. Coordinate via merge-queue order or stage-4 → stage-3 sequential fallback.

**P4 elevated priority note:** Stage 4 fix UNBLOCKS the skill itself (without it, every `/meta-orchestrator` invocation in a fresh session faces the same permission wall). Consider front-loading Stage 4 ahead of Stage 1 + Stage 2 if maintainer wants the skill operational before the wave-plan refresh / branch-matcher rollout.

---

## §3 Stage gates

Between every stage transition: **REAL git merge check** (not memory). Per [SKILL.md §6](../../../.claude/skills/pipeline/SKILL.md):

```bash
gh pr list --search "is:merged head:<stage-N-branch> base:staging" --json number,title,mergedAt,headRefName --limit 10
```

Phase -1 cold-review **mandatory** between every stage admission (per [reviewer-discipline.md §2](../../../.claude/rules/reviewer-discipline.md)). Auto-continuing without GO = T4 anti-pattern.

**Branch naming (binding for Stage 2 mechanism's own validation — recursive self-application T15):** every stage branch in this umbrella MUST be `feat/meta-orch-no-arg-overview-s<N>` (S0=R-phase research-patch only, so `feat/meta-orch-no-arg-overview-s0-rphase`). The umbrella dir basename = `meta-orch-no-arg-overview`. After Stages 1-3 merge, the Stage 2 branch-matcher MUST correctly classify this umbrella as DONE on its next invocation. If it does not, Stage 2 ships an incomplete fix.

---

## §4 AI-traps active (per [ai-laziness-traps.md §3](../../../.claude/rules/ai-laziness-traps.md))

Canonical traps each Stage's session MUST instantiate countermeasures for:

- **T1** (sampling floor) — Stage 0 §1 item 5c branch-naming audit: floor = 100 PRs minimum, not «I looked at 3 recent ones, all matched».
- **T3** (file:line citation) — every verdict in Stage 0 research-patch carries file:line or `gh` command + output, no prose-only.
- **T4** (premature R-phase closure) — Stage 0 hits all §1 6-item checklist; counter-prompt «what completion signal did I miss?» runs at end.
- **T7** (pattern-match the prompt) — when this kickoff says «branch-matcher», don't pick «5-line bash» as the answer just because the maintainer offered it — that's a candidate, not the verdict. §1 item 5c probe data drives the verdict.
- **T11** (no external prior-art) — Stage 0 §1 items 1-6 all mandatory before any BUILD verdict in Stage 3.
- **T12** (skip lit sweep) — same; WebSearch ≥3 phrasings even though you «know» how slash-command parsers work.
- **T13** (ADOPTED items as zero-work) — if Stage 0 lands on ADOPT of any pattern from Superpowers/Cline/OhMyOpencode, T16 problem-class check explicit in the patch.
- **T15** (self-application) — §3 above. The Stage 2 matcher must classify THIS umbrella correctly after merge. The Stage 3 overview must render THIS umbrella's status correctly on next invocation.
- **T16** (pattern-matching-on-name) — every prior-art entry surfaced in §1 carries «upstream problem class = X; ours = Y; match? evidence = …».
- **T17** (destructive delegation) — Stage 1 §0 refresh MUST NOT discard existing curated content. Diff-only edits to §0 table cells; no whole-section rewrites. Preserve prior plan-revision history references in the §0 footer.
- **T20** (inline-verdict-without-evidence) — Stage 0 author runs ≥1 evidence-bearing tool call (`Bash | Read | Grep | Glob | WebFetch | WebSearch`) for every recommendation/verdict and quotes its output.

**Domain-specific traps for this umbrella:**

- **T-NoArg-A — `#open-prs-zero-equals-no-work`** — treating `open_prs=0` from `priority-score.sh` output as «umbrella has no live work» without checking the merged-state side. Origin: 2026-05-28 incident. Counter: Stage 2's matcher consults BOTH `gh pr list --state open` AND `gh pr list --state merged` before classifying an umbrella as eligible candidate. **Falsifier**: a closed umbrella (merged PR within 30 days) appears in the no-arg priority ranking → trap fired.
- **T-NoArg-B — `#kickoff-can-reference-its-own-PR`** — assuming kickoff body can cite PR numbers from the work it scopes, used by `dup-detect.sh` ([helpers/dup-detect.sh](../../../.claude/skills/pipeline/helpers/dup-detect.sh)) to detect completion. Origin: maintainer's 2026-05-28 diagnosis — kickoff is written BEFORE the PRs it scopes, physically cannot reference them. Counter: dup-detect MUST NOT rely on kickoff → PR-number references as a completion signal. Sole signal candidates: branch-matcher (§1 item 5c verdict), or external state file (post-merge update). **Falsifier**: dup-detect after Stage 2 still uses `grep '#[0-9]\+' kickoff.md` as a completion-detection clause → trap fired.
- **T-NoArg-C — `#title-word-overlap-as-completion-signal`** — assuming PR titles share substantive words with kickoff titles. Origin: same maintainer diagnosis — kickoff titles use repo-internal jargon («§-1 RE-VERIFY», «§0 BFR»), PR titles use feature words («cache + injection + writer»). Word overlap ≈ 0. Counter: Stage 2 audit (§1 item 5c) measures actual title-word-overlap rate empirically, does not assume it's a usable signal. **Falsifier**: Stage 2 matcher's fallback layer relies on title-word overlap without §1 item 5c % evidence supporting it → trap fired.
- **T-NoArg-D — `#skill-invocation-form-mismatch-allowlist`** — authoring a SKILL.md `!`-block in a form (direct-path, compound `||`, unquoted `${VAR}` expansion) that no `Bash(...)` allow-rule in `.claude/settings.json` or `~/.claude/settings.json` is shaped to match, then attributing the resulting permission-check failure to a CC bug rather than the form-mismatch. Origin: 2026-05-28 incident — direct-path `${CLAUDE_SKILL_DIR}/helpers/dup-detect.sh ...` form had zero matching allow-rule (verified: project settings.json:6-9 only allows `bash "$CLAUDE_PROJECT_DIR/.claude/hooks/<file>.sh"` shape). Counter: Stage 0 §1 item 5d probe distinguishes harness-bug vs form-mismatch BEFORE Stage 4 writes any fix. Every SKILL.md `!`-block MUST be matched against the active allow-list at author-time via `grep` against the literal `Bash(...)` patterns. **Falsifier**: Stage 4 rewrites SKILL.md to the `bash "${VAR}/helpers/<file>.sh"` form and a fresh-session `/meta-orchestrator` invocation still hits the permission wall → form-mismatch was not the (sole) root cause; revisit P4 with new evidence.

---

## §5 §1.7 self-reflexive note (forward + backward)

- **Forward-check:** this umbrella's Stage 0 R-phase complies with [build-first-reuse-default.md §3](../../../.claude/rules/build-first-reuse-default.md) (6-layer mechanism mandatory before BUILD verdict on Stage 3 UX) + [no-paid-llm-in-ci.md](../../../.claude/rules/no-paid-llm-in-ci.md) (all dispatch session-bound; Stage 2 paired-negative test = deterministic bash + Vitest, no API-billed call) + [doc-authority-hierarchy.md §3](../../../.claude/rules/doc-authority-hierarchy.md) (this kickoff carries Authoritative-for header) + [ai-laziness-traps.md §3](../../../.claude/rules/ai-laziness-traps.md) (T-enumeration + 3 domain-specific T-NoArg-A/B/C above). T15 enforced via §3 stage-gate naming convention (the matcher must classify this very umbrella correctly post-merge).
- **Backward-check:** Stage 1 refresh of `wave-sequencing-plan.md §0` extends, does not supersede, the prior 2026-05-25 reconciliation (history footer preserved per T17). Stage 2 fix extends `priority-score.sh` + `dup-detect.sh`; no other helper is silently superseded. Stage 3 UX adds a no-arg overview path; the existing `<umbrella-arg>` path + [output-format.md](../../../.claude/skills/pipeline/references/output-format.md) F.3 3-layer format are **preserved**, not redefined — overview is a sibling format, not a replacement (subject to Stage 0 verdict). [SKILL.md §1 bootstrap mode](../../../.claude/skills/pipeline/SKILL.md) (writes stub if wave-plan missing) is unchanged. Stage 4 P4-a/P4-b fix rewrites invocation **form** of all 14 `!`-blocks (direct-path → `bash "${VAR}/..."`) without changing their **semantics**: every helper still receives the same args and exits with the same codes; `dup-detect.sh` empty-arg branch becomes `--all` (was `Usage`+exit 1) — superseded only at the empty-arg edge, not the named-umbrella path. No other skill / hook / principle artefact silently superseded. T15 enforcement: after Stage 4 lands, a fresh-session `/meta-orchestrator` invocation MUST complete the `!`-block sequence without permission-wall — that is the self-application acceptance test (recorded under §3 stage-gate naming convention).

---

## §6 See also

- [`.claude/skills/meta-orchestrator/SKILL.md`](../../../.claude/skills/pipeline/SKILL.md) — §1 currency / §2 priority / §3 launch-table — all touched by Stage 3.
- [`.claude/skills/meta-orchestrator/helpers/priority-score.sh`](../../../.claude/skills/pipeline/helpers/priority-score.sh) — Stage 2 primary edit target.
- [`.claude/skills/meta-orchestrator/helpers/dup-detect.sh`](../../../.claude/skills/pipeline/helpers/dup-detect.sh) — Stage 2 secondary edit target (per T-NoArg-B).
- [`.claude/skills/meta-orchestrator/references/output-format.md`](../../../.claude/skills/pipeline/references/output-format.md) — Stage 3 reference; principle 18 enforces.
- [`.claude/skills/meta-orchestrator/references/plan-cache.md §2`](../../../.claude/skills/pipeline/references/plan-cache.md) — T-mem-A counter, cache-as-supplementary discipline relevant to Stage 3 design.
- [`docs/meta-factory/wave-sequencing-plan.md`](../../../docs/meta-factory/wave-sequencing-plan.md) — Stage 1 primary edit target.
- [`.claude/rules/ai-laziness-traps.md §2 T20`](../../../.claude/rules/ai-laziness-traps.md) — companion T-trap discipline for Stage 0.
- [`.claude/rules/parallel-subwave-isolation.md §1`](../../../.claude/rules/parallel-subwave-isolation.md) — worktree requirement for Stage 1 ∥ Stage 2 parallel launch.
- [PR #236](https://github.com/Yhooi2/rules-as-tests-aif/pull/236) — the closed umbrella that mis-classified in 2026-05-28 incident; Stage 2 matcher must classify it as DONE.
- [`.claude/settings.json:6-9`](../../../.claude/settings.json#L6-L9) — current allow-list (2 narrow hook-specific entries; Stage 4 P4-a maintainer-recipe target).
- [`.claude/skills/meta-orchestrator/SKILL.md`](../../../.claude/skills/pipeline/SKILL.md) lines 56/60/64/68/72/104/162/172/180/188/239/243/285/360 — all 14 `!`-block invocation sites; Stage 4 P4-a agent-side rewrite target.
- [`.claude/skills/meta-orchestrator/helpers/dup-detect.sh:74-75`](../../../.claude/skills/pipeline/helpers/dup-detect.sh#L74-L75) — empty-arg `Usage:`+exit 1 branch; Stage 4 P4-b collapse target (treat empty arg as `--all`).
- feedback memory `settings_json_agent_uncommittable` (auto-loaded) — why Stage 4's settings.json edit is maintainer-applied, not agent-applied.
