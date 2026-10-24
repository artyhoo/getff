/**
 * intent-first-result S1 Task 5 — EFFECT negatives at the real seams (kickoff §4 Task 2,
 * review-focus items 1/2/5, T-INTENT-B).
 *
 * The helper suite (packages/core/skills/intent-result-review.test.ts) pins the validator's
 * record semantics in isolation. THIS suite pins the wire: a failed scope/review validation
 * must produce ZERO effect at each continuation seam —
 *   no POST /tasks, no POST /fire, no unpause PUT, no manual packet, no dedup success,
 *   no plan-changing answer write — while unscoped work keeps today's behaviour exactly.
 *
 * T22 (single flipping production change per arm, named in the `it` title):
 *   CLI arms   → the scope check in cli/dispatch.ts (placed BEFORE checkDedup, NOT bypassed
 *                by --force) and claim()'s scoped autoMode:false branch.
 *   Backend    → the guard at the top of AifHandoffBackend.claim / release, ManualBackend.dispatch
 *                and AifFireBackend.dispatch converting helper failures to spec_invalid.
 *   Release    → release()'s persisted-description re-read (a bare task id does not erase scope;
 *                malformed declared scope never becomes ordinary scope; a stale review holds a
 *                paused claim paused).
 *   Answer     → pushAnswer's scoped-decision guard (plan-changing/restarting answers on a
 *                feature-scoped task require an authorized within-contract PlanReview).
 *   Start      → startReviewed's gated route (plan_ready + autoMode:false + authorized
 *                PlanReview + re-read revalidation, or NO start_implementation event).
 *
 * RED state at authoring: `../src/resultReview.js` and `cli/start-reviewed.js` do not exist
 * and no seam consults them — every guard arm below fails today, every unscoped control passes.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  spawnSync,
  spawn,
  type ChildProcess,
  type SpawnSyncReturns,
} from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  readdirSync,
  rmSync,
} from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { createServer } from 'node:http';
import { AifHandoffBackend } from '../src/AifHandoffBackend.js';
import { ManualBackend } from '../src/ManualBackend.js';
import { AifFireBackend } from '../src/AifFireBackend.js';
import {
  enforceAnswerScope,
  enforceKickoffAdmission,
  enforceScope,
  enforceTaskAdmission,
  recordTaskAdoption,
  recordLegacyTaskClaim,
  recordRecoveredLegacyTask,
  taskPreImageDigest,
  validateDeclaredScope,
} from '../src/resultReview.js';
import { BackendError } from '../src/backend.js';
import { pushAnswer } from '../src/cli/answer.js';
import { startReviewed } from '../src/cli/start-reviewed.js';
import { handleFromTaskId, releaseOwnerRoot } from '../src/cli/claim.js';
import { recoverLegacyTaskFromAif } from '../src/cli/recover-legacy-task.js';
import type { KickoffSpec } from '../src/types.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../..');
const CLI = resolve(HERE, '../src/cli/dispatch.ts');
const TSX = resolve(REPO_ROOT, 'node_modules/.bin/tsx');
const HELPER = resolve(
  REPO_ROOT,
  '.agents/procedures/intent/helpers/check-result-review.mjs',
);
const SLOW_SHELL_MS = 30_000;

const sha256 = (bytes: string): string =>
  createHash('sha256').update(bytes).digest('hex');

// The adapter module under test — loaded lazily so the UNSCOPED control arms stay runnable
// at RED: module-not-found on this import IS the RED state for the adapter/direct arms.
const loadResultReview = async (): Promise<{
  extractIntentScope: (content: string) => { kind: string };
  taskPreImageDigest: (
    task: unknown,
    opts?: { helperPath?: string },
  ) => Promise<string>;
}> =>
  import(pathToFileURL(resolve(HERE, '../src/resultReview.ts')).href) as never;

// ---------------------------------------------------------------------------
// Fixture tree — one disposable owner root; contract + brief + review files.
// ---------------------------------------------------------------------------
const ROOT = mkdtempSync(resolve(tmpdir(), 'intent-effects-fixture-'));
for (const dir of ['reviews', 'evidence', 'env'])
  mkdirSync(resolve(ROOT, dir), { recursive: true });

const briefDigest = (() => {
  const bytes = '# Pilot brief\n\nFeature: fx-pilot.\n';
  writeFileSync(resolve(ROOT, 'brief.md'), bytes, 'utf8');
  return sha256(bytes);
})();
const E = (rel: string, bytes: string): { path: string; sha256: string } => {
  writeFileSync(resolve(ROOT, rel), bytes, 'utf8');
  return { path: rel, sha256: sha256(bytes) };
};
const envRef = E('env/toolchain.md', '# Toolchain\nnode 22.\n');
const p1Ref = E(
  'evidence/p1.log',
  'forbidden read named; accessor replacement explained; corrected passes\n',
);

interface FxContract {
  version: number;
  featureId: string;
  resultId: string;
  mode: 'produce' | 'repair' | 'expand';
  brief: { path: string; sha256: string };
  shared: Array<{ path: string; sha256: string }>;
  essentialPromiseIds: string[];
  requiresReview?: { path: string; sha256: string };
  parentContract?: { path: string; sha256: string };
  producesOrRepairs?: string;
}

const produceContract: FxContract = {
  version: 1,
  featureId: 'fx-pilot',
  resultId: 'fx-result',
  mode: 'produce',
  brief: { path: 'brief.md', sha256: briefDigest },
  shared: [],
  essentialPromiseIds: ['P1'],
};

const contractBytes = `${JSON.stringify(produceContract, null, 2)}\n`;
writeFileSync(resolve(ROOT, 'contract.json'), contractBytes, 'utf8');
const contractDigest = sha256(contractBytes);
const contractRef = { path: 'contract.json', sha256: contractDigest };

const matchingReview = {
  version: 1,
  attemptId: 'a1',
  featureId: 'fx-pilot',
  resultId: 'fx-result',
  brief: { path: 'brief.md', sha256: briefDigest },
  producerContract: contractRef,
  observedRevision: 'rev-1',
  sourceInputs: [],
  environment: envRef,
  evidence: [p1Ref],
  promises: [
    {
      id: 'P1',
      comparison: 'supported',
      evidence: [p1Ref],
      explanation: 'observed on the installed check',
    },
  ],
  outcome: 'matches',
  limits: [],
};
const reviewBytes = `${JSON.stringify(matchingReview, null, 2)}\n`;
writeFileSync(resolve(ROOT, 'reviews/a1.json'), reviewBytes, 'utf8');
mkdirSync(resolve(ROOT, 'result-reviews/a1'), { recursive: true });
writeFileSync(
  resolve(ROOT, 'result-reviews/a1/result-review.json'),
  reviewBytes,
  'utf8',
);

describe('intent continuity — repair references the historical failed attempt', () => {
  it('allows scoped repair of a recorded mismatch without pretending it is a current match', () => {
    const failed = {
      ...matchingReview,
      outcome: 'mismatch',
      promises: [
        {
          id: 'P1',
          comparison: 'contradicted',
          evidence: [p1Ref],
          explanation: 'observed failure',
        },
      ],
    };
    const failedBytes = `${JSON.stringify(failed)}\n`;
    writeFileSync(resolve(ROOT, 'reviews/failed.json'), failedBytes, 'utf8');
    const repair: FxContract = {
      ...produceContract,
      mode: 'repair',
      producesOrRepairs: 'a1',
      requiresReview: {
        path: 'reviews/failed.json',
        sha256: sha256(failedBytes),
      },
    };
    expect(
      validateDeclaredScope(repair, { roots: [ROOT], helperPath: HELPER }),
    ).toEqual({ ok: true });
  });
});

describe('intent continuity — independently selected authority at an effect', () => {
  const spec = E('env/agreed-spec.md', '# Agreed specification\n');
  const adopted = {
    ...produceContract,
    featureId: 'adopted-demo',
    shared: [spec],
  };
  const selector = resolve(ROOT, 'selector-probe.mjs');
  writeFileSync(
    selector,
    `
const prd = process.env.TEST_CURRENT_PRD_SHA;
const spec = process.env.TEST_CURRENT_SPEC_SHA;
if (process.argv.includes('--classify-artifact')) {
  process.stdout.write(JSON.stringify({ok:true,classification:'unknown',sha256:process.env.TEST_KICKOFF_SHA})+'\\n');
} else if (process.argv.includes('--read')) {
  process.stdout.write(JSON.stringify({ok:true,currentPrd:{snapshotRef:{path:process.env.TEST_CURRENT_PRD_PATH || 'brief.md',sha256:prd}},currentSpec:{specRef:{path:process.env.TEST_CURRENT_SPEC_PATH || 'env/agreed-spec.md',sha256:spec}}})+'\\n');
} else {
  process.stdout.write(JSON.stringify({ok:true,prdSha256:prd,specSha256:spec,attemptId:'spec-attempt'})+'\\n');
}
`,
  );

  it('holds an unchanged adopted payload after current PRD supersession before effect', () => {
    vi.stubEnv('TEST_CURRENT_PRD_SHA', 'f'.repeat(64));
    vi.stubEnv('TEST_CURRENT_SPEC_SHA', spec.sha256);
    expect(() =>
      enforceScope(scopedText(adopted, 'adopted-prd'), 'test', {
        helperPath: HELPER,
        roots: [ROOT],
        decisionsHelperPath: selector,
      }),
    ).toThrow(/current PRD|brief/i);
  });

  it('holds an unchanged adopted payload after agreed spec supersession before effect', () => {
    vi.stubEnv('TEST_CURRENT_PRD_SHA', briefDigest);
    vi.stubEnv('TEST_CURRENT_SPEC_SHA', 'e'.repeat(64));
    expect(() =>
      enforceScope(scopedText(adopted, 'adopted-spec'), 'test', {
        helperPath: HELPER,
        roots: [ROOT],
        decisionsHelperPath: selector,
      }),
    ).toThrow(/current spec|shared/i);
  });

  it('accepts the same adopted payload while both current decisions match', () => {
    vi.stubEnv('TEST_CURRENT_PRD_SHA', briefDigest);
    vi.stubEnv('TEST_CURRENT_SPEC_SHA', spec.sha256);
    expect(
      enforceScope(scopedText(adopted, 'adopted-ok'), 'test', {
        helperPath: HELPER,
        roots: [ROOT],
        decisionsHelperPath: selector,
      }),
    ).toMatchObject({ kind: 'scoped' });
  });

  it('an adopted expansion needs a current observed revision and cannot reuse a stale match', () => {
    vi.stubEnv('TEST_CURRENT_PRD_SHA', briefDigest);
    vi.stubEnv('TEST_CURRENT_SPEC_SHA', spec.sha256);
    const expansion: FxContract = {
      ...adopted,
      featureId: 'fx-pilot',
      mode: 'expand',
      producesOrRepairs: 'a1',
      parentContract: contractRef,
      requiresReview: {
        path: 'result-reviews/a1/result-review.json',
        sha256: sha256(reviewBytes),
      },
    };
    // The selector probe selects the same PRD and spec for this fixture feature.
    expect(() =>
      enforceScope(scopedText(expansion, 'expand-no-revision'), 'test', {
        helperPath: HELPER,
        roots: [ROOT],
        decisionsHelperPath: selector,
      }),
    ).toThrow(/observed revision/i);
    expect(() =>
      enforceScope(scopedText(expansion, 'expand-stale'), 'test', {
        helperPath: HELPER,
        roots: [ROOT],
        decisionsHelperPath: selector,
        observedRevision: 'rev-2',
      }),
    ).toThrow(/stale_review/i);
    expect(
      enforceScope(scopedText(expansion, 'expand-current'), 'test', {
        helperPath: HELPER,
        roots: [ROOT],
        decisionsHelperPath: selector,
        observedRevision: 'rev-1',
      }),
    ).toMatchObject({ kind: 'scoped' });
    expect(() =>
      enforceScope(
        scopedText(
          {
            ...expansion,
            requiresReview: {
              path: 'reviews/a1.json',
              sha256: sha256(reviewBytes),
            },
          },
          'expand-unpublished',
        ),
        'test',
        {
          helperPath: HELPER,
          roots: [ROOT],
          decisionsHelperPath: selector,
          observedRevision: 'rev-1',
        },
      ),
    ).toThrow(/review_not_published/);
  });

  it('rejects a newly authored kickoff whose scope marker was removed before dispatch', () => {
    const admissionRoot = mkdtempSync(resolve(tmpdir(), 'intent-admission-'));
    const home = resolve(
      admissionRoot,
      '.claude/orchestrator-prompts/intent-continuity',
    );
    mkdirSync(home, { recursive: true });
    writeFileSync(resolve(home, 'current-decisions.json'), '{}');
    writeFileSync(resolve(home, 'legacy-freeze.json'), '{}');
    const path = resolve(admissionRoot, 'new-kickoff.md');
    const content = '# New kickoff with marker removed\n';
    writeFileSync(path, content);
    vi.stubEnv('TEST_KICKOFF_SHA', sha256(content));
    expect(() =>
      enforceKickoffAdmission({ filePath: path, content }, 'test', {
        repoRoot: admissionRoot,
        decisionsHelperPath: selector,
      }),
    ).toThrow(/adoption|scope/i);
  });

  it('uses the configured external orchestration home for admission and holds a missing selector', async () => {
    const admissionRoot = mkdtempSync(
      resolve(tmpdir(), 'intent-external-root-'),
    );
    const orchHome = mkdtempSync(resolve(tmpdir(), 'intent-external-home-'));
    const home = resolve(orchHome, 'intent-continuity');
    mkdirSync(home, { recursive: true });
    writeFileSync(resolve(home, 'current-decisions.json'), '{}');
    writeFileSync(resolve(home, 'legacy-freeze.json'), '{}');
    const filePath = resolve(admissionRoot, 'kickoff-new.md');
    const content = '# Newly adopted kickoff with marker removed\n';
    writeFileSync(filePath, content);
    vi.stubEnv('AIF_INTENT_REPO_ROOT', admissionRoot);
    vi.stubEnv('AIF_INTENT_ORCH_HOME', orchHome);
    vi.stubEnv('TEST_KICKOFF_SHA', sha256(content));

    expect(() =>
      enforceKickoffAdmission({ filePath, content }, 'test', {
        decisionsHelperPath: selector,
      }),
    ).toThrow(/adoption|scope/i);
    expect(() =>
      enforceTaskAdmission({ id: 'new-task', description: content }, 'test'),
    ).toThrow(/adoption|legacy/i);

    const calls: Call[] = [];
    mockTaskStore(calls, {
      id: 'new-task',
      paused: true,
      description: content,
    });
    await expect(
      new AifHandoffBackend({
        baseUrl: 'http://localhost:3009',
        projectId: 'proj-uuid',
      }).release(handleFromTaskId('new-task', admissionRoot)),
    ).rejects.toMatchObject({ code: 'spec_invalid' });
    expect(calls.some((call) => call.url.endsWith('/tasks/new-task'))).toBe(
      true,
    );

    // Removing the selector must not turn this configured owner into legacy mode.
    rmSync(resolve(home, 'current-decisions.json'));
    expect(() =>
      enforceKickoffAdmission({ filePath, content }, 'test'),
    ).toThrow(/selector is missing/i);
    expect(() =>
      enforceTaskAdmission({ id: 'new-task', description: content }, 'test'),
    ).toThrow(/selector is missing/i);
  });

  function crossRootAdmission() {
    const admissionRoot = mkdtempSync(resolve(tmpdir(), 'intent-roots-owner-'));
    const home = resolve(
      admissionRoot,
      '.claude/orchestrator-prompts/intent-continuity',
    );
    mkdirSync(home, { recursive: true });
    writeFileSync(
      resolve(home, 'current-decisions.json'),
      JSON.stringify({ repoIdentity: 'cross-root-owner' }),
    );
    writeFileSync(
      resolve(home, 'legacy-freeze.json'),
      JSON.stringify({ repoIdentity: 'cross-root-owner', artifacts: [] }),
    );
    const content = scopedText(
      {
        ...adopted,
        brief: { ...adopted.brief, path: resolve(ROOT, adopted.brief.path) },
        shared: adopted.shared.map((ref) => ({
          ...ref,
          path: resolve(ROOT, ref.path),
        })),
      },
      'configured-cross-root',
    );
    const filePath = resolve(admissionRoot, 'kickoff-new.md');
    writeFileSync(filePath, content);
    vi.stubEnv('AIF_INTENT_REPO_ROOT', admissionRoot);
    vi.stubEnv(
      'RUNTIME_BRIDGE_INTENT_ROOTS',
      [admissionRoot, ROOT].join(process.platform === 'win32' ? ';' : ':'),
    );
    vi.stubEnv('RUNTIME_BRIDGE_INTENT_HELPER', HELPER);
    vi.stubEnv('RUNTIME_BRIDGE_INTENT_DECISIONS_HELPER', selector);
    vi.stubEnv('TEST_KICKOFF_SHA', sha256(content));
    vi.stubEnv('TEST_CURRENT_PRD_SHA', briefDigest);
    vi.stubEnv('TEST_CURRENT_SPEC_SHA', spec.sha256);
    vi.stubEnv('TEST_CURRENT_PRD_PATH', resolve(ROOT, adopted.brief.path));
    vi.stubEnv('TEST_CURRENT_SPEC_PATH', resolve(ROOT, spec.path));
    return { admissionRoot, content, filePath };
  }

  it('admission preserves configured cross-root authority but explicit roots stay authoritative', () => {
    const { admissionRoot, content, filePath } = crossRootAdmission();
    expect(() =>
      enforceKickoffAdmission({ filePath, content }, 'test'),
    ).not.toThrow();
    expect(() =>
      enforceKickoffAdmission({ filePath, content }, 'test', {
        roots: [admissionRoot],
      }),
    ).toThrow();
    vi.stubEnv('RUNTIME_BRIDGE_INTENT_ROOTS', admissionRoot);
    expect(() =>
      enforceKickoffAdmission({ filePath, content }, 'test', {
        roots: [admissionRoot, ROOT],
      }),
    ).not.toThrow();
  });

  it('admission never widens a configured root or an explicitly empty root list', () => {
    const { admissionRoot, content, filePath } = crossRootAdmission();
    vi.stubEnv('RUNTIME_BRIDGE_INTENT_ROOTS', admissionRoot);
    expect(() =>
      enforceKickoffAdmission({ filePath, content }, 'test'),
    ).toThrow();
    vi.stubEnv('RUNTIME_BRIDGE_INTENT_ROOTS', '');
    expect(() =>
      enforceKickoffAdmission({ filePath, content }, 'test'),
    ).toThrow(/ROOTS is not configured/);
    expect(() =>
      enforceKickoffAdmission({ filePath, content }, 'test', { roots: [] }),
    ).toThrow(/ROOTS is not configured/);
  });

  it('claim and release preserve configured external roots, while revoking one holds before unpause', async () => {
    const { admissionRoot, content, filePath } = crossRootAdmission();
    const calls: Call[] = [];
    mockTaskStore(calls, {
      id: 'task-42',
      status: 'backlog',
      paused: true,
      description: content,
    });
    const backend = new AifHandoffBackend({
      baseUrl: 'http://localhost:3009',
      projectId: 'proj-uuid',
    });
    const handle = await backend.claim({
      filePath,
      content,
      umbrellaName: 'adopted-demo',
      contentHash: sha256(content),
    });
    expect(handle.intentRepoRoot).toBe(admissionRoot);
    calls.length = 0;
    await backend.release(handle);
    expect(
      calls.some((c) => c.method === 'PUT' && c.body?.['paused'] === false),
    ).toBe(true);
    expect(
      calls.some(
        (c) =>
          c.method === 'POST' &&
          c.url.endsWith('/events') &&
          c.body?.['event'] === 'start_ai',
      ),
    ).toBe(true);
    calls.length = 0;
    vi.stubEnv('RUNTIME_BRIDGE_INTENT_ROOTS', admissionRoot);
    await expect(backend.release(handle)).rejects.toMatchObject({
      code: 'spec_invalid',
    });
    expect(calls.filter((c) => c.method !== 'GET')).toEqual([]);
  });

  it('direct AIF claim refuses marker removal before any network effect', async () => {
    const admissionRoot = mkdtempSync(resolve(tmpdir(), 'intent-admission-'));
    const home = resolve(
      admissionRoot,
      '.claude/orchestrator-prompts/intent-continuity',
    );
    mkdirSync(home, { recursive: true });
    writeFileSync(resolve(home, 'current-decisions.json'), '{}');
    writeFileSync(resolve(home, 'legacy-freeze.json'), '{}');
    const content = '# Newly admitted task without its scope\n';
    const filePath = resolve(admissionRoot, 'kickoff-new.md');
    writeFileSync(filePath, content);
    vi.stubEnv('RUNTIME_BRIDGE_INTENT_DECISIONS_HELPER', selector);
    vi.stubEnv('TEST_KICKOFF_SHA', sha256(content));
    const spy = vi
      .spyOn(globalThis, 'fetch')
      .mockRejectedValue(new Error('network call forbidden in admission test'));
    const backend = new AifHandoffBackend({
      baseUrl: 'http://localhost:3009',
      projectId: 'proj-uuid',
    });
    await expect(
      backend.claim({
        filePath,
        content,
        umbrellaName: 'adopted-demo',
        contentHash: sha256(content),
      }),
    ).rejects.toMatchObject({ code: 'spec_invalid' });
    expect(spy).not.toHaveBeenCalled();
  });

  it('manual packet and /fire refuse an unknown kickoff with its adopted scope removed', async () => {
    const admissionRoot = mkdtempSync(resolve(tmpdir(), 'intent-admission-'));
    const home = resolve(
      admissionRoot,
      '.claude/orchestrator-prompts/intent-continuity',
    );
    mkdirSync(home, { recursive: true });
    writeFileSync(resolve(home, 'current-decisions.json'), '{}');
    writeFileSync(resolve(home, 'legacy-freeze.json'), '{}');
    const content = '# New kickoff missing adopted scope\n';
    const filePath = resolve(admissionRoot, 'kickoff-new.md');
    writeFileSync(filePath, content);
    vi.stubEnv('RUNTIME_BRIDGE_INTENT_DECISIONS_HELPER', selector);
    vi.stubEnv('TEST_KICKOFF_SHA', sha256(content));
    const kickoff = {
      filePath,
      content,
      umbrellaName: 'adopted-demo',
      contentHash: sha256(content),
    };
    const before = new Set(manualArtifacts());
    await expect(new ManualBackend().dispatch(kickoff)).rejects.toMatchObject({
      code: 'spec_invalid',
    });
    await expect(
      new AifFireBackend({ routineId: 'test', token: 'never-send' }).dispatch(
        kickoff,
      ),
    ).rejects.toMatchObject({ code: 'spec_invalid' });
    expect(manualArtifacts().filter((f) => !before.has(f))).toEqual([]);
  });

  it('a persisted adopted task cannot become legacy when its scope is removed', () => {
    const admissionRoot = mkdtempSync(
      resolve(tmpdir(), 'intent-task-admission-'),
    );
    const home = resolve(
      admissionRoot,
      '.claude/orchestrator-prompts/intent-continuity',
    );
    mkdirSync(home, { recursive: true });
    writeFileSync(
      resolve(home, 'current-decisions.json'),
      JSON.stringify({ repoIdentity: 'test-repo' }),
    );
    writeFileSync(
      resolve(home, 'legacy-freeze.json'),
      JSON.stringify({ repoIdentity: 'test-repo', artifacts: [] }),
    );
    const description = scopedText(adopted, 'durable-task');
    recordTaskAdoption({ id: 'task-new', description }, admissionRoot);
    expect(() =>
      enforceTaskAdmission(
        { id: 'task-new', description: '# marker removed' },
        'test',
        { repoRoot: admissionRoot },
      ),
    ).toThrow(/description|adoption/i);
    expect(() =>
      enforceTaskAdmission(
        { id: 'task-unknown', description: '# marker removed' },
        'test',
        { repoRoot: admissionRoot },
      ),
    ).toThrow(/adoption|legacy/i);
    vi.spyOn(process, 'cwd').mockReturnValue(admissionRoot);
    expect(() =>
      enforceAnswerScope(
        {
          id: 'task-new',
          description: '# marker removed',
        },
        { backend: 'answer' },
      ),
    ).toThrow(/adoption|description/i);
  });

  it('admits only frozen task IDs or claimed frozen kickoffs as legacy', () => {
    const root = mkdtempSync(resolve(tmpdir(), 'intent-legacy-task-'));
    const home = resolve(
      root,
      '.claude/orchestrator-prompts/intent-continuity',
    );
    mkdirSync(home, { recursive: true });
    writeFileSync(
      resolve(home, 'current-decisions.json'),
      JSON.stringify({ repoIdentity: 'legacy-repo' }),
    );
    const description = '# Old kickoff\n';
    writeFileSync(
      resolve(home, 'legacy-freeze.json'),
      JSON.stringify({
        repoIdentity: 'legacy-repo',
        frozenAt: '2026-10-12T00:00:00.000Z',
        artifacts: [{ sha256: sha256(description) }],
        taskIds: ['frozen-id'],
      }),
    );
    vi.stubEnv('RUNTIME_BRIDGE_AIF_PROJECT_ID', 'correct-project');
    expect(
      enforceTaskAdmission({ id: 'frozen-id', description: 'edited' }, 'test', {
        repoRoot: root,
      }),
    ).toEqual({ adopted: false });
    expect(() =>
      enforceTaskAdmission(
        {
          id: 'old-id',
          description: 'edited',
          createdAt: '2026-10-11T00:00:00.000Z',
          projectId: 'correct-project',
        },
        'test',
        { repoRoot: root },
      ),
    ).toThrow(/adoption|legacy/i);
    expect(() =>
      enforceTaskAdmission(
        {
          id: 'new-copy',
          description,
          createdAt: '2026-10-13T00:00:00.000Z',
          projectId: 'correct-project',
        },
        'test',
        { repoRoot: root },
      ),
    ).toThrow(/adoption|legacy/i);
    expect(() =>
      enforceTaskAdmission(
        {
          id: 'foreign-old',
          description,
          createdAt: '2026-10-11T00:00:00.000Z',
          projectId: 'other-project',
        },
        'test',
        { repoRoot: root },
      ),
    ).toThrow(/adoption|legacy/i);
    recordLegacyTaskClaim({ id: 'claimed-old-kickoff', description }, root);
    expect(
      enforceTaskAdmission({ id: 'claimed-old-kickoff', description }, 'test', {
        repoRoot: root,
      }),
    ).toEqual({ adopted: false });
    const old = {
      id: 'recovered-active',
      status: 'plan_ready',
      projectId: 'correct-project',
      createdAt: '2026-10-10T00:00:00.000Z',
      updatedAt: '2026-10-11T00:00:00.000Z',
    };
    expect(recordRecoveredLegacyTask(old, root, 'correct-project')).toMatch(
      /legacy-recovery\.json$/,
    );
    expect(
      enforceTaskAdmission(
        {
          id: old.id,
          description: '# edited after recovery',
          projectId: old.projectId,
        },
        'test',
        { repoRoot: root },
      ),
    ).toEqual({ adopted: false });
    expect(() =>
      recordRecoveredLegacyTask(
        { ...old, id: 'already-done', status: 'done' },
        root,
        'correct-project',
      ),
    ).toThrow(/not proven active/i);
    expect(() =>
      recordRecoveredLegacyTask(
        {
          ...old,
          id: 'changed-after-freeze',
          updatedAt: '2026-10-13T00:00:00.000Z',
        },
        root,
        'correct-project',
      ),
    ).toThrow(/not proven active/i);
  });

  it('recovers only the requested live AIF row through the CLI readback', async () => {
    const root = mkdtempSync(resolve(tmpdir(), 'intent-live-recovery-'));
    const home = resolve(
      root,
      '.claude/orchestrator-prompts/intent-continuity',
    );
    mkdirSync(home, { recursive: true });
    writeFileSync(
      resolve(home, 'current-decisions.json'),
      JSON.stringify({ repoIdentity: 'legacy-repo' }),
    );
    writeFileSync(
      resolve(home, 'legacy-freeze.json'),
      JSON.stringify({
        repoIdentity: 'legacy-repo',
        frozenAt: '2026-10-12T00:00:00.000Z',
        artifacts: [],
        taskIds: [],
      }),
    );
    const row = {
      id: 'live-recovery',
      status: 'plan_ready',
      projectId: 'correct-project',
      createdAt: '2026-10-10T00:00:00.000Z',
      updatedAt: '2026-10-11T00:00:00.000Z',
    };
    const server = createServer((req, res) => {
      res.setHeader('content-type', 'application/json');
      res.end(
        JSON.stringify({
          ...row,
          id: req.url === '/tasks/wrong-id' ? row.id : 'live-recovery',
        }),
      );
    });
    await new Promise<void>((resolve) =>
      server.listen(0, '127.0.0.1', resolve),
    );
    try {
      const address = server.address();
      if (!address || typeof address === 'string')
        throw new Error('no test port');
      const base = `http://127.0.0.1:${address.port}`;
      await expect(
        recoverLegacyTaskFromAif(base, 'wrong-id', root, row.projectId),
      ).rejects.toThrow(/lacks freeze-recovery fields/);
      expect(() =>
        enforceTaskAdmission(
          { id: 'wrong-id', projectId: row.projectId },
          'test',
          { repoRoot: root },
        ),
      ).toThrow(/neither a standing adoption receipt/i);
      await expect(
        recoverLegacyTaskFromAif(base, row.id, root, row.projectId),
      ).resolves.toMatch(/legacy-recovery\.json$/);
      expect(
        enforceTaskAdmission({ id: row.id, projectId: row.projectId }, 'test', {
          repoRoot: root,
        }),
      ).toEqual({ adopted: false });
    } finally {
      server.close();
    }
  });

  it('resumes a changed adopted task only after current product authority and a new plan review bind both payloads', () => {
    const revisionRoot = mkdtempSync(
      resolve(tmpdir(), 'intent-task-revision-'),
    );
    const home = resolve(
      revisionRoot,
      '.claude/orchestrator-prompts/intent-continuity',
    );
    mkdirSync(home, { recursive: true });
    mkdirSync(resolve(revisionRoot, 'env'), { recursive: true });
    writeFileSync(
      resolve(home, 'current-decisions.json'),
      JSON.stringify({ repoIdentity: 'revision-repo' }),
    );
    writeFileSync(
      resolve(home, 'legacy-freeze.json'),
      JSON.stringify({ repoIdentity: 'revision-repo', artifacts: [] }),
    );
    const oldBrief = '# Old product promise\n';
    const newBrief = '# Operator-approved new promise\n';
    writeFileSync(resolve(revisionRoot, 'brief.md'), newBrief);
    const specBytes = '# Agreed specification\n';
    writeFileSync(resolve(revisionRoot, 'env/agreed-spec.md'), specBytes);
    const oldContract: FxContract = {
      ...produceContract,
      featureId: 'adopted-demo',
      brief: { path: 'brief.md', sha256: sha256(oldBrief) },
      shared: [{ path: 'env/agreed-spec.md', sha256: sha256(specBytes) }],
    };
    const newContract: FxContract = {
      ...oldContract,
      brief: { path: 'brief.md', sha256: sha256(newBrief) },
    };
    const oldDescription = scopedText(oldContract, 'prior');
    const newDescription = scopedText(newContract, 'updated');
    recordTaskAdoption(
      { id: 'revised-task', description: oldDescription },
      revisionRoot,
    );
    expect(() =>
      enforceAnswerScope(
        { id: 'revised-task', description: '# marker removed' },
        { backend: 'test', roots: [revisionRoot] },
      ),
    ).toThrow(/marker was removed/);
    const contractBytes = `${JSON.stringify(newContract)}\n`;
    writeFileSync(resolve(revisionRoot, 'contract-new.json'), contractBytes);
    const task = {
      id: 'revised-task',
      description: newDescription,
      plan: '# Current plan\n',
      paused: true,
      status: 'done',
      title: 'revised',
    };
    const review = {
      taskId: task.id,
      contractRef: { path: 'contract-new.json', sha256: sha256(contractBytes) },
      effectivePlanSha256: sha256(task.plan),
      taskPreImageSha256: taskPreImageDigest(task, { helperPath: HELPER }),
      classification: 'product-decision',
      ownerReference: 'current operator-approved PRD and agreed spec',
      previousDescriptionSha256: sha256(oldDescription),
    };
    const reviewPath = resolve(revisionRoot, 'plan-review.json');
    writeFileSync(reviewPath, JSON.stringify(review));
    const opts = {
      backend: 'test',
      reviewPath,
      helperPath: HELPER,
      roots: [revisionRoot],
      decisionsHelperPath: selector,
    };
    vi.stubEnv('TEST_CURRENT_SPEC_SHA', sha256(specBytes));
    vi.stubEnv('TEST_CURRENT_PRD_SHA', sha256(oldBrief));
    expect(() => enforceAnswerScope(task, opts)).toThrow(/current PRD|brief/i);
    vi.stubEnv('TEST_CURRENT_PRD_SHA', sha256(newBrief));
    expect(enforceAnswerScope(task, opts)).toEqual({ scoped: true });
    expect(enforceAnswerScope(task, opts)).toEqual({ scoped: true });
    writeFileSync(
      reviewPath,
      JSON.stringify({ ...review, ownerReference: 'changed review' }),
    );
    expect(() => enforceAnswerScope(task, opts)).toThrow(
      /adoption receipt|differs/i,
    );

    const specB = '# Newly agreed specification\n';
    writeFileSync(resolve(revisionRoot, 'env/agreed-spec.md'), specB);
    vi.stubEnv('TEST_CURRENT_SPEC_SHA', sha256(specB));
    const thirdContract: FxContract = {
      ...newContract,
      shared: [{ path: 'env/agreed-spec.md', sha256: sha256(specB) }],
    };
    const thirdDescription = scopedText(thirdContract, 'architecture-updated');
    const thirdTask = { ...task, description: thirdDescription };
    const thirdContractBytes = `${JSON.stringify(thirdContract)}\n`;
    writeFileSync(
      resolve(revisionRoot, 'contract-third.json'),
      thirdContractBytes,
    );
    const thirdReview = {
      ...review,
      contractRef: {
        path: 'contract-third.json',
        sha256: sha256(thirdContractBytes),
      },
      taskPreImageSha256: taskPreImageDigest(thirdTask, { helperPath: HELPER }),
      classification: 'contract-revision',
      previousDescriptionSha256: sha256(newDescription),
    };
    const thirdReviewPath = resolve(revisionRoot, 'plan-review-third.json');
    writeFileSync(thirdReviewPath, JSON.stringify(thirdReview));
    expect(
      enforceAnswerScope(thirdTask, { ...opts, reviewPath: thirdReviewPath }),
    ).toEqual({ scoped: true });
  });
});

/** A contract whose requiresReview binds the matching attempt — the release seam validates it. */
const reviewedContract: FxContract = {
  ...produceContract,
  requiresReview: { path: 'reviews/a1.json', sha256: sha256(reviewBytes) },
};
const reviewedBytes = `${JSON.stringify(reviewedContract, null, 2)}\n`;
writeFileSync(resolve(ROOT, 'contract-reviewed.json'), reviewedBytes, 'utf8');

/** A child contract that drops P1 while its parent (contract.json) retains it. */
const weakenedChild: FxContract = {
  ...produceContract,
  essentialPromiseIds: [],
  parentContract: contractRef,
};
const weakenedBytes = `${JSON.stringify(weakenedChild, null, 2)}\n`;
writeFileSync(resolve(ROOT, 'contract-weakened.json'), weakenedBytes, 'utf8');

/** Kickoff/description text carrying exactly one fenced intent-contract block. */
const scopedText = (contract: unknown, nonce: string): string =>
  `# Scoped demo ${nonce}\n\n## §1\nBody.\n\n\`\`\`intent-contract\n${JSON.stringify(contract, null, 2)}\n\`\`\`\n`;
const unscopedText = (nonce: string): string =>
  `# Plain demo ${nonce}\n\n## §1\nBody.\n`;
const malformedScopedText = (nonce: string): string =>
  `# Broken demo ${nonce}\n\n\`\`\`intent-contract\n{ not json\n\`\`\`\n`;

const kickoffSpec = (content: string): KickoffSpec => ({
  filePath: resolve(ROOT, `kickoff-${sha256(content).slice(0, 8)}.md`),
  content,
  // Unique umbrella (≠ dispatch-spec-invalid's 'demo-stage'): ManualBackend hashes it
  // into the /tmp packet name, so a shared umbrella would let this file's manual-fallback
  // controls and the sibling file's collide on the SAME filename inside one second.
  umbrellaName: 'demo-intent-fx',
  contentHash: sha256(content),
});

/** TaskId hash this suite's ManualBackend dispatches stamp onto their /tmp packets —
 *  manualArtifacts() scopes to it so a parallel worker's packets (other test files,
 *  other worktrees) can never land in a before/after window (measured 2026-10-10:
 *  the sibling file's A5-4 arm failed on THIS file's arm10 packet, and vice versa). */
const FIXTURE_TASK_HASH = sha256('demo-intent-fx').slice(0, 8);

// ---------------------------------------------------------------------------
// CLI harness — stub aif in its OWN process, logging every request to a JSONL file
// (dispatch-spec-invalid.test.ts harness; the log adds request + body recording so a
// zero-effect claim can be asserted across a process boundary).
// ---------------------------------------------------------------------------
const STUB_SRC = `
import { createServer } from 'node:http';
import { appendFileSync } from 'node:fs';
const cfg = JSON.parse(process.argv[2]);
const send = (res, status, body) => {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
};
createServer((req, res) => {
  const url = req.url ?? '';
  let raw = '';
  req.on('data', (c) => { raw += c; });
  req.on('end', () => {
    let body;
    try { body = raw ? JSON.parse(raw) : undefined; } catch { body = raw; }
    appendFileSync(cfg.log, JSON.stringify({ method: req.method, url, body }) + '\\n');
    if (url.startsWith('/health')) return send(res, 200, { ok: true });
    if (url.startsWith('/projects')) return send(res, 200, [{ id: 'proj-uuid', parallelEnabled: true }]);
    if (url.startsWith('/tasks') && req.method === 'POST') return send(res, 201, { id: 'task-123', status: 'backlog' });
    return send(res, 200, {});
  });
}).listen(0, '127.0.0.1', function () {
  process.stdout.write('READY http://127.0.0.1:' + this.address().port + '\\n');
});
`;

const running: ChildProcess[] = [];
afterEach(() => {
  while (running.length) running.pop()?.kill();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

interface StubLog {
  start(): Promise<string>;
  calls(): Array<{ method: string; url: string; body?: unknown }>;
}

function startStub(): StubLog {
  const logPath = resolve(
    mkdtempSync(resolve(tmpdir(), 'rb-stub-log-')),
    'requests.jsonl',
  );
  const dir = dirname(logPath);
  const stubPath = resolve(dir, 'stub.mjs');
  writeFileSync(stubPath, STUB_SRC, 'utf8');
  let baseUrl = '';
  const child = spawn('node', [stubPath, JSON.stringify({ log: logPath })], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  running.push(child);
  const ready = new Promise<string>((ok, fail) => {
    const t = setTimeout(
      () => fail(new Error('stub never reported READY')),
      10_000,
    );
    child.stdout!.on('data', (buf: Buffer) => {
      const m = /READY (\S+)/.exec(String(buf));
      if (m) {
        clearTimeout(t);
        ok(m[1]);
      }
    });
  });
  return {
    start: async () => {
      baseUrl = await ready;
      return baseUrl;
    },
    calls: () =>
      existsOrEmpty(logPath)
        ? readFileSync(logPath, 'utf8')
            .trim()
            .split('\n')
            .filter(Boolean)
            .map(
              (l) =>
                JSON.parse(l) as {
                  method: string;
                  url: string;
                  body?: unknown;
                },
            )
        : [],
  };
  function existsOrEmpty(p: string): boolean {
    try {
      readFileSync(p, 'utf8');
      return true;
    } catch {
      return false;
    }
  }
}

const manualArtifacts = (): string[] =>
  readdirSync('/tmp').filter(
    (f) =>
      f.startsWith('runtime-bridge-') && f.endsWith(`-${FIXTURE_TASK_HASH}.md`),
  );

function writeKickoffFile(content: string): string {
  const dir = mkdtempSync(resolve(tmpdir(), 'rb-kickoff-'));
  const path = resolve(dir, 'kickoff.md');
  writeFileSync(path, content, 'utf8');
  return path;
}

function runDispatch(
  kickoffPath: string,
  baseUrl: string,
  envOverride: Record<string, string> = {},
  { force = true }: { force?: boolean } = {},
): SpawnSyncReturns<string> {
  return spawnSync(TSX, [CLI, kickoffPath, ...(force ? ['--force'] : [])], {
    encoding: 'utf8',
    timeout: SLOW_SHELL_MS,
    env: {
      ...process.env,
      RUNTIME_BRIDGE_MODE: 'aif-handoff',
      RUNTIME_BRIDGE_AIF_URL: baseUrl,
      RUNTIME_BRIDGE_AIF_PROJECT_ID: 'proj-uuid',
      RUNTIME_BRIDGE_PREFLIGHT: '',
      RUNTIME_BRIDGE_DEDUP_PATH: resolve(ROOT, 'dedup.jsonl'),
      RUNTIME_BRIDGE_INTENT_ROOTS: ROOT,
      RUNTIME_BRIDGE_INTENT_HELPER: HELPER,
      ...envOverride,
    },
  });
}

// ---------------------------------------------------------------------------
// The fence contract — extraction itself (adapter unit face).
// ---------------------------------------------------------------------------
describe('extractIntentScope — fail-closed fence parsing', () => {
  it('zero blocks → unscoped (ordinary behaviour applies)', async () => {
    const { extractIntentScope } = await loadResultReview();
    expect(extractIntentScope(unscopedText('x'))).toMatchObject({
      kind: 'unscoped',
    });
  });
  it('one well-formed block → scoped with a parsed contract', async () => {
    const { extractIntentScope } = await loadResultReview();
    expect(extractIntentScope(scopedText(produceContract, 'y'))).toMatchObject({
      kind: 'scoped',
    });
  });
  it('malformed block → invalid (NEVER falls through to unscoped)', async () => {
    const { extractIntentScope } = await loadResultReview();
    expect(extractIntentScope(malformedScopedText('z')).kind).toBe('invalid');
  });
  // Cold-review M1 (2026-10-10): a near-miss OPENER used to fail OPEN — it never matched the
  // strict open regex, so the block was ignored and the description degraded to unscoped.
  // Flip: the near-miss classifier (FENCE_OPEN_NEAR_MISS_RE) stops returning invalid.
  it('near-miss opener with an info-string tail → invalid, NOT unscoped', async () => {
    const { extractIntentScope } = await loadResultReview();
    const text = '# Demo\n\n```intent-contract json\n{"featureId":"f"}\n```\n';
    const scope = extractIntentScope(text);
    expect(scope.kind).toBe('invalid');
    expect(scope).not.toMatchObject({ kind: 'unscoped' });
  });
  it('near-miss opener with case drift → invalid, NOT unscoped', async () => {
    const { extractIntentScope } = await loadResultReview();
    const text = '# Demo\n\n```Intent-Contract\n{"featureId":"f"}\n```\n';
    expect(extractIntentScope(text).kind).toBe('invalid');
  });
  it('near-miss opener with a space after the fence → invalid, NOT unscoped', async () => {
    const { extractIntentScope } = await loadResultReview();
    const text = '# Demo\n\n``` intent-contract\n{"featureId":"f"}\n```\n';
    expect(extractIntentScope(text).kind).toBe('invalid');
  });
  it('near-miss opener with a word-char suffix → invalid, NOT unscoped (finding 94ac13a2)', async () => {
    const { extractIntentScope } = await loadResultReview();
    const plural = extractIntentScope(
      '# Demo\n\n```intent-contracts\n{"featureId":"f"}\n```\n',
    );
    const numbered = extractIntentScope(
      '# Demo\n\n```intent-contract2\n{"featureId":"f"}\n```\n',
    );
    expect(plural.kind).toBe('invalid');
    expect(numbered.kind).toBe('invalid');
    expect(plural).not.toMatchObject({ kind: 'unscoped' });
    expect(numbered).not.toMatchObject({ kind: 'unscoped' });
  });
  it('the exact opener still parses as scoped (near-miss net does not swallow the documented form)', async () => {
    const { extractIntentScope } = await loadResultReview();
    expect(extractIntentScope(scopedText(produceContract, 'w')).kind).toBe(
      'scoped',
    );
  });
  it('two blocks → invalid (ambiguous declared scope fails closed)', async () => {
    const { extractIntentScope } = await loadResultReview();
    const two = `${scopedText(produceContract, 'a')}\n${scopedText(produceContract, 'b')}`;
    expect(extractIntentScope(two).kind).toBe('invalid');
  });
});

// ---------------------------------------------------------------------------
// CLI seam — validation before dedup success, before any POST, --force-proof.
// ---------------------------------------------------------------------------
describe('cli/dispatch.ts — a scoped kickoff with a broken contract never dispatches', () => {
  it(
    'malformed intent-contract block → exit 2, NO POST /tasks, no manual packet, no dedup record',
    async () => {
      const stub = startStub();
      const url = await stub.start();
      const before = new Set(manualArtifacts());
      const r = runDispatch(writeKickoffFile(malformedScopedText('arm1')), url);

      expect(r.status).toBe(2);
      expect(
        stub
          .calls()
          .filter((c) => c.method === 'POST' && c.url.endsWith('/tasks')),
      ).toEqual([]);
      expect(manualArtifacts().filter((f) => !before.has(f))).toEqual([]);
      expect(r.stdout).not.toContain('paste into a new Claude Code session');
      expect(r.stdout).not.toContain('Dispatched to');
    },
    SLOW_SHELL_MS + 15_000,
  );

  it(
    'valid declared scope whose brief bytes are missing → exit 2, NO POST (ref resolution at the dispatch seam)',
    async () => {
      const stub = startStub();
      const url = await stub.start();
      const broken: FxContract = {
        ...produceContract,
        brief: { path: 'brief-gone.md', sha256: briefDigest },
      };
      const r = runDispatch(writeKickoffFile(scopedText(broken, 'arm2')), url);

      expect(r.status).toBe(2);
      expect(
        stub
          .calls()
          .filter((c) => c.method === 'POST' && c.url.endsWith('/tasks')),
      ).toEqual([]);
    },
    SLOW_SHELL_MS + 15_000,
  );

  it(
    '--force does NOT bypass the scope gate → exit 2, NO POST, no dedup success line',
    async () => {
      const stub = startStub();
      const url = await stub.start();
      const r = runDispatch(writeKickoffFile(malformedScopedText('arm3')), url);

      expect(r.status).toBe(2);
      expect(r.stdout).not.toContain('already dispatched');
      expect(
        stub
          .calls()
          .filter((c) => c.method === 'POST' && c.url.endsWith('/tasks')),
      ).toEqual([]);
    },
    SLOW_SHELL_MS + 15_000,
  );

  it(
    'a seeded dedup entry does NOT short-circuit the scope check → scope gate fires first (no dedup success, exit 2)',
    async () => {
      // Cold-review M2 (2026-10-10): this arm previously ran WITH --force, under which
      // dispatch.ts skips checkDedup entirely — the seeded entry was never read and the arm
      // duplicated the --force arm. force:false makes the dedup gate REACHABLE, so the pin is
      // real: if enforceScope moved after checkDedup, the dedup hit would report
      // "already dispatched" and skip the scope check → stdout assertion RED.
      const stub = startStub();
      const url = await stub.start();
      const content = malformedScopedText('arm4');
      const dedupPath = resolve(ROOT, 'dedup-preseeded.jsonl');
      writeFileSync(
        dedupPath,
        `${JSON.stringify({
          hash: sha256(content),
          taskHandle: {
            backend: 'aif-handoff',
            taskId: 'prior-task',
            dispatchedAt: new Date().toISOString(),
          },
          timestamp: new Date().toISOString(),
        })}\n`,
        'utf8',
      );
      const r = runDispatch(
        writeKickoffFile(content),
        url,
        { RUNTIME_BRIDGE_DEDUP_PATH: dedupPath },
        { force: false },
      );

      expect(r.status).toBe(2);
      expect(r.stdout).not.toContain('already dispatched');
      expect(
        stub
          .calls()
          .filter((c) => c.method === 'POST' && c.url.endsWith('/tasks')),
      ).toEqual([]);
    },
    SLOW_SHELL_MS + 15_000,
  );

  it(
    'unconfigured intent helper (empty env) → a scoped task still fails CLOSED → exit 2, NO POST (cold-review O2)',
    async () => {
      const stub = startStub();
      const url = await stub.start();
      const r = runDispatch(
        writeKickoffFile(malformedScopedText('arm-unconfigured')),
        url,
        {
          RUNTIME_BRIDGE_INTENT_ROOTS: '',
          RUNTIME_BRIDGE_INTENT_HELPER: '',
        },
      );

      expect(r.status).toBe(2);
      expect(r.stderr).toContain('spec_invalid');
      expect(
        stub
          .calls()
          .filter((c) => c.method === 'POST' && c.url.endsWith('/tasks')),
      ).toEqual([]);
    },
    SLOW_SHELL_MS + 15_000,
  );

  it(
    'SCOPED CONTROL: a valid produce contract dispatches with autoMode:false (planning may run, implementation may not)',
    async () => {
      const stub = startStub();
      const url = await stub.start();
      const r = runDispatch(
        writeKickoffFile(scopedText(produceContract, 'arm5')),
        url,
      );

      expect(r.status).toBe(0);
      const post = stub
        .calls()
        .find((c) => c.method === 'POST' && c.url.endsWith('/tasks'));
      expect(post?.body).toMatchObject({ paused: true, autoMode: false });
    },
    SLOW_SHELL_MS + 15_000,
  );

  it(
    'UNSCOPED CONTROL: ordinary dispatch is unchanged (exit 0, autoMode:true)',
    async () => {
      const stub = startStub();
      const url = await stub.start();
      const r = runDispatch(writeKickoffFile(unscopedText('arm6')), url);

      expect(r.status).toBe(0);
      const post = stub
        .calls()
        .find((c) => c.method === 'POST' && c.url.endsWith('/tasks'));
      expect(post?.body).toMatchObject({ paused: true, autoMode: true });
    },
    SLOW_SHELL_MS + 15_000,
  );
});

// ---------------------------------------------------------------------------
// Direct backend seams — zero fetch, zero packet on a failed scope.
// ---------------------------------------------------------------------------
describe('direct backend invocation — failed scope means zero effects', () => {
  it('AifHandoffBackend.dispatch with a malformed scope → spec_invalid and fetch is NEVER called', async () => {
    vi.stubEnv('RUNTIME_BRIDGE_INTENT_ROOTS', ROOT);
    vi.stubEnv('RUNTIME_BRIDGE_INTENT_HELPER', HELPER);
    const spy = vi.spyOn(globalThis, 'fetch');
    const backend = new AifHandoffBackend({
      baseUrl: 'http://localhost:3009',
      projectId: 'proj-uuid',
    });

    await expect(
      backend.dispatch(kickoffSpec(malformedScopedText('arm7'))),
    ).rejects.toMatchObject({
      name: 'BackendError',
      code: 'spec_invalid',
    });
    expect(spy).not.toHaveBeenCalled();
  });

  it('ManualBackend.dispatch with a malformed scope → spec_invalid and NO /tmp packet', async () => {
    vi.stubEnv('RUNTIME_BRIDGE_INTENT_ROOTS', ROOT);
    vi.stubEnv('RUNTIME_BRIDGE_INTENT_HELPER', HELPER);
    const before = new Set(manualArtifacts());

    await expect(
      new ManualBackend().dispatch(kickoffSpec(malformedScopedText('arm8'))),
    ).rejects.toBeInstanceOf(BackendError);
    expect(manualArtifacts().filter((f) => !before.has(f))).toEqual([]);
  });

  it('AifFireBackend.dispatch with a malformed scope → spec_invalid and fetch is NEVER called', async () => {
    vi.stubEnv('RUNTIME_BRIDGE_INTENT_ROOTS', ROOT);
    vi.stubEnv('RUNTIME_BRIDGE_INTENT_HELPER', HELPER);
    const spy = vi.spyOn(globalThis, 'fetch');
    const backend = new AifFireBackend({
      routineId: 'r-1',
      token: 't-1',
      baseUrl: 'http://localhost:9',
    });

    await expect(
      backend.dispatch(kickoffSpec(malformedScopedText('arm9'))),
    ).rejects.toMatchObject({
      code: 'spec_invalid',
    });
    expect(spy).not.toHaveBeenCalled();
  });

  it('UNSCOPED CONTROL: ManualBackend.dispatch still writes its packet (ordinary behaviour)', () => {
    const before = new Set(manualArtifacts());
    return new ManualBackend()
      .dispatch(kickoffSpec(unscopedText('arm10')))
      .then((handle) => {
        expect(existsTmpPacket(handle.taskId)).toBe(true);
      });
    function existsTmpPacket(taskId: string): boolean {
      try {
        readFileSync(`/tmp/runtime-bridge-${taskId}.md`, 'utf8');
        return true;
      } catch {
        return false;
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Release seam — the persisted description is re-read; stale/weak/malformed hold.
// ---------------------------------------------------------------------------
interface Call {
  url: string;
  method: string;
  body?: Record<string, unknown>;
}

function mockTaskStore(calls: Call[], task: Record<string, unknown>): void {
  vi.spyOn(globalThis, 'fetch').mockImplementation(
    (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? 'GET';
      const body = init?.body
        ? (JSON.parse(String(init.body)) as Record<string, unknown>)
        : undefined;
      calls.push({ url, method, body });
      if (method === 'GET' && url.endsWith('/projects')) {
        return Promise.resolve(
          new Response(
            JSON.stringify([{ id: 'proj-uuid', parallelEnabled: true }]),
            { status: 200 },
          ),
        );
      }
      if (method === 'POST' && url.endsWith('/tasks')) {
        return Promise.resolve(
          new Response(JSON.stringify({ id: 'task-42', status: 'backlog' }), {
            status: 201,
          }),
        );
      }
      if (method === 'GET' && /\/tasks\/[^/]+$/.test(url)) {
        return Promise.resolve(
          new Response(JSON.stringify(task), { status: 200 }),
        );
      }
      return Promise.resolve(new Response('', { status: 200 }));
    },
  );
}

describe('AifHandoffBackend.release — validation against the PERSISTED description', () => {
  const backend = () =>
    new AifHandoffBackend({
      baseUrl: 'http://localhost:3009',
      projectId: 'proj-uuid',
    });

  it('holds a claimed adopted handle after its marker is removed even without root env', async () => {
    const admissionRoot = mkdtempSync(
      resolve(tmpdir(), 'intent-release-root-'),
    );
    const home = resolve(
      admissionRoot,
      '.claude/orchestrator-prompts/intent-continuity',
    );
    mkdirSync(home, { recursive: true });
    writeFileSync(
      resolve(home, 'current-decisions.json'),
      JSON.stringify({ repoIdentity: 'release-root' }),
    );
    writeFileSync(
      resolve(home, 'legacy-freeze.json'),
      JSON.stringify({ repoIdentity: 'release-root', artifacts: [] }),
    );
    recordTaskAdoption(
      {
        id: 'task-42',
        description: scopedText(produceContract, 'claim-adopted'),
      },
      admissionRoot,
    );
    vi.stubEnv('RUNTIME_BRIDGE_INTENT_ROOTS', '');
    vi.stubEnv('AIF_INTENT_REPO_ROOT', '');
    const calls: Call[] = [];
    mockTaskStore(calls, {
      id: 'task-42',
      paused: true,
      description: '# marker removed',
    });
    expect(releaseOwnerRoot(admissionRoot)).toBe(admissionRoot);
    await expect(
      backend().release(
        handleFromTaskId('task-42', releaseOwnerRoot(admissionRoot)),
      ),
    ).rejects.toMatchObject({ code: 'spec_invalid' });
    expect(calls.filter((call) => call.method === 'PUT')).toEqual([]);
    vi.spyOn(process, 'cwd').mockReturnValue(admissionRoot);
    calls.length = 0;
    mockTaskStore(calls, {
      id: 'task-42',
      paused: true,
      description: '# marker removed',
    });
    await expect(
      backend().release(handleFromTaskId('task-42')),
    ).rejects.toMatchObject({ code: 'spec_invalid' });
    expect(calls.filter((call) => call.method === 'PUT')).toEqual([]);
  });

  it('stale delayed release → refused, NO unpause PUT; the paused claim remains paused', async () => {
    vi.stubEnv('RUNTIME_BRIDGE_INTENT_ROOTS', ROOT);
    vi.stubEnv('RUNTIME_BRIDGE_INTENT_HELPER', HELPER);
    vi.stubEnv('RUNTIME_BRIDGE_INTENT_OBSERVED_REVISION', 'rev-2');
    const content = scopedText(reviewedContract, 'rel1');
    const calls: Call[] = [];
    mockTaskStore(calls, {
      id: 'task-42',
      status: 'backlog',
      paused: true,
      description: content,
    });
    const handle = await backend().claim(kickoffSpec(content));
    calls.length = 0;

    await expect(backend().release(handle)).rejects.toMatchObject({
      code: 'spec_invalid',
    });
    expect(calls.filter((c) => c.method === 'PUT')).toEqual([]);
    expect(
      calls.filter((c) => c.method === 'POST' && c.url.endsWith('/events')),
    ).toEqual([]);
  });

  it('child scope dropping a parent essential in the PERSISTED description → refused, no PUT', async () => {
    vi.stubEnv('RUNTIME_BRIDGE_INTENT_ROOTS', ROOT);
    vi.stubEnv('RUNTIME_BRIDGE_INTENT_HELPER', HELPER);
    const content = scopedText(weakenedChild, 'rel2');
    const calls: Call[] = [];
    mockTaskStore(calls, {
      id: 'task-42',
      status: 'backlog',
      paused: true,
      description: content,
    });
    const handle = await backend().claim(kickoffSpec(content));
    calls.length = 0;

    await expect(backend().release(handle)).rejects.toMatchObject({
      code: 'spec_invalid',
    });
    expect(calls.filter((c) => c.method === 'PUT')).toEqual([]);
  });

  it('malformed declared scope in the persisted description → refused, NEVER treated as ordinary unscoped', async () => {
    vi.stubEnv('RUNTIME_BRIDGE_INTENT_ROOTS', ROOT);
    vi.stubEnv('RUNTIME_BRIDGE_INTENT_HELPER', HELPER);
    const content = malformedScopedText('rel3');
    const calls: Call[] = [];
    mockTaskStore(calls, {
      id: 'task-42',
      status: 'backlog',
      paused: true,
      description: content,
    });
    const handle = await backend().claim(kickoffSpec(content));
    calls.length = 0;

    await expect(backend().release(handle)).rejects.toMatchObject({
      code: 'spec_invalid',
    });
    expect(calls.filter((c) => c.method === 'PUT')).toEqual([]);
  });

  it('SCOPED CONTROL: current review + intact scope → unpause PUT and the start_ai planning event', async () => {
    vi.stubEnv('RUNTIME_BRIDGE_INTENT_ROOTS', ROOT);
    vi.stubEnv('RUNTIME_BRIDGE_INTENT_HELPER', HELPER);
    vi.stubEnv('RUNTIME_BRIDGE_INTENT_OBSERVED_REVISION', 'rev-1');
    const content = scopedText(reviewedContract, 'rel4');
    const calls: Call[] = [];
    mockTaskStore(calls, {
      id: 'task-42',
      status: 'backlog',
      paused: true,
      description: content,
    });
    const handle = await backend().claim(kickoffSpec(content));
    calls.length = 0;

    await backend().release(handle);
    expect(
      calls.some((c) => c.method === 'PUT' && c.body?.['paused'] === false),
    ).toBe(true);
    const events = calls.filter(
      (c) => c.method === 'POST' && c.url.endsWith('/events'),
    );
    expect(events.some((c) => c.body?.['event'] === 'start_ai')).toBe(true);
  });

  it('UNSCOPED CONTROL: release stays a bare unpause PUT — no event, unchanged behaviour', async () => {
    vi.stubEnv('RUNTIME_BRIDGE_INTENT_ROOTS', ROOT);
    const content = unscopedText('rel5');
    const calls: Call[] = [];
    mockTaskStore(calls, {
      id: 'task-42',
      status: 'backlog',
      paused: true,
      description: content,
    });
    const handle = await backend().claim(kickoffSpec(content));
    calls.length = 0;

    await backend().release(handle);
    expect(
      calls.some((c) => c.method === 'PUT' && c.body?.['paused'] === false),
    ).toBe(true);
    expect(
      calls.filter((c) => c.method === 'POST' && c.url.endsWith('/events')),
    ).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Answer seam — plan-changing/restarting answers on a scoped task are guarded.
// ---------------------------------------------------------------------------
describe('cli/answer.ts pushAnswer — scoped tasks require an authorized within-contract PlanReview', () => {
  const PLAN = '## Task\nimplement the thing\n';
  const ANSWER = 'resume with the approved accessor wording';

  const planReview = async (
    overrides: Record<string, unknown> = {},
  ): Promise<Record<string, unknown>> => ({
    taskId: 'task-42',
    contractRef,
    effectivePlanSha256: sha256(PLAN),
    taskPreImageSha256: await (
      await loadResultReview()
    ).taskPreImageDigest(
      {
        id: 'task-42',
        title: 'demo-stage',
        status: 'done',
        plan: PLAN,
        paused: true,
        autoMode: false,
      },
      { helperPath: HELPER },
    ),
    payloadSha256: sha256(ANSWER),
    classification: 'within-contract',
    ownerReference: 'operator statement 2026-10-10, content bound by digest',
    ...overrides,
  });

  const scopedTask = (contract: unknown): Record<string, unknown> => ({
    id: 'task-42',
    title: 'demo-stage',
    status: 'done',
    plan: PLAN,
    paused: true,
    autoMode: false,
    description: scopedText(contract, 'ans'),
  });

  it('scoped resume WITHOUT a PlanReview → spec_invalid, NO unpause PUT, no plan rewrite', async () => {
    vi.stubEnv('RUNTIME_BRIDGE_INTENT_ROOTS', ROOT);
    vi.stubEnv('RUNTIME_BRIDGE_INTENT_HELPER', HELPER);
    const calls: Call[] = [];
    mockTaskStore(calls, scopedTask(produceContract));

    await expect(
      pushAnswer('http://localhost:3009', 'task-42', 'resume', ANSWER),
    ).rejects.toMatchObject({
      code: 'spec_invalid',
    });
    expect(calls.filter((c) => c.method === 'PUT')).toEqual([]);
  });

  it('scoped resume with a contract-revision PlanReview → HELD (S1 default), no PUT', async () => {
    vi.stubEnv('RUNTIME_BRIDGE_INTENT_ROOTS', ROOT);
    vi.stubEnv('RUNTIME_BRIDGE_INTENT_HELPER', HELPER);
    const reviewPath = resolve(ROOT, 'plan-review-contract-revision.json');
    writeFileSync(
      reviewPath,
      JSON.stringify(
        await planReview({ classification: 'contract-revision' }),
        null,
        2,
      ),
      'utf8',
    );
    const calls: Call[] = [];
    mockTaskStore(calls, scopedTask(produceContract));

    await expect(
      pushAnswer('http://localhost:3009', 'task-42', 'resume', ANSWER, {
        reviewPath,
      }),
    ).rejects.toMatchObject({ code: 'spec_invalid' });
    expect(calls.filter((c) => c.method === 'PUT')).toEqual([]);
  });

  it('scoped resume with a PlanReview whose payload digest diverges → held, no PUT', async () => {
    vi.stubEnv('RUNTIME_BRIDGE_INTENT_ROOTS', ROOT);
    vi.stubEnv('RUNTIME_BRIDGE_INTENT_HELPER', HELPER);
    const reviewPath = resolve(ROOT, 'plan-review-bad-payload.json');
    writeFileSync(
      reviewPath,
      JSON.stringify(
        await planReview({ payloadSha256: sha256('a different answer') }),
        null,
        2,
      ),
      'utf8',
    );
    const calls: Call[] = [];
    mockTaskStore(calls, scopedTask(produceContract));

    await expect(
      pushAnswer('http://localhost:3009', 'task-42', 'resume', ANSWER, {
        reviewPath,
      }),
    ).rejects.toMatchObject({ code: 'spec_invalid' });
    expect(calls.filter((c) => c.method === 'PUT')).toEqual([]);
  });

  it('SCOPED CONTROL: within-contract PlanReview + matching payload → the unpause PUT proceeds', async () => {
    vi.stubEnv('RUNTIME_BRIDGE_INTENT_ROOTS', ROOT);
    vi.stubEnv('RUNTIME_BRIDGE_INTENT_HELPER', HELPER);
    const reviewPath = resolve(ROOT, 'plan-review-ok.json');
    writeFileSync(
      reviewPath,
      JSON.stringify(await planReview(), null, 2),
      'utf8',
    );
    const calls: Call[] = [];
    mockTaskStore(calls, scopedTask(produceContract));

    await pushAnswer('http://localhost:3009', 'task-42', 'resume', ANSWER, {
      reviewPath,
    });
    const put = calls.find((c) => c.method === 'PUT');
    expect(put?.body).toMatchObject({ paused: false, blockedReason: null });
    expect(String(put?.body?.['plan'])).toContain('OPERATOR ANSWER');
  });

  it('scoped request_changes WITHOUT a PlanReview → no comment POST, no event POST', async () => {
    vi.stubEnv('RUNTIME_BRIDGE_INTENT_ROOTS', ROOT);
    vi.stubEnv('RUNTIME_BRIDGE_INTENT_HELPER', HELPER);
    const calls: Call[] = [];
    mockTaskStore(calls, scopedTask(produceContract));

    await expect(
      pushAnswer('http://localhost:3009', 'task-42', 'request_changes', ANSWER),
    ).rejects.toMatchObject({ code: 'spec_invalid' });
    expect(
      calls.filter((c) => c.method === 'POST' && c.url.endsWith('/comments')),
    ).toEqual([]);
    expect(
      calls.filter((c) => c.method === 'POST' && c.url.endsWith('/events')),
    ).toEqual([]);
  });

  it('UNSCOPED CONTROL: resume without a contract stays ordinary (unpause PUT proceeds)', async () => {
    vi.stubEnv('RUNTIME_BRIDGE_INTENT_ROOTS', ROOT);
    const calls: Call[] = [];
    mockTaskStore(calls, {
      id: 'task-42',
      title: 'demo-stage',
      status: 'done',
      plan: PLAN,
      paused: true,
    });

    await pushAnswer('http://localhost:3009', 'task-42', 'resume', ANSWER);
    expect(
      calls.some((c) => c.method === 'PUT' && c.body?.['paused'] === false),
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Start seam — start_implementation is posted ONLY through the gated reviewed route.
// ---------------------------------------------------------------------------
/** Mock whose GET /tasks/:id serves `first` once and `then` afterwards (re-read divergence). */
function mockChangingTaskStore(
  calls: Call[],
  first: Record<string, unknown>,
  then: Record<string, unknown>,
): void {
  let gets = 0;
  vi.spyOn(globalThis, 'fetch').mockImplementation(
    (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? 'GET';
      calls.push({
        url,
        method,
        body: init?.body
          ? (JSON.parse(String(init.body)) as Record<string, unknown>)
          : undefined,
      });
      if (method === 'GET' && /\/tasks\/[^/]+$/.test(url)) {
        gets += 1;
        return Promise.resolve(
          new Response(JSON.stringify(gets === 1 ? first : then), {
            status: 200,
          }),
        );
      }
      return Promise.resolve(new Response('', { status: 200 }));
    },
  );
}

describe('cli/start-reviewed.ts startReviewed — the event POST fires only on an authorized review of a waiting scoped claim', () => {
  const PLAN = '## Task\nimplement the scoped thing\n';

  it('holds a reviewed start when the adopted PRD changed after planning, with no event POST', async () => {
    vi.stubEnv('RUNTIME_BRIDGE_INTENT_ROOTS', ROOT);
    vi.stubEnv('RUNTIME_BRIDGE_INTENT_HELPER', HELPER);
    vi.stubEnv(
      'RUNTIME_BRIDGE_INTENT_DECISIONS_HELPER',
      resolve(ROOT, 'selector-probe.mjs'),
    );
    vi.stubEnv('TEST_CURRENT_PRD_SHA', 'f'.repeat(64));
    vi.stubEnv('TEST_CURRENT_SPEC_SHA', sha256('# Agreed specification\n'));
    const adopted = {
      ...produceContract,
      featureId: 'adopted-demo',
      shared: [
        {
          path: 'env/agreed-spec.md',
          sha256: sha256('# Agreed specification\n'),
        },
      ],
    };
    const adoptedRef = E(
      'contract-adopted.json',
      `${JSON.stringify(adopted)}\n`,
    );
    const row = waitingScopedTask({
      description: scopedText(adopted, 'stale-start'),
    });
    const reviewPath = await writeReview('adopted-stale', row, {
      contractRef: adoptedRef,
    });
    const calls: Call[] = [];
    mockTaskStore(calls, row);
    await expect(
      startReviewed('http://localhost:3009', 'task-42', reviewPath),
    ).rejects.toMatchObject({ code: 'spec_invalid' });
    expect(
      calls.filter((c) => c.method === 'POST' && c.url.endsWith('/events')),
    ).toEqual([]);
  });

  /** A task parked at plan_ready by the scoped claim (autoMode:false). */
  const waitingScopedTask = (
    overrides: Record<string, unknown> = {},
  ): Record<string, unknown> => ({
    id: 'task-42',
    title: 'demo-stage',
    status: 'plan_ready',
    plan: PLAN,
    paused: true,
    autoMode: false,
    description: scopedText(produceContract, 'sr'),
    ...overrides,
  });

  /** Authorized PlanReview for the current row — start-reviewed proposes NO answer payload. */
  const startReview = async (
    task: Record<string, unknown>,
    overrides: Record<string, unknown> = {},
  ): Promise<Record<string, unknown>> => ({
    taskId: 'task-42',
    contractRef,
    effectivePlanSha256: sha256(String(task.plan ?? '')),
    taskPreImageSha256: await (
      await loadResultReview()
    ).taskPreImageDigest(task, { helperPath: HELPER }),
    classification: 'within-contract',
    ownerReference: 'operator statement 2026-10-10, content bound by digest',
    ...overrides,
  });

  const writeReview = async (
    name: string,
    task: Record<string, unknown>,
    overrides: Record<string, unknown> = {},
  ) => {
    const reviewPath = resolve(ROOT, `start-review-${name}.json`);
    writeFileSync(
      reviewPath,
      JSON.stringify(await startReview(task, overrides), null, 2),
      'utf8',
    );
    return reviewPath;
  };

  it('UNSCOPED task → refused (this is the scoped route only), NO event POST', async () => {
    vi.stubEnv('RUNTIME_BRIDGE_INTENT_ROOTS', ROOT);
    vi.stubEnv('RUNTIME_BRIDGE_INTENT_HELPER', HELPER);
    const row = { ...waitingScopedTask(), description: unscopedText('sr1') };
    const reviewPath = await writeReview('unscoped', row);
    const calls: Call[] = [];
    mockTaskStore(calls, row);

    await expect(
      startReviewed('http://localhost:3009', 'task-42', reviewPath),
    ).rejects.toMatchObject({
      code: 'spec_invalid',
    });
    expect(
      calls.filter((c) => c.method === 'POST' && c.url.endsWith('/events')),
    ).toEqual([]);
  });

  it('scoped task NOT in plan_ready → held (nothing to start), NO event POST', async () => {
    vi.stubEnv('RUNTIME_BRIDGE_INTENT_ROOTS', ROOT);
    vi.stubEnv('RUNTIME_BRIDGE_INTENT_HELPER', HELPER);
    const row = waitingScopedTask({ status: 'planning' });
    const reviewPath = await writeReview('wrong-state', row);
    const calls: Call[] = [];
    mockTaskStore(calls, row);

    await expect(
      startReviewed('http://localhost:3009', 'task-42', reviewPath),
    ).rejects.toMatchObject({
      code: 'spec_invalid',
    });
    expect(
      calls.filter((c) => c.method === 'POST' && c.url.endsWith('/events')),
    ).toEqual([]);
  });

  it('autoMode:true (an ordinary auto task) → refused through the reviewed route, NO event POST', async () => {
    vi.stubEnv('RUNTIME_BRIDGE_INTENT_ROOTS', ROOT);
    vi.stubEnv('RUNTIME_BRIDGE_INTENT_HELPER', HELPER);
    const row = waitingScopedTask({ autoMode: true });
    const reviewPath = await writeReview('automode', row);
    const calls: Call[] = [];
    mockTaskStore(calls, row);

    await expect(
      startReviewed('http://localhost:3009', 'task-42', reviewPath),
    ).rejects.toMatchObject({
      code: 'spec_invalid',
    });
    expect(
      calls.filter((c) => c.method === 'POST' && c.url.endsWith('/events')),
    ).toEqual([]);
  });

  it('review binding an ANSWER payload while start-reviewed proposes none → HELD (payload binding), NO event POST', async () => {
    vi.stubEnv('RUNTIME_BRIDGE_INTENT_ROOTS', ROOT);
    vi.stubEnv('RUNTIME_BRIDGE_INTENT_HELPER', HELPER);
    const row = waitingScopedTask();
    const reviewPath = await writeReview('payload', row, {
      payloadSha256: sha256('an answer payload'),
    });
    const calls: Call[] = [];
    mockTaskStore(calls, row);

    await expect(
      startReviewed('http://localhost:3009', 'task-42', reviewPath),
    ).rejects.toMatchObject({
      code: 'spec_invalid',
    });
    expect(
      calls.filter((c) => c.method === 'POST' && c.url.endsWith('/events')),
    ).toEqual([]);
  });

  it('plan bytes changed between validation and the re-read → HELD at the re-read, NO event POST', async () => {
    vi.stubEnv('RUNTIME_BRIDGE_INTENT_ROOTS', ROOT);
    vi.stubEnv('RUNTIME_BRIDGE_INTENT_HELPER', HELPER);
    const first = waitingScopedTask();
    const reviewPath = await writeReview('reread', first);
    const changed = waitingScopedTask({
      plan: '## Task\nDIFFERENT plan written concurrently\n',
    });
    const calls: Call[] = [];
    mockChangingTaskStore(calls, first, changed);

    await expect(
      startReviewed('http://localhost:3009', 'task-42', reviewPath),
    ).rejects.toMatchObject({
      code: 'spec_invalid',
    });
    // Exactly the two validation GETs happened; the event never fired — the hold is
    // attributable to the RE-READ (the first pass validated clean), not an earlier guard.
    expect(
      calls.filter((c) => c.method === 'GET' && /\/tasks\//.test(c.url)),
    ).toHaveLength(2);
    expect(
      calls.filter((c) => c.method === 'POST' && c.url.endsWith('/events')),
    ).toEqual([]);
  });

  it('SCOPED CONTROL: current review + waiting scoped claim → exactly one start_implementation event, no other write', async () => {
    vi.stubEnv('RUNTIME_BRIDGE_INTENT_ROOTS', ROOT);
    vi.stubEnv('RUNTIME_BRIDGE_INTENT_HELPER', HELPER);
    const row = waitingScopedTask();
    const reviewPath = await writeReview('ok', row);
    const calls: Call[] = [];
    mockTaskStore(calls, row);

    const result = await startReviewed(
      'http://localhost:3009',
      'task-42',
      reviewPath,
    );
    expect(result).toMatchObject({
      taskId: 'task-42',
      event: 'start_implementation',
    });
    const events = calls.filter(
      (c) => c.method === 'POST' && c.url.endsWith('/events'),
    );
    expect(events).toHaveLength(1);
    expect(events[0]?.body).toEqual({ event: 'start_implementation' });
    expect(calls.filter((c) => c.method === 'PUT')).toEqual([]);
  });
});
