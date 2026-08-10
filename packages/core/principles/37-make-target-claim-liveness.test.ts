/**
 * Principle 37 — make-target claim liveness.
 *
 * A shell script that documents WHICH make target invokes it is asserting a
 * falsifiable property about a file it does not own (the Makefile). Nothing
 * verified that property, so it drifted silently:
 *
 *   `tests/consumer-matrix/python-unfamiliar-stack-cell.sh:39` claimed
 *   «Runs in CI (ubuntu) and host-verify (`make consumer-matrix`)» while the
 *   `consumer-matrix` target invoked only the pnpm + npm-tarball cells. The
 *   claim shipped false and survived its stage PR and review — the reader that
 *   was supposed to catch it is exactly the `#hope-as-gate` anti-pattern
 *   (`.claude/rules/attention-is-not-a-mechanism.md §2`).
 *
 * Same CLASS as the `ci-success` `needs:`-completeness defect: a header asserting
 * a coverage property about itself that no mechanism checks. Different surface,
 * so it needed its own gate.
 *
 * MECHANISM — reuse make's own resolver, never a hand-rolled Makefile parser.
 * `make -n <target>` (GNU make `--just-print`, gnu.org/software/make/manual
 * «Instead of Executing Recipes») prints the recipe lines that WOULD run, with
 * `$(CURDIR)`-class variables expanded, `@`-silenced lines included, and
 * transitive prerequisites resolved (verified: `make -n self-audit` prints the
 * recipes of all three of its prerequisites). A regex over the Makefile text
 * would re-implement all of that and drift from it — the second-copy failure
 * `.claude/rules/dual-implementation-discipline.md` exists to prevent.
 *
 * SAFETY of `-n`: make still executes recipes needed to update INCLUDED
 * makefiles. This repo's Makefile has no `include` and no `$(shell …)`
 * (asserted mechanically by `it('the -n precondition holds')` below), so `-n`
 * is side-effect free here. If either is ever added, that arm goes RED and this
 * mechanism must be re-justified before the gate is trusted.
 *
 * SCOPE — git-tracked `tests/**\/*.sh` + `scripts/**\/*.sh`. Deliberately NOT
 * `setup.d/**`: those are shipped into consumer repos that have no Makefile of
 * ours, so a make-target claim there would be about a different build file.
 *
 * ANCHOR — a BACKTICKED `make <target>` inside a COMMENT line. Both halves are
 * load-bearing and both were measured against the real corpus before shipping
 * (see the `false-positive floor` arm): bare `make \w+` matches 14 sites of
 * ordinary English prose («would make every…», «would make the counter bite»),
 * an 82% false-positive rate; the backtick anchor takes that to 0/0. Restricting
 * to comment lines mirrors the carve-out `ci-tool-pinning.md §2` already makes
 * for the same reason — an executable line containing `make x` is a real call,
 * not a claim about one.
 *
 * ESCAPE HATCH — `# make-claim: allow <rationale>` on the SAME line, rationale
 * ≥20 chars. Token shape mirrors `ci-tool-pin: allow` (`ci-tool-pinning.md §3`);
 * the ≥20-char floor is the stricter `CLAUDE.md` `Prior-art: skipped —` posture,
 * chosen because the failure it guards is a doc lying about itself. It exists for
 * the legitimate case this gate would otherwise punish: a comment that documents
 * the ABSENCE of a make target (the python cell now does exactly that).
 *
 * PAIRED NEGATIVES (principle 02): N37-1 false claim → RED; N37-2 escape → GREEN;
 * N37-3 short-rationale escape → RED (the hatch is not a blanket bypass);
 * N37-4 nonexistent target → RED; N37-5 true claim → GREEN (proves the check
 * discriminates rather than flagging every claim); N37-6 unbackticked prose →
 * not a claim.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../..');

/** A `make <target>` claim found in a comment line of a shell script. */
export interface MakeClaim {
  /** Repo-relative path of the file carrying the claim. */
  file: string;
  /** 1-indexed line number. */
  line: number;
  /** The claimed target name. */
  target: string;
  /** True when the line carries a valid escape token (rationale ≥20 chars). */
  escaped: boolean;
}

export interface Violation extends MakeClaim {
  reason: string;
}

/** How a target resolves. `commands` is the text `make -n <target>` printed. */
export interface TargetResolution {
  exists: boolean;
  commands: string;
}

const COMMENT_LINE_RE = /^\s*#/;
/** Backticked `make <target>` — the anchor. Target chars mirror make's own. */
const CLAIM_RE = /`make\s+([a-zA-Z][a-zA-Z0-9_.-]*)`/g;
/** Escape token + its rationale tail, mirroring `ci-tool-pin: allow`. */
const ESCAPE_RE = /\bmake-claim:\s+allow\b[ \t]*(.*)$/;
const MIN_RATIONALE_CHARS = 20;

/**
 * Extract every make-target claim from one file's text.
 *
 * Exported for unit-testability — the paired negatives drive this + findViolations
 * over synthetic corpora, so no fixture files need to exist on disk.
 */
export function extractMakeClaims(file: string, content: string): MakeClaim[] {
  const out: MakeClaim[] = [];
  content.split('\n').forEach((rawLine, idx) => {
    if (!COMMENT_LINE_RE.test(rawLine)) return; // executable line → a real call, not a claim
    const esc = ESCAPE_RE.exec(rawLine);
    // A rationale shorter than the floor is NOT a valid escape — `make-claim: allow`
    // with no reason is the placeholder this gate must keep punishing.
    const escaped = esc !== null && esc[1].trim().length >= MIN_RATIONALE_CHARS;
    CLAIM_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = CLAIM_RE.exec(rawLine)) !== null) {
      out.push({ file, line: idx + 1, target: m[1], escaped });
    }
  });
  return out;
}

/**
 * Core check: every unescaped claim must name a target that EXISTS and whose
 * resolved recipe actually invokes the claiming file.
 */
export function findViolations(
  entries: readonly { file: string; content: string }[],
  resolveTarget: (target: string) => TargetResolution,
): Violation[] {
  const violations: Violation[] = [];
  for (const { file, content } of entries) {
    for (const claim of extractMakeClaims(file, content)) {
      if (claim.escaped) continue;
      const r = resolveTarget(claim.target);
      if (!r.exists) {
        violations.push({
          ...claim,
          reason: `claims \`make ${claim.target}\`, but no such target exists in the Makefile`,
        });
        continue;
      }
      if (!r.commands.includes(claim.file)) {
        violations.push({
          ...claim,
          reason:
            `claims \`make ${claim.target}\` runs it, but that target's resolved recipe ` +
            `never invokes ${claim.file}`,
        });
      }
    }
  }
  return violations;
}

/** Git-tracked shell scripts in the two in-scope directories. */
function enumerateShellScripts(): string[] {
  const out = execFileSync(
    'git',
    ['ls-files', '-z', 'tests/**/*.sh', 'scripts/**/*.sh'],
    { cwd: REPO_ROOT, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 },
  );
  return out.split('\0').filter(Boolean);
}

/** Real resolver — shells out to make itself. Memoised per target. */
const resolveCache = new Map<string, TargetResolution>();
function makeResolver(target: string): TargetResolution {
  const cached = resolveCache.get(target);
  if (cached) return cached;
  let res: TargetResolution;
  try {
    const commands = execFileSync('make', ['-n', target], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 32 * 1024 * 1024,
    });
    res = { exists: true, commands };
  } catch {
    // Non-zero exit = "No rule to make target" (or a genuinely broken recipe).
    // Either way the claim cannot be honoured, which is what we report.
    res = { exists: false, commands: '' };
  }
  resolveCache.set(target, res);
  return res;
}

function loadCorpus(): { file: string; content: string }[] {
  return enumerateShellScripts().map((file) => ({
    file,
    content: readFileSync(resolve(REPO_ROOT, file), 'utf8'),
  }));
}

describe('Principle 37 — make-target claim liveness', () => {
  it('the `make -n` precondition holds: no `include`, no `$(shell …)`', () => {
    // The whole mechanism rests on `-n` being side-effect free. GNU make DOES
    // execute recipes needed to update included makefiles, and evaluates
    // $(shell) at parse time. Assert neither construct exists rather than
    // trusting a one-time manual reading of the Makefile.
    const mk = readFileSync(resolve(REPO_ROOT, 'Makefile'), 'utf8');
    const offending = mk
      .split('\n')
      .map((l, i) => ({ l, n: i + 1 }))
      .filter(({ l }) => /^\s*(-|s)?include\s/.test(l) || /\$\(shell\s/.test(l));
    expect(
      offending.map(({ l, n }) => `Makefile:${n}: ${l.trim()}`),
      'Makefile gained an `include` or `$(shell …)`. `make -n` is no longer ' +
        'guaranteed side-effect free, so principle 37 must re-justify its mechanism ' +
        'before it can be trusted. See this file\'s header, SAFETY of -n.',
    ).toEqual([]);
  });

  it('every `make <target>` claim in tests/ + scripts/ is true', () => {
    const corpus = loadCorpus();
    expect(corpus.length, 'corpus is empty — the enumerator is broken').toBeGreaterThan(0);

    const violations = findViolations(corpus, makeResolver);
    expect(
      violations.map((v) => `${v.file}:${v.line} — ${v.reason}`),
      'A shell script documents a make target that does not actually run it.\n' +
        'Fix ONE of:\n' +
        '  (a) wire the script into that target in the Makefile, or\n' +
        '  (b) correct the comment to name the channel that really runs it, or\n' +
        '  (c) if the comment documents the ABSENCE of a target, add the escape token\n' +
        `      \`# make-claim: allow <why, ≥${MIN_RATIONALE_CHARS} chars>\` on the same line.`,
    ).toEqual([]);
  });

  it('the live corpus actually contains claims — the check is not vacuous', () => {
    // Without this, a silently-broken regex makes the arm above pass trivially:
    // zero claims found → zero violations → green. That is T3/T-theatre, and it
    // is the failure mode a "clean" audit with no population enumeration hides.
    const claims = loadCorpus().flatMap((e) => extractMakeClaims(e.file, e.content));
    expect(
      claims.length,
      'Zero make-target claims found across tests/ + scripts/. Either the anchor ' +
        'regex broke, or the enumerator stopped seeing files. A gate over an empty ' +
        'population proves nothing.',
    ).toBeGreaterThanOrEqual(3);
  });

  it('false-positive floor: the backtick anchor rejects ordinary English prose', () => {
    // The measurement that justified the anchor. Bare `make \w+` matches all of
    // these; the shipped anchor must match none of them.
    const prose = [
      '# Five empty files would make every negative vacuous',
      '# a hand-duplicated block MUST make the counter bite.',
      '# arm can make exactly that dep absent). Overwrites the shipped config',
      '# would make a worktree silently execute the primary\'s older copy',
      '# it does NOT make a difference to the resolved value',
    ].join('\n');
    expect(extractMakeClaims('fixture.sh', prose)).toEqual([]);
  });
});

describe('Principle 37 — paired negatives (principle 02)', () => {
  // A fixed synthetic resolver: `consumer-matrix` exists and runs two named
  // cells; everything else does not exist. Independent of the real Makefile, so
  // these arms keep discriminating when the real target legitimately changes.
  const fakeResolve = (target: string): TargetResolution =>
    target === 'consumer-matrix'
      ? {
          exists: true,
          commands:
            'bash tests/consumer-matrix/pnpm-monorepo-cell.sh\n' +
            'bash tests/consumer-matrix/npm-tarball-cell.sh\n',
        }
      : { exists: false, commands: '' };

  const claimLine = '# Runs in CI (ubuntu) and host-verify (`make consumer-matrix`).';

  it('N37-1: a FALSE claim is RED', () => {
    const v = findViolations(
      [{ file: 'tests/consumer-matrix/python-unfamiliar-stack-cell.sh', content: claimLine }],
      fakeResolve,
    );
    // This is the exact shipped defect, reconstructed. If it ever returns [],
    // the gate would have let the original bug through and is theatre.
    expect(v).toHaveLength(1);
    expect(v[0].target).toBe('consumer-matrix');
    expect(v[0].line).toBe(1);
    expect(v[0].reason).toContain('never invokes');
  });

  it('N37-5: a TRUE claim is GREEN — the check discriminates', () => {
    // The anti-tautology leg. Same claim, same resolver, only the claiming file
    // differs. A check that flags both is just "every claim is a violation".
    const v = findViolations(
      [{ file: 'tests/consumer-matrix/pnpm-monorepo-cell.sh', content: claimLine }],
      fakeResolve,
    );
    expect(v).toEqual([]);
  });

  it('N37-2: the escape token with a real rationale is GREEN', () => {
    const content =
      '# It is therefore NOT part of `make consumer-matrix`.  ' +
      '# make-claim: allow — records the absence of a make target, not a claim to run under one';
    const v = findViolations(
      [{ file: 'tests/consumer-matrix/python-unfamiliar-stack-cell.sh', content }],
      fakeResolve,
    );
    expect(v).toEqual([]);
  });

  it('N37-3: the escape token WITHOUT a ≥20-char rationale is still RED', () => {
    // The hatch must not be a blanket bypass — `allow` + "TODO" is exactly the
    // placeholder CLAUDE.md's Prior-art hatch rejects.
    const short = '# not in `make consumer-matrix`  # make-claim: allow TODO';
    const v = findViolations(
      [{ file: 'tests/consumer-matrix/python-unfamiliar-stack-cell.sh', content: short }],
      fakeResolve,
    );
    expect(v).toHaveLength(1);

    // …and a bare token with no rationale at all is RED too.
    const bare = '# not in `make consumer-matrix`  # make-claim: allow';
    expect(
      findViolations(
        [{ file: 'tests/consumer-matrix/python-unfamiliar-stack-cell.sh', content: bare }],
        fakeResolve,
      ),
    ).toHaveLength(1);
  });

  it('N37-4: claiming a target that does not exist is RED', () => {
    const v = findViolations(
      [{ file: 'tests/x.sh', content: '# run via `make no-such-target`' }],
      fakeResolve,
    );
    expect(v).toHaveLength(1);
    expect(v[0].reason).toContain('no such target exists');
  });

  it('N37-6: a make invocation on an EXECUTABLE line is not a claim', () => {
    // `make x` in runnable code is a real call. Flagging it would make the gate
    // fire on scripts that legitimately shell out to make.
    const v = findViolations(
      [{ file: 'tests/x.sh', content: 'echo "see `make consumer-matrix`"' }],
      fakeResolve,
    );
    expect(v).toEqual([]);
  });
});
