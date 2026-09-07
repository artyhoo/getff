// R-1 (ledger-1597-fixes): unit contract for the shared path-containment guards.
// Kept under 80 LOC by design — a NEW file ≥80 LOC under packages/ mechanically
// trips the capability-commit detector (CLAUDE.md), and this file adds only the
// helper's own surface: the exhaustive VALUE-surface coverage already lives in
// ecosystem-cargo.test.ts (symlink-escape paired-negatives) and
// ecosystem-python.test.ts (venv-lib containment), both UNCHANGED by design.
import { describe, it, expect } from 'vitest';
import { mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { isUnsafeDepName, isWithinRoot, resolvedWithinRoot } from './research-path-guards.ts';

describe('isUnsafeDepName — shared name guard (two modes)', () => {
  it("DEFAULT ('strictest') rejects `..`, both separators, and the platform sep", () => {
    expect(isUnsafeDepName('../escape')).toBe(true);
    expect(isUnsafeDepName('a/b')).toBe(true);
    expect(isUnsafeDepName('a\\b')).toBe(true);
    expect(isUnsafeDepName(`a${sep}b`)).toBe(true);
    expect(isUnsafeDepName('serde')).toBe(false);
  });

  it("'go-feed-raw' rejects `..` and `\\` only — `/`-bearing module paths pass (frozen F3 feed-raw)", () => {
    expect(isUnsafeDepName('github.com/user/repo', 'go-feed-raw')).toBe(false);
    expect(isUnsafeDepName('../escape', 'go-feed-raw')).toBe(true);
    expect(isUnsafeDepName('github.com/../etc/passwd', 'go-feed-raw')).toBe(true);
    expect(isUnsafeDepName('foo\\bar', 'go-feed-raw')).toBe(true);
  });
});

describe('isWithinRoot — lexical primitive', () => {
  it('accepts root itself and strict descendants; rejects outside and sibling-prefixed paths', () => {
    const root = resolve('/tmp', 'wcr-root');
    expect(isWithinRoot(root, root)).toBe(true);
    expect(isWithinRoot(join(root, 'a', 'b'), root)).toBe(true);
    expect(isWithinRoot(resolve('/tmp', 'wcr-other'), root)).toBe(false);
    // Prefix-spoof: /root-evil must NOT pass a /root check (trailing-sep discipline).
    expect(isWithinRoot(root + '-evil', root)).toBe(false);
  });
});

describe('resolvedWithinRoot — realpath-both-sides VALUE gate', () => {
  it('resolves an existing in-tree path; null for a missing one; `..` escapes fail closed', () => {
    const root = mkdtempSync(join(tmpdir(), 'rpg-'));
    writeFileSync(join(root, 'real.toml'), '[package]\nname = "x"\n');
    expect(resolvedWithinRoot(root, 'real.toml')).toBe(join(root, 'real.toml'));
    expect(resolvedWithinRoot(root, 'absent.toml')).toBeNull();
    expect(resolvedWithinRoot(root, '..', 'elsewhere.toml')).toBeNull();
  });

  it('rejects an in-tree symlink OUT-OF-TREE, admits one whose target is also within root', () => {
    const root = mkdtempSync(join(tmpdir(), 'rpg-'));
    const outside = mkdtempSync(join(tmpdir(), 'rpg-evil-'));
    mkdirSync(join(root, 'vendor'), { recursive: true });
    symlinkSync(outside, join(root, 'vendor', 'evil'));
    expect(resolvedWithinRoot(root, 'vendor', 'evil', 'Cargo.toml')).toBeNull(); // 2nd-BLOCKER shape
    writeFileSync(join(root, 'real.toml'), '[package]\nname = "x"\n');
    symlinkSync(join(root, 'real.toml'), join(root, 'alias.toml'));
    expect(resolvedWithinRoot(root, 'alias.toml')).toBe(join(root, 'alias.toml'));
  });
});
