#!/usr/bin/env node
/**
 * build-runtime-bundles — prebuild the pre-push hook and the rule generator as .mjs bundles.
 *
 * getff's consumer-executed TypeScript becomes zero-dependency .mjs that runs on plain `node`.
 *
 * WHY. Two pieces of getff's TypeScript run on the consumer's machine, and both used to run as
 * raw .ts through tsx:
 *   • the pre-push hook (packages/core/hooks/pre-push.ts + its import graph) was COPIED into the
 *     consumer's tree, where the consumer's own eslint and tsc checked it — a project that owns
 *     its eslint.config.mjs / tsconfig.json went RED on getff's files right after install
 *     (TS5097 `.ts` import extensions, prefer-const, a workspace import tsc cannot resolve);
 *   • the rule generator (packages/core/install/rule-bootstrap-cli.ts) ran from the getff clone
 *     via `npx --no-install tsx`, and a clone has no node_modules — it died on
 *     ERR_MODULE_NOT_FOUND 'ajv' before generating anything (N14 / critical-review S5-9).
 * One prebuilt .mjs per entry closes both: tsc does not read .mjs, the consumer's eslint is told
 * to skip the file by its first line, and neither tsx nor the clone's dependencies are needed.
 * Operator decision 2026-09-28 (Q4.1/Q4.2); precedent packages/core/install/synth-and-wire.bundle.mjs
 * (#763, built by scripts/build-synth-bundle.sh).
 *
 * WHAT EACH BUNDLE IS
 *   • Everything the entry imports is inlined, first-party and third-party alike (ajv, semver, …).
 *   • `external` names first-party modules left out on purpose: the pre-push hook's two
 *     maintainer-only sections load their gates with a dynamic import that never runs in a
 *     consumer (composeSections keeps them out of the consumer composition), and inlining them
 *     would drag the whole ESLint stack into the hook.
 *   • `fromProject` names third-party packages that are NOT inlined but loaded at run time from
 *     the project the process runs in (its cwd), falling back to the package that depends on them
 *     and then to getff's own tree. The generator's L4 gates need `eslint`,
 *     `@typescript-eslint/parser` and `@typescript-eslint/utils`; inlining eslint and the parser
 *     costs ~18 MB (typescript alone ~9 MB, measured 2026-09-28), while every project the
 *     generator targets has installed them — getff's installer puts eslint + typescript-eslint
 *     into its devDependencies before this step runs.
 *   • A first-party module that reads a sibling file through `import.meta.url` would see the
 *     BUNDLE's URL once inlined, so every such reference in a non-entry module is rewritten to the
 *     module's own source location (resolved relative to the bundle). The entry keeps the real
 *     URL, so its direct-run guard still recognises `node <bundle>`, while an inlined module's own
 *     direct-run guard (detector/index.ts, render-researched-astgrep.ts) correctly stays false.
 *   • The first lines are an `eslint-disable` block comment and `// @ts-nocheck`: generated
 *     code is not the consumer's to lint or type-check. getff never edits a consumer's tsconfig,
 *     and adds an ignores entry for the bundle only to an ES-module eslint config it can wire
 *     (operator decision Q4.7, 2026-09-28; setup.d/99-finalize.sh), so the banner is what keeps
 *     the bundle quiet under every other consumer config.
 *
 * USAGE
 *   node scripts/build-runtime-bundles.mjs            # (re)generate the committed bundles
 *   node scripts/build-runtime-bundles.mjs --check    # drift gate: fail if committed ≠ fresh build
 *
 * Runnable from any working directory: the repo root is derived from this file's location and
 * handed to esbuild as its working directory, so the `// path` comments are repo-relative.
 * Importing this module has no side effects (principle 27 reads BUNDLES from it).
 * Deterministic and offline (no network, no paid LLM — .claude/rules/no-paid-llm-in-ci.md).
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export const BUNDLES = [
  {
    name: 'pre-push hook',
    entry: 'packages/core/hooks/pre-push.ts',
    outfile: 'packages/core/hooks/pre-push.bundle.mjs',
    // Each external names the pre-push section that loads it. Principle 27 checks that every
    // such section is maintainer-only — composeSections() never runs it on a consumer, where
    // the file does not exist.
    external: [
      { path: './checks/guard-liveness.ts', section: 'guard-liveness' },
      {
        path: './checks/cmd-script-liveness.ts',
        section: 'cmd-script-liveness',
      },
    ],
    fromProject: [],
    // The hook runs on every consumer push: it must stay free of third-party code.
    thirdParty: false,
  },
  {
    name: 'rule generator',
    entry: 'packages/core/install/rule-bootstrap-cli.ts',
    outfile: 'packages/core/install/rule-bootstrap-cli.bundle.mjs',
    external: [],
    fromProject: [
      { id: 'eslint' },
      { id: 'eslint/use-at-your-own-risk' },
      // pnpm keeps a transitive dependency out of the project root; typescript-eslint (what
      // getff's installer adds) is the package that depends on the parser and the utils.
      { id: '@typescript-eslint/parser', via: 'typescript-eslint' },
      // The rule helpers come from the same typescript-eslint install as the parser, so the two
      // never disagree on a version. Inlined, they would also make the committed bytes depend on
      // which node_modules layer the build happened to resolve — the root and packages/core
      // lockfiles plan different versions (scripts/check-bundle-dep-parity.sh, measured
      // 2026-09-28: 8.61.0 vs 8.61.1).
      { id: '@typescript-eslint/utils', via: 'typescript-eslint' },
    ],
    thirdParty: true,
  },
  {
    // Circle 2 of the install (setup.d/35-stack-tools.sh): runs from the getff checkout on plain
    // node, before the project has node_modules — so nothing may come from the project. ajv is
    // inlined: allowlist-resolver.ts validates the Tier-2 ack file's shape with it.
    name: 'vendor MCP check',
    entry: 'packages/core/install/mcp-source-check.ts',
    outfile: 'packages/core/install/mcp-source-check.bundle.mjs',
    external: [],
    fromProject: [],
    thirdParty: true,
  },
];

// Line 1-2 keep generated code out of the consumer's lint and type-check. Line 3 defines a real
// `require` for the CommonJS packages inlined into ESM output (esbuild#1921) — the same banner as
// scripts/build-synth-bundle.sh.
const BANNER =
  '/* eslint-disable */\n' +
  '// @ts-nocheck\n' +
  "import{createRequire as ___cr}from'node:module';const require=___cr(import.meta.url);";

const toPosix = (p) => p.split(sep).join('/');

/** Rewrite `import.meta.url` in every inlined first-party module to that module's own URL. */
function ownMetaUrlPlugin(entryAbs, outfileAbs) {
  return {
    name: 'own-import-meta-url',
    setup(build) {
      build.onLoad({ filter: /\.[cm]?tsx?$/ }, (args) => {
        if (
          args.path.includes(`${sep}node_modules${sep}`) ||
          args.path === entryAbs
        )
          return undefined;
        const source = readFileSync(args.path, 'utf8');
        if (/import\.meta\.(dirname|filename)\b/.test(source)) {
          return {
            errors: [
              {
                text: `import.meta.dirname/filename is not rewritten for bundling — use import.meta.url (${relative(ROOT, args.path)})`,
              },
            ],
          };
        }
        if (!source.includes('import.meta.url')) return undefined;
        const rel = toPosix(relative(dirname(outfileAbs), args.path));
        const own = `new URL(${JSON.stringify(rel)}, import.meta.url).href`;
        return {
          contents: source.replaceAll('import.meta.url', own),
          loader: 'ts',
        };
      });
    },
  };
}

/** Leave the named first-party modules as runtime imports. */
function keepExternalPlugin(external) {
  const wanted = new Set(external.map((e) => e.path));
  return {
    name: 'keep-external',
    setup(build) {
      build.onResolve({ filter: /^\.\.?\// }, (args) =>
        wanted.has(args.path) ? { path: args.path, external: true } : undefined,
      );
    },
  };
}

/** Load the named packages from the project at run time instead of inlining them. */
function fromProjectPlugin(fromProject) {
  const byId = new Map(fromProject.map((d) => [d.id, d]));
  const filter = new RegExp(
    `^(${fromProject.map((d) => d.id.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')).join('|')})$`,
  );
  return {
    name: 'from-project',
    setup(build) {
      if (byId.size === 0) return;
      build.onResolve({ filter }, (args) => ({
        path: args.path,
        namespace: 'getff-from-project',
      }));
      build.onLoad(
        { filter: /.*/, namespace: 'getff-from-project' },
        (args) => {
          const { id, via } = byId.get(args.path);
          return {
            loader: 'js',
            resolveDir: ROOT,
            contents: `// '${id}' is loaded from the project at run time, not inlined (scripts/build-runtime-bundles.mjs).
var { createRequire } = require('node:module');
var { join } = require('node:path');
var id = ${JSON.stringify(id)};
var via = ${JSON.stringify(via ?? null)};
function missing(e) { return e && e.code === 'MODULE_NOT_FOUND'; }
function load() {
  var fromProject = createRequire(join(process.cwd(), 'package.json'));
  try { return fromProject(id); } catch (e) { if (!missing(e)) throw e; }
  if (via) {
    try { return createRequire(fromProject.resolve(via + '/package.json'))(id); } catch (e) { if (!missing(e)) throw e; }
  }
  try { return require(id); } catch (e) { if (!missing(e)) throw e; }
  throw new Error("getff: '" + id + "' is not installed in " + process.cwd() +
    " — getff's rule generator uses the project's own ESLint. Install it (npm install --save-dev eslint typescript-eslint) and re-run.");
}
module.exports = load();
`,
          };
        },
      );
    },
  };
}

// esbuild embeds each inlined file's node_modules path as a comment and module-map key. Collapse
// the layer prefix so the committed bundle does not depend on how npm laid the tree out
// (`packages/core/node_modules/semver` vs `node_modules/semver`) — the same normalisation as
// scripts/build-synth-bundle.sh.
const normaliseNodeModules = (text) =>
  text.replace(
    /(["(/\s]|^)([A-Za-z0-9_.@-]+\/)*node_modules\//gm,
    '$1node_modules/',
  );

async function buildOne(esbuild, spec) {
  const entryAbs = resolve(ROOT, spec.entry);
  const outfileAbs = resolve(ROOT, spec.outfile);
  const result = await esbuild.build({
    entryPoints: [entryAbs],
    outfile: outfileAbs,
    absWorkingDir: ROOT,
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node20',
    packages: 'bundle',
    write: false,
    metafile: true,
    logLevel: 'silent',
    banner: { js: BANNER },
    plugins: [
      keepExternalPlugin(spec.external),
      fromProjectPlugin(spec.fromProject),
      ownMetaUrlPlugin(entryAbs, outfileAbs),
    ],
  });
  if (!spec.thirdParty) {
    const inlined = Object.keys(result.metafile.inputs).filter((p) =>
      p.includes('node_modules/'),
    );
    if (inlined.length > 0) {
      throw new Error(
        `${spec.name}: must inline no third-party code, but pulled in:\n  ${inlined.join('\n  ')}`,
      );
    }
  }
  return normaliseNodeModules(result.outputFiles[0].text);
}

async function main() {
  const check = process.argv.includes('--check');
  const requireFromRoot = createRequire(join(ROOT, 'package.json'));
  let esbuild;
  try {
    esbuild = requireFromRoot('esbuild');
  } catch {
    console.error(
      `ERROR: esbuild not found under ${ROOT}/node_modules — run 'NODE_ENV=development npm install --include=dev' at the repo root first.`,
    );
    process.exit(2);
  }

  // Refuse to build or drift-check while an inlined dependency is ambiguous between the two
  // committed lockfiles (the phantom-drift guard shared with the synth bundle).
  const parity = spawnSync(
    'bash',
    [join(ROOT, 'scripts/check-bundle-dep-parity.sh'), ROOT],
    {
      stdio: ['ignore', 'ignore', 'inherit'],
    },
  );
  if (parity.status !== 0) process.exit(1);

  let drift = 0;
  for (const spec of BUNDLES) {
    const fresh = await buildOne(esbuild, spec);
    if (check) {
      const outfileAbs = resolve(ROOT, spec.outfile);
      const committed = existsSync(outfileAbs)
        ? readFileSync(outfileAbs, 'utf8')
        : null;
      if (committed === null) {
        console.error(
          `DRIFT: ${spec.outfile} is missing — run: node scripts/build-runtime-bundles.mjs`,
        );
        drift = 1;
      } else if (committed !== fresh) {
        console.error(
          `DRIFT: ${spec.outfile} differs from a fresh build of ${spec.entry}`,
        );
        console.error('       Re-run: node scripts/build-runtime-bundles.mjs');
        drift = 1;
      } else {
        console.log(`✓ ${spec.outfile} in sync with ${spec.entry}`);
      }
    } else {
      writeFileSync(resolve(ROOT, spec.outfile), fresh);
      console.log(`✓ built ${spec.outfile} (${spec.name}; plain node, no tsx)`);
    }
  }
  process.exit(drift);
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main().catch((err) => {
    console.error(`build-runtime-bundles: ${err.message}`);
    process.exit(1);
  });
}
