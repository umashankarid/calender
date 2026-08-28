import type { Announcement } from '../types';
import { apiDelete, apiGet, apiPost, apiPut } from './client';

export async function listAnnouncements(
  slug: string,
  token: string,
): Promise<Announcement[]> {
  return apiGet<Announcement[]>(
    `/api/workspaces/${slug}/announcements`,
    token,
  );
}

export async function createAnnouncement(
  slug: string,
  data: {
    title: string;
    body: string;
    priority?: 'low' | 'normal' | 'high' | 'urgent';
    starts_at?: string;
    expires_at?: string;
  },
  token: string,
): Promise<Announcement> {
  return apiPost<Announcement>(
    `/api/workspaces/${slug}/announcements`,
    data,
    token,
  );
}

export async function updateAnnouncement(
  slug: string,
  id: string,
  data: Partial<
    Pick<Announcement, 'title' | 'body' | 'priority' | 'starts_at' | 'expires_at'>
  >,
  token: string,
): Promise<Announcement> {
  return apiPut<Announcement>(
    `/api/workspaces/${slug}/announcements/${id}`,
    data,
    token,
  );
}

export async function deleteAnnouncement(
  slug: string,
  id: string,
  token: string,
): Promise<void> {
  return apiDelete(`/api/workspaces/${slug}/announcements/${id}`, token);
}
