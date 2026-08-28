import { useState, useMemo } from 'react';
import type { EventWithMembers, WorkspaceUser } from '../../types';
import EventDetailModal from './EventDetailModal';

// ── Types ────────────────────────────────────────────────────────────────────

type SubView = 'schedule' | 'week' | 'month';

interface CalendarViewProps {
  slug: string;
  events: EventWithMembers[];
  members: WorkspaceUser[];
  onRefresh: () => void;
}

// ── Date helpers ─────────────────────────────────────────────────────────────

const DAY_NAMES = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getWeekStart(d: Date): Date {
  const day = d.getDay();
  return addDays(startOfDay(d), -day);
}

function getMonthStart(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
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

// ── Schedule View ────────────────────────────────────────────────────────────

function ScheduleView({
  events,
  members,
  baseDate,
  filter,
  onEventClick,
}: {
  events: EventWithMembers[];
  members: WorkspaceUser[];
  baseDate: Date;
  filter: string | null;
  onEventClick: (e: EventWithMembers) => void;
}) {
  const days = useMemo(() => {
    const result: { date: Date; events: EventWithMembers[] }[] = [];
    for (let i = 0; i < 14; i++) {
      const day = addDays(baseDate, i);
      const dayEvents = events
        .filter((e) => {
          const eDate = new Date(e.start);
          if (!isSameDay(eDate, day)) return false;
          if (filter && !e.members.some((m) => m.user_id === filter)) return false;
          return true;
        })
        .sort(
          (a, b) =>
            new Date(a.start).getTime() - new Date(b.start).getTime(),
        );
      result.push({ date: day, events: dayEvents });
    }
    return result;
  }, [events, baseDate, filter]);

  const today = startOfDay(new Date());

  return (
    <div className="flex-1 overflow-y-auto">
      {days.map(({ date, events: dayEvents }) => {
        const isToday = isSameDay(date, today);
        return (
          <div key={date.toISOString()}>
            {/* Date header */}
            <div
              className={`sticky top-0 z-10 px-4 py-2 text-xs font-bold uppercase tracking-wider ${
                isToday
                  ? 'bg-blue-50 text-blue-600'
                  : 'bg-gray-50 text-gray-500'
              }`}
            >
              {DAY_NAMES[date.getDay()]} {date.getDate()}
              {isToday && (
                <span className="ml-2 text-[10px] font-semibold bg-blue-600 text-white px-1.5 py-0.5 rounded-full">
                  TODAY
                </span>
              )}
            </div>
            {/* Events */}
            {dayEvents.length === 0 ? (
              <div className="px-4 py-3 text-xs text-gray-300">
                No events
              </div>
            ) : (
              <div className="px-4 py-1 space-y-1.5">
                {dayEvents.map((event) => {
                  const color = getMemberColor(members, event);
                  return (
                    <button
                      key={event.id}
                      onClick={() => onEventClick(event)}
                      className="w-full flex items-center gap-3 py-2.5 px-3 bg-white rounded-xl border border-gray-100 text-left active:bg-gray-50 transition-colors min-h-[48px]"
                    >
                      <div
                        className="w-1 h-8 rounded-full flex-shrink-0"
                        style={{ backgroundColor: color }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {event.title}
                        </p>
                        <p className="text-xs text-gray-400">
                          {event.all_day
                            ? 'All day'
                            : `${formatTime(event.start)} – ${formatTime(event.end!)}`}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Week View ────────────────────────────────────────────────────────────────

function WeekView({
  events,
  members,
  baseDate,
  filter,
  onEventClick,
}: {
  events: EventWithMembers[];
  members: WorkspaceUser[];
  baseDate: Date;
  filter: string | null;
  onEventClick: (e: EventWithMembers) => void;
}) {
  const weekStart = getWeekStart(baseDate);
  const today = startOfDay(new Date());

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const dayEvents = useMemo(() => {
    return days.map((day) =>
      events
        .filter((e) => {
          const eDate = new Date(e.start);
          if (!isSameDay(eDate, day)) return false;
          if (filter && !e.members.some((m) => m.user_id === filter)) return false;
          return true;
        })
        .sort(
          (a, b) =>
            new Date(a.start).getTime() - new Date(b.start).getTime(),
        ),
    );
  }, [events, days, filter]);

  return (
    <div className="flex-1 overflow-y-auto px-2 py-2">
      <div className="grid grid-cols-7 gap-1">
        {/* Day headers */}
        {days.map((day, i) => {
          const isToday = isSameDay(day, today);
          return (
            <div key={i} className="text-center pb-1">
              <p className="text-[10px] font-semibold text-gray-400 uppercase">
                {DAY_NAMES[day.getDay()]}
              </p>
              <div
                className={`inline-flex items-center justify-center w-7 h-7 text-xs font-bold rounded-full ${
                  isToday
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-800'
                }`}
              >
                {day.getDate()}
              </div>
            </div>
          );
        })}
        {/* Event cells */}
        {dayEvents.map((evts, i) => (
          <div key={i} className="min-h-[80px] space-y-0.5">
            {evts.slice(0, 4).map((event) => {
              const color = getMemberColor(members, event);
              return (
                <button
                  key={event.id}
                  onClick={() => onEventClick(event)}
                  className="w-full text-left px-1 py-0.5 rounded text-[10px] leading-tight truncate text-white active:opacity-80"
                  style={{ backgroundColor: color }}
                  title={event.title}
                >
                  {event.title}
                </button>
              );
            })}
            {evts.length > 4 && (
              <p className="text-[9px] text-gray-400 text-center">
                +{evts.length - 4} more
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Month View ───────────────────────────────────────────────────────────────

function MonthView({
  events,
  members,
  baseDate,
  filter,
  onEventClick: _onEventClick,
}: {
  events: EventWithMembers[];
  members: WorkspaceUser[];
  baseDate: Date;
  filter: string | null;
  onEventClick: (e: EventWithMembers) => void;
}) {
  const monthStart = getMonthStart(baseDate);
  const calendarStart = getWeekStart(monthStart);
  const today = startOfDay(new Date());

  // Build 6 weeks of days
  const cells = Array.from({ length: 42 }, (_, i) => addDays(calendarStart, i));

  const eventsByDay = useMemo(() => {
    const map = new Map<string, EventWithMembers[]>();
    for (const event of events) {
      if (filter && !event.members.some((m) => m.user_id === filter)) continue;
      const key = startOfDay(new Date(event.start)).toISOString();
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(event);
    }
    return map;
  }, [events, filter]);

  return (
    <div className="flex-1 overflow-y-auto px-2 py-2">
      {/* Day headers */}
      <div className="grid grid-cols-7 gap-0 mb-1">
        {DAY_NAMES.map((d) => (
          <div
            key={d}
            className="text-center text-[10px] font-semibold text-gray-400 uppercase py-1"
          >
            {d}
          </div>
        ))}
      </div>
      {/* Date grid */}
      <div className="grid grid-cols-7 gap-0">
        {cells.map((day, i) => {
          const isCurrentMonth = day.getMonth() === baseDate.getMonth();
          const isToday = isSameDay(day, today);
          const key = startOfDay(day).toISOString();
          const dayEvts = eventsByDay.get(key) ?? [];
          // Unique colors for dot indicators
          const dots = Array.from(
            new Set(dayEvts.map((e) => getMemberColor(members, e))),
          ).slice(0, 3);

          return (
            <div
              key={i}
              className={`flex flex-col items-center py-1.5 min-h-[44px] ${
                isCurrentMonth ? '' : 'opacity-30'
              }`}
            >
              <div
                className={`flex items-center justify-center w-7 h-7 text-xs font-semibold rounded-full ${
                  isToday
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-800'
                }`}
              >
                {day.getDate()}
              </div>
              {/* Dot indicators */}
              {dots.length > 0 && (
                <div className="flex gap-0.5 mt-0.5">
                  {dots.map((color, j) => (
                    <div
                      key={j}
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main CalendarView ────────────────────────────────────────────────────────

export default function CalendarView({
  slug,
  events,
  members,
  onRefresh,
}: CalendarViewProps) {
  const [subView, setSubView] = useState<SubView>('schedule');
  const [baseDate, setBaseDate] = useState(() => startOfDay(new Date()));
  const [filter, setFilter] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<EventWithMembers | null>(null);

  // Period navigation
  const navigate = (dir: -1 | 1) => {
    setBaseDate((prev) => {
      if (subView === 'schedule') return addDays(prev, dir * 14);
      if (subView === 'week') return addDays(prev, dir * 7);
      // month
      const next = new Date(prev);
      next.setMonth(next.getMonth() + dir);
      return next;
    });
  };

  const periodLabel = useMemo(() => {
    if (subView === 'month') {
      return `${MONTH_NAMES[baseDate.getMonth()]} ${baseDate.getFullYear()}`;
    }
    if (subView === 'week') {
      const ws = getWeekStart(baseDate);
      const we = addDays(ws, 6);
      return `${MONTH_NAMES[ws.getMonth()].slice(0, 3)} ${ws.getDate()} – ${MONTH_NAMES[we.getMonth()].slice(0, 3)} ${we.getDate()}`;
    }
    // schedule
    const end = addDays(baseDate, 13);
    return `${MONTH_NAMES[baseDate.getMonth()].slice(0, 3)} ${baseDate.getDate()} – ${MONTH_NAMES[end.getMonth()].slice(0, 3)} ${end.getDate()}`;
  }, [subView, baseDate]);

  const subViews: { key: SubView; label: string }[] = [
    { key: 'schedule', label: 'Schedule' },
    { key: 'week', label: 'Week' },
    { key: 'month', label: 'Month' },
  ];

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Segmented control */}
      <div className="px-4 pt-3 pb-2">
        <div className="flex bg-gray-100 rounded-xl p-1">
          {subViews.map((sv) => (
            <button
              key={sv.key}
              onClick={() => setSubView(sv.key)}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors min-h-[36px] ${
                subView === sv.key
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500'
              }`}
            >
              {sv.label}
            </button>
          ))}
        </div>
      </div>

      {/* Period navigation */}
      <div className="flex items-center justify-between px-4 pb-2">
        <button
          onClick={() => navigate(-1)}
          className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 active:bg-gray-200 text-gray-600"
          aria-label="Previous period"
        >
          ‹
        </button>
        <button
          onClick={() => setBaseDate(startOfDay(new Date()))}
          className="text-sm font-semibold text-gray-800 hover:text-blue-600 transition-colors px-2 py-1"
        >
          {periodLabel}
        </button>
        <button
          onClick={() => navigate(1)}
          className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 active:bg-gray-200 text-gray-600"
          aria-label="Next period"
        >
          ›
        </button>
      </div>

      {/* Member filter chips */}
      <div className="px-4 pb-2 flex gap-2 overflow-x-auto scrollbar-hide">
        <button
          onClick={() => setFilter(null)}
          className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium min-h-[32px] transition-colors ${
            filter === null
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-600'
          }`}
        >
          Everyone
        </button>
        {members.map((m) => (
          <button
            key={m.id}
            onClick={() => setFilter(m.user_id)}
            className={`flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium min-h-[32px] transition-colors ${
              filter === m.user_id
                ? 'text-white'
                : 'bg-gray-100 text-gray-600'
            }`}
            style={
              filter === m.user_id
                ? { backgroundColor: m.display_color ?? '#6366f1' }
                : undefined
            }
          >
            <span
              className="w-2 h-2 rounded-full"
              style={{
                backgroundColor:
                  filter === m.user_id ? '#fff' : (m.display_color ?? '#6366f1'),
              }}
            />
            {m.display_name ?? m.user?.name ?? 'Member'}
          </button>
        ))}
      </div>

      {/* Sub-view content */}
      {subView === 'schedule' && (
        <ScheduleView
          events={events}
          members={members}
          baseDate={baseDate}
          filter={filter}
          onEventClick={setSelectedEvent}
        />
      )}
      {subView === 'week' && (
        <WeekView
          events={events}
          members={members}
          baseDate={baseDate}
          filter={filter}
          onEventClick={setSelectedEvent}
        />
      )}
      {subView === 'month' && (
        <MonthView
          events={events}
          members={members}
          baseDate={baseDate}
          filter={filter}
          onEventClick={setSelectedEvent}
        />
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
