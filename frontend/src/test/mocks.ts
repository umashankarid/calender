import type {
  Announcement,
  Display,
  DisplayFeed,
  EventWithMembers,
  Reminder,
  User,
  Workspace,
  WorkspaceUser,
} from '../types';

export function mockUser(overrides?: Partial<User>): User {
  return {
    id: 'user-1',
    email: 'alice@example.com',
    name: 'Alice Johnson',
    avatar: null,
    is_active: true,
    created_at: '2026-01-15T09:00:00Z',
    ...overrides,
  };
}

export function mockWorkspace(overrides?: Partial<Workspace>): Workspace {
  return {
    id: 'ws-1',
    name: 'Acme Corp',
    slug: 'acme-corp',
    workspace_type: 'team',
    logo: null,
    primary_color: '#3b82f6',
    timezone: 'America/New_York',
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

export function mockWorkspaceUser(overrides?: Partial<WorkspaceUser>): WorkspaceUser {
  return {
    id: 'wu-1',
    workspace_id: 'ws-1',
    user_id: 'user-1',
    role: 'editor',
    display_name: 'Alice',
    display_color: '#3b82f6',
    created_at: '2026-01-15T09:00:00Z',
    ...overrides,
  };
}

export function mockEvent(overrides?: Partial<EventWithMembers>): EventWithMembers {
  return {
    id: 'evt-1',
    workspace_id: 'ws-1',
    calendar_id: 'cal-1',
    title: 'Team Standup',
    start: '2026-08-28T10:00:00Z',
    end: '2026-08-28T10:30:00Z',
    all_day: false,
    location: 'Room 42',
    notes: null,
    recurrence: null,
    source: 'manual',
    created_at: '2026-08-01T00:00:00Z',
    updated_at: '2026-08-01T00:00:00Z',
    members: [mockWorkspaceUser()],
    ...overrides,
  };
}

export function mockReminder(overrides?: Partial<Reminder>): Reminder {
  return {
    id: 'rem-1',
    event_id: 'evt-1',
    workspace_user_id: 'wu-1',
    remind_at: '2026-08-28T09:45:00Z',
    message: 'Team Standup in 15 minutes',
    status: 'pending',
    created_at: '2026-08-01T00:00:00Z',
    ...overrides,
  };
}

export function mockAnnouncement(overrides?: Partial<Announcement>): Announcement {
  return {
    id: 'ann-1',
    workspace_id: 'ws-1',
    title: 'Office Closed Friday',
    body: 'The office will be closed this Friday for maintenance.',
    priority: 'normal',
    is_active: true,
    starts_at: '2026-08-25T00:00:00Z',
    expires_at: '2026-08-29T23:59:59Z',
    created_by_id: 'user-1',
    created_at: '2026-08-20T00:00:00Z',
    updated_at: '2026-08-20T00:00:00Z',
    ...overrides,
  };
}

export function mockDisplay(overrides?: Partial<Display>): Display {
  return {
    id: 'disp-1',
    workspace_id: 'ws-1',
    name: 'Lobby Screen',
    token: 'tok_abc123',
    pairing_code: 'ABCD-1234',
    is_paired: true,
    layout: null,
    created_at: '2026-02-01T00:00:00Z',
    updated_at: '2026-02-01T00:00:00Z',
    ...overrides,
  };
}

export function mockDisplayFeed(overrides?: Partial<DisplayFeed>): DisplayFeed {
  return {
    date: '2026-08-28',
    workspace: mockWorkspace(),
    today: [
      mockEvent({ id: 'evt-1', title: 'Team Standup', start: '2026-08-28T10:00:00Z', end: '2026-08-28T10:30:00Z' }),
      mockEvent({ id: 'evt-2', title: 'Design Review', start: '2026-08-28T14:00:00Z', end: '2026-08-28T15:00:00Z' }),
    ],
    upcoming: [
      mockEvent({ id: 'evt-3', title: 'Sprint Planning', start: '2026-08-29T09:00:00Z', end: '2026-08-29T10:00:00Z' }),
    ],
    announcements: [mockAnnouncement()],
    reminders: [mockReminder()],
    ...overrides,
  };
}
