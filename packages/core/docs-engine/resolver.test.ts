// Named-place resolver — docs single-source engine, slice S3 (E-1, E-2).
// Spec: docs/superpowers/specs/2026-10-01-docs-single-source-engine-design.md §E-1/E-2 (`:53`, `:54`).
// Contract: the S3 stage kickoff (.claude/orchestrator-prompts/docs-ssot-s3-resolver/kickoff.md §7).
//
// Covers §7 falsifier rows 1-9 as deterministic unit cases (row 10 is the report-time
// E-1 counter-prompt search — never a fixture), plus one integration case on a real repo
// named place (README.md#h:why-this-exists — the E-1 verbatim example). Inline-string
// fixtures pin every input a sibling channel could move (T22); the pure core runs through
// the injected `read`, the default reader is exercised only by the symlink-escape and
// integration cases.
//
// Slug TEXT transformation expectations mirror the ported source, principle 42's
// slugify (42-context-md-pointer-rule.test.ts:158-170, arm c3): runs NOT collapsed —
// `a + b` → `a--b`. Slug DEDUP is deliberately NOT principle 42's `collectAnchors`
// base-slug counter (which emits `alpha-1` twice for `Alpha`/`Alpha-1`/`Alpha`); the
// shipped form is github-slugger's collision-aware EMITTED-slug dedup.
import { mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { afterAll, describe, expect, it } from 'vitest';
import { canonicalJson, resolvePlace, signature } from './resolver.ts';
import type { PlaceError } from './resolver.ts';

// ---------------------------------------------------------------------------
// Fixture plumbing — pure core through an injected read (principle 42's
// `:194-196` pattern): a Map-backed reader, throws on missing like ENOENT.
// ---------------------------------------------------------------------------
function mkRead(files: Record<string, string>) {
  return (p: string): string => {
    const c = files[p];
    if (c === undefined) throw new Error(`ENOENT (fixture): ${p}`);
    return c;
  };
}

type Resolved = ReturnType<typeof resolvePlace>;

function isErr(r: Resolved): r is PlaceError {
  return typeof r === 'object' && r !== null && 'code' in r;
}

type PlaceSuccess = Exclude<Resolved, PlaceError>;
type LineSuccess = Extract<PlaceSuccess, { kind: 'h' | 'fn' | 'L' }>;

function expectOk(r: Resolved): asserts r is PlaceSuccess {
  if (isErr(r)) throw new Error(`expected success, got ${r.code}: ${r.message}`);
}

/** Success guard for the three line-bearing kinds — narrows startLine/endLine into existence. */
function expectLine(r: Resolved): asserts r is LineSuccess {
  expectOk(r);
  if (r.kind === 'jp') throw new Error(`expected a line-bearing kind (h/fn/L), got jp`);
}

function expectErr(r: Resolved, code: 'MISSING' | 'AMBIGUOUS' | 'UNSUPPORTED'): void {
  if (!isErr(r)) throw new Error(`expected ${code}, got success (kind=${(r as { kind?: string }).kind})`);
  expect(r.code).toBe(code);
}

// ---------------------------------------------------------------------------
// §7 rows 1-3 — signature normalisations (E-2): CRLF→LF + trailing-ws strip,
// nothing else. A reworded comment IS a change.
// ---------------------------------------------------------------------------
describe('signature (E-2)', () => {
  const fnLf = 'fx() {\n  # fetch the widget\n  echo hi\n}\n';

  it('row 1: CRLF vs LF byte-variants of one fn: body → identical signature', () => {
    const read = mkRead({ 'fix/lf.sh': fnLf, 'fix/crlf.sh': fnLf.replace(/\n/g, '\r\n') });
    const lf = resolvePlace('fix/lf.sh#fn:fx', read);
    const crlf = resolvePlace('fix/crlf.sh#fn:fx', read);
    expectOk(lf);
    expectOk(crlf);
    expect(signature(crlf.content)).toBe(signature(lf.content));
    // direct unit: the two normalisations and nothing else
    expect(signature('a\r\nb \t\r\n')).toBe(signature('a\nb\n'));
  });

  it('row 2: trailing-whitespace-only edit → identical signature', () => {
    const read = mkRead({
      'fix/ws.sh': 'fx() {\n  echo hi   \n\techo yo\t\n}\n',
      'fix/nows.sh': 'fx() {\n  echo hi\n\techo yo\n}\n',
    });
    const a = resolvePlace('fix/ws.sh#fn:fx', read);
    const b = resolvePlace('fix/nows.sh#fn:fx', read);
    expectOk(a);
    expectOk(b);
    expect(signature(b.content)).toBe(signature(a.content));
    expect(signature('x   \ny\t\n')).toBe(signature('x\ny\n'));
  });

  it('row 3: reworded comment inside the body → DIFFERENT signature', () => {
    const a = signature(fnLf);
    const b = signature(fnLf.replace('fetch the widget', 'grab the widget'));
    expect(a).not.toBe(b);
  });
});

// ---------------------------------------------------------------------------
// §7 row 4 — jp: canonical form + discriminated result shapes
// ---------------------------------------------------------------------------
describe('canonicalJson + jp: shapes', () => {
  const value = { b: { y: 1, x: 2 }, a: [1, 2] };
  const compact = JSON.stringify(value);
  const permuted = '{"b":{"y":1,"x":2},"a":[1,2]}';
  const pretty = JSON.stringify(value, null, 2);
  const canonical = '{"a":[1,2],"b":{"x":2,"y":1}}';

  it('row 4: key-order permutation and pretty-vs-compact → identical jp: content', () => {
    const read = mkRead({
      'fix/p1.json': permuted,
      'fix/p2.json': compact,
      'fix/p3.json': pretty,
    });
    const r1 = resolvePlace('fix/p1.json#jp:', read);
    const r2 = resolvePlace('fix/p2.json#jp:', read);
    const r3 = resolvePlace('fix/p3.json#jp:', read);
    expectOk(r1);
    expectOk(r2);
    expectOk(r3);
    expect(r1.content).toBe(canonical);
    expect(r2.content).toBe(r1.content);
    expect(r3.content).toBe(r1.content); // parse-then-reserialise
    // canonicalJson is THE canonical form (E-3): sorted keys, compact, no trailing newline
    expect(canonicalJson(value)).toBe(canonical);
    expect(canonicalJson(value).endsWith('\n')).toBe(false);
  });

  it('row 4: jp: results OMIT startLine/endLine; h:/fn:/L: results carry truthful bounds', () => {
    const read = mkRead({
      'fix/doc.json': '{"k": 1}',
      'fix/md.md': '# T\nbody\n',
      'fix/f.sh': 'fx() {\n  echo\n}\n',
      'fix/l.txt': 'one\ntwo\nthree\n',
    });
    const jp = resolvePlace('fix/doc.json#jp:', read);
    expectOk(jp);
    expect('startLine' in jp).toBe(false);
    expect('endLine' in jp).toBe(false);
    const h = resolvePlace('fix/md.md#h:t', read);
    expectLine(h);
    expect(Number.isInteger(h.startLine)).toBe(true);
    expect(Number.isInteger(h.endLine)).toBe(true);
    const fn = resolvePlace('fix/f.sh#fn:fx', read);
    expectLine(fn);
    expect(Number.isInteger(fn.startLine)).toBe(true);
    expect(Number.isInteger(fn.endLine)).toBe(true);
    const l = resolvePlace('fix/l.txt:2-3', read);
    expectLine(l);
    expect(l.startLine).toBe(2);
    expect(l.endLine).toBe(3);
    expect(l.content).toBe('two\nthree');
  });
});

// ---------------------------------------------------------------------------
// §7 row 5 — jp: RFC 6901 evaluation: root addressing, escapes, arrays, taxonomy
// ---------------------------------------------------------------------------
describe('jp: RFC 6901 evaluation', () => {
  const read = mkRead({
    // whole-document target
    'fix/root.json': '{"b": {"y": 1, "x": 2}, "a": [1, 2]}',
    // `/` = the member named "" (RFC 6901 §4), never the document
    'fix/empty-member.json': '{"": "v"}',
    'fix/no-empty-member.json': '{"other": 1}',
    'fix/array-root.json': '["a"]',
    // decode order: ~1 → / BEFORE ~0 → ~, so `~01` names the member `~1`
    'fix/esc.json': '{"~1": "tilde-one"}',
    // arrays: decimal index, no leading zeros, no `-`
    'fix/arr.json': '{"arr": ["first", "second"]}',
    // scalar / null targets
    'fix/scalar.json': '{"s": 42}',
    // malformed escape: bare ~ not followed by 0/1
    'fix/bare.json': '{"a": 1}',
    // non-empty pointer must start with `/`
    'fix/noslash.json': '{"a": 1}',
    // JSONC — JSON.parse fails → MISSING carrying the reason, never a guess
    'fix/jsonc.json': '{"a": 1} // trailing comment',
  });

  it('row 5: empty pointer resolves the WHOLE document', () => {
    const r = resolvePlace('fix/root.json#jp:', read);
    expectOk(r);
    expect(r.content).toBe('{"a":[1,2],"b":{"x":2,"y":1}}');
  });

  it('row 5: `/` addresses the empty-string member; absent → MISSING; array root → UNSUPPORTED', () => {
    const hit = resolvePlace('fix/empty-member.json#jp:/', read);
    expectOk(hit);
    expect(hit.content).toBe('"v"');
    expectErr(resolvePlace('fix/no-empty-member.json#jp:/', read), 'MISSING');
    expectErr(resolvePlace('fix/array-root.json#jp:/', read), 'UNSUPPORTED');
  });

  it('row 5: `~01` decodes to the member `~1` (not `/`)', () => {
    const r = resolvePlace('fix/esc.json#jp:/~01', read);
    expectOk(r);
    expect(r.content).toBe('"tilde-one"');
  });

  it('row 5: array tokens — /0 first element; 01 and - illegal; beyond-last MISSING', () => {
    const first = resolvePlace('fix/arr.json#jp:/arr/0', read);
    expectOk(first);
    expect(first.content).toBe('"first"');
    const second = resolvePlace('fix/arr.json#jp:/arr/1', read);
    expectOk(second);
    expect(second.content).toBe('"second"');
    expectErr(resolvePlace('fix/arr.json#jp:/arr/01', read), 'UNSUPPORTED');
    expectErr(resolvePlace('fix/arr.json#jp:/arr/-', read), 'UNSUPPORTED');
    expectErr(resolvePlace('fix/arr.json#jp:/arr/9', read), 'MISSING');
  });

  it('row 5: token applied to a scalar → MISSING; malformed escapes → UNSUPPORTED', () => {
    expectErr(resolvePlace('fix/scalar.json#jp:/s/x', read), 'MISSING');
    expectErr(resolvePlace('fix/bare.json#jp:/a~', read), 'UNSUPPORTED');
    expectErr(resolvePlace('fix/bare.json#jp:/a~x', read), 'UNSUPPORTED');
    expectErr(resolvePlace('fix/noslash.json#jp:a', read), 'UNSUPPORTED');
    expectErr(resolvePlace('fix/jsonc.json#jp:/a', read), 'MISSING');
    // legal pointer into an absent member → MISSING
    expectErr(resolvePlace('fix/root.json#jp:/zzz', read), 'MISSING');
  });
});

// ---------------------------------------------------------------------------
// §7 row 6 — h: ATX dedup (emitted-slug form) + run-preserving slug
// ---------------------------------------------------------------------------
describe('h: ATX dedup', () => {
  const read = mkRead({
    'fix/dedup.md': '# Alpha\nalpha body\n\n# Alpha-1\nmid body\n\n# Alpha\nend body\n',
    'fix/plus.md': '# a + b\nplus body\n',
  });

  it('row 6: Alpha / Alpha-1 / Alpha → alpha / alpha-1 / alpha-2 (emitted-slug dedup)', () => {
    const first = resolvePlace('fix/dedup.md#h:alpha', read);
    expectLine(first);
    expect(first.startLine).toBe(1);
    expect(first.content).toBe('# Alpha\nalpha body\n');
    const second = resolvePlace('fix/dedup.md#h:alpha-1', read);
    expectLine(second);
    expect(second.startLine).toBe(4);
    expect(second.content).toBe('# Alpha-1\nmid body\n');
    const third = resolvePlace('fix/dedup.md#h:alpha-2', read);
    expectLine(third);
    expect(third.startLine).toBe(7);
    expect(third.content).toBe('# Alpha\nend body');
  });

  it('row 6: `a + b` slugs `a--b` — runs NOT collapsed (principle 42 c3 shape)', () => {
    const r = resolvePlace('fix/plus.md#h:a--b', read);
    expectOk(r);
    expect(r.content).toBe('# a + b\nplus body');
  });
});

// ---------------------------------------------------------------------------
// §7 row 7 — h: setext forms, level arithmetic, fence awareness
// ---------------------------------------------------------------------------
describe('h: setext + level arithmetic + fences', () => {
  const read = mkRead({
    'fix/setext.md': [
      'Alpha',
      '=====',
      'body of alpha',
      '',
      '## Next',
      'next body',
      '',
      '# After',
      'after body',
      '',
    ].join('\n'),
    'fix/multiline.md': 'Foo\nbar\n===\nbody text\n',
    'fix/fenced.md': '```\n---\n```\nplain text\n',
    'fix/setext2.md': 'para text\n---\nbody\n',
  });

  it('row 7: a level-2 heading does NOT close a level-1 setext section', () => {
    const alpha = resolvePlace('fix/setext.md#h:alpha', read);
    expectLine(alpha);
    expect(alpha.startLine).toBe(1); // the FIRST text line
    expect(alpha.content).toContain('## Next'); // the L2 subsection is INSIDE
    expect(alpha.content).toContain('next body');
    expect(alpha.content).not.toContain('# After'); // a level-1 heading DOES close it
    const next = resolvePlace('fix/setext.md#h:next', read);
    expectLine(next);
    expect(next.startLine).toBe(5);
    expect(next.content).toBe('## Next\nnext body\n');
  });

  it('row 7: multi-line setext paragraph — slug from lines joined with a single space', () => {
    const r = resolvePlace('fix/multiline.md#h:foo-bar', read);
    expectLine(r);
    expect(r.startLine).toBe(1);
    expect(r.content.startsWith('Foo\nbar\n===')).toBe(true);
    expect(r.content.startsWith('===')).toBe(false);
  });

  it('row 7: a `---` inside a fence is not a level-2 underline; underline is not heading text', () => {
    expectErr(resolvePlace('fix/fenced.md#h:plain-text', read), 'MISSING');
    // positive control: the same shape OUTSIDE a fence IS a setext L2 heading
    const r = resolvePlace('fix/setext2.md#h:para-text', read);
    expectLine(r);
    expect(r.startLine).toBe(1);
    expect(r.content).toBe('para text\n---\nbody');
    // the slug comes from the TEXT paragraph, not the underline
    expectErr(resolvePlace('fix/setext2.md#h:-', read), 'MISSING');
  });
});

// ---------------------------------------------------------------------------
// §7 row 8 — fn: carriers + per-carrier region scanners (T-S3-B)
// ---------------------------------------------------------------------------
describe('fn: carriers and column-0 false closes', () => {
  const read = mkRead({
    'fix/posix.sh': 'build() {\n  make all\n}\n',
    'fix/ksh.sh': 'function kern {\n  echo one\n}\n',
    'fix/arrow.ts': 'const mk = (x: number): number => {\n  return x + 1\n}\n',
    'fix/jsfn.ts': 'export function jf(a: string): string {\n  return a\n}\n',
    // `}` at column 0 INSIDE a template literal must not close (T-S3-B, JS)
    'fix/tpl.ts': 'export function makeGreeting(name: string): string {\n  const s = `hello\n}\nworld`;\n  return s\n}\n',
    // `${…}` interpolation — entering it must SPEND its `{` in the brace depth, else the
    // interpolation's column-0 closing `}` is taken as the function close (rework finding
    // 0cdaa88adadc: both shapes below resolved wrongly — a false early close and a false
    // inline refusal — under a green suite that only covered the no-interpolation tpl.ts)
    'fix/tplinterp.ts': 'const greet = (name: string): string => {\n  const s = `hello ${\n    name\n} !`;\n  return s\n}\n',
    'fix/tplinline.ts': 'const f = (): string => {\n  return `v=${1}`;\n}\n',
    // `}` at column 0 INSIDE a block comment must not close
    'fix/cmt.ts': 'export function c(): number {\n/*\n}\n*/\n  return 1\n}\n',
    // `}` at column 0 INSIDE a heredoc body must not close (T-S3-B, shell)
    'fix/heredoc.sh': 'run() {\n  cat <<EOF\n}\nEOF\n  echo done\n}\n',
    // `}` at column 0 INSIDE a quoted string must not close
    'fix/quoted.sh': 'q() {\n  echo "multi\n}\nline"\n  echo ok\n}\n',
    // P16 one-liner shape: inline close → DETECTED and refused, never scanned past
    'fix/inline.sh': 'function a { [ ${#L[@]} -gt 0 ] && echo y; }\nfunction b { echo z; }\n',
    // two distinct top-level matches → AMBIGUOUS
    'fix/amb.sh': 'dup() {\n  echo one\n}\ndup() {\n  echo two\n}\n',
    // parked language (q5): python def → UNSUPPORTED
    'fix/mod.py': 'def foo():\n    pass\n',
  });

  it('row 8: POSIX + ksh + arrow + JS function carriers resolve with truthful bounds', () => {
    const posix = resolvePlace('fix/posix.sh#fn:build', read);
    expectLine(posix);
    expect([posix.startLine, posix.endLine]).toEqual([1, 3]);
    expect(posix.content).toBe('build() {\n  make all\n}');
    const ksh = resolvePlace('fix/ksh.sh#fn:kern', read);
    expectLine(ksh);
    expect([ksh.startLine, ksh.endLine]).toEqual([1, 3]);
    const arrow = resolvePlace('fix/arrow.ts#fn:mk', read);
    expectLine(arrow);
    expect([arrow.startLine, arrow.endLine]).toEqual([1, 3]);
    const jsfn = resolvePlace('fix/jsfn.ts#fn:jf', read);
    expectLine(jsfn);
    expect([jsfn.startLine, jsfn.endLine]).toEqual([1, 3]);
  });

  it('row 8 (T-S3-B): `}` at column 0 inside a TEMPLATE LITERAL does not close (JS)', () => {
    const r = resolvePlace('fix/tpl.ts#fn:makeGreeting', read);
    expectLine(r);
    expect(r.content).toContain('world`');
    expect(r.content).toContain('return s');
    expect(r.endLine).toBe(6);
  });

  it('row 8 (T-S3-B): multi-line ${…} interpolation — its column-0 closing `}` does not close the fn', () => {
    const r = resolvePlace('fix/tplinterp.ts#fn:greet', read);
    expectLine(r);
    expect(r.content).toContain('} !`');
    expect(r.content).toContain('return s');
    expect([r.startLine, r.endLine]).toEqual([1, 6]);
  });

  it('row 8 (T-S3-B): single-line `v=${1}` interpolation inside a genuine multi-line fn still resolves', () => {
    const r = resolvePlace('fix/tplinline.ts#fn:f', read);
    expectLine(r);
    expect([r.startLine, r.endLine]).toEqual([1, 3]);
    expect(r.content).toContain('`v=${1}`');
  });

  it('row 8: `}` at column 0 inside a block comment does not close (JS)', () => {
    const r = resolvePlace('fix/cmt.ts#fn:c', read);
    expectLine(r);
    expect(r.content).toContain('return 1');
    expect(r.endLine).toBe(6);
  });

  it('row 8 (T-S3-B): `}` at column 0 inside a HEREDOC body does not close (shell)', () => {
    const r = resolvePlace('fix/heredoc.sh#fn:run', read);
    expectLine(r);
    expect(r.content).toContain('echo done');
    expect(r.endLine).toBe(6);
  });

  it('row 8: `}` at column 0 inside a quoted string does not close (shell)', () => {
    const r = resolvePlace('fix/quoted.sh#fn:q', read);
    expectLine(r);
    expect(r.content).toContain('echo ok');
    expect(r.endLine).toBe(6);
  });

  it('row 8: ksh one-liner with inline close → UNSUPPORTED (never MISSING, never scanned past)', () => {
    const err = resolvePlace('fix/inline.sh#fn:a', read);
    expectErr(err, 'UNSUPPORTED');
    if (isErr(err)) {
      expect(err.message).toContain('inline');
      expect(err.ref).toBe('fix/inline.sh#fn:a');
    }
    const errB = resolvePlace('fix/inline.sh#fn:b', read);
    expectErr(errB, 'UNSUPPORTED');
    expect('content' in errB).toBe(false);
  });

  it('row 8: two distinct top-level matches → AMBIGUOUS; absent name → MISSING', () => {
    expectErr(resolvePlace('fix/amb.sh#fn:dup', read), 'AMBIGUOUS');
    expectErr(resolvePlace('fix/posix.sh#fn:nope', read), 'MISSING');
  });

  it('row 8: python def → UNSUPPORTED (parked q5 — python/cargo/go bind by L:)', () => {
    const err = resolvePlace('fix/mod.py#fn:foo', read);
    expectErr(err, 'UNSUPPORTED');
    if (isErr(err)) expect(err.message).toContain('parked');
  });
});

// ---------------------------------------------------------------------------
// §7 row 9 — L: bounds + path admission (every kind, before any read)
// ---------------------------------------------------------------------------
describe('L: bounds + path admission', () => {
  const read = mkRead({
    'fix/l.txt': 'l1\nl2\nl3\nl4\nl5\n',
    'fix/secret.txt': 'TOPSECRET-BODY\nmore\n',
  });

  it('row 9: path:5-3 → UNSUPPORTED; beyond-EOF → MISSING; neither returns content', () => {
    expectErr(resolvePlace('fix/l.txt:5-3', read), 'UNSUPPORTED');
    expectErr(resolvePlace('fix/l.txt:99', read), 'MISSING');
    expectErr(resolvePlace('fix/l.txt:4-99', read), 'MISSING');
  });

  it('row 9: line 0 is outside the 1-based grammar — :0 and :0-N refuse UNSUPPORTED, never a success with startLine 0', () => {
    const zero = resolvePlace('fix/l.txt:0', read);
    expectErr(zero, 'UNSUPPORTED');
    expect('content' in zero).toBe(false);
    expectErr(resolvePlace('fix/l.txt:0-2', read), 'UNSUPPORTED');
    // an end-bound of 0 is equally outside the grammar (and would be NN > MM)
    expectErr(resolvePlace('fix/l.txt:2-0', read), 'UNSUPPORTED');
    // positive control: 1-based inclusive bounds stay truthful
    const one = resolvePlace('fix/l.txt:1-2', read);
    expectLine(one);
    expect([one.startLine, one.endLine]).toEqual([1, 2]);
  });

  it('row 9: absolute path → UNSUPPORTED before any read (every kind)', () => {
    expectErr(resolvePlace('/etc/hosts:1', read), 'UNSUPPORTED');
    expectErr(resolvePlace('/abs/path.md#jp:', read), 'UNSUPPORTED');
    expectErr(resolvePlace('/abs/path.md#h:whatever', read), 'UNSUPPORTED');
  });

  it('row 9: `..` traversal escaping the repo root → UNSUPPORTED before any read', () => {
    expectErr(resolvePlace('../outside.md#jp:', read), 'UNSUPPORTED');
    expectErr(resolvePlace('a/../../b.md:1', read), 'UNSUPPORTED');
    expectErr(resolvePlace('..:1', read), 'UNSUPPORTED');
  });

  it('row 9: lexical normalization INSIDE the root is admitted', () => {
    const r = resolvePlace('fix/sub/../l.txt:1-2', read);
    expectOk(r);
    expect(r.content).toBe('l1\nl2');
  });

  it('row 9: grammar refusals — no kind token, empty h:/fn: names, unknown kind, non-numeric L:', () => {
    expectErr(resolvePlace('fix/l.txt#', read), 'UNSUPPORTED');
    expectErr(resolvePlace('fix/l.txt#h:', read), 'UNSUPPORTED');
    expectErr(resolvePlace('fix/l.txt#fn:', read), 'UNSUPPORTED');
    expectErr(resolvePlace('fix/l.txt#x:foo', read), 'UNSUPPORTED');
    expectErr(resolvePlace('fix/l.txt:abc', read), 'UNSUPPORTED');
    expectErr(resolvePlace('fix/l.txt', read), 'UNSUPPORTED');
    // jp: with an EMPTY name is VALID — the RFC 6901 empty pointer
    const r = resolvePlace('fix/secret.txt#jp:', () => '{"k": "v"}');
    expectOk(r);
    expect(r.content).toBe('{"k":"v"}');
  });

  it('row 9: injected reader throwing on a missing file → MISSING (errors are values)', () => {
    expectErr(resolvePlace('fix/absent.txt:1', read), 'MISSING');
  });

  it('row 9: diagnostics carry the ref only, never host-file content', () => {
    const err = resolvePlace('fix/secret.txt#fn:nope', read);
    expectErr(err, 'MISSING');
    if (isErr(err)) {
      expect(err.message).toContain('fix/secret.txt#fn:nope');
      expect(err.message.includes('TOPSECRET-BODY')).toBe(false);
    }
    const unsup = resolvePlace('../outside.md#jp:', read);
    expectErr(unsup, 'UNSUPPORTED');
    if (isErr(unsup)) expect(unsup.message.includes('TOPSECRET-BODY')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Default reader — symlink escape (filesystem fixture via node builtins)
// ---------------------------------------------------------------------------
describe('default reader: filesystem admission', () => {
  const testDir = dirname(fileURLToPath(import.meta.url));
  const linkDir = resolve(testDir, '.tmp-symlink-fixture');
  const outsidePath = resolve(tmpdir(), 's3-resolver-outside-fixture.md');
  const linkPath = resolve(linkDir, 'escape.md');

  afterAll(() => {
    rmSync(linkDir, { recursive: true, force: true });
    rmSync(outsidePath, { force: true });
  });

  it('row 9: a repo-relative path whose realpath escapes the root → UNSUPPORTED', () => {
    mkdirSync(linkDir, { recursive: true });
    writeFileSync(outsidePath, 'outside body\n');
    symlinkSync(outsidePath, linkPath);
    const r = resolvePlace('packages/core/docs-engine/.tmp-symlink-fixture/escape.md:1');
    expectErr(r, 'UNSUPPORTED');
    if (isErr(r)) expect(r.message.includes('outside body')).toBe(false);
  });

  it('row 9: a genuine repo-relative file resolves through the default reader', () => {
    const r = resolvePlace('packages/core/docs-engine/.tmp-symlink-fixture/../inside-check.md:1');
    // ..:1 on a MISSING file is MISSING (admission passed; the file does not exist)
    expectErr(r, 'MISSING');
  });
});

// ---------------------------------------------------------------------------
// Integration — a real repo named place (E-1 verbatim example).
// Asserted on boundaries and signature stability, never absolute line numbers.
// ---------------------------------------------------------------------------
describe('integration: README.md#h:why-this-exists', () => {
  it('resolves the real repo section on boundaries; signature is stable across resolves', () => {
    const a = resolvePlace('README.md#h:why-this-exists');
    expectLine(a);
    const b = resolvePlace('README.md#h:why-this-exists');
    expectLine(b);
    expect(a.kind).toBe('h');
    expect(a.path).toBe('README.md');
    expect(a.content.startsWith('## Why this exists')).toBe(true);
    expect(a.content).toContain('Authoritative for:');
    expect(a.endLine).toBeGreaterThanOrEqual(a.startLine);
    expect(signature(b.content)).toBe(signature(a.content));
  });
});

// ---------------------------------------------------------------------------
// Acceptance-hold corrections (PR #2097 review round — nine blocking defects,
// one regression test per review comment, RED before its fix commit)
// ---------------------------------------------------------------------------

describe('correction 4242549866: fn: discovery ignores non-top-level lexical context', () => {
  const read = mkRead({
    // the review comment's exact counterexample: a declaration inside a block comment
    'ghost/only.js': '/*\nfunction ghost() {\n}\n*/',
    // same ghost plus a REAL top-level function: ghost must not make real AMBIGUOUS
    'ghost/with-real.js': '/*\nfunction ghost() {\n}\n*/\nfunction real() {\n  return 1\n}\n',
  });

  it('a fn: carrier inside a block comment is not a top-level match (→ MISSING)', () => {
    expectErr(resolvePlace('ghost/only.js#fn:ghost', read), 'MISSING');
  });

  it('a commented declaration does not make a real function spuriously AMBIGUOUS', () => {
    const r = resolvePlace('ghost/with-real.js#fn:real', read);
    expectLine(r);
    expect([r.startLine, r.endLine]).toEqual([5, 7]);
    expectErr(resolvePlace('ghost/with-real.js#fn:ghost', read), 'MISSING');
  });
});

describe('correction 4242549887: jp: keeps malformed-JSON contents out of diagnostics', () => {
  it('a JSON parse failure carries a stable reason, never the file contents', () => {
    const r = resolvePlace('secret.json#jp:', mkRead({ 'secret.json': 'TOPSECRET-BODY' }));
    expectErr(r, 'MISSING');
    if (isErr(r)) {
      expect(r.message.includes('TOPSECRET-BODY')).toBe(false);
      expect(r.message).toContain('does not parse as JSON');
    }
  });
});

describe('correction 4242549870: shell close scan tracks nested brace groups', () => {
  it('a `{ … }` group inside the body does not classify as the inline close', () => {
    const read = mkRead({ 'grp/x.sh': 'fx() {\n  { echo hi; }\n}\n' });
    const r = resolvePlace('grp/x.sh#fn:fx', read);
    expectLine(r);
    expect([r.startLine, r.endLine]).toEqual([1, 3]);
    expect(r.content).toBe('fx() {\n  { echo hi; }\n}');
  });
});

describe('correction 4242549876: closing code fences at least the opener length', () => {
  it('a longer same-char closing fence closes the block; later headings stay visible', () => {
    const read = mkRead({ 'fence/long.md': '```\nfenced\n````\n## Real\nbody\n' });
    const r = resolvePlace('fence/long.md#h:real', read);
    expectLine(r);
    expect(r.content).toBe('## Real\nbody');
  });

  it('a shorter closing fence does NOT close; a tilde fence still needs tildes', () => {
    const read = mkRead({
      // 4-open, 3-close: still fenced -> the heading after it is never seen
      'fence/short.md': '````\nfenced\n```\n## Hidden\n',
      // tilde opener is not closed by backticks
      'fence/tildes.md': '~~~\nfenced\n```\n## TildeHidden\n~~~\n## After\nbody\n',
    });
    expectErr(resolvePlace('fence/short.md#h:hidden', read), 'MISSING');
    expectErr(resolvePlace('fence/tildes.md#h:tildehidden', read), 'MISSING');
    expectLine(resolvePlace('fence/tildes.md#h:after', read));
  });
});
