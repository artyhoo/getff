<!-- scope:operator-queue-followup -->
<!-- Operator queue item Q6 (handoff _handoff-2026-09-13-operator-queue-followup.md): research how
     zcode-plugins-official publishes and updates entries; answer the operator's update-ease question
     with evidence; produce a GO/NO-GO recommendation for Q8 (CDN submission). All probes live
     2026-09-13 from the HOST (web + curl + gh). -->

# zcode-plugins-official CDN — publication/update mechanics + Q8 recommendation

> **Authoritative for:** the 2026-09-13 evidence on how the `zcode-plugins-official` marketplace (CDN `https://cdn-zcode.z.ai/zcode/official-plugin/marketplace.json`) publishes and updates entries; the submission process for outside authors; the answer to the operator's «она тоже будет обновляться там легко?»; and the GO/NO-GO recommendation for queue item Q8.
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists). Distribution policy for getff — owner decision (this patch supplies the decision package, never the decision). Fork B leg (b) ask text — [done.md](../../orchestrator-prompts/zcode-plugin-firstclass/done.md) on staging remains the ask SSOT; this patch feeds it.

## §1 Scope and method

- HOST probes, 2026-09-13: `curl` of the CDN manifest (+ headers, adjacent paths), raw fetches of `zai-org/zcode-plugins` files (`marketplace.json`, `CONTRIBUTING.md`, `docs/distribution.md`), `gh api orgs/zai-org/repos`, web search (EN + adversarial counter-prompt), and the local plugin cache (`~/.zcode/cli/plugins/`) + [zcode.z.ai plugin docs](https://zcode.z.ai/en/docs/plugin). All quotes verbatim with source URLs.
- Negative-existence discipline: the interim hypothesis «no public submission channel exists» was **falsified mid-research** by the adversarial counter-prompt (§2 F6) — the sweep sequence is recorded honestly, per [phase-research-coverage.md §1](../../../.claude/rules/phase-research-coverage.md) item 4.
- No repo source files were edited; this document is the deliverable. Active traps self-applied: T3 (every load-bearing claim carries a verbatim quote or command output — §2), T15 (this self-review), plus one domain trap: **CDN-state-is-a-moving-target** — plugin counts and manifest contents are live state (26→19 between 2026-09-11 and 2026-09-13); every number herein is dated and must be re-probed before reuse.

## §2 Findings

### F1 — CDN entry structure: version-pinned zips + sha256, not commit tracking

`curl -s https://cdn-zcode.z.ai/zcode/official-plugin/marketplace.json` → `name: zcode-plugins-official`, **19 plugins** (HOST fact 2026-09-11 recorded 26 — entries were since removed; count is live state, not a constant). Every entry:

```json
"source": { "source": "url", "type": "zip",
  "url": "https://cdn-zcode.z.ai/zcode/official-plugin/plugins/<name>/<version>/plugin.zip",
  "sha256": "<64-hex>", "path": "<name>" },
"version": "<semver>"
```

Headers: `server: Tengine`, `x-oss-*` (Aliyun OSS bucket behind a CDN), `cache-control: max-age=60`. Top-level keys: `name, description, description_i18n, owner, plugins` — `owner: {name: "Z.ai", url: "https://z.ai"}`, description: *"Official ZCode plugins marketplace: built-in and community plugins for ZCode."* No contact/submission meta field. Adjacent docs 404 (`CONTRIBUTING.md`, `README.md` at BASE).

### F2 — Source of truth: `github.com/zai-org/zcode-plugins` (linkage verified)

The repo's `main` `marketplace.json` is **identical** to the CDN manifest: same `name` (`zcode-plugins-official`), 19/19 plugin names, and version-for-version agreement (`diff` of `name=version` sets → empty). Repo README: *"the official plugins marketplace for ZCode, featuring plugins maintained by ZCode and contributions from the community"*; *"ZCode includes the official marketplace"*; *"Accepted changes are published through the official release process."* Repo layout: `plugins/<name>/` sources + root `marketplace.json` registry + `scripts/validate.py`, `scripts/build_dist.py` + docs/tests. Apache-2.0.

### F3 — Submission process EXISTS and is documented (PR-based)

From the repo README Contributing + `CONTRIBUTING.md`:

- *"Copy `plugins/example-plugin/` to `plugins/<your-plugin-name>/` and follow the development tutorial."*
- *"Register the plugin in `marketplace.json`, including its category."*
- *"Provide equivalent English and Chinese documentation."* (both-language READMEs are a PR-checklist item)
- Local checks: `python3 scripts/validate.py` and `python3 scripts/build_dist.py` from repo root.
- *"Open a GitHub pull request and complete the contribution checklist."* Conventional Commits title, e.g. `feat(example-plugin): add a greeting skill`.
- Review scope: *"Maintainers review functionality, safety, maintainability, compatibility, provenance, and licensing."*

No issue-template intake; PR is the channel. No account/credentials beyond a normal GitHub account (fork + PR).

### F4 — Update mechanics: version immutability + maintainer-gated publication, no SLA

`CONTRIBUTING.md` «Versions and release»: *"Installed plugin content is immutable once published. If installable content changes, bump the semantic version in both the plugin manifest and the matching `marketplace.json` entry. Never reuse a published version."* On merge: *"Accepted changes enter the official release process; the pull request will receive a publication or follow-up status update."* **No latency/SLA is stated anywhere.** An update = author PR (bump both version fields + regenerate dist), maintainer review, Z.ai-side release process republishes the CDN.

### F5 — Client-side update flow (what a getff consumer experiences)

[docs/distribution.md](https://raw.githubusercontent.com/zai-org/zcode-plugins/main/docs/distribution.md): fetch `BASE/marketplace.json` → compare declared version vs installed → download zip → **sha256 verification mandatory** (*"Installation must stop if verification fails"*) → atomic replace. [zcode.z.ai/en/docs/plugin](https://zcode.z.ai/en/docs/plugin): *"the 'latest version' comes from the version declared in the marketplace's marketplace.json entry"*; *"If a marketplace entry ships without bumping its version, no update is offered even when the plugin code has changed"*; the check *"runs against the locally cached marketplace manifest"* — user refreshes via Marketplace sources → *Refresh* / *Check for updates*. (Consistent with zcode-guide pitfall 9 — `0.0.0`/no-update cases trace to missing version bumps, and with our Stage-3 live evidence: GitHub-marketplace 0.2.0→0.3.0 Update picked up once the manifest version moved.)

### F6 — Search-coverage record (checklist items 1–7)

1. **Own-stack:** zcode-guide plugin docs (cache grep — plugin/marketplace mechanics only, no submission channel); live ZCode app Discover tab (Stage-3 evidence: adds marketplaces, no submit surface); CDN manifest meta (F1: none); CC analog `claude-plugins-official` (a GitHub marketplace — the contrast case). 2. **Category sweep:** official docs page; GitHub org repos (`gh api orgs/zai-org/repos` → `zai-coding-plugins` (CC-only GLM-plan plugins, not this catalog) and **`zcode-plugins`** — hit); CDN bucket adjacent files (404); in-app UI (none); community channels (none found connected). 3. **Semantic distance:** searched beyond «submit plugin» — «publish», Chinese variants; docs page covers self-distribution only. 4. **Adversarial counter-prompt:** *«if a submission channel existed it would live in a GitHub org repo or a CONTRIBUTING doc»* → `zai-org/zcode-plugins` — **surfaced and falsified the interim no-channel hypothesis**. 5. Past the 3-candidate floor. 6. Trigger sweep: `grep -nE "^### 13." docs/meta-factory/open-questions.md` — no §13.x entry covers CDN/marketplace distribution (nothing to fire). 7. Recommendation self-discipline: §4.

### F7 — Contrast: the GitHub-marketplace path (Fork B leg a) is self-serve

`artyhoo/getff` as a ZCode/CC marketplace: an update is a git push of the bumped `plugin.json`/`marketplace.json` — consumer refresh picks it up. **Live-verified 2026-09-13** (zcpf Stage 3): Update button moved a consumer 0.2.0→0.3.0 with real top-level version. No third party in the loop.

### F8 — Cost for getff specifically: vendored copy + bilingual docs

A submission vendors our plugin into their tree (`plugins/getff/`), built by their `build_dist.py` into their versioned zips. Our repo stays the SSOT; their copy must be bumped per release (dual-source discipline — a sync obligation the getff side owns, same class as our existing plugin-twins regen lists). Requirements we do not currently carry: **EN+CN READMEs** for the plugin dir, a `category` registration, and their `validate.py` passing. Skills-only payload is expected to fit `example-plugin`'s shape (their own plugins ship skills/hooks).

## §3 Answer to the operator's question

«да -но финальную версию уже или она тоже будет обновляться там легко?» → **Updates are possible and documented, but not "easy" in the self-serve sense**: each release costs a GitHub PR to `zai-org/zcode-plugins` (version bump in two places + regenerated dist + bilingual docs kept current) plus a maintainer review round whose latency has **no stated SLA**. The GitHub-marketplace path (leg a) remains the zero-friction channel; the CDN listing buys Discover-tab visibility inside ZCode's built-in catalog at the cost of per-update review latency and a vendored copy.

## §4 GO/NO-GO recommendation for Q8

**CONDITIONAL GO — defer execution to the operator (floor: externally-visible submission + credentials + distribution policy).**

- The operator's stated precondition — *answer update-ease with evidence before any submission* — is now met (§3/§4 evidence).
- GO is justified **iff** the operator accepts: (1) per-update maintainer latency (no SLA), (2) a vendored plugin copy in `zai-org/zcode-plugins` that we must re-sync each release, (3) EN+CN plugin READMEs and category registration, (4) an initial review of the whole getff payload (functionality/safety/licensing/provenance per F3).
- NO-GO triggers (reversal): if ZCode's plugin surface gains a first-party self-serve channel, or if the per-update PR overhead proves disproportionate to Discover-tab traffic, stay on leg (a) only.
- If GO: the executing step is a fork + PR against `zai-org/zcode-plugins` following F3 exactly (example-plugin template, category, bilingual READMEs, `validate.py` + `build_dist.py` clean, Conventional Commits title). Owner credentials required; nothing in this patch submits anything.

### §1.7 Forward-check applied

- Complies with [phase-research-coverage.md](../../../.claude/rules/phase-research-coverage.md) §1 items 1–7 (coverage recorded in F6; item-7 forward/backward in this block), [research-source-trust.md](../../../.claude/rules/research-source-trust.md)-class sourcing (every load-bearing claim quotes a primary source: CDN manifest, repo files, official docs — no blog-only claims), and [doc-authority-hierarchy.md](../../../.claude/rules/doc-authority-hierarchy.md) (Class/Authoritative-for header present; distribution policy stays with the owner, this patch is a decision package).
- Does not touch any code, hook, or rule surface — no gate arm can regress from this diff (`git show --stat`: 1 new research-patch file).

### §1.7 Backward-check applied

- Class of this change = «a new research-patch under `docs/meta-factory/research-patches/`». Surfaces: the accumulator directory (`ls docs/meta-factory/research-patches/*.md | wc -l` → 100+ patches on staging) — SWEPT-CLEAN: this patch follows the same header/format conventions as the existing population (scope comment, Authoritative-for block, verdict/finding structure, §1.7 self-note; mirrored on `2026-09-12-zcode-plugin-firstclass-s0.md:1-25`).
- Supersedes: the interim «the community-CDN process is UNRESEARCHED — do not assert update-ease without a probe» stance carried by the zcpf closure set — now researched with evidence. Sweep: `git grep -l 'zcode-plugins-official' origin/staging` → exactly 5 tracked files (`zcode-plugin-firstclass/done.md`, `…/kickoff.md`, `research-patches/2026-09-10-zcode-full-parity-rphase-survey.md`, `…-s0.md`, `…-s1-decision-pack.md`); none asserted submission/update mechanics (they record the CDN existence fact and the open question). `git grep -l 'cdn-zcode' origin/staging` → 0 tracked files — the URL itself appears only in untracked session handoffs, so this patch is also the first tracked record of the CDN endpoint.
