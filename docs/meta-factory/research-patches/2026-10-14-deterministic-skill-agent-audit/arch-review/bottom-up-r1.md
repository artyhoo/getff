# Bottom-up architecture review — round 1

VERDICT: GO

Inputs-ref: `09d408cc63774633655851ba26f684cc68723d37`

Independence declaration: this review used only the five frozen artifacts listed in `arch-review/r1-inputs.txt`, repository operating instructions, and source inspected with `git show` at the named refs. I did not read live design/HANDOFF, author dialogue, or other review reports. No source or design changes were made. GO concerns architectural feasibility and permission to continue the existing design process; it does not certify implementation, activation, a passing test suite, or implementation authorization.

## Input binding and method

All five snapshot files were compared byte-for-byte with their original paths at Inputs-ref: all matched. The approved PRD SHA256 is `4869eaee6c97d6ea055a94e11f462d4c4c3870a79a5fe5bf6eecd17574d3d326`; the premise SHA256 is `d8208866c44ae7af5cf071735253151d12fa0eec9ae55fa6fa1557cc15be7762`, matching the approval record. The design SHA256 is `80367d23e34e375db22235a3cdd77e2cd83f968af59a2eb6e06ab0a30c604713`.

Baseline citations below mean Inputs-ref, including citations to original design paths whose bytes match the supplied snapshots. Newer TAK citations mean only `133fd3ae99e8f2073e33d35a252efba2bec17595`. I inspected source and contracts; I did not run acceptance batteries or infer green results from historical comments.

## Verified bricks and assembly

| Surface | Source at explicit ref | Architectural assessment |
| --- | --- | --- |
| Existing consumer caller | Baseline `.agents/roles/living-docs-auditor.md:23`, `:32`, `:57`, `:81`, `:166` | The target binding, script selection, shell state, exit capture, classification and auxiliary recipes actually exist. Extracting these operations removes genuine repeated mechanical work. Semantic explanation can remain with the role. |
| Role and backend delivery | Baseline `setup.d/ships.manifest:123`, `:126`, `:147`; `setup.d/20-agents.sh:9`; `setup.d/40-configs.sh:14`, `:136`, `:147`, `:151` | The selected roles and audit have real delivery owners. Base, Next, SPA and native runners are distinct. The proposed profile reconciliation addresses an actual mismatch: the current role selects only base/Next. |
| Structured drift probes | Baseline `packages/core/audit-self/audit-ai-docs.ts:244`, `:300`, `:32` | D1 and D2 are exported functions accepting a target root, so reuse is technically possible. Their current result arrays do not encode completeness; D2 catches and drops read/parse errors at `:312` and `:322`. The design explicitly requires repairing this boundary before acceptance, rather than treating reuse as proof of correctness. Imports of remark/unist-util-visit also make dependency closure substantive. |
| Legacy process result | Baseline `packages/core/audit-self/audit-ai-docs.sh:28`, `:49`, `:76`; role `:83` | Exit zero permits warnings and skipped work; PASS/FAIL/WARN are real outputs. A wrapper cannot infer completeness from exit status. The design's per-check completeness, documented applicability and contradiction handling are necessary and compatible with these backends. |
| Real caller-path test seam | Baseline `tests/living-docs-auditor/runtime.test.mjs:7`, `:9`, `:23`, `:31`, `:42` | Tests execute extracted canonical role snippets against controlled scripts and targets; this is a genuine entry-coupled seam, not merely a prose-presence test. Extending it to the new CLI and installed layout is feasible. Existing cases alone do not prove the future command. |
| Deliberately different second family | Baseline `.agents/procedures/rule-tests/SKILL.md:16`, `:20`; `.agents/roles/rule-test-author.md:44`, `:48`, `:60`; `packages/core/synthesizer/run-rule-tests-firing.sh:21`, `:52` | Verification has existing owners, diagnostic identity requirements and single-rule isolation. The standing firing runner filters by backend, and exit zero can mean skip/no-op. It is not already an arbitrary single-rule CLI with audit semantics. The design correctly preserves normative lane verdicts and requires explicit rule identity; completing that family boundary is planned work, not a reason to reject the architecture. |
| Runtime and distribution | Baseline `packages/core/package.json:18`; root `package.json:12`; `scripts/build-getff-dist.sh:40`; `setup.d/40-configs.sh:25` | Node >=22 and distribution/build owners exist. The installer also has a stack-free branch, and currently copies the shell audit rather than the TS module. Executable JS plus explicit dependency/preflight handling and isolated installed-layout checks is a feasible extension. It is not proof that all profiles already carry Node or TS dependencies. Design `docs/superpowers/specs/2026-10-14-deterministic-core-design.md:158` through `:172` explicitly preserves that distinction, including Windows/Bash limitations. |
| Existing wrappers and report validators | Baseline `.agents/procedures/pipeline/helpers/run-helper.sh:16`, `:26`; `.agents/roles/resources/docs-form-auditor/check-report.mjs:6`, `:32` | These mechanisms exist, but have narrower contracts: completion/exit propagation and a role-specific report schema. The design reuses their ownership lessons without pretending either is a universal completeness oracle or consumer runtime. In particular, the wrapper's timeout is best-effort; the new command's finite timeout cannot simply be inferred from it. |

## Newer TAK evidence, kept separate

At `133fd3ae99e8f2073e33d35a252efba2bec17595`:

- `packages/core/eslint-rules/no-vacuous-assertion.ts:99` checks literal arguments within recognized test bodies; `require-effective-assertion.ts:85` and `:142` check recognized assertion calls. These are actual implementations with precisely the syntactic limits recorded by the design.
- `packages/core/hooks/checks/guard-liveness.ts:239` invokes the test-quality gate independently of changed manifest-rule IDs; `:269` includes test/spec/unit/audit/integration path forms. This is stronger than merely possessing the lint rules.
- `packages/core/principles/51-test-quality-corpus-conformance.test.ts:4` and `:27` describe and import the real-rule corpus/population machinery. P52 `:6` and P53 `:6` identify separate subprocess and delivered-config/discovery seams. They do not claim semantic adequacy for every possible test.
- `scripts/test-assurance/driver.mjs:104`, `:131`, `:165` implements bounded spawning, frozen-oracle checks and actual CLI observations. Its fixed corpus and gate-fault architecture supports the proposed per-obligation assurance pattern. Its existing cases are not ready-made assurance for a new audit CLI; F0 must bind the new obligation and independently specified outcomes at the existing owner.

No newer TAK byte, historical repair result, merge state or runtime activation was attributed to the baseline. This source inspection does not close TAK's campaign or remove the design's execution-base reconciliation requirement.

## Population and closure

Read-only `git ls-tree -r --name-only Inputs-ref` enumerated 22 canonical procedure `SKILL.md` files, 21 top-level canonical role Markdown files and 36 hook/adapter/library files. The coverage document's principle table contains 100 rows and 100 distinct IDs. These support the planning-map population claims; they do not establish a complete operation census. The coverage document explicitly retains transitive closure as F0 work and implementation outcomes as the completion measure.

The resulting assembly is credible: existing role → family-owned command → existing probes → explicit findings/completeness → model interpretation. No verified dependency requires a new scheduler, registry or shared runtime before the first slice. Filename selection, exact supported profile matrix, finite process limits, dependency packaging and the selected fixed-oracle cases remain bounded kickoff/acceptance details already required by the design, not silently assumed existing behavior.

## Findings and limits

No BLOCKER, MAJOR, MINOR or ESCALATED finding. No rework round is requested.

The verdict would be falsified if the selected supported profile cannot carry the declared runtime/dependencies within existing installation constraints; if the unchanged outer oracle admits a no-op/disconnected caller; or if an installed fixture obtains a clean result while required backend work is absent or unreadable. Those are explicit acceptance boundaries in the reviewed design, not requests to implement them during this review. Exact-spec authority reconciliation and publication remain outside this bottom-up feasibility verdict.
