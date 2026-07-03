# Meta-Factory: Защита от рисков (сводно)

> Source: PROPOSAL.md §11 (split в Phase 1.D, 2026-05-07)
> Companion: [PROPOSAL.md](PROPOSAL.md) (overview)
>
> **Authoritative for:** risk mitigations summary table — reproducibility, prompt injection defense, best-practices decay, self-bootstrapping recursion, `--no-verify` bypass.
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../README.md#why-this-exists).
>
> **Implementation status** — the mitigation table below mixes **SHIPPED** protections (e.g. `rules-lock.json` — real) with **DESIGN-TARGET** ones that are the intended design but **NOT yet built**: the shared `research-cache.json`, the TTL cache + auto-regen, and the `rules:upgrade` script do not currently exist. The table states the *target* defence set from the PROPOSAL.md §11 split; do not read an un-built mitigation as a currently-active protection.

---

## 11. Защита от рисков (сводно)

| Риск | Защита |
|---|---|
| LLM-generated context хуже human-written (InfoQ 2026) | Validator-gate с executable behavioral checks, не «правдоподобность текста» |
| Воспроизводимость | `rules-lock.json` + общий research-cache + явная команда `rules:upgrade` |
| Prompt injection через web | Allowlist источников (nextjs.org, react.dev, vercel.com, MDN) |
| Стоимость токенов | Shared research-cache на уровне организации, обновляется по расписанию |
| Decay best practices | TTL на кеш + auto-regen при апгрейде версий стэка |
| Self-bootstrapping recursion | Invariant core минимизирован, покрыт тестами на стабильность; любое изменение core = major bump + regression suite |
| Сгенерированный AST-код с багами (Path B) | Matrix tests на edge cases, mutation testing, two-AI review via AIF `review-sidecar`, human review checkpoint |
| Сломанный регекс/AST правила тихо always-PASS | Парные negative tests + mutation на самих правилах |
| Регрессия при апгрейде стэка | Canonical examples как regression baseline; diff-режим показывает изменения человеку |
| L2 Research Agent semantic drift не operationalized (см. [open-questions.md](open-questions.md) §13.7) | Phase 6 deliverable: формальный drift-detector с измеримой метрикой; до этого — manual review при изменении принципов |
| Bypass через `--no-verify` делает invariant декоративным | Phase 1.A добавляет CI gate на наличие `.husky/` директории + non-empty hooks; локальный bypass не блокируется, но CI fail при отсутствии setup'а |
| AIF major version breaking changes (v3+) | Pin AIF version в peerDependencies + semver compat tests; migration path Phase 11 |
| AIF adoption / discontinuation | Rule corpus + manifest остаётся usable standalone; runtime layer migration cost ~2-4 weeks |
| AIF API contract changes (`aif-gate-result` schema, skill-context format) | Schema validation в CI на reuse points; subscribe AIF release notes |
| Identity dilution от «plug-in» позиционирования | Marketing positioning: «logical self-application layer» — unique value prop через mutation testing для meta-tests + manifest-as-SSOT (не workflow runtime) |
