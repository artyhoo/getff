<!-- scope:meta-orchestrator-refactor-f3-scope -->
# Research patch — Sub-wave G: F.3 binding scope + tech debt audit (companion)

> **Inherits authority from** [research-patches/README.md](README.md) folder-level Authoritative-for header. Scope-bound to: §1.4 технический аудит + §1.5 binding scope (12 items) — companion к основному patch `2026-05-24-meta-orchestrator-refactor-design.md`. **NOT authoritative for** project goal (см. [README.md#why-this-exists](../../../README.md#why-this-exists)); UX redesign — см. §1.3 в основном файле.
> **Date:** 2026-05-24 · **Author session:** claude-sonnet-4-6, Sub-wave G R-phase (S3 split — companion file).
> **Tags:** `#meta-orchestrator-tech-debt` · `#f3-scope` · `#gap-1-regex` · `#principle-18`

---

## §1.4 — Technical debt audit

### Population enumeration (T10 first)

Перед sampling — полная популяция:

| Surface | Count | Lines |
|---|---|---|
| SKILL.md sections (§0–§11) | 11 | 500 |
| `helpers/*.sh` | 3 | 67+82+65 = 214 |
| `references/*.md` | 3 | 34+20+45 = 99 |
| `templates/*.md` | 2 | 167+64 = 231 |
| Consumer mirror SKILL.md | 1 | 107 |

Итого: 11 секций + 9 файлов. G прочитал: все 11 секций ✅, 2/3 helpers ✅, 3/3 references ✅, 1/2 templates ✅, consumer mirror строки 1-50 ✅. Priority-score.sh = Fork 6 (не F.3 scope, пропущен).

### Class field reality-check (A/B/C audit)

Authoring SKILL.md строки 19-21 объявляют:
> «Class: B (mixed): §0/§7.1 + §10/§7.12 = Class A. §4/§7.5 = partial Class A via principle 12. §1/§7.2 · §2/§7.3 · §3/§7.4 · §5/§7.6 · §6/§7.7 · §7/§7.8 · §9/§7.11 · §11/§7.13 = Class C»

Проверка per-секция:

| Section | Declared Class | Enforcement reality | Gap? |
|---|---|---|---|
| §0 Invocation | A | CC slash-command primitive = structural enforcement ✅ | No |
| §1 Plan-currency | C | `!shell` инжект data, AI может игнорировать | No (честно) |
| §2 Priority | C | Judgment call на injected data; шкала субъективная | No |
| §3 Launch-table | C | `!shell` инжект; AI заполняет judgment columns | No |
| §4 Meta-kickoff write | partial A | Principle 12 enforces §5 T-enumeration, не весь §4 | No (честно partial) |
| §5 Dispatch tree | C | Prose routing table; AI может не следовать | No |
| §6 Stage gates | C | `!shell` инжект PR state; AI может игнорировать | No (Class C honesty §6) |
| §7 Reviewer dispatch | C | Agent tool invocation, AI judgment | No |
| §8 Anti-scope | C | Prose only | No |
| §9 Dogfood test | C | Prose; HARD GATE = prose-only enforcement | No (честно) |
| §10 Output artifacts | A | Write tool writes file or not, frontmatter parses | No |
| §11 Failures | C | Prose; `!shell` surfaces data | No |

**Verdict: Class declarations точны.** Нет секций с over-claimed или under-claimed Class. INCONCLUSIVE: §10 Class A claim зависит от наличия §10 substructure content — после F.3 добавит headers, Class A claim станет более обоснованным.

### Mirror diff verbatim

```bash
diff -r .claude/skills/meta-orchestrator/ skills/meta-orchestrator/
```

Отличающиеся файлы:

1. **SKILL.md**: 548 строк diff (intentional — authoring 500 строк vs consumer 107 строк).
   Ключевые intentional расхождения:
   - Authoring: полный Class/Authoritative-for blockquote (строки 19-21)
   - Consumer: condensed blockquote без project-internal cross-links (строки 19-22 authoring → строки 19-22 consumer другие)
   - Authoring: `!shell` injection blocks, project-relative `../..` paths, repo-specific refs
   - Consumer: standalone portable version с `install.sh` paths
   **Verdict:** intentional. Не MAJOR.

2. **plain-language-tail.md**: 4 строки diff.
   ```diff
   8c8
   < ...enforced by [`.claude/hooks/end-of-turn-reminder.sh`](../../../.claude/hooks/end-of-turn-reminder.sh)...
   ---
   > ...enforced by `.claude/hooks/end-of-turn-reminder.sh`...
   ```
   Единственная разница — authoring использует markdown link, consumer использует inline path (без link). Это **intentional** по аналогии с consumer SKILL.md (consumer убирает project-internal cross-links). **Verdict:** INCONCLUSIVE-acceptable — Fork 5 если F.3 касается этого файла.

**Все прочие файлы** (helpers/\*.sh, references/failures.md, references/placeholders.md, templates/\*) — **идентичны** (0 diff lines). ✅

### Gap-1 regex reproduction (механически)

**Code:** `launch-table-generator.sh:42-49`:
```bash
detect_subwaves() {
  grep -E '^\| *(\*\*)?([A-D]|[0-9]+)(\*\*)? *\|' "${KICKOFF}" 2>/dev/null \
    | grep -vE '^\|[[:space:]:|-]*\|[[:space:]:|-]*$' \
    | while IFS='|' read -r _ sw_raw _; do
        sw="$(echo "${sw_raw}" | tr -d ' *')"
        [[ -n "${sw}" ]] && echo "${sw}"
      done
}
```

**Test input:** `.claude/orchestrator-prompts/meta-orchestrator-followup-audit/kickoff.md`

**Actual output** (command + output):
```bash
grep -E '^\| *(\*\*)?([A-D]|[0-9]+)(\*\*)? *\|' "${KICKOFF}" \
  | grep -vE '^\|[[:space:]:|-]*\|[[:space:]:|-]*$' | head -10
```
```text
| 1 | блок «Stage 1» ниже | Сейчас | <PR/event> | — |
| 1 | A — Fresh-eye diff + mirror sync | Mode A inline Agent (Opus) | ~30-50k | Read-only audit... |
| 2 | B — Compliance check | Mode A inline Agent (Opus) | ~30-50k | Read-only... |
| 3 | C — Russian triggers | Direct Edit (orchestrator) | ~5k | Small... |
| 4 | E — Plain-language tail | **Mode A inline Agent (Opus)**... | ~20-40k | ... |
| 5 | D — Extended TDD | Mode A × 4 parallel inline Agents | ~120-150k | Heavy... |
| 6 | F.1 — UX research | Mode A inline Agent (Opus) | ~30k | Read-only... |
| 7 | F.2 — Cold review of SKILL.md | Mode A inline Agent (Opus, fresh-eye) | ~30k | Read-only... |
| 8 | F.3 — UX implementation | Direct Edit (orchestrator) OR handoff via 1-liner | ~30-40k | ... |
```
**Total matches: 9** (dispatch table rows + one timing row). Все 9 — ложные срабатывания из dispatch-таблицы kickoff.

**Root cause:** regex `[A-D]|[0-9]+` совпадает с числами `1-8` в первой колонке dispatch-таблицы kickoff (которая содержит `| N | Sub-wave name | Mode | Cost |`). Detect_subwaves не различает «sub-wave rows» от «dispatch table rows».

**Proposed fix — Option A (keyword filter, heuristic):**
```bash
detect_subwaves() {
  grep -E '^\| *(\*\*)?([A-D]|[0-9]+)(\*\*)? *\|' "${KICKOFF}" 2>/dev/null \
    | grep -vE '^\|[[:space:]:|-]*\|[[:space:]:|-]*$' \
    | grep -E 'R-phase|execution|wiring|Mode [AB]|SDD|Queue mode|I-phase' \
    | while IFS='|' read -r _ sw_raw _; do
        sw="$(echo "${sw_raw}" | tr -d ' *')"
        [[ -n "${sw}" ]] && echo "${sw}"
      done
}
```

**Option B (section-scoped awk, robust):** ограничить scope секциями `## §[2-4]` kickoff'а через awk state machine. Robust, но требует kickoff с этими headings.

**INCONCLUSIVE:** keyword filter (Option A) пропустит sub-waves с нестандартными названиями. Раскрыть edge-case: если kickoff содержит строку `| A | some custom thing |` без keyword → не обнаружена. Риск: low (наши kickoffs следуют стандарту). Decision D-G-1 (в основном файле §A).

### Principle 18 test spec

**Slot:** 18 (verified free — slots 16 и 17 заняты, 18 пустой).

**Path:** `packages/core/principles/18-meta-orchestrator-output-format.test.ts`

**Assertion spec:**

```typescript
// packages/core/principles/18-meta-orchestrator-output-format.test.ts
import { readFileSync } from 'fs';
import path from 'path';

const REPO_ROOT = path.resolve(__dirname, '../../..');
const SKILL_PATHS = [
  path.join(REPO_ROOT, '.claude/skills/meta-orchestrator/SKILL.md'),
  path.join(REPO_ROOT, 'skills/meta-orchestrator/SKILL.md'),
];

function readSkill(p: string): string {
  return readFileSync(p, 'utf8');
}

describe('Principle 18 — meta-orchestrator output format structure', () => {
  test('§10 Output artifacts section present in BOTH copies', () => {
    for (const p of SKILL_PATHS) {
      const content = readSkill(p);
      expect(content).toMatch(/^## §10 Output artifacts/m);
    }
  });

  test('§10 contains Dependency graph subsection with ASCII symbol', () => {
    const authoring = readSkill(SKILL_PATHS[0]);
    // Must have the subsection heading
    expect(authoring).toMatch(/## Dependency graph/);
    // Must have at least one ASCII tree symbol (ADAPT from Argo Workflows)
    expect(authoring).toMatch(/[├└↓]/);
  });

  test('§10 contains Action queue subsection with table columns', () => {
    const authoring = readSkill(SKILL_PATHS[0]);
    expect(authoring).toMatch(/## Action queue/);
    // Must have table with required column keywords
    expect(authoring).toMatch(/Блок|Paste/);
    expect(authoring).toMatch(/Когда/);
    expect(authoring).toMatch(/Ждёшь/);
    expect(authoring).toMatch(/Параллельно/);
  });

  test('§10 contains 1-liner blocks subsection with Stage heading', () => {
    const authoring = readSkill(SKILL_PATHS[0]);
    expect(authoring).toMatch(/## 1-liner blocks|### Stage/);
  });

  test('mirrors agree — both copies pass §10 structure checks', () => {
    for (const p of SKILL_PATHS) {
      const content = readSkill(p);
      expect(content).toMatch(/^## §10 Output artifacts/m);
    }
  });
});
```

**Paired-negative discipline (per principle 02):** F.3 ДОЛЖЕН включить paired-negative test:
- Temporarily remove `## Dependency graph` heading → test must FAIL
- Restore → test must PASS
- Same for `## Action queue` + `### Stage` pattern

**Precedent:** `principle 12-ai-laziness-traps.test.ts` (validates `## §5 AI-traps active` в kickoffs). Principle 18 = analogous structural check на SKILL.md §10.

---

## §1.5 — F.3 binding scope (12 items)

Каждый item: file path + WHAT + WHY + falsifier + owner.

---

### Item 1 — M1: dispatch table «R-phase, single» routing fix

**File:** `.claude/skills/meta-orchestrator/SKILL.md` §5 (строка ~236) + `skills/meta-orchestrator/SKILL.md` (аналог)

**WHAT:**
Current: `| R-phase, single | Queue mode sequential | Per orchestrator skill Queue mode references...`
Proposed: `| R-phase, single | Mode A inline | Single-focus R-phase = one Opus session; Queue mode is for ≥2 sequential kickoffs (queue-mode.md §1 Triggers). |`

**WHY:** F.2 MAJOR-1. `queue-mode.md §1 Triggers` says «Single kickoff → Mode A». Current row contradicts.

**Falsifier:** Wrong if `queue-mode.md` has been updated since F.2 to no longer say this. F.3 MUST re-read `~/.claude/skills/orchestrator/references/queue-mode.md` before landing fix.

**Owner:** F.3 inline edit. Mirror sync required (Item 12).

---

### Item 2 — D3-MAJOR: disable-model-invocation misattribution fix

**File:** `.claude/skills/meta-orchestrator/SKILL.md` §0 (строка ~37) + `skills/meta-orchestrator/SKILL.md` (строка ~39)

**WHAT:**
Authoring current (строка ~37): «This prevents subagents from recursively self-invoking the meta-orchestrator (desired per kickoff §4 key-points, MINOR-5).»
Consumer current (строка ~39): «fires ONLY on explicit `/meta-orchestrator` invocation (prevents recursive self-invocation in subagents).»

Proposed authoring: «This skill fires ONLY on explicit `/meta-orchestrator` invocation. The `disable-model-invocation: true` flag prevents CC from auto-loading this skill into subagent contexts — behaviour built into CC's default skill-loading model, not a recursive-invocation guard. No subagent recursion risk exists in practice (depth=2 constraint: [sub-agents.md](https://code.claude.com/docs/en/sub-agents.md)).»

**WHY:** F.2 D3 upgraded to MAJOR. `disable-model-invocation` = CC flag controlling auto-load into subagents, not a depth-guard. Misattribution misleads readers about CC primitive behaviour.

**Falsifier:** Wrong if CC docs have updated `disable-model-invocation` semantics to include recursive-guard behaviour. F.3 MUST read current CC docs before landing.

**Owner:** F.3 inline edit. Mirror sync required.

---

### Item 3 — M2: plain-language-tail.md «injects» terminology fix

**File:** `.claude/skills/meta-orchestrator/references/plain-language-tail.md:8` + `skills/meta-orchestrator/references/plain-language-tail.md:8`

**WHAT:**
Current: «It injects `## 🟢 Простыми словами` as a mechanical presence gate»
Proposed: «It enforces presence of `## 🟢 Простыми словами` via `decision:block` mechanism (Stop hook fires, blocks turn completion until section added by model)»

**WHY:** F.2 MAJOR-2. «Injects» implies the hook adds the section. Empirical behaviour: hook fires `decision:block` with `reason` text; model adds the section in response. Wording should describe mechanism, not effect.

**Falsifier:** Wrong if CC hook semantics have changed (e.g. hooks now support `additionalContext` injection for Stop events — then «injects» might be accurate). F.3 MUST re-verify hook contract against primary docs before landing.

**Owner:** F.3 inline edit. Mirror sync applies (4-line diff already tracked — Item 12).

---

### Item 4 — m1: MINOR dispatch table missing «R-phase multiple sequential» row

**File:** `.claude/skills/meta-orchestrator/SKILL.md` §5 + mirror

**WHAT:** добавить строку между current R-phase rows:
`| R-phase, multiple sequential | Queue mode (sequential) | ≥2 R-phase kickoffs queued; each completes before next begins (queue-mode.md §1 Triggers: «≥2 sequential kickoffs»). |`

**WHY:** F.2 m1. Current §5 has only «R-phase, single» and «R-phase, multiple parallel» — the sequential-multiple case is unrouted.

**Falsifier:** Wrong if sequential-multiple R-phase is intended to be treated identically to parallel (Mode A × N). Verify queue-mode.md §1.

**Owner:** F.3 inline edit. Mirror sync required.

---

### Item 5 — m2: MINOR stage-gate hardcoded date fix

**File:** `.claude/skills/meta-orchestrator/SKILL.md` §6 строка ~271 + mirror

**WHAT:**
Current: `gh pr list --search "is:merged head:<stage-N-branch> base:staging created:>=2026-05-23"`
Proposed: replace `created:>=2026-05-23` с `created:>={{STAGE_START_DATE}}` placeholder (или удалить date-filter полностью, оставив только `is:merged head:<branch> base:staging`)

**WHY:** F.2 m2. Hardcoded date 2026-05-23 станет stale — команда вернёт 0 results для PRs, созданных позже.

**Falsifier:** Wrong if the date-filter is intentional as a global lower-bound (e.g. «ignore PRs older than the skill's creation date»). If intentional — document the intent explicitly.

**Owner:** F.3 inline edit. Mirror sync required.

---

### Item 6 — m3: MINOR blank line before «See also»

**File:** `.claude/skills/meta-orchestrator/SKILL.md` строка ~490 + mirror

**WHAT:** добавить blank line перед `## See also` (строка ~489: `-->` → blank line → `## See also`).

**WHY:** F.2 m3. Markdown convention + principle 09 header format.

**Falsifier:** N/A (cosmetic).

**Owner:** F.3 inline edit. Mirror sync required.

---

### Item 7 — F3-S1: Add antipatterns #worker-dispatch-via-subagent + #commit-on-behalf-of-worker to §5

**File:** `.claude/skills/meta-orchestrator/SKILL.md` §5 + mirror

**WHAT:** добавить в §5 (после dispatch tree) explicit prose:

```text
**Antipatterns (§7.6 binding):**

- `#worker-dispatch-via-subagent` — Worker dispatch via Agent tool from meta-orchestrator session.
  Meta-orchestrator MAY use Agent tool ONLY for: Phase -1 read-only reviewer, read-only research subagents (text return).
  Worker dispatch (write tasks, PR/commit) = maintain via 1-liner blocks for maintainer to paste in fresh CC session.
  **Falsifier:** if the 1-liner block format is indistinguishable from an Agent dispatch prompt internally — both acceptable; the CHANNEL matters (maintainer paste = external loop-close; Agent = subagent = depth-2 violation for non-read-only).

- `#commit-on-behalf-of-worker` — meta-orchestrator making git commit for work it dispatched.
  Worker commits its own work under its own audit trail. Meta-orchestrator never commits on Worker's behalf.
```

**WHY:** parent kickoff §1 Sub-wave F.3 строки 220-224 (explicit antipatterns для SKILL.md §5).

**Falsifier:** Wrong if the antipatterns are already in §8 Anti-scope (they are — but §8 is not routing-level; §5 needs them co-located with dispatch logic).

**Owner:** F.3 inline edit. Mirror sync required.

---

### Item 8 — F3-S2: Add 3 substructure headers to §10 Output artifacts

**File:** `.claude/skills/meta-orchestrator/SKILL.md` §10 + mirror

**WHAT:** в §10 item 3 («Inline session report») заменить/расширить prose-only description на structured subsections:

```markdown
#### Dependency graph

[ASCII tree using ├─ / └─ from Argo Workflows ADAPT vocabulary. Stage-labeled, prospective (shows WILL run, not IS running). Example:

Stage 1 — СЕЙЧАС:
├── Sub-wave A  (Mode A, ~30k, read-only)
└── Sub-wave B  (Mode A, ~30k, read-only)

Stage 2 — после мержа Stage 1:
└── Sub-wave C  (Mode A, ~40k)
]

#### Action queue

| # | Блок | Когда | Ждёшь | Параллельно с |
|---|---|---|---|---|
| 1 | ... | ... | ... | ... |

Всего твоих paste'ов: <N>.

#### 1-liner blocks (копируй ОДИН блок = ОДНА новая CC сессия)

### Stage N — <name> (<Mode>, ~<cost>)
/orchestrator <umbrella> §<section> — Mode <X> <role> <autonomous?>, остальное в kickoff
```

**WHY:** parent kickoff §1 Sub-wave F.3 строки 254-263 (3-layer output structure). Principle 18 validates presence.

**Falsifier:** Wrong if the 3-layer structure overloads §10 beyond SKILL.md 500-line ceiling — in that case split to `references/output-format.md` first (D-G-2 Option A, основной файл §A).

**Owner:** F.3 inline edit. Mirror sync required.

---

### Item 9 — F3-S3: Create references/output-format.md (new file)

**File (NEW):** `.claude/skills/meta-orchestrator/references/output-format.md` + `skills/meta-orchestrator/references/output-format.md`

**WHAT:** новый reference файл с:
1. 1-liner block grammar (formal: `/orchestrator <umbrella> §<section> — Mode <X> <role> <autonomous?>, остальное в kickoff`)
2. 4 worked examples — Mode A single (R-phase), Mode SDD (build), Mode B × N (parallel worktrees), Mode Queue (sequential)
3. ASCII graph templates (Stage с 2-3 nodes, пример для параллельных и sequential)
4. Anti-patterns для 1-liner format (T16: не путать slash-tag с NL-payload)

**WHY:** parent kickoff §1 Sub-wave F.3 строки 254-255 («Concrete examples to include in `references/output-format.md`»). SKILL.md §10 item 4 уже проектирует этот файл.

**Falsifier:** Wrong if SKILL.md §10 has enough inline space post-F.3 and references/output-format.md adds overhead without value. Decision: создавать только если D-G-2 Option A принята (split необходим для line count).

**Owner:** F.3 creates new file. Mirror sync required (consumer copy also new).

---

### Item 10 — Gap-1: Fix launch-table-generator.sh detect_subwaves() regex

**File:** `.claude/skills/meta-orchestrator/helpers/launch-table-generator.sh:42-49` + `skills/meta-orchestrator/helpers/launch-table-generator.sh:42-49`

**WHAT:** применить Option A или B fix (D-G-1 decision, основной файл §A). Минимально:

Option A (keyword filter):
```bash
detect_subwaves() {
  grep -E '^\| *(\*\*)?([A-D]|[0-9]+)(\*\*)? *\|' "${KICKOFF}" 2>/dev/null \
    | grep -vE '^\|[[:space:]:|-]*\|[[:space:]:|-]*$' \
    | grep -E 'R-phase|execution|wiring|Mode [AB]|SDD|Queue mode|I-phase' \
    | while IFS='|' read -r _ sw_raw _; do
        sw="$(echo "${sw_raw}" | tr -d ' *')"
        [[ -n "${sw}" ]] && echo "${sw}"
      done
}
```

**WHY:** Gap-1 (parent kickoff §1.5). Без fix — detect_subwaves возвращает dispatch-table rows как sub-waves → launch-table garbled.

**Falsifier (INCONCLUSIVE):** keyword filter может пропустить sub-waves с нестандартными названиями. Smoke-test: запустить против 3 разных kickoffs (meta-orchestrator-followup-audit, mutation-discipline-umbrella, wave-X synthetic) и верифицировать output.

**Owner:** F.3 inline edit (helper ≤80 LOC — не capability commit per CLAUDE.md). Mirror sync required.

**F.3 follow-up 2026-05-25:** Option A keyword filter replaced by Option B5 hybrid section-scoped + keyword fallback; 3rd smoke-test gap closed. See `docs/meta-factory/research-patches/2026-05-25-meta-orchestrator-f3-substance-followup.md` + PR `fix/meta-orchestrator-item10-b5`.

---

### Item 11 — §1 Step 2: Add REPORT reconciliation clause

**File:** `.claude/skills/meta-orchestrator/SKILL.md` §1 Step 2 + mirror

**WHAT:** в §1 Step 2 (drift detection) добавить:

«If maintainer-passed REPORT states something that contradicts `gh pr list` output (e.g. REPORT says "Stage 1 merged" but `gh pr list` shows no such merge) → emit: «REPORT says X; mechanical state shows Y; trusting `gh pr list`; possible causes: stale REPORT, pending GitHub sync (< 60s), or REPORT was for a different branch. Proceeding on mechanical state.»»

**WHY:** F.1 §A.5(iv) — REPORT reconciliation gap (absent from current §1 Step 2). Confirmed via parent kickoff §1 Sub-wave F.3 строки 195-214 (3-layer responsibility model clarified 2026-05-24).

**Falsifier:** Wrong if this case is already handled by the drift-detection logic (current §1 Step 3 emits DRIFT on mismatch — verify this covers REPORT contradictions too, not just wave-sequencing-plan contradictions).

**Owner:** F.3 inline edit. Mirror sync required.

---

### Item 12 — Mirror sync obligation (cross-cutting)

**Files:** ALL edits in Items 1-11 apply to BOTH `.claude/skills/meta-orchestrator/` AND `skills/meta-orchestrator/` (consumer mirror).

**WHAT:** каждый edit в authoring copy ДОЛЖЕН быть синхронизирован в consumer copy **в том же commit**. Round-2 MAJOR-1 incident (#194 skipnull mirror) — установлен как BINDING discipline.

**Exclusions:** intentional differences documented in §1.4 mirror diff verbatim — these remain (SKILL.md condensation; plain-language-tail.md link removal).

**WHY:** round-2 MAJOR-1: #194 fixed authoring `launch-table-generator.sh` but NOT consumer mirror → mirror drifted. Принцип: mirror sync = atomically paired edit, не afterthought.

**Falsifier:** Wrong if consumer mirror has diverged further from authoring since this G audit — re-run `diff -r` before F.3 starts to confirm 2-file state still holds.

**Owner:** F.3 MUST include mirror edits in EVERY commit. No standalone authoring-only commits for semantic changes.

---

## §1.7 — Self-reflexive check (companion)

**Forward-check:**

- **build-first-reuse-default.md §3:** Gap-1 fix uses heuristic keyword filter (ADAPT) или section-scoped awk (BUILD-minimal) — оба подхода проверены на механическом test-case. Principle 18 spec = TypeScript-based structural test (REFERENCE от principle 12 precedent). ✅ Нет BUILD-without-search.
- **no-paid-llm-in-ci.md §1:** Companion — research-only (session-bound). Principle 18 test = deterministic TypeScript grep/assert, no LLM. ✅
- **doc-authority-hierarchy.md §2-§3:** Companion inherits authority от folder-level README.md (research-patches/ folder authority pattern). Blockquote header присутствует. ✅
- **T15 (self-application):** §1.4 Class audit применяет SKILL.md's discipline rules к самому SKILL.md. ✅

**Backward-check:**

- Companion не supersedes ни один существующий SSOT — является split-extension основного patch.
- §1.5 binding scope не contradicts parent kickoff §1 Sub-wave F.3 lines 192-359 — directly derived from it.
- F.3 должен cite companion §1.5 как binding spec для каждого edit item.
- T15 recursive: этот §1.7 = самоприменение правила к companion patch. ✅

---

## §A — See also (companion)

- Основной patch: [`2026-05-24-meta-orchestrator-refactor-design.md`](2026-05-24-meta-orchestrator-refactor-design.md) — §1.1, §1.2, §1.3, §1.6, §1.7, §1.8, §A decisions
- Gap-1 fix approach decision (D-G-1): основной файл §A
- SKILL.md line count decision (D-G-2): основной файл §A
- F.1 UX prior-art: [`2026-05-24-meta-orchestrator-ux-research.md`](2026-05-24-meta-orchestrator-ux-research.md) §A.5
- SKILL.md authoring source: [`.claude/skills/meta-orchestrator/SKILL.md`](../../../.claude/skills/pipeline/SKILL.md)
- launch-table-generator.sh Gap-1: [`.claude/skills/meta-orchestrator/helpers/launch-table-generator.sh:42-49`](../../../.claude/skills/pipeline/helpers/launch-table-generator.sh)
- Principle 18 test slot: `packages/core/principles/18-meta-orchestrator-output-format.test.ts` (slot 18 verified free)
