# consumer-truth-audit V3R — land `report-v3.md` from the 2026-09-08 host run

> **Umbrella:** [kickoff.md](kickoff.md) — §2 scope lock, §5 truth criterion, §7 evidence
> discipline are binding. **Lane source:** [kickoff-v3.md](kickoff-v3.md).
> **Rigor label (effort-worthiness L0):** `build-and-verify`.
> **Bench:** the framework repo checkout you are running in. **This stage does NOT re-run V3.**
> V3's questions (does a hook fire, does an MCP server load, does a skill route) are only
> observable inside a live harness session — `kickoff-v3.md:5` says the lane is not dispatchable
> to a container, and that stays true. This stage writes up measurements that were already taken
> on the host on 2026-09-08, and re-verifies the half of them that IS re-checkable here.

## §0 Why this stage exists

V3 ran on the host on 2026-09-08 and produced findings. They were never written to a repo
artefact — the umbrella has `report-v0.md` and `report-v2.md` on `staging` and no `report-v3.md`,
so the lane cannot be triaged and the umbrella cannot close (`operational-conventions.md#1`).

Your deliverable is exactly one file:
`.claude/orchestrator-prompts/consumer-truth-audit/report-v3.md`.

## §1 The measured findings (host run, 2026-09-08) — inlined, verbatim in substance

Everything in this section was measured on the operator's Mac under live Claude Code sessions
against three fresh consumer installs (`bench-core`, `bench-full` = the `env` tier,
`bench-factory`), all three `exit 0`. **You did not measure any of it.** Carry each item into the
report attributed as *host-measured 2026-09-08*, never as something this run observed.

### F1 — one shipped directory, one root cause (the lane's main finding)

`.claude/skills/orchestrator/references/` ships at the **`env` tier — the default profile**
(`install.sh:623,627,628`) and carries three symptoms at once:

- **5 lines containing the absolute path** `/Users/art/code/rules-as-tests-aif` —
  `worker-template.md:73,82,107`, `reviewer-template.md:37`,
  `ai-laziness-traps-orchestrator.md:131`.
- **5 references to `npm run test:principles`**, a script the consumer does not have (21 scripts
  in a consumer `package.json`, that one is not among them).
- **9 of 11** dead `.claude/rules/*` citations written in bare backticks.

**Provenance:** the skill was vendored from the operator's machine-global directory (#1420,
`aa7e6a17b2`) and arrived carrying that machine's path; #1452 (`6d8dd9a3e7`) only repointed links
*at* the vendored copy without depersonalising it. Nothing tracks this — the snapshot tests pin a
file hash.

**Earliest channel (recommendation DEC-1):**
`packages/core/principles/39-skill-fence-orch-home.test.ts` catches exactly this class, but its
population is only `SKILL.md` files (`:219-220,237`). Widening it to the whole skills tree,
`references/**` included, is the narrow fix. Control that the mechanism works inside its own
scope: the shipped `pipeline/SKILL.md:32,87,112` uses `${CLAUDE_SKILL_DIR}` correctly.

### F2 — the profile matrix (three fresh installs)

| | core | env | factory |
|---|---|---|---|
| skills | 6 | 11 | 16 |
| agents | 11 | 11 | 11 |
| `.claude/rules/` | 0 | 0 | 0 |
| absolute path present | no | **5 lines** | **5 lines** |

Hooks and agents are **profile-independent** — all 11 agents from `core` upward, exactly as the
generated `AGENTS.md:32` promises. Rules ship on **no profile at all**; together with the
timeliner consumer that is **four strata**, so the «this install is just stale» explanation is
dead.

### F3 — counting claims in the docs are checked by nothing (structural, T15)

The operator suite's size is stated as **three different numbers** in the project's own docs:
`README.md:123` → 6, `INSTALL-FOR-AI.md:71` → 7, `INSTALL-FOR-AI.md:459` → 5. The SSOT
`setup.d/lib.sh:63` = **5**, the generated consumer `AGENTS.md` = **5**, and the measured
`env`→`factory` delta = **5**. Exactly two sources are right: the code and the *generated* doc.

Same drift twice more. **Agents:** `INSTALL-FOR-AI.md:80` lists 11 (correct), while `:97` and
`:370` say 10 (wrong — the roster became 11 on **2026-09-02** with
`claims-conformance-auditor.md`; one of three sites was updated). **Hooks:** `README.md:274` says
«all 20 hooks», while there are **21** scripts and the census table in
`zcode-parity-doctrine.md §2` also lists **21** (17 registered; no interpretation yields 20).

**Five incorrect counting claims across two public docs, and no channel checks any of them.**
Searched: `packages/core/principles/**`, `tests/install-sh/**`, `scripts/audit-ai-docs.sh`. The
closest candidate `07-documents-lie.test.ts` checks examples in the rule manifest, not numbers in
docs — that file was read before the absence was claimed. This is the project's own
`#hope-as-gate` shape, in the two documents a consumer opens first. Narrow gate proposed: a
principle test reconciling README / INSTALL-FOR-AI counting claims against their SSOTs (the tier
variables in `lib.sh`, `ls agents/`, the census table).

### F4 — checked and NOT a defect (do not reopen)

`inject-project-digest.sh` being silent (`session-bootstrap.md:13` — the block ships empty by
design); `check-ask-files.sh` not shipping (`install.sh:1134`, ledger C-2 #1597, paired negative
exists); `self-reflection` not shipping (`install.sh:26`); the `factory` tier
(`setup.d/lib.sh:63`); `arch` / `pipeline` absent from the model's list — they carry
`disable-model-invocation`; `AGENTS.md:32` is a table row about the `factory` profile, not a
broken pointer; `RULES.md:34` is a catalogue row with a stack column; `pre-merge-local.sh:455` is
a call under the `_build_owed` guard; markdown links to rules are rewritten to blob URLs and open.

### F5 — checked and TRUE (do not reopen)

`INSTALL-FOR-AI.md` `:80` (11 agents), `:81` (11 skills on `env`, by name), `:83`/`:97` (two
discipline agents only on `factory` — measured: factory = 13), `:173` (`factory` adds exactly
`runtime-bridge-dispatch.sh`), `:376` (6 at any depth), `:395`, `:459` (suite = 5+2).
**`./setup -y` ≠ `install.sh -y`**: the wrapper sets `FULL="--full"` (`setup:48`), so `./setup -y`
merges MCP and `install.sh -y` does not (`install.sh:128,158`). Both docs are right about their
own entrypoint; the trap is treating them as interchangeable.

### F6 — what the run could NOT ask (report as PROBE-INCOMPLETE, never as clean)

`claude -p` failed machine-wide: `OAuth session expired and could not be refreshed`. Without it
the run could not measure `PostToolUse` firing, MCP load in a fresh session, or **arm B under
zcode** at all. The fix is `claude login`, which is the operator's action. Per `kickoff-v3.md` §4
gate 7 this is reported as `PROBE-INCOMPLETE` with the reason — it is never a clean result, and
per gate 3/4 the skill-routing and MCP-load rows stay unanswered.

### F7 — run traps worth carrying into the report

1. **`change_directory` does not reload every event.** `UserPromptSubmit` and `Stop` start using
   the new directory's hooks; `PostToolUse` does not. Discriminator: register your own probe hook
   that dumps its payload to a log — if that is silent too, the channel is silent, not the
   artefact. Mid-session `settings.json` edits are not picked up at all.
2. **A naive «path mentioned, file absent» detector has low precision here** — 154 pairs, most of
   them legitimate (descriptions of neighbouring tiers, catalogue rows for another stack,
   provenance quotes). Do not build a gate on it; only on the narrow DEC-1 subset.
3. **`find -newermt` silently returns nothing on macOS** — use `-mmin`.

### F8 — parked for the operator (do not decide these)

PARK-1 should rules ship at all · PARK-2 may the installer write to the machine-global area ·
PARK-3 context7 scope conflict · PARK-4 how much of the `factory` tier consumers get
(*recommendation on record: switch the criterion from profile to runtime presence*) ·
PARK-5 whether to promote the advisor seat.

## §2 Your obligation — re-verify the re-checkable half

Every `file:line` citation above that names a **framework-repo path** is re-checkable in your
checkout, and you must re-check each one at HEAD before it enters the report. Per citation record
one of:

- **CONFIRMED** — the line exists and its content still supports the claim (quote the line).
- **DRIFTED** — the content moved; give the new `file:line` and the line's content.
- **GONE** — the file or the content no longer exists; say so and mark the claim accordingly.

Citations that name **generated consumer-project paths** (`AGENTS.md`, `RULES.md`, the consumer
`package.json` script count) are **not** re-checkable here — those files were produced on three
temporary benches that no longer exist. Mark each `HOST-MEASURED 2026-09-08, not re-checkable in
this environment`. Inventing a container result for them is the exact defect this umbrella exists
to find.

## §3 Deliverable

`report-v3.md`, with these sections:

| § | Content |
|---|---|
| `§scope` | what V3 asked, which arm produced each row (CC host / zcode / neither) |
| `§findings` | F1-F3 as findings, each with its citations and their §2 verdicts |
| `§not-a-defect` | F4 + F5, so a later reader does not reopen them |
| `§probe-incomplete` | F6 — what could not be asked and why, per `kickoff-v3.md` §4 gate 7 |
| `§traps` | F7 |
| `§parked` | F8, verbatim, undecided |
| `§citation-verification` | the §2 table: every citation with CONFIRMED / DRIFTED / GONE / HOST-MEASURED |
| `§self-falsification` | `kickoff-v3.md` §4 gate 8 — what would have to be true for these findings to be wrong, and what this write-up could not see |

## §4 The gate

| # | Gate |
|---|---|
| 1 | every framework-repo citation carries a §2 verdict, none skipped |
| 2 | no claim is attributed to this run; live-harness rows say host-measured + date |
| 3 | F6 is present and labelled `PROBE-INCOMPLETE`, never softened into a clean result |
| 4 | the parked forks are carried undecided |
| 5 | `§self-falsification` is present and non-trivial |
| 6 | nothing outside `report-v3.md` is modified |

## §5 Out of scope

Fixing anything — DEC-1, the counting-claims gate and the parked forks are proposals, not work
for this stage. Re-running V3. Any lane other than V3. Touching V0/V2 reports.

## AI traps ([.claude/rules/ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md))

Active traps: **T2**, **T3**, **T5**, **T14**, **T15**.

- **T2** — designing ≠ auditing, and here its mirror: *writing up* ≠ *measuring*. Do not let the
  report's confident register turn a host measurement into a claim about this environment.
- **T3** — every finding keeps a command or a `file:line` plus the line's actual content.
- **T5** — this is a write-up stage. If you open an editor on a source file, stop.
- **T14** — F6 means coverage is partial; the report says «coverage insufficient to conclude» for
  the hook/MCP/zcode rows, never «clean».
- **T15** — `§self-falsification` is the self-application, and it is mandatory.
- **T-V3R-A (domain-specific)** — *the transcription trap*: a report assembled from an inlined
  summary is tempted to smooth the summary's hedges into assertions, because the source text is
  the only thing in context and it reads as settled. Counter: every sentence that states a fact
  about the environment must resolve to either a §2 CONFIRMED citation you re-opened yourself, or
  an explicit `HOST-MEASURED 2026-09-08` label. There is no third register.

## Host-verify contract

<!-- host-verify: none — the deliverable is a prose report, and its citations span two populations that no repo-root command can resolve together: framework-repo paths (re-checked per §2 by the executor, verdict recorded in the report itself) and generated consumer-project paths from three temporary benches that no longer exist. The lane's live-harness half has no container-runnable counterpart at all — that is why kickoff-v3.md:5 declares the lane non-dispatchable and why this stage only writes up what the host already measured. -->
