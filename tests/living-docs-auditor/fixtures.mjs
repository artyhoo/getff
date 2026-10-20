// Fixture builder shared by runtime.test.mjs / conformance.test.mjs (kickoff-d0 §5 oracle).
//
// Layouts mirror a post-install CONSUMER root: the runner scripts carry the REAL
// source-artifact bytes (the same bytes setup.d copy_safe delivers), and the
// supporting files are what a real consumer has after install (tool-decisions.md
// seeded, AGENTS.md declaring an existing skill, clean JSON configs). The command
// artifact under test is the READY artifact of kickoff §2 — the bundle — standing
// in for the consumer destination scripts/living-docs-audit.mjs, whose installer
// delivery is reservation-gated (plan r2 MAJOR-2; d0-result §Residual).
import { readFileSync, mkdirSync, writeFileSync, rmSync, mkdtempSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

export const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../..');
export const COMMAND_ARTIFACT = join(repoRoot, 'packages/core/audit-self/living-docs-audit.bundle.mjs');
export const ROLE_FILE = join(repoRoot, '.agents/roles/living-docs-auditor.md');
export const RUNNER_BYTES = {
  base: readFileSync(join(repoRoot, 'packages/core/audit-self/audit-ai-docs.sh')),
  'react-next': readFileSync(join(repoRoot, 'packages/preset-next-15-canonical/audit-self/audit-ai-docs.react-next.sh')),
  'react-spa': readFileSync(join(repoRoot, 'packages/preset-react-spa/audit-self/audit-ai-docs.react-spa.sh')),
};
// The R4 helper the base runner invokes via `npx tsx` — real bytes for identity arms.
export const R4_HELPER_BYTES = readFileSync(join(repoRoot, 'packages/core/probes/audit-r4.ts'));

/**
 * Build a clean consumer layout for a profile. Returns the fixture root.
 * opts.drop — runner script path (relative to root) to OMIT (missing-runner controls).
 */
export function buildCleanFixture(profile, opts = {}) {
  const root = mkdtempSync(join(tmpdir(), `d0-${profile.replace('react-', '')}-`));
  mkdirSync(join(root, 'scripts'), { recursive: true });
  mkdirSync(join(root, '.claude/skills/demo'), { recursive: true });
  mkdirSync(join(root, '.ai-factory'), { recursive: true });
  const deliveries = {
    base: [['scripts/audit-ai-docs.sh', RUNNER_BYTES.base]],
    'react-next': [
      ['scripts/audit-ai-docs.sh', RUNNER_BYTES.base],
      ['scripts/audit-ai-docs.react-next.sh', RUNNER_BYTES['react-next']],
    ],
    'react-spa': [
      ['scripts/audit-ai-docs.sh', RUNNER_BYTES.base],
      ['scripts/audit-ai-docs.react-spa.sh', RUNNER_BYTES['react-spa']],
    ],
    'react-native': [],
  }[profile];
  for (const [dest, bytes] of deliveries) {
    if (opts.drop === dest) continue;
    writeFileSync(join(root, dest), bytes);
  }
  writeFileSync(join(root, '.claude/skills/demo/SKILL.md'), '# Demo skill\n');
  // Declaration grammar (audit-ai-docs.ts:168-196): text ending in "skill" followed by
  // an inlineCode name. The reverse order ("`demo` skill at …") declares NOTHING — a
  // vacuous D1 pass. This shape declares `demo`, which exists → a genuine pass.
  writeFileSync(join(root, 'AGENTS.md'), '# AGENTS\n\nUse the skill `demo` at `.claude/skills/demo/SKILL.md`.\n');
  writeFileSync(join(root, '.mcp.json'), '{\n  "mcpServers": {}\n}\n');
  // A real consumer has this auto-seeded by install.sh; without it D4 reports
  // tool-decisions.md missing (a known-incomplete WARN), so the clean fixture carries it.
  writeFileSync(join(root, '.ai-factory/tool-decisions.md'), '# tool decisions\n\nRecorded.\n');
  if (profile === 'react-next') writeFileSync(join(root, 'next.config.js'), 'export default {};\n');
  if (profile === 'react-spa') {
    writeFileSync(join(root, 'package.json'), '{\n  "name": "spa-demo",\n  "dependencies": { "react": "^19.0.0" }\n}\n');
    // R-SPA-EB probes eslint.config.mjs for the require-error-boundary wiring the preset delivers.
    writeFileSync(join(root, 'eslint.config.mjs'), "// eslint config\nimport requireErrorBoundary from 'rules-as-tests/require-error-boundary';\nexport default [];\n");
  }
  return root;
}

export function disposeFixture(root) { rmSync(root, { recursive: true, force: true }); }

/** Run the command artifact exactly as the role documents it (kickoff §2 contract). */
export function runCommand(args, opts = {}) {
  return spawnSync(process.execPath, [COMMAND_ARTIFACT, ...args], { encoding: 'utf8', timeout: 120_000, ...opts });
}

/** Parse the single JSON result the command writes to stdout (stderr = launcher diagnostics). */
export function readResult(spawnResult) {
  return JSON.parse(spawnResult.stdout);
}

/** Materialize the actual ready artifact; the child cannot import the source checkout. */
export function deliverCommand(root) {
  writeFileSync(join(root, 'scripts/living-docs-audit.mjs'), readFileSync(COMMAND_ARTIFACT));
}

export function runDeliveredCommand(root, args, nodeArgs = []) {
  deliverCommand(root);
  return spawnSync(process.execPath, [...nodeArgs, 'scripts/living-docs-audit.mjs', ...args], {
    cwd: root, encoding: 'utf8', timeout: 120_000,
  });
}

/** Bind placeholders, then execute the role's actual shell block without repairing its command. */
export function runRoleInvocation(root, profile, roleText = readFileSync(ROLE_FILE, 'utf8')) {
  const section = roleText.split('### Step 3: Invoke the command (the ONE invocation)')[1];
  assert.ok(section, 'role invocation section must exist');
  const block = section.split('```bash\n')[1]?.split('```')[0];
  assert.ok(block, 'role executable block must exist');
  const quote = value => "'" + value.replaceAll("'", "'\\''") + "'";
  const bound = block.replace('<absolute-root>', quote(root))
    .replace('<base|react-next|react-spa|react-native>', quote(profile))
    .replace(/^\s*\[--[^\n]+\](?:\s*\\)?\s*$/gm, '');
  return spawnSync('bash', ['-c', bound], { cwd: root, encoding: 'utf8', timeout: 120_000 });
}

/** Fixed caller oracle: literal expectations from kickoff §4/§5, independent of production parsing. */
export function assertRoleAuditResult(res, root, profile, debt = false) {
  assert.match(res.stdout, /^\s*\{/, 'role invocation must produce actual audit JSON');
  const result = JSON.parse(res.stdout);
  assert.equal(res.status, debt ? 1 : 0, res.stderr);
  assert.equal(result.schema, 'getff.living-docs-audit/1');
  assert.equal(result.resolvedTarget, root);
  assert.equal(result.requestedProfile, profile);
  assert.equal(result.complete, true);
  assert.equal(result.runner.admitted, true);
  assert.equal(result.checks.find(c => c.check === `${profile}/completion`).status, 'passed');
  const declaration = result.checks.find(c => c.check === 'structured/d1-skills');
  assert.equal(declaration.status, debt ? 'violations' : 'passed');
  if (debt) {
    assert.ok(declaration.findings.some(f => f.severity === 'blocking'
      && f.message.includes("skill 'caller-missing'") && f.location?.file === 'AGENTS.md'));
  } else assert.equal(result.counts.blocking, 0);
}
