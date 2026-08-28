import type { Calendar } from '../types';
import { apiGet, apiPost } from './client';

export async function listCalendars(
  slug: string,
  token: string,
): Promise<Calendar[]> {
  return apiGet<Calendar[]>(`/api/workspaces/${slug}/calendars`, token);
}

export async function createCalendar(
  slug: string,
  data: { name: string; color?: string },
  token: string,
): Promise<Calendar> {
  return apiPost<Calendar>(
    `/api/workspaces/${slug}/calendars`,
    data,
    token,
  );
}
