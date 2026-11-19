#!/usr/bin/env sh
# @aif-shield: pre-commit — framework-owned persistence hook. husky_note_consumer_hooks greps
# this exact token to tell getff's own delivery from a consumer's hook (same marker as the
# npm-lane pre-commit since #1001); without it a getff-delivered generic pre-commit would read
# as the consumer's and never refresh. Do NOT remove this line.
# Generic-stack persistence pre-commit (route B, N1): NOT a blocking channel by design.
# --probe runs each not-armed project check bounded and arms a green one into the per-clone
# sidecar (never fails the commit); --fold moves sidecar-flipped lines into the tracked record
# (.ai-factory/tool-decisions.md) and stages only that file (never fails the commit either).
# The BLOCKING channel for the drivable-generic subset is CI: .github/workflows/getff-rules.yml
# (`bash scripts/run-armed.sh validate`). No lint-staged / npx / zcode here — none of them are
# delivered on stack «generic» (setup.d/50-hooks.sh F2 delivers exactly this file).
#
# Install: place at .husky/pre-commit and run `chmod +x .husky/pre-commit`
if [ -f scripts/run-armed.sh ]; then
  bash scripts/run-armed.sh --probe || true
  bash scripts/run-armed.sh --fold || true
fi
