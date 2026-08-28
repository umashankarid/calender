import React, { useState } from 'react';
import type { VoiceIntent, CalendarEvent } from '../../types';
import { apiPost } from '../../api/client';
import { createEvent } from '../../api/events';
import { useAuth } from '../../hooks/useAuth';
import VoiceButton from './VoiceButton';

// ── Types ────────────────────────────────────────────────────────────────────

interface QuickAddProps {
  slug: string;
  onEventCreated: () => void;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function QuickAdd({ slug, onEventCreated }: QuickAddProps) {
  const { token } = useAuth();
  const [text, setText] = useState('');
  const [partial, setPartial] = useState('');
  const [interpreting, setInterpreting] = useState(false);
  const [parsed, setParsed] = useState<VoiceIntent | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const interpret = async (input: string) => {
    if (!input.trim() || !token) return;
    setInterpreting(true);
    setError(null);
    try {
      const result = await apiPost<VoiceIntent>(
        `/api/workspaces/${slug}/voice/interpret`,
        { text: input.trim() },
        token,
      );
      setParsed(result);
    } catch (err: any) {
      setError(err.message ?? 'Failed to interpret');
    } finally {
      setInterpreting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      interpret(text);
    }
  };

  const handleVoiceTranscript = (transcript: string) => {
    setText(transcript);
    setPartial('');
    interpret(transcript);
  };

  const handleConfirm = async () => {
    if (!parsed || !token) return;
    setSaving(true);
    setError(null);
    try {
      const eventData: Partial<CalendarEvent> = {
        title: (parsed.data.title as string) ?? 'Untitled Event',
        start: (parsed.data.start as string) ?? new Date().toISOString(),
        end:
          (parsed.data.end as string) ??
          new Date(Date.now() + 3600000).toISOString(),
        notes: null,
        location: (parsed.data.location as string | undefined) ?? null,
        all_day: false,
      };
      await createEvent(slug, eventData, token);
      setParsed(null);
      setText('');
      onEventCreated();
    } catch (err: any) {
      setError(err.message ?? 'Failed to save event');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setParsed(null);
    setError(null);
  };

  return (
    <div className="px-4 pt-3 pb-2">
      {/* Input row */}
      <div className="flex items-center gap-2">
        <div className="flex-1 relative">
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Quick add: Aadvika badminton tomorrow 17-19"
            className="w-full min-h-[44px] pl-4 pr-3 py-2.5 rounded-xl bg-gray-100 border border-gray-200 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
            aria-label="Quick add event"
          />
          {interpreting && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>
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

      {/* Parsed result confirmation */}
      {parsed && (
        <div className="mt-3 bg-blue-50 border border-blue-200 rounded-xl p-3">
          <p className="text-xs text-blue-500 font-medium mb-1.5">
            Understood
          </p>
          <div className="space-y-1 text-sm text-gray-700">
            {parsed.data.title ? (
              <p>
                <span className="font-medium">What:</span> {String(parsed.data.title)}
              </p>
            ) : null}
            {parsed.data.member ? (
              <p>
                <span className="font-medium">Who:</span> {String(parsed.data.member)}
              </p>
            ) : null}
            {parsed.data.date ? (
              <p>
                <span className="font-medium">When:</span> {String(parsed.data.date)}
              </p>
            ) : null}
            {parsed.data.start ? (
              <p>
                <span className="font-medium">Time:</span>{' '}
                {String(parsed.data.start)}
                {parsed.data.end ? ` – ${String(parsed.data.end)}` : null}
              </p>
            ) : null}
            {parsed.data.location ? (
              <p>
                <span className="font-medium">Where:</span>{' '}
                {String(parsed.data.location)}
              </p>
            ) : null}
          </div>
          <div className="flex gap-2 mt-3">
            <button
              onClick={handleConfirm}
              disabled={saving}
              className="flex-1 min-h-[40px] rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving…' : 'Confirm'}
            </button>
            <button
              onClick={handleCancel}
              className="flex-1 min-h-[40px] rounded-lg bg-white text-gray-600 text-sm font-medium border border-gray-200 hover:bg-gray-50 active:bg-gray-100 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
