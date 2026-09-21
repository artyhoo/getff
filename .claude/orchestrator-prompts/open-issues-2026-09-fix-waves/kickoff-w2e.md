# open-issues fix waves — W2-E: consumer docs accuracy

> **Umbrella:** [kickoff.md](kickoff.md) — §0 binding execution rules, §1 decision register
> (D1, D4) and §2 file-lock matrix are binding; this file restates only what the executor needs.
> **Class:** stage kickoff (dispatch input). **Base branch:** `staging`. **Branch:**
> `docs/consumer-docs-accuracy`. **PR title:** `W2-E: consumer docs accuracy`. **Channel:** one
> aif task, own worktree, one PR to `staging` (harvested from the host — never pushed from the
> container).
> **Rigor label (L0):** `build-and-verify` — doc-only, but the docs ship to consumers (templates
> are installed content) and four of the six issues are about a doc stating something false.
> **Authoritative for:** the W2-E contract — per-issue deliverables with anchors measured at the
> SHA below, the 600-line placement constraint, exit gates, falsifiers.
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists);
> D1 and D4 themselves — owned by [kickoff.md §1](kickoff.md).

**Measurement SHA for every `path:line` below:** `5e3768d6c57473ba5dca60d496b9c5d8478eda88`
(`staging` after W1-E, #1832). The umbrella's own anchors were measured at `c26593c9` and several
have moved — use the numbers here, and re-locate by content (`grep -n`) if yours differ.

**Dependencies:** W1-A merged (#1821, `85f7625be50`) — the post-fix refresh behaviour #1540's docs
must describe is live on the base. W2-F runs in parallel (disjoint files). W2-G authors only after
THIS stage merges (both edit `INSTALL-FOR-AI.md`).

**Closes (in the PR BODY, not in a comment):** #1536, #1533, #1532, #1539, #1535, #1540. #1540's
mechanism half landed in W1-A without `Closes`; this stage is its full close. Each closed issue gets
an English closure comment: its recorded `Failure-scenario:` → the fix → the verify evidence.

## §0 The 600-line constraint — read before writing a word

`INSTALL-FOR-AI.md` is **exactly 600 lines** at the measurement SHA (`wc -l`), and `.husky/pre-commit:92`
rejects any markdown file over 600. That hook is the only channel (`.husky/pre-commit:51`: no CI
mirror). Three deliverables below add text to that file, so:

- **The Uninstall body (#1539) goes into `INSTALL.md`** (549 lines; it already ends with
  `## Updating the package` at `INSTALL.md:531`, the natural neighbour) as a new
  `## Uninstalling` section. `INSTALL-FOR-AI.md` gets a pointer of at most two lines.
- **Every other addition to `INSTALL-FOR-AI.md` is offset inside the sections you already edit.**
  The `:482` note rewrite (#1540) is the obvious place to recover lines. Do not delete or move a
  whole section to make room. `install.sh:600` and `:603` cite `INSTALL-FOR-AI.md:66` and `:83`,
  and 19 other tracked files cite `INSTALL-FOR-AI.md:NN`
  (`git grep -c -E 'INSTALL-FOR-AI\.md:[0-9]'`). Any edit above a cited line shifts it, so run
  the citation gate (§3) and fix what it names.
- W2-G later needs its own `INSTALL-FOR-AI.md` section. Leave the file at ≤ 600, not at 600 plus a
  plan.

## §1 Deliverables (one per issue; the issue's two dated evidence comments are the ground truth)

1. **#1536 — README wiring steps.** `README.md:160`, `:245` and `:275` tell the consumer to run
   `npx husky init` (and `:245`/`:275` also `npx depcruise --init`). The installer itself forbids
   the first: `setup.d/99-finalize.sh:425` prints «do NOT run 'npx husky init' — it would clobber
   the shipped .husky/pre-commit + pre-push», and `setup.d/50-hooks.sh:75` sets
   `core.hooksPath=.husky` directly. Rewrite the three sites to mirror what `99-finalize.sh`
   actually prints. Verify first whether the installer ships a dependency-cruiser config (grep
   `setup.d/` for `dependency-cruiser`). If it does, drop `npx depcruise --init`. If it does not,
   keep it and say so in the PR body.
2. **#1533-A — name the ZCode degradation (D1, doc-only).**
   - `packages/core/templates/shared/AI-USAGE-GUIDE.md` §5 «Harness portability» (heading `:275`,
     table `:280-285`) has no ZCode row. Add one that names what degrades and points to the
     plugin channel (`README.md:196` «As a ZCode plugin (per-harness)»).
   - `INSTALL-FOR-AI.md` has **zero** occurrences of «plugin» (`grep -c -i plugin` → 0). Add one
     «ZCode users» pointer paragraph.
   - Option B (delivering `.zcode/` from `setup.d`) is out of scope by D1.
3. **#1532 — the R2 pre-push glob alarm.** The expected-first-run-failures table in
   `INSTALL-FOR-AI.md` (section `:535`, rows `:539-547`) gains a row for the rule-glob alarm at
   push time on non-boundary layouts. Cross-link the guide's rule-glob text: AI-USAGE-GUIDE `:206`
   in §3 and `:235-248` in §3.1. Re-locate these by content; the umbrella's `:197-198` and
   `:224-226` are stale.
4. **#1540 docs — state the post-W1-A behaviour.**
   - Rewrite the `INSTALL-FOR-AI.md:482` note, which says «`--refresh` is stateless … cannot
     distinguish a consumer-edited Layer-2 file». That has been false since W1-A.
   - Rewrite the matching Layer-2 row and `setup.d/LAYERS.md:81`/`:90` (`refresh_safe` /
     `refresh_skill_with_transform` rows).
   - The truth is in the code. Cite it; do not paraphrase the umbrella:
     - diverged copies are preserved under `.ai-factory/refresh-conflicts/` (`setup.d/lib.sh:260`);
     - baseline-covered divergence prints `⚠` and `--dry-run` prints `would-flag`
       (`lib.sh:591`, `:604`);
     - unbaselined divergence is preserved silently and reported as ONE aggregate line per run
       (`lib.sh:480-489`, D4(c));
     - skill trees are covered too.
5. **#1539 — an Uninstall path.** The body goes in `INSTALL.md` (§0). It must:
   - remove the delivered trees;
   - reset BOTH hooksPath variants: `.husky` from `setup.d/50-hooks.sh:75`, and `.getff/hooks` on
     the Python lane (`setup.d/45-python.sh:873`, re-locate; the umbrella's `:967` is stale);
   - account for anything in `lib.sh` that re-asserts hooksPath (grep `hooksPath` in `setup.d/`);
   - name the residue a consumer keeps on purpose: `*.override.md` and `.ai-factory/refresh-conflicts/`.

   Give the commands. Do not just describe them.
6. **#1535 — dead citations in shipped docs** (verified classes in the issue's verification comment):
   - AI-USAGE-GUIDE cites `INSTALL-FOR-AI.md` at `:6`, `:97` and `:329`. That file is never
     delivered to a consumer.
   - `tier-home.md:84` cites three factory-internal paths.
   - `tier-home.md:107-119` describes Option B `.ai-factory/skill-context/tier-home/SKILL.md` as
     shipped, and it is not (`:120` onward carries the Resolution that contradicts it).

   Repoint each to something the consumer has, or label it framework-side source explicitly.
   Known gap, NOT in scope: no gate checks backticked paths (lychee checks links only). Record
   it in the PR body as a follow-up. Do not build it, and do not claim it is absent without the
   6-item search-coverage checklist (umbrella T-traps: T7).

## §2 Regeneration (umbrella §0.3 — templates ship, so this stage drifts the payload)

After the edits: `scripts/build-getff-dist.sh`, then `SNAPSHOT_MODE=capture bash tests/install-sh/snapshot.sh`.
**Measure the drift before each capture.** The expected derived set is:
- the edited templates' fingerprints;
- `.ai-factory/refresh-baseline.json` if it covers them;
- the install fingerprints;
- `packages/getff/MANIFEST.sha256`.

A path outside that set is a STOP, not something to smooth over.

## §3 Exit gates

```bash host-verify
wc -l INSTALL-FOR-AI.md INSTALL.md README.md
node scripts/check-line-citations.mjs --check --corpus
scripts/build-getff-dist.sh --check
PC_LOCAL=1 make self-audit
bash scripts/run-local-ci-sweep.sh
```

Plus: a scripted existence check of every path you added or edited in a shipped doc, run against a
throwaway consumer install (`bash setup ts-server` into a `mktemp -d` npm project), so that
«exists» means «exists in the consumer tree» and not «exists in this repo». Paste the command and
its output into the PR body.

## §4 Falsifiers to write into the PR body

- A consumer following README `:160`/`:245`/`:275` runs `npx husky init` → #1536 not closed.
- `grep -c -i plugin INSTALL-FOR-AI.md` still returns 0 → #1533-A not closed.
- `INSTALL-FOR-AI.md` > 600 lines → the commit could not have passed pre-commit; if it did,
  pre-commit did not run in the container, which is itself a finding.
- The rewritten refresh note contradicts `setup.d/lib.sh:480-489` on the unbaselined path → the
  doc repeats the pre-W1-A error in a new form.
- A shipped doc still cites `INSTALL-FOR-AI.md` without saying it is framework-side → #1535 class 1
  not closed.

## §5 Out of scope

- W2-G's `INSTALL-FOR-AI.md` section and its `setup.d` check (#1502).
- A path-existence gate for backticked citations.
- Any change to `setup.d/*.sh` behaviour. This stage documents the code; if the code looks wrong,
  file it and do not fix it here.

## §6 Report (umbrella §5 template, strict)

`Stat` (files + lines) / `Verify` (each §3 gate with its observed output) / `DECISIONS` (every
fork taken, e.g. the depcruise ruling) / `ATTN` (mandatory stop if non-empty) /
`Confidence: high|medium|low`. PR body carries `## Fidelity verdict` and the §1.7
Forward-check / Backward-check sections (umbrella §0.6).

## §7 AI traps ([ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md))

**T3** command-or-`file:line` for every claim in the PR body · **T2** run the consumer install,
do not describe it · **T7** negative-existence claims (the «no path gate» follow-up) need the
6-item checklist · **T19** own cold review before handoff · **T21** cold
`agents/backward-sweep-auditor.md` on the class «a shipped consumer doc states installer behaviour
that the installer's own code or output contradicts». #1536 and #1540 are two instances of that
class. The sweep asks where the third one is.
