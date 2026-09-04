# Opus session prompt — Channel-earliness audit (the §6-deferred retroactive sweep)

> Open a fresh Claude Code session on **Opus**, paste EVERYTHING below as the first message, wait for the final REPORT.
>
> **Mode A — single session, no worker dispatch.** Per-check «where does the data live → what is the channel floor?» is a judgment call that delegates poorly to parallel Sonnets (each check needs the same lens applied consistently, and verdicts cross-reference each other). One Opus session does the full-population enumeration + per-check verdict + earlier-channel feasibility verification itself. Cost target: ~70–100k Opus.

---

## TASK (one sentence)

Sweep **every existing check** in this repo against the project invariant «every rule fails at the EARLIEST reachable channel» and, for each, decide — with file:line or command-output evidence — whether it sits **later than its data permits** and should gain an **edit-time companion** (dual-channel) or **move earlier**, vs. is **already at its floor** — producing an AUDIT (verdicts + evidence), **NOT** an implementation.

```text
WORKDIR : /Users/art/code/rules-as-tests-aif
OUTPUT  : docs/meta-factory/research-patches/2026-MM-DD-channel-earliness-audit.md   (new research-patch; use today's date)
BRANCH  : dedicated git worktree off origin/staging (parallel sessions share main — see WORKTREE below)
PR BASE : staging
```

---

## WHY THIS AUDIT EXISTS (frame — read before starting; do NOT re-derive from scratch)

Project goal ([README.md#why-this-exists](../../../README.md#why-this-exists)): **AI agents can't silently bypass undocumented conventions, because every codified rule is an executable artifact that fails at the EARLIEST reachable channel** — `edit-time → pre-commit → pre-push → CI → production audit`. **CI is the last-resort gate, not the primary one.**

The *time-axis* invariant («fail as early as possible») has been applied **forward-going** — each new check, as it was built, was placed at some channel. But **no one has ever swept the EXISTING checks** to ask: *which sit later than necessary and could move earlier?* [rule-enforcement-channel-selection.md §6](../../../.claude/rules/rule-enforcement-channel-selection.md) explicitly **deferred** exactly this — «forward-going, not retroactive; existing rules declare channel at next substantive touch; no retroactive sweep». **This audit is that deferred retroactive sweep** — recursive self-application of [channel-selection §1 axis-2](../../../.claude/rules/rule-enforcement-channel-selection.md) (delivery breadth) to the existing inventory.

**The triggering incident (2026-05-22):** while building N8 items C4/C5, the agent defaulted them to pre-push and only moved C4 to edit-time *after the maintainer asked «can't we catch hotter / earlier?»*. The agent had trusted an upstream doc's channel assignment instead of re-deriving the floor from the invariant. That failure mode is **systemic** — channel placement is being inherited, not re-derived — and this audit is its countermeasure.

---

## THE LOAD-BEARING PRINCIPLE (apply this per check — it is the whole lens)

> **The channel floor is set by WHERE THE DATA LIVES.** Not by the file type of the check, not by where a sibling check happens to sit — by what input the check actually reads.

| The check's data is… | Earliest reachable channel | Default verdict |
|---|---|---|
| the content of a **single file** | **edit-time** (PostToolUse on Edit/Write) | **MOVE-EARLIER / ADD-DUAL-CHANNEL** — a single file's content is fully present at the moment it is edited |
| the **commit message / trailer** | commit-msg / pre-push (no edit-time access to the message) | **KEEP** — edit-time has no commit message; this is the floor |
| a **cross-file / whole-repo invariant** | pre-push or CI (needs the whole tree) | **KEEP** — one file's edit can't see the repo-wide state |
| the **diff range** | pre-push — OR per-file edit-time if per-file suffices | **DEPENDS** — if the check is decomposable per-file, an edit-time companion is reachable |

**The model to emulate is `doc-authority`:** [packages/core/principles/09-doc-authority-hierarchy.test.ts](../../../packages/core/principles/09-doc-authority-hierarchy.test.ts) (repo-wide principle test, the late backstop) **+** [.claude/hooks/check-doc-authority.sh](../../../.claude/hooks/check-doc-authority.sh) (PostToolUse, fires per edit). **Same check, two channels.** That is the target shape for most MOVE candidates: the goal is usually to **ADD an edit-time companion (dual-channel), NOT move-and-delete** — keep the late gate as a backstop for the paths the edit-time hook can't see (rename, bulk import, non-CC harness, push from a machine without the hook).

### Edit-time has TWO surfaces — pick the right one per actor (load-bearing)

«Edit-time» is not one channel. It is two, catching different actors. **Confusing them is the dominant error here** (a sibling of T-CE-A):

| Surface | Fires for | Mechanism | Catches |
|---|---|---|---|
| **A — IDE / LSP** | a **human** typing in an editor | ESLint-LSP, `tsserver`, Biome, Prettier-on-save, markdownlint extension, JSON/YAML-schema, actionlint extension | live squiggles as a person types |
| **B — Claude Code PostToolUse hook** | an **AI agent's** `Edit`/`Write` | `.claude/hooks/*.sh` wired in `settings.json` (the project's `check-doc-authority.sh`, `validate-prompt.sh`) | the agent's edit, the moment it lands |

**Why this is load-bearing for THIS project:** the threat model is *AI agents* ([README.md#why-this-exists](../../../README.md#why-this-exists)), so **surface B is the project's real hot lever**. A claim like «ESLint already catches this at edit-time» is true only for **surface A (humans)**; whether it catches an **agent's** edit at edit-time depends on whether the harness runs the LSP/ESLint on agent edits, or whether it is wired as a surface-B hook.

> **⚠ VERIFY, do not assume (T3 + dual-channel-false-confirm guard):** before relying on «for the agent, tool X is NOT edit-time unless wired as a PostToolUse hook», **verify against the Claude Code hooks docs** (`code.claude.com/docs/.../hooks`, or `claude-code-guide`) whether agent `Edit`/`Write` tool calls surface IDE/LSP diagnostics back to the agent at all. The orchestrator's working assumption (unverified at kickoff-authoring time) is that they do **not** — the only post-edit signal the harness guarantees to the agent is the PostToolUse hook — but **the audit must confirm this before treating any surface-A tool as agent-edit-time.** If confirmed: a tool is agent-edit-time **iff** it is a wired surface-B hook; ESLint/tsc/Biome are then **pre-commit/pre-push** channels *for the agent*, regardless of being live for a human.

**Catalogue of deterministic edit-time mechanisms** (for picking a MOVE/ADD mechanism in Step 3 — `#no-paid-llm`):

- **AST-capable, agent-reachable (surface B):** a PostToolUse hook that calls the Wave-10 TS engine (`pre-push.ts` / `checks/*.ts`) or a standalone `tsx` script over the single edited file → structural checks at agent-edit-time, REUSE not BUILD.
- **Line-shaped, agent-reachable (surface B):** a PostToolUse `.sh` hook doing grep/regex over the edited file (the `check-doc-authority.sh` / `inject-matching-rule.sh` shape) → trailers-in-file, scope-marker, presence.
- **⭐ Architecture-at-edit-time — the orchestrator's flagged «most under-used hot lever»:** layer-boundary enforcement currently lives in `dependency-cruiser` at **pre-push**. `eslint-plugin-boundaries` / `eslint-plugin-import` express the same layer rules on the **lint channel** — strictly earlier (lint = edit-time live for a human / pre-commit for the agent, vs pre-push for dep-cruiser). **Evaluate this as a named MOVE/ADD candidate, not a footnote.** Honest surface caveat: it is hotter for the agent only as far as eslint *runs* on the agent's edit — pre-commit (lint-staged) by default, or true agent-edit-time only if eslint-on-edited-file is wired as a surface-B PostToolUse hook. Even pre-commit is earlier than pre-push, so the move has value regardless; the dual-channel target is dep-cruiser (pre-push backstop) **+** eslint-boundaries (edit-time/pre-commit companion). *Don't ADOPT a new plugin before the [build-first-reuse-default](../../../.claude/rules/build-first-reuse-default.md) check — `eslint-plugin-import` boundaries may already cover it.*
- **Schema-at-edit-time (surface A):** JSON/YAML Schema on `settings.json` / `package.json` / workflow `.yml` gives live editor errors — human-facing; note it as surface A, not a substitute for a surface-B gate.

The verdict for each candidate names **which surface** the proposed mechanism uses, so «hot for a human» is never silently counted as «hot for the agent».

---

## CONSTRUCTIVE CONSTRAINTS (do not re-open — build into the findings)

1. **No paid LLM** ([no-paid-llm-in-ci.md](../../../.claude/rules/no-paid-llm-in-ci.md)). Every proposed earlier-channel mechanism is **deterministic** — AST / grep / regex / bash / test / PostToolUse hook. No LLM call, no API key. If a check can only be made earlier by adding semantic judgement, the verdict is KEEP (or honest «can't move — needs judgement, edit-time would false-positive»), not «add an LLM hook».
2. **AST is a first-class mechanism, not a footnote** ([principle 03 «AST > grep»](../../../packages/core/principles/03-ast-over-grep.test.ts) is a project invariant). For each MOVE/ADD candidate pick the mechanism by **data shape**, and state which you chose + why:
   - **Structured / code data** (TS/JS source, JSON, YAML structure, the *meaning* of a construct) → **AST** is preferred (`#ast-over-grep`). The Wave-10 TS-native engine (`packages/core/hooks/pre-push.ts` + `checks/*.ts`) already runs AST-capable code at pre-push — an edit-time companion REUSES that, it does **not** require a new dependency or engine ([build-first-reuse-default.md](../../../.claude/rules/build-first-reuse-default.md)).
   - **Line-shaped data** (a commit trailer, a first-line `<!-- scope: -->` marker, simple token presence) → **grep/regex is correct**; AST there is `#ast-overkill`. Don't reach for AST where a line check suffices.
   - **Load-bearing:** a check that is `CANT-MOVE` / `KEEP` *with grep* may become `MOVE-EARLIER` *with AST* — AST can **unlock** a move grep can't. So **do not close a verdict as «can't move earlier» until you've asked «would AST make the earlier channel reachable?»** (closing early here is T-CE-B + T4). Conversely, don't propose AST just because the file is `.ts` — match mechanism to *data shape*, not file extension (T16).
3. **This is the retroactive sweep §6 deferred** — say so explicitly in the patch. It does not retroactively *change* anything; it produces verdicts. **Each actual move ships as its own follow-up PR** (one channel-move per PR — atomic, per [CLAUDE.md PR strategy](../../../CLAUDE.md)).
4. **Dual-channel is the usual answer, not move-and-delete.** Adding an edit-time companion while keeping the pre-push/CI backstop is the doc-authority pattern (`@dual-pair` per [dual-implementation-discipline.md §5](../../../.claude/rules/dual-implementation-discipline.md)). Recommending you *delete* the late gate is the rare exception and needs its own justification.
5. **edit-time = PostToolUse hook reachability.** A PostToolUse `Edit|Write` hook receives the edited file path in `tool_input.file_path` and can read that file's post-edit content. It does **NOT** get the commit message, the diff range, or the whole repo cheaply. Verify each MOVE candidate against *this* actual capability (see Methodology Step 3).

---

## AI-LAZINESS TRAPS ACTIVE — per [.claude/rules/ai-laziness-traps.md §2](../../../.claude/rules/ai-laziness-traps.md)

Mandatory enumeration (this kickoff instantiates §3, it does not blanket-reference):

- **T3 — Plausible finding without verification.** Every verdict needs ONE of: (a) `file:line` + the actual content of that line, (b) command + output. **No prose-only verdicts** — «this reads a single file so move it» without quoting the line that reads the file is a T3 violation.
- **T10 — Population enumeration first.** §population (the FULL list of checks across all five surfaces) BEFORE any verdict. «I audited the main checks» without an enumerated denominator is meaningless. See Methodology Step 1 for the five grep surfaces.
- **T16 — Pattern-matching-on-name (CRITICAL here).** The temptation is *«it's a hook → it must already be edit-time»* / *«it's a principle test → it must be repo-wide → KEEP»*. **Wrong axis.** A hook *file* existing in `.claude/hooks/` does NOT mean it fires at edit-time — it must be **wired in `.claude/settings.json`** under a PostToolUse matcher. (Two scripts in this repo — `check-kickoff-traps.sh`, `inject-matching-rule.sh` — exist but are **NOT** wired; see the inventory note.) Classify each check by **where its data lives**, verified against settings.json + the check's source, never by the file's type or name.

### Domain-specific traps (this audit)

- **T-CE-A — «hook file exists → it fires at edit-time».** A `.claude/hooks/*.sh` file is only edit-time-active if `.claude/settings.json` wires it under `PostToolUse` (with a matcher). Counter: for EVERY hook you classify as «already edit-time», grep `.claude/settings.json` for its filename and quote the matcher line; if absent → it is **dormant**, and «already hot» is false. (`settings.json` is agent-self-protected — a not-yet-wired hook is a real finding, not a defect to fix here.)
- **T-CE-B — «move earlier» recommended without proving the earlier channel HAS the data.** Edit-time fires on ONE file; if the check needs two files compared (e.g. source-vs-rendered drift), the edit-time hook only sees the one just edited — it can fire the check but must read the *other* file from disk, and must handle «the other file was the one edited» symmetrically. Counter: for each MOVE/ADD candidate, write the explicit «at edit-time, the hook has: X (the edited file). It still needs: Y. Reachable from disk? yes/no» line. If Y is not cheaply reachable at edit-time → it is dual-channel-with-caveat or KEEP, not a clean move.
- **T-CE-C — collapsing «is a duplicate of an existing pre-push check» into «redundant, drop one».** If an edit-time companion duplicates a pre-push check, that is **dual-channel by design** (doc-authority model) — keep BOTH. Counter: «duplicates an existing check» → verdict ADD-DUAL-CHANNEL (keep the backstop), never «remove the duplicate».
- **T15 — Self-application (MANDATORY).** This audit is itself subject to channel-selection. §self-application must answer: (a) the output research-patch lives in the repo (not memory)? (b) is *this audit* a recurring sweep that should itself be scheduled/triggered (parallel to the §1.6 trigger-sweep), or a one-shot? (c) what would «auditing this audit» look like — i.e. how would a future session catch a check this sweep mis-classified?

---

## FIRST-PASS INVENTORY (a STARTING HYPOTHESIS — verify each row; do NOT trust it)

This table is the orchestrator's first pass. **Several rows are unverified hypotheses and at least one is known-wrong** (the «already hot» claim — see the note). Re-derive every verdict from the data-location principle; treat this only as a checklist seed.

| Check | Claimed channel | data = | first-pass verdict | ⚠ verify |
|---|---|---|---|---|
| Prior-art trailer (`checks/prior-art.ts`, pre-push §7) | pre-push | commit message | **KEEP (floor)** | edit-time has no commit msg |
| §1.7 discipline trailer (`checks/s17.ts`, pre-push §1.7) | pre-push | commit message | **KEEP (floor)** | same |
| `check-doc-authority.sh` + principle 09 | edit-time **+** test | single file content | **already dual-channel (the MODEL)** | confirm both wired |
| `validate-prompt.sh` | edit-time (PostToolUse, wired) | single file content | already hot | confirm settings.json wiring |
| `check-kickoff-traps.sh` (N8 C2) | **claimed edit-time** | single file content | ⚠ **VERIFY WIRING** — script exists, may be **dormant** (not in settings.json) | T-CE-A |
| `inject-matching-rule.sh` (channel-selection §4 ADAPT) | **claimed edit-time** | single file content | ⚠ **VERIFY WIRING** — known **not wired** per channel-selection §4 «activation pending» | T-CE-A |
| `check-hook-marker` / hook-stub → principle 16 | pre-push/CI | single file content | **HYPOTHESIS: add edit-time companion** | does the data fit one file? |
| principle 10 (scope-line first-line) | pre-push/CI | single file's first line | **HYPOTHESIS: add edit-time companion** | one file → edit-time reachable |
| `render-rules --check` (manifest drift, pre-push §4) | pre-push | source vs rendered RULES.md | **HYPOTHESIS: edit-time on source edit** | T-CE-B (two-file compare) |
| **⭐ layer boundaries (`dependency-cruiser`)** — **SHIPPED CONSUMER config, NOT this repo's own pre-push** (lives in `packages/core/templates/shared/ARCHITECTURE.*`, `rules-manifest.json`, prescribed to consumers) | consumer-side (prescribed) | import graph / layer structure | **⭐ FLAGGED: prescribe eslint-boundaries companion → consumer lint channel (edit-time/pre-commit), keep dep-cruiser as backstop** — orchestrator's «most under-used hot lever» | ⚠ **scope question** — see note below; BFR check first (`eslint-plugin-import` may cover); surface A/B caveat |
| actionlint / zizmor (pre-push §1/§2 + CI) | pre-push/CI | single workflow `.yml` | **HYPOTHESIS: edit-time on `.yml` edit** | per-file? external binary at edit-time? |
| lychee link check (pre-push §8) | pre-push | links across changed `*.md` | marginal | diff-range data; per-file possible? |
| principle tests 01–08, 11–17 (repo-wide invariants) | pre-push/CI | cross-file / whole-repo | **KEEP** — but check each: some may be per-file | T16 — don't assume all are repo-wide |

> **Known correction baked in:** as of this writing `.claude/settings.json` wires only `validate-prompt.sh` + `check-doc-authority.sh` (PostToolUse `Edit|Write`), `inject-session-bootstrap.sh` + `deps-hash-check.sh` (UserPromptSubmit), `ask-question-reminder.sh` (PreToolUse:AskUserQuestion), `end-of-turn-reminder.sh` (Stop). `check-kickoff-traps.sh` and `inject-matching-rule.sh` are **NOT wired** → «already edit-time» is FALSE for them. Verify this yourself (T3) and report the dormant-hook finding — a hook that exists but isn't wired is a *latent* edit-time channel, a distinct verdict from «already hot».

> **⚠ SCOPE QUESTION — two distinct check populations (resolve in §10, don't silently pick one):** this repo holds **(P1) the framework's OWN enforcement** (the 5 surfaces of Step 1 — what runs in *this* repo) AND **(P2) the SHIPPED consumer config it prescribes** (eslint configs + `RULES.md` + `dependency-cruiser` arch rules under `packages/core/templates/` + `packages/preset-next-15-canonical/`, copied into consumer projects by `install.sh`). The «earliest reachable channel» invariant applies to **both** — but they are different audits with different owners. **The boundaries lever (the ⭐ row) lives in P2, not P1.** Default scope of this audit = **P1** (the framework's own checks). Whether to also sweep P2 (the consumer prescription — where the arch-boundaries→edit-time win lives) is a **DECISION-NEEDED for §10**, not something to assume. If P2 is in scope, dep-cruiser→eslint-boundaries is its headline candidate; if not, surface it as «P2 audit recommended next».

---

## METHODOLOGY

### Step 1 — population enumeration (T10) — FIVE surfaces, BEFORE any verdict

Enumerate the complete population first. Record counts in §population.

```bash
# 1. edit-time / session hooks (and their wiring)
ls -1 .claude/hooks/*.sh
grep -nE '"(PreToolUse|PostToolUse|UserPromptSubmit|Stop)"|"matcher"|hooks/[a-z-]+\.sh' .claude/settings.json   # which are WIRED, at which event/matcher

# 2. pre-push sections
grep -nE '// ── [0-9]|function .*Section' packages/core/hooks/pre-push.ts
ls -1 packages/core/hooks/checks/*.ts | grep -v '\.test\.'

# 3. principle tests (repo-wide gates)
ls -1 packages/core/principles/*.test.ts

# 4. CI workflows
ls -1 .github/workflows/*.yml
grep -nE 'run:|uses:' .github/workflows/*.yml | grep -iE 'lint|zizmor|lychee|render|test|tsx|principle' | head

# 5. commit-msg / husky surfaces
sed -n '1,40p' .husky/pre-push ; ls -1 .husky/
```

For each item record: **name · current channel(s) · what input it reads**. The «what input it reads» column is the load-bearing one — it determines the floor.

### Step 2 — per-check verdict (the core deliverable)

One row per check in the coverage matrix:

| Check | Current channel(s) | Data lives in (file:line evidence, T3) | Floor (per the principle table) | Verdict | Earlier-channel feasibility (Step 3) |

**Verdict** ∈ `{ MOVE-EARLIER, ADD-DUAL-CHANNEL, ALREADY-AT-FLOOR, DORMANT-NOT-WIRED, CANT-MOVE-NEEDS-JUDGEMENT }`.

- Every «data lives in» cell cites `file:line` + the actual line content, or a command + output (T3 — no prose-only).
- Every «already edit-time» / «ALREADY-AT-FLOOR» for a hook is confirmed against `settings.json` wiring (T-CE-A).
- A check whose data is a single file but which currently runs only at pre-push/CI → `ADD-DUAL-CHANNEL` (default), unless Step 3 shows the edit-time channel can't get the data.

### Step 3 — VERIFY the earlier channel actually has the data (T-CE-B — gate every MOVE/ADD)

For each `MOVE-EARLIER` / `ADD-DUAL-CHANNEL` candidate, write the explicit feasibility line:

> At edit-time (PostToolUse Edit|Write) the hook has: **the edited file path + its post-edit content**. This check additionally needs: **\<Y\>**. Reachable deterministically at edit-time? **yes/no** — \<how: read sibling from disk / N/A / needs whole-tree → no\>.

- If the check needs only the edited file → clean ADD-DUAL-CHANNEL.
- If it needs a sibling file (e.g. render drift = source vs RULES.md) → reachable *if* the hook reads the sibling from disk AND handles «the sibling was the file edited» symmetrically → ADD-DUAL-CHANNEL-with-caveat; spell out the caveat.
- If it needs the whole tree / diff range / commit message → NOT edit-time-reachable → KEEP (or pre-push-is-floor).
- If an edit-time companion would **duplicate** an existing pre-push check → that is **dual-channel by design** (T-CE-C); keep both, verdict ADD-DUAL-CHANNEL.

### Step 4 — §1.7 self-reflexive check (this audit applies a discipline lens)

Per [phase-research-coverage.md §1.7](../../../.claude/rules/phase-research-coverage.md), at closing:

- **Forward-check** — the audit's *recommendations* comply with active disciplines: [no-paid-llm-in-ci.md](../../../.claude/rules/no-paid-llm-in-ci.md) (every proposed mechanism deterministic — cite the mechanism per candidate), [build-first-reuse-default.md](../../../.claude/rules/build-first-reuse-default.md) (edit-time companions REUSE the PostToolUse primitive + the `inject-matching-rule.sh` / `check-doc-authority.sh` pattern — not a new engine), [dual-implementation-discipline.md §5](../../../.claude/rules/dual-implementation-discipline.md) (each dual-channel pair gets a `@dual-pair` anchor), [doc-authority-hierarchy.md](../../../.claude/rules/doc-authority-hierarchy.md) (the output patch carries a compliant header). Each with `file:line`.
- **Backward-check** — complete sweep: did you classify **every** check in the Step-1 population, or only a sample? Name the denominator and confirm 100% coverage (this audit's whole point is the *complete* retroactive sweep §6 deferred — a sample is a T4 premature close). Also: does this audit duplicate/extend any prior channel-related work? `grep -rn "earliest reachable\|channel floor\|edit-time companion" docs/ .claude/rules/` — state the relationship.

### Step 5 — REPORT (output research-patch)

`docs/meta-factory/research-patches/2026-MM-DD-channel-earliness-audit.md`. **First line MUST be** the principle-10 scope annotation (exact regex `^<!-- scope:[a-zA-Z0-9.§-]+ -->$`):

```markdown
<!-- scope:channel-earliness-audit -->
# 2026-MM-DD — Channel-earliness audit (the §6-deferred retroactive sweep)

> **Authoritative for:** channel-earliness audit findings (per-check channel-floor verdicts + earlier-channel feasibility).
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists); channel-selection principle — see [.claude/rules/rule-enforcement-channel-selection.md].

## §1 Origin + scope — this IS the retroactive sweep channel-selection §6 deferred (recursive self-application of §1 axis-2)
## §2 Population enumeration (T10) — full check list across 5 surfaces + counts
## §3 Coverage matrix — one row per check (data-location → floor → verdict → feasibility)
## §4 MOVE / ADD candidates — each with Step-3 feasibility line + proposed deterministic mechanism
## §5 KEEP-at-floor list — why each is already as early as its data permits
## §6 Dormant-not-wired findings (e.g. check-kickoff-traps, inject-matching-rule) — latent edit-time channels
## §7 §1.7 forward-check applied (file:line per discipline)
## §8 §1.7 backward-check applied (100%-coverage confirmation + prior-work relationship)
## §9 Self-application (T15) — is this audit a recurring sweep? how to audit this audit?
## §10 DECISIONS-NEEDED (surface non-obvious moves; do NOT decide — reviewer-discipline §2)
```

---

## reviewer-discipline (§2) — surface, do NOT decide

Per [reviewer-discipline.md §2](../../../.claude/rules/reviewer-discipline.md): where a move is **non-obvious** (a real trade-off, not a clear floor call), name it `DECISION-NEEDED: <one-line>` with both options + their downstream consequences, and **stop** — the maintainer or an `/orchestrator` session picks. Likely §10 candidates:

- **`DECISION-NEEDED: audit population P1 vs P1+P2`** — does this sweep cover only the framework's OWN checks (P1, the default), or also the SHIPPED consumer config it prescribes (P2 — eslint/`RULES.md`/`dependency-cruiser` under `templates/` + `preset-next-15-canonical/`)? **Option A (P1 only):** smaller, owner = framework maintainers; the ⭐ boundaries→edit-time lever is then a «P2 audit recommended next» note. **Option B (P1+P2):** larger; the headline P2 win is **dep-cruiser → eslint-plugin-boundaries** (arch check from consumer pre-push → consumer lint/edit-time), but it touches consumer-facing prescription (a product-shape change, not just internal hygiene). Don't pick — surface both.
- Whether to wire the two dormant hooks (`check-kickoff-traps.sh`, `inject-matching-rule.sh`) into `settings.json` now — but note `settings.json` is **agent-self-protected** (maintainer-landed); the audit can only recommend, with the snippet.
- For each `ADD-DUAL-CHANNEL` candidate: is the per-edit standing cost (every Edit/Write fires the hook) worth it vs. leaving it at pre-push? (`#always-on-bloat` tension from channel-selection §5.)
- Sequencing: do the moves ship as N separate follow-up PRs, or batched into one «edit-time companions» umbrella? (Each move is atomic per CLAUDE.md PR strategy; batching is a maintainer call.)

---

## OUT OF SCOPE (T5 — this is an AUDIT, not an implementation)

- **Implementing** any channel move — no new hook, no settings.json edit, no principle-test edit. Each move ships as its **own follow-up PR** after the maintainer accepts the audit.
- **Editing `.claude/settings.json`** — agent-self-protected; only recommend.
- **Re-deriving the channel-selection principle** — it exists ([rule-enforcement-channel-selection.md](../../../.claude/rules/rule-enforcement-channel-selection.md)); apply it, don't rewrite it.
- The only file you `Write` is the OUTPUT research-patch. If you open `Edit`/`Write` on any source (hook, principle, settings, pre-push.ts) → STOP (T5).

---

## WORKTREE (mandatory — main checkout is shared by other active sessions)

A contaminated-branch incident happened 2026-05-22. Per [parallel-subwave-isolation.md](../../../.claude/rules/parallel-subwave-isolation.md):

```bash
git fetch origin staging --quiet
git worktree add -b feat/channel-earliness-audit ../rules-as-tests-aif-ce origin/staging
cd ../rules-as-tests-aif-ce
ln -sfn /Users/art/code/rules-as-tests-aif/node_modules ./node_modules                 # tsx hooks need it
ln -sfn /Users/art/code/rules-as-tests-aif/packages/core/node_modules ./packages/core/node_modules
git branch --show-current      # MUST print feat/channel-earliness-audit before any commit/push
```

Re-run `git branch --show-current` before **each** commit/push (parallel sessions mutate shared state). If `git worktree add` fails → **sequential fallback**, never concurrent shared-dir. When done: `git worktree remove ../rules-as-tests-aif-ce`.

---

## VERIFY (before submitting REPORT)

- [ ] §2 population enumerated across **all 5 surfaces** first; counts match `ls`/`grep` (T10)
- [ ] **Every** check classified — denominator named, 100% coverage confirmed (not a sample — T4/backward-check)
- [ ] Each matrix row's «data lives in» = `file:line` + line content, or command + output (T3, no prose-only)
- [ ] Each «already edit-time» / hook verdict confirmed against `settings.json` wiring (T-CE-A)
- [ ] Each MOVE/ADD candidate has the Step-3 earlier-channel feasibility line (T-CE-B)
- [ ] Each proposed mechanism is deterministic — no LLM (no-paid-llm-in-ci); cite the mechanism
- [ ] Dual-channel framed as ADD-companion-keep-backstop, not drop-the-duplicate (T-CE-C)
- [ ] §1 states explicitly this is the retroactive sweep channel-selection §6 deferred (recursive self-application)
- [ ] Output first line = `<!-- scope:channel-earliness-audit -->` (principle 10) + compliant header (principle 09)
- [ ] §9 self-application is a concrete finding, not «N/A»
- [ ] §10 surfaces non-obvious moves as DECISION-NEEDED, does not decide (reviewer-discipline §2)
- [ ] No `Edit`/`Write` on any source outside the OUTPUT patch (T5)

## REPORT format back to maintainer

```text
## Channel-earliness audit REPORT 2026-MM-DD

**Status:** COMPLETE | PARTIAL (reason: …)
**Population:** N checks (hooks: a wired / b dormant · pre-push sections: c · principles: d · CI: e)
**Verdicts:** MOVE-EARLIER: m · ADD-DUAL-CHANNEL: n · ALREADY-AT-FLOOR: p · DORMANT-NOT-WIRED: q · CANT-MOVE: r
**Top earlier-channel wins:** <1–3 highest-value ADD/MOVE candidates, one line each>
**Dormant hooks found:** <list — exist but not wired in settings.json>
**Research-patch path:** docs/meta-factory/research-patches/2026-MM-DD-channel-earliness-audit.md
**DECISIONS-NEEDED:** <count> (in §10)
**Token cost actual:** ~Xk Opus
```

---

## SELF-NOTE (read before starting)

- The lens is **«where does the data live»**, not «what kind of file is the check». A hook can be at its floor; a principle test can be movable. Re-derive every row (T16).
- A hook *file* in `.claude/hooks/` is not edit-time unless `.claude/settings.json` wires it. Verify wiring; report dormant hooks as a distinct verdict (T-CE-A).
- The default for a single-file check sitting at pre-push/CI is **ADD an edit-time companion (keep the backstop)** — the doc-authority model — not move-and-delete.
- This is an AUDIT. The deliverable is verdicts + evidence. Every move is a separate follow-up PR (T5).
- Don't trust this kickoff's first-pass inventory table — at least one row («already hot») is known-wrong. Verify against source.

<!-- host-verify: none — legacy closed umbrella (done.md): work already accepted; no live host acceptance to declare — retro-marked 2026-08-21 -->
