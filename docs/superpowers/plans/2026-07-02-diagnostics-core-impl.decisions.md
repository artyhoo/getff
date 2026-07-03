# Diagnostics core (D1) — decision resolutions

> **Authoritative for:** D1 implementation decision resolutions (DN-D1-1..4 + trap resolutions) + owner-fork log.
> **NOT authoritative for:** the D1 design/AC — see the [spec](../specs/2026-07-02-diagnostics-core-design.md); project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists).

**Baseline:** `HEAD == origin/staging == 35c0b410457ee435f769e7595aa7407f53fb553c` (verified `git rev-parse HEAD`). Every `file:line` below was re-opened against this tree — the resolver file has **drifted** from both the spec and the plan line numbers (see the drift note under DN-D1-2's evidence). Where a line number here differs from the plan, **this doc is the re-verified truth**; the plan's line numbers are stale by the `#857` single-label-host guard insertion.

**Drift summary (load-bearing — the plan's `file:line` are off by ~10 lines in the resolver):**

| Anchor | Plan says | Actual (this tree) |
|---|---|---|
| `resolveAllowedSources` | `:159` | `allowlist-resolver.ts:169` |
| `ResolveCtx` | `:141-148` | `:151-158` |
| `validateProvenance` (3-arg) | `:319-323` | `:329-333` |
| `validateUrlAgainstTiers` | `:249` | `:249` (unchanged — matches) |
| `AckFileError` class | — | `:53-55`; throw sites `:70,:73,:80,:87,:97,:103` |

The `#857` single-label-host guard IS on staging: `allowlist-resolver.ts:96-100` (`if (!h.includes('.'))` → `AckFileError`). Re-derive all FF2xxx `file:line` at Task-3 time; the **count (15)** and the **mapping to reason classes** are the load-bearing part, not the exact lines.

---

## DN-D1-1 — 1-arg Tier-0-only wrapper (`allowlist.ts:42`) return shape after migration

**Decision:** KEEP the public return shape `{ ok: boolean; reason?: string }` (`ProvenanceValidation`) on the 1-arg `validateProvenance(p)` wrapper. Do NOT change its signature or return type. Internals MAY derive `{ok, reason}` from a `Diagnostic` if convenient, but the **exported contract stays `{ok, reason}`**. Do not add `Diagnostic | null` to the 1-arg form.

**Rationale:** The 3-arg tiered `validateProvenance(p, resolved, opts?)` is the one the spec §3.3 targets for `Diagnostic | null`. The 1-arg wrapper is a distinct export re-exported through `allowlist.ts` for Tier-0-only back-compat. All three of its non-test consumers read `.ok` and `.reason` directly; changing the shape is a behavior change (violates AC 3). Zero-behavior-change is cheaper and correct here.

**Evidence (grep of every non-test consumer of the 1-arg export from `allowlist.ts`):**
- `research/load.ts:14` imports it; `:43` `const v = validateProvenance(p)`; `:45` reads `v.reason` (throws `provenance violation — ${v.reason}`).
- `research/validate-plan.ts:14` imports as `validateProvenanceTier0Only`; `:46` calls `validateProvenanceTier0Only(p)` in the Tier-0 fallback path; `:47` reads `v.ok`; `:49` reads `v.reason`.
- `research/research-adapter-anthropic.ts:9` imports it; `:228` `const v = validateProvenance(prov)`; `:229` reads `v.ok`; `:235` reads `v.reason`.

Command: `grep -rn "from '.*allowlist\.ts'" packages/core | grep -v allowlist-resolver | grep -v '\.test\.'` → exactly those 3 files.

**Falsifier ("wrong if …"):** wrong if any of those 3 consumers is refactored in D1 to consume a `Diagnostic` (none is — all keep reading `{ok, reason}` per AC 3), OR if a 4th consumer of the 1-arg export exists that the grep missed (it does not — the grep is exhaustive over `packages/core`).

---

## DN-D1-2 — FF2009 granularity: one code vs four

**Decision:** ONE code — `FF2009` ("no Tier-1-eligible host in package metadata"). Do NOT split into four (multi-tenant / non-https / IDN / IP-metadata).

**Rationale:** The resolver emits **one** reason string for all four physical causes — it does not currently distinguish them at the emit site (the four `continue` branches at `allowlist-resolver.ts:199-201` all fall through to the single `hosts.length === 0` return). A code should label a reason the code actually emits (spec §3.1: message/code is derived from the real diagnostic, not invented). Splitting `FF2009` into four would invent distinctions the resolver does not make → the four codes would be unreachable-by-cause, i.e. `#discipline-theatre` (a registry test placeholder that never fires with three of its four codes). If a future change makes the resolver emit distinct reasons per cause, split then (append-only registry supports it).

**Evidence:** `allowlist-resolver.ts:195-209` — a single `for (const field of candidateFields)` loop with `continue` on IP-literal (`:199`), punycode (`:200`), multi-tenant (`:201`); then ONE terminal `if (hosts.length === 0) return { ok: false, reason: 'no Tier-1-eligible host in ${packageName} metadata (multi-tenant or non-https)' }` (`:204-209`). No per-cause reason is produced. `grep -c 'no Tier-1-eligible host' packages/core/research/allowlist-resolver.ts` → 1 emit site.

**Falsifier ("wrong if …"):** wrong if the resolver is changed (in `trust-tiers-did-review` or later) to emit four distinct per-cause reasons at `:199-201` — then FF2009 must split to preserve one-code-per-emitted-reason. Re-check `grep 'no Tier-1-eligible\|multi-tenant\|non-https' allowlist-resolver.ts` after the rebase onto `trust-tiers-did-review`.

---

## DN-D1-3 — `load.ts` scope: adapter-only, no store-wide accumulation

**Decision:** ADAPTER-ONLY. `ResearchEntryError` gains `.diagnostics: Diagnostic[]`; `tryLoad` / `loadEntries` keep **throw-per-entry** semantics (first bad entry throws, no accumulation across entries). Confirmed: no caller depends on accumulation.

**Rationale:** `loadEntries` returns `ResearchEntry[]` and throws on the first malformed/provenance-violating entry via `tryLoad` (`load.ts:39, 45`). Making it accumulate store-wide would change the return contract and the throw timing — a behavior change out of D1 scope (spec §3.3). Adding `.diagnostics` to the thrown error is additive (like `ResearchPlanError` gaining `.diagnostics`), zero behavior change.

**Evidence (grep of every `loadEntries` consumer):**

```bash
grep -rn "loadEntries" packages/core
```

Result: `loadEntries` is defined at `load.ts:74` and its consumers all treat it as throw-or-return-array (none inspects a partial/accumulated result). No caller wraps it expecting a `{ok, diagnostics}` shape. `tryLoad` (`:35`) is file-local. The throw-per-entry contract is asserted by `load.test.ts` (existing suite — must stay untouched-green per AC 3).

**Falsifier ("wrong if …"):** wrong if a `loadEntries` consumer exists that catches per-entry and continues (would benefit from accumulation) — none found; the function throws out of the whole call. Re-run `grep -rn 'loadEntries' packages/core` before Task 3.5 to reconfirm no new consumer landed post-rebase.

---

## DN-D1-4 — FF3xxx allocation (concrete numbered table)

**Decision:** Allocate **one FF3xxx code per failure KIND per gate**, exactly as spec §3.4 states ("one code per failure kind per gate"). This yields **20 codes** (`FF3001`–`FF3020`). The `ast-grep engine reserved but not wired` deferred-branch is counted **once per gate it appears in** (5 gates), NOT collapsed to a single shared code — because the spec text is per-gate and the gate identity is a meaningful discriminator (the `path`/gate context differs). A shared-astgrep alternative would give 16 codes; it is rejected as a spec deviation (see rationale).

**Rationale:** Per-gate allocation honors the literal spec §3.4 wording and keeps each code's `path` unambiguous (the gate name is part of the diagnostic context). The astgrep-deferred text is *nearly* identical across 5 gates but `gate-require-vacuity.ts:72` already diverges ("...for require-vacuity gate — deferred per generator-require-composite-tier decision" vs the other four's "...deferred per generator-forbid-mvp decision (i)") — proving the branches are NOT a single semantic unit. One code per gate is the honest mapping.

**Evidence:** enumerated from every `reason:` failure branch across the 8 gate files (`grep -n 'reason:' packages/core/validator/gate-*.ts`, then read each multi-line branch):

| Code | Gate | Failure kind | `file:line` (this tree) |
|---|---|---|---|
| `FF3001` | schema | SynthesisPlan schema violation (ajv) | `gate-schema.ts:16` |
| `FF3002` | schema | eslint/declarative rule has no negative-test | `gate-schema.ts:29` |
| `FF3003` | ruleTester | ast-grep engine reserved, not wired (deferred) | `gate-rule-tester.ts:93` |
| `FF3004` | ruleTester | eslint rule has no negative-test | `gate-rule-tester.ts:103` |
| `FF3005` | ruleTester | negative-test input produced no expected violation | `gate-rule-tester.ts:139` |
| `FF3006` | ruleTester | examples.good produced unexpected violation | `gate-rule-tester.ts:153` |
| `FF3007` | tautology | rule fires on negative-corpus file | `gate-tautology.ts:79` |
| `FF3008` | conflict | references plugin rule not in preset registry | `gate-conflict.ts:48` |
| `FF3009` | conflict | rule has no eslintConfigSnippet entry (B1 drop) | `gate-conflict.ts:57` |
| `FF3010` | singleTokenDiff | ast-grep engine reserved, not wired (deferred) | `gate-single-token-diff.ts:64` |
| `FF3011` | singleTokenDiff | bad/good differ by > MAX_TOKEN_EDITS | `gate-single-token-diff.ts:74` |
| `FF3012` | messageIdCoverage | ast-grep engine reserved, not wired (deferred) | `gate-message-id-coverage.ts:71` |
| `FF3013` | messageIdCoverage | declared check.message unreachable | `gate-message-id-coverage.ts:108` |
| `FF3014` | messageIdCoverage | declared check.messageId unreachable | `gate-message-id-coverage.ts:116` |
| `FF3015` | autofixClean | ast-grep engine reserved, not wired (deferred) | `gate-autofix-clean.ts:123` |
| `FF3016` | autofixClean | fixer produced unparseable output | `gate-autofix-clean.ts:164` |
| `FF3017` | autofixClean | fix incomplete / introduces same-rule violations | `gate-autofix-clean.ts:182` |
| `FF3018` | requireVacuity | ast-grep engine reserved, not wired (deferred) | `gate-require-vacuity.ts:72` |
| `FF3019` | requireVacuity | direction A — selector never fires on examples.bad | `gate-require-vacuity.ts:86` |
| `FF3020` | requireVacuity | direction B — selector fires on good example | `gate-require-vacuity.ts:96` |

**Count = 20.** The 8 gates are confirmed in `validator/validate.ts:23-31` (schema, ruleTester, tautology, conflict, singleTokenDiff, messageIdCoverage, autofixClean, requireVacuity).

**Falsifier ("wrong if …"):** wrong if a gate grows/loses a failure branch before Task 4 (re-run `grep -n 'reason:' packages/core/validator/gate-*.ts` and diff against this table), OR if the maintainer explicitly prefers a single shared `FF30xx` for the astgrep-deferred branch (would collapse to 16 — a legitimate alternative, but not the spec-literal reading). If a `reason:` grep at Task 4 returns a count ≠ this table, STOP and re-enumerate before allocating.

> **Alternative on record (16-code shared-astgrep):** if the Executor finds the 5 near-duplicate astgrep codes ugly, one shared `FF3003` reused across the 5 deferred branches drops the total to 16. This is a defensible reading ("failure kind" = semantic, and the deferred-marker is one semantic kind). The **spec-literal choice is 20** (per-gate); the shared choice is 16. Default = 20; the Executor may downgrade to 16 with a one-line rationale in the registry, since both satisfy "one code per kind" under different readings of "kind". Do NOT silently pick — record which.

---

## NEW-1 — ajv SSOT verdict / principle-11 F2 safety

**Decision:** Use verdict cell string **`ADOPT`** for the ajv SSOT row (#194 below), with "reuse the existing `ajv` dependency (already in `packages/core`)" in the Rationale cell. Do NOT write a literal `| REUSE |` verdict cell. Do NOT add `REUSE` to the `VERDICTS` set.

**Rationale (least-invasive correct option):** `REUSE` is NOT a recognized verdict in principle 11's `VERDICTS` set. F2 (`11-build-first-reuse-default.test.ts:317-330`) parses each SSOT row `cells[6]` (the Verdict column) and fails if `!VERDICTS.has(verdict)`. A literal `| REUSE |` at cells[6] WOULD fail F2. Two fixes exist: (a) use `ADOPT` (recognized; "reuse existing dep" is exactly what ADOPT means — depend on the upstream verbatim), or (b) add `REUSE` to `VERDICTS`. Option (a) is strictly less invasive (zero test edits, no new vocabulary to maintain, no precedent for a synonym of ADOPT) and semantically exact: ADOPT = "use upstream tool/pattern verbatim; depend on upstream" (`build-first-reuse-default.md §1`), which is precisely reusing the already-present ajv dep. Option (b) would fork the vocabulary for no gain. Choose (a).

**Evidence:**
- `VERDICTS` set = `11-build-first-reuse-default.test.ts:69-95`: `ADOPT, ADOPT VOCABULARY, ADOPT-VOCABULARY, ADAPT, REFERENCE, KEEP NARROW, KEEP-NARROW, BUILD, REJECT, DEFER, WATCHLIST, ADOPT-CONDITIONAL, ADOPT WHEN TRIGGERED, HYBRID, ADAPT+generative`. **`REUSE` absent.**
- F2 parse: `:256` `const cells = line.split('|')`; `:260` `const verdict = cells[6]?.trim()`; `:324` `if (!VERDICTS.has(verdict))` → violation.
- `grep -cE "\| REUSE \|" docs/meta-factory/prior-art-evaluations.md` → **0** (no existing row uses `REUSE` as a verdict cell; `REUSE` appears only inside Rationale prose, e.g. #112 "every helper it drives is REUSED" — that is cells[7], not cells[6], so it does not trip F2).
- SSOT column layout confirmed on row #188: cells[1]=id, cells[6]=`ADAPT` (verdict), cells[7]=rationale.

**Falsifier ("wrong if …"):** wrong if `VERDICTS` already contained `REUSE` (it does not — grep above), OR if F2 read a different cell index (it reads `cells[6]` — verified). If a future maintainer wants `REUSE` as a first-class verdict, that is a separate `build-first-reuse-default.md §1` change, out of D1 scope.

> **Executor note:** the spec §7 and plan Global Constraints both write "ajv … REUSE" as shorthand for the *decision*, not as the literal verdict-cell string. Honor the intent (reuse the existing dep) with the compliant cell `ADOPT`. This is the one place the spec/plan wording would fail CI if typed verbatim.

---

## NEW-2 — FF2014 is THROWN (`AckFileError`), not returned by `validateProvenance`

**Decision:** `AckFileError` gains `.diagnostics: Diagnostic[]` carrying an `FF2014` diagnostic (parallel to `ResearchPlanError` / `ResearchEntryError` gaining `.diagnostics`). Register `FF2014` in the registry as the ack-malformed family code. Wire it ONLY at the `AckFileError` construction sites in `loadAckFile` — do NOT try to route it through `validateProvenance`'s return path (it never surfaces there; ack-file load happens earlier, at `resolveAllowedSources`/`loadAckFile` time). Keep `.message`/`.name` unchanged (message fidelity — the existing `AckFileError` message strings are the contract that `allowlist-resolver.test.ts` asserts on).

**The `#857` single-label-host reject lands as an FF2014 sibling within the same family:** it is one more `AckFileError` throw (`allowlist-resolver.ts:96-100`), same fail-closed class as the IP-literal / dup-key / bad-date / bad-JSON rejects. Register it under `FF2014` (ack-malformed family) — do NOT allocate a distinct code unless the Executor wants per-cause ack codes (same one-code-vs-many trade-off as DN-D1-2; default = fold into `FF2014`, consistent with the sibling IP-literal reject also folding into `FF2014`).

**Rationale:** `AckFileError` is thrown by `loadAckFile` (6 throw sites: `:70` bad JSON, `:73` bad shape, `:80` bad date, `:87` IP-literal host, `:97` single-label host [#857], `:103` dup key). It is a resolve-time fail-closed error, not a `validateProvenance` return value. The plan's FF2xxx table lists FF2014 in a "validateProvenance-return set" — that framing is slightly off: FF2014's home is the thrown-error `.diagnostics`, mirroring how `ResearchPlanError` (a thrown error) carries `.diagnostics`. This is the minimal, zero-behavior-change wiring: attach a `Diagnostic[]` to the error object; callers that only read `.message` (rule-bootstrap-cli style) are unaffected.

**Evidence:**
- `AckFileError` class `allowlist-resolver.ts:53-55`; throw sites `:70,:73,:80,:87,:97,:103` (`grep -n 'AckFileError(' packages/core/research/allowlist-resolver.ts`).
- `#857` single-label guard: `:96-100` (`if (!h.includes('.'))` → `AckFileError('single-label host ...')`), verified on staging.
- No `validateProvenance` return path emits an ack-malformed reason — `validateUrlAgainstTiers` only *reads* an already-loaded `resolved.tier2` map (`:291`); the ack file was already parsed (and would have thrown) at `resolveAllowedSources` → `loadAckFile` (`:170-171`). So FF2014 cannot surface from `validateProvenance`; wiring it there would be dead code.

**Falsifier ("wrong if …"):** wrong if a caller inspects `AckFileError` structurally (beyond `.message`) today — none does (the 3 error-message consumers all read `.message`). Wrong if the `trust-tiers-did-review` rebase changes the `AckFileError` throw sites — re-grep `AckFileError(` after rebase and re-map.

---

## NEW-3 — Message-fidelity constraint (BINDING Executor constraint, not a fork)

**Constraint:** For zero-behavior-change, each FF-code's registry template MUST interpolate to a `message` that **contains the exact substring** the current reason string carries, AND the `ResearchPlanError` wrapper text `pattern[${id}] provenance violation — ${...}` (`validate-plan.ts:48-49`) and the `load.ts` wrapper `provenance violation — ${v.reason}` (`load.ts:45`) MUST be preserved verbatim. The migration is verifiable precisely because these existing tests assert on message substrings — they are the primary backstop. Any code whose template drops a currently-asserted substring breaks an existing suite (violates AC 3).

**Message-fidelity targets (which tests assert which substrings — the Executor's fidelity checklist):**

| Test `file:line` | Asserted substring / matcher | Guards code |
|---|---|---|
| `research/validate-plan.test.ts:80` | `.toThrow(/provenance violation/)` | wrapper text (all FF2xxx via ResearchPlanError) |
| `research/tier1.test.ts:168` | `v.reason` `.toMatch(/cross-package/)` | FF2010 |
| `research/tier1.test.ts:310` | `v.reason` `.toMatch(/is not a direct dependency/)` | FF2007 |
| `research/tier1.test.ts:311` | `v.reason` `.not.toMatch(/unknown allowlistKey/)` | FF2007 (must NOT collapse to FF2005 text) |
| `research/tier1.test.ts:368` | `.toThrow(/unknown allowlistKey|not authorized/)` | FF2005 / FF2007 |
| `research/allowlist-resolver.test.ts` | pinned reason strings (trailing-dot FQDN, IP-literal reject reason, punycode reject reason) — the S1 pinned-divergence suite | FF2001-FF2004, Tier-0 back-compat |
| `research/allowlist.test.ts` | Tier-0 `{ok, reason}` back-compat asserts | 1-arg wrapper (DN-D1-1) |
| `validator/gate-rule-tester.test.ts:206` | `.toMatch(/ast-grep engine reserved but not wired/)` | FF3003 (astgrep-deferred message) |
| `validator/gate-*.test.ts` (each gate's suite) | gate `reason:` substrings + `expected-*-validate.json` fixtures | FF3001-FF3020 (L4 `code` field is ADDED, reason text unchanged) |

**Executor rule:** run the full existing suite untouched (`npx vitest run packages/core/`) after each Task; the L4 `expected-*-validate.json` fixture diffs must contain ONLY the added `code` field (AC 3 / plan Task 4.3). If any message-substring test goes RED, the template dropped a required substring — fix the template, not the test.

---

## DN-D1-5 — 3-arg `validateProvenance` return-type change breaks `tier1.test.ts` (~15 assertion sites)

> **Added 2026-07-03 by the orchestrator mid-run** (surfaced when Task 3 dispatch re-verified the tree). A genuine technical fork the spec/plan did not reckon with, because `tier1.test.ts` landed in trust-tiers **S2 — after** the spec was written (the spec §3.3 still described `validateProvenance` as 2-arg; the plan corrected it to 3-arg but did not address the test's `.reason` reads). Resolved on the merits; WF2's two independent reviewers are the anti-collusion check on this call.

**Decision:** OPTION A — change the 3-arg `validateProvenance(p, resolved, opts?)` return type to `Diagnostic | null` (spec §3.3 intent), constructing the `Diagnostic` natively via `diag('FF2xxx', params)` at each failure site inside `validateUrlAgainstTiers`, and **migrate `tier1.test.ts` + `validate-plan.test.ts`** to the new shape. Do NOT keep a parallel stringly-typed function (Option B rejected — it defeats D1's purpose of killing stringly-typed reason discrimination).

**Migration rules (mechanical, fidelity-preserving):**
- `null` = provenance OK (no diagnostic); a `Diagnostic` = failure. So the `.ok` semantics **flip**: `expect(v.ok).toBe(false)` → `expect(v).not.toBeNull()`; `expect(v.ok).toBe(true)` → `expect(v).toBeNull()`.
- `expect(v.reason).toMatch(/X/)` → `expect(v?.message).toMatch(/X/)` AND additionally assert the structured code (`expect(v?.code).toBe('FF20NN')`) — the code assertion is the D1 win; the message-substring stays as the NEW-3 fidelity proof.
- **DO NOT touch `tier1For(...)` calls** — `tier1For` returns `Tier1Result {ok, reason}` (the resolver's own type, `allowlist-resolver.ts:159-161`), which D1 does NOT change. Only `validateProvenance(...)` call sites migrate. E.g. `tier1.test.ts:150-153` (`resolvedSsh.tier1For('pkg-d')` → `{ok, reason}`) stays byte-unchanged.
- The 1-arg wrapper `validateProvenance(p)` (`allowlist.ts:42`) KEEPS `{ok, reason}` (DN-D1-1) — its consumers (`load.ts`, `research-adapter-anthropic.ts`) and `allowlist.test.ts` stay byte-untouched. It derives `{ok, reason}` from the Diagnostic internally (`reason = diag?.message`, `ok = diag === null`).

**Rationale / evidence:**
- `tier1.test.ts` calls the 3-arg form and reads `.ok`/`.reason` at ≥15 sites (`rg -n 'validateProvenance\(|\.reason|\.ok' packages/core/research/tier1.test.ts` → :162, :167-168, :216, :225, :228, :237, :292-293, :308-311, :326, :334, :339, :347, :352, :356).
- AC 3 (spec §8 / plan Global Constraints) names the "untouched-green" callers explicitly: **synthesizer CLI, file-clients, rule-bootstrap-cli, installer `ValidationReport.ok`, `--strict` exit codes**. `tier1.test.ts` is NOT among them — it is a unit test *of the resolver surface D1 redesigns*, so migrating it is in-scope, not an AC-3 violation. The AC-3 "untouched" set = tests of UNCHANGED surfaces (`allowlist.test.ts` 1-arg, `load.test.ts`, `research-adapter-anthropic` tests, all `validator/gate-*` suites).
- Option B (dual function) would leave a stringly-typed `validateProvenance` alive next to a `validateProvenanceDiag` — the exact "one spec, N enforcement points" drift D1 §1 exists to eliminate.

**Falsifier ("wrong if …"):** wrong if `tier1.test.ts` turns out to be in a trust-tiers do-not-edit set (it is NOT — only `research-source-trust.md` + `principles/30` are forbidden; `allowlist-resolver.ts` is explicitly "now yours"), OR if a caller outside the AC-3 list consumes the 3-arg form's `.reason` in production (grep: only `validate-plan.ts` does, and it is rewritten in Task 3.1/3.3). If the migrated `tier1.test.ts` needs to WEAKEN any assertion (drop a substring check rather than move it to `.message`/`.code`), STOP — that means fidelity broke.

---

## FF2xxx table (15 codes) — reconfirmed against this tree

Each `file:line` re-opened at `HEAD == 35c0b4104`. `reason:` sites enumerated via `grep -n 'reason:' packages/core/research/allowlist-resolver.ts` (excluding the two type-declaration lines `:47`, `:161`).

| Code | Reason class | Emit `file:line` (this tree) | Returned/Thrown | Paired-negative (plan) |
|---|---|---|---|---|
| `FF2001` | malformed URL (parse throw) | `allowlist-resolver.ts:353` | returned | — |
| `FF2002` | non-https scheme | `:356` | returned | S1-N4 |
| `FF2003` | IP-literal host | `:360` | returned | (S1 IP-ack) |
| `FF2004` | punycode (`xn--`) host outside ack | `:368` | returned | S1-N5 |
| `FF2005` | unknown allowlistKey (no tier) | `:319` | returned | S1-N1 |
| `FF2006` | Tier-0 host not in key's host list | `:264` | returned | — |
| `FF2007` | Tier-1 not a direct dependency | `:189` | returned | S2-N1, S2-N2 |
| `FF2008` | Tier-1 no ecosystem adapter (S1 back-compat) | `:181` | returned | — |
| `FF2009` | Tier-1 no eligible host (single code — DN-D1-2) | `:207` | returned | S2-N3/N4/N6/N7 |
| `FF2010` | cross-package provenance (T-RTT-A) | `:275` | returned | S2-N5 |
| `FF2011` | Tier-1 host not in derived set | `:284` | returned | — |
| `FF2012` | Tier-2 ack scope mismatch | `:296` | returned | — |
| `FF2013` | Tier-2 host not in acked hosts | `:314` | returned | — |
| `FF2014` | ack-file malformed family (bad JSON/shape/date/IP/single-label #857/dup-key) | `AckFileError` `:70,:73,:80,:87,:96-100,:103` | **thrown** (NEW-2) | S1-N2, S1-N3 |
| `FF2015` | finalUrl redirect crosses authorizing tier | `:341` | returned | (Task 2.5 redirect) |

**Count = 15.** (Plus `FF1001` generic ajv-shape, `params:{keyword,instancePath,schemaPath}`, spec §3.2.) Every line re-verified; the plan's numbers (`:342, :345, :309, :252, :178, :195, :263, :283, :302, :326, :169`) were pre-drift and are now ~10 lines low in most cases — use the table above.

---

## SSOT rows to add (#189–#194) — exact verdict-cell strings

New rows start at **#189** (verified SSOT max id = 188; `grep -oE '^\| ?[0-9]+ ' | tail` → 188; `#189` is the next free id). Every verdict below is in the principle-11 `VERDICTS` set — **none requires editing `VERDICTS`** (the ajv row uses `ADOPT`, not `REUSE`, per NEW-1).

| # | Capability | Verdict cell (cells[6]) | In VERDICTS? |
|---|---|---|---|
| 189 | rustc diagnostics architecture (`{code, level, spans, message}` model + `error_codes!` registry; rustc-dev-guide diagnostics.html) — distinct from #166 (compiler self-hosting), this is the *diagnostics-architecture* reference | `REFERENCE` | ✓ |
| 190 | tsc `diagnosticMessages.json` central code registry (per-phase numeric ranges 1xxx/2xxx; build-time uniqueness) | `ADAPT` | ✓ |
| 191 | SARIF 2.1.0 static-analysis result format | `KEEP NARROW` | ✓ (`KEEP NARROW` and `KEEP-NARROW` both in set) |
| 192 | zod dual-API `parse` (throw) / `safeParse` (result) over one `issues[]` | `ADOPT VOCABULARY` | ✓ |
| 193 | Fowler "Replace Throw with Notification" (accumulate expected failures; exceptions for programmer bugs only) | `ADAPT` | ✓ |
| 194 | ajv (already a `packages/core` dependency) — shared single-config validator factory over the two current Ajv stacks | `ADOPT` | ✓ (NOT `REUSE` — NEW-1) |

**Rationale/Trigger cells (cells[7], cells[8]):** each row needs a Rationale (with a T16 problem-class check per `build-first-reuse-default.md §4`) and a "Trigger to revisit" per SSOT §3. For #194 the Rationale MUST say "reuse the existing ajv dep — no new dependency" so the `ADOPT` verdict reads correctly (ADOPT = depend on upstream verbatim; here the upstream is already depended-on). Adjacent entries to cite as consulted (spec §7): #154 (ESLint RuleTester, ADOPT), #155 (Semgrep, ADAPT), #166 (compiler-bootstrap oracle vocabulary), #188 (installed-package metadata, ADAPT — the trust-tiers sibling).

---

## Capability-commit checklist

D1 adds a new subdirectory `packages/core/diagnostics/` with files ≥50 LOC → **capability commit** (CLAUDE.md build-vs-reuse invariant; `.husky/pre-push` detects "new file ≥50 LOC under a new subdirectory of `packages/core/<new-dir>/`" AND "new file ≥80 LOC anywhere under `packages/`").

**New capability files (likely ≥50 LOC — the commit(s) introducing each MUST carry a `Prior-art:` trailer):**

| File | Likely ≥50 LOC? | Trailer requirement |
|---|---|---|
| `packages/core/diagnostics/types.ts` | borderline (~15 LOC — the `Diagnostic` interface) | if <50 LOC and same-commit as `registry.ts`, one trailer covers the commit |
| `packages/core/diagnostics/registry.ts` | YES (15 FF2xxx + FF1001 + 20 FF3xxx rows + `diag()` factory) | **`Prior-art:` trailer required** |
| `packages/core/diagnostics/registry.test.ts` | test file — NOT a capability commit (tests for existing/new capability are carved out) | trailer optional; the *capability* commit carries it |
| `packages/core/diagnostics/ajv.ts` | YES (factory + `ajvErrorsToDiagnostics`) | **`Prior-art:` trailer required** |
| `packages/core/diagnostics/to-diagnostics.ts` | likely (~50+ LOC report→Diagnostic[] adapter) | **`Prior-art:` trailer required** |

**Trailer content (each introducing commit):**
```text
Prior-art: prior-art-evaluations.md#189 (rustc diagnostics, REFERENCE), #190 (tsc diagnosticMessages.json, ADAPT), #191 (SARIF 2.1.0, KEEP NARROW), #192 (zod dual-API, ADOPT VOCABULARY), #193 (Fowler Notification, ADAPT), #194 (ajv shared factory, ADOPT — reuse existing dep).
```
Stack multiple `Prior-art:` lines if the pre-push parser prefers one ref per line (each line independently parsed per CLAUDE.md). The SSOT rows #189–#194 MUST land in the **same D1 PR** as the capability files (principle 11 F1 checks the introducing commit's trailer OR an SSOT verbatim-path/keyword match; the SSOT rows provide the match, the trailer provides the belt-and-suspenders). Note: principle 11's git-log check only sees a capability file's trailer AFTER it is committed — so the acceptance run (`npx vitest run packages/core/`) must happen after the capability commit, not before.

**Non-capability commits in the D1 PR** (fixture regen, bundle regen, L4 `code`-field additions to existing files, doc edits) — if the pre-push hook flags one in a mixed PR, use the escape hatch: `Prior-art: skipped — snapshot/bundle regen after registry addition, no new capability` (≥20 chars, specifies why).

---

## Surprises found that change the plan

1. **Resolver line numbers drifted ~10 lines** from BOTH the spec and the plan (the `#857` single-label guard inserted `:91-100`). The plan's FF2xxx `file:line` are stale. The FF2xxx table above is re-verified; the Executor must re-derive again after the `trust-tiers-did-review` rebase (that umbrella edits the SAME file — plan's cross-umbrella-coupling note is correct; serialize).
2. **`REUSE` is a real F2 failure** if typed as the ajv verdict cell (NEW-1) — the spec/plan shorthand "ajv … REUSE" would fail `npx vitest run packages/core/` (part of acceptance). Resolved to `ADOPT`.
3. **FF2014 is thrown, not returned** (NEW-2) — the plan's FF2xxx table framing ("a validateProvenance-return set") is slightly wrong for FF2014; it lives on `AckFileError.diagnostics`. Wiring it into `validateProvenance` would be dead code.
4. **FF3xxx = 20 codes** (per-gate, spec-literal) with a documented 16-code shared-astgrep alternative. The plan said "do NOT pre-number" — this doc now pre-numbers so the Executor types it in; the count is the load-bearing output of DN-D1-4.
5. **The astgrep-deferred branch text already diverges** (`gate-require-vacuity.ts:72` vs the other four) — evidence that per-gate (20) is the honest reading over shared (16).

---

## Pending OWNER decisions (not blocking D1)

These are genuine maintainer forks (taste/strategy/scope, no determinate best on the project's merits). Logged per `recommendation-laziness-discipline.md §3` — surfaced, NOT decided. D1 proceeds without them; they belong to the multi-toolchain direction (spec §9), not D1.

### OWNER-1 — README widening for multi-toolchain

`README.md:8` pins the project to TS/React ("TypeScript / React"). The multi-toolchain direction (spec §9: `{toolchain: npm|cargo|go|maven, stack}`) needs a deliberate maintainer edit to the goal-bearing README (a goal-adjacent artifact — reviewer/impl sessions are read-only for it per the Artifact Ownership Contract).

- **Option A** — widen `README.md:8` now (e.g. "TypeScript/React today; multi-toolchain by design") → consequence: the goal statement matches the stated direction; but it is a structural edit to a frozen-ish authority doc, done ahead of the Rust pipeline actually shipping (risk: promising a capability not yet built).
- **Option B** — leave `README.md:8` as-is until the Rust pipeline lands → consequence: README stays honest to shipped reality; but the spec §9 direction and the README read as mismatched to a fresh reader during the interim.

**Maintainer decides.** Not a D1 concern (D1 ships no toolchain widening).

### OWNER-2 — AGENTS.md fenced-block ownership (consumer-owned vs framework-owned)

`INSTALL-FOR-AI.md:301-306` establishes the fenced AGENTS.md blocks as **consumer-owned** (three-layer authority + `.override.md` escape hatch). The multi-toolchain patch (§9 p.5, per the R-phase patch) contemplates framework-owned blocks for toolchain-specific guidance.

- **Option A** — keep fenced blocks consumer-owned (status quo) → consequence: consumers retain full authority over their AGENTS.md; but framework-shipped toolchain guidance has no authoritative injection point (must go through the override seam).
- **Option B** — carve out framework-owned toolchain blocks → consequence: the framework can ship authoritative per-toolchain AGENTS.md guidance; but it narrows the consumer-owned surface established by `INSTALL-FOR-AI.md:301-306` — a change to the shipped-artefact authority model.

**Maintainer decides.** Not a D1 concern (D1 ships no AGENTS.md block changes).
