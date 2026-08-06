# Skill `description:` trigger inventory — before / after the S-I trim

> **Authoritative for:** the acceptance evidence for stage S-I items P-I1 / P-I2 — what each skill
> description's trigger vocabulary was before the trim, what it is after, and the per-phrase verdict
> for everything the mechanical diff flagged as lost.
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists).
> The description-authoring standard itself — that is `superpowers:writing-skills` (SDO section) and
> [`.claude/rules/skill-description-quality.md`](../../../.claude/rules/skill-description-quality.md).

**Measured on the host, 2026-08-06/07, against `origin/staging` at `97b10bed50`** (post-S-G, so the
baseline is the one the S-I kickoff §3 item 5 requires — it did not move: S-G edited skill *bodies*,
not descriptions).

## §1 Why the trim, and what it is allowed to remove

The harness keeps every skill's `description:` resident so it can route between skills. Over budget
it truncates them, which degrades routing for **every** session. The trim therefore removes bytes
that do not serve routing and keeps every byte that does.

`superpowers:writing-skills` (SDO §1) states the rule this trim applies: a description describes
**only when to use the skill**, never what it does — «when a description summarizes the skill's
workflow, an agent may follow the description instead of reading the full skill content». So the
workflow summaries removed below were not merely *waste*: they were an active routing hazard, and
removing them is a correctness fix that happens to also free bytes.

**Removable:** workflow/process summaries, ownership prose («owns X, does NOT own Y»), mechanism
detail, restatements of the body, references to sections of the skill's own body.
**Never removable:** trigger phrases in any language, symptom wording, error strings, tool names,
and the negative triggers («NOT for …») that route *away* from the skill.

## §2 Budget — before → after

| Population | Files | Before | After | Δ | Gate |
|---|---|---|---|---|---|
| project `.claude/skills/*/SKILL.md` | 14 | 9,497 B | **6,253 B** | −34% | ≤ 6,800 B ✅ |
| user `~/.claude/skills/*/SKILL.md` | 6 | 4,591 B | **3,014 B** | −34% | ≤ 3,200 B ✅ |
| largest single description | — | 1,289 B (`orchestrator`) | **779 B** (`self-reflection`) | — | ≤ 800 B ✅ |

Extractor (binding — description-only, stops at the next top-level key):

```bash
awk '/^description:/{d=1;print;next} d&&/^[A-Za-z_-]+:/{exit} d&&/^---$/{exit} d{print}'
```

The rev-4 form of this measurement printed from `description:` to the closing `---`, sweeping
`allowed-tools` / `argument-hint` / `model` into the number (10,719 B vs 9,497 B, +11.4%) — and a
gate on it would have been satisfiable by deleting `allowed-tools` entries, i.e. by regressing the
permission surface. Corrected before any trimming.

## §3 Per-skill verdict on everything the mechanical diff flagged

Method: tokenise each description before and after (split on `,;.!?()[]|`, `—`, `: `), diff the
sets, then **read every flagged item by hand**. The count alone is not the instrument — most
flagged items are exactly the workflow prose the trim targets, and several are the same phrase
re-quoted with different punctuation. This mirrors the T21 lesson in
[`ai-laziness-traps.md §2`](../../../.claude/rules/ai-laziness-traps.md): a syntactic proxy over a
semantic question produces both false positives and false negatives, so it informs the judgment
instead of replacing it.

| Skill | Flagged | Workflow prose (intended removal) | Same phrase, different punctuation (false positive) | **Real trigger loss → action** |
|---|---|---|---|---|
| `ai-doc` | 0 | — | — | untouched |
| `aif-doctor` | 12 | mutation/GO policy, «read-only diagnosis runs autonomously» | «a task is stuck/crash-looping» → «stuck or crash-looping» | «Invokable when the dispatcher is NOT running» → **RESTORED** |
| `arch` | 17 | the whole §1.5/§2/exit-routing summary | — | none |
| `claude-glm-executor-handoff` | 23 | ownership block, behavioural-delta list | `"GLM executor"`, `"implement-worker GLM"`, `model: glm-5.2` — all kept unquoted | none |
| `dispatcher` | 13 | the 7-step loop enumeration | «does not plan … /pipeline» → «NOT for planning — … are /pipeline» | none |
| `harvest` | 7 | egress mechanism + sweep detail | — | none |
| `night-mode` | 9 | «thin layer over SDD», the four added-capabilities list | — | none |
| `pipeline` | 6 | non-CC-harness paragraph (body content) | «invoked explicitly via /pipeline slash command only» → shortened | none |
| `rule-research` | 1 | the bridge mechanism sentence | — | none |
| `rule-tests` | 3 | «write or repair … quote the tool verdict» | «that is /rule-research» → «NOT for creating new rules (/rule-research)» | none |
| `self-reflection` | 6 | «before closing the recommendation, run §1.7 …» | «auto-trigger on keywords «правило» → «auto-trigger on «правило»» | none — the full keyword + path list is kept verbatim |
| `story` | 12 | «by acts», «engaging language», AIF_HOOK_LANG note | all five user phrases re-quoted `"…"` → `«…»` | none |
| `template-audit` | 9 | Step-1/Step-2 description, taxonomy reference | — | none |
| `tool-bootstrapping` | 2 | «user mentions …» framing | — | «memory persistence for tools» → **RESTORED** |
| `ai-docs` (user) | 0 | — | — | untouched |
| `design-compare` (user) | 2 | — | both are leading-word artefacts («нужно доказать…» → «доказать…») | none |
| `native-css-responsive` (user) | 10 | «нативная адаптивная вёрстка … без фреймворков» framing | `clamp()`, `container queries`, `dvh/svh`, `intrinsic grid`, `breakpoints` all kept | none |
| `orchestrator` (user) | 11 | «Старшая планирует и делегирует…» (workflow), pointer to `references/queue-mode.md` | «1 сообщение = 1 правка» (clarifier, not a trigger) | none |
| `pr-template-multi-phase` (user) | 6 | the entire what-it-provides block | — | none |
| `uniq-rewrite` (user) | 9 | the two-mode protocol description | detector names + all eight user phrases kept | none |

**Two restorations, both applied before the gate was declared green** — `tool-bootstrapping`
(«memory persistence for tools») and `aif-doctor` («Invokable when the dispatcher is NOT running»).
Neither was caught by the byte gate; both were caught by reading the flagged list.

## §4 Honest limit

Trigger-class *completeness* is a semantic judgment. The table above records a human-grade reading
of every flagged item, not a proof — a phrase that was never in the description cannot be detected
as missing by any diff of that description. The falsifier is behavioural: if a routing miss appears
for one of these skills (the harness picks the wrong skill, or none, on a phrase that used to
route), the entry belongs back in its description and this file is the place to record it.

Per [`.claude/rules/skill-description-quality.md`](../../../.claude/rules/skill-description-quality.md)
this expectation is Class C — review-time, not gated — which is exactly why the byte gate is paired
with this file rather than trusted alone.
