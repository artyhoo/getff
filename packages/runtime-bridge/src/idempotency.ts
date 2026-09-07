/**
 * Content-hash idempotency for dispatch deduplication.
 *
 * State path: $RUNTIME_BRIDGE_DEDUP_PATH, default /tmp/runtime-bridge-dedup.jsonl
 * Each line: { hash, taskHandle, timestamp }
 * TTL: 24 hours (lines older than 24h are ignored on lookup).
 *
 * Design: prune-on-write JSONL — recordDispatch rewrites the file keeping only
 * entries within the TTL window, so it is SELF-CLEANING: the file never grows
 * unbounded and a stale entry (incl. a one-off manual fallback) auto-expires
 * without any manual sweep. (Was append-only; changed for self-cleaning per the
 * "junk must not accumulate / not be cleaned each session" requirement 2026-06-01.)
 *
 * @cc-only-rationale: Used from both hook (CC) and CLI entrypoint (portable).
 */
import { createHash } from 'node:crypto';
import { existsSync, writeFileSync, readFileSync } from 'node:fs';
import type { TaskHandle } from './types.js';

/** The shared-global log, kept as the default so nothing relocates for anyone who leaves the var unset. */
const DEFAULT_DEDUP_PATH = '/tmp/runtime-bridge-dedup.jsonl';

/**
 * Where the dedup log lives. `RUNTIME_BRIDGE_DEDUP_PATH` makes it per-project, which is what
 * the vendored copy's own README has documented since the vendor drop landed — while no code
 * in either copy read it and the path stayed a single hard-coded global (#1597 review ledger
 * A5-3 / E-1). With N consumers vendored on one host, that global log made project B's
 * identical-content kickoff read as «already dispatched» because project A had dispatched it
 * inside the 24h TTL, and the knob the README told the consumer to export did nothing.
 *
 * Pure and env-injectable so both arms are testable without touching the real log; an empty
 * or whitespace-only value falls back to the default rather than writing to `''`.
 */
export function resolveDedupPath(env: NodeJS.ProcessEnv = process.env): string {
  return env['RUNTIME_BRIDGE_DEDUP_PATH']?.trim() || DEFAULT_DEDUP_PATH;
}

const DEDUP_PATH = resolveDedupPath();
const TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

interface DedupEntry {
  hash: string;
  taskHandle: TaskHandle;
  timestamp: string; // ISO
}

/** Parse a JSONL dump into entries, skipping malformed lines. */
export function parseEntries(jsonl: string): DedupEntry[] {
  const out: DedupEntry[] = [];
  for (const line of jsonl.trim().split('\n').filter(Boolean)) {
    try {
      out.push(JSON.parse(line) as DedupEntry);
    } catch {
      /* skip malformed */
    }
  }
  return out;
}

/**
 * Keep only entries still within the TTL window (pure → unit-testable).
 * This is the self-cleaning core: applied on every write so the dedup log is
 * bounded and stale entries (including a one-off manual fallback) drop out by age.
 */
export function pruneStaleEntries(entries: DedupEntry[], now: number, ttlMs: number = TTL_MS): DedupEntry[] {
  return entries.filter((e) => now - new Date(e.timestamp).getTime() <= ttlMs);
}

/**
 * Compute SHA-256 hex hash of kickoff content.
 */
export function hashContent(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

/**
 * Check if a dispatch with this content hash was already made within the TTL.
 * Returns the prior TaskHandle if found, null otherwise.
 */
export function checkDedup(contentHash: string): TaskHandle | null {
  if (!existsSync(DEDUP_PATH)) return null;

  const now = Date.now();
  const lines = readFileSync(DEDUP_PATH, 'utf8').trim().split('\n').filter(Boolean);

  for (const line of lines) {
    let entry: DedupEntry;
    try {
      entry = JSON.parse(line) as DedupEntry;
    } catch {
      continue;
    }
    if (entry.hash !== contentHash) continue;
    const age = now - new Date(entry.timestamp).getTime();
    if (age > TTL_MS) continue;
    return entry.taskHandle;
  }
  return null;
}

/**
 * Record a successful dispatch — and SELF-CLEAN: rewrite the log with only the
 * still-fresh prior entries plus this one, so stale lines (incl. an old manual
 * fallback that would otherwise block a retry) drop out by age. No manual sweep.
 */
export function recordDispatch(contentHash: string, taskHandle: TaskHandle): void {
  const now = Date.now();
  const entry: DedupEntry = {
    hash: contentHash,
    taskHandle,
    timestamp: new Date(now).toISOString(),
  };
  const prior = existsSync(DEDUP_PATH) ? parseEntries(readFileSync(DEDUP_PATH, 'utf8')) : [];
  const kept = pruneStaleEntries(prior, now);
  const lines = [...kept, entry].map((e) => JSON.stringify(e)).join('\n');
  writeFileSync(DEDUP_PATH, lines + '\n', 'utf8');
}
