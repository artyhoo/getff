// Dot review report validator — format AND semantics for the admission contract.
//
// Spec: docs/superpowers/specs/2026-10-05-dot-staging-review-gate-design.md §7.
// The normative schema (docs/meta-factory/dot-review-result.schema.json) covers shape
// and the kind/GO conditionals. What JSON Schema cannot see, this module checks:
//   - byte-level strictness (duplicate keys, payload ≤ 1 MiB, nesting ≤ 64) — strict-json;
//   - line-range ordering, timestamp ordering/future skew;
//   - inventory↔policy coverage (missing/unknown principle IDs);
//   - counts vs arrays, reviewed ⊆ changed, duplicate IDs (dimensions, principles);
//   - failure/failure_reason consistency; dot-review/* can never be mechanical evidence;
//   - current-tuple match (publisher layer): revision, policy digest, protocol, repo, PR;
//   - only kind=admission + COMPLETE + GO can be authorizing; baseline/historical GO
//     can never authorize an open PR (E_KIND_RECAST), no field-recast loophole.
//
// Usage (module): validateReport(text, {schemaBytes, schemaBytesV2, policy, now, currentState, trustedInventory})
//   → {ok, authorizing, errors:[{code, path?, message}], nonAuthorizing:[{code, message}], report?}
//   `ok` = acceptable document (persisted, routed); `authorizing` = may authorize an
//   admission. Dispatches on protocol_version: dot-pr-review/2.0.0 documents take the
//   V2 path (schemaBytesV2 = the PINNED docs-lane schema bytes); everything else is
//   V1. Non-authorizing status is a named marker in nonAuthorizing, never an error.
//   trustedInventory is the TRUSTED changed-file list (the diff the service reads from
//   GitHub and pins to the generation at claim time — review R4). An admission in a
//   live context without one fails closed (E_NO_INVENTORY): a report may not be the
//   only witness of what changed.
// Usage (CLI): node validate-report.mjs <report.json> --schema <schema.json> [--policy <policy.json>] [--now <ISO>]

import { createRequire } from 'node:module';
import { parseStrictJson } from './strict-json.mjs';
import { sha256Hex } from './digest.mjs';
import { isMainEntry } from '../lib/is-main-entry.mjs';

const require = createRequire(
  new URL('../../packages/core/package.json', import.meta.url),
);
// ajv resolves through packages/core's declared dependency (SSOT prior-art #194, ADOPT),
// not through a hoisted root copy — pnpm hoisting is not a contract.
const Ajv2020 = require('ajv/dist/2020');
const addFormats = require('ajv-formats');

const FUTURE_SKEW_MS = 5 * 60 * 1000;

const schemaCache = new Map(); // schemaBytes sha256 → compiled validator

function loadSchema(schemaBytes) {
  const key = sha256Hex(schemaBytes);
  const hit = schemaCache.get(key);
  if (hit) return hit;
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);
  const schema = JSON.parse(schemaBytes.toString('utf8'));
  const validate = ajv.compile(schema);
  schemaCache.set(key, validate);
  return validate;
}

export function validateReport(text, { schemaBytes, schemaBytesV2, policy, now, currentState, trustedInventory } = {}) {
  const errors = [];
  const nonAuthorizing = [];
  let report;
  try {
    report = parseStrictJson(text ?? '');
  } catch (e) {
    return { ok: false, report: undefined, errors: [{ code: e.code || 'E_PARSE', message: e.message }] };
  }

  // V2 dispatch: a DotPRReviewV2 document never enters the V1 machinery — the two
  // contracts share nothing at field level and a validator must not accidentally
  // interpret V2 as V1 (follow-up packet §10). The pinned schema validates it; the
  // semantics below carry what JSON Schema cannot see.
  if (report && typeof report === 'object' && report.protocol_version === 'dot-pr-review/2.0.0') {
    return validateV2Report(report, { schemaBytesV2, policy, now, currentState, trustedInventory });
  }

  if (schemaBytes) {
    try {
      const validate = loadSchema(schemaBytes);
      if (!validate(report)) {
        for (const err of validate.errors ?? []) {
          errors.push({
            code: 'E_SCHEMA',
            path: err.instancePath,
            message: `${err.instancePath || '/'} ${err.message}`,
          });
        }
      }
    } catch (e) {
      errors.push({ code: 'E_SCHEMA_COMPILE', message: e.message });
    }
  }

  semanticChecks(report, errors, { policy, now });

  // R4: an admission in a live context must cover EXACTLY the trusted changed-file
  // inventory — not a self-consistent subset of its own claims.
  if (report?.kind === 'admission' && (currentState || trustedInventory)) {
    inventoryChecks(report, errors, { policy, trustedInventory });
  }

  if (currentState) tupleChecks(report, errors, currentState);

  // Acceptance ≠ admission (follow-up packet increment 2): `ok` says the document is
  // acceptable (format, schema, semantics, inventory, tuple); `authorizing` says it can
  // authorize an admission. A valid REVISE/PARTIAL/historical review is an acceptable
  // document — it is persisted and routed to corrective work — and carries its named
  // non-authorizing marker (E_NOT_AUTHORIZING / E_KIND_RECAST) in `nonAuthorizing`,
  // never in `errors`: an acceptance rejection here used to 422 valid reviews before
  // the ledger ever saw them, leaving the publisher's failure path unreachable.
  const authorizing =
    report?.kind === 'admission' && report?.completion === 'COMPLETE' && report?.verdict === 'GO';
  if (!authorizing && report && typeof report === 'object' && typeof report.verdict === 'string') {
    nonAuthorizing.push({
      code: report.kind !== 'admission' ? 'E_KIND_RECAST' : 'E_NOT_AUTHORIZING',
      message: `kind=${report.kind} completion=${report.completion} verdict=${report.verdict} cannot authorize admission`,
    });
  }

  return { ok: errors.length === 0, authorizing, report, errors, nonAuthorizing };
}

// ── DotPRReviewV2 (dot-pr-review/2.0.0) ────────────────────────────────────────
// Schema: the PINNED docs-lane bytes (tests/dot-review-gate/fixtures/v2/schema.json,
// receipt sha256 b110a641…) — never a re-designed copy. What the schema cannot see,
// checked here per the follow-up packet §5:
//   - COMPLETE coverage requires EVERY one of the seven role dimensions present
//     exactly once (all-path accounting is not dimension coverage); any UNVERIFIED
//     required dimension forces coverage PARTIAL;
//   - the live tuple and the trusted changed-file inventory are re-checked against
//     review_identity/scope — the report is never its own witness;
//   - authorizing = review_report ∧ GO ∧ COMPLETE ∧ prior review SUFFICIENT ∧ no
//     blocking finding (PARTIAL/UNKNOWN/INSUFFICIENT never authorize by default).
const V2_DIMENSION_IDS = [
  'GOAL_ARCHITECTURE', 'AI_DOC_AUTHORITY', 'SKILL_RULE_ROUTING', 'AGNOSTICISM_PORTABILITY',
  'CONTEXT_ECONOMY', 'DETERMINISTIC_ENFORCEMENT', 'PRIOR_REVIEW_ADEQUACY',
];
const v2SchemaCache = new Map();

function loadV2Schema(schemaBytes) {
  const key = sha256Hex(schemaBytes);
  const hit = v2SchemaCache.get(key);
  if (hit) return hit;
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);
  const validate = ajv.compile(JSON.parse(schemaBytes.toString('utf8')));
  v2SchemaCache.set(key, validate);
  return validate;
}

function validateV2Report(report, { schemaBytesV2, policy, now, currentState, trustedInventory } = {}) {
  void now;
  const errors = [];
  const nonAuthorizing = [];

  // DR-R4: fail closed — a DotPRReviewV2 document is never validated schema-less.
  // Absent (or wrong-length) V2 bytes are a configuration error, and silently
  // skipping AJV used to accept documents the pinned contract rejects.
  if (!schemaBytesV2 || schemaBytesV2.length === 0) {
    errors.push({ code: 'E_SCHEMA', message: 'a dot-pr-review/2.0.0 document requires the pinned V2 schema bytes — refusing schema-less validation' });
    return { ok: false, authorizing: false, report, errors, nonAuthorizing };
  }

  // SP-3: the operational pin. Presence (DR-R4) is not a pin — the packet's probe
  // validated documents against permissive {"type":"object"} bytes while the policy
  // pointed at the canonical schema. Whatever bytes flow through here must digest
  // to the policy's schema_v2_sha256, and a policy that can carry a V2 document
  // without the pin is a configuration error, not a weaker check.
  if (policy) {
    const pinSha = sha256Hex(schemaBytesV2);
    if (policy.schema_v2_sha256 !== pinSha) {
      const why = policy.schema_v2_sha256 === undefined
        ? 'the policy does not pin schema_v2_sha256 — a dot-pr-review/2.0.0 document cannot be validated without an operational schema pin'
        : `policy pins schema_v2_sha256 ${policy.schema_v2_sha256} but the provided V2 schema bytes digest to ${pinSha}`;
      errors.push({ code: 'E_SCHEMA_PIN_V2', message: why });
      return { ok: false, authorizing: false, report, errors, nonAuthorizing };
    }
  }

  {
    try {
      const validate = loadV2Schema(schemaBytesV2);
      if (!validate(report)) {
        for (const err of validate.errors ?? []) {
          errors.push({ code: 'E_SCHEMA', path: err.instancePath, message: `${err.instancePath || '/'} ${err.message}` });
        }
      }
    } catch (e) {
      errors.push({ code: 'E_SCHEMA_COMPILE', message: e.message });
    }
  }

  if (report?.record_type === 'review_report') {
    const dims = Array.isArray(report.dimensions) ? report.dimensions : [];
    dupCheck(dims.map((x) => x?.dimension), '/dimensions', errors);
    const present = new Set(dims.map((x) => x?.dimension));
    const missing = V2_DIMENSION_IDS.filter((id) => !present.has(id));
    if (missing.length > 0) {
      errors.push({ code: 'E_V2_DIMENSIONS', path: '/dimensions', message: `system coverage requires every role dimension assessed; missing ${missing.join(', ')}` });
    }
    const unverified = dims.filter((x) => x?.status === 'UNVERIFIED').map((x) => x?.dimension);
    if (report.assessments?.system_coverage === 'COMPLETE' && unverified.length > 0) {
      errors.push({ code: 'E_V2_COVERAGE', path: '/assessments/system_coverage', message: `COMPLETE coverage contradicts UNVERIFIED dimensions (${unverified.join(', ')}) — coverage is PARTIAL` });
    }

    if (currentState) {
      const id = report.review_identity ?? {};
      const mismatches = [];
      if (id.repository?.id !== undefined && id.repository.id !== currentState.repository_id) mismatches.push('repository_id');
      const pr = id.pull_request;
      if (pr && currentState.pr_number !== undefined && pr.number !== currentState.pr_number) mismatches.push('pr_number');
      if (pr && currentState.pr_node_id !== undefined && pr.node_id !== currentState.pr_node_id) mismatches.push('pr_node_id');
      const rev = id.revisions ?? {};
      for (const k of ['base_sha', 'head_sha', 'merge_base_sha', 'tested_merge_sha']) {
        if (currentState[k] !== undefined && currentState[k] !== null && rev[k] !== currentState[k]) mismatches.push(k);
      }
      if (currentState.policy_sha256 !== undefined && id.policy?.sha256 !== currentState.policy_sha256) mismatches.push('policy_sha256');
      if (currentState.protocol_version !== undefined && report.protocol_version !== currentState.protocol_version) mismatches.push('protocol_version');
      if (mismatches.length > 0) {
        errors.push({ code: 'E_TUPLE', path: '/review_identity', message: `report does not match the current tuple: ${mismatches.join(', ')}` });
      }

      // trusted inventory: an OPEN_PR review accounts for EXACTLY the trusted diff —
      // both directions, regardless of each path's treatment label
      if (id.mode === 'OPEN_PR') {
        const claimed = (report.scope?.changed_paths ?? []).map((c) => c?.path).filter((p) => typeof p === 'string');
        if (!Array.isArray(trustedInventory?.changed_files)) {
          errors.push({ code: 'E_NO_INVENTORY', path: '/scope/changed_paths', message: 'an OPEN_PR review requires the trusted changed-file inventory' });
        } else {
          const trusted = trustedInventory.changed_files;
          if (new Set(claimed).size !== claimed.length) {
            errors.push({ code: 'E_DUP_CHANGED', path: '/scope/changed_paths', message: 'changed_paths carries duplicate paths' });
          }
          const claimedSet = new Set(claimed);
          for (const p of trusted) {
            if (!claimedSet.has(p)) errors.push({ code: 'E_CHANGED_MISSING', path: '/scope/changed_paths', message: `trusted changed file "${p}" is absent from the review scope` });
          }
          for (const p of claimedSet) {
            if (!trusted.includes(p)) errors.push({ code: 'E_CHANGED_UNKNOWN', path: '/scope/changed_paths', message: `"${p}" is not in the trusted changed-file inventory` });
          }
        }
      }
    }
  }

  // Only an OPEN_PR review can authorize a merge: a HISTORICAL record describes an
  // already-merged source and never becomes merge-eligible; a FOLLOW_UP routes
  // corrective work. The record itself stays a valid, acceptable document.
  const mode = report?.review_identity?.mode;
  const authorizing =
    report?.record_type === 'review_report' &&
    mode === 'OPEN_PR' &&
    report?.verdict?.outcome === 'GO' &&
    report?.assessments?.system_coverage === 'COMPLETE' &&
    report?.assessments?.prior_review_sufficiency === 'SUFFICIENT' &&
    !(report?.findings ?? []).some((f) => f?.blocking === true);
  if (!authorizing && report?.record_type === 'review_report') {
    const why = [
      mode !== 'OPEN_PR' && `mode ${mode ?? 'absent'} — only an OPEN_PR review authorizes a merge`,
      report?.verdict?.outcome !== 'GO' && `verdict ${report?.verdict?.outcome}`,
      report?.assessments?.system_coverage !== 'COMPLETE' && `coverage ${report?.assessments?.system_coverage}`,
      report?.assessments?.prior_review_sufficiency !== 'SUFFICIENT' && `prior review ${report?.assessments?.prior_review_sufficiency}`,
      (report?.findings ?? []).some((f) => f?.blocking === true) && 'blocking findings open',
    ].filter(Boolean).join(', ');
    nonAuthorizing.push({
      code: 'E_NOT_AUTHORIZING',
      message: `record cannot authorize a merge (${why})`,
    });
  }

  return { ok: errors.length === 0, authorizing, report, errors, nonAuthorizing };
}

function semanticChecks(r, errors, { policy, now }) {
  if (typeof r !== 'object' || r === null) return;

  // line ranges: start ≤ end on every evidence object, wherever it appears
  walkEvidence(r, (ev, path) => {
    if (
      Number.isInteger(ev.line_start) &&
      Number.isInteger(ev.line_end) &&
      ev.line_start > ev.line_end
    ) {
      errors.push({ code: 'E_LINE_RANGE', path, message: `line_start ${ev.line_start} > line_end ${ev.line_end}` });
    }
  });

  // execution timestamps: ordered, not in the future beyond clock skew
  const ex = r.execution;
  if (ex && typeof ex === 'object') {
    const start = Date.parse(ex.started_at);
    const end = Date.parse(ex.finished_at);
    if (Number.isFinite(start) && Number.isFinite(end)) {
      if (end < start) errors.push({ code: 'E_TIME_ORDER', path: '/execution', message: 'finished_at precedes started_at' });
    }
    if (now) {
      const nowMs = Date.parse(now);
      if (Number.isFinite(end) && Number.isFinite(nowMs) && end > nowMs + FUTURE_SKEW_MS) {
        errors.push({ code: 'E_TIME_FUTURE', path: '/execution/finished_at', message: 'finished_at is in the future' });
      }
    }
    // failure ↔ reason consistency (schema types it, cannot correlate)
    if (ex.failure === true && (ex.failure_reason === null || ex.failure_reason === undefined)) {
      errors.push({ code: 'E_FAILURE', path: '/execution/failure_reason', message: 'failure=true requires failure_reason' });
    }
  }

  // coverage: counts vs arrays, reviewed ⊆ changed
  const cov = r.coverage;
  if (cov && typeof cov === 'object') {
    if (Array.isArray(cov.changed_files) && Number.isInteger(cov.changed_count) && cov.changed_count !== cov.changed_files.length) {
      errors.push({ code: 'E_COUNT', path: '/coverage/changed_count', message: `changed_count ${cov.changed_count} != ${cov.changed_files.length} entries` });
    }
    if (Array.isArray(cov.reviewed_files) && Number.isInteger(cov.reviewed_count) && cov.reviewed_count !== cov.reviewed_files.length) {
      errors.push({ code: 'E_COUNT', path: '/coverage/reviewed_count', message: `reviewed_count ${cov.reviewed_count} != ${cov.reviewed_files.length} entries` });
    }
    if (Array.isArray(cov.changed_files) && Array.isArray(cov.reviewed_files)) {
      const changed = new Set(cov.changed_files);
      cov.reviewed_files.forEach((rf, i) => {
        if (rf && typeof rf === 'object' && !changed.has(rf.path)) {
          errors.push({ code: 'E_REVIEWED_SUBSET', path: `/coverage/reviewed_files/${i}`, message: `reviewed file "${rf.path}" is not in changed_files` });
        }
      });
    }
    // dimensions: the 11 mandatory ids, no duplicates
    if (Array.isArray(cov.dimensions)) {
      dupCheck(cov.dimensions.map((d) => d && d.id), '/coverage/dimensions', errors);
    }
  }

  // principle/goal/spec assessments: duplicate ids
  for (const [field, label] of [['principle_evidence', 'principle'], ['goal_evidence', 'goal']]) {
    if (Array.isArray(r[field])) dupCheck(r[field].map((a) => a && a.id), `/${field}`, errors);
  }

  // findings: duplicate stable ids
  if (Array.isArray(r.findings)) dupCheck(r.findings.map((f) => f && f.id), '/findings', errors);

  // mechanical evidence: dot-review/* can never be mechanical evidence (circular
  // waiting prevention — the Dot check must not qualify its own prerequisite set)
  if (Array.isArray(r.mechanical_evidence)) {
    r.mechanical_evidence.forEach((m, i) => {
      if (m && typeof m.context === 'string' && m.context.startsWith('dot-review/')) {
        errors.push({ code: 'E_DOT_MECHANICAL', path: `/mechanical_evidence/${i}`, message: `"${m.context}" is not a mechanical context` });
      }
    });
  }

  // policy inventory coverage: every trusted principle ID assessed, none invented
  if (policy && Array.isArray(policy.principle_inventory) && Array.isArray(r.principle_evidence)) {
    const assessed = new Map(r.principle_evidence.map((a) => [a && a.id, a]));
    for (const id of policy.principle_inventory) {
      if (!assessed.has(id)) {
        errors.push({ code: 'E_INVENTORY', path: '/principle_evidence', message: `trusted principle "${id}" has no assessment` });
      }
    }
    for (const [id] of assessed) {
      if (id !== null && id !== undefined && !policy.principle_inventory.includes(id)) {
        errors.push({ code: 'E_INVENTORY', path: '/principle_evidence', message: `"${id}" is not in the trusted principle inventory` });
      }
    }
  }
}

// R4: exact coverage against the trusted changed-file inventory + complete
// specification inventory. Set equality in BOTH directions; the report's own
// counts/arrays being internally consistent is necessary but not sufficient.
function inventoryChecks(r, errors, { policy, trustedInventory }) {
  const cov = r.coverage ?? {};
  const changed = Array.isArray(cov.changed_files) ? cov.changed_files : [];
  const reviewed = Array.isArray(cov.reviewed_files) ? cov.reviewed_files : [];

  if (!Array.isArray(trustedInventory?.changed_files)) {
    errors.push({ code: 'E_NO_INVENTORY', path: '/coverage/changed_files', message: 'admission requires the trusted changed-file inventory' });
    return;
  }
  const trusted = trustedInventory.changed_files;

  if (new Set(changed).size !== changed.length) {
    errors.push({ code: 'E_DUP_CHANGED', path: '/coverage/changed_files', message: 'changed_files carries duplicate paths' });
  }
  const changedSet = new Set(changed);
  for (const p of trusted) {
    if (!changedSet.has(p)) {
      errors.push({ code: 'E_CHANGED_MISSING', path: '/coverage/changed_files', message: `trusted changed file "${p}" is absent from the report` });
    }
  }
  for (const p of changedSet) {
    if (!trusted.includes(p)) {
      errors.push({ code: 'E_CHANGED_UNKNOWN', path: '/coverage/changed_files', message: `"${p}" is not in the trusted changed-file inventory` });
    }
  }

  // every changed path must be covered by an explicit reviewed disposition
  const reviewedPaths = [];
  for (const [i, rf] of reviewed.entries()) {
    if (rf && typeof rf.path === 'string') reviewedPaths.push(rf.path);
    else errors.push({ code: 'E_REVIEWED_MISSING', path: `/coverage/reviewed_files/${i}`, message: 'reviewed entry without a path' });
  }
  if (new Set(reviewedPaths).size !== reviewedPaths.length) {
    errors.push({ code: 'E_DUP_ID', path: '/coverage/reviewed_files', message: 'duplicate reviewed paths' });
  }
  const reviewedSet = new Set(reviewedPaths);
  for (const p of changedSet) {
    if (!reviewedSet.has(p)) {
      errors.push({ code: 'E_REVIEWED_MISSING', path: '/coverage/reviewed_files', message: `changed file "${p}" has no reviewed disposition` });
    }
  }

  // specification inventory: every trusted requirement assessed, none invented
  if (policy && Array.isArray(policy.specification_inventory)) {
    const assessed = new Map((Array.isArray(r.specification_evidence) ? r.specification_evidence : []).map((s) => [s && s.requirement_id, s]));
    for (const id of policy.specification_inventory) {
      if (!assessed.has(id)) {
        errors.push({ code: 'E_INVENTORY', path: '/specification_evidence', message: `trusted requirement "${id}" has no assessment` });
      }
    }
    for (const [id] of assessed) {
      if (id !== null && id !== undefined && !policy.specification_inventory.includes(id)) {
        errors.push({ code: 'E_INVENTORY', path: '/specification_evidence', message: `"${id}" is not in the trusted specification inventory` });
      }
    }
  }
}

function tupleChecks(r, errors, state) {  const rev = (r.revision ?? {});
  const policyBlock = (r.policy ?? {});
  const pr = (r.pull_request ?? {});
  const mismatches = [];
  if (r.repository?.id !== state.repository_id) mismatches.push('repository_id');
  if (state.pr_number !== undefined && pr.number !== state.pr_number) mismatches.push('pr_number');
  if (state.pr_node_id !== undefined && pr.node_id !== state.pr_node_id) mismatches.push('pr_node_id');
  for (const k of ['base_sha', 'head_sha', 'tested_merge_sha']) {
    if (state[k] !== undefined && rev[k] !== state[k]) mismatches.push(k);
  }
  if (state.policy_sha256 !== undefined && policyBlock.sha256 !== state.policy_sha256) mismatches.push('policy_sha256');
  if (state.protocol_version !== undefined && r.protocol_version !== state.protocol_version) mismatches.push('protocol_version');
  if (mismatches.length > 0) {
    errors.push({ code: 'E_TUPLE', path: '/revision', message: `report does not match the current tuple: ${mismatches.join(', ')}` });
  }
}

function walkEvidence(node, fn, path = '') {
  if (Array.isArray(node)) {
    node.forEach((v, i) => walkEvidence(v, fn, `${path}/${i}`));
    return;
  }
  if (node && typeof node === 'object') {
    if (typeof node.commit_sha === 'string' && 'line_start' in node && 'explanation' in node) {
      fn(node, path || '/');
    }
    for (const [k, v] of Object.entries(node)) walkEvidence(v, fn, `${path}/${k}`);
  }
}

function dupCheck(ids, path, errors) {
  const seen = new Set();
  for (const id of ids) {
    if (id === null || id === undefined) continue;
    if (seen.has(id)) errors.push({ code: 'E_DUP_ID', path, message: `duplicate id "${id}"` });
    seen.add(id);
  }
}

// ── CLI ───────────────────────────────────────────────────────────────────────
export function cli(argv) {
  const args = argv.slice(2);
  const file = args[0];
  const opt = (name) => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const schemaPath = opt('--schema');
  const schemaV2Path = opt('--schema-v2');
  const policyPath = opt('--policy');
  const now = opt('--now');
  if (!file || !schemaPath) {
    console.error('usage: node validate-report.mjs <report.json> --schema <schema.json> [--schema-v2 <v2-schema.json>] [--policy <policy.json>] [--now <ISO>]');
    return 2;
  }
  const { readFileSync } = require('node:fs');
  const text = readFileSync(file, 'utf8');
  const schemaBytes = readFileSync(schemaPath);
  const schemaBytesV2 = schemaV2Path ? readFileSync(schemaV2Path) : undefined;
  const policy = policyPath ? JSON.parse(readFileSync(policyPath, 'utf8')) : undefined;
  const result = validateReport(text, { schemaBytes, schemaBytesV2, policy, now });
  if (result.ok) {
    console.log(JSON.stringify({ ok: true, authorizing: result.authorizing, kind: result.report?.kind ?? result.report?.record_type, verdict: result.report?.verdict, completion: result.report?.completion }));
    return 0;
  }
  console.log(JSON.stringify({ ok: false, errors: result.errors }, null, 2));
  return 1;
}

if (isMainEntry(import.meta.url)) {
  process.exit(cli(process.argv));
}
