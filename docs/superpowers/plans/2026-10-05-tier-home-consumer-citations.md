# Task 8 — tier-home consumer reference repair

Decision: mixed Option C: installed paths for ACT-ON instructions; the uniform label **Operator repo only** plus a specific upstream link for source provenance. Keep the routing criteria and required-check precondition unchanged.

Measurement: actual `install.sh ts-server --profile env|factory` deliveries with fake npm/pnpm/yarn, stdin `/dev/null`, no `--full`, both exit 0. Fixtures: `/var/folders/03/tk988ft10_92gfb989p1wrn40000gn/T/task8-cold-delivery-ykovimig/{env,factory}`. Logs beside them.

Pins: HEAD `afd05a71c60f65ee4a20607443764670d743629b`; installer SHA256 `b10e5e3e2b66e38afbbf43f4ad1dca592d2b6655cf32d739e27824f648a2e3d0`; tier source SHA256 `cd7765c267add628bbfc8f17b73e03cc7942cd8fa8250af31f2a0693e1bcd0b2`. Both delivered tier files are byte-identical to source. Y = measured present; N = measured absent; external = capability/service/operator observation, not delivery guarantee.

## All 37 inventory groups

| # | Original path/citation; tier source lines | Env | Factory | Role and chosen treatment |
|---|---|---|---|---|
| 1 | `.ai-factory/tier-home.md`; 1,22,109,117,142 | Y | Y | ACT-ON: canonical installed home, keep local. |
| 2 | `README.md#why-this-exists`; 11 | N in fresh fixture | N in fresh fixture | Consumer-owned goal authority: name the consumer's goal doc without assuming framework anchor/content; not framework goal substitution. |
| 3 | `AGENTS.md`; 119 | Y | Y | ACT-ON installed entry point, keep local. |
| 4 | `AGENTS.md.template`; 21 | N | N | Operator repo only — [template](https://github.com/artyhoo/getff/blob/be8cbed0cdc/packages/core/templates/shared/AGENTS.md.template). |
| 5 | `CLAUDE.md.template`; 22 | N | N | Operator repo only — [template](https://github.com/artyhoo/getff/blob/be8cbed0cdc/packages/core/templates/shared/CLAUDE.md.template); not a delivered root CLAUDE. |
| 6 | Root `CLAUDE.md`, `:104-132`, `:108`, `:130`; 8,28,30-35,90-91,95,160,167,169 | N | N | Operator repo only — [CLAUDE](https://github.com/artyhoo/getff/blob/be8cbed0cdc/CLAUDE.md); ranges are historical lift provenance, never current installed citations. |
| 7 | `.claude/CLAUDE.md` (explicit sibling check) | N | N | Absent from current source too. Do not invent a replacement pointer; actual operator pointer is root `CLAUDE.md at historical lines 112-123`. |
| 8 | `.claude/skills/night-mode/SKILL.md`, aliases `night-mode/SKILL.md`, `:17`, `:19`; 13,39,91-93,98,161,171,173 | Y | Y | ACT-ON: canonical installed path + section names. Current source/delivery each 70 lines; obsolete no-Fable quote must not claim present fidelity. |
| 9 | `.claude/skills/orchestrator/SKILL.md`; 39; bare skill at 44 | Y | Y | ACT-ON: retain canonical local path. |
| 10 | `.claude/skills/arch/SKILL.md`, `/arch §3`; 47,55,72,188 | Y | Y | ACT-ON: retain canonical local path; preserve routing exception and required-check precondition. |
| 11 | `/dispatcher §2.4`, `§2.5`; 68 | N | Y | ACT-ON only at factory: canonical `.claude/skills/dispatcher/SKILL.md`; env rework stays in-session. |
| 12 | `attention-is-not-a-mechanism.md §1`; 37 | N | N | Operator repo only — [rule](https://github.com/artyhoo/getff/blob/be8cbed0cdc/.claude/rules/attention-is-not-a-mechanism.md). Link provenance, keep decision criterion. |
| 13 | `packages/core/principles/49-executor-tier-parity.test.ts`; 39 | N | N | Operator repo only — [parity test](https://github.com/artyhoo/getff/blob/be8cbed0cdc/packages/core/principles/49-executor-tier-parity.test.ts). |
| 14 | `packages/runtime-bridge`; 70,90,169,189 | N | N | Split role: runtime capability for ACT-ON; Operator repo only — [implementation](https://github.com/artyhoo/getff/tree/be8cbed0cdc/packages/runtime-bridge). Actual factory vendor home is `.claude/vendor/runtime-bridge/`. |
| 15 | `kickoff.ts`; 70 | N | Y at vendor path | ACT-ON factory inspection: `.claude/vendor/runtime-bridge/src/kickoff.ts`; source provenance [implementation](https://github.com/artyhoo/getff/blob/be8cbed0cdc/packages/runtime-bridge/src/kickoff.ts). |
| 16 | Bare `AifHandoffBackend.ts`; 70,91 | N | Y at vendor path | ACT-ON factory inspection: `.claude/vendor/runtime-bridge/src/AifHandoffBackend.ts`; source provenance [implementation](https://github.com/artyhoo/getff/blob/be8cbed0cdc/packages/runtime-bridge/src/AifHandoffBackend.ts). |
| 17 | `packages/runtime-bridge/src/AifHandoffBackend.ts at historical lines 137-141`, aliases `AifHandoffBackend.ts at historical lines 137-141`, `:127-130`; 72 | N at original path | N at original path | Operator repo only — [resolver source](https://github.com/artyhoo/getff/blob/be8cbed0cdc/packages/runtime-bridge/src/AifHandoffBackend.ts). Recorded lines drifted: current method starts 208; exact match 223-226. Prefer method/section references. |
| 18 | `curl … "$RUNTIME_BRIDGE_AIF_URL/runtime-profiles"`; 72 | External | External | ACT-ON only with configured/reachable runtime. Retain command under explicit prerequisite, route absence through §3. |
| 19 | `runtime-bridge/runtime-profiles`; 91-92 | External API | External API | Endpoint/probe target, not root-relative filesystem path; historical C3 target labeling retained. |
| 20 | `setup.d/companions.manifest`; 90 | N | N | Operator repo only — [manifest](https://github.com/artyhoo/getff/blob/be8cbed0cdc/setup.d/companions.manifest). |
| 21 | `docs/superpowers/specs/2026-07-23-beta-program-design.md at historical lines 261`, `:262`, `:262-263`, `:261-263`; 90-93,163,174 | N | N | Operator repo only — [historical spec](https://github.com/artyhoo/getff/blob/be8cbed0cdc/docs/superpowers/specs/2026-07-23-beta-program-design.md); historical ranges explicit. |
| 22 | `docs/meta-factory/research-patches/2026-07-25-beta-a-s1-inventory.md at historical lines 86-94`; 93,176 | N | N | Operator repo only — [historical census](https://github.com/artyhoo/getff/blob/be8cbed0cdc/docs/meta-factory/research-patches/2026-07-25-beta-a-s1-inventory.md). |
| 23 | `.claude/rules/zcode-parity-doctrine.md §2`; 93 | N | N | Operator repo only — [doctrine](https://github.com/artyhoo/getff/blob/be8cbed0cdc/.claude/rules/zcode-parity-doctrine.md). |
| 24 | `plugin/hooks/`, `plugin/hooks/…`; 93,96 | N | N | Operator repo only — [plugin source](https://github.com/artyhoo/getff/tree/be8cbed0cdc/plugin/hooks). Not installed workspace path. |
| 25 | `.claude/rules/…`, `docs/superpowers/specs/…`, `docs/meta-factory/research-patches/…`; 96 | N | N | Operator repo only — specific targets in their individual citations; remove blanket local-path convention. |
| 26 | `https://github.com/artyhoo/getff`; 98 | External | External | Keep repository home, but give specific source links at each provenance reference. |
| 27 | `~/.zcode/cli/agents/`; 93 | External/operator observation | External/operator observation | Historical operator-machine evidence only; point to [recorded census](https://github.com/artyhoo/getff/blob/be8cbed0cdc/docs/meta-factory/research-patches/2026-07-25-beta-a-s1-inventory.md), never assume consumer home. |
| 28 | `.claude/skills/`; 100 | Y | Y | ACT-ON installed skill home, keep local. |
| 29 | `setup.d/30-templates.sh`; 109 | N | N | Operator repo only — [delivery source](https://github.com/artyhoo/getff/blob/be8cbed0cdc/setup.d/30-templates.sh). |
| 30 | `.ai-factory/`; 120 | Y | Y | ACT-ON installed document home, keep local. |
| 31 | `DESCRIPTION.md`, `ARCHITECTURE.md`, `RULES.md`; 121 | Y under `.ai-factory/` | Y under `.ai-factory/` | Canonical installed `.ai-factory/` paths; do not imply root files. |
| 32 | `references/`; 122 | Schematic | Schematic | Historical payload-home convention, not an instruction to read root `references/`. |
| 33 | `.ai-factory/skill-context/tier-home/SKILL.md`; 125 | N, intentional | N, intentional | Explicit rejected Option B history; never promote into consumer action. |
| 34 | `skill-context/{aif-orchestrator-discipline,aif-review,aif-rules-check}/SKILL.md`; 128-129 | Orchestrator N, other two Y | All Y | Canonical `.ai-factory/skill-context/…` examples, with factory-only qualifier for orchestrator discipline. |
| 35 | `packages/core/templates/shared/tier-home.md`; 142 | N at source path | N at source path | Operator repo only — [source](https://github.com/artyhoo/getff/blob/be8cbed0cdc/packages/core/templates/shared/tier-home.md); operational home is group 1. |
| 36 | `ai-laziness-traps.md §2 T10`; 152 | N | N | Operator repo only — [research discipline](https://github.com/artyhoo/getff/blob/be8cbed0cdc/.claude/rules/ai-laziness-traps.md); historical appendix provenance. |
| 37 | `superpowers:subagent-driven-development`; 90 | Not guaranteed by no-`--full` install | Not guaranteed by no-`--full` install | ACT-ON external companion if available; otherwise maintain in-session edit/review fallback. |


## Verification and copy chain

The source template is copied verbatim by setup.d/30-templates.sh into npm env/factory consumer roots; refresh copies the same source. Root operator CLAUDE points to this source. No independent rendered tier document is authored. Distribution copies and required fingerprints are regenerated.

RED: real env delivery against the complete original production preimages produced grep exit 2: root operator context and specification were absent. GREEN requires exact copied bytes, all installed ACT-ON paths at their declared depth, explicit factory-only paths, specific Operator repo only links and the copied grep running from both actual consumer roots. The consumer command inventories installed criteria/posture; the exhaustive four-row finding remains historical source-side evidence, not a fresh independent claim from grepping the table itself.

Falsifiers: an ACT-ON path is absent at its stated profile, a source citation instructs a consumer-local read, or the consumer grep returns nonzero/partial error output. External runtime availability remains an explicit prerequisite; installed vendor bytes do not prove runtime reachability.

Cold review recovered the independent pre-pointerization operator context at c9281664aff48b2b91300a30ca023a3018ba3ca4. Historical lift/census links use that revision; the current pointer uses the measured source revision.
