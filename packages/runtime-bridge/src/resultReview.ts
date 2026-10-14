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
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
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
  previousDescriptionSha256?: string;
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
// A near-miss opener (info-string tail, case drift, space between fence and token,
// word-char suffix — intent-contracts / intent-contract2) must fail CLOSED, never
// degrade the description to unscoped — cold-review M1 (2026-10-10); \b missed the
// word-char-suffix class, dropped per finding 94ac13a2 (2026-10-11).
const FENCE_OPEN_NEAR_MISS_RE = /^\s*```\s*intent-contract/i;

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
    if (!inBlock && FENCE_OPEN_NEAR_MISS_RE.test(line)) {
      if (FENCE_OPEN_RE.test(line)) {
        inBlock = true;
        current = [];
        continue;
      }
      return {
        kind: 'invalid',
        reason: `malformed intent-contract fence opener: "${line.trim()}"`,
      };
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
  decisionsHelperPath?: string;
  orchHome?: string;
}

/** Helper result shape — mirrors the helper's own tagged result ({ok:true} | {ok:false, code, reason}). */
export type HelperResult =
  { ok: true } | { ok: false; code: string; reason: string };

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
    decisionsHelperPath?: string;
    orchHome?: string;
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
    decisionsHelperPath:
      overrides.decisionsHelperPath ??
      process.env['RUNTIME_BRIDGE_INTENT_DECISIONS_HELPER'],
    orchHome: overrides.orchHome ?? process.env['AIF_INTENT_ORCH_HOME'],
  };
}

function selectedAuthority(
  contract: IntentContract,
  cfg: IntentConfig,
):
  | { ok: true; adopted: false }
  | {
      ok: true;
      adopted: true;
      currentBriefRef: ContentRef;
      currentSpecRef: ContentRef;
    }
  | { ok: false; code: string; reason: string } {
  const repoRoot =
    process.env['AIF_INTENT_REPO_ROOT'] ??
    cfg.roots.find((root) =>
      existsSync(
        join(
          root,
          '.claude',
          'orchestrator-prompts',
          'intent-continuity',
          'current-decisions.json',
        ),
      ),
    ) ??
    cfg.roots[0];
  if (!repoRoot)
    return {
      ok: false,
      code: 'owner_root_missing',
      reason: 'current authority needs a project owner root',
    };
  const orchHome =
    cfg.orchHome ?? join(repoRoot, '.claude', 'orchestrator-prompts');
  if (
    !cfg.decisionsHelperPath &&
    !existsSync(join(orchHome, 'intent-continuity', 'current-decisions.json'))
  ) {
    return { ok: true, adopted: false }; // feature has not activated the upgraded selector
  }
  const helper = resolve(
    cfg.decisionsHelperPath ??
      join(dirname(cfg.helperPath), 'current-decisions.mjs'),
  );
  const common = [
    '--feature',
    contract.featureId,
    '--repo-root',
    repoRoot,
    '--roots',
    cfg.roots.join(','),
    '--orch-home',
    orchHome,
  ];
  const call = (
    verb: '--read' | '--check-plan-prep',
  ): Record<string, unknown> => {
    const res = spawnSync(process.execPath, [helper, verb, ...common], {
      encoding: 'utf8',
      timeout: 30_000,
    });
    if (res.error)
      return {
        ok: false,
        code: 'selector_unavailable',
        reason: res.error.message,
      };
    try {
      const parsed = JSON.parse((res.stdout ?? '').trim()) as Record<
        string,
        unknown
      >;
      if (res.status === 0 && parsed.ok === true) return parsed;
      return {
        ok: false,
        code: parsed.code ?? 'selector_rejected',
        reason: parsed.reason ?? 'current selector rejected the effect',
      };
    } catch {
      return {
        ok: false,
        code: 'selector_output_invalid',
        reason: 'current selector did not return one JSON result',
      };
    }
  };
  const read = call('--read');
  if (read.ok !== true) {
    if (read.code === 'feature_missing') return { ok: true, adopted: false };
    return { ok: false, code: String(read.code), reason: String(read.reason) };
  }
  const checked = call('--check-plan-prep');
  if (checked.ok !== true)
    return {
      ok: false,
      code: String(checked.code),
      reason: String(checked.reason),
    };
  const prdRef = (read.currentPrd as { snapshotRef?: ContentRef } | undefined)
    ?.snapshotRef;
  const specRef = (read.currentSpec as { specRef?: ContentRef } | undefined)
    ?.specRef;
  if (
    !prdRef ||
    prdRef.sha256 !== checked.prdSha256 ||
    !specRef ||
    specRef.sha256 !== checked.specSha256
  ) {
    return {
      ok: false,
      code: 'selector_changed',
      reason:
        'current authority changed between selector read and effect check',
    };
  }
  if (
    contract.brief.path !== prdRef.path ||
    contract.brief.sha256 !== prdRef.sha256
  ) {
    return {
      ok: false,
      code: 'current_brief_mismatch',
      reason: 'declared brief differs from the current PRD',
    };
  }
  if (
    !contract.shared.some(
      (ref) => ref.path === specRef.path && ref.sha256 === specRef.sha256,
    )
  ) {
    return {
      ok: false,
      code: 'current_spec_mismatch',
      reason: 'declared shared documents do not bind the current spec',
    };
  }
  return {
    ok: true,
    adopted: true,
    currentBriefRef: prdRef,
    currentSpecRef: specRef,
  };
}

/** Run the helper's stdin CLI surfaces. Returns the helper's stdout on exit 0. */
function runHelper(
  helperPath: string,
  flag: '--request' | '--current-result' | '--plan-review' | '--pre-image',
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
  opts: { contractRef?: ContentRef; currentBriefRef?: ContentRef } = {},
): HelperResult {
  const request: Record<string, unknown> = {
    roots: cfg.roots,
    contract,
  };
  if (contract.requiresReview !== undefined) {
    request[contract.mode === 'repair' ? 'priorReviewPath' : 'reviewPath'] =
      contract.requiresReview.path;
  }
  if (cfg.observedRevision !== undefined)
    request['observedRevision'] = cfg.observedRevision;
  if (opts.contractRef !== undefined) request['contractRef'] = opts.contractRef;
  const res = runHelper(cfg.helperPath, '--request', JSON.stringify(request));
  if (!res.ok) return res;
  try {
    const checked = JSON.parse(res.stdout.trim()) as HelperResult;
    if (!checked.ok || contract.mode !== 'expand' || !opts.currentBriefRef)
      return checked;
    if (!cfg.observedRevision)
      return {
        ok: false,
        code: 'current_revision_missing',
        reason: 'adopted expansion requires the current observed revision',
      };
    const current = runHelper(
      cfg.helperPath,
      '--current-result',
      JSON.stringify({
        roots: cfg.roots,
        contract,
        currentBriefRef: opts.currentBriefRef,
        observedRevision: cfg.observedRevision,
        reviewPath: contract.requiresReview?.path,
        requirePublished: true,
      }),
    );
    if (!current.ok) return current;
    return JSON.parse(current.stdout.trim()) as HelperResult;
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
    decisionsHelperPath?: string;
    orchHome?: string;
    requireAdopted?: boolean;
  } = {},
): IntentScope {
  const scope = extractIntentScope(content);
  if (scope.kind === 'unscoped') {
    if (opts.requireAdopted) {
      throw new BackendError(
        'new kickoff has no adopted intent scope; removed markers cannot turn it into frozen legacy work',
        'spec_invalid',
        backend,
      );
    }
    return scope;
  }
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
      decisionsHelperPath: opts.decisionsHelperPath,
      orchHome: opts.orchHome,
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
  const authority = selectedAuthority(scope.contract, cfg);
  if (!authority.ok) {
    throw new BackendError(
      `current feature authority rejected the effect (${authority.code}): ${authority.reason}`,
      'spec_invalid',
      backend,
    );
  }
  if (opts.requireAdopted && !authority.adopted) {
    throw new BackendError(
      'new kickoff has no adopted feature decision; legacy admission cannot be inferred from an editable marker',
      'spec_invalid',
      backend,
    );
  }
  const result = validateDeclaredScope(scope.contract, cfg, {
    currentBriefRef: authority.adopted ? authority.currentBriefRef : undefined,
  });
  if (!result.ok) {
    throw new BackendError(
      `intent result review rejected the declared scope (${result.code}): ${result.reason}`,
      'spec_invalid',
      backend,
    );
  }
  return scope;
}

function admissionRepoRoot(filePath: string): string | undefined {
  let dir = dirname(resolve(filePath));
  while (true) {
    if (
      existsSync(
        join(
          dir,
          '.claude',
          'orchestrator-prompts',
          'intent-continuity',
          'current-decisions.json',
        ),
      )
    )
      return dir;
    const parent = dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
}

function admissionOrchHome(repoRoot: string): string {
  return (
    process.env['AIF_INTENT_ORCH_HOME'] ??
    join(repoRoot, '.claude', 'orchestrator-prompts')
  );
}

/** Check exact frozen legacy identity or require an adopted scope before task creation.
 * A missing scope in an unknown kickoff cannot become the legacy route by omission. */
export function enforceKickoffAdmission(
  kickoff: { filePath: string; content: string },
  backend: string,
  opts: {
    repoRoot?: string;
    decisionsHelperPath?: string;
    orchHome?: string;
    helperPath?: string;
    roots?: string[];
  } = {},
): { adopted: boolean; repoRoot?: string } {
  const repoRoot =
    opts.repoRoot ??
    process.env['AIF_INTENT_REPO_ROOT'] ??
    admissionRepoRoot(kickoff.filePath);
  if (!repoRoot) {
    if (opts.orchHome || process.env['AIF_INTENT_ORCH_HOME'])
      throw new BackendError(
        'configured orchestration home has no project owner root',
        'spec_invalid',
        backend,
      );
    return { adopted: false }; // no activated selector in this project
  }
  const orchHome = opts.orchHome ?? admissionOrchHome(repoRoot);
  const selector = join(
    orchHome,
    'intent-continuity',
    'current-decisions.json',
  );
  if (!existsSync(selector)) {
    if (
      opts.orchHome ||
      process.env['AIF_INTENT_ORCH_HOME'] ||
      existsSync(join(orchHome, 'intent-continuity', 'legacy-freeze.json'))
    ) {
      throw new BackendError(
        'adoption selector is missing from the configured orchestration home',
        'spec_invalid',
        backend,
      );
    }
    return { adopted: false }; // this project has not activated intent admission
  }
  if (!existsSync(join(orchHome, 'intent-continuity', 'legacy-freeze.json'))) {
    throw new BackendError(
      'admission freeze is missing; adopted effects cannot start',
      'spec_invalid',
      backend,
    );
  }
  const helperPath = resolve(
    opts.decisionsHelperPath ??
      process.env['RUNTIME_BRIDGE_INTENT_DECISIONS_HELPER'] ??
      join(
        dirname(
          resolve(
            opts.helperPath ??
              process.env['RUNTIME_BRIDGE_INTENT_HELPER'] ??
              'check-result-review.mjs',
          ),
        ),
        'current-decisions.mjs',
      ),
  );
  const res = spawnSync(
    process.execPath,
    [
      helperPath,
      '--classify-artifact',
      '--path',
      kickoff.filePath,
      '--repo-root',
      repoRoot,
      '--orch-home',
      orchHome,
    ],
    { encoding: 'utf8', timeout: 30_000 },
  );
  let classified: {
    ok?: boolean;
    classification?: string;
    sha256?: string;
    reason?: string;
  };
  try {
    classified = JSON.parse((res.stdout ?? '').trim()) as typeof classified;
  } catch {
    throw new BackendError(
      'admission classifier did not return a JSON result',
      'spec_invalid',
      backend,
    );
  }
  if (res.status !== 0 || !classified.ok) {
    throw new BackendError(
      `admission classifier held: ${classified.reason ?? 'unknown error'}`,
      'spec_invalid',
      backend,
    );
  }
  if (
    classified.sha256 !==
    createHash('sha256').update(kickoff.content).digest('hex')
  ) {
    throw new BackendError(
      'kickoff bytes changed between read and admission check',
      'spec_invalid',
      backend,
    );
  }
  if (classified.classification === 'frozen-legacy')
    return { adopted: false, repoRoot };
  if (classified.classification !== 'unknown') {
    throw new BackendError(
      'admission classifier returned an unknown class',
      'spec_invalid',
      backend,
    );
  }
  enforceScope(kickoff.content, backend, {
    helperPath: opts.helperPath,
    roots: opts.roots ?? [repoRoot],
    decisionsHelperPath: opts.decisionsHelperPath,
    orchHome,
    requireAdopted: true,
  });
  return { adopted: true, repoRoot };
}

function taskAdmissionRoot(explicit?: string): string | undefined {
  const configured =
    process.env['AIF_INTENT_REPO_ROOT'] ??
    process.env['RUNTIME_BRIDGE_INTENT_ROOTS']?.split(
      process.platform === 'win32' ? ';' : ':',
    )[0];
  if (explicit && configured && resolve(explicit) !== resolve(configured)) {
    throw new Error(
      'supplied task owner root conflicts with configured owner root',
    );
  }
  if (explicit) return resolve(explicit);
  if (configured) return resolve(configured);
  return admissionRepoRoot(join(process.cwd(), '.intent-task-admission'));
}

function taskReceiptDir(repoRoot: string, taskId: string): string {
  const key = createHash('sha256').update(taskId).digest('hex');
  const selector = join(
    admissionOrchHome(repoRoot),
    'intent-continuity',
    'current-decisions.json',
  );
  return join(dirname(realpathSync(selector)), 'task-adoptions', key);
}

function taskReceiptPath(
  repoRoot: string,
  taskId: string,
  digest: string,
): string {
  return join(taskReceiptDir(repoRoot, taskId), `${digest}.json`);
}

function selectorRepoIdentity(repoRoot: string): string {
  const selector = join(
    admissionOrchHome(repoRoot),
    'intent-continuity',
    'current-decisions.json',
  );
  const parsed = JSON.parse(readFileSync(selector, 'utf8')) as {
    repoIdentity?: string;
  };
  if (!parsed.repoIdentity) throw new Error('selector repoIdentity missing');
  return parsed.repoIdentity;
}

/** A write-once standing adoption identity, outside the editable AIF task description.
 * Claim creates the task paused, then records this before returning the handle. */
export function recordTaskAdoption(
  task: { id: string; description: string },
  repoRoot: string,
  revisionReviewSha256?: string,
): void {
  const scope = extractIntentScope(task.description);
  if (scope.kind !== 'scoped')
    throw new BackendError(
      'adopted task has no valid persisted scope',
      'spec_invalid',
      'aif-handoff',
    );
  let path: string;
  let repoIdentity: string;
  const descriptionSha256 = createHash('sha256')
    .update(task.description)
    .digest('hex');
  try {
    path = taskReceiptPath(repoRoot, task.id, descriptionSha256);
    repoIdentity = selectorRepoIdentity(repoRoot);
  } catch (err) {
    throw new BackendError(
      `adoption selector unavailable: ${(err as Error).message}`,
      'spec_invalid',
      'aif-handoff',
    );
  }
  mkdirSync(dirname(path), { recursive: true });
  const receipt = {
    version: 1,
    repoIdentity,
    taskId: task.id,
    featureId: scope.contract.featureId,
    briefSha256: scope.contract.brief.sha256,
    sharedSha256: scope.contract.shared.map((ref) => ref.sha256),
    descriptionSha256,
    kind: revisionReviewSha256 ? 'revision' : 'claim',
    ...(revisionReviewSha256 ? { revisionReviewSha256 } : {}),
  };
  try {
    writeFileSync(path, `${JSON.stringify(receipt)}\n`, { flag: 'wx' });
  } catch (err) {
    throw new BackendError(
      `cannot publish task adoption receipt: ${(err as Error).message}`,
      'spec_invalid',
      'aif-handoff',
    );
  }
}

/** Bind a newly claimed frozen kickoff to its task ID; text alone is not legacy task identity. */
export function recordLegacyTaskClaim(
  task: { id: string; description: string },
  repoRoot: string,
): void {
  const descriptionSha256 = createHash('sha256')
    .update(task.description)
    .digest('hex');
  const freeze = JSON.parse(
    readFileSync(
      join(
        admissionOrchHome(repoRoot),
        'intent-continuity',
        'legacy-freeze.json',
      ),
      'utf8',
    ),
  ) as {
    repoIdentity?: string;
    artifacts?: Array<{ sha256: string }>;
  };
  if (
    freeze.repoIdentity !== selectorRepoIdentity(repoRoot) ||
    !freeze.artifacts?.some((artifact) => artifact.sha256 === descriptionSha256)
  ) {
    throw new BackendError(
      'legacy claim does not bind an exact frozen kickoff',
      'spec_invalid',
      'aif-handoff',
    );
  }
  const path = taskReceiptPath(repoRoot, task.id, descriptionSha256);
  const receipt = {
    version: 1,
    kind: 'legacy-claim',
    repoIdentity: selectorRepoIdentity(repoRoot),
    taskId: task.id,
    descriptionSha256,
  };
  mkdirSync(dirname(path), { recursive: true });
  try {
    writeFileSync(path, `${JSON.stringify(receipt)}\n`, { flag: 'wx' });
  } catch (err) {
    throw new BackendError(
      `cannot publish legacy task claim: ${(err as Error).message}`,
      'spec_invalid',
      'aif-handoff',
    );
  }
}

/** Recover only a server task proven unchanged and nonterminal since the frozen instant.
 * The receipt is write-once and cannot refresh the frozen kickoff allowlist. */
export function recordRecoveredLegacyTask(
  task: {
    id: string;
    status: string;
    projectId: string;
    createdAt: string;
    updatedAt: string;
  },
  repoRoot: string,
  expectedProjectId: string,
): string {
  const home = join(
    admissionOrchHome(repoRoot),
    'intent-continuity',
  );
  const freeze = JSON.parse(
    readFileSync(join(home, 'legacy-freeze.json'), 'utf8'),
  ) as {
    repoIdentity?: string;
    frozenAt?: string;
  };
  const frozen = Date.parse(freeze.frozenAt ?? '');
  const created = Date.parse(task.createdAt);
  const updated = Date.parse(task.updatedAt);
  if (
    freeze.repoIdentity !== selectorRepoIdentity(repoRoot) ||
    !task.id ||
    !expectedProjectId ||
    task.projectId !== expectedProjectId ||
    !LEGACY_ACTIVE_STATUSES.has(task.status) ||
    !Number.isFinite(frozen) ||
    !Number.isFinite(created) ||
    !Number.isFinite(updated) ||
    created >= frozen ||
    updated > frozen ||
    updated < created
  ) {
    throw new BackendError(
      'task was not proven active and unchanged at the legacy freeze',
      'spec_invalid',
      'aif-handoff',
    );
  }
  const dir = taskReceiptDir(repoRoot, task.id);
  if (existsSync(dir))
    throw new BackendError(
      'task already has admission evidence',
      'spec_invalid',
      'aif-handoff',
    );
  mkdirSync(dir, { recursive: true });
  const path = join(dir, 'legacy-recovery.json');
  const receipt = {
    version: 1,
    kind: 'legacy-recovery',
    repoIdentity: freeze.repoIdentity,
    taskId: task.id,
    projectId: task.projectId,
    statusAtRecovery: task.status,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    frozenAt: freeze.frozenAt,
  };
  writeFileSync(path, `${JSON.stringify(receipt)}\n`, { flag: 'wx' });
  return path;
}

const LEGACY_ACTIVE_STATUSES = new Set([
  'backlog',
  'planning',
  'improve',
  'plan_ready',
  'implementing',
  'review',
  'verify',
]);

/** At every later effect, an unscoped row must still prove frozen legacy identity.
 * A receipt binds the original description bytes, so deleting its marker holds. */
export function enforceTaskAdmission(
  task: {
    id: string;
    description?: string | null;
    createdAt?: string;
    projectId?: string;
  },
  backend: string,
  opts: { repoRoot?: string } = {},
): { adopted: boolean; revisionReviewSha256?: string } {
  let repoRoot: string | undefined;
  try {
    repoRoot = taskAdmissionRoot(opts.repoRoot);
  } catch (err) {
    throw new BackendError((err as Error).message, 'spec_invalid', backend);
  }
  if (!repoRoot) {
    if (process.env['AIF_INTENT_ORCH_HOME'])
      throw new BackendError(
        'configured orchestration home has no project owner root',
        'spec_invalid',
        backend,
      );
    return { adopted: false };
  }
  const home = join(
    admissionOrchHome(repoRoot),
    'intent-continuity',
  );
  const selectorExists = existsSync(join(home, 'current-decisions.json'));
  if (!selectorExists) {
    if (
      process.env['AIF_INTENT_ORCH_HOME'] ||
      existsSync(join(home, 'legacy-freeze.json'))
    ) {
      throw new BackendError(
        'adoption selector is missing while admission evidence exists',
        'spec_invalid',
        backend,
      );
    }
    return { adopted: false };
  }
  let freeze: {
    repoIdentity?: string;
    artifacts?: Array<{ sha256: string }>;
    taskIds?: string[];
    frozenAt?: string;
  };
  try {
    freeze = JSON.parse(
      readFileSync(join(home, 'legacy-freeze.json'), 'utf8'),
    ) as typeof freeze;
    if (!Array.isArray(freeze.artifacts))
      throw new Error('artifacts array missing');
  } catch (err) {
    throw new BackendError(
      `legacy admission freeze unavailable: ${(err as Error).message}`,
      'spec_invalid',
      backend,
    );
  }
  const description = task.description ?? '';
  const digest = createHash('sha256').update(description).digest('hex');
  let receiptPath: string;
  let receiptDir: string;
  let repoIdentity: string;
  try {
    receiptPath = taskReceiptPath(repoRoot, task.id, digest);
    receiptDir = taskReceiptDir(repoRoot, task.id);
    repoIdentity = selectorRepoIdentity(repoRoot);
  } catch (err) {
    throw new BackendError(
      `adoption selector unavailable: ${(err as Error).message}`,
      'spec_invalid',
      backend,
    );
  }
  if (freeze.repoIdentity !== repoIdentity) {
    throw new BackendError(
      'legacy freeze belongs to a different repository identity',
      'spec_invalid',
      backend,
    );
  }
  if (existsSync(receiptPath)) {
    let receipt: {
      version?: number;
      repoIdentity?: string;
      taskId?: string;
      featureId?: string;
      descriptionSha256?: string;
      briefSha256?: string;
      sharedSha256?: string[];
      kind?: string;
      revisionReviewSha256?: string;
    };
    try {
      receipt = JSON.parse(readFileSync(receiptPath, 'utf8')) as typeof receipt;
    } catch (err) {
      throw new BackendError(
        `adoption receipt unreadable: ${(err as Error).message}`,
        'spec_invalid',
        backend,
      );
    }
    if (
      receipt.version === 1 &&
      receipt.kind === 'legacy-claim' &&
      receipt.repoIdentity === repoIdentity &&
      receipt.taskId === task.id &&
      receipt.descriptionSha256 === digest
    )
      return { adopted: false };
    const scope = extractIntentScope(description);
    if (
      receipt.version !== 1 ||
      receipt.repoIdentity !== repoIdentity ||
      receipt.taskId !== task.id ||
      receipt.descriptionSha256 !== digest ||
      scope.kind !== 'scoped' ||
      receipt.featureId !== scope.contract.featureId
    ) {
      throw new BackendError(
        'task adoption receipt no longer binds the persisted description and scope',
        'spec_invalid',
        backend,
      );
    }
    if (receipt.kind !== 'claim' && receipt.kind !== 'revision') {
      throw new BackendError(
        'adoption receipt kind is invalid',
        'spec_invalid',
        backend,
      );
    }
    return {
      adopted: true,
      ...(receipt.kind === 'revision'
        ? { revisionReviewSha256: receipt.revisionReviewSha256 }
        : {}),
    };
  }
  const recoveryPath = join(receiptDir, 'legacy-recovery.json');
  if (existsSync(recoveryPath)) {
    let recovery: {
      version?: number;
      kind?: string;
      repoIdentity?: string;
      taskId?: string;
      projectId?: string;
      statusAtRecovery?: string;
      createdAt?: string;
      updatedAt?: string;
      frozenAt?: string;
    };
    try {
      recovery = JSON.parse(
        readFileSync(recoveryPath, 'utf8'),
      ) as typeof recovery;
      if (readdirSync(receiptDir).length !== 1)
        throw new Error('conflicting task receipts');
    } catch (err) {
      throw new BackendError(
        `legacy recovery receipt unreadable: ${(err as Error).message}`,
        'spec_invalid',
        backend,
      );
    }
    if (
      recovery.version !== 1 ||
      recovery.kind !== 'legacy-recovery' ||
      recovery.repoIdentity !== repoIdentity ||
      recovery.taskId !== task.id ||
      recovery.frozenAt !== freeze.frozenAt ||
      !recovery.projectId ||
      recovery.projectId !== task.projectId ||
      !LEGACY_ACTIVE_STATUSES.has(recovery.statusAtRecovery ?? '') ||
      !Number.isFinite(Date.parse(recovery.createdAt ?? '')) ||
      !Number.isFinite(Date.parse(recovery.updatedAt ?? '')) ||
      Date.parse(recovery.createdAt ?? '') >=
        Date.parse(freeze.frozenAt ?? '') ||
      Date.parse(recovery.updatedAt ?? '') >
        Date.parse(freeze.frozenAt ?? '') ||
      Date.parse(recovery.updatedAt ?? '') <
        Date.parse(recovery.createdAt ?? '')
    ) {
      throw new BackendError(
        'legacy recovery receipt no longer binds the freeze and task',
        'spec_invalid',
        backend,
      );
    }
    return { adopted: false };
  }
  if (existsSync(receiptDir)) {
    throw new BackendError(
      'task adoption receipt no longer binds the persisted description and scope',
      'spec_invalid',
      backend,
    );
  }
  if (freeze.taskIds?.includes(task.id)) return { adopted: false };
  throw new BackendError(
    'task has neither a standing adoption receipt nor an exact frozen legacy identity',
    'spec_invalid',
    backend,
  );
}

// ---------------------------------------------------------------------------
// Answer seam — plan-changing / restarting answers on a scoped task are guarded
// ---------------------------------------------------------------------------

/** The subset of the persisted task row the answer guard reads (AifTaskFull is structurally compatible). */
export interface ScopedTaskRow {
  id: string;
  createdAt?: string;
  projectId?: string;
  plan?: string | null;
  description?: string | null;
  paused?: boolean;
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
  decisionsHelperPath?: string;
  orchHome?: string;
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
 *   digest. Within-contract work continues directly. Contract/product revisions additionally
 *   require the current selected documents, the prior adopted description digest and a new
 *   write-once receipt for the updated persisted payload. Any failure throws
 *   `BackendError(..., 'spec_invalid', backend)`; callers must invoke this BEFORE any write
 *   or event effect.
 */
export function enforceAnswerScope(
  task: ScopedTaskRow,
  opts: AnswerScopeOptions,
): { scoped: boolean } {
  let admission: { adopted: boolean; revisionReviewSha256?: string };
  let revisionNeeded = false;
  try {
    admission = enforceTaskAdmission(task, opts.backend, {
      repoRoot: opts.roots?.[0],
    });
  } catch (err) {
    if (
      !(err instanceof BackendError) ||
      !err.message.includes('adoption receipt no longer binds')
    )
      throw err;
    revisionNeeded = true;
    admission = { adopted: true };
  }
  const scope = extractIntentScope(task.description ?? '');
  if (scope.kind === 'unscoped') {
    if (revisionNeeded)
      throw new BackendError(
        'adopted task scope marker was removed from its persisted description',
        'spec_invalid',
        opts.backend,
      );
    return { scoped: false };
  }
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
      decisionsHelperPath: opts.decisionsHelperPath,
      orchHome: opts.orchHome,
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
  const authority = selectedAuthority(scope.contract, cfg);
  if (!authority.ok) {
    throw new BackendError(
      `current feature authority rejected the continuation (${authority.code}): ${authority.reason}`,
      'spec_invalid',
      opts.backend,
    );
  }
  if (admission.adopted && !authority.adopted) {
    throw new BackendError(
      'adopted task lost its current feature decision',
      'spec_invalid',
      opts.backend,
    );
  }
  let review: unknown;
  let reviewBytes: Buffer;
  try {
    reviewBytes = readFileSync(opts.reviewPath);
    review = JSON.parse(reviewBytes.toString('utf8'));
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
    currentBriefRef: authority.adopted ? authority.currentBriefRef : undefined,
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

  // A document change is allowed only after a new selected decision, a PlanReview of the
  // updated persisted payload, and an immutable receipt linked to the previous payload.
  const reviewSha256 = createHash('sha256').update(reviewBytes).digest('hex');
  if (planReview.classification === 'within-contract') {
    if (revisionNeeded)
      throw new BackendError(
        'changed task payload requires a reviewed revision',
        'spec_invalid',
        opts.backend,
      );
    return { scoped: true };
  }
  if (
    !authority.adopted ||
    !admission.adopted ||
    (planReview.classification !== 'contract-revision' &&
      planReview.classification !== 'product-decision')
  ) {
    throw new BackendError(
      'revised continuation lacks current adopted authority',
      'spec_invalid',
      opts.backend,
    );
  }
  if (revisionNeeded) {
    if (
      task.paused !== true ||
      !/^[0-9a-f]{64}$/.test(planReview.previousDescriptionSha256 ?? '')
    ) {
      throw new BackendError(
        'revised continuation requires a paused task and prior description digest',
        'spec_invalid',
        opts.backend,
      );
    }
    const repoRoot = taskAdmissionRoot(opts.roots?.[0]);
    if (!repoRoot)
      throw new BackendError(
        'revision owner root missing',
        'spec_invalid',
        opts.backend,
      );
    let prior: {
      repoIdentity?: string;
      taskId?: string;
      featureId?: string;
      descriptionSha256?: string;
      briefSha256?: string;
      sharedSha256?: string[];
    };
    try {
      prior = JSON.parse(
        readFileSync(
          taskReceiptPath(
            repoRoot,
            task.id,
            planReview.previousDescriptionSha256!,
          ),
          'utf8',
        ),
      ) as typeof prior;
    } catch (err) {
      throw new BackendError(
        `prior adoption receipt missing: ${(err as Error).message}`,
        'spec_invalid',
        opts.backend,
      );
    }
    if (
      prior.repoIdentity !== selectorRepoIdentity(repoRoot) ||
      prior.taskId !== task.id ||
      prior.featureId !== scope.contract.featureId ||
      prior.descriptionSha256 !== planReview.previousDescriptionSha256
    ) {
      throw new BackendError(
        'prior adoption receipt does not bind this task and feature',
        'spec_invalid',
        opts.backend,
      );
    }
    if (
      planReview.classification === 'product-decision' &&
      prior.briefSha256 === authority.currentBriefRef.sha256
    ) {
      throw new BackendError(
        'product-decision review names no newly approved PRD',
        'spec_invalid',
        opts.backend,
      );
    }
    if (
      planReview.classification === 'contract-revision' &&
      (prior.briefSha256 !== authority.currentBriefRef.sha256 ||
        prior.sharedSha256?.includes(authority.currentSpecRef.sha256))
    ) {
      throw new BackendError(
        'contract-revision review names no newly agreed spec under the same PRD',
        'spec_invalid',
        opts.backend,
      );
    }
    recordTaskAdoption(
      { id: task.id, description: task.description ?? '' },
      repoRoot,
      reviewSha256,
    );
  } else if (admission.revisionReviewSha256 !== reviewSha256) {
    throw new BackendError(
      'revised continuation review differs from its adoption receipt',
      'spec_invalid',
      opts.backend,
    );
  }
  return { scoped: true };
}
