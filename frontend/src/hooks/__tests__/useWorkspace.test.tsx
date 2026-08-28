import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { useWorkspace } from '../useWorkspace';
import { AuthProvider } from '../useAuth';
import {
  mockWorkspace,
  mockWorkspaceUser,
} from '../../test/mocks';

// Mock the API modules
vi.mock('../../api/workspaces', () => ({
  getWorkspace: vi.fn(),
}));

vi.mock('../../api/members', () => ({
  listMembers: vi.fn(),
}));

vi.mock('../../api/calendars', () => ({
  listCalendars: vi.fn(),
}));

import { getWorkspace } from '../../api/workspaces';
import { listMembers } from '../../api/members';
import { listCalendars } from '../../api/calendars';

const mockedGetWorkspace = getWorkspace as ReturnType<typeof vi.fn>;
const mockedListMembers = listMembers as ReturnType<typeof vi.fn>;
const mockedListCalendars = listCalendars as ReturnType<typeof vi.fn>;

// We need to provide a token via the AuthProvider. Set one in localStorage
// and mock the getMe fetch call so the provider loads successfully.
function wrapper({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}

describe('useWorkspace', () => {
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

    // Default mock returns
    mockedGetWorkspace.mockResolvedValue(mockWorkspace());
    mockedListMembers.mockResolvedValue([mockWorkspaceUser()]);
    mockedListCalendars.mockResolvedValue([
      {
        id: 'cal-1',
        workspace_id: 'ws-1',
        name: 'Default',
        color: '#3b82f6',
        is_default: true,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
    ]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it('loads workspace, members, calendars on mount', async () => {
    const { result } = renderHook(() => useWorkspace('acme-corp'), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.workspace).toEqual(mockWorkspace());
    expect(result.current.members).toEqual([mockWorkspaceUser()]);
    expect(result.current.calendars).toHaveLength(1);
    expect(mockedGetWorkspace).toHaveBeenCalledWith('acme-corp', 'test-tok');
    expect(mockedListMembers).toHaveBeenCalledWith('acme-corp', 'test-tok');
    expect(mockedListCalendars).toHaveBeenCalledWith('acme-corp', 'test-tok');
  });

  it('returns loading=true then loading=false', async () => {
    const { result } = renderHook(() => useWorkspace('acme-corp'), { wrapper });

    // Initially loading (either from auth or workspace)
    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
  });

  it('refetch reloads data', async () => {
    const { result } = renderHook(() => useWorkspace('acme-corp'), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Clear call counts
    mockedGetWorkspace.mockClear();
    mockedListMembers.mockClear();
    mockedListCalendars.mockClear();

    // Update mock to return new data
    const updatedWs = mockWorkspace({ name: 'Updated Corp' });
    mockedGetWorkspace.mockResolvedValue(updatedWs);

    // Call refetch
    await waitFor(async () => {
      result.current.refetch();
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockedGetWorkspace).toHaveBeenCalled();
    expect(mockedListMembers).toHaveBeenCalled();
    expect(mockedListCalendars).toHaveBeenCalled();
  });
});
