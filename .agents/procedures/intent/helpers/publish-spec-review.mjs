#!/usr/bin/env node
/**
 * publish-spec-review.mjs — the narrow writer that completes a unique specification-review
 * attempt off-path and publishes it by same-filesystem atomic rename (intent-continuity
 * design §6; canonical home `.agents/procedures/intent/helpers/`).
 *
 * check-result-review.mjs is read-only by charter, so this is the ONE narrow stage-owner
 * publisher the protocol lacked — nothing else. It validates the attempt through the shared
 * validateSpecReview (no second validator), derives a content-addressed attemptId from the
 * canonical JSON projection of the attempt (attempts carry no timestamps, so identical
 * content yields an identical ID and republishing is refused as a collision), stages the
 * attempt in a sibling directory of the target, then renames the whole directory into place.
 * There is no overwrite path: an existing attempt dir is a refused collision, which is what
 * makes published attempts immutable.
 *
 * Storage: <orch-home>/intent-continuity/spec-reviews/<attemptId>/spec-review.json, where
 * <orch-home> is the orch home resolved by print-orch-home.sh (pass it via --orch-home);
 * the location is beside the feature's decision artifacts, not a new registry.
 *
 * CLI: node publish-spec-review.mjs --attempt <attempt-json-path | -> --orch-home <dir>
 *                                       [--roots <root[,root2...]>] [--repo-root <dir>]
 * Exit 0 published (prints {ok:true, attemptId, dir}); 2 refuse-or-IO (prints a tagged
 * reject result with a single hold code).
 */
import { createHash } from 'node:crypto';
import {
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  statSync,
  writeSync,
} from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalJson, validateSpecReview } from './check-result-review.mjs';

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

/** Content-addressed identity: digest of the canonical projection of the attempt itself. */
export function specReviewAttemptId(specReview) {
  return sha256(canonicalJson(specReview));
}

/** Read the published attempt corpus: [{attemptId, dir, specReview}] sorted by attemptId.
 * Throws on a non-dot directory that carries no spec-review.json — such an entry is corpus
 * corruption (or a foreign writer), never something to silently skip past; the caller turns
 * the throw into the spec_review_invalid:corpus hold. Dot-prefixed entries (staging dirs a
 * crash may leave behind) remain ignorable by design. */
export function readPublishedSpecReviews(featureHome) {
  const reviewsDir = join(featureHome, 'spec-reviews');
  if (!existsSync(reviewsDir)) return [];
  const out = [];
  for (const entry of readdirSync(reviewsDir)) {
    const dir = join(reviewsDir, entry);
    if (!statSync(dir).isDirectory() || entry.startsWith('.')) continue;
    const file = join(dir, 'spec-review.json');
    if (!existsSync(file)) {
      throw new Error(`corpus entry ${entry} carries no spec-review.json (corruption or foreign writer)`);
    }
    out.push({ attemptId: entry, dir, specReview: JSON.parse(readFileSync(file, 'utf8')) });
  }
  return out.sort((a, b) => (a.attemptId < b.attemptId ? -1 : 1));
}

function emit(result, code) {
  process.stdout.write(`${JSON.stringify(result)}\n`);
  process.exit(code);
}

function readInput(path) {
  if (path === '-') return readFileSync(0);
  return readFileSync(path);
}

function atomicWriteFile(target, bytes) {
  const temp = join(dirname(target), `.${basename(target)}.tmp-${process.pid}-${Math.random().toString(36).slice(2, 10)}`);
  const fd = openSync(temp, 'wx');
  try {
    writeSync(fd, bytes);
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
  renameSync(temp, target);
}

function resolveRepoRoot(flagged) {
  if (flagged !== undefined) return resolve(flagged);
  if (process.env.AIF_INTENT_REPO_ROOT) return resolve(process.env.AIF_INTENT_REPO_ROOT);
  // helpers/ → intent/ → procedures/ → .agents/ → repo root (works through the symlink twin:
  // import.meta.url is resolved to the real path before this runs).
  return resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
}

function main() {
  const args = process.argv.slice(2);
  const opts = {};
  for (let i = 0; i < args.length; i += 2) {
    const flag = args[i];
    if (!flag.startsWith('--') || args[i + 1] === undefined) {
      emit({ ok: false, code: 'invalid_request', reason: 'usage: publish-spec-review.mjs --attempt <path|-> --orch-home <dir> [--roots <r,...>] [--repo-root <dir>]' }, 2);
      return;
    }
    opts[flag.slice(2)] = args[i + 1];
  }
  if (opts.attempt === undefined || opts['orch-home'] === undefined) {
    emit({ ok: false, code: 'invalid_request', reason: 'both --attempt and --orch-home are required' }, 2);
    return;
  }
  const repoRoot = resolveRepoRoot(opts['repo-root']);
  const orchHome = resolve(opts['orch-home']);
  const roots = (opts.roots !== undefined ? opts.roots.split(',') : [repoRoot]).map((r) => resolve(repoRoot, r));
  const featureHome = join(orchHome, 'intent-continuity');
  const reviewsDir = join(featureHome, 'spec-reviews');

  let specReview;
  try {
    specReview = JSON.parse(readInput(opts.attempt).toString('utf8'));
  } catch (err) {
    emit({ ok: false, code: 'invalid_request', reason: `cannot read/parse attempt: ${err.message}` }, 2);
    return;
  }
  // Validate through the shared mode-specific checker BEFORE any filesystem effect.
  const verdict = validateSpecReview({ roots, specReview });
  if (!verdict.ok) {
    emit(verdict, 2);
    return;
  }
  const attemptId = specReviewAttemptId(specReview);
  const attemptDir = join(reviewsDir, attemptId);

  try {
    mkdirSync(reviewsDir, { recursive: true });
    if (existsSync(attemptDir)) {
      emit({ ok: false, code: 'attempt_collision', reason: `attempt ${attemptId} is already published; published attempts are immutable` }, 2);
      return;
    }
    // Stage off-path in a sibling of the target, then rename the whole directory into
    // place — a same-filesystem atomic publication; a crash leaves at most an ignored
    // staging dir, never a half-published attempt.
    const staging = join(reviewsDir, `.staging-${attemptId.slice(0, 12)}-${process.pid}-${Math.random().toString(36).slice(2, 10)}`);
    mkdirSync(staging);
    try {
      atomicWriteFile(join(staging, 'spec-review.json'), `${JSON.stringify(specReview, null, 2)}\n`);
      try {
        renameSync(staging, attemptDir);
      } catch (err) {
        if (err.code === 'EEXIST' || err.code === 'ENOTEMPTY') {
          emit({ ok: false, code: 'attempt_collision', reason: `attempt ${attemptId} is already published; published attempts are immutable` }, 2);
          return;
        }
        throw err;
      }
    } catch (err) {
      rmSync(staging, { recursive: true, force: true });
      throw err;
    }
  } catch (err) {
    emit({ ok: false, code: 'publication_failed', reason: `cannot publish attempt: ${err.message}` }, 2);
    return;
  }
  emit({ ok: true, attemptId, dir: attemptDir }, 0);
}

// Am-I-entry-point lock — realpath BOTH sides (SSOT #269 / principle 47), same rationale
// and inline shape as check-result-review.mjs: this helper also ships inside the copied
// skill tree behind a symlink twin, where a bare resolve() compare is false.
const isMainEntryLock =
  process.argv[1] !== undefined &&
  (() => {
    try {
      return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
    } catch {
      return resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
    }
  })();

if (isMainEntryLock) {
  main();
}
