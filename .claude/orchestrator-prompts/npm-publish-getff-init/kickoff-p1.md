# npm-publish-getff-init P1 — promote-#4 truth gate over the `staging..main` delta

> **Umbrella:** [kickoff.md](kickoff.md) — §2 decided inputs and §6 floors are binding.
> **Class:** operational kickoff (dispatch input). **Base branch:** `staging`.
> **Rigor label (effort-worthiness L0):** `research-grade` — this lane is the agreed
> REPLACEMENT for the `/code-review ultra` floor on promote #4 (operator waiver, 2026-09-14),
> and what it clears goes to `main`, which the getff.ai docs site pins to (umbrella D34 / P-AD).
> `npm unpublish` is not a rollback (umbrella §2 «Rollback»), so a false green here is paid by
> every consumer of the first published tarball.
> **Authoritative for:** the scope, method, verdict grammar and gate of the P1 verification pass.
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists);
> the promote mechanics — [`operational-conventions.md`](../../../docs/meta-factory/operational-conventions.md)
> §2; the publish act — umbrella §3 S3 (operator's hand, never this lane's).

## §0 Why this lane exists

`origin/main` is `9b768ca2b88` (promote #3, merged 2026-09-04). `origin/staging` is
`4dd54b5b01b`. Between them: **143 first-parent commits, 461 files, +49153/-4019**. The
promote that closes this gap is the one that first puts `packages/getff/` — the `npx getff init`
distribution package, born in #1613 — on `main`, and `main` is the pin the getff.ai site builds
from. A user-facing sentence that is false on `main` is therefore not a doc bug; it is the
published description of the product.

The floor that normally guards this (`/code-review ultra` on the promote) was **waived by the
operator on 2026-09-14** for cost. This lane is its replacement and inherits its burden.

## §1 Goal

Decide, for every user-facing capability claim on the surfaces in §2, whether it is **true of
the code at `origin/staging` (`4dd54b5b01b`)**. Not «does the doc read well» — «would a consumer
who did what this sentence says get what it promises».

## §2 Surface — enumerated, not sampled

Read every file at `origin/staging`. Line counts measured 2026-09-14:

| Surface | Lines | Note |
|---|---|---|
| `README.md` | 393 | delta changed 21 lines |
| `INSTALL.md` | 474 | delta added 75 lines |
| `INSTALL-FOR-AI.md` | 600 | delta changed 3 lines |
| `CONTRIBUTING.md` | 273 | delta changed 27 lines |
| `packages/core/templates/shared/AI-USAGE-GUIDE.md` | 318 | ships to consumers |
| `packages/core/templates/shared/first-steps.source.json` | 173 | ships to consumers; `action`/`evidence` fields are claims |
| `plugin/README.md` | 30 | the plugin's npm/marketplace face |
| `packages/getff/README.md` | 40 | **NEW in this delta** — the npm package page |

## §3 Method — population first, then verdicts (T10)

**Step 1 — build the delta's changed-file list. Run it, do not reason about it:**

```bash
git fetch origin main staging
git diff --name-only origin/main..origin/staging > /tmp/delta-files.txt
wc -l /tmp/delta-files.txt
```

**Step 2 — enumerate claims.** A claim is any sentence asserting the framework does, ships,
installs, enforces, supports, degrades or guarantees something. Emit the FULL list with
`file:line` **before deciding any of them**. State the population size — it is the denominator
in §5 row 6. In `first-steps.source.json`, each `action` and each `evidence` string is a claim.

**Step 3 — stratify into MANDATORY and REMAINDER.** A claim is **MANDATORY** if either:

- (a) it sits on a line the delta changed (`git diff origin/main..origin/staging -- <file>`); or
- (b) the artefact it cites or implies — a path, a script, a hook, a workflow, a variable —
  appears in `/tmp/delta-files.txt`.

Arm (b) is the point of this lane: 160 shipped-code files moved, so a sentence the delta never
touched can have been falsified by the delta anyway. **Every MANDATORY claim must get a verdict.**
The REMAINDER gets verdicts as far as you reach; what you do not reach is named, not omitted.

**Step 4 — decide each claim against the code**, never against another document. Acceptable
evidence is exactly what [`ai-laziness-traps.md`](../../rules/ai-laziness-traps.md) T3 admits:
a command with its output, or `file:line` plus the line's actual content. A doc agreeing with
another doc is not evidence.

**Step 5 — class every finding** into exactly one of four, mapping the operator's three
questions onto the [`kickoff-v1.md`](../consumer-truth-audit/kickoff-v1.md) §2 grammar:

| Class | Means | Operator's question |
|---|---|---|
| `DOC-LIES` | the code is right, the sentence is wrong | «docs lie» |
| `BROKEN` | the sentence describes the intent, the code does not do it | «project broken» |
| `NOT-BUILT` | the sentence describes something that was never built | «not done» |
| `BY-DESIGN` | true, or a declared and documented degradation | — not a finding |

## §4 Calibration — two claims already decided by the dispatching seat

Both were verified on `origin/staging` on 2026-09-14 and are **TRUE**. They are given in the
true direction deliberately: on a delta this well-maintained the live risk is a verifier that
manufactures findings to look productive, not one that misses them.

1. `plugin/README.md` «Six derived plus two plugin-native» — `ls plugin/skills/` → 8 entries
   (`ai-doc getff installing-enforcement rule-research rule-tests template-audit
   tool-bootstrapping using-getff`); 6 derived + `installing-enforcement` + `using-getff`. TRUE.
2. `first-steps.source.json` «the five skills env adds over core: `arch`, `night-mode`,
   `orchestrator`, `pipeline`, `reviewer`» — `setup.d/lib.sh:62`
   `GETFF_SKILLS_ENV="arch night-mode orchestrator pipeline reviewer"`. TRUE.

If your pass marks either of these false, your method is over-firing — recalibrate before
reporting. **A report with zero findings is a legitimate outcome** and is not penalised;
a finding with no failing scenario for a consumer is
(`#findings-as-KPI`, [`effort-worthiness.md §3`](../../rules/effort-worthiness.md)).

## §5 The gate — run it, quote command + output (T2/T3)

| # | Gate |
|---|---|
| 1 | `/tmp/delta-files.txt` generated by the §3 Step-1 command; its line count quoted |
| 2 | claim population enumerated with `file:line` **before** any verdict; population size stated |
| 3 | MANDATORY/REMAINDER split stated per surface, with arm (a)/(b) named per MANDATORY claim |
| 4 | every MANDATORY claim carries a verdict; none silently dropped |
| 5 | every finding cites the artefact that falsifies it, with the line's **actual content**, and a concrete consequence for a consumer who follows the sentence |
| 6 | coverage stated as `decided/enumerated`, separately for MANDATORY and REMAINDER; unreached claims named with the reason |
| 7 | both §4 calibration claims re-decided independently and reported (say so if you decided them before reading §4) |
| 8 | **zero edits to any file** — this lane measures; proposed rewordings live inside the finding as a quoted before/after |
| 9 | §self-falsification present and non-trivial: what would make this report wrong |

## §6 Deliverable

`report-p1.md` in this directory, sections in this order: §population · §stratification ·
§verdicts (one row per claim) · §findings (non-`BY-DESIGN`, most severe first, each with its
class and a consumer-visible consequence) · §coverage · §self-falsification.

## §7 Out of scope

The docs site (a separate surface with its own halted ledger — do not re-derive its 18 GAPs),
`docs/**` other than the surfaces in §2, `.claude/rules/**`, the promote PR itself, and anything
requiring a published npm tarball. Do not open a PR, do not edit documents, do not run
`npm publish` or any registry command — that is the operator's hand (umbrella §6 floors).

## §8 AI traps ([ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md))

Active traps: **T1**, **T2**, **T3**, **T4**, **T10**, **T14**, **T19**.

- **T1** — if the first three claims you check are true, that is a sampling artifact, not a
  conclusion. Continue to the full MANDATORY set.
- **T2** — reading a doc is not auditing it. Each claim needs the command or citation that
  decides it.
- **T3** — a verdict with no command output and no `file:line` is prose, and prose is not a
  finding. Where you genuinely cannot decide mechanically, write `INCONCLUSIVE-needs-human`.
- **T4** — adversarial counter-prompt at the CATEGORY level: which *class* of user-facing claim
  did I not enumerate at all (install-time? degrade paths? version numbers? counts? shell
  variables? file paths in tree diagrams?). Write it, run it, record what it surfaced.
- **T10** — population before coverage; §population precedes §verdicts in the report.
- **T14** — a surface with no findings and 30% coverage is «coverage insufficient to conclude»,
  not «surface clean». Say which one it is, per surface.
- **T19** — adversarially re-read your own verdict list before handing it over; a claim you
  marked TRUE on a paraphrase rather than on a line is the one to re-check first.

## §9 Host-verify contract

<!-- host-verify: none — this lane reads tracked files at origin/staging and decides claims with git and grep against the same checkout. Nothing in its method depends on the toolchain, OS, PATH or network of the machine it runs on, so no acceptance command would discriminate between the aif container and the host. Its findings are re-checkable from the file:line citations the report carries. -->
