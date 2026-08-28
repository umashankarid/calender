import { vi, describe, it, expect, beforeEach } from 'vitest';
import { mockUser, mockWorkspaceUser } from '../../../test/mocks';

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

const mockCreateEvent = vi.fn().mockResolvedValue({ id: 'new-evt' });
const mockUpdateEvent = vi.fn().mockResolvedValue({ id: 'evt-1' });

vi.mock('../../../api/events', () => ({
  createEvent: (...args: unknown[]) => mockCreateEvent(...args),
  updateEvent: (...args: unknown[]) => mockUpdateEvent(...args),
}));

// ── Imports ──────────────────────────────────────────────────────────────────

import React from 'react';
import { render, screen, waitFor } from '../../../test/test-utils';
import userEvent from '@testing-library/user-event';
import AddEventModal from '../AddEventModal';
import type { WorkspaceUser, CalendarEvent } from '../../../types';

// ── Helpers ──────────────────────────────────────────────────────────────────

const members: WorkspaceUser[] = [
  mockWorkspaceUser({ id: 'wu-1', user_id: 'user-1', display_name: 'Alice', display_color: '#3b82f6' }),
  mockWorkspaceUser({ id: 'wu-2', user_id: 'user-2', display_name: 'Bob', display_color: '#ef4444' }),
];

const defaultProps = {
  slug: 'acme-corp',
  members,
  onClose: vi.fn(),
  onSaved: vi.fn(),
};

// ── Tests ────────────────────────────────────────────────────────────────────

describe('AddEventModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders "New Event" title', () => {
    render(<AddEventModal {...defaultProps} />);
    expect(screen.getByText('New Event')).toBeInTheDocument();
  });

  it('renders all form fields (title, date, time from, time to, location, repeat, reminder)', () => {
    render(<AddEventModal {...defaultProps} />);

    // Title (What?)
    expect(screen.getByPlaceholderText('Event title')).toBeInTheDocument();
    // Date
    expect(screen.getByText('Date')).toBeInTheDocument();
    // From / To
    expect(screen.getByText('From')).toBeInTheDocument();
    expect(screen.getByText('To')).toBeInTheDocument();
    // Location
    expect(screen.getByPlaceholderText('Location (optional)')).toBeInTheDocument();
    // Repeat
    expect(screen.getByText('Repeat')).toBeInTheDocument();
    expect(screen.getByText('Does not repeat')).toBeInTheDocument();
    // Reminder
    expect(screen.getByText('Reminder')).toBeInTheDocument();
    expect(screen.getByText('No reminder')).toBeInTheDocument();
  });

  it('shows member checkboxes', () => {
    render(<AddEventModal {...defaultProps} />);
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });

  it('Save button calls createEvent with correct payload', async () => {
    const user = userEvent.setup();
    render(<AddEventModal {...defaultProps} />);

    const titleInput = screen.getByPlaceholderText('Event title');
    await user.clear(titleInput);
    await user.type(titleInput, 'Team Lunch');

    const saveBtn = screen.getByText('Save');
    await user.click(saveBtn);

    await waitFor(() => {
      expect(mockCreateEvent).toHaveBeenCalledTimes(1);
    });

    const [slug, payload, token] = mockCreateEvent.mock.calls[0];
    expect(slug).toBe('acme-corp');
    expect(payload.title).toBe('Team Lunch');
    expect(token).toBe('test-token');
  });

  it('Cancel button calls onClose', async () => {
    const user = userEvent.setup();
    render(<AddEventModal {...defaultProps} />);

    await user.click(screen.getByText('Cancel'));
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  it('edit mode populates fields from editEvent', () => {
    const editEvent: CalendarEvent = {
      id: 'evt-1',
      workspace_id: 'ws-1',
      calendar_id: 'cal-1',
      title: 'Existing Meeting',
      start: '2026-08-28T14:00:00Z',
      end: '2026-08-28T15:00:00Z',
      all_day: false,
      location: 'Conference Room A',
      notes: null,
      recurrence: 'weekly',
      source: 'manual',
      created_at: '2026-08-01T00:00:00Z',
      updated_at: '2026-08-01T00:00:00Z',
    };

    render(<AddEventModal {...defaultProps} editEvent={editEvent} />);

    expect(screen.getByText('Edit Event')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Existing Meeting')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Conference Room A')).toBeInTheDocument();
  });

  it('shows validation error when title is empty', async () => {
    const user = userEvent.setup();
    render(<AddEventModal {...defaultProps} />);

    // Title input is empty by default — click save directly
    await user.click(screen.getByText('Save'));

    expect(screen.getByText('Please enter an event title')).toBeInTheDocument();
    expect(mockCreateEvent).not.toHaveBeenCalled();
  });
});
