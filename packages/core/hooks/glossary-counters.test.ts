/**
 * Functional tests for the D-F glossary learning counters (plain-words-recap-v2 S3).
 *
 * Two hooks, one counters file:
 *   — .claude/hooks/glossary-inject.sh (UserPromptSubmit): scans the prompt for CONTEXT.md
 *     terms and their `_Operator says_` raw words, injects one line
 *     `"<raw word>" = <term>: <definition>`, counts ONE usage per term per prompt.
 *   — the glossary arm inside .claude/hooks/end-of-turn-reminder.sh (Stop): counts the fixed
 *     `term (explanation)` form once per message, and below threshold demands the form once
 *     (per-term one-shot flag).
 *
 * Pattern: spawnSync(bash, [HOOK], {input: JSON}) — the end-of-turn-reminder.test.ts /
 * precompact-residue.test.ts mold (no new framework, no bats dep). Both hook sides are
 * pointed at a mkdtemp sandbox via AIF_RESIDUE_DIR (the residue lib's declared test seam)
 * and TMPDIR (the pending/one-shot files), so cases never touch the real residue dir.
 * AIF_HOOK_LANG is pinned EVERY case — an ambient ru from the invoking session must not
 * select the pack a case's assertions are written against.
 *
 * Case families (plan Task 6): usage counting (raw word / term itself / synonym-NOT /
 * inflected-NOT / once-per-prompt), thresholds (pack default 3·5, env override wins BOTH
 * ways — fork ruling 3), learned-OR transition, once-per-message explanations, the demand +
 * its per-term one-shot, learned-between-prompt-and-Stop, the SAME-PATH falsifier (a path
 * split between the two hooks is kickoff §5's falsifier), and absent-CONTEXT.md inertness
 * on both sides (the unarmed goldens stay byte-stable).
 */
import { describe, it, expect, afterEach, afterAll } from 'vitest';
import { execSync, spawnSync } from 'node:child_process';
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  rmSync,
  existsSync,
  copyFileSync,
} from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../..');
const INJECT_HOOK = resolve(REPO_ROOT, '.claude/hooks/glossary-inject.sh');
const STOP_HOOK = resolve(REPO_ROOT, '.claude/hooks/end-of-turn-reminder.sh');
const EN_PACK = resolve(REPO_ROOT, '.claude/hooks/lang/en.sh');
const RU_PACK = resolve(REPO_ROOT, '.claude/hooks/lang/ru.sh');
const PARITY = resolve(REPO_ROOT, '.claude/hooks/lang/check-parity.sh');

const SLOW_SHELL_MS = 30_000;

function hasJq(): boolean {
  try {
    execSync('command -v jq', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}
const JQ = hasJq();

const tmpDirs: string[] = [];
afterEach(() => {
  for (const d of tmpDirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

/** Fresh sandbox. AIF_RESIDUE_DIR (residue-dir.sh's declared test seam) and TMPDIR (the
 *  pending + one-shot flag files) both point here, so a case's writes never leak. */
function sandbox(): { dir: string; counts: string } {
  const dir = mkdtempSync(join(tmpdir(), 'glossary-counters-'));
  tmpDirs.push(dir);
  return { dir, counts: join(dir, '_glossary-counts.json') };
}

function readCounts(counts: string): { terms: Record<string, { usages?: number; explanations?: number }> } {
  return JSON.parse(readFileSync(counts, 'utf8'));
}

function writeCounts(counts: string, terms: Record<string, { usages?: number; explanations?: number }>): void {
  writeFileSync(counts, JSON.stringify({ terms }), 'utf8');
}

/** The pending file the inject side writes for the Stop side, same sanitizer as both hooks
 *  (`tr -c 'A-Za-z0-9._-' '_' | cut -c1-96`). Test session ids are sanitize-stable ASCII. */
function pendingPath(tmp: string, sessionId: string): string {
  return join(tmp, `aif-glossary-pending-${sessionId.slice(0, 96)}`);
}

interface RunResult {
  status: number;
  stdout: string;
  stderr: string;
}

function runInject(
  prompt: string,
  opts: { sessionId?: string; env?: Record<string, string>; projectDir?: string } = {},
): RunResult {
  const sb = sandbox();
  const r = spawnSync('bash', [INJECT_HOOK], {
    input: JSON.stringify({ prompt, session_id: opts.sessionId ?? 'sess-inject' }),
    encoding: 'utf8',
    env: {
      ...process.env,
      AIF_HOOK_LANG: 'en',
      CLAUDE_CODE_ENTRYPOINT: 'cli',
      CLAUDE_PROJECT_DIR: opts.projectDir ?? REPO_ROOT,
      AIF_RESIDUE_DIR: sb.dir,
      TMPDIR: sb.dir,
      ...opts.env,
    },
  });
  return { status: r.status ?? -1, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

/** Where did THIS inject run put its state? Sandboxes are per-run, so expose them. */
function runInjectTracked(
  prompt: string,
  opts: { sessionId?: string; env?: Record<string, string>; projectDir?: string } = {},
): RunResult & { sb: { dir: string; counts: string } } {
  const sb = sandbox();
  const r = spawnSync('bash', [INJECT_HOOK], {
    input: JSON.stringify({ prompt, session_id: opts.sessionId ?? 'sess-inject' }),
    encoding: 'utf8',
    env: {
      ...process.env,
      AIF_HOOK_LANG: 'en',
      CLAUDE_CODE_ENTRYPOINT: 'cli',
      CLAUDE_PROJECT_DIR: opts.projectDir ?? REPO_ROOT,
      AIF_RESIDUE_DIR: sb.dir,
      TMPDIR: sb.dir,
      ...opts.env,
    },
  });
  return { status: r.status ?? -1, stdout: r.stdout ?? '', stderr: r.stderr ?? '', sb };
}

/** Minimal JSONL transcript — the writeTranscript mold of end-of-turn-reminder.test.ts. */
function writeTranscript(dir: string, answer: string): string {
  const transcript = join(dir, 'transcript.jsonl');
  const lines = [
    JSON.stringify({ type: 'user', message: { content: 'объясни термин приземлить' } }),
    JSON.stringify({
      type: 'assistant',
      message: { content: [{ type: 'text', text: answer }] },
    }),
  ];
  writeFileSync(transcript, lines.join('\n') + '\n', 'utf8');
  return transcript;
}

interface StopOpts {
  sessionId?: string;
  answer: string;
  counts?: Record<string, { usages?: number; explanations?: number }>;
  pending?: Array<[string, string]>; // [term, raw word] rows the inject side would leave
  env?: Record<string, string>;
  tmpDir?: string; // share ONE tmp sandbox across sequenced runs (one-shot flag cases)
  residueDir?: string; // share ONE residue sandbox across sequenced runs
}

function runStop(opts: StopOpts): RunResult & { sb: string; residue: string } {
  const sb = opts.tmpDir ?? mkdtempSync(join(tmpdir(), 'glossary-stop-tmp-'));
  if (!opts.tmpDir) tmpDirs.push(sb);
  const residue = opts.residueDir ?? mkdtempSync(join(tmpdir(), 'glossary-stop-res-'));
  if (!opts.residueDir) tmpDirs.push(residue);
  const sessionId = opts.sessionId ?? 'sess-stop';
  if (opts.pending?.length) {
    writeFileSync(pendingPath(sb, sessionId), opts.pending.map(([t, w]) => `${t}\t${w}`).join('\n') + '\n', 'utf8');
  }
  if (opts.counts) writeCounts(join(residue, '_glossary-counts.json'), opts.counts);
  const transcript = writeTranscript(sb, opts.answer);
  const r = spawnSync('bash', [STOP_HOOK], {
    input: JSON.stringify({
      session_id: sessionId,
      transcript_path: transcript,
      stop_hook_active: false,
    }),
    encoding: 'utf8',
    env: {
      ...process.env,
      AIF_HOOK_LANG: 'ru', // the demand assertions match the ru pack's [glossary] line
      CLAUDE_CODE_ENTRYPOINT: 'cli',
      CLAUDE_PROJECT_DIR: REPO_ROOT,
      AIF_RESIDUE_DIR: residue,
      TMPDIR: sb,
      ...opts.env,
    },
  });
  return { status: r.status ?? -1, stdout: r.stdout ?? '', stderr: r.stderr ?? '', sb, residue };
}

describe('glossary inject hook — usage counting', () => {
  it.skipIf(!JQ)('counts a raw _Operator says_ word and injects the term line', () => {
    const r = runInjectTracked('объясни термин приземлить пожалуйста', { sessionId: 'sess-raw' });
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('"приземлить" = Land: ');
    const counts = readCounts(r.sb.counts);
    expect(counts.terms.Land.usages).toBe(1);
    expect(readFileSync(pendingPath(r.sb.dir, 'sess-raw'), 'utf8')).toContain('Land\tприземлить');
  }, SLOW_SHELL_MS);

  it.skipIf(!JQ)('counts the term itself — a Latin term matches its own name', () => {
    const r = runInjectTracked('what does harvest mean here', { sessionId: 'sess-term' });
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('"harvest" = Harvest: ');
    expect(readCounts(r.sb.counts).terms.Harvest.usages).toBe(1);
  }, SLOW_SHELL_MS);

  it.skipIf(!JQ)('a synonym is NOT a usage — «слияние» means merge but matches nothing', () => {
    const r = runInjectTracked('объясни слияние ветки', { sessionId: 'sess-syn' });
    expect(r.status).toBe(0);
    expect(r.stdout).toBe('');
    // Both state files are (re)initialised on every armed run — the observable is CONTENT:
    // no Land row may appear in either.
    expect(readCounts(r.sb.counts).terms.Land).toBeUndefined();
    expect(readFileSync(pendingPath(r.sb.dir, 'sess-syn'), 'utf8')).toBe('');
  }, SLOW_SHELL_MS);

  it.skipIf(!JQ)('an inflected form is NOT a usage — «приземлироваться» ≠ «приземли»', () => {
    // The word-boundary falsifier: the boundary class must reject the longer word, or the
    // derived form would silently teach the term the operator did not use.
    const r = runInjectTracked('надо приземлироваться аккуратно', { sessionId: 'sess-infl' });
    expect(r.status).toBe(0);
    expect(r.stdout).toBe('');
    expect(readCounts(r.sb.counts).terms.Land).toBeUndefined();
    expect(readFileSync(pendingPath(r.sb.dir, 'sess-infl'), 'utf8')).toBe('');
  }, SLOW_SHELL_MS);

  it.skipIf(!JQ)('counts ONE usage per term per prompt even when the word appears twice', () => {
    const r = runInjectTracked('приземлить это приземлить', { sessionId: 'sess-twice' });
    expect(r.status).toBe(0);
    expect(r.stdout.match(/"приземлить" = Land:/g)?.length).toBe(1);
    expect(readCounts(r.sb.counts).terms.Land.usages).toBe(1);
  }, SLOW_SHELL_MS);

  it.skipIf(!JQ)('matches the word inside a sentence (boundary classes, not substring)', () => {
    const r = runInjectTracked('давай приземлим? нет — приземлить!', { sessionId: 'sess-bounds' });
    // «приземлим» (different word, prefix) must not hit; «приземлить» bounded by « ! must.
    expect(r.stdout).toContain('"приземлить" = Land: ');
    expect(readCounts(r.sb.counts).terms.Land.usages).toBe(1);
  }, SLOW_SHELL_MS);
});

describe('glossary thresholds — pack default, env override wins (fork ruling 3)', () => {
  it.skipIf(!JQ)('pack default 3: at usages=2 the term still fires and counts the third', () => {
    const r = runInjectTracked('объясни термин приземлить', {
      sessionId: 'sess-default',
      env: { AIF_GLOSSARY_USES: '', AIF_GLOSSARY_EXPLAINS: '' },
    });
    // Fresh sandbox: run 1 → usages 1. Two more runs to cross 3.
    const r2 = runInject('объясни термин приземлить', {
      sessionId: 'sess-default',
      env: { AIF_RESIDUE_DIR: r.sb.dir, TMPDIR: r.sb.dir } as Record<string, string>,
    });
    void r2;
    const r3 = runInject('объясни термин приземлить', {
      sessionId: 'sess-default',
      env: { AIF_RESIDUE_DIR: r.sb.dir, TMPDIR: r.sb.dir } as Record<string, string>,
    });
    expect(r3.stdout).toContain('"приземлить" = Land: ');
    expect(readCounts(r.sb.counts).terms.Land.usages).toBe(3);
  }, SLOW_SHELL_MS);

  it.skipIf(!JQ)('env AIF_GLOSSARY_USES=1 beats the pack: at usages=1 the term is learned', () => {
    // Negative control in the same case: the pack default (3) would NOT silence at 1, so
    // silence here is attributable to the env override, not the pack.
    const r = runInjectTracked('объясни термин приземлить', { sessionId: 'sess-env1' });
    expect(r.stdout).toContain('"приземлить" = Land: '); // first use fires under any threshold
    const learned = runInject('объясни термин приземлить', {
      sessionId: 'sess-env1',
      env: { AIF_GLOSSARY_USES: '1', AIF_RESIDUE_DIR: r.sb.dir, TMPDIR: r.sb.dir } as Record<string, string>,
    });
    expect(learned.stdout).toBe(''); // learned → no line
    expect(readCounts(r.sb.counts).terms.Land.usages).toBe(1); // and no increment
    // no re-arm: the pending file was truncated, so the Stop side has nothing to demand on
    expect(readFileSync(pendingPath(r.sb.dir, 'sess-env1'), 'utf8')).toBe('');
  }, SLOW_SHELL_MS);

  it.skipIf(!JQ)('env override cuts the OTHER way too: USES=5 keeps a 3-use term teaching', () => {
    // The capture-before-source/restore-after machinery must let the env RAISE the bar,
    // not only lower it — a pack-wins bug silences exactly here.
    const r = runInjectTracked('объясни термин приземлить', { sessionId: 'sess-env5' });
    const r2 = runInject('объясни термин приземлить', {
      sessionId: 'sess-env5',
      env: { AIF_RESIDUE_DIR: r.sb.dir, TMPDIR: r.sb.dir } as Record<string, string>,
    });
    const r3 = runInject('объясни термин приземлить', {
      sessionId: 'sess-env5',
      env: { AIF_GLOSSARY_USES: '5', AIF_RESIDUE_DIR: r.sb.dir, TMPDIR: r.sb.dir } as Record<string, string>,
    });
    expect(r3.stdout).toContain('"приземлить" = Land: '); // 3 uses < env 5 → still teaching
    expect(readCounts(r.sb.counts).terms.Land.usages).toBe(3);
  }, SLOW_SHELL_MS);

  it.skipIf(!JQ)('learned-OR: explanations ≥ pack default silences the inject side too', () => {
    const sb = sandbox();
    writeCounts(sb.counts, { Land: { explanations: 5 } }); // explanations alone crossed
    const after = runInject('объясни термин приземлить', {
      sessionId: 'sess-or',
      env: { AIF_RESIDUE_DIR: sb.dir, TMPDIR: sb.dir } as Record<string, string>,
    });
    expect(after.stdout).toBe('');
    expect(readCounts(sb.counts).terms.Land.usages).toBeUndefined(); // nothing counted
  }, SLOW_SHELL_MS);
});

describe('glossary Stop arm — explanation counting + the once-per-term demand', () => {
  it.skipIf(!JQ)('counts the fixed form once per message and demands nothing that turn', () => {
    const r = runStop({
      sessionId: 'sess-exp',
      answer: 'Приземлил. Land (merging the branch into staging) — готово.',
      pending: [['Land', 'приземлить']],
      counts: { Land: { usages: 2 } },
    });
    expect(r.status).toBe(0);
    expect(r.stdout).toBe(''); // explained this turn → no demand (and short answer → silent exit)
    const counts = readCounts(join(r.residue, '_glossary-counts.json'));
    expect(counts.terms.Land.explanations).toBe(1);
  }, SLOW_SHELL_MS);

  it.skipIf(!JQ)('the form twice in one message is still ONE explanation', () => {
    const r = runStop({
      sessionId: 'sess-once',
      answer: 'Land (merging the branch) and again Land (merging the branch).',
      pending: [['Land', 'приземлить']],
      counts: { Land: { usages: 2 } },
    });
    expect(readCounts(join(r.residue, '_glossary-counts.json')).terms.Land.explanations).toBe(1);
  }, SLOW_SHELL_MS);

  it.skipIf(!JQ)('below threshold without the form → ONE block demanding the inline form', () => {
    const r = runStop({
      sessionId: 'sess-demand',
      answer: 'Сделал, ветка готова.', // no `Land (` form anywhere
      pending: [['Land', 'приземлить']],
      counts: { Land: { usages: 1 } },
    });
    expect(r.status).toBe(0);
    const payload = JSON.parse(r.stdout);
    expect(payload.decision).toBe('block');
    expect(payload.reason).toContain('[glossary]');
    expect(payload.reason).toContain('Land');
    expect(payload.reason).toContain('приземлить');
  }, SLOW_SHELL_MS);

  it.skipIf(!JQ)('the demand is one-shot per term: the next unexplained stop stays silent', () => {
    // One shared TMPDIR across the two runs — the flag file is the loop bound. The pending
    // is re-armed between runs (the operator re-uses the word — the measured pattern).
    const shared = mkdtempSync(join(tmpdir(), 'glossary-shared-'));
    tmpDirs.push(shared);
    const residue = mkdtempSync(join(tmpdir(), 'glossary-shared-res-'));
    tmpDirs.push(residue);
    const first = runStop({
      sessionId: 'sess-flag',
      answer: 'Сделал.',
      pending: [['Land', 'приземлить']],
      counts: { Land: { usages: 1 } },
      tmpDir: shared,
      residueDir: residue,
    });
    expect(JSON.parse(first.stdout).reason).toContain('[glossary]');
    const second = runStop({
      sessionId: 'sess-flag',
      answer: 'Сделал снова.',
      pending: [['Land', 'приземлить']],
      counts: { Land: { usages: 1 } },
      tmpDir: shared,
      residueDir: residue,
    });
    expect(second.stdout).not.toContain('[glossary]'); // flag exists → no second demand
  }, SLOW_SHELL_MS);

  it.skipIf(!JQ)('learned between prompt and Stop → nothing fires and the pending is dropped', () => {
    const r = runStop({
      sessionId: 'sess-learned',
      answer: 'Сделал.',
      pending: [['Land', 'приземлить']],
      counts: { Land: { usages: 3 } }, // crossed the pack default while the agent worked
    });
    expect(r.status).toBe(0);
    expect(r.stdout).toBe('');
    const counts = readCounts(join(r.residue, '_glossary-counts.json'));
    expect(counts.terms.Land.explanations).toBeUndefined();
    expect(existsSync(pendingPath(r.sb, 'sess-learned'))).toBe(false); // consumed
  }, SLOW_SHELL_MS);
});

describe('same-path falsifier + inertness', () => {
  it.skipIf(!JQ)('BOTH hooks resolve the SAME counters path — the kickoff item-4 falsifier', () => {
    // The inject side counts a real use into the residue sandbox; the Stop side, pointed at
    // the SAME AIF_RESIDUE_DIR with AIF_GLOSSARY_USES=1, must SEE that use and treat the
    // term as learned (silent). On a path split the Stop side reads an empty counters file,
    // would not know the term, and would demand — tripping this test.
    const r = runInjectTracked('объясни термин приземлить', { sessionId: 'sess-path' });
    expect(r.stdout).toContain('"приземлить" = Land: ');
    const stop = runStop({
      sessionId: 'sess-path-stop',
      answer: 'Сделал.',
      pending: [['Land', 'приземлить']],
      counts: { Land: { usages: 1 } },
      env: { AIF_GLOSSARY_USES: '1' },
      tmpDir: r.sb.dir, // same TMPDIR the inject side used → same pending path namespace
      residueDir: r.sb.dir, // same residue dir → same counters file
    });
    expect(stop.stdout).not.toContain('[glossary]');
  }, SLOW_SHELL_MS);

  it.skipIf(!JQ)('absent CONTEXT.md → inject side fully inert (unarmed tree)', () => {
    const bare = mkdtempSync(join(tmpdir(), 'glossary-bare-'));
    tmpDirs.push(bare);
    const r = runInjectTracked('объясни термин приземлить', {
      sessionId: 'sess-bare',
      projectDir: bare, // no CONTEXT.md in this tree
    });
    expect(r.status).toBe(0);
    expect(r.stdout).toBe('');
    expect(existsSync(r.sb.counts)).toBe(false);
  }, SLOW_SHELL_MS);

  it.skipIf(!JQ)('absent CONTEXT.md → Stop arm inert even with a pending file (goldens stable)', () => {
    // The unarmed-golden contract: on a tree without CONTEXT.md the Stop hook behaves
    // byte-identically to before D-F — no demand may fire even when residue state exists.
    const bare = mkdtempSync(join(tmpdir(), 'glossary-bare-stop-'));
    tmpDirs.push(bare);
    const residue = mkdtempSync(join(tmpdir(), 'glossary-bare-res-'));
    tmpDirs.push(residue);
    writeCounts(join(residue, '_glossary-counts.json'), { Land: { usages: 1 } });
    const transcript = writeTranscript(bare, 'Сделал.');
    const r = spawnSync('bash', [STOP_HOOK], {
      input: JSON.stringify({
        session_id: 'sess-bare-stop',
        transcript_path: transcript,
        stop_hook_active: false,
      }),
      encoding: 'utf8',
      env: {
        ...process.env,
        AIF_HOOK_LANG: 'ru',
        CLAUDE_CODE_ENTRYPOINT: 'cli',
        CLAUDE_PROJECT_DIR: bare, // no CONTEXT.md here
        AIF_RESIDUE_DIR: residue,
        TMPDIR: bare,
      },
    });
    expect(r.status).toBe(0);
    expect(r.stdout ?? '').not.toContain('[glossary]');
  }, SLOW_SHELL_MS);
});

describe('lang-pack parity for the AIF_GLOSSARY_ key class', () => {
  it('both packs define the two thresholds + the demand message', () => {
    for (const pack of [EN_PACK, RU_PACK]) {
      const body = readFileSync(pack, 'utf8');
      expect(body).toMatch(/^AIF_GLOSSARY_USES=3$/m);
      expect(body).toMatch(/^AIF_GLOSSARY_EXPLAINS=5$/m);
      expect(body).toMatch(/^aif_msg_glossary_demand\(\)/m);
    }
  });

  it.skipIf(!JQ)('check-parity.sh passes on the live packs (OK summary)', () => {
    const r = spawnSync('bash', [PARITY], { encoding: 'utf8' });
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/^OK: en\.sh and ru\.sh expose identical keys/m);
  }, SLOW_SHELL_MS);

  it.skipIf(!JQ)('PAIRED-NEGATIVE: an AIF_GLOSSARY_ key in ONE pack only → DRIFT naming it', () => {
    // The kickoff item-5 falsifier, mechanically: the probe (^AIF_GLOSSARY_[A-Z_]+=) is a
    // DIFFERENT grep line in keys() than the AIF_EOT_/marker probes lang-parity.test.ts's
    // seeded negative covers — so a key that only that line collects must still be caught.
    const box = mkdtempSync(join(tmpdir(), 'glossary-parity-'));
    tmpDirs.push(box);
    for (const f of ['en.sh', 'ru.sh', 'check-parity.sh']) {
      copyFileSync(resolve(REPO_ROOT, '.claude/hooks/lang', f), join(box, f));
    }
    const en = readFileSync(join(box, 'en.sh'), 'utf8');
    writeFileSync(join(box, 'en.sh'), `AIF_GLOSSARY_EXTRA=1\n${en}`, 'utf8');
    const r = spawnSync('bash', [join(box, 'check-parity.sh')], { encoding: 'utf8' });
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/DRIFT: en\.sh and ru\.sh key sets differ/);
    expect(r.stderr).toContain('AIF_GLOSSARY_EXTRA');
  }, SLOW_SHELL_MS);
});

describe('pack-lag (consumer delivery lag) — the pre-feature pack must not abort either hook', () => {
  // The guards this family keeps executable: the Stop side's `command -v
  // aif_msg_glossary_demand` before the call and its `${AIF_GLOSSARY_USES:-3}` /
  // `${AIF_GLOSSARY_EXPLAINS:-5}` set -u defaults (end-of-turn-reminder.sh glossary arm),
  // and the inject side's `|| true` guarded pack source. The abort class is measured, not
  // hypothetical: an undefined function in a cmdsubst aborted the WHOLE Stop hook under
  // set -e with rc 127 (cold-review m1, 2026-09-14). Both hooks run here from a sandbox
  // copy whose lang/ is the CURRENT pack minus the feature (no aif_msg_glossary_demand,
  // no AIF_GLOSSARY_* keys) — drop any guard and these cases RED instead of the hook
  // dying on every turn of a consumer tree whose delivered pack predates the feature.
  function packLagBox(): string {
    const box = mkdtempSync(join(tmpdir(), 'glossary-packlag-'));
    tmpDirs.push(box);
    mkdirSync(join(box, 'lang'));
    for (const f of ['en.sh', 'ru.sh']) {
      const body = readFileSync(resolve(REPO_ROOT, '.claude/hooks/lang', f), 'utf8')
        .replace(/^aif_msg_glossary_demand\(\) \{[\s\S]*?^\}\n/m, '')
        .replace(/^AIF_GLOSSARY_[A-Z_]+=.*$\n?/gm, '');
      writeFileSync(join(box, 'lang', f), body, 'utf8');
    }
    copyFileSync(STOP_HOOK, join(box, 'end-of-turn-reminder.sh'));
    copyFileSync(INJECT_HOOK, join(box, 'glossary-inject.sh'));
    return box;
  }

  function runStopFrom(script: string, opts: StopOpts): RunResult & { sb: string; residue: string } {
    const sb = opts.tmpDir ?? mkdtempSync(join(tmpdir(), 'glossary-stop-tmp-'));
    if (!opts.tmpDir) tmpDirs.push(sb);
    const residue = opts.residueDir ?? mkdtempSync(join(tmpdir(), 'glossary-stop-res-'));
    if (!opts.residueDir) tmpDirs.push(residue);
    const sessionId = opts.sessionId ?? 'sess-stop';
    if (opts.pending?.length) {
      writeFileSync(pendingPath(sb, sessionId), opts.pending.map(([t, w]) => `${t}\t${w}`).join('\n') + '\n', 'utf8');
    }
    if (opts.counts) writeCounts(join(residue, '_glossary-counts.json'), opts.counts);
    const transcript = writeTranscript(sb, opts.answer);
    const r = spawnSync('bash', [script], {
      input: JSON.stringify({
        session_id: sessionId,
        transcript_path: transcript,
        stop_hook_active: false,
      }),
      encoding: 'utf8',
      env: {
        ...process.env,
        AIF_HOOK_LANG: 'ru',
        CLAUDE_CODE_ENTRYPOINT: 'cli',
        CLAUDE_PROJECT_DIR: REPO_ROOT,
        AIF_RESIDUE_DIR: residue,
        TMPDIR: sb,
        ...opts.env,
      },
    });
    return { status: r.status ?? -1, stdout: r.stdout ?? '', stderr: r.stderr ?? '', sb, residue };
  }

  it.skipIf(!JQ)('PAIRED-NEGATIVE: no demand function + no AIF_GLOSSARY_* keys → exit 0, no demand, no one-shot flag', () => {
    const box = packLagBox();
    const r = runStopFrom(join(box, 'end-of-turn-reminder.sh'), {
      sessionId: 'sess-lag1',
      answer: 'Сделал, ветка готова.', // no `Land (` form, term below threshold
      pending: [['Land', 'приземлить']],
      counts: { Land: { usages: 1 } },
    });
    expect(r.status).toBe(0); // the measured failure this guards against is an rc-127 abort
    expect(r.stdout).not.toContain('[glossary]');
    // guard skips the demand BEFORE the flag write → the retry stays armed for a caught-up pack
    expect(existsSync(join(r.sb, 'aif-glossary-dem-sess-lag1-Land'))).toBe(false);
    const counts = readCounts(join(r.residue, '_glossary-counts.json'));
    expect(counts.terms.Land.explanations).toBeUndefined();
  }, SLOW_SHELL_MS);

  it.skipIf(!JQ)('PAIRED-NEGATIVE: the explanation still COUNTS against a pre-feature pack', () => {
    const box = packLagBox();
    const r = runStopFrom(join(box, 'end-of-turn-reminder.sh'), {
      sessionId: 'sess-lag2',
      answer: 'Land (merging the branch into staging) — готово.',
      pending: [['Land', 'приземлить']],
      counts: { Land: { usages: 0 } },
    });
    expect(r.status).toBe(0);
    const counts = readCounts(join(r.residue, '_glossary-counts.json'));
    expect(counts.terms.Land.explanations).toBe(1); // counting needs no keys the pack lacks
  }, SLOW_SHELL_MS);

  it.skipIf(!JQ)('PAIRED-NEGATIVE: the inject hook survives a pre-feature pack and still injects', () => {
    const box = packLagBox();
    const sb = sandbox();
    const r = spawnSync('bash', [join(box, 'glossary-inject.sh')], {
      input: JSON.stringify({ prompt: 'объясни термин приземлить', session_id: 'sess-lag3' }),
      encoding: 'utf8',
      env: {
        ...process.env,
        AIF_HOOK_LANG: 'en',
        CLAUDE_CODE_ENTRYPOINT: 'cli',
        CLAUDE_PROJECT_DIR: REPO_ROOT,
        AIF_RESIDUE_DIR: sb.dir,
        TMPDIR: sb.dir,
      },
    });
    expect(r.status ?? -1).toBe(0);
    expect(r.stdout ?? '').toContain('"приземлить" = Land: ');
    expect(readCounts(sb.counts).terms.Land.usages).toBe(1);
  }, SLOW_SHELL_MS);
});

afterAll(() => {
  for (const d of tmpDirs.splice(0)) rmSync(d, { recursive: true, force: true });
});
