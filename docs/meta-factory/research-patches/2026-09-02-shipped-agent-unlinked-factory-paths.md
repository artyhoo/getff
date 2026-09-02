<!-- scope:shipped-agent-unlinked-factory-paths -->
<!-- Triage of the PR #1563 backward-check GAP: unlinked factory paths surviving
     transform_internal_refs in the shipped agent set. Class (a) fixed in the same PR as this
     file; class (b) recorded as a non-finding with per-agent reasoning; class (c) shipped here
     as patch PROPOSALS for maintainer-owned agents — zero direct edits to those files. -->

# Shipped agents — unlinked factory paths: triage of the #1563 backward-check GAP

> **Authoritative for:** the per-agent triage of the GAP recorded in the PR #1563 §1.7
> backward-check — which unlinked factory paths in shipped agents are defects, which are
> deliberate design-by-spec, and the patch proposals for the maintainer-owned ones.
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists).
> The ownership map — see the Artifact Ownership Contract in [CLAUDE.md](../../../CLAUDE.md).
> The transform itself — see [setup.d/lib.sh](../../../setup.d/lib.sh) `transform_internal_refs`.

## §1 The class, and how it was measured

[`transform_internal_refs`](../../../setup.d/lib.sh) rewrites factory-internal references to the
upstream blob URL **only** when they are markdown links of the form `](../…)`. A factory path
written in backticks or bare prose is invisible to it — and invisible to both link gates
(`lychee` sees no link; the transform has no pattern). Such paths ship verbatim into consumer
projects, where the directories do not exist.

Measured over the shipped agent set (`agents/*.md` minus the installer skip-lists at
`setup.d/20-agents.sh:26-40` and `install.sh:628-640`, minus the two factory-profile-gated
agents), by running the real transform over a copy and then scanning what survives **outside** a
rewritten link:

```bash
cp agents/<x>.md /tmp/x.md
bash -c 'set -uo pipefail; PKG_ROOT=.; PROJECT_ROOT=.; FORCE=; DRY_RUN=; SKIPPED=(); \
  . setup.d/lib.sh; transform_internal_refs /tmp/x.md'
perl -pe 's/\[[^\]]*\]\([^)]*\)//g' /tmp/x.md \
  | grep -nE "(docs/(meta-factory|superpowers)/[A-Za-z0-9._/-]+|\.claude/rules/[A-Za-z0-9._-]+\.md|packages/core/[A-Za-z0-9._/-]+)"
```

Note the `perl` step: stripping whole `[text](url)` constructs is load-bearing. A raw `grep`
also matches the **link text** of a correctly-rewritten link and inflates the count — the
counts in the #1563 backward-check were taken that way. Counted as path OCCURRENCES outside a
rewritten link, the numbers move in BOTH directions from that record — `rule-test-author` 18
(not 12), `rule-researcher` 11 (not 9), `compliance-verifier` 3 (not 1), `review-sidecar` 4 (not
3), the rest unchanged. The class itself reproduces exactly.

| agent                         | unlinked factory paths (before) | (after this PR) | class                        |
| ----------------------------- | ------------------------------- | --------------- | ---------------------------- |
| `rule-test-author`            | 18                              | 18              | (b) design-by-spec           |
| `rule-researcher`             | 11                              | 11              | (b) design-by-spec           |
| `review-sidecar`              | 4                               | 4               | (c)+(d) → §4 P2 + §4.5       |
| `docplan-auditor`             | 4                               | **0**           | (a) fixed                    |
| `compliance-verifier`         | 3                               | **0**           | (a) fixed (after §3.5 (i))   |
| `memory-codification-auditor` | 2                               | **0**           | (a) fixed                    |
| `fidelity-auditor`            | 3                               | **0**           | (a) fixed                    |
| `capability-reuse-auditor`    | 1                               | **0**           | (a) fixed                    |
| `living-docs-auditor`         | 1                               | 1               | (c) maintainer-owned → §4 P1 |
| `aif-init`                    | 0                               | 0               | clean                        |
| `claims-conformance-auditor`  | 0                               | 0               | clean (fixed by #1563)       |

## §2 The line between (a) and (b)

A factory path in a shipped agent is a **defect** when the agent merely POINTS at it — a
discipline doc or a framework-internal file the consumer's session is asked to consult. It is
**not** a defect when the path is a WORKING path of a lane that documents a framework checkout
as its own precondition.

The precondition is documented, not assumed:

- `INSTALL-FOR-AI.md:15` — the only live install path is `git clone https://github.com/artyhoo/getff /tmp/getff`.
- `INSTALL-FOR-AI.md:66` — «(adjust the path if Step 0 cloned the framework elsewhere)».
- `INSTALL-FOR-AI.md:298-299` — «the framework checkout you cloned for `install.sh` already has
  it — `npx tsx` is the standard CLI invocation pattern».
- `INSTALL-FOR-AI.md:584` — «(`npx tsx …` from the framework checkout)».

So the rule-generation lane's `packages/core/…` citations resolve for a consumer who followed
the documented install, and one of them (`agents/rule-researcher.md:207`) is a **shell command**
— `npx tsx packages/core/install/rule-bootstrap-cli.ts --from-practice …`. Converting that to a
markdown link would be a defect, not a fix.

The fix shape for class (a) is the repo's own established idiom, already visible inside the same
files: `agents/fidelity-auditor.md:14` cites `packages/core/hooks/checks/pr-body-fidelity.ts` as
a relative link that the transform rewrites, while `:105` cited the same file bare. Intra-file
inconsistency, not a design decision.

## §3 Class (b) — recorded non-finding, per agent

**`agents/rule-researcher.md` (11).** Every hit is the rule-generation lane's own working
surface, reachable from the framework checkout §2 documents:

- `:20` — `packages/core/synthesizer/`, `packages/core/validator/`,
  `research-to-clippy-node.ts` in the `NOT authoritative for` row: the deterministic tail this
  protocol hands JSON to.
- `:134`, `:138` — `packages/core/research/allowlist.ts`. `:138` is an explicit instruction
  («read … for the current set; do not trust this snapshot as authoritative») guarding a
  load-bearing trust boundary. The instruction is only meaningful against the live file.
- `:172-173` — the `AstgrepResearchedPractice` schema reference plus the committed example
  fixture the author is told to match.
- `:207` — the `npx tsx packages/core/install/rule-bootstrap-cli.ts` command itself.
- `:264-265`, `:272` — the clippy bridge's location and its CI live-fire evidence.
- `:290-291` — `agents/rule-test-author.md:63` / `:70` cited with line numbers as evidence for a
  claim about CI state. A link cannot carry the line anchor; the checkout can.

**`agents/rule-test-author.md` (18).** Same class throughout, and the density is the point: this
protocol's entire subject matter is framework-side validator/backend/synthesizer material —
`packages/core/synthesizer/canonical-rule-hash.ts:28`, `verify-provenance.ts:108-110`,
`types.ts:22-26,67-68`, `validator/validate.ts:22-42`, `diagnostics/registry.ts:180-259`,
`backends/*/capability-matrix.json`, the committed astgrep fixture. Each is a `file:line`
citation backing a specific factual claim about how a lane is proved. Rewriting them to blob
URLs would strip the line anchors that make them checkable, and this agent's tool set does not
include `WebFetch` either way. Recorded as deliberate design-by-spec; it is also
maintainer-owned, so no proposal is raised.

**Falsifier for §3.** This verdict is wrong if the framework ever ships a consumer install path
that does NOT leave a framework checkout on disk (the deferred `npx getff@latest init` entry
point, `INSTALL-FOR-AI.md:19`). On that day every path in this section becomes class (a), and
the two rule-generation agents need a real answer — most likely vendoring the cited constants
rather than link-rewriting the citations.

## §3.5 Class (d) — blocked by the plugin-twin depth constraint

Three shipped agents are also **plugin twins**: `plugin/agents/` holds byte-identical copies of
`compliance-verifier.md`, `living-docs-auditor.md` and `review-sidecar.md`. Principle 24(d)
(`packages/core/principles/24-plugin-manifest-integrity.test.ts:274`) requires byte-identity, and
`scripts/generate-plugin-twins.sh:164-166` states it plainly — the agent arm is a `cp`, «no
header, no marker, no transform».

The twin sits one directory deeper than its source. A `](../.claude/rules/…)` link that resolves
from `agents/` resolves to `plugin/.claude/rules/…` from `plugin/agents/` — a path that does not
exist — and byte-identity forbids rewriting the depth in the copy. **So a twinned agent cannot
carry the class-(a) fix at all.** No relative prefix satisfies both depths.

**Correction (2026-09-02, same day).** This section first claimed a root-relative `](/…)` was
ruled out because «the pre-push lychee arm does not pass `--root-dir`». **That was false and is
retracted** — the arm DOES pass it (`packages/core/hooks/pre-push.ts`, the `--root-dir REPO_ROOT`
argument in `lycheeSection`), so lychee would resolve such links at both depths. Root-relative is
still the wrong answer, for a different and better reason: `transform_internal_refs` matches only
`](../…)` (`setup.d/lib.sh:147-163`), so a root-relative ref ships VERBATIM into consumer
projects and dangles there. Verified by running the transform over a two-link fixture — the
`](../…)` line was rewritten to the blob URL, the `](/…)` line came out untouched. The option
fixes the gate and keeps the defect.

Measured, not reasoned: the fix was applied to `agents/compliance-verifier.md`, the twin
re-synced, and the pre-push §8 gate went RED on the twin —

```text
[plugin/agents/compliance-verifier.md]:
[ERROR] …/plugin/.claude/rules/phase-research-coverage.md (at 44:43) | File not found
[ERROR] …/plugin/.claude/rules/phase-research-coverage.md (at 91:31) | File not found
[ERROR] …/plugin/.claude/rules/phase-research-coverage.md (at 144:3) | File not found
```

The change was reverted; `agents/compliance-verifier.md` and its twin are byte-identical to
`origin/staging`. This also explains a fact that would otherwise look accidental: **none of the
three twinned agents carries a single `](../…)` link today**, while every non-twinned agent does.
The constraint has been shaping these files all along, unstated.

**RESOLVED — operator chose option (i), 2026-09-02.** The options as put, cheapest first, were:
(i) narrow the pre-push §8 lychee arm to skip `plugin/agents/**` — the twin is a byte-copy whose
links are already validated at the source path, so checking it twice at the wrong depth buys
nothing; (ii) drop the three agent twins if the plugin does not need them; (iii) accept that
twinned agents cite factory paths in bare prose forever, and say so in the generator's header.

Option (i) landed: `lycheeSection` now drops `PLUGIN_AGENT_TWIN_PREFIX` on BOTH layouts, with the
coverage argument stated at the constant (the source is walked by the same section; a twin can
never legitimately carry content its source does not — principle 24(d) plus the generator's
refuse-to-overwrite arm). Two arms guard it in `pre-push.consumer-layout.test.ts`: a POSITIVE arm
whose lychee stub REJECTS if any `plugin/agents/*` path reaches argv, and a NEGATIVE arm whose
stub rejects if an `agents/*` path does — so a filter widened to a bare `agents/` substring, which
would swallow the source, fails. Both were mutation-checked: neutering the filter turns the
POSITIVE arm RED.

With the constraint lifted, `compliance-verifier`'s 3 paths were converted — it moves from class
(d) to class (a), fixed. `review-sidecar` (4 paths) stays a §4 P2 proposal: unblocked mechanically
now, but still maintainer-owned, and P2's harder half (an instruction to read a rule file the
agent cannot fetch) is untouched by the link form. `living-docs-auditor` is twinned too, but its
single hit is in YAML frontmatter and §4 P1 proposes REMOVAL, not a link — the constraint never
blocked it.

## §4 Class (c) — patch PROPOSALS (maintainer-owned; zero edits made)

Both targets are framework-maintainer-owned per the Artifact Ownership Contract. Nothing below
has been applied.

### P1 — `agents/living-docs-auditor.md:4`: a factory research-patch path inside the description

**Current (frontmatter `description`, rendered in a consumer's agent picker):**

> … Renamed from `docs-auditor` to de-collide with AI Factory's own `docs-auditor` (a different,
> forward job: gating /aif-docs generation) — see
> docs/meta-factory/research-patches/2026-05-20-agent-collision-resolution.md §4.3. …

**Proposed:** drop the trailing `— see docs/meta-factory/…` clause; keep the rest of the
sentence verbatim.

**Why removal rather than a link:** the path sits in YAML frontmatter, where a markdown link
renders literally in the picker instead of resolving. The rename rationale it justifies is
already restated without a path at `agents/living-docs-auditor.md:10`, so nothing is lost.

**Interaction:** `agents/living-docs-auditor.md` already has an open proposal — P2 of
[2026-09-01-s3-owner-proposals.md](2026-09-01-s3-owner-proposals.md), the `/aif-verify` gate
contradiction at `:110` / `:173`. Disjoint lines; the two can land together.

### P2 — `agents/review-sidecar.md`: four unlinked factory paths, two of them load-bearing

**The four:**

| line   | path                                                               | shape                      |
| ------ | ------------------------------------------------------------------ | -------------------------- |
| `:15`  | `packages/core/templates/shared/skill-context/aif-review/SKILL.md` | `@dual-pair` prose comment |
| `:17`  | `.claude/rules/dual-implementation-discipline.md §7`               | `@dual-pair` prose comment |
| `:158` | `.claude/rules/reviewer-discipline.md §6`                          | backticked, in body        |
| `:160` | `.claude/rules/reviewer-discipline.md §6.1`                        | backticked, in body        |

**Proposed — mechanically unblocked (§3.5 option (i) landed), still owner-gated.** The class-(a)
fix (convert each to `[<path>](../<path>)`) was blocked while the pre-push §8 arm walked the twin;
with option (i) landed it is now applicable, and the conversion is mechanical — with one carve-out:
the `@dual-pair: review-sidecar` anchor line must not be touched, because the channel-coverage
probe resolves counterparts by grepping that anchor
(`tests/agnosticism/probes/channel-coverage.sh:56-59`), not by the prose path. What still gates it
is ownership, not mechanics: `agents/review-sidecar.md` is framework-maintainer-owned, so this
stays a proposal.

**The harder half, flagged rather than proposed.** `:160` instructs the reviewer to «grade with
the three-axis rubric **quoted verbatim there**» — i.e. to read `.claude/rules/reviewer-discipline.md`,
which is never shipped. `agents/review-sidecar.md:4` declares `tools: Read, Glob, Grep` — no
`WebFetch` — so a consumer's `review-sidecar` cannot reach the rubric through a blob URL either.
Link-rewriting makes the reference honest; it does not make the instruction executable. The real
options are (i) inline the three-axis rubric into the agent, (ii) grant the agent `WebFetch`, or
(iii) soften the instruction to a self-contained severity contract. That is an owner call about
what this shipped capability promises, not a link fix.

## §5 Observations, not fixed (out of the agreed scope)

- **Bare sibling-agent filenames.** `capability-reuse-auditor.md:22,74`, `docplan-auditor.md:24,103`
  and `fidelity-auditor.md:30` each cite `dispatch-input-checker.md §Output grammar` as a bare
  filename. `dispatch-input-checker` is an authoring-only agent (`install.sh:635`), so the name
  resolves to nothing on a consumer. Same class, different regex; #1563 fixed its instance by
  linking to `../agents/dispatch-input-checker.md`.
- **Shipped skills carry the same class.** `.claude/skills/rule-research/SKILL.md:9,13,14,16,24,32` carry
  bare `agents/rule-researcher.md`, and `:22` carries bare
  `packages/core/research/allowlist-resolver.ts`. Skills
  were outside this triage's population; whether the §2 line applies to them the same way is
  unmeasured.
- **No gate covers this class, by construction.** Both link gates are blind to paths in
  backticks and code fences; a fences detector was measured at 13% precision during the
  shipped-ref allowlist audit and deliberately not built. The class is currently held by audit,
  not by a mechanism — [`attention-is-not-a-mechanism.md §2`](../../../.claude/rules/attention-is-not-a-mechanism.md)
  `#warning-nobody-reads`. Recording it here is the second documented instance; a third would
  meet that rule's §3 promotion bar.

## §6 §1.7 self-application — does this triage survive its own method?

**Forward-check.** The method this patch applies to shipped agents is «run the real transform,
then look at what survives outside a rewritten link». Applied to this patch itself: it is not a
shipped artefact — `docs/meta-factory/research-patches/` is never installed — so its own factory
paths are in-repo references, not consumer-facing ones. They are nonetheless written as relative
markdown links wherever they are references (`../../../CLAUDE.md`, `../../../setup.d/lib.sh`,
[2026-09-01-s3-owner-proposals.md](2026-09-01-s3-owner-proposals.md)) and left as bare paths only
where they are `file:line` evidence citations — the same distinction §2 draws. Note this file sits
under `lychee.toml`'s `exclude_path`, so those links are NOT gate-checked; each was resolved by
hand against the working tree instead.

**Backward-check.** The T1 sampling floor was not exercised — the population here is 11 agents,
enumerated in full (T10: `agents/*.md` minus both installer skip-lists), so every member was read
rather than sampled. The T3 obligation (no prose-only findings) is met per row: each class-(a)
hit carries a `file:line` and each class-(b) verdict carries the `INSTALL-FOR-AI.md` line that
grounds it. The residue the method could NOT reach is stated rather than hidden: the two bare
sibling-agent filenames and the shipped-skills surface in §5 fall outside the regex that defined
this population, and the §3 verdict carries an explicit falsifier rather than a confidence
adjective (T6).

**The surface the enumeration missed until a gate said so.** §1's population was
`agents/*.md` — it never asked whether any member has a copy elsewhere in the tree. The
plugin-twin depth constraint (§3.5) was found by the pre-push lychee arm going RED, not by this
audit, and it invalidated the fix for two of the seven agents plus one of the two proposals. The
enumeration step (T10) should have asked «where else does this artefact exist?», not only «which
files are in the population».

**The self-referential trap this triage nearly walked into.** The first measurement pass used a
raw grep and counted the link TEXT of already-correct links as defects — an audit whose own
instrument produced findings that were not there. It is caught only by running the instrument
against a KNOWN-clean file (`claims-conformance-auditor`, fixed by #1563) and asking why it
still reported hits. That control is now part of the §1 repro.
