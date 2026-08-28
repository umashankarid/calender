import { useState, useRef, useEffect } from 'react';

// ── Types ────────────────────────────────────────────────────────────────────

type AddType = 'event' | 'reminder' | 'announcement';

interface FloatingAddButtonProps {
  onSelect: (type: AddType) => void;
}

// ── Menu options ─────────────────────────────────────────────────────────────

const OPTIONS: { key: AddType; label: string; icon: string }[] = [
  { key: 'event', label: 'Event', icon: '📅' },
  { key: 'reminder', label: 'Reminder', icon: '🔔' },
  { key: 'announcement', label: 'Announcement', icon: '📢' },
];

// ── Component ────────────────────────────────────────────────────────────────

export default function FloatingAddButton({ onSelect }: FloatingAddButtonProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside tap
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, [open]);

  const handleSelect = (type: AddType) => {
    setOpen(false);
    onSelect(type);
  };

  return (
    <div ref={menuRef} className="fixed z-50 right-4" style={{ bottom: 56 + 16 }}>
      {/* Popover menu */}
      {open && (
        <div className="absolute bottom-16 right-0 mb-2 bg-white rounded-2xl shadow-xl border border-gray-100 py-2 min-w-[180px] animate-in slide-in-from-bottom-2">
          {OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => handleSelect(opt.key)}
              className="w-full flex items-center gap-3 px-4 py-3 text-left text-gray-700 hover:bg-gray-50 active:bg-gray-100 transition-colors min-h-[44px]"
            >
              <span className="text-lg" role="img" aria-hidden="true">
                {opt.icon}
              </span>
              <span className="text-sm font-medium">{opt.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* FAB */}
      <button
        onClick={() => setOpen((prev) => !prev)}
        aria-label="Add new item"
        aria-expanded={open}
        className={`flex items-center justify-center w-14 h-14 rounded-full bg-blue-600 text-white shadow-lg hover:bg-blue-700 active:bg-blue-800 transition-all focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-300 ${
          open ? 'rotate-45' : ''
        }`}
      >
        <svg
          className="w-7 h-7 transition-transform"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14m-7-7h14" />
        </svg>
      </button>
    </div>
  );
}
