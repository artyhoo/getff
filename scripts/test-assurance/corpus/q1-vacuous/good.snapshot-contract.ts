import { describe, expect, it } from 'vitest';

// Q1 good companion — a legitimate SNAPSHOT/structural contract (spec §5 keep-list:
// «snapshots, structural/schema contracts»). The subject is a real call; the matcher
// pins the documented shape rather than comparing a fabricated literal to itself.
function renderBanner(name: string): string {
  return `== ${name} ==`;
}

describe('q1 good: snapshot-style structural contract', () => {
  it('renders the documented banner shape', () => {
    expect(renderBanner('kernel')).toMatch(/^== .+ ==$/);
  });
});
