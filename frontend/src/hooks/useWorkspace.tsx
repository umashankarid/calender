import { useState, useEffect, useCallback } from 'react';
import type { Workspace, WorkspaceUser, Calendar } from '../types';
import { getWorkspace } from '../api/workspaces';
import { listMembers } from '../api/members';
import { listCalendars } from '../api/calendars';
import { useAuth } from './useAuth';

interface UseWorkspaceResult {
  workspace: Workspace | null;
  members: WorkspaceUser[];
  calendars: Calendar[];
  loading: boolean;
  refetch: () => void;
}

export function useWorkspace(slug: string | undefined): UseWorkspaceResult {
  const { token } = useAuth();
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [members, setMembers] = useState<WorkspaceUser[]>([]);
  const [calendars, setCalendars] = useState<Calendar[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!slug || !token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [ws, mem, cal] = await Promise.all([
        getWorkspace(slug, token),
        listMembers(slug, token),
        listCalendars(slug, token),
      ]);
      setWorkspace(ws);
      setMembers(mem);
      setCalendars(cal);
    } catch (err) {
      console.error('Failed to load workspace', err);
    } finally {
      setLoading(false);
    }
  }, [slug, token]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { workspace, members, calendars, loading, refetch: fetch };
}
