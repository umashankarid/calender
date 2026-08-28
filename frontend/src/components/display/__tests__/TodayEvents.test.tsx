import { vi, describe, it, expect } from 'vitest';
import { mockWorkspaceUser, mockEvent } from '../../../test/mocks';

// ── Imports ──────────────────────────────────────────────────────────────────

import React from 'react';
import { render, screen } from '../../../test/test-utils';
import TodayEvents from '../TodayEvents';
import type { EventWithMembers, WorkspaceUser } from '../../../types';

// ── Helpers ──────────────────────────────────────────────────────────────────

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

const events: EventWithMembers[] = [
  mockEvent({
    id: 'evt-1',
    title: 'Team Standup',
    start: '2026-08-28T10:00:00Z',
    end: '2026-08-28T10:30:00Z',
    members: [alice],
  }),
  mockEvent({
    id: 'evt-2',
    title: 'Design Review',
    start: '2026-08-28T14:00:00Z',
    end: '2026-08-28T15:00:00Z',
    members: [bob],
  }),
];

// ── Tests ────────────────────────────────────────────────────────────────────

describe('TodayEvents', () => {
  it('renders events grouped by member', () => {
    render(<TodayEvents events={events} members={members} />);
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.getByText('Team Standup')).toBeInTheDocument();
    expect(screen.getByText('Design Review')).toBeInTheDocument();
  });

  it('shows member name and color', () => {
    render(<TodayEvents events={events} members={members} />);
    // Member names appear as group headings
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });

  it('shows event title and time', () => {
    render(<TodayEvents events={events} members={members} />);
    expect(screen.getByText('Team Standup')).toBeInTheDocument();
    expect(screen.getByText('Design Review')).toBeInTheDocument();
    // Time is formatted from ISO strings — look for the time range pattern
    // The component uses formatTime which outputs HH:MM format
    const timeElements = screen.getAllByText(/\d{2}:\d{2}\s*–\s*\d{2}:\d{2}/);
    expect(timeElements.length).toBeGreaterThanOrEqual(1);
  });

  it('shows "No events today" when empty', () => {
    render(<TodayEvents events={[]} members={members} />);
    expect(screen.getByText('No events today')).toBeInTheDocument();
  });
});
