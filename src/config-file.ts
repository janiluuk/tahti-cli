import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

export type SavedConfig = {
  apiUrl?: string;
  token?: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
  [key: string]: unknown;
};

export function configPath(env: NodeJS.ProcessEnv = process.env) {
  if (env.XDG_CONFIG_HOME) {
    return join(env.XDG_CONFIG_HOME, 'tahti', 'config.json');
  }
  if (env.HOME) {
    return join(env.HOME, '.config', 'tahti', 'config.json');
  }
  return null;
}

export function readSavedConfig(
  env: NodeJS.ProcessEnv = process.env,
): SavedConfig {
  const path = configPath(env);
  if (!path) {
    return {};
  }
  try {
    const saved = JSON.parse(readFileSync(path, 'utf8'));
    return saved && typeof saved === 'object' ? (saved as SavedConfig) : {};
  } catch {
    return {};
  }
}

export function writeSavedConfig(env: NodeJS.ProcessEnv, saved: SavedConfig) {
  const path = configPath(env);
  if (!path) {
    return null;
  }
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  writeFileSync(path, `${JSON.stringify(saved, null, 2)}\n`, { mode: 0o600 });
  return path;
}

export function removeSavedConfig(env: NodeJS.ProcessEnv) {
  const path = configPath(env);
  if (!path) {
    return null;
  }
  rmSync(path, { force: true });
  return path;
}
