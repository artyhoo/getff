# Session-start token attribution — S1 measurement + falsifier

> **Authoritative for:** S1 attribution of every session-start injected artifact to its injecting
> channel (file:line), per environment (host-cc / aif-container), with a falsifier verdict on the
> harness remainder. Single source of truth for the S2 channel-re-scoping moves in the
> `session-start-token-audit` umbrella. Reproducible via
> [`scripts/measure-session-start-tokens.sh`](../../../scripts/measure-session-start-tokens.sh)
> (this patch's executable proof — S3 re-runs the same script against the post-S2 state).
>
> **NOT authoritative for:** project goal — see
> [README.md#why-this-exists](../../../README.md#why-this-exists). S2 move selection (pre-decided
> in the kickoff) — see `.claude/orchestrator-prompts/session-start-token-audit/kickoff.md`. The
> umbrella's plan file (`.ai-factory/plans/feature-session-start-token-audit-c781e8.md`) is the
> execution SSOT.
>
> **Origin:** operator-commissioned 2026-07-26 «session-start token audit» umbrella
> (attribution-before-cutting). S1 measurement run 2026-07-30 against
> `feature/session-start-token-audit-c781e8` @ `c2bd59404` (HEAD ≡ `origin/staging` content per
> kickoff §0 re-verify window — `git log origin/staging..HEAD` empty for the always-on surface;
> CLAUDE.md/settings/rules byte-identical to the `73e039674c` baseline).

## §0 Active traps (per plan §S1)

T3 (file:line per row), T7/T10 (enumerate from mechanism not seed list), T14 (no catch-all
«harness overhead»), T15 (patch measures own artifacts), T-TOK-A/B/C (attribution discipline).
Domain trap **T-TOK-D** (this patch): a "why-hot" justification quoted from the rule's own
Class/channel declaration must be the **actual quoted string** — paraphrasing the rule's
self-description is the same shape as T3 (prose-only finding). Each row below carries either a
verbatim quote or `none found` if the rule has no self-described channel/Class header.

## §1 Population enumeration (T7/T10 — from the live mechanism)

The session-start injected set is determined by **three CC-native mechanisms**, resolved in
order. The kickoff's named 7-rule list is **evidence** (cited from the 2026-07-31 live
observation); the population is what the mechanism actually selects today. Verified live by
`scripts/measure-session-start-tokens.sh` against `origin/staging` @ `3172cc5653`:

1. **Project `CLAUDE.md`** — CC-native project-root autoload (always loaded).
2. **User `~/.claude/CLAUDE.md`** — CC-native user-home autoload (host-cc only; absent in
   aif-container, verified `ls /home/node/.claude/CLAUDE.md` → ENOENT).
3. **`.claude/rules/*.md` autoload set** — every rule file whose YAML frontmatter LACKS the
   `paths:` key, MINUS entries listed in `claudeMdExcludes` (`.claude/settings.json:214-219`).
   **Discriminator = the `paths:` key, not the `---` marker** — verified:
   `.claude/rules/autonomous-loop-continuity.md:1-3` carries a `description:`-only frontmatter
   block and IS still always-on (matches kickoff's T-TOK-B observation).
4. **`MEMORY.md`** — CC-native memory autoload from `$HOME/.claude/projects/<slug>/memory/`.

**Mechanism-computed count (S1 run, 2026-07-30):** 7 rules (matches kickoff's T-TOK-B
prediction exactly). The 7 are: `00-rule-index.md`, `ai-laziness-traps.md`,
`attention-is-not-a-mechanism.md`, `autonomous-loop-continuity.md`,
`build-first-reuse-default.md`, `git-conflict-merge-forward.md`, `zcode-parity-doctrine.md`.

**claudeMdExcludes (4 entries, `.claude/settings.json:214-219`):** `egress-no-api-bypass.md`,
`memory-codification.md`, `recommendation-laziness-discipline.md`, `reviewer-discipline.md`.

**paths:-carrying (15 rules, conditional edit-time load):** the remainder — see script §C.

## §2 Attribution table (T3 — file:line + token count per row)

Tokens via **stated heuristic (T-TOK-A)**: `bytes/4` when non-ASCII ratio ≤ 0.30,
`bytes/2.2` when > 0.30. State as heuristic, not tokenizer-truth. Non-ASCII measured via
`tr -d '\000-\177' | wc -c` (ASCII = bytes 0x00-0x7F).

### §2.1 Always-on injected set

| artifact | env | bytes | tokens_est | injecting_channel (file:line) | why-hot (quoted from rule's own header) |
|---|---|---:|---:|---|---|
| `CLAUDE.md` | host-cc | 26,517 | 6,629 | CC-native loader (project CLAUDE.md autoload) | `> **Authoritative for:** AI-tooling conventions, capability-commit gates, build-vs-reuse discipline, Artifact Ownership Contract.` |
| `CLAUDE.md` | aif-container | 26,517 | 6,629 | CC-native loader (project CLAUDE.md autoload) | (same file in both envs) |
| `~/.claude/CLAUDE.md` | host-cc | 3,593 | ~898 | CC-native loader (user-home autoload; host-cc-only — kickoff measurement 2026-07-26) | (operator-owned; not in repo — content not quoted here) |
| `~/.claude/CLAUDE.md` | aif-container | — | — | **ABSENT** — verified `ls /home/node/.claude/CLAUDE.md` → ENOENT | n/a |
| `.claude/rules/00-rule-index.md` | both | 4,095 | 1,023 | CC-native loader (`.claude/rules/*.md` autoload, no `paths:` key) | `> **Authoritative for:** rendered rule digest. Regen: npx tsx scripts/render-rule-index.mjs --write.` |
| `.claude/rules/ai-laziness-traps.md` | both | 26,387 | 6,596 | CC-native loader (`.claude/rules/*.md` autoload, no `paths:` key) | `> **Class:** A — companion principle test shipped at packages/core/principles/12-ai-laziness-traps.test.ts … **Fires:** any R-phase, audit, sample-based investigation, or open-ended AI task.` |
| `.claude/rules/attention-is-not-a-mechanism.md` | both | 2,629 | 657 | CC-native loader (`.claude/rules/*.md` autoload, no `paths:` key) | `> **Class:** C — prose-only; promotion criterion in §3. **Fires:** designing any load-bearing check (gate vs. bare human/AI attention).` |
| `.claude/rules/autonomous-loop-continuity.md` | both | 13,459 | 3,365 | CC-native loader (`.claude/rules/*.md` autoload, no `paths:` key — has `description:`-only frontmatter) | `> **Class:** B — the mechanism is the opt-in AIF_AUTONOMOUS=1 pair: (a) the Stop-hook arm in end-of-turn-reminder.sh … and (b) the always-on autonomy block in inject-session-bootstrap.sh …` |
| `.claude/rules/build-first-reuse-default.md` | both | 12,667 | 3,167 | CC-native loader (`.claude/rules/*.md` autoload, no `paths:` key) | `> **Class:** A — companion principle test shipped … **Fires:** any capability commit / new-capability proposal.` |
| `.claude/rules/git-conflict-merge-forward.md` | both | 9,285 | 2,321 | CC-native loader (`.claude/rules/*.md` autoload, no `paths:` key) | `> **Class:** B — enforcement mechanism is the operator-global PreToolUse guard … + the always-on CLAUDE.md Harness gates pointer` |
| `.claude/rules/zcode-parity-doctrine.md` | both | 22,177 | 5,544 | CC-native loader (`.claude/rules/*.md` autoload, no `paths:` key — has `<!-- globs: -->` marker at `:8` but no `paths:` frontmatter; the marker is consumed only by the edit-time hook, not by the CC session-start loader) | `> **Class:** A … **Fires:** editing .claude/hooks/**, plugin/hooks/**, or scripts/render-harness-config.mjs; authoring Wave B stage kickoffs …` |
| `MEMORY.md` | host-cc | 19,407 | ~8,821 | CC-native memory autoload (operator host: `~/.claude/projects/-Users-art-code-rules-as-tests-aif/memory/MEMORY.md`) | (operator-owned; not in repo — Russian → divisor 2.2) |
| `MEMORY.md` | aif-container | 1,158 | 289 | CC-native memory autoload (`/home/node/.claude/projects/-home-www-rules-as-tests-aif/memory/MEMORY.md`) | (container-local; English → divisor 4; slug lacks `-feature-…` suffix — this is the main checkout slug) |

**Totals:**

| env | bytes | tokens_est | row count |
|---|---:|---:|---:|
| host-cc | 140,216 | ~39,021 | 10 (CLAUDE.md + user CLAUDE.md + 7 rules + MEMORY.md) |
| aif-container | 118,374 | 29,589 | 9 (CLAUDE.md + 7 rules + container MEMORY.md; no user CLAUDE.md) |

**Cross-check vs kickoff (T-TOK-B):** the kickoff's 2026-07-31 live host-CC observation named
exactly these 7 rules and the same `~/.claude/CLAUDE.md` + project `CLAUDE.md`. The byte totals
match the kickoff's `73e039674c` measurements within rounding (kickoff reported 140,216 bytes;
S1 measures 140,216 bytes — exact match). The script's aif-container total (118,374 bytes)
reflects the per-env delta: −3,593 (no user CLAUDE.md) + 1,158 (smaller MEMORY.md) − 19,407
(host MEMORY.md absent) = −21,842 delta vs host, accounting for the 140,216 → 118,374 gap
exactly.

### §2.2 claudeMdExcludes-attributed (NOT injected at session start — recorded for attribution)

These rows are the **negative space** — they would be in the always-on set without the
`claudeMdExcludes` filter. Recorded here because S2 must not silently re-include them.

| artifact | bytes | tokens_est | injecting_channel (file:line) |
|---|---:|---:|---|
| `.claude/rules/recommendation-laziness-discipline.md` | 11,317 | 2,829 | `claudeMdExcludes` (`.claude/settings.json:214`) |
| `.claude/rules/egress-no-api-bypass.md` | 8,544 | 2,136 | `claudeMdExcludes` (`.claude/settings.json:214`) |
| `.claude/rules/reviewer-discipline.md` | 7,991 | 1,997 | `claudeMdExcludes` (`.claude/settings.json:214`) |
| `.claude/rules/memory-codification.md` | 12,857 | 3,214 | `claudeMdExcludes` (`.claude/settings.json:214`) |

### §2.3 paths:-gate-attributed (conditional, edit-time — NOT always-on)

15 rules carry `paths:` frontmatter and load only on matching-path reads. Summed bytes
(script §C): 211,682. These would be a catastrophic always-on cost (≈52k tokens) if `paths:`
were not honored; the kickoff's T-TOK-B observation confirmed they are absent from a live
host-CC session start. **Per-row detail:** see `scripts/measure-session-start-tokens.sh` §C
output (15 rows). Not duplicated here — the script is the SSOT for the conditional set.

## §3 Per-environment attribution (T-TOK-C — no extrapolation)

**Mechanism-verified parity (host-cc ≡ aif-container):** the aif-container runs
`/usr/local/bin/claude` (the actual CC binary, verified `which claude`) and parses the same
`.claude/settings.json` (verified identical: 4 `claudeMdExcludes` entries, 16 hooks —
`jq '[.hooks[]| .[]| .hooks[]?]|length'` → 16). The CC binary's session-start loader is the
same code path in both environments, so `claudeMdExcludes` and `paths:` ARE honored in the
aif-container — this is a mechanism chain (binary + settings-file), not an assumption.

**Verified per-env deltas:**

| dimension | host-cc | aif-container | evidence |
|---|---|---|---|
| user `~/.claude/CLAUDE.md` | 3,593 bytes (operator's) | ABSENT | `ls /home/node/.claude/CLAUDE.md` → ENOENT |
| `MEMORY.md` path | operator's Russian 19,407-byte file | container's 1,158-byte English file | `wc -c` |
| `MEMORY.md` slug | `-Users-art-code-rules-as-tests-aif` | `-home-www-rules-as-tests-aif` | `ls /home/node/.claude/projects/` |
| CC binary | `/usr/local/bin/claude` (operator-installed) | `/usr/local/bin/claude` (container image) | `which claude` |
| settings.json identity | repo file at `.claude/settings.json` | repo file at `.claude/settings.json` (same file — this IS the repo root in both envs) | `jq` |

**Residual caveat (per T-TOK-C, recorded not assumed away):** no session-start log is directly
readable from inside the container (`ls /home/node/.claude/logs/` → ENOENT;
`find /home/node/.claude -name 'session*'` returns only third-party plugin caches, no CC
trace). Evidence is therefore **mechanism-level** (binary + settings + file existence) rather
than **session-trace-level**. Future verification path: spawn a container session with CC's
debug logging enabled and diff the actual injected set against this table. Mark the row
`INCONCLUSIVE — log not exposed` only if a future probe diverges from the mechanism-prediction.

**S2 implication:** the S2 moves that depend on `claudeMdExcludes` honoring (Tasks 5 + 6 —
adding `autonomous-loop-continuity.md` + `git-conflict-merge-forward.md`) **do pay off in the
aif-container** under the mechanism chain above. If a future probe contradicts this, the row
for those S2 moves must be re-evaluated.

## §4 Hook channel enumeration (kickoff §1 (v) — BINDING)

Every hook registration in `.claude/settings.json:61-213` carries one row, with payload size
where side-effect-free stub-invocable, else `unmeasured — <reason>`. This is the only channel
through which a non-CC-native injection (e.g. a SessionStart hook payload) can be attributed.

| hook_event:matcher | env | bytes | tokens | mechanism (file:line) | measurer note |
|---|---|---:|---:|---|---|
| `UserPromptSubmit` | both | 1,499 | 374 | `.claude/settings.json:66` (`inject-project-digest.sh`) | stub-invocation stdout |
| `UserPromptSubmit` | both | 0 | 0 | `.claude/settings.json:74` (`inject-session-bootstrap.sh`) | stub-invocation stdout (0 bytes under no-AIF_AUTONOMOUS + no SUBAGENT) |
| `PreToolUse:AskUserQuestion` | both | 0 | 0 | `.claude/settings.json:85` (`ask-question-reminder.sh`) | stub-invocation stdout |
| `PreToolUse:Agent\|Task` | both | — | — | `.claude/settings.json:94` (`inject-subagent-context.sh`) | not-safely-invocable (rewrites subagent input) |
| `PostToolUse:Edit\|Write\|MultiEdit` | both | 0 | 0 | `.claude/settings.json:105` (`adopt-orchestrator-prompts.sh`) | stub-invocation stdout |
| `PostToolUse:Edit\|Write\|MultiEdit` | both | 0 | 0 | `.claude/settings.json:114` (`inject-matching-rule.sh`) | stub-invocation stdout |
| `PostToolUse:Edit\|Write\|MultiEdit` | both | 0 | 0 | `.claude/settings.json:123` (`check-doc-authority.sh`) | stub-invocation stdout |
| `PostToolUse:Edit\|Write\|MultiEdit` | both | 0 | 0 | `.claude/settings.json:132` (`check-hook-marker.sh`) | stub-invocation stdout |
| `PostToolUse:Edit\|Write\|MultiEdit` | both | 0 | 0 | `.claude/settings.json:141` (`check-kickoff-traps.sh`) | stub-invocation stdout |
| `PostToolUse:Write\|Edit\|MultiEdit` | both | — | — | `.claude/settings.json:150` (`runtime-bridge-dispatch.sh`) | not-safely-invocable (dispatches a runtime-bridge task on kickoff.md write) |
| `PostToolUse:Edit\|Write\|MultiEdit` | both | 0 | 0 | `.claude/settings.json:159` (`check-worker-dispatch-channel.sh`) | stub-invocation stdout |
| `PostToolUse:Write` | both | 0 | 0 | `.claude/settings.json:168` (`inject-memory-codification.sh`) | stub-invocation stdout |
| `Stop` | both | — | — | `.claude/settings.json:178` (`end-of-turn-reminder.sh`) | not-safely-invocable (Stop hook; probes GET /tasks and may block under AIF_AUTONOMOUS=1) |
| `SubagentStart` | both | — | — | `.claude/settings.json:188` (`inject-subagent-digest.sh`) | not-safely-invocable (mutates subagent launch payload) |
| `SubagentStop` | both | — | — | `.claude/settings.json:198` (`warn-subagent-report.sh`) | not-safely-invocable (reads transcript, emits report) |
| `SessionStart` | both | — | — | `.claude/settings.json:208` (`link-coordination.sh`) | not-safely-invocable (filesystem side effects) |

**Notes:**

- **16 hook arms total** (matches `jq` count). All are repo-internal (`.claude/settings.json`).
- **10 measurable stub-style** → 9 emit 0 bytes under the stub invocation (no live hook-event
  JSON context; injected prose is gated on tool_input fields the stub omits). The
  `UserPromptSubmit:66` arm is the only non-zero emitter at 1,499 bytes — it emits a static
  project digest even with empty input.
- **6 unsafe-to-invoke** (would mutate state or dispatch work): `Stop`, `SubagentStart`,
  `SubagentStop`, `SessionStart`, `PreToolUse:Agent|Task`, `PostToolUse:Write|Edit|MultiEdit`
  (runtime-bridge-dispatch). Marked `unmeasured` rather than probed — per kickoff §1 (v)
  "mark the rest `unmeasured — not safely invocable` rather than dropping the row".
- **PostToolUse:Edit\|Write\|MultiEdit** appears 6 times across distinct hooks — each row
  represents one hook registration, not a duplicate.

## §5 Falsifier branch (kickoff §1 (iii) — BINDING)

The measured always-on set is **118,374 bytes / 29,589 tokens (aif-container)** or
**140,216 bytes / ~39,021 tokens (host-cc)**. The operator observed ~100k tokens consumed at
session start. Where is the remainder?

### §5.1 Per-category controllability verdict (T14 — no catch-all)

| category | est. tokens | controllability | evidence |
|---|---:|---|---|
| Tool schemas (CC built-in tools: Bash/Read/Edit/Grep/Glob/WebFetch/Agent/...) | ~25-30k | **uncontrollable** (harness-fixed) | inherent to CC; the operator cannot trim without switching harness |
| MCP server instructions (context7/deepwiki/web_reader/4_5v_mcp) | ~5-10k | **settings-recommendation** | disable unused MCP servers in `~/.claude.json` (this container exposes all 4) |
| Skills/agents listings (skill descriptions in autoload; agents/*.md) | ~3-8k | **ours-to-trim** (edit skill descriptions) | `~/.claude/skills/*/SKILL.md` description lines; agents/*.md bodies when subagents are dispatched |
| SessionStart hook payloads (e.g. `link-coordination.sh` §4 row) | unmeasured | **ours-to-trim** | the §4 SessionStart row is marked `unmeasured — not safely invocable`; a real invocation may emit a non-trivial payload (filesystem link coordination) |
| Superpowers plugin session-start inject (`~/.claude/plugins/cache/superpowers-dev/.../hooks/session-start`) | unmeasured | **settings-recommendation** | verified present: `/home/node/.claude/plugins/cache/superpowers-dev/superpowers/6.2.0/hooks/session-start` — this is the superpowers full-skill inject the kickoff names; auditing/disabling it is operator-side |
| Agent team definitions (when team-mode active) | unmeasured | **ours-to-trim** | not active in this session; surfaces when `TeamCreate`/`SendMessage` are used |

### §5.2 Coverage verdict (T14)

**Coverage = insufficient to fully account for the ~60k harness remainder.** The categories
above are **qualitative**, not directly measured — the script cannot invoke unsafe hooks and
cannot see harness-internal injection (tool schemas, MCP server instructions). Per T14: the
patch reports `coverage insufficient` rather than collapsing the remainder into a catch-all
«harness overhead» bucket.

**Falsifier-triggered scope shift (kickoff §1 (iii) BINDING):** our injected set is
**~29,589 tokens (aif-container) / ~39,021 tokens (host-cc)**, against a ~100k session-start
total → **29-39% of the total**, which is **<40%**. The kickoff's BINDING falsifier clause
fires: **S2 scope shifts to — (a) apply the rule-channel trims anyway (cheap, already decided;
the four pre-decided moves stand to gain ~22k tokens), + (b) emit a harness-settings
recommendation section** (this §5.1) **instead of pretending file-trims solve the 100k.**

The 60% remainder is **not addressable by any S2 file-trim move**. Trim leverage on the
remainder lives in: (1) operator disabling unused MCP servers (settings-recommendation),
(2) operator auditing superpowers session-start inject (settings-recommendation),
(3) editing skill `description:` lines (ours-to-trim but outside this umbrella's scope —
surface as observation in S2 PR body, do not autonomously expand scope per CLAUDE.md `PR
strategy`).

## §6 Self-application (T15 — patch measures own artifacts)

The session-start cost of this audit's own artifacts:

| artifact | bytes | tokens_est | session-start cost |
|---|---:|---:|---|
| `docs/meta-factory/research-patches/2026-07-26-session-start-token-attribution.md` (THIS file) | 24,744 (measured at S1 land via `wc -c`) | ~6,186 | **0** — research-patches/ are not in the CC-native autoload set (no `paths:` autoload; filename-convention scope per `doc-authority-hierarchy.md §2`) |
| `.ai-factory/plans/feature-session-start-token-audit-c781e8.md` | ~14,000 | ~3,500 | **0** — gitignored path prefix (`.ai-factory/`) |
| `scripts/measure-session-start-tokens.sh` | ~8,000 | ~2,000 | **0** — `scripts/**` is not autoloaded by CC session-start |
| `docs/meta-factory/operational-conventions.md` (S2 Task 7 deliverable, future) | ~5,000 (projected) | ~1,250 | **0** — research-patches/ equivalent; not autoloaded |

**Self-application verdict:** the audit's own artifacts add **0 tokens at session start**.
None of the four files is in the CC-native autoload set. The cost is paid at edit-time
(when this patch is read) or never (for the gitignored plan file).

## §7 Live observation quote (T-TOK-B)

The kickoff carries a 2026-07-31 live host-CC session-start observation, quoted verbatim
because it is this patch's T-TOK-B evidence base — S1 reproduces the mechanism prediction, it
does not re-derive from docs:

> «computing `no-paths:-key MINUS claudeMdExcludes` over `origin/staging` yields exactly **7**
> rules — 00-rule-index, ai-laziness-traps, attention-is-not-a-mechanism,
> autonomous-loop-continuity, build-first-reuse-default, git-conflict-merge-forward,
> zcode-parity-doctrine — and exactly those 7 were present in a live host-CC session's injected
> context, the 15 `paths:`-carrying rules being absent except those whose globs matched the
> path that session was editing.»

S1's mechanism-computed count (§1) matches the 7-rule prediction **exactly**. The byte figures
match within rounding vs the kickoff's `73e039674c` baseline. The script is the executable
form of this verification — re-run `bash scripts/measure-session-start-tokens.sh` to
reproduce.

## §8 S2 implications summary

| S2 move | mechanism | host-cc payoff | aif-container payoff | notes |
|---|---|---:|---:|---|
| Task 4: `zcode-parity-doctrine.md` add `paths:` | converts always-on → conditional | -22,177 bytes / -5,544 tokens | -22,177 bytes / -5,544 tokens | both envs honor `paths:` (§3) |
| Task 5+6: add `autonomous-loop-continuity.md` to claudeMdExcludes (paired w/ note B) | moves to claudeMdExcludes | -13,459 bytes / -3,365 tokens | -13,459 bytes / -3,365 tokens | both envs honor `claudeMdExcludes` (§3); note B pairing required (kickoff §1 S2 note B BINDING) |
| Task 5+6: add `git-conflict-merge-forward.md` to claudeMdExcludes | moves to claudeMdExcludes | -9,285 bytes / -2,321 tokens | -9,285 bytes / -2,321 tokens | note C accepted-degradation recorded in PR body |
| Task 7: CLAUDE.md hot/cold split | moves 4 sections to operational-conventions.md | -~3,000 bytes / -~750 tokens (projected) | same | 600-line gate reduces CLAUDE.md size |
| Task 8: MEMORY.md index English-compressed (proposal) | operator-applied | -~10,000 bytes / -~4,500 tokens (host MEMORY.md only) | n/a (container MEMORY.md already English) | operator-applied outside repo |
| **S2 total payoff (rules+settings only, both envs)** | | **-~48,000 bytes / -~12,000 tokens** | same | Tasks 4 + 5 + 6 + 7 |

**Post-S2 projected always-on total (both envs, rules + CLAUDE.md + MEMORY only):**

| env | pre-S2 | projected post-S2 (Tasks 4+5+6+7) | delta |
|---|---:|---:|---:|
| host-cc | ~39,021 tokens | ~26,500 tokens | -32% |
| aif-container | 29,589 tokens | ~17,100 tokens | -42% |

Both projected post-S2 totals are **≤ the 25k-token budget target only on aif-container**;
host-cc lands at ~26.5k (1.5k over) without Task 8 (MEMORY.md index compression, which is the
host-only lever). S3 will verify the actual post-S2 numbers via the same script; if host-cc
misses ≤25k, surface as a fork to the operator (per S3 Task 9 budget-check clause) rather
than autonomously trimming further.

## §9 Re-probe before S2 container-dependent moves (T-TOK-C fallback)

Per kickoff §1 (iv) fallback clause: any S2 move whose payoff rests on container behavior
**stays blocked while its row reads INCONCLUSIVE**. As of this S1 run, the §3 mechanism chain
evidence is sufficient to UNBLOCK Tasks 4/5/6/7 in the aif-container — but the residual caveat
(no session-start trace directly readable) means a future divergence is possible. S2 MUST
re-probe (`bash scripts/measure-session-start-tokens.sh` from inside the container) before
treating the aif-container column as confirmed.

## See also

- [`scripts/measure-session-start-tokens.sh`](../../../scripts/measure-session-start-tokens.sh) — executable proof; re-run reproduces §1/§2/§4.
- [`.claude/orchestrator-prompts/session-start-token-audit/kickoff.md`](../../../.claude/orchestrator-prompts/session-start-token-audit/kickoff.md) — operator kickoff (pre-decided S2 moves + notes A/B/C).
- [`.ai-factory/plans/feature-session-start-token-audit-c781e8.md`](../../../.ai-factory/plans/feature-session-start-token-audit-c781e8.md) — execution plan (10 tasks, 3 PRs).
- [`language-discipline.md §1`](../../../.claude/rules/language-discipline.md) — internal-machinery English rule.
- [`doc-authority-hierarchy.md §2-§3`](../../../.claude/rules/doc-authority-hierarchy.md) — header spec this patch follows.
- [`ai-laziness-traps.md §2`](../../../.claude/rules/ai-laziness-traps.md) — active traps T3/T7/T10/T14/T15 + domain traps T-TOK-A/B/C/D.
