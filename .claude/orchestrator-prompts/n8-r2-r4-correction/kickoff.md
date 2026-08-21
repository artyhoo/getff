# Follow-up — N8 R-phase findings correction (R2 floor + R4 arXiv verification)

> **Type:** correction R-phase. Mode A inline `Agent` on Opus, `isolation: "worktree"`. Read-only research (free channels) + edits to ONE merged file. No commit/push/PR by worker — orchestrator handles git.
> **Origin:** post-merge audit of PR #158 (merged to `staging` 2026-05-22). Two substance gaps surfaced; maintainer approved a separate task to fix them.
> **Authoritative for:** this correction's scope, evidence requirements, done-criteria.
> **NOT authoritative for:** the N8 question — see [research-patches/2026-05-22-deterministic-offload-autonomy-economy.md](../../../docs/meta-factory/research-patches/2026-05-22-deterministic-offload-autonomy-economy.md); project goal — README#why-this-exists.

## §0 — Read first (empty context)

- WORKDIR for dispatch: own git worktree off **`staging`** (the target file lives on staging only, NOT on main): `cd /Users/art/code/rules-as-tests-aif && git worktree add ../rat-n8-correction staging && ln -s /Users/art/code/rules-as-tests-aif/node_modules ../rat-n8-correction/node_modules`.
- Target file (already merged, you EDIT it in place): `docs/meta-factory/research-patches/2026-05-22-n8-rphase-findings.md`.
- Skim rails (auto-loaded): [no-paid-llm-in-ci.md](../../../.claude/rules/no-paid-llm-in-ci.md), [phase-research-coverage.md §1](../../../.claude/rules/phase-research-coverage.md), [ai-laziness-traps.md §2](../../../.claude/rules/ai-laziness-traps.md).

## §1 — The two gaps to fix (and nothing else — no scope creep)

### Fix A — R4 arXiv link-verification (load-bearing; the part that bit us)
R4's local-model viability verdict leans on **arXiv 2604.02367** (and references 2603.19639, 2604.05150). These were never link-verified — they could be hallucinated. For **each** of the three arXiv IDs:
1. WebFetch `https://arxiv.org/abs/<ID>` (or WebSearch the ID + title). **Paste the fetched title + abstract snippet as evidence** in your REPORT — not a memory paraphrase (T3, T12).
2. Classify each: **VERIFIED** (exists, says what R4 claims) / **MISCITED** (exists, says something else — quote the divergence) / **NOT-FOUND** (no such paper).
3. Edit the file: any NOT-FOUND or MISCITED arXiv ref → remove the claim or downgrade it to `INCONCLUSIVE-source-unverified`, and adjust the R4 verdict text so it no longer rests on an unverified source. VERIFIED refs → add the resolved title inline so the citation is checkable.

### Fix B — R2 candidate-floor honesty (line 71)
Plan-of-record §3 R2 requires **≥3 candidates per category**. The file has 8 candidates across 6 categories (most categories = 1 candidate), yet line 71 asserts *"T1 floor met"* by conflating the candidate-count floor with the ≥3-**phrasings** floor. Pick ONE:
- **B1 (preferred if cheap):** actually add candidates via DeepWiki/WebSearch (≥3 phrasings each, verifiable source per candidate) until each thin category reaches ≥3, then the claim becomes true.
- **B2 (honest fallback):** rewrite line 71 to state the floor is **NOT** met — e.g. *"T1 candidate-floor NOT met: 8 candidates / 6 categories (most categories n=1). Coverage insufficient to conclude category-completeness; ≥3-phrasings floor was met but ≠ ≥3-candidates floor. Treat R2 verdicts as provisional."* (T14 — clean survey + thin coverage = "insufficient to conclude", never "floor met").

Do **not** touch anything outside Fix A and Fix B (no R1/R3/R5 edits, no new sections beyond what A/B require).

## §2 — Traps active ([ai-laziness-traps.md §3](../../../.claude/rules/ai-laziness-traps.md), enumerated — not blanket)

T3 (no prose-only — paste the actual WebFetch/WebSearch output for every arXiv ID and every new R2 candidate), T12 (verify arXiv at fetch-time, not from training memory — your cutoff predates these 2026 IDs), T14 (don't relabel thin coverage as "floor met" — that's the bug being fixed; do not reintroduce it), T16 (a new R2 candidate must match our problem-class — autonomous-loop cost/dispatch — not just share a keyword). Domain trap **T-N8corr-A — "verify-by-plausibility":** an arXiv ID *looks* well-formed (`2604.02367`) so it's tempting to assume it resolves. Counter: a well-formed ID is not evidence of existence — only the fetched abstract is.

## §3 — §1.7 + constraints
- Forward-check: free channels only (`no-paid-llm-in-ci`); the file keeps its doc-authority header; you do not make strategy decisions (`reviewer-discipline`).
- Backward-check: no new rule introduced → no sweep owed. This is a substance correction to an existing patch.
- Append a short `## §8 — Correction log (2026-05-22)` to the file recording: arXiv verdicts (the 3 classifications), which Fix-B option you took, and a one-line "what changed + why".

## §4 — REPORT (to orchestrator; you do NOT commit/push/PR)
- arXiv table: ID → VERIFIED/MISCITED/NOT-FOUND + pasted title/abstract evidence.
- R2: which option (B1 with new candidates+sources, or B2 rewrite) + the exact new/edited line text.
- `git diff --stat` and the diff of the target file.
- Confidence with predicates (T6), not bare "high".

## §5 — Done-criteria (orchestrator accepts only on evidence)
1. All 3 arXiv IDs classified with **pasted fetch evidence** (not paraphrase).
2. R4 verdict no longer rests on any NOT-FOUND/MISCITED source.
3. Line 71 is either true (B1: ≥3 verifiable candidates/category) or honestly downgraded (B2).
4. Correction-log §8 appended.
5. Edits confined to Fix A + Fix B (diff shows nothing else).
6. No commit/push/PR by worker.

<!-- host-verify: none — legacy closed umbrella (done.md): work already accepted; no live host acceptance to declare — retro-marked 2026-08-21 -->
