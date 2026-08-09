<!-- bridge-profile: Z.AI GLM-5.2 SDK -->
<!-- scope: stage-scoped dispatch input — S-M of the arch-v2-context-pipeline umbrella. Tier 1
(mechanical: the channel decision is MADE in this kickoff §1 and was Phase -1-reviewed; the
executor lands a fully-specified registry swap + rule re-channeling). Origin: operator verdict
2026-08-08 resolving the S-D′ spec §3.2 DECISION-NEEDED as Option B, target
build-first-reuse-default.md, executed as its own stage. Rev 3: absorbs BOTH Phase -1 rounds
(2 seats × 2 rounds — 7 BLOCKERs + 10 MAJORs total, all fixed in place; round-2 seats verified
round-1 fixes empirically). -->

# arch-v2-context-pipeline S-M — Tier-0 swap: `build-first-reuse-default.md` → paths:-scoped

> **Stage goal:** move `.claude/rules/build-first-reuse-default.md` (BFR) OUT of the Tier-0
> always-on core — the **#2 always-on lever**: 12,667 B, **MEASURED 4,800 tok** resident cost
> (S-L §1.1, `docs/meta-factory/research-patches/2026-08-07-s-l-recalculation.md:55`) — onto
> CC-native `paths:` scoping + edit-time inject (`@dual-pair`,
> `.claude/rules/rule-enforcement-channel-selection.md §4`). After the swap BFR is no longer
> RESIDENT: its full text loads only when a session reads a §1.2 capability-authoring surface.
> (Registry-level claim only — per-seat savings depend on what each seat reads, §1a/T-SM-B.)
> Mechanism precedent: S-G re-scoped `ai-laziness-traps` off residency the same way (final PR
> #1228). Magnitude precedent, cited honestly: the −39% host-cc reading
> (`docs/meta-factory/research-patches/2026-08-01-token-economy-distillate.md:36`) came from PR
> #1188's FOUR combined levers (paths: re-scoping among them), not from one rule's swap. This
> is a **channel re-scope, NOT retirement** (BFR §6 «Never retire» stands).
>
> **Ownership grant (Artifact Ownership Contract):** this stage edits, with explicit grant —
> operator verdict 2026-08-08, landing as a maintainer-reviewed PR (grant shape: S-G kickoff
> `:86/:119/:122`): `.claude/rules/build-first-reuse-default.md`,
> `.claude/rules/source-before-shape.md` (§1.6 three-sentence carrier update ONLY),
> `.claude/rules/00-rule-index.md` + root `AGENTS.md` (render targets),
> `.ai-factory/rule-channel-degradations.json`, and the four §1.1 registry files — two of which
> sit under `packages/core/principles/` (Contract row «owner: meta-tests CI, read-only for
> implementation agents» — granted here for exactly these two files). No other `.claude/rules/*`
> or `packages/core/*` file.
>
> **Depends on:** S-D′ merged (PR #1290, squash `be087d3585`) — consumed content: the corrected
> §3.1 ranking + §3.2 Option-B consequence statement in
> `docs/superpowers/specs/2026-08-07-s-d-prime-subtraction-maps.md`. Gate MET.

## §1 Deliverables (all in ONE PR onto staging)

1. **Four-way registry swap** — remove `build-first-reuse-default` from the Tier-0 copies:
   - `scripts/render-rule-index.mjs:56-60` (`TIER0_CORE` set) — remove the entry;
   - `packages/core/principles/31-rule-channel-declaration.ts:58-63` (`ALWAYS_ON_CORE`
     array) — remove the entry (the `> 4` cap-throw below it is a ceiling; 3 members legal);
   - `packages/core/principles/31-rule-channel-declaration.test.ts:61` — remove from the
     exact-membership literal, and update BOTH now-stale test titles: `:58` «contains the 4
     expected rule basenames» → «…the 3 expected…», `:154` «positive control: the real
     ALWAYS_ON_CORE (4 entries)…» → «…(3 entries)…». **`:138` is NOT a membership literal —
     do NOT delete that line.** It sits inside the N31-2 synthetic ceiling probe whose
     load-bearing property is the array LENGTH = 5 (`:136-152`,
     `expect(...).toThrow(/ceiling of 4/)`); deleting an element makes the probe stop throwing
     and the §3 vitest leg goes RED. Replace the BFR string there with a DIFFERENT placeholder
     name (keeps §3 discrimination leg 2's grep clean), keeping 5 elements;
   - `scripts/render-rule-channels.mjs:75-79` (its own `ALWAYS_ON_CORE` set) — remove the entry.
2. **Rule re-channeling** — `.claude/rules/build-first-reuse-default.md` (currently NO YAML
   frontmatter — form template: `ci-tool-pinning.md:1-10`) gains the dual-pair declaration
   (without it principle 31 goes red the moment deliverable 1 lands):
   - `paths:` frontmatter + matching `<!-- globs: -->` + `<!-- inject: -->` markers —
     **identical sets, hook-subset grammar only** (`prefix/**`, `*.ext`, exact; see
     `packages/core/principles/rule-channel-glob.ts:111`). **Binding glob set (decided here —
     capability-AUTHORING surfaces; the exclusions are §1a's subject):** `.claude/skills/**`,
     `agents/**`, `.claude/rules/**`, `setup.d/**`,
     `docs/meta-factory/prior-art-evaluations.md`, `package.json`,
     `packages/core/package.json`. (7 entries → index cell `paths:(7), edit-time inject`.)
     The `<!-- inject: -->` one-liner: seven-verdict reminder + SSOT-consult pointer (≤300 B).
   - **Record the channel in the Class line (UNCONDITIONAL** —
     `rule-enforcement-channel-selection.md §3` step 5): append to BFR's `> **Class:**` line:
     `Channel: paths:(7) + edit-time inject (re-scoped from always-on Tier-0, operator verdict
     2026-08-08); always-on pointer carriers: session-bootstrap digest invariant (1) +
     CLAUDE.md per-commit gate.`
   - **New section `## §9 Channel & recursive self-application (2026-08-08)` inserted AFTER
     `## §8 See also`, at end of file** — BFR's §7 (`:94`) and §8 (`:100`) already exist; do
     NOT renumber them (precedent for a rule narrating its own channel:
     `rule-enforcement-channel-selection.md §7`). The block carries: the re-scope record
     (operator verdict, S-D′ spec §3.2 Option B); one line added to §6 saying only «2026-08-08
     channel re-scope ≠ retirement — see §9»; a supersession note — the
     `session-start-token-audit` kickoff `:145` «STAY (declared always-on core) — do NOT
     demote» verdict is SUPERSEDED by this operator verdict; and the **observable restoration
     trigger:** restore Tier-0 membership (all four copies) upon ONE incident detectable from
     git artifacts — a merged capability commit whose `Prior-art:` trailer is the
     escape-hatch form AND whose diff touches no §1.2 glob path, OR a
     `#parallel-evolution-creep` finding recorded in a research-patch. (Edited-paths are a
     PROXY floor: read-time loads are not observable post-hoc; a session may read a §1.2
     surface without editing it. The proxy under-counts loads, so it can only fire when
     neither channel provably had its editing occasion — a conservative trigger.)
   - BFR's index `Fires:` cell MAY be shortened (e.g. «any capability commit / proposal.») if
     needed for the deliverable-5 index byte ceiling — BFR's own line only, no other rule.
3. **Carrier update in `source-before-shape.md` (granted; three sentences ONLY).** That rule
   currently leans on BFR's residency in exactly three places — `:31` («…+ the always-on
   parent BFR rule carry the discipline»), `:50` (same phrase), `:51` («…the surface is left
   to the always-on parent BFR + Layer B outright») — verified the exhaustive list by grep
   over `.claude/rules/ .claude/skills/ agents/ packages/core/templates/shared/` (only these
   3 sites + the auto-regenerated index row). Rewrite each to name the post-swap carriers:
   «the BFR pointer in the session-bootstrap digest + principle 11 F1 + Layer B» (wording may
   flow naturally; the three citations must stop claiming BFR is always-on). No other edit to
   that file.
4. **Degradation row** — `.ai-factory/rule-channel-degradations.json:24-30` («rule»:
   `build-first-reuse-default` at `:25`): change `target: session-start-hook` →
   `target: edit-time-inject`, reason in the shape of the `ci-tool-pinning` row (`:31-37`).
   Keep JSON valid. NOTE: `render-rule-channels.mjs --check` does NOT diff the `target` field
   (`findManifestDrift` `:225-242` compares `status` only) — the §3 jq leg is the gate for
   this deliverable.
5. **Regenerate the rule index** — `npx tsx scripts/render-rule-index.mjs --write` (updates
   `.claude/rules/00-rule-index.md` BFR row from `always-on core` to `paths:(7), edit-time
   inject` + the root `AGENTS.md` rule-index region). **Byte ceiling:** `INDEX_MAX_BYTES` =
   4,096 (`render-rule-index.mjs:52`); the index is 4,075 B on the reference HEAD and the new
   cell adds +13 B → 4,088 B, 8 B headroom. If `--check` reds on overflow: trim BFR's own
   `Fires:` cell (grant in §1.2) — if STILL over, STOP and surface (no other rule's cells may
   be trimmed). Do NOT run `render-rule-channels.mjs --write` — it renders nothing when the
   manifest exists (the manifest is hand-edited reviewed data, deliverable 4).
6. **Fingerprints — expect GREEN, investigate on red.** `.claude/rules/**` is NOT shipped to
   consumers (`setup.d/LAYERS.md:79`; zero `claude/rules` hits in any baseline), and the
   shipped `AGENTS.md.template` carries no rule-index region — so `SNAPSHOT_MODE=compare` is
   expected to stay 15/15 GREEN. A red here means this kickoff's shipping model is wrong:
   STOP and surface; do NOT recapture to make it pass.

### §1a Deliberate glob-set exclusions (coverage-loss honesty — read before touching §1.2)

CC-native `paths:` loads the WHOLE rule when a matching file is READ
(`rule-enforcement-channel-selection.md §4` read-vs-edit caveat), so every glob is a read-time
cost on the seats that touch it. Four exclusions are deliberate:

- **`packages/**`** — the most-read tree in the repo; including it would re-load 12,667 B into
  exactly the seats this stage relieves, and the §3 meter (residency predicate = `^paths:`
  presence, `scripts/measure-always-on.sh:47`) would mis-report the nullified saving as
  achieved. Note the DIFFERENT reason in the peer exclusion at `source-before-shape.md:51`
  (its once-per-session inject token would be spent on routine core edits — an
  exhaustion argument, not a read-cost argument); the peer is precedent for *naming carriers
  for an excluded hot surface*, not for the mechanism.
- **`.claude/orchestrator-prompts/**`** — the umbrella's target seat is the senior
  orchestrator seat (umbrella kickoff `:230`), and that seat reads kickoffs constantly
  (`/pipeline` scans `*/kickoff.md`); including this glob would hand the 12,667 B right back.
  Carriers at the kickoff-authoring moment: `source-before-shape.md` Layer A (its globs DO
  include `.claude/orchestrator-prompts/**`) + the digest pointer.
- **`.github/workflows/**`** — workflow-capability verdicts (SSOT #153 class) happen at
  workflow-edit moments already covered by `ci-tool-pinning.md`'s paths: channel; the verdict
  itself gets recorded in `prior-art-evaluations.md`, which IS in the §1.2 set.
- **Workspace dep manifests other than core** — the grammar has no `packages/*/package.json`
  form and `packages/**` is excluded above; §1.2 covers the two dominant manifests exactly
  (root `package.json` — workspaces root, 3 devDeps; `packages/core/package.json` — the main
  dep surface, SSOT #238 precedent). Residual gap: dep additions in
  `packages/lint-config/package.json` / `packages/meta-factory/package.json` load no BFR
  text — carriers: principle 11 F1 (pre-push/CI) + the CLAUDE.md per-commit gate + the
  digest pointer.

**Named residual gaps, all surfaces:** `packages/**` edits and chat-only capability proposals
load no BFR text; carriers there are the session-bootstrap digest invariant (1) line
(`.claude/hooks/inject-session-bootstrap.sh:28` — a POINTER, not the seven-verdict table),
the CLAUDE.md «Build-vs-reuse invariant» section (per-commit gate), principle 11 F1, and
`agents/capability-reuse-auditor.md` (Layer B, run before handoff). The seven-verdict table +
§1.1 satellite doctrine auto-load only on §1.2 surfaces — the design intent: those are where
verdicts get WRITTEN; elsewhere the pointer suffices and the full text is one deliberate Read
away.

## §2 Permitted files

Exactly the grant list: four §1.1 registry files,
`.claude/rules/build-first-reuse-default.md`, `.claude/rules/source-before-shape.md` (three
§1.3 sentences only), `.ai-factory/rule-channel-degradations.json`,
`.claude/rules/00-rule-index.md` + root `AGENTS.md` (render targets).
`tests/install-sh/baselines/**` is NOT expected to change (§1.6); any drift = STOP. Anything
else = STOP and surface (§5). Environment: run with `jq` on PATH —
`scripts/check-alwayson-budget.sh:45` and `measure-always-on.sh:59` degrade silently without
it.

## §3 Acceptance

```bash host-verify
npx vitest run packages/core/principles/31-rule-channel-declaration.test.ts
npx vitest run packages/core/principles/09-doc-authority-hierarchy.test.ts
npx vitest run packages/core/hooks/inject-matching-rule.test.ts
npx tsx scripts/render-rule-index.mjs --check
npx tsx scripts/render-rule-channels.mjs --check
bash scripts/check-alwayson-budget.sh
bash scripts/measure-always-on.test.sh
jq -e '.degradations[] | select(.rule=="build-first-reuse-default" and .target=="edit-time-inject")' .ai-factory/rule-channel-degradations.json
SNAPSHOT_MODE=compare bash tests/install-sh/snapshot.sh
```

**Discrimination legs (PR-body evidence, commands + quoted output):**

1. **Meter delta (measures deliverable 2):** `bash scripts/measure-always-on.sh` BEFORE and
   AFTER **on the dispatch HEAD** — quote both `total_bytes`. Reference on staging
   `6f114737`: BEFORE = 43,135 B; expected AFTER = **30,481 B** — the drop is BFR's 12,667
   MINUS the index-regen growth (+13 B for the longer channel cell), i.e. net −12,654; if you
   trimmed BFR's `Fires:` cell (§1.5 grant), AFTER shifts down by exactly that trim. These
   absolutes are HEAD-relative — RE-MEASURE, never inherit (the 48,6xx figures in
   `check-alwayson-budget.sh:14` prose are a stale S-G-era snapshot — staging's CLAUDE.md has
   shrunk since). Boundaries: AFTER >
   20,000 (floor) and < 54,000 (ceiling). STOP if the net drop falls outside
   **[12,600 ; 12,700] B** without a stated cause.
2. **Four-way swap (measures deliverable 1):** `git diff --name-only` of the swap commit
   naming all four §1.1 files, plus TWO narrow greps with their expected outputs:
   `grep -rn "build-first-reuse-default" scripts/render-rule-index.mjs scripts/render-rule-channels.mjs`
   → expect **0 hits**;
   `grep -n "build-first-reuse-default" packages/core/principles/31-rule-channel-declaration.ts packages/core/principles/31-rule-channel-declaration.test.ts`
   → expect **0 hits** (the `:138` placeholder was renamed per §1.1). Do NOT run a repo-wide
   grep as an acceptance signal — `11-build-first-reuse-default.test.ts`, its `.design.md`,
   `09-doc-authority-hierarchy.ts:45` and `scripts/host-verify.sh:27` legitimately reference
   the name (~21 hits across `scripts/` + `packages/`; 850+ repo-wide counting kickoffs and
   docs) and must NOT be «cleaned».
3. **Inject liveness (deliverable 2's hook half; the §3 vitest leg only covers
   `.claude/rules/**` fixtures):** run the real hook once against a matching path — the event
   MUST use an ABSOLUTE `file_path` (the hook strips `$REPO_ROOT/` and silently exits 0 on
   anything else, `inject-matching-rule.sh:69-70`) and a FRESH `session_id` per run (the
   session-cache at `:72-73` suppresses repeats):
   `printf '%s' "{\"tool_name\":\"Edit\",\"tool_input\":{\"file_path\":\"$PWD/agents/compliance-verifier.md\"},\"session_id\":\"sm-liveness-$(date +%s)\"}" | bash .claude/hooks/inject-matching-rule.sh`
   — quote the returned `hookSpecificOutput.additionalContext` containing the BFR inject
   line. **Empty output = NOT proof, it is a STOP** (wrong path form, stale session_id, or
   the markers didn't land).
4. **Carrier sweep (deliverable 3):** `grep -rn "always-on parent BFR" .claude/rules/` →
   expect **0 hits** after the three-sentence update.

## §4 AI-laziness traps (cite + enumerate per `.claude/rules/ai-laziness-traps.md §3`)

Active traps for this stage: **T2** (claiming the swap works without running the §3 contract),
**T3** (asserting a registry copy was updated without file:line evidence), **T5** (drive-by
edits outside §2 — e.g. «improving» BFR or source-before-shape prose beyond the granted
sentences), **T15** (self-application: this stage's own PR is a capability-adjacent change —
its PR body must show the BFR/SSOT consult it preaches; §1a exists because the swap applied to
itself asked «who loads the rule after the rule stops loading?»), **T16** (assuming the paths:
grammar supports arbitrary globs — hook subset ONLY; `paths:` and `globs:` sets IDENTICAL),
**T19** (handoff without own cold-QA), **T21** (backward-check restating this diff instead of
sweeping siblings — enumerate at minimum: four registry copies, the N31-2 probe + both test
titles, degradations row, renders, `source-before-shape.md` carrier sentences, the §3 leg-2
narrow greps, discrimination leg 4, fingerprints).

Domain trap **T-SM-A** — «the cap-4 throw passes, therefore the swap is complete»: principle
31's `> 4` throw is a CEILING check and stays green whether the swap landed in one copy or all
four; only the §3 contract + discrimination leg 2 prove completeness. BFR still listed in ANY
of the four copies = STOP, not a warning. (The pre-existing set asymmetry — `00-rule-index.md`
present only in `31-rule-channel-declaration.ts`'s copy, per its own `:49-52` comment «PLUS the
rendered index itself» — is intended; post-swap member counts 3/2/2 are correct, do not «fix»
them into agreement.)

Domain trap **T-SM-B** — «the meter moved, therefore the seat got cheaper»: the meter's
residency predicate is `^paths:` presence (`measure-always-on.sh:47`) — it measures the
REGISTRY, not a live seat. The honest claim after green acceptance is «BFR no longer loads
always-on»; per-seat savings depend on what the seat reads (§1a). Do not write «saves N tokens
per session/turn» anywhere in the PR — including by copying an older draft of this kickoff's
own goal line.

## §5 Fork discipline (§3a-inherited)

The swap target and channel are DECIDED (operator 2026-08-08; this kickoff §1, Phase -1
two-seat × two-round review). If execution surfaces a NEW fork — a fifth registry copy, a
consumer of Tier-0 membership or of BFR's residency not enumerated here (§1.3 lists the only
three known), index-ceiling overflow that BFR's own cells cannot absorb, an unexpected
fingerprint drift, or a paths:-grammar limit — STOP, record DECISION-NEEDED in the PR, do not
pick silently.
