import { vi, describe, it, expect, beforeEach } from 'vitest';
import { mockUser, mockWorkspaceUser, mockEvent } from '../../../test/mocks';

// ── Mocks (BEFORE component imports) ─────────────────────────────────────────

vi.mock('../../../hooks/useAuth', () => ({
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

vi.mock('../../../api/events', () => ({
  createEvent: vi.fn(),
  updateEvent: vi.fn(),
  deleteEvent: vi.fn(),
}));

vi.mock('../../../api/client', () => ({
  apiPost: vi.fn(),
  apiGet: vi.fn(),
}));

// ── Imports ──────────────────────────────────────────────────────────────────

import React from 'react';
import { render, screen } from '../../../test/test-utils';
import userEvent from '@testing-library/user-event';
import TodayView from '../TodayView';
import type { EventWithMembers, WorkspaceUser } from '../../../types';

// ── Helpers ──────────────────────────────────────────────────────────────────

const today = new Date();

function todayISO(hours: number, minutes: number): string {
  const d = new Date(today.getFullYear(), today.getMonth(), today.getDate(), hours, minutes, 0);
  return d.toISOString();
}

const alice = mockWorkspaceUser({
  id: 'wu-1',
  user_id: 'user-1',
  display_name: 'Alice',
  display_color: '#3b82f6',
});

const bob = mockWorkspaceUser({
  id: 'wu-2',
  user_id: 'user-2',
  display_name: 'Bob',
  display_color: '#ef4444',
});

const members: WorkspaceUser[] = [alice, bob];

function makeTodayEvents(): EventWithMembers[] {
  return [
    mockEvent({
      id: 'evt-1',
      title: 'Team Standup',
      start: todayISO(10, 0),
      end: todayISO(10, 30),
      members: [alice],
    }),
    mockEvent({
      id: 'evt-2',
      title: 'Design Review',
      start: todayISO(14, 0),
      end: todayISO(15, 0),
      members: [bob],
    }),
  ];
}

const defaultProps = {
  slug: 'acme-corp',
  events: makeTodayEvents(),
  members,
  onRefresh: vi.fn(),
};

// ── Tests ────────────────────────────────────────────────────────────────────

describe('TodayView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders date heading', () => {
    render(<TodayView {...defaultProps} />);
    const dateStr = today.toLocaleDateString([], {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });
    expect(screen.getByText(dateStr)).toBeInTheDocument();
  });

  it('renders events grouped by member with correct colors', () => {
    render(<TodayView {...defaultProps} />);

    // Member names appear in both filter chips and group headings
    expect(screen.getAllByText('Alice').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Bob').length).toBeGreaterThanOrEqual(1);

    // Event titles
    expect(screen.getByText('Team Standup')).toBeInTheDocument();
    expect(screen.getByText('Design Review')).toBeInTheDocument();
  });

  it('shows "No events today" when events array is empty', () => {
    render(<TodayView {...defaultProps} events={[]} />);
    expect(screen.getByText('No events today')).toBeInTheDocument();
  });

  it('member filter chips are rendered', () => {
    render(<TodayView {...defaultProps} />);
    // "Everyone" chip plus each member
    expect(screen.getByText('Everyone')).toBeInTheDocument();
    // Alice and Bob appear as filter chips (they also appear in group headings, but the chips are buttons)
    const aliceButtons = screen.getAllByText('Alice');
    expect(aliceButtons.length).toBeGreaterThanOrEqual(1);
    const bobButtons = screen.getAllByText('Bob');
    expect(bobButtons.length).toBeGreaterThanOrEqual(1);
  });

  it('clicking filter chip filters events', async () => {
    const user = userEvent.setup();
    render(<TodayView {...defaultProps} />);

    // Both events visible initially
    expect(screen.getByText('Team Standup')).toBeInTheDocument();
    expect(screen.getByText('Design Review')).toBeInTheDocument();

    // Click Alice filter chip (the one in the filter bar, which is a button)
    const aliceButtons = screen.getAllByRole('button', { name: /Alice/i });
    // The filter chip is the first button with Alice text in the chip bar
    await user.click(aliceButtons[0]);

    // Only Alice's event should remain
    expect(screen.getByText('Team Standup')).toBeInTheDocument();
    expect(screen.queryByText('Design Review')).not.toBeInTheDocument();
  });
});
