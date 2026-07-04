---
paths:
  - ".claude/hooks/**"
  - ".claude/skills/**"
  - "scripts/**"
---

# Language discipline — internal English, human-facing AIF_HOOK_LANG-gated

<!-- globs: .claude/hooks/**, .claude/skills/**, scripts/** -->
<!-- inject: Internal machinery (hooks/skills/scripts) is English-only; human-facing output follows AIF_HOOK_LANG (ru→Russian, else English); match-data (triggers, detection patterns) stays bilingual. See §1-§2. -->

> **Class:** A — companion principle test shipped at [packages/core/principles/22-internal-english.test.ts](../../packages/core/principles/22-internal-english.test.ts) (2026-06-16).
> **Fires:** writing any internal machinery or human-facing output.
> **Authoritative for:** the language-discipline rule — §1 the 3-category model, §2 the human-facing language gate, §3 the keep-list, §4 enforcement channels, §5 anti-patterns, §6 promotion / retirement.
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../README.md#why-this-exists). The i18n pack mechanism — see [docs/superpowers/specs/2026-06-01-hook-lang-i18n-design.md](../../docs/superpowers/specs/2026-06-01-hook-lang-i18n-design.md). Doc-authority header spec — see [doc-authority-hierarchy.md](doc-authority-hierarchy.md).

> **Origin:** 2026-06-16 maintainer dialogue — internal machinery (hooks, skills, scripts) was mixed RU/EN; `/pipeline` localized table headers but wrote English prose even under `AIF_HOOK_LANG=ru`. Spec: [docs/superpowers/specs/2026-06-16-language-discipline-design.md](../../docs/superpowers/specs/2026-06-16-language-discipline-design.md).

## §1 The 3-category model

| # | Category | Rule | Examples |
|---|---|---|---|
| 1 | Internal machinery — comments, logic, AI-facing SKILL instructions, tool args, code, repo artifacts (kickoffs, specs, commit/PR bodies) | **English, always** | hook comments; instruction prose |
| 2 | Human-facing output — what the AI/hook addresses to the operator | **`AIF_HOOK_LANG`-gated**: `ru` → Russian, else English | pipeline report prose; chat answers |
| 3 | Activation / match metadata — strings whose purpose is to match possibly-Russian operator input/output | **bilingual / language-specific kept** | skill `description` triggers; `AIF_EOT_QUESTION_PATTERN`; decision-deferral phrase lists |

Category 3 is the trap: removing those Russian tokens silently breaks recognition of Russian operator input/output, with no upside. It is neither «обращение к человеку» nor logic — it is match-data.

## §2 The human-facing language gate

Two sub-channels:

- **2a shell-emitted** (hooks/helpers `echo`, no LLM in the loop): via `lang/{en,ru}.sh` packs, selected by `${AIF_HOOK_LANG:-en}` with a hard EN fallback.
- **2b LLM-authored** (the model writes prose): the model learns the active language from (i) the always-on line injected by [`inject-session-bootstrap.sh`](../hooks/inject-session-bootstrap.sh) (every turn, all skills — precisely scoped so repo artifacts stay English) and (ii) the pipeline `AIF_OUTPUT_LANG` render-time signal, and MUST write ALL operator-facing prose in it — not only localized tokens.

**Precedence:** `AIF_HOOK_LANG` overrides the prompt-language default when set; unset → English.

## §3 Keep-list (legitimate Russian — do NOT translate)

`lang/ru.sh` packs; skill `description` trigger-words (frontmatter); `AIF_EOT_QUESTION_PATTERN` and decision-deferral phrase lists (category 3); verbatim maintainer quotes in rule files; RU eval fixtures; the RU narrative [docs/meta-factory/project-history-book.md](../../docs/meta-factory/project-history-book.md).

## §4 Enforcement channels

- **Edit/CI:** [principle 22](../../packages/core/principles/22-internal-english.test.ts) — Surface 1 (machinery shell, zero-tolerance) + Surface 2 (SKILL.md bodies after frontmatter, allowlisted). Low-FP by construction; rule files (verbatim maintainer quotes) + pipeline references (match-data) are intentionally NOT scanned — covered by this prose. Channel choice per [rule-enforcement-channel-selection.md](rule-enforcement-channel-selection.md): mechanically-detectable → gate.
- **Always-on:** the B1 output-language line ([`inject-session-bootstrap.sh`](../hooks/inject-session-bootstrap.sh)) — judgment-shaped prose-following, so injection, not a gate.
- **Parity:** [`.claude/hooks/lang/check-parity.sh`](../hooks/lang/check-parity.sh) (hook lang packs, en/ru key parity, incl. `AIF_EOT_*`) and [`.claude/skills/pipeline/lang/check-parity.sh`](../skills/pipeline/lang/check-parity.sh) (pipeline skill lang packs, `AIF_PIPELINE_*` / `AIF_RECAP_MARKER` parity).

## §5 Anti-patterns

- **`#russian-in-machinery`** — Cyrillic comment/prose in a hook/script/skill body. Counter: translate to English; principle 22 Surface 1/2 catches it.
- **`#headers-localized-prose-not`** — localizing shell tokens but writing prose in the wrong language (the 2026-06-16 pipeline bug). Counter: §2b — the model writes ALL prose in `AIF_OUTPUT_LANG` / the injected output-language, not only the table headers.
- **`#match-data-translated-away`** — "making it English" by deleting category-3 Russian tokens, breaking Russian-input recognition. Counter: §1 category 3 — keep; move into `lang/` packs where a pack exists.

## §6 Promotion / retirement

- Already Class A (principle 22 shipped). Strengthening trigger: if a `#russian-in-machinery` incident slips past Surface 1/2 (e.g., on a surface the test does not scan), widen the test's scanned globs.
- Retirement: 12 consecutive months with zero incidents AND principle 22 green across the window → archive to prose in [CLAUDE.md](../../CLAUDE.md). Matches peer-rule criteria ([reviewer-discipline.md §4](reviewer-discipline.md)).

## §7 §1.7 self-reflexive note

- **Forward-check:** complies with [no-paid-llm-in-ci.md](no-paid-llm-in-ci.md) (the gate is a deterministic Cyrillic grep over tracked files — zero API-billed calls), [doc-authority-hierarchy.md §2-§3](doc-authority-hierarchy.md) (this file carries Class + Authoritative-for header), [build-first-reuse-default.md §3](build-first-reuse-default.md) (REUSE: the gate reuses the existing `AIF_HOOK_LANG` + `lang/*.sh` pack mechanism rather than building new i18n infra; the only BUILD is the project-specific Cyrillic-scan test).
- **Backward-check:** extends, does not supersede, [dual-implementation-discipline.md](dual-implementation-discipline.md) (the `@dual-pair` i18n packs precedent) and the 2026-06-01/03 hook+pipeline i18n specs. No existing rule is duplicated.

## See also

- [packages/core/principles/22-internal-english.test.ts](../../packages/core/principles/22-internal-english.test.ts) — companion test.
- [docs/superpowers/specs/2026-06-16-language-discipline-design.md](../../docs/superpowers/specs/2026-06-16-language-discipline-design.md) — design.
- [dual-implementation-discipline.md](dual-implementation-discipline.md) — `@dual-pair` i18n packs precedent.
- [docs/superpowers/specs/2026-06-03-pipeline-skill-i18n-design.md](../../docs/superpowers/specs/2026-06-03-pipeline-skill-i18n-design.md) — pipeline token-localization predecessor.
