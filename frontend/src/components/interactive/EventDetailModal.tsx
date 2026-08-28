import { useState } from 'react';
import type { EventWithMembers, WorkspaceUser, CalendarEvent } from '../../types';
import { deleteEvent } from '../../api/events';
import { useAuth } from '../../hooks/useAuth';
import AddEventModal from './AddEventModal';

// ── Types ────────────────────────────────────────────────────────────────────

interface EventDetailModalProps {
  slug: string;
  event: EventWithMembers;
  members: WorkspaceUser[];
  onClose: () => void;
  onUpdated: () => void;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString([], {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function getMemberColor(
  members: WorkspaceUser[],
  eventMembers: EventWithMembers['members'],
): string {
  if (eventMembers.length === 0) return '#6366f1';
  const first = eventMembers[0];
  const wsm = members.find((m) => m.user_id === first.user_id);
  return wsm?.display_color ?? '#6366f1';
}

// ── Component ────────────────────────────────────────────────────────────────

export default function EventDetailModal({
  slug,
  event,
  members,
  onClose,
  onUpdated,
}: EventDetailModalProps) {
  const { token } = useAuth();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteOptions, setShowDeleteOptions] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isRecurring = !!event.recurrence;

  const handleDelete = async (_mode: 'this' | 'future') => {
    if (!token) return;
    setDeleting(true);
    setError(null);
    try {
      // Note: backend can handle mode via query param if supported
      await deleteEvent(slug, event.id, token);
      onUpdated();
      onClose();
    } catch (err: any) {
      setError(err.message ?? 'Failed to delete event');
    } finally {
      setDeleting(false);
      setShowDeleteOptions(false);
    }
  };

  const handleDeleteClick = () => {
    if (isRecurring) {
      setShowDeleteOptions(true);
    } else {
      handleDelete('this');
    }
  };

  const handleBackdrop = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  // If editing, show AddEventModal in edit mode
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

  const accentColor = getMemberColor(members, event.members);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40"
      onClick={handleBackdrop}
    >
      <div className="w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl max-h-[85vh] overflow-y-auto animate-in slide-in-from-bottom duration-200">
        {/* Color accent bar */}
        <div
          className="h-1.5 rounded-t-2xl"
          style={{ backgroundColor: accentColor }}
        />

        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-3 pb-2">
          <button
            onClick={onClose}
            className="text-gray-500 min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <div className="flex gap-1">
            <button
              onClick={() => setEditing(true)}
              className="text-blue-600 text-sm font-medium min-h-[44px] px-3 flex items-center"
            >
              Edit
            </button>
            <button
              onClick={handleDeleteClick}
              disabled={deleting}
              className="text-red-500 text-sm font-medium min-h-[44px] px-3 flex items-center disabled:opacity-50"
            >
              {deleting ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="px-4 pb-6 space-y-4">
          {error && (
            <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          {/* Title */}
          <h2 className="text-xl font-bold text-gray-900">{event.title}</h2>

          {/* Date & time */}
          <div className="flex items-center gap-3 text-sm text-gray-600">
            <span className="text-lg" role="img" aria-hidden="true">📅</span>
            <div>
              <p className="font-medium text-gray-800">
                {formatDate(event.start)}
              </p>
              <p>
                {event.all_day
                  ? 'All day'
                  : `${formatTime(event.start)} – ${formatTime(event.end!)}`}
              </p>
            </div>
          </div>

          {/* Location */}
          {event.location && (
            <div className="flex items-center gap-3 text-sm text-gray-600">
              <span className="text-lg" role="img" aria-hidden="true">📍</span>
              <p>{event.location}</p>
            </div>
          )}

          {/* Recurrence */}
          {event.recurrence && (
            <div className="flex items-center gap-3 text-sm text-gray-600">
              <span className="text-lg" role="img" aria-hidden="true">🔄</span>
              <p className="capitalize">{event.recurrence}</p>
            </div>
          )}

          {/* Description */}
          {event.notes && (
            <div className="flex items-start gap-3 text-sm text-gray-600">
              <span className="text-lg mt-0.5" role="img" aria-hidden="true">📝</span>
              <p className="whitespace-pre-wrap">{event.notes}</p>
            </div>
          )}

          {/* Members */}
          {event.members.length > 0 && (
            <div>
              <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                Members
              </h3>
              <div className="space-y-2">
                {event.members.map((em) => {
                  const wsm = members.find((m) => m.user_id === em.user_id);
                  const color = wsm?.display_color ?? '#6366f1';
                  return (
                    <div
                      key={em.user_id}
                      className="flex items-center gap-3 px-3 py-2 bg-gray-50 rounded-xl"
                    >
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                        style={{ backgroundColor: color }}
                      >
                        {(em.display_name ?? 'M')[0].toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">
                          {em.display_name}
                        </p>
                        <p className="text-xs text-gray-400 capitalize">
                          {em.role}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Delete options for recurring events */}
          {showDeleteOptions && (
            <div className="border-t border-gray-100 pt-4 space-y-2">
              <p className="text-sm font-medium text-gray-700 mb-2">
                This is a recurring event. Delete:
              </p>
              <button
                onClick={() => handleDelete('this')}
                disabled={deleting}
                className="w-full min-h-[44px] rounded-xl bg-red-50 text-red-600 text-sm font-medium hover:bg-red-100 active:bg-red-200 transition-colors disabled:opacity-50"
              >
                This event only
              </button>
              <button
                onClick={() => handleDelete('future')}
                disabled={deleting}
                className="w-full min-h-[44px] rounded-xl bg-red-50 text-red-600 text-sm font-medium hover:bg-red-100 active:bg-red-200 transition-colors disabled:opacity-50"
              >
                This and future events
              </button>
              <button
                onClick={() => setShowDeleteOptions(false)}
                className="w-full min-h-[44px] rounded-xl bg-gray-50 text-gray-600 text-sm font-medium hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
