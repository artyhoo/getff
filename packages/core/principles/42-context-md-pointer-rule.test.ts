/**
 * Principle 42 — CONTEXT.md pointer rule: every pointer resolves (file AND anchor)
 *
 * Source: docs/superpowers/specs/2026-08-18-skill-stack-harmonization-design.md §5.2
 *         (D-H11) — «Principle test (new slot, mold of principles 08/09): every
 *         CONTEXT.md link resolves to an existing anchor.»
 *
 * Invariant (the mechanically checkable half of the pointer rule): every pointer in the
 * repo-root CONTEXT.md resolves to an existing file, AND — when it carries a `#fragment`
 * — to an anchor that actually exists in that file. A fragment-only pointer (`#term`)
 * resolves against CONTEXT.md itself.
 *
 * OUT OF SCOPE — the redefinition half. §5.2's authoring rule also says a term that
 * already has an owner doc (.claude/rules/doc-authority-hierarchy.md) carries a one-line
 * gist + link, never a redefinition. Whether a paragraph restates or points is a judgment
 * call with no mechanical predicate; it stays prose in the spec (attention-is-not-a-
 * mechanism.md §1 permits this only because the LOAD-BEARING half — does the pointer
 * still land? — IS mechanised, here).
 *
 * ── Why a principle test and not the incumbent lychee gate (non-duplication) ─────────
 * Three independent legs, all verified on this tree at authoring time (2026-08-18):
 *   1. NO fragment checking anywhere. Neither lychee arm passes `--include-fragments`:
 *      pre-push runs `lychee --offline --no-progress <changed *.md>`
 *      (packages/core/hooks/pre-push.ts:1527), CI runs `--no-progress --config
 *      lychee.toml <globs>` (.github/workflows/link-checker.yml:55-61). Anchors are
 *      unchecked today — the half this test exists for.
 *   2. The CI arm's file scope excludes a repo-root CONTEXT.md outright: its globs are
 *      README.md, INSTALL*.md, the docs/ recursive markdown glob, plugin/README.md
 *      (.github/workflows/link-checker.yml:57-60).
 *   3. The pre-push arm is DIFF-scoped (pre-push.ts:1506-1508) and degrades to a skip
 *      when lychee is not installed (pre-push.ts:1528-1534). The defect class this test
 *      catches is exactly the one a diff-scoped gate structurally cannot see: an anchor
 *      RENAMED IN AN OWNER DOC silently breaks a CONTEXT.md pointer while CONTEXT.md
 *      itself is unchanged in that push.
 * REVISIT TRIGGER: if lychee fragment-checking is ever enabled repo-wide (i.e.
 * `--include-fragments` lands in BOTH arms AND the CI scope grows to cover CONTEXT.md),
 * the anchor half here becomes redundant — re-evaluate this slot then, not before.
 * Prior art: prior-art-evaluations.md#19 (lychee, ADOPT — the considered-REUSE candidate).
 *
 * ── Why absence of CONTEXT.md is a VALID state (spec §8 item 1) ──────────────────────
 * CONTEXT.md is authored later, in a separate attended `/setup-matt-pocock-skills` run.
 * The real-tree arm therefore skips while the file is absent — mold of principle 12's
 * `KICKOFFS_AVAILABLE`. The skip is NOT a vacuous green: the detector's correctness is
 * carried by the pure-logic arms below, which run unconditionally against inline
 * fixtures needing no real file (principle-02 paired-negative discipline). A test whose
 * only arm is a skip would be #discipline-theatre; the arms that matter always run.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../..');
const CONTEXT_MD = resolve(REPO_ROOT, 'CONTEXT.md');

/** What a pointer target resolves to on the surrounding filesystem. */
export type Target =
  { kind: 'missing' } | { kind: 'dir' } | { kind: 'file'; content: string };

/** A resolvable link found in CONTEXT.md. `path` is null for a same-file `#fragment`. */
export interface Pointer {
  raw: string;
  path: string | null;
  fragment: string | null;
  line: number;
}

/** Schemes that point outside the repo — not this gate's business (lychee owns them). */
const EXTERNAL_RE = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i;

/**
 * Blank out fenced code blocks (``` and ~~~), preserving line count so reported line
 * numbers stay true. Links inside a fence are illustrative samples, not pointers —
 * gating them would fail a doc for showing what a broken pointer looks like.
 */
function stripFences(md: string): string {
  const lines = md.split('\n');
  let fence: string | null = null;
  return lines
    .map((l) => {
      const m = /^\s*(`{3,}|~{3,})/.exec(l);
      if (m) {
        if (fence === null) {
          fence = m[1][0];
          return '';
        }
        if (m[1][0] === fence) {
          fence = null;
          return '';
        }
      }
      return fence === null ? l : '';
    })
    .join('\n');
}

/** Split a link destination into repo-relative path + fragment. */
function splitTarget(
  destRaw: string,
): { path: string | null; fragment: string | null } | null {
  let dest = destRaw.trim();
  if (dest.startsWith('<') && dest.endsWith('>'))
    dest = dest.slice(1, -1).trim();
  // Drop an optional link title: [t](path "title") / 'title' / (title)
  dest = dest.replace(/\s+(["'(]).*$/s, '').trim();
  if (dest === '' || EXTERNAL_RE.test(dest)) return null;
  const hash = dest.indexOf('#');
  if (hash === 0)
    return { path: null, fragment: decodeURIComponent(dest.slice(1)) };
  if (hash < 0) return { path: decodeURIComponent(dest), fragment: null };
  return {
    path: decodeURIComponent(dest.slice(0, hash)),
    fragment: decodeURIComponent(dest.slice(hash + 1)),
  };
}

/**
 * Every in-repo pointer in a CONTEXT.md source: inline links `[t](dest)` AND
 * reference definitions `[label]: dest`. Both forms are gated — a reference-style
 * pointer that escaped the check would be a hole in the gate, not a style choice.
 */
export function extractPointers(md: string): Pointer[] {
  const body = stripFences(md);
  const out: Pointer[] = [];
  body.split('\n').forEach((line, i) => {
    // The destination group tolerates SPACES so a titled link `[t](path "Title")`
    // is matched and then title-stripped by splitTarget. A space-intolerant group
    // silently skips titled links — the gate goes quiet instead of red, and an arm
    // asserting «no violations» then passes for the wrong reason (caught in this
    // stage's own cold review; arm (c6) now asserts extraction, not just emptiness).
    for (const m of line.matchAll(
      /(!?)\[[^\]]*\]\(\s*([^()]*(?:\([^()]*\)[^()]*)*?)\s*\)/g,
    )) {
      if (m[1] === '!') continue; // images are assets, not pointers
      const split = splitTarget(m[2]);
      if (split) out.push({ raw: m[0], line: i + 1, ...split });
    }
    const def = /^\s{0,3}\[([^\]]+)\]:\s*(\S+)/.exec(line);
    if (def) {
      const split = splitTarget(def[2]);
      if (split) out.push({ raw: def[0].trim(), line: i + 1, ...split });
    }
  });
  return out;
}

/**
 * GitHub-flavoured heading slug (github-slugger's shape): strip markdown decoration,
 * lowercase, drop every character that is not a letter/number/underscore/hyphen/space,
 * then map each REMAINING space to one hyphen. Runs are deliberately NOT collapsed —
 * GitHub's slugger removes punctuation first and hyphenates per space, so `a + b`
 * becomes `a--b`, not `a-b` (this test's own arm (c3) caught the collapsing first draft).
 * Underscores survive (`snake_case` → `snake_case`); only PAIRED emphasis underscores
 * are peeled. Duplicate slugs get GitHub's `-1`, `-2`, … suffix.
 */
export function slugify(headingText: string): string {
  return headingText
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1') // link → its text
    .replace(/[`*~]/g, '')
    .replace(/(^|\s)_([^_]+)_(?=\s|$)/g, '$1$2') // _emphasis_ → emphasis
    .replace(/<[^>]*>/g, '')
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, '')
    .replace(/\s/g, '-');
}

/**
 * Anchors a markdown file offers: ATX heading slugs (GitHub's own de-duplication) plus
 * explicit HTML anchors (`<a id=…>` / `<a name=…>` / any `id="…"`), which several docs
 * in this tree use for stable link targets.
 */
export function collectAnchors(md: string): Set<string> {
  const anchors = new Set<string>();
  const seen = new Map<string, number>();
  for (const line of stripFences(md).split('\n')) {
    const h = /^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$/.exec(line);
    if (h) {
      const base = slugify(h[2]);
      if (base !== '') {
        const n = seen.get(base) ?? 0;
        seen.set(base, n + 1);
        anchors.add(n === 0 ? base : `${base}-${n}`);
      }
    }
    for (const m of line.matchAll(/(?:id|name)=["']([^"']+)["']/g))
      anchors.add(m[1]);
  }
  return anchors;
}

/**
 * PURE core — the whole contract in one function. `lookup` is injected, so every arm
 * below runs against inline fixtures with no real file on disk (principle 02).
 * Returns one human-readable violation string per unresolved pointer.
 */
export function unresolvedPointers(
  contextSource: string,
  lookup: (relPath: string) => Target,
): string[] {
  const violations: string[] = [];
  const selfAnchors = collectAnchors(contextSource);

  for (const p of extractPointers(contextSource)) {
    const where = `CONTEXT.md:${p.line} ${p.raw}`;

    if (p.path === null) {
      if (p.fragment !== null && !selfAnchors.has(p.fragment)) {
        violations.push(
          `${where} → no anchor '#${p.fragment}' in CONTEXT.md itself`,
        );
      }
      continue;
    }

    const target = lookup(p.path);
    if (target.kind === 'missing') {
      violations.push(`${where} → file '${p.path}' does not exist`);
      continue;
    }
    if (p.fragment === null) continue;
    if (target.kind === 'dir') {
      violations.push(
        `${where} → '${p.path}' is a directory; '#${p.fragment}' cannot resolve`,
      );
      continue;
    }
    if (!collectAnchors(target.content).has(p.fragment)) {
      violations.push(`${where} → '${p.path}' has no anchor '#${p.fragment}'`);
    }
  }
  return violations;
}

/** Real-tree lookup, rooted at the repo (CONTEXT.md lives at the repo root). */
function repoLookup(relPath: string): Target {
  const abs = resolve(REPO_ROOT, relPath);
  if (!existsSync(abs)) return { kind: 'missing' };
  if (statSync(abs).isDirectory()) return { kind: 'dir' };
  return { kind: 'file', content: readFileSync(abs, 'utf8') };
}

/** Fixture lookup: an in-memory tree, so the negative arms need no file on disk. */
function fixtureLookup(
  tree: Record<string, string | null>,
): (p: string) => Target {
  return (relPath) => {
    if (!(relPath in tree)) return { kind: 'missing' };
    const v = tree[relPath];
    return v === null ? { kind: 'dir' } : { kind: 'file', content: v };
  };
}

// CONTEXT.md is authored in a separate attended session (spec §8 item 1) — absence is a
// VALID state, and the real-tree arm skips while it holds. The detector arms below do not.
const CONTEXT_MD_PRESENT = existsSync(CONTEXT_MD);

describe('Principle 42 — every CONTEXT.md pointer resolves to an existing file and anchor', () => {
  // ── (a) real-tree — skips cleanly while CONTEXT.md does not exist yet ──────────────
  it.skipIf(!CONTEXT_MD_PRESENT)(
    '(a) real-tree: every pointer in CONTEXT.md resolves (file + anchor)',
    () => {
      const violations = unresolvedPointers(
        readFileSync(CONTEXT_MD, 'utf8'),
        repoLookup,
      );
      expect(
        violations,
        `CONTEXT.md pointer rule violated — a pointer no longer lands:\n` +
          violations.map((v) => `  ${v}`).join('\n') +
          `\nFix the pointer (or the owner doc's anchor). Per spec §5.2 a term with an ` +
          `owner doc carries a one-line gist + link to that owner's anchor.`,
      ).toHaveLength(0);
    },
  );

  it('(a-sentinel) ALWAYS RUNS: the real-tree resolver is live even while CONTEXT.md is absent', () => {
    // The load-bearing anti-#discipline-theatre arm. It drives the EXACT path arm (a)
    // uses — repoLookup, rooted at the real repo — with an inline CONTEXT.md source, so
    // the wiring is proven on every run rather than only after the attended session
    // authors CONTEXT.md (spec §8 item 1). If the resolver ever stopped reaching the
    // tree, arm (a) would pass vacuously and only THIS arm would notice.
    const broken =
      '# G\n\n- **Trailer** — [gist](CLAUDE.md#no-such-heading-here).\n';
    expect(unresolvedPointers(broken, repoLookup)).toEqual([
      "CONTEXT.md:3 [gist](CLAUDE.md#no-such-heading-here) → 'CLAUDE.md' has no anchor '#no-such-heading-here'",
    ]);
    // …and the mirror: pointers at anchors that really exist in the tree pass.
    const live =
      '# G\n\n- **Goal** — [why this exists](README.md#why-this-exists).\n' +
      '- **Trailer** — [gist](CLAUDE.md#prior-art-trailer-syntax).\n';
    expect(unresolvedPointers(live, repoLookup)).toEqual([]);
    // The skip state itself is legible: when CONTEXT.md lands, arm (a) goes live with
    // no edit to this file.
    expect(CONTEXT_MD_PRESENT).toBe(existsSync(CONTEXT_MD));
  });

  // ── (b) PAIRED NEGATIVE — the check must go RED on real breakage ───────────────────
  it('(b1) paired-negative: a pointer to a missing file is caught', () => {
    const md =
      '# Glossary\n\n- **Claim** — see [claim doctrine](docs/gone.md).\n';
    expect(unresolvedPointers(md, fixtureLookup({}))).toEqual([
      "CONTEXT.md:3 [claim doctrine](docs/gone.md) → file 'docs/gone.md' does not exist",
    ]);
  });

  it('(b2) paired-negative: a BROKEN ANCHOR in an existing file is caught (the half lychee cannot see)', () => {
    const owner = '# Owner doc\n\n## Claim doctrine\n\ntext\n';
    const md =
      '# Glossary\n\n- **Claim** — [gist](docs/owner.md#claim-doctrine-renamed).\n';
    expect(
      unresolvedPointers(md, fixtureLookup({ 'docs/owner.md': owner })),
    ).toEqual([
      "CONTEXT.md:3 [gist](docs/owner.md#claim-doctrine-renamed) → 'docs/owner.md' has no anchor '#claim-doctrine-renamed'",
    ]);
  });

  it('(b3) paired-negative: the SAME pointer passes once the anchor exists (no false RED)', () => {
    const owner = '# Owner doc\n\n## Claim doctrine\n\ntext\n';
    const md =
      '# Glossary\n\n- **Claim** — [gist](docs/owner.md#claim-doctrine).\n';
    expect(
      unresolvedPointers(md, fixtureLookup({ 'docs/owner.md': owner })),
    ).toEqual([]);
  });

  it('(b4) paired-negative: a dangling same-file #fragment is caught; a live one passes', () => {
    const broken = '# Glossary\n\n## Terms\n\nSee [below](#missing-section).\n';
    expect(unresolvedPointers(broken, fixtureLookup({}))).toEqual([
      "CONTEXT.md:5 [below](#missing-section) → no anchor '#missing-section' in CONTEXT.md itself",
    ]);
    const live = '# Glossary\n\n## Terms\n\nSee [below](#terms).\n';
    expect(unresolvedPointers(live, fixtureLookup({}))).toEqual([]);
  });

  it('(b5) paired-negative: reference-style definitions are gated too (no escape hatch)', () => {
    const md = '# Glossary\n\nSee [claim][c].\n\n[c]: docs/owner.md#nope\n';
    const owner = '# Owner doc\n\n## Yes\n';
    expect(
      unresolvedPointers(md, fixtureLookup({ 'docs/owner.md': owner })),
    ).toEqual([
      "CONTEXT.md:5 [c]: docs/owner.md#nope → 'docs/owner.md' has no anchor '#nope'",
    ]);
  });

  it('(b6) paired-negative: an anchor pointed at a directory is caught', () => {
    const md = '- [rules](.claude/rules#section)\n';
    expect(
      unresolvedPointers(md, fixtureLookup({ '.claude/rules': null })),
    ).toEqual([
      "CONTEXT.md:1 [rules](.claude/rules#section) → '.claude/rules' is a directory; '#section' cannot resolve",
    ]);
  });

  it('(b7) anti-tautology: a blank CONTEXT.md yields zero findings — presence of findings is content-driven', () => {
    // The detector must not manufacture violations out of nothing (the mirror of b1-b6:
    // if this were non-empty, every green above would be meaningless).
    expect(unresolvedPointers('', fixtureLookup({}))).toEqual([]);
    expect(unresolvedPointers('# Only a heading\n', fixtureLookup({}))).toEqual(
      [],
    );
  });

  // ── (c) detector-shape guards — the parts that silently rot ───────────────────────
  it('(c1) external links and images are out of scope — and the filter is SELECTIVE', () => {
    // Mixed fixture: if the scope filter were a blanket «find nothing», the in-repo
    // broken pointer on the same line would vanish too. Exactly one violation proves
    // the filter drops external/image links only.
    const md =
      '# G\n\n[docs](https://example.com/x#frag), [mail](mailto:a@b.c), ' +
      '![img](assets/x.png), [real](docs/gone.md)\n';
    expect(unresolvedPointers(md, fixtureLookup({}))).toEqual([
      "CONTEXT.md:3 [real](docs/gone.md) → file 'docs/gone.md' does not exist",
    ]);
  });

  it('(c2) fenced links are samples, not pointers — fence-scoped, not a blanket skip', () => {
    const md = [
      '# G',
      '',
      '```md',
      '[fenced](docs/gone.md#nope)',
      '```',
      '',
      '[live](docs/also-gone.md)',
      '',
    ].join('\n');
    // Only the UNFENCED pointer is gated, and its reported line number survives the
    // fence blanking (line 7, not a shifted one).
    expect(unresolvedPointers(md, fixtureLookup({}))).toEqual([
      "CONTEXT.md:7 [live](docs/also-gone.md) → file 'docs/also-gone.md' does not exist",
    ]);
  });

  it('(c3) slugify matches GitHub on the shapes this repo actually writes', () => {
    expect(slugify('Why this exists')).toBe('why-this-exists');
    // Stripped punctuation leaves its space behind → a DOUBLE hyphen, as GitHub emits.
    expect(slugify('§1 The rule + the four-test card')).toBe(
      '1-the-rule--the-four-test-card',
    );
    expect(slugify('`Prior-art:` trailer syntax')).toBe(
      'prior-art-trailer-syntax',
    );
    expect(slugify('**Bold** _term_')).toBe('bold-term');
    expect(slugify('snake_case survives')).toBe('snake_case-survives');
  });

  it('(c4) duplicate headings get GitHub-style -1/-2 suffixes', () => {
    const anchors = collectAnchors('## Notes\n\n## Notes\n\n## Notes\n');
    expect([...anchors].sort()).toEqual(['notes', 'notes-1', 'notes-2']);
  });

  it('(c5) explicit HTML anchors count as anchors', () => {
    expect(
      collectAnchors('<a id="stable-target"></a>\n\n# H\n').has(
        'stable-target',
      ),
    ).toBe(true);
    expect(collectAnchors('<a name="legacy"></a>\n').has('legacy')).toBe(true);
  });

  it('(c6) titled + angle-bracket destinations are EXTRACTED (not skipped) and parsed', () => {
    const owner = '# Owner\n\n## Anchor here\n';
    const md =
      '[a](docs/owner.md#anchor-here "Title")\n[b](<docs/owner.md#anchor-here>)\n';
    // Assert extraction FIRST: «zero violations» alone would also hold if these links
    // were never matched at all — the false-green this arm exists to exclude.
    expect(extractPointers(md).map((p) => [p.path, p.fragment])).toEqual([
      ['docs/owner.md', 'anchor-here'],
      ['docs/owner.md', 'anchor-here'],
    ]);
    expect(
      unresolvedPointers(md, fixtureLookup({ 'docs/owner.md': owner })),
    ).toEqual([]);
    // Paired negative on the same shapes: a titled link with a dead anchor IS caught.
    const dead = '[a](docs/owner.md#gone "Title")\n';
    expect(
      unresolvedPointers(dead, fixtureLookup({ 'docs/owner.md': owner })),
    ).toEqual([
      "CONTEXT.md:1 [a](docs/owner.md#gone \"Title\") → 'docs/owner.md' has no anchor '#gone'",
    ]);
  });

  it('(c7) the real repo tree is reachable from the resolver (lookup is not stubbed out)', () => {
    // Guards the resolver itself: if repoLookup silently returned `missing` for
    // everything, arm (a) would fail loudly rather than pass vacuously — assert both ends.
    expect(repoLookup('README.md').kind).toBe('file');
    expect(repoLookup('.claude/rules').kind).toBe('dir');
    expect(repoLookup('no/such/file.md').kind).toBe('missing');
    const readme = repoLookup('README.md');
    expect(
      readme.kind === 'file' &&
        collectAnchors(readme.content).has('why-this-exists'),
    ).toBe(true);
  });
});
