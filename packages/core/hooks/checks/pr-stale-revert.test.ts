import { describe, expect, it } from 'vitest';
import {
  checkFileStaleRevert,
  checkStaleRevert,
  collectArchaeology,
  formatFindings,
  HISTORY_DEPTH,
  parseStaleRevertToken,
  type FileArchaeology,
  type StaleRevertGit,
} from './pr-stale-revert.ts';

/**
 * The real #1285 archaeology, read out of this repo's own history (verified
 * 2026-08-08, git 2.53.0):
 *
 *   git rev-parse ab280e1d3f:<F>   → c4ad2adc…  (head)
 *   git rev-parse ab280e1d3f^:<F>  → 40ad63ea…  (base tip, set by 025aac054c = #1283)
 *   git rev-list -n 6 ab280e1d3f^ -- <F> → 025aac054c, 480584a911
 *   git rev-parse 480584a911:<F>   → c4ad2adc…  ← head reproduces THIS older blob
 *
 * Hard-coded rather than shelled out so the fixture stays stable if staging is
 * ever re-written; the live end-to-end run against real git is the bin test.
 */
const KICKOFF = '.claude/orchestrator-prompts/consumer-matrix-pnpm-flake/kickoff.md';
const INCIDENT_1285: FileArchaeology = {
  path: KICKOFF,
  headBlob: 'c4ad2adc2eb8ea4cb98c55697688628b3065229f',
  baseBlob: '40ad63ea0855ef248a5f07177a12c0d6058c8989',
  history: [
    { commit: '025aac054c8e9ee307fc43613b888ab6c2749dcc', blob: '40ad63ea0855ef248a5f07177a12c0d6058c8989' },
    { commit: '480584a9114a70373f8a5d873b98b6115de0b665', blob: 'c4ad2adc2eb8ea4cb98c55697688628b3065229f' },
  ],
};

/** Short synthetic blob/commit names keep the non-incident cases readable. */
const file = (o: Partial<FileArchaeology> = {}): FileArchaeology => ({
  path: 'src/a.ts',
  headBlob: 'blobHEAD',
  baseBlob: 'blobBASE',
  history: [{ commit: 'c1', blob: 'blobBASE' }],
  ...o,
});

describe('checkFileStaleRevert — accept path (nothing to say)', () => {
  it('passes when head and base agree on the file', () => {
    expect(checkFileStaleRevert(file({ headBlob: 'blobBASE' }))).toBeNull();
  });

  it('passes when the head blob is novel (a genuine new change)', () => {
    const f = file({
      history: [
        { commit: 'c2', blob: 'blobBASE' },
        { commit: 'c1', blob: 'blobOLD' },
      ],
    });
    expect(checkFileStaleRevert(f)).toBeNull();
  });

  it('passes when the file is absent at head (deletion — declared v1 non-goal)', () => {
    expect(checkFileStaleRevert(file({ headBlob: null }))).toBeNull();
  });

  it('passes when the file is absent at base (addition/rename — declared v1 non-goal)', () => {
    expect(checkFileStaleRevert(file({ baseBlob: null }))).toBeNull();
  });

  it('passes on an empty history (a file with no resolvable base-side lineage)', () => {
    expect(checkFileStaleRevert(file({ history: [] }))).toBeNull();
  });
});

describe('checkFileStaleRevert — the stale-revert signature', () => {
  it('flags the real #1285 shape and names the discarded commit (#1283)', () => {
    const finding = checkFileStaleRevert(INCIDENT_1285);
    expect(finding).not.toBeNull();
    expect(finding?.path).toBe(KICKOFF);
    expect(finding?.matchedCommit).toBe('480584a9114a70373f8a5d873b98b6115de0b665');
    expect(finding?.discardedCommits).toEqual(['025aac054c8e9ee307fc43613b888ab6c2749dcc']);
  });

  it('matches the NEWEST occurrence when content oscillated A→B→A→C', () => {
    // history newest-first: c4=C(base) c3=A c2=B c1=A ; head = A
    const f = file({
      headBlob: 'A',
      baseBlob: 'C',
      history: [
        { commit: 'c4', blob: 'C' },
        { commit: 'c3', blob: 'A' },
        { commit: 'c2', blob: 'B' },
        { commit: 'c1', blob: 'A' },
      ],
    });
    const finding = checkFileStaleRevert(f);
    expect(finding?.matchedCommit).toBe('c3');
    expect(finding?.discardedCommits).toEqual(['c4']);
  });

  it('reports every newer base commit that touched the file as discarded', () => {
    const f = file({
      headBlob: 'v1',
      baseBlob: 'v4',
      history: [
        { commit: 'c4', blob: 'v4' },
        { commit: 'c3', blob: 'v3' },
        { commit: 'c2', blob: 'v2' },
        { commit: 'c1', blob: 'v1' },
      ],
    });
    expect(checkFileStaleRevert(f)?.discardedCommits).toEqual(['c4', 'c3', 'c2']);
  });

  it('does not treat a history entry equal to the base blob as a revert target', () => {
    // An older commit that happens to carry the CURRENT content is not evidence of
    // anything — head differs from base, so matching it would be a false positive.
    const f = file({
      headBlob: 'novel',
      baseBlob: 'same',
      history: [
        { commit: 'c2', blob: 'same' },
        { commit: 'c1', blob: 'same' },
      ],
    });
    expect(checkFileStaleRevert(f)).toBeNull();
  });

  it('checkStaleRevert collects findings across files and skips the clean ones', () => {
    const findings = checkStaleRevert([
      file({ path: 'clean.ts', headBlob: 'blobBASE' }),
      INCIDENT_1285,
      file({
        path: 'setup.d/x.sh',
        headBlob: 'old',
        baseBlob: 'new',
        history: [
          { commit: 'n1', blob: 'new' },
          { commit: 'o1', blob: 'old' },
        ],
      }),
    ]);
    expect(findings.map((f) => f.path)).toEqual([KICKOFF, 'setup.d/x.sh']);
  });
});

describe('checkFileStaleRevert — paired-negative (the detection arm is load-bearing)', () => {
  /**
   * Paired-negative contract:
   *   ❌ blob-equality arm stubbed out (always "clean") → the real #1285 archaeology
   *      passes undetected, i.e. the gate reproduces the incident it exists to catch
   *   ✅ the shipped checkFileStaleRevert → the same archaeology is FLAGGED, naming
   *      the matched commit and the discarded #1283 commit
   *
   * mutation-sanity-checked (write-time): deleting the `entry.blob === headBlob`
   * branch in pr-stale-revert.ts makes this test's ✅ arm fail.
   */
  it('PAIRED-NEGATIVE: stubbing the blob-equality arm lets the #1285 archaeology through [M-stale]', () => {
    const stubbed = (_f: FileArchaeology): null => null; // the "no detection" mutant
    expect(stubbed(INCIDENT_1285)).toBeNull();

    const real = checkFileStaleRevert(INCIDENT_1285);
    expect(real).not.toBeNull();
    expect(real?.matchedCommit).toBe('480584a9114a70373f8a5d873b98b6115de0b665');
    expect(real?.discardedCommits).toContain('025aac054c8e9ee307fc43613b888ab6c2749dcc');
  });

  /**
   * Paired-negative contract:
   *   ❌ head blob mutated to a value absent from the base history → NOT flagged
   *   ✅ head blob left at the stale value → flagged
   * This is the known v1 false negative in miniature: a stale file the PR also edits
   * produces a novel blob and is undetectable by whole-file equality.
   */
  it('PAIRED-NEGATIVE: mutating the head blob to a novel value suppresses the finding [M-stale]', () => {
    const edited: FileArchaeology = { ...INCIDENT_1285, headBlob: 'ffffffffffffffffffffffffffffffffffffffff' };
    expect(checkFileStaleRevert(edited)).toBeNull();
    expect(checkFileStaleRevert(INCIDENT_1285)).not.toBeNull();
  });
});

describe('parseStaleRevertToken — the escape hatch for deliberate restorations', () => {
  it('accepts an em-dash token with a >=20-char rationale', () => {
    const t = parseStaleRevertToken(
      'body\nSTALE-REVERT: intended — restoring the §1j block clobbered by #1285\nmore',
    );
    expect(t.valid).toBe(true);
    expect(t.rationale).toMatch(/restoring the/);
  });

  it('accepts an ASCII hyphen as the separator', () => {
    expect(
      parseStaleRevertToken('STALE-REVERT: intended - restoring the kickoff rev 2 dropped by #1285')
        .valid,
    ).toBe(true);
  });

  it('rejects a rationale shorter than 20 chars (a template default stays red)', () => {
    const t = parseStaleRevertToken('STALE-REVERT: intended — yes');
    expect(t.present).toBe(true);
    expect(t.valid).toBe(false);
    expect(t.reason).toMatch(/>=20 chars/);
  });

  it('rejects a malformed token with a specific reason, not silence', () => {
    const t = parseStaleRevertToken('STALE-REVERT: yes please');
    expect(t.present).toBe(true);
    expect(t.valid).toBe(false);
    expect(t.reason).toMatch(/malformed STALE-REVERT line/);
  });

  it('rejects a lowercase token (case-sensitive grammar, same as FIDELITY)', () => {
    expect(parseStaleRevertToken('stale-revert: intended — a perfectly long rationale here').present)
      .toBe(false);
  });

  it('ignores an HTML-commented token (a body that renders empty must not pass)', () => {
    const t = parseStaleRevertToken(
      '<!--\nSTALE-REVERT: intended — commented-out template default text\n-->\n',
    );
    expect(t.present).toBe(false);
    expect(t.valid).toBe(false);
  });

  it('reports absence when no token line exists at all', () => {
    expect(parseStaleRevertToken('## Summary\nnothing here\n')).toEqual({
      present: false,
      valid: false,
      rationale: '',
      reason: '',
    });
  });
});

describe('formatFindings — the message names the file, the match, and the fix', () => {
  it('names every flagged file, its matched commit, and the merge-forward fix', () => {
    const out = formatFindings(checkStaleRevert([INCIDENT_1285])).join('\n');
    expect(out).toContain(KICKOFF);
    expect(out).toContain('480584a9114a70373f8a5d873b98b6115de0b665');
    expect(out).toContain('025aac054c8e9ee307fc43613b888ab6c2749dcc');
    expect(out).toMatch(/git-conflict-merge-forward\.md/);
    expect(out).toMatch(/STALE-REVERT: intended/);
  });
});

// ── collectArchaeology (git injected — no shelling out) ───────────────────────

/** A scripted fake: blobs keyed `<rev>:<path>`, history keyed by path. */
function fakeGit(o: {
  mergeBase?: string | null;
  modified?: string[];
  blobs?: Record<string, string>;
  history?: Record<string, string[]>;
}): StaleRevertGit {
  return {
    revExists: () => true,
    mergeBase: () => (o.mergeBase === undefined ? 'MB' : o.mergeBase),
    modifiedFiles: () => o.modified ?? [],
    blobAt: (rev, path) => o.blobs?.[`${rev}:${path}`] ?? null,
    commitsTouching: (_rev, path, limit) => (o.history?.[path] ?? []).slice(0, limit),
  };
}

describe('collectArchaeology — range walk over an injected git', () => {
  it('builds newest-first history for a file whose head differs from base', () => {
    const g = fakeGit({
      modified: ['a.md'],
      blobs: { 'HEAD:a.md': 'b1', 'BASE:a.md': 'b3', 'c3:a.md': 'b3', 'c2:a.md': 'b2', 'c1:a.md': 'b1' },
      history: { 'a.md': ['c3', 'c2', 'c1'] },
    });
    const { mergeBase, files } = collectArchaeology(g, 'BASE', 'HEAD');
    expect(mergeBase).toBe('MB');
    expect(files).toHaveLength(1);
    expect(files[0]?.history.map((h) => h.commit)).toEqual(['c3', 'c2', 'c1']);
    expect(checkStaleRevert(files)[0]?.matchedCommit).toBe('c1');
  });

  it('skips a file whose head blob equals the base blob (no history walk needed)', () => {
    const g = fakeGit({
      modified: ['a.md'],
      blobs: { 'HEAD:a.md': 'same', 'BASE:a.md': 'same' },
      history: { 'a.md': ['c1'] },
    });
    expect(collectArchaeology(g, 'BASE', 'HEAD').files).toHaveLength(0);
  });

  it('skips a file absent at base (rename/addition territory)', () => {
    const g = fakeGit({ modified: ['new.md'], blobs: { 'HEAD:new.md': 'b1' } });
    expect(collectArchaeology(g, 'BASE', 'HEAD').files).toHaveLength(0);
  });

  it('collapses consecutive identical historical blobs to their newest commit', () => {
    const g = fakeGit({
      modified: ['a.md'],
      blobs: { 'HEAD:a.md': 'b1', 'BASE:a.md': 'b2', 'c3:a.md': 'b2', 'c2:a.md': 'b2', 'c1:a.md': 'b1' },
      history: { 'a.md': ['c3', 'c2', 'c1'] },
    });
    const { files } = collectArchaeology(g, 'BASE', 'HEAD');
    expect(files[0]?.history.map((h) => h.commit)).toEqual(['c3', 'c1']);
    expect(checkStaleRevert(files)[0]?.discardedCommits).toEqual(['c3']);
  });

  it('caps the history walk at HISTORY_DEPTH commits', () => {
    const long = Array.from({ length: 80 }, (_, i) => `c${i}`);
    const blobs: Record<string, string> = { 'HEAD:a.md': 'bX', 'BASE:a.md': 'b0' };
    long.forEach((c, i) => { blobs[`${c}:a.md`] = `b${i}`; });
    const g = fakeGit({ modified: ['a.md'], blobs, history: { 'a.md': long } });
    expect(collectArchaeology(g, 'BASE', 'HEAD').files[0]?.history).toHaveLength(HISTORY_DEPTH);
  });

  it('surfaces an unresolvable merge-base as null (the bin fails closed on it)', () => {
    const g = fakeGit({ mergeBase: null, modified: ['a.md'] });
    expect(collectArchaeology(g, 'BASE', 'HEAD')).toEqual({ mergeBase: null, files: [] });
  });
});
