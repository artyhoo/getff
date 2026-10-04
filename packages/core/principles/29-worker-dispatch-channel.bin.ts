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
      `❌ worker-dispatch-channel: ${rel}:${v.line} PRESCRIBES auto-launch of a stage's execution (imperative Agent-tool write-Worker dispatch)\n` +
        `   ${v.text}\n`,
    );
  }
}

if (failed) {
  process.stderr.write(
    '   Rule `#umbrella-execution-launch-without-operator` (formerly `#worker-dispatch-via-subagent`)\n' +
      '   (.claude/skills/pipeline/SKILL.md §5; class boundary: .claude/rules/parallel-subwave-isolation.md\n' +
      '   §D6): a kickoff must not PRESCRIBE auto-launch of a stage\'s execution — the launch becomes the\n' +
      '   exit launch card and the operator\'s channel choice. The Agent tool stays allowed for read-only\n' +
      '   work (review, search, checks) in ANY session, and for writes in a normal session\'s own worktree.\n' +
      '   If this line merely QUOTES/TEACHES the anti-pattern, append on the same line:\n' +
      '   <!-- channel-discipline: allow <reason> -->\n',
  );
  process.exit(1);
}

process.exit(0);
