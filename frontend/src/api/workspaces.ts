import type { Workspace } from '../types';
import { apiGet, apiPost, apiPut } from './client';

export async function listWorkspaces(token: string): Promise<Workspace[]> {
  return apiGet<Workspace[]>('/api/workspaces/', token);
}

export async function getWorkspace(
  slug: string,
  token: string,
): Promise<Workspace> {
  return apiGet<Workspace>(`/api/workspaces/${slug}`, token);
}

export async function createWorkspace(
  data: { name: string; slug: string; timezone?: string },
  token: string,
): Promise<Workspace> {
  return apiPost<Workspace>('/api/workspaces/', data, token);
}

export async function updateWorkspace(
  slug: string,
  data: Partial<Pick<Workspace, 'name' | 'timezone'>>,
  token: string,
): Promise<Workspace> {
  return apiPut<Workspace>(`/api/workspaces/${slug}`, data, token);
}
