import type { GoogleCalendar } from '../types';
import { apiDelete, apiGet, apiPost } from './client';

export async function getConnectUrl(
  slug: string,
  token: string,
): Promise<{ auth_url: string }> {
  return apiGet<{ auth_url: string }>(
    `/api/workspaces/${slug}/google/connect`,
    token,
  );
}

export async function listGoogleCalendars(
  slug: string,
  token: string,
): Promise<GoogleCalendar[]> {
  return apiGet<GoogleCalendar[]>(
    `/api/workspaces/${slug}/google/calendars`,
    token,
  );
}

export async function triggerSync(
  slug: string,
  token: string,
): Promise<{ synced_count: number }> {
  return apiPost<{ synced_count: number }>(
    `/api/workspaces/${slug}/google/sync`,
    {},
    token,
  );
}

export async function disconnectGoogle(
  slug: string,
  token: string,
): Promise<void> {
  return apiDelete(
    `/api/workspaces/${slug}/google/disconnect`,
    token,
  );
}
