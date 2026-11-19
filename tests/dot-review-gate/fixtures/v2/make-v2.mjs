// V2 review fixtures — built ONLY from the pinned canonical bytes, never invented.
//
// The pinned copies under this directory are byte-verified against the docs lane's
// CONTRACT_READY receipt (PR #2058, head 47f34a3bcc989c5dcdbbf7c8ffada0e8b4d0615f):
//   schema.json  sha256 b110a641f74dbc29b000b1b9621d4694caa4684368e6c4f75e70a3d58bed107b
//   spec (repo)  sha256 88b0deb817c8afdca85f33c39706d8985a55f8a12f3dcbd36c3653444d25de1f
// Every negative arm mutates the pinned positive-go example — field spelling stays
// owned by the versioned schema (follow-up packet §5), the fixtures only relocate
// bytes that were already published.
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));

export const V2_SCHEMA_BYTES = readFileSync(join(HERE, 'schema.json'));
export const V2_SCHEMA_SHA256 = createHash('sha256').update(V2_SCHEMA_BYTES).digest('hex');
export const RECEIPT_SCHEMA_SHA256 = 'b110a641f74dbc29b000b1b9621d4694caa4684368e6c4f75e70a3d58bed107b';
export const V2_PROTOCOL = 'dot-pr-review/2.0.0';
export const V2_EXAMPLES_DIR = join(HERE, 'examples');

export function loadExample(name) {
  return readFileSync(join(V2_EXAMPLES_DIR, name), 'utf8');
}

export function v2Expectations() {
  return JSON.parse(loadExample('expectations.json'));
}

function deepMerge(base, over) {
  if (over === undefined) return base;
  if (over === null || Array.isArray(base) || Array.isArray(over) || typeof base !== 'object' || typeof over !== 'object') {
    return over;
  }
  const out = { ...base };
  for (const [k, v] of Object.entries(over)) {
    out[k] = k in base ? deepMerge(base[k], v) : v;
  }
  return out;
}

// The canonical valid V2 review — the pinned positive-go example, deep-merged.
export function makeV2Review(overrides = {}) {
  return deepMerge(JSON.parse(loadExample('positive-go.json')), overrides);
}

// A live tuple state aligned with the pinned example's own identity fields, so a
// mismatch only ever comes from the mutation under test.
export function v2StateFrom(report) {
  const id = report.review_identity;
  return {
    repository_id: id.repository.id,
    pr_number: id.pull_request?.number,
    pr_node_id: id.pull_request?.node_id,
    base_sha: id.revisions.base_sha,
    head_sha: id.revisions.head_sha,
    merge_base_sha: id.revisions.merge_base_sha,
    tested_merge_sha: id.revisions.tested_merge_sha ?? undefined,
    policy_sha256: id.policy.sha256,
    protocol_version: report.protocol_version,
  };
}
