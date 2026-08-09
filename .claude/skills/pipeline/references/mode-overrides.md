<!-- scope:meta-orchestrator-mode-overrides -->

# Mode override flags — discipline reference

> **Class:** C — prose-only; companion paired-negative at `packages/core/hooks/parse-override-flags.test.ts`.
> **Authoritative for:** CLI flag set (--mode-direct/solo/bundle/pair/decompose/research), reason argument requirement, emission contract, override-as-default anti-pattern.
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../../../README.md#why-this-exists). Routing tree itself — see SKILL.md §2.5 Step 5. Alias↔Mode mapping table — see SKILL.md §2.5 Step 6.

> **Origin:** Stage 4 of meta-orchestrator-mode-triage-and-planner umbrella (2026-05-26). Binding spec: [design §10](../../../../docs/meta-factory/research-patches/2026-05-25-meta-orchestrator-mode-triage-and-planner-design.md#§10-override-flags-minor-work). R-phase verdict: [prior-art §3.5](../../../../docs/meta-factory/research-patches/2026-05-26-meta-orchestrator-mode-triage-prior-art.md#§35-area-c-verdict) — BUILD flags + REFERENCE aif-handoff AGENT_USE_SUBAGENTS pattern (SSOT #81).

<!-- @dual-pair: meta-orchestrator-mode-overrides -->
<!-- spec: ../helpers/parse-override-flags.sh -->

---

## §1 Override flag set

Six mutually-exclusive flags. Each maps 1:1 to an ALIAS value from SKILL.md §2.5 Step 6
(line 213) and to an internal DISPATCH mode:

| CLI flag           | OVERRIDE_MODE emitted | ALIAS (SKILL.md §2.5 Step 6 line 213–221) | DISPATCH (internal)          |
| ------------------ | --------------------- | ----------------------------------------- | ---------------------------- |
| `--mode-direct`    | `DIRECT`              | DIRECT                                    | direct-Edit                  |
| `--mode-solo`      | `SOLO`                | SOLO                                      | Mode-A                       |
| `--mode-bundle`    | `BUNDLE`              | BUNDLE                                    | Mode-A-bundle                |
| `--mode-pair`      | `PAIR`                | PAIR                                      | Mode-SDD                     |
| `--mode-decompose` | `DECOMPOSE`           | DECOMPOSE                                 | Mode-B                       |
| `--mode-research`  | `RESEARCH`            | RESEARCH                                  | R-phase-session / Queue-mode |

The ALIAS→DISPATCH column is verbatim from SKILL.md §2.5 Step 6 (lines 215–221). Principle 19
(`packages/core/principles/19-meta-orchestrator-alias-routing-consistency.test.ts`) enforces
ALIAS→DISPATCH consistency mechanically; this table is the authoritative human-readable spec
for the override surface only.

---

## §2 Reason argument requirement

Override invocation requires a `--reason=<text>` argument (≥`MO_OVERRIDE_REASON_MIN` chars,
default 20). Parallel to the `Prior-art: skipped — <reason>` escape hatch in
[CLAUDE.md «Build-vs-reuse invariant»](../../../../CLAUDE.md) (≥20-char rationale requirement).

**Empty / absent reason:** exit 2 + stderr:
`parse-override-flags.sh: --reason required (≥20 chars); got: '<got>'`

**Reason shorter than minimum:** exit 2 with the same stderr message; `<got>` shows what
was actually passed.

**Seam `MO_OVERRIDE_REASON_MIN`:** env var overrides the 20-char default for testing. Set to
a smaller value to test short-reason acceptance without padding.

**Full invocation form:**

```text
/pipeline "my-umbrella --mode-solo --reason=kickoff is small single-worker"
```

User must quote the entire argument as one shell token because `arguments: [umbrella]`
declares a single argument (SKILL.md line 4); embedded flags + reason are part of that
single umbrella string. `parse-override-flags.sh` tokenises `$1` internally (see §3).

---

## §3 Emission contract

When `parse-override-flags.sh` succeeds (exit 0), it emits exactly TWO lines to stdout:

```text
OVERRIDE_MODE=<ALIAS>
OVERRIDE_REASON=<reason>
```

Example: `OVERRIDE_MODE=SOLO` on line 1, `OVERRIDE_REASON=kickoff is small single-worker`
on line 2.

**Routing tree short-circuit (SKILL.md §0 Step 0 — deferred to Stage 4 follow-up after
cap-bump):** when `OVERRIDE_MODE=` line is present in §0 preamble output:

- Skip §2.5 routing tree entirely.
- Force `Mode = OVERRIDE_MODE` as the Step 5 result.
- Emit `OVERRIDE=user-flag, reason=<reason>` on its own line before the §10 rendered
  output (visible in dependency graph + 1-liner block).
- Proceed to §3 launch-table with the forced ALIAS.

If `parse-override-flags.sh` exits 2 (multi-flag collision or short-reason): halt; surface
stderr verbatim to maintainer.

---

## §4 Anti-patterns

- **`#override-as-default`** — using `--mode-solo` (or any flag) for every task because
  auto-classify feels noisy. Counter: rate guard in §5. Using an override when
  `classify-work.sh` would have agreed is wasteful but not wrong (surface as info, not
  alert — see `#override-used-when-classify-would-agree` below).

- **`#bypass-with-empty-reason`** — passing `--reason=` with an empty string or ≤19
  chars (e.g. `--reason=fast`). `parse-override-flags.sh` exits 2 with stderr
  `--reason required (≥20 chars)`. Same discipline as the `Prior-art: skipped` escape
  hatch. Counter: the helper enforces this mechanically.

- **`#multi-flag-collision`** — passing ≥2 mode flags in one invocation
  (e.g. `--mode-solo --mode-pair`). Semantically undefined (only one ALIAS can be
  forced). Counter: `parse-override-flags.sh` exits 2 + stderr `multi-flag collision: <flags>`.

- **`#override-used-when-classify-would-agree`** — forcing a flag that matches what the
  routing tree would have computed anyway (e.g. `--mode-solo` on a TYPE=I-phase-small
  task with no review requirement). Not harmful, but adds cognitive noise. Counter: surface
  as info log in §10 rendered output; never block.

---

## §5 Anti-pattern guard mechanism (DOCUMENTATION-ONLY — DEFERRED to Stage 5 follow-up)

**Design intent (for future wiring):** read `_master-backlog-delta.json` `override_log[]`
array; last 10 entries; if `(count(non-empty override_mode)) / 10 > 0.3` → emit ALERT line
to maintainer. Cites design [§10 lines 288-290](../../../../docs/meta-factory/research-patches/2026-05-25-meta-orchestrator-mode-triage-and-planner-design.md).

**Current implementation status (RECURSIVE-SELF-APPLICATION NOTE):** the `override_log[]`
field **does not exist** in `_master-backlog-delta.json` schema today (verified by reading
`helpers/update-delta.sh:7-8` schema declaration — keys = `last_check_ts` +
`last_check_git_head` + `untracked_seen` + `closed_since_last`; NO `override_log`). Wiring
requires schema extension which is out of Stage 4 scope per kickoff "NOT scope" list (writer
modifications). This §5 is the documented spec for the eventual mechanism; the active
rate-check is deferred to Stage 5 (or a follow-up after this umbrella merges).

**Acceptance criterion for Stage 4:** §5 exists as written documentation; no active
rate-check code ships in Stage 4. Documenting the design preserves intent across sessions
per [memory-codification.md §3](../../../rules/memory-codification.md).

---

## §6 §1.7 self-reflexive check

**Forward-check:**

- [build-first-reuse-default.md §1](../../../rules/build-first-reuse-default.md): REUSE
  pattern from `plan-cache.md:3-4` (blockquote header format) + `update-delta.sh:1-40`
  (header + seams comment block). BUILD `parse-override-flags.sh` per R-phase Area C
  verdict (SSOT #81) — no upstream bash CLI override parser with 6-flag mutually-exclusive
  semantics exists; confirmed via R-phase §3 evidence.
- [no-paid-llm-in-ci.md §1](../../../rules/no-paid-llm-in-ci.md): this ref doc is
  deterministic markdown; `parse-override-flags.sh` is pure-bash with no API calls; zero
  paid LLM in CI.
- [doc-authority-hierarchy.md §3](../../../rules/doc-authority-hierarchy.md): this file
  carries blockquote `> **Authoritative for:**` header (lines 3-6) mirroring
  `plan-cache.md:3-4` format. Class C declared (line 3).
- [dual-implementation-discipline.md §6](../../../rules/dual-implementation-discipline.md):
  companion `parse-override-flags.sh` carries `@dual-pair: meta-orchestrator-mode-overrides`
  - `@cc-only-rationale` in header. This ref doc carries the matching
    `<!-- @dual-pair: meta-orchestrator-mode-overrides -->` anchor (line 27).

**Backward-check:**

- No existing `.claude/rules/*.md` modified.
- No existing `packages/core/principles/*.test.ts` modified.
- `update-delta.sh` UNCHANGED (schema extension is out of Stage 4 scope).
- SSOT `prior-art-evaluations.md` UNCHANGED (row #81 already shipped in Stage 3 R-phase).
- SKILL.md `@dual-pair` comments NOT added in Stage 4 (cap blocker; deferred to
  follow-up per kickoff fallback path — SKILL.md edits D.1-D.3 deferred).

---

## §8 Preset flags (A4 — pipeline launch presets)

**Binding source:** [beta-delivery-ux S2 kickoff](../../../orchestrator-prompts/beta-delivery-ux/kickoff-s2.md) §2 + §8a operator resolutions (2026-08-08). Design spec: `docs/superpowers/specs/2026-07-23-beta-program-design.md` §4 A4.

**Four declarative presets** — data, not prose — at `references/presets/<name>.json`:

| Preset    | `mode`                | `marker`                    | When to pick                                |
| --------- | --------------------- | --------------------------- | ------------------------------------------- |
| `aif`     | `autonomous`          | `Claude Opus (plan+review)` | unattended / overnight aif-handoff dispatch |
| `night`   | `mode-a-inline`       | `null`                      | night-mode unattended single-session        |
| `economy` | `whole-line-executor` | `Z.AI GLM-5.2 SDK`          | cost-conscious whole-line on executor tier  |
| `sdd`     | `in-session`          | `null`                      | interactive single-feature SDD              |

**Activation (clig.dev flag-first — A4 binding constraint 1+2):**

- `--preset <name>` in the umbrella string (flag path).
- `AIF_PIPELINE_PRESET=<name>` environment variable (env path).
- **Precedence:** flag > env > default (no preset).
- Menu-only UX is REJECTED (breaks agents/CI). A TTY launch-table row is ADDITIVE.

**Collision with `--mode-*`:** `--preset` + any explicit `--mode-*` flag simultaneously → `parse-override-flags.sh` exits 2 with `multi-source collision` stderr. Use one or the other.

**Data format = JSON** (§8a Park-2 BINDING). `jq` is already a hard helper dependency (`helpers/update-delta.sh`); YAML would add a `yq`-class toolchain dependency (rejected — new capability for a format choice).

**F-B′ shell-sourced rejection (spec §11 requires the WHY):** sourcing data executes it as code — the flag parser itself rejected eval for injection risk (`parse-override-flags.sh` header, strategy C); data that executes fails the F-B′ criterion «readable … without parsing prose» in the harder direction (readable only BY executing).

**Schema (§8a Park-1 BINDING — flat + `description`):**

```json
{
  "mode": "<autonomous|mode-a-inline|whole-line-executor|in-session>",
  "reviewer_tier": "<aif-own|session-bound|executor-tier>",
  "marker": "<full-display-name | null>",
  "description": "<one-line human description for list verb>",
  "predicates": {
    "bundle_opt_in": <bool>,
    "review_required": <bool>,
    "parallel_safe": <bool>
  },
  "aif_runtime_hints": { "maxReviewIterations": 1 }
}
```

`aif_runtime_hints` is optional (only `economy` carries it, per §8a Park-3: whole line on executor tier + aif auto-review capped at 1 iteration + external cold fidelity round mandatory).

**Three seams where presets embed (spec A4 — all three implemented):**

1. **Parser** (`helpers/parse-override-flags.sh`) — detects `--preset <name>` / `AIF_PIPELINE_PRESET`, delegates to `helpers/resolve-preset.sh`, collision-checks against `--mode-*`.
2. **Routing predicates** (`SKILL.md §2.5 Step 5`) — when `PRESET_MODE` is set, the 3 predicates (`bundle_opt_in` / `review_required` / `parallel_safe`) come from the preset, short-circuiting the routing tree.
3. **Bridge-profile marker** (relay in `SKILL.md §0` preamble) — when `PRESET_MARKER` is non-empty, the generated kickoff carries `<!-- bridge-profile: <value> -->`. The marker value MUST be the profile's FULL DISPLAY NAME, UNIQUE under case-insensitive substring match (CLAUDE.md «Marker value rule»).

**`economy` reviewer-tier semantics (§8a Park-3 BINDING):** the whole line INCLUDING review runs on the executor tier (not a separate reviewer), with aif auto-review capped at **1 iteration** (`maxReviewIterations: 1`) AND the external cold fidelity round stays MANDATORY.

**Marker values (§8a Park-5 snapshot, live 2026-08-08):** `curl -s "$RUNTIME_BRIDGE_AIF_URL/runtime-profiles" | jq -r '.[].name'` returned `Claude Opus (plan+review)` / `Z.AI GLM-5.2 SDK` / `Qwen3.8-Max-Preview` — no case-insensitive substring collision among full display names. **AC-3 re-probe live at implementation time is still binding.**

---

## §7 See also

- [SKILL.md §0 Invocation](../SKILL.md) — slash-command entry point; §0 Step 0 preamble
  wiring deferred to follow-up after cap-bump.
- [SKILL.md §2.5 Step 5](../SKILL.md) — routing tree (6 predicates); short-circuit
  insertion deferred to follow-up after cap-bump.
- [helpers/parse-override-flags.sh](../helpers/parse-override-flags.sh) — bash
  implementation of §2-§3 parsing contract.
- [design §10](../../../../docs/meta-factory/research-patches/2026-05-25-meta-orchestrator-mode-triage-and-planner-design.md) — override flag spec origin.
- [R-phase §3.5](../../../../docs/meta-factory/research-patches/2026-05-26-meta-orchestrator-mode-triage-prior-art.md) — Area C verdict (BUILD flags + REFERENCE aif-handoff shape).
- [SSOT #81](../../../../docs/meta-factory/prior-art-evaluations.md) — oh-my-openagent alias routing REFERENCE.
