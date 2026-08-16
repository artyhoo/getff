# S3 advisor journal — triage-kernel-v2 corpus adjudication

> Advisor journal for the S3 stage (advisor-pattern §3 invariant 1: entry BEFORE application;
> D-K2: «the advisor pass dogfoods the advisor pattern and births decisions.md»). The advisor
> journal's PERMANENT home is an open advisor-spec §8 item — until it lands, this file follows
> the `kickoff-s4.decisions.md` precedent (tracked via the `kickoff-s*.md` gitignore negation).
> Naming note: the `.decisions.md` suffix follows night-mode's `<plan>.decisions.md` shape.

## class: corpus-adjudication

> **Segregated per design §3.4 — every entry in this section is EXCLUDED from the D-K4 /
> D-AP4 journal-volume door.** These are batch corpus verdicts, not live consults; the door
> opens on live-consult entries only.

**Batch record (151 rows, 2026-08-16).** The per-row verdicts live in the CSV master
[s3-adjudication.csv](../../../docs/meta-factory/triage-corpus/s3-adjudication.csv) — one
line per row, rationale on every routed row (96 routed + 55 agreed). NOT duplicated here:
CSV is the single master (design D-K1; a prose copy would need a sync gate,
[attention-is-not-a-mechanism.md §1](../../../.claude/rules/attention-is-not-a-mechanism.md)).
Stats + slice record: corpus README §S3 + [kickoff-s3.md](kickoff-s3.md) §2.

### Entry S3-1 — whose-rubric semantics correction (operator slice ruling)

- **Decision package:** four corpus rows recording pre-advisor-era operator decisions
  (`kl-1296-1`, `kl-1305-1`, `kl-1295-1`, `kl-1351-1`) were advisor-labeled `operator-floor`
  on «recorded operator decision = demonstrated operator authority» grounds. Operator slice
  2026-08-16 disputed all four. Options: (a) keep historical-answerer semantics; (b) label by
  the authority class the settling REQUIRED, floor = goal/ownership/spend only.
- **Decision:** (b). The four rows → `whose_final: advisor` (each fork's rationale is
  deducible from ratified artifacts; none is goal/ownership/spend).
- **Rationale:** the whose axis trains the future judge's ESCALATION routing; labeling by
  historical answerer teaches over-escalation to the operator — the opposite of the pattern's
  purpose. P3 applies to routing too: «the operator answered it» is evidence, not proof the
  question required the operator (the advisor did not exist before 2026-08-10).
- **Falsifier:** wrong if a ratified floor redefinition later moves concept-class forks back
  to the floor, or if live advisor operation shows these fork classes systematically
  mis-answered without operator context.
- **Reversibility:** label edit in two CSVs + this entry; revert = restore `operator-floor`
  on four rows. decided-by: operator (slice, in-chat 2026-08-16). status: applied.

### Entry S3-2 — phantom-spend finding (kl-1351-1)

- **Decision package:** the night-parked «accept ~$0.117 recurring per-provision spend»
  (PR #1351 / beta-delivery-ux S4) rested on aif's `costUsd:0.117219` field
  (kickoff-s4.decisions.md:145 — 39,058 injected input tokens on a three-word prompt).
  The provisioning flow targets a **z.ai Coding Plan subscription key**
  (INSTALL-FOR-AI.md:182); operator states subscription billing everywhere. Precedent:
  `claude -p` `total_cost_usd` was live-verified 2026-08-09 as an informational estimate
  while billing goes to the subscription pool.
- **Decision:** for the whose axis, the spend object DISSOLVES on fact-check — the row's
  remaining risk-acceptance half is advisor-class → `whose_final: advisor`.
- **Rationale:** a spend question exists only if spend exists; the premise «costUsd = a
  charge» was never verified by the night session before flooring the question. What stays
  real: the token bloat (39k tokens/provision) and the consumer-facing caveat for API-priced
  keys — but INSTALL-FOR-AI.md:184's «measured $0.117 … billed» presents an estimate as a
  charge. Surfaced as a PR-body observation (out of S3 scope, CLAUDE.md §PR strategy — no
  drive-by fix).
- **Falsifier:** wrong if a z.ai Coding Plan key is shown to incur per-token charges on the
  aif completion route (probe: one provision run + the z.ai account usage page delta).
- **Reversibility:** label edit only. decided-by: operator (fact) + advisor (label).
  status: applied.

### Observation S3-obs-1 — de-minimis spend delegation (OPEN, not decided)

The operator's slice dialogue expressed intent that the advisor should be able to settle
small/phantom spend questions instead of flooring them. Under the ratified object cut
(autonomous-night v3 §6; advisor invariant 2 «zero new rights vs the floor») **spend has no
de-minimis threshold — any real spend floors**. A delegation («advisor may accept recurring
cost < $X, recorded for morning review») is a floor redefinition: it belongs in the advisor
spec as an explicit amendment by its owner, never introduced silently via a corpus label.
S3 changed nothing here (the kl-1351-1 relabel rests on the spend being phantom, not on a
delegation). Routed to: advisor-spec §8 residue owner.
