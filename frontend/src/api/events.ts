import type { CalendarEvent, EventWithMembers } from '../types';
import { apiDelete, apiGet, apiPost, apiPut } from './client';

export interface ListEventsParams {
  start?: string;
  end?: string;
  calendar_id?: string;
}

export async function listEvents(
  slug: string,
  params?: ListEventsParams,
  token?: string,
): Promise<EventWithMembers[]> {
  const query = new URLSearchParams();
  if (params?.start) query.set('start', params.start);
  if (params?.end) query.set('end', params.end);
  if (params?.calendar_id) query.set('calendar_id', params.calendar_id);
  const qs = query.toString();
  return apiGet<EventWithMembers[]>(
    `/api/workspaces/${slug}/events${qs ? `?${qs}` : ''}`,
    token,
  );
}

export async function getEvent(
  slug: string,
  eventId: string,
  token: string,
): Promise<EventWithMembers> {
  return apiGet<EventWithMembers>(
    `/api/workspaces/${slug}/events/${eventId}`,
    token,
  );
}

export async function createEvent(
  slug: string,
  data: Partial<CalendarEvent>,
  token: string,
): Promise<CalendarEvent> {
  return apiPost<CalendarEvent>(
    `/api/workspaces/${slug}/events`,
    data,
    token,
  );
}

export async function updateEvent(
  slug: string,
  eventId: string,
  data: Partial<CalendarEvent>,
  token: string,
): Promise<CalendarEvent> {
  return apiPut<CalendarEvent>(
    `/api/workspaces/${slug}/events/${eventId}`,
    data,
    token,
  );
}

export async function deleteEvent(
  slug: string,
  eventId: string,
  token: string,
): Promise<void> {
  return apiDelete(`/api/workspaces/${slug}/events/${eventId}`, token);
}
