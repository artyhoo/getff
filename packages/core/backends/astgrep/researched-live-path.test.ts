// Researched-python LIVE path e2e — ecosystem-wiring W5 (the stage deliverable).
//
// WHAT THIS PROVES (kickoff §1/§2 W5, corrected input): a RESEARCHED (not starter) python rule
// flows research JSON → generation → delivery → FIRES on a scratch python consumer, through the
// SHIPPED live-adapter machinery — NOT via a pre-seeded PY_TEMPLATE_DIR assembled source dir
// (that was the LG-S1 Inc3 / W3 proof, live-generation-delivery.test.ts). Every hop here is the
// shipped consumer surface:
//
//   1. research JSON — the consumer-authored practice record at
//      <consumer>/.getff/rules-research/<id>.practice.json (the realistic yaml.load convention;
//      byte-reuse of the committed LG-S1 record — the flagship researched python convention).
//   2. generation — the REAL `rule-bootstrap-cli.ts --from-practice` entrypoint (spawned, exit
//      code asserted): AstgrepResearchedPractice → researchedPracticeToNode bridge → renderAstgrep
//      → <consumer>/.getff/rules-research/<id>.yml (session-side render, Model A′ §Qa).
//   3. delivery — the python seam `deliver_python_toolchain` (setup.d/45-python.sh) with its
//      DEFAULT template dir (NO PY_TEMPLATE_DIR override): starters copied + the researched rule
//      JOINED into .getff/astgrep-rules/ (_py_join_researched_rules, W5) + sgconfig.yml.
//   4. fire — pinned ast-grep scan on the consumer: RED (rule id reported, bare exit 1) on a
//      planted `yaml.load(raw)`, CLEAN (zero findings, exit 0) on `yaml.safe_load(raw)`.
//
// Also proven: refresh-survival (a --refresh pass rm-rf-replaces the scan dir from the template,
// lib.sh:126 — the join re-assembles the researched rule, so it still fires), and the CLI-hop
// non-vacuity control (no practice record → the SAME planted violation does NOT report the id).
//
// Home rationale (backends/astgrep/): the firing arms need the REAL pinned ast-grep binary, which
// CI installs + runs ONLY for the `test:backends` suite (mirrors live-generation-delivery.test.ts).
//
// $0-in-CI (principle 17 / no-paid-llm-in-ci.md): every input is committed in-source; the "research"
// already happened (LG-S1 record) — no live MCP/LLM call anywhere.

import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { deriveToolVersion, fireContract, type AstgrepFiringContract } from './firing-runner.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
// .../packages/core/backends/astgrep → repo root (four levels up).
const REPO_ROOT = resolve(HERE, '../../../..');

const RULE_ID = 'getff-researched-no-yaml-load';
const CLI = join(REPO_ROOT, 'packages/core/install/rule-bootstrap-cli.ts');
/** The committed realistic researched python convention (yaml.load) — reused as the consumer-
 *  authored research JSON (no fixture duplication; the record IS the research artefact). */
const PRACTICE_SRC = join(
  REPO_ROOT,
  'packages/core/synthesizer/fixtures/live-generation',
  `${RULE_ID}.practice.json`,
);
/** The committed rendered artifact — render-parity oracle (same pure plan pipeline). */
const RENDERED_SRC = join(
  REPO_ROOT,
  'packages/core/synthesizer/fixtures/live-generation/firing/rules',
  `${RULE_ID}.yml`,
);

const LIVE_TIMEOUT_MS = 120_000;

// Delivery driver — the seam VERBATIM with its DEFAULT template dir (the load-bearing difference
// from live-generation-delivery.test.ts: NO PY_TEMPLATE_DIR pre-seed; the researched rule reaches
// the scan dir ONLY via the shipped rules-research join). Optional 3rd arg "refresh" sets the S2
// refresh flag (GETFF_TOOLCHAIN_REFRESH=1) so the rm-rf-replace + re-join path runs.
const DELIVER_DRIVER = `
set -uo pipefail
REPO_ROOT="$1"; PROJECT_ROOT="$2"; MODE="\${3:-}"
PKG_ROOT="$REPO_ROOT"; FORCE=""; DRY_RUN=""; SKIPPED=()
[ "$MODE" = "refresh" ] && GETFF_TOOLCHAIN_REFRESH=1
export INSTALL_SH_LIB_ONLY=1
# shellcheck source=/dev/null
source "$REPO_ROOT/setup.d/lib.sh"
export PY_LAYER_LIB_ONLY=1
# shellcheck source=/dev/null
source "$REPO_ROOT/setup.d/45-python.sh"
deliver_python_toolchain
`;

const tmpDirs: string[] = [];
afterEach(() => {
  for (const d of tmpDirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

/** A fresh OS-temp python consumer root (mkdtemp — NEVER under the tracked tree). */
function freshConsumer(): string {
  const c = mkdtempSync(join(tmpdir(), 'w5-researched-live-'));
  tmpDirs.push(c);
  writeFileSync(join(c, 'pyproject.toml'), '[project]\nname = "scratch"\nversion = "0"\n');
  return c;
}

/** Hop 1 — author the research JSON on the consumer (the rules-research home, dir-mode CLI input). */
function authorPracticeRecord(consumer: string): void {
  const dir = join(consumer, '.getff', 'rules-research');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${RULE_ID}.practice.json`), readFileSync(PRACTICE_SRC, 'utf8'));
}

/** Hop 2 — the REAL CLI entrypoint: --from-practice over the consumer's rules-research dir. */
function runCliRender(consumer: string): { status: number | null; stdout: string; stderr: string } {
  const r = spawnSync(
    'npx',
    [
      '--no-install', 'tsx', CLI,
      '--consumer-root', consumer,
      '--from-practice', join(consumer, '.getff', 'rules-research'),
    ],
    { cwd: REPO_ROOT, encoding: 'utf8' },
  );
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}

/** Hop 3 — the delivery seam, DEFAULT template dir. mode 'refresh' runs the S2 refresh pass. */
function runDelivery(consumer: string, mode: '' | 'refresh' = ''): number | null {
  return runDeliveryFull(consumer, mode).status;
}

/** As {@link runDelivery} but also returns the seam's stdout+stderr (for asserting loud logs). */
function runDeliveryFull(
  consumer: string,
  mode: '' | 'refresh' = '',
): { status: number | null; out: string } {
  const r = spawnSync('bash', ['-c', DELIVER_DRIVER, 'deliver', REPO_ROOT, consumer, mode], {
    encoding: 'utf8',
  });
  return { status: r.status, out: `${r.stdout}${r.stderr}` };
}

/** Read every delivered scan-dir rule as basename→bytes (byte-identity oracle across passes). */
function scanDirBytes(consumer: string): Record<string, string> {
  const dir = join(consumer, '.getff', 'astgrep-rules');
  const out: Record<string, string> = {};
  for (const f of readdirSync(dir).filter((n) => n.endsWith('.yml')).sort()) {
    out[f] = readFileSync(join(dir, f), 'utf8');
  }
  return out;
}

const CONTRACT: AstgrepFiringContract = {
  command: 'ast-grep scan --json',
  jsonPath: '$.ruleId',
  expectedCode: RULE_ID,
};

/** Bare `ast-grep scan` (numeric exit lane): exit 1 dirty / exit 0 clean. */
function bareScanStatus(consumer: string): number | null {
  return spawnSync(
    'ast-grep',
    ['scan', '-c', join(consumer, 'sgconfig.yml'), join(consumer, 'src.py')],
    { cwd: consumer, encoding: 'utf8' },
  ).status;
}

// ── Always-on (no ast-grep needed): the render + join hops leave the exact committed bytes ────────

describe('W5 live path — render + delivery hops (always-on)', () => {
  it(
    'research JSON → CLI render → delivery join: the researched rule lands in the scan dir byte-identical',
    { timeout: LIVE_TIMEOUT_MS },
    () => {
      const consumer = freshConsumer();
      authorPracticeRecord(consumer);

      const cli = runCliRender(consumer);
      expect(cli.status).toBe(0);
      const out = JSON.parse(cli.stdout) as { mode: string; rendered: { entryId: string }[] };
      expect(out.mode).toBe('practice-render');
      expect(out.rendered.map((r) => r.entryId)).toEqual([RULE_ID]);

      // Session-side rendered artefact in the refresh-durable home, byte-identical to the
      // committed Model A′ artifact (same pure bridge+renderAstgrep pipeline).
      const renderedOnConsumer = join(consumer, '.getff', 'rules-research', `${RULE_ID}.yml`);
      expect(readFileSync(renderedOnConsumer, 'utf8')).toBe(readFileSync(RENDERED_SRC, 'utf8'));

      expect(runDelivery(consumer)).toBe(0);
      // Joined into the scan dir alongside the starters; single additive ruleDirs entry.
      const joined = join(consumer, '.getff', 'astgrep-rules', `${RULE_ID}.yml`);
      expect(existsSync(joined)).toBe(true);
      expect(readFileSync(joined, 'utf8')).toBe(readFileSync(RENDERED_SRC, 'utf8'));
      const sg = readFileSync(join(consumer, 'sgconfig.yml'), 'utf8');
      expect(sg.match(/^ruleDirs:/gm)?.length).toBe(1);
      expect(sg).toMatch(/^\s*-\s+\.getff\/astgrep-rules\s*$/m);
    },
  );

  it(
    'refresh-survival: a --refresh pass rm-rf-replaces the scan dir, and the join re-assembles the researched rule',
    { timeout: LIVE_TIMEOUT_MS },
    () => {
      const consumer = freshConsumer();
      authorPracticeRecord(consumer);
      expect(runCliRender(consumer).status).toBe(0);
      expect(runDelivery(consumer)).toBe(0);

      const joined = join(consumer, '.getff', 'astgrep-rules', `${RULE_ID}.yml`);
      expect(existsSync(joined)).toBe(true);

      expect(runDelivery(consumer, 'refresh')).toBe(0);
      // Still present after the refresh_safe rm-rf + template re-copy (lib.sh:126) — the join ran.
      expect(existsSync(joined)).toBe(true);
      expect(readFileSync(joined, 'utf8')).toBe(readFileSync(RENDERED_SRC, 'utf8'));
    },
  );

  // ── W5 rework (Finding 3): behaviours the kickoff names but the reviewer proved only ad-hoc. ────
  it(
    'collision refuse-loudly: a researched basename colliding with a template rule is REFUSE-skipped (template wins, loud log)',
    { timeout: LIVE_TIMEOUT_MS },
    () => {
      const consumer = freshConsumer();
      // A researched rule whose BASENAME collides with a template-owned starter (getff-no-eval.yml).
      // Its bytes are DELIBERATELY different from the template so a silent clobber would be visible.
      const rrDir = join(consumer, '.getff', 'rules-research');
      mkdirSync(rrDir, { recursive: true });
      const impostorBytes = '# RESEARCHED IMPOSTOR — must never overwrite the template starter\nid: "getff-no-eval"\n';
      writeFileSync(join(rrDir, 'getff-no-eval.yml'), impostorBytes);

      const { status, out } = runDeliveryFull(consumer);
      expect(status).toBe(0);
      // Loud REFUSE log fired (attention-is-not-a-mechanism: the skip is announced, not silent).
      expect(out).toMatch(/REFUSE researched join: getff-no-eval\.yml/);

      // The scan-dir copy is the TEMPLATE starter, byte-identical — the impostor did NOT win.
      const delivered = readFileSync(
        join(consumer, '.getff', 'astgrep-rules', 'getff-no-eval.yml'),
        'utf8',
      );
      const templateStarter = readFileSync(
        join(REPO_ROOT, 'packages/core/templates/python/.getff/astgrep-rules/getff-no-eval.yml'),
        'utf8',
      );
      expect(delivered).toBe(templateStarter);
      expect(delivered).not.toBe(impostorBytes);
    },
  );

  it(
    'byte-stable idempotency: two delivery passes leave the scan dir byte-identical (the join is not perturbing)',
    { timeout: LIVE_TIMEOUT_MS },
    () => {
      const consumer = freshConsumer();
      authorPracticeRecord(consumer);
      expect(runCliRender(consumer).status).toBe(0);

      expect(runDelivery(consumer)).toBe(0);
      const pass1 = scanDirBytes(consumer);
      expect(runDelivery(consumer)).toBe(0);
      const pass2 = scanDirBytes(consumer);

      // Same file set AND same bytes per file — including the joined researched rule.
      expect(Object.keys(pass2).sort()).toEqual(Object.keys(pass1).sort());
      expect(pass2).toEqual(pass1);
      expect(Object.keys(pass1)).toContain(`${RULE_ID}.yml`);
    },
  );
});

// ── Firing arms (pinned ast-grep) — the W5 headline RED + CLEAN + non-vacuity control ─────────────

const resolvedVersion = deriveToolVersion(CONTRACT.command);
const toolPresent = resolvedVersion !== undefined;

if (!toolPresent) {
  // Real module-level loud-skip (a console.warn inside a skipIf body never fires) — the live path
  // must NOT be claimed green on live-fire from a run that never fired it (mirrors firing.test.ts).
  console.warn(
    '⚠ live ast-grep firing SKIPPED for the W5 researched-live-path RED/CLEAN proof (ast-grep not ' +
      'on PATH); the live path MUST NOT be claimed green on live-fire from this run alone. The ' +
      'always-on render+join block above still gates.',
  );
}

describe.skipIf(!toolPresent)('W5 live path — the researched rule FIRES on the consumer', () => {
  it(
    'RED: planted yaml.load(raw) → ruleIds contains the researched id (bare scan exit 1)',
    { timeout: LIVE_TIMEOUT_MS },
    () => {
      const consumer = freshConsumer();
      authorPracticeRecord(consumer);
      expect(runCliRender(consumer).status).toBe(0);
      expect(runDelivery(consumer)).toBe(0);
      writeFileSync(join(consumer, 'src.py'), 'import yaml\n\ndata = yaml.load(raw)\n');

      const { codes } = fireContract(CONTRACT, consumer);
      expect(codes.has(RULE_ID)).toBe(true);
      expect(bareScanStatus(consumer)).toBe(1);
    },
  );

  it(
    'CLEAN: yaml.safe_load(raw) → zero findings (bare scan exit 0)',
    { timeout: LIVE_TIMEOUT_MS },
    () => {
      const consumer = freshConsumer();
      authorPracticeRecord(consumer);
      expect(runCliRender(consumer).status).toBe(0);
      expect(runDelivery(consumer)).toBe(0);
      writeFileSync(join(consumer, 'src.py'), 'import yaml\n\ndata = yaml.safe_load(raw)\n');

      const { codes } = fireContract(CONTRACT, consumer);
      expect(codes.has(RULE_ID)).toBe(false);
      expect(codes.size).toBe(0);
      expect(bareScanStatus(consumer)).toBe(0);
    },
  );

  it(
    'non-vacuity: NO practice record authored → the SAME planted violation does NOT report the id',
    { timeout: LIVE_TIMEOUT_MS },
    () => {
      // Delivery-only consumer (starters ship, no research hop) — proves the RED above is caused
      // by the research→render→join chain, not ambient (#discipline-theatre falsifier).
      const consumer = freshConsumer();
      expect(runDelivery(consumer)).toBe(0);
      expect(existsSync(join(consumer, '.getff', 'astgrep-rules', `${RULE_ID}.yml`))).toBe(false);

      writeFileSync(join(consumer, 'src.py'), 'import yaml\n\ndata = yaml.load(raw)\n');
      const { codes } = fireContract(CONTRACT, consumer);
      expect(codes.has(RULE_ID)).toBe(false);
    },
  );
});
