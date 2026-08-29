import React, { useState, useEffect } from 'react';
import type { WorkspaceUser, CalendarEvent } from '../../types';
import { createEvent, updateEvent } from '../../api/events';
import { useAuth } from '../../hooks/useAuth';

// ── Types ────────────────────────────────────────────────────────────────────

interface AddEventModalProps {
  slug: string;
  members: WorkspaceUser[];
  onClose: () => void;
  onSaved: () => void;
  /** If provided, modal is in edit mode */
  editEvent?: CalendarEvent | null;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function toDateInputValue(iso?: string): string {
  if (!iso) return new Date().toISOString().slice(0, 10);
  return new Date(iso).toISOString().slice(0, 10);
}

function toTimeInputValue(iso?: string): string {
  if (!iso) return '09:00';
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function AddEventModal({
  slug,
  members,
  onClose,
  onSaved,
  editEvent,
}: AddEventModalProps) {
  const { token } = useAuth();
  const isEdit = !!editEvent;

  const [title, setTitle] = useState('');
  const [date, setDate] = useState(toDateInputValue());
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [repeat, setRepeat] = useState('none');
  const [reminder, setReminder] = useState('none');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Populate fields when editing
  useEffect(() => {
    if (editEvent) {
      setTitle(editEvent.title);
      setDate(toDateInputValue(editEvent.start));
      setStartTime(toTimeInputValue(editEvent.start));
      setEndTime(toTimeInputValue(editEvent.end ?? undefined));
      setLocation(editEvent.location ?? '');
      setNotes(editEvent.notes ?? '');
      setRepeat(editEvent.recurrence ?? 'none');
    }
  }, [editEvent]);

  const toggleMember = (id: string) => {
    setSelectedMembers((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id],
    );
  };

  const handleSave = async () => {
    if (!title.trim()) {
      setError('Please enter an event title');
      return;
    }
    if (!token) return;
    setSaving(true);
    setError(null);

    const startISO = new Date(`${date}T${startTime}:00`).toISOString();
    const endISO = new Date(`${date}T${endTime}:00`).toISOString();

    const payload: Record<string, unknown> = {
      title: title.trim(),
      start: startISO,
      end: endISO,
      location: location.trim() || null,
      all_day: false,
      recurrence: repeat === 'none' ? null : repeat,
      notes: notes.trim() || null,
      member_ids: selectedMembers,
    };

    try {
      if (isEdit && editEvent) {
        await updateEvent(slug, editEvent.id, payload, token);
      } else {
        await createEvent(slug, payload, token);
      }
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.message ?? 'Failed to save event');
    } finally {
      setSaving(false);
    }
  };

  // Backdrop tap closes
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  const memberColor = (m: WorkspaceUser) =>
    m.display_color ?? '#6366f1';

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40"
      onClick={handleBackdropClick}
    >
      <div className="w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <button
            onClick={onClose}
            className="text-gray-500 text-sm font-medium min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            Cancel
          </button>
          <h2 className="text-base font-semibold text-gray-900">
            {isEdit ? 'Edit Event' : 'New Event'}
          </h2>
          <button
            onClick={handleSave}
            disabled={saving}
            className="text-blue-600 text-sm font-semibold min-h-[44px] min-w-[44px] flex items-center justify-center disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>

        <div className="p-4 space-y-4">
          {error && (
            <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          {/* What */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">
              What?
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Event title"
              autoFocus
              className="w-full min-h-[48px] px-4 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>

          {/* Who */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">
              Who?
            </label>
            <div className="flex flex-wrap gap-2">
              {members.map((m) => {
                const selected = selectedMembers.includes(m.id);
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => toggleMember(m.id)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-full text-sm font-medium min-h-[44px] transition-colors border ${
                      selected
                        ? 'border-transparent text-white'
                        : 'border-gray-200 bg-white text-gray-700'
                    }`}
                    style={selected ? { backgroundColor: memberColor(m) } : undefined}
                  >
                    <span
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: memberColor(m) }}
                    />
                    {m.display_name ?? m.user?.name ?? 'Member'}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Date */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">
              Date
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full min-h-[48px] px-4 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>

          {/* Time row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">
                From
              </label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full min-h-[48px] px-4 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">
                To
              </label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full min-h-[48px] px-4 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
          </div>

          {/* Location */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">
              Where?
            </label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Location (optional)"
              className="w-full min-h-[48px] px-4 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>

          {/* Details / Notes */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">
              Details
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Address, instructions, things to remember..."
              rows={3}
              className="w-full min-h-[80px] px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
            />
          </div>

          {/* Repeat */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">
              Repeat
            </label>
            <select
              value={repeat}
              onChange={(e) => setRepeat(e.target.value)}
              className="w-full min-h-[48px] px-4 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-400 appearance-none"
            >
              <option value="none">Does not repeat</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>

          {/* Reminder */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">
              Reminder
            </label>
            <select
              value={reminder}
              onChange={(e) => setReminder(e.target.value)}
              className="w-full min-h-[48px] px-4 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-400 appearance-none"
            >
              <option value="none">No reminder</option>
              <option value="15min">15 minutes before</option>
              <option value="30min">30 minutes before</option>
              <option value="1hr">1 hour before</option>
              <option value="1day">1 day before</option>
            </select>
          </div>
        </div>

        {/* Bottom safe area spacer on mobile */}
        <div className="h-6 sm:h-4" />
      </div>
    </div>
  );
}
