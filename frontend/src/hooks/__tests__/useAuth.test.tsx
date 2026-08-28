import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { AuthProvider, useAuth } from '../useAuth';
import { mockUser } from '../../test/mocks';

const BASE_URL = 'http://localhost:8000';

function wrapper({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}

describe('useAuth', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('initial state: token null, user null, loading transitions to false', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    // No token in localStorage => loading should become false
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.token).toBeNull();
    expect(result.current.user).toBeNull();
  });

  it('login: stores token in localStorage and sets user', async () => {
    const user = mockUser();
    const tokenResponse = { access_token: 'tok-login', token_type: 'bearer' };

    (fetch as ReturnType<typeof vi.fn>)
      // First call: login
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(tokenResponse),
      })
      // Second call: getMe
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(user),
      });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.login('alice@example.com', 'password');
    });

    expect(result.current.token).toBe('tok-login');
    expect(result.current.user).toEqual(user);
    expect(localStorage.getItem('calendar_hub_token')).toBe('tok-login');
  });

  it('logout: clears token and user, removes from localStorage', async () => {
    const user = mockUser();
    const tokenResponse = { access_token: 'tok-logout', token_type: 'bearer' };

    (fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(tokenResponse),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(user),
      });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Login first
    await act(async () => {
      await result.current.login('alice@example.com', 'password');
    });

    expect(result.current.token).toBe('tok-logout');

    // Logout
    act(() => {
      result.current.logout();
    });

    expect(result.current.token).toBeNull();
    expect(result.current.user).toBeNull();
    expect(localStorage.getItem('calendar_hub_token')).toBeNull();
  });

  it('register: stores token and sets user', async () => {
    const user = mockUser({ name: 'Bob' });
    const tokenResponse = { access_token: 'tok-register', token_type: 'bearer' };

    (fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(tokenResponse),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(user),
      });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.register('bob@example.com', 'Bob', 'secret');
    });

    expect(result.current.token).toBe('tok-register');
    expect(result.current.user).toEqual(user);
    expect(localStorage.getItem('calendar_hub_token')).toBe('tok-register');
  });

  it('restores session from localStorage on mount', async () => {
    const user = mockUser();
    localStorage.setItem('calendar_hub_token', 'existing-tok');

    // The mount useEffect calls getMe
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve(user),
    });

    const { result } = renderHook(() => useAuth(), { wrapper });

    // Should start loading because there's a token in localStorage
    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.token).toBe('existing-tok');
    expect(result.current.user).toEqual(user);

    // Verify getMe was called with the stored token
    expect(fetch).toHaveBeenCalledWith(`${BASE_URL}/api/auth/me`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer existing-tok',
      },
    });
  });
});
