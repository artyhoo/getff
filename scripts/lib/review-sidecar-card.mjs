// Test-only helpers for the trusted native OCR connection card (getff-ocr-reuse C2).
//
// Two jobs, shared by scripts/review-sidecar-contract.test.mjs (authoring cards) and
// scripts/consumer-resource-closure.test.mjs (delivered consumer cards):
//
// 1. Extract the card's REAL invocation prefix — every prelude line (entry selection,
//    guards, receipt echo) plus the invocation line's loader + entry — from any card
//    text: the canonical role, the plugin twin, the aif-review skill-context template,
//    or a delivered consumer copy. Review arguments are replaced by a benign bad flag;
//    the loader and producer entry still execute exactly as shipped, so a test-only
//    resolver or a retyped command can never stand in for the card.
//
// 2. Poison PATH with a recording fake `npx`: any npx-mediated loader line in a card
//    executes the fake (marker line in $POISON_LOG + exit 3) and fails the gate. This
//    is the deterministic, offline stand-in for the measured hazard (npm 11.4.2,
//    2026-11-03): with the project's own tsx absent, `npx --no-install tsx` executed a
//    floating copy from the npm executable cache, and an ancestor node_modules bin,
//    instead of refusing — the registry-acquiring real npx is never reached here.
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, writeFileSync, chmodSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const cardBlockOf = md => {
  const blocks = [...md.matchAll(/```bash\n([\s\S]*?)```/g)].map(m => m[1]);
  const hit = blocks.find(b => b.includes('ocrTrustedReview.ts'));
  assert.ok(hit, 'connection card bash block containing ocrTrustedReview.ts must exist');
  return hit;
};

const invocationIndexOf = block => {
  const i = block.split('\n').findIndex(l => l.startsWith('"$LOADER" "$ENTRY"'));
  assert.ok(i > 0,
    'card invocation must be the explicit project-local loader bin running the selected entry ("$LOADER" "$ENTRY" …)');
  return i;
};

/** Every prelude line, up to (not including) the invocation line. */
export const cardPreludeOf = md => {
  const lines = cardBlockOf(md).split('\n');
  return lines.slice(0, invocationIndexOf(lines.join('\n'))).join('\n');
};

/** Prelude + `"$LOADER" "$ENTRY" --definitely-not-an-option` — the review arguments swapped out. */
export const cardBadFlagPrefixOf = md => {
  const block = cardBlockOf(md);
  const lines = block.split('\n');
  return [...lines.slice(0, invocationIndexOf(block)), '"$LOADER" "$ENTRY" --definitely-not-an-option'].join('\n');
};

const poisonRoot = mkdtempSync(join(tmpdir(), 'rs-npx-poison-'));
writeFileSync(join(poisonRoot, 'npx'),
  ['#!/bin/sh', 'printf "POISON-NPX-EXECUTED %s\\n" "$*" >> "${POISON_LOG:?}"', 'exit 3', ''].join('\n'));
chmodSync(join(poisonRoot, 'npx'), 0o755);
process.on('exit', () => rmSync(poisonRoot, { recursive: true, force: true }));

/** Fresh poison per call: { env, ran() } — ran() is true iff the fake npx executed. */
let poisonSeq = 0;
export const npxPoison = () => {
  const log = join(poisonRoot, `npx-${++poisonSeq}.log`);
  return {
    env: { ...process.env, PATH: `${poisonRoot}:${process.env.PATH}`, POISON_LOG: log },
    ran: () => existsSync(log),
  };
};
