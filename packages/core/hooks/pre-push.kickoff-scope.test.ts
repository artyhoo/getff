import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import * as hook from './pre-push.ts';
import type { SectionCtx, PrePushSection } from './pre-push.ts';

const root = resolve(import.meta.dirname, '../../..');
const selector = readFileSync(join(root, 'scripts/ci-path-scope.sh'), 'utf8');
const loader = createRequire(import.meta.url).resolve('tsx/esm');
const gitEnv = { ...process.env };
for (const key of execFileSync('git', ['rev-parse', '--local-env-vars'], {
  encoding: 'utf8',
})
  .trim()
  .split('\n'))
  delete gitEnv[key];

function fixture(
  check: (repo: string, base: string, head: string) => void,
  script = selector,
) {
  const repo = mkdtempSync(join(tmpdir(), 'prepush-kickoff-'));
  const git = (...args: string[]) =>
    execFileSync('git', args, {
      cwd: repo,
      env: gitEnv,
      encoding: 'utf8',
      stdio: 'pipe',
    }).trim();
  try {
    git('init', '-q', '-b', 'main');
    git('config', 'user.email', 'fixture@example.com');
    git('config', 'user.name', 'fixture');
    mkdirSync(join(repo, 'scripts'));
    writeFileSync(join(repo, 'scripts/ci-path-scope.sh'), script);
    writeFileSync(join(repo, 'README.md'), '# Base\n');
    git('add', '.');
    git('commit', '-qm', 'base');
    const base = git('rev-parse', 'HEAD');
    mkdirSync(join(repo, '.claude/orchestrator-prompts/new-plan'), {
      recursive: true,
    });
    writeFileSync(
      join(repo, '.claude/orchestrator-prompts/new-plan/kickoff.md'),
      '# Plan\n',
    );
    git('add', '.');
    git('commit', '-qm', 'plan');
    check(repo, base, git('rev-parse', 'HEAD'));
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
}

function context(base: string | null, head: string): SectionCtx {
  return {
    isFrameworkRepo: true,
    rb: {
      base,
      head,
      commits: null,
      exclude: null,
      source: 'stdin',
      scopeSafe: true,
    },
  };
}

describe('pre-push kickoff scope — committed range, never branch-name inference', () => {
  it('recognizes a linear kickoff publication through the real CI selector', () => {
    fixture((repo, base, head) => {
      expect(hook.isKickoffPublicationPush(context(base, head), repo)).toBe(
        true,
      );
      expect(hook.isKickoffPublicationPush(context(null, head), repo)).toBe(
        false,
      );
      expect(
        hook.isKickoffPublicationPush(
          { ...context(base, head), isFrameworkRepo: false },
          repo,
        ),
      ).toBe(false);
      expect(
        hook.isKickoffPublicationPush(context('missing', head), repo),
      ).toBe(false);
    });
  });

  it('dirty documents and a clean checkout of a different pushed tree retain full checks', () => {
    fixture((repo, base, head) => {
      writeFileSync(join(repo, 'README.md'), '# Dirty runtime context\n');
      expect(hook.isKickoffPublicationPush(context(base, head), repo)).toBe(
        false,
      );
      writeFileSync(join(repo, 'README.md'), '# Base\n');
      execFileSync('git', ['checkout', '-q', base], { cwd: repo, env: gitEnv });
      expect(hook.isKickoffPublicationPush(context(base, head), repo)).toBe(
        false,
      );
    });
  });

  it('staged dirt cannot cancel against a worktree restored to HEAD', () => {
    fixture((repo, base, head) => {
      writeFileSync(join(repo, 'README.md'), '# Staged runtime context\n');
      execFileSync('git', ['add', 'README.md'], { cwd: repo, env: gitEnv });
      writeFileSync(join(repo, 'README.md'), '# Base\n');
      expect(hook.isKickoffPublicationPush(context(base, head), repo)).toBe(
        false,
      );
    });
  });

  it('a mixed committed range and a multi-ref push retain full checks', () => {
    fixture((repo, base, head) => {
      expect(
        hook.isKickoffPublicationPush(
          {
            ...context(base, head),
            rb: { ...context(base, head).rb, scopeSafe: false },
          },
          repo,
        ),
      ).toBe(false);
      writeFileSync(join(repo, 'runtime.ts'), 'export const value = 1;\n');
      execFileSync('git', ['add', '.'], { cwd: repo, env: gitEnv });
      execFileSync('git', ['commit', '-qm', 'runtime'], {
        cwd: repo,
        env: gitEnv,
      });
      expect(hook.isKickoffPublicationPush(context(base, 'HEAD'), repo)).toBe(
        false,
      );
    });
  });

  it('a changed selector cannot authorize its own skip', () => {
    fixture((repo, base) => {
      writeFileSync(
        join(repo, 'scripts/ci-path-scope.sh'),
        '#!/bin/sh\necho kickoff_only=true\n',
      );
      execFileSync('git', ['add', '.'], { cwd: repo, env: gitEnv });
      execFileSync('git', ['commit', '-qm', 'selector change'], {
        cwd: repo,
        env: gitEnv,
      });
      expect(hook.isKickoffPublicationPush(context(base, 'HEAD'), repo)).toBe(
        false,
      );
    });
  });

  it('same-tree history on another checkout is not the pushed HEAD', () => {
    fixture((repo, base, head) => {
      execFileSync('git', ['commit', '--allow-empty', '-qm', 'another HEAD'], {
        cwd: repo,
        env: gitEnv,
      });
      expect(hook.isKickoffPublicationPush(context(base, head), repo)).toBe(
        false,
      );
    });
  });
  it('a failed selector never grants the shortened push', () => {
    fixture((repo, base, head) => {
      expect(hook.isKickoffPublicationPush(context(base, head), repo)).toBe(
        false,
      );
    }, '#!/bin/sh\nexit 7\n');
  });
});

describe('pre-push kickoff scope — raw stdin admission', () => {
  const valid = `refs/heads/plan ${'a'.repeat(40)} refs/heads/plan ${'b'.repeat(40)}\n`;
  it('rejects multi-ref, malformed extra lines, deletion and override-plus-stdin', () => {
    expect(hook.kickoffPushShapeSafe(valid, false)).toBe(true);
    expect(hook.kickoffPushShapeSafe('', false)).toBe(true);
    expect(hook.kickoffPushShapeSafe(valid + valid, false)).toBe(false);
    expect(
      hook.kickoffPushShapeSafe(valid + 'malformed extra ref\n', false),
    ).toBe(false);
    expect(hook.kickoffPushShapeSafe(valid.trim() + ' extra\n', false)).toBe(
      false,
    );
    expect(
      hook.kickoffPushShapeSafe(
        valid.replace('a'.repeat(40), '0'.repeat(40)),
        false,
      ),
    ).toBe(false);
    expect(hook.kickoffPushShapeSafe(valid, true)).toBe(false);
    expect(
      hook.kickoffPushShapeSafe(
        valid.replace('refs/heads/plan', 'HEAD'),
        false,
      ),
    ).toBe(true);
    expect(
      hook.kickoffPushShapeSafe(
        valid.replace(
          'refs/heads/plan ' + 'b'.repeat(40),
          'garbage ' + 'b'.repeat(40),
        ),
        false,
      ),
    ).toBe(false);
    expect(
      hook.kickoffPushShapeSafe(
        valid.replace(
          'refs/heads/plan ' + 'b'.repeat(40),
          'refs/heads/bad..name ' + 'b'.repeat(40),
        ),
        false,
      ),
    ).toBe(false);
  });
});

describe('pre-push kickoff scope — real stdin resolution in source and shipped bundle', () => {
  it('binds raw multi-ref/override safeguards through the real resolver, not constructed contexts', () => {
    fixture((repo, base, head) => {
      for (const name of ['pre-push.ts', 'pre-push.bundle.mjs']) {
        const url = pathToFileURL(join(root, 'packages/core/hooks', name)).href;
        const code = `import {resolveBase,isKickoffPublicationPush} from ${JSON.stringify(url)};
          const rb=resolveBase(); console.log(JSON.stringify({safe:rb.scopeSafe,selected:isKickoffPublicationPush({rb,isFrameworkRepo:true},process.cwd())}));`;
        const invoke = (input: string, override = '') =>
          JSON.parse(
            execFileSync(
              process.execPath,
              ['--import', loader, '--input-type=module', '-e', code],
              {
                cwd: repo,
                env: { ...gitEnv, PREPUSH_UPSTREAM_REF: override },
                input,
                encoding: 'utf8',
              },
            ).trim(),
          );
        execFileSync('git', ['update-ref', 'refs/remotes/origin/main', base], {
          cwd: repo,
          env: gitEnv,
        });
        const valid = `refs/heads/plan ${head} refs/heads/plan ${base}\n`;
        expect(invoke(valid), name).toEqual({ safe: true, selected: true });
        expect(
          invoke(valid.replace(`refs/heads/plan ${base}`, `garbage ${base}`)),
          name,
        ).toEqual({ safe: false, selected: false });
        expect(invoke(valid.replace(base, 'f'.repeat(40))), name).toEqual({
          safe: false,
          selected: false,
        });
        expect(invoke(valid + valid), name).toEqual({
          safe: false,
          selected: false,
        });
        expect(invoke(valid + 'malformed\n'), name).toEqual({
          safe: false,
          selected: false,
        });
        expect(invoke(valid, base), name).toEqual({
          safe: false,
          selected: false,
        });
      }
    });
  });
});

describe('pre-push kickoff scope — execute checks, never bypass the hook', () => {
  const ctx = context(null, 'HEAD');
  const runtimeIds = [
    'canonical-source',
    'ir-meta',
    'backends-meta',
    'composition-meta',
  ];
  it('only omits the four unrelated suites; document, provenance and future checks still execute', async () => {
    const ran: string[] = [];
    for (const id of [
      ...runtimeIds,
      'principles-meta',
      'spec-discipline',
      'line-citations',
      'prior-art',
      's17',
      'future-check',
    ]) {
      await hook.runPushSection(
        {
          id,
          owner: 'maintainer',
          run: () => {
            ran.push(id);
          },
        },
        ctx,
        true,
      );
    }
    expect(ran).toEqual([
      'principles-meta',
      'spec-discipline',
      'line-citations',
      'prior-art',
      's17',
      'future-check',
    ]);
  });
  it('full selection preserves suite failures; kickoff selection preserves document failures', async () => {
    const broken: PrePushSection = {
      id: 'backends-meta',
      owner: 'maintainer',
      run: () => {
        throw new Error('backend RED');
      },
    };
    await expect(hook.runPushSection(broken, ctx, false)).rejects.toThrow(
      'backend RED',
    );
    await expect(
      hook.runPushSection({ ...broken, id: 'spec-discipline' }, ctx, true),
    ).rejects.toThrow('backend RED');
    await expect(
      hook.runPushSection(broken, { ...ctx, isFrameworkRepo: false }, true),
    ).rejects.toThrow('backend RED');
  });
});
