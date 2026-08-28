import type { EventWithMembers, WorkspaceUser } from '../../types';

interface TodayEventsProps {
  events: EventWithMembers[];
  members?: WorkspaceUser[];
  /** When provided, each event becomes tappable */
  onEventClick?: (event: EventWithMembers) => void;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

/**
 * Group events by member. Each event appears under each of its members.
 * Events without members go into a "Shared" bucket.
 */
function groupByMember(
  events: EventWithMembers[],
  members: WorkspaceUser[],
): { member: { userId: string; displayName: string; color: string }; events: EventWithMembers[] }[] {
  const memberMap = new Map<string, WorkspaceUser>();
  for (const m of members) memberMap.set(m.user_id, m);

  const groups = new Map<string, EventWithMembers[]>();
  for (const ev of events) {
    if (ev.members.length === 0) {
      const list = groups.get('__unassigned__') ?? [];
      list.push(ev);
      groups.set('__unassigned__', list);
    } else {
      // Show event under its first member
      const firstMember = ev.members[0];
      const key = firstMember.user_id;
      const list = groups.get(key) ?? [];
      list.push(ev);
      groups.set(key, list);
    }
  }

  // Build member info from workspace members or event members
  const eventMemberMap = new Map<string, WorkspaceUser>();
  for (const ev of events) {
    for (const m of ev.members) {
      if (!eventMemberMap.has(m.user_id)) eventMemberMap.set(m.user_id, m);
    }
  }

  const result: { member: { userId: string; displayName: string; color: string }; events: EventWithMembers[] }[] = [];
  for (const [key, evs] of groups) {
    if (key === '__unassigned__') {
      result.push({ member: { userId: key, displayName: 'Shared', color: '#6B7280' }, events: evs });
    } else {
      const wsm = memberMap.get(key) ?? eventMemberMap.get(key);
      const member = wsm
        ? { userId: wsm.user_id, displayName: wsm.display_name ?? wsm.user?.name ?? 'Member', color: wsm.display_color ?? '#6B7280' }
        : { userId: key, displayName: 'Member', color: '#6B7280' };
      result.push({ member, events: evs });
    }
  }
  return result;
}

export default function TodayEvents({ events, members = [], onEventClick }: TodayEventsProps) {
  if (events.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-2xl text-gray-500">No events today</p>
      </div>
    );
  }

  const grouped = groupByMember(events, members);

  return (
    <div className="flex-1 space-y-6 overflow-hidden">
      <h2 className="text-3xl font-bold tracking-wide mb-4">TODAY</h2>

      {grouped.map(({ member, events: memberEvents }) => (
        <div key={member.userId} className="space-y-2">
          {/* Member heading */}
          <div className="flex items-center gap-3">
            <span
              className="inline-block w-4 h-4 rounded-full flex-shrink-0"
              style={{ backgroundColor: member.color }}
              aria-hidden="true"
            />
            <span className="text-xl font-semibold">{member.displayName}</span>
          </div>

          {/* Event list */}
          {memberEvents.map((ev) => {
            const inner = (
              <>
                <span
                  className="w-1 self-stretch rounded-full flex-shrink-0"
                  style={{ backgroundColor: member.color }}
                  aria-hidden="true"
                />
                <div className="min-w-0">
                  <p className="text-xl font-medium truncate">{ev.title}</p>
                  <p className="text-lg text-gray-400">
                    {ev.all_day
                      ? 'All day'
                      : `${formatTime(ev.start)} – ${formatTime(ev.end!)}`}
                  </p>
                </div>
              </>
            );

            return onEventClick ? (
              <button
                key={ev.id}
                type="button"
                onClick={() => onEventClick(ev)}
                className="w-full flex items-baseline gap-4 pl-7 text-left rounded-lg hover:bg-gray-800/50 active:bg-gray-700/50 transition-colors -mx-2 px-2 py-1"
                aria-label={`View event: ${ev.title}`}
              >
                {inner}
              </button>
            ) : (
              <div
                key={ev.id}
                className="flex items-baseline gap-4 pl-7"
              >
                {inner}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
