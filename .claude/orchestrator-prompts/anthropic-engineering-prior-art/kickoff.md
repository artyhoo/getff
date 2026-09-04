<!-- scope: single-stage R-phase dispatch input — prior-art evaluation of Anthropic's first-party `engineering` Claude Code plugin against this project's capability surface. Self-contained: the upstream corpus is INLINED in §2 because the plugin is NOT reachable from the aif container (see §0). Authored 2026-07-31 by the operator-facing session that ran the host-side census. NO bridge-profile marker — Tier 2, see §0. -->

# anthropic-engineering-prior-art — is Anthropic's `engineering` plugin our problem class?

> **Stage goal:** a **BFR-disciplined prior-art verdict** on Anthropic's first-party `engineering`
> Claude Code plugin (v1.2.0, author `Anthropic`) against this project's capability surface, ending
> in an appended SSOT row. Operator prompt that commissioned it: «сравнить с плагином от Антропика
> Engineering — вышел ~6 дней назад, кажется тоже очень похож на наш».
> **Output kind:** research verdict + SSOT row. **Zero build** — no skill, no rule, no hook, no
> adoption is implemented here under any outcome.
> **Governing rule (read first, in full):**
> [`.claude/rules/build-first-reuse-default.md`](../../rules/build-first-reuse-default.md) — §1 the
> seven verdicts, **§1.1 the two axes (operator vs shipped) and own-stack-first**, §3 the mandatory
> mechanism, §4 anti-patterns. Also binding:
> [`.claude/rules/phase-research-coverage.md §1`](../../rules/phase-research-coverage.md) (the 6-item
> checklist on any negative-existence claim) and
> [`docs/meta-factory/prior-art-evaluations.md §3`](../../../docs/meta-factory/prior-art-evaluations.md)
> (append-only row schema).
>
> **This is a single-stage umbrella.** One PR, one verdict, one SSOT row. A systemic issue noticed
> mid-stage is surfaced in the PR body as an observation, never spun into an extra PR
> ([CLAUDE.md `PR strategy`](../../../CLAUDE.md)).

## §0 Dispatch facts (binding)

- **No `bridge-profile` marker on this file — deliberate.** Tier 2: a BFR verdict over a
  first-party upstream that plausibly overlaps our whole surface is judgment by construction, and
  the wrong verdict in either direction is expensive (a false «no overlap» is
  `#parallel-evolution-creep`; a false «they cover us» would retire work that is actually load-
  bearing). Project defaults apply: the top tier plans in aif, the executor tier implements and
  reviews. Do not add a marker without the operator's explicit ruling quoted here.
- **Staging placement.** This kickoff must be on `origin/staging` before dispatch
  ([kickoff-staging-placement.md §1](../../rules/kickoff-staging-placement.md)).
- **THE UPSTREAM IS NOT REACHABLE FROM WHERE YOU RUN — this is the stage's central constraint.**
  The plugin ships inside the operator's Claude Code harness at
  `~/Library/Application Support/Claude/local-agent-mode-sessions/<session>/<id>/rpm/plugin_<id>/`.
  That path does not exist in the aif container, on a GitHub runner, or in any checkout of this
  repo. **§2 below inlines the census and the corpus** the host-side session already ran and
  captured. You MUST work from §2. **Any claim about upstream content that is not in §2 must be
  recorded `INCONCLUSIVE — not in the inlined corpus`, never inferred**
  ([destination-environment-verification.md §3](../../rules/destination-environment-verification.md);
  fabricating a quote for an unreachable environment is the exact defect that rule exists to end).
- **Ownership.** This stage writes a research-patch under `docs/meta-factory/research-patches/`
  and appends to `docs/meta-factory/prior-art-evaluations.md`. It writes **no** rule, **no** hook,
  **no** skill, and does **not** edit `README.md`, `CLAUDE.md`, `.claude/rules/**`, `.husky/**` or
  `.claude/settings.json` ([CLAUDE.md `Artifact Ownership Contract`](../../../CLAUDE.md)).
- **Ceilings.** A pre-commit hook blocks any markdown file past **600 lines** — run `wc -l` before
  adding, including on `prior-art-evaluations.md` (already ~331 lines).

## §1 Work items

### W1 — state OUR capability surface first, from source

Before any comparison, enumerate what this project actually ships, from the tree — not from
recall. At minimum, with `file:line` or command output for each:

1. **The enforcement layer** — ESLint rules, `packages/core/principles/*.test.ts`, `.husky/pre-push`
   sections, `.claude/hooks/*.sh`, CI workflows under `.github/workflows/`. Count them.
2. **The orchestration layer** — `.claude/skills/pipeline/`, `.claude/skills/dispatcher/`,
   `.claude/skills/arch/`, `packages/runtime-bridge/` (dispatch → harvest → PR → stage gate).
3. **The discipline layer** — `.claude/rules/*.md` with their Class field, `agents/*.md` cold seats.
4. **The consumer-install layer** — `install.sh`, `setup.d/**`, what a consumer project receives.

This item exists because a comparison written against a remembered version of our own project is
`#claim-from-memory-not-source` ([phase-research-coverage.md §4](../../rules/phase-research-coverage.md)).

### W2 — the T16 problem-class comparison, per capability

For **each** of the ten upstream skills inlined in §2, write the discriminating statement verbatim
in the form [`ai-laziness-traps.md §2 T16`](../../rules/ai-laziness-traps.md) requires:

> **Upstream problem class: X. Our problem class: Y. Match? Evidence: …**

Do this **per capability**, not once for the plugin as a whole — a plugin-level «similar» or «not
similar» is precisely the `#pattern-matching-on-name` this register exists to prevent. The pairs
that will look closest by name are `engineering:code-review` ↔ our reviewer/fidelity seats,
`engineering:architecture` + `engineering:system-design` ↔ `/arch`, `engineering:testing-strategy` ↔
our rule-tests surface, and `engineering:deploy-checklist` ↔ our pre-push/CI gates. **Name adjacency
is the trap, not the finding.**

### W2a — the `/arch` adjacency, named explicitly (operator-raised, must be answered)

The operator looked at the plugin and pushed back on an early dismissal: «там тоже архитектор и
т.д. — это не похоже на наш скилл `/arch`?» That question is **not** one of the ten W2 rows; it is a
named deliverable, because it is the pair most likely to hide a real overlap behind a structural
difference.

A host-side first read (recorded here as **provisional**, to be confirmed or overturned by this
stage, not accepted) found the discriminator sits at a **phase boundary**, not at the whole skill:

- **Upstream `architecture` + `system-design`** produce an **ADR document from a fixed template** —
  Context → Decision → Options Considered (a per-option table of Complexity / Cost / Scalability /
  Team familiarity) → Trade-off Analysis → Consequences → Action Items — inside one session seat,
  optionally enriched by knowledge-base and tracker connectors. It ends by handing a human the
  document.
- **Our `/arch`** ([`.claude/skills/arch/SKILL.md`](../../skills/arch/SKILL.md)) is a **choreography**:
  §1 ideation delegated wholesale to `superpowers:brainstorming` (ADOPT, wrapped, never
  re-described), §2 a cold **two-altitude** design review over the artifact only with a
  `GO | REVISE | STOP` verdict grammar, §3 exit routing that classifies a dispatch tier and emits a
  kickoff (with or without the `bridge-profile` marker) into a metered factory, §4 an escalation
  return edge.

**The consequence that makes this worth a deliverable rather than a dismissal:** `/arch`'s own
header declares it **NOT authoritative for the ideation loop**, and it owns **no design-document
format at all**. So the upstream ADR template lands squarely in a slot we deliberately left empty.
That is a live **ADOPT-VOCABULARY / ADOPT** candidate on the artifact layer, even if §2-§3 have no
upstream counterpart whatsoever.

**Required output for this item:** the T16 statement for the pair, a per-phase overlap verdict
(Phase 1 artifact / Phase 2 review / Phase 3 routing), and an explicit call on whether the ADR
template should be adopted into `/arch` §1's output shape — including the cost gate and what it
would displace. `#adoption-shame` is the named risk here: «we already have `/arch`» is not a reason.
Note also that `claude-plugins-official` ships **separate** first-party `code-review` and
`security-guidance` plugins (WebSearch, 2026-07-31) — confirm whether either is a closer counterpart
to our reviewer seats than `engineering:code-review` is, or record why the question could not be
answered from the inlined corpus.

### W3 — the two-axis verdict (BFR §1.1)

A single verdict is not enough; [build-first-reuse-default.md §1.1](../../rules/build-first-reuse-default.md)
requires the axes to be adjudicated **separately**, and a verdict may legitimately differ between
them:

- **Operator axis** — should the maintainer *use* this plugin in their own working environment?
  Default here is «use companions maximally; don't reinvent», and the cost gate is mechanical:
  cheap (text/skill/config, no dependency, no code module, no standing infra) → ADOPT-now if it
  beats current practice; expensive → DEFER with a recorded trigger.
- **Shipped axis** — does anything here change what *this project installs into a consumer*?
  Default is an AI-/OS-/license-agnostic core that integrates with companions and degrades
  gracefully when they are absent. Making any companion **mandatory** for consumers is a goal
  change, not an operational call ([README.md#why-this-exists](../../../README.md#why-this-exists)).

Also run **own-stack-first (criterion zero)**: before crediting the plugin with any capability, check
whether the harness or this repo already ships it. Skipping that is `#own-stack-blind-spot`.

### W4 — the honest overlap question the operator actually asked

The operator's hypothesis is «кажется тоже очень похож на наш». **Adjudicate it directly and
answer it in one paragraph at the top of the patch**, in these terms:

- Where the surfaces genuinely **do** overlap, say so plainly and name what we could retire or
  thin. A finding that we duplicate a first-party artefact is a *valuable* finding, not a defeat —
  `#adoption-shame` ([build-first-reuse-default.md §4](../../rules/build-first-reuse-default.md)) is
  a named anti-pattern here.
- Where they do not, the discriminator must be **mechanical**, not rhetorical. The §2.3 census is
  the sharpest available instrument: an artefact that cannot fail is not an enforcement artefact.
  Do not stop at that one instrument if a second is reachable.
- State the **falsifier** for whichever way the verdict lands.

### W5 — record it

- **Research-patch** at `docs/meta-factory/research-patches/2026-<MM>-<DD>-anthropic-engineering-plugin-prior-art.md`.
  **Principle 10 format (gated, exact):** the FIRST line must match
  `^<!-- scope:[a-zA-Z0-9.§-]+ -->$` — **no spaces inside the slug** (e.g.
  `<!-- scope:anthropic-engineering-prior-art -->`). Verified against
  `packages/core/principles/10-research-patch-annotation.test.ts:23`.
- **SSOT append** — one new row in `docs/meta-factory/prior-art-evaluations.md` §4 with the full
  schema (`Verdict`, `Rationale`, `Trigger to revisit`), covering **both** axes in the rationale.
  Reuse the shape of the neighbouring rows #230-#233, which evaluate the same *class* of candidate
  (CC plugins / orchestration contours) and are the closest sibling precedent.

## §2 INLINED UPSTREAM CORPUS (host-captured 2026-07-31 — you cannot re-derive this)

Everything in this section was produced on the operator's host, where the plugin exists. Each block
names the command that produced it.

### §2.1 Manifest — `cat .claude-plugin/plugin.json`

```json
{
  "name": "engineering",
  "version": "1.2.0",
  "description": "Streamline engineering workflows — standups, code review, architecture decisions, incident response, and technical documentation. Works with your existing tools or standalone.",
  "author": { "name": "Anthropic" }
}
```

### §2.2 File census — `find <plugin> -maxdepth 3 -type f`

```text
./.mcp.json
./README.md
./CONNECTORS.md
./.claude-plugin/plugin.json
./skills/documentation/SKILL.md
./skills/incident-response/SKILL.md
./skills/code-review/SKILL.md
./skills/tech-debt/SKILL.md
./skills/standup/SKILL.md
./skills/architecture/SKILL.md
./skills/testing-strategy/SKILL.md
./skills/deploy-checklist/SKILL.md
./skills/system-design/SKILL.md
./skills/debug/SKILL.md
```

Line counts (`wc -l`): architecture 85 · code-review 118 · debug 95 · deploy-checklist 78 ·
documentation 49 · incident-response 158 · standup 75 · system-design 42 · tech-debt 32 ·
testing-strategy 33 · README 135 · CONNECTORS 19. **Total ≈ 900 lines of markdown.**

### §2.3 The load-bearing structural fact — `find <plugin> -type f ! -name '*.md'`

```text
./.mcp.json
./.claude-plugin/plugin.json
```

**Two non-markdown files, both declarative config. Zero scripts, zero hooks, zero tests, zero CI
workflows, zero lint rules.** And the enforcement-vocabulary census
(`grep -rn -iE 'pre-commit|pre-push|exit 1|eslint rule|CI gate|blocking' skills/*/SKILL.md`)
returned **no matches at all** across all ten skills.

> **Do not over-read this.** It establishes that the plugin ships no executable enforcement of its
> own. It does **not** establish that the plugin is «worse», nor that it fails at what it is for —
> a prompt-shaping workflow pack is a legitimate artefact class with a legitimate problem class.
> W2's job is to name that problem class honestly, not to score a point. T14 applies: a clean
> structural finding at this coverage is «no executable enforcement shipped», not «no value».

### §2.4 Connector surface — server keys in `.mcp.json`

`slack` · `linear` · `asana` · `atlassian` · `notion` · `github` · `pagerduty` (+ per-server
`type` / `url` / `oauth` fields). All remote OAuth MCP servers; each requires operator
authorization before its tools are usable.

### §2.5 Full body of one representative skill — `skills/code-review/SKILL.md`

Reproduced verbatim (frontmatter `name: code-review`; `description:` in §2.6). This is the skill
whose name most closely collides with our reviewer/fidelity seats, so it is the one inlined in full.

```markdown
# /code-review

> If you see unfamiliar placeholders or need to check which tools are connected, see CONNECTORS.md.

Review code changes with a structured lens on security, performance, correctness, and maintainability.

## Usage
/code-review <PR URL or file path>
Review the provided code changes: @$1
If no specific file or URL is provided, ask what to review.

## How It Works
STANDALONE (always works)
  - Paste a diff, PR URL, or point to files
  - Security audit (OWASP top 10, injection, auth)
  - Performance review (N+1, memory leaks, complexity)
  - Correctness (edge cases, error handling, race conditions)
  - Style (naming, structure, readability)
  - Actionable suggestions with code examples
SUPERCHARGED (when you connect your tools)
  + Source control: Pull PR diff automatically
  + Project tracker: Link findings to tickets
  + Knowledge base: Check against team coding standards

## Review Dimensions
Security — SQL injection, XSS, CSRF; authn/authz flaws; secrets in code; insecure
deserialization; path traversal; SSRF
Performance — N+1 queries; unnecessary allocations; algorithmic complexity in hot paths;
missing indexes; unbounded queries/loops; resource leaks
Correctness — edge cases (empty/null/overflow); race conditions; error handling and
propagation; off-by-one; type safety
Maintainability — naming clarity; single responsibility; duplication; test coverage;
documentation for non-obvious logic

## Output
## Code Review: [PR title or file]
### Summary — 1-2 sentence overview of the changes and overall quality
### Critical Issues — table: # | File | Line | Issue | Severity
### Suggestions — table: # | File | Line | Suggestion | Category
### What Looks Good — positive observations
### Verdict — [Approve / Request Changes / Needs Discussion]

## If Connectors Available
source control → pull the PR diff automatically from the URL; check CI status and test results
project tracker → link findings to related tickets; verify the PR addresses stated requirements
knowledge base → check changes against team coding standards and style guides

## Tips
1. Provide context — "This is a hot path" or "This handles PII" helps me focus.
2. Specify concerns — "Focus on security" narrows the review.
3. Include tests — I'll check test coverage and quality too.
```

### §2.6 All ten `description:` fields, verbatim

- **architecture** — «Create or evaluate an architecture decision record (ADR). Use when choosing between technologies (e.g., Kafka vs SQS), documenting a design decision with trade-offs and consequences, reviewing a system design proposal, or designing a new component from requirements and constraints.»
- **code-review** — «Review code changes for security, performance, and correctness. Trigger with a PR URL or diff, "review this before I merge", "is this code safe?", or when checking a change for N+1 queries, injection risks, missing edge cases, or error handling gaps.»
- **debug** — «Structured debugging session — reproduce, isolate, diagnose, and fix. Trigger with an error message or stack trace, "this works in staging but not prod", "something broke after the deploy", or when behavior diverges from expected and the cause isn't obvious.»
- **deploy-checklist** — «Pre-deployment verification checklist. Use when about to ship a release, deploying a change with database migrations or feature flags, verifying CI status and approvals before going to production, or documenting rollback triggers ahead of time.»
- **documentation** — «Write and maintain technical documentation. Trigger with "write docs for", "document this", "create a README", "write a runbook", "onboarding guide", or when the user needs help with any form of technical writing — API docs, architecture docs, or operational runbooks.»
- **incident-response** — «Run an incident response workflow — triage, communicate, and write postmortem. Trigger with "we have an incident", "production is down", an alert that needs severity assessment, a status update mid-incident, or when writing a blameless postmortem after resolution.»
- **standup** — «Generate a standup update from recent activity. Use when preparing for daily standup, summarizing yesterday's commits and PRs and ticket moves, formatting work into yesterday/today/blockers, or structuring a few rough notes into a shareable update.»
- **system-design** — «Design systems, services, and architectures. Trigger with "design a system for", "how should we architect", "system design for", "what's the right architecture for", or when the user needs help with API design, data modeling, or service boundaries.»
- **tech-debt** — «Identify, categorize, and prioritize technical debt. Trigger with "tech debt", "technical debt audit", "what should we refactor", "code health", or when the user asks about code quality, refactoring priorities, or maintenance backlog.»
- **testing-strategy** — «Design test strategies and test plans. Trigger with "how should we test", "test strategy for", "write tests for", "test plan", "what tests do we need", or when the user needs help with testing approaches, coverage, or test architecture.»

### §2.7 What §2 does NOT contain — the honest boundary

The full bodies of the other **nine** skills, the `README.md` (135 lines), and `CONNECTORS.md` are
**not** inlined. Any claim that depends on their body text — as opposed to their `description`
field in §2.6 — is `INCONCLUSIVE — body not in the inlined corpus`, and must be recorded that way.
The §2.3 census and the §2.6 descriptions cover the *structural* and *stated-purpose* questions;
they do not cover fine-grained internal choreography of the nine.

## §3 External-search obligation (BFR §3 — run it, do not assert it)

The plugin is ~6 days old at authoring, so training data is systematically stale here (**T12**).

- **WebSearch ≥3 phrasings** on the problem-domain terms (e.g. «Anthropic engineering plugin Claude
  Code», «Claude Code plugin marketplace first-party engineering skills», «Claude Code plugin
  enforcement hooks gates»). Quote query and result.
- **DeepWiki `ask_question` ≥3 phrasings** against any public repo that hosts the plugin, if one
  exists. If no public repo can be found, that is itself a finding — record it with the 6-item
  negative-existence checklist ([phase-research-coverage.md §1](../../rules/phase-research-coverage.md)),
  never as a bare «couldn't find it».
- **`context7` is explicitly EXCLUDED** for this decision class (library API docs, not «does a
  production framework exist for problem-class Y?») — [build-first-reuse-default.md §3](../../rules/build-first-reuse-default.md)
  tooling caveat.
- **SSOT consult by ID**: rows **#230** (mattpocock/skills — a pure-markdown CC plugin skill set,
  the closest structural sibling to this candidate), **#231** (obra/superpowers retired review
  loop), **#232** (mission-control, WATCHLIST), **#64** (Superpowers SDD). Read what each already
  decided before proposing anything; #230 in particular already worked through «a markdown-only CC
  plugin whose skills configure the *consumer's* linters rather than gating themselves».

## §4 Acceptance (all must hold)

1. Our own capability surface (W1) is enumerated from the tree with counts and `file:line`/command
   evidence — not from recall.
2. All ten upstream skills carry an explicit per-capability T16 statement (W2). No plugin-level
   «similar / not similar» stands in for the ten.
2a. **W2a answered as its own deliverable:** the `/arch` ↔ `architecture`+`system-design` pair
   carries a per-phase overlap verdict (Phase 1 artifact / Phase 2 review / Phase 3 routing) and an
   explicit call on adopting the ADR template into `/arch` §1's empty output-format slot, with the
   cost gate applied. The provisional host-side read in W2a is confirmed or overturned **with
   evidence**, never restated.
3. Both BFR axes (W3) are adjudicated **separately**, each with one of the seven verdicts, each with
   a rationale; own-stack-first is run before any credit is given.
4. The operator's hypothesis (W4) is answered directly in one paragraph at the top of the patch,
   including what we could retire or thin if the overlap is real.
5. The verdict carries an explicit **falsifier**.
6. External search RUN, not asserted: WebSearch ≥3 phrasings quoted; DeepWiki ≥3 phrasings quoted
   or its unavailability recorded via the 6-item checklist.
7. Every claim about upstream content beyond §2 is marked `INCONCLUSIVE — not in the inlined
   corpus`. Zero fabricated quotes about the plugin.
8. Research-patch exists with the exact principle-10 first-line annotation; SSOT row appended with
   the full schema; `wc -l docs/meta-factory/prior-art-evaluations.md` < 600.
9. **Zero build**: `git diff --name-only staging..HEAD` shows only the research-patch and the SSOT
   file. No rule, hook, skill, agent, or workflow.
10. PR body carries the §5 self-check and a `Prior-art:` trailer citing the new row.

```bash host-verify
npx vitest run packages/core/principles/08-prior-art-cited.test.ts
npx vitest run packages/core/principles/10-research-patch-annotation.test.ts
npx vitest run packages/core/principles/11-build-first-reuse-default.test.ts
```

> Run them via `bash scripts/host-verify.sh anthropic-engineering-prior-art` **on the host** — a
> green container run is not evidence about the host
> ([destination-environment-verification.md §3](../../rules/destination-environment-verification.md)).

## §5 §1.7 self-check obligation for this stage's PR

**Forward-check** must name, each with `file:line` evidence: `build-first-reuse-default.md §1/§1.1/§3`
(seven verdicts, two axes, mechanism actually run), `phase-research-coverage.md §1` (6-item checklist
on any negative-existence claim), `ai-laziness-traps.md §2 T16` (per-capability problem-class match),
`destination-environment-verification.md §3` (the unreachable-upstream boundary), `no-paid-llm-in-ci.md`
(research is session-read; nothing added to CI).

**Backward-check** must enumerate **sibling surfaces the diff did NOT touch** and verdict each
`SWEPT-CLEAN(evidence)` / `GAP-FOUND(action)`. The change class is *prior-art verdicts over
companion/upstream tooling*; the enumeration must at minimum reach SSOT rows #230, #231, #232, #64,
`.claude/rules/build-first-reuse-default.md §1.1` (the satellite doctrine this verdict instantiates),
and `docs/meta-factory/prior-art-evaluations.md §3` (the append-only contract). A backward-check
whose surface list equals the diff's own file list is **non-conformant by format** — delegate the
sweep to [`agents/backward-sweep-auditor.md`](../../../agents/backward-sweep-auditor.md), handing it
the change *class* only.

## §6 Descopes (BINDING)

No adoption, no installation, no wiring of the plugin into this repo. No new skill, rule, agent,
hook, or workflow. No edits to `README.md`, `CLAUDE.md`, `.claude/rules/**`, `.husky/**`,
`.claude/settings.json`, or any shipped template. No retirement or thinning of any existing artefact
in this PR — if W4 finds real overlap, the *recommendation* to thin is the deliverable, and the
thinning itself is a separate, operator-approved change. No new npm dependency.

## §7 Park-don't-guess contract (non-negotiable)

**aif agent — fork discipline (non-negotiable):** On ANY genuine fork or ambiguity (two defensible
implementations, an undecided design choice, a missing spec detail that changes behaviour) — **do
NOT pick.** Park it as a question (set the task to `manualReviewRequired` / `blocked_external` with
the fork stated as «Option A → consequence X / Option B → consequence Y») and **stop that task.**
Proceed only on the unambiguous parts.

This is expected to fire here. The most likely trigger is a genuine two-axis split (e.g. ADOPT on
the operator axis, KEEP NARROW on the shipped axis) that reads as a contradiction — it is not one,
§1.1 explicitly permits it, so state both rather than forcing a single verdict. The second likely
trigger is W4 landing on «yes, real overlap, and here is what we should retire» — surface that as a
recommendation with consequences, never as a unilateral retirement. Never manufacture a quoted
command output for anything outside your environment; §2.7 is the boundary.

## §8 AI-laziness traps

See [.claude/rules/ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md). **Active traps for
this stage: T2, T3, T7, T10, T11, T12, T13, T14, T15, T16, T20, T21.**

- **T2** — «my comparison method would catch overlap» is not a comparison. Run it per capability.
- **T3** — every claim carries a command + output or a quoted `file:line`. No prose-only findings.
- **T7** — run the adversarial counter-prompt on your own verdict: «what would I have to believe for
  the opposite verdict to be right?» Write it and answer it.
- **T10** — enumerate our own surface (W1) BEFORE comparing; a completeness claim without the
  enumeration is meaningless.
- **T11** — no proposal before the external search runs (§3).
- **T12** — the plugin is ~6 days old; training-data recall about it is worthless. Search.
- **T13** — «it's first-party Anthropic, therefore validated» is not evidence about *our* problem
  class. A first-party badge transfers no verdict.
- **T14** — a clean structural finding at this coverage is «no executable enforcement shipped», not
  «no value» and not «no overlap». §2.3 says this in its own note; honour it.
- **T15** — self-application: this project's thesis is that conventions must be executable. State
  what running *our* discipline on *this verdict* produced — which check fired, what it caught.
- **T16** — the whole stage is a T16 exercise. The statement form in W2 is mandatory, per capability.
- **T20** — no verdict in the PR body without an evidence-bearing tool call in the same turn.
- **T21** — the §5 backward-check enumerates non-diff sibling surfaces.
- **T-AEP-A (domain) — «first-party means it supersedes us».** The strongest pull here is deference:
  Anthropic shipped it, so surely it is the canonical answer. Counter: the two axes (§1.1) and the
  T16 form. A first-party artefact can be simultaneously worth ADOPTing on the operator axis and
  irrelevant on the shipped axis — and saying so is the *correct* verdict, not a hedge.
- **T-AEP-B (domain) — «zero hooks, therefore no overlap».** The §2.3 census is one sharp
  instrument, and it is tempting to let it settle the whole question. It does not: two artefacts can
  serve the same problem class with different enforcement postures, and «they have no gates» answers
  the *enforcement* question only. Counter: W2 must adjudicate problem class per capability on
  *purpose*, with the census as evidence about mechanism, not as a substitute for the comparison.
- **T-AEP-C (domain) — inventing upstream detail to finish a row.** Nine skill bodies are absent
  from §2. The cheapest way to complete a ten-row T16 table is to infer the missing bodies from
  their `description` fields and write them as if read. Counter: §2.7 and acceptance item 7 — an
  `INCONCLUSIVE — body not in the inlined corpus` row is a *correct* row.

## See also

- [`.claude/rules/build-first-reuse-default.md`](../../rules/build-first-reuse-default.md) — the governing rule (§1 verdicts, §1.1 two axes + own-stack-first, §3 mechanism, §4 anti-patterns).
- [`docs/meta-factory/prior-art-evaluations.md`](../../../docs/meta-factory/prior-art-evaluations.md) — the append-only register; rows #230/#231/#232/#64 are the closest sibling precedents.
- [`.claude/rules/phase-research-coverage.md §1`](../../rules/phase-research-coverage.md) — the 6-item negative-existence checklist.
- [`.claude/rules/destination-environment-verification.md`](../../rules/destination-environment-verification.md) — why §2 is inlined and §2.7 is a hard boundary.
- [`.claude/rules/ai-laziness-traps.md §2`](../../rules/ai-laziness-traps.md) — canonical trap catalogue.
- [`README.md#why-this-exists`](../../../README.md#why-this-exists) — the project goal any «they cover us» claim must be measured against.
