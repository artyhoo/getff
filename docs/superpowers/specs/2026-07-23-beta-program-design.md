# Beta program — delivery & usage convenience for human and AI (design)

> **Status:** r3 after TWO cold two-altitude review rounds (/arch §2 cap reached; both
> seats Opus per the operator model ladder). Round 1: bottom-up **GO** (0 BLOCKER/MAJOR;
> all anchors «verified clean», negative skills-probe claim held under grep); top-down
> REVISE ×5 MAJOR → folded in r2. Round 2 (top-down): 3/5 MAJORs confirmed CLOSED
> (integration map, goal-SSOT reconciliation, cross-repo governance); remaining findings
> folded in r3 — D1 rewritten cold-executable (U11 dispositioned `absorbed-by R1`,
> U3-U7 dispositions decided in-session incl. U5, RU-source quotes + occurrence map);
> D7 premise corrected (doctrine §3 = recorded deferral whose trigger fired — Wave B
> #1043-#1047 git-verified merged; the round-2 reviewer's «NOT merged» counter-claim is
> refuted by staging log) + `.claude/rules/*` carve-out (patch proposals only);
> «north star» term retired for «design objectives»; meta-launch-amendment vs
> acceptance-D1 disambiguated; A3 CLAUDE.md edit routed via maintainer handoff; §8
> claims check named (`claims-conformance-auditor`). Per /arch §2 cap, further
> acceptance is the operator's review gate, not a third cold round.
> **Date:** 2026-07-23
> **Authoritative for:** the beta-program design — design objectives (§1), binding operator
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

## §1 Context + design objectives

The product has two layers. The **killer layer** (stack-aware rule+test generation from
live docs) is being finished by track 1 (any-stack closure W1-W6 + adapter-jig J3/go).
The **environment layer** (multi-model pipeline: /arch design → aif factory with a cheap
executor → tier routing → night-mode → acceptance) exists as repo artifacts + operator
config, and reproducing it costs days of manual pain (GLM onboarding precedent). This
program packages the environment into a product and prepares the public beta.

**Design objectives — four measures, every design decision is judged against all four** (deliberately NOT called a «north star» — that term is the flagged goal-drift vocabulary per the Artifact Ownership Contract origin incident):

1. **Time-to-working + questions-to-human** at install (GLM benchmark: days+manual → minutes+one API key).
2. **Zero forgettability** in daily use: at any moment there is ONE obvious next command and the system proposes it (the origin session asked «how does this launch?» three times and switched models six times — that class of question must disappear).
3. **AI performs the setup** («the second AI is connected by an AI»): smart defaults, humans asked only for the non-derivable (keys, subscriptions).
4. **AI DX** (operator directive 2026-07-23): every artifact must be cheap and reliable for an AI to install / use / maintain — including technology choices (model-corpus familiarity), config shapes (declarative files over interactive wizards), and the development of this repo itself. AI DX is also the public positioning term (§5, README/landing tagline; README §Why edits are maintainer-owned per the Artifact Ownership Contract).

**Goal-SSOT reconciliation (r2, review finding):** README#why-this-exists remains the
unchanged goal SSOT — the goal product is the killer layer (conventions AI agents can't
bypass). The environment layer ships as an **experimental, opt-in companion suite**
around it, never as a silent goal redefinition. The «two-layer public product» framing
is the operator/maintainer's own design-kickoff mandate (2026-07-21/23); its expression
in README §Why is a maintainer-authored deliberate edit scheduled at phase 2 — until it
lands, all public claims label the environment layer experimental and README's goal
statement stands as-is.

## §2 Binding operator decisions (2026-07-23, this session)

Recorded per /arch §1 with falsifiers. Future sessions must not silently reopen these.

- **D1 — Absorb the getff-to-prod tail (meta-launch amendment; r3 — cold-executable).**
  This program absorbs/supersedes U8/U10/U11/U12 of
  [getff-to-prod-meta-launch](../../../.claude/orchestrator-prompts/getff-to-prod-meta-launch/kickoff.md)
  and dispositions the dormant install umbrellas U3-U7. **All judgment calls are made
  HERE; the amendment commit executes them mechanically.** Occurrences to edit: the wave
  graph (kickoff.md:46-54), the launch table (:79-88), the Part-2 stubs (:124-152), and
  the four stub kickoff files — locate by U-number heading if lines move (anchors
  measured at staging `d534019b3`). Dispositions:
  - **U8** → `superseded-by: beta-docs-showcase (umbrella B)` (stub + graph note; its
    honest-README scope is B's F5 claims work).
  - **U10** → stays the publish node, re-gated. Its THREE dependency occurrences — the
    RU graph text «← зависит от U9, U11, U8 🔒НЕОБРАТИМО» (:50), the launch-table deps
    cell «U9, U11, U8» (:81), the stub line «Зависит/Gate: U9 + U11 + U8» (:135) — are
    ALL rewritten to «beta-delivery-ux R1 + release-frame phase-1 exit (this supersedes
    the former U9/U11/U8 edges)». The U9 edge is REMOVED (hybrid-lite single-package
    publish from the monorepo per plan-v2 F1; S6→U10 handoff stays the binding
    checklist); «U9 … НЕОБРАТИМОЕ — последним» (:128) gains «post-announce; no longer
    gates U10».
  - **U11** → `absorbed-by: beta-delivery-ux R1` — the name-freeze IS R1's first step;
    R1 inherits U11's gate («имена заморожены ДО публикации»). U11 disappears as a live
    dependency node (this resolves the r2 inconsistency where U11 was simultaneously
    superseded and a live edge).
  - **U12** → `superseded-by: release-frame phase 3 (this spec §7)`.
  - **U3** `modular-install-fullpack` (S2 merged #723; S3 stalled — `mif-s3-integ`
    5 commits ahead, last 2026-06-26) → `absorbed-by: beta-delivery-ux A1`, PRECEDED by
    a preserved-residue sweep of the stalled branches (T17/T18).
  - **U4** `generator-into-install` → `superseded-by: track-1` — ecosystem-wiring
    already closed detect→wire→deliver→fire end-to-end (#1086) and any-stack W2/W3 own
    the agent surface + one-beat continuation; the npm-lane synth-at-install residue
    belongs to track-1's js-convergence follow-on, not umbrella A.
  - **U5** `generator-catalog-expansion` → `superseded-by: live-generation direction`
    (r3.1, operator-clarified wording — this PROTECTS live generation, it does not
    abandon it): hand-growing a PRE-BAKED recipe catalog is the pre-live-generation
    plan and conflicts with the chosen direction (universal-skill panel D2: «a
    generated skill is a preset, and presets rot»; live path: rule-research LIVE
    adapter #805 → 3-stack core #1005/#1006/#1010 → track-1 reachability).
    Re-trigger: only if, after the live path matures, a small pre-baked seed set
    proves needed for first-impression offline start.
  - **U6** `install-hardening-finish` → layer-selection scope (`--only/--skip`)
    `absorbed-by: beta-delivery-ux A1` (profiles are the selection surface); rollback +
    test-matrix residue `parked` — reopened by phase-1 self-testing evidence of install
    failures.
  - **U7** `plugin-finish` → self-test + docs scope `absorbed-by: beta-delivery-ux A1`
    (plugin = secondary entry channel); OpenCode-adapter residue `parked` under the
    agnosticism roadmap (C3).
  **Ownership:** the amendment lands as a SEPARATE atomic commit (cross-owner handoff +
  rationale per the CLAUDE.md Artifact Ownership Contract — never a side-effect of other
  changes) inside the landing PR, and the PR body flags it for maintainer sign-off.
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
  own docs (operator directive; live evidence of the gap-CLASS, r3 precision:
  zcode-parity-doctrine §3 status columns were a RECORDED deferral («intentionally NOT
  updated … defers to the Wave B implementation PR», doctrine §4/plan §0) whose trigger
  has since FIRED — Wave B merged as #1043-#1047, git-verified on staging — so the
  columns are now legitimately due for their deferred sync; this is exactly the
  update-on-trigger class D7 mechanizes, NOT silent drift; plus README vs INSTALL-FOR-AI
  cross-doc drift on the Cursor story — different-altitude framings, not a flat
  contradiction (r2 wording); INSTALL-FOR-AI agent lists drifted). Mechanism: the existing
  `<!-- getff:begin section=... -->` generated-section pattern + regen checks
  (render-rule-index.mjs precedent). **Ownership carve-out (r2, review finding):
  generated-section automation NEVER touches the maintainer-owned goal artifacts —
  README.md, CLAUDE.md, PROPOSAL.md (frozen), `.claude/session-bootstrap.md`, or any doc
  the Artifact Ownership Contract lists as maintainer-deliberate-edit. Enforcement-layer
  files (`.claude/rules/*` — also maintainer-owned) are never auto-rewritten by
  sessions: generated sections there exist only via maintainer-landed render plans (the
  `00-rule-index.md` precedent — a generated file inside `.claude/rules/`), and C5
  emits patch PROPOSALS for maintainer sign-off on such files, never autonomous
  rewrites (r3, review finding).** Automation applies directly to non-goal-bearing
  derivable surfaces: AGENTS.md rule-index (existing precedent), INSTALL-FOR-AI
  rosters, coverage matrices, shipped-template status tables.
  *Falsifier: a doc class proves non-derivable → it stays prose with an owner and a
  review trigger, recorded per class.*
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
  (consumer/operator) to three steps. The per-profile payload inventory explicitly
  includes the **convenience + guard hook set** already shipping today (operator
  requirement 2026-07-23): end-of-turn recap, ask-question reminder,
  inject-matching-rule, deps-hash staleness (install.sh:486-525) + the .husky
  pre-commit/pre-push gate chain — no shipped comfort/shield may be lost between
  profiles; non-CC coverage of these hooks is verified by C3 probes (16 zcode twins
  exist). The inventory RE-TRIAGES today's dogfood-vs-consumer hook split instead of
  inheriting it (operator correction 2026-07-23): at `env`/`factory` depth the consumer
  authors their OWN kickoffs and AI docs, so contour-guard hooks (`check-kickoff-traps`,
  doc-authority checks) become consumer-relevant shields there — per-hook verdict
  recorded per profile, not assumed. Satellite verdicts recorded in the same re-triage
  (operator-confirmed 2026-07-23): **AI Factory** — its FILE CONVENTION (`.ai-factory/`
  passport) stays core-shipped and load-bearing; the TOOL (`/aif-*` commands) is
  deliberately NOT shipped (SSOT #66 REFERENCE, ~14% problem-class match; our contour
  superseded its plan/implement/verify scope; falsifier: beta testers request the
  workflow → optional manifest row). **Superset** — recommendation + setup recipe only
  (C1 AI Usage Guide + tool-decisions seed), never a default install: parallelism is
  already covered by the factory (default) and the agnostic `create-worktree.sh`
  (manual); falsifier: ≥2 non-CC beta testers report parallel-workspace pain → promote
  to an optional consent manifest row. Companion satellites ride the existing `companions.manifest` consent
  mechanism (superpowers, ast-grep, deepwiki already there); the `factory` profile
  UPGRADES the aif-handoff row from detect+instruct to a consented guided INSTALL
  (official repo path, docker compose; detect-first; decline → graceful `env`-level
  degradation) — per the mandate «the whole multi-model contour in the payload» and
  companion-install-principle (opt-in, official installer, never a hard dependency;
  operator-only satellites like Superset stay out of the shipped axis per SSOT #86/#99).
  *Falsifier: the middle step finds no users through
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
  we do not rebuild routing. **Degradation honesty (r2, review finding):** if the REST
  automation fails and the flow degrades to guided manual steps, that is an objective-3 MISS (AI-performs-setup), not a neutral fallback — phase 1 exits only with the automated
  one-key path proven end-to-end (§7).
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
- **A9 — Parallel-workspace one-command (operator requirement 2026-07-23).** Outside CC
  the «how do I start a session in a worktree?» question must not exist — the flow is
  automated to the `claude -w`/Superset bar. One command (working name `getff work
  <name>`; final name at stage planning) composes: worktree creation (REUSE
  `scripts/create-worktree.sh` — verified portable, configurable base-ref, dual-pair
  with the CC hook — but NOT shipped today, zero install.sh/setup.d references) + dep
  wiring + per-detected-harness session start: CC → DEFER entirely to the native flow
  (desktop app has its own worktree UX — no wrapper involvement; CLI → `claude -w`;
  operator correction 2026-07-23); ZCode → launch/print the ready command in the
  worktree dir; unknown harness → print the exact next command. Flag-first/non-TTY prints instead of launching (AI DX).
  Ships in `env`+. The Superset recipe (A1 satellite verdict) becomes the OPTIONAL
  comfort-UI layer above this, not the load-bearing path. *Falsifier: per-harness
  launch detection proves brittle → the command always prints (never launches), which
  still kills the question.*
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

**Cross-repo governance (r2, review finding).** B's kickoff lives in THIS repo on
staging (dispatch input; kickoff-staging-placement + principle-12 traps apply to it),
but execution targets `getff-landing`, which has NO CI enforcement of this repo's
disciplines. Honest model (Class-C, not theater): (1) stage discipline is
kickoff-encoded — per-stage checklists including the F5 claim gates and the prototype
gate; (2) the landing repo works PR-based with the checklist as the review artifact;
(3) the phase-2 assembly gate in THIS repo cross-checks every shipped site claim against
repo reality (the enforcement backstop). No new CI is built in the landing repo (YAGNI).
*Falsifier: the assembly gate finds repeated claim drift → promote a deterministic
claims-check into the landing repo's CI.*

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
  Two C1 additions (operator-confirmed 2026-07-23): (a) **ai-factory doc sweep** — the
  shipped docs keep the `.ai-factory/` convention but drop/reframe every mention of the
  ai-factory TOOL as a usage path (e.g. the AGENTS.md template's «optional /aif-*
  commands» line) per the A1 satellite verdict; (b) **AGENTS.md co-ownership** — the
  root AGENTS.md may have OTHER writers on consumer machines (DeepWiki-verified:
  ai-factory generates + auto-updates root AGENTS.md), so our template contribution is
  section-scoped via the `getff:begin` fence pattern — co-ownership by construction,
  never whole-file ownership.
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
  gates, honoring the D7 ownership carve-out (maintainer-owned + `.claude/rules/*` files
  get patch proposals / maintainer-landed plans only). Prose remains only where judgment
  lives. C also authors `agents/claims-conformance-auditor.md` — the named cold auditor
  the §8 assembly gate runs over docs-site claims (r3).

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
| open getff-to-prod install umbrellas (U3 modular-install-fullpack S3-stalled; U4/U6/U7 stubs) (r2, review finding) | meta-launch program, currently dormant (U3: S2 merged #723, `mif-s3-integ` 5 commits ahead, last 2026-06-26; U4/U6/U7: no merged stages) | their surfaces ARE umbrella A's surfaces (`install.sh`, `setup.d/`, plugin) | D1 amendment dispositions each (absorb/supersede/park) BEFORE any A-stage dispatch; U3 residue swept per T17/T18; until the amendment lands, A does not dispatch — no off-contract contention on install.sh |

**Assembly checklist (phase-2 gate, executable where possible):** entry commands resolve
on a clean machine per ecosystem (js/python/cargo/go cells); profiles ship the merged
skill set including track-1's rule-tests surface; presets emit a marker that resolves
against a live profile list; acceptance D3 check is green on a probe PR; AGENTS.md +
tier-home + degradation matrix reference only artifacts that exist on staging; C3 probes
green over the merged skill population; docs-site claims cross-checked against shipped
reality (F5) by a NAMED cold auditor — `claims-conformance-auditor`
(compliance-verifier class `agents/*.md`, authored in umbrella C; r3, per
attention-is-not-a-mechanism §1: the checklist is merge authority, the named agent is
the detection layer).

## §9 Umbrella decomposition, tier routing, gates

| Umbrella | Scope | Tier | Gate |
|---|---|---|---|
| `beta-delivery-ux` (A) | A1-A9, staged per the umbrella kickoff: S1(A1) → S2(A4/A5/A9) ∥ S3(A3) ∥ S4(A2) ∥ S5(A7/A8) → R1(A6) (r2 — kickoff grouping is the binding one) | **Tier 2** (design decisions per stage: profile payloads, preset data model, aif API shapes) | kickoff on staging; discipline-bearing stages (10-skills.sh, CLAUDE.md pointer, INSTALL-FOR-AI) in-session; the A3 CLAUDE.md pointer-ization is a cross-owner edit → separate atomic commit + maintainer sign-off, same treatment as the meta-launch amendment (r3); pre-dispatch probe incl. track-1 umbrellas mandatory per stage |
| `beta-docs-showcase` (B) | own /arch run from the authored prompt; prototype stage first | classified by its own run (expected Tier 2) | /arch prompt authored by this session; landing repo work is outside this repo's CI — its kickoff lives here, execution targets getff-landing |
| `beta-ai-docs-agnosticism` (C) | C1-C5 | **Tier 2** (probe design + doc-class judgments) | kickoff on staging; C3/C5 gated on A3 (tier-home exists); C1 template edits gated on A1 (profile names final) |

Process (binding): spec + kickoffs + the D1 meta-launch amendment merge to staging before
any dispatch (kickoff-staging-placement); each kickoff carries the principle-12 traps
section; one PR per stage; umbrella closure writes done.md; dispatch is operator-run
/pipeline. This authoring session stops at written kickoffs.

**Dispatch preflights (binding, r2, review findings):** (1) no A/C stage that touches a
neighbor-contract surface (A3 tier-home pointer, A4 marker semantics, the go assembly
cell) dispatches until the corresponding neighbor artifact is ON staging — such stages
are marked `blocked-pending-neighbor` in the kickoffs, not startable at dispatch;
(2) every stage re-verifies its file:line anchors live at stage entry (this spec's line
citations are measurement-time snapshots, staging moves fast — tip was already
`d534019b3` at review time); (3) A dispatches only after the meta-launch amendment (this spec §2 D1 — NOT the
acceptance-contour's D1 marker rule; distinct artifacts, r3 disambiguation) has landed
(no off-contract contention with U3-U7 surfaces).

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
