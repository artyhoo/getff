# meta-orchestrator-mode-triage-and-planner — umbrella kickoff

> **Status:** ACTIVE — Stage 1 ready to dispatch. Stages 2-5 scheduled in separate sessions per scope discipline ([CLAUDE.md «PR strategy»](../../../CLAUDE.md), [feedback_no_drive_by_prs](../../../CLAUDE.md)).
> **Created:** 2026-05-26.
> **Base branch:** `staging` (trunk per [`automerge-staging-plan`](../../../docs/meta-factory/automerge-staging-plan.md)). PRs auto-merge into `staging`; maintainer promotes `staging → main`.
> **Single source of truth:** this kickoff for umbrella sequencing; binding spec for substance = [`docs/meta-factory/research-patches/2026-05-25-meta-orchestrator-mode-triage-and-planner-design.md`](../../../docs/meta-factory/research-patches/2026-05-25-meta-orchestrator-mode-triage-and-planner-design.md) (the design).
>
> **Authoritative for:** Stage 1 dispatch protocol + Stages 2-5 cross-session sequencing notes + Phase -1 cold-review framing for the R-phase Worker. Active AI-laziness traps for the R-phase + domain-specific T-MMT-R-A trap.
> **NOT authoritative for:** design substance (§§3-§11 of the design doc); project goal ([README.md#why-this-exists](../../../README.md#why-this-exists)); Mode A/B/SDD/Queue vocabulary (maintainer's global `~/.claude/skills/orchestrator/SKILL.md`, ADOPT-VERBATIM); meta-orchestrator output format ([principle 18](../../../packages/core/principles/18-meta-orchestrator-output-format.test.ts)); the DN-1/DN-2/DN-3 substance (resolved in [design §12](../../../docs/meta-factory/research-patches/2026-05-25-meta-orchestrator-mode-triage-and-planner-design.md)).

---

## §0 Cold-start verify (run before drafting / dispatching anything)

```bash
git fetch origin staging --quiet
git status --short
gh pr list --state open --json number,title,headRefName --limit 20 \
  | jq -r '.[] | "OPEN #\(.number) \(.title) <- \(.headRefName)"'
gh pr list --state merged --search "merged:>=2026-05-23" --json number,title --limit 30 \
  | jq -r '.[] | "MERGED #\(.number) \(.title)"'
# planner helpers must be on disk (PRs #213/#214/#217/#222/#223/#225 merged)
ls -1 .claude/skills/meta-orchestrator/helpers/
# design doc accessible
ls docs/meta-factory/research-patches/2026-05-25-meta-orchestrator-mode-triage-and-planner-design.md
```

Expected (as of 2026-05-26):
- 6 helpers present: `plan-currency-check.sh`, `priority-score.sh`, `dup-detect.sh`, `classify-work.sh`, `assign-skill.sh`, `launch-table-generator.sh`. PLUS `update-cache.sh` (PR #236).
- Design doc tracked on staging (landed via [PR #238](https://github.com/Yhooi2/rules-as-tests-aif/pull/238) — Worker MUST `git fetch origin staging` after PR #238 auto-merges before dispatching its worktree).
- PR #237 (`research/bundle-autonomous-prior-art`) may be OPEN — does NOT block this umbrella per §4. Verify it isn't writing to the same R-phase patch path (`2026-05-26-meta-orchestrator-mode-triage-prior-art.md`) — it isn't; bundle-autonomous targets its own patch slug.
- Local staging at-or-ahead of origin/staging (`git rev-list --count staging..origin/staging` → 0); my 2026-05-26 incident: staging was 4 commits behind including the shipped PR #236 — kickoff drafted on stale state. **Fix: run `git fetch origin staging && git pull --ff-only origin staging` BEFORE any work.** (See memory `feedback_git_fetch_staging_before_drafting`, incident 2/3.)

---

## §1 Origin & gate state

**Origin:** maintainer brainstorm 2026-05-25 surfaced 4 extensions to `/meta-orchestrator` ([design §0](../../../docs/meta-factory/research-patches/2026-05-25-meta-orchestrator-mode-triage-and-planner-design.md)). Design doc was drafted same day with 3 cold-review fixes applied (B-1 / B-2 / M-3, design §0, §8, §9). Landed to staging 2026-05-26 via [PR #238](https://github.com/Yhooi2/rules-as-tests-aif/pull/238) (orchestrator-amended for DN-2-revised per Phase -1 iter-1 finding — design §7.2 body retained for diff-lineage; binding answer = DN-2-revised below).

**Maintainer GATE 1 inputs received 2026-05-26 (recorded by orchestrator session, not the design):**

| # | Decision | Maintainer answer | Effect |
|---|---|---|---|
| **DN-1** | Scope of `// TODO:` scan ([design §6](../../../docs/meta-factory/research-patches/2026-05-25-meta-orchestrator-mode-triage-and-planner-design.md)) | **(a)** `packages/**/*.ts` only — conservative, expand on incident | R-phase Worker uses (a); does NOT need to re-survey options (b)/(c) |
| **DN-2-revised** | Master-plan persistence location ([design §7.2](../../../docs/meta-factory/research-patches/2026-05-25-meta-orchestrator-mode-triage-and-planner-design.md)) — **REVISED from design's (a) to β shadow-file pattern**. Phase -1 cold-review iter-1 (2026-05-26) surfaced direct conflict with shipped sister R-phase verdict: [`2026-05-25-plan-memory-rphase.md:34`](../../../docs/meta-factory/research-patches/2026-05-25-plan-memory-rphase.md) — *«automated editing of §0 carries HIGH blast radius risk»*; [`:116`](../../../docs/meta-factory/research-patches/2026-05-25-plan-memory-rphase.md) — concurrent-write race confirmed by 19 file-commits + 23 worktree-adjacent commits in 90 days. PR #230 REJECTED Direction A; PR #236 shipped Direction B ([SSOT #77](../../../docs/meta-factory/prior-art-evaluations.md) ADAPT Cline Memory Bank, `_plan-cache.md` + `update-cache.sh` + `references/plan-cache.md`). | **β shadow-file** confirmed by maintainer 2026-05-26. R-phase Worker (Area B) MUST pick between β-1 and β-2 with evidence:<br>• **β-1 — Extend `_plan-cache.md` schema** with new `## NEW-SINCE-LAST` / `## RESOLVED-SINCE-LAST` sections. Risk: triggers [`references/plan-cache.md §4`](../../../.claude/skills/pipeline/references/plan-cache.md) anti-pattern `#cache-writer-feature-creep` — Worker MUST address.<br>• **β-2 — Sibling shadow file** `.claude/orchestrator-prompts/_master-backlog-delta.md` with its own `update-master-backlog.sh` writer. Avoids `#cache-writer-feature-creep` but doubles per-machine artefact surface.<br>Both honor Direction B (NO auto-write to `wave-sequencing-plan.md`). |
| **DN-3** | Alias layer split | ✅ Resolved 2026-05-25 in [design §12](../../../docs/meta-factory/research-patches/2026-05-25-meta-orchestrator-mode-triage-and-planner-design.md) — single source = SKILL.md body, `classify-work.sh` UNCHANGED | already binding |

**Remaining GATE 1 closure criterion:** maintainer accepts R-phase verdicts (Stage 1 output, see §3) **including Worker's β-1 vs β-2 recommendation**.

---

## §2 Definition of done — Stage 1 only (this session)

A single research-patch file landed to `staging` (or PR-open + auto-merge): `docs/meta-factory/research-patches/2026-05-26-meta-orchestrator-mode-triage-prior-art.md` covering **3 distinct areas**, each with verdict per [`build-first-reuse-default.md §1`](../../../.claude/rules/build-first-reuse-default.md) (ADOPT / ADOPT-VOCAB / ADAPT / REFERENCE / KEEP-NARROW / BUILD / REJECT).

**The 3 areas (mutually exclusive — Worker MUST treat as 3 separate prior-art universes per T-MMT-R-A, §7):**

1. **Area A — Discovery sweep extension** ([design §6](../../../docs/meta-factory/research-patches/2026-05-25-meta-orchestrator-mode-triage-and-planner-design.md)). 3 new synthetic-namespace surfaces in `priority-score.sh`: `openq-§13-<id>` / `todo-<file>-<line>` (scope: `packages/**/*.ts` per DN-1) / `residual-<patch>-<anchor>`.
2. **Area B — Master-plan persistence & delta-tracking** ([design §7.1 + §7.2](../../../docs/meta-factory/research-patches/2026-05-25-meta-orchestrator-mode-triage-and-planner-design.md), with §7.2 binding answer SUPERSEDED by **DN-2-revised (§1) = β shadow-file pattern**). Two sub-components: (i) §7.1 delta-tracking (NEW-SINCE-LAST / RESOLVED-SINCE-LAST) — Worker picks JSON side-car vs co-located in `_plan-cache.md` vs sibling `.md` shadow; (ii) §7.2 master-plan auto-update — Worker picks β-1 (extend `_plan-cache.md` schema) vs β-2 (sibling `_master-backlog-delta.md`). **NO direct write to `wave-sequencing-plan.md §0`** under either branch (Direction A REJECTED per §1).
3. **Area C — Triage alias layer** ([design §9](../../../docs/meta-factory/research-patches/2026-05-25-meta-orchestrator-mode-triage-and-planner-design.md)). ALIAS table computed in SKILL.md body AFTER §5 routing tree (per DN-3); `classify-work.sh` unchanged.

**Stage 1 is NOT:** writing any code, modifying helpers, modifying SKILL.md, writing principle tests, opening PRs that touch `packages/` or `.claude/skills/`. It is ONLY the research-patch. I-phase work belongs to Stages 2-4 ([design §13](../../../docs/meta-factory/research-patches/2026-05-25-meta-orchestrator-mode-triage-and-planner-design.md)).

---

## §3 Stage 1 — R-phase dispatch (Mode A inline, ~60-100k Opus; Phase -1 cold-review required pre-dispatch)

**Worker session profile:**
- Fresh Opus session, isolated worktree per [`parallel-subwave-isolation.md §1`](../../../.claude/rules/parallel-subwave-isolation.md) (`git worktree add ../rules-as-tests-aif-mode-triage-rphase staging`).
- Read-only on `packages/`, `.claude/skills/`, `.claude/rules/` — Worker produces ONE new file under `docs/meta-factory/research-patches/`.
- Worker output committed + PR opened (`research(meta-orchestrator-mode-triage): prior-art survey for discovery sweep + master-plan persistence + alias layer`); auto-merge into `staging`.

**Required research-patch sections (Worker MUST produce all):**

- **§0 Cold-start verify** — re-run §0 above; record `gh pr list` snapshot at session start (precedent: every recent R-phase patch in `research-patches/`).
- **§0.1 Population enumeration (T10 counter)** — for each of 3 areas, enumerate the *candidate-universe* before sampling. E.g. Area A: list of every known backlog-discovery tool considered; Area B: every state-persistence pattern surveyed; Area C: every user-facing-alias convention surveyed.
- **§1 — Area A prior-art** (discovery sweep extension):
  - Internal precedents: `priority-score.sh` (PR #214) existing surfaces (a)-(e) — verify forward-going style match. `plan-currency-check.sh` (PR #217) UNTRACKED-N / UNTRACKED-KICKOFF.
  - External precedents (≥3 phrasings each): «AI-agent backlog auto-discovery», «open-questions registry grep tooling», «`// TODO:` aggregation production tools». Cite candidates via WebSearch + context7 + DeepWiki (`mcp__deepwiki__ask_question` for `aif-handoff` / `OhMyOpencode` / Superpowers / Cline).
  - SSOT consult for prior verdicts ([`prior-art-evaluations.md`](../../../docs/meta-factory/prior-art-evaluations.md)).
  - Verdict per area (ADOPT / ADAPT / BUILD / etc.) with T16 problem-class match: «Upstream problem class: X. Our problem class: Y. Match? Evidence: …».
- **§2 — Area B prior-art** (master-plan persistence + delta-tracking):
  - **Adjacent shipped work** (mandatory awareness, M1 finding from Phase -1 iter-1): `meta-orchestrator-plan-memory-rphase` umbrella ([PR #230](https://github.com/Yhooi2/rules-as-tests-aif/pull/230) R-phase + [PR #236](https://github.com/Yhooi2/rules-as-tests-aif/pull/236) implementation, [SSOT #77](../../../docs/meta-factory/prior-art-evaluations.md), shipped `.claude/orchestrator-prompts/_plan-cache.md` + `.claude/skills/meta-orchestrator/helpers/update-cache.sh` + `.claude/skills/meta-orchestrator/references/plan-cache.md`). **Problem class** = cross-session SESSION-memory (last priority ranking, surfaced DRIFT, pending DECISION-NEEDED, deferred follow-ups). **DISTINCT from §7.1** = delta-tracking master-backlog (NEW-SINCE-LAST / RESOLVED-SINCE-LAST items since last git HEAD). Worker MUST establish T16 class separation explicitly: «Upstream (Cline ADAPT in PR #236) class: X. Our §7.1 class: Y. Match evidence: …»
  - Internal precedents: existing skill `!shell` injection patterns in [SKILL.md §1](../../../.claude/skills/pipeline/SKILL.md). **No `state/` subdirectory exists today** in `.claude/skills/meta-orchestrator/` — do NOT search for it. The only adjacent persistence artefact today is `_plan-cache.md` (per above, gitignored, at `.claude/orchestrator-prompts/`) — same machine-local pattern, distinct problem class.
  - External precedents (≥3 phrasings each): «sweep-since-last-check delta pattern», «AI agent backlog-state delta-tracking», «git-HEAD-bound state cache pattern». DeepWiki on `Cline` / `aif-factory` / `aif-handoff` / Superpowers. T13 caveat: Cline Memory Bank was already ADAPTED for `_plan-cache.md` — re-using «we already have it» framing for §7.1 is exactly T13.
  - SSOT consult.
  - **Verdict per sub-component, given DN-2-revised = β shadow-file:**
    - §7.1 `last-check.json` (delta-tracking): pick from `state/last-check.json` JSON side-car OR co-locate in `_plan-cache.md` schema (β-1) OR sibling `.md` shadow (β-2). Worker recommends with evidence per §1 DN-2-revised entry.
    - §7.2 master-plan auto-update: **NO direct write to `wave-sequencing-plan.md §0`** (Direction A REJECTED per §1 DN-2-revised). Worker picks β-1 vs β-2 per §1 DN-2-revised; the design §7.2 BODY is SUPERSEDED by the kickoff §1 DN-2-revised entry on this point.
- **§3 — Area C prior-art** (triage alias layer):
  - Internal precedent: maintainer's global `~/.claude/skills/orchestrator/SKILL.md` Mode A/B/SDD/Queue vocab — ADOPT-VERBATIM is already the design's verdict (§3 reframing 4); R-phase verifies *no upstream parallel-evolution* would alter this.
  - External precedents (≥3 phrasings each): «CLI mode aliases UX», «user-facing labels over internal mechanism» (Superpowers `subagent-driven-development` PAIR analog; aif-handoff RuntimeAdapter), «override flag convention research». SSOT #43 (RuntimeAdapter, ADOPT VOCABULARY) precedent.
  - Verdict for the alias-mapping shape, the override-flag set (§10), and the «emit ALIAS in SKILL.md body NOT helper» architectural choice (DN-3 ratified).
- **§4 — Verdict summary table** — single table with rows = (Area A sub-items × Area B sub-items × Area C sub-items), columns = (Verdict, Cited SSOT row or new-row-needed, Falsifier, Integration cost estimate).
- **§5 — Falsifiers (≥1 per area; ≥3 total)** — what evidence would invalidate each verdict. E.g. «Area A BUILD verdict wrong if upstream tool X solves identical problem class within 90 days of patch landing».
- **§6 — §1.7 Forward+Backward self-reflexive check** ([`phase-research-coverage.md §1.7`](../../../.claude/rules/phase-research-coverage.md)) — Forward: complies with `build-first-reuse-default.md §1` / `no-paid-llm-in-ci.md §1` / `doc-authority-hierarchy.md §3` / `dual-implementation-discipline.md §3` / `ai-laziness-traps.md §3` / `reviewer-discipline.md §2` / `parallel-subwave-isolation.md §1`. Backward: what existing artefacts may need updating (SSOT new rows? principle test references? rule cross-links?).
- **§7 — Active T-trap citations** (mandatory per [`ai-laziness-traps.md §3`](../../../.claude/rules/ai-laziness-traps.md)): enumerate T1, T3, T7, T10, T11, T12, T13, T15, T16, T17, T19, T20, plus the design's T-MO-design-A reference, plus this kickoff's domain-specific **T-MMT-R-A** and **T-MMT-R-B** (§7 below).

**Worker must NOT:**

- Modify `packages/`, `.claude/skills/`, `.claude/rules/` source code (Stage 2-4 territory).
- Skip §1 prior-art per any area (`#prompt-list-anchoring` per [`phase-research-coverage.md §4`](../../../.claude/rules/phase-research-coverage.md) — 3-candidate floor is NOT ceiling).
- Bundle the 3 areas into one survey (T-MMT-R-A, §7).
- Issue inline verdicts without evidence-bearing tool call in the same turn (T20).
- Defer DN-1/DN-2 — they are answered (**DN-1 = (a), DN-2 = β per DN-2-revised in §1**). Work as binding.

---

## §4 Stages 2-5 — scheduled for separate sessions (out of scope HERE)

[Design §13](../../../docs/meta-factory/research-patches/2026-05-25-meta-orchestrator-mode-triage-and-planner-design.md) prescribes:

- **Stage 2** — mixed parallel + serial I-phase:
  - 2A — extend `priority-score.sh` with 3 new discovery surfaces. Worktree. Parallel-safe with 2B.
  - 2B — add §7.1 delta-tracking artefact (**concrete shape TBD pending Stage 1 R-phase verdict between JSON side-car / β-1 / β-2**) + any needed `.gitignore` entries. Worktree. Parallel-safe with 2A.
  - 2C — wire new SKILL.md §2.5 (L3/L4/L5) + §9 alias table. Serial — runs after 2A+2B merge to staging.
- **Stage 3** — master-plan auto-update mechanism (§7.2) **= shadow-file pattern per DN-2-revised** (β-1 extension of `_plan-cache.md` writer OR β-2 sibling writer per Stage 1 R-phase verdict). Single PR, depends on Stage 2 complete. **NO direct write to `wave-sequencing-plan.md §0`.**
- **Stage 4** (optional) — override flags ([design §10](../../../docs/meta-factory/research-patches/2026-05-25-meta-orchestrator-mode-triage-and-planner-design.md)). Only if 2-3 stable.
- **Stage 5** — dogfood: first `/meta-orchestrator` invocation on a real backlog item using new pipeline + cold-review per [T19](../../../.claude/rules/ai-laziness-traps.md).

**This kickoff dispatches Stage 1 ONLY.** Stage 2 needs its own kickoff (or extension to this file) after Stage 1 verdicts are accepted by maintainer. Per [feedback_no_drive_by_prs](../../../CLAUDE.md): do not pre-dispatch Stage 2 «while we're here».

---

## §5 Hard constraints (whole umbrella)

- **[`no-paid-llm-in-ci.md §1`](../../../.claude/rules/no-paid-llm-in-ci.md):** R-phase Worker uses subscription-bundled tools (WebFetch / WebSearch / DeepWiki MCP / context7 MCP). Stages 2-4 will produce deterministic bash helpers + plain TS principle tests — zero API-billed calls.
- **[`build-first-reuse-default.md §3`](../../../.claude/rules/build-first-reuse-default.md):** 6-item search check mandatory per area in Stage 1. Floor ≥3 phrasings × WebSearch + ≥3 phrasings × DeepWiki + SSOT consult.
- **[`phase-research-coverage.md §1.7 / §1.11 / §1.12 / §1.13`](../../../.claude/rules/phase-research-coverage.md):** R-phase recommendation grounded in tool-call evidence (§1.12); verify-against-source-of-truth before any «X exists» / «X doesn't exist» claim (§1.11); AI-doc research starts Tier-1 (Claude Code / AIF / OhMyOpencode) before generic Anthropic best-practices (§1.13).
- **[`doc-authority-hierarchy.md §3`](../../../.claude/rules/doc-authority-hierarchy.md):** R-phase patch carries Authoritative-for header at top (precedent: every existing research-patch in `docs/meta-factory/research-patches/`).
- **[`dual-implementation-discipline.md §3`](../../../.claude/rules/dual-implementation-discipline.md):** R-phase patch evaluates channel per area — Area A (helper extension) = CC-only `@cc-only-rationale` candidate; Area B (state file) = same; Area C (alias) = SKILL.md body = consumer-facing → revisit dual-channel ramifications in §6 of the patch.
- **[`parallel-subwave-isolation.md §1`](../../../.claude/rules/parallel-subwave-isolation.md):** R-phase Worker dispatched in dedicated worktree; Stages 2A + 2B (future) each in own worktree.
- **[`ai-laziness-traps.md §3`](../../../.claude/rules/ai-laziness-traps.md):** kickoff enumerates T-numbers (§7) + adds domain-specific T-MMT-R-A (§7). NOT blanket-reference.
- **[`reviewer-discipline.md §2`](../../../.claude/rules/reviewer-discipline.md):** R-phase Worker MAY surface NEW decision-needed items found during prior-art (e.g. «upstream tool surfaced, ADOPT vs ADAPT non-obvious») — surface via `DECISION-NEEDED: …` lines, do NOT pick.
- **[`recommendation-laziness-discipline.md §3`](../../../.claude/rules/recommendation-laziness-discipline.md):** every verdict word (ADOPT / ADAPT / BUILD / REJECT / DEFER / KEEP-NARROW / ADOPT-VOCAB) cites SSOT row OR file:line evidence OR Bash/WebFetch/grep output in the same turn (T20).

---

## §6 Falsifiers (whole umbrella, R-phase scope)

- R-phase Worker surfaces an upstream tool that solves Area A / B / C as one bundle → re-think 3-area decomposition (could collapse to fewer or rebrand).
- R-phase Worker finds Cline Memory Bank or similar state-persistence already covers §7.1 schema verbatim → ADOPT, drop `BUILD` for Area B sub-item.
- R-phase Worker discovers `~/.claude/skills/orchestrator/SKILL.md` Mode vocab has drifted upstream (Superpowers `subagent-driven-development` SDD label changed, AIF Mode A/B renamed) → flag `#adopted-pattern-drift` per [`phase-research-coverage.md §4`](../../../.claude/rules/phase-research-coverage.md).
- R-phase Worker concludes ALL 3 areas REJECT (no useful design extension survives prior-art) → umbrella stops at Stage 1 close; design doc moves to FROZEN.
- An incident occurs DURING the R-phase (e.g. Worker auto-merges its own PR while writing the patch) → confirming evidence for the defer-reflex umbrella sibling work, not a failure of this R-phase.

---

## §7 Active AI-laziness traps (cite [`ai-laziness-traps.md §2`](../../../.claude/rules/ai-laziness-traps.md) explicitly; kickoff §3 obligation)

- **T1** — sampling 3 candidates per area then closing. Counter: §1-§3 of the patch must enumerate per area before sampling; population-enumeration BEFORE sampling.
- **T3** — plausible-finding-without-verification. Counter: every prior-art citation has command + output OR file:line content quoted.
- **T7** — pattern-matching the prompt literally. Counter: Worker reads design §6/§7/§9 + this kickoff §2-§3, but reasons about *whether* the proposed approach is right per area, NOT just rubber-stamps.
- **T11** — designing without prior-art check on each AREA separately. Counter: §1 / §2 / §3 of the patch each carry independent BFR §3 6-item check.
- **T12** — skipping literature sweep because «I know discovery / state-files / aliases». Counter: WebSearch + DeepWiki ≥3 phrasings even if Worker «remembers» relevant tools.
- **T10** — completeness based on what you LOOKED at, not what EXISTS. Counter: §0.1 of patch enumerates candidate-universe per area BEFORE sampling; §4 verdict table flags «sampled N / population K» per area to make coverage measurable.
- **T13** — treating ADOPTED-VERBATIM Mode A/B/SDD/Queue vocab as zero-work; treating Cline Memory Bank ADAPT (SSOT #77, PR #236) as «already done» for Area B §7.1. Counter: verify upstream hasn't drifted; for Area B specifically — `_plan-cache.md` covers SESSION-memory, NOT delta-tracking; re-running the T16 problem-class check is required.
- **T15** — self-application skipped. Counter: §6 of the patch (§1.7 self-reflexive check) MANDATORY; the R-phase audits itself the way it audits future R-phases.
- **T16** — pattern-matching-on-name. E.g. Cline «Memory Bank» sounds like Area B `state/last-check.json` but the problem class is «agent task memory across sessions», not «discovery sweep-diff over time». Counter: explicit «Upstream class: X / Our class: Y / Match evidence: …» per citation.
- **T17** — destructive delegation. Counter: R-phase produces ONE new file; zero destructive ops; no force-push.
- **T19** — own cold-QA before handoff. Counter: Worker session MUST run a self-cold-review pass on the patch before opening PR (read the diff cold, check §1.7 substance, verify no fabricated citations) — independent of any orchestrator-side cold-review.
- **T20** — inline-verdict-without-evidence. Counter: every verdict word in §4 of the patch cites Bash/WebFetch/grep evidence in the same turn it lands.
- **T-MO-design-A** (design's own trap, [design §0](../../../docs/meta-factory/research-patches/2026-05-25-meta-orchestrator-mode-triage-and-planner-design.md)) — «alias inline emit attractor». Worker MUST NOT propose re-injecting ALIAS into `classify-work.sh` output even if a fresh-eye reading makes it look attractive. Counter: §3 of patch ratifies single-source SKILL.md body.

**Domain-specific traps (per [`ai-laziness-traps.md §3`](../../../.claude/rules/ai-laziness-traps.md) obligation: ≥1 NOT in canonical catalogue):**

- **T-MMT-R-A — «domain-bundling collapse»** (structural variant of T1/T11 applied to this 3-area shape, but the failure surface is concrete enough to warrant its own callout). Tempted to merge the 3 areas (discovery sweep / master-plan persistence / alias layer) into one consolidated prior-art table because they all live under the meta-orchestrator umbrella. Each area has its OWN prior-art universe — Area A is closest to «backlog auto-discovery tools», Area B is closest to «AI agent state persistence (Cline Memory Bank et al)», Area C is closest to «CLI mode-alias UX». Collapsing means the patch under-samples 2 of 3 universes. Counter: §1 / §2 / §3 of the patch are physically separate sections with their own SSOT-consult / WebSearch / DeepWiki blocks; verdict table §4 has area-tagged rows.
- **T-MMT-R-B — «meta-self-universe confusion»** (genuinely novel, M5 sharpening per Phase -1 iter-1 finding). The Worker session runs INSIDE the meta-orchestrator subsystem it researches. Tempted to scope «prior art» to the project's OWN past meta-orchestrator work (helpers, SKILL.md history, internal R-phases) and call that complete, instead of surveying the EXTERNAL prior-art universe for each capability being designed (backlog tools / state-files / alias UX outside our repo). The trap fires because internal prior-art is convenient (file-system grep) while external requires WebSearch + DeepWiki round-trips. Counter: every §1/§2/§3 area MUST cite ≥2 external precedents (non-rules-as-tests-aif, non-Claude-Code-specific) before closing — internal precedents are necessary but not sufficient. Failure mode look-alike: «we already have a `priority-score.sh` so Area A is solved» — that's the trap; the question isn't «what do WE have», it's «what does the WORLD have that we could ADOPT/ADAPT instead».

---

## §8 §1.7 stubs for the R-phase patch PR body (template — Worker fills in)

```markdown
### §1.7 Forward-check applied

- `build-first-reuse-default.md §3` (file:line: `.claude/rules/build-first-reuse-default.md:<line>`) — 6-item search check completed per area A/B/C; verdicts cite SSOT rows + WebSearch + DeepWiki evidence.
- `no-paid-llm-in-ci.md §1` (file:line: `.claude/rules/no-paid-llm-in-ci.md:<line>`) — only subscription-bundled tools used; no API-billed calls in the patch surface or downstream Stages 2-4 design.
- `doc-authority-hierarchy.md §3` (file:line: `.claude/rules/doc-authority-hierarchy.md:<line>`) — R-phase patch carries Authoritative-for + NOT-authoritative-for header.
- `phase-research-coverage.md §1.7 / §1.11 / §1.12 / §1.13` (file:line: `.claude/rules/phase-research-coverage.md:<line>`) — self-reflexive section §6 walks the patch through §1.1-§1.7 + §2.1-§2.5.
- `ai-laziness-traps.md §3` (file:line: `.claude/rules/ai-laziness-traps.md:<line>`) — T-numbers enumerated (§7); domain-specific T-MMT-R-A defined inline.
- `parallel-subwave-isolation.md §1` (file:line: `.claude/rules/parallel-subwave-isolation.md:<line>`) — Worker session ran in dedicated worktree.
- `recommendation-laziness-discipline.md §3` (file:line: `.claude/rules/recommendation-laziness-discipline.md:<line>`) — every verdict word cites evidence in same-turn tool-call.

### §1.7 Backward-check applied

- Design doc [`2026-05-25-meta-orchestrator-mode-triage-and-planner-design.md`](../../../docs/meta-factory/research-patches/2026-05-25-meta-orchestrator-mode-triage-and-planner-design.md) status — design landed via PR #238 with §7.2 body retained for diff-lineage but **explicitly SUPERSEDED by kickoff §1 DN-2-revised** (β shadow-file pattern, NOT original Direction A). Backward-check MUST explicitly call out this supersession; if Stage 1 R-phase verdict invalidates further design assumptions, list them.
- SSOT [`prior-art-evaluations.md`](../../../docs/meta-factory/prior-art-evaluations.md) gains <N> new rows (or 0 if all candidates already registered); row IDs listed.
- Stage 2/3/4 kickoff to be drafted in separate session per [feedback_no_drive_by_prs](../../../CLAUDE.md); this patch does NOT modify `priority-score.sh` / `SKILL.md` / `classify-work.sh`.
- No `.claude/rules/*.md` modified by this R-phase.
- No principle test modified by this R-phase.
```

---

## §9 See also

- [`docs/meta-factory/research-patches/2026-05-25-meta-orchestrator-mode-triage-and-planner-design.md`](../../../docs/meta-factory/research-patches/2026-05-25-meta-orchestrator-mode-triage-and-planner-design.md) — design doc, binding spec for substance.
- [`docs/meta-factory/research-patches/2026-05-25-planner-completeness-prior-art.md`](../../../docs/meta-factory/research-patches/2026-05-25-planner-completeness-prior-art.md) — predecessor R-phase that surfaced L3/L4/L5 helpers (PRs #213/#214/#217/#222/#223/#225).
- [`.claude/skills/meta-orchestrator/SKILL.md`](../../../.claude/skills/pipeline/SKILL.md) — skill body the design extends (untouched in Stage 1).
- [`.claude/skills/meta-orchestrator/helpers/`](../../../.claude/skills/pipeline/helpers/) — L1-L5 helpers + `launch-table-generator.sh` (untouched in Stage 1).
- [`.claude/orchestrator-prompts/meta-orchestrator-bundle-autonomous/kickoff.md`](../meta-orchestrator-bundle-autonomous/kickoff.md) — EXTERNAL bundle direction umbrella ([design §11](../../../docs/meta-factory/research-patches/2026-05-25-meta-orchestrator-mode-triage-and-planner-design.md)); independent scheduling.
- [`docs/meta-factory/wave-sequencing-plan.md`](../../../docs/meta-factory/wave-sequencing-plan.md) — master plan; per DN-2-revised the meta-orchestrator does **NOT** auto-edit §0 of this file. Stage 3 produces a shadow-file writer instead.
- [`.claude/skills/meta-orchestrator/references/plan-cache.md`](../../../.claude/skills/pipeline/references/plan-cache.md) + [`helpers/update-cache.sh`](../../../.claude/skills/pipeline/helpers/update-cache.sh) — Direction B precedent (PR #236, [SSOT #77](../../../docs/meta-factory/prior-art-evaluations.md)) that DN-2-revised aligns with.
- [`docs/meta-factory/research-patches/2026-05-25-plan-memory-rphase.md`](../../../docs/meta-factory/research-patches/2026-05-25-plan-memory-rphase.md) — sister R-phase whose Direction A REJECT verdict drove DN-2-revised.
- [`docs/meta-factory/prior-art-evaluations.md`](../../../docs/meta-factory/prior-art-evaluations.md) — SSOT consulted per area in R-phase.
- [`.claude/rules/build-first-reuse-default.md`](../../../.claude/rules/build-first-reuse-default.md), [`.claude/rules/ai-laziness-traps.md`](../../../.claude/rules/ai-laziness-traps.md), [`.claude/rules/phase-research-coverage.md`](../../../.claude/rules/phase-research-coverage.md), [`.claude/rules/doc-authority-hierarchy.md`](../../../.claude/rules/doc-authority-hierarchy.md), [`.claude/rules/no-paid-llm-in-ci.md`](../../../.claude/rules/no-paid-llm-in-ci.md), [`.claude/rules/dual-implementation-discipline.md`](../../../.claude/rules/dual-implementation-discipline.md), [`.claude/rules/parallel-subwave-isolation.md`](../../../.claude/rules/parallel-subwave-isolation.md), [`.claude/rules/reviewer-discipline.md`](../../../.claude/rules/reviewer-discipline.md), [`.claude/rules/recommendation-laziness-discipline.md`](../../../.claude/rules/recommendation-laziness-discipline.md) — discipline rules consulted in §5 / §7.

---

## §10 How the next session starts

**Stage 1 dispatch (next):**

```bash
# In current orchestrator session, after Phase -1 cold-review iter-2 returns GO + PR #238 auto-merges:
git fetch origin staging --quiet
git worktree add ../rules-as-tests-aif-mode-triage-rphase origin/staging
cd ../rules-as-tests-aif-mode-triage-rphase
git checkout -b research/meta-orchestrator-mode-triage-prior-art
# Verify design doc present in worktree (PR #238 must have merged):
ls docs/meta-factory/research-patches/2026-05-25-meta-orchestrator-mode-triage-and-planner-design.md
# THEN dispatch Mode A Worker via Agent tool with isolation:"worktree" pointed at this kickoff §3 + §5 + §7. <!-- channel-discipline: allow historical pre-rule instance (2026-05-25, before the rule; closed umbrella) — surfaced in Stage B PR notes -->
```

Per [`parallel-subwave-isolation.md §1`](../../../.claude/rules/parallel-subwave-isolation.md): `git worktree add` MUST be followed by `git checkout -b <branch>` before any commit. Worker commits to `research/meta-orchestrator-mode-triage-prior-art`, opens PR with base=staging, auto-merge enabled.

**OR** maintainer pastes this kickoff §1 + §2 + §3 + §5 + §7 into a fresh Opus session under `/orchestrator` (or directly under `/aif-aware` if available) and tells it «R-phase only, return research-patch». In that case the maintainer also runs the worktree setup above before pasting.

**Stage 2 dispatch (later session):** new kickoff at `.claude/orchestrator-prompts/meta-orchestrator-mode-triage-and-planner/stage-2.md` (do NOT pre-write in this session per [feedback_no_drive_by_prs](../../../CLAUDE.md)).
