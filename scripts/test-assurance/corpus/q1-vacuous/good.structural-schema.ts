import { describe, expect, it } from 'vitest';

// Q1 good companion — a legitimate STRUCTURAL/SCHEMA contract (spec §5 keep-list).
// The subject is a real call; toMatchObject pins the documented output shape.
interface KernelConfig {
  stage: string;
  requireHost?: string;
}

function parseConfig(raw: unknown): KernelConfig {
  if (typeof raw !== 'object' || raw === null || !('stage' in raw)) {
    throw new TypeError('config must carry a stage');
  }
  return raw as KernelConfig;
}

describe('q1 good: schema contract', () => {
  it('parses a minimal config into the documented shape', () => {
    expect(parseConfig({ stage: 'S1' })).toMatchObject({ stage: 'S1' });
  });
  it('rejects a config without a stage', () => {
    expect(() => parseConfig({})).toThrow(/stage/);
  });
});
