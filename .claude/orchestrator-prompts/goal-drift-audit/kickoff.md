# goal-drift-audit — verify the docs have not redefined the project's goal/philosophy/principles

> **Type:** R (audit the always-on doc corpus for goal-drift) → I (mechanizable findings → standing gate; judgment findings → research-patch). Single session. Base: staging.
> **Goal:** prove that no live documentation has silently re-defined or violated the project goal (`README#why-this-exists`), its philosophy («documents lie; tests don't»; methodology ≠ goal), or its principles. Recursive self-application: the audit itself is an ai-doc and must obey what it checks (T15).

## §0 Goal SSOT — the single source of truth (do NOT relitigate)

- **`README.md#why-this-exists`** owns the project goal, methodology, and design invariants. Every other doc is **subordinate** and must point UP to it, never redefine it.
- **Methodology ≠ goal.** Recursive self-application is a *quality signal* (GCC/rustc bootstrap analogy), explicitly **not** the goal (`CLAUDE.md:16`, `docs/meta-factory/EXECUTION-PLAN.md:22`). Any doc that elevates methodology to «north star / central thesis / main goal» has drifted.
- Origin incident this audit guards against: 2026-05-09 — `EXECUTION-PLAN.md §1` silently re-defined the goal as «recursive self-application is the north star», uncaught for months (`.claude/rules/doc-authority-hierarchy.md:7`).

## §1 Scope

**Full content audit (every line read):**
`README.md`, `CLAUDE.md`, `.claude/session-bootstrap.md`, `.claude/rules/*.md` (all), `docs/meta-factory/EXECUTION-PLAN.md`. (~2580 lines total — small, audit inline; do NOT sample, read all.)

**Header-only check (do NOT audit content — frozen/closed by Artifact Ownership Contract):**
`docs/meta-factory/PROPOSAL.md`, `docs/meta-factory/retros/**`. For these, verify ONLY that the `Authoritative for` / `NOT authoritative for project goal` header is present and correct — frozen docs may not be rewritten, so content findings are non-actionable; a missing/wrong subordination header is the only finding class.

**Special focus:** the just-merged ai-doc-audit umbrella (#417–#423) compressed `.claude/rules/*` — verify the compression did NOT drop `NOT authoritative for goal` headers or the BFR satellite-doctrine goal-subordination. Diff the touched rules against pre-#417 if in doubt.

## §2 Rubric = `doc-authority-hierarchy.md §4` anti-patterns (do NOT invent new criteria)

| # | Criterion | Instrument (deterministic where possible) | "violation" = |
|---|---|---|---|
| 1 | `#operational-doc-redefines-goal` | `grep -rin 'north.star\|central thesis\|main goal\|primary goal\|the goal is'` over scope; **then read each hit in context** | a doc *uses* the framing to define its own goal — NOT one that *warns against* it (all current hits are guard-text; see §3 T-trap) |
| 2 | `#missing-authority-header` | `npm run -w packages/core test:principles` (principle 09) + `grep 'Authoritative for:'` | a scoped doc lacks the header |
| 3 | `#contradicting-authority-claims` | enumerate every `Authoritative for:` line; confirm **exactly one** doc claims authority for the *goal* (README) | ≥2 docs claim goal-authority without a subordinate marker |
| 4 | `#frozen-doc-still-edited` | `git log --oneline -- PROPOSAL.md docs/meta-factory/retros/` — classify each commit header/typo/link vs substantive | a frozen doc got a substantive content edit |
| 5 | methodology-as-goal | `grep -rin 'recursive self-application'` + read each — is it ever named as «the goal / north star» rather than «quality signal»? | methodology elevated to goal anywhere |
| 6 | principles intact | `npm run -w packages/core test:principles` green | any principle test red |

## §3 Disciplines (mandatory — this audit is itself subject to them)

- **T15 (self-application):** the verdict doc you produce is an ai-doc — it must carry its own `Authoritative for:` header and a `<!-- scope:goal-drift-audit -->` first line, and must NOT itself claim goal-authority. Audit your own output against §2 before shipping.
- **T3 (no prose-only):** every PASS/finding carries its instrument output (grep line with file:line, test result, git log line). No "looks fine".
- **T7 (adversarial — the load-bearing one):** criterion 1's grep only catches the *literal* phrases. Write and run a counter-prompt: «if a doc redefined the goal WITHOUT the words north-star/thesis — e.g. by stating a different goal plainly in an authoritative voice — where would it be? what would it look like?» Read the §1-authoritative voice of each rule's `Authoritative for:` line against README's goal. Semantic drift without the trigger words is the real risk; the grep is necessary, not sufficient.
- **mention-vs-use (do NOT false-positive):** EVERY current `north star` hit in the corpus is the docs *warning against* drift (e.g. `CLAUDE.md:16` «Do not elevate to «north star»», `EXECUTION-PLAN.md:17` «earlier framing … drifted; corrected»). A gate that flags guard-text is the `narrow-B` FP=84% failure (`docs/meta-factory/research-patches/2026-05-25-narrow-b-benchmark.md`). Distinguishing *use* from *mention* is **judgment, not mechanical** → never gate it (`#gate-where-judgment-needed`, `rule-enforcement-channel-selection.md §5`).

## §4 Deliverable

1. `docs/meta-factory/research-patches/<YYYY-MM-DD>-goal-drift-audit.md` (CANON verdict): a `doc × criterion` table, each cell PASS/FINDING with instrument output quoted (T3). Overall verdict: clean / N findings.
2. **For each mechanizable finding-class → standing gate (Layer 1), per `README#why-this-exists` "earliest reachable channel":** extend `packages/core/principles/09-doc-authority-hierarchy.test.ts` (it already owns the header machinery + `REQUIRED_HEADER_DOCS`) to assert criterion 3 («exactly one doc is authoritative-for-goal») and/or criterion 4 (frozen-doc edit-class). A one-time audit decays; a principle test does not. Ship as paired-negative test (principle 02 discipline).
3. **For judgment-only findings (Layer 2):** record in the verdict patch; the always-on `CLAUDE.md:16` guard line is the existing injection channel — note if it needs strengthening.
4. Any *content* drift found in an always-on doc → fix in the same PR (header repair / re-subordinate the framing). Frozen-doc header gaps → fix header only. → PR to staging, all principle tests green.

## §5 Anti-scope
- Do NOT rewrite frozen docs' content (`PROPOSAL.md`, retros) — header-only.
- Do NOT invent a new goal rubric — the rubric IS `doc-authority-hierarchy.md §4`.
- Do NOT add a literal-grep CI gate for north-star language (FP=84%, `narrow-b-benchmark.md`) — mechanize only the structural criteria (3, 4), leave use-vs-mention to the session sweep.

## §6 AI-laziness traps (cite + apply per `.claude/rules/ai-laziness-traps.md §2`)
Active for this audit: **T1** (sampling floor — read ALL ~2580 lines, do not sample 3 rules), **T3** (instrument every finding), **T7** (run the adversarial semantic counter-prompt, criterion 1 grep is not enough), **T14** (clean grep + low semantic coverage ≠ "no drift" — distinguish), **T15** (audit your own verdict doc), **T16** (this audit is NOT the same as the #417-423 reconcile — that scored *compression quality*; this scores *goal-fidelity* — different problem class).
Domain-specific: **T-GDA-A** — «tempted to grep north-star, get only guard-text hits, declare clean» — that is criterion 1 done at the grep floor; the real check is T7's semantic read of each authoritative voice against README.

<!-- host-verify: none — legacy closed umbrella (done.md): work already accepted; no live host acceptance to declare — retro-marked 2026-08-21 -->
