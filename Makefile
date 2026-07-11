.PHONY: self-audit pre-commit-check pre-push-check install-hooks principles-meta-tests validate-prompts full-sweep demo demo-cargo

self-audit: pre-commit-check pre-push-check principles-meta-tests

demo: ## Regenerate the two README demo GIFs (needs: brew install vhs)
	@bash demo/setup-sandbox.sh
	@vhs demo/violation-blocked.tape
	@cp .claude/rules/ci-tool-pinning.md /tmp/ci-tool-pinning.md.bak
	@trap 'cp /tmp/ci-tool-pinning.md.bak .claude/rules/ci-tool-pinning.md' EXIT; vhs demo/doc-drift-gate.tape

# guard-liveness v2 — periodic FULL-SWEEP over the entire manifest (last-resort
# backstop; the change-scoped pre-push gates cover the per-PR delta). Run before
# landing the v2 workflow to confirm the ≤5-min budget (kickoff §3.2 / §4).
full-sweep: ## Run guard-liveness full-sweep over all manifest rules (v1 + v1.5 + v3 structural)
	@npm --prefix packages/core run guard-liveness:fullsweep

demo-cargo: ## Cargo honest demo — planted violation blocked (RED), conforming crate passes (GREEN); needs cargo+clippy
	@npm --prefix packages/core run demo:cargo

pre-commit-check:
	@.husky/pre-commit

pre-push-check:
	@.husky/pre-push

principles-meta-tests:
	@npm --prefix packages/core run test:principles

install-hooks:
	@chmod +x .husky/pre-commit .husky/pre-push
	@git config core.hooksPath .husky
	@echo "✓ Hooks installed (git config core.hooksPath .husky)"

validate-prompts: ## Validate all orchestrator batch-prompt files against spec
	@find .claude/orchestrator-prompts -name '*.md' -not -name 'README.md' | \
	  sort | \
	  while read -r f; do \
	    echo "Checking $$f ..."; \
	    npx tsx packages/core/spec-validation/validate-batch-spec.ts "$$f" || exit 1; \
	  done
	@echo "validate-prompts: all files passed."
