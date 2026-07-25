// S1 getff-any-stack-trace — three committed Tier-1 fixtures (spec §4.4, plan §3).
//
// These fixtures are the load-bearing evidence that the S1 ctx-threading (Tasks 3-6) actually
// CHANGES the validator verdict for python consumers — the T-S1-A counter (threading the ctx but
// never asserting it arrived). Each accept fixture runs the SAME provenance URL through:
//
//   (RED)  validateProvenance(p, resolveAllowedSources(undefined))  → Diagnostic (Tier-0-only)
//   (GREEN) validateProvenance(p, resolveAllowedSources(ctx))       → null            (Tier-1 manifest-derived)
//
// The transition proves the admission is BY Tier-1 — a Tier-0 leak (T-AST-A) would pass both,
// proving nothing about the threading. The Tier-0 host list (allowlist.ts) carries NEITHER
// `tiangolo` NOR `sqlalchemy` — re-verified at the top of this file (and at plan entry).
//
// The third fixture (reject) is the negative-correctness counter: with ctx but the dep ABSENT
// from the manifest, the bridge degrades to a research-only finding. Tier-1 must still
// fail-closed when there is no resolved entry — the ctx is a *broadening* of trust, not a blanket
// opening. Detail message names "not a direct dependency" (FF2007).
//
// $0-in-CI: every input is a committed in-source fixture (no network, no LLM). The fake venv
// layouts under `mkdtempSync` are sufficient for pipAdapter — it does not invoke python or pip.

import { describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { resolveCtxForRoot } from './resolve-ctx.ts';
import {
  resolveAllowedSources,
  validateProvenance,
} from '../research/allowlist-resolver.ts';
import {
  researchedPracticeToNode,
  type AstgrepResearchedPractice,
} from './research-to-node.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const TIER0_ALLOWLIST_PATH = join(HERE, '..', 'research', 'allowlist.ts');

// ─── T-AST-A honesty gate (re-verified at test run, not just at plan entry) ───────
// The plan §5 / T-AST-A requires this stays 0 — adding either host to the Tier-0 list would
// void the paired-negative (both verdicts would pass, proving nothing about the threading).
// Read live at test-time: a future edit to allowlist.ts that adds either host flips this RED.
// (No CI-side check exists for this — it lives HERE so the test itself fails closed.)
const TIER0_HOSTS_LEAKED = (() => {
  const text = readFileSync(TIER0_ALLOWLIST_PATH, 'utf8');
  const matches = text.match(/tiangolo|sqlalchemy/gi);
  return matches ? matches.length : 0;
})();

// ─── python consumer-root builder (mirrors ecosystem-python.test.ts makeVenvRoot shape) ───
//
// pipAdapter (ecosystem-python.ts) reads `<root>/.venv/lib/python<X.Y>/site-packages/<pkg-X.Y>.dist-info/METADATA`
// for `Name:` + `Project-URL: Homepage, <url>` + (S1 D7) `Project-URL: Documentation, <url>`. It
// does NOT invoke python — pure file reads. `detectStack` keys off `<root>/pyproject.toml`.
function makePythonConsumerRoot(opts: {
  pyproject: string;
  pythonVersion?: string; // default '3.14'
  distInfos: Record<string, { dirName: string; metadata: string }>;
}): string {
  const root = mkdtempSync(join(tmpdir(), 's1-tier1-consumer-'));
  writeFileSync(join(root, 'pyproject.toml'), opts.pyproject);
  const pyVer = opts.pythonVersion ?? '3.14';
  const sp = join(root, '.venv', 'lib', `python${pyVer}`, 'site-packages');
  mkdirSync(sp, { recursive: true });
  for (const [, info] of Object.entries(opts.distInfos)) {
    const di = join(sp, info.dirName);
    mkdirSync(di, { recursive: true });
    writeFileSync(join(di, 'METADATA'), info.metadata);
  }
  return root;
}

// ─── practice record builders ────────────────────────────────────────────────────
//
// Realistic ast-grep call-kind bans — same shape as the shipped getff-no-yaml-load practice
// (research-to-node.test.ts:26), but with provenance keys that are NOT in the Tier-0 list. The
// `allowlistKey` is set to the package name (the Tier-1 routing convention per S2 kickoff §4);
// `packageName` is the scope-lock right-hand side (validateProvenance uses both for the same-pkg
// check at validateUrlAgainstTiers Tier-1 branch).

const SQLALCHEMY_BANNED_API_PRACTICE: AstgrepResearchedPractice = {
  entryId: 'getff-researched-sqlalchemy-no-raw-text',
  title:
    'Do not pass raw SQL strings to session.execute(text(...)); bind parameters to prevent SQL injection',
  stack: ['python'],
  kind: 'call',
  presence: 'forbid',
  pattern: 'session.execute(text($SQL))',
  examples: {
    bad: 'from sqlalchemy import text\nsession.execute(text(f"SELECT * FROM t WHERE id = {user_id}"))',
    good: 'from sqlalchemy import text\nsession.execute(text("SELECT * FROM t WHERE id = :id"), {"id": user_id})',
  },
  provenance: [
    {
      url: 'https://docs.sqlalchemy.org/en/20/core/sqlelement.html#sqlalchemy.sql.expression.text',
      allowlistKey: 'sqlalchemy', // NOT a Tier-0 key (T-AST-A counter)
      packageName: 'pip:sqlalchemy', // pip ecosystem prefix per research-source-trust.md §4
      fetchedAt: '2026-07-23T00:00:00.000Z',
    },
  ],
};

const FASTAPI_SECURITY_PRACTICE: AstgrepResearchedPractice = {
  entryId: 'getff-researched-fastapi-no-plain-password-oauth',
  title:
    'Do not roll a plaintext-password OAuth2 flow; use OAuth2PasswordBearer + passlib password hashing',
  stack: ['python'],
  kind: 'call',
  presence: 'forbid',
  pattern: 'OAuth2PasswordBearer(tokenUrl=$$$ARGS)',
  examples: {
    bad: 'from fastapi.security import OAuth2PasswordBearer\noauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")  # without passlib hashing',
    good: 'from passlib.context import CryptContext\npwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")',
  },
  provenance: [
    {
      url: 'https://fastapi.tiangolo.com/tutorial/security/simple-oauth2/',
      allowlistKey: 'fastapi', // NOT a Tier-0 key (T-AST-A counter)
      packageName: 'pip:fastapi', // pip ecosystem prefix per research-source-trust.md §4
      fetchedAt: '2026-07-23T00:00:00.000Z',
    },
  ],
};

// ─── accept-D7·a — SQLAlchemy → docs.sqlalchemy.org (admitted at Tier-1) ──────────
describe('accept-D7·a — SQLAlchemy docs host admitted at Tier-1 (D7 Project-URL: Documentation)', () => {
  it('T-AST-A honesty gate: `sqlalchemy` is NOT in the Tier-0 list', () => {
    expect(TIER0_HOSTS_LEAKED, 'T-AST-A violation — `sqlalchemy` or `tiangolo` leaked into the Tier-0 allowlist.').toBe(0);
  });

  it('RED before threading: Tier-0-only ctx REJECTS the SQLAlchemy host', () => {
    const d = validateProvenance(
      SQLALCHEMY_BANNED_API_PRACTICE.provenance[0]!,
      resolveAllowedSources(undefined),
    );
    expect(d, 'Tier-0-only ctx must REJECT docs.sqlalchemy.org (unknown allowlistKey, no Tier-0 host)').not.toBeNull();
    expect(d?.code).toBe('FF2005'); // unknown allowlistKey — Tier-0 miss
  });

  it('GREEN after threading: Tier-1 ctx ADMITS the SQLAlchemy host', () => {
    const root = makePythonConsumerRoot({
      pyproject: `[project]\nname = "consumer"\ndependencies = ["sqlalchemy"]\n`,
      distInfos: {
        sqlalchemy: {
          dirName: 'SQLAlchemy-2.0.30.dist-info',
          // SQLAlchemy's real PyPI metadata: Homepage = homepage, Documentation = docs.sqlalchemy.org
          metadata:
            'Metadata-Version: 2.1\nName: SQLAlchemy\nVersion: 2.0.30\n' +
            'Project-URL: Homepage, https://www.sqlalchemy.org\n' +
            'Project-URL: Documentation, https://docs.sqlalchemy.org\n',
        },
      },
    });
    const ctx = resolveCtxForRoot(root);
    const resolved = resolveAllowedSources(ctx);

    // (1) Admitted by the SSOT validator (mirror the bridge: thread entryPackage so the
    //     Tier-1 branch activates — bridges pass `{ entryPackage: p.packageName }`)
    const prov = SQLALCHEMY_BANNED_API_PRACTICE.provenance[0]!;
    const d = validateProvenance(prov, resolved, { entryPackage: prov.packageName });
    expect(d, 'Tier-1 ctx must ADMIT docs.sqlalchemy.org').toBeNull();

    // (2) The host was derived specifically from the manifest's `documentation` field — D7 contract.
    //     `tier1For` takes the FULL prefixed name (parses internally per research-source-trust.md §4).
    const t1 = resolved.tier1For('pip:sqlalchemy');
    expect(t1.ok).toBe(true);
    if (t1.ok) expect(t1.hosts).toContain('docs.sqlalchemy.org');
  });

  it('T-S1-A counter: bridge end-to-end returns `node` (ctx actually arrived, not signature-only)', () => {
    const root = makePythonConsumerRoot({
      pyproject: `[project]\nname = "consumer"\ndependencies = ["sqlalchemy"]\n`,
      distInfos: {
        sqlalchemy: {
          dirName: 'SQLAlchemy-2.0.30.dist-info',
          metadata:
            'Metadata-Version: 2.1\nName: SQLAlchemy\nVersion: 2.0.30\n' +
            'Project-URL: Documentation, https://docs.sqlalchemy.org\n',
        },
      },
    });
    const ctx = resolveCtxForRoot(root);
    const result = researchedPracticeToNode(SQLALCHEMY_BANNED_API_PRACTICE, ctx);
    expect(result.status).toBe('node');
  });
});

// ─── accept-D7·b — FastAPI → fastapi.tiangolo.com (admitted at Tier-1) ────────────
//
// FastAPI is the load-bearing case for D7: its Homepage is a github.com apex (ineligible — the
// multi-tenant apex guard refuses it, by design). Its `Project-URL: Documentation` is the
// fastapi.tiangolo.com host the umbrella exists to serve. Reading only Homepage yields *no
// eligible host* for exactly this framework (plan §1 D7 rationale, verified 2026-07-23).
describe('accept-D7·b — FastAPI docs host admitted at Tier-1 (D7 sole-eligible-host case)', () => {
  it('RED before threading: Tier-0-only ctx REJECTS the fastapi.tiangolo.com host', () => {
    const d = validateProvenance(
      FASTAPI_SECURITY_PRACTICE.provenance[0]!,
      resolveAllowedSources(undefined),
    );
    expect(d, 'Tier-0-only ctx must REJECT fastapi.tiangolo.com').not.toBeNull();
    expect(d?.code).toBe('FF2005');
  });

  it('GREEN after threading: Tier-1 ctx ADMITS fastapi.tiangolo.com via D7 (Homepage alone yields NOTHING)', () => {
    const root = makePythonConsumerRoot({
      pyproject: `[project]\nname = "consumer"\ndependencies = ["fastapi"]\n`,
      distInfos: {
        fastapi: {
          dirName: 'fastapi-0.111.0.dist-info',
          // FastAPI's real PyPI metadata (verbatim shape): Homepage is github, Documentation is tiangolo
          metadata:
            'Metadata-Version: 2.1\nName: fastapi\nVersion: 0.111.0\n' +
            'Project-URL: Homepage, https://github.com/tiangolo/fastapi\n' +
            'Project-URL: Documentation, https://fastapi.tiangolo.com\n',
        },
      },
    });
    const ctx = resolveCtxForRoot(root);
    const resolved = resolveAllowedSources(ctx);

    // (1) The full URL is admitted — by the SSOT two-arg validator (entryPackage threaded,
    //     mirror of the bridge's `{ entryPackage: p.packageName }` opt).
    const prov = FASTAPI_SECURITY_PRACTICE.provenance[0]!;
    const d = validateProvenance(prov, resolved, { entryPackage: prov.packageName });
    expect(d, 'Tier-1 ctx must ADMIT fastapi.tiangolo.com').toBeNull();

    // (2) D7 is the SOLE source — `Homepage` alone (github.com) yields no eligible host.
    //     This is the concrete shape the D7 contract exists to close (plan §1).
    //     `tier1For` takes the FULL prefixed name (parses internally per research-source-trust.md §4).
    const t1 = resolved.tier1For('pip:fastapi');
    expect(t1.ok).toBe(true);
    if (t1.ok) {
      expect(t1.hosts).toContain('fastapi.tiangolo.com');
      expect(t1.hosts, 'github.com MUST stay ineligible (multi-tenant apex guard UNCHANGED)').not.toContain('github.com');
    }
  });

  it('T-S1-A counter: bridge end-to-end returns `node`', () => {
    const root = makePythonConsumerRoot({
      pyproject: `[project]\nname = "consumer"\ndependencies = ["fastapi"]\n`,
      distInfos: {
        fastapi: {
          dirName: 'fastapi-0.111.0.dist-info',
          metadata:
            'Metadata-Version: 2.1\nName: fastapi\nVersion: 0.111.0\n' +
            'Project-URL: Documentation, https://fastapi.tiangolo.com\n',
        },
      },
    });
    const ctx = resolveCtxForRoot(root);
    const result = researchedPracticeToNode(FASTAPI_SECURITY_PRACTICE, ctx);
    expect(result.status).toBe('node');
  });
});

// ─── reject — dependency absent from manifest → research-only (fail-closed) ──────
//
// Negative-correctness counter: the Tier-1 ctx is a *broadening* of trust, not a blanket opening.
// A package NOT in the consumer's direct deps is still refused — `not a direct dependency`
// (FF2007). The bridge degrades to a research-only finding, NOT an inert node (MAJOR-1 honesty).
describe('reject — dependency absent from manifest degrades to research-only (FF2007)', () => {
  it('Tier-1 ctx REJECTS a host whose package is not a direct dep', () => {
    // pyproject has Flask, NOT sqlalchemy — the SQLAlchemy practice is not a trusted scope
    const root = makePythonConsumerRoot({
      pyproject: `[project]\nname = "consumer"\ndependencies = ["flask"]\n`,
      distInfos: {
        flask: {
          dirName: 'Flask-3.0.3.dist-info',
          metadata:
            'Metadata-Version: 2.1\nName: Flask\nVersion: 3.0.3\n' +
            'Project-URL: Homepage, https://flask.palletsprojects.com\n',
        },
      },
    });
    const ctx = resolveCtxForRoot(root);
    const resolved = resolveAllowedSources(ctx);

    // The validator-level view: the URL is rejected because the package is not a direct dep
    // (mirror the bridge: thread entryPackage so the Tier-1 branch activates and produces
    // the FF2007 not-a-direct-dependency verdict — without entryPackage the validator
    // never reaches the Tier-1 branch and returns FF2005 instead)
    const prov = SQLALCHEMY_BANNED_API_PRACTICE.provenance[0]!;
    const d = validateProvenance(prov, resolved, { entryPackage: prov.packageName });
    expect(d).not.toBeNull();
    expect(d?.code).toBe('FF2007'); // not a direct dependency
  });

  it('bridge degrades the practice to a research-only finding (MAJOR-1 — never an inert node)', () => {
    const root = makePythonConsumerRoot({
      pyproject: `[project]\nname = "consumer"\ndependencies = ["flask"]\n`,
      distInfos: {
        flask: {
          dirName: 'Flask-3.0.3.dist-info',
          metadata:
            'Metadata-Version: 2.1\nName: Flask\nVersion: 3.0.3\n' +
            'Project-URL: Homepage, https://flask.palletsprojects.com\n',
        },
      },
    });
    const ctx = resolveCtxForRoot(root);
    const result = researchedPracticeToNode(SQLALCHEMY_BANNED_API_PRACTICE, ctx);
    expect(result.status).toBe('research-only');
    if (result.status === 'research-only') {
      expect(result.reason).toBe('provenance-rejected');
      expect(result.detail).toMatch(/not a direct dependency/i);
    }
  });
});
