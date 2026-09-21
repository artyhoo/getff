/**
 * Principle 45 — pre-push contract claim liveness.
 *
 * A document that tells a reader WHAT the pre-push hook runs is asserting a
 * falsifiable property about a file it does not own (the section registry in
 * `packages/core/hooks/pre-push.ts`). Nothing verified that property, so it drifted —
 * and kept shipping:
 *
 *   Commit a69fa356af6 (PR #129, «Wave 10.5 — bash-fallback + install.sh feature
 *   detection», merged with zero reviews) removed typecheck, `vitest related` and
 *   dependency-cruiser from `packages/core/templates/shared/husky-pre-push.sh`. Its
 *   own body says «Zero edits to pre-push.ts». Eight-plus shipped surfaces went on
 *   asserting those four checks for four months, and one of them —
 *   `skill-context/aif-rules-check/SKILL.md:18` — instructs the consumer's agent NOT
 *   to re-run the checks BECAUSE pre-push allegedly already did.
 *
 * That is the difference in kind this gate exists for: a false claim in a shipped
 * standing instruction is not read by a human who might squint at it, it is ACTED ON
 * by a machine every session.
 *
 * WHY NO EXISTING CHANNEL CAUGHT IT — `check:shields-up` verifies the hook is present,
 * executable and wired, but never executes the chain; its own header says so
 * (`packages/core/hooks/pre-push.consumer-layout.test.ts`, diagnosed there for
 * #920/#921). Presence is not behaviour. The remaining detector was «a reviewer will
 * notice», i.e. `#hope-as-gate` (`.claude/rules/attention-is-not-a-mechanism.md §2`).
 *
 * THE CONTRACT IS NOT THE OLD ONE — and that is deliberate. A consumer's pre-push
 * carries getff's OWN rule checks; the consumer's typecheck / tests / dependency-cruiser
 * are consumer-owned (`docs/meta-factory/research-patches/2026-07-26-lane-channel-parity-audit.md:61`
 * and `:128`; the python lane is built identically — `packages/core/templates/python/hooks/pre-push.sh`
 * runs getff's ast-grep + ruff packs, not the consumer's pytest). So this gate must
 * NOT be read as «restore the four checks». It asserts only that prose and registry
 * agree, in whichever direction they are made to agree.
 *
 * MECHANISM — polarity, not a blacklist. The gate never knows that `typecheck` is the
 * wrong answer. It resolves each enumerated item against the LIVE registry
 * (`composeSections(SECTIONS, isFrameworkRepo)` + the python lane's arms, both read at
 * run time) and reddens when an item names a check that nothing implements, or names a
 * section not composed for that document's audience. Rename a section and the aliases
 * go RED; delete one and every doc still promising it goes RED. There is no second
 * copy of the contract to drift.
 *
 * POPULATION — enumerated by PREDICATE over the whole shipped corpus, never by a
 * hand-picked file list. This is load-bearing: the manual verification pass that found
 * this defect enumerated DOCUMENTS and reported eight surfaces; enumerating CLAIMS
 * finds sixteen. The eight it missed include `INSTALL-FOR-AI.md:354` (an ASCII tree cite:historical line numbers as of the pre-#1784 defect state
 * annotation), `README.md:229` (a table cell), the three `packages/preset-*\/RULES.md:7` cite:historical line numbers as of the pre-#1784 defect state
 * lines, and `skills/getff/references/checks-map.md:43`+`:143` with their `plugin/` cite:historical line numbers as of the pre-#1784 defect state
 * twins. The `corpus covers every markdown-bearing shipped pathspec` arm keeps the
 * pathspec list honest by DERIVING the shipped surface from `scripts/format-shipped.sh`
 * — the repo's shipped-surface SSOT — instead of trusting the list to be maintained.
 *
 * CHANNEL — a principle test, not a new pre-push section, for three reasons. (i) The
 * invariant is relational over the whole corpus AND the registry, so it is not
 * change-scoped: a pre-commit arm over changed files would be green whenever only the
 * OTHER side moved, which is precisely how #129 landed. (ii) The repo's other
 * doc↔machinery liveness gates live here (37 make-target claims, 24 plugin-twin
 * byte-identity, 31 channel declaration). (iii) Principle tests still run at pre-push,
 * via `principlesMetaSection`, AND in CI via `audit-self.yml` — so this IS the earliest
 * reachable channel for a repo-wide relational property, not a retreat to CI
 * (README.md#why-this-exists).
 *
 * ESCAPE HATCH — `prepush-claim: allow <rationale>` on the same unit, rationale ≥20
 * chars. Token shape mirrors `ci-tool-pin: allow` (`.claude/rules/ci-tool-pinning.md §3`)
 * and `make-claim: allow` (principle 37); the ≥20-char floor is the stricter `CLAUDE.md`
 * `Prior-art: skipped —` posture, because the failure being escaped is a doc lying
 * about itself.
 *
 * QUARANTINE — the 16 sites that were already false when this shipped are recorded in
 * `KNOWN_UNBACKED_CLAIMS` (their prose repair is a separate docs-only PR; duplicating
 * it here would collide). It is a ratchet, not an allowlist: a row that no longer
 * matches a live violation is ITSELF a failure, so the docs PR must delete its rows in
 * the same change. See the module's §5 comment.
 *
 * PAIRED NEGATIVES (principle 02): N45-1 false claim → RED; N45-2 true claim → GREEN
 * (the gate discriminates, it does not flag every claim); N45-3 escape with a real
 * rationale → GREEN; N45-4 escape without one → still RED; N45-5 bare mention with no
 * enumeration → not a claim; N45-6 a NEGATED clause → not a claim; N45-7 a maintainer
 * section claimed on a SHIPPED surface → RED, the same claim in framework-internal
 * prose → GREEN; N45-8 a quarantine row matching nothing → RED.
 */
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { SECTIONS, composeSections } from '../hooks/pre-push.ts';
import {
  ALIASES,
  CLAIM_CORPUS_PATHSPECS,
  KNOWN_UNBACKED_CLAIMS,
  REPO_ROOT,
  enumerateCorpus,
  extractClaims,
  findViolations,
  isShippedSurface,
  loadCorpus,
  partition,
  pythonLaneIds,
  toolchainTokens,
} from './45-prepush-contract-claim-liveness.ts';

const python = pythonLaneIds();
const consumerIds = new Set([
  ...composeSections(SECTIONS, false).map((s) => s.id),
  ...python,
]);
const allIds = new Set([...SECTIONS.map((s) => s.id), ...python]);
const implemented = (file: string) =>
  isShippedSurface(file) ? consumerIds : allIds;

describe('Principle 45 — pre-push contract claim liveness', () => {
  it('precondition: the registry composes a non-empty consumer section set', () => {
    // Everything downstream resolves against these two sets. If composition ever
    // returns nothing, every claim would resolve to "not composed" and the main arm
    // would fail for the wrong reason — so assert the premise, not just the result.
    expect(SECTIONS.length).toBeGreaterThan(5);
    expect(consumerIds.size).toBeGreaterThan(2);
    expect(python.size).toBeGreaterThan(0);
  });

  it('alias integrity: every claim-vocabulary alias names a live section id', () => {
    // The hand-written half, gated from the other end. Rename or delete a section and
    // this arm goes RED in the same push — the alias table cannot silently rot into a
    // dictionary of ids that no longer exist.
    const dead = [...ALIASES.entries()].filter(([, id]) => !allIds.has(id));
    expect(
      dead,
      `ALIASES maps claim vocabulary onto section ids that the registry no longer ` +
        `defines: ${dead.map(([k, v]) => `${k} → ${v}`).join(', ')}. Update the alias ` +
        `table (or the section id) — a stale alias silently stops detecting claims.`,
    ).toEqual([]);
  });

  it('the corpus covers every markdown-bearing shipped pathspec', () => {
    // Derived, not declared. `scripts/format-shipped.sh` is the repo's SSOT for "what
    // ships"; if a new shipped subtree is added there and not here, this arm names it.
    // Without this, CLAIM_CORPUS_PATHSPECS is exactly the hand-maintained file list the
    // brief forbids — enumeration by document rather than by predicate.
    const src = readFileSync(
      resolve(REPO_ROOT, 'scripts/format-shipped.sh'),
      'utf8',
    );
    const block = /^PATHSPECS=\(\n([\s\S]*?)^\)/m.exec(src);
    expect(
      block,
      'PATHSPECS block not found in scripts/format-shipped.sh',
    ).not.toBeNull();
    const specs = block![1]
      .split('\n')
      .map((l) => l.replace(/#.*$/, '').trim())
      .filter(Boolean)
      .flatMap((l) => l.split(/\s+/));
    expect(specs.length).toBeGreaterThan(5);

    const shipped = execFileSync('git', ['ls-files', '-z', '--', ...specs], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    })
      .split('\0')
      .filter((f) => /\.(md|template)$/.test(f));
    expect(shipped.length).toBeGreaterThan(20);

    const corpus = new Set(enumerateCorpus());
    const missing = shipped.filter((f) => !corpus.has(f));
    expect(
      missing,
      `These shipped markdown surfaces are outside CLAIM_CORPUS_PATHSPECS, so a false ` +
        `pre-push claim in them would never be seen: ${missing.join(', ')}`,
    ).toEqual([]);
  });

  it('the corpus covers every tracked markdown at the repo root', () => {
    // The other half of the population, gated the same way — from git, not from a list.
    // Principle 45 shipped with five root canon files named by hand, and that hand-picked
    // spelling is what hid `INSTALL.md:439` («pre-push ← typecheck + tests + arch + cite:historical line number at the time the parallel docs branch found it
    // audit»): the claims INSIDE each listed file were enumerated by predicate, but the
    // list of files was not. A parallel docs branch found it; this gate did not. Root
    // canon is small, uniformly authoritative, and cheap to take whole — so take it whole.
    const roots = execFileSync('git', ['ls-files', '-z', '--', ':(glob)*.md'], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
    })
      .split('\0')
      .filter(Boolean);
    expect(roots.length).toBeGreaterThan(5);

    const corpus = new Set(enumerateCorpus());
    const missing = roots.filter((f) => !corpus.has(f));
    expect(
      missing,
      `These root-level canonical documents are outside CLAIM_CORPUS_PATHSPECS, so a ` +
        `false pre-push claim in them would read green: ${missing.join(', ')}`,
    ).toEqual([]);
  });

  it('not vacuous: the corpus yields real claims', () => {
    // A broken anchor regex, or an enumerator that stopped seeing files, makes the main
    // arm pass trivially: zero claims → zero violations → green. That is the shape of a
    // "clean" audit with no population enumeration (T3/T10).
    const files = enumerateCorpus();
    expect(files.length).toBeGreaterThan(50);
    const claims = loadCorpus().flatMap((e) =>
      extractClaims(e.file, e.content),
    );
    expect(
      claims.length,
      'Zero pre-push contract claims extracted across the whole shipped corpus. The ' +
        'gate cannot be green for that reason — check the mention anchor and the ' +
        'corpus enumerator.',
    ).toBeGreaterThanOrEqual(20);
  });

  it('no document asserts a pre-push behaviour the registry does not implement', () => {
    const violations = findViolations(
      loadCorpus(),
      implemented,
      toolchainTokens(),
    );
    const { blocking } = partition(violations);
    expect(
      blocking.map((v) => `${v.file}:${v.line} — ${v.reason}`),
      'A shipped or canonical document promises a pre-push check that the section ' +
        'registry does not run for that audience. Fix the PROSE (the contract is that ' +
        'the consumer hook carries getff’s own rule checks, not the consumer’s ' +
        'typecheck/tests) — or, if the claim is genuinely about something else, add ' +
        '`prepush-claim: allow <≥20-char rationale>` on that line.',
    ).toEqual([]);
  });

  it('the quarantine is self-cleaning: every recorded row still matches a violation', () => {
    const violations = findViolations(
      loadCorpus(),
      implemented,
      toolchainTokens(),
    );
    const { stale } = partition(violations);
    expect(
      stale.map((s) => `${s.file} — ${s.item}`),
      'KNOWN_UNBACKED_CLAIMS records claims that are no longer false. That is good ' +
        'news and a required edit: delete these rows from ' +
        'packages/core/principles/45-prepush-contract-claim-liveness.ts. A suppression ' +
        'list nobody is forced to shrink is #hope-as-gate with extra steps.',
    ).toEqual([]);
  });

  it('false-positive floor: ordinary pre-push prose is not a claim', () => {
    // The measurement that shaped the anchors. Each of these mentions the hook; none
    // asserts a check SET. An earlier draft that treated every enumeration item near a
    // mention as a check produced 60+ findings on the live corpus, none about the
    // contract — which is why the item vocabulary is derived from setup.d/70-deps.sh
    // and why a bare mention yields no segment at all.
    const prose = [
      'Do not bypass the pre-push hook with `--no-verify`; it exists for a reason.',
      'The pre-push hook is installed by husky and wired at `.husky/pre-push`.',
      'Run `git push --dry-run` to exercise the pre-push hook without publishing.',
      'principle 11 F1 enforces it at pre-push, not at edit-time.',
      'The pre-push hook does not run typecheck or dependency-cruiser.',
    ];
    const v = findViolations(
      prose.map((content) => ({ file: SHIPPED_FIXTURE, content })),
      () => consumerIds,
      FAKE_TOOLCHAIN,
    );
    expect(v.map((x) => x.item)).toEqual([]);
  });
});

/* ── paired negatives (principle 02) ─────────────────────────────────────────
 * Driven by a FIXED synthetic registry, so these arms keep discriminating when the
 * real section set legitimately changes — the same isolation principle 37 uses.
 */
const SHIPPED_FIXTURE = 'packages/core/templates/shared/AGENTS.md.template';
const FRAMEWORK_FIXTURE = 'CONTRIBUTING.md';
const FAKE_TOOLCHAIN = new Set([
  'typecheck',
  'vitest',
  'tsc',
  'dependency-cruiser',
]);
const FAKE_CONSUMER = new Set(['rule-globs', 'lint-staged-resolves']);
const FAKE_ALL = new Set([...FAKE_CONSUMER, 'audit-ai-docs']);
const fakeImplemented = (file: string) =>
  isShippedSurface(file) ? FAKE_CONSUMER : FAKE_ALL;

const run = (file: string, content: string) =>
  findViolations([{ file, content }], fakeImplemented, FAKE_TOOLCHAIN);

describe('Principle 45 — paired negatives (principle 02)', () => {
  // The sentence the operator's brief quotes, verbatim in shape.
  const falseClaim =
    'The pre-push hook runs typecheck + `vitest related` + dependency-cruiser.';

  it('N45-1: a FALSE claim on a shipped surface is RED', () => {
    // The shipped defect, reconstructed. If this ever returns [], the gate would have
    // let #129 through and is theatre.
    const v = run(SHIPPED_FIXTURE, falseClaim);
    expect(v.map((x) => x.token)).toEqual([
      'typecheck',
      'vitest related',
      'dependency-cruiser',
    ]);
    expect(v[0].reason).toContain('no pre-push section implements');
  });

  it('N45-2: a TRUE claim is GREEN — the check discriminates', () => {
    // The anti-tautology leg: same shape, same file, same resolver; only the named
    // checks differ. A gate that flags both is just "every claim is a violation".
    expect(
      run(
        SHIPPED_FIXTURE,
        'The pre-push hook runs rule-globs + lint-staged binary resolution.',
      ),
    ).toEqual([]);
  });

  it('N45-3: the escape token with a real rationale is GREEN', () => {
    expect(
      run(
        SHIPPED_FIXTURE,
        `${falseClaim} <!-- prepush-claim: allow documented historical contract, ` +
          `repaired by the docs-truth PR -->`,
      ),
    ).toEqual([]);
  });

  it('N45-4: the escape token WITHOUT a ≥20-char rationale is still RED', () => {
    // The hatch must not be a blanket bypass — `allow TODO` is exactly the placeholder
    // CLAUDE.md's Prior-art hatch rejects.
    expect(
      run(SHIPPED_FIXTURE, `${falseClaim} <!-- prepush-claim: allow TODO -->`)
        .length,
    ).toBeGreaterThan(0);
    expect(
      run(SHIPPED_FIXTURE, `${falseClaim} <!-- prepush-claim: allow -->`)
        .length,
    ).toBeGreaterThan(0);
  });

  it('N45-5: a bare mention with no enumeration is not a claim', () => {
    // Flagging this would make the gate fire on every doc that merely names the hook.
    const content =
      'Install the pre-push hook before you start; husky wires it.';
    expect(extractClaims(SHIPPED_FIXTURE, content)).toEqual([]);
    expect(run(SHIPPED_FIXTURE, content)).toEqual([]);
  });

  it('N45-6: a NEGATED clause is not a claim', () => {
    // «the hook does NOT run typecheck» is the opposite of a false promise — it is the
    // sentence a correct doc uses. Reddening on it would punish the repair.
    expect(
      run(
        SHIPPED_FIXTURE,
        'The pre-push hook does not run typecheck or vitest.',
      ),
    ).toEqual([]);
  });

  it('N45-7: audience matters — a maintainer section promised to consumers is RED', () => {
    // `audit-ai-docs` is owner:'maintainer'; it is composed for the framework repo and
    // NOT for a consumer. The identical sentence is therefore true in CONTRIBUTING.md
    // and false in a shipped template — which is the whole reason the resolver takes
    // the file, not just the token.
    const claim = 'The pre-push hook runs rule-globs + audit-ai-docs.';
    const shipped = run(SHIPPED_FIXTURE, claim);
    expect(shipped).toHaveLength(1);
    expect(shipped[0].token).toBe('audit-ai-docs');
    expect(shipped[0].reason).toContain('NOT composed');
    expect(run(FRAMEWORK_FIXTURE, claim)).toEqual([]);
  });

  it('N45-8: a quarantine row that matches nothing is RED', () => {
    // The ratchet's own negative. Feed the partition an empty violation set — as if
    // every quarantined claim had just been repaired — and every row must surface as
    // stale. If this returns [], the self-cleaning arm above can never fire and the
    // quarantine has quietly become a permanent allowlist.
    const { stale } = partition([]);
    expect(stale.length).toBeGreaterThan(0);
    expect(stale.length).toBe(
      new Set(
        KNOWN_UNBACKED_CLAIMS.flatMap((r) =>
          r.items.map((i) => `${r.file}\0${i}`),
        ),
      ).size,
    );
  });
});
