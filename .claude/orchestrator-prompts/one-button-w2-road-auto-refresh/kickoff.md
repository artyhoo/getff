# one-button second wave — the road refreshes an older install itself

> **Type:** I-phase, execution-build, single stage — ONE PR against `staging`.
> **Base branch:** `staging`. **Branch:** `feat/one-button-w2-road-auto-refresh`.
> **PR title:** `feat(road): an older install is refreshed by the agent, not handed to the person as a command; the bridge keeps the person's settings original`.
> **Channel:** one aif task (own worktree, harvested from the host) or one host session; verified on the
> host by an Opus session (operator log entry 36 — a proposal, not an order).
> **Rigor label (L0):** `build-and-verify` — a refresh overwrites framework-owned files in a person's
> project; the road starting it on its own must be safe by construction.
> **Authoritative for:** this stage's contract — the road change, the `keep_original` fix on the bridge
> writer, acceptance, falsifiers.
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists);
> the refresh semantics (`INSTALL-FOR-AI.md` «What `--refresh` updates / never touches»).

## §0 Dispatch gate — second wave, after the landing

Operator log entry 41 — the log's reading: «the python pre-push hook and the road's auto-refresh on an
older install go to the second wave». The road text below arrives with the one-button union; at authoring
time (2026-09-30, `origin/staging` `2855667cb34`) it is absent. Check at click time:

```bash
git fetch origin staging
git show origin/staging:INSTALL-FOR-AI.md | grep -q 'list absent in this older install' \
  && git cat-file -e origin/staging:setup.d/bridge-guided.sh \
  && echo "union landed — dispatchable"
```

Then `SLUG=one-button-w2-road-auto-refresh bash .claude/skills/dispatcher/helpers/probe-inflight.sh`
(`.claude/skills/dispatcher/SKILL.md` §2.0).

**Measurement SHA:** `808e806c606` (head of `join/one-button-union`, round 6); re-locate by content after
the landing (the landing ports P2/P5 edits into the refreshed `do_refresh` functions — handoff decision 1).

## §1 The defect, as measured

1. **A printed command is a manual step.** Road step 8, `INSTALL-FOR-AI.md:97`: «File absent → "not done:
   list absent in this older install" and under it the one line I may run myself, `bash
   /tmp/getff/install.sh <detected-stack> --refresh`; do not run it and do not ask about it.» The source
   is `packages/core/templates/shared/first-steps.source.json:233`; the wording is PINNED by
   `packages/core/audit-self/first-steps-parity.test.ts:584-592` («an absent base-core list ends in a
   command the person may run, which the road never runs»). The operator's global directive of
   2026-09-28 (`~/.claude/CLAUDE.md`, Core Principles): «Всё, что оператор делает руками, должно быть
   автоматизировано … Каждая строка "От тебя: <ручное действие>" — дефект процесса». The advisor
   recorded the same slip as its own («made a manual step of the step-8 line», handoff «Rejected
   alternatives»).
2. **The bridge writes the person's settings with no kept original.** `bridge_wire_project` writes
   `.claude/settings.local.json` through `_bridge_write_env` (`setup.d/bridge-guided.sh:179`, writer
   `:80-100`) and never calls `keep_original_snapshot` / `keep_original_settle` / `keep_original_mark`
   (`setup.d/lib.sh:3211-3245`), while the session-settings writer does (`setup.d/session-settings.sh:165`)
   and so do the ESLint config writers (`setup.d/99-finalize.sh:423-431`). The `--refresh` arm reaches this
   writer (`install.sh:1144` `bridge_register_dispatch_hook`), so an automatic refresh multiplies an
   unsnapshotted write into a file the person owns.

## §2 Decisions this stage respects

- **Entry 41** — second wave (above).
- **Entry 40 / 39** — session settings and stack tools default to yes; «the protections stay: the
  per-person `.claude/settings.local.json`, the person's own values win, one undo command» (the log's
  reading of entry 40). A refresh started by the road must not weaken them.
- **Q4.7 (2026-09-28, `lib.sh:3211-3213`)** — «getff adds its block to the consumer's ESLint config
  itself, keeping the original»: the keep-original mechanism is the house pattern for writes into a
  file the person owns.
- **Road rule** (`INSTALL-FOR-AI.md:110`): «do not stop between steps and ask me nothing after the one
  question of step 3.» The refresh must not add a question.

## §3 Deliverables

1. **Measure first.** On a scratch project installed by an OLDER getff (a commit before `base-core.md`
   shipped — find it with `git log --diff-filter=A -- skills/getff/references/base-core.md`), walk the
   road's steps 2-8 as written and record: whether step 4's `setup -y` already re-delivers
   `.claude/skills/getff/references/base-core.md` (if it does, step 8's «absent» branch is unreachable
   after step 4 and the fix is different — PARK); what `--refresh --dry-run` would overwrite; which
   `refresh-conflicts/` entries it would create. Paste into the PR body. This is the RED.
2. **The road runs the refresh.** Rewrite step 8's absent branch so the agent runs
   `bash /tmp/getff/install.sh <detected-stack> --refresh` itself (after a `--dry-run` it quotes in the
   report), then reads the list, and reports every `⚠ overwriting locally-modified file` line and every
   `.ai-factory/refresh-conflicts/` entry the refresh created. Edit the step's source
   (`first-steps.source.json`, step `base-core-status`) and the road prompt in `INSTALL-FOR-AI.md` together
   — the parity test holds the two equal; the only script at `808e806c606` that reads the source is
   `scripts/render-face-facts.mjs` (`git grep -l first-steps.source.json 808e806c606 -- scripts/`), so run
   it with `--write` if its output moves — and re-point the parity test (`first-steps-parity.test.ts:584-592`)
   to assert the new behaviour («the road runs it»), not delete it.
3. **Sweep the road for the same class.** Every line of the road (steps 0-13) and of the install's final
   summaries that hands the person a command for something the agent is allowed to do: list each with
   `file:line`; automate it here if it is the same refresh class, otherwise name it in the PR's
   «Observations» (the decision floors that stay human: merge to main, `npm publish`, a fork choice,
   passwords, money — global CLAUDE.md directive).
4. **Bridge keeps the original.** `bridge_wire_project` snapshots `.claude/settings.local.json` before
   `_bridge_write_env`, settles after, marks it (the `99-finalize.sh:423-431` pattern); a snapshot that
   cannot be kept undoes the write and reports NOT wired (`keep_original_settle`'s contract). A file the
   same run already kept (session settings wrote it first) is not snapshotted twice (`KEPT_ORIGINALS`).
   Test in `tests/install-sh/bridge-guided.test.sh`: an existing `settings.local.json` with a person's
   own key → after wiring, `.ai-factory/before-getff/.claude/settings.local.json.<sha8>` holds the
   original and the person's key is still present.

### §4c Fork discipline (park, don't guess)

> **aif agent — fork discipline (non-negotiable):** On ANY genuine fork or ambiguity (two defensible
> implementations, an undecided design choice, a missing spec detail that changes behaviour) — **do NOT
> pick.** Park it as a question (set the task to `manualReviewRequired` / `blocked_external` with the fork
> stated as «Option A → consequence X / Option B → consequence Y») and **stop that task.** Proceed only on
> the unambiguous parts. Known candidates: (1) step 1 finds step 4 already refreshes → Option A: drop the
> absent branch → one path / Option B: keep it for a partial step-4 failure → two paths. (2) the refresh
> would overwrite a Layer-2 edit → Option A: run anyway, the copy is preserved in `refresh-conflicts/` and
> reported / Option B: skip the refresh when `--dry-run` shows `would-flag` lines → the list stays absent,
> «not done» with the reason.

Recording a fired PARK is not a file write (see /pipeline §5 park-record contract): it lands in the park
payload + the PR's `## Parked questions`, and its correction lands as a separate owner commit — so this
allowlist deliberately names no park-record artefact.

## §4 Acceptance — executable, on the host

- **A1** `first-steps-parity.test.ts` passes with the new assertion and FAILS on the old step-8 text (paste
  the red run against the unmodified source first).
- **A2** `bridge-guided.test.sh` passes with the keep-original case; the same case fails before the fix.
- **A3** live, once (on the PC, heavy): an older-install scratch project, the road walked by a cold agent
  session from `INSTALL-FOR-AI.md` → the final report has NO «you may run» line for the refresh, the base-core
  list is read, and every refresh-conflict is reported. Quote the report lines.

```bash host-verify
npx vitest run packages/core/audit-self/first-steps-parity.test.ts
bash tests/install-sh/bridge-guided.test.sh
node scripts/render-face-facts.mjs --check
SNAPSHOT_MODE=compare bash tests/install-sh/snapshot.sh
node scripts/check-docs-refresh.mjs "$(git merge-base origin/staging HEAD)..HEAD"
bash scripts/run-local-ci-sweep.sh
```

## §5 Out of scope

- What `--refresh` itself delivers (its arms, `install.sh` `do_refresh`), except the bridge writer.
- The one question (step 3) and its parts; the MCP list (`one-button-w2-mcp-list-policy`).
- The passport step's manual placeholder wording in the shipped `sequences` (O1 — parked in
  `one-button-w2-open-forks/parking.md`; it touches the site seam and waits for the operator).

## §6 Falsifiers to write into the PR body

- The road still prints a refresh command for the person → the defect stands.
- The parity test was deleted or loosened to `toBeDefined` → the gate no longer holds the behaviour.
- A refresh started by the road loses a Layer-2 edit with no `refresh-conflicts/` copy and no report line.
- `.claude/settings.local.json` changed by the bridge with no `.ai-factory/before-getff/` copy.
- The same run keeps TWO originals of `settings.local.json` (session settings and bridge both snapshot).

## §7 AI traps — [ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md)

Active traps for this stage: **T2** (walk the road on a real older install, do not reason about it) ·
**T3** (every claim: command + output or `file:line`) · **T4** (the §3.3 sweep covers the whole road, not
step 8 only) · **T19** (own cold review) · **T21** (cold `agents/backward-sweep-auditor.md` on the class
«getff writes into a file the person owns without keeping the original» — every writer into
`.claude/settings*.json`, `.mcp.json`, `package.json`, lint and formatter configs is a candidate).

**T-OBW2R-A (domain):** `setup` does not know `--refresh` — «its flag loop drops it; the installer itself
does» (`first-steps-parity.test.ts:585`). Writing the road step as `bash /tmp/getff/setup --refresh`
silently runs a plain install. The command must name `install.sh`.

## §8 Not verified (at authoring time)

- Whether step 4 (`setup -y`) on an older install already re-delivers `base-core.md` (§3.1 measures it).
- Which older getff version to use as the fixture (the first commit carrying `base-core.md` is not looked up).
- How many other road lines hand the person a command (§3.3 counts them).
