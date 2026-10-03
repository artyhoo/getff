#!/usr/bin/env bash
# check-doc-links.sh — an offline link check of every Markdown file this project has committed, getff's
# own shipped docs excluded (getff installs it as scripts/check-doc-links.sh). It is the pre-push hook's
# lychee section run over the whole tree instead of the pushed range: the project's record
# (.ai-factory/tool-decisions.md, aif:project-checks) arms it once it exits 0, and until then the
# pre-push hook prints «not armed» instead of blocking a first push over a link the project already had
# (P2, advisor: the P6 blocker class). No lychee → exit 3, so it never arms without the tool.
command -v lychee >/dev/null 2>&1 || { echo "lychee is not installed — the doc link check cannot run"; exit 3; }
cd "$(dirname "$0")/.." || exit 2
# The empty tree as the base: every committed Markdown file counts as changed.
GETFF_SECTION_DIRECT=1 PREPUSH_ONLY=lychee PREPUSH_UPSTREAM_REF=4b825dc642cb6eb9a060e54bf8d69288fbee4904 \
  exec node packages/core/hooks/pre-push.bundle.mjs < /dev/null
