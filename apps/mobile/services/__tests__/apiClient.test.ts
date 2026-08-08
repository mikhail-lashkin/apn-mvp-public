/**
 * @file: apiClient.test.ts
 * @description: FB-8 — авто-refresh access token при 401
 * @dependencies: services/api/client
 * @created: 2026-07-15
 */

import { ApiClient } from '../api/client';

const jsonResponse = (status: number, body: unknown) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});

describe('ApiClient — token refresh (FB-8)', () => {
  let client: ApiClient;
  const fetchMock = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = fetchMock as unknown as typeof fetch;
    client = new ApiClient('http://test.local');
  });

  it('401 → /auth/refresh → повтор запроса с новым токеном', async () => {
    await client.setTokens('expired-access', 'valid-refresh');

    fetchMock
      .mockResolvedValueOnce(jsonResponse(401, { detail: 'Token expired' }))
      .mockResolvedValueOnce(
        jsonResponse(200, {
          access_token: 'fresh-access',
          refresh_token: 'fresh-refresh',
        })
      )
      .mockResolvedValueOnce(jsonResponse(200, { items: [], total: 0 }));

    const result = await client.get<{ items: unknown[]; total: number }>('/notes/');

    expect(result.total).toBe(0);
    expect(fetchMock).toHaveBeenCalledTimes(3);

    expect(fetchMock.mock.calls[0][0]).toBe('http://test.local/notes/');
    expect(fetchMock.mock.calls[1][0]).toBe('http://test.local/auth/refresh');
    expect(fetchMock.mock.calls[2][0]).toBe('http://test.local/notes/');

    const retryHeaders = fetchMock.mock.calls[2][1]?.headers as Record<string, string>;
    expect(retryHeaders.Authorization).toBe('Bearer fresh-access');
  });

  it('401 без refresh token → clearTokens и Authentication failed', async () => {
    await client.setTokens('expired-only', '');

    fetchMock.mockResolvedValueOnce(jsonResponse(401, { detail: 'Unauthorized' }));

    await expect(client.get('/notes/')).rejects.toThrow('Authentication failed');
    expect(client.getAccessToken()).toBeNull();
  });

  it('401 + refresh fail → clearTokens', async () => {
    await client.setTokens('expired-access', 'bad-refresh');

    fetchMock
      .mockResolvedValueOnce(jsonResponse(401, {}))
      .mockResolvedValueOnce(jsonResponse(401, { detail: 'Invalid refresh' }));

    await expect(client.get('/auth/me')).rejects.toThrow('Authentication failed');
    expect(client.getAccessToken()).toBeNull();
  });
});
