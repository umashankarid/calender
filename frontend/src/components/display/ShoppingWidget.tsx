import type { ShoppingItem } from '../../types';

// ── Types ────────────────────────────────────────────────────────────────────

interface ShoppingWidgetProps {
  items: ShoppingItem[];
  onAddItem?: () => void;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function ShoppingWidget({ items, onAddItem }: ShoppingWidgetProps) {
  // Only show unbought items on the display
  const unbought = items.filter((i) => !i.is_bought);

  return (
    <div className="bg-gray-800 rounded-2xl p-6 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-white">
          🛒 SHOPPING LIST
        </h2>
        {onAddItem && (
          <button
            type="button"
            onClick={onAddItem}
            className="text-gray-400 hover:text-white text-sm transition-colors min-h-[44px] px-2 flex items-center"
            aria-label="Add shopping item"
          >
            + Add
          </button>
        )}
      </div>

      {/* Items */}
      {unbought.length === 0 ? (
        <p className="text-lg text-gray-400">Nothing to buy ✓</p>
      ) : (
        <ul className="space-y-2">
          {unbought.map((item) => (
            <li key={item.id} className="flex items-center gap-3 text-lg text-white">
              <span className="text-gray-500" aria-hidden="true">•</span>
              <span className="flex-1 truncate">{item.name}</span>
              {item.quantity && (
                <span className="text-sm text-gray-400 flex-shrink-0">
                  {item.quantity}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
