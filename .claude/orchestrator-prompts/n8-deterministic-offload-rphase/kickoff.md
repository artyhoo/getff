# Wave N8 — R-phase kickoff: Deterministic-offload as the autonomy-economy lever

> **Type:** research kickoff (Phase R only — no apply, no code, no hooks). Mode A inline `Agent` on Opus, read-only research + one written deliverable.
> **Status:** authored 2026-05-22 by orchestrator from [wave-sequencing-plan.md](../../../docs/meta-factory/wave-sequencing-plan.md) §4 (launch order) and §6 (parallelism) + the N8 plan-of-record. **This file launches nothing until the maintainer confirms "N8 R-phase" as the first wave** — see [wave-orchestrator-kickoff.md](../../../docs/meta-factory/wave-orchestrator-kickoff.md) §4 item 4. It is the turnkey dispatch artifact the sequencing plan §7 flagged as missing. (References below to "§N" without a document name are sections of *this* kickoff.)
> **Authoritative for:** the worker's task, scope, traps, done-criteria for **N8 Phase R only**.
> **NOT authoritative for:** Wave N8's question/hypotheses — see [research-patches/2026-05-22-deterministic-offload-autonomy-economy.md](../../../docs/meta-factory/research-patches/2026-05-22-deterministic-offload-autonomy-economy.md) (SSOT for N8 content); project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists); wave order — see the sequencing plan.

---

## §0 — Read first (worker has empty context)

You are a research worker. Your context is empty — do not assume you saw any prior conversation. Before starting:

1. Read the **N8 plan-of-record**: [docs/meta-factory/research-patches/2026-05-22-deterministic-offload-autonomy-economy.md](../../../docs/meta-factory/research-patches/2026-05-22-deterministic-offload-autonomy-economy.md). It is authoritative for the *question*; this kickoff is authoritative for *how you execute it*. **Verify any LOC / numeric figure the plan cites with a local `wc -l` / `grep -c` before reusing it as ground truth** (the plan's §1 hook-LOC figures are approximate — `end-of-turn-reminder.sh` is 260 lines, not the "200" stated; T3 applies to inherited claims too).
2. Skim the rails (auto-loaded, do not re-read in full): [no-paid-llm-in-ci.md](../../../.claude/rules/no-paid-llm-in-ci.md), [build-first-reuse-default.md](../../../.claude/rules/build-first-reuse-default.md), [phase-research-coverage.md §1](../../../.claude/rules/phase-research-coverage.md), [ai-laziness-traps.md §2](../../../.claude/rules/ai-laziness-traps.md).
3. WORKDIR: `/Users/art/code/rules-as-tests-aif`. If dispatched in parallel with N1, you run in your **own git worktree** with a `node_modules` symlink (orchestrator sets this up — see §6).

## §1 — The question (one line)

**How far can deterministic-offload + cheap-model + caching + (possibly) a local model push an autonomous agent loop before the 2026-06-15 metered `claude -p` / Agent-SDK billing moves materially — and what is the only true $0-above-subscription path for "model thinks without a human present"?**

Framing (do not re-derive — it is in the patch §1–§2): every check the deterministic substrate absorbs is a model call **not made**; the structural floor is that model inference without a human = headless = metered, so the only $0-forever compute is whatever **never calls a model**. The reframe is to maximise what the substrate absorbs and to test whether a local/open-weight model can drive the *dispatch* layer (the part that burns `claude -p`), reserving Claude for irreducible judgment.

## §2 — Deliverable

**One** research-patch file (you write it; orchestrator commits + pushes — you do NOT commit, push, or open a PR):

`docs/meta-factory/research-patches/2026-05-22-n8-rphase-findings.md`

It MUST carry a doc-authority header (`> **Authoritative for:** … > **NOT authoritative for:** project goal — see README#why-this-exists`) per [doc-authority-hierarchy.md §3](../../../.claude/rules/doc-authority-hierarchy.md), and the §1.7 block from §5 below. **Write the file section-by-section as you finish each of R1–R4** — do not buffer the whole document in context and flush it at the end; a single end-of-session dump risks context-exhaustion truncation (trap T-N8-C, §4).

Do **NOT** append to `prior-art-evaluations.md` directly — that shared SSOT is append-only and may collide with a parallel N1 session. List your SSOT-worthy verdicts in a `### SSOT-append candidates` section of your deliverable; the orchestrator serializes the actual append (sequencing plan §6 "Shared SSOT").

## §3 — The four research sub-tasks (all four are done-criteria — partial = REVISE)

### R1 — Own-stack offload sweep (local inspection, $0)
Inventory verification work the model currently does **in-session** that a deterministic hook/test could absorb instead. Start from the §1.7 checks, claim self-checks, citation existence-checks, count re-greps. For each candidate: is it already deterministic (cite the hook/principle file), or is it a migration candidate? Each migrated check = one fewer prompted model turn — quantify that link, don't just assert it.
- Evidence required: `file:line` for each existing deterministic check you cite; a concrete list of in-session checks that are NOT yet mechanised.

### R2 — Category sweep (external; ≥3 candidates/category, ≥3 search phrasings/category)
Survey, via **DeepWiki `ask_question` + WebSearch only** (no paid API call), these categories. The ≥3 floor is a **floor, not a ceiling** (phase-research-coverage §1.5 / T1) — if a category clearly has more relevant entries, keep going.
1. Autonomous agent-loop frameworks
2. Budget-capped schedulers / cron with spend caps
3. Local / open-weight runners (Ollama, llama.cpp, LM Studio, vLLM, …)
4. Batch API (async, ~−50%)
5. Prompt caching (~−90% on cached tokens)
6. Hybrid deterministic + model loops
- Evidence required per candidate: a **verifiable source** — a URL or the DeepWiki question+answer — NOT a claim from training memory (T3/T12). For Claude-Code-internal claims, dual-channel (`claude-code-guide` + DeepWiki) per the orchestrator skill.
- **Record the exact search phrasings** used, as a sub-bullet under each category (e.g. `Phrasings: "budget-capped LLM agent scheduler" · "LLM spend cap cron" · "autonomous agent cost limit"`). The orchestrator verifies ≥3 per category from the deliverable — unrecorded phrasings = unverifiable = REVISE.

### R3 — Cost model per candidate
A markdown table with **exactly these four columns** (the non-metered cost axis is its own column, not folded into another cell):

```text
| Candidate | $ above subscription | Human round-trips removed | Other cost axis (HW/GPU/electricity/human-time) | Position vs metered `claude -p` |
```

Do not pretend "$0" when the cost merely **shifted** to the "other cost axis" column (T-N8-B). One row per candidate carried forward from R2.

### R4 — Local-model viability (the load-bearing one)
Can a local/open-weight model drive the **orchestration/dispatch layer** (the part that burns `claude -p`), reserving Claude for irreducible high-judgment steps? This is the only candidate true $0-above-subscription path for "model thinks without a human".
- Decompose the dispatch layer into its concrete sub-tasks (e.g. tool-call JSON emission, multi-file context tracking, REPORT triage, GO/REVISE judgment). For **each** sub-task, assess local-model capability with evidence and name the **failure mode** if it can't (T-N8-A — no hand-waving "a 7B model could probably do it").
- State the **falsification condition** explicitly: "this path is wrong if …".

**Every finding across R1–R4 carries a BFR verdict** (ADOPT / ADAPT / REFERENCE / KEEP-NARROW / BUILD / REJECT / ADOPT-VOCABULARY) with one-line rationale, per [build-first-reuse-default.md §1](../../../.claude/rules/build-first-reuse-default.md). Default is ADOPT/REFERENCE; BUILD only after the §3 search confirms no upstream fit.

## §4 — AI-laziness traps active for this R-phase

Per [ai-laziness-traps.md §3](../../../.claude/rules/ai-laziness-traps.md) — this is a concrete enumeration, **not** a blanket reference (a blanket "see ai-laziness-traps.md" is itself trap T7).

**Canonical traps active here:** T1 (sampling floor — don't stop at 3 candidates if more exist), T2 (designing ≠ researching — produce surveyed evidence, not "a local model would work"), T3 (no prose-only findings — every candidate has a URL/DeepWiki output), T4 (hit all of R1–R4 before closing), T9 (don't sample only the famous tools — Ollama is easy, the budget-scheduler category is not), T11 (before any "BUILD our own dispatcher" verdict, run the external search first), T12 (WebSearch at the moment of the claim — your training data is biased toward well-documented tools and has a cutoff), T13 (treating ADOPTED items as zero-work), T14 (clean survey + low coverage = "coverage insufficient to conclude", NOT "no path exists"), T15 (self-application — see §5), T16 (pattern-matching-on-name: "Batch API" / "prompt caching" *sound* like they solve the interactive autonomous loop; verify the problem-class — async batch ≠ a human-absent interactive loop).

**Domain-specific traps (≥1 required per kickoff obligation — here, two):**
- **T-N8-A — "local viability from spec sheets, not from the dispatch sub-tasks."** Tempted to read an Ollama/llama.cpp model card and conclude "yes, a local 7B can orchestrate." Counter: R4 must enumerate the *actual* orchestration sub-tasks our loop needs and assess each against measured capability, naming the failure mode (e.g. "small local models emit malformed tool-call JSON under our schema") — not a single aggregate "probably works."
- **T-N8-B — "$0 conflation."** Tempted to label a path "$0 above subscription" when the cost merely **shifted** (GPU/electricity for local inference; human-time for a manual step). Counter: R3's cost model names **all** cost axes per candidate; "$0" is reserved for paths that genuinely add no metered $, no hardware, and no human round-trip. The patch §2 structural floor — *deterministic offload reduces how often the model is invoked; it cannot make model thinking free* — must not be over-claimed anywhere in the deliverable.
- **T-N8-C — "buffer-and-dump truncation."** Tempted to compose the whole multi-section deliverable in context and write it in one final flush. A long R-phase can exhaust context before that flush, truncating the file. Counter: write each R1–R4 section to disk as it is finished (§2).

## §5 — §1.7 self-reflexive block (worker writes this into the deliverable)

Per [phase-research-coverage.md §1.7](../../../.claude/rules/phase-research-coverage.md):
- **Forward-check:** research used free channels only (DeepWiki/WebSearch/local — no API-billed call, `no-paid-llm-in-ci`); every finding carries a BFR verdict (`build-first-reuse-default`); the deliverable carries a doc-authority header (`doc-authority-hierarchy`); the wave is *proposed* — you do **not** decide companion = A/B/C or whether to BUILD anything (`reviewer-discipline §2` — surface as DECISION-NEEDED, describe both paths, stop).
- **Backward-check:** this R-phase introduces **no new rule** → no existing-artefact sweep is owed. If a finding *recommends* a new hook/capability, that is a Phase-A proposal, not built here; flag that any such hook would, at authoring time, owe `dual-implementation-discipline §3` triage + an `@cc-only-rationale`/`@dual-pair` marker + `hook-stub-completeness` (principle 16, `packages/core/principles/16-hook-stub-completeness.test.ts`) — those obligations attach when the hook is written, not in this research.
- **6-item search-coverage walk (mandatory for any negative-existence claim):** if you write "there is no $0-above-subscription autonomous path," you MUST first walk [phase-research-coverage.md §1](../../../.claude/rules/phase-research-coverage.md) items 1–6 (own-stack sweep, category sweep, semantic-distance, adversarial counter-prompt, prompt-list-is-a-floor, trigger sweep) and record it. An unwalked negative-existence claim is provisional, not load-bearing.

## §6 — Parallelism / isolation (orchestrator-facing — for dispatch, not the worker)

- N8 R-phase is **parallel-safe with N1** (sequencing plan §6 G1) — different deliverable files, both free channels.
- If fanning out: from the repo root (`cd /Users/art/code/rules-as-tests-aif` first), **one `git worktree` per session** (`git worktree add ../rat-n8-rphase main`) + `node_modules` symlink (`ln -s /Users/art/code/rules-as-tests-aif/node_modules ../rat-n8-rphase/node_modules` — tsx hooks fail otherwise) per [parallel-subwave-isolation.md](../../../.claude/rules/parallel-subwave-isolation.md). Worktree-add fails → **sequential fallback**, never shared-dir.
- **SSOT-append is serialized** — N1 and N8 may both want `prior-art-evaluations.md`; the worker writes append-*candidates* into its own deliverable only (§2), orchestrator does the single real append.
- This R-phase is read-only research + one new file → no file-scope conflict with N1's deliverable.

## §7 — Done-criteria (orchestrator accepts only on evidence)

1. Deliverable file exists at the §2 path with a valid doc-authority header.
2. **All four** of R1, R2, R3, R4 sections are populated (T4 — partial = REVISE).
3. R2: ≥3 candidates × 6 categories, each with a verifiable source (URL or DeepWiki Q+A), ≥3 phrasings noted per category.
4. R3: cost-model table with all four columns per candidate (incl. the non-metered cost axis).
5. R4: per-sub-task local-model capability assessment + named failure modes + an explicit falsification condition.
6. Every finding carries a BFR verdict + rationale.
7. §1.7 block present; any negative-existence claim shows the 6-item walk.
8. DECISION-NEEDED items surfaced (not decided) — minimum: the companion A/B/C touchpoint (plan-of-record §5, last bullet) and any "BUILD vs ADOPT" fork.
9. **Confidence stated with predicates** (T6) — "N/M candidates verified via DeepWiki, X categories at floor, coverage = Y%, calibration = …" — never a bare "high".

## §8 — What this kickoff does NOT authorise

- No Phase-A work (no hooks written, no checks migrated, no local-model prototype). Phase A is a separate kickoff gated on these findings + maintainer admission.
- No commit / push / PR by the worker — orchestrator handles git.
- No edits to any artifact outside the single §2 deliverable file — README.md / CLAUDE.md / goal docs are read-only, `prior-art-evaluations.md` is orchestrator-serialized, research-patches are append-only (CLAUDE.md Artifact Ownership Contract).
- No strategy decisions (companion vendor, BUILD-vs-ADOPT final call, wave promotion to EXECUTION-PLAN) — those are maintainer calls per the master kickoff §4.

<!-- host-verify: none — legacy closed umbrella (done.md): work already accepted; no live host acceptance to declare — retro-marked 2026-08-21 -->
