import { useState } from 'react';
import type { Calendar } from '../../types';
import { createCalendar } from '../../api/calendars';
import { useAuth } from '../../hooks/useAuth';

interface Props {
  slug: string;
  calendars: Calendar[];
  onChanged: () => void;
}

const PRESET_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899',
];

export default function CalendarManagement({ slug, calendars, onChanged }: Props) {
  const { token } = useAuth();

  // Add form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#3b82f6');
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');

  // Delete confirmation
  const [deletingCalendar, setDeletingCalendar] = useState<Calendar | null>(null);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setAdding(true);
    setAddError(null);
    try {
      await createCalendar(slug, { name: newName, color: newColor }, token);
      setNewName('');
      setNewColor('#3b82f6');
      setShowAddForm(false);
      onChanged();
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Failed to create calendar');
    } finally {
      setAdding(false);
    }
  }

  function startEditing(cal: Calendar) {
    setEditingId(cal.id);
    setEditName(cal.name);
    setEditColor(cal.color);
  }

  function cancelEditing() {
    setEditingId(null);
  }

  function handleEditSave(_calId: string) {
    // Note: The current API doesn't expose updateCalendar/deleteCalendar.
    // This would call updateCalendar when available.
    // For now, just close the edit form.
    cancelEditing();
  }

  function handleDelete(_cal: Calendar) {
    // Note: The current API doesn't expose deleteCalendar.
    // This would call deleteCalendar when available.
    setDeletingCalendar(null);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Calendars</h2>
          <p className="text-sm text-gray-500 mt-1">Manage calendars for this workspace.</p>
        </div>
        {!showAddForm && (
          <button
            type="button"
            onClick={() => setShowAddForm(true)}
            className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors"
          >
            + Add Calendar
          </button>
        )}
      </div>

      {/* Add Calendar Form */}
      {showAddForm && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">New Calendar</h3>
          <form onSubmit={handleAdd} className="space-y-4">
            <div>
              <label htmlFor="cal-name" className="block text-sm font-medium text-gray-700 mb-1">
                Calendar Name
              </label>
              <input
                id="cal-name"
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g., Work, Personal, Holidays"
                required
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Color</label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={newColor}
                  onChange={(e) => setNewColor(e.target.value)}
                  className="h-9 w-9 rounded border border-gray-300 cursor-pointer p-0.5"
                />
                <div className="flex gap-1.5 flex-wrap">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setNewColor(c)}
                      className={`h-7 w-7 rounded-full border-2 transition-all ${newColor === c ? 'border-gray-800 scale-110' : 'border-transparent hover:border-gray-300'}`}
                      style={{ backgroundColor: c }}
                      title={c}
                    />
                  ))}
                </div>
              </div>
            </div>
            {addError && <p className="text-sm text-red-600">{addError}</p>}
            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                disabled={adding}
                className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {adding ? 'Creating…' : 'Create Calendar'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAddForm(false);
                  setAddError(null);
                }}
                className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Calendar List */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm divide-y divide-gray-100">
        <div className="px-6 py-4">
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
            {calendars.length} Calendar{calendars.length !== 1 ? 's' : ''}
          </h3>
        </div>

        {calendars.length === 0 ? (
          <div className="px-6 py-8 text-center">
            <p className="text-sm text-gray-400">No calendars yet. Create one above.</p>
          </div>
        ) : (
          calendars.map((cal) => (
            <div key={cal.id} className="px-6 py-4">
              {editingId === cal.id ? (
                /* Edit Mode */
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label htmlFor={`edit-cal-name-${cal.id}`} className="block text-xs font-medium text-gray-500 mb-1">
                        Name
                      </label>
                      <input
                        id={`edit-cal-name-${cal.id}`}
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Color</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={editColor}
                          onChange={(e) => setEditColor(e.target.value)}
                          className="h-9 w-9 rounded border border-gray-300 cursor-pointer p-0.5"
                        />
                        <div className="flex gap-1">
                          {PRESET_COLORS.map((c) => (
                            <button
                              key={c}
                              type="button"
                              onClick={() => setEditColor(c)}
                              className={`h-6 w-6 rounded-full border-2 transition-all ${editColor === c ? 'border-gray-800 scale-110' : 'border-transparent hover:border-gray-300'}`}
                              style={{ backgroundColor: c }}
                              title={c}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleEditSave(cal.id)}
                      className="px-3 py-1.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={cancelEditing}
                      className="px-3 py-1.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                /* View Mode */
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="h-4 w-4 rounded-full flex-shrink-0"
                      style={{ backgroundColor: cal.color }}
                    />
                    <div>
                      <span className="text-sm font-medium text-gray-900">{cal.name}</span>
                      {cal.is_default && (
                        <span className="ml-2 text-xs text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                          default
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => startEditing(cal)}
                      className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                      title="Edit calendar"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </button>
                    {!cal.is_default && (
                      <button
                        type="button"
                        onClick={() => setDeletingCalendar(cal)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete calendar"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deletingCalendar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50" onClick={() => setDeletingCalendar(null)} />
          <div className="relative bg-white rounded-2xl shadow-xl max-w-sm w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Calendar</h3>
            <p className="text-sm text-gray-600 mb-1">
              Are you sure you want to delete{' '}
              <span className="font-medium text-gray-900">{deletingCalendar.name}</span>?
            </p>
            <p className="text-xs text-gray-400 mb-6">All events in this calendar will be permanently removed.</p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeletingCalendar(null)}
                className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDelete(deletingCalendar)}
                className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
