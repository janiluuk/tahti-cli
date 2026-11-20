import { vi } from 'vitest';

export const TEST_CONFIG = {
  apiUrl: 'https://api.example.test',
  token: 'tahti_test',
  refreshToken: null as string | null,
  expiresAt: null as number | null,
};

export function mockFetchJson(body: unknown, status = 200) {
  const fetchMock = vi
    .fn()
    .mockImplementation(async (input: RequestInfo | URL) => {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;
      return {
        ok: status >= 200 && status < 300,
        status,
        url,
        headers: new Headers(
          status === 204 ? { 'Content-Length': '0' } : undefined,
        ),
        json: async () => body,
        text: async () =>
          body === undefined || body === null ? '' : JSON.stringify(body),
      };
    });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

/** openapi-fetch calls `fetch(Request)`; older helpers used `fetch(url, init)`. */
export function fetchCallUrl(call: unknown[]): string {
  const [input] = call;
  if (typeof input === 'string') {
    return input;
  }
  if (input instanceof URL) {
    return input.toString();
  }
  if (input && typeof input === 'object' && 'url' in input) {
    return String((input as Request).url);
  }
  return String(input);
}

export function fetchCallAuth(call: unknown[]): string | null {
  const [input, init] = call;
  if (input && typeof input === 'object' && 'headers' in input) {
    const value = (input as Request).headers.get('Authorization');
    if (value) {
      return value;
    }
  }
  const headers =
    init && typeof init === 'object' && 'headers' in init
      ? (init as { headers?: Headers | Record<string, string> }).headers
      : undefined;
  if (!headers) {
    return null;
  }
  if (headers instanceof Headers) {
    return headers.get('Authorization');
  }
  return headers.Authorization ?? headers.authorization ?? null;
}
