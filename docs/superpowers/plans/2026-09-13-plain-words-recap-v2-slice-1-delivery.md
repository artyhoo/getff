# Plain-words recap v2 — slice 1 delivery (anchor fix, arming, goldens, PR) implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish slice 1 — the D-I anchor fix, the gate's retry bound and cap, a hand-action
arming script that runs from any cwd, the `FULL`-gated installer step, the goldens, and the PR.

**Architecture:** Second half of the slice-1 PR (same branch, same PR). Arming mirrors
`scripts/register-handoff-gate.sh:161-174` — the ONLY env-arming code in the repo — because the
installer has no settings-`env` writer at all (`register_cc_hook`, `setup.d/lib.sh:2189-2239`,
writes `.hooks` only).

**Tech Stack:** bash, `setup.d/*.sh` (`source`d, so `$FULL` is in scope), vitest, `tests/install-sh/`.

**Global Constraints + bash hazards:** see [slice 0](2026-09-13-plain-words-recap-v2-slice-0.md#global-constraints) and [slice 1](2026-09-13-plain-words-recap-v2-slice-1.md), which also holds Tasks 1.1-1.5.

## Tasks

### Task 1.6: D-I — stop the anchor falling back to a tag or a path

Anchor extraction (`:520-542`) ends with a `grep -m1 -F '"type":"user"' … cut -c1-120`, which
happily yields an XML-ish tag or a bare file path as "what the user asked". D-I: reject those
candidates and fall through to `aif_msg_eot_anchor_fallback`.

**Files:**
- Modify: `.claude/hooks/end-of-turn-reminder.sh` (the candidate step at `:520-542`)
- Test: `packages/core/hooks/end-of-turn-reminder.test.ts`

**Interfaces:**
- Consumes / produces: no new names. The last-resort candidate is filtered before use.

- [ ] **Step 1: Write the failing test**

```ts
it('does not use a tag or a bare path as the anchor', async () => {
  for (const first of ['<system-reminder>stuff</system-reminder>', 'src/app/page.tsx', 'notes.md']) {
    const res = await buildCase({ text: 'x'.repeat(700) + '\n\n## H\n- b\n',
      transcript: [{ type: 'user', message: { content: first } }], env: { AIF_HOOK_LANG: 'en' } });
    expect(res.stdout).not.toContain(first);
  }
});
```

Use the test file's existing transcript-writing helper rather than inventing a field name —
grep `buildCase` for how earlier anchor tests seed a transcript, and match it exactly.

- [ ] **Step 2: Run and watch it fail**

Run: `pc-run npx vitest run packages/core/hooks/end-of-turn-reminder.test.ts -t 'anchor'`
Expected: FAIL on all three candidates.

- [ ] **Step 3: Filter the candidate**

Immediately after the candidate is cut to 120 chars and before it is accepted:

```bash
# D-I: a tag, a path, or a bare filename is not "what the user asked". Reject and let the
# language pack's fallback speak instead. A candidate with a space is prose and survives.
case "$_cand" in
  '<'*)   _cand="" ;;
  *' '*)  : ;;
  */*)    _cand="" ;;
  *.*)    _cand="" ;;
esac
```

Order is the whole design: the space arm sits BEFORE the path and dot arms so «fix src/app.tsx
please» stays an anchor while a bare `src/app/page.tsx` does not.

- [ ] **Step 4: Run the test and the suite**

```bash
pc-run npx vitest run packages/core/hooks/end-of-turn-reminder.test.ts
```
Expected: the anchor test green; fixture 9 unchanged from Task 1.4's state (the goldens carry no
tag/path anchor, so this fix must move nothing). If a second golden case turns red here, the
filter is too broad — tighten it, do not re-capture.

- [ ] **Step 5: Commit**

```bash
git add .claude/hooks/end-of-turn-reminder.sh packages/core/hooks/end-of-turn-reminder.test.ts
git commit -m "fix(eot): reject a tag or a bare path as the turn anchor (D-I)"

### Task 1.6b: The gate's own retry bound, and the cap on the retelling part

Two seams the spec names that Tasks 1.1-1.6 do not yet cover:

- **«same malformed block twice → silent exit»** (spec «Testing seams», R-16 «+ sha retry
  bound»). The ZCode dense arm (`:679-732`) dispatches no `stop_hook_active` — live-measured
  2026-09-10 — and CC's harness-side 8-block cap does not exist there, so a gate that re-blocks
  identical text blocks forever. The gate owns its bound, exactly as that arm does.
- **«cap on the retelling part only»** — `AIF_EOT_RECAP_MAX_LINES` (default 15), with the fork
  card explicitly exempt (D-A: fork cards are never capped).

**Files:**
- Modify: `.claude/hooks/end-of-turn-reminder.sh` (`_eot_recap_defects()` and the gate block from
  Task 1.5)
- Modify: `.claude/hooks/lang/en.sh`, `.claude/hooks/lang/ru.sh` (`AIF_EOT_CAP_LABEL`)
- Test: `packages/core/hooks/end-of-turn-reminder.test.ts`

**Interfaces:**
- Produces: `_eot_recap_line_count <block>` — echoes the number of non-empty lines of the block
  EXCLUDING the fork-card region. `AIF_EOT_CAP_LABEL` — the defect label naming the cap.
- Consumes: `_residue_sha256` (defined at `:60-66`, with the guarded-lib fallback) and
  `$session_id`.

- [ ] **Step 1: Write the failing tests**

```ts
it('blocks a malformed block once, then exits silently on the identical block', async () => {
  const text = `## 🟢 In plain words\n**Where we are.** Done.\n\nShall I proceed?`;
  const env = { AIF_HOOK_LANG: 'en', AIF_RECAP_GATE: '1' };
  const first = await buildCase({ text, env, sessionId: 'retry-bound' });
  expect(first.stdout).toContain('Fork.');
  const second = await buildCase({ text, env, sessionId: 'retry-bound' });
  expect(second.stdout).not.toContain('Fork.');
});

it('caps the retelling part but never the fork card', async () => {
  const filler = Array.from({ length: 20 }, (_, i) => `line ${i}`).join('\n');
  const env = { AIF_HOOK_LANG: 'en', AIF_RECAP_GATE: '1' };
  const long = await buildCase({
    text: `## 🟢 In plain words\n**Where we are.** ok\n${filler}\n**Next.** Me: x. From you: nothing (wc -l)`,
    env, sessionId: 'cap-long',
  });
  expect(JSON.parse(long.stdout).reason).toContain('15');

  const card = await buildCase({
    text: `## 🟢 In plain words\n**Where we are.** ok\n**Fork.**\n${filler}\n**Next.** Me: x. From you: decide: A or B`,
    env, sessionId: 'cap-card',
  });
  expect(card.stdout).not.toContain('15');   // the card's 20 lines do not count
});
```

`sessionId` must be whatever key `buildCase` already uses to seed `session_id` — read the helper
and match it. The retry-bound test is worthless if the two calls land in different sessions, and
it would pass for the wrong reason.

- [ ] **Step 2: Run and watch them fail**

Run: `pc-run npx vitest run packages/core/hooks/end-of-turn-reminder.test.ts -t 'retry-bound|caps the retelling'`
Expected: the retry-bound test fails on its second call (the gate re-blocks), and the cap test
fails on the first case (no cap defect exists yet).

- [ ] **Step 3: Add the cap check**

Define next to `_eot_recap_defects()`:

```bash
# Non-empty lines of the block, EXCLUDING the fork-card region. D-A: the cap is on the
# retelling, and a fork card is never compressed — capping it would produce exactly the
# bare-question shape the card exists to prevent.
_eot_recap_line_count() {
  awk -v fork="$AIF_EOT_SEC_FORK" -v nxt="$AIF_EOT_SEC_NEXT" -v uns="$AIF_EOT_SEC_UNSURE" '
    index($0, fork)                               { skip = 1; next }
    skip && (index($0, nxt) || index($0, uns))    { skip = 0 }
    skip                                          { next }
    /^[[:space:]]*$/                              { next }
                                                  { n++ }
    END { print n + 0 }
  ' <<<"$1"
}
```

and append to `_eot_recap_defects()`, before its final `printf`:

```bash
  local cap count
  cap="${AIF_EOT_RECAP_MAX_LINES:-15}"
  count="$(_eot_recap_line_count "$block")"
  if [ "$count" -gt "$cap" ]; then d="$d; $AIF_EOT_CAP_LABEL $cap"; fi
```

The cap is read from the ENV with a literal default and is deliberately absent from the language
packs: packs are sourced AFTER the environment, so a pack assignment would clobber an operator's
override and the cap would silently stop being tunable.

Add the label to both packs — `AIF_EOT_CAP_LABEL='длиннее лимита строк:'` (ru) and
`AIF_EOT_CAP_LABEL='longer than the line cap:'` (en). The `^AIF_EOT_` probe in
`check-parity.sh:26-33` covers it with no probe change.

- [ ] **Step 4: Add the retry bound to the gate block**

Inside the Task 1.5 gate block, after `_recap_defects` is computed and non-empty, before
`gate_line` is set:

```bash
      # The gate owns its retry bound. Mirrors the ZCode dense arm (:679-732) and for the
      # same measured reason: a re-stop after decision:block can carry stop_hook_active=false,
      # so an unbounded gate re-blocks identical text forever. Stored sha == current sha →
      # this exact block already got its one block → fall through to the silent exit.
      # An empty sha (no hashing tool, or a failed write) skips BOTH the compare and the
      # store — never "content unchanged" — degrading to today's behaviour: the block fires.
      _rg_key=$(printf '%s' "$session_id" | tr -c 'A-Za-z0-9._-' '_' | cut -c1-96)
      _rg_flag="${TMPDIR:-/tmp}/aif-eot-rgb-${_rg_key}"
      _rg_tmp="${TMPDIR:-/tmp}/aif-eot-rgbt-${_rg_key}-$$"
      _rg_sha=""
      if printf '%s' "$text" > "$_rg_tmp" 2>/dev/null; then
        _rg_sha="$(_residue_sha256 "$_rg_tmp")"
        rm -f "$_rg_tmp" 2>/dev/null || true
      fi
      if [ -n "$_rg_sha" ] && [ -f "$_rg_flag" ] \
         && [ "$(cat "$_rg_flag" 2>/dev/null || true)" = "$_rg_sha" ]; then
        _recap_defects=""
      elif [ -n "$_rg_sha" ]; then
        { printf '%s' "$_rg_sha" > "$_rg_flag"; } 2>/dev/null || true
      fi
```

Use its OWN flag prefix (`aif-eot-rgb-`), not the ZCode arm's `aif-eot-zcb-`: sharing one flag
between two independent bounds makes each able to suppress the other's first block — the
sibling-channel failure paid for in #1644→#1651.

`_residue_sha256` is defined at `.claude/hooks/end-of-turn-reminder.sh:60-66` inside a guard
(`sha256sum`, else `shasum`, else nothing). It is why `_rg_sha` can legitimately be empty, and
why the empty case must skip the store as well as the compare.

Add the new names to the `unset` line that already cleans up the ZCode arm's temporaries, so a
later `set -u` read cannot see a stale value.

- [ ] **Step 5: Run the tests and the suite**

```bash
pc-run npx vitest run packages/core/hooks/end-of-turn-reminder.test.ts
bash .claude/hooks/lang/check-parity.sh
```
Expected: both new tests green, the rest unchanged from Task 1.6's state. If the retry-bound
test now passes but the Task 1.5 armed test went red, the bound is suppressing the FIRST block —
a stale flag from a previous run in the same `TMPDIR`. The fix is a per-test session id, not a
weaker bound.

- [ ] **Step 6: Commit**

```bash
git add .claude/hooks/end-of-turn-reminder.sh .claude/hooks/lang/en.sh .claude/hooks/lang/ru.sh packages/core/hooks/end-of-turn-reminder.test.ts
git commit -m "feat(eot): gate retry bound by block sha, and cap the retelling part only (R-16, R-17)"
```

### Task 1.7: `scripts/register-recap-gate.sh` — the hand action (D-E)

The gate ships dormant; arming is a hand action. D-E requires it to run from ANY cwd, which is
why the repo root is resolved from the script's own path, never from `git rev-parse` of the cwd.

Unlike `register-handoff-gate.sh`, this script registers no hook and never invokes the renderer:
the Stop hook is already registered by `setup.d/10-skills.sh` §1c. Its whole job is that
script's step 3 — the guarded `env` write. Read the original first: `sed -n '1,60p'` for the
resolver and usage contract, `sed -n '155,200p'` for step 3 and its verify assertions.

**Files:**
- Create: `scripts/register-recap-gate.sh`
- Modify: `scripts/register-root-resolution.test.sh:21`

**Interfaces:**
- Produces: a script accepting `--user` (default), `--project [root]`, `--print-root`,
  `--help`. Exit 0 on success or already-armed; non-zero with a `fail` message otherwise.
  `--print-root` writes the resolved root to stdout and exits WITHOUT touching any file — that
  is the contract `register-root-resolution.test.sh` probes.

- [ ] **Step 1: Add the script to the any-cwd sweep first (it will fail)**

```bash
sed -n '15,30p' scripts/register-root-resolution.test.sh
```
Then extend line 21's array:

```bash
SCRIPTS=("$DIR/register-precompact-hook.sh" "$DIR/register-handoff-gate.sh" "$DIR/register-recap-gate.sh")
```

- [ ] **Step 2: Run it and watch it fail**

Run: `bash scripts/register-root-resolution.test.sh`
Expected: FAIL — `register-recap-gate.sh: No such file or directory`.

- [ ] **Step 3: Write the script**

Copy `scripts/register-handoff-gate.sh` as the skeleton and keep, byte-for-byte: the shebang,
`set -euo pipefail`, the `fail()` helper, the whole root-resolver block, and the `--print-root`
early exit. Then replace the body with:

```bash
# ── Arm: AIF_RECAP_GATE=1 in the TARGET settings.json env block (spec R-15) ───
# The recap gate ships DORMANT: the instruction text lands unconditionally, the REJECTION
# only here. `env` is not renderer-owned (drift-test P3 — foreign keys are byte-preserved),
# so a guarded in-place jq edit is the sanctioned channel: backup, jq into a TEMP file,
# `jq -e .` validate, atomic mv. A malformed settings.json silently disables EVERY setting
# in that file, which is why nothing is written until the temp validates.
if [[ "$(jq -r '.env.AIF_RECAP_GATE // empty' "$ARM_SETTINGS")" == "1" ]]; then
  echo "arm:      AIF_RECAP_GATE=1 already set in $ARM_SETTINGS — nothing to do"
else
  cp "$ARM_SETTINGS" "$ARM_SETTINGS.bak" || fail "could not back up $ARM_SETTINGS"
  tmp="$(mktemp)"
  jq '.env = ((.env // {}) + {AIF_RECAP_GATE: "1"})' "$ARM_SETTINGS" > "$tmp" \
    || fail "jq edit failed — $ARM_SETTINGS untouched, backup at $ARM_SETTINGS.bak"
  jq -e . "$tmp" >/dev/null || fail "jq produced invalid JSON — $ARM_SETTINGS untouched"
  mv "$tmp" "$ARM_SETTINGS" || fail "could not write $ARM_SETTINGS"
  echo "arm:      AIF_RECAP_GATE=1 ARMED in $ARM_SETTINGS (backup: $ARM_SETTINGS.bak)"
fi

# ── Verify — two independent assertions, read back from disk ─────────────────
rc=0
[[ "$(jq -r '.env.AIF_RECAP_GATE // empty' "$ARM_SETTINGS")" == "1" ]] \
  || { echo "verify:   ✗ AIF_RECAP_GATE not readable back from $ARM_SETTINGS"; rc=1; }
grep -q 'AIF_RECAP_GATE' "$ROOT/.claude/hooks/end-of-turn-reminder.sh" \
  || { echo "verify:   ✗ the Stop hook in $ROOT does not read AIF_RECAP_GATE — arming a hook that ignores it"; rc=1; }
[ "$rc" -eq 0 ] && echo "verify:   ✓ armed and the hook reads the flag"
exit "$rc"
```

The second assertion is the point of the verify block: arming a flag no shipped hook reads is
the `#hope-as-gate` failure ([attention-is-not-a-mechanism.md §2](../../../.claude/rules/attention-is-not-a-mechanism.md)),
and it is exactly what a stale consumer install produces.

Keep the header's `WHICH settings.json` paragraph verbatim: the user-file default, its cost (a
user-level arm reaches every repo on the machine) and the 2026-09-13 measurement behind it — a
worktree session reads the WORKTREE's project settings, so 0 of 100+ worktrees were ever armed —
apply to this gate identically.

- [ ] **Step 4: Run the sweep and a dry probe**

```bash
chmod +x scripts/register-recap-gate.sh
bash scripts/register-root-resolution.test.sh
( cd / && bash "$PWD/scripts/register-recap-gate.sh" --print-root )
bash scripts/register-recap-gate.sh --help
```
Expected: sweep green; `--print-root` prints the repo root from cwd `/` and writes nothing;
`--help` exits 0. Do NOT run it without `--print-root` — that writes `~/.claude/settings.json`,
the operator's file and their hand action, not yours.

- [ ] **Step 5: Commit**

```bash
git add scripts/register-recap-gate.sh scripts/register-root-resolution.test.sh
git commit -m "feat(scripts): hand action to arm AIF_RECAP_GATE from any cwd (D-E, R-15)"
```

### Task 1.8: Installer arms it under `--full`, and an arm that proves it

`setup.d/10-skills.sh` §1c ships the hook but has no way to write settings `env` —
`register_cc_hook` (`setup.d/lib.sh:2189-2239`) writes `.hooks` only. Mirror the
`register-handoff-gate.sh` shape as a `FULL`-gated step. `--full` is orthogonal to
`--profile`, and `setup.d/*.sh` are `source`d, so `$FULL` is in scope.

**Files:**
- Modify: `setup.d/10-skills.sh` (inside the §1c `if [ -f "$EOT_SRC" ]` block, after
  `register_cc_hook`)
- Modify: `tests/install-sh/gh-934-ship-eot-hook.test.sh` (arm G)

**Interfaces:**
- Consumes: `$FULL`, `$SETTINGS`, `$DRY_RUN` from the installer scope.
- Produces: `.env.AIF_RECAP_GATE == "1"` in the consumer's `.claude/settings.json` after a
  `--full` install, and NOT after a plain one.

- [ ] **Step 1: Add arm G to the test first**

Append to `tests/install-sh/gh-934-ship-eot-hook.test.sh`, and extend the ARMS comment block at
the top with the `(G)` line:

```bash
# ── (G) --full arms the recap gate; a plain install leaves it dormant ─────────
[ "$(jq -r '.env.AIF_RECAP_GATE // empty' "$T/.claude/settings.json")" = "" ] \
  && ok "G1 plain install leaves AIF_RECAP_GATE unset (gate ships dormant)" \
  || bad "G1 plain install armed the gate — R-15 says the rejection ships dormant"

TF=$(mktemp -d)
( cd "$TF" && git init -q && git config user.email t@t && git config user.name t \
    && printf '{"name":"g934f","version":"0.0.0"}\n' > package.json \
    && git add -A && git commit -q -m base \
    && bash "$REPO_ROOT/install.sh" ts-server --force --full ) >"$TF/.log" 2>&1
echo "EXIT=$?" >> "$TF/.log"

[ "$(jq -r '.env.AIF_RECAP_GATE // empty' "$TF/.claude/settings.json")" = "1" ] \
  && ok "G2 --full arms AIF_RECAP_GATE=1" \
  || bad "G2 --full did not arm the gate (see $TF/.log)"
jq -e '.hooks.Stop' "$TF/.claude/settings.json" >/dev/null \
  && ok "G3 --full install still registers the Stop hook (the env write did not clobber .hooks)" \
  || bad "G3 --full install lost the Stop hook registration"
rm -rf "$TF"
```

G3 is not padding: the risk of a second writer on one JSON file is that it clobbers the other's
key, and G1+G2 would both pass on a script that wrote `{"env":{…}}` over everything. The
`echo "EXIT=$?"` line is the background-exit-code discipline — a `( … ) > log` whose status is
never read reports a failed install as a silent empty settings file.

- [ ] **Step 2: Run it and watch G2 fail**

Run: `bash tests/install-sh/gh-934-ship-eot-hook.test.sh`
Expected: A-F green, G1 green (nothing arms it yet), G2 RED, G3 green.

- [ ] **Step 3: Add the installer step**

Inside §1c, in the `else` branch that already runs `register_cc_hook`, immediately after it:

```bash
    # R-15: the recap-gate REJECTION ships dormant. `--full` is the developer-install axis
    # (orthogonal to --profile), so a full install arms it; a plain install does not. The
    # installer has no settings-`env` writer — register_cc_hook (lib.sh) writes .hooks only —
    # so this mirrors scripts/register-handoff-gate.sh:161-174: temp file, `jq -e .` validate,
    # atomic mv, skip when already set. Never write the target in place: a malformed
    # settings.json silently disables EVERY setting in it.
    if [ "$FULL" = "--full" ] && command -v jq >/dev/null 2>&1; then
      if [ "$(jq -r '.env.AIF_RECAP_GATE // empty' "$SETTINGS" 2>/dev/null)" = "1" ]; then
        echo "  AIF_RECAP_GATE already armed"
      else
        _rg_tmp="$(mktemp)"
        if jq '.env = ((.env // {}) + {AIF_RECAP_GATE: "1"})' "$SETTINGS" > "$_rg_tmp" 2>/dev/null \
           && jq -e . "$_rg_tmp" >/dev/null 2>&1; then
          mv "$_rg_tmp" "$SETTINGS" && echo "  AIF_RECAP_GATE=1 armed (--full)"
        else
          rm -f "$_rg_tmp"; echo "  ⚠ could not arm AIF_RECAP_GATE — $SETTINGS left untouched"
        fi
      fi
    fi
```

Check `$FULL`'s real spelling before writing this — `grep -n 'FULL=' install.sh` — and match it
exactly. A `[ "$FULL" = "--full" ]` against a variable that actually holds `1` is a silently
dead branch, and arm G is what catches it.

The `$DRY_RUN` guard comes from the enclosing `else` — confirm by reading the block, do not assume.

- [ ] **Step 4: Run arm G and the install-sh baselines**

```bash
bash tests/install-sh/gh-934-ship-eot-hook.test.sh
SNAPSHOT_MODE=compare bash tests/install-sh/snapshot.sh
```
Expected: all G arms green; the snapshot COMPARE green with no capture. `snapshot.sh` never
invokes `--full` (always `bash "$REPO_ROOT/install.sh" "$stack" --force`), so a FULL-gated write
cannot move a baseline. If it drifts anyway something outside the `--full` branch changed —
investigate; never reach for `SNAPSHOT_MODE=capture` to make red go away.

- [ ] **Step 5: Commit**

```bash
git add setup.d/10-skills.sh tests/install-sh/gh-934-ship-eot-hook.test.sh
git commit -m "feat(install): --full arms AIF_RECAP_GATE; plain install stays dormant (R-15)"
```

### Task 1.9: Goldens — re-capture exactly one case, keep the paired negative

`packages/core/hooks/__fixtures__/gate-unarmed-goldens.json` holds 17 cases and its `_comment`
says «Do not regenerate against an edited hook», while the spec says the goldens are regenerated
ONCE. Both hold if you re-capture ONLY `f11-long-text-in-band` — the single case carrying a
branch payload (measured: textlen 649, stdout 2313; the other 16 are 362-byte context-line or
empty outputs) — by running the **pre-change (staging) hook against the NEW lang packs**, so the
recorded bytes are still a pre-change hook's output.

**Files:**
- Modify: `packages/core/hooks/__fixtures__/gate-unarmed-goldens.json` (one case)
- Modify: `packages/core/hooks/end-of-turn-reminder.test.ts` (`buildCase` env pinning)

**Interfaces:**
- Consumes: the Task 1.2-1.5 hook and packs.
- Produces: fixture 9 (the paired negative over all 17 cases) green again.

- [ ] **Step 1: Pin `AIF_RECAP_GATE` out of the test environment**

`buildCase()` already does `delete env.CLAUDE_CODE_AUTO_COMPACT_WINDOW` and
`delete env.AIF_HANDOFF_GATE`. Add the sibling:

```ts
delete env.AIF_RECAP_GATE;
```

The sibling-channel lesson paid for in #1644→#1651: a developer machine that armed the gate by
hand would make every unarmed-golden case produce ARMED output, turning the suite red for a
reason unrelated to the diff. Pin every input the sibling can move.

- [ ] **Step 2: Re-capture f11 against the PRE-change hook**

```bash
git show origin/staging:.claude/hooks/end-of-turn-reminder.sh > /tmp/eot-staging.sh
```
Run that staging hook with the NEW `.claude/hooks/lang/` packs on f11's recorded stdin, and
replace ONLY that case's expected stdout in the fixture. Derive f11's stdin from the fixture
itself — it records the case inputs — rather than hand-building a transcript.

Then add a line to the fixture's `_comment` recording what happened:

```text
f11-long-text-in-band re-captured 2026-09-13 (recap-v2 slice 1): the branch payload text
changed by design (D-A/D-B). Captured from the PRE-change hook (origin/staging 4fa5dc14d6d)
against the new lang packs, so the paired negative still compares an unedited hook. The other
16 cases are untouched.
```

- [ ] **Step 3: Run the whole suite**

```bash
pc-run npx vitest run packages/core/hooks/end-of-turn-reminder.test.ts
```
Expected: green, fixture 9 included (60s timeout — all 17 cases, twice). If a case OTHER than
f11 is still red, stop: the change leaked outside the branch payloads, and re-capturing that case
would destroy the negative rather than update it.

- [ ] **Step 4: Commit**

```bash
git add packages/core/hooks/__fixtures__/gate-unarmed-goldens.json packages/core/hooks/end-of-turn-reminder.test.ts
git commit -m "test(eot): re-capture only the branch-payload golden; pin AIF_RECAP_GATE out of the env"
```

### Task 1.10: Twins, SSOT row, PR

**Files:**
- Modify: `docs/meta-factory/prior-art-evaluations.md` (new row)
- Generated: `plugin/hooks/*` (by pre-commit — never hand-edited)

- [ ] **Step 1: Add the SSOT row in the same commit as the capability artefact**

Append a row in the file's own format (read the last existing row and match it exactly — the ID
is sequential and `prior-art-evaluations.md §3` is append-only):

- **Capability area:** decision-request format — how an agent asks a human to decide.
- **Candidates surfaced (context7, ≥3 phrasings):** run them at authoring time and cite what came
  back; phrasings: «structured decision request format agent», «human-in-the-loop approval
  prompt schema», «LLM clarifying question template library».
- **Verdict:** BUILD.
- **Rationale:** the card is coupled to THIS harness's channels — a Stop hook's `reason` reaches
  the model while `systemMessage` reaches only the user, and the fork card must render inside
  both that payload and a PreToolUse `permissionDecisionReason`. No surveyed library emits into
  either.
- **Trigger to revisit:** a harness-native structured-decision payload (a first-class fork/card
  type in the hook contract), or a library that renders to both channels.

Check the size gate before committing: `wc -l docs/meta-factory/prior-art-evaluations.md`.

- [ ] **Step 2: Commit with the trailer**

```bash
git add docs/meta-factory/prior-art-evaluations.md
git commit -m "docs(ssot): decision-request format — BUILD" -m "Prior-art: prior-art-evaluations.md#<new ID> (decision-request format, verdict BUILD — the card renders into a Stop hook reason and a PreToolUse permissionDecisionReason; no surveyed library emits into either)."
```

No other commit in this slice owes a positive trailer: the triggers are a new explicit
dependency (none), ≥50 LOC under a NEW `packages/core/<dir>/` (none), or ≥80 LOC anywhere under
`packages/` — and the only `packages/` files touched are `*.test.ts` and a `__fixtures__/` file,
both carved out as test material. `.claude/hooks/`, `scripts/`, `setup.d/` and `tests/` are
outside all three. If the pre-push hook disagrees it is authoritative: add the escape hatch with
a ≥20-char reason rather than inventing a referent.

- [ ] **Step 3: Let pre-commit regenerate the twins, then verify**

```bash
git status --short plugin/hooks/
git diff --stat origin/staging.. -- plugin/hooks/
```
Expected: `plugin/hooks/end-of-turn-reminder.sh` and the `lang/` twins moved and match
`.claude/hooks/` byte-for-byte. A twin UNCHANGED while its source moved means the pre-commit
twin-sync did not run — do not hand-copy; re-commit so the hook fires.

- [ ] **Step 4: Full local gate sweep before pushing**

```bash
bash .claude/hooks/lang/check-parity.sh
bash tests/install-sh/gh-934-ship-eot-hook.test.sh
SNAPSHOT_MODE=compare bash tests/install-sh/snapshot.sh
bash scripts/register-root-resolution.test.sh
pc-run npx vitest run packages/core/hooks/
```
Expected: all green. Red here is cheaper than red in CI.

- [ ] **Step 5: Push and open the PR**

```bash
git push -u origin claude/plain-words-recap-v2-exec
```

PR body requirements:

- `## Fidelity verdict` — what shipped live vs dormant, and the operator's hand action to arm it.
- **§1.7 Forward-check** — slice 1 edits discipline-bearing hook TEXT: sweep every other surface
  that teaches the recap shape and cite each with `path.ext:NN` — the `/story` skill, any
  `.claude/rules/` or `session-bootstrap` text on end-of-turn behaviour, the shipped
  `packages/core/templates/` copies, the plugin twins. Each: updated, or exempt with a reason.
- **§1.7 Backward-check** — each claim the change relies on, with the `path.ext:NN` proving it
  still holds: `setup.d/lib.sh:2189-2239` (writes `.hooks` only),
  `scripts/register-handoff-gate.sh:161-174` (the mirrored shape),
  `.claude/hooks/lang/check-parity.sh:26-33` (the `AIF_EOT_` probe),
  `.claude/hooks/end-of-turn-reminder.sh` marker-guard comment (position unchanged).
- Note explicitly that the goldens moved by exactly one case and why the paired negative
  survives.

- [ ] **Step 6: Wait for CI, then merge**

```bash
~/.claude/scripts/ci-wait.sh <PR> --repo artyhoo/getff
```

Before trusting green: `gh pr view <PR> --json mergeable,mergeStateStatus,statusCheckRollup` —
a CONFLICTING PR runs no `pull_request` workflow at all and still reports GREEN from third-party
app checks, and a just-pushed head can serve the PREVIOUS sha's checks. Confirm the repo's own CI
job is in the rollup and that `headRefOid` matches what you pushed. Then
`gh pr merge --squash` (base=staging is agent-allowed).
