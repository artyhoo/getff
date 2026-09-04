<!-- scope:aif-parity-s2-container-evidence -->

# aif-parity S2 — in-container evidence (worker self-report)

> **Scope:** raw wiring + behavioral evidence collected **from inside the aif container** by the dispatched worker (GLM-5.2 via `Z.AI GLM-5.2 SDK` profile, `bridge-profile` marker), per [`multi-model-pipeline-pilot` kickoff §2b](../../../.claude/orchestrator-prompts/multi-model-pipeline-pilot/kickoff.md). This file is the S2 contribution to the S4 two-axis parity checklist. **Host-side observer data** (aif usage events, task state transitions, PR-gate direction tests) is added at S3/S4 — not in scope here.
>
> **Honest limitation (T-AIP-E):** this is a **self-report** by the audited carrier. Wiring items are read-only and mechanically verifiable (commands + file content). Behavioral items are filtered through what the harness surfaces back to the agent — silent gates may have fired without visible output, and that ambiguity is itself a finding (recorded as `SILENT-from-agent-vantage`), not a Same.

## §1 Worker identity + environment

| Field | Value | Evidence |
|---|---|---|
| Operating as | GLM-5.2 in aif container (the audited carrier) | system banner: "powered by the model GLM-5.2" |
| Handoff mode | autonomous (`HANDOFF_MODE=1`) | `printenv HANDOFF_MODE` → `1` |
| Handoff task id | `e43ce4ea-cb13-4444-9fc4-694c0059ecd3` | `printenv HANDOFF_TASK_ID` |
| Branch | `feature/multi-model-pipeline-pilot-e43ce4` | `git branch --show-current` |
| Base HEAD | `a0423c5bcc` | `git log --oneline -1` |
| Working tree | polluted with pre-existing M files (`.claude/hooks/*.sh`, `.claude/rules/*.md`, ~30+ files) — known per memory `project_handoff_worktree_preexisting_pollution`; worker commits ONLY its own files | `git status --short` |

## §2 Wiring dump (§2b.1)

### §2.1 Deps on container PATH

```text
node:  /usr/local/bin/node
npx:   /usr/local/bin/npx
tsx:   /app/node_modules/.bin/tsx
bash:  /usr/bin/bash
jq:    MISSING
gh:    MISSING
python3: MISSING
python:  MISSING
```

`PATH=/app/node_modules/.bin:/app/node_modules/.bin:/node_modules/.bin:/usr/local/lib/node_modules/npm/node_modules/@npmcli/run-script/lib/node-gyp-bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin`

### §2.2 Registered vs shipped hooks

**Source of truth:** `.claude/settings.json` `.hooks` (git-tracked, maintainer-authored per `.claude/settings.json:52` deny-list; agents cannot `Edit`/`Write` it).

| # | shipped hook (20) | registered? | event matcher (if registered) |
|---|---|---|---|
| 1 | `adopt-orchestrator-prompts.sh` | NO | — (framework-internal; census row 1) |
| 2 | `ask-question-reminder.sh` | YES | `PreToolUse:AskUserQuestion` |
| 3 | `check-doc-authority-header.sh` | NO | — (plugin-twin; census row 3 `plugin-gap`) |
| 4 | `check-doc-authority.sh` | YES | `PostToolUse:Edit\|Write` |
| 5 | `check-hook-marker.sh` | YES | `PostToolUse:Edit\|Write` |
| 6 | `check-kickoff-traps.sh` | YES | `PostToolUse:Edit\|Write` |
| 7 | `check-worker-dispatch-channel.sh` | NO | — (dispatcher gate; not a worker-side hook) |
| 8 | `deps-hash-check.sh` | YES | `UserPromptSubmit` |
| 9 | `end-of-turn-reminder.sh` | YES | `Stop` |
| 10 | `inject-matching-rule.sh` | YES | `PostToolUse:Edit\|Write` |
| 11 | `inject-memory-codification.sh` | NO | — |
| 12 | `inject-output-language.sh` | NO | — (census row 12 `plugin-gap`) |
| 13 | `inject-project-digest.sh` | NO | — (census row 13 `zcode-gap`) |
| 14 | `inject-session-bootstrap.sh` | YES | `UserPromptSubmit` |
| 15 | `inject-subagent-context.sh` | NO | — (census row 15) |
| 16 | `inject-subagent-digest.sh` | YES | `SubagentStart` (not triggered this session — top-level session) |
| 17 | `runtime-bridge-dispatch.sh` | YES | `PostToolUse:Write\|Edit\|MultiEdit` |
| 18 | `validate-prompt.sh` | YES | `PostToolUse:Edit\|Write` |
| 19 | `warn-subagent-report.sh` | YES | `SubagentStop` (not triggered this session) |
| 20 | `worktree-setup.sh` | NO | — (`WorktreeCreate`; CLAUDE.md:183 documents as shipped-but-unregistered) |

**Registered: 12/20.** Shipped-but-not-registered (8): `adopt-orchestrator-prompts`, `check-doc-authority-header`, `check-worker-dispatch-channel`, `inject-memory-codification`, `inject-output-language`, `inject-project-digest`, `inject-subagent-context`, `worktree-setup`. Of these, 5 match documented design-exceptions (census `framework-internal`/`plugin-gap`/`WorktreeCreate`); 3 are not in the container's `settings.json` despite shipping — **the worker reports them as `NOT-REGISTERED` for the aif-carrier row** (host-side S3/S4 will decide whether they are intentional omissions or genuine drift).

### §2.3 Pre-commit hook (`.husky/pre-commit`)

| Sub-check | Dep | Dep present in container? | Wiring |
|---|---|---|---|
| Bash syntax (`bash -n`) | bash | YES | FIRED (verified §3.2 — did not fire this run because no `*.sh` staged by worker) |
| JSON validity (`python3 -m json.tool`) | python3 | **NO** | wiring present; runtime dep missing → silently skips on staged `*.json` |
| YAML validity (`python3 -m yaml`) | python3 | **NO** | wiring present; runtime dep missing → silently skips on staged `*.yml`/`*.yaml` |
| Markdown ≤600 lines (`awk`) | awk | YES (via coreutils on PATH) | FIRED × HONORED — see §3.2 |
| markdownlint-cli2 (`npx`) | npx | YES | FIRED × DEGRADED — see §3.2 (npm cache EACCES) |
| Prettier shipped-files (`npx + scripts/format-shipped.sh`) | npx | YES | not triggered this run |
| Spec-validate (`npx tsx`) | tsx | YES | not triggered this run |
| Guard-liveness structural (`node`) | node | YES | not triggered this run (no `rules-manifest.json` stage) |
| Plugin twin regen (`bash scripts/generate-plugin-twins.sh`) | bash | YES | not triggered this run (no `.claude/hooks/*.sh` staged by worker) |

### §2.4 Pre-push hook (`.husky/pre-push`)

Delegates to `packages/core/hooks/pre-push.ts` via `node --import tsx/esm` when Node ≥20 + tsx loader present. **Both conditions hold** in this container (`node` = `/usr/local/bin/node`, `tsx` resolvable). Pre-push will exercise the TS-core dispatcher when this branch is pushed (the §2b.5 commit+push IS the live test, see §3.3).

## §3 Paired-negative shield probe (§2b.3) — observed this run

### §3.1 Probe B (edit-time PostToolUse hooks)

**Probe design:** write a markdown file at `docs/meta-factory/research-patches/_probe_test.md` lacking the `> **Authoritative for:**` header (mimics a violating canonical-doc edit). Hook chain on `PostToolUse:Edit|Write` should fire: `validate-prompt.sh`, `check-doc-authority.sh`, `inject-matching-rule.sh`, `check-kickoff-traps.sh`, `check-hook-marker.sh`.

**Observations:**

| Hook | Expected output | Observed from agent vantage | Interpretation |
|---|---|---|---|
| `check-doc-authority.sh` | `⚠ check-doc-authority: jq unavailable — skipping` to stderr (source L11-13) | **SILENT** — no stderr reached the agent response | Either hook fired silently (stderr not surfaced by harness) OR hook did not fire. Source code says it MUST print this when `jq` missing. **Carrier-axis finding: PostToolUse stderr is not surfaced to the agent in the aif container.** |
| `validate-prompt.sh`, `check-hook-marker.sh`, `check-kickoff-traps.sh` | (various — judgment/check hooks) | SILENT from agent vantage | Same interpretation: not surfaced OR not fired; cannot disambiguate from agent vantage |
| `inject-matching-rule.sh` | JSON `additionalContext` injected when file matches a rule's `<!-- globs: -->` | NOT TRIGGERED for `_probe_test.md` (no rule scopes to `docs/meta-factory/research-patches/_probe*`) — expected; observed via a different file in §3.4 |
| CC-native `paths:` rule-injection (read-time) | rule auto-loads when CC reads a file matching `paths:` glob | **FIRED × HONORED** — when worker Read `packages/core/principles/09-doc-authority-hierarchy.ts`, the harness injected `.claude/rules/rule-enforcement-channel-selection.md` (`paths: packages/core/principles/**`) as a `<system-reminder>` block (visible verbatim in worker session). Also injected `.claude/rules/phase-research-coverage.md` after staging the probe. **This is independent of the aif bridge** — CC's own `paths:` mechanism, runtime-identical under the swapped model. |

**Carrier-axis root-cause for the SILENT-from-agent-vantage PostToolUse stderr:** harness routes hook stderr to a logger channel that is not echoed back to the model. Plausible without aif involvement too (CC's design choice for PostToolUse); aif does not change this. Fix-pointer: emit violations via JSON `hookSpecificOutput.additionalContext` (the channel `inject-matching-rule.sh` uses successfully), not bare stderr, for any PostToolUse hook whose violation message must reach the agent.

### §3.2 Probe A (commit-time md-gate) — FIRED × HONORED

**Probe design:** stage a 655-line markdown file lacking the authority header (`docs/meta-factory/research-patches/_probe_test.md`) and attempt `git commit`. Expected: `.husky/pre-commit` md-gate rejects with `❌ ... exceeds 600 lines`.

**Actual commit output (verbatim):**

```text
❌ Markdown file docs/meta-factory/research-patches/_probe_test.md exceeds 600 lines (655 lines). Split or trim.
npm error code EACCES
npm error syscall open
npm error path /home/node/.npm/_cacache/tmp/f5ea95a6
npm error errno EACCES
npm error
npm error Your cache folder contains root-owned files, due to a bug in
npm error previous versions of npm which has since been addressed.
npm error
npm error To permanently fix this problem, please run:
npm error   sudo chown -R 1000:1000 "/home/node/.npm"
npm error Log files were not written due to an error writing to the directory: /home/node/.npm/_logs
npm error You can rerun the command with `--loglevel=verbose` to rerun it in your terminal.
❌ markdownlint-cli2 violations — fix before commit
```

**Commit landed? NO** (`git log --oneline -1` unchanged at `a0423c5bcc`). Probe file remained staged (`A `) until revert in §3.3.

**Two-axis verdict for the md-gate row:**

- **Wiring axis:** `FIRED` — `.husky/pre-commit` ran; the `awk` line-count subcheck matched and printed its rejection banner.
- **Behavioral axis:** `HONORED` — the commit was correctly rejected; the agent could not bypass; full text reached stdout (which IS surfaced to the agent for `git commit` via the Bash tool).
- **Derived overall:** ✅ **SAME.**

**Two-axis verdict for the markdownlint-cli2 sub-check:**

- **Wiring axis:** `FIRED` — pre-commit invoked `npx markdownlint-cli2`.
- **Behavioral axis:** `DEGRADED` — npx could not actually execute the linter: `EACCES` on `/home/node/.npm/_cacache/tmp/...` (root-owned files in the user-owned npm cache directory). Pre-commit still printed `❌ markdownlint-cli2 violations — fix before commit` (because `npx` exited non-zero), but the rejection reason is npm-cache permissions, not real lint findings. This means: in this container, the markdownlint arm is a noise generator that rejects every commit touching `*.md` regardless of lint status.
- **Derived overall:** ⚠️ **WORSE (DEGRADED).**
- **Root-cause:** `/home/node/.npm/_cacache` is partly root-owned (the container images npm v6-v8 bug, fixed upstream but the image shipped before the fix). The user account `node` (uid 1000) cannot create the cache tmp dir → `npx` fails to spawn markdownlint-cli2.
- **Fix-pointer (two):**
  1. **Worker-side workaround** (known, per memory `project_handoff_npm_cache_root_owned`): prefix `git commit` with `npm_config_cache=/tmp/npmcache` to redirect the npm cache to a writable path. **This is what the worker uses for the real commit in §3.3.**
  2. **Container-image fix:** add `RUN mkdir -p /home/node/.npm && chown -R node:node /home/node/.npm` to the aif container Dockerfile (one-line, in the image, fixes every future worker permanently).

### §3.3 Real-commit live test (§2b.5) — the §3.2 fallback in production use

The real evidence-patch commit (Task 4) MUST use `npm_config_cache=/tmp/npmcache` per the memory + the §3.2 finding above, otherwise markdownlint-cli2 will reject on noise alone. **This IS behavioral evidence**: the agent diagnosed the gate's failure mode (read the EACCES, recognised the documented workaround from project memory) and applied the fix rather than bypassing the gate (the gate still runs; the cache fix lets it actually lint). Recorded as **FIRED × HONORED** for the "agent responds to shield feedback" behavioral axis (with the cache-fix as the action taken).

### §3.4 §2b.4 behavioral trace (during real work)

Any gate reddening during the real evidence-patch work is recorded here.

**Round 1 (commit attempt #1, 2026-07-23):** markdownlint-cli2 fired (cache workaround held) and rejected the commit with 3 real MD040 violations (`fenced-code-language` — bare ` ``` ` blocks at lines 24, 107, 158). **Behavior: HONORED — agent fixed the violations** by adding `text` language spec to each bare fence (3 Edit tool calls), rather than bypassing the gate. This **upgrades** the markdownlint row in §3.2 / §7 from `DEGRADED` to **`FIRED × HONORED`** for the behavioral axis when the npm-cache workaround is in place — the linter does its job correctly once given a writable cache. The `DEGRADED` verdict still holds for the **unmodified container state** (without the workaround): an agent that didn't know the cache fix would be permanently blocked.

**Round 2 (commit attempt #2, after fix):** see Task 4 outcome below.

### §3.5 Push attempt — STRUCTURAL BLOCK (by design)

**Action:** `git push origin feature/multi-model-pipeline-pilot-e43ce4`

**Result:**

```text
fatal: unable to access 'https://github.com/Yhooi2/rules-as-tests-aif.git/': gnutls_handshake() failed: The TLS connection was non-properly terminated.
```

**Two-axis verdict for the "container-side `git push`" row:**

- **Wiring axis:** `UNREACHABLE-BY-CARRIER` — the container has no outbound HTTPS to `github.com` (TLS handshake never completes). This is the documented design per [`egress-no-api-bypass.md §3`](../../rules/egress-no-api-bypass.md): "the container **cannot push** — and that is a **feature, not a bug** (do NOT 'fix the container push')". Verified empirically here from inside the container.
- **Behavioral axis:** `n/a` (channel not reachable from this carrier).
- **Derived overall:** ◻️ **COVERAGE-LIMITED — would-reach-it carrier = host-side `/dispatcher §2.4` harvest + host `git push`** (Channel A per the egress rule). The host-side fidelity seam (`agents/fidelity-auditor.md` + `pr-body-fidelity` gate + D1 spot-check) handles the actual push and PR creation; this worker's commit-on-local-branch is the artifact the host harvests.
- **Side effect on pre-push hook coverage:** `.husky/pre-push` did not run inside the container (push never reached the network). The host-side `git push` (Channel A) WILL run pre-push through the real toolchain. Worker-side coverage of the pre-push hook is **structurally unreachableable** — only the host can provide behavioral evidence for that row.

**Commit landed locally as `ec166fa8c6`** (Task 4 partial): the COMMIT-side shield test fired and was honored (markdownlint round-1 rejected, agent fixed round-2). The PUSH-side shield test (pre-push) is deferred to host-side harvest per design.

## §4 Injection self-report (§2b.2) — VERBATIM

Injected context blocks visible in the worker session so far, with their source mechanism:

### §4.1 `UserPromptSubmit` digest (`inject-session-bootstrap.sh`)

Visible at every prompt-submit as a `<system-reminder>` block titled "session-bootstrap digest — auto-injected at prompt submit". Verbatim opening:

> ```text
> Goal: AI agents can't silently bypass undocumented conventions. Every rule is an executable artifact that fails at the earliest reachable channel — edit-time → pre-commit → pre-push → CI → production audit. CI = last-resort gate. (README.md#why-this-exists)
> Invariants: (1) build-vs-reuse SSOT consult before capability commit + build-first-reuse-default discipline (.claude/rules/build-first-reuse-default.md); (2) recursive self-application green (make self-audit); (3) search-coverage 6-item checklist on negative-existence claims; (4) multi-channel enforcement — every rule fails at earliest reachable channel (CI = last resort).
> Step-0 reading order: README.md → .claude/session-bootstrap.md → CLAUDE.md → task-specific docs.
> Recommendation discipline (H1): before issuing a verdict/recommendation (ADOPT/BUILD/REJECT/DEFER, «we should X», «use Y», «pick A over B») — (1) cite SSOT/prior-art by ID, (2) give file:line or command-output evidence, (3) state what would falsify it («wrong if …»), (4) for «nothing exists» claims run the 6-item search check. An unbacked verdict is provisional, not load-bearing. This is a reminder, not a gate. (see also .claude/rules/recommendation-laziness-discipline.md + T-trap in ai-laziness-traps.md §2) (.claude/rules/phase-research-coverage.md §1.7)
> Full bootstrap + reviewer drift-prevention flowchart: .claude/session-bootstrap.md
> ```

**Verdict:** `FIRED × HONORED` — the digest was visible on every prompt; the worker references it (H1, T-AIP-E).

### §4.2 claudeMd auto-load (CC-native, not a hook)

The full `CLAUDE.md`, `.claude/rules/00-rule-index.md`, and a long list of individual `.claude/rules/*.md` files were auto-loaded into worker context as "project instructions, checked into the codebase". The `MEMORY.md` index (`/home/node/.claude/projects/-home-www-rules-as-tests-aif/memory/MEMORY.md`) was also injected. These are CC-native session-start loads, not aif-bridge behavior.

### §4.3 CC-native `paths:` rule-injection (read-time)

When worker Read `packages/core/principles/09-doc-authority-hierarchy.ts`, the harness injected `.claude/rules/rule-enforcement-channel-selection.md` (whose `paths:` frontmatter scopes to `packages/core/principles/**`) as a `<system-reminder>` block. Same mechanism later injected `.claude/rules/phase-research-coverage.md` after the probe staging. **Both verbatim injections visible in worker session.**

**Verdict:** `FIRED × HONORED` — CC-native rule-injection works identically under the aif bridge.

### §4.4 ABSENT injections (expected per §2.2 wiring)

| Expected injection | Hook | Registered? | Visible in worker session? |
|---|---|---|---|
| output-language line (`# Language: ...` reminder) | `inject-output-language.sh` | NO | **ABSENT** — consistent with wiring |
| memory-codification reminder | `inject-memory-codification.sh` | NO | **ABSENT** — consistent with wiring |
| project-digest (separate from bootstrap) | `inject-project-digest.sh` | NO | **ABSENT** — consistent with wiring |
| subagent-context (PreToolUse:Agent) | `inject-subagent-context.sh` | NO | not applicable — worker has not spawned subagents this session |
| SubagentStart digest | `inject-subagent-digest.sh` | YES (event type) | not applicable — top-level session, not a subagent |

## §5 Fork-discipline (§2b.6) — parked questions

The following genuine ambiguities surfaced during the audit. Worker parks them per §2b.6 (does NOT guess).

1. **`check-doc-authority.sh` stderr SILENT — fired-but-not-surfaced OR did-not-fire?**
   - Option A → it fired silently and the harness routed stderr away from the agent model. Evidence: source code says it MUST print the warning when `jq` missing.
   - Option B → PostToolUse hook didn't fire at all (e.g., bridge suppresses it under GLM). Evidence: zero observable PostToolUse output from any of the 5 Edit/Write-matcher hooks.
   - **Disambiguating evidence host-side:** aif task logs should show whether the hook process was spawned. **Parked — S3 host-side resolves.**

2. **Are the 5 shipped-but-not-registered non-census-exception hooks (`inject-output-language`, `inject-memory-codification`, `inject-project-digest`, `inject-subagent-context`, `check-worker-dispatch-channel`) intentional omissions or drift?**
   - Option A → intentional: the worker-side container deliberately omits inject-* hooks not relevant to a non-interactive worker (no output-language/memory/project-digest decisions for an autonomous worker).
   - Option B → drift: they SHOULD be registered but the maintainer did not add them to settings.json (parallel to CLAUDE.md:183 `WorktreeCreate` example).
   - **Parked — host-side maintainer resolves.**

3. **`planRuntimeProfileId=null` (carried from §3b) — will the real aif usage events show planning ran on GLM (the executor profile) or on the project-default Opus profile?**
   - Outside worker vantage. Host-side S3.3 answers via aif usage events.

## §6 Honest limitations of this self-report (T-AIP-E)

1. **Self-observation contamination:** the worker is the audited carrier. Wiring items are mechanically verifiable (commands + file content) — these are not subject to contamination. Behavioral items are filtered through what the harness surfaces back to the agent — silent gates may have fired invisibly (recorded as `SILENT-from-agent-vantage`, NOT as Same).
2. **No host-side aif usage events:** the worker cannot see which model actually served each pipeline stage, task state transitions, or park/answer round-trips from the host's perspective. S3 adds these.
3. **No PR-gate direction tests:** S3 runs the GREEN+RED paired-negative on the real evidence PR (after this commit lands).
4. **Limited behavioral sample:** only ONE deliberate shield probe + ONE real commit attempted. Larger samples would surface more interaction modes — but the kickoff binds to ONE live run (§5 token economy), so coverage is structurally bounded.

## §7 Worker checklist for S4 merge

When the host-side S4 synthesis assembles the two-axis parity checklist (kickoff §4), the rows derivable from THIS file are:

| channel | type | wiring | behavioral | overall | evidence |
|---|---|---|---|---|---|
| pre-commit md-gate (600 lines) | shield | FIRED | HONORED | ✅ SAME | §3.2 |
| pre-commit markdownlint-cli2 | shield | FIRED | HONORED under npm-cache workaround (§3.4 round 2); DEGRADED in unmodified container (§3.2) | ⚠️ WORSE (without workaround) — gate fires correctly only when the agent applies the §3.2 fix-pointer; round-1 agent without the workaround is permanently blocked on noise | §3.2 + §3.4 |
| pre-commit JSON validity (python3) | shield | wiring present, dep missing | n/a (silent skip on `*.json`) | ◻️ COVERAGE-LIMITED (no `*.json` staged by worker; dep absent regardless) | §2.3 |
| pre-commit YAML validity (python3) | shield | wiring present, dep missing | n/a (silent skip on `*.yml`) | ◻️ COVERAGE-LIMITED (same) | §2.3 |
| `inject-session-bootstrap.sh` | inject | FIRED | HONORED | ✅ SAME | §4.1 |
| CC-native `paths:` rule-injection | inject (CC-native, not hook) | FIRED | HONORED | ✅ SAME | §4.3 |
| `inject-output-language.sh` | inject | NOT-REGISTERED | n/a | ❌ BROKEN (wiring axis) | §2.2, §4.4 |
| `inject-memory-codification.sh` | inject | NOT-REGISTERED | n/a | ❌ BROKEN (wiring axis) | §2.2, §4.4 |
| `inject-project-digest.sh` | inject | NOT-REGISTERED | n/a | ❌ BROKEN (wiring axis) | §2.2, §4.4 |
| `inject-subagent-context.sh` | inject | NOT-REGISTERED | n/a | ◻️ COVERAGE-LIMITED (worker did not spawn subagents) | §2.2, §4.4 |
| `check-doc-authority.sh` (header gate) | shield (PostToolUse) | FIRED (registered) | SILENT-from-agent-vantage | ⚠️ WORSE — silent gate on a violating input; under-dep (jq) OR harness stderr-routing | §3.1 root-cause + fix-pointer |
| `validate-prompt.sh`, `check-hook-marker.sh`, `check-kickoff-traps.sh` (PostToolUse) | shield | FIRED (registered) | SILENT-from-agent-vantage | ◻️ COVERAGE-LIMITED — could-not-disambiguate fired-quietly from did-not-fire | §3.1 |
| `ask-question-reminder.sh` (PreToolUse:AskUserQuestion) | shield | FIRED (registered) | NOT EXERCISED in `HANDOFF_MODE=1` (worker must not call AskUserQuestion) | ◻️ COVERAGE-LIMITED (would-reach-it carrier: a non-handoff worker) | §2.2 |
| `deps-hash-check.sh` (UserPromptSubmit) | inject | FIRED (registered) | SILENT-from-agent-vantage | ◻️ COVERAGE-LIMITED — observed no digest from this hook | §2.2 |
| `end-of-turn-reminder.sh` (Stop) | inject | FIRED (registered) | fires at turn end (not yet reached at this write) | ◻️ COVERAGE-LIMITED — pending | §2.2 |
| `runtime-bridge-dispatch.sh` (PostToolUse:Write\|Edit\|MultiEdit) | shield | FIRED (registered) | NOT TRIGGERED this session (worker does not dispatch runtime-bridge work) | ◻️ COVERAGE-LIMITED | §2.2 |
| `inject-subagent-digest.sh`, `warn-subagent-report.sh` (Subagent lifecycle) | inject/shield | FIRED (registered) | NOT APPLICABLE (worker is top-level session) | ◻️ COVERAGE-LIMITED — would-reach-it carrier: a session that spawns subagents | §2.2 |
| `WorktreeCreate` (`worktree-setup.sh`) | shield | NOT-REGISTERED (documented, CLAUDE.md:183) | n/a | ◻️ COVERAGE-LIMITED — would-reach-it carrier: a session using `claude -w` | §2.2 |

**Rollup:** 3 ✅ SAME, 2 ⚠️ WORSE, 3 ❌ BROKEN (3 unregistered injects), 11 ◻️ COVERAGE-LIMITED (was 10; +1 = pre-push hook unreachable from container).

**Most-uncertain row:** `check-doc-authority.sh` (registered, source-mandated to print on missing jq, silent from agent vantage) — §5 Q1.

**UNREACHABLE-BY-CARRIER rows:**
- `ask-question-reminder.sh` — would-reach-it carrier: a non-handoff worker (HANDOFF_MODE=1 forbids AskUserQuestion).
- SubagentStart/SubagentStop hooks — would-reach-it carrier: a session that spawns subagents.
- `runtime-bridge-dispatch.sh` PostToolUse — would-reach-it carrier: a session that writes runtime-bridge files.
- `worktree-setup.sh` — would-reach-it carrier: a session using `claude -w` (the agent-side worktree primitive).
- **`.husky/pre-push` (TS-core dispatcher)** — would-reach-it carrier: host-side `git push` (Channel A per `egress-no-api-bypass.md`); container has no outbound HTTPS to `github.com` (§3.5).
- night-mode PR-gate + `/harvest` standalone §4 — pre-declared unreachable in kickoff §3b.

## §8 Forward to S3/S4

- **For S3 host-side observer:** add aif usage events per pipeline stage (planning/implementation/review); add `pr-body-fidelity` gate GREEN+RED direction tests on this real PR; add D1 calibration plan spot-check; add `/dispatcher` monitor/harvest observations; record the answer to parked Q3 (`planRuntimeProfileId`).
- **For S4 synthesis:** merge this file's row-set with §3b banked pipeline-leg rows + S3 host-side observations into the unified two-axis checklist with root-cause map. The worker half ends here; host picks up at S3.
