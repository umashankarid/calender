import type { CalendarEvent, EventWithMembers } from '../../types';

interface UpcomingEventsProps {
  events: (CalendarEvent | EventWithMembers)[];
  /** When provided, each event becomes tappable */
  onEventClick?: (event: CalendarEvent | EventWithMembers) => void;
}

const SHORT_DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

function dateKey(iso: string): string {
  return iso.slice(0, 10); // "YYYY-MM-DD"
}

function formatDateHeader(iso: string): string {
  const d = new Date(iso);
  return `${SHORT_DAYS[d.getDay()]} ${d.getDate()}`;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

/**
 * Group upcoming events by date, limited to the next 7 days.
 */
function groupByDate(
  events: (CalendarEvent | EventWithMembers)[],
): { dateLabel: string; events: (CalendarEvent | EventWithMembers)[] }[] {
  const map = new Map<string, (CalendarEvent | EventWithMembers)[]>();

  for (const ev of events) {
    const key = dateKey(ev.start);
    const list = map.get(key) ?? [];
    list.push(ev);
    map.set(key, list);
  }

  // Sort date keys chronologically
  const sortedKeys = [...map.keys()].sort();

  return sortedKeys.map((key) => ({
    dateLabel: formatDateHeader(key + 'T00:00:00'),
    events: map.get(key)!,
  }));
}

export default function UpcomingEvents({ events, onEventClick }: UpcomingEventsProps) {
  if (events.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-2xl text-gray-500">No upcoming events</p>
      </div>
    );
  }

  const grouped = groupByDate(events);

  return (
    <div className="flex-1 space-y-5 overflow-hidden">
      <h2 className="text-3xl font-bold tracking-wide mb-4">UPCOMING</h2>

      {grouped.map(({ dateLabel, events: dayEvents }) => (
        <div key={dateLabel}>
          <p className="text-xl font-bold text-gray-400 mb-2">{dateLabel}</p>

          <div className="space-y-1 pl-2">
            {dayEvents.map((ev) => {
              const inner = (
                <>
                  <span className="text-lg text-gray-500 flex-shrink-0 w-14 text-right">
                    {ev.all_day ? 'ALL' : formatTime(ev.start)}
                  </span>
                  <span className="text-lg truncate">{ev.title}</span>
                </>
              );

              return onEventClick ? (
                <button
                  key={ev.id}
                  type="button"
                  onClick={() => onEventClick(ev)}
                  className="w-full flex items-baseline gap-3 text-left rounded-lg hover:bg-gray-800/50 active:bg-gray-700/50 transition-colors -mx-1 px-1 py-0.5"
                  aria-label={`View event: ${ev.title}`}
                >
                  {inner}
                </button>
              ) : (
                <div key={ev.id} className="flex items-baseline gap-3">
                  {inner}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
