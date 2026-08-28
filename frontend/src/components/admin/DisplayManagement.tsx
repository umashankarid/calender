import { useState, useEffect, useCallback } from 'react';
import type { Display } from '../../types';
import { listDisplays, createDisplay } from '../../api/display';
import { useAuth } from '../../hooks/useAuth';
import PairingScreen from './PairingScreen';

interface Props {
  slug: string;
}

type WidgetType =
  | 'calendar'
  | 'upcoming'
  | 'announcements'
  | 'weather'
  | 'tasks'
  | 'reminders'
  | 'clock'
  | 'photos'
  | 'qr';

const ALL_WIDGET_TYPES: { type: WidgetType; label: string; icon: string }[] = [
  { type: 'calendar', label: 'Calendar', icon: '📅' },
  { type: 'upcoming', label: 'Upcoming', icon: '⏰' },
  { type: 'announcements', label: 'Announcements', icon: '📢' },
  { type: 'weather', label: 'Weather', icon: '🌤' },
  { type: 'tasks', label: 'Tasks', icon: '✅' },
  { type: 'reminders', label: 'Reminders', icon: '🔔' },
  { type: 'clock', label: 'Clock', icon: '🕐' },
  { type: 'photos', label: 'Photos', icon: '📷' },
  { type: 'qr', label: 'QR Code', icon: '📱' },
];

export default function DisplayManagement({ slug }: Props) {
  const { token } = useAuth();
  const [displays, setDisplays] = useState<Display[]>([]);
  const [loading, setLoading] = useState(true);

  // Create display
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Pairing
  const [pairingDisplay, setPairingDisplay] = useState<Display | null>(null);

  // Widget editor
  const [editingDisplayId, setEditingDisplayId] = useState<string | null>(null);
  const [widgetLayout, setWidgetLayout] = useState<WidgetType[]>([]);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const fetchDisplays = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await listDisplays(slug, token);
      setDisplays(data);
    } catch (err) {
      console.error('Failed to load displays', err);
    } finally {
      setLoading(false);
    }
  }, [slug, token]);

  useEffect(() => {
    fetchDisplays();
  }, [fetchDisplays]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setCreating(true);
    setCreateError(null);
    try {
      const display = await createDisplay(slug, { name: newName }, token);
      setNewName('');
      setShowCreateForm(false);
      // Show pairing screen immediately for new displays
      setPairingDisplay(display);
      await fetchDisplays();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create display');
    } finally {
      setCreating(false);
    }
  }

  function startWidgetEditor(display: Display) {
    setEditingDisplayId(display.id);
    // Parse existing layout or use defaults
    try {
      const layoutData = display.layout;
      if (layoutData && Array.isArray(layoutData)) {
        setWidgetLayout(layoutData as WidgetType[]);
      } else {
        setWidgetLayout(['calendar', 'upcoming', 'announcements']);
      }
    } catch {
      setWidgetLayout(['calendar', 'upcoming', 'announcements']);
    }
  }

  function addWidget(type: WidgetType) {
    if (!widgetLayout.includes(type)) {
      setWidgetLayout([...widgetLayout, type]);
    }
  }

  function removeWidget(index: number) {
    setWidgetLayout(widgetLayout.filter((_, i) => i !== index));
  }

  function handleDragStart(index: number) {
    setDragIndex(index);
  }

  function handleDragOver(e: React.DragEvent, index: number) {
    e.preventDefault();
    if (dragIndex === null || dragIndex === index) return;
    const newLayout = [...widgetLayout];
    const [moved] = newLayout.splice(dragIndex, 1);
    newLayout.splice(index, 0, moved);
    setWidgetLayout(newLayout);
    setDragIndex(index);
  }

  function handleDragEnd() {
    setDragIndex(null);
  }

  const pairedDisplays = displays.filter((d) => d.is_paired && !d.pairing_code);
  const unpaired = displays.filter((d) => !d.is_paired || d.pairing_code);

  if (pairingDisplay) {
    return (
      <PairingScreen
        slug={slug}
        display={pairingDisplay}
        onPaired={() => {
          setPairingDisplay(null);
          fetchDisplays();
        }}
        onClose={() => {
          setPairingDisplay(null);
          fetchDisplays();
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Displays</h2>
          <p className="text-sm text-gray-500 mt-1">Manage display devices and their widget layouts.</p>
        </div>
        {!showCreateForm && (
          <button
            type="button"
            onClick={() => setShowCreateForm(true)}
            className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors"
          >
            + Register Display
          </button>
        )}
      </div>

      {/* Create Display Form */}
      {showCreateForm && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">Register New Display</h3>
          <form onSubmit={handleCreate} className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <label htmlFor="display-name" className="sr-only">Display Name</label>
              <input
                id="display-name"
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder='e.g., Kitchen Display, Office TV'
                required
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            <button
              type="submit"
              disabled={creating}
              className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors whitespace-nowrap"
            >
              {creating ? 'Creating…' : 'Create & Pair'}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowCreateForm(false);
                setCreateError(null);
              }}
              className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
          </form>
          {createError && <p className="mt-2 text-sm text-red-600">{createError}</p>}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
        </div>
      ) : (
        <>
          {/* Paired Displays */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                Paired Displays ({pairedDisplays.length})
              </h3>
            </div>

            {pairedDisplays.length === 0 ? (
              <div className="px-6 py-8 text-center">
                <p className="text-sm text-gray-400">No paired displays yet.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {pairedDisplays.map((display) => (
                  <div key={display.id} className="px-6 py-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-green-50 flex items-center justify-center">
                          <svg className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-900">{display.name}</div>
                          <div className="text-xs text-gray-400">
                            Connected · Last seen {new Date(display.created_at).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 px-2 py-1 rounded-full">
                          <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                          Active
                        </span>
                        <button
                          type="button"
                          onClick={() => startWidgetEditor(display)}
                          className="px-3 py-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors"
                        >
                          Edit Layout
                        </button>
                      </div>
                    </div>

                    {/* Layout Preview */}
                    {(() => {
                      let layoutWidgets: string[] = [];
                      try {
                        const layoutData = display.layout;
                        if (layoutData && Array.isArray(layoutData)) {
                          layoutWidgets = layoutData as string[];
                        }
                      } catch {
                        layoutWidgets = [];
                      }
                      if (layoutWidgets.length === 0) return null;
                      return (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {layoutWidgets.map((w, i) => (
                            <span key={i} className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                              {w}
                            </span>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Unpaired / Pending Displays */}
          {unpaired.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
              <div className="px-6 py-4 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                  Awaiting Pairing ({unpaired.length})
                </h3>
              </div>
              <div className="divide-y divide-gray-100">
                {unpaired.map((display) => (
                  <div key={display.id} className="px-6 py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-amber-50 flex items-center justify-center">
                          <svg className="h-5 w-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-900">{display.name}</div>
                          <div className="text-xs text-gray-400">
                            Pairing code:{' '}
                            <span className="font-mono font-medium text-gray-600">
                              {display.pairing_code
                                ? `${display.pairing_code.slice(0, 3)} ${display.pairing_code.slice(3)}`
                                : '—'}
                            </span>
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setPairingDisplay(display)}
                        className="px-3 py-1.5 text-xs font-medium text-amber-700 bg-amber-50 rounded-lg hover:bg-amber-100 transition-colors"
                      >
                        Show Pairing Code
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {displays.length === 0 && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-6 py-12 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gray-100">
                <svg className="h-7 w-7 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-sm font-medium text-gray-900 mb-1">No displays registered</h3>
              <p className="text-sm text-gray-400">Register a display to show your calendar on a TV or tablet.</p>
            </div>
          )}
        </>
      )}

      {/* Widget Layout Editor Modal */}
      {editingDisplayId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50" onClick={() => setEditingDisplayId(null)} />
          <div className="relative bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Widget Layout</h3>
                <p className="text-sm text-gray-500 mt-0.5">Drag to reorder. Add or remove widgets.</p>
              </div>
              <button
                type="button"
                onClick={() => setEditingDisplayId(null)}
                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Current Layout */}
            <div className="mb-6">
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Active Widgets</h4>
              {widgetLayout.length === 0 ? (
                <p className="text-sm text-gray-400 py-4 text-center border-2 border-dashed border-gray-200 rounded-lg">
                  No widgets added. Choose from below.
                </p>
              ) : (
                <div className="space-y-2">
                  {widgetLayout.map((widgetType, index) => {
                    const widget = ALL_WIDGET_TYPES.find((w) => w.type === widgetType);
                    return (
                      <div
                        key={`${widgetType}-${index}`}
                        draggable
                        onDragStart={() => handleDragStart(index)}
                        onDragOver={(e) => handleDragOver(e, index)}
                        onDragEnd={handleDragEnd}
                        className={`flex items-center justify-between px-3 py-2.5 rounded-lg border bg-gray-50 cursor-grab active:cursor-grabbing transition-all ${
                          dragIndex === index ? 'border-indigo-300 bg-indigo-50 shadow-sm' : 'border-gray-200'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <svg className="h-4 w-4 text-gray-300" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M7 2a2 2 0 10.001 4.001A2 2 0 007 2zm0 6a2 2 0 10.001 4.001A2 2 0 007 8zm0 6a2 2 0 10.001 4.001A2 2 0 007 14zm6-8a2 2 0 10-.001-4.001A2 2 0 0013 6zm0 2a2 2 0 10.001 4.001A2 2 0 0013 8zm0 6a2 2 0 10.001 4.001A2 2 0 0013 14z" />
                          </svg>
                          <span className="text-base">{widget?.icon}</span>
                          <span className="text-sm font-medium text-gray-700">{widget?.label || widgetType}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeWidget(index)}
                          className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                          title="Remove widget"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Available Widgets */}
            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Available Widgets</h4>
              <div className="grid grid-cols-3 gap-2">
                {ALL_WIDGET_TYPES.filter((w) => !widgetLayout.includes(w.type)).map((widget) => (
                  <button
                    key={widget.type}
                    type="button"
                    onClick={() => addWidget(widget.type)}
                    className="flex flex-col items-center gap-1.5 p-3 rounded-lg border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 transition-colors"
                  >
                    <span className="text-xl">{widget.icon}</span>
                    <span className="text-xs font-medium text-gray-600">{widget.label}</span>
                  </button>
                ))}
              </div>
              {ALL_WIDGET_TYPES.every((w) => widgetLayout.includes(w.type)) && (
                <p className="text-sm text-gray-400 text-center py-3">All widgets added.</p>
              )}
            </div>

            {/* Save */}
            <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setEditingDisplayId(null)}
                className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  // Note: Would call updateDisplay API when available
                  // For now, just close the editor
                  setEditingDisplayId(null);
                }}
                className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
              >
                Save Layout
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
