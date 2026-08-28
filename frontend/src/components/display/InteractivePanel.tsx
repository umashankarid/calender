import { useState } from 'react';
import type { EventWithMembers } from '../../types';
import { useAuth } from '../../hooks/useAuth';
import { useWorkspace } from '../../hooks/useWorkspace';
import QuickAdd from '../interactive/QuickAdd';
import AddEventModal from '../interactive/AddEventModal';
import DisplayEventCard from './DisplayEventCard';

// ── Types ────────────────────────────────────────────────────────────────────

interface InteractivePanelProps {
  isOpen: boolean;
  onClose: () => void;
  slug: string;
  feed: EventWithMembers[];
  onEventSaved: () => void;
  /** If true, auto-start voice recognition when panel opens */
  startVoice?: boolean;
}

// ── Compact Login Form ───────────────────────────────────────────────────────

function PanelLoginForm() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setLoading(true);
    setError(null);
    try {
      await login(email.trim(), password);
    } catch (err: any) {
      setError(err.message ?? 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="px-4 py-6">
      <div className="text-center mb-4">
        <span className="text-3xl" role="img" aria-hidden="true">🔒</span>
        <h3 className="text-lg font-semibold text-white mt-2">Sign in to manage events</h3>
        <p className="text-sm text-gray-400 mt-1">
          Authentication required to add or edit events
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3 max-w-sm mx-auto">
        {error && (
          <div className="text-sm text-red-400 bg-red-900/30 rounded-lg px-3 py-2 text-center">
            {error}
          </div>
        )}

        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          autoComplete="email"
          className="w-full min-h-[48px] px-4 rounded-xl bg-gray-700 border border-gray-600 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          aria-label="Email address"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          autoComplete="current-password"
          className="w-full min-h-[48px] px-4 rounded-xl bg-gray-700 border border-gray-600 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          aria-label="Password"
        />
        <button
          type="submit"
          disabled={loading || !email.trim() || !password}
          className="w-full min-h-[48px] rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 transition-colors"
        >
          {loading ? 'Signing in…' : 'Sign In'}
        </button>
      </form>
    </div>
  );
}

// ── Main Panel Component ─────────────────────────────────────────────────────

export default function InteractivePanel({
  isOpen,
  onClose,
  slug,
  feed,
  onEventSaved,
  startVoice: _startVoice = false,
}: InteractivePanelProps) {
  const { token } = useAuth();
  const { members } = useWorkspace(slug);
  const [showAddModal, setShowAddModal] = useState(false);

  const isAuthenticated = !!token;

  const handleEventSaved = () => {
    onEventSaved();
    onClose();
  };

  const handleEventUpdated = () => {
    onEventSaved();
  };

  // Handle backdrop click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/60 transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={handleBackdropClick}
        aria-hidden={!isOpen}
      />

      {/* Slide-up panel */}
      <div
        className={`fixed inset-x-0 bottom-0 z-50 transition-transform duration-300 ease-out ${
          isOpen ? 'translate-y-0' : 'translate-y-full'
        }`}
        role="dialog"
        aria-modal="true"
        aria-label="Interactive event panel"
        aria-hidden={!isOpen}
      >
        <div className="bg-gray-800 rounded-t-2xl max-h-[60vh] flex flex-col shadow-2xl border-t border-gray-700">
          {/* Drag handle + close */}
          <div className="flex items-center justify-between px-4 pt-3 pb-2 flex-shrink-0">
            <div className="flex-1" />
            {/* Center drag handle */}
            <div className="w-10 h-1.5 bg-gray-600 rounded-full" aria-hidden="true" />
            <div className="flex-1 flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center text-gray-400 hover:text-white transition-colors rounded-full hover:bg-gray-700"
                aria-label="Close panel"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Panel body */}
          <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-4">
            {!isAuthenticated ? (
              <PanelLoginForm />
            ) : (
              <>
                {/* QuickAdd (dark themed overrides) */}
                <div className="bg-gray-750 rounded-xl border border-gray-700 overflow-hidden [&_input]:bg-gray-700 [&_input]:border-gray-600 [&_input]:text-white [&_input]:placeholder-gray-400 [&_.bg-gray-100]:bg-gray-700 [&_.border-gray-200]:border-gray-600 [&_.text-gray-800]:text-white [&_.text-gray-700]:text-gray-300 [&_.text-gray-400]:text-gray-400 [&_.bg-blue-50]:bg-blue-900/30 [&_.border-blue-200]:border-blue-800 [&_.text-blue-500]:text-blue-400 [&_.bg-white]:bg-gray-700 [&_.text-gray-600]:text-gray-300">
                  <QuickAdd
                    slug={slug}
                    onEventCreated={handleEventSaved}
                  />
                </div>

                {/* Add Event button */}
                <button
                  type="button"
                  onClick={() => setShowAddModal(true)}
                  className="w-full min-h-[52px] flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold text-base rounded-xl transition-colors"
                >
                  <span className="text-lg" aria-hidden="true">＋</span>
                  Add Event
                </button>

                {/* Today's events list */}
                {feed.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wide px-1">
                      Today&apos;s Events
                    </h3>
                    <div className="space-y-2">
                      {feed.map((event) => (
                        <DisplayEventCard
                          key={event.id}
                          slug={slug}
                          event={event}
                          members={members}
                          onUpdated={handleEventUpdated}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {feed.length === 0 && (
                  <div className="text-center py-6">
                    <p className="text-gray-500 text-sm">No events today</p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Add Event Modal */}
      {showAddModal && isAuthenticated && (
        <AddEventModal
          slug={slug}
          members={members}
          onClose={() => setShowAddModal(false)}
          onSaved={() => {
            setShowAddModal(false);
            handleEventSaved();
          }}
        />
      )}
    </>
  );
}
