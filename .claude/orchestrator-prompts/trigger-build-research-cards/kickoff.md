# trigger build, research cards — a minimal card for each generated research-only practice

> **Class:** stage kickoff (dispatch input), single stage — NOT one of the spec's five slices (an
> operator ask of 2026-09-30, §0). **Base branch:** `staging`. **Branch:** `feat/trigger-build-research-cards`.
> **PR title:** `trigger build: a card in .claude/rules/ for each generated research-only practice`.
> **Channel:** one aif task, own worktree, one PR to `staging`, harvested from the host (never
> pushed from the container). The lead session of the trigger build verifies the proof on the host.
> **Rigor label (L0):** `build-and-verify` — writes files into a consumer's `.claude/rules/`, the
> directory Claude Code loads natively; a wrong write lands in every session of that project.
> **Dispatch gate:** dispatch ONLY after the one-button landing is on `staging`. The worker's first
> step is `git merge-base --is-ancestor 808e806c606 origin/staging || STOP` (the generator's input
> and the removal verb exist only on that head, §1.1). Second gate: trigger-build-s5's card checks
> are on `staging` (§2 item 7) — if not, STOP and report; do not build the checks here.
> **Authoritative for:** this stage's contract — which entries get a card, the card and linked-file
> format, the delivery / freeze / stale / removal behaviour, the fixtures, exit gates, falsifiers.
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists);
> the trigger-build design and spec, and the card marker contract (trigger-build-s5 §2.3) — they
> live elsewhere; the rows this stage needs are quoted verbatim in §0 below.

**Measurement SHAs for every `path:line` below:** `808e806c606` (join/one-button-union, the
unmerged landing head) and `2855667cb34` (`origin/staging` when this kickoff was written). Each
citation names its SHA. After the landing merges, re-locate by content (`grep -n`) on `staging`.

## §0 The ask and the decision (verbatim, by pointer)

Source: `_advisor-one-button-operator-log.md` (coordination store, not readable from the
container), entries 47-49, 2026-09-30. Operator words are quoted verbatim (Russian), the
advisor's reading beside them is the log's own English text.

> 47. Verbatim: «1 я про генерируемые правила тут спрашивал например архитектурные какие нибудь
> которые невозможно или слишком сложно проверить тестами линтами или еще как то - просто карточка
> минимальная с сылкой на полную и подробную как с остальными [...]»
> Reading: (1) a design ask for the GENERATED research-only practices (architecture etc., not
> expressible as a lint/test check): a minimal card in the agent's context with a link to the full
> entry, «как с остальными» (the base-core card mechanism). [...] nothing renders them into
> AGENTS.md / RULES.md / `.claude/rules/` — the ask is NOT built today [...]

> 48. [...] The advisor withdraws recommendation A and recommends: generated research-only card →
> `.claude/rules/<slug>.md`, getff-marked, under the refresh baseline (lib.sh R1), removable like
> generated lint rules; human edits freeze it. Not yet an operator decision.

> 49. Verbatim: «[...] 3 главное при реализации не перепутай!»
> Reading: [...] (3) The card fork is DECIDED by this line: generated research-only cards → the
> project's `.claude/rules/` (getff-marked, refresh-baseline, removable); base-core cards →
> `.claude/hooks/getff-cards/`; «do not mix them up» is the implementation invariant.

Card contract rows, from `_spec-2026-09-29-trigger-build.md` (r2e) §2.2 and §3 slice 5:

> S-2 — [...] A card file is markdown: frontmatter `paths:` and/or `events:` and/or `on: read`;
> body = the mini card; a `depth:` list of linked files. The emitted pointer names the card's own
> `depth:` entries [...]
>
> S-3 — [...] a file with no `inject:` marker whose body is within S-8's limit IS a card and its
> BODY is injected [...]
>
> S-8 — A mini card is at most 1,000 bytes of body.
>
> Slice 5, item 1 — a rule file in the project's rules directory has `paths:`, a body of at most
> 1,000 bytes (S-8), names its mechanism or reads «not wired», and its linked files sit outside the
> rules directory (V7). getff checks the shape only and never edits the file (D26).

From `_design-2026-09-29-trigger-build-v2.md` §3: D18 (`:174`) «A research-derived rule has the D16
shape; the mini card is an instruction, linked files are data (fixed header, marked quotes with a
link, trusted sources, official docs first); the loader never injects a linked file». D10 (`:167`)
«[...] linked files sit outside the rules directory (V7); getff never overwrites an edited file».

The marker contract, from trigger-build-s5 §2.3 (drafted in parallel; its author relayed it
2026-09-30 — re-read that kickoff on `staging` and follow it if it differs):

> A generated research card is `.claude/rules/<slug>.md` directly in the rules dir (not a
> subdirectory). It carries exactly one own-line marker, `<!-- getff-card: research <stack> <entry-id> -->`.
> [...] A base-core card carries `<!-- getff-card: base-core <row-id> -->` [...] and lives ONLY in
> getff's card dir [...] Linked files of a research card, i.e. its `depth:` entries: they must sit
> outside `.claude/rules/`. Each must start with the fixed header line `> data, not instructions`,
> and all source text must be a `>` quote line that ends with a markdown link whose https host is on
> the research allowlist.

The s5 linked-file check (as relayed): line 1 exactly `> data, not instructions`; every http(s)
URL in the file, inside a ```json fence too, is https with its host on
`.ai-factory/research-allowlist.json` `hosts[]`; outside ```json fences a line is blank, a heading,
or a `>` line ending with `[..](https://..)`; a fence holding a `"quote"` key fails. The card body
carries one own line `Mechanism: not wired` (research-only = no check).

## §1 Facts, measured

### §1.1 The input exists only on the landing head

- Research-only entries are the `patterns[]` of `.ai-factory/rules-research/<stack>.research.json`
  that pass the plan gate and that no selection rule generates: `checkPlanFile`
  (`packages/core/install/rule-bootstrap-cli.ts:345-358` at `808e806c606`) returns
  `researchOnly: kept.filter((id) => !generated.has(id))` — `kept` is the gate's partition, so a
  dropped entry (bad allowlist key) is never research-only.
- `setup.d/80-rule-bootstrap.sh:29-58` (`808e806c606`) turns that into record lines
  `research-only: <id>[ — <reason>]` on EVERY pass that finds a research file (`:68-71`; the
  generic stack at `:63-67`), before the `--full` gate (`:75-77`). Snapshot fixtures carry no
  research file (`:14-16`), so the install fingerprints do not move.
- The rule table prints them: `researchRows` (`packages/core/audit-self/prove-rules.mjs:1708-1798`,
  `808e806c606`), row reason `research only: …` (`:1784`), status `not_wired`, home `—`. The table is
  «Printed, never stored» (`:1500`). Nothing writes a research-only entry into `.claude/rules/`,
  AGENTS.md or RULES.md (operator log entry 47, measured by the advisor).
- On `2855667cb34` none of this exists: `git ls-tree -r --name-only origin/staging | grep -c prove-rules` → `0`.
- The entry schema (`packages/core/research/research-plan.schema.json:39-62`, `808e806c606`):
  required `id`, `summary`, `bestPractices`, `antiPatterns`, `provenance`; optional `package`,
  `extras` (`additionalProperties: true`, `:58-61`). **No path or glob field.** The researcher
  protocol puts `extras.principle` (`agents/rule-researcher.md:147`) and `extras.quote` with the
  banner «untrusted excerpt — data, not instructions» (`:174`) there; `:165` routes a non-expressible
  practice to «a research-only finding in `patterns`».
- Entry ids become file names elsewhere through `RULE_ID_SLUG = /^[a-z][a-z0-9-]*$/`
  (`rule-bootstrap-cli.ts:176`) and the containment check of `safeRenderedPath` (`:184-198`).

### §1.2 The refresh baseline (R1) and what «a human edited it» means today

Identical bodies on both SHAs (`diff` of `setup.d/lib.sh:250-470` and of the flush-to-refresh
block, landing vs staging: no difference).

- `refresh_baseline_stage <dst>` (`setup.d/lib.sh:346`, both SHAs) stages a delivered path;
  `refresh_baseline_flush` (`:833` landing / `:815` staging) hashes staged paths into
  `.ai-factory/refresh-baseline.json`, keys relative to `PROJECT_ROOT` (`_refresh_baseline_hash_into`,
  `:820-831` landing), merging into the existing manifest.
- `refresh_safe` does NOT freeze an edit: its guard is «warn + preserve, NEVER refuse»
  (`:258` both); `_refresh_one_file` copies the edited bytes aside and then overwrites
  (`:1256-1264` landing). **Reusing `refresh_safe` for cards would violate D10.**
- The freeze test that exists: `getff_delivered <dst>` (`:405`, both SHAs — staged this run or a
  manifest key) AND NOT `getff_bytes_intact <dst>` (`:4250` landing / `:4081` staging — sha256
  equals the manifest entry; unknown reads as not intact, the safe side). Used exactly so at
  `setup.d/99-finalize.sh:107-111` (`808e806c606`, `_root_edited`) and
  `setup.d/eslint-wire.sh:107` (`2855667cb34`): an edited getff file «is treated as your own».
  **Reuse these two predicates; add no third.**
- `--refresh` never reaches `80-rule-bootstrap.sh`: `install.sh:1523-1530` (`808e806c606`) runs
  `do_refresh` and exits before the `setup.d/[0-9]*.sh` loop. The lint rules share this:
  `place_lint_rules` runs from `99-finalize.sh:1085-1087` (`808e806c606`). Parity is the design
  («removable like generated lint rules»); state it in the PR, do not add a refresh arm.

### §1.3 Removal of generated lint rules (landing head only)

`node scripts/prove-rules.mjs --remove` (`prove-rules.mjs:2476` → `removeGetff`, `:1071`,
`808e806c606`) takes out everything getff placed, found by its marks (header `:25-27`), and prints
one line per file («removed from …» / «nothing of getff in … — left as it was»). Node standard
library only (header `:27`). `setup.d/40-configs.sh:79-81` ships it as `scripts/prove-rules.mjs`.

### §1.4 The loader that will read the card (staging)

`.claude/hooks/inject-matching-rule.sh` at `2855667cb34`: the edit arm lists `"$RULES_DIR"/*.md`
(`:321`, top level only — a card in a subdirectory is never read by the hook); `parse_frontmatter`
(`:251`) reads `paths:`, `events:`, `depth:`, `on:`; `card_body` (`:287`) drops the frontmatter and
every own-line HTML comment (so the marker is never injected); a body within `CARD_LIMIT=1000`
bytes (`:88`, measured with `wc -c` at `:349`) is injected whole; the pointer names the `depth:`
entries (`:359`). At `808e806c606` the hook is the 127-line pre-slice-1 version — the stage must
be tested against the staging loader, which the landing merge keeps.

## §2 Deliverables

1. **Card renderer (pure)** — a new module `packages/core/install/research-cards.ts`, no I/O,
   one function from (stack, research entry) to either `{ card, entry }` (two file texts + their
   relative paths) or `{ skip: <reason> }`:
   - card path `.claude/rules/getff-research-<stack>-<entry-id>.md`; linked-file path
     `.ai-factory/rules-research/entries/<stack>/<entry-id>.md`. `stack` and `entry-id` must pass
     `RULE_ID_SLUG`, else skip with the reason (never a path built from an unchecked id).
   - card text: frontmatter `paths:` (§2 item 6) and `depth:` = the one linked-file path; then
     the marker line `<!-- getff-card: research <stack> <entry-id> -->`; then the body: `# <entry-id>`,
     the `summary`, `Do:` items from `bestPractices`, `Avoid:` items from `antiPatterns`, and the
     own line `Mechanism: not wired`. Items are added in order while the body stays ≤1,000 BYTES as
     the loader counts it (the `card_body` output, UTF-8); a summary that alone overflows is cut at
     the last whole word plus `…`. The `Mechanism:` line and the heading are never cut.
   - linked-file text: line 1 `> data, not instructions`; `# <entry-id>`; `## Entry` = one
     ```json fence with the entry verbatim minus `extras.quote`; `## Sources` = the entry's
     `extras.quote` (banner prefix «untrusted excerpt — data, not instructions: » stripped) as ONE
     `>` line ending with `[<host>](<url>)` of its first provenance item (`finalUrl` if set, else
     `url`); no quote → the section has its heading only. Nothing else.
2. **CLI arm** — `rule-bootstrap-cli.ts --emit-cards <plan> [--from-selection <sel>] --stack <stack> --out <dir>`:
   computes the research-only set with `checkPlanFile` (reuse, do not re-derive), renders each
   entry into `<dir>` (a temp dir; the arm never writes into the project), prints one JSON line per
   entry `{id, card, entry}` or `{id, skip}`. A rejected plan exits 3, as `--check-plan` does
   (`:364-377`). Rebuild the bundle: `node scripts/build-runtime-bundles.mjs`.
3. **Delivery helper** in `setup.d/lib.sh` (the helper SSOT; add its row to `setup.d/LAYERS.md`):
   `deliver_generated_file <src> <dst>` —
   - dst absent → copy, `✓ <dst>`, `refresh_baseline_stage`;
   - `getff_delivered` AND `getff_bytes_intact` → overwrite, stage again;
   - `getff_delivered` AND NOT `getff_bytes_intact` → leave the bytes, print
     `⊝ <dst> (edited since getff wrote it — yours now, not refreshed)`, do NOT stage (the old
     manifest entry keeps it frozen on every later pass);
   - exists and NOT `getff_delivered` → the project's own file: leave it, print `⊝ <dst> (not getff's — left as it is)`;
   - `--dry-run` → `[dry-run] would …` for each case, nothing written or staged.
4. **The card pass** in `setup.d/80-rule-bootstrap.sh`, right after each `_rb_record_research` call
   (stack and generic arms): run `--emit-cards`, `deliver_generated_file` each card and its linked
   file. Then the stale sweep: every `.claude/rules/getff-research-<stack>-*.md` carrying a
   `research <stack>` marker whose id is not in this pass's card set → intact: delete it and its
   linked file, print `✗ removed <path> — <id> is no longer a research-only entry`; edited: leave,
   print the frozen line. **No sweep when `--emit-cards` did not exit 0** (a rejected or failed plan
   must not delete cards). Missing node/bundle → degrade silently like `_rb_record_research`.
5. **Removal** — extend `removeGetff` (`prove-rules.mjs:1071`): each rules-dir file carrying a
   `getff-card: research` marker, and its `depth:` file, is deleted only when its sha256 equals its
   `.ai-factory/refresh-baseline.json` entry (`node:crypto`); otherwise it stays and is named
   («edited since getff wrote it — left in place» / «no baseline entry — cannot tell, left in place»).
   The rule table's research rows name the card path in `home` when the card exists; reason for a
   skip: `research only: no card — <skip reason>`. Status stays `not_wired`.
6. **Where `paths:` comes from — OPEN: the lead picks before dispatch.** No field exists (§1.1).
   Options, with evidence:
   (a) a new optional `extras.paths` (string[] of globs) the researcher writes for a research-only
   entry — the schema already admits it (`extras.additionalProperties: true`, `:60`); cost: one
   protocol line in `agents/rule-researcher.md` step 3 (`:165`) and a type check in the renderer;
   (b) a per-stack default glob (e.g. the app-code glob `['**/*.{ts,tsx}']`,
   `prove-rules.mjs:60`, `808e806c606`) — no protocol change, but the card fires on every source
   edit whether or not the practice concerns it (an unmeasured false-fire rate);
   (c) no card without a path: the entry keeps its table row with the skip reason.
   Recommendation (lead to confirm): (a), with (c) as the fallback for an entry without
   `extras.paths` — no glob is invented by getff. Wrong if a research-only practice is truly
   project-wide (then it is an `always-on` candidate, operator log entry 48, not a path card).
7. **Gate from slice 5** — the tests below run trigger-build-s5's card shape check and linked-file
   header check over every generated file. Their paths: `OPEN: take from trigger-build-s5 §2`.
8. **Tests.** (a) `packages/core/install/research-cards.test.ts` (vitest): exact card and
   linked-file text for a fixture entry; the body byte count against the loader's measure, with a
   non-ASCII summary near 1,000 bytes; marker string exact; skip for an unsafe id and (per item 6)
   for a missing path; a gate-dropped entry never renders. (b) `tests/install-sh/research-cards.test.sh`,
   harness shape of `tests/install-sh/rule-bootstrap-failure-loud.test.sh:34-68` (`808e806c606`)
   but with the REAL bundle and real node, in `mktemp -d`: pass 1 writes card + linked file and
   the flush records both; pass 2 is byte-identical; a hand-edited card survives pass 3 byte for
   byte with the frozen line; the entry turned into a generated rule → an intact card is removed,
   an edited one stays; a rejected plan removes nothing; a pre-existing project file at the card
   path is untouched; `--dry-run` writes nothing; `prove-rules.mjs --remove` removes the intact
   card and names the edited one; the staging loader (`RULES_DIR_OVERRIDE`, an Edit payload on a
   matching path) injects the body with `(see .ai-factory/rules-research/entries/…)` and never the
   marker; the s5 checks (item 7) pass on the output and FAIL on a seeded bad card. (c) Wire (b)
   into CI without shifting lines (principle 41): append ` && bash tests/install-sh/research-cards.test.sh`
   to the `run:` line of the rule-bootstrap-failure-loud step (`.github/workflows/audit-self.yml:1049`
   at `808e806c606`; re-locate on staging).

## §3 Prior-art consult (run by the drafting session 2026-09-30; re-check, do not re-derive)

- SSOT: `prior-art-evaluations.md#183` (rule-bootstrapping bridge, BUILD — research → per-project
  artefacts; this stage adds the research-only branch), `#200` (AI-agent-config-sync family,
  ruler; BUILD for the unserved slice), `#125` (Copier `update`, ADAPT — the refresh capability),
  `#101` (native `paths:` frontmatter, ADAPT).
- context7, three phrasings (the first MCP server answered «Monthly quota exceeded»; the second
  context7 server was used): (1) `/anthropics/claude-code` «generated rule files in .claude/rules
  with paths frontmatter loaded when matching file is read» → `.claude/rules/` since 2.0.64 and the
  `InstructionsLoaded` `load_reason: path_glob_match` — native loading of the card, no new
  mechanism; (2) `/intellectronica/ruler` «generated agent rule files … remove generated files, user
  edits» → `ruler revert` restores backups or removes generated files — the removal shape, no
  freeze of a user edit; (3) `/copier-org/copier` «skip overwriting files the user modified on
  update» → `_skip_if_exists` and «modified files that match the skip-if-exists patterns» excluded
  from the update patch — the freeze shape. Verdict: REUSE own stack for delivery, freeze and
  removal (`getff_delivered` + `getff_bytes_intact`, `removeGetff`, `checkPlanFile`); BUILD only the
  renderer (no tool renders a research record into a Claude Code rule card with a data file).
- Capability commit: yes (a new ≥80-LOC file under `packages/`). Trailers:
  `Prior-art: prior-art-evaluations.md#183 (research→artefact bridge, BUILD; the renderer extends it to research-only entries)`
  `Prior-art: prior-art-evaluations.md#125 (Copier update, ADAPT; skip-if-modified freeze reused via getff_delivered + getff_bytes_intact, no dependency)`

## §4 Proof — RED first

- Write both tests (§2 item 8) first and run them against the landed code: paste the failing runs
  (no `--emit-cards` arm, no card on disk) into the PR body. Then GREEN.
- Every byte count the test asserts is computed in the test from the text it wrote
  (`Buffer.byteLength` / `printf '%s' | wc -c` under `LC_ALL=C`), never typed by hand.
- The host half is the lead's: one real consumer install with a real research file, then an edit
  and a re-install. Do not claim host numbers.

## §5 Exit gates

```bash host-verify
git merge-base --is-ancestor 808e806c606 origin/staging
npx vitest run packages/core/install/research-cards.test.ts packages/core/install/rule-bootstrap-check-plan.test.ts packages/core/audit-self/prove-rules.test.ts
bash tests/install-sh/research-cards.test.sh
bash tests/install-sh/rule-bootstrap-failure-loud.test.sh
NODE_ENV=development node scripts/build-runtime-bundles.mjs --check
SNAPSHOT_MODE=compare bash tests/install-sh/snapshot.sh
shellcheck setup.d/80-rule-bootstrap.sh tests/install-sh/research-cards.test.sh
npx vitest run packages/core/principles/41-shell-test-ci-coverage.test.ts
npx tsx scripts/check-line-citations.mjs
node scripts/check-docs-refresh.mjs "$(git merge-base origin/staging HEAD)..HEAD"
bash scripts/run-local-ci-sweep.sh
```

`check-line-citations` must be green without `--write` on any `.claude/rules/*` file. The
docs-refresh gate names the `docs/site/` pages that cite a touched file; refresh them or add
`docs-refresh: deferred — <reason>` (a comma inside the reason, never `: `).

## §6 Out of scope

- Base-core cards and anything under `.claude/hooks/getff-cards/` or the plugin `cards/` — this
  stage never writes there (D9; operator log entry 49 «do not mix them up»).
- Delivery of the getff-cards directory to consumers (slice 4), the slice-5 checks themselves.
- Any file under getff's own `.claude/rules/` or `.claude/settings.json` — no agent and no factory
  run commits there in this build; getff has no `.ai-factory/rules-research/` of its own
  (`git ls-tree -r --name-only 808e806c606 .ai-factory` lists none), so it generates no card.
- A `--refresh` arm for cards (§1.2 parity), an `always-on` card type, AGENTS.md / RULES.md rendering.

## §7 Falsifiers to write into the PR body

- A card or linked file lands under `.claude/hooks/getff-cards/`, or a card in a subdirectory of
  `.claude/rules/` → the two homes are mixed, or the hook never reads it (`:321`).
- A hand-edited card changes on the next pass, or a copy appears under `.ai-factory/refresh-conflicts/`
  → `refresh_safe` was reused and D10 is broken.
- A rejected or failed plan deletes a card → the stale sweep ran on an unasked question.
- A card body over 1,000 bytes, or a cut inside a UTF-8 sequence → the loader injects a heading only.
- The marker or any text from the linked file appears in the loader's output → D18 broken.
- A gate-dropped entry (bad allowlist key) gets a card → the plan gate was bypassed.
- A project file at the card path without a baseline entry is overwritten → getff wrote over the project's own rule.
- `prove-rules.mjs --remove` deletes an edited card → removal ignores the freeze.
- The install fingerprints change → a snapshot fixture gained a research file, or the pass runs without one.

## §8 Report

`Stat` / `Verify` (each §5 gate, the RED-then-GREEN runs) / `DECISIONS` (the `paths:` source as
decided by the lead, the budget-fitting order, the stale-sweep guard) / `ATTN` / `Confidence`. The
PR body carries `## Fidelity verdict` (the lead adds it after the cold fidelity round) and the §1.7
Forward-check / Backward-check sections.

## §9 AI traps ([ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md))

Active traps for this stage: **T2** run the install passes, do not describe them · **T3**
command-or-`file:line` for every claim · **T6** confidence as predicates · **T14** a green run over
a fixture with no edited card and no stale card is not coverage of the freeze · **T19** own cold
review of the diff before handoff · **T21** cold `agents/backward-sweep-auditor.md` on the class
«an installer step that writes a generated file into a directory the project also owns and must
leave a human edit alone» — the other `copy_safe` / `refresh_safe` callers that write into
project-owned paths are the candidates.

**OPEN (for the lead, not the worker):** (1) the `paths:` source (§2 item 6); (2) the s5 check
paths (§2 item 7); (3) a deleted card is re-created on the next pass (parity with lint rules,
which `place_lint_rules` re-places every pass) — the alternative is a tombstone (a baseline key
with no file = removed on purpose, as Copier skips deleted paths); default here: parity; (4) the
s5 author's OPEN-1: Tier-0 official-doc hosts are not in `.ai-factory/research-allowlist.json`
`hosts[]`, so a linked file whose provenance URL is such a host fails the s5 check as relayed —
every real linked file would fail until that is resolved.

**T-TBRC-A (domain):** `refresh_safe` looks like the right verb — it is the refresh baseline's own
writer — but it preserves an edit and then OVERWRITES it (`lib.sh:1256-1264`, `808e806c606`). The
freeze is `getff_delivered && ! getff_bytes_intact`; assert it with a byte-for-byte compare of the
edited card after a pass, never with the absence of a warning.
