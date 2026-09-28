---
title: inject-output-language hook
description: Pin the language you want to be addressed in, and this tiny hook reminds the agent of it on every single turn — while your repo's artifacts stay English whatever you pick.
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
  - plugin/hooks/hooks.json
  - plugin/hooks/inject-output-language
  - plugin/hooks/run-hook.cmd
  - setup.d/10-skills.sh
  - tests/plugin/run-hook.test.sh
executed:
  - { example: output-language-unset-english-default, stack: repo, date: 2026-09-28, result: silent }
  - { example: output-language-pinned-to-russian, stack: repo, date: 2026-09-28, result: printed }
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
| description | UserPromptSubmit hook — injects the active output-language line into prompt context |
| source | `.claude/hooks/inject-output-language.sh:2` |
| event | `["UserPromptSubmit"]` |
| matcher | `[]` |
| delivery | `["@cc-only-rationale","plugin"]` |
<!-- getff:end section=D-card-inject-output-language -->

<!-- vale on -->

## Explanation

You want to talk to your agent in your language. You do not want your repository
translated — comments, commit messages, and specs in a mixed language rot quickly. This
hook holds that line. On every prompt you submit, it reminds the agent which language to
address you in and which language everything written into the repo must stay in.

You control it with one environment variable, `AIF_HOOK_LANG`. With nothing set — or set
to `en` — the hook does nothing at all. English is the zero-setup default, and a no-op
hook costs you nothing:

```bash
printf '%s' '{"prompt":"hi"}' | bash .claude/hooks/inject-output-language.sh
```

```text
(nothing — exit 0)
```

Set it to `ru` and every turn carries the same one-line instruction:

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

- **It never reads your prompt.** The hook ignores its standard input entirely; the only
  thing it looks at is the environment variable. Same reminder every turn, no parsing,
  nothing to go wrong.
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

With both in place, the plugin's copy stays silent and you see the line once. The
plugin's launcher checks three things first. The session is Claude Code, `jq` is on the
hook's `PATH`, and the project's `.claude/settings.json` registers its own copy on the
same event. The framework's repository gets the same treatment: the launcher finds
`inject-session-bootstrap` registered there, and that digest carries the same line. On
ZCode, or with `GETFF_PLUGIN_NO_YIELD=1` set, the plugin's copy always runs.

## Evidence

- `.claude/hooks/inject-output-language.sh:2` is the header the card's description row
  quotes: `# inject-output-language.sh — UserPromptSubmit hook — injects the active output-language line into prompt context`.
- Zero-setup default: line 26 opens `case "${AIF_HOOK_LANG:-en}" in` and line 27 is
  `en|'') : ;;  # English default — nothing to inject`. Header line 17 states it:
  «Unset / "en" → nothing is injected (English is the zero-setup default)».
- The Russian line is the heredoc body at line 30; any other value falls to the printf
  at line 34, `printf '[output-language] Address the operator in language "%s"; keep
  repo artifacts and machinery in English. (AIF_HOOK_LANG=%s)\n' …`.
- Setup guidance is header lines 15-16: «export AIF_HOOK_LANG in your shell, or add an
  `env` block to .claude/settings.json».
- No input is ever read: the script (lines 23-36) contains no `cat` of stdin — the case
  at line 26 is the whole logic.
- Instruction-not-translation: header line 12 — «this injects an instruction to the
  model, not a translation of anything. See .claude/rules/language-discipline.md §2».
- Extraction lineage: header lines 5-7 — «the consumer-generic slice EXTRACTED from the
  maintainer-only inject-session-bootstrap.sh — it emits ONLY the language signal (never
  the framework-self-referential goal/invariants digest, which stays INTERNAL)». The
  framework-side copy of the same line lives at
  `.claude/hooks/inject-session-bootstrap.sh:120-128`.
- Two registrations reach consumers: `plugin/hooks/hooks.json:16` runs
  `"${CLAUDE_PLUGIN_ROOT}/hooks/run-hook.cmd" inject-output-language` under
  UserPromptSubmit, and `setup.d/10-skills.sh:366` registers the project copy with
  `register_cc_hook "$SETTINGS" "UserPromptSubmit" … "inject-output-language"`. The
  framework's own settings file has neither (measured:
  `grep -c inject-output-language .claude/settings.json` prints `0`).
- The twin is hand-maintained: line 25 of the source reads `# @plugin-transform: manual`,
  and `plugin/hooks/inject-output-language` line 2 opens «Plugin twin of
  .claude/hooks/inject-output-language.sh», with its TWIN DIVERGENCE block (lines 10-16)
  naming the extensionless filename and the inline zcode adapter as the two deltas.
- Silent beside a project copy: the plugin file's line 2 names its source
  (`# Plugin twin of .claude/hooks/inject-output-language.sh.`), and source line 19
  declares `# @plugin-yields-to: inject-session-bootstrap`. The yield block at
  `plugin/hooks/run-hook.cmd:70` exits before the plugin copy runs. It does so only when
  the project's `.claude/settings.json` runs getff's copy of a named hook on every event
  and matcher the plugin registers. `tests/plugin/run-hook.test.sh` arms Y1-Y18 pin each
  condition. R1 asserts the silence against this repo's settings, and R2 counts one
  language line per prompt. R3 asserts the digest line equals this hook's line for `ru`
  and `de`.
- No test under `packages/core/hooks/` carries this hook's name, and this page states
  that rather than implying coverage. The demos above and the
  `tests/plugin/run-hook.test.sh` arms in the previous bullet pin its output.
