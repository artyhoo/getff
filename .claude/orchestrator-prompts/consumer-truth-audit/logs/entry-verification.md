# §1 Entry re-verification — 2026-09-08T18:12:58Z

## Check 1: bash install.sh --dry-run in a fresh dir
```
$ cd /tmp/tmp.f1HHEoQ0zp && bash /home/www/rules-as-tests-aif-feature-consumer-truth-audit-55b9ad-55b9ad6a-8c8d-47de-8672-bbe63c892370/install.sh --dry-run </dev/null
▶ Verifying shipped artefacts carry Authoritative-for headers
  ✓ all 30 shipped artefacts carry valid headers
[profile] env (non-interactive default; --profile core for rules-only, --profile factory for the AIF suite)
[profile] env
⚠  No package.json found in /tmp/tmp.f1HHEoQ0zp — proceeding with dry-run preview anyway.
What stack does this project use?
  1) ts-server    — Node.js + Fastify/Hono/Express (server only)
  2) react-next   — React 19 + Next.js 15 App Router
  3) react-spa    — React 19 + Vite SPA (Feature-Sliced Design)
  4) react-native — React Native / Expo (Expo or bare-RN baseline)
--- exit=1
```

## Check 2: --profile core|env|factory accepted (install.sh:577)
```
$ sed -n '577,578p' install.sh
  case "$PROFILE" in
    core|env|factory) ;;
```

## Check 3: ls packages/core/backends/*/capability-matrix.json (expect 5)
```
$ ls packages/core/backends/*/capability-matrix.json
packages/core/backends/astgrep/capability-matrix.json
packages/core/backends/cargo/capability-matrix.json
packages/core/backends/golangci/capability-matrix.json
packages/core/backends/npm/capability-matrix.json
packages/core/backends/ruff/capability-matrix.json
--- count: $(ls packages/core/backends/*/capability-matrix.json 2>/dev/null | wc -l)
```

## Check 4: /Users/art/code/timeliner/.claude exists, no rules/ subdir (host-scoped)
```
$ ls -la /Users/art/code/timeliner/.claude 2>&1
ls: cannot access '/Users/art/code/timeliner/.claude': No such file or directory
--- exit=2 (2 = No such file or directory: path is a macOS host path; this census runs in a Linux container)
```

## Check 5: container reaches api.github.com (200) but not github.com (000)
```
$ curl -s -o /dev/null -w '%{http_code}' --max-time 10 https://api.github.com
api.github.com -> 200 (exit=0)
$ curl -s -o /dev/null -w '%{http_code}' --max-time 10 https://github.com
github.com     -> 000 (exit=35)
```

> Correction (log hygiene): the count line above was written literally instead of evaluated. Evaluated now:
> ```
$ ls packages/core/backends/*/capability-matrix.json | wc -l
5
> ```

## §1 verdicts
| # | Expected | Measured | Verdict |
|---|---|---|---|
| 1 | dry-run runs to the stack prompt | reached the 4-stack prompt (install.sh:700); exit=1 is the designed EOF branch — `read -rp` at :706 → empty choice → `*) echo "❌ Invalid choice"; exit 1` at :709-710 | PASS |
| 2 | --profile core\|env\|factory accepted at install.sh:577 | `case "$PROFILE" in` / `core\|env\|factory) ;;` quoted at :577-578 | PASS |
| 3 | 5 capability-matrix.json | 5 (astgrep, cargo, golangci, npm, ruff) | PASS |
| 4 | /Users/art/code/timeliner/.claude exists, no rules/ | absent in this Linux container — host-scoped stratum → Task 6 emits host-verify-aged.sh; never faked | N/A (host-scoped) |
| 5 | api.github.com 200 / github.com 000 | 200 (exit 0) / 000 (exit 35, TLS handshake) | PASS |

**No in-container row disagrees with its expectation → census proceeds (no STOP).**
