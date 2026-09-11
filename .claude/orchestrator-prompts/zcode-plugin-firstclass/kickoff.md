# KICKOFF — zcode-plugin-firstclass (RESEARCH-FIRST, ZCode-first, multi-stage)

<!-- scope:zcode-plugin-firstclass -->
<!-- Operator directive 2026-09-11 (verbatim, load-bearing):
     «нужно для z.code тоже плагин сделать для нашего приложения как и в клод коде
       отправь в аиф диспетч обдумать и реализовать это»
       → goal: the getff plugin becomes a FIRST-CLASS consumer product on ZCode — the same
         one-liner consumer install-path quality CC has today (README.md:139-142), not a
         second codebase. «обдумать и реализовать» → Stage 0/1 (think) precede Stage 2 (fix).
       → execution through the aif dispatcher (/dispatcher zcode-plugin-firstclass). -->

> **Authoritative for:** this umbrella's goal, stage plan, acceptance criteria, and process constraints.
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists).
> ZCode-parity background — [`.claude/rules/zcode-parity-doctrine.md`](../../../.claude/rules/zcode-parity-doctrine.md) (hook census §2, per-row gaps §4).
> Skills-population background — sibling umbrella `plugin-skills-generator` (in flight at authoring time).
> **Base branch:** `staging`. **Rigor label (L0):** `build-and-verify` — Stage 2 artefacts are reversible docs/payload twins; Stage 3 verifies them live on the destination harness (ZCode, HOST-side).

## §0 Why this umbrella exists

CC consumers get a documented one-liner ([README.md:139-142](../../../README.md)): `/plugin marketplace
add artyhoo/getff` + install. ZCode consumers get NOTHING consumer-grade:

1. **The only known ZCode install is a machine-local dev snapshot.** `~/.zcode/cli/plugins/known_marketplaces.json`
   carries marketplace id `getff` with `"source": "directory", "path": "/Users/art/code/rules-as-tests-aif"`
   (its own description: «local working-tree snapshot», added 2026-07-17); `installed_plugins.json`
   records `getff@getff` 0.2.0 from `"./plugin"` (HOST evidence, quoted 2026-09-11). A consumer
   cannot reproduce this path — it names one machine's working tree.
2. **The GitHub consumer path is mechanistically supported but UNVERIFIED and UNDOCUMENTED for ZCode.**
   ZCode's bundled authority (zcode-plugins-official/zcode-guide 0.1.0, `diagnosing-plugins` SKILL.md
   §2-§3, quoted 2026-09-11): the Discover-tab `+` accepts «a GitHub repository, a Git URL, a local
   directory, or a file»; `marketplace.json` `plugins[].source` kinds are directory/github/git/url/
   git-subdir (npm/pip NOT supported); plugin identity is `<name>@<marketplace>`. Nothing in this repo
   or README says whether `/plugin marketplace add artyhoo/getff` (or the ZCode `+` equivalent) works
   for a ZCode consumer — no one has ever run it.
3. **The manifest rides the fallback slot.** ZCode probes `.zcode-plugin/plugin.json` (preferred) →
   `.claude-plugin/plugin.json` → `.codex-plugin/` (same zcode-guide §1). We ship only
   `plugin/.claude-plugin/plugin.json` — the fallback demonstrably works (the dev snapshot installs
   and its skills load live), but the preferred slot is unused and no decision records why that is OK.
4. **Payload gaps on the ZCode-reachable channel.** Doctrine §4 row 3: `check-doc-authority-header`
   is the one retained `plugin-gap` («a Stage 6 follow-up would ship the missing twin» — not shipped:
   `ls plugin/hooks/ | grep -x check-doc-authority-header` → empty). README's Compatibility block
   documents no ZCode install path, and its Wave B line («implementation-pending») contradicts
   doctrine §3 (Stages 5/6/7B/9C merged via #1043/#1044/#1046/#1047) — staleness suspect, not yet proven.
5. **Component reachability is partially proven, partially unknown.** Live ZCode session evidence
   (HOST, 2026-09-11): plugin skills load from the cache (`getff:getff`, `getff:installing-enforcement`,
   `getff:using-getff` in a live session's skill list) — convention discovery works without explicit
   `skills` arrays in `plugin.json`. Commands (`plugin/commands/install-enforcement.md`) reachability
   on ZCode: UNVERIFIED. Agents (3 in `plugin/agents/`): zcode-guide §2 records `agents` as
   «recorded but not executed» — a known harness limitation to disposition, not a defect to fix.

The sibling umbrella `plugin-skills-generator` (aif task `4662901c`, `implementing` at authoring
time) is ALREADY regenerating `plugin/skills/` + bumping `plugin.json`/`marketplace.json` versions +
updating `M1_SET`. This umbrella touches NONE of those surfaces — it owns the channel around them:
consumer path, manifest-slot decision, row-3 twin, docs, live acceptance.

## §1 Goals

1. A VERIFIED, DOCUMENTED ZCode consumer install path: marketplace add from GitHub → install →
   skills/commands load → version refresh picked up. Documented in README next to the CC one-liner.
2. Remaining channel gaps closed or explicitly dispositioned: doctrine row-3 twin (via the twin
   generator, never hand-copy), README Compatibility sync (incl. the stale Wave B line if Stage 0
   confirms it), agents-channel «recorded but not executed» note.
3. ZCode-first live acceptance on the HOST (Stage 3, merge-blocking); CC non-regression documented
   and DEFERRED to the owner (Stage 4) — standing operator posture 2026-09-11.
4. Zero overlap with `plugin-skills-generator`: no `plugin/skills/` work, no version bumps, no
   `M1_SET` edits inside THIS umbrella (hard gate, Stage 2).

## §2 Stages (sequential; Stage 0 is a mandatory gate before any fix code)

| Stage | Scope (one line) | Depends on |
|---|---|---|
| 0 | R-phase re-verification: probes 0.1-0.8, dated research-patch, forks surfaced | — |
| 1 | Decision pack: forks A-D recorded with recommendations (research doc only) | 0 |
| 2 | Implementation per decisions: README ZCode consumer path + row-3 twin + compatibility sync. HARD CROSS-UMBRELLA GATE: `plugin-skills-generator` MERGED (done.md on staging) — else park `blocked_external` | 1 |
| 3 | ZCode-first live consumer acceptance on the HOST (install + listing + refresh); merge-blocking | 2 |
| 4 | CC non-regression requirements documented (external, owner-scheduled; NOT executor work) | — |

### Stage 0 — R-phase re-verification (MANDATORY — re-derive every load-bearing claim; do NOT trust this kickoff's cached outputs)

**Probe split (honesty rule):** REPO probes run in the aif container against `origin/staging`. HOST
probes (marked `HOST:`) touch the live ZCode client / `~/.zcode` — the container has NO ZCode; a
worker that cannot run one does not skip or simulate it: it records the request, and the dispatcher
loop supplies the HOST outputs into the task comment. This kickoff's HOST facts are dated quotes
(2026-09-11) — Stage 0 re-derives the REPO side and flags any HOST fact load-bearing enough to need
a fresh run before a decision depends on it.

| # | Claim to re-derive | Probe | If falsified |
|---|---|---|---|
| 0.1 | Manifest slot: only `plugin/.claude-plugin/plugin.json` exists; `.zcode-plugin/` absent everywhere | REPO: `git ls-tree -r origin/staging --name-only \| grep -E 'zcode-plugin\|claude-plugin'` | a `.zcode-plugin/` manifest already exists → Fork A is decided, fold in |
| 0.2 | README documents the CC one-liner and NO ZCode consumer path | REPO: `grep -n "marketplace add" README.md`; `grep -n -i zcode README.md` | a ZCode path already documented → verify its accuracy, scope shrinks |
| 0.3 | Doctrine row-3 twin still absent; Wave B merged (README «implementation-pending» line stale) | REPO: `git ls-tree origin/staging plugin/hooks/` (no `check-doc-authority-header`); `git log origin/staging --oneline --grep=zcode` shows #1043/#1044/#1046/#1047 | twin already shipped → drop Fork C item, sync doctrine row instead |
| 0.4 | Twin generator contract covers a new hook twin (row-3) mechanically | REPO: `sed -n '1,75p' scripts/generate-plugin-twins.sh` + its spec `.ai-factory/plans/zcode-parity-s6-twin-generator.md` (if tracked; else header comment is the contract) | generator can't emit it → hand-copy with `@plugin-transform` markers + gate note, surface fork |
| 0.5 | Installer has zero `.zcode` awareness (plugin channel is the only ZCode reach) | REPO: `grep -rn "\.zcode" setup.d/ install.sh` → empty | installer learned `.zcode` → §0 premise 2 weakened, revisit Fork B |
| 0.6 | plugin.json declares no explicit commands/skills/hooks arrays (convention discovery) | REPO: `git show origin/staging:plugin/.claude-plugin/plugin.json` | explicit arrays present → commands reachability probe changes shape |
| 0.7 | HOST: ZCode plugin subsystem facts (manifest probe order; `+` accepts GitHub repo; source kinds; agents «recorded but not executed»; pitfall-9 version/update detection) | HOST: read `~/.zcode/cli/plugins/cache/zcode-plugins-official/zcode-guide/*/skills/diagnosing-plugins/SKILL.md` | quoted facts stale → re-quote with the new path/date before Fork A/B use them |
| 0.8 | HOST: current registration still the local-directory dev snapshot (marketplace id `getff`, path `/Users/art/code/rules-as-tests-aif`) | HOST: `cat ~/.zcode/cli/plugins/known_marketplaces.json` | registration changed → §0 premise 1 rewritten with fresh evidence |

Deliverable: dated research-patch (`docs/meta-factory/research-patches/2026-09-XX-zcode-plugin-firstclass-s0.md`)
with the verdict matrix, both §1.7 sections, and forks surfaced as DECISION-NEEDED with
recommendations. STOP at forks — surface, do not decide (operator call unless the kickoff §7 already
settled it).

### Stage 1 — Decision pack (research doc; no shared-file edits)

Record each fork with evidence, recommendation, and falsifier (H1 discipline):

- **Fork A — manifest slot:** stay single-source on `.claude-plugin/plugin.json` (RECOMMENDED — the
  fallback is first-class supported and the dev install proves it works; a `.zcode-plugin/` twin is
  a dual-implementation surface needing generator + gate for zero demonstrated gain) vs add the twin.
  Decide from 0.1/0.7; flip only on live evidence the fallback degrades.
- **Fork B — publication channel:** (a) verify + document GitHub marketplace `artyhoo/getff` as the
  ZCode consumer path (RECOMMENDED — zero new infrastructure; the same repo already serves CC);
  (b) submission to `zcode-plugins-official` (CDN marketplace — exists, 26 plugins, HOST fact
  2026-09-11) — owner decision, document the ask only; (c) both, sequenced (a) then (b).
- **Fork C — row-3 twin:** ship `check-doc-authority-header` into `plugin/hooks/` via the twin
  generator (RECOMMENDED — closes doctrine §4 row 3, its own text anticipates the follow-up). After
  landing, sync doctrine §2/§4 row-3 classification and re-run the renderer census if it counts rows.
- **Fork D — README shape:** new «ZCode» install block beside the CC one-liner + Compatibility sync;
  includes the stale Wave B line fix if 0.3 confirms staleness (cite doctrine §3, not prose memory).

### Stage 2 — Implementation (HARD GATE: `plugin-skills-generator` MERGED)

Before ANY edit: `git ls-tree origin/staging .claude/orchestrator-prompts/plugin-skills-generator/done.md`
must exist (or its implementation PR be merged — `gh pr list --search "is:merged plugin-skills-generator"`).
If absent → PARK `blocked_external: waiting plugin-skills-generator` (the dispatcher resolves via
`answer.ts --decision retry` once the sibling merges). NEVER edit `plugin/skills/`, `plugin.json`,
`marketplace.json`, or `M1_SET` in parallel with the sibling — those files belong to it.

Work per Stage 1 decisions: row-3 twin (Fork C GO) + doctrine row sync; README ZCode consumer path +
Compatibility sync (Fork D); manifest twin only if Fork A flipped. Gates: `make self-audit`;
`bash scripts/check-skill-drift.sh` (population unchanged — must stay green);
`bash scripts/build-getff-dist.sh` IF anything it tracks changed; PR body Fidelity + §1.7
(`FIDELITY: skipped — <rationale>` for operator-direct work; exact headings
`### §1.7 Forward-check applied` / `### §1.7 Backward-check applied`; file:line citations).

### Stage 3 — ZCode-FIRST live consumer acceptance (merge-blocking; HOST-side)

The aif container has no ZCode client: the worker PREPARES the evidence checklist + exact commands;
the HOST (dispatcher loop / operator) runs them and posts outputs to the PR. Acceptance:

1. Fresh consumer-sim on HOST: add the GitHub marketplace (distinct id from the dev snapshot —
   never destroy the dev registration), install `getff@<new-id>`, plugin listed enabled.
2. Component listing: skills present in a live session; `/install-enforcement` command resolves if
   0.6/0.7 say commands are reachable (else record the disposition).
3. Version refresh: with the sibling's bumped version on staging, the marketplace update path picks
   the new version (zcode-guide pitfall 9 — confirm record AND manifest carry the source revision).
4. `bash scripts/probe-zcode-runtime.sh` → 17/17 (unchanged oracle).
5. Evidence (commands + outputs) in the Stage PR body.

### Stage 4 — CC non-regression requirements (DEFERRED; owner-scheduled; NOT executor work)

Documented so the owner can dispatch later: (1) CC `/plugin marketplace add artyhoo/getff` + install
still works after the row-3 twin and README changes; (2) no shadowing between plugin `getff:<name>`
skills and installer-copied `.claude/skills/<name>` on the same consumer; (3) CC marketplace cache
picks the sibling's bumped version.

## §3 Dependencies

Stage 0 → 1 → 2 → 3 strictly sequential; Stage 4 is external (owner). Stage 2 hard-gated on the
CROSS-UMBRELLA merge of `plugin-skills-generator` (the frontier table cannot express cross-umbrella
edges — this section is the binding statement; the Stage 2 gate check is mechanical: done.md on
staging). No fix code before the Stage 0 research-patch is merged.

## §4 Acceptance criteria (umbrella done when)

- [ ] Stage 0 research-patch merged (verdict matrix + forks surfaced or resolved).
- [ ] Stage 1 decision pack merged (forks A-D recorded with recommendations/falsifiers).
- [ ] Stage 2 merged: README carries a VERIFIED ZCode consumer path; row-3 twin landed via generator
      (or fork recorded why not); doctrine row-3 synced; zero edits to sibling-owned surfaces.
- [ ] Stage 3 HOST evidence recorded (install + listing + refresh + probe 17/17).
- [ ] CC requirements documented (§2 Stage 4) and handed to the owner.
- [ ] Every PR carries Fidelity + §1.7 with file:line; `make self-audit` green.

## §5 ATTN escalation triggers (surface as DECISION-NEEDED, never decide silently)

Any Fork A-D whose Stage 0/3 evidence contradicts the recommendation; a live ZCode surprise
(component discovery differs from the dev-snapshot evidence; commands unreachable; refresh path
differs from pitfall-9); the sibling umbrella extending its scope into channel/docs surfaces; a
zcode-plugins-official submission opportunity that requires owner credentials/decision.

T-traps active ([ai-laziness-traps.md §2](../../../.claude/rules/ai-laziness-traps.md)):
T3 (every §0 claim carries its probe — no prose-only findings), T9/T10 (full population: ALL
component classes — skills/commands/agents/hooks — dispositioned in Stage 3, never sampled),
T16 (reachability is PROBED live, not pattern-matched from the dev-snapshot evidence), T20 (evidence
before verdict — Stage 0 precedes decisions), T5-class (HOST probes never simulated in-container).

## §6 Non-goals

- No `plugin/skills/` population work, version bumps, or `M1_SET` edits — sibling umbrella owns them.
- No zcode-plugins-official submission EXECUTION (owner decision + credentials; document the ask).
- No agents-channel enablement on ZCode (harness records-not-executes `agents` — disposition note only).
- No row-22 `inject-handoff-on-compact` twin — deliberately absent per doctrine §4 (D20); do not «fix».
- No installer changes; no new runtime hooks; no CC fix pass (Stage 4 is documentation only).

## §7 Operator decisions already made (do not re-litigate)

- ZCode-first; CC deferred but documented (standing 2026-09-11 posture).
- «как и в клод коде» = consumer install-path parity on the SAME plugin/codebase, not a second product.
- Design-first execution («обдумать и реализовать») — Stage 0/1 precede Stage 2.
- Execution via the aif dispatcher (2026-09-11).
- Skills generation + version bump + CORE four shipping belong to `plugin-skills-generator`.

## §8 Host verification

```bash host-verify
# One-shot minimum a host can run before dispatch (Stage 0 re-runs the full set):
grep -n "marketplace add" README.md                                  # → CC-only consumer path today (§0.2)
git ls-tree origin/staging plugin/.zcode-plugin                      # → absent: ZCode-preferred slot unused (0.1)
git ls-tree origin/staging plugin/hooks/ | grep check-doc-authority-header   # → empty: row-3 plugin-gap (0.3)
grep -n "implementation-pending" README.md                           # → staleness suspect vs doctrine §3 (0.3)
cat ~/.zcode/cli/plugins/known_marketplaces.json                     # → getff = local directory dev snapshot (0.8)
bash scripts/probe-zcode-runtime.sh                                  # → 17/17: ZCode runtime oracle (Stage 3)
```
