/** Emit only the admitted local economy payload. Never execute source or install it. */
import ts from 'typescript';
import { createHash } from 'node:crypto';
import { builtinModules } from 'node:module';
import {
  chmodSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from 'node:fs';
import {
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
  sep,
  posix,
} from 'node:path';
import { userInfo } from 'node:os';
import { fileURLToPath } from 'node:url';

// Keep this explicit: source typecheck/npm package assembly have different owners.
const modules = [
  'AifHandoffBackend',
  'ManualBackend',
  'aifWsStatus',
  'backend',
  'cli/aifHttp',
  'cli/await',
  'cli/cliEntry',
  'cli/ensure-parallel',
  'cli/openQuestion',
  'cli/park',
  'cli/questions',
  'cli/supervision',
  'resolver',
  'resultReview',
  'types',
];
const sourceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../src');
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
function present(path) {
  try {
    lstatSync(path);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}
function canonical(path) {
  if (present(path)) return realpathSync(path);
  const parent = dirname(path);
  if (parent === path) throw new Error(`cannot resolve output ${path}`);
  return join(
    canonical(parent),
    path.slice(parent.length + (parent.endsWith(sep) ? 0 : 1)),
  );
}
function within(path, ancestor) {
  const rel = relative(ancestor, path);
  return (
    rel === '' ||
    (!rel.startsWith('..' + sep) && rel !== '..' && !isAbsolute(rel))
  );
}
function checkImports(text, name) {
  const file = ts.createSourceFile(
    name + '.js',
    text,
    ts.ScriptTarget.ES2022,
    true,
    ts.ScriptKind.JS,
  );
  const allowed = new Set(modules.map((x) => x + '.js'));
  function check(specifier) {
    if (
      specifier.startsWith('node:') &&
      builtinModules.includes(specifier.slice(5))
    )
      return;
    const member = posix.normalize(posix.join(posix.dirname(name), specifier));
    if (!specifier.startsWith('.') || !allowed.has(member))
      throw new Error(
        `import outside economy closure: ${name} -> ${specifier}`,
      );
  }
  function visit(node) {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier
    )
      check(node.moduleSpecifier.text);
    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword
    ) {
      if (node.arguments.length !== 1 || !ts.isStringLiteral(node.arguments[0]))
        throw new Error(`dynamic import outside economy closure: ${name}`);
      check(node.arguments[0].text);
    }
    ts.forEachChild(node, visit);
  }
  visit(file);
}

try {
  const args = process.argv.slice(2);
  if (args.length !== 2 || args[0] !== '--out' || !isAbsolute(args[1]))
    throw new Error(
      'usage: emit-economy.mjs --out /absolute/absent/scratch/build',
    );
  const output = resolve(args[1]);
  const stable = canonical(
    join(userInfo().homedir, '.local/share/getff-economy/build'),
  );
  const destination = canonical(output);
  if (within(destination, stable) || within(stable, destination))
    throw new Error('stable target overlap; emit to unrelated scratch only');
  if (present(output)) throw new Error('output already exists; no overwrite');
  if (ts.version !== '5.9.3')
    throw new Error(`TypeScript5.9.3 required; found ${ts.version}`);
  const inputs = [],
    payload = [];
  for (const name of modules) {
    const path = join(sourceRoot, name + '.ts');
    if (!lstatSync(path).isFile() || lstatSync(path).isSymbolicLink())
      throw new Error(`source must be a regular file: ${path}`);
    const source = readFileSync(path);
    const emitted = ts.transpileModule(source.toString('utf8'), {
      fileName: name + '.ts',
      reportDiagnostics: true,
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ES2022,
      },
    });
    const errors = (emitted.diagnostics ?? []).filter(
      (x) => x.category === ts.DiagnosticCategory.Error,
    );
    if (errors.length)
      throw new Error(
        `TypeScript diagnostic in ${name}: ${errors.map((x) => ts.flattenDiagnosticMessageText(x.messageText, '\n')).join('\n')}`,
      );
    checkImports(emitted.outputText, name);
    inputs.push({ path: name + '.ts', sha256: hash(source) });
    payload.push({ path: name + '.js', bytes: emitted.outputText });
  }
  payload.push({ path: 'package.json', bytes: '{"type":"module"}\n' });
  // All source/import/diagnostic checks finish before creating any output.
  mkdirSync(output, { mode: 0o755 });
  chmodSync(output, 0o755);
  mkdirSync(join(output, 'cli'), { mode: 0o755 });
  chmodSync(join(output, 'cli'), 0o755);
  for (const file of payload) {
    writeFileSync(join(output, file.path), file.bytes, {
      flag: 'wx',
      mode: 0o644,
    });
    chmodSync(join(output, file.path), 0o644);
  }
  process.stdout.write(
    JSON.stringify({
      node: process.version,
      typescript: ts.version,
      sourceRoot,
      inputs,
      outputs: payload.map(({ path, bytes }) => ({
        path,
        sha256: hash(bytes),
      })),
    }) + '\n',
  );
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
}
