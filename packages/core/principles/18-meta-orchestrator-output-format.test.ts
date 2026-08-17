/**
 * Principle 18 — meta-orchestrator output-format structural check
 *
 * Source: .claude/skills/pipeline/SKILL.md §10 + references/output-format.md
 *         docs/meta-factory/research-patches/2026-05-24-meta-orchestrator-refactor-f3-scope.md §1.5 Item 8
 *
 * Invariant: the /pipeline slash-command emits a 3-layer inline session
 * report — Dependency graph + Action queue + 1-liner blocks. The skill body
 * communicates the 3 substructures literally, and the full grammar + 4 worked
 * examples live in references/output-format.md (per kickoff §4 #10 — split when
 * SKILL.md would exceed 500-line gate).
 *
 * **2026-05-25 update (Item 12 closure):** consumer mirror at `skills/pipeline/`
 * was deleted; install.sh now ships from authoring `.claude/skills/pipeline/`
 * directly (single source of truth per `.claude/rules/dual-implementation-discipline.md §7`).
 * The two mirror SURFACES entries were removed because the files no longer exist —
 * keeping them would assert against a structure that the project intentionally
 * abandoned. The remaining authoring surfaces still enforce the structural invariant.
 *
 * Mechanical check: for each of the 2 surface files
 *   - .claude/skills/pipeline/SKILL.md §10
 *   - .claude/skills/pipeline/references/output-format.md
 * assert the 6 required substrings appear:
 *   (1) '## Dependency graph'
 *   (2) '↓'                       — inter-stage edge symbol
 *   (3) '## Action queue'
 *   (4) 'Paste into a new CC tab' — action-queue column header
 *   (5) 'Can parallel with'       — action-queue column header
 *   (6) '### Stage'              — 1-liner heading prefix
 *
 * **2026-08-17 update (pipeline-chips stage S1):** a second substring family
 * (`CHIP_REQUIRED_SUBSTRINGS`) asserts the dispatch-chip contract on three surfaces —
 * the grammar reference (`references/output-format.md §9`) and both emitters named in
 * ADR D1, `/pipeline` §10 and `/arch` §3. Rationale: the chip prompt's three gates
 * (isolation, in-flight probe, click-time stage gate) are what keep a chip from being a
 * premature-dispatch button, so they are asserted, not trusted to emitter diligence —
 * ADR `2026-08-09-pipeline-chips-session-bus-design.md` D1 «assertion mechanism, not hope».
 *
 * **2026-08-17 update (stage S3 follow-up):** a THIRD family
 * (`PARK_CHIP_REQUIRED_SUBSTRINGS`) asserts the D3/D4 park-chip contract on `/dispatcher`
 * §3. Separate from the dispatch family because park-chips carry a different contract —
 * pointer-only payload, click-time re-verification, report-and-stop on a stale chip — and
 * none of the dispatch gates. Same rationale, same channel: the invariants are named in
 * prose, so a substring gate is the cheapest way to stop a rewrite from quietly dropping
 * one. What NEITHER family asserts is the runtime payload — see the ADR D1 «What it does
 * NOT assert» paragraph; both read files from disk.
 *
 * **2026-08-17 update (#1438 follow-up — the last two emitters, decided):** a FOURTH family
 * (`NIGHT_CHIP_REQUIRED_SUBSTRINGS`) asserts the v3 §7 night-end chip on `night-mode`. The
 * #1438 backward sweep found SIX emitting files, not three; four were asserted there, and the
 * two remaining ones split, because gate-lessness of the PAYLOAD is not the predicate. None of
 * these families asserts a payload at all (see «What it does NOT assert» above) — what they
 * assert is that the emitter's INSTRUCTION TEXT survives a rewrite. So the predicate is
 * severity-of-loss × exposure-to-drift, and it lands differently on the two:
 *   `.claude/skills/night-mode/SKILL.md` — ASSERTED. Its emission-side invariants exist in no
 *     other family, it is the one emitter that fires UNATTENDED (nobody is watching at 03:00,
 *     so a dropped restriction surfaces at 08:00 or never), and it is live: 13 commits since
 *     2026-06-01, three of them after the chip clause landed 2026-08-09 in #1346.
 *   `.claude/rules/seat-lifecycle.md` — NOT asserted, deliberately. It is a BINDING whose owner
 *     is session-bus v2 §4 (its own header says so), and its `#fifth-description-of-the-loop`
 *     anti-pattern forbids growing operational detail the owner carries — pinning substrings
 *     there is exactly the pressure that turns a 3-5-line pointer into a restatement. Its
 *     continuation-chip line adds no restriction of its own (it names rung «day» of a ladder
 *     the owner holds in full), it has one commit ever and has never been edited, and it does
 *     not ship (`setup.d/lib.sh:58-60` ships skills; no rule). Fixing it at the owner is also
 *     wrong: this principle's class is emitter INSTRUCTIONS an agent reads at work time, not
 *     design specs. Full rationale + falsifier: ADR D1 «Build trigger» paragraph.
 *
 * Slot 18 rationale: slots 01-17 occupied as of 2026-05-24 (`ls packages/core/principles/`).
 *
 * Companion paired-negative: a permutation test temporarily replaces one substring
 * with a placeholder, asserts the structural check FAILS, then restores. Run via
 * the dedicated paired-negative block below (does not mutate the actual files).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../..');

// Required substrings (all must appear in §10 of each SKILL.md and somewhere in each output-format.md).
const REQUIRED_SUBSTRINGS = [
  '## Dependency graph',
  '↓',
  '## Action queue',
  'Paste into a new CC tab',
  'Can parallel with',
  '### Stage',
] as const;

// Chip-emission substrings (stage S1 of the pipeline-chips ADR, 2026-08-09 D1+D2).
// The chip prompt's three gates must appear LITERALLY in the grammar reference and in
// each emitter's own emission clause: a chip whose prompt drops one of them strips
// `When` / `Waiting on` off the Action queue and becomes a premature-dispatch button
// (`#flat-queue-no-gates`). The capability token pins the runtime-probe posture — chips
// are gated on `spawn_task` being invocable, never on an `allowed-tools` declaration
// (which CC does not enforce, and which would turn principle 21 red on `MCP_TOOL_RE`).
const CHIP_REQUIRED_SUBSTRINGS = [
  'Dispatch chips',
  'spawn_task',
  'Isolation first',
  'In-flight probe',
  'Stage-gate at click time',
] as const;

// Park-chip substrings (ADR D3/D4 — the /dispatcher §3 Type-2 emitter, stage S3).
// A SEPARATE family on purpose: park-chips deliberately carry NONE of the dispatch gates
// above (no isolation step, no stage gate — a decision session reads and answers, it does
// not implement), so asserting CHIP_REQUIRED_SUBSTRINGS on this surface would demand the
// wrong contract. What IS load-bearing here is the D4 trio, and each token below has its
// own failure scenario if the prose drops it:
//   'Park-chip'               — block-existence anchor; without it a deleted block passes.
//   'spawn_task'              — capability gate; loss → emission attempted where the tool
//                               is absent, instead of the silent no-chip degradation.
//   'pointers only'           — payload discipline; loss → the park body gets inlined, and
//                               an inlined hint is untrusted by construction (the chip
//                               outlives the state it was minted from).
//   'Re-verify at click time' — staleness discipline; loss → the decision session trusts a
//                               chip minted against a park that has since been answered.
//   'report and stop'         — the halt OUTCOME; distinct from re-verify, which only says
//                               «check». Dropping it leaves the check with no consequence,
//                               and a stale chip applies `answer.ts` to a live park.
// Deliberately NOT pinned: 'Never the park payload body' — an emphatic restatement of
// 'pointers only', so it would pad the family without adding a failure scenario.
const PARK_CHIP_REQUIRED_SUBSTRINGS = [
  'Park-chip',
  'spawn_task',
  'pointers only',
  'Re-verify at click time',
  'report and stop',
] as const;

// Night-end chip substrings (autonomous-night v3 §7 — the night-mode terminal-retirement
// emitter, the #1438 follow-up). A THIRD contract profile and a THIRD family, for the same
// reason the park family is separate: this chip carries neither the dispatch gates nor the D4
// trio — it points at a report path, and a click opens a read. What IS load-bearing here, and
// in neither other family, is the EMISSION side. Each token has its own failure scenario:
//   'Review morning report'  — clause anchor + the chip's own identity; pins THIS clause rather
//                              than some future unrelated `spawn_task` mention in the file.
//   'NIGHT-END terminal retirement ONLY'
//                            — the emission restriction, and the reason this surface is worth a
//                              family at all; loss → mid-night successors emit chips v3 §7
//                              forbids them («Mid-night successors inherit the mandate and emit
//                              nothing»), so the operator wakes to N chips, N-1 of them minted
//                              against a morning report that did not exist yet.
//   'spawn_task'             — capability gate; loss → emission attempted where the tool is
//                              absent, instead of degrading to the documented report fallback.
//   'best-effort `dismiss_task`'
//                            — stranded-chip cleanup after a park decided overnight; loss → a
//                              park answered at 03:00 leaves a live park-chip whose only
//                              remaining bound is the park family's report-and-stop, i.e. a
//                              wasted click during the morning reconstruction. The thinnest of
//                              the four (defence-in-depth over an already-asserted arm), kept
//                              because the scenario is distinct, not a restatement.
// Deliberately NOT pinned: 'never at a mid-night handoff' — an emphatic restatement of the
// terminal-ONLY token (the knife #1438 used on 'Never the park payload body'); and naming the
// report file as the no-tool fallback consumer — the report is written either way and v3 §7
// holds that record, so it would pad the family without adding a scenario.
const NIGHT_CHIP_REQUIRED_SUBSTRINGS = [
  'Review morning report',
  'NIGHT-END terminal retirement ONLY',
  'spawn_task',
  'best-effort `dismiss_task`',
] as const;

// Files that must contain all REQUIRED_SUBSTRINGS in §10 (SKILL.md) or anywhere (output-format.md).
interface Surface {
  readonly label: string;
  readonly path: string;
  readonly scope: 'section-10' | 'whole-file';
}

// Consumer-mirror surfaces removed 2026-05-25 (Item 12 closure): install.sh now
// generates the consumer copy at install time from these authoring files via
// transform_internal_refs() — see install.sh:39-47 + tests/install-sh/transform-internal-refs.test.sh.
const SURFACES: readonly Surface[] = [
  {
    label: 'authoring SKILL.md §10',
    path: '.claude/skills/pipeline/SKILL.md',
    scope: 'section-10',
  },
  {
    label: 'authoring references/output-format.md',
    path: '.claude/skills/pipeline/references/output-format.md',
    scope: 'whole-file',
  },
];

/**
 * Extract §10 region from a SKILL.md (between '## §10' or '## Output artifacts' heading
 * and the next '## ' heading or end-of-file).
 */
function extractSectionTen(content: string): string {
  const lines = content.split('\n');
  const start = lines.findIndex((l) => /^## (?:§10|Output|Plain-language|10\s)/i.test(l) || /^## §10/.test(l));
  if (start === -1) return '';
  // Allow §10 + the following Plain-language tail section as one scope (mirror condenses).
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^## (?!§10|Output|Plain-language|10\s)/.test(lines[i])) {
      // Only break at the SECOND non-output section to allow §10 + §10.3a fold.
      end = i;
      break;
    }
  }
  return lines.slice(start, end).join('\n');
}

function checkSurface(
  surface: Surface,
  required: readonly string[] = REQUIRED_SUBSTRINGS,
): { ok: boolean; missing: string[] } {
  const fullPath = resolve(REPO_ROOT, surface.path);
  if (!existsSync(fullPath)) {
    return { ok: false, missing: [`FILE MISSING: ${surface.path}`] };
  }
  const content = readFileSync(fullPath, 'utf8');
  const scope = surface.scope === 'section-10' ? extractSectionTen(content) : content;
  if (!scope) {
    return { ok: false, missing: [`§10 SECTION NOT FOUND in ${surface.path}`] };
  }
  const missing: string[] = [];
  for (const sub of required) {
    if (!scope.includes(sub)) missing.push(sub);
  }
  return { ok: missing.length === 0, missing };
}

// Chip-emission surfaces: the grammar reference plus BOTH emitters named in ADR D1
// (/pipeline §10 and /arch §3). /dispatcher is absent from THIS family because it emits no
// dispatch chips (REST + self-advance) — its park-chips are D3 and carry a different
// contract, asserted by PARK_CHIP_SURFACES below (2026-08-17: the PR #1426 follow-up
// resolved — the omission was consistent, but consistency with an unasserted neighbourhood
// is not an argument that these invariants are unimportant, `#hope-as-gate`).
const CHIP_SURFACES: readonly Surface[] = [
  {
    label: 'authoring SKILL.md §10 (chip emission clause)',
    path: '.claude/skills/pipeline/SKILL.md',
    scope: 'section-10',
  },
  {
    label: 'authoring references/output-format.md §9 (chip contract)',
    path: '.claude/skills/pipeline/references/output-format.md',
    scope: 'whole-file',
  },
  {
    label: 'authoring arch/SKILL.md §3 (exit-chip emission clause)',
    path: '.claude/skills/arch/SKILL.md',
    scope: 'whole-file',
  },
];

// Park-chip surface: the sole D3 emitter. One entry today — a second would mean a second
// skill learned to emit park-chips, which is exactly when this family needs re-deriving.
const PARK_CHIP_SURFACES: readonly Surface[] = [
  {
    label: 'authoring dispatcher/SKILL.md §3 (park-chip contract + decision-session protocol)',
    path: '.claude/skills/dispatcher/SKILL.md',
    scope: 'whole-file',
  },
];

// Night-end chip surface: the sole v3 §7 emitter. Like every other surface in this file it is
// a SHIPPED skill (`GETFF_SKILLS_FACTORY`, setup.d/lib.sh:60 — `arch`/`pipeline` ship at the env
// tier, setup.d/lib.sh:59), so shipping is a shared property here, not the discriminator; the
// discriminator is unattended emission (see the family comment above).
const NIGHT_CHIP_SURFACES: readonly Surface[] = [
  {
    label: 'authoring night-mode/SKILL.md (night-end chip, terminal-retirement clause)',
    path: '.claude/skills/night-mode/SKILL.md',
    scope: 'whole-file',
  },
];

describe('Principle 18 — meta-orchestrator output-format structural check', () => {
  for (const surface of SURFACES) {
    it(`${surface.label} contains all 6 required substrings`, () => {
      const result = checkSurface(surface);
      expect(
        result.ok,
        result.missing.length > 0
          ? `Missing substrings in ${surface.label}: ${result.missing.join(', ')}`
          : '',
      ).toBe(true);
    });
  }

  it('all authoring surfaces agree on the 6 substrings (final sweep)', () => {
    // Both authoring SKILL.md §10 and references/output-format.md must contain the
    // structural substrings encoding the 3-layer output shape. Per-surface tests
    // above already enforce that; this block is the final sweep that returns a
    // single aggregate failure list. Consumer mirror surfaces removed 2026-05-25
    // (Item 12 closure — install.sh now generates the consumer copy).
    const results = SURFACES.map((s) => ({ ...s, ...checkSurface(s) }));
    const failed = results.filter((r) => !r.ok);
    expect(
      failed.length,
      failed.map((f) => `${f.label}: missing ${f.missing.join(', ')}`).join('\n'),
    ).toBe(0);
  });

  for (const surface of CHIP_SURFACES) {
    it(`${surface.label} contains all ${CHIP_REQUIRED_SUBSTRINGS.length} chip substrings`, () => {
      const result = checkSurface(surface, CHIP_REQUIRED_SUBSTRINGS);
      expect(
        result.ok,
        result.missing.length > 0
          ? `Missing chip substrings in ${surface.label}: ${result.missing.join(', ')}`
          : '',
      ).toBe(true);
    });
  }

  it('chip prompts declare all three gates on every emitting surface (final sweep)', () => {
    const results = CHIP_SURFACES.map((s) => ({
      ...s,
      ...checkSurface(s, CHIP_REQUIRED_SUBSTRINGS),
    }));
    const failed = results.filter((r) => !r.ok);
    expect(
      failed.length,
      failed.map((f) => `${f.label}: missing ${f.missing.join(', ')}`).join('\n'),
    ).toBe(0);
  });

  it('paired-negative: a chip clause that drops the click-time stage gate fails the check', () => {
    // The exact regression D1 guards against: gates frozen at plan time (or dropped)
    // turn the chip into a premature-dispatch button.
    const fakeClause = [
      '**Dispatch chips:** when `spawn_task` is invocable, emit one chip per Stage 1-liner.',
      'Each chip prompt carries: Isolation first, then the In-flight probe, then cwd + kickoff path.',
    ].join('\n');
    const missing: string[] = [];
    for (const sub of CHIP_REQUIRED_SUBSTRINGS) {
      if (!fakeClause.includes(sub)) missing.push(sub);
    }
    expect(missing).toContain('Stage-gate at click time');
    expect(missing.length).toBeGreaterThan(0);
  });

  it('paired-negative: a chip clause gated on allowed-tools instead of the runtime probe fails the check', () => {
    const fakeClause = [
      '**Dispatch chips:** declare the MCP tool in `allowed-tools`, then emit one chip per Stage.',
      'Each chip prompt carries: Isolation first, In-flight probe, Stage-gate at click time.',
    ].join('\n');
    const missing: string[] = [];
    for (const sub of CHIP_REQUIRED_SUBSTRINGS) {
      if (!fakeClause.includes(sub)) missing.push(sub);
    }
    expect(missing).toContain('spawn_task');
  });

  for (const surface of PARK_CHIP_SURFACES) {
    it(`${surface.label} contains all ${PARK_CHIP_REQUIRED_SUBSTRINGS.length} park-chip substrings`, () => {
      const result = checkSurface(surface, PARK_CHIP_REQUIRED_SUBSTRINGS);
      expect(
        result.ok,
        result.missing.length > 0
          ? `Missing park-chip substrings in ${surface.label}: ${result.missing.join(', ')}`
          : '',
      ).toBe(true);
    });
  }

  it('paired-negative: a park-chip clause that drops the click-time re-verification fails the check', () => {
    // The D4 regression this guards: without re-verify + its halt outcome, a chip minted
    // against a park that was answered by some other path (the morning sweep, an advisor
    // seat) still spawns a decision session, which applies `answer.ts` over a settled park.
    const fakeClause = [
      '**Park-chip contract.** Emit when `spawn_task` is invocable; the prompt carries pointers only.',
      'The spawned session assembles a decision package and applies it via `answer.ts`.',
    ].join('\n');
    const missing: string[] = [];
    for (const sub of PARK_CHIP_REQUIRED_SUBSTRINGS) {
      if (!fakeClause.includes(sub)) missing.push(sub);
    }
    expect(missing).toContain('Re-verify at click time');
    expect(missing).toContain('report and stop');
  });

  it('paired-negative: a park-chip clause that inlines the park payload fails the check', () => {
    // D4's pointer-only invariant: an inlined body is untrusted by construction, because the
    // chip outlives the state it was minted from.
    const fakeClause = [
      '**Park-chip contract.** Emit when `spawn_task` is invocable.',
      'The prompt carries the parked question text inline so the session can decide immediately.',
      'Re-verify at click time, never trust the chip — no matching park → report and stop.',
    ].join('\n');
    const missing: string[] = [];
    for (const sub of PARK_CHIP_REQUIRED_SUBSTRINGS) {
      if (!fakeClause.includes(sub)) missing.push(sub);
    }
    expect(missing).toEqual(['pointers only']);
  });

  for (const surface of NIGHT_CHIP_SURFACES) {
    it(`${surface.label} contains all ${NIGHT_CHIP_REQUIRED_SUBSTRINGS.length} night-end chip substrings`, () => {
      const result = checkSurface(surface, NIGHT_CHIP_REQUIRED_SUBSTRINGS);
      expect(
        result.ok,
        result.missing.length > 0
          ? `Missing night-end chip substrings in ${surface.label}: ${result.missing.join(', ')}`
          : '',
      ).toBe(true);
    });
  }

  it('paired-negative: a night-end chip clause that drops the terminal-only restriction fails the check', () => {
    // The v3 §7 regression this guards: without the restriction, every mid-night successor
    // retirement emits its own chip, so the operator wakes to a stack of «Review morning
    // report» chips minted before the report they point at existed.
    const fakeClause = [
      'Then write a **morning report**: what merged, decision resolutions, BLOCKED increments.',
      'At retirement the closing seat emits ONE capability-gated chip per plan («Review morning report [<plan>]»),',
      'pointing at the report path; without `spawn_task` the report file itself is the fallback consumer.',
      'A night-decided park may strand an unclicked park-chip: best-effort `dismiss_task` it.',
    ].join('\n');
    const missing: string[] = [];
    for (const sub of NIGHT_CHIP_REQUIRED_SUBSTRINGS) {
      if (!fakeClause.includes(sub)) missing.push(sub);
    }
    expect(missing).toEqual(['NIGHT-END terminal retirement ONLY']);
  });

  it('paired-negative: a night-end chip clause that drops the capability gate fails the check', () => {
    // D2's probe-only posture, restated at the one emitter most likely to lack the tool: a
    // CLI-born terminal seat. Without the gate the seat attempts emission instead of falling
    // back, and the failure lands at 03:00 with nobody watching.
    const fakeClause = [
      'At NIGHT-END terminal retirement ONLY — never at a mid-night handoff — the closing seat',
      'emits ONE chip per plan («Review morning report [<plan>]»), pointing at the report path.',
      'A night-decided park may strand an unclicked park-chip: best-effort `dismiss_task` it.',
    ].join('\n');
    const missing: string[] = [];
    for (const sub of NIGHT_CHIP_REQUIRED_SUBSTRINGS) {
      if (!fakeClause.includes(sub)) missing.push(sub);
    }
    expect(missing).toEqual(['spawn_task']);
  });

  // Paired-negative test (companion per principle 02 discipline): a temporarily-mutated
  // copy that strips one substring must fail the structural check. This proves the
  // check is non-tautological — a real broken §10 would be caught.
  it('paired-negative: synthetic §10 missing "## Dependency graph" header fails the check', () => {
    const fakeSectionTen = [
      '## §10 Output artifacts',
      '',
      'Some prose without dependency graph heading.',
      'But it does mention ↓ arrow.',
      '## Action queue',
      '| Paste into a new CC tab | When | Waiting on | Can parallel with |',
      '### Stage 1',
      '',
      '## §11 Failures',
    ].join('\n');
    const missing: string[] = [];
    for (const sub of REQUIRED_SUBSTRINGS) {
      if (!fakeSectionTen.includes(sub)) missing.push(sub);
    }
    expect(missing.length).toBeGreaterThan(0);
    expect(missing).toContain('## Dependency graph');
  });

  it('paired-negative: synthetic §10 missing "Paste into a new CC tab" column fails the check', () => {
    const fakeSectionTen = [
      '## §10 Output artifacts',
      '## Dependency graph',
      'Stage 1: ├── A   └── B   ↓',
      '## Action queue',
      '| # | Action | When | Waiting on | Can parallel with |',
      '### Stage 1',
    ].join('\n');
    const missing: string[] = [];
    for (const sub of REQUIRED_SUBSTRINGS) {
      if (!fakeSectionTen.includes(sub)) missing.push(sub);
    }
    expect(missing).toContain('Paste into a new CC tab');
  });

  it('RU lang pack carries the Russian emitted tokens (operator contract)', () => {
    const ru = readFileSync(resolve(REPO_ROOT, '.claude/skills/pipeline/lang/ru.sh'), 'utf8');
    expect(ru).toContain('Paste в новый CC tab');
    expect(ru).toContain('Можно параллельно с');
    expect(ru).toContain('## 🟢 Простыми словами');
  });
});
