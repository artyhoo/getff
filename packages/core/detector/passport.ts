// detectPassportFields — map repo deps to AIF DESCRIPTION.md passport fields.
// Pure deterministic reads from package.json(s) in the project root and
// monorepo workspaces (apps/*, packages/*). No LLM — the agent in
// agents/aif-init.md synthesises the prose, grounded in these field values.
//
// Prior-art: SSOT #126 (CC /init ADAPT — mechanism reuse),
//            #128 (Repomix/StackSync DEFER — own-stack reuse over new dep).

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';

export interface PassportFields {
  projectName: string | null;
  /** Framework label suitable for DESCRIPTION.md (e.g. 'Hono', 'Next.js'). */
  framework: string | null;
  /** Database engine ('Postgres', 'MySQL', 'SQLite'). */
  database: string | null;
  /** ORM/query-builder ('Drizzle', 'Prisma', 'Kysely'). */
  orm: string | null;
  /** Observability backend ('Honeycomb', 'Datadog', 'Grafana Cloud', 'OpenTelemetry'). */
  observability: string | null;
  /** Test runner ('Vitest', 'Jest'). */
  testRunner: string | null;
  /** Mobile framework ('Expo', 'React Native'). */
  mobile: string | null;
  /** Repo-relative path to the DB schema file if detectable. */
  dbSchemaPath: string | null;
  /** UI component library ('Storybook'). */
  uiLayer: string | null;
}

type DepMap = Record<string, string>;

function readPkgDeps(pkgPath: string): { name?: string; deps: DepMap } {
  if (!existsSync(pkgPath)) return { deps: {} };
  try {
    const pkg: { name?: string; dependencies?: DepMap; devDependencies?: DepMap } = JSON.parse(
      readFileSync(pkgPath, 'utf8'),
    );
    return {
      name: pkg.name,
      deps: { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) },
    };
  } catch {
    return { deps: {} };
  }
}

function collectAllDeps(projectRoot: string): { name: string | null; allDeps: DepMap } {
  const root = readPkgDeps(resolve(projectRoot, 'package.json'));
  const allDeps: DepMap = { ...root.deps };
  const name = root.name ?? null;

  // Monorepo: scan top-level workspace directories for package.jsons.
  for (const wsDir of ['apps', 'packages']) {
    const wsPath = resolve(projectRoot, wsDir);
    if (!existsSync(wsPath)) continue;
    try {
      for (const entry of readdirSync(wsPath)) {
        const pkgPath = join(wsPath, entry, 'package.json');
        const ws = readPkgDeps(pkgPath);
        Object.assign(allDeps, ws.deps);
      }
    } catch {
      // ignore unreadable sub-entries
    }
  }

  return { name, allDeps };
}

function detectFramework(deps: DepMap): string | null {
  if ('hono' in deps) return 'Hono';
  if ('next' in deps) return 'Next.js';
  if ('fastify' in deps) return 'Fastify';
  if ('express' in deps) return 'Express';
  if ('react' in deps || '@types/react' in deps) return 'React';
  return null;
}

function detectDatabase(deps: DepMap): string | null {
  if ('pg' in deps || '@neondatabase/serverless' in deps || 'postgres' in deps) return 'Postgres';
  if ('mysql2' in deps) return 'MySQL';
  if ('better-sqlite3' in deps || '@libsql/client' in deps) return 'SQLite';
  return null;
}

function detectOrm(deps: DepMap): string | null {
  if ('drizzle-orm' in deps) return 'Drizzle';
  if ('@prisma/client' in deps || 'prisma' in deps) return 'Prisma';
  if ('kysely' in deps) return 'Kysely';
  return null;
}

function detectObservability(deps: DepMap): string | null {
  if ('@honeycombio/opentelemetry-node' in deps || '@honeycombio/opentelemetry-web' in deps)
    return 'Honeycomb';
  if ('dd-trace' in deps || 'datadog-lambda-js' in deps) return 'Datadog';
  if ('@grafana/faro-web-sdk' in deps) return 'Grafana Cloud';
  if ('@opentelemetry/api' in deps) return 'OpenTelemetry';
  return null;
}

function detectTestRunner(deps: DepMap): string | null {
  if ('vitest' in deps) return 'Vitest';
  if ('jest' in deps || '@jest/core' in deps) return 'Jest';
  return null;
}

function detectMobile(deps: DepMap): string | null {
  if ('expo' in deps) return 'Expo';
  if ('react-native' in deps) return 'React Native';
  return null;
}

function detectUiLayer(deps: DepMap): string | null {
  if (
    '@storybook/nextjs' in deps ||
    '@storybook/nextjs-vite' in deps ||
    '@storybook/react' in deps ||
    '@storybook/react-vite' in deps ||
    'storybook' in deps
  )
    return 'Storybook';
  return null;
}

function detectDbSchemaPath(projectRoot: string): string | null {
  const candidates = [
    'drizzle/schema.ts',
    'src/db/schema.ts',
    'packages/db/src/schema.ts',
    'prisma/schema.prisma',
  ];
  for (const rel of candidates) {
    if (existsSync(resolve(projectRoot, rel))) return rel;
  }
  return null;
}

/**
 * Detect AIF passport field values from a consumer repo on disk.
 * All detection is deterministic (no LLM). Null = not detected; the agent
 * is responsible for handling null fields with a human-review prompt.
 */
export function detectPassportFields(projectRoot: string): PassportFields {
  const root = resolve(projectRoot);
  const { name, allDeps } = collectAllDeps(root);
  return {
    projectName: name,
    framework: detectFramework(allDeps),
    database: detectDatabase(allDeps),
    orm: detectOrm(allDeps),
    observability: detectObservability(allDeps),
    testRunner: detectTestRunner(allDeps),
    mobile: detectMobile(allDeps),
    dbSchemaPath: detectDbSchemaPath(root),
    uiLayer: detectUiLayer(allDeps),
  };
}
