# principle11-batch-lookup — kickoff

<!-- bridge-profile: Z.AI GLM-5.2 SDK -->

> **Type:** I-phase — a performance fix with an exact-equivalence guarantee.
> **Origin:** finding F6 of `docs/meta-factory/research-patches/2026-07-24-autonomous-loop-diagnostics.md` (merged, #1129). Measured 2026-07-24; the numbers are quoted in §1.
> **Deliverable:** one PR against `staging` — the batched lookup, an equivalence test, and the measurement.
> **Base branch:** staging.

## §0 Cold-start context — self-contained, read only this

`packages/core/principles/11-build-first-reuse-default.test.ts` enforces that every
**capability artifact** (a new rule, skill, agent, or a TypeScript module past a LOC threshold)
either matches an entry in the prior-art SSOT or carries a `Prior-art:` trailer on the commit that
introduced it. It runs on **every push**, as part of the pre-push gate — not only in CI.

To do that it must answer, per file: *which commit added this file, when, and what did its message
say?* Today it asks git that question one file at a time.

## §1 The defect and its measured cost

The gate blocked two pushes on 2026-07-24 by exceeding its own 30 000 ms budget. Both passed on
retry — so this is a flake, not a hard failure, which is exactly what makes it corrosive in an
unattended run where no human is there to retry.

| measurement | value |
|---|---|
| budget (`:325`, `{ timeout: 30000 }`) | 30 000 ms |
| five isolated runs of the file | 23.93 · 24.11 · 24.15 · 25.99 · 26.08 s |
| margin | 13–20% |
| what the comment at `:322` claims justifies the budget | «~180 files (~13s standalone)» |
| actual population today (reproduce `getCapabilityFiles()`) | **200 files** |
| repository history | **1474 commits** |

**+11% files for +92% time — so population growth does not explain it.** The cost driver is
`getPriorArtTrailer()` at `:182-194`, which spawns **up to three git subprocesses per file**:

```ts
const sha = git(`git log --diff-filter=A --format=%H -1 -- "${relPath}"`);   // :184
const commitDate = new Date(git(`git show --format=%ai -s ${sha}`));         // :187
const body = git(`git show --format=%B -s ${sha}`);                          // :190
```

The first is the expensive one: `--diff-filter=A` makes git walk back from HEAD until it finds the
commit that *added* that path. For a long-lived file that is nearly the whole history. So the cost
is roughly `files × depth-to-their-introduction`, and **the second factor grows with every merge**
— including merges that add no capability files at all. The gate therefore gets slower as a
function of repository age, on work entirely unrelated to it, and will cross its budget on its own.

**Raising the timeout is not the fix.** It postpones the same failure and leaves the growth curve
intact. Say so explicitly in your report if you disagree, with evidence.

## §2 Scope — the fix

**The «how» in one sentence:** replace the per-file lookups with **one pass over history** that
builds a `path → {sha, date, body}` map, then serve every file from that map.

The natural shape (you may choose another if you justify it):

```bash
git log --diff-filter=A --name-only --format='%x00%H%x00%ai%x00%B%x00'
```

One walk emits every add-event in the repo with its commit metadata; group by path, keep the
**most recent** add per path (a file deleted and re-added must resolve the same way `-1` does
today), and look each capability file up in the resulting map.

**Binding: exact behavioural equivalence.** The three `TrailerResult` outcomes must be unchanged
per file: `'__no-introducing-commit__'` when no add-event exists, `'__grandfathered__'` when the
introducing commit predates the grandfather date, and the joined `Prior-art:` trailer text (or
`null`) otherwise. A file that is currently `__grandfathered__` must not become `null`, and vice
versa — that would flip the gate's verdict on real commits.

**Watch the parsing.** Commit bodies contain newlines, blank lines, and arbitrary text including
lines that look like field separators. Choose a delimiter strategy that cannot be forged by a
commit message (the `%x00` NUL above is one option) and state why yours is safe. A naive
newline-split parser will mis-attribute bodies and silently corrupt the map — which would pass a
green suite while the gate quietly stops enforcing.

| file | what changes |
|---|---|
| `packages/core/principles/11-build-first-reuse-default.test.ts` | `getPriorArtTrailer` → map-backed lookup; `scanCapabilities` builds the map once |
| the same file's timeout comments (`:322`, `:361`) | update to describe the new cost model honestly |

**Out of scope** (report, do not fix): the SSOT format, the capability-file definition, the
grandfather date, the pre-push gate wiring, and any other principle test.

## §3 Acceptance criteria

1. **Exact equivalence on the live repository.** For all files `getCapabilityFiles()` returns, the
   new implementation and the old one produce identical `TrailerResult` values. Demonstrate it —
   keep the old function under a temporary name, run both over the full population, and assert
   equality per file. Paste the count compared and the count of mismatches (which must be 0).
2. **Equivalence on the awkward cases**, constructed in a throwaway git repo rather than hoped for:
   a file added, deleted, and re-added later; a commit body containing blank lines and a line that
   mimics your delimiter; a commit with two `Prior-art:` lines (they are joined today); a file that
   has never been added (`__no-introducing-commit__`); a file introduced before the grandfather date.
3. **The gate still fails when it should.** A capability artifact with neither SSOT entry nor
   trailer is still rejected. Prove it by construction, not by assertion.
4. **Measured improvement.** Report before/after wall-clock for the file, five runs each, same
   machine, same repo state. State the numbers plainly. If the improvement is under 2×, say so —
   an honest small win beats an inflated one.
5. **Suite green:** `npx vitest run packages/core/principles/11-build-first-reuse-default.test.ts`,
   then the broader `packages/core/principles` suite.
6. **Timeout comments tell the truth.** After the fix, `:322` and `:361` must describe the new cost
   model. If the new cost makes the 30s budget unnecessary, lower it and say by how much — a budget
   far above the real cost hides the next regression.

## §4 Constraints (binding)

- **Base `staging`.** One PR, one concern.
- **No `--no-verify`, no gate bypass.** If a pre-commit or pre-push gate rejects you, fix what it names and retry. Note: the gate you are fixing runs on your own push — if it times out, that is data for §3 item 4, not a reason to bypass.
- **Do not weaken the gate to make it fast.** Dropping a check, widening the grandfather window, or skipping files would "fix" the timing and destroy the point. Any reduction in what is checked is out of scope and must be reported instead.
- **PR body needs `### §1.7 Forward-check applied` and `### §1.7 Backward-check applied`** (H3 verbatim), each ≥40 non-whitespace characters and each citing at least one real `file.ext:line` whose content says what you claim. The backward-check must enumerate the sibling surfaces of this change-class — **other principle tests or gates that shell out to git per-item in a loop** — with a verdict per surface.
- **Commit trailer:** `Prior-art: skipped — performance fix to an existing principle test, no new capability`.
- **Park, don't guess.** If exact equivalence proves unreachable for some case, stop and report the case with its command output. Do not silently accept a divergence.

## §5 AI-traps active (per `.claude/rules/ai-laziness-traps.md` §2 and §3)

**Active canonical traps: T2, T3, T14, T15, T19, T21.**

- **T2 — designing ≠ running.** "One git pass would be faster" is not a deliverable. Run both implementations, paste the comparison and the timings.
- **T3 — no prose-only findings.** Every claim carries a command + its output, or a `file:line` with the line's actual content.
- **T14 — clean ≠ covered.** A suite that passes because the map is empty is not evidence. Assert the map's size against the population size.
- **T15 — self-application.** This gate checks that capability commits carry provenance. State whether your own commit is subject to it, and what it decided.
- **T19 — own cold-QA before handoff.** CI green is not a design review.
- **T21 — the backward-check sweeps siblings, it does not restate the PR.** See §4.

**Domain-specific trap — T-BATCH-A «the fast version is silently emptier».** A parser bug that
drops most entries makes the map small, the lookups fast, and the suite green — because a file
missing from the map falls through to `__no-introducing-commit__`, which is an *accepted* verdict
that skips the trailer requirement entirely. The gate would then enforce almost nothing while
appearing to run 10× faster: a strictly worse outcome than the slow version. Criterion 1's
per-file equivalence check is the falsifier — run it over the **whole** population, not a sample,
and report the compared count.

**Domain-specific trap — T-BATCH-B «measured on a warm cache».** git caches aggressively; running
the old version first and the new one second flatters the new one. Interleave the runs or clear
what you can, and state exactly how you measured. If you cannot control the cache, say so and
report the numbers as indicative rather than authoritative — an honest caveat is worth more than a
clean-looking number that does not reproduce.

## §6 Report — what to hand back

1. The PR number and branch.
2. The acceptance table: criterion → command → verbatim output → PASS/FAIL, all 6 rows.
3. The equivalence result: population size, files compared, mismatches (expected 0), and how the awkward cases in §3 item 2 were constructed.
4. The timing table: five runs before, five after, and your measurement method (T-BATCH-B).
5. The backward-check enumeration: other per-item git loops you found, with `file:line` and a verdict.
6. **Field note (report only, not part of the PR):** record verbatim any hook output you saw while working. If you saw nothing, write `NOTHING APPEARED` rather than inferring.
7. Anything you could not verify, named as such.
