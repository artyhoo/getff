# AI documentation organization — hot/cold split, drift detection, AGENTS.md

> AGENTS.md is loaded into every session and eats tokens. Whatever goes in there has to earn every line.

This document is about organizing AI documentation in a project: what goes into `AGENTS.md` (or `CLAUDE.md`), what into `.claude/skills/`, what into `.claude/rules/`, and how to avoid drift. It applies on top of the AGENTS.md standard (Linux Foundation, 60k+ projects).

> **Authoritative for:** AI-doc organization conventions — hot/cold split between AGENTS.md / CLAUDE.md / .claude/skills/ / .claude/rules/; drift-detection guidance for AI docs; token-economy heuristics for what earns its line in always-loaded files.
> **NOT authoritative for:** framework's project goal — see [README.md#why-this-exists](https://github.com/artyhoo/getff/blob/main/README.md#why-this-exists). Doc-authority hierarchy (Authoritative-for header convention used in framework's own repo) — see [.claude/rules/doc-authority-hierarchy.md](https://github.com/artyhoo/getff/blob/main/.claude/rules/doc-authority-hierarchy.md).

---

## Layers of the AI stack and when each loads

```text
<project>/
├── AGENTS.md                       ← main instructions (hot, ≤150 lines)
├── CLAUDE.md                       ← @import AGENTS.md (or direct)
├── .mcp.json                       ← MCP servers (≈6k system-prompt tokens per server)
└── .claude/
    ├── settings.json               ← project permissions + deny
    ├── skills/<name>/SKILL.md      ← on-demand (trigger-activated)
    ├── rules/<name>.md             ← file-scoped (paths: frontmatter)
    └── orchestrator-prompts/

~/.claude/                          ← global (all projects)
├── CLAUDE.md, settings.json, rules/, skills/
```

| Layer                                                 | When it loads        | Tokens              |
| ----------------------------------------------------- | -------------------- | ------------------- |
| `~/.claude/CLAUDE.md` + global rules without `paths:` | Always               | ~250-1500 each      |
| `AGENTS.md` (project)                                 | Always               | ~30 tokens per line |
| `.claude/rules/*.md` with `paths:`                    | On a matching file   | 0 when inactive     |
| `.claude/skills/*/SKILL.md`                           | When a trigger fires | 0 when inactive     |

**Baseline session cost:** 4000-7000 tokens before the user writes the first message.

---

## Hot/cold split — what goes where

**Hot (in AGENTS.md):**

- One line per rule (no examples).
- Links to skills/rules by their concrete names.
- Project context (stack, key constraints).
- NDA / security rules (always).
- Source-of-truth pointers («DB schema in `prisma/schema.prisma`, API contract in `openapi/`»).

**Cold (in skills/rules):**

- Code examples.
- Anti-patterns with explanations.
- Edge cases.
- Historical notes («we used to do it this way, now we do it that way, because of ADR-0023»).
- Step-by-step recipes.

### Moving cold content out of AGENTS.md

1. **Find sections >20 lines** — candidates to move out.
2. **Universal (always needed)** → AGENTS.md (briefly, 1-2 lines).
3. **On-demand** → a skill with `triggers:`.
4. **File-specific** → a rule with `paths:`.
5. **After moving:** `grep -n "skill\|rule" AGENTS.md` — check the links.

### What NOT to move out

- The «do NOT do» list (always visible).
- Repositories, remote URLs.
- NDA rules.
- Security-critical rules (`requireUser()`, `getClaims()`, `verifyImageMagicBytes()`).
- Rules that **must** load in every session regardless of the file.

---

## When a skill, when a rule

|                 | Skill                                                             | Rule                                                     |
| --------------- | ----------------------------------------------------------------- | -------------------------------------------------------- |
| **Activation**  | Trigger keywords from the user's request                          | Automatic, when working on a file from the `paths:` glob |
| **Length**      | ≤300 lines (>300 — split)                                         | ≤80 lines (exception — narrowly scoped, `src/proxy.ts`)  |
| **When to use** | A pattern in ≥2 scenarios, ≥30 lines, not needed in every message | Applies to specific files, loads automatically           |
| **Frontmatter** | `triggers: kw1, kw2, ...` (5-8 RU+EN)                             | `paths: [...]`                                           |

### Skill template

```markdown
---
name: <kebab-case>
description: Use when <concrete scenario> — <what it contains>.
triggers: keyword1, keyword2, ключевое слово, ...
---

# <Title>

## 1. Main rule / quick reference

<what the agent needs to know in 90% of cases — first>

## 2. Patterns

### 2.1 <Pattern>

<code + explanation>

## 3. Anti-patterns

- ❌ <what not to do>

## 4. Examples from the project

<src/lib/..., src/app/actions/...>

## Related

- skill `<other>` / rule `.claude/rules/<name>.md`
```

**Skill formatting rules:**

- `description:` starts with **«Use when»** (the harness key phrase for activation).
- `triggers:` — ≥5 keywords, RU+EN, covering the variety of requests (not only tech jargon).
- ≤300 lines (if more → split by use case or layer).
- Links to real project files, not invented ones.

### Rule template

```markdown
---
description: <one line>
paths:
  - src/app/actions/**/*.ts
---

# <Title>

## Required

1. <rule>

## Forbidden

- ❌ <what not to do>

## Pattern

\`\`\`typescript
// Right vs wrong
\`\`\`

## Related

- skill `<name>`
```

**Rule formatting rules:**

- `paths:` format — **block sequence YAML** (as above). NOT inline `paths: ['...']` — for consistency and readability in diffs.
- The glob is not empty: `find . -path "<paths-glob>" | head -5` — expect ≥1 match.
- ≤80 lines (exception — a narrowly scoped rule, for example only `src/proxy.ts`).
- No copy-paste of AGENTS.md — links to skills/rules, not copies.

---

## When NOT to update the AGENTS.md skills table

If the project's strategy is a **slim AGENTS.md** (≤150 lines) and a skill triggers reliably on `description:`, **not every skill goes into the table**. Only those that:

- The agent must **know exist** (even when it is not activating one right now but refers to «there is skill X for this»).
- Are **often referenced** from other skills/rules.

Otherwise the skill lives in `.claude/skills/`, the harness activates it via `description:`, and AGENTS.md stays slim.

This lowers the token load and sharpens the AI's focus: instead of «here are 30 skills, pick one» it gets «here are the 5-7 key ones, the rest load on trigger».

---

## Drift detection

**Drift** = AGENTS.md / an orchestrator / settings refers to a file that does not exist (or is out of date).

### Standard checks

```bash
# Skills declared vs existing (template markers filtered out)
# awk instead of grep -oP — portable to BSD grep (macOS).
awk 'match($0, /skill `[^`]+`/) { print substr($0, RSTART+7, RLENGTH-8) }' AGENTS.md \
  | grep -v '^<' | sort -u | while read s; do
    [ -d ".claude/skills/$s" ] || echo "MISSING: $s"
  done

# Rules
awk 'match($0, /\.claude\/rules\/[^[:space:]`)]+/) {
  print substr($0, RSTART+15, RLENGTH-15)
}' AGENTS.md | grep -v '<name\|<glob' | while read r; do
  [ -f ".claude/rules/$r" ] || echo "MISSING rule: $r"
done

# Dead-end Edit permissions in settings
grep "\.claude/skills" ~/.claude/settings.json | grep -v "#"

# TODOs in JSON configs
grep "_comment\|TODO" .mcp.json .claude/settings.json
```

**The `grep -v '<name\|<glob'` filter** removes false positives from template blocks (README templates with `<name>`, `<glob1>` and so on).

### Trigger overlap detection

When two skills react to the same keyword, the AI loads **both** — double the token cost and confusion over which to pick.

```bash
# All triggers, duplicates highlighted
for f in .claude/skills/*/SKILL.md; do
  name=$(basename $(dirname "$f"))
  grep "^triggers:" "$f" | sed "s/triggers: //; s/, /\n/g" | sed "s/^/$name: /"
done | sort -k2 -t: | awk -F': ' '{print $2 "\t" $1}' | sort | uniq -c -f0 | awk '$1>1'
```

A conflicting trigger → decide which skill «owns» it: remove it from the others, replace it with a more specific one.

### `paths:` format consistency

```bash
# Find inline arrays (inconsistent with the convention)
grep -rn "^paths: \[" .claude/rules/

# Should be empty. If anything is found, convert it to a block sequence:
#   paths:
#     - <glob>
```

### Stale orchestrator-prompts

```bash
# Files older than 14 days that are not in archive/
find .claude/orchestrator-prompts -maxdepth 2 -mtime +14 \
  -not -path "*/archive/*" -name "*.md"
# → review by eye + move finished ones to archive/
```

The 14-day threshold — tune it to the project's cycle.

---

## Token economy

**Overload signals** (visible in real work with the agent):

- The agent **re-asks trivial things** (forgets the AGENTS.md rules).
- It **ignores skills** and relies on training knowledge.
- Answers get **shorter / shallower** for the same requests.
- The agent **skips steps** in established workflows.

**Action:** AGENTS.md ≤150 lines, global rules only with `paths:` or universal. Move cold content into skills/rules with `triggers:`.

### Healthy-infrastructure metrics

| Metric                                  | Target           | Alarm |
| --------------------------------------- | ---------------- | ----- |
| AGENTS.md lines                         | ≤150             | >300  |
| Drift (skills declared/existing)        | 0%               | >20%  |
| Auto-loaded tokens                      | <5000            | >8000 |
| Rules without `paths:` (global)         | 0 (or universal) | >2    |
| Trigger overlaps                        | 0                | >3    |
| Dead-end permissions                    | 0                | >5    |
| Orchestrator-prompts (outside archive/) | ≤5               | >15   |

---

## .mcp.json — MCP servers

```json
{
  "mcpServers": { "<name>": { "command": "npx", "args": ["-y", "<package>"] } }
}
```

- Only the ones actively used (each is ≈6k system-prompt tokens).
- No `_comment_*` or `TODO`.
- Nothing «just in case».

```bash
# Usage check
grep -rn "mcp__<name>" .claude/orchestrator-prompts/ | grep -v archive | wc -l
# 0 → remove
```

---

## settings.json — permissions

```json
{
  "permissions": {
    "allow": [
      "Bash(npm run *)",
      "Bash(git status)",
      "Bash(git diff*)",
      "Bash(git log*)",
      "Bash(gh pr create*)",
      "mcp__context7__*",
      "mcp__shadcn__*"
    ],
    "deny": [
      "Bash(git push --force*)",
      "Bash(git push -f *)",
      "Bash(git commit --no-verify*)",
      "Bash(git push *main*)"
    ]
  }
}
```

**Project-specific deny** (NDA, prod deploy, prod DB) — in **both places** (global + project), defense in depth.

| Type                             | Where                           |
| -------------------------------- | ------------------------------- |
| `npm run`, `git`, `gh` — generic | Global                          |
| Project-specific scripts         | Project                         |
| Critical deny                    | Both                            |
| MCP servers                      | Project (only from `.mcp.json`) |

---

## Lessons learned (from real practice)

### 1. Dual-remote projects — `.claude/` in the work repo's `.gitignore`

On `git checkout` of a branch from the work repo, files under `.claude/` can disappear. Symptom: `AGENTS.md` mentions skill X, but `.claude/skills/X/` is empty. In fact it is a loss through `.gitignore`, not real drift.

```bash
# Check ALL branches
git log --all --oneline -- '.claude/skills/' | head -5
git ls-tree -r develop --name-only | grep '^\.claude/'

# Recovery
git show develop:.claude/skills/<name>/SKILL.md > .claude/skills/<name>/SKILL.md
```

**Lesson:** when you suspect drift in a dual-remote setup, run `git log --all` **first**; do not recreate right away.

### 2. Skills declared in advance, never created

`AGENTS.md` refers to skill X «that we will make»; a month later X does not exist. We are counting on behaviour the AI does not have.

**Lesson:** do not mention a skill in AGENTS.md until its file is committed. The drift checker should catch this — `MISSING: <name>` in its output.

### 3. TODOs in JSON survive everything

A `_comment_TODO` in `.mcp.json` survived 30+ commits — JSON comments are invisible in a diff (or nearly so), and nobody pays attention to them.

**Lesson:** a TODO → a task in the tracker. Not in JSON. The drift checker should look for `_comment` / `TODO` in `.mcp.json`, `.claude/settings.json`, `.ai-factory/*.json`.

---

## Related

- `references/self-testing-docs.md` — code-vs-docs probes as an extension of this framework to runtime checks.
- `references/checks-map.md` — where this audit lives on the overall map of levels (level 5 — CI on PR).
- `agents/living-docs-auditor.md` — the sub-agent that runs the drift checks. Called directly; under an external AI Factory it is also wired into `/aif-verify`.
