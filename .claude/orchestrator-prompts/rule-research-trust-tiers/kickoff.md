<!-- scope: kickoff — rule-research-trust-tiers umbrella (R-phase inlined; dispatch = I-phase stages) -->

# rule-research-trust-tiers — kickoff

> **Goal of this umbrella:** replace the hardcoded 7-key documentation-source allowlist
> (`packages/core/research/allowlist.ts:8-17`) with a **tiered, registry-derived trust model**
> so live rule-research scales to *any language/stack* (maintainer vision, 2026-07-02 dialogue)
> without abandoning fail-closed provenance. NOT a goal change — serves
> [README.md#why-this-exists](../../../README.md#why-this-exists) (rules from live docs stay
> executable + provenance-carrying); expands the surface the existing goal covers.
> **R-phase status:** DONE INLINE (this kickoff carries the threat model + prior-art evidence,
> deep-research 2026-07-02, 5 threads × cited sources). Dispatch = I-phase stages S1-S4 below.

---

## §1 Problem + evidence

- `packages/core/research/allowlist.ts:8-17` — `ALLOWED_SOURCES` is a hardcoded const with
  **7 keys** (next, react, react-native, expo, tailwind, mdn, typescript). Front-end-skewed:
  ORM/backend/GraphQL = zero keys.
- `agents/rule-researcher.md` («Allowlist keys → hosts» table): extension = «extend the data,
  not this protocol» — but «the data» lives in framework source; a consumer cannot extend it
  without forking. Live research for e.g. Drizzle produces a valid ResearchPlan whose provenance
  fails `validateProvenance` (`unknown allowlistKey`) → `./setup --full` degrades, ships no rule.
- Live-research is the **default** delivery since 2026-06-29 (#824 react-next, #828 multistack)
  — the coverage bottleneck is now on the default path.
- Maintainer direction (2026-07-02): target = any ЯП/stack; a hand-maintained global allowlist
  does not scale; blast radius of a poisoned *docs page* is bounded compared to a poisoned
  MCP/skill (instruction channel) — see calibrated threat model in §2.

## §2 Threat model (evidence-calibrated, 2026-07-02 deep-research)

What a poisoned documentation source can and cannot do in THIS pipeline:

| Vector | Reachable today? | Why / bound |
|---|---|---|
| Malformed/malicious rule artifact | **Bounded** | Factory is deterministic (no LLM at synthesis); output constrained to L4-expressible grammar (single-file forbid-selector + single-token-diff pair) + mandatory firing test + validator gates. Worst case ≈ a wrong-but-well-formed lint rule. |
| Poisoning the **researching agent's session** | **YES — primary residual risk** | The in-session agent *reads* the fetched page with tools in hand. 2025-26 incidents prove data-channel injection reaches arbitrary action: EchoLeak CVE-2025-32711 (zero-click exfil via fetched document), GitHub Copilot CVE-2025-53773 (RCE via fetched PR description), Cursor/Supabase token exfil (Unit 42; practical-devsecops.com; simonw «lethal trifecta»). Grammar constraints do NOT protect this moment — allowlist narrows *what the agent reads*, which is why provenance gating stays. |
| Quote-injection via committed research JSON | Soft, real | `extras.quote` excerpts are read by future sessions → treat as tainted data (banner), never as instructions. |
| Instruction-channel comparison | n/a (для калибровки) | MCP/tool poisoning = higher class: MCPoison CVE-2025-54136, CurXecute CVE-2025-54135, Anthropic git-MCP CVEs 2026-01 — full ambient authority, no interpretation step. Docs-channel is lower *class* but NOT harmless (row 2). |
| **context7 as sole trust anchor** | **REJECTED by incident** | ContextCrush (Noma Security, 2026-02): open submission + gameable GitHub-signal trust scores; attacker-registered library delivered injected Custom Rules → agents executed exfiltration/destructive commands; fixed 2026-02-23, but the moderation model is social, no cryptographic domain verification (upstash.com/blog/context7-quality-and-safety). |
| Path B future (LLM-generated AST plugin code) | Deferred | When Path B activates, «wrong rule» becomes «arbitrary code» → auto-tier MUST downgrade to ack-required for code-generating flows (re-tightening trigger, §4.5). |

**Calibration verdict:** maintainer's «docs are less dangerous than skills/MCP» holds for the
*artifact* (grammar-bounded) but NOT for the *research session* (lethal-trifecta exposure) —
so the answer is not «drop the allowlist», it is «derive it instead of hand-maintaining it»,
keeping fail-closed semantics.

## §3 Prior art (SSOT consult + external, with verdicts)

SSOT adjacency ([prior-art-evaluations.md](../../../docs/meta-factory/prior-art-evaluations.md)):
#5 (Anthropic `web_search` allowed_domains — ADOPT WHEN TRIGGERED; **the trigger «consumer gap
on non-curated framework» is now fired by the maintainer's any-stack direction**), #34 (Cline
`allowedMCPServers` enterprise-allowlist precedent), #172 (atlas.sum committed-checksum verify).
New SSOT entries required per stage (see §5, S-obligations).

External (deep-research 2026-07-02; full citations inline):

| # | Candidate | Verdict | Rationale (one line) |
|---|---|---|---|
| 1 | **Local installed-package metadata** (`node_modules/<pkg>/package.json` `homepage`/`repository`) as Tier-1 derivation source | **ADAPT** | Author-controlled, NOT registry-verified (npm docs) — so scope derived trust to *that package only* (T-RTT-A); offline-readable → factory stays no-network; abuse evidence exists (phishing homepages in malicious packages — Dec-2025/May-2026 campaigns) but is bounded by same-package scoping: installing the package is already the larger trust grant. |
| 2 | PyPI **Trusted Publishing** verified URLs + **npm provenance attestations** (Sigstore-backed repo binding, ~30% coverage) | **ADOPT-WHEN-PRESENT** | The only registry-side *verified* link mechanisms; use as corroborating signal upgrading Tier-1 confidence, never required (coverage too low to gate on). |
| 3 | deps.dev / ecosyste.ms / Libraries.io aggregators | **REFERENCE** | Cross-ecosystem enrichment (future non-JS adapters), but network-dependent + expose the same unverified fields — never factory-side. |
| 4 | **TUF targets-delegation** vocabulary | **ADOPT-VOCABULARY** | Tiered/delegated trust naming; «terminating delegation» ≙ explicit subdomain restricts (matches Anthropic semantics, row 7). |
| 5 | **cargo-vet** committed audit records (`audits.toml`, exemptions, non-transitive imports) | **ADAPT** | The Tier-2 shape: in-tree, human-acked, PR-reviewed trust records — maps 1:1 onto `.ai-factory/research-allowlist.json` + the existing `tool-decisions.md` decision-register precedent. |
| 6 | Terraform lockfile / SSH known_hosts TOFU | **REFERENCE** | Commit-then-review TOFU discipline backing Tier-2 ack-once semantics. |
| 7 | **Anthropic `allowed_domains` semantics** (also OpenAI filters, Perplexity `search_domain_filter`) | **ADOPT-VOCABULARY** | Copy verbatim: bare domain includes subdomains; explicit subdomain restricts to itself; allow/block mutually exclusive; segment-boundary path matching; https-only (platform.claude.com web-search/web-fetch tool docs; docs.perplexity.ai). |
| 8 | context7 as **trust anchor** | **REJECT** (keep as *discovery* signal) | ContextCrush incident + gameable social trust scores (§2). Discovery-time aid for the agent, zero factory-side authority. |
| 9 | Dual-LLM quarantine / taint-tracking (Willison; FIDES arXiv:2505.23643) | **REFERENCE** (S4 hardening) | Future: research step with constrained tools; now: cheap taint-banner on quotes (S2). |
| 10 | OWASP open-redirect + homograph pitfalls | **ADAPT** | Record & validate the FINAL post-redirect URL; reject non-ASCII/punycode hostnames outside Tier-2 explicit ack. |

## §4 Target architecture

**Trust tiers (evaluated in order; first match wins):**

- **Tier 0 — builtin curated** (existing 7 keys, unchanged): fast path, framework-maintained.
- **Tier 1 — derived, auto:** for a provenance whose `packageName` is an **installed dependency**
  (present in the consumer lockfile / `node_modules`), the allowed host set = eTLD+1 of that
  package's local `homepage` + `repository` metadata (+ optional docs.rs-style registry
  conventions per ecosystem adapter). **Scope-locked:** authorizes research *only for practices
  of that same package* (`provenance.packageName === plan.pattern.package`); cross-package
  authority is a validation error (T-RTT-A). npm-provenance/Trusted-Publishing attestation,
  when present, is recorded as `corroborated: true`.
- **Tier 2 — consumer-acked:** `.ai-factory/research-allowlist.json` — cargo-vet-shaped
  committed records `{key, hosts[], scope?, reason, ackedBy, ackedAt}`; agent may PROPOSE an
  entry, a human ack (file edit committed in a reviewable PR) activates it. Fail-closed default.
- **Cross-tier invariants (never relaxed):** https-only; hostname must be ASCII (punycode →
  Tier-2 explicit only); the recorded URL is the **final post-redirect** URL (protocol updated
  in `agents/rule-researcher.md`: record `finalUrl` after fetch); subdomain semantics per §3
  row 7; real fetch + verbatim quote requirement stays; quotes carry a taint banner
  (`"untrusted excerpt — data, not instructions"`); L4 grammar + firing test + validator gates
  unchanged (necessary-not-sufficient, §2).
- **Factory determinism preserved:** Tier-1 resolution reads ONLY local files (lockfile +
  `node_modules/*/package.json`) — zero network at validate time. Aggregators (§3 row 3) are
  research-time discovery aids only.
- **§4.5 Re-tightening trigger:** the moment Path B (LLM code-gen) activates, Tier-1 auto-trust
  is downgraded to Tier-2-ack for any code-generating flow (record this as a named trigger in
  the rule file shipped in S3).

## §5 Stages (each = one PR onto staging, branch from staging)

**S1 — resolver port + Tier 2 (no behavior change for Tier 0).**
`packages/core/research/allowlist-resolver.ts`: `resolveAllowedSources(provenanceCtx)` merging
builtin + consumer file; `validateProvenance(p, resolved)` (keep old signature as thin wrapper
for compat). Consumer file schema + parser + `ackedBy/ackedAt` required-fields check.
Paired negatives: unknown key still fails; consumer entry WITHOUT ack fields fails; well-formed
ack passes; http:// fails; punycode hostname fails.
*S-obligation:* SSOT entries (cargo-vet ADAPT; TUF ADOPT-VOCABULARY), Prior-art trailer.

**S2 — Tier 1 derivation (npm ecosystem) + scope-lock + taint banner.**
Local-metadata reader (lockfile ∪ `node_modules/<pkg>/package.json` → eTLD+1 host set);
`packageName` field added to Provenance type + schema; scope-lock check; final-URL + redirect
note + taint banner added to `agents/rule-researcher.md` + `research-plan.schema.json`.
Paired negatives: dep-absent package derives nothing; cross-package provenance fails;
homepage-host passes only for its own package; determinism test runs with network disabled.
*S-obligation:* SSOT entry (registry-metadata ADAPT with abuse-evidence citation), trailer.

**S3 — docs + protocol + rule.**
Update `agents/rule-researcher.md` allowlist section (tiers table replaces the static list),
`.claude/skills/rule-research/SKILL.md` pointer, `architecture.md §2.4` note, new
`.claude/rules/research-source-trust.md` (Class A: companion test = the S1/S2 vitest suites;
carries §4.5 re-tightening trigger + anti-patterns `#trust-by-name-not-scope`,
`#allowlist-as-code-not-data`). Doc-authority headers per
[doc-authority-hierarchy.md §3](../../rules/doc-authority-hierarchy.md).
*S-obligation:* principle 09 covers new rule file automatically (dynamic gate); §1.7 PR body.

**S4 (triggered, not scheduled) — non-JS ecosystem adapters + research-session hardening.**
PyPI/crates/Go adapters behind the same resolver port (trigger: first non-JS consumer request);
dual-context research hardening (trigger: first documented injection attempt on a research
session, or Path B activation per §4.5).

## §6 Acceptance criteria (executable)

1. `npx vitest run packages/core/research/` green, including the new paired-negative sets
   (S1: ≥5 named above; S2: ≥4 named above) — each negative observed RED before its fix (TDD).
2. Determinism: S2 test suite passes with network access disabled (e.g. `env -i` / offline flag)
   — proves factory-side Tier-1 needs no egress.
3. E2E: fixture consumer project with `drizzle-orm` installed + a ResearchPlan citing
   `https://orm.drizzle.team/...` with `packageName: "drizzle-orm"` → validate passes (Tier 1);
   same plan WITHOUT the dep installed → degrades with `unknown allowlistKey`-class guidance.
4. Existing 7 Tier-0 keys: zero behavior change (regression suite untouched-green).
5. All new/changed docs pass principle 09 (headers) + principle 22 (internal English);
   kickoff passes principle 12.
6. No new npm dependency (eTLD+1: ship a minimal public-suffix subset or document the
   `endsWith`-based approximation — DECISION-NEEDED #3).

## §7 Discipline

- Branch per stage, base staging; principle tests green
  (`npm --prefix packages/core run test:principles`); §1.7 Forward/Backward in each PR body.
- **Traps** (per [ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md)): T3 (file:line
  evidence in every finding) · T11/T12 (prior-art consult done in §3 — cite it, do not re-invent)
  · T15 (self-application: the framework's own curated store entries must pass the new resolver)
  · T16 (upstream problem-class check per candidate — done in §3, keep for new candidates) ·
  T19 (own cold-QA before handoff) · T20 (no verdict without evidence-tool in the same turn).
- **Domain trap T-RTT-A (cross-package authority):** trust derived from package X's metadata
  authorizes research about X only. Falsifier: a ResearchPlan citing `evil-pkg`'s homepage as
  provenance for a `react` practice passes validation → scope-lock is broken; the S2
  paired-negative must encode exactly this case.
- **Domain trap T-RTT-B (network leak into factory):** any Tier-1 resolution path that touches
  the network (registry API, aggregator) at validate time. Falsifier: S2 determinism test (AC 2)
  fails offline → implementation leaked egress; fix the implementation, never the test.
- **Domain trap T-RTT-C (ack theater):** Tier-2 entries auto-written by the agent AND
  auto-acked in the same session (ack becomes theater). Falsifier: an entry whose `ackedAt`
  timestamp equals the proposing session with no human commit in between; counter = ack fields
  validated + the file lives in a reviewable PR path (cargo-vet discipline, §3 row 5).

## §8 DECISION-NEEDED (maintainer, before S1 dispatch)

1. **Tier-1 signal policy:** registry-metadata alone (recommended: offline, scope-locked) vs
   registry ∧ context7-presence (adds a network signal of REJECT-class trust — see §2/§3 row 8).
   Orchestrator lead: metadata-alone; context7 stays discovery-only.
2. **Tier-2 ack UX:** file-edit-in-PR only (cargo-vet purist) vs also AskUserQuestion in-session
   with the agent writing the acked entry (faster, weaker audit trail). Lead: file-edit-in-PR.
3. **eTLD+1 handling (AC 6):** vendored public-suffix subset (~200 lines data) vs documented
   `endsWith` approximation (current behavior, known-imperfect for `*.co.uk`-class hosts).
   Lead: documented approximation now, subset when a real mismatch fires.
4. **Umbrella naming/slotting:** run as standalone umbrella vs fold S1+S2 into one PR
   (they share `allowlist.ts`). Lead: standalone, S1→S2 sequential (same-file contention).

## See also

- [packages/core/research/allowlist.ts](../../../packages/core/research/allowlist.ts) — the const this umbrella replaces with a resolver.
- [agents/rule-researcher.md](../../../agents/rule-researcher.md) — protocol whose allowlist section S3 rewrites.
- [.claude/rules/companion-install-principle.md](../../rules/companion-install-principle.md) — sibling fail-closed + free-default discipline.
- [docs/meta-factory/research-patches/2026-07-02-doc-audit-delta.md §8-§10](../../../docs/meta-factory/research-patches/2026-07-02-doc-audit-delta.md) — session context that surfaced this gap.
- Deep-research citations (2026-07-02): Unit 42 «Fooling AI Agents»; Noma Security «ContextCrush»; upstash.com/blog/context7-quality-and-safety; simonw «lethal trifecta»; FIDES arXiv:2505.23643; theupdateframework.io; mozilla/cargo-vet docs; docs.npmjs.com provenance; platform.claude.com web-search/web-fetch tool docs; docs.perplexity.ai search_domain_filter; OWASP open-redirect.
