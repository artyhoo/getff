# Triage kernel v2 — S0 probe result (C1 beats C0, 9:0, GO for scale-up)

Scope: S0 probe report for the triage-kernel-v2 contour — the gate-resolved ~30-row
operator-labelled probe that decides whether the full S1-S5 corpus machinery runs
([design spec §9](../superpowers/specs/2026-08-10-triage-kernel-v2-design.md), operator gate
2026-08-11). Session-scale artifact record; corpus data at
[docs/meta-factory/triage-corpus/](../triage-corpus/README.md).

## §1 Question under test

Does a one-call rubric judge (C1: four-test card + premise-11 layer question + the audit §1
behavioral yardstick, binary class output) classify review findings as material/immaterial
better than the deterministic status-quo bar (C0: `BLOCKER/MAJOR → MATERIAL`,
`MINOR → IMMATERIAL` from the grade recorded in the PR — design D-K8)? Gate condition for
S1-S5 scale-up: C1 beats C0 on the probe slice (signal, not the S4 acceptance CI — that
rule applies at full-corpus scale, design §5).

## §2 Method

- **Population (T10, enumerated before sampling):** the 13 fidelity-loop PRs of the
  review-effort-theatre audit window
  ([2026-08-10-review-effort-theatre-audit.md §2](2026-08-10-review-effort-theatre-audit.md)),
  bodies re-fetched via `gh pr view <n> --json body`.
- **Sample:** 32 rows from 8 of the 13 loops (#1297 #1333 #1341 #1346 #1349 #1353 #1358
  #1360), selected where the finding text is verbatim-recoverable from the PR body. **The
  sample deliberately over-weights strata where the recorded grade disagrees with the
  audit's class** — at n≈32 a uniform sample carries ~4 C0 errors and zero power. Raw
  accuracy is therefore NOT a population estimate; the weight-independent decision
  quantities are recovery and breakage (§3).
- **Anti-leakage (design §2 at probe scale):** extraction from PR bodies only (never audit
  §4 tables), grade-strip normalization, then the two-arm fail-closed probe
  ([scripts/triage-corpus-probe.mjs](../../../scripts/triage-corpus-probe.mjs)): 32 rows ·
  0 failures on both arms (provenance-substring + grade-token scan).
- **Candidates:** C1 = 32 independent `claude -p --model sonnet` calls, no tools, no session
  state, strict one-line output ([scripts/triage-s0-run.mjs](../../../scripts/triage-s0-run.mjs));
  32/32 parsed. C0 = pure `orig_grade` mapping, $0. Scorer:
  [scripts/triage-s0-score.mjs](../../../scripts/triage-s0-score.mjs) (accuracy, per-class
  MATERIAL-miss, κ/PABAK, exact McNemar on discordant pairs, recovery/breakage,
  per-stratum table).
- **Ground truth:** operator adjudication (protocol deviation from blind-operator §3.1 to
  propose-confirm §3.3-style, operator-directed mid-probe). Raters: session rater
  (arguments per row; **contaminated** — had read the audit's labels), blind Fable seat
  (zero tool uses, rationale per row —
  [s0-fable-rationales.md](../triage-corpus/s0-fable-rationales.md)), operator ruling every
  row presented with arguments and re-ruling 4 on challenge (#6→I: hook stderr on exit 0
  reaches no model, degradation is fail-open toward louder reminders; #14→I: no number or
  decision moved under the strict yardstick; #22 confirmed M with the direction nuance;
  #32→removed: materiality not judgeable from the text — the IAA remove rule, not a guess).

## §3 Results (31 scored rows: 22 MATERIAL / 9 IMMATERIAL; 1 removed)

| Metric | C0 (grade map) | C1 (blind sonnet rubric) |
|---|---|---|
| Raw agreement with operator | 64.5% | **93.5%** |
| MATERIAL-miss among raised findings | 45.5% | **4.5%** |
| κ / PABAK | 0.335 / 0.290 | **0.843 / 0.871** |

- **Discordant pairs 9:0** (C0-wrong/C1-right = 9, C0-right/C1-wrong = 0), exact McNemar
  **p = 0.0039** — significant even at probe scale, which the pre-registered expectation
  («direction, not significance») did not predict.
- **Recovery 81.8%** (9 of 11 rows where C0 is wrong, C1 is right); **breakage 0.0%**
  (0 of 20 rows where C0 is right did C1 flip).
- Where C0 fails is exactly the audit's measured defect direction: under-graded MINORs.
  C1 recovered 10 of 11 grade-understated rows (per-stratum: `minor/material` 0% → 100%)
  and never downgraded a correctly-graded row.
- C1's two misses vs the operator: row 2 (2025-dated sources labelled 2026 — C1 ruled I,
  operator M) and row 14 («12 of 13» recount — C1 ruled M, operator I on challenge).
- Blind-vs-blind check: Fable (independent full-argument rater) vs C1 agree 30/32; Fable vs
  operator final 30/31. The `whose` axis is DEGENERATE at probe scale: C1 output
  `whose=reviewer` on 32/32 — the rubric's whose-question produces no signal in this
  population and needs reformulation before S2 labels it. `layer` spread:
  implementation 20 / design 9 / plan 3 (no bar comparison at probe scale).

## §4 Validity limits (design §5b at probe scale)

1. Oversampled disagreement strata: headline percentages describe the hard slice, not the
   population; population C0 accuracy is ~0.8-0.9 (design §4 pre-read stands).
2. Truth contamination: the session rater read the audit's labels; the operator saw the
   raters' arguments before ruling (§3.3 confirm-or-override, not blind §3.1). The blind
   Fable seat and the operator's 4 challenge-overrides are the independent signal; note the
   operator overrode BOTH raters on #14 and the session rater on #6.
3. Four rows carry the finder's own evaluative language inside the verbatim quote
   (e.g. «verified non-load-bearing today») — un-strippable under the §2 contract (r2
   NEW-M1 dropped the phrase blocklist); both such I-rows were C1 hits, so the aid is real
   but did not decide the 9:0 margin (all 9 recoveries are M-rows without such language).
4. n=31 decides the direction, not fine ranking; C2 (self-review pass) was not run at probe
   scale; layer/whose axes are unmeasured (whose is degenerate — §3).

## §5 Verdict

**S0 = GO for S1-S5 scale-up** (gate condition met: C1 beats C0 on the probe slice, 9:0,
p=0.0039, zero breakage). Watch-list W-2 obligation for any S1 kickoff — quote this result —
is satisfiable from §3. The S4 full-corpus acceptance still applies at scale
(CI-excludes-zero + MATERIAL-miss no worse than C0 — design §5); nothing here pre-spends it.

## §6 Self-application (T15)

This probe classified review findings about review discipline, using the repo's own
yardstick, with its own anti-leakage gate run on its own corpus (32/32 green), and its
scorer smoke-tested on pseudo-labels before the operator spent labeling time. What the probe
did NOT do: audit its own row-selection bias beyond declaring it (§2 sample note, §4.1) —
the S1 full corpus with disjoint per-population files is the mechanism that closes that.
Deviation record: the blind-operator labeling protocol was replaced mid-probe by
operator-directed propose-confirm; recorded in §2/§4.2 with its bias direction rather than
hidden (T6 honesty).

Tags: `#triage-kernel-v2` `#s0-probe` `#corpus-measured` `#recursive-self-application`
