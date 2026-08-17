<!-- scope:container-channel-probe-2026-08-17 -->

# Container channel probe — 2026-08-17

> **Authoritative for:** the 2026-08-17 container-channel-probe report — verbatim captures of
> what the worker observed when re-probing gate reachability (next in the series after
> [`2026-07-24-container-channel-probe.md`](../../retros/) commits `65b0e83861`/`9087b66c8d`,
> which live on the probe branches). Append-only research-patch artefact.
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists).
> Folder convention — see [README.md](README.md) (folder-level authority).

Worker: GLM in aif-handoff container, branch `feature/probe-f2d33e`, prepared worktree
`/home/www/rules-as-tests-aif-feature-probe-f2d33e-f2d33e5e-6fe9-4985-9f97-0e0651057229`.
Plan: `.ai-factory/plans/probe.md` (existed at dispatch — see bookkeeping note).

## §A — Environment / deps / auth (verbatim, 2026-08-17)

```text
jq: /usr/bin/jq
gh: /usr/bin/gh
python3: /usr/bin/python3
node: /usr/local/bin/node
npx: /usr/local/bin/npx
```

```text
$ gh auth status
You are not logged into any GitHub hosts. Run gh auth login to authenticate.
exit=1
```

```text
$ ls -ld /home/node/.npm /home/node/.npm/_cacache
drwxr-xr-x 1 node node 4096 Aug 10 13:55 /home/node/.npm
drwxr-xr-x 1 node node 4096 Jul 24 00:08 /home/node/.npm/_cacache
```

```text
$ ls node_modules/.bin/tsx node_modules/.bin/vitest 2>/dev/null || echo ABSENT
ABSENT
```

```text
$ test -w /tmp && echo tmp-writable || echo tmp-BLOCKED
tmp-writable
$ ls -la /tmp/pre-commit-err
ls: cannot access '/tmp/pre-commit-err': No such file or directory
```

```text
$ bash scripts/worktree-doctor.sh
MISSING  /home/www/rules-as-tests-aif-feature-probe-f2d33e-f2d33e5e-6fe9-4985-9f97-0e0651057229
... (140 further MISSING rows across sibling worktrees)
185 worktrees: 44 provisioned, 0 fixed, 141 outstanding
Run `bash scripts/worktree-doctor.sh --fix` to provision them.
exit=1
```

Reading: all five tools on PATH. **gh unauthenticated today** (memory note: auth state
flips intra-day — today is a no-auth day for gh). npm dirs node-owned (no EACCES surface).
devDeps ABSENT at session start (known handoff provisioning gap — this worktree is one of
the 141 outstanding). `/tmp` writable; the 2026-08-16 root-owned `/tmp/pre-commit-err`
blocker is NOT present today.

## §B — Edit-time violating case (verbatim)

Target: `agents/_probe-channel.md` (content: title + two prose lines, deliberately NO
`> **Authoritative for:**` header). Write tool result: file created. PostToolUse hook then
returned a **blocking error** that reached the model context verbatim:

```text
PostToolUse:Write hook blocking error from command:
"bash "$CLAUDE_PROJECT_DIR/.claude/hooks/check-doc-authority.sh"":
[bash "$CLAUDE_PROJECT_DIR/.claude/hooks/check-doc-authority.sh"]]:
FAIL  agents/_probe-channel.md: missing "> **Authoritative for:**" header —
see .claude/rules/doc-authority-hierarchy.md §3
```

(line wraps added for the 600-column gate; text otherwise verbatim)

Additionally `inject-matching-rule.sh` fired on the same Write, injecting five path-relevant
rule pins as `additionalContext` (ai-laziness-traps, build-first-reuse-default,
doc-authority-hierarchy, dual-implementation-discipline, source-before-shape).

**Differs from 2026-07-24:** that round probed `.claude/rules/**` and the Write was
preempted by the CC permission classifier — the gate never fired. Today, on the `agents/`
surface, the Write lands and the registered PostToolUse gate fires with a model-visible
FAIL (the exit-2 violation channel shipped in
[`2026-07-24-posttooluse-channel-verification.md`](2026-07-24-posttooluse-channel-verification.md)).

## §C — Edit-time passing case (verbatim)

Same file rewritten WITH a valid `> **Authoritative for:**` header. Write tool result:
`File updated successfully` — no blocking error, no FAIL from `check-doc-authority.sh`.
Clean pass, as designed. Cleanup: `rm agents/_probe-channel.md` → `git status --short`
empty (tree clean; nothing preserved — T17 n/a, throwaway probe content only).

## §D — Test channel (verbatim)

```text
$ npm_config_cache=/tmp/probe-npm-cache NODE_ENV=development npm install --include=dev
added 1283 packages, and audited 1291 packages in 3m
11 vulnerabilities (1 moderate, 10 high)
npm-install-exit=0
```

```text
$ npm_config_cache=/tmp/probe-npm-cache NODE_ENV=development \
  npx vitest run packages/core/principles/09-doc-authority-hierarchy.test.ts
 RUN  v4.1.8 /home/www/rules-as-tests-aif-feature-probe-f2d33e-...-7229
 Test Files  1 passed (1)
      Tests  37 passed (37)
   Duration  718ms
vitest-exit=0
```

**Test channel REACHED today** — devDeps installable (registry reachable, no EACCES with the
`/tmp` cache prefix) and principle 09 runs green in-container. Differs from the
devDeps-omitted memory baseline: the blocker is the worktree provisioning gap, not the
registry. Side-effect captured: the install lifecycle flipped the exec bit on a tracked
source file (`packages/core/synthesizer/verify-provenance-cli.ts` 100644→100755) —
restored via `git restore` (pre-existing-pollution memory pattern).

## §E — Commit-time gates (self-application, T15)

This patch's own commit is the live-fire: markdownlint MD040 (all fenced blocks above
tagged `text`) + the 600-line markdown gate (`wc -l` pre-checked: 165). A commit cannot
contain its own outcome — round-1 result recorded here in the amendment commit (mirroring
`9087b66c8d`).

**Round 1 — PASSED first try.** Commit `6add8a101d` (subject above) landed with exit=0;
pre-commit hooks ran clean — no MD040 rejection, no 600-line rejection, no `/tmp`
root-owned blocker. Verbatim:

```text
$ git commit -m "docs(research-patches): container-channel-probe 2026-08-17 — ..."
[feature/probe-f2d33e 6add8a101d] docs(research-patches): container-channel-probe 2026-08-17 — verbatim gate-reach report
 1 file changed, 165 insertions(+)
 create mode 100644 docs/meta-factory/research-patches/2026-08-17-container-channel-probe.md
commit-exit=0
```

Differs from 2026-07-24 round-1 (MD040 rejected five untagged fenced blocks): blocks were
tagged `text` at authoring time, so the gate had nothing to reject. Commit-time channel
verdict: `REACHED-ME` (hooks executed and passed; `node_modules` present from §D meant
markdownlint-cli2 resolved locally rather than via npx fetch).

## §F — Per-channel verdict table

| Channel | Verdict |
|---|---|
| Edit-time PostToolUse `check-doc-authority.sh`, violating write under `agents/` | `REACHED-ME` — blocking FAIL, verbatim |
| Same gate, conforming write | `REACHED-ME` — clean pass, no error |
| `inject-matching-rule.sh` additionalContext | `REACHED-ME` — five rule pins |
| UserPromptSubmit session-bootstrap digest | `REACHED-ME` — present from first prompt |
| Test channel (npm install + vitest principle 09) | `REACHED-ME` — 1283 pkgs, 37/37 pass |
| npm outbound registry | `REACHED-ME` — install exit=0 (auth flipped vs 2026-08-09 memory) |
| `gh` outbound auth | `BLOCKED (not logged in)` — exit=1; PR/push ops unavailable today |
| Worktree node_modules provisioning at birth | `BLOCKED (handoff devDeps omitted)` — doctor row MISSING; self-provisioned in §D |
| Commit-time gates (markdownlint MD040, 600-line, husky pre-commit) | `REACHED-ME` — round-1 clean pass, exit=0 (§E) |

## §G — What surprised me (differs-from-2026-07-24 notes)

1. **The doc-authority gate reached the model.** 2026-07-24 concluded SILENT-by-preemption
   for `.claude/rules/**`; on `agents/**` the same gate fires and its exit-2 FAIL text
   arrives verbatim. Both findings stand — they are different path classes.
2. **npm and gh auth flip independently.** Same session: registry install exit=0 while
   `gh auth status` exit=1. The memory's "no outbound auth" model is two separate axes.
3. **npm lifecycle mutated a tracked source file's mode** (exec bit on
   `verify-provenance-cli.ts`) — a pollution class the worktree-pollution memory should
   eventually absorb.
4. **Provisioning, not the registry, is the real test-channel blocker** in this container
   lineage: with env overrides the whole principle suite is runnable today.

## Bookkeeping note

- The dispatcher-referenced plan `@.ai-factory/plans/probe.md` DID exist this time — the
  2026-07-24 round-5 defect (referenced plan not existing) does not reproduce. Plan file is
  local-only (`.git/info/exclude` covers `/.ai-factory/`).
- Probe branches cited in the plan's evidence list all exist (`git branch` verified at
  planning time); the 2026-07-24 patch content was recovered via
  `git show 65b0e83861:docs/.../2026-07-24-container-channel-probe.md` — that patch is not
  merged into this branch, so this patch mirrors its structure from the commit object.
