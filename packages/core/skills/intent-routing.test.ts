// Intent-routing contract — intent-first-result S1, kickoff Task 1 fixtures
// (spec §3 routing rules, docs/superpowers/specs/2026-10-07-idea-arch-incremental-design.md:69-71).
//
// `/intent` is a product-only contour beside `/arch`: it owns clarifying and preserving
// PRODUCT intent (the brief) and reviewing the first working result against it — never
// solution design. This suite pins the routing boundary where it is canonically recorded:
// the intent procedure, the /arch ideation + exit references, and the CLAUDE.md
// skill-routing binding.
//
// Routing itself is judgment (rule-enforcement-channel-selection §1 — injection territory,
// not a gate). What is deterministic here is (a) every fixture's deciding rule is RECORDED
// at its canonical surface, and (b) each fixture names the ONE canonical sentence that
// routes it — removing that sentence flips the fixture RED (T22 flip-change). The
// domain-modeling permission and its preserved exclusion are asserted TOGETHER in both the
// binding (CLAUDE.md) and the procedure (intent SKILL.md) — neither may ship without the other.
//
// A1 extension (2026-10-12, intent-continuity slice A1): three fixtures pin the /arch + /intent
// wiring of the intent-fidelity checkpoint, the plan-preparation guard, and the approval
// recorder's pointer advance — the executable transitions of the agreed design §4/§6.
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, readlinkSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../..');

const INTENT_SKILL = '.agents/procedures/intent/SKILL.md';
const INTENT_BRIEF = '.agents/procedures/intent/references/product-brief.md';
const INTENT_REVIEW = '.agents/procedures/intent/references/result-review.md';
const IDEATION = '.agents/procedures/arch/references/ideation.md';
const EXIT = '.agents/procedures/arch/references/exit-and-escalation.md';
const ARCH_SKILL = '.agents/procedures/arch/SKILL.md';
const CLAUDE_MD = 'CLAUDE.md';

/** Read a canonical surface, failing with the routing-specific RED message when absent. */
function read(rel: string): string {
  const abs = resolve(REPO_ROOT, rel);
  if (!existsSync(abs)) {
    throw new Error(
      `MISSING canonical surface: ${rel} — RED on the missing /intent adapter/route is the expected pre-implementation state`,
    );
  }
  return readFileSync(abs, 'utf8');
}

/** One line of CLAUDE.md's Domain-vocabulary binding bullet (the injected layer). */
function domainVocabularyBullet(): string {
  const bullet = read(CLAUDE_MD)
    .split('\n')
    .find((l) => l.includes('**Domain vocabulary:**'));
  expect(bullet, 'Domain-vocabulary binding bullet not found in CLAUDE.md').toBeDefined();
  return bullet!;
}

interface RoutingFixture {
  id: string;
  scenario: string;
  route: string;
  /** Each entry is one canonical sentence that decides this fixture (file + its predicate). */
  decides: Array<{ file: string; re: RegExp }>;
}

const ROUTING_FIXTURES: RoutingFixture[] = [
  {
    id: 'substantial-unclear-work-routes-to-intent',
    scenario: 'a substantial feature whose product meaning is still unclear',
    route: '/intent',
    decides: [
      {
        file: INTENT_SKILL,
        re: /A substantial feature whose product meaning is still unclear enters `\/intent`/,
      },
      {
        file: IDEATION,
        re: /A substantial feature whose product meaning is unclear[^.]*routes to the product contour/,
      },
    ],
  },
  {
    id: 'approved-brief-skips-reinterview',
    scenario: 'a feature whose brief revision is already approved',
    route: 'restore from the approved snapshot — no second interview',
    decides: [
      { file: INTENT_SKILL, re: /An approved brief is reused without another interview/ },
      { file: IDEATION, re: /An approved product brief is reused without another interview/ },
    ],
  },
  {
    id: 'small-precise-work-stays-in-arch',
    scenario: 'a small, precisely-specified change',
    route: '/arch — no product session',
    decides: [
      { file: INTENT_SKILL, re: /Small precise changes stay in `\/arch`/ },
      { file: IDEATION, re: /[Ss]mall, precise changes stay here/ },
    ],
  },
  {
    id: 'named-arch-route-loads-canonical-intent-procedure',
    scenario: '/arch classifies the request as product work and routes it',
    route: 'explicitly load the canonical .agents/procedures/intent/SKILL.md — never keyword discovery',
    decides: [
      // ../../ from arch/references/ resolves to .agents/procedures/intent/ in BOTH the
      // canonical tree and the .claude/skills symlink view — a ../intent form is a broken
      // ref from references-depth in both (check-skill-drift.sh §1 BROKEN-REF).
      {
        file: IDEATION,
        re: /canonical intent procedure \[\.\.\/\.\.\/intent\/SKILL\.md\]\(\.\.\/\.\.\/intent\/SKILL\.md\)/,
      },
      { file: IDEATION, re: /the named route; never keyword discovery/ },
    ],
  },
  {
    id: 'spec-offered-only-through-intent-fidelity-checkpoint',
    scenario: 'a spec this contour produced is about to be offered for operator agreement',
    route: 'fresh artifact-only intent review, then --check-presentation exit 0',
    decides: [
      { file: IDEATION, re: /Intent-fidelity checkpoint \(2026-10-12, intent-continuity slice A1/ },
      // The gate command names the canonical helper + the bash orch-home resolver form —
      // a node-invoke of the resolver or a symlink-view path is a different (broken) command.
      {
        file: IDEATION,
        re: /--check-presentation --feature <feature-id> --spec <candidate-spec-path> --orch-home "\$\(bash \.agents\/procedures\/pipeline\/helpers\/print-orch-home\.sh\)"/,
      },
      { file: IDEATION, re: /publish-spec-review\.mjs --attempt/ },
      { file: IDEATION, re: /--advance-spec --feature <feature-id> --receipt <receipt\.json> --expect-revision <presentation-revision>/ },
      // IC-A: the reviewing seat is fresh and document-restored — no dialogue, no expected outcome.
      { file: IDEATION, re: /UNLABELED candidate spec/ },
      { file: IDEATION, re: /expected labels belong to test harnesses, not advisor input/ },
    ],
  },
  {
    id: 'plan-prep-gated-on-selected-current-authority',
    scenario: 'an executable handoff is prepared for feature work with recorded intent continuity',
    route: '--check-plan-prep exit 0 over the selected current PRD/spec/matches chain',
    decides: [
      { file: EXIT, re: /Plan-preparation guard for feature work with recorded intent continuity/ },
      { file: EXIT, re: /--check-plan-prep --feature <feature-id> \[--spec <exact-spec-path>\]/ },
      // The freeze discriminator answers "is this artifact legacy?" mechanically, not by judgment.
      { file: EXIT, re: /--classify-artifact --path <abs>/ },
      // Durable identity: deleting a kickoff cannot reclassify adopted work as legacy.
      { file: EXIT, re: /deleting a kickoff or its marker cannot reclassify adopted work as legacy/ },
    ],
  },
  {
    id: 'approval-recorder-advances-the-current-prd-pointer',
    scenario: 'an operator approval statement binds a preserved PRD snapshot',
    route: 'advance-prd with the exact-content receipt; supersession visibly invalidates spec agreement',
    decides: [
      { file: INTENT_BRIEF, re: /The approval recorder advances the current-decision pointer/ },
      { file: INTENT_BRIEF, re: /--advance-prd --feature <feature-id> --receipt <receipt\.json\|-> --expect-revision <captured-revision> --orch-home "\$\(bash \.agents\/procedures\/pipeline\/helpers\/print-orch-home\.sh\)"/ },
      { file: INTENT_BRIEF, re: /Never refresh this value just before recording/ },
      // IC-B made visible: a newer approved PRD clears currentSpec and demands renewed agreement.
      { file: INTENT_BRIEF, re: /renewed agreement is required before the spec can gate anything again/ },
    ],
  },
];

describe('intent-routing fixtures (S1 Task 1 — the product-only routing boundary)', () => {
  for (const fixture of ROUTING_FIXTURES) {
    it(`fixture: ${fixture.id} → ${fixture.route}`, () => {
      for (const d of fixture.decides) {
        const body = read(d.file);
        expect(
          d.re.test(body),
          `${fixture.id}: deciding rule absent from ${d.file}\n  expected: ${d.re}\n  this file routes the scenario only through that sentence — restore or reword it there`,
        ).toBe(true);
      }
    });
  }

  it('substantial is defined by promise scope, not by a document-length threshold', () => {
    // Spec §3: "Substantial work means maintaining a distinct promise across multiple
    // component/stage decisions, not crossing a document-length threshold." A LOC-shaped
    // routing rule would be a different (wrong) contract.
    expect(read(INTENT_SKILL)).toMatch(/not a document-length threshold/);
  });

  it('paired negative: the arch card stays thin — no product-route restatement in arch/SKILL.md', () => {
    // The card routes by reading its references; the product-route rule lives in
    // ideation.md (#parallel-evolution-creep — the contour card never re-describes a phase).
    expect(read(ARCH_SKILL)).not.toMatch(/\/intent/);
  });

  it('paired negative: no deciding rule matches a rule-free control body', () => {
    const control =
      '## Routing\nThis contour sends every request to the default next step. No product boundary is recorded here.';
    for (const fixture of ROUTING_FIXTURES) {
      for (const d of fixture.decides) {
        expect(d.re.test(control), `${fixture.id}: predicate matched a rule-free control`).toBe(
          false,
        );
      }
    }
  });
});

describe('fixture (e): domain-modeling permission + preserved exclusion — binding and procedure together', () => {
  it('CLAUDE.md binding permits domain-modeling in product discussions (direct /intent + named arch route)', () => {
    const bullet = domainVocabularyBullet();
    expect(bullet).toMatch(
      /never invoke `mattpocock-skills:domain-modeling` outside an idea session/,
    );
    expect(bullet).toMatch(/product discussion hosted by \[?`?\/intent/);
    expect(bullet).toMatch(/direct, or via the named `\/arch` product route/);
  });

  it('CLAUDE.md binding preserves the CONTEXT.md growth rule for ordinary word definitions', () => {
    const bullet = domainVocabularyBullet();
    expect(bullet).toMatch(/growth rule in \[CONTEXT\.md\]/);
    expect(bullet).toMatch(/explain the word, record it with the operator's spelling/);
    expect(bullet).toMatch(/no ADR is offered/);
  });

  it('the intent procedure mirrors the same permission and the same exclusion', () => {
    const skill = read(INTENT_SKILL);
    expect(skill).toMatch(/mattpocock-skills:domain-modeling/);
    expect(skill).toMatch(/inside a product discussion/);
    expect(skill).toMatch(/growth rule/);
    expect(skill).toMatch(/CONTEXT\.md/);
  });

  it('paired negative: a permission without the preserved exclusion fails the pair', () => {
    const permissionOnly =
      'Domain vocabulary: domain-modeling is permitted in a product discussion hosted by /intent (direct, or via the named /arch product route).';
    expect(permissionOnly).toMatch(/product discussion hosted by/);
    expect(permissionOnly).not.toMatch(/growth rule in \[CONTEXT\.md\]/);
  });
});

describe('A1 wiring — canonical helper paths, hold semantics, evidence-not-agreement', () => {
  const WIRED = [IDEATION, EXIT, INTENT_BRIEF];

  it('every wiring command cites the canonical .agents/procedures helper tree, never the symlink view', () => {
    for (const file of WIRED) {
      const body = read(file);
      expect(body, `${file} must cite the canonical helper tree`).toMatch(
        /\.agents\/procedures\/intent\/helpers\/(current-decisions|publish-spec-review)\.mjs/,
      );
      expect(body, `${file} must not point commands at the .claude/skills symlink view`).not.toMatch(
        /\.claude\/skills\/intent\/helpers/,
      );
    }
  });

  it('hold semantics are recorded at both gates: exit 2 is repaired, never routed around', () => {
    expect(read(IDEATION)).toMatch(/never present past a hold, never relax the gate/);
    expect(read(EXIT)).toMatch(/repair the evidence, never route around the gate/);
  });

  it('a matches attempt is gate evidence, never operator agreement', () => {
    expect(read(IDEATION)).toMatch(/A `matches` attempt is gate evidence, never operator agreement/);
  });

  it('paired negative: the wiring sentences do not appear in a rule-free control body', () => {
    const control =
      '## Gates\nThis contour offers the spec when it looks complete and prepares plans directly. No checkpoint command is recorded here.';
    expect(control).not.toMatch(/--check-presentation/);
    expect(control).not.toMatch(/--check-plan-prep/);
    expect(control).not.toMatch(/--advance-prd/);
    expect(control).not.toMatch(/Intent-fidelity checkpoint/);
    expect(control).not.toMatch(/Plan-preparation guard/);
  });
});

describe('arch exit reference — the product-discussion exit (sibling contour)', () => {
  it('routes product-intent parks to the intent advisor and links the canonical procedure', () => {
    const exit = read(EXIT);
    expect(exit).toMatch(/Product-discussion exit/);
    expect(exit).toMatch(/\]\(\.\.\/\.\.\/intent\/SKILL\.md\)/);
    expect(exit).toMatch(/intent advisor/);
  });

  it('does not restate the record shapes it points at', () => {
    const exit = read(EXIT);
    expect(exit).not.toMatch(/attemptId|IntentContract|ResultReview/);
  });
});

describe('canonical surfaces — brief approval + result-review protocol', () => {
  it('intent SKILL.md declares its name and a distinguishing description (routing distinguishability)', () => {
    const skill = read(INTENT_SKILL);
    const fm = skill.match(/^---\n([\s\S]*?)\n---/);
    expect(fm, 'SKILL.md frontmatter missing').not.toBeNull();
    expect(fm![1]).toMatch(/^name: intent$/m);
    expect(fm![1]).toMatch(/^description: /m);
    expect(fm![1]).toMatch(/NOT for solution design/);
  });

  it('product-brief reference carries the approval-snapshot contract', () => {
    const brief = read(INTENT_BRIEF);
    expect(brief).toMatch(/Approval applies to a preserved snapshot/);
    expect(brief).toMatch(/never encodes its own digest/);
  });

  it('result-review reference carries the four outcomes and the fresh-instantiation rule', () => {
    const review = read(INTENT_REVIEW);
    for (const outcome of ['matches', 'mismatch', 'needs-evidence', 'needs-operator']) {
      expect(review).toContain(outcome);
    }
    expect(review).toMatch(/[Ff]resh instantiation/);
    expect(review).toMatch(/[Nn]ever overwrite a completed attempt/);
  });
});

describe('SSOT + symlink layout — .agents/procedures/intent is canonical', () => {
  // Same doctrine as every sibling skill: the procedure lives under .agents/procedures/,
  // .claude/skills/ carries tracked RELATIVE symlinks (git mode 120000).
  const LINKS: Array<[string, string]> = [
    ['.claude/skills/intent/SKILL.md', '../../../.agents/procedures/intent/SKILL.md'],
    [
      '.claude/skills/intent/references/product-brief.md',
      '../../../../.agents/procedures/intent/references/product-brief.md',
    ],
    [
      '.claude/skills/intent/references/result-review.md',
      '../../../../.agents/procedures/intent/references/result-review.md',
    ],
  ];
  for (const [link, target] of LINKS) {
    it(`${link} is a relative symlink to the canonical file and resolves`, () => {
      const abs = resolve(REPO_ROOT, link);
      expect(existsSync(abs), `${link} missing`).toBe(true);
      expect(readlinkSync(abs), `${link} must be a symlink to ${target}`).toBe(target);
      expect(readFileSync(abs, 'utf8')).toMatch(/Authoritative for/);
    });
  }
});
