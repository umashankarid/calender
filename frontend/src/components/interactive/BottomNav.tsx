// ── Types ────────────────────────────────────────────────────────────────────

export type TabKey = 'today' | 'calendar' | 'shopping' | 'display' | 'menu';

interface BottomNavProps {
  active: TabKey;
  onChange: (tab: TabKey) => void;
}

// ── Tab config ───────────────────────────────────────────────────────────────

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: 'today', label: 'Today', icon: '🏠' },
  { key: 'calendar', label: 'Calendar', icon: '📅' },
  { key: 'shopping', label: 'Shopping', icon: '🛒' },
  { key: 'display', label: 'Display', icon: '📺' },
  { key: 'menu', label: 'Menu', icon: '⚙️' },
];

// ── Component ────────────────────────────────────────────────────────────────

export default function BottomNav({ active, onChange }: BottomNavProps) {
  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-40 bg-white border-t border-gray-200 safe-area-bottom"
      style={{ height: 56 }}
      aria-label="Main navigation"
    >
      <div className="flex items-stretch h-full max-w-lg mx-auto">
        {TABS.map((tab) => {
          const isActive = active === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => onChange(tab.key)}
              aria-current={isActive ? 'page' : undefined}
              className={`flex-1 flex flex-col items-center justify-center min-h-[48px] gap-0.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 relative ${
                isActive
                  ? 'text-blue-600'
                  : 'text-gray-500 active:bg-gray-50'
              }`}
            >
              <span className="text-lg leading-none" role="img" aria-hidden="true">
                {tab.icon}
              </span>
              <span
                className={`text-[10px] font-medium ${
                  isActive ? 'text-blue-600' : 'text-gray-500'
                }`}
              >
                {tab.label}
              </span>
              {isActive && (
                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-blue-600 rounded-full" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
