# V2 addendum — consumer-firing, executed; and the stack-scope decision

**Author:** harvest/decision session, 2026-09-09. **Bench:** this macOS host (arm64), severed
`mktemp -d` consumers. **Basis:** [`kickoff.md`](kickoff.md) §3 (two test benches),
[`report-v2.md`](report-v2.md) §self-falsification #1, §operator-options.

## §0 Why this addendum exists

`report-v2.md` filled its `firing proof` column by running `npx vitest run backends/<b>/firing`
— the **factory** fixtures under `packages/core/backends/`. Its own §self-falsification #1 named
the gap and the falsifier: «run `install.sh <lane>` into a temp dir, fire the delivered config,
compare». Umbrella §3 makes that the binding shape for every lane («measure inside a consumer
install that has no path to the framework»).

**Retracted premise — read this before the rest.** A first draft of this section claimed that
«nothing proved that the delivered artefact fires». That is **false on every lane** — for
python/cargo/go outright, and for npm in the narrower sense §0.1 and §2b set out. Two successive
cold reviews of this addendum were needed to establish that; both are recorded in §4. The mechanism already ships: `install.sh`'s
`do_toolchain_lane` calls `_<lane>_firing_self_check` after delivery
([`install.sh:330-332`](../../../install.sh)) for **python, cargo and go**. Each plants a violation
in an OS temp dir, runs the **delivered** config, asserts it fires, runs a **paired clean control**,
and degrades loudly rather than green when the tool is absent
([`setup.d/45-python.sh:487`](../../../setup.d/45-python.sh),
[`setup.d/46-cargo.sh:201`](../../../setup.d/46-cargo.sh),
[`setup.d/47-go.sh:187`](../../../setup.d/47-go.sh)). The entry-lane suites drive the real
`install.sh` in `mktemp` fixtures and assert both directions
([`tests/install-sh/python-entry-lane.test.sh:165-200`](../../../tests/install-sh/python-entry-lane.test.sh)).
The composed proof I said was missing is a shipped, tested feature.

**What this addendum still legitimately closes**, stated narrowly now that the above is on the
record — three residuals, each measured below, not asserted:

1. **npm's install-time firing check exists, but never fires the delivered config.** A second
   draft of this list said npm «has no such self-check at all» — also false, and caught by a
   second cold review of this same file (§4 records both). `install.sh ts-server` delivers
   `check-fences-fire.sh` plus a paired bad/good fixture corpus
   ([`setup.d/40-configs.sh:51-54`](../../../setup.d/40-configs.sh)) and fires it as an
   install-self-verification capstone
   ([`setup.d/99-finalize.sh:286-297`](../../../setup.d/99-finalize.sh)) with real
   `FENCE_SILENT` / `FALSE_POSITIVE` arms
   ([`check-fences-fire.sh:359-364`](../../../packages/core/audit-self/check-fences-fire.sh)).
   Two things are narrower than the other three lanes, and they are what §2b measures: it runs
   **only under `--full`** ([`99-finalize.sh:257`](../../../setup.d/99-finalize.sh)) while the
   python/cargo/go checks are unconditional, and it proves rule *logic* through a **synthetic
   in-memory config**, never the `eslint.config.mjs` the installer placed — the source says so
   itself ([`check-fences-fire.sh:391-394`](../../../packages/core/audit-self/check-fences-fire.sh)).
   That is Finding N-2 (§2b).
2. **The existing self-checks assert an aggregate, not a per-rule result.** The python arm runs
   `ast-grep scan <planted>` and branches on the exit code, so a delivery in which 1 of the 4
   delivered rules works passes identically to one in which all 4 do. §2 fires each of the four
   individually.
3. **The cargo self-check greps for the diagnostic, never for a failing build** — bare
   `cargo clippy --message-format=json` piped to `grep '"clippy::disallowed_methods"'`
   ([`setup.d/46-cargo.sh:221-223`](../../../setup.d/46-cargo.sh)). Emitting a warning and failing
   a build are different claims, and F2 is exactly that gap; the self-check cannot see it by
   construction. §2 measures both exit codes.

This addendum changes no framework file.

## §1 Method

Per lane: `mktemp -d`, seed the lane's detect file, run the real `install.sh <lane>` with stdin
closed, **then — npm only — run the installer's own «Next steps» step 4** (the printed
`npm install --save-dev …` set; without it the consumer has no linter at all, see below), confirm
no path back to the framework, plant a violation of the **delivered** ban, fire the **delivered**
config, and run a clean control file through the same command. A ban is «consumer-proven» only
when the violation exits non-zero AND the clean control exits zero.

The isolation step, quoted rather than asserted (T3) — run in each consumer after install:

```text
$ grep -rIl 'rules-as-tests-aif' .            # excluding node_modules
(no output)                                                                  EXIT=1
```

**What that grep does not cover, stated rather than glossed:** it excludes `node_modules/`, which
for the npm lane is exactly where a path back to the factory would hide (a linked or hoisted
install). The risk did not materialise here — the devDeps came from the registry via the
installer's printed `npm install --save-dev` — but the quoted proof is content-scoped, and a
future run that installs any workspace-linked package needs a second check (`find node_modules
-maxdepth 3 -type l -lname '*rules-as-tests-aif*'`) before claiming severance.

**The devDependency step is load-bearing for reproducibility and was missing from a first draft
of this section.** The npm block below reports `eslint v9.39.4`; a bare `npx eslint` in an empty
temp dir resolves `latest` (10.x), so that version is only reachable *after* the printed install
pins `eslint@^9`. Verified in the live consumer: `node_modules/eslint/package.json` → `9.39.4`,
`package.json` devDependencies → `"eslint": "^9.39.4"`.

**Honest scope against umbrella §3.** The binding rule is «measure inside a consumer install that
has no path to the framework, **with a mandatory control run on the factory**». This addendum ran
the consumer half; the factory half is `report-v2.md`'s existing per-lane fixture column rather
than a fresh paired run, so the two are not a matched A/B taken in one sitting. Where that matters
it is called out — see §2b, where the factory and consumer turn out to run different toolchain
majors.

## §2 Per-lane executed results

### python — CONSUMER-PROVEN (both surfaces)

Delivered: `ruff.toml` (`select = ["DTZ005","TID251","TID253"]`, banned module `tensorflow`,
banned api `datetime.datetime.utcnow`), `sgconfig.yml`, `.getff/astgrep-rules/` (4 rules).

```text
$ ruff --version → ruff 0.15.21
$ ruff check --output-format=concise src/bad.py
src/bad.py:1:8: TID253 `tensorflow` is banned at the module level
src/bad.py:7:9: TID251 `datetime.datetime.utcnow` is banned: …use datetime.now(timezone.utc)
src/bad.py:8:9: DTZ005 `datetime.datetime.now()` called without a `tz` argument
Found 3 errors.                                                              EXIT=1
$ ruff check --output-format=concise src/good.py
All checks passed!                                                           EXIT=0

$ ast-grep --version → ast-grep 0.44.1
$ ast-grep scan src/bad.py
error[getff-no-eval] · error[getff-no-datetime-datetime-now] · error[getff-no-os-system]
Error: 3 error(s) found in code.                                             EXIT=1
$ ast-grep scan src/good.py                                                  EXIT=0

$ ast-grep scan src/bare_now.py       # the 4th delivered rule, own sample
error[getff-no-datetime-now]: Use an injected clock, not datetime.now() directly
  ┌─ src/bare_now.py:5:12
Error: 1 error(s) found in code.                                             EXIT=1
$ ast-grep scan src/good.py                                                  EXIT=0
```

Both delivered surfaces are natively build-failing; no projection needed. **All four**
delivered astgrep rules are consumer-proven, each with a clean control — `getff-no-os-system`,
`getff-no-datetime-datetime-now`, `getff-no-eval` on `src/bad.py`, and `getff-no-datetime-now`
on its own sample (its pattern `datetime.now()` does not match the qualified call the third
rule catches, so a shared file would have proven only one of the two).

### cargo — CONSUMER-PROVEN, and F2 reproduced live

Delivered: `clippy.toml` (`disallowed-methods = [std::env::var]`), `deny.toml`,
`.github/workflows/getff-cargo.yml`, and `.getff/Cargo.lints.toml` — the `[lints.clippy]` deny
projection, **always delivered as a reference**, never auto-merged
([`setup.d/46-cargo.sh:125-129`](../../../setup.d/46-cargo.sh)). That file is the artefact
qualifier 1 in §3 refers to, so it belongs in this list.

Two named targets, so each exit code is falsifiable: `src/bin/bad.rs` calls `std::env::var`,
`src/bin/good.rs` does not. The `-D` triple below is the delivered gate **verbatim**
([`packages/core/templates/cargo/github-actions-ci.yml:48`](../../../packages/core/templates/cargo/github-actions-ci.yml)).

```text
$ rustc --version → rustc 1.98.1   $ cargo clippy --version → clippy 0.1.98

$ cargo clippy --bin bad                       # bare, as a consumer would type it
warning: use of a disallowed method `std::env::var`
note: `#[warn(clippy::disallowed_methods)]` on by default                     EXIT=0

$ cargo clippy --bin bad -- -D clippy::disallowed_methods \
      -D clippy::disallowed_types -D clippy::disallowed_macros
error: use of a disallowed method `std::env::var`
note: requested on the command line with `-D clippy::disallowed-methods`
error: could not compile `demo` (bin "bad") due to 1 previous error           EXIT=101

$ cargo clippy --bin good -- -D clippy::disallowed_methods \
      -D clippy::disallowed_types -D clippy::disallowed_macros
(0 disallowed diagnostics)                                                    EXIT=0
```

**F2 is confirmed in a real consumer, not inferred:** the delivered ban is warn-only under a
bare `cargo clippy` (EXIT=0) and build-failing only through the delivered workflow's `-D`
promotion or the `.getff/Cargo.lints.toml` merge.

**A trap the re-measurement surfaced, worth recording.** The delivered command carries
`--all-targets`, and with it the «clean» run is **also** EXIT=101 — because `--all-targets`
compiles every binary in the crate, including `bad.rs`. A clean control must isolate the target
(`--bin good`) or live in its own crate; run verbatim with `--all-targets`, the control proves
nothing and would have been recorded as a false OVER-BROAD.

**Toolchain, stated precisely.** This fired on the host default **1.98.1**. The 1.96.1 pin is the
**factory fixtures'** pin ([`audit-self.yml:319-334`](../../../.github/workflows/audit-self.yml));
the *consumer* template deliberately does not pin rustc at all («clippy is a rustup component of
the consumer's own toolchain — add it, do not pin rustc»,
[`github-actions-ci.yml:41`](../../../packages/core/templates/cargo/github-actions-ci.yml)). So the
right claim is «the ban fired on a toolchain two minors past the factory pin», n=1 — not the
general «not pin-fragile» an earlier draft asserted.

### npm (ts-server) — CONSUMER-PROVEN, and the factory fixture proves a *different* ban

Delivered: `eslint.config.mjs`, `eslint-rules-local/` (4 custom rules), `.husky`, CI templates.

```text
$ npx eslint --version → v9.39.4        # after the printed devDep install; see §1
$ npx eslint src/bad-enum.ts
error  Use union types or `as const` objects instead of enum …  no-restricted-syntax   EXIT=1
$ npx eslint src/good-enum.ts                # clean control                           EXIT=0

$ npx eslint src/time.ts                     # R7 not opted in                         EXIT=0
$ AIF_STRICT_RUNTIME=1 npx eslint src/time.ts
error  Use an injected Clock instead of `Date.now()` (R7)
       rules-as-tests/no-direct-time-randomness                                        EXIT=1
$ AIF_STRICT_RUNTIME=1 npx eslint src/time-clean.ts    # R7 clean control              EXIT=0
```

**The R7 clean control was missing from a first draft and has now been run.** Toggling
`AIF_STRICT_RUNTIME` on the *same* file changes whether the rule is enabled — it does not show the
rule discriminates between conforming and violating code, which is the only thing a control
establishes. `src/time-clean.ts` (an injected-`Clock` implementation with no `Date.now()`) under
the identical strict-mode command exits 0, so R7 is now consumer-proven by this file's own §1
definition. This is the OVER-BROAD direction the shipped self-checks guard explicitly
([`setup.d/45-python.sh:504-506`](../../../setup.d/45-python.sh)).

**Scope of the enum ban, measured — it is narrower than «CONSUMER-PROVEN» alone suggests.** The
delivered template sets `'no-restricted-syntax': 'off'` for the test override block
([`templates/ts-server/eslint.config.mjs:216`](../../../templates/ts-server/eslint.config.mjs)),
and the block's globs cover more than the file suffix:

```text
$ npx eslint src/bad-enum.ts                 # same violating content        EXIT=1
$ npx eslint tests/bad-enum.test.ts          # same content, *.test.ts       EXIT=0
$ npx eslint tests/plain-bad-enum.ts         # same content, tests/**        EXIT=0
```

So the ban is proven for production sources and is **deliberately absent under `tests/**`** — a
design choice, not a delivery bug, but the honest reading of the row is «the delivered enum ban
fires on `src/`», not «on the consumer's tree».

**Which surfaces these two are.** The enum ban is ESLint's **built-in** `no-restricted-syntax`
configured by the delivered template, not one of the four rules in `eslint-rules-local/`; R7
(`rules-as-tests/no-direct-time-randomness`) is one of those four. So of the delivered npm rule
set this addendum fired **one built-in ban and one of four custom rules**, not «two of four
custom».

**Finding N-1 (evidence-chain, not a product defect).** The delivered consumer config bans
`TSEnumDeclaration` under rule id `no-restricted-syntax`
([`templates/ts-server/eslint.config.mjs:165`](../../../templates/ts-server/eslint.config.mjs)),
while the factory firing fixture drives the same rule id from a *different* selector — the
`no-direct-process-env` node at
[`packages/core/backends/npm/firing.test.ts:38`](../../../packages/core/backends/npm/firing.test.ts).
Same rule id, **different ban content**.

The mechanism is visible one file over:
[`firing-runner.ts:53`](../../../packages/core/backends/npm/firing-runner.ts) builds the config as
`'no-restricted-syntax': ['error', { selector: rule.selector, message: rule.message }]` — the
runner is a **generic harness parameterised by selector**, so a green `backends/npm/firing`
proves the harness fires for *whatever selector it was handed*, never that the delivered enum
selector is among them. The two were never the same check. This is precisely the class
umbrella §3 exists to catch, and it was invisible to a factory-only method.

**Not a defect, checked and withdrawn.** A fresh consumer's `npm run lint` fails
`eslint: command not found` (EXIT=127) because the delivered `package.json` declares only
husky/lint-staged/sort-package-json. The installer's own «Next steps» step 4 prints the exact
`npm install --save-dev …` command (and `./install.sh ts-server --full` as the automated
route), so the lane is bring-your-own-toolchain **by disclosure**, not silently inert.

### go — NOT MEASURED

Neither this Mac nor the operator's PC carries `go` or `golangci-lint` (probed 2026-09-08,
re-confirmed at this harvest). The lane's firing evidence remains container + CI only
(`audit-self.yml:368-372` install, `:378-419` live-fire arm — the step begins at `:378`, not the
`:383` an earlier draft inherited from `report-v2.md`; 13/13 in-container). Closing this
row costs a ~200 MB toolchain install and is an operator decision, not a harvest side effect.

## §2b Backward sweep — does Finding N-1's class repeat on the other lanes?

*Class of the finding = «the factory firing fixture proves a different artefact than the one the
installer delivers».* Swept every lane that has both a fixture and a delivered config, comparing
what each side actually asserts (not that both are green):

| lane | factory fixture asserts | delivered config bans | proof transfers? |
|---|---|---|---|
| ruff | `torch`, `requests` under `select = ["DTZ005","TID251","TID253"]` | `tensorflow`, `datetime.datetime.utcnow` under the **same** select | **YES** — the banned name is *data* passed to the same ruff checks; the check codes are identical |
| cargo | `clippy.toml` banning `std::env::var` | `clippy.toml` banning `std::env::var`, byte-identical reason string | **YES** — exact match |
| astgrep | ids `no-datetime-now` (pattern `datetime.datetime.now($$$ARGS)`), `require-return-type-hint` | ids `getff-no-os-system`, `getff-no-datetime-datetime-now`, `getff-no-eval`, `getff-no-datetime-now` (pattern `datetime.now()`) | **NO** — zero id overlap, and the one near-name pair carries a *different pattern* |
| npm | selector `MemberExpression[object.name='process'][property.name='env']` | selector `TSEnumDeclaration` | **NO** — Finding N-1 |

The discriminator is whether the fixture-vs-delivered difference is **data or logic**. ruff and
cargo differ only in which name is fed to an identical check, so the fixture's green does carry.
astgrep and npm differ in the *matching logic itself*, so it does not.

**Second axis, and the sweep above missed it on the first pass: the toolchain version.** «Same
check» presumes the same tool runs it, and on two lanes it does not:

| lane | factory runs | consumer runs | same major? |
|---|---|---|---|
| npm | `eslint ^10.4.0` ([`packages/core/package.json:94`](../../../packages/core/package.json)) | `eslint 9.39.4` (the pin the installer prints, measured §2) | **NO — a major apart** |
| cargo | fixtures pinned `1.96.1` ([`audit-self.yml:319-334`](../../../.github/workflows/audit-self.yml)) | unpinned by design ([`github-actions-ci.yml:41`](../../../packages/core/templates/cargo/github-actions-ci.yml)); measured on 1.98.1 | **NO — by design** |

This is Finding N-1's class on a different axis: the factory can be green on a rule the consumer's
tool version parses, treats, or spells differently. It is **not** a defect on the evidence here —
both lanes fired correctly at the versions measured — but the cargo row's «**YES** — exact match»
above is a claim about the *config bytes*, not about the checker, and should be read that way. A
matched factory/consumer control run on one toolchain is the measurement that would close it, and
this addendum did not do it (§1, honest scope).

**The astgrep row is narrower than it first looks.** The fixture genuinely shares no rule id with
what a consumer receives — but the lane never rested on the fixture alone: the install-time
self-check plants `eval` / `os.system` / `datetime.now` / `datetime.datetime.now` and runs the
**delivered** rules over it ([`setup.d/45-python.sh:503`](../../../setup.d/45-python.sh)). What that
check cannot report is *which* rules fired, because it branches on `ast-grep scan`'s exit code. So
the residual was per-rule discrimination, not «unproven» — and §2 now fires all four individually,
each with a clean control.

**Finding N-2 (narrowed twice, and what survives is still real).** The npm lane *does* carry an
install-time firing self-check — the correction is recorded in §0 and §4 rather than silently
applied. Two further versions of this paragraph then made the same mistake in a smaller form:
«three arms exist and none of them fires the delivered `eslint.config.mjs`», then «four». Both
were false. A behaviour-shaped sweep does not settle it either — run verbatim on this commit it
returns five files, and it disagrees with the enumeration in **both** directions:

```text
$ grep -rlnE 'npx eslint|new ESLint\(|lintFiles' tests/ scripts/ setup.d/ .github/ packages/core/audit-self/
tests/install-sh/f19-fences-fire-load-probe.test.sh
tests/install-sh/f17-lint-rules-planted-violation.test.sh
tests/consumer-matrix/pnpm-monorepo-cell.sh
tests/consumer-matrix/getff-dist-cell.sh
packages/core/audit-self/check-fences-fire.sh
```

Two of those — `f17`, `f19` — appear in no version of the enumeration below; and the sweep in turn
misses `t6-synth-wire-planted-violation.test.sh`, which is *inside* the searched scope but drives a
`Linter` without any of those tokens, and `firing-runner.ts`, which is outside it. Neither list is
the complete one, and neither is owed a third attempt.

**So this document retires the channel-enumeration frame for this claim.** Counting channels has
now been wrong four times here, and the count is not what the finding needs. The load-bearing
negative is restated as a search anyone can re-run in one command:

```text
$ git ls-files -z | xargs -0 grep -lE '^[[:space:]]*(export )?(declare )?(const )?enum [A-Za-z_$]'
.claude/orchestrator-prompts/consumer-truth-audit/report-v2-addendum-consumer-firing.md
.claude/orchestrator-prompts/multi-toolchain-convention-compiler/kickoff.md
```

The command is repo-wide, and the only two hits are **markdown prose about this ban** — this file
and one kickoff. **No source file or fixture tracked in this repo declares a TypeScript `enum`.**
Whatever the channel inventory turns out to be, the delivered `TSEnumDeclaration` ban therefore has
no *repeatable in-repo* firing proof — not because the channels are too weak, but because no
fixture in the repo gives that rule something to fire on. (§2 of this addendum did fire it, once,
by hand, in a severed consumer; that observation is real, and it is not a gate.) That is Finding
N-2, and it survives independently of how many arms are counted.

The table below is **illustrative, not exhaustive** — what the main channels do cover, useful for
choosing where a fix belongs:

| arm | what it runs | does it fire the delivered `eslint.config.mjs`? |
|---|---|---|
| factory fixture `backends/npm/firing` | a selector it supplies itself, through a generic runner ([`firing-runner.ts:53`](../../../packages/core/backends/npm/firing-runner.ts)) | **no** — Finding N-1 |
| `check-fences-fire.sh` fixture arm | rule *logic*, via a synthetic in-memory Linter config + a barrel resolved from `packages/core` ([`check-fences-fire.sh:391-394`](../../../packages/core/audit-self/check-fences-fire.sh)) | **no** — stated in the source |
| `check-fences-fire.sh` load-probe arm | whether each **placed** config can `import()` — `import(FENCE_CFG).then(exit 0).catch(exit 1)`, no `linter.verify` anywhere ([`check-fences-fire.sh:434-437`](../../../packages/core/audit-self/check-fences-fire.sh)) | **loads it, never fires it** |
| `t6-synth-wire-planted-violation.test.sh` | installs via the real `install.sh react-next --force`, **reads the placed `eslint.config.mjs`**, extracts the R20 selector from its text and fires it in a synthetic `Linter` with a paired negative ([`:154-179`](../../../tests/install-sh/t6-synth-wire-planted-violation.test.sh)); CI-gated at [`audit-self.yml:864-865`](../../../.github/workflows/audit-self.yml) | **yes — but only for `rules-as-tests/restricted-syntax-audit-exempt`**, matched by a regex keyed to `Program:not(Program:has(` |
| consumer-matrix cells — [`pnpm-monorepo-cell.sh`](../../../tests/consumer-matrix/pnpm-monorepo-cell.sh), [`getff-dist-cell.sh`](../../../tests/consumer-matrix/getff-dist-cell.sh) | **the strongest arm in the repo**: real `install.sh ts-server --full` (resp. a packed `getff init`), then the real CLI over the placed config — `npx eslint src/routes/order.ts` on a planted R2 violation, with a separately named clean control (`:191` / `:156`); CI-gated at [`audit-self.yml:1948,1999`](../../../.github/workflows/audit-self.yml) | **yes, through the real resolver** — but the planted violation is an R2 zod parse, never an enum |

So the delivered ban §2 actually measured — the built-in `no-restricted-syntax` /
`TSEnumDeclaration` ban, which is *template configuration* rather than one of the four barrel
rules — has no repeatable in-repo firing proof, for the reason above: no fixture presents an enum,
so nothing re-runs the single manual observation §2 recorded. The
cheapest place to fix that is **not** the `check-fences-fire.sh` load-probe an earlier draft
proposed — but it is not «one line» either, and the difference is the whole point of the finding.
The ban *would* fire on an enum planted in a consumer-matrix fixture: the block carrying it is
scoped to `**/*.{ts,tsx}`
([`eslint.config.mjs:91-92,162-168`](../../../templates/ts-server/eslint.config.mjs)) and the
`'no-restricted-syntax': 'off'` override is scoped to test globs only
([`:204-209,216`](../../../templates/ts-server/eslint.config.mjs)). What neither cell would do is
**detect** it. The violation arm asserts `rc -ne 0` plus `grep -q no-unsafe-zod-parse`
([`pnpm-monorepo-cell.sh:209-211`](../../../tests/consumer-matrix/pnpm-monorepo-cell.sh),
[`getff-dist-cell.sh:77-78`](../../../tests/consumer-matrix/getff-dist-cell.sh)), and the planted
R2 violation already satisfies both — so a silent `TSEnumDecl` selector passes green, which is
exactly the failure class stated below. And an enum placed anywhere else under `apps/api/src/**`
reds the clean-control arm (`FP_RC -eq 0`,
[`pnpm-monorepo-cell.sh:194`](../../../tests/consumer-matrix/pnpm-monorepo-cell.sh)) for the wrong
reason. The honest cost is a fixture line **plus an assertion on the enum message, in the violation
arm only** — still a `tests/`-class change, still far cheaper than the `setup.d/`-class capability
commit (with its `Prior-art:` consult) that extending the load-probe would be, but the one-liner as
an earlier draft stated it would have shipped
[`attention-is-not-a-mechanism.md §2`](../../rules/attention-is-not-a-mechanism.md)
`#hope-as-gate`. The capstone is additionally
`--full`-gated ([`99-finalize.sh:257`](../../../setup.d/99-finalize.sh)), so the plain
`./install.sh ts-server` this addendum ran does not reach even the arms that do exist.

**Failure-scenario:** ship a `templates/ts-server/eslint.config.mjs` whose `no-restricted-syntax`
selector is **valid but matches nothing** — `TSEnumDecl` for `TSEnumDeclaration`. Measured on this
host, that is the one silent class; a genuinely malformed selector is loud and does not need a
gate:

```text
$ node -e "new Linter().verify('function f(){}', [{rules:{'no-restricted-syntax':
    ['error',{selector:S,message:'BAN'}]}}], {filename:'a.js'})"
S = FunctionDeclaration      -> msgs=1 ("BAN")          # fires
S = FunctionDecl             -> msgs=0                  # SILENT — the dangerous class
S = FunctionDeclaration[[    -> THROW: Syntax error in selector … at position 20
```

The silent variant still parses and still `import()`s, so the load-probe passes. The fixture arm passes — it
never reads that file. `npx vitest run backends/npm/firing` passes — it drives its own selector.
The consumer's enum ban would be a silent no-op and **nothing in the repo would report it** —
not because a channel is missing, but because no fixture hands that rule an enum. This is the
same shape as the shipped `runtime-bridge-dispatch.sh` no-op precedent, and it is the class
umbrella §3 exists to catch.

**Not fixed here** — this lane measures, it does not repair. The fix is a fixture line **plus its
own assertion**, in a consumer-matrix cell's violation arm (above) — a `tests/`-class change, still
outside this measure-only lane's scope (CLAUDE.md «PR strategy»). Recorded as a follow-up.

## §3 The stack-scope decision

`report-v2.md` §operator-options priced N=1..4 and picked none — correctly, because
[`kickoff-v2.md`](kickoff-v2.md) §4 binds the *lane* to «state the options and what each costs;
**do not pick one**». **This section deliberately steps outside that constraint, and the
authority is worth naming rather than assuming:** the operator delegated the choice to this
session explicitly after the lane reported. So the «do not pick» rule is not violated — it
bound the measuring lane, and the pick is made one layer up, by the seat that was asked to make
it, on the lane's evidence. A reader who disagrees with the pick can still use §2/§2b, which
are measurement and stand independently of §3.

The decision, taken on the evidence above:

> **The beta claims four enforcement stacks. It must not claim a generation-stack count at
> all until that axis is measured — and through the shipped installer the enumeration below
> reaches exactly one (npm), behind a `--full` flag and two committed JSON inputs.**

- **Enforcement = 4** (npm, python, cargo, go): each ships a delivered config whose planted
  violation is **reported** and whose paired clean control is not — but «reported» is not
  «build-failing» in every lane, and the difference is qualifier 2 below, not a footnote: bare
  `cargo clippy` exits 0 on the violation. Three are now consumer-proven on this host; go is
  proven in-container and in CI.
- **Generation = 1 through the shipped installer, ≥2 counting session-side. Enumerated, not
  benched.** This row has now been wrong twice, in opposite directions, and both drafts are kept
  in §4 rather than tidied away. Draft 1 asserted «Generation = 1 (npm) — the only lane with the
  full research→validate→emit loop» with zero measurement, breaching this file's own §1 evidence
  rule. Draft 2 over-corrected to «≥2 through the shipped consumer entrypoint (npm, python)» —
  also false: the python lane's `--from-practice` arm is **not reachable from any installer
  step**. Two independent checks: `--from-practice` appears in `setup.d/` only inside two
  comments ([`45-python.sh:268,325`](../../../setup.d/45-python.sh)) while the one step that
  actually spawns the CLI passes `--from-research` / `--from-selection`
  ([`80-rule-bootstrap.sh:70-73`](../../../setup.d/80-rule-bootstrap.sh)); and the python lane
  `exit 0`s before the layer loop that runs `setup.d/` at all
  ([`install.sh:538-541`](../../../install.sh), comment at [`:378`](../../../install.sh)). The
  corrected enumeration, with the reachability axis made explicit:

  | lane | reachable from the shipped installer? | generation reach | evidence |
  |---|---|---|---|
  | npm (react-next) | **yes** — [`80-rule-bootstrap.sh:70-73`](../../../setup.d/80-rule-bootstrap.sh), but only under `--full` and only if `<stack>.research.json` + `.selection.json` are committed; the step is `\|\| true`, so a miss is silent | full loop: research JSON → `generate.ts` → `install()` → `rules-lock.json` | [`80-rule-bootstrap.sh:9-10`](../../../setup.d/80-rule-bootstrap.sh) («resolved to Option 1 at harvest time» — supersedes the stale `PARKED` header at [`rule-bootstrap-cli.ts:3-13`](../../../packages/core/install/rule-bootstrap-cli.ts)) |
  | python (astgrep) | **no** — the lane exits before the layer loop | session-side Model A′: `render-researched-astgrep.ts`; the `--from-practice` CLI arm is proven e2e (research JSON → generation → delivery → **fires on a scratch consumer**) but only when a session spawns it by hand | [`researched-live-path.test.ts:12-14`](../../../packages/core/backends/astgrep/researched-live-path.test.ts), [`install.sh:538-541`](../../../install.sh) |
  | cargo (clippy) | **no** | session-side Model A′: `npm run render:researched:rust`, committed input record + byte-drift gate | [`packages/core/package.json:77`](../../../packages/core/package.json), [`render-researched-clippy.ts:2-6`](../../../packages/core/synthesizer/render-researched-clippy.ts) |
  | ruff | n/a | a renderer exists, no researched driver (`grep researched packages/core/backends/ruff/*.ts` → no output) | [`render-ruff.ts`](../../../packages/core/backends/ruff/render-ruff.ts) |
  | go (golangci) | n/a | none — hand-authored **by design**; the backend dir carries no renderer at all | `backends/golangci/firing.test.ts:195-198` |

  So the honest count depends on a distinction the phrase «N stacks» hides: **one** through the
  shipped consumer entrypoint (npm, `--full`-gated, requiring committed research+selection JSON),
  **three** if session-side rendering counts, and any copy that says «two» is wrong on either
  reading. **This is an enumeration of the repo, not a bench run** — unlike §2, nothing here was
  executed. Falsifier: run `install.sh react-next --full` in a severed consumer with both JSON
  inputs present and check a generated rule lands in `rules-lock.json` and fires.

The split is still the whole point: «N stacks» was malformed because «support» bundled
enforcement and generation, and the two counts differ — 4 versus 1. Copy saying «generated rules
for four stacks» is F1-class false for go and unsupported for ruff. Copy saying «generation is
npm-only» is defensible for what a consumer can *run*, and it understates what the repo can
*do*: python is the lane with the end-to-end live-generation test, and it is simply not wired to
the installer. Both halves need saying, or the next reader re-derives one of the two wrong
answers this row has already produced.

Three qualifiers travel with the enforcement claim or it re-liquefies. **They are ordered by how
weak the evidence actually is, which is not the order a first draft used** — that draft ranked go
weakest because it was the lane I could not run by hand, confusing «I did not measure it» with «it
is unproven». By *type* of evidence the ranking inverts: go carries a deterministic, CI-gated
`install.sh go` live-fire with a planted violation and a clean control
([`audit-self.yml:378-419`](../../../.github/workflows/audit-self.yml)), which is a stronger
mechanism than any one-off manual run on this Mac
([attention-is-not-a-mechanism.md §1](../../rules/attention-is-not-a-mechanism.md) — a repeatable
gate beats an unrepeated observation). npm is the genuinely weak link:

1. **npm is the only lane whose delivered built-in `no-restricted-syntax` ban is never fired by
   any repeatable channel in the repo** (Finding N-2, as narrowed in §2b — the delivered *config*
   is fired, by the consumer-matrix cells among others; what is never fired is that one rule, because no fixture
   in the repo presents an enum), and its factory fixture drives a different selector
   (Finding N-1). A repeatable consumer channel *does* exist — `check:fences-fire` is wired into the delivered `npm run validate`
   ([`setup.d/70-deps.sh:92,95`](../../../setup.d/70-deps.sh)), and an earlier draft's «no
   channel that re-runs it» was false — but that channel runs the same synthetic-config fixture
   arm, so it does not cover the delivered ban either. The lane also needs the devDependency set
   the installer prints: disclosed at install time, but a consumer who skips step 4 has no lint
   at all.
2. **cargo is build-failing only through the delivered workflow** (or the `.getff/Cargo.lints.toml`
   merge) — bare `cargo clippy` warns and exits 0 (§2, F2).
3. **go's proof is container + CI, never operator-host** — the weakest link in *provenance* but
   the strongest in *mechanism*: it is the only lane whose end-to-end consumer install is
   re-fired automatically on every CI run. python/cargo are consumer-proven on a real host as of
   2026-09-09 **and** carry the same install-time gate; npm is consumer-proven on this host only.

## §4 Self-falsification

- **Coverage.** Three lanes, one host (macOS arm64), one stack shape per lane (`ts-server` for
  npm). Rule coverage is uneven and stated per surface: astgrep **4/4** delivered rules fired,
  ruff **3/3** of the flagship bans, cargo **1/1**, npm **2** surfaces of the delivered set (the
  enum ban and opt-in R7) — not all four custom npm rules. `install.sh --refresh`, brownfield
  collision paths and monorepo shapes were not exercised here; the entry-lane suites cover them.
- **Wrong if** a go consumer install fires differently on a machine with the toolchain — the
  one row this addendum could not measure, and the reason the enforcement claim carries
  qualifier 3.
- **Wrong if** the npm ban set a consumer actually receives is materially thinner than what the
  beta implies: I fired 2 of the delivered rule surfaces (the enum ban and R7), not all four
  custom rules.
- **This addendum's own first draft was wrong, and a cold review caught it.** §0 asserted a
  negative-existence claim about the repo («nothing proved that the delivered artefact fires»)
  without grepping `setup.d/` for an existing mechanism — the `#claim-from-memory-not-source`
  shape. Three lanes already shipped exactly the check I said was absent. The retraction is in §0
  rather than a silent edit, and the residual value is now stated as three narrow measured claims
  instead of one broad unmeasured one.
- **And the corrected version was wrong too — the same shape, caught by a second cold review.**
  The retraction above ended «Falsifier: find an npm-lane post-install firing proof anywhere in
  `setup.d/` or `install.sh` — I grepped and found none.» That falsifier was then *met*:
  `check-fences-fire.sh` is exactly such a proof, delivered at
  [`setup.d/40-configs.sh:51`](../../../setup.d/40-configs.sh) and fired at
  [`setup.d/99-finalize.sh:295`](../../../setup.d/99-finalize.sh). The grep that missed it
  searched for the *name* `firing_self_check`, not for the *capability* — a name-shaped search
  standing in for a behaviour-shaped one, which is the identical `#claim-from-memory-not-source`
  error one paragraph up, committed a second time in the same file after retracting it once.
  Recording both is the point: the first retraction did not immunise the second claim, because
  the fix applied was to the conclusion, not to the search method. Finding N-2 was at this point
  restated as «no channel fires the *delivered config*» — a claim about three enumerated arms.
  *That restatement was itself wrong twice more; its final form is the enum-absence grep in §2b,
  see the two bullets below.*
- **A third claim in §3 was asserted with no measurement at all and is now withdrawn.**
  «Generation = 1 (npm)» appeared in the decision section of a document whose §1 requires paired
  measurement, while §2 measured nothing about generation. The repo enumeration that replaced it
  shows python carries an end-to-end live-generation test the claim said did not exist. The
  enumeration is labelled as an enumeration, and the bench falsifier is named in §3.
- **A third cold review found the replacement claim wrong as well — the same shape, a third
  time.** The withdrawal above swapped «Generation = 1» for «generation reaches **two** stacks
  through the shipped consumer entrypoint (npm, python)». That is false: python's
  `--from-practice` arm is invoked by no installer step (`--from-practice` occurs in `setup.d/`
  only inside comments at [`45-python.sh:268,325`](../../../setup.d/45-python.sh); the real
  spawn at [`80-rule-bootstrap.sh:70-73`](../../../setup.d/80-rule-bootstrap.sh) passes
  `--from-research`/`--from-selection`), and the python lane `exit 0`s before the layer loop
  that would run it ([`install.sh:538-541`](../../../install.sh)). I had inferred reachability
  from the *existence* of an e2e test and a CLI flag rather than from the *invocation path* —
  the same source-existence-for-behaviour substitution as the two retractions above, made a
  third time while explicitly trying not to. The pattern is now the finding: in this file, every
  wrong claim has been a statement about what the installer does or does not do, derived from
  reading a file instead of tracing a call. §3 is re-labelled by reachability, and §2b's «three
  arms exist and none of them fires it» — a false exhaustive negative of the same family,
  refuted by [`t6-synth-wire-planted-violation.test.sh:154-179`](../../../tests/install-sh/t6-synth-wire-planted-violation.test.sh)
  — is corrected in the same pass. *(That pass was itself incomplete — see the next bullet.)*
- **Fourth time, and the frame is now retired rather than re-counted.** The «three arms» fix
  above became «four arms», which a fourth cold review refuted with the consumer-matrix cells —
  [`pnpm-monorepo-cell.sh:191,206`](../../../tests/consumer-matrix/pnpm-monorepo-cell.sh) and
  [`getff-dist-cell.sh:74,156`](../../../tests/consumer-matrix/getff-dist-cell.sh) — which
  install with the real `install.sh --full` and fire the **real CLI** over the placed config with
  a paired clean control, CI-gated at
  [`audit-self.yml:1948,1999`](../../../.github/workflows/audit-self.yml). A behaviour-shaped
  sweep afterwards named files that review had not, while itself missing two the enumeration did
  carry, so the fix «add the missing rows» would have failed a fifth time. *(An earlier version of
  this bullet put that sweep at «eleven» files; re-run verbatim it returns five — the number was
  itself a fifth miscount, corrected in §2b, where the real output is now quoted.)*
  **The correction is therefore structural, not another recount:** §2b no longer makes a claim
  whose truth depends on enumerating channels. The negative is restated as a one-command search
  — no fixture in the repo presents a TypeScript `enum` — which is falsifiable by re-running the
  grep and is indifferent to how many channels exist. The lesson this file is actually carrying
  is not «grep for behaviour, not names» (that was retraction 2 and it did not immunise
  retractions 3 and 4); it is that **an exhaustive-negative frame should be abandoned once it
  has failed twice**, in favour of a claim shaped so that completeness is not load-bearing.
  §3's qualifier 1, which had been left restating the refuted blanket, is corrected to match.
- **The clean control is the load-bearing half — and stating it as a blanket was wrong.** An
  earlier draft claimed «every EXIT=1 above is paired with an EXIT=0 on a clean file through the
  same command». Two exceptions existed: R7 was paired only against *itself with the rule
  disabled*, and cargo's failing exit is 101, not 1, with its control file unnamed. Both are now
  repaired by measurement — `src/time-clean.ts` and `src/bin/good.rs` are named, distinct,
  conforming files run through the identical command. The claim as it now stands: **every failing
  exit in §2 is paired with a zero exit on a separately named conforming file through the same
  command**, and without that pair a non-zero exit proves only that the tool ran.
