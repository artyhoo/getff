# consumer-layout-probe-honesty L3 — decisions log (night run 2026-09-01/02)

Per `.claude/skills/night-mode/SKILL.md` delta items 1 + 8 and the advisor-pattern design §3:
an ask answered by the night advisor seat gets its decision package recorded HERE before any
application. Entry shape: session-bus v2 §4. Floor-object forks stay parked for the operator;
the advisor only pre-builds the package.

## Decision 1 — Signal 4 project checkout: derive from task `worktreePath` (kickoff) or read the project record's `rootPath` (`GET /projects`)

**Ask:** DECISION-NEEDED from the L3 executor seat (`loving-maxwell-ce6ef3-21`, 2026-09-02
~00:25Z), raised by the Phase -1 cold review of the L3 dispatch payload. Kickoff §2 row L3
(`kickoff.md:74`) prescribes «`/tasks` → `worktreePath` prefix as the project checkout»; the
cold review measured that `GET /projects` already returns the checkout directly as `rootPath`.

**Object cut — IN-ENVELOPE.** The object is which aif API field
`.claude/skills/dispatcher/helpers/probe-inflight.sh` reads to locate the consumer's container
checkout, plus the matching arms in
`packages/core/skills/dispatcher/probe-inflight.test.ts` — exactly the two surfaces kickoff §2
row L3 names for the stage. No maintainer-owned artifact, no new PR, no shared infra. The
kickoff itself demands «verify the `worktreePath` field name against the LIVE aif API at
execution time … a doc citation is not a probe» (`kickoff.md:74`, T-CLP-D `kickoff.md:126`) —
a field that the live probe shows to be the better source is the kickoff's own escape hatch,
not a deviation from it. Night advisor decides; the executor applies.

**Evidence (measured 2026-09-02 00:28Z, aif API `localhost:3009`).**

- `GET /projects` → `rootPath` present for all three registered projects:
  `/home/www/rules-as-tests-aif`, `/home/www/timeliner`, `/home/www/getff-landing`.
- The field predates the kickoff: aif-handoff `packages/data/src` gained `rootPath` in commit
  `247ec1a` (2026-07-11); the kickoff was authored 2026-08-19 without knowing it (executor's
  own admission — its first probe grepped for other key names).
- Option A's derivation was verified by the executor on 285/285 live task records, but it is
  undefined for a project with zero tasks carrying a `worktreePath`.
- Issue 1439 acceptance («inspects that consumer's checkout, or reports unavailable with the
  reason — never `ok` from a different project») is satisfiable by both.

**Options.**

- A — kickoff as written: strip `-${branchName//\//-}-${id}` from a task's `worktreePath`,
  filtered by `RUNTIME_BRIDGE_AIF_PROJECT_ID`. Pays a shape heuristic coupled to aif's
  worktree naming, and a chicken-and-egg on first use: a fresh consumer with no tasks reports
  `status=unavailable reason=no-derivable-path` → `PROBE-INCOMPLETE` → the first dispatch can
  never pass the probe.
- B — one extra `GET /projects` → select the record whose `.id ==
  RUNTIME_BRIDGE_AIF_PROJECT_ID` → `rootPath` (list mechanics: the per-id route
  `GET /projects/<id>` does NOT exist — measured 404 vs 200 for the list, 2026-09-02
  00:32Z, round-2 cold seat + advisor re-check). Exact, task-independent, no naming heuristic;
  one more HTTP call on a probe that already pays one. Both options need
  `RUNTIME_BRIDGE_AIF_PROJECT_ID` (explicit `reason=no-project-id` + `AIF_REPO_PATH` override
  land either way); B adds `reason=project-not-found` when no record matches the id.

**Decision: B.**

**Rationale.** The kickoff's intent is «ask the right repository» (issue 1439); its mechanism
was the best field the author knew. B meets the acceptance on the one case A structurally
cannot (task-less consumer = every consumer's first dispatch), removes a heuristic that
breaks the day aif renames worktrees, and costs one HTTP call. Effort card: Type-2, inside
the stage's own two files, reversible in one edit.

**Falsifier («wrong if …»).** A consumer's aif API predates `rootPath` (pre-2026-07-11
aif-handoff) — then the probe must report `status=unavailable reason=no-rootpath`, never fall
back to A silently (amendment 00:35Z: the entry's first cut named a per-id route copied from
the ask without a live probe — exactly the T-CLP-D class the kickoff warns about; corrected
to list mechanics after the executor measured the 404); the payload makes the worker re-probe the field at execution time and park
if absent. Also wrong if `rootPath` turns out to be a host path rather than the container
checkout — today all three values are `/home/www/…` container paths.

**Reversibility.** One edit in `probe-inflight.sh` + its test arms; no shipped-consumer state.

**decided-by:** advisor seat (night, `beta-release-plan-c20d1e-89`), night envelope
(in-envelope object). **status:** decided — applied by the L3 executor in its payload.
