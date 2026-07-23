/**
 * Functional meta-tests for the PostToolUse hook-marker gate
 * (.claude/hooks/check-hook-marker.sh) — Wave N8 C4, edit-time enforcement of
 * dual-implementation-discipline.md §6 (every .claude/hooks/*.sh declares a
 * delivery-channel marker: @dual-pair or @cc-only-rationale).
 *
 * Channel: edit-time PostToolUse — fires when a hook is written, which IS the
 * "at next touch" semantics §9 wants (legacy hooks never flagged unless edited).
 *
 * Paired-negative contract:
 *   ❌ a .claude/hooks/*.sh with NO marker → exit 2 (the silent-CC-lock-in gap)
 *   ✅ @cc-only-rationale present          → exit 0
 *   ✅ @dual-pair present                  → exit 0
 *   ✅ non-hook path / wrong tool          → exit 0 (off-path skip)
 *
 * Spawns a sandbox COPY of the hook with fixture stdin (the
 * check-kickoff-traps.test.ts precedent). Skips gracefully when `jq` is
 * unavailable.
 *
 * Sandbox isolation (leak incident 2026-07-02): the hook resolves its repo
 * root from its own location ($(dirname $0)/../..), so copying it into
 * <tmpdir>/.claude/hooks/ makes the tempdir its repo root — fixtures satisfy
 * the path matcher WITHOUT ever writing the real working tree. Previously
 * c4-test-* fixtures were written into the real .claude/hooks/ (a killed run
 * leaked them into the tree). hooks-tree-guard.ts is the suite-level tripwire
 * for any reintroduction of real-tree writes.
 *
 * Bash-mutation contract: under run-bash-mutation.sh the mutant is swapped
 * into a temp shadow copy, never the tracked hook; its path arrives via
 * BASHMUT_HOOK and the sandbox copies FROM it, so each nested vitest run
 * exercises the current mutant.
 */
import { describe, it, expect, afterAll } from 'vitest';
import { execSync, spawnSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../..');
const REAL_HOOK = resolve(REPO_ROOT, '.claude/hooks/check-hook-marker.sh');

// run-bash-mutation.sh exports BASHMUT_HOOK = the shadow copy it swaps mutants
// into. Honoring it is what lets the kill-rate gate exercise mutants without
// touching the tracked hook. Set-but-missing is a broken invocation — fail loud.
const SOURCE_HOOK = process.env.BASHMUT_HOOK ?? REAL_HOOK;
if (process.env.BASHMUT_HOOK && !existsSync(SOURCE_HOOK)) {
  throw new Error(`BASHMUT_HOOK points at a missing file: ${SOURCE_HOOK}`);
}

// Per-run sandbox mirroring <root>/.claude/hooks/. realpathSync so the hook's
// own `cd … && pwd` (physical on symlinked macOS /var → /private/var) and the
// fixture paths we pass agree on one textual prefix.
const SANDBOX = realpathSync(mkdtempSync(join(tmpdir(), 'c4-marker-')));
const SANDBOX_HOOKS = join(SANDBOX, '.claude', 'hooks');
mkdirSync(SANDBOX_HOOKS, { recursive: true });
const HOOK = join(SANDBOX_HOOKS, 'check-hook-marker.sh');
copyFileSync(SOURCE_HOOK, HOOK);

afterAll(() => {
  rmSync(SANDBOX, { recursive: true, force: true });
});

function hasJq(): boolean {
  try {
    execSync('command -v jq', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}
const JQ = hasJq();

/**
 * Write `body` to the sandbox `.claude/hooks/<name>` so the hook's path matcher
 * fires against an on-disk file (PostToolUse reads post-edit content). Returns
 * the absolute path; the whole sandbox is removed in afterAll. Uses a unique
 * name to avoid clobber.
 */
function writeHook(body: string, ext = '.sh'): string {
  const name = `c4-test-${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
  const abs = join(SANDBOX_HOOKS, name);
  writeFileSync(abs, body, 'utf8');
  return abs;
}

function runHook(
  tool: string,
  absPath: string,
  env: Record<string, string> = {},
): { status: number; stdout: string; stderr: string } {
  // Default-scrub ZCODE_PROJECT_DIR: the runner may execute inside zcode (the framework's own
  // dev harness), which would flip _adv_violation to the JSON branch and break the exit-code
  // assertions below. The ZCode-JSON case passes ZCODE_PROJECT_DIR explicitly. Mirrors
  // deps-hash-check.test.ts:106.
  const fullEnv = { ...process.env };
  if (env.ZCODE_PROJECT_DIR === undefined) delete fullEnv.ZCODE_PROJECT_DIR;
  else fullEnv.ZCODE_PROJECT_DIR = env.ZCODE_PROJECT_DIR;
  const r = spawnSync('bash', [HOOK], {
    input: JSON.stringify({
      tool_name: tool,
      tool_input: { file_path: absPath },
    }),
    encoding: 'utf8',
    env: fullEnv,
  });
  return {
    status: r.status ?? -1,
    stdout: r.stdout ?? '',
    stderr: r.stderr ?? '',
  };
}

describe.skipIf(!JQ)(
  'check-hook-marker.sh — PostToolUse delivery-channel marker gate',
  () => {
    it('PAIRED-NEGATIVE: hook with no marker → exit 2', () => {
      const abs = writeHook(
        '#!/usr/bin/env bash\n# just a comment, no marker\nexit 0\n',
      );
      expect(runHook('Write', abs).status).toBe(2);
    });

    it('PAIRED-POSITIVE: @cc-only-rationale present → exit 0', () => {
      const abs = writeHook(
        '#!/usr/bin/env bash\n# @cc-only-rationale: edit-time gate, no portable equivalent\nexit 0\n',
      );
      expect(runHook('Write', abs).status).toBe(0);
    });

    it('PAIRED-POSITIVE: @dual-pair present → exit 0', () => {
      const abs = writeHook(
        '#!/usr/bin/env bash\n# @dual-pair: some-anchor-slug\nexit 0\n',
      );
      expect(runHook('Edit', abs).status).toBe(0);
    });

    it('marker must be on its own comment line: prose mention in a heredoc does NOT count → exit 2', () => {
      // The string "@cc-only-rationale:" appears, but not as a leading "# " comment line.
      const abs = writeHook(
        '#!/usr/bin/env bash\necho "add a @cc-only-rationale: marker"\nexit 0\n',
      );
      expect(runHook('Write', abs).status).toBe(2);
    });

    it('wrong tool (Read) → exit 0 even on a marker-less hook', () => {
      const abs = writeHook('#!/usr/bin/env bash\n# no marker\nexit 0\n');
      expect(runHook('Read', abs).status).toBe(0);
    });

    it('off-path: a .sh outside .claude/hooks/ → exit 0', () => {
      const dir = join(SANDBOX, 'offpath');
      mkdirSync(dir, { recursive: true });
      const abs = join(dir, 'random.sh');
      writeFileSync(abs, '#!/usr/bin/env bash\n# no marker\n', 'utf8');
      expect(runHook('Write', abs).status).toBe(0);
    });

    it('off-path: a non-.sh file under .claude/hooks/ → exit 0', () => {
      const abs = writeHook('# no marker, but markdown\n', '.md');
      expect(runHook('Write', abs).status).toBe(0);
    });

    it('ZCODE: marker-less hook under ZCODE_PROJECT_DIR → schema-valid {additionalContext} JSON, exit 0 (advisory, not gate)', () => {
      // ZCode parses hook stdout against the HookJSONOutput schema (CCt at zcode.cjs:~577900),
      // which is `.strict()` — unknown top-level keys are REJECTED (→ hook.run.failed, output
      // discarded). The ZCode branch (_adv_violation at hook line 31) emits schema-valid
      // `{additionalContext}` and exits 0 — PostToolUse cannot block on ZCode (schema Uan rejects
      // permissionDecision for PostToolUse; post-mutation by definition), so the violation
      // surfaces as advisory context, not a hard gate. This test guards BOTH the JSON branch AND
      // schema compliance — catches the exact regression where a prior shape emitted
      // `{hookEventName, additionalContext}` at top level and was silently rejected by ZCode.
      const abs = writeHook('#!/usr/bin/env bash\n# no marker\nexit 0\n');
      const r = runHook('Write', abs, { ZCODE_PROJECT_DIR: SANDBOX });
      // On ZCode: exit 0 (advisory), output = JSON additionalContext.
      expect(r.status, 'ZCode path exits 0 (advisory, non-blocking)').toBe(0);
      expect(r.stdout.trim(), 'ZCode path emits non-empty JSON').not.toBe('');
      const allowedTopLevel = new Set([
        'additionalContext',
        'additional_context',
        'continue',
        'decision',
        'hookSpecificOutput',
        'reason',
        'stopReason',
        'suppressOutput',
        'systemMessage',
      ]);
      const parsed = JSON.parse(r.stdout);
      const unknownKeys = Object.keys(parsed).filter(
        (k) => !allowedTopLevel.has(k),
      );
      expect(
        unknownKeys,
        `ZCode CCt.strict() rejects unknown top-level keys: ${unknownKeys.join(', ')}`,
      ).toEqual([]);
      expect(
        parsed.additionalContext,
        'violation text rides inside additionalContext',
      ).toContain('hook-marker');
      expect(
        parsed.hookEventName,
        'hookEventName must NOT be at top level (CCt.strict rejects it)',
      ).toBeUndefined();
    });

    // ── @file-content-gate invariant (matcher-widening, GH #934 follow-up) ──────
    // A hook that validates file content (path-only, no internal tool_name filter) MUST be
    // registered with matcher Edit|Write|MultiEdit — else a MultiEdit bypasses it silently.
    // The gate reads $REPO_ROOT/.claude/settings.json; in the sandbox REPO_ROOT = SANDBOX,
    // so we stage a sandbox settings.json to drive the matcher lookup.

    function writeSandboxSettings(matcher: string, hookName: string): void {
      const settingsDir = join(SANDBOX, '.claude');
      mkdirSync(settingsDir, { recursive: true });
      const settings = {
        hooks: {
          PostToolUse: [
            {
              matcher,
              hooks: [
                {
                  type: 'command',
                  command: `bash "$CLAUDE_PROJECT_DIR/.claude/hooks/${hookName}"`,
                },
              ],
            },
          ],
        },
      };
      writeFileSync(
        join(settingsDir, 'settings.json'),
        JSON.stringify(settings),
        'utf8',
      );
    }

    it('PAIRED-NEGATIVE: @file-content-gate hook registered Edit|Write (no MultiEdit) → exit 2', () => {
      const name = `zzz-fcg-neg-${Date.now()}.sh`;
      const abs = writeHook(
        `#!/usr/bin/env bash\n# @cc-only-rationale: fixture\n# @file-content-gate: test\nexit 0\n`,
      );
      // Rename the sandbox hook to match the name the settings.json will reference.
      const renamed = join(SANDBOX_HOOKS, name);
      renameSync(abs, renamed);
      writeSandboxSettings('Edit|Write', name);
      expect(runHook('Edit', renamed).status).toBe(2);
    });

    it('PAIRED-POSITIVE: @file-content-gate hook registered Edit|Write|MultiEdit → exit 0', () => {
      const name = `zzz-fcg-pos-${Date.now()}.sh`;
      const abs = writeHook(
        `#!/usr/bin/env bash\n# @cc-only-rationale: fixture\n# @file-content-gate: test\nexit 0\n`,
      );
      const renamed = join(SANDBOX_HOOKS, name);
      renameSync(abs, renamed);
      writeSandboxSettings('Edit|Write|MultiEdit', name);
      expect(runHook('Edit', renamed).status).toBe(0);
    });

    it('shipped-only @file-content-gate hook (absent from settings.json) → exit 0 (tolerated)', () => {
      // A hook shipped solely via setup.d/install.sh (not in framework-self settings.json)
      // e.g. check-doc-authority-header: the gate has no framework-side matcher to check → skip.
      const abs = writeHook(
        `#!/usr/bin/env bash\n# @cc-only-rationale: fixture\n# @file-content-gate: test\nexit 0\n`,
      );
      // No writeSandboxSettings — settings.json absent or has no entry for this hook.
      // (Sandbox settings.json from a prior test may exist; ensure this hook is NOT in it.)
      const settingsPath = join(SANDBOX, '.claude', 'settings.json');
      if (existsSync(settingsPath)) {
        writeFileSync(
          settingsPath,
          JSON.stringify({ hooks: { PostToolUse: [] } }),
          'utf8',
        );
      }
      expect(runHook('Edit', abs).status).toBe(0);
    });

    // ── @matcher-parity invariant (case-TOOL hooks, matcher-widening GH #934 follow-up) ──
    // A hook with an internal `case "$TOOL" in <tools>)` filter self-declares the tools it
    // handles; its registration matcher MUST be a superset. Covers the case-TOOL gates that
    // carry NO @file-content-gate marker (check-kickoff-traps, check-worker-dispatch-channel,
    // check-hook-marker itself). Self-calibrating: a Write-only case-arm stays green.

    it('PARITY-NEGATIVE: case-arm Edit|Write|MultiEdit but matcher Edit|Write → exit 2', () => {
      const name = `zzz-parity-neg-${Date.now()}.sh`;
      const abs = writeHook(
        `#!/usr/bin/env bash\n# @cc-only-rationale: fixture\ncase "$TOOL" in Edit | Write | MultiEdit) ;; *) exit 0 ;; esac\nexit 0\n`,
      );
      const renamed = join(SANDBOX_HOOKS, name);
      renameSync(abs, renamed);
      writeSandboxSettings('Edit|Write', name);
      expect(runHook('Edit', renamed).status).toBe(2);
    });

    it('PARITY-POSITIVE: case-arm Edit|Write|MultiEdit + matcher Edit|Write|MultiEdit → exit 0', () => {
      const name = `zzz-parity-pos-${Date.now()}.sh`;
      const abs = writeHook(
        `#!/usr/bin/env bash\n# @cc-only-rationale: fixture\ncase "$TOOL" in Edit | Write | MultiEdit) ;; *) exit 0 ;; esac\nexit 0\n`,
      );
      const renamed = join(SANDBOX_HOOKS, name);
      renameSync(abs, renamed);
      writeSandboxSettings('Edit|Write|MultiEdit', name);
      expect(runHook('Edit', renamed).status).toBe(0);
    });

    it('PARITY-WRITE-ONLY (A5 self-calibration): case-arm Write + matcher Write → exit 0', () => {
      // inject-memory-codification precedent: a deliberately Write-only hook stays GREEN — the
      // parity rule requires matcher ⊇ case-arm, NOT a hardcoded MultiEdit demand.
      const name = `zzz-parity-wo-${Date.now()}.sh`;
      const abs = writeHook(
        `#!/usr/bin/env bash\n# @cc-only-rationale: fixture\ncase "$TOOL" in Write) ;; *) exit 0 ;; esac\nexit 0\n`,
      );
      const renamed = join(SANDBOX_HOOKS, name);
      renameSync(abs, renamed);
      writeSandboxSettings('Write', name);
      expect(runHook('Write', renamed).status).toBe(0);
    });

    it('PARITY comment-immunity: a `case "$TOOL" in …` in PROSE above the real arm is not mis-extracted', () => {
      // A doc comment mentioning `case "$TOOL" in Read)` sits ABOVE the real code arm
      // `case "$TOOL" in Write)`. The extraction strips comment lines first, so parity reads
      // the REAL arm {Write}; matcher Write ⊇ {Write} → exit 0. If comments were NOT stripped,
      // head -1 would grab the prose {Read}, demand matcher ⊇ {Read}, and wrongly exit 1.
      const name = `zzz-parity-comment-${Date.now()}.sh`;
      const abs = writeHook(
        `#!/usr/bin/env bash\n# @cc-only-rationale: fixture\n# doc: this hook once used \`case "$TOOL" in Read)\` — kept as prose\ncase "$TOOL" in Write) ;; *) exit 0 ;; esac\nexit 0\n`,
      );
      const renamed = join(SANDBOX_HOOKS, name);
      renameSync(abs, renamed);
      writeSandboxSettings('Write', name);
      expect(runHook('Write', renamed).status).toBe(0);
    });
  },
);

// ── Layer 2: CI-time population backstop (matcher-widening preventer) ──────────
// Runs the edit-time gate against EVERY tracked hook at once, against the LIVE settings.json.
// This is the vector Layer 1 (edit-time) cannot see: a matcher narrowed directly in
// .ai-factory/harness-model.json / .claude/settings.json while NO hook .sh is edited — the gate
// only fires on a `.sh` edit, so a settings-only narrowing would slip past it until the next
// unrelated hook edit. This backstop re-checks the whole population on every CI run.
//
// Bucket rationale (why here, not tests/agnosticism/channel-coverage.sh): the requirement
// "matcher ⊇ {Edit,Write,MultiEdit}" is CC-SPECIFIC — MultiEdit is inert on other harnesses
// (render-harness-config.mjs notes it). Putting a CC-tool assertion in the harness-agnostic
// channel-coverage probe would (a) overload its PORTABLE verdict (= "works across harnesses")
// with a CC-config-consistency meaning, and (b) make a deliberately harness-independent probe
// assert a CC-only fact. So it lives in the hooks (CC-config) bucket, reusing the edit-time gate
// verbatim — no parallel population reader, no drift risk.
describe.skipIf(!JQ)(
  'check-hook-marker.sh — Layer 2 population backstop (matcher ⊇ @file-content-gate/case-arm)',
  () => {
    const realHooksDir = resolve(REPO_ROOT, '.claude/hooks');

    function runRealHook(root: string, tool: string, absPath: string): number {
      const fullEnv: NodeJS.ProcessEnv = { ...process.env, CLAUDE_PROJECT_DIR: root };
      delete fullEnv.ZCODE_PROJECT_DIR;
      const r = spawnSync('bash', [REAL_HOOK], {
        input: JSON.stringify({
          tool_name: tool,
          tool_input: { file_path: absPath },
        }),
        encoding: 'utf8',
        env: fullEnv,
      });
      return r.status ?? -1;
    }

    // Stage a throwaway CLAUDE_PROJECT_DIR with one hook + a settings.json registering it at
    // `matcher`, run the REAL gate against it, return the exit code. Root is removed by caller.
    function runInFixtureRoot(hookBody: string, matcher: string): number {
      const root = realpathSync(mkdtempSync(join(tmpdir(), 'c4-backstop-')));
      const hooksDir = join(root, '.claude', 'hooks');
      mkdirSync(hooksDir, { recursive: true });
      const hookName = 'zzz-backstop.sh';
      writeFileSync(join(hooksDir, hookName), hookBody, 'utf8');
      writeFileSync(
        join(root, '.claude', 'settings.json'),
        JSON.stringify({
          hooks: {
            PostToolUse: [
              {
                matcher,
                hooks: [
                  {
                    type: 'command',
                    command: `bash "$CLAUDE_PROJECT_DIR/.claude/hooks/${hookName}"`,
                  },
                ],
              },
            ],
          },
        }),
        'utf8',
      );
      const status = runRealHook(root, 'Edit', join(hooksDir, hookName));
      rmSync(root, { recursive: true, force: true });
      return status;
    }

    it('every tracked .claude/hooks/*.sh passes the gate against the LIVE settings.json (all matchers ⊇ requirement)', () => {
      const hooks = readdirSync(realHooksDir).filter((f) => f.endsWith('.sh'));
      // Population sentinel (T10): a broken glob returning [] would vacuously pass.
      expect(
        hooks.length,
        'population sentinel: expected ≥5 tracked hooks',
      ).toBeGreaterThanOrEqual(5);
      const flagged: string[] = [];
      for (const h of hooks) {
        if (runRealHook(REPO_ROOT, 'Edit', resolve(realHooksDir, h)) !== 0) {
          flagged.push(h);
        }
      }
      expect(
        flagged,
        `hooks whose live matcher ⊉ their @file-content-gate/case-arm requirement: ${flagged.join(', ')}`,
      ).toEqual([]);
    });

    it('RED fixture: @file-content-gate hook registered with a narrow matcher IS caught (non-vacuous)', () => {
      const status = runInFixtureRoot(
        `#!/usr/bin/env bash\n# @cc-only-rationale: fixture\n# @file-content-gate: test\nexit 0\n`,
        'Edit|Write',
      );
      expect(status).toBe(2);
    });

    it('RED fixture: case-TOOL hook whose case-arm ⊋ matcher IS caught by the parity rule', () => {
      const status = runInFixtureRoot(
        `#!/usr/bin/env bash\n# @cc-only-rationale: fixture\ncase "$TOOL" in Edit | Write | MultiEdit) ;; *) exit 0 ;; esac\nexit 0\n`,
        'Edit|Write',
      );
      expect(status).toBe(2);
    });
  },
);

// ═══════════════════════════════════════════════════════════════════════════════
// Dependency-missing SKIP must reach the model, not just stderr (aif-parity F1,
// criterion (a) — silent `command -v jq || exit 0` guards; sibling of the
// check-doc-authority.sh fix shipped in #1116). Channel semantics live-verified
// 2026-07-24: research-patches/2026-07-24-posttooluse-channel-verification.md.
// ═══════════════════════════════════════════════════════════════════════════════
import { mkdtempSync as _mkdtempSync, symlinkSync as _symlinkSync } from 'node:fs';
import { join as _join } from 'node:path';
import { tmpdir as _tmpdir } from 'node:os';
import { spawnSync as _spawnSync } from 'node:child_process';

describe('dependency-missing skip is announced on the model channel', () => {
  function runNoJq(filePath: string): { status: number; stdout: string; stderr: string } {
    const binDir = _mkdtempSync(_join(_tmpdir(), 'nojq-'));
    // sed/tr/head back the jq-free escaper + crude path parse; masking them too would
    // test the harness, not the hook. dirname backs the REPO_ROOT fallback line.
    for (const tool of ['sed', 'tr', 'cat', 'head', 'dirname', 'grep', 'sort', 'awk', 'stat', 'date', 'touch']) {
      const real = _spawnSync('/usr/bin/which', [tool], { encoding: 'utf8' }).stdout?.trim();
      if (real) _symlinkSync(real, _join(binDir, tool));
    }
    const env: Record<string, string> = { ...process.env, PATH: binDir } as Record<string, string>;
    delete env.ZCODE_PROJECT_DIR;
    const r = _spawnSync('/bin/bash', [REAL_HOOK], {
      input: JSON.stringify({ tool_name: 'Write', tool_input: { file_path: filePath } }),
      encoding: 'utf8',
      env,
    });
    return { status: r.status ?? -1, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
  }

  it('jq missing + in-scope path → hookSpecificOutput.additionalContext says DID NOT RUN (exit 0)', () => {
    const { status, stdout } = runNoJq('/x/.claude/hooks/foo.sh');
    expect(status).toBe(0);
    const parsed = JSON.parse(stdout.trim()) as {
      hookSpecificOutput: { hookEventName: string; additionalContext: string };
    };
    expect(parsed.hookSpecificOutput.hookEventName).toBe('PostToolUse');
    expect(parsed.hookSpecificOutput.additionalContext).toMatch(/DID NOT RUN/);
    expect(parsed.hookSpecificOutput.additionalContext).toMatch(/not a pass/i);
  });

  it('jq missing + OUT-of-scope path → silent exit 0 (no per-edit spam in a jq-less env)', () => {
    const { status, stdout } = runNoJq('/x/README.md');
    expect(status).toBe(0);
    expect(stdout.trim()).toBe('');
  });
});
