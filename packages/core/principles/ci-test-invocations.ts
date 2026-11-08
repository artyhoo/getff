/** Bounded CI invocation inventory, shared by P38/P41 (SSOT prior-art #248).
 * YAML supplies run steps; this is deliberately NOT a shell reachability analyzer.
 * Literal commands, cwd changes, && lists, env and recursive npm wrappers are supported.
 * Unsupported control flow contributes no coverage. Diagnostics name the rejected shape.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve, posix } from 'node:path';
import yaml from 'js-yaml';
import picomatch from 'picomatch';
import ts from 'typescript';

export const ROOT = resolve(import.meta.dirname, '../../..');
export const tracked = (): string[] =>
  execFileSync('git', ['ls-files', '-z'], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  })
    .split('\0')
    .filter(Boolean);
export const read = (path: string): string =>
  readFileSync(resolve(ROOT, path), 'utf8');
export const workflows = (): string[] =>
  readdirSync(resolve(ROOT, '.github/workflows'))
    .filter((f) => /\.ya?ml$/.test(f))
    .map((f) => read(`.github/workflows/${f}`));
export interface Invocation {
  runner: 'vitest' | 'node' | 'python' | 'shell';
  cwd: string;
  args: string[];
  config?: string;
}
export interface Registry {
  calls: Invocation[];
  unsupported: string[];
}
const repoPath = (cwd: string, path: string): string => {
  if (path.startsWith('/')) {
    if (!path.startsWith(`${ROOT}/`)) return '__outside_repository__';
    return path.slice(ROOT.length + 1);
  }
  const normalized = posix
    .normalize(posix.join(cwd, path))
    .replace(/^\.\//, '');
  return normalized.startsWith('../') ? '__outside_repository__' : normalized;
};

// Quoting is preserved for spaces; expansions, redirections and substitutions are rejected.
function words(command: string): string[] | null {
  const out: string[] = [];
  let word = '';
  let quote = '';
  let started = false;
  for (let i = 0; i < command.length; i++) {
    const c = command[i];
    if (quote) {
      if (c === quote) quote = '';
      else {
        if (quote === '"' && /[$`\\]/.test(c)) return null;
        word += c;
      }
      continue;
    }
    if (c === '#' && !started) break;
    if (c === '"' || c === "'") {
      quote = c;
      started = true;
    } else if (/\s/.test(c)) {
      if (started) out.push(word);
      word = '';
      started = false;
    } else if (/[$`\\<>|&;(){}]/.test(c)) return null;
    else {
      word += c;
      started = true;
    }
  }
  if (quote) return null;
  if (started) out.push(word);
  return out;
}
function statements(source: string): string[] {
  // Split only unquoted separators. A heredoc rejects the entire run block: its body is data.
  if (/<<|`|\$\(/.test(source)) return [];
  const out: string[] = [];
  let quote = '';
  let item = '';
  let comment = false;
  source = source.replace(/\\\n/g, ' ');
  for (let i = 0; i < source.length; i++) {
    const c = source[i];
    if (comment) {
      if (c !== '\n') continue;
      comment = false;
    }
    if (quote) {
      item += c;
      if (c === quote) quote = '';
      continue;
    }
    if (c === '"' || c === "'") {
      quote = c;
      item += c;
      continue;
    }
    if (c === '#' && (!item || /\s$/.test(item))) {
      comment = true;
      continue;
    }
    if (c === '\n' || c === ';' || source.slice(i, i + 2) === '&&') {
      if (item.trim()) out.push(item.trim());
      item = '';
      if (c === '&') i++;
    } else item += c;
  }
  if (item.trim()) out.push(item.trim());
  return quote ? [] : out;
}

export function commands(
  source: string,
  cwd = '.',
  registry: Registry = { calls: [], unsupported: [] },
  scriptReader: (pkg: string) => Record<string, string> = (pkg) =>
    JSON.parse(read(repoPath(pkg, 'package.json'))).scripts ?? {},
  stack: string[] = [],
): Registry {
  const reject = (s: string): void => {
    registry.unsupported.push(`${cwd}: ${s}`);
  };
  const parts = statements(source);
  if (!parts.length && source.trim()) {
    reject('unsupported shell block (heredoc/substitution/quotes)');
    return registry;
  }
  let blocked = 0;
  let stopped = false;
  for (let part of parts) {
    // Only the existing optional interpreter checks are understood. Their else arm never
    // supplies coverage; environment availability remains the actual job's responsibility.
    if (/^if command -v (zsh|python3) >\/dev\/null 2>&1$/.test(part)) continue;
    if (/^(if|for|while|case|function)\b/.test(part)) {
      blocked++;
      reject(part);
      continue;
    }
    if (/^(fi|done|esac)$/.test(part)) {
      blocked = Math.max(0, blocked - 1);
      continue;
    }
    if (/^else\b/.test(part)) {
      stopped = true;
      continue;
    }
    if (blocked || stopped) continue;
    part = part.replace(/^then\s+/, '');
    // Existing audit steps pipe a literal test command to tee for retained diagnostics.
    // Only this terminal output sink is accepted; arbitrary pipelines stay unsupported.
    part = part.replace(/\s+\|\s+tee\s+"\$RUNNER_TEMP\/[A-Za-z0-9._-]+"$/, '');
    part = part.replace(
      /^(?:[A-Za-z_][A-Za-z0-9_]*=(?:"[^"`]*"|'[^']*'|[^\s$`]+)\s+)+/,
      '',
    );
    const argv = words(part);
    if (!argv) {
      reject(part);
      if (/^(cd|!|eval|exec)\b|[{}()]|\|\|/.test(part)) stopped = true;
      continue;
    }
    while (argv[0] === 'env' || /^[A-Za-z_][A-Za-z0-9_]*=/.test(argv[0] ?? ''))
      argv.shift();
    if (!argv.length) continue;
    const [bin, ...args] = argv;
    if (['!', 'eval', 'exec', 'source', '.'].includes(bin)) {
      reject(part);
      stopped = true;
      continue;
    }
    if (bin === 'false' || bin === 'exit' || bin === 'return') {
      stopped = true;
      continue;
    }
    if (bin === 'cd') {
      if (args.length !== 1 || args[0].startsWith('-')) {
        reject(part);
        stopped = true;
      } else cwd = repoPath(cwd, args[0]);
      continue;
    }
    if (bin === 'npm') {
      const rest = [...args];
      let pkg = cwd;
      const prefix = rest.indexOf('--prefix');
      if (prefix !== -1) {
        pkg = repoPath(cwd, rest[prefix + 1] ?? '');
        rest.splice(prefix, 2);
      }
      const action = rest.shift();
      if (action !== 'run' && action !== 'test') continue;
      const script = action === 'test' ? 'test' : rest.shift();
      const key = `${pkg}:${script}`;
      if (!script || stack.includes(key) || stack.length >= 12) {
        reject(`npm script cycle/limit ${key}`);
        continue;
      }
      const dash = rest.indexOf('--');
      const passed =
        dash < 0 ? rest.filter((a) => a !== '--silent') : rest.slice(dash + 1);
      if (
        rest
          .slice(0, dash < 0 ? undefined : dash)
          .some((a) => a.startsWith('-') && a !== '--silent')
      ) {
        reject(part);
        continue;
      }
      try {
        const body = scriptReader(pkg)[script];
        if (!body) reject(`missing npm script ${key}`);
        else
          commands(
            `${body} ${passed.map((a) => JSON.stringify(a)).join(' ')}`,
            pkg,
            registry,
            scriptReader,
            [...stack, key],
          );
      } catch {
        reject(`unreadable npm package ${pkg}`);
      }
      continue;
    }
    let runner = bin;
    let rest = [...args];
    if (bin === 'npx') {
      // --prefix controls binary lookup, NOT cwd/config selection.
      if (rest[0] === '--prefix') rest.splice(0, 2);
      if (rest[0] === '--no-install') rest.shift();
      runner = rest.shift() ?? '';
    }
    if (runner === 'vitest' && rest.shift() === 'run') {
      let config: string | undefined;
      const filters: string[] = [];
      let valid = true;
      for (let i = 0; i < rest.length; i++) {
        const a = rest[i];
        if (a === '--config') config = repoPath(cwd, rest[++i] ?? '');
        else if (a.startsWith('--config=')) config = repoPath(cwd, a.slice(9));
        else if (/^--reporter=/.test(a)) continue;
        else if (a.startsWith('-')) valid = false;
        else filters.push(a);
      }
      if (valid)
        registry.calls.push({ runner: 'vitest', cwd, args: filters, config });
      else reject(`unsupported vitest options: ${part}`);
    } else if (runner === 'node' && rest.includes('--test')) {
      if (rest.some((a) => a.startsWith('--test-name-pattern'))) continue; // subset, never whole-suite credit
      const files = rest.filter((a) => !a.startsWith('-'));
      if (
        rest.every(
          (a) =>
            !a.startsWith('-') ||
            ['--test', '--experimental-strip-types'].includes(a),
        )
      )
        registry.calls.push({ runner: 'node', cwd, args: files });
      else reject(part);
    } else if (runner === 'python3' || runner === 'python') {
      if (
        rest.length === 1 &&
        rest[0].endsWith('.py') &&
        !/[*?\[\]{}]/.test(rest[0])
      )
        registry.calls.push({ runner: 'python', cwd, args: rest });
      else reject(part);
    } else if (runner === 'bash' || runner === 'sh') {
      if (
        rest.length === 1 &&
        rest[0].endsWith('.sh') &&
        !/[*?\[\]{}]/.test(rest[0])
      )
        registry.calls.push({ runner: 'shell', cwd, args: rest });
    } else if (/^(\.\/)?[\w./-]+\.sh$/.test(runner) && !rest.length) {
      registry.calls.push({ runner: 'shell', cwd, args: [runner] });
    }
  }
  return registry;
}

// Only the existing recurring path/event guards are credited. Matrix/unknown conditions
// require their own reviewed execution evidence; a syntactically present run is insufficient.
function supportedCondition(value: unknown): boolean {
  if (value === undefined || value === true) return true;
  const condition = String(value)
    .replace(/^\s*\$\{\{\s*|\s*\}\}\s*$/g, '')
    .trim();
  return [
    'true',
    'always()',
    "needs.path-scope.outputs.runtime == 'true'",
    "needs.path-scope.outputs.install == 'true'",
    "github.event_name == 'pull_request'",
    "github.event_name == 'push'",
  ].includes(condition);
}

export function workflowRegistry(
  sources = workflows(),
  scriptReader?: (pkg: string) => Record<string, string>,
): Registry {
  const registry: Registry = { calls: [], unsupported: [] };
  for (const source of sources) {
    const wf = yaml.load(source) as any;
    if (!wf || typeof wf !== 'object' || !wf.jobs) {
      registry.unsupported.push('missing YAML jobs');
      continue;
    }
    for (const job of Object.values(wf.jobs) as any[]) {
      if (!supportedCondition(job.if)) {
        registry.unsupported.push(`unsupported job condition: ${job.if}`);
        continue;
      }
      for (const step of job.steps ?? []) {
        if (typeof step.run !== 'string') continue;
        if (!supportedCondition(step.if)) {
          registry.unsupported.push(`unsupported step condition: ${step.if}`);
          continue;
        }
        const cwd =
          step['working-directory'] ??
          job.defaults?.run?.['working-directory'] ??
          wf.defaults?.run?.['working-directory'] ??
          '.';
        if (typeof cwd !== 'string' || /[$`]/.test(cwd)) {
          registry.unsupported.push('dynamic cwd');
          continue;
        }
        commands(step.run, cwd, registry, scriptReader);
      }
    }
  }
  return registry;
}

export function literalArray(
  source: string,
  property: string,
  absent: string[] | null = null,
): string[] | null {
  const file = ts.createSourceFile(
    'config.ts',
    source,
    ts.ScriptTarget.Latest,
    true,
  );
  const declaration = file.statements.find(ts.isExportAssignment);
  if (!declaration) return null;
  let expression = declaration.expression;
  if (
    ts.isCallExpression(expression) &&
    expression.expression.getText(file) === 'defineConfig' &&
    expression.arguments.length === 1
  )
    expression = expression.arguments[0];
  if (
    !ts.isObjectLiteralExpression(expression) ||
    expression.properties.some(ts.isSpreadAssignment)
  )
    return null;
  const name = (p: ts.ObjectLiteralElementLike): string =>
    p.name && (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name))
      ? p.name.text
      : '';
  // Config root/projects/extends need a separate reviewed model; silently using package cwd
  // for those shapes could invent a population or borrow a sibling's invocation.
  if (expression.properties.some((p) => ['root', 'extends'].includes(name(p))))
    return null;
  const tests = expression.properties.filter((p) => name(p) === 'test');
  if (
    tests.length !== 1 ||
    !ts.isPropertyAssignment(tests[0]) ||
    !ts.isObjectLiteralExpression(tests[0].initializer)
  )
    return null;
  const test = tests[0].initializer;
  if (
    test.properties.some(
      (p) =>
        ts.isSpreadAssignment(p) ||
        ['root', 'projects', 'workspace'].includes(name(p)),
    )
  )
    return null;
  const properties = test.properties.filter((p) => name(p) === property);
  if (properties.length === 0) return property === 'exclude' ? [] : absent;
  if (properties.length !== 1 || !ts.isPropertyAssignment(properties[0]))
    return null;
  const value = properties[0].initializer;
  return ts.isArrayLiteralExpression(value) &&
    value.elements.every(ts.isStringLiteral)
    ? value.elements.map((n) => (n as ts.StringLiteral).text)
    : null;
}

export interface Workspace {
  config: string;
  cwd: string;
  files: string[];
}
export function populations(files = tracked()): Workspace[] {
  return files
    .filter((f) => /^packages\/[^/]+\/vitest\.config\.ts$/.test(f))
    .map((config) => {
      const cwd = posix.dirname(config);
      const source = read(config);
      const include = literalArray(source, 'include');
      if (include === null)
        throw new Error(`Unsupported/missing literal test.include: ${config}`);
      const exclude = literalArray(source, 'exclude');
      if (exclude === null)
        throw new Error(`Unsupported literal test.exclude: ${config}`);
      const match = picomatch(include, { dot: true });
      const omit = picomatch(exclude, { dot: true });
      return {
        config,
        cwd,
        files: files.filter(
          (f) =>
            f.startsWith(`${cwd}/`) &&
            match(f.slice(cwd.length + 1)) &&
            !omit(f.slice(cwd.length + 1)),
        ),
      };
    });
}
export function selected(
  file: string,
  call: Invocation,
  population: Workspace,
): boolean {
  if (call.runner !== 'vitest') return false;
  const config = call.config ?? repoPath(call.cwd, 'vitest.config.ts');
  if (config !== population.config && config !== 'vitest.config.ts')
    return false;
  // Root config defaults differ from core's explicit *.audit.ts population. Unknown
  // config expressions contribute no selection, including dynamic includes/excludes.
  if (config === 'vitest.config.ts') {
    const source = read(config);
    const include = literalArray(source, 'include', [
      '**/*.{test,spec}.?(c|m)[jt]s?(x)',
    ]);
    const exclude = literalArray(source, 'exclude');
    if (
      include === null ||
      exclude === null ||
      !picomatch(include, { dot: true })(file) ||
      picomatch(exclude, { dot: true })(file)
    )
      return false;
  }
  const path = `/${file}`;
  return !call.args.length || call.args.some((filter) => path.includes(filter));
}
export function nativeCovered(file: string, calls: Invocation[]): boolean {
  const runner = file.endsWith('.sh')
    ? 'shell'
    : file.endsWith('.py')
      ? 'python'
      : 'node';
  return calls.some(
    (call) =>
      call.runner === runner &&
      call.args.some((arg) =>
        picomatch(repoPath(call.cwd, arg), { dot: true })(file),
      ),
  );
}
