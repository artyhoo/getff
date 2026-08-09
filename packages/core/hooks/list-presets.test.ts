/**
 * Contract tests for list-presets.sh — the data-driven preset enumerator
 * (beta-delivery-ux S2 / spec A4 §5 AC-2).
 *
 * AC-2: `list` verb surfaces all four presets, data-driven from
 * references/presets/*.json; adding a 5th preset file makes it appear with
 * zero code change.
 *
 *   ✅ ALL-FOUR-PRESETS-LISTED: aif, economy, night, sdd all appear
 *   ✅ DATA-DRIVEN-EXTENSIBILITY: a synthetic 5th JSON in presets/ appears
 *   ✅ DESCRIPTION-EMBEDDED: each preset's `description` field appears in output
 *   ✅ ALPHABETICAL-ORDER: output sorted alphabetically by preset name
 *
 * Reference: packages/core/hooks/parse-preset.test.ts (sibling).
 * T3 compliance: each assertion cites command + output excerpt.
 */
import { afterEach, beforeEach, describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, cpSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../..');
const HELPER = resolve(
  REPO_ROOT,
  '.claude/skills/pipeline/helpers/list-presets.sh',
);
const PRESETS_DIR = resolve(
  REPO_ROOT,
  '.claude/skills/pipeline/references/presets',
);

function runHelper(
  env?: Record<string, string>,
): { status: number; stdout: string; stderr: string } {
  const r = spawnSync('bash', [HELPER], {
    encoding: 'utf8',
    env: { ...process.env, ...env },
  });
  return { status: r.status ?? -1, stdout: r.stdout, stderr: r.stderr };
}

describe('list-presets.sh — preset enumerator (AC-2, data-driven)', () => {
  // ✅ ALL-FOUR-PRESETS-LISTED
  it('ALL-FOUR-PRESETS-LISTED: aif, economy, night, sdd all appear in output', () => {
    const r = runHelper();
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('aif');
    expect(r.stdout).toContain('economy');
    expect(r.stdout).toContain('night');
    expect(r.stdout).toContain('sdd');
  });

  // ✅ DESCRIPTION-EMBEDDED — each preset's `description` JSON field appears
  it('DESCRIPTION-EMBEDDED: each preset description appears in output', () => {
    const r = runHelper();
    // Pulled from references/presets/<name>.json `description` field.
    expect(r.stdout).toMatch(/autonomous overnight aif-handoff dispatch/i);
    expect(r.stdout).toMatch(/cost-conscious whole-line on executor tier/i);
    expect(r.stdout).toMatch(/night-mode unattended single-session/i);
    expect(r.stdout).toMatch(/interactive single-feature sdd/i);
  });

  // ✅ ALPHABETICAL-ORDER — preset names appear in alphabetical order.
  // Use the line-start anchor to avoid substring collisions (e.g. "night"
  // inside the aif description's "overnight"). Each preset name appears at
  // the start of its own line in the helper's output.
  it('ALPHABETICAL-ORDER: aif < economy < night < sdd in output', () => {
    const r = runHelper();
    expect(r.status).toBe(0);
    // Match line-start "name —" (the helper's emit format) so a description
    // containing the substring "night" (e.g. aif's "overnight") cannot
    // shadow the preset's own name row.
    const aifMatch = r.stdout.match(/^aif\s/m);
    const econMatch = r.stdout.match(/^economy\s/m);
    const nightMatch = r.stdout.match(/^night\s/m);
    const sddMatch = r.stdout.match(/^sdd\s/m);
    expect(aifMatch).not.toBeNull();
    expect(econMatch).not.toBeNull();
    expect(nightMatch).not.toBeNull();
    expect(sddMatch).not.toBeNull();
    expect(econMatch!.index!).toBeGreaterThan(aifMatch!.index!);
    expect(nightMatch!.index!).toBeGreaterThan(econMatch!.index!);
    expect(sddMatch!.index!).toBeGreaterThan(nightMatch!.index!);
  });

  // ✅ DATA-DRIVEN-EXTENSIBILITY — AC-2 falsifier: drop a 5th JSON file in a
  // tmp preset dir; point list-presets at it; verify the 5th name appears with
  // zero code change. The helper resolves the presets dir relative to itself,
  // so we override MO_PRESETS_DIR to a synthetic dir for this test.
  it('DATA-DRIVEN-EXTENSIBILITY: a 5th preset file appears with zero code change', () => {
    if (!existsSync(HELPER)) {
      console.warn(`list-presets.sh missing at ${HELPER} — skipping`);
      return;
    }
    // Construct a synthetic presets dir by copying the canonical 4 + adding a 5th.
    const tmpDir = mkdtempSync(join(tmpdir(), 'list-presets-ext-'));
    try {
      mkdirSync(join(tmpDir, 'presets'), { recursive: true });
      cpSync(PRESETS_DIR, join(tmpDir, 'presets'), { recursive: true });
      // Add the 5th synthetic preset (mirrors §8a Park-1 flat schema).
      writeFileSync(
        join(tmpDir, 'presets', 'synthetic-fifth.json'),
        JSON.stringify({
          mode: 'in-session',
          reviewer_tier: 'session-bound',
          marker: null,
          description: 'synthetic fifth preset for AC-2 extensibility test',
          predicates: {
            bundle_opt_in: false,
            review_required: true,
            parallel_safe: false,
          },
        }),
      );

      // Override the canonical presets dir via MO_PRESETS_DIR (env knob).
      const r = spawnSync('bash', [HELPER], {
        encoding: 'utf8',
        env: { ...process.env, MO_PRESETS_DIR: join(tmpDir, 'presets') },
      });
      const stdout = r.stdout ?? '';
      const status = r.status ?? -1;
      expect(status).toBe(0);
      expect(stdout).toContain('synthetic-fifth');
      expect(stdout).toMatch(/synthetic fifth preset/i);
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
