import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { listWorkspaces, createWorkspace } from '../api/workspaces';
import type { Workspace } from '../types';

// ── Auth Form ────────────────────────────────────────────────────────────────

function AuthForm({
  onSuccess,
}: {
  onSuccess: () => void;
}) {
  const { login, register } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (isRegister) {
        await register(email, name, password);
      } else {
        await login(email, password);
      }
      onSuccess();
    } catch (err: any) {
      setError(err.message ?? 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-md">
      <h2 className="text-2xl font-bold text-gray-900 mb-1 text-center">
        {isRegister ? 'Create an account' : 'Welcome back'}
      </h2>
      <p className="text-gray-500 text-center mb-6 text-sm">
        {isRegister
          ? 'Sign up to get started with Calendar Hub'
          : 'Sign in to your Calendar Hub account'}
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
            placeholder="you@example.com"
          />
        </div>

        {isRegister && (
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
              Full name
            </label>
            <input
              id="name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
              placeholder="Jane Doe"
            />
          </div>
        )}

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
            placeholder="••••••••"
          />
        </div>

        {error && (
          <p className="text-red-600 text-sm bg-red-50 rounded-lg px-3 py-2">{error}</p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-indigo-600 text-white py-2.5 rounded-lg font-medium hover:bg-indigo-700 focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 transition"
        >
          {submitting
            ? 'Please wait…'
            : isRegister
              ? 'Create account'
              : 'Sign in'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-500">
        {isRegister ? 'Already have an account?' : "Don't have an account?"}{' '}
        <button
          type="button"
          onClick={() => {
            setIsRegister(!isRegister);
            setError(null);
          }}
          className="text-indigo-600 font-medium hover:underline"
        >
          {isRegister ? 'Sign in' : 'Sign up'}
        </button>
      </p>
    </div>
  );
}

// ── Workspace Picker ─────────────────────────────────────────────────────────

function WorkspacePicker() {
  const { token, logout } = useAuth();
  const navigate = useNavigate();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newSlug, setNewSlug] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchWorkspaces = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await listWorkspaces(token);
      setWorkspaces(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkspaces();
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setCreating(true);
    setError(null);
    try {
      const ws = await createWorkspace({ name: newName, slug: newSlug }, token);
      navigate(`/${ws.slug}`);
    } catch (err: any) {
      setError(err.message ?? 'Failed to create workspace');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-md">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Your workspaces</h2>
        <button
          onClick={logout}
          className="text-sm text-gray-500 hover:text-gray-700 transition"
        >
          Sign out
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
        </div>
      ) : (
        <>
          {workspaces.length > 0 && (
            <ul className="space-y-2 mb-6">
              {workspaces.map((ws) => (
                <li key={ws.id}>
                  <button
                    onClick={() => navigate(`/${ws.slug}`)}
                    className="w-full text-left px-4 py-3 rounded-lg border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 transition flex items-center justify-between group"
                  >
                    <div>
                      <span className="font-medium text-gray-900 group-hover:text-indigo-700">
                        {ws.name}
                      </span>
                      <span className="ml-2 text-xs text-gray-400">/{ws.slug}</span>
                    </div>
                    <svg
                      className="h-5 w-5 text-gray-400 group-hover:text-indigo-500"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      aria-hidden="true"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {workspaces.length === 0 && !showCreate && (
            <p className="text-gray-500 text-sm text-center mb-4">
              You don't belong to any workspaces yet.
            </p>
          )}

          {!showCreate ? (
            <button
              onClick={() => setShowCreate(true)}
              className="w-full border-2 border-dashed border-gray-300 rounded-lg py-3 text-gray-500 hover:border-indigo-400 hover:text-indigo-600 transition font-medium text-sm"
            >
              + Create a workspace
            </button>
          ) : (
            <form onSubmit={handleCreate} className="space-y-3 border-t border-gray-100 pt-4">
              <div>
                <label htmlFor="ws-name" className="block text-sm font-medium text-gray-700 mb-1">
                  Workspace name
                </label>
                <input
                  id="ws-name"
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => {
                    setNewName(e.target.value);
                    setNewSlug(
                      e.target.value
                        .toLowerCase()
                        .replace(/[^a-z0-9]+/g, '-')
                        .replace(/(^-|-$)/g, ''),
                    );
                  }}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                  placeholder="My Family"
                />
              </div>
              <div>
                <label htmlFor="ws-slug" className="block text-sm font-medium text-gray-700 mb-1">
                  URL slug
                </label>
                <div className="flex items-center">
                  <span className="text-gray-400 text-sm mr-1">/</span>
                  <input
                    id="ws-slug"
                    type="text"
                    required
                    value={newSlug}
                    onChange={(e) => setNewSlug(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                    placeholder="my-family"
                  />
                </div>
              </div>

              {error && (
                <p className="text-red-600 text-sm bg-red-50 rounded-lg px-3 py-2">{error}</p>
              )}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="flex-1 py-2.5 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 bg-indigo-600 text-white py-2.5 rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 transition text-sm"
                >
                  {creating ? 'Creating…' : 'Create'}
                </button>
              </div>
            </form>
          )}
        </>
      )}
    </div>
  );
}

// ── Landing Page ─────────────────────────────────────────────────────────────

export default function LandingPage() {
  const { user, loading } = useAuth();
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    if (user) setAuthenticated(true);
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
      {/* Header */}
      <div className="mb-8 text-center">
        <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight">
          📅 Calendar Hub
        </h1>
        <p className="mt-2 text-gray-500 text-lg">
          Shared calendars for families, teams &amp; communities
        </p>
      </div>

      {/* Card */}
      {authenticated || user ? (
        <WorkspacePicker />
      ) : (
        <AuthForm onSuccess={() => setAuthenticated(true)} />
      )}
    </div>
  );
}
