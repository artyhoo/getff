// packages/runtime-bridge/src/ocrCoverage.ts
// Pure comparison of a PARSED public OCR result object against an independent caller
// expectation (getff-ocr-reuse C1a). Shapes and invariants are taken from the PINNED
// public producer snapshots v1.13.3 / 375f64c:
//   - internal/session/manifest.go: coverage arrays are always non-nil (JSON `[]`,
//     never null); `complete` implies non-empty selected AND empty failed
//     (computeTerminal :940-958); item_id is opaque; item_id/path mandatory, other
//     item fields omitempty (all strings); a waived item REQUIRES a non-empty
//     reason (MarkWaived/transition :571-577, :716-718); the producer stamps the
//     same path/old_path/fingerprint on selected and its outcome entry (:911-922);
//     run_failure is an omitempty pointer (absent when nil).
//   - cmd/opencodereview/output.go:380-421: for a manifest-bearing result the root
//     `status` is a copy of `manifest.terminal_state`; `success`/`completed_with_*`
//     are manifest-less legacy shapes.
// Boundary: data comparison ONLY. A `compatible` verdict is NOT evidence that OCR
// executed, used current task criteria/settings, or fulfilled any semantic review
// duty; no invocation, acceptance, publication, filesystem/network I/O, or credential
// operation happens here. Expectations are caller inputs, never read from `raw`.
// The supplied object is never mutated or rewritten.

export interface OcrCoverageExpectation {
  requiredPaths: readonly string[];
  resolvedBase: string;
  resolvedHead: string;
  expectedRange: string;
  expectedOcrVersion: string;
}

export type OcrCoverageHoldReason =
  | 'missing-output'
  | 'malformed-output'
  | 'missing-manifest'
  | 'incompatible-schema'
  | 'wrong-operation'
  | 'wrong-mode'
  | 'incompatible-version'
  | 'stale-identity'
  | 'run-incomplete'
  | 'run-failure'
  | 'inconsistent-coverage'
  | 'incomplete-coverage';

export type OcrCoverageComparison =
  | {
      status: 'compatible';
      processedPaths: string[];
      identity: {
        resolvedBase: string;
        resolvedHead: string;
        exactRange: string;
        ocrVersion: string;
      };
    }
  | { status: 'hold'; reason: OcrCoverageHoldReason; detail: string };

const SCHEMA_VERSION = 'ocr.run-manifest/v1';
const REQUIRED_OPERATION = 'review';
const REQUIRED_MODE = 'range';
const COMPLETE_STATE = 'complete';

const hold = (
  reason: OcrCoverageHoldReason,
  detail: string,
): OcrCoverageComparison => ({
  status: 'hold',
  reason,
  // Keep diagnostics useful without account data or full raw dumps.
  detail: detail.length > 300 ? `${detail.slice(0, 297)}...` : detail,
});

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** A full resolved Git commit object ID: 40-hex (SHA-1) or 64-hex (SHA-256 object
 *  format). A ref name ("staging", "main") or a short ID is NOT a resolved ID —
 *  matching invalid values on both the manifest and expectation sides cannot be
 *  compatible (repair C1a-I1). Case-insensitive shape; comparison stays exact. */
const COMMIT_ID_SHAPE = /^[0-9a-f]{40}$/i;
const COMMIT_ID_256_SHAPE = /^[0-9a-f]{64}$/i;
const isResolvedCommitId = (v: unknown): v is string =>
  typeof v === 'string' &&
  (COMMIT_ID_SHAPE.test(v) || COMMIT_ID_256_SHAPE.test(v));

const isNonBlank = (v: unknown): v is string =>
  typeof v === 'string' && v.trim() !== '';

const typeName = (v: unknown): string => {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  return typeof v;
};

interface CoverageItem {
  id: string;
  path: string;
  oldPath: string | undefined;
  fingerprint: string | undefined;
  reason: string | undefined;
}

/** Read one public coverage item; returns undefined when the entry is not a
 *  well-formed item (non-object, missing/empty item_id or path, or a known
 *  optional field — old_path/fingerprint/classification/reason — of a non-string
 *  type; repair C1a-I2: all five are strings in the public CoverageItem). */
const readItem = (entry: unknown): CoverageItem | undefined => {
  if (!isObject(entry)) return undefined;
  const id = entry['item_id'];
  const path = entry['path'];
  if (typeof id !== 'string' || id === '') return undefined;
  if (typeof path !== 'string' || path === '') return undefined;
  const rawOldPath = entry['old_path'];
  if (rawOldPath !== undefined && typeof rawOldPath !== 'string')
    return undefined;
  const rawFingerprint = entry['fingerprint'];
  if (rawFingerprint !== undefined && typeof rawFingerprint !== 'string')
    return undefined;
  const rawClassification = entry['classification'];
  if (rawClassification !== undefined && typeof rawClassification !== 'string')
    return undefined;
  const rawReason = entry['reason'];
  if (rawReason !== undefined && typeof rawReason !== 'string')
    return undefined;
  return {
    id,
    path,
    oldPath: rawOldPath,
    fingerprint: rawFingerprint,
    reason: rawReason,
  };
};

/** The producer stamps the same item (path, old_path, fingerprint) on selected
 *  and on its outcome entry (manifest.go :911-922 copies one struct), so any
 *  disagreement on these three is inconsistent data (repair C1a-I2). */
const sameItemIdentity = (a: CoverageItem, b: CoverageItem): boolean =>
  a.path === b.path &&
  a.oldPath === b.oldPath &&
  a.fingerprint === b.fingerprint;

const quoteList = (values: readonly string[]): string =>
  `[${values.map((v) => `"${v}"`).join(', ')}]`;

/** Validate the actual public coverage block: five arrays, well-formed items, no
 *  duplicate or conflicting item_ids, and selected == union of the four disjoint
 *  outcome sets. Returns processed paths (completed then reused, input order). */
const validateCoverage = (
  coverage: unknown,
): { ok: true; processedPaths: string[] } | { ok: false; detail: string } => {
  if (!isObject(coverage)) {
    return {
      ok: false,
      detail: `coverage is not an object (got ${typeName(coverage)})`,
    };
  }
  const arrays: Record<string, unknown> = {
    selected: coverage['selected'],
    completed: coverage['completed'],
    reused: coverage['reused'],
    failed: coverage['failed'],
    waived: coverage['waived'],
  };
  for (const [name, arr] of Object.entries(arrays)) {
    // The producer always emits these arrays (JSON `[]`, never null/absent).
    if (!Array.isArray(arr)) {
      return {
        ok: false,
        detail: `coverage.${name} is not an array (got ${typeName(arr)})`,
      };
    }
  }

  // Per-array parse + duplicate item_id detection.
  const parsed: Record<string, CoverageItem[]> = {};
  for (const [name, arr] of Object.entries(arrays)) {
    const items: CoverageItem[] = [];
    const seen = new Map<string, CoverageItem>();
    for (const entry of arr as unknown[]) {
      const it = readItem(entry);
      if (it === undefined) {
        return {
          ok: false,
          detail: `coverage.${name} contains a malformed item (needs non-empty string item_id and path)`,
        };
      }
      const prior = seen.get(it.id);
      if (prior !== undefined) {
        return {
          ok: false,
          detail: `duplicate item_id "${it.id}" within coverage.${name}`,
        };
      }
      // Producer contract (manifest.go MarkWaived :716-718 + transition :571-577):
      // a waived item carries a REQUIRED reason, non-empty after trim. A waived
      // entry without it is inconsistent data (repair C1a-I2).
      if (
        name === 'waived' &&
        (it.reason === undefined || it.reason.trim() === '')
      ) {
        return {
          ok: false,
          detail: `waived item_id "${it.id}" lacks its required non-empty reason`,
        };
      }
      seen.set(it.id, it);
      items.push(it);
    }
    parsed[name] = items;
  }

  // selected must be exactly the union of the four disjoint outcome sets, and the
  // path identity of each selected item must agree with its outcome entry.
  const selectedIds = new Set(parsed['selected'].map((it) => it.id));
  const outcomeById = new Map<
    string,
    { item: CoverageItem; outcome: string }
  >();
  for (const outcome of ['completed', 'reused', 'failed', 'waived'] as const) {
    for (const it of parsed[outcome]) {
      const prior = outcomeById.get(it.id);
      if (prior !== undefined) {
        return {
          ok: false,
          detail: `item_id "${it.id}" appears in both ${prior.outcome} and ${outcome} (conflicting outcome)`,
        };
      }
      outcomeById.set(it.id, { item: it, outcome });
    }
  }
  for (const sel of parsed['selected']) {
    const found = outcomeById.get(sel.id);
    if (found === undefined) {
      return {
        ok: false,
        detail: `selected item_id "${sel.id}" has no outcome entry`,
      };
    }
    if (!sameItemIdentity(sel, found.item)) {
      return {
        ok: false,
        detail: `item_id "${sel.id}" has different path/old_path/fingerprint in selected vs ${found.outcome}`,
      };
    }
  }
  for (const id of outcomeById.keys()) {
    if (!selectedIds.has(id)) {
      return {
        ok: false,
        detail: `outcome item_id "${id}" is missing from selected`,
      };
    }
  }

  return {
    ok: true,
    processedPaths: [...parsed['completed'], ...parsed['reused']].map(
      (it) => it.path,
    ),
  };
};

export function compareOcrCoverage(
  raw: unknown,
  expected: OcrCoverageExpectation,
): OcrCoverageComparison {
  if (raw === null || raw === undefined) {
    return hold(
      'missing-output',
      'OCR result object is null/undefined — no output to compare.',
    );
  }
  if (!isObject(raw)) {
    return hold(
      'malformed-output',
      `OCR result is not an object (got ${typeName(raw)}).`,
    );
  }
  const manifest = raw['manifest'];
  if (manifest === undefined || manifest === null) {
    return hold(
      'missing-manifest',
      'OCR result carries no run manifest object.',
    );
  }
  if (!isObject(manifest)) {
    return hold(
      'malformed-output',
      `manifest is not an object (got ${typeName(manifest)}).`,
    );
  }

  if (manifest['schema_version'] !== SCHEMA_VERSION) {
    return hold(
      'incompatible-schema',
      `manifest.schema_version is ${JSON.stringify(manifest['schema_version'])}, expected "${SCHEMA_VERSION}".`,
    );
  }
  if (manifest['operation'] !== REQUIRED_OPERATION) {
    return hold(
      'wrong-operation',
      `manifest.operation is ${JSON.stringify(manifest['operation'])}, expected "${REQUIRED_OPERATION}".`,
    );
  }
  const input = manifest['input'];
  if (!isObject(input) || input['mode'] !== REQUIRED_MODE) {
    return hold(
      'wrong-mode',
      `manifest.input.mode is ${isObject(input) ? JSON.stringify(input['mode']) : typeName(input)}, expected "${REQUIRED_MODE}".`,
    );
  }
  const execution = manifest['execution'];
  // The version must be a non-blank string on the manifest side before any
  // comparison: a matching empty/whitespace version on BOTH sides is not
  // compatibility (repair C1a-I1).
  if (
    !isObject(execution) ||
    !isNonBlank(execution['ocr_version']) ||
    execution['ocr_version'] !== expected.expectedOcrVersion
  ) {
    const got = isObject(execution)
      ? JSON.stringify(execution['ocr_version'])
      : typeName(execution);
    return hold(
      'incompatible-version',
      `execution.ocr_version is ${got}, expected ${JSON.stringify(expected.expectedOcrVersion)} ` +
        `(both sides must be non-blank).`,
    );
  }

  // Identity comes from the manifest but must match the INDEPENDENT caller
  // expectation; missing/empty/invalid values on either side cannot be compatible.
  // Each side must be independently well-formed BEFORE comparison (repair C1a-I1):
  // resolved_base/resolved_head are FULL resolved commit object IDs (40/64-hex —
  // a PR ref like "staging" or a short ID is not one), and the range equals
  // resolved_base + '..' + resolved_head on both sides. Matching invalid values
  // never become compatibility.
  const resolvedBase = input['resolved_base'];
  const resolvedHead = input['resolved_head'];
  const exactRange = input['exact_range'];
  const identityOk =
    isResolvedCommitId(resolvedBase) &&
    isResolvedCommitId(resolvedHead) &&
    isNonBlank(exactRange) &&
    isResolvedCommitId(expected.resolvedBase) &&
    isResolvedCommitId(expected.resolvedHead) &&
    isNonBlank(expected.expectedRange) &&
    isNonBlank(expected.expectedOcrVersion) &&
    resolvedBase === expected.resolvedBase &&
    resolvedHead === expected.resolvedHead &&
    exactRange === expected.expectedRange &&
    exactRange === `${resolvedBase}..${resolvedHead}` &&
    expected.expectedRange ===
      `${expected.resolvedBase}..${expected.resolvedHead}`;
  if (!identityOk) {
    return hold(
      'stale-identity',
      `manifest identity (${JSON.stringify(resolvedBase)}..${JSON.stringify(resolvedHead)}, ` +
        `range ${JSON.stringify(exactRange)}) does not match the expected identity ` +
        `(${JSON.stringify(expected.resolvedBase)}..${JSON.stringify(expected.resolvedHead)}, ` +
        `range ${JSON.stringify(expected.expectedRange)}).`,
    );
  }

  const runFailure = manifest['run_failure'];
  if (runFailure !== undefined && runFailure !== null) {
    const rf = isObject(runFailure) ? runFailure : {};
    const classification =
      typeof rf['classification'] === 'string'
        ? rf['classification']
        : 'unknown';
    const reason = typeof rf['reason'] === 'string' ? rf['reason'] : 'unknown';
    return hold(
      'run-failure',
      `manifest.run_failure is present (classification "${classification}", reason "${reason}") — ` +
        `compatible data cannot establish this run even with all required paths processed.`,
    );
  }

  const terminalState = manifest['terminal_state'];
  const rootStatus = raw['status'];
  if (terminalState !== COMPLETE_STATE || rootStatus !== COMPLETE_STATE) {
    return hold(
      'run-incomplete',
      `terminal_state ${JSON.stringify(terminalState)} / root status ${JSON.stringify(rootStatus)} — ` +
        `a manifest-bearing result requires both to be "${COMPLETE_STATE}" ` +
        `(root status is copied from terminal_state; legacy "success"/"completed_with_*" are ` +
        `manifest-less shapes and cannot establish this operation).`,
    );
  }

  const coverageResult = validateCoverage(manifest['coverage']);
  if (!coverageResult.ok) {
    return hold('inconsistent-coverage', coverageResult.detail);
  }
  const selected = manifest['coverage'] as Record<string, unknown>;
  // Producer rule (manifest.go computeTerminal): "complete" implies non-empty
  // selected AND empty failed. Any other combination is producer-impossible data.
  if (
    !Array.isArray(selected['selected']) ||
    (selected['selected'] as unknown[]).length === 0
  ) {
    return hold(
      'inconsistent-coverage',
      'terminal_state "complete" with an empty selected set is inconsistent with the public producer.',
    );
  }
  if (
    !Array.isArray(selected['failed']) ||
    (selected['failed'] as unknown[]).length !== 0
  ) {
    return hold(
      'inconsistent-coverage',
      'terminal_state "complete" with a non-empty failed set is inconsistent with the public producer ' +
        '(even a failed non-required item).',
    );
  }

  // processedPaths come only from completed/reused; every independently required
  // path must appear, regardless of upstream completion or filtering.
  const processedSet = new Set(coverageResult.processedPaths);
  const missing = expected.requiredPaths.filter((p) => !processedSet.has(p));
  if (missing.length > 0) {
    return hold(
      'incomplete-coverage',
      `required paths not processed: ${quoteList(missing)} ` +
        `(processed from completed/reused only: ${quoteList(coverageResult.processedPaths)}).`,
    );
  }

  return {
    status: 'compatible',
    processedPaths: coverageResult.processedPaths,
    identity: {
      resolvedBase: resolvedBase,
      resolvedHead: resolvedHead,
      exactRange: exactRange,
      ocrVersion: expected.expectedOcrVersion,
    },
  };
}
