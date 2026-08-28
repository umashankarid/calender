import { useState } from 'react';
import type { WorkspaceUser, WorkspaceRole } from '../../types';
import { inviteMember, updateMember, removeMember } from '../../api/members';
import { useAuth } from '../../hooks/useAuth';

interface Props {
  slug: string;
  members: WorkspaceUser[];
  onChanged: () => void;
}

const ROLE_STYLES: Record<WorkspaceRole, string> = {
  owner: 'bg-purple-100 text-purple-700',
  admin: 'bg-blue-100 text-blue-700',
  editor: 'bg-green-100 text-green-700',
  viewer: 'bg-gray-100 text-gray-600',
};

const INVITE_ROLES: { value: WorkspaceRole; label: string }[] = [
  { value: 'viewer', label: 'Viewer' },
  { value: 'editor', label: 'Editor' },
  { value: 'admin', label: 'Admin' },
];

const DEFAULT_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4',
  '#3b82f6', '#8b5cf6', '#ec4899', '#6b7280', '#14b8a6',
];

export default function MemberManagement({ slug, members, onChanged }: Props) {
  const { token } = useAuth();

  // Invite state
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<WorkspaceRole>('viewer');
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRole, setEditRole] = useState<WorkspaceRole>('viewer');
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editColor, setEditColor] = useState('#3b82f6');
  const [editSaving, setEditSaving] = useState(false);

  // Remove confirmation
  const [removingMember, setRemovingMember] = useState<WorkspaceUser | null>(null);
  const [removeLoading, setRemoveLoading] = useState(false);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setInviting(true);
    setInviteError(null);
    try {
      await inviteMember(slug, { email: inviteEmail, role: inviteRole }, token);
      setInviteEmail('');
      setInviteRole('viewer');
      onChanged();
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : 'Failed to invite member');
    } finally {
      setInviting(false);
    }
  }

  function startEditing(member: WorkspaceUser) {
    setEditingId(member.id);
    setEditRole(member.role);
    setEditDisplayName(member.display_name || member.user?.name || '');
    setEditColor(member.display_color || '#3b82f6');
  }

  function cancelEditing() {
    setEditingId(null);
  }

  async function handleEditSave(memberId: string) {
    if (!token) return;
    setEditSaving(true);
    try {
      await updateMember(slug, memberId, {
        role: editRole,
        display_name: editDisplayName,
        display_color: editColor,
      }, token);
      setEditingId(null);
      onChanged();
    } catch (err) {
      console.error('Failed to update member', err);
    } finally {
      setEditSaving(false);
    }
  }

  async function handleRemove() {
    if (!token || !removingMember) return;
    setRemoveLoading(true);
    try {
      await removeMember(slug, removingMember.id, token);
      setRemovingMember(null);
      onChanged();
    } catch (err) {
      console.error('Failed to remove member', err);
    } finally {
      setRemoveLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Members</h2>
        <p className="text-sm text-gray-500 mt-1">Manage who has access to this workspace.</p>
      </div>

      {/* Invite Form */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">Invite Member</h3>
        <form onSubmit={handleInvite} className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <label htmlFor="invite-email" className="sr-only">Email address</label>
            <input
              id="invite-email"
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="email@example.com"
              required
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
          <div>
            <label htmlFor="invite-role" className="sr-only">Role</label>
            <select
              id="invite-role"
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as WorkspaceRole)}
              className="w-full sm:w-auto rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
            >
              {INVITE_ROLES.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={inviting}
            className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 transition-colors whitespace-nowrap"
          >
            {inviting ? 'Inviting…' : 'Send Invite'}
          </button>
        </form>
        {inviteError && (
          <p className="mt-2 text-sm text-red-600">{inviteError}</p>
        )}
      </div>

      {/* Member List */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm divide-y divide-gray-100">
        <div className="px-6 py-4">
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
            {members.length} Member{members.length !== 1 ? 's' : ''}
          </h3>
        </div>

        {members.length === 0 ? (
          <div className="px-6 py-8 text-center">
            <p className="text-sm text-gray-400">No members yet. Invite someone above.</p>
          </div>
        ) : (
          members.map((member) => (
            <div key={member.id} className="px-6 py-4">
              {editingId === member.id ? (
                /* Edit Mode */
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    Editing: <span className="font-medium text-gray-900">{member.user?.email || member.user_id}</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label htmlFor={`edit-name-${member.id}`} className="block text-xs font-medium text-gray-500 mb-1">
                        Display Name
                      </label>
                      <input
                        id={`edit-name-${member.id}`}
                        type="text"
                        value={editDisplayName}
                        onChange={(e) => setEditDisplayName(e.target.value)}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label htmlFor={`edit-role-${member.id}`} className="block text-xs font-medium text-gray-500 mb-1">
                        Role
                      </label>
                      <select
                        id={`edit-role-${member.id}`}
                        value={editRole}
                        onChange={(e) => setEditRole(e.target.value as WorkspaceRole)}
                        disabled={member.role === 'owner'}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white disabled:bg-gray-50 disabled:text-gray-400"
                      >
                        <option value="owner">Owner</option>
                        <option value="admin">Admin</option>
                        <option value="editor">Editor</option>
                        <option value="viewer">Viewer</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Display Color</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={editColor}
                          onChange={(e) => setEditColor(e.target.value)}
                          className="h-9 w-9 rounded border border-gray-300 cursor-pointer p-0.5"
                        />
                        <div className="flex gap-1">
                          {DEFAULT_COLORS.map((c) => (
                            <button
                              key={c}
                              type="button"
                              onClick={() => setEditColor(c)}
                              className={`h-6 w-6 rounded-full border-2 transition-all ${editColor === c ? 'border-gray-800 scale-110' : 'border-transparent hover:border-gray-300'}`}
                              style={{ backgroundColor: c }}
                              title={c}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => handleEditSave(member.id)}
                      disabled={editSaving}
                      className="px-3 py-1.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                    >
                      {editSaving ? 'Saving…' : 'Save'}
                    </button>
                    <button
                      type="button"
                      onClick={cancelEditing}
                      className="px-3 py-1.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                /* View Mode */
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {/* Color swatch */}
                    <div
                      className="h-8 w-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                      style={{ backgroundColor: member.display_color || '#6b7280' }}
                    >
                      {(member.display_name || member.user?.name || '?').charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {member.display_name || member.user?.name || 'Unknown'}
                      </div>
                      <div className="text-xs text-gray-400">
                        {member.user?.email || member.user_id}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-semibold uppercase tracking-wide px-2.5 py-1 rounded-full ${ROLE_STYLES[member.role]}`}>
                      {member.role}
                    </span>
                    <button
                      type="button"
                      onClick={() => startEditing(member)}
                      className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                      title="Edit member"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </button>
                    {member.role !== 'owner' && (
                      <button
                        type="button"
                        onClick={() => setRemovingMember(member)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Remove member"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Remove Confirmation Modal */}
      {removingMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50" onClick={() => setRemovingMember(null)} />
          <div className="relative bg-white rounded-2xl shadow-xl max-w-sm w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Remove Member</h3>
            <p className="text-sm text-gray-600 mb-1">
              Are you sure you want to remove{' '}
              <span className="font-medium text-gray-900">
                {removingMember.display_name || removingMember.user?.name || removingMember.user?.email || 'this member'}
              </span>{' '}
              from the workspace?
            </p>
            <p className="text-xs text-gray-400 mb-6">This action cannot be undone.</p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setRemovingMember(null)}
                className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRemove}
                disabled={removeLoading}
                className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {removeLoading ? 'Removing…' : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
