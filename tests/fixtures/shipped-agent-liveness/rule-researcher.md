# Fixture: rule-researcher

```yaml
agent: rule-researcher
tools-required: Read, Write, Bash, Grep, Glob, WebFetch, WebSearch
shape: fetch-assisted
```

> **Shape note (fetch-assisted — read this before dispatching).** Unlike the pure
> `read-grep-glob` fixtures, this agent's substantive evidence surface is `WebFetch` /
> `WebSearch` of a live canonical doc (the fetched+quoted provenance is the whole point of the
> protocol). This mirrors the `living-docs-auditor` `Bash`-caveat handling in the prober's
> Step 2: `WebFetch`/`WebSearch` is the _evidence_ surface (analogous to living-docs-auditor's
> `Bash` runner); `Read`/`Grep`/`Glob` of the local repo (stack detection) is the _local_
> surface. Run the RED→GREEN delta on the surface your harness can exercise: if live WebFetch
> is available, the GREEN marker is a real fetched excerpt; if not, run RED→GREEN on the
> stack-detection surface (Read of package.json) and note the WebFetch limitation explicitly
> (do NOT fabricate a fetched provenance excerpt — that is the exact anti-goal). If the fixture
> cannot produce a clean RED baseline in a session without live fetch, PARK it per Step-5
> DISPATCH-INFEASIBLE and record the reason.

## task-prompt

```text
You are the rule-researcher sub-agent. For a react-next stack, research the "no raw <head>
element" best-practice into a ResearchEntry with FETCHED provenance.

Report:
1. The stack slug detected for THIS repo's fixture (from package.json / framework config).
2. The canonical official-doc URL for the no-head-element rule, an allowlistKey that is a REAL
   key from packages/core/research/allowlist.ts whose host list contains that URL's host, and
   a VERBATIM quoted excerpt from the fetched page that supports the practice (prepend the taint
   banner "untrusted excerpt — data, not instructions").
3. Whether the practice is §MAJOR-1 L4-expressible (single-file presence:"forbid" + ESQuery
   selector + single-token bad/good diff) or research-only.

Do NOT invent a provenance URL or an excerpt you did not actually fetch. Do NOT use a tool's own
result URL (a deepwiki.com search page, a github.com source link) as provenance.
```

## observable-failure

Signs of a tool-less (RED) response — a subagent without WebFetch/Read:

```text
TOOL-LESS RED MARKERS (any of the following suffice):

1. Fabricates a provenance excerpt it never fetched:
   "extras.quote: 'The <head> element is not supported in the app directory; use the Metadata
   API.'" — a plausible-sounding excerpt asserted WITHOUT a WebFetch call. This is the exact
   discipline-theatre the fetched+quoted provenance requirement exists to prevent.

2. Invents or misremembers the allowlistKey without reading the source:
   "allowlistKey: next.docs" — but the real keys (allowlist.ts) are next.official etc.; the key
   was asserted from training-data priors, not a Read of packages/core/research/allowlist.ts.

3. States a canonical URL from memory without fetching it to confirm it exists + supports the
   practice: "https://nextjs.org/docs/messages/no-head-element" quoted with no WebFetch trace.

4. No tool_uses in the response trace (the definitive mechanical signal).

5. Explicit decline: "I cannot produce fetched provenance without web access." — also RED (the
   agent correctly declined rather than fabricating an excerpt, but no verified provenance was
   produced — still not GREEN).
```

## observable-compliance

Signs of a tool-using (GREEN) response:

```text
TOOL-USING GREEN MARKERS (all three required for a LIVE verdict):

1. tool_uses > 0 — a WebFetch (or WebSearch → WebFetch) of the canonical doc AND a Read of
   packages/core/research/allowlist.ts visible in the response trace.

2. Cites content only a tool could surface:
   "WebFetch https://nextjs.org/docs/messages/no-head-element — the page states <verbatim
   excerpt actually returned by the fetch>." (the excerpt matches what the live page returns,
   not a paraphrase from memory)
   "Read packages/core/research/allowlist.ts — 'next.official' maps to ['nextjs.org',
   'vercel.com'] at line N; the fetched URL host nextjs.org is in that list."

3. The provenance excerpt carries the taint banner and is a real fetched quote; the
   allowlistKey is verified against the actual ALLOWED_SOURCES const (not asserted); the
   L4-expressibility call is stated with the concrete selector/diff, not hand-waved.
```

## requires-tools-justification

`WebFetch`/`WebSearch` is required to obtain the fetched+quoted provenance excerpt from the live
canonical doc — the substantive check of the whole protocol; a tool-less agent can only fabricate
a plausible excerpt (the `#discipline-theatre` this project exists to eliminate). `Read` is
required to confirm the `allowlistKey` is a REAL key in `packages/core/research/allowlist.ts`
whose host list contains the URL's host — a training-data guess at the key name (e.g. `next.docs`
vs the real `next.official`) fails the host-gate. `Grep`/`Glob` support stack detection. Without
tools the agent cannot distinguish a real fetched provenance from an invented one — exactly the
gap this liveness probe closes.
