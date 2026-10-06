# Integration-staging verification receipts

Run by the integrating session on the integration tree (this directory's parent report's
"Integration addendum" describes the transposition). Every command below ran in the isolated
integration worktree on the committed final state (round 2); exit codes are literal. Heavy
gates were pinned to run locally (`PC_LOCAL=1`) because the session worktree has no PC mirror;
the pin reason quotes the gate's own `[pc] ... NOT RUN` line, per the operator-global rule.

Candidate-world receipt directories BESIDE this one (`baseline-authorized/`, `candidate/`,
`final/`, `verified/`, and the top-level `consumer-*.txt`, `extra-principles.txt`,
`preservation-delivery.txt`) record runs in the CANDIDATE worktree
(`/Users/art/.codex/worktrees/skill-progressive-disclosure/rules-as-tests-aif`) against the
unmerged `#2066` layout — they are the candidate's evidence, NOT integrated-tree evidence.
Everything in THIS directory ran on the staging-transposed tree.

| # | Check | Command | Exit | Result |
|---|---|---|---|---|
| 1 | Preservation probe (staging adaptation of the candidate's `verify-preservation.py` methodology) | `python3 integration-staging/verify-preservation-staging.py` | 0 | PASS — every pre-refactor card paragraph preserved (whitespace/link-target normalized) except exactly the 4 manually-mapped rewrite groups; getff + self-reflection: 0 rewrites; frontmatter byte-identical on all four cards. Full output: [preservation-staging.json](preservation-staging.json) |
| 2 | Skill drift (broken refs, frontmatter, invocation contract) | `bash scripts/check-skill-drift.sh` | 0 | PASS (0 errors) |
| 3 | Line citations, full corpus | `node scripts/check-line-citations.mjs --check --corpus` | 0 | 0 stale (baseline staging: 0; first integrated run caught `reviewer-discipline.md:117 → harvest/SKILL.md:100`, fixed to `:75` in this round) |
| 4 | Principles 09/14/15/22/39/48 | `npx vitest run packages/core/principles/{09-doc-authority-hierarchy,14-skill-drift-detection,15-skill-paired-negative,22-internal-english,39-skill-fence-orch-home,48-skill-description-budget}.test.ts` | 0 | 6 files, 78 tests passed |
| 5 | Plugin generation acceptance | `bash tests/plugin/skills-generation.test.sh` | 0 | PASS=15 FAIL=0 (baseline measured on pristine staging before integration: 15/15) |
| 6 | Orchestration + factory skill delivery | `bash tests/install-sh/ship-orchestration-skills.test.sh` | 0 | PASS=32 FAIL=0 (30 baseline + 2 new: `harvest: every conditional reference delivered`, `claude-glm-executor-handoff: every conditional reference delivered` — this round extends the loop to the two skills whose `references/` dirs this refactor creates) |
| 7 | Consumer-install byte-identical snapshots | `SNAPSHOT_MODE=compare bash tests/install-sh/byte-identical.test.sh` | 0 | Result: 2 pass / 0 fail (first integrated run RED by design: snapshots did not contain the new getff references; recaptured via `SNAPSHOT_MODE=capture bash tests/install-sh/snapshot.sh`, 15 fingerprint files) |
| 8 | getff dist manifest | `bash scripts/build-getff-dist.sh --check` | 0 | in sync (1259 files); first integrated run RED (`MANIFEST.sha256 differs from a fresh assembly`), rebuilt via `bash scripts/build-getff-dist.sh` — delta: 4 card hashes + 10 new references |
| 9 | Plugin payload generator no-op | `bash scripts/generate-plugin-skills.sh` | 0 | generated 0 (written), 6 already in sync |
| 10 | Reference corpus (getff.ai docs JSONs + fences) | `npx tsx scripts/render-reference.mjs --check` | 0 | up-to-date (11 family JSONs + fences); integrated-tree drift found and fixed in round 1 (see the report addendum) |
| 11 | Harness config derivation | `node scripts/render-harness-config.mjs --check` | 0 | up-to-date with `.ai-factory/harness-model.json` (the brief's `--only codex` arm is N/A on staging: the codex emitter is an unmerged `#2066` surface) |
| 12 | Whitespace | `git diff --check` | 0 | clean |

N/A on staging (brief items with no counterpart): the #2066-world Node suites
(`scripts/{canonical-agents-source,canonical-native,codex-contributor}.test.mjs` — absent from
staging; their 47/1 baseline belongs to the candidate world) and the codex renderer arm.
The candidate-world "defective legacy `skills/getff/SKILL.md` loader" does not exist on
staging: that file is the real card this refactor rewrites.

Independent cold review of the final integrated SHA (round 1 findings → this round's fixes):
MAJOR `integration-staging/` receipts promised but absent (this directory closes it); MINOR
addendum substitution-site list (fixed in the addendum); MINOR ship-test loop gap (fixed, #6);
MINOR GLM-card D1/D2 labels unresolvable from the hot card (fixed: `model-facts D1/D2`);
NOTE harvest pointer wording vs `overnight-policy.md` content (fixed); NOTE getff conditional
index does not list the two new references (accepted: both route inline at their sections).

Live model behavior remains UNTESTED (no live model run was authorized): static preservation
and delivery checks cannot prove a model follows the routing under pressure.
