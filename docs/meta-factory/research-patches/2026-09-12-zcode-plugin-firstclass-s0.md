<!-- scope:zcode-plugin-firstclass -->
<!-- Stage 0 (R-phase) of the zcode-plugin-firstclass umbrella — kickoff merged to staging via
     #1721. Re-derives every load-bearing kickoff claim with fresh probes (T3) before any fix
     code. Forks A-D are SURFACED here, decided in the Stage 1 decision pack. -->

# zcode-plugin-firstclass Stage 0 — re-verification probes 0.1–0.8

> **Authoritative for:** the 2026-09-12 re-verification evidence behind this umbrella's forks A–D — manifest slot, publication channel, doctrine row-3 twin, README shape; plus the mechanical corrections to the kickoff's cached claims (§3 findings F1–F7).
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists). Hook-census classifications — [zcode-parity-doctrine.md §2](../../../.claude/rules/zcode-parity-doctrine.md) is the SSOT; this patch feeds it, never overrides it. Fork decisions — the Stage 1 decision pack + owner calls.

## §1 Scope and method

- REPO probes run in the aif container against `origin/staging` = `aa87d0a47a6d8502f983cc9fe7284bd5dcb3d650` (fetched fresh 2026-09-12: `git fetch origin staging` → rc=0; `FETCH_HEAD == origin/staging == HEAD` verified at probe time — all three `aa87d0a47a…`; the HEAD equality holds for the probe moment only (once this patch landed, HEAD became its own commit, as any R-phase deliverable does)). Probes quoted verbatim; verdict form per T3: CONFIRMED / FALSIFIED / INCONCLUSIVE-needs-HOST.
- HOST probes (0.7, 0.8) touch the live ZCode client / `~/.zcode`. This container has neither: `ls ~/.zcode` → `No such file or directory` (rc=2); `command -v zcode` → no binary. Per the kickoff honesty rule (T5-class) they are RECORDED as requests (§5), never simulated. The kickoff's 2026-09-11 HOST quotes are carried forward as dated quotes, flagged wherever a decision leans on them.
- No source files were edited during R-phase (T5); this document is the deliverable.

## §2 Verdict matrix

| # | Kickoff claim | Probe (verbatim) | Observed output (verbatim) | Verdict |
|---|---|---|---|---|
| 0.1 | Only `plugin/.claude-plugin/plugin.json` exists; `.zcode-plugin/` absent everywhere | `git ls-tree -r origin/staging --name-only \| grep -E 'zcode-plugin\|claude-plugin'` | 5 hits, none `.zcode-plugin/`: `.claude-plugin/marketplace.json` (repo-root CC marketplace manifest), `plugin/.claude-plugin/plugin.json`, `tests/fixtures/plugin-broken-manifest/{.claude-plugin/marketplace.json, plugin/.claude-plugin/plugin.json}`, kickoff path | **CONFIRMED** (with nuance: the marketplace manifest lives at repo ROOT, not under `plugin/` — it is what a consumer's marketplace-add consumes; `strict: true`, plugin source `./plugin`) |
| 0.2 | README documents the CC one-liner, no ZCode consumer path | `grep -n "marketplace add" README.md`; `grep -n -i zcode README.md` | `142:/plugin marketplace add artyhoo/getff` (rc=0); zcode hits are compat prose only (:271, :275, :276) + the stale Wave B line (:285) | **CONFIRMED** |
| 0.3 | Row-3 twin absent; Wave B merged (README :285 stale) | `git ls-tree origin/staging plugin/hooks/ \| grep check-doc-authority-header`; `git log origin/staging --oneline \| grep -E '#1043\|#1044\|#1046\|#1047'` | grep → rc=1 (absent; `check-doc-authority` twin IS present). Log → all four PRs found: `e6d6257844 …(#1043)`, `db6ce7f0c8 …(#1044)`, `52f6b8485c …(#1046)`, `0151ff4eda …(#1047)` | **CONFIRMED** — README:285 «implementation-pending» is stale against doctrine §3 |
| 0.4 | Generator contract covers a new hook twin mechanically | `sed -n '1,236p' scripts/generate-plugin-twins.sh`; spec file check | Header comment is the contract — spec `.ai-factory/plans/zcode-parity-s6-twin-generator.md` is NOT tracked and NOT on disk (`git ls-files \| grep zcode-parity-s6` → rc=1; `ls` → no such file), exactly as the kickoff anticipated. Identity/sed/manual modes via `# @plugin-transform:`; source has NO marker → identity mode | **CONFIRMED, with two mechanical corrections** → §3 F1/F2 |
| 0.5 | Installer has zero `.zcode` awareness | `grep -rn "\.zcode" setup.d/ install.sh` | rc=1, zero matches | **CONFIRMED** — the plugin channel is the only ZCode reach |
| 0.6 | plugin.json declares no explicit arrays | `git show origin/staging:plugin/.claude-plugin/plugin.json` | name `getff`, version `0.2.0`, description/author/homepage/repository/license/keywords only — no commands/skills/hooks/agents arrays | **CONFIRMED** — convention discovery; the commands-reachability probe (Stage 3) keeps its kickoff shape |
| 0.7 | HOST: ZCode plugin-subsystem facts (manifest probe order; `+` accepts GitHub repo; source kinds; agents record-not-execute; pitfall-9) | HOST: read `~/.zcode/cli/plugins/cache/zcode-plugins-official/zcode-guide/*/skills/diagnosing-plugins/SKILL.md` | cannot run here (no ZCode) | **INCONCLUSIVE-needs-HOST** → request §5; kickoff's 2026-09-11 dated quotes carried forward |
| 0.8 | HOST: registration still the local-directory dev snapshot | HOST: `cat ~/.zcode/cli/plugins/known_marketplaces.json` | cannot run here | **INCONCLUSIVE-needs-HOST** → request §5 |

## §3 Findings beyond the kickoff (new, load-bearing for Stage 1/2)

**F1 — `plugin/hooks/hooks.json` is renderer-emitted; the registration edit is NOT a hooks.json hand-edit.** `scripts/render-harness-config.mjs:287` states emitPlugin is the «single source of truth for plugin/hooks/hooks.json (no read-modify-write of the existing file — pure derivation, drift-gated)». Two registration arms exist: (a) model-derived — `.ai-factory/harness-model.json` (tracked; verified: `git ls-files .ai-factory/` lists it) commands of the form `bash "$CLAUDE_PROJECT_DIR/.claude/hooks/<name>.sh"` are translated to `"${CLAUDE_PLUGIN_ROOT}/hooks/run-hook.cmd" <name>` ([render-harness-config.mjs:436 emitPlugin](../../../scripts/render-harness-config.mjs)); this is how row 4 `check-doc-authority` reaches `plugin/hooks/hooks.json:81` (it IS registered in the model/settings). (b) `PLUGIN_INTERNAL_HOOKS` ([render-harness-config.mjs:290](../../../scripts/render-harness-config.mjs)) — for consumer-facing hooks deliberately NOT in the framework model; the shipped precedent is exactly this shape: `inject-project-digest` + `inject-output-language`, whose comment says they «are not model-derived; on ZCode they reach consumers ONLY via this plugin channel». `check-doc-authority-header` is the same shape: the framework dogfoods `check-doc-authority` (settings.json:114) and must NOT run the consumer reimplementation on itself — so the twin's registration belongs in `PLUGIN_INTERNAL_HOOKS` under `PostToolUse` (matcher `Edit|Write|MultiEdit`, mirroring hooks.json:81), followed by `node scripts/render-harness-config.mjs --write` to regen. The drift gate is [`packages/core/hooks/harness-config-drift.test.ts`](../../../packages/core/hooks/harness-config-drift.test.ts) (N3: a hook added to settings.json bypassing the SSOT → `--check` exit 1). **Corrects the plan's «hooks.json:81-style entry» phrasing: 6 sync points, not 4 — (1) renderer registration + regen, (2–4) doctrine §2 row 3 + rollup + §4 row 3, (5) §5 recount (F6 mechanics), (6) `POST_MUTATION_GATES` (F8).**

**F2 — the clobber guard forbids a naive stub.** `guard_identity_clobber` ([generate-plugin-twins.sh:96-130](../../../scripts/generate-plugin-twins.sh)) refuses (exit 3) to overwrite an existing twin whose content matches NEITHER the working-tree render NOR the HEAD render — a fresh empty stub matches neither, so stub-then-generate as literally planned would trip it. The mechanically correct seeding is the twin's exact identity render (source shebang line 1 + the AUTO-GENERATED header as line 2 + source body), `chmod +x` (the generator's redirect preserves mode; it never sets it; existing twins are 100755). The generator then verifies in-sync (first guard branch) and the twin-generation test pins byte-identity.

**F3 — a staleness cluster around the Compatibility prose (fork-D scope, all probed):**
- README:274 says CC coverage is «all 20 hooks»; live count is **22**: `ls .claude/hooks/*.sh | wc -l` → `22` (matches doctrine §2 total = 22 rows).
- README:275 says «Three CC-only events (`SubagentStart`, `SubagentStop`, `WorktreeCreate`)»; the doctrine (§2 rows 21-22 + [the 2026-09-10 S-verify patch](2026-09-10-zcode-compaction-hook-verification.md)) carries **four** (adds `PreCompact`).
- Doctrine §5 CC row (:117) says «all 21 hooks» — also stale against the live 22.
- Doctrine §2 row 3 (:45) cites `setup.d/10-skills.sh:246` for the installer path; the copy+register now lives at `setup.d/10-skills.sh:332-342` (`DAH_SRC`/`DAH_DST` + `register_cc_hook … "Edit|Write|MultiEdit"` — verified by grep). Line-number drift, claim intact.
- README:285 Wave B «implementation-pending» — stale, confirmed independently of the kickoff (§2 probe 0.3).

**F4 — sibling hard gate UNMET at Stage 0 time; container probe honesty.** `git ls-tree origin/staging .claude/orchestrator-prompts/plugin-skills-generator/` → `kickoff.md` only, **no `done.md`**. `gh pr list …` → unauthenticated in-container (rc=4, `gh auth login` required) → the kickoff's PR-level alternative gate check is PROBE-INCOMPLETE here; `git ls-remote --heads origin | grep -E 'zcode-plugin-firstclass|plugin-skills'` → rc=1 (no sibling implementation branch visible at git level). Verdict: Stage 2 parks `blocked_external` unless the sibling merges before Task 3 runs. (This container's git read-egress to github.com WORKS — fetch succeeded — so the done.md check stays runnable at Task 3 time after a fresh fetch.)

**F5 — `plugin/` is not in the getff dist payload.** `grep -c "plugin/hooks" packages/getff/MANIFEST.sha256` → `0`; the assembler's `PAYLOAD` list ([build-getff-dist.sh:38-41](../../../scripts/build-getff-dist.sh)) has no `plugin` root. The twin + README edits cannot drift the dist; `build-getff-dist.sh --check` runs as an untriggered sanity gate only.

**F6 — §5 recount mechanics: the doctrine's own command has drifted under it (`lib/`).** Verbatim, 2026-09-12, in the session worktree (`git diff --name-only origin/staging..HEAD` → the two research-patch docs only, so `plugin/hooks/` here ≡ `origin/staging`):

```
$ ls plugin/hooks/ | grep -vE '^_zcode-emit|^hooks.json|^lang|^run-hook.cmd|^session-start' | wc -l
17
$ ls plugin/hooks/ | grep -vE '^_zcode-emit|^hooks.json|^lang|^run-hook.cmd|^session-start|^lib' | wc -l
16
```

The doctrine :118 recount pattern deliberately excludes plugin-intrinsic `session-start` (no `.claude/hooks` source) but does NOT exclude the `lib/` helper directory (`lib/hook-emit.sh`, landed in #1628 — after :118 was written): the doctrine's inline command prints **17 today** (16 framework twins + `lib/`) while the doctrine prints **16** — the :118 count-vs-command pair is ALREADY latently stale, independent of this umbrella. Corrected prescription for the Stage 2 §5 recount: add `^lib` to the :118 exclusion (a one-pattern command change riding the kickoff-directed doctrine sync); under the corrected command the count goes 16 → **17** when row 3 lands, and **17 is what the Stage 2 executor writes** — count, inline command, and the §2 census rows (16 twins + row 3) then all agree. Rejected alternative: keep the `ls` command unchanged and write **18** — rejected because the census would then count a non-twin helper directory and disagree with the §2 table rows it summarizes. Falsifier: if Stage 2's fresh run of the unchanged command does not print 17 (or the `^lib` variant 16), this pre-pin is stale — re-run and write only a count the inline command actually prints.

**F7 — the 17/17 ZCode runtime oracle is HOST-side by design.** [`scripts/probe-zcode-runtime.sh`](../../../scripts/probe-zcode-runtime.sh) exits 0 SKIP when `/Applications/ZCode.app/Contents/Resources/glm/zcode.cjs` is absent (verified absent here), and its vitest wrapper pins 17 assertions. Stage 3 evidence therefore comes from the HOST run, not the container.

**F8 — renderer advisory-only note must grow the new hook (discovered backward-sweeping F1).** `POST_MUTATION_GATES` ([render-harness-config.mjs:202-206](../../../scripts/render-harness-config.mjs)) enumerates the PostToolUse gates that are ADVISORY-ONLY on ZCode (schema `Uan` rejects `permissionDecision` for PostToolUse): `check-doc-authority`, `check-hook-marker`, `check-kickoff-traps`, `check-worker-dispatch-channel`. Once `check-doc-authority-header` is plugin-registered it is a fifth post-mutation gate — omitting it makes the renderer's loud-degradation note incomplete. Sync point 6 (renderer, same commit as F1's registration).

## §4 Population enumeration (T10 — full plugin surface, no sampling)

`find plugin -type f | sort` → 42 files across 7 classes. ALL classes are dispositioned in Stage 3 (T9/T10); none sampled:

| Class | Population (verbatim) | ZCode reachability disposition |
|---|---|---|
| Manifest | `plugin/.claude-plugin/plugin.json` (fallback slot; `.zcode-plugin/` preferred slot unused — probe 0.1) | Fork A |
| Skills | 4 dirs = current `M1_SET` (`getff`, `installing-enforcement`, `tool-bootstrapping`, `using-getff`) — sibling-owned, untouched here | VERIFIED live (HOST 2026-09-11 quote: all four in a live session's skill list); Stage 3 re-verifies |
| Commands | 1: `plugin/commands/install-enforcement.md` | UNVERIFIED on ZCode — Stage 3 probes; disposition note if unreachable |
| Agents | 3: `compliance-verifier`, `living-docs-auditor`, `review-sidecar` | record-not-execute per zcode-guide (HOST quote 2026-09-11) — disposition note only (non-goal §6) |
| Hooks | 17 hook scripts in `plugin/hooks/` (16 doctrine-counted framework twins + plugin-intrinsic `session-start`) + helpers (`hooks.json`, `run-hook.cmd`, `_zcode-emit`, `lang/` ×3, `lib/hook-emit.sh`) | row-3 twin is THIS umbrella's payload gap; the rest live via the plugin channel (doctrine §5) |
| Install helper | `plugin/install/fetch-and-wire.sh` (the `/getff:install-enforcement` fetch path) | rides the command's reachability probe |
| Docs | `plugin/README.md` (30 lines; no per-hook enumeration — grep shows only the generic `hooks/` dir line :17 → no sync needed for the twin) | swept clean |

## §5 HOST-probe requests (dispatcher loop runs; outputs land in the task comment / PR)

```bash host-verify
# 0.7 — ZCode plugin-subsystem authority (re-quote with path + date before Fork A/B use):
cat ~/.zcode/cli/plugins/cache/zcode-plugins-official/zcode-guide/*/skills/diagnosing-plugins/SKILL.md
#   Quote: manifest probe order (.zcode-plugin → .claude-plugin → .codex-plugin); Discover-tab `+`
#   accepted inputs; marketplace.json plugins[].source kinds; agents record-not-execute; pitfall-9
#   version/update detection (record AND manifest carry the source revision).

# 0.8 — current registration state (never modify; read-only):
cat ~/.zcode/cli/plugins/known_marketplaces.json
cat ~/.zcode/cli/plugins/installed_plugins.json
#   Quote: marketplace id + source kind + path for `getff`; installed plugin id + version.
```

## §6 Forks surfaced (DECISION-NEEDED — evidence here; recommendations decided in the Stage 1 pack)

- **Fork A — manifest slot** (single-source `.claude-plugin/plugin.json` vs add `.zcode-plugin/` twin). Evidence: 0.1 (fallback slot only), 0.7-needs-HOST (probe order). DECISION-NEEDED.
- **Fork B — publication channel** (GitHub marketplace verify+document vs zcode-plugins-official submission ask vs sequenced). Evidence: 0.2 (nothing documented), root `.claude-plugin/marketplace.json` shape, 0.7-needs-HOST (`+` accepts a GitHub repo). Submission leg = owner credentials → owner decision regardless.
- **Fork C — row-3 twin** (ship via generator + renderer registration vs stay plugin-gap). Evidence: 0.3 (twin absent), F1 (registration mechanics), F2 (seed mechanics), doctrine :109 («a Stage 6 follow-up would ship the missing twin»). DECISION-NEEDED.
- **Fork D — README shape** (ZCode install block + Compatibility sync). Evidence: 0.2, F3 staleness cluster. DECISION-NEEDED.

## §7 §1.7 self-review

**Forward-check applied** — this R-phase artefact against the disciplines it invokes:

- `language-discipline.md`: «quoting» register, verbatim probe outputs, «» quotes. ✓
- `phase-research-coverage.md §1.7` (T21): backward-check below is in enumeration format with grep evidence per surface. ✓
- `doc-authority-hierarchy.md §5`: research-patches/ folder-level authority; scope marker carried in the HTML comment. ✓
- T3: every §2/§3 claim carries command + verbatim output, or an explicit INCONCLUSIVE-needs-HOST. ✓
- T5: zero source-file edits during R-phase — deliverable is this markdown. ✓
- T9/T10: §4 enumerates ALL 7 plugin classes before any Stage 3 disposition claim. ✓
- T11 (build-vs-reuse SSOT consult, planning-time): SSOT keyword sweep, runnable form. Full-row-text: `grep -E '^\| *[0-9]+ *\|' docs/meta-factory/prior-art-evaluations.md | grep -icE 'zcode|plugin|marketplace'` → `62` rows (mostly the generic word «plugin»). `zcode`-narrowed: `grep -E '^\| *[0-9]+ *\|' docs/meta-factory/prior-art-evaluations.md | grep -iE 'zcode' | awk -F'|' '{gsub(/ /,"",$2); printf "#%s ", $2}'` → `#200 #220 #234` — **none covers a ZCode consumer install path, marketplace publication, or manifest-slot decision**: #200 is the AI-agent-config-sync-family row recording THIS repo's harness-config renderer (the very surface Stage 2's `PLUGIN_INTERNAL_HOOKS` registration edits — re-consult at Stage 2 time), #220 is the push-gate breakage closure on the doctrine file, #234 is the per-role ambient-context survey. Nearest to this capability is #84 (CC `claude plugin install` CLI — CC channel, not ZCode). No capability commit is made in Stage 0/1 (docs only); the consult is recorded here for Stage 2's commit. ✓
- T20: verdicts in §6 carry §2/§3 evidence pointers; HOST-leaning claims are marked INCONCLUSIVE-needs-HOST, not asserted. ✓

**Backward-check applied** — Class of this change = «parity-row flip evidence + consumer-path documentation prep». Surfaces where that class occurs (enumerated, not recap):

- `zcode-parity-doctrine.md §2 row 3 / rollup / §4 row 3 / §5` — GAP-FOUND (row 3 still `plugin-gap`, :45/:66/:109; §5 printed 16 vs its own unchanged command's 17 — latently stale via `lib/` #1628, F6, :118) → this is Stage 2's payload; the doctrine remains the SSOT until then.
- `docs/meta-factory/research-patches/2026-07-18-zcode-full-parity-census.md` — SWEPT-CLEAN (dated baseline, append-only; row flips are recorded in the doctrine, not retro-edited — precedent: row 12's #1043 flip).
- `docs/meta-factory/zcode-parity-mega.decisions.md` — SWEPT-CLEAN (§3 of the doctrine already records Wave B as merged; no contradiction found in `git log` — probe 0.3).
- `scripts/render-harness-config.mjs` — GAP-FOUND (F1 registration + F8 `POST_MUTATION_GATES`) → Stage 2.
- `README.md` Compatibility (:273-285) — GAP-FOUND (F3 cluster) → Stage 2 fork D.
- `setup.d/10-skills.sh` — SWEPT-CLEAN (row-3 installer path intact at :332-342; only the doctrine's line citation drifted).
- `packages/core/principles/24-plugin-manifest-integrity.test.ts` — SWEPT-CLEAN for this change-class (V6 validates hooks.json targets against sibling files — the twin lands with its registration; `M1_SET` :418 is skills-population and sibling-owned, untouched).
- `plugin/README.md` — SWEPT-CLEAN (no per-hook enumeration to sync; §4).
- `packages/getff/MANIFEST.sha256` — SWEPT-CLEAN (F5; `plugin/` not in the dist payload).
- Self-application (T15): this patch re-derived the kickoff's claims instead of trusting them — and caught 8 things the kickoff's cached sweep had not (F1-F8), which is the audit-of-the-audit finding.
