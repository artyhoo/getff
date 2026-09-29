// Rule-bootstrapping LIVE adapter (Phase 1) — file-reading research + generate clients.
//
// Replaces stubRuleResearch / stubGenerateNextImage on the ./setup --full consumer path:
// the human's interactive MCP-enabled agent session runs the rule-research protocol
// (agents/rule-researcher.md), writes two committed JSON files, and these thin clients
// feed them through the UNCHANGED deterministic tail (generate.ts → L4 → install → lock).
//
// $0-in-CI (principle 17): no network, no LLM here — the live research happened in the
// human session; these clients only READ its committed output. CI keeps injecting the stubs.
//
// SEAM fidelity: FileResearchClient ignores `detection` and FileGenerateClient ignores
// `menu`, exactly like the stubs — the input is the file, authored upstream by the agent.
//
// Prior-art: prior-art-evaluations.md#183 (rule-research→rule-factory bridge BUILD; #798 §11).

import { readFileSync } from 'node:fs';
import process from 'node:process';
import type { DetectionResult } from '../detector/types.ts';
import type { ResearchPlan } from '../research/types.ts';
import type { ResolveCtx } from '../research/allowlist-resolver.ts';
import type { Diagnostic } from '../diagnostics/types.ts';
import {
  ResearchPlanError,
  checkResearchPlan,
  validateResearchPlan,
  type EntryIdMap,
} from '../research/validate-plan.ts';
import { resolveCtxForRoot } from './resolve-ctx.ts';
import type { RuleResearchClient } from './rule-research-port.ts';
import type {
  GenerateCandidate,
  GenerateClient,
  GenerateSelection,
  Menu,
} from './generate-port.ts';

/** One research entry the plan gate refused, with the gate's reason (`<code>: <message>`). */
export interface DroppedEntry {
  id: string;
  reason: string;
}

const ENTRY_PATH_RE = /^\/patterns\/(\d+)(?:\/|$)/;

const idOf = (e: unknown): unknown => (e as { id?: unknown } | null)?.id;

function reasonOf(d: Diagnostic): string {
  const where = d.path ? ` (at ${d.path})` : '';
  return `${d.code}: ${d.message}${where}`;
}

/**
 * Split a research plan into the entries the gate accepts and the ones it refuses (P5 A2).
 *
 * A diagnostic tied to ONE entry drops that entry: provenance diagnostics carry their entry id
 * (EntryIdMap, gates/provenance.ts), shape diagnostics carry an ajv `instancePath` under
 * `/patterns/<n>/`. A diagnostic tied to no entry (the plan's own shape — a missing top-level key,
 * `patterns` not an array) rejects the whole plan with ResearchPlanError, exactly as before. The
 * gate is re-run on what is left until it is clean, so a validator that reports only its first
 * error still reaches every bad entry (bounded: each round removes at least one entry).
 */
export function partitionResearchPlan(
  parsed: unknown,
  ctx?: ResolveCtx,
): { plan: ResearchPlan; dropped: DroppedEntry[] } {
  const dropped: DroppedEntry[] = [];
  let current: unknown = parsed;
  for (;;) {
    const entryIds: EntryIdMap = new WeakMap();
    const result = checkResearchPlan(current, ctx, entryIds);
    if (result.ok) return { plan: result.plan, dropped };

    // A whole-plan rejection keeps validateResearchPlan's message (the CLI's exit-3 reason line,
    // read by setup.d/80-rule-bootstrap.sh) — it throws here because the plan is not ok.
    const rejectWholePlan = (): never => {
      validateResearchPlan(current, ctx);
      throw new ResearchPlanError('unknown validation failure', result.diagnostics);
    };
    const patterns = (current as { patterns?: unknown }).patterns;
    if (!Array.isArray(patterns)) return rejectWholePlan();
    const dropIdx = new Map<number, string[]>();
    const topLevel: Diagnostic[] = [];
    for (const d of result.diagnostics) {
      const byPath = d.path ? ENTRY_PATH_RE.exec(d.path) : null;
      const byId = entryIds.get(d);
      let idx: number[] = [];
      if (byPath) idx = [Number(byPath[1])];
      else if (byId !== undefined) {
        // gates/provenance.ts records '<unknown>' for an entry without a string id.
        const matches = (e: unknown): boolean =>
          byId === '<unknown>' ? typeof idOf(e) !== 'string' : idOf(e) === byId;
        idx = patterns.flatMap((e, i) => (matches(e) ? [i] : []));
      }
      if (idx.length === 0) topLevel.push(d);
      for (const i of idx) dropIdx.set(i, [...(dropIdx.get(i) ?? []), reasonOf(d)]);
    }
    if (topLevel.length > 0 || dropIdx.size === 0) return rejectWholePlan();
    for (const [i, reasons] of [...dropIdx.entries()].sort((a, b) => a[0] - b[0])) {
      const id = idOf(patterns[i]);
      dropped.push({ id: typeof id === 'string' ? id : `#${i}`, reason: reasons.join('; ') });
    }
    current = { ...(current as object), patterns: patterns.filter((_, i) => !dropIdx.has(i)) };
  }
}

/**
 * Research-half live client. Reads a committed ResearchPlan JSON and runs the
 * EXTERNAL-facing validator (schema + provenance host-gate) — Trust boundary #1 — per entry:
 * a refused entry is dropped and named (one `[rule-bootstrap] dropped research entry` line each,
 * read by setup.d/80-rule-bootstrap.sh into the NOT wired summary); the kept entries go on.
 * A plan-level shape error still throws ResearchPlanError; the CLI catches it → exit 3 + guidance
 * (Decision B, never a silent bad rule).
 */
export class FileResearchClient implements RuleResearchClient {
  /** Entries the last `research()` call dropped, in plan order. */
  dropped: DroppedEntry[] = [];

  constructor(
    private readonly planPath: string,
    private readonly opts: { root?: string; log?: (msg: string) => void } = {},
  ) {}

  async research(_detection: DetectionResult): Promise<ResearchPlan> {
    const raw = readFileSync(this.planPath, 'utf8');
    const parsed: unknown = JSON.parse(raw);
    // DN #7 Option A (Task 2.6): thread the consumer-root/cwd notion this call
    // path already holds — this CLI's entrypoint (rule-bootstrap-cli.ts)
    // defaults its own consumerRoot to process.cwd() too, so this is the
    // same root the surrounding install-time run targets, not a guess.
    // ecosystem-wiring W2: resolveCtxForRoot picks the adapter by detected stack
    // (was a hardcoded npmAdapter) so a python/cargo consumer gets its Tier-1.
    const ctx = resolveCtxForRoot(this.opts.root ?? process.cwd());
    const { plan, dropped } = partitionResearchPlan(parsed, ctx);
    const log = this.opts.log ?? ((m: string) => process.stderr.write(m + '\n'));
    for (const d of dropped) log(`[rule-bootstrap] dropped research entry ${d.id} — ${d.reason}`);
    this.dropped = dropped;
    return plan;
  }
}

/**
 * Generate-half live client. Reads a committed GenerateSelection JSON and returns it
 * verbatim (ignores `menu`, like stubGenerateNextImage). Trust boundary #2 is L4
 * downstream (executable roundtrip + anti-vacuity) PLUS the withManualDrop backstop.
 */
export class FileGenerateClient implements GenerateClient {
  constructor(private readonly selectionPath: string) {}

  async generate(_menu: Menu): Promise<GenerateSelection> {
    const raw = readFileSync(this.selectionPath, 'utf8');
    return JSON.parse(raw) as GenerateSelection;
  }
}

/**
 * Would this candidate route to check.type:'manual' in synthesizeGenerate?
 * READ-ONLY mirror of generate.ts:60-75 (factory untouched): a candidate is
 * declarative-expressible iff presence:'forbid' AND selector; eslint-expressible iff
 * a non-empty eslintConfig. Neither → manual (an inert rule L4 passes WITHOUT a firing
 * test — the §MAJOR-1 masquerade). Keep in sync with generate.ts routing.
 */
export function routesToManual(c: GenerateCandidate): boolean {
  const declarative = c.presence === 'forbid' && Boolean(c.selector);
  const hasEslintConfig =
    c.eslintConfig !== undefined && Object.keys(c.eslintConfig).length > 0;
  return !declarative && !hasEslintConfig;
}

/**
 * §MAJOR-1 layer-2 backstop (live consume path only). Wraps a GenerateClient and DROPS
 * any candidate that would route to manual, logging it loudly. The honest live flow
 * (agents/rule-researcher.md §MAJOR-1) never emits such a candidate; this is defence in
 * depth so a non-L4-expressible practice can never ship as an inert rule. The stub/CI
 * path does NOT wrap → unaffected (byte-identical behaviour preserved).
 */
export function withManualDrop(
  inner: GenerateClient,
  log: (msg: string) => void = (m) => process.stderr.write(m + '\n'),
): GenerateClient {
  return {
    async generate(menu: Menu): Promise<GenerateSelection> {
      const selection = await inner.generate(menu);
      const rules: GenerateCandidate[] = [];
      for (const c of selection.rules) {
        if (routesToManual(c)) {
          log(
            `[rule-bootstrap] practice '${c.entryId}' researched but not L4-expressible ` +
              `(no forbid-selector, no eslintConfig) — recorded as research-only, NOT shipped as a rule.`,
          );
          continue;
        }
        rules.push(c);
      }
      return { rules };
    },
  };
}
