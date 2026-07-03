# Wave sequencing plan — when to do/launch what

> **Authoritative for:** execution *ordering* of the open waves (N0–N8) + infra tracks — the «when / in what order / gated by what» layer. Sequencing rationale: single hard date, dependency edges, cost-first (free research before paid build).
> **NOT authoritative for:** project goal — see [../../README.md#why-this-exists](../../README.md#why-this-exists); each wave's *content* — see [research-patches/2026-05-21-niche-strategy-and-growth-roadmap.md](research-patches/2026-05-21-niche-strategy-and-growth-roadmap.md) (N0–N7) and [research-patches/2026-05-22-deterministic-offload-autonomy-economy.md](research-patches/2026-05-22-deterministic-offload-autonomy-economy.md) (N8); the storm/billing facts — see N0 in the niche roadmap; the automerge/staging infra — see [automerge-staging-plan.md](automerge-staging-plan.md).
>
> **Status:** ACTIVE — committed to staging (#151, 2026-05-22). Wave *admission* + launch order = maintainer call per [reviewer-discipline.md §2](../../.claude/rules/reviewer-discipline.md). The ordering/dependency structure (§2–§6) is the durable layer; **per-wave statuses drift** — §0 holds the snapshot reconciled 2026-06-29 against merged PRs + per-wave research-patches. Re-verify §0 before relying on it.
>
> **How §0 stays current (by design — read this before "fixing" it):** §0 is updated by **manual, human-directed reconciliation** — there is **no automatic write-back**. Auto-editing §0 in place (Direction A) was **REJECTED** at R-phase ([research-patches/2026-05-25-plan-memory-rphase.md:370](research-patches/2026-05-25-plan-memory-rphase.md)) for two reasons: (1) HIGH blast radius — §0 rows are long, with 6–8 non-unique string fragments and no machine-safe delimiter, so a wrong-row write passes CI silently (no structural test on §0 content); (2) concurrent-session race — ~19 commits/90d + parallel worktrees. Adopted instead (Direction B): a gitignored, per-machine, **non-load-bearing** cache `.claude/orchestrator-prompts/_plan-cache.md` + `_master-backlog-delta.json` that auto-update every `/meta-orchestrator` invocation — but mechanical state (`gh pr list`) always wins over the cache. So the loop is: **`/meta-orchestrator` (no-arg) auto-DETECTS drift** (§0 claims vs live `gh`) and proposes `DRIFT-N` corrections → **a human-directed session WRITES §0** (like this reconciliation). Freshness therefore depends on someone invoking + reconciling; that is why it drifted ~80 PRs (#298→#382) between 2026-05-29 and 2026-06-02.

---

## §0 — Verified status snapshot (reconciled 2026-06-29)

> Verified against merged PRs (`gh pr view`) + per-wave research-patches present in `research-patches/`. Supersedes any «pending/next» framing in older prose below — mirrors the `#stale-claim` correction the niche roadmap §STATUS-RECONCILIATION already needed once.

| Wave | What | Verified status | Evidence |
|---|---|---|---|
| N0 | headless billing change (15 Jun) | ✅ **decision CLOSED 2026-05-22** — defer-action + arm utilisation trigger (D1/D2/D3 resolved) | §5.3; niche-roadmap §N0 |
| N1 | niche-validation research | ✅ research deliverable complete | `2026-05-21-n1-niche-validation.md` §4 verdict («research deliverable only») |
| N2 | adopt-from-Superpowers | 🟡 verdicts done → application (rule/SSOT edits) pending, maintainer-owned | `2026-05-21-n2-adopt-from-superpowers.md` §3 |
| N3 | enforcement substrate (= Wave 10) | ✅ DONE | #107/#114/#116/#119/#120/#127/#129 MERGED |
| N4a | claim-detector fix | ✅ DONE | #98 MERGED |
| N4b | recommendation-moment gate | 🟡 D6 resolved: H1 SHIPPED (#117), H2 REJECTED, H10 DEFERRED/trigger-gated | `2026-05-22-n4b-recommendation-gate-design.md` (design #136); open-questions §13.39 (record #118) |
| N5 | give the conscience back | 🔲 not started — **BLOCKED** (dependency): gated on N7 *live-dogfood trial* (N7 decision=C ✅ + repo-side applied, but live trial still pending) + N2 application. By design you can't give back until dogfooding reveals what's genuinely unique (niche-roadmap line 91/116) | niche-roadmap §N5 |
| N6a | coexistence / C-1 | ✅ DONE | #79/#82 MERGED |
| N6b | one-button install | ✅ **DONE 2026-06-10** — shipped as the `one-click-installer` umbrella: `./setup` one-click orchestrator (#447) + framework-only `install.sh` S1 (#442) + companion-manifest engine/data/bridge S2 (#443/#444/#445) + S5 integration & graceful fallback (#452); umbrella closed via done.md (#453) | niche-roadmap §N6 (line 82/107); one-click-installer umbrella |
| N7 | dogfood companions | ✅ **applied + verified** (SSOT #64/#65, rule §4 demotion, retention=A coexist; Superpowers v5.1.0 installed + source/installed-file verified §7b/c; orchestrator-skill REFERENCE note landed). Sole open item: one organic end-to-end SDD run (§7a, deferred to first real umbrella); **DECISION=C** | `2026-05-22-n7-dogfood-companions.md` §9 + dogfood-companions research-patch #135 + §4 demotion #166 + live-trial verified #171 |
| N8 | deterministic-offload autonomy economy | ✅ **R-phase DONE** (#158→staging; autonomous Queue-mode: Worker→Reviewer **GO**→orchestrator anti-collusion passed). **A-phase 🟡 C1–C4 SHIPPED** (correctness offloads): C1 SSOT-existence arm (#170), C2 kickoff T-enumeration floor (#174), C3 principle 13 §1.7 substance (#178), C4 delivery-channel marker (#177), activation #180 (C2+C4 wired). **C5 + cost-levers** still gated on the §5.3 utilisation trigger | findings `2026-05-22-n8-rphase-findings.md` (R1–R4; ⚠ R2 category-survey coverage **provisional** — only 1/6 categories hit the ≥3-candidate floor, corrected #163 §10 → treat R2 verdicts as non-load-bearing until completed) + plan `2026-05-22-deterministic-offload-autonomy-economy.md` |
| **Channel-audit + mutation-hardening** | session 2026-05-23 wrap-up | ✅ **PR #181 + #183 MERGED**; channel-audit §10 DN-1..DN-4 all resolved (see §5.4); follow-up queue ⇒ Track M (M.1–M.6) — **M.1 ✅ DONE (#212), M.4 ✅ DONE (#195-#200, 6 hooks tested); the bash-hook mutation-testing strand spun out into the `mutation-discipline` umbrella (Stages A→D ✅ DONE — own row below); M.5/M.6 still queued**; principle 11 testTimeout tightened #184 | §5.4 decision record + Track M sequencing |
| **Meta-orchestrator skill** (Track P) | n8-c3 BUILD (Sub-wave D) + audit rounds + UX refactor (F.1/G/F.3) + planner-completeness (L1/L2 + L3–L5 R-phase + I-phase) + §1.7 PR-body mandate + **skill-memory (cache + injection + writer)** + mode-triage substrate + F.3 helper-collapse I-phase | 🟡 BUILD ✅ / audits ✅ / UX ✅ / L1+L2 ✅ / L3–L5 I-phase ✅ / skill-memory ✅ / F.3 I-phase ✅ / mode-triage substrate ✅ | #186 (BUILD root) · #192/#193/#194 (audit r1) · #201/#202 (audit r2 + follow-ups) · #203 (F.1 prior-art) · #204 (G refactor design) · #205 (F.3 UX impl) · #208 (EOT guard) · #209 (Item 10 B5 hybrid) · #213 (L3–L5 R-phase prior-art) · #214 (L1 discovery surface) · #217 (L2 reverse-currency UNTRACKED) · #216 (§1.7 PR-body mandate in kickoff template) · #218 (§2 step 4 proceeding scope clarification) · #222 (L3 dup-detect + SSOT #72 REFERENCE OpenHands) · #223 (L5 skill/agent assignment helper) · #225 (L4 decomposition heuristics + SSOT #73/#74) · #226 (mirror-items single-source via install-time URL transform) · #227 (plan-memory brainstorm) · #228 (output-format §4.1 description block) · #230 (plan-memory R-phase — ADOPT Direction B + SSOT #77) · #236 (skill-memory — cache + injection + writer) · #237 (bundle-autonomous prior-art) · #238 (mode-triage design) · #239 (mode-triage prior-art) · #240 (Stage 2b JSON sidecar persistence) · #241 (Stage 2A discovery surfaces) · #242 (Stage 2c skill-wiring + principle 19) · #243 (Stage 3 delta-diff helper + reconciliation rule) · #244 (Stage 4 CLI override flags `--mode-*`) · #245 (Stage 5 dogfood findings) · #246 (J1 classify-work strict path-shape) · #247 (bundle-autonomous Stage 3 — B1/B2/B3a) · #260 (§2.5 Step 3 Loop → classify-each-candidate.sh) · #261 (no-arg-laziness R-phase — F.3 helper-collapse verdict) · #262 (DN-1..DN-4 best-practices research-patch) · #263 (F.3 helper-collapse I-phase — new helpers `dispatch-from-state.sh` + `delta-write-from-state.sh` + DN-1 narrow-glob + §3 inline-block removal per DN-3) |
| **Recommendation-laziness discipline** | R-phase + production-corpus benchmark + I-phase Sub-waves A/C/D (covers M.1 T20 codification + new Class-C mechanism rule) | ✅ **DONE 2026-05-25** — Option D = A+C only (narrow-B dropped, FP=84.2%) | #206 (R-phase design) · #207 (BFR own-stack-blind-spot amend) · #210 (narrow-b benchmark) · #211 (I·A — H1 cross-ref) · #212 (I·C — T20 trap; **closes M.1**) · #215 (I·D — `.claude/rules/recommendation-laziness-discipline.md` Class C mechanism layer for `phase-research-coverage §1.12`) |
| **`meta-orch-no-arg-overview` umbrella** | Stage 0 thin §1.5d probe + Stage 1 §0 refresh + Stage 2 branch-matcher + Stage 3 no-arg overview UX + Stage 4 P4-a/P4-b fix (`!`-fence permission-check unblock) | 🟡 Stage 0-thin ✅ (#264) / Stage 4 ✅ (#266) / Stage 2 ✅ — §0 integer-name guard helper (#302) + inflight-check (#303) + dup-detect Signal-3 deliverable-on-staging (#304/#308) / Stage 1 (§0 refresh) — done **manually each reconciliation** (this 2026-06-02 reconcile is one such; the V3 no-arg overview shipped, see Track P) / Stage 3 UX 🔲 | #264 · #266 · #302 (§0 integer-name guard → helper) · #303 (inflight-check.sh) · #304/#308 (dup-detect Signal 3) · #353 (p12 exempt qloop-ux-probe) |
| **`aif-handoff-as-runtime-bridge` umbrella** | Runtime-bridge variant evaluation: 4 variants (A MCP-consumer / B native fs-watcher / B' hybrid CC-hook + MCP / C minimal bridge); 3 stages + 2 Phase -1 cold-reviews + 1 mechanical fixup | ✅ **DONE 2026-05-29 — verdict DEFER ALL with updated SSOT triggers**. Per-variant: **A REFERENCE 28%** (3 ADOPT-blockers — PLAN.md disk coupling + WebSocket broadcast no-topic-filter + autoMode Reviewer vs `reviewer-discipline.md §2`) · **B REJECT ~5%** (upstream native fs-watcher absent + DECISION=C HARD violated) · **B' REFERENCE 35% conditional ADOPT VOCABULARY** (mechanism cheap 0-25 LOC via CC `mcp_tool` hook — T-AIF-BRIDGE-B'-1 and -B'-3 traps evaded; inherits A's 3 blockers; upgrades iff A greenlit + DN-1 adopted) · **C REJECT 22%** (BEFORE/AFTER 25% literal / 0% cognitive maintainer-action reduction < §8 STOP 30%; no `aif-handoff exec` CLI in upstream). No equipoise → no DECISION-NEEDED escalation under hook-discipline. SSOT additive notes for rows #27/#28/#67 + slot #84 **proposed** in synthesis (not landed; separate session if maintainer wants application) | #267 (SW-B — native fs-watcher) · #268 (SW-A — MCP-consumer) · #269 (Stage 1→2 cold-review mechanical fixups — B1 jq-camelCase trap + M1 PR #127/#128 wording + m1/m2/m3) · #275 (SW-B2 — Variant B' hybrid, added post-DN-2-reframing) · #276 (SW-C — minimal bridge) · #281 (SW-D — synthesis + final verdict DEFER ALL) |
| **`runtime-bridge` BUILD** (supersedes DEFER-ALL above) | ⚠ **The DEFER-ALL verdict applied to the 4 evaluated *variants* only.** A *minimal REST* dispatch bridge was subsequently **BUILT** (not one of the 4 variants) and a full ecosystem grew on it. The row above is a faithful record of the R-phase; this row records what shipped. | ✅ **LIVE 2026-05-31→06-01** — REST dispatch + result read-back (#312 R-phase / #313 I-phase, live-verified taskId reached `plan_ready`); park-don't-guess primitive (#332/#354-#357/#361/#362); harvest egress leg (#343/#352); bridge-health + self-cleaning junk (#358/#359/#365/#367); consumer setup auto-write (#298/#299/#311); autonomous aif dispatch + park contract in meta-orch (#316); qloop design+cli (#315/#318/#319/#320/#323/#327) | #312/#313 · #315/#316/#318/#319/#320/#323/#327 · #332/#343/#352/#354/#355/#356/#357/#358/#359/#361/#362/#365/#367 |
| **`aif task-isolation` / worktree-gap** | why per-task worktrees never materialize (R-phase) → I-phase fix | ✅ **DONE 2026-06-03** — R-phase Findings A+F landed (#360); #360-correction merged (#372); I-phase fix shipped — each dispatched kickoff runs in its own worktree (#386 principle-12 anti-tautology + #387 e2e-proven); parallel-dispatch §5 RESOLVED via `use_subagents` (#377/#380) | #360 · #362 · #372 · #377/#380 · #386/#387 |
| **`companion adoption` (two-axis doctrine + #108 gate hooks)** | satellite-capability survey + own-stack-first doctrine + CC-native orchestrator-gate hooks | ✅ **DONE 2026-05-31→06-01** — capability survey + census (#321/#329, SSOT #92-#97); two-axis satellite doctrine relocated CLAUDE.md → BFR §1.1 (#324/#325/#326); satellite-feature-harvest (#328); #108 SubagentStart digest (#330) + SubagentStop WARN (#339/#340); F1 CC-paths rule-scoping (#331); F2 Routines /fire alternative (#333); setup-cc-adoptions.sh + done.md markers (#335) | #307/#321/#322/#324/#325/#326/#328/#329 · #330/#331/#333/#335/#339/#340/#342 |
| **`coordination-persistence-fix`** | cross-worktree symlink-to-canonical sync (principle-12-vs-G) | ✅ **DONE 2026-06-01→06-02** — symlink-to-canonical sync (#346, SSOT #110); SW-B symlink-aware helpers + G/B/C installer (#363/#368/#369); i18n reminder payload (#364); principle-12 fixes — population bound 100..300 (#375) + citation ignores coordination-mirror kickoffs (#376) | #346/#363/#364/#368/#369 · #375/#376 |
| **`qloop` (question-loop battle-test + tail)** | aif autonomous question-loop proven e2e + hook/discipline tail | ✅ **DONE 2026-06-01** — full loop proven e2e (#348); surface genuine forks via `AskUserQuestion` autonomous-default (#349); orchestration-mode aware reminders + brainstorm cue (#350); mid-flight park surfacing (#351); commit aif rework leg in harvest (#352) | #348/#349/#350/#351/#352/#353 |
| **`mutation-discipline` umbrella** (Track M continuation) | bash-hook mutation testing (universalmutator ADAPT, local/on-demand) — Stages A→D | ✅ **DONE 2026-05-31→06-02** — Stage 2 B.1 prior-art ADAPT-not-BUILD (#305); B.2 mutator (#366) + dogfood follow-up (#373); Stage C meta-launch (#378); Stage 4 D paired-negative tests for 5 remaining `.sh` helpers (#381); D6 dedup-verdict (#382) | #305/#366/#373/#378/#381/#382 |
| **`worktree dual-channel` + J5** | portable `create-worktree.sh` (Bug 1 base-ref fix) + J5 hydrate gitignored orchestrator-prompts | ✅ **DONE 2026-05-30→05-31** — portable create-worktree.sh + Bug 1 fix (#300); dual-channel wire rule §1 + kickoff template + SSOT #87 (#301/#306); J5 hydrate on worktree creation (#310) | #300/#301/#306/#310 |
| **`doc-audit-ship-boundary`** | autonomous aif doc-staleness audit + fixes | ✅ **DONE 2026-06-02** — Stage 2 findings (autonomous aif run, #371); DN-1/2/4 doc-staleness fixes + fixer tooling (#374); DN-3 inject-layer = planned follow-up kickoff (deferred) | #371/#374 |
| **`guard-liveness` umbrella** (staged: v0→v1→{v1.5‖v3}→v2) | change-scoped guard-liveness gate — does each manifest rule's guard actually catch its own violation? Design SSOT `2026-05-23-guard-liveness-gate.md` | ✅ **DONE 2026-06-13** — v0 audit (#458), v1 ESLint gate (#460), v1.5 cmd/script gate (#475), v3 manual SP-prober (#476), v2 full-sweep CI backstop (#484, last stage); `main` branch-protection now requires `guard-liveness-fullsweep`; closed via done.md (#489) | #458/#460/#475/#476/#484; closed #489 |
| **`final-quality-audit` (FQA) umbrella** | pre-positioning whole-product audit: does the shipped product actually execute its own «rules-as-tests» thesis on install? S1 (4 audits: shipped-surface / tool-bootstrapping / internal-AI-docs / skills-quality) → S2 consolidation → S3 fixes | ✅ **DONE 2026-06-13** — single-PR umbrella #470. Root cause found: `install.sh` shipped rule artefacts as **inert files** (eslint barrel, dep-cruiser, scripts, tool-decisions seed never wired). S3 de-inerted all shipped gates + principle-15 git-aware (F1) + orphan deletions (`probe-cc-perm`, stale `meta-orchestrator/`) + doc-currency; DN-1..DN-4 resolved within S3. Executable closure: `tests/install-sh/c1-wiring.test.sh` 10/10 incl. paired-negative. Deeper consumer-side strand → `consumer-install-hardening` umbrella (below). Closed via done.md (#470) | #468/#469 (S1 research) · #470 (S1–S3 ship); closed #470 |
| **`consumer-install-hardening` umbrella** (FQA follow-on) | make the install.sh-shipped shields live + layout-agnostic in real consumer repos | ✅ **DONE 2026-06-13** — S1 hooks/devDeps live (#474); S2 `/aif-*` + AGENTS.md honesty (#479/#480/#481/#485); S3 layout-agnostic rule+stryker globs + R7/R8 defer + F14 lint-staged binary-resolution + F15 prettierignore + V1/V2 liveness gates + runtime-discipline arming WARN (#486/#490/#491); closed via done.md (#493) | #474/#479/#480/#481/#485/#486/#490/#491; closed #493 |
| **`universalization-fix` umbrella** (project-philosophy audit 2026-06-14 follow-on) | layout-coupling residue NOT closed by #511 (which closed #507/#508/#509 at the ESLint-glob+depcruise+nvmrc layer): **S1** probe-level silent-PASS reported green checking zero files — R4 (`packages/core/audit-self/audit-ai-docs.ts` on no `src/domain`), R17 (`audit-ai-docs.react-next.sh`), `test:integration` `src/**` glob → now WARN-not-PASS · **S2** `check-rule-globs` into **pre-push** (earliest-reachable channel; #511 had wired only validate+CI) · **S3** single `resolve-source-roots` seam (R-phase: ADOPT workspace-root resolver?) replacing N hardcodes · **S4** README "works as-is" layout-honesty | ✅ **DONE 2026-06-29** — S1 (#515), S2 (#517), S4 (#514), S3 `resolve-source-roots` seam (#526) all merged. Kickoff `.claude/orchestrator-prompts/universalization-fix/kickoff.md` | #515 (S1) / #517 (S2) / #514 (S4); S3 open |

**Infra:** I.1 staging-trunk migration **DONE** (#144/#150 — default branch = `staging`, `main` push-blocked, `ci-success` on both; native Merge Queue unavailable on this repo → `strict:false` substitute). I.1 follow-ups: ci-success aggregate #125 / non-main-base trailer backstop #123 / sole-required-gate fold-in #130 / tsc --noEmit gate #131 / EOT recap fix #145 / pre-push default origin/staging #146 / LIVE status correction #147+#148 / merge-queue dry-run #149 / runbook preserve #172 / resync staging→main #143+#187 / branch-from-main flow doc #128 / automerge plan #124 / §1.7 trailer CI backstop #121. I.2 channel-selection promote + SSOT #60–#63 still maintainer-click; channel-selection rule + survey #139 + path-scoped rule-injector #142 + activation #175 + SSOT #60–#63 codify #154. I.3 DN-4 incremental: memory-codification gap tracker #140 + memory-codification rule + auditor #138 + verify-before-claim family codification #159 + DN-4 round 2 #161 + round 3 #162 + #21 (human-verifies-nothing) #167 + DN-5 Class headers fix #152 + memory coverage audit #126 + principle 17 no-paid-LLM CI #132+#133.

**What actually remains (as of 2026-06-29):** **no active in-flight build-umbrella** — the 2026-06-28 multi-stack/generation thread closed (`multi-stack-monorepo` L1 #793 / L2 #796; `generation-live-delivery` R-phase #797, Q1 parked). Standing/deferred work (unchanged): apply N2 verdicts (maintainer-owned rule/SSOT edits); **N7** sole open item = one organic end-to-end SDD run (deferred) · **N8 A-phase C5 + cost-levers** (C1–C4 ✅ SHIPPED; cost-levers gated on §5.3 utilisation trigger) · **`meta-orch-no-arg-overview` Stage 3 UX** (Stages 0/1/2/4 ✅ — Stage 1 §0-refresh is the manual-reconciliation loop, ongoing; this 2026-06-29 reconcile is one such) · **Track M.5/M.6** (M.1/M.4 ✅; mutation-discipline umbrella ✅) · N4b H10 (deferred, trigger-gated) · N5 (blocked on N7 live-dogfood). **N6b ✅ DONE** (one-click-installer, 2026-06-10). **OPEN-PARTIAL (verified 2026-06-29, do NOT mark closed):** `modular-install-fullpack` (S1–S4 merged #719/#723/#724/#725; **S5 Timeliner dogfood acceptance** remains) · `shipped-artifact-liveness-gap` (R + M1 #576 + M2 #580 + post-install Phase-1 #631 merged; design §8 **Phases 2–3** unbuilt) · `getff-to-prod` program (U1/U2 materialized #785/#736; U4–U17 stubs) · `phase-10-foundations-audit` (R-patch #757 landed; §2 DECISION-NEEDED triage = maintainer's call).

**Open frontier (live, as of 2026-06-29 — `gh` staging tip #809 + `/pipeline` no-arg completion-filter + dup-detect + per-umbrella verification): NO active in-flight build-umbrella.** The 2026-06-28 multi-stack/generation thread closed (`multi-stack-monorepo` L1 #793 / L2 #796; `generation-live-delivery` R-phase #797, Q1 parked); the 2026-06-13 frontier (`universalization-fix` S3 #526, `inject-layer-extension` #494) also closed. The genuinely-open work is the **OPEN-PARTIAL set** in "What actually remains" above (`modular-install-fullpack` S5 · `shipped-artifact-liveness-gap` §8 Ph2–3 · `getff-to-prod` U4–U17 · `phase-10-foundations-audit` DECISION-NEEDED) plus standing/deferred waves (N2/N5/N7/N8-C5). No clean single next-thread — maintainer picks from OPEN-PARTIAL or opens a new umbrella (e.g. a `generation-live-delivery` I-phase per #797's verdict).

**Closed since the 2026-06-13 snapshot (#518→#809 — major umbrellas, not individually rowed above):** multi-stack react-spa/react-native preset wiring (#713/#714, closes #646) · `modular-install-fullpack` S1–S4 (#719/#723/#724/#725; S5 open) · `generator-forbid-mvp` (#696/#697) · `stage-2-generate-path` (#691/#692) · `generation-paths-comparison` (#700) · `generator-require-composite-tier` (#710) · `generator-install-wiring` (#746) · `react-spa-generate-parity` (#750) · `enforcement-liveness-fix` (#745/#753) · `plugin-loadability` (#794/#804) + `plugin-packaging` (#672) · `rule-research-live-adapter` (#805/#809) · `rule-bootstrapping-iphase-spike` (#801) · `self-enforcement-fixes` (#778) · `research-application-fixes` (#774) · `egress-host-push-default` (#760) · `zero-dep-synth-bundle` (#763) · channel-discipline M6 gate (#765/#769) · dogfood issues #735/#737/#730/#727 · `aif-heal-portable` (#505) · `pressure-scenario` automation+generator (#572/#582) · `agents-toolname-fix-551-552` (#571) · `pipeline-i18n-fix`→language-discipline (#583) · `642-r2-wirer-fix` (#647) · `consumer-findings-tail-verify` (#569) · `aif-init-passport-gen` (#610) · `universalization-fix` (#515/#517/#526/#514) · `inject-layer-extension` (#494) · `getff-to-prod` U1/U2 (#785/#736) · `multi-stack-monorepo` (#793/#796) · `generation-live-delivery` R-phase (#797). **17 missing `done.md` closure markers backfilled in this reconcile's PR** (642-r2-wirer-fix, agents-toolname-fix-551-552[+ -meta-launch], pipeline-i18n-fix, pressure-scenario-automation[+ -meta-launch], pressure-scenario-generator, generator-install-wiring, aif-heal-portable, consumer-findings-tail-verify, react-spa-generate-parity, aif-init-passport-gen-meta-launch, consumer-install-completeness-meta-launch, generator-forbid-mvp-meta-launch, stage-2-generate-path-meta-launch, multi-stack-monorepo, generation-live-delivery).

*(Closed since the 2026-06-11 snapshot — were the prior open-frontier: `guard-liveness` Stage 2/3 ✅ DONE #475/#476/#484, closed #489; `final-quality-audit` ✅ DONE #470; `consumer-install-hardening` ✅ DONE #486/#490/#491, closed #493.)*
*(Closed since the 2026-06-02 snapshot — were the prior open-frontier: `aif-worktree-gap`/`aif-isolation-rphase` ✅ DONE #372/#386/#387; `one-click-installer` (=N6b) ✅ DONE #442–#452, closed #453; `f2-aif-fire-backend-iphase` ✅ DONE #457, closed #459.)*

*(N0 decision CLOSED 2026-05-22 — §5.3; 0.3 promote CLOSED 2026-05-22 — §5.2; channel-earliness audit ✅ DONE — §5.4. **`aif-handoff-as-runtime-bridge` R-phase ✅ DONE 2026-05-29 #267/#268/#269/#275/#276/#281 — verdict DEFER-ALL applied to the 4 evaluated variants; SUPERSEDED in practice by the minimal-REST `runtime-bridge` BUILD that shipped 2026-05-31→06-01 — see the `runtime-bridge BUILD` row above.**)*

> **⚠ SSOT-ID collision:** N8 findings §7 proposed rows **#64–#68**, but N7 application already **took #64/#65** (see N7 row). When N8 A-phase admits its SSOT rows they must renumber to **#66+** (next free). The N8 findings file's §7 numbers are stale on this point — corrected at A-phase admission, not now (findings is a research deliverable, ID assignment happens at capability-commit). The N0 decision record (§5.3) likewise refers to these by *role* (prompt-caching / local-model rows), not by frozen number.

> **🔲 legend (read the cell, don't assume):** 🔲 = *not started* — the cell says **why**. **BLOCKED** = unmet dependency (N5). **NOT blocked** = deps met, just deprioritized → startable now (N6b). 🟡 = partially done (research/repo-side done, application/live-trial pending). ✅ = done+merged. Distinguishing blocked-🔲 from deprioritized-🔲 is the thing sessions keep confusing.

**Mostly research-complete:** the bulk of per-wave *research* across N1/N2/N4b/N7/N8 is done; the open frontier is **application** of verdicts + N0/N8 cost work, not new research.

**Standalone work + plan-revision history (not tied to a named wave):**

- **Standalone research-patches / cleanups:** satellite-architecture + honest-dogfooding positioning + K1/K2 plan slots #191 (K1 audit / K2 refactor planned, not started); guard-liveness-gate research-patch #189; storm-readiness→positioning goal + book Часть XIV #173; Wave-10 legacy/drift cleanup #182; ported §10 correction from `channel-earliness-audit.md` #176.
- **Wave 10 / N3 follow-ups:** SSOT #54 Aider `run_cmd` ADAPT #110; principle 15 — skill paired-negative test #112 (TDD-for-Skills §13.36 RESOLVED) + record patch #113.
- **Plan revision history (this file's own commit trail):** #108 (reconcile N6a + N4a), #109 (close companion A/B/C decisions ⇒ §5.1), #153 (close decision 0.2 — companion = C ⇒ §5.1), #155 (reconcile statuses), #157 (close decision 0.3 — promote → `EXECUTION-PLAN.md` ⇒ §5.2), #160 (N8 R-phase status DONE), #164 (close N0 decision ⇒ §5.3), #165 (clarify N5/N6b readiness + SSOT-ID collision), #168 (flag N8 R2 coverage provisional), #179 (schedule channel-earliness audit Track 2.3), #185 (record DN closures + Track M follow-up queue ⇒ §5.4), #220 (reconcile §0 → 2026-05-25), (prior PR: refresh §0 → 2026-05-29 — add `meta-orch-no-arg-overview` + `aif-handoff-bridge` umbrella rows; close L3–L5 I-phase + skill-memory + F.3-I-phase items in Track P + «What actually remains»), (prior PR: close `aif-handoff-as-runtime-bridge` umbrella row to DONE — verdict DEFER ALL; update «What actually remains» to remove the umbrella entry), (this reconcile 2026-06-02: refresh §0 → 2026-06-02 against #298→#382 — add the «how §0 stays current» design note; add 8 umbrella rows (`runtime-bridge` BUILD, `aif task-isolation`, `companion adoption`, `coordination-persistence-fix`, `qloop`, `mutation-discipline`, `worktree dual-channel`, `doc-audit-ship-boundary`); correct the DEFER-ALL row as superseded-in-practice; add the live open-frontier block), (this reconcile 2026-06-11: refresh §0 → 2026-06-11 against #383→#461 via `/pipeline` no-arg DRIFT-1..4 — mark `aif-worktree-gap`/`aif-isolation` ✅ (#372/#386/#387), `N6b`/`one-click-installer` ✅ (#442–#452/#453), `f2-aif-fire-backend-iphase` ✅ (#457/#459); add the `guard-liveness` umbrella row (Stage 1 ✅ #458/#460, Stage 2 v1.5‖v3 unblocked, Stage 3 v2 gated); rewrite open-frontier + «What actually remains» around guard-liveness as the live thread), (this reconcile 2026-06-13 via `/pipeline final-quality-audit` closure check: mark `guard-liveness` ✅ DONE (#484/#489), add `final-quality-audit` umbrella row ✅ DONE (#470, evidence `tests/install-sh/c1-wiring.test.sh` 10/10) + its `consumer-install-hardening` follow-on ✅ DONE (#491/#493); rewrite open-frontier + «What actually remains» to «no active in-flight umbrella»; wrote the missing FQA `done.md` closure marker), (this reconcile 2026-06-29 via `/pipeline` no-arg overview + closure-debt sweep: refresh §0 → 2026-06-29 against #518→#809; open-frontier = NO active build-umbrella (multi-stack/generation thread closed: `multi-stack-monorepo` #793/#796, `generation-live-delivery` R-phase #797); record the post-2026-06-13 closure batch; backfill 17 missing `done.md` markers; mark `universalization-fix` ✅ (S3 #526); flag `modular-install-fullpack` S5 + `shipped-artifact-liveness-gap` §8 Ph2–3 + `getff-to-prod` U4–U17 + `phase-10-foundations-audit` DECISION-NEEDED as the OPEN-PARTIAL open work).

---

## §1 — The single hard anchor

**2026-06-15 = N0** (headless `claude -p` / Agent-SDK / GH-Actions move to a metered monthly credit). ~3.5 weeks out from 2026-05-22. **This is the only externally-fixed date.** Everything else has no deadline → ordered by «cheap + unblocks-most» and dependency edges. N0 is a *meter, not a ban* — substrate is already weatherproof (`no-paid-llm-in-ci`); the storm hits only the dispatch/process layer.

## §2 — Tracks + ordering

### Track 0 — now, cheap, clears the table (days, ~$0)
| # | Task | Why now | Note |
|---|---|---|---|
| 0.1 | Commit books (facts + chronicle v3) + N8 patch + this doc | «don't lose plans» (session theme); currently uncommitted | maintainer commits |
| 0.2 | ✅ **CLOSED — companion = C** (both, on separate layers) | unblocks N7 | maintainer-delegated decision 2026-05-22 («Твоё решение»); rationale below |
| 0.3 | ✅ **CLOSED — promote via pointer** (cross-ref, not duplication) | plans «active» from canonical plan; SSOT stays single | maintainer-delegated 2026-05-22; see §5.2 |

### Track 1 — critical path to June 15 (maintainer's stated top priority: autonomy without extra spend)
| # | Task | When | Depends on |
|---|---|---|---|
| 1.1 | **N8 R-phase** (free: local-model dispatch / batch / caching / offload-sweep + «$ above subscription» estimate) | ✅ **DONE** (#158→staging, 2026-05-22) | — |
| 1.2 | **N0 decision** — how to stay autonomous + cheap, informed by 1.1 | ✅ **DONE 2026-05-22** (§5.3: defer-build + arm trigger) | 1.1 |
| 1.3 | **N8 A-phase** — apply cheap wins (migrate checks into hooks, autonomy hooks) | C1 startable now (correctness); cost-levers gated on the §5.3 utilisation trigger | 1.1; **D1/D2/D3 resolved by N0 §5.3** ([findings §7](research-patches/2026-05-22-n8-rphase-findings.md)) — was: maintainer gates |

### Track 2 — cheap, no deadline, parallel-safe
| # | Task | Note |
|---|---|---|
| 2.1 | N1 — niche-validation research (DeepWiki/WebSearch, $0) | parallel to 1.1 |
| 2.2 | N4b — design recommendation-moment gate | detector (N4a) already shipped; frontier |
| 2.3 | **Channel-earliness audit** — ✅ **DONE 2026-05-23** (PR #181) | retroactive sweep of every existing check vs «earliest reachable channel» (the sweep [channel-selection §6](../../.claude/rules/rule-enforcement-channel-selection.md) deferred). Findings: 55 surfaces classified (ADD-DUAL-CHANNEL 20 / ALREADY-AT-FLOOR 25); §10 DN-1..DN-4 resolved (see §5.4); follow-ups → Track M.5a/b/c + M.6 |

### Track 3 — after dependencies clear
| # | Task | Gate |
|---|---|---|
| 3.1 | N7 — dogfood companions | DECISION=C (0.2); overlaps N8 A3 |
| 3.2 | N5 — give the conscience back | after N7 |
| 3.3 | N6b — one-button install | last (after portable core + coexistence) |

### Track I — infra (independent of niche waves; maintainer-gated)
| # | Task | Note |
|---|---|---|
| I.1 | ✅ **DONE** — staging-trunk migration | shipped #144/#150; default = `staging`, `main` push-blocked, `ci-success` both; queue unavailable on repo → `strict:false` substitute |
| I.2 | Channel-selection wave → promote staging→main + SSOT #60–#63 | maintainer click |
| I.3 | DN-4 (15 stage-0 memory-codification gaps) | incremental, low priority, any window |

### Track M — channel-audit + mutation-hardening follow-ups (queued 2026-05-23; **M.1+M.4 DONE 2026-05-24**)

Origin: §5.4 decision record. All Track M items are cheap, deterministic (no paid LLM), no June-15 dependency. Maintainer-gated for launch.

| # | Task | Dependencies | Size |
|---|---|---|---|
| **M.1** | ✅ **DONE 2026-05-24** — codified **T20 «inline-verdict-without-evidence»** in `.claude/rules/ai-laziness-traps.md §2 T20` (NB: the actual codified trap is inline-verdict, not equivalence-claim; recommendation-laziness umbrella took the T20 slot — mutation-equivalence T-bump 20→21 still pending). | shipped #212 | tiny markdown |
| **M.2** | Commit-msg grep gate (`.husky/commit-msg`): if body mentions «equivalent» in mutation/survivor context AND no «tried: …» / «structural: …» sibling line → fail. Class B/C deterministic. | **M.1** (must cite T20) | small bash + 1 test |
| **M.3** | Channel-audit §10b follow-up patch: append DN-1..DN-4 closure inline to the merged research-patch (`docs/meta-factory/research-patches/2026-05-22-channel-earliness-audit.md`) | none | tiny markdown append |
| **M.4** | ✅ **DONE 2026-05-24** — **6 paired-negative bash-hook tests shipped** (`deps-hash-check` #195 / `end-of-turn-reminder` #196 / `ask-question-reminder` #197 / `check-doc-authority` #198 / `inject-session-bootstrap` #199 / `validate-prompt` #200). Stratified parallel ~45min wall-clock. | shipped | medium per hook; large umbrella |
| **M.5a** | Top-3 edit-time hooks (DN-2 batch 1): (a) manifest render-drift PostToolUse; (b) research-patch §1.7-substance + scope-annotation PostToolUse; (c) actionlint per-yml PostToolUse. **3 atomic PRs**, each requires `settings.json` wiring (agent-self-protected ⇒ maintainer-click) | **M.4** (test-first for the new hooks themselves) | medium per hook |
| **M.5b** | 17 pre-commit hooks (DN-2 remainder, batched). Extends `.husky/pre-commit` with path-filtered checks; fires per-commit not per-edit (~10× cheaper than edit-time per [§5.4 cost data](#§5.4)) | **M.5a** (validate the dual-channel pattern works on top-3 first before scaling to 17) | single batched PR |
| **M.5c** | Per-file zizmor PostToolUse on `.github/workflows/*.yml` + KEEP full-dir pre-push backstop (DN-4). Path-filter overlaps M.5a candidate (c) — consider folding | **M.4** | small; or fold into M.5a (c) |
| **M.6** | **P2 channel-audit** (DN-1 deferred): consumer-side eslint configs + `RULES.md` + dep-cruiser under `packages/core/templates/shared/` + `packages/preset-next-15-canonical/`. Headline candidate: `dependency-cruiser → eslint-plugin-boundaries` (BFR check ≥3 alternatives required) | **DEFERRED** — gated on consumer-side stabilization (no fixed date) | new audit umbrella |

**Sequencing edges (Track M):**

```text
M.1 (T20 trap) ──→ M.2 (commit-msg grep gate)
M.3 (DN closure patch) ──── independent ──── start anytime
M.4 (6 bash hook tests) ──→ M.5a (top-3 edit-time) ──→ M.5b (17 pre-commit)
                                              └────→ M.5c (zizmor) — or fold into M.5a (c)
M.6 (P2 audit) ──── DEFERRED ────
```

**Parallel-SAFE (different files, separate worktrees):** M.1 ∥ M.3 ∥ M.4 (different surfaces: `.claude/rules/` ∥ `docs/meta-factory/research-patches/` ∥ `packages/core/hooks/*.test.ts`). Inside M.4 itself, 6 sub-PRs are parallel-safe (different test files per hook) when run in separate worktrees.

**NOT parallel:**
- M.2 needs M.1 first (must cite the codified T20).
- M.5a needs M.4 first (test-first discipline — write the hook's test BEFORE adding the hook).
- M.5b needs M.5a (validate the pattern works at top-3 before scaling to 17).
- M.5a/b/c all serialize on `settings.json` wiring (one maintainer-click per new hook).

**Recommended launch order:** M.1 → M.3 → M.4 (parallel sub-PRs in worktrees) → M.5a → M.5b ‖ M.5c (or fold M.5c into M.5a (c)). M.6 when consumer side stabilizes.

**Rationale for the order:** M.1 + M.3 are zero-cost docs wins (clear the table). M.4 is the highest-yield gap discovered this session (6 load-bearing hooks without tests — exact git.ts pattern from Wave 3). M.5* depends on M.4 because the test-first discipline (project's principle 02 paired-negative-test) requires the hook's test to exist before the hook ships.

## §3 — Dependency edges (why this order)

- **N4a → N4b:** detector fixed (#98) → gate design unblocked.
- **N3 (done) + N6a (done) → N6b:** portable core + coexistence both landed → one-button is last build.
- **N7 gated on DECISION C; N5 follows N7** (know what's unique before giving back).
- **N8 R-phase feeds N0** (the cost/autonomy answer N0 lacked); **N8 A3 overlaps N7** (process-layer dispatch) and **N0 options a/e**.
- **Cost-first invariant:** all R-phases use free channels (DeepWiki/WebSearch/local) per [no-paid-llm-in-ci.md](../../.claude/rules/no-paid-llm-in-ci.md); paid build only after a free verdict.

## §4 — Recommended launch order (proposal)

1. **Track 0** (commit + 2 decisions) — clears dependencies, ~$0.
2. **1.1 N8 R-phase** ∥ **2.1 N1** — free research, feeds the only deadline.
3. **1.2 N0 decision** by June 15, then **1.3 N8 A-phase** high-ROI items.
4. **3.1 N7** (once DECISION=C) → **3.2 N5** → **3.3 N6b**.
5. **Track I** infra slotted whenever the maintainer chooses; non-blocking.

**Rationale:** N8 R-phase is free, feeds the single hard date (N0), and answers the maintainer's central concern (autonomous + minimal spend) → max value / min risk as the first launch. **Falsified if** the maintainer prioritises the N4b frontier or the staging-trunk infra migration over storm-economy — then Track 1 yields first place.

## §5 — Open maintainer decisions embedded above

1. ~~companion = A / B / C (gates N7) — 0.2~~ → **CLOSED 2026-05-22: C** (see §5.1)
2. ~~promote N0–N8 into `EXECUTION-PLAN.md` — 0.3~~ → **CLOSED 2026-05-22: pointer-promote** (see §5.2)
3. ~~staging-trunk migration: execute or hold — I.1~~ → **DONE 2026-05-22** (#144/#150)
4. first launch: ✅ **N8 R-phase launched + DONE** (#158, autonomous Queue-mode 2026-05-22) — §4 recommendation actioned
5. ~~N0 response: which cost lever + R4 bench go/no-go + offload priority — 1.2~~ → **CLOSED 2026-05-22: defer-build + arm utilisation trigger; R4 NO-GO** (see §5.3)

### §5.1 — Decision record: companion = **C** (closed 2026-05-22)

Maintainer-delegated («Твоё решение», /orchestrator session 2026-05-22). **C = both, on separate layers:** the enforcement substrate stays dependency-free / never coupled (=A posture — AI-agnosticism is the verified moat per N1+N0), while the dev/process layer dogfoods companions (=B posture). This is `build-first-reuse-default` applied per-layer.

- **B rejected for substrate:** coupling the substrate to a companion forfeits AI-agnosticism — the property N0 (June-15 metered storm) proved load-bearing.
- **Pure A rejected as sole posture:** maintaining homegrown orchestrator/reviewer/worktree skills when Superpowers `subagent-driven-development` + `using-git-worktrees` exist is `#parallel-evolution-creep` / `#adoption-shame` ([build-first-reuse-default.md §4](../../.claude/rules/build-first-reuse-default.md)).
- **C is what every artifact already presumes** (N7 shape; task 3.1 `DECISION=C`); it also folds N0 in — process-layer dogfooding ⊇ the storm-migration target.
- **Falsified if** the layers prove inseparable, or AI-agnosticism turns out not to be the moat — neither holds (substrate = `packages/core/principles/*` + `.husky/` + deterministic bash; process = swappable markdown skills; moat verified N1 PR #102 / N0).

**Unblocks:** N7 (task 3.1) and N2's already-completed vocab alignment. The prior memory claim of «decided #103 2026-05-21» was premature — surfaced-not-closed in [research-patches/2026-05-21-niche-strategy-and-growth-roadmap.md §line 95](research-patches/2026-05-21-niche-strategy-and-growth-roadmap.md); this §5.1 is the formal closure.

### §5.2 — Decision record: 0.3 promote = **pointer, not duplication** (closed 2026-05-22)

Maintainer-delegated («Твоё решение», /orchestrator 2026-05-22). N0–N8 are promoted into [EXECUTION-PLAN.md](EXECUTION-PLAN.md) **by cross-reference** — a "Post-1.0 growth waves N0–N8" pointer under Phase 9+ naming this `wave-sequencing-plan.md` as ordering-SSOT (incl. §0 status snapshot) and the two research-patches as content-SSOT.

- **Why pointer, not full inline:** inlining N0–N8 as phases would create a *second* sequencing authority inside EXECUTION-PLAN, duplicating this doc → guaranteed drift (`#contradicting-authority-claims` / `#two-prompts-drift`). Doc-authority hierarchy + build-first-reuse (DRY) favour single-source. The pointer makes the waves *active/discoverable from the canonical plan* without copying content.
- **Effect:** EXECUTION-PLAN now references the active growth waves; this doc + patches remain the live trackers (each keeps its `Authoritative-for` header).
- **Falsified if** the maintainer wants N0–N8 *inlined* as full phases and this doc retired into one tracker — a larger restructure not implied by 0.3; redirect and I'll inline instead.

### §5.3 — Decision record: N0 response = **defer-build + arm utilisation trigger** (closed 2026-05-22)

Maintainer-delegated (/orchestrator «N0 decision, го итеративно и автономно», 2026-05-22). The June-15 change is a **meter on the headless/programmatic dispatch layer, not a removal** — `claude -p` stays supported (verified, [niche-roadmap, Wave N0 section](research-patches/2026-05-21-niche-strategy-and-growth-roadmap.md)). N0 resolves the three [findings §7](research-patches/2026-05-22-n8-rphase-findings.md) decisions D1/D2/D3.

**D1 — cost lever → defer ALL options + arm a trigger (no optimisation build now; Option A was *not* selected — the verdict is status-quo until the trigger fires, then jump to Option B).**
- The enforcement substrate never touched `claude -p` and is weatherproof by [no-paid-llm-in-ci](../../.claude/rules/no-paid-llm-in-ci.md) — load-bearing fact, not at risk.
- At the current ~10 sessions/month load the metered spend is negligible *even fully unoptimised* (findings §3: ≈$13.50/mo → ~6.8% of a $200 credit; the 50-session scaling ceiling is ≈$67.50/mo → ~34% unoptimised, dropping to ≈$33–40 → ~17–20% only *after* the Option-B levers are applied). Building Option B's routing classifier or Option C's local dispatcher now is premature-BUILD for a cost problem that does not yet bind (`#own-stack-blind-spot` / [build-first-reuse-default §4](../../.claude/rules/build-first-reuse-default.md)). Note the findings' own irony flag: the routing classifier itself burns tokens.
- The one cheap ADOPT — prompt caching via SDK `cache_control` (the prompt-caching row proposed in findings §7; renumbers to **#66+** per the §0 SSOT-ID collision note, not yet landed) — is **folded into any future programmatic-dispatcher work, not built standalone**: interactive Claude Code already caches automatically, so there is nothing to "adopt" until a headless/SDK path exists.
- **Armed trigger (revisit → execute Option B = caching + batch + Haiku routing):** Agent-SDK credit utilisation > ~50% of plan in any month, **OR** the maintainer commits to unattended headless loops (`claude -p` cron / GitHub Actions). Until then: pay-the-meter-as-billed, monitor utilisation.

**D2 — R4 local-model bench → NO-GO now (REFERENCE-only).**
- Local-model dispatch stays the findings §7 local-model row (REFERENCE → conditional-BUILD; renumbers to #66+ per the §0 collision note). Capability floor is INCONCLUSIVE — arXiv 2604.02367 front-door routing (0.793 acc) is an *adjacent* problem class, not our session-loop dispatch (`#pattern-matching-on-name`, [ai-laziness-traps §2 T16](../../.claude/rules/ai-laziness-traps.md)). A 2–3-week bench for a problem that does not bind at current scale is not justified.
- Gate the bench on the **same trigger** as D1's escalation to Option C.

**D3 — R1 offload migration priority → decoupled from N0 (→ N8 A-phase).**
- This is N8 A-phase sequencing, already maintainer-gated in §0; not an N0 blocker. The N0 cost-urgency answer is "defer", but the *correctness* value of deterministic offload is independent of billing. Recommended A-phase order by correctness ROI (not cost): **C1** (SSOT existence check — strengthens the substrate regardless of the meter) first, then C2, C4, C3, C5 per findings §7 D3.

**Open factual question (does not change the verdict):** whether inline `Agent`/Task-tool subagents spawned *inside* an interactive `claude` session bill against the interactive pool or the metered credit is **officially undefined**. Checked this closing /orchestrator session (2026-05-22) via `claude-code-guide` against the Anthropic help-center article ([support.claude.com/.../15036540](https://support.claude.com/en/articles/15036540-use-the-claude-agent-sdk-with-your-claude-plan)): the article draws the billing line at the *entry point* (interactive terminal/IDE explicitly stays on the subscription; SDK / `-p` / Actions metered) and is **silent on the interactive→subagent hybrid** — a documented gap, not a confirmed rule; the only public read (third-party) leans "likely SDK-billed, unconfirmed". This is the broader billing-change verification (niche-roadmap §N0 Task 0, 2-channel) extended to the hybrid sub-case, which that prior check did not cover. If it resolves to "interactive subagents ARE metered" the urgency rises — but the armed utilisation trigger already catches that, so the verdict is robust either way.

**Falsified if:** the maintainer wants an unattended `claude -p` / Actions autonomous loop *now* (→ jump straight to Option B, don't wait for the trigger); or session rate jumps to 50+/month before June 15 (trigger fires immediately). Neither holds at 2026-05-22.

**§1.7 forward-check:** complies with [no-paid-llm-in-ci](../../.claude/rules/no-paid-llm-in-ci.md) (zero CI-side paid calls; substrate untouched), [build-first-reuse-default](../../.claude/rules/build-first-reuse-default.md) (defers BUILD of dispatcher/router/local-model until evidence justifies; ADOPT caching folded into future work), [reviewer-discipline §2](../../.claude/rules/reviewer-discipline.md) (maintainer-delegated; records the delegated call, does not self-initiate strategy). No new rule introduced → no backward sweep required.

### §5.4 — Decision record: channel-audit §10 DN's + mutation-hardening follow-up queue (closed 2026-05-23)

Maintainer-confirmed (/orchestrator 2026-05-23, after PR #181 + #183 merged). Two umbrella'и shipped in the same session — **channel-earliness audit** (PR #181, squash `f50fc3b`, the retroactive sweep `rule-enforcement-channel-selection.md §6` deferred) + **Stryker mutation hardening** (PR #183, squash `2cfec37`, 4 SDD-волны across eslint-rules / hooks/checks / hooks/utils / audit-self) — and the open items reduced to the ordered Track M queue (see §2).

**Channel-audit §10 DN decisions:**

- **DN-1 — scope:** P1 only (this audit covered the framework's OWN 55 checks). P2 (shipped consumer-side config — eslint / `RULES.md` / dep-cruiser under `templates/` + `preset-next-15-canonical/`) — separate audit umbrella, **planned but deferred** to Track M.6; gated on consumer-side stabilization (no fixed date).
- **DN-2 — 20 ADD-DUAL-CHANNEL candidates split by per-edit cost:** **top-3** at edit-time (manifest render-drift, research-patch §1.7-substance, actionlint per-yml — high match frequency, ~84–244ms cost justified) + **17 at pre-commit** (not deferred — fires per-commit not per-edit, ~10× cheaper while still earlier than CI). Maintainer override of original «defer 17» on grounds that **measured** per-edit cost (15–244ms per hook × 20 = 400ms-1s/edit if all edit-time — Claude Code runs PostToolUse hooks sequentially, not parallel) makes top-3 vs all-20 a real trade-off that the pre-commit middle ground resolves. → Track M.5a + M.5b.
- **DN-3 — recurring sweep:** iterative **delta-sweep** on new checks (re-run when ≥5 new checks added OR a channel-mismatch incident fires; not on a schedule). Maintainer override of original «one-shot» lean on grounds that the 20 ADD candidates *are* yield (iteration has measurable value), not noise — but only on the *delta*, not full re-run.
- **DN-4 — per-file zizmor edit-time companion:** **ADD** + KEEP full-dir pre-push backstop. Maintainer invoked [feedback_no_human_verification_ai_self_verifies] — earlier-is-always-better principle; partial-check theatre risk muted by keeping the late gate (this is the standard ADD-DUAL-CHANNEL pattern from the audit itself). → Track M.5c (potentially fold into M.5a candidate (c) — path-filter overlap).

**Mutation-hardening pattern codification (triggers Track M.1 + M.2):**

Cold Reviewer caught Worker over-eager «equivalent» dismissals in 3 of 4 waves (Wave 1 L47 DFS guard / Wave 2 L148 regex anchor / Wave 4 L306 mtime comparison + L161 execSync). Each had a real killing input (sparse-array `[, 1]`; trailer no-leading-space + internal-space at boundary; `fs.utimesSync(p, t, t)` for exactly-equal mtimes; tightened message assertion). Meets [ai-laziness-traps.md §5](../../.claude/rules/ai-laziness-traps.md) promotion threshold («2+ wave-specific T-additions describe same failure mode → abstract into §2»). Wave 3 (where the Worker had absorbed the lesson) was the only first-try-GO — the lesson is real, generalizes, codifies cleanly.

**Empirically grounded bash-hook coverage gap (triggers Track M.4):**

Post-PR-#183 audit on `origin/staging` (2026-05-23): **9 bash hooks** total under `.claude/hooks/`, **3 with dedicated test files** (`check-hook-marker`, `check-kickoff-traps`, `inject-matching-rule`), **6 without** (`ask-question-reminder`, `check-doc-authority`, `deps-hash-check`, `end-of-turn-reminder`, `inject-session-bootstrap`, `validate-prompt`). Same latent-theatre pattern as Wave 3 `git.ts` (load-bearing utility under all pre-push checks, had 0 tests until Wave 3 created `git.test.ts`). The 6 untested hooks include `check-doc-authority` (the project's flagship edit-time gate per the README invariant) — testing it is high-priority.

**Falsified if:** measured per-edit cost numbers prove off when 20+ hooks land (re-measure, bump match-frequency bar before promoting more to edit-time); OR DN-4 per-file zizmor adds noticeable noise to AI sessions (demote to pre-commit); OR the bash-hook test gap turns out to be covered by indirect integration tests already in place (verify before duplicating work).

**§1.7 forward-check:** Track M complies with [no-paid-llm-in-ci](../../.claude/rules/no-paid-llm-in-ci.md) (queue is fully deterministic — bash hooks, markdown trap entries, grep gates), [build-first-reuse-default](../../.claude/rules/build-first-reuse-default.md) (M.5* reuses existing PostToolUse hook pattern + `render-rules.ts` engine — no new dependency; T20 codification reuses ai-laziness-traps catalogue, no new mechanism), [reviewer-discipline §2](../../.claude/rules/reviewer-discipline.md) (maintainer-delegated decisions recorded, not self-initiated strategy). No new rule introduced by this decision record itself → no backward sweep required; M.1 introduces T20 (covered by ai-laziness-traps §5 promotion process).

## §6 — Parallelism + dependency matrix (orchestrator-facing)

### Dependency edges (`X → Y` = Y cannot start until X done)
```text
N4a (done, #98) ──────────────→ N4b (recommendation gate)
N3 (done) + N6a (done) ───────→ N6b (one-button install)
DECISION=C (0.2) ─────────────→ N7 (dogfood) ──→ N5 (give-back)
N8 R-phase (1.1) ─────────────→ N0 decision (1.2)
                └─→ D1·D2·D3 (findings §7) ──→ N8 A-phase (1.3)
N8 A3 (hybrid dispatch) ⇄ N7   (overlap — coordinate, don't double-build)
```

### Parallel-SAFE (run concurrently — independent surfaces, separate output files)
| Group | Items | Condition |
|---|---|---|
| **G1 — research** | 1.1 N8 R-phase ∥ 2.1 N1 ∥ 2.2 N4b design | each writes its **own** research-patch file; all free (DeepWiki/WebSearch/local) |
| **G2 — maintainer decisions** | ~~0.2 companion A/B/C~~ (CLOSED=C), 0.3 promote→EXECUTION-PLAN, I.1 staging-trunk go/hold | not orchestrator work; happen async, parallel to anything |

**Hard precondition for ANY parallel AI sessions:** each runs in its **own `git worktree`** (per [parallel-subwave-isolation.md](../../.claude/rules/parallel-subwave-isolation.md) — shared dir caused branch contamination in Wave 8.1) + `node_modules` symlink in the worktree (tsx hooks fail otherwise). If worktree-add fails → **sequential fallback**, never concurrent shared-dir.

### NOT parallel — serialize or partition file scopes
| Conflict | Items | Why | Mitigation |
|---|---|---|---|
| **Shared SSOT** | N1 + N8 both may append `prior-art-evaluations.md` | append-only register; concurrent appends collide | serialize the SSOT-append step, or one session owns it |
| **Shared tracker** | 0.3 promote + any wave editing `EXECUTION-PLAN.md` | same file | do 0.3 first, alone |
| **A-phase code** | 1.3 N8 A + 3.1 N7 both touch `.claude/hooks/` + `packages/core/` | same surfaces | partition file scopes up front, or serial |
| **Infra (solo)** | I.1 staging-trunk migration | rewrites branch-protection / workflows / `git-safety.sh` | **must run solo** — never concurrent with auto-merge waves |

### Plain-language rule of thumb
- **Research/design = parallel-safe** (different docs) → fan-out in worktrees.
- **Anything writing the SAME canonical file** (SSOT, EXECUTION-PLAN, hooks) = serial or partitioned.
- **Infra that changes git/CI config = solo.**
- **Decisions block their dependents** — 0.2 (companion) CLOSED=C → N7 unblocked; finish 1.1 (N8 R) before 1.2/1.3.

## §7 — Orchestrator entry point (does it know the next action?)

**Knows the ORDER + DEPENDENCIES:** yes — §2/§4/§6 of this doc. An orchestrator session reading `wave-sequencing-plan.md` has the full map.

**Has a turnkey NEXT-ACTION queued:** **no — not yet.** None of N0–N8 has a written kickoff. Kickoffs live in `.claude/orchestrator-prompts/<wave>/kickoff.md` (gitignored, ephemeral — authored at launch, not stored durably).

**So the orchestrator's literal next step at launch:**
1. Maintainer picks the first wave (recommended: N8 R-phase, §4).
2. Orchestrator authors that wave's kickoff **from this plan + the wave's research-patch** (cite [ai-laziness-traps.md §2](../../.claude/rules/ai-laziness-traps.md) T-enumeration per kickoff obligation).
3. If fanning out G1 in parallel → worktree-per-session + file-scope partition (§6).
4. Dispatch; workers self-verify; orchestrator accepts on evidence.

**Bottleneck to flag:** the durable plan is this doc; the kickoff is written fresh at launch. Until a kickoff exists, the orchestrator cannot dispatch — it can only plan. That kickoff is the one missing turnkey artifact between «plan recorded» and «work running».

## §8 — See also

- [wave-orchestrator-kickoff.md](wave-orchestrator-kickoff.md) — orchestrator's operating instructions to execute this plan (per-wave loop, rails, decisions it must not make).
- [research-patches/2026-05-21-niche-strategy-and-growth-roadmap.md](research-patches/2026-05-21-niche-strategy-and-growth-roadmap.md) — N0–N7 content + §5 sequencing (this doc extends it with N8 + dates + infra).
- [research-patches/2026-05-22-deterministic-offload-autonomy-economy.md](research-patches/2026-05-22-deterministic-offload-autonomy-economy.md) — N8 content.
- [automerge-staging-plan.md](automerge-staging-plan.md) — infra track I.1 detail.
- [.claude/rules/no-paid-llm-in-ci.md](../../.claude/rules/no-paid-llm-in-ci.md) — cost-first invariant on every R-phase.
- [.claude/rules/reviewer-discipline.md](../../.claude/rules/reviewer-discipline.md) — admission/order = maintainer call; this doc proposes, does not decide.
