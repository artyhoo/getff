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

**§2.1 Two holes the *derived* tier itself introduces (Tier-1 must CLOSE them, not inherit them):**

- **H1 — bar-lowering (author-controlled host).** Tier-0 trusts human-curated reputable hosts
  (`nextjs.org`). Tier-1 would trust whatever a package author put in `homepage`/`repository` —
  registry-unverified (npm docs), vetted by no one. Scope-lock bounds the *topic* to that
  package, but the *page content* the agent reads in-session is still attacker-authorable (§2
  row 2, the primary risk). So Tier-1 is NOT «as safe as Tier-0 for a package you installed»:
  installing grants *code-execution* trust, not «the agent will fetch this author's chosen host
  with tools in hand» trust — the two channels are distinct. The necessary-not-sufficient gates
  (in-session fetch+quote, taint banner, L4 grammar + firing test) still apply and are what
  actually bound the blast radius; Tier-1 does not weaken them, but it MUST NOT be sold as
  eliminating the read-injection surface. §4 states the residual explicitly.
- **H2 — shared-host whole-host trust.** A large fraction of packages set `homepage`/`repository`
  to a *multi-tenant* host: `github.com/org/repo`, `npmjs.com/package/x`, `*.github.io`,
  `*.readthedocs.io`, `*.gitbook.io`, `*.vercel.app`. Host-based matching (subdomain-inclusive
  `endsWith`) trusts the *whole host tree* — so a Tier-1 grant derived from package X's `github.com`
  homepage also authorizes `github.com/<attacker>/…` (path is the only discriminator, and
  host-match ignores it). Scope-lock does NOT contain this: it constrains the *plan-package*
  axis, not the *host-breadth* axis. §4 forbids Tier-1 derivation from multi-tenant hosts
  (DECISION-NEEDED #6).

## §3 Prior art (SSOT consult + external, with verdicts)

SSOT adjacency ([prior-art-evaluations.md](../../../docs/meta-factory/prior-art-evaluations.md)):
#5 (Anthropic `web_search` allowed_domains — ADOPT WHEN TRIGGERED; **the trigger «consumer gap
on non-curated framework» is now fired by the maintainer's any-stack direction**), #34 (Cline
`allowedMCPServers` enterprise-allowlist precedent), #172 (atlas.sum committed-checksum verify).
New SSOT entries required per stage (see §5, S-obligations).

External (deep-research 2026-07-02; full citations inline):

| # | Candidate | Verdict | Rationale (one line) |
|---|---|---|---|
| 1 | **Local installed-package metadata** (`node_modules/<pkg>/package.json` `homepage`/`repository`) as Tier-1 derivation source | **ADAPT** | Author-controlled, NOT registry-verified (npm docs) — so scope derived trust to *that package only* (T-RTT-A) AND reject multi-tenant hosts (§2.1 H2); offline-readable → factory stays no-network; abuse evidence exists (phishing homepages in malicious packages — Dec-2025/May-2026 campaigns). NB the residual is NOT zero: derived-Tier-1 lowers the bar from a curated reputable host to an author-chosen one (§2.1 H1) — bounded, not eliminated, by the necessary-not-sufficient in-session gates. |
| 2 | PyPI **Trusted Publishing** verified URLs + **npm provenance attestations** (Sigstore-backed repo binding, ~30% coverage) | **ADOPT-WHEN-PRESENT** | The only registry-side *verified* link mechanisms; use as corroborating signal upgrading Tier-1 confidence, never required (coverage too low to gate on). |
| 3 | deps.dev / ecosyste.ms / Libraries.io aggregators | **REFERENCE** | Cross-ecosystem enrichment (future non-JS adapters), but network-dependent + expose the same unverified fields — never factory-side. |
| 4 | **TUF targets-delegation** vocabulary | **ADOPT-VOCABULARY** | Tiered/delegated trust naming; «terminating delegation» ≙ explicit subdomain restricts (matches Anthropic semantics, row 7). |
| 5 | **cargo-vet** committed audit records (`audits.toml`, exemptions, non-transitive imports) | **ADAPT** | The Tier-2 shape: in-tree, human-acked, PR-reviewed trust records — maps 1:1 onto `.ai-factory/research-allowlist.json` + the existing `tool-decisions.md` decision-register precedent. |
| 6 | Terraform lockfile / SSH known_hosts TOFU | **REFERENCE** | Commit-then-review TOFU discipline backing Tier-2 ack-once semantics. |
| 7 | **Anthropic `allowed_domains` semantics** (also OpenAI filters, Perplexity `search_domain_filter`) | **ADOPT-VOCABULARY** | Copy verbatim: bare domain includes subdomains; explicit subdomain restricts to itself; allow/block mutually exclusive; segment-boundary path matching; https-only (platform.claude.com web-search/web-fetch tool docs; docs.perplexity.ai). |
| 8 | context7 as **trust anchor** | **REJECT** (keep as *discovery* signal) | ContextCrush incident + gameable social trust scores (§2). Discovery-time aid for the agent, zero factory-side authority. |
| 9 | Dual-LLM quarantine / taint-tracking (Willison; FIDES arXiv:2505.23643) | **REFERENCE** (S4 hardening) | Future: research step with constrained tools; now: cheap taint-banner on quotes (S2). |
| 10 | OWASP open-redirect + homograph pitfalls | **ADAPT** | Record & validate the FINAL post-redirect URL (final URL must independently satisfy the authorizing tier, §4); reject `xn--`-label (IDN/punycode) hostnames outside Tier-2 explicit ack — note `URL.hostname` already ASCII-encodes Unicode, so the check is the `xn--` prefix, not «non-ASCII» (§4). |

## §4 Target architecture

**Trust tiers (evaluated in order; first match wins):**

- **Tier 0 — builtin curated** (existing 7 keys, unchanged): fast path, framework-maintained.
- **Tier 1 — derived, auto:** for a provenance whose `packageName` is a **DIRECT installed
  dependency** (a key of the consumer's own `package.json` `dependencies`/`devDependencies`,
  cross-checked present in `node_modules`), the allowed host set = the **exact canonicalized
  host(s)** of that package's local `homepage` + `repository` metadata, subdomain-inclusive per
  §3 row 7 — **no eTLD+1/PSL computation at all** (DN #3 resolved 2026-07-02: PSL maintainers
  advise against eTLD+1 for new systems, sleevi/psl-problems; vendored PSL copies rot — median
  825 days stale, IMC 2023; Anthropic `allowed_domains` uses the same exact-host semantics) —
  **only when the host is NOT under a multi-tenant apex** (H2 / DN #6, resolved: Option A via
  C's data file): forge, docs-platform and registry hosts (`github.com`, `gitlab.com`,
  `*.github.io`, `*.readthedocs.io`, `*.gitbook.io`, `*.vercel.app`, `*.netlify.app`, `npmjs.com`,
  …) are **ineligible for Tier-1** and fall through to Tier-2 (a human acks the specific host,
  optionally host+path). **Transitive deps are excluded** — the full dependency closure is not
  consumer-chosen, so auto-trusting it would make the blast radius the whole tree. Edge cases
  (all resolved local, no network): `@scoped/name` → `node_modules/@scope/name/package.json`; an
  npm alias (`"x":"npm:real@1"`) resolves to the real installed dir; a workspace package uses its
  linked `package.json`; a `repository` given as a git URL / `org/repo` shorthand / `{type,url}`
  object contributes a host only if an https host is extractable, else it is ignored.
  **Scope-locked:** a researched practice carries its own **optional** `package` field (added to
  `ResearchEntry`, S2; absent on Tier-0 curated entries, which route by `allowlistKey` and so keep
  passing — T15 self-application; **required** for any Tier-1 provenance) **sourced from the
  plan/detector — NOT from provenance** (so the left-hand side of the check is trusted, not
  agent-asserted); Tier-1 authorizes a provenance **only when** `provenance.packageName ===
  entry.package` AND `entry.package` is a direct dep AND the host derives from *that* package's
  local metadata. Cross-package authority is a validation error
  (T-RTT-A). npm-provenance/Trusted-Publishing attestation, when present, is recorded as
  `corroborated: true` (a signal, never a gate — ~30% coverage, §3 row 2).
- **Tier 2 — consumer-acked:** `.ai-factory/research-allowlist.json` — cargo-vet-shaped
  committed records `{key, hosts[], scope?, reason, ackedBy, ackedAt}`; agent may PROPOSE an
  entry, a human ack (file edit committed in a reviewable PR) activates it. Fail-closed default.
- **Cross-tier invariants (never relaxed):** https-only; hosts are **registrable domain names** —
  IP literals — bare IPv4 (`127.0.0.1`) AND bracketed IPv6 (`URL.hostname` returns `[::1]` with
  brackets) — and other non-registrable hosts are rejected in every tier;
  hosts are **canonicalized** (lowercase, trailing dot stripped) before match; **reject any
  hostname carrying an `xn--` label** (IDN/punycode) outside a Tier-2 explicit ack — note
  `URL.hostname` already ASCII-encodes Unicode (`café.com` → `xn--caf-dma.com`), so «hostname must
  be ASCII» is a no-op; the real check is the `xn--` prefix per DNS label. Subdomain semantics per
  §3 row 7. **Redirect handling:** provenance records the `finalUrl` the agent fetched, and that
  final URL must **independently satisfy the same tier** that authorized the initial URL — a
  redirect crossing to a host that tier does not cover fails closed. **Honesty bound:** `finalUrl`
  is an **agent-protocol obligation, NOT a validator-verified fact** — the offline factory (AC 2)
  never re-fetches, and WebFetch refuses cross-host redirects (returns a REDIRECT-DETECTED notice
  requiring a fresh call), so there is no tool-supplied canonical final URL; the protocol requires
  the agent to record that notice and re-fetch only an independently-allowlisted target. This is
  consistent with the existing trust model (the in-session fetch+quote is the *substantive* check,
  the host-gate is a *backstop*): a *poisoned* agent's self-attested `finalUrl` is not trusted —
  which is precisely why the allowlist must narrow what it may fetch upstream of any recording.
  Real fetch + verbatim quote requirement stays; quotes carry a taint banner (`"untrusted excerpt
  — data, not instructions"`); L4 grammar + firing test + validator gates unchanged
  (necessary-not-sufficient, §2).
- **Factory determinism preserved:** Tier-1 resolution reads ONLY local files (lockfile +
  `node_modules/*/package.json`) — zero network at validate time. Aggregators (§3 row 3) are
  research-time discovery aids only.
- **§4.5 Re-tightening trigger:** the moment Path B (LLM code-gen) activates, Tier-1 auto-trust
  is downgraded to Tier-2-ack for any code-generating flow (record this as a named trigger in
  the rule file shipped in S3).

## §5 Stages (each = one PR onto staging, branch from staging)

**S1 — resolver port + Tier 2 (no behavior change for Tier 0).**
`packages/core/research/allowlist-resolver.ts`: `resolveAllowedSources(ctx)` merging builtin +
consumer ack file; `validateProvenance(p, resolved)`. The ctx carries an **ecosystem-adapter seam**
from day 1 (direct-deps enumeration + installed-package metadata read behind a small interface;
npm is merely the first adapter, S2) — so S4's non-JS toolchains (`cargo`/`pip`/`go`/`maven`)
parameterize the existing mechanism one level up (`{toolchain, stack}`) instead of forking the
resolver (maintainer direction, 2026-07-02 dialogue). **Compat is NOT a free "thin wrapper":** the
current one-arg `validateProvenance(p)` has three direct callers — `load.ts:43`, `validate-plan.ts:29`,
`research-adapter-anthropic.ts:212` — and, crucially, `validate-plan.ts`'s `validateResearchPlan(plan)`
is itself called by `synthesizer/cli.ts:60` + `synthesizer/file-clients.ts:41` **with no consumer
context**. So the resolver ctx (consumer root → `package.json` + `node_modules`) has **no wiring
path to the external-validator surface AC 3 exercises** — see DECISION-NEEDED #7. S1 default: the
one-arg wrapper resolves **Tier-0-only** (back-compat, zero behavior change); Tier-1/2 activate only
where a `ctx` is threaded (decided in #7). Consumer file schema + parser + `ackedBy/ackedAt`
required-fields + ISO-date check.
Paired negatives (≥5): unknown key still fails; consumer entry WITHOUT ack fields fails; ack with a
**malformed `ackedAt` date** fails; `http://` fails; an `xn--`/punycode hostname fails **outside an
explicit Tier-2 ack** (§4 carve-out: a host a human deliberately listed in an ack entry is the one
position where punycode may pass — the negative asserts rejection everywhere else). (Positive
control: a well-formed ack passes.)
*S-obligation:* SSOT entries (cargo-vet ADAPT; TUF ADOPT-VOCABULARY), Prior-art trailer.

**S2 — Tier 1 derivation (npm ecosystem) + scope-lock + taint banner.**
Local-metadata reader (DIRECT deps from consumer `package.json` ∩ `node_modules/<pkg>/package.json`,
scoped-path aware → **exact-host set** (no eTLD+1, DN #3), **multi-tenant apexes filtered out** per §4). **Two** new
fields: `packageName` on Provenance AND `package` on `ResearchEntry` (type + schema). **Trusted-source
seam (M4):** `entry.package` must NOT be agent-authored (else both sides of scope-lock are
attacker-controlled). It is set by the plan-builder from the **detector's researched-package target**
— the same trusted detection that decides *what* to research. `DetectionResult` (`detector/types.ts`)
today exposes `framework.name` + absent-packages, **not** per-practice package identity, so S2 must
add that identity to the detector→plan seam (concrete design task, not a given). Schema ordering
(`additionalProperties:false`, `research-plan.schema.json`): the type + schema + any fixture using
the field land in the **same commit**, else an unknown-prop plan hard-fails. scope-lock check
`provenance.packageName === entry.package`. Final-URL + redirect note + taint banner added to
`agents/rule-researcher.md` + `research-plan.schema.json`.
Paired negatives (≥7, each observed RED before its fix, TDD): dep-absent package derives nothing;
**transitive-only dep derives nothing** (direct-deps gate); **multi-tenant homepage
(`github.com` / `*.github.io`) yields no Tier-1 host** (H2); `repository` given as a git-URL/shorthand
with no extractable https host yields nothing; cross-package provenance fails (`provenance.packageName
!== entry.package`); `xn--` (IDN) host fails; IP-literal host fails. (Positive control: homepage-host
passes only for its own package.)
*S-obligation:* SSOT entry (registry-metadata ADAPT with abuse-evidence citation), trailer.

**S3 — docs + protocol + rule.**
Update `agents/rule-researcher.md` allowlist section (tiers table replaces the static list),
`.claude/skills/rule-research/SKILL.md` pointer, `architecture.md §2.4` note, new
`.claude/rules/research-source-trust.md` carrying §4.5 re-tightening trigger + anti-patterns
`#trust-by-name-not-scope`, `#allowlist-as-code-not-data`. Doc-authority headers per
[doc-authority-hierarchy.md §3](../../rules/doc-authority-hierarchy.md).
**Class-A companion — a DEDICATED principle test, not the S1/S2 resolver unit suites** (those test
the resolver's *behavior*; a Class-A companion tests the *discipline*, per every peer rule:
`ai-laziness-traps.md`→`principles/12`, `doc-authority-hierarchy.md`→`principles/09`). New
`packages/core/principles/<N>-research-source-trust.test.ts` at the **next free slot** (≥30 —
confirm at ship, per the `build-first-reuse-default.md` "slot 11" numbering precedent) asserting a
store-wide invariant, e.g. *no curated store entry resolves via a multi-tenant host, and every
Tier-1-eligible entry carries a trusted `package`.* If a dedicated discipline test is judged not
yet worth it, downgrade to Class B/C with an explicit promotion criterion (peer-rule style) — do
NOT label it Class A while pointing at feature suites (`#pattern-matching-on-name`, T16).
*S-obligation (principle 09 is NOT automatic):* principle 09 uses a **static** `REQUIRED_HEADER_DOCS`
list + a `length ≤ 84` drift sentinel — S3 MUST append `.claude/rules/research-source-trust.md` to
that list AND bump the sentinel (`84 → 85`; 84 is the 2026-07-02 value — like the principle slot,
re-read the current bound at ship), else the rule ships unenforced or the sentinel test goes RED.
§1.7 PR body.

**S4 (triggered, not scheduled) — non-JS ecosystem adapters + research-session hardening.**
PyPI/crates/Go adapters behind the same resolver port (trigger: first non-JS consumer request);
dual-context research hardening (trigger: first documented injection attempt on a research
session, or Path B activation per §4.5).

## §6 Acceptance criteria (executable)

1. `npx vitest run packages/core/research/` green, including the new paired-negative sets
   (S1: ≥5 named above; S2: ≥7 named above) — each negative observed RED before its fix (TDD).
2. Determinism / no-egress — **executable, not `env -i`** (which strips PATH and breaks the vitest
   runner, and asserts nothing about sockets). The Tier-1 reader is a **pure function of injected
   local files** (the `research-port.ts` injection seam precedent): the test (a) installs a
   `global.fetch` that **throws** and asserts resolution still succeeds — proving the factory path
   never egresses; and (b) runs the resolver twice on the same fixture and asserts byte-identical
   output. (The current research/validator path already makes no network call — the assertion
   guards the NEW reader against regressing that.)
3. E2E: a **new stubbed single-root fixture** (NOT the existing `hono-drizzle-monorepo`, where
   `drizzle-orm` is a workspace-member dep and no `node_modules` exists) — a consumer root
   `package.json` listing `drizzle-orm` as a direct dep + a stub `node_modules/drizzle-orm/package.json`
   with `homepage: https://orm.drizzle.team` (single-tenant host → exercises Tier-1, does not trip
   the multi-tenant filter) + a ResearchPlan with `package:"drizzle-orm"` + provenance
   `packageName:"drizzle-orm"` citing `https://orm.drizzle.team/...` → validate passes (Tier 1).
   Same plan WITHOUT the dep installed → degrades with the **new Tier-1-miss reason class** ("host
   not authorized: `drizzle-orm` is not a direct dependency" — NOT the pre-refactor
   `unknown allowlistKey` string, which now only covers a missing Tier-0 key).
4. Existing 7 Tier-0 keys: zero behavior change (regression suite untouched-green).
5. All new/changed docs pass principle 09 (headers) + principle 22 (internal English);
   kickoff passes principle 12.
6. No new npm dependency. DN #3 resolved (2026-07-02): **exact-host matching — no eTLD+1/PSL
   computation exists anywhere in the resolver**; the only host data file is the multi-tenant
   apex list (DN #6), which also catches a metadata host that IS itself a shared apex.

## §7 Discipline

- Branch per stage, base staging; principle tests green
  (`npm --prefix packages/core run test:principles`); §1.7 Forward/Backward in each PR body.
- **Traps** (per [ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md)): T3 (file:line
  evidence in every finding) · T11/T12 (prior-art consult done in §3 — cite it, do not re-invent)
  · T15 (self-application: the framework's own curated store entries must pass the new resolver)
  · T16 (upstream problem-class check per candidate — done in §3, keep for new candidates) ·
  T19 (own cold-QA before handoff) · T20 (no verdict without evidence-tool in the same turn).
- **Domain trap T-RTT-A (cross-package authority):** trust derived from package X's metadata
  authorizes research about X only. Falsifier: a ResearchPlan whose entry has `package: "react"`
  but a provenance citing `evil-pkg`'s homepage host (i.e. `provenance.packageName`/host derived
  from a different package) passes validation → scope-lock is broken; the S2 paired-negative must
  encode exactly this `provenance.packageName !== entry.package` case.
- **Domain trap T-RTT-B (network leak into factory):** any Tier-1 resolution path that touches
  the network (registry API, aggregator) at validate time. Falsifier: the AC 2 throwing-`fetch`
  test goes RED (resolution called `fetch`) → implementation leaked egress; fix the implementation,
  never the test. (Not `env -i` — that fails on PATH, not on egress; see AC 2.)
- **Domain trap T-RTT-C (ack theater):** Tier-2 entries auto-written AND auto-acked by the agent
  in the same session (ack becomes theater). **Enforcement is split by surface, stated honestly:**
  the offline vitest validator can only check **fields-present + well-formed** (`ackedBy`/`ackedAt`
  present, ISO date, host registrable) — it has no git, no committer identity, no session clock, so
  it CANNOT falsify «a human really acked this». The human-vs-agent boundary is enforced by (a)
  **PR review** — a human approves the commit that adds the entry (cargo-vet discipline, §3 row 5);
  and (b) an OPTIONAL pre-push/CI check (a git-aware surface, NOT the validator) asserting the
  ack-file hunk's commit author is not the agent/bot identity. Do NOT claim the pure validator
  falsifies ack-theater — that claim would itself be discipline-theatre (§2 row 1). Mechanical
  falsifier (the part that IS a test): an ack entry missing `ackedBy`/`ackedAt` or with a malformed
  date passes validation → the fields-check regressed.

## §8 DECISION-NEEDED — ALL RESOLVED 2026-07-02 (maintainer approval after deep-research round 2)

1. **Tier-1 signal policy:** registry-metadata alone (recommended: offline, scope-locked) vs
   registry ∧ context7-presence (adds a network signal of REJECT-class trust — see §2/§3 row 8).
   **RESOLVED: metadata-alone; context7 = discovery-only, zero trust weight.** Post-fix evidence:
   submission is still open («Anyone can add a public library — you don't need to own it»,
   context7 docs fetched 2026-07-02); the 2026-02-23 ContextCrush fix was payload sanitization
   only, and Noma self-inflated a malicious library to «trending»/top-4% via page views.
2. **Tier-2 ack UX:** file-edit-in-PR only (cargo-vet purist) vs also AskUserQuestion in-session
   with the agent writing the acked entry (faster, weaker audit trail).
   **RESOLVED: agent-assisted file-edit-in-PR** — the agent MAY generate and (after
   AskUserQuestion) write the proposed entry, but the trust act is a human merging the reviewable
   PR; `ackedBy` = human git identity, never the agent. cargo-vet precedent: the CLI writes
   `audits.toml`, the human certifies («we choose to make manual just to keep a human in the
   loop», mozilla/cargo-vet Commands).
3. **eTLD+1 computation (AC 6):** vendored public-suffix subset (~200 lines data) vs documented
   `endsWith` approximation. **Security re-scope (was mis-framed as a `*.co.uk` nicety):** under
   the naive approximation, eTLD+1(`foo.github.io`) collapses to `github.io` — turning a PSL
   *private suffix* into a shared-host grant, whereas a real PSL keeps `foo.github.io` distinct.
   This interacts with #6, but is NOT load-bearing for the shared-host attack: #6 handles
   multi-tenant hosts by *ineligibility*, not by suffix precision (and single-registrable forges
   like `github.com` defeat any PSL anyway — path, not suffix, is the only discriminator there).
   **RESOLVED: Option D — exact-host (supersedes both original options).** Trust the exact
   canonicalized metadata host + its subdomains; never compute a registrable domain. Evidence:
   PSL maintainer guidance («for anything new, avoid the PSL», sleevi/psl-problems), measured
   vendored-PSL rot (IMC 2023), and Anthropic `allowed_domains` shipping the identical exact-host
   semantics. The residual case (metadata host IS a shared apex) is caught by #6's list.
4. **Umbrella naming/slotting:** run as standalone umbrella vs fold S1+S2 into one PR
   (they share `allowlist.ts`). **RESOLVED: lead confirmed** — standalone, S1→S2 sequential
   (same-file contention).
5. **Generate-first sequencing (see §9):** confirm trust-tiers → generate-first-delivery as the
   next umbrella, vs folding a minimal S0 (staleness markers on shipped presets) into S3 here.
   **RESOLVED: staleness marker ships in the generate-first umbrella**, not S3 (per §9
   mutually-exclusive homes note).
6. **Shared-/multi-tenant-host containment (H2 — the core Tier-1 security fork):** how does Tier-1
   avoid granting whole-host trust when a package's `homepage`/`repository` is a multi-tenant host
   (`github.com`, `npmjs.com`, `*.github.io`, …)?
   *Option A (lead):* **multi-tenant hosts are ineligible for Tier-1** — they fall through to
   Tier-2 explicit ack (simplest, fail-closed; cost: a package whose only doc home is `*.github.io`
   gets no auto-tier and needs a one-line ack).
   *Option B:* **host+path-prefix scoping** for Tier-1 (`github.com/org/repo/*` only) — richer, but
   path-matching under redirects + path-normalization add attack surface, and the current matcher
   is host-only (a new capability).
   *Option C:* a **maintained shared-host registry** shipped as a data file (the list to treat as
   multi-tenant), refreshable without code change.
   **RESOLVED: Option A via C's list.** B is closed harder than «deferred»: reopening requires a
   dedicated normalization+redirect design. Evidence (deep-research 2026-07-02): path entries are
   inert at the fetch layer even where the vendor supports them in search («Web fetch matches on
   the domain only», Anthropic server-tools docs); UGC under a trusted repo path is a live
   injection vector (Clinejection CI compromise via issue title; Copilot CVE-2025-53773 via code
   comments; GitHub-MCP private-repo leak via public issue); `*.github.io` dangling-CNAME
   takeovers observed 2025-11 and 2026-04; path-allowlist bypass classes are catalogued
   (PortSwigger URL-validation cheat sheet; hackney host-decode GHSA, 2025).
7. **Consumer-context wiring to the external validator (B1 — public-API fork, blocks AC 3):**
   `validateResearchPlan(plan)` (called by `synthesizer/cli.ts:60` + `file-clients.ts:41`) has no
   handle to the consumer root, so Tier-1 cannot be authorized there without a change.
   *Option A (lead):* add an **optional** `resolveCtx?` param to `validateResearchPlan` (and thread it
   from the two synthesizer call-sites); absent ⇒ Tier-0-only (back-compat, zero behavior change),
   present ⇒ Tier-1/2 active. Least-breaking; opt-in.
   *Option B:* restrict Tier-1 to the `loadEntries`/`load.ts` disk path only and leave the external
   `validateResearchPlan` Tier-0-only — simpler, but then a `--from-research` synthesizer run never
   gets Tier-1 (may defeat the generate-first goal §9).
   *Option C:* a module-level resolved-sources singleton — rejected (hidden global state, breaks
   test isolation). **RESOLVED: Option A confirmed** (optional `resolveCtx?` param; absent ⇒
   Tier-0-only; the callers thread the consumer root they already hold — the validator never
   guesses `cwd`, an implicit root would be a silent trust expansion).

## §9 Companion maintainer direction — generate-first delivery (recorded 2026-07-02)

Maintainer directive (2026-07-02 dialogue, verbatim intent): *presets remain only as
legacy/template — a snapshot-oracle for verification; everything is GENERATED, because
presets go stale.*

This operationalizes the project's founding thesis («presets устаревают, принципы — нет»)
and the already-written acceptance criterion in
[EXECUTION-PLAN.md §1](../../../docs/meta-factory/EXECUTION-PLAN.md) («мета-фабрика
**регенерирует** canonical Next 15 preset с diff ≤5%, обновляет до Next 16 с diff ≤15%»);
vocabulary per SSOT #166 (compiler-bootstrap same-result test: curated preset = regression
**oracle**, not the product). Target delivery model:

- **Generation is the primary path for ALL stacks** — covered stacks stop being «copy the
  preset» and run the same research→plan→factory pipeline as uncovered ones (augment-first
  already points this way since #824/#828).
- **Presets / curated store demote to three roles:** (1) **regression oracle** — generated
  output for the canonical stack must match the preset within the diff budget. **The oracle
  regenerates via the FROZEN-STORE seam** (`research-port.ts` `stubFrozenResearch` — a pure
  function of the curated store, "no live API calls"), **NOT live research** — so the diff test
  stays offline and deterministic per AC 2 / T-RTT-B; live-research parity is a separate, non-CI
  concern. Precedent: principle 27 (`28-synth-wire-oracle`) already diffs synth output against
  the shipped preset *as a static string*, offline. (EXECUTION-PLAN §1 scopes this diff criterion
  as *methodology-proof, "not the goal itself"*; §9 promotes its lifecycle one-shot → standing CI
  fixture — a lifecycle promotion, not a goal reframe. The canonical-regen diff is still marked
  *deferred* in `snapshot.test.ts` today; §9 sets the direction, the future umbrella ships the
  mechanics.) (2) **cold-start fallback** when generation degrades (offline install, missing ack,
  research failure) — shipped with an explicit `snapshot-of: <date>` staleness marker, never
  silently as current; (3) authoring examples for rule writers.
- **Dependency on this umbrella:** generate-first for arbitrary stacks REQUIRES Tier 1/2
  provenance (S1-S2) — without them generation fails allowlist for everything beyond the
  7 builtin keys. Sequencing: this umbrella ships first; a **generate-first-delivery** umbrella
  (own kickoff, own R-phase: diff-budget mechanics, `rules-lock.json` interplay, offline-fallback
  semantics, per-install generation cost) is authored after S2 merges. **Staleness-marker format
  home is decided by DECISION-NEEDED #5** — if #5 folds a minimal S0 into S3, the format ships here
  and is dropped from the future umbrella's scope; otherwise it belongs to that umbrella. (The two
  homes are mutually exclusive — reconcile whichever way #5 resolves.)
- **Not a goal change** — a delivery-model inversion inside the existing goal; README untouched
  ([README.md#why-this-exists](../../../README.md#why-this-exists) owns the goal).

## See also

- [packages/core/research/allowlist.ts](../../../packages/core/research/allowlist.ts) — the const this umbrella replaces with a resolver.
- [agents/rule-researcher.md](../../../agents/rule-researcher.md) — protocol whose allowlist section S3 rewrites.
- [.claude/rules/companion-install-principle.md](../../rules/companion-install-principle.md) — sibling fail-closed + free-default discipline.
- [docs/meta-factory/research-patches/2026-07-02-doc-audit-delta.md §8-§10](../../../docs/meta-factory/research-patches/2026-07-02-doc-audit-delta.md) — session context that surfaced this gap.
- Deep-research citations (2026-07-02): Unit 42 «Fooling AI Agents»; Noma Security «ContextCrush»; upstash.com/blog/context7-quality-and-safety; simonw «lethal trifecta»; FIDES arXiv:2505.23643; theupdateframework.io; mozilla/cargo-vet docs; docs.npmjs.com provenance; platform.claude.com web-search/web-fetch tool docs; docs.perplexity.ai search_domain_filter; OWASP open-redirect.
- Deep-research round 2 (2026-07-02, §8 resolutions): sleevi/psl-problems; publicsuffix.org/learn; McQuistin et al. IMC 2023 (PSL harms, vendored-copy rot); platform.claude.com server-tools domain-filtering (web_fetch = domain-only, exact-host + subdomain semantics, homograph caveat); CSA «Clinejection»; Trail of Bits Copilot prompt-injection (CVE-2025-53773); Invariant Labs GitHub-MCP issue-leak; PortSwigger URL-validation bypass cheat sheet; hackney GHSA-pj7v-xfvx-wmjq; mozilla/cargo-vet book (certify/`who`/human-in-the-loop); HashiCorp dependency-lock TOFU; Akhawe & Felt USENIX '13 + Frontiers 2020 (warning habituation); GitHub changelog npm Trusted Publishing GA 2025-07-31; top-50 npm attestation audit 2026-04; docs.pypi.org project_metadata (verified URLs); Checkmarx «StarJacking»; Socket «Beamglea» 2025-10; context7.com/docs/adding-libraries (open submission, fetched 2026-07-02).

<!-- host-verify: none — legacy closed umbrella (done.md): work already accepted; no live host acceptance to declare — retro-marked 2026-08-21 -->
