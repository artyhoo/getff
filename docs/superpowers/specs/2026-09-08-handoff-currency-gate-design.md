# Handoff-currency gate — the Stop hook blocks the turn until the handoff is current (D13)

> **Authoritative for:** the design of the handoff-currency gate — the three questions the
> parent spec's D13 commissioned (floor, writer, payload) plus the carried-forward inputs
> (D4, D6, D10, D11), settled here with falsifiers; the testing seams; the kickoff contract.
> **NOT authoritative for:** bounded compaction and the `AIF_CTX_WINDOW` pair — see
> [2026-09-08-dynamic-context-window-design.md](2026-09-08-dynamic-context-window-design.md)
> (the parent; its prior-art pass and verified facts are NOT re-derived here); the D7 context
> arm's floors — `.claude/hooks/end-of-turn-reminder.sh:332-337` (D9 calibration owns the
> numbers); project goal — [README.md#why-this-exists](../../../README.md#why-this-exists).
> **Rigor label (L0, effort-worthiness §2):** `research-grade` — the touched Stop hook is
> consumer-shipped (`plugin/hooks/end-of-turn-reminder` twin + install.sh delivery). The
> research half was paid in the parent spec (seven systems + arXiv 2606.22528, two cold
> rounds); this round pays the design half. The gate itself ships DORMANT for consumers (D18).
> **Status:** REVIEWED — one round of two cold seats (top-down + bottom-up, both `REVISE`), every
> finding disposed of in §Changelog. Ready for the kickoff. Live decision register below.

## Context

The parent contour ended with one surviving proposal. From a context floor, the Stop hook
blocks the turn until the session's handoff has changed by CONTENT (never mtime), with an
escape token `mechanical-tail: <rationale ≥20 chars>`. The parent's prior-art pass found that
the enforcement half has no precedent across Codex, Amp, Cline, Cursor, Windsurf, Aider, Roo
and the Anthropic context-editing API — every one of them prompts for the handoff and none
gates it. Codex ships a `Stop` hook with `decision: "block"` and wires it to nothing.

Three questions were deliberately kept OUT of implementation, and this spec settles them:

- **(a) the floor** — 300000 is now the compaction point, not the degradation warning;
- **(b) the writer** — `precompact-residue.sh` truncates the whole file on every write;
- **(c) the payload** — the compaction summary already keeps intent, files, errors and pending
  tasks; only intermediate reasoning and rejected alternatives are lost.

### Verified facts, this round (2026-09-08)

| Fact | Evidence | Consequence |
|---|---|---|
| The Stop hook exits before ANY work when `stop_hook_active` is true | `.claude/hooks/end-of-turn-reminder.sh:35-38` (`35` assignment, `36-38` the `if … exit 0; fi`) | the gate cannot loop — and this exit is why the mechanism is one prompt per turn, not a gate a session cannot pass (see the honest-claim paragraph under Decision) |
| The D7 arm computes `ctx_tokens` from the last main-thread assistant usage, then floors from a window cascade | `end-of-turn-reminder.sh:284-287` (estimator), `:288` (`if [ -n "$ctx_entry" ]` — the block ALL of it lives in), `:297-315` (window), `:332-337` (floors), `:350` (the prose `ctx_line`) | the gate reuses `ctx_tokens` and `ctx_soft` and MUST be nested inside the same `ctx_entry` block: under `set -euo pipefail` (`:9`) a bare `ctx_tokens` reference outside it aborts the hook on any turn with no usage record (D31) |
| Three sites build the block payload, and only ONE of them is `_autonomy_exit` | `end-of-turn-reminder.sh:134-148` (`_autonomy_exit`), `:476-481` (ZCode dense block), `:694-702` (bottom CC block); the latter two hand-append `autonomy_line`/`ctx_line` at `:466-471` and `:688-693`; F10 postmortem at `:51-62` | the gate line must be appended at all three, exactly as `ctx_line` is (D30). Appending it only in `_autonomy_exit` makes the gate silent on every recap turn |
| The hook extracts the turn's final assistant text as `text` | `end-of-turn-reminder.sh:414`; `last_line` at `:403`; silent exits between the D7 arm and it at `:405` and `:426` | the escape token cannot be read at the D7 position — D30 splits the arm rather than moving it |
| `session_id` persists across compaction | five transcripts under `~/.claude/projects/` carrying 17 / 16 / 3 / 2 / 1 `compact_boundary` records; each carries exactly ONE distinct `sessionId` (grep, 2026-09-08 — the counts differ from an earlier draft's sample, the invariant does not) | parent note N4 closed: a per-session key survives compaction, so the handoff file and the gate's baseline both key on `session_key` |
| `.claude/hooks/lib/` exists and has ONE member, sourced by the PostToolUse gates behind a loud-SKIP guard | `.claude/hooks/lib/hook-emit.sh`; the guard shape at `.claude/hooks/check-doc-authority.sh:40-48` (`if ! . "$_HOOK_LIB" 2>/dev/null; then <announce SKIP>; exit 0; fi`); twin at `plugin/hooks/lib/hook-emit.sh` | the shared-lib home exists and the guard shape is precedent, not invention (D29) — but grep finds NO `hooks/lib` copy step in `install.sh` or `setup.d/*.sh`, so delivery is a real gap |
| A portable sha256 helper already exists in this hook family | `.claude/hooks/deps-hash-check.sh:97-104` — `sha256sum` → `shasum -a 256` two-branch fallback | D19 uses that shape; stock macOS has no `sha256sum`, so a bare call would make the gate inert on the operator's own machine |
| Hook registration is rendered from a tracked SSOT | `.ai-factory/harness-model.json` (tracked; `hooks` keys incl. `PreCompact`, `SessionStart`); `scripts/render-harness-config.mjs:148` owns ONLY `hooks` in settings.json; drift gate `packages/core/hooks/harness-config-drift.test.ts` | a new hook is an SSOT edit + `--write`; but settings.json stays agent-uncommittable (deny-list `:56-57`), so the render is landed by the operator — the durable recipe precedent is `scripts/register-precompact-hook.sh` (PR #1443, 122 LOC) |
| `runtime-bridge-dispatch.sh` fires on EVERY Write whose first line is `<!-- bridge: auto -->` | `.claude/hooks/runtime-bridge-dispatch.sh:126-130`; registered in `harness-model.json` PostToolUse | the kickoff must NOT carry `bridge: auto` — it would dispatch from the worktree before staging (kickoff-staging-placement §5.1) |
| `fidelity-verdict-in-pr-body` is a REQUIRED check on `staging` | `gh api repos/artyhoo/getff/branches/staging/protection/required_status_checks` → `ci-success, fidelity-verdict-in-pr-body, stale-revert-in-pr-diff` | the /arch «plan-complete → marker» exception is ACTIVE; D27 decides whether to use it |
| `end-of-turn-reminder.sh` carries no `@plugin-transform` marker | grep, 2026-09-08 | the plugin twin is a byte-identical copy regenerated by pre-commit; nothing in the arm may reference a framework-only path (consumer-generic prose, as the D7 arm already does) |
| The residue writer resolves its directory ONE way and the Stop hook does not know it | `precompact-residue.sh:133-154` (`AIF_RESIDUE_DIR` → `print-orch-home.sh` → inline fallback) | the gate needs the same resolution; it moves to `.claude/hooks/lib/residue-dir.sh`, loaded behind the loud-SKIP guard, with delivery added to both by-name manifests (D29) |
| `ctx_line` prose is hard-coded English, outside the lang packs | `end-of-turn-reminder.sh:350`; packs at `.claude/hooks/lang/{en,ru}.sh`, parity via `lang/check-parity.sh` + `packages/core/hooks/lang-parity.test.ts` | the gate's message goes through the packs (D22); the existing `ctx_line` inconsistency is recorded as an observation, not fixed here |
| Live executor profiles | `GET /runtime-profiles`: `Claude Opus (plan+review)`, `Z.AI GLM-5.3 SDK`, `Qwen3.8-Max-Preview`, `Z.AI GLM-5.3 Flash (implementer)` | D27 marker value, if any, must match exactly one row |

## Decision

One mechanism, four hook files, one hand-action.

1. **The gate** — a new arm in `.claude/hooks/end-of-turn-reminder.sh`, computed with the D7
   arm and appended at all three emit sites (D30). Armed only under `AIF_HANDOFF_GATE=1`. From
   the gate floor (D14) to compaction, a turn that would end with a handoff unchanged since the
   gate last accepted it (D19) is blocked once, with a `reason` that names the file, the
   required sections, and the escape grammar. The escape token (D17) clears the line once the
   turn's final text is available.

   **What this is, stated honestly (round-1 M3).** `end-of-turn-reminder.sh:35-38` exits 0
   unconditionally when `stop_hook_active` is true, and this design keeps that exit — it is the
   loop guard, and removing it would let a hook spin. So the mechanism is **one un-ignorable
   prompt per turn, re-fired on every subsequent turn**, not a turn-completion gate a session
   cannot pass. A model handed back its turn can stop again without writing, and that stop
   succeeds. What it cannot do is escape the next turn's block, or the one after, because the
   baseline only advances on an ALLOWED normal Stop (D19). Against the prose arm it replaces
   this is a real channel change — the prose fires once per session per tier and is debounced
   away; this fires every turn until the handoff moves. Against `attention-is-not-a-mechanism.md
   §1` it is honestly form (b)-adjacent, not form (a): the SSOT row and the parent spec's
   "turn completion conditional" wording are corrected to match (D24).
2. **The handoff file** — `<residue_dir>/_handoff-<session_key>.md`, model-authored, one
   owner. The PreCompact writer never touches it; it adds ONE pointer line to the residue (D15).
   Its required sections are the payload that compaction drops (D16).
3. **The injection pipe** — a new SessionStart hook on `source == "compact"` that injects the
   handoff file (and the residue pointer) as `additionalContext`. Built WITH the gate because now
   there is a payload worth injecting; operator-axis only (D20).
4. **The hand-action** — one settings block for the operator: the SessionStart registration
   (rendered from the SSOT) plus `AIF_HANDOFF_GATE=1` in the `env` block, bundled with the
   parent's pair (D11 carried).

### Live decision register

| Decision | Status | Resolution | Falsifier |
|---|---|---|---|
| D14 — where the floor sits (question a) | author-decided | `gate_floor = min(ctx_soft, compaction_point × AIF_HANDOFF_BAND_PCT / 100)`, default `AIF_HANDOFF_BAND_PCT=67`. `compaction_point` resolves DECLARED-env `CLAUDE_CODE_AUTO_COMPACT_WINDOW` → `autoCompactWindow` in `$CLAUDE_PROJECT_DIR/.claude/settings.json` (jq; the hook already requires jq) → absent. With the parent's pair: `min(300000, 300000×0.67) = 201000` — operator premise 2's «~200k». Without a declared compaction point: `gate_floor = ctx_soft` (300000 on a 1M window), i.e. the gate stands exactly where the prose arm stands today. One derived number, no second absolute — F3 showed what a second absolute does when the compaction point moves | Wrong if the band (~100k) proves too wide — many turns of immaterial refresh — or too narrow — a tool-heavy turn skips from below the floor straight past compaction. Both are visible in the D26 live run; the pct is config, not statute |
| D15 — the writer (question b) | author-decided | **Sibling file, not read-merge-write.** The model-authored handoff lives at `<residue_dir>/_handoff-<session_key>.md`; `_residue-<session_key>.md` keeps its single writer. `precompact-residue.sh` gains ONE line — `- **Model handoff:** <path> (<present, N lines, sha256 short> \| absent)` — and no other change. Question (b) dissolves: the writer stops truncating a model-authored section by never owning one. This is the branch D6's own falsifier named («one file with two writers races → split into sibling files»), chosen up front rather than after the race | Wrong if a reader is misled by a handoff older than the residue — the pointer line carries the sha and line count at compaction time, so staleness is visible, not silent |
| D29 — how the gate resolves the residue directory (round-1 B1) | author-decided | **Guarded source with an inline fallback, plus explicit delivery.** The cascade (`AIF_RESIDUE_DIR` → `print-orch-home.sh` → inline default) moves to `.claude/hooks/lib/residue-dir.sh`; both hooks load it as `[ -f "$_lib" ] && . "$_lib"`, each keeping its own inline fallback — the exact shape `end-of-turn-reminder.sh:27-29` already uses for the lang pack. An unconditional `.` would abort the Stop hook on EVERY turn under `set -euo pipefail` (`:9`) in any project where the lib is missing. Delivery is NOT automatic: `install.sh:938-949` and `setup.d/10-skills.sh:233-243` enumerate the hook and its `lang/` packs BY NAME, and `plugin/hooks/` is a flat list — so both manifests gain a `lib/residue-dir.sh` copy step in the same PR, and the file inventory names them | Wrong if the guarded-source shape still changes unarmed output — the D18 paired negative catches it, because it snapshots the pre-change hook's output on every fixture. Wrong if `plugin/hooks/lib/` has no loader path — then the twin's arm uses the inline fallback only, and D23 records the divergence |
| D30 — where the arm sits and when the escape token is read (round-1 M1, M2) | author-decided | **Two positions, one line.** (i) `gate_line` is computed WITH the D7 arm (after `:315`), because that is where `ctx_tokens`, `ctx_window` and `ctx_key` exist and it precedes every early return. (ii) The escape token can only be read from `text` (`:414`), ~100 lines later, so the token check CLEARS `gate_line` there rather than gating its computation. Consequence, deliberate and stated: on the three paths that return before `:414` — no transcript, no last assistant line, tool-only turn — the token is unreadable and the gate blocks. That is the correct side to fail on: a tool-only turn in the band with a stale handoff is the F10 shape (`autonomous-loop-continuity.md §1`). (iii) `gate_line` is appended at ALL THREE emit sites, exactly as `ctx_line` already is: `_autonomy_exit` (`:134-148`), the ZCode dense block (`:476-481`), the bottom CC block (`:694-702`). Appending it only in `_autonomy_exit` would make the gate silent on `long_text=true` turns — the substantive ones it exists for, and the same shadowing class as the F10 postmortem at `:51-62` | Wrong if a `long_text=true` fixture in the band with a stale handoff produces no gate text — D25 fixture 11 is exactly that case, and it is the regression guard for this row |
| D16 — the payload (question c) | author-decided | Required H2 headings, fixed strings, checked by presence AND non-emptiness (≥1 non-whitespace line under each): `## Decisions and why` · `## Rejected alternatives` · `## Unverified assumptions and open forks` · `## Skills to invoke by name` · `## Next action`. Deliberately ABSENT: intent, file list, pending tasks, errors — the compaction summary keeps those (parent F1/F5). `Skills to invoke by name` exists because the skill-descriptions listing is the one thing verified NOT to survive compaction (parent F1 residual): after a compaction skills stop auto-triggering by description. A section may read «none this turn»; it may not be blank | Wrong if a post-compaction continuation still follows a false trail with all five sections present — then the payload is wrong, not the gate; measured by D26 |
| D32 — the file is CURRENT STATE, not a log (round-1 M4) | author-decided | The handoff is rewritten in place each time, capped at `AIF_HANDOFF_MAX_LINES` (default 200). Over the cap the gate blocks with a reason saying to condense, not append. The injector (D20) reads `head -n <cap>` for the same reason `/pipeline` §1 caps its sibling at `head -40`. Without this, a 15-turn band of appends is injected whole into the fresh window, which opens already loaded and can re-approach the compaction point within a few turns — parent D3's own thrash falsifier, reached by a different road | Wrong if 200 lines cannot hold five sections of a long session — then the cap rises, and the D26 run reports the observed high-water mark. Wrong if condensing loses the rejected alternatives the file exists to carry, in which case the payload needs a per-section cap instead of a file-level one |
| D33 — trivial-append defeat, inherited from parent D4 (round-1 M5) | author-decided, limit stated | A content hash cannot tell a real refresh from a timestamp line, and no deterministic check can (`rule-enforcement-channel-selection.md §5`, `#gate-where-judgment-needed`); a paid-LLM judge is excluded by `no-paid-llm-in-ci.md`. Two cheap structural narrowings ship — non-empty sections (D16) and the line cap (D32) — and the residue is ACCEPTED as a known limit with a named audit channel: the escape token and the handoff file are both grep-able, so hatch use over a period is one command, and D26's live run reads the actual handoff contents rather than only observing that blocks fired. Parent D4's falsifier is thereby answered «yes, defeatable; here is what is done instead», not left open | Wrong if D26 finds the handoffs are real but the SECTIONS are ritual (five headings, no content that a continuation could use) — that is the failure this row cannot prevent and D26 must look for explicitly |
| D17 — the escape token (D4 carried) | author-decided | `mechanical-tail: <rationale>` in the turn's final assistant text; rationale ≥20 characters, mirroring the `Prior-art: skipped — <≥20 chars>` hatch and `ci-tool-pin: allow <reason>`. Per-turn, never sticky: each turn in the band either changes the handoff or re-states the token. A rationale under 20 chars is not an escape — the block reason quotes the grammar | Wrong if the token is spammed as a ritual («mechanical-tail: finishing the mechanical tail now»). Counter is the same as everywhere else in this repo: the hatch is grep-able, so a `git log`-style audit of hatch use is one command; a semantic check is judgment and is not gated (rule-enforcement-channel-selection §5) |
| D18 — arming | author-decided | Opt-in `AIF_HANDOFF_GATE=1`, off by default. Precedent: F10's `AIF_AUTONOMOUS=1` (`end-of-turn-reminder.sh:74`). REJECTED: arm on the presence of `autoCompactWindow` — a consumer who bounds compaction for their own reasons would be gated by a hook they never configured, in a repo with no residue writer (parent F6: the hook ships to consumers, the writer does not). Unarmed output is byte-identical to today's — the paired negative | Wrong if the operator forgets to arm it and the gate silently never fires — the D26 checklist includes «observe one block» so an unarmed gate is caught on the first climb |
| D19 — freshness state | author-decided, REVISED in round 1 | Baseline = sha256 of the handoff file (portable two-branch helper per `deps-hash-check.sh:97-104`), stored at `${TMPDIR:-/tmp}/aif-handoff-<ctx_key>` (same `ctx_key` sanitisation as the D7 flags, `:307`). **On a normal Stop in the band:** `H_now == baseline` → block, baseline untouched; `H_now != baseline` (or no baseline yet) → allow, baseline := `H_now`. **On the `stop_hook_active` Stop the hook does NOTHING and exits 0 at `:35-38`, as today.** An earlier draft had it record `baseline := H_now` there, which is exactly backwards: a model handed back its turn that writes NOTHING and stops would have had the non-write recorded as accepted, and the next turn would pass. Doing nothing is both simpler and correct — if the model wrote, the next normal Stop sees a new hash and allows; if it did not, the next normal Stop sees the same hash and blocks again. **No handoff file at all** in the band → block. **Residue dir unresolvable or unwritable** → block once with a reason naming the degradation and `AIF_RESIDUE_DIR`, never a silent pass (F10 property 2, `autonomous-loop-continuity.md §1`: fail closed and SAY the probe broke). Mtime is never read | Wrong if a session's `ctx_key` changes mid-life (e.g. `--resume` issuing a new session id) — the baseline is then orphaned and the first Stop allows once. Accepted: one free turn, then correct |
| D34 — baseline lifecycle at compaction (round-1 m2) | author-decided | `precompact-residue.sh` deletes `${TMPDIR:-/tmp}/aif-handoff-<session_key>` on an `auto` trigger, by EXACT name, alongside the two tier flags it already clears — same rationale and the same hazard: a `aif-handoff-<key>*` glob would be a different bug in the same directory. The handoff FILE survives (it is the payload the injector reads); only the acceptance baseline resets, so the post-compaction climb re-judges from scratch instead of inheriting a hash from a window that no longer exists | Wrong if clearing the baseline lets the first post-compaction Stop in a new band pass on a stale handoff — it cannot, because with no baseline the gate allows once and immediately records, and the band is re-entered only after a fresh climb |
| D20 — the injection pipe (D10 carried; parent stage B) | author-decided | New `.claude/hooks/inject-handoff-on-compact.sh`, SessionStart matcher `compact`. Reads `_handoff-<session_key>.md` (session id from stdin, same key); emits `{hookSpecificOutput:{hookEventName:"SessionStart", additionalContext: <file + one-line residue pointer>}}`; `startup`/`resume`/`clear`/`fork` → silent exit 0; missing file → silent exit 0. Registered in `.ai-factory/harness-model.json`, rendered with `--write`. **Not added to `plugin/hooks/`** — consumers receive no writer (parent F6), and the existing `plugin/hooks/session-start` matcher `startup\|clear\|compact` already occupies that slot with the bootstrap block. Operator-axis, `@cc-only-rationale` like the writer | Wrong if `session_id` on the post-compaction SessionStart payload differs from the transcript's — verified above for the transcript; the hook payload is checked in D26 step 3 before anything relies on it |
| D21 — the fresh-session advice (parent D2) | author-decided | When the gate is ARMED, its reason replaces `ctx_line` entirely from the gate floor upward — «continue in a fresh session» is gone for the operator, which is what D2 asked. When UNARMED, `ctx_line` is untouched: a consumer without bounded compaction still gets D6's advice, and the twin stays byte-identical in behaviour | Wrong if the deep floor (500k) is reached with the gate armed — unreachable under the pair (compaction at 300k), so the deep tier's line is left as the arm for a compaction-disabled session, exactly as the parent's Consequences state |
| D22 — message delivery | author-decided | Gate reason via `aif_msg_eot_handoff_gate` in `lang/en.sh` + `lang/ru.sh`; parity test extends automatically (`lang-parity.test.ts` runs `check-parity.sh` over the packs). Observation, not fixed here: `ctx_line` at `:350` bypasses the packs | Wrong if the RU pack's Russian leaks into a repo artifact — it does not: the reason is operator-facing chat, category 2 of language-discipline §1 |
| D23 — twin and parity | author-decided | The Stop-hook twin regenerates by pre-commit (byte-identical, no transform marker). The arm's prose is consumer-generic (no framework paths), the gate is dormant unarmed. ZCode: synthetic transcripts carry no usage fields, so the arm is inert there — same row class as the D7 arm (zcode-parity-doctrine §2 row 9); the implementer adds the row | Wrong if `generate-plugin-twins.sh` refuses the regenerated twin — then the source has grown a path reference and must lose it |
| D24 — capability commit and the SSOT | author-decided | By the CLAUDE.md detector this is likely NOT a capability commit (hooks live under `.claude/hooks/`, not `packages/`; the new test is exempt material). The SSOT row is added anyway, in the same PR, because the enforcement half is a BUILD verdict with a measured negative-existence claim, and build-first-reuse-default §3 records those. Row text is pre-drafted in §SSOT row below so the implementer copies, not re-derives | Wrong if the detector fires on the Prior-art trailer form — then the trailer cites `prior-art-evaluations.md#271` and the row is already there |
| D25 — testing seams | author-decided | `packages/core/hooks/end-of-turn-reminder.test.ts`, new `describe` beside the F10 block (fixtures in §Testing seams); `packages/core/hooks/precompact-residue.test.ts` gains the pointer-line arm; new `packages/core/hooks/inject-handoff-on-compact.test.ts` (no SessionStart-`source` fixture exists to copy — parent M1); `lang-parity.test.ts` unchanged | Wrong if the fixtures cannot express «same content, new mtime» — they can: `touch` after write |
| D26 — live verification (parent F7 shape; F4's «a promise is not a mechanism» answered) | author-decided | After the hand-action, ONE real session in this repo, recorded in this file's changelog: (1) a Stop in the band with an untouched handoff → block observed, reason names the file; (2) the handoff written → next Stop allows; (3) the first auto-compaction → residue pointer line present, SessionStart injection observed with the five sections; (4) one turn ended on `mechanical-tail:` → allowed; (5) the handoff's CONTENTS read, not just its existence (D33) — do the sections carry decisions a continuation could act on; (6) the observed cost multiplier recorded, because the Stop hook already blocks for a recap on most substantive turns, so a refresh turn costs the gate block PLUS the recap turn — «one extra short turn» is a floor, not the expected value. **Decision rule, so this is a channel and not a promise:** if over that session the band produced no handoff whose content a continuation used, OR the multiplier exceeded 2 extra turns per band turn, the gate is retired to the injection channel of D35 and the SSOT row's verdict flips; otherwise it stays and the numbers are recorded here. Owner: the session that harvests the implementation PR, carried by the kickoff's `host-verify` contract | Wrong if no session in this repo climbs past the floor within a week of merge — then a synthetic transcript fixture stands in for arms (1)-(4), arms (5)-(6) stay OPEN, and the changelog says so rather than claiming the run happened |
| D27 — dispatch tier and marker | author-decided (operator confirm requested) | Tier 2 (a Stop-hook arm with hash-state semantics — D19's off-by-one is the kind of thing that needs review from above). Dispatch **WITHOUT** the `bridge-profile` marker even though the /arch plan-complete exception is active: operator premise 5 (parent register) puts verification on Opus, and without the marker the project defaults give Opus plan + review and GLM implementation — the exact split premise 5 names. The marker would move review to the executor tier | Wrong if the operator prefers the exception (whole pipeline on `Z.AI GLM-5.3 SDK`) — one-line kickoff edit, listed in the operator batch |
| D31 — the arm is nested, not top-level (round-1 minor) | author-decided | Every gate statement that reads `ctx_tokens` / `ctx_soft` lives INSIDE `if [ -n "$ctx_entry" ]` (`end-of-turn-reminder.sh:288`), where those variables are assigned. Outside it they are unset and `set -u` (`:9`) aborts the hook — which would kill the recap and F10 arms too, a regression in shipped behaviour that the D18 unarmed paired negative cannot catch because it only exercises the unarmed path. The data-flow cascade below is drawn flat for readability; the nesting is the binding statement | Wrong if a fixture with no usage record in the transcript makes the hook exit non-zero — D25 fixture 12 is that case |
| D35 — the rejected sibling channel (round-1 notes lane) | author-decided | REJECTED: put the band reminder on `UserPromptSubmit` (channel already live via `inject-session-bootstrap.sh`), letting the model write the handoff mid-turn at zero extra rounds with the Stop gate as backstop. Rejected for the same reason the parent's D10 rejected the same channel for stage B: `UserPromptSubmit` fires on the OPERATOR's next prompt, which in an autonomous or long-running session may be many turns later or never — and those are exactly the sessions the gate exists for. Recorded rather than left unexplored, because the cost line below prices the block-per-turn design and a reviewer will reach for this alternative | Wrong if the observed cost multiplier in D26 is high AND the sessions that hit the band turn out to be operator-interactive — then the injection channel is added ALONGSIDE the gate (cheap reminder first, gate as backstop), not instead of it |
| D36 — co-arming with F10 and the harness block cap (round-1 notes lane) | author-decided | Append order in one `reason` is fixed: `autonomy_line` → `ctx_line`/`gate_line` → the branch recap, so the continuation directive is never buried. Only ONE of `ctx_line` / `gate_line` is ever set (D21). On the harness cap: Claude Code overrides a Stop hook after eight consecutive blocks without progress, and the reset semantics are undefined (`end-of-turn-reminder.sh:60-63` says so plainly). Risk is low because every gate block is followed by an allowed `stop_hook_active` stop, so blocks are not consecutive — recorded because «low risk» from undefined semantics is a claim, not a guarantee | Wrong if a session in the band with F10 also armed reaches the cap and loses the recap channel entirely — D26 watches for it |
| D28 — the residue format's reader count | author-decided | The residue format now has THREE consumers: `/pipeline` §1 (`head -40` over `_residue-*.md`), the injector (D20), and any human reading a handoff. `/pipeline` §1 gets ONE more glob in its loop (`_handoff-*.md`) so a `/pipeline` session after a compaction sees the model's handoff, not only the writer's excerpt | Wrong if `/pipeline` §1's injection block grows past its token budget — the glob is `head -40` capped like its sibling |

## Data flow (one turn in the band)

Two positions in one hook (D30), the first nested inside `if [ -n "$ctx_entry" ]` (D31):

```text
Stop, stop_hook_active=true ....... exit 0 at :35-38. Nothing read, nothing written. (D19)

Stop, stop_hook_active=false
 │
 ├─ POSITION 1 — with the D7 arm, inside the ctx_entry block (:288-355)
 │    AIF_HANDOFF_GATE != 1 ............ gate_line stays empty → today's behaviour exactly
 │    ctx_tokens < gate_floor .......... gate_line stays empty
 │    residue dir unresolvable ......... gate_line := degraded-probe text (fail closed, D19)
 │    handoff file absent .............. gate_line := "create <path>, 5 sections"
 │    a required H2 missing or empty ... gate_line := names the heading (D16)
 │    file > AIF_HANDOFF_MAX_LINES ..... gate_line := "condense, do not append" (D32)
 │    sha256(file) == baseline ......... gate_line := "unchanged since the last accepted turn"
 │    else ............................. gate_line empty; baseline := sha256(file)
 │    (gate_line non-empty ⇒ ctx_line suppressed — D21)
 │
 ├─ early returns at :405 / :426 (no last_line, tool-only turn)
 │    → _autonomy_exit emits the block carrying gate_line. Token unreadable here by
 │      construction, so a stale handoff blocks. Deliberate (D30 ii).
 │
 ├─ POSITION 2 — after text is assigned (:414)
 │    text matches /mechanical-tail:[[:space:]]*.{20,}/ → gate_line := "" (allow)
 │
 └─ emit: gate_line appended at ALL THREE sites, as ctx_line already is (D30 iii)
      _autonomy_exit (:134-148) · ZCode dense block (:476-481) · bottom CC block (:694-702)

PreCompact (trigger=auto)
  ├─ residue gains «Model handoff: <path> (present, N lines, <sha8> | absent)» (D15)
  └─ rm -f the baseline flag, by exact name, beside the two tier flags (D34)

SessionStart (source=compact)
  └─ inject head -n <cap> of _handoff-<key>.md + the residue pointer as additionalContext
```

The block reason (EN pack, RU twin) says, in this order: the file path; that the turn is
inside the handoff band (`ctx_tokens` / `gate_floor`); the five required headings; that a
change of CONTENT is required (not a re-save); the escape grammar with the ≥20-char rule. It
never advises a fresh session (D21).

## Testing seams

All on existing seams; one new test file for the new hook.

- **`packages/core/hooks/end-of-turn-reminder.test.ts`** — `describe('handoff-currency gate')`:
  1. armed, above floor, no handoff file → `decision:block`, reason names the path;
  2. armed, above floor, file with all five headings, no baseline → allow; baseline file written with sha;
  3. same file, second Stop → block («unchanged»); `touch` the file first → STILL block (content, not mtime);
  4. file edited under one heading → allow; baseline advances;
  5. file missing `## Rejected alternatives` → block, reason names it;
  6. final text `mechanical-tail: regenerating snapshots, CI guards them` → allow; `mechanical-tail: done` → block;
  7. below floor → silent (existing branches only);
  8. `stop_hook_active=true`, armed → stdout empty AND baseline file updated;
  9. **paired negative:** `AIF_HANDOFF_GATE` unset, every fixture above → output byte-identical to the pre-change hook (snapshot the current outputs BEFORE editing — this is the only guard on the shipped behaviour, and it cannot catch an armed-path crash, which is what fixtures 11-13 are for);
  10. floor derivation: `CLAUDE_CODE_AUTO_COMPACT_WINDOW=300000` → floor 201000; settings.json `autoCompactWindow` only → same; neither → floor = `ctx_soft`;
  11. **`long_text=true` in the band, stale handoff → the emitted `reason` contains BOTH the recap body and the gate text** (the regression guard for D30 iii; fixtures 1-6 are short/tool-only turns and never reach `:694`, so without this the M2 failure ships green);
  12. armed, transcript with NO `usage` record at all → hook exits 0 without error (the D31 `set -u` guard);
  13. armed, `AIF_RESIDUE_DIR` pointing at an unwritable path → block whose reason names the degradation, never a silent allow (D19 fail-closed);
  14. armed, handoff over the line cap → block naming the cap (D32); a section present but blank → block naming it (D16).
- **`packages/core/hooks/precompact-residue.test.ts`** — pointer line `present` with sha and line count; `absent` when no handoff; residue body otherwise unchanged (existing fixtures stay green).
- **`packages/core/hooks/inject-handoff-on-compact.test.ts`** (new) — `source=compact` + file → JSON with `additionalContext` containing the file; `source=startup` → empty; no file → empty, exit 0; malformed stdin → exit 0.
- **`packages/core/hooks/lang-parity.test.ts`** — unchanged; goes red if only one pack gains `aif_msg_eot_handoff_gate`.
- **`packages/core/hooks/harness-config-drift.test.ts`** — unchanged; goes red if settings.json and the SSOT disagree, which is why the operator lands the render, not a hand-patch.

## File inventory (what the implementing PR touches)

| File | Change |
|---|---|
| `.claude/hooks/end-of-turn-reminder.sh` | the two-position arm (D30, D31); `plugin/hooks/end-of-turn-reminder` regenerates by pre-commit |
| `.claude/hooks/lib/residue-dir.sh` | NEW — the shared cascade, loaded behind the `check-doc-authority.sh:40-48` guard shape |
| `.claude/hooks/precompact-residue.sh` | the pointer line (D15) + the baseline clear (D34); switches to the shared lib behind the same guard |
| `.claude/hooks/inject-handoff-on-compact.sh` | NEW — the SessionStart injector (D20) |
| `.ai-factory/harness-model.json` | the SessionStart entry; `scripts/render-harness-config.mjs --write` renders it into `.claude/settings.json` |
| `install.sh` (the `_EOT_SRC` block, `:938-949`) · `setup.d/10-skills.sh` (`:233-243`) | add `lib/residue-dir.sh` to the by-name copy lists (D29) |
| `.claude/hooks/lang/en.sh` + `ru.sh` | `aif_msg_eot_handoff_gate`; parity is automatic (`check-parity.sh:26-32` keys on `^aif_msg_[a-z_]+\(\)`) |
| `.claude/skills/pipeline/SKILL.md` §1 | one more glob, `head -40` capped (D28) |
| `packages/core/hooks/` | `end-of-turn-reminder.test.ts` (14 fixtures), `precompact-residue.test.ts` (2 arms), `inject-handoff-on-compact.test.ts` (NEW) |
| `docs/meta-factory/prior-art-evaluations.md` | row #271, verbatim from §SSOT row |
| `.claude/rules/zcode-parity-doctrine.md` | one row: the arm is inert on ZCode (no usage fields) — same class as the D7 arm |
| operator hand-action | the rendered `hooks` block + `AIF_HANDOFF_GATE=1` in `env`, as one paste-able idempotent script modelled on `scripts/register-precompact-hook.sh` (122 LOC precedent) |

## Consequences

- Every turn between ~200k and 300k costs at least one extra short turn when the handoff is
  stale, or one line of escape text when the tail is mechanical. **At least** is the honest
  word: the hook already blocks for a recap on most substantive turns, so a refresh turn is the
  gate block plus the recap turn. D26 arm (6) records the observed multiplier, and D26's
  decision rule retires the gate if it exceeds 2 (effort-worthiness test 3).
- The operator's sessions lose the fresh-session advice (D21) — D2 delivered.
- The residue format is now load-bearing for three readers (D28).
- `plugin/hooks/end-of-turn-reminder` changes for consumers only in dormant code; a consumer who
  sets `AIF_HANDOFF_GATE=1` without a residue dir gets a gate that blocks on a file it cannot
  find — the reason names the path, so the failure is loud, not silent. Recorded as an accepted
  limit: the writer is not shipped, and shipping it is the parent's D7 widening decision.

## SSOT row (pre-drafted; the implementer appends it verbatim as #271)

`| 271 | **OpenAI Codex CLI** `features.context_management.experimental_mode` (private `notes` + `history` tools, `reminder_threshold_tokens`, a `Stop` hook with `decision: "block"` wired to nothing — parent spec §Prior art, fetched 2026-09-08) + **Amp Handoff** (shipped 2025-10-23, retired 2026-05-06 in favour of automatic compaction) + **Cline Focus Chain** (`remindClineInterval`) + **arXiv 2606.22528** «Governance Decay» (constraint violation 0% → 30-59% across compaction) | re-firing an un-ignorable handoff-currency prompt on EVERY turn from a floor derived from the compaction point, judged by content hash against a per-session baseline, with a rationale-bearing escape token (the harness's own `stop_hook_active` loop guard means a single turn can still end, so this is a per-turn re-fired prompt, not an unpassable gate — see the design's honest-claim paragraph) | 2026-09-08 | 2026-09-08 | BUILD (enforcement) / REFERENCE (band width, notes shape) | Seven systems + the Anthropic context-editing API all PROMPT for a handoff and none GATE it; the negative claim is bounded by the systems examined (OpenCode, Gemini CLI, Devin, Zed unchecked). The band + notes shape is settled prior art and is REFERENCEd, not re-invented; the gate is this repo's `#hope-as-gate` → deterministic-gate conversion (attention-is-not-a-mechanism §2). Design: docs/superpowers/specs/2026-09-08-handoff-currency-gate-design.md | Any examined system ships a turn-completion gate on note currency (→ ADAPT); OR the D26 live run shows the band cost is material with no measurable continuation gain (→ retire the gate, keep the pipe); OR Claude Code ships a skip-the-summary rollover (Codex shape), which changes the payload question |`

## Operator premise register (carried from the parent, verbatim-faithful)

Premises 1-6 of the parent spec bind here unchanged. The ones this round leans on: premise 2
(«after ~200k every turn maintains its own handoff» → D14's 201000), premise 3 (the mechanical
tail → D17), premise 5 (verification in aif and Opus, not the top-tier seat → D27 and the
cold seats of this round on the mid tier).

## Exit routing (per /arch §3)

- **Decision 1 — factory.** Bulky (three hooks, one lib, four test files, a rule row, a lang
  pair, a settings recipe); nothing needs the operator in the loop as it unfolds; the one surface
  the factory cannot write (settings.json) is a hand-action either way.
- **Decision 2 — Tier 2 kickoff, no marker (D27),** at
  `.claude/orchestrator-prompts/handoff-currency-gate/kickoff.md`, merged to `staging` first,
  then `/pipeline`. Not `bridge: auto` (verified fact above). Single stage.

## Changelog

### Round 1 — two cold seats in parallel, top-down and bottom-up, 2026-09-08

Both returned `REVISE`. The two altitudes converged independently on the same two structural
defects, which is the strongest signal in the round: the escape token cannot be read where the
arm was placed, and the block payload is built at three sites rather than one. Every citation
below was re-verified in the worktree by the author before disposition.

- **Escape-token position (top-down M1 + bottom-up B1). FIXED as D30.** Verified: `text` is
  assigned at `end-of-turn-reminder.sh:414`, `last_line` at `:403`, while the D7 arm ends at
  `:355`. Under `set -euo pipefail` (`:9`) a `$text` reference at the D7 position aborts the
  hook — taking the recap and F10 arms down with it, a regression the unarmed paired negative
  cannot catch. The arm is now explicitly two positions with one variable, and the coverage lost
  at `:405`/`:426` is stated as a deliberate fail-closed choice rather than discovered later.
- **Three emit sites (top-down M2 + bottom-up M1). FIXED as D30 iii + fixture 11.** Verified:
  `_autonomy_exit` (`:134-148`), the ZCode dense block (`:476-481`) and the bottom CC block
  (`:694-702`) each build their own payload, the latter two hand-appending `ctx_line`. The
  original fact row asserted a single funnel and was simply wrong. A `gate_line` appended only
  in `_autonomy_exit` would have been silent on every `long_text=true` turn, and fixtures 1-6
  never reach `:694`, so the suite would have stayed green — the same shadowing class as the F10
  postmortem the spec quotes.
- **Shared-lib delivery (top-down B1). FIXED as D29.** Verified: `install.sh:938-949` and
  `setup.d/10-skills.sh:233-243` enumerate the hook and its `lang/` packs by name, and grep finds
  no `hooks/lib` copy step anywhere in `install.sh` or `setup.d/*.sh`. An unconditional `.` of a
  missing lib would fail the Stop hook on every turn in every consumer project. The repo's own
  guard shape (`check-doc-authority.sh:40-48`) is now the specified form, and both manifests are
  named in the file inventory.
- **«Turn completion conditional» overstated (top-down M3). ACCEPTED, absorbed into the Decision
  section and the SSOT row.** `:35-38` exits 0 unconditionally and this design keeps it. The
  claim is now «one un-ignorable prompt per turn, re-fired every turn».
- **Baseline write on the `stop_hook_active` stop. FIXED — the step is DELETED (D19).** The
  finding was that recording a baseline there logs a non-write as accepted. Re-derived by hand:
  the step was not merely risky, it was backwards. Doing nothing is both correct and simpler,
  and it dissolves bottom-up's related minor about the step being neither four lines nor
  read-only.
- **Unbounded handoff (top-down M4). FIXED as D32** — current-state file, line cap, capped
  injection, mirroring `/pipeline` §1's own `head -40`.
- **Parent D4's trivial-append falsifier (top-down M5). ACCEPTED as a stated limit (D33)** with
  two cheap structural narrowings and a named audit channel, rather than a proxy that would be
  `#discipline-theatre`.
- **`set -u` nesting (bottom-up minor). FIXED as D31 + fixture 12.** `ctx_tokens` exists only
  inside `if [ -n "$ctx_entry" ]` (`:288`).
- **sha256 portability (bottom-up minor). FIXED in D19** — the `deps-hash-check.sh:97-104`
  two-branch fallback; stock macOS has no `sha256sum`.
- **Wrong line numbers (bottom-up M2). FIXED throughout the facts table.** Five of eleven
  citations were off: the guard is `:35-38` not `:39-42`, the estimator `:284-287` not
  `:268-274`, `_autonomy_exit` `:134-148` not `:131-143`, the F10 postmortem `:51` not `:52`,
  the text extraction `:414` not `:407`. The residue-writer rationale cite was likewise off by a
  few lines and is now dropped rather than re-cited. Recorded prominently because the facts table
  is the evidence base a cold reader re-derives from, and D19's insertion instruction pointed at
  a line where the code is already unreachable.
- **`session_id` sample did not reproduce (bottom-up minor). FIXED.** The invariant holds — every
  transcript with compaction boundaries carries exactly one `sessionId` — but the counts in the
  draft were not the ones on disk; the row now cites the sweep that was actually run.
- **D28 «sixth reader» vs «three consumers» (bottom-up minor). FIXED** — the heading was a
  leftover; there are three.
- **D26 was a promise, not a channel (top-down m4, echoing the parent's own F4). FIXED** — it
  now carries a decision rule that retires the gate, plus two arms that read the handoff's
  contents and the observed cost multiplier.
- **Baseline lifecycle (top-down m2). FIXED as D34.** **Unresolvable residue dir (top-down m3).
  FIXED in D19** — fail closed and name the degradation, per F10 property 2.
- **D21 near-vacuous under the shipped pair (top-down m5). ACCEPTED, recorded in the row itself**:
  `ctx_soft = min(300000, 700000) = 300000` equals the compaction point, so `ctx_line` barely
  fires today regardless.
- **`UserPromptSubmit` alternative (top-down notes lane). ACCEPTED and recorded as D35** — a
  rejected alternative with its reason, which is exactly the payload class this whole design
  exists to preserve.
- **Notes-lane confirmations carried without change:** SSOT `#271` is free (last row is `270`);
  the capability-commit reading holds (the LOC arms are scoped to `packages/`); the SSOT+`--write`
  registration path, the matcher support, the lang-parity coverage, the byte-identical twin, the
  `AIF_RESIDUE_DIR` seam, the absence of any SessionStart `source` fixture to copy, the
  `runtime-bridge-dispatch.sh:129-130` first-line check, and the 122-LOC hand-off precedent were
  all independently verified GO by the bottom-up seat.

Round budget: 2 REVISE rounds are the `/arch` §2 cap. This was round 1; both seats' findings are
disposed of above, and no finding was left un-adjudicated.
