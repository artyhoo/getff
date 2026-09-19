---
title: Terms
description: The site glossary — what each term means here, which spellings are wrong, and the registry of artifact names.
kind: glossary
sources:
  - docs/superpowers/specs/2026-09-14-getff-ai-docs-quality-contract-design.md
---

# Terms

This page fixes the words the site uses. Every page is expected to use a term as it is
defined here, and to link to this page on first mention. When two spellings of one idea
exist, the entry below says which one to use — and the Vale profile enforces the
name-class entries mechanically.

## Terms

Each entry gives a one-sentence definition and the forms that must not be used. An entry
marked `Do not use (name):` is **name-class**: its forbidden forms are compiled into the
Vale substitution rule and fail the build. A plain `Do not use:` list is guidance the
form auditor judges. Definitions are claims and belong to the claims auditor's scope,
not to this page's enforcement.

<!-- vale off -->
<!-- vale-reason: the entries below exist to name the forbidden spellings; suppressing the substitution rule on this block is the page's whole point -->

### getff

The framework this site documents — an installable convention set that makes agent
guardrails executable tests rather than prose promises.

Do not use (name): AI Factory — the project's former name, retired; it survives in
history documents only.

### Claude Code

The coding agent CLI the framework's hooks and skills run inside.

Do not use (name): CC — the abbreviation collides with plain-text license names and is
not expanded at first use anywhere on the site.

### sub-agent

A delegated agent session spawned by another agent session, with its own context window.

Do not use (name): subagent — the closed compound hides the word boundary and reads
worse in headings.

### artifact

A thing the framework produces or installs — a hook, a skill, a rule file, a report.

Do not use (name): artefact — the British spelling; this site uses the American form
everywhere.

<!-- vale on -->

## Artifact names

The registry of artifact names the site may refer to, generated from the reference
families' member registries. Names only — the definitions live on the artifacts' own
pages.

<!-- getff:begin section=artifact-names plan=scripts/render-reference.mjs -->
<!-- generated region: filled by the D29 generator's terms.md arm (not yet built — the
     reference family JSONs under docs/site/reference/ are the interim registry). -->
<!-- getff:end section=artifact-names -->
