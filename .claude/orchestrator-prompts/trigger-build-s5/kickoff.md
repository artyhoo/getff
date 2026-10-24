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
> the trigger-build design, spec and advisor verdicts — they live in the operator's coordination
> store, not in the repo; the rows this stage needs are quoted verbatim in §0 below. The research-card
> generator — `.claude/orchestrator-prompts/trigger-build-research-cards/kickoff.md`. The
> per-mechanism file, its helper and the mechanism call shape — `trigger-build-s4/kickoff.md` §2 D1-D2.

**Measurement SHA for every `path:line` below:** `2855667cb34` (`origin/staging`, 2026-09-30),
read with `git show 2855667cb34:<path>`, unless a line names another commit. Re-locate by
content (`grep -n`) if yours differ.

**Dispatch gate:** §OPEN lists the items the lead closed before dispatch (all closed 2026-09-30). A worker that finds an `OPEN:` still open stops and reports; it never picks a value.

**Worker STOP (dependency):** before any edit, run
`git ls-tree origin/staging packages/core/audit-self/getff-mechanism-lib.sh`. Empty output → STOP and
report «s4 foundation not on staging»; do not build a stand-in for it. The card-shape mechanism
(§2.1) stands on that helper (stage `trigger-build-s4`, §2 D1). The two-homes and linked-file checks
need no starting list, but the stage ships as one PR, so the whole stage waits.

## §0 Spec rows this stage carries (verbatim, by pointer)

Source: `_spec-2026-09-29-trigger-build.md` (coordination store, revision **r2f**; not readable from
the container, hence quoted). §3 «Slice 5 — the project's own rules and research-derived rules»,
`:291-307`:

> 1. The card shape check: a rule file in the project's rules directory has a declared trigger — `paths:`,
>    `events:`, `on: read`, or the always-on mark (r2f, E18 F2) — a body of at most
>    1,000 bytes (S-8), names its mechanism or reads «not wired», and its linked files sit outside the
>    rules directory (V7). getff checks the shape only and never edits the file (D26).
> 2. The linked-file header check for research-derived files: a fixed header «data, not instructions»,
>    source text only as marked quotes with a link, every link's host allowed by the research resolver's
>    union — Tier 0 ∪ Tier 1 ∪ acked Tier 2 (`.ai-factory/research-allowlist.json` is Tier 2 only) —
>    through the EXISTING resolver, never a second reader of the JSON (r2f, E18 F3; V4, D18).
>
> **Proof.** Each check fires on a bad example and is silent on a good one.
>
> **Seam.** TO BUILD — a paired fixture per check. Neither `prove-rules.mjs` (lint only) nor principle 30
> (getff's own store) reads a card.

«Who builds what», `:112`: `| 5 | items 1-2 (shape checks + paired fixtures) | proof observed on the host |`.
S-2, `:78`: «(b) a second directory of base-core cards beside the hook — `.claude/hooks/getff-cards/`
from the installer, `${CLAUDE_PLUGIN_ROOT}/cards/` from the plugin (D9).» S-8, `:84`: «A mini card is
at most 1,000 bytes of body. Basis: the 17 existing `inject:` summaries are 119-789 B (V1)».

Advisor verdict E18 (`_advisor-trigger-build.decisions.md#e18`, 2026-09-30), F3, verbatim: «The check
calls the existing resolver (`resolveAllowedSources` / `validateProvenance` with a ctx), never a second
reader of the JSON» … «Wrong if: the resolver cannot be called from the check's channel — then the
check reads a list the resolver RENDERS, never its own copy of the tiers.» F2 (consequence for item 1)
is the r2f wording quoted above.

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
implementation invariant.» E18 F2 repeats it: «The kickoff states this invariant and its check.»
The operator asked that «do not mix them up» be a CHECKED assertion, not prose — that is §2.3.

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
  → 0 lines. `git grep -n 'getff-card' 2855667cb34` → 3 hits, none a marker: the `CARDS_DIR` line
  above; `trigger-build-s2/kickoff.md:147` (slice 2 needs no card); and
  `docs/superpowers/specs/2026-09-30-docs-single-source-design.md:112`, which places the docs-SSOT
  «one-source rule» as «a card-only rule under `.claude/hooks/getff-cards/` (installer) or the plugin's
  `cards/`» — a card that is not a base-core row, so it bears on H4 (OPEN-5). Nothing tells a
  base-core card from a generated one today; §2.3 defines the marker.
- **Existing getff ownership convention.** Files getff generates carry the phrase `generated by getff`,
  and getff's own code keys off it (`setup.d/lib.sh:1562`, `:1591`, `:1775`). The own-line HTML
  comment form is dropped from the injected body by the loader (`inject-matching-rule.sh:292`), so a
  marker in that form costs the agent's context nothing.
- **Base-core row ids** (not on staging; P4 on `join/one-button-union` `808e806c606`,
  `skills/getff/references/base-core.md`): 100 table rows, ids `A`–`J` + 1-2 digits, measured with
  `grep -oE '^\| [A-Z][0-9]+ '`.
- **getff's own rules fail the shape today.** Over the 30 `.claude/rules/*.md` files at
  `2855667cb34` (the drafter's loop, 2026-09-30): 19 carry `paths:`; 0 carry `events:` or `on: read`;
  0 carry a `Mechanism:` line; every file body is over 1,000 bytes (smallest
  `attention-is-not-a-mechanism.md`, 2,629 B); 17 carry an `inject:` summary (spec S-8: 119-789 B), 13
  none. So all 30 fail at least one shape clause — hence the starting list (§2.1).
- **The research resolver** (`packages/core/research/`): `resolveAllowedSources(ctx?)`
  (`allowlist-resolver.ts:188`) returns `tier0` (the `ALLOWED_SOURCES` record, `allowlist.ts:20-43`),
  `tier2` (the ack file, loaded at `:190`) and `tier1For(packageName)` (`:181-185`); Tier 1 needs an
  ecosystem adapter in `ctx` (`:174`), the npm one being `npmAdapter` (`ecosystem-npm.ts:56`). Host
  matching is `hostMatches` (`:34-36`). It is TypeScript: a bash check cannot call it. The resolver
  already ships inside `packages/core/install/rule-bootstrap-cli.bundle.mjs` (built by
  `scripts/build-runtime-bundles.mjs:85`), which install runs from the getff package, not from the
  project (`setup.d/80-rule-bootstrap.sh:31`). The entry already builds its resolver ctx with
  `resolveCtxForRoot(consumerRoot)` (`rule-bootstrap-cli.ts:242`).
- **Seam: nothing reads a card today.** Principle 30 reads only the research store:
  `packages/core/principles/30-research-source-trust.test.ts:60`
  `['ls-files', '-z', 'packages/core/research/store/**/*.json']`. `prove-rules.mjs` is not on staging
  (`git ls-tree -r --name-only 2855667cb34 | grep prove-rules` → 0); on `808e806c606` it is a lint-rule
  table (`packages/core/audit-self/prove-rules.mjs:1-12`) and
  `grep -nE '\.claude/rules|getff-cards|cards/|depth:'` over it → 0 lines.
- **Delivery, two paths.** FRESH install: `copy_safe` in `setup.d/40-configs.sh` (e.g. `:20`
  `check-rule-globs.sh`, `:60` `check-zcode-mirror.sh`, each followed by a `chmod_safe +x` line). REFRESH:
  the `src:dst` pair list `install.sh:1132-1147` inside `do_refresh` (defined `:770`, comment `:759`).
  The Python lane delivers its own scripts through `_py_copy_or_refresh` (`setup.d/45-python.sh:951`)
  and runs its own hook templates, not the shared ones.
- **Hooks at a consumer.** The shipped pre-commit template `packages/core/templates/shared/husky-pre-commit.sh`
  is `#!/usr/bin/env sh` (`:1`), runs one shipped script before lint-staged (`:20-24`,
  `check-zcode-mirror.sh`; `:25` `npx lint-staged`). A consumer's pre-push runs the prebuilt bundle
  `packages/core/hooks/pre-push.bundle.mjs` (copied by `setup.d/50-hooks.sh:42`), built by
  `scripts/build-runtime-bundles.mjs`; the sections live in `packages/core/hooks/pre-push.ts` (registry
  `const SECTIONS` `:2590` … `];` `:2740`; owner `both` runs in getff AND at a consumer — see
  `trigger-build-s4/kickoff.md` §1 fact 1). Note `ruleGlobsSection` (`:1066-1072`) is silent when its
  script is missing — do NOT copy that shape (§2.4).
- **CI wiring points that shift no line:** `.github/workflows/audit-self.yml:138`
  `run: bash packages/core/audit-self/pre-merge-local.test.sh`, and its local-sweep twin
  `scripts/run-local-ci-sweep.sh:439` (row `premerge-carrier-selftest`, command
  `bash packages/core/audit-self/pre-merge-local.test.sh`).
- **Citation gate usage.** `scripts/check-line-citations.mjs` with neither `--check` nor `--write`
  prints its usage and exits 2 (`:1053-1060`); the corpus run is `--check --corpus`.

## §2 Deliverables

All new shell is bash 3.2-safe (macOS consumers): no associative arrays, no `mapfile`/`readarray`, no
`${var,,}`, `set -uo pipefail`. Every file this stage delivers to a consumer starts with line 1
`# getff-mechanism: <name> <version>` (spec S-15; s4 §2 D2 shape: line 2 `# shellcheck shell=bash`, no
shebang, always run as `bash <path>`). Everything is read-only against the project: no check writes,
moves or rewrites a card, a linked file or the allowlist (D26).

### §2.0 The core script

`packages/core/audit-self/check-rule-cards.sh` (line 1 `# getff-mechanism: rule-cards 1`), delivered to
`scripts/check-rule-cards.sh`. Arguments with defaults: `--root` (git top level, else `$PWD`),
`--rules-dir` (`.claude/rules`), `--cards-dir` (repeatable; default `.claude/hooks/getff-cards` and, when
it exists, `plugin/cards` — the plugin's `${CLAUDE_PLUGIN_ROOT}/cards/` in the getff source tree),
`--hosts` (`.ai-factory/research-allowed-hosts.txt`, §2.2), `--only` (comma list of `shape`, `homes`,
`linked`; default all). Population: every `*.md` at ANY depth under the rules directory (V7: native
discovery reaches subdirectories) and under each card directory.

Output: first a population line `RULE-CARDS rules=<n> cards=<n> research=<n> linked=<n>` (so a run over
an empty population reads as empty, not clean), then one line per finding, sorted:
`<CHECK-ID> <path>: <what is wrong> — <how to fix>` (the finding key for §2.1 is the first two fields).
Exit 0 = no finding; 1 = a finding; 2 = unusable input (unreadable or stale host list while a research
card exists) — fail closed, never a skip.

Frontmatter is read with the loader's grammar (`inject-matching-rule.sh:47-50`, `:251-284`): `paths:`,
`events:`, `depth:` and `on:` as a scalar, a flow list or a `- item` block. This is a second reader of
one format — the `#sync-by-copy-paste` risk of `dual-implementation-discipline.md:199`; the parity case
in §2.5 pins it to the loader.

### §2.1 Check 1 — card shape (spec item 1; ids `SHAPE-*`)

For every file in the rules directory:

- `SHAPE-TRIGGER` — a declared trigger: a non-empty `paths:`, a non-empty `events:`, `on: read`, or the
  always-on mark — the frontmatter line `always-on: true` (agreed with `trigger-build-research-cards`
  2026-09-30; it REPLACES `paths:`, a card carries one or the other). Declared limit: the loader's
  frontmatter parser ignores the key (`:273`), so an always-on card reaches the agent only through Claude
  Code's native session-start load of a rules file without `paths:` (V7); on ZCode it is not delivered.
  `SHAPE-TRIGGER` also fails a file carrying both `always-on: true` and `paths:`.
- `SHAPE-SIZE` — the INJECTED text is at most 1,000 bytes: the `inject:` summary when present, else
  `card_body` (loader `:346-355`), counted with `wc -c` (bytes — S-8 and the loader's `:349` count bytes).
- `SHAPE-MECH` — ALWAYS reads `card_body` (never the `inject:` summary): it holds exactly one line
  `Mechanism: not wired` or `Mechanism: <path>[#<anchor>]`, where `<path>` exists from `--root` and, with
  an anchor, the file contains it — principle 31's channel-marker liveness
  (`packages/core/principles/31-rule-channel-declaration.ts:138-160`). A body line, not a frontmatter key:
  the frontmatter never reaches the agent. Falsifier: a card needs two mechanisms (then decide the line's
  list form in the PR; do not guess).
- `SHAPE-LINK` — every `depth:` entry (a path from `--root`, as the loader prints it, `:358-359`) and
  every relative markdown link target in `card_body` (resolved from the card's directory) exists and
  does NOT sit under the rules directory (V7).

**The mechanism wrapper** — `packages/core/audit-self/getff-mechanism-card-shape.sh` (line 1
`# getff-mechanism: card-shape 1`), delivered to `scripts/getff-mechanism-card-shape.sh`, in the s4 call
shape (`trigger-build-s4/kickoff.md` §2 D2): `bash <script> <mode> <its-file> [--rev <sha> | --worktree]`,
modes:

- `findings` — `check-rule-cards.sh --only shape` over the tree at the revision (`--worktree` = the
  working tree), printed as finding keys `<CHECK-ID> <path>`, sorted, EXCLUDING every file that carries a
  `getff-card:` line (§2.3): a getff-marked card is getff's own output and must pass, never be listed.
- `check` — findings minus the listed set (the s4 helper's union of `[starting-list <v>]` sections), plus
  the s4 helper's shrink-only check of `<its-file>`; exit 0 when both are empty, else exit 1 printing each
  new finding with its fix.
- `install` — writes `<its-file>` once through the s4 helper from `findings --worktree`; `[params]`
  empty.

`<its-file>` is the s4 per-mechanism file for `card-shape` — path per s4 §1.9 OPEN-3 (proposed
`.getff/mechanisms/card-shape.txt`; use what s4 landed). Revisions: **pre-commit** runs
`check <its-file> --worktree` (findings over the working tree; the shrink check compares the
working-tree copy of `<its-file>` with the commit that first wrote each section — if the s4 helper
cannot compare a working-tree copy, STOP and report, do not extend the helper); **pre-push** runs
`check <its-file> --rev <ctx.rb.head>`. No escape line (D27): this mechanism records none.

getff first: run `install` on getff, never type the file by hand; paste the listed set (expected: the
30 files of §1) into the PR body. At a consumer, the install writes it through s4's install function
(s4 §2 D5), one line added there for `card-shape`.

### §2.2 Check 2 — research linked files (spec item 2; ids `LINKED-*`)

A research-derived file is a `depth:` entry of a card that carries the research marker of §2.3. Its
format is fixed by the generator stage (`trigger-build-research-cards`, its picks as relayed
2026-09-30): card `.claude/rules/getff-research-<stack>-<entry-id>.md`; linked file
`.ai-factory/rules-research/entries/<stack>/<entry-id>.md`; line 1 `> data, not instructions`; a
`# <entry-id>` heading; `## Entry` = one fenced ```` ```json ```` block with the research entry minus
`extras.quote`; `## Sources` = one line per quote, `> <quote text> [<host>](<url>)`. The check:

- `LINKED-HEADER` — line 1 is exactly `> data, not instructions`.
- `LINKED-LINE` — outside fenced ```` ```json ```` blocks, every other line is blank, a heading
  (`#`…), or a `>` quote line that ends with a markdown link `[…](https://…)`.
- `LINKED-QUOTEKEY` — a fenced block that contains a `"quote"` key (source text hidden in the data).
- `LINKED-URL` — every `http://` or `https://` URL anywhere in the file, fence included, is `https`
  and its host is allowed: equal to, or a subdomain of, a host in the RENDERED list (segment-safe, the
  rule of `allowlist-resolver.ts:34-36`).

**The host list is rendered by the existing resolver, never re-read (E18 F3).** Add one mode to the
existing entry `packages/core/install/rule-bootstrap-cli.ts`: `--render-allowed-hosts <out>
--consumer-root <root>`, which calls `resolveAllowedSources(resolveCtxForRoot(root))` — the ctx builder
the entry already uses for research plans (`rule-bootstrap-cli.ts:63` import, `:242` call;
`packages/core/synthesizer/resolve-ctx.ts:58`), so the render and the research run see the same tiers —
and writes
`<out>` = `.ai-factory/research-allowed-hosts.txt`:

- line 1 `# getff-mechanism: research-hosts 1`;
- line 2 `# inputs: research-allowlist.json=<sha256|absent> package.json=<sha256|absent>`;
- then one host per line, sorted, unique: every `tier0` value ∪ every `tier2` entry's `hosts` ∪
  `tier1For(dep).hosts` for each direct dependency in the root `package.json` whose result is `ok`.

Rebuild the bundle (`node scripts/build-runtime-bundles.mjs`; its `--check` is the drift gate). Who
renders: install and `--refresh` (beside the existing rule-bootstrap step, `setup.d/80-rule-bootstrap.sh`),
and the generator in the same run that writes cards (tell `trigger-build-research-cards`; it is out of
this stage). The check never parses the ack JSON: it recomputes the two sha256 values (`shasum -a 256`,
else `sha256sum`) and compares them with line 2. A mismatch is `LINKED-HOSTS-STALE` (exit 2) naming
`install.sh --refresh`; a missing list while a research card exists is exit 2 too (fail closed). In getff
the section renders first with `npx tsx packages/core/install/rule-bootstrap-cli.ts --render-allowed-hosts …`.

No starting list: at install no research card exists yet, so there is nothing old to grandfather. No
escape line (D27).

### §2.3 Check 3 — the two card homes (operator decision 2026-09-30; ids `HOME-*`)

**Marker contract — this section is its single source.** The generator stage
`trigger-build-research-cards` and every stage that creates a base-core card MUST emit it.

| Card kind | Home — the ONLY one | Marker: exactly one own line |
|---|---|---|
| base-core card | getff's card directory: `.claude/hooks/getff-cards/` (installer), `${CLAUDE_PLUGIN_ROOT}/cards/` (plugin) — S-2 (b), D9 | `<!-- getff-card: base-core <row-id> -->`, `<row-id>` = `^[A-Z][0-9]{1,2}$` (a base-core row id, e.g. `A13`) |
| generated research-only card | the project's rules directory, directly: `.claude/rules/<slug>.md` | `<!-- getff-card: research <stack> <entry-id> -->`, each token one word, no spaces |
| the project's own rule (D26) | the project's rules directory | none |

**Marker recognition.** A marker candidate is any line matching `^[[:space:]]*<!--[[:space:]]*getff-card:`
(leading whitespace is allowed and ignored — the same anchoring as the loader's own-line markers,
`inject-matching-rule.sh:334`, `:346`). A candidate is well-formed only if, with the leading whitespace
removed, it matches `^<!-- getff-card: (base-core [A-Z][0-9]{1,2}|research [^ ]+ [^ ]+) -->[[:space:]]*$`.
Prose that mentions the syntax mid-line is not a candidate.

The assertion, each case its own finding:

- `HOME-H1` — a file under the rules directory carries a `base-core` marker.
- `HOME-H2` — a file under the rules directory whose `card_body` (markers excluded) is NON-EMPTY and
  byte-identical to the `card_body` of a card in any card directory: an unmarked copy of a base-core card.
  Two empty bodies never match. Declared limit (D24): an EDITED copy with its marker removed is not detected.
- `HOME-H3` — a file under a card directory carries a `research` marker.
- `HOME-H4` — a file under a card directory without a well-formed `base-core` marker: the card directory
  holds base-core cards only, so each must say so (this closes H3's blind spot — an unmarked research card
  there). See OPEN-5.
- `HOME-MARKER` — a file with two or more candidates, or a candidate that is not well-formed, in either home.
- `HOME-SUBDIR` — a research-marked card below a subdirectory of the rules directory (the loader reads
  only the top level, `:321`, so it would never inject).

No starting list and no escape line: the operator's «не перепутай» is an invariant, not debt. Today the
population is empty in getff (§1: no card directory, no marker), so in getff this check is green with
`cards=0 research=0` printed — never report that as «clean» (T14).

### §2.4 Wiring — channel choice

Per `.claude/rules/rule-enforcement-channel-selection.md` §1 axis 1 and §3 steps 1-2 (read at
`2855667cb34`): all three checks are mechanically detectable → a gate, fired on the action before
falling back to pre-push, CI last. The action that creates a card is a COMMIT: the generator writes
files by script, and a person or an agent may write them by hand. An edit-time `PostToolUse` gate sees
only agent `Edit|Write`, never the generator's writes, and needs a new hook plus a registration in
getff's `.claude/settings.json`, which only the operator can land (spec S-6). So:

1. **pre-commit (earliest channel that sees every writer).** getff: a section in `.husky/pre-commit`,
   placed before `# ── Plugin twin regeneration` (`:341`), `fail=1` on exit ≠ 0, running
   `bash packages/core/audit-self/getff-mechanism-card-shape.sh check <its-file> --worktree` and
   `bash packages/core/audit-self/check-rule-cards.sh --only homes,linked`. Consumer: a block in
   `packages/core/templates/shared/husky-pre-commit.sh` before `npx lint-staged` (`:25`), shaped like its
   `check-zcode-mirror` block (`:20-24`) but invoking `bash scripts/getff-mechanism-card-shape.sh …` and
   `bash scripts/check-rule-cards.sh --only homes,linked` — `bash`, never `sh`, because the template is
   `#!/usr/bin/env sh` (`:1`) and the scripts are bash. A missing script is `exit 1` naming
   `install.sh --refresh`, unless a sibling `<script>.override.md` marks it project-owned (the Layer-3
   escape that block already names). Stays inside the template's <5 s budget (`:2`).
2. **pre-push (durable backstop)** — two owner-`both` sections in `packages/core/hooks/pre-push.ts`, ids
   per S-15: `getff-mechanism-card-shape` (runs the wrapper `check <its-file> --rev <ctx.rb.head>`) and
   `getff-mechanism-rule-cards` (runs `check-rule-cards.sh --only homes,linked`); framework layout
   (`ctx.isFrameworkRepo`) the `packages/core/audit-self/` paths, consumer layout `scripts/`; a missing
   script or per-mechanism file at a consumer fails naming it (fail closed, D19) — never
   `ruleGlobsSection`'s silent skip (`:1066-1072`, `attention-is-not-a-mechanism.md` §1). Append both
   entries as the LAST elements of `SECTIONS` (before `:2740` `];`) and their functions after the last
   section function, so no citation moves. Rebuild `pre-push.bundle.mjs` (`node scripts/build-runtime-bundles.mjs`).
3. **Delivery — both paths.** FRESH: in `setup.d/40-configs.sh`, beside `:60`, a `copy_safe` +
   `chmod_safe +x` pair for each of `check-rule-cards.sh` and `getff-mechanism-card-shape.sh`
   (`packages/core/audit-self/<x>.sh` → `scripts/<x>.sh`). REFRESH: the same two pairs in the
   `install.sh:1132-1147` list. Python lane (`setup.d/45-python.sh:951`): NOT delivered in this stage —
   declared limit (its hooks run neither the shared template nor the bundle), as in s4 §2 D5 (npm-stack only).
4. **CI:** principle 41 (`packages/core/principles/41-shell-test-ci-coverage.test.ts`) turns a new
   `*.test.sh` red until a workflow runs it. Chain the fixture test onto `audit-self.yml:138`
   (`… pre-merge-local.test.sh && bash packages/core/audit-self/check-rule-cards.test.sh`) and update that
   step's `name:` on its own line; append the SAME `&& bash …check-rule-cards.test.sh` to the command field
   of the sweep row `scripts/run-local-ci-sweep.sh:439`, or `run-local-ci-sweep-coverage.test.sh` goes red.
   **Insert no line** in either file: an inserted line shifts `path:line` citations in files this stage
   cannot edit (`.claude/rules/*`), and the pre-push `check-line-citations` gate then refuses the push
   (measured by the lead 2026-09-30: 11 stale citations from a 10-line insertion near `:662`). The same
   care applies to `install.sh`, `setup.d/40-configs.sh` and `pre-push.ts`: run
   `npx tsx scripts/check-line-citations.mjs --check --corpus` after every wiring edit; a stale citation
   in a file you may edit, fix; one inside `.claude/rules/*`, move your insertion instead.

Declared limits (write them in each script's header and the PR): edit-time is not a channel of these
checks; the Python, cargo and go lanes are not covered; the bash fallback pre-push
(`pre-push.fallback.sh`) does not get the sections; the shipped `ci.yml` templates do not run pre-push
sections (s4 §1 fact 3), so CI at a consumer is not a channel; a plugin-only consumer's
`${CLAUDE_PLUGIN_ROOT}/cards/` sits in the plugin cache outside the project, so the check never reads
it there — it reads the installer's `.claude/hooks/getff-cards/` and, in getff, `plugin/cards/`.

### §2.5 The fixture test

`packages/core/audit-self/check-rule-cards.test.sh` — builds every project in `mktemp -d` (a `git init`-ed
repo where a revision is needed), no network, no host state; exact-exit and exact-finding-line asserts.
One GOOD project (silent, exit 0, population line with exact counts, a card in EACH home) and, for EACH
finding id of §2.1-§2.3, one BAD project that differs from the good one by exactly that defect (exit 1,
exactly that id on that path). Mandatory seeded swaps for §2.3: a base-core card copied into
`.claude/rules/` WITH its marker (H1); the same copy with the marker stripped (H2); two files with empty
bodies in the two homes (H2 must stay silent); a research card placed in `getff-cards/` (H3); an unmarked
file in `getff-cards/` (H4); a marker with leading spaces (well-formed, silent) and one with a bad row id
(HOME-MARKER); a research card in `.claude/rules/sub/` (HOME-SUBDIR). Plus:

- each declared trigger alone (`paths:`, `events:`, `on: read`, `always-on: true`) passes
  `SHAPE-TRIGGER`; none of them fails it; `always-on: true` together with `paths:` fails it;
- an `inject:` summary under 1,000 B over a body with no `Mechanism:` line fails `SHAPE-MECH` (the
  summary is not read for it);
- read-only: `shasum` of every fixture file before and after a run is identical (D26);
- starting list through the wrapper: a listed old finding is silent; a new one of the same kind fails; a
  list that grew against its first-writing commit fails; a `getff-card:`-marked file is never written to
  the list by `install`;
- host list: a stale line-2 hash → exit 2; a missing list with a research card → exit 2, without one →
  exit 0; a host off the list → `LINKED-URL`; a subdomain of a listed host passes, `evil-react.dev` for
  `react.dev` fails;
- parity with the loader: run `inject-matching-rule.sh` with `RULES_DIR_OVERRIDE` / `CARDS_DIR_OVERRIDE`
  on the good project's cards and assert its pointer names the same `depth:` entries and its injected text
  is the text the checker measured for `SHAPE-SIZE`.

The renderer mode gets its own vitest case beside `packages/core/install/rule-bootstrap-cli.test.ts`: a
fixture root with an ack file and one direct dependency → the rendered list holds a Tier-0 host, the acked
host and the dependency's Tier-1 host, and line 2 carries both input hashes.

### §2.6 getff first (D12, D17, D21)

The pre-commit and pre-push sections run on getff's own tree in this PR. Record in the PR body the
population line of `bash packages/core/audit-self/check-rule-cards.sh` over getff, the per-mechanism file
`install` wrote (§2.1), and the rendered host-list line count. Consequence to state plainly in the PR:
from this PR on, a NEW file in getff's `.claude/rules/` must be card-shaped (OPEN-2).

### §2.7 SSOT row

Append one row to `docs/meta-factory/prior-art-evaluations.md` with the next free ID at commit time
(297 is the last on `2855667cb34`; parallel stages append too — re-read just before writing), per §3
below: verdict, rationale, trigger to revisit.

## §3 Prior-art consult (run by the drafter 2026-09-30; re-check, do not re-derive)

- SSOT: **row 101** (Claude Code native `paths:` — a trigger this check accepts, not a checker);
  **row 61** (OhMyOpencode `rulesInjector` — injection, no shape check); **row 186** (cargo-vet — the shape
  of the ack file the resolver loads); **row 251** (markdownlint custom rules — BUILD then: markdownlint
  runs per staged file and cannot cross files); **row 17** (markdownlint-cli2 at pre-commit).
- Own stack REUSED, not rebuilt: the research resolver (`resolveAllowedSources`, `hostMatches`,
  `npmAdapter`) through its shipped bundle entry; the s4 per-mechanism helper and call shape; principle
  31's marker-liveness semantics; the loader's frontmatter grammar (parity-tested).
- context7 (first server out of monthly quota; the second answered), three phrasings:
  (1) `/davidanson/markdownlint` «custom rule that validates YAML front matter keys and limits body
  size» → `params.frontMatterLines` and the `frontMatterHasTitle` helper: a per-file key check only;
  (2) resolve «remark-lint-frontmatter-schema» → `/remarkjs/remark`, `/adrg/frontmatter`,
  `/eyeseast/python-frontmatter` — parsers, no shape rule; `/remarkjs/remark` «lint plugin that checks
  every link points to an allowed host list» → `unist-util-visit` link extraction, a plugin to write,
  not a rule to adopt; (3) `/websites/code_claude` «validate or lint `.claude/rules` memory files; keep
  untrusted fetched content from being treated as instructions» → permission rules and paste marking
  only, no rule-file validator.
- Verdict: **BUILD** the checks in the repo's own stack; REUSE the resolver and the s4 helper. Every
  external candidate is per-file; checks 1 (link outside the dir) and 3 (a body equal to one in another
  directory) are cross-file and cross-directory, and a remark/markdownlint route adds a Node dependency
  the pre-commit does not have today. Trigger to revisit: markdownlint or remark ships a cross-file rule
  API, or Claude Code ships a rule-file validator.
- **Capability commit: YES** — a new file ≥80 LOC under `packages/`
  (`packages/core/audit-self/check-rule-cards.sh`). Trailer:
  `Prior-art: prior-art-evaluations.md#<new-ID> (card checks — markdownlint/remark per-file only, BUILD in own stack; see row 251)`.

## §4 Proof — RED first

- Write the fixture test first and run it with the scripts absent: paste the failing run into the PR
  body. Then GREEN.
- Every expected finding line and count is derived from the fixture the test wrote, never typed from a
  run's output.
- The host half is the lead's: it runs the scripts over getff and over one fresh install. Do not claim
  host results.

## §5 Exit gates

```bash host-verify
bash packages/core/audit-self/check-rule-cards.test.sh
bash packages/core/audit-self/check-rule-cards.sh
bash packages/core/audit-self/getff-mechanism-card-shape.sh check .getff/mechanisms/card-shape.txt --rev HEAD
PREPUSH_ONLY=getff-mechanism-card-shape npx tsx packages/core/hooks/pre-push.ts
PREPUSH_ONLY=getff-mechanism-rule-cards npx tsx packages/core/hooks/pre-push.ts
shellcheck packages/core/audit-self/check-rule-cards.sh packages/core/audit-self/getff-mechanism-card-shape.sh packages/core/audit-self/check-rule-cards.test.sh
npx vitest run packages/core/principles/41-shell-test-ci-coverage.test.ts packages/core/hooks/inject-matching-rule.test.ts packages/core/install/rule-bootstrap-cli.test.ts
NODE_ENV=development node scripts/build-runtime-bundles.mjs --check
npx tsx scripts/check-line-citations.mjs --check --corpus
SNAPSHOT_MODE=capture bash tests/install-sh/snapshot.sh
grep -l 'scripts/check-rule-cards.sh' tests/install-sh/baselines/ts-server/*.fingerprint
grep -l 'scripts/getff-mechanism-card-shape.sh' tests/install-sh/baselines/ts-server/*.fingerprint
bash scripts/run-local-ci-sweep-coverage.test.sh
node scripts/check-docs-refresh.mjs "$(git merge-base origin/staging HEAD)..HEAD"
bash scripts/run-local-ci-sweep.sh
```

If s4 landed a different per-mechanism path (OPEN-3), use it in the third line. The snapshot capture
regenerates the install fingerprints; the two `grep -l` lines assert the FRESH install now lists both
scripts (they fail if only the refresh list was edited) — commit the regenerated baselines. Never pass
`--write` to `check-line-citations.mjs` for a file under `.claude/rules/`. If the local sweep names a
`packages/getff/MANIFEST.sha256` drift, regenerate it the way it names. The docs-refresh gate names any
`docs/site/` page citing a touched file; refresh it or add `docs-refresh: deferred — <reason>` (a comma
inside the reason, never `: `).

## §6 Out of scope

- The research-card generator (`trigger-build-research-cards`) — this stage only checks its output (it
  must emit §2.3's marker, `Mechanism: not wired`, and run the host-list render).
- Any file under `.claude/rules/` or `.claude/settings.json` — no agent and no factory run commits there
  in this build (spec `:113-118`, `[op V8]`). A change there is the lead's operator patch.
- Creating or delivering base-core cards or `getff-cards/` to consumers (slice 4, spec §4 HO-6 row).
- An edit-time hook for these checks; the loader `inject-matching-rule.sh` (unchanged).
- Changing the s4 helper `getff-mechanism-lib.sh` (a gap in it is a STOP, §2.1).
- Changing the resolver's tiers or any trust grant (`research-source-trust.md` `#allowlist-as-code-not-data`).

## §7 Falsifiers to write into the PR body

- A base-core card in `.claude/rules/`, marked or byte-identical, passes → the two homes can be mixed up.
- A research card in `getff-cards/` passes, or an unmarked file there passes → the same, the other way.
- Two empty-bodied files in the two homes fail H2 → the copy test matches on nothing.
- A green run prints no population line, or prints `cards=0` without saying so → an empty population
  read as clean.
- A card with only `events:` or only `on: read` fails `SHAPE-TRIGGER` → r2f item 1 not implemented.
- A card whose `depth:` file sits under `.claude/rules/` passes → V7 residency is back.
- A linked file with a plain prose line, a `"quote"` key in its fence, or a link to a host off the list
  passes → D18 data/instruction split broken.
- A Tier-0 official-doc link (`react.dev`) with no ack fails `LINKED-URL` → the check is not reading the
  resolver's union (E18 F3).
- The check reads `research-allowlist.json` with `jq` or any parser → a second reader of the JSON.
- The script changes any byte of a fixture file → D26 broken.
- A new card-shape finding passes because the starting list grew → D23 shrink-only broken.
- A fresh install's fingerprint lacks `scripts/check-rule-cards.sh` → delivered on refresh only.
- The checker's measured text differs from the loader's injected text on the same card → two readers of
  one format drifted.

## §8 Report

`Stat` / `Verify` (each §5 gate, the RED-then-GREEN runs, the getff population line) / `DECISIONS`
(the `Mechanism:` line grammar, the render-mode placement, how each OPEN was closed by the lead) /
`ATTN` / `Confidence`. The PR body carries `## Fidelity verdict` (the lead adds it after the cold
fidelity round on the host) and the §1.7 Forward-check / Backward-check sections.

## §OPEN — for the lead, before dispatch

- OPEN-1 — CLOSED by E18 F3: the resolver's union, rendered (§2.2). Kept here only as a record.
- OPEN-2 — CLOSED by the lead (2026-09-30): yes. With a starting list over the 30 files, every NEW
  `.claude/rules/*.md` in getff must be a card (≤1,000 B injected text, a declared trigger, a `Mechanism:`
  line), as D10 + D12 read. Kept here only as a record.
- OPEN-3 — CLOSED by the lead (2026-09-30): `.getff/mechanisms/<name>.txt`, the path `trigger-build-s4`
  §1.9 OPEN-3 closed on. If s4 landed a different path, use s4's (the s4 PR is the source). Kept as a record.
- **OPEN-4** — CLOSED by the Phase -1 review: `SHAPE-SIZE` measures the injected text, `SHAPE-MECH`
  always `card_body` (§2.1).
- OPEN-5 — CLOSED by the lead (2026-09-30): the third marker kind, as proposed below. The docs-SSOT one-source rule is placed in `getff-cards/`
  (`docs/superpowers/specs/2026-09-30-docs-single-source-design.md:112`) and is not a base-core row, so
  H4 fails it. Proposed: a third marker kind `<!-- getff-card: getff <slug> -->` for getff-shipped cards
  that are not base-core rows, allowed ONLY in the card directory (H4 then accepts `base-core` or
  `getff`; H1 also fails a `getff` marker under the rules directory). Alternative: give it a base-core row id.
- OPEN-6 — CLOSED by the lead (2026-09-30): not run, as proposed. D24's false-fire measurement (spec S-10,
  slice 4 machinery) on getff's history is vacuous here (no card existed before this build); the checks
  are exact over their grammar and their limits are declared. The PR body states it as a declared limit.
- OPEN-7 — CLOSED 2026-09-30 with `trigger-build-research-cards`: the always-on mark is the frontmatter
  line `always-on: true`, replacing `paths:` (§2.1). Kept here only as a record.

## §9 AI traps ([ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md))

Active traps for this stage: **T2** run each check, do not describe what it would print · **T3**
command-or-`file:line` for every claim · **T6** confidence as predicates · **T14** a green run over
getff's empty card population is «no population», not «clean» — the population line says so ·
**T15** getff first: the checks run on getff's own tree in this PR · **T16** «the allowlist» names the
resolver's union, not the ack file — match the function, not the file name · **T19** own cold review of
the diff before handoff · **T21** cold `agents/backward-sweep-auditor.md` on the class «a shipped check
that reads the project's `.claude/rules/` and must not write it» — `check-rule-globs.sh`,
`check-rule-enforced.sh`, principle 31, `render-rule-index.mjs` are the candidates.

**T-TB5-A (domain):** the swap check is only as good as the directory it reads. A `HOME-H1` grep run
over the card directory instead of the rules directory (or the two `--*-dir` defaults crossed) is
green on every fixture that seeds only one home — that is why §2.5 seeds each swap in BOTH directions,
asserts the exact id and path, and gives the good project a card in each home.
