// ── Workspace ────────────────────────────────────────────────────────────────

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  workspace_type: string;
  logo: string | null;
  primary_color: string;
  timezone: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ── User ─────────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  name: string;
  avatar: string | null;
  is_active: boolean;
  created_at: string;
}

// ── Workspace membership ─────────────────────────────────────────────────────

export type WorkspaceRole = 'owner' | 'admin' | 'editor' | 'viewer';

export interface WorkspaceUser {
  id: string;
  workspace_id: string;
  user_id: string;
  role: WorkspaceRole;
  display_name: string | null;
  display_color: string;
  created_at: string;
  user?: User;
}

// ── Calendar ─────────────────────────────────────────────────────────────────

export interface Calendar {
  id: string;
  workspace_id: string;
  name: string;
  color: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

// ── CalendarEvent (avoids DOM Event conflict) ────────────────────────────────

export interface CalendarEvent {
  id: string;
  workspace_id: string;
  calendar_id: string | null;
  title: string;
  start: string;
  end: string | null;
  all_day: boolean;
  location: string | null;
  notes: string | null;
  recurrence: string | null;
  source: string;
  created_at: string;
  updated_at: string;
}

export interface EventWithMembers extends CalendarEvent {
  members: WorkspaceUser[];
}

// ── Reminder ─────────────────────────────────────────────────────────────────

export interface Reminder {
  id: string;
  event_id: string;
  workspace_user_id: string | null;
  remind_at: string;
  message: string | null;
  status: 'pending' | 'sent' | 'dismissed';
  created_at: string;
}

// ── Announcement ─────────────────────────────────────────────────────────────

export interface Announcement {
  id: string;
  workspace_id: string;
  title: string;
  body: string | null;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  is_active: boolean;
  starts_at: string | null;
  expires_at: string | null;
  created_by_id: string | null;
  created_at: string;
  updated_at: string;
}

// ── Display / Wall ───────────────────────────────────────────────────────────

export interface Display {
  id: string;
  workspace_id: string;
  name: string;
  token: string;
  pairing_code: string | null;
  is_paired: boolean;
  layout: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface DisplayWidget {
  id: string;
  display_id: string;
  widget_type: string;
  position: number;
  config: Record<string, unknown> | null;
  is_visible: boolean;
  created_at: string;
}

export interface DisplayFeed {
  date: string;
  workspace: Workspace;
  today: EventWithMembers[];
  upcoming: EventWithMembers[];
  announcements: Announcement[];
  reminders: Reminder[];
}

// ── Auth ─────────────────────────────────────────────────────────────────────

export interface TokenResponse {
  access_token: string;
  token_type: string;
}

// ── Voice ────────────────────────────────────────────────────────────────────

export interface VoiceIntent {
  intent: string;
  data: Record<string, unknown>;
  confirmation_text: string;
}
