#!/usr/bin/env node
/**
 * `path:line` citation drift gate.
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
 *   --check       exit 1 on drift, printing the corrected line number where findable
 *   --write       renumber in place wherever the moved-to line is unambiguous
 *   --blank-only  ARM 2 alone — the pre-commit channel, no git reads at all
 *
 * Deliberate non-coverage — a citation whose path does not resolve on disk is
 * SKIPPED, not failed. Measured 2026-09-13: 48 of 139 citations across
 * `.claude/rules/`, `.claude/skills/`, `agents/` and CLAUDE.md are of that shape,
 * and every one is out-of-repo by design — aif-handoff internals
 * (`coordinator.js:825`), consumer-project illustrations
 * (`src/app/api/orders/route.ts:24`), template placeholders
 * (`.claude/rules/foo.md:42`). Failing them would be a gate nobody can make green.
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
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join, normalize, relative, resolve } from 'node:path';

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
const ESCAPE_RE = /<!--\s*cite:historical\s+([^>]*?)\s*-->/;
const ESCAPE_RATIONALE_MIN = 20;

/** ARM-2-only mode (`--blank-only`): the pre-commit channel, set by `run()`. */
let blankOnly = false;

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

/** Resolve a cited path to a repo-relative file, or null when it is out-of-repo. */
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
    if (!c || c.startsWith('..')) continue;
    if (existsSync(resolve(REPO_ROOT, c))) return c;
  }
  return null;
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
      if (t !== null) anchors.push({ at: m.index, target: t });
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
      } else {
        const linkTarget = links.find(
          ([s, e]) => s <= m.index && m.index < e,
        )?.[2];
        target = resolveCitedPath(rel, c.path, linkTarget);
      }

      // Out-of-repo / synthetic — deliberate non-coverage (see header).
      if (target === null) continue;

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
        continue;
      }

      const current = readFileSync(resolve(REPO_ROOT, target), 'utf8').split(
        '\n',
      );
      if (n > current.length) {
        findings.push({
          kind: 'beyond-eof',
          srcFile: rel,
          srcLine,
          token,
          target,
          detail: `${target} has ${current.length} lines`,
        });
        continue;
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
        continue;
      }

      if (blankOnly) continue; // pre-commit channel: ARM 2 only, no git reads

      const sha = blameCommit(rel, srcLine);
      if (sha === null) continue; // uncommitted edit — nothing to compare against yet
      const historical = fileAt(sha, target);
      if (historical === null || n > historical.length) continue; // target absent then

      const wasText = squash(historical[n - 1]);
      const nowText = squash(current[n - 1]);
      if (wasText === nowText) continue;

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
        movedEnd: movedTo && c.end ? movedTo + (c.end - n) : null,
        ambiguous: matches.length > 1,
        was: wasText.slice(0, 100),
        now: nowText.slice(0, 100),
      });
    }
  });

  return findings;
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
    for (const f of fs_) {
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

export function run(argv) {
  const write = argv.includes('--write');
  const check = argv.includes('--check');
  blankOnly = argv.includes('--blank-only');
  const files = argv.filter((a) => !a.startsWith('--'));
  if (!write && !check) {
    console.error(
      'usage: check-line-citations.mjs (--check [--blank-only] | --write) <file.md>...',
    );
    return 2;
  }
  if (files.length === 0) return 0;

  const findings = files.flatMap(scanFile);
  if (findings.length === 0) return 0;

  if (write) {
    const n = renumber(findings);
    console.log(`check-line-citations --write: renumbered ${n} citation(s)`);
    const left = findings.filter(
      (f) => f.kind !== 'drifted' || !f.movedTo || f.ambiguous,
    );
    for (const f of left) report(f);
    return 0;
  }

  for (const f of findings) report(f);
  console.error(
    `\n❌ ${findings.length} stale \`path:line\` citation(s).\n` +
      `   Fix: npx tsx scripts/check-line-citations.mjs --write <files>\n` +
      `   A deliberate past-state citation takes \`<!-- cite:historical <why> -->\` on the same line.`,
  );
  return 1;
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
