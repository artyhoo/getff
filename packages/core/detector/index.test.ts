import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { detectStack } from './index.ts';
import { detectPassportFields } from './passport.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../..');
const TMP = resolve(REPO_ROOT, '.tmp-detector-test');

function writePkg(deps: Record<string, string>, devDeps: Record<string, string> = {}) {
  mkdirSync(TMP, { recursive: true });
  writeFileSync(
    resolve(TMP, 'package.json'),
    JSON.stringify({ name: 'fake', dependencies: deps, devDependencies: devDeps }),
  );
}

describe('detectStack — manifest priority 4', () => {
  beforeEach(() => {
    rmSync(TMP, { recursive: true, force: true });
    mkdirSync(TMP, { recursive: true });
  });
  afterEach(() => {
    rmSync(TMP, { recursive: true, force: true });
  });

  it('next@^16 in deps → react-next, framework.major=16, confidence=medium', () => {
    writePkg({ next: '^16.0.1', react: '^19.0.0' });
    const r = detectStack(TMP);
    expect(r.stack).toBe('react-next');
    expect(r.framework.name).toBe('next');
    expect(r.framework.major).toBe(16);
    expect(r.confidence).toBe('medium');
    expect(r.severity).toBe('warn');
    expect(r.weight).toBe(1);
    expect(r.source).toBe('package.json');
  });

  it('next@^15 in deps → framework.major=15 (version-aware Next 15 vs 16)', () => {
    writePkg({ next: '^15.4.2' });
    const r = detectStack(TMP);
    expect(r.framework.major).toBe(15);
  });

  it('react-only (no next) → still react-next stack, framework.name=react', () => {
    writePkg({ react: '^19.0.0' });
    const r = detectStack(TMP);
    expect(r.stack).toBe('react-next');
    expect(r.framework.name).toBe('react');
  });

  it('no react/next markers → ts-server fallback, framework.name=null', () => {
    writePkg({ zod: '^3.24.0' });
    const r = detectStack(TMP);
    expect(r.stack).toBe('ts-server');
    expect(r.framework.name).toBeNull();
  });

  it('absent package.json + tsconfig.json present → priority 5 (low)', () => {
    writeFileSync(resolve(TMP, 'tsconfig.json'), '{}');
    const r = detectStack(TMP);
    expect(r.stack).toBe('ts-server');
    expect(r.confidence).toBe('low');
    expect(r.severity).toBe('info');
    expect(r.source).toBe('tsconfig.json');
  });

  it('next.config.js present (no package.json) → priority 5 react-next', () => {
    writeFileSync(resolve(TMP, 'next.config.js'), 'module.exports = {};');
    const r = detectStack(TMP);
    expect(r.stack).toBe('react-next');
    expect(r.framework.name).toBe('next');
    expect(r.confidence).toBe('low');
  });

  it('completely empty dir → unknown, source empty, low confidence', () => {
    const r = detectStack(TMP);
    expect(r.stack).toBe('unknown');
    expect(r.confidence).toBe('low');
    expect(r.source).toBe('');
  });

  it('skipAif=true bypasses .ai-factory reads (covered by read-aif tests; smoke check)', () => {
    writePkg({ next: '^16.0.0' });
    const r = detectStack(TMP, { skipAif: true });
    expect(r.source).toBe('package.json');
  });
});

describe('detectStack — self-application on this repo', () => {
  it('repo root resolves to a non-empty result', () => {
    const r = detectStack(REPO_ROOT, { skipAif: true });
    // This repo is the meta-factory itself: zod is a dep, next is not — expect ts-server.
    expect(r.stack).toBe('ts-server');
    expect(r.source).toBe('package.json');
    expect(r.confidence).toBe('medium');
  });
});

describe('detectStack — missing[] field (v1.1)', () => {
  beforeEach(() => {
    rmSync(TMP, { recursive: true, force: true });
    mkdirSync(TMP, { recursive: true });
  });
  afterEach(() => {
    rmSync(TMP, { recursive: true, force: true });
  });

  it('package.json with vitest installed → vitest NOT in missing', () => {
    writePkg({}, { vitest: '^4.1.5' });
    const r = detectStack(TMP);
    expect(Array.isArray(r.missing)).toBe(true);
    expect(r.missing).not.toContain('vitest');
  });

  it('package.json with none of the known packages → all 6 in missing', () => {
    writePkg({ next: '^16.0.0' });
    const r = detectStack(TMP);
    expect(r.missing).toContain('@opentelemetry/api');
    expect(r.missing).toContain('@playwright/test');
    expect(r.missing).toContain('vitest');
    expect(r.missing).toContain('@storybook/nextjs');
    expect(r.missing).toContain('@storybook/nextjs-vite');
    expect(r.missing).toContain('tailwindcss');
  });

  it('empty dir (unknown stack) → missing is an array (not undefined)', () => {
    const r = detectStack(TMP);
    expect(Array.isArray(r.missing)).toBe(true);
  });
});

describe('detectPassportFields — uiLayer Storybook framework packages', () => {
  beforeEach(() => {
    rmSync(TMP, { recursive: true, force: true });
    mkdirSync(TMP, { recursive: true });
  });
  afterEach(() => {
    rmSync(TMP, { recursive: true, force: true });
  });

  it('@storybook/nextjs-vite alone (no meta storybook package) → Storybook', () => {
    writePkg({}, { '@storybook/nextjs-vite': '^10.5.0' });
    expect(detectPassportFields(TMP).uiLayer).toBe('Storybook');
  });

  it('@storybook/react-vite alone → Storybook', () => {
    writePkg({}, { '@storybook/react-vite': '^10.5.0' });
    expect(detectPassportFields(TMP).uiLayer).toBe('Storybook');
  });

  it('negative control: no storybook packages → uiLayer null', () => {
    writePkg({ next: '^16.0.0' }, { vitest: '^4.1.5' });
    expect(detectPassportFields(TMP).uiLayer).toBeNull();
  });
});

describe('detectStack — patterns[] field (v1.1)', () => {
  beforeEach(() => {
    rmSync(TMP, { recursive: true, force: true });
    mkdirSync(TMP, { recursive: true });
  });
  afterEach(() => {
    rmSync(TMP, { recursive: true, force: true });
  });

  it('empty dir → patterns is an empty array', () => {
    const r = detectStack(TMP);
    expect(Array.isArray(r.patterns)).toBe(true);
    expect(r.patterns).toHaveLength(0);
  });

  it('dir with app/ → patterns contains nextjs-app-router', () => {
    mkdirSync(resolve(TMP, 'app'), { recursive: true });
    writePkg({ next: '^16.0.0' });
    const r = detectStack(TMP);
    expect(r.patterns).toContain('nextjs-app-router');
  });

  it('dir without app/ or pages/ → neither router pattern present', () => {
    writePkg({ next: '^16.0.0' });
    const r = detectStack(TMP);
    expect(r.patterns).not.toContain('nextjs-app-router');
    expect(r.patterns).not.toContain('nextjs-pages-router');
  });

  it('patterns field is always present even for unknown stack', () => {
    const r = detectStack(TMP);
    expect(r).toHaveProperty('patterns');
    expect(r).toHaveProperty('missing');
  });
});
