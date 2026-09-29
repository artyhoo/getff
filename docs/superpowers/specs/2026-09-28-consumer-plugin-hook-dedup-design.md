# Consumer-side plugin hook dedup — design

> **Status:** APPROVED (2026-09-28), revision 4 — design only; no code ships with this spec.
> Revision 4 (2026-09-29, merge of staging with #1925): the plugin twin of `inject-session-bootstrap`
> stopped shipping when #1925 moved the injections to SessionStart, so D5's guard, D10's case-block
> check and implementation step 4 are moot. D5 still holds: principle 24 arm (j) now checks that no
> plugin hook other than `inject-output-language` emits the line. Sections below keep revision 3 text.
> Revision 3 (2026-09-29) adds D12: a file-based yield can lose a hook on a host that does not
> load project settings, so the plugin copy now also needs runtime evidence that the project copy runs.
> Approved in dialogue section by section. Revision 2 (same day, during planning) replaces the
> approved sibling yield with a twin transform (D5): the sibling yield left the language line
> doubled for a consumer that also ran the installer.
> **Authoritative for:** when a getff plugin hook stays silent in a CONSUMER project (D1-D4), the
> single owner of the output-language line in the plugin payload (D5), the harness/platform scope (D6-D7), and the gates
> that keep the source-hash manifest honest (D8-D11).
> **NOT authoritative for:** project goal — [README.md#why-this-exists](../../../README.md#why-this-exists);
> the source-checkout yield itself — `plugin/hooks/run-hook.cmd` section «Yield to the plugin's own
> source checkout» (PR artyhoo/getff#1879) owns it; installer delivery modes — `setup.d/lib.sh`
> (`copy_safe`, `refresh_safe`).
> **Depends on:** PR artyhoo/getff#1879 merged first — this design extends its `run-hook.cmd`
> block and reuses its registration check verbatim. PR artyhoo/getff#1911 (open) edits the same
> block with a broader yield and a runtime language-line fix. Whichever lands, the implementing
> session re-reads `run-hook.cmd` on staging first. #1911 stays narrow (a `cwd` guard only); its
> `AIF_HOOK_CHANNEL` language fix moves into THIS work as D5, and its SSOT row #290 is preserved for
> this work's capability commit.

## Problem

A consumer that ran the installer AND installed the getff plugin runs every shared hook twice per
event: once from `.claude/settings.json` (registered by `register_cc_hook`, e.g.
`setup.d/10-skills.sh:376` for `inject-output-language`), once from the plugin's
`plugin/hooks/hooks.json`. Shared set today: `deps-hash-check`, `end-of-turn-reminder`,
`ask-question-reminder`, `inject-matching-rule`, `inject-output-language`,
`check-doc-authority-header`, `inject-project-digest`, `inject-memory-codification`.

PR #1879 deliberately stopped at the source checkout. A consumer's installed copy is written with
`copy_safe` (skip-if-exists, `setup.d/lib.sh:875`) and refreshed only by `--refresh`
(`refresh_safe`, e.g. `install.sh:965`), so it can be older, equal, or newer than the plugin
copy, and a consumer may have edited it. Yielding to an older copy replaces a newer gate with an
older one.

**Principle (inherited from #1879):** a duplicate costs context; a lost or older gate costs the
gate. Every doubt resolves to «run».

A second duplicate needs no installer at all: the plugin's `inject-output-language` and the
plugin's `inject-session-bootstrap` both emit the same `[output-language]` line on
`UserPromptSubmit` (`plugin/hooks/inject-session-bootstrap:121-128` appends it to the digest). In a
plugin-only project that line arrives twice; in a consumer that also ran the installer, the
installed `inject-output-language` plus the plugin digest carry it twice even after D3.

## Prior art

- [prior-art-evaluations.md#150](../../meta-factory/prior-art-evaluations.md) — superpowers
  `hooks/run-hook.cmd`, ADOPT verbatim. The adopted upstream carries no dedup logic: the cached
  superpowers 6.2.0 `hooks/run-hook.cmd` is 46 lines with zero matches for
  `yield|settings.json|dedup` (measured 2026-09-28). The yield is an own-build extension on top
  of the adopted dispatcher, as #1879's is; nothing upstream to reuse.
- Existing in-repo mechanism considered and not reused: `.ai-factory/refresh-baseline.json`
  (`setup.d/lib.sh:250-300`) records sha256 of delivered bytes per consumer path. It answers
  «did the consumer edit this file since install», not «is this file the source the plugin was
  built from» — the plugin cannot read an install-time manifest of an unknown version, and the
  live file hash already covers edits. The capability commit implementing this spec runs the
  full CLAUDE.md build-vs-reuse gate (context7 ≥3 phrasings) and adds an SSOT row if none match.

## Approaches considered

| | Approach | Verdict |
|---|---|---|
| A | Yield only to a copy **byte-identical** to the source the plugin twin was built from (source-hash manifest shipped in the plugin) | **CHOSEN** — cannot hand an event to an older copy by construction |
| B | Installer writes a version stamp; plugin compares versions | REJECTED — package and plugin are separate version lines; a consumer edit under a stamp is invisible; writing into the delivered file breaks the byte parity `refresh-baseline.json` relies on |
| C | Installer skips registering hooks when the plugin is present | REJECTED — disabling the plugin later leaves the hook running nowhere (the lost-gate case) |

Cost of A, stated honestly: the duplicate disappears only where the installed copy and the
plugin were built from the same hook source. A newer installed copy (or an edited one) keeps both
running. `--refresh` plus a plugin update realigns them.

## Decisions

### D1 — Source-hash manifest in the plugin payload

New file `plugin/hooks/lib/source-sha256.txt`, `sha256sum` text format, one line per file a yield
must match. It lives under `lib/` because `tests/plugin/hook-paths.test.sh` treats every top-level
file in `plugin/hooks/` (except `run-hook.cmd`, `*.json`, `*.md`, `_zcode-*`) as a hook script:

```text
<sha256>  inject-output-language.sh
<sha256>  end-of-turn-reminder.sh
<sha256>  end-of-turn-reminder.sh:lang/en.sh
<sha256>  end-of-turn-reminder.sh:lang/ru.sh
<sha256>  end-of-turn-reminder.sh:lib/residue-dir.sh
```

- Hashes are of the **source** `.claude/hooks/<name>.sh` (and its declared dependencies), never of
  the twin. So manual twins (`@plugin-transform: manual` — `inject-output-language`,
  `inject-project-digest`, `inject-matching-rule`, `inject-subagent-context`, `validate-prompt`)
  enter the manifest exactly like generated ones. Correspondence twin ↔ source is the same trust
  #1879 already places in the `Plugin twin of` / `AUTO-GENERATED from` line.
- Written by `scripts/generate-plugin-twins.sh` (already run at pre-commit, which re-stages
  `plugin/hooks/`) for every hook that has a twin in `plugin/hooks/`. No manual step.
- One hashing implementation, `plugin/hooks/lib/source-hash.sh` (POSIX sh — `run-hook.cmd` runs
  under dash on Linux), sourced by both `run-hook.cmd` and the manifest writer, so the value
  written at build time and the value computed at run time cannot diverge.

### D2 — Declared dependency closure

A hook that sources files from its own directory declares them on one line:

```text
# @plugin-yield-deps: lang/ lib/residue-dir.sh
```

A directory entry (trailing `/`) hashes the sorted `<sha256>  <file>` listing of every regular
file directly in it, so an added file (a new `lang/de.sh`) is a mismatch too. Live cases:
`end-of-turn-reminder.sh:44-48` picks `lang/<AIF_HOOK_LANG>.sh`, and `:60-61` falls back to an
inline copy when `lib/residue-dir.sh` is missing — a different file set is different behaviour,
so the installed copy's closure must match, not just the script.

**Safe by construction:** if a source has a non-comment line with a `.`/`source` statement,
`BASH_SOURCE`, or `_HOOK_DIR` (the ways a hook reaches files beside itself) and no
`@plugin-yield-deps` line, the generator writes NO manifest entry for that hook. No entry ⇒ never
yields (D3) ⇒ today's behaviour, never a lost gate. No separate gate needed for omission. Of the
consumer-shared set, `end-of-turn-reminder` and `ask-question-reminder` need a declaration.

### D3 — Consumer yield branch in `run-hook.cmd`

A second branch beside #1879's source-checkout yield, taken when the project does NOT ship
`plugin/.claude-plugin/plugin.json`, OR ships one naming a different plugin (the source-mode
name check fails and this branch evaluates instead). The plugin copy exits 0 silently only when
ALL hold:

1. Every shared #1879 condition: Claude Code (not ZCode), language pin not from the file
   fallback, no `GETFF_PLUGIN_NO_YIELD`, jq present, `hooks.json` beside the dispatcher, the
   project registration in `.claude/settings.json` is exactly
   `bash "$CLAUDE_PROJECT_DIR/.claude/hooks/<name>.sh"` (optionally `statusMessage`) and covers
   every (event, matcher) pair the plugin registers.
2. The manifest has an entry for `<name>`. No entry ⇒ run.
3. sha256 of `$CLAUDE_PROJECT_DIR/.claude/hooks/<name>.sh` and of every declared dependency
   equals its manifest line. A missing file is a mismatch ⇒ run.
4. `sha256sum` or `shasum -a 256` is available. Neither ⇒ run.
5. The project copy is live for THIS event (D12). No evidence ⇒ run.

The #1879 `@plugin-yields-to` targets go through the same checks against the target's own
manifest lines.

Outcome table:

| Installed copy vs plugin source | Result |
|---|---|
| byte-identical, closure identical | plugin copy silent — hook runs once |
| older | both run (gate kept) |
| newer / consumer-edited / dependency differs or missing | both run (duplicate, context cost only) |

### D4 — Relative `deps-hash-check` registration never counts (operator decision 2026-09-28)

`setup.d/10-skills.sh:211` and `setup.d/45-python.sh:1333` register
`bash .claude/hooks/deps-hash-check.sh`, cwd-relative. It fails D3.1's exact-form check, so
`deps-hash-check` stays doubled for consumers. Counting a path that may not resolve would risk the
lost-gate case. The hook's `$TMPDIR` memo (`.claude/hooks/deps-hash-check.sh:433-439`) caches the
computation, not the fact of output, so both copies do print. Migrating the registration to the
`$CLAUDE_PROJECT_DIR` form is separate installer work, out of scope here.

### D5 — One owner for the output-language line in the plugin payload

The plugin twin of `inject-session-bootstrap` no longer carries the `[output-language]` line;
the plugin's `inject-output-language` is its only emitter. The source keeps the line (the framework
repo registers `inject-session-bootstrap` and not `inject-output-language` in its own
`.claude/settings.json`). Mechanism (revision 3, taken from #1911 commit fd2b1ec38f3, which the
#1911 session handed over): `run-hook.cmd` exports `AIF_HOOK_CHANNEL=plugin` above its yield block,
so both the exec path and any guarded path carry it. The language `case` in
`.claude/hooks/inject-session-bootstrap.sh` then keys on `${AIF_HOOK_CHANNEL:-}:${AIF_HOOK_LANG:-en}`
and emits nothing on the plugin channel. The twin stays an identity twin; pre-commit re-renders
it. The revision-2 sed transform is dropped: one runtime check instead of a build-time cut. The
old plugin-only test arm lives in the #1911 bundle (`tests/plugin/project-channel-dedup.test.sh`).

Every case then carries the line once:

| Case | Emitters |
|---|---|
| framework source checkout | project `inject-session-bootstrap`; plugin copies yield (#1879, incl. `@plugin-yields-to`) |
| same, language pin from the fallback file | plugin `inject-output-language` only (project copy is blind to the pin, plugin digest has no line) |
| plugin-only consumer | plugin `inject-output-language` |
| consumer with installer, identical copy | project `inject-output-language`; plugin copy yields (D3) |
| consumer with installer, differing copy | project + plugin `inject-output-language` (accepted D3 duplicate) |
| ZCode | plugin `inject-output-language` |

Revision 1 proposed a sibling yield (plugin `inject-output-language` silent when the plugin also
runs `inject-session-bootstrap`). Dropped: it removed the plugin-only duplicate but left the
installed `inject-output-language` plus the plugin digest doubled, and it needed chain guards.

### D6 — ZCode

ZCode never reads `.claude/settings.json`; hooks reach it only through the plugin channel
([2026-07-04-zcode-harness-visibility.md](../../meta-factory/research-patches/2026-07-04-zcode-harness-visibility.md) line 13).
Therefore D3 (yield to a project copy) never fires on ZCode — the project copy does not run
there, so there is no duplicate to remove and yielding would lose the hook. The ZCode duplicate
that does exist, the language line inside the plugin, is removed by D5 without any yield.

### D7 — Windows batch branch stays run-always (operator decision 2026-09-28)

The batch half of `run-hook.cmd` calls bash on the hook directly and has neither the yield nor the
language fallback. It keeps running every copy. No Windows stand exists to live-verify a yield
(V4 is blocked on a Windows/WSL stand). **Trigger to revisit:** a Windows stand exists — then
extract the yield decision into `plugin/hooks/lib/should-yield` and call it from both branches.

### D12 — Liveness: yield only on evidence that the project copy runs this event (revision 3)

Conditions 1-4 read files. Files do not show whether Claude Code loaded the project's settings.
`--setting-sources` without `project`, and an Agent SDK host without `settingSources:
["project"]`, skip project hooks while `.claude/settings.json` and the installed copies sit on
disk. A hook cannot tell which sources are active: the payload has no source field and no env
var names them (code.claude.com/docs/en/hooks, checked 2026-09-29). Without D12 the plugin copy
yields there and the hook runs nowhere — the lost-gate case.

Protocol (asymmetric; the project copy never yields):

- **Project copy** marks itself live. A prelude from `.claude/hooks/lib/hook-live.sh` reads
  stdin into memory, re-opens it as stdin from a pipe, and creates
  `${TMPDIR:-/tmp}/getff-hook-live.<uid>/<session_id>/<key>.<epoch-seconds>.<pid>`
  (implementation r4: no temp file, a per-user base, an epoch field for the 5 s age check). `<key>` is the sha256 of the hook
  name plus the whole payload. It then runs as before. It also deletes its session's markers older
  than 60 s.
- **Plugin copy** checks D3 conditions 1-4 first. Only if they hold does it look for a marker with
  the same key, younger than 5 s. It waits at most 300 ms for one. It claims one marker atomically
  (`mv` to a claimed name; only one `mv` succeeds) and exits 0. No marker, a failed claim, no
  `session_id`, or any error ⇒ it runs.
- One claim per marker keeps repeats paired. A second identical event in one session (a Stop that
  blocks twice) writes a second marker, so the plugin yields once per project run and never more.
- Hash identity (condition 3) means the copy that runs is the same code. D12 decides only
  *whether* it runs.

| Host | Outcome |
|---|---|
| project settings loaded, copies identical | project runs; plugin claims the marker and yields — once |
| project settings NOT loaded | no marker; plugin runs after ≤300 ms — once |
| plugin reads before the marker lands and the wait expires | both run (duplicate, safe) |
| ZCode | D6: plugin never yields |

Costs, stated: the prelude joins every shared source hook, and `hook-live.sh` joins each one's
`@plugin-yield-deps` closure. The installer must deliver `.claude/hooks/lib/hook-live.sh`.
Consumers installed before this ship have no prelude, so their copies never mark ⇒ both run. The
≤300 ms wait is paid only where conditions 1-4 hold. The per-session directory keeps concurrent
sessions in one project apart.

Two refinements of the protocol above, recorded after the implementation audit:

- `deps-hash-check` gets no prelude and no `hook-live.sh` closure line. Under D4 its relative
  registration never counts, so its plugin copy always runs and a marker would never be claimed.
  The prelude joins it together with the D4 migration.
- The claim also refuses a registration with any handler field beyond `type`, `command` and
  `statusMessage` (for example `timeout`, `async`, `if` or `shell`). It checks every settings
  layer Claude Code merges: `.claude/settings.json`, `.claude/settings.local.json`, the user
  settings and the managed settings. Such a field can make the project copy behave differently
  from the plugin copy, so it only adds reasons to run.

## Gates

### D8 — Manifest freshness (principle 24, new arm)

`packages/core/principles/24-plugin-manifest-integrity.test.ts` gains an arm: recompute every
manifest line from the sources and the declared closures; any difference is RED with the file
named. A hook edited without regenerating the manifest fails at pre-commit/pre-push, not at a
consumer.

### D9 — Version bump rides on arm (i)

The manifest lives under `plugin/**`, so any source-hook change changes the payload and existing
arm (i) (version-bump gate, `24-plugin-manifest-integrity.test.ts:479`) demands a bump. That is
the point: a consumer's cached plugin must refresh to carry the new hashes. Consequence accepted:
editing a twinned source now always implies a plugin release, even when the manual twin's bytes
did not change.

### D10 — Language-line ownership

The same new arm checks D5 holds on the shipped payload: every `[output-language]` code line in
the plugin `inject-session-bootstrap` sits inside the `AIF_HOOK_CHANNEL` case block, after its
silent `plugin:*) : ;;` arm; `plugin/hooks/run-hook.cmd` exports `AIF_HOOK_CHANNEL=plugin`; and
the plugin `inject-output-language` still emits the line (implementation r4: Task 3′ keeps the
text in the twin behind a runtime guard, so "contains no string" was replaced).

### D11 — Dual-source hooks

`deps-hash-check` is delivered from `packages/core/hooks/deps-hash-check.sh`
(`setup.d/10-skills.sh:205`, `setup.d/45-python.sh:1328`) while its twin is generated from
`.claude/hooks/deps-hash-check.sh`. The two are byte-identical today (`cmp`, 2026-09-28). The arm
asserts that identity for every twinned hook that also exists under `packages/core/hooks/`, so the
manifest can never describe bytes the installer does not deliver.

## Tests

New arms continuing Y1-Y25 in `tests/plugin/run-hook.test.sh` (paired: each silent case has a
run twin that differs by one input):

- consumer, identical copy + closure ⇒ silent;
- older copy / newer copy / edited copy ⇒ runs;
- declared dependency missing or different ⇒ runs;
- no manifest entry (undeclared `source`) ⇒ runs;
- no `sha256sum` and no `shasum` ⇒ runs;
- relative `deps-hash-check` registration ⇒ runs;
- ZCode: identical project copy ⇒ runs (D6);
- D12: identical copy, registration present, but no marker (project settings not loaded) ⇒ runs;
  fresh marker ⇒ silent and the marker is consumed; two markers, two plugin runs ⇒ two yields;
  stale marker (>5 s), other session's marker, no `session_id` ⇒ runs;
- real tree: a simulated consumer (installed copies + installer registration forms) with every
  plugin `UserPromptSubmit` hook dispatched carries the language line once; a plugin-only project
  likewise;
- Windows branch untouched (no new arm; D7).

Principle 24 arm: paired negative replays — a stale manifest line, a missing line for a declared
dependency, a language line back in the plugin digest, a diverged `packages/core/hooks` copy —
each RED.

## Live verification before merge

- **Claude Code:** install getff into a temp project, install the plugin from the working tree,
  submit one prompt, count `[output-language]` lines and hook outputs — expected one each. Run by
  the implementing session.
- **ZCode:** same run; the language line must appear once. If ZCode cannot be driven from the
  session, the implementing session opens a follow-up task that automates this run rather than
  handing it to the operator.

## Implementation order

1. Wait for artyhoo/getff#1879 to merge; branch from staging.
2. Hashing lib + generator: `@plugin-yield-deps` parsing + `plugin/hooks/lib/source-sha256.txt`.
3. `run-hook.cmd`: consumer branch (D3), sharing #1879's jq registration check; liveness (D12):
   `hook-live.sh`, the prelude in each shared source hook, installer delivery of the lib.
4. D5 twin transform for `inject-session-bootstrap`.
5. Principle 24 arm (D8, D10, D11) + run-hook test arms.
6. Plugin version bump (arm (i)), live runs, PR with §1.7 sections and a `Prior-art:` trailer.

## Out of scope

- Migrating relative `deps-hash-check` registrations (D4).
- Windows yield (D7).
- Any change to how the installer delivers or refreshes hooks, beyond delivering
  `.claude/hooks/lib/hook-live.sh` next to the hooks that load it (D12).
