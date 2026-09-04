# S5 zcode capability probes — launch-preannounce-track

Executable probes backing the two CLAIMED (`true`) zcode cells of
`.ai-factory/rule-channel-capabilities.json`, plus the evidence for the `axis` field added in
the same PR. Run on the operator's Mac (zcode 0.15.0 installed at `/Applications/ZCode.app`).

## Files

| File | What it is |
|---|---|
| `probe-zcode-hooks.sh` | The re-runnable probe. Exit 0 = all 7 assertions hold. |
| `probe-output.txt` | Verbatim recorded output of the probe run (2026-07-11). |
| `bundle-runtime-evidence.txt` | Verbatim runtime code-path snippets extracted from the zcode bundle. |

## What is probed

`sessionStartHook: true` — schema definition: *"does a session-start hook event exist?"*
`postToolUseInject: true` — schema definition: *"can a hook inject additionalContext after a tool call?"*

Both are **capability-existence** questions about the harness, not delivery-success questions.

### Probe 1 — config-schema acceptance (live zcode Zod validation)

Feeds the REAL installed `zcode` CLI a project `zcode.json` and reads its own structured
validation verdict from `~/.zcode/cli/log/zcode-<date>.jsonl`. Three cells, paired:

- **A (framework shim's current FLAT shape** `{hooks:{SessionStart:[…]}}`**)** → REJECTED
  (`config.file.invalid — hooks: Unrecognized keys: "SessionStart", "PostToolUse"`). This is the
  delivery-drift RED (see the stage report observation — the #897 shim emits a shape zcode
  0.15.0 no longer accepts).
- **B (accepted shape** `{hooks:{events:{SessionStart:[…],PostToolUse:[…]}}}`**)** → ACCEPTED
  (no `config.file.invalid`). Proves `SessionStart` and `PostToolUse` are recognized hook
  primitives in zcode 0.15.0.
- **C (paired negative — bogus event `NotARealEvent` under `events:`)** → REJECTED
  (`hooks.events: Unrecognized key: "NotARealEvent"`). Proves the acceptance in B is a strict
  vocabulary, not permissiveness.

`plugins list --cwd <dir>` triggers project-config bootstrap + validation and needs **no**
model provider (unlike `-p`/TUI).

### Probe 2 — runtime code-path existence (bundle inspection)

`runSessionStartHooks` and `runPostToolUseHooks` exist; the additionalContext-collection switch
pushes hook output for **both** `qr.SessionStart` **and** `qr.PostToolUse`
(`case qr.PostToolUse:case qr.PostToolUseFailure:…:t.additionalContext&&e.additionalContexts.push(...)`).
Verbatim snippets in `bundle-runtime-evidence.txt`.

## Honest boundary (not probed)

**End-to-end firing** (hook script actually executes + its additionalContext reaches the model)
requires a headless model turn, which zcode refuses without an operator model-provider config /
OAuth (`Error: Model config is missing`). Setting that up is operator-credential state the probe
must not touch. Config-schema acceptance + runtime code-path is the honest **autonomous ceiling**.
The historical operator logs (`hookCount:0` on every real session 2026-07-04…07-08, because the
shim's flat `zcode.json` was rejected) corroborate probe 1 from live runs.

## Axis

Per S5, each harness row now carries `axis: operator | shipped` so operator-env capability is
never conflated with shipped-consumer delivery:

- **zcode → `operator`** — the maintainer's daily-driver harness; the #897 shim is operator-axis
  only (consumer-facing per-harness emission is a PARKED fork, #894 §7). These cells are proven
  on the operator machine, NOT delivered to any consumer.
- **cc → `shipped`** — the primary consumer target (install.sh delivers `.claude/` config).
- **cursor → `shipped`** — `support: reference`; a future consumer harness, not yet delivered.
