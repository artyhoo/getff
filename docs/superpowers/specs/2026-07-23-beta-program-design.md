# Beta program — delivery & usage convenience for human and AI (design)

> **Status:** DRAFT r1 — /arch phase-1 output, pre cold two-altitude review (2026-07-23).
> **Date:** 2026-07-23
> **Authoritative for:** the beta-program design — north star (§1), binding operator
> decisions D1-D9 (§2), program done-criterion (§3), umbrella A/B/C designs (§4-§6),
> release frame (§7), integration contract with parallel tracks (§8), umbrella
> decomposition + tier routing (§9), non-goals (§10), open forks (§11), risks (§12).
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists).
> Killer-feature reachability program — `2026-07-23-getff-any-stack-closure-design.md`
> (track 1; PENDING merge from branch `claude/getff-idea-status-d8b805` — plain-path
> reference until it lands; this spec composes with it, never rewrites it). Acceptance
> contour — `2026-07-23-acceptance-contour-design.md` (PENDING merge from branch
> `claude/multi-model-pipeline-arch-ef674f`; §8 treats its D1-D9 as a neighbor contract).
> Adapter-factory conformance — [2026-07-22-adapter-jig-design.md](2026-07-22-adapter-jig-design.md).
> Tier criteria SSOT — [CLAUDE.md «Task-tier routing»](../../../CLAUDE.md) (A3 re-homes the
> shipped rendering; CLAUDE.md stays the operator-repo SSOT until that stage lands).

## §1 Context + north star

The product has two layers. The **killer layer** (stack-aware rule+test generation from
live docs) is being finished by track 1 (any-stack closure W1-W6 + adapter-jig J3/go).
The **environment layer** (multi-model pipeline: /arch design → aif factory with a cheap
executor → tier routing → night-mode → acceptance) exists as repo artifacts + operator
config, and reproducing it costs days of manual pain (GLM onboarding precedent). This
program packages the environment into a product and prepares the public beta.

**North star — four measures, every design decision is judged against all four:**

1. **Time-to-working + questions-to-human** at install (GLM benchmark: days+manual → minutes+one API key).
2. **Zero forgettability** in daily use: at any moment there is ONE obvious next command and the system proposes it (the origin session asked «how does this launch?» three times and switched models six times — that class of question must disappear).
3. **AI performs the setup** («the second AI is connected by an AI»): smart defaults, humans asked only for the non-derivable (keys, subscriptions).
4. **AI DX** (operator directive 2026-07-23): every artifact must be cheap and reliable for an AI to install / use / maintain — including technology choices (model-corpus familiarity), config shapes (declarative files over interactive wizards), and the development of this repo itself. AI DX is also the public positioning term (§5, README/landing tagline; README §Why edits are maintainer-owned per the Artifact Ownership Contract).

## §2 Binding operator decisions (2026-07-23, this session)

Recorded per /arch §1 with falsifiers. Future sessions must not silently reopen these.

- **D1 — Absorb the getff-to-prod tail.** This program supersedes U8/U10/U11/U12 of
  [getff-to-prod-meta-launch](../../../.claude/orchestrator-prompts/getff-to-prod-meta-launch/kickoff.md):
  U8 (honest README) → umbrella B; U10+U11 (npm publish + name freeze) → release phase 2
  mechanics prepared in umbrella A stage R1; U12 (public launch) → release phase 3.
  U9 (repo split) is deferred post-announce per the operator's plan-v2 F1 hybrid-lite
  verdict (single-package publish from the monorepo; S6→U10 handoff checklist is the
  binding input). The meta-launch kickoff is amended in the same PR that lands this spec's
  kickoffs — two contradictory dispatch inputs must not coexist on staging.
  *Falsifier: single-package publish from the monorepo hits an unresolvable blocker
  (e.g. meta-factory shims in exports) → a U9-lite subset returns into phase 2.*
- **D2 — Publish only what is ready.** The beta goes public only after (a) track 1
  finishes the hard part (any-stack trace + honest signals; adapter-jig J3 adds the go
  family), (b) the acceptance contour is implemented, and (c) the operator has
  self-tested the assembled product on real projects (§7 phase 1 BEFORE publication).
  This deliberately reorders the original kickoff (publish → self-test → testers) into
  (self-test → publish → testers). *Falsifier: operator explicitly reprioritizes toward
  an earlier public signal.*
- **D3 — Parallel-then-assemble (Lego).** Each parallel track keeps its own paradigm;
  integration happens through explicit contracts (§8) + a final assembly stage, never by
  reaching into a neighbor's surfaces mid-flight. Shared-file collisions are prevented by
  the §8 ordering rules + the pre-dispatch in-flight probe (CLAUDE.md operational
  conventions). *Falsifier: an integration need emerges that contracts cannot express →
  surface to operator as a fork, do not silently couple.*
- **D4 — AI DX is a cross-cutting criterion and the positioning term** (§1 measure 4).
  Candidate taglines for umbrella B (final wording chosen there):
  «AI DX for your codebase: conventions any AI agent can't bypass and any AI agent can
  navigate»; «AI DX on both sides of the keyboard». Claims stay inside the operator's F5
  honest-claim formulas. *Falsifier: the term reads as noise to beta testers → keep the
  mechanics, drop the label.*
- **D5 — Docs stack: Fumadocs on Next.js, full site migration, static export.**
  getff.ai moves to one Next.js app: Fumadocs UI for /docs, custom Tailwind v4 + shadcn
  landing pages, blog+RSS on fumadocs-mdx, static export to GitHub Pages ($0, custom
  domain kept). Evidence (three-agent consult, 2026-07-23): adoption census — Fumadocs is
  the 2026 default for Next-native top tools (shadcn/ui itself, Zod, Turborepo,
  Better Auth; migration flows run Nextra→Fumadocs, Docusaurus bleeding); deep-dive —
  static export fully works (Orama search pre-rendered, llms.txt / llms-full.txt /
  per-page .md as static routes; verified via DeepWiki-grounded repo answer); community —
  «fumadocs is shadcn but for docs», complaints (upstream docs gaps, setup friction,
  small plugin ecosystem, bus-factor=1) are absorbable under AI-agent maintenance.
  Mintlify REJECTED despite Anthropic/Cursor precedent: hosting is Mintlify-only
  (self-host = enterprise), pricing in flux, subpath impossible without a proxy —
  off-brand for a self-owned «truth that can't be faked» product; its hosted-MCP
  advantage is partially covered by static llms routes + context7 (C4), and a docs MCP
  server remains a separate later decision. Starlight (incumbent) demoted: no MCP /
  copy-for-LLM / AI-chat out of the box, not the React world the operator builds in,
  weaker AI DX (thinner model corpus). *Falsifiers: (1) the mandatory B prototype (static
  smoke on GH Pages: search + llms.txt + domain) fails → revert to Starlight (old site
  stays in git); (2) Fumadocs upstream stalls 6+ months → content is plain MDX, migrate;
  (3) hosted MCP becomes must-have during beta → separate add-on decision.*
- **D6 — Entry points: `npx getff@latest init` (JS world) + `curl -fsSL getff.ai/install | sh`
  (universal; rustup/uv/bun pattern).** npx is NOT the standard outside JS (Python → uvx/pipx,
  Rust → cargo, Go → go install); the universal shell entry covers them; native
  per-ecosystem wrappers are a later add. The generation CLI's Node dependency is track-1's
  open fork F-A (bundle vs declare) — both entry designs must survive either outcome.
  *Falsifier: F-A resolves in a way that breaks an entry assumption → the entry stage
  re-plans against the resolved form.*
- **D7 — Self-generating docs on BOTH sides.** Reference documentation is generated from
  sources (Zod schemas, JSDoc/TSDoc, registries, probe results) with CI drift gates; prose
  is reserved for judgments and guides. Applies to the consumer payload AND to this repo's
  own docs (operator directive; live evidence of the gap: zcode-parity-doctrine §3 still
  says «impl pending Wave B» while Wave B merged as #1043-#1047; README vs INSTALL-FOR-AI
  contradict on Cursor; INSTALL-FOR-AI agent lists drifted). Mechanism: the existing
  `<!-- getff:begin section=... -->` generated-section pattern + regen checks
  (render-rule-index.mjs precedent). *Falsifier: a doc class proves non-derivable →
  it stays prose with an owner and a review trigger, recorded per class.*
- **D8 — Memory & context hygiene.** The framework must not write to a consumer AI's
  memory and must not bloat always-on context: thin standing layer (AGENTS.md + moment-
  scoped hook hints), everything else on-demand (the repo's hot/cold ai-doc standard).
  Garbage in memory is an anti-goal on par with lying docs. *Falsifier: a consumer
  capability genuinely requires persistent memory → explicit opt-in design, never default.*
- **D9 — Primary user: the operator first; testers and consumers equally important,
  verified after.** The honesty test stands: the author installs with the SAME installer
  (second machine, new project); if manual is easier, the design failed. External
  happy-path (link → working pipeline ≤20 min, plan-v2 §6) is phase-3 acceptance.

## §3 Program done-criterion (executable test question)

> On a fresh machine, the operator (phase 1) and later an invited tester (phase 3) go
> from one entry command to: chosen install depth working; if `factory` depth — GLM
> executor connected with exactly ONE human-entered credential; a first task driven
> through /arch → chosen launch preset → acceptance, with «where am I / what's next»
> answered by one status command at every step; any AI harness opened on the project
> orients itself from shipped artifacts alone (AGENTS.md layer) without exceeding its
> context budget; and every capability claim shown to either audience is either
> mechanically verified (probes, generated sections) or explicitly labeled experimental.

Enforcement split: deterministic where scriptable (install smoke cells, agnosticism
probes, drift gates), named cold-run protocols where semantic (fresh-session install
rehearsal; the one-beat pattern established by track-1 §9.3 is the precedent).

## §4 Umbrella A — delivery + daily-use UX

- **A1 — Install depth profiles.** Three named profiles over the existing flag machinery
  (`install.sh:97-118`, `setup.d/10-skills.sh:62-100`): `core` (default; today's
  default+full killer payload), `env` (+ /arch, tier-home doc, pipeline presets, status,
  night-mode/SDD — no aif runtime), `factory` (+ dispatcher/harvest/aif-doctor,
  runtime-bridge wiring, GLM one-button). ADOPT rustup profile vocabulary (one-line
  consequence description per profile at the prompt — the Drupal #892348 lesson);
  upgrade = re-run with a deeper profile (our stateless `--refresh` regen semantics, not
  rustup's additive components). Selection: `--profile` flag (agents/CI) + TTY menu
  (humans) + AI-dialog smart default in INSTALL-FOR-AI. Extends the operator's F7
  (consumer/operator) to three steps. *Falsifier: the middle step finds no users through
  phases 1-3 → collapse to two.*
- **A2 — GLM one-button.** ADAPT the aider onboarding pattern: detect missing executor
  profile → one explanation (z.ai subscription, $18/mo Coding Plan) → human pastes ONE
  key (into an untracked env location; the installer never handles the key value) →
  automation does the rest: create the aif runtime profile (REST CRUD confirmed:
  `~/code/aif-handoff/packages/api/src/routes/runtimeProfiles.ts` — Hono router,
  `createRuntimeProfileSchema`; checkout dated 2026-05-26 → exact field shapes are
  **designed-not-proven**, verify at implementation), set per-mode defaults (Plan→top,
  Task/Review→executor), run a validation ping, ship the glm-handoff skill. Executor of
  the flow: an AI session driven by an INSTALL-FOR-AI step + a bash helper; no GUI/wizard
  (BFR cost gate). REFERENCE claude-code-router + LiteLLM as mapping-layer precedents —
  we do not rebuild routing.
- **A3 — Tier-criteria home + degradation matrix.** A shipped, AI-agnostic doc (payload
  home chosen at stage planning: `.ai-factory/` doc or skill-context) carrying the Tier
  0/1/2 criteria and the explicit degradation table: no aif → in-session SDD; no GLM
  subscription → tiers slide (night-mode posture SSOT); no Fable → Opus tops; non-CC
  harness → per-artifact degradations (validated by C3). Operator-repo CLAUDE.md
  «Task-tier routing» becomes a pointer to the shipped SSOT. Sequencing: AFTER the
  acceptance-contour D1 amendment lands in CLAUDE.md (§8 contract).
- **A4 — /pipeline launch presets.** Four declarative presets — `aif`, `night`,
  `economy` (whole line on executor tier: bridge-profile marker + cheap reviewer), `sdd`
  (in-session) — defined in pipeline `references/` (data, not prose), surfaced by a list
  verb, activated by `--preset <name>` (flag/env first per clig.dev), PROPOSED via a TTY
  menu row in the §3 launch-table (the `gh workflow run` precedent). Embeds at the three
  existing seams: `--mode-*` override parser, §2.5 routing predicates, the kickoff
  bridge-profile marker. Menu-only UX REJECTED (breaks agents/CI).
- **A5 — Status one-command.** `/pipeline status` (extension of the no-arg overview):
  read-only, sectioned — in-factory (bridge REST) / parked questions (`questions.ts`) /
  ready-to-harvest + PR state (`gh pr list`) — ending with suggested-next-command lines
  (git-status shape; clig.dev «suggest what to run next»). Consult found NO established
  status convention in agent frameworks — BUILD-thin over ADOPTed shape. NOT a dashboard.
- **A6 — R1: npm release mechanics (absorbed U10+U11).** Name freeze (@getff family, bin
  `getff`), `files` allowlist validated by a real tarball matrix cell, bin runnability
  decision (.ts bins: tsx dependency vs prebuild — decided in-stage), package README/
  LICENSE/metadata, release notes via the existing release-drafter. `npm publish` itself
  stays an operator act in phase 2. Binding input:
  [s6-u10-handoff.md](../../../.claude/orchestrator-prompts/launch-preannounce-track/s6-u10-handoff.md)
  (549-file over-ship, unpublish-is-not-rollback, publish-under-@getff-only).
- **A7 — Foreign-project dispatch (beta form).** The `factory` profile vendors the
  runtime-bridge subset (CLI entrypoints + dispatch hook, env-parameterized) into the
  consumer repo — the layout the hook already assumes; dedup-log path becomes
  per-project. npm packaging of the bridge is deferred with U9. *Falsifier: first foreign
  tester blocked by vendoring → raise bridge packaging priority.*
- **A8 — Ship the contour skills.** Wiring-only additions of `/arch` and
  `claude-glm-executor-handoff` to the shipped sets in `setup.d/10-skills.sh` (env/factory
  profiles). Content of `/arch` is NOT edited here — three parallel sessions touch it
  (§8); the shipping stage rebases on whatever staging holds.

## §5 Umbrella B — human docs + showcase

Executed via its own /arch run (prompt authored by this session) because content/IA needs
its own design pass. Pre-seeded verdicts: D5 stack decision (with the mandatory
**prototype stage**: static export smoke on GH Pages — Pagefind→Orama search, llms.txt,
custom domain — before content migration); D4 positioning (AI DX tagline family); two-layer
content structure (killer = beta, environment = experimental, per-layer how-to-use of the
daily cycle); a **simple Getting Started / First Steps guide** (operator requirement
2026-07-23): install → first rule fires → first task through the pipeline, a 5-minute
read per depth profile, mirrored 1:1 by the C1 AI Usage Guide First-Steps path (one
source of truth, two renders); python quickstart (site covers only TS+Rust today); beta-program page +
feedback channel (GitHub issues templates); claims constrained by the operator's F5
formulas (matrix-proven wording; no cargo-deny present tense; «your AGENTS.md — milestone»
until true). README changes route through maintainer handoff (Artifact Ownership).
Current-site facts (recon): getff.ai = Astro 7 + Starlight 0.41, GH Pages + CNAME,
content mentions neither rule generation nor the environment layer — the showcase debt is
content, not only stack.

## §6 Umbrella C — AI docs + agnosticism

- **C1 — AGENTS.md layer + AI Usage Guide.** ADOPT the LF AGENTS.md standard (universal
  harness support; root ≤150 lines; nested files pattern). Consumer template
  (`packages/core/templates/shared/AGENTS.md.template`, copied once by
  `setup.d/30-templates.sh:81`) extended with the environment layer + degradation table
  (A3 is the SSOT; AGENTS.md renders a pointer). New **AI Usage Guide**: the AI-facing
  lifecycle doc (evolution of INSTALL-FOR-AI beyond install: **First Steps** — install →
  first rule fires → first task through the pipeline, as a machine-followable path —
  then daily cycle, presets, parks, degradations). INSTALL-FOR-AI refresh: skill-dir
  naming split (getff vs rules-as-tests), Cursor story reconciliation, npm path once
  live. The human and AI First-Steps guides are two renders of ONE source of truth
  (operator requirement 2026-07-23) — same steps, same claims, different voice.
- **C2 — ai-doc standard applied** to every new contour artifact (tier-home, presets
  data, glm-handoff, /arch shipping surfaces): channel selection, doc-authority headers
  (principle 09 enforces dynamically), hot/cold split, D8 hygiene.
- **C3 — Agnosticism closure.** NEW probe class for skills — today NO probe enumerates
  `.claude/skills` (verified: the only hit in `tests/agnosticism/probes/*` is a SURFACES
  list entry in channel-coverage.sh) — a skills-surface census probe joins principle 21's
  dynamic enumeration; night-mode gets its conformance treatment (its SKILL.md:17 admits
  designed-not-proven); /arch + glm-handoff get explicit degradation declarations;
  zcode-parity-doctrine §3/§4 status columns refreshed (Wave B merged: #1043-#1047) —
  preferably as a D7 generated section rather than another hand edit.
- **C4 — Discoverability: context7 + DeepWiki.** Submit the repo to context7 (open
  submission), add `context7.json` (excludeFolders; the `rules` field carries discipline
  rules into agent-facing snippets) + the context7 GitHub Action for deterministic
  re-index per push. DeepWiki: secondary channel (auto-indexed, refreshes rarely —
  acknowledged), used for orientation snapshots, never freshness-critical claims.
  llms.txt for the REPO is REJECTED (crawler-log evidence: agents don't fetch it from
  repos); llms routes live on the docs site (D5/B).
- **C5 — Self-generating docs, repo side (D7).** Inventory of derivable prose in our own
  docs (status tables ← git/PR facts; skill/agent/hook rosters ← filesystem; coverage
  matrices ← probe output) → migrate to `getff:begin` generated sections with drift
  gates. Prose remains only where judgment lives.

## §7 Release frame

- **Phase 0 — parallel build.** Track 1 finishes the hard part (any-stack trace, honest
  signals, jig J3/go, acceptance contour implementation); track 2 builds A, then C ∥ B,
  on disjoint surfaces (§8). No publication.
- **Phase 1 — operator self-testing (BEFORE publication, D2).** The operator installs
  with the shipped installer from the repo (npm not required) on ≥2 real projects
  (standing polygons per track-1 D5: `~/code/timeliner`, `~/code/apiapp`, plus the second
  machine). Exit: ≥10 tasks through the pipeline across ≥2 projects; ≥1 full night-mode
  run; acceptance Run 0 + Run 1 executed; GLM one-button from scratch on a clean machine;
  0 open BLOCKER issues.
- **Phase 2 — assembly + publication of the READY beta.** Integration gate (§8 checklist
  + «stranger machine, stranger repo, ≤20 min to working pipeline», plan-v2 §6) →
  maintainer promotes staging→main (head=staging, merge-commit — CLAUDE.md Harness
  gates) → operator runs `npm publish` (@getff scope, 0.x semver; maturity labels:
  killer = public beta, environment = experimental opt-in) → release notes via
  release-drafter.
- **Phase 3 — invited testers.** Happy-path from a link (landing → entry command →
  working pipeline), issue templates + feedback channel; gated on phase-2 completion.

## §8 Integration contract — the Lego map (D3)

Paradigm boundaries (each side keeps its own; interfaces are files/gates/conventions):

| Neighbor | Its paradigm | What THIS program consumes | Contract / ordering rule |
|---|---|---|---|
| any-stack closure (5 umbrellas) | vertical proof of killer reachability; python-lane first | its W2 agent-surface + W3 one-beat as facts the installer profiles expose; its D8 `.ai-factory/` ban lift | shared files (`install.sh`, `setup.d/45-python.sh`, hooks, templates): track-1 honest-signals stages land FIRST on contested regions (their §10 rule); every A-stage runs the pre-dispatch in-flight probe; A never edits generation/trust code |
| adapter-jig (J3/go) | conformance jig for backends | go lane existence → D6 universal entry covers it; jig arms feed C5 coverage matrices | read-only; J3 owns `setup.d/47-go.sh` — A1 profiles list it only after J3 merges |
| acceptance contour (D1-D9, pending merge) | boundary-judgment acceptance; fail-closed fidelity gate | D1 marker rule (A4 `economy`/`aif` presets emit it); D5 park routing (A5 status renders parked classes); D4 PR package (R1 release notes read it); D3 gate applies to this program's own stage PRs once live | its implementation is in-session by its own D9; A3's CLAUDE.md pointer-ization lands AFTER their D1 amendment; /arch SKILL.md edits: theirs (D1 §3 obligation) land first, A8 ships content as-is from staging |
| operator-global configs (~/.claude, aif app) | operator-owned, agent-uncommittable | GLM wiring facts (profile name, envs) | A2 writes only via aif REST + consumer-side files; ~/.claude and container .env stay operator-manual |

**Assembly checklist (phase-2 gate, executable where possible):** entry commands resolve
on a clean machine per ecosystem (js/python/cargo/go cells); profiles ship the merged
skill set including track-1's rule-tests surface; presets emit a marker that resolves
against a live profile list; acceptance D3 check is green on a probe PR; AGENTS.md +
tier-home + degradation matrix reference only artifacts that exist on staging; C3 probes
green over the merged skill population; docs site claims cross-checked against shipped
reality (F5).

## §9 Umbrella decomposition, tier routing, gates

| Umbrella | Scope | Tier | Gate |
|---|---|---|---|
| `beta-delivery-ux` (A) | A1-A8, stages ordered A1/A4/A5 → A2/A3/A7/A8 → R1(A6) | **Tier 2** (design decisions per stage: profile payloads, preset data model, aif API shapes) | kickoff on staging; discipline-bearing stages (10-skills.sh, CLAUDE.md pointer, INSTALL-FOR-AI) in-session; pre-dispatch probe incl. track-1 umbrellas mandatory per stage |
| `beta-docs-showcase` (B) | own /arch run from the authored prompt; prototype stage first | classified by its own run (expected Tier 2) | /arch prompt authored by this session; landing repo work is outside this repo's CI — its kickoff lives here, execution targets getff-landing |
| `beta-ai-docs-agnosticism` (C) | C1-C5 | **Tier 2** (probe design + doc-class judgments) | kickoff on staging; C3/C5 gated on A3 (tier-home exists); C1 template edits gated on A1 (profile names final) |

Process (binding): spec + kickoffs + the D1 meta-launch amendment merge to staging before
any dispatch (kickoff-staging-placement); each kickoff carries the principle-12 traps
section; one PR per stage; umbrella closure writes done.md; dispatch is operator-run
/pipeline. This authoring session stops at written kickoffs.

## §10 Non-goals (this program)

- Killer-layer code: generation, trust threading, freshness engines (track 1 owns).
- aif-handoff internals (acceptance walls 1-4 stand; only REST-consumer automation).
- U9 repo split / bridge npm packaging (post-announce, D1).
- A docs MCP server (D5 falsifier 3 records the trigger).
- New package ecosystems beyond npm/pip/cargo/go entry coverage.
- Editing /arch or glm-handoff CONTENT (A8 is wiring-only; content owners are the
  parallel sessions and future maintenance).

## §11 Open forks (left to stage planning, with criteria)

- **F-A′ — tier-home payload location** (`.ai-factory/` doc vs skill-context): pick the
  home that the C1 AGENTS.md pointer + non-CC harnesses read most cheaply; decided in A3
  planning with a one-beat read test.
- **F-B′ — preset data format** (yaml/json table in `references/` vs shell-sourced):
  criterion — readable by the launch-table renderer AND by agents without parsing prose.
- **F-C′ — bin runnability** (tsx dependency vs prebuild): decided inside R1 against the
  tarball matrix cell; input = S6 audit facts.
- **F-D′ — universal installer hosting** (`getff.ai/install` script origin: Pages
  artifact vs repo raw URL): criterion — works before npm publish exists (phase 1 uses
  repo path), stable after.

## §12 Risks + falsifiers

- **R1 — parallel-surface collision** despite contracts: mitigations §8 ordering + probes;
  fallback merge-forward (git-conflict-merge-forward.md). First silent collision →
  tighten the contract table, add the missing row.
- **R2 — designed-not-proven chain in A2** (aif profile-create fields, per-mode defaults
  API; local aif checkout is 2026-05-26): every A2 claim re-verified against the live aif
  at implementation; failure degrades to guided manual steps (never a dead end).
- **R3 — D5 migration underestimates** (blog/RSS/llms routes are custom code): bounded by
  the prototype stage + Starlight rollback (falsifier D5-1).
- **R4 — doc-drift recurrence before C5 lands**: any status table this program itself
  writes must be born as a generated section or carry an explicit owner+trigger line.
- **R5 — spec staleness vs fast-moving staging**: every stage re-verifies its anchors
  live at stage time (track-1 R4 precedent); this spec pins measurement to staging
  `812268ac2` and promises no line stability.
- **R6 — acceptance contour not yet merged** (its spec lives on the authoring branch):
  §8 treats it as a pending contract; if it lands changed, the A3/A4 touchpoints re-verify
  against the merged text — contract references, not copied content, keep this cheap.
