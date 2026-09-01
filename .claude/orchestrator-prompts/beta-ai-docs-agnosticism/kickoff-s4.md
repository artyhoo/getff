<!-- scope: stage kickoff — beta-ai-docs-agnosticism S4 (discoverability, spec C4). Dispatch input for ONE buildable task; the umbrella plan lives in ../beta-ai-docs-agnosticism-meta-launch/kickoff.md and is NOT this file's scope. Tier 2 (no bridge-profile marker). DISPATCH CHANNEL: maintainer-paste tab — SOLO / Mode-A per the meta-launch launch-table (thin CI/config wiring, no principle-09 header surface), and the stage carries a maintainer-gated outward-facing leg (§2 D4) that no autonomous worker may perform. -->

# beta-ai-docs-agnosticism S4 — discoverability (C4)

> **Type:** execution-build (wiring), single PR onto `staging`. **Branch: `beta-c-s4-discoverability`**
> (the meta-launch umbrella-closure gate greps this exact head name — meta-launch
> [`kickoff.md`](../beta-ai-docs-agnosticism-meta-launch/kickoff.md) §3 «Umbrella closure» — a
> different branch name silently fails the gate and the umbrella never closes).
> **Binding design:** [`docs/superpowers/specs/2026-07-23-beta-program-design.md`](../../../docs/superpowers/specs/2026-07-23-beta-program-design.md)
> §6 **C4** is the design SSOT (`spec:369-375`), plus §2 **D5** for why llms routes live on the
> docs site and not in this repo (`spec:130-149`). On any divergence between this kickoff and
> the spec, **the spec wins** — surface it, never improvise.
> **Umbrella context (read-only):** [`kickoff.md`](kickoff.md) §2 row S4 +
> [`../beta-ai-docs-agnosticism-meta-launch/kickoff.md`](../beta-ai-docs-agnosticism-meta-launch/kickoff.md)
> §4 «Stage 3 — S4 Discoverability».
> **Stage gate (do NOT start before it is green):** S2 (`beta-c-s2-skills-probe`) **and** S3
> (`beta-c-s3-selfgen-docs`) both merged to `staging` — meta-launch §3 «Stage 2 → Stage 3».
> At this kickoff's authoring neither was merged; re-run both `gh pr list` searches at entry.
> **Parallel sibling:** none — S4 is the last stage and runs alone.
> **Rigor label (L0):** `build-and-verify` — the stage's own artefacts are two reversible
> repo-side files (a root config and a standalone workflow), verified by running them; the one
> irreversible, outward-facing act (the context7 submission) is deliberately NOT this worker's
> to perform (§2 D4), so no research-grade contour is bought by doing it here.
> **Base branch:** `staging`. Work in a worktree: `bash scripts/create-worktree.sh beta-c-s4`
> ([parallel-subwave-isolation.md §1](../../rules/parallel-subwave-isolation.md)).

```bash host-verify
npx vitest run packages/core/principles/37-required-context-completeness.test.ts
npx vitest run packages/core/principles/17-no-paid-llm-in-ci.test.ts
npx vitest run packages/core/hooks/unpinned-tool-install.test.ts
bash scripts/run-local-ci-sweep.sh
```

> Run by explicit path — `bash scripts/host-verify.sh .claude/orchestrator-prompts/beta-ai-docs-agnosticism/kickoff-s4.md`
> (the bare `<umbrella>` form resolves to the umbrella `kickoff.md`, not this file).
> These four are the gates a new `.github/workflows/**` file actually trips: the
> `# required-context:` declaration gate (principle 37), the paid-LLM ban (principle 17), the
> unpinned-tool-install gate ([ci-tool-pinning.md](../../rules/ci-tool-pinning.md) §1), and the
> local sweep that mirrors CI. **Any further gate this stage adds gets its runner line added to
> the block above in the same commit that adds it.**

## §0 Goal

An AI harness that has never seen this repo can find its documentation through the channel
agents actually query. Concretely: the repo is registered with context7 and returns from
`resolve-library-id`; a committed `context7.json` controls what gets indexed (`excludeFolders`)
and pushes the project's discipline rules into agent-facing snippets (`rules`); a push-triggered
workflow re-indexes deterministically instead of waiting on popularity-driven refresh. DeepWiki
stays a **secondary, acknowledged-stale** channel — never the source of a freshness-critical
claim. `llms.txt` for the REPO is **not** added; that decision is recorded, not re-litigated.

## §1 Do this FIRST — entry re-verification (both directions)

Facts measured at authoring (2026-09-01, worktree on `staging`). Snapshots — **re-verify at
entry, act on what you find**, per T3 (every claim carries command + output).

| #   | Fact measured at authoring                                                                                                                                                                                                                                                                                          | Evidence                                                                                                                                                                                                                                      | What to re-check                                                                                                                                                                                                                                    |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **The GitHub remote is `artyhoo/getff`, PUBLIC, default branch `staging`** — not the local directory name. The context7 library ID will therefore be `/artyhoo/getff`, and the upstream refresh payload `{"libraryName": "/${{ github.repository }}"}` resolves to exactly that by construction                     | `gh repo view --json name,visibility,isPrivate,defaultBranchRef` → `{"defaultBranchRef":{"name":"staging"},"isPrivate":false,"name":"getff","url":"https://github.com/artyhoo/getff","visibility":"PUBLIC"}`                                  | re-run it. If visibility flipped to private, **STOP** — context7 open submission indexes public repos only, and the whole stage is blocked on the spec §7 Phase-2 publication, not on this worker                                                   |
| 2   | **The repo is NOT indexed today**                                                                                                                                                                                                                                                                                   | `resolve-library-id(libraryName: "rules-as-tests-aif")` and a name-based probe returned `/lee-to/aif-handoff`, `/grosser/parallel_tests`, `/aspect-build/rules_ts`, `/bazel-contrib/rules_go`, `/semgrep/semgrep-rules` — no `/artyhoo/getff` | re-probe with `resolve-library-id(libraryName: "getff")`. If it now resolves, the submission leg (D4) is **already done** — consume it, do not re-submit                                                                                            |
| 3   | `context7.json` does not exist in the repo; no `llms.txt` at the root either                                                                                                                                                                                                                                        | `ls context7.json llms.txt .llms.txt` → three `No such file or directory`                                                                                                                                                                     | if either appeared since (another session, S3 overreach) → consume, don't duplicate; an appeared `llms.txt` is a **spec C4 violation** → surface it                                                                                                 |
| 4   | **The «context7 GitHub Action» named by the spec is NOT a marketplace action.** Upstash's own documented integration is a plain `curl` step against `POST https://context7.com/api/v1/refresh` with `Authorization: Bearer ${{ secrets.CONTEXT7_API_KEY }}` and body `{"libraryName": "/${{ github.repository }}"}` | context7 docs `integrations/github-actions.mdx`, retrieved via context7 MCP 2026-09-01 (see §2 D0 for the full prior-art record)                                                                                                              | re-retrieve before writing the workflow — if upstream has since published a real marketplace action, ADOPT that instead and record the change. Do **not** adopt the third-party `rennf93/upsert-context7` without an SSOT entry of its own          |
| 5   | **`CONTEXT7_API_KEY` is a repository secret that does not exist yet** and cannot be created by a worker                                                                                                                                                                                                             | no secret is referenced by any workflow: `grep -rn 'CONTEXT7' .github/` → empty                                                                                                                                                               | re-check. Its absence is **not** a blocker for landing the workflow — it is the reason §4 acceptance item 4 is stated as a _degradation_, not a green claim                                                                                         |
| 6   | **Every job in a standalone workflow file must declare `# required-context: yes\|no`** — principle 37 asserts it, and two in-repo lists are checked against the declared set                                                                                                                                        | `packages/core/principles/37-required-context-completeness.test.ts:1-45`; live markers e.g. `.github/workflows/link-checker.yml:39` (`required-context: no — paths:-filtered …`)                                                              | read the current marker grammar from a sibling workflow before writing yours; the refresh job is `no` (push-triggered, reports on no PR) with the reason spelled out                                                                                |
| 7   | 12 workflows exist; `workflow-integrity.yml` fires on `.github/workflows/**` edits, and `actionlint` + `zizmor` run inside `audit-self.yml`                                                                                                                                                                         | `ls .github/workflows/` → 12 files; `.github/workflows/workflow-integrity.yml:6-13`; `audit-self.yml:252-257`                                                                                                                                 | your new file is linted by both — expect `zizmor` template-injection findings if you interpolate `${{ … }}` inside `run:` beyond the two upstream-sanctioned expressions; prefer `env:` indirection, as `audit-self.yml:946` and `:1153` already do |
| 8   | **No SSOT prior-art entry covers context7-as-a-discoverability-channel.** The register's context7 mentions are all about context7 as a _research tool_ for capability lookups (`prior-art-evaluations.md:53`), never as a shipped indexing target. Highest existing row id: **263**                                 | `grep -niE 'context7\|deepwiki\|llms.txt\|discoverab' docs/meta-factory/prior-art-evaluations.md`; `grep -cE '^\| [0-9]+ \|' …` → 263 rows                                                                                                    | re-check the highest id before appending — other stages land rows concurrently. The new row is **mandatory** (§2 D0)                                                                                                                                |

Also re-run the pre-dispatch in-flight probe (`SLUG=beta-ai-docs-agnosticism bash .claude/skills/dispatcher/helpers/probe-inflight.sh`,
`gh pr list --state open`, `git branch -a --list '*beta-c-s4*'`) — at authoring, zero in-flight
work on this stage's surfaces.

## §2 Deliverables

### D0 — Prior-art record FIRST (build-vs-reuse, binding order)

This stage's workflow is a **capability commit** if it lands ≥80 LOC under `packages/` — it will
not — but the _decision_ «which re-index mechanism do we ship» is exactly the build-vs-reuse
call [CLAUDE.md](../../../CLAUDE.md) governs, and §1 row 8 measured the SSOT silent on it. So:
**append a new row to [`docs/meta-factory/prior-art-evaluations.md`](../../../docs/meta-factory/prior-art-evaluations.md)
in the same commit as the workflow**, with `Verdict` / `Rationale` / `Trigger to revisit` per its
§3, and carry a `Prior-art:` trailer on that commit.

The consult is already run — reproduce it at entry, then record it. Findings, 2026-09-01:

- **`context7.json` schema (ADOPT verbatim — do not invent fields).** Retrieved from
  `upstash/context7` `docs/library-owners.mdx` via context7 MCP. Fields, all optional:
  `$schema` (`https://context7.com/schema/context7.json`), `projectTitle`, `description`,
  `branch` (defaults to the repo default branch), `folders`, `excludeFolders`, `excludeFiles`,
  `rules` (array of guidelines handed to coding agents), `previousVersions[].tag`,
  `branchVersions[].branch`. **Inclusion logic:** `excludeFolders` always takes priority over
  `folders`; a file is included only if it matches no exclusion and, when `folders` is non-empty,
  sits under a listed folder. Glob patterns are supported in `excludeFolders`.
- **Re-index mechanism (ADOPT upstream's documented workflow; do NOT hand-roll).** Upstash ships
  the integration as a workflow snippet, not a marketplace action —
  `docs/integrations/github-actions.mdx`: a `push`-triggered job whose single step is
  `curl -s -X POST https://context7.com/api/v1/refresh -H "Content-Type: application/json"
-H "Authorization: Bearer ${{ secrets.CONTEXT7_API_KEY }}" -d '{"libraryName": "/${{ github.repository }}"}'`.
  Adopt that shape; adapt only the branch (upstream's sample says `master`, ours is `staging`) and
  the repo's own conventions (`# required-context:` marker, `env:` indirection for zizmor,
  `permissions:` least-privilege).
- **Third-party alternative surveyed and REJECTED for now:** `rennf93/upsert-context7`
  (marketplace action, `operation: refresh`, 30-minute default timeout). Rejected because it adds
  a third-party action dependency for what upstream documents as one `curl` line — a new supply-chain
  surface with no capability gain. Record the rejection with that rationale; it is the
  build-vs-reuse verdict, not an omission.
- **Coverage note (T14):** three context7 phrasings plus one WebSearch and one WebFetch were run;
  the WebFetch of `context7.com/docs/adding-libraries` returned the submission flow but **not**
  the schema — the schema came from the `library-owners` doc via MCP. State the coverage honestly
  in the row rather than implying a complete survey.

### D1 — `context7.json` at the repo root

Per the schema in D0. Binding content decisions:

- **`excludeFolders`** — this repo is mostly non-documentation from an agent's point of view.
  Enumerate the population first (T10): list every top-level directory and verdict each as
  _indexable_ or _excluded_, with a one-line reason per row, in the PR body. Obvious exclusion
  candidates to verdict explicitly rather than assume: `node_modules`, `.claude/worktrees`,
  `tests/install-sh/baselines`, `docs/meta-factory/retros`, `.git`-adjacent generated trees.
  **A directory excluded without a stated reason is an unrecorded judgment** — that is the
  failure this stage is supposed to end, not repeat.
- **`rules`** — the spec's load-bearing clause: «the `rules` field carries discipline rules into
  agent-facing snippets» (`spec:370-371`). Source them from
  [`.claude/rules/00-rule-index.md`](../../rules/00-rule-index.md) — the rendered digest — not by
  re-summarising each rule file by hand. Each entry is one short imperative sentence. **Point,
  don't fork:** if an entry restates a rule's substance rather than its instruction, it becomes a
  second copy that drifts (T-BAD-C, inherited).
- **`branch`** — see §6: which branch context7 indexes is a **fork, not a default**. Park it.
- `projectTitle` / `description` — keep them consistent with `README.md`'s own framing; do not
  invent a new product description here.

### D2 — Re-index workflow at `.github/workflows/context7-refresh.yml`

Upstream's shape (D0), adapted to this repo:

- `on: push: branches: [staging]` — plus `main` only if the D3 branch fork resolves that way.
- One job, one step. The job carries `# required-context: no — <reason>` (§1 row 6); the reason
  states that a push-triggered job reports on no pull request and therefore cannot be a
  registrable required context.
- `permissions: contents: read` (least privilege — no write scope is needed to POST to an
  external API).
- No `${{ … }}` interpolation inside `run:` beyond the two upstream expressions; if `zizmor`
  flags either, move it to `env:` rather than suppressing the finding.
- No tool installs → the [ci-tool-pinning.md](../../rules/ci-tool-pinning.md) pin rule has no
  surface here, but the host-verify block runs its gate anyway to prove the absence.
- **Zero paid-LLM calls** ([no-paid-llm-in-ci.md](../../rules/no-paid-llm-in-ci.md)) — a
  documentation-index refresh is not an LLM call; state that verdict in the PR body rather than
  leaving the reader to infer it.
- **Failure posture:** decide and state whether a failed refresh fails the workflow. Bias toward
  **failing loudly** — a silently-swallowed refresh is `#warning-nobody-reads`
  ([attention-is-not-a-mechanism.md §2](../../rules/attention-is-not-a-mechanism.md)).

### D3 — The DeepWiki + llms.txt decisions, recorded

- **DeepWiki: secondary, acknowledged.** It auto-indexes and refreshes rarely (`spec:373-374`).
  The deliverable is one short recorded statement — in the PR body and, if a natural home exists,
  in the AI-facing docs S1 landed — that DeepWiki may be used for orientation snapshots and
  **never** for a freshness-critical claim. Do not wire any gate or doc claim to it.
- **`llms.txt` for the repo: NOT added.** Rejected in the spec on crawler-log evidence
  (`spec:374-375`); llms routes live on the docs site under D5/umbrella B (`spec:140-142`).
  Record the decision and its provenance. **Do not re-litigate it**, and do not add the file «for
  completeness».

### D4 — The submission leg is MAINTAINER-GATED (never performed by the worker)

Submitting the repo to context7 is an **outward-facing action on an external service**, performed
through `context7.com/add-library`. The worker **prepares** it and **surfaces** it: the PR body
carries a ready-to-execute block naming the exact URL to paste (`https://github.com/artyhoo/getff`),
the expected resulting library ID (`/artyhoo/getff`), and the follow-up the maintainer must also
perform — creating the `CONTEXT7_API_KEY` repository secret without which D2's workflow is a
no-op. **The worker never submits, and never creates the secret.** A PR that claims the
submission is done without the maintainer having performed it is a false completion claim.

## §3 Out of scope (do NOT do these here)

- `llms.txt` in this repo, and any llms route (docs site → umbrella B / spec D5).
- Docs-site content, navigation, or search wiring — umbrella B.
- The skills census probe / conformance declarations — **S2**; generated sections, renderers, and
  `agents/claims-conformance-auditor.md` — **S3**. Both stages must be merged before this one
  starts; consume their output, never re-do it.
- Direct edits to `README.md`, `CLAUDE.md`, `PROPOSAL.md` (frozen),
  `.claude/session-bootstrap.md`, or any `.claude/rules/*` file — the D7 ownership carve-out
  (`spec:376-382`) means **patch proposals only**. Reading `00-rule-index.md` to source the
  `rules` array is a read, not an edit.
- Registering any status check on branch protection — operator-only, and unreadable from CI by
  construction (principle 37's own «NOT authoritative for» clause).
- Adding npm deps, editing `~/.claude/**`, renaming anything (R1 name freeze, `spec` §7).

## §4 «Works» — acceptance (command + output quoted in the PR body)

1. **`context7.json` parses and validates:** `node -e "JSON.parse(require('fs').readFileSync('context7.json','utf8'))"`
   output pasted, and the `$schema` line present.
2. **The `excludeFolders` population table is in the PR body** — every top-level directory, its
   verdict, and its reason (T10: enumeration before selection). The adversarial counter-prompt
   («what indexable surface did I exclude by accident?») is **written and RUN**, its answer quoted
   (T7).
3. **`host-verify` block green on the host** — all four commands, output pasted, including any
   runner line this stage added.
4. **The workflow's live-green claim is stated HONESTLY, not asserted.** Until the maintainer
   creates `CONTEXT7_API_KEY` and performs the D4 submission, the workflow **cannot** run green —
   the refresh call has no key and no library to refresh. The PR states this as a named
   degradation (`INCONCLUSIVE — blocked on maintainer legs D4a/D4b`), with the exact two actions
   the maintainer must take. **Do not paste a green run you did not get, and do not soften the
   umbrella AC into «the workflow is syntactically valid».** The umbrella's AC («the Action runs
   green») is satisfied at the _maintainer's_ action, and the PR says so.
5. **`resolve-library-id` returns this repo — or is honestly reported as not-yet-indexed.** Paste
   the probe output either way. A not-yet-indexed result is the expected pre-submission state, and
   reporting it as such is the deliverable; claiming indexing that has not happened is the failure.
6. **The SSOT row is appended** (D0) with `Verdict` / `Rationale` / `Trigger to revisit`, and the
   commit carries its `Prior-art:` trailer. Quote the row.
7. **The two recorded decisions are present** (D3): DeepWiki-as-secondary and llms.txt-not-added,
   each with its spec citation.
8. **`git diff --name-only` contains no maintainer-owned or `.claude/rules/*` path.** Quote the
   file list.

## §5 Permitted files (binding)

This stage's allowlist: `context7.json` (new, repo root),
`.github/workflows/context7-refresh.yml` (new), `docs/meta-factory/prior-art-evaluations.md`
(append-only, one row), and — only if S1's landed AI-facing docs have a natural home for it — the
one-sentence DeepWiki-is-secondary note from D3. Nothing else.

S2 and S3 have merged by the time this stage runs; their surfaces (`tests/agnosticism/probes/*`,
principle 21, `.claude/skills/*/SKILL.md` declarations, `agents/claims-conformance-auditor.md`,
generated sections and renderers) are **finished work to consume, never to amend**. A defect found
in either is surfaced in the PR body as a follow-up observation, not fixed here
([CLAUDE.md «PR strategy»](../../../CLAUDE.md) — no drive-by scope expansion).

Recording a fired PARK is not a file write (meta-launch §4c park-record contract; /pipeline §5):
it lands in the park payload + the PR's `## Parked questions`, and its correction lands as a
separate owner commit — so this allowlist deliberately names no park-record artefact.

## §6 Park-don't-guess contract (BINDING)

> **Fork discipline (non-negotiable):** On ANY genuine fork or ambiguity (two defensible
> implementations, an undecided design choice, a missing spec detail that changes behaviour) —
> **do NOT pick.** Park it as a question (stated as «Option A → consequence X / Option B →
> consequence Y») and **stop that thread.** Proceed only on the unambiguous parts. Guessing a fork
> to «keep moving» is the failure this loop exists to prevent.

**Known fork-prone spots — park rather than guess:**

- **Which branch context7 indexes.** Option A → `staging` (the repo default and the trunk; agents
  get the newest disciplines, including ones not yet promoted to prod). Option B → `main` (prod;
  agents get only what has been promoted, at the cost of lagging the trunk). The `branch` field and
  the workflow's `on: push: branches:` list must agree, whichever way it resolves. This is a
  product decision about what a stranger's agent should see — **the maintainer's, not yours.**
- **Whether the refresh workflow also fires on `main`** — follows the branch fork; park with it.
- **Whether a failed refresh fails the build.** Resolve it yourself _if_ the failure mode is
  unambiguous; park it if it turns out a red workflow on `staging` would block unrelated merges.
- **Any `excludeFolders` row you cannot verdict from evidence** — park the ROW (leave the directory
  indexed, which is the reversible branch), proceed with the rest.
- **Whether a `rules` entry restates rather than points** — when in doubt, drop the entry and park
  the question; a shorter honest array beats a forked copy of the rule corpus.
- **If S2 or S3 landed something that changes this stage's surface** (e.g. a generated section that
  should feed `rules`) — park the boundary question rather than silently absorbing their scope.

Technical forks strictly inside these bounds (JSON key order, workflow job name, the exact wording
of the recorded decisions) are yours — resolve them and record why in the PR body.

## §7 AI-laziness traps ([.claude/rules/ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md))

**Active traps for this stage: T2, T3, T7, T10, T11, T12, T14, T16, T19, T20, T21.**

- **T2** — designing ≠ auditing. A workflow that «would» re-index is not the deliverable; the
  pasted probe output and the honestly-labelled degradation are.
- **T3** — every entry-table row and every acceptance claim carries command + output or
  `file:line` + the line's actual content. Prose-only findings are not findings.
- **T7** — the §4 item 2 counter-prompt is written and RUN, not ticked.
- **T10** — population enumeration BEFORE selection: the top-level directory census precedes the
  `excludeFolders` array, in that order, with the census in the PR body.
- **T11** — the mechanism proposal (which re-index path to ship) required an external search
  before «I propose…». It was run (D0) — **reproduce it at entry**, do not inherit the verdict on
  faith.
- **T12** — context7's own surface changes fast and training-data knowledge of it is stale by
  construction. Re-retrieve the schema and the integration doc **at the moment of writing**, not
  from memory or from this kickoff's transcription of them.
- **T14** — a clean JSON parse over an unenumerated directory tree is «coverage insufficient», not
  «indexing correct». Say which.
- **T16** — context7 is an ADOPTED external standard: state «upstream problem class: a library
  owner controlling what an agent-facing indexer ingests. Our problem class: same» — and if any
  part of ours differs (an operator repo that is also a shipped framework), say where the transfer
  stops instead of cargo-culting the config.
- **T19** — run your own adversarial cold review of the diff before handoff; CI checks workflow
  syntax and marker presence, never whether the `rules` array is honest.
- **T20** — every verdict carries evidence.
- **T21** — delegate the backward sweep to [`agents/backward-sweep-auditor.md`](../../../agents/backward-sweep-auditor.md),
  handing it the change **class** only (§8).

**Inherited domain traps (umbrella §4 + meta-launch §5):**

- **T-BAD-A** — «it works because it ran once». Here the sharper form is «the workflow file exists,
  therefore re-indexing happens» — it does not, until the secret and the submission exist (§2 D4).
- **T-BAD-C** — a `rules` entry that INLINES a rule's substance is a fork of that rule; generation
  or config does not launder ownership. Point, don't copy.

**New domain trap (this stage):**

- **T-BADC-S4-A — «external-service green by assertion».** The tempting move: the workflow is
  syntactically valid and `actionlint` is happy, so report the umbrella AC («the Action runs
  green») as met. It is not: the run needs a repository secret this worker cannot create and a
  library registration this worker must not perform. **Falsifier:** the PR claims the AC is met
  while `grep -rn 'CONTEXT7' .github/` is the only evidence of the integration existing, and no
  workflow run URL with a 2xx response body is quoted → the claim is asserted, not measured.

## §8 PR-body requirements (REQUIRED checks on `staging`)

**§1.7 mandate:** the meta-launch §4b path list does **not** cover this stage's surfaces
(`.github/workflows/**` and the repo root are outside it) — meta-launch `kickoff.md:220-221` states
this explicitly. Use the mechanical-maintenance escape hatch only if it is honestly true; if the
run ends up touching a mandate path after all, the full Forward/Backward shape is ON (H3 depth, the
word «applied», ≥40 non-whitespace chars per section, ≥1 `path.ext:NN` citation per section — run
the meta-launch §4b pre-flight greps before `gh pr create`).

**T21 backward sweep.** Change class = _a new standalone workflow file plus a root config consumed
by an external service_. Sibling surfaces to enumerate and verdict, at minimum: the 12 existing
workflows and their `# required-context:` declarations (does yours agree with the population
principle 37 checks?); `scripts/run-local-ci-sweep.sh`'s `# REQUIRED_CONTEXTS` list;
`.github/workflows/workflow-integrity.yml`'s R11 assertion; the `actionlint` + `zizmor` jobs inside
`audit-self.yml`; and every other root-level config a fresh clone carries (does `context7.json`
collide with, or contradict, any of them?).

**`## Provenance` — fill it** (marks this a stage PR; `FIDELITY: skipped` becomes mechanically
unavailable — `packages/core/hooks/checks/pr-body-fidelity.ts:44,147-152`). **`## Fidelity verdict`
— required:** a real GO block from a cold [`agents/fidelity-auditor.md`](../../../agents/fidelity-auditor.md)
run (`FIDELITY: GO` + `Basis:` + `Round:` + `Audited-SHA:` prefixing the PR head at merge time + ≥1
`file:line` evidence). Exactly one section, one `FIDELITY:` line; rework rounds REPLACE the block.

**`## Parked questions`** — the §6 branch fork will almost certainly be live here. State each park
as «Option A → consequence X / Option B → consequence Y».

**`Prior-art:` trailer** on the commit carrying D0's SSOT row.

## §9 Stop conditions

- **The stage gate is not green** — either `beta-c-s2-skills-probe` or `beta-c-s3-selfgen-docs` is
  unmerged → STOP; do not start. This is the umbrella's declared order (`S1 → S2 ∥ S3 → S4`).
- The repo is no longer public (§1 row 1) → STOP; the stage is blocked on spec §7 Phase 2, not on
  you.
- You are about to submit the repo to context7, create the `CONTEXT7_API_KEY` secret, or register a
  status check → STOP; those are maintainer legs (§2 D4).
- You are about to add `llms.txt`, or to re-open the decision not to → STOP; it is spec-settled
  (`spec:374-375`).
- You are about to edit a maintainer-owned file or any `.claude/rules/*` file → STOP; proposals
  only, and this stage plans none.
- A design decision would diverge from spec C4 / D5 → STOP and surface.
- The branch fork (§6) is unresolved and you are about to pick one to «keep moving» → STOP and
  park; the `branch` field and the workflow trigger both depend on it.
- The local CI-equivalent sweep goes red from a branch-introduced cause → fix before handoff.

## §10 See also

- [`docs/superpowers/specs/2026-07-23-beta-program-design.md`](../../../docs/superpowers/specs/2026-07-23-beta-program-design.md) §6 C4 + §2 D5 — the binding design.
- [`kickoff.md`](kickoff.md) §2 row S4 — the umbrella's scope and gate for this stage.
- [`../beta-ai-docs-agnosticism-meta-launch/kickoff.md`](../beta-ai-docs-agnosticism-meta-launch/kickoff.md) §3 (umbrella closure gate) + §4 Stage 3 (the S4 block) + §4b (the §1.7 path list).
- [`kickoff-s3.md`](kickoff-s3.md) — the immediately preceding stage; consume its output, do not amend it.
- [`.claude/rules/ci-tool-pinning.md`](../../rules/ci-tool-pinning.md) · [`.claude/rules/no-paid-llm-in-ci.md`](../../rules/no-paid-llm-in-ci.md) · [`.claude/rules/attention-is-not-a-mechanism.md`](../../rules/attention-is-not-a-mechanism.md) — the disciplines a new workflow file engages.
- [`.claude/rules/build-first-reuse-default.md`](../../rules/build-first-reuse-default.md) + [`docs/meta-factory/prior-art-evaluations.md`](../../../docs/meta-factory/prior-art-evaluations.md) — the D0 obligation.
- [`packages/core/principles/37-required-context-completeness.test.ts`](../../../packages/core/principles/37-required-context-completeness.test.ts) — the `# required-context:` declaration gate.
