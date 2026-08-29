import { useState, useMemo } from 'react';
import type { EventWithMembers, WorkspaceUser } from '../../types';
import { respondToEvent } from '../../api/events';
import { useAuth } from '../../hooks/useAuth';
import QuickAdd from './QuickAdd';
import EventDetailModal from './EventDetailModal';

// ── Types ────────────────────────────────────────────────────────────────────

interface TodayViewProps {
  slug: string;
  events: EventWithMembers[];
  members: WorkspaceUser[];
  onRefresh: () => void;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function isToday(iso: string): boolean {
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

function isTomorrow(iso: string): boolean {
  const d = new Date(iso);
  const now = new Date();
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return (
    d.getFullYear() === tomorrow.getFullYear() &&
    d.getMonth() === tomorrow.getMonth() &&
    d.getDate() === tomorrow.getDate()
  );
}

function dateKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDateLabel(iso: string): string {
  if (isToday(iso)) return 'Today';
  if (isTomorrow(iso)) return 'Tomorrow';
  return new Date(iso).toLocaleDateString([], {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
}

function getMemberColor(
  members: WorkspaceUser[],
  event: EventWithMembers,
): string {
  if (event.members.length === 0) return '#6366f1';
  const first = event.members[0];
  const wsm = members.find((m) => m.user_id === first.user_id);
  return wsm?.display_color ?? '#6366f1';
}

function getMemberName(members: WorkspaceUser[], event: EventWithMembers): string {
  if (event.members.length === 0) return '';
  return event.members
    .map((em) => {
      const wsm = members.find((m) => m.user_id === em.user_id);
      return wsm?.display_name ?? em.display_name ?? 'Member';
    })
    .join(', ');
}

// ── Component ────────────────────────────────────────────────────────────────

export default function TodayView({
  slug,
  events,
  members,
  onRefresh,
}: TodayViewProps) {
  const { token } = useAuth();
  const [filter, setFilter] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<EventWithMembers | null>(null);
  const [respondingTo, setRespondingTo] = useState<string | null>(null);

  const handleRespond = async (eventId: string, response: 'accepted' | 'declined') => {
    if (!token || !slug) return;
    setRespondingTo(eventId);
    try {
      await respondToEvent(slug, eventId, response, token);
      onRefresh();
    } catch (err) {
      console.error('Failed to respond to event', err);
    } finally {
      setRespondingTo(null);
    }
  };

  // All events from today onwards, sorted by date, filtered by member
  const allEvents = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    let filtered = events
      .filter((e) => new Date(e.start) >= todayStart)
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

    if (filter) {
      filtered = filtered.filter((e) =>
        e.members.some((m) => m.user_id === filter),
      );
    }

    return filtered;
  }, [events, filter]);

  // Group by date
  const grouped = useMemo(() => {
    const map = new Map<string, { label: string; events: EventWithMembers[] }>();
    for (const event of allEvents) {
      const key = dateKey(event.start);
      if (!map.has(key)) {
        map.set(key, { label: formatDateLabel(event.start), events: [] });
      }
      map.get(key)!.events.push(event);
    }
    return Array.from(map.values());
  }, [allEvents]);

  const today = new Date();
  const dateStr = today.toLocaleDateString([], {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="flex flex-col min-h-0 flex-1">
      {/* Quick Add */}
      <QuickAdd slug={slug} onEventCreated={onRefresh} />

      {/* Date header */}
      <div className="px-4 py-2">
        <h2 className="text-lg font-bold text-gray-900">{dateStr}</h2>
        <p className="text-sm text-gray-500">
          {allEvents.length} upcoming event{allEvents.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Member filter chips */}
      <div className="px-4 pb-2 flex gap-2 overflow-x-auto scrollbar-hide">
        <button
          onClick={() => setFilter(null)}
          className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium min-h-[36px] transition-colors ${
            filter === null
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-600 active:bg-gray-200'
          }`}
        >
          Everyone
        </button>
        {members.map((m) => (
          <button
            key={m.id}
            onClick={() => setFilter(m.user_id)}
            className={`flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium min-h-[36px] transition-colors ${
              filter === m.user_id
                ? 'text-white'
                : 'bg-gray-100 text-gray-600 active:bg-gray-200'
            }`}
            style={
              filter === m.user_id
                ? { backgroundColor: m.display_color ?? '#6366f1' }
                : undefined
            }
          >
            <span
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{
                backgroundColor:
                  filter === m.user_id ? '#fff' : (m.display_color ?? '#6366f1'),
              }}
            />
            {m.display_name ?? m.user?.name ?? 'Member'}
          </button>
        ))}
      </div>

      {/* Events list — grouped by date */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {allEvents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="text-5xl mb-3" role="img" aria-hidden="true">📅</div>
            <p className="text-base font-medium text-gray-700">No upcoming events</p>
            <p className="text-sm text-gray-400 mt-1">Tap + to add one</p>
          </div>
        ) : (
          <div className="space-y-5">
            {grouped.map((group) => (
              <div key={group.label}>
                {/* Date header */}
                <div className="flex items-center gap-2 mb-2">
                  <h3 className={`text-xs font-bold uppercase tracking-wider ${
                    group.label === 'Today' ? 'text-blue-600' : 'text-gray-400'
                  }`}>
                    {group.label}
                  </h3>
                  {group.label === 'Today' && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-600">
                      {group.events.length}
                    </span>
                  )}
                  <div className="flex-1 h-px bg-gray-100" />
                </div>

                {/* Event cards */}
                <div className="space-y-2">
                  {group.events.map((event) => {
                    const color = getMemberColor(members, event);
                    const status = event.acceptance_status ?? 'no_members';
                    const acceptedBy = event.members.find(m => m.event_status === 'accepted')?.accepted_by_name;
                    const memberName = getMemberName(members, event);

                    return (
                      <div key={event.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                        <button
                          onClick={() => setSelectedEvent(event)}
                          className="w-full flex items-stretch text-left hover:shadow-md active:bg-gray-50 transition-all min-h-[64px]"
                        >
                          {/* Color bar */}
                          <div
                            className="w-1.5 flex-shrink-0"
                            style={{ backgroundColor: color }}
                          />
                          {/* Content */}
                          <div className="flex-1 px-3 py-2.5 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-semibold text-gray-900 truncate flex-1">
                                {event.title}
                              </p>
                              {/* Status badge */}
                              {status === 'accepted' && (
                                <span className="flex-shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                                  ✓ {acceptedBy ?? 'Accepted'}
                                </span>
                              )}
                              {status === 'declined' && (
                                <span className="flex-shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-600">
                                  ✗ Declined
                                </span>
                              )}
                              {status === 'pending' && (
                                <span className="flex-shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                                  ⏳ Pending
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-500 mt-0.5">
                              {event.all_day
                                ? 'All day'
                                : `${formatTime(event.start)}${event.end ? ` – ${formatTime(event.end)}` : ''}`}
                              {memberName && (
                                <>
                                  <span className="text-gray-300"> · </span>
                                  <span className="text-gray-400">{memberName}</span>
                                </>
                              )}
                            </p>
                            {event.location && (
                              <p className="text-xs text-gray-400 mt-0.5 truncate">
                                📍 {event.location}
                              </p>
                            )}
                            {event.notes && (
                              <p className="text-xs text-gray-400 mt-0.5 truncate">
                                📝 {event.notes}
                              </p>
                            )}
                          </div>
                        </button>
                        {/* Accept/Decline buttons */}
                        {status === 'pending' && (
                          <div className="flex border-t border-gray-100">
                            <button
                              onClick={() => handleRespond(event.id, 'accepted')}
                              disabled={respondingTo === event.id}
                              className="flex-1 py-2.5 text-xs font-semibold text-green-700 bg-green-50 hover:bg-green-100 active:bg-green-200 transition-colors min-h-[40px] disabled:opacity-50"
                            >
                              ✓ Accept
                            </button>
                            <button
                              onClick={() => handleRespond(event.id, 'declined')}
                              disabled={respondingTo === event.id}
                              className="flex-1 py-2.5 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 active:bg-red-200 transition-colors border-l border-gray-100 min-h-[40px] disabled:opacity-50"
                            >
                              ✗ Decline
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Event detail modal */}
      {selectedEvent && (
        <EventDetailModal
          slug={slug}
          event={selectedEvent}
          members={members}
          onClose={() => setSelectedEvent(null)}
          onUpdated={() => {
            setSelectedEvent(null);
            onRefresh();
          }}
        />
      )}
    </div>
  );
}
