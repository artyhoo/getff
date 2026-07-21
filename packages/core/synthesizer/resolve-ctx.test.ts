// ecosystem-wiring W2 — resolveCtxForRoot: adapter selection by detected stack,
// exercised through the PRODUCTION resolve path (validateResearchPlan).
//
// Unit arm: resolveCtxForRoot(root).adapter is the EcosystemAdapter matching the
// stack detectStack(root) reports (python → pip, cargo → cargo, JS/unknown → npm).
// Integration arm (T2/T20 — the adapter is actually INVOKED, not just present):
// a pip:/cargo:-prefixed provenance whose only trust source is the consumer's
// local package metadata PASSES Tier-1 when the ctx comes from resolveCtxForRoot,
// and FAILS closed (ecosystem mismatch) under the pre-W2 hardcoded npmAdapter —
// so a green integration arm proves the pip/cargo adapter's listDirectDeps +
// readInstalledMeta ran on the exact function both production callers invoke.
import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resolveCtxForRoot } from './resolve-ctx.ts';
import { validateResearchPlan } from '../research/validate-plan.ts';
import { npmAdapter } from '../research/ecosystem-npm.ts';
import { cargoAdapter } from '../research/ecosystem-cargo.ts';
import { pipAdapter } from '../research/ecosystem-python.ts';

// --- fixtures: minimal consumer roots for each detected stack -----------------

/** python consumer: pyproject.toml (direct dep `requests`) + a root-local venv
 *  whose dist-info METADATA declares a single-tenant Homepage host. */
function makePythonRoot(): string {
  const root = mkdtempSync(join(tmpdir(), 'w2-py-'));
  writeFileSync(
    join(root, 'pyproject.toml'),
    `[project]\nname = "consumer"\nversion = "0.1.0"\ndependencies = ["requests"]\n`,
  );
  const sp = join(root, '.venv', 'lib', 'python3.14', 'site-packages', 'requests-2.31.0.dist-info');
  mkdirSync(sp, { recursive: true });
  // Single-tenant Homepage host (NOT a multi-tenant apex like readthedocs.io,
  // which tier1For drops via isMultiTenantHost) so the happy-path Tier-1
  // derivation reaches a real host.
  writeFileSync(
    join(sp, 'METADATA'),
    `Metadata-Version: 2.1\nName: requests\nVersion: 2.31.0\nProject-URL: Homepage, https://python-requests.org\n`,
  );
  return root;
}

/** cargo consumer: Cargo.toml (direct dep `serde`) + a vendored crate whose
 *  own Cargo.toml declares a single-tenant homepage. */
function makeCargoRoot(): string {
  const root = mkdtempSync(join(tmpdir(), 'w2-cargo-'));
  writeFileSync(
    join(root, 'Cargo.toml'),
    `[package]\nname = "consumer"\nversion = "0.1.0"\n\n[dependencies]\nserde = "1.0"\n`,
  );
  const vendorDir = join(root, 'vendor', 'serde');
  mkdirSync(vendorDir, { recursive: true });
  writeFileSync(
    join(vendorDir, 'Cargo.toml'),
    `[package]\nname = "serde"\nversion = "1.0.0"\nhomepage = "https://serde.rs"\n`,
  );
  return root;
}

/** npm consumer: package.json + installed node_modules metadata. */
function makeNpmRoot(): string {
  const root = mkdtempSync(join(tmpdir(), 'w2-npm-'));
  writeFileSync(
    join(root, 'package.json'),
    JSON.stringify({ dependencies: { 'drizzle-orm': '^0.40.0' } }, null, 2),
  );
  const nm = join(root, 'node_modules', 'drizzle-orm');
  mkdirSync(nm, { recursive: true });
  writeFileSync(
    join(nm, 'package.json'),
    JSON.stringify({ name: 'drizzle-orm', homepage: 'https://orm.drizzle.team' }, null, 2),
  );
  return root;
}

/** unknown consumer: an empty dir (no manifest of any kind). */
function makeUnknownRoot(): string {
  return mkdtempSync(join(tmpdir(), 'w2-unknown-'));
}

/** JS consumer with a FREEFORM `.ai-factory/DESCRIPTION.md` that exists but lacks
 *  any canonical heading. Pre-W2 both call sites hardcoded npmAdapter and never
 *  read `.ai-factory`, so this shape was inert. If resolveCtxForRoot runs the full
 *  detectStack (readAif enabled), readAif's parseAifMarkdown returns null for this
 *  freeform file → AifSchemaError throw on the resolve path (the W2 regression). */
function makeNpmRootWithFreeformAif(): string {
  const root = mkdtempSync(join(tmpdir(), 'w2-npm-freeform-aif-'));
  writeFileSync(
    join(root, 'package.json'),
    JSON.stringify({ dependencies: { 'drizzle-orm': '^0.40.0' } }, null, 2),
  );
  const nm = join(root, 'node_modules', 'drizzle-orm');
  mkdirSync(nm, { recursive: true });
  writeFileSync(
    join(nm, 'package.json'),
    JSON.stringify({ name: 'drizzle-orm', homepage: 'https://orm.drizzle.team' }, null, 2),
  );
  // Freeform prose — no `# Description` / `## Stack` / etc. canonical heading.
  mkdirSync(join(root, '.ai-factory'), { recursive: true });
  writeFileSync(
    join(root, '.ai-factory', 'DESCRIPTION.md'),
    `just some freeform notes about this project, no canonical heading here\n`,
  );
  return root;
}

// --- plan builders ------------------------------------------------------------

interface PlanOpts {
  packageName: string; // ecosystem-prefixed, e.g. 'pip:requests'
  url: string;
}
function planFor({ packageName, url }: PlanOpts): unknown {
  return {
    framework: null,
    version: null,
    patterns: [
      {
        id: 'w2-integration',
        summary: 'W2 wiring proof',
        bestPractices: [],
        antiPatterns: [],
        package: packageName,
        provenance: [{ url, allowlistKey: packageName, packageName, fetchedAt: '2026-07-21' }],
      },
    ],
    missing: [],
    drift: null,
  };
}

// --- unit arm: adapter selection by detected stack ----------------------------

describe('resolveCtxForRoot — adapter selection by detected stack (W2 unit)', () => {
  it('python root (pyproject.toml) → pipAdapter', () => {
    const ctx = resolveCtxForRoot(makePythonRoot());
    expect(ctx.adapter).toBe(pipAdapter);
  });

  it('cargo root (Cargo.toml) → cargoAdapter', () => {
    const ctx = resolveCtxForRoot(makeCargoRoot());
    expect(ctx.adapter).toBe(cargoAdapter);
  });

  it('npm root (package.json) → npmAdapter (pre-W2 default preserved)', () => {
    const ctx = resolveCtxForRoot(makeNpmRoot());
    expect(ctx.adapter).toBe(npmAdapter);
  });

  it('unknown root (no manifest) → npmAdapter (pre-W2 default preserved)', () => {
    const ctx = resolveCtxForRoot(makeUnknownRoot());
    expect(ctx.adapter).toBe(npmAdapter);
  });

  it('threads the given root onto the ctx verbatim (never guesses)', () => {
    const root = makePythonRoot();
    expect(resolveCtxForRoot(root).root).toBe(root);
  });

  // REGRESSION (W2 rework): a JS consumer with a freeform `.ai-factory/DESCRIPTION.md`
  // (exists, no canonical heading) must NOT throw on the resolve path — it must
  // degrade to the pre-W2 npmAdapter default. Pre-fix this threw AifSchemaError
  // because resolveCtxForRoot ran detectStack with readAif enabled; the resolve
  // path never needed `.ai-factory` metadata for adapter selection.
  it('npm root with a freeform (headingless) .ai-factory/DESCRIPTION.md → npmAdapter, no throw', () => {
    const root = makeNpmRootWithFreeformAif();
    let ctx: ReturnType<typeof resolveCtxForRoot> | undefined;
    expect(() => {
      ctx = resolveCtxForRoot(root);
    }).not.toThrow();
    expect(ctx!.adapter).toBe(npmAdapter);
    expect(ctx!.root).toBe(root);
  });
});

// --- integration arm: the adapter is INVOKED on the production resolve path ----

describe('resolveCtxForRoot — adapter is invoked on validateResearchPlan (W2 integration)', () => {
  it('python: a pip: provenance authorizes via pipAdapter Tier-1 (no throw)', () => {
    const root = makePythonRoot();
    const plan = planFor({
      packageName: 'pip:requests',
      url: 'https://python-requests.org/en/latest/',
    });
    // resolveCtxForRoot wires pipAdapter → listDirectDeps + readInstalledMeta run.
    expect(() => validateResearchPlan(plan, resolveCtxForRoot(root))).not.toThrow();
    // Control: the pre-W2 hardcoded npmAdapter fails closed (ecosystem mismatch),
    // proving the pass above is the pip adapter, not a Tier-0 fall-through.
    expect(() => validateResearchPlan(plan, { root, adapter: npmAdapter })).toThrow(
      /ecosystem mismatch|provenance violation/,
    );
  });

  it('cargo: a cargo: provenance authorizes via cargoAdapter Tier-1 (no throw)', () => {
    const root = makeCargoRoot();
    const plan = planFor({ packageName: 'cargo:serde', url: 'https://serde.rs/derive.html' });
    expect(() => validateResearchPlan(plan, resolveCtxForRoot(root))).not.toThrow();
    expect(() => validateResearchPlan(plan, { root, adapter: npmAdapter })).toThrow(
      /ecosystem mismatch|provenance violation/,
    );
  });
});
