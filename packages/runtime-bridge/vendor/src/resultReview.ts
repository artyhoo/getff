/**
 * resultReview.ts — narrow runtime adapter for intent-first-result scoped contracts.
 *
 * Owns the RUNTIME side of the intent-contract ecosystem (kickoff §3):
 *
 * 1. **Durable scope extraction** — parse the fenced ```intent-contract JSON block from a
 *    persisted task description / kickoff body. Zero blocks → ordinary unscoped behavior;
 *    exactly one parseable JSON object → scoped; malformed, multiple, unterminated, or
 *    non-object blocks → `invalid`. Fail-closed by construction: `invalid` never degrades
 *    to unscoped («Malformed declared scope never becomes ordinary scope»).
 * 2. **Effect-boundary invocation** — the actual structural validation lives in the
 *    read-only helper `.agents/procedures/intent/helpers/check-result-review.mjs`
 *    (single source of truth, CLI + import surface). This adapter never re-implements
 *    validation; it spawns the helper over stdin/stdout. Vendor import-closure: the
 *    adapter does NOT import the helper module — a vendored copy may live at a different
 *    absolute path, resolved per deployment via `RUNTIME_BRIDGE_INTENT_HELPER`.
 * 3. **Failure conversion** — any validation rejection (including helper I/O failure:
 *    a missing helper must fail CLOSED, never open the gate) becomes
 *    `BackendError(..., 'spec_invalid', backend)`, which `cli/dispatch.ts` treats as
 *    abort-loudly (no fallback degradation).
 *
 * The helper checks structure and identities ONLY; it never infers the product verdict.
 * This adapter inherits that boundary: nothing here reads evidence semantics.
 *
 * Environment (owner configuration — roots NEVER come from the reviewed record):
 * - `RUNTIME_BRIDGE_INTENT_ROOTS` — path-delimiter-separated project/coordination roots
 *   ContentRef paths resolve against after realpath.
 * - `RUNTIME_BRIDGE_INTENT_HELPER` — absolute or cwd-relative path to the helper script.
 * - `RUNTIME_BRIDGE_INTENT_OBSERVED_REVISION` — current observed-input binding; when set,
 *   a review bound to a different revision is `stale_review`. Unset → the staleness arm
 *   is skipped (the owner has not bound a revision for this deployment).
 *
 * @dual-pair: intent-result-review
 */

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { BackendError } from './backend.js';

// ---------------------------------------------------------------------------
// Contract shapes (kickoff §3 binding shapes — structural mirror of the helper's)
// ---------------------------------------------------------------------------

export interface ContentRef {
  path: string;
  sha256: string;
}

export interface IntentContract {
  version: number;
  featureId: string;
  resultId: string;
  mode: 'produce' | 'repair' | 'expand';
  brief: ContentRef;
  shared: ContentRef[];
  essentialPromiseIds: string[];
  producesOrRepairs?: string;
  requiresReview?: ContentRef;
  parentContract?: ContentRef;
}

export interface PlanReview {
  taskId: string;
  contractRef: ContentRef;
  effectivePlanSha256: string;
  taskPreImageSha256: string;
  payloadSha256?: string;
  classification: 'within-contract' | 'contract-revision' | 'product-decision';
  ownerReference: string;
}

export type IntentScopeKind = 'unscoped' | 'scoped' | 'invalid';

export type IntentScope =
  | { kind: 'unscoped' }
  | { kind: 'scoped'; contract: IntentContract }
  | { kind: 'invalid'; reason: string };

// ---------------------------------------------------------------------------
// Fence extraction — fail-closed
// ---------------------------------------------------------------------------

const FENCE_OPEN_RE = /^\s*```intent-contract\s*$/;
const FENCE_CLOSE_RE = /^\s*```\s*$/;

/**
 * Extract the declared intent scope from a persisted task description or kickoff body.
 * Exactly one well-formed fenced block whose body parses to a plain object → scoped.
 * Everything else that is not "zero blocks" is invalid — extraction is syntactic ONLY;
 * semantic shape/identity validation happens in the helper at the effect boundary.
 */
export function extractIntentScope(content: string): IntentScope {
  const lines = content.split(/\r?\n/);
  const blocks: string[] = [];
  let inBlock = false;
  let current: string[] = [];
  for (const line of lines) {
    if (!inBlock && FENCE_OPEN_RE.test(line)) {
      inBlock = true;
      current = [];
      continue;
    }
    if (inBlock && FENCE_CLOSE_RE.test(line)) {
      inBlock = false;
      blocks.push(current.join('\n'));
      continue;
    }
    if (inBlock) current.push(line);
  }
  if (inBlock)
    return { kind: 'invalid', reason: 'intent-contract fence is never closed' };
  if (blocks.length === 0) return { kind: 'unscoped' };
  if (blocks.length > 1) {
    return {
      kind: 'invalid',
      reason: `multiple intent-contract blocks (${blocks.length}) — conflicting declared scope`,
    };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(blocks[0]);
  } catch (err) {
    return {
      kind: 'invalid',
      reason: `intent-contract block is not valid JSON: ${(err as Error).message}`,
    };
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return {
      kind: 'invalid',
      reason: 'intent-contract block must be a JSON object',
    };
  }
  return { kind: 'scoped', contract: parsed as IntentContract };
}

// ---------------------------------------------------------------------------
// Owner configuration (env) + helper invocation
// ---------------------------------------------------------------------------

export interface IntentConfig {
  roots: string[];
  helperPath: string;
  observedRevision?: string;
}

/** Helper result shape — mirrors the helper's own tagged result ({ok:true} | {ok:false, code, reason}). */
export type HelperResult =
  | { ok: true }
  | { ok: false; code: string; reason: string };

/**
 * Resolve the owner configuration. Throws (fail-closed) when a scoped contract must be
 * validated but the deployment has no helper configured — an unconfigurable check is a
 * blocked effect, never an unscoped pass-through.
 */
export function resolveIntentConfig(
  overrides: {
    roots?: string;
    helperPath?: string;
    observedRevision?: string;
  } = {},
): IntentConfig {
  const rootsRaw =
    overrides.roots ?? process.env['RUNTIME_BRIDGE_INTENT_ROOTS'] ?? '';
  const roots = rootsRaw
    .split(process.platform === 'win32' ? ';' : ':')
    .map((r) => r.trim())
    .filter((r) => r.length > 0)
    .map((r) => resolve(r));
  const helperPath =
    overrides.helperPath ?? process.env['RUNTIME_BRIDGE_INTENT_HELPER'] ?? '';
  if (helperPath.length === 0) {
    throw new Error(
      'intent helper not configured: set RUNTIME_BRIDGE_INTENT_HELPER',
    );
  }
  const observedRevision =
    overrides.observedRevision ??
    process.env['RUNTIME_BRIDGE_INTENT_OBSERVED_REVISION'];
  return {
    roots,
    helperPath: resolve(helperPath),
    observedRevision: observedRevision || undefined,
  };
}

/** Run the helper's stdin CLI surfaces. Returns the helper's stdout on exit 0. */
function runHelper(
  helperPath: string,
  flag: '--request' | '--plan-review' | '--pre-image',
  stdinPayload: string,
): { ok: true; stdout: string } | { ok: false; code: string; reason: string } {
  let res;
  try {
    res = spawnSync(process.execPath, [helperPath, flag, '-'], {
      input: stdinPayload,
      encoding: 'utf8',
      timeout: 30_000,
    });
  } catch (err) {
    return {
      ok: false,
      code: 'helper_unavailable',
      reason: `cannot spawn intent helper: ${(err as Error).message}`,
    };
  }
  if (res.error) {
    return {
      ok: false,
      code: 'helper_unavailable',
      reason: `cannot spawn intent helper: ${res.error.message}`,
    };
  }
  if (res.status !== 0) {
    let detail = (res.stderr ?? '').trim();
    if (detail.length === 0) detail = (res.stdout ?? '').trim();
    try {
      const parsed = JSON.parse((res.stdout ?? '').trim()) as {
        code?: string;
        reason?: string;
      };
      if (parsed.code !== undefined)
        detail = `${parsed.code}: ${parsed.reason ?? detail}`;
    } catch {
      /* keep raw detail */
    }
    return {
      ok: false,
      code: 'helper_rejected',
      reason: detail.length > 0 ? detail : `helper exited ${res.status}`,
    };
  }
  return { ok: true, stdout: res.stdout ?? '' };
}

/**
 * Validate a declared scope against the helper: inline contract + owner roots + current
 * observed bindings. `contract.requiresReview` is forwarded as the request's reviewPath —
 * the review record itself is resolved INSIDE the owner roots by the helper, never from a
 * path the reviewed record names about itself. `opts.contractRef` (the PlanReview's named
 * record) additionally triggers the helper's inline↔registered parity check, binding the
 * review to the SAME contract the persisted description declares.
 */
export function validateDeclaredScope(
  contract: IntentContract,
  cfg: IntentConfig,
  opts: { contractRef?: ContentRef } = {},
): HelperResult {
  const request: Record<string, unknown> = {
    roots: cfg.roots,
    contract,
  };
  if (contract.requiresReview !== undefined)
    request['reviewPath'] = contract.requiresReview.path;
  if (cfg.observedRevision !== undefined)
    request['observedRevision'] = cfg.observedRevision;
  if (opts.contractRef !== undefined) request['contractRef'] = opts.contractRef;
  const res = runHelper(cfg.helperPath, '--request', JSON.stringify(request));
  if (!res.ok) return res;
  try {
    return JSON.parse(res.stdout.trim()) as HelperResult;
  } catch {
    return {
      ok: false,
      code: 'helper_output_invalid',
      reason: `helper printed unparseable JSON: ${res.stdout.slice(0, 200)}`,
    };
  }
}

export interface PlanReviewRequest {
  taskId: string;
  contractRef: ContentRef;
  taskPlanSha256: string;
  taskPreImageSha256: string;
  payloadSha256?: string;
  planReview: PlanReview;
}

/** Run the helper's `--plan-review -` binding check (task ID / contract / plan / pre-image / payload). */
export function validatePlanReviewBinding(
  request: PlanReviewRequest,
  cfg: IntentConfig,
): HelperResult {
  const res = runHelper(
    cfg.helperPath,
    '--plan-review',
    JSON.stringify(request),
  );
  if (!res.ok) return res;
  try {
    return JSON.parse(res.stdout.trim()) as HelperResult;
  } catch {
    return {
      ok: false,
      code: 'helper_output_invalid',
      reason: `helper printed unparseable JSON: ${res.stdout.slice(0, 200)}`,
    };
  }
}

/**
 * Canonical pre-image digest of a task row, computed by the SAME helper code the
 * PlanReview validator checks against — the adapter must not re-derive the field list
 * (single source of truth; drift here would fake plan-review binding).
 */
export function taskPreImageDigest(
  task: unknown,
  opts: { helperPath?: string } = {},
): string {
  const cfg = resolveIntentConfig({ helperPath: opts.helperPath });
  const res = runHelper(cfg.helperPath, '--pre-image', JSON.stringify(task));
  if (!res.ok)
    throw new Error(`intent helper pre-image digest failed: ${res.reason}`);
  let parsed: { ok?: boolean; preImageSha256?: string };
  try {
    parsed = JSON.parse(res.stdout.trim()) as {
      ok?: boolean;
      preImageSha256?: string;
    };
  } catch {
    throw new Error(
      `intent helper pre-image output unparseable: ${res.stdout.slice(0, 200)}`,
    );
  }
  if (!parsed.ok || typeof parsed.preImageSha256 !== 'string') {
    throw new Error('intent helper pre-image digest rejected the task row');
  }
  return parsed.preImageSha256;
}

// ---------------------------------------------------------------------------
// Effect-boundary conversion — validation failures become spec_invalid (abort, never degrade)
// ---------------------------------------------------------------------------

/**
 * Check a kickoff/persisted description at an effect boundary. Returns the extracted
 * scope so callers can branch on `scoped` (paused claim, release event, answer guard).
 * Throws `BackendError(..., 'spec_invalid', backend)` when the declared scope is
 * malformed or the helper rejects it — including helper-unconfigured/IO failure
 * (fail closed: infrastructure absence must not open the gate).
 */
export function enforceScope(
  content: string,
  backend: string,
  opts: {
    helperPath?: string;
    roots?: string[];
    observedRevision?: string;
  } = {},
): IntentScope {
  const scope = extractIntentScope(content);
  if (scope.kind === 'unscoped') return scope;
  if (scope.kind === 'invalid') {
    throw new BackendError(
      `declared intent scope is malformed and never becomes ordinary scope: ${scope.reason}`,
      'spec_invalid',
      backend,
    );
  }
  let cfg: IntentConfig;
  try {
    cfg = resolveIntentConfig({
      helperPath: opts.helperPath,
      roots: opts.roots?.join(process.platform === 'win32' ? ';' : ':'),
      observedRevision: opts.observedRevision,
    });
  } catch (err) {
    throw new BackendError(
      `scoped intent contract cannot be validated: ${(err as Error).message}`,
      'spec_invalid',
      backend,
    );
  }
  if (cfg.roots.length === 0) {
    throw new BackendError(
      'scoped intent contract cannot be validated: RUNTIME_BRIDGE_INTENT_ROOTS is not configured',
      'spec_invalid',
      backend,
    );
  }
  const result = validateDeclaredScope(scope.contract, cfg);
  if (!result.ok) {
    throw new BackendError(
      `intent result review rejected the declared scope (${result.code}): ${result.reason}`,
      'spec_invalid',
      backend,
    );
  }
  return scope;
}

// ---------------------------------------------------------------------------
// Answer seam — plan-changing / restarting answers on a scoped task are guarded
// ---------------------------------------------------------------------------

/** The subset of the persisted task row the answer guard reads (AifTaskFull is structurally compatible). */
export interface ScopedTaskRow {
  id: string;
  plan?: string | null;
  description?: string | null;
}

export interface AnswerScopeOptions {
  /** Exact payload bytes the answer will write (the trimmed answer text) — bound by digest. */
  answer?: string;
  /** Path to the authorized PlanReview record; REQUIRED for scoped tasks. */
  reviewPath?: string;
  backend: string;
  helperPath?: string;
  roots?: string[];
  observedRevision?: string;
}

/**
 * Guard a continuation answer against the task's DECLARED scope (persisted description).
 *
 * - unscoped → `{scoped:false}` — ordinary behavior, no owner configuration required.
 * - invalid scope → spec_invalid (fail closed; never ordinary).
 * - scoped → REQUIRES an authorized PlanReview record (`opts.reviewPath`): the record must
 *   (1) survive the helper's current-continuation validation of the declared scope with the
 *   review's own contractRef (inline↔registered parity binds the review to THIS contract),
 *   (2) match task ID, current plan bytes, current task pre-image, and the proposed payload
 *   digest, and (3) classify `within-contract` — S1 HOLDS contract-revision / product-decision
 *   continuations (no serialized owner path is demonstrated yet). Any failure throws
 *   `BackendError(..., 'spec_invalid', backend)`; callers must invoke this BEFORE any write
 *   or event effect.
 */
export function enforceAnswerScope(
  task: ScopedTaskRow,
  opts: AnswerScopeOptions,
): { scoped: boolean } {
  const scope = extractIntentScope(task.description ?? '');
  if (scope.kind === 'unscoped') return { scoped: false };
  if (scope.kind === 'invalid') {
    throw new BackendError(
      `persisted intent scope on task ${task.id} is malformed and never becomes ordinary scope: ${scope.reason}`,
      'spec_invalid',
      opts.backend,
    );
  }
  if (!opts.reviewPath) {
    throw new BackendError(
      `task ${task.id} declares an intent contract — continuation requires an authorized PlanReview record (--review <path>); refusing without one`,
      'spec_invalid',
      opts.backend,
    );
  }
  let cfg: IntentConfig;
  try {
    cfg = resolveIntentConfig({
      helperPath: opts.helperPath,
      roots: opts.roots?.join(process.platform === 'win32' ? ';' : ':'),
      observedRevision: opts.observedRevision,
    });
  } catch (err) {
    throw new BackendError(
      `scoped intent contract cannot be validated: ${(err as Error).message}`,
      'spec_invalid',
      opts.backend,
    );
  }
  if (cfg.roots.length === 0) {
    throw new BackendError(
      'scoped intent contract cannot be validated: RUNTIME_BRIDGE_INTENT_ROOTS is not configured',
      'spec_invalid',
      opts.backend,
    );
  }
  let review: unknown;
  try {
    review = JSON.parse(readFileSync(opts.reviewPath, 'utf8'));
  } catch (err) {
    throw new BackendError(
      `PlanReview record is unreadable or unparseable (${opts.reviewPath}) — a missing record holds, never opens: ${(err as Error).message}`,
      'spec_invalid',
      opts.backend,
    );
  }
  if (review === null || typeof review !== 'object' || Array.isArray(review)) {
    throw new BackendError(
      'PlanReview record must be a JSON object',
      'spec_invalid',
      opts.backend,
    );
  }
  const planReview = review as PlanReview;

  // (1) current continuation validity, with the review's contractRef establishing the
  // registered record the declared (inline) scope must equal — a review naming a
  // different contract is contract_ref_mismatch / declared_scope_mismatch, not a pass.
  const continuation = validateDeclaredScope(scope.contract, cfg, {
    contractRef: planReview.contractRef,
  });
  if (!continuation.ok) {
    throw new BackendError(
      `intent result review rejected the continuation (${continuation.code}): ${continuation.reason}`,
      'spec_invalid',
      opts.backend,
    );
  }

  // (2) exact binding: task ID, current plan bytes, current task pre-image, proposed payload.
  const binding = validatePlanReviewBinding(
    {
      taskId: String(task.id),
      contractRef: planReview.contractRef,
      taskPlanSha256: createHash('sha256')
        .update(task.plan ?? '', 'utf8')
        .digest('hex'),
      taskPreImageSha256: taskPreImageDigest(task, {
        helperPath: cfg.helperPath,
      }),
      ...(opts.answer !== undefined
        ? {
            payloadSha256: createHash('sha256')
              .update(opts.answer, 'utf8')
              .digest('hex'),
          }
        : {}),
      planReview,
    },
    cfg,
  );
  if (!binding.ok) {
    throw new BackendError(
      `PlanReview does not bind the current continuation (${binding.code}): ${binding.reason}`,
      'spec_invalid',
      opts.backend,
    );
  }

  // (3) S1 hold policy: only within-contract continuations proceed.
  if (planReview.classification !== 'within-contract') {
    throw new BackendError(
      `PlanReview classification "${planReview.classification}" is HELD for S1 — only within-contract continuations proceed until a serialized owner path is demonstrated`,
      'spec_invalid',
      opts.backend,
    );
  }
  return { scoped: true };
}
