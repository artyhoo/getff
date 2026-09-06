# Stage report — promote-gate-fixes

> Executor: aif-implement session, 2026-09-03. Branch `feature/promote-gate-fixes-e1e7e2` (base `staging` @ `f49e35311c`).
> **Verdict: local work COMPLETE and verified; external surface PARKED `blocked_external`.**
> Two atomic commits exist locally (`a49373524e` PG-1, `16f340ad7d` PG-2). Push/PR impossible from this
> container: `github.com` TLS egress broken, no GH token, and origin is the wrong repo
> (`Yhooi2/rules-as-tests-aif`, PR 1597 lives on `artyhoo/getff`). Per kickoff §6, PG-1/PG-2 are **not**
> claimed fixed — that claim requires §5 items 6-7 (live CI verdicts), which require the PR.

## §1 Commits (verified local state)

```text
16f340ad7d fix(ci): context7 refresh treats the documented too-early response as a no-op, not a failure
a49373524e fix(deps): record the nested gcp-metadata@7.0.1 peer so npm ci resolves the root lock
f49e35311c (origin/staging) docs(promote-gate-fixes): kickoff for the two CI defects the promote PR surfaced (#1598)
```

- `a49373524e`: `package-lock.json` only, **17 insertions, 0 deletions** — exactly D1's predicted delta.
- `16f340ad7d`: `.github/workflows/context7-refresh.yml` only, 28 insertions / 3 deletions.
- Working tree clean; both commits carry `Prior-art:` escape lines (quoted in §3).

## §2 Acceptance chain (kickoff §5) — item by item, quoted output

**Item 1 — root `npm ci` on the fixed lock: PASS.**

```text
$ NODE_ENV=production npm_config_cache=/tmp/pgf-npm-cache npm ci   # post-fix
npm error Missing: gcp-metadata@7.0.1 from lock file   # ← BASELINE (pre-fix), exit 1
---
added 95 packages, and audited 103 packages in 2m
found 0 vulnerabilities                                # ← post-fix, EXIT_STATUS=0
```

Baseline RED first reproduced on the untouched branch (exit 1, `Missing: gcp-metadata@7.0.1 from lock
file` — exactly the documented defect), then the fix flipped it green. Re-ran with dev deps
(`NODE_ENV=development`, for the sweep): also exit 0.

**Item 2 — merge-base diff is exactly one added package key: PASS.**

`git diff origin/staging...HEAD -- package-lock.json` (origin/staging = `f49e35311c` = branch point):

```diff
+    "node_modules/mongoose/node_modules/gcp-metadata": {
+      "version": "7.0.1",
+      "resolved": "https://registry.npmjs.org/gcp-metadata/-/gcp-metadata-7.0.1.tgz",
+      "integrity": "sha512-UcO3kefx6dCcZkgcTGgVOTFb7b1LlQ02hY1omMjjrrBzkajRMCFgYOjs7J71WqnuG1k2b+9ppGL7FsOfhZMQKQ==",
+      "dev": true,
+      "license": "Apache-2.0",
+      "optional": true,
+      "peer": true,
+      "dependencies": {
+        "gaxios": "^7.0.0",
+        "google-logging-utils": "^1.0.0",
+        "json-bigint": "^1.0.0"
+      },
+      "engines": {
+        "node": ">=18"
+      }
+    },
```

Branch total: 2 files changed, 45 insertions(+), 3 deletions(-) — pure two-file scope. Toolchain:
Node `v22.23.1` / npm `10.9.8` (constraint satisfied; **npm major 10.x under Node 22**, produced by
`npm install --package-lock-only`). Note: live `git fetch` failed (see §4), so the diff is against the
local `origin/staging` ref, which is byte-equal to the branch point; GitHub computes the authoritative
diff at PR time.

**Item 3 — `npm ci --prefix packages/core` (D4 verification): PASS.**

```text
added 60 packages, and audited 61 packages in 52s
found 0 vulnerabilities          # EXIT_STATUS=0
```

D4 confirmed: the core lock is green and was **not** touched (0 `gcp-metadata` entries; not in the diff).
The night-session "both layers" claim remains unconfirmed by any failing surface.

**Item 4 — local sweep: GREEN (one honestly-degraded gate).**

```text
[sweep] WARN-SKIP actionlint — degraded, NOT a real run
[sweep] PASS meta-all-wired
[sweep] PASS sweep-ci-coverage
[sweep] PASS synth-bundle-drift
SWEEP: 4 gate(s) passed (mode=diff)
SWEEP_EXIT=0
```

Scope note: the workflow file sits in `meta-all-wired` + `sweep-ci-coverage` path scope (both PASS);
`package-lock.json` sits in `synth-bundle-drift` scope (PASS). `actionlint` self-reports degraded — the
binary is absent and provisioning is impossible here (`command -v actionlint go` → empty; GitHub release
download → `HTTP 000`), by the script's own design (`scripts/run-local-ci-sweep.sh:159,325-336`). The
authoritative actionlint run is CI's `workflow-integrity.yml` at PR time — to be checked when the PR
exists (unverified-local gap, see §6).

**Items 5-7 — BLOCKED (see §4).** No PR exists; therefore no promote-PR `guard-liveness-fullsweep`
verdict and no post-merge `context7-refresh` run. Per kickoff §6, no "fixed" claim is made.

## §3 PG-2 behavioral verification (D3 semantics — mocked curl, real run-block)

Extracted `context7-refresh.yml:50-92` verbatim, substituted only `curl()` (5 scenarios):

| Scenario | curl rc | body | exit | evidence |
|---|---|---|---|---|
| success | 0 | `{"ok":true}` | **0** | `Refresh requested for /artyhoo/getff.` |
| **documented too-early** | 22 | `{"error":"too-early","message":"Too early to refresh the project. Last update was 1 days ago. Minimum 10 days required between updates."}` | **0** | `Context7 index for /artyhoo/getff is already fresh: service answered too-early… treated as success.` |
| 401 | 22 | `{"error":"unauthorized",…}` | **22** | `::error::Context7 refresh failed… (curl exit 22)` |
| network failure | 7 | (empty) | **7** | `::error::Context7 refresh failed… (curl exit 7)` |
| unset key | — | — | **1** | fails at the key guard, unchanged code path |

Carve-out = `refresh_rc -eq 22` **AND** `"error":"too-early"` token in the body — matched on that exact
response and nothing else. Rejected-shape grep over the file: `continue-on-error` and `|| true` appear
ONLY inside the explanatory comment at `context7-refresh.yml:64`; `--fail-with-body` is retained at
`context7-refresh.yml:72`. Fail-loudly posture preserved (comment block `:52-65` documents the carve-out).

## §4 blocked_external — probe evidence (all quoted, taken at Task-5 time)

```text
$ gh auth status
You are not logged into any GitHub hosts. Run gh auth login to authenticate.

$ git push -u origin feature/promote-gate-fixes-e1e7e2
fatal: unable to access 'https://github.com/Yhooi2/rules-as-tests-aif.git/':
gnutls_handshake() failed: The TLS connection was non-properly terminated.   # exit 128

$ curl -sS -o /dev/null -w '%{http_code}' -L https://github.com/rhysd/actionlint/releases/latest
000

$ curl -sS -o /dev/null -w '%{http_code}' https://api.github.com
200

$ ssh -T git@github.com
ssh: command not found

$ git config --get credential.helper
!f(){ echo username=x-access-token; echo "password=$GH_TOKEN"; };f          # GH_TOKEN unset
```

Three independent blockers; any one alone would park Task 5:

1. **Transport:** `github.com` TLS is broken through this container's proxy (`https_proxy` set;
   `api.github.com` passes with 200, `github.com` fails handshake) — `git push` cannot traverse even
   before auth matters.
2. **Auth:** no `GH_TOKEN`, `gh` unauthenticated — even API-side Git-Data fallback can't authenticate.
3. **Target:** origin is `Yhooi2/rules-as-tests-aif`; the kickoff's PR 1597 and promote flow live on
   `artyhoo/getff`. The PR must be opened there.

**Un-block procedure (operator):** provide a `GH_TOKEN` with `artyhoo/getff` access + fix
`github.com` TLS egress (proxy allowlist) — or harvest the branch externally. Then: push
`feature/promote-gate-fixes-e1e7e2`, open the PR to `artyhoo/getff:staging` (body requirements:
`## Fidelity verdict` + `FIDELITY: skipped — …` + both `### §1.7 …-check applied` sections with
`path.ext:NN` citations), merge, and read the two post-merge verdicts (§5 items 6-7).

## §5 Active AI-traps — how each was satisfied

- **T3** — every claim above carries command output or `file:line` (no prose-only findings).
- **T5** — source scope stayed two files: `package-lock.json` + `context7-refresh.yml` (branch diffstat
  45+/3− across exactly those two); this report is a mandated stage artifact, not a third source file.
- **T14** — local green treated as weak evidence throughout: the lock fix's authority is the
  `guard-liveness-fullsweep` verdict on PR 1597 post-merge (§5 item 6) — still pending, hence no
  "fixed" claim anywhere in this report.
- **T19** — own cold review ran before handoff: rejected-shape grep, `--fail-with-body` retention,
  `gcp-metadata` dep resolvability (3/3 keys present in lock), commit atomicity, trailer placement.
  One gap found and recorded honestly: actionlint degradation (§2 item 4).
- **T20** — the command behind every verdict is quoted next to its output.
- **T15 (self-application)** — did this report's own evidence standard survive its own audit? Yes with
  one caught exception: §2 item 2's diff is computed against the LOCAL `origin/staging` ref because the
  live fetch failed — the report says so in place rather than presenting it as a remote-verified diff;
  that is the same probe-staleness standard §4 applies, applied to this report's own weakest citation.
- **Domain trap (environment-probe staleness):** a probe run earlier in the session is not evidence at
  use time — this container's auth/egress state flipped within the session window (npm registry reachable
  at 22:03 UTC; `github.com` TLS-broken at Task-5 time; documented 3-incident history). §4 therefore
  quotes probes taken AT the moment of use, not the session-start state. Counter: re-probe at the
  moment of every external operation.

## §5b Host-verify contract (run on the HOST before accepting this stage)

Container green is not host evidence. The kickoff's declared contract, for the host acceptor:

```bash host-verify
npm ci
npm ci --prefix packages/core
bash scripts/run-local-ci-sweep.sh
```

Item 1 must PASS on the host (it is the gate PG-1 exists to repair). Items run on a clean checkout of
`feature/promote-gate-fixes-e1e7e2` (commits `a49373524e` + `16f340ad7d`). The environment "cannot"
claims in §4 are probe-backed in place with quoted output and date (2026-09-03, live probes) per
destination-environment-verification §1b.

## §6 Residual risks / unverified surfaces (honest gaps)

1. `guard-liveness-fullsweep` has still never run to completion — the real PG-1 acceptance is pending.
2. `context7-refresh` exemption path verified by mock only; live-run acceptance is §5 item 7 (pending).
3. actionlint did not run locally (§2 item 4); workflow YAML parse is verified only by the sweep's
   scoped gates + the mock extraction. CI `workflow-integrity.yml` is the closer.
4. The `too-early` response was observed 2026-09-03 on the first promote-PR run; if >10 days elapse
   before the PR merges, the service may answer 200 and the exemption path stays unexercised in CI —
   say so explicitly per kickoff §5 item 7 when reporting that verdict.

## §7 Observations for the operator (NOT acted on — per PR strategy + kickoff §8)

1. **§8 root-lock routine-path question stands:** the root lock's only two `npm ci` consumers are a
   `main`-only PR workflow and a release-time regen — that is how this defect survived 682 commits
   with `staging` green. Whether the root layer deserves a routine-path `npm ci` is a separate decision.
2. **`set -u` quirk in context7-refresh.yml:** with `set -euo pipefail`, the unset-key case dies on
   `CONTEXT7_API_KEY: unbound variable` (bash error) before the friendly `::error::` guidance line
   (`context7-refresh.yml:66-68`) can print. Exit status is the same (1, RED), so D3 is unaffected and
   I left it alone (pre-existing, out of scope). A `${CONTEXT7_API_KEY:-}` guard would restore the
   guidance message — candidate one-line follow-up.
3. **Container origin mismatch:** handoff containers point at `Yhooi2/rules-as-tests-aif` while the
   work targets `artyhoo/getff` — combined with the egress park, this suggests the harvest step should
   be operator-side by design (consistent with the egress-no-api-bypass rule).
