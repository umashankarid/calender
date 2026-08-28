import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import type { DisplayFeed, EventWithMembers } from '../types';
import { getDisplayFeed } from '../api/display';
import { useWorkspace } from '../hooks/useWorkspace';
import DisplayHeader from '../components/display/DisplayHeader';
import TodayEvents from '../components/display/TodayEvents';
import UpcomingEvents from '../components/display/UpcomingEvents';
import AnnouncementsBanner from '../components/display/AnnouncementsBanner';
import RemindersList from '../components/display/RemindersList';
import InteractivePanel from '../components/display/InteractivePanel';
import ShoppingWidget from '../components/display/ShoppingWidget';
import EventDetailModal from '../components/interactive/EventDetailModal';

const REFRESH_INTERVAL_MS = 30_000;

interface FeedWithMeta extends DisplayFeed {
  workspace_name?: string;
  display_id?: string;
}

export default function DisplayPage() {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const displayToken = searchParams.get('token');
  const { members } = useWorkspace(slug);

  const [feed, setFeed] = useState<FeedWithMeta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pairingCode, setPairingCode] = useState('');

  // ── Interactive mode state ──────────────────────────────────────────────
  const [interactiveMode, setInteractiveMode] = useState(false);
  const [startVoice, setStartVoice] = useState(false);

  // ── Event detail modal state ────────────────────────────────────────────
  const [selectedEvent, setSelectedEvent] = useState<EventWithMembers | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);

  // ── Fetch display feed ──────────────────────────────────────────────────

  const fetchFeed = useCallback(async () => {
    if (!displayToken) {
      setLoading(false);
      setError('no-token');
      return;
    }
    try {
      const data = (await getDisplayFeed(slug!, displayToken)) as FeedWithMeta;
      setFeed(data);
      setError(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load feed';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [displayToken]);

  // Initial fetch
  useEffect(() => {
    fetchFeed();
  }, [fetchFeed]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    if (!displayToken) return;
    const id = setInterval(fetchFeed, REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
  }, [fetchFeed, displayToken]);

  // ── SSE for real-time updates ───────────────────────────────────────────

  useEffect(() => {
    if (!slug || !feed?.display_id) return;

    const API_URL =
      (import.meta as any).env?.VITE_API_URL ?? 'http://localhost:8000';
    const url = `${API_URL}/api/workspaces/${slug}/displays/${feed.display_id}/feed`;

    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as FeedWithMeta;
        setFeed(data);
      } catch {
        // Ignore malformed SSE payloads
      }
    };

    es.onerror = () => {
      // EventSource will auto-reconnect
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, [slug, feed?.display_id]);

  // ── Handlers ────────────────────────────────────────────────────────────

  const handleOpenAdd = () => {
    setStartVoice(false);
    setInteractiveMode(true);
  };

  const handleOpenVoice = () => {
    setStartVoice(true);
    setInteractiveMode(true);
  };

  const handleClosePanel = () => {
    setInteractiveMode(false);
    setStartVoice(false);
  };

  const handleEventSaved = () => {
    fetchFeed();
    handleClosePanel();
  };

  const handleEventClick = (event: EventWithMembers) => {
    setSelectedEvent(event);
  };

  const handleEventDetailClose = () => {
    setSelectedEvent(null);
  };

  const handleEventDetailUpdated = () => {
    setSelectedEvent(null);
    fetchFeed();
  };

  // ── Pairing code screen ─────────────────────────────────────────────────

  if (!displayToken || error === 'no-token') {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-8">
        <h1 className="text-4xl font-bold mb-6">📅 Calendar Hub Display</h1>
        <p className="text-2xl text-gray-400 mb-8">
          Enter a pairing code to connect this display
        </p>

        <div className="flex gap-4 items-center">
          <input
            type="text"
            value={pairingCode}
            onChange={(e) => setPairingCode(e.target.value.toUpperCase())}
            placeholder="PAIRING CODE"
            className="bg-gray-800 text-white text-2xl font-mono tracking-widest px-6 py-4 rounded-xl border border-gray-600 focus:border-blue-500 focus:outline-none text-center w-72"
            maxLength={8}
            aria-label="Pairing code"
          />
          <button
            onClick={async () => {
              if (!slug || !pairingCode) return;
              try {
                const { pairDisplay } = await import('../api/display');
                const display = await pairDisplay(slug, pairingCode);
                navigate(`/${slug}/display?token=${display.token}`);
              } catch {
                setError('Invalid pairing code');
              }
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white text-xl font-semibold px-8 py-4 rounded-xl transition-colors"
          >
            Pair
          </button>
        </div>

        {error && error !== 'no-token' && (
          <p className="text-red-400 text-lg mt-4">{error}</p>
        )}
      </div>
    );
  }

  // ── Loading state ───────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <p className="text-3xl text-gray-400 animate-pulse">Loading display…</p>
      </div>
    );
  }

  // ── Error state ─────────────────────────────────────────────────────────

  if (error || !feed) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-8">
        <p className="text-3xl font-bold mb-4">⚠️ Display Error</p>
        <p className="text-xl text-gray-400">{error ?? 'Unable to load feed'}</p>
        <p className="text-lg text-gray-500 mt-6">
          Retrying every {REFRESH_INTERVAL_MS / 1000} seconds…
        </p>
      </div>
    );
  }

  // ── Main display ────────────────────────────────────────────────────────

  const workspaceName = feed.workspace_name ?? slug ?? 'Calendar Hub';

  return (
    <div className="min-h-screen max-h-screen bg-gray-900 text-white flex flex-col overflow-hidden">
      {/* Header with clock */}
      <DisplayHeader workspaceName={workspaceName} />

      {/* Announcements banner — full width, above the columns */}
      {feed.announcements.length > 0 && (
        <div className="px-8 pt-4">
          <AnnouncementsBanner announcements={feed.announcements} />
        </div>
      )}

      {/* Main content: two-column on large screens */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-8 px-8 py-6 overflow-hidden">
        {/* Left column — Today (tappable events) */}
        <TodayEvents
          events={feed.today}
          onEventClick={handleEventClick}
        />

        {/* Right column — Upcoming + Reminders + Shopping */}
        <div className="flex flex-col gap-6 overflow-hidden">
          <UpcomingEvents
            events={feed.upcoming}
            onEventClick={(ev) => handleEventClick(ev as EventWithMembers)}
          />
          {feed.reminders.length > 0 && <RemindersList reminders={feed.reminders} />}
          <ShoppingWidget items={feed.shopping_list ?? []} />
        </div>
      </main>

      {/* Minimal bottom bar — interactive mode shortcuts */}
      <footer className="flex items-center justify-end gap-4 px-8 py-3 bg-gray-800/50">
        {/* Manage button (gear icon) → links to admin */}
        <button
          onClick={() => navigate(`/${slug}/admin`)}
          className="text-gray-600 hover:text-gray-400 text-lg transition-colors mr-auto"
          aria-label="Manage workspace"
          title="Manage"
        >
          ⚙️
        </button>

        <button
          onClick={handleOpenAdd}
          className="text-gray-500 hover:text-white text-lg transition-colors min-h-[48px] px-3 flex items-center"
          aria-label="Open add event panel"
        >
          + Add
        </button>
        <button
          onClick={handleOpenVoice}
          className="text-gray-500 hover:text-white text-lg transition-colors min-h-[48px] px-3 flex items-center"
          aria-label="Open voice input panel"
        >
          🎤 Voice
        </button>
      </footer>

      {/* Interactive panel overlay */}
      {slug && (
        <InteractivePanel
          isOpen={interactiveMode}
          onClose={handleClosePanel}
          slug={slug}
          feed={feed.today}
          onEventSaved={handleEventSaved}
          startVoice={startVoice}
        />
      )}

      {/* Event detail modal — opens when tapping an event on the display */}
      {selectedEvent && slug && (
        <EventDetailModal
          slug={slug}
          event={selectedEvent}
          members={members}
          onClose={handleEventDetailClose}
          onUpdated={handleEventDetailUpdated}
        />
      )}
    </div>
  );
}
