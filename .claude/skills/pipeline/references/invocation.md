# pipeline — invocation

> **Authoritative for:** the selected pipeline procedure sections below; read when routed by [the skill card](../SKILL.md).
> **NOT authoritative for:** project goal or unrelated skill modes. Commands execute from the project root unless stated otherwise.

<!-- @harness-posture: cc-native-with-fallback — CC slash-command/!shell/Write/Agent primitives; helpers are plain bash with resolved <orch-home> paths (references/invocation.md §0) -->

> **Class:** B (mixed): §0/§7.1 + §10/§7.12 = Class A (CC primitive enforces structurally — slash-command exists or not, Write tool writes file or not, frontmatter parses or not). §4/§7.5 = partial Class A via principle 12 test enforcing §5 AI-traps section presence in generated kickoffs. §1/§7.2 · §2/§7.3 · §3/§7.4 · §5/§7.6 · §6/§7.7 · §7/§7.8 · §9/§7.11 · §11/§7.13 = **Class C** (prose-only enforcement; AI can ignore `!shell`-injected data and proceed; acceptable per [parallel-subwave-isolation.md §4](../../../rules/parallel-subwave-isolation.md) precedent and [research-patches/2026-05-16-readme-absolutism-vs-class-c-practice.md](../../../../docs/meta-factory/research-patches/2026-05-16-readme-absolutism-vs-class-c-practice.md) maintainer-owned tension). **Re-promotion triggers per Class C:** ≥2 stage-gate-ignored incidents within 6 months → consider mechanical post-hoc check (commit-on-branch-B-only-if-PR-on-branch-A-merged via pre-push hook).
> **Authoritative for:** /pipeline slash-command behaviour — §0 invocation through §11 failures; plan-currency check discipline; cross-umbrella priority scoring; Mode A/B/SDD/Queue launch-table generation; meta-kickoff authoring; stage-gate enforcement; reviewer dispatch.
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../../../README.md#why-this-exists). The `orchestrator` skill at `.claude/skills/orchestrator/` — a separate skill this one wraps, never forks. The actual R-phase verdict — see [research-patches/2026-05-23-meta-orchestrator-prior-art.md](../../../../docs/meta-factory/research-patches/2026-05-23-meta-orchestrator-prior-art.md).

# /pipeline — plan-preflight + launch-table + stage-gate dispatch

**Origin:** BUILD verdict 2026-05-23. R-phase patch: [research-patches/2026-05-23-meta-orchestrator-prior-art.md](../../../../docs/meta-factory/research-patches/2026-05-23-meta-orchestrator-prior-art.md). Closes 4 named gaps in the `orchestrator` skill (plan-actuality / cross-umbrella priority / auto-launch-table / stage-gate-vs-flat-queue).

**Binding spec:** `.claude/orchestrator-prompts/meta-orchestrator-prior-art/kickoff.md §7` (gitignored, 14 sub-sections §7.1-§7.14).

**Substrate:** CC slash-command primitive + `!shell` injection + Write tool + Agent tool. Zero npm deps. Zero paid-LLM-in-CI calls (all dispatch is session-bound per [no-paid-llm-in-ci.md §1](../../../rules/no-paid-llm-in-ci.md)). **Path convention — `<orch-home>` (binds §1, §2.5, §4, §10):** every runtime path below is relative to `<orch-home>`, the **resolved** orchestration home — `.claude/orchestrator-prompts/` in this framework repo, `.ai-factory/orchestrator-prompts/` in a consumer install. Resolve it, never assume it: `"$(bash "${CLAUDE_SKILL_DIR}/helpers/print-orch-home.sh" 2>/dev/null)"` (the same `resolve_orch_home()` the helpers use, `helpers/lib/common.sh`; `MO_ORCH_HOME` overrides both). The framework literal is **never delivered to a consumer**, so hardcoding it makes reads silently empty and writes land in a second, unread directory (getff#1245); `packages/core/principles/39-skill-fence-orch-home.test.ts` gates the fences against that regression.

---

## §0 Invocation

**Slash command:** `/pipeline [<umbrella-name> | <N>]` — flag contract (incl. «not a recursion guard»): [operational-conventions.md §4](../../../../docs/meta-factory/operational-conventions.md#4-disable-model-invocation--an-invocation-channel-flag-not-a-permission).

> **Provenance / binding spec (§7.1–§7.14):** §0–§11 implement the 14-section binding spec at `.claude/orchestrator-prompts/meta-orchestrator-prior-art/kickoff.md §7` (gitignored origin-trace; the SKILL.md sections below are the authoritative spec). Section↔spec map: §0=§7.1 · §1=§7.2 · §2=§7.3 · §2.5=Stage-2C routing · §3=§7.4 · §4=§7.5 · §5=§7.6 · §5.5=bundle (B1/B2/B3a) · §6=§7.7 · §7=§7.8 · §8=§7.9 + §7.10 install-coupling · §9=§7.11 · §10=§7.12 · §11=§7.13. **§7.14** = the four original orchestrator gaps, closed across §1 (plan-actuality) · §2 (cross-umbrella priority) · §3 (auto-launch-table) · §6 (stage-gate-vs-flat-queue). Per-section `> **§7.N binding.**` labels were consolidated here 2026-06-03 (Stage 4 slim); each section's substantive enforcement prose is retained in place.

> **Invocation-channel flag, not a permission.** `disable-model-invocation: true` keeps a skill out of auto-load and out of subagent preload, and stops the Skill tool from invoking it — an explicit `/<name>` from the operator is its only invocation channel, so an agent never self-initiates the procedure. It does **not** seal the file: an agent already asked to do this work may read the SKILL.md and execute its documented steps, and doing so is correct behaviour, not a workaround. On ZCode the flag is not runtime-enforced (absent from the runtime, survey #1699 §5): there the explicit-only channel discipline is prompt-level — this blockquote is the gate, so an agent on ZCode must still treat an explicit /<name> as the only self-initiation channel. <!-- canonical: invocation-channel-flag -->

**Arg routing (V1 binding per [research-patch §3](../../../../docs/meta-factory/research-patches/2026-05-29-meta-orch-no-arg-overview-s0-remainder.md)):** regex check at invocation start — empty → V3 overview; `^[0-9]+$` → V4 top-N (N=0 routes to V3); `list` → preset enumeration via [`helpers/list-presets.sh`](../helpers/list-presets.sh) (§0.1); `status` → read-only status render via [`helpers/render-status.sh`](../helpers/render-status.sh) (§2.6); else → named-umbrella dispatch (existing §1→§3→§4→§5). **Pre-invocation guard (V1 mandatory):** assert no umbrella basename is `^[0-9]+$` (otherwise `/pipeline 1` is ambiguous): <!-- @dual-pair: meta-orchestrator-integer-name-guard -->

```!
bash "${CLAUDE_SKILL_DIR}/helpers/integer-name-guard.sh" --auto
```

**Mode-override flags (optional):** parse `--mode-bundle` / `--mode-pair` / `--mode-solo` / … + `--reason=<text>` from the umbrella arg up-front — `OVERRIDE_MODE` / `OVERRIDE_REASON` output feeds §2.5 Step 5 predicates (`bundle_opt_in` / `review_required`); exit 1 = no flag (normal — routing tree proceeds). Spec: [`references/mode-overrides.md`](mode-overrides.md). <!-- @dual-pair: meta-orchestrator-mode-overrides -->

```!
bash "${CLAUDE_SKILL_DIR}/helpers/parse-override-flags.sh" "${umbrella:-}" 2>/dev/null || true
```

**Preset flag (optional, A4):** the parser above also recognises `--preset <name>` (flag) and `AIF_PIPELINE_PRESET=<name>` (env). Precedence: flag > env > default. When resolved, the preamble output carries `PRESET_MODE` / `PRESET_MARKER` / `PRESET_BUNDLE_OPT_IN` / `PRESET_REVIEW_REQUIRED` / `PRESET_PARALLEL_SAFE` lines. **Seam #3 — marker relay:** when `PRESET_MARKER=<value>` is non-empty (the economy preset), the generated meta-kickoff header MUST carry `<!-- bridge-profile: <value> -->`. The value MUST be the profile's full display name, unique under the resolver's case-insensitive substring match (see [CLAUDE.md «Marker value rule»](../../../../CLAUDE.md)). For null-marker presets (aif/night/sdd — `aif` dispatches on the project's per-mode default profiles) no marker line is emitted. **Seam #2 — routing short-circuit:** see §2.5 Step 5.

**Permissions model:** `allowed-tools` grants pre-approval for the listed tools when the host supports it; it does not exclude other tools. Other commands remain governed by host permissions and session authorization. If the host blocks a required command, report the blocked check and use an authorized alternative or request approval for that command. No global settings change is required by this skill.

## §0.1 `list` verb — preset enumeration (A4)

> Data-driven enumeration of pipeline launch presets. Source-of-truth: the JSON
> files under `references/presets/`. Adding a 5th preset file there surfaces it
> with zero code change (AC-2).

**Step 1 — invoke enumerator:**

```!
bash "${CLAUDE_SKILL_DIR}/helpers/list-presets.sh"
```

**Output shape:** one line per preset, sorted alphabetically:
`<name> — <description> (mode=<mode>[, marker=<marker>])`.

**Escape hatch:** `MO_PRESETS_DIR=<dir>` overrides the presets directory (test
fixtures only).

---
