import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sibling = resolve(root, '../tahti-org');
const envPath = process.env.TAHTI_ORG_PATH
  ? resolve(process.env.TAHTI_ORG_PATH)
  : null;

function run(cmd, args, cwd) {
  const result = spawnSync(cmd, args, { cwd, stdio: 'inherit' });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function packFrom(orgRoot) {
  run('pnpm', ['--filter', '@tahti/api-client', 'generate'], orgRoot);
  run('pnpm', ['--filter', '@tahti/api-client', 'build:dist'], orgRoot);
  const pack = spawnSync('pnpm', ['pack'], {
    cwd: join(orgRoot, 'packages/api-client'),
    encoding: 'utf8',
  });
  if (pack.status !== 0) {
    process.stderr.write(pack.stderr || '');
    process.exit(pack.status ?? 1);
  }
  const line = (pack.stdout || '')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
    .at(-1);
  if (!line) {
    console.error('pnpm pack produced no tarball name');
    process.exit(1);
  }
  const tgz = join(orgRoot, 'packages/api-client', line);
  console.log(tgz);
  return tgz;
}

if (envPath && existsSync(join(envPath, 'packages/api-client/package.json'))) {
  packFrom(envPath);
} else if (existsSync(join(sibling, 'packages/api-client/package.json'))) {
  packFrom(sibling);
} else {
  const dir = mkdtempSync(join(tmpdir(), 'tahti-org-'));
  try {
    run(
      'git',
      [
        'clone',
        '--depth',
        '1',
        'https://github.com/janiluuk/tahti-org.git',
        dir,
      ],
      process.cwd(),
    );
    run('pnpm', ['install', '--frozen-lockfile'], dir);
    packFrom(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
