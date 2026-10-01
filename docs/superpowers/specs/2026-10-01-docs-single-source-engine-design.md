# Docs single source — the engine (mid-level design and build slices)

> **Authoritative for:** the mid-level decisions under the approved top level — named places,
> the lock file and relink, the page binding syntax, the fence, gate channels, classes, the
> passport region markers — and the ordered build slices with their gates.
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists);
> the top-level decisions — [2026-09-30-docs-single-source-design.md](2026-09-30-docs-single-source-design.md)
> (its register is not reopened here; «Revising a decided row» there governs any change); the
> hand-over rows HO-1..HO-9 — the one-button second wave
> (`.claude/orchestrator-prompts/one-button-w2-docs-handover-ho/kickoff.md`).

**Measurement SHA:** `b28716620fd` (`origin/staging`, 2026-10-01). Every `path:line` below was
read at that SHA.

## Operator premises (pointers, not transcript)

- OP-51 approve the top level; OP-52/53 build in slices through the aif factory, verified by Opus.
- OP-54/55: decide on the merits and own it; «the operator chose it» is provenance, not an
  argument; consent only at the floors (top-level spec, «Revising a decided row»).
- OP-56 (2026-10-01): build work goes to the factory to save limits; this mid-level design is the
  lead's own work in `/arch`, not a factory task.

## What exists (the bricks, measured)

| Brick | What it does today | Evidence |
|---|---|---|
| Fence | `<!-- getff:begin section=<id> plan=<path> -->` … `<!-- getff:end section=<id> -->`; unknown attributes kept | `packages/core/composition/fence.ts:4-5`, `:10-12`; 76 end markers in the repo |
| Renderers | ten `scripts/render-*.mjs`, each with `--write` / `--check` | `scripts/render-invariants.mjs:31-32` (mode contract) |
| Fact layer | `docs/site/face-facts.json`, keys `maturity installCommands firstSteps rosters counts enforcementOutcomes`; each family carries `source` | `docs/site/face-facts.json:85-89` |
| Whole-file binding | page frontmatter `sources:`; a change to a cited path in the range fails unless the page changed too or carries `docs-refresh: deferred — <reason>` | `scripts/check-docs-refresh.mjs:7-15` |
| Line citations | `path:NN` in live docs; ARM 1 compares the cited line with what it said at the citing line's blame commit; ARM 2 flags a blank landing | `scripts/check-line-citations.mjs:14-29` |
| Gated corpus | `.claude/rules/ .claude/skills/ agents/ CLAUDE.md AGENTS.md CONTRIBUTING.md docs/site/` | `scripts/check-line-citations.mjs:425-433` |

ARM 1 is already a signature check, with `git blame` as the implicit record. Its two declared
blind spots — a citation wrong at birth, and a reflow of the citing line that resets the baseline
(`check-line-citations.mjs:21-25`) — are exactly what an explicit verification record closes.

## Live decision register

| Id | Decision | Status | Resolution | Falsifier |
|---|---|---|---|---|
| E-1 | Named place | answered | `path#<kind>:<name>`, four kinds: `h:` markdown heading by its GitHub slug (`README.md#h:why-this-exists`); `fn:` shell or JS/TS top-level function (`setup.d/lib.sh#fn:transform_internal_refs`); `jp:` RFC 6901 JSON pointer (`docs/site/face-facts.json#jp:/installCommands/source`); `L:` line range, the fallback, `path:NN` or `path:NN-MM` as today. A place's CONTENT is the heading's section up to the next heading of the same or higher level; the function's body to its closing brace at column 0; the JSON value serialised canonically; the lines | a named place a live page needs cannot be written in the four kinds and the line range is also unstable (it moves on every edit above it) |
| E-2 | Signature | answered | sha256 of the place's content after two normalisations only: CRLF→LF, strip trailing whitespace per line. No semantic normalisation (a reworded comment IS a change the bound prose may depend on) | relinks without a page edit exceed half of all alarms (top level M4's falsifier) because of comment-only churn — then add comment stripping per kind |
| E-3 | Lock file | answered | one file per repo, `docs/docs.lock.json`, JSON, sorted keys, one entry per binding: `{page, place, signature, since, relinks[]}`; a relink record is `{reason, from, to, verdict}` where `verdict` is the path of the relink-audit agent's structured verdict. It is a VERIFICATION RECORD (top level, statement 3): no command rewrites it wholesale | a command in any slice writes more than the entries named on its command line |
| E-4 | Moves without change | answered | when a bound place's content is unchanged but its line numbers moved, `--fix` rewrites the citation's numbers in the page and leaves the signature alone. This is not a relink: meaning did not move. Line-range places are relocated by searching the signature in the same file; not found → red | a relocation lands on a duplicate block with the same signature (two identical ranges in one file) — then the fix must refuse ambiguity, not pick |
| E-5 | Page binding syntax | answered | two carriers, both already in use: (a) site pages keep frontmatter `sources:`, whose entries now accept named places; a bare path stays navigation (top level F9); (b) every other live doc binds by its inline citations — `path:NN`, `path:NN-MM`, and the new `path#kind:name`. No third syntax | a live doc needs to bind a place without writing a visible citation (then add a comment carrier `<!-- binds: … -->`, not before) |
| E-6 | Fence for rendered values | answered | reuse the existing `getff:begin section=… plan=…` fence as is; `plan=` names the renderer; its `--check` is the gate. The engine adds no second fence | a rendered value needs a place the fence cannot hold (inside a table cell, a code span) — none of today's `plan=` fences (19 begin markers repo-wide) sits in such a place |
| E-7 | Renderers as bricks | answered | the engine's `--check` runs every `scripts/render-*.mjs --check` it finds, plus the lock, refresh, citation and class gates; the renderers keep their own files and tests | a renderer cannot run under the one command (different runtime); `render-install-roster.mjs:29` needs `tsx`, so the command runs through `tsx`, not bare `node` |
| E-8 | The one `--check` command | answered | `npx tsx scripts/docs-gate.mjs --check` (getff and consumer alike; the consumer copy ships at the same path). Exit 0 green, 1 red, 3 PENDING (engine present, no generated bindings; top level C-Q1). This is the command one-button stage B waits on | stage B's owner needs a second command to judge «engine exists» — then this one is wrong-shaped |
| E-9 | Gate channels, getff | answered | pre-commit: citation ARM 2 (as today) + lock check over staged pages and staged bound sources only; pre-push: the full `docs-gate --check` (lock, renderers, refresh, classes, B-Q2 arm); CI `audit-self.yml`: the same full command with `fetch-depth: 0`; inside the aif container: the task's own check runs the pre-push set (top level H1). No edit-time gate: it would read the lock on every edit for no earlier catch than pre-commit | a red that the pre-push catches was writable into a commit that pre-commit could have refused cheaply — then move that arm down |
| E-10 | Gate channels, consumer | answered | where Node exists: the same pre-commit/pre-push sections through the consumer's installed hooks; CI arm on every lane (top level N-Q3; the earliest channel on cargo and go). PENDING exits 3 on every channel and is shown as not done, never green | a consumer lane's CI cannot run `npx tsx` (no network for npx) — then vendor `tsx` with the engine |
| E-11 | Merge commits | answered | a lock entry in a merge commit is valid when it equals that entry in EITHER parent (it was verified there); only an entry that differs from both parents needs a relink record or a bound-page edit in the merge commit itself. A source change arriving from one parent with its page edit in the same parent is therefore green | a merge that combines a source change from one parent with a stale page from the other passes — the gate must then also re-hash every bound place in the merge result (it does: the signature check runs on the tree, the parent rule only exempts the RECORD) |
| E-12 | Classes file | answered | `docs/doc-classes.json`: `{live: [dirs/globs], history: [...], vendored: [...]}`; one file (top level H-Q2). Every tracked `*.md` must match exactly one class; zero unclassified is one of the three ACC zeros | two classes match one file and no order rule settles it — then make the list ordered, first match wins |
| E-13 | Umbrella idle clock | answered | N = 30 days, counting only commits that touch that umbrella alone. Measured now: 41 umbrella directories have no `done.md`; by last commit touching them at all, 24 are ≥30 days idle (the ages cluster at 40 days, a bulk commit) | a kickoff idle ≥30 days is dispatched and read as live after being classed history — then N is too short |
| E-14 | «A spec's design is built» | answered | a spec is live while any umbrella it names in a front line `Umbrellas: <slug>[, <slug>]` is live; with all named umbrellas done or idle it is history. The 92 specs get this line in one agent sweep; a spec with no umbrella is history unless the sweep marks it `Umbrellas: none — live` with a reason | the sweep cannot name an umbrella for most live specs (they were built by hand, no umbrella) — then fall back to the spec's own `Status:` line (9 of 92 have a line starting with `Status` today) |
| E-15 | Passport region markers | answered | the fence vocabulary with a source attribute: `<!-- getff:begin section=decided owner=human -->` … `<!-- getff:end section=decided -->`, sub-blocks `section=decided-goal-scope`, `-goal-core`, `-invariants`, `-never`, `-non-goals` (top level F3). No `plan=`: the region is a source, never rendered over | AI Factory's passport writes drop HTML comments (then the markers must be headings, which top level T-Q4 rejected — escalate, do not decide here) |
| E-16 | AI-Factory-written sections (T-Q4b) | answered | everything in `.ai-factory/DESCRIPTION.md` and AGENTS.md outside the getff region is AI-Factory-owned; getff reads no fact from it (a gate: no `source`/binding may point inside the passport outside the region). Region survival: the first build tries the skill-context channel (top level, open detail); the gate «passport without region is red» plus a restore from the last green commit is the fallback | a live measurement shows `/aif` rewriting the region even with the skill-context rule in place — then T-Q4's falsifier fires and the top level is revisited, not this row |
| E-17 | Upgrade of an installed consumer | answered | the installer at the new version brings the engine; the consumer has no lock yet → PENDING (exit 3); the next agent session's start hook hands it to the agent, which generates bindings and the lock. No migration script: the first lock is a creation, not an upgrade | the agent-generated first lock is too large to review — then the first lock is written per family, in several commits |
| E-18 | Legacy sweep order | answered | (1) classes file with every doc classed; (2) the entry docs' stale citations fixed (20 of 27 resolvable were stale at 143f281e003) and the entry docs enrolled in the gated corpus; (3) the lock seeded from today's resolvable citations, one agent pass per corpus directory; (4) the 28→41 umbrellas swept by the idle rule, E-13 | the seeding pass relinks more than it verifies — then it is rubber-stamping; stop and re-plan |

## Build slices (each one factory task, one PR; gates first — top level F2)

| # | Slice | Depends on | Exit gate | Ships to consumers |
|---|---|---|---|---|
| S1 | `./setup` flags from code (kickoff on staging via PR #2007) | — | `node scripts/render-face-facts.mjs --check` | no |
| S3 | Named-place resolver (E-1, E-2): a module that resolves the four kinds and hashes content; fixture test per kind | — | its unit test | yes |
| S4 | Lock + relink (E-3, E-4, E-11): `docs-gate.mjs` with `--check`, `--fix` (moves), `--relink <page> <place> --reason …`; pre-commit and pre-push sections | S3 | `npx tsx scripts/docs-gate.mjs --check` exits 0 on an empty lock; RED fixtures for change, move, merge commit | yes |
| S5 | Classes file + classifier (E-12, E-13, E-14) as a `docs-gate` arm | S4 | zero unclassified on staging | yes |
| S6 | Relink-audit agent + its verdict gate (top level M4); B-Q2 arm for new bare paths and typed values | S4 | a relink without a verdict file fails pre-push | yes |
| S7 | Legacy sweep 1: entry-doc citations fixed and enrolled; lock seeded (E-18 steps 2-3) | S4, PR #1993 merged | citation gate green over the enlarged corpus | no |
| S8 | Legacy sweep 2: specs' `Umbrellas:` lines, umbrella idle classing (E-18 step 4) | S5 | zero unclassified | no |
| S9 | Passport region + goal/invariants rendered from it (E-15, E-16; top level T-Q4, F5) | S4; one-button HO-5 | `render-invariants.mjs --check` against the region | yes |
| S10 | Skills: one-source rule text (F6, card via trigger-build slice 4), human-docs skill (F7) + upstream-sha check | S4 | skill tests; the `pin-freshness`-pattern job | yes |
| S11 | Memory audit (SCOPE-U): the auditor runs the citation tool over agent memory | S4 | auditor report format test | no |

The consumer shipping of S3-S6, S9, S10 (install weight, lanes, PENDING in the install report) is
one-button HO-1..HO-4, HO-9 and is built there, against the E-8 command.

## What stays with others

One-button stage B consumes: the command (E-8), its exit codes, the lock path (E-3), the classes
file path (E-12). Nothing else crosses.

## Testing seams

Existing seams only: each renderer's `--check`; the fixture tests of `check-line-citations.mjs`;
`tests/install-sh/baselines/` for the consumer copy; principle tests for the corpus lists. The new
module S3 is tested through its own fixtures and then only through `docs-gate --check`.

## Parked questions

None. Every row above is a mid-level choice with a falsifier; none touches a floor (goal,
invariants, «never» lines, non-goals, merge to main). E-15 and E-16 carry an escalation clause to
the top level if a live measurement contradicts T-Q4.
