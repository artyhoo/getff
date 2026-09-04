#!/usr/bin/env node
// promptfoo exec provider (kickoff-s4 §3.1/§3.4): shells `claude -p` with the judge model
// PINNED BY NAME — `sonnet`, never tier-resolved (§3.4; a model swap is a PARK, not an
// upgrade). Invocation byte-identical to the S2 cold rater (scripts/triage-s0-run.mjs:56):
// no tools, no session state. promptfoo exec-provider contract (custom-script.md): argv[2]
// is the rendered prompt; stdout is the judge output, verbatim; non-zero exit = test error
// (the runner's one-re-run pass covers transient failures).

import { execFile } from 'node:child_process';

const prompt = process.argv[2];
if (!prompt) {
  console.error('[ERROR] provider.mjs: no prompt on argv[2] (promptfoo exec contract)');
  process.exit(1);
}
execFile(
  'claude',
  ['-p', '--model', 'sonnet', '--allowedTools', '', '--strict-mcp-config', prompt],
  { maxBuffer: 1 << 20 },
  (err, stdout) => {
    if (err) {
      console.error(`[ERROR] claude -p failed: ${String(err.message).slice(0, 200)}`);
      process.exit(1);
    }
    process.stdout.write((stdout || '').trim());
  },
);
