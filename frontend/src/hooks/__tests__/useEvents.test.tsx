import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { useEvents } from '../useEvents';
import { AuthProvider } from '../useAuth';
import { mockEvent } from '../../test/mocks';

// Mock the events API
vi.mock('../../api/events', () => ({
  listEvents: vi.fn(),
}));

import { listEvents } from '../../api/events';

const mockedListEvents = listEvents as ReturnType<typeof vi.fn>;

function wrapper({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}

describe('useEvents', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('calendar_hub_token', 'test-tok');

    // Mock fetch for AuthProvider's getMe call
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({
        id: 'user-1',
        email: 'alice@example.com',
        name: 'Alice',
        avatar: null,
        is_active: true,
        created_at: '2026-01-01T00:00:00Z',
      }),
    }));

    mockedListEvents.mockResolvedValue([mockEvent()]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it('loads events on mount', async () => {
    const events = [mockEvent(), mockEvent({ id: 'evt-2', title: 'Design Review' })];
    mockedListEvents.mockResolvedValue(events);

    const { result } = renderHook(() => useEvents('acme-corp'), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.events).toEqual(events);
    expect(mockedListEvents).toHaveBeenCalledWith('acme-corp', undefined, 'test-tok');
  });

  it('refetch reloads events', async () => {
    const { result } = renderHook(() => useEvents('acme-corp'), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    mockedListEvents.mockClear();

    const newEvents = [mockEvent({ id: 'evt-3', title: 'New Event' })];
    mockedListEvents.mockResolvedValue(newEvents);

    await waitFor(async () => {
      result.current.refetch();
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockedListEvents).toHaveBeenCalled();
  });

  it('passes params to listEvents', async () => {
    const params = { start: '2026-08-01', end: '2026-08-31', calendar_id: 'cal-1' };
    mockedListEvents.mockResolvedValue([]);

    const { result } = renderHook(
      () => useEvents('acme-corp', params),
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockedListEvents).toHaveBeenCalledWith('acme-corp', params, 'test-tok');
  });
});
