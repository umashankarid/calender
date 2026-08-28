import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useWorkspace } from '../hooks/useWorkspace';
import { useEvents } from '../hooks/useEvents';
import BottomNav, { type TabKey } from '../components/interactive/BottomNav';
import FloatingAddButton from '../components/interactive/FloatingAddButton';
import TodayView from '../components/interactive/TodayView';
import CalendarView from '../components/interactive/CalendarView';
import AddEventModal from '../components/interactive/AddEventModal';
import ShoppingList from '../components/interactive/ShoppingList';

// ── Component ────────────────────────────────────────────────────────────────

export default function InteractivePage() {
  const { slug } = useParams<{ slug: string }>();
  const { user, loading: authLoading } = useAuth();
  const { workspace, members, calendars, loading: wsLoading } = useWorkspace(slug);
  const { events, loading: eventsLoading, refetch: refetchEvents } = useEvents(slug);

  const [activeTab, setActiveTab] = useState<TabKey>('today');
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [_addType, setAddType] = useState<'event' | 'reminder' | 'announcement' | 'shopping'>('event');
  const [shoppingAutoFocus, setShoppingAutoFocus] = useState(false);

  const loading = authLoading || wsLoading;

  // Handle FAB selection
  const handleAddSelect = (type: 'event' | 'reminder' | 'announcement' | 'shopping') => {
    if (type === 'shopping') {
      setActiveTab('tasks');
      setShoppingAutoFocus(true);
      return;
    }
    setAddType(type);
    setShowAddEvent(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-500">Loading workspace…</p>
        </div>
      </div>
    );
  }

  if (!workspace) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center px-6">
          <div className="text-5xl mb-4" role="img" aria-hidden="true">😕</div>
          <h1 className="text-lg font-bold text-gray-900 mb-1">
            Workspace not found
          </h1>
          <p className="text-sm text-gray-500">
            The workspace "{slug}" doesn't exist or you don't have access.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <header className="flex-shrink-0 bg-white border-b border-gray-100 px-4 py-3 safe-area-top">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-base font-bold text-gray-900">
              {workspace.name}
            </h1>
            {user && (
              <p className="text-xs text-gray-400">
                Hi, {user.name}
              </p>
            )}
          </div>
          {eventsLoading && (
            <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
          )}
        </div>
      </header>

      {/* Main content area */}
      <main className="flex-1 flex flex-col min-h-0 pb-14">
        {activeTab === 'today' && (
          <TodayView
            slug={slug!}
            events={events}
            members={members}
            onRefresh={refetchEvents}
          />
        )}

        {activeTab === 'calendar' && (
          <CalendarView
            slug={slug!}
            events={events}
            members={members}
            onRefresh={refetchEvents}
          />
        )}

        {activeTab === 'tasks' && (
          <ShoppingList
            slug={slug!}
            autoFocusAdd={shoppingAutoFocus}
          />
        )}

        {activeTab === 'more' && (
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            <h2 className="text-lg font-bold text-gray-900 mb-3">Settings</h2>

            <div className="bg-white rounded-xl border border-gray-100 divide-y divide-gray-100">
              <div className="px-4 py-3">
                <p className="text-sm font-medium text-gray-800">Workspace</p>
                <p className="text-xs text-gray-400">{workspace.name}</p>
              </div>
              <div className="px-4 py-3">
                <p className="text-sm font-medium text-gray-800">Timezone</p>
                <p className="text-xs text-gray-400">{workspace.timezone}</p>
              </div>
              <div className="px-4 py-3">
                <p className="text-sm font-medium text-gray-800">Members</p>
                <p className="text-xs text-gray-400">
                  {members.length} member{members.length !== 1 ? 's' : ''}
                </p>
              </div>
              <div className="px-4 py-3">
                <p className="text-sm font-medium text-gray-800">Calendars</p>
                <p className="text-xs text-gray-400">
                  {calendars.length} calendar{calendars.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>

            {/* Member list */}
            <div>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-1">
                Family Members
              </h3>
              <div className="bg-white rounded-xl border border-gray-100 divide-y divide-gray-100">
                {members.map((m) => (
                  <div key={m.id} className="flex items-center gap-3 px-4 py-3">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                      style={{ backgroundColor: m.display_color ?? '#6366f1' }}
                    >
                      {(m.display_name ?? m.user?.name ?? 'M')[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">
                        {m.display_name ?? m.user?.name ?? 'Member'}
                      </p>
                      <p className="text-xs text-gray-400 capitalize">{m.role}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Floating add button */}
      <FloatingAddButton onSelect={handleAddSelect} />

      {/* Bottom navigation */}
      <BottomNav active={activeTab} onChange={setActiveTab} />

      {/* Add event modal */}
      {showAddEvent && (
        <AddEventModal
          slug={slug!}
          members={members}
          onClose={() => setShowAddEvent(false)}
          onSaved={() => {
            setShowAddEvent(false);
            refetchEvents();
          }}
        />
      )}
    </div>
  );
}
