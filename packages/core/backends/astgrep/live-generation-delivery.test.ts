// Live-generation python adapter — Increment 3 (the flagship): deliver the INC-2 researched rule to
// a FRESH scratch consumer through the python-delivery-v0 seam, then prove it FIRES RED.
// Umbrella: live-generation LG-S1, Increment 3. Spec:
// docs/meta-factory/research-patches/2026-07-11-live-generation.md §Qd (delivery: additive ruleDirs,
// namespaced getff-researched-*, idempotent structural merge) / §Qe (the getff-no-yaml-load fire:
// exit 1 RED / exit 0 clean @0.44.1) / §Qa (Model A′ — the seam ships the STATIC pre-rendered artifact).
//
// WHAT THIS PROVES (the LG-S1 headline "live generation WORKS for python"): the INC-2 committed
// researched rule (getff-researched-no-yaml-load) is DELIVERED to a fresh consumer through the
// python-delivery-v0 `setup.d/45-python.sh` augment-first seam — REUSED VERBATIM via its
// `PY_TEMPLATE_DIR` env override (ZERO seam edit) — and then FIRES RED (ast-grep scan reports the
// ruleId, exit 1) on a planted `yaml.load(raw)`, and is CLEAN (exit 0, zero findings) on
// `yaml.safe_load(raw)`.
//
// Home rationale (backends/astgrep/, NOT tests/install-sh/): AC2 fires the REAL pinned ast-grep
// binary, which CI installs + runs ONLY for the `test:backends` suite (audit-self.yml — "Install
// pinned ast-grep" + "Run packages/core/backends tests"). Placing the RED anywhere else → loud-skip in
// CI = green-without-firing. Mirrors the INC-2 sibling live-generation-research.test.ts home rationale.
//
// $0-in-CI (principle 17 / no-paid-llm-in-ci.md): every input is a COMMITTED in-source artifact — the
// shipped starter templates + the INC-2 rendered artifact — assembled into a session source dir. NO
// live MCP/research call. The pinned @ast-grep/cli@0.44.1 is a FREE PATH binary; its network install
// (audit-self.yml) is fine — $0 = no paid MCP/LLM, NOT network-free.
//
// Model A′ STOP-line dogfood: the researched rule is delivered PER-CONSUMER via the assembled source
// dir; it is NEVER baked into the shipped templates/python starter set (asserted in AC1) — else the
// yaml.load ban would become a PERMANENT rule for EVERY python consumer, contradicting §Qe
// ("genuinely-researched-not-starter") and Model A′ (per-consumer researched artifact).
//
// Seam reuse (VERBATIM, no edit): the driver below sources setup.d/lib.sh + setup.d/45-python.sh with
// PY_LAYER_LIB_ONLY=1 and calls the seam's own public entrypoint `deliver_python_toolchain`, exactly
// as tests/install-sh/python-delivery.test.sh does. The researched rule joins the consumer's single
// `ruleDirs: [.getff/astgrep-rules]` because `_py_deliver_astgrep` (45-python.sh:148-155) copies the
// WHOLE assembled `.getff/astgrep-rules` dir — the reuse hook is PY_TEMPLATE_DIR (45-python.sh:416).

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  cpSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { deriveToolVersion, fireContract, type AstgrepFiringContract } from './firing-runner.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
// .../packages/core/backends/astgrep → repo root (four levels up).
const REPO_ROOT = resolve(HERE, '../../../..');

const RULE_ID = 'getff-researched-no-yaml-load';
/** The SHIPPED starter template dir (reused as the base of the assembled per-consumer source dir). */
const STARTER_TPL = join(REPO_ROOT, 'packages/core/templates/python');
/** The INC-2 committed rendered artifact (Model A′ static output) — what gets delivered per-consumer. */
const RESEARCHED_RULE_SRC = join(
  REPO_ROOT,
  'packages/core/synthesizer/fixtures/live-generation/firing/rules',
  `${RULE_ID}.yml`,
);
const STARTER_RULE_IDS = [
  'getff-no-datetime-datetime-now',
  'getff-no-datetime-now',
  'getff-no-eval',
  'getff-no-os-system',
] as const;

/** The running audit trail carries a `date -u` header → its bytes differ every run; excluded from the
 *  idempotency fingerprint, exactly as the seam excludes it from its own (v) checksum. */
const AUDIT_LOG = '.getff-python-install.log';

// Delivery driver — REUSES the seam VERBATIM (no edit): source lib.sh + the layer (lib-only mode so
// the activation guard does not auto-run), then call the seam's public entrypoint. PY_TEMPLATE_DIR is
// read by deliver_python_toolchain (45-python.sh:416); PROJECT_ROOT/PKG_ROOT/FORCE/DRY_RUN/SKIPPED are
// the dispatcher-scope globals the layer + lib helpers read (same set python-delivery.test.sh sets).
const DELIVER_DRIVER = `
set -uo pipefail
REPO_ROOT="$1"; PROJECT_ROOT="$2"; PY_TEMPLATE_DIR="$3"
PKG_ROOT="$REPO_ROOT"; FORCE=""; DRY_RUN=""; SKIPPED=()
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

/** Assemble a SESSION source dir = the shipped starter template + (optionally) the INC-2 researched
 *  rule dropped into the SAME `.getff/astgrep-rules` dir. `includeResearched=false` is the delivery-
 *  gated non-vacuity control. */
function assembleSourceDir(includeResearched: boolean): string {
  const src = mkdtempSync(join(tmpdir(), 'lg-s1-inc3-src-'));
  tmpDirs.push(src);
  cpSync(STARTER_TPL, src, { recursive: true });
  if (includeResearched) {
    cpSync(RESEARCHED_RULE_SRC, join(src, '.getff', 'astgrep-rules', `${RULE_ID}.yml`));
  }
  return src;
}

/** A fresh OS-temp consumer root (mkdtemp — NEVER under the tracked tree). */
function freshConsumer(): string {
  const c = mkdtempSync(join(tmpdir(), 'lg-s1-inc3-consumer-'));
  tmpDirs.push(c);
  writeFileSync(join(c, 'package.json'), '{"name":"lg-s1-inc3-consumer","version":"0.0.0"}\n');
  return c;
}

/** Run the delivery seam against a consumer root + assembled template dir. Returns the exit status. */
function runDelivery(consumerRoot: string, templateDir: string): number | null {
  const r = spawnSync('bash', ['-c', DELIVER_DRIVER, 'deliver', REPO_ROOT, consumerRoot, templateDir], {
    encoding: 'utf8',
  });
  return r.status;
}

/** Sorted "sha256  relpath" digest of the delivered config tree (EXCLUDES the running audit log). */
function configFingerprint(root: string): string {
  const files: string[] = [];
  const walk = (dir: string): void => {
    for (const name of readdirSync(dir)) {
      const abs = join(dir, name);
      if (statSync(abs).isDirectory()) walk(abs);
      else files.push(relative(root, abs));
    }
  };
  walk(root);
  return files
    .filter((rel) => rel !== AUDIT_LOG)
    .sort()
    .map((rel) => `${createHash('sha256').update(readFileSync(join(root, rel))).digest('hex')}  ${rel}`)
    .join('\n');
}

// ── AC1: delivery is additive (researched rule joins the single ruleDirs) + idempotent ────────────

describe('AC1 — researched rule delivered additively + idempotently via the PY_TEMPLATE_DIR seam', () => {
  it('STOP-line (Model A′): the researched rule is NOT baked into the shipped starter template', () => {
    // Never in the shipped set — else the yaml.load ban is a permanent rule for EVERY python consumer
    // (§Qe genuinely-researched-not-starter). It is delivered per-consumer via the assembled dir only.
    expect(existsSync(join(STARTER_TPL, '.getff', 'astgrep-rules', `${RULE_ID}.yml`))).toBe(false);
  });

  it('delivery joins the researched rule to the consumer’s single ruleDirs, alongside the starters', () => {
    const consumer = freshConsumer();
    expect(runDelivery(consumer, assembleSourceDir(true))).toBe(0);

    const rulesDir = join(consumer, '.getff', 'astgrep-rules');
    for (const id of [...STARTER_RULE_IDS, RULE_ID]) {
      expect(existsSync(join(rulesDir, `${id}.yml`))).toBe(true);
    }
    // The delivered researched rule is byte-identical to the INC-2 committed artifact (Model A′ static).
    expect(readFileSync(join(rulesDir, `${RULE_ID}.yml`), 'utf8')).toBe(
      readFileSync(RESEARCHED_RULE_SRC, 'utf8'),
    );
    // Additive: exactly ONE top-level ruleDirs: key listing the single .getff/astgrep-rules dir (a
    // second ruleDirs: key = ast-grep exit 8; the researched rule joins the existing dir, §Qd).
    const sg = readFileSync(join(consumer, 'sgconfig.yml'), 'utf8');
    expect(sg.match(/^ruleDirs:/gm)?.length).toBe(1);
    expect(sg).toMatch(/^\s*-\s+\.getff\/astgrep-rules\s*$/m);
  });

  it('a second delivery run is idempotent — the delivered config tree is byte-identical', () => {
    const consumer = freshConsumer();
    const src = assembleSourceDir(true);
    expect(runDelivery(consumer, src)).toBe(0);
    const fp1 = configFingerprint(consumer);
    expect(runDelivery(consumer, src)).toBe(0);
    const fp2 = configFingerprint(consumer);
    expect(fp2).toBe(fp1);
  });
});

// ── AC2: the flagship — the DELIVERED researched rule fires RED in a fresh consumer ───────────────

// The firing contract for the researched rule — reuses the EXISTING firing-runner harness (the pinned
// bare-PATH `ast-grep scan --json`, NOT the npx arm: an npx pin converts a registry flake into a
// loud-skip = CI-green-without-firing). expectedCode is the namespaced rule id ast-grep reports.
const CONTRACT: AstgrepFiringContract = {
  command: 'ast-grep scan --json',
  jsonPath: '$.ruleId',
  expectedCode: RULE_ID,
};

// Presence = the pinned ast-grep on PATH here? deriveToolVersion returns undefined when absent (CI
// install step missing / local machine without ast-grep). No `!isCI` — CI installs it and fires for real.
const resolvedVersion = deriveToolVersion(CONTRACT.command);
const toolPresent = resolvedVersion !== undefined;
const LIVE_TIMEOUT_MS = 120_000;

if (!toolPresent) {
  // Real module-level loud-skip (a console.warn inside a skipIf body never fires) — the delivered
  // researched rule must NOT be claimed green on live-fire from a run that never fired it (mirrors
  // firing.test.ts). The always-on AC1 delivery block still gates in CI.
  console.warn(
    '⚠ live ast-grep firing SKIPPED for the LG-S1 Inc3 scratch-consumer RED proof (ast-grep not on ' +
      'PATH — CI install step missing / local machine without the pinned binary); the delivered ' +
      'researched rule MUST NOT be claimed green on live-fire from this run alone. AC1 still gates.',
  );
}

/** Bare `ast-grep scan` (no --json) against the delivered consumer's own sgconfig + planted src.py —
 *  the literal numeric exit-code lane: exit 1 dirty / exit 0 clean. */
function bareScanStatus(consumer: string): number | null {
  return spawnSync(
    'ast-grep',
    ['scan', '-c', join(consumer, 'sgconfig.yml'), join(consumer, 'src.py')],
    { cwd: consumer, encoding: 'utf8' },
  ).status;
}

describe.skipIf(!toolPresent)('AC2 — flagship: the delivered researched rule FIRES RED in a fresh consumer', () => {
  it(
    'RED: planted yaml.load(raw) → ruleIds contains getff-researched-no-yaml-load (bare scan exit 1)',
    { timeout: LIVE_TIMEOUT_MS },
    () => {
      const consumer = freshConsumer();
      expect(runDelivery(consumer, assembleSourceDir(true))).toBe(0);
      // The planted violation lives ONLY in the OS temp consumer root (mkdtemp) — removed in afterEach.
      writeFileSync(join(consumer, 'src.py'), 'import yaml\n\ndata = yaml.load(raw)\n');

      const { codes } = fireContract(CONTRACT, consumer);
      expect(codes.has(RULE_ID)).toBe(true);
      // Literal exit-code lane: bare `ast-grep scan` exits 1 on the dirty tree.
      expect(bareScanStatus(consumer)).toBe(1);
    },
  );

  it(
    'CLEAN: planted yaml.safe_load(raw) → does NOT contain the rule id, ZERO findings (bare scan exit 0)',
    { timeout: LIVE_TIMEOUT_MS },
    () => {
      const consumer = freshConsumer();
      expect(runDelivery(consumer, assembleSourceDir(true))).toBe(0);
      writeFileSync(join(consumer, 'src.py'), 'import yaml\n\ndata = yaml.safe_load(raw)\n');

      const { codes } = fireContract(CONTRACT, consumer);
      expect(codes.has(RULE_ID)).toBe(false);
      expect(codes.size).toBe(0);
      expect(bareScanStatus(consumer)).toBe(0);
    },
  );
});

// ── AC2 non-vacuity (teeth): the RED is DELIVERY-gated, not ambient ───────────────────────────────

describe.skipIf(!toolPresent)('AC2 non-vacuity — the flagship RED is caused by the delivery of the researched rule', () => {
  it(
    'delivery WITHOUT the researched rule → the SAME yaml.load fixture does NOT report it (teeth)',
    { timeout: LIVE_TIMEOUT_MS },
    () => {
      // Starters-only source dir → the seam delivers the 4 starter rules but NOT the researched rule.
      const consumer = freshConsumer();
      expect(runDelivery(consumer, assembleSourceDir(false))).toBe(0);
      expect(existsSync(join(consumer, '.getff', 'astgrep-rules', `${RULE_ID}.yml`))).toBe(false);

      writeFileSync(join(consumer, 'src.py'), 'import yaml\n\ndata = yaml.load(raw)\n');
      const { codes } = fireContract(CONTRACT, consumer);
      // Not delivered → cannot fire. Proves the AC2 RED above is caused by the delivery, not ambient
      // (attention-is-not-a-mechanism / #discipline-theatre falsifier).
      expect(codes.has(RULE_ID)).toBe(false);
    },
  );
});
