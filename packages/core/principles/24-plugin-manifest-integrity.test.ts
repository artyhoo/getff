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
import {
  readFileSync,
  readdirSync,
  existsSync,
  statSync,
  writeFileSync,
  mkdtempSync,
  cpSync,
  rmSync,
} from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
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
  // Skip _zcode-* SOURCED HELPERS (e.g. _zcode-emit, plan-v3 Mechanism 1): they are internal
  // infrastructure, not delivery-channel artifacts — neither @dual-pair nor @cc-only-rationale
  // applies semantically. Parallels the same skip in tests/plugin/hook-paths.test.sh (T-ZP-C).
  // V7 checks EXECUTABLE paths only: comment lines (starting with optional whitespace + #) may
  // contain documentation examples of the dogfood wiring ($CLAUDE_PROJECT_DIR/.claude/hooks/...)
  // which are NOT executable in the plugin twin — strip them before the path check.
  if (existsSync(hooksDir)) {
    for (const f of readdirSync(hooksDir)) {
      if (f === 'run-hook.cmd' || f.endsWith('.json') || f.endsWith('.md')) continue;
      if (f.startsWith('_zcode-')) continue;  // sourced helper, not a delivery-channel hook
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

// Relative paths of every file under `dir`, recursively — used by (g) to compare a plugin skill
// copy against its skills/ source without assuming a flat layout (references/, templates/).
function walkFiles(dir: string, prefix = ''): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${e.name}` : e.name;
    if (e.isDirectory()) out.push(...walkFiles(resolve(dir, e.name), rel));
    else out.push(rel);
  }
  return out.sort();
}

/**
 * (h) — LINK FORM in a plugin-shipped agent twin. PURE (takes a directory) so the same
 * function runs on the real payload and on a paired-negative replay.
 *
 * WHY THIS EXISTS. `plugin/agents/*.md` is a SECOND distribution channel, and the only one
 * with no link handling of its own: `setup.d/20-agents.sh` iterates `agents/*.md` and runs
 * `transform_internal_refs` on the copies it writes, so the INSTALLER channel rewrites a
 * `](../x)` ref to a blob URL — but nothing touches the plugin twin, which a marketplace
 * consumer unpacks on its own with no `.claude/` tree above it. The twin also sits one
 * directory deeper than its source, and principle 24(d) requires byte-identity, so no
 * relative form can resolve at both depths (scripts/generate-plugin-twins.sh header).
 *
 * That surface was STATED and left ungated (PR #1582), and the gap then admitted the defect
 * it predicted: `agents/compliance-verifier.md` carried three `](../.claude/rules/…)` links
 * whose twin copies pointed at `plugin/.claude/rules/…`, which has never existed — found by
 * the #1597 promote review (ledger L-3), not by any check. pre-push §8 cannot be that check:
 * it EXCLUDES `plugin/agents/**` (PLUGIN_AGENT_TWIN_PREFIX) and only ever walks files changed
 * in the push range, so a link that landed before the exclusion is invisible to it forever.
 * This arm is unconditional and channel-correct instead: it asks what the twin's own payload
 * root can resolve.
 *
 * Two violation classes, both judged from `plugin/agents/` as the root:
 *   L1 — the target ESCAPES the payload (`../…`, or an absolute `/…`). Unfixable in the copy
 *        by construction; the fix belongs in the `agents/` source, as a blob URL (the form
 *        `transform_internal_refs` itself produces, so the installer pass stays a no-op on it).
 *   L2 — the target stays inside the payload but resolves to nothing there. This is the class
 *        a `../`-substring check would miss: `](fidelity-auditor.md)` resolves from `agents/`
 *        (19 agents) and dangles in the twin dir (3).
 *
 * Off-payload targets (http(s)/mailto/protocol-relative) and in-page anchors are not this
 * arm's business — whether a URL is reachable is the link gates' job, per (g)'s same split.
 */
export function checkAgentTwinLinks(twinDir: string): Violation[] {
  const out: Violation[] = [];
  for (const f of readdirSync(twinDir).filter((x) => x.endsWith('.md')).sort()) {
    const text = readFileSync(resolve(twinDir, f), 'utf8');
    // `](target)` / `](target "title")` — inline links and images alike.
    for (const m of text.matchAll(/\]\(\s*(<[^>]*>|[^)\s]+)(?:\s+"[^"]*")?\s*\)/g)) {
      const target = m[1].replace(/^<|>$/g, '');
      if (/^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(target)) continue; // URL, scheme, or in-page anchor
      const path = target.split('#')[0];
      if (path === '') continue;
      const line = text.slice(0, m.index).split('\n').length;
      if (path.startsWith('/') || path.split('/').includes('..')) {
        out.push({
          code: 'L1',
          detail: `${f}:${line} — \`](${target})\` escapes the plugin payload; rewrite it in agents/${f} as a blob URL (https://github.com/<owner>/<repo>/blob/<ref>/…) — byte-identity forbids fixing the copy`,
        });
        continue;
      }
      if (!existsSync(resolve(twinDir, path))) {
        out.push({
          code: 'L2',
          detail: `${f}:${line} — \`](${target})\` does not resolve inside plugin/agents/ (it may resolve at the agents/ source depth, which is not the shipped depth)`,
        });
      }
    }
  }
  return out;
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

  // ── (g) skill payload — membership is a decision, and framework copies must not drift ─
  it('(g) payload: plugin/skills membership is the recorded set, and framework-sourced copies match', () => {
    // WHY THIS EXISTS. Nothing generates plugin/skills/ — no script writes it, and V3 above
    // validates each SKILL.md's frontmatter without ever asking WHICH skills belong or whether a
    // copy still matches its source. That gap let two real defects live: the 2026-06-22 packaging
    // spec's shippable-set table disagreed with the payload for ten weeks unnoticed, and
    // plugin/skills/getff drifted from skills/getff in 6 of 6 files.
    const M1_SET = ['getff', 'installing-enforcement', 'tool-bootstrapping', 'using-getff'];
    const actual = readdirSync(resolve(PLUGIN, 'skills'), { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort();
    expect(actual, 'plugin/skills membership changed. The set is a recorded decision (plan Task 3 Step 4 + its 2026-09-03 promotion) — update M1_SET here and state in the PR body which need triggered the promotion.').toEqual([...M1_SET].sort());

    // Fidelity for skills that also exist under the framework's skills/. Two tiers, strongest
    // first: byte-identity where it is reachable, and content-identity (links normalised away)
    // where the channel forces the link form to differ.
    //
    // WHY A SECOND TIER IS NEEDED. A plugin/skills copy is read by a marketplace consumer OUTSIDE
    // this repo and sits one directory deeper than its source, so its links are mechanically
    // rewritten in two different ways — measured across all 6 getff files, 2026-09-03:
    //   · depth bump      — SKILL.md's ](../../x)      became ](../../../x)
    //   · blob-URL escape — references/*.md's ](../../../x) became ](https://github.com/...),
    //                       and the link TEXT lost its leading ../ ladder with it.
    // Neither is drift; both are required for the link to resolve at all. Byte-identity is
    // therefore unreachable for any skill carrying an escaping link, which is why getff sat
    // quarantined — and a quarantine is an exemption, so getff's CONTENT went unwatched, which is
    // the half that actually went stale (it named AI Factory `/aif-verify` + `rules-sidecar` long
    // after the source moved to ./scripts/audit-ai-docs.sh, and had lost the /rule-research line).
    //
    // Normalising drops every link TARGET and the ../ ladder from link TEXT, leaving the prose.
    // Validated against reality rather than assumed: on the current tree all 6 getff files are
    // raw-DIFF but normalised-SAME, and against the pre-re-sync twin (commit 4adff07b4d) the same
    // comparison reports 79 differing lines whose first two are exactly the two stale-content
    // defects above. The guard would have caught the real incident; that is the claim it earns.
    //
    // What this deliberately no longer checks is whether a link points at the RIGHT document —
    // that is the link gates' job (pre-push §8 lychee, transform_internal_refs), not this arm's.
    const normaliseChannelLinks = (s: string): string =>
      s.replace(/\]\([^)]*\)/g, ']()').replace(/\[(?:\.\.\/)+/g, '[');
    const drift: string[] = [];
    for (const name of actual) {
      const src = resolve(REPO_ROOT, 'skills', name);
      if (!existsSync(src)) continue; // plugin-native skill — no framework source to match
      for (const rel of walkFiles(src)) {
        const twin = resolve(PLUGIN, 'skills', name, rel);
        if (!existsSync(twin)) { drift.push(`${name}/${rel} (missing in plugin)`); continue; }
        const a = readFileSync(resolve(src, rel), 'utf8');
        const b = readFileSync(twin, 'utf8');
        if (a === b) continue; // tier 1: byte-identical (tool-bootstrapping — no escaping links)
        if (normaliseChannelLinks(a) !== normaliseChannelLinks(b)) drift.push(`${name}/${rel}`);
      }
    }
    expect(drift, `plugin/skills copies drifted from their skills/ source in CONTENT (link-form differences are normalised away, so these are real): ${drift.join(', ')}`).toHaveLength(0);
  });

  // ── (h) link form — no plugin-shipped agent twin carries an escaping link ───
  it('(h) real-tree: every plugin/agents twin link resolves inside the plugin payload', () => {
    const v = checkAgentTwinLinks(resolve(PLUGIN, 'agents'));
    expect(
      v,
      `plugin/agents twin links that a marketplace consumer cannot resolve:\n` +
        v.map((x) => `  [${x.code}] ${x.detail}`).join('\n'),
    ).toHaveLength(0);
  });

  it('(h) paired-negative: the pre-fix relative form is RED, and the link-form-only fix is GREEN', () => {
    // Both arms are required, and for opposite reasons. A check that only proves itself RED on
    // drift may be RED on everything; a check that only proves itself GREEN may be RED on
    // nothing. So: replay the REAL defect (ledger L-3 — the three `](../.claude/rules/…)` links
    // agents/compliance-verifier.md carried from PR #1578 until this commit) and assert it is
    // caught, then assert the shipped tree — which differs from that replay in link FORM ONLY —
    // is clean. Same recipe the (g) normaliser was validated with.
    const tmp = mkdtempSync(join(tmpdir(), 'p24h-'));
    try {
      cpSync(resolve(PLUGIN, 'agents'), tmp, { recursive: true });

      // GREEN arm — the shipped link form, judged with only the payload around it.
      expect(
        checkAgentTwinLinks(tmp),
        'the shipped twin payload must be clean in isolation',
      ).toHaveLength(0);

      // RED arm — un-fix it: blob URL back to the relative form, nothing else touched.
      const file = join(tmp, 'compliance-verifier.md');
      const fixed = readFileSync(file, 'utf8');
      const preFix = fixed.replace(
        /https:\/\/github\.com\/[^)/\s]+\/[^)/\s]+\/blob\/[^)/\s]+\//g,
        '../',
      );
      expect(preFix, 'the replay must actually differ from the shipped form').not.toBe(fixed);
      writeFileSync(file, preFix);
      const red = checkAgentTwinLinks(tmp);
      expect(red.map((x) => x.code)).toContain('L1');
      expect(red, `expected the 3 replayed L-3 links; got ${JSON.stringify(red)}`).toHaveLength(3);

      // L2 arm — a link that DOES resolve at the agents/ source depth (19 agents) and dangles at
      // the twin's shipped depth (3). A `../`-substring check cannot see this class.
      writeFileSync(join(tmp, 'probe.md'), '[fidelity-auditor](fidelity-auditor.md)\n');
      expect(existsSync(resolve(REPO_ROOT, 'agents/fidelity-auditor.md')), 'probe target must exist at the source depth').toBe(true);
      const l2 = checkAgentTwinLinks(tmp).filter((x) => x.detail.startsWith('probe.md:'));
      expect(l2.map((x) => x.code), `expected L2 for the source-depth-only link; got ${JSON.stringify(l2)}`).toEqual(['L2']);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  // ── (f) T15 self-application — this gate is itself an executable artifact ────
  it('(f) self-application: the integrity check is a pure function, exercised both green and red', () => {
    // checkPluginIntegrity is exported + run on the real tree (a) AND the broken fixture (b).
    expect(typeof checkPluginIntegrity).toBe('function');
  });
});
