import { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import {
  getConnectUrl,
  listGoogleCalendars,
  triggerSync,
  disconnectGoogle,
} from '../../api/google';
import type { GoogleCalendar } from '../../types';

interface Props {
  slug: string;
}

export default function GoogleCalendarSync({ slug }: Props) {
  const { token } = useAuth();
  const [calendars, setCalendars] = useState<GoogleCalendar[]>([]);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Try to load calendars — if it succeeds, we're connected
  useEffect(() => {
    if (!token) return;
    listGoogleCalendars(slug, token)
      .then((cals) => {
        setCalendars(cals);
        setConnected(true);
      })
      .catch(() => {
        setConnected(false);
      })
      .finally(() => setLoading(false));
  }, [slug, token]);

  const handleConnect = async () => {
    if (!token) return;
    setError(null);
    try {
      const { auth_url } = await getConnectUrl(slug, token);
      window.location.href = auth_url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start connection');
    }
  };

  const handleSync = async () => {
    if (!token) return;
    setSyncing(true);
    setSyncResult(null);
    setError(null);
    try {
      const result = await triggerSync(slug, token);
      setSyncResult(`Synced ${result.synced_count} event${result.synced_count === 1 ? '' : 's'}`);
      // Refresh calendar list
      const cals = await listGoogleCalendars(slug, token);
      setCalendars(cals);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const handleDisconnect = async () => {
    if (!token) return;
    if (!window.confirm('Disconnect Google Calendar? This will also remove all synced events.')) {
      return;
    }
    setError(null);
    try {
      await disconnectGoogle(slug, token);
      setConnected(false);
      setCalendars([]);
      setSyncResult(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disconnect');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-3 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-gray-900">Google Calendar</h2>
        <p className="text-sm text-gray-500 mt-1">
          Sync events from your Google Calendar into this workspace.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {!connected ? (
        /* Not connected */
        <div className="bg-white border border-gray-200 rounded-xl p-6 text-center">
          <div className="text-4xl mb-3" role="img" aria-hidden="true">
            📅
          </div>
          <h3 className="text-base font-semibold text-gray-900 mb-1">
            Connect Google Calendar
          </h3>
          <p className="text-sm text-gray-500 mb-4">
            Import events from your Google Calendar to display them on your calendar hub.
          </p>
          <button
            onClick={handleConnect}
            className="inline-flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-lg font-medium text-sm hover:bg-indigo-700 active:bg-indigo-800 transition min-h-[44px]"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Connect Google Calendar
          </button>
        </div>
      ) : (
        /* Connected */
        <div className="space-y-4">
          {/* Connection status */}
          <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full bg-green-500 flex-shrink-0" />
            <span className="text-sm font-medium text-green-800">Connected to Google Calendar</span>
          </div>

          {/* Calendar list */}
          {calendars.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
              <div className="px-4 py-3">
                <h3 className="text-sm font-semibold text-gray-700">
                  Your Calendars
                </h3>
              </div>
              {calendars.map((cal) => (
                <div key={cal.id} className="px-4 py-3 flex items-center gap-3">
                  <div
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: cal.backgroundColor }}
                  />
                  <span className="text-sm text-gray-800 truncate">{cal.summary}</span>
                </div>
              ))}
            </div>
          )}

          {/* Sync result */}
          {syncResult && (
            <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-lg text-sm">
              ✓ {syncResult}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleSync}
              disabled={syncing}
              className="inline-flex items-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-lg font-medium text-sm hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-50 transition min-h-[44px]"
            >
              {syncing ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Syncing…
                </>
              ) : (
                <>
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Sync Now
                </>
              )}
            </button>
            <button
              onClick={handleDisconnect}
              className="inline-flex items-center gap-2 bg-white border border-red-300 text-red-600 px-4 py-2.5 rounded-lg font-medium text-sm hover:bg-red-50 active:bg-red-100 transition min-h-[44px]"
            >
              Disconnect
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
