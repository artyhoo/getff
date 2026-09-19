# Kickoff — open-issues fix waves (2026-09-15 review → planned fixes)

> **Rigor label (L0): `build-and-verify`** — this kickoff dispatches build work (9 fix
> umbrellas), each gated by enumerated verify steps and live probes; the plan itself was
> double cold-reviewed before dispatch.

> **Status: PLAN, cold-reviewed, NOT yet operator-approved. Execution of any wave starts only
> after operator approval of this document. No wave may be dispatched before this kickoff itself
> is merged to `staging` (kickoff-staging-placement §1).**

**Provenance:** `_handoff-2026-09-15-getff-open-issues-review.md` + the 22 open `artyhoo/getff`
issues, each carrying TWO dated evidence comments (senior verification + independent subagent
falsification pass, both 2026-09-15 at `c26593c9`). Do NOT re-audit; every claim below cites the
recorded evidence. Load-bearing file:line anchors were re-verified live at planning time
(2026-09-15, same HEAD).

**State at planning:** staging HEAD `c26593c9`, clean tree, 22 open issues (3 already closed by
the review: #1537, #1487, #1512 — do not re-litigate).

---

## 0. Binding execution rules (apply to EVERY umbrella)

1. **One PR per umbrella**, branch `fix/<id>-<slug>` off `staging`. PR title `<id>: <short name>`.
2. **Writers work in per-agent worktrees** (`git worktree add`), never the shared checkout
   (`.claude/rules/parallel-subwave-isolation.md`; mutations in the shared workdir are the risk class).
3. **Dist-payload regen is the merge serializer.** `packages/getff/MANIFEST.sha256` covers the
   whole `packages/core` tree (~767 entries — including `packages/core/package.json` and the 76
   shipped `hooks/*.test.ts` files) plus setup.d (22), templates (38), `.claude/skills` (94),
   `.claude/hooks` (27), `agents/` (20) — i.e. EVERY umbrella below drifts it except W1-D
   (`.claude/rules/` is not shipped: 0 MANIFEST entries). Umbrellas may be AUTHORED in parallel
   under the file-lock matrix (§2), but are MERGED sequentially in wave order; after each merge
   the next umbrella rebases and re-runs the regen — `scripts/build-getff-dist.sh` then
   `SNAPSHOT_MODE=capture bash tests/install-sh/snapshot.sh` (baseline fingerprints) — and
   `scripts/build-getff-dist.sh --check` (drift gate) must be green before its own push.
   Behavior-accepting umbrellas (W1-A, W2-G) additionally RE-RUN their live consumer probes
   post-rebase: MANIFEST regen validates artifacts, not behavior, and sibling edits share the
   same delivery flow.
4. **Twins:** hooks SSOT is `.claude/hooks/*.sh`; the `packages/core` and `packages/getff` copies
   are generated (byte-identity is test-guarded; plugin twins carry an injected AUTO-GENERATED
   header by design). Edit the source, run the twin generator, never hand-edit twins.
5. **ZCode stdout contract:** any new hook DEBUG output goes to **stderr** — stdout must stay a
   single strict JSON object.
6. **PR body:** `## Fidelity verdict` + `§1.7 Forward-check / Backward-check` sections (git-safety
   hook validates; use `--body-file`). Capability commits carry a `Prior-art:` trailer with a
   recorded build-vs-reuse verdict — W2-G is the capability candidate (§3).
7. **CRLF trap:** `generate-plugin-twins.sh` in pre-commit can fail on macOS worktrees. If
   pre-commit dies inside it, re-run the twin regen manually and retry the commit. Never
   `--no-verify` past it.
8. **Issue hygiene:** `Closes #N` only on the umbrella that FULLY fixes #N; partial work
   references the issue without `Closes`. Closure/final comments in English, each restating the
   recorded `Failure-scenario:` and the fix + verify evidence that discharged it.
9. **Language:** all repo artifacts English; operator-facing chat Russian (`AIF_HOOK_LANG=ru`).
10. **Windows proof:** no local Windows box — Windows claims are proven ONLY by the
    `windows-latest` CI cell (.github/workflows/audit-self.yml:1973), never asserted locally.
11. **CC-compatibility invariant (operator directive 2026-09-15): every change must keep the
    Claude Code path working; where a surface already works in CC, the fix must NOT alter CC
    behavior — ZCode accommodations ride ALONGSIDE (stderr-not-stdout for debug, additive tools,
    annotations-not-rewrites, portability markers preserved). Concretely: keep every
    `@dual-pair` / `@cc-only-rationale` / `@harness-posture` marker intact
    (`deps-hash-check.sh` and `inject-matching-rule.sh` are @dual-pair; `aif-doctor/SKILL.md`
    carries @cc-only-rationale ~:20; `tool-bootstrapping/SKILL.md` is @harness-posture:
    portable); before editing any `.claude/hooks/*.sh`, read its row in the zcode-parity-doctrine
    §2 census and do not change its classification. If a fix cannot satisfy this — STOP and
    escalate to the operator, do not improvise.

---

## 1. Decision register (operator may override any entry at approval; each carries reopen-if)

**D1 — #1533 → Option A (doc-only: name the degradation, point to the plugin).**
The ZCode-reachable surface is the separately-installed getff plugin, live-verified (README
«As a ZCode plugin» :196-209, landed #1727; parity claim :326-331). Option B (deliver `.zcode`
from setup.d) would create a second, permanently twin-bound payload arm for marginal gain.
Matches the #1487 honest-gap pattern. Touchpoints: AI-USAGE-GUIDE §5 portability table
(~:264-274, names only Cursor/Codex/Aider/Windsurf/Roo — no zcode row) + INSTALL-FOR-AI (zero
occurrences of «plugin» today).
*Reopen-if:* a consumer cohort appears that cannot install the plugin channel.

**D2 — #1513 → Option A-reshaped: prepack copy step (NOT files-allowlist as stated).**
npm `files` paths are packages/core-relative; the gate scripts live at repo root, outside it —
adding root `scripts/` to the allowlist is mechanically impossible. Ship via a prepack step
copying `scripts/check-ask-files.sh` → `packages/core/scripts/` (pack-time artifact; **add the
`packages/core/scripts/` ignore rule — it is NOT gitignored at HEAD**; precedent:
`packages/getff/scripts/` assembled by `scripts/build-getff-dist.sh`, see
`hooks/checks/cmd-script-liveness.ts:181-186`). Badge the copy as pack-time materialization.
**Scope ruling to record:** the session-bus v2 §9 outside-packages requirement (rationale at
`packages/core/hooks/pre-push.ts:1579-1584`) scopes the REPO TREE — workers seated under
`packages/` must not edit the gate source that grades them; the tarball copy is a materialization
whose SSOT stays at root. The in-repo gate at `pre-push.ts:1590` (existsSync on the root path)
keeps working unchanged. `run-local-ci-sweep.sh`: include in the copy ONLY if a shipped
skill/template references it (grep at execution; expectation = not referenced → exclude + note).
*Reopen-if:* the shipped ask-files skill cannot resolve the packed path from a `node_modules`
install (execution probes this — W1-C verify step 2).

**D3 — #1502 → consumer-side mirror check shipped from setup.d.**
New check per the issue's rule-as-test shape: activates ONLY when `.zcode/` exists at
PROJECT_ROOT (CC-only consumers skip with one info line); asserts every `.claude/skills/<dir>`
has a `.zcode/skills/<name>` entry (symlink or dir) and no dangling symlinks; prints offenders by
name; exemption file `.ai-factory/zcode-mirror-exemptions.txt` (`<name> <reason>` per line);
stale exemption entry (skill gone) = error. Do NOT model it on this repo's one-top-level-symlink
shape (structurally complete by construction — subagent verdict in #1502). Mirror CREATION stays
consumer-side manual; the check makes whichever population policy the consumer chose visible.
**Wiring is a gate, not a manual command** (rule-enforcement-channel-selection §3: mechanically
detectable → gate at the earliest reachable channel): consumer pre-commit arm via the hooks
delivery path; install/refresh output may ECHO the result but is not the enforcement channel.
*Reopen-if:* consumers report the check firing on layouts it misreads.

**D4 — #1514 + #1540 → unified divergence guard (mechanism first, docs follow).**
(a) `_copy_tree_with_transform` (`setup.d/lib.sh:197-204`): replace the bare `rm -rf` with a
divergence-aware replace — dst exists → compare per-file against the baseline entry; diverged →
preserve the diverged files under `.ai-factory/refresh-conflicts/` + ⚠ line, then replace.
(b) `copy_safe` force arm (`lib.sh:474-501`): before overwriting under `--force`, read the
baseline — entry-present + diverged → reuse `refresh_baseline_diverged` + ⚠.
(c) **No-entry policy (both paths, one rule):** baseline entry absent + file diverged from the
delivered copy → **preserve silently at file level, report ONE aggregate line per run** («preserved
N unbaselined diverged files under .ai-factory/refresh-conflicts/»), never per-file ⚠. This
SUPERSEDES closed #1512's RI-2 («no entry = unknown = silent») for the destructive-overwrite
path — and the supersession is declared, not glossed: RI-2 ratified silent clobber AND explicitly
rejected warn-on-first-touch to avoid per-file spam on pre-manifest consumers; the aggregate-line
rule keeps the no-spam contract while removing the data loss. State exactly this in the W1-A PR
body (§1.7 backward-check) so the operator approves the supersession knowingly.
(d) Then #1540's docs state the unified post-fix behaviour (W2-E). `merge_prettierignore` routes
force through copy_safe → covered for free.
*Reopen-if:* the per-tree hashing makes refresh unacceptably slow on large skill trees (measure;
fallback = hash only files whose names match the delivery manifest).

**D5 — #1799 → full sweep + Windows CI cell extension.**
Shared test helper `symlinkOrJunctionOrSkip()` in `packages/core/hooks` test utils; migrate ALL
`symlinkSync` sites (47 at planning; include `link-coordination.test.ts:186` added by #1800) —
POSIX behaviour unchanged on darwin/linux. Extend the `windows-latest` cell
(`audit-self.yml:1973`, today consumer-init-only) with a hooks vitest run so the fix is provable
in CI. Named skips only where a symlink is the assertion itself (mirror those to junction asserts).
*Reopen-if:* the extended cell exceeds acceptable CI time → split a dedicated windows-test job.

**D6 — #1704 → harvest preflight; no session-start hook yet.**
Add a §0/§1 preflight to `.zcode/skills/harvest/SKILL.md` (and the dist copy via regen): plain
host-side `curl -s -m5 localhost:3009/health`; on failure print the fix instruction (reuse
wording at `docs/runtime-bridge-setup.md:10` + `docker compose up -d agent`, aif-doctor:89) and
stop BEFORE egress work starts — the failure must surface at skill start, not at push time.
`bridge-health.sh` stays container-side; do not reuse it for the host probe. Promotion criterion
(aif-doctor:22) stays at 1/2 incidents — record incident-count state in the issue comment; the
session-start hook is NOT part of this plan. **Executed by W1-E.**
*Reopen-if:* a second recorded incident fires → the criterion triggers the hook as follow-up.

**D7 — #1703 → ZCode half now; asymmetry = accepted divergence; CC half tracked in-issue.**
Rows 13/15 (`.claude/rules/zcode-parity-doctrine.md` ~:55/:57) get live-verified annotations
(2026-09-10 probes: UserPromptSubmit digest arm + PreToolUse:Agent|Task anchor, end-to-end);
the annotation supersedes `docs/meta-factory/research-patches/2026-09-10-zcode-live-smoke.md:141-142`
and the row-15 note carries the cwd-dependence nuance (which tree feeds the anchor depends on the
session cwd). Asymmetry decision (CC `inject-subagent-digest` → INLINE digest vs ZCode
`inject-subagent-context` → digest BLOCK): record **accepted divergence** in §2 — both arms are
live-verified on their harness; unification is new mechanism for zero consumer-visible gain;
closes the deliberately-open fork at `2026-08-02-per-role-digest-fork.md:203`. The CC checklist
(3 probes, listed in #1703) is the operator's CC session, NOT this plan — the issue stays open
until that half lands.
*Reopen-if:* a future harness arm makes inline delivery cheap → revisit unification.

**D8 — #1517 + #1518 → one pipeline-helpers umbrella, two-part fix.**
(a) Mechanical: `priority-score.sh:250` labels xref-sourced completion `done_basis="jaccard…"`
— pass the true basis through from the dup-detect line (re-verified live at planning:
`dup-detect.sh:121-123` emits `basis=xref score=100%` on ANY `#N` present anywhere in the
kickoff, including provenance citations like «landed via #1727»). (b) Semantic: gate Signal 1 —
a merged PR cited as PROVENANCE in a kickoff must not classify the umbrella DONE; only
completion-bearing citations (e.g. `Final PR: #N` lines) may. Update SKILL.md:163 wording to
match; drop the `2>/dev/null` swallow at SKILL.md:278; fix the launch-table stage-id regex
`([A-D]|[0-9]+)` at `launch-table-generator.sh:81/:95` (:13 is `set -euo pipefail`, not the
regex — grep the pattern at execution) to accept the real stage grammar and
degrade LOUDLY (`DEGRADE:` line, non-zero) instead of exit-1-swallowed.
*Reopen-if:* the Signal-1 gating rule cannot distinguish provenance from completion citations on
the live corpus (verify against the 3 live umbrellas named in #1517).

---

## 2. Waves, merge order, file-lock matrix

| Wave | Umbrella (merge order) | Issues | Primary files | Regen |
|---|---|---|---|---|
| 1 | **W1-A** `fix/consumer-delivery-safety` | #1514, #1540(mech), #1531 | `setup.d/lib.sh`, `setup.d/70-deps.sh` | baselines+MANIFEST |
| 1 | **W1-B** `fix/hooks-payload-truths` | #1705, #1264, #1520 | `.claude/hooks/deps-hash-check.sh` (SSOT; 2 generated copies), `.claude/hooks/inject-matching-rule.sh`, `setup.d/10-skills.sh` | baselines+MANIFEST |
| 1 | **W1-C** `feat/npm-tarball-gates` | #1513 | `packages/core/package.json`, prepack helper under `scripts/`, `.gitignore` (new ignore rule) | MANIFEST (package.json IS a manifest entry) |
| 1 | **W1-D** `docs/zcode-parity-annotations` | #1703 (ZCode half) | `.claude/rules/zcode-parity-doctrine.md` | none (rules not shipped — 0 MANIFEST entries) |
| 1 | **W1-E** `fix/skills-agents-payload-truths` | #1581, #1516, #1507, #1704 | `.claude/skills/aif-doctor/SKILL.md`, `agents/review-sidecar.md`, tool-bootstrapping copies (`.claude/skills/`, `skills/`, `plugin/skills/` — see §3 W1-E), `.claude/skills/harvest/SKILL.md` (`.zcode/skills/` resolves to the same tree), `.claude/orchestrator-prompts/aif-admission-latency-doctor/kickoff.md` | baselines+MANIFEST (fingerprints hash the INSTALLED TREE — content edits drift them regardless of install output) |
| 2 | **W2-E** `docs/consumer-docs-accuracy` | #1536, #1533-A, #1532, #1539, #1535, #1540(docs) | `README.md`, `INSTALL-FOR-AI.md`, `packages/core/templates/shared/AI-USAGE-GUIDE.md`, `…/tier-home.md`, `setup.d/LAYERS.md` | baselines+MANIFEST (templates are installed content) |
| 2 | **W2-F** `fix/pipeline-helpers` | #1518, #1517 | `.claude/skills/pipeline/helpers/{launch-table-generator,dup-detect,priority-score}.sh`, `.claude/skills/pipeline/SKILL.md`, `…/pipeline/evals/` (new scenario) | baselines+MANIFEST (pipeline skills are installed content) |
| 2 | **W2-G** `feat/consumer-zcode-mirror-check` | #1502 | new `setup.d/` check + consumer pre-commit wiring + `INSTALL-FOR-AI.md` (its own section) | baselines+MANIFEST |
| 3 | **W3-H** `fix/windows-test-suite` | #1799 | `packages/core/hooks/*.test.ts` (47 sites + link-coordination), `.github/workflows/audit-self.yml` | MANIFEST (test files ARE shipped dist entries) |

**Dependencies:** W2-E and W2-G require W1-A MERGED (docs state post-fix refresh behaviour;
setup.d area). **W2-G additionally requires W2-E merged before AUTHORING starts** — both edit
`INSTALL-FOR-AI.md` (different sections), so within wave 2 the authoring order is E ∥ F, then G.
W1-E and W3-H require their wave predecessors merged only for regen/rebase reasons. Within a
wave, authoring is parallel only where no two umbrellas edit the same source file — the only
overlaps are generated artifacts, handled by rule §0.3.

**Issue closure map (20 close, 2 stay open):** W1-A → #1514, #1531 (#1540 partial);
W1-B → #1705, #1264, #1520; W1-C → #1513; W1-E → #1581, #1516, #1507, #1704; W2-E → #1536,
#1533, #1532, #1539, #1535, #1540 (full close: mech W1-A + docs W2-E); W2-F → #1518, #1517;
W2-G → #1502; W3-H → #1799. **Stay open by design:** #1703 (CC half = operator's CC session),
#1483 (upstream aif-handoff image; verify with one `curl` when it lands).

**Track-only (NOT executed in this plan):** #1483 (fix lives in the upstream aif-handoff image;
verify from ZCode with one `curl` when it lands), #1703 CC checklist (operator's CC session;
issue stays open until both halves land).

---

## 3. Per-umbrella specs (self-contained; executor context is empty)

### W1-A `fix/consumer-delivery-safety` — #1514 + #1540(mech) + #1531
- lib.sh `copy_safe` force arm (:474-501): pre-overwrite baseline read per D4(b).
- lib.sh `_copy_tree_with_transform` (:197-204): divergence-aware replace per D4(a); covers
  `refresh_skill_with_transform` and `copy_skill_with_transform` (:1761+) paths.
- 70-deps.sh :108: after the `!(k in pkg.scripts)` merge, exact-string overwrite of the npm-init
  placeholder (`test` = `echo "Error: no test specified" && exit 1`) with the framework validate
  wiring; print kept key names (one log line).
- **Verify:** live throwaway-consumer probes: (1) edit a Layer-2 file + a skill file →
  `install.sh --force` → both preserved under `.ai-factory/refresh-conflicts/` + ⚠ lines;
  (2) fresh npm-init consumer → placeholder replaced, kept keys printed; (3) `--dry-run` shows
  would-flag; (4) baseline fingerprints regenerated, `build-getff-dist.sh --check` green;
  `make self-audit` green.
- **Risk:** force-path behaviour change — call out in PR body + fidelity verdict.

### W1-B `fix/hooks-payload-truths` — #1705 + #1264 + #1520
- deps-hash-check.sh `_npm_current` (:112-120): enumerate workspace manifests (npm workspaces
  globs; `pnpm-workspace.yaml` incl. overrides/catalog resolution); merge root+member deps into
  the normalized JSON. **Re-key the memo cache** (:345-348 `_memo npm "$(_memo_key package.json)"`)
  over the full manifest set, or the TTL window stays blind.
- Same file: fresh-path DEBUG emit → **stderr** (rule §0.5). **Edit the `.claude/hooks/` SSOT
  copy** (§0.4; `scripts/generate-plugin-twins.sh` renders the packages/core and packages/getff
  copies — never hand-edit those; byte-identity is test-guarded).
- #1520 (Option B, already decided): retract both false claims — `setup.d/10-skills.sh:323-325`
  and `.claude/hooks/inject-matching-rule.sh:28-31` «consumers DO get .claude/rules/*» → state
  the truth: the hook ships; `.claude/rules/` content does NOT (consumer-owned).
- **Verify:** reproduce the #1264 false-GREEN in a /tmp pnpm/npm monorepo scratch → after the
  fix the drift is detected (Rule 5 fires); twin byte-identity test; regen + `--check`;
  self-audit.

### W1-C `feat/npm-tarball-gates` — #1513
- Prepack helper copies root `scripts/check-ask-files.sh` → `packages/core/scripts/` — **step 0:
  add `packages/core/scripts/` to `.gitignore`** (not ignored at HEAD; without it the pack-time
  artifact gets committed). Badge the copy header «pack-time copy — SSOT at repo root»;
  `packages/core/package.json`: add `prepack` + `files` entry `scripts/`. Record the D2 scope
  ruling in the #1513 comment.
- **Verify:** (1) `npm pack --dry-run` lists the script; (2) unpack the tarball in /tmp, install
  into a scratch consumer, locate the shipped ask-files gate reference and confirm it resolves
  from the installed layout — if it references the repo-root path, adjust the reference or
  document the resolution (this is D2's reopen condition); (3) `run-local-ci-sweep.sh` grep
  decision recorded; (4) in-repo `pre-push.ts` gate unchanged (existsSync on root path still
  true in the repo tree); (5) MANIFEST regen (packages/core/package.json is a manifest entry).

### W1-D `docs/zcode-parity-annotations` — #1703 (ZCode half)
- Doctrine §2 rows 13/15 annotations + accepted-divergence decision record per D7. Rules are not
  shipped → no regen; `make self-audit` green (principles 12/44 authoring gates apply to this
  file — read `.claude/rules/doc-authority-hierarchy.md` first).
- Issue #1703 stays OPEN (CC half pending); PR references it without `Closes`.

### W1-E `fix/skills-agents-payload-truths` — #1581 + #1516 + #1507 + #1704
- #1581: rebase the aif-doctor `docker logs --since` probes (:159-161 area + the §3.7 detectors)
  on `docker logs -t --tail N` + `date -u` arithmetic (Docker 29.2.x `--since` returns 0
  whenever filtering is required — always-blind detectors). THREE surfaces: the source skill
  `.claude/skills/aif-doctor/SKILL.md` (the `.zcode/skills/` top-level symlink resolves to the
  same tree), the dist copy (regen), and the third prose copy at
  `.claude/orchestrator-prompts/aif-admission-latency-doctor/kickoff.md:88-90`.
- #1516: root SSOT `agents/review-sidecar.md:4` — `tools: Read, Glob, Grep` → add `Bash` + a
  one-line read-only convention in the description (reports, does not fix; no mutations, no
  worktrees). Plugin twin + dist copy via the generators (`agents/` has 20 MANIFEST entries);
  the handoff cites `MANIFEST:139` for the twin — re-grep at execution.
- #1507: tool-bootstrapping Rule 2 gains the hard registry-search step: after Rule 1 stack
  enumeration, ONE `npx skills search <core>` per detected framework core (language, UI
  framework, metaframework, db), surface the top canonical candidate (≥100K installs or
  first-party) in the Rule 3 confirmation block — propose, not install. Reword the «not as
  commands to issue blindly» phrase (:29 of the copies that carry it — it is NOT in the
  `.claude/skills/` copy) to match. **Copy enumeration (complete, else the fix lands stale):**
  `grep tool-bootstrapping packages/getff/MANIFEST.sha256` (5 entries: `.claude/skills/`×2,
  `skills/`×3) PLUS the tracked `plugin/skills/tool-bootstrapping/` twin, which has ZERO
  MANIFEST entries and is rendered by `scripts/generate-plugin-skills.sh` — name that generator,
  edit the SSOT copy, regenerate; verify step must grep the plugin twin explicitly. Cross-link
  #1264 in the issue comment (compound: dead Rule 5 trigger suppressed the recurring re-run).
- #1704: harvest preflight per D6 — host-side `curl -s -m5 localhost:3009/health` at skill §0;
  on failure print the remediation pointer and stop BEFORE egress work.
- **Verify:** (1) aif-doctor: the three surfaces agree byte-for-byte on the probe commands
  (diff the blocks); (2) review-sidecar twin regen + `--check` green; (3) tool-bootstrapping:
  every MANIFEST copy carries the step; (4) harvest: run the preflight command live (bridge is
  up on this host) and confirm the pass path; failure path checked by pointing at a dead port;
  (5) self-audit.

### W2-E `docs/consumer-docs-accuracy` — #1536 + #1533-A + #1532 + #1539 + #1535 + #1540(docs)
- README :160/:245/:275 → mirror actual `99-finalize.sh` steps (installer forbids husky init,
  ships depcruise config).
- #1533-A: AI-USAGE-GUIDE §5 table (~:264-274) zcode row (degradation + plugin pointer to
  README:196-209); INSTALL-FOR-AI gains a «ZCode users» pointer paragraph.
- #1532: INSTALL-FOR-AI expected-failures table (:539-547) gains the R2/pre-push row
  (rule-glob alarm on non-boundary layouts at push time; cross-link AI-USAGE-GUIDE
  §3:197-198 + §3.1:224-226).
- #1540 docs: rewrite the :482 note + Layer-2 table row + `setup.d/LAYERS.md:90` to the post-W1-A
  unified behaviour (diverged copies preserved under refresh-conflicts/, ⚠ line, `--dry-run`
  would-flag — baseline-covered files AND skill trees).
- #1539: Uninstall section in INSTALL-FOR-AI — remove delivered trees; reset BOTH hooksPath
  variants (`50-hooks.sh:74`, `45-python.sh:967`; `lib.sh:2138-2169` re-asserts hooksPath);
  note `.override.md` / `refresh-conflicts/` residue.
- #1535: repoint dead citations AI-USAGE-GUIDE :6/:86/:318 + tier-home :84/:120 (:120 contradicts
  its own :122-127 Resolution). Known gap (NOT in scope): no path-existence gate for backticked
  paths — lyceen checks links only; if the operator wants the gate, file it as a separate issue.
- **Verify:** every new/edited path citation exists (scripted grep over the rendered files);
  markdownlint; MANIFEST regen (templates ship); self-audit.

### W2-F `fix/pipeline-helpers` — #1518 + #1517
- Per D8: basis pass-through + Signal-1 gating + SKILL.md:163 wording + drop SKILL.md:278
  `2>/dev/null` + launch-table regex fix with loud `DEGRADE:` on unparseable ids (:81/:95 — see D8's anchor note).
- **Verify:** run the helpers against live repo state (read-only): the 3 umbrellas named in
  #1517 (getff-ai-site, plain-words-recap-v2, + third) classify ACTIVE/DONE correctly after the
  fix — no provenance-citation DONEs; add a regression eval scenario under
  `.claude/skills/pipeline/evals/`; MANIFEST regen; self-audit.

### W2-G `feat/consumer-zcode-mirror-check` — #1502
- New setup.d check per D3 + a dedicated section in `INSTALL-FOR-AI.md` (own section only —
  W2-E owns the same FILE, so W2-G authors after W2-E merges; see §2 authoring order).
  **Prior-art consult REQUIRED before writing** (this is
  a capability commit): `docs/meta-factory/prior-art-evaluations.md` + a search for existing
  symlink/mirror checkers; record the verdict as a `Prior-art:` trailer.
- **Verify:** throwaway consumer WITH `.zcode/` + seeded drift → check fails loud naming
  offenders; exemption honored; stale exemption errors; consumer WITHOUT `.zcode/` → one info
  line, exit 0; regen; self-audit.

### W3-H `fix/windows-test-suite` — #1799
- `symlinkOrJunctionOrSkip()` helper + sweep of all `symlinkSync` sites in
  `packages/core/hooks/*.test.ts` (47 at planning + `link-coordination.test.ts:186`); extend the
  windows-latest cell (audit-self.yml:1973) with a **pinned install** (`npm ci`, ci-tool-pinning
  Rule A/B — the cell has no workspace install today) + `npx vitest run packages/core/hooks`.
- **Verify:** local (darwin) full hooks suite green; windows-latest cell green WITH the new
  step; self-audit; MANIFEST regen (the 76 shipped test files are dist entries). Windows claims
  only via CI (rule §0.10).

---

## 4. Global acceptance (all waves done)

```bash host-verify
# Global gate for the whole wave program at final staging HEAD.
# Per-umbrella verify commands live in §3 and gate each PR individually.
scripts/build-getff-dist.sh --check
make self-audit
```

- All 9 umbrellas (W1-A…W1-E, W2-E…W2-G, W3-H) merged to staging in wave order; every
  `build-getff-dist.sh --check`, baseline set, and `make self-audit` green at final staging HEAD.
- Issue board: 22 open → **20 closed, 2 open by design** — #1703 (ZCode half landed by W1-D;
  CC half waits on the operator's CC session checklist) and #1483 (fix lives upstream in the
  aif-handoff image). Each closed issue carries an English closure comment: Failure-scenario →
  fix → verify evidence.
- Windows cell proves the hooks suite (the #1799 proof channel).

## 5. Report format (per umbrella, back to the orchestrator)

Strict template: `Stat` (files+lines) / `Verify` (enumerated observed results incl. command
outputs) / `DECISIONS` (any fork taken) / `ATTN` (mandatory stop if non-empty) /
`Confidence: high|medium|low`. No prose beyond the template.

## T-TRAPS ACTIVE (`.claude/rules/ai-laziness-traps.md §2`)

T3 (no prose-only findings — every claim in this plan carries a re-verified `file:line` or the
recorded issue evidence it stands on), T7 (negative-existence claims — e.g. «no path-existence
gate for backticked paths» in W2-E — require the 6-item search-coverage checklist before they
ship in any PR body), T20 (evidence before verdict — D1–D8 each cite the recorded evidence and
carry a reopen-if falsifier).
