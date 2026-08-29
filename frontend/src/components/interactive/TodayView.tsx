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

function isFuture(iso: string): boolean {
  const d = new Date(iso);
  const now = new Date();
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return d >= todayEnd;
}

function formatDateShort(iso: string): string {
  return new Date(iso).toLocaleDateString([], {
    weekday: 'short',
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
  if (event.members.length === 0) return 'Unassigned';
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
  const [filter, setFilter] = useState<string | null>(null); // null = everyone
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

  // Filter to today's events
  const todayEvents = useMemo(() => {
    return events
      .filter((e) => isToday(e.start))
      .sort(
        (a, b) =>
          new Date(a.start).getTime() - new Date(b.start).getTime(),
      );
  }, [events]);

  // Next 10 upcoming events (after today)
  const upcomingEvents = useMemo(() => {
    let upcoming = events
      .filter((e) => isFuture(e.start))
      .sort(
        (a, b) =>
          new Date(a.start).getTime() - new Date(b.start).getTime(),
      );
    if (filter) {
      upcoming = upcoming.filter((e) =>
        e.members.some((m) => m.user_id === filter),
      );
    }
    return upcoming.slice(0, 10);
  }, [events, filter]);

  // Apply member filter
  const filteredEvents = useMemo(() => {
    if (!filter) return todayEvents;
    return todayEvents.filter((e) =>
      e.members.some((m) => m.user_id === filter),
    );
  }, [todayEvents, filter]);

  // Group by member for display
  const grouped = useMemo(() => {
    const map = new Map<string, EventWithMembers[]>();
    for (const event of filteredEvents) {
      const key = getMemberName(members, event);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(event);
    }
    return Array.from(map.entries());
  }, [filteredEvents, members]);

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
          {todayEvents.length} event{todayEvents.length !== 1 ? 's' : ''} today
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

      {/* Events list */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {filteredEvents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="text-6xl mb-4" role="img" aria-hidden="true">
              🌤️
            </div>
            <p className="text-lg font-medium text-gray-700">
              No events today
            </p>
            <p className="text-sm text-gray-400 mt-1">
              Enjoy your free time or add something new
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {grouped.map(([memberName, memberEvents]) => (
              <div key={memberName}>
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  {memberName}
                </h3>
                <div className="space-y-2">
                  {memberEvents.map((event) => {
                    const color = getMemberColor(members, event);
                    const status = event.acceptance_status ?? 'no_members';
                    const acceptedBy = event.members.find(m => m.event_status === 'accepted')?.accepted_by_name;
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
                                : `${formatTime(event.start)} – ${formatTime(event.end!)}`}
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

      {/* Upcoming events */}
      {upcomingEvents.length > 0 && (
        <div className="px-4 pb-4">
          <div className="border-t border-gray-200 pt-4 mt-2">
            <h2 className="text-sm font-bold text-gray-900 mb-1">📅 Upcoming</h2>
            <p className="text-xs text-gray-400 mb-3">
              Next {upcomingEvents.length} event{upcomingEvents.length !== 1 ? 's' : ''}
            </p>
            <div className="space-y-2">
              {upcomingEvents.map((event) => {
                const color = getMemberColor(members, event);
                return (
                  <button
                    key={event.id}
                    onClick={() => setSelectedEvent(event)}
                    className="w-full flex items-stretch bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden text-left hover:shadow-md active:bg-gray-50 transition-all min-h-[56px]"
                  >
                    <div
                      className="w-1.5 flex-shrink-0"
                      style={{ backgroundColor: color }}
                    />
                    <div className="flex-1 px-3 py-2 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-gray-900 truncate">
                          {event.title}
                        </p>
                        <span className="text-[11px] text-gray-400 flex-shrink-0">
                          {formatDateShort(event.start)}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {event.all_day
                          ? 'All day'
                          : formatTime(event.start)}
                        {event.members.length > 0 && (
                          <span className="text-gray-300"> · </span>
                        )}
                        <span className="text-gray-400">
                          {getMemberName(members, event)}
                        </span>
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
                );
              })}
            </div>
          </div>
        </div>
      )}

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
