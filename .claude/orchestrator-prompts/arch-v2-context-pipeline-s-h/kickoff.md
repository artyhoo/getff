<!-- scope: stage-scoped dispatch input — S-H of the arch-v2-context-pipeline umbrella (host-side measurements, added rev 4 by the 2026-08-06 /arch re-planning pass — spec §1.6 FORK C). NO bridge-profile marker — DELIBERATE AND STRUCTURAL, not a tier statement: every deliverable needs the HOST (`~/.claude/projects/**.jsonl`, measured live CC sessions, the `/context` slash command), and the aif container mounts `claude-auth` as a named volume, not the host `~/.claude` (aif-handoff/docker-compose.yml:27). This stage is NOT factory-bound: it executes in a host Claude Code session holding this kickoff (operator-attended or host night-mode). Re-verify the mount claim at execution start — if the compose HAS gained a host bind-mount of `~/.claude/projects`, stop and surface (the spec's FORK C falsifier fired). -->

# arch-v2-context-pipeline S-H — host-side measurements (P3d + P11 + P14)

> **Stage goal:** produce the measurement evidence the container cannot: per-turn re-write
> attribution (P3d), the Explore/Plan rules-loading probe (P11), and the harness-remainder
> price list (P14) — the inputs S-D′ orders its subtraction maps by. **Design SSOTs (read
> both, in full):**
> [`2026-08-06-pipeline-token-economy-design.md`](../../../docs/superpowers/specs/2026-08-06-pipeline-token-economy-design.md)
> — §1.6 FORK C (this stage's charter), §3 rows P11/P14 + P3 (the P3d clause), §0.5/§0.6;
> [`2026-07-31-arch-v2-context-pipeline-design.md`](../../../docs/superpowers/specs/2026-07-31-arch-v2-context-pipeline-design.md)
> — ADR-3 (measurement arm). Umbrella context:
> [`../arch-v2-context-pipeline/kickoff.md`](../arch-v2-context-pipeline/kickoff.md).
>
> **This stage is S-H only.** No gate/ceiling edits (S-E owns, already merged), no trims
> (S-G owns, already merged), no subtraction maps (S-D′ consumes this stage's outputs). A
> systemic issue noticed mid-stage is a PR-body observation, never an extra PR
> ([CLAUDE.md `PR strategy`](../../../CLAUDE.md)).

**Base:** `origin/staging`. **UNBLOCKED from S-E (round-4 M-6, spec §1.6 FORK C
scheduling):** this stage may run any time after the rev-4 re-plan merges, concurrently
with S-G/S-E — permitted sets are disjoint, and §0.5's expensive-seat-first ranking favours
pricing the 60-71% harness share early. The two S-E touchpoints degrade gracefully: item 3
uses the P3c-verified channel only if S-E has merged (else `/context` alone, with a note);
item 4 is skipped with a note if S-E has not merged by stage end. **Mode:** measurement +
one small script, one PR
onto staging, executed on the HOST.

## §1 Deliverables

1. **P3d — per-turn attribution, promoted to a permitted home:** create
   **`scripts/measure-turn-attribution.sh`** — the SSOT for per-turn cost numbers — seeded
   from the aggregator snippet inlined in
   [`../token-economy-research-s-a/kickoff.md`](../token-economy-research-s-a/kickoff.md)
   **§2.7 «Reproduction — the full aggregator»**
   (READ-ONLY seed: do not edit that kickoff — Artifact Ownership Contract; the script
   supersedes the snippet as SSOT and the kickoff stays a historical record — state this in
   the script header). Extend it with: per-turn re-write trigger classes sized against
   WRITE [W] — TTL expiry / `/compact` / resume, PLUS the config-change class (mid-session
   model or effort-level switch, MCP server toggle, CC update — verify the class against
   primary docs before pricing it); arrival-position distribution of tool output;
   edit-time-injection firing rates; **and the bootstrap-injector line (spec §1.6 FORK E,
   MANDATORY):** per-prompt + per-subagent cost of the
   `.claude/hooks/inject-session-bootstrap.sh` inject (1,760 B/invocation measured at
   re-plan time — re-measure) × observed firing counts per seat class. S-D′ consumes this
   line. Output: a research patch under
   `docs/meta-factory/research-patches/` quoting the script run.
2. **P11 — Explore/Plan subagent probe:** one measured host session each for `Explore` and
   `Plan` — do they load `.claude/rules/` at all? Result recorded in the same research patch
   (or its own), whichever way it lands; `INCONCLUSIVE — coverage insufficient` is a legal,
   honest outcome (T14). S-D′ consumes this.
3. **P14 — harness-remainder price list:** per-block token cost of the non-repo resident
   load (MCP tool schemas + server instructions, plugin SessionStart injects — e.g. the
   `using-superpowers` full-text inject, skills/agents listings, memory index) via the
   P3c-verified channel if S-E's verdict says «observable», else `/context` alone;
   deliverable = a settings-recommendations doc with per-item cost. Recommendations only —
   settings stay operator-applied (agent-uncommittable). Preserve what already works
   (ToolSearch deferral keeps deferred schemas non-resident).
4. **Conditional — P3c live confirmation:** ONLY if S-E's recorded P3c verdict says
   `InstructionsLoaded` is observable, run one live host session with a probe hook and quote
   the observation beside the verdict (docs-say-X, live-confirms-X). If the verdict says
   unobservable or blocked, skip and say so — do not build a workaround.

**Descopes (encoded, binding):** no ceiling/gate changes even if the numbers suggest one
(surface as observation for S-E's owner); no skill/rule edits; no subtraction decisions
(S-D′ owns); no re-derivation of settled S1/S2 numbers.

## §2 Permitted files

`scripts/measure-turn-attribution.sh` (new), `docs/meta-factory/research-patches/*` (P3d/P11
outputs + the P14 settings-recommendations doc). NOT permitted: any other `scripts/*`,
`.claude/orchestrator-prompts/token-economy-research-s-a/kickoff.md` (read-only seed),
`.claude/settings.json` / `.claude/settings.local.json` (operator-only), `.claude/rules/*`,
`CLAUDE.md`, `packages/*`.

## §3 Acceptance

```bash host-verify
bash scripts/measure-turn-attribution.sh
```

The run must emit the per-turn tables (trigger classes, arrival-position, injection firing
rates) on the host corpus; quote its output in the PR body. Plus review-time:

- Every P14 price row names its measurement channel; a block with no channel reads
  `UNMEASURED — channel absent` — never an estimate (T-SH-A).
- P11's outcome is stated with its evidence (session transcript reference or command
  output), including the `INCONCLUSIVE` branch.
- The config-change trigger class carries its primary-doc citation or is marked
  `UNVERIFIED — not priced`.
- The script header states the SSOT hand-over from the S-A kickoff snippet; the S-A kickoff
  itself is untouched (`git diff --stat` shows no hunk there).
- Item 4 either quotes the live observation or states the skip with the P3c verdict cited.

## §3a Fork discipline (host analogue of the park contract)

This stage runs in a host CC session, not in aif — there is no `manualReviewRequired` queue
to park into. The same discipline binds in chat form: on ANY genuine fork (two defensible
readings of a measurement, an unpriceable block class, a probe that cannot observe), surface
`DECISION-NEEDED: <one line>. Option A → consequence X. Option B → consequence Y.` to the
operator and continue with the unambiguous remainder. Never pick silently; never manufacture
an observation.

## §4 AI-traps

See [`ai-laziness-traps.md §2`](../../rules/ai-laziness-traps.md) (cited per §3 of that
rule). **Active traps for this stage: T2, T3, T6, T9, T14, T20.** T2 — the probes must be
RUN, not designed («would measure» = failure); T3 — every number carries its command +
output; T6 — confidence stated as coverage predicates, not «high»; T9 — the P3d corpus is
the full session population, not a convenient recent slice (state the corpus window); T14 —
a probe that cannot observe reports «coverage insufficient», never «clean»; T20 — no verdict
without quoted evidence.
**T-SH-A — pricing-by-assumption:** tempted to price harness blocks from byte-size
estimates when a measurement channel is missing. Counter: every price row names its channel;
unmeasurable rows say `UNMEASURED — channel absent`, never an estimate dressed as a
measurement.
**T-SH-B — corpus-drift-as-defect:** the live corpus grows between runs, so re-run numbers
drift slightly from S1/S2 figures; tempted to «reconcile» them by tweaking the script.
Counter: quote both, state the drift, change nothing — the S-A kickoff documents ~0.1-0.2%
expected drift.
