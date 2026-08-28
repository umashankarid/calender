import type { Reminder } from '../types';
import { apiDelete, apiGet, apiPost } from './client';

export interface ListRemindersParams {
  start?: string;
  end?: string;
}

export async function listReminders(
  slug: string,
  params?: ListRemindersParams,
  token?: string,
): Promise<Reminder[]> {
  const query = new URLSearchParams();
  if (params?.start) query.set('start', params.start);
  if (params?.end) query.set('end', params.end);
  const qs = query.toString();
  return apiGet<Reminder[]>(
    `/api/workspaces/${slug}/reminders${qs ? `?${qs}` : ''}`,
    token,
  );
}

export async function createReminder(
  slug: string,
  data: {
    title: string;
    message?: string;
    remind_at: string;
    event_id?: string;
    is_recurring?: boolean;
    recurrence?: string;
  },
  token: string,
): Promise<Reminder> {
  return apiPost<Reminder>(
    `/api/workspaces/${slug}/reminders`,
    data,
    token,
  );
}

export async function deleteReminder(
  slug: string,
  id: string,
  token: string,
): Promise<void> {
  return apiDelete(`/api/workspaces/${slug}/reminders/${id}`, token);
}
