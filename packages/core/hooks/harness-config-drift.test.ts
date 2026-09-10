/**
 * Drift gate for the per-harness config renderer (scripts/render-harness-config.mjs, #894).
 *
 * Channel: test:hooks (`vitest run hooks/`), already armed in CI at
 * audit-self.yml:232 — no workflow edit needed. This is the "attention is not a
 * mechanism" (attention-is-not-a-mechanism.md §1) gate for the zcode shim: a
 * hand-edit to a rendered harness config, or a hook added to settings.json
 * bypassing the SSOT, fails HERE rather than rotting until someone notices.
 *
 * Two enforcement surfaces:
 *   • REAL-TREE (claude branch, ALWAYS in CI): settings.json.hooks + .mcp.json are
 *     tracked → `--check` against the repo root verifies they match the SSOT model
 *     every run. zcode.json is gitignored (maintainer-env shim) → absent in CI →
 *     its branch SKIPS loudly (N4), never a false-green/false-red.
 *   • SANDBOX (N1–N5, P1–P3): every mutation runs in an os.tmpdir() copy, never the
 *     real tree — so this suite leaves `.claude/hooks/` untouched (hooks-tree-guard.ts
 *     tripwire stays green; the check-hook-marker.test.ts sandbox precedent).
 *
 * Paired-negative contract (issue #894 §4):
 *   N1 hand-edit zcode.json            → --check exit 1 (names zcode.json)
 *   N2 broken .zcode/skills symlink    → --check exit 1
 *   N3 hook added to settings.json     → --check exit 1 (error leads to the model)
 *   N4 zcode.json absent               → zcode branch loud-skip, claude branch STILL gated
 *   N5 vendor key in the model         → union-IR guard rejects (exit 1)
 *   P1 --write twice                   → byte-identical (idempotent)
 *   P2 fresh --write → --check         → exit 0
 *   P3 foreign settings.json keys      → byte-identical after --write (merge owns only `hooks`)
 *
 * Robustness (cold-QA #894, SHIP-WITH-FIXES):
 *   D1 invoke via a SYMLINKED script path → run() still executes (no silent no-op /
 *      false-green — the entry guard canonicalizes both sides through realpathSync)
 *   D2 --write with settings.json absent  → readable error + exit 1 (not a raw ENOENT stack)
 */
import { describe, it, expect, afterAll } from 'vitest';
import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
  readlinkSync,
  unlinkSync,
  rmSync,
  symlinkSync,
  existsSync,
} from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../..');
const GEN = resolve(REPO_ROOT, 'scripts/render-harness-config.mjs');
/** Script basename from a model command `bash "$…/.claude/hooks/<name>.sh"` (mirrors emitPlugin). */
const MODEL_HOOK_NAME_RE = /\/(?:\.claude\/hooks|scripts)\/([A-Za-z0-9_-]+)\.sh/;
/** Dispatch name from a plugin command `"${CLAUDE_PLUGIN_ROOT}/hooks/run-hook.cmd" <name>`. */
const PLUGIN_HOOK_NAME_RE = /run-hook\.cmd"\s+([A-Za-z0-9_-]+)/;
/** Maintainer-env-only model hooks that emitPlugin drops (PLUGIN_INCOMPATIBLE) — mirrored here as
 *  the documented exception to the model→plugin coverage rule; grow if that renderer list grows. */
const PLUGIN_INCOMPATIBLE_NAMES = new Set(['link-coordination', 'inject-handoff-on-compact']);

/** Run the generator against `root`; return exit code + combined stdout/stderr. */
function gen(root: string, ...args: string[]): { status: number; out: string } {
  const r = spawnSync('node', [GEN, ...args, '--root', root], {
    encoding: 'utf8',
  });
  return { status: r.status ?? -1, out: `${r.stdout ?? ''}${r.stderr ?? ''}` };
}

const sandboxes: string[] = [];
/** A fresh tmpdir carrying the real model + settings.json + plugin/hooks/hooks.json (never the real tree). */
function sandbox(): string {
  const dir = mkdtempSync(join(tmpdir(), 'harness-drift-'));
  sandboxes.push(dir);
  mkdirSync(join(dir, '.ai-factory'), { recursive: true });
  mkdirSync(join(dir, '.claude/skills'), { recursive: true });
  mkdirSync(join(dir, 'plugin/hooks'), { recursive: true });
  copyFileSync(
    join(REPO_ROOT, '.ai-factory/harness-model.json'),
    join(dir, '.ai-factory/harness-model.json'),
  );
  copyFileSync(
    join(REPO_ROOT, '.claude/settings.json'),
    join(dir, '.claude/settings.json'),
  );
  copyFileSync(
    join(REPO_ROOT, 'plugin/hooks/hooks.json'),
    join(dir, 'plugin/hooks/hooks.json'),
  );
  return dir;
}
const readJson = (p: string) => JSON.parse(readFileSync(p, 'utf8'));
const writeJson = (p: string, v: unknown) =>
  writeFileSync(p, `${JSON.stringify(v, null, 2)}\n`);

afterAll(() => {
  for (const d of sandboxes) rmSync(d, { recursive: true, force: true });
});

describe('harness-config-drift — real tree (claude branch always gated in CI)', () => {
  it('tracked settings.json.hooks + .mcp.json are up-to-date with the SSOT model', () => {
    const { status, out } = gen(REPO_ROOT, '--check');
    expect(status, out).toBe(0);
  });
});

describe('harness-config-drift — positives (P1–P3)', () => {
  it('P2: fresh --write then --check exits 0', () => {
    const s = sandbox();
    expect(gen(s, '--write').status).toBe(0);
    const c = gen(s, '--check');
    expect(c.status, c.out).toBe(0);
  });

  it('P1: a second --write is byte-identical AND still exits 0 (idempotent)', () => {
    const s = sandbox();
    expect(gen(s, '--write').status).toBe(0);
    const snap = () =>
      [
        '.mcp.json',
        '.zcode/config.json',
        '.claude/settings.json',
        'plugin/hooks/hooks.json',
      ]
        .map((f) => readFileSync(join(s, f), 'utf8'))
        .join(' ');
    const first = snap();
    const second = gen(s, '--write');
    expect(second.status, second.out).toBe(0); // guards the rmSync-on-symlink crash class
    expect(snap()).toBe(first);
    expect(readlinkSync(join(s, '.zcode/skills'))).toBe('../.claude/skills'); // link survives re-write
  });

  it('P3: --write leaves settings.json foreign keys (env, permissions) byte-identical', () => {
    const s = sandbox();
    const before = readFileSync(join(s, '.claude/settings.json'), 'utf8');
    gen(s, '--write');
    const after = readFileSync(join(s, '.claude/settings.json'), 'utf8');
    // Whole file byte-identical (model reproduces current hooks; merge owns only `hooks`):
    expect(after).toBe(before);
    // …and structurally the non-hooks keys are untouched:
    expect(readJson(join(s, '.claude/settings.json')).permissions).toEqual(
      JSON.parse(before).permissions,
    );
  });
});

describe('harness-config-drift — negatives (N1–N5)', () => {
  it('N1: a hand-edit to .zcode/config.json is caught (exit 1, names .zcode/config.json)', () => {
    const s = sandbox();
    gen(s, '--write');
    const p = join(s, '.zcode/config.json');
    const j = readJson(p);
    j.mcp.servers.context7.url = 'https://evil.example/mcp';
    writeJson(p, j);
    const c = gen(s, '--check');
    expect(c.status).toBe(1);
    expect(c.out).toContain('.zcode/config.json');
  });

  it('N2: a broken .zcode/skills symlink is caught (exit 1)', () => {
    const s = sandbox();
    gen(s, '--write');
    unlinkSync(join(s, '.zcode/skills')); // unlink (not rmSync) — remove the link, not its target dir
    const c = gen(s, '--check');
    expect(c.status).toBe(1);
    expect(c.out).toContain('symlink');
  });

  it('N3: a hook added to settings.json bypassing the model is caught + error leads to the model', () => {
    const s = sandbox();
    gen(s, '--write');
    const p = join(s, '.claude/settings.json');
    const j = readJson(p);
    j.hooks.Stop.push({
      hooks: [{ type: 'command', command: 'bash rogue.sh' }],
    });
    writeJson(p, j);
    const c = gen(s, '--check');
    expect(c.status).toBe(1);
    expect(c.out).toContain('.claude/settings.json');
    expect(c.out).toContain('harness-model.json'); // fix instruction points to the SSOT
  });

  it('N4: absent .zcode/config.json → zcode branch loud-skips, claude branch STILL runs', () => {
    const s = sandbox();
    gen(s, '--write');
    rmSync(join(s, '.zcode/config.json'), { force: true });
    // (a) clean claude + absent zcode → exit 0 with a LOUD skip (not false-red):
    const clean = gen(s, '--check');
    expect(clean.status, clean.out).toBe(0);
    expect(clean.out).toMatch(/skipping zcode|config\.json.*absent/i);
    // (b) drift the claude branch WHILE zcode.json is absent → still exit 1 (not false-green):
    const p = join(s, '.claude/settings.json');
    const j = readJson(p);
    j.hooks.Stop.push({
      hooks: [{ type: 'command', command: 'bash rogue.sh' }],
    });
    writeJson(p, j);
    const drifted = gen(s, '--check');
    expect(drifted.status).toBe(1);
    expect(drifted.out).toContain('.claude/settings.json');
  });

  it('N5: a vendor key in the model is rejected by the union-IR guard (exit 1)', () => {
    const s = sandbox();
    const p = join(s, '.ai-factory/harness-model.json');
    const m = readJson(p);
    m.permissions = { allow: ['Bash'] }; // vendor key that must NOT leak into the neutral model
    writeJson(p, m);
    const c = gen(s, '--check');
    expect(c.status).toBe(1);
    expect(c.out).toMatch(/unknown top-level key|permissions/);
  });
});

describe('harness-config-drift — robustness (cold-QA #894)', () => {
  it('D1: invoking via a symlinked script path still executes run() (no silent no-op)', () => {
    const s = sandbox();
    // A symlink to the generator, mimicking a git worktree behind a symlinked ancestor.
    // Node resolves `import.meta.url` through the symlink but not `process.argv[1]`, so a
    // bare resolve()-compare guard would exit 0 having written NOTHING here (false-green).
    const linkDir = mkdtempSync(join(tmpdir(), 'harness-drift-link-'));
    sandboxes.push(linkDir);
    const linkedGen = join(linkDir, 'render-harness-config.mjs');
    symlinkSync(GEN, linkedGen);
    const r = spawnSync('node', [linkedGen, '--write', '--root', s], {
      encoding: 'utf8',
    });
    const out = `${r.stdout ?? ''}${r.stderr ?? ''}`;
    expect(r.status, out).toBe(0);
    // Load-bearing: run() ACTUALLY executed — the rendered file exists.
    expect(
      existsSync(join(s, '.mcp.json')),
      'run() must execute via a symlinked path',
    ).toBe(true);
  });

  it('D2: --write with settings.json absent fails with a readable error, not a stack trace', () => {
    const s = sandbox();
    rmSync(join(s, '.claude/settings.json'), { force: true });
    const c = gen(s, '--write');
    expect(c.status).toBe(1);
    expect(c.out).toContain('not found'); // readable, points at the merge contract
    expect(c.out).not.toContain('ENOENT'); // NOT a raw Node stack trace
  });
});

describe('harness-config-drift — honest degradation (attention-is-not-a-mechanism §1)', () => {
  it('emitZcode LOUDLY declares the events it cannot express (SubagentStart/SubagentStop)', () => {
    const s = sandbox();
    const c = gen(s, '--write');
    expect(c.out).toContain('SubagentStart');
    expect(c.out).toContain('SubagentStop');
    expect(c.out).toMatch(
      /NOT (in zcode's event set|expressed)|cannot be expressed|unsupported/i,
    );
    // Declared resolution per event: SubagentStart → full-parity backup (Stage 7B, #1047);
    // SubagentStop → 4D hybrid parity variant (Stage 5, #1046). Both surfaced honestly.
    expect(c.out).toMatch(/inject-subagent-context(\.sh)?/);
    expect(c.out).toContain('4D hybrid');
  });

  it('emitZcode LOUDLY declares matchers that name tools zcode has no alias for (MultiEdit)', () => {
    // zcode aliases Task<->Agent and Write/Edit<-ApplyPatch ONLY. AskUserQuestion is a NATIVE
    // zcode tool (registry tyn, handler Dgn) — its matcher fires verbatim, NOT inert. MultiEdit
    // has no alias and registers-but-never-matches; that gap is declared via a note op.
    const s = sandbox();
    const c = gen(s, '--write');
    expect(c.out).toContain('MultiEdit');
    expect(c.out).toContain('INERT');
    expect(c.out).not.toContain('AskUserQuestion'); // native zcode tool — must NOT be flagged inert
  });

  it('emitZcode LOUDLY declares that project-config hooks are stripped (plugin channel is the live path)', () => {
    // Workspace-config hooks are pending interactive trust on ZCode (diagnostic
    // config_project_hooks_pending_trust, sha256 declaration digests — survey #1699 §4);
    // re-trust churn per hook edit is anti-consumer, so the operator chose plugin-only (Fork A=A2).
    // The emitter must NOT silently write hooks there — it must declare loudly so a reader knows
    // hooks travel via plugin/hooks/hooks.json.
    const s = sandbox();
    const c = gen(s, '--write');
    expect(c.out).toMatch(
      /hooks NOT emitted.*zcode\/config\.json|config_project_hooks_pending_trust/i,
    );
    expect(c.out).toContain('plugin'); // points at the plugin channel as the live path
    // And the rendered .zcode/config.json carries NO hooks key (MCP + skills only):
    const zc = readJson(join(s, '.zcode/config.json'));
    expect(
      zc.hooks,
      '.zcode/config.json must not carry hooks (stripped by zcode)',
    ).toBeUndefined();
    expect(zc.mcp, '.zcode/config.json still carries MCP').toBeDefined();
  });

  it('emitZcode LOUDLY declares PostToolUse gate hooks are ADVISORY-ONLY (schema Uan limit)', () => {
    // Schema Uan (zcode.cjs:53) accepts permissionDecision:"deny" ONLY for PreToolUse. The 4
    // post-mutation gate hooks cannot block on zcode (nor on any harness — post-mutation by
    // definition). CC surfaces exit1+stderr loudly; zcode additionalContext only. This inherent
    // limit is declared loudly, not hidden.
    const s = sandbox();
    const c = gen(s, '--write');
    expect(c.out).toMatch(/ADVISORY-ONLY/i);
    for (const gate of [
      'check-doc-authority',
      'check-hook-marker',
      'check-kickoff-traps',
      'check-worker-dispatch-channel',
    ]) {
      expect(c.out).toContain(gate);
    }
    expect(c.out).toMatch(/PostToolUse|post-mutation/i);
  });
});

describe('harness-config-drift — plugin surface (N6, emitPlugin)', () => {
  it('N6: a hand-edit to plugin/hooks/hooks.json is caught + error leads to the model', () => {
    const s = sandbox();
    gen(s, '--write');
    const p = join(s, 'plugin/hooks/hooks.json');
    const j = readJson(p);
    const events = Object.keys(j.hooks);
    expect(
      events.length,
      'plugin/hooks/hooks.json should have entries',
    ).toBeGreaterThan(0);
    delete j.hooks[events[0]];
    writeJson(p, j);
    const c = gen(s, '--check');
    expect(c.status).toBe(1);
    expect(c.out).toContain('plugin/hooks/hooks.json');
    expect(c.out).toContain('harness-model.json');
  });

  it('emitPlugin emits every zcode-supported model event to plugin/hooks/hooks.json', () => {
    // Coverage contract: the plugin channel (zcode's only live hook path) must carry every
    // hook the model expresses on a zcode-supported event. A silent drop would mean a hook
    // works on CC but is invisible on zcode with no signal.
    const s = sandbox();
    gen(s, '--write');
    const model = readJson(join(s, '.ai-factory/harness-model.json'));
    const plugin = readJson(join(s, 'plugin/hooks/hooks.json'));
    const zcodeSupported = new Set([
      'SessionStart',
      'UserPromptSubmit',
      'PreToolUse',
      'PostToolUse',
      'Stop',
      'PermissionRequest',
      'PostToolUseFailure',
    ]);
    for (const ev of Object.keys(model.hooks)) {
      if (!zcodeSupported.has(ev)) continue;
      // Coverage-by-NAME (robust to plugin-internal additions, unlike count-equality which only
      // held before the #1036/#1046 plugin twins landed): every model-derived hook — except the
      // maintainer-only PLUGIN_INCOMPATIBLE ones, correctly absent from a consumer plugin — must
      // appear by dispatch name in the plugin output for this event. Extra plugin-internal
      // entries (inject-project-digest / inject-output-language / warn-subagent-report-zcode) are
      // allowed; the drift gate (Test above) already asserts they are present + reproducible.
      const pluginNames = new Set<string>(
        ((plugin.hooks[ev] ?? []) as Array<{ hooks?: Array<{ command: string }> }>)
          .flatMap((entry) => entry.hooks ?? [])
          .map((h) => h.command.match(PLUGIN_HOOK_NAME_RE)?.[1])
          .filter((n): n is string => n !== undefined),
      );
      for (const e of model.hooks[ev] as Array<{ command: string }>) {
        const name = e.command.match(MODEL_HOOK_NAME_RE)?.[1];
        if (!name || PLUGIN_INCOMPATIBLE_NAMES.has(name)) continue;
        expect(
          pluginNames.has(name),
          `plugin/hooks/hooks.json ${ev}: model hook "${name}" not carried to the plugin channel`,
        ).toBe(true);
      }
    }
  });
});
