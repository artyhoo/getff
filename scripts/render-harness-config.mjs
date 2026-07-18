#!/usr/bin/env node
/**
 * render-harness-config — derive per-harness runtime config from ONE neutral SSOT.
 *
 * WHY (#894): non-CC harnesses that don't read `.claude/` (zcode, a CC fork the
 * framework is developed inside) install to /dev/null — hooks never fire, no MCP,
 * no skills. This renderer makes the framework's edit-time machinery visible to
 * such a harness WITHOUT hand-copying config (which would be #sync-by-copy-paste,
 * dual-implementation-discipline.md §8). SSOT = `.ai-factory/harness-model.json`;
 * every harness config is a THIN derivation of it, drift-gated
 * (packages/core/hooks/harness-config-drift.test.ts, channel test:hooks).
 *
 * ARCHITECTURE (owner decision 2026-07-03): the `HarnessEmitter` interface is
 * extracted from TWO live backends day-one (CC + zcode), mirroring the
 * EcosystemAdapter precedent (npm #852 + cargo #868) — the neutral core is only
 * what both backends share; vendor keys (permissions, enabledPlugins, model, …)
 * are kept OUT of the model by an executable union-IR guard (not prose).
 *
 * Modes: `--write` (emit) | `--check` (drift, exit 1 on mismatch). `--root <dir>`
 * overrides the SSOT search root (default: walk up from cwd). Node, zero deps.
 * Precedent: packages/core/render/render-rules.ts --write/--check.
 *
 * Operator-axis only: zcode.json + .zcode/ are gitignored maintainer-env shims.
 * A per-harness emitter shipped to consumers via install.sh is a PARKED fork (#894 §7).
 */
import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  lstatSync,
  readlinkSync,
  symlinkSync,
  unlinkSync,
  rmSync,
  realpathSync,
} from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// ── zcode's supported hook event set (verified from the bundle 2026-07-03:
// `qr={SessionStart,UserPromptSubmit,PreToolUse,PermissionRequest,PostToolUse,
// PostToolUseFailure,Stop}` — NO SubagentStart/SubagentStop). Events outside this
// set cannot be expressed on zcode and MUST be declared LOUDLY, not dropped
// silently (attention-is-not-a-mechanism.md §1). ──
const ZCODE_EVENTS = new Set([
  'SessionStart',
  'UserPromptSubmit',
  'PreToolUse',
  'PermissionRequest',
  'PostToolUse',
  'PostToolUseFailure',
  'Stop',
]);

// ── Tool matchers that exist on Claude Code but have NO equivalent / alias on zcode.
// Verified against the bundle 2026-07-16: zcode's native tool registry (tyn, 30 tools) INCLUDES
// AskUserQuestion (native, handler Dgn @1038931, needsApproval, runtimeInputSchema C5) — so a
// PreToolUse:"AskUserQuestion" matcher fires and works verbatim (smoke-tested: emits a valid
// deny-JSON). It is NOT inert. The ONLY inert matcher is MultiEdit: zcode aliases are
// Task↔Agent and Write/Edit←ApplyPatch ONLY — there is no MultiEdit alias, so a matcher naming
// it registers but never matches. Declared LOUDLY via a note op (attention-is-not-a-mechanism §1). ──
const ZCODE_UNSUPPORTED_TOOLS = new Set(['MultiEdit']);

const MODEL_KEYS = new Set(['hooks', 'mcpServers', 'skillsDir']);
const HOOK_ENTRY_KEYS = new Set(['matcher', 'command']);
const MCP_ENTRY_KEYS = new Set(['type', 'command', 'url', 'args', 'env']);

/** Union-IR guard — executable, not prose. Rejects vendor keys leaking into the
 *  neutral model (N5). Throws with a message that names the offending key. */
export function validateModel(model) {
  const bad = (m) => {
    throw new Error(`harness-model.json: ${m}`);
  };
  if (typeof model !== 'object' || model === null || Array.isArray(model))
    bad('must be a JSON object');
  for (const k of Object.keys(model)) {
    if (!MODEL_KEYS.has(k))
      bad(
        `unknown top-level key "${k}" — model is NARROW {hooks, mcpServers, skillsDir}; vendor keys (permissions, enabledPlugins, model, …) belong in the harness file, not the SSOT`,
      );
  }
  for (const [event, entries] of Object.entries(model.hooks ?? {})) {
    if (!Array.isArray(entries)) bad(`hooks.${event} must be an array`);
    for (const e of entries) {
      for (const k of Object.keys(e))
        if (!HOOK_ENTRY_KEYS.has(k))
          bad(`hooks.${event}[].${k} — hook entry is {matcher?, command}`);
      if (typeof e.command !== 'string' || !e.command)
        bad(`hooks.${event}[] missing string "command"`);
    }
  }
  for (const [name, s] of Object.entries(model.mcpServers ?? {})) {
    for (const k of Object.keys(s))
      if (!MCP_ENTRY_KEYS.has(k))
        bad(
          `mcpServers.${name}.${k} — server entry is {type?, command?, url?, args?, env?}`,
        );
    if (!s.url && !s.command)
      bad(`mcpServers.${name} needs "url" (http/sse) or "command" (stdio)`);
  }
  if (model.skillsDir !== undefined && typeof model.skillsDir !== 'string')
    bad('skillsDir must be a string');
  return model;
}

/** Neutral hooks {Event:[{matcher?,command}]} -> CC/zcode structure
 *  {Event:[{matcher?,hooks:[{type:'command',command}]}]}. Order-preserving so the
 *  emit round-trips the existing settings.json byte-for-byte.
 *
 *  SUBSET-BY-DESIGN (schema-verified 2026-07-04 against zcode's shipped Zod,
 *  bundle @discriminatedUnion): zcode's inner-hook grammar is a TWO-variant union —
 *  `command` {type:'command',command,async?,shell?,timeoutMs?} AND
 *  `process` {type:'process',command,args[],timeoutMs?,statusMessage?}. This emitter
 *  renders ONLY the `command` variant (a VALID subset — the other fields are optional,
 *  so a `{type:'command',command}` object passes zcode's `.strict()` validation). The
 *  `process` variant + async/shell/timeoutMs optionals (and MCP-server `timeoutMs`, see
 *  emitZcode) are UNEXPRESSED-BY-DESIGN, not missing-by-oversight: the neutral SSOT models
 *  only what a CC framework hook needs (one shell command per event). A future consumer
 *  that needs a process-type or async hook widens BOTH the model (validateModel's
 *  HOOK_ENTRY_KEYS) and this mapping — recorded here so the subset is not mistaken for the
 *  whole grammar (attention-is-not-a-mechanism.md — silent narrowing declared, not hidden). */
function toCCHooks(hooks) {
  const out = {};
  for (const [event, entries] of Object.entries(hooks)) {
    out[event] = entries.map((e) =>
      e.matcher !== undefined
        ? {
            matcher: e.matcher,
            hooks: [{ type: 'command', command: e.command }],
          }
        : { hooks: [{ type: 'command', command: e.command }] },
    );
  }
  return out;
}

const envMapToPairs = (env) =>
  Object.entries(env ?? {}).map(([name, value]) => ({
    name,
    value: String(value),
  }));

// ── HarnessEmitter interface: {name, presenceProbe?, emit(model, repoRoot) -> FileOp[]}.
// FileOp kinds: json | merge-json (owns ONE key) | symlink | note (loud declaration).
// `optional` ops belong to a gitignored artifact — absent-on-check => loud skip, not drift. ──

/** CC backend: owns ONLY `hooks` in settings.json (merge — CC runtime keeps
 *  writing permissions/env; war-over-the-file excluded by construction); MCP -> .mcp.json. */
export function emitClaude(model) {
  return [
    {
      kind: 'merge-json',
      path: '.claude/settings.json',
      key: 'hooks',
      value: toCCHooks(model.hooks ?? {}),
    },
    {
      kind: 'json',
      path: '.mcp.json',
      value: { mcpServers: model.mcpServers ?? {} },
    },
  ];
}

/** zcode backend: .zcode/config.json — the ONE workspace config file ZCode reads.
 *  + idempotent symlink .zcode/skills -> ../<skillsDir>.
 *
 *  SCHEMA-VERIFIED against zcode-host bundle 2026-07-16 (zcode.cjs, Zod schemas):
 *   • config-file hooks require the WRAPPER form { hooks: { enabled, events: { <Event>: [...] } } }
 *     (NOT the plugin/bare-CC shape hooks.<Event>). Both the outer object and events are .strict().
 *     enabled is OPTIONAL in schema but defaults to falsy -> the hook runner is DISABLED unless
 *     enabled: true is set. So we set it explicitly. (The CC-plugin shape hooks.<Event> is valid
 *     ONLY for plugin hooks/hooks.json, which auto-enable the runner via a different code path.)
 *   • MCP server: name is the MAP KEY (mcp.servers.<name>), NOT a field. The http/sse .strict()
 *     schema is {type,url,headers?,oauth?,timeoutMs?,enabled?} — a name field inside it FAILS
 *     validation. (headers is optional; omitted is .strict()-valid.)
 *
 *  HOOKS NOT EMITTED HERE (bundle-verified 2026-07-17, zcode.cjs T3e/TTn @ offset 2047000):
 *  ZCode's loadProjectConfigFile STRIPS the `hooks` key from BOTH project-scope candidates
 *  (zcode.json AND .zcode/config.json) under `config_project_hooks_ignored` (a security policy),
 *  pushing a warning diagnostic. So emitting hooks into .zcode/config.json was a SILENT NO-OP —
 *  MCP and the skills symlink load, hooks never did. Hooks reach ZCode ONLY via the plugin
 *  channel (emitPlugin → plugin/hooks/hooks.json, loaded by the separate EAo merge path which
 *  is security-policy-exempt). The .zcode/config.json file retains MCP + skills only.
 *
 *  HONEST DEGRADATION (declared LOUDLY, attention-is-not-a-mechanism.md §1):
 *   • 4 PostToolUse gate hooks (POST_MUTATION_GATES) are ADVISORY-ONLY on ZCode. Schema Uan
 *     (zcode.cjs:53) accepts permissionDecision:"deny" ONLY for PreToolUse; PostToolUse consumes
 *     additionalContext alone. Post-mutation checks cannot block on ANY harness (the file is
 *     already changed), but CC surfaces exit1+stderr loudly while ZCode's additionalContext is a
 *     quieter channel. Relocation to PreToolUse is semantically impossible (the file has not
 *     mutated yet at PreToolUse). Surfaced as a note so the gap is visible, not hidden.
 *   • SubagentStart/SubagentStop are NOT in ZCode's event set at all — backup paths noted below.
 *   • MultiEdit matchers are INERT on ZCode (no alias); AskUserQuestion IS native (NOT inert). */
const POST_MUTATION_GATES = [
  'check-doc-authority',
  'check-hook-marker',
  'check-kickoff-traps',
  'check-worker-dispatch-channel',
];
export function emitZcode(model) {
  // Detect dead matchers across the whole model (not just ZCode-supported events): tool names CC
  // has but zcode does not (no alias). The hook registers but never fires. Surfaced as a loud note.
  const deadMatchers = new Set();
  for (const entries of Object.values(model.hooks ?? {})) {
    for (const e of entries) {
      if (e.matcher)
        for (const alt of e.matcher.split('|')) {
          const t = alt.trim();
          if (ZCODE_UNSUPPORTED_TOOLS.has(t)) deadMatchers.add(t);
        }
    }
  }
  const servers = {};
  for (const [name, s] of Object.entries(model.mcpServers ?? {})) {
    servers[name] = s.url
      ? { type: s.type ?? 'http', url: s.url }
      : { command: s.command, args: s.args ?? [], env: envMapToPairs(s.env) };
  }
  const skillsDir = model.skillsDir ?? '.claude/skills';
  const ops = [
    // hooks intentionally NOT emitted — see the block comment above (project-config hooks are
    // security-policy-stripped by ZCode; the plugin channel is the only live path — emitPlugin).
    {
      kind: 'json',
      path: '.zcode/config.json',
      optional: true,
      value: { mcp: { servers } },
    },
    {
      kind: 'symlink',
      path: '.zcode/skills',
      optional: true,
      target: `../${skillsDir}`,
    },
  ];
  // Declared degradations (attention-is-not-a-mechanism §1 — silent narrowing declared, not hidden).
  ops.push({
    kind: 'note',
    message: `emitZcode: hooks NOT emitted to .zcode/config.json — ZCode strips project-config hooks (security policy config_project_hooks_ignored, T3e/TTn @ zcode.cjs:2047000). Hooks reach ZCode ONLY via the plugin channel (plugin/hooks/hooks.json, emitPlugin). This file carries MCP + skills only.`,
  });
  ops.push({
    kind: 'note',
    message: `emitZcode: ${POST_MUTATION_GATES.length} PostToolUse gate hook(s) are ADVISORY-ONLY on zcode (schema Uan @ zcode.cjs:53 rejects permissionDecision for PostToolUse; exit1 is swallowed as HookRunFailed, not surfaced): ${POST_MUTATION_GATES.join(', ')}. CC surfaces these via exit1+stderr; on zcode they inject additionalContext only. Post-mutation checks cannot block on any harness — this is inherent, not a fixable gap.`,
  });
  // Events ZCode's event set does not support at all — drop + declare backup path.
  const unsupportedEvents = Object.keys(model.hooks ?? {}).filter(
    (ev) => !ZCODE_EVENTS.has(ev),
  );
  if (unsupportedEvents.length) {
    const backup = {
      SubagentStart:
        "backup: PreToolUse:Agent+updatedInput (inject-subagent-context) delivers the digest one-shot as the subagent's first message — NOT persistent-lifecycle as on CC",
      SubagentStop:
        'NO backup: warn-subagent-report is post-dispatch (scans the finished report); no updatedInput analogue exists on zcode — CC-only',
    };
    const lines = unsupportedEvents.map((ev) =>
      backup[ev]
        ? `${ev} — ${backup[ev]}`
        : `${ev} — zcode does not support this event (CC-only)`,
    );
    ops.push({
      kind: 'note',
      message: `emitZcode: ${unsupportedEvents.length} event(s) NOT in zcode's event set (cannot be expressed on zcode via any channel):\n    ${lines.join('\n    ')}`,
    });
  }
  if (deadMatchers.size) {
    ops.push({
      kind: 'note',
      message: `emitZcode: matcher(s) name tool(s) zcode has no alias for — registered but INERT on zcode: ${[...deadMatchers].join(', ')}. These hooks fire on CC only.`,
    });
  }
  return ops;
}

/** Plugin-channel hooks that are INTRINSIC to the plugin payload — NOT derived from the model.
 *  These are preserved verbatim in plugin/hooks/hooks.json regardless of model state. They live
 *  inside the plugin tarball (skills bootstrap, etc.) and have no counterpart under .claude/hooks/.
 *  Listed here so emitPlugin is the single source of truth for plugin/hooks/hooks.json (no
 *  read-modify-write of the existing file — pure derivation, drift-gated).
 *
 *  Shape matches toCCHooks/emitClaude output: { Event: [{matcher?, hooks:[{type,command,async?}]}] }. */
const PLUGIN_INTERNAL_HOOKS = {
  SessionStart: [
    // session-start bootstrap: injects the using-getff entry-point context so the skill
    // auto-triggers. Plugin-internal (the script + skill ship inside the plugin tarball).
    // Note: this REPLACES the model's SessionStart entry (which is scripts/link-coordination.sh
    // — a maintainer-env-only worktree-coordination script that has no consumer-plugin meaning;
    // see PLUGIN_INCOMPATIBLE below).
    {
      matcher: 'startup|clear|compact',
      hooks: [
        {
          type: 'command',
          command: '"${CLAUDE_PLUGIN_ROOT}/hooks/run-hook.cmd" session-start',
          async: false,
        },
      ],
    },
  ],
};

/** Model hook commands that are NOT plugin-channel-compatible and must be SKIPPED (loudly).
 *  Keyed by script basename. Reasons are surfaced in a note op so the skip is visible, not a
 *  silent narrowing (attention-is-not-a-mechanism.md §1). */
const PLUGIN_INCOMPATIBLE = {
  // link-coordination is a maintainer-env-only cross-worktree symlink coordinator (touches
  // $HOME/.claude-coordination/...); it has no meaning in a consumer's plugin payload and
  // would mis-fire on SessionStart. The plugin's own SessionStart (PLUGIN_INTERNAL_HOOKS)
  // delivers the bootstrap instead.
  'link-coordination':
    'maintainer-env-only cross-worktree coordinator — no consumer-plugin meaning (plugin SessionStart bootstrap delivers entry-point context instead)',
};

/** plugin backend: plugin/hooks/hooks.json — the CC-plugin convention (hooks/hooks.json, bare
 *  hooks.<Event> shape, dispatched via run-hook.cmd). This is the ONLY project-scope hook path
 *  that WORKS on ZCode (security-policy-exempt: plugin hooks load via EAo @ zcode.cjs:8897587,
 *  not T3e). Also works on CC (plugin = SOFT layer).
 *
 *  Schema (bundle-verified 2026-07-16): plugin hooks/hooks.json uses bare `hooks.<Event>` with
 *  entries {matcher?, hooks:[{type:'command', command, async?}]} — the CC-plugin shape. Both
 *  CC and ZCode load it via the plugin-discovery path.
 *
 *  COMPOSITION: plugin/hooks/hooks.json is the union of TWO sources:
 *   (1) PLUGIN_INTERNAL_HOOKS — intrinsic to the plugin payload (e.g. session-start bootstrap),
 *       listed verbatim above.
 *   (2) RELOCATED framework hooks — derived from the model's `.claude/hooks/<name>.sh` commands,
 *       each routed to a sibling script under plugin/hooks/ via run-hook.cmd (T-PLUG-A twin).
 *       Filtered to ZCODE_EVENTS (Subagent* dropped) and PLUGIN_INCOMPATIBLE (maintainer-only).
 *
 *  COVERAGE: a hook works on ZCode ONLY if it has a plugin sibling (T-PLUG-A real copy under
 *  plugin/hooks/<name>). The sibling scripts are hand-maintained (precedent: session-start,
 *  inject-matching-rule); this emitter renders only the wiring JSON. drift-gated by
 *  harness-config-drift.test.ts; hook-paths.test.sh gate (a-g) enforces sibling discipline.
 *
 *  COMMAND FORM: every derived entry's command is the literal `"${CLAUDE_PLUGIN_ROOT}/hooks/
 *  run-hook.cmd" <name>` (CLAUDE_PLUGIN_ROOT is set in plugin-hook env by BOTH CC and ZCode —
 *  uRt @ zcode.cjs:1073000 sets it alongside ZCODE_PLUGIN_ROOT to the same rootPath).
 *
 *  SUBAGENT EVENTS: SubagentStart/SubagentStop are NOT in ZCODE_EVENTS and also not expressible
 *  on CC's plugin hooks in the same lifecycle way — they are filtered out here. Their content
 *  travels via inject-subagent-context (PreToolUse:Agent) where expressible. */
export function emitPlugin(model) {
  // Translate model commands `bash "$CLAUDE_PROJECT_DIR/.claude/hooks/<name>.sh"` →
  // plugin-channel commands `"${CLAUDE_PLUGIN_ROOT}/hooks/run-hook.cmd" <name>`. The script
  // basename is the dispatch key run-hook.cmd routes on (see plugin/hooks/run-hook.cmd).
  const out = {};
  const unmappable = [];
  const incompatible = [];
  for (const [event, entries] of Object.entries(model.hooks ?? {})) {
    if (!ZCODE_EVENTS.has(event)) continue; // plugin channel mirrors ZCode's expressible set
    const mapped = [];
    for (const e of entries) {
      // Extract <name> from `bash "$CLAUDE_PROJECT_DIR/.claude/hooks/<name>.sh"` (or the
      // scripts/<name>.sh form). Surface unmappable entries loudly via a note rather than
      // silently dropping them (attention-is-not-a-mechanism §1).
      const m = e.command.match(
        /\/(?:\.claude\/hooks|scripts)\/([A-Za-z0-9_-]+)\.sh/,
      );
      if (!m) {
        unmappable.push(e.command);
        continue;
      }
      const name = m[1];
      if (PLUGIN_INCOMPATIBLE[name]) {
        incompatible.push(`${name}: ${PLUGIN_INCOMPATIBLE[name]}`);
        continue;
      }
      const cmd = `"\${CLAUDE_PLUGIN_ROOT}/hooks/run-hook.cmd" ${name}`;
      mapped.push(
        e.matcher !== undefined
          ? { matcher: e.matcher, hooks: [{ type: 'command', command: cmd }] }
          : { hooks: [{ type: 'command', command: cmd }] },
      );
    }
    // Merge with plugin-internal entries for this event (plugin-internal wins ordering, but
    // both lists coexist). Plugin-internal entries (e.g. session-start) replace any model
    // SessionStart mapping because PLUGIN_INCOMPATIBLE filters link-coordination out first.
    const internal = PLUGIN_INTERNAL_HOOKS[event] ?? [];
    const combined = [...internal, ...mapped];
    if (combined.length) out[event] = combined;
  }
  // Also emit events that have ONLY plugin-internal entries (no model counterpart), so a pure
  // plugin-internal event isn't dropped when the model lacks it.
  for (const [event, entries] of Object.entries(PLUGIN_INTERNAL_HOOKS)) {
    if (!out[event]) out[event] = entries;
  }
  const ops = [
    { kind: 'json', path: 'plugin/hooks/hooks.json', value: { hooks: out } },
  ];
  if (incompatible.length) {
    ops.push({
      kind: 'note',
      message: `emitPlugin: ${incompatible.length} model hook(s) are NOT plugin-channel-compatible and were skipped (plugin/hooks/hooks.json does not carry them):\n    ${incompatible.join('\n    ')}`,
    });
  }
  if (unmappable.length) {
    ops.push({
      kind: 'note',
      message: `emitPlugin: ${unmappable.length} model hook command(s) did not match the plugin-channel shape \`bash "$CLAUDE_PROJECT_DIR/(.claude/hooks|scripts)/<name>.sh"\` and were NOT emitted to plugin/hooks/hooks.json. These need a plugin sibling script before they can reach zcode:\n    ${unmappable.join('\n    ')}`,
    });
  }
  return ops;
}

const EMITTERS = [
  { name: 'claude', emit: emitClaude },
  { name: 'zcode', presenceProbe: '.zcode/config.json', emit: emitZcode },
  {
    name: 'plugin',
    presenceProbe: 'plugin/hooks/hooks.json',
    emit: emitPlugin,
  },
];

const renderJson = (value) => JSON.stringify(value, null, 2) + '\n';
function mergedJson(root, op) {
  const p = join(root, op.path);
  // merge-json owns ONE key and byte-preserves the rest, so the file must pre-exist.
  // Fail with a readable message rather than a raw ENOENT stack trace (D2, cold-QA #894).
  if (!existsSync(p))
    throw new Error(
      `${op.path}: not found — merge owns only the "${op.key}" key and needs the file to pre-exist (create it first, even as '{}').`,
    );
  const obj = JSON.parse(readFileSync(p, 'utf8'));
  obj[op.key] = op.value;
  return renderJson(obj);
}

function applyOp(root, op) {
  if (op.kind === 'note') {
    console.error(`  ⚠ ${op.message}`);
    return;
  }
  const abs = join(root, op.path);
  // Ensure the parent dir exists for nested paths (e.g. .zcode/config.json). The symlink branch
  // already did this; the json branch relied on root-only paths and ENOENT'd once emitZcode moved
  // to .zcode/config.json (harness-config-drift N*/shape tests).
  if (op.kind === 'json' || op.kind === 'merge-json')
    mkdirSync(dirname(abs), { recursive: true });
  if (op.kind === 'json') writeFileSync(abs, renderJson(op.value));
  else if (op.kind === 'merge-json') writeFileSync(abs, mergedJson(root, op));
  else if (op.kind === 'symlink') {
    mkdirSync(dirname(abs), { recursive: true });
    // unlinkSync (not rmSync) to drop an existing link: rmSync FOLLOWS a
    // symlink-to-directory and throws ERR_FS_EISDIR on Node 24 — which would
    // crash every re-write (idempotency). unlink removes the link, never its target.
    if (isLink(abs)) unlinkSync(abs);
    else if (existsSync(abs)) rmSync(abs, { recursive: true, force: true });
    symlinkSync(op.target, abs);
  }
}

const isLink = (p) => {
  try {
    return lstatSync(p).isSymbolicLink();
  } catch {
    return false;
  }
};

/** Returns drift lines for one op ([] = clean). Assumes the op's emitter is not skipped. */
function checkOp(root, op) {
  if (op.kind === 'note') {
    console.error(`  ⚠ ${op.message}`);
    return [];
  }
  const abs = join(root, op.path);
  if (op.kind === 'json' || op.kind === 'merge-json') {
    if (!existsSync(abs))
      return op.optional ? [] : [`${op.path}: missing (run --write)`];
    const want =
      op.kind === 'json' ? renderJson(op.value) : mergedJson(root, op);
    return readFileSync(abs, 'utf8') === want
      ? []
      : [`${op.path}: drift vs SSOT`];
  }
  if (op.kind === 'symlink') {
    if (!isLink(abs))
      return op.optional && !existsSync(abs)
        ? [`${op.path}: symlink missing`]
        : [`${op.path}: not a symlink`];
    return readlinkSync(abs) === op.target
      ? []
      : [`${op.path}: symlink -> ${readlinkSync(abs)} (want ${op.target})`];
  }
  return [];
}

function findRoot(start) {
  let d = resolve(start);
  for (;;) {
    if (existsSync(join(d, '.ai-factory/harness-model.json'))) return d;
    const up = dirname(d);
    if (up === d)
      throw new Error(
        '.ai-factory/harness-model.json not found (walked to filesystem root). Pass --root <dir>.',
      );
    d = up;
  }
}

export function run(argv) {
  const mode = argv.includes('--check')
    ? 'check'
    : argv.includes('--write')
      ? 'write'
      : null;
  if (!mode) {
    console.error(
      'usage: render-harness-config.mjs (--write | --check) [--root <dir>]',
    );
    return 2;
  }
  const rootFlag = argv.indexOf('--root');
  const root =
    rootFlag !== -1 ? resolve(argv[rootFlag + 1]) : findRoot(process.cwd());

  let model;
  try {
    model = validateModel(
      JSON.parse(
        readFileSync(join(root, '.ai-factory/harness-model.json'), 'utf8'),
      ),
    );
  } catch (e) {
    console.error(`✗ ${e.message}`);
    return 1;
  }

  const drift = [];
  try {
    for (const em of EMITTERS) {
      const ops = em.emit(model, root);
      if (
        mode === 'check' &&
        em.presenceProbe &&
        !existsSync(join(root, em.presenceProbe))
      ) {
        console.error(
          `  ⓘ [${em.name}] ${em.presenceProbe} absent — skipping ${em.name} drift branch (gitignored shim; run --write to generate).`,
        );
        continue;
      }
      for (const op of ops) {
        if (mode === 'write') applyOp(root, op);
        else drift.push(...checkOp(root, op));
      }
    }
  } catch (e) {
    // A readable one-line error (e.g. merge target absent, D2) instead of a raw stack trace.
    console.error(`✗ ${e.message}`);
    return 1;
  }

  if (mode === 'write') {
    console.log(
      'render-harness-config: wrote CC + zcode config from .ai-factory/harness-model.json',
    );
    return 0;
  }
  if (drift.length) {
    console.error(
      '✗ harness-config drift:\n' + drift.map((d) => `    - ${d}`).join('\n'),
    );
    console.error(
      '  Fix: edit .ai-factory/harness-model.json (the SSOT), then run: node scripts/render-harness-config.mjs --write',
    );
    return 1;
  }
  console.log(
    '✓ harness-config up-to-date with .ai-factory/harness-model.json',
  );
  return 0;
}

// Entry-point guard: canonicalize BOTH sides through realpathSync. `import.meta.url`
// is already symlink-resolved by Node, but `process.argv[1]` is NOT — so a bare
// `resolve()` compare silently no-ops when the script is invoked via a symlinked path
// (e.g. a git worktree behind a symlinked ancestor — this repo uses worktrees +
// node_modules symlinks heavily), turning `--check` into a SILENT false-green: exactly
// the "fails loudly, not silently" property this gate exists to hold. Canonicalizing
// both sides makes the guard fire regardless of symlinks; the try/catch keeps
// import-as-module (argv[1] = the test runner, no match) from throwing on realpathSync.
function isMainEntry() {
  try {
    return (
      realpathSync(fileURLToPath(import.meta.url)) ===
      realpathSync(process.argv[1] ?? '')
    );
  } catch {
    return false;
  }
}
if (isMainEntry()) process.exit(run(process.argv.slice(2)));
