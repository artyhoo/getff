#!/usr/bin/env node
/**
 * check-line-citations — `path:line` citation drift gate.
 *
 * A `path:NN` citation is a checkable claim: «the authority for what I just said
 * is on line NN of that file». Nothing checked it until now — lychee (SSOT #19)
 * gates link EXISTENCE and cannot see line drift, and its `--include-fragments`
 * validates anchors/text-fragments only, never line numbers on local links.
 *
 * Two independent arms, deterministic, with no format change (D34 keeps
 * `path:line` as the framework's emitted shape; the landing build stamps
 * permalinks from it):
 *
 * ARM 1 — drift since authorship. Has the cited line's CONTENT changed since the
 * citing sentence was last touched by a human? `git blame` on the citing line
 * gives the commit a human last wrote it in; `git show <that commit>:<target>`
 * gives what line NN said then. If that differs from line NN today, the citation
 * now points somewhere else and the reader is sent to the wrong place.
 * Self-healing: once a citation is corrected and committed, blame moves to the
 * fix commit and the comparison is green again with no bookkeeping.
 *
 * ARM 1's two structural blind spots, measured rather than assumed: a citation
 * that was WRONG WHEN WRITTEN is green (its blame commit IS the birth commit, so
 * «then» and «now» agree), and any later reflow of the citing line resets the
 * baseline forever. The RED-proof for this file found both: reintroducing the
 * motivating `arch/SKILL.md:94` drift in a fresh commit produced exit 0.
 *
 * ARM 2 — blank landing. The cited line is empty. Reads only today's target, so
 * it is birth-correct and reflow-proof — exactly ARM 1's hole. Nobody deliberately
 * cites an empty line, so it has no false-positive shape; it is also narrow, and
 * the two arms are complements, not a rate: of the 32 drifted citations measured
 * on the live-authority surface 2026-09-13, ARM 2 independently caught 2 (the
 * motivating one among them), while ARM 1 caught 32. Corpus-wide, 106 of 1500
 * resolvable citations (7.1%) land on a blank line. A birth-wrong citation landing
 * on a non-blank wrong line remains invisible to both — declared, not papered over.
 *
 * Channels follow from that split (.claude/rules/rule-enforcement-channel-selection.md
 * §1 — gate at the EARLIEST reachable channel, per arm, not per script): ARM 2 reads
 * only the working tree, so it runs at pre-commit and a birth-wrong citation never
 * enters history; ARM 1 needs a committed baseline to blame against, so pre-push is
 * the earliest channel that can reach it at all.
 *
 * Modes (precedent: scripts/render-rule-index.mjs, scripts/render-harness-config.mjs):
 *   --check              exit 1 on drift, printing the corrected line number where findable
 *   --write              renumber in place wherever the moved-to line is unambiguous
 *   --blank-only         ARM 2 alone — the pre-commit channel, no git reads at all
 *   --strict             additionally exit 1 when ANY citation could not be resolved
 *   --affected-by=<path> repeatable; run ARM 1 only for citations touching these paths
 *   --corpus             check the live-authority corpus (below) instead of named files
 *
 * Both arms read two citation shapes: `path:NN` and the explicit prose form
 * «line 63 of `setup.d/lib.sh`» / «`setup.d/10-skills.sh`, lines 22 to 27» that the
 * docs/site pages write (PROSE_OF_RE below, with why a bare «line N» is excluded).
 *
 * WHICH FILES the caller passes is the other half of coverage, and scoping it to the
 * push's changed Markdown — what pre-push §9 did until 2026-09-14 — has a structural
 * hole: a citation goes stale when the CITED file moves, and the cited file is almost
 * never among the changed Markdown. Three PRs merged on 2026-09-14 (#1755, #1761/#1762,
 * #1764) each repaired staleness the gate could not see; #1764's two sites were stale
 * because #1763 moved an install block in `setup.d/10-skills.sh` while touching no
 * corpus Markdown at all.
 *
 * `--affected-by` closes it from the other direction: the caller passes the WHOLE
 * corpus and names the paths its push changed, and ARM 1 runs for a citation whose
 * citing file OR cited target is among them. Measured 2026-09-14 on the 103-file
 * live-authority corpus: parse + resolve + ARM 2 is 0.12s, the full ARM 1 sweep is
 * 6.4s, and 72% of the last 60 first-parent commits touch no cited file at all. Both
 * causing commits above are caught by it (probe: 5 and 3 affected citations, naming
 * exactly the sites #1764 and #1761 later repaired).
 *
 * What the scoping structurally cannot reach — a push that bypasses the hook, two
 * branches where one moves a target while the other adds the citation, a branch base
 * behind staging — is the CI backstop's job: `citation-fullsweep` in audit-self.yml
 * runs this script UNSCOPED over the same corpus on every PR, every push to
 * staging/main, and every merge group. Same split as guard-liveness v1 vs
 * `guard-liveness-fullsweep.yml`: change-scoped at the earliest reachable channel, full
 * sweep as the last resort (.claude/rules/rule-enforcement-channel-selection.md §3).
 *
 * Non-coverage is REPORTED, not silent (2026-09-14). A citation whose path does not
 * resolve still does not fail the default gate — many are out-of-repo by design:
 * aif-handoff internals (`coordinator.js:825`), consumer-project illustrations
 * (`src/app/api/orders/route.ts:24`), template placeholders
 * (`.claude/rules/foo.md:42`), and failing them would be a gate nobody can make
 * green. But until this date each one was dropped with a bare `continue`: no line, no
 * count, exit 0 — so a run that checked nothing was indistinguishable from a clean
 * one. Measured that day over the five getff.ai site specs: 141 citations, 43
 * resolved, 98 dropped in silence, output zero bytes. Each unresolved citation now
 * prints `file:line  token  — skipped (<reason>)`, with a
 * `resolved N / skipped M` summary, under four reason codes: `bare-basename`,
 * `ambiguous-basename`, `path-missing`, `line-out-of-range`.
 *
 * Bare basenames resolve when the basename is UNIQUE among tracked files (`git
 * ls-files`), which is how most of that silence was bought back: on those specs the
 * skipped count fell 98 → 39, and on the live-authority corpus the gate actually runs
 * on, resolving them surfaced 12 stale citations that were green by silence the day
 * before. A basename matching several tracked files is REPORTED with its candidates
 * and never guessed (`questions.ts` exists both at
 * `packages/runtime-bridge/src/cli/questions.ts` and under `vendor/`). A
 * basename-inferred target is a weak resolution, so a cited line past its end reports
 * `line-out-of-range` rather than asserting a beyond-EOF defect — the likelier reading
 * is that the basename matched the wrong file. An author-named path keeps the hard
 * failure.
 *
 * `--strict` is deliberately NOT wired into pre-push §9: 32 citations on that corpus
 * remain unresolvable and most are out-of-repo by construction, so switching it on
 * would be the «gate nobody can make green» this file already refuses to build.
 * Broken LINKED paths remain lychee's job (pre-push §8).
 *
 * Escape hatch for a deliberate past-state citation («at incident time, line 741
 * said X» — 5 such in `.claude/rules/` alone): put on the same line
 *
 *   <!-- cite:historical <why, >= 20 chars> -->
 *
 * Rationale-length floor mirrors the escape-token precedent in
 * `.claude/rules/ci-tool-pinning.md` §3.
 */
import { readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, isAbsolute, join, normalize, relative, resolve } from 'node:path';

const CITATION_RE =
  /(?<![\w/.-])((?:\.{0,2}[/\w][\w./-]*)\.(?:md|markdown|ts|tsx|js|mjs|cjs|sh|json|jsonc|yml|yaml|py|toml))[:](\d+)(?:-(\d+))?/g;
const MD_LINK_RE = /\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
/**
 * Bare backreference — `` `:272` `` — a second line in the file the nearest
 * preceding `path:NN` on the SAME line already named ("…`audit-self.yml:271`
 * (`rustup toolchain install …`) + `:272` (`rustup default …`)"). Left unchecked,
 * `--write` half-fixes such a sentence: the anchor moves, the sibling does not.
 * Resolution is deterministic — nearest preceding resolved citation, same line.
 */
const BACKREF_RE = /`:(\d+)(?:-(\d+))?`/g;
/**
 * Prose form — the docs/site reference pages cite in sentences, not `path:NN`:
 * «line 63 of `setup.d/lib.sh`», «lines 163 to 167 of `setup.d/10-skills.sh`»,
 * «`setup.d/10-skills.sh`, lines 22 to 27». Invisible to CITATION_RE, so W1-A (#1821)
 * and W1-B (#1826) moved both files under 13 such pages with every arm here green
 * (repaired by hand in PR #1830, 2026-09-21).
 *
 * Only the EXPLICIT form counts: the sentence names its file right next to the number.
 * A bare «line 6» leans on an antecedent the prose chose — sometimes the previous
 * sentence's file, sometimes a file named two bullets up, sometimes «the skill file»
 * with no path at all. Binding it to the nearest preceding backticked path was measured
 * the same day over docs/site: ~22 of ~150 bound to the wrong file, several of them past
 * that file's end, so a hard gate on them would ship false reds. Same precision stance
 * as the sentence guard on BACKREF_RE.
 *
 * Matched over the whole file, not per line: pages are hard-wrapped, and «line 63 of\n
 * `setup.d/lib.sh`» is one citation. `d` flag: group indices locate the NUMBERS, which
 * is where blame is taken and what `--write` rewrites.
 */
const PROSE_NUM = String.raw`\blines?\s+(\d+)(?:(?:\s+(?:to|through)\s+|\s*[-–]\s*)(\d+))?(?!\s*(?:,|and)\s*\d)`;
const PROSE_PATH = '`([^`\\s:]+)`';
const PROSE_OF_RE = new RegExp(`${PROSE_NUM}\\s+(?:of|in)\\s+${PROSE_PATH}`, 'gid');
const PROSE_COMMA_RE = new RegExp(`${PROSE_PATH},?\\s+${PROSE_NUM}\\b`, 'gid');
const ESCAPE_RE = /<!--\s*cite:historical\s+([^>]*?)\s*-->/;
const ESCAPE_RATIONALE_MIN = 20;

/** ARM-2-only mode (`--blank-only`): the pre-commit channel, set by `run()`. */
let blankOnly = false;

/**
 * Reverse-index scoping (`--affected-by=<path>`, repeatable): the set of paths a push
 * changed, or `null` for an unscoped full sweep. Only ARM 1 consults it — see the
 * `affectedBy` guard in `scanFile`.
 */
let affectedBy = null;

const REPO_ROOT = execFileSync('git', ['rev-parse', '--show-toplevel'], {
  encoding: 'utf8',
}).trim();

const git = (args) =>
  execFileSync('git', args, {
    encoding: 'utf8',
    cwd: REPO_ROOT,
    maxBuffer: 64 << 20,
    stdio: ['ignore', 'pipe', 'ignore'],
  });

const squash = (s) => (s ?? '').replace(/\s+/g, ' ').trim();

/**
 * Tracked files indexed by basename, built once per process. `git ls-files` and not a
 * directory walk: the index must contain exactly what the repo owns, so a gitignored
 * scratch file (`_decision-register-*.md`) stays unresolvable rather than answering a
 * citation nobody else can follow.
 */
let basenameIndex = null;
function tracked(basename) {
  if (basenameIndex === null) {
    basenameIndex = new Map();
    let listing = '';
    try {
      listing = git(['ls-files', '-z']);
    } catch {
      listing = '';
    }
    for (const p of listing.split('\0')) {
      if (!p) continue;
      const b = p.slice(p.lastIndexOf('/') + 1);
      if (!basenameIndex.has(b)) basenameIndex.set(b, []);
      basenameIndex.get(b).push(p);
    }
  }
  return basenameIndex.get(basename) ?? [];
}

/**
 * The LIVE-AUTHORITY markdown surface — the docs a session reads to learn what holds
 * NOW, where a `path:line` citation is a live pointer a reader follows. Selected by
 * `--corpus`; the SSOT for the population, with exactly one definition (it lived in
 * `packages/core/hooks/pre-push.ts` until 2026-09-14, when the CI backstop became a
 * second consumer and a copied glob list would have been the `#sync-by-copy-paste`
 * shape .claude/rules/dual-implementation-discipline.md §8 names).
 *
 * Deliberately NOT the whole markdown corpus. `docs/meta-factory/retros/`,
 * `research-patches/` and `PROPOSAL.md` are «closed historical artifact» / «frozen — do
 * not retroactively rewrite» per the CLAUDE.md Artifact Ownership Contract; their
 * citations are snapshots of what a line said on a date, and renumbering those would
 * rewrite history, which is the opposite of the repair this gate performs. Measured
 * 2026-09-13: gating the full corpus would have fired on 36 citations in exactly that
 * closed material.
 *
 * `docs/superpowers/specs/` is the ONE deliberate gap that is NOT closed history, and it
 * is kept out on a price, not on the snapshot argument — those specs do carry live
 * pointers into repo machinery and reviewers follow them. The measurement (research patch
 * `2026-09-14-citation-quoted-literal-arm-measured-and-rejected.md`, finding S2 — whole
 * directory, 86 files, at `05e41cb87e5`):
 *
 * - COST of admitting it: 1,059 citations, 765 resolved / 294 unresolvable. 363 findings
 *   — ARM 1 339 (214 auto-renumberable by `--write`, 17 ambiguous, 108 whose cited
 *   content is gone), ARM 2 22, line-past-EOF 2 — leaving 54 of 86 files RED, 149 of the
 *   repairs hand-only, and 294 standing skip lines printed on every push that touches a
 *   spec.
 * - BENEFIT on the incident that raised the question: ZERO. PR #1765's eight birth-wrong
 *   citations would NOT have fired here. Verified at the pre-fix tree `7b600f2e7d3`:
 *   both cited coordinates are non-blank prose (`audit-self.yml:748-749` is the
 *   `--strip-components` comment, `check-hook-marker.sh:155-158` is comment prose), so
 *   ARM 2 cannot see them and ARM 1 is green by construction on a citation wrong at
 *   birth. ARM 3, the arm that would have covered that class, was built and rejected in
 *   the same patch.
 *
 * So admitting the directory buys drift-AFTER-authorship on dated design docs and costs
 * 149 hand repairs, while the class that actually escaped stays uncovered either way.
 * Narrower cells, measured the same day, for when that trade changes: specs dated
 * >= 2026-09-01 → 36 findings in 6 files; >= 2026-08-01 → 91 in 19; ARM 2 alone over all
 * specs → 24 in 15.
 *
 * Re-gate trigger: admit the directory (or the >= 2026-09-01 window) on the first
 * incident where a spec citation drifts AFTER authorship and misleads a reader — the
 * class ARM 1 actually covers. Today's 363 are repair debt, not that evidence.
 *
 * `docs/site/` joined 2026-09-21: the public docs are the live authority a CONSUMER
 * reads, and their reference pages carry ~90 explicit prose citations (PROSE_OF_RE) into
 * installer and skill files that move often. Not snapshots — each page's `sources:`
 * frontmatter is refreshed by the D26 gate (scripts/check-docs-refresh.mjs), which proves
 * a page was TOUCHED when a source moved, never that its numbers are right. Cost when
 * admitted: 18 `path:NN` citations, all clean; the prose arm's findings were zero after
 * PR #1830's hand repair.
 *
 * `plugin/agents/` is excluded because it is a byte-identical generated twin of
 * `agents/` — gating both would report every finding twice and demand the fix land in a
 * derived copy.
 */
const LIVE_AUTHORITY_MD = [
  '.claude/rules/',
  '.claude/skills/',
  'agents/',
  'CLAUDE.md',
  'AGENTS.md',
  'CONTRIBUTING.md',
  'docs/site/',
];
const PLUGIN_AGENT_TWIN_PREFIX = 'plugin/agents/';

/**
 * The corpus as TRACKED files, or `null` when git could not be asked.
 *
 * `git ls-files` and not a directory walk: an untracked scratch doc is nobody's
 * authority. The null is not an empty corpus — the caller must fail loudly on it,
 * because a sweep that checked nothing and a sweep that found nothing are otherwise
 * indistinguishable (`#hope-as-gate`,
 * .claude/rules/attention-is-not-a-mechanism.md §2). That distinction is the same one
 * the skipped-citation reporting above exists to make.
 */
function corpusFiles() {
  let listing;
  try {
    // -z: NUL-delimited, unquoted — a non-ASCII path would otherwise arrive
    // quoted+escaped and drop silently out of the corpus.
    listing = git(['ls-files', '-z']);
  } catch {
    return null;
  }
  return listing
    .split('\0')
    .filter(
      (f) =>
        f.length > 0 &&
        f.endsWith('.md') &&
        !f.startsWith(PLUGIN_AGENT_TWIN_PREFIX) &&
        LIVE_AUTHORITY_MD.some((p) =>
          p.endsWith('/') ? f.startsWith(p) : f === p,
        ),
    );
}

/**
 * Resolve a cited path to a repo-relative file.
 *
 * Returns `{ target, weak }` on success — `weak` marks a target inferred from a bare
 * basename rather than named by the author — or `{ reason, candidates }` when the
 * citation cannot be followed. A reason is NOT a failure: it is the line the reader
 * needs in order to decide, which until 2026-09-14 this function threw away.
 *
 * Bare basenames are resolved only when the basename is UNIQUE among tracked files.
 * Two files named `questions.ts` (a vendored copy beside its source) make the citation
 * genuinely ambiguous, and guessing one would manufacture a confident wrong answer —
 * the shape `.claude/rules/ai-laziness-traps.md` T3 exists to forbid.
 */
function resolveCitedPath(srcFile, citedPath, linkTarget) {
  const candidates = [];
  if (linkTarget && !/^[a-z][a-z0-9+.-]*:/i.test(linkTarget)) {
    candidates.push(
      normalize(join(dirname(srcFile), linkTarget.split('#')[0])),
    );
  }
  candidates.push(normalize(join(dirname(srcFile), citedPath)));
  candidates.push(normalize(citedPath));
  for (const c of candidates) {
    // In-repo REGULAR files only: the prose form accepts any backticked token, so a
    // directory (`packages/core`, `.`) once reached readFileSync as EISDIR and aborted the
    // scan, and an absolute path (`/etc/hosts`) read a file outside the repository.
    if (!c || c.startsWith('..') || isAbsolute(c)) continue;
    const abs = resolve(REPO_ROOT, c);
    if (existsSync(abs) && statSync(abs).isFile()) return { target: c, weak: false };
  }
  if (citedPath.includes('/')) return { reason: 'path-missing', candidates: [] };
  const hits = tracked(citedPath);
  if (hits.length === 1) return { target: hits[0], weak: true };
  if (hits.length > 1) return { reason: 'ambiguous-basename', candidates: hits };
  return { reason: 'bare-basename', candidates: [] };
}

/** The commit in which a human last wrote this line (null when uncommitted). */
function blameCommit(srcFile, line) {
  let sha;
  try {
    sha = git(['blame', '-L', `${line},${line}`, '--porcelain', '--', srcFile])
      .split('\n')[0]
      .split(' ')[0];
  } catch {
    return null;
  }
  return /^0+$/.test(sha) ? null : sha;
}

/**
 * The newest of the commits that last wrote each of these lines — the baseline for a
 * citation wrapped over several lines. Any uncommitted line makes the whole citation
 * uncommitted (null), as for a single line.
 */
function newestBlame(srcFile, lineNos) {
  const shas = [];
  for (const l of lineNos) {
    const sha = blameCommit(srcFile, l);
    if (sha === null) return null;
    if (!shas.includes(sha)) shas.push(sha);
  }
  if (shas.length === 1) return shas[0];
  let newest = shas[0];
  for (const sha of shas.slice(1)) {
    try {
      git(['merge-base', '--is-ancestor', newest, sha]);
      newest = sha; // newest is an ancestor of sha, so sha is newer
    } catch {
      // not an ancestor: keep the current newest
    }
  }
  return newest;
}

function fileAt(commit, path) {
  try {
    return git(['show', `${commit}:${path}`]).split('\n');
  } catch {
    return null;
  }
}

export function scanFile(srcFile) {
  const rel = relative(REPO_ROOT, resolve(REPO_ROOT, srcFile)) || srcFile;
  const lines = readFileSync(resolve(REPO_ROOT, rel), 'utf8').split('\n');
  const findings = [];
  const skips = [];
  let resolvedCount = 0;

  // One verdict per resolved citation, shared by both citation forms: `path:NN` (and its
  // bare backreferences) from the per-line pass, and the prose form from the whole-file
  // pass below. `pos` is set only for prose, where `--write` edits the numbers in place.
  function judge({ srcLine, token, target, weak, n, end, escape, pos = null, spans = [srcLine] }) {
    resolvedCount += 1;

    if (escape) {
      if (squash(escape[1]).length < ESCAPE_RATIONALE_MIN) {
        findings.push({
          kind: 'weak-escape',
          srcFile: rel,
          srcLine,
          token,
          detail: `cite:historical rationale must be >= ${ESCAPE_RATIONALE_MIN} chars, got ${squash(escape[1]).length}`,
        });
      }
      return;
    }

    const current = readFileSync(resolve(REPO_ROOT, target), 'utf8').split(
      '\n',
    );
    if (n > current.length) {
      // A basename-inferred target that does not even have the cited line is more
      // likely the WRONG file than a real beyond-EOF defect, so the weak arm reports
      // rather than blocks. An author-named path keeps the hard failure.
      if (weak) {
        resolvedCount -= 1;
        skips.push({
          srcFile: rel,
          srcLine,
          token,
          reason: 'line-out-of-range',
          candidates: [target],
          detail: `${target} has ${current.length} lines`,
        });
        return;
      }
      findings.push({
        kind: 'beyond-eof',
        srcFile: rel,
        srcLine,
        token,
        target,
        detail: `${target} has ${current.length} lines`,
      });
      return;
    }

    // Arm 2 — blank landing. Independent of blame, so unlike arm 1 it holds for
    // a citation that was WRONG AT BIRTH and survives a reflow of the citing
    // line (which resets arm 1's baseline). Nobody deliberately cites an empty
    // line, so this arm has no false-positive shape. It is what catches the
    // motivating case: `arch/SKILL.md:94` was an empty line.
    if (squash(current[n - 1]) === '') {
      findings.push({
        kind: 'blank-landing',
        srcFile: rel,
        srcLine,
        token,
        target,
        detail: `${target}:${n} is an empty line — the citation points at nothing`,
      });
      return;
    }

    if (blankOnly) return; // pre-commit channel: ARM 2 only, no git reads

    // Reverse-index scoping. New staleness enters the corpus through exactly two
    // doors: the citing sentence was rewritten, or the cited file moved under it.
    // ARM 1 costs a `git blame` plus a `git show` per citation (~53ms measured
    // 2026-09-14, i.e. 6.4s over the 119 resolvable citations of the live-authority
    // corpus), so a caller that knows which paths its push touched can skip every
    // citation neither door applies to. Over the last 60 first-parent commits that
    // leaves 72% of pushes running ZERO blames and a mean of 1.33 (max 15).
    // Deliberately one-sided: the flag narrows ARM 1 only. ARM 2 and the beyond-EOF
    // check read today's tree and cost no git call, so narrowing them would buy
    // nothing and would hide a defect this file can see for free.
    if (
      affectedBy !== null &&
      !affectedBy.has(rel) &&
      !affectedBy.has(target)
    ) {
      return;
    }

    const sha = newestBlame(rel, spans);
    if (sha === null) return; // uncommitted edit — nothing to compare against yet
    const historical = fileAt(sha, target);
    if (historical === null || n > historical.length) return; // target absent then

    const wasText = squash(historical[n - 1]);
    const nowText = squash(current[n - 1]);
    if (wasText === nowText) return;

    const matches = current
      .map((l, i) => (squash(l) === wasText ? i + 1 : 0))
      .filter(Boolean);
    const movedTo = wasText && matches.length ? matches[0] : null;
    findings.push({
      kind: 'drifted',
      srcFile: rel,
      srcLine,
      token,
      target,
      movedTo,
      // A range citation moves as a block: shift the end by the same delta the
      // start moved, rather than collapsing `:89-128` to a single line.
      movedEnd: movedTo && end ? movedTo + (end - n) : null,
      ambiguous: matches.length > 1,
      pos,
      was: wasText.slice(0, 100),
      now: nowText.slice(0, 100),
    });
  }

  lines.forEach((text, idx) => {
    const srcLine = idx + 1;
    const escape = ESCAPE_RE.exec(text);
    const links = [...text.matchAll(MD_LINK_RE)].map((m) => [
      m.index,
      m.index + m[0].length,
      m[2],
    ]);

    // Anchors first: a bare `:NN` backreference inherits the target of the
    // nearest preceding path:NN citation on the same line.
    const anchors = [];
    for (const m of text.matchAll(CITATION_RE)) {
      const linkTarget = links.find(
        ([s, e]) => s <= m.index && m.index < e,
      )?.[2];
      const t = resolveCitedPath(rel, m[1], linkTarget);
      if (t.target) anchors.push({ at: m.index, target: t.target, weak: t.weak });
    }
    const cites = [
      ...[...text.matchAll(CITATION_RE)].map((m) => ({
        m,
        token: m[0],
        path: m[1],
        n: Number(m[2]),
        end: m[3] ? Number(m[3]) : null,
        bare: false,
      })),
      ...[...text.matchAll(BACKREF_RE)].map((m) => ({
        m,
        token: m[0],
        path: null,
        n: Number(m[1]),
        end: m[2] ? Number(m[2]) : null,
        bare: true,
      })),
    ].sort((a, b) => a.m.index - b.m.index);

    for (const c of cites) {
      const { m, token, n } = c;
      let target;
      let weak = false;
      if (c.bare) {
        const anchor = anchors.filter((a) => a.at < m.index).pop();
        if (!anchor) continue; // no antecedent on this line — not a citation
        // Bind only within the SAME SENTENCE. Measured 2026-09-13: crossing a
        // sentence boundary mis-binds, because prose re-points the referent —
        // `reviewer-discipline.md:125` carries both «enforced at `:208`» (same
        // sentence, really pr-body-fidelity.ts) and «the audit's `:324`» (next
        // sentence, a different document entirely). Without this guard the arm
        // ran at 50% precision on this corpus; with it, 100%.
        if (/[.!?]\s/.test(text.slice(anchor.at, m.index))) continue;
        target = anchor.target;
        weak = anchor.weak;
      } else {
        const linkTarget = links.find(
          ([s, e]) => s <= m.index && m.index < e,
        )?.[2];
        const r = resolveCitedPath(rel, c.path, linkTarget);
        target = r.target ?? null;
        weak = r.weak ?? false;
        // Out-of-repo / synthetic — still deliberate non-coverage (see header), but
        // recorded and printed instead of dropped in silence.
        if (target === null) {
          skips.push({
            srcFile: rel,
            srcLine,
            token,
            reason: r.reason,
            candidates: r.candidates,
          });
          continue;
        }
      }
      if (target === null) continue;
      judge({ srcLine, token, target, weak, n, end: c.end, escape });
    }
  });

  // Prose pass (PROSE_OF_RE / PROSE_COMMA_RE header). Over the whole text so a wrapped
  // citation is one citation; a match spanning a blank line is two paragraphs, not one.
  const text = lines.join('\n');
  const lineOf = (off) => text.slice(0, off).split('\n').length;
  const colOf = (off) => off - text.lastIndexOf('\n', off - 1) - 1;
  const numAt = ([s, e]) => ({ line: lineOf(s), col: colOf(s), len: e - s, was: text.slice(s, e) });
  const ofMatches = [...text.matchAll(PROSE_OF_RE)].map((m) => ({ m, path: m[3], ni: 1 }));
  // «`X`, line N of `Y`»: the number belongs to Y. A comma-form match whose number the
  // «of» form already claimed is dropped, never double-bound to the token before it.
  const claimed = new Set(ofMatches.map(({ m }) => m.indices[1][0]));
  const commaMatches = [...text.matchAll(PROSE_COMMA_RE)]
    .map((m) => ({ m, path: m[1], ni: 2 }))
    .filter(({ m }) => !claimed.has(m.indices[2][0]));
  for (const { m, path, ni } of [...ofMatches, ...commaMatches]) {
    if (/\n\s*\n/.test(m[0])) continue;
    const start = m.indices[ni];
    const endIdx = m.indices[ni + 1];
    const srcLine = lineOf(start[0]); // the finding is reported at the number's line
    // Blame and escape look at EVERY line the citation spans: the newest of their commits
    // is the baseline, so fixing the number self-heals (the fix is newest) and so does
    // re-pointing the path on its own wrapped line.
    const first = lineOf(m.index);
    const spans = Array.from({ length: lineOf(m.index + m[0].length - 1) - first + 1 }, (_, i) => first + i);
    const token = squash(m[0]);
    const r = resolveCitedPath(rel, path, null);
    if (!r.target) {
      skips.push({ srcFile: rel, srcLine, token, reason: r.reason, candidates: r.candidates });
      continue;
    }
    judge({
      srcLine,
      token,
      target: r.target,
      weak: r.weak,
      n: Number(m[ni]),
      end: m[ni + 1] ? Number(m[ni + 1]) : null,
      escape: spans.map((l) => ESCAPE_RE.exec(lines[l - 1])).find(Boolean) ?? null,
      pos: { start: numAt(start), end: endIdx ? numAt(endIdx) : null },
      spans,
    });
  }

  return { findings, skips, resolved: resolvedCount };
}

function renumber(findings) {
  const byFile = new Map();
  for (const f of findings) {
    if (f.kind !== 'drifted' || !f.movedTo || f.ambiguous) continue;
    if (!byFile.has(f.srcFile)) byFile.set(f.srcFile, []);
    byFile.get(f.srcFile).push(f);
  }
  let written = 0;
  for (const [file, fs_] of byFile) {
    const abs = resolve(REPO_ROOT, file);
    const lines = readFileSync(abs, 'utf8').split('\n');
    // Prose citations are edited by POSITION, not by token: the token was squashed
    // across a wrap and no longer occurs verbatim. Edits run right-to-left so an earlier
    // one never shifts a later column; the ORIGINAL digits are asserted before the write,
    // so a file changed since the scan (or named twice) is skipped rather than corrupted.
    const edits = fs_
      .filter((f) => f.pos)
      .flatMap((f) => [
        [f.pos.start, f.movedTo, true],
        ...(f.pos.end && f.movedEnd ? [[f.pos.end, f.movedEnd, false]] : []),
      ])
      .sort(([a], [b]) => b.line - a.line || b.col - a.col);
    for (const [{ line, col, len, was }, value, isStart] of edits) {
      const l = lines[line - 1];
      if (l.slice(col, col + len) !== was) continue;
      lines[line - 1] = l.slice(0, col) + value + l.slice(col + len);
      if (isStart) written += 1; // one per citation, as for the token form
    }
    for (const f of fs_.filter((x) => !x.pos)) {
      const span = f.movedEnd ? `${f.movedTo}-${f.movedEnd}` : `${f.movedTo}`;
      // The trailing backtick is part of a bare backreference's token (`` `:272` ``),
      // so an end-anchored `:\d+$` never matches one and `--write` silently half-fixed
      // the sentence: the anchor moved, the sibling did not. Measured 2026-09-13 on
      // `.claude/rules/evidence-regeneration.md:77` — and arm 1 then goes BLIND to the
      // sibling, because rewriting the line makes its blame uncommitted.
      const fixed = f.token.replace(/:\d+(-\d+)?(`?)$/, `:${span}$2`);
      lines[f.srcLine - 1] = lines[f.srcLine - 1].split(f.token).join(fixed);
      written += 1;
    }
    writeFileSync(abs, lines.join('\n'));
  }
  return written;
}

/** One actionable line per unresolvable citation — the silence this gate used to keep. */
const SKIP_HINT = {
  'bare-basename':
    'no tracked file has this basename — out-of-repo, or the name is wrong/abbreviated',
  'ambiguous-basename':
    'several tracked files share this basename — qualify the path',
  'path-missing': 'path does not resolve in this repo',
  'line-out-of-range': 'basename matched, but the line does not exist there',
};

function reportSkip(s) {
  const extra = s.candidates?.length
    ? `  candidates: ${s.candidates.join(', ')}`
    : '';
  console.error(
    `${s.srcFile}:${s.srcLine}  ${s.token}  — skipped (${s.reason}): ` +
      `${s.detail ?? SKIP_HINT[s.reason] ?? ''}${extra}`,
  );
}

export function run(argv) {
  const write = argv.includes('--write');
  const check = argv.includes('--check');
  const strict = argv.includes('--strict');
  blankOnly = argv.includes('--blank-only');
  // Absent flag => null => unscoped. An omitted `--affected-by` must fail OPEN into a
  // full sweep: the failure mode of the opposite default is a caller that silently
  // checks nothing, which is the silence this script's header already refuses once.
  const affected = argv
    .filter((a) => a.startsWith('--affected-by='))
    .map((a) => a.slice('--affected-by='.length))
    .filter(Boolean);
  affectedBy = affected.length > 0 ? new Set(affected) : null;
  const named = argv.filter((a) => !a.startsWith('--'));
  if (!write && !check) {
    console.error(
      'usage: check-line-citations.mjs\n' +
        '  --check [--corpus] [--blank-only] [--strict] [--affected-by=<path>]... [<file.md>...]\n' +
        '  --write <file.md>...',
    );
    return 2;
  }
  let files = named;
  if (argv.includes('--corpus')) {
    const corpus = corpusFiles();
    if (corpus === null) {
      console.error(
        '❌ --corpus: `git ls-files` failed, so the live-authority corpus could not be\n' +
          '   enumerated. The sweep would silently cover nothing. Fix the repository\n' +
          '   state; do not skip the gate.',
      );
      return 2;
    }
    files = [...new Set([...corpus, ...named])];
  }
  if (files.length === 0) return 0;

  const scans = files.map(scanFile);
  const findings = scans.flatMap((r) => r.findings);
  const skips = scans.flatMap((r) => r.skips);
  const resolved = scans.reduce((a, r) => a + r.resolved, 0);

  if (write) {
    if (findings.length === 0) return 0;
    const n = renumber(findings);
    console.log(`check-line-citations --write: renumbered ${n} citation(s)`);
    const left = findings.filter(
      (f) => f.kind !== 'drifted' || !f.movedTo || f.ambiguous,
    );
    for (const f of left) report(f);
    return 0;
  }

  for (const f of findings) report(f);

  // Skipped citations are printed even when the gate passes. A citation the checker
  // cannot follow is not coverage; dropping it silently made 98 of 141 citations on
  // the getff.ai specs look checked when none of them were (measured 2026-09-14).
  if (skips.length > 0) {
    for (const s of skips) reportSkip(s);
    console.error(
      `\ncheck-line-citations: resolved ${resolved} / skipped ${skips.length} citation(s).`,
    );
  }

  if (findings.length > 0) {
    console.error(
      `\n❌ ${findings.length} stale \`path:line\` citation(s).\n` +
        `   Fix: npx tsx scripts/check-line-citations.mjs --write <files>\n` +
        `   A deliberate past-state citation takes \`<!-- cite:historical <why> -->\` on the same line.`,
    );
    return 1;
  }

  // Default stays 0 on skipped-only so the new visibility can land without turning
  // every push red on citations that are out-of-repo by design. `--strict` is the
  // opt-in gate for a caller that wants every citation to be followable.
  if (strict && skips.length > 0) {
    console.error(
      `\n❌ --strict: ${skips.length} citation(s) could not be resolved.`,
    );
    return 1;
  }
  return 0;
}

function report(f) {
  if (f.kind === 'drifted') {
    const span = f.movedEnd ? `${f.movedTo}-${f.movedEnd}` : `${f.movedTo}`;
    const fix = f.movedTo
      ? `→ :${span}${f.ambiguous ? '  (ambiguous — several lines match, fix by hand)' : ''}`
      : '→ cited content no longer exists (rewrite the sentence or escape it)';
    console.error(`${f.srcFile}:${f.srcLine}  ${f.token}  ${fix}`);
    console.error(`      cited: ${f.was}`);
    console.error(`      found: ${f.now}`);
  } else {
    console.error(`${f.srcFile}:${f.srcLine}  ${f.token}  — ${f.detail}`);
  }
}

const isMainEntry = () => {
  try {
    return new URL(import.meta.url).pathname === resolve(process.argv[1] ?? '');
  } catch {
    return false;
  }
};
if (isMainEntry()) process.exit(run(process.argv.slice(2)));
