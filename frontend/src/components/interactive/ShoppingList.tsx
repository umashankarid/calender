import { useState, useEffect, useCallback, useRef } from 'react';
import type { ShoppingItem, VoiceIntent } from '../../types';
import { useAuth } from '../../hooks/useAuth';
import { apiPost } from '../../api/client';
import {
  listShoppingItems,
  addShoppingItem,
  toggleShoppingItem,
  deleteShoppingItem,
  clearBoughtItems,
} from '../../api/shopping';
import VoiceButton from './VoiceButton';

// ── Category config ──────────────────────────────────────────────────────────

const CATEGORY_TAGS: Record<string, { emoji: string; bg: string; text: string }> = {
  dairy:      { emoji: '🥛', bg: 'bg-blue-100',   text: 'text-blue-700' },
  bakery:     { emoji: '🍞', bg: 'bg-amber-100',  text: 'text-amber-700' },
  vegetables: { emoji: '🥬', bg: 'bg-green-100',  text: 'text-green-700' },
  fruits:     { emoji: '🍎', bg: 'bg-red-100',    text: 'text-red-700' },
  meat:       { emoji: '🥩', bg: 'bg-rose-100',   text: 'text-rose-700' },
  household:  { emoji: '🧹', bg: 'bg-purple-100', text: 'text-purple-700' },
  other:      { emoji: '📦', bg: 'bg-gray-100',   text: 'text-gray-700' },
};

function CategoryTag({ category }: { category: string | null }) {
  if (!category) return null;
  const cfg = CATEGORY_TAGS[category.toLowerCase()] ?? CATEGORY_TAGS.other;
  return (
    <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium ${cfg.bg} ${cfg.text}`}>
      {cfg.emoji} {category}
    </span>
  );
}

// ── Parse quick-add text ─────────────────────────────────────────────────────

function parseQuickAdd(input: string): { name: string; quantity?: string } {
  const trimmed = input.trim();
  if (!trimmed) return { name: '' };

  // Match trailing number or quantity like "Milk 2" or "Eggs 12"
  const match = trimmed.match(/^(.+?)\s+(\d+(?:\.\d+)?(?:\s*(?:kg|g|l|ml|pcs|packs?|bottles?|cans?|boxes?))?)$/i);
  if (match) {
    return { name: match[1].trim(), quantity: match[2].trim() };
  }
  return { name: trimmed };
}

// ── Swipeable item ───────────────────────────────────────────────────────────

interface SwipeableItemProps {
  item: ShoppingItem;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
}

function SwipeableItem({ item, onToggle, onDelete }: SwipeableItemProps) {
  const [offsetX, setOffsetX] = useState(0);
  const [swiping, setSwiping] = useState(false);
  const startXRef = useRef(0);
  const currentXRef = useRef(0);

  const handleTouchStart = (e: React.TouchEvent) => {
    startXRef.current = e.touches[0].clientX;
    currentXRef.current = 0;
    setSwiping(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!swiping) return;
    const diff = e.touches[0].clientX - startXRef.current;
    // Only allow swipe left
    currentXRef.current = Math.min(0, diff);
    setOffsetX(currentXRef.current);
  };

  const handleTouchEnd = () => {
    setSwiping(false);
    if (currentXRef.current < -80) {
      // Swiped enough — show delete
      setOffsetX(-80);
    } else {
      setOffsetX(0);
    }
  };

  return (
    <div className="relative overflow-hidden rounded-xl">
      {/* Delete button behind */}
      <div className="absolute inset-y-0 right-0 flex items-center">
        <button
          type="button"
          onClick={() => onDelete(item.id)}
          className="h-full w-20 bg-red-500 text-white flex items-center justify-center text-sm font-medium"
          aria-label={`Delete ${item.name}`}
        >
          Delete
        </button>
      </div>

      {/* Item content */}
      <div
        className={`relative bg-white flex items-center gap-3 px-3 min-h-[48px] transition-transform ${
          swiping ? '' : 'duration-200'
        }`}
        style={{ transform: `translateX(${offsetX}px)` }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Checkbox */}
        <button
          type="button"
          onClick={() => onToggle(item.id)}
          className={`flex-shrink-0 w-[44px] h-[44px] flex items-center justify-center rounded-lg transition-colors ${
            item.is_bought
              ? 'text-green-500'
              : 'text-gray-300 hover:text-gray-400'
          }`}
          aria-label={item.is_bought ? `Mark ${item.name} as not bought` : `Mark ${item.name} as bought`}
        >
          {item.is_bought ? (
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
            </svg>
          ) : (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <rect x="3" y="3" width="18" height="18" rx="4" />
            </svg>
          )}
        </button>

        {/* Name & details */}
        <div className={`flex-1 min-w-0 py-2 ${item.is_bought ? 'opacity-50' : ''}`}>
          <div className="flex items-center gap-2">
            <span
              className={`text-sm font-medium truncate ${
                item.is_bought ? 'line-through text-gray-400' : 'text-gray-800'
              }`}
            >
              {item.name}
            </span>
            {item.quantity && (
              <span className="flex-shrink-0 inline-flex items-center px-1.5 py-0.5 rounded bg-gray-100 text-[11px] font-semibold text-gray-600">
                {item.quantity}
              </span>
            )}
          </div>
          {item.category && (
            <div className="mt-0.5">
              <CategoryTag category={item.category} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Shopping List Component ─────────────────────────────────────────────

interface ShoppingListProps {
  slug: string;
  /** If provided, auto-focus the add input */
  autoFocusAdd?: boolean;
}

export default function ShoppingList({ slug, autoFocusAdd = false }: ShoppingListProps) {
  const { token } = useAuth();
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [addText, setAddText] = useState('');
  const [adding, setAdding] = useState(false);
  const [partial, setPartial] = useState('');
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // ── Fetch items ─────────────────────────────────────────────────────────

  const fetchItems = useCallback(async () => {
    if (!token) return;
    try {
      const data = await listShoppingItems(slug, token);
      setItems(data);
      setError(null);
    } catch (err: any) {
      setError(err.message ?? 'Failed to load shopping list');
    } finally {
      setLoading(false);
    }
  }, [slug, token]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  // Auto-refresh every 15 seconds
  useEffect(() => {
    if (!token) return;
    const id = setInterval(fetchItems, 15_000);
    return () => clearInterval(id);
  }, [fetchItems, token]);

  // Auto-focus add input
  useEffect(() => {
    if (autoFocusAdd && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocusAdd]);

  // ── Add item ────────────────────────────────────────────────────────────

  const handleAdd = async () => {
    if (!addText.trim() || !token) return;
    setAdding(true);
    setError(null);
    try {
      const { name, quantity } = parseQuickAdd(addText);
      if (!name) return;
      await addShoppingItem(slug, { name, quantity }, token);
      setAddText('');
      await fetchItems();
    } catch (err: any) {
      setError(err.message ?? 'Failed to add item');
    } finally {
      setAdding(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAdd();
    }
  };

  // ── Voice handling ──────────────────────────────────────────────────────

  const handleVoiceTranscript = async (transcript: string) => {
    if (!token) return;
    setAddText(transcript);
    setPartial('');
    setError(null);
    try {
      const result = await apiPost<VoiceIntent>(
        `/api/workspaces/${slug}/voice/interpret`,
        { text: transcript },
        token,
      );
      if (result.intent === 'add_shopping_item' && result.data.item) {
        await addShoppingItem(slug, { name: String(result.data.item) }, token);
        setAddText('');
        await fetchItems();
      } else {
        // Fall back to simple parse
        const { name, quantity } = parseQuickAdd(transcript);
        if (name) {
          await addShoppingItem(slug, { name, quantity }, token);
          setAddText('');
          await fetchItems();
        }
      }
    } catch {
      // Fall back to simple parse
      const { name, quantity } = parseQuickAdd(transcript);
      if (name) {
        try {
          await addShoppingItem(slug, { name, quantity }, token);
          setAddText('');
          await fetchItems();
        } catch (err: any) {
          setError(err.message ?? 'Failed to add item');
        }
      }
    }
  };

  // ── Toggle bought ───────────────────────────────────────────────────────

  const handleToggle = async (itemId: string) => {
    if (!token) return;
    try {
      await toggleShoppingItem(slug, itemId, token);
      await fetchItems();
    } catch (err: any) {
      setError(err.message ?? 'Failed to update item');
    }
  };

  // ── Delete item ─────────────────────────────────────────────────────────

  const handleDelete = async (itemId: string) => {
    if (!token) return;
    try {
      await deleteShoppingItem(slug, itemId, token);
      await fetchItems();
    } catch (err: any) {
      setError(err.message ?? 'Failed to delete item');
    }
  };

  // ── Clear bought ────────────────────────────────────────────────────────

  const handleClearBought = async () => {
    if (!token) return;
    try {
      await clearBoughtItems(slug, token);
      await fetchItems();
    } catch (err: any) {
      setError(err.message ?? 'Failed to clear bought items');
    }
  };

  // ── Separate unbought / bought ──────────────────────────────────────────

  const unbought = items.filter((i) => !i.is_bought);
  const bought = items.filter((i) => i.is_bought);

  // ── Auth guard ──────────────────────────────────────────────────────────

  if (!token) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
        <div className="text-5xl mb-4" role="img" aria-hidden="true">🔒</div>
        <h2 className="text-lg font-bold text-gray-900 mb-1">Sign in required</h2>
        <p className="text-sm text-gray-400">
          Sign in to access the shopping list.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Quick add bar */}
      <div className="flex-shrink-0 px-4 pt-3 pb-2">
        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            <input
              ref={inputRef}
              type="text"
              value={addText}
              onChange={(e) => setAddText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Add item... e.g. Milk 2"
              disabled={adding}
              className="w-full min-h-[44px] pl-4 pr-12 py-2.5 rounded-xl bg-gray-100 border border-gray-200 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
              aria-label="Add shopping item"
            />
            {adding && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>

          {/* Add button */}
          <button
            type="button"
            onClick={handleAdd}
            disabled={!addText.trim() || adding}
            className="flex-shrink-0 w-[44px] h-[44px] flex items-center justify-center rounded-xl bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 transition-colors"
            aria-label="Add item"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14m-7-7h14" />
            </svg>
          </button>

          {/* Voice button */}
          <VoiceButton
            onTranscript={handleVoiceTranscript}
            onPartial={setPartial}
          />
        </div>

        {/* Live transcription */}
        {partial && (
          <p className="mt-1.5 px-1 text-xs text-gray-400 italic truncate">
            Hearing: {partial}
          </p>
        )}

        {/* Error */}
        {error && (
          <p className="mt-2 px-1 text-xs text-red-500">{error}</p>
        )}
      </div>

      {/* Items list */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="text-4xl mb-3" role="img" aria-hidden="true">🛒</div>
            <p className="text-sm text-gray-400">
              Your shopping list is empty. Add some items above!
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {/* Unbought items */}
            {unbought.map((item) => (
              <SwipeableItem
                key={item.id}
                item={item}
                onToggle={handleToggle}
                onDelete={handleDelete}
              />
            ))}

            {/* Bought items */}
            {bought.length > 0 && (
              <>
                <div className="flex items-center gap-2 pt-3 pb-1 px-1">
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    Bought ({bought.length})
                  </span>
                  <div className="flex-1 h-px bg-gray-200" />
                </div>
                {bought.map((item) => (
                  <SwipeableItem
                    key={item.id}
                    item={item}
                    onToggle={handleToggle}
                    onDelete={handleDelete}
                  />
                ))}
              </>
            )}
          </div>
        )}

        {/* Clear bought button */}
        {bought.length > 0 && (
          <div className="mt-4 pb-2">
            <button
              type="button"
              onClick={handleClearBought}
              className="w-full min-h-[44px] flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 text-red-600 text-sm font-medium hover:bg-red-100 active:bg-red-200 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Clear bought items
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
