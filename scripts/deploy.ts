import { execFileSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

/** Publish a normal fast-forward commit; never force-push or modify the source checkout. */
export function deploy(root = process.cwd(), repository?: string): boolean {
  const git = (cwd: string, args: string[]) =>
    execFileSync('git', args, {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  const build = join(root, 'build');
  if (!existsSync(join(build, 'index.html')))
    throw new Error('Build output is missing. Run npm run build first.');
  const remote = repository ?? git(root, ['remote', 'get-url', 'origin']);
  const temporary = mkdtempSync(join(tmpdir(), 'sudoku-deploy-'));
  try {
    const checkout = join(temporary, 'site');
    git(temporary, [
      'clone',
      '--single-branch',
      '--branch',
      'gh-pages',
      '--depth',
      '1',
      '--',
      remote,
      checkout,
    ]);
    for (const key of ['user.name', 'user.email']) {
      try {
        const value = git(root, ['config', key]);
        if (value) git(checkout, ['config', key, value]);
      } catch {
        /* Git may still have a global identity. */
      }
    }
    const cname = existsSync(join(checkout, 'CNAME'))
      ? readFileSync(join(checkout, 'CNAME'))
      : null;
    for (const name of readdirSync(checkout))
      if (name !== '.git')
        rmSync(join(checkout, name), { recursive: true, force: true });
    cpSync(build, checkout, { recursive: true });
    if (cname && !existsSync(join(checkout, 'CNAME')))
      writeFileSync(join(checkout, 'CNAME'), cname);
    writeFileSync(join(checkout, '.nojekyll'), '');
    git(checkout, ['add', '--all']);
    if (!git(checkout, ['status', '--porcelain'])) return false;
    git(checkout, ['commit', '-m', 'Deploy Modern Sudoku']);
    git(checkout, ['push', 'origin', 'HEAD:gh-pages']);
    return true;
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  try {
    console.log(
      deploy()
        ? 'Published build to the gh-pages branch.'
        : 'The published build is already up to date.',
    );
  } catch {
    console.error(
      'Publish failed. Check Git authentication, author identity, and the existing gh-pages branch, then retry. No force push was attempted.',
    );
    process.exitCode = 1;
  }
}
