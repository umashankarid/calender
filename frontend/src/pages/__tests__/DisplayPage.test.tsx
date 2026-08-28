import { vi, describe, it, expect, beforeEach } from 'vitest';
import { mockUser, mockDisplayFeed } from '../../test/mocks';

// ── Mocks (BEFORE component imports) ─────────────────────────────────────────

vi.mock('../../hooks/useAuth', () => ({
  useAuth: vi.fn(() => ({
    token: 'test-token',
    user: mockUser(),
    loading: false,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
  })),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const mockGetDisplayFeed = vi.fn();

vi.mock('../../api/display', () => ({
  getDisplayFeed: (...args: unknown[]) => mockGetDisplayFeed(...args),
  pairDisplay: vi.fn(),
}));

let mockToken: string | null = 'display-tok-123';

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useParams: () => ({ slug: 'acme-corp' }),
    useSearchParams: () => [
      {
        get: (key: string) => (key === 'token' ? mockToken : null),
      },
    ],
    useNavigate: () => vi.fn(),
  };
});

// ── Imports ──────────────────────────────────────────────────────────────────

import React from 'react';
import { render, screen, waitFor } from '../../test/test-utils';
import DisplayPage from '../DisplayPage';

// ── Tests ────────────────────────────────────────────────────────────────────

describe('DisplayPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockToken = 'display-tok-123';
  });

  it('renders loading state', () => {
    // getDisplayFeed never resolves => stays in loading
    mockGetDisplayFeed.mockReturnValue(new Promise(() => {}));

    render(<DisplayPage />);
    expect(screen.getByText('Loading display…')).toBeInTheDocument();
  });

  it('renders display header and events when data loaded', async () => {
    const feed = mockDisplayFeed();
    mockGetDisplayFeed.mockResolvedValue({ ...feed, workspace_name: feed.workspace.name });

    render(<DisplayPage />);

    await waitFor(() => {
      // DisplayHeader renders workspace name
      expect(screen.getByText(/Acme Corp/)).toBeInTheDocument();
    });

    // TodayEvents renders event titles from the feed
    expect(screen.getByText('Team Standup')).toBeInTheDocument();
    expect(screen.getByText('Design Review')).toBeInTheDocument();
  });

  it('renders pairing screen when no token', () => {
    mockToken = null;

    render(<DisplayPage />);

    expect(screen.getByText(/Calendar Hub Display/)).toBeInTheDocument();
    expect(screen.getByText(/Enter a pairing code/)).toBeInTheDocument();
    expect(screen.getByLabelText('Pairing code')).toBeInTheDocument();
  });
});
