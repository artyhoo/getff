# KICKOFF — plugin-skills-generator (RESEARCH-FIRST, ZCode-first, multi-stage)

<!-- scope:plugin-skills-generator -->
<!-- Operator directives 2026-09-11 (verbatim, load-bearing):
     «делай в первую очередь для z.code — для клод кода потом проверим и исправим если что»
       → Stage 3 (ZCode) is merge-blocking; Stage 4 (CC) is documented but DEFERRED.
     «после сжатия контекста перепроверишь все сначала тщательно [кикоф, план работы и фикса]
       и затем только исправишь» → Stage 0 re-verification is a MANDATORY gate before any fix.
     «отправь всю работу в аиф диспетч» → execution runs through the aif dispatcher
       (/dispatcher plugin-skills-generator), not ad-hoc edits. -->

> **Authoritative for:** this umbrella's goal, stage plan, acceptance criteria, and process constraints.
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists).
> Prior art on the parity background — survey #1699 (`.claude/rules/zcode-parity-doctrine.md`, research-patch 2026-09-10-zcode-full-parity-rphase-survey.md).
> **Base branch:** `staging`. **Rigor label (L0):** `build-and-verify` — Stage 1–3 artefacts are
> reversible, and Stage 3 verifies them live on the destination harness (ZCode).

## §0 Why this umbrella exists

The plugin channel (`plugin/`, consumed live via `.claude-plugin/marketplace.json` → `"source": "./plugin"`)
is the ONLY skills-delivery channel that reaches ZCode consumers: the installer has zero `.zcode`
awareness (verified 2026-09-11: `grep -rn "\.zcode" setup.d/ install.sh` → empty) and everything it
writes under `.claude/` is invisible to ZCode (survey #1699 §5). Yet `plugin/skills/` today carries
4 hand-maintained entries, one of which (`tool-bootstrapping`) is a DEEP hand-adapted fork — different
header, different section structure (`diff .claude/skills/tool-bootstrapping/SKILL.md
plugin/skills/tool-bootstrapping/SKILL.md`) — with NO generator and NO freshness gate anywhere
(`ls scripts/` shows only the hooks/agents twin generator + check-skill-drift). Hand-maintained copies
on a live-consumed channel rot into legacy (operator 2026-09-11: «CC плагин разве не будет
устанавливать легаси?» — it would).

Operator GO 2026-09-11: build the generation pipeline, then ship the CORE four through it, ZCode-first.

## §1 Goals

1. `plugin/skills/*` become DERIVED artifacts — generated from SSOT sources (`.claude/skills/<name>/`)
   via the link-adaptation transform, never hand-copied.
2. A drift gate: regeneration on a clean tree is a no-op; a source edit without regen goes RED at the
   earliest reachable channel — mirroring the hooks-twin contract (`scripts/generate-plugin-twins.sh`).
3. The CORE four ship through the generator: `ai-doc`, `rule-research`, `rule-tests`, `template-audit`
   (the installer's `GETFF_SKILLS_CORE`, `setup.d/lib.sh:61` — already consumer-facing by design and
   mechanically adapted for consumers today via `copy_skill_with_transform` → `transform_internal_refs`).
4. ZCode-first live acceptance (Stage 3); CC verification documented and DEFERRED (Stage 4).

## §2 Stages (sequential; Stage 0 is a mandatory gate before any fix code)

### Stage 0 — R-phase re-verification (MANDATORY — operator directive: re-verify kickoff + plan + fix design FIRST; fix only after)

Re-derive every load-bearing claim with its probe; record outputs in a dated research-patch (§1.7
sections required). Do NOT trust this kickoff's cached claims — that is the point of the stage.

| # | Claim to re-derive | Probe | If falsified |
|---|---|---|---|
| 0.1 | Nothing today derives or gates `plugin/skills/` | `ls scripts/`; `grep -rn "plugin/skills" scripts/ tests/ packages/core/` | a hit → fold it in (build-vs-reuse §1.1), do not build parallel |
| 0.2 | Marketplace consumes `plugin/` live from the branch | `cat .claude-plugin/marketplace.json` | source ≠ ./plugin → channel model changed, revisit §0 |
| 0.3 | tool-bootstrapping is a 3-population hand fork | diff `.claude/skills/` vs `skills/` vs `plugin/skills/` copies | plugin copy byte-derivable by the transform → reconcile to generated in Stage 1 |
| 0.4 | The transform suffices per CORE-four skill (link-only adaptation) | per SKILL.md: `grep -nE "\]\(\.\./|\.claude/|docs/|packages/" ` → classify each ref mechanical vs prose | any skill needing PROSE adaptation → DECISION-NEEDED fork; never silently adapt |
| 0.5 | dist / baseline blast radius | `grep -c "plugin/skills" packages/getff/MANIFEST.sha256`; `ls tests/install-sh/baselines/` | plugin/skills inside dist or baselines → regen/capture steps join Stage 2 gates |
| 0.6 | ZCode plugin update mechanics | inspect `~/.zcode/cli/plugins/cache/getff/` layout + `plugin.json` version fields | version-pinned cache → version bump becomes a Stage 2 step; else document the refresh path |
| 0.7 | ai-doc's special refs | `grep -nE "superpowers|residue" .claude/skills/ai-doc/SKILL.md` | plugin-provided skill refs (superpowers) are FINE on the plugin channel; repo-only file refs need the blob-URL rewrite — enumerate both |

Deliverable: research-patch with the verdict matrix + surfaced forks. STOP at forks — surface as
DECISION-NEEDED with a recommendation; do not decide.

### Stage 1 — the generator (capability commit; build-vs-reuse verdict mandatory, `Prior-art:` trailer required)

1. Build-vs-reuse consult (SSOT + prior-art-evaluations): extend `scripts/generate-plugin-twins.sh`
   with a third population vs a sibling `scripts/generate-plugin-skills.sh`. Record the verdict.
2. Transform reuse: `transform_internal_refs` lives in `setup.d/lib.sh` (installer scope) —
   extraction vs sourcing is a single-source design call (dual-implementation-discipline §7); record it.
3. Contract (mirrors the hooks-twin lessons, `scripts/generate-plugin-twins.sh` header):
   derive `plugin/skills/<name>/` from `.claude/skills/<name>/` + link transform; clobber-guard that
   refuses to overwrite content neither the working-tree nor the HEAD source reproduces (the
   #1044/#1442 Stage-9C silent-loss class); `@plugin-skills: manual — <rationale ≥20 chars>` escape
   hatch; regeneration is a no-op on a clean tree.
4. Drift gate at the earliest reachable channel: pre-commit arm (source touched → derived copy must
   regen clean) + population-wide CI backstop.
5. tool-bootstrapping disposition: derive if 0.3 says derivable; else declare manual with rationale.
   Never silently delete the hand-fork.

### Stage 2 — CORE four through the generator

1. Generate `plugin/skills/{ai-doc,rule-research,rule-tests,template-audit}`; review each diff:
   adaptation must be LINK-ONLY — prose divergence beyond links = the 0.4 fork, surface it.
2. Version bump `plugin.json` + `marketplace.json` if 0.6 requires it.
3. Gates: `bash scripts/build-getff-dist.sh` (MANIFEST diff = only expected entries);
   `SNAPSHOT_MODE=capture bash tests/install-sh/snapshot.sh` if 0.5 moved fingerprints;
   `bash scripts/check-skill-drift.sh`; `make self-audit`; PR body Fidelity + §1.7
   (formats: `FIDELITY: skipped — <rationale>` for operator-direct work;
   `### §1.7 Forward-check applied` / `### §1.7 Backward-check applied`, file:line citations).

### Stage 3 — ZCode-FIRST acceptance (merge-blocking; CC explicitly NOT required — operator 2026-09-11)

1. All Stage 2 gates green.
2. Live ZCode: plugin cache refreshed to the new version; the four skills appear in a live session's
   skill list; slash-invocation resolves via the Skill tool (mechanism: survey #1699 §11.1).
3. `bash scripts/probe-zcode-runtime.sh` still 17/17.
4. Evidence (commands + outputs) recorded in the Stage PR body.

### Stage 4 — CC verification requirements (DEFERRED; owner-scheduled; NOT executor work)

Documented so the owner can dispatch later — «для клод кода потом проверим и исправим если что»:

1. CC plugin install path: `/plugin marketplace add artyhoo/getff` + `/plugin install getff@getff` —
   the four new skills listed and invocable on CC.
2. Namespacing coexistence: plugin `getff:<name>` vs installer-copied `.claude/skills/<name>` on the
   same consumer — both discoverable, no shadowing.
3. tool-bootstrapping disposition visible on CC (generated diff vs the old hand-fork reviewed, or the
   manual marker + rationale present).
4. CC marketplace cache picks the bumped version.
5. dist + install-sh baselines stable on CC-shaped CI (confirm, no action expected).

## §3 Dependencies

Stage 0 → 1 → 2 → 3 strictly sequential; Stage 4 is external (owner). No fix code before the Stage 0
research-patch is merged.

## §4 Acceptance criteria (umbrella done when)

- [ ] Stage 0 research-patch merged (verdict matrix + forks surfaced or resolved).
- [ ] Generator + drift gate merged (`Prior-art:` trailer present).
- [ ] CORE four live on the plugin channel, derived not copied; regen no-op proven on a clean tree.
- [ ] ZCode-first acceptance evidence recorded (cache refresh + skill listing + slash-invocation +
      probe 17/17).
- [ ] CC requirements documented (§2 Stage 4) and handed to the owner.
- [ ] Every PR carries Fidelity + §1.7 with file:line; `make self-audit` green.

## §5 ATTN escalation triggers (surface as DECISION-NEEDED, never decide silently)

Any 0.4 prose-adaptation need; tool-bootstrapping non-derivability (0.3); generator placement fork
(extend vs sibling); transform extraction fork (Stage 1 item 2); ZCode cache-mechanics surprise (0.6).

T-traps active ([ai-laziness-traps.md §2](../../../.claude/rules/ai-laziness-traps.md)):
T3 (every §0 claim carries its probe — no prose-only findings), T9/T10 (full population: all four
CORE skills probed individually in 0.4, never sampled), T16 (per-skill derivability is PROBED, not
pattern-matched from the «skill» label), T20 (evidence before verdict — Stage 0 precedes any build).

## §6 Non-goals

- No factory-suite on the plugin channel (plugins have no profile gating — dead-end triggers for
  consumers without the aif runtime).
- No installer changes; no env-tier additions (arch/reviewer/pipeline/orchestrator/night-mode) — a
  separate fork if wanted later.
- No plugin agents work (diagnosticOnly on ZCode, survey #1699 §5).
- No CC fix pass inside this umbrella — Stage 4 is documentation only.

## §7 Operator decisions already made (do not re-litigate)

- ZCode-first; CC deferred but documented (2026-09-11).
- Re-verify-before-fix post-compaction process (2026-09-11) — Stage 0.
- Execution via the aif dispatcher (2026-09-11).
- self-reflection stays unshipped (PARKED — product/fabl design decision, not agent work).
- story stays factory-only (PR #1715); the CORE four are the extension set.

## §8 Host verification

```bash host-verify
# The kickoff's own premises, verifiable on any staging-synced checkout (Stage 0 re-runs these
# and more — this fence is the one-shot minimum a host can run before dispatch):
grep -rn "\.zcode" setup.d/ install.sh                                   # → empty: installer is CC-shaped (§0)
cat .claude-plugin/marketplace.json                                      # → "source": "./plugin" (live channel, §0)
ls scripts/                                                              # → no plugin-skills generator exists today (0.1)
diff -q .claude/skills/tool-bootstrapping/SKILL.md plugin/skills/tool-bootstrapping/SKILL.md  # → differ: hand fork (0.3)
grep -c "plugin/skills" packages/getff/MANIFEST.sha256                   # dist blast radius (0.5)
bash scripts/probe-zcode-runtime.sh                                      # → 17/17: ZCode runtime oracle (Stage 3)
```
