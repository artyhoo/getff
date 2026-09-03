/**
 * Principle 39 — no framework-only orchestration home inside a shipped skill's fences
 *
 * > **Authoritative for:** the literal `.claude/orchestrator-prompts` never appearing inside a
 * > fenced code block of a git-tracked file under `.claude/skills/`, except via the same-line
 * > escape token or a declared allowlist entry below.
 * > **NOT authoritative for:** project goal — see README.md#why-this-exists. Where the home
 * > actually resolves — that is `resolve_orch_home()` in
 * > `.claude/skills/pipeline/helpers/lib/common.sh`. The consumer-vs-framework namespace
 * > decision itself — see `.claude/rules/dual-implementation-discipline.md` §3.
 *
 * ## Why this gate exists
 *
 * `.claude/orchestrator-prompts/` is NEVER delivered to a consumer: the only install action is
 * `mkdir_safe "$PROJECT_ROOT/.ai-factory/orchestrator-prompts"` (setup.d/lib.sh:65-66,
 * setup.d/30-templates.sh:17). The skills are shipped byte-for-byte
 * (`copy_skill_with_transform`, setup.d/lib.sh:879), so a fence that hardcodes the framework
 * path executes against a directory that cannot exist — silently, because every such fence
 * ends in `2>/dev/null` or a `[ -d "$dir" ] || exit 0` short-circuit.
 *
 * That is not hypothetical. Issue #1245 measured four live sites in
 * `.claude/skills/pipeline/SKILL.md`: the §0 integer-name guard was a no-op in every consumer
 * install, the §1 plan cache reported "no cache — fresh session" on every invocation, and the
 * §2.5 backlog delta was not merely empty but *confidently wrong* (every id classified
 * `NEW-SINCE-LAST`, `RESOLVED-SINCE-LAST` never firing). The helpers had already been fixed to
 * resolve the home (#1244) — so the two halves of `/pipeline` read and wrote different
 * directories, and nothing noticed.
 *
 * `transform_internal_refs` (setup.d/lib.sh:94) already rewrites the *markdown-link* shape of
 * this same literal on delivery. This gate is the executable-fence half of that pair: the half
 * no transform can fix, because a fence is a command, not a link.
 *
 * ## Channel choice (.claude/rules/rule-enforcement-channel-selection.md §1/§3)
 *
 * "A literal appears inside a ``` fence" is mechanically detectable → gate, not injection.
 * A principle test is the earliest channel that actually fires for this population: the suite
 * runs at pre-push (`principlesMetaSection`, packages/core/hooks/pre-push.ts:1267) and in CI
 * (`principles-meta-tests`, audit-self.yml:210).
 *
 * ## Honest ceiling — the fence slice only
 *
 * The gate covers fenced code blocks. It deliberately does NOT cover the literal inside inline
 * `code` spans in prose, because separating a runtime instruction ("Target path: `…`") from
 * legitimate provenance ("Binding spec: `…§7`, gitignored") is a judgment call, and gating a
 * judgment is `#gate-where-judgment-needed`
 * (.claude/rules/rule-enforcement-channel-selection.md §5). The inline-code sites fixed under
 * #1245 were fixed by hand and stay a review-time concern. A fence, by contrast, is
 * unambiguously executed or copy-pasted — zero-judgment, so it is gated.
 *
 * ## Prior art (CLAUDE.md capability-commit gate) — SSOT #251
 *
 * markdownlint ships no built-in "forbid this literal, but only inside a fence" rule, and its
 * no-JS plugin `markdownlint-rule-search-replace` cannot scope a pattern to fenced blocks
 * (DeepWiki on DavidAnson/markdownlint, 2026-08-17) — which is precisely the half needed here,
 * since prose provenance mentions of the same literal must stay legal. Its `codeFenced` /
 * `codeFlowValue` fence-scoping vocabulary is ADOPTED.
 *
 * Note what is NOT the reason: `markdownlint-cli2` is already a devDependency (package.json:19)
 * run at .husky/pre-commit:92, so "it would add a dependency" would be false. The grounds are
 * that a custom micromark rule plus its own test surface exceeds ~40 LOC inside an existing
 * suite, and that the repo's markdownlint pass sees STAGED files only — it cannot make the
 * population-wide claim of arm (a) nor carry arm (e)'s shrink-only allowlist ratchet. If this
 * class ever needs the earlier pre-commit channel, the port target is a `customRules` entry on
 * that already-installed runner (SSOT #251 trigger), with this test kept as the population half.
 *
 * The markdown-doctest family (markdown-doctest, pytest-markdown-docs, mdtest, sphinx.ext.doctest)
 * is a T16 problem-class MISMATCH: those answer "does this example still run?", and running this
 * fence in framework CI passes by construction — CI is the one environment where the framework
 * path DOES exist. REFERENCE only. (The consumer-fixture arm in
 * tests/install-sh/consumer-pipeline.test.sh does execute the shipped fence, but against a real
 * `.ai-factory/` install — the environment no doctest runner supplies.)
 *
 * Escape-token shape reused verbatim from `.claude/rules/ci-tool-pinning.md` §3
 * (`# ci-tool-pin: allow <reason>`, same-line, rationale ≥20 chars) rather than invented.
 *
 * ## Anti-trap notes
 *
 * T3 — every arm reads real tracked files off disk; no arm asserts against a hand-copied list.
 * T15 (self-application) — arm (c) seeds the hardcode back into the REAL SKILL.md text and
 * re-runs the REAL scanner, so the failing direction is exercised, not assumed. Arm (e) keeps
 * the allowlist itself falsifiable: an entry that no longer has a hit is a hard failure, so
 * the debt list can only shrink.
 */
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../../');

/** The framework-only path that no consumer install ever receives. */
export const FRAMEWORK_ORCH_HOME = '.claude/orchestrator-prompts';

/**
 * Same-line opt-out, mirroring `ci-tool-pinning.md` §3's `# ci-tool-pin: allow <reason>`.
 * Written as a shell comment inside the fence, since fences are shell.
 */
const ESCAPE = /orch-home:\s*allow\s+(\S.*)$/;

/** Minimum rationale length — "TODO" must not buy an exemption (ci-tool-pinning.md §3). */
const MIN_RATIONALE = 20;

/**
 * Files whose fences are recorded OUTPUT, not instructions.
 *
 * The /pipeline eval fixtures are transcripts of a framework-repo run; the framework path in
 * them is the correct expected value, and a transcript cannot carry a shell comment without
 * ceasing to be the thing it records.
 */
export const NON_EXECUTABLE_FIXTURES = new Map<string, string>([
  [
    '.claude/skills/pipeline/evals/files/scenario-1-noarg-state.md',
    'captured helper output from a framework-repo run — an expected-value transcript, not an instruction to execute',
  ],
]);

/**
 * Known unfixed occurrences, each a real defect of the same class as #1245.
 *
 * This is a debt list, not an exemption policy: arm (e) fails when an entry has no remaining
 * hit, so a fixed file MUST be deleted from here. The list can only shrink.
 *
 * Empty since the consumer-layout-probe-honesty L2 stage (issue 1414, 2026-09-02): the
 * `.claude/skills/dispatcher/SKILL.md` entry was discharged — the probe helper resolves the
 * orch home inline, §2.8's fence resolves it, and §2.1's framework-only line carries the
 * same-line escape. The mechanism stays (an empty Map) so future debts have a home.
 */
export const KNOWN_GAPS = new Map<string, string>([]);

/** One offending line inside a fenced code block. */
export interface FenceHit {
  readonly line: number;
  readonly text: string;
  /** The same-line escape rationale, or `null` when the line carries no escape token. */
  readonly rationale: string | null;
}

/**
 * Every line inside a ``` fence that names the framework-only home.
 *
 * Fence tracking is a simple open/close toggle on ```-prefixed lines: `/pipeline` fences are
 * plain (```!, ```bash, ```) and never nested, and a toggle cannot mistake prose for code the
 * way a "does this line look like a command" heuristic would.
 */
export function fenceHits(source: string): FenceHit[] {
  const hits: FenceHit[] = [];
  let inFence = false;
  const lines = source.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*```/.test(lines[i])) {
      inFence = !inFence;
      continue;
    }
    if (!inFence || !lines[i].includes(FRAMEWORK_ORCH_HOME)) continue;
    const m = lines[i].match(ESCAPE);
    hits.push({
      line: i + 1,
      text: lines[i],
      rationale: m ? m[1].trim() : null,
    });
  }
  return hits;
}

/** Git-tracked markdown/template files under `.claude/skills/`. */
export function skillDocs(): string[] {
  const out = execFileSync(
    'git',
    [
      'ls-files',
      '.claude/skills/*.md',
      '.claude/skills/**/*.md',
      '.claude/skills/**/*.template',
    ],
    { cwd: REPO_ROOT, encoding: 'utf8' },
  );
  return out.split('\n').filter(Boolean);
}

/** Unescaped hits per file, with allowlisted files removed. */
export function violations(files: string[]): Map<string, FenceHit[]> {
  const found = new Map<string, FenceHit[]>();
  for (const f of files) {
    if (NON_EXECUTABLE_FIXTURES.has(f) || KNOWN_GAPS.has(f)) continue;
    const bad = fenceHits(readFileSync(resolve(REPO_ROOT, f), 'utf8')).filter(
      (h) => h.rationale === null,
    );
    if (bad.length) found.set(f, bad);
  }
  return found;
}

describe('Principle 39 — shipped skill fences never hardcode the framework orch-home', () => {
  const files = skillDocs();

  it('(a) real-tree: no fenced line under .claude/skills/ names .claude/orchestrator-prompts', () => {
    const found = violations(files);
    const report = [...found].flatMap(([f, hs]) =>
      hs.map((h) => `  ${f}:${h.line}  ${h.text.trim()}`),
    );
    expect(
      report,
      `These fenced lines hardcode \`${FRAMEWORK_ORCH_HOME}\`, which no consumer install ever ` +
        `receives (setup.d/lib.sh:65-66) — the fence runs against a directory that cannot exist:\n` +
        report.join('\n') +
        `\n\nResolve the home instead: \`"$(bash "\${CLAUDE_SKILL_DIR}/helpers/print-orch-home.sh" 2>/dev/null)"\`. ` +
        `If a fence genuinely must name the framework path, append a same-line ` +
        `\`# orch-home: allow <why, ≥${MIN_RATIONALE} chars>\`.`,
    ).toEqual([]);
  });

  it('(b) non-vacuity: the population and the scanner both see real content', () => {
    expect(
      files.length,
      `expected ≥10 tracked skill docs; got ${files.length}`,
    ).toBeGreaterThanOrEqual(10);
    expect(files, 'the /pipeline SKILL.md must be in the population').toContain(
      '.claude/skills/pipeline/SKILL.md',
    );
    // A scanner that never enters a fence would make arm (a) pass for the wrong reason.
    const probe = fenceHits(
      ['prose', '```bash', `cd ${FRAMEWORK_ORCH_HOME}`, '```'].join('\n'),
    );
    expect(
      probe.map((h) => h.line),
      'the scanner must see inside a fence',
    ).toEqual([3]);
    expect(
      fenceHits(`prose mentioning ${FRAMEWORK_ORCH_HOME} outside any fence`),
      'prose outside a fence is not in scope (see the honest-ceiling note above)',
    ).toEqual([]);
  });

  it('(c) paired-negative (seeded hardcode): GREEN on the real file, RED when the literal is seeded back', () => {
    const target = '.claude/skills/pipeline/SKILL.md';
    const src = readFileSync(resolve(REPO_ROOT, target), 'utf8');

    // GREEN direction — the real, unmodified file.
    expect(fenceHits(src).filter((h) => h.rationale === null)).toEqual([]);

    // RED direction — reinstate the exact §1 hardcode issue #1245 reported, in the real text.
    const seeded = src.replace(
      /^head -200 "\$\(bash .*print-orch-home\.sh.*$/m,
      'cat .claude/orchestrator-prompts/_plan-cache.md 2>/dev/null | head -200',
    );
    expect(
      seeded,
      'the seeded mutation must actually change the file text',
    ).not.toBe(src);
    const bad = fenceHits(seeded).filter((h) => h.rationale === null);
    expect(bad.length, 'a re-introduced fence hardcode must be detected').toBe(
      1,
    );
    expect(bad[0].text).toContain('_plan-cache.md');
  });

  it('(d) the escape token suppresses a hit, and only with a substantive rationale', () => {
    const withEscape = [
      '```bash',
      `ls ${FRAMEWORK_ORCH_HOME}  # orch-home: allow framework-only dogfood path, never shipped`,
      '```',
    ].join('\n');
    const [hit] = fenceHits(withEscape);
    expect(hit.rationale, 'the escape rationale must be captured').toMatch(
      /framework-only/,
    );
    expect(hit.rationale!.length).toBeGreaterThanOrEqual(MIN_RATIONALE);

    // A bare token with no reason must not read as an escape.
    const bare = [
      '```bash',
      `ls ${FRAMEWORK_ORCH_HOME}  # orch-home: allow`,
      '```',
    ].join('\n');
    expect(
      fenceHits(bare)[0].rationale,
      'a reasonless token must not exempt the line',
    ).toBeNull();
  });

  it('(e) allowlist hygiene: every allowlisted file still exists, still has a hit, and carries a rationale', () => {
    for (const [file, rationale] of [
      ...NON_EXECUTABLE_FIXTURES,
      ...KNOWN_GAPS,
    ]) {
      expect(
        files,
        `allowlisted file \`${file}\` is not a tracked skill doc — stale entry, delete it`,
      ).toContain(file);
      expect(
        fenceHits(readFileSync(resolve(REPO_ROOT, file), 'utf8')).length,
        `allowlisted file \`${file}\` has no fenced hit left — it was fixed; delete the entry so ` +
          `the exemption cannot silently cover a future regression`,
      ).toBeGreaterThan(0);
      expect(
        rationale.trim().length,
        `allowlist entry \`${file}\` needs a rationale of ≥${MIN_RATIONALE} chars saying WHY`,
      ).toBeGreaterThanOrEqual(MIN_RATIONALE);
    }
  });
});
