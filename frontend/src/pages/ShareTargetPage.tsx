import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { listWorkspaces } from '../api/workspaces';
import { createEvent } from '../api/events';
import type { Workspace, VoiceIntent } from '../types';
import { apiPost } from '../api/client';

/**
 * Share Target page — receives shared text from Android share menu.
 * URL: /share?text=...&title=...&url=...
 *
 * Flow:
 * 1. User shares SMS/text to Calendar Hub
 * 2. This page reads the shared text
 * 3. Sends it to voice/interpret endpoint for parsing
 * 4. Shows parsed result for confirmation
 * 5. Creates the event on confirm
 */

export default function ShareTargetPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { token, user, loading: authLoading } = useAuth();

  const sharedTitle = searchParams.get('title') ?? '';
  const sharedText = searchParams.get('text') ?? '';
  const sharedUrl = searchParams.get('url') ?? '';
  const fullText = [sharedTitle, sharedText, sharedUrl].filter(Boolean).join(' ');

  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [parsed, setParsed] = useState<VoiceIntent | null>(null);
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Load user's first workspace
  useEffect(() => {
    if (!token) return;
    listWorkspaces(token).then((wss) => {
      if (wss.length > 0) setWorkspace(wss[0]);
    });
  }, [token]);

  // Auto-parse shared text
  useEffect(() => {
    if (!token || !workspace || !fullText) return;
    setParsing(true);
    apiPost<VoiceIntent>(
      `/api/workspaces/${workspace.slug}/voice/interpret`,
      { text: fullText },
      token,
    )
      .then((result) => {
        setParsed(result);
      })
      .catch(() => {
        // If parsing fails, just show the raw text
        setParsed({
          intent: 'create_event',
          data: { title: fullText.slice(0, 100) },
          confirmation_text: fullText,
        });
      })
      .finally(() => setParsing(false));
  }, [token, workspace, fullText]);

  const handleSave = async () => {
    if (!token || !workspace || !parsed) return;
    setSaving(true);
    setError(null);

    try {
      const data = parsed.data as Record<string, string>;
      const now = new Date();
      const eventData: Record<string, unknown> = {
        title: data.title ?? fullText.slice(0, 100),
        start: data.start ?? data.date ?? now.toISOString(),
        end: data.end ?? null,
        location: data.location ?? null,
        notes: fullText, // Save original shared text as notes
        all_day: false,
      };

      await createEvent(workspace.slug, eventData, token);
      setSuccess(true);

      // Redirect to workspace after 2 seconds
      setTimeout(() => {
        navigate(`/${workspace.slug}`);
      }, 2000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save event');
    } finally {
      setSaving(false);
    }
  };

  // Not logged in
  if (!authLoading && !user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-gray-50">
        <div className="text-5xl mb-4">📅</div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">Calendar Hub</h1>
        <p className="text-sm text-gray-500 mb-6 text-center">
          Please log in first to add shared content as events.
        </p>
        <button
          onClick={() => navigate('/')}
          className="px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors"
        >
          Go to Login
        </button>
      </div>
    );
  }

  // Loading
  if (authLoading || !workspace) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Success
  if (success) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-gray-50">
        <div className="text-6xl mb-4">✅</div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">Event Added!</h1>
        <p className="text-sm text-gray-400">Redirecting to calendar...</p>
      </div>
    );
  }

  const data = parsed?.data as Record<string, string> | undefined;

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">📅</div>
          <h1 className="text-xl font-bold text-gray-900">Add to Calendar</h1>
          <p className="text-sm text-gray-400 mt-1">
            Shared content will be added as an event
          </p>
        </div>

        {/* Shared text preview */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
            Shared Text
          </h3>
          <p className="text-sm text-gray-700 whitespace-pre-wrap break-words">
            {fullText || 'No text received'}
          </p>
        </div>

        {/* Parsing indicator */}
        {parsing && (
          <div className="flex items-center gap-3 bg-blue-50 rounded-xl p-4 mb-4">
            <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-blue-700">Parsing appointment details...</p>
          </div>
        )}

        {/* Parsed result */}
        {parsed && !parsing && (
          <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Detected Event
            </h3>
            <div className="space-y-2">
              {data?.title && (
                <div>
                  <span className="text-xs text-gray-400">Title: </span>
                  <span className="text-sm font-medium text-gray-900">{data.title}</span>
                </div>
              )}
              {(data?.date || data?.start) && (
                <div>
                  <span className="text-xs text-gray-400">Date: </span>
                  <span className="text-sm text-gray-700">{data.date ?? data.start}</span>
                </div>
              )}
              {(data?.time || data?.start_time) && (
                <div>
                  <span className="text-xs text-gray-400">Time: </span>
                  <span className="text-sm text-gray-700">{data.time ?? data.start_time}</span>
                </div>
              )}
              {data?.location && (
                <div>
                  <span className="text-xs text-gray-400">Location: </span>
                  <span className="text-sm text-gray-700">{data.location}</span>
                </div>
              )}
              {data?.person && (
                <div>
                  <span className="text-xs text-gray-400">Person: </span>
                  <span className="text-sm text-gray-700">{data.person}</span>
                </div>
              )}
              <div className="pt-2 border-t border-gray-100">
                <p className="text-xs text-gray-400 italic">{parsed.confirmation_text}</p>
              </div>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-50 rounded-xl p-4 mb-4">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={() => navigate(workspace ? `/${workspace.slug}` : '/')}
            className="flex-1 py-3 rounded-xl border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition-colors min-h-[48px]"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || parsing || !parsed}
            className="flex-1 py-3 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 min-h-[48px]"
          >
            {saving ? 'Saving...' : 'Add Event'}
          </button>
        </div>

        {/* Workspace info */}
        <p className="text-center text-xs text-gray-400 mt-4">
          Adding to workspace: {workspace.name}
        </p>
      </div>
    </div>
  );
}
