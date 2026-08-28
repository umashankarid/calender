import { useState } from 'react';
import type { Workspace } from '../../types';
import { updateWorkspace } from '../../api/workspaces';
import { useAuth } from '../../hooks/useAuth';

interface Props {
  workspace: Workspace;
  onUpdated: () => void;
}

const WORKSPACE_TYPES = ['family', 'team', 'office', 'personal'] as const;

const TIMEZONES = [
  'Europe/Stockholm',
  'Europe/London',
  'Europe/Berlin',
  'Europe/Paris',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Australia/Sydney',
  'UTC',
];

export default function WorkspaceSettings({ workspace, onUpdated }: Props) {
  const { token } = useAuth();
  const [name, setName] = useState(workspace.name);
  const [slug, setSlug] = useState(workspace.slug);
  const [type, setType] = useState<string>('family');
  const [timezone, setTimezone] = useState(workspace.timezone || 'Europe/Stockholm');
  const [primaryColor, setPrimaryColor] = useState('#4f46e5');
  const [logoUrl, setLogoUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      await updateWorkspace(workspace.slug, { name, timezone }, token);
      setSuccess(true);
      onUpdated();
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Workspace Settings</h2>
        <p className="text-sm text-gray-500 mt-1">Configure your workspace details and preferences.</p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Name */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-5">
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">General</h3>

          <div>
            <label htmlFor="ws-name" className="block text-sm font-medium text-gray-700 mb-1">
              Workspace Name
            </label>
            <input
              id="ws-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              required
            />
          </div>

          <div>
            <label htmlFor="ws-slug" className="block text-sm font-medium text-gray-700 mb-1">
              Slug (URL path)
            </label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-400">hub.example.se/</span>
              <input
                id="ws-slug"
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                required
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">Only lowercase letters, numbers, and hyphens.</p>
          </div>

          <div>
            <label htmlFor="ws-type" className="block text-sm font-medium text-gray-700 mb-1">
              Workspace Type
            </label>
            <select
              id="ws-type"
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
            >
              {WORKSPACE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="ws-timezone" className="block text-sm font-medium text-gray-700 mb-1">
              Timezone
            </label>
            <select
              id="ws-timezone"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
            >
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Appearance */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-5">
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Appearance</h3>

          <div>
            <label htmlFor="ws-color" className="block text-sm font-medium text-gray-700 mb-1">
              Primary Color
            </label>
            <div className="flex items-center gap-3">
              <input
                id="ws-color"
                type="color"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="h-10 w-10 rounded-lg border border-gray-300 cursor-pointer p-0.5"
              />
              <input
                type="text"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="w-28 rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          </div>

          <div>
            <label htmlFor="ws-logo" className="block text-sm font-medium text-gray-700 mb-1">
              Logo URL
            </label>
            <input
              id="ws-logo"
              type="url"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              placeholder="https://example.com/logo.png"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
            <p className="text-xs text-gray-400 mt-1">Paste a URL to your logo image. File upload coming soon.</p>
            {logoUrl && (
              <div className="mt-3 flex items-center gap-3">
                <img
                  src={logoUrl}
                  alt="Logo preview"
                  className="h-12 w-12 rounded-lg object-cover border border-gray-200"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
                <span className="text-xs text-gray-400">Preview</span>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? 'Saving…' : 'Save Settings'}
          </button>

          {success && (
            <span className="text-sm text-green-600 font-medium">✓ Settings saved successfully</span>
          )}
          {error && (
            <span className="text-sm text-red-600 font-medium">{error}</span>
          )}
        </div>
      </form>
    </div>
  );
}
