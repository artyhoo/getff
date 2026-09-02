<!-- scope:plugin-packaging -->
# CC plugin packaging (superpowers-style, hybrid) — design spec

> **Status:** brainstorm output, awaiting maintainer spec-review → writing-plans.
> **Date:** 2026-06-22.
> **Authoritative for:** the design of packaging rules-as-tests-aif as a Claude-Code-first plugin distributed through an in-repo marketplace, superpowers-style; the soft-layer/hard-layer split (plugin payload vs `install.sh` enforcement); the hook path-translation refactor (`$CLAUDE_PROJECT_DIR` vs `${CLAUDE_PLUGIN_ROOT}`); the consumer-facing shippable-set triage; the multi-harness adapter layout (CC-first + graceful degradation to non-CC); the recursive self-test that enforces plugin-manifest integrity.
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists). The framework deploy mechanics — those stay in [`install.sh`](../../../install.sh). The `./setup` orchestration — that stays in [one-click-installer design](2026-05-31-one-click-installer-design.md). Build-vs-reuse macro discipline — see [build-first-reuse-default.md](../../../.claude/rules/build-first-reuse-default.md). Companion/external-service install — see [companion-install-principle.md](../../../.claude/rules/companion-install-principle.md).

---

## §1 Problem

Today rules-as-tests-aif ships through one entry point — `install.sh` (89 KB) — which copies skills/agents/templates into a consumer repo **and** wires the hard 5-channel enforcement (git hooks via `.husky`, `package.json` devDeps, ESLint configs, CI workflows). That is the project's most hardened surface and it must not regress.

But there is **no plugin-native distribution**. A user on Claude Code cannot do what they can with superpowers:

```text
/plugin marketplace add obra/superpowers-marketplace
/plugin install superpowers@superpowers-marketplace
```

…and instantly get the skills/agents/session-hooks, with skills that **auto-trigger** (no manual `Skill` invocation) because a `SessionStart` hook injects a bootstrap. The closest we have is `extension.json` (an AIF/Gemini best-effort manifest, schema still in draft) and the raw `install.sh`.

**Goal:** ship a Claude-Code plugin (CC-first, all CC features) installable from an **in-repo** marketplace, that delivers the *soft layer* the plugin format supports, and reaches the *hard layer* through an `install.sh` seam (the plugin fetches the project's own official installer — §6 Option C) — **superpowers-style**, with graceful degradation to non-CC harnesses (OpenCode et al.). No regression to the existing `install.sh` path.

## §2 The load-bearing distinction — two layers, two channels

The project ships two structurally different kinds of artifact. The plugin format covers exactly one of them.

| Layer | Artifacts | Runs… | Plugin format covers it? |
|---|---|---|---|
| **Soft (session-scoped)** | skills, sub-agents, session hooks (advisory/inject), `commands/`, optional MCP | inside the agent session | **Yes** — `skills/`, `agents/`, `hooks/hooks.json`, `commands/`, `.mcp.json` |
| **Hard (repo-scoped enforcement)** | `.husky` pre-commit/pre-push git hooks, `package.json` devDeps, ESLint/vitest/stryker configs, CI workflows | in the consumer's git/CI infra | **No** — a plugin never mutates the consumer repo's git/CI |

This is the same insight already encoded in [dual-implementation-discipline.md §3](../../../.claude/rules/dual-implementation-discipline.md) (internal-vs-consumer triage) and [companion-install-principle.md §1](../../../.claude/rules/companion-install-principle.md) («our installer installs only our own artefacts»). The plugin **is** the clean delivery for the soft layer; `install.sh` stays the only thing that touches git/CI. The hybrid is the bridge between them (§6).

**Anti-trap (T16):** «plugin» sounds like it replaces `install.sh`. It does not. A plugin that promised the 5-channel enforcement would be lying — exactly the failure the project's own thesis exists to prevent. The plugin honestly delivers soft + a *command* to invoke the hard installer; the README must state this boundary explicitly (the same honesty fix the 2026-06-19 project evaluation recommended for the edit-time channel).

## §3 superpowers patterns to adopt (verbatim where the verdict allows)

Per [build-first-reuse-default.md §1](../../../.claude/rules/build-first-reuse-default.md), every borrowed capability gets an explicit verdict. Evidence base: the live superpowers + superpowers-marketplace repos, read 2026-06-22.

| # | Pattern (superpowers) | Verdict | Note |
|---|---|---|---|
| 1 | `.claude-plugin/plugin.json` manifest (name/desc/version/author/keywords) | **ADOPT** | Official CC schema; verbatim shape. |
| 2 | `hooks/hooks.json` — `SessionStart` matched on `startup\|clear\|compact`, command via `${CLAUDE_PLUGIN_ROOT}` | **ADOPT** | The auto-context-injection seam. |
| 3 | `hooks/run-hook.cmd` — polyglot Windows/Unix wrapper + **extensionless** hook script names (dodges CC's Windows «prepend bash to anything `.sh`» auto-detect) | **ADOPT** (audited, not blind-copied — T13) | 36 lines; copy + add our own tests. |
| 4 | `using-superpowers` meta-skill — injected at session start, makes skills mandatory/auto-triggering | **ADAPT** → `using-rules-as-tests` | Our content; their mechanism. The single most important UX lever. |
| 5 | `marketplace.json` (`name`/`owner`/`metadata`/`plugins[]` with `source`) | **ADOPT** | In-repo (per maintainer decision), not a separate repo. |
| 6 | Per-harness adapter dirs (`.codex-plugin/`, `.cursor-plugin/`, `.opencode/`, `gemini-extension.json`) all pointing at one shared `skills/` body | **ADAPT** | CC-first now; OpenCode + others as thin later adapters. Our `AGENTS.md` + `extension.json` are the predecessors. |
| 7 | Skill-delivers-action pattern (e.g. `using-git-worktrees` runs setup) | **ADOPT** | This is how the hard-layer install is delivered (§6) — «like superpowers». |

`extension.json` (our existing AIF manifest) is **REFERENCE / predecessor** — it already declares the shippable skill/agent/template set; §5 reuses it as the source of truth rather than re-deriving the list.

## §4 Layout — separate the plugin payload from repo-internal tooling

The repo's own `.claude/` is the **maintainer's dev harness** (14 hooks, `orchestrator-prompts/`, internal skills like `.claude/skills/dispatcher` / `.claude/skills/pipeline`). Installing the plugin must **not** drag that into a consumer. So the plugin payload is a dedicated subtree; the in-repo marketplace points its plugin `source` at that subtree.

```text
rules-as-tests-aif/                         (existing repo — internals untouched)
├── .claude-plugin/
│   ├── plugin.json                         ← NEW: manifest
│   └── marketplace.json                    ← NEW: in-repo marketplace (1 plugin, source → ./plugin)
├── plugin/                                 ← NEW: the plugin payload root (what consumers get)
│   ├── hooks/
│   │   ├── hooks.json                      ← session hooks, ${CLAUDE_PLUGIN_ROOT}
│   │   ├── run-hook.cmd                    ← ADOPT (§3 #3)
│   │   └── <relocated shippable hooks>     ← extensionless, self-resolving dir (§5)
│   ├── skills/
│   │   ├── using-rules-as-tests/SKILL.md   ← NEW meta-bootstrap (§3 #4)
│   │   ├── rules-as-tests/                 ← from skills/rules-as-tests (already consumer-facing)
│   │   ├── installing-enforcement/SKILL.md ← NEW: the hard-layer seam (§6)
│   │   └── tool-bootstrapping/             ← ADDED 2026-09-03 (m1 trigger fired — note below)
│   ├── agents/                             ← consumer-facing subset only (§5)
│   ├── commands/
│   │   └── install-enforcement.md          ← NEW: /rules-as-tests:install-enforcement
│   └── install/                            ← fetch-and-wire.sh (thin seam — fetches the official install.sh; Option C, §6)
├── .opencode/INSTALL.md                    ← LATER: graceful-degradation adapter
├── extension.json  AGENTS.md  install.sh   ← unchanged
└── …
```

> **Open detail to verify in the plan:** marketplace `source` for a plugin co-located in the same repo. The CC marketplace schema supports a relative/`directory` source; confirm the exact key (`"source": "./plugin"` vs `{"source":"directory","path":"plugin"}`) against [plugins-reference](https://docs.claude.com/en/docs/claude-code/plugins-reference) before S1 ships — do not guess (T3).

**Install UX (target):**
```text
/plugin marketplace add <user>/rules-as-tests-aif      # in-repo marketplace
/plugin install rules-as-tests@rules-as-tests-aif      # soft layer, instantly
/rules-as-tests:install-enforcement                    # opt-in: wires git-hooks + CI into THIS repo
```

## §5 The path-translation refactor (the engineering core)

Current shipped hooks assume they live **in the consumer project** because `install.sh` copies them there — they reference `$CLAUDE_PROJECT_DIR/.claude/hooks/…`. A plugin hook instead lives in the **plugin install dir**, addressed by `${CLAUDE_PLUGIN_ROOT}`. Both env vars are available to CC plugin hooks; the refactor is to classify every shippable hook's paths:

- **plugin-data paths** (logic, templates, the hook's own siblings) → `${CLAUDE_PLUGIN_ROOT}/…`
- **project-data paths** (the consumer's `.claude/rules/*.md`, files being edited, the repo being audited) → `$CLAUDE_PROJECT_DIR/…`

This is a **per-hook audit**, not a blanket find/replace — many hooks legitimately need the consumer dir (e.g. `inject-matching-rule.sh` reads the consumer's rules; `check-doc-authority.sh` audits consumer files). Blind-swapping one env var for the other breaks them (see trap T-PLUG-A in the kickoff).

**Shippable-set triage** (reuse `extension.json` as SSOT, reconcile with the Artifact Ownership Contract in [CLAUDE.md](../../../CLAUDE.md) + dual-implementation §3):

| Class | Examples | Ships in `plugin/`? |
|---|---|---|
| Consumer-facing skills | `rules-as-tests`, `tool-bootstrapping` | yes |
| Consumer-facing agents | `review-sidecar`, `living-docs-auditor` (declared in `extension.json`) | yes |
| Consumer-facing agent — needs SSOT add | `compliance-verifier` (consumer-facing per CLAUDE.md Artifact Ownership Contract, but **NOT** yet in `extension.json`) | yes — **S4 must add it to `extension.json`**, do not claim «per extension.json» until then |
| Consumer-relevant session hooks | the advisory/inject subset that operates on consumer files | yes (relocated per above) |
| **Maintainer-internal** | `adopt-orchestrator-prompts.sh`, `runtime-bridge-dispatch.sh`, `dispatcher`/`pipeline` skills, `orchestrator-prompts/` | **no** — internal dev harness |

> **Skills row resolved (2026-09-03) — `tool-bootstrapping` now ships.** This table said it ships; the tree above (as first built) listed three skills without it, and [`plans/2026-06-22-cc-plugin-packaging.md:135`](../plans/2026-06-22-cc-plugin-packaging.md) Task 3 Step 4 is why: «ship only `rules-as-tests` in v1 … `tool-bootstrapping` stays OUT of v1 (**promote to a follow-up only if a need surfaces**)». The implementation followed the plan, correctly, and the table sat contradicted for ten weeks. **The trigger has since fired, from inside the plugin's own payload:** the plugin ships the `deps-hash-check` session hook (`plugin/hooks/hooks.json:32`), whose twin at `plugin/hooks/deps-hash-check:299` emits «… — run /tool-bootstrapping to re-evaluate» into a plugin user's session on any manifest change. The plugin was therefore instructing its users to run a skill it did not ship — a shipped instruction that cannot execute, the failure class [README.md#why-this-exists](../../../README.md#why-this-exists) exists to prevent. Everything that built that need postdates the June plan (tool-bootstrap layer revived four days later; the deps-hash hooks landed in July; hook twinning into `plugin/` later still), so this is the plan's own promotion path completing, not an override of it. `rule-research` and `rule-tests` stay OUT on a different ground — honesty, not cost: both are installer-bound by their own text (`rule-research/SKILL.md:24` ends its protocol in `./setup --full`; `rule-tests/SKILL.md:23` reads per-backend files it states are «NOT delivered to consumers»). The set is no longer prose-only — principle 24 arm (g) gates both its membership and its fidelity to `skills/`.

The triage output is itself a reviewable artifact; shipping the whole `.claude/` is trap T-PLUG-B.

## §6 The hybrid seam — «like superpowers»

superpowers delivers actions through skills (a skill *does* the thing). We mirror that for the hard layer:

1. The plugin ships a **thin seam** — `plugin/install/fetch-and-wire.sh` — that **fetches the project's own official `install.sh`** (default ref: the stable `main` branch, which carries the current hardened installer; `RAT_INSTALL_REF`/`RAT_INSTALL_SOURCE` override) and runs it against `$CLAUDE_PROJECT_DIR`. It does **not** bundle a copy of `install.sh` + payload. **Ref decoupled from the plugin version (S8):** the framework's release tags (`v0.2.0`/`v0.3.0`) lag `staging` by weeks, so pinning the fetch to `v<plugin-version>` would ship a stale `install.sh` missing the hardening fixes — track `main` instead; a reproducible per-plugin tag is a future maintainer release action.
2. A skill `installing-enforcement/SKILL.md` (gerund naming, superpowers house style) documents and gates the operation.
3. A slash command `commands/install-enforcement.md` → `/rules-as-tests:install-enforcement` runs the seam **dry-run first**, shows the plan, consent-gates `[y/N]`, then `--apply` (the installer is idempotent + `--dry-run`-honest).

> **Decision — fetch, not bundle (Option C, 2026-06-22, maintainer).** S5 design surfaced that `install.sh`'s preflight hard-aborts unless its **full** shipped-artefact payload is present (agents/, skills/, presets/, `.claude/skills/{pipeline,dispatcher,…}`). So «bundle `install.sh`» would mean committing ~2MB of the framework under `plugin/install/` — duplicating the plugin's own skills/agents **and** carrying the `dispatcher`/`pipeline` dev-harness the §5 triage marks *not shipped*, plus exposing that copy to repo-wide CI scans. The re-implement-a-thin-wirer alternative was rejected (it would discard `install.sh`'s battle-hardened wiring — fixes #532/#533/#635 — a `#parallel-evolution-creep` violation). **Verdict: fetch the official installer** (`fetch-and-wire.sh`, source overridable via `RAT_INSTALL_SOURCE` for forks/offline/tests). Reuses `install.sh` **verbatim** (zero drift), keeps the plugin thin, ships no dev-harness, and matches [companion-install-principle.md](../../../.claude/rules/companion-install-principle.md) («install via the official top-level installer»). Cost: a network fetch at command time — acceptable for an explicitly opt-in, one-time action; offline users set `RAT_INSTALL_SOURCE` to a local checkout.

Result: one `/plugin install` makes the soft layer live immediately; one command opt-in-wires the hard 5-channel enforcement into the current repo. Single distribution, both layers reachable, honest boundary. This satisfies [companion-install-principle.md](../../../.claude/rules/companion-install-principle.md) (own installer installs own artefacts; free-on-subscription, no paid default).

## §7 Recursive self-application — the plugin must enforce its own integrity

The project's signature is «documents lie; tests don't», applied to itself. The plugin packaging gets a companion **principle test** (next free slot, e.g. `packages/core/principles/<N>-plugin-manifest-integrity.test.ts`) asserting mechanically:

- every skill/agent/command referenced by `plugin.json`/`marketplace.json` **exists** on disk;
- `marketplace.json` plugin version **== ** `plugin.json` version (no drift);
- every hook in `plugin/hooks/` addressing plugin-data uses `${CLAUDE_PLUGIN_ROOT}` (grep: no hardcoded plugin-relative `$CLAUDE_PROJECT_DIR/.claude/hooks/…`);
- every shipped hook carries the dual-implementation marker (`@dual-pair`/`@cc-only-rationale`) per [dual-implementation-discipline.md §6](../../../.claude/rules/dual-implementation-discipline.md);
- shipped agents pass the existing **`packages/core/principles/21-shipped-agent-tools-valid.test.ts`** (the one that would have caught bug #551: unresolvable tool names — note slot 21 is shared with `21-agnosticism-conformance.test.ts`, so cite the full filename).

Plus **paired-negative sanity** (per `discipline-self-check.yml` precedent): a fixture with a deliberately broken manifest must fail the test. This is what makes the packaging itself non-theatre.

## §8 Multi-harness — CC-first, degrade gracefully (maintainer decision)

CC gets the full feature set (all hooks, commands, MCP). Non-CC harnesses (OpenCode and the rest) get the **portable substrate** the project already proved portable (`21-agnosticism-conformance.test.ts`; skills self-resolve via `$(dirname "${BASH_SOURCE[0]}")`). Concretely:

- **Now (S1–S6):** `.claude-plugin/` perfect; `AGENTS.md` already carries the cross-harness instruction layer.
- **Later (S7):** thin `.opencode/INSTALL.md` adapter (superpowers' OpenCode pattern: «fetch + follow INSTALL.md»), pointing at the same `plugin/skills/` body. The one accepted off-CC degradation: session-hook auto-injection may not fire — the meta-skill is then read on demand, exactly the posture in [dual-implementation-discipline §3 posture-reconciliation](../../../.claude/rules/dual-implementation-discipline.md). Not a portability gap — a documented degradation.

## §9 Stage map (bite-sized; the kickoff orchestrates this)

| Stage | Deliverable | Acceptance (verifiable) | Parallel? |
|---|---|---|---|
| **S0** | This spec + prior-art SSOT entry (superpowers, extension.json, CC-plugin-docs) | SSOT entry with Verdict/Rationale/Trigger; principle 08 green | — |
| **S1** | `.claude-plugin/plugin.json` + `marketplace.json` + `plugin/` skeleton + `run-hook.cmd` (ADOPT) | `/plugin marketplace add .` loads; manifest schema-valid; marketplace `source` key verified against docs | no (foundational) |
| **S2** | Hook relocation: triage 15 hooks; convert shippable ones to extensionless + self-resolving + correct env vars + `hooks.json` | shipped hooks fire from plugin root in a throwaway consumer repo; no mis-rooted paths; markers present | no |
| **S3** | `using-rules-as-tests` meta-bootstrap skill + `SessionStart` wiring; assemble shippable `skills/` | fresh session in throwaway repo surfaces bootstrap; skills discoverable via Skill tool | yes w/ S4 (disjoint) |
| **S4** | Ship consumer-facing agent subset (add `compliance-verifier` to `extension.json`); pass `21-shipped-agent-tools-valid.test.ts` | agents resolve; `21-shipped-agent-tools-valid.test.ts` green | yes w/ S3 |
| **S5** | Hybrid seam: thin `fetch-and-wire.sh` (fetches the official `install.sh`, Option C §6); `installing-enforcement` skill + `/install-enforcement` command | command dry-run-wires git-hooks/CI into a throwaway repo (offline via `RAT_INSTALL_SOURCE`); consent-gated | no (needs S1) |
| **S6** | Recursive self-test: `<N>-plugin-manifest-integrity.test.ts` + paired-negative fixture + doc-authority headers on new shipped docs | principle test green; negative fixture fails; principle 09 green | no (needs S1–S5) |
| **S7** | OpenCode adapter + reconcile `extension.json`/`AGENTS.md` | OpenCode INSTALL path documented; skills load off-CC | yes |
| **S8** | README install section (superpowers-style per-harness) + version bump + integration PR + `done.md` | e2e: marketplace add → install → skills active → `/install-enforcement` wires hard layer | no (last) |

Stage-gate (Phase -1 cold-review + merge check) between every stage.

## §10 Prior-art / capability-commit obligations

Some stages cross the capability-commit LOC threshold (`run-hook.cmd`, the principle test, the install command). Each such commit carries a `Prior-art:` trailer per [CLAUDE.md «Build-vs-reuse invariant»](../../../CLAUDE.md). New SSOT entries (S0): **superpowers plugin/marketplace pattern** (ADOPT — official CC schema, verbatim shape), **superpowers `run-hook.cmd`** (ADOPT, audited), **`using-superpowers` bootstrap** (ADAPT — our content), **CC plugins-reference** (REFERENCE). No paid-LLM-in-CI implication — bash + JSON + TS test only.

## §11 «🟢 Простыми словами»

Сейчас твой проект ставится одним большим `install.sh`. Мы делаем из него ещё и **плагин Claude Code** — как superpowers: пользователь добавляет маркетплейс одной командой и сразу получает скиллы, агентов и session-хуки, причём скиллы срабатывают сами (благодаря мини-скиллу-бутстрапу, который CC подсовывает в начале сессии). Жёсткую часть (git-хуки, CI) плагин честно **не** делает — её включает отдельная команда `/install-enforcement`, которая запускает тот же `install.sh` уже внутри твоего репозитория. Claude Code — со всеми плюшками; на других харнессах (OpenCode и т.д.) — то же ядро, но без авто-инъекции (читается по запросу). И всё это сам проект проверяет своим же тестом-принципом, чтобы манифест не врал.

## See also

- [2026-05-31-one-click-installer-design.md](2026-05-31-one-click-installer-design.md) — the `./setup` orchestration this packaging sits beside.
- [.claude/rules/dual-implementation-discipline.md](../../../.claude/rules/dual-implementation-discipline.md) — internal-vs-consumer + CC-native/portable triage.
- [.claude/rules/companion-install-principle.md](../../../.claude/rules/companion-install-principle.md) — own-installer / free-on-subscription discipline.
- [.claude/rules/build-first-reuse-default.md](../../../.claude/rules/build-first-reuse-default.md) — the seven-verdict adoption discipline applied in §3.
- [extension.json](../../../extension.json) — predecessor manifest; SSOT for the shippable set.
