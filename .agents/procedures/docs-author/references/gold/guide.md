---
title: Add the design and review skills
description: Move a project from the rules-only install to the one that also teaches your agent to design, review, and run multi-step work.
kind: guide
sources:
  - docs/site/reference/B.md
  - docs/site/terms.md
  - install.sh
  - setup.d/10-skills.sh
  - setup.d/lib.sh
executed:
  - { example: dry-run-env, stack: ts-server, date: 2026-09-20, result: exit-0 }
  - { example: install-env, stack: ts-server, date: 2026-09-20, result: exit-0 }
  - {
      example: verify-skills-folder,
      stack: ts-server,
      date: 2026-09-20,
      result: eleven-skills,
    }
---

# Add the design and review skills

You installed getff with `--profile core` and got rules, gates, and six
[skills](../../../../../docs/site/terms.md#skill). That is enough to stop bad code. It does not yet help your
agent with the work around the code: shaping an idea into a design, reviewing a result
with a clear verdict, or carrying a long task through without you. Five more skills do
that. This guide adds them to a project that already has getff. Nothing you have now
is overwritten.

The five skills are `arch`, `night-mode`, `orchestrator`, `pipeline`, and `reviewer`.
The [skills overview](../../../../../docs/site/reference/B.md) says what each one is for.

## Prerequisites

- A project where getff is already installed at the `core` [depth](../../../../../docs/site/terms.md#depth).
  This guide uses a `ts-server` project.
- A local clone of getff. The examples assume it is at `/tmp/rt`.
- Claude Code, if you want the skills to load by themselves. Any other agent can still
  read the files.

## Steps

1. Preview the change. From your project root, run the installer in dry-run mode. It
   prints the plan and writes nothing.

   ```bash
   bash /tmp/rt/setup --dry-run --profile env ts-server
   ```

   Look for the skills part of the plan. Your six skills are skipped, and five are new.
   The output below is the skills part only. The lines before and after it are left
   out, and the long absolute paths are cut to `…`. Nothing else is changed.

   ```text
   [profile] env
   ▶ Installing rules-as-tests-aif into … (stack: ts-server)
   ▶ Skills → .claude/skills/
     [dry-run] would mkdir: …/.claude/skills
     [dry-run] would skip: .claude/skills/getff (exists)
     [dry-run] would skip: .claude/skills/tool-bootstrapping (exists)
     [dry-run] would skip: .claude/skills/template-audit (exists)
     [dry-run] would skip: .claude/skills/ai-doc (exists)
     [dry-run] would skip: .claude/skills/rule-research (exists)
     [dry-run] would skip: .claude/skills/rule-tests (exists)
     ▶ Contour surface (profile=env+ OR --with-aif-suite): arch night-mode orchestrator pipeline reviewer
     [dry-run] would copy: …/.claude/skills/arch → …/.claude/skills/arch (+ transform internal refs)
     [dry-run] would copy: …/.claude/skills/night-mode → …/.claude/skills/night-mode (+ transform internal refs)
     [dry-run] would copy: …/.claude/skills/orchestrator → …/.claude/skills/orchestrator (+ transform internal refs)
     [dry-run] would copy: …/.claude/skills/pipeline → …/.claude/skills/pipeline (+ transform internal refs)
     [dry-run] would copy: …/.claude/skills/reviewer → …/.claude/skills/reviewer (+ transform internal refs)
   ```

   "Transform internal refs" means the installer rewrites links inside each skill so they
   point at files in your project.

2. Run the install. The `-y` flag answers the prompts for you.

   ```bash
   bash /tmp/rt/setup -y --profile env ts-server
   ```

   ```text
   ▶ Skills → .claude/skills/
     ⊝ .claude/skills/getff (exists — skipping)
     ⊝ .claude/skills/tool-bootstrapping (exists — skipping)
     ⊝ .claude/skills/template-audit (exists — skipping)
     ⊝ .claude/skills/ai-doc (exists — skipping)
     ⊝ .claude/skills/rule-research (exists — skipping)
     ⊝ .claude/skills/rule-tests (exists — skipping)
     ▶ Contour surface (profile=env+ OR --with-aif-suite): arch night-mode orchestrator pipeline reviewer
     ✓ .claude/skills/arch/ (cross-refs rewritten to https://github.com/artyhoo/getff/blob/main)
     ✓ .claude/skills/night-mode/ (cross-refs rewritten to https://github.com/artyhoo/getff/blob/main)
     ✓ .claude/skills/orchestrator/ (cross-refs rewritten to https://github.com/artyhoo/getff/blob/main)
     ✓ .claude/skills/pipeline/ (cross-refs rewritten to https://github.com/artyhoo/getff/blob/main)
     ✓ .claude/skills/reviewer/ (cross-refs rewritten to https://github.com/artyhoo/getff/blob/main)
   ```

   The run ends with the installer's [self-check](../../../../../docs/site/terms.md#self-check), the same
   one your first install ran:

   ```text
   ✓ self-verify: 3/3 checks passed — fences fire, shields wired (form check), generated tests non-vacuous
   ```

3. Commit the new folders, so your team and your CI agents get the same skills.

## Verify

List the skills folder:

```bash
ls .claude/skills
```

You should see eleven names, the six you had plus the five new ones:

```text
ai-doc
arch
getff
night-mode
orchestrator
pipeline
reviewer
rule-research
rule-tests
template-audit
tool-bootstrapping
```

Then open Claude Code in the project and type `/arch`. If the skill starts, the agent
can see it.

## Variations

- **You want every file re-copied, not skipped.** The installer keeps files that exist.
  That protects your edits, and it also means you keep old copies. To take the current
  version of a shipped file, add `--refresh`. Read the dry-run plan first: a refresh
  replaces shipped files.
- **You run the task runtime too.** Use `--profile factory`. It adds five more skills
  that drive that runtime. They are of no use without it.
- **A fresh project.** You do not need two installs. A non-interactive install with no
  `--profile` flag already gives you `env`.
- **The `cargo` and `go` lanes.** These installs ship no skills at any depth yet, so
  this guide does not apply to them.
