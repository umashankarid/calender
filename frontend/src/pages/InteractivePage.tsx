import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useWorkspace } from '../hooks/useWorkspace';
import { useEvents } from '../hooks/useEvents';
import { listDisplays } from '../api/display';
import BottomNav, { type TabKey } from '../components/interactive/BottomNav';
import FloatingAddButton from '../components/interactive/FloatingAddButton';
import TodayView from '../components/interactive/TodayView';
import CalendarView from '../components/interactive/CalendarView';
import AddEventModal from '../components/interactive/AddEventModal';
import ShoppingList from '../components/interactive/ShoppingList';
import type { Display } from '../types';

// ── Menu Item Component ──────────────────────────────────────────────────────

function MenuItem({
  icon,
  label,
  onClick,
  subtitle,
  danger,
}: {
  icon: string;
  label: string;
  onClick: () => void;
  subtitle?: string;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 min-h-[48px] py-3 text-left transition-colors active:bg-gray-50 ${
        danger ? 'text-red-600' : 'text-gray-900'
      }`}
    >
      <span className="text-lg flex-shrink-0" role="img" aria-hidden="true">
        {icon}
      </span>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${danger ? 'text-red-600' : 'text-gray-800'}`}>
          {label}
        </p>
        {subtitle && (
          <p className="text-xs text-gray-400 truncate">{subtitle}</p>
        )}
      </div>
      {!danger && (
        <svg
          className="h-4 w-4 text-gray-300 flex-shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      )}
    </button>
  );
}

// ── Menu Section Header ──────────────────────────────────────────────────────

function SectionHeader({ title }: { title: string }) {
  return (
    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-1 mb-2">
      {title}
    </h3>
  );
}

// ── Display Tab Content ──────────────────────────────────────────────────────

function DisplayTab({ slug }: { slug: string }) {
  const { token } = useAuth();
  const [displays, setDisplays] = useState<Display[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    listDisplays(slug, token)
      .then(setDisplays)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [slug, token]);

  const getDisplayUrl = (display: Display) =>
    `${window.location.origin}/${slug}/display?token=${display.token}`;

  const handleCopy = async (display: Display) => {
    try {
      await navigator.clipboard.writeText(getDisplayUrl(display));
      setCopiedId(display.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Fallback for older browsers
      const input = document.createElement('input');
      input.value = getDisplayUrl(display);
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopiedId(display.id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const openDisplay = (display: Display) => {
    window.open(getDisplayUrl(display), '_blank', 'noopener');
  };

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
      <div className="text-center py-2">
        <h2 className="text-lg font-bold text-gray-900">Display Mode</h2>
        <p className="text-sm text-gray-500 mt-1">
          Open your calendar on a TV or tablet
        </p>
      </div>

      {/* Open display button — prominent CTA */}
      <button
        onClick={() => window.open(`/${slug}/display`, '_blank', 'noopener')}
        className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white rounded-xl py-4 px-6 font-semibold text-base hover:bg-indigo-700 active:bg-indigo-800 transition min-h-[56px]"
      >
        <span className="text-xl" role="img" aria-hidden="true">📺</span>
        Open Display Mode
      </button>

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="h-6 w-6 animate-spin rounded-full border-3 border-indigo-600 border-t-transparent" />
        </div>
      ) : displays.length > 0 ? (
        <div className="space-y-3">
          <SectionHeader title="Paired Displays" />
          <div className="bg-white rounded-xl border border-gray-100 divide-y divide-gray-100">
            {displays.map((display) => (
              <div key={display.id} className="px-4 py-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-base" role="img" aria-hidden="true">📱</span>
                    <span className="text-sm font-medium text-gray-800">
                      {display.name}
                    </span>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    display.is_paired
                      ? 'bg-green-100 text-green-700'
                      : 'bg-yellow-100 text-yellow-700'
                  }`}>
                    {display.is_paired ? 'Paired' : 'Unpaired'}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => openDisplay(display)}
                    className="flex-1 text-xs text-indigo-600 bg-indigo-50 rounded-lg py-2 px-3 font-medium hover:bg-indigo-100 transition min-h-[40px]"
                  >
                    Open
                  </button>
                  <button
                    onClick={() => handleCopy(display)}
                    className="flex-1 text-xs text-gray-600 bg-gray-50 rounded-lg py-2 px-3 font-medium hover:bg-gray-100 transition min-h-[40px]"
                  >
                    {copiedId === display.id ? '✓ Copied!' : 'Copy URL'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 p-6 text-center">
          <p className="text-2xl mb-2" role="img" aria-hidden="true">📱</p>
          <p className="text-sm text-gray-500">
            No displays paired yet. Go to Menu → Pair Display to set up a TV or tablet.
          </p>
        </div>
      )}
    </div>
  );
}

// ── Menu Tab Content ─────────────────────────────────────────────────────────

function MenuTab({ slug }: { slug: string }) {
  const { user, token, logout } = useAuth();
  const { workspace } = useWorkspace(slug);
  const navigate = useNavigate();
  const [displays, setDisplays] = useState<Display[]>([]);
  const [copiedUrl, setCopiedUrl] = useState(false);

  useEffect(() => {
    if (!token) return;
    listDisplays(slug, token)
      .then(setDisplays)
      .catch(() => {});
  }, [slug, token]);

  const displayUrl = displays.length > 0
    ? `${window.location.origin}/${slug}/display?token=${displays[0].token}`
    : `${window.location.origin}/${slug}/display`;

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(displayUrl);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    } catch {
      const input = document.createElement('input');
      input.value = displayUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${workspace?.name ?? 'Calendar'} Display`,
          text: 'View the family calendar display',
          url: displayUrl,
        });
      } catch {
        // User cancelled or share failed — copy instead
        handleCopyUrl();
      }
    } else {
      handleCopyUrl();
    }
  };

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
      {/* Workspace Section */}
      <div>
        <SectionHeader title="Workspace" />
        <div className="bg-white rounded-xl border border-gray-100 divide-y divide-gray-100">
          <MenuItem
            icon="📺"
            label="Display Mode"
            subtitle="Open calendar on a TV or tablet"
            onClick={() => window.open(`/${slug}/display`, '_blank', 'noopener')}
          />
          <MenuItem
            icon="👥"
            label="Manage Members"
            subtitle="Add or remove family members"
            onClick={() => navigate(`/${slug}/admin?tab=members`)}
          />
          <MenuItem
            icon="📅"
            label="Manage Calendars"
            subtitle="Create and configure calendars"
            onClick={() => navigate(`/${slug}/admin?tab=calendars`)}
          />
          <MenuItem
            icon="📱"
            label="Pair Display"
            subtitle="Set up a new TV or tablet"
            onClick={() => navigate(`/${slug}/admin?tab=displays`)}
          />
          <MenuItem
            icon="⚙️"
            label="Workspace Settings"
            subtitle={workspace?.name ?? ''}
            onClick={() => navigate(`/${slug}/admin?tab=settings`)}
          />
        </div>
      </div>

      {/* Account Section */}
      <div>
        <SectionHeader title="Account" />
        <div className="bg-white rounded-xl border border-gray-100 divide-y divide-gray-100">
          {user && (
            <div className="px-4 py-3 min-h-[48px] flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-sm flex-shrink-0">
                {user.name[0]?.toUpperCase() ?? '?'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{user.name}</p>
                <p className="text-xs text-gray-400 truncate">{user.email}</p>
              </div>
            </div>
          )}
          <MenuItem
            icon="🚪"
            label="Sign Out"
            danger
            onClick={() => {
              logout();
              navigate('/');
            }}
          />
        </div>
      </div>

      {/* Quick Links Section */}
      <div>
        <SectionHeader title="Quick Links" />
        <div className="bg-white rounded-xl border border-gray-100 divide-y divide-gray-100">
          <MenuItem
            icon="🔗"
            label={copiedUrl ? 'Copied!' : 'Display URL'}
            subtitle="Tap to copy link"
            onClick={handleCopyUrl}
          />
          <MenuItem
            icon="📋"
            label="Share Display Link"
            subtitle="Send to a device or person"
            onClick={handleShare}
          />
        </div>
      </div>

      {/* Bottom spacing for safe area */}
      <div className="h-4" />
    </div>
  );
}

// ── Component ────────────────────────────────────────────────────────────────

export default function InteractivePage() {
  const { slug } = useParams<{ slug: string }>();
  const { user, loading: authLoading } = useAuth();
  const { workspace, members, loading: wsLoading } = useWorkspace(slug);
  const { events, loading: eventsLoading, refetch: refetchEvents } = useEvents(slug);

  const [activeTab, setActiveTab] = useState<TabKey>('today');
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [_addType, setAddType] = useState<'event' | 'reminder' | 'announcement' | 'shopping'>('event');
  const [shoppingAutoFocus, setShoppingAutoFocus] = useState(false);

  const loading = authLoading || wsLoading;

  // Handle FAB selection
  const handleAddSelect = (type: 'event' | 'reminder' | 'announcement' | 'shopping') => {
    if (type === 'shopping') {
      setActiveTab('shopping');
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

  // Hide FAB on display and menu tabs
  const showFab = activeTab !== 'display' && activeTab !== 'menu';

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

        {activeTab === 'shopping' && (
          <ShoppingList
            slug={slug!}
            autoFocusAdd={shoppingAutoFocus}
          />
        )}

        {activeTab === 'display' && (
          <DisplayTab slug={slug!} />
        )}

        {activeTab === 'menu' && (
          <MenuTab slug={slug!} />
        )}
      </main>

      {/* Floating add button — hidden on display/menu */}
      {showFab && <FloatingAddButton onSelect={handleAddSelect} />}

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
