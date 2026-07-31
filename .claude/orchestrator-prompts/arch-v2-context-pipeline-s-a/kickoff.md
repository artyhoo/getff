<!-- scope: stage-scoped dispatch input — S-A of the arch-v2-context-pipeline umbrella (handoff decision 11: stage-scoped inputs are binding for multi-stage umbrellas). Self-contained: an executor holding ONLY this file plus the design spec can run it. NO bridge-profile marker — deliberate, see §0. Authored 2026-07-31 by the Opus plan-writing seat. -->

# arch-v2-context-pipeline S-A — `/arch` v2 rewrite

> **Stage goal:** turn [`.claude/skills/arch/SKILL.md`](../../skills/arch/SKILL.md) into the v2
> choreography of the design spec's §2 pipeline arc — research contour, membrane + K-pass, cold
> definition, kill channels — repair three verified wrapper drifts at interface level, ship one
> honest upstream-reference smoke, and codify the unique-filenames convention. **Design SSOT
> (read first, in full):**
> [`docs/superpowers/specs/2026-07-31-arch-v2-context-pipeline-design.md`](../../../docs/superpowers/specs/2026-07-31-arch-v2-context-pipeline-design.md)
> — §2 (the arc + membrane + kill channels), **ADR-4** (membrane: K-pass, bounded drill-down),
> §4 item 1 (this stage's scope line). **Umbrella context (sequencing only, not needed to
> execute):** [`../arch-v2-context-pipeline/kickoff.md`](../arch-v2-context-pipeline/kickoff.md).
>
> **This stage is S-A only.** S-B (contract v2 + calibration ledger), S-C (L2 verdict), S-D (L2
> build), S-E (budget gate), S-F (small fixes) are OUT OF SCOPE — do not implement, do not
> pre-wire, do not mention as done. If work here uncovers a systemic issue outside this scope,
> surface it in the PR body as an observation and stop
> ([CLAUDE.md `PR strategy`](../../../CLAUDE.md)).

## §0 Dispatch facts (binding)

- **No `bridge-profile` marker on this file — deliberate, not an omission.** CLAUDE.md's Tier-2
  always-marker exception requires a kickoff «produced by `/arch` AND plan-complete», plus the
  live `fidelity-verdict-in-pr-body` required-check precondition. This contour ran /arch-*equivalent*
  seats without invoking the skill, and this stage's deliverable is the rewrite *of that skill* —
  leaning on the exception to ship its own source would be circular. Tier 2, project defaults
  apply: the top tier plans in aif, the executor tier implements and reviews. Do not add a marker
  without the operator's explicit ruling quoted here.
- **Staging placement.** This kickoff must be on `origin/staging` before dispatch
  ([kickoff-staging-placement.md §1](../../rules/kickoff-staging-placement.md)).
- **Ownership.** `.claude/skills/**` is session-editable. `.claude/rules/**`, `CLAUDE.md`,
  `.husky/pre-push` and `.claude/settings.json` are **maintainer-owned / agent-uncommittable** —
  this stage edits none of them. If a change there looks required, ship it as a proposed diff in
  the PR body ([CLAUDE.md `Artifact Ownership Contract`](../../../CLAUDE.md)).
- **Ceilings.** Markdown files are blocked past 600 lines by a pre-commit hook — check
  `wc -l` before adding. The skill's `description` + `when_to_use` share a documented **1,536-char
  cap** (upstream `code.claude.com/docs/en/skills`); the current `description` measures **978**
  chars (`awk '/^description: /{print length($0)-13}' .claude/skills/arch/SKILL.md`), leaving
  ~558 chars of headroom for W1's trigger additions.

## §1 Work items

### W1 — `/arch` §1.5 research contour

**Target:** `.claude/skills/arch/SKILL.md`, a new section between the current §1 (ideate + design)
and §2 (cold two-altitude review).

Codify, per spec §2 and handoff decision 4:

1. **Trigger + explicit skip.** The contour fires on a new capability, an unfamiliar domain, or a
   needed BFR verdict. Tier-0/Tier-1 work skips it **explicitly** (one line in the artefact saying
   so), never silently.
2. **Research-spec template**, authored by the verifier seat before any research is dispatched.
   Two fields are REQUIRED and the template says so: a **pre-mortem paragraph** («what would have
   to be true for this idea to fail») and an **acceptance-criteria line** («what test would prove
   this idea wrong»), both before code exists.
3. **Execution** — the research runs on the executor tier in aif; **freshness bar** binding: every
   source dated, freshest first, no stale source enters the distillate without fresh confirmation.
4. **Distillation + idea verdict** — the verifier seat **spot-checks sources** (not curation only),
   distills, carries a «current as of `<date>`» line, and issues `GO | rework | kill`. Killed ideas
   land in the prior-art SSOT with their reasons.
5. **Seats as relative tiers, never model names** (handoff decision 2; same posture as
   [night-mode/SKILL.md](../../skills/night-mode/SKILL.md) «Overnight model posture», which stays
   the tier→model instantiation SSOT — point at it, do not restate it).

Update the frontmatter `description` triggers so the research contour is reachable (`research
contour`, `research-spec`, `distillate`, `исследовательский контур`), staying under the cap above.

**How to verify:** `grep -nE '§1\.5|pre-mortem|acceptance-criteria|current as of' .claude/skills/arch/SKILL.md`
returns all four; `awk '/^description: /{print length($0)-13}' .claude/skills/arch/SKILL.md` < 1536;
`npx vitest run packages/core/principles/09-doc-authority-hierarchy.test.ts` green (the header's
Authoritative-for line must grow to cover §1.5).

### W2 — membrane + K-pass + bounded drill-down (ADR-4)

**Target:** same file, a subsection of §1.5 or its own short section — the executor picks, but the
four parts must all be present and unambiguous:

1. **Default consumption rule.** The ideation seat consumes distillates; the executor seat consumes
   specs/kickoffs; the verifier seat sees both directions. This is a **default with bounded
   recourse, not epistemic isolation** — say that explicitly, because the earlier framing implied
   isolation.
2. **K-pass station.** A K1/K2 pass (anchors exist as claimed · quoted outputs reproduce) runs **on
   each distillate before it is consumed**, so the distiller's defects die at the distiller's
   channel. Evidence to cite in the skill in one clause: a verifier seat shipped two
   non-reproducing quotes inside a confirmed-findings cold review. On failure the distillate goes
   back to the distiller (rework); **2+ consecutive rework rounds → surface to the operator**.
3. **Drill-down, bounded and symmetric** for both consuming seats: first choice is «ask the
   producing seat to re-verify claim X» (one round-trip, membrane intact); direct opening of a
   cited source is capped at **≤3 per artifact**; **every** drill-down is recorded IN the resulting
   artifact, naming the claim and what changed. The record's consumer is named: the next
   verification look (critique or acceptance) treats an **unrecorded** drill-down as a finding —
   without a named consumer this is `#warning-nobody-reads`
   ([attention-is-not-a-mechanism.md §2](../../rules/attention-is-not-a-mechanism.md)).
4. **Scope** stays cited-sources-only; browsing stays blocked.

**How to verify:** `grep -nE 'drill-down|K-pass|≤3|rework' .claude/skills/arch/SKILL.md` shows all
four parts; read the section aloud against ADR-4 — each of its three numbered parts must map to
text, and the cap must be a number, not «a few».

### W3 — cold definition + kill channels

**Target:** same file, inside §2 (the existing two-altitude review section) and one short list.

1. **Cold, defined once and used everywhere:** a seat is cold when it **did not author the artifact
   AND did not receive the authoring context** — artifact paths only. The existing §2 already says
   «handed ONLY artifact paths … never chat context»; W3 promotes that to a named definition the
   rest of the skill references, so §1.5's K-pass and §3's exit can both point at it.
2. **Kill channels, enumerated with their cost ordering:** an idea can die at the research-spec
   (pre-mortem), at the distillate (idea verdict), at the critique (REVISE/STOP), or at acceptance
   — each cheaper than the next. State the invariant plainly: the contour's job is to make the
   cheap deaths *reachable*, which is the project's «fails at the earliest reachable channel»
   thesis applied to ideas ([README.md#why-this-exists](../../../README.md#why-this-exists)).

**How to verify:** `grep -nE 'cold[ -]by[ -]construction|did not author|kill channel' .claude/skills/arch/SKILL.md`;
the definition appears **once** and is referenced, not re-stated per section (a re-statement is the
drift this stage exists to end).

### W4 — three wrapper drifts, fixed at interface level

Handoff decision 6 (binding): a wrapper states only (a) the capability it delegates, (b) the
interface it relies on, (c) its own delta — **never upstream internals**. Version markers are
REJECTED. All three sites below were verified live in this repo on 2026-07-31 against the
installed upstream (`~/.claude/plugins/cache/superpowers-dev/superpowers/{5.1.0,6.1.1,6.2.0}`) —
**re-verify before editing** (T3; the operator's installed set may have moved).

| # | Site | What is wrong | Verified how |
|---|---|---|---|
| a | `.claude/skills/arch/SKILL.md:79` | «verified absent from upstream through v6.1.1: no design-review skill exists there» — upstream ships `skills/brainstorming/spec-document-reviewer-prompt.md` in **5.1.0, 6.1.1 and 6.2.0**. Narrowly true (it is a prompt template, not a top-level skill), substantively misleading about /arch's delta. | `ls ~/.claude/plugins/cache/superpowers-dev/superpowers/*/skills/brainstorming/` |
| b | `.claude/skills/night-mode/SKILL.md:15` | «two fresh reviewer subagents (spec-reviewer ≈ top-down; code-quality-reviewer ≈ bottom-up)» — upstream SDD dispatches **one** task reviewer per task plus **one** final code reviewer; those two role names do not exist there. | `grep -nE 'task reviewer|code-reviewer' <sdd>/SKILL.md` |
| c | `.claude/skills/night-mode/SKILL.md:29` | «SDD lines 114–120» for the BLOCKED handler — stale in both versions (6.2.0:114-120 = branch/ledger guidance; 6.1.1:114-120 = model-specification guidance). A line-number citation into upstream internals is exactly what decision 6 forbids. | `sed -n '114,120p' <sdd>/SKILL.md` in each cached version |

**Required shape of each fix.** State the *interface* and the *delta*, with no version pin and no
upstream line number. For (a) that means replacing the negative-existence claim with what is
actually true and load-bearing: upstream's brainstorming dispatches an author-side spec-document
reviewer; /arch's delta is **two cold seats at fixed altitudes with a verdict grammar and a routed
exit**. For (b): name the capability delegated («SDD owns the implement→review→rework loop and its
roster»), not the roster's contents. For (c): cite the *behaviour* («SDD's BLOCKED handler»), never
a line range.

**How to verify (mechanical, and a reviewer will run it):**

```text
grep -nE 'v[0-9]+\.[0-9]+\.[0-9]+|SDD lines|through v' .claude/skills/arch/SKILL.md .claude/skills/night-mode/SKILL.md
```

must return **no hit at the three fixed sites**. A fix that swaps a stale version pin for a fresh
one, or a stale line number for a fresh one, is a REJECT at review — it re-arms the identical drift
on the next upstream release (see T-SA-B).

### W5 — upstream-reference smoke (honest scope)

**Target:** `packages/core/skills/upstream-skill-reference.test.ts` (+ a paired-negative case in
the same file; naming precedent: `packages/core/principles/15-skill-paired-negative.test.ts`).

**What it asserts:** every `superpowers:<name>` reference appearing in any `.claude/skills/*/SKILL.md`
resolves to an installed upstream skill directory.

**What it must NOT claim.** This smoke does **not** cover the three W4 drifts and the skill must say
so in a comment: a by-name existence check cannot evaluate a *negative*-existence claim (a), a
roster *shape* (b), or a line-number citation (c). Selling it as their mechanism is
`#discipline-theatre`.

**Environment handling (load-bearing).** Upstream lives under the operator's `~/.claude/plugins/**`,
which does **not** exist on a CI runner or in the aif container. A silently-skipping load-bearing
check is `#warning-nobody-reads`. Therefore: discover the upstream root by glob (never hard-code a
version directory — that would be the version pin W4 removes); when found, every reference must
resolve or the test FAILS; when not found, the test emits an explicit, quoted
`SKIPPED — no upstream install discovered at <globs searched>` line and passes. The test's own
header states which environment it is meaningful in.

**How to verify:** `npx vitest run packages/core/skills/upstream-skill-reference.test.ts` green on
the host with upstream present; the paired negative (a fixture referencing
`superpowers:does-not-exist`) observed **RED before GREEN** — quote both runs in the PR body (T2);
and one run with the upstream glob pointed at an empty temp dir showing the SKIPPED line verbatim.

### W6 — unique-filenames convention for parallel subagents

**Target:** `.claude/skills/arch/SKILL.md` §2 (where parallel review seats are dispatched).

Codify (handoff decision 13; near-clobber incident 2026-07-31): when two or more subagents are
dispatched in parallel and share one scratchpad directory, each dispatch prompt names a **unique
output filename** (e.g. `<seat>-<topic>.md`), assigned by the dispatching session, never chosen by
the subagent. One line in the dispatch-prompt contract, not a new mechanism.

**How to verify:** `grep -n 'unique' .claude/skills/arch/SKILL.md` shows the convention inside the
dispatch-prompt contract; the two §2 seats' prompts each carry a distinct filename.

## §2 Acceptance (all must hold)

1. W1-W6 present with the verification command outputs quoted in the PR body — command + output,
   never prose (T3).
2. `grep -nE 'v[0-9]+\.[0-9]+\.[0-9]+|SDD lines|through v'` returns no hit at the three W4 sites.
3. The smoke exists, was observed RED on the paired negative and GREEN on the real tree, and its
   SKIPPED path was exercised once.
4. `/arch` SKILL.md still declares itself a **thin wrapper** — the rewrite adds the contour and the
   membrane; it does **not** re-describe the brainstorming loop, the reviewer protocol, or SDD
   (`#parallel-evolution-creep`; the skill's own opening paragraph is the standard it is held to).
5. `wc -l .claude/skills/arch/SKILL.md` < 600.
6. Principle tests green; `npx tsx scripts/render-rule-index.mjs --check` green.
7. PR body carries the **§1.7 forward + backward self-check** and a `Prior-art:` trailer (or the
   ≥20-char escape-hatch rationale) — see §3.
8. Zero edits under `.claude/rules/`, `CLAUDE.md`, `.husky/`, `.claude/settings.json`
   (`git diff --name-only origin/staging...HEAD` proves it).

```bash host-verify
npx vitest run packages/core/skills/upstream-skill-reference.test.ts
npx vitest run packages/core/principles/09-doc-authority-hierarchy.test.ts
npx vitest run packages/core/principles/12-ai-laziness-traps.test.ts
npx tsx scripts/render-rule-index.mjs --check
```

## §3 §1.7 self-check obligation for this stage's PR

Both halves, in the PR body, with `file.ext:line` evidence in each:

- **Forward-check** — this stage's own compliance: [no-paid-llm-in-ci.md](../../rules/no-paid-llm-in-ci.md)
  (the smoke is deterministic vitest, zero API calls); [doc-authority-hierarchy.md §2-§3](../../rules/doc-authority-hierarchy.md)
  (the skill's header grows to cover the new sections); [build-first-reuse-default.md](../../rules/build-first-reuse-default.md)
  (verdict for the smoke — state it, and state whether a capability commit fired per CLAUDE.md's
  ≥80-LOC / new-subdirectory / new-dependency test); [language-discipline.md](../../rules/language-discipline.md)
  (machinery in English); [attention-is-not-a-mechanism.md §1](../../rules/attention-is-not-a-mechanism.md)
  (name which W2/W3 obligations are gates, which are named-agent protocols, and which are honestly
  prose — do not dress prose as a gate).
- **Backward-check** — in the **enumeration format**, not a restatement (T21). Class of this change
  = *wrapper skills that delegate to an upstream engine and state a delta*. Enumerate ALL such
  surfaces with grep evidence — at minimum `.claude/skills/arch/`, `.claude/skills/night-mode/`,
  `.claude/skills/pipeline/`, `.claude/skills/claude-glm-executor-handoff/`,
  `.claude/skills/rule-research/` — and verdict each `SWEPT-CLEAN(evidence file:line)` or
  `GAP-FOUND(action)`. A backward-check whose surface list equals this PR's own file list is
  non-conformant by format. Delegate the sweep to
  [`agents/backward-sweep-auditor.md`](../../../agents/backward-sweep-auditor.md), handing it the
  **class** only — never the diff or this kickoff.

## §4 Descopes (BINDING)

No S-B..S-F content: no dispatch-input contract, no calibration ledger, no L2 population table or
channel build, no budget gate, no small-fixes items. No edits to maintainer-owned artefacts (§0).
No new hooks, no CI workflow changes, no `.claude/settings.json` registration. No retro sweep of
existing kickoffs. No upstream version pins anywhere in the diff.

## §5 AI-laziness traps

See [.claude/rules/ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md). **Active traps for
this stage: T2, T3, T7, T15, T16, T19, T21.**

- **T2** — the smoke is not «shipped» because it is written: fire it at the paired negative,
  observe RED, then GREEN, and quote both. Same for the SKIPPED path.
- **T3** — every W4 claim about upstream is re-verified in **your** environment before you edit,
  with the command and its output quoted. Do not inherit this kickoff's table as fact (it is dated
  2026-07-31 evidence, not a standing truth).
- **T7** — the §2 acceptance list is not a checklist to tick: run each command and paste output.
- **T15** — self-application: this stage rewrites the contour that produced it. State in the PR
  body which kill channel this stage's own work would have hit under the new §1.5, and whether the
  rewrite would have caught the three W4 drifts.
- **T16** — `#pattern-matching-on-name`: W4(a) IS a name-vs-function mismatch. When restating the
  delta, write «upstream's capability: X. Our delta: Y. Evidence: …», never «upstream has no Z».
- **T19** — own adversarial cold-QA of the diff before handoff; a green CI is not a design review.
- **T21** — the backward-check enumerates sibling wrapper skills, not this PR's files (§3).
- **T-SA-A (domain) — «the smoke closes the drift».** The cheapest story for this stage is «drifts
  fixed + smoke shipped → wrapper drift is now gated». It is false by construction (W5). Counter:
  the smoke's own header names the single drift class it covers, and the PR body states plainly
  that the other three classes are carried by review-time judgment, not by a gate.
- **T-SA-B (domain) — «repair a stale claim with a fresher claim».** Replacing «absent through
  v6.1.1» with «absent through v6.2.0», or one upstream line range with another, feels like a fix
  and re-arms the same drift on the next release. Counter: the grep in §2 item 2 is mechanical and
  a reviewer runs it.
- **T-SA-C (domain) — «codify the membrane by re-describing the upstream loop».** Writing the K-pass
  and drill-down rules tempts a full restatement of brainstorming/SDD mechanics for «completeness».
  That is the `#parallel-evolution-creep` the skill's own first paragraph forbids. Counter:
  acceptance item 4 — the wrapper states delegated capability + interface + delta, nothing else.

## See also

- [`docs/superpowers/specs/2026-07-31-arch-v2-context-pipeline-design.md`](../../../docs/superpowers/specs/2026-07-31-arch-v2-context-pipeline-design.md) — §2 arc, ADR-4, §4 item 1 (binding design SSOT for this stage).
- [`.claude/skills/arch/SKILL.md`](../../skills/arch/SKILL.md) — the artefact under rewrite (current SSOT for the choreography until this stage merges).
- [`.claude/skills/night-mode/SKILL.md`](../../skills/night-mode/SKILL.md) — W4(b)/(c) sites; also the tier→model instantiation SSOT that §1.5 must point at rather than restate.
- [ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md) · [attention-is-not-a-mechanism.md](../../rules/attention-is-not-a-mechanism.md) · [kickoff-staging-placement.md](../../rules/kickoff-staging-placement.md) · [doc-authority-hierarchy.md](../../rules/doc-authority-hierarchy.md).
- [`agents/backward-sweep-auditor.md`](../../../agents/backward-sweep-auditor.md) — the cold sweep §3 requires.
