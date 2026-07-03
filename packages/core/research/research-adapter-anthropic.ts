// Layer 2 live research adapter — Anthropic-backed ResearchClient (install-time only).
// Uses web_search_20250305 server tool; Node 18+ native fetch; zero new npm deps.
// NEVER imported by tests — inject stubs from research-port.ts for CI.
// Set ANTHROPIC_API_KEY + ANTHROPIC_MODEL env vars before instantiating.
//
// Security note: never log the API key. Log only query terms, candidate hosts, and entry IDs.

import type { DetectionResult } from '../detector/types.ts';
import { ALLOWED_SOURCES, validateProvenance } from './allowlist.ts';
import type { ResearchClient } from './research-port.ts';
import type { Provenance, ResearchEntry, ResearchPlan } from './types.ts';

const DEFAULT_MODEL = 'claude-sonnet-4-6';
const API_URL = 'https://api.anthropic.com/v1/messages';
const API_VERSION = '2023-06-01';

/** Derive the allowlistKey for a URL by matching its hostname against ALLOWED_SOURCES. */
function deriveAllowlistKey(urlStr: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(urlStr);
  } catch {
    return null;
  }
  const hostname = parsed.hostname;
  for (const [key, hosts] of Object.entries(ALLOWED_SOURCES)) {
    if (hosts.some((h) => hostname === h || hostname.endsWith(`.${h}`))) {
      return key;
    }
  }
  return null;
}

function buildResearchPrompt(detection: DetectionResult): string {
  const stack = `${detection.framework.name ?? 'software'} ${detection.framework.version ?? ''}`.trim();
  const patternLines = (detection.patterns ?? []).map((p) => `- ${p}`).join('\n');
  return (
    `You are an expert ${stack} engineer.\n` +
    `Use web_search to find current official documentation for these patterns:\n` +
    `${patternLines || '- general best practices'}\n\n` +
    `For each pattern, respond ONLY with a JSON array (no markdown, no explanation):\n` +
    `[{"id":"<pattern-id>","summary":"<1–2 sentence summary from docs>","bestPractices":["..."],"antiPatterns":["..."]}]`
  );
}

// --- Anthropic content block types for web_search_20250305 ---

interface ServerToolUseBlock {
  type: 'server_tool_use';
  id: string;
  name: string;
  input: { query: string };
}

interface WebSearchResultItem {
  type: 'web_search_result';
  url: string;
  title: string;
  page_age?: string;
  encrypted_content?: string;
}

interface WebSearchToolResultError {
  type: 'web_search_tool_result_error';
  error_code: string;
}

interface WebSearchToolResultBlock {
  type: 'web_search_tool_result';
  tool_use_id: string;
  content: WebSearchResultItem[] | WebSearchToolResultError;
}

interface WebCitation {
  type: 'web_search_result_location';
  url: string;
  title: string;
  cited_text: string;
  encrypted_index?: string;
}

interface TextBlock {
  type: 'text';
  text: string;
  citations?: WebCitation[];
}

interface AnthropicResponse {
  content: Array<{ type: string } & Record<string, unknown>>;
}

export function createAnthropicResearchClient(
  apiKey: string = process.env['ANTHROPIC_API_KEY'] ?? '',
  model: string = process.env['ANTHROPIC_MODEL'] ?? DEFAULT_MODEL,
): ResearchClient {
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is required for the Anthropic research adapter');
  }

  // allowed_domains: flat list of bare hostnames from ALLOWED_SOURCES (no scheme)
  const allowedDomains: string[] = [];
  for (const hosts of Object.values(ALLOWED_SOURCES)) {
    for (const h of hosts) {
      allowedDomains.push(h);
    }
  }

  return {
    async research(detection: DetectionResult): Promise<ResearchPlan> {
      const verbose =
        process.env['LOG_LEVEL'] === 'debug' || process.env['LOG_LEVEL'] === 'verbose';

      if (verbose) {
        console.debug('[research-adapter] start', {
          framework: detection.framework.name,
          version: detection.framework.version,
          patterns: detection.patterns,
        });
      }

      // M4 seam (Task 2.5): the requested-target list is built from
      // DetectionResult ONLY — never from the LLM response text. entry.package
      // is stamped from this trusted list below, so the left-hand side of the
      // Tier-1 scope-lock check (allowlist-resolver.ts) is trusted, not
      // agent-asserted. Only stamp when the target is UNAMBIGUOUS (exactly one
      // requested target) — with zero or multiple targets in a single-shot
      // multi-pattern response there is no safe way to attribute an entry to
      // one specific target without parsing LLM text, so entries get NO
      // package field (kickoff Task 2.5: "not attributable → no package").
      const requestedTargets = [
        detection.framework.name,
        ...(detection.missing ?? []),
      ].filter((t): t is string => typeof t === 'string' && t.length > 0);
      const trustedPackageTarget =
        requestedTargets.length === 1 ? requestedTargets[0] : undefined;

      const res = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': API_VERSION,
          'anthropic-beta': 'web-search-2025-03-05',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model,
          max_tokens: 4096,
          tools: [
            {
              type: 'web_search_20250305',
              name: 'web_search',
              max_uses: 5,
              allowed_domains: allowedDomains,
            },
          ],
          messages: [{ role: 'user', content: buildResearchPrompt(detection) }],
        }),
      });

      if (!res.ok) {
        throw new Error(`Anthropic API error: ${res.status} ${res.statusText}`);
      }

      const data = (await res.json()) as AnthropicResponse;
      const fetchedAt = new Date().toISOString().slice(0, 10);

      // --- Parse content blocks ---
      const searchUrls: Array<{ url: string }> = [];
      const textCitations: WebCitation[] = [];
      let textContent = '';

      for (const block of data.content) {
        if (block['type'] === 'server_tool_use') {
          const b = block as unknown as ServerToolUseBlock;
          if (verbose) {
            console.debug('[research-adapter] web_search query', { query: b.input.query });
          }
        } else if (block['type'] === 'web_search_tool_result') {
          const b = block as unknown as WebSearchToolResultBlock;
          if (Array.isArray(b.content)) {
            for (const item of b.content as WebSearchResultItem[]) {
              if (verbose) {
                console.debug('[research-adapter] search result', { url: item.url });
              }
              searchUrls.push({ url: item.url });
            }
          } else {
            // Error case — skip/park, do not crash
            const err = b.content as WebSearchToolResultError;
            if (verbose) {
              console.debug('[research-adapter] search error', { error_code: err.error_code });
            }
          }
        } else if (block['type'] === 'text') {
          const b = block as unknown as TextBlock;
          textContent = b.text;
          if (b.citations) {
            textCitations.push(...b.citations);
          }
        }
      }

      // --- Build provenance map from search results + citations ---
      const provenanceByUrl = new Map<string, Provenance>();

      for (const { url } of searchUrls) {
        const key = deriveAllowlistKey(url);
        if (key) {
          provenanceByUrl.set(url, { url, allowlistKey: key, fetchedAt });
        }
      }
      for (const citation of textCitations) {
        if (!provenanceByUrl.has(citation.url)) {
          const key = deriveAllowlistKey(citation.url);
          if (key) {
            provenanceByUrl.set(citation.url, {
              url: citation.url,
              allowlistKey: key,
              fetchedAt,
            });
          }
        }
      }

      // --- T3: Provenance gate — apply validateProvenance; drop out-of-allowlist entries ---
      const validProvenance: Provenance[] = [];
      for (const prov of provenanceByUrl.values()) {
        const v = validateProvenance(prov);
        if (v.ok) {
          validProvenance.push(prov);
        } else {
          if (verbose) {
            console.debug('[research-adapter] provenance dropped', {
              url: prov.url,
              reason: v.reason,
            });
          }
        }
      }

      // --- Parse structured entries from the model's text response ---
      const jsonMatch =
        textContent.match(/```json\s*([\s\S]*?)\s*```/) ??
        textContent.match(/(\[[\s\S]*\])/);
      const jsonStr = jsonMatch?.[1] ?? textContent;

      let rawEntries: unknown[] = [];
      try {
        const parsed: unknown = JSON.parse(jsonStr);
        if (Array.isArray(parsed)) rawEntries = parsed;
      } catch {
        if (verbose) {
          console.debug('[research-adapter] JSON parse failed, using empty list');
        }
      }

      // --- Build ResearchEntry[] ---
      const patterns: ResearchEntry[] = [];
      for (const raw of rawEntries) {
        const entry = raw as Record<string, unknown>;
        const id = typeof entry['id'] === 'string' ? entry['id'] : '';
        if (!id) {
          if (verbose) console.debug('[research-adapter] entry missing id, skipping');
          continue;
        }

        const summary = typeof entry['summary'] === 'string' ? entry['summary'] : '';
        const bestPractices = Array.isArray(entry['bestPractices'])
          ? (entry['bestPractices'] as unknown[]).filter(
              (x): x is string => typeof x === 'string',
            )
          : [];
        const antiPatterns = Array.isArray(entry['antiPatterns'])
          ? (entry['antiPatterns'] as unknown[]).filter(
              (x): x is string => typeof x === 'string',
            )
          : [];

        // M4 seam: stamp entry.package from the TRUSTED target list built
        // above — never from `entry`/`raw` (the parsed LLM response). Absent
        // a single unambiguous target, package stays unset (never rides Tier 1).
        patterns.push({
          id,
          summary,
          bestPractices,
          antiPatterns,
          provenance: validProvenance,
          ...(trustedPackageTarget !== undefined ? { package: trustedPackageTarget } : {}),
        });

        if (verbose) {
          console.debug('[research-adapter] entry built', {
            id,
            provenanceCount: validProvenance.length,
            package: trustedPackageTarget,
          });
        }
      }

      if (verbose) {
        console.debug('[research-adapter] done', { patternCount: patterns.length });
      }

      return {
        framework: detection.framework.name,
        version: detection.framework.version,
        patterns,
        missing: detection.missing ?? [],
        drift: null,
      };
    },
  };
}
