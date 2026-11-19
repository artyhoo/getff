# trigger build, research cards — a minimal card for each generated research-only practice

> **Class:** stage kickoff (dispatch input), single stage — NOT one of the spec's five slices (an
> operator ask of 2026-09-30, §0). **Base branch:** `staging`. **Branch:** `feat/trigger-build-research-cards`.
> **PR title:** `trigger build: a card in .claude/rules/ for each generated research-only practice`.
> **Channel:** one aif task, own worktree, one PR to `staging`, harvested from the host (never
> pushed from the container). The lead session of the trigger build verifies the proof on the host.
> **Rigor label (L0):** `build-and-verify` — writes files into a consumer's `.claude/rules/`, the
> directory Claude Code loads natively; a wrong write lands in every session of that project.
> **Dispatch gate (content, squash-safe):** the worker's first step is
> `git grep -q 'export function checkPlanFile' HEAD -- packages/core/install/rule-bootstrap-cli.ts && git cat-file -e HEAD:packages/core/audit-self/prove-rules.mjs || STOP`
> — the generator's input and the removal verb exist only once the one-button landing is on
> `staging` (§1.1); a squash merge of the landing passes this gate, an ancestor test would not.
> Second gate: `git cat-file -e HEAD:packages/core/audit-self/check-rule-cards.sh || STOP` —
> trigger-build-s5's card checks are on `staging` (§2 item 8); if not, STOP and report; do not
> build the checks here. Third gate: `git cat-file -e HEAD:packages/core/audit-self/getff-mechanism-lib.sh || STOP`
> — trigger-build-s4's per-mechanism file helper writes the derived ceiling (§2 item 10).
> **Authoritative for:** this stage's contract — which entries get a card, the card and linked-file
> format, the trigger proof and the always-on fallback, the delivery / freeze / stale / removal
> behaviour, the fixtures, exit gates, falsifiers.
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists);
> the trigger-build design and spec, and the card marker contract (trigger-build-s5 §2.1) — they
> live elsewhere; the rows this stage needs are quoted verbatim in §0 below.

**Measurement SHAs for every `path:line` below:** `808e806c606` and `7a0b9634ef1` (local branch
`join/one-button-union`, the unmerged landing head; `7a0b9634ef1` descends from `808e806c606`, and
`git diff --stat 808e806c606 7a0b9634ef1` over every file cited here changes only
`setup.d/80-rule-bootstrap.sh`, after line 180 — the cited lines 14-16, 29-77 are the same),
and `2855667cb34` (`origin/staging` when this kickoff was written). Each citation names its SHA.
After the landing merges, re-locate by content (`grep -n`) on `staging`.

## §0 The ask and the decisions (verbatim, by pointer)

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

**Entry 49 overrides one spec line for this file class.** The spec's HO-6 row
(`_spec-2026-09-29-trigger-build.md:318`, r2f) says «The project's own `.claude/rules/` stays
consumer-owned». For getff-marked generated research cards the operator decided otherwise (entry
49): getff writes them there, marked, under the baseline, removable, frozen on edit. Every other
file in that directory stays consumer-owned — getff never touches an unmarked file (§2 item 3).

The advisor's answer E18 (`_advisor-trigger-build.decisions.md`, coordination store), verbatim:

> F2 (`:598-622`) — A: the researcher writes the scope as `extras.paths` (globs in the S-1
> grammar) [...] every generated glob must match at least one file in the project tree at
> generation time; a glob that matches nothing is rejected and the entry is reported (D3 «not
> wired», counted). [...] Fallback when the researcher can name NO narrower moment: not C (drop).
> [...] the entry becomes an always-on CANDIDATE under the existing criteria (no narrower moment,
> no after-the-fact check, fits the map+roots budget of `check-alwayson-budget.sh`, D1); within
> budget it is delivered always-on, over budget it is reported as «not wired: no trigger, over
> budget». No third outcome. [...] Placement per entries 48-49 [...] The kickoff states this
> invariant and its check.

> F3 (`:624-633`) — B, the resolver's union [...] The check calls the existing resolver
> (`resolveAllowedSources` / `validateProvenance` with a ctx), never a second reader of the JSON
> [...] Wrong if: the resolver cannot be called from the check's channel — then the check reads a
> list the resolver RENDERS, never its own copy of the tiers.

The advisor's answer E21 (`_advisor-trigger-build.decisions.md#e21`, `:724-781`; ask
`session-bus/asks/2026-09-30-seat-trigger-build-rc-alwayson-ceiling.md`) — the always-on budget at
a consumer, a DECISION of this stage, verbatim:

> **Verdict: A, with three conditions — the ceiling is NOT getff's 54,000 B, the predicate is the
> loader's, and the shipped meter is a capability commit.**
> - Condition 1 — the ceiling is derived per install, the way getff's was: at the card pass's first
>   run the consumer's resident set is measured and the ceiling = that baseline × 1.10 rounded up to
>   the next 1,000 B, written to the mechanism file's `[params]` (E3) with the measured baseline
>   beside it; `AIF_ALWAYSON_CEILING` overrides it. 54,000 B is written nowhere in the shipped default [...]
> - Condition 2 — the shipped predicate is the loader's, not `^paths:` alone. Since slice 1 a rule
>   with `<!-- globs: -->`, `events:` or `on: read` is not always-on either; `measure-always-on.sh`
>   counts them as resident, overstating the set. The card pass measures «has NO declared trigger»
>   — the exact complement of slice 5 item 1's check (E18 F2) — so one predicate serves both.
>   Getff's own script stays as it is in this stage; making getff run the shipped meter (D17) is a
>   follow-up [...], not this kickoff.
> - Condition 3 — the shipped meter is a new file under `packages/` ≥ 80 LOC in all likelihood: the
>   kickoff carries the build-vs-reuse consult (SSOT + context7 ≥3 phrasings) and a `Prior-art:`
>   trailer citing `scripts/measure-always-on.sh` as the harvested source; the exclude list is the
>   consumer's own `claudeMdExcludes` read through the shared `scripts/lib/claude-md-excludes.sh`
>   idiom, not a second parser.
> - Report shape (E18 F1): «always-on: <bytes> of <ceiling> — <n> candidates delivered, <m> not
>   wired: over budget», numbers, never a bare green.

Card contract rows, from `_spec-2026-09-29-trigger-build.md` (r2f, status line `:10`) §2.2 and §3:

> S-1 (`:77`) — [...] `**/` = any number of directories, `**` = anything, `*` = anything but `/`,
> `?` = one char but `/`, `{a,b}` = alternation, everything else literal [...]
>
> S-2 — [...] A card file is markdown: frontmatter `paths:` and/or `events:` and/or `on: read`;
> body = the mini card; a `depth:` list of linked files. [...]
>
> S-8 — A mini card is at most 1,000 bytes of body.
>
> Slice 5, item 1 (`:295-298`) — The card shape check: a rule file in the project's rules
> directory has a declared trigger — `paths:`, `events:`, `on: read`, or the always-on mark (r2f,
> E18 F2) — a body of at most 1,000 bytes (S-8), names its mechanism or reads «not wired», and its
> linked files sit outside the rules directory (V7). getff checks the shape only and never edits
> the file (D26).
>
> Slice 5, item 2 (`:299-302`) — The linked-file header check for research-derived files: a fixed
> header «data, not instructions», source text only as marked quotes with a link, every link's host
> allowed by the research resolver's union — Tier 0 ∪ Tier 1 ∪ acked Tier 2
> (`.ai-factory/research-allowlist.json` is Tier 2 only) — through the EXISTING resolver, never a
> second reader of the JSON (r2f, E18 F3; V4, D18).

From `_design-2026-09-29-trigger-build-v2.md` §3: D18 (`:174`) «A research-derived rule has the D16
shape; the mini card is an instruction, linked files are data (fixed header, marked quotes with a
link, trusted sources, official docs first); the loader never injects a linked file». D10 (`:167`)
«[...] linked files sit outside the rules directory (V7); getff never overwrites an edited file».
D1 (`:159`) «Always-on = the base-core map + three roots, once per context», falsifier «the
always-on text exceeds its byte budget at a measured install».

The marker and always-on contract, from trigger-build-s5 (drafted in parallel, `§2.1` at
`.claude/orchestrator-prompts/trigger-build-s5/kickoff.md:184-190`; re-read it on `staging` and
follow it if it differs):

> `SHAPE-TRIGGER` — a declared trigger: a non-empty `paths:`, a non-empty `events:`, `on: read`, or
> the always-on mark — the frontmatter line `always-on: true` (agreed with
> `trigger-build-research-cards` 2026-09-30; it REPLACES `paths:`, a card carries one or the other).
> [...] `SHAPE-TRIGGER` also fails a file carrying both `always-on: true` and `paths:`.

Marker lines (relayed by the s5 author 2026-09-30): a generated research card carries exactly one
own-line `<!-- getff-card: research <stack> <entry-id> -->`; a base-core card carries
`<!-- getff-card: base-core <row-id> -->` and lives ONLY in getff's card dir. The s5 linked-file
check: line 1 exactly `> data, not instructions`; every http(s) URL in the file, inside a json code
fence too, is https with its host in the RENDERED union list `.ai-factory/research-allowed-hosts.txt`
(s5 kickoff `:244-264`, written by a new `rule-bootstrap-cli.ts --render-allowed-hosts <out>
--consumer-root <root>` mode that calls `resolveAllowedSources(resolveCtxForRoot(root))`); outside
json code fences a line is blank, a heading, or a `>` line ending with `[..](https://..)`; a fence
holding a `"quote"` key fails. The card body carries one own line `Mechanism: not wired`.

## §1 Facts, measured

### §1.1 The input exists only on the landing head

- Research-only entries are the `patterns[]` of `.ai-factory/rules-research/<stack>.research.json`
  that pass the plan gate and that no selection rule generates: `checkPlanFile`
  (`packages/core/install/rule-bootstrap-cli.ts:345-358` at `7a0b9634ef1`) returns
  `researchOnly: kept.filter((id) => !generated.has(id))` — `kept` is the gate's partition, so a
  dropped entry (bad allowlist key) is never research-only.
- The plan gate checks provenance hosts through the resolver: `partitionResearchPlan`
  (`packages/core/synthesizer/file-clients.ts:53-62`, `7a0b9634ef1`) drops an entry on any
  «provenance diagnostic» and is called with `resolveCtxForRoot(opts.root)`
  (`rule-bootstrap-cli.ts:351`). So every provenance `url` / `finalUrl` of a kept entry is already
  in the resolver's union (Tier 0 ∪ 1 ∪ acked 2) — the linked file's one link inherits that.
- `setup.d/80-rule-bootstrap.sh:29-58` (`7a0b9634ef1`) turns that into record lines
  `research-only: <id>[ — <reason>]` on EVERY pass that finds a research file: the generic stack
  arm (`:62-67`, returns at `:66`) and the stack arm (`:68-72`) are exclusive, so ONE stack is
  processed per pass; both run before the `--full` gate (`:74-77`). Snapshot fixtures carry no
  research file (`:14-16`), so the card pass never moves the fingerprints (the meter does, §5).
- The rule table prints them: `researchRows` (`packages/core/audit-self/prove-rules.mjs:1709-1799`,
  `7a0b9634ef1`), row reason `research only: …` (`:1784`), status `not_wired`, home `—`. A third
  state exists: an entry a selection rule picked but that got no generated rule reads
  `selected, but the generator made no rule from it` (`:1793`) — it is NOT research-only, so it
  gets no card either (§8 ATTN). The table is «Printed, never stored» (`:1500`).
- On `2855667cb34` none of this exists: `git cat-file -e` of `prove-rules.mjs` fails, `git grep -c 'export
  function checkPlanFile'` → no hit (`researchOnly` does not discriminate: 3 hits staging, 5 landing).
- The entry schema (`packages/core/research/research-plan.schema.json:39-62`, `7a0b9634ef1`):
  required `id`, `summary`, `bestPractices`, `antiPatterns`, `provenance`; optional `package`,
  `extras` (`additionalProperties: true`, `:58-61`). **No path or glob field today.** The
  researcher protocol puts `extras.principle` (`agents/rule-researcher.md:147`) and `extras.quote`
  with the banner `"untrusted excerpt — data, not instructions"` (`:174`) there; `:165` routes a
  non-expressible practice to «a research-only finding in `patterns`».
- Entry ids become file names elsewhere through `RULE_ID_SLUG = /^[a-z][a-z0-9-]*$/`
  (`rule-bootstrap-cli.ts:176`) and the containment check of `safeRenderedPath` (`:184-198`).

### §1.2 The refresh baseline (R1) and what «a human edited it» means today

Identical bodies on both SHAs (`diff` of `setup.d/lib.sh:250-470` and of the flush block: none).

- `refresh_baseline_stage <dst>` (`setup.d/lib.sh:346`, both SHAs) stages a delivered path;
  `refresh_baseline_flush` (`:833` landing / `:815` staging) hashes staged paths into
  `.ai-factory/refresh-baseline.json`, keys relative to `PROJECT_ROOT`, merged into the manifest.
- `refresh_safe` does NOT freeze an edit: its guard is «warn + preserve, NEVER refuse»
  (`:258` both); `_refresh_one_file` copies the edited bytes aside and then overwrites
  (`:1256-1264` at `808e806c606`). **Reusing `refresh_safe` for cards would violate D10.**
  `copy_safe` (`:875` staging) skips any existing path, so an intact card would never be updated.
- The freeze test that exists: `getff_delivered <dst>` (`:405`, both SHAs — staged this run or a
  manifest key) AND NOT `getff_bytes_intact <dst>` (`:4250` landing / `:4081` staging — sha256
  equals the manifest entry; unknown reads as not intact, the safe side). Used exactly so at
  `setup.d/99-finalize.sh:107-111` (`808e806c606`) and `setup.d/eslint-wire.sh:107`
  (`2855667cb34`). **Reuse these two predicates; add no third.**
- `--refresh` never reaches `80-rule-bootstrap.sh`: `install.sh:1523-1530` (`808e806c606`) runs
  `do_refresh` and exits before the `setup.d/[0-9]*.sh` loop. The lint rules share this:
  `place_lint_rules` (`lib.sh:2768`, `7a0b9634ef1`) runs from `99-finalize.sh:1085-1087`. Parity is
  the design («removable like generated lint rules»); state it in the PR, do not add a refresh arm.
- No generated-file delivery helper exists to reuse. The delivering functions of `lib.sh` at
  `2855667cb34` are `copy_safe` (`:875`), `refresh_safe` (`:1177`) and `deliver_getff_workflow`
  (`:1409`, routes to the first two); `place_lint_rules` edits a config in place. s4's planned
  `packages/core/audit-self/getff-mechanism-lib.sh` (s4 kickoff §Deliverables D1 — a moving draft,
  locate by heading) is a `[params]` / `[starting-list]` file helper, absent on both SHAs: not a
  delivery helper, but the writer of this stage's `[params]` file (§2 item 10, E21 condition 1).

### §1.3 Removal of generated lint rules (landing head only)

`node scripts/prove-rules.mjs --remove` (`:2476` → `removeGetff`, `:1071-1100`, `7a0b9634ef1`) edits
ONLY the lint config — getff's entries in `.oxlintrc.json` (`:1073-1080`), getff's marked block in
`eslint.config.*` (`:1082-1093`) — one line per file («removed from …» / «nothing of getff in … —
left as it was»); it deletes no file, so card removal is NEW code modelled on it. Node standard
library only (header `:27`); shipped as `scripts/prove-rules.mjs` by `setup.d/40-configs.sh:80`.

### §1.4 The loader that will read the card, and the always-on budget

- `.claude/hooks/inject-matching-rule.sh` at `2855667cb34`: the edit arm lists `"$RULES_DIR"/*.md`
  (`:321`, top level only); `parse_frontmatter` (`:251`) reads `paths:`, `events:`, `depth:`, `on:`
  and skips every other key (`:273`), so `always-on: true` is ignored by the hook; `card_body`
  (`:287`) drops the frontmatter and every own-line HTML comment; a body within `CARD_LIMIT=1000`
  bytes (`:88`, `wc -c` at `:349`) is injected whole; the pointer names the `depth:` entries
  (`:359`); globs go through `glob_to_ere` (`:180`, the S-1 translation). At `7a0b9634ef1` the hook
  is the 127-line pre-slice-1 version — test against the staging loader, which the landing keeps.
- An always-on card reaches the agent only through Claude Code's native session-start load of a
  rules file without `paths:`; on ZCode it is not delivered (declared limit, s5 `:186-189`).
- The budget meter is getff-internal: `scripts/check-alwayson-budget.sh` and
  `scripts/measure-always-on.sh` exist on both SHAs, but `git grep` for either in `setup.d` and
  `install.sh` → 0 hits on both — they are NOT shipped. The meter measures `REPO_ROOT` (its own
  checkout): CLAUDE.md + `.claude/rules/*.md` lacking `^paths:` (`measure-always-on.sh:29-38`,
  `2855667cb34`), minus `claudeMdExcludes` through `scripts/lib/claude-md-excludes.sh` (`:44`; the
  lib needs `jq` and leaves the list empty without it, lib `:12-13`, `:21`). The ceiling
  `CEILING="${AIF_ALWAYSON_CEILING:-54000}"` (`check-alwayson-budget.sh:44`) is derived at `:33-43`
  from getff's own 48,671 B × 1.10 → 53,538 B, rounded up to 54,000 B, with host-cc labelled
  UNMEASURED; `packages/core/hooks/pre-push.ts:2014-2016` (`2855667cb34`) calls the gate
  «Maintainer-only because the ceiling is framework-derived». That number is getff's, not a consumer's.
- The staging loader's trigger is the union of `paths:` frontmatter, the `<!-- globs: -->` marker,
  `on: read` and `events:` (`inject-matching-rule.sh:18`, `:323`, `:334`, `2855667cb34`);
  `measure-always-on.sh` tests `^paths:` alone, so it counts a globs-only or `events:`-only rule as
  resident (E21 condition 2). Not measured by this kickoff: whether Claude Code's native load also
  skips such a file at session start when no `claudeMdExcludes` entry names it — the meter applies
  the project's excludes, and the worker records the answer (§8 ATTN), never assumes it.

## §2 Deliverables

1. **Researcher protocol: write `extras.paths`** — edit `agents/rule-researcher.md` step 3 (`:165`,
   the research-only routing sentence): for a research-only finding, add `extras.paths` = a string
   array of globs in the S-1 grammar naming the files the practice is about, or omit it when no
   narrower moment than «always» exists (then say so in `summary`). Add the key to the entry example
   next to `extras.principle` (`:147`). The schema already admits it (`extras.additionalProperties:
   true`, schema `:60`); no schema change. **Research files written before this edit carry no
   paths, so every research-only entry in them takes the always-on-candidate route (item 3).** The
   agent file is framework-maintainer-owned (CLAUDE.md Artifact Ownership Contract row for
   `agents/*.md`): this PR is the handoff commit, one atomic commit with its own rationale.
2. **Card renderer (pure)** — a new module `packages/core/install/research-cards.ts`, no I/O,
   one function from (stack, research entry, project file list, budget state) to either
   `{ card, entry, trigger }` (two file texts + their relative paths + `paths` | `always-on`) or
   `{ skip: <reason> }`:
   - card path `.claude/rules/getff-research-<stack>-<entry-id>.md`; linked-file path
     `.ai-factory/rules-research/entries/<stack>/<entry-id>.md`. `stack` and `entry-id` must pass
     `RULE_ID_SLUG`, else skip with the reason. The renderer then ASSERTS both results — card path
     matches `^\.claude/rules/getff-research-[a-z0-9-]+\.md$`, linked path starts with
     `.ai-factory/rules-research/entries/` and contains no `..` segment — and throws otherwise (a
     programming error, never a skip). No path is ever built under `.claude/hooks/`.
   - frontmatter: EITHER `paths:` as a block list with every glob double-quoted (`  - "<glob>"`)
     OR the line `always-on: true` (never both, s5 `SHAPE-TRIGGER`); then `depth:` = the one
     linked-file path. Then the marker line `<!-- getff-card: research <stack> <entry-id> -->`;
     then the body: `# <entry-id>`, the `summary`, `Do:` items from `bestPractices`, `Avoid:` items
     from `antiPatterns`, and the own line `Mechanism: not wired`.
   - sanitising every research string before it enters the card: collapse all whitespace (newlines
     included) to one space and trim, so each item is ONE line; replace every `<!--` with
     `&lt;!--` (an own-line comment would be dropped by `card_body`, an inline one hides text);
     drop an item whose text is only dashes (`^-{3,}$`, a frontmatter fence to a reader); a glob
     that holds `"`, `\`, a control char, or anything outside the S-1 forms — `[`, `]`, `!`, `(`,
     `)`, a nested `{` — is rejected (the entry is «not wired: glob outside S-1 grammar», counted).
   - byte budget: items are added in order while the body stays ≤1,000 BYTES as the loader counts
     it (the `card_body` output, UTF-8); a summary that alone overflows is cut at the last whole
     word plus `…`. The `Mechanism:` line and the heading are never cut.
   - linked-file text: line 1 `> data, not instructions`; `# <entry-id>`; `## Entry` = one json code
     fence with the entry minus `extras.quote`; `## Sources` = the entry's `extras.quote` as ONE `>`
     line ending with `[<host>](<url>)` of its first provenance item (`finalUrl` if set, else `url`).
     The banner is stripped with `^\s*untrusted excerpt — data, not instructions[\s\p{P}]*` (`u`
     flag; the banner followed by ANY punctuation or whitespace, `:` / `.` / `—` / none). A
     non-string `quote` is accepted: a string array → its items joined with a space; any other
     value → `JSON.stringify` of it; then the same whitespace collapse and `<!--` neutralising. No
     quote → the section has its heading only. Nothing else.
3. **The trigger: glob proof, or the always-on candidate (E18 F2)** — decided per entry:
   - `extras.paths` present and a non-empty string array → every glob must be in the S-1 subset
     (item 2) AND match at least one file of the project tree; the tree is the file list the bash
     pass hands over (`git ls-files -co --exclude-standard` in a git work tree, else `find` with
     `.git` and `node_modules` pruned). Matcher: `picomatch` (already a `packages/core` dependency,
     `package.json:97` at `7a0b9634ef1`; the matcher Claude Code's native `paths:` uses per
     `prior-art-evaluations.md#238`) with `{ dot: true }`. Any glob with zero matches → the entry
     gets no card and is reported «not wired: glob matches no file — <glob>», counted. A present but
     malformed `extras.paths` (not an array of strings, or empty) → «not wired: extras.paths is not
     a list of globs», counted.
   - `extras.paths` absent → an always-on CANDIDATE, budgeted per E21 (§0). Base = the resident
     set as the shipped meter (item 10) measures it — the loader's predicate, «no declared
     trigger», never `^paths:` alone — EXCLUDING getff's own intact always-on research cards from
     earlier passes (so pass 2 does not count pass 1 and flip it). Ceiling = `AIF_ALWAYSON_CEILING`
     when set, else the per-install derived value from the mechanism file (item 10). Candidates
     are added in plan order, first-fit, each at its full card-file bytes, while base + added ≤
     ceiling. Within → a card with `always-on: true`. Over → no card, reported «not wired: no
     trigger, over budget», counted. No third outcome — in particular never a guessed default
     glob, and never a fixed ceiling: `54000` appears in no shipped file.
   - The parity of picomatch with the loader's `glob_to_ere` (S-1 falsifier column, spec `:77`) is
     asserted by a fixture table in the bash test (item 9 b): each glob of the table against both.
4. **CLI arm** — `rule-bootstrap-cli.ts --emit-cards <plan> [--from-selection <sel>] --stack <stack>
   --tree <file-list> --budget-base <bytes> --budget-ceiling <bytes> --out <dir>` (both budget
   numbers come from item 10; the renderer never measures or derives them): computes the research-only set with
   `checkPlanFile` (reuse, do not re-derive), renders each entry into `<dir>` (a temp dir; the arm
   never writes into the project), prints one JSON line per entry `{id, card, entry, trigger}` or
   `{id, skip}`. A rejected plan exits 3, as `--check-plan` does (`:360-377`). Rebuild the bundle:
   `node scripts/build-runtime-bundles.mjs`.
5. **Delivery helper** in `setup.d/lib.sh` (the helper SSOT; add its row to `setup.d/LAYERS.md`):
   `deliver_generated_file <src> <dst>` —
   - dst absent → copy, `✓ <dst>`, `refresh_baseline_stage`;
   - `getff_delivered` AND `getff_bytes_intact` → overwrite, stage again;
   - `getff_delivered` AND NOT `getff_bytes_intact` → leave the bytes, print
     `⊝ <dst> (edited since getff wrote it — yours now, not refreshed)`, do NOT stage (the old
     manifest entry keeps it frozen on every later pass); `--force` does NOT lift this (D10);
   - exists and NOT `getff_delivered` → the project's own file: leave it, print `⊝ <dst> (not getff's — left as it is)`;
   - `--dry-run` → `[dry-run] would …` for each case, nothing written or staged.
   Why a new helper (§1.2): `copy_safe` never updates, `refresh_safe` overwrites edits, s4's
   `getff-mechanism-lib.sh` is a params-file helper.
6. **The card pass** in `setup.d/80-rule-bootstrap.sh`, one function `_rb_research_cards <stack>
   [<plan> [<sel>]]` called in BOTH arms (generic `:62-67` before its `return`, stack `:68-72`), also
   when the stack has no research file:
   - first run the meter and read or derive the ceiling (item 10), then print the budget line
     `always-on: <bytes> of <ceiling> — <n> candidates delivered, <m> not wired: over budget`
     (E18 F1 / E21 shape; numbers, never a bare green) after delivery, with one `note_not_wired`
     per over-budget entry;
   - render the host list with s5's `--render-allowed-hosts .ai-factory/research-allowed-hosts.txt
     --consumer-root "$PROJECT_ROOT"` (s5 kickoff `:244-264`; same run that writes cards, as s5
     asks), then `--emit-cards`, then `deliver_generated_file` each card and each linked file;
   - the stale sweep: every top-level `.claude/rules/*.md` carrying a `getff-card: research` marker
     whose `<stack>` differs from this pass's stack (a stack switch), or whose id is not in this
     pass's card set, is stale. For each, the card and its `depth:` file are checked SEPARATELY with
     `getff_delivered ∧ getff_bytes_intact`: an intact card is deleted
     (`✗ removed <path> — <id> is no longer a research-only entry`); an edited card stays (frozen
     line) and so does its linked file; the linked file of a deleted card is deleted only when
     itself intact, else it stays with the frozen line. Deleted paths leave the baseline.
   - the sweep runs ONLY when the question was answered: `--emit-cards` exited 0, or the current
     stack has no research file (zero entries). A rejected or failed plan, a missing node or bundle
     → no sweep, no card written; degrade silently like `_rb_record_research`.
7. **Removal** — new code in `prove-rules.mjs` next to `removeGetff` (`:1071`), called from the
   same `--remove`: each top-level rules-dir file carrying a `getff-card: research` marker, and its
   `depth:` file, is checked SEPARATELY and deleted only when its sha256 equals its
   `.ai-factory/refresh-baseline.json` entry (`node:crypto`); otherwise it stays and is named
   («edited since getff wrote it — left in place» / «no baseline entry — cannot tell, left in
   place»). One line per file, as `removeGetff` prints. The rule table's research rows name the card
   path in `home` when the card exists; a skip reads `research only: no card — <skip reason>`.
   Status stays `not_wired`.
8. **Gate from slice 5** — the bash test runs `packages/core/audit-self/check-rule-cards.sh
   --root <fixture>` (s5 kickoff `:162-168`; args `--root`, `--rules-dir`, `--cards-dir`,
   `--hosts`, `--only`) over every generated file: it must exit 0 on the output and 1 on a seeded
   bad card and a seeded bad linked file.
9. **Tests.** (a) `packages/core/install/research-cards.test.ts` (vitest): exact card and
   linked-file text for a fixture entry, one with `paths` and one always-on; the body byte count
   against the loader's measure, with a non-ASCII summary near 1,000 bytes; marker string exact;
   the path assertions throw on a forged id; each sanitising rule (a multi-line item, `<!--`, a
   `---` item, a glob with `"`); the banner stripped when followed by `:`, `.`, `—` and nothing; a
   string-array and an object `quote`; skip for an unsafe id, a zero-match glob, a malformed
   `extras.paths`, an over-budget candidate; a gate-dropped entry never renders.
   (b) `tests/install-sh/research-cards.test.sh`, harness shape of
   `tests/install-sh/rule-bootstrap-failure-loud.test.sh:34-68` (`808e806c606`) but with the REAL
   bundle and real node, in `mktemp -d`: pass 1 writes card + linked file and the flush records
   both; pass 2 is byte-identical (always-on card included); a hand-edited card survives pass 3
   byte for byte with the frozen line, `--force` too; the entry turned into a generated rule → an
   intact card is removed, an edited one stays; **card intact, linked file edited, entry goes stale
   → the card is removed and the linked file survives byte for byte**; a stack switch removes the
   old stack's intact cards; a rejected plan removes nothing; a card the user deleted is re-created on the next
   pass (§9, operator choice A); a pre-existing project file at the
   card path is untouched; `--dry-run` writes nothing; `prove-rules.mjs --remove` removes the intact
   card, keeps an edited linked file, names both; the staging loader (`RULES_DIR_OVERRIDE`, an Edit
   payload on a matching path) injects the body with `(see .ai-factory/rules-research/entries/…)`
   and never the marker; the glob-parity table (item 3); the s5 check (item 8). **After EVERY pass
   the test asserts the operator's invariant (entry 49):** `find .claude/hooks -name '*.md'` lists
   exactly what it listed before the card pass; `find .claude/rules -mindepth 2 -type f` prints
   nothing; `grep -rl --exclude-dir=.git 'getff-card: research' .` hits only `.claude/rules/*.md`.
   (c) Wire (b) into CI without shifting lines (principle 41): append
   ` && bash tests/install-sh/research-cards.test.sh` to the `run:` line of the
   rule-bootstrap-failure-loud step (`.github/workflows/audit-self.yml:1049` at `7a0b9634ef1`,
   `:1089` at `2855667cb34`; re-locate on staging).
   (d) `packages/core/audit-self/getff-measure-always-on.test.sh` (item 10), chained onto the same
   `run:` line: the predicate on a fixture table (a rule with `paths:`, one with only a
   `<!-- globs: -->` marker, one with only `events:`, one with only `on: read` → not resident; a
   rule with none of them and a card with `always-on: true` → resident), each row also run through
   s5's `check-rule-cards.sh --only shape`, asserting the meter's «resident» is exactly the set
   `SHAPE-TRIGGER` fails plus the `always-on: true` cards (one predicate, two readers, E21 condition
   2); a `claudeMdExcludes` entry drops its file; the derivation 48,671 → 54,000 and 50,000 →
   55,000 (the one recorded derivation, `check-alwayson-budget.sh:36-38`, and an exact multiple
   that must not round up); `AIF_ALWAYSON_CEILING` wins over the file.
10. **Shipped always-on meter and derived ceiling (E21)** — a capability commit of its own:
    - `packages/core/audit-self/getff-measure-always-on.sh`, harvested from
      `scripts/measure-always-on.sh` (`2855667cb34`) with three changes: `--root <project>`
      instead of its own checkout; population = `CLAUDE.md` + every `*.md` under `.claude/rules/`
      at any depth (native discovery reaches subdirectories, s5 §2.0 population, `:166-167`, V7); resident = a file
      with NO declared trigger — no `paths:`, no own-line `<!-- globs: -->` marker, no `events:`, no
      `on: read`, read with the loader's grammar (`inject-matching-rule.sh:251-284`, `:334`) — so a
      card with `always-on: true` counts. Excludes: the project's `claudeMdExcludes` through
      `scripts/lib/claude-md-excludes.sh` (`claude_md_excludes_load` / `_match`, lib `:73`, `:186`),
      sourced from beside the meter, never a second parser; without `jq` the lib leaves the list
      empty (`:21`), which overstates the set — the safe side, stated in the output. Output: the
      same JSON shape as the source (`total_bytes`, `sources[]`). getff's own
      `scripts/measure-always-on.sh` and `check-alwayson-budget.sh` stay untouched.
    - Ceiling: on the card pass's first run, when `.getff/mechanisms/research-cards.txt` does not
      exist, measure the resident set BEFORE any card is written; ceiling = baseline × 1.10 rounded
      UP to the next 1,000 B (integer: `ceil(baseline × 11 / 10000) × 1000`), written once through
      s4's `getff-mechanism-lib.sh` (s4 kickoff §Deliverables D1 «write once — refuses when the file exists»; path per s4
      OPEN-3 `.getff/mechanisms/<name>.txt`) as `[params]` lines `alwayson_baseline_bytes = <n>` and `alwayson_ceiling_bytes = <n>`,
      plus whatever section the helper's grammar requires (an empty `[starting-list 1]` if it
      insists — nothing is grandfathered here). Later passes read `alwayson_ceiling_bytes`;
      `AIF_ALWAYSON_CEILING`, when set, overrides it for that pass.
    - Delivery — fresh install AND refresh: `copy_safe` of the meter to
      `scripts/getff-measure-always-on.sh` (+ `chmod_safe +x`) and of the lib to
      `scripts/lib/claude-md-excludes.sh` in `setup.d/40-configs.sh` next to `prove-rules.mjs`
      (`:80`, `7a0b9634ef1`), AND both pairs added to the `do_refresh` pair list
      (`install.sh:1235-1251`, `7a0b9634ef1`, the `"<src>:<dst>"` loop that already carries
      `prove-rules.mjs`). `tests/install-sh/refresh-covers-full-delivery.test.sh` is the gate that
      a `copy_safe` delivery has its refresh twin; it must stay green with the two new pairs. The
      card pass itself runs the getff-clone copy (`$PKG_ROOT/...`), so an edited delivered copy
      cannot change what the installer measures.

## §3 Prior-art consult (run by the drafting session 2026-09-30; re-check, do not re-derive)

- SSOT: `prior-art-evaluations.md#183` (rule-bootstrapping bridge, BUILD — research → per-project
  artefacts; this stage adds the research-only branch), `#200` (AI-agent-config-sync family,
  ruler; BUILD for the unserved slice), `#125` (Copier `update`, ADAPT — the refresh capability),
  `#101` (native `paths:` frontmatter, ADAPT), `#238` (picomatch as Claude Code's path matcher —
  the glob proof reuses it, no new dependency).
- Cards — context7, three phrasings (first server «Monthly quota exceeded», second server used):
  (1) `/anthropics/claude-code` «generated rule files in .claude/rules with paths frontmatter loaded
  when matching file is read» → `.claude/rules/` since 2.0.64, `InstructionsLoaded` `load_reason:
  path_glob_match` — native loading, no new mechanism; (2) `/intellectronica/ruler` «… remove
  generated files, user edits» → `ruler revert` removes or restores, no freeze of a user edit;
  (3) `/copier-org/copier` «skip overwriting files the user modified on update» → `_skip_if_exists`
  — the freeze shape. Verdict: REUSE own stack (`getff_delivered` + `getff_bytes_intact`,
  `checkPlanFile`, s5's `--render-allowed-hosts`, `picomatch`); BUILD the renderer, the delivery
  helper and the card removal (no tool renders a research record into a rule card with a data file).
- Meter (§2 item 10, E21 condition 3) — SSOT: no row names `measure-always-on`, `check-alwayson-budget`
  or `claude-md-excludes` (`git show 2855667cb34:docs/meta-factory/prior-art-evaluations.md | grep`
  → no hit); nearest `#62` (Cursor «Always» type, vocabulary) and `#208` (shrinks the always-on set,
  does not measure it). context7, three phrasings, 2026-09-30: (1) `/anthropics/claude-code` «measure
  size of memory files CLAUDE.md and .claude/rules loaded at session start» → `InstructionsLoaded`
  and `SessionContextUsage`, runtime observation, not an install-time byte count; (2) same library,
  «claudeMdExcludes … which rules load without paths frontmatter» → no meter; (3) `/intellectronica/ruler`
  «budget total size of generated agent instruction files» → no size budget. Verdict: ADAPT own
  stack — harvest `scripts/measure-always-on.sh`, reuse `scripts/lib/claude-md-excludes.sh` verbatim.
- Capability commit: yes (new ≥80-LOC files under `packages/`). Trailers:
  `Prior-art: prior-art-evaluations.md#183 (research→artefact bridge, BUILD; the renderer extends it to research-only entries)`
  `Prior-art: prior-art-evaluations.md#125 (Copier update, ADAPT; skip-if-modified freeze reused via getff_delivered + getff_bytes_intact, no dependency)`
  `Prior-art: prior-art-evaluations.md#238 (picomatch, REUSE; the glob proof matches as Claude Code's native paths: does)`
  `Prior-art: scripts/measure-always-on.sh (harvested source of the shipped meter, ADAPT: --root, loader trigger predicate, any-depth rules population; excludes via scripts/lib/claude-md-excludes.sh, E21)`

## §4 Proof — RED first

- Write both tests (§2 item 9) first and run them against the landed code: paste the failing runs
  (no `--emit-cards` arm, no card on disk) into the PR body. Then GREEN.
- RED-first for the budget (E21), before item 10 exists: fixture A — a project whose resident
  set plus the one always-on candidate exceeds the derived ceiling (e.g. a `CLAUDE.md` of
  baseline bytes plus an untriggered rule written AFTER the mechanism file records the ceiling,
  leaving less headroom than the card's bytes) → the pass prints «not wired: no trigger, over
  budget» and writes no card; fixture B — the same project under the ceiling → the card with
  `always-on: true` is written. Both assert the budget line's numbers (`<bytes> of <ceiling>`,
  `<n>`, `<m>`) computed from the fixture's own bytes. Paste the RED run (no meter, no line).
- Every byte count the test asserts is computed in the test from the text it wrote
  (`Buffer.byteLength` / `printf '%s' | wc -c` under `LC_ALL=C`), never typed by hand.
- The host half is the lead's: one real consumer install with a real research file, then an edit
  and a re-install. Do not claim host numbers.

## §5 Exit gates

```bash host-verify
git grep -q 'export function checkPlanFile' HEAD -- packages/core/install/rule-bootstrap-cli.ts && git cat-file -e HEAD:packages/core/audit-self/prove-rules.mjs
git cat-file -e HEAD:packages/core/audit-self/check-rule-cards.sh
git cat-file -e HEAD:packages/core/audit-self/getff-mechanism-lib.sh
npx vitest run packages/core/install/research-cards.test.ts packages/core/install/rule-bootstrap-check-plan.test.ts packages/core/audit-self/prove-rules.test.ts
bash tests/install-sh/research-cards.test.sh
bash tests/install-sh/rule-bootstrap-failure-loud.test.sh
bash packages/core/audit-self/check-rule-cards.test.sh
bash packages/core/audit-self/getff-measure-always-on.test.sh
bash tests/install-sh/refresh-covers-full-delivery.test.sh
bash scripts/lib/claude-md-excludes.test.sh
NODE_ENV=development node scripts/build-runtime-bundles.mjs --check
SNAPSHOT_MODE=compare bash tests/install-sh/snapshot.sh
shellcheck setup.d/80-rule-bootstrap.sh setup.d/40-configs.sh tests/install-sh/research-cards.test.sh packages/core/audit-self/getff-measure-always-on.sh packages/core/audit-self/getff-measure-always-on.test.sh
! git grep -n '54000\|54,000' HEAD -- packages/core/audit-self/getff-measure-always-on.sh packages/core/install/research-cards.ts setup.d
npx vitest run packages/core/principles/41-shell-test-ci-coverage.test.ts
npx tsx scripts/check-line-citations.mjs
node scripts/check-docs-refresh.mjs "$(git merge-base origin/staging HEAD)..HEAD"
bash scripts/run-local-ci-sweep.sh
```

The snapshot gate compares AFTER the capture the stage commits: the two delivered files (§2 item
10) change every install fingerprint by exactly `scripts/getff-measure-always-on.sh` and
`scripts/lib/claude-md-excludes.sh`; the PR body shows that `SNAPSHOT_MODE=capture` diff and
nothing else. `check-line-citations` must be green without `--write` on any `.claude/rules/*` file. The
docs-refresh gate names the `docs/site/` pages that cite a touched file; refresh them or add
`docs-refresh: deferred — <reason>` (a comma inside the reason, never `: `).

## §6 Out of scope

- Base-core cards and anything under `.claude/hooks/getff-cards/` or the plugin `cards/` — this
  stage never writes there (D9; operator log entry 49 «do not mix them up»; asserted in §2 item 9 b).
- Delivery of the getff-cards directory to consumers (slice 4), the slice-5 checks and the
  `--render-allowed-hosts` mode themselves (s5), s4's `getff-mechanism-lib.sh` itself (used, not
  changed).
- **Named follow-up (D17, E21 condition 2): getff switches its own budget gate to the shipped
  meter** — `scripts/check-alwayson-budget.sh`, `scripts/measure-always-on.sh` and
  `pre-push.ts` section 5c stay exactly as they are in this stage (their `^paths:`-only predicate
  and getff's 54,000 B stand for getff); converging them on `getff-measure-always-on.sh` is a
  separate stage.
- Any file under getff's own `.claude/rules/` or `.claude/settings.json` — no agent and no factory
  run commits there in this build; getff has no `.ai-factory/rules-research/` of its own
  (`git ls-tree -r --name-only 7a0b9634ef1 .ai-factory` lists none), so it generates no card.
- A `--refresh` arm for cards (§1.2 parity), AGENTS.md / RULES.md rendering, a card for a
  «selected, but the generator made no rule from it» entry (§8 ATTN).

## §7 Falsifiers to write into the PR body

- A card or linked file lands under `.claude/hooks/`, or a card in a subdirectory of
  `.claude/rules/` → the two homes are mixed, or the hook never reads it (`:321`).
- A hand-edited card or linked file changes on the next pass, or a copy appears under
  `.ai-factory/refresh-conflicts/` → `refresh_safe` was reused and D10 is broken.
- An edited linked file is deleted because its card was intact → the sweep checked the pair as one.
- A rejected or failed plan deletes a card → the stale sweep ran on an unasked question.
- A card whose glob matches no file of the fixture tree is written → the glob proof is missing.
- An entry without `extras.paths` gets a `paths:` card, or gets no card and no «over budget» line →
  a third outcome exists.
- Pass 2 flips an always-on card to «over budget» → the base counted getff's own earlier cards.
- A card body over 1,000 bytes, or a cut inside a UTF-8 sequence → the loader injects a heading only.
- The marker or any text from the linked file appears in the loader's output → D18 broken.
- A gate-dropped entry (bad allowlist key) gets a card → the plan gate was bypassed.
- A project file at the card path without a baseline entry is overwritten → getff wrote over the project's own rule.
- `prove-rules.mjs --remove` deletes an edited card or linked file → removal ignores the freeze.
- `check-rule-cards.sh` reports a linked-file host finding on a generated file → the link did not
  come from a gate-kept provenance item, or the rendered host list is stale.
- The install fingerprints change by anything other than the two delivered meter files → a
  snapshot fixture gained a research file, or the pass runs without one.
- `54000` / `54,000` appears in a shipped file, or the meter counts a globs-only / `events:`-only /
  `on: read`-only rule as resident → getff's number or getff's `^paths:` predicate leaked into the
  consumer path (E21 conditions 1-2).
- A fresh install has `scripts/getff-measure-always-on.sh` and a `--refresh` of an older install
  does not receive it → the delivery pair is half-wired; `refresh-covers-full-delivery.test.sh`
  should have been red.
- The ceiling in `.getff/mechanisms/research-cards.txt` changes on a later pass → it was re-derived
  instead of written once (E21 condition 1, s4 write-once).

## §8 Report

`Stat` / `Verify` (each §5 gate, the RED-then-GREEN runs) / `DECISIONS` (the budget-fitting order,
the always-on base, the sanitising rules, the stale-sweep guard, the derived ceiling and its
baseline) / `ATTN` / `Confidence`. `Verify` quotes the fixture's budget line verbatim —
`always-on: <bytes> of <ceiling> — <n> candidates delivered, <m> not wired: over budget` (E21 /
E18 F1: numbers, never a bare green) — for fixture A and fixture B of §4. ATTN names the answer
to §1.4's unmeasured point (does Claude Code's native load skip a globs-only rule without an
exclude?) as measured or `INCONCLUSIVE — <why>`. ATTN must carry three counts from the fixture run and name their meaning: entries
«not wired: glob matches no file», entries «not wired: no trigger, over budget», and entries in the
rule table's third state «selected, but the generator made no rule from it»
(`prove-rules.mjs:1793`, `7a0b9634ef1`) — those are neither generated nor research-only, so they
get no rule AND no card; the report says so rather than letting them read as covered. The PR body
carries `## Fidelity verdict` (the lead adds it after the cold fidelity round) and the §1.7
Forward-check / Backward-check sections.

## §9 AI traps ([ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md))

Active traps for this stage: **T2** run the install passes, do not describe them · **T3**
command-or-`file:line` for every claim · **T6** confidence as predicates · **T14** a green run over
a fixture with no edited card, no edited linked file and no stale card is not coverage of the
freeze · **T19** own cold review of the diff before handoff · **T21** cold
`agents/backward-sweep-auditor.md` on the class «an installer step that writes a generated file
into a directory the project also owns and must leave a human edit alone» — the other
`copy_safe` / `refresh_safe` callers that write into project-owned paths are the candidates.

**OPEN (for the lead, not the worker):** none. (1) CLOSED by the advisor verdict E21 (§0,
`_advisor-trigger-build.decisions.md#e21`): the ceiling is derived per install (baseline × 1.10,
rounded up to the next 1,000 B, written once to `[params]`, `AIF_ALWAYSON_CEILING` overrides), the
predicate is the loader's, the meter ships as its own capability (§2 item 10); the earlier
«constant unset → everything over budget» fallback is withdrawn. (2) CLOSED by the operator (2026-09-30, explicit choice A in the lead session): a deleted card is re-created on the next pass (parity with lint rules, which
`place_lint_rules` re-places every pass); removal on purpose goes through `--remove` (§2 item 7).
Basis: the operator's card decision (log entry 49, reading the advisor's entry-48 model «removable
like generated lint rules»). The tombstone alternative (a baseline key with no file = removed on
purpose, as Copier skips deleted paths) is not built. Closed since the
first draft: the `paths:` source (E18 F2 = A, §2 items 1 and 3), the s5 check path (§2 item 8), and
the Tier-0 host contradiction (E18 F3 = B: the link comes from a gate-kept provenance item, the
check reads the resolver-rendered union list, §1.1 and §2 item 6).

**T-TBRC-A (domain):** `refresh_safe` looks like the right verb — it is the refresh baseline's own
writer — but it preserves an edit and then OVERWRITES it (`lib.sh:1256-1264`, `808e806c606`). The
freeze is `getff_delivered && ! getff_bytes_intact`, checked per file; assert it with a
byte-for-byte compare of the edited card AND of the edited linked file after a pass, never with the
absence of a warning.
