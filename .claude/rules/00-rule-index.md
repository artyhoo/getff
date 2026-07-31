# Rule index — generated, do not hand-edit

> **Authoritative for:** rendered rule digest. Regen: `npx tsx scripts/render-rule-index.mjs --write`.
> **NOT authoritative for:** project goal — see [README.md](../../README.md#why-this-exists). Full rule text — read `.claude/rules/<name>.md`.

One line per rule — full text: read `.claude/rules/<name>.md` (index: `.claude/rules/00-rule-index.md`).

| Rule | Class | Fires | Channel(s) |
|---|---|---|---|
| `ai-laziness-traps.md` | A | any R-phase, audit, sample-based investigation, or open-ended AI task. | always-on core |
| `attention-is-not-a-mechanism.md` | C | designing any load-bearing check (gate vs. bare human/AI attention). | always-on core |
| `autonomous-loop-continuity.md` | B | unattended turn ending with work in flight. | hook |
| `build-first-reuse-default.md` | A | any capability commit / new-capability proposal. | always-on core |
| `ci-tool-pinning.md` | A | editing `.github/workflows/**` or any repo shell script (`*.sh`, `setup`, `install.sh`). | paths:(6), edit-time inject |
| `cold-seat-economy.md` | C | re-running a cold seat on already-judged work; resume-vs-fresh choice. | skill-embed, skill-embed |
| `companion-install-principle.md` | B | editing `setup.d/**` (companion install manifest/engine). | paths:(1), edit-time inject |
| `destination-environment-verification.md` | B | kickoff authoring; accepting container work. | paths:(1), edit-time inject |
| `doc-authority-hierarchy.md` | A | creating/editing any canonical or shipped consumer-facing doc. | paths:(4), edit-time inject |
| `dual-implementation-discipline.md` | A | shipping a new CC-native hook + choosing its delivery channel(s). | paths:(3), edit-time inject |
| `egress-no-api-bypass.md` | B | harvesting/egressing a finished aif-agent branch to a PR. | skill-embed |
| `evidence-regeneration.md` | B | a per-backend toolchain-freshness gate (`checkToolchainFreshness`) goes RED, or a rendered-not-fired matrix cell needs its first live-fired evidence. | paths:(1), edit-time inject |
| `git-conflict-merge-forward.md` | B | a PR turns CONFLICTING (`mergeable_state: dirty`) because the base branch moved ahead; any urge to `git rebase` and/or `git push --force*` a published PR branch. | claude-md |
| `kickoff-staging-placement.md` | B | editing/creating any file under `.claude/orchestrator-prompts/<umbrella>/`. | paths:(1), edit-time inject |
| `language-discipline.md` | A | writing any internal machinery or human-facing output. | paths:(3), edit-time inject |
| `memory-codification.md` | B | writing a durable behavioural convention to agent memory. | hook |
| `no-paid-llm-in-ci.md` | A | editing `.github/workflows/**` or `.github/actions/**`. | paths:(2), edit-time inject |
| `parallel-subwave-isolation.md` | C | dispatching parallel sub-wave / batch AI sessions. | paths:(1), edit-time inject |
| `phase-research-coverage.md` | A | phase entry research, prior-art lookups, or closing a negative-existence claim. | paths:(4) |
| `recommendation-laziness-discipline.md` | C | before issuing an inline-chat verdict/recommendation or hitting an ambiguous fork. | digest |
| `research-source-trust.md` | A | authoring a rule-research provenance entry / resolving allowed sources. | paths:(2), edit-time inject, skill-embed |
| `reviewer-discipline.md` | C | review sessions (`/review`, `/ultrareview`, or a prose "проверь"/verdict ask). | agent |
| `rule-enforcement-channel-selection.md` | A | codifying any new rule / choosing its enforcement channel. | paths:(2), edit-time inject |
| `skill-description-quality.md` | C | authoring/updating any SKILL.md `description` field. | paths:(1), edit-time inject |
| `source-before-shape.md` | B | creating a new SKILL.md/agent/module, or authoring a dispatch/kickoff. | paths:(3), edit-time inject |
| `zcode-parity-doctrine.md` | A | editing hook twins or the harness-config renderer; authoring zcode-parity decision docs (exact set: the rule's `paths:` frontmatter). | paths:(10), edit-time inject |
