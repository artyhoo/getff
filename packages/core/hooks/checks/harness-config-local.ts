/**
 * harness-config-local.ts — the maintainer-machine arm of the harness-config drift gate.
 *
 * `scripts/render-harness-config.mjs --check` is the drift gate for the per-harness
 * config renderer (#894). Its CI channel (`packages/core/hooks/harness-config-drift.test.ts`,
 * real-tree case) can only ever see the TRACKED claude branch: `.zcode/config.json` and
 * the `.zcode/skills -> ../.claude/skills` link are gitignored (`.gitignore`, the
 * `/.zcode/` entry), so they are absent on every CI runner and the zcode branch
 * loud-skips there by design. The one place those files exist is the maintainer's own
 * checkout — and nothing ran the check there, so a stale `.zcode/config.json` or a
 * broken skills link went unnoticed (cold T21 sweep, 2026-09-29, W2-G harvest).
 *
 * This check runs the renderer's `--check` against the checkout when `.zcode/` exists
 * there, and is a no-op otherwise (CI, fresh worktrees, consumer layouts). The renderer
 * owns what "drift" means — including its own presence probe for `.zcode/config.json` —
 * so this module adds no second definition of it; it only decides WHEN to ask.
 *
 * Pure decision logic with the process runner injected, so it is unit-testable without
 * a real hook run (the s17.ts / GitProvider precedent).
 */
import { lstatSync } from 'node:fs';
import { join } from 'node:path';
import type { CheckResult } from '../utils/run-check.ts';

/** The gitignored directory ZCode reads its workspace config from. */
export const ZCODE_DIR = '.zcode';
/** The renderer, relative to the checkout root. */
export const RENDERER_REL = 'scripts/render-harness-config.mjs';

/** The renderer's own presence probe for the zcode branch (render-harness-config.mjs). */
export const ZCODE_CONFIG = `${ZCODE_DIR}/config.json`;
/** The rendered skills link. */
export const ZCODE_SKILLS = `${ZCODE_DIR}/skills`;

/**
 * - `skip`    nothing to check; `note` set when the operator should see why
 * - `ok`      the renderer ran its full --check (zcode branch included) and passed
 * - `drift`   the renderer reported drift
 * - `partial` `.zcode/skills` exists but `.zcode/config.json` does not — the renderer
 *             would skip its whole zcode branch (link included) and exit 0, so the
 *             half-rendered shim must be flagged here rather than passed as `ok`
 * - `error`   the renderer could not run (timeout / not found) — not a drift verdict
 */
export type HarnessLocalVerdict =
  | { kind: 'skip'; note?: string }
  | { kind: 'ok'; result: CheckResult }
  | { kind: 'drift'; result: CheckResult }
  | { kind: 'partial' }
  | { kind: 'error'; result: CheckResult };

/** Runs `node <renderer> --check --root <root>`; injected so tests need no real spawn. */
export type RendererRunner = (
  root: string,
  args: readonly string[],
) => CheckResult;

/** lstat, not exists: a `.zcode` that is itself a dangling symlink still counts as present. */
function present(path: string): boolean {
  try {
    lstatSync(path);
    return true;
  } catch {
    return false;
  }
}

export function checkLocalHarnessConfig(
  root: string,
  runRenderer: RendererRunner,
): HarnessLocalVerdict {
  if (!present(join(root, ZCODE_DIR))) return { kind: 'skip' };
  if (!present(join(root, RENDERER_REL))) return { kind: 'skip' };
  // ZCode itself writes runtime data under .zcode/ (e.g. plans/), so the directory
  // alone does not mean a shim was rendered. Arm on the renderer's own probe.
  if (!present(join(root, ZCODE_CONFIG))) {
    if (present(join(root, ZCODE_SKILLS))) return { kind: 'partial' };
    return {
      kind: 'skip',
      note: `${ZCODE_CONFIG} absent — no rendered zcode shim in this checkout, nothing checked`,
    };
  }
  const result = runRenderer(root, [RENDERER_REL, '--check', '--root', root]);
  if (result.timedOut || result.notFound) return { kind: 'error', result };
  return result.exitCode === 0
    ? { kind: 'ok', result }
    : { kind: 'drift', result };
}
