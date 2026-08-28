import type { WorkspaceUser, WorkspaceRole } from '../types';
import { apiDelete, apiGet, apiPost, apiPut } from './client';

export async function listMembers(
  slug: string,
  token: string,
): Promise<WorkspaceUser[]> {
  return apiGet<WorkspaceUser[]>(`/api/workspaces/${slug}/members`, token);
}

export async function inviteMember(
  slug: string,
  data: { email: string; role?: WorkspaceRole },
  token: string,
): Promise<WorkspaceUser> {
  return apiPost<WorkspaceUser>(
    `/api/workspaces/${slug}/members`,
    data,
    token,
  );
}

export async function updateMember(
  slug: string,
  memberId: string,
  data: { role?: WorkspaceRole; display_name?: string; display_color?: string },
  token: string,
): Promise<WorkspaceUser> {
  return apiPut<WorkspaceUser>(
    `/api/workspaces/${slug}/members/${memberId}`,
    data,
    token,
  );
}

export async function removeMember(
  slug: string,
  memberId: string,
  token: string,
): Promise<void> {
  return apiDelete(`/api/workspaces/${slug}/members/${memberId}`, token);
}
