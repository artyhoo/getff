#!/usr/bin/env tsx
// Session-side render driver (Model A′) — live-generation umbrella, LG-S1 Increment 2.
// Spec: docs/meta-factory/research-patches/2026-07-11-live-generation.md §Qa (render runs
// SESSION-SIDE, commit the input record + the rendered artifact; the consumer install path stays
// Node-free), §Qb (frozen-IR expressibility ceiling + MAJOR-1 degrade-not-inert), §Qd (delivery
// placement + `getff-researched-*` rule-id sub-namespace), §Qe (the flagship getff-no-yaml-load).
// Prior-art: docs/meta-factory/prior-art-evaluations.md#219 (stack-agnostic autogeneration core —
// this is the "session-side render + firing artifact" residue: a committed researched practice →
// the INC-1 bridge → renderAstgrep → a committed ast-grep artifact) + #212 (ast-grep render target,
// reused verbatim).
//
// WHAT THIS IS: the thin driver half of the python adapter. It reads the COMMITTED researched-
// practice record(s), routes each through `researchedPracticeToNode` (the INC-1 bridge — the
// MAJOR-1 expressibility + provenance filters live THERE), and renders the surviving nodes through
// the pure `renderAstgrep` backend. The COMMITTED rendered artifact is what ships (Model A′); a
// byte-drift gate (this module's `checkResearchedAstgrepDrift`, exercised by the increment's test)
// keeps it in sync with a fresh render, exactly as render-python-templates.ts does for the starter
// templates. There is deliberately NO render-from-research in CI — CI only drift-checks the
// already-committed artifact (no-paid-llm-in-ci.md / principle 17).
//
// PURITY / SEPARATION OF CONCERNS: `renderAstgrep` is pure (render-astgrep.ts:5 "zero fs/network").
// `planResearchedAstgrep` / `planFromCommittedRecords` are ALSO pure of consumer machine state —
// they compose the bridge + renderer into an in-memory plan and are what the drift gate imports.
// The ONLY fs writes live in `writeResearchedAstgrep()` / `main()`, mirroring the
// render-python-templates.ts writePythonTemplates vs planPythonTemplates split (and the cargo
// backend's write-clippy.ts vs render-clippy.ts separation). A renderer NEVER gains an fs write.
//
// DEGRADE-NOT-INERT (MAJOR-1, §Qb): a practice the bridge cannot express as a single literal
// call/attribute/import ban is surfaced as a research-only finding on `plan.researchOnly` and is
// NEVER rendered. The driver forwards the bridge's honesty; it does not silently drop or inert-emit.
//
// SINGLE-OWNER LANE (python-delivery-v0 decision #5): getff-no-yaml-load is call-kind → the
// ast-grep lane ONLY. This driver renders ast-grep artifacts; it does not also emit a ruff rule for
// the same convention (no duplicate report for one convention).

import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { renderAstgrep } from '../backends/astgrep/render-astgrep.ts';
import {
  researchedPracticeToNode,
  type AstgrepResearchedPractice,
  type ResearchOnlyReason,
} from './research-to-node.ts';

const HERE = dirname(fileURLToPath(import.meta.url));

/** The committed live-generation fixture/artifact root. Committed here, NOT under `.ai-factory/`
 *  (gitignored in the framework repo — a hard-won placement fact). */
export const LIVE_GEN_DIR = resolve(HERE, 'fixtures/live-generation');

/** The committed researched-practice input records (Model A′ inputs), relative to {@link LIVE_GEN_DIR}. */
export const PRACTICE_RECORDS: readonly string[] = [
  'getff-researched-no-yaml-load.practice.json',
];

/** Where the rendered ast-grep rule for a rule id is committed — the SHARED `firing/rules/` dir the
 *  RED (bad) + CLEAN (good) firing fixtures both scan, so a single committed artifact is the exact
 *  thing that is (a) drift-gated (AC2) and (b) fired for real (AC3). Relative to {@link LIVE_GEN_DIR}. */
export function renderedRulePath(ruleId: string): string {
  return join('firing', 'rules', `${ruleId}.yml`);
}

/** A rendered rule the driver produced: its id, committed path, and the verbatim renderAstgrep YAML. */
export interface RenderedResearchedRule {
  entryId: string;
  path: string;
  yaml: string;
}

/** A practice the bridge degraded to a research-only finding (never rendered) — MAJOR-1 honesty. */
export interface ResearchOnlyFinding {
  entryId: string;
  reason: ResearchOnlyReason;
  detail: string;
}

/** The in-memory render plan: what rendered, and what degraded to research-only (both surfaced). */
export interface ResearchedAstgrepPlan {
  rendered: RenderedResearchedRule[];
  researchOnly: ResearchOnlyFinding[];
}

/** Load + parse one committed practice record into the bridge's input type. */
export function loadPracticeRecord(absPath: string): AstgrepResearchedPractice {
  return JSON.parse(readFileSync(absPath, 'utf8')) as AstgrepResearchedPractice;
}

/**
 * PURE (of consumer machine state). Project each researched practice → ConventionNode (INC-1
 * bridge; MAJOR-1 + provenance filters applied THERE) → `renderAstgrep`. A practice the bridge
 * degrades is pushed to `researchOnly` and NEVER rendered. NO fs writes here.
 */
export function planResearchedAstgrep(
  practices: AstgrepResearchedPractice[],
): ResearchedAstgrepPlan {
  const rendered: RenderedResearchedRule[] = [];
  const researchOnly: ResearchOnlyFinding[] = [];

  for (const practice of practices) {
    const result = researchedPracticeToNode(practice);
    if (result.status !== 'node') {
      researchOnly.push({
        entryId: result.entryId,
        reason: result.reason,
        detail: result.detail,
      });
      continue;
    }
    const { yaml, outcomes } = renderAstgrep([result.node]);
    const outcome = outcomes.get(result.node.id);
    if (outcome?.kind !== 'rendered') {
      // A node the bridge accepted but the backend refused is a real driver/backend inconsistency —
      // fail LOUD rather than ship a half-rendered artifact. EXPRESSIBLE_KINDS === VALID_KINDS
      // (asserted in research-to-node.test.ts) keeps this branch unreachable in practice.
      throw new Error(
        `planResearchedAstgrep(): ${result.node.id} passed the bridge but renderAstgrep ` +
          `${outcome?.kind ?? 'produced no outcome for'} it`,
      );
    }
    rendered.push({
      entryId: result.node.id,
      path: renderedRulePath(result.node.id),
      yaml,
    });
  }

  // Loud dup guard: two practices sharing an entryId (hence output path) both land in `rendered` at
  // the SAME committed artifact path, and writeResearchedAstgrep would silently clobber the first —
  // write order alone would decide which rule survives. Fail LOUD, mirroring the fail-loud throw
  // above and the sibling lane guard in render-python-templates.ts planPythonTemplates (:127-133).
  const seenIds = new Set<string>();
  const seenPaths = new Set<string>();
  for (const rule of rendered) {
    if (seenIds.has(rule.entryId) || seenPaths.has(rule.path)) {
      throw new Error(
        `planResearchedAstgrep(): duplicate rendered entryId "${rule.entryId}" → ${rule.path} ` +
          `(two practices render to the same committed artifact; writeResearchedAstgrep would clobber one)`,
      );
    }
    seenIds.add(rule.entryId);
    seenPaths.add(rule.path);
  }

  return { rendered, researchOnly };
}

/** PURE (read-only fs). Load the committed records + plan. The single entry the writer AND the drift
 *  gate call, so the two can never disagree about the bytes. */
export function planFromCommittedRecords(): ResearchedAstgrepPlan {
  const practices = PRACTICE_RECORDS.map((r) =>
    loadPracticeRecord(join(LIVE_GEN_DIR, r)),
  );
  return planResearchedAstgrep(practices);
}

/** Write the rendered artifacts to disk (the ONLY fs-mutating path — renderers stay pure). */
export function writeResearchedAstgrep(): ResearchedAstgrepPlan {
  const plan = planFromCommittedRecords();
  for (const rule of plan.rendered) {
    const abs = join(LIVE_GEN_DIR, rule.path);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, rule.yaml);
  }
  return plan;
}

/** A drift finding on a committed rendered artifact (the Model-A′ byte-drift gate — AC2). */
export interface ResearchedDriftFinding {
  path: string;
  reason: 'missing' | 'byte-mismatch';
}

/** PURE (read-only fs). Compare each committed rendered artifact to a fresh render — the drift gate
 *  the increment's test asserts is empty (AC2). */
export function checkResearchedAstgrepDrift(): ResearchedDriftFinding[] {
  const plan = planFromCommittedRecords();
  const findings: ResearchedDriftFinding[] = [];
  for (const rule of plan.rendered) {
    const abs = join(LIVE_GEN_DIR, rule.path);
    if (!existsSync(abs)) {
      findings.push({ path: rule.path, reason: 'missing' });
      continue;
    }
    if (readFileSync(abs, 'utf8') !== rule.yaml) {
      findings.push({ path: rule.path, reason: 'byte-mismatch' });
    }
  }
  return findings;
}

function main(): void {
  const check = process.argv.includes('--check');
  const plan = check ? planFromCommittedRecords() : writeResearchedAstgrep();

  // Surface every research-only finding — MAJOR-1 honesty is never a silent drop.
  for (const finding of plan.researchOnly) {
    process.stderr.write(
      `research-only (${finding.reason}): ${finding.entryId} — ${finding.detail}\n`,
    );
  }

  if (check) {
    const drift = checkResearchedAstgrepDrift();
    if (drift.length === 0) {
      process.stdout.write('researched astgrep artifacts up-to-date\n');
      process.exit(0);
    }
    process.stderr.write('❌ researched astgrep artifact drift detected:\n');
    for (const d of drift) process.stderr.write(`  ${d.reason}: ${d.path}\n`);
    process.stderr.write(
      'Run: npx tsx packages/core/synthesizer/render-researched-astgrep.ts\n',
    );
    process.exit(1);
  }

  process.stdout.write(
    `rendered ${plan.rendered.length} researched rule(s), ` +
      `${plan.researchOnly.length} research-only finding(s) under ` +
      `${relative(resolve(HERE, '../..'), LIVE_GEN_DIR)}/\n`,
  );
  for (const rule of plan.rendered) process.stdout.write(`  ${rule.path}\n`);
  process.exit(0);
}

// Run only when invoked directly (`tsx render-researched-astgrep.ts`), never on import — the drift
// gate imports the pure planners and must not trigger fs writes.
const isMain =
  Boolean(process.argv[1]) &&
  import.meta.url === pathToFileURL(process.argv[1] as string).href;
if (isMain) main();
