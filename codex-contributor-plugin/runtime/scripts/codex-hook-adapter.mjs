#!/usr/bin/env node
/**
 * codex-hook-adapter — adapt native Codex inputs to canonical contributor hook contracts.
 */
import {
  readFileSync,
  existsSync,
  mkdtempSync,
  writeFileSync,
  rmSync,
  realpathSync,
  lstatSync,
  readlinkSync,
} from 'node:fs';
import { resolve, join, dirname, relative, isAbsolute } from 'node:path';
import { tmpdir, homedir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { isMainEntry } from './lib/is-main-entry.mjs';

export function patchTargets(command, cwd) {
  if (typeof command !== 'string' || !command.startsWith('*** Begin Patch'))
    throw new Error('apply_patch input has no patch envelope');
  const targets = [];
  for (const line of command.split('\n')) {
    const match =
      /^\*\*\* (Add File|Update File|Delete File|Move to): (.+)$/.exec(line);
    if (!match) continue;
    targets.push({
      file_path: resolve(cwd, match[2].trim()),
      action: match[1],
      tool:
        match[1] === 'Add File' || match[1] === 'Move to' ? 'Write' : 'Edit',
    });
  }
  if (!targets.length)
    throw new Error('apply_patch input has no file operations');
  return targets;
}

export function canonicalTarget(target, depth = 0) {
  if (depth > 40) throw new Error('symlink resolution exceeded 40 hops');
  let ancestor = resolve(target);
  const present = (path) => {
    try {
      lstatSync(path);
      return true;
    } catch {
      return false;
    }
  };
  while (!present(ancestor) && dirname(ancestor) !== ancestor)
    ancestor = dirname(ancestor);
  let physical;
  try {
    physical = realpathSync(ancestor);
  } catch (error) {
    if (!lstatSync(ancestor).isSymbolicLink()) throw error;
    physical = canonicalTarget(
      resolve(dirname(ancestor), readlinkSync(ancestor)),
      depth + 1,
    );
  }
  return resolve(physical, relative(ancestor, resolve(target)));
}

// This is a literal argv recognizer, never a shell interpreter. Unsupported
// syntax remains unresolved even when the host's session cwd is supplied.
function literalShell(command) {
  if (typeof command !== 'string' || !command.trim() || command.includes('\0'))
    return null;
  const words = [];
  let word = '',
    quote = '',
    active = false;
  for (const c of command) {
    if (quote) {
      if (c === quote) quote = '';
      else if (quote === '"' && /[$`\\]/.test(c)) return null;
      else word += c;
      continue;
    }
    if (c === "'" || c === '"') {
      quote = c;
      active = true;
    } else if (/[\r\n;&|<>$`\\*?{}()[\]~#]/.test(c)) return null;
    else if (/\s/.test(c)) {
      if (active) {
        words.push(word);
        word = '';
        active = false;
      }
    } else {
      word += c;
      active = true;
    }
  }
  if (quote) return null;
  if (active) words.push(word);
  return words.length ? words : null;
}

function executorDiagnostic(input) {
  const executor = input.codex_raw_executor;
  if (!executor || executor.shell === undefined) return;
  if (
    ['bash', 'sh', 'zsh', '/bin/bash', '/bin/sh', '/bin/zsh'].includes(
      executor.shell,
    )
  )
    return;
  return `unresolved unsupported executor ${String(executor.shell)}; executor policy required`;
}

function shellReads(input) {
  const words = literalShell(input.tool_input?.command);
  if (!words) return { paths: [], diagnostic: 'unresolved shell syntax' };
  const [command, ...args] = words;
  if (!['cat', 'head', 'tail'].includes(command))
    return {
      paths: [],
      diagnostic:
        'unresolved shell file effects (supported readers: cat/head/tail)',
    };
  if (command !== 'cat' && args[0] === '-n') {
    args.shift();
    if (!/^[0-9]+$/.test(args.shift() ?? ''))
      return { paths: [], diagnostic: 'unresolved reader count' };
  }
  // cat treats a bare dash as stdin even after --; ./- names a file.
  if (command === 'cat' && args.includes('-'))
    return { paths: [], diagnostic: 'unresolved cat stdin operand' };
  const endOfOptions = args[0] === '--';
  if (endOfOptions) args.shift();
  if (
    !args.length ||
    args.some((a) => !a || (!endOfOptions && a.startsWith('-')))
  )
    return { paths: [], diagnostic: 'unresolved reader operands/options' };
  // Only the raw exec_command contract carries an effective workdir. Native
  // Bash {command} omits it; input.cwd is the session cwd, not execution proof.
  const cwd = input.codex_effective_cwd;
  if (args.some((a) => !isAbsolute(a)) && !cwd)
    return {
      paths: [],
      diagnostic: 'unresolved relative shell read: effective cwd unavailable',
    };
  return { paths: args.map((a) => (isAbsolute(a) ? a : resolve(cwd, a))) };
}

function wildcard(pattern, slash = false) {
  if (/[?\[\]{}()\\]/.test(pattern)) return null;
  const escaped = pattern
    .split(/(\*\*|\*)/)
    .map((part) =>
      part === '**'
        ? '.*'
        : part === '*'
          ? slash
            ? '[^/]*'
            : '.*'
          : part.replace(/[.+^$|]/g, '\\$&'),
    )
    .join('');
  return new RegExp(`^${escaped}$`);
}

function inputPolicy(variants, root) {
  const diagnostics = [];
  let deny;
  const settingsPath = join(root, '.claude/settings.json');
  // Fixture roots without settings still use this adapter's canonical source.
  const settings = JSON.parse(
    readFileSync(
      existsSync(settingsPath)
        ? settingsPath
        : resolve(
            dirname(fileURLToPath(import.meta.url)),
            '../.claude/settings.json',
          ),
      'utf8',
    ),
  );
  const rules = settings.permissions?.deny;
  if (!Array.isArray(rules))
    throw new Error('canonical permissions.deny is not an array');
  const compiled = rules.flatMap((rule) => {
    const match = /^(Bash|Read|Edit|Write)\((.+)\)$/.exec(rule);
    // NUL represents argv boundaries; literal whitespace inside one argument
    // cannot manufacture the fixed separators in a canonical Bash pattern.
    const regex =
      match &&
      wildcard(
        match[1] === 'Bash' ? match[2].replace(/\s+/g, '\0') : match[2],
        match[1] !== 'Bash',
      );
    if (!regex) {
      diagnostics.push(`unsupported deny rule: ${rule}`);
      return [];
    }
    return [{ tool: match[1], pattern: match[2], regex, rule }];
  });
  for (const v of variants) {
    const name = v.tool_name;
    if (!['Bash', 'Read', 'Edit', 'Write', 'MultiEdit'].includes(name)) {
      diagnostics.push(
        executorDiagnostic(v) ??
          `unsupported tool: ${name}; executor policy required`,
      );
      continue;
    }
    const reads = name === 'Bash' ? shellReads(v) : { paths: [] };
    if (reads.diagnostic) diagnostics.push(reads.diagnostic);
    const words = name === 'Bash' ? literalShell(v.tool_input?.command) : null;
    // The only admitted pipeline is a literal curl/wget download piped directly
    // to bash/sh. No command body, substitutions, redirects or compound grammar.
    const pipeline =
      name === 'Bash' &&
      /^(curl|wget) [^|]+ \| (bash|sh)$/.test(v.tool_input?.command ?? '') &&
      v.tool_input.command.split(' | ').every((part) => literalShell(part));
    const command = words?.join('\0');
    const pipelineCommand = pipeline
      ? v.tool_input.command
          .split(' | ')
          .flatMap((part, index) => [
            ...(index ? ['|'] : []),
            ...literalShell(part),
          ])
          .join('\0')
      : undefined;
    const effects =
      name === 'Bash'
        ? reads.paths.map((path) => ({ tool: 'Read', path }))
        : [
            {
              tool: name === 'MultiEdit' ? 'Edit' : name,
              path: v.tool_input?.file_path,
            },
          ];
    if (name !== 'Bash' && !effects[0].path)
      diagnostics.push(`unresolved ${name} target`);
    for (const r of compiled) {
      if (r.tool === 'Bash') {
        // A quoted pipe operand is never a pipeline effect.
        const candidate = r.pattern.includes(' | ') ? pipelineCommand : command;
        if (candidate && r.regex.test(candidate))
          deny ??= `Canonical deny ${r.rule}`;
        continue;
      }
      for (const effect of effects) {
        if (effect.tool !== r.tool || !effect.path) continue;
        const target = canonicalTarget(resolve(v.cwd ?? root, effect.path));
        const lexical = resolve(v.cwd ?? root, effect.path);
        const home = r.pattern.startsWith('~/');
        const pattern = home
          ? resolve(homedir(), r.pattern.slice(2))
          : r.pattern;
        const anchored = wildcard(
          canonicalTarget(home ? pattern : resolve(root, pattern)),
          true,
        );
        const matches = [lexical, target].some(
          (path) =>
            anchored.test(path) ||
            (!home &&
              !pattern.includes('/') &&
              r.regex.test(path.slice(path.lastIndexOf('/') + 1))),
        );
        if (matches) deny ??= `Canonical deny ${r.rule}: ${target}`;
      }
    }
  }
  return { deny, diagnostics: [...new Set(diagnostics)] };
}

export function normalizeInput(input) {
  const name = input.tool_name ?? '';
  if (name === 'apply_patch')
    return patchTargets(input.tool_input?.command, input.cwd).map((t) => ({
      ...input,
      tool_name: t.tool,
      tool_input: { ...input.tool_input, file_path: t.file_path },
      codex_patch_action: t.action,
    }));
  if (name === 'exec_command') {
    const codex_raw_executor = { tool: name, shell: input.tool_input?.shell };
    const unsupported = executorDiagnostic({ codex_raw_executor });
    return [
      {
        ...input,
        codex_raw_executor,
        tool_name: unsupported ? name : 'Bash',
        tool_input: {
          ...input.tool_input,
          command: input.tool_input?.cmd ?? input.tool_input?.command,
        },
        ...(isAbsolute(input.tool_input?.workdir ?? '')
          ? { codex_effective_cwd: input.tool_input.workdir }
          : {}),
      },
    ];
  }
  if (/request_user_input/.test(name))
    return [{ ...input, tool_name: 'AskUserQuestion' }];
  if (name === 'spawn_agent')
    return [
      {
        ...input,
        tool_name: 'Agent',
        tool_input: {
          ...input.tool_input,
          prompt: input.tool_input?.message ?? input.tool_input?.prompt,
        },
      },
    ];
  return [input];
}

// Stable hook payloads first; known rollout records only as a compatibility fallback.
// Unknown transcript records do not count as evidence of token usage or context size.
export function transcriptMessages(input, { evidence = false } = {}) {
  const records = [];
  const diagnostics = [];
  let source,
    lineNumber = 0,
    cycle = 0,
    activeTurn;
  const identities = new Map();
  const calls = new Set();
  const starts = new Map();
  let lastText;
  const pushNative = (record, completion) => {
    if (!evidence) {
      records.push(record);
      return;
    }
    const payload = source.payload ?? source;
    const block = record.message.content[0];
    const messageId = payload.id ?? source.id;
    const turnId = payload.turn_id ?? payload.item?.turn_id;
    const kind = `${source.type}:${payload.type}`;
    const human = record.type === 'user' && block.type === 'text';
    // A tool_result also has role=user, but cannot introduce a human turn.
    if (!human && typeof turnId === 'string' && turnId !== activeTurn)
      diagnostics.push(`unmatched turn identity at line ${lineNumber}`);
    if (block.type === 'text') {
      const text = block.text;
      const identity =
        typeof messageId === 'string' ? `${record.type}:${messageId}` : null;
      const conflict = (previous, compareIds) =>
        previous.text !== text ||
        previous.cycle !== cycle ||
        (typeof previous.turn_id === 'string' &&
          typeof turnId === 'string' &&
          previous.turn_id !== turnId) ||
        (typeof activeTurn === 'string' &&
          typeof turnId === 'string' &&
          activeTurn !== turnId) ||
        (compareIds &&
          typeof previous.message_id === 'string' &&
          typeof messageId === 'string' &&
          previous.message_id !== messageId);
      if (identity && identities.has(identity)) {
        if (conflict(identities.get(identity), false))
          diagnostics.push(
            `conflicting message identity at line ${lineNumber}`,
          );
        else if (human && activeTurn == null && typeof turnId === 'string')
          activeTurn = turnId;
        return;
      }
      if (
        lastText?.role === record.type &&
        lastText.text === text &&
        lastText.kind !== kind &&
        lastText.position === records.length
      ) {
        // Text equality cannot override contradictory explicit IDs or turns.
        if (conflict(lastText, true))
          diagnostics.push(
            `conflicting adjacent message identity at line ${lineNumber}`,
          );
        else {
          if (human && activeTurn == null && typeof turnId === 'string')
            activeTurn = turnId;
          if (identity)
            identities.set(identity, {
              ...lastText,
              message_id: messageId,
              turn_id: turnId ?? activeTurn,
            });
        }
        return;
      }
      // Without identities only adjacent cross-representation twins are safe;
      // a delayed human twin could also be a genuinely new turn.
      if (
        !identity &&
        lastText?.role === record.type &&
        lastText.text === text &&
        lastText.kind !== kind
      )
        diagnostics.push(`ambiguous duplicate message at line ${lineNumber}`);
      if (human) {
        cycle += 1;
        activeTurn = turnId;
      }
      lastText = {
        role: record.type,
        text,
        kind,
        cycle,
        message_id: messageId,
        turn_id: turnId ?? activeTurn,
        position: records.length + 1,
      };
      if (identity) identities.set(identity, lastText);
    }
    record.codex_evidence = {
      ...(typeof turnId === 'string' ? { turn_id: turnId } : {}),
      source: kind,
      line: lineNumber,
      cycle,
      ...(typeof messageId === 'string' ? { message_id: messageId } : {}),
      ...(completion ?? {}),
    };
    records.push(record);
  };
  const rememberStart = (id, turnId, startSource) => {
    if (typeof id !== 'string' || !id) {
      diagnostics.push(`unsupported start identity at line ${lineNumber}`);
      return;
    }
    if (!cycle || (typeof turnId === 'string' && turnId !== activeTurn))
      diagnostics.push(`unmatched start turn at line ${lineNumber}`);
    const observed = {
      cycle,
      turn_id: turnId ?? activeTurn,
      line: lineNumber,
      source: startSource,
    };
    const previous = starts.get(id);
    if (
      calls.has(id) ||
      (previous &&
        (previous.cycle !== cycle ||
          (typeof previous.turn_id === 'string' &&
            typeof observed.turn_id === 'string' &&
            previous.turn_id !== observed.turn_id)))
    ) {
      diagnostics.push(`conflicting start identity at line ${lineNumber}`);
      return;
    }
    if (!previous) starts.set(id, observed);
  };
  const transcript =
    input.hook_event_name === 'SubagentStop'
      ? (input.agent_transcript_path ?? input.transcript_path)
      : input.transcript_path;
  if (transcript && existsSync(transcript)) {
    for (const line of readFileSync(transcript, 'utf8').split('\n')) {
      lineNumber += 1;
      if (!line.trim()) continue;
      let r;
      try {
        r = JSON.parse(line);
      } catch {
        if (evidence) diagnostics.push(`malformed JSON at line ${lineNumber}`);
        continue;
      }
      if (!r || typeof r !== 'object') {
        if (evidence)
          diagnostics.push(`unsupported record at line ${lineNumber}`);
        continue;
      }
      source = r;
      if (r.message?.content && ['user', 'assistant'].includes(r.type)) {
        if (evidence)
          diagnostics.push(
            `unsupported legacy record in Codex input at line ${lineNumber}`,
          );
        records.push(r);
        continue;
      }
      const p = r.payload ?? r;
      // Validate both recognized placements before either join selects a turn.
      if (
        evidence &&
        r.type === 'event_msg' &&
        ['item_started', 'item_completed'].includes(p.type) &&
        typeof p.turn_id === 'string' &&
        typeof p.item?.turn_id === 'string' &&
        p.turn_id !== p.item.turn_id
      )
        diagnostics.push(
          `conflicting effect turn identity at line ${lineNumber}`,
        );
      // Observed native code-mode rollout emits nested effects as completed items.
      // Do not infer nested calls by parsing the code-mode JavaScript string.
      if (r.type === 'event_msg' && p.type === 'item_completed') {
        const item = p.item ?? {};
        let name, args;
        if (
          item.type === 'CommandExecution' &&
          Array.isArray(item.command) &&
          ['-lc', '-c'].includes(item.command[1]) &&
          typeof item.command[2] === 'string'
        ) {
          name = 'Bash';
          args = { command: item.command[2] };
        } else if (
          item.type === 'McpToolCall' &&
          typeof item.server === 'string' &&
          typeof item.tool === 'string'
        ) {
          name = `mcp__${item.server}__${item.tool}`;
          args = item.arguments ?? {};
        }
        if (name && typeof item.id === 'string') {
          const started = evidence ? starts.get(item.id) : undefined;
          const turnId = p.turn_id ?? item.turn_id;
          if (
            started &&
            (started.cycle !== cycle ||
              (typeof started.turn_id === 'string' &&
                typeof turnId === 'string' &&
                started.turn_id !== turnId))
          )
            diagnostics.push(
              `completion conflicts with observed start at line ${lineNumber}`,
            );
          if (evidence && calls.has(item.id))
            diagnostics.push(`replayed call identity at line ${lineNumber}`);
          calls.add(item.id);
          if (
            evidence &&
            ![
              'completed',
              'failed',
              'in_progress',
              'pending',
              'cancelled',
              'interrupted',
            ].includes(item.status)
          )
            diagnostics.push(
              `unsupported completion status at line ${lineNumber}`,
            );
          const completion = {
            ...(started
              ? {
                  start_cycle: started.cycle,
                  start_line: started.line,
                  start_source: started.source,
                  ...(typeof started.turn_id === 'string'
                    ? { start_turn_id: started.turn_id }
                    : {}),
                }
              : {}),
            call_id: item.id,
            status: item.status ?? null,
            exit_code: item.exit_code ?? null,
            success:
              item.status === 'completed' &&
              (item.type === 'CommandExecution'
                ? item.exit_code === 0
                : item.result != null &&
                  !item.error &&
                  item.result.isError !== true),
          };
          pushNative(
            {
              type: 'assistant',
              message: {
                role: 'assistant',
                content: [{ type: 'tool_use', id: item.id, name, input: args }],
              },
            },
            completion,
          );
          pushNative(
            {
              type: 'user',
              message: {
                role: 'user',
                content: [
                  {
                    type: 'tool_result',
                    tool_use_id: item.id,
                    is_error: item.status === 'failed',
                    content:
                      item.aggregated_output ??
                      JSON.stringify(item.result ?? item.error ?? null),
                  },
                ],
              },
            },
            completion,
          );
        } else if (evidence)
          diagnostics.push(
            `unsupported completed effect at line ${lineNumber}`,
          );
      } else if (r.type === 'event_msg' && p.type === 'token_count') {
        const usage = p.info?.last_token_usage;
        // Native input includes cached reads. Source checks sum the three CC
        // fields, so subtract cached reads once; cumulative totals are not context.
        if (
          usage &&
          Number.isSafeInteger(usage.input_tokens) &&
          usage.input_tokens >= 0 &&
          Number.isSafeInteger(usage.cached_input_tokens) &&
          usage.cached_input_tokens >= 0 &&
          usage.cached_input_tokens <= usage.input_tokens
        ) {
          // Preserve the final report as the last assistant record. An empty
          // usage-only message would hide it from transcript-fallback report checks.
          const assistant = records.findLast(
            (record) => record.type === 'assistant',
          );
          if (assistant) {
            const window = p.info?.model_context_window;
            if (Number.isSafeInteger(window) && window > 0)
              assistant.codex_context_window = window;
            else delete assistant.codex_context_window;
            assistant.message.usage = {
              input_tokens: usage.input_tokens - usage.cached_input_tokens,
              cache_read_input_tokens: usage.cached_input_tokens,
              cache_creation_input_tokens: 0,
            };
          }
        }
      } else if (
        evidence &&
        r.type === 'event_msg' &&
        p.type === 'item_started'
      ) {
        const item = p.item ?? {};
        if (['CommandExecution', 'McpToolCall'].includes(item.type))
          rememberStart(
            item.id,
            p.turn_id ?? item.turn_id,
            'event_msg:item_started',
          );
        else
          diagnostics.push(`unsupported started effect at line ${lineNumber}`);
      } else if (
        evidence &&
        r.type === 'response_item' &&
        p.type === 'function_call'
      ) {
        rememberStart(p.call_id, p.turn_id, 'response_item:function_call');
      }
      if (
        r.type === 'response_item' &&
        p.type === 'message' &&
        ['user', 'assistant'].includes(p.role)
      ) {
        const text = (p.content ?? []).map((c) => c.text ?? '').join('\n');
        if (text)
          pushNative({
            type: p.role,
            message: { role: p.role, content: [{ type: 'text', text }] },
          });
        else if (evidence)
          diagnostics.push(`malformed native message at line ${lineNumber}`);
      } else if (
        r.type === 'event_msg' &&
        ['agent_message', 'user_message'].includes(p.type)
      ) {
        const role = p.type === 'agent_message' ? 'assistant' : 'user';
        if (typeof p.message === 'string' && (!evidence || p.message.trim()))
          pushNative({
            type: role,
            message: { role, content: [{ type: 'text', text: p.message }] },
          });
        else if (evidence)
          diagnostics.push(`malformed native message at line ${lineNumber}`);
      } else if (
        evidence &&
        !(
          (r.type === 'event_msg' &&
            [
              'item_completed',
              'token_count',
              'task_started',
              'task_complete',
              'turn_aborted',
              'context_compacted',
              'item_started',
            ].includes(p.type)) ||
          (r.type === 'response_item' &&
            ['function_call', 'function_call_output', 'reasoning'].includes(
              p.type,
            )) ||
          ['session_meta', 'turn_context', 'compacted'].includes(r.type)
        )
      )
        diagnostics.push(
          `unsupported record ${r.type}:${p.type ?? '?'} at line ${lineNumber}`,
        );
    }
  } else if (evidence) diagnostics.push('missing transcript');
  if (typeof input.prompt === 'string')
    records.push({
      type: 'user',
      message: { content: [{ type: 'text', text: input.prompt }] },
    });
  if (typeof input.last_assistant_message === 'string')
    records.push({
      type: 'assistant',
      message: {
        content: [{ type: 'text', text: input.last_assistant_message }],
      },
    });
  return evidence ? { records, diagnostics } : records;
}

export function runHook(root, script, input) {
  const env = {
    ...process.env,
    CLAUDE_PROJECT_DIR: root,
    AIF_HARNESS: 'codex',
  };
  // The operator's declaration wins; native window is validated at rollout adaptation.
  if (
    !env.AIF_CTX_WINDOW &&
    Number.isSafeInteger(input.codex_context_window) &&
    input.codex_context_window > 0
  )
    env.AIF_CTX_WINDOW = String(input.codex_context_window);
  // Do not select the ZCode output/de-dup path because of inherited operator env.
  delete env.ZCODE_PROJECT_DIR;
  const path =
    script === 'link-coordination'
      ? join(root, 'scripts', `${script}.sh`)
      : join(root, '.claude/hooks', `${script}.sh`);
  if (!existsSync(path))
    return { status: 2, stdout: '', stderr: `Codex hook missing: ${path}` };
  const languageResolver = resolve(
    dirname(fileURLToPath(import.meta.url)),
    '../plugin/hooks/lib/hook-language.sh',
  );
  const result = spawnSync(
    'bash',
    [
      '-c',
      '. "$1" || exit 2; shift; exec bash "$@"',
      'codex-hook',
      languageResolver,
      path,
    ],
    {
      cwd: root,
      env,
      input: JSON.stringify(input),
      encoding: 'utf8',
      timeout: script === 'link-coordination' ? 300000 : 30000,
      maxBuffer: 8 * 1024 * 1024,
    },
  );
  // Preserve the canonical SessionStart registration's explicit `|| true`.
  // Coordination conflicts are advisory; executable gates retain their exit status.
  if (script === 'link-coordination') {
    result.stdout = '';
    if (input.hook_event_name === 'SessionStart' && result.status > 0) {
      let nonblocking = false;
      try {
        const model = JSON.parse(
          readFileSync(join(root, '.ai-factory/harness-model.json'), 'utf8'),
        );
        nonblocking = (model.hooks?.SessionStart ?? []).some(
          (entry) =>
            entry.command.includes(
              '"$CLAUDE_PROJECT_DIR/scripts/link-coordination.sh"',
            ) && entry.command.trimEnd().endsWith('|| true'),
        );
      } catch {
        // Missing or malformed policy never downgrades a failure.
      }
      if (nonblocking) {
        result.status = 0;
        result.stdout = JSON.stringify({
          hookSpecificOutput: {
            hookEventName: 'SessionStart',
            additionalContext: `[coordination warning] Startup continued under the canonical nonblocking registration. Coordination did not complete; inspect the diagnostic before relying on shared files.\n${result.stderr}`,
          },
        });
        result.stderr = '';
      }
    }
  }
  return result;
}

export function dispatch(input, script, root) {
  const event = input.hook_event_name;
  // Honor the native Stop retry guard before transcript or helper adaptation.
  // Otherwise an infrastructure error can loop before the canonical guard runs.
  if (event === 'Stop' && input.stop_hook_active === true)
    return { status: 0, stdout: '', stderr: '' };
  let variants;
  try {
    variants = normalizeInput(input);
  } catch (e) {
    return {
      status: 2,
      stderr: `Codex hook adaptation failed: ${e.message}`,
      stdout: '',
    };
  }
  const policyDiagnostics = [];
  if (script === 'seal-primary-checkout' && event === 'PreToolUse') {
    let policy;
    try {
      policy = inputPolicy(variants, root);
    } catch (error) {
      return {
        status: 2,
        stderr: `Codex input policy unavailable: ${error.message}`,
        stdout: '',
      };
    }
    policyDiagnostics.push(...policy.diagnostics);
    if (policy.deny)
      return {
        status: 0,
        stderr: policyDiagnostics
          .map((d) => `Codex input policy: ${d}`)
          .join('\n'),
        stdout: JSON.stringify({
          hookSpecificOutput: {
            hookEventName: event,
            permissionDecision: 'deny',
            permissionDecisionReason: policy.deny,
          },
        }),
      };
  }
  if (
    script === 'inject-matching-rule' &&
    ['PreToolUse', 'PostToolUse'].includes(event)
  ) {
    const readers = [];
    for (const v of variants) {
      const unsupported = executorDiagnostic(v);
      if (unsupported) {
        policyDiagnostics.push(unsupported);
        continue;
      }
      if (v.tool_name !== 'Bash') continue;
      const reads = shellReads(v);
      if (reads.diagnostic) policyDiagnostics.push(reads.diagnostic);
      readers.push(
        ...reads.paths.map((file_path) => ({
          ...v,
          hook_event_name: 'PostToolUse',
          tool_name: 'Read',
          tool_input: { file_path },
        })),
      );
    }
    variants.push(...readers);
  }
  // CC project deny-list protects the current checkout; its primary-checkout hook
  // protects the linked original. Codex needs both halves at this seam.
  if (script === 'seal-primary-checkout' && event === 'PreToolUse') {
    for (const variant of variants) {
      if (!['Edit', 'Write', 'MultiEdit'].includes(variant.tool_name)) continue;
      const target = variant.tool_input?.file_path;
      if (!target) continue;
      const canonical = canonicalTarget(resolve(variant.cwd ?? root, target));
      const canonicalRoot = realpathSync(root);
      const targetRelative = relative(canonicalRoot, canonical);
      if (
        /^(\.claude\/settings(?:\.local)?\.json(?:\/|$)|\.husky(?:\/|$)|\.git\/hooks(?:\/|$))/.test(
          targetRelative,
        )
      ) {
        return {
          status: 0,
          stderr: policyDiagnostics
            .map((d) => `Codex input policy: ${d}`)
            .join('\n'),
          stdout: JSON.stringify({
            hookSpecificOutput: {
              hookEventName: event,
              permissionDecision: 'deny',
              permissionDecisionReason: `Operator-owned configuration is sealed: ${canonical}`,
            },
          }),
        };
      }
    }
  }
  let temp;
  const contexts = [],
    errors = [];
  let decision;
  try {
    if (['Stop', 'SubagentStop', 'PreCompact'].includes(event)) {
      temp = mkdtempSync(join(tmpdir(), 'getff-codex-transcript-'));
      const messages = transcriptMessages(input);
      const nativeWindow = messages.findLast(
        (r) => r.message?.usage,
      )?.codex_context_window;
      writeFileSync(
        join(temp, 'transcript.jsonl'),
        messages.map((r) => JSON.stringify(r)).join('\n') + '\n',
      );
      variants = variants.map((v) => ({
        ...v,
        transcript_path: join(temp, 'transcript.jsonl'),
        codex_context_window: nativeWindow,
        ...(event === 'SubagentStop'
          ? { agent_transcript_path: join(temp, 'transcript.jsonl') }
          : {}),
      }));
    }
    for (const variant of variants) {
      const result = runHook(root, script, variant);
      if (result.error || result.status === null)
        errors.push(`${script}: ${result.error?.message ?? 'terminated'}`);
      else if (result.status !== 0)
        errors.push(result.stderr || `${script}: exit ${result.status}`);
      const stdout = result.stdout?.trim();
      if (!stdout) continue;
      let output;
      try {
        output = JSON.parse(stdout);
      } catch {
        if (
          [
            'SessionStart',
            'SubagentStart',
            'UserPromptSubmit',
            'PreCompact',
            'Stop',
          ].includes(event)
        )
          contexts.push(stdout);
        else errors.push(`${script}: invalid JSON output`);
        continue;
      }
      const h = output.hookSpecificOutput ?? {};
      const ctx =
        h.additionalContext ?? output.additionalContext ?? output.systemMessage;
      if (ctx) contexts.push(ctx);
      if (h.permissionDecision === 'deny')
        decision = {
          permissionDecision: 'deny',
          permissionDecisionReason: h.permissionDecisionReason,
        };
      if (output.decision === 'block' || output.continue === false)
        errors.push(output.reason ?? output.stopReason ?? `${script}: blocked`);
    }
    if (decision && event === 'PreToolUse')
      return {
        status: 0,
        stderr: [
          ...errors,
          ...policyDiagnostics.map((d) => `Codex input policy: ${d}`),
        ].join('\n'),
        stdout: JSON.stringify({
          hookSpecificOutput: { hookEventName: event, ...decision },
        }),
      };
    if (errors.length)
      return {
        status: 2,
        stderr: [...errors, ...contexts].join('\n'),
        stdout: '',
      };
    return {
      status: 0,
      stderr: policyDiagnostics
        .map((d) => `Codex input policy: ${d}`)
        .join('\n'),
      stdout: contexts.length
        ? JSON.stringify({
            hookSpecificOutput: {
              hookEventName: event,
              additionalContext: [...new Set(contexts)].join('\n'),
            },
          })
        : '',
    };
  } finally {
    if (temp) rmSync(temp, { recursive: true, force: true });
  }
}

if (isMainEntry(import.meta.url)) {
  try {
    const input = JSON.parse(readFileSync(0, 'utf8'));
    // Packaged adapters bind canonical hooks to the active checkout, not the
    // plugin cache. Direct local invocations retain their original root default.
    const root = realpathSync(
      resolve(
        process.argv[3] ??
          resolve(dirname(fileURLToPath(import.meta.url)), '..'),
      ),
    );
    if (resolve(input.cwd ?? '.') !== root) {
      const gitRoot = spawnSync(
        'git',
        ['-C', input.cwd ?? '.', 'rev-parse', '--show-toplevel'],
        { encoding: 'utf8' },
      );
      if (
        !gitRoot.stdout?.trim() ||
        realpathSync(gitRoot.stdout.trim()) !== root
      )
        process.exit(0);
    }
    const script = process.argv[2];
    if (!/^[a-z][a-z0-9-]*$/.test(script ?? ''))
      throw new Error('expected canonical hook basename');
    const result = dispatch(input, script, root);
    if (result.stdout) process.stdout.write(result.stdout + '\n');
    if (result.stderr) process.stderr.write(result.stderr + '\n');
    process.exitCode = result.status;
  } catch (e) {
    process.stderr.write(`Codex hook: ${e.message}\n`);
    process.exitCode = 2;
  }
}
