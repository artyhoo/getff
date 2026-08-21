# Final quality audit — umbrella kickoff

> **For:** `/pipeline final-quality-audit` (or direct orchestrator session). Multi-stage R→I umbrella.
> **Mode:** Mode B (worktree-isolated parallel R-audits; I-fix waves file-disjoint).
> **PR base:** `staging`. Each stage = own PR(s); stage-gate (Phase -1 cold-review) between stages.
> **Commissioned:** maintainer, 2026-06-10 («полный финальный аудит всего: документация, AI-доки, исполнение на best practices, качество скилов — и исправление, если что-то устарело, криво или забаговано; особое внимание tool-bootstrapping + skill-context + автоматика при установке и изменении зависимостей»).

## §0 Pre-seeded findings (CONFIRMED 2026-06-10 — audit starts from these, not from zero)

Recon by meta-orchestrator on live e2e consumers (`/tmp/oci-verify-dthv/consumer-{ts,next}`, staging snapshot 613a685):

| # | Finding | Evidence | Severity (prelim) |
|---|---|---|---|
| P1 | **tool-bootstrapping automation DEAD on the main install path.** `./setup` + `setup.d/*` contain ZERO mentions of `tool-decisions`/`context7`/`ai-factory init` (grep verified); the bootstrap lived only in legacy `setup.sh` (7 mentions). `deps-hash-check.sh` line ~20: `[ -f "$DECISIONS" ] || exit 0` → no tool-decisions.md ⇒ hook silently never fires. Consumer installed via `./setup` has the hook wired in `.claude/settings.json` but the entire deps-change → re-evaluation chain is inert. Template `tool-decisions.md.template` IS delivered but nothing instantiates it. | grep on staging-613a685 snapshot; both /tmp consumers lack `.ai-factory/tool-decisions.md` | BLOCKER-class |
| P2 | **skill-context ships 2 of 3.** `aif-orchestrator-discipline/SKILL.md` is in `install.sh` SHIPPED_DOCS (header-verified at every install) but absent from the copy step — both consumers have only `aif-review` + `aif-rules-check` under `.ai-factory/skill-context/`. Verify-list ≠ copy-list drift. | `ls` both consumers; install.sh SHIPPED_DOCS block | MAJOR |
| P3 | **tool-bootstrapping SKILL.md stale.** Last substantive commit 2026-05-11 (`b1e9c5e`) — predates `./setup`, the `/meta-orchestrator`→`/pipeline` rename, skill-context delivery (#390/#396), opt-in bridge. References inside are unaudited since. | `git log -- skills/tool-bootstrapping/` | MAJOR (suspected; audit confirms per-line) |
| P4 | Known doc-drift backlog: stale «≤500» in CONTRIBUTING.md:38 + EXECUTION-PLAN.md:699 (chip task_2f0a01a3 may close it first — check before duplicating); `wave-sequencing-plan.md §0` reconciled 2026-06-02, ~70 PRs behind; umbrella spec/plan docs carry stale code snapshots (accepted residual, historical docs). | prior session evidence | MINOR/known |

## §1 Goal (one line)

Every shipped and internal AI-facing artefact is **current, correct, and best-practice-compliant**, the tool-bootstrapping automation chain **actually fires end-to-end** (install-time bootstrap → deps-change detection → re-evaluation proposal), and every found defect is either fixed in this umbrella or explicitly routed (DECISION-NEEDED / follow-up) — nothing closed by prose.

## §2 Stage map

| Stage | Sub-waves | Parallel? | Depends on | Branch prefix |
|---|---|---|---|---|
| **S1 R-audit** | A shipped-surface, B tool-bootstrapping-automation, C internal-AI-docs, D skills-quality | **yes — 4 read-only, disjoint outputs** | — | `worktree-fqa-s1-{a,b,c,d}` |
| **S2 Consolidation** | single session: merged fix-plan + DECISION-NEEDED list | no | S1 ×4 merged | `worktree-fqa-s2-plan` |
| **S3 I-fix** | N file-disjoint fix waves (N decided by S2 plan; expect 2–4) | yes within wave | S2 merged + maintainer GO on DECISION-NEEDED items | `worktree-fqa-s3-<cluster>` |
| **S4 Re-verify + close** | falsifier re-runs + fresh e2e install probe + done.md | no | S3 all merged | `worktree-fqa-s4-verify` |

Each S1 sub-wave output = one research-patch at `docs/meta-factory/research-patches/2026-06-XX-fqa-<letter>-<slug>.md` (**principle 10: scope annotation required**; folder README authority covers headers). S1 PRs are docs-only.

### S1-A — shipped-surface audit (install payload)

Population = the FULL install payload (~80 files per stack, enumerate first from a fresh e2e install — not from memory) + the SHIPPED_DOCS list itself. For each artefact: (1) verify-list ↔ copy-list ↔ actually-landed three-way diff (P2 is the known instance — find ALL); (2) content currency vs today's staging (references to removed flags/paths/lines, e.g. post-S1 install.sh trim, `/pipeline` rename); (3) AI-doc best practices per `/ai-doc` skill standard: Authoritative-for headers, context hygiene (hot/cold split), progressive disclosure, AI-agnostic wording; (4) cross-refs resolve (the install rewrites cross-refs to GitHub URLs — sample ≥10, click-verify). Includes the 5 `.claude/agents/*` and consumer `.claude/settings.json` hook block.

### S1-B — tool-bootstrapping automation deep audit (the maintainer's special-attention item)

Scope: `skills/tool-bootstrapping/**` (SKILL.md + references + templates) + `.claude/hooks/deps-hash-check.sh` + its `packages/core/hooks/` source twin (`@dual-pair: deps-hash-check-dogfood`; byte-identity test #383) + the install-time bootstrap path + `.ai-factory/tool-decisions.md` lifecycle.

Mandatory empirical probes (commands + outputs in the patch — no prose-only):
1. **Chain liveness, mechanical:** on a throwaway consumer — instantiate tool-decisions.md from the template with a computed deps-hash; run the hook → expect silent exit 0; add a dependency to package.json; run the hook again with simulated UserPromptSubmit stdin → expect the WARN line on stdout. Quote both runs. (This is the «изменение проекта — добавление новых зависимостей» path.)
2. **Install-time bootstrap:** confirm P1 — then design the fix: where does bootstrap belong on the new path (`install.sh` step vs `setup.d/` lib vs first-session skill instruction)? Evaluate against spec §2 («thin orchestrator») + dual-implementation §3 + what legacy setup.sh did (its 7 tool-decisions mentions are the prior art — read them). Propose ONE recommended fix shape with falsifier; genuine forks → DECISION-NEEDED.
3. **SKILL.md currency line-by-line** (it is the OLDEST shipped artefact, 2026-05-11): every command, path, trigger phrase, and flow tested against today's reality; every claim about the hook checked against the hook's actual code (`#two-prompts-drift` check — they form a de-facto dual pair).
4. **Decision-memory semantics:** rejected-tools memory, re-evaluation triggers, `decision-format.md` reference — do the documented flows survive contact with the current CC harness (skill invocation, hook context injection)?

### S1-C — internal AI-docs audit

Population: CLAUDE.md, `.claude/session-bootstrap.md`, `.claude/rules/*.md` (all), `agents/*.md`, `.claude/hooks/*` headers/markers. Checks: staleness vs merged reality (≥ today's #441–#453 wave); Class field accuracy (does each Class A rule's companion test exist and pass? each Class C promotion criterion — has its threshold been hit, e.g. probe-inflight just codified after 3/3 + incident №4?); retirement criteria due; contradicting authority claims (`#contradicting-authority-claims` sweep); dual-pair / cc-only-rationale marker coverage per dual-implementation §6 grep (quote the grep output). P4 items: check chip status first, fix only if still open.

### S1-D — skills-quality audit

Population: project-scope skills (`.claude/skills/*` — pipeline, dispatcher, aif-doctor, ai-doc, ai-docs, self-reflection, template-audit, reviewer, probe-cc-perm, tool-bootstrapping consumer-side, playwright, vitest, …) — enumerate first. Per skill: frontmatter triggers vs body promise (trigger overlap / dead triggers); paired-negative presence (principle 15 — which skills are in/exempt from the allowlist: run the §Phase-minus-1 EXEMPT probe and quote); size/hot-cold split (≤500-line ergonomic target, references/ offload); i18n parity where `lang/` exists (`check-parity.sh`); eval coverage where evals exist (pipeline); one-shot skills past their use-by date (probe-cc-perm says «Delete after use» — verify and route). Best-practice yardstick: `superpowers:writing-skills` + project `/ai-doc` standard — cite which check comes from which.

## §3 Scope fence (hard)

**IN:** the 4 audits, consolidation, fixes of confirmed defects (stale text, broken delivery, dead automation, skill drift), re-verification, closure.
**OUT (surface as observation / DECISION-NEEDED only — do NOT do):**
- Product decisions: ship `setup-runtime-bridge.sh` to consumers; absorb legacy `setup.sh`; evolve next-15 preset rules; any new companion.
- NEW capabilities/tooling: no new audit frameworks, no new deps — reuse `scripts/audit-ai-docs.sh`, principle tests, `make self-audit`, template-audit, existing helpers (BFR: every BUILD proposal needs SSOT consult; expect ADOPT/REUSE verdicts).
- `~/.claude/**` (agent-uncommittable), `.claude/settings.json` self-protected edits beyond what install already templates.
- Rewriting historical docs (PROPOSAL.md frozen; umbrella specs/plans/retros — annotate, never retro-edit).

## §4 AI-laziness traps (per [.claude/rules/ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md) — MANDATORY)

Active traps for this umbrella: **T1, T2, T3, T7, T9, T10, T13, T14, T15, T16, T19**.
- **T1/T9/T10** — population enumeration BEFORE sampling; floors: S1-A ≥ full SHIPPED_DOCS + ≥20 landed files three-way-diffed; S1-C = ALL rules files (no sampling); S1-D = ALL project skills. Convenience-recent sampling forbidden — theatre concentrates in the OLD artefacts (tool-bootstrapping is oldest).
- **T2** — designing the probe ≠ running it: every §S1-B probe must show command + output.
- **T3** — no prose-only findings; every claim = file:line or command output, or `INCONCLUSIVE-needs-human`.
- **T7** — adversarial counter-prompt at category level in each patch («what surface did I not enumerate?») — run it, quote it.
- **T13/T16** — ADOPTED instruments (audit-ai-docs.sh, principle tests) are audit SUBJECTS too: confirm each instrument still tests what it claims (e.g. SHIPPED_DOCS header-check passed while delivery was broken — P2 proves verify≠deliver; name which instrument missed it and why).
- **T14** — «clean» verdict requires coverage statement; low coverage ⇒ finding is «insufficient coverage», not «clean».
- **T15** — self-application: S1-C audits THIS kickoff + the audit instruments; S4 re-runs the e2e probe that seeded §0.
- **T19** — S4 own cold-QA before umbrella close; CI green ≠ audit done.

Domain-specific:
- **T-FQA-A — «verified ≠ delivered».** The exact P2 failure mode: a checklist (SHIPPED_DOCS) verifies existence/headers in the PACKAGE and everyone assumes delivery. Counter: every «shipped» claim in any patch must be evidenced by `ls`/`cat` in a LANDED consumer, not by the package-side list.
- **T-FQA-B — «hook wired ⇒ automation works».** P1 failure mode: settings.json shows the hook, reviewer ticks the box, but the data file the hook needs never exists. Counter: automation claims require the full-chain probe (trigger → state file → detector → visible output), each link quoted.
- **T-FQA-C — fix-now reflex during R-phase.** With pre-seeded BLOCKERs the temptation is to patch in S1. Counter: S1 is read-only (T5 by construction); fixes land only via S2 plan → S3 waves.

## §5 Per-stage acceptance

- **S1 (each of 4):** research-patch merged; population enumerated with count; every finding has evidence per T3; severity-tagged fix-list section; adversarial counter-prompt section present; principle 10 annotation green; coverage % stated.
- **S2:** single consolidated plan: deduped fix-list clustered into file-disjoint S3 waves; per-cluster acceptance criteria; DECISION-NEEDED list (each: Option A/B + consequence, no picking); explicit «not-fixing» list with reasons. Maintainer GO recorded before S3.
- **S3 (each wave):** fixes green vs cluster acceptance; §1.7 Forward/Backward in every PR touching watched paths (`.claude/rules/**`, `packages/core/**`, `CLAUDE.md`, `agents/**`, `.claude/skills/**`, prior-art SSOT); P1 fix MUST include a paired-negative test (install without bootstrap → probe fails; with → passes); P2 fix MUST make verify-list and copy-list structurally single-sourced (one array drives both) or add a landed-side check to CI self-install jobs.
- **S4:** fresh e2e install on BOTH stacks from staging tip → 3/3 skill-contexts land, tool-decisions.md bootstrapped, hook fires on deps change (probe quoted); `make self-audit` + full principle suite green; `done.md` written per CLAUDE.md schema.

## §6 Stage-gate mechanic (between every stage)

```bash
gh pr list --search "is:merged head:<stage-branch> base:staging" --json number,title,mergedAt --limit 10
```
All stage PRs merged → Phase -1 cold-review (read-only Agent, `reviewer-discipline.md §2`; reviewers NEVER get write access) → GO before next stage. Pre-dispatch in-flight probe per CLAUDE.md §Operational conventions (PR-stage + ahead-commits + parallel sessions + re-probe after Phase -1) before EVERY dispatch — this umbrella's predecessor hit 4 double-dispatch races in one day.

## §7 Notes for the orchestrator

- Audit instruments to REUSE (not rebuild): `scripts/audit-ai-docs.sh`, `packages/core/principles/*` tests, `make self-audit`, `/template-audit`, `/ai-docs` + `/ai-doc` skills, `superpowers:writing-skills`, dual-implementation §6 greps, the /tmp e2e pattern from §0 recon.
- The live e2e consumers from recon (`/tmp/oci-verify-dthv/`) may be reused by S1 while they survive; S4 MUST build fresh ones.
- Push fallback if the git tunnel is down: `harvest-via-api.sh` / gh Git Data API (3 precedents 2026-06-10; disclose pre-push compensation in PR body). Mind chip task_4c367438 (mode parameterization) — may land mid-umbrella.
- §1.7 PR-body mandate + pre-flight greps per `.claude/orchestrator-prompts/<any>-meta-launch` §4b shape; S3 waves touching `packages/core/principles/` must run the EXEMPT_/allowlist probe (CLAUDE.md §Operational conventions) in Phase -1.
- Last-stage merge → `done.md` here per CLAUDE.md Umbrella closure convention.
- Quota expectation: S1 ×4 ≈ one Opus session each + 1 reviewer round; S2 single; S3 sized by S2; keep reviewers 1×Opus read-only.

<!-- host-verify: none — legacy closed umbrella (done.md): work already accepted; no live host acceptance to declare — retro-marked 2026-08-21 -->
