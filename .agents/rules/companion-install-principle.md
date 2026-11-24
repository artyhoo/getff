---
description: Companion/external-service install discipline — detect-first, official installer only, no version pin, free-on-subscription default
paths:
  - "setup.d/**"
---

# Companion / external-service install principle — discipline rule

<!-- globs: setup.d/** -->
<!-- inject: Companion/external-service install: detect-first, official installer only, NO version pin, free-on-subscription default. See §1-§3. -->

> **Class:** B — compensating mechanism without CI test: an edit-time reminder injected by [`inject-matching-rule.sh`](../hooks/inject-matching-rule.sh) via the `<!-- globs: -->` marker above, paired with the CC-native `paths:` frontmatter sibling (read-time, whole-rule) — delivery channel per [rule-enforcement-channel-selection.md §3-§4](rule-enforcement-channel-selection.md). No CI gate yet — the no-version-pin principle is mechanically detectable but not yet enough manifest rows to warrant a gate (§4). Promotion to A (grep gate: no version pin in [`setup.d/companions.manifest`](../../setup.d/companions.manifest) + official-installer-only) in §4.
> **Fires:** editing `setup.d/**` (companion install manifest/engine).
> **Authoritative for:** how this project installs companions/external services — §1 the principle, §2 trigger, §3 the manifest mechanism, §4 promotion / retirement.
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../README.md#why-this-exists). Build-vs-reuse macro discipline — see [build-first-reuse-default.md](build-first-reuse-default.md). No-paid-LLM-in-CI policy — see [no-paid-llm-in-ci.md](no-paid-llm-in-ci.md).

> **Origin:** 2026-05-31 one-click-installer brainstorm ([design spec §4](../../docs/superpowers/specs/2026-05-31-one-click-installer-design.md)). Maintainer principle: our installer installs only our own artefacts; companions/external services install via their own official installer, detect-first, no version pin, configured to the free-on-subscription path by default. Codified 2026-06-10 (one-click-installer S4, maintainer-directed).

## §1 The principle

Maintainer's framing (2026-05-31):

> Our installer installs only our own artefacts. Companions and external services are installed via **their own official top-level installer**, after a **detect-first** check, **without pinning a version**, and **configured to the free-on-subscription path by default** (never silently a paid API). We never reimplement a companion's install steps.

Why this satisfies «don't update our installer when a satellite updates»:

| Satellite event | Our installer touched? |
|---|---|
| Satellite ships a new **version** | **Never** — we call `claude plugin install <x>@<marketplace>` with no version pin; the registry serves latest. Updates flow through their installer. |
| Satellite changes its **install command** | Yes, but a **one-line data edit** in the manifest (rare). |

This is [`build-first-reuse-default.md §2`](build-first-reuse-default.md) («maintenance distributes to upstream maintainers») applied to the install surface, and it extends the spirit of [`no-paid-llm-in-ci.md`](no-paid-llm-in-ci.md) to the consumer default: free-on-subscription, never paid-API-by-default.

## §2 Trigger

When adding or changing how a companion or external service is installed by [`./setup`](../../setup) / [`install.sh`](../../install.sh) — adding a manifest row, changing a row's detect/install command, or routing a new `kind`.

## §3 Mechanism

Declarative [`setup.d/companions.manifest`](../../setup.d/companions.manifest) — TAB-delimited rows `name / detect_cmd / install_cmd / kind` — plus the generic engine [`setup.d/engine.sh`](../../setup.d/engine.sh) (`companion_step`): for each row, run `detect_cmd`; present → skip; absent → offer `[y/N]` → run `install_cmd` verbatim. The engine is the minimal table+loop the design mandates, **not** a plugin framework.

- **No version pin:** no `install_cmd` carries an `@x.y.z` pin; the upstream registry serves latest.
- **Official installer only:** `install_cmd` is the companion's own top-level command (e.g. `claude plugin install superpowers@claude-plugins-official --scope user`); we never reimplement its steps.
- **Free-on-subscription default:** `kind=external-service` rows are routed to runtime-bridge guided-detect ([`packages/runtime-bridge/scripts/setup-runtime-bridge.sh`](../../packages/runtime-bridge/scripts/setup-runtime-bridge.sh)), which offers the `transport:"cli"` switch off the metered SDK default — never silently a paid API.

## §4 Promotion / retirement

- **Promotion to a grep gate** (Class B → A) when the manifest reaches **≥3 rows** OR the first version-pin incident fires, whichever is earlier. The gate asserts both halves of the principle mechanically: `grep -E '@[0-9]+(\.[0-9]+)*' setup.d/companions.manifest` returns nothing (no pin), and every `cc-plugin` row's `install_cmd` invokes the companion's official installer (allowlist of official install commands, extended per row addition).
- **Retirement:** 12 consecutive months with zero version-pin incidents AND zero reimplemented-installer incidents → archive to prose in [CLAUDE.md](../../CLAUDE.md). Matches peer-rule retirement criteria ([reviewer-discipline.md §4](reviewer-discipline.md)).

## See also

- [build-first-reuse-default.md §1.1](build-first-reuse-default.md) — satellite doctrine (own-stack-first, operator vs shipped axes); this rule is its install-surface specialisation.
- [dual-implementation-discipline.md §7](dual-implementation-discipline.md) — single source of truth: companion install logic lives in the manifest, never duplicated in `install.sh`.
- [no-paid-llm-in-ci.md](no-paid-llm-in-ci.md) — sibling cost-discipline; this rule extends the free-default to the consumer install surface.
- [rule-enforcement-channel-selection.md §3-§4](rule-enforcement-channel-selection.md) — channel-selection rationale for the edit-time `<!-- globs: -->` injection + CC-native `paths:` dual-pair this rule now carries.
- [kickoff-staging-placement.md](kickoff-staging-placement.md) — peer Class B rule delivered by the same `inject-matching-rule.sh` `<!-- globs: -->` mechanism.
- [docs/superpowers/specs/2026-05-31-one-click-installer-design.md §4](../../docs/superpowers/specs/2026-05-31-one-click-installer-design.md) — origin design (principle statement + satellite-update table).
