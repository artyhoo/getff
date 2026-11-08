# S2 B11 — restore checked library bindings (D14)

> **Authoritative for:** this bounded compile/delivery closure for existing check helpers.
> **Not authoritative for:** new parser behavior, dependency/platform design or campaign DONE.

Rigor label (L0): `research-grade` — proportionate API compatibility, compiler and existing-consumer evidence.

User authorized native execution without AIF. Immutable agreed design SHA
77e669ad6113b9674c6b32f92554af1a490e5828127f4c9ebea800f271a83e4a remains authority.
D14 evidence-backed decision precedes these source effects. One implementer, no agents,
push/tag/settings/credentials/global config, role/kernel/platform/workflow change or paid CI model.

## Actual failure and decision

Full core typecheck in B10 exits2 with four TS7016 at three files, retained in
`docs/ci-test-effectiveness/evidence/b10-typecheck.{txt,json}`. These files are unchanged
by B10, but their static imports were introduced by B7–B9; accepted S1 had no such imports
and the shared invocation file did not exist. Neither root nor core lock has the missing
@types packages. This is a campaign regression, not an environmental/baseline waiver.

Use the existing typed createRequire idiom in
packages/core/backends/astgrep/render-astgrep.test.ts (Node built-in module API) for the
already pinned js-yaml/picomatch APIs actually used. No new dependency or ambient module
stub. Keep API contracts narrow and honest (YAML load result unknown, actual matcher
pattern/options/result contract); no new any, @ts-ignore, disabled strictness or compiler
exclude. Existing any/predicates are outside this repair. No new generic loader abstraction.

## Exact source/derived scope

- packages/core/hooks/checks/pr-body-fidelity-bin.test.ts — YAML library binding only.
- packages/core/principles/37-required-context-completeness.test.ts — YAML binding only.
- packages/core/principles/ci-test-invocations.ts — YAML/matcher bindings only.
- packages/getff/MANIFEST.sha256 — normal assembler, actual archive check.
- docs/ci-test-effectiveness/batches/b11.json, evidence/b11-*, inventory-s2.jsonl append,
  prevention.json current RC1/readiness evidence, report.md narrow current count/status/cost.
No checker predicate, test expectation, invocation grammar, workflow, package/lock, role/
AIF binding, plugin payload/version, runtime production module or dependency changes.
Frozen S1/B1–B10/review/publication evidence remains unchanged. Report a concrete need
before broadening. Do not recensus/rerun unaffected workloads.

## Compatibility and verification

Actual Node conditional exports can give ESM and require different build entrypoints.
Prove the required used behavior, not identity assumptions. Compare old ESM and proposed
CJS YAML APIs on all15 real current workflows plus a valid and malformed companion;
preserve success values and relevant error behavior. Record resolved paths/version/module
context. Resolve from core/target context, since root can have a different transitive
picomatch. Verify the matcher factory is the same object if so, otherwise compare actual
configured-pattern behavior. Do not invent a general equivalence/universal-version claim.

Use actual original red compiler output, then full existing core typecheck must exit0.
Run existing actual consumers in the listed focused suite, preserve all tests and fixed
expectations. This is not a reason to write new standing import-shape/mirror tests.
Normal assembler/actual npm archive must map exact changed source bytes. Inspect actual
installed baseline maps before any capture; these test-only paths are not currently
installed, so no blind15-cell/150-suite replay. Parent handles normal full prepush/hosted
Node22 after independent acceptance. No full hooks/P20/native/bridge census replay.

```bash host-verify
npm --prefix packages/core run typecheck
npm --prefix packages/core run test -- hooks/checks/pr-body-fidelity-bin.test.ts principles/37-required-context-completeness.test.ts principles/38-vitest-include-ci-coverage.test.ts principles/41-shell-test-ci-coverage.test.ts
bash scripts/build-getff-dist.sh --check
```

No AIF required. Current Linux/Node24 is not hosted Node22/Windows proof. Every new
one-shot API-comparison/closure driver receives all7criteria and bounded costs; existing
compiler/consumer commands are the recurring enforcement, no new CI/check hierarchy.
Report full commands/results/source hashes/API limits in
.superpowers/sdd/ci-test-effectiveness/task-12-report.md. Commit normally, no push or
self-review agent. Return short status/head/checks/concerns. Final overall status remains
PARTIAL until actual final applicable hosted results and missing3 context registrations.
