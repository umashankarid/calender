import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { login, register, getMe } from '../auth';
import { mockUser } from '../../test/mocks';

const BASE_URL = 'http://localhost:8000';

describe('auth API', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('login sends correct payload and returns TokenResponse', async () => {
    const tokenResponse = { access_token: 'tok123', token_type: 'bearer' };
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(tokenResponse),
    });

    const result = await login('alice@example.com', 'password123');

    expect(fetch).toHaveBeenCalledWith(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'alice@example.com', password: 'password123' }),
    });
    expect(result).toEqual(tokenResponse);
  });

  it('register sends correct payload and returns TokenResponse', async () => {
    const tokenResponse = { access_token: 'tok456', token_type: 'bearer' };
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(tokenResponse),
    });

    const result = await register('bob@example.com', 'Bob', 'secret');

    expect(fetch).toHaveBeenCalledWith(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'bob@example.com', name: 'Bob', password: 'secret' }),
    });
    expect(result).toEqual(tokenResponse);
  });

  it('getMe sends GET with auth header', async () => {
    const user = mockUser();
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(user),
    });

    const result = await getMe('my-token');

    expect(fetch).toHaveBeenCalledWith(`${BASE_URL}/api/auth/me`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer my-token',
      },
    });
    expect(result).toEqual(user);
  });
});
