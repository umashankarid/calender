import { useState, useEffect, useCallback } from 'react';
import type { EventWithMembers } from '../types';
import { listEvents, type ListEventsParams } from '../api/events';
import { useAuth } from './useAuth';

interface UseEventsResult {
  events: EventWithMembers[];
  loading: boolean;
  refetch: () => void;
}

export function useEvents(
  slug: string | undefined,
  params?: ListEventsParams,
): UseEventsResult {
  const { token } = useAuth();
  const [events, setEvents] = useState<EventWithMembers[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!slug || !token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await listEvents(slug, params, token);
      setEvents(data);
    } catch (err) {
      console.error('Failed to load events', err);
    } finally {
      setLoading(false);
    }
  }, [slug, token, params?.start, params?.end, params?.calendar_id]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { events, loading, refetch: fetch };
}
