#!/usr/bin/env tsx
// Session-side render driver (Model A′) — live-generation umbrella, LG-S3 Increment 2 (rust).
// Spec: docs/meta-factory/research-patches/2026-07-11-live-generation.md §Qa (render runs
// SESSION-SIDE, commit the input record + the rendered artifact; the consumer install path stays
// Node-free), §Qb (frozen-IR expressibility ceiling + MAJOR-1 degrade-not-inert), §Qe (rust «works»
// = local `cargo clippy` RED + CI render/drift/committed-evidence — never a fresh live-fire in CI),
// §Qf-LG-S3.
// Prior-art: docs/meta-factory/prior-art-evaluations.md#219 (stack-agnostic autogeneration core —
// this is the rust adapter's "session-side render + firing artifact" residue: a committed researched
// rust practice → the LG-S3 INC-1 clippy bridge → renderCargoClippy → a committed clippy.toml).
//
// WHAT THIS IS: the clippy SIBLING of render-researched-astgrep.ts (LG-S1). Same thin driver — read
// the COMMITTED researched-practice record(s), route each through `researchedPracticeToClippyNode`
// (the INC-1 bridge — the MAJOR-1 expressibility + Tier-0 provenance filters live THERE), and render
// the surviving nodes through the pure, ADOPTED `renderCargoClippy` backend (#977-owned, imported
// READ-ONLY — never edited). The COMMITTED rendered artifact (a clippy.toml) is what the fixture
// crates carry (Model A′); a byte-drift gate (`checkResearchedClippyDrift`, exercised by the
// increment's test) keeps it in sync with a fresh render. There is deliberately NO render-from-
// research in CI — CI only drift-checks the already-committed artifact (no-paid-llm-in-ci.md /
// principle 17).
//
// STRUCTURAL DIFFERENCE FROM THE ASTGREP SIBLING (deliberate, not a slip): ast-grep emits ONE .yml
// FILE per rule, so the astgrep driver's plan is a list of {entryId, path, yaml}. clippy is a SINGLE
// clippy.toml carrying ALL disallowed-{methods,types,macros} bans (renderCargoClippy(nodes) → one
// toml), and cargo reads `./clippy.toml` from the crate root. So this driver renders ONE toml and
// commits it to EACH fixture crate root (bad + good) — the SAME rendered bytes both the RED (bad) and
// CLEAN (good) firing crates scan, so a single committed artifact is what is (a) drift-gated (AC1) and
// (b) fired for real (AC2). The good crate carries the identical clippy.toml on purpose: it proves the
// SAME ban produces no diagnostic on conforming code (the #977 valid-clean rationale).
//
// PURITY / SEPARATION OF CONCERNS: `renderCargoClippy` is pure (render-clippy.ts:4 "zero fs/network").
// `planResearchedClippy` / `planFromCommittedRecords` are ALSO pure of consumer machine state — they
// compose the bridge + renderer into an in-memory plan and are what the drift gate imports. The ONLY
// fs writes live in `writeResearchedClippy()` / `main()`, mirroring render-researched-astgrep.ts's
// writeResearchedAstgrep vs planResearchedAstgrep split (and the cargo backend's write-clippy.ts vs
// render-clippy.ts separation). A renderer NEVER gains an fs write.
//
// DEGRADE-NOT-INERT (MAJOR-1, §Qb): a practice the bridge cannot express as a single clippy path-ban
// of kind method/type/macro is surfaced as a research-only finding on `plan.researchOnly` and is NEVER
// rendered into the clippy.toml. The driver forwards the bridge's honesty; it does not silently drop.

import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { renderCargoClippy } from '../backends/cargo/render-clippy.ts';
import type { ResolveCtx } from '../research/allowlist-resolver.ts';
import {
  researchedPracticeToClippyNode,
  type ClippyResearchedPractice,
  type ResearchOnlyReason,
} from './research-to-clippy-node.ts';

const HERE = dirname(fileURLToPath(import.meta.url));

/** The committed live-generation RUST fixture/artifact root. Committed here, NOT under `.ai-factory/`
 *  (gitignored in the framework repo — a hard-won placement fact). Namespaced under `rust/` so the
 *  rendered clippy.toml never collides with #977's `backends/cargo/demo` clippy.toml. */
export const LIVE_GEN_RUST_DIR = resolve(HERE, 'fixtures/live-generation/rust');

/** The committed researched-practice input records (Model A′ inputs), relative to {@link LIVE_GEN_RUST_DIR}. */
export const PRACTICE_RECORDS: readonly string[] = ['mem-forget.practice.json'];

/** The fixture-crate roots (relative to {@link LIVE_GEN_RUST_DIR}) that each receive the generated
 *  clippy.toml. `bad` is the RED crate (calls the banned method), `good` the CLEAN crate. Both carry
 *  the SAME rendered bytes — the good crate proves the ban is silent on conforming code. */
export const CRATE_DIRS: readonly string[] = ['firing/bad', 'firing/good'];

/** Where the rendered clippy.toml is committed for a given fixture-crate dir. cargo reads
 *  `<crate>/clippy.toml`, so the artifact lives at the crate root. Relative to {@link LIVE_GEN_RUST_DIR}. */
export function renderedClippyPath(crateDir: string): string {
  return join(crateDir, 'clippy.toml');
}

/** The single rendered clippy.toml (all expressible bans) plus the entryIds that rendered into it. */
export interface RenderedResearchedClippy {
  entryIds: string[];
  toml: string;
}

/** A practice the bridge degraded to a research-only finding (never rendered) — MAJOR-1 honesty. */
export interface ResearchOnlyFinding {
  entryId: string;
  reason: ResearchOnlyReason;
  detail: string;
}

/** The in-memory render plan: the one clippy.toml that rendered (null if nothing expressible), and
 *  everything that degraded to research-only (both surfaced — never a silent drop). */
export interface ResearchedClippyPlan {
  rendered: RenderedResearchedClippy | null;
  researchOnly: ResearchOnlyFinding[];
}

/** Load + parse one committed practice record into the bridge's input type. */
export function loadPracticeRecord(absPath: string): ClippyResearchedPractice {
  return JSON.parse(readFileSync(absPath, 'utf8')) as ClippyResearchedPractice;
}

/**
 * PURE (of consumer machine state). Project each researched practice → ConventionNode (INC-1 clippy
 * bridge; MAJOR-1 + Tier-0 provenance filters applied THERE) → the pure `renderCargoClippy` backend.
 * ALL surviving nodes render into ONE clippy.toml. A practice the bridge degrades is pushed to
 * `researchOnly` and NEVER rendered. NO fs writes here.
 *
 * `ctx` (S1 getff-any-stack-trace, spec §4 W1-1): optional manifest-derived `ResolveCtx`. The
 * CONSUMER render path threads the factory-built ctx (resolve-ctx.ts `resolveCtxForRoot`) so a
 * practice whose provenance host is a direct dependency's documentation/homepage/repository is
 * admitted at Tier-1. The
 * FRAMEWORK-side render paths (`planFromCommittedRecords`, `writeResearchedClippy`,
 * `checkResearchedClippyDrift`) omit it — those paths have no consumer manifest in scope, so
 * they correctly stay on the Tier-0-only back-compat path the bridge always used pre-S1.
 * Mechanical mirror of the astgrep driver's threading (render-researched-astgrep.ts).
 */
export function planResearchedClippy(
  practices: ClippyResearchedPractice[],
  ctx?: ResolveCtx,
): ResearchedClippyPlan {
  const nodes = [];
  const researchOnly: ResearchOnlyFinding[] = [];

  for (const practice of practices) {
    const result = researchedPracticeToClippyNode(practice, ctx);
    if (result.status !== 'node') {
      researchOnly.push({
        entryId: result.entryId,
        reason: result.reason,
        detail: result.detail,
      });
      continue;
    }
    nodes.push(result.node);
  }

  // Loud dup guard: two practices sharing an entryId would render two disallowed-table entries the
  // caller cannot tell apart, and (more importantly) signal a duplicated researched convention. Fail
  // LOUD, mirroring the sibling astgrep driver's guard (render-researched-astgrep.ts:137-148).
  const seenIds = new Set<string>();
  for (const node of nodes) {
    if (seenIds.has(node.id)) {
      throw new Error(
        `planResearchedClippy(): duplicate rendered entryId "${node.id}" ` +
          `(two practices render into the same clippy.toml — a duplicated researched convention)`,
      );
    }
    seenIds.add(node.id);
  }

  if (nodes.length === 0) {
    return { rendered: null, researchOnly };
  }

  const { toml, outcomes } = renderCargoClippy(nodes);
  for (const node of nodes) {
    const outcome = outcomes.get(node.id);
    if (outcome?.kind !== 'rendered') {
      // A node the bridge accepted but the backend refused/degraded is a real driver/backend
      // inconsistency — fail LOUD rather than ship a half-rendered artifact. The bridge only ever
      // builds selectorClass:'type-aware' + {kind∈method/type/macro, path} + severity 'warning' nodes
      // (research-to-clippy-node.ts:167-188), which renderCargoClippy renders (not degrades), so this
      // branch is unreachable in practice — it guards a future bridge/backend drift.
      throw new Error(
        `planResearchedClippy(): ${node.id} passed the clippy bridge but renderCargoClippy ` +
          `${outcome?.kind ?? 'produced no outcome for'} it`,
      );
    }
  }

  return {
    rendered: { entryIds: nodes.map((n) => n.id), toml },
    researchOnly,
  };
}

/** PURE (read-only fs). Load the committed records + plan. The single entry the writer AND the drift
 *  gate call, so the two can never disagree about the bytes. `liveGenRustDir` defaults to the
 *  committed tree; tests inject a tmpdir CLONE so gate-teeth checks never mutate the tracked
 *  fixtures (in-place mutate/unlink-then-restore races parallel vitest workers over the shared
 *  committed artifact — the astgrep sibling's ENOENT flake, PR #1349 CI run 31336870255). */
export function planFromCommittedRecords(
  liveGenRustDir: string = LIVE_GEN_RUST_DIR,
): ResearchedClippyPlan {
  const practices = PRACTICE_RECORDS.map((r) =>
    loadPracticeRecord(join(liveGenRustDir, r)),
  );
  return planResearchedClippy(practices);
}

/** Write the rendered clippy.toml to each fixture-crate root (the ONLY fs-mutating path — renderers
 *  stay pure). No-op when nothing expressible rendered (the driver never writes an empty artifact). */
export function writeResearchedClippy(): ResearchedClippyPlan {
  const plan = planFromCommittedRecords();
  if (plan.rendered !== null) {
    for (const crateDir of CRATE_DIRS) {
      const abs = join(LIVE_GEN_RUST_DIR, renderedClippyPath(crateDir));
      mkdirSync(dirname(abs), { recursive: true });
      writeFileSync(abs, plan.rendered.toml);
    }
  }
  return plan;
}

/** A drift finding on a committed rendered artifact (the Model-A′ byte-drift gate — AC1). */
export interface ResearchedDriftFinding {
  path: string;
  reason: 'missing' | 'byte-mismatch';
}

/** PURE (read-only fs). Compare each committed crate clippy.toml to a fresh render — the drift gate
 *  the increment's test asserts is empty (AC1). With nothing expressible, there is no toml to check
 *  against, so drift is empty (the test separately asserts the flagship IS expressible). */
export function checkResearchedClippyDrift(
  liveGenRustDir: string = LIVE_GEN_RUST_DIR,
): ResearchedDriftFinding[] {
  const plan = planFromCommittedRecords(liveGenRustDir);
  const findings: ResearchedDriftFinding[] = [];
  if (plan.rendered === null) return findings;
  for (const crateDir of CRATE_DIRS) {
    const rel = renderedClippyPath(crateDir);
    const abs = join(liveGenRustDir, rel);
    if (!existsSync(abs)) {
      findings.push({ path: rel, reason: 'missing' });
      continue;
    }
    if (readFileSync(abs, 'utf8') !== plan.rendered.toml) {
      findings.push({ path: rel, reason: 'byte-mismatch' });
    }
  }
  return findings;
}

function main(): void {
  const check = process.argv.includes('--check');
  const plan = check ? planFromCommittedRecords() : writeResearchedClippy();

  // Surface every research-only finding — MAJOR-1 honesty is never a silent drop.
  for (const finding of plan.researchOnly) {
    process.stderr.write(
      `research-only (${finding.reason}): ${finding.entryId} — ${finding.detail}\n`,
    );
  }

  if (check) {
    const drift = checkResearchedClippyDrift();
    if (drift.length === 0) {
      process.stdout.write('researched clippy artifacts up-to-date\n');
      process.exit(0);
    }
    process.stderr.write('❌ researched clippy artifact drift detected:\n');
    for (const d of drift) process.stderr.write(`  ${d.reason}: ${d.path}\n`);
    process.stderr.write(
      'Run: npx tsx packages/core/synthesizer/render-researched-clippy.ts\n',
    );
    process.exit(1);
  }

  const banCount = plan.rendered?.entryIds.length ?? 0;
  process.stdout.write(
    `rendered ${banCount} researched clippy ban(s) into ${CRATE_DIRS.length} crate clippy.toml, ` +
      `${plan.researchOnly.length} research-only finding(s) under ` +
      `${relative(resolve(HERE, '../..'), LIVE_GEN_RUST_DIR)}/\n`,
  );
  for (const crateDir of CRATE_DIRS) {
    process.stdout.write(`  ${renderedClippyPath(crateDir)}\n`);
  }
  process.exit(0);
}

// Run only when invoked directly (`tsx render-researched-clippy.ts`), never on import — the drift
// gate imports the pure planners and must not trigger fs writes.
const isMain =
  Boolean(process.argv[1]) &&
  import.meta.url === pathToFileURL(process.argv[1] as string).href;
if (isMain) main();
