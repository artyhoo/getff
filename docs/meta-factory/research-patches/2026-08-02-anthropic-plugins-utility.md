<!-- scope:anthropic-plugin-utility-host -->

# Anthropic first-party plugins — pipeline/utility verdict (where do WE use them?)

**Scope (binding, verbatim from kickoff):** «раз они не конкуренты — где они полезны НАМ в нашем pipeline, хернесе, поставке скиллов?» — this is **not** a «are they similar?» verdict (that was [verdict 53c2ec](#see-also), ADOPT-operator + KEEP NARROW-shipped, 0/10 problem-class match); this is the separate **utility** question: where does each first-party plugin fill a *named gap* in `/arch` / `/dispatcher` / `/harvest`, in the maintainer's CC harness, and in what we ship to consumers? Two-axis (operator vs shipped) adjudicated separately per [build-first-reuse-default.md §1.1](../../../.claude/rules/build-first-reuse-default.md).

**Headline answer (W1-W4 in one paragraph):** The first-party roster breaks cleanly into three groups by what each plugin *is*. **(1) `engineering` (the standalone v1.2.0 prompt-shaping pack that 53c2ec evaluated) — KEEP NARROW, no new utility finding**: it was already fully scoped by 53c2ec (0/10 gap matches; one narrow ADOPT-VOCABULARY candidate on the ADR template, out of scope to implement here), and re-deriving its gap-fill table changes nothing. **(2) Two siblings 53c2ec flagged but did not adjudicate — `security-guidance` and `code-modernization` — are where the real utility is**: `security-guidance` ships a **real `decision:"block"` PostToolUse hook** (13 non-md files incl. `hooks.json`, `security_reminder_hook.py`, asyncRewake on `git commit`/`push`) that is structurally identical to our 20 CC hooks and closes a *security-pattern* gap we do not codify; `code-modernization` ships a 9-file orchestration (preflight→assess→map→extract-rules→brief→transform→harden with adversarial behavior-equivalence harness) that has **no counterpart in our contour** — neither `/arch` nor `/pipeline` owns legacy-modernization. **(3) `frontend-design` (the «design plugin» W2 asked about) — operator-only, do NOT ship**: it is a single 56-line aesthetic-direction skill (palette/typography/layout «signature» against generic-AI look), solving a problem class we **do not ship at all** (we ship `design-compare` as an operator-global pixel-diff *engine*, not a generation skill, and ship no UI-design skill via `install.sh`). **Net:** `security-guidance` + `code-modernization` earn a fresh ADOPT-on-operator + flag for a separate prior-art pass; `frontend-design` earns ADOPT-on-operator (the maintainer builds UI) but REJECT-shipped (first-party CC-only, violates AI-/OS-/license-agnostic default, and we have zero shipped design surface to displace). **Falsifier in §A6.**

---

## §A0 — Plugin identity resolution (what = «engineering», what = «design»)

The kickoff's Host fact 1 hypothesised «engineering plugin» = a *bundle* (`code-review` + `security-guidance` + `code-modernization` + `code-simplifier`). That hypothesis is **partly wrong, and resolving it is load-bearing for the rest of the patch.** Two independent probes agree:

| Probe | Command / source | Result |
|---|---|---|
| Host marketplace census | `ls /Users/art/.claude/plugins/marketplaces/claude-plugins-official/plugins/` (39 entries) | **No directory named `engineering` and none named `design`.** Present: `code-review`, `security-guidance`, `code-modernization`, `code-simplifier`, `commit-commands`, `feature-dev`, `hookify`, `claude-md-management`, `frontend-design`, + 30 others (LSPs, `skill-creator`, `session-report`, …) |
| DeepWiki `anthropics/claude-plugins-official` (this session, full-roster ask) | «Does it contain a plugin named 'engineering'? 'design'? Roster + hooks/tests per plugin?» | «There is no plugin named **'engineering'** in the marketplace … there is a plugin named **'frontend-design'**, but no plugin simply named 'design'.» Only `security-guidance` and (separately) `hookify` are confirmed to ship executable hooks. |
| Verdict 53c2ec §2.1 (host-side, inlined corpus) | manifest for the v1.2.0 `engineering` plugin | 53c2ec evaluated a **standalone `engineering` plugin v1.2.0 distributed via `claude.com/plugins/engineering`**, NOT via this marketplace repo. Its 10 skills (architecture, code-review, debug, deploy-checklist, documentation, incident-response, standup, system-design, tech-debt, testing-strategy) are **distinct** from the marketplace plugins of the same/near names. |

**Resolution (binding for this patch):**

- **«engineering plugin» (operator's term) = TWO different artefacts**, both real, both first-party Anthropic:
  1. **The standalone `engineering` v1.2.0 prompt-shaping pack** (53c2ec's candidate) — 10 markdown skills, zero enforcement, distributed off-marketplace. **Already fully adjudicated by 53c2ec.**
  2. **The marketplace engineering-set siblings** — `code-review`, `security-guidance`, `code-modernization`, `code-simplifier`, `feature-dev`, `hookify`, `claude-md-management`, `commit-commands`. These are what the operator most plausibly *also* meant by «engineering plugin» in the host CC harness, because they are the ones actually installed at `~/Library/.../plugins/` and visible in `/plugin`. **These are THIS patch's W1/W4/W5 subject** (53c2ec touched them only as a §3.4 INCONCLUSIVE side-note).
- **«design plugin» (W2) = `frontend-design`** (single skill, 56 lines) — the only design-named plugin in either distribution. There is **no** separate `design` plugin. The marketplace `claude.com/plugins/design` page (WebSearch result 1) is the *category* page that lists `frontend-design`, not a second plugin.

**Why this matters:** conflating (1) and (2) would either (a) re-litigate 53c2ec's closed verdict (T15 — wasteful), or (b) miss the two siblings (`security-guidance`, `code-modernization`) where the actual utility lives. The per-plugin tables below keep them strictly separate.

---

## §A1 — Engineering-set pipeline-utility audit (W1)

Per the kickoff's W1 obligation: for each marketplace engineering-set plugin, does it fill a *named gap* in our `/arch` / `/dispatcher` / `/harvest` pipeline? **T16 per plugin** (problem-class match, not «Anthropic shipped it so adopt»). Enforcement census run this session: `find <plugin> -type f ! -name '*.md' ! -name 'LICENSE*'` per plugin (mirrors 53c2ec's §2.3 discriminator, but here applied to the marketplace plugins 53c2ec did NOT census).

| Plugin | Non-md file count (this session) | What it actually is (body read) | T16 vs our pipeline | Gap filled? |
|---|---|---|---|---|
| `code-review` | **1** (only `plugin.json`) | `/code-review` command launches 5 parallel Sonnet agents (post-hoc, on an existing PR) + Haiku confidence-scorers; filters issues <80 confidence; posts one PR comment. **No rework loop, no gate, no fail-closed.** | **NO overlap.** Our reviewer surface is a *pre-merge multi-seat choreography with `GO\|REVISE\|STOP` rework loop* ([`/dispatcher` §2.4-§2.5](../../../.zcode/skills/dispatcher/SKILL.md), [`/harvest` §4](../../../.zcode/skills/harvest/SKILL.md), `agents/{fidelity-auditor,compliance-verifier,backward-sweep-auditor,review-sidecar}.md`). Upstream is a one-shot *post-comment* bot. Different problem class. | **No** |
| `security-guidance` | **13** (`hooks/hooks.json` + 8 `.py` + `sg-python.sh` + 3 `.py` modules) | **Real executable enforcement.** `hooks.json` wires `SessionStart`→`ensure_agent_sdk.py`, `UserPromptSubmit`+`PostToolUse(Edit\|Write\|MultiEdit)`→`security_reminder_hook.py`, `PostToolUse(Bash git commit/push/gt *)`+`Stop` asyncRewake reviews. `security_reminder_hook.py:282` emits `decision:"block"` (verified this session) — it **BLOCKS the tool call**, not merely advises. Three layers: regex pattern warnings (~25 dangerous patterns: `yaml.load`, `pickle.load`, `innerHTML`, hardcoded secrets…), LLM diff review on Stop, agentic commit review on `git commit`. | **Partial — DIFFERENT problem class, SAME mechanism.** Our 20 CC hooks ([verdict 53c2ec §1](#see-also)) are the *same mechanism* (PostToolUse `decision:block`), but ours codify **framework discipline** (principle tests, trailers, doc-authority, no-paid-llm-in-ci); upstream codifies **security vulnerability patterns** (injection/XSS/SSRF/IDOR/secrets). We ship **no security-pattern layer**. | **YES — security-pattern enforcement gap** (operator axis; see §A3) |
| `code-modernization` | **9** (7 `workflows/*.js` + `topology-viewer.html` + `.jpg`) | Structured modernization choreography: `/modernize-preflight`→`-assess`→`-map`→`-extract-rules`→`-brief`→(`-reimagine`\|`-transform`\|`-uplift`)→`-harden`→`-status`. Discovery writes `analysis/<system>/`; build writes `modernized/<system>/`; **behavior-equivalence test harness** so «you can prove nothing drifted»; HITL approval gate at `/brief`. JS workflows do real work (`extract-rules.js`, `harden-scan.js`, `uplift-migrate.js`, `portfolio-assess.js`). | **NO overlap with `/arch`/`/pipeline`/`/dispatcher` — and that is the finding.** Our contour owns *greenfield idea→design→kickoff→factory→harvest*; it owns **no legacy-modernization contour** (no COBOL/legacy-Java/.NET surface, no rule-extraction, no behavior-equivalence harness). `/arch` §1 delegates *new* design to brainstorming; it does not reverse-engineer existing systems. | **YES — legacy-modernization contour gap** (operator axis; not in our scope to BUILD, flagged §A5) |
| `code-simplifier` | **1** (only `plugin.json`) | Agent that «simplifies and refines code for clarity, consistency, maintainability while preserving functionality». Pure prompt skill, zero enforcement. | **NO overlap.** We ship no code-simplification skill (closest: our discipline *rules* codify anti-patterns as executable tests, but that is framework-discipline, not consumer-code simplification). Different problem class entirely. | **No** |
| `feature-dev` | **1** (only `plugin.json`; 3 agent `.md` + 1 command `.md`) | `/feature-dev` 7-phase guided workflow (discovery→design→implement→review) with 3 agents (`code-architect`, `code-explorer`, `code-reviewer`). Single-session, no factory dispatch, no metering. | **NO overlap.** Our `/arch` §3 already classifies dispatch *tier* and emits a kickoff into a metered factory; `feature-dev` is an in-session linear flow with no routing. Closer to `superpowers:brainstorming` (which `/arch` §1 wraps verbatim) than to our contour. | **No** |
| `hookify` | **13** (`hooks/hooks.json` + 4 hook `.py` + `core/rule_engine.py` + `core/config_loader.py` + `matchers/`) | **Hook-authoring framework.** `/hookify <natural-language behavior>` analyzes the conversation, generates a `.claude/hookify.<slug>.local.md` rule (YAML frontmatter + regex), which `PreToolUse`/`PostToolUse`/`Stop`/`UserPromptSubmit` Python hooks enforce on the next tool call — no restart. | **Partial mechanism overlap, divergent intent.** We author hooks *by hand* (20 `.claude/hooks/*.sh`, each a deliberate codified rule). Upstream *auto-generates* them from conversation patterns. Same PostToolUse mechanism; different authoring model. **Gap candidate (operator axis):** faster hook scaffolding for experimental behaviors before promoting them to committed `.claude/hooks/*.sh` — but our committed hooks MUST stay hand-authored (rules-as-tests thesis: a hook is an executable artefact with a paired-negative test, not a regex a model invented). | **Maybe — hook scaffolding only, never the committed hook itself** (§A4) |
| `claude-md-management` | **3** (2 `.png` screenshots only — zero executable) | Tools to «audit quality, capture session learnings, keep CLAUDE.md current». Pure prompt skill. | **NO overlap.** Our `living-docs-auditor` agent + `/aif-docs` skill + `doc-authority-hierarchy.md` rule own drift-detection against source; upstream is a generic CLAUDE.md-improver prompt. Different problem class (we enforce doc-authority hierarchy; upstream polishes prose). | **No** |
| `commit-commands` | **1** (only `plugin.json`) | `/commit`, `/push`, `/pr` shorthand commands. | **NO overlap.** Our `/harvest` §1 + `/dispatcher` §2.4 own the egress choreography (rebase-on-staging, pre-push sweep, fidelity gate, §1.7 PR body). Upstream is 3 git shortcuts with no gate. | **No** |

**Pipeline-utility tally: of 8 marketplace engineering-set plugins, 2 fill a named gap** (`security-guidance` — security-pattern enforcement; `code-modernization` — legacy-modernization contour), **1 is a maybe** (`hookify` — scaffolding only), **5 fill no gap** (we ship the same-class artefact or it is out of our problem class). The standalone `engineering` v1.2.0 pack (53c2ec's candidate) fills no *additional* gap beyond what 53c2ec already recorded.

---

## §A2 — Design plugin verdict (`frontend-design`, W2)

The kickoff's W2 asked: «там кстати еще и плагин для дизайна есть — его тоже нужно посмотреть и исследовать.» Resolved in §A0: «the design plugin» = `frontend-design` (the only design-named plugin). Body read this session (56 lines, single skill).

**What it solves (verbatim from the skill body):** acts as «the design lead at a small studio known for giving every client a visual identity that could not be mistaken for anyone else's»; produces a compact token system (4-6 named hex palette, 2+ typefaces with a characterful display + body + utility, a layout concept with ASCII wireframes, a single «signature» element); explicitly calibrated against three generic-AI cluster looks (cream/serif/terracotta; near-black/acid-green; broadsheet hairline); two-pass process (brainstorm plan → critique against the brief for templated defaults → build to the revised plan); self-names «reduced motion respected, visible keyboard focus, responsive down to mobile» as a quality floor.

**T16 vs our shipped design surface (the discriminator):**

| Our surface | Where it lives | Problem class | Match vs `frontend-design`? |
|---|---|---|---|
| `design-compare` | `~/.claude/skills/design-compare/` (**operator-global, NOT shipped via `install.sh`**) | Pixel-diff *verification* — сверка свёрстанного UI с макетом, физический порог точности, anchoring, FLR-отчёт | **NO** — verification engine vs generation skill; opposite ends of the design lifecycle |
| `native-css-responsive` | `~/.zcode/skills/native-css-responsive` (**operator-global, NOT shipped**) | Fluid typography via `clamp()`, intrinsic grids, container queries — *responsive CSS technique* | **NO** — CSS implementation technique vs aesthetic-direction design; orthogonal |
| `ui-designer-react` / `ux-react-expert` | `~/.zcode/agents/*.md` (**operator-global agent definitions, NOT shipped**) | React component design / UX review | **PARTIAL** — closest in spirit, but these are *operator's working agents*, not a framework-shipped skill; and they are component-level, not whole-page aesthetic-direction |
| Shipped-via-`install.sh` design skill | **None** — `companions.manifest` has no design plugin; `setup.d/` ships no design skill | n/a | **No shipped surface to displace or complement** |

**Verdict — `frontend-design`:**
- **Operator axis: ADOPT.** The maintainer builds UI (this very repo ships React components in `packages/core/composition/` and templates; the operator runs `design-compare` + `native-css-responsive` + the two design agents daily). `frontend-design` closes a named gap the operator's working set does NOT own: *whole-page aesthetic direction against generic-AI defaults*. It is the only first-party plugin that ships exactly this. `#adoption-shame` («we have design-compare») does not apply — `design-compare` verifies, it does not generate direction. Cost gate: cheap (CC plugin install on the operator's machine; no repo dependency; no shipped change).
- **Shipped axis: REJECT.** (1) It is a **first-party CC-only plugin** — depending on it violates the AI-/OS-/license-agnostic default ([dual-implementation-discipline.md §3](../../../.claude/rules/dual-implementation-discipline.md)). (2) We **ship no design-generation surface** to consumers, so there is nothing to displace and nothing to complement; adopting it as a companion would be *introducing a new shipped surface*, which is a goal change ([README.md#why-this-exists](../../../README.md#why-this-exists)), not an operational call. (3) `companions.manifest` has **no precedent** for recommending a first-party Anthropic plugin (the only `cc-plugin` companions are `superpowers` and `ast-grep`, both third-party). Adding the first first-party one would set a precedent this verdict does not justify.

**Q3 (shipped to consumers?): NO.** `setup.d/companions.manifest` is NOT modified by this verdict (§3 descope). The design axis stays operator-only.

---

## §A3 — Shipped-axis recommendation (W3, per plugin)

The kickoff's W3 asks: should we recommend/ship any of these to consumers via `companions.manifest`? Per [build-first-reuse-default.md §1.1](../../../.claude/rules/build-first-reuse-default.md), the shipped axis is adjudicated separately and defaults to AI-/OS-/license-agnostic core that degrades gracefully when a companion is absent.

| Plugin | Shipped-axis verdict | Rationale |
|---|---|---|
| `engineering` v1.2.0 (standalone pack) | **KEEP NARROW** (unchanged from 53c2ec) | 53c2ec §4.3 already settled this; no new evidence. The pack changes nothing about what we install into a consumer. |
| `code-review` | **KEEP NARROW** | One-shot PR-comment bot; no executable closure of a gap in our consumer-install surface. Graceful-coexist. |
| `security-guidance` | **KEEP NARROW (operator ADOPT; see §A4)** — do NOT ship | The hook is real and good, but (a) it is **CC-specific** (CC `hooks.json` + PostToolUse `decision:block` contract — a Cursor/Aider/Codex consumer cannot run it), (b) shipping a *security-pattern* layer as a mandatory companion would change the framework's scope (we codify *framework discipline*, not consumer-app security), and (c) `dual-implementation-discipline.md §3` — a hard companion dependency violates the agnostic default. The maintainer should ADOPT it on the operator axis (§A4); consumers do not. |
| `code-modernization` | **KEEP NARROW** | Legacy-modernization is out of the framework's shipped scope entirely; shipping it as a companion would claim a surface we do not own. |
| `code-simplifier`, `feature-dev`, `hookify`, `claude-md-management`, `commit-commands` | **KEEP NARROW** each | No shipped-surface gap; all either out-of-scope or already covered by our own artefacts. |
| `frontend-design` | **REJECT** (shipped) | See §A2 — first-party CC-only; no shipped design surface to displace; no precedent for a first-party companion. |

**Net shipped-axis result: ZERO plugins added to `companions.manifest`.** The manifest (5 entries: `superpowers`, `runtime-bridge`, `deepwiki`, `ast-grep-cli`, `ast-grep`) is unchanged. No first-party Anthropic plugin becomes a companion. This is consistent with 53c2ec §4.3 and with the dual-implementation discipline.

---

## §A4 — Operator-axis recommendation (W4 — what the maintainer enables locally)

The kickoff's W4: operator explicitly said «в своих процессах (разработки и обвязки)». 53c2ec §4.2 gave a blanket ADOPT-operator for the skills we do not own. This patch sharpens it per-plugin with the new evidence (especially that `security-guidance` is a real blocking hook):

| Plugin | Operator-axis verdict | Maintainer action |
|---|---|---|
| `security-guidance` | **ADOPT — highest-value operator plugin in the roster.** It is the only first-party plugin that ships a **real `decision:"block"` PostToolUse hook** for ~25 dangerous security patterns (injection/XSS/SSRF/IDOR/secrets/unsafe-deserialization). It closes a gap our 20 CC hooks do not cover (we codify framework discipline, not app-security patterns). Ships enabled-by-default in CC ≥ v2.1.144. | **Enable on the operator's CC.** Already marketplace-installed; confirm `SECURITY_GUIDANCE_DISABLE` is unset. Optional: drop a `~/.claude/claude-security-guidance.md` with repo-specific rules (e.g. «never `process.env` directly in `packages/`»). **Do NOT add to `companions.manifest`** (§A3). |
| `code-modernization` | **ADOPT — conditional, only when the maintainer faces a legacy-modernization task.** 9-file orchestration with behavior-equivalence harness; no counterpart in our contour. | Enable if/when a modernization task arises. Not relevant to daily framework work. |
| `frontend-design` | **ADOPT — the maintainer builds UI.** See §A2. | Enable on the operator's CC (it is auto-invoked for frontend work per its README). |
| `hookify` | **REFERENCE / experimental-scaffold only.** Useful for *scaffolding* an experimental hook fast (`/hookify <behavior>` → `.local.md` rule), but **a committed `.claude/hooks/*.sh` must remain hand-authored** (rules-as-tests thesis: a hook is an executable artefact with a paired-negative principle test, not a model-invented regex). | Use for throwaway behavior experiments; promote to a committed hook + principle test only after the behavior stabilises. Never commit a `hookify.*.local.md` as the enforcement artefact. |
| `engineering` v1.2.0 (standalone pack) | **ADOPT (53c2ec §4.2, unchanged)** for `standup`, `incident-response`, `debug`, `deploy-checklist`, `documentation`, `tech-debt` — skills we do not own. | Per 53c2ec; no change. |
| `code-review`, `code-simplifier`, `feature-dev`, `claude-md-management`, `commit-commands` | **SKIP (own-stack wins or out of scope).** We ship a same-class or stronger artefact for each: `code-review` → our multi-seat rework loop; `claude-md-management` → `living-docs-auditor` + `doc-authority-hierarchy.md`; `commit-commands` → `/harvest` §1; `code-simplifier`/`feature-dev` → out of our daily scope or covered by `/arch`. | None. |

**Operator-axis net: enable `security-guidance` + `frontend-design` now; enable `code-modernization` on demand; treat `hookify` as scaffolding-only; skip the rest.** This sharpens (does not contradict) 53c2ec §4.2.

---

## §A5 — Sibling-plugins flag (W5 — worth a separate pass?)

The kickoff's W5: engineering-prior-art §3.4 + §5 flagged `security-guidance` (PostToolUse hooks) and `code-modernization` (subagents + orchestration) as structurally closer to us. Operator did not ask for a full verdict on them — only a one-line flag. This patch's §A1 has now produced the evidence 53c2ec lacked:

| Sibling | Standalone prior-art pass warranted? | Why |
|---|---|---|
| `security-guidance` | **YES — flag for a separate pass.** §A1 confirmed it ships a *blocking* PostToolUse hook (not advisory) — structurally identical mechanism to our 20 CC hooks. The question a full pass would answer: do its ~25 security patterns + its `decision:"block"` contract give us a *reusable enforcement-pattern vocabulary* (SSOT ADOPT-VOCABULARY) for a future consumer-side security-rule lane we do not own? This patch records the flag + the evidence; the full T16/SSOT verdict is a separate stage (operator-approved). |
| `code-modernization` | **YES — flag, lower priority.** §A1 confirmed a 9-file orchestration with behavior-equivalence harness and no counterpart in our contour. A full pass would answer: is legacy-modernization a contour we should *add* (BUILD) or always *reference* (out of scope)? Likely out of scope (our thesis is framework-discipline-as-tests, not legacy rewrite), but the behavior-equivalence-harness *pattern* may be reusable vocabulary. |
| `hookify` | **No full pass — adjudicated here (§A4).** REFERENCE / scaffolding-only is this patch's verdict; nothing a deeper pass would add. |

**Both flags are recorded, NOT actioned** (§3 descope — zero build, no new skill/rule/agent, no SSOT row for them in this PR beyond the single #234 row that names the whole utility question).

---

## §A6 — Falsifier (per verdict)

What evidence, if it materialised, would flip a verdict?

- **`security-guidance` operator-axis ADOPT → REJECT:** if a live-dogfood trial shows its `decision:"block"` fires false-positives on our normal framework-discipline edits (e.g. blocks a legitimate `process.env` in a test fixture), making it net-negative on the maintainer's flow. Mitigation: the kill-switch `SECURITY_GUIDANCE_DISABLE=1` and per-layer toggles exist.
- **`security-guidance` shipped-axis KEEP NARROW → ADOPT/ADAPT:** if (a) Anthropic publishes the hook contract as harness-agnostic (a Cursor/Aider consumer could run it too), AND (b) we decide to own a consumer-side *security-pattern* lane (a goal change, not an operational call). Neither holds today.
- **`code-modernization` → BUILD:** if the framework's scope expands to include legacy-modernization as a first-class contour (a goal change). Out of scope today.
- **`frontend-design` shipped REJECT → ADOPT:** if (a) we decide to ship a design-generation surface to consumers (we currently ship none), AND (b) a harness-agnostic equivalent exists or we build one. Both absent today.
- **`engineering` v1.2.0 verdicts:** falsifiers already stated in 53c2ec §7; unchanged here.

---

## §1.7 self-check — forward + backward

### Forward-check (each with file:line evidence)

- **`build-first-reuse-default.md §1/§1.1/§3`** — seven verdicts (§1 table at `.claude/rules/build-first-reuse-default.md:41-49`), two-axis split (§1.1) honoured: §A3 (shipped) and §A4 (operator) adjudicated separately; own-stack-first run per-plugin in §A1 (the «our surface» column IS the own-stack sweep). Mechanism run: WebSearch ×2 + DeepWiki ×1 + host-plugin census (`find ... ! -name '*.md'`) this session, not memory. **COMPLIES.**
- **`ai-laziness-traps.md §2 T16`** — per-plugin problem-class match: §A1 carries one T16 row per marketplace engineering-set plugin (8 rows) + §A2 one row for `frontend-design`. No plugin-level «useful / not useful» without a per-capability match. **COMPLIES.**
- **`dual-implementation-discipline.md §3`** — AI-/OS-/license-agnostic default: §A3 refuses to make any first-party CC-only plugin a mandatory companion; §A2 REJECT-shipped on `frontend-design` precisely because CC-only violates the agnostic default. **COMPLIES.**
- **`doc-authority-hierarchy.md`** — this patch is `Class: B` (process/utility verdict, not a load-bearing gate); it does not edit any rule/skill/agent/hook (§3 descope). It references but does not modify `/arch`, `/dispatcher`, `/harvest`, `companions.manifest`, or verdict 53c2ec. **COMPLIES.**
- **`recommendation-laziness-discipline.md` (H1)** — every ADOPT/REJECT/KEEP NARROW in §A2-§A4 cites either verdict 53c2ec (§2 per-capability table) or this session's host-plugin census + body reads, and each carries a falsifier in §A6. No unbacked verdict. **COMPLIES.**

### Backward-check — sibling-surface sweep (T21 structural counter: enumerate surfaces OUTSIDE the diff)

Change class = *utility/gap-fill verdict over first-party Anthropic plugins*. The diff touches ONLY (a) this research-patch and (b) the SSOT row #234 append. The sibling surfaces a cold sweep must reach:

| Sibling surface | Verdict | Evidence |
|---|---|---|
| Verdict 53c2ec (the standalone `engineering` pack) | **SWEPT-CLEAN — cited, not re-litigated, not contradicted** | §A0 resolution keeps (1) the standalone pack and (2) the marketplace set strictly separate; 53c2ec's ADOPT-operator + KEEP NARROW-shipped is inherited unchanged for (1). This patch adjudicates (2), which 53c2ec left as a §3.4 INCONCLUSIVE. |
| `2026-07-31-orchestration-contour-prior-art-comparison.md` (mattpocock/superpowers/mission-control) | **SWEPT-CLEAN — different candidate set** | That patch compared *orchestration contour* upstreams; this patch compares *first-party Anthropic utility plugins*. No overlap in candidates; no contradiction. |
| SSOT rows #64 (SDD), #111 (`/dispatcher` BUILD), #149 (CC plugin schema), #84 (`claude plugin install`) | **SWEPT-CLEAN — instantiated/referenced, not modified** | §A3 ships nothing new; #149's CC-plugin schema and #84's install mechanism are *referenced* as the channel through which the operator-axis ADOPT happens, not changed. |
| `companions.manifest` + `setup.d/15-companions-stack.sh` | **SWEPT-CLEAN — explicitly NOT edited (§3 descope)** | §A3 nets to zero companion changes; the manifest's 5 entries are unchanged. No silent supersession of `superpowers`/`ast-grep`. |
| `/arch`, `/dispatcher`, `/harvest` SKILL.md | **SWEPT-CLEAN — referenced as the pipeline being audited, not edited** | §A1's «our pipeline stage» column cites these skills as the gap-baseline; the skills themselves are not modified. |
| `dual-implementation-discipline.md §3` | **SWEPT-CLEAN — instantiated, not modified** | §A2/§A3 apply the agnostic-default doctrine to refuse first-party companions; the rule is not edited. |

**T21 discriminator:** the surface list above is NOT the diff's own files (diff = patch + SSOT row; sweep = 6 sibling surfaces outside the diff). The backward-check enumerates the sibling verdicts/rules/manifest this patch could have silently contradicted; it does not restate the diff.

---

## See also

- **Verdict 53c2ec** (the standalone `engineering` pack, ADOPT-operator + KEEP NARROW-shipped, 0/10 problem-class match) — lives in worktree `rules-as-tests-aif-feature-anthropic-engineering-prior-art-53c2ec-…` at `docs/meta-factory/research-patches/2026-08-01-anthropic-engineering-plugin-prior-art.md`; **NOT yet on staging** at the time of this patch. This patch inherits 53c2ec's verdict for the standalone pack (§A0) and adjudicates the marketplace siblings 53c2ec flagged but did not resolve (§A1, §A5).
- [`build-first-reuse-default.md`](../../../.claude/rules/build-first-reuse-default.md) — governing rule (§1 verdicts, §1.1 two axes + own-stack-first).
- [`dual-implementation-discipline.md §3`](../../../.claude/rules/dual-implementation-discipline.md) — AI-/OS-/license-agnostic default that grounds every shipped-axis REJECT/KEEP NARROW here.
- [`2026-07-31-orchestration-contour-prior-art-comparison.md`](2026-07-31-orchestration-contour-prior-art-comparison.md) — sibling prior-art patch (mattpocock/superpowers/mission-control); methodological precedent for per-capability T16.
- [`prior-art-evaluations.md`](../prior-art-evaluations.md) — SSOT; new row #234 appended by this patch; sibling precedents at rows #64, #84, #111, #149.
- Host plugin marketplace (read directly this session): `/Users/art/.claude/plugins/marketplaces/claude-plugins-official/plugins/` — the 39-plugin roster; `security-guidance/hooks/hooks.json` + `security_reminder_hook.py:282` (`decision:"block"`) are the load-bearing evidence for §A1.
