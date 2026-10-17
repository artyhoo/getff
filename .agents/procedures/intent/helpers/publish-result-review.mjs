#!/usr/bin/env node
/** Publish one independently authored ResultReview without overwriting history.
 * The shared read-only validator checks the staged bytes before same-filesystem rename. */
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateResultAttemptForPublication } from './check-result-review.mjs';

export function publishResultReview({ attempt, stageArtifactRoot, roots }) {
  if (!attempt || typeof attempt !== 'object' || Array.isArray(attempt) ||
      typeof attempt.attemptId !== 'string' || !/^[a-z0-9][a-z0-9-]{0,63}$/.test(attempt.attemptId)) {
    return { ok: false, code: 'invalid_attempt_id', reason: 'attemptId must be a safe stable slug' };
  }
  if (!stageArtifactRoot || !Array.isArray(roots) || roots.length === 0) {
    return { ok: false, code: 'invalid_request', reason: 'stage artifact root and owner roots are required' };
  }
  const artifactRoot = resolve(stageArtifactRoot);
  const ownerRoot = resolve(roots[0]);
  const reviewRoot = join(artifactRoot, 'result-reviews');
  const target = join(reviewRoot, attempt.attemptId);
  let staging;
  try {
    mkdirSync(reviewRoot, { recursive: true });
    const offset = relative(realpathSync(ownerRoot), realpathSync(artifactRoot));
    if (offset === '..' || offset.startsWith(`..${sep}`)) {
      return { ok: false, code: 'artifact_root_outside_owner', reason: 'stage artifact root must sit under the first owner root' };
    }
    if (existsSync(target)) return { ok: false, code: 'attempt_collision', reason: 'published attempt already exists' };
    staging = mkdtempSync(join(reviewRoot, '.staging-'));
    const stagedPath = join(staging, 'result-review.json');
    writeFileSync(stagedPath, `${JSON.stringify(attempt, null, 2)}\n`, { flag: 'wx' });
    const reviewPath = relative(ownerRoot, stagedPath);
    const verdict = validateResultAttemptForPublication({
      roots,
      contractRef: attempt.producerContract,
      reviewPath,
      observedRevision: attempt.observedRevision,
    });
    if (!verdict.ok) return verdict;
    renameSync(staging, target);
    staging = undefined;
    return { ok: true, attemptId: attempt.attemptId, path: join(target, 'result-review.json') };
  } catch (err) {
    return { ok: false, code: 'publication_failed', reason: `cannot publish result attempt: ${err.message}` };
  } finally {
    if (staging) rmSync(staging, { recursive: true, force: true });
  }
}

function main() {
  const args = process.argv.slice(2);
  const opts = {};
  for (let i = 0; i < args.length; i += 2) {
    if (!args[i]?.startsWith('--') || args[i + 1] === undefined) {
      process.stdout.write(`${JSON.stringify({ ok: false, code: 'invalid_request', reason: 'usage: --attempt <json|-> --stage-artifact-root <dir> --roots <root[,root...]>' })}\n`);
      process.exitCode = 2;
      return;
    }
    opts[args[i].slice(2)] = args[i + 1];
  }
  let attempt;
  try {
    attempt = JSON.parse(opts.attempt === '-' ? readFileSync(0, 'utf8') : readFileSync(opts.attempt, 'utf8'));
  } catch (err) {
    process.stdout.write(`${JSON.stringify({ ok: false, code: 'invalid_request', reason: `cannot read attempt: ${err.message}` })}\n`);
    process.exitCode = 2;
    return;
  }
  const result = publishResultReview({
    attempt,
    stageArtifactRoot: opts['stage-artifact-root'],
    roots: opts.roots?.split(',').map((root) => resolve(root)),
  });
  process.stdout.write(`${JSON.stringify(result)}\n`);
  if (!result.ok) process.exitCode = 2;
}

if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) main();
