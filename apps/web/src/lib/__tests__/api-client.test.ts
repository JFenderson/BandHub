import { ApiClient } from '../api-client';

describe('ApiClient', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch as any;
    jest.clearAllMocks();
  });

  it('formats requests and includes auth header', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: () => Promise.resolve({ ok: true }) });
    const client = new ApiClient('http://localhost:3001');
    client.setAccessToken('abc');

    await client.login({ email: 'test@example.com', password: 'secret' });

    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:3001/api/auth/login',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
      }),
    );
  });

  it('attempts refresh on 401 response', async () => {
    const responses = [
      { ok: false, status: 401, json: async () => ({ message: 'unauthorized' }) },
      { ok: true, status: 200, json: async () => ({ accessToken: 'new', refreshToken: 'r' }) },
      { ok: true, status: 200, json: async () => ({ ok: true }) },
    ];
    (global.fetch as jest.Mock).mockImplementation(() => Promise.resolve(responses.shift()));

    const client = new ApiClient('http://localhost:3001');
    client.setAccessToken('expired');
    client.setRefreshToken('refresh-me');

    await client.getVideos({ page: 1, limit: 10 });

    expect(global.fetch).toHaveBeenCalledTimes(3);
  });
});
