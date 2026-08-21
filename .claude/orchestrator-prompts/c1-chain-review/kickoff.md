# C-1 chain — INDEPENDENT REVIEW KICKOFF (fresh reviewer session)

> **Role:** REVIEWER (per [.claude/rules/reviewer-discipline.md](../../rules/reviewer-discipline.md)). You verify claims and surface findings; you **do NOT** write code, fix issues, or pick project strategy. Where a finding needs a strategy/scope decision, surface it as **DECISION-NEEDED** with options and **stop** — the maintainer or an `/orchestrator` session decides (reviewer-discipline §2). Reviewers are read-only for artefacts they don't own (CLAUDE.md Artifact Ownership Contract).
> **Mode:** autopilot is fine for the *verification* work, but do not merge/push/edit anything. Output is a report + a GO / REVISE verdict.
> **You are a FRESH session and inherit NO memory.** Read §2 before reasoning. **Verify, don't trust** — re-run probes; do not take this kickoff's or the merged PRs' claims at face value (that is the whole point of an independent review).

---

## §1 What you are reviewing

A multi-PR chain that resolved **C-1** (our sub-agents collided by filename with AI Factory's `best-practices-sidecar` / `docs-auditor` / `review-sidecar`). All merged to `main` (HEAD ~ `50f1850`, verify current):

- **PR #79** — mechanical collision resolution: `best-practices-sidecar` KEEP-AIF (removed ours), `docs-auditor` → `living-docs-auditor` (rename), shipped `RULES*.md` prose re-credited to AIF `rules-sidecar`/ESLint/audit, principle 09 `REQUIRED_HEADER_DOCS` + count edit, consumer docs (README/INSTALL/INSTALL-FOR-AI), `§1.7 Skipped` marker.
- **PR #82** — skill-context follow-up (parallel session): ships `.ai-factory/skill-context/aif-review/SKILL.md` **and** `aif-rules-check/SKILL.md`, install.sh wiring, principle 09 + count, `@dual-pair` marker on `agents/review-sidecar.md`, ≥1 new SSOT entry.
- **PR #83** — docs-only: landed 3 research-patches on main (`companion-integration-analysis`, `agent-collision-resolution`, `skill-context-runtime-probe`) + link-repair on the companion patch (gitignored-draft links → plain text).

Plus the **decision provenance** these rest on (now on main under `docs/meta-factory/research-patches/2026-05-20-*.md`).

Also in scope to sanity-check (not deeply): a worktree/branch **cleanup** removed 4 orphan branches+worktrees (`feat/agent-collision-resolution` #80-closed, `feat/c1-agent-collision-resolution` #79-merged, `docs/dual-implementation-discipline-2026-05-17`, `feat/orch-skill-refactor-2026-05-17`) + 3 orphan remote branches.

---

## §2 Step 0 — read before reviewing

1. `README.md` §why-this-exists — project goal (esp. "fail at the EARLIEST reachable channel; CI = last resort" — the lens the KEEP-AIF verdict rests on).
2. `.claude/rules/reviewer-discipline.md` — your role boundary.
3. `.claude/rules/build-first-reuse-default.md §1` — the ADOPT/KEEP-AIF/ADAPT/KEEP-NARROW typology the verdicts use.
4. `.claude/rules/ai-laziness-traps.md §2` — instantiate the §6 traps below.
5. `.claude/rules/phase-research-coverage.md §1.7` — to judge whether #79's `§1.7 Skipped` and #82's §1.7 handling were correct.
6. `.claude/rules/dual-implementation-discipline.md §5/§7/§9` — to judge the review-sidecar `@dual-pair`/`spec-of` pairing + first-dual-channel-pair claim.
7. On main: `docs/meta-factory/research-patches/2026-05-20-{companion-integration-analysis,agent-collision-resolution,skill-context-runtime-probe}.md` — the decision provenance.
8. On main: `agents/`, `install.sh`, `setup.sh`, `packages/core/principles/09-doc-authority-hierarchy.{ts,test.ts}`, `packages/preset-next-15-canonical/RULES*.md`, `packages/core/templates/shared/skill-context*/`, `docs/meta-factory/prior-art-evaluations.md` (the SSOT entries added by #82).

---

## §3 Hard constraints
- **Read-only.** No edits, commits, pushes, merges. Output = report + verdict.
- **Verify, don't trust** — re-run the install probe and the link/principle checks yourself; cite actual output (T2/T3).
- **No paid LLM.** Running `ai-factory init` / `/aif-verify` in your own Claude Code session is subscription-bound (in scope); CI paid-API is not.
- **No Superpowers install.**
- **Surface, don't decide** strategy (reviewer-discipline §2).

---

## §4 What to verify (each = a finding with evidence)

### §4.1 End-state install probe (the load-bearing claim: "occupy ZERO AIF slots")
In `/tmp`, off current `main`: `git init` + `package.json` + `ai-factory init --agents claude` + `bash <repo>/install.sh ts-server` (default, no `--force`). Confirm with pasted output:
- header-check artefact count (should match `install.sh` SHIPPED_DOCS length AND principle 09 test assertion — verify they agree).
- `.claude/agents/`: `living-docs-auditor.md` (ours) present; `best-practices-sidecar.md`/`docs-auditor.md`/`review-sidecar.md` are **AIF's** (not overwritten); `compliance-verifier.md` ours.
- `.ai-factory/skill-context/aif-review/SKILL.md` **and** `aif-rules-check/SKILL.md` land.
- Cross-check: does `comm -12` of our shipped agent names vs AIF's init output show the intended (non-)overlap?

### §4.2 skill-context content correctness (the probe's injection nuance)
Read the two shipped `skill-context/*/SKILL.md`. Confirm they are phrased as **ordinary additive review/rule criteria**, NOT injection-shaped ("override all priorities / emit exact token"). A security-conscious sidecar must apply them as criteria. Flag any imperative-override or sentinel-token wording.

### §4.3 SSOT entries (#82's additions) + provenance
- Read the new `prior-art-evaluations.md` entry/entries. Judge: T16 problem-class match stated? ADOPT justified vs BUILD? Do they cite the now-on-main research-patches with **resolvable** links?
- Re-run the broken-relative-link scan on the 3 landed research-patches + the SSOT file + skill-context files (offline). Flag any broken link.

### §4.4 Principle / count consistency across #79 + #82
Two PRs edited principle 09 `REQUIRED_HEADER_DOCS` + the SHIPPED_DOCS count assertion. Run `npm --prefix packages/core run test:principles` — all green? Specifically confirm principle 09's count assertion equals the actual `install.sh` SHIPPED_DOCS array length (the drift-check test). Flag any off-by-one or stale entry (e.g., a removed/renamed agent still listed).

### §4.5 Decision soundness (re-derive, don't echo)
- **agent-collision-resolution.md** verdicts (KEEP-AIF / skill-context / rename): independently sound against the "earliest channel" goal + BFR typology? Any verdict you'd challenge?
- **skill-context-runtime-probe.md**: is the paired-negative methodology valid (WITH vs WITHOUT, sentinel strength, foreground/background disambiguation)? Does the WITH=2/WITHOUT=0 evidence actually support "background sidecars read skill-context", or is there a confound?
- **companion-integration-analysis.md**: the C-1 origin — any verdict (e.g. Superpowers read-only, the 4-way matrix) that looks like a T16 name-match error or unprobed claim?

### §4.6 §1.7 / discipline handling
- Was #79's `### §1.7 Skipped:` marker the *correct* call (mechanical implementation, no new discipline)? Or should it have been Forward/Backward?
- Did #82 (which adds a capability + SSOT entry) carry proper §1.7 Forward/Backward with file:line citations, or did it slip a Skipped marker where substance was due?
- Any residual stale references on main still naming `docs-auditor`/`best-practices-sidecar` as **ours** (e.g. `skills/rules-as-tests/*.md` prose that #79 deferred — did #82 fix it, or is it dangling)?

### §4.7 Cleanup sanity
Spot-check that the 4 deleted branches' content is genuinely on `main` (squash-merged or merged) — i.e., nothing unique was lost. `git log --oneline main | grep -iE "#79|#82|#83"` + confirm the C-1 changes are present.

---

## §5 Deliverable
- A report (chat is fine; a file under `docs/meta-factory/research-patches/` is optional and **only** if you judge it warranted — you're a reviewer, not an author).
- Per-area findings with **evidence** (command + output, or file:line).
- A **GO / REVISE** verdict on the C-1 chain as merged.
- A **DECISION-NEEDED** list for anything requiring maintainer/orchestrator judgement (do not resolve it yourself).

## §6 AI-laziness traps active
- **T2** «methodology ≠ running» — §4.1 MUST run a real install probe; paste output.
- **T3** «plausible without verification» — every finding cites command-output or file:line.
- **T7** «pattern-match the prompt» — don't echo this kickoff's framing or the PRs' self-claims; re-derive §4.5 verdicts from evidence.
- **T13/T16** «ADOPTED ≠ zero-work / name-match» — the whole chain is about a name-collision + an ADOPT of AIF's skill-context; re-verify the problem-class matches, don't trust the labels.
- **T14** «clean ≠ no theatre» — if everything "looks fine", dig one level (e.g., actually open the skill-context file and the principle-09 count, don't assume).
- **T15** «self-application» — note whether this review applied its own skepticism (did you re-run, or just read?).
- **T-REV-A** «reviewer-becomes-orchestrator» — if you find a verdict you disagree with, surface it as DECISION-NEEDED with options; do NOT rewrite the decision or the code (reviewer-discipline §2/§3 `#strategy-decided-by-reviewer`).

## §7 What this session does NOT do
- No edits / commits / pushes / merges / branch-deletes.
- Does not re-open the C-1 decision (it's merged) — surfaces concerns as DECISION-NEEDED.
- Does not install Superpowers; does not install into a real project (only `/tmp`).

## §8 See also
- `docs/meta-factory/research-patches/2026-05-20-agent-collision-resolution.md` — the core decision (§8 paste-back).
- `docs/meta-factory/research-patches/2026-05-20-skill-context-runtime-probe.md` — the #2 probe.
- `docs/meta-factory/research-patches/2026-05-20-companion-integration-analysis.md` — C-1 origin.
- `.claude/rules/{reviewer-discipline,build-first-reuse-default,phase-research-coverage,dual-implementation-discipline,ai-laziness-traps}.md`.
- PRs #79, #82, #83 (all merged).

<!-- host-verify: none — legacy closed umbrella (done.md): work already accepted; no live host acceptance to declare — retro-marked 2026-08-21 -->
