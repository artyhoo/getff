# S5 — zcode probe, F3 — STAGE REPORT

- **Branch:** `worktree-lpt-s5` (from `origin/staging` `3d2fbdf2a`)
- **Date:** 2026-07-11 (probing wall-clock ~09:53→10:12, well inside the half-day hard timebox)
- **Status:** DONE — both claimed zcode cells backed by a committed, re-runnable probe; `axis` field added; all consumers green.

## S.0 premise re-verification

Kickoff §0 baseline: *"`rule-channel-capabilities.json` zcode cell still hand-declared."* — CONFIRMED still true on fresh `origin/staging` `3d2fbdf2a`. The two `true` zcode cells (`sessionStartHook`, `postToolUseInject`) carried NO probe backing; the `axis` field did not exist. No prior S5 probe artifacts existed (`.claude/orchestrator-prompts/launch-preannounce-track/` held only `kickoff.md`). T-LPT-B check clean: nothing already-fixed to skip.

zcode located per kickoff instructions (no binary on PATH): CLI entry = `/Applications/ZCode.app/Contents/Resources/glm/zcode.cjs` (Node CJS bundle, `entry` per `.node-bundle-meta.json`), runs under plain `node` for the `doctor`/`plugins`/`skills`/`-p` subcommands (the full TUI needs Electron-only `@zcode/tui`). Version **0.15.0**.

## What landed

1. `.ai-factory/rule-channel-capabilities.json` — added `axis` to all three harness rows: `zcode → operator`, `cc → shipped`, `cursor → shipped`. zcode `true` cells KEPT (probe-backed, below).
2. `.ai-factory/rule-channel-capabilities.schema.json` — `axis` added as a required `enum ["operator","shipped"]` field (required, so a future row cannot silently omit its axis — the project's own "make omission fail" discipline); description extended.
3. `tests/agnosticism/harness-self.test.sh` — inline `seeded-broken` fixture given `"axis": "shipped"` to satisfy the now-required field (validated against the real schema by the probe it drives).
4. `.claude/orchestrator-prompts/launch-preannounce-track/s5-probes/` — `probe-zcode-hooks.sh` (re-runnable, exit 0 = 7/7), `probe-output.txt` (verbatim run), `bundle-runtime-evidence.txt` (verbatim runtime snippets), `README.md`.

## Probe results — RED→GREEN per assert

The two claimed cells are **capability-existence** questions (schema wording: sessionStartHook = "does a session-start hook event exist?"; postToolUseInject = "can a hook inject additionalContext after a tool call?"). Probed via the REAL zcode CLI's own Zod validation verdict (logged to `~/.zcode/cli/log/zcode-<date>.jsonl`) + runtime bundle inspection.

| Assert | RED arm (observed) | GREEN arm (observed) |
|---|---|---|
| SessionStart + PostToolUse are recognized hook primitives | Probe C: bogus event `NotARealEvent` under `events:` → `config.file.invalid — hooks.events: Unrecognized key: "NotARealEvent"` (strict vocabulary, so acceptance is meaningful) | Probe B: `{hooks:{events:{SessionStart:[…],PostToolUse:[…]}}}` → ACCEPTED, no `config.file.invalid` |
| Delivery-drift is real (shim shape rejected) | Probe A: framework shim's FLAT `{hooks:{SessionStart:[…]}}` → `config.file.invalid — hooks: Unrecognized keys: "SessionStart", "PostToolUse"` | Probe B (correct `events:` wrapper) accepted — proves the rejection is a shape bug, not a missing capability |
| PostToolUse can inject additionalContext (runtime) | (source-existence, no RED arm) | Bundle switch `case qr.PostToolUse:…:t.additionalContext&&e.additionalContexts.push(...)` — PostToolUse IS in the injection set |
| SessionStart hook runs + injects (runtime) | (source-existence, no RED arm) | `runSessionStartHooks("startup",…)` then `injectHookAdditionalContextIntoMessageHistory(qr.SessionStart,…)` |

Probe run: `PASS=7 FAIL=0`, exit 0 (`probe-output.txt`). Reproduced live twice this session (first run exposed a `//` grep-path bug from a trailing-slash `$TMPDIR`, fixed to match on the run-unique mktemp basename — the probe is now robust to `/var` vs `/private/var` and slash-form differences).

**Verdict:** both cells kept `supported` / `true`, honestly, now probe-backed. `axis: operator` scopes them to the operator machine. Done-bar met: **zero zcode cells whose value is not backed** — the two `true` cells by the committed probe; the three `false` cells are absence markers consistent with #897's bundle findings (zcode reads `AGENTS.md`, not `.claude/`; no native `paths:`/rulesAutoload/claudeMdExcludes primitive — the degradation manifest already routes those rules to the SessionStart / edit-time-inject fallbacks).

## Honest boundary (not probed)

End-to-end **firing** (hook script executes + additionalContext actually reaches the model) needs a headless model turn; zcode refuses it without an operator model-provider config / OAuth (`Error: Model config is missing`), which is credential state the probe must not create. Config-schema acceptance (live zcode Zod) + runtime code-path is the honest autonomous ceiling. Corroboration from live operator runs: every real session 2026-07-04…07-08 logged `hookCount:0` because the shim's flat `zcode.json` was rejected — the same finding probe A reproduces.

## Systemic observation (OUT OF S5 SCOPE — surfaced, not fixed)

**The #897 operator-axis shim (`scripts/render-harness-config.mjs`, `emitZcode`) is currently broken against the installed zcode 0.15.0.** It emits the FLAT hooks shape `{hooks:{<Event>:[…]}}`, but zcode 0.15.0's config schema now requires the event map nested under an `events:` key (`hooks:{ enabled?, timeoutMs?, maxOutputBytes?, events:{…}.strict() }` — schema `pWo` in the bundle). Result: the operator's generated `zcode.json` fails to load (`config.file.invalid`, error severity) on every session 2026-07-04…07-08 → `hookCount:0` → the framework's edit-time hooks never fire in the operator's own zcode. This is schema drift between the 2026-07-03 bundle #897 was built against and 0.15.0.

The drift gate `packages/core/hooks/harness-config-drift.test.ts` did NOT catch it because it checks the shim's output against the shim's OWN model, never against zcode's actual acceptance — a "green ≠ functional off-CC" gap of exactly the class #894 set out to close, recurred one schema-version later. **Recommended follow-up (separate task, #894/#897 surface):** update `emitZcode` to wrap the event map under `events:` and add a probe like this stage's to the drift gate so acceptance is verified against the real binary when present. Per CLAUDE.md PR strategy + night-mode discipline, this is logged as an observation only — no drive-by fix in S5.

## Consumer gates (all green after the `axis` schema change)

- `scripts/render-rule-channels.mjs --check` → `✓ 32 verdicts computed, 0 undeclared refusals, manifest current`
- `render-rule-channels.mjs --json` → 32 rows (readability-probe consumer) OK
- `packages/core/hooks/rule-channel-degradation.test.ts` → 3/3 pass
- `tests/agnosticism/harness-self.test.sh` → `PASS=10 FAIL=0`

## Deviations

None material. `axis` made **required** (not optional) — a technical-decided fork: required enforces the anti-conflation intent structurally (a new row omitting axis fails schema validation) at the cost of one extra line in the `harness-self.test.sh` fixture. Reversible (drop from `required` if a future row legitimately cannot state an axis).
