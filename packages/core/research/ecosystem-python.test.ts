import { describe, it, expect } from 'vitest';
import { normalizePep503, extractPep508Name } from './ecosystem-python.ts';

describe('normalizePep503', () => {
  it('lowercases and collapses [-_.] runs to a single -', () => {
    expect(normalizePep503('Django')).toBe('django');
    expect(normalizePep503('my_pkg')).toBe('my-pkg');
    expect(normalizePep503('my.pkg')).toBe('my-pkg');
    expect(normalizePep503('backports.tarfile')).toBe('backports-tarfile');
    expect(normalizePep503('foo-1')).toBe('foo-1');
    expect(normalizePep503('2to3')).toBe('2to3');
  });
});

describe('extractPep508Name', () => {
  it('extracts the bare name from PEP 508 spec strings (normalized)', () => {
    expect(extractPep508Name('django')).toBe('django');
    expect(extractPep508Name('django>=5.0')).toBe('django');
    expect(extractPep508Name('django[bcrypt]>=5.0')).toBe('django');
    expect(extractPep508Name('django[bcrypt]>=5.0; python_version>="3.10"')).toBe('django');
    expect(extractPep508Name('pytest>=7.0,<8.0')).toBe('pytest');
    expect(extractPep508Name('uvicorn[standard]')).toBe('uvicorn');
    expect(extractPep508Name('My_Pkg')).toBe('my-pkg');
  });

  it('returns null for unparseable / non-name shapes (fail-closed)', () => {
    expect(extractPep508Name('>=1.0')).toBeNull();      // starts with a version op
    expect(extractPep508Name('')).toBeNull();
    expect(extractPep508Name('   ')).toBeNull();
  });

  it('returns null for URL @ requirements and legacy parenthesized forms (documented drop)', () => {
    expect(extractPep508Name('my-pkg @ https://example.com/foo.tar.gz')).toBeNull();
    expect(extractPep508Name('package (>=1.0)')).toBeNull();
  });
});
