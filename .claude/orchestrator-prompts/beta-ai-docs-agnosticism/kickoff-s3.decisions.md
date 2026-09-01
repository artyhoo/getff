# beta-ai-docs-agnosticism S3 — decisions log (night run 2026-09-01/02)

Per `.claude/skills/night-mode/SKILL.md` delta items 1 + 8 and the advisor-pattern design §3:
an ask answered by the night advisor seat gets its decision package recorded HERE before any
application. Entry shape: session-bus v2 §4. Floor-object forks stay parked for the operator;
the advisor only pre-builds the package.

## Decision 1 — `agents/claims-conformance-auditor.md`: ship to consumers or skip-list it

**Ask:** `session-bus/asks/2026-09-02-dispatcher-claims-auditor-ship-or-skip.md` (dispatcher seat
of S3, 2026-09-02; raised as DECISION-NEEDED by the cold backward-sweep seat `backsweep-s3`).

**Object cut — FLOOR, not in-envelope.** The object is the skip-loop in
`setup.d/20-agents.sh:26-32` **and its refresh twin in `install.sh`** (principle 21's
drift-guard, `packages/core/principles/21-agnosticism-conformance.test.ts:322-336`, requires
every skip entry in BOTH installers or CI goes red). Neither file is in S3's `## §5 Permitted
files` (`kickoff-s3.md` §5 names the inventory, `scripts/` renderers, drift-gate tests, free-
ownership doc sections, the agent file itself, and proposal artefacts). A skip therefore needs
a NEW PR outside any authorized stage scope → «new PRs / scope widening» is a floor category.
Tie rule not needed: the object is unambiguously outside. **Consequence tonight:** S3 lands as
its diff embodies (ship); no night application.

**Decision package (evidence measured 2026-09-02, staging `4b873f30` + the S3 container
workdir `/home/www/…-fc864fdf-…/agents/claims-conformance-auditor.md`).**

- Class parity: `backward-sweep-auditor.md` is skip-listed as «authoring-only tool (§1.7
  backward-check cold-sweep, T21)» (`setup.d/20-agents.sh:28`); the new agent's own header
  says «Fires: spec §8 phase-2 assembly gate; any umbrella that ships docs-site claims (README,
  INSTALL-FOR-AI, AI-USAGE-GUIDE, docs site)» — a pre-merge cold protocol the OPERATOR repo
  runs over its OWN docs-site claims (spec §8 row F5, `2026-07-23-beta-program-design.md:420-425`).
- Factory-only references in the shipped copy: `<!-- spec: docs/superpowers/specs/… -->`,
  `[attention-is-not-a-mechanism.md §1](../.claude/rules/…)`, `[spec §8](../docs/superpowers/…)`.
  `transform_internal_refs` rewrites rule links, but `docs/superpowers/` is not shipped — the
  same class as issue 1535 («dead path citations in shipped consumer docs», VERIFIED
  NON-BLOCKER 2026-09-02). Shipping adds one more instance to the population that issue
  measures.
- Roster budget: `INSTALL-FOR-AI.md` is at 597/600 lines with the 11-agent roster rendered
  (ask evidence; the 600-line markdown gate is a pre-commit hard stop).
- Consumer value, honestly stated: the body IS generic («does every factual claim these docs
  make about the repository match the repository as it exists right now?»), and «NOT
  authoritative for: project goal — see consumer's README.md» shows the author had a consumer
  reader in mind. A consumer could run it over their own AGENTS.md / README. That value is
  real but unrequested: no spec row asks for a consumer-side claims audit (spec §6 C5 «C also
  authors … the named cold auditor the §8 assembly gate runs», `:381-382`).
- Reversibility either way: one docs+installer PR (skip entry in BOTH installers, roster
  re-render via `render-install-roster.mjs --write`, `SNAPSHOT_MODE=capture`). A later skip
  does NOT retract already-delivered consumer copies (`copy_safe` never deletes) — harmless,
  one-time; during phase 1 the only consumers are the operator's own projects.

**Options.**

- A — ship (the S3 diff as-is): consumers get a generic docs-claims auditor; pays roster
  line + a dangling spec link per consumer; no follow-up PR.
- B — skip-list (parity with backward-sweep-auditor): thinner consumer payload; pays one small
  follow-up PR touching both installers + snapshot.
- C — ship AFTER stripping factory-only refs and rewriting «Fires» for a consumer reader:
  the consumer-value branch done honestly; pays an S3-scope edit of the agent file (inside
  S3's allowlist) — but S3 is already in fidelity rework round 1, so this is a round-2 item at
  best.

**Advisor recommendation: B — skip, as a morning follow-up PR; S3 lands unchanged tonight.**

**Rationale.** The agent exists to satisfy spec §8 F5 in THIS repo; every consumer-facing
signal (Fires line, spec comment, rule link) says operator kitchen, exactly like the
skip-listed backward-sweep-auditor. Shipping it by default pays a 1535-class dangling ref and
a roster line for a benefit nobody asked for; option C is the only honest «ship» and it is
not free. Effort card: B is Type-2, one PR, reversible; the consumer-noticeable delta of A vs
B during phase 1 is zero.

**Falsifier («wrong if …»).** The operator wants consumers to audit their OWN docs with it
(then C, not A — strip factory-only refs first); OR the S3 fidelity round already made the
copy consumer-clean (then A costs only the roster line and B is taste).

**Reversibility.** Trivial: undo = drop the two skip entries + re-render + `SNAPSHOT_MODE=capture`.

**decided-by:** advisor seat (night, `beta-release-plan-c20d1e-89`) — recommendation only;
application is the operator's (floor). **status:** parked-for-operator; ask marked
`escalated`.
