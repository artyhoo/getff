/**
 * Principle 20 shared runner — memoised bundle-curate.sh invocation, used by
 * 20-bundle-classification.test.ts and its .paired-negative twin. The perf rationale,
 * the measurements and the cache-safety argument live in the positive file's header.
 *
 * Sibling-.ts shape (not a .test.ts) because importing a test file from another would
 * re-register its describe blocks. Precedent: principles/31-rule-channel-declaration.ts.
 */
import { execFile, execFileSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const HERE = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = resolve(HERE, '../../..');
export const HELPER = resolve(
  REPO_ROOT,
  '.claude/skills/pipeline/helpers/bundle-curate.sh',
);
export const FIXTURES = resolve(HERE, '__fixtures__/bundle');

const cache = new Map<string, string>();

/**
 * The ONE place a key is built, so the sync runner and the async prefetch cannot drift
 * apart (they did, once — see the positive file's header). Keyed on the HELPER too, so a
 * mutated copy of the script is never served the pristine script's output.
 */
function cacheKey(helperPath: string, backlogPath: string): string {
  return JSON.stringify([helperPath, backlogPath]);
}

/** Run `helperPath <backlogPath>`, memoised on the (helper, backlog) pair. */
export function runCurate(helperPath: string, backlogPath: string): string {
  const key = cacheKey(helperPath, backlogPath);
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  const out = execFileSync('/bin/bash', [helperPath, backlogPath], {
    encoding: 'utf8',
    cwd: REPO_ROOT,
  });
  cache.set(key, out);
  return out;
}

/**
 * Prefetch pairs concurrently into the memo, from a `beforeAll`. A failing run is left
 * uncached on purpose: `runCurate` re-runs it and fails at the assertion that cares.
 * Returns how many requested pairs are memoised, so callers ASSERT the prefetch landed.
 */
export async function primeCurate(
  pairs: Array<[string, string]>,
): Promise<number> {
  await Promise.all(
    pairs.map(async ([helper, backlog]) => {
      try {
        const { stdout } = await execFileAsync('/bin/bash', [helper, backlog], {
          encoding: 'utf8',
          cwd: REPO_ROOT,
        });
        cache.set(cacheKey(helper, backlog), stdout);
      } catch {
        /* left uncached on purpose — runCurate re-runs and surfaces the real failure */
      }
    }),
  );
  return pairs.filter(([h, b]) => cache.has(cacheKey(h, b))).length;
}

/** Count rows whose notes cell contains a pattern, in the markdown table output. */
export function countRows(output: string, notesPattern: string): number {
  return output
    .split('\n')
    .filter((l) => l.startsWith('|') && l.includes(notesPattern)).length;
}
