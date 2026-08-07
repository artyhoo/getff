<!-- scope: stage-scoped dispatch input — S-I of the arch-v2-context-pipeline umbrella (doctor-surfaced context-economy residue, operator-invited 2026-08-06). HOST-BOUND stage like S-H: NO bridge-profile marker — executed by a host CC session holding this kickoff (container lacks ~/.claude, /context, live hook surfaces). Seat: MID tier (Opus today — operator directive 2026-08-06), NOT the GLM executor tier: description authoring is routing-load-bearing judgment (skill-description-quality class), and the session MUST load its skill-authoring toolkit before P-I1/P-I2 — `superpowers:writing-skills` + the repo `ai-doc` skill; `skill-description-quality.md` fires edit-time via paths. The remaining items (P-I3..P-I6, P-I8) are mechanical host-config work the same session carries. -->

# S-I — doctor-surfaced context-economy residue (skills listing + host config debt)

> **Provenance:** operator `/doctor` scan 2026-08-06 (50 sessions / 5 days), cross-checked and
> recorded in `docs/superpowers/specs/2026-08-06-pipeline-token-economy-design.md` §8; the §8
> rev-4 disposition («deferred out of umbrella») was SUPERSEDED same day by explicit operator
> invitation («умбрелла всё берёт» — CLAUDE.md «PR strategy» explicit-invitation exception).
> **Depends on S-G MERGED** (rev 5, 2026-08-06 — corrects the rev-4 «independent, concurrent with
> everything» claim, which a Phase -1 cold review falsified). The budget *surface* is indeed
> disjoint from the rules resident set, but the *file set* is not: S-G's `§2 Permitted files`
> reserves `.claude/skills/{arch,harvest,dispatcher}/SKILL.md` and `tests/install-sh/*`
> (`../arch-v2-context-pipeline-s-g/kickoff.md:117-131`), and this stage edits every
> `.claude/skills/*/SKILL.md` plus the same snapshots. Independent of S-E and S-H — those touch
> neither surface. **Dispatch gate:** `gh pr list --search "is:merged head:<s-g-branch> base:staging"`
> returns S-G's PR; the baseline in §0 is then re-measured against post-S-G `HEAD` before any trim.

## §0 Problem (measured)

The harness's skill-listing budget (~2k tokens ≈ 1% window) is exceeded ~4.5×: names +
descriptions across all sources ≈ 9.1k est. tokens (doctor, disk-side). Over budget the
harness truncates descriptions → inter-skill routing degrades for EVERY session.

**Metric correction (rev 5) — the rev-4 baseline was inflated by 11.4% and the gate it fed was
gameable.** The rev-4 `awk` (`/^description:/{flag=1} flag{print} /^---$/ && NR>1{exit}`) prints
from `description:` to the **closing `---`**, so it swept `allowed-tools`, `argument-hint`,
`arguments`, `model` and `disable-model-invocation` into the number. Two consequences: the
«10,719 B» figure was never the description weight, and a gate on it would have been satisfied by
**deleting `allowed-tools` entries** — a permission-surface regression rewarded as an improvement.
The binding extractor is now description-only: start at `^description:`, stop at the next
top-level `^[A-Za-z_-]+:` key or the closing `---`.

**Baselines re-measured on the host 2026-08-06 with the corrected extractor** (re-measure at stage
start; these are the pre-S-G numbers):

| Population | Files | Description bytes | Top entries |
|---|---|---|---|
| project `.claude/skills/*/SKILL.md` | **14** (rev 4 said «16» — `find .claude/skills -name SKILL.md \| wc -l` → 14) | **9,497 B** (awk-as-written would say 10,719) | `arch` 1,230 · `self-reflection` 965 · `claude-glm-executor-handoff` 896 · `aif-doctor` 762 · `night-mode` 723 |
| user `~/.claude/skills/*/SKILL.md` | 6 | **4,591 B** | `orchestrator` 1,289 · `uniq-rewrite` 1,185 · `native-css-responsive` 755 · `design-compare` 576 · `pr-template-multi-phase` 530 · `ai-docs` 256 |

App-bundled plugin share
(~6.2k) is NOT settings-controllable per the doctor scan — P-I5 probes the one uncertain edge.
Plus host config debt the same scan surfaced: two duplicate keys in
`.claude/settings.local.json`, a dead 5.5 MB marketplace backup, and a PostToolUse:Bash hook
blocking the loop at 3.9 s median when it fires.

## §1 Work items

**P-I1 — trim project skill `description:` fields (repo, committable).**
Load `superpowers:writing-skills` and the repo `ai-doc` skill FIRST — the trim is a
skill-authoring pass under their discipline, not a mechanical byte cut.
For each of the **14** `.claude/skills/*/SKILL.md`: keep the routing-load-bearing content —
trigger keyword lists (RU + EN), the when-to-use / when-NOT clause — drop narrative prose,
duplicated SSOT references, and anything restating the body. Discipline:
`.claude/rules/skill-description-quality.md` (fires edit-time via `paths:`).

**Targets (rev 5 — derived from the corrected §0 baseline, not from the inflated one):**
project description total **≤ 6,800 B** (−28% from 9,497) AND no single description **> 800 B**
(the cap alone retires the `arch` 1,230 / `self-reflection` 965 / `claude-glm-executor-handoff` 896
outliers). The two numbers are deliberately absolute, not «cut by X%»: a percentage gate against a
baseline measured by the same run is vacuous.

**Escape token — bounded, because routing outranks bytes.** If a further trim would drop a distinct
trigger class (per P-I7), the skill is left over-budget and the PR body carries
`OVER-BUDGET: <skill> — <bytes> B — trigger class kept: "<the phrase class>"` with the inventory
diff line quoted. **At most 2 skills** may use it; a third is a STOP → surface as DECISION-NEEDED,
never a silent pass. Precedent for error-with-escape-token: `ci-tool-pinning.md §3`.

MUST preserve: every distinct trigger phrase class present before the trim (inventory in P-I7).

**Install-shipped set (enumerated, rev 5 — the rev-4 conditional «if any trimmed skill is
install-shipped» hid a twin).** `setup.d/10-skills.sh:92` ships by plain copy:
`template-audit`, `ai-doc`, `rule-research`, `rule-tests`. Separately `setup.d/10-skills.sh:44`
ships `tool-bootstrapping` from the **repo-root `skills/`** directory, NOT from `.claude/skills/` —
and the two copies already differ (`md5 -q .claude/skills/tool-bootstrapping/SKILL.md
skills/tool-bootstrapping/SKILL.md` → different hashes). Consequence: trimming
`.claude/skills/tool-bootstrapping/SKILL.md` does **not** reduce a consumer's listing weight.
**Decision:** trim BOTH copies of `tool-bootstrapping` in this stage (the shipped twin is the one
that reaches consumers); state both paths in the PR body. Regenerate install fingerprints
(`SNAPSHOT_MODE=capture bash tests/install-sh/snapshot.sh`) in the same PR whenever any of those
five is touched — the agents/*.md fingerprint incident (8/13 baselines red) is the precedent.

**P-I2 — trim user skill descriptions (host, `~/.claude/skills/*/SKILL.md`) — GATED (rev 5,
operator decision 2026-08-06).** Same discipline as P-I1, applied to all **6** host skills
(`orchestrator` 1,289 B · `uniq-rewrite` 1,185 · `native-css-responsive` 755 · `design-compare`
576 · `pr-template-multi-phase` 530 · `ai-docs` 256 — rev 4 named only four). Host-side edit, no
repo commit — but **no longer report-graded**: the §3.5 contract carries an absolute-path
assertion (`"$HOME"/.claude/skills/*/SKILL.md`), because `host-verify.sh` runs from the repo root
and a repo-relative glob structurally cannot reach this population. Target: user description total
**≤ 3,200 B** (−30% from 4,591), same ≤ 800 B per-skill cap and the same bounded escape token as
P-I1 (the 2-skill budget is shared across P-I1 + P-I2, not per-item).
Note `uniq-rewrite` and `pr-template-multi-phase` are already `"off"` in `skillOverrides` (P-I4):
verify whether a disabled skill still occupies listing weight, and if it does not, exclude those
two from BOTH the baseline and the target and state the re-derived numbers in the PR body.

**P-I3 — `settings.local.json` dedupe (host). — EXECUTED 2026-08-06 in the /arch session
(Actions-outage window); stage VERIFIES only.** What ran: conditional sweep over the worktree
copies — `claudeMdExcludes` dropped ONLY where the worktree's committed
`.claude/settings.json` already carries the 7-entry `**/` glob form; the duplicate
`inject-memory-codification.sh` PostToolUse:Write registration removed (committed registration
is the survivor); `feat-prune-worktrees` left untouched (committed file not ready). Backup:
session scratchpad `settings-local-backup-*.tar.gz`.

**Census corrected (rev 5).** Rev 4 claimed «all 21 worktree copies» and «3 sites»; the host
carries **23** `settings.local.json` copies, of which **5** show `claudeMdExcludes` absent —
the three named plus `pipeline-adapter-jig-j3-2787a1` and `pipeline-8bb231`; two copies
(`feat-prune-worktrees`, `webresearch-reports-repo-032830`) still carry the 7-entry form
though only the former was named as untouched. A present-state scan cannot distinguish
«dropped» from «never had the key» — say which, or record INCONCLUSIVE.

**Stage obligation — two literal commands with expected outputs (rev 5; the rev-4 «re-run the
census (`md5` over worktree copies)» was not falsifiable, and an `md5` over whole files cannot
isolate the two keys in question):**

```bash
# (a) excludes census — expect: every copy either "none" or the 7-entry form, and the count of
#     each stated in the report. Any NEW copy carrying the absolute (non-`**/`) form is a finding.
for f in $(git worktree list --porcelain | awk '/^worktree /{print $2"/.claude/settings.local.json"}'); do
  [ -f "$f" ] && printf '%s %s\n' "$(jq -r '.claudeMdExcludes | if . == null then "none" else length end' "$f")" "$f"
done | sort | uniq -c
# (b) duplicate-hook census — expect: 0 in EVERY copy (committed registration is the survivor).
for f in $(git worktree list --porcelain | awk '/^worktree /{print $2"/.claude/settings.local.json"}'); do
  [ -f "$f" ] && printf '%s %s\n' "$(grep -c inject-memory-codification.sh "$f")" "$f"
done | awk '$1 != 0 {print "VIOLATION: " $0; n++} END {exit n?1:0}'
```

Plus: confirm one-time hook fire on a live Write, and re-apply the conditional drop to any
worktree whose branch has since picked up the `**/` committed form.

**P-I4 — `skillOverrides` off-switches (host, `~/.claude/settings.json`). — EXECUTED
2026-08-06 in the /arch session; stage VERIFIES only.** `"uniq-rewrite": "off"` added next to
the pre-existing `"pr-template-multi-phase": "off"` (0 uses / 243 launches; verbatim duplicate
of `anthropic-skills:uniq-rewrite`). Backup: scratchpad `user-settings-backup.json`. Stage
obligation: confirm the skill is absent from a fresh session's listing.

**P-I5 — plugin-skill suppression probe (host, empirical).**
Determine EMPIRICALLY whether plugin-namespaced skills obey `skillOverrides` (e.g.
`"anthropic-skills:uniq-rewrite": "off"`) or any other user-reachable switch.

**Executable form (rev 5 — «inspect the skill listing» was not a command; T-SI-B demands quoted
listing output, so the probe must produce one deterministically):**

```bash
# 0. back up first — this mutates ~/.claude/settings.json
cp ~/.claude/settings.json ~/.claude/settings.json.s-i-probe-bak
# 1. baseline BEFORE the override (expect 1)
claude -p 'List every skill name available to you, one per line, nothing else.' 2>/dev/null \
  | grep -c 'anthropic-skills:uniq-rewrite'
# 2. set the namespaced override
jq '.skillOverrides["anthropic-skills:uniq-rewrite"] = "off"' ~/.claude/settings.json > /tmp/s-i.json \
  && mv /tmp/s-i.json ~/.claude/settings.json
# 3. re-probe in a FRESH session (expect 0 if suppression works, 1 if it does not)
claude -p 'List every skill name available to you, one per line, nothing else.' 2>/dev/null \
  | grep -c 'anthropic-skills:uniq-rewrite'
# 4. restore unless the operator opts to keep it
mv ~/.claude/settings.json.s-i-probe-bak ~/.claude/settings.json
```

Verdict = the before/after pair (`1 → 0` = suppression works; `1 → 1` = it does not). Both counts
and the surrounding listing excerpt go in the report; a verdict without the pair is T20.
Report the verdict either way with the observed listing excerpt. If suppression works:
list the zero-use plugin skills as candidates in the stage report — the OPERATOR picks which
to disable (their machine, their listing); do NOT bulk-disable autonomously. If not: record
the negative with the probe evidence; the ~6.2k plugin share is then formally out of
user-settings reach (upstream-tool limitation, not our gap).

**P-I6 — `post-api-push-autosync.sh` latency fix (host, `~/.claude/hooks/`).**
Blocking network at 3.9 s median / 7.5 s max per fired call. Fix = deferred-report pattern,
NOT plain backgrounding: move each path's network body to a detached background job writing
its outcome line to a stamp-adjacent report file (`/tmp/aif-autosync.report`); the NEXT hook
invocation (any Bash call) emits and truncates any pending report lines FIRST, so both loud
warnings (`DIVERGED`, `ff failed — ref NOT moved`) still reach the active session model, one
turn late. Plain `&` without the report relay would orphan those warnings —
`#warning-nobody-reads` (`attention-is-not-a-mechanism.md` §1); the DIVERGED line's named
consumer is the session model (hook comment, 2026-07-10 31-commit-drift incident). Keep
`AIFAUTOSYNC_DEBUG=1` fully synchronous and network-free — `post-api-push-autosync.test.sh`
must stay green unmodified; gate logic (all greps, worktree checks) stays synchronous.

**P-I7 — trigger-vocabulary inventory (repo, the P-I1/P-I2 acceptance instrument).**
Before trimming: extract per-skill trigger-phrase inventory (the comma/dash-separated trigger
lists) to `docs/superpowers/specs/2026-08-06-skill-trigger-inventory.md`. After trimming:
re-extract, diff — the diff MUST show only prose/duplicate removals, zero lost trigger
classes. This file is the reviewable evidence, not a claim.

**P-I8 — disk residue sweep (host, trivial).**
Delete `~/.claude/plugins/marketplaces/claude-plugins-official.bak` (5.5 MB, unregistered in
`known_marketplaces.json`) and the six `~/.claude/plugins/blocklist.json.*.tmp` files. Verify
unregistered-ness first (`jq . ~/.claude/plugins/known_marketplaces.json | grep -c official.bak`
→ 0) — deletion is the irreversible branch (T17): `tar` the .bak to `~/.claude/trash-$(date +%F).tar.gz`
before `rm`, note the path in the report.

## §2 Permitted files

Added rev 5 — its absence is what let the rev-4 «concurrent with everything» claim hide a
collision with S-G's reserved set (Phase -1 BLOCKER, 2026-08-06).

**Repo (committed in this stage's PR):** `.claude/skills/*/SKILL.md` (the frontmatter
`description:` field ONLY — no body edits), `skills/tool-bootstrapping/SKILL.md` (the shipped
twin, same field-only rule), `docs/superpowers/specs/2026-08-06-skill-trigger-inventory.md`
(new, P-I7), `tests/install-sh/*` (snapshot regen only, and only if one of the five shipped
skills was touched).

**Host (NOT committed):** `~/.claude/skills/*/SKILL.md`, `~/.claude/settings.json`,
`~/.claude/hooks/post-api-push-autosync.sh`, `~/.claude/plugins/**` (P-I8 deletions),
per-worktree `.claude/settings.local.json` (gitignored).

**Explicitly NOT permitted:** `.claude/rules/*`, `CLAUDE.md`, `AGENTS.md`,
`packages/core/principles/*`, `scripts/render-rule-index.mjs`, `scripts/probe-channels.sh`,
`.ai-factory/rule-channel-degradations.json` — that is S-G's set
(`../arch-v2-context-pipeline-s-g/kickoff.md:117-131`); a body edit to any `SKILL.md`;
`.claude/settings.json` (committed).

**Worktree isolation.** First step before any edit: `bash scripts/create-worktree.sh s-i` — this
stage is dispatched alongside others ([parallel-subwave-isolation.md §1](../../rules/parallel-subwave-isolation.md)).
If worktree creation fails, STOP and report; never proceed in a shared working directory.

**PR obligations (umbrella §0):** the PR body carries the §1.7 forward+backward self-check and a
`Prior-art:` trailer. This stage adds no dependency and no `packages/` module, so the correct form
is the escape hatch — e.g. `Prior-art: skipped — description trims + host config maintenance, no
new capability`.

## §2.5 Environment (destination-environment-verification)

HOST stage. Requires: writable `~/.claude` (settings, skills, hooks, plugins), a repo worktree
on a fresh branch off staging for P-I1/P-I7, `gh` authenticated, ability to launch a probe
`claude -p` session (P-I5), and a live re-measure channel (`/context` in an interactive
session, or the doctor's disk-side estimator re-run) for the before/after. NOT dispatchable
via aif marker — the container has none of these surfaces (same rationale as S-H, spec §1.6
FORK C).

## §3 Acceptance

1. Deterministic: project description total **≤ 6,800 B** and user description total
   **≤ 3,200 B**, both measured with the §0 description-only extractor (NOT the rev-4 awk), and
   no single description > 800 B — all four assertions are in the §3.5 contract, outputs quoted
   in the PR body; trigger-inventory diff clean (P-I7 file committed). Any escape-token use is
   named in the PR body per §P-I1, ≤ 2 skills total across P-I1 + P-I2.
2. Deterministic: `post-api-push-autosync.test.sh` green, unmodified (**now in the §3.5
   contract** — rev 4 declared this criterion «Deterministic» while leaving it out of the
   contract, so nothing ran it); one live fired call measured < 500 ms wall (time the hook body
   with the network detached) — that timing is report-graded, since a wall-clock measurement is
   not reproducible as a gate.
3. Report-graded: P-I5 verdict with the before/after `grep -c` pair quoted; P-I3 census output
   from both §P-I3 commands; P-I4/P-I8 before/after excerpts.
4. Re-measure: skill-listing estimate re-run after P-I1/P-I2/P-I4 (+P-I5 if it lands);
   expected recovery ≥ 1.5k est. tokens (project ~1.4k + user share); record actual vs
   expected — a shortfall is a finding, not a silent pass (T14).
5. Baseline honesty: the §0 numbers are pre-S-G. Re-measure both totals against post-S-G `HEAD`
   at stage start and record them; if either baseline moved by > 10%, re-derive the targets in
   the PR body instead of silently passing the absolute ones (`#budget-sized-to-the-wrong-machine`
   applies to a moved baseline exactly as it does to a moved machine).

## §3.5 Host-verify contract

The extractor below is the binding one (description-only). `EXTRACT` is repeated inline per
command because each line runs as its own shell — the runner does not carry variables between
lines.

```bash host-verify
test "$(for f in .claude/skills/*/SKILL.md; do awk '/^description:/{d=1;print;next} d&&/^[A-Za-z_-]+:/{exit} d&&/^---$/{exit} d{print}' "$f"; done | wc -c | tr -d ' ')" -le 6800
test "$(for f in "$HOME"/.claude/skills/*/SKILL.md; do awk '/^description:/{d=1;print;next} d&&/^[A-Za-z_-]+:/{exit} d&&/^---$/{exit} d{print}' "$f"; done | wc -c | tr -d ' ')" -le 3200
test "$(for f in .claude/skills/*/SKILL.md "$HOME"/.claude/skills/*/SKILL.md; do awk '/^description:/{d=1;print;next} d&&/^[A-Za-z_-]+:/{exit} d&&/^---$/{exit} d{print}' "$f" | wc -c; done | sort -rn | head -1 | tr -d ' ')" -le 800
test -s docs/superpowers/specs/2026-08-06-skill-trigger-inventory.md
bash "$HOME"/.claude/hooks/post-api-push-autosync.test.sh
```

**Why these five and not fewer.** The first three are the gate the stage exists to satisfy, split
so a failure names its population instead of one opaque total. The fourth uses `-s` (non-empty),
not `-f`: an empty inventory file would satisfy `-f` while proving nothing — the rev-4 form was
exactly that. The fifth turns acceptance item 2 from prose into an exit code.

## §4 AI traps (per `.claude/rules/ai-laziness-traps.md` §3)

See [.claude/rules/ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md).
Active traps for this R-phase: T1, T3, T5, T14, T15, T17, T19, T20.
Instantiation: T1/T3 — every byte number re-measured at execution, not carried from this
kickoff; T5 — host stage editing repo files: keep P-I1/P-I7 in the PR, everything else
host-only, no drive-by repo edits; T14 — a clean trigger-diff on a shallow inventory is
«coverage insufficient», not «clean»; T15 — this kickoff's own description-trim discipline
applies to any skill the stage itself touches; T17 — P-I8 tar-before-rm, P-I1 trims are
git-reversible; T19 — own cold re-read of the trimmed descriptions before handoff;
T20 — P-I5 verdict only with probe output quoted.

Domain-specific:
- **T-SI-A** — trimming descriptions by byte count while destroying trigger vocabulary: the
  byte target passes, routing silently dies. Counter: P-I7 inventory diff is the acceptance
  instrument; byte total alone proves nothing.
- **T-SI-B** — assuming plugin-namespaced skills obey `skillOverrides` because user skills do
  (`#pattern-matching-on-name` on a config key). Counter: P-I5 is an empirical probe with
  quoted listing output; no verdict without it.

## §5 Descopes (recorded, per plan-completeness)

- Merging/consolidating sibling skills (e.g. rule-research + rule-tests) — product-surface
  change requiring its own /arch + BFR pass; NOT this stage.
- App-bundled plugin listing weight beyond the P-I5 probe — upstream surface.
- Any `.claude/settings.json` (committed) edit — none needed; P-I3 only touches the local file.
- Umbrella-wide re-baseline of S-E's budget gate — S-E owns its meter; S-I only reports its
  own before/after.
