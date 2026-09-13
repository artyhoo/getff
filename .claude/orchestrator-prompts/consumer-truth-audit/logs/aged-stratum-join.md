# Aged stratum — Gate 5 closed for real (harvest round, host run)

> **Round-2 cold review, finding I5.** Gate 5 previously read «aged stratum measured (N/A record
> + host contract)» while `report-v0.md` §aged-stratum honestly said «0 artefacts measured», and
> `host-verify-aged.sh`'s «Delta classification» block accepted `fresh-census.json`, did nothing
> with it, and printed the three bucket definitions ending in «(Join performed manually or by the
> triage pass…)» — the `#hope-as-gate` shape of `.claude/rules/attention-is-not-a-mechanism.md` §2.
>
> The join is implemented in the script now (both sides were already in hand) and run below
> against a real aged consumer install. Gate 5 is **MET by measurement**, not by contract.

## What was run

```text
$ bash host-verify-aged.sh /Users/art/code/timeliner census-v0.json; echo "EXIT=$?"
```

Aged root: `/Users/art/code/timeliner` — a real, long-lived AIF consumer on the host (the
container had no aged install, which is why round 2 could only record N/A). Fresh side:
`census-v0.json` as regenerated in this harvest round from the three host benches.

## Comparability boundary (stated, not silently assumed)

The join covers the three classes the aged inventory enumerates by a name the census artefact key
also carries: **skill, agent, hook**. Every other class is printed under `NOT-COMPARED` with its
row count rather than dropped, so the covered set cannot be mistaken for the whole census:
`ci-workflow 5, companion 6, discipline-rule 30, hook-check 13, hook-check-test 12, lint-bundle 8,
mcp-config 1, principle 47, script 85, template 6`.

## Result (verbatim)

```text
EXIT=0
aged-inventory.json written: $TMPDIR/aged-inventory.json
NOTE: read-only measurement — nothing inside /Users/art/code/timeliner was touched.

Delta classification (bucket per artefact: shipped-since | never-shipped | consumer-authored):
shipped-since    	.claude/agents/claims-conformance-auditor.md
shipped-since    	.claude/hooks/runtime-bridge-dispatch.sh
shipped-since    	.claude/skills/claude-glm-executor-handoff/
shipped-since    	.claude/skills/reviewer/
never-shipped    	.claude/agents/adapter-jig-reviewer.md
never-shipped    	.claude/agents/backward-sweep-auditor.md
never-shipped    	.claude/agents/dispatch-input-checker.md
never-shipped    	.claude/agents/dual-channel-drift-auditor.md
never-shipped    	.claude/agents/getff-cold-run-prober.md
never-shipped    	.claude/agents/manual-rule-liveness-prober.md
never-shipped    	.claude/agents/shipped-agent-liveness-prober.md
never-shipped    	.claude/hooks/adopt-orchestrator-prompts.sh
never-shipped    	.claude/hooks/check-doc-authority.sh
never-shipped    	.claude/hooks/check-hook-marker.sh
never-shipped    	.claude/hooks/check-kickoff-traps.sh
never-shipped    	.claude/hooks/check-worker-dispatch-channel.sh
never-shipped    	.claude/hooks/inject-session-bootstrap.sh
never-shipped    	.claude/hooks/inject-subagent-context.sh
never-shipped    	.claude/hooks/inject-subagent-digest.sh
never-shipped    	.claude/hooks/lib/hook-emit.sh
never-shipped    	.claude/hooks/precompact-residue.sh
never-shipped    	.claude/hooks/validate-prompt.sh
never-shipped    	.claude/hooks/warn-subagent-report.sh
never-shipped    	.claude/hooks/worktree-setup.sh
never-shipped    	.claude/skills/self-reflection/
consumer-authored	hook aif-upstream-drift-check.sh
consumer-authored	hook check-kickoff-on-staging.sh
consumer-authored	skill building-native-ui
consumer-authored	skill pr-template-multi-phase
consumer-authored	skill vercel-react-best-practices
```

## Reading of the three buckets

- **shipped-since (4)** — the aged install pre-dates these four artefacts. They ship today
  (`delivered=true` somewhere in the fresh census) and are absent from the aged tree, so the
  aged install is STALE with respect to them. Not a delivery defect.
- **never-shipped (21)** — absent from the aged install AND `delivered=false` in all three fresh
  profiles. These reach nobody: they are operator-side machinery living in the framework's own
  `.claude/`. Consistent with the census's own BY-DESIGN rows for the same artefacts
  (`setup.d/LAYERS.md:10` — operator machinery is the factory's own payload, not consumer cargo).
  This bucket is a *cross-check* of the census's `delivered=false` column against a real install,
  not a new claim.
- **consumer-authored (5)** — present in the aged install, absent from the fresh census: the
  consumer's own artefacts. Never delete on this signal alone (the kickoff §3 caveat).

## What this does NOT establish

The aged install is a single consumer (`timeliner`), so the buckets describe **that** install's
drift, not a population statistic. And because the inventory walks only skills / agents / hooks,
a `shipped-since` or `consumer-authored` artefact in any NOT-COMPARED class would be invisible
here. Both limits are recorded in `report-v0.md` §aged-stratum deltas.
