// Stage 5 — real Anthropic-backed GenerateClient (install-time only).
// Uses Node 18+ native fetch; zero new npm dependencies.
// NEVER imported by tests — inject stubs from generate-stubs.ts for CI.
// Set ANTHROPIC_API_KEY + ANTHROPIC_MODEL env vars before instantiating.
//
// Security note: never log the API key. Log only candidate IDs (no prompts).

import type { Menu, GenerateClient, GenerateSelection } from './generate-port.ts';

const DEFAULT_MODEL = 'claude-sonnet-4-6';
const API_URL = 'https://api.anthropic.com/v1/messages';
const API_VERSION = '2023-06-01';

function buildUserPrompt(menu: Menu): string {
  const stackLine = `${menu.framework ?? 'software'} ${menu.version ?? ''}`.trim();
  const candidateList = menu.candidates
    .map(
      (c) =>
        `- id: "${c.id}"\n  summary: ${c.summary}\n` +
        `  bestPractices: ${JSON.stringify(c.bestPractices)}\n` +
        `  antiPatterns: ${JSON.stringify(c.antiPatterns)}`,
    )
    .join('\n');
  return (
    `You are an expert ${stackLine} engineer.\n` +
    `For the candidate patterns below, author enforceable lint rules for this project.\n\n` +
    `Candidate patterns:\n${candidateList}\n\n` +
    `Path A (HARD RULE): each rule's "ruleId" MUST be an EXISTING ESLint rule id you ` +
    `configure (e.g. "no-restricted-imports", "no-restricted-globals") — NEVER an invented ` +
    `selector and NEVER authored TypeScript. You configure existing rules; you do not write rules.\n\n` +
    `Respond ONLY with a JSON object — no explanation, no markdown — of the form:\n` +
    `{"rules": [{"entryId": "<candidate-id>", "ruleId": "<existing-eslint-rule-id>", ` +
    `"title": "<short title>", "stack": ["${menu.framework ?? 'software'}"], ` +
    `"eslintConfig": {"<existing-eslint-rule-id>": ["error", ...]}, ` +
    `"examples": {"bad": "<code>", "good": "<code>", "safeForms": ["<code (optional)>"]}, ` +
    `"negativeTest": {"input": ["<code>"], "expect-violation": "<existing-eslint-rule-id>"}}]}\n` +
    `Use only entryId values from the candidate list above. Omit eslintConfig and ` +
    `negativeTest for rules that need a plugin not configurable via a built-in ESLint rule. ` +
    `examples.safeForms (optional, GH #915 obs 4): known-SAFE forms of the forbidden construct ` +
    `the rule must NOT flag (e.g. Object.prototype.hasOwnProperty.call(o,k) for a hasOwnProperty ` +
    `ban); include them when the source docs name an accepted variant — validation fails the ` +
    `rule if a safe form fires.`
  );
}

interface AnthropicContent {
  type: string;
  text?: string;
}

interface AnthropicResponse {
  content: AnthropicContent[];
}

export function createAnthropicGenerateClient(
  apiKey: string = process.env['ANTHROPIC_API_KEY'] ?? '',
  model: string = process.env['ANTHROPIC_MODEL'] ?? DEFAULT_MODEL,
): GenerateClient {
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is required for the Anthropic generate adapter');

  return {
    async generate(menu: Menu): Promise<GenerateSelection> {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': API_VERSION,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model,
          max_tokens: 4096,
          messages: [{ role: 'user', content: buildUserPrompt(menu) }],
        }),
      });

      if (!res.ok) {
        throw new Error(`Anthropic API error: ${res.status} ${res.statusText}`);
      }

      const data = (await res.json()) as AnthropicResponse;
      const text = data.content.find((c) => c.type === 'text')?.text ?? '{}';

      const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) ?? text.match(/(\{[\s\S]*\})/);
      const jsonStr = jsonMatch?.[1] ?? text;

      let parsed: unknown;
      try {
        parsed = JSON.parse(jsonStr);
      } catch {
        return { rules: [] };
      }

      const selection = parsed as Record<string, unknown>;
      if (!Array.isArray(selection?.['rules'])) {
        return { rules: [] };
      }

      return { rules: selection['rules'] as GenerateSelection['rules'] };
    },
  };
}
