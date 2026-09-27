# getff-ai-site — the D49 page inventory

> **Class:** stage sidecar of [`kickoff-s1.md`](kickoff-s1.md) (`classifyKickoffName` → `sidecar`;
> [`kickoff-staging-placement.md §5.3`](../../rules/kickoff-staging-placement.md)). It carries no
> worker instructions — the stage contract stays in `kickoff-s1.md §2`, and this file is the
> artifact that section makes a precondition of dispatch.
> **Authoritative for:** the site's page population by slug — every row's `kind`, `stage`,
> `writer` and `provenance`, and the enumeration of D49's third population.
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists);
> the S1 stage contract — [`kickoff-s1.md`](kickoff-s1.md); the `kind:` registry — D30's
> [`page-kinds.md`](../../skills/docs-author/references/page-kinds.md), a closed set of seven;
> the redirect contract — R7/R21/D37 in
> [`roll.md`](../../../docs/superpowers/specs/2026-09-14-getff-ai-rollout-and-cutover-design.md).

**Measurement SHA for every `path:line` and every generated row below:** `origin/staging` =
`d266fdf01ea9a3fa16cccd025f87e96a1d84ecce` (PR #1817, S0b). The landing rows were read at
`artyhoo/getff-landing` `origin/main` = `c091883`. Nothing here was read from a stale worktree.

**Population-2 re-measure 2026-09-25 at `origin/staging` = `c16c432edc1` (#1848):** the §7
drift falsifier fired — two members landed after `d266fdf01ea` and were absent from §3:
`D.json` member `glossary-inject` (row `/docs/reference/D/glossary-inject/`) and `F3.json`
member `check-docs-refresh.mjs` (row `/docs/reference/F3/check-docs-refresh/`, added by the
S1 BUILD framework task, #1827). Both rows are added below in `members[]` order; the §6 counts
are amended in the same commit (230→232 rows, 219→221 members, 211→213 owed). Regeneration of
all eleven families at `c16c432edc1` produced 232 rows matching the amended §3 exactly; the two
new rows are the complete delta.

## §0 Why this file exists

D49 ([`site-design.md:176`](../../../docs/superpowers/specs/2026-09-13-getff-ai-site-design.md))
makes the page inventory a **kickoff artifact**, because no spec enumerates the site by slug. The
aif batch prompts are generated **from this table**, never from a family name alone, and D49's
falsifier (a) is explicit: a page merged in S1 that is in no row means the batch prompt was not
generated from the inventory — **fix the generation, never the page.**

The three populations are D28 §4 (§2 here), the D29 reference families (§3), and the
Learn / Guides / Understand list (§4). The third was enumerated **nowhere** before this file:
D41 ([`site-design.md:168`](../../../docs/superpowers/specs/2026-09-13-getff-ai-site-design.md))
records only «~15». §4 therefore carries a provenance value on every row, per D49 falsifier (b).

**Column contract.** `slug` is the public URL. `kind` is one of D30's seven registered values —
an open enum is forbidden, and a slug that fits no registered kind **escalates to D30**, it does
not get a new word here. `stage` is the stage that writes it. `writer` is the seat. `provenance`
names the source the row was read from, so the omission direction is auditable.

**One table, and one companion.** §2–§4 are the one inventory table split across its three
populations, with identical columns; a slug grep over this file spans all three. §5 is a separate
table on purpose: a redirect stub is a build artifact of `write-redirect-stubs.mjs` (R7), not a
page with `kind:` frontmatter, so putting it in the page table would force exactly the open enum
D49 forbids. Its rows are still greppable by slug from this file.

## §1 How each population was enumerated

| Population | Enumerated from | Command / citation |
|---|---|---|
| 1 — D28 §4 | the page-set table, the census URL paragraph, the post-census stub list | [`face.md:88`–`:111`](../../../docs/superpowers/specs/2026-09-14-getff-ai-face-pages-design.md); census set re-read at D33 ([`site-design.md:157`](../../../docs/superpowers/specs/2026-09-13-getff-ai-site-design.md)) |
| 2 — D29 families | the eleven per-family JSONs the generator owns | `node -e` over `docs/site/reference/<F>.json` `.members[]` — 11 families, 221 members (re-measured 2026-09-25, see header); the rows in §3 are that read, ordered by D19's family order |
| 3 — Learn/Guides/Understand | the four sidebar tabs, `nav.json`, D19's task shape, D30's kind registry, and the R7/D37 successor obligation | per-row in §4; no row without a named source |
| 5 — non-page URLs | the live site's own tree | `git ls-tree -r --name-only origin/main -- content/docs` in `artyhoo/getff-landing` @ `c091883` |

The population-2 rows are **generated**, not typed. An earlier draft of this paragraph described
the rule in prose — «the member id with its extension dropped and `/` folded to `-`» — and the
cold review implemented that prose literally and reproduced only **181 of 230** rows: the prose
omitted the lowercasing (all 26 `F2` rows are `IR1`→`ir1`), the folding of a remaining `.` to `-`,
and the leading-dot handling. A drift falsifier you cannot re-run is decoration, so the rule is
now **the code**, not a description of it:

```js
(m.slug || m.id || m.name)
  .replace(/([^./])\.[^./]+$/, '$1') // drop the LAST extension — and only when a real character
                                     // precedes the dot, which is what leaves `.nvmrc` whole
  .replace(/\//g, '-')               // fold path separators
  .toLowerCase()
  .replace(/[^a-z0-9-]/g, '-')       // fold every remaining non-slug character, `.` included
  .replace(/-+/g, '-')               // collapse runs (this is what absorbs a leading dot)
  .replace(/^-|-$/g, '');
```

Run over `docs/site/reference/<F>.json` `.members[]` in the §3 family order, that must reproduce
§3 **byte for byte**; if it does not, a family's membership moved and the inventory is stale.
**Live-fired 2026-09-21** against the table as committed: the code above produced 230 rows
matching all 230 table rows exactly (`JSON.stringify(generated) === JSON.stringify(table)` →
`true`), while the prose rule it replaces produced 49 differing rows — reproducing 181 of 230.
The falsifier discriminates; it was not merely asserted. This
follows the `old-urls.txt` precedent — an enumerated list committed with the command that produced
it ([`roll.md:59`](../../../docs/superpowers/specs/2026-09-14-getff-ai-rollout-and-cutover-design.md), R7).

## §2 Population 1 — D28 §4: the pinned seven, rows 2a–d, the census URLs, the AI surface

The eleven face pages are **gold, written in S0b, never conveyor** — the hub `/docs/` most of all
(D41; `kickoff-s1.md §8`). They appear here so the completeness check is not vacuous on them.

| slug | kind | stage | writer | provenance |
|---|---|---|---|---|
| `/docs/` | `face-page` | S0b | gold (Fable) | D28 §4 row 1; `docs/site/index.md`; `nav.json` `pinned.pages[0]` |
| `/docs/quick-start/` | `face-page` | S0b | gold (Fable) | D28 §4 row 2; `docs/site/quick-start.md` |
| `/docs/quickstart-ts/` | `face-page` | S0b | gold (Fable) | D28 §4 row 2a–d + D48; census URL (D33); `docs/site/quickstart-ts.md` |
| `/docs/quickstart-python/` | `face-page` | S0b | gold (Fable) | D28 §4 row 2a–d + D48; `docs/site/quickstart-python.md` |
| `/docs/quickstart-rust/` | `face-page` | S0b | gold (Fable) | D28 §4 row 2a–d + D48; census URL (D33); `docs/site/quickstart-rust.md` |
| `/docs/quickstart-go/` | `face-page` | S0b | gold (Fable) | D28 §4 row 2a–d + D48; `docs/site/quickstart-go.md` |
| `/docs/installation/` | `face-page` | S0b | gold (Fable) | D28 §4 row 3; `docs/site/installation.md` |
| `/docs/why/` | `face-page` | S0b | gold (Fable) | D28 §4 row 4; `docs/site/why.md` |
| `/docs/how-it-works/` | `face-page` | S0b | gold (Fable) | D28 §4 row 5; `docs/site/how-it-works.md` |
| `/docs/foundations/` | `face-page` | S0b | gold (Fable) | D28 §4 row 6; `docs/site/foundations.md` |
| `/docs/ai-agents/` | `face-page` | S0b | gold (Fable) | D28 §4 row 7; `docs/site/ai-agents.md` |
| `/docs/terms/` | `glossary` | S0b | gold (Fable) | D30 registry `glossary` («`terms.md` only»); `docs/site/terms.md`; `nav.json` `glossary` |
| `/docs/executable-agents-md/` | `understand` | **S1 RUN** | conveyor (aif/GLM) | D49 explicit RUN row; census URL (D33) — real content, no stub; D12: How it works §3 and Why §proof LINK it |
| `/docs/limits/` | `understand` | **S1 RUN** | conveyor (aif/GLM) | D49 explicit RUN row; census URL (D33); its stack table is a `maturity.json` fence region (D28 `:105`) |
| `/docs/faq/` | **ESCALATED to D30** — fits none of the seven | **S1 RUN** | conveyor (aif/GLM) | D49 explicit RUN row; census URL (D33) — real content, no stub |
| `/llms.txt` | n/a — build projection | S1 BUILD (landing) | landing build | D28 §5.8 `face.md:293`; head authored as `docs/site/llms-head.txt` (S0b), lists generated from `face-facts.json` + family JSON |
| `/llms-full.txt` | n/a — build projection | S1 BUILD (landing) | landing build | D28 §5.8 `face.md:304`; every page's processed markdown, face pages first |

**Kind assignments for the three D49 rows — decided against the LIVE pages, not against the slug.**
D49 says their `kind:` is assigned from D30's registry, and D30 is the authority. A first pass
assigned them by reading the slugs; the cold review read the pages at `getff-landing`
`origin/main` = `c091883` and two of the three were wrong. Deferring that to «the conveyor will
notice it cannot fill a section» would have been `#hope-as-gate`
([`attention-is-not-a-mechanism.md §2`](../../rules/attention-is-not-a-mechanism.md)) over pages
that are readable today. The three, with their live headings:

- **`/docs/executable-agents-md/` → `understand`.** Its sections are «The three properties» /
  «Walkthrough: three real claims» / «Honest framing» — which is `understand`'s
  `## Mechanism` / `## Proof` / `## Limits` almost word for word. It was first assigned
  `learn-tutorial`, which requires `## Steps` whose «first runnable step appears before any
  concept explanation» ([`page-kinds.md`](../../skills/docs-author/references/page-kinds.md)):
  the page opens with concept and asks the reader to run nothing. D12's own framing — a page that
  How it works and Why **link as proof** — is the `understand` role.
- **`/docs/limits/` → `understand`, and this one is the least-bad fit, not a clean one.** The live
  page is three numbered limits with no mechanism section and no proof section. `understand`
  demands `## Mechanism` and `## Proof` ahead of `## Limits`; the `maturity.json` fence region
  (D28 `:105`) is the only thing available to serve as `## Proof`. **Escalate to D30 if** the
  conveyor cannot write a `## Mechanism` for it from the pin without inventing one.
- **`/docs/faq/` → ESCALATED to D30; no kind assigned here.** Its seven headings are «What is an
  executable AGENTS.md?», «Does getff need an LLM?», «Is getff open source?» and four
  «How is this different from …?» — not one is a «how do I», and the page carries no step, no
  command and no verification. `guide` is four GATE sections — `## Prerequisites`, `## Steps`,
  `## Verify`, `## Variations` — plus «the goal belongs in the title», and the title is «FAQ».
  Assigning it would guarantee the conveyor invents all four. None of the other six fits either,
  so this is exactly the case D49 routes to D30 for a registered kind. **It is not an open enum
  and not a licence to widen the set here.**

## §3 Population 2 — the D29 reference families

Eleven families, 221 members, one `family-overview` each: **232 rows.** Family order is D19's
([`site-design.md:136`](../../../docs/superpowers/specs/2026-09-13-getff-ai-site-design.md)) —
STRUCTURED first (B → D → F1 → F2 → I), then the PARTIAL families (A, C, E, F3, G, H), which
D19 gates behind their D14d source holes being fixed (S0a). Family B is the gold family: its
overview and 18 sheets shipped in S0b, so they are `writer: gold`, not conveyor.

The slug is the member id with its extension dropped and `/` folded to `-`; the mapping is
injective across all 232 rows (checked — no collision; re-checked over the regenerated set at
`c16c432edc1`, 2026-09-25).

| slug | kind | stage | writer | provenance |
|---|---|---|---|---|
| `/docs/reference/B/` | `family-overview` | S0b | gold (Fable) | `B.json` `familyName: skills` |
| `/docs/reference/B/ai-doc/` | `reference-sheet` | S0b | gold (Fable) | `B.json` member `ai-doc` |
| `/docs/reference/B/aif-doctor/` | `reference-sheet` | S0b | gold (Fable) | `B.json` member `aif-doctor` |
| `/docs/reference/B/arch/` | `reference-sheet` | S0b | gold (Fable) | `B.json` member `arch` |
| `/docs/reference/B/claude-glm-executor-handoff/` | `reference-sheet` | S0b | gold (Fable) | `B.json` member `claude-glm-executor-handoff` |
| `/docs/reference/B/dispatcher/` | `reference-sheet` | S0b | gold (Fable) | `B.json` member `dispatcher` |
| `/docs/reference/B/docs-author/` | `reference-sheet` | S0b | gold (Fable) | `B.json` member `docs-author` |
| `/docs/reference/B/getff/` | `reference-sheet` | S0b | gold (Fable) | `B.json` member `getff` |
| `/docs/reference/B/harvest/` | `reference-sheet` | S0b | gold (Fable) | `B.json` member `harvest` |
| `/docs/reference/B/night-mode/` | `reference-sheet` | S0b | gold (Fable) | `B.json` member `night-mode` |
| `/docs/reference/B/orchestrator/` | `reference-sheet` | S0b | gold (Fable) | `B.json` member `orchestrator` |
| `/docs/reference/B/pipeline/` | `reference-sheet` | S0b | gold (Fable) | `B.json` member `pipeline` |
| `/docs/reference/B/reviewer/` | `reference-sheet` | S0b | gold (Fable) | `B.json` member `reviewer` |
| `/docs/reference/B/rule-research/` | `reference-sheet` | S0b | gold (Fable) | `B.json` member `rule-research` |
| `/docs/reference/B/rule-tests/` | `reference-sheet` | S0b | gold (Fable) | `B.json` member `rule-tests` |
| `/docs/reference/B/self-reflection/` | `reference-sheet` | S0b | gold (Fable) | `B.json` member `self-reflection` |
| `/docs/reference/B/story/` | `reference-sheet` | S0b | gold (Fable) | `B.json` member `story` |
| `/docs/reference/B/template-audit/` | `reference-sheet` | S0b | gold (Fable) | `B.json` member `template-audit` |
| `/docs/reference/B/tool-bootstrapping/` | `reference-sheet` | S0b | gold (Fable) | `B.json` member `tool-bootstrapping` |
| `/docs/reference/D/` | `family-overview` | S1 RUN | conveyor (aif/GLM) | `D.json` `familyName: hooks` |
| `/docs/reference/D/adopt-orchestrator-prompts/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `D.json` member `adopt-orchestrator-prompts` |
| `/docs/reference/D/ask-question-reminder/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `D.json` member `ask-question-reminder` |
| `/docs/reference/D/check-doc-authority/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `D.json` member `check-doc-authority` |
| `/docs/reference/D/check-doc-authority-header/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `D.json` member `check-doc-authority-header` |
| `/docs/reference/D/check-hook-marker/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `D.json` member `check-hook-marker` |
| `/docs/reference/D/check-kickoff-traps/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `D.json` member `check-kickoff-traps` |
| `/docs/reference/D/check-worker-dispatch-channel/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `D.json` member `check-worker-dispatch-channel` |
| `/docs/reference/D/deps-hash-check/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `D.json` member `deps-hash-check` |
| `/docs/reference/D/end-of-turn-reminder/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `D.json` member `end-of-turn-reminder` |
| `/docs/reference/D/glossary-inject/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `D.json` member `glossary-inject` (added at `c16c432edc1`, 2026-09-25 re-measure) |
| `/docs/reference/D/inject-handoff-on-compact/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `D.json` member `inject-handoff-on-compact` |
| `/docs/reference/D/inject-matching-rule/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `D.json` member `inject-matching-rule` |
| `/docs/reference/D/inject-memory-codification/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `D.json` member `inject-memory-codification` |
| `/docs/reference/D/inject-output-language/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `D.json` member `inject-output-language` |
| `/docs/reference/D/inject-project-digest/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `D.json` member `inject-project-digest` |
| `/docs/reference/D/inject-session-bootstrap/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `D.json` member `inject-session-bootstrap` |
| `/docs/reference/D/inject-subagent-context/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `D.json` member `inject-subagent-context` |
| `/docs/reference/D/inject-subagent-digest/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `D.json` member `inject-subagent-digest` |
| `/docs/reference/D/precompact-residue/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `D.json` member `precompact-residue` |
| `/docs/reference/D/runtime-bridge-dispatch/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `D.json` member `runtime-bridge-dispatch` |
| `/docs/reference/D/session-start/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `D.json` member `session-start` |
| `/docs/reference/D/validate-prompt/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `D.json` member `validate-prompt` |
| `/docs/reference/D/warn-subagent-report/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `D.json` member `warn-subagent-report` |
| `/docs/reference/D/warn-subagent-report-zcode/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `D.json` member `warn-subagent-report-zcode` |
| `/docs/reference/D/worktree-setup/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `D.json` member `worktree-setup` |
| `/docs/reference/F1/` | `family-overview` | S1 RUN | conveyor (aif/GLM) | `F1.json` `familyName: rules` |
| `/docs/reference/F1/ai-laziness-digest/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `F1.json` member `ai-laziness-digest` |
| `/docs/reference/F1/ai-laziness-traps/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `F1.json` member `ai-laziness-traps` |
| `/docs/reference/F1/attention-is-not-a-mechanism/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `F1.json` member `attention-is-not-a-mechanism` |
| `/docs/reference/F1/autonomous-loop-continuity/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `F1.json` member `autonomous-loop-continuity` |
| `/docs/reference/F1/build-first-reuse-default/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `F1.json` member `build-first-reuse-default` |
| `/docs/reference/F1/ci-tool-pinning/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `F1.json` member `ci-tool-pinning` |
| `/docs/reference/F1/cold-seat-economy/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `F1.json` member `cold-seat-economy` |
| `/docs/reference/F1/companion-install-principle/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `F1.json` member `companion-install-principle` |
| `/docs/reference/F1/destination-environment-verification/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `F1.json` member `destination-environment-verification` |
| `/docs/reference/F1/doc-authority-hierarchy/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `F1.json` member `doc-authority-hierarchy` |
| `/docs/reference/F1/dual-implementation-discipline/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `F1.json` member `dual-implementation-discipline` |
| `/docs/reference/F1/effort-worthiness/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `F1.json` member `effort-worthiness` |
| `/docs/reference/F1/egress-no-api-bypass/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `F1.json` member `egress-no-api-bypass` |
| `/docs/reference/F1/evidence-regeneration/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `F1.json` member `evidence-regeneration` |
| `/docs/reference/F1/git-conflict-merge-forward/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `F1.json` member `git-conflict-merge-forward` |
| `/docs/reference/F1/kickoff-staging-placement/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `F1.json` member `kickoff-staging-placement` |
| `/docs/reference/F1/language-discipline/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `F1.json` member `language-discipline` |
| `/docs/reference/F1/memory-codification/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `F1.json` member `memory-codification` |
| `/docs/reference/F1/no-paid-llm-in-ci/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `F1.json` member `no-paid-llm-in-ci` |
| `/docs/reference/F1/parallel-subwave-isolation/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `F1.json` member `parallel-subwave-isolation` |
| `/docs/reference/F1/phase-research-coverage/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `F1.json` member `phase-research-coverage` |
| `/docs/reference/F1/recommendation-laziness-discipline/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `F1.json` member `recommendation-laziness-discipline` |
| `/docs/reference/F1/research-source-trust/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `F1.json` member `research-source-trust` |
| `/docs/reference/F1/reviewer-discipline/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `F1.json` member `reviewer-discipline` |
| `/docs/reference/F1/rule-enforcement-channel-selection/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `F1.json` member `rule-enforcement-channel-selection` |
| `/docs/reference/F1/seat-lifecycle/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `F1.json` member `seat-lifecycle` |
| `/docs/reference/F1/skill-description-quality/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `F1.json` member `skill-description-quality` |
| `/docs/reference/F1/source-before-shape/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `F1.json` member `source-before-shape` |
| `/docs/reference/F1/zcode-parity-doctrine/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `F1.json` member `zcode-parity-doctrine` |
| `/docs/reference/F2/` | `family-overview` | S1 RUN | conveyor (aif/GLM) | `F2.json` `familyName: generated rules` |
| `/docs/reference/F2/ir1/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `F2.json` member `IR1` |
| `/docs/reference/F2/ir2/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `F2.json` member `IR2` |
| `/docs/reference/F2/ir3/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `F2.json` member `IR3` |
| `/docs/reference/F2/ir4/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `F2.json` member `IR4` |
| `/docs/reference/F2/ir5/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `F2.json` member `IR5` |
| `/docs/reference/F2/ir6/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `F2.json` member `IR6` |
| `/docs/reference/F2/r1/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `F2.json` member `R1` |
| `/docs/reference/F2/r10/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `F2.json` member `R10` |
| `/docs/reference/F2/r11/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `F2.json` member `R11` |
| `/docs/reference/F2/r12/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `F2.json` member `R12` |
| `/docs/reference/F2/r13/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `F2.json` member `R13` |
| `/docs/reference/F2/r14/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `F2.json` member `R14` |
| `/docs/reference/F2/r15/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `F2.json` member `R15` |
| `/docs/reference/F2/r16/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `F2.json` member `R16` |
| `/docs/reference/F2/r17/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `F2.json` member `R17` |
| `/docs/reference/F2/r18/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `F2.json` member `R18` |
| `/docs/reference/F2/r19/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `F2.json` member `R19` |
| `/docs/reference/F2/r2/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `F2.json` member `R2` |
| `/docs/reference/F2/r20/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `F2.json` member `R20` |
| `/docs/reference/F2/r3/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `F2.json` member `R3` |
| `/docs/reference/F2/r4/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `F2.json` member `R4` |
| `/docs/reference/F2/r5/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `F2.json` member `R5` |
| `/docs/reference/F2/r6/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `F2.json` member `R6` |
| `/docs/reference/F2/r7/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `F2.json` member `R7` |
| `/docs/reference/F2/r8/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `F2.json` member `R8` |
| `/docs/reference/F2/r9/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `F2.json` member `R9` |
| `/docs/reference/I/` | `family-overview` | S1 RUN | conveyor (aif/GLM) | `I.json` `familyName: plugin` |
| `/docs/reference/I/ai-doc/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `I.json` member `ai-doc` |
| `/docs/reference/I/compliance-verifier/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `I.json` member `compliance-verifier` |
| `/docs/reference/I/docs-form-auditor/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `I.json` member `docs-form-auditor` |
| `/docs/reference/I/getff/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `I.json` member `getff` |
| `/docs/reference/I/install-enforcement/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `I.json` member `install-enforcement` |
| `/docs/reference/I/installing-enforcement/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `I.json` member `installing-enforcement` |
| `/docs/reference/I/living-docs-auditor/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `I.json` member `living-docs-auditor` |
| `/docs/reference/I/review-sidecar/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `I.json` member `review-sidecar` |
| `/docs/reference/I/rule-research/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `I.json` member `rule-research` |
| `/docs/reference/I/rule-tests/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `I.json` member `rule-tests` |
| `/docs/reference/I/template-audit/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `I.json` member `template-audit` |
| `/docs/reference/I/tool-bootstrapping/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `I.json` member `tool-bootstrapping` |
| `/docs/reference/I/using-getff/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `I.json` member `using-getff` |
| `/docs/reference/A/` | `family-overview` | S1 RUN | conveyor (aif/GLM) | `A.json` `familyName: installer layers` |
| `/docs/reference/A/05-mcp/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `A.json` member `05-mcp.sh` |
| `/docs/reference/A/10-skills/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `A.json` member `10-skills.sh` |
| `/docs/reference/A/15-companions-stack/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `A.json` member `15-companions-stack.sh` |
| `/docs/reference/A/20-agents/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `A.json` member `20-agents.sh` |
| `/docs/reference/A/30-templates/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `A.json` member `30-templates.sh` |
| `/docs/reference/A/40-configs/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `A.json` member `40-configs.sh` |
| `/docs/reference/A/45-python/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `A.json` member `45-python.sh` |
| `/docs/reference/A/46-cargo/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `A.json` member `46-cargo.sh` |
| `/docs/reference/A/47-go/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `A.json` member `47-go.sh` |
| `/docs/reference/A/50-hooks/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `A.json` member `50-hooks.sh` |
| `/docs/reference/A/55-runtime-bridge-vendor/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `A.json` member `55-runtime-bridge-vendor.sh` |
| `/docs/reference/A/60-ci/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `A.json` member `60-ci.sh` |
| `/docs/reference/A/70-deps/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `A.json` member `70-deps.sh` |
| `/docs/reference/A/80-rule-bootstrap/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `A.json` member `80-rule-bootstrap.sh` |
| `/docs/reference/A/85-worktree-scripts/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `A.json` member `85-worktree-scripts.sh` |
| `/docs/reference/A/99-finalize/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `A.json` member `99-finalize.sh` |
| `/docs/reference/C/` | `family-overview` | S1 RUN | conveyor (aif/GLM) | `C.json` `familyName: agents` |
| `/docs/reference/C/aif-init/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `C.json` member `aif-init` |
| `/docs/reference/C/capability-reuse-auditor/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `C.json` member `capability-reuse-auditor` |
| `/docs/reference/C/claims-conformance-auditor/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `C.json` member `claims-conformance-auditor` |
| `/docs/reference/C/compliance-verifier/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `C.json` member `compliance-verifier` |
| `/docs/reference/C/docplan-auditor/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `C.json` member `docplan-auditor` |
| `/docs/reference/C/docs-form-auditor/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `C.json` member `docs-form-auditor` |
| `/docs/reference/C/fidelity-auditor/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `C.json` member `fidelity-auditor` |
| `/docs/reference/C/living-docs-auditor/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `C.json` member `living-docs-auditor` |
| `/docs/reference/C/memory-codification-auditor/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `C.json` member `memory-codification-auditor` |
| `/docs/reference/C/review-sidecar/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `C.json` member `review-sidecar` |
| `/docs/reference/C/rule-researcher/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `C.json` member `rule-researcher` |
| `/docs/reference/C/rule-test-author/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `C.json` member `rule-test-author` |
| `/docs/reference/E/` | `family-overview` | S1 RUN | conveyor (aif/GLM) | `E.json` `familyName: templates` |
| `/docs/reference/E/cargo-cargo-lints/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `E.json` member `cargo/Cargo.lints.toml` |
| `/docs/reference/E/cargo-clippy/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `E.json` member `cargo/clippy.toml` |
| `/docs/reference/E/cargo-deny/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `E.json` member `cargo/deny.toml` |
| `/docs/reference/E/cargo-github-actions-ci/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `E.json` member `cargo/github-actions-ci.yml` |
| `/docs/reference/E/go-golangci/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `E.json` member `go/.golangci.yml` |
| `/docs/reference/E/go-github-actions-ci/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `E.json` member `go/github-actions-ci.yml` |
| `/docs/reference/E/python-getff-astgrep-rules-getff-no-datetime-datetime-now/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `E.json` member `python/.getff/astgrep-rules/getff-no-datetime-datetime-now.yml` |
| `/docs/reference/E/python-getff-astgrep-rules-getff-no-datetime-now/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `E.json` member `python/.getff/astgrep-rules/getff-no-datetime-now.yml` |
| `/docs/reference/E/python-getff-astgrep-rules-getff-no-eval/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `E.json` member `python/.getff/astgrep-rules/getff-no-eval.yml` |
| `/docs/reference/E/python-getff-astgrep-rules-getff-no-os-system/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `E.json` member `python/.getff/astgrep-rules/getff-no-os-system.yml` |
| `/docs/reference/E/python-architecture/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `E.json` member `python/ARCHITECTURE.md` |
| `/docs/reference/E/python-rules/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `E.json` member `python/RULES.md` |
| `/docs/reference/E/python-github-actions-ci/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `E.json` member `python/github-actions-ci.yml` |
| `/docs/reference/E/python-hooks-getff-pre-commit-config-yaml/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `E.json` member `python/hooks/getff.pre-commit-config.yaml.fragment` |
| `/docs/reference/E/python-hooks-pre-push/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `E.json` member `python/hooks/pre-push.sh` |
| `/docs/reference/E/python-ruff/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `E.json` member `python/ruff.toml` |
| `/docs/reference/E/python-sgconfig/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `E.json` member `python/sgconfig.yml` |
| `/docs/reference/E/react-next-storybook-main/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `E.json` member `react-next/.storybook/main.ts` |
| `/docs/reference/E/react-next-storybook-preview/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `E.json` member `react-next/.storybook/preview.ts` |
| `/docs/reference/E/shared-lintstagedrc/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `E.json` member `shared/.lintstagedrc.json` |
| `/docs/reference/E/shared-nvmrc/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `E.json` member `shared/.nvmrc` |
| `/docs/reference/E/shared-prettierignore/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `E.json` member `shared/.prettierignore` |
| `/docs/reference/E/shared-agents-md/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `E.json` member `shared/AGENTS.md.template` |
| `/docs/reference/E/shared-ai-usage-guide/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `E.json` member `shared/AI-USAGE-GUIDE.md` |
| `/docs/reference/E/shared-architecture-ts-server/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `E.json` member `shared/ARCHITECTURE.ts-server.md` |
| `/docs/reference/E/shared-claude-md/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `E.json` member `shared/CLAUDE.md.template` |
| `/docs/reference/E/shared-description-template/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `E.json` member `shared/DESCRIPTION.template.md` |
| `/docs/reference/E/shared-first-steps-source/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `E.json` member `shared/first-steps.source.json` |
| `/docs/reference/E/shared-gitignore/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `E.json` member `shared/gitignore` |
| `/docs/reference/E/shared-hooks-package/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `E.json` member `shared/hooks-package.json` |
| `/docs/reference/E/shared-husky-pre-commit/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `E.json` member `shared/husky-pre-commit.sh` |
| `/docs/reference/E/shared-husky-pre-push/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `E.json` member `shared/husky-pre-push.sh` |
| `/docs/reference/E/shared-integration-rules/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `E.json` member `shared/integration-rules.md` |
| `/docs/reference/E/shared-skill-context-aif-orchestrator-discipline-skill/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `E.json` member `shared/skill-context/aif-orchestrator-discipline/SKILL.md` |
| `/docs/reference/E/shared-skill-context-aif-review-skill/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `E.json` member `shared/skill-context/aif-review/SKILL.md` |
| `/docs/reference/E/shared-skill-context-aif-rules-check-skill/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `E.json` member `shared/skill-context/aif-rules-check/SKILL.md` |
| `/docs/reference/E/shared-tier-home/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `E.json` member `shared/tier-home.md` |
| `/docs/reference/E/shared-tsconfig/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `E.json` member `shared/tsconfig.json` |
| `/docs/reference/F3/` | `family-overview` | S1 RUN | conveyor (aif/GLM) | `F3.json` `familyName: scripts` |
| `/docs/reference/F3/build-getff-dist/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `F3.json` member `build-getff-dist.sh` |
| `/docs/reference/F3/build-shipped-eslint-rules/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `F3.json` member `build-shipped-eslint-rules.sh` |
| `/docs/reference/F3/build-synth-bundle/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `F3.json` member `build-synth-bundle.sh` |
| `/docs/reference/F3/census/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `F3.json` member `census.mjs` |
| `/docs/reference/F3/check-alwayson-budget/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `F3.json` member `check-alwayson-budget.sh` |
| `/docs/reference/F3/check-ask-files/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `F3.json` member `check-ask-files.sh` |
| `/docs/reference/F3/check-bundle-dep-parity/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `F3.json` member `check-bundle-dep-parity.sh` |
| `/docs/reference/F3/check-docs-refresh/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `F3.json` member `check-docs-refresh.mjs` (added at `c16c432edc1`, 2026-09-25 re-measure; shipped by #1827) |
| `/docs/reference/F3/check-line-citations/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `F3.json` member `check-line-citations.mjs` |
| `/docs/reference/F3/check-skill-drift/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `F3.json` member `check-skill-drift.sh` |
| `/docs/reference/F3/ci-success-gate/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `F3.json` member `ci-success-gate.sh` |
| `/docs/reference/F3/create-worktree/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `F3.json` member `create-worktree.sh` |
| `/docs/reference/F3/docs-check/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `F3.json` member `docs-check.mjs` |
| `/docs/reference/F3/format-shipped/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `F3.json` member `format-shipped.sh` |
| `/docs/reference/F3/generate-plugin-skills/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `F3.json` member `generate-plugin-skills.sh` |
| `/docs/reference/F3/generate-plugin-twins/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `F3.json` member `generate-plugin-twins.sh` |
| `/docs/reference/F3/getff-work/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `F3.json` member `getff-work.sh` |
| `/docs/reference/F3/host-verify/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `F3.json` member `host-verify.sh` |
| `/docs/reference/F3/link-coordination/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `F3.json` member `link-coordination.sh` |
| `/docs/reference/F3/measure-always-on/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `F3.json` member `measure-always-on.sh` |
| `/docs/reference/F3/render-face-facts/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `F3.json` member `render-face-facts.mjs` |
| `/docs/reference/F3/render-install-roster/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `F3.json` member `render-install-roster.mjs` |
| `/docs/reference/F3/render-presets/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `F3.json` member `render-presets.mjs` |
| `/docs/reference/F3/render-reference/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `F3.json` member `render-reference.mjs` |
| `/docs/reference/F3/render-rule-index/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `F3.json` member `render-rule-index.mjs` |
| `/docs/reference/F3/render-terms-style/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `F3.json` member `render-terms-style.mjs` |
| `/docs/reference/F3/run-local-ci-sweep/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `F3.json` member `run-local-ci-sweep.sh` |
| `/docs/reference/F3/worktree-node-modules/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `F3.json` member `worktree-node-modules.sh` |
| `/docs/reference/G/` | `family-overview` | S1 RUN | conveyor (aif/GLM) | `G.json` `familyName: packages` |
| `/docs/reference/G/core/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `G.json` member `core` |
| `/docs/reference/G/getff/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `G.json` member `getff` |
| `/docs/reference/G/lint-config/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `G.json` member `lint-config` |
| `/docs/reference/G/meta-factory/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `G.json` member `meta-factory` |
| `/docs/reference/G/preset-next-15-canonical/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `G.json` member `preset-next-15-canonical` |
| `/docs/reference/G/preset-react-native/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `G.json` member `preset-react-native` |
| `/docs/reference/G/preset-react-spa/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `G.json` member `preset-react-spa` |
| `/docs/reference/G/runtime-bridge/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `G.json` member `runtime-bridge` |
| `/docs/reference/H/` | `family-overview` | S1 RUN | conveyor (aif/GLM) | `H.json` `familyName: bridge CLI` |
| `/docs/reference/H/answer/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `H.json` member `answer` |
| `/docs/reference/H/await/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `H.json` member `await` |
| `/docs/reference/H/claim/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `H.json` member `claim` |
| `/docs/reference/H/dispatch/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `H.json` member `dispatch` |
| `/docs/reference/H/ensure-parallel/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `H.json` member `ensure-parallel` |
| `/docs/reference/H/harvest/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `H.json` member `harvest` |
| `/docs/reference/H/park/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `H.json` member `park` |
| `/docs/reference/H/questions/` | `reference-sheet` | S1 RUN | conveyor (aif/GLM) | `H.json` member `questions` |

## §4 Population 3 — Learn / Guides / Understand (enumerated here for the first time)

**D41 records only «~15» and names no slug.** Everything below is derived from a source named in
its own row; nothing is improvised. Four sources carry this population:

1. **`docs/site/nav.json`** `tabs[]` — the three pages that already exist, one per tab. Its own
   `_note` says the file «never lists a page that does not exist», so it enumerates the written
   set, not the planned one.
2. **D19's task shape** ([`site-design.md:136`](../../../docs/superpowers/specs/2026-09-13-getff-ai-site-design.md)):
   «each = overview + sheets + **its guide** in ONE aif task (~20 pages)» → **one guide per D29
   family**, eleven of them; «then **the 3 Learn tutorials**» → Learn is a set of three;
   «Understand last (needs proof links to exist)» → Understand is written after the families, and
   D19 gives it no count.
3. **D30's kind registry** — `learn-tutorial`, `guide`, `understand` are the three tab kinds, and
   `nav.json` binds each tab to one of them (`tabs[].kind`). The kind column below is that binding,
   not a judgement.
4. **The R7/D37 successor obligation**
   ([`roll.md:206`](../../../docs/superpowers/specs/2026-09-14-getff-ai-rollout-and-cutover-design.md),
   TD-12): «stubs only where a successor exists; draft URLs without a successor go to
   `retired-urls.txt` and 404 from cutover». **Six** post-census slugs on the live site have **no
   declared successor** (§5) — D28 §4 names all six at
   [`face.md:111`](../../../docs/superpowers/specs/2026-09-14-getff-ai-face-pages-design.md)
   («`daily-cycle-*`, `factory-overview`, `degradations`, `reference`, `beta`»). Four of them are
   tab-shaped pages and appear below as the successor that keeps the old URL from 404ing; the
   other two — `/docs/beta` and `/docs/reference` — are escalated, not invented.

**Token rows.** Ten family guides and two Learn tutorials have a source for their *existence* but
no source for their *title*. Their slug is a token `<…>`. The conveyor plan (P-R) replaces the
token with the final slug **in the same commit that writes the page**. A page merged while its row
still carries a token is D49 falsifier (a): fix the generation, not the page. Inventing ten titles
here would be the improvisation falsifier (b) names.

| slug | kind | stage | writer | provenance |
|---|---|---|---|---|
| `/docs/learn/stop-a-bad-commit/` | `learn-tutorial` | S0b | gold (Fable) | `nav.json` `tabs[learn].pages[0]`; D17c trial page (S0 closure note §1) |
| `/docs/learn/<tutorial-2>/` | `learn-tutorial` | S1 RUN | conveyor (aif/GLM) | D19 `:136` «the 3 Learn tutorials» — count only; no spec names the topic |
| `/docs/learn/<tutorial-3>/` | `learn-tutorial` | S1 RUN | conveyor (aif/GLM) | D19 `:136` «the 3 Learn tutorials» — count only; no spec names the topic |
| `/docs/guides/add-design-and-review-skills/` | `guide` | S0b | gold (Fable) | `nav.json` `tabs[guides].pages[0]`; D17c trial page; family B's D19 guide |
| `/docs/guides/<family-A>/` | `guide` | S1 RUN | conveyor (aif/GLM) | D19 `:136` «each = overview + sheets + its guide»; family A `installer layers` (`A.json`) |
| `/docs/guides/<family-C>/` | `guide` | S1 RUN | conveyor (aif/GLM) | D19 `:136`; family C `agents` (`C.json`) |
| `/docs/guides/check-your-installed-hooks/` | `guide` | S1 RUN | conveyor (aif/GLM) | D19 `:136`; family D `hooks` (`D.json`) |
| `/docs/guides/<family-E>/` | `guide` | S1 RUN | conveyor (aif/GLM) | D19 `:136`; family E `templates` (`E.json`) |
| `/docs/guides/<family-F1>/` | `guide` | S1 RUN | conveyor (aif/GLM) | D19 `:136`; family F1 `rules` (`F1.json`) |
| `/docs/guides/<family-F2>/` | `guide` | S1 RUN | conveyor (aif/GLM) | D19 `:136`; family F2 `generated rules` (`F2.json`) |
| `/docs/guides/<family-F3>/` | `guide` | S1 RUN | conveyor (aif/GLM) | D19 `:136`; family F3 `scripts` (`F3.json`) |
| `/docs/guides/<family-G>/` | `guide` | S1 RUN | conveyor (aif/GLM) | D19 `:136`; family G `packages` (`G.json`) |
| `/docs/guides/<family-H>/` | `guide` | S1 RUN | conveyor (aif/GLM) | D19 `:136`; family H `bridge CLI` (`H.json`) |
| `/docs/guides/<family-I>/` | `guide` | S1 RUN | conveyor (aif/GLM) | D19 `:136`; family I `plugin` (`I.json`) |
| `/docs/guides/daily-cycle-rules/` | `guide` | S1 RUN | conveyor (aif/GLM) | successor for `/docs/daily-cycle-rules` (R7/D37); live page @ `c091883` «five beats … each with the exact command» = the `guide` skeleton |
| `/docs/guides/daily-cycle-factory/` | `guide` | S1 RUN | conveyor (aif/GLM) | successor for `/docs/daily-cycle-factory` (R7/D37); live page @ `c091883` «the factory day in four beats» |
| `/docs/understand/why-a-rule-must-prove-it-fires/` | `understand` | S0b | gold (Fable) | `nav.json` `tabs[understand].pages[0]`; D17c trial page |
| `/docs/understand/<successor-factory-overview>/` | `understand` | S1 RUN | conveyor (aif/GLM) | successor for `/docs/factory-overview` (R7/D37); live page @ `c091883` is mechanism with no steps; FD1 — must not re-explain How it works |
| `/docs/understand/<successor-degradations>/` | `understand` | S1 RUN | conveyor (aif/GLM) | successor for `/docs/degradations` (R7/D37); live page @ `c091883` renders the matrix from `.ai-factory/tier-home.md §3`, its single owner |

**19 rows against D41's «~15».** The estimate is superseded by the enumeration, which is what D49
asks for; the delta is +4 and its whole size is the successor obligation, which D41 never priced.

**Two escalations, not inventions.** `/docs/beta` («Join the beta») has no successor page in any
of the four sources: it is a programme surface, not a tutorial, a guide or a mechanism, and D30's
closed set has no kind for it. `/docs/reference` («Framework reference (raw)») is the old site's
raw-reference **index**, whose successor would be the Reference tab itself — but `nav.json`
`tabs[reference]` carries families and overviews and **no index page**, so no slug in this
inventory is its successor. Per R7/D37 each is either a landing-side page outside `docs/site/**`
or a `retired-urls.txt` entry — **operator decisions, recorded in §5 as open.** Writing rows for
them here would be exactly the improvised row falsifier (b) forbids.

## §5 Non-page URLs — redirect stubs, kept census URLs, and the one open successor

Not pages: no `kind:` frontmatter, written by `write-redirect-stubs.mjs` in the landing repo
(R7/R21). Enumerated from `git ls-tree -r --name-only origin/main -- content/docs` in
`artyhoo/getff-landing` @ `c091883` — 16 top-level `*.md` pages — **plus `/docs/reference`,
which that command structurally cannot see**: it is a folder index (`content/docs/reference/meta.json`,
title «Framework reference (raw)»), not a top-level `*.md`, so the enumeration that found the
other sixteen was blind to it by construction. It was recovered from D28 §4's own bulk-map list
and from `content/docs/meta.json`, which carries `"reference"` as a nav entry between `"faq"` and
`"beta"`. **17 rows.** That miss is the omission direction D49 exists to make visible, and it took
a second enumeration path to see it — one command was not enough.

| old URL | disposition | successor | provenance |
|---|---|---|---|
| `/docs/what-is-getff` | stub | `/docs/` | R17; D28 §4 row 1 |
| `/docs/first-steps-core` | stub | `/docs/installation/` | R17; D28 §4 row 3 |
| `/docs/first-steps-env` | stub | `/docs/installation/` | R17; D28 §4 row 3 |
| `/docs/first-steps-factory` | stub | `/docs/installation/` | R17; D28 §4 row 3 |
| `/docs/index` | stub | `/docs/` | post-census slug (D33); hub is face page 1 |
| `/docs/daily-cycle-rules` | stub | `/docs/guides/daily-cycle-rules/` | §4 row; R7/D37 |
| `/docs/daily-cycle-factory` | stub | `/docs/guides/daily-cycle-factory/` | §4 row; R7/D37 |
| `/docs/factory-overview` | stub | `/docs/understand/<successor-factory-overview>/` | §4 row; R7/D37 |
| `/docs/degradations` | stub | `/docs/understand/<successor-degradations>/` | §4 row; R7/D37 |
| `/docs/beta` | **OPEN** — stub or `retired-urls.txt` | none identified | R7/D37; operator decision (§4) |
| `/docs/reference` | **OPEN** — stub or `retired-urls.txt` | none identified | D28 §4 bulk-map list (`face.md:111`); live nav entry in `content/docs/meta.json` @ `c091883`, title «Framework reference (raw)»; `nav.json` `tabs[reference]` has no index page |
| `/docs/quickstart-ts` | **no stub, no redirect** | itself (real page) | census set, D33 / R21 — a stub here is a FAILURE |
| `/docs/quickstart-rust` | **no stub, no redirect** | itself (real page) | census set, D33 / R21 |
| `/docs/executable-agents-md` | **no stub, no redirect** | itself (real page, §2) | census set, D33 / R21 |
| `/docs/faq` | **no stub, no redirect** | itself (real page, §2) | census set, D33 / R21 |
| `/docs/limits` | **no stub, no redirect** | itself (real page, §2) | census set, D33 / R21 |
| `/docs/quickstart-python` | **no stub** | itself (real page, §2) | D28 §4 «census family kept»; D33 recommendation |

The 195 `.md` route twins and the ~180 old `/docs/reference/*` draft URLs are **not** enumerated
here: R7 owns them through the generated `old-urls.txt`, which is the enumerated live surface
committed with its own command. This file owns the *page* population; `old-urls.txt` owns the
*URL* population, and R7's coverage gate is what joins them.

## §6 Counts

| Population | Rows | Written (S0b) | Owed by S1 RUN |
|---|---|---|---|
| 1 — D28 §4 + census + AI surface | 17 | 12 | 3 pages + 2 build projections |
| 2 — D29 families | 232 | 19 | 213 |
| 3 — Learn / Guides / Understand | 19 | 3 | 16 |
| **Total pages** | **268** | **34** | **232** |
| 5 — non-page URLs | 17 | — | landing build (R7) |

**The conveyor's real size is 232 pages owed by S1 RUN, not «~105».** (Population 2 also happens
to hold 232 rows. The two numbers are unrelated — the owed total is 3 + 213 + 16 — and the
coincidence is worth naming so no one reads one as an explanation of the other.) D41's «~105 non-gold pages» and D25's
«~125-page scope» were estimates taken before any population was enumerated; this is the first
enumeration, and it more than doubles them. The whole delta is population 2: 221 members across
eleven families, of which only family B's 18 are written. **This is a finding for the operator and
for the conveyor plan (P-R), not a licence to trim the population** — D19's own falsifier («a task
>30 pages → review cannot sample at floor 5 per kind») prices it: at ~20 pages per family task,
the ten remaining families are ten aif tasks, not one.

Cross-check: S0 closure note §1 records 34 pages shipped under `docs/site/` — 5 trial + 11 face +
17 further sheets + the glossary. The «Written (S0b)» column above sums to 34, with the 5 trial
pages counted inside their populations (1 sheet and 1 overview in population 2, and the tutorial,
guide and understand pages in population 3).

## §7 The falsifiers this file must survive

- **D49 (a)** — a page merged in S1 that matches no row here, or matches a row still carrying a
  `<token>` slug → the batch prompt was not generated from this table. **Fix the generation, never
  the page.** `kickoff-s1.md §7` item 2 makes this a last act before every commit.
- **D49 (b)** — a §4 row with no provenance value → it was improvised, and the completeness check
  cannot see the omission direction. Every §4 row names its source; `kickoff-s1.md §7` item 3
  re-checks the column before each commit.
- **Population 2 drift** — regenerating the §3 rows from `docs/site/reference/<F>.json` no longer
  reproduces them → a family's membership moved under the inventory. Re-read the JSONs, amend §3,
  and re-check §6's counts in the same commit.
- **Kind widening** — a page whose content fits none of D30's seven kinds → escalate to D30 for a
  registered kind. A new word in the `kind` column of this file is the defect, not the fix.
- **Escalation that never resolves** — a row reading `ESCALATED to D30` (today: `/docs/faq/`) is a
  parked question, not a kind. If that page merges while the row still reads `ESCALATED`, D30's
  registry was widened in practice without being widened on the record — the same defect as the
  bullet above, arriving by silence instead of by a new word. The row must carry one of the seven
  before the page is written. Its sibling shape is a §5 row still reading **OPEN** (today
  `/docs/beta`, `/docs/reference`) at cutover: an un-decided URL 404s by default, which is a
  decision taken by nobody.
- **T10 order** — this file is the population, and it precedes every coverage claim about the site
  ([`ai-laziness-digest.md`](../../rules/ai-laziness-digest.md) T10). A coverage percentage quoted
  against anything other than §6's totals is measuring an unenumerated denominator.
