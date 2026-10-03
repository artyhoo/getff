---
title: inject-output-language hook
description: Pin the language you want to be addressed in, and this tiny hook reminds the agent of it once per session — while your repo's artifacts stay English whatever you pick.
kind: reference-sheet
generator: scripts/render-reference.mjs
sources:
  - .claude/hooks/inject-output-language.sh
  - .claude/hooks/inject-session-bootstrap.sh
  - .claude/rules/language-discipline.md
  - .claude/settings.json
  - docs/site/reference/D.json
  - docs/site/reference/D.md
  - docs/site/terms.md
  - plugin/.claude-plugin/plugin.json
  - plugin/hooks/hooks.json
  - plugin/hooks/inject-output-language
  - plugin/hooks/lib/live-claim.sh
  - plugin/hooks/lib/source-hash.sh
  - plugin/hooks/lib/source-sha256.txt
  - plugin/hooks/run-hook.cmd
  - scripts/plugin-source-hashes.sh
  - setup.d/10-skills.sh
  - tests/plugin/run-hook.test.sh
executed:
  - { example: output-language-unset-english-default, stack: repo, date: 2026-09-29, result: silent }
  - { example: output-language-pinned-to-russian, stack: repo, date: 2026-09-29, result: printed }
docs-refresh: deferred — re-verified 2026-09-29 on merge train C5; inject-session-bootstrap.sh only gained the compact-only skill-index block after its autonomy block, leaving the output-language case block the page cites unchanged, and plugin.json moved to a version the page never names; clears at the next refresh of this page
---

# inject-output-language hook

## Fact card

What each row means: [how to read a fact card](../D.md#how-to-read-a-fact-card).

<!-- vale off -->
<!-- vale-reason: the card quotes the hook's own header line and registration JSON verbatim -->

<!-- getff:begin section=D-card-inject-output-language plan=scripts/render-reference.mjs -->
| Field | Value |
|---|---|
| name | `inject-output-language` |
| kind | hook |
| ships-to | framework: react-native, react-next, react-spa, ts-server |
| description | SessionStart hook — injects the active output-language line into session context |
| source | `.claude/hooks/inject-output-language.sh:2` |
| event | `["SessionStart"]` |
| matcher | `["startup|resume|clear|compact"]` |
| delivery | `["@cc-only-rationale","plugin"]` |
<!-- getff:end section=D-card-inject-output-language -->

<!-- vale on -->

## Explanation

You want to talk to your agent in your language. You do not want your repository
translated — comments, commit messages, and specs in a mixed language rot quickly. This
hook holds that line. When a session starts — and again after `/clear`, a resume, or a
compaction — it reminds the agent which language to address you in and which language
everything written into the repo must stay in. Once per context is enough: the line
stays in context, and repeating it on every prompt only cost tokens.

You control it with one environment variable, `AIF_HOOK_LANG`. With nothing set — or set
to `en` — the hook does nothing at all. English is the zero-setup default, and a no-op
hook costs you nothing:

```bash
printf '%s' '{"prompt":"hi"}' | bash .claude/hooks/inject-output-language.sh
```

```text
(nothing — exit 0)
```

Set it to `ru` and the session carries the same one-line instruction:

```bash
printf '%s' '{"prompt":"hi"}' | AIF_HOOK_LANG=ru bash .claude/hooks/inject-output-language.sh
```

```text
[output-language] Address the operator in Russian — chat explanations, recaps, narration, questions. Keep ALL repo artifacts and machinery in English: code, comments, commit/PR/issue bodies, kickoffs, specs, tool arguments, file contents. (AIF_HOOK_LANG=ru)
```

Any other value gets the same treatment with your language named, so a new locale needs
no code change. Setting it is ordinary shell configuration — export it in your profile,
or pin it for Claude Code in the `env` block of your `.claude/settings.json`, exactly as
the hook's own header suggests.

Two things it pointedly does not do:

- **It never reads your prompt.** The language logic looks only at the environment
  variable. The one read of standard input takes the session id, to mark that this copy
  ran. Same reminder every time, no parsing, nothing to go wrong.
- **It is an instruction, not a [gate](../../terms.md#gate).** The reminder travels to
  the model on the ordinary injected-context [channel](../../terms.md#channel); whether
  the reply comes out in your language is still the model's to deliver. That is the
  honest shape of the mechanism, and the hook's header says so: it injects «an
  instruction to the model, not a translation of anything».

Where this hook fits in the family: it was extracted from the framework's own
`inject-session-bootstrap` digest so consumer projects could get just the language line
without the framework-internal goal-and-invariants text around it. Consumers can get it
two ways. The installer copies it into `.claude/hooks/` and registers it in the
project's `.claude/settings.json`, and the plugin ships a copy of its own. The
framework's own repository registers neither. Its bootstrap digest embeds the same line
instead.

With both in place you usually see the line once, not twice. The plugin's copy has two ways
to go silent.

In getff's own source repository, the plugin's launcher finds `inject-session-bootstrap`
registered in `.claude/settings.json`. That digest already carries the same line, so the
plugin's copy exits without output.

In any other project — a consumer install — the plugin's copy goes silent only when it can
prove two things about the installed copy:

- **Same bytes.** The installed `.claude/hooks/inject-output-language.sh`, and every file it
  names on its `@plugin-yield-deps` marker, hash to the manifest the plugin ships
  (`plugin/hooks/lib/source-sha256.txt`, written by `scripts/plugin-source-hashes.sh`).
- **Actually running.** The installed copy's prelude left a fresh `live` marker for this same
  event. `.claude/hooks/lib/hook-live.sh` writes it and `plugin/hooks/lib/live-claim.sh`
  claims it. The marker must appear within about 300 ms, be under 5 seconds old, and come
  from the same session and a trusted directory. The project's registration must also be the
  installer's plain form, with no extra field such as a custom timeout.

Any doubt, and the plugin's copy runs. An edited file, a missing marker, a session that moved
into a subdirectory or worktree, or a stale or foreign marker all count as doubt. You then see
the line twice, which is better than losing it. The full list of conditions is the comment
above the yield in `plugin/hooks/run-hook.cmd`. On ZCode, or with `GETFF_PLUGIN_NO_YIELD=1`
set, the plugin's copy always runs.

## Evidence

- `.claude/hooks/inject-output-language.sh:2` is the header line the card's description row
  quotes: `# inject-output-language.sh — SessionStart hook — injects the active output-language line into session context`.
- Zero-setup default: line 32 opens `case "${AIF_HOOK_LANG:-en}" in` and line 33 is
  `en|'') : ;;  # English default — nothing to inject`. Header line 17 states it:
  «Unset / "en" → nothing is injected (English is the zero-setup default)».
- The Russian line is the heredoc body at line 36; any other value falls to the printf
  at line 40, `printf '[output-language] Address the operator in language "%s"; keep
  repo artifacts and machinery in English. (AIF_HOOK_LANG=%s)\n' …`.
- Setup guidance is header lines 15-16: «export AIF_HOOK_LANG in your shell, or add an
  `env` block to .claude/settings.json».
- The language logic reads no input: the case at line 32 is the whole of it. The one
  read of stdin is the D12 prelude at lines 25-29, which loads
  `.claude/hooks/lib/hook-live.sh` and takes only `session_id` from the payload, to leave
  the marker the plugin copy looks for.
- Instruction-not-translation: header line 12 — «this injects an instruction to the
  model, not a translation of anything. See .claude/rules/language-discipline.md §2».
- Extraction lineage: header lines 5-7 — «the consumer-generic slice EXTRACTED from the
  maintainer-only inject-session-bootstrap.sh — it emits ONLY the language signal (never
  the framework-self-referential goal/invariants digest, which stays INTERNAL)». The
  framework-side copy of the same line lives at
  `.claude/hooks/inject-session-bootstrap.sh:120-128`.
- Registration: `plugin/hooks/hooks.json:188` runs
  `"${CLAUDE_PLUGIN_ROOT}/hooks/run-hook.cmd" inject-output-language` under
  SessionStart with the matcher `startup|resume|clear|compact`; an install registers the
  same in the consumer's settings (`setup.d/10-skills.sh:346-347`), first removing the
  per-prompt registration an older install left behind. The framework's own settings file
  has neither (measured:
  `grep -c inject-output-language .claude/settings.json` prints `0`).
- The twin is hand-maintained: line 31 of the source reads `# @plugin-transform: manual`,
  and `plugin/hooks/inject-output-language` line 2 opens «Plugin twin of
  .claude/hooks/inject-output-language.sh», with its TWIN DIVERGENCE block (lines 10-16)
  naming the extensionless filename and the inline zcode adapter as the two deltas.
- Silent in two modes, not one: the plugin file's line 2 names its source
  (`# Plugin twin of .claude/hooks/inject-output-language.sh.`), and source line 19
  declares `# @plugin-yields-to: inject-session-bootstrap`. **Source mode**
  (`plugin/hooks/run-hook.cmd:218`, `[ "$_yield_mode" = source ] && exit 0`): the project is
  the plugin's own source checkout — it ships `plugin/.claude-plugin/plugin.json` under the
  same plugin name as `plugin/hooks/inject-output-language`, and its `.claude/settings.json`
  runs getff's copy of the named hook in the installer's exact form, on every event and
  matcher the plugin registers. **Consumer mode** (`plugin/hooks/run-hook.cmd:226`, inside
  `if [ -r ".../lib/live-claim.sh" ] … && getff_live_claim …; then exit 0; fi`) covers any
  other project. `run-hook.cmd:162` sets `_yield_mode=consumer` when the installed
  `.claude/hooks/inject-output-language.sh` and every file its `@plugin-yield-deps` marker
  names pass `getff_closure_matches` (`plugin/hooks/lib/source-hash.sh`). That check hashes
  them against `plugin/hooks/lib/source-sha256.txt`, which `scripts/plugin-source-hashes.sh`
  writes. Hash equality alone still runs the plugin copy. The installed copy's prelude
  (`.claude/hooks/lib/hook-live.sh`) writes a marker for this same event. The yield fires only
  after `getff_live_claim` (`plugin/hooks/lib/live-claim.sh`) claims that marker fresh. The
  plugin copy keeps running if no marker appears within roughly 300 ms or the marker is over
  5 seconds old. A different session, an `untrusted` directory or a lost race does the same.
  Both modes share one more gate: the `cwd` in the hook's input must resolve to the project
  root itself (`run-hook.cmd:211-218`). After EnterWorktree or `/cd`, Claude Code takes
  project settings from the new directory, while `CLAUDE_PROJECT_DIR` stays at the start
  root. A `cd` in Bash moves `cwd` too, so a subdirectory `cwd` cannot tell the two apart.
  Either way the plugin copy runs.
  `tests/plugin/run-hook.test.sh` pins these conditions. Arms Y1-Y28 cover the registration
  and `cwd` checks common to both modes. Y19 is the source-checkout case, and Y26 covers a
  session that left the project root. Y27 and Y28 check that a running copy gets its whole
  input and keeps its exit code. The `C` arms (`C1`-`C11`) pin the consumer hash path:
  C1 is the byte-identical yield, and the others flip one input, such as an edited file or a
  corrupt hash lib, back to "runs". The `D` arms pin the proof that the installed copy ran: a missing, stale or
  foreign marker, a custom timeout or any extra registration field, and a lost race all
  leave the plugin copy running. R1 asserts the silence against this repo's settings, and R2
  counts one language line per
  session start. R3 asserts the digest line equals this hook's line
  for `ru` and `de`.
- No test under `packages/core/hooks/` carries this hook's name, and this page states
  that rather than implying coverage. The demos above and the
  `tests/plugin/run-hook.test.sh` arms in the previous bullet pin its output.
