<!-- bridge-profile: Z.AI GLM-5.2 SDK -->
<!-- scope: kickoff — per-role-context runtime probe. One-shot research task: verify in a LIVE Claude Code runtime what prior research claimed from static file reads. NOT an umbrella stage; NOT a rule proposal; NOT a design. Output = a probe-report.md. Operator-commissioned 2026-07-26 to close the static-vs-runtime gap. -->

# per-role-context-runtime-probe — kickoff

> **Goal:** verify (or refute) in a LIVE Claude Code session the claims that prior static-file research made about per-role context injection. Static research read `.claude/hooks/*.sh` source and inferred behavior; this task runs the hooks and observes actual payload.
>
> **Why this task exists:** a prior research session concluded "no hook branches on `subagent_type`" and "the session-bootstrap digest is uniform across roles" — but it only read source code. The behavior in a real CC session may differ (e.g. the CC harness may inject role-specific content via a mechanism the source files don't reveal; or `inject-subagent-context.sh:62`'s `subagent_type` preservation may have side effects invisible in source).
>
> **Output:** write `per-role-context-runtime-probe-report.md` to the project root with the findings table (§3 below). No code changes. No rule proposals. Just measurements.

## §0 What this task is NOT

- NOT a spec / design / rule proposal. Pure measurement.
- NOT an umbrella stage. No stage-gate, no harvest, no PR.
- NOT an opinion on whether per-role context is desirable. The probe collects data; the fabla decides later.
- NOT a license to modify `.claude/`, `packages/`, `scripts/`, or any rule. Read-only investigation.

## §1 Probe targets — verify or refute each claim

For EACH claim below: run the probe, record what actually happens (with timestamped evidence — paste actual JSON payloads, actual file listings, actual `jq` output), and mark the claim **CONFIRMED**, **REFUTED**, or **PARTIAL** (with the gap).

### Claim P1 — `inject-subagent-digest.sh` emits identical payload to every subagent regardless of `subagent_type`

- **Static claim:** `.claude/hooks/inject-subagent-digest.sh:22-26` reads the digest verbatim from `inject-session-bootstrap.sh` with no role branch; emits the same `additionalContext` to every dispatched subagent.
- **Probe:** dispatch 3 different subagent types in this session (e.g. `general-purpose`, `Explore`, `ui-designer-react`) and capture each one's SubagentStart `additionalContext` payload. Compare byte-for-byte.
- **CONFIRMED if:** all 3 payloads are byte-identical.
- **REFUTED if:** any payload differs (and the diff is role-correlated, not random).
- **Capture method:** temporarily wrap the hook to log its output to `/tmp/probe-subagent-<timestamp>.json`, OR dispatch the subagents and ask each to echo back the `<system-reminder>` / additionalContext it received at start.

### Claim P2 — `inject-subagent-context.sh` (ZCode fallback) preserves `subagent_type` but does not branch on it

- **Static claim:** `.claude/hooks/inject-subagent-context.sh:62` comment says it "preserves every other field (description, subagent_type, model, run_in_background)"; the `updatedInput` rewrite at `:73-75` appends the same digest regardless.
- **Probe:** check whether this hook is active in the current runtime (`echo $ZCODE_RUNTIME` or check if it's CC vs ZCode). If active, dispatch subagents with different `subagent_type` values and inspect the resulting `tool_input.prompt` after the hook's `updatedInput` rewrite.
- **CONFIRMED if:** the rewrite appends the same digest string regardless of `subagent_type`.
- **REFUTED if:** the rewrite varies the appended content based on `subagent_type`.
- **Note:** if this runtime is CC (not ZCode), this hook is dormant — record that and skip.

### Claim P3 — `inject-matching-rule.sh` injects only on PostToolUse Edit/Write/MultiEdit, gated by file-path glob, once per session per rule

- **Static claim:** `.claude/hooks/inject-matching-rule.sh:39, 50-57, 64-66, 78, 84` — gates on tool name, matches file path against `<!-- globs: -->` markers, dedups via a per-session tmpfile.
- **Probe:** (a) trigger an Edit on a path that matches a known rule's globs (e.g. edit `.claude/rules/kickoff-staging-placement.md` and observe whether `inject-matching-rule.sh` fires). (b) Edit the same file again in the same session — confirm the dedup suppresses the second injection. (c) Edit a non-matching path — confirm silence.
- **CONFIRMED if:** behavior matches the static claim on all 3 sub-probes.
- **Capture:** the injected `additionalContext` content + the dedup tmpfile path (`/tmp/cc-rule-injector-*.txt`).

### Claim P4 — the CC-native loader injects rules without `paths:` frontmatter at every session start

- **Static claim (from session-start-token-audit kickoff):** Claude Code natively loads at session start: user `~/.claude/CLAUDE.md`, project `CLAUDE.md`, and every `.claude/rules/*.md` lacking `paths:` YAML frontmatter, minus `claudeMdExcludes` entries.
- **Probe:** at the start of THIS task session, list every `.claude/rules/*.md` file, classify each by (has `paths:` frontmatter? yes/no) × (in `claudeMdExcludes`? yes/no), and verify that the rules actually present in your session context match the predicted set (no-paths AND not-excluded).
- **CONFIRMED if:** the rules visible in your session's startup context exactly match the predicted set.
- **PARTIAL if:** there's a mismatch — record which rules deviate and hypothesize why.

### Claim P5 — the uniform session-bootstrap digest is small (~500 tokens, unverified in prior research)

- **Static claim:** the digest block in `.claude/session-bootstrap.md` between `<!-- digest:start -->` / `<!-- digest:end -->` markers is "~500 tokens" (a prior-research estimate that was never verified).
- **Probe:** extract the digest block, `wc -c` it, apply the T-TOK-A divisor (bytes/4 ASCII-dominant, bytes/2.2 if >30% non-ASCII per the session-start-token-audit kickoff §1).
- **CONFIRMED if:** the number is in the 300-800 token range.
- **Capture:** the byte count, the non-ASCII ratio, the chosen divisor, the final token estimate.

### Claim P6 — the 3 wrapper skills (arch/pipeline/dispatcher) do not add per-role context shaping

- **Static claim:** arch/pipeline/dispatcher name roles but prescribe the same context payload per role; differentiation by question + model tier, not by context shape.
- **Probe:** read each of the 3 SKILL.md files end-to-end. For each role the skill names, identify: (a) what context the role receives, (b) what context the role is told NOT to receive, (c) whether the per-role context differs in any way other than the dispatch prompt's question text.
- **CONFIRMED if:** no per-role context table or allow/deny list exists in any of the 3 wrappers.
- **REFUTED if:** a per-role context table exists that prior research missed.

## §2 Additional live observations (not in static research)

While probing, also record:

- **A.** Total tokens at session start for THIS task session (if measurable — some CC versions expose this; if not, note "not exposed").
- **B.** Whether any non-repo injection mechanism is active (e.g. `~/.claude/CLAUDE.md` user-global, MCP server instructions, plugin skill content) — list each with byte count.
- **C.** Whether `inject-subagent-context.sh` is wired in `.claude/settings.json` for this runtime and whether it actually fires on subagent dispatch.
- **D.** Any anomaly: a hook firing when static research said it shouldn't, or vice versa. This is the highest-value output — surprises override confirmations.

## §3 Output format

Write `per-role-context-runtime-probe-report.md` to project root with this structure:

```markdown
# Per-role context runtime probe — report

**Probe run:** <timestamp>
**Runtime:** <CC version / ZCode / other>
**Task branch:** <branch>

## Findings table

| Claim | Static prediction | Live observation | Verdict | Evidence |
|---|---|---|---|---|
| P1 | ... | ... | CONFIRMED/REFUTED/PARTIAL | <pasted payload or jq output> |
| P2 | ... | ... | ... | ... |
| ... | ... | ... | ... | ... |

## Additional observations (§2 A-D)

...

## Surprises (highest-value)

<anything that didn't match static research>
```

## §4 Constraints

- **Read-only.** Do not modify `.claude/`, `packages/`, `scripts/`, `plugin/`, or any rule. The probe observes; it does not change.
- **The temporary hook-wrapper for P1 capture** (if you use that method) must be reverted before the task ends. Record what you added and what you reverted.
- **Time-box:** if a probe is blocked (e.g. can't capture SubagentStart payload), record "BLOCKED: <reason>" and move on. Do not grind.
- **No recommendations.** This probe reports measurements. The fabla decides what to do with them.

## §5 See also (do NOT re-research — just verify against live runtime)

- `docs/meta-factory/research-patches/2026-07-26-per-role-context-shaping-raw-research.md` — the 10 claims (C1-C10) this probe verifies (P1-P6 map to C3, C5-C8, C10).
- `docs/superpowers/specs/2026-07-26-per-role-context-candidate-shapes.md` — the 18 candidate shapes (context only; not for this probe to evaluate).
- `docs/superpowers/specs/2026-07-26-per-role-context-inflight-context.md` — in-flight items.
