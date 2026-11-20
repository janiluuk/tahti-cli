import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const vendorTgz = join(root, 'vendor/tahti-api-client-0.1.0.tgz');

function run(cmd, args) {
  const result = spawnSync(cmd, args, { cwd: root, stdio: 'inherit' });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

const view = spawnSync('npm', ['view', '@tahti/api-client', 'version'], {
  encoding: 'utf8',
});
if (view.status === 0 && view.stdout.trim()) {
  console.log(
    `npm has @tahti/api-client@${view.stdout.trim()}; installing latest`,
  );
  run('pnpm', ['add', '@tahti/api-client@latest']);
  process.exit(0);
}

if (existsSync(vendorTgz)) {
  console.log('@tahti/api-client not on npm; using committed vendor/ tarball');
  run('pnpm', ['add', 'file:vendor/tahti-api-client-0.1.0.tgz']);
  process.exit(0);
}

console.log(
  '@tahti/api-client not on npm and no vendor/; packing from tahti-org',
);
const pack = spawnSync('node', ['scripts/pack-sdk-from-org.mjs'], {
  cwd: root,
  encoding: 'utf8',
});
if (pack.status !== 0) {
  process.stderr.write(pack.stderr || pack.stdout || '');
  process.exit(pack.status ?? 1);
}
const tgz = (pack.stdout || '').trim().split('\n').filter(Boolean).at(-1);
if (!tgz) {
  console.error('pack-sdk-from-org printed no tarball path');
  process.exit(1);
}
mkdirSync(join(root, 'vendor'), { recursive: true });
copyFileSync(tgz, vendorTgz);
run('pnpm', ['add', 'file:vendor/tahti-api-client-0.1.0.tgz']);
