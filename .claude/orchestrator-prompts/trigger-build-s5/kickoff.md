# trigger build, slice 5 — the card checks (shape, two homes, research linked files)

> **Class:** stage kickoff (dispatch input), single stage. **Base branch:** `staging`.
> **Branch:** `feat/trigger-build-s5-card-checks`. **PR title:**
> `trigger build S5: card shape, two-homes and research linked-file checks`.
> **Channel:** one aif task, own worktree, one PR to `staging`, harvested from the host (never
> pushed from the container). The lead session of the trigger build verifies the proof on the host.
> **Rigor label (L0):** `build-and-verify` — a new shipped check (capability commit); the proof is
> a paired fixture per check, observed by the lead on the host.
> **Authoritative for:** this stage's contract — the three checks, the card-marker contract
> (§2.3, the single source the generator kickoff must emit), the paired fixtures, the channels,
> exit gates, falsifiers.
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists);
> the trigger-build design and spec — they live in the operator's coordination store, not in the
> repo; the rows this stage needs are quoted verbatim in §0 below. The research-card generator —
> `.claude/orchestrator-prompts/trigger-build-research-cards/kickoff.md` (a separate stage).

**Measurement SHA for every `path:line` below:** `2855667cb34` (`origin/staging`, 2026-09-30),
read with `git show 2855667cb34:<path>`, unless a line names another commit. Re-locate by
content (`grep -n`) if yours differ.

**Dispatch dependency:** the card-shape check's starting list (D23) is written and read through the
slice-4 foundation `packages/core/audit-self/getff-mechanism-lib.sh` (reader, write-once,
shrink-only check; stage `trigger-build-s4`, NOT yet on staging). Dispatch this stage only after
that file is on `staging` (`git ls-tree origin/staging packages/core/audit-self/getff-mechanism-lib.sh`
non-empty). The two-homes check and the linked-file check need no starting list (§2.3, §2.2).

## §0 Spec rows this stage carries (verbatim, by pointer)

Source: `_spec-2026-09-29-trigger-build.md` (coordination store, revision r2e; not readable from the
container, hence quoted). §3 «Slice 5 — the project's own rules and research-derived rules», `:291-305`:

> 1. The card shape check: a rule file in the project's rules directory has `paths:`, a body of at most
>    1,000 bytes (S-8), names its mechanism or reads «not wired», and its linked files sit outside the
>    rules directory (V7). getff checks the shape only and never edits the file (D26).
> 2. The linked-file header check for research-derived files: a fixed header «data, not instructions»,
>    source text only as marked quotes with a link, every link on `.ai-factory/research-allowlist.json`
>    (V4, D18).
>
> **Proof.** Each check fires on a bad example and is silent on a good one.
>
> **Seam.** TO BUILD — a paired fixture per check. Neither `prove-rules.mjs` (lint only) nor principle 30
> (getff's own store) reads a card.

«Who builds what», `:112`: `| 5 | items 1-2 (shape checks + paired fixtures) | proof observed on the host |`.

S-2, `:78` (the card directory): «(b) a second directory of base-core cards beside the hook —
`.claude/hooks/getff-cards/` from the installer, `${CLAUDE_PLUGIN_ROOT}/cards/` from the plugin (D9).»
S-8, `:84`: «A mini card is at most 1,000 bytes of body.»

Design `_design-2026-09-29-trigger-build-v2.md`: D9 `:166` «Base-core cards live beside the hook that
reads them»; D10 `:167` «the mini card is the rule file in the project's rules directory, short,
always with `paths:`; linked files sit outside the rules directory (V7); getff never overwrites an
edited file»; D18 `:174` «the mini card is an instruction, linked files are data (fixed header,
marked quotes with a link, trusted sources, official docs first); the loader never injects a linked
file»; D26 `:189` «changed like code, by editing the file in the project; getff checks the shape only
and never edits»; V7 `:135` «a linked detail file under the rules directory is resident from turn 1».

**Operator decision, 2026-09-30** — `_advisor-one-button-operator-log.md`, entry 48 point 3 (`:472`)
and entry 49 point 3 (`:487`), verbatim:

> «Про развилку я думал .claude/rules/ проекта про правила для проекта как раз гинерируемые а то что
> базовое идет и ставится сразу в .claude/hooks/getff-cards/  - я видимо заблуждался? смотри  тут нужно
> хорошенько подумать - впрочем мы же это все уже обдумывали и проектировали, какое решение? и как
> следовать ему? я хз думай и подсказывай мне как сделать лучше»
>
> «3 главное при реализации не перепутай!»

The advisor's recorded reading of entry 49 (`:493-495`): «The card fork is DECIDED by this line:
generated research-only cards → the project's `.claude/rules/` (getff-marked, refresh-baseline,
removable); base-core cards → `.claude/hooks/getff-cards/`; «do not mix them up» is the
implementation invariant.» The operator asked that «do not mix them up» be a CHECKED assertion,
not prose (lead's task brief, 2026-09-30) — that is §2.3.

## §1 Facts measured at `2855667cb34`

- **The loader reads two card homes.** `.claude/hooks/inject-matching-rule.sh:85`
  `RULES_DIR="${RULES_DIR_OVERRIDE:-$REPO_ROOT/.claude/rules}"`; `:87`
  `CARDS_DIR="${CARDS_DIR_OVERRIDE:-$(cd "$(dirname "$0")" && pwd)/getff-cards}"`; `:88`
  `CARD_LIMIT=1000   # bytes of card body (S-8)`. It reads only the top level of each (`:321`
  `"$RULES_DIR"/*.md "$CARDS_DIR"/*.md`). What it injects: the `inject:` summary, else the card body
  when `wc -c` ≤ `CARD_LIMIT`, else the first heading (`:346-355`); the body is everything after the
  frontmatter minus own-line HTML comments (`card_body`, `:287-295`). The pointer names the card's
  `depth:` entries (`:358-359`), else `.claude/rules/<slug>.md` for a project rule (`:360-361`).
  Frontmatter keys read: `paths|events|depth|on` only (`:273`).
- **No card marker and no card directory exist yet.** `git ls-tree -r --name-only 2855667cb34 | grep -iE 'getff-cards|/cards/'`
  → 0 lines. `git grep -nE 'getff-card' 2855667cb34` → only the `CARDS_DIR` line above and one
  mention in `trigger-build-s2/kickoff.md:147`. Nothing tells a base-core card from a generated one
  today; §2.3 defines the marker.
- **Existing getff ownership convention.** Files getff generates carry the phrase `generated by getff`,
  and getff's own code keys off it (`setup.d/lib.sh:1562`, `:1591`, `:1775`). The own-line HTML
  comment form is dropped from the injected body by the loader (`inject-matching-rule.sh:292`), so a
  marker in that form costs the agent's context nothing.
- **Base-core row ids** (not on staging; P4 on `join/one-button-union` `808e806c606`,
  `skills/getff/references/base-core.md`): 100 table rows, ids `A`–`J` + 1-2 digits (`A1` … `J2`),
  measured with `grep -oE '^\| [A-Z][0-9]+ '`.
- **getff's own rules fail the shape today.** Over the 30 `.claude/rules/*.md` files at
  `2855667cb34` (the loop in the lead's session, 2026-09-30): 19 carry `paths:`; the 11 others none;
  0 carry a `Mechanism:` line; every file body is over 1,000 bytes (smallest
  `attention-is-not-a-mechanism.md`, 2,629 B); `inject:` summaries run 120-790 B on 17 files, absent on
  13. So under any reading all 30 fail at least one shape clause — hence the starting list (§2.1).
- **The research allowlist file holds hosts, not URLs.** Ack entry shape
  `{key, hosts[], scope?, reason, ackedBy, ackedAt}` (`packages/core/research/allowlist-resolver.ts:45-52`);
  host match is segment-safe, `host === a || host.endsWith('.' + a)` (`:34-36`). Tier-0 official-doc
  hosts (`react.dev`, `nextjs.org`, …) live in TypeScript, `packages/core/research/allowlist.ts:20-43`,
  NOT in that file (see OPEN-1).
- **Seam: nothing reads a card today.** Principle 30 reads only the research store:
  `packages/core/principles/30-research-source-trust.test.ts:60`
  `['ls-files', '-z', 'packages/core/research/store/**/*.json']`. `prove-rules.mjs` is not on staging
  (`git ls-tree -r --name-only 2855667cb34 | grep prove-rules` → 0); on `808e806c606` it is a lint-rule
  table (`packages/core/audit-self/prove-rules.mjs:1-12`) and
  `grep -nE '\.claude/rules|getff-cards|cards/|depth:'` over it → 0 lines.
- **Delivery precedent for a shipped check.** Shipped audit scripts live in
  `packages/core/audit-self/*.sh` and install as `scripts/<name>.sh` through the pair list at
  `install.sh:1132-1147` (e.g. `:1135` `check-rule-globs.sh`). The shipped pre-commit template
  `packages/core/templates/shared/husky-pre-commit.sh` runs one shipped script before lint-staged
  (`:20-24`, `check-zcode-mirror.sh`; `:25` `npx lint-staged`). Pre-push sections are registered in
  `packages/core/hooks/pre-push.ts` with an owner (`:2613` `rule-globs` owner `consumer`; `:2714`
  `lychee` owner `both`). Note `ruleGlobsSection` (`:1066-1072`) is silent when its script is missing —
  do NOT copy that shape (§2.4).
- **CI wiring point that shifts no line:** `.github/workflows/audit-self.yml:138`
  `run: bash packages/core/audit-self/pre-merge-local.test.sh`.

## §2 Deliverables

One script, three checks, one fixture test, wiring. Everything is read-only against the project:
the script never writes, moves or rewrites a card, a linked file or the allowlist (D26).

### §2.0 The script

`packages/core/audit-self/check-rule-cards.sh` — bash, `jq` only when a research card exists
(§2.2). Arguments with defaults: `--root` (git top level, else `$PWD`), `--rules-dir`
(`.claude/rules`), `--cards-dir` (repeatable; default: `.claude/hooks/getff-cards` and, when it
exists, `plugin/cards` — the plugin's `${CLAUDE_PLUGIN_ROOT}/cards/` in the getff source tree),
`--allowlist` (`.ai-factory/research-allowlist.json`). Population: every `*.md` at ANY depth under
the rules directory (V7: native discovery reaches subdirectories) and under each card directory.

Output: first a population line `RULE-CARDS rules=<n> cards=<n> research=<n> linked=<n>` (so a green run
over an empty population reads as empty, not clean), then one line per finding,
`<CHECK-ID> <path>: <what is wrong> — <how to fix>`. Exit 0 = no finding outside the starting list;
1 = a finding; 2 = unusable input (unreadable allowlist JSON, `jq` missing while a research card
exists) — fail closed, never a skip.

Frontmatter is read with the loader's grammar (`inject-matching-rule.sh:47-50`, `:251-284`): `paths:`
and `depth:` as a scalar, a flow list or a `- item` block. The card text is what the loader injects:
the `inject:` summary when present, else `card_body` (`:287-295`). This is a second reader of one
format — the `#sync-by-copy-paste` risk of `dual-implementation-discipline.md:199`; the parity case in
§2.5 pins it to the loader.

### §2.1 Check 1 — card shape (spec item 1; ids `SHAPE-*`)

For every file in the rules directory:

- `SHAPE-PATHS` — frontmatter has a non-empty `paths:`.
- `SHAPE-SIZE` — the card text is at most 1,000 bytes (`wc -c`, bytes — S-8 and the loader's `:349`
  use bytes, not characters). See OPEN-4 on which text is measured.
- `SHAPE-MECH` — the card text holds exactly one line `Mechanism: not wired` or
  `Mechanism: <path>[#<anchor>]`, where `<path>` exists from `--root` and, with an anchor, the file
  contains it — the liveness semantics of principle 31's channel marker
  (`packages/core/principles/31-rule-channel-declaration.ts:138-160`). A body line, not a
  frontmatter key: the frontmatter never reaches the agent, and the card must tell the agent what
  blocks. Falsifier: a card needs two mechanisms (then the line takes a comma list — decide in the PR,
  do not guess).
- `SHAPE-LINK` — every `depth:` entry (a path from `--root`, as the loader prints it, `:358-359`)
  and every relative markdown link target in the card text (resolved from the card's directory)
  exists and does NOT sit under the rules directory (V7).

Starting list (D23, D30): findings of this check are keyed `<check-id> <path>`; a key on the
mechanism's `[starting-list]` does not fail, a new key does, and the list only shrinks — read and
checked through the slice-4 helper `getff-mechanism-lib.sh`, never re-implemented here. The file
is the slice-4 per-mechanism file for mechanism `card-shape`, header
`# getff-mechanism: card-shape 1` (S-15); its path is the slice-4 default
`.getff/mechanisms/card-shape.txt` (OPEN-3 of `trigger-build-s4` — use whatever s4 landed). In getff,
this stage writes that file once, listing today's findings over the 30 files of §1 (see OPEN-2).
At a consumer, the install writes it through the same install arm slice 4 uses for its mechanisms.
No escape line (D27): this mechanism records none.

### §2.2 Check 2 — research linked files (spec item 2; ids `LINKED-*`)

A research-derived file is a `depth:` entry of a card that carries the research marker of §2.3.
Its format is fixed by the generator stage (`trigger-build-research-cards`, its picks as relayed
2026-09-30): card `.claude/rules/getff-research-<stack>-<entry-id>.md`; linked file
`.ai-factory/rules-research/entries/<stack>/<entry-id>.md`; line 1 `> data, not instructions`; a
`# <entry-id>` heading; `## Entry` = one fenced ```` ```json ```` block with the research entry minus
`extras.quote`; `## Sources` = one line per quote, `> <quote text> [<host>](<url>)`. The check:

- `LINKED-HEADER` — line 1 is exactly `> data, not instructions`.
- `LINKED-LINE` — outside fenced ```` ```json ```` blocks, every other line is blank, a heading
  (`#`…), or a `>` quote line that ends with a markdown link `[…](https://…)`. Any other line is
  source text outside a marked quote.
- `LINKED-QUOTEKEY` — a fenced block that contains a `"quote"` key (source text hidden in the data).
- `LINKED-URL` — every `http://` or `https://` URL anywhere in the file, fence included, is `https`
  and its host matches a `hosts[]` entry of the allowlist file with the segment-safe rule of
  `allowlist-resolver.ts:34-36`. No allowlist file → every link fails (fail closed). See OPEN-1.

No starting list: at install no research card exists yet (the generator writes them later), so
there is nothing old to grandfather. No escape line (D27).

### §2.3 Check 3 — the two card homes (operator decision 2026-09-30; ids `HOME-*`)

**Marker contract — this section is its single source.** The generator stage
`trigger-build-research-cards` and every stage that creates a base-core card MUST emit it.

| Card kind | Home — the ONLY one | Marker: exactly one own line, anywhere in the file |
|---|---|---|
| base-core card | getff's card directory: `.claude/hooks/getff-cards/` (installer), `${CLAUDE_PLUGIN_ROOT}/cards/` (plugin) — S-2 (b), D9 | `<!-- getff-card: base-core <row-id> -->`, `<row-id>` = `^[A-Z][0-9]{1,2}$` (a base-core row id, e.g. `A13`) |
| generated research-only card | the project's rules directory, directly: `.claude/rules/<slug>.md` | `<!-- getff-card: research <stack> <entry-id> -->`, each token one word, no spaces |
| the project's own rule (D26) | the project's rules directory | none |

A marker line matches `^<!-- getff-card: (base-core|research) .* -->$`; the loader drops it from the
injected text (`inject-matching-rule.sh:292`).

The assertion, each case its own finding:

- `HOME-H1` — a file under the rules directory carries a `base-core` marker.
- `HOME-H2` — a file under the rules directory whose card body (`card_body` semantics, markers
  excluded) is byte-identical to the body of a card in any card directory: an unmarked copy of a
  base-core card. Declared limit (D24): an EDITED copy with its marker removed is not detected.
- `HOME-H3` — a file under a card directory carries a `research` marker.
- `HOME-H4` — a file under a card directory without a well-formed `base-core` marker: the card
  directory holds base-core cards only, so each must say so (this closes H3's blind spot — an
  unmarked research card there). See OPEN-5.
- `HOME-MARKER` — a file with two or more `getff-card:` lines, or a `getff-card:` line that does not
  match the grammar above, in either home.
- `HOME-SUBDIR` — a research-marked card below a subdirectory of the rules directory (the loader
  reads only the top level, `:321`, so it would never inject).

No starting list and no escape line: the operator's «не перепутай» is an invariant, not debt.
Today the population is empty in getff (§1: no card directory, no marker), so in getff this check
is green with `cards=0 research=0` printed — never report that as «clean» (T14).

### §2.4 Wiring — channel choice

Per `.claude/rules/rule-enforcement-channel-selection.md` §1 axis 1 and §3 steps 1-2 (read at
`2855667cb34`): all three checks are mechanically detectable → a gate, fired on the action before
falling back to pre-push, CI last. The action that creates a card is a COMMIT: the generator writes
files by script, and a person or an agent may write them by hand. An edit-time `PostToolUse` gate
sees only agent `Edit|Write` and never the generator's writes, and it needs a new hook plus a
registration in getff's `.claude/settings.json`, which only the operator can land (spec S-6). So:

1. **pre-commit (earliest channel that sees every writer).** getff: a section in `.husky/pre-commit`,
   placed before `# ── Plugin twin regeneration` (`:341`), `fail=1` on exit ≠ 0. Consumer: a block in
   `packages/core/templates/shared/husky-pre-commit.sh` before `npx lint-staged` (`:25`), in the
   shape of its `check-zcode-mirror` block (`:20-24`) — but a missing script is `exit 1` naming
   `install.sh --refresh`, unless `scripts/check-rule-cards.sh.override.md` marks it project-owned (the
   Layer-3 escape that block already names). Stays inside the template's <5 s budget (`:2`).
2. **pre-push (durable backstop)** — a section `rule-cards` with owner `both` in
   `packages/core/hooks/pre-push.ts`: getff layout runs `packages/core/audit-self/check-rule-cards.sh`,
   consumer layout `scripts/check-rule-cards.sh`; a missing script at a consumer fails as above.
   It must NOT copy `ruleGlobsSection`'s silent skip (`:1066-1072`,
   `attention-is-not-a-mechanism.md` §1).
3. **Delivery:** add the pair
   `packages/core/audit-self/check-rule-cards.sh:scripts/check-rule-cards.sh` to `install.sh:1132-1147`.
4. **CI:** principle 41 (`packages/core/principles/41-shell-test-ci-coverage.test.ts`) turns a new
   `*.test.sh` red until a workflow runs it. Chain the fixture test onto `audit-self.yml:138`
   (`… pre-merge-local.test.sh && bash packages/core/audit-self/check-rule-cards.test.sh`) and update
   that step's `name:` on the same line — **insert no line**: an inserted line shifts `path:line`
   citations in files this stage cannot edit (`.claude/rules/*`), and the pre-push
   `check-line-citations` gate then refuses the push (measured by the lead 2026-09-30: 11 stale
   citations from a 10-line insertion near `:662`). The same care applies to `install.sh` and
   `pre-push.ts`: run `npx tsx scripts/check-line-citations.mjs` after every wiring edit; a stale
   citation in a file you may edit, fix; one inside `.claude/rules/*`, move your insertion instead.

Declared limits (write them in the script header): edit-time is not a channel of these checks;
lanes whose installed hooks do not run the shared husky template or `pre-push.ts` (measure at start
with `grep -n 'husky-pre-commit\|pre-push' setup.d/4*.sh`) are a declared limit, named in the PR.

### §2.5 The fixture test

`packages/core/audit-self/check-rule-cards.test.sh` — builds every project in `mktemp -d`, no
network, no host state; exact-exit and exact-finding-line asserts. One GOOD project (silent,
exit 0, population line with exact counts) and, for EACH finding id of §2.1-§2.3, one BAD project
that differs from the good one by exactly that defect (exit 1, exactly that id on that path).
Mandatory seeded swaps for §2.3: a base-core card copied into `.claude/rules/` WITH its marker (H1);
the same copy with the marker stripped (H2); a research card placed in `getff-cards/` (H3); an
unmarked file in `getff-cards/` (H4); a research card in `.claude/rules/sub/` (HOME-SUBDIR). Plus:

- read-only: `shasum` of every fixture file before and after a run is identical (D26);
- starting list: a listed old finding is silent, a new one of the same kind fails, and a list that
  grew against its first-writing commit fails through the s4 helper;
- `jq` absent from `PATH` with a research card present → exit 2; with none → exit 0;
- allowlist absent → `LINKED-URL` on every link;
- parity with the loader: run `inject-matching-rule.sh` with `RULES_DIR_OVERRIDE` /
  `CARDS_DIR_OVERRIDE` on the good project's cards and assert its pointer names the same `depth:`
  entries, and its injected text is the same text the checker measured for `SHAPE-SIZE`.

### §2.6 getff first (D12, D17, D21)

The pre-commit and pre-push sections run on getff's own tree in this PR. Record in the PR body the
population line from `bash packages/core/audit-self/check-rule-cards.sh` over getff and the
per-mechanism file you wrote (§2.1). Consequence to state plainly in the PR: from this PR on, a NEW
file in getff's `.claude/rules/` must be card-shaped (OPEN-2).

### §2.7 SSOT row

Append one row to `docs/meta-factory/prior-art-evaluations.md` with the next free ID at commit time
(297 is the last on `2855667cb34`; parallel stages append too — re-read just before writing), per
§3 below: verdict, rationale, trigger to revisit.

## §3 Prior-art consult (run by the drafter 2026-09-30; re-check, do not re-derive)

- SSOT: **row 101** (Claude Code native `paths:` — the frontmatter this check requires, not a checker);
  **row 61** (OhMyOpencode `rulesInjector` — injection, no shape check); **row 186** (cargo-vet — the shape of
  the ack file whose hosts `LINKED-URL` reads); **row 251** (markdownlint custom rules — BUILD then:
  markdownlint runs per staged file and cannot cross files); **row 17** (markdownlint-cli2 at pre-commit).
- context7 (first server out of monthly quota; the second answered), three phrasings:
  (1) `/davidanson/markdownlint` «custom rule that validates YAML front matter keys and limits body
  size» → `params.frontMatterLines` and the `frontMatterHasTitle` helper: a per-file key check only;
  (2) resolve «remark-lint-frontmatter-schema» → `/remarkjs/remark`, `/adrg/frontmatter`,
  `/eyeseast/python-frontmatter` — parsers, no shape rule; `/remarkjs/remark` «lint plugin that checks
  every link points to an allowed host list» → `unist-util-visit` link extraction, a plugin to write,
  not a rule to adopt; (3) `/websites/code_claude` «validate or lint `.claude/rules` memory files; keep
  untrusted fetched content from being treated as instructions» → permission rules and paste marking
  only, no rule-file validator.
- Verdict: **BUILD** in the repo's own stack (bash, the loader's grammar, principle 31's liveness
  semantics, the ack-file host rule). Every candidate is per-file; checks 1 (link outside the dir)
  and 3 (a body equal to one in another directory) are cross-file and cross-directory, and a
  remark/markdownlint route adds a Node dependency to lanes that have none. Trigger to revisit:
  markdownlint or remark ships a cross-file rule API, or Claude Code ships a rule-file validator.
- **Capability commit: YES** — a new file ≥80 LOC under `packages/`
  (`packages/core/audit-self/check-rule-cards.sh`). Trailer:
  `Prior-art: prior-art-evaluations.md#<new-ID> (card checks — markdownlint/remark per-file only, BUILD in own stack; see row 251)`.

## §4 Proof — RED first

- Write the fixture test first and run it with the script absent: paste the failing run into the PR
  body. Then GREEN.
- Every expected finding line and count is derived from the fixture the test wrote, never typed
  from a run's output.
- The host half is the lead's: it runs the script over getff and over one fresh install. Do not claim
  host results.

## §5 Exit gates

```bash host-verify
bash packages/core/audit-self/check-rule-cards.test.sh
bash packages/core/audit-self/check-rule-cards.sh
shellcheck packages/core/audit-self/check-rule-cards.sh packages/core/audit-self/check-rule-cards.test.sh
npx vitest run packages/core/principles/41-shell-test-ci-coverage.test.ts packages/core/hooks/inject-matching-rule.test.ts
npx tsx scripts/check-line-citations.mjs
SNAPSHOT_MODE=capture bash tests/install-sh/snapshot.sh && git diff --stat tests/install-sh/
node scripts/check-docs-refresh.mjs "$(git merge-base origin/staging HEAD)..HEAD"
bash scripts/run-local-ci-sweep.sh
```

Never pass `--write` to `check-line-citations.mjs` for a file under `.claude/rules/`. The snapshot
capture regenerates the install fingerprints the new `scripts/check-rule-cards.sh` and template
change touch; commit the regenerated baselines. The docs-refresh gate names any `docs/site/` page
citing a touched file; refresh it or add `docs-refresh: deferred — <reason>` (a comma inside the
reason, never `: `).

## §6 Out of scope

- The research-card generator (`trigger-build-research-cards`) — this stage only checks its output.
- Any file under `.claude/rules/` or `.claude/settings.json` — no agent and no factory run commits
  there in this build (spec `:113-118`, `[op V8]`). A change there is the lead's operator patch.
- Creating or delivering base-core cards or `getff-cards/` to consumers (slice 4, spec §4 HO-6 row).
- An edit-time hook for these checks; the loader `inject-matching-rule.sh` (unchanged).
- Tier-1 (dependency-derived) research hosts.

## §7 Falsifiers to write into the PR body

- A base-core card in `.claude/rules/`, marked or byte-identical, passes → the two homes can be mixed up.
- A research card in `getff-cards/` passes, or an unmarked file there passes → the same, the other way.
- A green run prints no population line, or prints `cards=0` without saying so → an empty population
  read as clean.
- A card whose `depth:` file sits under `.claude/rules/` passes → V7 residency is back.
- A linked file with a plain prose line, a `"quote"` key in its fence, or a link to a host off the
  allowlist passes → D18 data/instruction split broken.
- The script changes any byte of a fixture file → D26 broken.
- A new card-shape finding passes because the starting list grew → D23 shrink-only broken.
- The checker's measured text differs from the loader's injected text on the same card → two readers
  of one format drifted.

## §8 Report

`Stat` / `Verify` (each §5 gate, the RED-then-GREEN runs, the getff population line) / `DECISIONS`
(the `Mechanism:` line grammar, the lane measurement of §2.4, how each OPEN below was resolved if the
lead answered) / `ATTN` / `Confidence`. The PR body carries `## Fidelity verdict` (the lead adds it
after the cold fidelity round on the host) and the §1.7 Forward-check / Backward-check sections.

## OPEN — for the lead, before dispatch (default applies if unanswered)

- **OPEN-1** Allowlist reach. The spec says «every link on `.ai-factory/research-allowlist.json`»;
  that file holds only Tier-2 acks, while D18 says «official docs first», and official-doc hosts are
  Tier 0 in TypeScript (`allowlist.ts:20-43`). The literal reading fails a `react.dev` quote unless it is
  acked. Default: the literal reading (file hosts only). Alternative: Tier 0 ∪ Tier 2 through
  `resolveAllowedSources` + `hostMatches` (`allowlist-resolver.ts:188`, `:34`), which needs a Node
  entry point shipped to consumers.
- **OPEN-2** getff first vs its own rules. With a starting list over the 30 files, every NEW
  `.claude/rules/*.md` in getff must be a card (≤1,000 B injected text, `paths:`, `Mechanism:` line).
  Default: yes, as D10 + D12 read. Alternative: in getff the check covers only files added after this
  PR — then say so as a declared limit.
- **OPEN-3** The per-mechanism file path — `trigger-build-s4` OPEN-3 (default `.getff/mechanisms/<name>.txt`).
- **OPEN-4** Which text S-8 measures when a rule has an `inject:` summary. Default: the injected text
  (loader `:346-355`, and S-3's falsifier in spec `:79`). Alternative: the whole body always.
- **OPEN-5** The HO-6 docs-SSOT card (spec §4 HO-6 row) rides `getff-cards/` but may not be a base-core
  row; H4 then fails it. Default: it gets a base-core row id. Alternative: a third marker kind
  `getff` for getff-shipped non-base-core cards, allowed only in the card directory.
- **OPEN-6** D24's false-fire measurement (spec S-10, slice 4 machinery) on getff's history is vacuous
  here (no card existed before this build). Default: not run; the checks are exact over their grammar
  and their limits are declared.

## §9 AI traps ([ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md))

Active traps for this stage: **T2** run each check, do not describe what it would print · **T3**
command-or-`file:line` for every claim · **T6** confidence as predicates · **T14** a green run over
getff's empty card population is «no population», not «clean» — the population line says so ·
**T15** getff first: the check runs on getff's own tree in this PR · **T19** own cold review of the
diff before handoff · **T21** cold `agents/backward-sweep-auditor.md` on the class «a shipped check that
reads the project's `.claude/rules/` and must not write it» — `check-rule-globs.sh`,
`check-rule-enforced.sh`, principle 31, `render-rule-index.mjs` are the candidates.

**T-TB5-A (domain):** the swap check is only as good as the directory it reads. A `HOME-H1` grep run
over the card directory instead of the rules directory (or the two `--*-dir` defaults crossed) is
green on every fixture that seeds only one home — that is why §2.5 seeds each swap in BOTH directions
and asserts the exact id and path, and why the good project has a card in each home.
