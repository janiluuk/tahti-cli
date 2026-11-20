import { createTahtiClient } from '@tahti/api-client';

import { readSavedConfig, writeSavedConfig } from './config-file.js';

const DEFAULT_API_URL = 'https://api.tahti.live';

const TOKEN_HELP =
  'Create a personal API token at tahti.live → Settings → Account → API tokens, then run `tahti login`, or use `tahti login --device` with your account password. You can also export TAHTI_API_TOKEN.';

export class CliError extends Error {}

export type CliConfig = {
  apiUrl: string;
  token: string | null;
  refreshToken: string | null;
  expiresAt: number | null;
  env?: NodeJS.ProcessEnv;
};

type FetchImpl = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export function resolveConfig(
  env: NodeJS.ProcessEnv = process.env,
  saved = readSavedConfig(env),
): CliConfig {
  const apiUrl = (env.TAHTI_API_URL || saved.apiUrl || DEFAULT_API_URL).replace(
    /\/$/,
    '',
  );
  const token =
    env.TAHTI_API_TOKEN ||
    (typeof saved.token === 'string' && saved.token ? saved.token : null) ||
    (typeof saved.accessToken === 'string' && saved.accessToken
      ? saved.accessToken
      : null);
  const refreshToken =
    typeof saved.refreshToken === 'string' && saved.refreshToken
      ? saved.refreshToken
      : null;
  const expiresAt =
    typeof saved.expiresAt === 'number' && Number.isFinite(saved.expiresAt)
      ? saved.expiresAt
      : null;
  return { apiUrl, token, refreshToken, expiresAt, env };
}

export function buildQuery(params: Record<string, unknown>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      search.set(key, String(value));
    }
  }
  const query = search.toString();
  return query ? `?${query}` : '';
}

async function readErrorMessage(res: Response): Promise<string | null> {
  try {
    const body = (await res.json()) as { error?: unknown };
    if (typeof body?.error === 'string' && body.error) {
      return body.error;
    }
  } catch {
    // Non-JSON error bodies (proxies, HTML error pages) fall back to the status line.
  }
  return null;
}

export function describeHttpError(
  status: number,
  path: string,
  apiMessage: string | null,
): string {
  const suffix = apiMessage ? ` (${apiMessage})` : '';
  if (status === 401) {
    return `Token invalid or missing scope${suffix}. ${TOKEN_HELP}`;
  }
  if (
    status === 403 &&
    apiMessage &&
    !/token|scope|^forbidden$/i.test(apiMessage)
  ) {
    return apiMessage;
  }
  if (status === 403) {
    return `Token invalid or missing scope${suffix}: this token is not allowed to access ${path}.`;
  }
  if (status === 404) {
    return apiMessage ?? `Not found: ${path}`;
  }
  return apiMessage
    ? `${apiMessage} (HTTP ${status})`
    : `${path} → HTTP ${status}`;
}

export function parsePositiveInt(
  flag: string,
  value: string | undefined,
  max?: number,
): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1 || (max && number > max)) {
    const range = max ? `1-${max}` : 'a positive integer';
    throw new CliError(`Invalid ${flag} "${value}". Expected ${range}.`);
  }
  return number;
}

function persistDeviceTokens(config: CliConfig) {
  const env = config.env ?? process.env;
  const saved = readSavedConfig(env);
  const next = { ...saved };
  delete next.token;
  if (config.token) {
    next.accessToken = config.token;
  }
  if (config.refreshToken) {
    next.refreshToken = config.refreshToken;
  }
  if (typeof config.expiresAt === 'number') {
    next.expiresAt = config.expiresAt;
  }
  writeSavedConfig(env, next);
}

export async function refreshAccessToken(
  config: CliConfig,
  { fetchImpl = fetch }: { fetchImpl?: FetchImpl } = {},
): Promise<string | null> {
  if (!config.refreshToken) {
    return null;
  }
  let res: Response;
  try {
    res = await fetchImpl(`${config.apiUrl}/api/auth/token/refresh`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refreshToken: config.refreshToken }),
    });
  } catch {
    return null;
  }
  if (!res.ok) {
    return null;
  }
  const body = (await res.json().catch(() => ({}))) as {
    accessToken?: string;
    refreshToken?: string;
    expiresIn?: number;
  };
  if (!body.accessToken || !body.expiresIn) {
    return null;
  }
  config.token = body.accessToken;
  if (typeof body.refreshToken === 'string' && body.refreshToken) {
    config.refreshToken = body.refreshToken;
  }
  config.expiresAt = Date.now() + Number(body.expiresIn) * 1000;
  persistDeviceTokens(config);
  return config.token;
}

function resolveFetchInput(input: RequestInfo | URL): {
  url: string;
  init: RequestInit;
} {
  if (typeof input === 'string' || input instanceof URL) {
    return { url: String(input), init: {} };
  }
  return {
    url: input.url,
    init: {
      method: input.method,
      headers: input.headers,
      body: input.body,
    },
  };
}

function headersToObject(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  headers.forEach((value, key) => {
    if (key === 'authorization') {
      out.Authorization = value;
    } else if (key === 'content-type') {
      out['Content-Type'] = value;
    } else if (key === 'accept') {
      out.Accept = value;
    } else {
      out[key] = value;
    }
  });
  return out;
}

function createAuthorizedFetch(
  config: CliConfig,
  fetchImpl: FetchImpl,
): FetchImpl {
  return async (input, init) => {
    const { url, init: fromRequest } = resolveFetchInput(input);
    const headers = new Headers(fromRequest.headers);
    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => {
        headers.set(key, value);
      });
    }
    const method = init?.method ?? fromRequest.method ?? 'GET';
    let body = init?.body ?? fromRequest.body;
    if (
      body &&
      typeof body !== 'string' &&
      typeof (body as { getReader?: unknown }).getReader === 'function' &&
      input instanceof Request
    ) {
      body = await input.clone().text();
    }

    const run = (token: string | null) => {
      const nextHeaders = new Headers(headers);
      if (token) {
        nextHeaders.set('Authorization', `Bearer ${token}`);
      } else {
        nextHeaders.delete('Authorization');
      }
      return fetchImpl(url, {
        method,
        headers: headersToObject(nextHeaders),
        ...(body !== undefined && body !== null && method !== 'GET'
          ? { body }
          : {}),
      });
    };

    let res: Response;
    try {
      res = await run(config.token);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new CliError(
        `Could not reach the Tahti API at ${config.apiUrl}: ${message}`,
      );
    }
    if (res.status === 401 && config.refreshToken) {
      const next = await refreshAccessToken(config, { fetchImpl });
      if (next) {
        try {
          res = await run(next);
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          throw new CliError(
            `Could not reach the Tahti API at ${config.apiUrl}: ${message}`,
          );
        }
      }
    }
    return res;
  };
}

export function createCliClient(
  config: CliConfig,
  { fetchImpl = fetch, token }: { fetchImpl?: FetchImpl; token?: string } = {},
) {
  return createTahtiClient({
    baseUrl: config.apiUrl,
    token: token ?? config.token ?? undefined,
    fetch: createAuthorizedFetch(config, fetchImpl) as never,
  });
}

async function requestJson(
  method: string,
  path: string,
  config: CliConfig,
  {
    auth = true,
    body,
    fetchImpl = fetch,
  }: {
    auth?: boolean;
    body?: unknown;
    fetchImpl?: FetchImpl;
  } = {},
) {
  if (auth && !config.token) {
    throw new CliError(`Missing API token. ${TOKEN_HELP}`);
  }

  const baseFetch: FetchImpl = auth
    ? createAuthorizedFetch(config, fetchImpl)
    : async (input, init) => {
        try {
          const { url, init: fromRequest } = resolveFetchInput(input);
          const headers = new Headers(fromRequest.headers);
          if (init?.headers) {
            new Headers(init.headers).forEach((value, key) => {
              headers.set(key, value);
            });
          }
          headers.delete('Authorization');
          const method = init?.method ?? fromRequest.method ?? 'GET';
          const body = init?.body ?? fromRequest.body;
          return await fetchImpl(url, {
            method,
            headers: headersToObject(headers),
            ...(body !== undefined && body !== null && method !== 'GET'
              ? { body }
              : {}),
          });
        } catch (error) {
          if (error instanceof CliError) {
            throw error;
          }
          const message =
            error instanceof Error ? error.message : String(error);
          throw new CliError(
            `Could not reach the Tahti API at ${config.apiUrl}: ${message}`,
          );
        }
      };

  const client = createTahtiClient({
    baseUrl: config.apiUrl,
    token: auth ? (config.token ?? undefined) : undefined,
    fetch: (async (input, init) => {
      const res = await baseFetch(input, init);
      if (res instanceof Response) {
        return res;
      }
      const mock = res as {
        status?: number;
        headers?: Headers;
        json?: () => Promise<unknown>;
        text?: () => Promise<string>;
      };
      let bodyText = '';
      if (typeof mock.text === 'function') {
        try {
          bodyText = await mock.text();
        } catch {
          bodyText = '';
        }
      } else if (typeof mock.json === 'function') {
        try {
          bodyText = JSON.stringify(await mock.json());
        } catch {
          bodyText = '';
        }
      }
      const status = mock.status ?? 200;
      const noBody = status === 204 || status === 205 || status === 304;
      return new Response(noBody ? null : bodyText || null, {
        status,
        headers: mock.headers ?? { 'Content-Type': 'application/json' },
      });
    }) as FetchImpl,
  });

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  const result = await client.request(
    method as never,
    // openapi-fetch types every path; CLI helpers keep string paths.
    path as never,
    {
      headers,
      ...(body !== undefined ? { body: body as never } : {}),
    } as never,
  );

  const response = result.response;
  if (!response.ok) {
    const fromSdk =
      result.error &&
      typeof result.error === 'object' &&
      'error' in result.error &&
      typeof (result.error as { error: unknown }).error === 'string'
        ? (result.error as { error: string }).error
        : null;
    let apiMessage = fromSdk;
    if (apiMessage === null) {
      try {
        apiMessage = await readErrorMessage(response.clone());
      } catch {
        apiMessage = null;
      }
    }
    throw new CliError(describeHttpError(response.status, path, apiMessage));
  }
  if (response.status === 204) {
    return undefined;
  }
  if (result.data !== undefined) {
    return result.data;
  }
  return response.json();
}

/**
 * `auth: false` is for public routes: the token is neither required nor sent,
 * because the API rejects any request carrying an invalid `tahti_` token with
 * 401, even on routes that need no auth.
 */
export async function apiGet(
  path: string,
  config: CliConfig,
  {
    auth = true,
    fetchImpl = fetch,
  }: { auth?: boolean; fetchImpl?: FetchImpl } = {},
) {
  return requestJson('GET', path, config, { auth, fetchImpl });
}

export function requireToken(config: CliConfig) {
  if (!config.token) {
    throw new CliError(`Missing API token. ${TOKEN_HELP}`);
  }
}

/** JSON write request (POST, PATCH, PUT) that answers with a JSON body.
 * Needs a token with the `write` scope. */
export async function apiSendJson(
  method: string,
  path: string,
  body: unknown,
  config: CliConfig,
  { fetchImpl = fetch }: { fetchImpl?: FetchImpl } = {},
) {
  requireToken(config);
  return requestJson(method, path, config, { body, fetchImpl });
}

export function apiPost(
  path: string,
  body: unknown,
  config: CliConfig,
  options?: { fetchImpl?: FetchImpl },
) {
  return apiSendJson('POST', path, body, config, options);
}

/** Write request whose success answer has no body (204), e.g. PATCH or a
 * POST action. Needs a token with the `write` scope. */
export async function apiSendNoContent(
  method: string,
  path: string,
  config: CliConfig,
  body?: unknown,
  { fetchImpl = fetch }: { fetchImpl?: FetchImpl } = {},
) {
  requireToken(config);
  await requestJson(method, path, config, { body, fetchImpl });
}
