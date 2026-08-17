<!-- host-verify: none — umbrella CLOSED 2026-06-03 (PR #399, see done.md). This file is now a historical dispatch record, not a live dispatch input; it has no executable deliverable left to gate. The 2026-08-09 edit corrects two falsified §4c facts and adds no work item. -->

# KICKOFF — meta-orchestrator-refactor (autonomous · audit-first → fixes → rename)

> **Type:** multi-stage R+I umbrella. Autonomous-capable (aif-handoff runtime-bridge OR orchestrator session).
> **Base branch:** `staging` (NOT `main` — main is prod, manual promote only).
> **Companion (READ FIRST):** [`audit-plan.md`](audit-plan.md) in this same dir — the first-pass findings + §10 adversarial re-verification that CORRECTS several first-pass overstatements. This kickoff operationalises audit-plan.md §0.
> **Persistence:** this umbrella lives in CANON `~/.claude-coordination/rules-as-tests-aif/` and is mirrored into every worktree by `link-coordination.sh`. It survives worktree deletion. Authored 2026-06-03 in a worktree that was then deleted — all findings are captured in `audit-plan.md`, nothing depends on that worktree.

---

## §0 Cold-start (read in order)

1. `README.md#why-this-exists` — project goal (don't elevate methodology to goal).
2. `.claude/session-bootstrap.md` → `CLAUDE.md`.
3. **`audit-plan.md` (this dir)** — first-pass findings §1–§9 + **§10 re-verification corrections (load-bearing — supersedes first-pass where they conflict)**.
4. This kickoff.

**Goal:** optimize/refactor the `/meta-orchestrator` skill. The audit established (BFR-clean, re-verified) that the skill does **NOT** duplicate companions and the core is genuinely novel — so this is **cleanup + correctness + worktree-hardening + rename, NOT a rewrite**. Verified comprehensive audit comes FIRST; fixes only build on re-verified findings.

---

## §1 Inputs / state at handoff

- **Skill under work:** `.claude/skills/meta-orchestrator/` — SKILL.md (600 LOC / 6636 words), 8 references, 17 helpers (~2047 LOC), 2 templates. Coupled to principle tests P12/15/18/19/20. NO repo-root mirror; install ships from `.claude/skills/` (`install.sh:236-255`).
- **Audit status:** first-pass + ONE re-verification pass done (audit-plan §10). This is NOT yet the comprehensive audit — Stage 1 below produces that.
- **9 audit angles** (audit-plan header): ai-docs structural · SP `writing-skills` · native `skill-creator` (eval-driven) · functional correctness · worktree reliability · BFR/thin-overlay · memory/plan-currency · rename blast-radius · behavioral/eval testing.
- **Solid CONFIRMED bugs (build fixes on these):** C1.1 (master-backlog-delta.md:49 ↔ SKILL.md:528 delta-ownership contradiction) · C1.2 (SKILL.md:508 state.md section names vs template) · C1.3 (SKILL.md:449 stale mirror-claim + wrong install.sh line-ref) · F2 (SKILL.md:71 `head -200` truncates 275-line plan) · F7 (`run-helper.sh:26` no timeout; no stall F-code) · W3 (`priority-score.sh:151` gh-per-umbrella loop = 138 calls/run → the stall) · W4 (`priority-score.sh:77` hardcoded project slug) · M4 (`delta-write-from-state.sh` ordering vs SKILL.md §10 5b → arrays lost on first run).
- **REFUTED / downgraded — do NOT carry forward as first-pass stated** (audit-plan §10): WS1 «52 narrative lines» = ~10× overcount (real ≈5-8; bloat is verbosity, not history) · F3/F4/F5 are MINOR / intentional-design / process-gap, not severe code bugs · §7 reviewer is ADAPT not «thin-wrap» · W2 worktree symlinks are BY-DESIGN coordination, not a defect (real gap = no flock) · assign-skill.sh may be dead-output (advisory, zero §2.5-Step-5 wiring).
- **9 open decisions DN-1…DN-9** (audit-plan §8) — taste/strategy forks. **These MUST be surfaced/parked, never guessed** (§4).

---

## §2 Stages (audit-first, then fixes)

> Each stage = atomic PR(s) to `staging`. Stage N+1 waits on Stage N merged (§3 gate) + Phase -1 cold-review (§7).

- **Stage 0 — Verify the plan.** Cold-review `audit-plan.md` §1–§10. Confirm the 9-angle list is complete and findings/severities sound (the §10 layer already corrected the first pass — honour it). Fix any plan gap. Deliverable: a short `plan-verification.md` (GO / corrections). *No skill edits yet.*
- **Stage 1 — Comprehensive audit (the real one).** Full-coverage pass (NOT sampled) under all 9 angles. Each finding: CONFIRMED / REFUTED / ADJUSTED with fresh file:line. Then an **adversarial re-verification** sub-pass (try to REFUTE each — this caught real overstatements last time). Deliverable: `verified-audit.md` (the trustworthy audit). *No skill edits yet.*
- **Stage 2 — Correctness fixes** (the CONFIRMED bugs): C1.1, C1.2, C1.3 (stale docs) · M4 (delta-helper ordering — fix SKILL.md §10 5b order OR make `delta-write-from-state.sh` bootstrap internally) · F2 (stop truncating the plan inject) · F7 (`run-helper.sh` timeout + a stall F-code in `failures.md`). Small atomic PRs.
- **Stage 3 — Worktree hardening** (the «must work in workspaces» concern): W3 = batch gh (fetch all open PRs ONCE, match locally — kills the 138-call stall; this is the highest-value fix) · W4 = derive the memory/project path portably (no hardcoded slug) · W2/M5 = add `flock` to the coordination writes OR document last-writer-wins explicitly.
- **Stage 4 — Slim + hygiene.** Move genuinely-movable prose to references: §9 Dogfood (historical), Red-flags table, §2 Step-4.1, and collapse the §7.x-binding indirection to one provenance note. **KEEP `## With this skill` / `## Without this skill` in-body (principle 15 requires them).** Split `output-format.md` §5 examples → `output-format-examples.md`. Resolve `mode-overrides.md` orphan (wire or explicit TODO). Add the 3 missing `@dual-pair` SKILL.md-side markers. Helper dedup → `helpers/lib/` (resolve_target, REPO_ROOT, gh-cache, tokenize) + split `priority-score.sh` synthetic section. **Drop the «52 narrative lines» framing — slim is via verbosity + movable sections, per §10.**
- **Stage 5 — Rename (DN-gated, after DN-1 name chosen).** Update LIVE only (~35 files: frontmatter `name:` = the slash-command registration, P18/19/20 filenames+path-strings, ~12 hook tests + ~10 skills tests, `install.sh`, `runtime-bridge/src/index.ts`, `prior-art-evaluations.md`, docs/superpowers specs). **Leave 45 FROZEN historical untouched** (research-patches/retros/MEMORY/wave-plan/book — doc-authority `#frozen-doc-still-edited`). C4.6 (`classify-each-candidate.sh` rename) folds in here, atomic with the P19 + SKILL.md §2.5 edit.
- **Stage 6 — Eval/behavioral gate (NS1 ≡ WS5).** Build `evals/evals.json` with 2-3 realistic `/meta-orchestrator` scenarios; run slimmed-vs-current with the native skill-creator harness (`generate_review.py` + `grader.md`); prove the slim/rename did NOT break any discipline. Closes the standing «never behaviorally tested» gap.

---

## §3 Stage gates (real git checks — not in-memory)

Before dispatching Stage N+1:

```bash
gh pr list --search "is:merged head:<stage-N-branch> base:staging" --json number,title,mergedAt --limit 10
```

Empty when Stage N expected merged → HALT, do not proceed. Phase -1 cold-review (§7) between EVERY stage is mandatory (T19 — CI ≠ design review).

---

## §4 Autonomy + park-don't-guess contract (MANDATORY if dispatched autonomously)

This umbrella is autonomous-capable. If dispatched to aif-handoff (`tsx packages/runtime-bridge/src/cli/dispatch.ts <this-kickoff>`):

- **Lever-1 config:** `AGENT_MAX_REVIEW_ITERATIONS=1`, `AGENT_AUTO_REVIEW_STRATEGY=closure_first`.
- **Lever-2 — fork discipline (non-negotiable):** the 9 DNs (DN-1 name · DN-2 rename-file-scope · DN-3 sequencing · DN-4 mode-overrides wire-vs-defer · DN-5 gh-batch semantics · DN-6 flock-vs-document · DN-7 cut-depth · DN-8 assign-skill keep/gate/simplify/delete · DN-9 eval-gate accept-vs-defer) are **genuine forks with no determinate best on the project's merits**. On reaching ANY of them: **PARK as a question** («Option A → consequence X / Option B → consequence Y»), set the task to `manualReviewRequired`, proceed only on the unambiguous parts. **Guessing a DN is the exact failure this contract prevents.** DN-1 (the name) especially — do not pick a name; surface candidates (`orchestrating-waves` / `wave-control` / `dispatching-waves` / `launch-control` …) and let the maintainer choose.
- **Trust-but-verify:** the maintainer Approves/Requests-changes each completed stage; «questions» = open DN forks + the agent's autonomous decisions awaiting verification.

If run by a normal `/orchestrator` or `/meta-orchestrator` session: same DN-park discipline via `AskUserQuestion` (surface, don't decide — `reviewer-discipline.md §2`).

---

## §4c Runtime availability — aif-handoff vs Claude Code session (READ before choosing runner)

**Where the skills/files actually live decides this. Originally verified 2026-06-03 — two rows FALSIFIED by direct measurement 2026-08-09 (see §4c.1); struck cells below are the original wording, kept as record.**

> **Re-verification trigger (this table had none, which is why it rotted):** the container's mount set is
> operator-machine state, not repo state — it can change with no commit. Before reusing ANY row as a
> premise, re-run:
> `docker inspect aif-handoff-agent-1 --format '{{range .Mounts}}{{.Source}} -> {{.Destination}}{{println}}{{end}}'`
> and probe the specific path with `docker exec aif-handoff-agent-1 ls <path>`. A stamp is not a measurement.

| Asset | CC session on operator machine | aif-handoff dispatch (containerised) |
|---|---|---|
| Superpowers plugins (`~/.claude/plugins/`) | ✅ available | ✅ **available — CORRECTED 2026-08-09.** ~~❌ NOT available — operator-home, only the repo clone is bind-mounted to `/home/www` (`runtime-bridge-setup.md:40`); the container has its own `$HOME`~~. **Two** bind mounts carry them: `/host_mnt/Users/art/.claude/plugins → /home/node/.claude/plugins` **and** `→ /Users/art/.claude/plugins` — the second mirrors the host-absolute path precisely so `installed_plugins.json`'s `installPath` resolves verbatim inside the container. Measured: superpowers **6.2.0** (`gitCommitSha 3dcbd5c4b4`), 14 `SKILL.md` under `/Users/art/.claude/plugins/cache/superpowers-dev/superpowers/6.2.0/skills/`. |
| Global `~/.claude/skills/orchestrator/`, `reviewer/` | ⚠️ **neither directory exists** (measured 2026-08-09) | ⚠️ same — `/host_mnt/Users/art/.claude/skills → /home/node/.claude/skills` IS mounted, but the whole tree is `ai-docs`, `design-compare`, `native-css-responsive`, `uniq-rewrite`. The original row's **`✅ available`** column was therefore wrong on the host side too; whether the dirs existed on 2026-06-03 is unknown — no artefact records it. |
| Project `.claude/skills/meta-orchestrator/`, `.claude/rules/*.md`, `.claude/hooks/` | ✅ | ✅ available — committed in the git clone + aif uses **Claude Code CLI transport** (`transport: "cli"`, `runtime-bridge-setup.md:35`) so project `.claude/` auto-loads |
| **This kickoff** | ✅ | ✅ content transmitted — `dispatch.ts:63 buildKickoffSpec` reads the file operator-side and sends its content (gitignore irrelevant) |
| **`audit-plan.md`** (sibling, the key input) | ✅ (CANON) | ✅ **reachable — CORRECTED 2026-08-09.** ~~❌ NOT reachable — gitignored `.claude/orchestrator-prompts/` + CANON `~/.claude-coordination/` are operator-home; not in the clone, not transmitted~~. The *premise* half survives — `git check-ignore -v` resolves the file to `.gitignore:16` (`.claude/orchestrator-prompts/*/*`), so it is genuinely **not** in the clone (only `kickoff.md` + `done.md` are un-ignored, `.gitignore:17-18`). The *conclusion* does not: CANON is a bind mount, `/host_mnt/Users/art/.claude-coordination → /home/node/.claude-coordination`, and `docker exec aif-handoff-agent-1 ls /home/node/.claude-coordination/rules-as-tests-aif/meta-orchestrator-refactor` lists `audit-plan.md` (33372 B) first. Not-in-the-clone ≠ not-reachable. |

### §4c.1 Correction record (2026-08-09) — what was wrong, and what it steered

Both falsifications share one shape: a **negative-existence claim about the destination environment**,
asserted from an inference about how the container is built rather than from a probe of the running
container, then frozen behind a «Verified <date>» stamp with no re-verification trigger. This is the
NEGATIVE direction of [`destination-environment-verification.md`](../../rules/destination-environment-verification.md) — that rule gates whether a kickoff
*declares* a host-verify contract, and nothing at all gates «the container cannot reach X».

**The steering below rested on the `audit-plan.md` row and is therefore WITHDRAWN as a premise-bearing
recommendation.** It is **not** re-decided here: this umbrella **closed 2026-06-03** (PR #399, see
`done.md`), so there is no live runner choice left to make. What the correction changes is the value of
this section **as precedent** — do not copy the runner argument below into a new kickoff; re-measure.

~~**Implication:**~~
- ~~**CC session on your machine is the RECOMMENDED runner** for this umbrella — it has your orchestrator/reviewer/Superpowers skills AND can read `audit-plan.md`. This audit-heavy, skill-leaning work fits a CC session far better than aif.~~ — **WITHDRAWN.** Every one of the three stated advantages is now measured either false (Superpowers: available in both) or false on both sides (`orchestrator/`/`reviewer/`: absent from the host) or false (`audit-plan.md`: reachable in both). No measured asymmetry supports «CC RECOMMENDED» today. That does **not** make aif the recommendation — the audit-heavy/skill-leaning argument was never measured either way, and picking a runner from a corrected fact-base would be the same mistake in the other direction.
- ~~**If you still want aif autonomy:** (a) inline `audit-plan.md`'s §10 corrections + the CONFIRMED-bug list (§1 of this kickoff) into the dispatch payload (or temporarily commit `audit-plan.md` for this umbrella so it lands in the clone), and (b) rely on this kickoff's INLINED disciplines …~~ — **workaround (a) is UNNECESSARY.** Neither inlining nor temporarily committing a gitignored CANON file is needed: the container reads it through the CANON bind mount at the path above. Temporarily committing a gitignored dispatch input to work around a mount that already exists is a real cost (it lands in history and must be reverted) paid for a measurement nobody took. Half **(b)** stands on its own merits — the disciplines are inlined here deliberately, and that remains good practice regardless of what the container mounts.

---

## §4b §1.7 PR-body mandate (paths-triggered — applies to ALL Workers here)

Every stage touches load-bearing paths (`.claude/skills/**`, `packages/core/principles/**`, `CLAUDE.md`, `docs/meta-factory/prior-art-evaluations.md`). Each PR body MUST carry `### §1.7 Forward-check applied` + `### §1.7 Backward-check applied` (H3 headings, word «applied», ≥40 non-ws chars each, ≥1 `file:line` citation per section), OR `### §1.7 Skipped: <rationale ≥60 chars>` for purely structural PRs. Pre-flight grep before `gh pr create` (see meta-orchestrator skill §4b). 6× historical recurrence — do not skip.

---

## §5 AI-traps active (per `.claude/rules/ai-laziness-traps.md §2`)

**T1** sampling floor (Stage 1 = full-coverage, not 3-and-done) · **T2** designing ≠ auditing (run the methodology, report findings) · **T3** every finding = file:line/command, no prose-only · **T4** don't close R-phase early (all 9 angles) · **T11/T12** BFR search before any «build» proposal · **T15** self-application (the refactor keeps P12/15/18/19/20 green; slimmed skill passes its own audit) · **T16** pattern-match-on-name (the §7-«thin-wrap» and assign-skill «precompute CC routing» first-pass errors were T16 — verify problem-class, don't name-match) · **T19** own cold-QA before every handoff · **T20** no verdict without an evidence tool-call.

**Domain trap — T-MOR-A («carry-forward-without-reverify»):** the first pass OVERSTATED WS1 (52→~5-8), F3/F4/F5 severities, and mislabeled §7 + W2. *Do NOT copy first-pass findings into the verified audit without re-confirming them yourself.* audit-plan §10 is the corrected layer; treat §1–§9 as hypotheses, not facts.

---

## §6 Recursive self-application

This refactor must keep principle tests P12/15/18/19/20 GREEN at every stage, and the SLIMMED skill must still pass its own structural checks. Stage 6's eval gate is the behavioral self-application proof.

---

## §7 Phase -1 reviewer (between every stage)

Dispatch a cold-reviewer (SP `requesting-code-review` + `reviewer-discipline.md §2`). It reads the stage diff + the stage's acceptance criteria, emits GO/REVISE/STOP with BLOCKER/MAJOR/MINOR, and surfaces strategy forks as DECISION-NEEDED (does NOT pick). Reviewer is read-only; never edits, never decides strategy.

---

## §8 Stop conditions

- Any DN (DN-1…DN-9) reached → PARK + surface (never guess).
- Any principle test (P12/15/18/19/20) red → HALT the stage.
- Stage gate empty when merge expected → HALT.
- Temptation to re-litigate a BFR verdict or rebuild a companion capability → write a research-patch + surface, do NOT silently rebuild.
- Temptation to edit `~/.claude/skills/orchestrator/` (global, agent-uncommittable) → STOP.

---

## §9 Anti-scope

- **Do NOT rewrite the skill** — audit (re-verified) found it BFR-clean + genuinely-novel core. This is cleanup/correctness/hardening/rename.
- **Do NOT touch the 45 frozen historical docs** in the rename (research-patches/retros/MEMORY/wave-plan/book).
- **Do NOT carry forward refuted first-pass findings** (WS1 52-line framing, §7-thin-wrap, W2-as-defect, F3/F4/F5 as severe) — §10 corrected them.
- **Do NOT add npm deps** (substrate purity + no-paid-llm-in-ci).
- **Do NOT delete `assign-skill.sh` unilaterally** — DN-8 (investigate consumption first).
- **Do NOT touch the global `~/.claude/skills/orchestrator/`.**

---

## §10 See also

- [`audit-plan.md`](audit-plan.md) — first-pass findings + §10 re-verification (the substantive input).
- `.claude/skills/meta-orchestrator/` — the skill under refactor.
- `.claude/rules/ai-laziness-traps.md §2` · `reviewer-discipline.md §2` · `build-first-reuse-default.md §1.1` · `doc-authority-hierarchy.md` · `dual-implementation-discipline.md §4` · `no-paid-llm-in-ci.md §1`.
- `packages/core/principles/{12,15,18,19,20}-*.test.ts` — the coupling that must stay green.
- Native skill-creator: `~/.claude/plugins/marketplaces/claude-plugins-official/plugins/skill-creator/` (eval harness for Stage 6) · SP `writing-skills`.
