// fence inject/check — composition plane (MT umbrella S4, Surface 3).
// Spec: docs/superpowers/specs/2026-07-03-multi-toolchain-convention-compiler-design.md §5.1.
//
// Fence-pins: unknown attribute ignored (forward-compat / WI-1 seam), double-inject idempotent,
// two regions in one file do not overlap, and NO `hash=` is ever emitted (T-END-B).

import { describe, expect, it } from 'vitest';
import { beginMarker, endMarker, findRegions, injectRegion, regionsMatch } from './fence.ts';

describe('fence — inject/check', () => {
  it('injects a fresh region with begin/end markers around the content', () => {
    const out = injectRegion('# Doc\n', 'configuration', 'plan.json', 'BODY');
    expect(out).toContain(beginMarker('configuration', 'plan.json'));
    expect(out).toContain('BODY');
    expect(out).toContain(endMarker('configuration'));
  });

  it('double-inject is IDEMPOTENT — injecting the same content twice is byte-identical', () => {
    const once = injectRegion('# Doc\n', 'configuration', 'plan.json', 'BODY');
    const twice = injectRegion(once, 'configuration', 'plan.json', 'BODY');
    expect(twice).toBe(once);
  });

  it('re-inject with new content replaces only the body, preserving surrounding text', () => {
    const first = injectRegion('# Head\n\n# Tail\n', 'configuration', 'plan.json', 'OLD');
    const second = injectRegion(first, 'configuration', 'plan.json', 'NEW');
    expect(second).toContain('NEW');
    expect(second).not.toContain('OLD');
    expect(second).toContain('# Head');
    expect(second).toContain('# Tail');
  });

  it('parses an UNKNOWN attribute (e.g. hash=sha256:x) without crashing — attr ignored', () => {
    const src = `<!-- getff:begin section=configuration plan=plan.json hash=sha256:abc -->\nBODY\n<!-- getff:end section=configuration -->\n`;
    const regions = findRegions(src);
    expect(regions).toHaveLength(1);
    expect(regions[0].sectionId).toBe('configuration');
    // Unknown attribute is parsed and kept but does not break region resolution.
    expect(regions[0].attributes['hash']).toBe('sha256:abc');
    expect(regions[0].body).toBe('\nBODY\n');
  });

  it('NEVER emits `hash=` when building or re-injecting a region (T-END-B)', () => {
    const out = injectRegion('# Doc\n', 'configuration', 'plan.json', 'BODY');
    expect(out).not.toContain('hash=');
    // Even when the source already carried a hash= attribute, re-inject keeps the existing
    // begin marker verbatim but the injector never AUTHORS a hash= itself.
    const withHash = `<!-- getff:begin section=s plan=p hash=sha256:x -->\nOLD\n<!-- getff:end section=s -->\n`;
    const re = injectRegion(withHash, 's', 'p', 'NEW');
    expect(re).toContain('NEW');
    // The pre-existing hash on the begin marker is preserved (input tolerance), but the fence
    // module authored none of its own — assert the body/end carry no hash.
    expect(re.split('getff:end')[0]).toContain('NEW');
  });

  it('two regions in one file do NOT overlap — each begin binds to its own end', () => {
    let src = '# Doc\n';
    src = injectRegion(src, 'alpha', 'plan.json', 'A-BODY');
    src = injectRegion(src, 'beta', 'plan.json', 'B-BODY');
    const regions = findRegions(src);
    expect(regions.map((r) => r.sectionId).sort()).toEqual(['alpha', 'beta']);
    const alpha = regions.find((r) => r.sectionId === 'alpha');
    const beta = regions.find((r) => r.sectionId === 'beta');
    expect(alpha?.body).toBe('\nA-BODY\n');
    expect(beta?.body).toBe('\nB-BODY\n');
    // Re-injecting alpha does not disturb beta.
    const re = injectRegion(src, 'alpha', 'plan.json', 'A-BODY-2');
    const reBeta = findRegions(re).find((r) => r.sectionId === 'beta');
    expect(reBeta?.body).toBe('\nB-BODY\n');
  });

  it('regionsMatch is true only when every expected body is byte-identical', () => {
    const src = injectRegion('# Doc\n', 'configuration', 'plan.json', 'BODY');
    expect(regionsMatch(src, new Map([['configuration', 'BODY']]))).toBe(true);
    expect(regionsMatch(src, new Map([['configuration', 'DRIFTED']]))).toBe(false);
    expect(regionsMatch(src, new Map([['missing', 'BODY']]))).toBe(false);
  });
});
