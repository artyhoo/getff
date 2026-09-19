#!/usr/bin/env node
/**
 * skill-tiers — the ONE reader of the `GETFF_SKILLS_{CORE,ENV,FACTORY}` tier constants.
 *
 * WHY (ref-gen G12, docs/superpowers/specs/2026-09-14-getff-ai-reference-generator-design.md §2):
 * two renderers need the three-tier skill read — `render-install-roster.mjs` read CORE/ENV
 * inline and the D29 reference generator needs all three for family B. A second JS reader of
 * `GETFF_SKILLS_*` is the #sync-by-copy-paste shape (dual-implementation-discipline.md §8);
 * the G12 falsifier says collapse to THIS module. `*.test.*` files read lib.sh independently
 * ON PURPOSE — a parity test that imports the module it checks compares the parser with itself.
 *
 * Posture: fail-closed on a missing constant (the roster's own `readSet` behaviour, never a
 * silent empty set). Constant names are literals here; the VALUES are never restated.
 *
 * Run via plain node (no .ts import — pure fs/regex); imported by render-install-roster.mjs
 * (CORE/ENV today) and scripts/render-reference.mjs (all three, family B).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const TIER_CONSTANTS = [
  ['core', 'GETFF_SKILLS_CORE'],
  ['env', 'GETFF_SKILLS_ENV'],
  ['factory', 'GETFF_SKILLS_FACTORY'],
];

/**
 * Parse the three tier sets out of setup.d/lib.sh TEXT. Throws naming the first missing
 * constant — fail-closed, the roster's posture (render-install-roster.mjs readSet).
 * Returns arrays SORTED (determinism: callers may merge with installer literals first,
 * but the module never emits insertion-order-dependent output).
 */
export function readTierSets(libText) {
  const out = {};
  for (const [key, name] of TIER_CONSTANTS) {
    const m = libText.match(new RegExp(`${name}="([^"]+)"`));
    if (!m) throw new Error(`setup.d/lib.sh: ${name} not found`);
    out[key] = m[1].split(/\s+/).filter(Boolean).sort();
  }
  return out;
}

/** Read the tier sets from the repo at `root` (setup.d/lib.sh on disk). */
export function readSkillTiers(root) {
  return readTierSets(readFileSync(join(root, 'setup.d', 'lib.sh'), 'utf8'));
}
