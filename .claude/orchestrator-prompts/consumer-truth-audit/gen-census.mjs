#!/usr/bin/env node
// gen-census.mjs — assembles census-v0.json from the measured evidence (task 7;
// round-2 rework: the DELIVERED column is derived from the live consumer trees — never
// inferred, never factory-projected — and the generator doubles as its own verifier).
//
// Modes:
//   node gen-census.mjs             → generate: rebuild the census and write it to --out
//                                     (default: census-v0.json beside this script).
//   node gen-census.mjs --check     → verify: re-derive every row's `delivered` from the live
//                                     trees, compare against the committed census (--census),
//                                     print every disagreement, exit 1 if any, WRITE NOTHING.
//
// Roots — argv flag > env var > default (the container bench this census was generated on,
// recorded in logs/consumer-dirs-r2.txt):
//   --repo <dir>    | CENSUS_REPO    | framework worktree (framework-side populations via git ls-files)
//   --core <dir>    | CENSUS_CORE    | consumer tree installed with `--profile core`
//   --env <dir>     | CENSUS_ENV     | consumer tree installed with `--profile env`
//   --factory <dir> | CENSUS_FACTORY | consumer tree installed with `--profile factory`
// A missing root is a hard error (exit 2): re-run the three installs per report §method.
import { execSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const flag = (name) => { const i = argv.indexOf(name); return i >= 0 && argv[i + 1] ? argv[i + 1] : undefined; };
const CHECK = argv.includes('--check');
const OUT = flag('--out') || `${HERE}/census-v0.json`;
const CENSUS = flag('--census') || OUT;

const ROOTS = {
  repo: flag('--repo') || process.env.CENSUS_REPO || resolve(HERE, '../../..'),
  core: flag('--core') || process.env.CENSUS_CORE || '/tmp/census-consumer-core-r2-lacg1W',
  env: flag('--env') || process.env.CENSUS_ENV || '/tmp/census-consumer-env-r2-y3F4uO',
  factory: flag('--factory') || process.env.CENSUS_FACTORY || '/tmp/census-consumer-factory-r2-TZpjMT',
};
const isDir = (p) => { try { return statSync(p).isDirectory(); } catch { return false; } };
const isFile = (p) => { try { return statSync(p).isFile(); } catch { return false; } };
const missing = Object.entries(ROOTS).filter(([, p]) => !isDir(p));
if (missing.length) {
  console.error(`gen-census: root(s) missing: ${missing.map(([k, p]) => `${k}=${p}`).join('  ')}`);
  console.error('  re-run the three installs (report §method) or pass --repo/--core/--env/--factory (or CENSUS_* env).');
  process.exit(2);
}
const { repo: REPO, core: CORE, env: ENV, factory: FACT } = ROOTS;

const sh = (c) => execSync(c, { encoding: 'utf8' }).split('\n').filter(Boolean);
// tree predicates — the only source of every `delivered` cell
const treeHas = (root, rel) => isFile(`${root}/${rel}`) || isDir(`${root}/${rel}`);
const dirPopulated = (root, rel) => isDir(`${root}/${rel}`) && readdirSync(`${root}/${rel}`, { recursive: true }).length > 0;
// companion-class probe: in-tree artefact named exactly for the companion, EXCLUDING
// .claude/vendor/ — the vendored runtime-bridge subset is the 55-runtime-bridge-vendor
// layer and is censused by its own hook row; counting it here would double-census it.
const COMPANION_EXCLUDE = '.claude/vendor/';
const anyBasename = (root, name) => {
  try {
    return readdirSync(root, { recursive: true })
      .some((p) => !p.startsWith(COMPANION_EXCLUDE) && p.split('/').pop() === name);
  } catch { return false; }
};
const perProfile = (fn) => ({ core: fn(CORE), env: fn(ENV), factory: fn(FACT) });

const AGED = 'n/a — host-scoped (see host-verify-aged.sh)';
const rows = [];
const add = (r) => rows.push(r);

// ── tracked framework-side populations (HAS column) ─────────────────────────
const trackedSkills = sh(`cd ${REPO} && git ls-files '.claude/skills/**' | cut -d/ -f3 | sort -u`); // 16
const rootGetff = 'skills/getff'; // tracked at repo root, shipped by 10-skills as .claude/skills/getff
const trackedAgents = sh(`cd ${REPO} && git ls-files 'agents/*.md' | sort`).map(p => p.replace('agents/', ''));
const trackedRules = sh(`cd ${REPO} && git ls-files '.claude/rules/*.md' | sort`).map(p => p.replace('.claude/rules/', ''));
const trackedHooks = sh(`cd ${REPO} && git ls-files '.claude/hooks/*' | sort`).map(p => p.replace('.claude/hooks/', ''));
const prodChecks = sh(`cd ${REPO} && ls packages/core/hooks/checks/*.ts | grep -v '.test.ts' | xargs -n1 basename | sort`);
const testChecks = sh(`cd ${REPO} && ls packages/core/hooks/checks/*.test.ts | xargs -n1 basename | sort`);
const principles = sh(`cd ${REPO} && ls packages/core/principles/*.test.ts | xargs -n1 basename | sort`);
const scriptsAll = sh(`cd ${REPO} && find scripts -type f | sort`);

const deliveredSkills = { core: sh(`ls -d ${CORE}/.claude/skills/*/ 2>/dev/null | xargs -n1 basename | sort`),
                          env:  sh(`ls -d ${ENV}/.claude/skills/*/ 2>/dev/null | xargs -n1 basename | sort`),
                          factory: sh(`ls -d ${FACT}/.claude/skills/*/ 2>/dev/null | xargs -n1 basename | sort`) };
const deliveredAgents = { core: sh(`ls ${CORE}/.claude/agents/*.md 2>/dev/null | xargs -n1 basename | sort`),
                          env:  sh(`ls ${ENV}/.claude/agents/*.md 2>/dev/null | xargs -n1 basename | sort`),
                          factory: sh(`ls ${FACT}/.claude/agents/*.md 2>/dev/null | xargs -n1 basename | sort`) };
const deliveredHooks = { core: sh(`cd ${CORE} && find .claude/hooks -type f 2>/dev/null | sed 's|.claude/hooks/||' | sort`),
                         env:  sh(`cd ${ENV} && find .claude/hooks -type f 2>/dev/null | sed 's|.claude/hooks/||' | sort`),
                         factory: sh(`cd ${FACT} && find .claude/hooks -type f 2>/dev/null | sed 's|.claude/hooks/||' | sort`) };
// consumer scripts/ lists WITHOUT the scripts/ prefix, matching the artefact needles below
const deliveredScripts = { core: sh(`cd ${CORE} && find scripts -type f 2>/dev/null | sort`).map(s => s.replace(/^scripts\//, '')),
                           env:  sh(`cd ${ENV} && find scripts -type f 2>/dev/null | sort`).map(s => s.replace(/^scripts\//, '')),
                           factory: sh(`cd ${FACT} && find scripts -type f 2>/dev/null | sort`).map(s => s.replace(/^scripts\//, '')) };
const dl = (list, name) => ({ core: list.core.includes(name), env: list.env.includes(name), factory: list.factory.includes(name) });

// ── C1 skills (17 rows) ─────────────────────────────────────────────────────
for (const s of trackedSkills) {
  const d = dl(deliveredSkills, s);
  if (s === 'self-reflection') {
    add({ artefact: `.claude/skills/${s}/`, class: 'skill', has: true, delivered: d,
      works: 'n/a — not delivered', aged_install: AGED, verdict: 'BY-DESIGN',
      by_design_citation: 'setup.d/10-skills.sh:121 («Only self-reflection is intentionally NOT shipped at all: it is the §1.7 self-review discipline»); also install.sh:26',
      evidence: 'git ls-files → tracked; M4 tree list: absent from all 3 consumer .claude/skills/ (logs/delivered-tree-measurement.md §M4)' });
  } else if (s === 'orchestrator') {
    add({ artefact: `.claude/skills/${s}/`, class: 'skill', has: true, delivered: d,
      works: `loads as docs, but 5 embedded host-absolute paths instruct operations against the AUTHOR'S machine: references/worker-template.md:73,82,107 + reviewer-template.md:37 + ai-laziness-traps-orchestrator.md:131 all say \`cd /Users/art/code/rules-as-tests-aif\` — on any consumer host this path is another project or absent`,
      aged_install: AGED, verdict: 'DOC-LIES',
      evidence: `grep -rn '/Users/art' ${FACT} → 5 hits, all inside .claude/skills/orchestrator/references/* (logs/works-checks.md §L1 finding precision)` });
  } else {
    add({ artefact: `.claude/skills/${s}/`, class: 'skill', has: true, delivered: d,
      works: 'works — delivered content resolves inside the consumer; cross-refs rewritten to upstream blob URLs at install (transform_internal_refs, setup.d/LAYERS.md:79)',
      aged_install: AGED, verdict: 'BY-DESIGN',
      by_design_citation: 'setup.d/LAYERS.md:10 + :23 (profile model gates: core=6, env +contour 5, factory +operator 5)',
      evidence: `M4 delivered list per profile (logs/delivered-tree-measurement.md §M4); install-${'{core,env,factory}'}.log ✓ lines match the trees` });
  }
}
add({ artefact: `${rootGetff}/`, class: 'skill', has: true,
  delivered: dl(deliveredSkills, 'getff'),
  works: 'works — delivered as .claude/skills/getff/ (root skills/ is the source)',
  aged_install: AGED, verdict: 'BY-DESIGN',
  by_design_citation: 'setup.d/LAYERS.md:23 (10-skills.sh: skills/ → .claude/skills/)',
  evidence: 'M4: getff present in all 3 consumer trees; source tracked at skills/getff' });

// ── C2 agents (20 rows) ─────────────────────────────────────────────────────
const agentExclusions = {
  'manual-rule-liveness-prober.md': '20-agents.sh:26 (authoring-only tool #552)',
  'shipped-agent-liveness-prober.md': '20-agents.sh:27 (authoring-only tool, M2 probe #552 sibling)',
  'backward-sweep-auditor.md': '20-agents.sh:28 (authoring-only, §1.7 cold-sweep T21)',
  'dual-channel-drift-auditor.md': '20-agents.sh:29 (authoring-only, dual-implementation §8 @dual-pair audit)',
  'adapter-jig-reviewer.md': '20-agents.sh:30 (authoring-only, adapter-jig J1 conformance review)',
  'dispatch-input-checker.md': '20-agents.sh:31 (authoring-only station, dispatch-input reality-check)',
  'getff-cold-run-prober.md': '20-agents.sh:32 (framework-only — run BY framework against consumer, spec §9.3)',
};
for (const a of trackedAgents) {
  // tree truth per profile — round 1 projected core's list onto all three profiles here (Bug A)
  const d = dl(deliveredAgents, a);
  if (agentExclusions[a]) {
    add({ artefact: `.claude/agents/${a}`, class: 'agent', has: true, delivered: d,
      works: 'n/a — not delivered', aged_install: AGED, verdict: 'BY-DESIGN',
      by_design_citation: agentExclusions[a],
      evidence: `M4: absent from all consumer .claude/agents/ lists; present in framework agents/ (git ls-files)` });
  } else if (d.factory && !d.core) {
    add({ artefact: `.claude/agents/${a}`, class: 'agent', has: true, delivered: d,
      works: 'works as a session-read agent prompt inside a factory-profile consumer (requires the aif-handoff runtime it presupposes)',
      aged_install: AGED, verdict: 'BY-DESIGN',
      by_design_citation: 'setup.d/20-agents.sh:36-42 (factory-only gate: «presuppose the aif-handoff operator runtime»)',
      evidence: 'M4: present in factory tree only; L2 hook-run harness N/A for agent prompts (session-read surface)' });
  } else {
    add({ artefact: `.claude/agents/${a}`, class: 'agent', has: true, delivered: d,
      works: 'works as a session-read prompt; memory-codification-auditor.md:37 ships a host-scoped default (~/.claude/projects/-Users-art-code-rules-as-tests-aif/memory/) that exists only on the author\'s machine — reported as a finding, default is override-able',
      aged_install: AGED, verdict: 'BY-DESIGN',
      by_design_citation: 'setup.d/LAYERS.md:25 (20-agents.sh ships §2 sub-agents to all profiles)',
      evidence: 'M4: present in core+env+factory trees (11 agents); grep hit at .claude/agents/memory-codification-auditor.md:37 (L1 precision section)' });
  }
}

// ── C3 discipline rules (30 rows) ───────────────────────────────────────────
const rulesDelivered = perProfile((root) => dirPopulated(root, '.claude/rules'));
for (const r of trackedRules) {
  add({ artefact: `.claude/rules/${r}`, class: 'discipline-rule', has: true,
    delivered: rulesDelivered,
    works: 'n/a — not delivered; consumer-side consequence: delivered hook inject-matching-rule.sh has NO corpus and announces «no rules corpus found … nothing to inject» (L2 flagship probe, works-checks.md §L2)',
    aged_install: AGED, verdict: 'BY-DESIGN',
    by_design_citation: 'setup.d/LAYERS.md:79 («rules/ is not shipped» — transform_internal_refs rewrites .claude/rules/ refs in delivered docs to upstream blob URLs); corroborated at setup.d/20-agents.sh:44',
    evidence: 'M1 (gate 6): test -d .claude/rules → ABSENT in core, env, factory; consumer session-bootstrap.md + AGENTS.md contain 0 .claude/rules refs (rewrite verified)' });
}

// ── C4 hooks (25 rows) ──────────────────────────────────────────────────────
const hookNotes = {
  'runtime-bridge-dispatch.sh': { v: 'BY-DESIGN', c: 'setup.d/LAYERS.md:31 (55-runtime-bridge-vendor — factory-only per spec A7)',
    w: 'inert until the consumer configures RUNTIME_BRIDGE_* and registers it (designed early exits; hook-emit helper INLINED, .claude/hooks/runtime-bridge-dispatch.sh:53 — the undelivered lib/ twin is a comment reference, not a source)' },
};
for (const h of trackedHooks) {
  const d = dl(deliveredHooks, h);
  if (d.core || d.factory) {
    const note = hookNotes[h];
    add({ artefact: `.claude/hooks/${h}`, class: 'hook', has: true, delivered: d,
      works: note ? note.w : 'works — L2 harness: exit=0 with representative CC payload in all delivering profiles (works-checks.md §L2/§L2b)',
      aged_install: AGED, verdict: note ? note.v : 'BY-DESIGN',
      by_design_citation: note ? note.c : 'setup.d/LAYERS.md:10 (profile model) + :23 (10-skills §1b consumer hook set)',
      evidence: 'L2/§L2b: 11 hooks exit=0 core+env+factory with representative payloads; settings.json registers 7 hooks identically in all profiles (M7)' });
  } else {
    add({ artefact: `.claude/hooks/${h}`, class: 'hook', has: true, delivered: d,
      works: 'n/a — not delivered', aged_install: AGED, verdict: 'BY-DESIGN',
      by_design_citation: 'setup.d/LAYERS.md:10 (operator machinery is the factory\'s own payload, not consumer cargo)',
      evidence: 'M4: absent from consumer .claude/hooks/ trees; present in framework tree (git ls-files)' });
  }
}

// ── C5 checks (25 rows) ─────────────────────────────────────────────────────
const checkFacts = {
  'guard-liveness.ts': { v: 'BROKEN',
    w: 'cannot LOAD in any consumer: static import of @rules-as-tests/preset-next-15-canonical/eslint-rules (line 34) → ERR_MODULE_NOT_FOUND proven live with everything else installed; pre-push.ts:522-527 then calls die() → PUSH BLOCKED, with remediation («run npm install at the repo root») that cannot work in a consumer',
    e: 'L2d: node --import tsx/esm -e import(...preset...) → ERR_MODULE_NOT_FOUND; factory control (workspace symlink) → LOADED OK; full-module import fails identically (works-checks.md §L2d)' },
  'prior-art.ts': { v: 'BY-DESIGN', c: 'setup.d/LAYERS.md:10 + :27 (40-configs ships the §4 consumer gate set)',
    w: 'works on commit data (trailer grammar + ≥20-char skip hatch); SSOT-referent citations resolve against the consumer\'s OWN tree — absent SSOT → empty id-set (self-consistent rejection; live consumer push behavior INCONCLUSIVE-needs-live-push)',
    e: 'M6 import closure: no local data deps beyond delivered utils; pre-push.ts:43 imports it; L2d run reached section selection with no crash from this module' },
  's17.ts': { v: 'BY-DESIGN', c: 'setup.d/LAYERS.md:10 + :27',
    w: 'loads; operates on changed kickoffs (consumers have none) → degrades to no-op honestly',
    e: 'M4: delivered in all 3 trees; L2d full-hook run: no s17 error; consumer trees carry no .claude/orchestrator-prompts (no-op input set)' },
  'unpinned-tool-install.ts': { v: 'BY-DESIGN', c: 'setup.d/LAYERS.md:10 + :27',
    w: 'works on commit package.json diffs — consumer-relevant, no local data deps',
    e: 'M6: imports only node:fs/path + ./utils/git.ts + ../utils/run-check.ts (all delivered); operates on the push diff' },
  'cmd-script-liveness.ts': { v: 'BY-DESIGN', c: 'setup.d/LAYERS.md:10 + :27',
    w: 'loads; reads packages/core/manifest/rules-manifest.json (:57, NOT delivered) → empty changed-rule set → honest no-op for consumers',
    e: 'grep MANIFEST delivered copy → :57 const MANIFEST_REL = ...; consumer find packages/core/manifest → absent (M4 inventory: 15 files under consumer packages/)' },
};
for (const c of prodChecks) {
  // delivered = that exact file exists in that profile's tree (round 1 read the factory's list only)
  const delivered = perProfile((root) => isFile(`${root}/packages/core/hooks/checks/${c}`));
  const f = checkFacts[c];
  if (f) {
    add({ artefact: `packages/core/hooks/checks/${c}`, class: 'hook-check', has: true,
      delivered, works: f.w, aged_install: AGED, verdict: f.v,
      ...(f.c ? { by_design_citation: f.c } : {}),
      evidence: f.e });
  } else {
    add({ artefact: `packages/core/hooks/checks/${c}`, class: 'hook-check', has: true,
      delivered,
      works: 'n/a — not delivered', aged_install: AGED, verdict: 'BY-DESIGN',
      by_design_citation: 'setup.d/LAYERS.md:10 (factory CI gates: pr-body-*, registry, skill-core-edit-scope, guard-liveness-fullsweep are the framework\'s own enforcement)',
      evidence: 'M4/M6: consumer packages/core/hooks/ carries exactly 5 checks + pre-push + utils (10 files)' });
  }
}
for (const c of testChecks) {
  add({ artefact: `packages/core/hooks/checks/${c}`, class: 'hook-check-test', has: true,
    delivered: perProfile((root) => isFile(`${root}/packages/core/hooks/checks/${c}`)),
    works: 'n/a — not delivered', aged_install: AGED, verdict: 'BY-DESIGN',
    by_design_citation: 'setup.d/LAYERS.md:10 (test material is factory CI; the installer ships named production files only)',
    evidence: 'M4: zero .test.ts under consumer packages/core/hooks/' });
}

// ── C6 principles (47 rows) ─────────────────────────────────────────────────
const principlesDelivered = perProfile((root) => dirPopulated(root, 'packages/core/principles'));
for (const p of principles) {
  add({ artefact: `packages/core/principles/${p}`, class: 'principle', has: true,
    delivered: principlesDelivered,
    works: 'n/a — not delivered', aged_install: AGED, verdict: 'BY-DESIGN',
    by_design_citation: 'setup.d/LAYERS.md:10 (meta-tests are the factory\'s recursive-self-application CI; kickoff §2 defines no consumer landing site for the class — «—»)',
    evidence: 'M4 probe: find <consumer> -name "*principle*" → 0 hits in all 3 trees' });
}

// ── C7 templates (6 rows: template dirs derived from the tree + root ts-server) ──
// Population is READ from the repo tree; an annotation without a dir, or a dir without an
// annotation, is a hard error — a phantom row (round-1 `ts-server-configs`) cannot recurse.
const templateDirFacts = {
  shared: { probe: (root) => dirPopulated(root, '.ai-factory'),
    works: '11-13 .ai-factory files per tree (M7)',
    cite: 'setup.d/LAYERS.md:27 (40-configs §5a shared templates)' },
  cargo: { probe: (root) => treeHas(root, 'clippy.toml') || treeHas(root, 'deny.toml'),
    works: 'not delivered on the npm flow (ts-server fixture): GETFF_TOOLCHAIN=cargo lane only — INERT by design',
    cite: 'setup.d/LAYERS.md:29 (46-cargo.sh «INERT on the npm flow»)' },
  go: { probe: (root) => treeHas(root, '.golangci.yml'),
    works: 'not delivered on the npm flow: GETFF_TOOLCHAIN=go lane only',
    cite: 'setup.d/LAYERS.md:29 (47-go.sh analog)' },
  python: { probe: (root) => treeHas(root, 'ruff.toml') || isDir(`${root}/.getff`),
    works: 'not delivered on the npm flow: GETFF_TOOLCHAIN=python lane only',
    cite: 'setup.d/LAYERS.md:28 (45-python.sh «INERT on the npm flow»)' },
  'react-next': { probe: (root) => isDir(`${root}/.storybook`),
    works: 'not delivered to the ts-server fixture (stack-gated; delivered on react-next stacks — outside this census\'s fixture stack)',
    cite: 'setup.d/LAYERS.md:10 (stack-aware gating)' },
};
const templateDirs = sh(`ls -d ${REPO}/packages/core/templates/*/ 2>/dev/null | xargs -n1 basename | sort`);
for (const d of templateDirs) {
  if (!templateDirFacts[d]) throw new Error(`packages/core/templates/${d}/ has no census annotation — add a templateDirFacts entry (phantom rows are forbidden; round-1 MAJOR 2)`);
}
for (const d of Object.keys(templateDirFacts)) {
  if (!templateDirs.includes(d)) throw new Error(`templateDirFacts annotates packages/core/templates/${d}/ which the repo tree does not carry`);
}
const templateEvidence = 'M2/M7 consumer inventories + install logs; spec-path correction: the kickoff\'s «packages/core/templates/**/workflows» matches nothing (population-enumeration.md §C10b)';
for (const d of templateDirs) {
  const f = templateDirFacts[d];
  add({ artefact: `packages/core/templates/${d}/`, class: 'template', has: true,
    delivered: perProfile(f.probe), works: f.works, aged_install: AGED,
    verdict: 'BY-DESIGN', by_design_citation: f.cite, evidence: templateEvidence });
}
if (!isDir(`${REPO}/templates/ts-server`)) throw new Error('root templates/ts-server/ missing from the repo tree');
add({ artefact: 'templates/ts-server/', class: 'template', has: true,
  delivered: perProfile((root) => treeHas(root, 'tsconfig.json') && treeHas(root, '.github/workflows/ci.yml')),
  works: 'github-actions-ci.yml + github-actions-workflow-integrity.yml delivered as .github/workflows/ci.yml + workflow-integrity.yml; stack configs at root',
  aged_install: AGED, verdict: 'BY-DESIGN',
  by_design_citation: 'setup.d/40-configs.sh:448,454 (deliver_getff_workflow from templates/ts-server/)',
  evidence: templateEvidence });

// ── C8 lint bundles (8 rows) ────────────────────────────────────────────────
const lintRows = [
  ['packages/core/eslint-rules/ (4 rules + index)', (root) => dirPopulated(root, 'packages/core/eslint-rules'),
    'works — delivered as packages/core/eslint-rules/ (5 files) AND bundled into consumer eslint-rules-local/ (13 files, generated barrel «4 rules» per install log)', 'setup.d/LAYERS.md:27 (§5b\' ESLint rules)', 'M4/M7: present in all 3 trees'],
  ['packages/core/templates/python/.getff/astgrep-rules/ (4 yml)', (root) => isDir(`${root}/.getff`),
    'python lane only', 'setup.d/LAYERS.md:28', 'C8b: no .getff at repo root — spec path corrected'],
  ['packages/core/templates/cargo/clippy.toml', (root) => treeHas(root, 'clippy.toml'),
    'cargo lane only', 'setup.d/LAYERS.md:29', 'C8'],
  ['packages/core/templates/cargo/deny.toml', (root) => treeHas(root, 'deny.toml'),
    'cargo lane only', 'setup.d/LAYERS.md:29', 'C7 tree'],
  ['packages/core/templates/go/.golangci.yml', (root) => treeHas(root, '.golangci.yml'),
    'go lane only', 'setup.d/LAYERS.md:29', 'C8'],
  ['packages/core/templates/python/ruff.toml', (root) => treeHas(root, 'ruff.toml'),
    'python lane only', 'setup.d/LAYERS.md:28', 'C7 tree'],
  ['templates/ts-server/eslint.config.mjs (synth-wire baseline)', (root) => treeHas(root, 'eslint.config.mjs'),
    'delivered; synth-wire emitted no rules for ts-server preset baseline (install log), live-research augmentation path documented in log', 'setup.d/LAYERS.md:27', 'install-core.log [synth-wire] lines'],
  ['eslint-rules-local/ (consumer barrel)', (root) => dirPopulated(root, 'eslint-rules-local'),
    'works — 13 files (4 rules × ts/mjs/d.ts + index.mjs) delivered; RULES the consumer code', 'setup.d/LAYERS.md:27', 'M2: eslint-rules-local = 13 files all profiles (install log: «Custom ESLint rules → eslint-rules-local/» — consumer ROOT, not packages/core/)'],
];
for (const [t, probe, w, c, e] of lintRows) {
  add({ artefact: t, class: 'lint-bundle', has: true, delivered: perProfile(probe), works: w, aged_install: AGED,
    verdict: 'BY-DESIGN', by_design_citation: c, evidence: e });
}

// ── C9 MCP (1 row) ──────────────────────────────────────────────────────────
add({ artefact: '.mcp.json (context7 wiring via setup.d/05-mcp.sh)', class: 'mcp-config', has: true,
  delivered: perProfile((root) => treeHas(root, '.mcp.json')),
  works: 'n/a — not delivered on ANY --profile path: the layer self-gates on FULL (deps-consent flag), an axis orthogonal to profile depth — a factory-profile consumer gets zero MCP wiring unless --full is also passed (recorded as an observation for triage)',
  aged_install: AGED, verdict: 'BY-DESIGN',
  by_design_citation: 'setup.d/05-mcp.sh:5 («Gated on FULL … so the non-full / snapshot path»…) + :13 (if [ -z "${FULL:-}" ])',
  evidence: 'M5: .mcp.json ABSENT in all 3 consumer trees; grep -n "05-mcp" install-core.log → 0 lines (layer never ran)' });

// ── C9b companions (6 rows for ts-server) ───────────────────────────────────
const companions = ['superpowers', 'runtime-bridge', 'deepwiki', 'ast-grep-cli', 'ast-grep', 'aif-handoff'];
for (const c of companions) {
  add({ artefact: `companions.manifest row: ${c}`, class: 'companion', has: true,
    delivered: perProfile((root) => anyBasename(root, c)),
    works: 'n/a — not delivered by install.sh: the installer only PRINTS stack-aware selection («6 companion(s) selected»); actual installs are consent-gated in the interactive setup wrapper (cc-plugin/cli) or runtime-routed (external-service) — zero companion artefacts landed in any profile',
    aged_install: AGED, verdict: 'BY-DESIGN',
    by_design_citation: 'setup.d/companions.manifest:5-14 (kind routing: consent + detect-first) + setup.d/15-companions-stack.sh:58-65 (selection display only)',
    evidence: 'M5: no companion/mcp files anywhere in consumer trees; install log companion section = 6 print lines only; the factory-only .claude/vendor/runtime-bridge subset is the 55-runtime-bridge-vendor layer, censused as its own hook row (.claude/hooks/runtime-bridge-dispatch.sh) — not a companions.manifest install' });
}

// ── C10 CI workflows (5 rows) ───────────────────────────────────────────────
const ciRows = [
  ['.github/workflows/ci.yml', (root) => treeHas(root, '.github/workflows/ci.yml'),
    'delivered (ts-server); uses «main» default-branch fallback (no origin — warning printed at install)', 'setup.d/40-configs.sh:448'],
  ['.github/workflows/workflow-integrity.yml', (root) => treeHas(root, '.github/workflows/workflow-integrity.yml'),
    'delivered', 'setup.d/40-configs.sh:454'],
  ['.github/workflows/getff-cargo.yml (lane)', (root) => treeHas(root, '.github/workflows/getff-cargo.yml'),
    'cargo lane only', 'setup.d/46-cargo.sh:162'],
  ['.github/workflows getff-go (lane)', (root) => treeHas(root, '.github/workflows/getff-go.yml'),
    'go lane only', 'setup.d/47-go.sh:4'],
  ['.github/workflows getff-python (lane)', (root) => treeHas(root, '.github/workflows/getff-python.yml'),
    'python lane only', 'setup.d/45-python.sh (github-actions-ci.yml template)'],
];
for (const [t, probe, w, c] of ciRows) {
  add({ artefact: t, class: 'ci-workflow', has: true, delivered: perProfile(probe), works: w, aged_install: AGED,
    verdict: 'BY-DESIGN', by_design_citation: c,
    evidence: 'M7: exactly 2 workflow files in each consumer .github/workflows/; the framework repo\'s own 13 workflows are factory-side (population-enumeration §C10)' });
}

// ── C11 scripts (82 rows: 62 tracked repo scripts/ + 20 installer-delivered consumer
//      scripts sourced from packages/core/{audit-self,probes,synthesizer}) ────────────────
const scriptWorks = {
  'audit-ai-docs.sh': 'works — documented acceptance cmd: 5 PASS / 0 FAIL / 1 WARN severed (L2c); 4/0/2 under L3 severance',
  'check-rule-globs.sh': 'exit=1 on the fresh consumer layout (boundary globs match ZERO files) → pre-push BLOCKS the first push; installer deliberately arms this alarm (R2 auto-wire note in install log; setup.d/40-configs.sh:19 «silent-inertness alarm»)',
  'check-arch-boundaries.sh': 'works — honest skip: «not an apps/+packages/ monorepo»',
  'check-fences-fire.sh': 'exit=1 VACUOUS without node_modules (fail-loud, by design); load-probe OK with deps installed (factory-consumer control)',
  'check-shields-up.sh': 'works — PASS=3 FAIL=0',
  'check-lintstaged-resolves.sh': 'honest skip without node_modules; with probe-deps installed: exit=1 lint-staged unresolvable (it is in the documented install line, not the probe set)',
  'detect-r2-boundary.sh': 'works — «ambiguous» (expected on the fixture)',
  'ci-available-probe.sh': 'exit=3 CANNOT-RUN: no origin remote (honest — fixture has no remote)',
  'run-rule-tests-firing.sh': 'works — no-op: no .ai-factory/rule-tests/ sidecar (nothing to fire)',
  'run-generated-rule-mutation.sh': 'exit=2: .ai-factory/synthesizer-output manifest absent (honest error; created only by the synth pipeline)',
  'audit-r4.ts': 'needs ts-morph (documented install line) — probe error captured; R-2 deps-presence',
  'pre-merge-local.sh': 'usage exit=64 without base-ref/origin (honest)',
  'create-worktree.sh': 'delivered env+factory (worktree helpers, 85-worktree-scripts.sh:87-92)',
  'worktree-node-modules.sh': 'delivered env+factory',
  'link-coordination.sh': 'delivered env+factory; CANON default $HOME/.claude-coordination/rules-as-tests-aif (:74) — consumer-scoped, not a factory escape',
  'getff-work.sh': 'delivered env+factory',
  'run-local-ci-sweep.sh': 'delivered factory only',
};
const shippedScriptCite = 'setup.d/LAYERS.md:27 (40-configs §4 enforcement scripts) + :10';
const scriptSourceCite = 'setup.d/LAYERS.md:27 (40-configs §4 enforcement scripts, sources packages/core/audit-self + probes + synthesizer) + :10';
// Population (a): the kickoff §2 source — repo scripts/ (62 tracked).
// Population (b): the installer's DOMINANT consumer-script source, which round 1 never
// enumerated — 20 delivered files with no row at all (review round-2 BLOCKER). The list
// mirrors the setup.d copy_safe deliveries into scripts/ (40-configs.sh:14-54: audit-self
// checkers + probes/audit-r4.ts + synthesizer runners + the fences-fire fixtures dir renamed
// to scripts/fences-fire-fixtures); every member is existence-asserted against the repo tree
// so installer drift fails loudly instead of silently de-populating the class.
const fenceFixturesDir = 'packages/core/audit-self/fixtures/fences-fire';
const consumerScriptSources = [
  'packages/core/audit-self/audit-ai-docs.sh',
  'packages/core/audit-self/check-arch-boundaries.sh',
  'packages/core/audit-self/check-fences-fire.sh',
  'packages/core/audit-self/check-lintstaged-resolves.sh',
  'packages/core/audit-self/check-rule-enforced.sh',
  'packages/core/audit-self/check-rule-globs.sh',
  'packages/core/audit-self/check-shields-up.sh',
  'packages/core/audit-self/ci-available-probe.sh',
  'packages/core/audit-self/detect-r2-boundary.sh',
  'packages/core/audit-self/pre-merge-local.sh',
  'packages/core/audit-self/r2-na-marker.sh',
  'packages/core/probes/audit-r4.ts',
  'packages/core/synthesizer/run-generated-rule-mutation.sh',
  'packages/core/synthesizer/run-rule-tests-firing.sh',
  ...sh(`ls ${REPO}/${fenceFixturesDir} | sort`).map(f => `${fenceFixturesDir}/${f}`),
];
const landing = (src) => src.startsWith(fenceFixturesDir)
  ? `fences-fire-fixtures/${src.split('/').pop()}` // 40-configs.sh:54 renames the dir on delivery
  : src.split('/').pop();
for (const src of consumerScriptSources) {
  if (!isFile(`${REPO}/${src}`)) throw new Error(`consumer-script source ${src} missing from the repo tree — setup.d delivery drifted; update the C11 population`);
}
const scriptPopulation = [
  ...scriptsAll.map((s) => ({ artefact: s, name: s.replace(/^scripts\//, ''), cite: shippedScriptCite })),
  ...consumerScriptSources.map((src) => ({ artefact: `scripts/${landing(src)}`, name: landing(src), cite: scriptSourceCite })),
];
// round-1 Bug B lived here: the needles were stripped while the delivered lists kept the
// scripts/ prefix → no lookup ever matched. Both sides are prefix-free below.
for (const { artefact, name, cite } of scriptPopulation) {
  const d = dl(deliveredScripts, name);
  if (d.core || d.env || d.factory) {
    add({ artefact, class: 'script', has: true, delivered: d,
      works: scriptWorks[name] || 'delivered; not individually exercised in V0 (same layer as the 12 exercised scripts — L2e)',
      aged_install: AGED, verdict: 'BY-DESIGN',
      by_design_citation: scriptWorks[name] ? cite : 'setup.d/LAYERS.md:27 + :10',
      evidence: 'M7 delivered lists + L2e execution matrix (12 scripts × 2 profiles with exit codes + last line)' });
  } else {
    add({ artefact, class: 'script', has: true, delivered: d,
      works: 'n/a — not delivered', aged_install: AGED, verdict: 'BY-DESIGN',
      by_design_citation: 'setup.d/LAYERS.md:10 (factory-internal measurement/triage/CI plumbing is not consumer cargo)',
      evidence: 'M7: absent from all 3 consumer scripts/ lists' });
  }
}

// ── meta ────────────────────────────────────────────────────────────────────
// one row per artefact — a duplicate key would silently collapse in the --check maps
const artefacts = rows.map(r => r.artefact);
const dups = artefacts.filter((a, i) => artefacts.indexOf(a) !== i);
if (dups.length) throw new Error(`duplicate census artefact rows: ${[...new Set(dups)].join(', ')}`);
const counts = {};
for (const r of rows) counts[r.verdict] = (counts[r.verdict] || 0) + 1;
const census = {
  meta: {
    census: 'consumer-truth-audit V0',
    generated: '2026-09-08',
    round: '2 — regenerated from the re-run benches (logs/install-{core,env,factory}-r2.log, dirs in logs/consumer-dirs-r2.txt); round-1 `delivered` bugs fixed (agents dbool-object, scripts prefix mismatch), the phantom ts-server-configs row removed, and the script population widened to the installer’s real delivery sources (repo scripts/ + packages/core/{audit-self,probes,synthesizer})',
    method: '3 fresh installs (core/env/factory) into mktemp dirs seeded with package.json+git init; DELIVERED measured on consumer TREES (find), never on install-log claims (T-CTA-A); WORKS = L1 escape-grep + L2 in-consumer execution + L3 rename-sever window (factory path absent, results valid) + factory controls',
    verifier: 'node gen-census.mjs --check — re-derives every row\'s `delivered` from live trees (roots: --repo/--core/--env/--factory or CENSUS_* env, container defaults) and exits 1 on any disagreement with this file; writes nothing',
    logs_dir: '.claude/orchestrator-prompts/consumer-truth-audit/logs/',
    population_total: rows.length,
    verdict_counts: counts,
    aged_stratum: 'N/A in container — host-scoped; measured by host-verify-aged.sh on the maintainer host (see logs/aged-stratum.md); aged_install field is uniformly "n/a — host-scoped"',
    spec_corrections: [
      'CI workflow source is root templates/<stack>/, not packages/core/templates/**/workflows (matches nothing)',
      '.getff/astgrep-rules exists only under packages/core/templates/python/; clippy/golangci/ruff likewise under their template dirs',
      'naive .claude/skills count 41 includes 25 gitignored container-local aif-* skills; tracked population is 16',
      'hooks authoring count 29 unreproducible; tree truth is 25',
      'consumer scripts/ are sourced ~entirely from packages/core/{audit-self,probes,synthesizer} via 40-configs §4, not the kickoff-named repo scripts/ — v0r2 enumerates both (62 + 23 = 85 script rows, 3 fixtures stack-gated undelivered here; delivered sums 20/24/25 per M7)',
      'the consumer ESLint barrel lands at consumer-root eslint-rules-local/ (install log «Custom ESLint rules → eslint-rules-local/»), not packages/core/eslint-rules-local',
    ],
  },
  rows,
};

// ── modes ───────────────────────────────────────────────────────────────────
if (CHECK) {
  let committed;
  try {
    committed = JSON.parse(readFileSync(CENSUS, 'utf8'));
  } catch (e) {
    console.error(`gen-census --check: cannot read census ${CENSUS}: ${e.message}`);
    process.exit(2);
  }
  const sameDelivered = (a, b) => ['core', 'env', 'factory'].every((k) => Boolean(a?.[k]) === Boolean(b?.[k]));
  const j = (d) => JSON.stringify(d);
  const byArtefact = new Map(committed.rows.map((r) => [r.artefact, r]));
  const derived = new Map(rows.map((r) => [r.artefact, r]));
  const findings = [];
  for (const [art, r] of derived) {
    const c = byArtefact.get(art);
    if (!c) { findings.push(`MISSING-FROM-CENSUS: ${art} (class ${r.class}) is tree-derived but has no census row`); continue; }
    if (!sameDelivered(c.delivered, r.delivered)) {
      findings.push(`DELIVERED-MISMATCH: ${art}: census=${j(c.delivered)} trees=${j(r.delivered)}`);
    }
  }
  for (const [art, c] of byArtefact) {
    if (!derived.has(art)) findings.push(`NOT-DERIVABLE: ${art} (class ${c.class}) is a census row with no tree-derived counterpart — phantom or renamed population member`);
  }
  console.log(`gen-census --check: repo=${REPO}`);
  console.log(`gen-census --check: core=${CORE}`);
  console.log(`gen-census --check: env=${ENV}`);
  console.log(`gen-census --check: factory=${FACT}`);
  console.log(`gen-census --check: ${rows.length} tree-derived rows vs ${committed.rows.length} census rows in ${CENSUS}`);
  if (findings.length) {
    for (const f of findings) console.log(f);
    console.log(`CHECK FAILED: ${findings.length} finding(s) — census disagrees with the live trees (exit 1); nothing was written`);
    process.exit(1);
  }
  console.log(`CHECK OK: 0 delivered disagreements; artefact sets identical (${rows.length}/${committed.rows.length}); nothing was written`);
  process.exit(0);
}

writeFileSync(OUT, JSON.stringify(census, null, 2) + '\n');
console.log(`wrote ${OUT}`);
console.log('rows:', rows.length, JSON.stringify(counts));
