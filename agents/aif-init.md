---
name: aif-init
description: Generate a draft .ai-factory/DESCRIPTION.md and .ai-factory/ARCHITECTURE.md for a consumer repo. Reads package.json(s) and directory layout, detects the tech stack, and writes a filled draft with a DRAFT review banner. Use after installing AI Factory, or whenever DESCRIPTION.md still contains <PLACEHOLDER> fields. Invoke as `/aif-init` in your AI session.
tools: Read, Glob, Write
---

# aif-init — Generate project passport from repo analysis

> **Authoritative for:** `aif-init` sub-agent prompt — passport generation for consumer projects (DESCRIPTION.md + ARCHITECTURE.md) from deterministic repo signals; shipped to consumer `.claude/agents/aif-init.md` via `install.sh`.
> **NOT authoritative for:** project goal — see consumer's README.md. AIF framework architecture — see the AIF docs.

You are reading this in your active AI session (Claude Code, Cursor, Codex, Aider, or any IDE-integrated assistant). This agent makes no external LLM API calls; it runs on your existing subscription. Never call a paid API to generate this output — use only what you observe in the repo.

---

## What this does

Reads the consumer repo's `package.json`(s), directory layout, and config files to detect the tech stack, then writes:

- `.ai-factory/DESCRIPTION.md` — project description with detected stack values (zero `<PLACEHOLDER>` fields)
- `.ai-factory/ARCHITECTURE.md` — architecture pattern appropriate to the detected stack

Both files are written as DRAFT. The human must review, edit, and remove the DRAFT banner before the files are authoritative.

---

## Step 1 — Detect the stack (deterministic, no LLM)

Read the following files in order:

**Root package.json:**

```text
Read: package.json
```

**Monorepo workspaces (if root package.json has `"workspaces"`):**

```text
Glob: apps/*/package.json
Glob: packages/*/package.json
```

Read each workspace `package.json` found. Aggregate all `dependencies` and `devDependencies` across root + workspaces into one flat set.

**Config files:**

```text
Glob: drizzle.config.*
Glob: prisma/schema.prisma
Glob: drizzle/schema.ts
Glob: src/db/schema.ts
Glob: next.config.*
```

**Directory layout clues:**

```text
Glob: apps/*/
Glob: packages/*/
Glob: src/
```

### Detection table

Apply this table to the aggregated dep set. First match wins per field.

| Dep present                                                           | Field         | Value         |
| --------------------------------------------------------------------- | ------------- | ------------- |
| `hono`                                                                | framework     | Hono          |
| `next`                                                                | framework     | Next.js       |
| `fastify`                                                             | framework     | Fastify       |
| `express`                                                             | framework     | Express       |
| `react` or `@types/react` (no `next`)                                 | framework     | React         |
| `pg` or `@neondatabase/serverless` or `postgres`                      | database      | Postgres      |
| `mysql2`                                                              | database      | MySQL         |
| `better-sqlite3` or `@libsql/client`                                  | database      | SQLite        |
| `drizzle-orm`                                                         | orm           | Drizzle       |
| `@prisma/client` or `prisma`                                          | orm           | Prisma        |
| `kysely`                                                              | orm           | Kysely        |
| `@honeycombio/opentelemetry-node` or `@honeycombio/opentelemetry-web` | observability | Honeycomb     |
| `dd-trace` or `datadog-lambda-js`                                     | observability | Datadog       |
| `@grafana/faro-web-sdk`                                               | observability | Grafana Cloud |
| `@opentelemetry/api`                                                  | observability | OpenTelemetry |
| `vitest`                                                              | testRunner    | Vitest        |
| `jest` or `@jest/core`                                                | testRunner    | Jest          |
| `expo`                                                                | mobile        | Expo          |
| `react-native`                                                        | mobile        | React Native  |
| `@storybook/nextjs` or `@storybook/react` or `storybook`              | ui            | Storybook     |

**DB schema path:** check if any of these files exist:

- `drizzle/schema.ts` → use this path
- `src/db/schema.ts` → use this path
- `packages/db/src/schema.ts` → use this path
- `prisma/schema.prisma` → use this path

**Project name:** from root `package.json` `.name` field (strip scope prefix `@org/` if present).

**Handling null detections:** If a field is not detected, write `[GUESSED — verify]` as a placeholder comment next to a reasonable default. Do NOT leave `<…>` angular-bracket placeholders. NEVER guess silently — mark every guessed value.

---

## Step 2 — Generate DESCRIPTION.md

Using the detected values, write `.ai-factory/DESCRIPTION.md`. Ground every claim in the detected evidence from Step 1. Do not invent stack choices; if a field is undetected, say so explicitly.

Template (fill all `${DETECTED_*}` slots with detected values or `[GUESSED — verify]`):

```markdown
> ⚠️ **DRAFT — PLEASE REVIEW**
> Auto-generated by `/aif-init` from repo signals. Verify all fields, edit where needed, then remove this banner.
>
> **Authoritative for:** consumer-project description — domain / stack / constraints / non-goals (DRAFT).
> **NOT authoritative for:** project goal — see consumer's README.md.

# ${DETECTED_PROJECT_NAME}

## What it is

[One paragraph — infer from the project name, detected stack, and directory layout. For example: "A ${DETECTED_FRAMEWORK} API service using ${DETECTED_ORM} over ${DETECTED_DATABASE}." Do not fabricate domain details you cannot see in the repo.]

## Stack

- **Runtime:** Node.js 22+
- **Language:** TypeScript (strict)
- **Framework:** ${DETECTED_FRAMEWORK or "[GUESSED — verify]"}
- **Database:** ${DETECTED_DATABASE or "[GUESSED — verify]"} + ${DETECTED_ORM or "[GUESSED — verify]"}
- **Validation:** Zod (inferred — verify)
- **Tests:** ${DETECTED_TEST_RUNNER or "[GUESSED — verify]"}
- **Lint:** ESLint + Prettier (inferred — verify)
- **Observability:** ${DETECTED_OBSERVABILITY or "[not detected — verify]"}${DETECTED_MOBILE ? "\n- **Mobile:** " + DETECTED_MOBILE : ""}${DETECTED_UI ? "\n- **UI layer:** " + DETECTED_UI : ""}

## Hard constraints

[Leave blank or fill with project-specific rules found in RULES.md, if present.]

## Non-goals

[Leave blank — the human knows what is out of scope.]

## Source-of-truth pointers

- DB schema: `${DETECTED_DB_SCHEMA_PATH or "[not detected — verify]"}`
- Rules R1–R20 (enforced): `.ai-factory/RULES.md`
- Layer rules: `.ai-factory/ARCHITECTURE.md`
```

**Zero-placeholder rule:** Before writing, verify that your output contains no `<…>` angular-bracket placeholder tokens. Replace each with a detected value or a `[GUESSED — verify]` annotation. A file with `<…>` tokens is a failed output.

---

## Step 3 — Generate ARCHITECTURE.md

Choose the template based on the detected framework:

- `next` detected → start from `ARCHITECTURE.react-next.md` template (Next.js App Router / React patterns)
- anything else → start from `ARCHITECTURE.ts-server.md` template (hexagonal / clean arch)

If neither template file exists in `.ai-factory/`, write a minimal structure:

```markdown
> ⚠️ **DRAFT — PLEASE REVIEW**
> Auto-generated by `/aif-init`. Verify layer rules for your specific architecture.
>
> **Authoritative for:** layer structure and dependency direction for this project (DRAFT).
> **NOT authoritative for:** project goal — see consumer's README.md.

# Architecture

## Layer structure

[Infer from directory layout. If `src/domain/`, `src/application/`, `src/infrastructure/` exist → hexagonal. If `app/` (Next.js App Router) → frontend-first. Otherwise describe what you observe.]

## Dependency rules

[Infer from detected stack. Always state: no cycles; domain imports nothing internal.]
```

---

## Step 4 — Write the files

```text
Write: .ai-factory/DESCRIPTION.md  ← content from Step 2
Write: .ai-factory/ARCHITECTURE.md ← content from Step 3
```

The `Write` tool creates the parent directory automatically if `.ai-factory/` does not exist.

**Do NOT overwrite** if the target file already exists AND does not contain `<PLACEHOLDER>` tokens — it has already been filled by a human. Ask before overwriting.

---

## Review gate (non-negotiable)

Both files are written as DRAFT. The `⚠️ DRAFT — PLEASE REVIEW` banner must remain in the output. The human removes the banner after reviewing and confirming all fields.

Tell the user:

> Both files have been written as DRAFT. Please open `.ai-factory/DESCRIPTION.md` and `.ai-factory/ARCHITECTURE.md`, verify every field (especially `[GUESSED — verify]` annotations), edit where needed, then remove the `> ⚠️ DRAFT` banner. Once verified, these files become the authoritative project passport loaded by every AI agent at session start.

---

## Degradation (no AI session)

If this agent is invoked outside an AI session (e.g. from a script), it cannot proceed — the LLM step is required for prose synthesis. In that case, fall back to the template files:

```text
.ai-factory/DESCRIPTION.template.md  → copy to DESCRIPTION.md and fill manually
.ai-factory/ARCHITECTURE.ts-server.md → copy to ARCHITECTURE.md and edit
```

The installer already copies these templates. Never error; always provide a fallback path.
