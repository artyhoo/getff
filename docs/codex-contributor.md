# Codex contributor integration

> **Authoritative for:** Codex contributor setup, host bindings and acceptance status in this framework repository.
> **NOT authoritative for:** project goal — [README](../README.md#why-this-exists); workflow procedures — their canonical skills/agents; consumer delivery — [ships manifest](../setup.d/ships.manifest).

The integration is generated from [.ai-factory/harness-model.json](../.ai-factory/harness-model.json), `.agents/procedures/` and `.agents/roles/`. Change those sources, then run:

```bash
node scripts/render-harness-config.mjs --write --only codex
node scripts/render-harness-config.mjs --check --only codex
node --test scripts/codex-contributor.test.mjs
```

`--only codex` leaves the sealed Claude settings alone. The existing hooks test lane checks generated drift and executes the adapter's canonical-source tests. Generated Codex skills carry their references/helpers as relative links into the source, so a clone retains the dependency graph without a second edited workflow.

## Installation and activation

From this checkout:

```bash
codex plugin marketplace add ./codex-contributor-plugin
codex plugin add getff-contributor@getff-contributor-local
```

Re-run the second command after regenerating hook definitions; the local plugin cache is a snapshot. For a verified trust-review route, launch `codex -C /absolute/path/to/this/checkout` in a terminal. Codex CLI 0.160.0 presents “Hooks need review” at startup when definitions changed; choose “Review hooks” to inspect them or the operator-only “Trust all and continue” to authorize the current definitions. `/hooks` is the CLI hook browser, not a command to send as an ordinary desktop chat message. A plugin enable toggle is separate from hook trust. After confirming, run the contributor doctor again to verify the persisted hashes. Review the plugin's hooks in Codex's hook browser and trust their current definitions, then start a new session in this checkout. Changed hook definitions require review again. Trust is independent of Full Access. Never use `--dangerously-bypass-hook-trust` as project setup.

Why a contributor plugin: Codex 0.160.0 resolves linked-worktree project hooks from the primary checkout's `.codex` folder. Creating `hooks.json` in this worktree alone is ineffective. The plugin carries registration without writing into another checkout. It carries no consumer skills or installer behavior. Hook commands resolve this checkout's source adapter. Use the plugin only for framework contribution; it requires this repository's scripts. Source diagnostics and current native state are recorded in the dated [acceptance record](meta-factory/research-patches/2026-10-05-codex-current-project-acceptance.md) (the 2026-10-04 implementation patch was consumed into the codex worktree archive; that acceptance record is the surviving home).

Project `.codex/config.toml` configures Context7 and DeepWiki. The desktop connector catalogue and a CLI MCP session remain separate inventories; configuration success does not prove that this running conversation acquired a new tool. Restart/reconnect and call the tools before claiming live availability.

## Host bindings

Cross-session advisor/orchestrator communication uses the shared
[coordination specification](superpowers/specs/2026-06-01-coordination-persistence-fix-design.md), not a Codex-only registry.
Native chat messaging and collaboration subagents are distinct address spaces.

- Invoke project skills with `$name` / the skill picker, or explicitly ask for the named procedure. Explicit-only procedures have `agents/openai.yaml` with `allow_implicit_invocation: false`. A discovered skill grants no permission to spawn a worker.
- Generated skill entries require loading the complete canonical procedure before executing it. Canonical eager shell steps are commands to execute through the active harness's shell tool before proceeding. Bind `$ARGUMENTS` and other procedure variables from the operator's invocation. Run from the repository root; helper paths resolve through `.agents/procedures/<name>`.
- `Read` means read the indicated file; `Bash` means the shell tool; `Write/Edit` means `apply_patch`. `AskUserQuestion` means the native user-input tool when available. `Skill('superpowers:…')` means read the installed companion skill and execute its procedure. Tool/model frontmatter from Claude grants neither tool access nor a Claude model on Codex; use host-available models and the canonical relative-tier policy.
- Agent skills are thin pointers to the canonical `.agents/roles/*.md` procedures. Read the entire prompt. Use a no-history subagent for cold reviews and pass its required inputs. Host authorization still controls delegation; named procedures do not silently create native tool grants.
- Hooks normalize `apply_patch` add/update/delete/move paths, including every file and both rename endpoints, before reusing source scripts. Source violations become native exit-2 feedback; pre-tool seal decisions remain native deny JSON. Nested code-mode calls inherit host hooks. Post-tool failures cannot undo mutations. `write_stdin` is transport; it does not add a new pre-tool policy check.
- SessionStart (including `source=compact`) and SubagentStart reuse the existing digest. Stop/SubagentStop use the stable `last_assistant_message` and known Codex rollout message records, observed completed nested shell/MCP records and validated per-response input usage through a temporary legacy-shaped view; the original rollout is never modified. Unknown transcript shapes provide no invented usage data; cumulative token totals are not context estimates. Usage attaches to existing assistant records so final report checks retain the final text. Token-threshold continuation needs further native acceptance; a synthetic transcript is not proof of full compaction parity.
- Use `bash scripts/getff-work.sh <name> --no-launch`; an active `CODEX_THREAD_ID` or `AIF_HARNESS=codex` selects a quoted `codex -C <provisioned-path>` command. Dependency provisioning and canonical coordination reuse the existing worktree scripts.

The contributor adapter preserves the canonical dormant handoff policy: only an explicit
`AIF_HANDOFF_GATE=1` arms it; unset and `0` stay unarmed. Hook language resolution uses
one shared helper with the existing plugin wrapper: non-empty `AIF_HOOK_LANG` wins,
otherwise a validated first line in `${XDG_CONFIG_HOME:-$HOME/.config}/getff/hook-lang`
is used. Missing or malformed pins leave the English default intact.

Validated per-response rollout `model_context_window` supplies `AIF_CTX_WINDOW` only
when the operator has not supplied a non-empty override. Unknown or invalid window
records supply no window; canonical context-tier feedback remains the source contract.
These are source integration checks, not native activation evidence.

## Scope of evidence

Adapter tests are source-script integration proofs, not trusted native hook executions. Native `skills/list`, `hooks/list` and `config/read` establish discovery/registration/configuration only. The implementation record states trust status, live checks and outstanding lifecycle/factory/eval work. Consumer installers, npm payloads and consumer plugin parity are phase two; this file does not certify them.

## Bounded input policy

Codex-specific registration broadens the existing pre-tool seal to every tool, so
unknown tool contracts produce an explicit diagnostic. It reads deterministic deny
patterns from canonical `.claude/settings.json`; it does not install or activate a
host permission profile. Read-denied credentials and write-sealed configuration
remain distinct. All patch paths (including delete and both move endpoints) are
checked before effects. Existing and missing descendants of symlinked parents are
resolved, including dangling links. The canonical primary-checkout seal still runs.

Rule injection reuses the canonical event and Read selectors and their existing
session/card caches. It recognizes literal `cat [--] FILE...` and
`head|tail [-n DECIMAL] [--] FILE...`, with whitespace-separated operands and plain,
single-quoted or double-quoted filenames. Absolute paths work without an execution
cwd. Only the raw `exec_command` payload's absolute `workdir` establishes a relative
reader cwd; native `Bash {command}` plus session `cwd` does not. A `--` delimiter
allows leading-dash filename operands. For `cat`, a bare `-` operand (with or
without `--`) remains unresolved stdin and never becomes a Read target; `./-`
and `-sentinel.ts` after `--` remain filename operands. Raw executor identity is retained: the
default shell contract and explicit `bash`, `sh`, `zsh`, `/bin/bash`, `/bin/sh`,
`/bin/zsh` use the bounded shell grammar. Other explicit executors (including
Python, empty or null overrides, and unverified paths) remain raw tools, emit an
unsupported-executor diagnostic, and receive no shell Read/effect/deny inference
or Bash event selection. Native Bash events retain their canonical behavior.
Shell strings are never executed to discover paths. No `sed`/`rg`, escapes, expansions, substitutions,
globs, redirects, stdin, compound command or interpreter grammar is claimed.

Canonical Bash deny patterns are checked against recognized literal argv, with
fixed pattern separators matching argument boundaries rather than whitespace
inside quoted arguments. Thus `git reset --hard` matches its canonical deny while
`git "reset --hard"` and `"git reset --hard"` do not fabricate that effect;
the additional recognized pipeline is a literal `curl`/`wget` download directly
piped to `bash`/`sh` without arguments. Dangerous text quoted inside `echo` remains
a non-effect control. Unsupported deny syntax, unresolved effects and unknown tools
produce `Codex input policy:` diagnostics. No verified named native MCP reader
contract was available in the checked catalogue/captures, so MCP arguments are
never guessed to be reads. That bounded observation does not establish global MCP
absence. Underlying tools remain registered in code mode; outer JavaScript is not
parsed for effects.

These checks provide bounded source guardrails. Arbitrary local code, compound
shell and interactive `write_stdin` require host filesystem/command restrictions;
remote MCP calls require their executor's policy. Native nested-call acceptance and
current hook trust remain separate blockers. Full secrecy/write parity is open.
M19 is unchanged: current native captures do not establish structured failed-write
and cancellation correlation. Missing callbacks or error-looking text cannot
support a FAILED warning, and no fictional failure event is registered.
