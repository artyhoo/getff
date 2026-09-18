#!/usr/bin/env bash
# s0q-pre-commit-section.sh — the docs-check + render-terms-style pre-commit sections,
# reconstructed for hand-apply.
#
# WHY THIS FILE EXISTS: `Edit(.husky/**)` / `Write(.husky/**)` are in the checked-in
# `.claude/settings.json` permissions.deny, so no agent session can stage these sections
# directly (plan finding F-11 anticipated the fork; its fallback — reconstructed hunk in the
# PR body, S0a precedent — is what you are reading). Filesystem-wise .husky/pre-commit IS
# node-owned 755; the wall is the session permission layer, not the FS.
#
# APPLY (maintainer, at harvest): insert BOTH blocks below into .husky/pre-commit, in this
# order, immediately AFTER the markdownlint-cli2 section (the one ending
# `npx markdownlint-cli2 $STAGED_MD …`) and BEFORE the «`path:line` blank landing» section.
# Indentation is two spaces, matching the sibling sections. Until BOTH are applied, the only
# reachable channel for these gates is the audit-self.yml docs-quality job (D-Q6; the
# second block closes the rework-round-1 finding that render-terms-style --check had no
# channel at all).
#
# ──8<── begin section ──────────────────────────────────────────────────────────────
# ── docs-check on staged docs-site / docs-prose markdown (D-Q6 pre-commit channel) ──────
#   spec: docs/superpowers/specs/2026-09-14-getff-ai-docs-quality-contract-design.md (D-Q2, D-Q6, D-Q17)
#   Lenient severity here, by design: on an author machine an absent vale/lychee binary is a
#   loud SKIP, not a failure (strict — absent = ERROR — is the audit-self.yml docs-quality
#   job). What still blocks here: the pure structural gates, which always run (C13
#   frontmatter, C12 skeleton, the D-Q12 escape grammar, D-Q18 sources), and any finding
#   from a tool that IS present. --changed mirrors the markdownlint section above: the
#   index, not the worktree. Cheap when nothing in either profile is staged — the checker
#   exits before spawning any binary.
if [ -n "$STAGED_MD" ]; then
  if command -v node &>/dev/null; then
    node scripts/docs-check.mjs --changed \
      || { echo "❌ docs-check violations — fix before commit (escapes: D-Q12 two-comment form, reason ≥20 chars)"; fail=1; }
  fi
fi
# ──8<── end section ────────────────────────────────────────────────────────────────
#
# ──8<── begin section ──────────────────────────────────────────────────────────────
# ── render-terms-style drift gate — Names.yml must match terms.md region (a) (D-Q7) ─────
#   spec: docs/superpowers/specs/2026-09-14-getff-ai-docs-quality-contract-design.md (D-Q6, D-Q7)
#   UNCONDITIONAL, unlike the docs-check arm above — this is a drift gate over the GENERATED
#   artefact, the same behavior class as the sibling pre-push generator checks
#   (manifest-render / rule-index-render / reference-render / face-facts-render): it fails
#   whenever the generated Vale rule has gone stale relative to its source, whether or not
#   this commit touched either file. Cheap (two small reads, one render, one compare — no
#   binary spawned); the failure message names the one-command fix.
if command -v node &>/dev/null; then
  node scripts/render-terms-style.mjs --check \
    || { echo "❌ Names.yml drifted from docs/site/terms.md region (a) — fix before commit: node scripts/render-terms-style.mjs --write"; fail=1; }
fi
# ──8<── end section ────────────────────────────────────────────────────────────────
#
# Post-apply live-fire (each must go RED on a seeded defect before trusting it):
#   printf -- '---\ntitle: t\ndescription: d\nkind: guide\n---\n\n# t\n\n## Prerequisites\n\n## Steps\n\n## Variations\n' > docs/site/_s0q-probe.md
#   git add docs/site/_s0q-probe.md && git commit -m probe   # expect: ❌ docs-check violations (frontmatter+skeleton)
#   git reset docs/site/_s0q-probe.md && rm docs/site/_s0q-probe.md
#   # render-terms arm: tamper the generated artefact, expect ❌ Names.yml drifted, then restore
#   cp docs/site-quality/vale/styles/getff/Names.yml /tmp/Names.yml.bak
#   printf '  "tampered": "widget"\n' >> docs/site-quality/vale/styles/getff/Names.yml
#   git commit -m probe --allow-empty   # expect: ❌ Names.yml drifted from docs/site/terms.md region (a)
#   cp /tmp/Names.yml.bak docs/site-quality/vale/styles/getff/Names.yml && rm /tmp/Names.yml.bak
exit 0
