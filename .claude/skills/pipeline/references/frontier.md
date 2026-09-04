# /pipeline dependency frontier — grammar + degrade rules

> **Authoritative for:** the `helpers/frontier.sh` output grammar, the done-basis layers, the
> no-column degrade rule, and the override seams — the detail behind SKILL.md §3 Step 1
> (`Stage` column) and §6 Step 1 (stage gate). Mechanises D-H13 / operator-axis spec §5.4.
> **NOT authoritative for:** whether a stage really merged — SKILL.md §6 Step 1's
> `gh pr list --search "is:merged head:<branch> base:staging"` is the authority. NOT
> authoritative for sub-wave detection (`helpers/launch-table-generator.sh`, a different
> population). NOT authoritative for project goal — see
> [README.md#why-this-exists](../../../../README.md#why-this-exists).

> **Origin:** skill-harmonization-mechanisms umbrella, stage S3, 2026-08-18. Source of truth:
> [operator-axis spec §5.4](../../../../docs/superpowers/specs/2026-08-18-skill-stack-harmonization-design.md).

<!-- @dual-pair: meta-orchestrator-frontier -->
<!-- spec: ../helpers/frontier.sh (emitter) ↔ SKILL.md §3 Step 1 + §6 Step 1 (consumers) -->

---

## §1 Why mechanical

Stage tables have carried a `Depends on` column for months (16 tracked kickoffs as of
2026-08-18; the mold is `<orch-home>/arch-v2-context-pipeline/kickoff.md` §1, header row `:91`
— a backticked path, not a link: `<orch-home>` resolves per install and the framework copy is
never delivered) — and the dispatchable set was still re-derived by eye at every
dispatch. Reading a column is a mechanical act, so leaving it to attention is
`#hope-as-gate` ([attention-is-not-a-mechanism.md §1](../../../rules/attention-is-not-a-mechanism.md)):
the failure mode is «nobody looked», which is precisely how a stage gets dispatched onto an
unmerged dependency. `frontier.sh` reads the column; §6 still decides.

**One spelling only — for edges the mechanism reads.** A new edge is spelled `Depends on`, in
the stage table. A second spelling (`Blocked-by:`) for the same edge is the
`#parallel-evolution-creep` D-H13 exists to kill — if a kickoff needs an edge, it adds a column
cell, never a new vocabulary.

**Measured reach, not a claim of totality** (2026-08-18, over the tracked kickoff corpus):
27 kickoffs mention the edge; **16** carry it as a stage-table column and are read
mechanically; **11** state it in a prose header line (`> **Depends on:** …`) and are NOT
parsed. Prose edges are reported on an `ATTN:` line with their line numbers, because the
degrade path must never read as permission — `meta-orchestrator-bundle-autonomous/kickoff.md:5`
literally says «Do NOT dispatch this umbrella before …», and «every not-yet-done stage is
frontier» next to that sentence, with no pointer, would be the worst of both channels.
Converting those 11 to the column is kickoff-author work, not this helper's job.

## §2 Output grammar

```text
=== frontier: <umbrella> ===
kickoff: <resolved path> (<n> lines)
done-md: yes | no
depends-column: present (header line <n>) | absent
stages: <n>
STAGE <id> done=<no | yes basis=<marker|done-md|override>> deps=<a,b|-|?> unmet=<a,b|-|?> \
      unresolved=<yes|no> label="<first cell>" raw="<Depends-on cell, ≤60 chars>"
FRONTIER: <ids | (none)>
BLOCKED: <id(unmet:a,b) … | (none)>
DONE: <ids | (none)>
UNRESOLVED: <ids | (none)>
DEGRADE: <reason>        # only when the column, or the whole stage table, is absent
WARN: <reason>           # no frontier while stages remain, or contradictory overrides
```

- **`FRONTIER:`** — the dispatchable set: every stage that is not done and whose resolved
  in-table dependencies are all done. It is a _readiness set_, not a topological order.
- **`BLOCKED:`** — the rest, each with the ids it is waiting on.
- **`UNRESOLVED:`** — the dependency cell carried text that resolved to no in-table id (a
  cross-umbrella edge, «maintainer GO on …», a renamed stage). Degrade-safe: the stage still
  counts as frontier, but the flag plus the echoed `raw=` cell keep the call with the reader.
- **`RESIDUE:`** — the cell named an in-table id AND something else; the remainder appears
  verbatim in `residue=` on that stage's line. Descriptive, never a verdict.
- **`ATTN:`** — one line per concern that needs a human or a gh check: marker-based dones to
  confirm at §6, prose dependency lines outside the table (with line numbers), rows carrying no
  `Depends on` cell at all.
- **`(none)`** is emitted rather than an empty line, so a missing answer cannot be read as an
  empty one.

## §3 Done-basis layers (first match wins)

| Layer | Basis               | Read from                                                                                                                                                                               |
| ----- | ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | `done-md`           | `<orch-home>/<umbrella>/done.md` exists → the umbrella is closed, every stage done (same convention as [`priority-score.sh`](../helpers/priority-score.sh) layer C3)                    |
| 2     | `marker-unverified` | an UPPERCASE `MERGED` / `CLOSED` / `RETIRED` / `DONE` **with merge evidence within 60 chars** (a `#<digits>` PR ref, an ISO date, or `staging`), or a bare `✅`, in the row's own cells |
| 3     | `override`          | `MO_FRONTIER_DONE` names the id (applied after layers 1-2)                                                                                                                              |

**`done=yes basis=marker-unverified` is a row-text READ, never a merge proof** — the name says
so, and every such stage is additionally echoed on an `ATTN: marker-unverified done — …` line.
§6 Step 1's `gh` search is the authority; feed its verdict back through the seams below.

Layer 2 has three deliberate narrowings, each with a measured false reading behind it:

1. **Excludes the `Depends on` cell** — «S-G **merged**» in a dependency cell describes the
   EDGE, not the row (live shape: arch-v2-context-pipeline S-E).
2. **Requires merge evidence within 60 chars** — without it the read fires on prose that merely
   contains the word: arch-v2-context-pipeline S-L says «the load-bearing unknown is
   **CLOSED**» about a QUESTION, and reported an unmerged stage DONE, handing its consumer to
   the frontier. This is the false-POSITIVE direction, and it is the one that matters: a missed
   marker only degrades to `done=no`, i.e. toward the gate.
3. **Contradiction is surfaced** — a row read as done while one of its own dependencies is open
   emits `WARN: contradictory row read` instead of sliding into `DONE:` (live shape:
   arch-v2-context-pipeline S-D, `CLOSED-NULL 2026-08-06` with `Depends on: S-C` still open).

**Calibration (measured 2026-08-18, all 16 column-carrying kickoffs with `done.md` neutralised):**
78 stage rows, 9 of them containing a marker word, **6 read as done**. The 3 rejections are the
rule working in both directions — and the second one is a true positive deliberately given up:

- `arch-v2-context-pipeline` S-L — «the load-bearing unknown is **CLOSED**» is prose about a
  QUESTION: correctly rejected (this was a live false green before the proximity rule).
- `arch-v2-context-pipeline` S-D′ — its closure narrative («**CLOSED** — dispatched … and
  **MERGED** 2026-08-08 as PR #1290») sits INSIDE the 794-char `Depends on` cell, which layer 2
  excludes by rule 1. A genuinely merged stage therefore reads `done=no`. **Accepted, not a
  bug:** a false negative routes the claim to the §6 gh gate, a false positive dispatches a
  consumer onto an unmerged dependency. The asymmetry decides. In production the umbrella
  carries `done.md`, so layer 1 answers first anyway.

Falsifier for the 60-char window: wrong if a stage-closure line states the merge with its PR
number or date further than 60 characters from the marker word — re-measure and widen if the
corpus grows such a row.

## §4 Degrade rule (no column)

`depends-column: absent` → every not-yet-done stage is frontier, `deps=?`, plus a `DEGRADE:`
line naming the reason. Ordering becomes the reader's judgment again — the helper never invents
an edge it cannot read. With no stage table at all: `stages: 0` and a `DEGRADE:` line, never a
fabricated frontier.

## §5 Seams

| Seam               | Effect                                                            |
| ------------------ | ----------------------------------------------------------------- |
| `MO_FRONTIER_DONE` | comma/space ids forced DONE — the channel for the §6 `gh` verdict |
| `MO_FRONTIER_OPEN` | comma/space ids forced NOT-DONE — a stale marker demoted          |
| `MO_KICKOFF_DIR`   | override the umbrella dir (default: resolved `<orch-home>`)       |
| `REPO_ROOT`        | override repo root                                                |

An id named by BOTH override lists is a contradiction: `OPEN` wins (fail-safe — the claim goes
back to the gh gate) and a `WARN:` line names the id.

## §6 Ceilings (T14 — a clean read is not a proof)

1. Only edges to stages **in the same table** resolve. A range (`S1–S4 all merged`, hyphen /
   en-dash / em-dash) expands to the inclusive table-order span — taking only the endpoints
   dropped the middle stages silently (measured: `plugin-packaging` S6 `S1–S5`, S8 `S1–S7`,
   `one-click-installer` S5). Whatever the cell names beyond the resolved ids is echoed in
   `residue=` and listed on `RESIDUE:` — never dropped, never judged. A cell that resolves to
   NOTHING while still carrying text sets `unresolved=yes`.
2. Done-detection is the three-times-narrowed marker read of §3, with the §6 gh check as the
   authority and an `ATTN:` echo per marker-based done.
3. Cells split on `|`, with pipes inside inline-code spans protected first — added after the
   T15 self-application run shredded this umbrella's own S2 row on `` `done|verified` ``. A
   literal `|` outside backticks would still mis-split (unobserved across the 16 tracked
   tables; the parallel marker in use is `∥`).
4. A dependency cycle surfaces as `FRONTIER: (none)` + a `WARN:` line, never as a silent empty
   answer. Neither does a recognised header with zero parsed rows: that is `DEGRADE:` +
   `WARN: … the table shape is unrecognised`, so an empty frontier can never be read as
   «nothing to dispatch».
5. Edges stated in PROSE are not parsed — see the measured 16-of-27 split in §1; they surface on
   an `ATTN:` line with line numbers.
6. Only `<umbrella>/kickoff.md` is read. **29 files across 7 umbrellas** keep stages in sibling
   `kickoff-s<N>.md` files (`beta-delivery-ux`, `consumer-install-hardening`, …); those
   umbrellas resolve to `DEGRADE`. `docs/meta-factory/wave-sequencing-plan.md` also carries a
   `Depends on` column — a DIFFERENT population (backlog tasks, the §1 plan-currency source),
   never read here.
7. A row whose `Depends on` cell is missing entirely (short row) is treated as having no
   dependency and named on an `ATTN:` line — reported, not silently trusted.

## §7 Paired-negative contract

[`packages/core/hooks/frontier.test.ts`](../../../../packages/core/hooks/frontier.test.ts) —
24 arms over on-disk fixtures, the WITH-column and WITHOUT-column halves both asserted
(«degrades safely» is a claim about the absent half, and nothing else checks it), plus the
negative arms: marker-in-dependency-cell and marker-without-merge-evidence must NOT mark a row
done, `S1` must not resolve an edge declared on `S1b`, contradictory overrides must WARN, a
cycle must WARN, a range must expand, `| Stage 0 |` rows must parse, a header without a trailing
`|` must still detect, and zero parsed rows must DEGRADE rather than answer empty. Nine are cold-
review regression arms — each reproduces a wrong output the first implementation actually
emitted on the tracked corpus. Both override seams are asserted on fixtures where removing the
seam changes the answer (principle 04, no-tautology: the earlier `MO_FRONTIER_OPEN` arm passed
against an implementation that ignored the variable).

## See also

- [SKILL.md §3](../SKILL.md) — the `Stage` column this feeds · [SKILL.md §6](../SKILL.md) — the gate that decides
- [templates/meta-kickoff.template.md](../templates/meta-kickoff.template.md) §2a — the slicing + fog-of-war vocabulary the frontier serves
- [attention-is-not-a-mechanism.md §1](../../../rules/attention-is-not-a-mechanism.md) — why this is a helper and not a checklist item
