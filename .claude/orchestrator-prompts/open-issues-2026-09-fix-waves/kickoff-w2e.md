# open-issues fix waves — W2-E: consumer docs accuracy

> **Umbrella:** [kickoff.md](kickoff.md) — §0 binding execution rules, §1 decision register
> (D1, D4) and §2 file-lock matrix are binding; this file restates only what the executor needs,
> and where it widens the §2 file-lock row it says so (§1.7, §2).
> **Class:** stage kickoff (dispatch input). **Base branch:** `staging`. **Branch:**
> `docs/consumer-docs-accuracy`. **PR title:** `W2-E: consumer docs accuracy`. **Channel:** one
> aif task, own worktree, one PR to `staging` (harvested from the host — never pushed from the
> container).
> **Rigor label (L0):** `build-and-verify` — doc-only, but the docs ship to consumers (templates
> are installed content) and four of the six issues are about a doc stating something false.
> **Authoritative for:** the W2-E contract — per-issue deliverables with anchors measured at the
> SHA below, the 600-line budget, exit gates, falsifiers.
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists);
> D1 and D4 themselves — owned by [kickoff.md §1](kickoff.md).

**Measurement SHA for every `path:line` below:** `5e3768d6c57473ba5dca60d496b9c5d8478eda88`
(`staging` after W1-E, #1832). The umbrella's own anchors were measured at `c26593c9` and several
have moved — use the numbers here, and re-locate by content (`grep -n`) if yours differ. This file
was cold-reviewed before dispatch (round 1 REVISE, 2 BLOCKER + 7 MAJOR, all folded in below).

**Dependencies:** W1-A merged (#1821, `85f7625be50`). W2-F runs in parallel (disjoint files).
W2-G authors only after THIS stage merges (both edit `INSTALL-FOR-AI.md`).

**Closes (in the PR BODY, not in a comment):** #1536, #1533, #1532, #1539, #1535, #1540. #1540's
mechanism half landed in W1-A without `Closes`; this stage is its full close. Each closed issue gets
an English closure comment: its recorded `Failure-scenario:` → the fix → the verify evidence. Read
each issue WITH its comments (`gh issue view N --repo artyhoo/getff --comments`) — the dated
review comments carry requirements the issue body does not.

## §0 The 600-line budget for `INSTALL-FOR-AI.md` — read before writing a word

`INSTALL-FOR-AI.md` is **exactly 600 lines** at the measurement SHA (`wc -l`), and
`.husky/pre-commit:92` rejects any markdown file over 600 (the only channel —
`.husky/pre-commit:51`: no CI mirror). Budget for this stage: **net change ≤ 0 lines** in that file.

- Many lines are long single physical lines. `INSTALL-FOR-AI.md:482` (the #1540 note) is ONE line
  of ~440 characters, so rewriting it frees **no** lines. Do not count on it.
- Pointers (#1533 ZCode, #1539 uninstall) go in as **sentences appended to existing lines**, not
  as new paragraphs. The one genuinely new line is the #1532 table row; name the line you free
  to pay for it (a blank line inside a section you already edit, or a sentence merged into its
  neighbour) and state it in the PR body.
- **The Uninstall body (#1539) goes into `INSTALL.md`** (549 lines; its last section
  `## Updating the package` is at `INSTALL.md:531`) as `## Uninstalling`.
- Do not delete or move a whole section to make room.
- Citations of `INSTALL-FOR-AI.md:NN` live OUTSIDE the citation gate's corpus
  (`scripts/check-line-citations.mjs:266-274` scans only `.claude/rules/`, `.claude/skills/`,
  `agents/`, `CLAUDE.md`, `AGENTS.md`, `CONTRIBUTING.md`, `docs/site/`), so the gate will NOT find
  them. Check these by hand after editing and fix the comment if the line moved:
  `install.sh:600` and `:603` (→ `:66` / `:83`), `setup.d/lib.sh:220` (→ `:482`), and principle 45
  (`grep -n 'INSTALL-FOR-AI' packages/core/principles/45-*.ts`). A comment-only edit there is
  allowed despite §5. **Never renumber a citation in a research patch, an old kickoff, a
  `.decisions.md` or `docs/meta-factory/triage-corpus/`** — those are historical records.
- W2-G's own section is NOT this stage's problem, but leaving the file at 600 blocks it. State in
  the PR body the final `wc -l`, so W2-G's kickoff author can decide its placement.

## §1 Deliverables (one per issue)

1. **#1536 — README wiring steps.** `README.md:160`, `:245` and `:275` tell the consumer to run
   `npx husky init` (and `:245`/`:275` also `npx depcruise --init`). The installer forbids the
   first: `setup.d/99-finalize.sh:425` prints «do NOT run 'npx husky init' — it would clobber the
   shipped .husky/pre-commit + pre-push», and `setup.d/50-hooks.sh:75` sets `core.hooksPath=.husky`
   directly. Rewrite the three sites to mirror what `99-finalize.sh` actually prints. For
   depcruise: grep `setup.d/` for `dependency-cruiser`; if a config ships, drop `npx depcruise
   --init`, otherwise keep it and say so. **Sibling in a file you edit anyway:** `INSTALL.md:405`
   `## Section 5 — Initialize Husky` runs `npx husky init` on the manual path, and README points
   readers into `INSTALL.md`. Decide whether that manual-path section is still correct (Path C
   copies `.husky/` by hand — check), align or keep it, and record the ruling in `DECISIONS`.
   Do not insert lines above `README.md:147` — `scripts/render-face-facts` reads that line.
2. **#1533-A — name the ZCode degradation (D1, doc-only).**
   - `packages/core/templates/shared/AI-USAGE-GUIDE.md` §5 «Harness portability» (`:275`, table
     `:280-285`): rows are LAYERS and columns are HARNESSES («Claude Code» | «Other harnesses
     (Cursor, Codex CLI, …)»), so a «ZCode row» does not fit. Add a note under the table (or a
     column) that names what degrades on ZCode and points to the plugin channel.
   - **The pointer must be a public URL, not a repo path.** AI-USAGE-GUIDE is shipped
     (`setup.d/30-templates.sh:50`) and `README.md` is never delivered to a consumer, so
     `README.md:196` would be a new dead citation — the #1535 class this same PR closes. Use
     `https://github.com/artyhoo/getff#as-a-zcode-plugin-per-harness` (verify the anchor resolves).
   - `INSTALL-FOR-AI.md` has **zero** occurrences of «plugin» (`grep -c -i plugin` → 0). Add a
     «ZCode users» pointer sentence (§0 budget).
   - Option B (delivering `.zcode/` from `setup.d`) is out of scope by D1.
3. **#1532 — the R2 pre-push glob alarm.** The expected-first-run-failures table
   (`INSTALL-FOR-AI.md:535`, rows `:539-547`) gains a row for the rule-glob alarm at push time on
   non-boundary layouts. Cross-link the guide's rule-glob text — AI-USAGE-GUIDE `:206` (§3) and
   `:235-248` (§3.1); the umbrella's `:197-198` / `:224-226` are stale.
4. **#1540 docs — state the refresh behaviour PER PATH.** The `INSTALL-FOR-AI.md:482` note
   («`--refresh` is stateless … cannot distinguish a consumer-edited Layer-2 file») is partly
   false, not wholly — the #1540 review comment says so. The truth, from the code:

   | Path | Baseline entry | Behaviour | Code |
   | --- | --- | --- | --- |
   | `--refresh`, single file (`refresh_safe` → `_refresh_one_file`) | present, diverged | copy preserved under `.ai-factory/refresh-conflicts/` + `⚠ overwriting locally-modified file` line; `--dry-run` prints `would-flag` | `setup.d/lib.sh:1138-1140`, `:422`, `:1134` |
   | `--refresh`, single file | **absent** | **silently overwritten** — `refresh_baseline_diverged` returns 1 on no entry | `setup.d/lib.sh:405` |
   | `--force` (`copy_safe` force arm) and tree / skill replace (`_copy_tree_with_transform`) | present, diverged | preserved + `⚠` (D4(a)/(b)) | `setup.d/lib.sh:713`, `:732` |
   | same | absent | preserved silently, ONE aggregate line per run (D4(c)) | `setup.d/lib.sh:480-489` |

   Rewrite the `:482` note, the matching Layer-2 row and `setup.d/LAYERS.md:81` / `:90`
   (`refresh_safe` / `refresh_skill_with_transform` rows) to say exactly this — including the
   no-entry overwrite on `--refresh`, which is the case the `.override.md` advice still exists for.
   Do not write «since W1-A»: the baselined-file guard predates W1-A (#1481); W1-A added the
   tree/skill and `--force` arms and the no-entry aggregate. Re-verify each row against the code
   before writing it — this table is a measurement, not a spec; if the code says otherwise, the
   code wins and the discrepancy goes in `ATTN`.
5. **#1539 — an Uninstall path.** ONE home: `INSTALL.md` `## Uninstalling`.
   - Existing prose to reconcile: `docs/site/installation.md:235-252` («## If you want it out /
     There is no uninstall command today…») already lists manual removal steps but covers only
     `.husky` + an unconditional `git config --unset core.hooksPath`. Make it consistent with the
     new section (link to it or align the steps); this widens the umbrella §2 file-lock row by
     that one page — record it in the PR body.
   - `docs/superpowers/specs/2026-09-14-getff-ai-face-pages-design.md:181` also states «there is
     no uninstall». It is a design record: do NOT rewrite it; name it in the PR body as
     superseded-by this section.
   - **hooksPath reset must be conditional.** A consumer's own `core.hooksPath` is deliberately
     left alone by the installer (`setup.d/45-python.sh:959-960`, Case 1 — augment-first), so a
     blanket `--unset` would wipe the consumer's value. Reset only getff's two values —
     `.husky` (set at `setup.d/50-hooks.sh:75`) and `.getff/hooks` (set at
     `setup.d/45-python.sh:970`), e.g.
     `case "$(git config --get core.hooksPath)" in .husky|.getff/hooks) git config --unset core.hooksPath;; esac`.
   - Remove the delivered trees; name the residue a consumer keeps on purpose (`*.override.md`,
     `.ai-factory/refresh-conflicts/`). Give the commands, do not only describe them.
6. **#1535 — dead citations in shipped docs** (verified classes in the issue's verification comment):
   - AI-USAGE-GUIDE cites `INSTALL-FOR-AI.md` at `:6`, `:97` and `:329` — never delivered to a
     consumer.
   - `tier-home.md:84` cites three factory-internal paths.
   - `tier-home.md:107-120` describes Option B `.ai-factory/skill-context/tier-home/SKILL.md` as
     shipped (`:120` is the stale claim itself); the Resolution that contradicts it is `:122-127`.

   Repoint each to something the consumer has (a public URL counts), or label it framework-side
   source explicitly. Known gap, NOT in scope: no gate checks backticked paths (lychee checks
   links only). Record it as a follow-up in the PR body; do not build it, and do not claim it is
   absent without the 6-item search-coverage checklist (T7).

## §2 Regeneration and the docs-refresh gate

- **Payload (umbrella §0.3 — templates ship):** `scripts/build-getff-dist.sh`, then
  `SNAPSHOT_MODE=capture bash tests/install-sh/snapshot.sh`. **Measure the drift before each
  capture.** Expected derived set: the edited templates' fingerprints,
  `.ai-factory/refresh-baseline.json` if it covers them, the install fingerprints,
  `packages/getff/MANIFEST.sha256`. A path outside that set is a STOP.
- **D26 docs-refresh gate (`scripts/check-docs-refresh.mjs`; runs at `packages/core/hooks/pre-push.ts:1502`
  and ALWAYS in `scripts/run-local-ci-sweep.sh:298`):** a `docs/site/` page whose `sources:`
  frontmatter lists a file you change must change in the same range or carry
  `docs-refresh: deferred — <reason>` in its frontmatter. Pages that cite files this stage edits:
  `docs/site/installation.md` (`INSTALL-FOR-AI.md`, `README.md` — and you edit it anyway for #1539),
  `docs/site/index.md`, `docs/site/foundations.md`, `docs/site/why.md` (`README.md`). Re-list them
  with `grep -ln -E 'INSTALL-FOR-AI.md|README.md|AI-USAGE-GUIDE|tier-home|LAYERS.md|INSTALL.md' docs/site -r`.
  In a deferral token use a comma, never `: ` — a colon-space inside the plain YAML scalar crashes
  the CI vale step (E201). A commit touching `docs/site/` needs a `Docs-card:` trailer.

## §3 Exit gates

```bash host-verify
wc -l INSTALL-FOR-AI.md INSTALL.md README.md
node scripts/check-docs-refresh.mjs "$(git merge-base origin/staging HEAD)..HEAD"
node scripts/check-line-citations.mjs --check --corpus
npx markdownlint-cli2 INSTALL-FOR-AI.md INSTALL.md README.md setup.d/LAYERS.md packages/core/templates/shared/AI-USAGE-GUIDE.md packages/core/templates/shared/tier-home.md
scripts/build-getff-dist.sh --check
PC_LOCAL=1 make self-audit
bash scripts/run-local-ci-sweep.sh
```

Plus a scripted existence check of every path you added or edited in a shipped doc, against a
throwaway consumer install — so «exists» means «exists in the consumer tree»:

```bash
d=$(mktemp -d) && cd "$d" && npm init -y >/dev/null && git init -q && bash <repo-root>/install.sh ts-server </dev/null
```

(`install.sh` without `--full` asks nothing about deps when stdin is not a TTY; if it prompts
anyway, that is an `ATTN`, not something to work around.) Paste the command and its output into
the PR body, plus the hand-check of the four `INSTALL-FOR-AI.md:NN` citers from §0.

## §4 Falsifiers to write into the PR body

- A consumer following README `:160`/`:245`/`:275` runs `npx husky init` → #1536 not closed.
- `grep -c -i plugin INSTALL-FOR-AI.md` still returns 0 → #1533-A not closed.
- A shipped doc points at `README.md:NN` or `INSTALL-FOR-AI.md` without a URL or a framework-side
  label → #1535 class re-introduced.
- `wc -l INSTALL-FOR-AI.md` > 600 → the commit could not have passed pre-commit; if it did,
  pre-commit did not run in the container, which is itself a finding.
- The rewritten refresh note claims unbaselined edits survive a plain `--refresh` → contradicts
  `setup.d/lib.sh:405` (the no-entry arm of `_refresh_one_file` overwrites).
- The uninstall steps `--unset core.hooksPath` unconditionally → a consumer-owned hooksPath is
  wiped (contradicts `setup.d/45-python.sh:959-960`).
- `docs/site/installation.md` and `INSTALL.md` give different uninstall steps → two homes.

## §5 Out of scope

- W2-G's `INSTALL-FOR-AI.md` section and its `setup.d` check (#1502).
- A path-existence gate for backticked citations.
- Any change to `setup.d/*.sh` or `install.sh` behaviour (comment-only citation fixes per §0 are
  allowed). If the code looks wrong — for example the no-entry overwrite on `--refresh` — file it
  and do not fix it here.

## §6 Report (umbrella §5 template, strict)

`Stat` (files + lines) / `Verify` (each §3 gate with its observed output) / `DECISIONS` (every
fork taken: depcruise, `INSTALL.md` §5 husky section, the freed line for the #1532 row) / `ATTN`
(mandatory stop if non-empty) / `Confidence: high|medium|low`. PR body carries
`## Fidelity verdict` and the §1.7 Forward-check / Backward-check sections (umbrella §0.6).

## §7 AI traps ([ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md))

**T3** command-or-`file:line` for every claim in the PR body · **T2** run the consumer install,
do not describe it · **T7** negative-existence claims (the «no path gate» follow-up) need the
6-item checklist · **T19** own cold review before handoff · **T21** cold
`agents/backward-sweep-auditor.md` on the class «a shipped or public doc states installer
behaviour that the installer's own code or output contradicts» — #1536 and #1540 are two
instances, `INSTALL.md:405` and `docs/site/installation.md:235-252` are candidate third ones; the
sweep asks where the next is.
