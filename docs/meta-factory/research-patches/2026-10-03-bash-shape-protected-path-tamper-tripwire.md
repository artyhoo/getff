<!-- scope:bash-shape-protected-path-tamper -->
# Bash-shape writes into protected paths — measured hole + content tripwire (research-patch)

> Scope: record of a measured enforcement hole in the operator's protected-path layers (2026-10-03)
> and the shape-independent tripwire that closes it. The fix lives in the operator's machine
> tooling (`~/.claude/hooks/git-safety.sh` v3.5, part 1d) — NOT in this repo; this patch is the
> evidence + design record. Folder-level authority per [research-patches README](README.md);
> NOT authoritative for project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists).

> **Origin:** 2026-10-03 operator chip. During a merge-conflict materialization an agent session
> explicitly chose NOT to route a protected-path write through `python3 -c 'open(...,"w")'` — the
> shape every existing layer is blind to — and asked the operator instead. The operator ordered
> the hole closed. Incident class: all protected-path layers matched command TEXT or tool NAME.

---

## §1 Problem — the measured hole

The Artifact Ownership Contract ([CLAUDE.md](../../../CLAUDE.md)) makes `.husky/**` maintainer-owned.
Layers that enforce it today:

1. `~/.claude/settings.json` `permissions.deny`: `Edit(/Users/art/code/rules-as-tests-aif/.husky/**)`,
   `Edit(.../.claude/settings.json)`, `Edit(.../.git/hooks/**)` — **Edit/Write TOOL-shaped**;
2. repo `.claude/settings.json` deny: `Edit(.husky/**)`, `Write(.husky/**)`,
   `Edit(.claude/settings.json)`, `Write(.claude/settings.json)`, `Edit(.git/hooks/**)`,
   `Write(.git/hooks/**)` — same, tool-shaped;
3. `~/.claude/hooks/git-safety.sh` (PreToolUse) arms — **text-shaped** (raw regex on the command
   string, e.g. `git reset --hard`, `rm -r*`, redirects);
4. `.claude/hooks/seal-primary-checkout.sh` ([PR artyhoo/rules-as-tests-aif#2009](https://github.com/artyhoo/rules-as-tests-aif/pull/2009),
   merged 2026-10-02) — PreToolUse deny for **Edit/Write/MultiEdit only** (its own test list
   includes a «Bash-tool exclusion» case), sealing the primary checkout's protected set from
   worktree sessions; dormant until maintainer registration (verified 2026-10-03: repo
   `.claude/settings.json` PreToolUse carries only ask-question-reminder / inject-subagent-context
   / inject-matching-rule). Complementary channel — closes path-anchoring for tool writes, still
   blind to Bash shapes.

Per [permission-modes docs](https://code.claude.com/docs/en/permission-modes.md) deny rules hold
even in `bypassPermissions`, so layers 1-2 do fire in coordinator sessions — but their grammar
(`Edit(path)` / `Write(path)`) **cannot express a Bash-shape write**. Any Bash call whose text
lacks the guarded tokens writes freely:

```text
$ python3 ~/.claude-coordination/git-safety/selftest/hole-probe.py
== [2] hole probe: tamper command at PreToolUse against CURRENT hook ==
exit=0 stdout='' stderr='' (45.3 ms)
verdict: PASSED UNCAUGHT (hole confirmed)
== [3] execute the tamper for real; is there anything to revert it? ==
.husky/pre-commit bytes now: b'evil-DOB-03'
tampered:
PostToolUse(Bash) hooks registered in ~/.claude/settings.json: post-api-push-autosync.sh
only (no git-safety.sh) -> nothing reverts the write
```

(faithful excerpt; fake repo at `~/.claude-coordination/git-safety/selftest/repo`, never a real
worktree). Note git-safety v3.3 already carried the same admission for a sibling surface —
part 1b-guard's comment: «запись через python/переменную/Write-тул хук не увидит».

## §2 Root cause

`#shape-dependent-gate` (new tag): every detection layer enumerated the **surface forms** of a
write (tool name, redirect tokens) instead of the **security property** (protected bytes changed).
Token enumeration is unbounded — `python -c`, `tee`, `dd`, heredoc-through-variable, `perl -pi`,
base64-pipe, `install`, env-indirection — so a text-matching layer stays incomplete by
construction, and each new token is a whack-a-mole patch.

Design 2 (extend the PreToolUse deny arm with write-intent tokens co-occurring with `.husky/`)
was evaluated and **rejected** on measured recall/precision, not taste:

```text
truth     design-2    design-1  command
tamper    FLAG        catch     python3 -c 'open("<repo>/.husky/pre-commit","w")...'
tamper    pass        catch     P=.husky python3 -c 'import os; open(os.environ["P"]+"/pre-commit",...)'  <-- FN
tamper    FLAG        catch     F=.husky/pre-commit\ncat <<EOF > $F\nevil\nEOF
tamper    pass        catch     rm <repo>/.husky/pre-commit          <-- FN (no token in list)
tamper    pass        catch     touch <repo>/.husky/evil2            <-- FN (no token in list)
benign    FLAG        pass      cat <repo>/.husky/pre-commit > /tmp/out.txt   <-- FP (read!)
benign    pass        pass      ls <repo>/.husky
```

Three cheap evasions defeat the token list and one legitimate read trips it — while the content
tripwire (design 1) aligns with ground truth on all seven rows. Per
[attention-is-not-a-mechanism.md §1](../../../.claude/rules/attention-is-not-a-mechanism.md):
detection must be a deterministic gate on the security property, not an ever-growing token
vocabulary hoping to enumerate shapes (`#hope-as-gate` at the token level).

## §3 Solution — content tripwire (git-safety.sh v3.5, part 1d)

Adopted from the chip's design 1, with the deviations the probes forced:

- **PreToolUse(Bash)** snapshots a manifest (sha256 + mode + type + bytes) of the protected set
  of the root(s) where the command will RUN: session `cwd`'s git root plus `cd`/`git -C` targets
  from the command (live-fire verified both roots captured in one manifest). Root resolution is
  filesystem-based (walk up to `.git`; common hooks dir from the gitdir file) — zero git
  subprocesses on the hot path.
- **PostToolUse(Bash)** re-computes and on any divergence: (a) restores bytes/mode/symlinks from
  the snapshot — **never from git**, worktrees legitimately hold uncommitted states; (b) appends
  a TAMPER line to `~/.claude-coordination/git-safety/tamper.log`; (c) emits
  `{"decision":"block","reason":...}` (surfaces to the agent per
  [hooks docs](https://code.claude.com/docs/en/hooks.md)). Created-from-nothing watch paths
  (`.husky/` injected into a hook-less repo) are removed whole.
- **Protected set mirrors the repo deny rules**: `.husky/**`, `.claude/settings.json`,
  `.claude/settings.local.json`, `<git-common-dir>/hooks/**` — resolved per worktree.
- **Escape hatch** (chip item 3, `MERGE_LOCK_OVERRIDE` pattern from part 1c): literal
  `GIT_SAFETY_OVERRIDE="<rationale ≥20 chars>"` in the command → no revert, OVERRIDE line in
  `tamper.log`; short rationale → reverted + rejection surfaced. An operator chat line is not
  machine-readable; the env-var-in-command-text pattern already is.
- Caps: >400 files or >4 MB → snapshot skipped, SKIP line in log (fail-open, consistent with the
  file's doctrine); snapshots `gs-<session>-<tool_use_id>` swept after 90 min (foreground calls
  live ≤10 min; background Post fires at spawn).

**Test evidence** (`~/.claude-coordination/git-safety/selftest/run.py`, synthetic stdin payloads
against the real hook, ALL PASS): 11 tamper shapes (python literal / after-cd relative /
env-indirection / tee / heredoc-via-var / sed -i / rm / rmtree / new file / settings rewrite /
git-hooks injection) each blocked + reverted with mode preserved; benign write outside protected
paths passes; override authorizes + logs; short override rejected; post-without-pre no-op;
Pre-blocked command leaves no snapshot. Latency: benign pre+post pair 117.9 ms avg vs 89.4 ms
pure interpreter-startup baseline (2 × 44.7) — ~14 ms of work per hook invocation. Live-fire:
a real Bash tool call `cd <fake> && python3 -c 'open(".husky/pre-commit","w")...'` produced a
manifest carrying BOTH roots; a synthetic Post with the real `session_id`/`tool_use_id` emitted
block + revert + TAMPER log line.

**Honest boundaries:** a background process writing AFTER Post escapes the window; two
concurrent calls writing protected paths of the same repo can revert each other (normal agent
work never writes there — that is the point); `cd $VAR` indirection hides the target root from
the augmentor; oversized trees are skipped, not guarded. The tripwire is a restore+report
mechanism, not a lock: a determined same-session adversary can also disable the hook itself
— that class belongs to the auto-mode classifier, as part 1b-guard's comment already states.

## §4 Wiring state

Pre half: live (git-safety.sh already registered under PreToolUse(Bash)). Post half requires one
operator-owned entry in `~/.claude/settings.json` → `hooks.PostToolUse`, matcher `Bash`, command
`/Users/art/.claude/hooks/git-safety.sh` (sibling of `post-api-push-autosync.sh`; this file is
operator config and agent-deny-listed, so the entry is pasted by the operator, not by an agent).
Hook-config edits are picked up by the settings file watcher; restart is the documented fallback.

## §5 §1.7 self-reflexive note

- **Forward-check:** complies with
  [attention-is-not-a-mechanism.md §1(a)](../../../.claude/rules/attention-is-not-a-mechanism.md)
  — detection is the deterministic content diff, not «someone reads the log»; the log and the
  Post `block` feedback are the authority layer on top. No paid LLM anywhere (hashing + file IO
  only), consistent with [no-paid-llm-in-ci.md](../../../.claude/rules/no-paid-llm-in-ci.md) —
  and the check runs in-session at the earliest reachable channel (the Bash tool boundary), not
  in CI. This is a research patch (docs-only): no capability commit in this repo, no SSOT row
  required; the enforcement artifact is operator machine tooling outside the repo's dependency
  surface.
- **Backward-check:** class = «protected-path layers matching command TEXT or tool NAME, blind
  to Bash write shape». Surfaces: (1) `~/.claude/settings.json` deny — Edit/Write-shaped,
  cannot express Bash writes (the reason this tripwire exists; documented in §1; the repo-path
  deny rows sit at `~/.claude/settings.json:617-620`); (2) repo `.claude/settings.json` deny —
  same grammar, same blindness (grep evidence: the deny array at `.claude/settings.json:14-56`
  contains only `Edit(...)`/`Write(...)` rows for protected paths, no write-shape arm);
  (3) git-safety.sh parts 1/1b/1c — text/argument matching by
  design, aimed at destructive-OP detection, where the threat command must NAME the operation —
  a different property from "bytes changed", not retrofitted here; (4) the part 1b-guard
  transcript-protection arm carries the identical FN admission in its own comment
  (git-safety.sh v3.3 comment: «запись через python/переменную/Write-тул хук не увидит») — a
  candidate for the same tripwire pattern as a future arm (transcripts live outside git roots,
  so today's root resolution does not cover them); (5) `.claude/hooks/seal-primary-checkout.sh`
  (shipped by PR #2009, dormant until maintainer registration) — SWEPT-CLEAN for this hole's
  class: it denies by TOOL NAME (matcher `Edit|Write|MultiEdit`, Bash deliberately excluded per
  its test plan), so a Bash-shape write passes it exactly as it passes layers 1-2; it is the
  complementary tool-write layer with correct worktree→primary path anchoring, not a duplicate
  of this tripwire (late in-flight probe hit resolved 2026-10-03 by reading the PR and its
  registration state). No repo-shipped artifact changed behavior here; GAP-FOUND surfaces are
  recorded above rather than silently widened.

## §6 Prevention

PRIORITY CHECK — before trusting any protected-path guard, ask: **"what Bash shapes reach the
protected bytes without matching this guard's grammar?"** If the guard enumerates tokens or tool
names, it is incomplete by construction; the load-bearing layer must diff the protected STATE
across the guarded action. Test the guard with the boring command too (`cat f > /tmp/o`): a
gate that flags reads is a false-positive generator.

## Tags

`#shape-dependent-gate` (new) · `#bypass-surface` · `#tripwire-not-token` · `#negative-recall-measured`

## See also

- `~/.claude/hooks/git-safety.sh` v3.5, part 1d — the enforcement artifact (operator machine
  tooling; backup of v3.4 at `~/.claude-coordination/git-safety/backups/`).
- `~/.claude-coordination/git-safety/selftest/` — `hole-probe.py` (§1 evidence) and `run.py`
  (paired-negative suite, §3 evidence); rerunnable at any time, throwaway fake repo only.
- [CLAUDE.md Artifact Ownership Contract](../../../CLAUDE.md) — what `.husky/**` is and why it is
  maintainer-owned.
- [.claude/rules/attention-is-not-a-mechanism.md](../../../.claude/rules/attention-is-not-a-mechanism.md) —
  the gate-vs-attention discipline this design instantiates.
