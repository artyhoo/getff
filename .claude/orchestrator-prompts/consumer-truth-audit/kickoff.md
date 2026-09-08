<!-- getff-kickoff: umbrella -->

# consumer-truth-audit — umbrella kickoff

> **Rigor label (effort-worthiness L0):** `research-grade`.
> Justification (the label is not decoration): the output gates an irreversible,
> outward-facing act — publishing docs and `npm publish getff@0.1.0`. A wrong claim in
> `<meta description>`, `llms.txt` or a published package cannot be retracted from the
> caches and mirrors that copy it. Everything downstream of the measurement (the fixes
> themselves) reverts to `build-and-verify`.

## §0 Goal

Establish **by execution** what this framework actually delivers to a consumer project and
what actually **works** there — then reconcile every public claim to that measured truth,
fixing whichever side is wrong: the doc, or the project.

Three verdict classes exist and every finding MUST land in exactly one:

| Class | Meaning | Fix lands in |
|---|---|---|
| `DOC-LIES` | the code is correct, the claim about it is false | docs / site / artefact header |
| `NOT-BUILT` | the claim describes something never built | build it, or retract the claim |
| `BROKEN` | it was built and does not work at a consumer | the project |

A fourth outcome is legitimate and must be reported when true: `BY-DESIGN` — the delta
exists deliberately (profile tiering, factory-internal artefact). `BY-DESIGN` requires a
citation to the artefact that declares the intent, not the auditor's inference.

## §1 Why this umbrella exists (measured, not asserted)

Two facts from the 2026-09-08 host session, both re-runnable:

1. **The docs site failed its own claims gate.** A cold claims audit returned STOP with 18
   GAPs; ledger coverage was 86/167 claims. The site is technically sound and factually
   false. Full ledger: `BS3-GAPS.md` on branch `bs3-cutover` of `artyhoo/getff-landing`.
   **Do NOT re-derive those 18** — that audit cost ~257k subagent tokens. Extend, never repeat.
2. **A shipped hook has no corpus to read at any consumer.**
   `.claude/hooks/inject-matching-rule.sh:29-30` asserts «consumers DO get `.claude/rules/*`
   installed». `setup.d/LAYERS.md:79` asserts the opposite — «rules/ is not shipped» — and
   `setup.d/lib.sh:152` rewrites rule links to GitHub blob URLs *because* of it. Live probe:
   `/Users/art/code/timeliner` carries the hook, registered in `settings.json`, and has **no**
   `.claude/rules/` directory. `install.sh --dry-run` in a clean dir delivers zero rule files
   on any of the three profiles.

Fact 2 is the shape this umbrella hunts. Its precedent is `runtime-bridge-dispatch.sh`, which
resolved a factory path and was a **permanent silent no-op at every consumer** until #1448.
Both were invisible because the factory sits next to the only test installs we have.

## §2 Scope lock

**In scope** — five verification lanes (V0-V4, one stage kickoff each), then triage, then
fixes, then a re-audit of the docs surface against the corrected truth.

**Out of scope** (surface as observations, never act):
- the 18 known site GAPs — they are input, not work;
- `/code-review ultra 1597` — operator-only, billed;
- `npm publish` — operator-only, credentials;
- the staging→main promote — a session prepares it, the maintainer merges it;
- the stack-scope decision itself (how many stacks the beta *promises*) — measurement
  produces the input; the promise is the operator's call.

## §3 The two test benches, and why one is not enough

Every «it works» claim measured on a machine where the framework repo is present is
**unproven**. Both existing live installs (this repo, `timeliner`) sit beside the factory.

Binding rule for every lane: **measure inside a consumer install that has no path to the
framework**, with a mandatory control run on the factory. A check that passes in both tells
you nothing; a check that passes only on the factory is the defect class of §1 fact 2.

Available benches:

| Bench | What it proves |
|---|---|
| fresh `mktemp -d` + `install.sh` | greenfield consumer, all three profiles |
| `/Users/art/code/_aif_cleanroom_r13c` | an existing cleanroom |
| `/Users/art/code/timeliner` | a real long-lived consumer (installed 2026-08-07 — treat age as a variable, not noise) |
| the operator's WSL Ubuntu-24.04 PC (`pcx`, `ssh pc`) | the only real Windows bench |
| zcode (`zcode-parity-doctrine.md`, `/Users/art/code/zcode-probe`) | harness parity — catches CC-only assumptions |

## §4 Harness capability split — what aif CANNOT decide

Measured 2026-09-08 from inside `aif-handoff-agent-1` (container Up 2 days):
`github.com` → 000 (`SSL_ERROR_SYSCALL`, TCP never opens); `api.github.com` → 200.

| Verifiable in an aif worker | Requires a live harness session |
|---|---|
| install completes in a clean dir | do CC hooks actually fire (`PreToolUse`/`PostToolUse`/`UserPromptSubmit`) |
| files landed, scripts execute, exit codes | do MCP servers load |
| lint rules actually catch planted violations | do skills route on `/<command>` |
| configs valid, templates applied | anything reading github.com or the npm registry |

The right column is **not delegable to a container**. It is dispatched to a live session
(host CC for lane V3-a, zcode for V3-b). A lane that cannot ask its question MUST report
`PROBE-INCOMPLETE`, never a clean answer.

## §5 The existing truth criterion — consult it, do not rebuild it

`packages/core/backends/<b>/capability-matrix.json` already records, per backend, a
`status` of `yes` / `partial` / `no` per capability cell, with `caps[]` naming each
limitation and `evidence` carrying `kind: live-fired` plus a date and toolchain version.
Five backends carry one: `astgrep`, `cargo`, `golangci`, `npm`, `ruff`.

This is the SSOT for «what do we actually support». Every lane compares claims **against it**
and reports drift in both directions:
- a claim more generous than the matrix → `DOC-LIES`;
- a matrix cell more pessimistic than reality (stale `partial`) → regenerate per
  [`evidence-regeneration.md`](../../rules/evidence-regeneration.md), do not hand-edit.

Worked example the lanes should treat as calibration: `golangci` self-reports `partial` with
the cap «identity granularity is the LINTER name (`forbidigo`), not a per-pattern rule id»;
`packages/core/templates/go/.golangci.yml:1` opens with `# generated by getff go lane v0 — do
not edit by hand` while the synthesizer carries renderers only for astgrep and clippy
(`render-researched-astgrep.ts`, `render-researched-clippy.ts`; `emit.ts` has no golangci
target). That is one `DOC-LIES` (the header) sitting on top of one honest `partial`.

## §6 Stages

| Stage | Kickoff | Question it answers | Bench |
|---|---|---|---|
| V0 | `kickoff-v0.md` | has → delivered → works, per artefact class × profile | clean installs + container |
| V1 | `kickoff-v1.md` | do `README`/`INSTALL-FOR-AI`/`AGENTS` match V0's measured delivery | container |
| V2 | `kickoff-v2.md` | per-lane maturity: delivery, firing proof, renderer, CI gate, matrix status | container |
| V3 | `kickoff-v3.md` | do hooks fire / MCP load / skills route — CC **and** zcode | live sessions |
| V4 | `kickoff-v4.md` | does any of it work on Windows | operator's WSL PC |

V0 is the spine: V1 and V2 consume its census. V0-V2 are parallel-safe against each other
only after V0's census file exists; V3 and V4 are independent and may run at any time.

**After the lanes:** a triage pass assigns every finding one of the §0 classes plus a fix
proposal; fixes dispatch as separate single-concern tasks; then the docs surface is re-audited
by `agents/claims-conformance-auditor.md` against the corrected truth. Only then: site
cutover → promote → publish.

## §7 Evidence discipline — binding on every lane

1. **A comment is not evidence.** Every finding carries a command and its output, or
   `file:line` with the line's actual content. This is not hypothetical: the host session
   that authored this kickoff asserted «Go has no firing proof» from a comment in a script
   header and was wrong — `packages/core/backends/golangci/` carries `firing-contract.json`,
   `firing-runner.ts`, `firing.test.ts` and fixtures. The corrected finding (no renderer) is
   stronger than the wrong one.
2. **Every report ends with a self-falsification section**: name your own weakest claim in
   this report and the command you ran to attack it. A report whose weakest claim is
   «everything checked out» has not done this.
3. **`INCONCLUSIVE-needs-human` and `PROBE-INCOMPLETE` are valid verdicts.** A fabricated
   clean answer is the only unacceptable one.

## AI traps (per [.claude/rules/ai-laziness-traps.md §2-§3](../../rules/ai-laziness-traps.md))

Active traps: **T1**, **T2**, **T3**, **T9**, **T10**, **T14**, **T15**, **T19**.

- **T1** — sampling floor 5, depth ≥20. «First three artefacts looked delivered» is a
  sampling artifact. Census lanes enumerate the full population; they never sample.
- **T2** — designing the check is not running it. No «would detect» in findings.
- **T3** — no prose-only findings. See §7.1 — the author of this kickoff already failed it once.
- **T9** — stratify: the oldest install (`timeliner`, 2026-08-07) and a fresh one are
  different strata and must both be measured. Drift concentrates in the old one.
- **T10** — population enumeration BEFORE any coverage claim. A percentage without a
  denominator you enumerated is meaningless.
- **T14** — clean result + low coverage = «coverage insufficient», never «class clean».
- **T15** — self-application: this umbrella audits a framework whose thesis is that rules
  must be executable. Each lane reports what auditing *itself* would look like.
- **T19** — run your own adversarial review of your report before handoff. CI checks form.

## Host-verify contract

<!-- host-verify: none — an umbrella kickoff authors no deliverable of its own; it routes to five stage kickoffs, each of which declares its own contract or its own honest opt-out. There is no acceptance command whose exit code would mean anything at this level. -->
