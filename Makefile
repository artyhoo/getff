.PHONY: self-audit pre-commit-check pre-push-check install-hooks principles-meta-tests validate-prompts full-sweep demo demo-cargo consumer-matrix consumer-matrix-npm-tarball consumer-matrix-getff-dist

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

consumer-matrix: ## Run the consumer-matrix acceptance cells locally (launch-preannounce-track S2)
	@echo "▶ consumer-matrix: pnpm workspace monorepo start cell (real install.sh --full into a fresh fixture)"
	@FRAMEWORK_ROOT="$(CURDIR)" bash tests/consumer-matrix/pnpm-monorepo-cell.sh
	@echo "▶ consumer-matrix: npm-tarball cell (pack + install + run the consumer path against packages/core)"
	@FRAMEWORK_ROOT="$(CURDIR)" bash tests/consumer-matrix/npm-tarball-cell.sh
	@echo "▶ consumer-matrix: getff-dist cell (assemble + pack + install + getff init → planted violation fails)"
	@FRAMEWORK_ROOT="$(CURDIR)" bash tests/consumer-matrix/getff-dist-cell.sh

consumer-matrix-npm-tarball: ## Run the npm-tarball cell locally (beta-delivery-ux R1 — files allowlist + bin runnability)
	@echo "▶ consumer-matrix-npm-tarball: pack + install + run the consumer path against packages/core"
	@FRAMEWORK_ROOT="$(CURDIR)" bash tests/consumer-matrix/npm-tarball-cell.sh

validate-prompts: ## Validate all orchestrator batch-prompt files against spec
	@find .claude/orchestrator-prompts -name '*.md' -not -name 'README.md' | \
	  sort | \
	  while read -r f; do \
	    echo "Checking $$f ..."; \
	    npx tsx packages/core/spec-validation/validate-batch-spec.ts "$$f" || exit 1; \
	  done
	@echo "validate-prompts: all files passed."

consumer-matrix-getff-dist: ## Run the getff-dist cell locally (npm-publish-getff-init U10 — the `npx getff init` gate; GETFF_DIST_CELL_RED_ARMS=1 adds the paired-RED arms)
	@echo "▶ consumer-matrix-getff-dist: assemble packages/getff, pack, install, getff init -y ts-server, planted violation must fail"
	@FRAMEWORK_ROOT="$(CURDIR)" bash tests/consumer-matrix/getff-dist-cell.sh
