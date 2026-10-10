# aif-doctor — scope and evidence

> **Authoritative for:** the selected aif-doctor procedure sections below; read when routed by [the skill card](../SKILL.md).
> **NOT authoritative for:** project goal or unrelated skill modes. Commands execute from the project root unless stated otherwise.

## §5 Anti-scope

- **Does NOT run the dispatch loop** — that is `/dispatcher`. `/aif-doctor` diagnoses the environment the loop runs in.
- **Does NOT plan / score priority** — that is `/pipeline`.
- **Does NOT add npm deps or new scripts** — reuses §1 helpers + endpoints only; a genuinely-needed new probe = surface as a finding, do not build it here.
- **Does NOT auto-mutate destructive/system fixes** — Tier 2 mutations (DELETE task, cap bump, paid transport switch) need operator GO (§4). Tier 1 reversible fixes (git config, npm install, image rebuild, retry) apply automatically.
- **Does NOT fix the host proxy tunnel** — but DOES run the §3.3 discriminator first; if the block is host-selective (tunnel alive, only `registry.npmjs.org` dropped), the runtime is fixable via §3.1 Fix D (mirror) **without** touching the VPN. Only a whole-tunnel-down case is name-and-stop.
- **Does NOT edit `.claude/skills/orchestrator/`** — another skill's artefact; wrap, never fork.

---

## §6 AI-traps active ([ai-laziness-traps.md §2](../../../rules/ai-laziness-traps.md))

- **T11/T13/T16** — verified `bridge-health.sh` scope by reading its source (not by name); confirmed it does NOT cover §3's three modes. Upstream `/agent/status` watchdog reused for slow-stale; §3 modes are the watchdog's blind spots, proven live not assumed.
- **T15 self-application** — see §7: the skill is bench-tested against the three real 2026-06-03 symptoms and classifies each correctly.
- **T20** — every fix command above carries file:line / log-line / probe-output evidence, not a remembered string.
- **T-AIFDOC-A «jaccard/sibling ⇒ blind delete»** — before any `DELETE /tasks/:id`, confirm a true zombie (`implementationLog:false` AND sibling umbrella verified/merged); never delete on name-match alone.
- **T-AIFDOC-B «speculative failure catalogue»** — codify only empirically-observed modes; grow §3 on incidence (pain-driven), never pre-enumerate.

---

## §7 Bench-test (T15 self-application) — verified live 2026-06-03

The skill was run against the three real symptoms of the originating session; each classified correctly:

| Symptom (live)                                | Detector output                                                                                                                                                                                         | Classified | Evidence                                     |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | -------------------------------------------- |
| Task `cf8534d9` stuck `planning`, crash-loops | `claude --version` → `exec format error`; native-binary dir empty; log `ClaudeRuntimeAdapterError … native binary not installed (--omit=optional)`, transport=cli; `/agent/status` heartbeatStale:false | **§3.1**   | watchdog can't catch it (fresh heartbeat) ✅ |
| New task stays `backlog`                      | log `"active":3,"limit":3,"msg":"Auto-queue: project pipeline at capacity, skipping"`; cap `unset`→default 3                                                                                            | **§3.2**   | per-project cap saturated ✅                 |
| npm fetch hangs                               | dual-side `curl registry.npmjs.org` timeout (host+container)                                                                                                                                            | **§3.3**   | proxy block; name-and-stop ✅                |

### §7.1 Second incidence — verified live 2026-06-04 (§3.1 + §3.2 + §3.3-host-selective; §3.1 resolved via Fix D)

Originating prompt: «aif didn't work, dispatcher can't cope». Live triage:

| Symptom (live)                                                               | Detector output                                                                                                                                                                                   | Classified              | Resolution                                                                                                                                                          |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Task `b4671c16` («meta-orchestrator-refactor») stuck `planning`, crash-loops | `claude --version` → `exec format error`; `claude-code-linux-arm64/` empty; log `ClaudeRuntimeAdapterError … native binary not installed (--omit=optional)`; `/agent/status` heartbeatStale:false | **§3.1**                | **Fix D** — `npm i -g … --registry=https://registry.npmmirror.com --include=optional` → `claude --version` `2.1.161`, 0 errors/45s, task resumed live tool-calls ✅ |
| New task `c67a4343` stays `backlog`                                          | log `"active":3,"limit":3` for project `441c1c0c`; slots = `b4671c16`(planning) + `a35ecce5`(plan_ready) + `149d3107`(review)                                                                     | **§3.2**                | secondary — fixing §3.1 frees the crash-looper; cap-relief deferred (not the root)                                                                                  |
| `registry.npmjs.org` 000 both sides                                          | **discriminator:** github 200, google 200, mirror `registry.npmmirror.com` 200; `route default → utun4` (`198.18.0.1/16` TUN)                                                                     | **§3.3 host-selective** | tunnel ALIVE — VPN-disable was a wrong-layer ask; Fix D bypassed it with zero VPN change ✅                                                                         |

**Lesson baked into §3.3 + §3.1 Fix D:** «registry times out» ≠ «tunnel down» ≠ «disable the VPN». Run the github/mirror discriminator first; a host-selective block is fixable from a mirror without operator network surgery.

## §8 Stop conditions

- BFR surfaces an existing helper/endpoint that already does a §3 detection → **reuse it, shrink the skill to a pointer** (already applied: §1 reuses `/health`+`/agent/status` rather than building probes; the upstream stale-watchdog is referenced, not re-implemented).
- Any §3 fix requires a **paid-LLM path** (API transport with a paid key) → mark **DEFER** per [no-paid-llm-in-ci.md](../../../rules/no-paid-llm-in-ci.md), never bake it as default (§3.1 Fix-C).

---

## §9 §1.7 self-reflexive note

**Forward-check:**

- [build-first-reuse-default.md §3](../../../rules/build-first-reuse-default.md) + [phase-research-coverage.md §1](../../../rules/phase-research-coverage.md) — BUILD verdict (the _runbook_) confirmed via the full mechanism: SSOT consult (#27/#28/#65/#67/#88/#109/#111 reviewed — none is an operator-facing aif health runbook); DeepWiki ≥3 phrasings on `lee-to/aif-handoff` (health/doctor, capacity-enforcement, runtime-transports — surfaced `/health`, `/agent/status`, `probeClaudeCli`, the stale-watchdog → REUSED, shrinking the skill); **WebSearch ≥3 phrasings** (operator health/doctor for aif-handoff; CLI diagnose AI-agent runtime native-binary/capacity; operator runbook self-hosted agent docker-compose triage) — surfaced only **wrong-problem-class** generic tools (Docker "Container Doctor" LLM-agents, `docker-ai` skill, Bedrock AgentCore arm64-binary diagnostics): generic Docker log-analysis, several **paid-LLM** (T16 mismatch + [no-paid-llm-in-ci.md](../../../rules/no-paid-llm-in-ci.md)), none triages the aif coordinator + claude-native-binary + per-project-capacity class. **Adversarial counter-prompt** (§1 item 4 — «if an aif operator-doctor existed it would live in `lee-to/aif-handoff` or the docs site») surfaced no candidate → negative-existence claim holds. New SSOT #112 added in this commit.
- [dual-implementation-discipline.md §6](../../../rules/dual-implementation-discipline.md) — operator-internal diagnostic; `@cc-only-rationale` marker present (markdown content is harness-agnostic, only invocation is CC-native — no portable counterpart to drift).
- [no-paid-llm-in-ci.md §1](../../../rules/no-paid-llm-in-ci.md) — every probe is `curl`/`docker`/`grep`; zero API-billed calls. The one paid path (§3.1 Fix-C API transport) is explicitly DEFER-gated, never default.
- [doc-authority-hierarchy.md §3](../../../rules/doc-authority-hierarchy.md) — Class C + Authoritative-for/NOT-authoritative-for header present.
- Principle 15 — `## Without this skill` / `## With this skill` paired-negative block present, halves differ.
- [recommendation-laziness-discipline.md §3](../../../rules/recommendation-laziness-discipline.md) — every emitted fix is evidence-backed; Tier 2 mutations surface for GO; Tier 1 reversible fixes auto-apply with log (2026-06-04 split per §4).

**Backward-check:**

- [.claude/skills/dispatcher/SKILL.md](../../dispatcher/SKILL.md) (SSOT #111) — COMPLEMENTARY, not superseded: dispatcher owns the loop; its NOT-authoritative-for header (verified, line 24) names only planning/pipeline/orchestrator and is silent on operational-environment health — this skill makes that implicit gap explicit. No overlap in trigger (dispatcher = `disable-model-invocation:true`, explicit `/dispatcher`; doctor = fires on failure phrases).
- [.claude/skills/pipeline/SKILL.md](../../pipeline/SKILL.md) — untouched; planning stays pipeline's.
- `packages/runtime-bridge/scripts/bridge-health.sh` / `verify-bridge.sh` / `src/cli/ensure-parallel.ts` — REUSED as-is, zero edits; this skill points to them.
- No existing rule or skill is superseded; this is a new operational artefact added on incidence (the 2026-06-03 environment breakage).
- **Incidence-driven update 2026-06-04 (T-AIFDOC-B — grow on pain, not speculation):** the second live incidence added §3.1 **Fix D (mirror install)** + the §3.3 **discriminator** (github/google/mirror probe) + §7.1 bench-row. No new failure _mode_ invented — these refine the existing §3.1/§3.3 modes with an empirically-verified resolution path (`registry.npmmirror.com` → 200; `claude --version` → `2.1.161`; 0 errors/45s; task resumed). The earlier §3.3 framing «whole-tunnel down → name-and-stop» was over-absolute (T20: it asserted the tunnel was dead without the github/mirror discriminator that proves it host-selective). Corrected in place; no other artefact superseded; `bridge-health.sh`/`verify-bridge.sh` still REUSED unedited.
- **Incidence-driven update 2026-07-24 (T15 self-application — the detector was teaching the same blind spot the helper had):** §1 base-currency probe + §3.4 Mismatch + §3.4 helper description were corrected to require the two-part check (branch ref AND working-tree HEAD), matching the fix ported into `refresh-aif-base.sh` the same day. The prior detector (`gh api … vs rev-parse staging` — ref only) reproduced the exact blind spot of the buggy helper: a base clone whose ref was current but whose working tree was parked on another branch certified as healthy. The §3.4 symptom list now names «base clone checked out on another branch» as a named cause of stale-base garbage, parallel to the synthetic-base and tunnel-block causes.
- **Incidence-driven update 2026-09-23 (T-AIFDOC-B — a new mode, observed live, not pre-enumerated):** §3.9 added after tasks `514693af` / `71ad40d7` sat `implementing` for ~22 h behind a Z.AI 429 [1310] quota rejection that every heartbeat probe — including the §1 upstream watchdog — reported as healthy. §2 step 1 now reads the agent log's error levels, the only place the cause was recorded. No existing mode superseded; the §3.7 `--since` warning is reused, not restated.
