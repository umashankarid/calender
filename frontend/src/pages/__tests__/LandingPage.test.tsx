import { vi, describe, it, expect, beforeEach } from 'vitest';
import { mockUser } from '../../test/mocks';

// ── Mocks (BEFORE component imports) ─────────────────────────────────────────

const mockUseAuth = vi.fn();

vi.mock('../../hooks/useAuth', () => ({
  useAuth: (...args: unknown[]) => mockUseAuth(...args),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('../../api/workspaces', () => ({
  listWorkspaces: vi.fn().mockResolvedValue([]),
  createWorkspace: vi.fn(),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  };
});

// ── Imports ──────────────────────────────────────────────────────────────────

import React from 'react';
import { render, screen } from '../../test/test-utils';
import userEvent from '@testing-library/user-event';
import LandingPage from '../LandingPage';

// ── Tests ────────────────────────────────────────────────────────────────────

describe('LandingPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders login form when not authenticated', () => {
    mockUseAuth.mockReturnValue({
      token: null,
      user: null,
      loading: false,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
    });

    render(<LandingPage />);
    expect(screen.getByText('Welcome back')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByText('Sign in')).toBeInTheDocument();
  });

  it('renders workspace picker when authenticated', () => {
    mockUseAuth.mockReturnValue({
      token: 'test-token',
      user: mockUser(),
      loading: false,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
    });

    render(<LandingPage />);
    expect(screen.getByText('Your workspaces')).toBeInTheDocument();
  });

  it('toggle between login and register', async () => {
    mockUseAuth.mockReturnValue({
      token: null,
      user: null,
      loading: false,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
    });

    const user = userEvent.setup();
    render(<LandingPage />);

    // Initially shows login
    expect(screen.getByText('Welcome back')).toBeInTheDocument();

    // Click "Sign up" link to toggle to register
    await user.click(screen.getByText('Sign up'));

    expect(screen.getByText('Create an account')).toBeInTheDocument();
    expect(screen.getByLabelText('Full name')).toBeInTheDocument();

    // Toggle back to login
    await user.click(screen.getByText('Sign in'));
    expect(screen.getByText('Welcome back')).toBeInTheDocument();
  });

  it('shows Calendar Hub heading', () => {
    mockUseAuth.mockReturnValue({
      token: null,
      user: null,
      loading: false,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
    });

    render(<LandingPage />);
    expect(screen.getByRole('heading', { name: /Calendar Hub/ })).toBeInTheDocument();
  });
});
