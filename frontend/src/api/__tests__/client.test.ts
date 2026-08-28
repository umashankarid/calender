import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { apiGet, apiPost, apiPut, apiDelete } from '../client';

const BASE_URL = 'http://localhost:8000';

describe('apiGet', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('makes GET request with correct URL and headers', async () => {
    const payload = { id: 1 };
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(payload),
    });

    const result = await apiGet('/api/test');

    expect(fetch).toHaveBeenCalledWith(`${BASE_URL}/api/test`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    expect(result).toEqual(payload);
  });

  it('includes Authorization header when token provided', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({}),
    });

    await apiGet('/api/test', 'my-token');

    expect(fetch).toHaveBeenCalledWith(`${BASE_URL}/api/test`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer my-token',
      },
    });
  });

  it('throws on non-OK response with error message', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 400,
      json: () => Promise.resolve({ message: 'Bad request' }),
    });

    await expect(apiGet('/api/fail')).rejects.toThrow('Bad request');
  });

  it('handles error response with detail field', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 422,
      json: () => Promise.resolve({ detail: 'Validation error' }),
    });

    await expect(apiGet('/api/fail')).rejects.toThrow('Validation error');
  });

  it('handles 204 No Content', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 204,
      json: () => Promise.reject(new Error('No body')),
    });

    const result = await apiGet('/api/no-content');
    expect(result).toBeUndefined();
  });
});

describe('apiPost', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('makes POST request with JSON body', async () => {
    const body = { name: 'test' };
    const response = { id: '1', name: 'test' };
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 201,
      json: () => Promise.resolve(response),
    });

    const result = await apiPost('/api/items', body, 'tok');

    expect(fetch).toHaveBeenCalledWith(`${BASE_URL}/api/items`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer tok',
      },
      body: JSON.stringify(body),
    });
    expect(result).toEqual(response);
  });
});

describe('apiPut', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('makes PUT request', async () => {
    const body = { name: 'updated' };
    const response = { id: '1', name: 'updated' };
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(response),
    });

    const result = await apiPut('/api/items/1', body, 'tok');

    expect(fetch).toHaveBeenCalledWith(`${BASE_URL}/api/items/1`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer tok',
      },
      body: JSON.stringify(body),
    });
    expect(result).toEqual(response);
  });
});

describe('apiDelete', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('makes DELETE request', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 204,
      json: () => Promise.reject(new Error('No body')),
    });

    await apiDelete('/api/items/1', 'tok');

    expect(fetch).toHaveBeenCalledWith(`${BASE_URL}/api/items/1`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer tok',
      },
    });
  });
});
