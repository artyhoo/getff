# CC plugin packaging — decisions log (advisor seat, beta-release night run 2026-09-02/03)

> **Authoritative for:** post-plan decisions on the plugin payload (`plugin/skills/` set membership) recorded by the advisor seat on consult asks — entry shape per session-bus v2 §4.
> **NOT authoritative for:** the plugin design — see the [spec](../specs/2026-06-22-cc-plugin-packaging-design.md); the plan itself — [2026-06-22-cc-plugin-packaging.md](2026-06-22-cc-plugin-packaging.md); project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists).

Per `.claude/skills/night-mode/SKILL.md` delta items 1 + 8 and [advisor-pattern-design §3](../specs/2026-08-10-advisor-pattern-design.md) invariant 1: an ask answered by the advisor seat gets its decision package recorded HERE before any application. The asker applies (concept-level answers only).

## Decision 1 — `tool-bootstrapping` ships in the plugin; the plan's m1 trigger has fired

**Ask:** `session-bus/asks/2026-09-03-dispatcher-plugin-skill-payload.md` (dispatcher seat, worktree `elastic-hypatia-75abc5`, class `consult`). Question: is the three-skill plugin payload intent or drift, given the spec contradicts itself (payload tree `2026-06-22-cc-plugin-packaging-design.md:69-72` = three skills; triage table `:104` = `rules-as-tests, tool-bootstrapping`) and the plan pre-decided m1 (`2026-06-22-cc-plugin-packaging.md:135`: «`tool-bootstrapping` stays OUT of v1 (promote to a follow-up only if a need surfaces)»).

**Decision package (evidence, file:line, measured 2026-09-02/03).**

1. The plugin ships the `deps-hash-check` hook: `plugin/hooks/hooks.json:32`, twin generated from `.claude/hooks/deps-hash-check.sh`.
2. That hook emits «… — run /tool-bootstrapping to re-evaluate» on every manifest change — source `.claude/hooks/deps-hash-check.sh:298` (`_emit_warn`), twin `plugin/hooks/deps-hash-check:299` (the generator injects one header line). A plugin user is therefore instructed to run a skill the plugin does not ship — a shipped instruction that cannot execute, the failure class [README.md#why-this-exists](../../../README.md#why-this-exists) names (same class as issues 1439/1535).
3. Everything that produced the need postdates m1 (plan dated 2026-06-22): tool-bootstrap layer revived 2026-06-26 (#724); deps-hash hooks DH-S1…S3 in July (#1024, #1029, #1070); twin generation into `plugin/hooks/`.
4. Portability: `skills/tool-bootstrapping/` = 3 files / 163 lines, zero `](../…)` links; one prose mention of `setup.d/05-mcp.sh` (`SKILL.md:49`, descriptive); open issue #1507 is a degradation the skill already states honestly.
5. `rule-research/SKILL.md:24` («run `./setup --full`») and `rule-tests/SKILL.md:23` (`packages/core/backends/*`) are installer-bound by their own text.
6. `plugin/skills/` has no generator; principle 24 (`packages/core/principles/24-plugin-manifest-integrity.test.ts`, 301 lines) checks frontmatter only. `plugin/skills/getff` already differs from `skills/getff` in **6 of 6** files (`diff -rq`, measured 2026-09-03 by the asker; the advisor's first count of 5/6 was wrong).

**Options.** A — ship `tool-bootstrapping` only; correct `:69-72` to match `:104`. B — A plus `rule-research` + `rule-tests` (both arrive with dangling internals; two agent twins needed). C — ratify the narrow payload; correct `:104` instead.

**Decision: A, with two conditions.** Ship `tool-bootstrapping` in `plugin/skills/`; correct the payload tree (`:69-72`) to match the triage table (`:104`) and note «m1 trigger fired: the plugin ships `deps-hash-check`, which names the skill»; define «consumer-facing skills» in `plugin/README.md:18` as {getff, tool-bootstrapping} plus the two plugin-native skills. B is rejected on honesty (items 5). C was the advisor's first answer (2026-09-02 22:15Z) and is superseded — it read the plan, not the shipped hook.

Conditions: (i) the shipped copy's `SKILL.md:41` must be channel-neutral (the hook arrives via the plugin's `hooks.json`, not «configured in `.claude/settings.json` after Wave 5.3 install»); because condition (ii) enforces identity with the source, the neutral wording lands in `skills/tool-bootstrapping/SKILL.md` as well. (ii) **Drift guard, required:** extend principle 24 with an identity check `plugin/skills/<name>` vs `skills/<name>` **after normalising the depth prefix** of relative links (`](../../` → `](../../../`) — the plugin copy sits one directory deeper, so byte-identity is unsatisfiable by construction (the mirror of the agent-twin depth constraint recorded in #1582, `scripts/generate-plugin-twins.sh:21-32`). `getff` is quarantined in the guard with the incident named in code; its stale content (names `/aif-verify` + `rules-sidecar`, lacks the `/rule-research` / `/rule-tests` line) is a separate finding for the operator, out of this ask's scope. The guard is an edit to an existing file, so it is NOT a capability commit (`packages/core/hooks/checks/prior-art.ts:142` triggers on a NEW file ≥80 LOC) — the advisor's «≤80 LOC or capability commit» caveat in the ask is retracted.

**Rationale.** A plan-time pre-decided line with a trigger clause is valid only while its trigger has NOT fired; the trigger here fired inside the plugin payload itself, so shipping the skill restores spec/implementation/hook agreement at the cost of 3 copied files. Adding a second hand-copied skill without a guard would double a live drift surface (item 6), hence (ii) is a condition, not a nicety.

**Falsifier.** Wrong if the plugin channel is retired before phase 3 — then remove `deps-hash-check` from `plugin/hooks/` instead (the hook without the skill is the defect either way); or if the measured plugin-user population is zero at phase-3 entry AND the hook is dropped — then C.

**Reversibility.** Type-2: docs + payload copy + one principle test; undo = revert the stage PR on staging (three files return to the pre-A tree; no consumer install path changes, the installer already ships the skill).

**decided-by:** advisor seat (`beta-release-plan-c20d1e`), consult class, on a reversible docs+payload surface; no installer, no floor object. Revision C→A prompted by the operator's challenge («June is long ago») in the advisor session, 2026-09-02 22:21Z; corrections (line :298/:299, 6/6 drift, depth-normalised guard, capability-commit caveat retracted) from the asker's pre-implementation verification, 2026-09-03.

**status:** applied — stage PR by the asker (branch `docs/plugin-payload-m1-ratified`; PR number recorded here on harvest).
