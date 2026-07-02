// Task 2.5 (M4 seam) — trusted entry.package stamping.
// The adapter must NEVER copy a package attribution out of LLM text: the
// target list is built from DetectionResult (framework.name + missing), the
// LLM is queried per target, and entry.package is stamped from the REQUESTED
// target — never parsed from the model's JSON response body.
import { describe, it, expect, afterEach } from 'vitest';
import { createAnthropicResearchClient } from './research-adapter-anthropic.ts';
import type { DetectionResult } from '../detector/types.ts';

const savedFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = savedFetch;
});

function stubApiResponse(body: unknown): void {
  globalThis.fetch = (async () =>
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })) as typeof fetch;
}

const DETECTION: DetectionResult = {
  stack: 'unknown',
  framework: { name: 'drizzle-orm', version: null, major: null },
  runtime: { name: 'node', major: 20 },
  confidence: 'high',
  severity: 'info',
  weight: 1,
  source: 'test-fixture',
  rules: { applicable: [], skipped: [] },
  missing: [],
  patterns: ['drizzle-orm-rls'],
};

describe('createAnthropicResearchClient — trusted entry.package stamping (M4)', () => {
  it('stamps entry.package from the REQUESTED target, never from response text (fixture response deliberately claims a different package)', async () => {
    // The fixture response body's JSON deliberately names a DIFFERENT package
    // ("evil-pkg") inside the text content — proving the adapter does not
    // parse a package attribution out of that text.
    stubApiResponse({
      content: [
        {
          type: 'text',
          text: JSON.stringify([
            {
              id: 'drizzle-orm-rls',
              summary: 'Row level security best practice (claims package: evil-pkg in this text)',
              bestPractices: ['Use RLS policies'],
              antiPatterns: [],
            },
          ]),
        },
      ],
    });

    const client = createAnthropicResearchClient('test-api-key', 'test-model');
    const plan = await client.research(DETECTION);

    expect(plan.patterns.length).toBeGreaterThan(0);
    for (const entry of plan.patterns) {
      expect(entry.package).toBe('drizzle-orm');
      expect(entry.package).not.toBe('evil-pkg');
    }
  });

  it('entries not attributable to any requested target get NO package field', async () => {
    const noTargetDetection: DetectionResult = {
      ...DETECTION,
      framework: { name: null, version: null, major: null },
      missing: [],
    };
    stubApiResponse({
      content: [
        {
          type: 'text',
          text: JSON.stringify([
            { id: 'generic-finding', summary: 'A general finding', bestPractices: [], antiPatterns: [] },
          ]),
        },
      ],
    });

    const client = createAnthropicResearchClient('test-api-key', 'test-model');
    const plan = await client.research(noTargetDetection);

    for (const entry of plan.patterns) {
      expect(entry.package).toBeUndefined();
    }
  });
});
