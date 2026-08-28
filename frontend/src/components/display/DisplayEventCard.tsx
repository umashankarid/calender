import { useState } from 'react';
import type { EventWithMembers, WorkspaceUser, CalendarEvent } from '../../types';
import { deleteEvent } from '../../api/events';
import { useAuth } from '../../hooks/useAuth';
import AddEventModal from '../interactive/AddEventModal';

// ── Types ────────────────────────────────────────────────────────────────────

interface DisplayEventCardProps {
  slug: string;
  event: EventWithMembers;
  members: WorkspaceUser[];
  onUpdated: () => void;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function getMemberColor(event: EventWithMembers): string {
  if (event.members.length === 0) return '#6366f1';
  return event.members[0].display_color ?? '#6366f1';
}

// ── Component ────────────────────────────────────────────────────────────────

export default function DisplayEventCard({
  slug,
  event,
  members,
  onUpdated,
}: DisplayEventCardProps) {
  const { token } = useAuth();
  const [showPopover, setShowPopover] = useState(false);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const accentColor = getMemberColor(event);

  const handleDelete = async () => {
    if (!token) return;
    setDeleting(true);
    try {
      await deleteEvent(slug, event.id, token);
      onUpdated();
    } catch (err) {
      console.error('Failed to delete event', err);
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
      setShowPopover(false);
    }
  };

  // Show AddEventModal in edit mode
  if (editing) {
    return (
      <AddEventModal
        slug={slug}
        members={members}
        onClose={() => setEditing(false)}
        onSaved={() => {
          setEditing(false);
          onUpdated();
        }}
        editEvent={event as CalendarEvent}
      />
    );
  }

  return (
    <div className="relative">
      {/* Tappable card */}
      <button
        type="button"
        onClick={() => setShowPopover(!showPopover)}
        className="w-full flex items-stretch gap-3 bg-gray-800 border border-gray-700 rounded-xl min-h-[56px] p-3 text-left transition-colors hover:bg-gray-750 active:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        aria-label={`Event: ${event.title}`}
      >
        {/* Member color bar */}
        <span
          className="w-1.5 rounded-full flex-shrink-0 self-stretch"
          style={{ backgroundColor: accentColor }}
          aria-hidden="true"
        />

        {/* Event info */}
        <div className="flex-1 min-w-0">
          <p className="text-white text-base font-medium truncate">
            {event.title}
          </p>
          <div className="flex items-center gap-3 mt-0.5">
            <span className="text-sm text-gray-400">
              {event.all_day
                ? 'All day'
                : `${formatTime(event.start)}${event.end ? ` – ${formatTime(event.end)}` : ''}`}
            </span>
            {event.location && (
              <span className="text-sm text-gray-500 truncate">
                📍 {event.location}
              </span>
            )}
          </div>
        </div>

        {/* Chevron indicator */}
        <span className="text-gray-500 self-center text-sm" aria-hidden="true">
          ⋯
        </span>
      </button>

      {/* Action popover */}
      {showPopover && (
        <>
          {/* Invisible backdrop to close popover */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => {
              setShowPopover(false);
              setConfirmDelete(false);
            }}
          />

          <div className="absolute right-2 top-full mt-1 z-50 bg-gray-700 border border-gray-600 rounded-xl shadow-xl overflow-hidden min-w-[160px]">
            {!confirmDelete ? (
              <>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowPopover(false);
                    setEditing(true);
                  }}
                  className="w-full flex items-center gap-3 px-4 min-h-[48px] text-white text-sm font-medium hover:bg-gray-600 active:bg-gray-500 transition-colors"
                >
                  <span aria-hidden="true">✏️</span> Edit
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setConfirmDelete(true);
                  }}
                  className="w-full flex items-center gap-3 px-4 min-h-[48px] text-red-400 text-sm font-medium hover:bg-gray-600 active:bg-gray-500 transition-colors"
                >
                  <span aria-hidden="true">🗑️</span> Delete
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowPopover(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 min-h-[48px] text-gray-400 text-sm font-medium hover:bg-gray-600 active:bg-gray-500 transition-colors border-t border-gray-600"
                >
                  <span aria-hidden="true">✕</span> Close
                </button>
              </>
            ) : (
              <div className="p-4">
                <p className="text-sm text-gray-300 mb-3">
                  Delete &ldquo;{event.title}&rdquo;?
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete();
                    }}
                    disabled={deleting}
                    className="flex-1 min-h-[44px] rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 active:bg-red-800 disabled:opacity-50 transition-colors"
                  >
                    {deleting ? 'Deleting…' : 'Confirm'}
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setConfirmDelete(false);
                    }}
                    className="flex-1 min-h-[44px] rounded-lg bg-gray-600 text-gray-300 text-sm font-medium hover:bg-gray-500 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
