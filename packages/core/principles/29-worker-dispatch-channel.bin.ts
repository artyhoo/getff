#!/usr/bin/env tsx
/**
 * CLI shim for principle 29 changed-files mode (M6 edit-time channel).
 *
 * Usage (from repo root):
 *   npx tsx packages/core/principles/29-worker-dispatch-channel.bin.ts \
 *     .claude/orchestrator-prompts/<umbrella>/kickoff.md
 *
 * Reads paths from argv (relative to repo root = process.cwd()).
 * Filters to `.claude/orchestrator-prompts/<umbrella>/kickoff.md` — any other path
 * exits 0 silently so the PostToolUse hook surfaces no FAIL noise on unrelated edits.
 * Prints violations to stderr; exits 1 if any unescaped violation is found.
 *
 * @dual-pair: channel-discipline-worker-dispatch
 * spec: docs/meta-factory/research-patches/2026-06-27-meta-orch-channel-discipline-mechanism.md
 *
 * Wired into the harness-hook PostToolUse via .claude/hooks/check-worker-dispatch-channel.sh.
 */
import { readFileSync, existsSync } from 'node:fs';
import { findViolations } from './29-worker-dispatch-channel.ts';

// Only a kickoff.md directly under .claude/orchestrator-prompts/<one-segment>/ is in scope.
const KICKOFF_RE = /^\.claude\/orchestrator-prompts\/[^/]+\/kickoff\.md$/;

const paths = process.argv.slice(2).filter((p) => KICKOFF_RE.test(p));

if (paths.length === 0) {
  process.exit(0);
}

let failed = false;
for (const rel of paths) {
  if (!existsSync(rel)) continue;
  const violations = findViolations(readFileSync(rel, 'utf8'));
  for (const v of violations) {
    failed = true;
    process.stderr.write(
      `❌ worker-dispatch-channel: ${rel}:${v.line} instructs Agent-tool dispatch of a write Worker\n` +
        `   ${v.text}\n`,
    );
  }
}

if (failed) {
  process.stderr.write(
    '   Rule `#umbrella-execution-launch-without-operator` (formerly `#worker-dispatch-via-subagent`)\n' +
      '   (.claude/skills/pipeline/SKILL.md §5): a write-task Worker\n' +
      '   must NOT be dispatched via the Agent tool from the meta-orchestrator session. Use a fresh\n' +
      '   maintainer-opened CC session (paste the §10 1-liner) or dispatch.ts. The Agent tool is ONLY\n' +
      '   for Phase -1 read-only reviewers + read-only research subagents.\n' +
      '   If this line legitimately QUOTES/TEACHES the anti-pattern, append on the same line:\n' +
      '   <!-- channel-discipline: allow <reason> -->\n',
  );
  process.exit(1);
}

process.exit(0);
