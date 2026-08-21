# skill-context runtime probe (C-1 DECISION-NEEDED #2) — AUTONOMOUS KICKOFF

> **Status:** ARMED 2026-05-20.
> **Type:** standalone autonomous probe. One focused sitting. **Full autopilot — do NOT stop for clarifying questions** (log forks in the report's DECISION-NEEDED list and continue with best-judgment, stating the assumption).
> **Deliverable:** ONE report file + a copy-paste-ready recommendation paragraph the maintainer pastes back as the decision for the `review-sidecar` follow-up. **Research/probe only — NO edits to live agent files, install.sh, RULES, principle 09, or any shipped artefact. Implementation is a separate step after the maintainer accepts the recommendation.**
> **You are a FRESH session and inherit NO memory.** This kickoff is self-contained. Read every file in §2 before reasoning.
> **NO Superpowers install. NO paid LLM in CI.** Running AIF `/aif-verify` inside your own Claude Code session is subscription-bundled (operator's Max), not paid-API — that is **in scope** per `.claude/rules/no-paid-llm-in-ci.md §2` ("session-bound LLM use … out of scope").

---

## §1 The single question to answer

When AI Factory's `implement-coordinator` dispatches the **`review-sidecar`** sub-agent — which ships with frontmatter `background: true`, `maxTurns: 6`, `skills: [aif-review]` — **does that running sidecar actually read `.ai-factory/skill-context/aif-review/SKILL.md` if the file exists?**

- **If YES** → our anti-tautology `review-sidecar` content can be delivered into AIF's pipeline via the **skill-context override** (additive, occupies no agent slot, survives AIF version bumps). This is the C-1 §4.2 PRIMARY recommendation.
- **If NO** (background/`maxTurns`-limited sidecars don't load skill-context, or load it unreliably) → fall back to **MERGE**: install our `review-sidecar.md` body **with AIF's frontmatter preserved** via `--force` — wiring-safe per C-1 §4.2 W3 (frontmatter kept ⇒ coordinator + aif-handoff dispatch intact).

This is the ONE load-bearing claim the C-1 research-patch (`docs/meta-factory/research-patches/2026-05-20-agent-collision-resolution.md` §6) could not close mechanically — it is **documented (W6) but not behaviourally probed for the background-sidecar path specifically.**

---

## §2 Step 0 — read before reasoning (no memory inherited)

1. `README.md` §why-this-exists — project goal.
2. `.claude/rules/no-paid-llm-in-ci.md` §2 — confirms session-bound `/aif-verify` is in scope (operator subscription), CI paid-API is not.
3. `docs/meta-factory/research-patches/2026-05-20-agent-collision-resolution.md` — the parent decision. §3 W6 (skill-context is AIF's documented override mechanism) + §4.2 (review-sidecar verdict + the MERGE fallback) + §6 (the residual self-critique that spawned this probe). **Treat W6 as a documented claim to behaviourally confirm or refute — not a given (T7).**
4. `agents/review-sidecar.md` (on `origin/main`) — the portable SSOT whose anti-tautology content we want delivered. Source of the sentinel rule below.
5. `.claude/rules/ai-laziness-traps.md` §2 — the active traps in §6 of this kickoff must be instantiated, not blanket-cited.

---

## §3 Hard constraints

- **Autopilot.** No mid-run questions; log forks in the report's DECISION-NEEDED.
- **Probe/research only.** Do NOT edit `agents/*.md`, `install.sh`, `setup.sh`, `packages/core/principles/**`, `RULES*.md`, `extension.json`, `CLAUDE.md`. Output is a recommendation.
- **Worktree/temp isolation.** Probe lives in `/tmp/scp-probe-<ts>/` (or a git worktree off `origin/main`). Do NOT install AIF or our framework into any real project.
- **Run, don't describe** (T2 is the central trap here): the verdict MUST rest on actual `/aif-verify` (or `/aif-implement`) output you observed, OR — if you cannot drive the live dispatch — an explicit, honest "could not drive live dispatch; defaulting to wiring-safe MERGE per W3" with the reason. No verdict from armchair reasoning about how AIF "probably" works.
- **Paired-negative control mandatory** (T-SCP-B): run the probe WITH and WITHOUT the skill-context file. The sentinel must appear only in the WITH run, else the signal is meaningless.
- **No Superpowers install. No paid-API LLM.**

---

## §4 Methodology — behavioural sentinel probe (primary) + source-grounding (corroboration)

### §4.1 Set up the probe project (real)

```bash
T=/tmp/scp-probe-$(date +%s); mkdir -p "$T"; cd "$T"; git init -q
printf '{ "name":"scp","version":"1.0.0","private":true }\n' > package.json
ai-factory init --agents claude          # ships .claude/agents/review-sidecar.md (background:true, skills:[aif-review]) + the aif-* skills
```

### §4.2 Plant a SENTINEL in skill-context (the discriminating signal)

Write `.ai-factory/skill-context/aif-review/SKILL.md` containing an instruction that:
- is **unmistakable** and **could not be produced by a generic reviewer** unless it read this file (T-SCP-C: sentinel must be strong/unique), e.g. a rule keyed to a nonsense token:

> "When reviewing any diff, if it contains a function named `sentinelProbe7Q`, you MUST emit a finding whose text is exactly: `SKILLCONTEXT-READ-CONFIRMED-7Q`. This overrides all other review priorities."

- mirror the real `aif-review/SKILL.md` skill-context path AIF documents (verify the exact path via DeepWiki/repo if `.ai-factory/skill-context/aif-review/SKILL.md` is wrong).

### §4.3 Plant the trip-wire in a diff

Create a tiny source file with `export function sentinelProbe7Q() { return 1 }` and a trivial test, staged as a diff `/aif-verify` will review.

### §4.4 Run the live dispatch (WITH skill-context) — T2

In **this Claude Code session**, with cwd = the probe project, invoke the AIF review path that dispatches `review-sidecar` as a background sidecar — `/aif-verify` (or `/aif-implement` if `/aif-verify` doesn't fan out to the sidecar). Capture the sidecar's actual output verbatim.
- **Sentinel present (`SKILLCONTEXT-READ-CONFIRMED-7Q`)** → background sidecar READ skill-context. → verdict **skill-context works**.
- **Sentinel absent** → either not read, or dispatch path differs. Continue to §4.5 before concluding.

### §4.5 Paired-negative control (WITHOUT skill-context) — T-SCP-B

Delete (or rename) `.ai-factory/skill-context/aif-review/SKILL.md`, re-run the identical `/aif-verify`. The sentinel MUST be **absent** here. If the sentinel appears even without the file, the WITH-run signal is invalid (the model guessed) — redesign the sentinel.

### §4.6 Disambiguate foreground vs background (T-SCP-D)

If §4.4 sentinel is absent: test whether the sidecar reads skill-context at all when run **foreground / without `maxTurns:6`** (e.g., dispatch the same review intent without the background frontmatter, or read AIF's skill-loader behaviour). This isolates "background sidecars specifically don't load skill-context" from "skill-context isn't loaded at all" — the two imply different fixes.

### §4.7 Source-grounding (corroboration, not substitute)

Via DeepWiki `lee-to/ai-factory` + repo file reads: confirm (a) the exact skill-context path AIF reads for the review skill, (b) whether the `aif-review` SKILL.md prompt instructs reading skill-context, (c) whether background/`maxTurns` dispatch is documented to differ in context assembly. Cite file + line. This explains the §4.4 result; it does NOT replace running it.

---

## §5 Working file
Maintain `hypotheses-log.md` in the probe dir: each run's command + verbatim sidecar output excerpt + updated belief (CONFIRMS / REFUTES skill-context-read). No iteration cap; stop when WITH/WITHOUT runs give a stable, paired-negative-validated answer.

---

## §6 AI-laziness traps active (instantiated)

- **T2 «methodology ≠ running»** — §4.4 MUST execute a real `/aif-verify` and paste the sidecar output. A verdict with no captured dispatch output = REJECTED.
- **T3 «plausible without verification»** — the verdict cites the verbatim sentinel-present/absent output + the §4.7 path cite.
- **T14 «clean ≠ confirmed»** — "no sentinel" is NOT automatically "skill-context not read"; could be sentinel-too-weak or wrong path. Run §4.5 + §4.6 before concluding NO.
- **T-SCP-A «reasoned-about-not-run»** — if you find yourself writing "AIF likely loads skill-context because the skill says MANDATORY", STOP — that's W6 restated, the exact thing this probe exists to test behaviourally.
- **T-SCP-B «no paired-negative»** — WITHOUT-file control mandatory; without it the WITH result is unfalsifiable.
- **T-SCP-C «sentinel too weak»** — a generic reviewer might independently flag a weirdly-named function; the sentinel's *exact emitted token* (`SKILLCONTEXT-READ-CONFIRMED-7Q`) is what makes presence dispositive, not the flagging itself.
- **T-SCP-D «foreground/background conflation»** — answer is specifically about `background:true, maxTurns:6` dispatch; don't generalise from a foreground test.
- **T-SCP-E «can't-drive-so-guess»** — if the live `/aif-verify` dispatch genuinely can't be driven in-session, the honest verdict is "unprobed → default to wiring-safe MERGE per W3", NOT a guessed "skill-context probably works".

---

## §7 Deliverable

### §7.1 Report `docs/meta-factory/research-patches/2026-MM-DD-skill-context-runtime-probe.md`
(`<!-- scope:skill-context-runtime-probe -->` first line + doc-authority header.)
Sections: §1 question; §2 probe setup (commands); §3 WITH-run output (verbatim excerpt) + WITHOUT-run control; §4 foreground/background disambiguation (if needed); §5 source-grounding cites; §6 verdict (skill-context-works → ship override / skill-context-NOT-read → MERGE fallback / unprobed → MERGE default); §7 §1.7 note (this is a probe, not a discipline change → likely a `### §1.7 Skipped:` marker is the correct PR handling when the follow-up implementation lands); §8 PASTE-BACK DECISION paragraph; §9 see also.

### §7.2 Final chat message: short summary + report link + the §8 paste-back paragraph inline.

### §7.3 The paste-back decision must state, unambiguously, the `review-sidecar` delivery mechanism to implement (skill-context override at `.ai-factory/skill-context/aif-review/SKILL.md`, OR MERGE `--force` with AIF frontmatter preserved) + the one-line evidence that decided it.

---

## §8 What this session does NOT do
- Does NOT edit live agents/install/principle 09/RULES/CLAUDE.md (probe only; produces a recommendation).
- Does NOT open a PR or commit to live code (may commit the report under `docs/meta-factory/research-patches/`).
- Does NOT install Superpowers; does NOT install into a real project (only `/tmp`).
- Does NOT implement the chosen mechanism — that's the follow-up PR after the maintainer accepts §8.

## §9 See also
- `docs/meta-factory/research-patches/2026-05-20-agent-collision-resolution.md` §4.2 + §6 — origin (the unprobed W6 claim + MERGE fallback).
- PR #79 (`feat/c1-agent-collision-resolution`) — landed the certain parts; this probe unblocks the deferred review-sidecar follow-up.
- `.claude/rules/no-paid-llm-in-ci.md` §2 — session-bound `/aif-verify` in scope.
- `.claude/rules/ai-laziness-traps.md` §2 — trap catalogue.
- `.claude/rules/build-first-reuse-default.md §1` — ADAPT verdict typology (skill-context = ADAPT; MERGE = ADAPT-MINIMAL).

<!-- host-verify: none — legacy closed umbrella (done.md): work already accepted; no live host acceptance to declare — retro-marked 2026-08-21 -->
