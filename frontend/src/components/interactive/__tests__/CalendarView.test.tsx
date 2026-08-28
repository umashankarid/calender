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
import CalendarView from '../CalendarView';
import type { WorkspaceUser, EventWithMembers } from '../../../types';

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

const members: WorkspaceUser[] = [alice];

const events: EventWithMembers[] = [
  mockEvent({
    id: 'evt-1',
    title: 'Team Standup',
    start: todayISO(10, 0),
    end: todayISO(10, 30),
    members: [alice],
  }),
];

const defaultProps = {
  slug: 'acme-corp',
  events,
  members,
  onRefresh: vi.fn(),
};

// ── Tests ────────────────────────────────────────────────────────────────────

describe('CalendarView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders Schedule/Week/Month toggle', () => {
    render(<CalendarView {...defaultProps} />);
    expect(screen.getByText('Schedule')).toBeInTheDocument();
    expect(screen.getByText('Week')).toBeInTheDocument();
    expect(screen.getByText('Month')).toBeInTheDocument();
  });

  it('defaults to Schedule view', () => {
    render(<CalendarView {...defaultProps} />);
    // Schedule view shows "TODAY" badge for current day
    const scheduleButton = screen.getByText('Schedule');
    // The schedule button should have the active styling (bg-white)
    expect(scheduleButton.className).toContain('bg-white');
  });

  it('switching to Week view renders 7-column grid headers', async () => {
    const user = userEvent.setup();
    render(<CalendarView {...defaultProps} />);

    await user.click(screen.getByText('Week'));

    // Week view renders day name headers: SUN, MON, TUE, WED, THU, FRI, SAT
    expect(screen.getByText('SUN')).toBeInTheDocument();
    expect(screen.getByText('MON')).toBeInTheDocument();
    expect(screen.getByText('TUE')).toBeInTheDocument();
    expect(screen.getByText('WED')).toBeInTheDocument();
    expect(screen.getByText('THU')).toBeInTheDocument();
    expect(screen.getByText('FRI')).toBeInTheDocument();
    expect(screen.getByText('SAT')).toBeInTheDocument();
  });

  it('events appear in schedule view', () => {
    render(<CalendarView {...defaultProps} />);
    expect(screen.getByText('Team Standup')).toBeInTheDocument();
  });
});
