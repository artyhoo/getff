# F8/F9 — toolchain consumer instructions

Decision: retain one shared template, add a toolchain detection row and scoped native walkthroughs. Per-lane rendering would duplicate the context contract; a fourth row plus installed-file guards expresses the actual delivery.

Population pinned before edits: shared AGENTS, AI Usage Guide, DESCRIPTION, CLAUDE, first-steps source JSON, and INSTALL-FOR-AI; canonical paths are indexed by packages/core/templates/shared/templates.manifest.json. Npm copies the shared templates; Python copies AGENTS/passports/guide plus four research skills and two agents. Cargo/Go copy native configs, locks and workflows, without an agent context surface. No rendered distribution copy is edited.

The first-steps JSON carries native command blocks and the landing facts renderer preserves that field. The integration test compares every native block against the source arrays. Existing npm sequence IDs and titles remain stable.

RED: a real `setup python --profile core` succeeded against all production preimages together, then its delivered guide instructed an absent check-rule-globs script. GREEN: actual delivered Python context paths and four skills resolve, no npm audit/tier-home is assumed, and copied commands run without hidden shell flags. Clean source passes; planted eval and Ruff banned datetime calls fail. A kept flow-list sgconfig makes bare ast-grep falsely pass, while the explicit delivered-rule loop fails. Blocks carry their own fail-fast behavior.

Cargo selection was independently live-fired: isolated selected Clippy bans reject std::env::var (exit 101), clean control passes. Go selection follows the delivered workflow's reference-first config and forced forbidigo; no local golangci binary was available, so live Go firing is not proven here.

Falsifiers: any native command names an absent delivered path, copied block masks an earlier failed check, native JSON differs from guide, or Python env/factory assumes npm contour skills. Cold review found and closed these cases. Existing installer config-collision REFUSE behavior is retained; this change selects delivered rules explicitly instead of claiming the preserved consumer config was wired.

Gap: generic cargo/Go consumer prose is read from the framework's canonical guide or installer log rather than copied to those trees; native delivery owns their workflow/config surface. No new agent roster is promised.
