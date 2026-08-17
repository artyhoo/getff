# triage-kernel-v2 — DONE

- Final PR: #1405
- Closed: 2026-08-17
- Summary: A materiality/layer/whose classifier was benched against a 151-row adjudicated corpus of this project's own review findings, and the measured result — **one axis deployed, two nulls** — ships as protocol text in `.claude/rules/reviewer-discipline.md` §6.1 with a per-axis provenance label on every question.

## The result, stated before the process

The contour's deliverable is a **measurement**, and it came back mostly negative. That is the outcome the spec called a first-class deliverable (§6: «Losing layers/axes recorded … *measured — does not pay*»), so it ships rather than being retried:

| axis | verdict | numbers |
|---|---|---|
| **layer** | **DEPLOYS as `corpus-measured`** | C1 0.662 / C2 0.642 vs the 0.530 majority bar, p=0.0012 / p=0.0076, n=151 |
| **class** | **measured null — does not pay.** C0 (the `orig_grade` severity mapping) remains the class bar; no filter deploys | C0 0.733 · C1 0.687 · C2 0.710 on n=131; both candidates fail acceptance leg 1 (McNemar p=0.4514 / p=0.7608) |
| **whose** | ships **`judgment-only, not corpus-validated`** whatever it scores (W-1) | 0.848 / 0.854 vs a 0.901 majority bar, n=151 |
| **C2 self-review step** | **does NOT deploy** — «if C2 pays» never fired | class leg 1 failed; C2 is defined as a delta over C1, never a standalone winner |

**Neither of spec §6's two deployment conditions fired.** The rubric block deploys on the operator fork ratified 2026-08-16 («land S5 now»), not on the conditional being satisfied — recorded in the spec's own status header so no later reader mistakes an override for a pass.

## What landed (per stage, PR + squash)

- **Design spec #1376** (`2ed2f7fc33`) — `docs/superpowers/specs/2026-08-10-triage-kernel-v2-design.md`, two cold rounds (r1 REVISE 2B/9M, r2 REVISE 1B/4M), operator gate 2026-08-11 → **probe-first**: the full corpus runs only on probe signal, buying the likely null at ~1/10 the price.
- **S0 probe #1380** (`7daf16a155`) — 31 operator-adjudicated rows; blind C1 93.5% vs C0 64.5%, discordant **9:0**, exact McNemar p=0.0039, zero breakage. GO for scale-up. It also found the `whose` axis **degenerate** (32/32 `reviewer`), which forced the S2 re-cut.
- **Router #1382** (`3c064bbe57`) + **S1 §9 contract #1383** — `/pipeline` can resolve the umbrella; autonomous dispatch unblocked.
- **S1 #1384** (`e5cfc5e8bf`) — corpus assembly, **156 rows / 6 files**, `docs/meta-factory/triage-corpus/`. Cold r1 REVISE caught the `arch-reviews.csv` harvest skipping `r2-verify.md` entirely — 5 omitted rows, all `orig_grade: MINOR`, i.e. exactly the arm where C0 predicts IMMATERIAL.
- **S2 #1385 (kickoff) + #1386** (`9446ee4de9`) — cold blind re-label, 151 labelable rows (156 − 5 author-cell). The one permitted `whose` re-cut moved it 100% → 86.1% `reviewer` — off degenerate but inside the «not a pass» band, so the `judgment-only` label was set here and never lifted.
- **S3 #1389** (`7425346f0b`) — adjudication: advisor pass + operator stratified slice. `s3-final.csv` is the bench truth (class M=111/I=40). Operator ruling, binding for this corpus: `whose` = required authority class, never historical answerer; `floor` = goal/ownership/spend only.
- **S4 #1392/#1394/#1396 (kickoff) + #1397** (`fa8da9406c`) — the bench. Substrate frozen at `7425346f0b` and byte-verified; judge pinned to literal `sonnet` at both call sites, because the corpus's cold rater was sonnet and the confounding analysis depends on that.
- **S4b #1393/#1398 (kickoff) + #1400** (`d46f3c87bf`) — the outcome audit, the second axis of truth that is **not** judgment: all 151 rows walked against the live tree. HOLDS 139/151 (92.1%) · MOVED 8 · NEVER-DONE 3 · DECLINED 1 · **DRIFTED 0** · `cost=VISIBLE` **0**.
- **#1401** (`0eeb2aaf9c`) — router route rule 4: S5's §7 must run the principles suite. Not belt-and-braces — S4b shipped a principle-10 red past seven arms, four §7 lines and a cold fidelity GO.
- **S5 #1402/#1404 (kickoff) + #1405** (`593ce240e6`) — this closure. §6.1 rubric block quoted **verbatim** from the frozen bench prompt (byte-equality checked mechanically, not read), three run-moment consumer pointers, spec status flip. Two cold rounds, both **GO**, zero REVISE.

## Routed onward / open residue (named, not elided)

- **S5b is STILL OPEN and this file does not close it.** The `arch/SKILL.md` §2 line defining the changelog disposition set `ACCEPTED | DISSOLVED | ESCALATED | FIXED` (spec §7, D-K6) has not landed — verified, not assumed: `grep` over `.claude/skills/arch/SKILL.md` finds the review-verdict grammar (`:89`) and the ESCALATED intake edge (`:111`), neither of which is the changelog vocabulary. It lands as its own micro-PR, any time. **Consequence to be aware of:** `priority-score.sh` Layer C3 now reports this umbrella `status=DONE`, so `/pipeline` will stop offering it — S5b is tracked here and in the spec §7, not by the pipeline.
- **The drift register routes to a SEPARATE repair umbrella**, never back into this one. Its whole input is S4b's 3 `NEVER-DONE` rows, ranked, `1311-r1-5` (MATERIAL) first.
- **Two run-moment seats carry the §6 severity contract but got no rubric pointer** — `agents/review-sidecar.md:158` and `.claude/skills/pipeline/SKILL.md:458`. Found by S5's own backward sweep, left unfixed because both sit outside kickoff-s5 §2's permitted-edit allowlist (one concern per PR). A pointer-parity pass is a candidate chip.
- **The per-axis labels now live in four files with no gate keeping them in sync** (the rule plus its three consumers). Recorded as S5 watch-list W-2: a future re-bench that demotes an axis in §6.1 leaves three consumer seats asserting a revoked label, and nothing mechanical notices.
- **`docs/superpowers/specs/2026-08-10-triage-kernel-v2-design.md` sits at exactly 600 lines** — the pre-commit ceiling. The next edit to that spec is blocked until something is trimmed.
- **Notes-lane residue from S4/S4b, unfixed by design:** S4 arm E's prose leg is one-directional (`NUM` → prose); S4b arm G's converse silently exempts `.ai-factory/plans/**` (inert today); arm C accepts `path:N-M` spans where the kickoffs write `file.ext:line`; stale comment at `scripts/triage-s4b-outcomes.mjs:60`. C2's output contract was ratified **post-hoc** in the S4 report `:137-139` rather than specified up front.
- **GAP-FOUND, observation only:** `scripts/triage-s0-score.mjs:83` and `scripts/triage-s3-agreement.mjs:136` reconcile no report number, and `docs/meta-factory/triage-corpus/README.md` is read by no script and no principle.
- **One operator question was closed by the merge, not by an answer:** dropping the `judgment-only` label from `whose` was proposed and left undecided; #1405 shipped the status quo with that stated in its notes lane, so merging ratified the label visibly. Removing it later is an explicit overrule of spec §5 + W-1 and needs a recorded micro-edit, never a silent drop.
- **aif task `7cd11b76-6c1a-41da-a79d-5161700f6bd2`** (S4b's worker) is stuck at `implementing` with its work merged; `answer.ts --decision approve` returns HTTP 409 (`approve_done is only allowed from done`). Harmless for correctness, but it keeps the umbrella's in-flight probe noisy — close via `/aif-doctor`, not by hand.

## What this umbrella proved (the load-bearing claims)

- **A measured null is shippable, and saying so out loud is the deliverable.** Two of three axes did not pay. The result is protocol text that says which question is measured and which is judgment — not a quietly abandoned branch, and not a filter deployed on a number that failed its own bar.
- **Bar-beating is per-axis and *necessary, not sufficient*.** «The bench ran on all three axes» is the sentence that tempts a later reader to promote a label. The spec's `:297-299` makes it a one-way condition, and the shipped block carries the labels rather than the temptation.
- **Provenance dies on paraphrase.** The block quotes the frozen bench prompt line-for-line, because a reworded question was never measured. The three omitted lines are named in the block itself — including the bench's «*from the text alone*» framing, whose absence **is** the construct-transfer limit spec §5b records.
- **The outcome axis corroborates nothing about the labels.** HOLDS 92.1% reads like validation and is not: high HOLDS is a property of the merged-PR population, and `cost=NONE-FOUND` on a MATERIAL row is absence-of-trace, not falsification. The binding rule (kickoff-s4b §8) survives into the shipped block.
- **A green contract is not a green stage.** S4b shipped a principle-10 red past seven arms, four §7 lines and a cold fidelity GO; it was caught by hand. Every stage after it carries the principles suite in its own §7 — the `#contract-that-cannot-fail` shape, closed by running the arm rather than reading it.
- **`IN-FLIGHT` on this umbrella was a squash artefact every single time.** Across four stages the probe fired on branches whose content was fully merged. The discriminator that worked: `gh pr list --head <branch> --state all` per ahead-branch, never the branch's ahead-count.

## Gate

This closes the **measurement** contour: S0 → S4b measured, S5 landed. It does **not** close the ideas — spec §8's three post-landing applications (live triage, the implementation-fidelity sweep from operator premise P4, the precedent-retrieval bench behind the D-K4 volume door) and **D-K7's falsifier** («a deployed rubric question proves mechanically checkable → promote that one question to a deterministic arm») stay live. S5b and the drift-register repair umbrella are the two named successors.
