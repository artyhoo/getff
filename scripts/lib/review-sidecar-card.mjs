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
import { existsSync, mkdtempSync, mkdirSync, writeFileSync, chmodSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';

export const cardBlockOf = md => {
  const blocks = [...md.matchAll(/```bash\n([\s\S]*?)```/g)].map(m => m[1]);
  const hit = blocks.find(b => b.includes('ocrTrustedReview.ts'));
  assert.ok(hit, 'connection card bash block containing ocrTrustedReview.ts must exist');
  return hit;
};

// Recognition is EXACT: the invocation line is precisely `"$LOADER" "$ENTRY" \` and
// nothing else (native round-1 finding C3 — a startsWith match silently accepted
// corrupted forms like `"$LOADER" "$ENTRY"-broken \`, slicing a damaged card instead
// of refusing it). Any other line shape fails extraction loudly.
const INVOCATION_LINE = '"$LOADER" "$ENTRY" \\';

const invocationIndexOf = block => {
  const i = block.split('\n').findIndex(l => l === INVOCATION_LINE);
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

// Build a fully SYNTHETIC, offline npm cache in `dir` — zero reads from the user's real
// ~/.npm — that makes `npx --no-install tsx` (npm 11.4.2, the measured line) EXECUTE a
// recording loader out of the npm executable cache: the positive control for the floating-
// copy hazard the shipped card must keep refusing (native round-1 finding C4 — the poison
// shim above intercepts npx before npm resolution, so it can never demonstrate this).
// Derivation (reverse-engineered from libnpmexec + real cache layout, probes 2026-11-03):
//   1. `_cacache` packument entry so offline resolution succeeds:
//      index at index-v5/<sha256(key)[0:2]>/<[2:4]>/<[4:]>, line `<sha1(entryJson)>\t<entryJson>`
//      (reader takes the last line); content at content-v2/sha512/<hex[0:2]>/<hex[2:4]>/<hex[4:]>.
//   2. `_npx/<sha512("tsx").slice(0,16)>/` executable-cache entry: package.json (_npx.packages),
//      a lockfile at BOTH the root and node_modules/.package-lock.json (the hidden lockfile is
//      where arborist's actual-loader reads `resolved` from, which libnpmexec matches against
//      the packument's dist.tarball to skip installation), node_modules/tsx/package.json, and
//      node_modules/.bin/tsx — the RECORDING loader (marker + exit 43).
// A future npm layout drift breaks this arm loudly (marker missing / wrong exit), never
// silently green.
export const buildSyntheticNpxCache = dir => {
  const cache = join(dir, 'cache');
  const proj = join(dir, 'proj');
  mkdirSync(proj, { recursive: true });

  // 1. synthetic packument (self-authored minimal registry document)
  const tarball = 'https://registry.npmjs.org/tsx/-/tsx-4.22.4.tgz';
  const integrity = 'sha512-X8EX+XV4QR5xCsrgxaED954zTDfY8KqlDtskKEL0cHhyS/P8b4IFOvGDQpsC9Q1XnLq915wEfwwY/zzskCtmhg==';
  const body = Buffer.from(JSON.stringify({
    name: 'tsx',
    'dist-tags': { latest: '4.22.4' },
    versions: {
      '4.22.4': {
        name: 'tsx', version: '4.22.4', bin: { tsx: './recording.js' },
        dist: { tarball, integrity },
      },
    },
  }), 'utf8');
  const key = 'make-fetch-happen:request-cache:https://registry.npmjs.org/tsx';
  const kh = createHash('sha256').update(key).digest('hex');
  const hex = createHash('sha512').update(body).digest('hex');
  const idx = join(cache, '_cacache', 'index-v5', kh.slice(0, 2), kh.slice(2, 4), kh.slice(4));
  const cnt = join(cache, '_cacache', 'content-v2', 'sha512', hex.slice(0, 2), hex.slice(2, 4), hex.slice(4));
  mkdirSync(dirname(idx), { recursive: true });
  mkdirSync(dirname(cnt), { recursive: true });
  const entry = {
    key, integrity: `sha512-${createHash('sha512').update(body).digest('base64')}`,
    time: Date.now(), size: body.length,
    metadata: {
      time: Date.now(), url: 'https://registry.npmjs.org/tsx',
      reqHeaders: { accept: 'application/vnd.npm.install-v1+json; q=1.0, application/json; q=0.8, */*' },
      resHeaders: { 'content-type': 'application/vnd.npm.install-v1+json', 'cache-control': 'public, max-age=300' },
    },
  };
  const entryJson = JSON.stringify(entry);
  writeFileSync(idx, `${createHash('sha1').update(entryJson).digest('hex')}\t${entryJson}\n`);
  writeFileSync(cnt, body);

  // 2. _npx executable-cache entry whose "tsx" is the recording loader
  const npxHash = createHash('sha512').update('tsx').digest('hex').slice(0, 16);
  const E = join(cache, '_npx', npxHash);
  mkdirSync(join(E, 'node_modules', 'tsx'), { recursive: true });
  mkdirSync(join(E, 'node_modules', '.bin'), { recursive: true });
  writeFileSync(join(E, 'package.json'),
    JSON.stringify({ dependencies: { tsx: '^4.22.4' }, _npx: { packages: ['tsx'] } }, null, 2));
  const lock = JSON.stringify({
    name: npxHash, lockfileVersion: 3, requires: true,
    packages: {
      '': { name: npxHash, dependencies: { tsx: '^4.22.4' } },
      'node_modules/tsx': {
        version: '4.22.4', resolved: tarball, integrity, bin: { tsx: './recording.js' },
        engines: { node: '>=18.0.0' },
      },
    },
  }, null, 2);
  writeFileSync(join(E, 'package-lock.json'), lock);
  writeFileSync(join(E, 'node_modules', '.package-lock.json'), lock);
  writeFileSync(join(E, 'node_modules', 'tsx', 'package.json'),
    JSON.stringify({ name: 'tsx', version: '4.22.4', bin: { tsx: './recording.js' } }));
  writeFileSync(join(E, 'node_modules', 'tsx', 'recording.js'),
    '#!/usr/bin/env node\nconsole.log(\'RECORDING-NPX-CACHE-LOADER-EXECUTED\');\nprocess.exit(43);\n');
  writeFileSync(join(E, 'node_modules', '.bin', 'tsx'),
    '#!/bin/sh\necho "RECORDING-NPX-CACHE-LOADER-EXECUTED $*"\nexit 43\n');
  chmodSync(join(E, 'node_modules', '.bin', 'tsx'), 0o755);

  return { cache, proj };
};
