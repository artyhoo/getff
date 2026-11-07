import { describe, it, expect } from 'vitest';
import { spawnSync, type SpawnSyncReturns } from 'node:child_process';
import { resolve, dirname, join } from 'node:path';
import { mkdtempSync, writeFileSync, chmodSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

// Regression suite for issues #1517 + #1518 (W2-F).
//
// #1517: priority-score.sh completion layer C2 consumed dup-detect.sh
// "POTENTIAL_DUPE: ... (basis=xref score=100%)" lines as completion evidence with the
// basis hardcoded to "jaccard" — so an ACTIVE umbrella whose kickoff cites a merged-30d
// PR as PROVENANCE was classified DONE and dropped before ranking. The fix passes the
// true basis through and gates the classification on frontier.sh agreement (a
// non-empty FRONTIER: means the umbrella still has dispatchable stages).
//
// #1518: launch-table-generator.sh accepted first-cell ids only as ([A-D]|[0-9]+);
// real ids are K0/KD/KA/today-hero. The fallback path additionally died silently at
// the `detect_subwaves | sed` pipeline (set -euo pipefail) on zero matches, and the
// primary path exited 0 with an EMPTY skeleton. The fix widens the grammar and makes
// both paths emit a DEGRADE: line + non-zero exit on zero parsed rows.
//
// Fixture pattern per frontier.test.ts: spawnSync against a mkdtempSync orch-home and
// a stub gh (seam MO_GH_BIN), never the network. REPO_ROOT is seamed to the sandbox, so
// the REPO_ROOT-derived helper defaults inside priority-score.sh point at the SANDBOX —
// the real helpers are wired in explicitly via the MO_DUP_DETECT_BIN (C2 source) and
// MO_FRONTIER_BIN (#1517b veto authority) seams, per the kickoff "spawns the real helpers".

// Every C2 case spawns priority-score.sh, which in turn runs dup-detect.sh and frontier.sh:
// ~0.85 s per case alone, but past the vitest 5 s default under a parallel full sweep
// (measured 2026-09-28, macOS: 3 timeouts in `vitest-skills`, 9/9 green run alone).
// SLOW_SHELL_MS is the sibling shell-spawning suites' convention (planner-discovery.test.ts).
const SLOW_SHELL_MS = 30_000;

const HERE = dirname(fileURLToPath(import.meta.url));
// FOUR levels up — same depth as frontier.test.ts (this dir is packages/core/skills/pipeline;
// three levels lands on packages/ and every helper spawn dies with "No such file or directory").
const REPO_ROOT = resolve(HERE, '../../../..');
const HELPERS = resolve(REPO_ROOT, '.claude/skills/pipeline/helpers');
const PRIORITY_SCORE = join(HELPERS, 'priority-score.sh');
const LAUNCH_TABLE = join(HELPERS, 'launch-table-generator.sh');
const DUP_DETECT = join(HELPERS, 'dup-detect.sh');
const FRONTIER = join(HELPERS, 'frontier.sh');

interface MergedPr {
  number: number;
  title: string;
}

// Deterministic gh stub: merged PRs are visible to the dup-detect PR-search query
// (--json number,title) — the xref/jaccard fuel — while their headRefNames never match a
// fixture umbrella name, so completion layer C1 (branch match) stays silent and C2/C3
// carry the classification. --search/--limit/window details are ignored, so
// MO_PR_WINDOW_DAYS cannot change what the stub returns. ARRAY ORDER IS LOAD-BEARING:
// dup-detect iterates the merged array in order and C2 takes the FIRST POTENTIAL_DUPE
// line, so the recorded repro's highest-cited number must come first to reproduce
// done_pr=<highest> (the issue's defect 2: done_pr is "highest PR mentioned").
const DEFAULT_MERGED: MergedPr[] = [
  { number: 1773, title: 'provenance stage ship' },
];

function ghStub(merged: MergedPr[]): string {
  const titled = JSON.stringify(
    merged.map((p) => ({ number: p.number, title: p.title })),
  );
  const branched = JSON.stringify(
    merged.map((p) => ({
      number: p.number,
      headRefName: 'chore/never-matches-a-fixture',
    })),
  );
  return `#!/usr/bin/env bash
# W2-F fixture stub (issues #1517/#1518): deterministic PR sets, no network.
case " $* " in
  *" --state merged "*)
    if [[ " $* " == *" number,title "* ]]; then
      echo '${titled}'
    else
      echo '${branched}'
    fi
    exit 0;;
  *" --state open "*)
    echo '[]'
    exit 0;;
esac
echo '[]'
exit 0
`;
}

interface Fixture {
  root: string;
  ghBin: string;
}

function makeFixture(merged: MergedPr[] = DEFAULT_MERGED): Fixture {
  const root = mkdtempSync(join(tmpdir(), 'w2f-fx-'));
  const ghBin = join(root, 'gh-stub.sh');
  writeFileSync(ghBin, ghStub(merged));
  chmodSync(ghBin, 0o755);
  return { root, ghBin };
}

function kickoff(
  root: string,
  umbrella: string,
  body: string,
  files: Record<string, string> = {},
): void {
  const dir = join(root, 'prompts', umbrella);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'kickoff.md'), body);
  for (const [name, content] of Object.entries(files)) {
    writeFileSync(join(dir, name), content);
  }
}

function runPriorityScore(fx: Fixture): SpawnSyncReturns<string> {
  return spawnSync('bash', [PRIORITY_SCORE], {
    encoding: 'utf8',
    env: {
      ...process.env,
      REPO_ROOT: fx.root,
      MO_ORCH_HOME: join(fx.root, 'prompts'),
      MO_GH_BIN: fx.ghBin,
      MO_PR_WINDOW_DAYS: '30',
      // REPO_ROOT is the sandbox → priority-score.sh's REPO_ROOT-derived helper defaults
      // resolve nowhere; point both sub-helper seams at the REAL repo helpers (#1517's
      // proof must run the true dup-detect signals and the true frontier veto).
      MO_DUP_DETECT_BIN: DUP_DETECT,
      MO_FRONTIER_BIN: FRONTIER,
    },
  });
}

function runLaunchTable(
  fx: Fixture,
  umbrella: string,
): SpawnSyncReturns<string> {
  return spawnSync('bash', [LAUNCH_TABLE, umbrella], {
    encoding: 'utf8',
    env: {
      ...process.env,
      REPO_ROOT: fx.root,
      MO_ORCH_HOME: join(fx.root, 'prompts'),
    },
  });
}

function lineFor(stdout: string, umbrella: string): string {
  return (
    stdout.split('\n').find((l) => l.startsWith(`${umbrella} type=`)) ?? ''
  );
}

describe('#1517 — priority-score C2 completion gate (dup-detect signals are not completion)', { timeout: SLOW_SHELL_MS }, () => {
  it('a provenance-cited merged PR plus an open stage stays ACTIVE (frontier veto)', () => {
    const fx = makeFixture();
    // Prose citation of the merged PR (the exact #1517 repro shape — dup-detect Signal 1
    // xref-scans the WHOLE kickoff) plus a stage table whose S2 is still dispatchable,
    // so real frontier.sh emits a non-empty FRONTIER: S2.
    kickoff(
      fx.root,
      'fx-prov-open',
      [
        '# fx-prov-open',
        '',
        'Stage S1 landed via #1773 (recorded here as provenance).',
        '',
        '| Stage | Deliverable |',
        '| --- | --- |',
        '| S1 | landing MERGED #1773 |',
        '| S2 | open follow-up work |',
        '',
      ].join('\n'),
    );

    const r = runPriorityScore(fx);
    expect(r.status).toBe(0);
    const line = lineFor(r.stdout ?? '', 'fx-prov-open');
    expect(line).toContain('fx-prov-open type=');
    expect(line).toContain('kickoff=exists');
    // The defect: this line carried `status=DONE done_pr=1773 basis=jaccard score=100%`
    // because the C2 layer treated the xref overlap as completion.
    expect(line).not.toMatch(/status=DONE/);
  });

  it('an xref used AS completion evidence still classifies DONE — with the true basis name', () => {
    const fx = makeFixture();
    // Only stage is MERGED with the PR adjacent → frontier.sh emits FRONTIER: (none) →
    // no veto → C2 classifies DONE, and the basis must name what dup-detect actually
    // matched (xref), not the hardcoded jaccard.
    kickoff(
      fx.root,
      'fx-xref-done',
      [
        '# fx-xref-done',
        '',
        'All stages landed (#1773).',
        '',
        '| Stage | Deliverable |',
        '| --- | --- |',
        '| S1 | shipped MERGED #1773 |',
        '',
      ].join('\n'),
    );

    const r = runPriorityScore(fx);
    expect(r.status).toBe(0);
    const line = lineFor(r.stdout ?? '', 'fx-xref-done');
    expect(line).toMatch(/status=DONE done_pr=1773 /);
    expect(line).toMatch(/basis=xref/);
    // Falsifier: a C2-sourced DONE reading `basis=jaccard` while the dup-detect line
    // says `basis=xref` means the pass-through is not implemented.
    expect(line).not.toMatch(/basis=jaccard/);
  });

  it('a completion-bearing done.md (`Final PR: #N`) still classifies DONE (no over-correction)', () => {
    const fx = makeFixture();
    kickoff(fx.root, 'fx-done-md', '# fx-done-md\n\nwork completed\n', {
      'done.md': '- Status: complete\n- Final PR: #1802\n',
    });

    const r = runPriorityScore(fx);
    expect(r.status).toBe(0);
    const line = lineFor(r.stdout ?? '', 'fx-done-md');
    expect(line).toMatch(/status=DONE done_pr=1802 basis=done-md/);
  });

  it('a completion-bearing KICKOFF-BODY line (`Final PR: #N`) overrides the frontier veto (kickoff §5 falsifier)', () => {
    // The §5 falsifier the done.md test above could not reach: there the kickoff body has
    // no `#N`, so C2 never fires and the test passes with or without the frontier veto.
    // HERE the merged PR is cited on a `Final PR: #1773` line IN THE BODY — dup-detect's
    // Signal-1 xref scan hits it, C2 extracts done_pr=1773, and real frontier.sh sees the
    // two open stage rows (no MERGED markers) and emits a non-empty `FRONTIER:` — the
    // exact shape the un-exempted veto over-corrects to ACTIVE. The completion-bearing
    // exemption (a `Final PR:`/`Closed by:`/`Completed by:` line citing the SAME #N)
    // must keep this DONE. Pre-exemption helpers print the ACTIVE line (no status=DONE)
    // and this assertion fails.
    const fx = makeFixture();
    kickoff(
      fx.root,
      'fx-finalpr-open-table',
      [
        '# fx-finalpr-open-table',
        '',
        'Final PR: #1773',
        '',
        '| Stage | Deliverable |',
        '| --- | --- |',
        '| S1 | wiring work |',
        '| S2 | follow-up work |',
        '',
      ].join('\n'),
    );

    const r = runPriorityScore(fx);
    expect(r.status).toBe(0);
    const line = lineFor(r.stdout ?? '', 'fx-finalpr-open-table');
    expect(line).toMatch(/status=DONE done_pr=1773 /);
    expect(line).toMatch(/basis=xref/);
  });
});

// Carried item from the W2-F plan: the third umbrella named in #1517. The issue was filed
// from a CONSUMER (`timeliner`; repo unreachable, API 404), so the umbrella itself —
// `app-finalization` — cannot be run live from this repo. Its recorded repro (issue body +
// the 2026-09-14 verification comment) IS the live evidence, so it is reconstructed here
// field-for-field; a manual run against the pre-fix helpers (e4395fdf) printed the recorded
// line byte-for-byte (see the PR body's carried-item section for that run).
describe('#1517 carried item — the third umbrella (`app-finalization`, consumer `timeliner`)', { timeout: SLOW_SHELL_MS }, () => {
  // 14 header/table lines + 762 inert padding lines = 776 — the recorded `loc=776` (→
  // volume=L). Padding carries no `#N`, no leading `|`, no MERGED/date markers: it inflates
  // nothing the classifier reads. The recorded classification-visible facts all present:
  // `> **Type:** umbrella` (no bucket → type=unknown), a dated freeze, the
  // frontier-required `| KH | … MERGED #352 |` bookkeeping spelling, ONE open stage (KX —
  // real frontier.sh emits `FRONTIER: KX` on this fixture), and the highest cite #353 in
  // prose as provenance (the C2 fuel; #353 first in the stub → recorded done_pr=353).
  function appFinalizationKickoff(): string {
    const header = [
      '# app-finalization',
      '',
      '> **Type:** umbrella',
      '> **Freeze:** 2026-09-10 -- scope locked for the consumer-report window',
      '',
      '## Context',
      'Stage KH landed via #352. Final wiring shipped via #353 -- cited here as provenance while the follow-up stage stays open.',
      '',
      '| Stage | Deliverable | Depends on |',
      '| --- | --- | --- |',
      '| KH | report wiring MERGED #352 | - |',
      '| KX | open follow-up wiring | KH |',
      '',
      '## Notes',
    ];
    const pad = Array.from(
      { length: 762 },
      (_, i) => `- background context line ${i + 1}.`,
    );
    return [...header, ...pad].join('\n') + '\n';
  }

  it('the recorded consumer repro (provenance cites + a MERGED stage row + one open stage) stays ACTIVE', () => {
    const fx = makeFixture([
      { number: 353, title: 'final wiring ship' },
      { number: 352, title: 'stage KH report' },
    ]);
    kickoff(fx.root, 'app-finalization', appFinalizationKickoff());

    const r = runPriorityScore(fx);
    expect(r.status).toBe(0);
    const line = lineFor(r.stdout ?? '', 'app-finalization');
    // Byte-fidelity to the recorded line MINUS the DONE tail the fix removes. Pre-fix
    // helpers print exactly:
    //   app-finalization type=unknown kickoff=exists volume=L open_prs=0 loc=776 status=DONE done_pr=353 basis=jaccard score=100%
    // (manual RED run on the e4395fdf helpers — byte-identical to the issue's recording).
    expect(line).toBe(
      'app-finalization type=unknown kickoff=exists volume=L open_prs=0 loc=776',
    );
  });
});

describe('#1518 — launch-table-generator stage-id grammar + loud degrade', { timeout: SLOW_SHELL_MS }, () => {
  it('parses K0/KD/today-hero from a fallback (keyword-filter) table and exits 0', () => {
    const fx = makeFixture();
    kickoff(
      fx.root,
      'fx-launch-fallback',
      [
        '# fx-launch-fallback',
        '',
        '| Sub-wave | Scope | Mode | W1 | W2 | W3 | W4 |',
        '| --- | --- | --- | --- | --- | --- | --- |',
        '| K0 | R-phase recon | Mode A | - | - | - | - |',
        '| KD | execution wiring | Mode B | - | - | - | - |',
        '| today-hero | I-phase build | Direct Edit | - | - | - | - |',
        '| A | R-phase recon | Mode A | - | - | - | - |',
        '| 1 | execution wiring | Mode B | - | - | - | - |',
        '',
      ].join('\n'),
    );

    const r = runLaunchTable(fx, 'fx-launch-fallback');
    expect(r.status).toBe(0);
    const out = r.stdout ?? '';
    expect(out).toContain('sub-wave: K0');
    expect(out).toContain('sub-wave: KD');
    expect(out).toContain('sub-wave: today-hero');
    // Legacy shapes must keep parsing (falsifier: "a plain A-D table stops parsing").
    expect(out).toContain('sub-wave: A');
    expect(out).toContain('sub-wave: 1');
    expect(out).toContain('| K0 | ? |');
    // The widened grammar must not admit the header row itself as an id.
    expect(out).not.toContain('sub-wave: Sub-wave');
  });

  it('parses K ids under a `## §N Sub-wave` heading (primary path) and exits 0', () => {
    const fx = makeFixture();
    kickoff(
      fx.root,
      'fx-launch-primary',
      [
        '# fx-launch-primary',
        '',
        '## §2 Sub-wave decomposition',
        '',
        '| Sub-wave | Scope | Mode | W1 | W2 | W3 | W4 |',
        '| --- | --- | --- | --- | --- | --- | --- |',
        '| K0 | R-phase recon | Mode A | - | - | - | - |',
        '| KA | execution wiring | Mode B | - | - | - | - |',
        '| today-hero | I-phase build | Direct Edit | - | - | - | - |',
        '| A | R-phase recon | Mode A | - | - | - | - |',
        '',
      ].join('\n'),
    );

    const r = runLaunchTable(fx, 'fx-launch-primary');
    expect(r.status).toBe(0);
    const out = r.stdout ?? '';
    expect(out).toContain('sub-wave: K0');
    expect(out).toContain('sub-wave: KA');
    expect(out).toContain('sub-wave: today-hero');
    expect(out).toContain('| KA | ? |');
    // Pre-fix this path exited 0 with an EMPTY skeleton (real instance:
    // adapter-jig-meta-launch) — the skeleton must now carry the parsed rows.
    expect(out).toMatch(/\| [A-Za-z][A-Za-z0-9-]* \| \? \|/);
  });

  it('emits DEGRADE: and exits non-zero when the primary path parses zero rows', () => {
    const fx = makeFixture();
    kickoff(
      fx.root,
      'fx-launch-broken-primary',
      [
        '# fx-launch-broken-primary',
        '',
        '## §2 Sub-wave decomposition',
        '',
        '| Sub-wave | Scope | Mode |',
        '| --- | --- | --- |',
        '| W.1 | R-phase recon | Mode A |',
        '| W.2 | execution wiring | Mode B |',
        '',
      ].join('\n'),
    );

    const r = runLaunchTable(fx, 'fx-launch-broken-primary');
    expect(
      r.status,
      `expected non-zero exit, got ${r.status}; stdout:\n${r.stdout}`,
    ).not.toBe(0);
    expect(r.stdout ?? '').toContain('DEGRADE:');
  });

  it('emits DEGRADE: and exits non-zero when the fallback path parses zero rows', () => {
    const fx = makeFixture();
    // No Sub-wave heading, no keyword-bearing table rows — the pre-fix kill site
    // (`detect_subwaves | sed` under set -euo pipefail) died here with NO DEGRADE line.
    kickoff(
      fx.root,
      'fx-launch-broken-fallback',
      '# fx-launch-broken-fallback\n\nProse only, no table rows at all.\n',
    );

    const r = runLaunchTable(fx, 'fx-launch-broken-fallback');
    expect(
      r.status,
      `expected non-zero exit, got ${r.status}; stdout:\n${r.stdout}`,
    ).not.toBe(0);
    expect(r.stdout ?? '').toContain('DEGRADE:');
    expect(r.stdout ?? '').not.toContain('MISSING kickoff');
  });
});
