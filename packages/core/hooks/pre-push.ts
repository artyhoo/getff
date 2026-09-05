/**
 * pre-push.ts — TS-core pre-push orchestrator (Wave 10.1 / 10.2).
 *
 * Invoked by the 10-line `.husky/pre-push` dispatcher via
 * `node --import tsx/esm packages/core/hooks/pre-push.ts`. Replaces the bash
 * body of the former 476-line hook. Every "pure delegation" section (§3.1
 * OWN-BUILD classification) runs through the single tested `runCheck()` helper
 * (utils/run-check.ts), which is the Aider-derived abstraction adopted in
 * research patch §4.8.X.1 — turning previously un-unit-tested `execSync`
 * shell-outs into thin, individually-tested call sites (closes C3 for the
 * delegation sections).
 *
 * Both trailer checks are now TS-native: §7 Prior-art → `checks/prior-art.ts`
 * (Wave 10.2), §1.7 discipline trailer → `checks/s17.ts` (Wave 10.3), both over
 * `utils/git.ts`. The former bash shim (`legacy-trailer-checks.sh`) is deleted;
 * no bash trailer logic remains.
 *
 * Behaviour parity with the former bash hook is byte-faithful for the delegation
 * sections; documented deviations:
 *   - actionlint is invoked with an explicit, fs-resolved `.github/workflows/*.yml`
 *     list (vs shell glob) — equivalent set, and empty-dir is skipped rather than
 *     passing a literal unmatched glob.
 *   - section output is captured and re-emitted after each check rather than
 *     streamed live (acceptable for sub-second checks).
 */
import {
  existsSync,
  readdirSync,
  readFileSync,
  realpathSync,
  statSync,
} from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
// NOTE: this file ships verbatim into consumer projects (install.sh:929-938), so a
// static bare-package import of anything outside the consumer's tree crashes the hook
// with ERR_MODULE_NOT_FOUND *before any gate runs* (#735/#636). `picomatch` used to be
// imported here for the arch-v2 S-E P2b local-shadow section; that section was removed
// (its premise was disproven — see the removal commit), and with it the only reason this
// hook referenced picomatch. Keep it that way: a new dependency here needs the ship-list
// treatment or a lazy `await import()` + `die()`, the shape guard-liveness uses below.
import { runCheck, type CheckResult } from './utils/run-check.ts';
import { runPriorArtCheck, loadSsotIds } from './checks/prior-art.ts';
import { runS17Check } from './checks/s17.ts';
import {
  checkUnpinnedToolInstalls,
  isShellScriptPopulationFile,
} from './checks/unpinned-tool-install.ts';
// NOTE: checks/guard-liveness.ts is intentionally NOT imported statically — see
// guardLivenessSection. Its import chain (eslint → @typescript-eslint/parser →
// core+preset plugins → @typescript-eslint/utils) only resolves after a
// root-level workspace install, and this orchestrator must stay loadable in
// ESLint-stack-free topologies (CI principles job installs packages/core only).
import {
  getCommits,
  getChangedFiles,
  upstreamExists,
  resolveDefaultBase,
  realGit,
  parsePushRefs,
  commitsNotOnRemotes,
  Z40,
} from './utils/git.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
// packages/core/hooks → repo root
const REPO_ROOT = resolve(HERE, '../../..');
const CORE = resolve(REPO_ROOT, 'packages/core');

const run = (cmd: string, args: readonly string[] = []): CheckResult =>
  runCheck(cmd, args, { cwd: REPO_ROOT });

/**
 * The empty-tree object SHA — a tree-ish that exists in every repo. Used as the
 * diff base for a root push (a brand-new branch whose oldest new commit has no
 * parent) so `git diff <EMPTY_TREE>..HEAD` enumerates every file.
 */
const EMPTY_TREE = '4b825dc642cb6eb9a060e54bf8d69288fbee4904';

/** Read git's pre-push stdin (the ref lines), or '' when none is piped. */
function readPushStdin(): string {
  // Only read when fd 0 is NOT a tty — git pipes the ref lines on a push and
  // closes the pipe (EOF), but an interactive `node pre-push.ts` would block on
  // a tty read. Defensive: any read error degrades to "no stdin".
  if (process.stdin.isTTY) return '';
  try {
    return readFileSync(0, 'utf8');
  } catch {
    return '';
  }
}

/**
 * The base the trailer checks diff against, resolved without guessing a trunk
 * name. Replaces the former hard-coded `origin/staging` default (which silently
 * no-op'd on any consumer repo lacking a `staging` branch — see the
 * hook-base-ref-detection research patch). Precedence:
 *
 *   1. `PREPUSH_UPSTREAM_REF` env — the CI backstop's full-PR base
 *      (`origin/${github.base_ref}`); also a manual local override.
 *   2. git pre-push **stdin** `remote_sha` — the canonical, trunk-agnostic
 *      signal (what HEAD is actually being pushed against). For a new branch
 *      (`remote_sha` == {@link Z40}) the checked set is "commits not on any
 *      remote" (ADAPT of pre-commit's stdin handling).
 *   3. the derived default branch (origin/HEAD → origin/staging|main|master),
 *      *only if one exists* (GH #568, via {@link resolveDefaultBase}); else a
 *      visible warning + skip.
 *
 * Returns `{ base: null, commits: null }` when nothing resolves — callers emit a
 * VISIBLE warning and skip, never a silent pass (research-patch finding F2).
 */
interface ResolvedBase {
  /** Tree-ish for `<base>..<head>` changed-file diffs; null when unresolvable. */
  base: string | null;
  /**
   * The diff/range endpoint — what the push range runs *to*. The pushed ref's
   * `local_sha` on a real `git push` (so the range follows the branch being
   * pushed, even when the checkout's HEAD is on a different branch — the
   * 2026-06-17 cross-checkout incident); `HEAD` for a manual run / CI backstop
   * where the checkout IS the thing being checked.
   */
  head: string;
  /** Explicit commit list (new-branch Z40 case); null = derive from `base..head`. */
  commits: string[] | null;
  /**
   * Ref whose reachable commits are EXEMPT from the commit-scoped trailer gates
   * (`rev-list base..head --not <exclude>`) — the resolved trunk, or null when
   * none resolves. The merge-forward range fix (2026-08-07): a published PR
   * branch that merged the base in (git-conflict-merge-forward.md §2) must not
   * be gated on the trunk's own squash commits — those were already gated at
   * their own push or by the server-side PR-body gate (#1098) at merge. Set on
   * the env + stdin paths; the default path's base IS the trunk (no-op) and the
   * Z40 path's `--not --remotes` is a superset, so both stay null.
   */
  exclude: string | null;
  source: 'env' | 'stdin' | 'stdin-new-branch' | 'default' | 'unresolved';
}

function resolveBase(): ResolvedBase {
  const env = process.env['PREPUSH_UPSTREAM_REF'];
  // CI backstop / manual override: HEAD is the thing being checked against the
  // override base (the CI job checks out the PR head), so the endpoint is HEAD.
  // Trunk exclusion applies here too (no-op when the override IS the trunk;
  // fixes the same merge-forward sweep for an epic-based PR range in CI).
  if (env)
    return {
      base: env,
      commits: null,
      head: 'HEAD',
      exclude: resolveDefaultBase(),
      source: 'env',
    };

  const refs = parsePushRefs(readPushStdin());
  if (refs.length > 0) {
    const r = refs[0];
    // `^{commit}` peels to a commit object — parity with the fallback's check,
    // and rejects a tag sha (which would not be a valid `..head` diff base).
    if (r.remoteSha !== Z40 && upstreamExists(`${r.remoteSha}^{commit}`)) {
      // Range endpoint is the PUSHED ref's local_sha, NOT HEAD: pushing `feat`
      // from a checkout on `staging` must validate feat's commits, not staging's.
      // `exclude` scopes the trailer gates to commits this push actually
      // introduces to the trunk lineage (merge-forward range fix, 2026-08-07).
      return {
        base: r.remoteSha,
        commits: null,
        head: r.localSha,
        exclude: resolveDefaultBase(),
        source: 'stdin',
      };
    }
    // New branch (Z40) or an unknown remote sha → the commits this push adds.
    const newCommits = commitsNotOnRemotes(r.localSha);
    const oldest = newCommits[newCommits.length - 1];
    const base =
      oldest && upstreamExists(`${oldest}^`) ? `${oldest}^` : EMPTY_TREE;
    // `commits` is explicit here; `head` still set to local_sha so the §6/§8
    // changed-file diffs (which derive from `base..head`) follow the pushed ref.
    return {
      base,
      commits: newCommits,
      head: r.localSha,
      exclude: null,
      source: 'stdin-new-branch',
    };
  }

  // No env, no stdin (a manual `node pre-push.ts` run): derive the consumer's REAL
  // default branch instead of hard-coding origin/staging (GH #568) — announce via
  // source:'default', never silently skip. Endpoint is HEAD (no pushed ref to follow).
  const def = resolveDefaultBase();
  if (def) {
    return {
      base: def,
      commits: null,
      head: 'HEAD',
      exclude: null,
      source: 'default',
    };
  }
  return {
    base: null,
    commits: null,
    head: 'HEAD',
    exclude: null,
    source: 'unresolved',
  };
}

/** Emit a visible (non-silent) warning that a section is being skipped. */
function warnSkip(label: string, why: string): void {
  process.stdout.write(
    `⚠ pre-push ${label}: could not determine a base ref (${why}) — skipping this check.\n` +
      '  Not a silent pass: set PREPUSH_UPSTREAM_REF, or push so git supplies the base on stdin.\n',
  );
}

/**
 * The commits a section must check, or null (already warned) when the base is
 * unresolvable / missing. New-branch pushes carry an explicit commit list; every
 * other case derives `<base>..HEAD`.
 */
function commitsToCheck(rb: ResolvedBase, label: string): string[] | null {
  if (rb.commits !== null) return rb.commits;
  if (rb.base === null) {
    warnSkip(label, 'no PREPUSH_UPSTREAM_REF, no git stdin, no default branch');
    return null;
  }
  if (!upstreamExists(rb.base)) {
    warnSkip(label, `base ref '${rb.base}' not found`);
    return null;
  }
  return getCommits(rb.base, rb.head, rb.exclude ?? undefined);
}

/** Re-emit a captured result's output to the operator. */
function emit(r: CheckResult): void {
  if (r.stdout) process.stdout.write(r.stdout);
  if (r.stderr) process.stderr.write(r.stderr);
}

/** Print message (+ optional captured output) and abort the push. */
function die(msg: string, r?: CheckResult): never {
  process.stderr.write(`${msg}\n`);
  if (r) emit(r);
  process.exit(1);
}

function workflowYmlFiles(): string[] {
  const dir = resolve(REPO_ROOT, '.github/workflows');
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.yml'))
    .map((f) => `.github/workflows/${f}`);
}

/**
 * Git-tracked executable shell scripts — the second population of the
 * unpinned-tool-install gate (ci-tool-pinning.md §2, scope widening
 * 2026-07-10). Tracked-only (`git ls-files`) so vendored/ignored scripts never
 * gate a push; the population predicate lives in checks/unpinned-tool-install.ts
 * (unit-tested paired-negative — `setup.d/companions.manifest` is data, not a
 * script, and is excluded by construction).
 */
function shellScriptFiles(): string[] {
  // -z: NUL-delimited, unquoted — non-ASCII paths would otherwise arrive
  // quoted+escaped and break the extension match (cold-review m2).
  const r = run('git', ['ls-files', '-z']);
  if (r.exitCode !== 0) return [];
  return r.stdout
    .split('\0')
    .filter((l) => l.length > 0 && isShellScriptPopulationFile(l));
}

/**
 * A required external binary check: missing → install hint + fail.
 * `failHint` (optional) is appended to the abort output when the tool ran but
 * reported problems (exitCode !== 0) — used to hand the operator a concrete
 * remediation path. Callers that omit it keep the original behaviour verbatim.
 * TOOL ABSENCE IS ALWAYS FAIL-CLOSED (ledger B-2, 2026-09-06). The #923 follow-up
 * once carried a second `'warn-skip'` policy here, for the consumer layout: a missing
 * OPTIONAL workflow-security scanner had to DEGRADE loudly rather than DoS a
 * consumer's push. The S3 owner-split made that policy unreachable — the only two
 * callers (actionlint, zizmor-live) are `owner: 'maintainer'`, so they are never
 * composed on a consumer layout at all (SECTIONS below), and the framework layout
 * only ever selected `'die'`. The dead parameter + branch are removed rather than
 * left as a comment promising behaviour the code cannot produce
 * (`.claude/rules/attention-is-not-a-mechanism.md` §2 `#warning-nobody-reads`).
 * The consumer-degrade guarantee itself is UNCHANGED and now rests on ONE mechanism:
 * owner composition. A future `owner: 'both'`/`'consumer'` section that needs an
 * optional binary must degrade in its own body (the `⚠ DEGRADED:` idiom used by
 * §8 lychee and generatedRuleMaterialSection), not by re-adding a policy flag.
 */
function requireTool(
  cmd: string,
  args: readonly string[],
  installHint: string,
  failHint?: string,
): void {
  const r = run(cmd, args);
  if (r.notFound) {
    die(`❌ ${cmd} not found in PATH.\n${installHint}`);
  }
  if (r.exitCode !== 0) {
    if (failHint) {
      // Emit the tool's findings first, then the remediation hint, then abort.
      emit(r);
      die(`\n${failHint}`);
    }
    die(`❌ ${cmd} reported problems:`, r);
  }
  emit(r);
}

/**
 * Is a warn-only downgrade EXPLICITLY opted into?
 *
 * Ledger D-3. The trailer gates used to read `(process.env[X] ?? 'false') !== 'false'`,
 * which downgrades the gate for ANY value that is not the literal string `false` —
 * `0`, `no`, `off`, and (the realistic one) the empty string a workflow `env:` block
 * produces when it maps a repo variable that does not exist. An operator writing
 * `PA_SUBSTANCE_WARN_ONLY=0` to KEEP enforcement silently disabled it instead.
 *
 * The documented contract in every message these gates print is `=true`, so the parse
 * now matches the contract: only an affirmative value opts in, everything else —
 * including an empty or malformed one — keeps the ENFORCING default. Unset ⇒ enforcing.
 * Deliberately fail-closed: an unrecognised value must never be the lenient branch.
 */
function envWarnOnly(name: string): boolean {
  const raw = (process.env[name] ?? '').trim().toLowerCase();
  return raw === 'true' || raw === '1' || raw === 'yes' || raw === 'on';
}

/**
 * §7 Prior-art trailer check. Extracted so it can run in isolation (PREPUSH_ONLY)
 * — the anti-tautology end-to-end test exercises only this section and must not
 * depend on the other sections' tools/deps.
 */
/** Path (repo-relative) of the Prior-art SSOT register, read per-commit below. */
const SSOT_REL = 'docs/meta-factory/prior-art-evaluations.md';

/**
 * The SSOT register's entry id-set **as it existed in `sha`'s tree**, for the C1
 * broken-citation arm. Reads `git show <sha>:<SSOT_REL>` (via the GitProvider) so
 * a citation is checked against the same commit it lives in — not the working
 * tree of whatever branch is checked out, which may be dirty or a different
 * branch entirely (the 2026-06-17 incident: a commit citing #124 was flagged
 * broken because the working-tree SSOT had #124 removed). SSOT absent/unreadable
 * at that commit → undefined → existence check is a graceful no-op for it.
 */
function ssotIdsAt(sha: string): ReadonlySet<number> | undefined {
  const content = realGit.fileContent(sha, SSOT_REL);
  return content === null ? undefined : loadSsotIds(content);
}

function priorArtSection(rb: ResolvedBase): void {
  const commits = commitsToCheck(rb, '§7');
  if (commits === null) return;
  // Enforcing by default since 2026-07-25 (handoff item 4): the wave-8 retro
  // promised BOTH substance arms auto-flip at the 2026-06-10 calibration close,
  // but only the S17 arm (s17Section below) flipped — the asymmetry produced a
  // live doc error (fixed in #1144). The server-side pr-body gate stays the
  // backstop; this restores the earlier local channel per the
  // earliest-reachable-channel invariant. PA_SUBSTANCE_WARN_ONLY=true is the
  // explicit local opt-in downgrade, mirroring S17_SUBSTANCE_WARN_ONLY.
  const substanceWarnOnly = envWarnOnly('PA_SUBSTANCE_WARN_ONLY');
  const report = runPriorArtCheck(commits, realGit, undefined, ssotIdsAt);

  if (report.failures.length > 0) {
    process.stdout.write(
      '\n❌ Prior-art trailer missing or invalid on capability commit(s):\n',
    );
    for (const f of report.failures) {
      process.stdout.write(`  ${f.sha}  reason: ${f.reason}; ${f.message}\n`);
    }
    process.stdout.write(
      '\nFix: amend the commit body to include a `Prior-art:` line per CONTRIBUTING.md.\n' +
        'Examples:\n' +
        '  Prior-art: prior-art-evaluations.md#1 (Autogrep, verdict DEFER — different domain).\n' +
        '  Prior-art: skipped — refactor only, no new capability\n\n' +
        'Rules: ≥20 chars after "Prior-art:" (or after "skipped — "); placeholder\n' +
        'rationales (TODO / later / n/a / tbd / fixme / placeholder) are rejected.\n\n',
    );
    process.exit(1);
  }

  if (report.brokenCitations.length > 0) {
    process.stdout.write(
      '\n❌ Prior-art trailer cites a non-existent SSOT entry (C1 existence check):\n',
    );
    for (const f of report.brokenCitations) {
      process.stdout.write(`  ${f.sha}  reason: ${f.reason}; ${f.message}\n`);
    }
    process.stdout.write(
      '\nFix: cite an entry that exists in docs/meta-factory/prior-art-evaluations.md,\n' +
        'or add the entry to the SSOT in the same commit (per CLAUDE.md build-vs-reuse).\n' +
        'Verify: grep -nE "^\\| *<N> *\\|" docs/meta-factory/prior-art-evaluations.md\n\n',
    );
    process.exit(1);
  }

  if (report.substanceFailures.length > 0) {
    if (substanceWarnOnly) {
      process.stdout.write(
        '\n⚠ Prior-art: escape-hatch on capability commit (substance arm, Wave 8.4):\n',
      );
      for (const f of report.substanceFailures) {
        process.stdout.write(`  ${f.sha}  reason: ${f.reason}; ${f.message}\n`);
      }
      process.stdout.write(
        '\nWarn-only via explicit PA_SUBSTANCE_WARN_ONLY=true (enforcing is the default since 2026-07-25).\n' +
          'Fix: replace `Prior-art: skipped — …` with `Prior-art: prior-art-evaluations.md#N (verdict X — rationale)`.\n\n',
      );
    } else {
      process.stdout.write(
        '\n❌ Prior-art: escape-hatch on capability commit:\n',
      );
      for (const f of report.substanceFailures) {
        process.stdout.write(`  ${f.sha}  reason: ${f.reason}; ${f.message}\n`);
      }
      process.stdout.write(
        '\nA capability commit must cite the SSOT, not take the escape hatch:\n' +
          '  Prior-art: prior-art-evaluations.md#N (verdict X — rationale)\n' +
          'Enforcing by default since 2026-07-25; PA_SUBSTANCE_WARN_ONLY=true downgrades locally.\n\n',
      );
      process.exit(1);
    }
  }
}

/**
 * §1.7 discipline-trailer check. TS-native since Wave 10.3 (ported from the
 * deleted legacy-trailer-checks.sh s17_* functions). Both arms enforce
 * (blocking) by default since 2026-05-21 (flipped early per maintainer
 * directive; was warn-only during the D1 calibration window). Set
 * S17_WARN_ONLY=true / S17_SUBSTANCE_WARN_ONLY=true for a local opt-in downgrade.
 */
function s17Section(rb: ResolvedBase): void {
  const commits = commitsToCheck(rb, '§1.7');
  if (commits === null) return;
  const warnOnly = envWarnOnly('S17_WARN_ONLY');
  const substanceWarnOnly = envWarnOnly('S17_SUBSTANCE_WARN_ONLY');
  const report = runS17Check(commits, realGit);

  if (report.failures.length > 0) {
    if (warnOnly) {
      process.stdout.write(
        '\n⚠ §1.7 trailer missing or invalid on rule-introducing commit(s):\n',
      );
      for (const f of report.failures)
        process.stdout.write(`  ${f.sha}  ${f.message}\n`);
      process.stdout.write(
        '\nLocal downgrade active (S17_WARN_ONLY=true); the default is enforcing.\n' +
          'Fix: add `§1.7: forward-check applied — …; backward-check sweep — …` to commit body.\n\n',
      );
    } else {
      process.stdout.write(
        '\n❌ §1.7 trailer missing or invalid on rule-introducing commit(s):\n',
      );
      for (const f of report.failures)
        process.stdout.write(`  ${f.sha}  ${f.message}\n`);
      process.stdout.write(
        '\nFix: add `§1.7: forward-check applied — …; backward-check sweep — …` to commit body.\n' +
          'Bootstrap exemption: `§1.7 Bootstrap: <reason>` (≥20 chars rationale).\n\n',
      );
      process.exit(1);
    }
  }

  if (report.substanceFailures.length > 0) {
    if (substanceWarnOnly) {
      process.stdout.write(
        '\n⚠ §1.7 trailer lacks file:line citation on rule-introducing commit(s) (substance arm — Wave 8.3):\n',
      );
      for (const f of report.substanceFailures)
        process.stdout.write(`  ${f.sha}  ${f.message}\n`);
      process.stdout.write(
        '\nLocal downgrade active (S17_SUBSTANCE_WARN_ONLY=true); the default is enforcing.\n' +
          'Fix: include ≥1 file:line citation, e.g. `packages/core/principles/02.test.ts:82`.\n\n',
      );
    } else {
      process.stdout.write(
        '\n❌ §1.7 trailer lacks file:line citation on rule-introducing commit(s) (substance arm — Wave 8.3):\n',
      );
      for (const f of report.substanceFailures)
        process.stdout.write(`  ${f.sha}  ${f.message}\n`);
      process.stdout.write(
        '\nFix: include ≥1 file:line citation, e.g. `packages/core/principles/02.test.ts:82`.\n' +
          'Bootstrap exemption: `§1.7 Bootstrap: <reason>` (≥20 chars rationale).\n\n',
      );
      process.exit(1);
    }
  }
}

/**
 * Guard-liveness section: change-scoped ESLint roundtrip gate.
 * For each ESLint manifest rule changed in this push, proves that every
 * negative-test.input entry trips the rule and examples.good stays clean.
 * Lives beside §7 (prior-art) and §1.7 (s17) in the base-scoped gate family.
 */
async function guardLivenessSection(rb: ResolvedBase): Promise<void> {
  if (rb.base === null) {
    warnSkip(
      'guard-liveness',
      'no resolvable base for change-scoped liveness diff',
    );
    return;
  }
  // Lazy-load the gate: keeps PREPUSH_ONLY=prior-art / =s17 seams and the CI
  // principles job (packages/core-only install) free of the ESLint stack. A
  // resolution failure here is a loud die, never a silent pass — the gate only
  // loads on the path where it must actually run.
  let gate: typeof import('./checks/guard-liveness.ts');
  try {
    gate = await import('./checks/guard-liveness.ts');
  } catch (err) {
    die(
      '❌ guard-liveness: failed to load the ESLint stack — the gate requires a\n' +
        '   root-level workspace install (run `npm install` at the repo root).\n' +
        `   ${(err as Error).message}`,
    );
  }
  const report = gate.runGuardLivenessGate(rb.base);

  for (const s of report.skipped) {
    process.stdout.write(`ℹ guard-liveness: SKIP ${s}\n`);
  }
  for (const id of report.noData) {
    process.stdout.write(
      `⚠ guard-liveness: ${id} has no negative-test data — add negative-test.input to enable liveness check\n`,
    );
  }

  if (report.failures.length === 0) {
    if (report.passed.length > 0) {
      process.stdout.write(
        `✅ guard-liveness: ${report.passed.length} ESLint rule(s) passed liveness check\n`,
      );
    }
    return;
  }

  process.stdout.write(
    '\n❌ Guard-liveness: ESLint rule negative-test failures on changed rules:\n',
  );
  for (const f of report.failures) {
    process.stdout.write(`  ${f.ruleId}:\n`);
    for (const msg of f.failures) {
      process.stdout.write(`    - ${msg}\n`);
    }
  }
  process.stdout.write(
    '\nFix: ensure each negative-test.input entry actually triggers the ESLint rule,\n' +
      'and that examples.good produces no violation.\n' +
      'See packages/core/manifest/rules-manifest.json — the negative-test block.\n\n',
  );
  process.exit(1);
}

/**
 * Cmd/script liveness section: change-scoped command/script guard-liveness gate
 * (Wave guard-liveness v1.5). For each command/script manifest rule changed in
 * this push, runs the rule's check against its violating fixture (branching on
 * the per-rule liveness mode) and asserts the guard catches its own violation.
 * SKIP/EXEMPT statuses emit visible lines — never a silent pass.
 */
async function cmdScriptLivenessSection(rb: ResolvedBase): Promise<void> {
  if (rb.base === null) {
    warnSkip(
      'cmd-script-liveness',
      'no resolvable base for change-scoped liveness diff',
    );
    return;
  }
  // Lazy-load — keeps the orchestrator loadable in topologies that do not run
  // this gate. A resolution failure is a loud die, never a silent pass.
  let gate: typeof import('./checks/cmd-script-liveness.ts');
  try {
    gate = await import('./checks/cmd-script-liveness.ts');
  } catch (err) {
    die(
      '❌ cmd-script-liveness: failed to load the liveness runner.\n' +
        `   ${(err as Error).message}`,
    );
  }
  const report = gate.runCmdScriptLivenessGate(rb.base);

  for (const s of report.skipped) {
    process.stdout.write(`ℹ cmd-script-liveness: SKIP ${s}\n`);
  }
  for (const e of report.exempt) {
    process.stdout.write(`ℹ cmd-script-liveness: EXEMPT ${e}\n`);
  }
  for (const nd of report.noData) {
    process.stdout.write(`⚠ cmd-script-liveness: ${nd}\n`);
  }

  if (report.failures.length === 0) {
    if (report.passed.length > 0) {
      process.stdout.write(
        `✅ cmd-script-liveness: ${report.passed.length} command/script rule(s) passed liveness check\n`,
      );
    }
    return;
  }

  process.stdout.write(
    '\n❌ Cmd/script-liveness: rule check failed to catch its violation on changed rules:\n',
  );
  for (const f of report.failures) {
    process.stdout.write(`  ${f.ruleId} [${f.mode ?? 'unknown'}]:\n`);
    for (const msg of f.failures) process.stdout.write(`    - ${msg}\n`);
  }
  process.stdout.write(
    "\nFix: ensure each fixture.setup-script creates the rule's REAL violating state\n" +
      'so the check exits non-zero. See packages/core/manifest/rules-manifest.json (fixture block).\n\n',
  );
  process.exit(1);
}

/**
 * Unpinned bare-run tool install gate (.claude/rules/ci-tool-pinning.md §1 Rule A).
 * Scans every .github/workflows/*.yml — plus, on the FRAMEWORK repo only,
 * every git-tracked shell script (`*.sh`, `setup`) — for bare pip/npm-global
 * install commands that lack an explicit version pin.
 *
 * This slice is NOT covered by zizmor's `adhoc-packages` audit (which targets
 * npm/gem/pip via setup-python action inputs only — SSOT #153b, 2026-06-22),
 * and zizmor never sees shell scripts outside workflows at all (the retired
 * setup.sh's bare `npm install -g ai-factory`, PR #946, motivated the shell
 * slice). Deterministic regex scan; zero API calls (no-paid-llm-in-ci.md compliant).
 *
 * S3 push-channel contract — TWO populations with DIFFERENT owners (ci-tool-pinning.md §2):
 *   • WORKFLOW population (`.github/workflows/*.yml`, pop 1) — "Scanned on every push,
 *     framework and consumer repos alike, via `workflowYmlFiles()`". This section is
 *     therefore `owner: 'both'` in the registry: a consumer's own workflows ARE gated
 *     for un-pinned bare `run: pip install` / `npm install -g` (with the §3 escape
 *     hatch `# ci-tool-pin: allow`). This is NARROW and DISTINCT from the zizmor
 *     `unpinned-uses` @v6 check (S1 finding F-push) — zizmor/actionlint stay
 *     `owner: maintainer` so a consumer's first push is never blocked on pre-existing
 *     `@v6` action refs; Rule A only fires on an un-pinned bare *tool install*, which
 *     is far rarer and carries an escape hatch. Bundling this pop-1 scan into the
 *     zizmor F-push exclusion was the over-reach corrected in the S3 rework round.
 *   • SHELL-SCRIPT population (`*.sh`, `setup`, pop 2) — framework-repo-only (SSOT-register
 *     presence, same detector as the #923 tool-absence split): "A consumer's own scripts
 *     are NOT gated". `ctx.isFrameworkRepo` — the ONE signal main() derives, never a
 *     re-derivation of its own (ledger S-5) — scopes THIS population alone (`: []` on a
 *     consumer), leaving the workflow population unconditional.
 */
function unpinnedToolInstallSection(ctx: SectionCtx): void {
  const population = [
    ...workflowYmlFiles(),
    ...(ctx.isFrameworkRepo ? shellScriptFiles() : []),
  ];
  if (population.length === 0) return;

  const allFindings: Array<{
    file: string;
    line: number;
    text: string;
    hint: string;
  }> = [];

  for (const relPath of population) {
    const absPath = resolve(REPO_ROOT, relPath);
    if (!existsSync(absPath)) continue;
    const content = readFileSync(absPath, 'utf8');
    const findings = checkUnpinnedToolInstalls(content, relPath);
    allFindings.push(...findings);
  }

  if (allFindings.length === 0) return;

  process.stdout.write(
    '\n❌ Unpinned bare-run tool install(s) found in .github/workflows/ ' +
      'or repo shell scripts (.claude/rules/ci-tool-pinning.md §1 Rule A):\n',
  );
  for (const f of allFindings) {
    process.stdout.write(`  ${f.file}:${f.line}: ${f.text}\n`);
    process.stdout.write(`    ${f.hint}\n`);
  }
  process.stdout.write(
    '\nFix: add a version pin to each flagged install, e.g.:\n' +
      '  pip install pyyaml  →  pip install pyyaml==6.0.2\n' +
      '  npm install -g tool  →  npm install -g tool@1.2.3\n' +
      'Escape hatch (genuinely un-pinnable): append  # ci-tool-pin: allow <reason>\n\n',
  );
  process.exit(1);
}

// ════════════════════════════════════════════════════════════════════════════
// Section registry — owner-tagged composition (launch-preannounce-track S3)
// ════════════════════════════════════════════════════════════════════════════
// REPLACES the #923/#943 per-section `existsSync` consumer-skip band-aid. Each
// pre-push section now carries a declarative OWNER tag; `activeSections()` composes
// the section list for the current layout. This is the load-bearing leak-prevention
// mechanism — a `maintainer`-only section is NEVER composed on a consumer layout, so
// it cannot leak onto a consumer's push by a forgotten guard. Two enforcement nets:
//   • principle test 32 fails at CI if any section is untagged / mistagged;
//   • `composeSections()` fails CLOSED (throws) on an absent/invalid owner at runtime
//     — an untagged section aborts every push loudly rather than silently leaking.
//
// The per-section `existsSync` checks that REMAIN inside the section bodies are now
// ONLY within-layout runtime-presence guards (a maintainer file legitimately absent
// mid-migration, or a fixture with a partial layout), NOT the consumer/maintainer
// DETECTION mechanism. Detection is the single `isFrameworkRepo` signal (SSOT-register
// presence), derived once in main() to pick the owner-classes to compose and threaded to
// every section as `ctx.isFrameworkRepo` — the two sections that still need the layout
// signal INSIDE their body (§8 lychee's shipped-markdown narrowing, the ci-tool-pinning
// shell-script population) read it from ctx, never from their own existsSync (ledger S-5:
// this docstring's "consumed once" claim was false for both of them until 2026-09-06).
//
// Owner semantics:
//   • 'consumer'   — runs on a consumer layout only (e.g. rule-glob liveness §3c,
//                    lint-staged resolution §3d — scripts shipped to a consumer's
//                    scripts/, absent in the maintainer repo).
//   • 'maintainer' — runs on the framework repo only (SSOT-register present): the
//                    authoring conventions + meta-tests + render/drift gates, PLUS the
//                    workflow-SECURITY/SYNTAX scanners (actionlint, zizmor live-scan).
//                    Those are maintainer-only by the S3 push-channel CONTRACT (F-push
//                    adjudication, launch-preannounce-track S3 §3): scanning a consumer's
//                    OWN pre-existing workflows for zizmor `unpinned-uses` hard-blocked
//                    their first `git push` on pre-existing `@v6` action refs (S1 finding
//                    F-push, R3 ky) — the adoption-hostile DoS this umbrella exists to
//                    kill. Workflow-security linting of a consumer's OWN workflows is out
//                    of the framework's scope — neither this hook nor any shipped CI
//                    template runs it; a consumer adds it to their own CI if they want it.
//                    NOTE: the ci-tool-pinning unpinned-install gate is NOT in this bucket
//                    — it is `owner: 'both'` (see below). Bundling it here in the first S3
//                    draft over-reached the F-push scope (a rework-round finding): F-push
//                    was the zizmor `unpinned-uses` surface only, and ci-tool-pinning.md §2
//                    explicitly keeps its WORKFLOW population on consumers.
//   • 'both'       — runs on either layout:
//                    (1) lychee link-check on *changed* Markdown (diff-scoped to this push;
//                        degrades if lychee absent) — gates broken links in files THIS push
//                        touches, not pre-existing repo content;
//                    (2) the ci-tool-pinning unpinned-install gate's WORKFLOW population
//                        (`.github/workflows/*.yml`, ci-tool-pinning.md §2 pop 1 —
//                        "scanned on every push, framework and consumer repos alike").
//                        A consumer's own workflows ARE gated for un-pinned bare
//                        `run: pip install` / `npm install -g` (narrow, §3 escape hatch
//                        `# ci-tool-pin: allow`), DISTINCT from the @v6 zizmor check above.
//                        The gate's SHELL-SCRIPT population (pop 2) stays framework-only,
//                        scoped by the within-body isFrameworkRepo guard, not the owner tag.
export type SectionOwner = 'consumer' | 'maintainer' | 'both';
export const VALID_OWNERS: readonly SectionOwner[] = [
  'consumer',
  'maintainer',
  'both',
];

/** Layout-derived context threaded to every section. */
export interface SectionCtx {
  /** The diff base resolved once, up front (consumes git's pre-push stdin). */
  rb: ResolvedBase;
  /** SSOT-register presence — the single consumer/maintainer layout signal. */
  isFrameworkRepo: boolean;
}

export interface PrePushSection {
  /** Stable, unique id — surfaces in principle-test diagnostics + the stage report. */
  id: string;
  /** Owner classification — drives layout composition (see semantics above). */
  owner: SectionOwner;
  /** The check to run; may be sync or async. */
  run: (ctx: SectionCtx) => void | Promise<void>;
}

// HONEST brownfield fix hint (#637): `zizmor --fix=all` auto-fixes ONLY artipacked +
// template-injection. It does NOT fix unpinned-uses — that needs SHA-pinning (verified
// live: after `zizmor --fix=all`, unpinned-uses findings remain and the exit code stays
// non-zero). Saying "just run --fix" would mislead the consumer, so the hint spells out
// the split. Shared by the live-workflow scan (both) and the shipped-template scan (maint).
const ZIZMOR_FIX_HINT =
  '   Fix: `zizmor --fix=all <file>` auto-fixes artipacked + template-injection.\n' +
  '        unpinned-uses is NOT auto-fixable — SHA-pin each action (e.g. via `pinact` or Dependabot).\n' +
  '   Audit docs: https://docs.zizmor.sh/audits/';

// ── 1. actionlint (maintainer) ───────────────────────────────────────────────
// Workflow-syntax lint. Maintainer-only by the S3 push-channel contract (F-push
// adjudication): actionlint is a workflow-SYNTAX audit over the consumer's ENTIRE
// pre-existing workflow set — consumer repo content the framework never authored,
// not framework enforcement-integrity. Scoped OUT on a consumer (see the
// Owner-semantics block above). NB: distinct from the ci-tool-pinning Rule A gate,
// which stays owner:'both' on its workflow population. On the maintainer layout it
// stays fail-closed (owner: 'maintainer' is the whole tool-absence axis — see requireTool).
function actionlintSection(): void {
  const workflows = workflowYmlFiles();
  if (workflows.length > 0) {
    requireTool(
      'actionlint',
      workflows,
      '   Install: brew install actionlint   (macOS)\n' +
        '         or: go install github.com/rhysd/actionlint/cmd/actionlint@latest',
    );
  }
}

// ── 2. zizmor — live workflow scan (maintainer) ──────────────────────────────
// Workflow supply-chain audit (unpinned-uses, artipacked, template-injection).
// Maintainer-only by the S3 push-channel contract (F-push adjudication): scanning a
// CONSUMER's own pre-existing workflows for `unpinned-uses` hard-blocked their FIRST
// `git push` on pre-existing `@v6` action refs (S1 finding F-push) — the adoption-
// hostile DoS this umbrella exists to kill (nearly every real workflow uses `@vN` tag
// refs). This supply-chain audit is consumer repo content, not framework enforcement-
// integrity → scoped OUT on a consumer. NB: this is DISTINCT from the ci-tool-pinning
// Rule A unpinned-*install* gate — that stays owner:'both' (ci-tool-pinning.md §2 keeps
// its workflow population on consumers). Workflow-security linting of a consumer's OWN
// workflows is out of the framework's scope — neither this hook nor any shipped CI
// template runs it; a consumer adds it to their own CI if they want it.
// On the maintainer layout the scan stays full-repo fail-closed (owner: 'maintainer'
// keeps it off a consumer entirely); the `workflows.length > 0` guard still no-ops a
// framework checkout that somehow has no workflows.
function zizmorLiveSection(): void {
  const workflows = workflowYmlFiles();
  if (workflows.length > 0) {
    requireTool(
      'zizmor',
      ['--format', 'plain', '.github/workflows/'],
      '   Install: pip install zizmor',
      ZIZMOR_FIX_HINT,
    );
  }
}

// ── 2b. zizmor — shipped CI-template scan (maintainer) ───────────────────────
// Regression guard (#637): scan the SHIPPED CI templates so they can't silently
// drift past the gate. The templates EXIST in the maintainer repo and are ABSENT on
// a consumer (who receives the rendered .github/workflows/ci.yml, not templates/) —
// owner=maintainer composes it on the framework layout only. `onMissing` stays 'die':
// a maintainer whose zizmor is missing must fix-first, never DEGRADE past a template.
function zizmorTemplatesSection(): void {
  // The population is DISCOVERED, never restated. Both this twin and the CI one
  // (`Run zizmor` in .github/workflows/audit-self.yml) used to carry the same
  // hand-written seven-path array, and a hand-maintained mirror of an
  // automatically-growing population drifts: past cargo/python/react-spa/
  // react-native for 4+ months (last touched in #130; presets landed in
  // #661/#662/#996/#1080), and then past packages/core/templates/go/
  // github-actions-ci.yml — shipped to every go consumer by setup.d/47-go.sh and
  // scanned by NEITHER twin (ledger A8-4). Nothing enforced parity because the
  // only detection layer was someone noticing
  // (.claude/rules/attention-is-not-a-mechanism.md §1 `#warning-nobody-reads`).
  //
  // Every git-tracked `*github-actions*.yml` OUTSIDE .github/workflows/ is a
  // shipped CI template by construction, so a new preset enters the scan the
  // moment it is committed — no second place to remember.
  const templates = trackedShippedWorkflowTemplates();
  // An honest empty set is legal HERE and only here: `owner: maintainer` keys off
  // the SSOT register (isFrameworkRepo), which a synthetic framework-flagged tree
  // can carry while shipping no templates at all — the owner-split fixtures in
  // pre-push.consumer-layout.test.ts are exactly that. So this channel cannot tell
  // «the repo has none» from «discovery lost them», and a floor asserted here would
  // be a floor asserted against the wrong population.
  //
  // The floor therefore lives where the population is knowable: the `Run zizmor`
  // step in .github/workflows/audit-self.yml errors when discovery matches nothing,
  // on the real repo, every run. What IS knowable here is a discovery that could
  // not even be ASKED — `git ls-files` failing — which the old hand list could not
  // detect at all because it never asked git anything.
  if (templates === null) {
    die(
      '❌ zizmor shipped-template scan: `git ls-files` failed, so the shipped-template\n' +
        '   population could not be determined. The scan would silently cover nothing.\n' +
        '   Fix the repository state; do not skip the gate.',
    );
  }
  if (templates.length > 0) {
    requireTool(
      'zizmor',
      ['--format', 'plain', ...templates],
      '   Install: pip install zizmor',
      ZIZMOR_FIX_HINT,
    );
  }
}

/**
 * Git-tracked shipped CI templates: every `*github-actions*.yml` outside
 * `.github/workflows/` (which zizmor scans as a directory in its own right).
 * Tracked-only, mirroring `shellScriptFiles()` — an untracked scratch copy must
 * never gate a push. Sorted so the scanned set is deterministic across platforms.
 *
 * Returns `null` — distinct from `[]` — when git itself could not answer, so the
 * caller can tell «this repo ships no templates» from «the question failed».
 */
function trackedShippedWorkflowTemplates(): string[] | null {
  const r = run('git', ['ls-files', '-z', '--', '*github-actions*.yml']);
  if (r.exitCode !== 0) return null;
  return r.stdout
    .split('\0')
    .filter((l) => l.length > 0 && !l.startsWith('.github/'))
    .filter((l) => existsSync(resolve(REPO_ROOT, l)))
    .sort();
}

// ── 3. Self-test pipeline: audit-ai-docs (maintainer) ────────────────────────
// audit-ai-docs.test.ts (Wave 10.4): run via vitest (replaces audit-ai-docs.test.sh).
// The existsSync remains a within-layout presence guard (the fixture may plant it back).
function auditAiDocsSection(): void {
  if (
    existsSync(
      resolve(REPO_ROOT, 'packages/core/audit-self/audit-ai-docs.test.ts'),
    )
  ) {
    const r = run('npx', [
      'vitest',
      'run',
      '--reporter=default',
      'packages/core/audit-self/audit-ai-docs.test.ts',
    ]);
    if (r.notFound)
      die('❌ npx not found — install Node.js to run audit-ai-docs tests');
    if (r.exitCode !== 0) die('❌ audit-ai-docs.test.ts failed:', r);
    emit(r);
  }
}

// ── 3b. Skill drift check (maintainer, D-AuditC-5 channel 2) ─────────────────
// scripts/check-skill-drift.sh exists in the maintainer repo (NOT in install.sh's
// consumer copy-list), so owner=maintainer; the existsSync is the presence guard.
function skillDriftSection(): void {
  if (existsSync(resolve(REPO_ROOT, 'scripts/check-skill-drift.sh'))) {
    const r = run('bash', ['scripts/check-skill-drift.sh']);
    if (r.exitCode !== 0) die('❌ skill drift check failed', r);
    emit(r);
  }
}

// ── 3c. Rule-glob liveness (consumer, universalization-fix-s2) ───────────────
// Shipped consumer gate (install.sh → scripts/check-rule-globs.sh): FAILS if an
// ACTIVE custom ESLint rule's globs match zero source files (silently-inert rule —
// the worst failure for a "no check → no rule" framework). The script lives at
// scripts/ only in a CONSUMER repo (in the maintainer repo it is at
// packages/core/audit-self/), hence owner=consumer.
function ruleGlobsSection(): void {
  if (existsSync(resolve(REPO_ROOT, 'scripts/check-rule-globs.sh'))) {
    const r = run('bash', ['scripts/check-rule-globs.sh']);
    if (r.exitCode !== 0) die('❌ rule-glob liveness check failed', r);
    emit(r);
  }
}

// ── 3c-bis. worktree node_modules provisioning (maintainer, incident 2026-07-23) ──────
// Self-healing preflight. A worktree created outside `claude -w` — the desktop app, an agent
// container, a hand-run `git worktree add` — never runs .claude/hooks/worktree-setup.sh, so it
// starts with no node_modules symlinks. Two concrete consequences downstream in THIS very hook:
// packages/core/node_modules then resolves to the wrong layer and `build-synth-bundle.sh --check`
// false-fails with "synth-bundle drift" (incident 2026-07-02); and the principles section below
// runs vitest, which materialises node_modules/.vite — after which the path exists and NO channel
// can ever provision the worktree again (32 of 125 worktrees were already in that state).
//
// It therefore runs FIRST (position 0 in ALL_SECTIONS — composeSections() is order-preserving)
// so the symlinks land BEFORE vitest can plant the cache that would freeze them out.
//
// Heals rather than blocks: the only write is a gitignored symlink, and the shared helper
// refuses any path holding a real install. Blocks ONLY when healing is impossible (the primary
// checkout itself has no node_modules), and then names the exact remediation. Per the operator
// directive — worktree symlink provisioning is a blocking check of the setup hook, not a manual
// habit — and .claude/rules/attention-is-not-a-mechanism.md §1 (a gate, not a warning nobody reads).
function worktreeProvisioningSection(): void {
  const helper = resolve(REPO_ROOT, 'scripts/worktree-node-modules.sh');
  // A worktree's .git is a FILE; the primary's is a directory. No git call needed.
  if (!existsSync(helper) || !statSync(resolve(REPO_ROOT, '.git')).isFile())
    return;

  if (run('bash', [helper, '--check', REPO_ROOT]).exitCode === 0) return;

  const applied = run('bash', [helper, '--apply', REPO_ROOT]);
  if (applied.exitCode !== 0) {
    die(
      '❌ this worktree has no node_modules and cannot be provisioned automatically.\n' +
        '   Run `npm install` in the primary checkout, then `bash scripts/worktree-doctor.sh --fix`.',
      applied,
    );
  }
  process.stdout.write(
    '✓ worktree node_modules provisioned (symlinks were missing — healed before the test sections)\n',
  );
}

// ── 3d. lint-staged binary resolution (consumer, universalization-fix-s2) ────
// Shipped consumer gate (install.sh → scripts/check-lintstaged-resolves.sh): FAILS
// if a lint-staged command's binary cannot resolve in the consumer's layout (e.g. a
// pnpm monorepo where the per-package eslint is not on the root .bin) before the
// first blocked commit. Consumer-only script → owner=consumer.
function lintStagedResolvesSection(): void {
  if (existsSync(resolve(REPO_ROOT, 'scripts/check-lintstaged-resolves.sh'))) {
    const r = run('bash', ['scripts/check-lintstaged-resolves.sh']);
    if (r.exitCode !== 0) die('❌ lint-staged resolution check failed', r);
    emit(r);
  }
}

/**
 * Rule-test sidecar SHAPE validation — the S2 loader contract, in-process.
 *
 * Returns `null` when the file at `path` is valid rule-test material, or the first
 * violation reason otherwise. Mirrors `validateRuleTestsSidecar`
 * (packages/core/synthesizer/rule-tests-sidecar.ts) — that module is NOT shipped to
 * consumers, so the contract is re-implemented here rather than imported.
 *
 * Parse-only was insufficient: a `badd` typo or an empty `bad[]` is valid JSON but
 * yields zero samples, and the firing runner would then end green. This RED's the arm
 * even when the runner is bypassed (and needs no lane tool, since it is pure JS).
 *
 * Ledger S-1: this used to be the same ~20 lines embedded in a template string and run
 * per sidecar via `node -e`. In that form it was invisible to tsc, eslint, prettier and
 * vitest — an `Array.isarray` typo would have shipped to consumers and surfaced only as
 * a runtime crash on their push — and it spawned one extra node process per sidecar.
 * As a typed function it is checked by the same toolchain as the rest of this hook, and
 * the error strings (asserted by pre-push.consumer-layout.test.ts) are unchanged.
 */
function validateSidecarShape(path: string): string | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, 'utf8'));
  } catch (e) {
    return `not valid JSON — ${(e as Error).message}`;
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed))
    return 'top level must be an object keyed by ruleId';
  for (const [id, entry] of Object.entries(parsed as Record<string, unknown>)) {
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry))
      return `entry "${id}" must be an object { bad: string[], good: string[] }`;
    const sample = entry as Record<string, unknown>;
    for (const k of Object.keys(sample))
      if (k !== 'bad' && k !== 'good')
        return `entry "${id}" has an unexpected key "${k}" (only "bad" and "good" are allowed)`;
    for (const f of ['bad', 'good'] as const) {
      if (!(f in sample)) return `entry "${id}" is missing "${f}"`;
      const v = sample[f];
      if (!Array.isArray(v))
        return `entry "${id}" field "${f}" must be an array of code samples`;
      if (v.length === 0)
        return `entry "${id}" field "${f}" must be a non-empty array (${
          f === 'bad'
            ? 'no violating sample = nothing fires'
            : 'no clean counter-sample = over-firing unproven'
        })`;
      for (const x of v)
        if (typeof x !== 'string' || x.length === 0)
          return `entry "${id}" field "${f}" each sample must be a non-empty string`;
    }
  }
  return null;
}

// ── 3d2. Generated rule-material firing (consumer, rule-tests-surface S5) ─────
// Standing consumer channel for the hash-exempt rule-test material a repair touches (spec §2):
// without it a skipped/theatred /rule-tests run leaves broken material failing at NO channel
// (`#hope-as-gate`, attention-is-not-a-mechanism.md §1). Three guarded arms, all owner:consumer —
// the runners live at scripts/ in a consumer repo (framework source packages/core/synthesizer/):
//   (a) npm mutation — if the generated-rules manifest exists, run the delivered mutation runner.
//       run-generated-rule-mutation.sh die()s exit 2 when the manifest or tsx/eslint are
//       unresolvable; the arm PRE-CHECKS tsx/eslint and converts any exit-2 into a LOUD SKIP
//       (never a push-blocking die, never a silent pass — D-S5-guards).
//   (b) astgrep/ruff firing — for each backend whose S2 sidecar (.ai-factory/rule-tests/<b>.json)
//       exists AND whose lane tool is present, fire the samples in single-rule isolation via the
//       delivered firing runner. Tool absent → LOUD DEGRADE skip; runner exit 1 (broken material)
//       → die (RED). The section does the tool-presence gating (requireTool warn-skip idiom).
//   (c) cargo — OPT-IN only (GETFF_PREPUSH_CARGO_FIRE=1; `cargo clippy` compiles on every push);
//       default OFF → loud one-line skip. Recorded home for the toggle: agents/rule-test-author.md.
function generatedRuleMaterialSection(): void {
  // scripts/<name> in a consumer, packages/core/synthesizer/<name> in the framework repo.
  const resolveRunner = (name: string): string | null => {
    const consumer = resolve(REPO_ROOT, `scripts/${name}`);
    if (existsSync(consumer)) return consumer;
    const framework = resolve(REPO_ROOT, `packages/core/synthesizer/${name}`);
    return existsSync(framework) ? framework : null;
  };
  // Mirror the mutation script's own tsx/eslint resolution (repo-local node_modules/.bin) so the
  // pre-check matches what would make the script die() exit 2 — deterministic, no spawn.
  const binResolvable = (bin: string): boolean =>
    existsSync(resolve(REPO_ROOT, `node_modules/.bin/${bin}`)) ||
    existsSync(resolve(REPO_ROOT, `packages/core/node_modules/.bin/${bin}`));
  // Lane tool present? (astgrep: ast-grep|sg; ruff: ruff|uvx; cargo: cargo) — mirrors the runner.
  const toolPresent = (backend: string): boolean => {
    if (backend === 'astgrep')
      return (
        !run('ast-grep', ['--version']).notFound ||
        !run('sg', ['--version']).notFound
      );
    if (backend === 'ruff')
      return (
        !run('ruff', ['--version']).notFound ||
        !run('uvx', ['--version']).notFound
      );
    return !run('cargo', ['--version']).notFound;
  };

  // ── (a) npm mutation lane ──
  const manifest = resolve(
    REPO_ROOT,
    '.ai-factory/synthesizer-output/rules-manifest-additions.json',
  );
  if (existsSync(manifest)) {
    const runner = resolveRunner('run-generated-rule-mutation.sh');
    if (!runner) {
      process.stdout.write(
        '⚠ DEGRADED: generated-rules manifest present but run-generated-rule-mutation.sh not delivered — mutation check SKIPPED (a skipped check is NOT green).\n',
      );
    } else if (!binResolvable('tsx') || !binResolvable('eslint')) {
      process.stdout.write(
        '⚠ DEGRADED: tsx/eslint not resolvable — generated-rule mutation check SKIPPED (run npm install; a skipped check is NOT green).\n',
      );
    } else {
      // Pass the manifest path explicitly ($1): the delivered script derives its own REPO_ROOT
      // from SCRIPT_DIR/../../.. which is wrong in the consumer scripts/ layout — the explicit
      // arg makes the check layout-independent (matches the manifest we already existsSync'd).
      const r = run('bash', [runner, manifest]);
      if (r.notFound || r.timedOut || r.exitCode === 127) {
        // ENV failure (bash/runner missing or hung), NOT broken material → loud skip, never die.
        process.stdout.write(
          `⚠ DEGRADED: generated-rule mutation runner did not execute (${r.timedOut ? 'timed out' : 'not runnable'}) — SKIPPED (a skipped check is NOT green).\n`,
        );
      } else if (r.exitCode === 2) {
        // Script self-reported an unresolvable precondition → loud skip, never block the push.
        process.stdout.write(
          '⚠ DEGRADED: generated-rule mutation runner could not resolve its inputs (exit 2) — SKIPPED (a skipped check is NOT green).\n',
        );
        emit(r);
      } else if (r.exitCode !== 0) {
        die(
          '❌ generated-rule mutation check failed — npm negative-test material is selector-blind',
          r,
        );
      } else {
        emit(r);
      }
    }
  }

  // ── (b/c) sidecar firing lanes ──
  const firingRunner = resolveRunner('run-rule-tests-firing.sh');
  for (const backend of ['astgrep', 'ruff', 'cargo']) {
    const sidecar = resolve(
      REPO_ROOT,
      `.ai-factory/rule-tests/${backend}.json`,
    );
    if (!existsSync(sidecar)) continue;
    // BLOCKER fix: a malformed OR mis-shaped sidecar is BROKEN MATERIAL, not an absence — it must
    // RED regardless of whether the lane tool is installed (the runner would otherwise coerce a
    // typo'd/empty field to zero samples and end green). Runs in-process — no lane tool, and
    // (since ledger S-1) no spawned node either.
    const shapeError = validateSidecarShape(sidecar);
    if (shapeError !== null) {
      die(
        `❌ ${backend} rule-test sidecar is not valid rule-test material — broken material (.ai-factory/rule-tests/${backend}.json)\n   ${shapeError}`,
      );
    }
    if (
      backend === 'cargo' &&
      process.env['GETFF_PREPUSH_CARGO_FIRE'] !== '1'
    ) {
      process.stdout.write(
        // Unified wording with the runner (run-rule-tests-firing.sh) so drift breaks a test.
        '⚠ cargo firing arm is opt-in (compile cost) — set GETFF_PREPUSH_CARGO_FIRE=1 to enable; a skipped check is NOT green.\n',
      );
      continue;
    }
    if (!firingRunner) {
      process.stdout.write(
        `⚠ DEGRADED: ${backend} sidecar present but run-rule-tests-firing.sh not delivered — firing SKIPPED (a skipped check is NOT green).\n`,
      );
      continue;
    }
    if (!toolPresent(backend)) {
      // Tool-absence loud skip (requireTool warn-skip idiom family) — never a die, never silent.
      process.stdout.write(
        `⚠ DEGRADED: ${backend} lane tool not found — rule-test firing SKIPPED (a skipped check is NOT green).\n`,
      );
      continue;
    }
    const r = run('bash', [firingRunner, REPO_ROOT, backend]);
    if (r.notFound || r.timedOut || r.exitCode === 127) {
      // ENV failure (bash/runner missing or hung), NOT broken material → loud skip, never die.
      process.stdout.write(
        `⚠ DEGRADED: ${backend} firing runner did not execute (${r.timedOut ? 'timed out' : 'not runnable'}) — SKIPPED (a skipped check is NOT green).\n`,
      );
      continue;
    }
    if (r.exitCode !== 0) {
      die(
        `❌ ${backend} rule-test firing failed — broken sidecar material (a bad[] sample did not fire, or a good[] sample over-fired)`,
        r,
      );
    }
    emit(r);
  }
}

// ── 3e. Kickoff portability (maintainer, D5) ─────────────────────────────────
// In-flight kickoffs must be git-tracked (SSOT #116). The script lives at
// packages/core/audit-self/ only in the maintainer repo → owner=maintainer.
function kickoffPortabilitySection(): void {
  if (
    existsSync(
      resolve(
        REPO_ROOT,
        'packages/core/audit-self/check-kickoff-portability.sh',
      ),
    )
  ) {
    const r = run('bash', [
      'packages/core/audit-self/check-kickoff-portability.sh',
    ]);
    if (r.exitCode !== 0) die('❌ kickoff-portability check failed', r);
    emit(r);
  }
}

// ── 3f. Synth-bundle drift + functional smoke test (maintainer, #755) ────────
// synth-and-wire.ts is precompiled into a zero-runtime-dep .mjs (esbuild); the
// committed bundle must stay in sync with the .ts source. scripts/build-synth-bundle.sh
// exists in the maintainer repo only → owner=maintainer.
// exit 2 = esbuild absent (NODE_ENV=production skips devDeps) → skip, not fail.
// exit 1 = real drift → fail.
function synthBundleSection(): void {
  if (existsSync(resolve(REPO_ROOT, 'scripts/build-synth-bundle.sh'))) {
    const r = run('bash', ['scripts/build-synth-bundle.sh', '--check']);
    if (r.exitCode === 2) {
      process.stderr.write(
        '⚠️  synth-bundle drift gate skipped — esbuild not installed' +
          ' (run: NODE_ENV=development npm install --include=dev)\n',
      );
    } else if (r.exitCode !== 0) {
      die(
        '❌ synth-bundle drift detected — run: bash scripts/build-synth-bundle.sh',
        r,
      );
    } else {
      emit(r);
      // Functional smoke test: run the bundle zero-dep to prove it synthesizes real
      // rules (not just that bytes match a rebuilt-but-still-broken source).
      // AIF_SYNTH_PKG_ROOT overrides the four import.meta.url anchors that break
      // when esbuild collapses all modules into a single file (#755 anchor fix).
      const bundlePath = resolve(
        REPO_ROOT,
        'packages/core/install/synth-and-wire.bundle.mjs',
      );
      if (existsSync(bundlePath)) {
        const smoke = runCheck(
          'node',
          [
            bundlePath,
            '--stack',
            'react-next',
            '--path',
            '/tmp/no-eslint-config-smoke.mjs',
            '--dry-run',
          ],
          {
            cwd: REPO_ROOT,
            env: {
              ...process.env,
              AIF_SYNTH_PKG_ROOT: resolve(REPO_ROOT, 'packages/core'),
            },
          },
        );
        if (smoke.exitCode !== 0) {
          die(
            '❌ synth-bundle smoke test failed — bundle crashed (anchor break or runtime error)',
            smoke,
          );
        }
        if (smoke.stdout.includes('emitted no rules')) {
          die(
            '❌ synth-bundle smoke test: synthesis emitted no rules — anchor break still present',
            smoke,
          );
        }
        emit(smoke);
      }
    }
  }
}

// ── 3g. Shipped-rule compiled-artifact drift + orphan gate (maintainer, #752/#990) ──
// Committed eslint-rule .mjs/.d.ts must match a fresh recompile of their .ts
// sources, and every artifact must still HAVE a source (orphan walk — deleting
// a rule source must not leave its compiled output shipping silently). Owner =
// maintainer: the build script + rule .ts sources live in the framework repo only
// (consumers receive compiled .mjs per #752); the existsSync guard stays as
// belt-and-suspenders on top of owner routing. exit 2 = tsc absent → skip, not fail.
//
// CHANGE-SCOPED since 2026-09-06 (ledger F-1). `--check` recompiles every rule source
// with a COLD tsc — six spawns, measured 4.07 s wall / 8.0 s CPU — and it ran on every
// framework push, docs-only ones included. The gate can only go RED when this push
// touches an eslint-rule source, its compiled artifact, or the build script itself, so
// that is exactly when it now runs. The predicate matches ANY `*/eslint-rules/*` path
// (not a hard-coded copy of the script's RULE_DIRS list), so a rule directory added to
// a future preset is covered without editing this hook.
//
// Deletions are IN scope (`--diff-filter` includes D): deleting a rule source is the
// exact input the orphan walk exists to catch. An unresolvable base ⇒ the push cannot
// be scoped ⇒ the gate runs in full — narrowing must never be the silent branch.
function shippedRuleDriftSection(ctx: SectionCtx): void {
  if (!existsSync(resolve(REPO_ROOT, 'scripts/build-shipped-eslint-rules.sh')))
    return;
  if (ctx.rb.base !== null) {
    const touched = getChangedFiles(ctx.rb.base, 'ACMRD', ctx.rb.head).some(
      (f) =>
        f.includes('/eslint-rules/') ||
        f === 'scripts/build-shipped-eslint-rules.sh',
    );
    if (!touched) return;
  }
  const r = run('bash', ['scripts/build-shipped-eslint-rules.sh', '--check']);
  if (r.exitCode === 2) {
    process.stderr.write(
      '⚠️  shipped-rule drift gate skipped — tsc not installed (run: npm install at repo root)\n',
    );
  } else if (r.exitCode !== 0) {
    die(
      '❌ shipped-rule drift/orphan detected — run: bash scripts/build-shipped-eslint-rules.sh (and delete orphaned .mjs/.d.ts)',
      r,
    );
  } else {
    emit(r);
  }
}

// ── 4. Manifest render drift (maintainer) ────────────────────────────────────
// packages/core/render/ is maintainer-only (not in install.sh's consumer copy-list).
function manifestRenderSection(): void {
  if (existsSync(resolve(REPO_ROOT, 'packages/core/render/render-rules.ts'))) {
    const r = run('npx', [
      'tsx',
      'packages/core/render/render-rules.ts',
      '--check',
    ]);
    if (r.notFound) {
      die(
        '❌ npx not found. Install Node.js to enable manifest render drift check.',
      );
    }
    if (r.exitCode !== 0) die('❌ manifest render drift detected:', r);
    emit(r);
  }
}

// ── 4b. Rule-index render drift (maintainer, CTX Stage 1) ────────────────────
// .claude/rules/00-rule-index.md + the AGENTS.md `rule-index` fenced region must
// stay in sync with each rule's own header metadata. scripts/render-rule-index.mjs
// exists in the maintainer repo only → owner=maintainer.
function ruleIndexRenderSection(): void {
  if (existsSync(resolve(REPO_ROOT, 'scripts/render-rule-index.mjs'))) {
    const r = run('npx', ['tsx', 'scripts/render-rule-index.mjs', '--check']);
    if (r.notFound) {
      die(
        '❌ npx/tsx not found. Install Node.js + tsx to enable rule-index drift check.',
      );
    }
    if (r.exitCode !== 0) die('❌ rule-index drift detected:', r);
    emit(r);
  }
}

// ── 5. Principles meta-tests (maintainer, Phase 2) ───────────────────────────
// Sections 5–5d shell out to `npm --prefix packages/core run test:*`, needing
// packages/core/package.json + the meta-test suites — all maintainer-only.
function principlesMetaSection(): void {
  if (existsSync(resolve(CORE, 'package.json'))) {
    const r = run('npm', ['--prefix', CORE, 'run', 'test:principles']);
    if (r.notFound) {
      die(
        '❌ npm/npx not found. Install Node.js to enable principles meta-tests.',
      );
    }
    if (r.exitCode !== 0)
      die('❌ principles meta-tests failed — fix before push', r);
    emit(r);
  }
}

// ── 5c. Always-on context budget (maintainer, arch-v2 S-E P3a) ───────────────
// Standing drift-guard: gate the always-on resident set on size. Shells out to
// scripts/check-alwayson-budget.sh, which calls scripts/measure-always-on.sh and
// fails if the byte total exceeds AIF_ALWAYSON_CEILING (default 54000, derived
// 2026-08-06 from the post-P3b baseline 48,671 B × 1.10 → 54,000 B). See the gate
// header for the per-environment labelled derivations and the declared-coverage
// sentence (the gate sees the repo-authored set only — 48,671 B at HEAD; its SHARE of
// session-start is UNMEASURED — channel absent since S-G moved the numerator away from
// every denominator in hand, withdrawing the old "29-39%" per arch-v2 S-L PR #1263; a
// substantial majority remains harness-resident, addressed by P14 in S-H).
//
// Maintainer-only because the ceiling is framework-derived and the gated set is
// the framework's CLAUDE.md + .claude/rules/*.md (a consumer layout has its own
// CLAUDE.md, not gated here).
//
// Escape hatch (§3, per ci-tool-pinning.md §3 precedent): AIF_ALWAYSON_BUDGET_ALLOW
// env with rationale ≥20 chars downgrades RED to WARN. Rationale length gates the
// escape so a bare "TODO" cannot skip the gate. The escape is checked INSIDE the
// gate script — here we only propagate its exit code.
function alwaysonBudgetSection(): void {
  const r = run('bash', ['scripts/check-alwayson-budget.sh']);
  if (r.notFound) {
    die(
      '❌ bash not found to run scripts/check-alwayson-budget.sh ' +
        '(arch-v2 S-E P3a always-on budget gate).',
    );
  }
  if (r.exitCode !== 0) {
    die(
      '❌ always-on budget gate RED — fix the resident set, OR escape with\n' +
        "   AIF_ALWAYSON_BUDGET_ALLOW='<rationale ≥20 chars>'\n" +
        '   (rationale must name why this push is exempt).',
      r,
    );
  }
  emit(r);
}

// ── 5a-bis. Ask-file schema validity (maintainer, advisor-pattern §8 item 6) ──
// Validates every ask file in the coordination mailbox against the spec §2 schema and
// runs the §5.3 L3(c) answered⇒decisions-entry cross-check.
//
// The check logic — and the mailbox path literal — live in scripts/check-ask-files.sh,
// OUTSIDE packages/, which is what session-bus v2 §9 executable claim 1 requires (no bus
// verb grammar, no mailbox path segment under packages/). This entry is a delegation: it
// carries no bus literal and no bus logic, so the claim stays honest.
//
// Absent script (a consumer checkout, or a shallow copy) → skip, never fail: the same
// existsSync guard kickoffPortabilitySection and synthBundleSection use. Absent mailbox is
// handled INSIDE the script (exit 0) — the advisor seat is not live yet, and "not live" must
// never block a push.
function askFileSchemaSection(): void {
  if (!existsSync(resolve(REPO_ROOT, 'scripts/check-ask-files.sh'))) return;
  const r = run('bash', ['scripts/check-ask-files.sh']);
  if (r.notFound) {
    die(
      '❌ bash not found to run scripts/check-ask-files.sh (ask-file schema gate).',
    );
  }
  if (r.exitCode !== 0) {
    die(
      '❌ ask-file schema gate RED — fix the ask file(s) named above.\n' +
        '   Schema reference: the header of scripts/check-ask-files.sh.',
      r,
    );
  }
  emit(r);
}

// ── 5b. IR grammar-gate tests (maintainer, MT S1) ────────────────────────────
function irMetaSection(): void {
  if (existsSync(resolve(CORE, 'package.json'))) {
    const r = run('npm', ['--prefix', CORE, 'run', 'test:ir']);
    if (r.notFound) {
      die('❌ npm/npx not found. Install Node.js to enable IR meta-tests.');
    }
    if (r.exitCode !== 0)
      die('❌ IR grammar-gate tests failed — fix before push', r);
    emit(r);
  }
}

// ── 5c. Backend tests (maintainer, MT S2) ────────────────────────────────────
function backendsMetaSection(): void {
  if (existsSync(resolve(CORE, 'package.json'))) {
    const r = run('npm', ['--prefix', CORE, 'run', 'test:backends']);
    if (r.notFound) {
      die(
        '❌ npm/npx not found. Install Node.js to enable backend meta-tests.',
      );
    }
    if (r.exitCode !== 0) die('❌ backend tests failed — fix before push', r);
    emit(r);
  }
}

// ── 5d. Composition tests (maintainer, MT S4) ────────────────────────────────
function compositionMetaSection(): void {
  if (existsSync(resolve(CORE, 'package.json'))) {
    const r = run('npm', ['--prefix', CORE, 'run', 'test:composition']);
    if (r.notFound) {
      die(
        '❌ npm/npx not found. Install Node.js to enable composition meta-tests.',
      );
    }
    if (r.exitCode !== 0)
      die('❌ composition tests failed — fix before push', r);
    emit(r);
  }
}

// ── 6. Spec discipline (maintainer, Phase 1.C) — dormant defensive guard ─────
// .claude/orchestrator-prompts/ is gitignored; this fires only if such a file is
// force-added past gitignore AND the batch-spec validator is present (maintainer-only).
function specDisciplineSection(ctx: SectionCtx): void {
  const { rb } = ctx;
  if (rb.base !== null) {
    const specFiles = getChangedFiles(rb.base, 'ACM', rb.head).filter((f) =>
      /^\.claude\/orchestrator-prompts\/.*\.md$/.test(f),
    );
    if (
      specFiles.length > 0 &&
      existsSync(
        resolve(
          REPO_ROOT,
          'packages/core/spec-validation/validate-batch-spec.ts',
        ),
      )
    ) {
      process.stdout.write(
        'Validating force-added orchestrator-prompts in this push...\n',
      );
      const r = run('npx', [
        'tsx',
        'packages/core/spec-validation/validate-batch-spec.ts',
        ...specFiles,
      ]);
      if (r.exitCode !== 0)
        die('❌ spec-validate findings — fix before push', r);
      emit(r);
    }
  } else {
    warnSkip('§6', 'no resolvable base for the spec-discipline diff');
  }
}

// ── guard-liveness (maintainer) ──────────────────────────────────────────────
// Change-scoped ESLint liveness gate over packages/core/manifest/rules-manifest.json
// (maintainer-only). The manifest-presence guard also keeps the ESLint-stack import
// off any consumer path entirely (#921 blocker 8).
async function guardLivenessEntry(ctx: SectionCtx): Promise<void> {
  if (
    existsSync(resolve(REPO_ROOT, 'packages/core/manifest/rules-manifest.json'))
  ) {
    await guardLivenessSection(ctx.rb);
  }
}

// ── cmd-script-liveness (maintainer) ─────────────────────────────────────────
async function cmdScriptLivenessEntry(ctx: SectionCtx): Promise<void> {
  if (
    existsSync(resolve(REPO_ROOT, 'packages/core/manifest/rules-manifest.json'))
  ) {
    await cmdScriptLivenessSection(ctx.rb);
  }
}

// ── 8. lychee offline link check on changed *.md (both) ──────────────────────
//
// S2 §2 Part 1 (getff-honest-signals, 2026-07-25): on a CONSUMER layout the walk is
// narrowed to CONSUMER-authored changed *.md — framework-shipped markdown is excluded
// so a consumer's first push is not blocked by shipped content carrying framework-
// internal refs that resolve inside this repo but dangle on a consumer checkout. The
// narrowing fires ONLY on consumer layouts; on the framework repo the same paths are
// authoring locations whose refs resolve against framework files (we want lychee to
// cover them there). §3 NEGATIVE arm (pre-push.consumer-layout.test.ts) guards that
// the gate is still live on consumer-owned .md; §3 POSITIVE arm guards the narrowing
// actually excludes shipped content.
//
// SSOT for the shipped surface (predicate reuse, BFR):
//   (1) scripts/format-shipped.sh:34-44 — PATHSPECS = framework-SOURCE shipped paths
//       (the files install.sh copies into consumer projects).
//   (4) tests/install-sh/refresh-covers-full-delivery.test.sh:121-123 — derivation of
//       the consumer-DESTINATION shipped set from setup.d copy_safe commands.
// SHIPPED_MD_DESTINATIONS below is predicate (1)'s PATHSPECS translated to
// consumer-destination paths — derived from, and gated against, the snapshot fingerprint
// corpus (predicate (4)'s question answered by a real install rather than a shell scan).
//
// Both halves of this classifier are now drift-GATED, and neither is a bare subtree:
// SHIPPED_MD_DESTINATIONS + SHIPPED_MD_PREFIXES below, and SHIPPED_SKILL_SLUGS further
// down. A stale list degrades safely in the consumer-blocking direction this stage exists
// to fix (an un-listed shipped file is treated as consumer-authored, so lychee still walks
// it and a dangling framework ref can still block a consumer push) — it never silently
// disables the gate — but "degrades safely" is not a mechanism
// (.claude/rules/attention-is-not-a-mechanism.md §1), which is why the gate exists.

/**
 * The EXACT consumer-destination paths of the framework's non-skill, non-agent shipped
 * markdown (ledger A4-8, second half).
 *
 * These rows used to be hand-maintained author attention — the code said so, and nothing
 * failed when they drifted. Measured on the live tree 2026-09-06, both failure directions
 * were already realized:
 *
 *   (a) UNDER-coverage — `.ai-factory/AI-USAGE-GUIDE.md` (30-templates.sh:50) and
 *       `.ai-factory/tier-home.md` (30-templates.sh:109) had no row at all, so on a
 *       consumer they classified as consumer-AUTHORED. The moment either grows a relative
 *       ref to a framework path, lychee walks it on a consumer tree, the ref dangles there
 *       (no docs/ on that checkout) and OUR shipped content blocks THEIR push — the
 *       getff-honest-signals defect the S2 Part 1 narrowing exists to kill.
 *   (b) OVER-coverage — `.ai-factory/RULES.` and `.ai-factory/ARCHITECTURE.` were BARE
 *       prefixes standing in for stack variants, so a consumer's own
 *       `.ai-factory/RULES.internal.md` matched and was silently dropped from the walk.
 *       That is precisely the `.claude/skills/` swallowing defect PR #1630 fixed one
 *       surface over. Exact paths, not prefixes: the installer delivers exactly four
 *       ARCHITECTURE.* and four RULES.* names, and every other name is the consumer's.
 *
 * SSOT: the snapshot fingerprint corpus, tests/install-sh/baselines/** — the sha256
 * manifest of a REAL install into a scratch fixture, one per stack x greenfield/brownfield.
 * A derivation check in pre-push.test.ts compares this list against it in BOTH directions:
 * a delivered *.md with no row fails, and a row no install produces fails too. The corpus
 * is the destination SSOT that cannot go verb-stale — it holds no delivery verbs at all,
 * only the tree the installer produced (#1624 replaced a `cp -r` with
 * _copy_tree_with_transform and a verb-shaped regex over setup.d went stale within hours).
 *
 * `AGENTS.md` and the whole `.ai-factory/*` set are ALSO recorded in
 * .ai-factory/refresh-baseline.json on a real install — verified by installing ts-server
 * into a scratch fixture 2026-09-06: 95 keys, every one of these paths present except
 * AGENTS.md (merge_fenced is outside the baseline mechanism by design, setup.d/lib.sh:260-262).
 * So on a consumer WITH a readable manifest this list is redundant. It is kept for the
 * arm that has no manifest — no jq, or an unwritable .ai-factory/ — where dropping it
 * would move shipped content back into the walk, i.e. exactly the wrong direction.
 */
export const SHIPPED_MD_DESTINATIONS: readonly string[] = [
  'AGENTS.md', // 30-templates.sh:95 / 45-python.sh:1313 (install_agents_md)
  '.ai-factory/AI-USAGE-GUIDE.md',
  '.ai-factory/ARCHITECTURE.md',
  '.ai-factory/ARCHITECTURE.react-native.md',
  '.ai-factory/ARCHITECTURE.react-next.md',
  '.ai-factory/ARCHITECTURE.react-spa.md',
  '.ai-factory/ARCHITECTURE.ts-server.md',
  '.ai-factory/DESCRIPTION.md',
  '.ai-factory/DESCRIPTION.template.md',
  '.ai-factory/RULES.md',
  '.ai-factory/RULES.react-native.md',
  '.ai-factory/RULES.react-next.md',
  '.ai-factory/RULES.react-spa.md',
  '.ai-factory/rules/integration-rules.md',
  '.ai-factory/tier-home.md',
  '.ai-factory/tool-decisions.md',
  '.claude/session-bootstrap.md', // 10-skills.sh:338 / install.sh:892 (conditional starter)
];

/**
 * The one shipped markdown namespace an exact enumeration cannot cover: skill-context
 * overrides are delivered as `.ai-factory/skill-context/$_sc/SKILL.md` for every entry of
 * SHIPPED_DOCS (20-agents.sh:74), and WHICH entries land is profile-gated — a factory
 * consumer also gets aif-orchestrator-discipline (20-agents.sh:70-72). The whole subtree
 * is framework territory by construction: every path under it is an override of a
 * framework-vendored sub-agent's context, so there is no consumer-authored file to swallow.
 *
 * Same gate as SHIPPED_MD_DESTINATIONS: pre-push.test.ts requires every row here to prefix
 * at least one delivered *.md in the fingerprint corpus, and to stay scoped below a
 * top-level directory — a bare `.claude/skills/` was the #1630 defect, and a bare
 * `.ai-factory/` would swallow the consumer's own .ai-factory/orchestrator-prompts/
 * backlog (30-templates.sh:17).
 */
export const SHIPPED_MD_PREFIXES: readonly string[] = [
  '.ai-factory/skill-context/',
];

/**
 * The skill directories the installer delivers, by slug (ledger A4-8).
 *
 * The list this replaces held the BARE prefix `.claude/skills/`, i.e. the whole subtree.
 * But 10-skills.sh delivers NAMED directories only (getff + tool-bootstrapping, then the
 * GETFF_SKILLS_{CORE,ENV,FACTORY} tiers), so on a consumer every skill THEY authored —
 * `.claude/skills/deploy/SKILL.md` and friends — matched the prefix and was silently
 * dropped from the §8 walk, with the "excluded N framework-shipped *.md" notice printed
 * over it. A dangling relative link in a consumer's own skill shipped unchecked, which is
 * the exact opposite of the "consumer-authored only" narrowing this section announces.
 * `.claude/agents/` had the same shape and is handled by the baseline lookup below.
 *
 * Per-slug prefixes are exact: a consumer slug that is NOT in this list is walked.
 * Delivering a skill under `<slug>.override.md` marks it consumer-OWNED, and that path
 * does not match `<slug>/` — correctly walked as consumer content.
 *
 * SSOT: setup.d/lib.sh:61-63 (GETFF_SKILLS_CORE/_ENV/_FACTORY) + the two dirs
 * 10-skills.sh:12-50 copies by name. Kept honest by a derivation check in
 * pre-push.test.ts, which parses those shell sources — adding a skill to a tier without
 * adding it here (or vice versa) fails that test, so this half is a GATE, not attention.
 */
export const SHIPPED_SKILL_SLUGS: readonly string[] = [
  'ai-doc',
  'aif-doctor',
  'arch',
  'claude-glm-executor-handoff',
  'dispatcher',
  'getff',
  'harvest',
  'night-mode',
  'orchestrator',
  'pipeline',
  'reviewer',
  'rule-research',
  'rule-tests',
  'story',
  'template-audit',
  'tool-bootstrapping',
];

/**
 * The consumer-local record of what the installer actually delivered:
 * `.ai-factory/refresh-baseline.json`, a `{ "<consumer-relative dst>": "<sha256>" }` map
 * written by refresh_baseline_flush (setup.d/lib.sh:310-355) for every copy_safe /
 * refresh_safe delivery — which is how `.claude/agents/*.md` reaches a consumer.
 *
 * Returns null when the manifest is absent or unreadable/not an object. The installer
 * itself is fail-open here (no jq ⇒ no manifest), so null is an expected state, not an
 * error — the caller falls back to the pre-A4-8 blanket treatment for `.claude/agents/`,
 * which errs toward NOT blocking a consumer's push on our own shipped content.
 */
function refreshBaselinePaths(): ReadonlySet<string> | null {
  const manifest = resolve(REPO_ROOT, '.ai-factory/refresh-baseline.json');
  if (!existsSync(manifest)) return null;
  try {
    const parsed: unknown = JSON.parse(readFileSync(manifest, 'utf8'));
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed))
      return null;
    return new Set(Object.keys(parsed as Record<string, unknown>));
  } catch {
    return null;
  }
}

/**
 * Is `p` (a consumer-relative path) framework-shipped markdown?
 *
 * `baseline` is {@link refreshBaselinePaths}'s result — the delivery record. When it is
 * null the `.claude/agents/` subtree is treated as shipped wholesale (the pre-A4-8
 * behaviour) rather than walked: a consumer whose installer could not write the manifest
 * must not start failing pushes on OUR agents' framework-internal refs.
 *
 * Exported for pre-push.test.ts (classification arms + the SHIPPED_SKILL_SLUGS drift check).
 */
export function isFrameworkShippedMarkdown(
  p: string,
  baseline: ReadonlySet<string> | null,
): boolean {
  if (SHIPPED_MD_DESTINATIONS.includes(p)) return true;
  if (SHIPPED_MD_PREFIXES.some((x) => p.startsWith(x))) return true;
  if (
    SHIPPED_SKILL_SLUGS.some((slug) => p.startsWith(`.claude/skills/${slug}/`))
  )
    return true;
  if (baseline !== null) return baseline.has(p);
  return p.startsWith('.claude/agents/');
}

// plugin/agents/*.md are BYTE-IDENTICAL copies of agents/*.md — principle 24(d)
// (24-plugin-manifest-integrity.test.ts) compares bytes, and
// scripts/generate-plugin-twins.sh:164-166 states the agent arm is a bare `cp`:
// "No header, no marker, no transform".
//
// The twin sits ONE DIRECTORY DEEPER than its source, so a `](../x)` link that
// resolves from `agents/` resolves to `plugin/x` from `plugin/agents/` — a path that
// does not exist — and byte-identity forbids rewriting the depth in the copy. Checking
// the twin therefore re-checks the SOURCE's link text at the wrong depth: zero extra
// signal, guaranteed false positives on every relative link a source agent carries.
//
// COVERAGE IS NOT LOST, and the replacement is a mechanism rather than attention
// (attention-is-not-a-mechanism.md §1): (a) the source `agents/*.md` is walked by this
// same section; (b) a twin can never legitimately carry content its source does not —
// principle 24(d) goes RED on any divergence, and the generator REFUSES to write a twin
// that matches neither the source nor that source at HEAD
// (generate-plugin-twins.sh:189-205). So the twin's link text is always some source's
// link text, checked at the source path.
//
// Applies on BOTH layouts, unlike the S2 Part 1 narrowing below: the depth mismatch is
// structural, not consumer-specific (a consumer has no plugin/agents/ at all, so this is
// inert there).
//
// Measured 2026-09-02 (PR #1574): converting `agents/compliance-verifier.md`'s bare
// factory paths to the relative-link form the installer rewrites made THIS section go RED
// on plugin/agents/compliance-verifier.md with three
// `plugin/.claude/rules/phase-research-coverage.md | File not found` errors, while the
// source file was clean. That is why none of the three twinned agents carried a single
// `](../…)` link while every non-twinned agent did.
//
// Rejected alternative: root-relative links `](/…)`. This section DOES pass `--root-dir`
// (below), so lychee would resolve them at both depths — but `transform_internal_refs`
// (setup.d/lib.sh:147-163) only matches `](../…)`, so a root-relative ref would ship
// VERBATIM into consumer projects and dangle there. It fixes the gate and keeps the
// defect.
const PLUGIN_AGENT_TWIN_PREFIX = 'plugin/agents/';

function lycheeSection(ctx: SectionCtx): void {
  const { rb } = ctx;
  if (rb.base !== null) {
    let changedMd = getChangedFiles(rb.base, 'ACMR', rb.head).filter((f) =>
      f.endsWith('.md'),
    );
    // Plugin agent twins: byte-identical copies one directory deeper than their
    // agents/ source, so every relative link in them resolves to a non-existent
    // plugin/… path. Excluded on BOTH layouts — see PLUGIN_AGENT_TWIN_PREFIX above for
    // why this loses no coverage.
    {
      const before = changedMd.length;
      changedMd = changedMd.filter(
        (f) => !f.startsWith(PLUGIN_AGENT_TWIN_PREFIX),
      );
      const excluded = before - changedMd.length;
      if (excluded > 0) {
        process.stdout.write(
          `  · §8 lychee: excluded ${excluded} plugin/agents twin(s) — byte-identical copies, link-checked at their agents/ source\n`,
        );
      }
    }
    // History: the orchestrator-prompts corpus was briefly excluded on legacy
    // touches (2026-08-21 host-verify retrofit, A/M split) with a re-entry
    // trigger; the trigger FIRED the same day (PR: legacy lint+link repair —
    // 340 offline errors repaired to zero across 3670 checked links) and the filter
    // was dropped. The whole corpus is link-checked again.
    //
    // S2 §2 Part 1: on a consumer layout, exclude framework-shipped markdown so a
    // consumer's push is not blocked by shipped content's framework-internal refs
    // (which resolve here but dangle in a consumer checkout). Scoped to consumer
    // layouts via isFrameworkRepo — on the framework repo these same paths are
    // authoring locations whose refs resolve against framework files (lychee covers
    // them there). Closes the getff-honest-signals defect class: a consumer whose
    // own changed markdown is clean still got blocked by our shipped content.
    if (!ctx.isFrameworkRepo) {
      // The exclusion set is the DELIVERY record (.ai-factory/refresh-baseline.json)
      // plus the shipped skill slugs — never a whole `.claude/skills/` or
      // `.claude/agents/` subtree, which used to swallow every consumer-AUTHORED skill
      // and agent (ledger A4-8). Read once per push, not per file.
      const baseline = refreshBaselinePaths();
      const before = changedMd.length;
      changedMd = changedMd.filter(
        (f) => !isFrameworkShippedMarkdown(f, baseline),
      );
      const excluded = before - changedMd.length;
      if (excluded > 0) {
        process.stdout.write(
          `  · §8 lychee: excluded ${excluded} framework-shipped *.md (S2 Part 1 narrowing; consumer-authored only)\n`,
        );
      }
      if (baseline === null && before > 0) {
        // Loud, because the fallback is the BROAD one: without the delivery record the
        // whole `.claude/agents/` subtree is treated as shipped, so a consumer-authored
        // agent there is not link-checked. Re-running the installer writes the manifest.
        process.stdout.write(
          '  · §8 lychee: .ai-factory/refresh-baseline.json absent or unreadable — .claude/agents/*.md excluded wholesale (re-run the installer to record the delivery set and get consumer-authored agents checked)\n',
        );
      }
    }
    if (changedMd.length > 0) {
      // --root-dir: root-relative links (leading /) resolve against the repo
      // root instead of erroring out unresolved (the class surfaced by the
      // legacy corpus repair; without it lychee cannot even form a URL for
      // such links, so exclude patterns cannot see them either).
      const r = run('lychee', [
        '--offline',
        '--no-progress',
        '--root-dir',
        REPO_ROOT,
        ...changedMd,
      ]);
      if (r.notFound) {
        process.stdout.write(
          '⚠ lychee not found in PATH — offline link check skipped.\n',
        );
        process.stdout.write(
          '  Install: cargo install lychee   OR   brew install lychee\n',
        );
      } else {
        emit(r);
        if (r.exitCode !== 0) {
          die(
            '❌ lychee found broken links in changed Markdown files — fix before push',
            r,
          );
        }
      }
    }
  } else {
    warnSkip('§8', 'no resolvable base for the changed-Markdown link check');
  }
}

/**
 * The ordered section registry — the SSOT for pre-push composition. Ordering is
 * preserved from the historical inline main() body (§1 actionlint before §2 zizmor;
 * trailer checks after the render/meta gates; lychee + ci-tool-pinning last). On a
 * consumer layout the maintainer entries are simply not composed — their relative
 * order among the surviving consumer/both entries is unchanged.
 */
const SECTIONS: readonly PrePushSection[] = [
  // FIRST by design: must land the symlinks before any section shells out to vitest, which
  // would otherwise plant node_modules/.vite and freeze this worktree out of provisioning
  // permanently (incident 2026-07-23). composeSections() filters, preserving this order.
  {
    id: 'worktree-provisioning',
    owner: 'maintainer',
    run: () => worktreeProvisioningSection(),
  },
  { id: 'actionlint', owner: 'maintainer', run: () => actionlintSection() },
  { id: 'zizmor-live', owner: 'maintainer', run: () => zizmorLiveSection() },
  {
    id: 'zizmor-templates',
    owner: 'maintainer',
    run: () => zizmorTemplatesSection(),
  },
  { id: 'audit-ai-docs', owner: 'maintainer', run: () => auditAiDocsSection() },
  { id: 'skill-drift', owner: 'maintainer', run: () => skillDriftSection() },
  { id: 'rule-globs', owner: 'consumer', run: () => ruleGlobsSection() },
  {
    id: 'lint-staged-resolves',
    owner: 'consumer',
    run: () => lintStagedResolvesSection(),
  },
  {
    id: 'generated-rule-material',
    owner: 'consumer',
    run: () => generatedRuleMaterialSection(),
  },
  {
    id: 'kickoff-portability',
    owner: 'maintainer',
    run: () => kickoffPortabilitySection(),
  },
  { id: 'synth-bundle', owner: 'maintainer', run: () => synthBundleSection() },
  {
    id: 'shipped-rule-drift',
    owner: 'maintainer',
    run: (c) => shippedRuleDriftSection(c),
  },
  {
    id: 'manifest-render',
    owner: 'maintainer',
    run: () => manifestRenderSection(),
  },
  {
    id: 'rule-index-render',
    owner: 'maintainer',
    run: () => ruleIndexRenderSection(),
  },
  {
    id: 'principles-meta',
    owner: 'maintainer',
    run: () => principlesMetaSection(),
  },
  { id: 'ir-meta', owner: 'maintainer', run: () => irMetaSection() },
  {
    id: 'backends-meta',
    owner: 'maintainer',
    run: () => backendsMetaSection(),
  },
  {
    id: 'composition-meta',
    owner: 'maintainer',
    run: () => compositionMetaSection(),
  },
  {
    id: 'spec-discipline',
    owner: 'maintainer',
    run: (c) => specDisciplineSection(c),
  },
  { id: 'prior-art', owner: 'maintainer', run: (c) => priorArtSection(c.rb) },
  { id: 's17', owner: 'maintainer', run: (c) => s17Section(c.rb) },
  {
    id: 'guard-liveness',
    owner: 'maintainer',
    run: (c) => guardLivenessEntry(c),
  },
  {
    id: 'cmd-script-liveness',
    owner: 'maintainer',
    run: (c) => cmdScriptLivenessEntry(c),
  },
  { id: 'lychee', owner: 'both', run: (c) => lycheeSection(c) },
  {
    // owner: 'both' — the WORKFLOW population (ci-tool-pinning.md §2 pop 1) is
    // "scanned on every push, framework and consumer repos alike"; the SHELL-SCRIPT
    // population (pop 2) is framework-only, gated inside the section body by
    // ctx.isFrameworkRepo. See the section docstring + owner-semantics block above.
    id: 'unpinned-tool-install',
    owner: 'both',
    run: (c) => unpinnedToolInstallSection(c),
  },
  {
    // arch-v2 S-E P3a: standing drift-guard on the always-on resident set size.
    // maintainer-only — ceiling is framework-derived; consumer layout has its own
    // CLAUDE.md. See alwaysonBudgetSection docstring + scripts/check-alwayson-budget.sh.
    id: 'alwayson-budget',
    owner: 'maintainer',
    run: () => alwaysonBudgetSection(),
  },
  {
    // advisor-pattern §8 item 6: ask-file schema + the answered⇒decisions-entry
    // cross-check. maintainer-only — the mailbox is this repo's coordination store;
    // a consumer layout has no advisor seat and no scripts/ directory to run.
    id: 'ask-file-schema',
    owner: 'maintainer',
    run: () => askFileSchemaSection(),
  },
];

/**
 * Compose the section list for a layout. FAIL-CLOSED: an entry whose owner is not a
 * valid classification throws — an untagged/mistagged section aborts the push loudly
 * (a leak is worse than a hard stop; the maintainer sees it immediately). Exported so
 * principle test 32 can exercise the throw directly on a crafted registry.
 */
export function composeSections(
  sections: readonly PrePushSection[],
  isFrameworkRepo: boolean,
): PrePushSection[] {
  const wanted: SectionOwner = isFrameworkRepo ? 'maintainer' : 'consumer';
  return sections.filter((s) => {
    if (!s.owner || !VALID_OWNERS.includes(s.owner)) {
      throw new Error(
        `pre-push section '${s.id}' has no valid owner tag (got ${JSON.stringify(
          s.owner,
        )}) — refusing to compose (fail-closed). Tag it consumer|maintainer|both.`,
      );
    }
    return s.owner === 'both' || s.owner === wanted;
  });
}

/** The sections active for the current layout (see {@link composeSections}). */
export function activeSections(isFrameworkRepo: boolean): PrePushSection[] {
  return composeSections(SECTIONS, isFrameworkRepo);
}

/** Exported for principle test 32 (registry completeness + owner validity). */
export { SECTIONS };

async function main(): Promise<void> {
  // Resolve the diff base ONCE, up front — this consumes git's pre-push stdin
  // (which must be read before any other use). All base-scoped sections (§6, §7,
  // §1.7, §8) thread the same ResolvedBase via SectionCtx.
  const rb = resolveBase();

  // Framework-vs-consumer layout signal (SSOT-register presence) — the SINGLE
  // detection axis, derived ONCE here and threaded via ctx.isFrameworkRepo. It drives
  // which owner-classes compose; no section re-derives it (ledger S-5 — lycheeSection
  // and unpinnedToolInstallSection each used to run their own existsSync, so one
  // boolean had three detection points).
  const isFrameworkRepo = existsSync(resolve(REPO_ROOT, SSOT_REL));
  const ctx: SectionCtx = { rb, isFrameworkRepo };

  // Test seam: run a single REGISTERED section in isolation, by its registry id (the
  // §7 anti-tautology end-to-end test sets PREPUSH_ONLY=prior-art so it exercises only
  // the prior-art logic, independent of the other sections' deps/env).
  //
  // Registry-driven since 2026-09-06 (ledger S-6). It used to be eight copy-pasted
  // `if (env === '<id>') { section(); exit(0); }` arms — four of which no test ever
  // set — and an unknown value (a typo like `ask-file-scheme`) fell through to the
  // FULL hook and still exited 0, i.e. a test could believe it had isolated a section
  // while running every maintainer gate. Now: every id in SECTIONS is a seam by
  // construction (no per-section code to forget), and an unmatched value FAILS LOUDLY
  // instead of silently running everything.
  //
  // The seam deliberately looks the section up in SECTIONS, not activeSections(): a
  // test isolating a maintainer section on a consumer-shaped fixture must still be
  // able to run it.
  const only = process.env['PREPUSH_ONLY'];
  if (only !== undefined && only !== '') {
    const section = SECTIONS.find((s) => s.id === only);
    if (!section) {
      die(
        `❌ PREPUSH_ONLY='${only}' matches no pre-push section id.\n` +
          `   Known ids: ${SECTIONS.map((s) => s.id).join(', ')}`,
      );
    }
    await section.run(ctx);
    process.exit(0);
  }

  // Compose ONLY the sections this layout owns, then run them in registry order.
  // A maintainer-only section is never in the consumer composition — it cannot leak.
  for (const section of activeSections(isFrameworkRepo)) {
    await section.run(ctx);
  }

  process.exit(0);
}

/**
 * Run main() ONLY when this module is the direct CLI entrypoint (the .husky/pre-push
 * dispatcher `exec node --import tsx/esm .../pre-push.ts`), never on import. This lets
 * principle test 32 import the section registry (SECTIONS / activeSections) without
 * executing the hook — the standard Node ESM dual CLI/library idiom (parity with
 * runtime-bridge dispatch.ts, #968). Both paths are canonicalized (worktrees + macOS
 * /tmp reach the file through symlinks).
 */
function isDirectCliInvocation(): boolean {
  const argv1 = process.argv[1];
  if (!argv1) return false;
  try {
    return realpathSync(argv1) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isDirectCliInvocation()) {
  main().catch((err) => {
    process.stderr.write(
      `❌ pre-push hook crashed: ${(err as Error).message}\n`,
    );
    process.exit(1);
  });
}
