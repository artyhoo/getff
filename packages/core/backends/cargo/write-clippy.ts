// cargo severity projection + crate writer — launch-preannounce-track S4 (F2a packaging).
// Spec: docs/superpowers/specs/2026-07-03-multi-toolchain-convention-compiler-design.md §4, §7.
//
// render-clippy.ts emits the clippy.toml (path bans). That surface carries NO severity — so an
// error-severity ban degrades FF7003 there, and `cargo clippy` exits 0 over a live violation
// (the warn-by-default lint level). This module adds the SECOND surface the render-clippy.ts
// FF7003 note names as "surface-5 (post-MVP)": the Cargo.toml `[lints.clippy]` table, which
// projects a node's requested severity onto clippy's own lint-level ladder
// (allow → warn → deny → forbid) so an error-severity ban FAILS the build.
//
// Honesty boundary (why FF7003 STAYS on the render-clippy.ts clippy.toml plane): clippy.toml
// genuinely has no severity field. `[lints.clippy]` lives in Cargo.toml, a different file. The
// projection is an ADDITIONAL plane, not an erasure of the clippy.toml limitation — so the
// render-clippy.ts outcome semantics (and the composition FF7003 truth-table) are unchanged.

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Severity } from '../../diagnostics/types.ts';
import type { ConventionNode } from '../../ir/types.ts';
import { renderCargoClippy } from './render-clippy.ts';

// clippy.toml table name -> the `[lints.clippy]` key (clippy's own lint name, underscored; the
// `clippy::` namespace is implied by the `[lints.clippy]` header). This is the SAME mapping
// render-clippy.ts's KIND_TO_TABLE produces, read back to a lint key.
const TABLE_TO_LINT: Record<string, string> = {
  'disallowed-methods': 'disallowed_methods',
  'disallowed-types': 'disallowed_types',
  'disallowed-macros': 'disallowed_macros',
};

const KIND_TO_TABLE: Record<string, string> = {
  method: 'disallowed-methods',
  type: 'disallowed-types',
  macro: 'disallowed-macros',
};

// Cargo lint level for a requested Severity. `note` has NO build-failing Cargo lint level (it is
// informational) — it is intentionally omitted from the projection, so a note-severity ban stays
// a non-gate on this plane too (consistent with its FF7003 degrade on the clippy.toml plane).
// A clippy lint level is per-lint-NAME (not per-entry), so when several nodes share a table the
// STRONGEST requested level wins (order below is the escalation ladder).
const SEVERITY_TO_LEVEL: Record<Severity, string | undefined> = {
  error: 'deny',
  warning: 'warn',
  note: undefined,
};

const LEVEL_RANK: Record<string, number> = { warn: 1, deny: 2 };

/**
 * Project the severities of a set of ConventionNode into a Cargo.toml `[lints.clippy]` fragment.
 * Only type-aware nodes with valid params (method/type/macro + path) contribute — the same nodes
 * render-clippy.ts places into a disallowed-* table. Returns "" when no node projects a level
 * (e.g. all note-severity, or all refused), so a caller can skip emitting an empty table.
 */
export function renderClippyLints(nodes: ConventionNode[]): string {
  const levelByLint = new Map<string, string>();
  for (const n of nodes) {
    if (n.selectorClass !== 'type-aware') continue;
    const kind = n.params['kind'];
    const path = n.params['path'];
    if (typeof kind !== 'string' || !(kind in KIND_TO_TABLE)) continue;
    if (typeof path !== 'string' || path.length === 0) continue;
    const table = KIND_TO_TABLE[kind];
    const lint = TABLE_TO_LINT[table];
    if (lint === undefined) continue;
    const level = SEVERITY_TO_LEVEL[n.defaultSeverity];
    if (level === undefined) continue; // note-severity: no build-level projection
    const existing = levelByLint.get(lint);
    if (existing === undefined || (LEVEL_RANK[level] ?? 0) > (LEVEL_RANK[existing] ?? 0)) {
      levelByLint.set(lint, level);
    }
  }
  if (levelByLint.size === 0) return '';
  const lints = [...levelByLint.keys()].sort();
  const lines = ['[lints.clippy]'];
  for (const lint of lints) {
    lines.push(`${lint} = "${levelByLint.get(lint)}"`);
  }
  return lines.join('\n') + '\n';
}

/**
 * Write the clippy.toml artefact for a crate directory (the "clippy.toml writer" — the packaging
 * step the render→fire chain was missing). Pure render (render-clippy.ts) + one fs write; the
 * severity fragment is returned by renderClippyLints for the caller to place into Cargo.toml
 * (Cargo.toml merge is intentionally NOT done here — the demo crate carries a committed
 * `[lints.clippy]` block that a self-application test byte-checks against renderClippyLints).
 */
export function writeCargoClippyToml(nodes: ConventionNode[], crateDir: string): void {
  const { toml } = renderCargoClippy(nodes);
  writeFileSync(join(crateDir, 'clippy.toml'), toml, 'utf8');
}
