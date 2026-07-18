/*
 * Principle 24 — CC plugin manifest integrity (recursive self-test, T15).
 *
 * The packaging enforces its OWN integrity: «documents lie; tests don't» applied to the
 * plugin manifest. The plugin-packaging umbrella ships skills/agents/commands/session-hooks
 * under plugin/ addressed by .claude-plugin/{plugin,marketplace}.json — this gate proves the
 * manifest cannot silently lie about what it ships.
 *
 * P3 strengthening (plugin-loadability umbrella, 2026-06-28): the gate was GREEN while CC's
 * own validator (`claude plugin tag --dry-run plugin`) REJECTED the plugin — the «green test ≠
 * works» (T14) gap. Two roots, both now closed here:
 *   1. The frontmatter check was a PRESENCE regex (`^name:` / `^description:`) — it could not
 *      see that an unquoted scalar with a mid-value `: ` fails to YAML-parse (which is exactly
 *      how `agents/living-docs-auditor.md` loaded with empty metadata). Replaced with a REAL
 *      YAML parse: a parse error is a violation.
 *   2. The manifest dir was hard-coded to repo-root `.claude-plugin` — it never asserted the
 *      manifest lives where CC RESOLVES it for the marketplace `source` (`./plugin` →
 *      `plugin/.claude-plugin/plugin.json`). Now resolved from `source` and asserted present
 *      (V9), matching the validator's own lookup.
 *
 * Source: docs/superpowers/specs/2026-06-22-cc-plugin-packaging-design.md §7
 *         SSOT docs/meta-factory/prior-art-evaluations.md #149-152
 *         .claude/orchestrator-prompts/plugin-loadability/kickoff.md
 *
 * checkPluginIntegrity() is PURE (takes a plugin dir + the marketplace dir) so it runs on BOTH
 * the real tree (must be GREEN) and a deliberately-broken paired-negative fixture (must be RED) —
 * the principle-02 paired-negative discipline that makes the gate non-tautological.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

// A REAL YAML parser — the point of the P3 strengthening (a presence-regex cannot see a parse
// error). js-yaml@4.1.1 is transitively present via the markdownlint-cli2 (root) + eslint
// (@eslint/eslintrc) devDeps — no new package.json dependency (kickoff §5). createRequire keeps
// it a runtime resolution, sidestepping the absent @types/js-yaml so `tsc --noEmit` stays clean.
const nodeRequire = createRequire(import.meta.url);
const { load: parseYaml } = nodeRequire('js-yaml') as { load: (s: string) => unknown };

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../../');

interface Violation {
  code: string;
  detail: string;
}

function tryJSON(p: string): any | null {
  try {
    return JSON.parse(readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * REAL YAML parse of the frontmatter block (between the first two `---` fences). Returns the
 * parsed mapping, or an error reason. A missing block OR a YAML parse error (e.g. an unquoted
 * scalar containing `: `) is a failure — the strengthening over the old presence-regex.
 */
function parseFrontmatter(content: string): { data?: Record<string, unknown>; reason?: string } {
  if (!content.startsWith('---')) return { reason: 'no opening --- fence' };
  const end = content.indexOf('\n---', 3);
  if (end === -1) return { reason: 'no closing --- fence' };
  const fm = content.slice(3, end); // strictly between the fences
  let data: unknown;
  try {
    data = parseYaml(fm);
  } catch (e) {
    return { reason: `YAML parse error: ${(e as Error).message.split('\n')[0]}` };
  }
  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    return { reason: 'frontmatter is not a YAML mapping' };
  }
  return { data: data as Record<string, unknown> };
}

/** Valid iff the frontmatter parses AND carries every required key as a non-empty value. */
function frontmatterError(content: string, keys: string[]): string | null {
  const { data, reason } = parseFrontmatter(content);
  if (!data) return reason ?? 'invalid frontmatter';
  for (const k of keys) {
    const val = data[k];
    if (val === undefined || val === null || (typeof val === 'string' && val.trim() === '')) {
      return `missing or empty required key '${k}'`;
    }
  }
  return null;
}

/**
 * Pure manifest-integrity check. `pluginDir` = the plugin payload root; `marketplaceDir` = the
 * dir holding marketplace.json. The plugin manifest (plugin.json) is located where CC RESOLVES
 * it from the marketplace `source` (`<marketplaceDir>/../<source>/.claude-plugin/plugin.json`),
 * NOT assumed to sit beside marketplace.json. Returns all violations.
 */
export function checkPluginIntegrity(pluginDir: string, marketplaceDir: string): Violation[] {
  const v: Violation[] = [];

  // V1 — marketplace.json parses.
  const mj = tryJSON(resolve(marketplaceDir, 'marketplace.json'));
  if (!mj) v.push({ code: 'V1', detail: 'marketplace.json missing or invalid JSON' });

  // Resolve where CC looks for the plugin manifest, from the declared `source`.
  let manifestDir: string | null = null;
  const src: unknown = mj?.plugins?.[0]?.source;
  if (typeof src === 'string') {
    if (!existsSync(resolve(marketplaceDir, '..', src))) {
      v.push({ code: 'V2', detail: `marketplace source ${src} does not resolve` });
    }
    manifestDir = resolve(marketplaceDir, '..', src, '.claude-plugin');
    // V9 — the manifest MUST live where CC resolves it for `source` (the load-truth the
    // validator enforces). This is the assertion the old hard-coded MANIFEST path could not make.
    if (!existsSync(resolve(manifestDir, 'plugin.json'))) {
      v.push({ code: 'V9', detail: `plugin.json not at CC-resolved location ${src}/.claude-plugin/plugin.json` });
    }
  } else if (mj) {
    v.push({ code: 'V2', detail: 'marketplace plugins[0].source missing or non-string' });
  }

  // V1 — plugin.json parses (read from the CC-resolved location, not beside marketplace.json).
  const pj = manifestDir ? tryJSON(resolve(manifestDir, 'plugin.json')) : null;
  if (!pj) v.push({ code: 'V1', detail: 'plugin.json missing or invalid JSON at CC-resolved location' });

  // V2 — version parity: plugin.json.version === marketplace.json.plugins[0].version.
  if (pj && mj) {
    const pv = pj.version;
    const mv = mj.plugins?.[0]?.version;
    if (!pv || pv !== mv) v.push({ code: 'V2', detail: `version drift: plugin.json=${pv} marketplace=${mv}` });
  }

  // V3 — every plugin/skills/<slug>/SKILL.md: frontmatter YAML-parses with name+description +
  // a doc-authority header.
  const skillsDir = resolve(pluginDir, 'skills');
  if (existsSync(skillsDir)) {
    for (const d of readdirSync(skillsDir, { withFileTypes: true })) {
      if (!d.isDirectory()) continue;
      const sk = resolve(skillsDir, d.name, 'SKILL.md');
      if (!existsSync(sk)) {
        v.push({ code: 'V3', detail: `skill ${d.name} has no SKILL.md` });
        continue;
      }
      const c = readFileSync(sk, 'utf8');
      const fmErr = frontmatterError(c, ['name', 'description']);
      if (fmErr) v.push({ code: 'V3', detail: `skill ${d.name}: ${fmErr}` });
      if (!/Authoritative for:/.test(c)) v.push({ code: 'V3', detail: `skill ${d.name}: missing doc-authority "Authoritative for:" header` });
    }
  }

  // V4 — every plugin/agents/*.md: frontmatter YAML-parses with name. (Header drift is guarded
  // by the byte-identical-to-source arm, since agents/ headers are principle-09-enforced.)
  const agentsDir = resolve(pluginDir, 'agents');
  if (existsSync(agentsDir)) {
    for (const f of readdirSync(agentsDir).filter((f) => f.endsWith('.md'))) {
      const c = readFileSync(resolve(agentsDir, f), 'utf8');
      const fmErr = frontmatterError(c, ['name']);
      if (fmErr) v.push({ code: 'V4', detail: `agent ${f}: ${fmErr}` });
    }
  }

  // V5 — every plugin/commands/*.md: frontmatter YAML-parses with description.
  const cmdDir = resolve(pluginDir, 'commands');
  if (existsSync(cmdDir)) {
    for (const f of readdirSync(cmdDir).filter((f) => f.endsWith('.md'))) {
      const c = readFileSync(resolve(cmdDir, f), 'utf8');
      const fmErr = frontmatterError(c, ['description']);
      if (fmErr) v.push({ code: 'V5', detail: `command ${f}: ${fmErr}` });
    }
  }

  // V6 — hooks.json valid; every run-hook.cmd target exists as a sibling.
  const hooksDir = resolve(pluginDir, 'hooks');
  const hj = resolve(hooksDir, 'hooks.json');
  if (existsSync(hj)) {
    const parsed = tryJSON(hj);
    if (!parsed) {
      v.push({ code: 'V6', detail: 'hooks.json invalid JSON' });
    } else {
      // Walk the parsed structure and regex each raw command string (JSON.stringify would
      // escape the inner quotes — `run-hook.cmd\"` — and break the matcher).
      const targets: string[] = [];
      const collect = (o: unknown): void => {
        if (typeof o === 'string') {
          const m = o.match(/run-hook\.cmd"?\s+([A-Za-z0-9_-]+)/);
          if (m) targets.push(m[1]);
        } else if (Array.isArray(o)) {
          o.forEach(collect);
        } else if (o && typeof o === 'object') {
          Object.values(o).forEach(collect);
        }
      };
      collect(parsed);
      for (const target of targets) {
        if (!existsSync(resolve(hooksDir, target))) v.push({ code: 'V6', detail: `hooks.json target '${target}' missing under plugin/hooks/` });
      }
    }
  }

  // V7/V8 — relocated hook scripts (non-run-hook.cmd, non-json): no mis-rooted plugin-data
  // path; carry a delivery-channel marker. Skip subdirectories (e.g. lang/) — only top-level
  // hook scripts carry these markers; subdirs hold support files (lang packs, etc.).
  // V7 checks EXECUTABLE paths only: comment lines (starting with optional whitespace + #) may
  // contain documentation examples of the dogfood wiring ($CLAUDE_PROJECT_DIR/.claude/hooks/...)
  // which are NOT executable in the plugin twin — strip them before the path check.
  if (existsSync(hooksDir)) {
    for (const f of readdirSync(hooksDir)) {
      if (f === 'run-hook.cmd' || f.endsWith('.json') || f.endsWith('.md')) continue;
      const abs = resolve(hooksDir, f);
      if (!statSync(abs).isFile()) continue;  // skip subdirectories (lang/, etc.)
      const c = readFileSync(abs, 'utf8');
      const codeLinesOnly = c.split('\n').filter((l) => !/^\s*#/.test(l)).join('\n');
      if (/CLAUDE_PROJECT_DIR[^\s]*\/\.claude\/hooks\//.test(codeLinesOnly)) v.push({ code: 'V7', detail: `hook ${f}: mis-rooted plugin-data path ($CLAUDE_PROJECT_DIR/.claude/hooks/)` });
      if (!/^# @(dual-pair|cc-only-rationale):/m.test(c)) v.push({ code: 'V8', detail: `hook ${f}: missing @dual-pair/@cc-only-rationale marker` });
    }
  }

  return v;
}

describe('Principle 24 — CC plugin manifest integrity (T15 self-test)', () => {
  const PLUGIN = resolve(REPO_ROOT, 'plugin');
  // marketplace.json lives at the repo-root marketplace dir; plugin.json is resolved FROM its
  // `source` (./plugin → plugin/.claude-plugin/plugin.json) — exactly where the validator looks.
  const MARKETPLACE = resolve(REPO_ROOT, '.claude-plugin');

  // ── (a) real-tree — the shipped plugin is internally consistent ─────────────
  it('(a) real-tree: the plugin manifest + payload have zero integrity violations', () => {
    const violations = checkPluginIntegrity(PLUGIN, MARKETPLACE);
    expect(
      violations,
      `Plugin integrity violations:\n` + violations.map((x) => `  [${x.code}] ${x.detail}`).join('\n'),
    ).toHaveLength(0);
  });

  // ── (b) PAIRED-NEGATIVE (principle-02) — a broken manifest MUST be caught ────
  it('(b) paired-negative: the deliberately-broken fixture FAILS the integrity check', () => {
    const fx = resolve(REPO_ROOT, 'tests/fixtures/plugin-broken-manifest');
    expect(existsSync(fx), 'paired-negative fixture must exist').toBe(true);
    const violations = checkPluginIntegrity(resolve(fx, 'plugin'), resolve(fx, '.claude-plugin'));
    const codes = new Set(violations.map((x) => x.code));
    // The fixture is built to trip version-drift (V2), a header-less skill (V3), an UNPARSEABLE
    // agent frontmatter (V4 — proves the real-YAML-parse arm has teeth), and a dangling hook
    // target (V6) — proving the gate is not a happy-path tautology.
    expect(codes.has('V2'), `expected V2 (version drift); got ${[...codes]}`).toBe(true);
    expect(codes.has('V3'), `expected V3 (skill defect); got ${[...codes]}`).toBe(true);
    expect(codes.has('V4'), `expected V4 (unparseable agent frontmatter); got ${[...codes]}`).toBe(true);
    expect(codes.has('V6'), `expected V6 (dangling hook target); got ${[...codes]}`).toBe(true);
  });

  // ── (c) version pin — fetch-and-wire.sh tracks the plugin version ───────────
  it('(c) fetch-and-wire.sh RAT_PLUGIN_VERSION === plugin.json.version', () => {
    // plugin.json now lives at the CC-resolved location under the plugin payload.
    const pj = tryJSON(resolve(PLUGIN, '.claude-plugin', 'plugin.json'));
    const seam = readFileSync(resolve(PLUGIN, 'install/fetch-and-wire.sh'), 'utf8');
    const m = seam.match(/RAT_PLUGIN_VERSION="([^"]+)"/);
    expect(m, 'fetch-and-wire.sh must declare RAT_PLUGIN_VERSION').not.toBeNull();
    expect(m![1]).toBe(pj.version);
  });

  // ── (d) drift guard — plugin/agents/*.md byte-identical to agents/*.md ───────
  it('(d) drift: every plugin/agents/*.md is byte-identical to its agents/ source', () => {
    const dir = resolve(PLUGIN, 'agents');
    const drift: string[] = [];
    for (const f of readdirSync(dir).filter((f) => f.endsWith('.md'))) {
      const src = resolve(REPO_ROOT, 'agents', f);
      if (!existsSync(src) || readFileSync(src, 'utf8') !== readFileSync(resolve(dir, f), 'utf8')) drift.push(f);
    }
    expect(drift, `plugin/agents drifted from agents/ source: ${drift.join(', ')}`).toHaveLength(0);
  });

  // ── (e) drift guard — relocated inject-matching-rule keeps its source's logic ─
  it('(e) drift: plugin/hooks/inject-matching-rule core logic is byte-identical to its source', () => {
    const plugin = readFileSync(resolve(PLUGIN, 'hooks/inject-matching-rule'), 'utf8');
    const source = readFileSync(resolve(REPO_ROOT, '.claude/hooks/inject-matching-rule.sh'), 'utf8');
    // Same @dual-pair anchor (the §5 dual-implementation contract).
    expect(plugin).toMatch(/@dual-pair: rule-path-scoping/);
    expect(source).toMatch(/@dual-pair: rule-path-scoping/);
    // The ONLY legitimate divergence is the relocation (header + the project-dir resolution,
    // which lives ABOVE glob_match). From `glob_match()` to EOF — the matcher + injection core —
    // the two MUST be byte-identical, so a regression inside that logic is caught (not just a
    // string-presence check). S6 cold-review hardening.
    const coreOf = (s: string): string => {
      const i = s.indexOf('glob_match()');
      return i === -1 ? '' : s.slice(i);
    };
    expect(coreOf(plugin), 'plugin hook must contain the glob_match core').not.toBe('');
    expect(coreOf(plugin), 'plugin/hooks/inject-matching-rule core logic drifted from .claude/hooks/inject-matching-rule.sh').toBe(coreOf(source));
  });

  // ── (f) T15 self-application — this gate is itself an executable artifact ────
  it('(f) self-application: the integrity check is a pure function, exercised both green and red', () => {
    // checkPluginIntegrity is exported + run on the real tree (a) AND the broken fixture (b).
    expect(typeof checkPluginIntegrity).toBe('function');
  });
});
