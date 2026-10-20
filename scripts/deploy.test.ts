// @vitest-environment node
import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { deploy } from './deploy';
it('publishes only to an isolated local Pages branch, removes old assets and skips identical builds', () => {
  const temporary = mkdtempSync(join(tmpdir(), 'sudoku-publish-test-'));
  const git = (cwd: string, ...args: string[]) =>
    execFileSync('git', args, {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  try {
    const remote = join(temporary, 'remote.git');
    git(temporary, 'init', '--bare', remote);
    const root = join(temporary, 'source');
    mkdirSync(root);
    git(root, 'init');
    git(root, 'config', 'user.name', 'Local test');
    git(root, 'config', 'user.email', 'test@example.invalid');
    git(root, 'remote', 'add', 'origin', remote);
    git(root, 'checkout', '-b', 'gh-pages');
    writeFileSync(join(root, 'old.js'), 'old');
    writeFileSync(join(root, 'CNAME'), 'example.invalid');
    git(root, 'add', '.');
    git(root, 'commit', '-m', 'Initial local pages');
    git(root, 'push', 'origin', 'gh-pages');
    git(root, 'checkout', '-b', 'main');
    const before = git(root, 'rev-parse', 'HEAD');
    mkdirSync(join(root, 'build'));
    writeFileSync(join(root, 'build/index.html'), '<h1>Sudoku</h1>');
    expect(deploy(root, remote)).toBe(true);
    expect(deploy(root, remote)).toBe(false);
    expect(git(root, 'rev-parse', 'HEAD')).toBe(before);
    expect(readFileSync(join(root, 'old.js'), 'utf8')).toBe('old');
    expect(
      git(temporary, '--git-dir', remote, 'show', 'gh-pages:index.html'),
    ).toBe('<h1>Sudoku</h1>');
    expect(git(temporary, '--git-dir', remote, 'show', 'gh-pages:CNAME')).toBe(
      'example.invalid',
    );
    expect(
      git(temporary, '--git-dir', remote, 'ls-tree', '--name-only', 'gh-pages'),
    ).not.toContain('old.js');
    expect(existsSync(join(root, 'build/index.html'))).toBe(true);
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
});
