// Symbolic drift detector v1 — operationalizes open-questions §13.7 first half.
// Three canonical own-doc sources are scanned for two kinds of drift:
//   1. modal-verb: a principle term appears with a different MUST/SHOULD/MAY
//      strength across sources where it is mentioned.
//   2. term-presence: a principle is absent in ≥2 sources (acceptance criterion
//      for L2 in self-application.md §2 is "all three semantically synchronized").
// Behavioral and embedding-based v2/v3 are deferred per phase-5-research §6.

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { DriftMismatch, DriftReport } from './types.ts';

export const SELF_APP_SOURCES = [
  'skills/getff/SKILL.md',
  'skills/getff/references/overview.md',
  'skills/getff/references/ai-traps.md',
] as const;

interface Principle {
  id: string;
  aliases: RegExp[];
}

const PRINCIPLES: Principle[] = [
  { id: '5-layer framework', aliases: [/\b5[\s-]?layers?\b/i, /\bfive[\s-]?layers?\b/i] },
  { id: 'AST over grep', aliases: [/\bAST\b/i] },
  { id: 'paired negative tests', aliases: [/\bpaired\s+negative\b/i, /\bnegative[\s-]?tests?\b/i] },
  { id: 'mutation testing', aliases: [/\bmutation(\s+testing)?\b/i, /\bStryker\b/i] },
  { id: 'two-AI review', aliases: [/\btwo[\s-]?AI\b/i, /\breview[-\s]?sidecar\b/i] },
];

const MODAL_RANK: Record<string, number> = {
  'MUST NOT': 5,
  MUST: 5,
  'SHOULD NOT': 3,
  SHOULD: 3,
  MAY: 1,
};

function strongestModalNear(text: string, regex: RegExp): string | null {
  // Same-line only: modal verb must appear on the same line as the principle
  // alias to be attributed to that principle. Multi-line windows pick up modals
  // belonging to neighbouring principles (false positives), so the window is
  // tight by construction.
  const matches: string[] = [];
  for (const line of text.split('\n')) {
    if (!regex.test(line)) continue;
    const modalMatch = line.match(/\bMUST NOT\b|\bSHOULD NOT\b|\bMUST\b|\bSHOULD\b|\bMAY\b/);
    if (modalMatch) matches.push(modalMatch[0]);
  }
  if (matches.length === 0) return null;
  return matches.reduce(
    (acc, m) => (MODAL_RANK[m] > (MODAL_RANK[acc] ?? -1) ? m : acc),
    matches[0],
  );
}

function principleAppears(text: string, p: Principle): boolean {
  return p.aliases.some((rx) => rx.test(text));
}

export function detectDrift(repoRoot: string): DriftReport {
  const present: Record<string, Record<string, string | null>> = {};
  const sources: string[] = [];
  for (const rel of SELF_APP_SOURCES) {
    const abs = resolve(repoRoot, rel);
    if (!existsSync(abs)) {
      throw new Error(`Self-application source missing: ${rel}`);
    }
    sources.push(rel);
    const text = readFileSync(abs, 'utf8');
    for (const p of PRINCIPLES) {
      present[p.id] ??= {};
      if (!principleAppears(text, p)) {
        present[p.id][rel] = null;
        continue;
      }
      const mainAlias = p.aliases[0];
      present[p.id][rel] = strongestModalNear(text, mainAlias) ?? '';
    }
  }

  const mismatches: DriftMismatch[] = [];
  for (const p of PRINCIPLES) {
    const perSource = present[p.id];
    const foundIn = sources.filter((s) => perSource[s] !== null);
    const missingIn = sources.filter((s) => perSource[s] === null);
    if (foundIn.length < 2) {
      mismatches.push({
        kind: 'term-presence',
        detail: `principle "${p.id}" appears in ${foundIn.length}/3 sources (expected ≥2)`,
        foundIn,
        missingIn,
      });
      continue;
    }
    const ranks = foundIn.map((s) => MODAL_RANK[perSource[s] ?? ''] ?? 0);
    const minRank = Math.min(...ranks);
    const maxRank = Math.max(...ranks);
    if (maxRank > 0 && maxRank !== minRank) {
      mismatches.push({
        kind: 'modal-verb',
        detail: `principle "${p.id}" has divergent modal verbs across sources: ${foundIn
          .map((s) => `${s}=${perSource[s] || '∅'}`)
          .join(', ')}`,
        foundIn,
        missingIn: [],
      });
    }
  }

  return { sources, mismatches };
}
