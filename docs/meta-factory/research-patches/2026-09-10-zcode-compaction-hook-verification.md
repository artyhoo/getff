<!-- scope:zcode-compaction-hook-verification -->
<!-- Binary-level verification prompted by the operator report «z.code тоже теперь компакт
     работает» — does ZCode compaction make the handoff-currency pipe (doctrine rows 21/22)
     reachable? Answer: no. Compaction shipped as a turn-kind, but it exposes no hook-lifecycle
     surface, and the bundled zcode-guide doc claims a SessionStart match value the runtime
     never dispatches. Recorded here so the doctrine cites probes, not the vendor doc. -->

# ZCode compaction vs the handoff pipe — binary-level verification

> **Authoritative for:** the 2026-09-10 verification evidence behind [zcode-parity-doctrine.md](../../../.claude/rules/zcode-parity-doctrine.md) §2 rows 21–22 rationale refresh: what the installed ZCode build's compaction actually exposes to hooks, and why the vendor doc's `source=compact` claim must not be trusted over the binary.
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists). Hook census classifications — the doctrine §2 table is the SSOT. The handoff-currency design itself — see [the D20 spec](../superpowers/specs/2026-09-08-handoff-currency-gate-design.md).

## §1 Scope and method

Subject: the installed ZCode build actually running this machine's sessions —
`/Applications/ZCode.app/Contents/Resources/glm/zcode.cjs` (12.6 MB runtime bundle, mtime
2026-09-04) plus `app.asar` (307 MB, same build). Confirmed live as the running binary via the
renderer process args (`--app-path=/Applications/ZCode.app/Contents/Resources/app.asar`).
Method: string/minified-code probes (`grep -a -o -E`) over both bundles, cross-checked against
the vendor's own bundled skill doc, live logs, and hook artifacts. Doc claims were NOT taken as
evidence — that inversion is the finding of §4.

## §2 Compaction the feature exists

`zcode.cjs` carries compaction as a first-class turn kind, not a session restart:

- schema: `f.object({type:f.literal("compact"),origin:f.enum(["manual","auto"]),status:f.enum(["running","success","failed","noop","cancelled"]),tokensBefore:…,tokensAfter:…,summaryRef:…})`
- turn kind enum: `["regular","compact","rewind"]`; queue-input kind `["sendText","sendGoalCommand","compact"]`
- slash command: `/compact [instructions]` — «Runs the core manual compaction path and forwards optional summary instructions»

## §3 The hook surface it exposes: none

1. **PreCompact does not exist.** `grep -ac PreCompact zcode.cjs` → 0; same for `app.asar`
   (the only `PreCompact` hits under `Resources/` are inside the zcode-guide plugin's own
   SKILL.md prose saying it is unsupported). The seven-event enum
   `["SessionStart","UserPromptSubmit","PreToolUse","PermissionRequest","PostToolUse","PostToolUseFailure","Stop"]`
   is hard-coded in the runtime. → The residue writer (`.claude/hooks/precompact-residue.sh`)
   has no event to ride. Doctrine row 21 premise «no compaction-lifecycle event» still holds;
   only «ZCode has no compaction» (the feature) is now false.

2. **SessionStart never fires with `source=compact`.** Exactly one dispatch site exists:
   `a(T7r,"runSessionStartHooks")` → `this.hookRunner.run({…hookEventName:on.SessionStart,…source:e,…},{matchValue:e,…})`.
   Its complete call set (textual sweep of both bundles; `runSessionStartHooks` count in
   `app.asar` → 0):
   - `this.runSessionStartHooks("startup",u,_)` — fresh session
   - `this.runSessionStartHooks("resume",t,e?.abortSignal)` — resumed session

   No `"compact"`, no `"clear"` call site. → The reader (`.claude/hooks/inject-handoff-on-compact.sh`)
   would never fire even if twinned into `plugin/hooks/`; the plugin `session-start` matcher
   `startup|clear|compact` currently matches only on `startup`.

3. **The Stop-hook gate cannot compute either.** `transcript_path` is synthesized per
   invocation: the runtime `mkdtemp`s a `zcode-claude-hook-*` dir and writes `transcript.jsonl`
   via `Rni(e)`, which emits ONE line — `{message:{content:[{text:<preview>],type:"text"},role}}`
   for Stop (response preview) / UserPromptSubmit (prompt). No `.message.usage` field is ever
   present, by construction → the D7 context-arm and D13 handoff-currency gate in
   `end-of-turn-reminder.sh` (both nested under a usage-bearing `ctx_entry`) are structurally
   inert on ZCode — confirming doctrine row 9's note extends from synthetic test fixtures to
   the real runtime. The real usage data exists only in rollout files
   (`~/.zcode/cli/rollout/model-io-sess_*.jsonl`) under a different shape
   (`response.providerMetadata.anthropic.usage.input_tokens`), which no arm parses today.

## §4 The vendor doc is ahead of its own runtime

The zcode-guide skill bundled IN THIS BUILD (`Resources/glm/packages/zcode-guide-plugin/skills/diagnosing-hooks/SKILL.md`,
byte-identical to the cached `~/.zcode/cli/plugins/cache/.../0.1.0` copy) states:

> `SessionStart` → one of `startup`, `resume`, `clear`, `compact`

The binary contradicts it (§3.2). A matcher value is inert without a dispatch site. This is a
live instance of the repo's thesis — documents lie, binaries don't — and it sets the evidence
rule for the revisit conditions: **verify hook capability in the installed runtime, never in
the vendor doc.**

## §5 Live corroboration (2026-09-10)

- No ZCode session on this machine has compacted yet: `grep -l compact ~/.zcode/v2/logs/*.log`
  and `~/.zcode/cli/log/*.jsonl` → no matches (both journal families).
- All `_residue-*.md` / `_handoff-*.md` under `.claude/orchestrator-prompts/` carry
  PreCompact-writer provenance (CC sessions); none originate from ZCode.
- The dynamic-context half survives without SessionStart:compact — `inject-session-bootstrap`
  rides `UserPromptSubmit` (every turn), observed re-injecting live in the verifying session.
  Compaction or not, the next prompt re-injects the bootstrap digest. What does NOT survive:
  the file-based handoff (writer → gate → reader), per §3.

## §6 Verdict and revisit conditions

Rows 21/22 stay `cc-only`; classifications and the §2 rollup are untouched. What changes is the
premise freshness and the precision of the revisit triggers:

- Row 21 (writer): revisit when a `PreCompact`-class event appears in the runtime enum
  (`grep -ac PreCompact zcode.cjs` > 0), not when «ZCode ships compaction» — it already did.
- Row 22 (reader): revisit when a `source=compact` dispatch site appears
  (`runSessionStartHooks("compact"` or equivalent) — and the writer-side event is the
  prerequisite, or the reader still reads a file nothing writes. The doc listing `compact` as
  a match value is not evidence of either.

Falsifier for this whole patch: a ZCode build newer than 2026-09-04 wiring the missing
dispatch (§3.2) or enum entry (§3.1) — re-run the §3 probes before relying on the verdict.

## §7 §1.7 self-review

**Forward-check (research-only):** the verdict above follows recommendation discipline — every
claim carries its probe command + observed output (§2–§3), the negative-existence claims
(«no PreCompact», «no source=compact dispatch») are backed by an exhaustive multi-surface
sweep (runtime bundle, app.asar, asar.unpacked, glm packages, both journal families, live
hook artifacts — §3, §5), and an explicit falsifier is stated (§6, build-drift clause). The
vendor doc was treated as a claim to verify, not a source — §4 records the inversion.

**Backward-check:** the sweep that found every surface carrying a ZCode-compaction premise:
doctrine §2 rows 21–22 + §4 + §5 (STALE — fixed by the PR carrying this patch); hook headers
`.claude/hooks/precompact-residue.sh:2-4` and `inject-handoff-on-compact.sh:4-6` (still
accurate — they claim no compaction-lifecycle *event*, which §3.1 confirms; untouched);
`scripts/render-harness-config.mjs:428` and `scripts/register-precompact-hook.sh:141` (still
accurate; renderer rewording deliberately parked per doctrine §3 D3); specs
`2026-08-09-pipeline-chips-session-bus-design.md:60,439` and D20 (event-level claims that
hold); census + dated research patches (immutable dated records — exempt by convention).
Self-application (T15): the framework's own principle-13 gate caught this patch missing its
§1.7 section on first run — the enforcement layer, not author diligence, closed the loop.
