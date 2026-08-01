/**
 * KickoffSpec builder — constructs a KickoffSpec from a file path.
 *
 * Reads kickoff.md from disk, computes SHA-256 hash of content,
 * and derives umbrellaName from the parent directory name.
 *
 * Marker contract (kickoff §7, maintainer decision 2026-05-31 — opt-IN):
 * - `<!-- bridge: skip -->` first line → null on EVERY path; nothing overrides it.
 * - Default (`requireAutoMarker: true`): only a `<!-- bridge: auto -->` first
 *   line yields a spec — the safe default for any future programmatic caller,
 *   because auto-dispatch is real, metered autonomous work.
 * - `requireAutoMarker: false`: explicit manual paths (cli/dispatch.ts on
 *   demand) — the invocation itself is the operator's consent.
 *
 * Profile-hint marker (multi-model-profile-marker, 2026-07-21) — a SEPARATE,
 * orthogonal parse channel from the firstLine auto/skip check above:
 * - `<!-- bridge-profile: <name> -->` anywhere in the HEADER REGION (everything
 *   before the first `##` heading) sets KickoffSpec.profileHint. Deliberately
 *   NOT first-line-bound (auto/skip already own that line) and deliberately
 *   NOT a whole-file scan — a kickoff that merely documents this convention in
 *   its body prose (§2/§3 sections, past the first `##`) must not false-positive.
 *
 * @cc-only-rationale: Used from both hook (CC) and CLI entrypoint (portable).
 */
import { readFileSync } from 'node:fs';
import { dirname, basename } from 'node:path';
import { hashContent } from './idempotency.js';
import type { KickoffSpec } from './types.js';

const BRIDGE_PROFILE_RE = /<!--\s*bridge-profile:\s*(.+?)\s*-->/;

/**
 * Extract the `<!-- bridge-profile: <name> -->` hint from a kickoff's HEADER
 * REGION only (all lines before the first `##` heading — title + blockquote
 * metadata). Returns undefined when absent. Body prose past the first `##`
 * is never scanned, so a kickoff documenting this marker in its §-sections
 * (like this very source file's own kickoff) does not false-positive.
 */
export function extractProfileHint(content: string): string | undefined {
  const lines = content.split('\n');
  const headerLines: string[] = [];
  for (const line of lines) {
    if (/^##\s/.test(line)) break;
    headerLines.push(line);
  }
  const match = headerLines.join('\n').match(BRIDGE_PROFILE_RE);
  return match ? match[1].trim() : undefined;
}

export interface BuildKickoffSpecOptions {
  /**
   * When true (the default), a spec is built only when the kickoff's first
   * line is exactly `<!-- bridge: auto -->` (opt-in, kickoff §7). Explicit
   * manual entrypoints pass false; `<!-- bridge: skip -->` blocks regardless.
   */
  requireAutoMarker?: boolean;
}

/**
 * Build a KickoffSpec from a kickoff file path.
 * Returns null when the kickoff is skip-marked, or — under the default
 * `requireAutoMarker: true` — when the `<!-- bridge: auto -->` opt-in marker
 * is absent.
 */
export function buildKickoffSpec(
  filePath: string,
  opts: BuildKickoffSpecOptions = {},
): KickoffSpec | null {
  const { requireAutoMarker = true } = opts;
  const content = readFileSync(filePath, 'utf8');

  const firstLine = content.split('\n')[0]?.trim() ?? '';

  // Hard opt-out: `<!-- bridge: skip -->` blocks every path, no override.
  if (firstLine === '<!-- bridge: skip -->') {
    return null;
  }

  // Opt-in default: without an explicit `<!-- bridge: auto -->` first line,
  // no spec is built (kickoff §7 — safe default, no silent metered dispatch).
  if (requireAutoMarker && firstLine !== '<!-- bridge: auto -->') {
    return null;
  }

  // Umbrella name: parent directory of kickoff.md
  // e.g. .claude/orchestrator-prompts/my-feature-meta-launch/kickoff.md
  //       → umbrellaName = "my-feature-meta-launch"
  const umbrellaName = basename(dirname(filePath));
  const profileHint = extractProfileHint(content);

  return {
    filePath,
    content,
    umbrellaName,
    contentHash: hashContent(content),
    ...(profileHint !== undefined ? { profileHint } : {}),
  };
}
