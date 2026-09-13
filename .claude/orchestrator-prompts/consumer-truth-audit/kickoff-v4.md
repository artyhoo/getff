# consumer-truth-audit V4 — platform reach (Windows)

> **Umbrella:** [kickoff.md](kickoff.md) — §0 verdict classes and §7 evidence discipline bind.
> **Rigor label (effort-worthiness L0):** `research-grade`.
> **Bench:** the operator's Windows PC with WSL Ubuntu-24.04 (`pcx`, `ssh pc`). This is the only
> real bench; reasoning about bash portability is NOT a substitute and will be rejected.

## §0 Goal

Answer two questions that are currently unmeasured, and keep them separate:

1. **Does it run?** Does a consumer on Windows get a working install — under WSL, and under
   Git Bash / MSYS as a distinct case?
2. **Do we claim it does?** Does any shipped document, the site, or the package metadata
   promise Windows support?

The pairing is the point. Claim without capability is `DOC-LIES`; capability without claim is a
missed opportunity and a low-severity finding; claim **and** no capability on a surface a
consumer installs from is the highest-severity outcome this umbrella can produce.

## §1 Surface

The machinery is bash end to end: `install.sh`, every `setup.d/*.sh`, `.husky/*`, the shipped
`.claude/hooks/*.sh`, and the lane scripts. `packages/getff/package.json` declares
`engines.node >= 22`. Each of those is a portability question with a different answer, and the
report keeps them apart:

| Question | Distinct because |
|---|---|
| WSL | a real Linux kernel — closest to CI; likely to pass |
| Git Bash / MSYS | path translation, `/c/...` vs `C:\`, no `mktemp -d` semantics parity, CRLF |
| PowerShell / cmd | almost certainly unsupported — say so explicitly rather than leaving it open |
| Node version gate | `engines` is advisory unless something enforces it — check what does |
| line endings | a delivered script with CRLF fails with an opaque error; check what git attributes ship |

## §2 Method

1. Run the real install on the WSL bench, all three profiles, into fresh directories. Capture
   full logs and exit codes. **Do not use `cmd | tail`** — it returns `tail`'s status; write
   `cmd > log 2>&1; echo "EXIT=$?" >> log` and check the recorded code.
2. Repeat under Git Bash if available on that machine; if not, report `PROBE-INCOMPLETE` for
   that row with the reason — do not infer it from WSL's result.
3. Exercise a delivered lane end to end on the bench (plant a violation, confirm the gate
   catches it), so «installed» is not mistaken for «works».
4. Enumerate every Windows/platform claim across `README.md`, `INSTALL-FOR-AI.md`, the docs site
   content, and `packages/getff/package.json` (`os`, `cpu`, `engines`). Decide each against 1-3.

## §3 The gate — run it, quote command + output (T2/T3)

| # | Gate |
|---|---|
| 1 | three profile installs run on the real WSL bench, exit codes recorded per the §2.1 idiom |
| 2 | Git Bash row either measured or explicitly `PROBE-INCOMPLETE` with a reason |
| 3 | at least one delivered lane exercised end to end on the bench |
| 4 | every platform claim enumerated with `file:line` and decided |
| 5 | line-ending handling checked, not assumed |
| 6 | no row concluded from bash-portability reasoning alone |
| 7 | self-falsification section present and non-trivial |

## §4 Deliverable

`report-v4.md`: §what-runs (per environment, with logs), §what-we-claim (enumerated, decided),
§findings, §recommendation — one paragraph the operator can act on stating what the beta can
honestly say about Windows. Do not edit any document.

## AI traps ([.claude/rules/ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md))

Active traps: **T2**, **T3**, **T5**, **T12**, **T14**.

- **T2** — reading `install.sh` and judging it portable is the failure mode of this entire lane.
- **T3** — the evidence is a log from the bench.
- **T5** — this is a measurement lane. If you open an editor on a source file to «just fix the
  shebang», stop; it goes in the report.
- **T12** — do not answer WSL/Git Bash behaviour from training-data memory; the bench is right there.
- **T14** — «WSL passed» is not «Windows works»; state coverage per environment.

## Host-verify contract

<!-- host-verify: none — this lane's destination environment is neither this container nor this Mac: it is the operator's Windows machine with WSL Ubuntu-24.04. A command run here would assert macOS behaviour and prove nothing about the environment under test. Acceptance is the captured bench log with its recorded exit code, quoted in the report per §2.1. -->
